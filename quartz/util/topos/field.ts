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
}
export interface FieldSnapshot {
  version: 1
  focus: string
  nodes: FieldNode[]
  targets?: Record<string, Point>
  sleeping?: boolean
  /** Retained for old history records; this is now elapsed transition time, not heat. */
  coolingTime?: number
  manualAnchors?: Record<string, Point>
  motions?: Record<string, Motion>
}
interface Link {
  source: string
  target: string
  gain: number
}
interface DragSession {
  origin: Point
  neighbors: Map<string, { origin: Pose; weight: number }>
}
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
      radius: 52,
      mass: role.role === "focus" ? 4 : 1,
    }
  })
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const targets = new Map<string, Point>()
  const manualAnchors = new Map<string, Point>()
  const dragging = new Map<string, DragSession>()
  const motions = new Map<string, Motion>()
  const resized = new Set<string>()
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
    for (const edge of model.relations) {
      if (!activeIDs.has(edge.source) || !activeIDs.has(edge.target) || edge.source === edge.target)
        continue
      const gain = relationAffinity(edge, context.lens) * (physicalGain[edge.type] ?? 0.65)
      if (gain > 0) links.push({ source: edge.source, target: edge.target, gain })
    }
    for (const role of context.nodes) {
      const n = byId.get(role.id)
      if (!n) continue
      n.targetRelevance = activeIDs.has(n.id) ? role.relevance : 0
      n.mass = role.role === "focus" ? 4 : 1
      if (!activeIDs.has(n.id)) {
        motions.delete(n.id)
        n.vx = n.vy = n.vz = 0
        n.relevance = 0
      }
    }
  }

  function schedule(n: FieldNode, to: Pose, duration: number) {
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
    motions.set(n.id, { from: pose(n), to: { ...to }, velocity, elapsed: 0, duration })
    sleeping = false
  }

  function resolveCollisions(work: Map<string, Point>, movable: Set<string>, passes: number) {
    for (let pass = 0; pass < passes; pass++) {
      let maximum = 0
      for (let i = 0; i < readable.length; i++)
        for (let j = i + 1; j < readable.length; j++) {
          const a = readable[i],
            b = readable[j]
          const moveA = movable.has(a.id),
            moveB = movable.has(b.id)
          if (!moveA && !moveB) continue
          const p = work.get(a.id)!,
            q = work.get(b.id)!
          const dx = q.x - p.x,
            dy = q.y - p.y
          const d = Math.hypot(dx, dy)
          const overlap = a.radius + b.radius + 24 - d
          if (overlap <= 0.05) continue
          maximum = Math.max(maximum, overlap)
          const angle = d < 0.01 ? seed(`${a.id}:${b.id}`) * Math.PI * 2 : 0
          const ux = d < 0.01 ? Math.cos(angle) : dx / d,
            uy = d < 0.01 ? Math.sin(angle) : dy / d
          const amount = overlap / (moveA && moveB ? 2 : 1)
          if (moveA) {
            p.x -= ux * amount
            p.y -= uy * amount
          }
          if (moveB) {
            q.x += ux * amount
            q.y += uy * amount
          }
        }
      if (maximum < 0.1) break
    }
  }

  function finishClearance(work: Map<string, Point>, movable: Set<string>) {
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
          return dx * dx + dy * dy >= (n.radius + node.radius + 23.95) ** 2
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
          const radius = n.radius + node.radius + 24
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
          const right = Math.max(...placed.map(({ node, p: other }) => other.x + node.radius))
          best = { x: right + n.radius + 24, y: p.y }
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
    const movable = new Set(
      readable.filter((n) => n.id !== context.focus && !manualAnchors.has(n.id)).map((n) => n.id),
    )
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
      work.set(n.id, { ...desired })
    }
    // A bounded, deterministic layout job. Edges retain their actual typed gains;
    // node separation is a geometric constraint, not another mathematical relation.
    for (let pass = 0; pass < 24; pass++) {
      for (const n of active)
        if (movable.has(n.id)) {
          const p = work.get(n.id)!,
            desired = preferred.get(n.id)!
          p.x += (desired.x - p.x) * 0.09
          p.y += (desired.y - p.y) * 0.09
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
        if (movable.has(a.id)) {
          p.x += (dx / d) * amount
          p.y += (dy / d) * amount
        }
        if (movable.has(b.id)) {
          q.x -= (dx / d) * amount
          q.y -= (dy / d) * amount
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
            Math.hypot(n.x - changed.x, n.y - changed.y) < n.radius + changed.radius + 24
          )
            movable.add(n.id)
      }
      resized.clear()
      resolveCollisions(work, movable, 16)
      finishClearance(work, movable)
      for (const id of movable) {
        const n = byId.get(id)!
        schedule(n, { ...work.get(id)!, relevance: n.targetRelevance }, 0.5)
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
    const next = clamp(radius, 12, 600)
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
    sleeping = motions.size === 0
    return !sleeping
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
    manualAnchors.set(id, point(n))
    targets.set(id, point(n))
    motions.delete(id)
    const dx = x - session.origin.x,
      dy = y - session.origin.y,
      distance = Math.hypot(dx, dy)
    for (const [other, neighbor] of session.neighbors) {
      if (manualAnchors.has(other)) continue
      const amount = Math.min(18, distance * 0.12) * neighbor.weight
      const target = {
        ...neighbor.origin,
        x: neighbor.origin.x + (distance ? (dx / distance) * amount : 0),
        y: neighbor.origin.y + (distance ? (dy / distance) * amount : 0),
      }
      const candidate = byId.get(other)!
      schedule(candidate, { ...target, relevance: candidate.targetRelevance }, 0.16)
    }
    sleeping = motions.size === 0
  }

  function release(id: string) {
    const session = dragging.get(id)
    if (!session) return
    dragging.delete(id)
    // The drop point is a durable reader-owned anchor, not a spring stretched
    // away from a hidden target. Only the existing local response finishes.
    const n = byId.get(id)!
    n.vx = n.vy = n.vz = 0
    for (const other of session.neighbors.keys()) {
      const motion = motions.get(other)
      if (motion && !manualAnchors.has(other)) schedule(byId.get(other)!, motion.to, 0.3)
    }
    sleeping = motions.size === 0
  }

  function settle() {
    dragging.clear()
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
    for (const values of [saved.targets ?? {}, saved.manualAnchors ?? {}])
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
        value.duration <= 0 ||
        value.elapsed < 0 ||
        value.elapsed > value.duration
      )
        throw new Error(`Invalid field snapshot motion: ${id}`)
    dragging.clear()
    motions.clear()
    manualAnchors.clear()
    targets.clear()
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
        radius: clamp(value.radius, 12, 600),
      })
    }
    for (const [id, value] of Object.entries(saved.targets ?? {})) targets.set(id, { ...value })
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
  return { nodes, setContext, step, drag, release, settle, snapshot, restore, setRadius }
}
