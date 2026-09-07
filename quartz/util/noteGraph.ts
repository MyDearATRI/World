import { resolveRelative, simplifySlug, type FullSlug, type SimpleSlug } from "./path"

export interface NoteGraphFile {
  slug?: FullSlug
  frontmatter?: {
    title?: string
    siteKind?: string
    status?: unknown
    layer?: unknown
    sample?: unknown
  }
  links?: readonly SimpleSlug[]
}

export interface NoteGraphNode {
  id: string
  title: string
  href: string
  current: boolean
  kind: NoteGraphKind
  status?: string
  layer?: string
}

export type NoteGraphKind = "body" | "plan" | "example" | "navigation"
export type NoteGraphFilter = "all" | Exclude<NoteGraphKind, "navigation">

export interface NoteGraphLink {
  source: string
  target: string
}

export interface NoteGraphData {
  nodes: NoteGraphNode[]
  links: NoteGraphLink[]
}

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Build a graph from already-published content metadata, without following missing links. */
export function buildNoteGraph(
  files: readonly NoteGraphFile[],
  currentSlug: FullSlug,
): NoteGraphData {
  const published = files
    .filter(
      (file): file is NoteGraphFile & { slug: FullSlug } =>
        Boolean(file.slug) && file.frontmatter?.siteKind !== "canvas",
    )
    .toSorted(
      (a, b) =>
        compare(a.slug, b.slug) ||
        compare(a.frontmatter?.title ?? a.slug, b.frontmatter?.title ?? b.slug),
    )
  const nodesById = new Map<string, NoteGraphNode>()
  const idsBySimpleSlug = new Map<string, string>()

  for (const file of published) {
    if (nodesById.has(file.slug)) continue
    nodesById.set(file.slug, {
      id: file.slug,
      title: file.frontmatter?.title ?? file.slug,
      href: resolveRelative(currentSlug, file.slug),
      current: file.slug === currentSlug,
      kind: ["body", "plan", "example", "navigation"].includes(file.frontmatter?.siteKind ?? "")
        ? (file.frontmatter!.siteKind as NoteGraphKind)
        : file.frontmatter?.sample
          ? "example"
          : "body",
      ...(typeof file.frontmatter?.status === "string" ? { status: file.frontmatter.status } : {}),
      ...(typeof file.frontmatter?.layer === "string" ? { layer: file.frontmatter.layer } : {}),
    })
    idsBySimpleSlug.set(simplifySlug(file.slug), file.slug)
  }

  const linksByPair = new Map<string, NoteGraphLink>()
  for (const file of published) {
    for (const linkedSlug of file.links ?? []) {
      // Quartz represents the home note as "/"; accept the equivalent empty root slug.
      const linkedId = idsBySimpleSlug.get(linkedSlug === "" ? "/" : linkedSlug)
      if (linkedId === undefined || linkedId === file.slug) continue
      const [source, target] =
        compare(file.slug, linkedId) < 0 ? [file.slug, linkedId] : [linkedId, file.slug]
      linksByPair.set(JSON.stringify([source, target]), { source, target })
    }
  }

  return {
    nodes: [...nodesById.values()],
    links: [...linksByPair.values()].sort(
      (a, b) => compare(a.source, b.source) || compare(a.target, b.target),
    ),
  }
}

/** Scope and type filters only remove published nodes; they never follow new targets. */
export function filterNoteGraph(
  graph: NoteGraphData,
  currentId: string | undefined,
  scope: "local" | "global",
  kind: NoteGraphFilter,
): NoteGraphData {
  const adjacent = new Set<string>()
  if (currentId) {
    adjacent.add(currentId)
    for (const edge of graph.links) {
      if (edge.source === currentId) adjacent.add(edge.target)
      if (edge.target === currentId) adjacent.add(edge.source)
    }
  }
  const nodes = graph.nodes.filter(
    (node) =>
      (scope === "global" || adjacent.has(node.id)) && (kind === "all" || node.kind === kind),
  )
  const ids = new Set(nodes.map((node) => node.id))
  return {
    nodes,
    links: graph.links.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  }
}
