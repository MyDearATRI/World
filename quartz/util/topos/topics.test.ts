import { test } from "node:test"
import assert from "node:assert/strict"
import prepared from "../../../knowledge/index.json"
import mapping from "../../../knowledge/topos/note-topics.json"
import { createPublishedModel } from "./published"
import type { KnowledgeIndex } from "../knowledge"
import { attachNoteTopics, createAtlas, type AtlasRegistry } from "./atlas"
import { topicContext, topicIDs } from "./topics"
import { createField } from "./field"
import type { ViewState } from "./types"

const model = createPublishedModel(prepared as KnowledgeIndex)
attachNoteTopics(model, mapping)
const view: ViewState = {
  version: 1,
  focus: model.initial,
  trail: [],
  lens: "structural",
  scale: 1,
  unfolded: [],
}
test("all public objects remain available; explicit note themes preserve every occurrence", () => {
  assert.equal(model.concepts.length, 192)
  assert.ok(model.concepts.every((node) => node.topicIDs?.length))
  assert.equal(
    model.topics!.some((t) => t.id === "other"),
    false,
  )
  assert.equal(topicIDs(model).size, 192)
  const overlaps = model.concepts.filter((n) => n.topicIDs!.length > 1)
  assert.ok(overlaps.length > 0)
  for (const node of overlaps)
    assert.equal([...topicIDs(model, node.topicIDs)].filter((id) => id === node.id).length, 1)
})
test("selection preserves identity, filters both endpoints, and permits a genuinely empty field", () => {
  const ids = ["topology"]
  const allowed = topicIDs(model, ids)
  const context = topicContext(model, { ...view, topics: ids, focus: [...allowed][0] })
  assert.equal(context.nodes.length, model.concepts.length)
  for (const r of context.relations) assert.ok(allowed.has(r.source) && allowed.has(r.target))
  for (const node of context.nodes) if (!allowed.has(node.id)) assert.equal(node.relevance, 0)
  const empty = topicContext(model, { ...view, topics: [] })
  assert.equal(empty.visibleIDs?.length, 0)
  assert.equal(empty.relations.length, 0)
  const field = createField(model, context)
  field.settle()
  const before = field.snapshot()
  field.setContext(empty)
  field.settle()
  for (const n of field.nodes) {
    const old = before.nodes.find((x) => x.id === n.id)!
    assert.deepEqual([n.x, n.y, n.z], [old.x, old.y, old.z])
  }
})
test("taxonomy uses one node for cross-region membership, keeps proposed volumes outside the mathematical graph", () => {
  const node = (id: string, parents: string[], volume = "vol-1-existing") => ({
    stable_id: id,
    canonical_title: id,
    aliases: [],
    volume_id: volume,
    kind: "topic",
    parent_ids: parents,
    cross_memberships: [],
    source_ids: ["source"],
    frontier: { status: "ESTABLISHED" },
  })
  const registry: AtlasRegistry = {
    nodes: [
      node("math.region.a", []),
      node("math.region.b", []),
      node("intersection", ["math.region.a", "math.region.b"]),
      node("future-engine", [], "vol-2-system"),
    ],
  }
  const atlas = createAtlas(registry, [
    { id: "source", title: "Audited taxonomy", url: "https://example.org/taxonomy" },
  ])
  assert.equal(atlas.model.concepts.length, 3)
  assert.equal(atlas.model.concepts.find((n) => n.id === "intersection")?.topicIDs?.length, 2)
  assert.equal(atlas.model.relations.length, 2)
  assert.ok(atlas.model.relations.every((r) => r.provenance === "structure"))
  assert.ok(atlas.sections["atlas:intersection"].includes("未执行 Lean"))
  registry.nodes[2].parent_ids = ["intersection"]
  assert.throws(() => createAtlas(registry, []), /Cyclic ontology/)
})
