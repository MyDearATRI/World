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

/** Keep English words intact; Chinese characters can wrap individually. */
export function wrapGraphTitle(
  title: string,
  limit: number,
  measureWidth: (text: string) => number,
): string[] {
  const lines: string[] = []
  let line = "",
    space = false
  for (const token of title.match(/\s+|\p{Script=Han}|[^\s\p{Script=Han}]+/gu) ?? []) {
    if (/^\s+$/u.test(token)) {
      space = true
      continue
    }
    const candidate = line + (line && space ? " " : "") + token
    space = false
    if (measureWidth(candidate) <= limit) {
      line = candidate
      continue
    }
    if (line) lines.push(line)
    line = ""
    // Character wrapping is reserved for a token wider than the entire line.
    for (const character of Array.from(token)) {
      if (line && measureWidth(line + character) > limit) {
        lines.push(line)
        line = ""
      }
      line += character
    }
  }
  if (line) lines.push(line)
  return lines
}

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

export interface ReaderGraphCatalog {
  books: {
    id: string
    title: string
    slug: string
    chapters: {
      id: string
      title: string
      slug: string
      sections: { slug: string }[]
      knowledge: string[]
      connections: string[]
      exercises: string[]
      canvas: string[]
    }[]
  }[]
  pages: Record<
    string,
    {
      slug: string
      title: string
      bookId?: string
      chapterId?: string
      role: string
      auxiliary: boolean
    }
  >
}
export interface ReaderGraphNode {
  id: string
  title: string
  href: string
  chapterId: string
  role: string
  current: boolean
}
export interface ReaderGraphData {
  book: { id: string; title: string; href: string }
  chapters: { id: string; title: string; href: string; knowledge: string[] }[]
  nodes: ReaderGraphNode[]
  links: NoteGraphLink[]
  initialChapterId?: string
  initialFocusId?: string
}

/** Hierarchy comes from the publication catalog; ordinary links remain ordinary references. */
export function buildReaderGraph(
  files: readonly NoteGraphFile[],
  currentSlug: FullSlug,
  catalog: ReaderGraphCatalog,
  options: { bookId?: string; chapterId?: string; focusCurrent?: boolean } = {},
): ReaderGraphData | undefined {
  const current = catalog.pages[currentSlug]
  const book = catalog.books.find((entry) => entry.id === (options.bookId ?? current?.bookId))
  if (!book) return undefined
  const raw = buildNoteGraph(files, currentSlug)
  const rawById = new Map(raw.nodes.map((node) => [node.id, node]))
  const nodes = new Map<string, ReaderGraphNode>()
  for (const chapter of book.chapters) {
    const allowed = [
      ...chapter.sections.map((section) => section.slug),
      ...chapter.knowledge,
      ...chapter.connections,
      ...chapter.exercises,
    ]
    for (const slug of allowed) {
      const page = catalog.pages[slug],
        source = rawById.get(slug)
      if (!page || page.auxiliary || !source || chapter.canvas.includes(slug)) continue
      nodes.set(slug, {
        id: slug,
        title: page.title,
        href: source.href,
        chapterId: chapter.id,
        role: page.role,
        current: slug === currentSlug,
      })
    }
  }
  const chapterId = options.chapterId ?? current?.chapterId
  const initialChapterId = book.chapters.some((chapter) => chapter.id === chapterId)
    ? chapterId
    : undefined
  return {
    book: {
      id: book.id,
      title: book.title,
      href: resolveRelative(currentSlug, book.slug as FullSlug),
    },
    chapters: book.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      href: resolveRelative(currentSlug, chapter.slug as FullSlug),
      knowledge: chapter.knowledge.filter((id) => nodes.has(id)),
    })),
    nodes: [...nodes.values()],
    links: raw.links.filter((link) => nodes.has(link.source) && nodes.has(link.target)),
    ...(initialChapterId ? { initialChapterId } : {}),
    ...(options.focusCurrent && current?.role === "knowledge" && nodes.has(currentSlug)
      ? { initialFocusId: currentSlug }
      : {}),
  }
}

export function readerChapterGraph(data: ReaderGraphData, chapterId: string, focusId?: string) {
  const chapter = data.chapters.find((entry) => entry.id === chapterId)
  if (!chapter)
    return { nodes: [], links: [], crossChapter: [] } as {
      nodes: ReaderGraphNode[]
      links: NoteGraphLink[]
      crossChapter: ReaderGraphNode[]
    }
  const focus = chapter.knowledge.includes(focusId ?? "") ? focusId : undefined
  const neighbours = new Set(focus ? [focus] : [])
  if (focus)
    for (const link of data.links) {
      if (link.source === focus) neighbours.add(link.target)
      if (link.target === focus) neighbours.add(link.source)
    }
  const visible = new Set(
    focus
      ? data.nodes
          .filter((node) => node.chapterId === chapterId && neighbours.has(node.id))
          .map((node) => node.id)
      : chapter.knowledge,
  )
  return {
    nodes: data.nodes.filter((node) => visible.has(node.id)),
    links: data.links.filter(
      (link) =>
        visible.has(link.source) &&
        visible.has(link.target) &&
        (!focus || link.source === focus || link.target === focus),
    ),
    crossChapter: focus
      ? data.nodes.filter((node) => node.chapterId !== chapterId && neighbours.has(node.id))
      : [],
  }
}
