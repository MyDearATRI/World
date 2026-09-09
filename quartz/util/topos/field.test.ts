import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveContext } from "./context"
import { createField } from "./field"
import { topicContext } from "./topics"
import type { KnowledgeModel, ViewState } from "./types"
import { readFileSync } from "node:fs"
import { createPublishedModel } from "./published"
import type { KnowledgeIndex } from "../knowledge"

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
    relations: Array.from({ length: count }, (_, i) => ({
      id: `edge-${i}`,
      source: i < count - 1 ? `node-${i}` : "node-0",
      target: i < count - 1 ? `node-${i + 1}` : "node-2",
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

test("a batched footprint change flushes geometry without rebuilding the semantic graph", () => {
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
  assert.equal(visibilityCompilations, 0)
  assert.ok(saved.targets!["node-1"])
  assert.notDeepEqual(saved.targets, before.targets)
  field.step(1 / 60)
  assert.equal(visibilityCompilations, 0, "size changes do not rebuild semantic membership")
  for (const n of field.nodes) field.setRadius(n.id, n.radius)
  field.snapshot()
  assert.equal(visibilityCompilations, 0)
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
  while (field.step(1 / 60) && frames < 42) frames++
  assert.ok(frames < 42, "a stationary drag completes local movement within 700ms")
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

test("unchanged context and semantic zoom never restart position layout", () => {
  const model = fixture(),
    state = view(),
    context = deriveContext(model, state)
  const field = createField(model, context)
  field.settle()
  const initial = field.snapshot()
  for (let i = 0; i < 10; i++) {
    field.setContext(structuredClone(context))
    assert.equal(field.step(1 / 60), false)
    assert.deepEqual(field.snapshot(), initial)
  }
  for (const scale of [0.1, 0.7, 1.7, 2.9, 1]) {
    field.setContext(deriveContext(model, { ...state, scale }))
    for (let i = 0; i < 42; i++) field.step(1 / 60)
    assert.equal(field.step(1 / 60), false)
    assert.deepEqual(
      field.nodes.map((n) => [n.x, n.y, n.z]),
      initial.nodes.map((n) => [n.x, n.y, n.z]),
    )
  }
})

test("a dropped anchor and bounded neighbor response survive history, zoom and refocusing", () => {
  const model = fixture(),
    state = view(),
    context = deriveContext(model, state)
  const field = createField(model, context)
  field.settle()
  const before = field.snapshot(),
    dragged = field.nodes[1]
  const drop = { x: dragged.x + 160, y: dragged.y + 80 }
  field.drag(dragged.id, drop.x, drop.y)
  field.step(1 / 60)
  field.release(dragged.id)
  const underway = field.snapshot(),
    restored = createField(model, context)
  restored.restore(underway)
  for (let i = 0; i < 42; i++) {
    field.step(1 / 60)
    restored.step(1 / 60)
    assert.deepEqual(restored.snapshot(), field.snapshot())
    assert.deepEqual([dragged.x, dragged.y], [drop.x, drop.y])
    for (let j = 0; j < field.nodes.length; j++)
      if (j !== 1 && j !== 2)
        assert.deepEqual(
          [field.nodes[j].x, field.nodes[j].y, field.nodes[j].z],
          [before.nodes[j].x, before.nodes[j].y, before.nodes[j].z],
          "unrelated nodes and the current focus stay fixed",
        )
    assert.ok(
      Math.hypot(field.nodes[2].x - before.nodes[2].x, field.nodes[2].y - before.nodes[2].y) <= 20,
    )
  }
  assert.equal(field.step(1 / 60), false)
  assert.ok(
    Math.hypot(field.nodes[2].x - before.nodes[2].x, field.nodes[2].y - before.nodes[2].y) >= 10,
  )
  assert.deepEqual(field.snapshot().manualAnchors?.[dragged.id], { ...drop, z: dragged.z })
  field.setContext(deriveContext(model, { ...state, scale: 2.8 }))
  field.settle()
  assert.deepEqual([dragged.x, dragged.y], [drop.x, drop.y])
  field.setContext(deriveContext(model, { ...state, focus: dragged.id, trail: [state.focus] }))
  for (let i = 0; i < 120; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual([dragged.x, dragged.y], [drop.x, drop.y])
})

test("legacy field history restores positions without inventing a new long simulation", () => {
  const model = fixture(),
    context = deriveContext(model, view())
  const field = createField(model, context)
  field.settle()
  const saved = field.snapshot()
  delete saved.motions
  delete saved.manualAnchors
  saved.sleeping = false
  saved.coolingTime = 2
  saved.nodes[1].vx = 25
  const restored = createField(model, context)
  restored.restore(saved)
  assert.deepEqual(
    restored.nodes.map((n) => [n.x, n.y, n.z]),
    saved.nodes.map((n) => [n.x, n.y, n.z]),
  )
  assert.equal(restored.step(1 / 60), false)
  assert.ok(restored.nodes.every((n) => n.vx === 0 && n.vy === 0 && n.vz === 0))
  const before = restored.snapshot()
  const invalid = structuredClone(before)
  invalid.manualAnchors!["node-1"] = { x: NaN, y: 0, z: 0 }
  assert.throws(() => restored.restore(invalid), /Invalid field snapshot target/)
  assert.deepEqual(restored.snapshot(), before)
})

test("only an explicit rearrange action clears reader anchors while preserving node identities", () => {
  const model = fixture(),
    context = deriveContext(model, view())
  const field = createField(model, context)
  field.settle()
  const references = [...field.nodes],
    n = field.nodes[1]
  field.drag(n.id, 1200, 900)
  field.release(n.id)
  field.settle()
  field.setContext(context)
  assert.deepEqual([n.x, n.y], [1200, 900])
  assert.ok(field.snapshot().manualAnchors?.[n.id])
  field.setContext(context, { rearrange: true, clearManualAnchors: true })
  assert.deepEqual([n.x, n.y], [1200, 900], "explicit rearrange also begins without teleportation")
  for (let i = 0; i < 120; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.ok(Math.hypot(n.x, n.y) < 500)
  assert.deepEqual(field.snapshot().manualAnchors, {})
  assert.ok(field.nodes.every((node, i) => node === references[i]))
})

test("the actual 192-object graph is static after 700ms local release and two-second context changes", () => {
  const index = JSON.parse(
    readFileSync(new URL("../../../knowledge/index.json", import.meta.url), "utf8"),
  ) as KnowledgeIndex
  const model = createPublishedModel(index)
  assert.equal(model.concepts.length, 192)
  const state = { ...view(), focus: model.initial }
  const context = deriveContext(model, state),
    field = createField(model, context)
  for (const n of field.nodes) field.setRadius(n.id, n.id === state.focus ? 130 : 72)
  for (let i = 0; i < 120; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  const id = context.nodes.find((n) => n.role === "neighbor")!.id
  const readableIDs = new Set(
    context.nodes.filter((n) => n.role !== "horizon" || n.relevance > 0.3).map((n) => n.id),
  )
  const readable = field.nodes.filter((n) => readableIDs.has(n.id))
  for (let i = 0; i < readable.length; i++)
    for (let j = i + 1; j < readable.length; j++) {
      const a = readable[i],
        b = readable[j]
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 20,
        "readable initial footprints are separated without making room for hidden horizon nodes",
      )
    }
  const selected = field.nodes.find((n) => n.id === id)!,
    before = field.snapshot()
  const linked = new Set(
    model.relations.flatMap((r) =>
      r.source === id ? [r.target] : r.target === id ? [r.source] : [],
    ),
  )
  const drop = { x: selected.x + 160, y: selected.y + 80 }
  field.drag(id, drop.x, drop.y)
  field.step(1 / 60)
  field.release(id)
  for (let i = 0; i < 42; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual([selected.x, selected.y], [drop.x, drop.y])
  for (let i = 0; i < field.nodes.length; i++)
    if (field.nodes[i].id !== id) {
      const n = field.nodes[i],
        old = before.nodes[i]
      const distance = Math.hypot(n.x - old.x, n.y - old.y)
      assert.ok(distance <= 20)
      if (!linked.has(n.id) || !readableIDs.has(n.id)) assert.equal(distance, 0)
    }
  const same = field.snapshot()
  field.setContext(structuredClone(context))
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), same)
  field.setContext(
    deriveContext(model, { ...state, focus: id, trail: [state.focus], lens: "linear" }),
  )
  for (let i = 0; i < 120; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual([selected.x, selected.y], [drop.x, drop.y])
})
