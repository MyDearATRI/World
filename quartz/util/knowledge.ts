/** Public knowledge contract. All hrefs are relative to the deployed site root. */
export interface KnowledgeOccurrence {
  slug: string
  anchor: string
  href: string
}
export interface KnowledgeObject {
  id: string
  kind: "atom" | "note"
  type: string
  title: string
  href: string
  sourceSlug?: string
  sourceHref?: string
  bookId?: string
  chapterId?: string
  excerpt: string
  text: string
  latex: string[]
  aliases: string[]
  proofStatus?: string
  occurrences?: KnowledgeOccurrence[]
  relatedNotes: string[]
}
export interface KnowledgeRelation {
  id: string
  source: string
  target: string
  type: string
  provenance: "authored" | "reference" | "structure"
  evidenceHref: string
  evidenceText?: string
}
export interface KnowledgeGroup {
  id: string
  title: string
  objectIds: string[]
  bookId?: string
}
export interface KnowledgeIndex {
  version: 1
  snapshotHash: string
  objects: KnowledgeObject[]
  relations: KnowledgeRelation[]
  groups: KnowledgeGroup[]
  aliases?: { id: string; canonicalId: string; href: string }[]
  diagnostics?: { code: string; slug: string; message: string }[]
}
export const atomTypeLabels: Record<string, string> = {
  definition: "定义",
  "definition-group": "定义组",
  theorem: "定理",
  proposition: "命题",
  lemma: "引理",
  corollary: "推论",
  proof: "证明",
  "proof-strategy": "证明策略",
  example: "例子",
  observation: "观察",
  question: "问题",
  reading: "章节研读",
  knowledge: "知识笔记",
  connection: "联系",
  exercise: "习题",
  other: "笔记",
}
/** Breadth-first paths preserve the actual evidence and never invent implications. */
export function findKnowledgePath(
  index: KnowledgeIndex,
  source: string,
  target: string,
): KnowledgeRelation[] | null {
  if (
    !index.objects.some((object) => object.id === source) ||
    !index.objects.some((object) => object.id === target)
  )
    return null
  if (source === target) return []
  const queue: { id: string; path: KnowledgeRelation[] }[] = [{ id: source, path: [] }]
  const seen = new Set([source])
  while (queue.length) {
    const current = queue.shift()!
    for (const edge of index.relations) {
      const next =
        edge.source === current.id
          ? edge.target
          : edge.target === current.id
            ? edge.source
            : undefined
      if (!next || seen.has(next)) continue
      const path = [...current.path, edge]
      if (next === target) return path
      seen.add(next)
      queue.push({ id: next, path })
    }
  }
  return null
}
