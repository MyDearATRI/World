import { readFile, mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { parse } from "parse5"
import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"
import { listFiles, sha256, verifyManifest } from "./lib/export-boundary.mjs"
import { webSlug } from "./lib/export-canvas.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const publicRoot = path.join(root, "public")
const sourceRoot = path.join(root, "content")
const failures = []
let checks = 0
const pageResults = []
const normalize = (value) =>
  String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
const attrs = (node) => Object.fromEntries((node.attrs ?? []).map((a) => [a.name, a.value]))
const hasClass = (node, name) => (attrs(node).class ?? "").split(/\s+/).includes(name)
const text = (node) =>
  node.nodeName === "#text" ? node.value : (node.childNodes ?? []).map(text).join("")
function elements(node) {
  const result = []
  const walk = (item) => {
    if (item.tagName) result.push(item)
    for (const child of item.childNodes ?? []) walk(child)
  }
  walk(node)
  return result
}
function check(condition, message, page = null, details = undefined) {
  checks++
  if (!condition) failures.push({ page, message, ...(details === undefined ? {} : { details }) })
  return Boolean(condition)
}
const sameSet = (a, b) => a.size === b.size && [...a].every((item) => b.has(item))
const fullSlug = (output) => {
  const simplified = webSlug(output)
  return simplified === "" ? "index" : simplified.endsWith("/") ? simplified + "index" : simplified
}
const htmlPath = (output) => fullSlug(output) + ".html"
const stringArray = (value) =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
const metadataArray = (value) =>
  Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split(",").map((item) => item.trim())
      : []

try {
  const manifest = await verifyManifest(root)
  console.log(
    `Verified publication hashes for ${manifest.notes.length} pages and ${manifest.assets.length} approved assets.`,
  )
  const published = await listFiles(publicRoot)
  const publishedSet = new Set(published)
  const expectedPages = new Map(manifest.notes.map((note) => [htmlPath(note.output), note]))
  const expectedSlugs = new Set(manifest.notes.map((note) => fullSlug(note.output)))
  const noteEntries = manifest.notes.filter((note) => note.kind === "note")
  const expectedGraphSlugs = new Set(noteEntries.map((note) => fullSlug(note.output)))
  const sourceBySlug = new Map()
  const htmlByPath = new Map()
  const assets = new Set(manifest.assets.map((asset) => asset.output))
  check(
    sameSet(
      new Set(published.filter((file) => file.endsWith(".html"))),
      new Set(expectedPages.keys()),
    ),
    "HTML pages exactly match the publication manifest",
  )
  const staticFile =
    /^(?:index\.css|prescript\.js|postscript\.js|static\/(?:contentIndex|bookIndex)\.json|static\/fonts\/(?:serif\.css|LICENSE\.txt|files\/[\w-]+\.woff2)|static\/katex\/(?:katex\.min\.css|LICENSE\.txt|fonts\/[\w-]+\.(?:ttf|woff2?)))$/
  check(
    published.every((file) => expectedPages.has(file) || assets.has(file) || staticFile.test(file)),
    "Every generated file is approved",
    null,
    published.filter(
      (file) => !expectedPages.has(file) && !assets.has(file) && !staticFile.test(file),
    ),
  )
  for (const asset of manifest.assets)
    check(
      publishedSet.has(asset.output) &&
        sha256(await readFile(path.join(publicRoot, asset.output))) === asset.outputSha256,
      "Published asset matches its approved hash",
      asset.output,
    )
  const config = await readFile(path.join(root, "quartz.config.ts"), "utf8")
  check(
    !/Plugin\.(?:Assets|CreatedModifiedDate|FolderPage|TagPage|AliasRedirects)\s*\(/.test(config),
    "No unrestricted assets, inferred dates, or unapproved page emitters",
  )
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))
  for (const command of [pkg.scripts.build, pkg.scripts.dev])
    check(
      /(?:-d|--directory)(?:=|\s+)content\b/.test(command) &&
        /(?:-o|--output)(?:=|\s+)public\b/.test(command) &&
        !/\.\.[/\\]/.test(command),
      "Build and development commands remain inside content/public",
    )

  for (const [page, entry] of expectedPages) {
    const markdown = matter(await readFile(path.join(sourceRoot, entry.output), "utf8"))
    sourceBySlug.set(fullSlug(entry.output), {
      ...entry,
      meta: markdown.data,
      body: markdown.content,
    })
    if (!publishedSet.has(page)) continue
    const raw = await readFile(path.join(publicRoot, page), "utf8")
    const dom = parse(raw),
      all = elements(dom),
      ids = new Map()
    for (const element of all) {
      const id = attrs(element).id
      if (id) ids.set(id, (ids.get(id) ?? 0) + 1)
    }
    htmlByPath.set(page, { raw, dom, all, ids, entry, markdown })
  }

  function localTarget(href, page, prefix) {
    const base = new URL(prefix + page, "https://publication.invalid")
    let target
    try {
      target = new URL(href, base)
    } catch {
      return { error: "Malformed URL" }
    }
    if (target.origin !== base.origin || !["http:", "https:"].includes(target.protocol))
      return { external: true }
    let pathname, anchor
    try {
      pathname = decodeURIComponent(target.pathname)
      anchor = decodeURIComponent(target.hash.slice(1))
    } catch {
      return { error: "Malformed URL encoding" }
    }
    if (!pathname.startsWith(prefix)) return { error: "Link escapes the hosting prefix" }
    let relative = pathname.slice(prefix.length)
    if (!relative || relative.endsWith("/")) relative += "index.html"
    else if (!publishedSet.has(relative) && publishedSet.has(relative + ".html"))
      relative += ".html"
    if (!publishedSet.has(relative))
      return { error: "Target is not an approved published file", target: relative }
    if (anchor && htmlByPath.has(relative) && !htmlByPath.get(relative).ids.has(anchor))
      return { error: "Missing target anchor", target: relative, anchor }
    return { target: relative, anchor }
  }
  function verifyHref(href, page, type) {
    for (const prefix of ["/", "/World/"]) {
      const result = localTarget(href, page, prefix)
      check(
        !result.error,
        `${type} resolves at ${prefix}`,
        page,
        result.error ? { href, ...result } : undefined,
      )
    }
  }

  let totalMath = 0,
    totalLinks = 0,
    totalGraphs = 0,
    totalFootnotes = 0
  for (const [page, document] of htmlByPath) {
    const { all, ids, entry, markdown, raw } = document
    const before = failures.length,
      beforeChecks = checks
    const heading = all.find((node) => node.tagName === "h1")
    check(
      normalize(text(heading ?? {})) === normalize(entry.title),
      "Markdown title is rendered as the page heading",
      page,
    )
    const pageTitle = all.find((node) => node.tagName === "title")
    check(
      normalize(text(pageTitle ?? {})).includes(normalize(entry.title)),
      "Document title contains the Markdown title",
      page,
    )
    const status = all.find((node) => hasClass(node, "note-status"))
    for (const value of [markdown.data.status, markdown.data.layer].filter(Boolean))
      check(
        normalize(text(status ?? {})).includes(String(value)),
        "Source status/layer is visible",
        page,
      )
    const duplicates = [...ids]
      .filter(([, count]) => count > 1)
      .map(([id, count]) => ({ id, count }))
    check(
      duplicates.length === 0,
      "All HTML and SVG IDs are unique within the page",
      page,
      duplicates,
    )
    check(
      all.some((node) => node.tagName === "article" && attrs(node).id === "article-content"),
      "A semantic article supplies the skip-link target",
      page,
    )
    check(!all.some((node) => hasClass(node, "katex-error")), "No KaTeX error output", page)
    if (!markdown.data.published && !markdown.data.publishDate && !markdown.data.date)
      check(
        !/<time\b|article:published_time|datePublished/.test(raw),
        "No inferred publication date",
        page,
      )
    const mathElements = all.filter((node) => hasClass(node, "katex"))
    let sourceMath = 0
    visit(unified().use(remarkParse).use(remarkMath).parse(markdown.content), (node) => {
      if (node.type === "math" || node.type === "inlineMath") sourceMath++
    })
    check(
      sourceMath === 0 || mathElements.length >= sourceMath,
      "Source mathematics reaches the rendered page",
      page,
      { sourceMath, renderedMath: mathElements.length },
    )
    check(
      mathElements.every((node) => {
        const children = elements(node)
        return (
          children.some((child) => hasClass(child, "katex-html")) &&
          children.some((child) => hasClass(child, "katex-mathml")) &&
          children.some((child) => child.tagName === "math")
        )
      }),
      "Every formula retains HTML and MathML",
      page,
    )
    totalMath += mathElements.length
    const regions = all.filter((node) => hasClass(node, "math-scroll"))
    check(
      regions.every(
        (node) =>
          attrs(node).role === "region" &&
          attrs(node).tabindex === "0" &&
          Boolean(attrs(node)["aria-label"]),
      ),
      "Display math regions have keyboard access and names",
      page,
    )
    for (const element of all) {
      const attributes = attrs(element)
      if (element.tagName === "a" && attributes.href) {
        totalLinks++
        verifyHref(attributes.href, page, "Local link or anchor")
      }
      if (attributes["data-footnote-ref"] !== undefined) {
        totalFootnotes++
        check(
          Boolean(attributes.id) && Boolean(attributes.href),
          "Footnote references have IDs and destinations",
          page,
        )
      }
      for (const [name, value] of Object.entries(attributes))
        for (const marker of value.matchAll(/url\(#([^)]+)\)/g))
          check(ids.has(marker[1]), "Inline SVG marker refers to an existing ID", page, {
            attribute: name,
            marker: marker[1],
          })
      const resource =
        attributes.src ??
        (element.tagName === "link" && /^(?:stylesheet|icon|preload)$/.test(attributes.rel ?? "")
          ? attributes.href
          : undefined)
      if (resource && !resource.startsWith("data:")) {
        check(
          !/^(?:https?:)?\/\//.test(resource),
          "Scripts, styles, and images are served locally",
          page,
          resource,
        )
        verifyHref(resource, page, "Local resource")
      }
      if (!attributes["data-graph"]) continue
      totalGraphs++
      let graph
      try {
        graph = JSON.parse(attributes["data-graph"])
      } catch {
        check(false, "Graph data is valid decoded JSON", page)
        continue
      }
      const graphIds = new Set(graph.nodes?.map((node) => node.id))
      check(
        Array.isArray(graph.nodes) &&
          graph.nodes.length === graphIds.size &&
          sameSet(graphIds, expectedGraphSlugs),
        "Graph contains exactly approved source notes, excluding Canvas",
        page,
      )
      const pairs = new Set()
      check(
        Array.isArray(graph.links) &&
          graph.links.every((edge) => {
            const key = JSON.stringify([edge.source, edge.target].sort())
            if (
              edge.source === edge.target ||
              !graphIds.has(edge.source) ||
              !graphIds.has(edge.target) ||
              pairs.has(key)
            )
              return false
            pairs.add(key)
            return true
          }),
        "Graph edges use approved nodes without duplicate edges",
        page,
      )
      for (const node of graph.nodes ?? []) {
        const source = sourceBySlug.get(node.id)
        check(
          Boolean(source) &&
            node.title === source.title &&
            node.kind === source.siteKind &&
            node.current === (node.id === fullSlug(entry.output)),
          "Graph node metadata matches approved Markdown",
          page,
          node.id,
        )
        verifyHref(node.href, page, "Graph node link")
      }
    }
    check(
      entry.kind === "canvas" || all.some((node) => Boolean(attrs(node)["data-graph"])),
      "Every source-note page exposes the approved graph",
      page,
    )
    if (entry.kind === "canvas")
      check(
        all.some((node) => hasClass(node, "canvas-reading-map")),
        "Canvas page retains its diagram and annotations",
        page,
      )
    pageResults.push({
      page,
      checks: checks - beforeChecks,
      failures: failures.length - before,
      formulas: mathElements.length,
    })
  }

  const contentIndex = JSON.parse(
    await readFile(path.join(publicRoot, "static/contentIndex.json"), "utf8"),
  )
  check(
    sameSet(new Set(Object.keys(contentIndex)), expectedSlugs),
    "Quartz content index contains exactly approved pages",
  )
  for (const [slug, value] of Object.entries(contentIndex))
    check(
      !path.isAbsolute(value.filePath ?? "") && !/^[A-Za-z]:|\.\.[/\\]/.test(value.filePath ?? ""),
      "Content-index file references are relative exported paths",
      slug,
    )
  const search = JSON.parse(await readFile(path.join(publicRoot, "static/bookIndex.json"), "utf8"))
  check(
    search.version === 1 && Array.isArray(search.documents),
    "Search index has the documented schema",
  )
  const searchIds = new Set(search.documents.map((doc) => doc.slug))
  check(
    searchIds.size === search.documents.length && sameSet(searchIds, expectedGraphSlugs),
    "Search includes approved source notes without Canvas duplicates",
  )
  for (const doc of search.documents) {
    const note = sourceBySlug.get(doc.slug)
    if (!check(Boolean(note), "Search result points to an approved note", doc.slug)) continue
    check(
      doc.title === note.title && doc.kind === note.siteKind,
      "Search title and category preserve source metadata",
      doc.slug,
    )
    check(
      stringArray(doc.aliases) &&
        sameSet(new Set(doc.aliases), new Set(metadataArray(note.meta.aliases))),
      "Search aliases match Markdown aliases",
      doc.slug,
    )
    check(
      ["status", "layer", "type"].every(
        (key) => doc[key] === (typeof note.meta[key] === "string" ? note.meta[key] : ""),
      ),
      "Search status, stage, and type match Markdown",
      doc.slug,
    )
    check(
      stringArray(doc.headings) && typeof doc.text === "string" && stringArray(doc.tags),
      "Search headings, text, and tags have valid types",
      doc.slug,
    )
    const page = htmlByPath.get(htmlPath(note.output))
    const markdownContent = page?.all.find((node) => hasClass(node, "markdown-content"))
    const headings = markdownContent
      ? elements(markdownContent)
          .filter((node) => /^h[1-6]$/.test(node.tagName))
          .map((node) => normalize(text(node)))
      : []
    const indexed = new Set(doc.headings.map(normalize))
    check(
      headings.every((heading) => indexed.has(heading)),
      "Search indexes every rendered content heading",
      doc.slug,
      headings.filter((heading) => !indexed.has(heading)),
    )
  }
  for (const file of published.filter((file) => file.endsWith(".css"))) {
    const css = await readFile(path.join(publicRoot, file), "utf8")
    check(
      !/@import\s+(?:url\()?['"]?https?:/.test(css),
      "Stylesheets do not import remote resources",
      file,
    )
    for (const match of css.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g))
      if (!match[1].startsWith("data:") && !match[1].startsWith("#")) {
        check(!/^(?:https?:)?\/\//.test(match[1]), "CSS resource is local", file)
        verifyHref(match[1], file, "CSS resource")
      }
  }
  const report = {
    version: 1,
    pages: expectedPages.size,
    sourceNotes: noteEntries.length,
    assets: assets.size,
    graphs: totalGraphs,
    formulas: totalMath,
    links: totalLinks,
    footnotes: totalFootnotes,
    checks,
    passed: checks - failures.length,
    failed: failures.length,
    pageResults,
    failures,
  }
  await mkdir(path.join(root, "artifacts"), { recursive: true })
  await writeFile(
    path.join(root, "artifacts/content-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(
    `Checked ${expectedPages.size} pages, ${totalMath} formulas, ${totalLinks} links, ${totalGraphs} graph datasets, and / plus /World/ mounts.`,
  )
  console.log(
    `Content verification: ${checks - failures.length} passed; ${failures.length} failed. Report: artifacts/content-report.json`,
  )
  for (const failure of failures.slice(0, 20))
    console.error(
      `FAIL ${failure.page ?? "site"}: ${failure.message}${failure.details === undefined ? "" : " " + JSON.stringify(failure.details).slice(0, 400)}`,
    )
  if (failures.length > 20)
    console.error(`${failures.length - 20} additional failures are in the local report.`)
  if (failures.length) process.exitCode = 1
} catch (error) {
  console.error(`Content verification stopped after ${checks} checks: ${error.message}`)
  process.exitCode = 1
}
