import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  globalMapScene,
  globalMapSignature,
  mapCurve,
  mapFit,
  mapTitleLines,
  mapZoom,
  readGlobalMapCache,
  placeMapLabels,
} from "./globalMap"
import { createGlobalMapField } from "./globalMapField"
import { topicIDs } from "./topics"
import type { KnowledgeModel, Relation } from "./types"
import prepared from "../../../knowledge/index.json"
import mapping from "../../../knowledge/topos/note-topics.json"
import type { KnowledgeIndex } from "../knowledge"
import { createPublishedModel } from "./published"
import { attachNoteTopics, createAtlas, type AtlasRegistry } from "./atlas"
import atlasRegistry from "../../../ontology/math_registry.json"
import atlasSources from "../../../ontology/sources.json"

function fixture(): KnowledgeModel {
  const model = JSON.parse(readFileSync("knowledge/topos/prototype.json", "utf8")) as KnowledgeModel
  model.topics = [
    { id: "first", title: "第一主题", color: "#345678", description: "测试分类" },
    { id: "second", title: "第二主题", color: "#567834", description: "测试分类" },
  ]
  model.concepts.forEach((concept, i) => {
    concept.topicIDs = i % 3 ? [i % 2 ? "first" : "second"] : ["first", "second"]
  })
  return model
}

test("the entire selected union is drawn once, not bounded by an overview page", () => {
  const model = fixture()
  const original = structuredClone(model)
  const scene = globalMapScene(model, ["first", "second"])
  assert.equal(scene.nodes.length, model.concepts.length)
  assert.equal(new Set(scene.nodes.map((node) => node.id)).size, model.concepts.length)
  assert.deepEqual(scene.relations, model.relations)
  assert.deepEqual(model, original)
  for (const theme of model.topics!) {
    const actual = scene.groups.find((group) => group.id === theme.id)!
    const expected = model.concepts.filter((node) => node.topicIDs?.includes(theme.id))
    assert.deepEqual(new Set(actual.ids), new Set(expected.map((node) => node.id)))
  }
  const one = globalMapScene(model, ["first"])
  const expected = topicIDs(model, ["first"])
  assert.deepEqual(new Set(one.nodes.map((node) => node.id)), expected)
  assert.deepEqual(
    one.relations.map((edge) => edge.id),
    model.relations
      .filter((edge) => expected.has(edge.source) && expected.has(edge.target))
      .map((edge) => edge.id),
  )
  assert.deepEqual(globalMapScene(model, []), { nodes: [], groups: [], relations: [] })
})

test("a theme containing only shared objects remains a real landmark without duplicating nodes", () => {
  const model = fixture()
  for (const node of model.concepts) node.topicIDs = ["first", "second"]
  const scene = globalMapScene(model, undefined)
  assert.equal(scene.nodes.length, model.concepts.length)
  assert.equal(scene.groups.length, 2)
  for (const group of scene.groups)
    assert.deepEqual(new Set(group.ids), new Set(model.concepts.map((node) => node.id)))
})

test("layout stays deterministic under model/selection order and preserves manual positions without mutating content", () => {
  const model = fixture()
  const first = globalMapScene(model, ["first", "second"])
  const reordered = globalMapScene({ ...model, concepts: [...model.concepts].reverse() }, [
    "second",
    "first",
  ])
  assert.deepEqual(
    first.nodes.map(({ id, x, y }) => ({ id, x, y })),
    reordered.nodes.map(({ id, x, y }) => ({ id, x, y })),
  )
  const id = first.nodes[0].id
  const retained = new Map([[id, { x: -700, y: 333 }]])
  const moved = globalMapScene(model, undefined, retained).nodes.find((node) => node.id === id)!
  assert.deepEqual({ x: moved.x, y: moved.y }, retained.get(id))
  assert.equal(new Set(first.nodes.map(({ x, y }) => `${x}/${y}`)).size, first.nodes.length)
})

test("theme toggles preserve every shared world position, including multi-theme identities", () => {
  const model = fixture()
  const only = globalMapScene(model, ["second"])
  const both = globalMapScene(model, ["first", "second"])
  for (const node of only.nodes) {
    const expanded = both.nodes.find((other) => other.id === node.id)!
    assert.deepEqual({ x: expanded.x, y: expanded.y }, { x: node.x, y: node.y })
  }
})

test("continuous neighborhoods overlap without topic slots, and title changes never re-seed identities", () => {
  const model = fixture()
  const scene = globalMapScene(model, undefined)
  const [a, b] = scene.groups
  assert.ok(a.x < b.x + b.width && b.x < a.x + a.width)
  assert.ok(a.y < b.y + b.height && b.y < a.y + a.height)
  const common = model.concepts.filter((node) => node.topicIDs?.length === 2)
  assert.ok(common.length > 1)
  for (const node of common) {
    const first = globalMapScene(model, ["first"]).nodes.find((item) => item.id === node.id)!
    const second = globalMapScene(model, ["second"]).nodes.find((item) => item.id === node.id)!
    assert.deepEqual({ x: first.x, y: first.y }, { x: second.x, y: second.y })
  }
  const positions = scene.nodes.map(({ id, x, y }) => ({ id, x, y }))
  for (const node of model.concepts) node.title = `Renamed ${node.id}`
  model.topics!.reverse()
  model.relations.reverse()
  assert.deepEqual(
    globalMapScene(model, undefined).nodes.map(({ id, x, y }) => ({ id, x, y })),
    positions,
  )
  // Physical occupancy is independent from labels and group extents.
  for (let i = 0; i < scene.nodes.length; i++)
    for (let j = i + 1; j < scene.nodes.length; j++) {
      const a = scene.nodes[i],
        b = scene.nodes[j]
      assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= 109.999)
    }
})

test("real graph changes bend the initial neighborhood without inventing or rewriting relations", () => {
  const model = fixture()
  const unlinked: KnowledgeModel = { ...model, relations: [] }
  const before = globalMapScene(unlinked, undefined)
  const linked = globalMapScene(model, undefined)
  const length = (nodes: typeof linked.nodes) => {
    const byID = new Map(nodes.map((node) => [node.id, node]))
    return model.relations.reduce((sum, edge) => {
      const a = byID.get(edge.source)!,
        b = byID.get(edge.target)!
      return sum + Math.hypot(a.x - b.x, a.y - b.y)
    }, 0)
  }
  assert.ok(
    length(linked.nodes) < length(before.nodes),
    "existing links should draw their neighborhoods together",
  )
  assert.deepEqual(linked.relations, model.relations)
  const modified = structuredClone(unlinked)
  globalMapScene(modified, undefined)
  modified.relations = model.relations
  assert.deepEqual(
    globalMapScene(modified, undefined),
    linked,
    "cached geometry must respect actual graph edits",
  )
})

test("the actual 86-to-159 public expansion preserves old anchors and gives incoming nodes free territory", () => {
  const model = createPublishedModel(prepared as KnowledgeIndex)
  attachNoteTopics(model, mapping)
  const focus = model.concepts.find((node) => node.title === "度量拓扑与连续性的三种刻画")!
  const theme = focus.topicIDs![0]
  for (const legacyOrigin of [false, true]) {
    const initial = globalMapScene(model, [theme])
    assert.equal(initial.nodes.length, 86)
    // Existing sessions can retain coordinates from the old single-topic origin.
    if (legacyOrigin) {
      const { x, y } = initial.groups[0]
      for (const node of initial.nodes) {
        node.x -= x
        node.y -= y
      }
    }
    const oldField = createGlobalMapField(initial.nodes, initial.relations)
    stop(oldField)
    const old = oldField.snapshot()
    const known = new Map(old.nodes.map((node) => [node.id, node]))
    const outsideEdge = model.relations.find(
      (edge) => known.has(edge.source) !== known.has(edge.target),
    )!
    const outside = model.concepts.find(
      (node) =>
        node.id === (known.has(outsideEdge.source) ? outsideEdge.target : outsideEdge.source),
    )!
    const expanded = globalMapScene(
      model,
      [...new Set([theme, ...outside.topicIDs!])],
      new Map(old.nodes.map((node) => [node.id, { x: node.x, y: node.y }])),
    )
    assert.equal(expanded.nodes.length, 159)
    assert.equal(new Set(expanded.nodes.map((node) => node.id)).size, 159)
    for (const node of expanded.nodes) {
      const previous = known.get(node.id)
      if (previous) {
        assert.deepEqual({ x: node.x, y: node.y }, { x: previous.x, y: previous.y })
      } else {
        for (const other of expanded.nodes) {
          if (node.id === other.id) continue
          assert.ok(Math.hypot(node.x - other.x, node.y - other.y) >= 109.999)
        }
      }
    }
    const field = createGlobalMapField(expanded.nodes, expanded.relations)
    const fresh = field.snapshot()
    assert.equal(
      field.restore({
        ...fresh,
        nodes: fresh.nodes.map((node) => known.get(node.id) ?? node),
        restLengths: Object.fromEntries(
          Object.entries(fresh.restLengths ?? {}).map(([id, value]) => [
            id,
            old.restLengths?.[id] ?? value,
          ]),
        ),
        settled: false,
      }),
      true,
    )
    for (const node of field.nodes) {
      const previous = known.get(node.id)
      if (previous) {
        assert.equal(node.anchorX, previous.anchorX)
        assert.equal(node.anchorY, previous.anchorY)
      }
    }
    assert.ok(stop(field) <= 120, "genuine settling should finish within two simulated seconds")
    separated(field)
    const resting = field.snapshot()
    for (let frame = 0; frame < 60; frame++) assert.equal(field.step(1 / 60), false)
    assert.deepEqual(field.snapshot(), resting)
  }
})

test("the complete published notes and Atlas settle in the open field after real neighbor contact", () => {
  const notes = createPublishedModel(prepared as KnowledgeIndex)
  attachNoteTopics(notes, mapping)
  const atlas = createAtlas(atlasRegistry as AtlasRegistry, atlasSources.sources).model
  for (const model of [notes, atlas]) {
    const source = structuredClone(model)
    for (const layout of [{}, { columns: 2, headingSpace: 240 }]) {
      const scene = globalMapScene(model, undefined, new Map(), layout)
      assert.equal(scene.nodes.length, model.concepts.length)
      assert.deepEqual(scene.relations, model.relations)
      for (const hz of [30, 60, 120]) {
        const field = createGlobalMapField(scene.nodes, scene.relations)
        for (let i = 0; i < hz * 2 && !field.settled; i++) field.step(1 / hz)
        assert.ok(field.settled, `${model.mode} initial field did not settle at ${hz}Hz`)
        separated(field)
        const held = field.nodes.find((node) => node.id === model.initial) ?? field.nodes[0]
        const neighbor = field.nodes
          .filter((node) => node !== held)
          .sort(
            (a, b) =>
              Math.hypot(a.x - held.x, a.y - held.y) - Math.hypot(b.x - held.x, b.y - held.y),
          )[0]
        const target = { x: neighbor.x + 8, y: neighbor.y + 7 }
        field.drag(held.id, target.x, target.y)
        for (let i = 0; i < 8; i++) field.step(1 / hz)
        assert.equal(held.x, target.x)
        assert.equal(held.y, target.y)
        separated(field)
        field.release(held.id)
        for (let i = 0; i < hz * 2 && !field.settled; i++) field.step(1 / hz)
        assert.ok(field.settled, `${model.mode} release did not settle at ${hz}Hz`)
        separated(field)
        assert.equal(held.anchorX, target.x)
        assert.equal(held.anchorY, target.y)
        const resting = field.snapshot()
        for (let i = 0; i < hz; i++) assert.equal(field.step(1 / hz), false)
        assert.deepEqual(field.snapshot(), resting)
      }
    }
    assert.deepEqual(model, source)
  }
})

test("fit puts every object inside desktop and narrow mobile viewports, including dragged outliers", () => {
  const scene = globalMapScene(fixture(), undefined)
  const points = [...scene.nodes, { x: -6000, y: 8000 }]
  for (const [width, height] of [
    [1120, 710],
    [700, 600],
    [390, 400],
  ]) {
    const camera = mapFit(points, width, height)
    for (const point of points) {
      const x = point.x * camera.k + camera.x,
        y = point.y * camera.k + camera.y
      assert.ok(
        x >= 0 && x <= width && y >= 0 && y <= height,
        `${x},${y} outside ${width}×${height}`,
      )
    }
  }
})

test("pointer anchored zoom keeps the same world point and bounds scale", () => {
  const camera = { x: -500, y: 300, k: 0.35 },
    anchor = { x: 192, y: 238 }
  const next = mapZoom(camera, 1.6, anchor)
  assert.ok(Math.abs((anchor.x - camera.x) / camera.k - (anchor.x - next.x) / next.k) < 1e-9)
  assert.ok(Math.abs((anchor.y - camera.y) / camera.k - (anchor.y - next.y) / next.k) < 1e-9)
  assert.equal(mapZoom(camera, 1e6, anchor).k, 4)
  assert.equal(mapZoom(camera, 1e-6, anchor).k, 0.005)
})

test("directed curves terminate near their real targets and long bilingual names lose no text", () => {
  const forward = mapCurve({ x: 20, y: 50 }, { x: 120, y: 50 })
  const backward = mapCurve({ x: 120, y: 50 }, { x: 20, y: 50 })
  assert.match(forward, /^M 20 50 Q .+ 107 50$/)
  assert.match(backward, /^M 120 50 Q .+ 33 50$/)
  assert.notEqual(forward, backward)
  const title = "Definition group: 度量空间、拓扑空间与第一可数性的完整长标题𝔛"
  const lines = mapTitleLines(title, 12)
  assert.ok(lines.length > 2)
  assert.equal(lines.join(""), title)
})

test("English map titles wrap at word boundaries while CJK and oversized words remain lossless", () => {
  const title = "Separation and Continuous Extension — Definitions 度量空间"
  const lines = mapTitleLines(title, 12)
  assert.equal(lines.join(""), title)
  for (const word of ["Separation", "Continuous", "Extension", "Definitions"])
    assert.ok(
      lines.some((line) => line.includes(word)),
      `${word} was broken across lines`,
    )
  const long = "Supercalifragilisticexpialidocious 拓扑空间𝔛"
  const wrapped = mapTitleLines(long, 8)
  assert.equal(wrapped.join(""), long)
  assert.ok(wrapped.length > 3, "an oversized word still needs bounded lines")
})

test("session restoration rejects obsolete identities, nonfinite coordinates and invalid cameras", () => {
  const model = fixture(),
    signature = globalMapSignature(model)
  const ids = new Set(model.concepts.map((node) => node.id)),
    id = model.concepts[0].id
  const input = {
    version: 1,
    signature,
    points: [
      { id, x: 20, y: -80 },
      { id: "private-unknown", x: 0, y: 0 },
      { id: model.concepts[1].id, x: Infinity, y: 0 },
      { id, x: 900, y: 900 },
    ],
    views: [
      { key: "all", camera: { x: -100, y: 220, k: 0.4 }, width: 900, height: 700, selected: id },
      { key: "bad", camera: { x: 0, y: 0, k: -5 }, width: 300, height: 400 },
    ],
  }
  const restored = readGlobalMapCache(input, signature, ids)
  assert.deepEqual(restored.points, [{ id, x: 20, y: -80 }])
  assert.equal(restored.views.length, 1)
  assert.equal(restored.views[0].selected, id)
  assert.deepEqual(
    readGlobalMapCache({ ...input, signature: "obsolete" }, signature, ids).points,
    [],
  )
  const changed = structuredClone(model)
  changed.relations[0].target = model.concepts.at(-1)!.id
  assert.notEqual(globalMapSignature(changed), signature)
})

test("a narrow-screen field uses a continuous tall aspect while keeping all identities and retained drops", () => {
  const model = fixture()
  model.topics = Array.from({ length: 12 }, (_, i) => ({
    id: `topic-${i}`,
    title: `知识领域 ${i + 1}`,
    color: "#456789",
    description: "测试分类",
  }))
  model.concepts.forEach((node, i) => {
    node.topicIDs = [`topic-${i % 12}`]
  })
  const layout = { columns: 2, headingSpace: 240 }
  const scene = globalMapScene(model, undefined, new Map(), layout)
  assert.equal(scene.nodes.length, model.concepts.length)
  assert.deepEqual(scene.relations, model.relations)
  assert.ok(
    new Set(scene.groups.map((group) => group.x)).size > 2,
    "themes must not fall into two reserved columns",
  )
  const camera = mapFit(scene.nodes, 390, 505)
  const span =
    (Math.max(...scene.nodes.map((node) => node.y)) -
      Math.min(...scene.nodes.map((node) => node.y))) *
    camera.k
  assert.ok(span > 300, `mobile scene should use vertical space, got ${span}px`)
  const id = model.concepts[0].id,
    retained = new Map([[id, { x: -500, y: 840 }]])
  const moved = globalMapScene(model, undefined, retained, layout).nodes.find(
    (node) => node.id === id,
  )!
  assert.deepEqual({ x: moved.x, y: moved.y }, retained.get(id))
  const signature = globalMapSignature(model)
  const cache = readGlobalMapCache(
    {
      version: 1,
      signature,
      points: [],
      views: [{ key: "all", camera, width: 390, height: 505, layout }],
    },
    signature,
    new Set(scene.nodes.map((node) => node.id)),
  )
  assert.deepEqual(cache.views[0].layout, layout)
})

function mechanicalEdge(source: string, target: string): Relation {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: "references",
    strength: 0.8,
    label: "测试引用",
    explanation: "仅用于力学测试的已声明边",
    evidence: "fixture",
    provenance: "reference",
    lenses: {},
  }
}
function stop(field: ReturnType<typeof createGlobalMapField>) {
  let ticks = 0
  while (!field.settled && ticks++ < 720) field.step(1 / 60)
  assert.ok(field.settled, `mechanical scene did not settle in ${ticks} steps`)
  return ticks
}
function separated(field: ReturnType<typeof createGlobalMapField>) {
  for (let i = 0; i < field.nodes.length; i++)
    for (let j = i + 1; j < field.nodes.length; j++) {
      const a = field.nodes[i],
        b = field.nodes[j]
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) >= a.radius + b.radius + 7.8,
        `${a.id}/${b.id} physically overlap`,
      )
    }
}

test("a real declared edge attracts its endpoints more than an unrelated control without center collapse", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 240, y: 0 },
  ]
  const linked = createGlobalMapField(points, [mechanicalEdge("a", "b")]),
    control = createGlobalMapField(points, [])
  stop(linked)
  stop(control)
  assert.ok(linked.nodes[1].x - linked.nodes[0].x < control.nodes[1].x - control.nodes[0].x - 10)
  separated(linked)
  assert.ok(linked.nodes.every((node) => Math.abs(node.x - node.anchorX) < 40))
  assert.deepEqual(points, [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 240, y: 0 },
  ])
})

test("the held body follows its pointer, neighbors respond, and releasing keeps the intended anchor with finite cooling", () => {
  const field = createGlobalMapField(
    [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 180, y: 0 },
      { id: "far", x: 1700, y: 800 },
    ],
    [mechanicalEdge("a", "b")],
  )
  stop(field)
  const before = field.nodes.map((node) => ({ ...node }))
  assert.notEqual(before[0].mass, before[2].mass)
  assert.notEqual(before[0].attraction, before[2].attraction)
  assert.notEqual(before[0].charge, before[2].charge)
  field.drag("a", 165, 15)
  assert.equal(field.nodes[0].x, 165)
  assert.equal(field.nodes[0].y, 15)
  separated(field)
  for (let i = 0; i < 40; i++) field.step(1 / 60)
  assert.equal(field.nodes[0].x, 165)
  assert.equal(field.heldID, "a")
  assert.ok(Math.hypot(field.nodes[1].x - before[1].x, field.nodes[1].y - before[1].y) > 8)
  assert.ok(Math.hypot(field.nodes[2].x - before[2].x, field.nodes[2].y - before[2].y) < 0.1)
  field.release("a")
  stop(field)
  separated(field)
  assert.equal(field.nodes[0].anchorX, 165)
  assert.equal(field.nodes[0].anchorY, 15)
  assert.ok(Math.hypot(field.nodes[0].x - 165, field.nodes[0].y - 15) < 65)
  const settled = field.snapshot()
  for (let i = 0; i < 30; i++) assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), settled)
})

test("coincident bodies separate deterministically; empty and filtered scenes never gain identities", () => {
  const points = Array.from({ length: 5 }, (_, i) => ({ id: `same-${i}`, x: 0, y: 0 }))
  const a = createGlobalMapField(points, []),
    b = createGlobalMapField(points, [])
  stop(a)
  stop(b)
  separated(a)
  assert.deepEqual(a.snapshot(), b.snapshot())
  const empty = createGlobalMapField([], [mechanicalEdge("excluded", "other")])
  empty.drag("excluded", 20, 20)
  assert.deepEqual(empty.nodes, [])
  assert.equal(empty.step(1 / 60), false)
})

test("imperceptible residual motion cools promptly without truncating a visible collision response", () => {
  const field = createGlobalMapField(
    [
      { id: "moving", x: 0, y: 0 },
      { id: "neighbor", x: 180, y: 0 },
    ],
    [],
  )
  stop(field)
  field.drag("moving", 165, 15)
  separated(field)
  field.release("moving")
  const initial = field.snapshot()
  assert.equal(field.step(1 / 60), true, "visible collision response must remain active")
  assert.notDeepEqual(field.snapshot().nodes, initial.nodes)
  stop(field)
  separated(field)
  const resting = field.snapshot()
  // A low-amplitude residual comparable to the measured browser tail: at 4×
  // zoom this 0.05-world offset is just 0.2px, while identity and contact remain.
  resting.nodes[0].x += 0.05
  resting.nodes[0].vx = 0.4
  resting.settled = false
  assert.equal(field.restore(resting), true)
  const start = field.snapshot()
  let ticks = 0
  while (!field.settled && ticks++ < 12) field.step(1 / 60)
  assert.ok(field.settled, "subpixel residuals should not schedule a long animation tail")
  separated(field)
  for (const [i, node] of field.nodes.entries())
    assert.ok(Math.hypot(node.x - start.nodes[i].x, node.y - start.nodes[i].y) * 4 < 1)
  const finished = field.snapshot()
  for (let i = 0; i < 60; i++) assert.equal(field.step(1 / 60), false)
  assert.deepEqual(field.snapshot(), finished)
})

test("a 192-identity physical fixture settles without collisions and restores its camera-independent positions exactly", () => {
  const points = Array.from({ length: 192 }, (_, i) => ({
    id: `fixture-${i}`,
    x: (i % 16) * 160,
    y: Math.floor(i / 16) * 115,
  }))
  const edges = points.slice(1).map((node, i) => mechanicalEdge(points[i].id, node.id))
  const field = createGlobalMapField(points, edges)
  stop(field)
  separated(field)
  const snapshot = field.snapshot(),
    restored = createGlobalMapField(points, edges)
  assert.equal(restored.restore(snapshot), true)
  assert.deepEqual(restored.snapshot(), snapshot)
  assert.equal(restored.step(1 / 60), false)
  assert.equal(restored.restore({ ...snapshot, nodes: snapshot.nodes.slice(1) }), false)
  assert.equal(restored.nodes.length, 192)
})

test("rapid pointer sweeps preserve contacts and cool within two seconds across frame rates", () => {
  for (const hz of [30, 60, 120]) {
    const points = Array.from({ length: 12 }, (_, i) => ({
      id: `sweep-${i}`,
      x: (i % 4) * 100,
      y: Math.floor(i / 4) * 110,
    }))
    const field = createGlobalMapField(
      points,
      points.slice(1).map((node, i) => mechanicalEdge(points[i].id, node.id)),
    )
    stop(field)
    for (const target of [
      { x: 299, y: 111 },
      { x: 102, y: 219 },
      { x: 195, y: 6 },
      { x: 99, y: 108 },
    ]) {
      field.drag(points[0].id, target.x, target.y)
      field.step(1 / hz)
      assert.equal(field.nodes[0].x, target.x)
      assert.equal(field.nodes[0].y, target.y)
      separated(field)
      assert.ok(
        field.nodes.every((node) => [node.x, node.y, node.vx, node.vy].every(Number.isFinite)),
      )
    }
    field.release(points[0].id)
    for (let i = 0; i < hz * 2; i++) field.step(1 / hz)
    assert.equal(field.settled, true, `rapid drag still moving after two seconds at ${hz}Hz`)
    separated(field)
    const stopped = field.snapshot()
    for (let i = 0; i < hz; i++) assert.equal(field.step(1 / hz), false)
    assert.deepEqual(field.snapshot(), stopped)
  }
})

test("mathematical names cannot cover reserved theme text, including a previously occupied slot", () => {
  const theme = { id: "theme", x: 150, y: 80, width: 150, height: 40 }
  const item = { id: "note", x: 130, y: 100, width: 140, height: 36, priority: 100 }
  const prior = { id: "note", x: 155, y: 82, width: 140, height: 36 }
  const result = placeMapLabels([item], 500, 350, [], [prior], [theme])
  assert.equal(result.boxes.length, 1)
  assert.equal(result.boxes[0].id, "note")
  const box = result.boxes[0]
  assert.ok(
    box.x + box.width + 6 <= theme.x ||
      box.x >= theme.x + theme.width + 6 ||
      box.y + box.height + 6 <= theme.y ||
      box.y >= theme.y + theme.height + 6,
  )
  assert.deepEqual(theme, { id: "theme", x: 150, y: 80, width: 150, height: 40 })
})

test("label placement never covers physical circles or removes their identities, even when no label fits", () => {
  const circles = [
    { x: 100, y: 100, radius: 13 },
    { x: 130, y: 150, radius: 13 },
    { x: 220, y: 100, radius: 13 },
  ]
  const before = structuredClone(circles)
  const labels = [
    { id: "a", x: 100, y: 100, width: 125, height: 42, priority: 100 },
    { id: "b", x: 130, y: 150, width: 130, height: 60, priority: 1 },
  ]
  const result = placeMapLabels(labels, 390, 400, circles)
  assert.equal(result.boxes.length, 2)
  for (const box of result.boxes)
    for (const circle of circles) {
      const x = Math.max(box.x, Math.min(box.x + box.width, circle.x)),
        y = Math.max(box.y, Math.min(box.y + box.height, circle.y))
      assert.ok(Math.hypot(circle.x - x, circle.y - y) >= circle.radius + 5)
    }
  assert.deepEqual(placeMapLabels(labels, 390, 400, circles, result.boxes).boxes, result.boxes)
  const cramped = placeMapLabels([{ ...labels[0], width: 80, height: 80 }], 100, 100, [
    { x: 50, y: 50, radius: 40 },
  ])
  assert.deepEqual(cramped.omitted, ["a"])
  assert.equal(cramped.boxes.length, 0)
  assert.deepEqual(circles, before)
})
