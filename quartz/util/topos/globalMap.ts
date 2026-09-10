import type { Concept, KnowledgeModel, Relation } from "./types"
import { topicIDs } from "./topics"

export interface MapPoint {
  x: number
  y: number
}
export interface MapCamera {
  x: number
  y: number
  k: number
}
export interface GlobalMapNode extends MapPoint {
  id: string
  concept: Concept
  group: string
}
export interface GlobalMapGroup {
  id: string
  title: string
  color: string
  ids: string[]
  x: number
  y: number
  width: number
  height: number
  labelWidth: number
}
export interface GlobalMapLayout {
  columns?: number
  headingSpace?: number
}
export interface GlobalMapScene {
  nodes: GlobalMapNode[]
  relations: Relation[]
  groups: GlobalMapGroup[]
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

/** Editorial theme regions organize browsing, never model mathematical attraction. */
export function globalMapScene(
  model: KnowledgeModel,
  selection: string[] | undefined,
  retained: ReadonlyMap<string, MapPoint> = new Map(),
  layout: GlobalMapLayout = {},
): GlobalMapScene {
  const allowed = topicIDs(model, selection)
  const topics = (model.topics ?? []).filter(
    (topic) => selection === undefined || selection.includes(topic.id),
  )
  const nodes: GlobalMapNode[] = []
  const groups: GlobalMapGroup[] = []
  const members = new Map<string, Concept[]>()
  for (const concept of model.concepts) {
    if (!allowed.has(concept.id)) continue
    const group = topics.find((topic) => concept.topicIDs?.includes(topic.id))?.id ?? "map-other"
    const list = members.get(group) ?? []
    list.push(concept)
    members.set(group, list)
  }
  const definitions = [
    ...topics,
    { id: "map-other", title: "其他已公开对象", color: "#6c7f84" },
  ].filter((topic) => members.has(topic.id))
  const regions = definitions.map((topic) => {
    const entries = members
      .get(topic.id)!
      .sort((a, b) => compare(a.title, b.title) || compare(a.id, b.id))
    const columns = Math.max(1, Math.ceil(Math.sqrt(entries.length * 1.4)))
    return {
      topic,
      entries,
      columns,
      width: columns * 220 + 90,
      height: Math.ceil(entries.length / columns) * 110 + (layout.headingSpace ?? 75) + 55,
    }
  })
  const columns = Math.max(
    1,
    Math.min(
      regions.length || 1,
      Math.floor(layout.columns ?? Math.ceil(Math.sqrt(regions.length))),
    ),
  )
  const columnWidths = Array.from({ length: columns }, (_, column) =>
    Math.max(0, ...regions.filter((_, i) => i % columns === column).map((region) => region.width)),
  )
  const rows = Math.ceil(regions.length / columns)
  const rowHeights = Array.from({ length: rows }, (_, row) =>
    Math.max(
      0,
      ...regions.slice(row * columns, (row + 1) * columns).map((region) => region.height),
    ),
  )
  regions.forEach((region, index) => {
    const left = columnWidths.slice(0, index % columns).reduce((sum, width) => sum + width + 100, 0)
    const top = rowHeights
      .slice(0, Math.floor(index / columns))
      .reduce((sum, height) => sum + height + 100, 0)
    const items = region.entries.map((concept, i) => {
      const saved = retained.get(concept.id)
      const point =
        saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
          ? saved
          : {
              x: left + 55 + (i % region.columns) * 220,
              y: top + (layout.headingSpace ?? 75) + 15 + Math.floor(i / region.columns) * 110,
            }
      return { id: concept.id, concept, group: region.topic.id, ...point }
    })
    nodes.push(...items)
    const minX = Math.min(...items.map((node) => node.x)) - 45
    const minY = Math.min(...items.map((node) => node.y)) - (layout.headingSpace ?? 75)
    groups.push({
      id: region.topic.id,
      title: region.topic.title,
      color: region.topic.color,
      ids: items.map((node) => node.id),
      x: minX,
      y: minY,
      width: Math.max(...items.map((node) => node.x)) - minX + 210,
      height: Math.max(...items.map((node) => node.y)) - minY + 95,
      labelWidth: columnWidths[index % columns] - 60,
    })
  })
  return {
    nodes,
    groups,
    relations: model.relations.filter(
      (edge) => allowed.has(edge.source) && allowed.has(edge.target),
    ),
  }
}

export function mapFit(points: readonly MapPoint[], width: number, height: number): MapCamera {
  if (!points.length) return { x: width / 2, y: height / 2, k: 1 }
  const minX = Math.min(...points.map((point) => point.x)) - 65
  const minY = Math.min(...points.map((point) => point.y)) - 90
  const maxX = Math.max(...points.map((point) => point.x)) + 225
  const maxY = Math.max(...points.map((point) => point.y)) + 100
  const k = Math.max(
    0.005,
    Math.min(1.4, (width * 0.86) / (maxX - minX), (height * 0.84) / (maxY - minY)),
  )
  return { x: width / 2 - ((minX + maxX) / 2) * k, y: height / 2 - ((minY + maxY) / 2) * k, k }
}

/** Keep the world point underneath the pointer fixed during zoom. */
export function mapZoom(camera: MapCamera, factor: number, anchor: MapPoint): MapCamera {
  const k = Math.max(0.005, Math.min(4, camera.k * factor))
  return {
    x: anchor.x - ((anchor.x - camera.x) * k) / camera.k,
    y: anchor.y - ((anchor.y - camera.y) * k) / camera.k,
    k,
  }
}

export function mapCurve(source: MapPoint, target: MapPoint) {
  const dx = target.x - source.x,
    dy = target.y - source.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const gap = Math.min(13, length / 3),
    bend = Math.min(55, length * 0.08)
  const end = { x: target.x - (dx / length) * gap, y: target.y - (dy / length) * gap }
  return `M ${source.x} ${source.y} Q ${(source.x + end.x) / 2 - (dy / length) * bend} ${(source.y + end.y) / 2 + (dx / length) * bend} ${end.x} ${end.y}`
}

export function mapTitleLines(title: string, limit = 23) {
  const lines: string[] = []
  let line = "",
    width = 0
  for (const character of title) {
    const size = /[\u0000-\u024f]/.test(character) ? 0.6 : 1
    if (line && width + size > limit) {
      lines.push(line)
      line = ""
      width = 0
    }
    line += character
    width += size
  }
  if (line) lines.push(line)
  return lines
}

export interface GlobalMapViewCache {
  key: string
  camera: MapCamera
  width: number
  height: number
  selected?: string
  layout?: GlobalMapLayout
}
export interface GlobalMapCache {
  version: 1
  signature: string
  points: { id: string; x: number; y: number }[]
  views: GlobalMapViewCache[]
}
export function globalMapSignature(model: KnowledgeModel) {
  const value = JSON.stringify([
    model.snapshotHash,
    model.mode,
    model.concepts.map((node) => [node.id, node.topicIDs]),
    model.relations.map((edge) => [edge.id, edge.source, edge.target, edge.type]),
  ])
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16)
}
/** Session data is untrusted and may have been written by an earlier model/version. */
export function readGlobalMapCache(
  value: unknown,
  signature: string,
  knownIDs: ReadonlySet<string>,
): GlobalMapCache {
  const result: GlobalMapCache = { version: 1, signature, points: [], views: [] }
  if (!value || typeof value !== "object") return result
  const source = value as Record<string, unknown>
  if (source.version !== 1 || source.signature !== signature) return result
  const finite = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= 1e7
  const seen = new Set<string>()
  if (Array.isArray(source.points))
    for (const point of source.points.slice(0, knownIDs.size * 2)) {
      if (
        !point ||
        typeof point.id !== "string" ||
        !knownIDs.has(point.id) ||
        seen.has(point.id) ||
        !finite(point.x) ||
        !finite(point.y)
      )
        continue
      result.points.push({ id: point.id, x: point.x, y: point.y })
      seen.add(point.id)
    }
  if (Array.isArray(source.views))
    for (const view of source.views.slice(-32)) {
      if (
        !view ||
        typeof view.key !== "string" ||
        view.key.length > 2000 ||
        !view.camera ||
        !finite(view.camera.x) ||
        !finite(view.camera.y) ||
        !finite(view.camera.k) ||
        view.camera.k < 0.005 ||
        view.camera.k > 4 ||
        !finite(view.width) ||
        !finite(view.height) ||
        view.width <= 0 ||
        view.height <= 0
      )
        continue
      result.views.push({
        key: view.key,
        camera: { x: view.camera.x, y: view.camera.y, k: view.camera.k },
        width: view.width,
        height: view.height,
        selected:
          typeof view.selected === "string" && knownIDs.has(view.selected)
            ? view.selected
            : undefined,
        layout:
          view.layout &&
          finite(view.layout.columns) &&
          view.layout.columns >= 1 &&
          view.layout.columns <= 12 &&
          finite(view.layout.headingSpace) &&
          view.layout.headingSpace >= 75 &&
          view.layout.headingSpace <= 500
            ? { columns: Math.floor(view.layout.columns), headingSpace: view.layout.headingSpace }
            : undefined,
      })
    }
  return result
}
