import type { ReaderCatalog } from "./readerCatalog"
import type { GraphIndex, GraphRelation } from "./knowledgeGraph"

export interface ScenePoint {
  x: number
  y: number
  z: number
}
export interface SceneNode {
  id: string
  title: string
  kind: "book" | "chapter" | "section" | "collection" | "atom" | "note"
  type: string
  href?: string
  objectId?: string
  parentId?: string
  bookId?: string
  chapterId?: string
  anchor: ScenePoint
}
export interface KnowledgeScene {
  nodes: SceneNode[]
  roots: string[]
  children: Record<string, string[]>
  memberships: Record<string, string[]>
  treeLinks: { source: string; target: string }[]
}
export interface KnowledgeSceneState {
  version: 2
  scopeId?: string
  focusId?: string
  type: string
  layers: GraphRelation["provenance"][]
  expanded: string[]
  positions: Record<string, ScenePoint>
  camera: { position: number[]; target: number[]; up: number[] }
  cameraViewport?: { width: number; height: number; fullscreen: boolean }
}
export const chapterSceneId = (id: string) => `collection:chapter:${id}`
export const bookSceneId = (id: string) => `collection:book:${id}`
const unique = (values: string[]) => [...new Set(values)]
function seed(id: string) {
  let value = 2166136261
  for (const c of id) value = Math.imul(value ^ c.charCodeAt(0), 16777619)
  return (value >>> 0) / 4294967296
}

/** Rendering-only identity/geometry. Source objects and all many-to-many memberships stay intact. */
export function buildKnowledgeScene(index: GraphIndex, catalog: ReaderCatalog): KnowledgeScene {
  const nodes: SceneNode[] = []
  const roots: string[] = []
  const children: Record<string, string[]> = Object.create(null)
  const memberships: Record<string, string[]> = Object.create(null)
  const byId = new Map<string, SceneNode>()
  const add = (node: SceneNode) => {
    if (byId.has(node.id)) throw new Error(`Duplicate scene identity: ${node.id}`)
    nodes.push(node)
    byId.set(node.id, node)
    if (node.parentId) (children[node.parentId] ??= []).push(node.id)
    else roots.push(node.id)
  }
  const chapterIds = new Map<string, string>()
  let chapterOrder = 0
  for (const book of catalog.books) {
    const bookId = bookSceneId(book.id)
    const bookX = roots.length * 1400
    add({
      id: bookId,
      title: book.title,
      kind: "book",
      type: "书籍",
      href: `${book.slug}.html`,
      bookId: book.id,
      anchor: { x: bookX, y: 300, z: 0 },
    })
    for (const [ci, chapter] of book.chapters.entries()) {
      const chapterId = chapterSceneId(chapter.id)
      chapterIds.set(chapter.id, chapterId)
      const x = bookX + (ci - (book.chapters.length - 1) / 2) * 660
      const z = Math.sin(chapterOrder++ * 2.1) * 180
      add({
        id: chapterId,
        title: chapter.title,
        kind: "chapter",
        type: "章节",
        href: `${chapter.slug}.html`,
        parentId: bookId,
        bookId: book.id,
        chapterId: chapter.id,
        anchor: { x, y: 80, z },
      })
      for (const [si, section] of chapter.sections.entries()) {
        const a = (si / Math.max(1, chapter.sections.length - 1) - 0.5) * Math.PI * 1.25
        add({
          id: `note:${section.slug}`,
          objectId: `note:${section.slug}`,
          title: section.title,
          kind: "section",
          type: "研读节",
          href: `${section.slug}.html`,
          parentId: chapterId,
          bookId: book.id,
          chapterId: chapter.id,
          anchor: {
            x: x + Math.sin(a) * 260,
            y: -180 - Math.cos(a) * 80,
            z: z + Math.cos(a) * 230,
          },
        })
      }
    }
  }
  const sectionIds = new Set(nodes.filter((n) => n.kind === "section").map((n) => n.id))
  for (const object of index.objects) {
    if (sectionIds.has(object.id)) continue
    const actual = index.relations
      .filter(
        (r) =>
          r.source === object.id && r.type === "appears-in-section" && sectionIds.has(r.target),
      )
      .map((r) => r.target)
    const slug = object.sourceSlug ?? (object.id.startsWith("note:") ? object.id.slice(5) : "")
    const fromCatalog =
      object.kind === "note"
        ? (catalog.pages[slug]?.sections ?? [])
            .map((s) => `note:${s}`)
            .filter((id) => sectionIds.has(id))
        : []
    const memberIds = unique([...actual, ...fromCatalog])
    if (!memberIds.length) {
      const chapterId = chapterIds.get(object.chapterId ?? "")
      const fallbackId = chapterId ? `${chapterId}:other` : "collection:other"
      if (!byId.has(fallbackId)) {
        const parent = chapterId ? byId.get(chapterId)! : undefined
        add({
          id: fallbackId,
          title: parent ? "本章其他知识" : "其他公开知识",
          type: "知识集合",
          kind: "collection",
          parentId: chapterId,
          chapterId: object.chapterId,
          bookId: object.bookId,
          anchor: { x: (parent?.anchor.x ?? 0) + 330, y: -240, z: (parent?.anchor.z ?? 0) - 100 },
        })
      }
      memberIds.push(fallbackId)
    }
    memberships[object.id] = memberIds
    // Pick a layout anchor only; all additional memberships remain first-class links.
    const sourceOccurrence = object.occurrences?.find((p) => sectionIds.has(`note:${p.slug}`))
    const preferred =
      sourceOccurrence && memberIds.includes(`note:${sourceOccurrence.slug}`)
        ? `note:${sourceOccurrence.slug}`
        : memberIds[0]
    const anchor = byId.get(preferred)!.anchor
    const angle = seed(object.id) * Math.PI * 2
    const radius = 50 + seed(`${object.id}:radius`) * 105
    add({
      id: object.id,
      objectId: object.id,
      title: object.title,
      type: object.type,
      kind: object.kind,
      href: object.href,
      parentId: preferred,
      bookId: object.bookId,
      chapterId: object.chapterId,
      anchor: {
        x: anchor.x + Math.cos(angle) * radius,
        y: anchor.y - 130 - seed(`${object.id}:height`) * 140,
        z: anchor.z + Math.sin(angle) * radius,
      },
    })
  }
  return {
    nodes,
    roots,
    children,
    memberships,
    treeLinks: nodes.filter((n) => n.parentId).map((n) => ({ source: n.parentId!, target: n.id })),
  }
}

export function sceneScopeNodes(
  scene: KnowledgeScene,
  scopeId?: string,
  focusId?: string,
  expanded: readonly string[] = [],
): SceneNode[] {
  const byId = new Map(scene.nodes.map((n) => [n.id, n]))
  const selected = new Set<string>()
  const scope = scopeId && byId.get(scopeId)
  const addAncestors = (id: string) => {
    let n = byId.get(id)
    while (n) {
      selected.add(n.id)
      n = n.parentId ? byId.get(n.parentId) : undefined
    }
  }
  if (!scope) {
    for (const id of scene.roots) {
      selected.add(id)
      for (const child of scene.children[id] ?? []) selected.add(child)
    }
  } else {
    addAncestors(scope.id)
    for (const id of scene.children[scope.id] ?? []) selected.add(id)
    if (scope.kind === "section" || scope.kind === "collection") {
      for (const n of scene.nodes)
        if (scene.memberships[n.id]?.includes(scope.id)) selected.add(n.id)
    }
  }
  for (const id of expanded)
    if (byId.has(id)) {
      selected.add(id)
      addAncestors(id)
    }
  if (focusId && byId.has(focusId)) addAncestors(focusId)
  return scene.nodes.filter((n) => selected.has(n.id))
}

/** Weights describe physical layout, not truth or prerequisite strength. */
export function sceneLinkStrength(provenance: GraphRelation["provenance"]): number {
  return { authored: 0.24, reference: 0.11, structure: 0.055, similarity: 0.009 }[provenance]
}

export function migrateSceneState(
  saved: unknown,
  scene: KnowledgeScene,
): Partial<KnowledgeSceneState> {
  if (!saved || typeof saved !== "object") return {}
  const value = saved as Record<string, unknown>
  const ids = new Set(scene.nodes.map((n) => n.id))
  const focusId =
    typeof value.focusId === "string" && ids.has(value.focusId) ? value.focusId : undefined
  const allowed = new Set(["authored", "reference", "structure", "similarity"])
  const common = {
    focusId,
    type: typeof value.type === "string" ? value.type : "all",
    layers: Array.isArray(value.layers)
      ? value.layers.filter((l): l is GraphRelation["provenance"] => allowed.has(l))
      : (["authored", "reference", "structure", "similarity"] as GraphRelation["provenance"][]),
    expanded: Array.isArray(value.expanded)
      ? value.expanded.filter((id): id is string => typeof id === "string" && ids.has(id))
      : [],
  }
  if (value.version !== 2)
    return {
      ...common,
      scopeId:
        typeof value.groupId === "string" && ids.has(chapterSceneId(value.groupId))
          ? chapterSceneId(value.groupId)
          : undefined,
    }
  const positions: Record<string, ScenePoint> = Object.create(null)
  if (value.positions && typeof value.positions === "object")
    for (const [id, raw] of Object.entries(value.positions)) {
      const p = raw as ScenePoint
      if (ids.has(id) && p && [p.x, p.y, p.z].every((n) => Number.isFinite(n) && Math.abs(n) < 1e6))
        positions[id] = { x: p.x, y: p.y, z: p.z }
    }
  const camera = value.camera as KnowledgeSceneState["camera"] | undefined
  const validCamera =
    camera &&
    [camera.position, camera.target, camera.up].every(
      (a) =>
        Array.isArray(a) &&
        a.length === 3 &&
        a.every((n) => Number.isFinite(n) && Math.abs(n) < 1e6),
    )
  const viewport = value.cameraViewport as KnowledgeSceneState["cameraViewport"]
  const validViewport =
    viewport &&
    typeof viewport.fullscreen === "boolean" &&
    [viewport.width, viewport.height].every((n) => Number.isFinite(n) && n > 0 && n < 20000)
  return {
    ...common,
    scopeId:
      typeof value.scopeId === "string" && ids.has(value.scopeId) ? value.scopeId : undefined,
    positions,
    ...(validCamera ? { camera } : {}),
    ...(validViewport ? { cameraViewport: viewport } : {}),
  }
}
