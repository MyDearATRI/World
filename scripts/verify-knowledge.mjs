import fs from "node:fs/promises"
import path from "node:path"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"

const root = path.resolve(import.meta.dirname, "..")
const flag = process.argv.indexOf("--directory")
const output = path.resolve(root, flag >= 0 ? process.argv[flag + 1] : "public")
if (!output.startsWith(root + path.sep))
  throw new Error("Verification output must be inside website")
const index = JSON.parse(
  await fs.readFile(path.join(output, "static/knowledge-index.json"), "utf8"),
)
const prepared = JSON.parse(await fs.readFile(path.join(root, "knowledge/index.json"), "utf8"))
const results = []
const check = (name, pass, detail) =>
  results.push({ name, pass: Boolean(pass), ...(detail ? { detail } : {}) })
const cache = new Map()
async function readPage(relative) {
  if (cache.has(relative)) return cache.get(relative)
  const html = await fs.readFile(path.join(output, relative), "utf8")
  const tree = fromHtml(html)
  const ids = new Set()
  const duplicateIds = []
  const elements = []
  visit(tree, "element", (node) => {
    elements.push(node)
    if (typeof node.properties.id === "string") {
      if (ids.has(node.properties.id)) duplicateIds.push(node.properties.id)
      ids.add(node.properties.id)
    }
  })
  const page = { html, tree, ids, duplicateIds, elements }
  cache.set(relative, page)
  return page
}
const hasClass = (node, name) => (node.properties.className ?? []).includes(name)
const exists = async (relative) => {
  try {
    return (await fs.stat(path.join(output, relative))).isFile()
  } catch {
    return false
  }
}
async function checkLocalLink(from, value) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) return
  const url = new URL(value, new URL(from, "https://test.invalid/World/"))
  if (url.origin !== "https://test.invalid") return
  if (!url.pathname.startsWith("/World/")) {
    check(`${from}: deployed subpath`, false, value)
    return
  }
  const pathname = decodeURIComponent(url.pathname.slice("/World/".length))
  const candidates =
    pathname.endsWith("/") || !pathname
      ? [`${pathname}index.html`]
      : [pathname, `${pathname}.html`, `${pathname}/index.html`]
  const target = (
    await Promise.all(
      candidates.map(async (candidate) => ((await exists(candidate)) ? candidate : undefined)),
    )
  ).find(Boolean)
  check(`${from}: local target`, target, value)
  if (target?.endsWith(".html") && url.hash.length > 1) {
    const targetPage = await readPage(target)
    check(
      `${from}: target anchor`,
      targetPage.ids.has(decodeURIComponent(url.hash.slice(1))),
      value,
    )
  }
}

check("prepared and generated index agree", JSON.stringify(index) === JSON.stringify(prepared))
const objectIds = new Set(index.objects.map((object) => object.id))
check("unique identities", objectIds.size === index.objects.length)
check(
  "only published reading objects",
  index.objects.every(
    (object) => !["plan", "auxiliary", "canvas", "book", "chapter"].includes(object.type),
  ),
)
for (const relation of index.relations) {
  check(
    `${relation.id}: real endpoints`,
    objectIds.has(relation.source) && objectIds.has(relation.target),
  )
  check(
    `${relation.id}: evidence classification`,
    ["authored", "reference", "structure"].includes(relation.provenance) &&
      Boolean(relation.evidenceHref),
  )
  await checkLocalLink("explore.html", relation.evidenceHref)
}
for (const group of index.groups)
  check(
    `${group.id}: real group members`,
    group.objectIds.every((id) => objectIds.has(id)),
  )
for (const object of index.objects)
  check(`${object.id}: actual static page`, await exists(object.href))
for (const alias of index.aliases ?? []) {
  check(
    `${alias.id}: canonical alias target`,
    objectIds.has(alias.canonicalId) && !objectIds.has(alias.id),
  )
  check(`${alias.id}: static compatibility page`, await exists(alias.href))
}
const atoms = index.objects.filter((object) => object.kind === "atom")
for (const object of atoms) {
  const page = await readPage(object.href)
  check(
    `${object.id}: rendered article`,
    page.elements.some((node) => hasClass(node, "markdown-content")),
  )
  check(
    `${object.id}: original source links`,
    page.elements.some((node) => hasClass(node, "atom-source-links")),
  )
  check(
    `${object.id}: accessible formula rendering`,
    !object.latex.length || page.elements.some((node) => node.tagName === "math"),
  )
  check(
    `${object.id}: no formula error`,
    !page.elements.some((node) => hasClass(node, "katex-error")),
  )
  check(`${object.id}: distinct DOM IDs`, !page.duplicateIds.length, page.duplicateIds.join(", "))
  for (const occurrence of object.occurrences ?? []) {
    const origin = await readPage(`${occurrence.slug}.html`)
    check(`${object.id}: original atom anchor`, origin.ids.has(occurrence.anchor), occurrence.href)
    check(
      `${object.id}: original open link`,
      origin.elements.some(
        (node) =>
          node.tagName === "a" &&
          hasClass(node, "atom-open") &&
          node.properties.dataAtomId === object.id,
      ),
    )
  }
}
for (const relative of [
  "explore.html",
  ...atoms.map((object) => object.href),
  ...(index.aliases ?? []).map((alias) => alias.href),
]) {
  const page = await readPage(relative)
  for (const node of page.elements)
    for (const property of ["href", "src", "poster"]) {
      if (typeof node.properties[property] === "string")
        await checkLocalLink(relative, node.properties[property])
    }
}
const continuity = atoms.find((object) => object.title === "连续性的三种刻画，原书命题 1.2.2")
if (continuity) {
  const page = await readPage(continuity.href)
  const setting = page.elements.findIndex((node) => hasClass(node, "atom-required-setting"))
  const statement = page.elements.findIndex(
    (node) => hasClass(node, "semantic-block") && hasClass(node, "theorem"),
  )
  check(
    "reviewed metric setting precedes continuity statement",
    setting >= 0 && setting < statement,
  )
}
const report = {
  directory: path.relative(root, output),
  snapshotHash: index.snapshotHash,
  objects: index.objects.length,
  atoms: atoms.length,
  passed: results.filter((result) => result.pass).length,
  failed: results.filter((result) => !result.pass).length,
  results,
}
await fs.mkdir(path.join(root, "artifacts"), { recursive: true })
await fs.writeFile(
  path.join(root, "artifacts/knowledge-report.json"),
  JSON.stringify(report, null, 2) + "\n",
)
console.log(
  `Knowledge integrity: ${report.passed} passed, ${report.failed} failed; ${atoms.length} atom pages / ${index.objects.length} objects`,
)
for (const failure of results.filter((result) => !result.pass).slice(0, 30))
  console.error(`${failure.name}: ${failure.detail ?? "failed"}`)
if (report.failed) process.exitCode = 1
