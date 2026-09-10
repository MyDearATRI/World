import type { Concept, KnowledgeModel, Relation } from "./types"
import { topicIDs } from "./topics"

export type ReadingDirection = "incoming" | "outgoing"
export interface ReadingDirectionEntry {
  concept: Concept
  relations: Relation[]
  inSelection: boolean
}
export interface ReadingDirectionsView {
  focus: Concept
  incoming: ReadingDirectionEntry[]
  outgoing: ReadingDirectionEntry[]
  previous?: Concept
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** A directional index of recorded edges. Topic selection orders, never invents or drops links. */
export function createReadingDirectionIndex(model: KnowledgeModel) {
  const concepts = new Map(model.concepts.map((concept) => [concept.id, concept]))
  const connections = new Map(model.concepts.map((concept) => [concept.id, [] as Relation[]]))
  for (const relation of model.relations) {
    if (!concepts.has(relation.source) || !concepts.has(relation.target))
      throw new Error(`Unknown reading direction endpoint: ${relation.id}`)
    connections.get(relation.source)!.push(relation)
    if (relation.target !== relation.source) connections.get(relation.target)!.push(relation)
  }
  return (id: string, selected?: string[], trail: string[] = []): ReadingDirectionsView => {
    const focus = concepts.get(id)
    if (!focus) throw new Error(`Unknown reading direction focus: ${id}`)
    const allowed = topicIDs(model, selected)
    const incoming = new Map<string, ReadingDirectionEntry>()
    const outgoing = new Map<string, ReadingDirectionEntry>()
    const previous = [...trail].reverse().find((item) => item !== id && concepts.has(item))
    for (const relation of connections.get(id)!) {
      // A recorded self-reference appears once on the outgoing side, never twice.
      const isOutgoing = relation.source === id
      const target = isOutgoing ? relation.target : relation.source
      const group = isOutgoing ? outgoing : incoming
      if (!group.has(target))
        group.set(target, {
          concept: concepts.get(target)!,
          relations: [],
          inSelection: allowed.has(target),
        })
      group.get(target)!.relations.push(relation)
    }
    const ordered = (group: Map<string, ReadingDirectionEntry>) =>
      [...group.values()]
        .map((entry) => ({
          ...entry,
          relations: [...entry.relations].sort((a, b) => compare(a.id, b.id)),
        }))
        .sort(
          (a, b) =>
            Number(b.inSelection) - Number(a.inSelection) ||
            Number(b.concept.id === previous) - Number(a.concept.id === previous) ||
            compare(a.concept.title, b.concept.title) ||
            compare(a.concept.id, b.concept.id),
        )
    return {
      focus,
      incoming: ordered(incoming),
      outgoing: ordered(outgoing),
      previous: previous ? concepts.get(previous) : undefined,
    }
  }
}

export function readingDirectionPage(entries: ReadingDirectionEntry[], requested: number) {
  const size = 4
  const pages = Math.max(1, Math.ceil(entries.length / size))
  const page = Math.max(
    0,
    Math.min(pages - 1, Number.isFinite(requested) ? Math.floor(requested) : 0),
  )
  return {
    page,
    pages,
    total: entries.length,
    items: entries.slice(page * size, (page + 1) * size),
  }
}

export function locateReadingDirection(
  view: ReadingDirectionsView,
  target: string,
  preferred?: ReadingDirection,
) {
  const directions: ReadingDirection[] = preferred
    ? [preferred, preferred === "incoming" ? "outgoing" : "incoming"]
    : ["incoming", "outgoing"]
  for (const direction of directions) {
    const index = view[direction].findIndex((entry) => entry.concept.id === target)
    if (index >= 0) return { direction, page: Math.floor(index / 4) }
  }
  return undefined
}

export function readingRelationCategory(relation: Relation) {
  if (relation.provenance === "authored") return { label: "原文论证", color: "#366b91" }
  if (relation.provenance === "reference") return { label: "正文引用", color: "#578273" }
  if (relation.provenance === "structure") return { label: "出处与归属", color: "#877058" }
  return { label: "已记录关系", color: "#687580" }
}
