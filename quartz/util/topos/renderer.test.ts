import assert from "node:assert/strict"
import test from "node:test"
import * as THREE from "three"
import { readFileSync } from "node:fs"
import {
  createAppearanceModel,
  createRelationGeometry,
  updateRelationGeometry,
  communityFootprint,
} from "../../components/scripts/topos/renderer"
import { deriveContext } from "./context"
import { createField } from "./field"
import type { Context, KnowledgeModel, ViewState } from "./types"

const prototype = () =>
  JSON.parse(readFileSync("knowledge/topos/prototype.json", "utf8")) as KnowledgeModel
const view = (focus: string): ViewState => ({
  version: 1,
  focus,
  trail: [],
  lens: "structural",
  scale: 0,
  unfolded: [],
})

test("moving a dashed relation keeps both GPU attributes and matches Three's cumulative distances", () => {
  const geometry = createRelationGeometry(true)
  const position = geometry.getAttribute("position")
  const distance = geometry.getAttribute("lineDistance")
  for (let frame = 0; frame < 80; frame++) {
    updateRelationGeometry(
      geometry,
      { x: 25 + frame, y: 70 },
      { x: 490, y: 125 + frame },
      1024,
      900,
    )
    assert.equal(geometry.getAttribute("position"), position)
    assert.equal(geometry.getAttribute("lineDistance"), distance)
    const reference = new THREE.Line(geometry.clone())
    reference.computeLineDistances()
    assert.deepEqual(
      Array.from(distance.array),
      Array.from(reference.geometry.getAttribute("lineDistance").array),
    )
    reference.geometry.dispose()
    ;(reference.material as THREE.Material).dispose()
  }
  assert.ok(position instanceof THREE.BufferAttribute)
  assert.ok(distance instanceof THREE.BufferAttribute)
  assert.equal(position.usage, THREE.DynamicDrawUsage)
  assert.equal(distance.usage, THREE.DynamicDrawUsage)
  geometry.dispose()
})

test("solid relations allocate no unused distance buffer and retain exact source/target endpoints", () => {
  const geometry = createRelationGeometry(false)
  updateRelationGeometry(geometry, { x: 33, y: 88 }, { x: 176, y: 205 }, 390, 844)
  assert.equal(geometry.getAttribute("lineDistance"), undefined)
  const p = geometry.getAttribute("position")
  assert.deepEqual([p.getX(0), p.getY(0), p.getZ(0)], [33 - 195, 422 - 88, -500])
  assert.deepEqual([p.getX(24), p.getY(24), p.getZ(24)], [176 - 195, 422 - 205, -500])
  geometry.dispose()
})

test("cached graph importance changes correctly with fresh communities, visibility and lenses", () => {
  const model = prototype(),
    context = deriveContext(model, view(model.initial))
  const field = createField(model, context)
  const cached = createAppearanceModel(model)
  for (const node of field.nodes) cached(node, context)
  const variants: Context[] = [
    {
      ...context,
      communities: context.communities.map((community) => ({
        ...community,
        members: community.members.slice(1),
      })),
    },
    { ...context, visibleIDs: [model.initial] },
    { ...context, visibleIDs: [] },
    { ...context, lens: "action" },
    { ...context, lens: "linear", scale: 1.5, previous: "action" },
  ]
  for (const variant of variants) {
    const fresh = createAppearanceModel(model)
    for (const node of field.nodes) assert.deepEqual(cached(node, variant), fresh(node, variant))
  }
})

test("rounded community expansion remains finite at coincident points and translation equivariant", () => {
  const model = prototype(),
    context = deriveContext(model, view(model.initial))
  const field = createField(model, context)
  const community = context.communities[0]
  const nodes = field.nodes.map((node) => ({ ...node, x: 20, y: 30, z: 0, relevance: 1 }))
  const original = structuredClone(nodes)
  const footprint = communityFootprint(community, nodes, (node) => node, 0)!
  const translated = communityFootprint(
    community,
    nodes,
    (node) => ({ x: node.x + 271, y: node.y - 43 }),
    0,
  )!
  assert.equal(footprint.points.length, 64)
  for (let i = 0; i < 64; i++) {
    assert.ok(Number.isFinite(footprint.points[i].x) && Number.isFinite(footprint.points[i].y))
    assert.ok(Math.abs(translated.points[i].x - footprint.points[i].x - 271) < 1e-8)
    assert.ok(Math.abs(translated.points[i].y - footprint.points[i].y + 43) < 1e-8)
  }
  assert.deepEqual(nodes, original)
})
