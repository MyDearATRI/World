import { strict as assert } from "node:assert"
import { test } from "node:test"
import {
  computeAnnotations,
  type AnnotationItem,
  type AnnotationBox,
  type AnnotationBounds,
} from "./annotations"

const bounds: AnnotationBounds = { left: 12, top: 90, right: 378, bottom: 680 }
const area = (a: AnnotationBox, b: AnnotationBox) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
const within = (box: AnnotationBox, b = bounds) =>
  box.x >= b.left &&
  box.y >= b.top &&
  box.x + box.width <= b.right &&
  box.y + box.height <= b.bottom
const item = (id: string, anchorX: number, anchorY: number, priority = 1): AnnotationItem => ({
  id,
  anchorX,
  anchorY,
  width: 120,
  height: 52,
  priority,
})

test("an unobstructed label stays upper-right and close to its concept", () => {
  const result = computeAnnotations([item("focus", 130, 300, 100)], bounds)
  assert.deepEqual(result, [{ id: "focus", x: 144, y: 234, width: 120, height: 52 }])
})

test("a half-pixel anchor change preserves a valid remembered title slot", () => {
  const room = { left: 14, top: 100, right: 986, bottom: 790 }
  const a = { id: "a", anchorX: 400, anchorY: 420, width: 185, height: 55, priority: 7 }
  const b = { id: "b", anchorX: 406, anchorY: 430, width: 185, height: 55, priority: 6 }
  const original = computeAnnotations([a, b], room)
  const changed = computeAnnotations([a, { ...b, anchorX: 406.5 }], room, [], original)
  for (const box of changed) {
    const prior = original.find((value) => value.id === box.id)!
    assert.ok(Math.hypot(box.x - prior.x, box.y - prior.y) <= 0.5)
  }
  assert.equal(area(changed[0], changed[1]), 0)
  const blocked = { ...original[1], width: 200, height: 70 }
  const relocated = computeAnnotations([a, b], room, [blocked], original)
  assert.ok(relocated.every((box) => within(box, room) && area(box, blocked) === 0))
  assert.equal(area(relocated[0], relocated[1]), 0)
})

test("eight clustered mobile labels remain present, readable and inside safe bounds", () => {
  const items = [
    { ...item("focus", 192, 330, 100), width: 170, height: 64 },
    item("a", 125, 260, 30),
    item("b", 265, 280, 20),
    item("c", 140, 375, 20),
    item("d", 230, 410, 20),
    item("e", 95, 335, 10),
    item("f", 280, 350, 10),
    item("g", 210, 230, 10),
  ]
  const original = structuredClone(items),
    originalBounds = { ...bounds }
  const result = computeAnnotations(items, bounds)
  assert.equal(result.length, items.length)
  assert.deepEqual(
    result.map((p) => p.id),
    items.map((p) => p.id),
  )
  assert.ok(result.every((p) => within(p)))
  for (let a = 0; a < result.length; a++)
    for (let b = a + 1; b < result.length; b++)
      assert.equal(area(result[a], result[b]), 0, `${result[a].id} and ${result[b].id} overlap`)
  assert.deepEqual(items, original)
  assert.deepEqual(bounds, originalBounds)
  assert.deepEqual(computeAnnotations(items, bounds), result)
  assert.deepEqual(
    computeAnnotations([...items].reverse(), bounds).sort((a, b) => a.id.localeCompare(b.id)),
    [...result].sort((a, b) => a.id.localeCompare(b.id)),
  )
})

test("fixed controls are avoided and higher priority focus retains its preferred position", () => {
  const focus = item("focus", 140, 290, 100)
  const other = item("other", 140, 290, 1)
  const excluded = [
    { x: 12, y: 550, width: 366, height: 90 },
    { x: 12, y: 90, width: 180, height: 50 },
  ]
  const result = computeAnnotations([other, focus], bounds, excluded)
  assert.deepEqual(
    result.find((p) => p.id === "focus"),
    computeAnnotations([focus], bounds, excluded)[0],
  )
  assert.equal(area(result[0], result[1]), 0)
  assert.ok(result.every((p) => excluded.every((box) => area(p, box) === 0)))
  const preferredBlock = [{ x: 150, y: 210, width: 150, height: 70 }]
  const relocated = computeAnnotations([focus], bounds, preferredBlock)[0]
  assert.equal(area(relocated, preferredBlock[0]), 0)
  const edgeDistance = Math.hypot(
    focus.anchorX - Math.max(relocated.x, Math.min(focus.anchorX, relocated.x + relocated.width)),
    focus.anchorY - Math.max(relocated.y, Math.min(focus.anchorY, relocated.y + relocated.height)),
  )
  assert.ok(edgeDistance < 65, "the alternative remains near the same concept")
})

test("an impossible crowd minimizes overlap without silently discarding mandatory labels", () => {
  const small = { left: 0, top: 0, right: 150, bottom: 100 }
  const items = Array.from({ length: 5 }, (_, i) => ({
    ...item(String(i), 75, 50, 5 - i),
    width: 95,
    height: 60,
  }))
  const result = computeAnnotations(items, small)
  assert.equal(new Set(result.map((p) => p.id)).size, 5)
  assert.ok(result.every((p) => within(p, small)))
  let overlap = 0
  for (let a = 0; a < result.length; a++)
    for (let b = a + 1; b < result.length; b++) overlap += area(result[a], result[b])
  assert.ok(overlap > 0, "the test fixture intentionally cannot fit")
  assert.ok(
    overlap < 10 * 95 * 60 * 0.65,
    "packing is materially better than putting every label at one anchor",
  )
})

test("off-screen anchors and oversized measurements remain bounded with finite coordinates", () => {
  const result = computeAnnotations(
    [
      item("left", -500, 100, 20),
      item("right", 900, 900, 10),
      { ...item("large", 180, 250, 100), width: 900, height: 700 },
    ],
    bounds,
  )
  assert.ok(result.every((p) => within(p)))
  assert.equal(result.find((p) => p.id === "large")!.width, 366)
  assert.equal(result.find((p) => p.id === "large")!.height, 590)
  assert.deepEqual(computeAnnotations([], bounds), [])
  assert.throws(() => computeAnnotations([item("a", NaN, 1)], bounds), /Invalid annotation/)
  assert.throws(
    () => computeAnnotations([item("a", 1, 1), item("a", 2, 2)], bounds),
    /Duplicate annotation/,
  )
  assert.throws(() => computeAnnotations([], { ...bounds, right: 0 }), /positive area/)
})
