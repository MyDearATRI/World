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
  // Kept for saved-view compatibility. A narrow-screen aspect hint, never
  // a request to partition concepts into columns or bounded topic territories.
  columns?: number
  headingSpace?: number
}
export interface GlobalMapScene {
  nodes: GlobalMapNode[]
  relations: Relation[]
  groups: GlobalMapGroup[]
}
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
function fraction(id: string) {
  let hash = 2166136261
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0) / 0x100000000
}

function freePosition(seed: MapPoint, occupied: readonly MapPoint[], id: string): MapPoint {
  const point = { ...seed },
    clearance = 132,
    phase = fraction(id) * Math.PI * 2
  const intersects = () =>
    occupied.some((other) => (point.x - other.x) ** 2 + (point.y - other.y) ** 2 < clearance ** 2)
  // Only actual point occupancy constrains placement. There are no topic walls
  // and no label-sized exclusion regions; existing manual positions never move.
  for (let attempt = 1; intersects() && attempt <= 1024; attempt++) {
    const radius = 18 * Math.sqrt(attempt),
      angle = phase + attempt * goldenAngle
    point.x = seed.x + radius * Math.cos(angle)
    point.y = seed.y + radius * Math.sin(angle)
  }
  if (intersects()) {
    const radius =
      Math.max(0, ...occupied.map((other) => Math.hypot(other.x - seed.x, other.y - seed.y))) +
      clearance
    point.x = seed.x + radius * Math.cos(phase)
    point.y = seed.y + radius * Math.sin(phase)
  }
  return point
}

const initialFields = new WeakMap<
  KnowledgeModel,
  { signature: string; variants: Map<boolean, ReadonlyMap<string, MapPoint>> }
>()

function continuousPositions(model: KnowledgeModel, narrow: boolean) {
  const concepts = [...model.concepts].sort((a, b) => compare(a.id, b.id)),
    themes = [...(model.topics ?? [])].sort((a, b) => compare(a.id, b.id)),
    relations = [...model.relations].sort((a, b) => compare(a.id, b.id))
  const signature = JSON.stringify([
    concepts.map((node) => [node.id, [...(node.topicIDs ?? [])].sort(compare)]),
    themes.map((theme) => theme.id),
    relations.map((edge) => [edge.id, edge.source, edge.target, edge.provenance, edge.strength]),
  ])
  let cached = initialFields.get(model)
  if (!cached || cached.signature !== signature) {
    cached = { signature, variants: new Map() }
    initialFields.set(model, cached)
  }
  const previous = cached.variants.get(narrow)
  if (previous) return previous

  // One shared field. Topic directions are weak, overlapping reading cues; a
  // multi-theme object mixes all of its memberships rather than owning a box.
  const extent = Math.max(210, Math.sqrt(concepts.length) * 116),
    aspect = narrow ? { x: 0.78, y: 1.28 } : { x: 1.14, y: 0.88 }
  const centers = new Map(
    themes.map((theme, i) => {
      const radius = Math.sqrt((i + 0.5) / Math.max(1, themes.length)) * extent * 0.56,
        angle = i * goldenAngle + 0.35
      return [theme.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }]
    }),
  )
  const ranks = new Map(
    [...concepts]
      .sort((a, b) => fraction(a.id) - fraction(b.id) || compare(a.id, b.id))
      .map((node, i) => [node.id, i]),
  )
  const base = new Map(
    concepts.map((concept) => {
      const memberships = [...new Set(concept.topicIDs ?? [])]
        .sort(compare)
        .flatMap((id) => (centers.has(id) ? [centers.get(id)!] : []))
      const center = memberships.reduce(
        (sum, p) => ({ x: sum.x + p.x / memberships.length, y: sum.y + p.y / memberships.length }),
        { x: 0, y: 0 },
      )
      // A full-field sunflower seed avoids a random central pile with isolated
      // distant outliers. Theme directions only bend this even shared footprint.
      const rank = ranks.get(concept.id)!,
        radius = Math.sqrt((rank + 0.5) / Math.max(1, concepts.length)) * extent * 0.82,
        angle = rank * goldenAngle + 0.35
      return [
        concept.id,
        {
          x: center.x * 0.34 + Math.cos(angle) * radius,
          y: center.y * 0.34 + Math.sin(angle) * radius,
        },
      ]
    }),
  )
  const adjacency = new Map(
    concepts.map((node) => [node.id, [] as { id: string; weight: number }[]]),
  )
  for (const edge of relations) {
    if (edge.source === edge.target || !base.has(edge.source) || !base.has(edge.target)) continue
    const weight =
      edge.provenance === "structure" ? 0.45 : edge.provenance === "reference" ? 0.7 : 1
    adjacency.get(edge.source)!.push({ id: edge.target, weight })
    adjacency.get(edge.target)!.push({ id: edge.source, weight })
  }
  // A bounded graph-derived bend joins neighborhoods without an iterative UI
  // simulation. The actual directed relations below remain unchanged: spatial
  // averaging is presentation only, never an inferred mathematical dependency.
  let bent = base
  for (let pass = 0; pass < 2; pass++) {
    const prior = bent
    bent = new Map(
      concepts.map((node) => {
        const seed = base.get(node.id)!,
          neighbors = adjacency.get(node.id)!,
          weight = neighbors.reduce((sum, item) => sum + item.weight, 0)
        if (!weight) return [node.id, seed]
        const centroid = neighbors.reduce(
          (sum, item) => ({
            x: sum.x + (prior.get(item.id)!.x * item.weight) / weight,
            y: sum.y + (prior.get(item.id)!.y * item.weight) / weight,
          }),
          { x: 0, y: 0 },
        )
        return [
          node.id,
          { x: seed.x * 0.82 + centroid.x * 0.18, y: seed.y * 0.82 + centroid.y * 0.18 },
        ]
      }),
    )
  }
  const positions = new Map<string, MapPoint>(),
    occupied: MapPoint[] = []
  for (const node of concepts) {
    const seed = bent.get(node.id)!,
      point = freePosition({ x: seed.x * aspect.x, y: seed.y * aspect.y }, occupied, node.id)
    positions.set(node.id, point)
    occupied.push(point)
  }
  cached.variants.set(narrow, positions)
  return positions
}

/** A continuous reading field: themes label memberships, never enclose nodes. */
export function globalMapScene(
  model: KnowledgeModel,
  selection: string[] | undefined,
  retained: ReadonlyMap<string, MapPoint> = new Map(),
  layout: GlobalMapLayout = {},
): GlobalMapScene {
  const allowed = topicIDs(model, selection)
  if (!allowed.size) return { nodes: [], groups: [], relations: [] }
  const topics = (model.topics ?? []).filter(
    (topic) => selection === undefined || selection.includes(topic.id),
  )
  const positions = continuousPositions(model, (layout.columns ?? Infinity) <= 2)
  const preserved = new Map(
    [...retained].filter(([, point]) => Number.isFinite(point.x) && Number.isFinite(point.y)),
  )
  const nodes: GlobalMapNode[] = [...model.concepts]
    .sort((a, b) => compare(a.id, b.id))
    .filter((concept) => allowed.has(concept.id))
    .map((concept) => ({
      id: concept.id,
      concept,
      group: topics.find((topic) => concept.topicIDs?.includes(topic.id))?.id ?? "map-other",
      ...(preserved.get(concept.id) ?? positions.get(concept.id)!),
    }))
  const occupied: MapPoint[] = nodes.filter((node) => preserved.has(node.id))
  if (occupied.length) {
    for (const node of nodes) {
      if (preserved.has(node.id)) continue
      Object.assign(node, freePosition(node, occupied, node.id))
      occupied.push(node)
    }
  }
  // Bounds are compatibility metadata for camera fitting, not reserved space.
  // Membership extents may overlap freely; physical forces see only points/edges.
  const groups = [
    ...topics,
    { id: "map-other", title: "其他已公开对象", color: "#6c7f84" },
  ].flatMap((topic) => {
    const items = nodes.filter((node) =>
      topic.id === "map-other"
        ? node.group === "map-other"
        : node.concept.topicIDs?.includes(topic.id),
    )
    if (!items.length) return []
    const x = Math.min(...items.map((node) => node.x)) - 45,
      y = Math.min(...items.map((node) => node.y)) - 75
    return [
      {
        id: topic.id,
        title: topic.title,
        color: topic.color,
        ids: items.map((node) => node.id),
        x,
        y,
        width: Math.max(...items.map((node) => node.x)) - x + 45,
        height: Math.max(...items.map((node) => node.y)) - y + 45,
        labelWidth: 280,
      },
    ]
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
  reserved: readonly MapLabelBox[] = [],
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
  // A warm layout normally accepts its old slot. Spatial buckets avoid scanning
  // every dot and already placed name for each fallback candidate while dragging.
  const cells = (x: number, y: number, w: number, h: number) => {
    const keys: string[] = []
    for (let a = Math.floor(x / 64); a <= Math.floor((x + w) / 64); a++)
      for (let b = Math.floor(y / 64); b <= Math.floor((y + h) / 64); b++) keys.push(`${a}/${b}`)
    return keys
  }
  const circleCells = new Map<string, MapLabelCircle[]>()
  for (const circle of obstacles)
    for (const key of cells(
      circle.x - circle.radius - 5,
      circle.y - circle.radius - 5,
      (circle.radius + 5) * 2,
      (circle.radius + 5) * 2,
    )) {
      const entries = circleCells.get(key) ?? []
      entries.push(circle)
      circleCells.set(key, entries)
    }
  const boxCells = new Map<string, MapLabelBox[]>()
  const available = (box: MapLabelBox) => {
    const keys = cells(box.x - 6, box.y - 6, box.width + 12, box.height + 12)
    const checkedBoxes = new Set<MapLabelBox>(),
      checkedCircles = new Set<MapLabelCircle>()
    for (const key of keys) {
      for (const other of boxCells.get(key) ?? [])
        if (!checkedBoxes.has(other)) {
          checkedBoxes.add(other)
          if (intersects(box, other)) return false
        }
      for (const circle of circleCells.get(key) ?? [])
        if (!checkedCircles.has(circle)) {
          checkedCircles.add(circle)
          const nearX = Math.max(box.x, Math.min(box.x + box.width, circle.x))
          const nearY = Math.max(box.y, Math.min(box.y + box.height, circle.y))
          if ((nearX - circle.x) ** 2 + (nearY - circle.y) ** 2 < (circle.radius + 5) ** 2)
            return false
        }
    }
    return true
  }
  const occupy = (box: MapLabelBox) => {
    for (const key of cells(box.x - 6, box.y - 6, box.width + 12, box.height + 12)) {
      const entries = boxCells.get(key) ?? []
      entries.push(box)
      boxCells.set(key, entries)
    }
  }
  for (const box of reserved) occupy(box)
  const retain = (box: MapLabelBox) => {
    boxes.push(box)
    occupy(box)
  }
  for (const item of ordered) {
    if (item.width > width - 16 || item.height > height - 16) {
      omitted.push(item.id)
      continue
    }
    const old = remembered.get(item.id)
    const candidate = (x: number, y: number): MapLabelBox => ({
      id: item.id,
      x: Math.max(8, Math.min(width - item.width - 8, x)),
      y: Math.max(8, Math.min(height - item.height - 8, y)),
      width: item.width,
      height: item.height,
    })
    let chosen: MapLabelBox | undefined
    if (old && Math.hypot(old.x + old.width / 2 - item.x, old.y + old.height / 2 - item.y) < 220) {
      const box = candidate(old.x, old.y)
      if (available(box)) chosen = box
    }
    search: for (const distance of chosen ? [] : [24, 48, 84, 132, 190])
      for (let direction = 0; direction < 8; direction++) {
        const angle = (direction * Math.PI) / 4
        const box = candidate(
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
        if (available(box)) {
          chosen = box
          break search
        }
      }
    if (chosen) retain(chosen)
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
