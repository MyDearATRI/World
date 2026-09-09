import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createOverviewIndex, overviewKind, overviewPageSize } from "./topicOverview"
import type { KnowledgeModel, Relation } from "./types"

function fixture() {
  const model = JSON.parse(readFileSync("knowledge/topos/prototype.json", "utf8")) as KnowledgeModel
  model.topics = [
    { id: "first", title: "第一主题", color: "#345678", description: "测试分类" },
    { id: "second", title: "第二主题", color: "#567834", description: "测试分类" },
  ]
  model.concepts.forEach((concept, i) => {
    concept.topicIDs = i % 3 === 0 ? ["first", "second"] : [i % 2 === 0 ? "first" : "second"]
    concept.mathType = i % 2 === 0 ? "definition" : "theorem"
  })
  return model
}
const view = { page: 0, query: "", kind: "all" }

test("every shared identity appears exactly once across bounded pages, regardless of model input order", () => {
  const model = fixture()
  const original = structuredClone(model)
  const index = createOverviewIndex(model)
  const ids = []
  const first = index.page(["first", "second"], view, 390)
  for (let page = 0; page < first.pages; page++) {
    const result = index.page(["first", "second"], { ...view, page }, 390)
    assert.ok(result.items.length <= 6)
    ids.push(...result.items.map((entry) => entry.concept.id))
  }
  assert.equal(ids.length, model.concepts.length)
  assert.equal(new Set(ids).size, model.concepts.length)
  const reversed = createOverviewIndex({ ...model, concepts: [...model.concepts].reverse() })
  assert.deepEqual(
    reversed.page(["second", "first"], view, 390).items.map((entry) => entry.concept.id),
    first.items.map((entry) => entry.concept.id),
  )
  assert.deepEqual(model, original)
})

test("empty selection, all selection, pagination and unavailable types have explicit outcomes", () => {
  const model = fixture()
  const index = createOverviewIndex(model)
  assert.equal(index.page([], view, 1440).total, 0)
  assert.equal(index.page(undefined, view, 1440).total, model.concepts.length)
  const missing = index.page(undefined, { ...view, kind: "not-a-published-kind" }, 390)
  assert.equal(missing.filtered, 0)
  assert.equal(missing.pages, 1)
  const beyond = index.page(undefined, { ...view, page: Infinity }, 390)
  assert.equal(beyond.page, 0)
  const last = index.page(undefined, { ...view, page: 999 }, 390)
  assert.equal(last.page, last.pages - 1)
  assert.deepEqual(
    [overviewPageSize(390), overviewPageSize(789), overviewPageSize(1168)],
    [6, 12, 15],
  )
})

test("search finds normalized aliases and all query terms; mathematical examples stay ordinary content", () => {
  const model = fixture()
  const concept = model.concepts[0]
  concept.title = "一个数学反例与 Example"
  concept.aliases = ["ＣＯＭＰＡＣＴＮＥＳＳ", "紧性"]
  concept.mathType = "example"
  const index = createOverviewIndex(model)
  assert.equal(
    index.page(undefined, { ...view, query: "compactness 紧性" }, 390).items[0].concept.id,
    concept.id,
  )
  assert.equal(index.page(undefined, { ...view, query: "紧性 不存在" }, 390).filtered, 0)
  assert.deepEqual(
    index.page(undefined, { ...view, kind: "example" }, 390).items.map((entry) => entry.concept.id),
    [concept.id],
  )
  concept.objectKind = "note"
  assert.equal(overviewKind(concept), "note")
})

test("relation listings preserve direction, evidence and off-page targets without synthesizing links", () => {
  const model = fixture()
  const [a, b, c] = model.concepts
  a.topicIDs = ["first"]
  b.topicIDs = ["second"]
  c.topicIDs = ["first"]
  const relations: Relation[] = [
    {
      id: "outgoing",
      source: a.id,
      target: b.id,
      type: "references",
      strength: 0.7,
      label: "引用",
      explanation: "原文引用",
      evidence: "实际原句",
      evidenceHref: "notes/source.html#block",
      lenses: {},
      provenance: "reference",
    },
    {
      id: "incoming",
      source: c.id,
      target: a.id,
      type: "proves",
      strength: 0.9,
      label: "证明",
      explanation: "证明原命题",
      evidence: "保留条件",
      evidenceHref: "notes/proof.html",
      lenses: {},
      provenance: "authored",
    },
    {
      id: "occurrence",
      source: a.id,
      target: b.id,
      type: "appears-in",
      strength: 0.6,
      label: "出现于",
      explanation: "结构收录",
      evidence: "出处",
      lenses: {},
      provenance: "structure",
    },
  ]
  model.relations = relations
  const index = createOverviewIndex(model)
  const page = index.page(["first"], { ...view, query: a.title }, 390)
  const found = index.relations(a.id, page)
  assert.equal(found.length, 3)
  assert.equal(found[0].direction, "outgoing")
  assert.equal(found[0].target.id, b.id)
  assert.equal(found[0].inSelection, false)
  assert.equal(found[1].direction, "incoming")
  assert.equal(found[1].target.id, c.id)
  assert.equal(found[1].inSelection, true)
  assert.equal(found[1].onPage, false)
  assert.equal(found[0].relation, relations[0])
  assert.equal(page.items.find((entry) => entry.concept.id === a.id)!.neighborCount, 2)
  assert.deepEqual(index.relations("not-a-real-object", page), [])
})
