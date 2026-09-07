import { readFile, readdir, lstat, mkdir, writeFile, rename, mkdtemp, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import {
  sha256,
  contained,
  assertUnlinked,
  listFiles,
  verifyManifest,
} from "./lib/export-boundary.mjs"
import { readNote, rewriteLinks, serializeNote, siteKind } from "./lib/export-markdown.mjs"
import { renderCanvas, webSlug } from "./lib/export-canvas.mjs"

const projectRoot = fileURLToPath(new URL("../", import.meta.url))
const lower = (value) => value.toLocaleLowerCase("en-US")
const stable = (value) => JSON.stringify(value, null, 2) + "\n"
async function exists(file) {
  try {
    await lstat(file)
    return true
  } catch (error) {
    if (error.code === "ENOENT") return false
    throw error
  }
}

export async function exportVault({
  root = projectRoot,
  sourceRoot,
  config,
  diagnostics = true,
} = {}) {
  config ??= JSON.parse(await readFile(path.join(root, "publish.config.json"), "utf8"))
  if (config.version !== 1) throw new Error("Unsupported publication config")
  const source = path.resolve(sourceRoot ?? path.resolve(root, config.sourceRoot))
  if (source === path.resolve(root))
    throw new Error("Vault source must be separate from the website")
  await assertUnlinked(source)
  const content = path.join(root, "content"),
    manifestFile = path.join(root, "publish-manifest.json")
  const report = {
    version: 1,
    missingLinks: [],
    excludedReferences: [],
    pdfReferences: [],
    canvasWarnings: [],
    excluded: [],
    normalizedMath: [],
    snapshot: {},
  }
  const excludeDirectories = new Set(config.excludeDirectories.map(lower)),
    excludeFiles = new Set(config.excludeFiles.map(lower))
  const blocked = (relative) =>
    relative
      .split("/")
      .some((part) => part.startsWith(".") || excludeDirectories.has(lower(part))) ||
    excludeFiles.has(lower(path.posix.basename(relative)))
  const files = []
  async function walk(directory, prefix = "", result = files, record = true) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (entry.isSymbolicLink()) {
        if (record) report.excluded.push({ source: relative, reason: "symbolic-link" })
        continue
      }
      if (blocked(relative)) {
        if (record) report.excluded.push({ source: relative, reason: "publication-boundary" })
        continue
      }
      if (entry.isDirectory())
        await walk(path.join(directory, entry.name), relative + "/", result, record)
      else if (
        entry.isFile() &&
        (/\.(md|canvas|pdf)$/i.test(entry.name) ||
          config.imageExtensions.includes(path.extname(entry.name).toLowerCase()))
      )
        result.push(relative)
    }
  }
  await walk(source)
  files.sort()
  const snapshots = new Map(),
    notes = new Map(),
    sources = new Map(files.map((file) => [lower(file), file]))
  async function snapshot(relative) {
    if (snapshots.has(relative)) return snapshots.get(relative).bytes
    const absolute = contained(source, relative)
    await assertUnlinked(source, relative)
    const bytes = await readFile(absolute)
    snapshots.set(relative, { bytes, sha256: sha256(bytes) })
    return bytes
  }
  for (const file of files.filter((file) => file.endsWith(".md"))) {
    const raw = (await snapshot(file)).toString("utf8"),
      parsed = readNote(raw, file)
    if (
      config.respectPrivateMetadata &&
      (parsed.data.private === true || parsed.data.publish === false || parsed.data.draft === true)
    ) {
      report.excluded.push({ source: file, reason: "private-metadata" })
      continue
    }
    if (parsed.normalizations.displayMath || parsed.normalizations.tableMath)
      report.normalizedMath.push({ source: file, ...parsed.normalizations })
    const output = file === config.home ? "index.md" : file
    notes.set(file, { ...parsed, source: file, output, siteKind: siteKind(file, parsed.data) })
  }
  if (!notes.has(config.home)) throw new Error("The approved home Markdown is missing")
  const aliases = new Map()
  for (const note of notes.values()) {
    for (const value of [
      path.posix.basename(note.source, ".md"),
      ...(Array.isArray(note.data.aliases) ? note.data.aliases : []),
    ]) {
      if (typeof value !== "string" || !value.trim()) continue
      const key = lower(value)
      if (!aliases.has(key)) aliases.set(key, new Set())
      aliases.get(key).add(note.source)
    }
  }
  const requestedImages = new Set(),
    requestedCanvases = new Set()
  const imageOutput = (relative) =>
    `assets/${sha256(relative).slice(0, 20)}${path.posix.extname(relative).toLowerCase()}`
  const canvasOutput = (relative) =>
    `maps/${path.posix.basename(relative, ".canvas")}-${sha256(relative).slice(0, 8)}.md`
  function resolve(from, rawTarget) {
    let target = rawTarget.trim()
    try {
      target = decodeURIComponent(target)
    } catch {
      throw new Error(`Malformed link encoding in ${from}`)
    }
    if (/^(https?:|mailto:)/i.test(target)) return { kind: "external", url: target }
    if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return { kind: "excluded" }
    const hash = target.indexOf("#"),
      anchor = hash >= 0 ? target.slice(hash + 1) : ""
    target = (hash >= 0 ? target.slice(0, hash) : target).replaceAll("\\", "/")
    if (!target) target = from
    if (target.startsWith("/") || target.split("/").includes("..")) {
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), target))
      if (resolved.startsWith("../") || target.startsWith("/"))
        throw new Error(`Link escapes the publication source in ${from}`)
      target = resolved
    }
    if (blocked(target) || blocked(target + ".md")) return { kind: "excluded" }
    if (/\.pdf$/i.test(target)) return { kind: "pdf" }
    let match
    const candidates = [
      target,
      path.posix.normalize(path.posix.join(path.posix.dirname(from), target)),
    ]
    for (const candidate of candidates) {
      match = sources.get(lower(candidate)) ?? sources.get(lower(candidate + ".md"))
      if (match) break
    }
    if (!match) {
      const matches = aliases.get(lower(path.posix.basename(target).replace(/\.md$/i, "")))
      if (matches?.size > 1) throw new Error(`Ambiguous note link in ${from}: ${target}`)
      if (matches?.size === 1) match = [...matches][0]
    }
    if (!match) {
      const matches = files.filter(
        (file) => lower(path.posix.basename(file)) === lower(path.posix.basename(target)),
      )
      if (matches.length > 1) throw new Error(`Ambiguous attachment link in ${from}: ${target}`)
      if (matches.length === 1) match = matches[0]
    }
    if (!match) return { kind: config.excludeLinkTitles?.includes(target) ? "excluded" : "missing" }
    const note = notes.get(match)
    if (note) return { kind: "note", output: note.output, title: note.title, anchor }
    if (match.endsWith(".md")) return { kind: "excluded" }
    if (match.endsWith(".canvas")) {
      requestedCanvases.add(match)
      return {
        kind: "canvas",
        output: canvasOutput(match),
        title: path.posix.basename(match, ".canvas"),
      }
    }
    if (config.imageExtensions.includes(path.extname(match).toLowerCase())) {
      requestedImages.add(match)
      return { kind: "image", output: imageOutput(match) }
    }
    return { kind: "excluded" }
  }
  const generated = new Map(),
    manifest = { version: 1, configSha256: sha256(stable(config)), notes: [], assets: [] }
  function addNote(note, output, kind) {
    const bytes = Buffer.from(output)
    generated.set(note.output, bytes)
    manifest.notes.push({
      source: note.source,
      output: note.output,
      sha256: snapshots.get(note.source).sha256,
      outputSha256: sha256(bytes),
      kind,
      title: note.title,
      siteKind: note.siteKind,
    })
  }
  for (const note of notes.values()) {
    const body = rewriteLinks(note.body, note.source, resolve, report)
    addNote(
      note,
      serializeNote({ ...note.data, title: note.title, siteKind: note.siteKind }, body),
      "note",
    )
  }
  const renderedCanvases = new Set()
  for (const canvas of requestedCanvases) {
    if (renderedCanvases.has(canvas)) continue
    renderedCanvases.add(canvas)
    const raw = (await snapshot(canvas)).toString("utf8"),
      output = canvasOutput(canvas),
      title = path.posix.basename(canvas, ".canvas")
    addNote(
      { source: canvas, output, title, siteKind: "canvas" },
      renderCanvas(raw, canvas, output, title, resolve, report),
      "canvas",
    )
  }
  for (const image of [...requestedImages].sort()) {
    const bytes = await snapshot(image)
    if (
      image.toLowerCase().endsWith(".svg") &&
      /<(?:script|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=\s*["']\s*(?!#)[^"']+|@import|url\(\s*["']?(?:https?:|\/\/)/i.test(
        bytes.toString("utf8"),
      )
    )
      throw new Error(`SVG requires a safe publication copy: ${image}`)
    const output = imageOutput(image)
    generated.set(output, bytes)
    manifest.assets.push({
      source: image,
      output,
      sha256: sha256(bytes),
      outputSha256: sha256(bytes),
    })
  }
  manifest.notes.sort((a, b) => (a.output < b.output ? -1 : a.output > b.output ? 1 : 0))
  manifest.assets.sort((a, b) => (a.output < b.output ? -1 : a.output > b.output ? 1 : 0))
  const slugs = new Set()
  for (const entry of manifest.notes) {
    const slug = lower(webSlug(entry.output))
    if (slugs.has(slug)) throw new Error(`Colliding publication page: ${entry.output}`)
    slugs.add(slug)
  }
  // Verify the read snapshot again before any public-copy mutation.
  const finalListing = []
  await walk(source, "", finalListing, false)
  if (stable(finalListing.sort()) !== stable(files))
    throw new Error("Vault file list changed during export; run the export again")
  for (const [relative, record] of snapshots) {
    await assertUnlinked(source, relative)
    if (sha256(await readFile(contained(source, relative))) !== record.sha256)
      throw new Error("Vault changed during export; run the export again")
  }
  let previous = { notes: [], assets: [] }
  await mkdir(content, { recursive: true })
  await assertUnlinked(root, "content")
  if (await exists(manifestFile)) previous = await verifyManifest(root)
  else {
    const present = await listFiles(content)
    const samples = new Set(["index.md", "notes/complete-metric-spaces.md"])
    if (present.some((file) => !samples.has(file)))
      throw new Error("Unknown content exists; refusing to overwrite it")
    for (const relative of present) {
      const bytes = await readFile(contained(content, relative))
      const note = readNote(bytes.toString("utf8"), relative)
      if (note.data.sample !== true)
        throw new Error("Existing content is not the known synthetic fixture")
      const destination = contained(path.join(root, "tests/fixtures/synthetic"), relative)
      if ((await exists(destination)) && sha256(await readFile(destination)) !== sha256(bytes))
        throw new Error("Synthetic fixture already differs")
      await mkdir(path.dirname(destination), { recursive: true })
      await writeFile(destination, bytes)
    }
  }
  let changed = 0
  for (const [relative, bytes] of generated) {
    const output = contained(content, relative)
    if ((await exists(output)) && sha256(await readFile(output)) === sha256(bytes)) continue
    changed++
  }
  for (const entry of [...previous.notes, ...previous.assets])
    if (!generated.has(entry.output)) changed++
  const manifestText = stable(manifest)
  if (!(await exists(manifestFile)) || (await readFile(manifestFile, "utf8")) !== manifestText)
    changed++
  if (changed) {
    const artifacts = path.join(root, "artifacts")
    await mkdir(artifacts, { recursive: true })
    await assertUnlinked(root, "artifacts")
    const transaction = await mkdtemp(path.join(artifacts, "export-transaction-"))
    const staged = path.join(transaction, "content"),
      backup = path.join(transaction, "previous-content")
    if (!transaction.startsWith(path.resolve(root) + path.sep))
      throw new Error("Export staging escaped the project")
    let oldMoved = false,
      newMoved = false,
      complete = false,
      rollbackComplete = false
    try {
      await mkdir(staged)
      for (const [relative, bytes] of generated) {
        const output = contained(staged, relative)
        await mkdir(path.dirname(output), { recursive: true })
        await writeFile(output, bytes)
      }
      const stagedManifest = path.join(transaction, "publish-manifest.json")
      await writeFile(stagedManifest, manifestText)
      await verifyManifest(transaction)
      if (await exists(manifestFile)) await verifyManifest(root)
      await assertUnlinked(root, "content")
      await rename(content, backup)
      oldMoved = true
      await rename(staged, content)
      newMoved = true
      await rename(stagedManifest, manifestFile)
      complete = true
    } catch (error) {
      if (newMoved) await rename(content, staged)
      if (oldMoved) await rename(backup, content)
      rollbackComplete = true
      throw error
    } finally {
      // Only this new, project-contained transaction directory is ever removed recursively.
      if (complete || rollbackComplete || !oldMoved)
        await rm(transaction, { recursive: true, force: true })
    }
  }
  report.snapshot = {
    notes: manifest.notes.length,
    assets: manifest.assets.length,
    sourceHashesChecked: snapshots.size,
    manifestSha256: sha256(manifestText),
  }
  if (diagnostics) {
    const output = path.join(root, "artifacts")
    await mkdir(output, { recursive: true })
    await assertUnlinked(root, "artifacts")
    await writeFile(path.join(output, "export-diagnostics.json"), stable(report))
  }
  await verifyManifest(root)
  return { manifest, report, changed }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await exportVault()
    console.log(
      `Exported ${result.manifest.notes.length} approved pages and ${result.manifest.assets.length} referenced images; ${result.changed} changed managed files. Missing links: ${result.report.missingLinks.length}; full diagnostics remain local in artifacts/export-diagnostics.json.`,
    )
  } catch (error) {
    console.error(`Export stopped: ${error.message}`)
    process.exitCode = 1
  }
}
