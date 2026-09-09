import { strict as assert } from "node:assert"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { deriveCommunities, deriveContext, relationAffinity } from "./context"
import { createField, type FieldSnapshot } from "./field"
import { createAppearanceModel, communityFootprint } from "../../components/scripts/topos/renderer"
import type { KnowledgeModel, Lens, Relation, RelationType, ViewState } from "./types"

test("repeated context evaluation cannot mutate cached communities or ignore graph edits", () => {
  const model = fixture()
  const initial = deriveCommunities(model, "structural")
  assert.ok(initial.length > 0)
  const changedOutput = deriveCommunities(model, "structural")
  changedOutput[0].members.splice(0)
  changedOutput[0].label = "not a source label"
  assert.deepEqual(deriveCommunities(model, "structural"), initial)
  const edges = model.relations
  model.relations = []
  assert.deepEqual(deriveCommunities(model, "structural"), [])
  model.relations = edges
  assert.deepEqual(deriveCommunities(model, "structural"), initial)
})

// Deliberately small test ontology. These labels do not provide production mathematical content.
function fixture(): KnowledgeModel {
  const titles = [
    ["g", "Group", "symmetry"],
    ["a", "Action", "symmetry"],
    ["h", "Subgroup", "symmetry"],
    ["o", "Orbit", "symmetry"],
    ["r", "Representation", "linear structure"],
    ["v", "Vector space", "linear structure"],
    ["m", "Module", "linear structure"],
    ["i", "Irreducibility", "linear structure"],
    ["island", "Unlinked test concept", "isolated"],
  ]
  const relation = (
    source: string,
    target: string,
    type: RelationType = "construction",
    lenses: Relation["lenses"] = { structural: 1, action: 1, linear: 1 },
  ): Relation => ({
    id: `${source}-${target}`,
    source,
    target,
    type,
    strength: 0.9,
    label: `Test ${type}`,
    explanation: "A test edge, not an assertion about mathematics.",
    evidence: "fixture",
    lenses,
  })
  return {
    version: 1,
    title: "Engine fixture",
    initial: "g",
    concepts: titles.map(([id, title, term]) => ({
      id,
      title,
      zh: title,
      kind: "concept",
      summary: `Fixture for ${title}`,
      symbol: id,
      terms: [term, title],
      sections: [],
    })),
    relations: [
      relation("g", "a"),
      relation("g", "h", "specialization", { structural: 1, action: 0.15, linear: 0.15 }),
      relation("a", "h"),
      relation("a", "o", "example"),
      relation("h", "o", "construction"),
      { ...relation("a", "r", "representation"), strength: 0.55 },
      relation("r", "v", "representation"),
      relation("r", "m", "equivalence"),
      relation("r", "i", "specialization"),
      relation("v", "m", "construction"),
      relation("m", "i", "specialization"),
      relation("v", "i", "dependency"),
    ],
    sections: [],
    sources: [],
  }
}
const view = (
  focus = "g",
  trail: string[] = [],
  lens: Lens = "structural",
  scale = 1,
): ViewState => ({
  version: 1,
  focus,
  trail,
  lens,
  scale,
  unfolded: [],
})
const xy = (p: { x: number; y: number }) => Math.hypot(p.x, p.y)
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)
const node = (field: ReturnType<typeof createField>, id: string) =>
  field.nodes.find((n) => n.id === id)!
const freeze = <T>(value: T): T => {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const item of Object.values(value)) freeze(item)
  }
  return value
}

test("Group → Action → Representation preserves all concepts while relevance and roles change", () => {
  const model = freeze(fixture())
  const group = deriveContext(model, freeze(view()))
  const action = deriveContext(model, view("a", ["g"]))
  const representation = deriveContext(model, view("r", ["g", "a"]))
  for (const context of [group, action, representation]) {
    assert.deepEqual(
      context.nodes.map((n) => n.id),
      model.concepts.map((n) => n.id),
    )
    assert.equal(context.nodes.filter((n) => n.role === "focus").length, 1)
    assert.ok(context.nodes.every((n) => Number.isFinite(n.distance) && n.relevance > 0))
  }
  assert.equal(group.nodes.find((n) => n.id === "r")!.role, "horizon")
  assert.equal(action.nodes.find((n) => n.id === "r")!.role, "neighbor")
  assert.equal(action.nodes.find((n) => n.id === "g")!.role, "previous")
  assert.equal(representation.nodes.find((n) => n.id === "a")!.role, "previous")
  assert.equal(representation.nodes.find((n) => n.id === "g")!.role, "horizon")
  assert.equal(representation.nodes.find((n) => n.id === "v")!.role, "neighbor")
  assert.equal(representation.nodes.find((n) => n.id === "island")!.role, "horizon")
})

test("lens and semantic scale change actual relation visibility and contextual relevance", () => {
  const model = fixture()
  const structural = deriveContext(model, view("g", [], "structural"))
  const action = deriveContext(model, view("g", [], "action"))
  assert.equal(structural.nodes.find((n) => n.id === "h")!.role, "neighbor")
  assert.equal(action.nodes.find((n) => n.id === "h")!.role, "horizon")
  assert.ok(structural.relations.some((e) => e.id === "g-h"))
  assert.ok(!action.relations.some((e) => e.id === "g-h"))
  const distant = deriveContext(model, view("a", [], "structural", 0.5))
  const close = deriveContext(model, view("a", [], "structural", 2.6))
  assert.ok(!distant.relations.some((e) => e.id === "a-r"))
  assert.ok(close.relations.some((e) => e.id === "a-r"))
  assert.ok(close.relations.length > distant.relations.length)
  assert.ok(
    distant.nodes.find((n) => n.id === "island")!.relevance >
      close.nodes.find((n) => n.id === "island")!.relevance,
  )
})

test("invalid focus and trail entries recover without inventing a concept", () => {
  const model = fixture()
  const context = deriveContext(
    model,
    view("missing", ["a", "also-missing", "g", "g"], "linear", NaN),
  )
  assert.equal(context.focus, "g")
  assert.equal(context.previous, "a")
  assert.equal(context.scale, 1)
  assert.throws(() => deriveContext({ ...model, concepts: [] }, view()), /at least one concept/)
  assert.equal(deriveContext(model, view("g", [], "action", 100)).scale, 3)
  assert.equal(deriveContext(model, view("g", [], "action", 0)).scale, 0)
})

test("zero-affinity edges and missing endpoints do not create a semantic connection", () => {
  const model = fixture()
  model.relations.push({
    ...model.relations[0],
    id: "zero",
    source: "g",
    target: "island",
    strength: 0,
  })
  model.relations.push({ ...model.relations[0], id: "dangling", target: "absent" })
  const context = deriveContext(model, view())
  assert.equal(context.nodes.find((n) => n.id === "island")!.distance, model.concepts.length + 1)
  assert.ok(!context.relations.some((r) => r.id === "zero" || r.id === "dangling"))
})

test("communities follow dense graph neighborhoods, remain deterministic and use shared terms", () => {
  const model = fixture()
  const communities = deriveCommunities(model, "structural")
  assert.ok(
    communities.some(
      (c) => c.members.includes("g") && c.members.includes("h") && !c.members.includes("v"),
    ),
  )
  assert.ok(
    communities.some(
      (c) => c.members.includes("v") && c.members.includes("m") && c.label === "Linear structure",
    ),
  )
  assert.ok(!communities.some((c) => c.members.includes("island")))
  assert.ok(communities.every((c) => c.coherence > 0 && c.coherence <= 1))
  const reordered = {
    ...model,
    concepts: [...model.concepts].reverse(),
    relations: [...model.relations].reverse(),
  }
  assert.deepEqual(deriveCommunities(reordered, "structural"), communities)
  const withoutEdges = { ...model, relations: [] }
  assert.deepEqual(deriveCommunities(withoutEdges, "structural"), [])
  const duplicatedEdges = {
    ...model,
    relations: [...model.relations, ...model.relations.map((r) => ({ ...r, id: `copy-${r.id}` }))],
  }
  assert.deepEqual(deriveCommunities(duplicatedEdges, "structural"), communities)
})

test("context changes preserve node identity and all position/velocity state before forces act", () => {
  const model = fixture(),
    field = createField(model, deriveContext(model, view()))
  field.settle()
  const references = [...field.nodes],
    before = field.snapshot()
  field.setContext(deriveContext(model, view("a", ["g"])))
  for (let i = 0; i < references.length; i++) {
    assert.equal(field.nodes[i], references[i])
    const old = before.nodes[i],
      next = field.nodes[i]
    assert.deepEqual(
      [next.x, next.y, next.z, next.vx, next.vy, next.vz, next.relevance],
      [old.x, old.y, old.z, old.vx, old.vy, old.vz, old.relevance],
    )
  }
  const actionBefore = { ...node(field, "a") },
    horizonBefore = { ...node(field, "r") }
  assert.equal(field.step(1 / 60), true)
  assert.ok(distance(actionBefore, node(field, "a")) > 0)
  assert.ok(distance(actionBefore, node(field, "a")) < 5, "first frame is bounded, not a teleport")
  assert.ok(node(field, "r").relevance > horizonBefore.relevance)
  assert.ok(node(field, "r").relevance < node(field, "r").targetRelevance)
  field.settle()
  assert.ok(xy(node(field, "a")) < 1)
  assert.ok(xy(node(field, "g")) < 400, "previous focus remains nearby")
  assert.ok(xy(node(field, "r")) < 460, "new neighbor emerges from the horizon")
  assert.ok(xy(node(field, "r")) < xy(horizonBefore) - 180)
  assert.ok(node(field, "r").z > horizonBefore.z + 100)
  const previousPosition = { ...node(field, "g") }
  field.setContext(deriveContext(model, view("r", ["g", "a"])))
  field.settle()
  assert.ok(xy(node(field, "r")) < 1)
  assert.ok(xy(node(field, "a")) < 400)
  assert.deepEqual(
    [node(field, "g").x, node(field, "g").y, node(field, "g").z],
    [previousPosition.x, previousPosition.y, previousPosition.z],
    "hidden horizon objects retain position instead of pushing readable neighbors",
  )
  assert.ok(node(field, "g").relevance < previousPosition.relevance)
  assert.ok(xy(node(field, "v")) < 460)
})

test("the field settles finitely and does not keep drifting or reawaken for unchanged label size", () => {
  const model = fixture(),
    context = deriveContext(model, view()),
    field = createField(model, context)
  const second = createField(model, context)
  field.settle()
  second.settle()
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(
    field.snapshot(),
    second.snapshot(),
    "same ontology and context produce deterministic motion",
  )
  const settled = field.snapshot()
  for (let i = 0; i < 120; i++) assert.equal(field.step(1 / 60), false)
  field.setRadius("g", node(field, "g").radius)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), settled)
  assert.ok(field.nodes.every((n) => n.vx === 0 && n.vy === 0 && n.vz === 0))
})

test("unfolded content changes exclusion forces continuously and leaves usable focus clearance", () => {
  const model = fixture(),
    field = createField(model, deriveContext(model, view()))
  field.settle()
  const before = field.snapshot()
  field.setRadius("g", 240)
  for (let i = 0; i < field.nodes.length; i++)
    assert.deepEqual([field.nodes[i].x, field.nodes[i].y], [before.nodes[i].x, before.nodes[i].y])
  field.settle()
  const focus = node(field, "g")
  assert.ok(
    field.nodes
      .filter((n) => n.id !== "g")
      .every((n) => distance(n, focus) >= focus.radius + n.radius + 20),
  )
  assert.ok(
    distance(node(field, "a"), focus) >
      distance(before.nodes.find((n) => n.id === "a")!, before.nodes.find((n) => n.id === "g")!),
  )
  assert.deepEqual(
    [node(field, "island").x, node(field, "island").y],
    [
      before.nodes.find((n) => n.id === "island")!.x,
      before.nodes.find((n) => n.id === "island")!.y,
    ],
    "unrelated remote objects do not move to make local reading clearance",
  )
})

test("dragging one concept gently influences its neighbors and preserves the released position", () => {
  const model = fixture(),
    field = createField(model, deriveContext(model, view("a")))
  field.settle()
  const oldNeighbor = { ...node(field, "h") }
  field.drag("g", oldNeighbor.x + 30, oldNeighbor.y + 30)
  for (let i = 0; i < 30; i++) field.step(1 / 60)
  assert.equal(node(field, "g").x, oldNeighbor.x + 30)
  assert.equal(node(field, "g").y, oldNeighbor.y + 30)
  assert.ok(distance(node(field, "h"), oldNeighbor) > 10)
  field.release("g")
  for (let i = 0; i < 42; i++) field.step(1 / 60)
  assert.equal(field.step(1 / 60), false)
  assert.deepEqual(
    [node(field, "g").x, node(field, "g").y],
    [oldNeighbor.x + 30, oldNeighbor.y + 30],
  )
  assert.ok(distance(node(field, "h"), oldNeighbor) <= 20)
})

test("snapshots restore an in-flight trajectory exactly and validate all nodes before mutation", () => {
  const model = fixture(),
    context = deriveContext(model, view()),
    field = createField(model, context)
  for (let i = 0; i < 12; i++) field.step(1 / 60)
  const snapshot = field.snapshot(),
    fresh = createField(model, context)
  fresh.restore(snapshot)
  assert.deepEqual(fresh.snapshot(), snapshot)
  for (let i = 0; i < 30; i++) {
    field.step(1 / 60)
    fresh.step(1 / 60)
  }
  assert.deepEqual(fresh.snapshot(), field.snapshot())
  snapshot.nodes[0].x = 99999
  assert.notEqual(node(fresh, "g").x, 99999)
  const before = fresh.snapshot(),
    invalid: FieldSnapshot = structuredClone(before)
  invalid.nodes[0].x = 10
  invalid.nodes[invalid.nodes.length - 1].x = NaN
  assert.throws(() => fresh.restore(invalid), /Invalid field snapshot node/)
  assert.deepEqual(fresh.snapshot(), before)
  assert.throws(() => fresh.restore({ ...before, focus: "a" }), /matching context/)
})

test("restoring a cooled field preserves rest and reject incomplete contexts without mutation", () => {
  const model = fixture(),
    context = deriveContext(model, view()),
    field = createField(model, context)
  field.settle()
  const before = field.snapshot(),
    second = createField(model, context)
  second.restore(before)
  assert.equal(second.step(1 / 60), false)
  assert.deepEqual(second.snapshot(), before)
  assert.throws(
    () => field.setContext({ ...context, nodes: context.nodes.slice(1) }),
    /retain every concept/,
  )
  assert.throws(() => field.setContext({ ...context, focus: "unknown" }), /Unknown field focus/)
  assert.deepEqual(field.snapshot(), before)
})

test("time steps remain finite and a stalled browser frame cannot teleport the field", () => {
  const model = fixture(),
    context = deriveContext(model, view()),
    fine = createField(model, context),
    coarse = createField(model, context)
  for (let i = 0; i < 120; i++) fine.step(1 / 120)
  for (let i = 0; i < 30; i++) coarse.step(1 / 30)
  for (let i = 0; i < fine.nodes.length; i++)
    assert.ok(distance(fine.nodes[i], coarse.nodes[i]) < 0.01)
  const settled = coarse.snapshot()
  assert.equal(coarse.step(NaN), false)
  assert.deepEqual(coarse.snapshot(), settled)
  coarse.setContext(deriveContext(model, view("a", ["g"])))
  const before = coarse.snapshot()
  assert.equal(coarse.step(NaN), true)
  assert.deepEqual(coarse.snapshot(), before)
  coarse.step(120)
  assert.ok(coarse.nodes.every((n, i) => distance(n, before.nodes[i]) <= 156))
  assert.ok(
    coarse.nodes.every((n) =>
      [n.x, n.y, n.z, n.vx, n.vy, n.vz, n.relevance].every(Number.isFinite),
    ),
  )
})

test("duality and contradiction remain informative adjacency rather than automatic repulsion", () => {
  const model = fixture()
  const relation = { ...model.relations[0], type: "contradiction" as const }
  assert.ok(relationAffinity(relation, "structural") > 0)
  const dual = { ...relation, type: "duality" as const }
  assert.ok(relationAffinity(dual, "linear") >= relationAffinity(dual, "structural"))
  model.concepts = model.concepts.slice(0, 2)
  model.relations = [relation]
  const linked = createField(model, deriveContext(model, view()))
  linked.settle()
  const unlinkedModel = { ...model, relations: [] }
  const unlinked = createField(unlinkedModel, deriveContext(unlinkedModel, view()))
  unlinked.settle()
  assert.ok(xy(node(linked, "a")) < xy(node(unlinked, "a")) - 200)
})

test("typed relationships alter angular organization even when relevance targets stay identical", () => {
  const model = fixture()
  model.concepts = model.concepts.slice(0, 3)
  model.relations = model.relations.filter((r) => r.source === "g")
  const context = deriveContext(model, view())
  const base = createField(model, context)
  const connectedModel = structuredClone(model)
  connectedModel.relations.push({
    ...model.relations[0],
    id: "a-h",
    source: "a",
    target: "h",
    type: "equivalence",
    strength: 1,
  })
  const connected = createField(connectedModel, context)
  for (const field of [base, connected]) {
    // Seed a test layout before its initial solve. Real user drags are now
    // durable anchors and intentionally take priority over semantic springs.
    Object.assign(node(field, "a"), { x: -240, y: -140 })
    Object.assign(node(field, "h"), { x: 150, y: -220 })
  }
  base.settle()
  connected.settle()
  assert.ok(
    distance(node(connected, "a"), node(connected, "h")) <
      distance(node(base, "a"), node(base, "h")) - 30,
  )
  const angle = (f: typeof base, id: string) => Math.atan2(node(f, id).y, node(f, id).x)
  assert.ok(
    Math.abs(angle(connected, "a") - angle(base, "a")) > 0.1,
    "semantic springs reorganize positions beyond an ID-seeded ring",
  )
})

test("the actual prototype exhibits emergence and recession along its approved three-focus path", () => {
  const model = JSON.parse(
    readFileSync(new URL("../../../knowledge/topos/prototype.json", import.meta.url), "utf8"),
  ) as KnowledgeModel
  const initial = deriveContext(model, view("group"))
  const action = deriveContext(model, view("action", ["group"]))
  const representation = deriveContext(model, view("representation", ["group", "action"]))
  for (const id of ["orbit", "stabilizer"]) {
    assert.equal(initial.nodes.find((n) => n.id === id)?.role, "horizon")
    assert.equal(action.nodes.find((n) => n.id === id)?.role, "neighbor")
    assert.equal(representation.nodes.find((n) => n.id === id)?.role, "horizon")
  }
  for (const id of ["module", "character", "irreducible-representation"]) {
    assert.equal(initial.nodes.find((n) => n.id === id)?.role, "horizon")
    assert.equal(representation.nodes.find((n) => n.id === id)?.role, "neighbor")
  }
  const field = createField(model, initial),
    refs = [...field.nodes]
  const records: FieldSnapshot[] = []
  for (const context of [initial, action, representation]) {
    const before = field.snapshot()
    field.setContext(context)
    assert.deepEqual(
      field.nodes.map((n) => [n.x, n.y, n.z]),
      before.nodes.map((n) => [n.x, n.y, n.z]),
    )
    let frames = 0
    while (field.step(1 / 60) && frames < 120) frames++
    assert.ok(frames < 120, `${context.focus}: positions stop within two simulated seconds`)
    assert.ok(xy(node(field, context.focus)) < 1)
    assert.equal(field.nodes.length, refs.length)
    assert.ok(field.nodes.every((n, i) => n === refs[i]))
    if (context.previous) assert.ok(xy(node(field, context.previous)) < 410)
    records.push(field.snapshot())
  }
  const read = (stage: number, id: string) => records[stage].nodes.find((n) => n.id === id)!
  assert.ok(xy(read(0, "orbit")) - xy(read(1, "orbit")) > 300)
  assert.deepEqual(
    [read(2, "orbit").x, read(2, "orbit").y, read(2, "orbit").z],
    [read(1, "orbit").x, read(1, "orbit").y, read(1, "orbit").z],
  )
  assert.ok(read(2, "orbit").relevance < read(1, "orbit").relevance - 0.3)
  assert.ok(xy(read(0, "character")) - xy(read(2, "character")) > 300)
  assert.ok(read(2, "character").relevance > read(0, "character").relevance + 0.3)
  assert.ok(read(2, "character").z > read(0, "character").z + 180)
  const final = field.snapshot()
  for (let i = 0; i < 120; i++) assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), final)
})

function actualPrototype(): KnowledgeModel {
  return JSON.parse(
    readFileSync(new URL("../../../knowledge/topos/prototype.json", import.meta.url), "utf8"),
  ) as KnowledgeModel
}

test("actual semantic zoom changes the information hierarchy while keeping every concept", () => {
  const model = actualPrototype(),
    context = deriveContext(model, view(model.initial))
  const field = createField(model, context),
    appearance = createAppearanceModel(model)
  field.settle()
  const before = structuredClone(field.nodes)
  const far = { ...context, scale: 0 },
    middle = { ...context, scale: 1.2 }
  let majorCount = 0,
    minorCount = 0
  for (const n of field.nodes) {
    const distant = appearance(n, far),
      nearby = appearance(n, middle)
    assert.equal(distant.major, nearby.major)
    assert.ok(
      [distant.opacity, distant.radius, nearby.opacity, nearby.radius].every(Number.isFinite),
    )
    assert.ok(
      distant.opacity > 0 && distant.opacity <= 1,
      "far members recede without losing identity",
    )
    if (distant.major) majorCount++
    else {
      minorCount++
      assert.ok(distant.opacity < nearby.opacity * 0.4)
      assert.ok(distant.radius < nearby.radius * 0.7)
    }
  }
  assert.ok(majorCount > 1 && majorCount < model.concepts.length / 2)
  assert.ok(minorCount > model.concepts.length / 2)
  const focus = node(field, context.focus)
  assert.equal(appearance(focus, far).major, true)
  assert.ok(appearance(focus, far).radius >= appearance(focus, middle).radius)
  assert.deepEqual(
    field.nodes,
    before,
    "visual level of detail never moves, filters or recreates the field",
  )
})

test("major concepts follow the graph after opaque identity and title changes", () => {
  const model = actualPrototype(),
    context = deriveContext(model, view(model.initial))
  const field = createField(model, context),
    original = createAppearanceModel(model)
  const ids = new Map(
    model.concepts.map((c, i) => [
      c.id,
      `opaque-${String(model.concepts.length - i).padStart(3, "0")}`,
    ]),
  )
  const id = (value: string) => ids.get(value)!
  const renamed: KnowledgeModel = {
    ...model,
    initial: id(model.initial),
    concepts: model.concepts.map((c) => ({
      ...c,
      id: id(c.id),
      title: `Anonymous ${id(c.id)}`,
      zh: "匿名概念",
    })),
    relations: model.relations.map((r) => ({ ...r, source: id(r.source), target: id(r.target) })),
  }
  const renamedContext = {
    ...context,
    focus: id(context.focus),
    previous: context.previous ? id(context.previous) : undefined,
    nodes: context.nodes.map((n) => ({ ...n, id: id(n.id) })),
    relations: renamed.relations,
    communities: context.communities.map((c) => ({ ...c, members: c.members.map(id) })),
  }
  const renamedAppearance = createAppearanceModel(renamed)
  for (const n of field.nodes) {
    assert.deepEqual(
      renamedAppearance({ ...n, id: id(n.id) }, renamedContext),
      original(n, context),
    )
  }
})

test("community membership and visible footprints respond to rewritten relations, not topic metadata", () => {
  const model = fixture(),
    originalContext = deriveContext(model, view())
  const field = createField(model, originalContext)
  field.settle()
  const fullyConnected: KnowledgeModel = { ...model, relations: [] }
  for (let a = 0; a < model.concepts.length; a++)
    for (let b = a + 1; b < model.concepts.length; b++) {
      fullyConnected.relations.push({
        ...model.relations[0],
        id: `synthetic-${a}-${b}`,
        source: model.concepts[a].id,
        target: model.concepts[b].id,
        explanation: "Synthetic test-only connection",
        evidence: "fixture",
        type: "equivalence",
        strength: 1,
      })
    }
  const connectedContext = deriveContext(fullyConnected, view())
  assert.ok(originalContext.communities.length >= 2)
  assert.equal(connectedContext.communities.length, 1)
  assert.equal(connectedContext.communities[0].members.length, model.concepts.length)
  assert.equal(
    fullyConnected.concepts,
    model.concepts,
    "names, terms and source sections stayed identical",
  )
  const before = originalContext.communities.map((c) =>
    communityFootprint(c, field.nodes, (n) => n, 0),
  )
  const after = connectedContext.communities.map((c) =>
    communityFootprint(c, field.nodes, (n) => n, 0),
  )
  assert.notDeepEqual(after, before)
  assert.ok(
    after.every(
      (footprint) => footprint && footprint.points.length === 64 && footprint.opacity > 0,
    ),
  )
})

test("actual community footprints are bounded, convex and continuous while leaving node positions intact", () => {
  const model = actualPrototype(),
    context = deriveContext(model, view(model.initial)),
    field = createField(model, context)
  field.settle()
  const before = structuredClone(field.nodes)
  for (const community of context.communities) {
    const far = communityFootprint(community, field.nodes, (n) => n, 0)!
    const middle = communityFootprint(community, field.nodes, (n) => n, 1.2)!
    assert.equal(far.points.length, 64)
    assert.ok(far.opacity > middle.opacity * 3, "communities become the far-scale visual subject")
    assert.ok(far.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
    for (let i = 0; i < far.points.length; i++) {
      const p = far.points[i],
        q = far.points[(i + 1) % 64],
        r = far.points[(i + 2) % 64]
      const cross = (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x)
      assert.ok(cross >= -1e-6, "receding interior members cannot create inward spikes")
    }
    const members = field.nodes.filter((n) => community.members.includes(n.id))
    const fullWidth = Math.max(...members.map((n) => n.x)) - Math.min(...members.map((n) => n.x))
    const localWidth =
      Math.max(...far.points.map((p) => p.x)) - Math.min(...far.points.map((p) => p.x))
    assert.ok(
      localWidth < fullWidth * 0.6,
      "horizon members no longer stretch the outline across the whole field",
    )
    const changed = field.nodes.map((n) => ({ ...n, relevance: Math.min(1, n.relevance + 0.0001) }))
    const adjacentFrame = communityFootprint(community, changed, (n) => n, 0)!
    assert.ok(adjacentFrame.points.every((p, i) => distance(p, far.points[i]) < 2))
  }
  assert.deepEqual(field.nodes, before)
})
