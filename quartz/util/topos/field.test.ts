import assert from "node:assert/strict"
import { test } from "node:test"
import { deriveContext } from "./context"
import { createField, fieldForceSettings } from "./field"
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

test("large label footprint reports neither rebuild nor alter the circular physics layout", () => {
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
  assert.deepEqual(saved.targets, before.targets, "label dimensions cannot enlarge a node's circle")
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
        Math.hypot(a.x - b.x, a.y - b.y) >=
          a.radius + b.radius + fieldForceSettings.clearance - 0.1,
        "readable initial footprints are separated without making room for hidden horizon nodes",
      )
    }
  const selected = field.nodes.find((n) => n.id === id)!,
    before = field.snapshot()
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
      assert.ok(distance < 600, "local contact never ejects a readable object across the field")
      if (!readableIDs.has(n.id)) assert.equal(distance, 0)
    }
  assert.ok(
    field.nodes.filter((n, i) => n.x === before.nodes[i].x && n.y === before.nodes[i].y).length >
      model.concepts.length * 0.8,
    "local contact does not reheat the whole 192-object scene",
  )
  for (let i = 0; i < readable.length; i++)
    for (let j = i + 1; j < readable.length; j++) {
      const a = readable[i],
        b = readable[j]
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) >=
          a.radius + b.radius + fieldForceSettings.clearance - 0.1,
        `${a.id} and ${b.id} retain their own space after local contact`,
      )
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

function contactFixture(focus = "node-0") {
  const model = fixture(5)
  model.relations = []
  const context = deriveContext(model, { ...view(), focus })
  for (const role of context.nodes) {
    role.role = role.id === context.focus ? "focus" : "neighbor"
    role.relevance = role.id === context.focus ? 1 : 0.8
  }
  const field = createField(model, context)
  field.settle()
  const saved = field.snapshot()
  const coordinates = [
    [-600, -600],
    [-300, 0],
    [0, 0],
    [80, 0],
    [900, 900],
  ]
  saved.nodes.forEach((n, i) => {
    n.x = coordinates[i][0]
    n.y = coordinates[i][1]
    n.z = 0
    n.radius = 24
    saved.targets![n.id] = { x: n.x, y: n.y, z: 0 }
  })
  field.restore(saved)
  return { model, context, field }
}
const separation = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

test("unlinked contact propagates locally, gives every footprint space, and keeps the held node under the pointer", () => {
  const { model, field } = contactFixture()
  const source = JSON.stringify(model),
    before = field.snapshot()
  field.drag("node-1", -6, 0)
  assert.deepEqual(
    field.nodes.slice(2).map((n) => [n.x, n.y]),
    before.nodes.slice(2).map((n) => [n.x, n.y]),
    "neighbors begin a short transition instead of teleporting on pointerdown",
  )
  for (let i = 0; i < 42; i++) {
    field.step(1 / 60)
    assert.deepEqual([field.nodes[1].x, field.nodes[1].y], [-6, 0])
    for (let j = 0; j < field.nodes.length; j++)
      for (let k = j + 1; k < field.nodes.length; k++)
        assert.ok(
          separation(field.nodes[j], field.nodes[k]) >= 49.9,
          "actual painted-marker poses never overlap during held contact",
        )
  }
  assert.equal(field.step(1 / 60), false, "held pointer contact also reaches rest")
  assert.ok(separation(field.nodes[2], before.nodes[2]) > 40, "the first unlinked obstacle yields")
  assert.ok(
    separation(field.nodes[3], before.nodes[3]) > 10,
    "the next touching obstacle also yields",
  )
  for (let i = 0; i < field.nodes.length; i++)
    for (let j = i + 1; j < field.nodes.length; j++)
      assert.ok(
        separation(field.nodes[i], field.nodes[j]) >= 48 + fieldForceSettings.clearance - 0.1,
      )
  for (const i of [0, 4])
    assert.deepEqual(field.nodes[i], before.nodes[i], "distant unlinked nodes stay fixed")
  field.release("node-1")
  const stable = field.snapshot()
  for (let i = 0; i < 600; i++) assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), stable)
  assert.equal(JSON.stringify(model), source, "space constraints never add mathematical edges")
})

test("earlier manual targets remain recorded but yield their occupied space to a later drag", () => {
  const { field, model, context } = contactFixture()
  field.drag("node-2", 0, 0)
  field.release("node-2")
  field.settle()
  field.drag("node-1", -6, 0)
  field.step(1 / 60)
  field.release("node-1")
  const underway = field.snapshot(),
    restored = createField(model, context)
  restored.restore(underway)
  for (let i = 0; i < 42; i++) {
    field.step(1 / 60)
    restored.step(1 / 60)
    assert.deepEqual(restored.snapshot(), field.snapshot(), "contact transitions restore exactly")
  }
  assert.deepEqual(field.snapshot().manualAnchors?.["node-2"], { x: 0, y: 0, z: 0 })
  assert.ok(
    separation(field.nodes[2], { x: 0, y: 0 }) > 40,
    "an earlier anchor cannot reserve an overlapping final position",
  )
  assert.deepEqual(field.snapshot().layout?.["node-2"].preferredTarget, { x: 0, y: 0, z: 0 })
  assert.notDeepEqual(field.snapshot().layout?.["node-2"].resolvedTarget, { x: 0, y: 0, z: 0 })
  const settled = field.snapshot()
  field.setContext(structuredClone(context))
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), settled)
})

test("node-specific layout parameters are finite, degree-aware, observable, and not a semantic mutation", () => {
  const model = fixture(),
    source = JSON.stringify(model),
    context = deriveContext(model, view()),
    field = createField(model, context)
  field.settle()
  const data = field.snapshot().layout!
  assert.equal(data["node-0"].degree, 2)
  assert.equal(data["node-7"].degree, 1)
  assert.notEqual(data["node-1"].mass, data["node-2"].mass)
  assert.notEqual(data["node-1"].anchorGain, data["node-2"].anchorGain)
  for (const n of Object.values(data)) {
    assert.ok(n.mass >= 1 && n.mass < 5)
    assert.ok(n.anchorGain > 0 && n.anchorGain < 1)
    assert.ok(n.attractionGain > 0 && n.attractionGain < 1)
    assert.ok(n.repulsionGain >= 1 && n.repulsionGain <= 1.2)
    assert.ok(n.damping > 0 && n.damping < 1)
    assert.deepEqual(n.relationTypes, ["construction"])
  }
  const first = data["node-1"]
  field.drag("node-1", 1100, 900)
  const held = field.snapshot().layout!["node-1"]
  assert.equal(held.held, true)
  assert.equal(held.anchorGain, first.anchorGain * 2)
  assert.deepEqual(held.preferredTarget, { x: 1100, y: 900, z: field.nodes[1].z })
  field.release("node-1")
  for (let i = 0; i < 42; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.equal(field.snapshot().layout!["node-1"].held, false)
  assert.equal(JSON.stringify(model), source)
})

test("mass changes actual damped response without changing the final collision constraint", () => {
  const light = contactFixture().field,
    heavy = contactFixture("node-3").field
  assert.ok(heavy.nodes[3].mass > light.nodes[3].mass)
  for (const field of [light, heavy]) {
    field.drag("node-1", -6, 0)
    field.step(1 / 60)
  }
  const progress = (field: typeof light) =>
    separation(field.nodes[3], { x: 80, y: 0 }) /
    separation(field.snapshot().targets!["node-3"], { x: 80, y: 0 })
  assert.ok(
    progress(heavy) < progress(light),
    "heavier contact starts more slowly for the same available clearance",
  )
  for (const field of [light, heavy]) {
    field.release("node-1")
    for (let i = 0; i < 42; i++) field.step(1 / 60)
    assert.equal(field.step(1 / 60), false)
    assert.ok(separation(field.nodes[1], field.nodes[2]) >= 48 + fieldForceSettings.clearance - 0.1)
    assert.ok(separation(field.nodes[2], field.nodes[3]) >= 48 + fieldForceSettings.clearance - 0.1)
  }
})

test("a second drag cannot freeze an unfinished contact at an overlapping pose", () => {
  const { field } = contactFixture()
  field.drag("node-1", -6, 0)
  field.step(1 / 60)
  field.release("node-1")
  assert.ok(
    field.snapshot().motions!["node-2"],
    "fixture begins the second action during an unfinished circle-clearance transition",
  )
  field.drag("node-4", 920, 910)
  field.release("node-4")
  for (let i = 0; i < 42; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual([field.nodes[1].x, field.nodes[1].y], [-6, 0])
  assert.deepEqual([field.nodes[4].x, field.nodes[4].y], [920, 910])
  for (let i = 0; i < field.nodes.length; i++)
    for (let j = i + 1; j < field.nodes.length; j++)
      assert.ok(
        separation(field.nodes[i], field.nodes[j]) >= 48 + fieldForceSettings.clearance - 0.1,
      )
})

for (const legacy of [true, false])
  test(`real metric-space label then circle contact retains all visible objects (${legacy ? "captured candidate-2 poses" : "fresh circular layout"})`, (t) => {
    const index = JSON.parse(
      readFileSync(new URL("../../../knowledge/index.json", import.meta.url), "utf8"),
    ) as KnowledgeIndex
    const model = createPublishedModel(index),
      state = { ...view(), focus: "a-000067" },
      context = deriveContext(model, state)
    const field = createField(model, context)
    field.settle()
    const neighbor = "note:笔记主体/书籍/Simon实分析/第一章/研读/1.2-度量空间"
    // Actual 1440x1000 browser capture, not an invented mathematical fixture:
    // artifacts/node-space/candidate-2-contact/field-1440-contact-evidence.json
    // SHA256 62c53e7395276483aadeed95be4f561578d8af26f3771bfecd92077cd3d2324e.
    const captured: Record<string, { x: number; y: number; z: number }> = {
      "note:笔记主体/书籍/Simon实分析/第一章/知识/度量拓扑与连续性的三种刻画": {
        x: -349.86081896874873,
        y: 185.50851018353973,
        z: -76.2564,
      },
      [neighbor]: { x: -184.76612507540247, y: 350.25344969695976, z: -76.2564 },
      "a-000067": { x: 0, y: 0, z: 0 },
    }
    const readable = context.nodes
      .filter((n) => n.role !== "horizon" || n.relevance > 0.3)
      .map((n) => n.id)
    assert.deepEqual(
      new Set(readable),
      new Set(Object.keys(captured)),
      "the same three actual objects are tested; none is hidden to pass",
    )
    if (legacy) {
      const saved = field.snapshot()
      for (const n of saved.nodes) {
        if (captured[n.id]) {
          Object.assign(n, captured[n.id])
          saved.targets![n.id] = { ...captured[n.id] }
        }
        n.radius = n.id === state.focus ? 130 : 72
      }
      field.restore(saved)
      for (const n of field.nodes) {
        assert.ok(n.radius <= 38, "old title radii are normalized without moving an identity")
        if (captured[n.id]) assert.deepEqual([n.x, n.y, n.z], Object.values(captured[n.id]))
      }
    }
    const nodes = new Map(field.nodes.map((n) => [n.id, n])),
      initial = field.snapshot()
    const project = (id: string) => {
      const n = nodes.get(id)!
      return { x: 856 + n.x * 0.88, y: 470 + n.y * 0.88 }
    }
    const assertVisible = () => {
      for (const id of readable) {
        const p = project(id)
        assert.ok(
          p.x >= 284 && p.x <= 1428 && p.y >= 94 && p.y <= 892,
          `${id} remains in the actual usable viewport: ${JSON.stringify(p)}`,
        )
      }
    }
    assertVisible()
    const originalNeighbor = { ...nodes.get(neighbor)! }
    const gesture = (x: number, y: number) => {
      const n = nodes.get(state.focus)!,
        start = { x: n.x, y: n.y }
      for (let i = 1; i <= 12; i++) {
        field.drag(
          n.id,
          i === 12 ? x : start.x + ((x - start.x) * i) / 12,
          i === 12 ? y : start.y + ((y - start.y) * i) / 12,
        )
        field.step(1 / 60)
        assertVisible()
      }
      for (let i = 0; i < 12; i++) {
        field.step(1 / 60)
        assertVisible()
      }
      field.release(n.id)
      for (let i = 0; i < 45; i++) {
        field.step(1 / 60)
        assertVisible()
      }
      assert.equal(field.step(1 / 60), false)
      assert.deepEqual([n.x, n.y], [x, y])
      for (let i = 0; i < readable.length; i++)
        for (let j = i + 1; j < readable.length; j++)
          assert.ok(separation(nodes.get(readable[i])!, nodes.get(readable[j])!) >= 83.9)
    }
    // The recorded label centre is 7.691px left / 39.750px above its point.
    gesture(originalNeighbor.x - 7.690954744792 / 0.88, originalNeighbor.y - 39.749973909584 / 0.88)
    const afterLabel = project(neighbor),
      labelMovement = separation(nodes.get(neighbor)!, originalNeighbor)
    assert.ok(
      labelMovement < 65,
      "a label contact cannot reproduce the old 180.85-world-unit ejection",
    )
    const circle = { ...nodes.get(neighbor)! }
    gesture(circle.x + 1 / 0.88, circle.y + 1 / 0.88)
    const afterCircle = project(neighbor)
    assert.ok(separation(nodes.get(neighbor)!, circle) < 110, "circle contact stays local")
    for (let i = 0; i < field.nodes.length; i++)
      if (!readable.includes(field.nodes[i].id))
        assert.deepEqual(
          field.nodes[i],
          initial.nodes[i],
          "the hidden population never supplies clearance",
        )
    const stable = field.snapshot()
    for (let i = 0; i < 300; i++) assert.equal(field.step(1 / 60), false)
    assert.deepEqual(field.snapshot(), stable)
    t.diagnostic(
      JSON.stringify({
        legacy,
        objects: field.nodes.length,
        visible: readable.length,
        labelMovement,
        afterLabel,
        afterCircle,
      }),
    )
  })

test("reduced-motion settling preserves a held identity until its actual release", () => {
  const { field } = contactFixture()
  field.drag("node-1", -6, 0)
  field.settle(true)
  assert.equal(field.snapshot().layout!["node-1"].held, true)
  assert.deepEqual([field.nodes[1].x, field.nodes[1].y], [-6, 0])
  for (let i = 0; i < field.nodes.length; i++)
    for (let j = i + 1; j < field.nodes.length; j++)
      assert.ok(
        separation(field.nodes[i], field.nodes[j]) >= 48 + fieldForceSettings.clearance - 0.1,
      )
  field.drag("node-1", -5, 0)
  field.settle(true)
  assert.equal(field.snapshot().layout!["node-1"].held, true)
  field.release("node-1")
  assert.equal(field.snapshot().layout!["node-1"].held, false)
  assert.equal(field.step(1 / 60), false)
  field.drag("node-1", -4, 0)
  field.settle()
  assert.equal(
    field.snapshot().layout!["node-1"].held,
    false,
    "default settle retains legacy release behavior",
  )
})
