import type { Context, FieldNode, KnowledgeModel, RelationType } from "./types"
import { relationAffinity } from "./context"

export interface FieldSnapshot {
  version: 1
  focus: string
  nodes: FieldNode[]
  targets?: Record<string, { x: number; y: number; z: number }>
  sleeping?: boolean
  coolingTime?: number
}
interface Target {
  x: number
  y: number
  z: number
  relevance: number
  role: Context["nodes"][number]["role"]
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

/** Pure, damped 2.5D field. Positions are persistent state; contexts change forces only. */
export function createField(model: KnowledgeModel, initial: Context) {
  let context = initial
  const initialRoles = new Map(initial.nodes.map((n) => [n.id, n]))
  const nodes: FieldNode[] = model.concepts.map((concept, i) => {
    const role = initialRoles.get(concept.id)!,
      angle = seed(concept.id) * Math.PI * 2
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
  const byId = new Map(nodes.map((n) => [n.id, n])),
    targets = new Map<string, Target>(),
    pinned = new Map<string, { x: number; y: number }>()
  let sleeping = false
  let coolingTime = 0
  let links: { source: FieldNode; target: FieldNode; gain: number }[] = []
  const getRadius = (node: FieldNode) => clamp(node.radius, 12, 600)

  function updateTargets() {
    const focus = byId.get(context.focus)!
    const roles = new Map(context.nodes.map((n) => [n.id, n]))
    const near = context.nodes.filter((n) => n.role === "neighbor" || n.role === "previous")
    // Preserve approach directions. Springs and collision forces may reorganize these;
    // the model is not assigned to a ring of predetermined angular slots.
    const angleById = new Map(
      near.map((item) => {
        const n = byId.get(item.id)!
        return [item.id, Math.atan2(n.y - focus.y, n.x - focus.x)]
      }),
    )
    for (const n of nodes) {
      const r = roles.get(n.id)
      if (!r) continue
      const angle = angleById.get(n.id) ?? Math.atan2(n.y - focus.y, n.x - focus.x)
      const minimum = getRadius(focus) + getRadius(n) + 105
      const preferred =
        r.role === "focus"
          ? 0
          : r.role === "previous"
            ? Math.max(315, minimum)
            : r.role === "neighbor"
              ? Math.max(230 + (1 - r.relevance) * 190, minimum)
              : 660 + (1 - r.relevance) * 200
      targets.set(n.id, {
        x: Math.cos(angle) * preferred,
        y: Math.sin(angle) * preferred * 0.8,
        z:
          r.role === "focus"
            ? 0
            : r.role === "previous"
              ? -28
              : r.role === "neighbor"
                ? -45 - (1 - r.relevance) * 70
                : -230 - (1 - r.relevance) * 100,
        relevance: r.relevance,
        role: r.role,
      })
      n.targetRelevance = r.relevance
      n.mass = r.role === "focus" ? 4 : 1
    }
    links = model.relations.flatMap((edge) => {
      const source = byId.get(edge.source),
        target = byId.get(edge.target)
      if (!source || !target || source === target) return []
      const affinity = relationAffinity(edge, context.lens)
      const relevance = Math.min(
        roles.get(source.id)?.relevance ?? 0,
        roles.get(target.id)?.relevance ?? 0,
      )
      return [{ source, target, gain: affinity * (physicalGain[edge.type] ?? 0.65) * relevance }]
    })
    sleeping = false
    coolingTime = 0
  }
  function setContext(next: Context) {
    if (!byId.has(next.focus)) throw new Error(`Unknown field focus: ${next.focus}`)
    const ids = new Set(next.nodes.map((n) => n.id))
    if (nodes.some((n) => !ids.has(n.id)))
      throw new Error("A context must retain every concept in the field")
    context = next
    updateTargets()
  }
  function setRadius(id: string, radius: number) {
    const n = byId.get(id)
    if (!n || !Number.isFinite(radius)) return
    const next = clamp(radius, 12, 600)
    if (Math.abs(next - n.radius) < 0.1) return
    n.radius = next
    updateTargets()
  }

  function integrate(dt: number) {
    if (!pinned.size) coolingTime += dt
    // The first three seconds permit structural relaxation; the following five
    // gently remove residual force. Damping completes the motion without a snap.
    const cooling = clamp((coolingTime - 3) / 5, 0, 1),
      heat = 1 - cooling * cooling * (3 - 2 * cooling)
    const force = new Map(nodes.map((n) => [n.id, { x: 0, y: 0, z: 0 }]))
    const focus = byId.get(context.focus)!
    for (const n of nodes) {
      const t = targets.get(n.id)!,
        f = force.get(n.id)!
      const attraction =
        t.role === "focus" ? 36 : t.role === "previous" ? 9 : t.role === "neighbor" ? 9 : 5.5
      if (t.role === "focus" || t.role === "previous") {
        f.x += (t.x - n.x) * attraction * n.mass
        f.y += (t.y - n.y) * attraction * n.mass
      } else {
        // Relevance supplies a radial potential; a much weaker directional memory
        // keeps continuity while typed edges can change angular organization.
        const currentRadius = Math.hypot(n.x, n.y / 0.8) || 0.01,
          targetRadius = Math.hypot(t.x, t.y / 0.8),
          radialForce = (targetRadius - currentRadius) * attraction,
          memory = t.role === "neighbor" ? 2 : 1.8
        f.x += ((n.x / currentRadius) * radialForce + (t.x - n.x) * memory) * n.mass
        f.y += ((n.y / currentRadius) * radialForce + (t.y - n.y) * memory) * n.mass
      }
      f.z += (t.z - n.z) * 11 * n.mass
      // Unfolding changes excluded area, including nodes whose relevance is receding.
      if (n !== focus) {
        const dx = n.x - focus.x,
          dy = n.y - focus.y,
          d = Math.hypot(dx, dy) || 0.01,
          min = getRadius(focus) + getRadius(n) + 38
        if (d < min) {
          const push = (min - d) * 36
          f.x += (dx / d) * push
          f.y += (dy / d) * push
        }
      }
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = b.x - a.x,
          dy = b.y - a.y,
          d = Math.hypot(dx, dy)
        const angle = d < 0.01 ? seed(`${a.id}:${b.id}`) * Math.PI * 2 : 0,
          ux = d < 0.01 ? Math.cos(angle) : dx / d,
          uy = d < 0.01 ? Math.sin(angle) : dy / d
        const min = getRadius(a) + getRadius(b) + 24
        const collision = Math.max(0, min - d) * 32
        const repulsion =
          (160000 / (d * d + 2500)) * Math.max(0.08, Math.min(a.relevance, b.relevance))
        const amount = collision + repulsion
        if (a.id !== context.focus) {
          force.get(a.id)!.x -= ux * amount
          force.get(a.id)!.y -= uy * amount
        }
        if (b.id !== context.focus) {
          force.get(b.id)!.x += ux * amount
          force.get(b.id)!.y += uy * amount
        }
      }
    for (const { source: a, target: b, gain } of links) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy) || 0.01
      const rest = getRadius(a) + getRadius(b) + 125
      const amount = (d - rest) * gain * 2.4
      // Opposition remains eligible for informative adjacency, never an automatic repulsion.
      if (a.id !== context.focus) {
        force.get(a.id)!.x += (dx / d) * amount
        force.get(a.id)!.y += (dy / d) * amount
      }
      if (b.id !== context.focus) {
        force.get(b.id)!.x -= (dx / d) * amount
        force.get(b.id)!.y -= (dy / d) * amount
      }
    }
    for (const community of context.communities) {
      const members = community.members.map((id) => byId.get(id)).filter((n): n is FieldNode => !!n)
      const total = members.reduce((sum, n) => sum + n.relevance, 0)
      if (!total) continue
      const cx = members.reduce((sum, n) => sum + n.x * n.relevance, 0) / total,
        cy = members.reduce((sum, n) => sum + n.y * n.relevance, 0) / total
      for (const n of members) {
        if (n.id === context.focus) continue
        const gain = community.coherence * n.relevance * 0.7
        force.get(n.id)!.x += (cx - n.x) * gain
        force.get(n.id)!.y += (cy - n.y) * gain
      }
    }
    let activity = 0
    const damping = Math.exp(-7.8 * dt),
      blend = 1 - Math.exp(-4.2 * dt)
    for (const n of nodes) {
      const f = force.get(n.id)!,
        pin = pinned.get(n.id)
      if (pin) {
        n.x = pin.x
        n.y = pin.y
        n.vx = n.vy = 0
      } else {
        n.vx = clamp((n.vx + (f.x / n.mass) * dt * heat) * damping, -1100, 1100)
        n.vy = clamp((n.vy + (f.y / n.mass) * dt * heat) * damping, -1100, 1100)
        n.x += n.vx * dt
        n.y += n.vy * dt
      }
      n.vz = clamp((n.vz + (f.z / n.mass) * dt * heat) * damping, -600, 600)
      n.z += n.vz * dt
      const delta = n.targetRelevance - n.relevance
      n.relevance += delta * blend
      activity = Math.max(
        activity,
        Math.abs(n.vx),
        Math.abs(n.vy),
        Math.abs(n.vz),
        Math.abs(delta) * 100,
      )
    }
    return activity
  }
  function step(dtSeconds: number): boolean {
    if (sleeping) return false
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return true
    const dt = Math.min(dtSeconds, 0.1),
      steps = Math.max(1, Math.ceil(dt / (1 / 120)))
    let activity = 0
    for (let i = 0; i < steps; i++) activity = integrate(dt / steps)
    if (activity < 0.08 && !pinned.size) {
      for (const n of nodes) {
        n.vx = n.vy = n.vz = 0
        n.relevance = n.targetRelevance
      }
      sleeping = true
      return false
    }
    return true
  }
  function drag(id: string, x: number, y: number) {
    const n = byId.get(id)
    if (!n || ![x, y].every(Number.isFinite)) return
    pinned.set(id, { x, y })
    n.x = x
    n.y = y
    n.vx = n.vy = 0
    sleeping = false
    coolingTime = 0
  }
  function release(id: string) {
    pinned.delete(id)
    sleeping = false
    coolingTime = 0
  }
  function settle() {
    pinned.clear()
    for (let i = 0; i < 2400; i++) if (!step(1 / 60)) break
    return snapshot()
  }
  function snapshot(): FieldSnapshot {
    return {
      version: 1,
      focus: context.focus,
      nodes: nodes.map((n) => ({ ...n })),
      targets: Object.fromEntries([...targets].map(([id, t]) => [id, { x: t.x, y: t.y, z: t.z }])),
      sleeping,
      coolingTime,
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
      const target = saved.targets?.[n.id]
      if (target && ![target.x, target.y, target.z].every(Number.isFinite))
        throw new Error(`Invalid field snapshot target: ${n.id}`)
    }
    pinned.clear()
    for (const n of nodes) {
      const value = updates.get(n.id)!
      Object.assign(n, {
        x: value.x,
        y: value.y,
        z: value.z,
        vx: value.vx,
        vy: value.vy,
        vz: value.vz,
        relevance: clamp(value.relevance, 0, 1),
        radius: clamp(value.radius, 12, 600),
      })
    }
    updateTargets()
    for (const [id, value] of Object.entries(saved.targets ?? {})) {
      const target = targets.get(id)
      if (target) Object.assign(target, value)
    }
    sleeping = saved.sleeping === true
    coolingTime = saved.coolingTime ?? 0
  }
  updateTargets()
  return { nodes, setContext, step, drag, release, settle, snapshot, restore, setRadius }
}
