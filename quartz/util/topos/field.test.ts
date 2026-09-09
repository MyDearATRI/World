import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveContext } from "./context"
import { createField } from "./field"
import { topicContext } from "./topics"
import type { KnowledgeModel, ViewState } from "./types"

function fixture(count = 8): KnowledgeModel {
  return {
    version: 1,
    title: "Motion computation fixture",
    initial: "node-0",
    concepts: Array.from({ length: count }, (_, i) => ({
      id: `node-${i}`,
      title: `Fixture ${i}`,
      zh: "测试节点",
      kind: "concept",
      summary: "Synthetic computation fixture, not mathematical exposition.",
      symbol: "",
      terms: [i < 4 ? "first cluster" : "second cluster"],
      sections: [],
      topicIDs: [i < 4 ? "first" : "second"],
    })),
    relations: Array.from({ length: count - 1 }, (_, i) => ({
      id: `edge-${i}`,
      source: `node-${i}`,
      target: `node-${i + 1}`,
      type: "construction",
      strength: 0.8,
      label: "Fixture relation",
      explanation: "Synthetic edge for testing computation only.",
      evidence: "fixture",
      lenses: { structural: 1, action: 0.8, linear: 0.6 },
    })),
    topics: [
      { id: "first", title: "First", description: "Fixture", color: "#123456" },
      { id: "second", title: "Second", description: "Fixture", color: "#654321" },
    ],
    sections: [],
    sources: [],
  }
}
const view = (topics?: string[]): ViewState => ({
  version: 1,
  focus: "node-0",
  trail: [],
  lens: "structural",
  scale: 1,
  unfolded: [],
  topics,
})

test("filtered physics never scans hidden-node coordinates or the visible array per pair", () => {
  const model = fixture(192),
    context = topicContext(model, view(["first"]))
  let membershipScans = 0
  context.visibleIDs = new Proxy(context.visibleIDs!, {
    get(target, property, receiver) {
      if (property === "includes") membershipScans++
      return Reflect.get(target, property, receiver)
    },
  })
  const field = createField(model, context),
    visible = new Set(context.visibleIDs)
  let hiddenReads = 0
  for (const node of field.nodes.filter((node) => !visible.has(node.id))) {
    const x = node.x
    Object.defineProperty(node, "x", {
      get() {
        hiddenReads++
        return x
      },
      set() {
        assert.fail("Hidden nodes must retain their coordinates")
      },
    })
  }
  for (let i = 0; i < 8; i++) field.step(1 / 60)
  assert.equal(hiddenReads, 0, "excluded objects do not enter the quadratic force loop")
  assert.equal(membershipScans, 0, "membership is indexed outside force integration")
  assert.ok(field.nodes.filter((n) => !visible.has(n.id)).every((n) => n.relevance === 0))
})

test("one label-size pass rebuilds targets once and snapshots flush pending geometry", () => {
  const model = fixture(32),
    context = deriveContext(model, view())
  let visibilityCompilations = 0
  context.visibleIDs = new Proxy(
    model.concepts.map((n) => n.id),
    {
      get(target, property, receiver) {
        if (property === Symbol.iterator) visibilityCompilations++
        return Reflect.get(target, property, receiver)
      },
    },
  )
  const field = createField(model, context),
    before = field.snapshot()
  visibilityCompilations = 0
  for (const n of field.nodes) field.setRadius(n.id, n.id === context.focus ? 240 : 72)
  assert.equal(visibilityCompilations, 0)
  assert.deepEqual(
    field.nodes.map((n) => [n.x, n.y, n.z]),
    before.nodes.map((n) => [n.x, n.y, n.z]),
  )
  const saved = field.snapshot()
  assert.equal(visibilityCompilations, 1)
  assert.ok(saved.targets!["node-1"])
  assert.notDeepEqual(saved.targets, before.targets)
  field.step(1 / 60)
  assert.equal(visibilityCompilations, 1, "the same sizes do not rebuild again during integration")
  for (const n of field.nodes) field.setRadius(n.id, n.radius)
  field.snapshot()
  assert.equal(visibilityCompilations, 1)
})

test("a stationary held node lets the field sleep; a changed drag or release wakes it", () => {
  const model = fixture(4),
    field = createField(model, deriveContext(model, view()))
  field.settle()
  const neighbor = field.nodes[2],
    original = { x: neighbor.x, y: neighbor.y }
  field.drag("node-1", original.x + 20, original.y + 20)
  assert.equal(field.step(1 / 60), true)
  assert.ok(Math.hypot(neighbor.x - original.x, neighbor.y - original.y) > 0)
  let frames = 0
  while (field.step(1 / 60) && frames < 2400) frames++
  assert.ok(frames < 2400, "holding still does not render forever after forces have settled")
  const resting = field.snapshot()
  field.drag("node-1", original.x + 20, original.y + 20)
  field.release("not-pinned")
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), resting)
  field.drag("node-1", original.x + 30, original.y + 20)
  assert.equal(field.step(1 / 60), true)
  field.release("node-1")
  field.settle()
  assert.equal(field.step(1 / 60), false)
})

test("topic zoom and focus reuse community analysis instead of recomputing term consensus", () => {
  const model = fixture()
  let termAnalyses = 0
  for (const concept of model.concepts) {
    const terms = concept.terms
    Object.defineProperty(terms, "map", {
      value: function <T>(fn: (value: string, index: number, array: string[]) => T) {
        termAnalyses++
        return Array.prototype.map.call(this, fn)
      },
    })
  }
  const state = view(["first", "second"])
  topicContext(model, state)
  const firstAnalysis = termAnalyses
  assert.ok(firstAnalysis > 0)
  for (let i = 0; i < 20; i++)
    topicContext(model, { ...state, focus: `node-${i % 4}`, scale: 0.2 + i / 10 })
  assert.equal(termAnalyses, firstAnalysis, "semantic zoom does not change community structure")
  topicContext(model, { ...state, lens: "linear" })
  assert.ok(termAnalyses > firstAnalysis, "a new lens has its own graph analysis")
  const linearAnalysis = termAnalyses
  topicContext(model, { ...state, lens: "linear", scale: 2.7 })
  assert.equal(termAnalyses, linearAnalysis)
  model.relations[0].strength = 0.1
  topicContext(model, state)
  assert.ok(termAnalyses > linearAnalysis, "an in-place weight edit invalidates the cached graph")
})

test("cached topic models and paths match a fresh graph after in-place or replacement edits", () => {
  const model = fixture(),
    state = view(["first"])
  const checkFresh = () =>
    assert.deepEqual(topicContext(model, state), topicContext(structuredClone(model), state))
  checkFresh()
  model.concepts[4].topicIDs = ["first"]
  checkFresh()
  model.relations[0].target = "node-4"
  checkFresh()
  model.relations[1].strength = 0.04
  model.relations[1].lenses.structural = 0.1
  checkFresh()
  model.concepts[2] = { ...model.concepts[2], terms: ["new term"], title: "Changed title" }
  checkFresh()
  model.relations[2] = { ...model.relations[2], target: "node-0", type: "equivalence" }
  checkFresh()
  model.concepts.splice(5)
  model.relations = model.relations.filter(
    (r) =>
      model.concepts.some((n) => n.id === r.source) &&
      model.concepts.some((n) => n.id === r.target),
  )
  checkFresh()
})
