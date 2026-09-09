import { deriveContext } from "./context"
import type { Context, KnowledgeModel, ViewState } from "./types"

/** Union, not duplication: an object belongs to any of the selected themes. */
export function topicIDs(model: KnowledgeModel, selection?: string[]) {
  if (selection === undefined) return new Set(model.concepts.map((node) => node.id))
  const chosen = new Set(selection)
  return new Set(
    model.concepts
      .filter((node) => node.topicIDs?.some((id) => chosen.has(id)))
      .map((node) => node.id),
  )
}

export function topicContext(model: KnowledgeModel, state: ViewState): Context {
  if (!model.topics || state.topics === undefined) return deriveContext(model, state)
  const visible = topicIDs(model, state.topics)
  const filtered = {
    ...model,
    concepts: model.concepts.filter((n) => visible.has(n.id)),
    relations: model.relations.filter((r) => visible.has(r.source) && visible.has(r.target)),
  }
  const partial = visible.has(state.focus) ? deriveContext(filtered, state) : undefined
  const roles = new Map(partial?.nodes.map((node) => [node.id, node]))
  if (model.mode === "atlas" && partial && state.scale < 1.7) {
    // Collections remain readable across disconnected areas; this adds no mathematical edge.
    for (const node of filtered.concepts)
      if (node.id !== state.focus) {
        const role = roles.get(node.id)!
        roles.set(node.id, {
          ...role,
          role: "neighbor",
          relevance: Math.max(
            role.relevance,
            model.topics.some((topic) => topic.id === node.id) ? 0.92 : 0.46,
          ),
        })
      }
  }
  return {
    focus: state.focus,
    previous: partial?.previous,
    lens: state.lens,
    scale: state.scale,
    nodes: model.concepts.map(
      (node) =>
        roles.get(node.id) ?? {
          id: node.id,
          relevance: 0,
          distance: Infinity,
          role: "horizon" as const,
        },
    ),
    relations:
      model.mode === "atlas" && state.scale < 1.7 ? filtered.relations : (partial?.relations ?? []),
    communities: partial?.communities ?? [],
    visibleIDs: [...visible],
  }
}
