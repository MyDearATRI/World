import type { Context, FieldNode, KnowledgeModel, RelationType } from "./types"
import { relationAffinity } from "./context"

interface Point {
  x: number
  y: number
  z: number
}
interface Pose extends Point {
  relevance: number
}
interface Motion {
  from: Pose
  to: Pose
  velocity: Point
  elapsed: number
  duration: number
  local?: boolean
}
interface LayoutForces {
  mass: number
  anchorGain: number
  attractionGain: number
  repulsionGain: number
  damping: number
  degree: number
  relationTypes: RelationType[]
}
export interface FieldSnapshot {
  version: 1
  focus: string
  nodes: FieldNode[]
  targets?: Record<string, Point>
  preferredTargets?: Record<string, Point>
  sleeping?: boolean
  /** Retained for old history records; this is now elapsed transition time, not heat. */
  coolingTime?: number
  manualAnchors?: Record<string, Point>
  motions?: Record<string, Motion>
  /** Recomputed, observable layout diagnostics; never mathematical importance. */
  layout?: Record<
    string,
    LayoutForces & {
      preferredTarget: Point
      resolvedTarget: Point
      held: boolean
      readable: boolean
    }
  >
}
interface Link {
  source: string
  target: string
  gain: number
}
interface DragSession {
  origin: Point
  neighbors: Map<string, { origin: Pose; weight: number }>
  origins: Map<string, Point>
  affected: Set<string>
}
/** Layout coefficients, not claims about mathematical importance or dependence. */
export const fieldForceSettings = {
  clearance: 8,
  anchor: 0.16,
  manualAnchor: 0.32,
  attraction: 0.44,
  repulsion: 1,
  damping: 0.68,
  integrationPasses: 24,
  contactPasses: 24,
  neighborReach: 18,
  markerRadius: 38,
} as const
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
function seed(id: string) {
  let n = 2166136261
  for (const c of id) n = Math.imul(n ^ c.charCodeAt(0), 16777619)
  return (n >>> 0) / 4294967296
}
const physicalGain: Partial<Record<RelationType, number>> = {
  equivalence: 1,
  definition: 0.85,
  construction: 0.8,
  representation: 0.9,
  example: 0.55,
  duality: 0.7,
  contradiction: 0.7,
  historical: 0.25,
}
const point = (n: Point): Point => ({ x: n.x, y: n.y, z: n.z })
const pose = (n: Pose): Pose => ({ ...point(n), relevance: n.relevance })
const finitePoint = (value: Point) => value && [value.x, value.y, value.z].every(Number.isFinite)

/** Persistent positions with event-bounded layout transitions, not an always-live simulation. */
export function createField(model: KnowledgeModel, initial: Context) {
  let context = initial
  const roles = new Map(initial.nodes.map((n) => [n.id, n]))
  const nodes: FieldNode[] = model.concepts.map((concept, i) => {
    const role = roles.get(concept.id)!
    const angle = seed(concept.id) * Math.PI * 2
    const radius =
      role.role === "focus"
        ? 0
        : role.role === "neighbor"
          ? 250 + (i % 3) * 52
          : 680 + seed(`${concept.id}:r`) * 160
    return {
      id: concept.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.78,
      z: role.role === "focus" ? 0 : role.role === "horizon" ? -260 : -70,
      vx: 0,
      vy: 0,
      vz: 0,
      relevance: role.relevance,
      targetRelevance: role.relevance,
      radius: fieldForceSettings.markerRadius,
      mass: role.role === "focus" ? 4 : 1,
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const targets = new Map<string, Point>()
  const preferredTargets = new Map<string, Point>()
  const manualAnchors = new Map<string, Point>()
  const dragging = new Map<string, DragSession>()
  const motions = new Map<string, Motion>()
  const resized = new Set<string>()
  const profiles = new Map<string, LayoutForces>()
  let active = nodes
  let activeIDs = new Set(nodes.map((n) => n.id))
  let readable = nodes
  let readableIDs = new Set(nodes.map((n) => n.id))
  let links: Link[] = []
  let fullLayoutPending = true
  let sleeping = false
  let coolingTime = 0

  function geometryKey(next: Context) {
    // Semantic depth changes display/relevance, not the reader's placement.
    return JSON.stringify([
      next.focus,
      next.previous,
      next.lens,
      next.visibleIDs ?? model.concepts.map((n) => n.id),
      model.relations.map((r) => [r.source, r.target, r.type, r.strength, r.lenses]),
    ])
  }
  let geometry = geometryKey(initial)

  function compile() {
    activeIDs = new Set(context.visibleIDs ?? nodes.map((n) => n.id))
    active = nodes.filter((n) => activeIDs.has(n.id))
    readableIDs = new Set(
      context.nodes
        .filter((n) => activeIDs.has(n.id) && (n.role !== "horizon" || n.relevance > 0.3))
        .map((n) => n.id),
    )
    readable = active.filter((n) => readableIDs.has(n.id))
    links = []
    const adjacency = new Map(nodes.map((n) => [n.id, new Set<string>()]))
    const edgeTypes = new Map(nodes.map((n) => [n.id, new Set<RelationType>()]))
    const gains = new Map(nodes.map((n) => [n.id, 0]))
    for (const edge of model.relations) {
      if (!activeIDs.has(edge.source) || !activeIDs.has(edge.target) || edge.source === edge.target)
        continue
      const gain = relationAffinity(edge, context.lens) * (physicalGain[edge.type] ?? 0.65)
      if (gain > 0) {
        links.push({ source: edge.source, target: edge.target, gain })
        for (const [id, other] of [
          [edge.source, edge.target],
          [edge.target, edge.source],
        ]) {
          adjacency.get(id)!.add(other)
          edgeTypes.get(id)!.add(edge.type)
          gains.set(id, gains.get(id)! + gain)
        }
      }
    }
    for (const role of context.nodes) {
      const n = byId.get(role.id)
      if (!n) continue
      n.targetRelevance = activeIDs.has(n.id) ? role.relevance : 0
      const degree = adjacency.get(n.id)!.size
      const relationTypes = [...edgeTypes.get(n.id)!].sort()
      const density = Math.min(3, Math.log2(1 + degree))
      // These small bounded variations support differently connected objects
      // without making degree a statement of mathematical value or precedence.
      n.mass = (role.role === "focus" ? 4 : 1) + density * 0.12
      profiles.set(n.id, {
        mass: n.mass,
        anchorGain: fieldForceSettings.anchor * (1 + density * 0.05),
        attractionGain:
          fieldForceSettings.attraction *
          (0.8 + 0.2 * Math.min(1, gains.get(n.id)! / Math.max(1, degree))),
        repulsionGain:
          fieldForceSettings.repulsion * (1 + Math.min(5, relationTypes.length) * 0.04),
        damping: fieldForceSettings.damping,
        degree,
        relationTypes,
      })
      if (!activeIDs.has(n.id)) {
        motions.delete(n.id)
        n.vx = n.vy = n.vz = 0
        n.relevance = 0
      }
    }
  }

  function schedule(n: FieldNode, to: Pose, duration: number, local = false) {
    targets.set(n.id, point(to))
    if (
      [n.x - to.x, n.y - to.y, n.z - to.z, n.relevance - to.relevance].every(
        (v) => Math.abs(v) < 1e-9,
      )
    ) {
      motions.delete(n.id)
      n.vx = n.vy = n.vz = 0
      return
    }
    // Cubic Hermite interpolation has a fixed endpoint and zero final velocity.
    // Retargeting preserves the current pose; very large inherited velocity is
    // bounded by the remaining path to avoid an overshoot on rapid focus changes.
    const velocity = {
      x: clamp(n.vx, (-2 * Math.abs(to.x - n.x)) / duration, (2 * Math.abs(to.x - n.x)) / duration),
      y: clamp(n.vy, (-2 * Math.abs(to.y - n.y)) / duration, (2 * Math.abs(to.y - n.y)) / duration),
      z: clamp(n.vz, (-2 * Math.abs(to.z - n.z)) / duration, (2 * Math.abs(to.z - n.z)) / duration),
    }
    motions.set(n.id, { from: pose(n), to: { ...to }, velocity, elapsed: 0, duration, local })
    sleeping = false
  }

  function forces(n: FieldNode) {
    const profile = profiles.get(n.id)!
    const mass = clamp(n.mass, 0.5, 16)
    return {
      mass,
      anchor:
        profile.anchorGain *
        (manualAnchors.has(n.id)
          ? fieldForceSettings.manualAnchor / fieldForceSettings.anchor
          : 1) *
        Math.sqrt(mass),
      attraction: profile.attractionGain * Math.max(0.25, n.targetRelevance),
      repulsion: profile.repulsionGain,
      damping: profile.damping,
    }
  }

  function resolveCollisions(
    work: Map<string, Point>,
    movable: Set<string>,
    passes: number,
    contactPinned?: string,
    footprint = (n: FieldNode) => n.radius,
    gap = fieldForceSettings.clearance as number,
  ) {
    for (let pass = 0; pass < passes; pass++) {
      let maximum = 0
      for (let i = 0; i < readable.length; i++)
        for (let j = i + 1; j < readable.length; j++) {
          const a = readable[i],
            b = readable[j]
          let moveA = movable.has(a.id),
            moveB = movable.has(b.id)
          if (!moveA && !moveB && a.id !== contactPinned && b.id !== contactPinned) continue
          const p = work.get(a.id)!,
            q = work.get(b.id)!
          const dx = q.x - p.x,
            dy = q.y - p.y
          const d = Math.hypot(dx, dy)
          const overlap = footprint(a) + footprint(b) + gap - d
          if (overlap <= 0.05) continue
          if (contactPinned) {
            // Enrol a new contact before projecting it. Otherwise treating the
            // next object as fixed would push its neighbour back into the drag.
            if (a.id !== contactPinned) {
              movable.add(a.id)
              moveA = true
            }
            if (b.id !== contactPinned) {
              movable.add(b.id)
              moveB = true
            }
          }
          maximum = Math.max(maximum, overlap)
          const angle = d < 0.01 ? seed(`${a.id}:${b.id}`) * Math.PI * 2 : 0
          const ux = d < 0.01 ? Math.cos(angle) : dx / d,
            uy = d < 0.01 ? Math.sin(angle) : dy / d
          const inverseA = moveA ? forces(a).repulsion / forces(a).mass : 0
          const inverseB = moveB ? forces(b).repulsion / forces(b).mass : 0
          const inverseTotal = inverseA + inverseB
          if (moveA) {
            p.x -= (ux * overlap * inverseA) / inverseTotal
            p.y -= (uy * overlap * inverseA) / inverseTotal
          }
          if (moveB) {
            q.x += (ux * overlap * inverseB) / inverseTotal
            q.y += (uy * overlap * inverseB) / inverseTotal
          }
        }
      if (maximum < 0.1) break
    }
  }

  function finishClearance(
    work: Map<string, Point>,
    movable: Set<string>,
    footprint = (n: FieldNode) => n.radius,
    gap = fieldForceSettings.clearance as number,
  ) {
    const placed = readable
      .filter((n) => !movable.has(n.id))
      .map((n) => ({ node: n, p: work.get(n.id)! }))
    const ordered = readable
      .filter((n) => movable.has(n.id))
      .sort(
        (a, b) => b.targetRelevance - a.targetRelevance || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
      )
    for (const n of ordered) {
      const p = work.get(n.id)!
      const free = (x: number, y: number) =>
        placed.every(({ node, p: other }) => {
          const dx = x - other.x,
            dy = y - other.y
          return dx * dx + dy * dy >= (footprint(n) + footprint(node) + gap - 0.05) ** 2
        })
      if (!free(p.x, p.y)) {
        let best: { x: number; y: number } | undefined,
          bestDistance = Infinity
        const consider = (x: number, y: number) => {
          const d = (x - p.x) ** 2 + (y - p.y) ** 2
          if (d < bestDistance && free(x, y)) {
            best = { x, y }
            bestDistance = d
          }
        }
        // First try exact nearby contact boundaries, so a one-pixel footprint
        // change does not move a label by an entire search-grid step.
        for (const { node, p: other } of placed) {
          const dx = p.x - other.x,
            dy = p.y - other.y
          const radius = footprint(n) + footprint(node) + gap
          if (dx * dx + dy * dy > (radius + 48) ** 2) continue
          const angle = dx || dy ? Math.atan2(dy, dx) : seed(`${n.id}:${node.id}`) * Math.PI * 2
          for (const offset of [0, 1, -1, 2, -2, 3, -3, 6, -6, 12]) {
            const a = angle + (offset * Math.PI) / 12
            consider(other.x + Math.cos(a) * radius, other.y + Math.sin(a) * radius)
          }
        }
        for (const radius of [12, 24, 48, 72, 108, 162, 244, 366, 550, 825, 1240, 1860, 2790]) {
          if (radius * radius > bestDistance) break
          for (let i = 0; i < 24; i++) {
            const angle = (i * Math.PI) / 12
            consider(p.x + Math.cos(angle) * radius, p.y + Math.sin(angle) * radius)
          }
          if (best) break
        }
        // The world is not clipped to the viewport. Even an unusually large
        // footprint has a deterministic, finite non-overlapping fallback.
        if (!best) {
          const right = Math.max(...placed.map(({ node, p: other }) => other.x + footprint(node)))
          best = { x: right + footprint(n) + gap, y: p.y }
        }
        p.x = best.x
        p.y = best.y
      }
      placed.push({ node: n, p })
    }
  }

  function layoutGoals() {
    const origin = manualAnchors.get(context.focus) ?? { x: 0, y: 0, z: 0 }
    const focus = byId.get(context.focus)!
    const currentFocus = point(focus)
    const nextRoles = new Map(context.nodes.map((n) => [n.id, n]))
    const preferred = new Map<string, Point>()
    const work = new Map<string, Point>()
    const movable = new Set(readable.filter((n) => n.id !== context.focus).map((n) => n.id))
    for (const n of active) {
      const role = nextRoles.get(n.id)!
      const angle = Math.atan2(n.y - currentFocus.y, n.x - currentFocus.x)
      const minimum = focus.radius + n.radius + 105
      const radius =
        role.role === "focus"
          ? 0
          : role.role === "previous"
            ? Math.max(315, minimum)
            : role.role === "neighbor"
              ? Math.max(230 + (1 - role.relevance) * 190, minimum)
              : 660 + (1 - role.relevance) * 200
      const desired =
        manualAnchors.get(n.id) ??
        (!readableIDs.has(n.id)
          ? point(n)
          : {
              x: origin.x + Math.cos(angle) * radius,
              y: origin.y + Math.sin(angle) * radius * 0.8,
              z:
                role.role === "focus"
                  ? origin.z
                  : role.role === "previous"
                    ? -28
                    : role.role === "neighbor"
                      ? -45 - (1 - role.relevance) * 70
                      : -230 - (1 - role.relevance) * 100,
            })
      preferred.set(n.id, { ...desired })
      preferredTargets.set(n.id, { ...desired })
      work.set(n.id, { ...desired })
    }
    // A bounded, deterministic layout job. Edges retain their actual typed gains;
    // node separation is a geometric constraint, not another mathematical relation.
    for (let pass = 0; pass < 24; pass++) {
      for (const n of active)
        if (movable.has(n.id)) {
          const p = work.get(n.id)!,
            desired = preferred.get(n.id)!
          const force = forces(n)
          p.x += ((desired.x - p.x) * force.anchor * 0.5) / force.mass
          p.y += ((desired.y - p.y) * force.anchor * 0.5) / force.mass
        }
      for (const edge of links) {
        if (!readableIDs.has(edge.source) || !readableIDs.has(edge.target)) continue
        const a = byId.get(edge.source)!,
          b = byId.get(edge.target)!
        const p = work.get(a.id)!,
          q = work.get(b.id)!
        const dx = q.x - p.x,
          dy = q.y - p.y,
          d = Math.hypot(dx, dy) || 0.01
        const amount = clamp(
          (d - a.radius - b.radius - 125) *
            edge.gain *
            Math.min(a.targetRelevance, b.targetRelevance) *
            0.07,
          -24,
          24,
        )
        if (movable.has(a.id) && !manualAnchors.has(a.id)) {
          p.x += ((dx / d) * amount) / forces(a).mass
          p.y += ((dy / d) * amount) / forces(a).mass
        }
        if (movable.has(b.id) && !manualAnchors.has(b.id)) {
          q.x -= ((dx / d) * amount) / forces(b).mass
          q.y -= ((dy / d) * amount) / forces(b).mass
        }
      }
      resolveCollisions(work, movable, 1)
    }
    // Finish separating, rather than leaving a live spring fighting its rest length.
    resolveCollisions(work, movable, 16)
    finishClearance(work, movable)
    return work
  }

  function flushLayout() {
    if (fullLayoutPending) {
      fullLayoutPending = false
      resized.clear()
      compile()
      const goals = layoutGoals()
      for (const n of active)
        schedule(n, { ...goals.get(n.id)!, relevance: n.targetRelevance }, 0.6)
      coolingTime = 0
    } else if (resized.size) {
      // Only objects obstructed by an actual footprint change need clearance.
      const work = new Map(active.map((n) => [n.id, point(n)]))
      const movable = new Set<string>()
      for (const id of resized) {
        const changed = byId.get(id)
        if (!changed || !activeIDs.has(id)) continue
        for (const n of readable)
          if (
            n.id !== id &&
            n.id !== context.focus &&
            !manualAnchors.has(n.id) &&
            Math.hypot(n.x - changed.x, n.y - changed.y) <
              n.radius + changed.radius + fieldForceSettings.clearance
          )
            movable.add(n.id)
      }
      resized.clear()
      resolveCollisions(work, movable, 16)
      finishClearance(work, movable)
      for (const id of movable) {
        const n = byId.get(id)!
        schedule(n, { ...work.get(id)!, relevance: n.targetRelevance }, 0.5, true)
      }
    }
    sleeping = motions.size === 0
  }

  function setContext(
    next: Context,
    options: { rearrange?: boolean; clearManualAnchors?: boolean } = {},
  ) {
    if (!byId.has(next.focus)) throw new Error(`Unknown field focus: ${next.focus}`)
    const ids = new Set(next.nodes.map((n) => n.id))
    if (nodes.some((n) => !ids.has(n.id)))
      throw new Error("A context must retain every concept in the field")
    const key = geometryKey(next)
    context = next
    if (options.clearManualAnchors) manualAnchors.clear()
    if (key !== geometry || options.rearrange || options.clearManualAnchors) {
      geometry = key
      fullLayoutPending = true
      dragging.clear()
      sleeping = false
    }
    compile()
    // Relevance-only changes do not rebuild position goals or reset an in-flight layout.
    if (!fullLayoutPending)
      for (const n of active) {
        const motion = motions.get(n.id)
        if (motion) motion.to.relevance = n.targetRelevance
        else if (Math.abs(n.relevance - n.targetRelevance) > 1e-9)
          schedule(n, { ...point(n), relevance: n.targetRelevance }, 0.18)
      }
  }

  function setRadius(id: string, radius: number) {
    const n = byId.get(id)
    if (!n || !Number.isFinite(radius)) return
    // Legacy callers report label or reading-surface footprints. Labels have
    // their own layout now: no title can become a 300-world-unit solid sphere.
    const next = clamp(radius, 12, fieldForceSettings.markerRadius)
    if (Math.abs(next - n.radius) < 0.1) return
    n.radius = next
    resized.add(id)
    sleeping = false
  }

  function step(dtSeconds: number): boolean {
    flushLayout()
    if (sleeping) return false
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return true
    const dt = Math.min(dtSeconds, 0.1)
    coolingTime += dt
    for (const [id, motion] of motions) {
      const n = byId.get(id)!
      motion.elapsed = Math.min(motion.duration, motion.elapsed + dt)
      const t = motion.elapsed / motion.duration,
        t2 = t * t,
        t3 = t2 * t
      const position = 3 * t2 - 2 * t3,
        tangent = t3 - 2 * t2 + t
      const derivative = (6 * t - 6 * t2) / motion.duration,
        tangentDerivative = 3 * t2 - 4 * t + 1
      for (const axis of ["x", "y", "z"] as const) {
        const delta = motion.to[axis] - motion.from[axis]
        n[axis] =
          motion.from[axis] + delta * position + motion.velocity[axis] * motion.duration * tangent
      }
      n.vx = (motion.to.x - motion.from.x) * derivative + motion.velocity.x * tangentDerivative
      n.vy = (motion.to.y - motion.from.y) * derivative + motion.velocity.y * tangentDerivative
      n.vz = (motion.to.z - motion.from.z) * derivative + motion.velocity.z * tangentDerivative
      n.relevance = motion.from.relevance + (motion.to.relevance - motion.from.relevance) * position
      if (motion.elapsed >= motion.duration - 1e-9) {
        Object.assign(n, motion.to)
        n.vx = n.vy = n.vz = 0
        motions.delete(id)
      }
    }
    protectMarkers()
    sleeping = motions.size === 0
    return !sleeping
  }

  function protectMarkers() {
    const pinned = [...manualAnchors.keys()].at(-1)
    if (!pinned || !readableIDs.has(pinned)) return
    const movable = new Set([...motions].filter(([, motion]) => motion.local).map(([id]) => id))
    for (const session of dragging.values()) for (const id of session.affected) movable.add(id)
    movable.delete(pinned)
    if (!movable.size) return
    const work = new Map(readable.map((n) => [n.id, point(n)]))
    const marker = (n: FieldNode) => Math.min(n.radius, fieldForceSettings.markerRadius)
    // The small circle margin eases into its safe goal. Painted markers cannot
    // pass through one another while that easing is underway.
    resolveCollisions(work, movable, 12, pinned, marker, 2)
    finishClearance(work, movable, marker, 2)
    for (const id of movable) {
      const n = byId.get(id)!,
        safe = work.get(id)!
      if (Math.hypot(safe.x - n.x, safe.y - n.y) < 0.01) continue
      const motion = motions.get(id)
      n.x = safe.x
      n.y = safe.y
      if (motion) schedule(n, motion.to, Math.max(1 / 120, motion.duration - motion.elapsed), true)
      else {
        targets.set(id, point(n))
        n.vx = n.vy = n.vz = 0
      }
    }
  }

  function dragGoals(id: string, session: DragSession) {
    const dragged = byId.get(id)!
    const work = new Map(
      readable.map((node) => [node.id, { ...(session.origins.get(node.id) ?? point(node)) }]),
    )
    work.set(id, point(dragged))
    const movable = new Set(session.affected)
    const velocity = new Map<string, Point>()
    const dx = dragged.x - session.origin.x,
      dy = dragged.y - session.origin.y,
      distance = Math.hypot(dx, dy)
    const reach = Math.min(fieldForceSettings.neighborReach, distance * 0.12)
    // Collision contact can spread through touching local objects, regardless of
    // whether a mathematical edge exists. Distant unrelated objects never join.
    const contact = () => resolveCollisions(work, movable, 1, id)
    for (let pass = 0; pass < fieldForceSettings.integrationPasses; pass++) {
      for (const other of movable) {
        const node = byId.get(other)!,
          p = work.get(other)!
        const anchor = session.origins.get(other) ?? point(node)
        const force = forces(node)
        const neighbor = session.neighbors.get(other)
        const attraction = neighbor ? force.attraction * neighbor.weight : 0
        const targetX = anchor.x + (distance ? (dx / distance) * reach : 0)
        const targetY = anchor.y + (distance ? (dy / distance) * reach : 0)
        const v = velocity.get(other) ?? { x: 0, y: 0, z: 0 }
        v.x =
          (v.x + ((anchor.x - p.x) * force.anchor + (targetX - p.x) * attraction) / force.mass) *
          force.damping
        v.y =
          (v.y + ((anchor.y - p.y) * force.anchor + (targetY - p.y) * attraction) / force.mass) *
          force.damping
        p.x += clamp(v.x, -20, 20)
        p.y += clamp(v.y, -20, 20)
        velocity.set(other, v)
      }
      contact()
    }
    for (let pass = 0; pass < fieldForceSettings.contactPasses; pass++) contact()
    finishClearance(work, movable)
    session.affected = movable
    for (const other of movable)
      preferredTargets.set(other, { ...(session.origins.get(other) ?? point(byId.get(other)!)) })
    return work
  }

  function drag(id: string, x: number, y: number) {
    const n = byId.get(id)
    if (!n || !activeIDs.has(id) || ![x, y].every(Number.isFinite)) return
    const anchored = manualAnchors.get(id)
    if (dragging.has(id) && anchored?.x === x && anchored.y === y) return
    flushLayout()
    let session = dragging.get(id)
    if (!session) {
      // Direct manipulation takes priority. Unrelated objects freeze where they
      // already are; a pointer does not restart the global layout job.
      const pendingContacts = new Map(
        [...motions].filter(
          ([other, motion]) => other !== id && motion.local && readableIDs.has(other),
        ),
      )
      motions.clear()
      for (const other of nodes) {
        other.vx = other.vy = other.vz = 0
        other.relevance = other.targetRelevance
      }
      const weights = new Map<string, number>()
      for (const edge of links) {
        const other =
          edge.source === id ? edge.target : edge.target === id ? edge.source : undefined
        if (other && readableIDs.has(other) && other !== context.focus && !manualAnchors.has(other))
          weights.set(other, Math.max(weights.get(other) ?? 0, edge.gain))
      }
      const largest = Math.max(...weights.values(), 1e-9)
      session = {
        origin: point(n),
        // Finish previous local contact even if another drag starts before its
        // release transition ends; do not freeze an overlap halfway to safety.
        origins: new Map(
          readable.map((node) => [node.id, point(pendingContacts.get(node.id)?.to ?? node)]),
        ),
        affected: new Set([...weights.keys(), ...pendingContacts.keys()]),
        neighbors: new Map(
          [...weights].map(([other, weight]) => [
            other,
            { origin: pose(byId.get(other)!), weight: weight / largest },
          ]),
        ),
      }
      dragging.set(id, session)
    }
    n.x = x
    n.y = y
    n.vx = n.vy = n.vz = 0
    // Retain the requested point as this object's own target. More recent direct
    // manipulation wins contact, while earlier targets can yield local space.
    manualAnchors.delete(id)
    manualAnchors.set(id, point(n))
    targets.set(id, point(n))
    motions.delete(id)
    const goals = dragGoals(id, session)
    for (const other of session.affected) {
      const candidate = byId.get(other)!
      const duration = 0.22 + 0.04 * Math.sqrt(forces(candidate).mass)
      schedule(
        candidate,
        { ...goals.get(other)!, relevance: candidate.targetRelevance },
        duration,
        true,
      )
    }
    sleeping = motions.size === 0
  }

  function release(id: string) {
    const session = dragging.get(id)
    if (!session) return
    dragging.delete(id)
    // The requested drop target persists. Attraction and geometric contact finish
    // locally with finite damping; neither becomes a continuously running force.
    const n = byId.get(id)!
    n.vx = n.vy = n.vz = 0
    for (const other of session.affected) {
      const motion = motions.get(other)
      if (motion) {
        const candidate = byId.get(other)!
        schedule(candidate, motion.to, 0.32 + 0.04 * Math.sqrt(forces(candidate).mass), true)
      }
    }
    sleeping = motions.size === 0
  }

  function settle(preserveDrag = false) {
    if (!preserveDrag) dragging.clear()
    flushLayout()
    for (const [id, motion] of motions) {
      const n = byId.get(id)!
      Object.assign(n, motion.to)
      n.vx = n.vy = n.vz = 0
    }
    motions.clear()
    sleeping = true
    return snapshot()
  }
  function snapshot(): FieldSnapshot {
    flushLayout()
    return {
      version: 1,
      focus: context.focus,
      nodes: nodes.map((n) => ({ ...n })),
      targets: Object.fromEntries([...targets].map(([id, value]) => [id, { ...value }])),
      preferredTargets: Object.fromEntries(
        [...preferredTargets].map(([id, value]) => [id, { ...value }]),
      ),
      sleeping,
      coolingTime,
      manualAnchors: Object.fromEntries(
        [...manualAnchors].map(([id, value]) => [id, { ...value }]),
      ),
      motions: Object.fromEntries(
        [...motions].map(([id, value]) => [
          id,
          {
            ...value,
            from: { ...value.from },
            to: { ...value.to },
            velocity: { ...value.velocity },
          },
        ]),
      ),
      layout: Object.fromEntries(
        nodes.map((n) => {
          const force = forces(n)
          return [
            n.id,
            {
              ...profiles.get(n.id)!,
              mass: force.mass,
              anchorGain: force.anchor,
              attractionGain: force.attraction,
              repulsionGain: force.repulsion,
              preferredTarget: {
                ...(manualAnchors.get(n.id) ??
                  preferredTargets.get(n.id) ??
                  targets.get(n.id) ??
                  point(n)),
              },
              resolvedTarget: { ...(targets.get(n.id) ?? point(n)) },
              held: dragging.has(n.id),
              readable: readableIDs.has(n.id),
            },
          ]
        }),
      ),
    }
  }
  function restore(saved: FieldSnapshot) {
    if (saved?.version !== 1 || !Array.isArray(saved.nodes))
      throw new Error("Invalid field snapshot")
    if (saved.focus !== context.focus)
      throw new Error("Restore the matching context before restoring its field")
    if (
      saved.coolingTime !== undefined &&
      (!Number.isFinite(saved.coolingTime) || saved.coolingTime < 0)
    )
      throw new Error("Invalid field snapshot cooling time")
    const updates = new Map(saved.nodes.map((n) => [n.id, n]))
    for (const n of nodes) {
      const value = updates.get(n.id)
      if (
        !value ||
        ![
          value.x,
          value.y,
          value.z,
          value.vx,
          value.vy,
          value.vz,
          value.relevance,
          value.radius,
        ].every(Number.isFinite)
      )
        throw new Error(`Invalid field snapshot node: ${n.id}`)
    }
    for (const values of [
      saved.targets ?? {},
      saved.preferredTargets ?? {},
      saved.manualAnchors ?? {},
    ])
      for (const [id, value] of Object.entries(values))
        if (!byId.has(id) || !finitePoint(value))
          throw new Error(`Invalid field snapshot target: ${id}`)
    for (const [id, value] of Object.entries(saved.motions ?? {}))
      if (
        !byId.has(id) ||
        !finitePoint(value.from) ||
        !finitePoint(value.to) ||
        !finitePoint(value.velocity) ||
        ![value.from.relevance, value.to.relevance, value.elapsed, value.duration].every(
          Number.isFinite,
        ) ||
        (value.local !== undefined && typeof value.local !== "boolean") ||
        value.duration <= 0 ||
        value.elapsed < 0 ||
        value.elapsed > value.duration
      )
        throw new Error(`Invalid field snapshot motion: ${id}`)
    dragging.clear()
    motions.clear()
    manualAnchors.clear()
    targets.clear()
    preferredTargets.clear()
    resized.clear()
    fullLayoutPending = false
    compile()
    for (const n of nodes) {
      const value = updates.get(n.id)!
      Object.assign(n, {
        ...point(value),
        vx: value.vx,
        vy: value.vy,
        vz: value.vz,
        relevance: clamp(value.relevance, 0, 1),
        radius: clamp(value.radius, 12, fieldForceSettings.markerRadius),
      })
    }
    for (const [id, value] of Object.entries(saved.targets ?? {})) targets.set(id, { ...value })
    for (const [id, value] of Object.entries(saved.preferredTargets ?? saved.targets ?? {}))
      preferredTargets.set(id, { ...value })
    for (const [id, value] of Object.entries(saved.manualAnchors ?? {}))
      manualAnchors.set(id, { ...value })
    for (const [id, value] of Object.entries(saved.motions ?? {}))
      motions.set(id, {
        ...value,
        from: { ...value.from },
        to: { ...value.to },
        velocity: { ...value.velocity },
      })
    for (const n of nodes) if (!motions.has(n.id)) n.vx = n.vy = n.vz = 0
    coolingTime = saved.coolingTime ?? 0
    // Legacy records have no transition description: retain their exact pose and
    // stop, rather than inventing a fresh 8-second flight on browser back.
    sleeping = motions.size === 0
  }
  compile()
  return { nodes, setContext, step, drag, release, settle, snapshot, restore, setRadius, forces }
}
