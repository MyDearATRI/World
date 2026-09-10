import assert from "node:assert/strict"
import test from "node:test"
import { createGlobalMapField, type MapFieldNode } from "./globalMapField"
import type { Relation } from "./types"

const edge = (source: string, target: string, i: number): Relation => ({
  id: `edge-${i}`,
  source,
  target,
  type: "references",
  strength: 0.6,
  provenance: i % 2 ? "reference" : "structure",
  label: "Synthetic mechanical fixture",
  explanation: "A fixture link; not a mathematical implication.",
  evidence: "fixture",
  lenses: {},
})
const finish = (field: ReturnType<typeof createGlobalMapField>) => {
  let steps = 0
  while (!field.settled && steps++ < 720) field.step(1 / 60)
  assert.ok(field.settled, `field did not stop after ${steps} steps`)
  return steps
}
const separated = (nodes: MapFieldNode[]) => {
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      assert.ok(
        Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y) >=
          nodes[i].radius + nodes[j].radius + 7.8,
        `overlap: ${nodes[i].id}/${nodes[j].id}`,
      )
}

// Independent all-pairs reference for a zero-velocity contact projection.
// Deliberately has no grid, skin, candidate cache, or production helper calls.
function contactReference(nodes: MapFieldNode[], held: string) {
  for (let pass = 0; pass < 8; pass++) {
    let corrected = false
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j]
        const dx = b.x - a.x,
          dy = b.y - a.y
        const minimum = a.radius + b.radius + 8
        if (dx * dx + dy * dy >= minimum * minimum - 0.001) continue
        const distance = Math.hypot(dx, dy)
        assert.ok(distance > 0.0001, "fixture must avoid the separate coincident-point tie breaker")
        const wa = a.id === held ? 0 : 1 / a.mass,
          wb = b.id === held ? 0 : 1 / b.mass
        const penetration = minimum - distance
        a.x -= ((dx / distance) * penetration * wa) / (wa + wb)
        a.y -= ((dy / distance) * penetration * wa) / (wa + wb)
        b.x += ((dx / distance) * penetration * wb) / (wa + wb)
        b.y += ((dy / distance) * penetration * wb) / (wa + wb)
        corrected ||= penetration > 0.02
      }
    if (!corrected) break
  }
}

test("grid contact projection matches all-pairs order across cell crossings and contact chains", () => {
  const points = Array.from({ length: 64 }, (_, i) => ({
    id: `contact-${i}`,
    x: (i % 16) * 76 - 800,
    y: Math.floor(i / 16) * 77 - 300,
  }))
  for (const heldIndex of [0, 17, 63]) {
    for (const target of [
      { x: -699, y: -285 },
      { x: -36, y: -214 },
      { x: 318, y: -280 },
    ]) {
      const field = createGlobalMapField(points, [])
      const expected = structuredClone(field.nodes)
      expected[heldIndex].x = target.x
      expected[heldIndex].y = target.y
      contactReference(expected, points[heldIndex].id)
      field.drag(points[heldIndex].id, target.x, target.y)
      assert.deepEqual(field.nodes, expected)
      assert.equal(field.nodes[heldIndex].x, target.x)
      assert.equal(field.nodes[heldIndex].y, target.y)
    }
  }
})

test("radius changes, large pointer jumps and restored positions invalidate spatial candidates", () => {
  const points = [
    { id: "a", x: -1000, y: -200 },
    { id: "b", x: 1000, y: 200 },
  ]
  const field = createGlobalMapField(points, [])
  finish(field)
  field.drag("a", 990, 199)
  assert.equal(field.nodes[0].x, 990)
  separated(field.nodes)
  field.release("a")
  finish(field)
  field.setRadius("a", 450)
  separated(field.nodes)
  finish(field)
  const saved = field.snapshot()
  saved.nodes[0].x = -5000
  saved.nodes[0].y = -9000
  saved.nodes[1].x = -4999
  saved.nodes[1].y = -8998
  saved.settled = false
  assert.equal(field.restore(saved), true)
  field.drag("a", -5001, -9001)
  assert.equal(field.nodes[0].x, -5001)
  assert.equal(field.nodes[0].y, -9001)
  separated(field.nodes)
})

test("192 objects and 605 typed links retain identities, deterministic trajectories, anchors and idle stop", () => {
  const points = Array.from({ length: 192 }, (_, i) => ({
    id: `object-${i}`,
    x: (i % 16) * 152 - 1200,
    y: Math.floor(i / 16) * 115 - 600,
  }))
  const relations = Array.from({ length: 605 }, (_, i) =>
    edge(points[i % points.length].id, points[(i + 1 + Math.floor(i / 192)) % points.length].id, i),
  )
  const original = structuredClone({ points, relations })
  const a = createGlobalMapField(points, relations),
    b = createGlobalMapField(points, relations)
  const identities = [...a.nodes]
  assert.equal(finish(a), finish(b))
  assert.deepEqual(a.snapshot(), b.snapshot())
  for (const target of [
    { x: -892, y: -490 },
    { x: 860, y: 202 },
    { x: -1044, y: -375 },
  ]) {
    for (const field of [a, b]) {
      field.drag(points[0].id, target.x, target.y)
      field.step(1 / 60)
      assert.equal(field.nodes[0].x, target.x)
      assert.equal(field.nodes[0].y, target.y)
      separated(field.nodes)
    }
    assert.deepEqual(a.snapshot(), b.snapshot())
  }
  a.release(points[0].id)
  b.release(points[0].id)
  assert.equal(finish(a), finish(b))
  assert.deepEqual(a.snapshot(), b.snapshot())
  assert.equal(a.nodes[0].anchorX, -1044)
  assert.equal(a.nodes[0].anchorY, -375)
  separated(a.nodes)
  const resting = a.snapshot()
  for (let i = 0; i < 120; i++) assert.equal(a.step(1 / 60), false)
  assert.deepEqual(a.snapshot(), resting)
  for (const [i, node] of a.nodes.entries()) assert.equal(node, identities[i])
  assert.deepEqual({ points, relations }, original)
})

test("restoring from deformed map coordinates preserves every later drag and integration step", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 240, y: 0 },
    { id: "c", x: 450, y: 125 },
  ]
  const relations = [edge("a", "b", 0), edge("b", "c", 1)]
  const original = createGlobalMapField(points, relations)
  finish(original)
  original.drag("a", 100, 70)
  original.release("a")
  finish(original)
  const saved = original.snapshot()
  // This is the browser's actual history reconstruction path: current deformed
  // coordinates seed the new scene, rather than the original constructor seed.
  const restored = createGlobalMapField(saved.nodes, relations)
  assert.notDeepEqual(restored.snapshot().restLengths, saved.restLengths)
  assert.equal(restored.restore(saved), true)
  assert.deepEqual(restored.snapshot(), saved)
  for (const target of [
    { x: 50, y: 30 },
    { x: 231, y: 8 },
    { x: -100, y: 250 },
  ]) {
    original.drag("a", target.x, target.y)
    restored.drag("a", target.x, target.y)
    assert.deepEqual(restored.snapshot(), original.snapshot())
    for (let i = 0; i < 20; i++) {
      assert.equal(restored.step(1 / 60), original.step(1 / 60))
      assert.deepEqual(restored.snapshot(), original.snapshot())
    }
  }
  original.release("a")
  restored.release("a")
  let steps = 0
  while (!original.settled && steps++ < 720) {
    assert.equal(restored.step(1 / 60), original.step(1 / 60))
    assert.deepEqual(restored.snapshot(), original.snapshot())
  }
  assert.ok(original.settled && restored.settled)
})

test("rest lengths validate exact real edge IDs and positive finite values before mutating the field", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 240, y: 0 },
  ]
  const field = createGlobalMapField(points, [edge("a", "b", 0)])
  finish(field)
  const valid = field.snapshot()
  for (const restLengths of [
    {},
    { unknown: 168 },
    { "edge-0": 168, extra: 100 },
    { "edge-0": 0 },
    { "edge-0": -1 },
    { "edge-0": Infinity },
    { "edge-0": NaN },
    { "edge-0": "168" },
    null,
    [],
  ]) {
    const changed = structuredClone(valid)
    changed.nodes[0].x = 999
    assert.equal(field.restore({ ...changed, restLengths }), false)
    assert.deepEqual(field.snapshot(), valid)
  }
  const legacy = { version: valid.version, nodes: valid.nodes, settled: valid.settled }
  const reconstructed = createGlobalMapField(valid.nodes, [edge("a", "b", 0)])
  const constructorLengths = reconstructed.snapshot().restLengths
  assert.equal(reconstructed.restore(legacy), true)
  assert.deepEqual(reconstructed.snapshot().restLengths, constructorLengths)
  assert.deepEqual(reconstructed.snapshot().nodes, legacy.nodes)
  const empty = createGlobalMapField([], [])
  assert.equal(empty.restore(empty.snapshot()), true)
})

test("a drag gives actual linked neighbors a bounded elastic excursion while unrelated points stay still", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 300, y: 0 },
    { id: "unlinked", x: 1700, y: 800 },
  ]
  const relation = { ...edge("a", "b", 1), strength: 0.8 }
  for (const hz of [30, 60, 120]) {
    const field = createGlobalMapField(points, [relation])
    finish(field)
    const before = field.snapshot(),
      neighbor = field.nodes[1],
      target = { x: -180, y: 70 }
    field.drag("a", target.x, target.y)
    let peak = 0
    for (let frame = 0; frame < hz; frame++) {
      field.step(1 / hz)
      peak = Math.max(
        peak,
        Math.hypot(neighbor.x - before.nodes[1].x, neighbor.y - before.nodes[1].y),
      )
      assert.equal(field.nodes[0].x, target.x)
      assert.equal(field.nodes[0].y, target.y)
      assert.deepEqual(field.nodes[2], before.nodes[2])
      assert.equal(neighbor.anchorX, before.nodes[1].anchorX)
      assert.equal(neighbor.anchorY, before.nodes[1].anchorY)
      separated(field.nodes)
    }
    const heldRest = Math.hypot(neighbor.x - before.nodes[1].x, neighbor.y - before.nodes[1].y)
    assert.ok(
      peak > 4 && peak < 12,
      `elastic excursion should be noticeable and bounded, got ${peak}`,
    )
    assert.ok(
      peak > heldRest + 3,
      "the input response should relax instead of holding an artificial offset",
    )
    field.release("a")
    for (let frame = 0; frame < hz * 2 && !field.settled; frame++) field.step(1 / hz)
    assert.ok(field.settled)
    assert.equal(field.nodes[0].anchorX, target.x)
    assert.equal(field.nodes[0].anchorY, target.y)
    const resting = field.snapshot()
    for (let frame = 0; frame < hz; frame++) assert.equal(field.step(1 / hz), false)
    assert.deepEqual(field.snapshot(), resting)
  }
})

test("drag momentum is deduplicated by neighbor, capped during repeated movement, and absent on stationary input", () => {
  const points = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 400, y: 0 },
    { id: "c", x: 900, y: 0 },
  ]
  const link = { ...edge("a", "b", 1), strength: 0.8 },
    chain = edge("b", "c", 9)
  const single = createGlobalMapField(points, [link, chain]),
    repeated = createGlobalMapField(points, [link, { ...link, id: "same-endpoints" }, chain])
  for (const field of [single, repeated]) {
    field.drag("a", -180, 70)
    assert.equal(field.nodes[2].vx, 0, "an indirect endpoint receives no artificial kick")
    assert.equal(field.nodes[2].vy, 0)
    const momentum = { x: field.nodes[1].vx, y: field.nodes[1].vy }
    field.drag("a", -180, 70)
    assert.deepEqual({ x: field.nodes[1].vx, y: field.nodes[1].vy }, momentum)
  }
  const a = single.nodes[1],
    b = repeated.nodes[1]
  assert.ok(Math.abs(a.vx * a.mass - b.vx * b.mass) < 1e-9)
  assert.ok(Math.abs(a.vy * a.mass - b.vy * b.mass) < 1e-9)
  for (let i = 0; i < 40; i++) {
    const x = i % 2 ? -5000 : 5000
    single.drag("a", x, 900)
    assert.equal(single.nodes[0].x, x)
    assert.equal(single.nodes[0].y, 900)
    assert.ok(Math.hypot(single.nodes[1].vx, single.nodes[1].vy) <= 900.000000001)
    assert.equal(single.nodes[2].vx, 0)
    assert.equal(single.nodes[2].vy, 0)
  }
})
