import * as THREE from "three"
import { relationAffinity } from "../../../util/topos/context"
import type {
  Community,
  Context,
  FieldNode,
  KnowledgeModel,
  Lens,
  Relation,
} from "../../../util/topos/types"

export interface CameraState {
  x: number
  y: number
  zoom: number
}
const ink = 0x355f76,
  muted = 0x9aa8ac,
  blue = 0x25687c
const edgeStyle = (edge: Relation) => {
  if (["analogy", "duality", "historical"].includes(edge.type)) return "dashed"
  if (["example", "representation", "construction"].includes(edge.type)) return "emphasis"
  return "solid"
}
type EdgeMesh = {
  line: THREE.Line
  arrow: THREE.Mesh
  opacity: number
  style: ReturnType<typeof edgeStyle>
  endpoints: [number, number, number, number, number, number]
}
export interface ConceptAppearance {
  opacity: number
  radius: number
  major: boolean
}
export interface CommunityVisual {
  id: string
  x: number
  y: number
  rx: number
  ry: number
  opacity: number
}
type Point = { x: number; y: number }
type CommunityMesh = { line: THREE.LineLoop; points: Point[]; visual: CommunityVisual }
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n))
const smooth = (a: number, b: number, n: number) => {
  const t = clamp((n - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const farScale = (scale: number) => 1 - smooth(0.45, 1.1, scale)

/** Presentation importance comes from typed graph degree, never a hand-written topic list. */
export function createAppearanceModel(model: KnowledgeModel) {
  const byId = new Map(model.concepts.map((c) => [c.id, c]))
  const lensCache = new Map<Lens, { score: Map<string, number>; major: Set<string> }>()
  const communityCache = new WeakMap<Community[], Map<Lens, Set<string>>>()
  const visibleCache = new WeakMap<string[], Set<string>>()
  return (node: FieldNode, context: Context): ConceptAppearance => {
    if (context.visibleIDs) {
      let visible = visibleCache.get(context.visibleIDs)
      if (!visible) {
        visible = new Set(context.visibleIDs)
        visibleCache.set(context.visibleIDs, visible)
      }
      if (!visible.has(node.id)) return { opacity: 0, radius: 0, major: false }
    }
    let importance = lensCache.get(context.lens)
    if (!importance) {
      const pairs = new Map<string, Map<string, number>>()
      for (const c of model.concepts) pairs.set(c.id, new Map())
      for (const relation of model.relations) {
        if (
          !byId.has(relation.source) ||
          !byId.has(relation.target) ||
          relation.source === relation.target
        )
          continue
        const weight = relationAffinity(relation, context.lens)
        for (const [a, b] of [
          [relation.source, relation.target],
          [relation.target, relation.source],
        ])
          pairs.get(a)!.set(b, Math.max(pairs.get(a)!.get(b) ?? 0, weight))
      }
      const score = new Map(
        model.concepts.map((c) => [
          c.id,
          [...pairs.get(c.id)!.values()].reduce((sum, n) => sum + n, 0) *
            (c.kind === "structure" ? 1.12 : c.kind === "construction" ? 1.04 : 1),
        ]),
      )
      const order = [...score].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      const major = new Set(
        order
          .slice(0, Math.max(1, Math.ceil(model.concepts.length * 0.22)))
          .filter(([, value]) => value > 0)
          .map(([id]) => id),
      )
      const max = Math.max(1, ...score.values())
      for (const [id, value] of score) score.set(id, value / max)
      importance = { score, major }
      lensCache.set(context.lens, importance)
    }
    let byLens = communityCache.get(context.communities)
    if (!byLens) {
      byLens = new Map()
      communityCache.set(context.communities, byLens)
    }
    let communityMajors = byLens.get(context.lens)
    if (!communityMajors) {
      communityMajors = new Set()
      for (const community of context.communities) {
        let top: string | undefined
        for (const id of community.members) {
          const score = importance.score.get(id) ?? 0
          const best = top === undefined ? -Infinity : (importance.score.get(top) ?? 0)
          if (score > best || (score === best && (top === undefined || id < top))) top = id
        }
        if (top !== undefined) communityMajors.add(top)
      }
      byLens.set(context.lens, communityMajors)
    }
    const major =
      node.id === context.focus ||
      node.id === context.previous ||
      importance.major.has(node.id) ||
      communityMajors.has(node.id)
    const far = farScale(context.scale),
      relevance = clamp(node.relevance),
      degree = importance.score.get(node.id) ?? 0
    const ordinaryOpacity = 0.1 + relevance * 0.84
    const farOpacity = major
      ? clamp(0.2 + relevance * 0.78 + degree * 0.1)
      : 0.018 + relevance * 0.05
    const ordinaryRadius = 3.5 + 8 * relevance ** 2
    const farRadius = major ? 6 + relevance * 7 + degree * 3 : 0.8 + relevance * 1.6
    return {
      opacity: ordinaryOpacity * (1 - far) + farOpacity * far,
      radius: ordinaryRadius * (1 - far) + farRadius * far,
      major,
    }
  }
}

function convexHull(points: Point[]): Point[] {
  if (points.length <= 1) return points.slice()
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const half = (values: Point[]) => {
    const result: Point[] = []
    for (const p of values) {
      while (
        result.length >= 2 &&
        cross(result[result.length - 2], result[result.length - 1], p) <= 0
      )
        result.pop()
      result.push(p)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

const paddingDirections = Array.from({ length: 12 }, (_, i) => ({
  x: Math.cos((i * Math.PI) / 6),
  y: Math.sin((i * Math.PI) / 6),
}))
const outlineDirections = Array.from({ length: 64 }, (_, i) => ({
  x: Math.cos((i * Math.PI) / 32),
  y: Math.sin((i * Math.PI) / 32),
}))

/** A community's local footprint: membership stays intact while distant contributions recede. */
export function communityFootprint(
  community: Community,
  nodes: FieldNode[],
  project: (node: FieldNode) => Point,
  scale: number,
) {
  const memberIDs = new Set(community.members)
  const members = nodes.filter((n) => memberIDs.has(n.id))
  if (!members.length) return undefined
  const points = members.map((node) => ({ ...project(node), relevance: clamp(node.relevance) }))
  const total = points.reduce((sum, p) => sum + p.relevance ** 4, 0) || 1
  const center = {
    x: points.reduce((sum, p) => sum + p.x * p.relevance ** 4, 0) / total,
    y: points.reduce((sum, p) => sum + p.y * p.relevance ** 4, 0) / total,
  }
  const local = points.map((p) => {
    const amount = smooth(0.2, 0.55, p.relevance)
    return { x: center.x + (p.x - center.x) * amount, y: center.y + (p.y - center.y) * amount }
  })
  // Rounded convex expansion; inner weak members cannot produce spiky inward curves.
  const padding = 26 + farScale(scale) * 14
  // Convex expansion depends only on the boundary; interior points add no shape.
  const expanded = convexHull([...local, center]).flatMap((p) =>
    paddingDirections.map((direction) => ({
      x: p.x + direction.x * padding,
      y: p.y + direction.y * padding,
    })),
  )
  const hull = convexHull(expanded)
  // Fixed-angle ray samples retain correspondence when a hull vertex enters or leaves.
  const outline = outlineDirections.map(({ x: dx, y: dy }) => {
    let length = Infinity
    for (let j = 0; j < hull.length; j++) {
      const a = hull[j],
        b = hull[(j + 1) % hull.length],
        ex = b.x - a.x,
        ey = b.y - a.y
      const denominator = dx * ey - dy * ex
      if (Math.abs(denominator) < 1e-9) continue
      const ax = a.x - center.x,
        ay = a.y - center.y
      const t = (ax * ey - ay * ex) / denominator,
        u = (ax * dy - ay * dx) / denominator
      if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9) length = Math.min(length, t)
    }
    if (!Number.isFinite(length)) length = padding
    return { x: center.x + dx * length, y: center.y + dy * length }
  })
  const support = points.reduce((sum, p) => sum + smooth(0.2, 0.7, p.relevance), 0) / points.length
  const opacity =
    community.coherence * (0.22 + 0.78 * Math.sqrt(support)) * (0.18 + farScale(scale) * 0.6)
  return { points: outline, opacity }
}

/** Allocate once; Line.computeLineDistances() replaces its attribute on every call. */
export function createRelationGeometry(dashed: boolean) {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(25 * 3), 3).setUsage(THREE.DynamicDrawUsage),
  )
  if (dashed)
    geometry.setAttribute(
      "lineDistance",
      new THREE.BufferAttribute(new Float32Array(25), 1).setUsage(THREE.DynamicDrawUsage),
    )
  return geometry
}

/** Update the same curve buffers, preserving the installed Three.js dashed-line convention. */
export function updateRelationGeometry(
  geometry: THREE.BufferGeometry,
  a: Point,
  b: Point,
  width: number,
  height: number,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.max(1, Math.hypot(dx, dy)),
    bend = Math.min(40, len * 0.09),
    cx = (a.x + b.x) / 2 - (dy / len) * bend,
    cy = (a.y + b.y) / 2 + (dx / len) * bend
  const position = geometry.getAttribute("position") as THREE.BufferAttribute
  const distance = geometry.getAttribute("lineDistance") as THREE.BufferAttribute | undefined
  let length = 0
  for (let i = 0; i <= 24; i++) {
    const t = i / 24,
      q = 1 - t,
      x = q * q * a.x + 2 * q * t * cx + t * t * b.x,
      y = q * q * a.y + 2 * q * t * cy + t * t * b.y
    position.setXYZ(i, x - width / 2, height / 2 - y, -500)
    if (distance) {
      if (i > 0)
        length += Math.hypot(
          position.getX(i) - position.getX(i - 1),
          position.getY(i) - position.getY(i - 1),
        )
      distance.setX(i, length)
    }
  }
  position.needsUpdate = true
  if (distance) distance.needsUpdate = true
  return { cx, cy }
}

/** Only this layer knows WebGL. Semantic inference and forces live elsewhere. */
export function createRenderer(canvas: HTMLCanvasElement, model: KnowledgeModel) {
  let gpu: THREE.WebGLRenderer | undefined
  let fallback: CanvasRenderingContext2D | null = null
  try {
    gpu = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    gpu.setPixelRatio(Math.min(devicePixelRatio, 2))
    gpu.setClearColor(0xf4f2ed, 1)
  } catch {
    // A failed WebGL creation can leave this canvas unusable for 2D contexts.
    const flat = document.createElement("canvas")
    flat.className = "topos-flat-canvas"
    canvas.after(flat)
    fallback = flat.getContext("2d")
    canvas.style.opacity = "0"
  }
  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000)
  camera.position.z = 2000
  let width = 1,
    height = 1,
    centerY = 0.47
  let parallax = { x: 0, y: 0 }
  const view: CameraState = { x: 0, y: 0, zoom: 1 }
  const meshes = new Map<string, { point: THREE.Mesh; ring: THREE.Mesh }>()
  const edges = new Map<string, EdgeMesh>()
  const hulls = new Map<string, CommunityMesh>()
  const concepts = new Map(model.concepts.map((concept) => [concept.id, concept]))
  const targetAppearance = createAppearanceModel(model)
  const nodeAppearances = new Map<string, ConceptAppearance>()
  let presentation: Set<string> | undefined
  let includeCommunities = true
  const presented = (id: string) => !presentation || presentation.has(id)
  function appearance(node: FieldNode, context: Context): ConceptAppearance {
    if (!presented(node.id)) return { opacity: 0, radius: 0, major: false }
    const current = nodeAppearances.get(node.id)
    return current ?? targetAppearance(node, context)
  }
  // Publication eligibility and what can be named on this screen are different.
  // Keep every mesh/identity; suppress excluded marks immediately with their edges.
  function setPresentation(
    ids: readonly string[] | undefined,
    options?: { includeCommunities?: boolean },
  ) {
    const showCommunities = options?.includeCommunities ?? ids === undefined
    const next = ids ? new Set(ids.filter((id) => concepts.has(id))) : undefined
    if (
      includeCommunities === showCommunities &&
      ((!next && !presentation) ||
        (next && presentation && next.size === presentation.size && [...next].every(presented)))
    )
      return
    presentation = next
    includeCommunities = showCommunities
    for (const [id, mesh] of meshes) {
      if (presented(id)) continue
      mesh.point.visible = mesh.ring.visible = false
      ;(mesh.point.material as THREE.Material).opacity = 0
      ;(mesh.ring.material as THREE.Material).opacity = 0
      nodeAppearances.set(id, { opacity: 0, radius: 0, major: false })
    }
    for (const relation of model.relations) {
      if (presented(relation.source) && presented(relation.target)) continue
      const entry = edges.get(relation.id)!
      entry.opacity = 0
      entry.line.visible = entry.arrow.visible = false
    }
    if (!includeCommunities)
      for (const entry of hulls.values()) {
        entry.visual.opacity = 0
        entry.line.visible = false
        ;(entry.line.material as THREE.Material).opacity = 0
      }
  }
  const pointGeometry = new THREE.CircleGeometry(1, 32)
  const squareGeometry = new THREE.PlaneGeometry(1.7, 1.7)
  const triangleGeometry = new THREE.CircleGeometry(1, 3)
  const ringGeometry = new THREE.RingGeometry(0.91, 1, 64)
  const arrowGeometry = new THREE.CircleGeometry(4.5, 3)
  for (const concept of model.concepts) {
    const point = new THREE.Mesh(
      concept.kind === "construction"
        ? squareGeometry
        : concept.kind === "example"
          ? triangleGeometry
          : pointGeometry,
      new THREE.MeshBasicMaterial({
        color: concept.color ?? ink,
        transparent: true,
        depthWrite: false,
      }),
    )
    const ring = new THREE.Mesh(
      ringGeometry,
      new THREE.MeshBasicMaterial({
        color: concept.color ?? blue,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    scene.add(point, ring)
    point.visible = ring.visible = false
    meshes.set(concept.id, { point, ring })
  }
  for (const edge of model.relations) {
    const style = edgeStyle(edge)
    const material =
      style === "dashed"
        ? new THREE.LineDashedMaterial({
            color: muted,
            transparent: true,
            opacity: 0,
            dashSize: 7,
            gapSize: 8,
            depthWrite: false,
          })
        : new THREE.LineBasicMaterial({
            color: style === "emphasis" ? ink : muted,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          })
    const geometry = createRelationGeometry(style === "dashed")
    const line = new THREE.Line(geometry, material)
    // Its vertices change in screen space; an initial cached zero-radius sphere is stale.
    line.frustumCulled = false
    const arrow = new THREE.Mesh(
      arrowGeometry,
      new THREE.MeshBasicMaterial({ color: ink, transparent: true, opacity: 0, depthWrite: false }),
    )
    line.visible = arrow.visible = false
    edges.set(edge.id, {
      line,
      arrow,
      opacity: 0,
      style,
      endpoints: [NaN, NaN, NaN, NaN, NaN, NaN],
    })
    scene.add(line, arrow)
  }
  function resize() {
    // The named overview can conceal the canvas without changing the reader's
    // viewport. Measure its persistent host, including while a view is hidden.
    const host = canvas.parentElement ?? canvas
    width = Math.max(host.clientWidth, 1)
    height = Math.max(host.clientHeight, 1)
    camera.left = -width / 2
    camera.right = width / 2
    camera.top = height / 2
    camera.bottom = -height / 2
    camera.updateProjectionMatrix()
    gpu?.setSize(width, height, false)
    if (fallback) {
      fallback.canvas.width = width * devicePixelRatio
      fallback.canvas.height = height * devicePixelRatio
      fallback.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
  }
  function project(node: Pick<FieldNode, "x" | "y" | "z">) {
    return {
      x: width / 2 + (node.x + view.x + node.z * parallax.x * 0.07) * view.zoom,
      y: height * centerY + (node.y + view.y + node.z * parallax.y * 0.04) * view.zoom,
    }
  }
  function unproject(x: number, y: number) {
    return {
      x: (x - width / 2) / view.zoom - view.x,
      y: (y - height * centerY) / view.zoom - view.y,
    }
  }
  function updatePoint(mesh: THREE.Object3D, p: { x: number; y: number }, z: number) {
    mesh.position.set(p.x - width / 2, height / 2 - p.y, z)
  }
  const nodeMap = new Map<string, FieldNode>()
  const projected = new Map<string, Point>()
  const communityTargets = new Map<
    string,
    {
      members: string[]
      input: Float64Array
      footprint: ReturnType<typeof communityFootprint>
    }
  >()
  let lastContext: Context | undefined
  let visibleRelations = new Set<string>()
  let activeCommunities = new Set<string>()
  let visibleNodes: Set<string> | undefined
  function draw(nodes: FieldNode[], context: Context, dt: number) {
    for (const n of nodes) {
      nodeMap.set(n.id, n)
      const point = projected.get(n.id) ?? { x: 0, y: 0 }
      point.x = width / 2 + (n.x + view.x + n.z * parallax.x * 0.07) * view.zoom
      point.y = height * centerY + (n.y + view.y + n.z * parallax.y * 0.04) * view.zoom
      projected.set(n.id, point)
    }
    if (lastContext !== context) {
      lastContext = context
      visibleRelations = new Set(context.relations.map((relation) => relation.id))
      activeCommunities = new Set(context.communities.map((community) => community.id))
      visibleNodes = context.visibleIDs ? new Set(context.visibleIDs) : undefined
    }
    if (fallback) {
      fallback.fillStyle = "#f4f2ed"
      fallback.fillRect(0, 0, width, height)
    }
    let changing = false
    for (const node of nodes) {
      if (!presented(node.id)) continue
      const target = targetAppearance(node, context)
      const current = nodeAppearances.get(node.id) ?? { ...target }
      const blend = Math.min(1, dt * 7)
      current.opacity += (target.opacity - current.opacity) * blend
      current.radius += (target.radius - current.radius) * blend
      current.major = target.major
      const active =
        Math.abs(target.opacity - current.opacity) > 0.001 ||
        Math.abs(target.radius - current.radius) > 0.03
      if (!active) {
        current.opacity = target.opacity
        current.radius = target.radius
      }
      changing ||= active
      nodeAppearances.set(node.id, current)
    }
    for (const [id, entry] of hulls) {
      if (!includeCommunities) continue
      if (activeCommunities.has(id)) continue
      const material = entry.line.material as THREE.Material
      material.opacity *= Math.max(0, 1 - dt * 3)
      if (material.opacity < 0.001) material.opacity = 0
      entry.visual.opacity = material.opacity
      entry.line.visible = material.opacity > 0
      changing ||= material.opacity > 0
      if (fallback && material.opacity > 0) paintCommunity(entry)
    }
    if (includeCommunities)
      for (const community of context.communities)
        changing = drawCommunity(community, nodes, dt, context.scale) || changing
    for (const relation of model.relations) {
      if (!presented(relation.source) || !presented(relation.target)) continue
      const source = nodeMap.get(relation.source)!,
        target = nodeMap.get(relation.target)!
      if (!source || !target) continue
      const entry = edges.get(relation.id)!
      const directly = relation.source === context.focus || relation.target === context.focus
      const bothMajor =
        nodeAppearances.get(source.id)!.major && nodeAppearances.get(target.id)!.major
      const edgeResolution = 1 - farScale(context.scale) * (bothMajor ? 0.35 : 0.96)
      const targetOpacity = visibleRelations.has(relation.id)
        ? (directly ? 0.49 : 0.15) * Math.min(source.relevance, target.relevance) * edgeResolution
        : 0
      entry.opacity += (targetOpacity - entry.opacity) * Math.min(1, dt * 5)
      const fading = Math.abs(targetOpacity - entry.opacity) > 0.003
      if (!fading) entry.opacity = targetOpacity
      changing ||= fading
      entry.line.visible = entry.arrow.visible = entry.opacity > 0.001
      ;(entry.line.material as THREE.Material).opacity = entry.opacity
      ;(entry.arrow.material as THREE.Material).opacity =
        entry.opacity * (entry.style === "dashed" ? 0.3 : 0.85)
      if (!entry.line.visible) continue
      const a = projected.get(source.id)!,
        b = projected.get(target.id)!
      const dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.max(1, Math.hypot(dx, dy))
      const bend = Math.min(40, len * 0.09)
      const cx = (a.x + b.x) / 2 - (dy / len) * bend,
        cy = (a.y + b.y) / 2 + (dx / len) * bend
      const previous = entry.endpoints
      if (
        !fallback &&
        (previous[0] !== a.x ||
          previous[1] !== a.y ||
          previous[2] !== b.x ||
          previous[3] !== b.y ||
          previous[4] !== width ||
          previous[5] !== height)
      ) {
        updateRelationGeometry(entry.line.geometry, a, b, width, height)
        previous[0] = a.x
        previous[1] = a.y
        previous[2] = b.x
        previous[3] = b.y
        previous[4] = width
        previous[5] = height
      }
      const t = 0.72,
        q = 1 - t
      updatePoint(
        entry.arrow,
        {
          x: q * q * a.x + 2 * q * t * cx + t * t * b.x,
          y: q * q * a.y + 2 * q * t * cy + t * t * b.y,
        },
        -495,
      )
      entry.arrow.rotation.z = Math.atan2(-dy, dx) - Math.PI / 2
      if (fallback && entry.opacity > 0.01) {
        fallback.globalAlpha = entry.opacity
        fallback.strokeStyle = "#456e80"
        fallback.setLineDash(entry.style === "dashed" ? [6, 6] : [])
        fallback.beginPath()
        fallback.moveTo(a.x, a.y)
        fallback.quadraticCurveTo(cx, cy, b.x, b.y)
        fallback.stroke()
      }
    }
    for (const node of nodes) {
      if (!presented(node.id)) continue
      const mesh = meshes.get(node.id)!,
        p = projected.get(node.id)!
      const visual = nodeAppearances.get(node.id)!,
        r = visual.radius
      updatePoint(mesh.point, p, node.z)
      mesh.point.scale.setScalar(r)
      ;(mesh.point.material as THREE.MeshBasicMaterial).opacity = visual.opacity
      mesh.point.visible = visual.opacity > 0.001
      const visible = !visibleNodes || visibleNodes.has(node.id)
      const emphasis = !visible
        ? 0
        : node.id === context.focus
          ? 1
          : node.id === context.previous
            ? 0.25
            : 0
      updatePoint(mesh.ring, p, node.z - 2)
      mesh.ring.scale.setScalar(18 + node.relevance * 12)
      ;(mesh.ring.material as THREE.Material).opacity +=
        (emphasis * 0.48 - (mesh.ring.material as THREE.Material).opacity) * Math.min(1, dt * 7)
      changing ||=
        Math.abs(emphasis * 0.48 - (mesh.ring.material as THREE.Material).opacity) > 0.001
      mesh.ring.visible = (mesh.ring.material as THREE.Material).opacity > 0.001
      if (fallback) {
        fallback.globalAlpha = visual.opacity
        const concept = concepts.get(node.id)
        fallback.fillStyle = concept?.color ?? "#355f76"
        fallback.setLineDash([])
        fallback.beginPath()
        if (concept?.kind === "construction")
          fallback.rect(p.x - r * 0.85, p.y - r * 0.85, r * 1.7, r * 1.7)
        else if (concept?.kind === "example") {
          for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3
            const x = p.x + Math.cos(angle) * r,
              y = p.y - Math.sin(angle) * r
            i ? fallback.lineTo(x, y) : fallback.moveTo(x, y)
          }
          fallback.closePath()
        } else fallback.arc(p.x, p.y, r, 0, Math.PI * 2)
        fallback.fill()
        if (emphasis) {
          fallback.beginPath()
          fallback.arc(p.x, p.y, 30, 0, Math.PI * 2)
          fallback.stroke()
        }
      }
    }
    if (fallback) fallback.globalAlpha = 1
    gpu?.render(scene, camera)
    return changing
  }
  function paintCommunity(entry: CommunityMesh) {
    if (!fallback) return
    fallback.strokeStyle = "#7f999f"
    fallback.globalAlpha = entry.visual.opacity
    fallback.setLineDash([])
    fallback.beginPath()
    entry.points.forEach((p, i) => (i ? fallback!.lineTo(p.x, p.y) : fallback!.moveTo(p.x, p.y)))
    fallback.closePath()
    fallback.stroke()
  }
  function drawCommunity(community: Community, nodes: FieldNode[], dt: number, scale: number) {
    let cached = communityTargets.get(community.id)
    if (!cached || cached.members !== community.members) {
      cached = {
        members: community.members,
        input: new Float64Array(community.members.length * 3 + 2).fill(NaN),
        footprint: undefined,
      }
      communityTargets.set(community.id, cached)
    }
    let changed = cached.input[0] !== scale || cached.input[1] !== community.coherence
    cached.input[0] = scale
    cached.input[1] = community.coherence
    for (let i = 0; i < community.members.length; i++) {
      const id = community.members[i],
        point = projected.get(id),
        node = nodeMap.get(id)
      if (!point || !node) continue
      const offset = i * 3 + 2
      changed ||=
        cached.input[offset] !== point.x ||
        cached.input[offset + 1] !== point.y ||
        cached.input[offset + 2] !== node.relevance
      cached.input[offset] = point.x
      cached.input[offset + 1] = point.y
      cached.input[offset + 2] = node.relevance
    }
    if (changed || !cached.footprint)
      cached.footprint = communityFootprint(
        community,
        nodes,
        (node) => projected.get(node.id)!,
        scale,
      )
    const footprint = cached.footprint
    if (!footprint) return false
    let entry = hulls.get(community.id)
    if (!entry) {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(64 * 3), 3).setUsage(THREE.DynamicDrawUsage),
      )
      const line = new THREE.LineLoop(
        geometry,
        new THREE.LineBasicMaterial({
          color: 0x7f999f,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      )
      line.frustumCulled = false
      entry = {
        line,
        points: footprint.points.map((p) => ({ ...p })),
        visual: { id: community.id, x: 0, y: 0, rx: 0, ry: 0, opacity: 0 },
      }
      hulls.set(community.id, entry)
      scene.add(line)
    }
    let changing = false
    let geometryChanged = false
    const blend = Math.min(1, dt * 6)
    const attribute = entry.line.geometry.getAttribute("position") as THREE.BufferAttribute
    for (let i = 0; i < entry.points.length; i++) {
      const current = entry.points[i],
        target = footprint.points[i]
      const oldX = current.x,
        oldY = current.y
      current.x += (target.x - current.x) * blend
      current.y += (target.y - current.y) * blend
      const active = Math.hypot(target.x - current.x, target.y - current.y) > 0.08
      if (!active) {
        current.x = target.x
        current.y = target.y
      }
      changing ||= active
      // Upload only when screen positions or the viewport origin actually changed.
      const x = current.x - width / 2,
        y = height / 2 - current.y
      if (
        oldX !== current.x ||
        oldY !== current.y ||
        attribute.getX(i) !== Math.fround(x) ||
        attribute.getY(i) !== Math.fround(y) ||
        attribute.getZ(i) !== -650
      ) {
        attribute.setXYZ(i, x, y, -650)
        geometryChanged = true
      }
    }
    if (geometryChanged && !fallback) attribute.needsUpdate = true
    const material = entry.line.material as THREE.Material
    material.opacity += (footprint.opacity - material.opacity) * Math.min(1, dt * 3)
    if (Math.abs(footprint.opacity - material.opacity) > 0.001) changing = true
    else material.opacity = footprint.opacity
    entry.line.visible = material.opacity > 0.001
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity
    for (const point of entry.points) {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minY = Math.min(minY, point.y)
      maxY = Math.max(maxY, point.y)
    }
    Object.assign(entry.visual, {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      rx: (maxX - minX) / 2,
      ry: (maxY - minY) / 2,
      opacity: material.opacity,
    })
    paintCommunity(entry)
    return changing
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    canvas.dispatchEvent(new Event("topos-context-lost"))
  }
  canvas.addEventListener("webglcontextlost", contextLost)
  resize()
  return {
    draw,
    resize,
    project,
    unproject,
    appearance,
    setPresentation,
    view,
    get communityVisuals(): CommunityVisual[] {
      return [...hulls.values()]
        .filter((entry) => entry.visual.opacity > 0)
        .map((entry) => ({ ...entry.visual }))
    },
    get backend() {
      return gpu ? "webgl2" : "canvas2d"
    },
    get renderStats() {
      return {
        calls: gpu?.info.render.calls ?? 0,
        geometries: gpu?.info.memory.geometries ?? 0,
        visibleNodes: [...meshes.values()].filter((mesh) => mesh.point.visible).length,
        visibleEdges: [...edges.values()].filter((edge) => edge.line.visible).length,
      }
    },
    setCenterY(y: number) {
      centerY = y
    },
    setParallax(x: number, y: number) {
      parallax = { x, y }
    },
    get size() {
      return { width, height }
    },
    dispose() {
      canvas.removeEventListener("webglcontextlost", contextLost)
      for (const geometry of [
        pointGeometry,
        squareGeometry,
        triangleGeometry,
        ringGeometry,
        arrowGeometry,
      ])
        geometry.dispose()
      for (const m of meshes.values()) {
        ;(m.point.material as THREE.Material).dispose()
        ;(m.ring.material as THREE.Material).dispose()
      }
      for (const e of edges.values()) {
        e.line.geometry.dispose()
        ;(e.line.material as THREE.Material).dispose()
        ;(e.arrow.material as THREE.Material).dispose()
      }
      for (const h of hulls.values()) {
        h.line.geometry.dispose()
        ;(h.line.material as THREE.Material).dispose()
      }
      gpu?.dispose()
      fallback?.canvas.remove()
      scene.clear()
      communityTargets.clear()
      meshes.clear()
      edges.clear()
      hulls.clear()
    },
  }
}
