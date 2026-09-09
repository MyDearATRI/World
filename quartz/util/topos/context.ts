import type {
  Community,
  Context,
  KnowledgeModel,
  Lens,
  Relation,
  RelationType,
  ViewState,
} from "./types"

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
const communityCache = new WeakMap<
  KnowledgeModel,
  Map<Lens, { signature: string; communities: Community[] }>
>()

const cloneCommunities = (communities: Community[]) =>
  communities.map((community) => ({ ...community, members: [...community.members] }))
const emphasis: Record<Lens, Partial<Record<RelationType, number>>> = {
  structural: {
    prerequisite: 1,
    definition: 1,
    generalization: 1,
    specialization: 1,
    equivalence: 0.95,
    dependency: 0.9,
  },
  action: { construction: 1, example: 0.95, representation: 1, analogy: 0.9, definition: 0.9 },
  linear: {
    representation: 1,
    construction: 0.95,
    equivalence: 1,
    duality: 1,
    dependency: 0.95,
    adjunction: 0.95,
  },
}
/** Contextual relevance, not a physical spring constant or a claim about truth. */
export function relationAffinity(relation: Relation, lens: Lens): number {
  return (
    clamp(relation.strength, 0, 1) *
    clamp(relation.lenses[lens] ?? 0.5, 0, 1) *
    (emphasis[lens][relation.type] ?? 0.72)
  )
}

function graph(model: KnowledgeModel, lens: Lens) {
  const ids = new Set(model.concepts.map((c) => c.id)),
    adj = new Map<string, Map<string, number>>()
  for (const id of ids) adj.set(id, new Map())
  for (const edge of model.relations) {
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target) continue
    const weight = relationAffinity(edge, lens)
    if (weight <= 0) continue
    // Multiple descriptions of one pair must not inflate its graph density.
    for (const [a, b] of [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ])
      adj.get(a)!.set(b, Math.max(weight, adj.get(a)!.get(b) ?? 0))
  }
  return adj
}
function hash(value: string) {
  let n = 2166136261
  for (const c of value) n = Math.imul(n ^ c.charCodeAt(0), 16777619)
  return (n >>> 0).toString(36)
}

/** Deterministic weighted modularity agglomeration; no taxonomy/folder input exists here. */
export function deriveCommunities(model: KnowledgeModel, lens: Lens): Community[] {
  // Focus and zoom alter local relevance, not the graph's global modularity.
  // Validate graph semantics so in-place edits cannot leave a stale grouping.
  const signature = JSON.stringify([
    model.concepts.map(({ id, title, terms }) => [id, title, terms]),
    model.relations.map(({ source, target, type, strength, lenses }) => [
      source,
      target,
      type,
      strength,
      lenses,
    ]),
  ])
  const cached = communityCache.get(model)?.get(lens)
  if (cached?.signature === signature) return cloneCommunities(cached.communities)
  const communities = computeCommunities(model, lens)
  const byLens = communityCache.get(model) ?? new Map()
  byLens.set(lens, { signature, communities })
  communityCache.set(model, byLens)
  return cloneCommunities(communities)
}

function computeCommunities(model: KnowledgeModel, lens: Lens): Community[] {
  const adj = graph(model, lens),
    ids = [...adj.keys()].sort(compare)
  const degree = new Map(
    ids.map((id) => [id, [...adj.get(id)!.values()].reduce((a, b) => a + b, 0)]),
  )
  const total = [...degree.values()].reduce((a, b) => a + b, 0) / 2
  if (total <= 0) return []
  const groups = ids.map((id) => [id])
  let merged = true
  while (merged) {
    merged = false
    let bestGain = 1e-9,
      first = -1,
      second = -1
    for (let a = 0; a < groups.length; a++)
      for (let b = a + 1; b < groups.length; b++) {
        let between = 0
        for (const x of groups[a]) for (const y of groups[b]) between += adj.get(x)!.get(y) ?? 0
        if (!between) continue
        const da = groups[a].reduce((sum, id) => sum + degree.get(id)!, 0),
          db = groups[b].reduce((sum, id) => sum + degree.get(id)!, 0)
        const gain = between / total - (da * db) / (2 * total * total)
        if (gain > bestGain) {
          bestGain = gain
          first = a
          second = b
        }
      }
    if (first >= 0) {
      groups[first] = [...groups[first], ...groups[second]].sort(compare)
      groups.splice(second, 1)
      merged = true
    }
  }
  const concepts = new Map(model.concepts.map((c) => [c.id, c]))
  const allTerms = new Map<string, number>()
  for (const c of model.concepts)
    for (const term of new Set(c.terms.map((t) => t.trim().toLowerCase()).filter(Boolean)))
      allTerms.set(term, (allTerms.get(term) ?? 0) + 1)
  return groups
    .filter((g) => g.length >= 2)
    .map((members) => {
      const inside = new Set(members),
        terms = new Map<string, number>()
      let internal = 0,
        outgoing = 0
      for (const id of members) {
        for (const [other, w] of adj.get(id)!)
          if (inside.has(other)) internal += w / 2
          else outgoing += w
        for (const term of new Set(
          concepts
            .get(id)!
            .terms.map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        ))
          terms.set(term, (terms.get(term) ?? 0) + 1)
      }
      const consensus = [...terms]
        .filter(([, n]) => n >= 2)
        .sort((a, b) => {
          const score = (t: [string, number]) =>
            t[1] * Math.log(1 + model.concepts.length / (allTerms.get(t[0]) ?? 1))
          return score(b) - score(a) || compare(a[0], b[0])
        })[0]?.[0]
      const central = [...members].sort(
        (a, b) => degree.get(b)! - degree.get(a)! || compare(a, b),
      )[0]
      const label = consensus
        ? consensus.charAt(0).toUpperCase() + consensus.slice(1)
        : `${concepts.get(central)!.title} neighborhood`
      const density = internal / ((members.length * (members.length - 1)) / 2)
      const retention = internal / (internal + outgoing * 0.5 || 1)
      return {
        id: `community-${hash(members.join("\u0000"))}`,
        members,
        label,
        coherence: clamp(0.5 * density + 0.5 * retention, 0, 1),
      }
    })
    .sort((a, b) => b.coherence - a.coherence || compare(a.id, b.id))
}

/** Every concept survives a context change; semantic distance changes its role and relevance. */
export function deriveContext(model: KnowledgeModel, view: ViewState): Context {
  const adj = graph(model, view.lens)
  const focus = adj.has(view.focus)
    ? view.focus
    : adj.has(model.initial)
      ? model.initial
      : model.concepts[0]?.id
  if (!focus) throw new Error("A knowledge context needs at least one concept")
  const previous = [...view.trail].reverse().find((id) => id !== focus && adj.has(id))
  const scale = clamp(Number.isFinite(view.scale) ? view.scale : 1, 0, 3)
  const fine = scale / 3
  const distance = new Map<string, number>([[focus, 0]]),
    done = new Set<string>()
  while (done.size < adj.size) {
    const next = [...distance]
      .filter(([id]) => !done.has(id))
      .sort((a, b) => a[1] - b[1] || compare(a[0], b[0]))[0]
    if (!next) break
    const [id, d] = next
    done.add(id)
    for (const [target, weight] of adj.get(id)!) {
      const nd = d + 1 / (0.35 + 0.65 * weight)
      if (nd < (distance.get(target) ?? Infinity)) distance.set(target, nd)
    }
  }
  const direct = adj.get(focus)!
  const nodes = model.concepts.map((concept) => {
    const d = distance.get(concept.id) ?? model.concepts.length + 1
    if (concept.id === focus)
      return { id: concept.id, distance: 0, relevance: 1, role: "focus" as const }
    if (concept.id === previous)
      return { id: concept.id, distance: d, relevance: 0.76, role: "previous" as const }
    const strength = direct.get(concept.id) ?? 0
    const isNeighbor = strength >= 0.15
    const relevance = isNeighbor
      ? clamp(0.42 + strength * 0.45 - fine * 0.05, 0.35, 0.91)
      : clamp(0.06 + (1 - fine) * 0.1 + 0.17 * Math.exp(-d * 0.55), 0.04, 0.3)
    return {
      id: concept.id,
      distance: d,
      relevance,
      role: isNeighbor ? ("neighbor" as const) : ("horizon" as const),
    }
  })
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const relations = model.relations.filter((edge) => {
    const a = nodeById.get(edge.source),
      b = nodeById.get(edge.target)
    if (!a || !b) return false
    const affinity = relationAffinity(edge, view.lens)
    const focal = edge.source === focus || edge.target === focus
    if (scale < 0.85) return focal && affinity >= 0.55
    if (focal) return affinity >= 0.17
    if (scale > 1.65) return a.role !== "horizon" && b.role !== "horizon" && affinity >= 0.26
    return a.role !== "horizon" && b.role !== "horizon" && affinity >= 0.5
  })
  return {
    focus,
    previous,
    lens: view.lens,
    scale,
    nodes,
    relations,
    communities: deriveCommunities(model, view.lens),
  }
}
