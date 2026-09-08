import { atomTypeLabels, type KnowledgeObject, type KnowledgeGroup } from "./knowledge"

/** Browser-safe geometry and relationship traversal. No inferred mathematical edges. */
export type GraphObject = KnowledgeObject

export interface GraphRelation {
  id: string
  source: string
  target: string
  type: string
  provenance: "authored" | "reference" | "structure" | "similarity"
  evidenceHref?: string
  evidenceText?: string
  score?: number
}

export type GraphGroup = KnowledgeGroup

export interface GraphIndex {
  objects: GraphObject[]
  relations: GraphRelation[]
  groups: GraphGroup[]
}

export interface GraphPosition {
  x: number
  y: number
  width: number
  height: number
}

export interface KnowledgeGraphState {
  groupId?: string
  focusId?: string
  type: string
  layers: GraphRelation["provenance"][]
  expanded: string[]
  positions: Record<string, GraphPosition>
  camera: { x: number; y: number; k: number }
}

export const knowledgeTypeLabels: Record<string, string> = {
  ...atomTypeLabels,
  definition: "定义",
  "definition-group": "定义组",
  theorem: "定理",
  lemma: "引理",
  proposition: "命题",
  corollary: "推论",
  proof: "证明",
  "proof-strategy": "证明策略",
  example: "例子",
  counterexample: "反例",
  exercise: "习题",
  remark: "注记",
  insight: "观察",
  note: "完整笔记",
}

export function graphTypeLabel(type: string): string {
  return knowledgeTypeLabels[type] ?? type
}

/** Select an intact source formula, preferring a relation over an isolated variable. */
export function selectKnowledgeFormula(
  expressions: readonly string[],
  maxLength = 180,
): string | undefined {
  const candidates = expressions.filter(
    (expression) =>
      expression.trim() && expression.length <= maxLength && expression.split("\n").length <= 3,
  )
  const score = (expression: string) => {
    const relation =
      /[=<>≤≥→↔∈]|\\(?:leq?|geq?|subset(?:eq)?|supset(?:eq)?|to|rightarrow|leftrightarrow|iff|implies|in|notin|equiv|cong|mapsto)\b/.test(
        expression,
      )
    return (relation ? 1000 : 0) + expression.length
  }
  return [...candidates].sort((a, b) => score(b) - score(a))[0]
}

export interface KnowledgeExcerptPart {
  kind: "text" | "math"
  text: string
}

/** Parse only complete dollar-delimited formulas. Other input always remains inert text. */
export function splitKnowledgeExcerpt(source: string): KnowledgeExcerptPart[] {
  const parts: KnowledgeExcerptPart[] = []
  const clean = (text: string) =>
    text
      .replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_match, target: string, alias?: string) => alias ?? target,
      )
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/(`+)(.*?)\1/g, "$2")
      .replace(/(\*\*|__)(.*?)\1/g, "$2")
      .replace(/^\s*(?:#+|>)\s+/gm, "")
      .replace(/\$/g, "")
  const matcher = /(\${1,2})([^$]+?)\1/g
  let cursor = 0
  for (const match of source.matchAll(matcher)) {
    if (match.index > cursor)
      parts.push({ kind: "text", text: clean(source.slice(cursor, match.index)) })
    parts.push({ kind: "math", text: match[2] })
    cursor = match.index + match[0].length
  }
  if (cursor < source.length) parts.push({ kind: "text", text: clean(source.slice(cursor)) })
  return parts
}

/** Approximate mixed-script line width; UI passes actual measured text when available. */
export function measureGraphLabel(text: string): number {
  return [...text].reduce((width, char) => width + (/[^\u0000-\u00ff]/.test(char) ? 14 : 7.2), 0)
}

export function graphObjectSize(
  object: Pick<GraphObject, "title" | "excerpt" | "latex">,
  measure = measureGraphLabel,
): { width: number; height: number } {
  const width = Math.min(328, Math.max(250, measure(object.title) + 40))
  const titleLines = Math.max(1, Math.ceil(measure(object.title) / (width - 36)))
  return { width, height: 112 + Math.min(titleLines, 5) * 22 + (object.latex.length ? 60 : 0) }
}

/** Stable packing: cached nodes never move when filters or new content change. */
export function layoutKnowledgeGroups(
  objects: GraphObject[],
  groups: GraphGroup[],
  cache: Record<string, GraphPosition> = {},
  measure = measureGraphLabel,
): { positions: Record<string, GraphPosition>; bounds: Record<string, GraphPosition> } {
  const byId = new Map(objects.filter((object) => object.kind === "atom").map((o) => [o.id, o]))
  const positions: Record<string, GraphPosition> = {}
  const bounds: Record<string, GraphPosition> = {}
  let nextX = 0
  for (const group of groups) {
    const groupObjects = group.objectIds.map((id) => byId.get(id)).filter((o) => o !== undefined)
    if (!groupObjects.length) continue
    const columns = Math.max(2, Math.min(5, Math.ceil(Math.sqrt(groupObjects.length))))
    const placed: GraphPosition[] = []
    const cells = groupObjects.map((o) => ({ object: o, ...graphObjectSize(o, measure) }))
    const cellWidth = Math.max(...cells.map((c) => c.width)) + 46
    const cellHeight = Math.max(...cells.map((c) => c.height)) + 50
    const originX = nextX + 48
    const originY = 112
    for (const cell of cells) {
      if (positions[cell.object.id]) continue
      const saved = cache[cell.object.id]
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        const position = { x: saved.x, y: saved.y, width: cell.width, height: cell.height }
        positions[cell.object.id] = position
        placed.push(position)
      }
    }
    let freeCell = 0
    for (const cell of cells) {
      if (positions[cell.object.id]) continue
      let position: GraphPosition
      do {
        position = {
          x: originX + (freeCell % columns) * cellWidth,
          y: originY + Math.floor(freeCell / columns) * cellHeight,
          width: cell.width,
          height: cell.height,
        }
        freeCell++
      } while (placed.some((other) => rectanglesOverlap(position, other, 24)))
      positions[cell.object.id] = position
      placed.push(position)
    }
    const extent = graphBounds(groupObjects.map((object) => positions[object.id]))
    bounds[group.id] = {
      x: extent.x - 40,
      y: extent.y - 84,
      width: extent.width + 80,
      height: extent.height + 124,
    }
    nextX = Math.max(nextX, bounds[group.id].x + bounds[group.id].width + 100)
  }
  return { positions, bounds }
}

export function rectanglesOverlap(a: GraphPosition, b: GraphPosition, gap = 0): boolean {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  )
}

export function graphBounds(positions: GraphPosition[]): GraphPosition {
  if (!positions.length) return { x: 0, y: 0, width: 800, height: 500 }
  const x = Math.min(...positions.map((p) => p.x))
  const y = Math.min(...positions.map((p) => p.y))
  return {
    x,
    y,
    width: Math.max(...positions.map((p) => p.x + p.width)) - x,
    height: Math.max(...positions.map((p) => p.y + p.height)) - y,
  }
}

export interface RelationPathStep {
  from: string
  to: string
  relation: GraphRelation
  reversed: boolean
}

/** Undirected exploration records direction on each step; a path is never a proof. */
export function findKnowledgePath(
  source: string,
  target: string,
  objects: Pick<GraphObject, "id">[],
  relations: GraphRelation[],
  includeSimilarity = false,
): RelationPathStep[] | null {
  const ids = new Set(objects.map((object) => object.id))
  if (!ids.has(source) || !ids.has(target)) return null
  if (source === target) return []
  const adjacency = new Map<string, RelationPathStep[]>()
  for (const relation of [...relations].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!ids.has(relation.source) || !ids.has(relation.target)) continue
    if (relation.provenance === "similarity" && !includeSimilarity) continue
    const forward = { from: relation.source, to: relation.target, relation, reversed: false }
    const reverse = { from: relation.target, to: relation.source, relation, reversed: true }
    adjacency.set(forward.from, [...(adjacency.get(forward.from) ?? []), forward])
    adjacency.set(reverse.from, [...(adjacency.get(reverse.from) ?? []), reverse])
  }
  const visited = new Set([source])
  const queue: string[] = [source]
  const previous = new Map<string, RelationPathStep>()
  for (let i = 0; i < queue.length; i++) {
    for (const step of adjacency.get(queue[i]) ?? []) {
      if (visited.has(step.to)) continue
      visited.add(step.to)
      previous.set(step.to, step)
      if (step.to === target) {
        const path: RelationPathStep[] = []
        let cursor = target
        while (cursor !== source) {
          const edge = previous.get(cursor)!
          path.unshift(edge)
          cursor = edge.from
        }
        return path
      }
      queue.push(step.to)
    }
  }
  return null
}
