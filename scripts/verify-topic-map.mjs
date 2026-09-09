import { readFile, mkdir, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { parse } from "parse5"
const elements = (node) => [node, ...(node.childNodes ?? []).flatMap(elements)]
const attr = (node, key) => node.attrs?.find((a) => a.name === key)?.value
const results = []
const check = (name, condition, evidence) => results.push({ name, passed: !!condition, evidence })
const read = async (file) => JSON.parse(await readFile(file, "utf8"))
const registry = await read("ontology/math_registry.json")
const atlas = await read("public/static/topos/atlas.json")
const notes = await read("public/static/topos/index.json")
const approved = await read("knowledge/index.json")
const math = registry.nodes.filter(
  (n) => n.volume_id === "vol-1-existing" && n.stable_id !== "vol-1-existing",
)
const ids = new Set(atlas.model.concepts.map((n) => n.id))
check(
  "Mathematical registry identities occur once; no system/research nodes inflate math",
  ids.size === math.length &&
    atlas.model.concepts.length === math.length &&
    math.every((n) => ids.has(n.stable_id)),
  { registry: math.length, map: ids.size },
)
check(
  "Twelve distinct colored major themes are available",
  atlas.model.topics.length === 12 && new Set(atlas.model.topics.map((t) => t.color)).size === 12,
)
check(
  "Every title has a real theme and a source section",
  atlas.model.concepts.every(
    (n) =>
      n.topicIDs.length &&
      n.topicIDs.every((id) => atlas.model.topics.some((t) => t.id === id)) &&
      n.sections.every((id) => atlas.sections[id]),
  ),
)
check(
  "Taxonomy edges preserve both valid identities and structural status",
  atlas.model.relations.every(
    (r) =>
      ids.has(r.source) &&
      ids.has(r.target) &&
      r.provenance === "structure" &&
      r.type === "appears-in",
  ),
)
check(
  "Actual approved objects and relations stay separate from classification",
  notes.model.concepts.length === approved.objects.length &&
    notes.model.relations.length === approved.relations.length &&
    notes.model.concepts.every((n) => approved.objects.some((o) => o.id === n.id)),
)
check(
  "Every actual note/atom stays available through a theme",
  notes.model.concepts.every((n) => n.topicIDs?.length),
)
for (const file of ["math_registry.json", "math_outline.md", "sources.json", "audit.json"])
  check(
    `Published ontology bytes match reviewed ${file}`,
    (await readFile(`ontology/${file}`)).equals(await readFile(`public/static/ontology/${file}`)),
  )
const html = parse(await readFile("public/atlas.html", "utf8"))
const digest = createHash("sha256")
  .update(await readFile("public/static/topos/atlas.json"))
  .digest("hex")
check(
  "Atlas entry has a versioned static model URL below the Pages base",
  attr(
    elements(html).find((n) => n.tagName === "body"),
    "data-topos-index",
  ) === `./static/topos/atlas.json?v=${digest}`,
)
for (const [id, section] of Object.entries(atlas.sections)) {
  const dom = parse(section)
  check(
    `${id}: source disclosure does not claim checked proof`,
    section.includes("未执行 Lean") && !section.includes("LEAN_VERIFIED"),
  )
  for (const a of elements(dom).filter((n) => n.tagName === "a" && attr(n, "data-concept-target")))
    check(`${id}: classification link resolves`, ids.has(attr(a, "data-concept-target")))
}
await mkdir("artifacts/phase-01", { recursive: true })
const report = {
  at: new Date().toISOString(),
  checks: results,
  passed: results.filter((c) => c.passed).length,
  failed: results.filter((c) => !c.passed).length,
}
await writeFile("artifacts/phase-01/topic-map-checks.json", JSON.stringify(report, null, 2))
console.log(
  JSON.stringify(
    { passed: report.passed, failed: report.failed, failures: results.filter((c) => !c.passed) },
    null,
    2,
  ),
)
if (report.failed) process.exitCode = 1
