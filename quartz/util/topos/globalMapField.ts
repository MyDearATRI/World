import type { Relation } from "./types"

export interface MapFieldPoint {
  id: string
  x: number
  y: number
  radius?: number
}
export interface MapFieldNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  anchorX: number
  anchorY: number
  radius: number
  mass: number
  attraction: number
  charge: number
}
export interface MapFieldSnapshot {
  version: 1
  nodes: MapFieldNode[]
  settled: boolean
  // Older v1 snapshots omit this. Their constructor-derived rest lengths remain
  // the explicit migration fallback; new snapshots preserve future dynamics.
  restLengths?: Record<string, number>
}

function direction(a: string, b: string) {
  let hash = 2166136261
  for (const char of `${a}|${b}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const angle = ((hash >>> 0) / 0x100000000) * Math.PI * 2
  return { x: Math.cos(angle), y: Math.sin(angle) }
}
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e7
// Scale stiffness/charge and damping together: the same equilibrium, reached
// promptly in UI time rather than leaving a barely moving scene for seconds.
const response = 12
// At the map's maximum 4× zoom, these bounds mean at most 0.1 CSS px
// of movement per frame. Requiring both displacement and speed to stay small
// for six consecutive steps avoids stopping at an oscillation's turning point.
const quietDisplacement = 0.025
const quietSpeed = 0.7
const quietSteps = 6

/** Layout mechanics only. These strengths do not assert mathematical importance or implication. */
export function createGlobalMapField(
  points: readonly MapFieldPoint[],
  relations: readonly Relation[],
) {
  const degree = new Map<string, number>()
  for (const edge of relations) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1)
  }
  const nodes: MapFieldNode[] = points.map((point) => ({
    id: point.id,
    x: point.x,
    y: point.y,
    vx: 0,
    vy: 0,
    anchorX: point.x,
    anchorY: point.y,
    radius: Math.max(24, point.radius ?? 34),
    mass: 1 + Math.min(1, Math.log1p(degree.get(point.id) ?? 0) * 0.18),
    attraction: (13 + 4 / (1 + Math.log1p(degree.get(point.id) ?? 0))) * response ** 2,
    charge:
      18000 *
      response ** 2 *
      (Math.max(24, point.radius ?? 34) / 34) ** 2 *
      (1 + Math.min(0.3, Math.log1p(degree.get(point.id) ?? 0) * 0.07)),
  }))
  const byID = new Map(nodes.map((node) => [node.id, node]))
  const indices = new Map(nodes.map((node, i) => [node.id, i]))
  const links = relations.flatMap((edge) => {
    const source = byID.get(edge.source),
      target = byID.get(edge.target)
    if (!source || !target || source === target) return []
    const distance = Math.hypot(source.x - target.x, source.y - target.y)
    const provenance =
      edge.provenance === "structure" ? 0.45 : edge.provenance === "reference" ? 0.7 : 1
    const strength = Math.max(0, Math.min(1, finite(edge.strength) ? edge.strength : 0.5))
    return [
      {
        id: edge.id,
        source,
        target,
        sourceIndex: indices.get(source.id)!,
        targetIndex: indices.get(target.id)!,
        length: Math.max(
          source.radius + target.radius + 26,
          distance * (distance > 600 ? 0.96 : 0.7),
        ),
        stiffness:
          ((2.4 + strength * 2.6) * provenance * response ** 2) /
          Math.sqrt(Math.max(1, degree.get(source.id) ?? 0, degree.get(target.id) ?? 0)),
      },
    ]
  })
  let heldID: string | undefined
  let active = nodes.length > 0,
    quiet = 0
  const fx = new Float64Array(nodes.length),
    fy = new Float64Array(nodes.length),
    beforeX = new Float64Array(nodes.length),
    beforeY = new Float64Array(nodes.length)
  // Exact short-range broad phase. A 32-unit skin per endpoint lets small
  // integration steps reuse deterministic candidate rows. Rebuild before any
  // endpoint leaves its skin, including during a collision projection: contact
  // chains must never rely on the stale grid from the beginning of a frame.
  const skin = 32,
    referenceX = new Float64Array(nodes.length),
    referenceY = new Float64Array(nodes.length)
  let pairRows: number[][] = [],
    pairsDirty = true
  const outsideSkin = (i: number) =>
    (nodes[i].x - referenceX[i]) ** 2 + (nodes[i].y - referenceY[i]) ** 2 > skin * skin
  function rebuildPairs() {
    const radius = Math.max(220, 2 * Math.max(0, ...nodes.map((n) => n.radius)) + 8) + 2 * skin
    const radiusSquared = radius * radius
    const cells = new Map<string, number[]>()
    nodes.forEach((node, i) => {
      referenceX[i] = node.x
      referenceY[i] = node.y
      const key = `${Math.floor(node.x / radius)},${Math.floor(node.y / radius)}`
      const cell = cells.get(key)
      if (cell) cell.push(i)
      else cells.set(key, [i])
    })
    pairRows = nodes.map((node, i) => {
      const x = Math.floor(node.x / radius),
        y = Math.floor(node.y / radius),
        row: number[] = []
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (const j of cells.get(`${x + dx},${y + dy}`) ?? []) {
            if (j <= i) continue
            const other = nodes[j]
            if ((node.x - other.x) ** 2 + (node.y - other.y) ** 2 <= radiusSquared) row.push(j)
          }
      // Match the original i/j scan's arithmetic and projection order. Grid
      // iteration order is never allowed to change the resulting geometry.
      return row.sort((a, b) => a - b)
    })
    pairsDirty = false
  }
  function ensurePairs() {
    if (pairsDirty || nodes.some((_, i) => outsideSkin(i))) rebuildPairs()
  }
  function wake() {
    active = true
    quiet = 0
  }
  function collide() {
    ensurePairs()
    for (let pass = 0; pass < 8; pass++) {
      let corrected = false
      for (let i = 0; i < nodes.length; i++)
        for (let cursor = 0; cursor < pairRows[i].length; cursor++) {
          const j = pairRows[i][cursor]
          const a = nodes[i],
            b = nodes[j],
            minimum = a.radius + b.radius + 8
          let dx = b.x - a.x,
            dy = b.y - a.y
          if (dx * dx + dy * dy >= minimum * minimum - 0.001) continue
          let distance = Math.hypot(dx, dy)
          if (distance < 0.0001) {
            const axis = direction(a.id, b.id)
            dx = axis.x
            dy = axis.y
            distance = 1
          }
          const nx = dx / distance,
            ny = dy / distance
          const wa = a.id === heldID ? 0 : 1 / a.mass,
            wb = b.id === heldID ? 0 : 1 / b.mass,
            sum = wa + wb
          if (!sum) continue
          const penetration = minimum - distance
          a.x -= (nx * penetration * wa) / sum
          a.y -= (ny * penetration * wa) / sum
          b.x += (nx * penetration * wb) / sum
          b.y += (ny * penetration * wb) / sum
          const approaching = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (approaching < 0) {
            a.vx += (nx * approaching * wa) / sum
            a.vy += (ny * approaching * wa) / sum
            b.vx -= (nx * approaching * wb) / sum
            b.vy -= (ny * approaching * wb) / sum
          }
          corrected ||= penetration > 0.02
          if (outsideSkin(i) || outsideSkin(j)) {
            rebuildPairs()
            // Resume after this pair, just as the all-pairs scan does. Earlier
            // pairs affected by a later projection are revisited next pass.
            cursor = 0
            while (cursor < pairRows[i].length && pairRows[i][cursor] <= j) cursor++
            cursor--
          }
        }
      if (!corrected) break
    }
  }
  function step(dt: number) {
    if (!active) return false
    const elapsed = Math.max(0, Math.min(0.05, finite(dt) ? dt : 1 / 60))
    // Keep the stable substep budget independent of the response multiplier;
    // faster relaxation must not multiply the pairwise collision work per frame.
    const count = Math.max(1, Math.ceil(elapsed / (1 / 300))),
      h = elapsed / count,
      damping = Math.exp(-9 * response * h)
    nodes.forEach((node, i) => {
      beforeX[i] = node.x
      beforeY[i] = node.y
    })
    for (let sub = 0; sub < count; sub++) {
      ensurePairs()
      nodes.forEach((node, i) => {
        fx[i] = (node.anchorX - node.x) * node.attraction
        fy[i] = (node.anchorY - node.y) * node.attraction
      })
      for (const link of links) {
        const dx = link.target.x - link.source.x,
          dy = link.target.y - link.source.y,
          distance = Math.max(0.001, Math.hypot(dx, dy))
        const force = Math.max(
          -180 * response ** 2,
          Math.min(180 * response ** 2, (distance - link.length) * link.stiffness),
        )
        const x = (dx / distance) * force,
          y = (dy / distance) * force
        const a = link.sourceIndex,
          b = link.targetIndex
        fx[a] += x
        fy[a] += y
        fx[b] -= x
        fy[b] -= y
      }
      for (let i = 0; i < nodes.length; i++)
        for (const j of pairRows[i]) {
          const a = nodes[i],
            b = nodes[j]
          const dx = b.x - a.x,
            dy = b.y - a.y,
            squared = dx * dx + dy * dy
          if (squared > 220 * 220 || squared < 0.0001) continue
          const distance = Math.sqrt(squared),
            force =
              (Math.sqrt(a.charge * b.charge) / Math.max(400, squared)) * (1 - distance / 220) ** 2
          const x = (dx / distance) * force,
            y = (dy / distance) * force
          fx[i] -= x
          fy[i] -= y
          fx[j] += x
          fy[j] += y
        }
      nodes.forEach((node, i) => {
        if (node.id === heldID) {
          node.vx = 0
          node.vy = 0
          return
        }
        node.vx = (node.vx + (fx[i] / node.mass) * h) * damping
        node.vy = (node.vy + (fy[i] / node.mass) * h) * damping
        node.x += node.vx * h
        node.y += node.vy * h
      })
      collide()
    }
    // Constraint projection can cancel motion while leaving a fictitious inward
    // velocity. Bound that velocity by the body's actual displacement this step.
    nodes.forEach((node, i) => {
      const observedSpeed =
        Math.hypot(node.x - beforeX[i], node.y - beforeY[i]) / Math.max(0.0001, elapsed)
      const speed = Math.hypot(node.vx, node.vy)
      if (speed > observedSpeed && speed > 0) {
        node.vx *= observedSpeed / speed
        node.vy *= observedSpeed / speed
      }
    })
    const moving = nodes.some(
      (node, i) =>
        Math.hypot(node.x - beforeX[i], node.y - beforeY[i]) > quietDisplacement ||
        Math.hypot(node.vx, node.vy) > quietSpeed,
    )
    quiet = moving ? 0 : quiet + 1
    if (quiet >= quietSteps) {
      active = false
      nodes.forEach((node) => {
        node.vx = 0
        node.vy = 0
      })
    }
    return active
  }
  return {
    nodes,
    step,
    get heldID() {
      return heldID
    },
    get settled() {
      return !active
    },
    drag(id: string, x: number, y: number) {
      const node = byID.get(id)
      if (!node || !finite(x) || !finite(y)) return
      heldID = id
      node.x = x
      node.y = y
      node.vx = 0
      node.vy = 0
      // Resolve penetration before the next paint, keeping the held body exactly under the pointer.
      collide()
      wake()
    },
    release(id: string) {
      if (heldID !== id) return
      const node = byID.get(id)!
      node.anchorX = node.x
      node.anchorY = node.y
      heldID = undefined
      wake()
    },
    setRadius(id: string, radius: number) {
      const node = byID.get(id)
      if (!node || !finite(radius) || radius < 1 || node.radius === radius) return
      node.radius = radius
      pairsDirty = true
      collide()
      wake()
    },
    snapshot(): MapFieldSnapshot {
      return {
        version: 1,
        nodes: nodes.map((node) => ({ ...node })),
        settled: !active,
        restLengths: Object.fromEntries(links.map((link) => [link.id, link.length])),
      }
    },
    restore(value: unknown) {
      if (!value || typeof value !== "object") return false
      const state = value as Partial<MapFieldSnapshot>
      if (
        state.version !== 1 ||
        !Array.isArray(state.nodes) ||
        state.nodes.length !== nodes.length ||
        new Set(state.nodes.map((node) => node?.id)).size !== nodes.length
      )
        return false
      if (
        state.nodes.some(
          (node) =>
            !node ||
            !byID.has(node.id) ||
            ![node.x, node.y, node.vx, node.vy, node.anchorX, node.anchorY].every(finite),
        )
      )
        return false
      const lengths = state.restLengths
      if (
        lengths !== undefined &&
        (lengths === null ||
          typeof lengths !== "object" ||
          Array.isArray(lengths) ||
          Object.keys(lengths).length !== links.length ||
          links.some(
            (link) =>
              !Object.prototype.hasOwnProperty.call(lengths, link.id) ||
              typeof lengths[link.id] !== "number" ||
              !Number.isFinite(lengths[link.id]) ||
              lengths[link.id] <= 0,
          ))
      )
        return false
      for (const item of state.nodes)
        Object.assign(byID.get(item.id)!, {
          x: item.x,
          y: item.y,
          vx: item.vx,
          vy: item.vy,
          anchorX: item.anchorX,
          anchorY: item.anchorY,
        })
      if (lengths !== undefined) for (const link of links) link.length = lengths[link.id]
      heldID = undefined
      active = state.settled !== true
      pairsDirty = true
      quiet = 0
      return true
    },
    settle() {
      for (let i = 0; i < 900 && active; i++) step(1 / 60)
      return !active
    },
  }
}
