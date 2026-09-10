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
} from "./globalMap"
import { topicIDs } from "./topics"
import type { KnowledgeModel } from "./types"

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

test("a new narrow-screen map uses two named region columns while keeping all identities and retained drops", () => {
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
  assert.equal(new Set(scene.groups.map((group) => group.x)).size, 2)
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
