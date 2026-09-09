import test from "node:test"
import assert from "node:assert/strict"
import { loadOntology, validateOntology, selectSample } from "./validate-ontology.mjs"
const data = await loadOntology(new URL("../ontology/", import.meta.url))
const copy = () => structuredClone(data)
const fails = (input, criterion) =>
  assert.equal(validateOntology(input).criteria[criterion].status, "FAIL")
test("complete registry and all reviewed frozen classifications pass", () =>
  assert.equal(validateOntology(data).status, "PASS"))
test("classification omission cannot hide behind a smaller denominator", () => {
  const x = copy()
  x.msc.entries.pop()
  x.msc.acquired_total--
  fails(x, "P01-02")
})
test("duplicate classification mapping cannot replace a missing category", () => {
  const x = copy()
  x.registry.mappings.arxiv[1] = x.registry.mappings.arxiv[0]
  fails(x, "P01-02")
})
test("broad root or engineering node is not mathematics coverage", () => {
  for (const id of ["vol-1-existing", "math.region.geometry", "system.sandbox"]) {
    const x = copy()
    x.registry.mappings.msc[0].target_ids = [id]
    fails(x, "P01-02")
  }
})
test("unresolved source and unverified metadata do not count", () => {
  const x = copy()
  const n = x.registry.nodes.find((n) => n.substantive && n.volume_id === "vol-1-existing")
  n.source_ids = ["missing"]
  fails(x, "P01-03")
  fails(x, "P01-06")
})
test("same research group on two URLs is only one independent source", () => {
  const x = copy()
  const n = x.registry.nodes.find((n) => n.kind === "frontier")
  x.sources.sources
    .filter((s) => n.source_ids.includes(s.id))
    .forEach((s) => (s.source_group = "same-paper"))
  fails(x, "P01-04")
})
test("stale or future activity does not meet the recent-activity rule", () => {
  for (const date of ["2021-09-09", "2026-09-11"]) {
    const x = copy()
    x.registry.nodes
      .find((n) => n.kind === "frontier")
      .frontier.activity_evidence.forEach((a) => (a.date = date))
    fails(x, "P01-04")
  }
})
test("unrelated event source cannot supply the frontier date", () => {
  const x = copy()
  x.registry.nodes
    .find((n) => n.kind === "frontier")
    .frontier.activity_evidence.forEach((a) => (a.source_id = "src.arxiv-math"))
  fails(x, "P01-04")
})
test("duplicate ID and parent cycle are rejected", () => {
  let x = copy()
  x.registry.nodes.push(x.registry.nodes[0])
  fails(x, "P01-06")
  x = copy()
  x.registry.nodes[0].parent_ids = ["math.msc.03"]
  fails(x, "P01-06")
})
test("multi-parent membership is one canonical identity", () => {
  const n = data.registry.nodes.find((n) => n.parent_ids.length > 1)
  assert.ok(n)
  assert.equal(data.registry.nodes.filter((x) => x.stable_id === n.stable_id).length, 1)
})
test("prose and references cannot leak into the title-only outline", () => {
  for (const line of [
    "This is a definition.",
    "## Sources https://example.com",
    "## [source](https://example.com)",
  ]) {
    const x = copy()
    x.outline += "\n" + line
    fails(x, "P01-01")
  }
})
test("unreviewed frontier and sampled nodes fail even with sources", () => {
  let x = copy()
  x.audit.frontier_audit[0].status = "NOT_RUN"
  fails(x, "P01-05")
  x = copy()
  x.audit.sampling.reviews = []
  fails(x, "P01-05")
})
test("sample is deterministic and cannot be substituted after results", () => {
  assert.deepEqual(selectSample(data.registry), data.sample)
  const x = copy()
  x.sample.strata[0].sample_ids = []
  fails(x, "P01-05")
})
test("AI review must not be presented as a human signature", () => {
  const x = copy()
  x.sources.sources[0].human_reviewer = "Invented reviewer"
  fails(x, "P01-03")
})
test("edited mathematics invalidates the recorded topic review", () => {
  const x = copy()
  x.registry.nodes.find((n) => n.kind === "frontier").canonical_title =
    "Different research question"
  fails(x, "P01-05")
})
test("heading-only text cannot silently omit a registered subject", () => {
  const x = copy()
  x.outline = x.outline
    .split("\n")
    .filter((line) => !line.includes("数值分析"))
    .join("\n")
  fails(x, "P01-01")
})
test("edited source evidence invalidates its scope/independence review", () => {
  const x = copy()
  x.sources.sources[2].url = "https://example.org/unreviewed-replacement"
  fails(x, "P01-05")
})
