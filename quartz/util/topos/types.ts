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
}
export interface Section {
  id: string
  concept: string
  title: string
  level: 1 | 2 | 3
  markdown: string
  children: string[]
}
export interface KnowledgeModel {
  version: 1
  title: string
  initial: string
  concepts: Concept[]
  relations: Relation[]
  sections: Section[]
  sources: { id: string; title: string; url: string }[]
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
