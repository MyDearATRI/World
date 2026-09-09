import type { Concept, KnowledgeModel, Relation } from "./types"
import { topicIDs } from "./topics"

export interface TopicOverviewView {
  page: number
  query: string
  kind: string
}

export interface OverviewEntry {
  concept: Concept
  kind: string
  typeLabel: string
  neighborCount: number
}

export interface OverviewPage {
  title: string
  eligibleIDs: string[]
  total: number
  filtered: number
  page: number
  pages: number
  pageSize: number
  items: OverviewEntry[]
  facets: { kind: string; label: string; count: number }[]
}

export interface OverviewRelation {
  relation: Relation
  target: Concept
  direction: "outgoing" | "incoming"
  onPage: boolean
  inSelection: boolean
}

const labels: Record<string, string> = {
  note: "完整笔记",
  definition: "定义",
  "definition-group": "定义组",
  theorem: "定理",
  lemma: "引理",
  proposition: "命题",
  corollary: "推论",
  proof: "证明",
  "proof-strategy": "证明策略",
  example: "例子",
  observation: "观察",
  question: "问题",
  concept: "概念",
  structure: "结构",
  construction: "构造",
  classification: "分类标题",
  frontier: "前沿方向",
}
// A reading order for the index, not a claim about prerequisite relations.
const kindOrder = [
  "definition",
  "definition-group",
  "concept",
  "structure",
  "construction",
  "theorem",
  "lemma",
  "proposition",
  "corollary",
  "proof",
  "proof-strategy",
  "example",
  "observation",
  "question",
  "note",
  "classification",
  "frontier",
]
const normalized = (text: string) => text.normalize("NFKC").toLowerCase().trim()
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

export function overviewKind(concept: Concept) {
  return concept.objectKind === "note" ? "note" : (concept.mathType ?? concept.kind)
}

export function overviewTypeLabel(kind: string) {
  return labels[kind] ?? kind
}

export function overviewPageSize(width: number) {
  return width < 760 ? 6 : width < 1100 ? 12 : 15
}

/** Navigation groups are presentation; no new mathematical relation is inferred. */
export function createOverviewIndex(model: KnowledgeModel) {
  const byId = new Map(model.concepts.map((concept) => [concept.id, concept]))
  const connections = new Map(model.concepts.map((concept) => [concept.id, [] as Relation[]]))
  for (const relation of model.relations) {
    if (!byId.has(relation.source) || !byId.has(relation.target)) continue
    connections.get(relation.source)!.push(relation)
    if (relation.source !== relation.target) connections.get(relation.target)!.push(relation)
  }
  const entries = model.concepts.map((concept) => ({
    concept,
    kind: overviewKind(concept),
    typeLabel: overviewTypeLabel(overviewKind(concept)),
    neighborCount: new Set(
      connections
        .get(concept.id)!
        .map((relation) => (relation.source === concept.id ? relation.target : relation.source)),
    ).size,
    search: normalized(
      [concept.title, concept.zh, ...(concept.aliases ?? []), ...concept.terms].join(" "),
    ),
  }))
  const rank = (kind: string) => {
    const i = kindOrder.indexOf(kind)
    return i < 0 ? kindOrder.length : i
  }
  entries.sort(
    (a, b) =>
      rank(a.kind) - rank(b.kind) ||
      compare(normalized(a.concept.title), normalized(b.concept.title)) ||
      compare(a.concept.id, b.concept.id),
  )

  function page(
    selection: string[] | undefined,
    view: TopicOverviewView,
    width: number,
  ): OverviewPage {
    const allowed = topicIDs(model, selection)
    const eligible = entries.filter((entry) => allowed.has(entry.concept.id))
    const kinds = new Map<string, number>()
    for (const entry of eligible) kinds.set(entry.kind, (kinds.get(entry.kind) ?? 0) + 1)
    const terms = normalized(view.query).split(/\s+/).filter(Boolean)
    const filtered = eligible.filter(
      (entry) =>
        (!view.kind || view.kind === "all" || entry.kind === view.kind) &&
        terms.every((term) => entry.search.includes(term)),
    )
    const pageSize = overviewPageSize(width)
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const number = Math.max(
      0,
      Math.min(pages - 1, Number.isFinite(view.page) ? Math.floor(view.page) : 0),
    )
    const selected = model.topics?.filter((topic) => selection?.includes(topic.id)) ?? []
    const title =
      selection === undefined
        ? model.mode === "atlas"
          ? "全部数学领域"
          : "全部公开笔记"
        : selection.length === 0
          ? "未选择主题"
          : selected.map((topic) => topic.title).join(" · ") || "所选主题"
    return {
      title,
      eligibleIDs: eligible.map((entry) => entry.concept.id),
      total: eligible.length,
      filtered: filtered.length,
      page: number,
      pages,
      pageSize,
      items: filtered.slice(number * pageSize, (number + 1) * pageSize),
      facets: [...kinds].map(([kind, count]) => ({ kind, label: overviewTypeLabel(kind), count })),
    }
  }

  function relations(id: string, current: OverviewPage): OverviewRelation[] {
    const onPage = new Set(current.items.map((item) => item.concept.id))
    const selected = new Set(current.eligibleIDs)
    return (connections.get(id) ?? []).map((relation) => {
      const outgoing = relation.source === id
      const target = byId.get(outgoing ? relation.target : relation.source)!
      return {
        relation,
        target,
        direction: outgoing ? "outgoing" : "incoming",
        onPage: onPage.has(target.id),
        inSelection: selected.has(target.id),
      }
    })
  }

  return { page, relations }
}
