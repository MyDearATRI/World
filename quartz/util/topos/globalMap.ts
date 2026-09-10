import type { Concept, KnowledgeModel, Relation } from "./types"
import { topicIDs } from "./topics"
import type { MapFieldSnapshot } from "./globalMapField"

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
      height: Math.ceil(entries.length / columns) * 150 + (layout.headingSpace ?? 75) + 55,
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
      // A stable phyllotactic seed gives the physical solver room in two dimensions,
      // rather than pinning every concept to an identical rectangular row.
      const extentX = Math.max(160, (region.columns - 1) * 220)
      const extentY = Math.max(150, (Math.ceil(region.entries.length / region.columns) - 1) * 150)
      const radius =
        region.entries.length === 1 ? 0 : Math.sqrt((i + 0.5) / region.entries.length) * 0.9
      const angle = i * Math.PI * (3 - Math.sqrt(5))
      const point =
        saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
          ? saved
          : {
              x: left + 55 + extentX / 2 + (Math.cos(angle) * radius * extentX) / 2,
              y:
                top +
                (layout.headingSpace ?? 75) +
                15 +
                extentY / 2 +
                (Math.sin(angle) * radius * extentY) / 2,
            }
      return { id: concept.id, concept, group: region.topic.id, ...point }
    })
    nodes.push(...items)
    const minX = Math.min(left + 10, Math.min(...items.map((node) => node.x)) - 45)
    const minY = Math.min(
      top + 15,
      Math.min(...items.map((node) => node.y)) - (layout.headingSpace ?? 75),
    )
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
  const sizeOf = (text: string) =>
    Array.from(text).reduce(
      (sum, character) => sum + (/[\u0000-\u024f]/.test(character) ? 0.6 : 1),
      0,
    )
  // Keep Latin words intact when they fit a line. Whitespace and CJK characters
  // remain literal tokens so joining the lines always recovers the original.
  const tokens =
    title.match(/[\p{Script=Latin}\p{Number}]+(?:['’\-][\p{Script=Latin}\p{Number}]+)*|[^]/gu) ?? []
  const append = (text: string, size: number) => {
    if (line && width + size > limit && !/^\s+$/u.test(text)) {
      lines.push(line)
      line = ""
      width = 0
    }
    line += text
    width += size
  }
  for (const token of tokens) {
    const size = sizeOf(token)
    if (size <= limit) append(token, size)
    else for (const character of token) append(character, sizeOf(character))
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
  physics?: MapFieldSnapshot
}
export interface GlobalMapCache {
  version: 1
  signature: string
  points: { id: string; x: number; y: number }[]
  views: GlobalMapViewCache[]
}
export function globalMapSignature(model: KnowledgeModel) {
  const value = JSON.stringify([
    "bounded-physics-2",
    model.snapshotHash,
    model.mode,
    model.concepts.map((node) => [node.id, node.topicIDs]),
    model.relations.map((edge) => [edge.id, edge.source, edge.target, edge.type]),
  ])
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619)
  return (hash >>> 0).toString(16)
}

export interface MapLabelItem {
  id: string
  x: number
  y: number
  width: number
  height: number
  priority: number
}
export interface MapLabelBox {
  id: string
  x: number
  y: number
  width: number
  height: number
}
export interface MapLabelCircle {
  x: number
  y: number
  radius: number
}
/** Labels are optional annotations; physical nodes are never removed to make labels fit. */
export function placeMapLabels(
  items: readonly MapLabelItem[],
  width: number,
  height: number,
  obstacles: readonly MapLabelCircle[],
  previous: readonly MapLabelBox[] = [],
) {
  const boxes: MapLabelBox[] = [],
    omitted: string[] = []
  const remembered = new Map(previous.map((box) => [box.id, box]))
  const ordered = [...items].sort((a, b) => b.priority - a.priority || compare(a.id, b.id))
  const intersects = (a: MapLabelBox, b: MapLabelBox) =>
    a.x < b.x + b.width + 6 &&
    a.x + a.width + 6 > b.x &&
    a.y < b.y + b.height + 6 &&
    a.y + a.height + 6 > b.y
  for (const item of ordered) {
    if (item.width > width - 16 || item.height > height - 16) {
      omitted.push(item.id)
      continue
    }
    const old = remembered.get(item.id),
      candidates: MapLabelBox[] = []
    const add = (x: number, y: number) =>
      candidates.push({
        id: item.id,
        x: Math.max(8, Math.min(width - item.width - 8, x)),
        y: Math.max(8, Math.min(height - item.height - 8, y)),
        width: item.width,
        height: item.height,
      })
    if (old && Math.hypot(old.x + old.width / 2 - item.x, old.y + old.height / 2 - item.y) < 220)
      add(old.x, old.y)
    for (const distance of [24, 48, 84, 132, 190])
      for (let direction = 0; direction < 8; direction++) {
        const angle = (direction * Math.PI) / 4
        add(
          item.x +
            Math.cos(angle) * distance -
            (Math.cos(angle) < -0.1
              ? item.width
              : Math.abs(Math.cos(angle)) < 0.1
                ? item.width / 2
                : 0),
          item.y +
            Math.sin(angle) * distance -
            (Math.sin(angle) < -0.1
              ? item.height
              : Math.abs(Math.sin(angle)) < 0.1
                ? item.height / 2
                : 0),
        )
      }
    const chosen = candidates.find(
      (box) =>
        !boxes.some((other) => intersects(box, other)) &&
        !obstacles.some((circle) => {
          const nearX = Math.max(box.x, Math.min(box.x + box.width, circle.x)),
            nearY = Math.max(box.y, Math.min(box.y + box.height, circle.y))
          return Math.hypot(nearX - circle.x, nearY - circle.y) < circle.radius + 5
        }),
    )
    if (chosen) boxes.push(chosen)
    else omitted.push(item.id)
  }
  return { boxes, omitted }
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
        physics:
          view.physics?.version === 1 &&
          Array.isArray(view.physics.nodes) &&
          view.physics.nodes.length <= knownIDs.size &&
          view.physics.nodes.every(
            (node: Record<string, unknown>) =>
              node &&
              typeof node.id === "string" &&
              knownIDs.has(node.id) &&
              [node.x, node.y, node.vx, node.vy, node.anchorX, node.anchorY].every(finite),
          )
            ? { version: 1, nodes: view.physics.nodes, settled: view.physics.settled === true }
            : undefined,
      })
    }
  return result
}
