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
  const expectedNoteSlugs = new Set(noteEntries.map((note) => fullSlug(note.output)))
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

  const contentIndex = JSON.parse(
    await readFile(path.join(publicRoot, "static/contentIndex.json"), "utf8"),
  )
  const search = JSON.parse(await readFile(path.join(publicRoot, "static/bookIndex.json"), "utf8"))
  check(
    search.version === 2 && Array.isArray(search.documents),
    "Search index has schema version 2",
  )
  const catalog = search.catalog
  if (
    !check(
      catalog?.version === 1 &&
        Array.isArray(catalog.books) &&
        catalog.pages &&
        typeof catalog.pages === "object",
      "Search index includes the shared reader catalog",
    )
  )
    throw new Error("No usable reader catalog")
  check(
    sameSet(new Set(Object.keys(catalog.pages)), expectedSlugs),
    "Reader catalog contains exactly the approved pages",
  )
  const booksById = new Map(catalog.books.map((book) => [book.id, book]))
  check(booksById.size === catalog.books.length, "Reader book identities are unique")
  const chapterIds = new Set()
  const roles = new Set([
    "book",
    "chapter",
    "reading",
    "knowledge",
    "connection",
    "exercise",
    "auxiliary",
    "other",
  ])
  for (const [slug, readerPage] of Object.entries(catalog.pages)) {
    const source = sourceBySlug.get(slug)
    check(
      Boolean(source) &&
        readerPage.slug === slug &&
        readerPage.title === source.title &&
        roles.has(readerPage.role) &&
        typeof readerPage.auxiliary === "boolean" &&
        stringArray(readerPage.sections),
      "Reader page preserves approved identity, title and role",
      slug,
    )
    if (readerPage.bookId) check(booksById.has(readerPage.bookId), "Reader page book exists", slug)
    if (source?.kind === "canvas" || source?.siteKind === "plan")
      check(
        readerPage.auxiliary && readerPage.role === "auxiliary",
        "Canvas and planning pages are auxiliary",
        slug,
      )
    for (const section of readerPage.sections ?? [])
      check(
        catalog.pages[section]?.role === "reading",
        "Associated section is a published reading page",
        slug,
        section,
      )
  }
  for (const book of catalog.books) {
    check(
      catalog.pages[book.slug]?.role === "book" &&
        catalog.pages[book.slug]?.bookId === book.id &&
        expectedNoteSlugs.has(book.contentsSlug),
      "Book opens approved book and contents pages",
      book.slug,
    )
    check(
      [book.id, book.title, book.subtitle, book.source].every(
        (value) => typeof value === "string" && value.length > 0,
      ),
      "Book identity and source labels are present",
      book.slug,
    )
    check(
      stringArray(book.plans) &&
        book.plans.every(
          (slug) => catalog.pages[slug]?.auxiliary && catalog.pages[slug]?.bookId === book.id,
        ),
      "Book plans remain explicit auxiliary pages",
      book.slug,
    )
    for (const chapter of book.chapters) {
      check(!chapterIds.has(chapter.id), "Chapter identity is globally unique", chapter.slug)
      chapterIds.add(chapter.id)
      check(
        expectedNoteSlugs.has(chapter.slug) && catalog.pages[chapter.slug]?.bookId === book.id,
        "Chapter opens an approved page within its book",
        chapter.slug,
      )
      const memberLists = [
        ["knowledge", chapter.knowledge],
        ["connection", chapter.connections],
        ["exercise", chapter.exercises],
      ]
      for (const [role, members] of memberLists)
        check(
          stringArray(members) &&
            new Set(members).size === members.length &&
            members.every(
              (slug) =>
                catalog.pages[slug]?.role === role &&
                catalog.pages[slug]?.chapterId === chapter.id &&
                !catalog.pages[slug]?.auxiliary,
            ),
          "Chapter groups contain their approved reading roles",
          chapter.slug,
          role,
        )
      check(
        stringArray(chapter.canvas) &&
          chapter.canvas.every((slug) => sourceBySlug.get(slug)?.kind === "canvas"),
        "Chapter Canvas references remain separate derived resources",
        chapter.slug,
      )
      check(
        Array.isArray(chapter.sections) &&
          new Set(chapter.sections.map((section) => section.slug)).size === chapter.sections.length,
        "Chapter reading sequence has no duplicate sections",
        chapter.slug,
      )
      for (const section of chapter.sections) {
        check(
          catalog.pages[section.slug]?.role === "reading" &&
            catalog.pages[section.slug]?.chapterId === chapter.id &&
            section.title === sourceBySlug.get(section.slug)?.title &&
            typeof section.number === "string",
          "Continuous section identity matches its source",
          section.slug,
        )
        check(
          stringArray(section.knowledge) &&
            section.knowledge.every(
              (slug) =>
                catalog.pages[slug]?.role === "knowledge" &&
                catalog.pages[slug]?.sections.includes(section.slug),
            ),
          "Section knowledge associations are reciprocal published links",
          section.slug,
        )
      }
      for (const readerPage of Object.values(catalog.pages).filter(
        (page) => page.chapterId === chapter.id && !page.auxiliary,
      )) {
        const exposed =
          readerPage.role === "reading"
            ? chapter.sections.some((section) => section.slug === readerPage.slug)
            : readerPage.role === "knowledge"
              ? chapter.knowledge.includes(readerPage.slug)
              : readerPage.role === "connection"
                ? chapter.connections.includes(readerPage.slug)
                : readerPage.role === "exercise"
                  ? chapter.exercises.includes(readerPage.slug)
                  : true
        check(exposed, "Every classified chapter page is exposed in its chapter", readerPage.slug)
      }
    }
  }
  for (const readerPage of Object.values(catalog.pages))
    if (readerPage.chapterId)
      check(chapterIds.has(readerPage.chapterId), "Reader page chapter exists", readerPage.slug)

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
    const slug = fullSlug(entry.output)
    const readerPage = catalog.pages[slug]
    const book = booksById.get(readerPage?.bookId)
    const chapter = book?.chapters.find((item) => item.id === readerPage?.chapterId)
    const expectedTitle =
      slug === "index"
        ? "书架"
        : readerPage?.role === "book"
          ? book?.title
          : readerPage?.role === "chapter"
            ? chapter?.title
            : entry.title
    const heading = all.find((node) => node.tagName === "h1")
    check(
      normalize(text(heading ?? {})) === normalize(expectedTitle),
      "Page heading matches the reader view or original Markdown title",
      page,
    )
    const pageTitle = all.find((node) => node.tagName === "title")
    check(
      normalize(text(pageTitle ?? {})).includes(normalize(entry.title)),
      "Document title contains the Markdown title",
      page,
    )
    const status = all
      .filter(
        (node) =>
          hasClass(node, "note-status") ||
          hasClass(node, "source-note-status") ||
          hasClass(node, "reader-meta") ||
          hasClass(node, "source-navigation"),
      )
      .map(text)
      .join(" ")
    for (const value of [markdown.data.status, markdown.data.layer].filter(Boolean))
      check(
        normalize(status).includes(String(value)),
        "Source status/layer remains readable in the page or source navigation",
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
    check(
      all.some((node) => hasClass(node, "markdown-content")),
      "Original Markdown remains in the reader document",
      page,
    )
    if (slug === "index" || readerPage?.role === "book" || readerPage?.role === "chapter")
      check(
        all.some(
          (node) =>
            node.tagName === "details" &&
            hasClass(node, "source-navigation") &&
            elements(node).some((child) => hasClass(child, "markdown-content")),
        ),
        "Landing page preserves original navigation in an expandable source section",
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
      const graphBook = booksById.get(graph.book?.id)
      const allowedNodes = new Set(
        (graphBook?.chapters ?? [])
          .flatMap((item) => [
            ...item.sections.map((section) => section.slug),
            ...item.knowledge,
            ...item.connections,
            ...item.exercises,
          ])
          .filter((slug) => expectedNoteSlugs.has(slug) && !catalog.pages[slug]?.auxiliary),
      )
      check(
        Array.isArray(graph.nodes) &&
          graph.nodes.length === graphIds.size &&
          Boolean(graphBook) &&
          sameSet(graphIds, allowedNodes),
        "Graph contains exactly the published non-auxiliary reading nodes of its book",
        page,
      )
      check(
        graph.book?.title === graphBook?.title,
        "Graph book label matches the reader catalog",
        page,
      )
      if (graph.book?.href) verifyHref(graph.book.href, page, "Graph book link")
      check(
        Array.isArray(graph.chapters) &&
          graph.chapters.length === graphBook?.chapters.length &&
          graph.chapters.every((item, index) => {
            const original = graphBook.chapters[index]
            return (
              item.id === original.id &&
              item.title === original.title &&
              stringArray(item.knowledge) &&
              sameSet(new Set(item.knowledge), new Set(original.knowledge))
            )
          }),
        "Graph chapter layers exactly match the shared catalog",
        page,
      )
      for (const item of graph.chapters ?? []) verifyHref(item.href, page, "Graph chapter link")
      if (graph.initialChapterId)
        check(
          graphBook?.chapters.some((item) => item.id === graph.initialChapterId),
          "Initial graph chapter exists in its book",
          page,
        )
      if (graph.initialFocusId)
        check(
          catalog.pages[graph.initialFocusId]?.role === "knowledge" &&
            graphIds.has(graph.initialFocusId) &&
            catalog.pages[graph.initialFocusId]?.chapterId === graph.initialChapterId,
          "Initial graph focus is a published knowledge node in the displayed chapter",
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
      const refersTo = (from, to) =>
        (contentIndex[from]?.links ?? []).some(
          (target) => target === to || target === to.replace(/(?:^|\/)index$/, "/"),
        )
      check(
        (graph.links ?? []).every(
          (edge) => refersTo(edge.source, edge.target) || refersTo(edge.target, edge.source),
        ),
        "Every graph edge is an existing Markdown reference rather than an inferred relationship",
        page,
      )
      for (const node of graph.nodes ?? []) {
        const source = sourceBySlug.get(node.id)
        check(
          Boolean(source) &&
            node.title === source.title &&
            node.role === catalog.pages[node.id]?.role &&
            node.chapterId === catalog.pages[node.id]?.chapterId &&
            !catalog.pages[node.id]?.auxiliary &&
            node.current === (node.id === fullSlug(entry.output)),
          "Graph node metadata matches approved Markdown",
          page,
          node.id,
        )
        verifyHref(node.href, page, "Graph node link")
        check(
          Boolean(source) &&
            ["/", "/World/"].every(
              (prefix) => localTarget(node.href, page, prefix).target === htmlPath(source.output),
            ),
          "Graph node link opens that exact published note",
          page,
          node.id,
        )
      }
    }
    if (slug === "index")
      check(
        !all.some((node) => Boolean(attrs(node)["data-graph"])),
        "Bookshelf remains free of the full note graph",
        page,
      )
    if (["book", "chapter"].includes(readerPage?.role))
      check(
        all.some((node) => Boolean(attrs(node)["data-graph"])),
        "Book and chapter views expose the appropriate layered graph",
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
  const searchIds = new Set(search.documents.map((doc) => doc.slug))
  check(
    searchIds.size === search.documents.length && sameSet(searchIds, expectedNoteSlugs),
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
    const readerPage = catalog.pages[doc.slug]
    const book = booksById.get(readerPage?.bookId)
    const chapter = book?.chapters.find((item) => item.id === readerPage?.chapterId)
    check(
      doc.role === readerPage?.role &&
        doc.auxiliary === readerPage?.auxiliary &&
        doc.bookId === readerPage?.bookId &&
        doc.bookTitle === (book?.title ?? "") &&
        doc.chapterTitle === (chapter?.title ?? ""),
      "Search grouping and auxiliary state match the shared reading model",
      doc.slug,
    )
    check(
      typeof doc.snippetText === "string",
      "Search provides source-paragraph snippet text",
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
    books: catalog.books.length,
    chapters: chapterIds.size,
    readerDiagnostics: catalog.diagnostics ?? [],
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
