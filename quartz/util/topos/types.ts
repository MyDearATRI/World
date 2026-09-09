/** Knowledge ontology. No browser, coordinates or page-routing dependencies. */
export type RelationType =
  | "prerequisite"
  | "generalization"
  | "specialization"
  | "analogy"
  | "duality"
  | "equivalence"
  | "construction"
  | "example"
  | "representation"
  | "dependency"
  | "contradiction"
  | "adjunction"
  | "localization"
  | "completion"
  | "categorification"
  | "decategorification"
  | "historical"
  | "definition"
  | "references"
  | "appears-in"
  | "appears-in-section"
  | "proves"

export type Lens = "structural" | "action" | "linear"
export interface Concept {
  id: string
  title: string
  zh: string
  kind: "concept" | "construction" | "example" | "structure"
  summary: string
  symbol: string
  terms: string[]
  sections: string[]
  /** Published identity and provenance; absent on the synthetic demonstration. */
  objectKind?: "atom" | "note"
  mathType?: string
  href?: string
  sourceHref?: string
  sourceTitle?: string
  sourceBook?: string
  sourceStatus?: string
  sourceLayer?: string
  proofStatus?: string
  searchText?: string
  aliases?: string[]
  occurrences?: { slug: string; anchor: string; href: string }[]
  relatedNotes?: string[]
  topicIDs?: string[]
  color?: string
}
export interface Relation {
  id: string
  source: string
  target: string
  type: RelationType
  strength: number
  label: string
  explanation: string
  evidence: string
  lenses: Partial<Record<Lens, number>>
  provenance?: "authored" | "reference" | "structure"
  evidenceHref?: string
}
export interface Section {
  id: string
  concept: string
  title: string
  level: 1 | 2 | 3
  /** Only the website-authored demonstration reads standalone section Markdown. */
  markdown?: string
  children: string[]
  sourceHref?: string
  role?: "summary" | "body" | "context"
}
export interface KnowledgeModel {
  version: 1
  title: string
  initial: string
  concepts: Concept[]
  relations: Relation[]
  sections: Section[]
  sources: { id: string; title: string; url: string }[]
  mode?: "published" | "demo" | "atlas"
  topics?: { id: string; title: string; color: string; description: string }[]
  snapshotHash?: string
  lenses?: { id: Lens; label: string; description?: string }[]
  stats?: { atoms: number; notes: number; unregisteredNotes: number; relations: number }
}
export interface Unfolding {
  concept: string
  section: string
  parent?: string
}
export interface ViewState {
  version: 1
  focus: string
  trail: string[]
  lens: Lens
  scale: number
  unfolded: Unfolding[]
  /** Undefined is the complete collection; [] is an intentional empty selection. */
  topics?: string[]
  /** A named, bounded topic map; omitted while exploring or reading an object. */
  overview?: { page: number; query: string; kind: string; anchor?: string }
}
export interface ContextNode {
  id: string
  relevance: number
  distance: number
  role: "focus" | "previous" | "neighbor" | "horizon"
}
export interface Community {
  id: string
  members: string[]
  label: string
  coherence: number
}
export interface Context {
  focus: string
  previous?: string
  lens: Lens
  scale: number
  nodes: ContextNode[]
  relations: Relation[]
  communities: Community[]
  visibleIDs?: string[]
}
export interface FieldNode {
  id: string
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  relevance: number
  targetRelevance: number
  radius: number
  mass: number
}
