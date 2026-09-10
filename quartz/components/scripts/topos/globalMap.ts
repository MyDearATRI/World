import {
  globalMapScene,
  globalMapSignature,
  mapCurve,
  mapFit,
  mapTitleLines,
  mapZoom,
  placeMapLabels,
  readGlobalMapCache,
  type GlobalMapScene,
  type GlobalMapLayout,
  type MapCamera,
  type MapPoint,
  type MapLabelBox,
} from "../../../util/topos/globalMap"
import { createGlobalMapField, type MapFieldSnapshot } from "../../../util/topos/globalMapField"
import { overviewKind, overviewTypeLabel } from "../../../util/topos/topicOverview"
import type { Concept, KnowledgeModel, Relation } from "../../../util/topos/types"
import "../../styles/globalMap.css"

type CloseReason = "dismiss" | "navigate" | "history"
export interface GlobalMapViewSnapshot {
  version: 1
  arrangement?: "continuous-1"
  signature: string
  selection?: string[]
  selected?: string
  camera: MapCamera
  width: number
  height: number
  layout?: GlobalMapLayout
  physics?: MapFieldSnapshot
}
type SavedMap = {
  scene: GlobalMapScene
  camera?: MapCamera
  width: number
  height: number
  selected?: string
  layout?: GlobalMapLayout
  field?: ReturnType<typeof createGlobalMapField>
}
let sequence = 0

/** The complete selected collection, with bounded local physics and separate screen labels. */
export function createGlobalMap(
  model: KnowledgeModel,
  callbacks: {
    open: (id: string) => void
    onClose?: (reason: "dismiss" | "navigate") => void
    embedded?: boolean
    onSelectionChange?: (ids: string[]) => void
    onViewChange?: () => void
  },
) {
  const ns = "http://www.w3.org/2000/svg"
  const uid = `global-map-${++sequence}`
  const element = document.createElement("dialog")
  element.className = "global-map topos-global-map"
  element.classList.toggle("global-map--embedded", Boolean(callbacks.embedded))
  element.dataset.globalMap = "true"
  const html = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
    parent: HTMLElement = element,
  ) => {
    const node = document.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }
  const svgNode = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    parent: SVGElement,
    attrs: Record<string, string> = {},
  ) => {
    const node = document.createElementNS(ns, tag)
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
    parent.append(node)
    return node
  }
  const siteRoot = new URL("./", location.href)
  const canonical = (concept: Concept) =>
    concept.href
      ? new URL(concept.href, siteRoot).href
      : new URL(`#focus=${encodeURIComponent(concept.id)}&depth=2.1`, siteRoot).href
  const header = html("header")
  header.className = "global-map-header"
  const heading = html("h2", callbacks.embedded ? "知识地图" : "全局地图", header)
  heading.id = `${uid}-title`
  element.setAttribute("aria-labelledby", heading.id)
  const count = html("p", "", header)
  count.setAttribute("role", "status")
  const close = html("button", callbacks.embedded ? "局部语境" : "关闭地图", header)
  close.type = "button"
  close.dataset.globalMapClose = "true"
  const controls = html("div")
  controls.className = "global-map-controls"
  const fit = html("button", "适应全图", controls)
  fit.dataset.globalMapFit = "true"
  const neighborhood = html("button", "聚焦当前联系", controls)
  neighborhood.type = "button"
  neighborhood.dataset.globalMapNeighborhood = "true"
  const connections = html("button", "联系与出处", controls)
  connections.type = "button"
  connections.dataset.globalMapConnections = "true"
  connections.setAttribute("aria-expanded", "false")
  connections.setAttribute("aria-controls", `${uid}-inspector`)
  connections.disabled = true
  const minus = html("button", "−", controls)
  minus.dataset.globalMapZoom = "out"
  minus.setAttribute("aria-label", "缩小地图")
  const plus = html("button", "+", controls)
  plus.dataset.globalMapZoom = "in"
  plus.setAttribute("aria-label", "放大地图")
  for (const button of [fit, minus, plus]) button.type = "button"
  const locatorLabel = html("label", "在图中定位", controls)
  const locator = html("select", "", locatorLabel)
  locator.dataset.globalMapLocate = "true"
  const body = html("div")
  body.className = "global-map-body"
  const stage = html("div", "", body)
  stage.className = "global-map-stage"
  stage.dataset.globalMapStage = "true"
  const canvas = document.createElementNS(ns, "svg")
  canvas.classList.add("global-map-canvas")
  canvas.setAttribute("tabindex", "0")
  canvas.setAttribute("role", "group")
  canvas.setAttribute(
    "aria-label",
    "完整知识地图。拖动圆点调整位置，空白拖动平移，滚轮缩放。键盘方向键平移，加减号缩放。",
  )
  stage.append(canvas)
  const defs = svgNode("defs", canvas)
  const marker = svgNode("marker", defs, {
    id: `${uid}-arrow`,
    viewBox: "0 0 8 8",
    refX: "7",
    refY: "4",
    markerWidth: "5",
    markerHeight: "5",
    orient: "auto",
    markerUnits: "strokeWidth",
  })
  svgNode("path", marker, { d: "M 0 0 L 8 4 L 0 8 Z", fill: "context-stroke" })
  const cameraLayer = svgNode("g", canvas)
  const groupLayer = svgNode("g", cameraLayer)
  const edgeLayer = svgNode("g", cameraLayer)
  const leaderLayer = svgNode("g", canvas)
  const labelLayer = svgNode("g", canvas)
  const nodeCameraLayer = svgNode("g", canvas)
  const nodeLayer = svgNode("g", nodeCameraLayer)
  const empty = html("p", "尚未选择主题。关闭地图后，勾选想浏览的领域。", stage)
  if (callbacks.embedded)
    empty.textContent = "从主题栏勾选想浏览的领域，节点和已有联系会在这里展开。"
  empty.className = "global-map-empty"
  empty.hidden = true
  const inspector = html("aside", "", body)
  inspector.className = "global-map-inspector"
  inspector.id = `${uid}-inspector`
  inspector.setAttribute("aria-label", "所选对象与真实联系")
  const instruction = html(
    "p",
    "远景看主题，近景看名称与联系 · 拖动圆点 · 空白平移 · 滚轮或双指缩放",
  )
  instruction.className = "global-map-hint"
  const scopeNote = html(
    "p",
    "颜色与主题名称帮助定位，节点共享同一空间；箭头按原记录方向显示。引用、目录关联与数学关系分别标注，距离不代表论证。",
  )
  scopeNote.className = "global-map-provenance"
  const maps = new Map<string, SavedMap>()
  const signature = globalMapSignature(model)
  const storageKey = `topos-global-map:1:${location.pathname}:${signature}`
  const knownIDs = new Set(model.concepts.map((node) => node.id))
  const allConcepts = new Map(model.concepts.map((node) => [node.id, node]))
  const allConnections = new Map(model.concepts.map((node) => [node.id, [] as Relation[]]))
  for (const relation of model.relations) {
    allConnections.get(relation.source)?.push(relation)
    if (relation.target !== relation.source) allConnections.get(relation.target)?.push(relation)
  }
  let stored: unknown
  try {
    stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null")
  } catch {
    /* Storage may be disabled. */
  }
  const restored = readGlobalMapCache(stored, signature, knownIDs)
  const movedPoints = new Map(
    restored.points.map((point) => [point.id, { x: point.x, y: point.y }]),
  )
  // Keep explicit manual drops from the prior map, but do not let its cached
  // rectangular default scene override the new continuous arrangement.
  const continuousCache =
    stored &&
    typeof stored === "object" &&
    "arrangement" in stored &&
    stored.arrangement === "continuous-1"
  const restoredViews = new Map(
    (continuousCache ? restored.views : []).map((view) => [view.key, view]),
  )
  let saved: SavedMap | undefined
  let field: ReturnType<typeof createGlobalMapField> | undefined
  let lastFrame = 0
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  const compactScreen = window.matchMedia("(max-width: 720px)")
  let inspectorExpanded = false
  let scene: GlobalMapScene = { nodes: [], relations: [], groups: [] }
  let byID = new Map<string, GlobalMapScene["nodes"][number]>()
  let camera: MapCamera = { x: 0, y: 0, k: 1 }
  let width = 1,
    height = 1
  let selected: string | undefined
  let hovered: string | undefined
  let returnTo: HTMLElement | undefined
  let selection: string[] | undefined
  let frame = 0
  let renderCount = 0
  let suppressedUntil = 0
  let pendingActivation: { kind: "node" | "theme"; id: string } | undefined
  let pinched = false
  let activeDrag:
    | {
        pointer: number
        id?: string
        group?: string
        start: MapPoint
        last: MapPoint
        offset: MapPoint
        moved: boolean
      }
    | undefined
  let pinch: { distance: number; midpoint: MapPoint; camera: MapCamera } | undefined
  let pendingDrag: { id: string; x: number; y: number } | undefined
  const pointers = new Map<number, MapPoint>()
  const nodes = new Map<string, SVGAElement>()
  const nodeCircles = new Map<string, { dot: SVGCircleElement; hit: SVGCircleElement }>()
  const paths = new Map<string, SVGPathElement>()
  const groupNodes = new Map<string, SVGGElement>()
  const groupLabels = new Map<string, SVGTextElement>()
  let themeBoxes: MapLabelBox[] = []
  let themeCamera: MapCamera = { x: 0, y: 0, k: 1 }
  const labels = new Map<
    string,
    { anchor: SVGAElement; leader: SVGPathElement; width: number; height: number }
  >()
  let labelBoxes: MapLabelBox[] = [],
    omittedLabelIDs: string[] = []
  let sceneDirty = true
  let labelDirty = true
  let previousPaintCamera: MapCamera | undefined
  let previousActive: string | undefined
  let previousSelected: string | undefined
  let viewRevision = 0
  let notifiedRevision = 0
  let queuedRevision = 0
  let viewChangeTimer: ReturnType<typeof setTimeout> | undefined
  let previousSize = ""
  let inspected = ""
  let restoringFocus = false
  let currentKey: string | undefined
  const paintedPositions = new Map<string, MapPoint>()
  let paintedLabels = new Set<string>()
  let labelCamera: MapCamera = { x: 0, y: 0, k: 1 }
  let labelPan: MapPoint = { x: 0, y: 0 }
  const work = {
    sceneJoins: 0,
    nodesCreated: 0,
    edgeWrites: 0,
    nodeWrites: 0,
    labelLayouts: 0,
    cameraOnlyFrames: 0,
    dragInputs: 0,
    dragApplications: 0,
  }
  const textContext = document.createElement("canvas").getContext("2d")
  if (textContext) textContext.font = "14px system-ui, sans-serif"

  function flushDrag() {
    if (!pendingDrag) return
    field?.drag(pendingDrag.id, pendingDrag.x, pendingDrag.y)
    movedPoints.set(pendingDrag.id, { x: pendingDrag.x, y: pendingDrag.y })
    pendingDrag = undefined
    work.dragApplications++
  }
  function notifySettledView() {
    if (!callbacks.onViewChange || viewRevision === notifiedRevision || activeDrag || pinch) return
    if (viewChangeTimer && queuedRevision === viewRevision) return
    if (viewChangeTimer) clearTimeout(viewChangeTimer)
    queuedRevision = viewRevision
    // A wheel burst can contain many settled camera-only frames. Publish its
    // final view once after input quiets, not one serialized history entry/frame.
    viewChangeTimer = setTimeout(() => {
      viewChangeTimer = undefined
      if (!element.open || frame || activeDrag || pinch || (field && !field.settled)) return
      notifiedRevision = viewRevision
      callbacks.onViewChange?.()
    }, 160)
  }
  function hide(reason: CloseReason = "dismiss") {
    pendingActivation = undefined
    if (!element.open) return
    flushDrag()
    if (field?.heldID) field.release(field.heldID)
    persist()
    activeDrag = undefined
    pinch = undefined
    pointers.clear()
    if (frame) cancelAnimationFrame(frame)
    if (viewChangeTimer) clearTimeout(viewChangeTimer)
    viewChangeTimer = undefined
    frame = 0
    lastFrame = 0
    element.close()
    setInspectorExpanded(false)
    if (reason !== "navigate") returnTo?.focus({ preventScroll: true })
    if (reason !== "history") callbacks.onClose?.(reason)
  }
  function navigate(id: string) {
    hide("navigate")
    callbacks.open(id)
  }
  function remember() {
    if (!saved) return
    saved.camera = { ...camera }
    saved.width = width
    saved.height = height
    saved.selected = selected
  }
  function persist() {
    remember()
    const views = new Map(restoredViews)
    for (const [key, map] of maps)
      if (map.camera)
        views.set(key, {
          key,
          camera: { ...map.camera },
          width: map.width,
          height: map.height,
          selected: map.selected,
          layout: map.layout,
          physics: map.field?.snapshot(),
        })
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          arrangement: "continuous-1",
          signature,
          points: [...movedPoints].map(([id, point]) => ({ id, ...point })),
          views: [...views.values()].slice(-32),
        }),
      )
    } catch {
      /* Reading and interaction remain available without session storage. */
    }
  }
  function requestPaint() {
    if (!element.open || frame) return
    frame = requestAnimationFrame((time) => {
      frame = 0
      if (!element.open || document.hidden) {
        lastFrame = 0
        return
      }
      const dt = lastFrame ? Math.min(0.05, (time - lastFrame) / 1000) : 1 / 60
      lastFrame = time
      // Only the latest pointer pose enters physics on this frame. Native
      // high-frequency input cannot queue a backlog of collision passes.
      flushDrag()
      if (field && !field.settled) {
        if (reducedMotion.matches && !activeDrag) field.settle()
        else field.step(dt)
        for (const node of field.nodes) {
          const target = byID.get(node.id)
          if (target) {
            target.x = node.x
            target.y = node.y
          }
        }
      }
      paint()
      if (field && !field.settled) requestPaint()
      else {
        lastFrame = 0
        notifySettledView()
      }
    })
  }
  function paint() {
    if (!element.open) return
    renderCount++
    const active = hovered ?? selected
    const cameraChanged =
      !previousPaintCamera ||
      camera.x !== previousPaintCamera.x ||
      camera.y !== previousPaintCamera.y ||
      camera.k !== previousPaintCamera.k
    const sizeChanged = previousSize !== `${width}/${height}`
    const scaleChanged = !previousPaintCamera || camera.k !== previousPaintCamera.k || sizeChanged
    const emphasisChanged = active !== previousActive || sceneDirty
    if (cameraChanged || sceneDirty) {
      const transform = `translate(${camera.x} ${camera.y}) scale(${camera.k})`
      cameraLayer.setAttribute("transform", transform)
      nodeCameraLayer.setAttribute("transform", transform)
    }
    const pointRadius = Math.max(7, Math.min(17, 3.2 / camera.k))
    const related = new Set<string>(active ? [active] : [])
    for (const edge of allConnections.get(active ?? "") ?? []) {
      related.add(edge.source)
      related.add(edge.target)
    }
    const moved = new Set<string>()
    for (const node of scene.nodes) {
      const link = nodes.get(node.id)!
      const old = paintedPositions.get(node.id)
      if (sceneDirty || !old || old.x !== node.x || old.y !== node.y) {
        moved.add(node.id)
        link.setAttribute("transform", `translate(${node.x} ${node.y})`)
        paintedPositions.set(node.id, { x: node.x, y: node.y })
        work.nodeWrites++
      }
      if (emphasisChanged) {
        link.classList.toggle("is-active", node.id === active)
        link.classList.toggle("is-related", related.has(node.id))
        link.classList.toggle("is-dim", Boolean(active && !related.has(node.id)))
      }
      if (scaleChanged || sceneDirty) {
        const circles = nodeCircles.get(node.id)!
        circles.dot.setAttribute("r", String(pointRadius))
        circles.hit.setAttribute("r", String(Math.max(18, Math.min(32, 10 / camera.k))))
      }
    }
    for (const edge of scene.relations) {
      const path = paths.get(edge.id)!
      if (sceneDirty || moved.has(edge.source) || moved.has(edge.target)) {
        path.setAttribute("d", mapCurve(byID.get(edge.source)!, byID.get(edge.target)!))
        work.edgeWrites++
      }
      if (emphasisChanged) {
        path.classList.toggle(
          "is-active",
          Boolean(active && (edge.source === active || edge.target === active)),
        )
        path.classList.toggle(
          "is-dim",
          Boolean(active && edge.source !== active && edge.target !== active),
        )
      }
    }
    if (scaleChanged || sceneDirty || labelDirty || moved.size) {
      const screenFont = Math.max(13, Math.min(18, 20 * camera.k))
      const themeItems = scene.groups.map((group) => {
        const label = groupLabels.get(group.id)!
        const points = group.ids.map((id) => byID.get(id)!).filter(Boolean)
        const x = points.reduce((sum, point) => sum + point.x, 0) / points.length
        const y = points.reduce((sum, point) => sum + point.y, 0) / points.length
        const spreadY = Math.sqrt(
          points.reduce((sum, point) => sum + (point.y - y) ** 2, 0) / points.length,
        )
        // A name is a light landmark in the shared field, never a container or
        // an invisible drag barrier. It follows its neighborhood's actual pose.
        const fontSize = screenFont / camera.k
        label.setAttribute("font-size", String(fontSize))
        const lines = mapTitleLines(group.title, 15)
        const signature = JSON.stringify(lines)
        if (label.dataset.lines !== signature) {
          label.replaceChildren()
          lines.forEach((line, i) => {
            svgNode("tspan", label, {
              x: "0",
              dy: i ? "1.18em" : "0",
            }).textContent = line
          })
          label.dataset.lines = signature
        }
        return {
          id: group.id,
          x: camera.x + x * camera.k,
          y: camera.y + (y - spreadY) * camera.k - 24,
          width:
            Math.max(
              ...lines.map((line) => textContext?.measureText(line).width ?? line.length * 14),
            ) *
              (screenFont / 14) +
            10,
          height: lines.length * screenFont * 1.18 + 6,
          priority: 1,
        }
      })
      const previous = themeBoxes.map((box) => ({
        ...box,
        x: camera.x + ((box.x - themeCamera.x) * camera.k) / themeCamera.k,
        y: camera.y + ((box.y - themeCamera.y) * camera.k) / themeCamera.k,
      }))
      // Prefer clear space beside marks, but never hide a theme entrance merely
      // because a dense overview has no large annotation-sized empty patch.
      const themeObstacles = scene.nodes.map((node) => ({
        x: camera.x + node.x * camera.k,
        y: camera.y + node.y * camera.k,
        radius: pointRadius * camera.k + 2,
      }))
      const clearPlacement = placeMapLabels(themeItems, width, height, themeObstacles, previous)
      const placement = clearPlacement.omitted.length
        ? placeMapLabels(themeItems, width, height, [], previous)
        : clearPlacement
      themeBoxes = placement.boxes
      themeCamera = { ...camera }
      for (const item of themeItems) {
        // Never move a mathematical node to fit a navigation annotation.
        const box = themeBoxes.find((box) => box.id === item.id)
        const group = groupNodes.get(item.id)!
        group.style.visibility = box ? "" : "hidden"
        if (box)
          group.setAttribute(
            "transform",
            `translate(${(box.x + box.width / 2 - camera.x) / camera.k} ${(box.y + screenFont - camera.y) / camera.k})`,
          )
      }
    }
    const needsLabels =
      sceneDirty || labelDirty || scaleChanged || emphasisChanged || moved.size > 0
    if (!needsLabels && cameraChanged) {
      // Screen labels move with a pure pan; no graph geometry or text is rebuilt.
      labelPan = { x: camera.x - labelCamera.x, y: camera.y - labelCamera.y }
      const transform = `translate(${labelPan.x} ${labelPan.y})`
      labelLayer.setAttribute("transform", transform)
      leaderLayer.setAttribute("transform", transform)
      work.cameraOnlyFrames++
    } else if (needsLabels) {
      work.labelLayouts++
      const visible = scene.nodes
        .map((node) => ({ node, x: camera.x + node.x * camera.k, y: camera.y + node.y * camera.k }))
        .filter(
          (point) =>
            point.x > -15 && point.x < width + 15 && point.y > -15 && point.y < height + 15,
        )
      const candidates = visible
        .filter(({ node }) => camera.k >= 0.62 || related.has(node.id))
        .map(({ node, x, y }) => ({
          id: node.id,
          x,
          y,
          width: labels.get(node.id)!.width,
          height: labels.get(node.id)!.height,
          priority: node.id === active ? 100 : related.has(node.id) ? 10 : 1,
        }))
      const obstacles = visible.map(({ x, y }) => ({
        x,
        y,
        radius: Math.max(4, pointRadius * camera.k) + 4,
      }))
      const previous = labelBoxes.map((box) => ({
        ...box,
        x: box.x + labelPan.x,
        y: box.y + labelPan.y,
      }))
      const themeNames = themeBoxes.map((box) => ({
        ...box,
        x: camera.x + ((box.x - themeCamera.x) * camera.k) / themeCamera.k,
        y: camera.y + ((box.y - themeCamera.y) * camera.k) / themeCamera.k,
      }))
      const placement = placeMapLabels(candidates, width, height, obstacles, previous, themeNames)
      labelBoxes = placement.boxes
      omittedLabelIDs = placement.omitted
      const nextLabels = new Set(labelBoxes.map((box) => box.id))
      for (const id of paintedLabels)
        if (!nextLabels.has(id)) {
          labels.get(id)!.anchor.style.display = "none"
          labels.get(id)!.leader.style.display = "none"
        }
      labelLayer.removeAttribute("transform")
      leaderLayer.removeAttribute("transform")
      labelCamera = { ...camera }
      labelPan = { x: 0, y: 0 }
      for (const box of labelBoxes) {
        const label = labels.get(box.id)!,
          point = byID.get(box.id)!
        const x = camera.x + point.x * camera.k,
          y = camera.y + point.y * camera.k
        label.anchor.style.display = ""
        label.anchor.classList.toggle("is-active", box.id === active)
        label.anchor.setAttribute("transform", `translate(${box.x} ${box.y})`)
        label.leader.style.display = ""
        label.leader.setAttribute(
          "d",
          `M ${x} ${y} L ${Math.max(box.x, Math.min(box.x + box.width, x))} ${Math.max(box.y, Math.min(box.y + box.height, y))}`,
        )
      }
      paintedLabels = nextLabels
    }
    if (sceneDirty || cameraChanged || sizeChanged || moved.size || selected !== previousSelected)
      viewRevision++
    previousSelected = selected
    sceneDirty = false
    labelDirty = false
    previousPaintCamera = { ...camera }
    previousActive = active
    previousSize = `${width}/${height}`
    element.dataset.renderCount = String(renderCount)
    remember()
  }
  function readLink(parent: HTMLElement, concept: Concept, text: string) {
    const anchor = html("a", text, parent)
    anchor.href = canonical(concept)
    anchor.dataset.globalMapRead = concept.id
    anchor.addEventListener("click", (event) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      navigate(concept.id)
    })
    return anchor
  }
  function inspect(id?: string) {
    const inspectionKey = `${id ?? ""}/${currentKey ?? ""}`
    if (inspectionKey === inspected) return
    inspected = inspectionKey
    inspector.replaceChildren()
    const node = id ? byID.get(id) : undefined
    neighborhood.disabled = !node
    connections.disabled = !node
    if (!node) {
      html("h3", "在图中选择一个对象", inspector)
      html(
        "p",
        "指向名称或用键盘移到圆点，查看完整名称与有依据的联系。所有勾选主题中的对象都在这张图里。",
        inspector,
      )
      return
    }
    const concept = node.concept
    html("p", overviewTypeLabel(overviewKind(concept)), inspector).className = "global-map-kind"
    const title = html("h3", concept.title, inspector)
    title.tabIndex = -1
    html(
      "p",
      (model.topics ?? [])
        .filter((topic) => concept.topicIDs?.includes(topic.id))
        .map((topic) => topic.title)
        .join(" · "),
      inspector,
    )
    readLink(inspector, concept, "打开阅读").className = "global-map-read"
    if (concept.sourceHref) {
      const source = html("a", "原文出处", inspector)
      source.href = new URL(concept.sourceHref, siteRoot).href
    }
    const physical = field?.nodes.find((item) => item.id === id)
    if (physical) {
      const details = html("details", "", inspector)
      details.className = "global-map-mechanics"
      html("summary", "位置与布局", details)
      html(
        "p",
        "每个对象有自己的参考位置。拖动会更新它，真实联系提供有限牵引；碰撞边界优先保留圆点的空间。文字不会挤掉节点。这些布局参数不表示数学重要性或论证。",
        details,
      )
      html(
        "small",
        `参考位置 (${Math.round(physical.anchorX)}, ${Math.round(physical.anchorY)}) · 质量 ${physical.mass.toFixed(2)} · 归位 ${physical.attraction.toFixed(2)} · 排斥 ${Math.round(physical.charge)} · 半径 ${physical.radius}`,
        details,
      )
    }
    const relations = allConnections.get(id!) ?? []
    const outside = relations.filter(
      (edge) => !byID.has(edge.source === id ? edge.target : edge.source),
    )
    const relationsHeading = html(
      "h4",
      `直接联系 · ${relations.length}${outside.length ? ` · 范围外 ${outside.length}` : ""}`,
      inspector,
    )
    relationsHeading.tabIndex = -1
    relationsHeading.dataset.globalMapRelationsHeading = "true"
    const list = html("ul", "", inspector)
    for (const edge of relations) {
      const row = html("li", "", list)
      row.dataset.globalMapRelation = edge.id
      const other = allConcepts.get(edge.source === id ? edge.target : edge.source)!
      const inScope = byID.has(other.id)
      row.dataset.mapRelationScope = inScope ? "visible" : "outside"
      const provenance =
        edge.provenance === "structure"
          ? "结构关联"
          : edge.provenance === "reference"
            ? "正文引用"
            : "原文关系"
      html("span", `${edge.source === id ? "→" : "←"} ${edge.label} · ${provenance}`, row)
      readLink(row, other, other.title)
      if (!inScope) {
        const names = (model.topics ?? [])
          .filter((topic) => other.topicIDs?.includes(topic.id))
          .map((topic) => topic.title)
        html("small", `所选范围外${names.length ? ` · ${names.join(" · ")}` : ""}`, row)
        const expand = html("button", "展开这处联系", row)
        expand.type = "button"
        expand.dataset.globalMapExpand = other.id
        expand.addEventListener("click", () => {
          const next =
            selection === undefined
              ? undefined
              : [...new Set([...selection, ...(other.topicIDs ?? [])])]
          show(other.topicIDs?.length ? next : undefined, selected, returnTo)
          callbacks.onSelectionChange?.(
            other.topicIDs?.length ? next! : (model.topics ?? []).map((topic) => topic.id),
          )
          // Keep the original point and camera in place; locating the new point is explicit.
          inspector
            .querySelector<HTMLButtonElement>(
              `[data-global-map-locate-neighbor="${CSS.escape(other.id)}"]`,
            )
            ?.focus({ preventScroll: true })
        })
      } else {
        const locate = html("button", "在图中定位", row)
        locate.type = "button"
        locate.dataset.globalMapLocateNeighbor = other.id
        locate.addEventListener("click", () => {
          setInspectorExpanded(false)
          select(other.id, true)
          nodes.get(other.id)?.focus({ preventScroll: true })
        })
      }
      const reason = html(
        "p",
        edge.explanation || edge.evidence || "该关系按现有记录展示；未提供进一步解释。",
        row,
      )
      reason.className = "global-map-reason"
      reason.dataset.globalMapReason = edge.id
      if (edge.evidenceHref) {
        const evidence = html("a", "查看依据", row)
        evidence.href = new URL(edge.evidenceHref, siteRoot).href
        evidence.className = "global-map-evidence"
        evidence.title = edge.evidence || edge.explanation
      } else if (edge.evidence) html("small", edge.evidence, row)
    }
    if (!relations.length) html("p", "当前公开模型没有记录这处对象的直接联系。", inspector)
  }
  function select(id: string, center = false) {
    if (!byID.has(id)) return
    selected = id
    locator.value = id
    inspect(id)
    if (center) {
      const node = byID.get(id)!
      camera.k = Math.max(0.85, camera.k)
      camera.x = width * 0.42 - node.x * camera.k
      camera.y = height * 0.35 - node.y * camera.k
      labelDirty = true
    }
    requestPaint()
  }
  function locateGroup(id: string) {
    const current = scene.groups.find((item) => item.id === id)
    if (!current) return
    const ids = new Set(current.ids)
    camera = mapFit(
      scene.nodes.filter((node) => ids.has(node.id)),
      width,
      height,
    )
    labelDirty = true
    requestPaint()
  }
  function renderScene() {
    work.sceneJoins++
    sceneDirty = true
    inspected = ""
    byID = new Map(scene.nodes.map((node) => [node.id, node]))
    const edgeIDs = new Set(scene.relations.map((edge) => edge.id))
    const groups = new Set(scene.groups.map((group) => group.id))
    for (const [id, node] of nodes)
      if (!byID.has(id)) {
        node.remove()
        labels.get(id)!.anchor.remove()
        labels.get(id)!.leader.remove()
      }
    for (const [id, path] of paths) if (!edgeIDs.has(id)) path.remove()
    for (const [id, group] of groupNodes) if (!groups.has(id)) group.remove()
    labelBoxes = labelBoxes.filter((box) => byID.has(box.id))
    for (const group of scene.groups) {
      let collection = groupNodes.get(group.id)
      if (!collection) {
        collection = svgNode("g", groupLayer, {
          "data-global-map-group": group.id,
          tabindex: "0",
          role: "button",
          "aria-label": `定位主题：${group.title}`,
        })
        collection.classList.add("global-map-group")
        const label = svgNode("text", collection, {
          fill: group.color,
          "aria-label": group.title,
          "text-anchor": "middle",
          x: "0",
          y: "0",
        })
        label.textContent = group.title
        groupLabels.set(group.id, label)
        groupNodes.set(group.id, collection)
        collection.addEventListener("click", (event) => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.shiftKey ||
            performance.now() < suppressedUntil
          )
            return
          event.preventDefault()
          locateGroup(group.id)
        })
        collection.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          event.stopPropagation()
          locateGroup(group.id)
        })
      } else if (collection.parentNode !== groupLayer) groupLayer.append(collection)
      const label = groupLabels.get(group.id)!
      delete label.dataset.lines
    }
    for (const edge of scene.relations) {
      const existing = paths.get(edge.id)
      if (existing) {
        if (existing.parentNode !== edgeLayer) edgeLayer.append(existing)
        continue
      }
      const path = svgNode("path", edgeLayer, {
        "data-global-map-edge": edge.id,
        "data-source": edge.source,
        "data-target": edge.target,
        "marker-end": `url(#${uid}-arrow)`,
        "vector-effect": "non-scaling-stroke",
      })
      path.classList.add("global-map-edge")
      path.dataset.provenance = edge.provenance ?? "authored"
      const title = svgNode("title", path)
      title.textContent = `${byID.get(edge.source)!.concept.title} → ${byID.get(edge.target)!.concept.title} · ${edge.label}`
      paths.set(edge.id, path)
    }
    for (const node of scene.nodes) {
      const existing = nodes.get(node.id)
      if (existing) {
        if (existing.parentNode !== nodeLayer) nodeLayer.append(existing)
        const label = labels.get(node.id)!
        if (label.anchor.parentNode !== labelLayer) labelLayer.append(label.anchor)
        if (label.leader.parentNode !== leaderLayer) leaderLayer.append(label.leader)
        continue
      }
      work.nodesCreated++
      const anchor = svgNode("a", nodeLayer, {
        href: canonical(node.concept),
        tabindex: "0",
        "data-global-map-node": node.id,
        "aria-label": `${overviewTypeLabel(overviewKind(node.concept))}：${node.concept.title}`,
      })
      anchor.classList.add("global-map-node")
      anchor.style.setProperty(
        "--map-node-color",
        node.concept.color ??
          scene.groups.find((group) => group.id === node.group)?.color ??
          "#517184",
      )
      const hit = svgNode("circle", anchor, { r: "18", class: "global-map-hit" })
      const dot = svgNode("circle", anchor, {
        r: "9",
        class: "global-map-dot",
        "vector-effect": "non-scaling-stroke",
      })
      nodeCircles.set(node.id, { hit, dot })
      const labelAnchor = svgNode("a", labelLayer, {
        href: canonical(node.concept),
        tabindex: "-1",
        "data-global-map-label": node.id,
        "aria-label": node.concept.title,
      })
      labelAnchor.classList.add("global-map-label")
      labelAnchor.style.display = "none"
      const lines = mapTitleLines(node.concept.title, 12)
      const labelWidth =
        Math.max(...lines.map((line) => textContext?.measureText(line).width ?? line.length * 14)) +
        8
      const labelHeight = lines.length * 18 + 8
      svgNode("rect", labelAnchor, {
        width: String(labelWidth),
        height: String(labelHeight),
        rx: "2",
      })
      const label = svgNode("text", labelAnchor, { x: "4", y: "17", "font-size": "14" })
      lines.forEach((line, index) => {
        const span = svgNode("tspan", label, { x: "4", dy: index ? "18" : "0" })
        span.textContent = line
      })
      const leader = svgNode("path", leaderLayer, { class: "global-map-label-leader" })
      leader.style.display = "none"
      labels.set(node.id, { anchor: labelAnchor, leader, width: labelWidth, height: labelHeight })
      const title = svgNode("title", anchor)
      title.textContent = node.concept.title
      const enter = () => {
        if (!activeDrag && !pinch) {
          hovered = node.id
          inspect(node.id)
          requestPaint()
        }
      }
      const leave = () => {
        if (hovered === node.id) {
          hovered = undefined
          inspect(selected)
          requestPaint()
        }
      }
      anchor.addEventListener("pointerenter", enter)
      anchor.addEventListener("pointerleave", leave)
      labelAnchor.addEventListener("pointerenter", enter)
      labelAnchor.addEventListener("pointerleave", leave)
      anchor.addEventListener("focus", () =>
        select(node.id, !restoringFocus && !activeDrag && !pointers.size),
      )
      const click = (event: MouseEvent) => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        if (performance.now() < suppressedUntil) return
        navigate(node.id)
      }
      anchor.addEventListener("click", click)
      labelAnchor.addEventListener("click", click)
      nodes.set(node.id, anchor)
    }
    locator.replaceChildren()
    const prompt = html("option", "选择一个名称…", locator)
    prompt.value = ""
    for (const node of scene.nodes) html("option", node.concept.title, locator).value = node.id
    count.textContent = `${scene.nodes.length} 个对象 · ${scene.relations.length} 条已记录联系`
    empty.hidden = scene.nodes.length > 0
  }
  function resize() {
    const box = stage.getBoundingClientRect()
    if (!element.open || box.width <= 0 || box.height <= 0) return
    const nextWidth = box.width,
      nextHeight = box.height
    if (nextWidth === width && nextHeight === height) return
    if (saved?.camera) {
      camera.x += (nextWidth - width) / 2
      camera.y += (nextHeight - height) / 2
    } else camera = mapFit(scene.nodes, nextWidth, nextHeight)
    width = nextWidth
    height = nextHeight
    canvas.setAttribute("viewBox", `0 0 ${width} ${height}`)
    labelDirty = true
    requestPaint()
  }
  function setInspectorExpanded(expanded: boolean, restoreFocus = false) {
    inspectorExpanded = expanded && compactScreen.matches
    element.classList.toggle("global-map--connections", inspectorExpanded)
    connections.setAttribute("aria-expanded", String(inspectorExpanded))
    connections.textContent = inspectorExpanded ? "返回地图" : "联系与出处"
    if (!inspectorExpanded) resize()
    if (restoreFocus) connections.focus({ preventScroll: true })
  }
  function show(
    chosen?: string[],
    focus?: string,
    trigger?: HTMLElement,
    options: { restoreView?: boolean } = {},
  ) {
    pendingActivation = undefined
    const wasOpen = element.open
    const nextKey = chosen === undefined ? "all" : JSON.stringify([...chosen].sort())
    const sameScene = currentKey === nextKey && saved
    if (sameScene) {
      if (options.restoreView && saved?.selected) selected = saved.selected
      else if (focus && byID.has(focus)) selected = focus
      hovered = undefined
      if (trigger) returnTo = trigger
      inspect(selected)
      if (selected) locator.value = selected
      if (!wasOpen) {
        if (callbacks.embedded) element.show()
        else element.showModal()
      }
      resize()
      requestPaint()
      if (!wasOpen && !callbacks.embedded) close.focus({ preventScroll: true })
      return
    }
    flushDrag()
    const liveCamera = { ...camera }
    const liveSize = { width, height }
    const keepLive = wasOpen && !options.restoreView
    const retained = new Map(movedPoints)
    if (keepLive) for (const node of scene.nodes) retained.set(node.id, { x: node.x, y: node.y })
    const previousSnapshot = keepLive ? field?.snapshot() : undefined
    const previousPhysics = new Map((previousSnapshot?.nodes ?? []).map((node) => [node.id, node]))
    remember()
    if (field?.heldID) field.release(field.heldID)
    suppressedUntil = 0
    pinched = false
    activeDrag = undefined
    pinch = undefined
    pointers.clear()
    stage.classList.remove("is-grabbing")
    selection = chosen ? [...chosen] : undefined
    const key = nextKey
    currentKey = key
    saved = maps.get(key)
    if (!saved || keepLive) {
      const cached = restoredViews.get(key)
      const layout =
        saved?.layout ??
        (cached
          ? cached.layout
          : window.innerWidth <= 720
            ? { columns: 2, headingSpace: 240 }
            : undefined)
      saved = {
        scene: globalMapScene(model, selection, retained, layout),
        width: keepLive ? liveSize.width : (cached?.width ?? 1),
        height: keepLive ? liveSize.height : (cached?.height ?? 1),
        camera: keepLive ? liveCamera : cached?.camera,
        selected: cached?.selected,
        layout,
      }
      maps.set(key, saved)
      if (maps.size > 32) maps.delete(maps.keys().next().value!)
    }
    scene = saved.scene
    field = saved.field ?? createGlobalMapField(scene.nodes, scene.relations)
    if (!saved.field && !keepLive) field.restore(restoredViews.get(key)?.physics)
    if (keepLive && previousPhysics.size) {
      const fresh = field.snapshot()
      field.restore({
        ...fresh,
        nodes: fresh.nodes.map((node) => previousPhysics.get(node.id) ?? node),
        restLengths: Object.fromEntries(
          Object.entries(fresh.restLengths ?? {}).map(([id, length]) => [
            id,
            previousSnapshot?.restLengths?.[id] ?? length,
          ]),
        ),
        settled: false,
      })
    }
    saved.field = field
    for (const node of field.nodes) {
      const moved = movedPoints.get(node.id)
      if (
        !options.restoreView &&
        !keepLive &&
        moved &&
        Math.hypot(moved.x - node.anchorX, moved.y - node.anchorY) > 0.001
      ) {
        field.drag(node.id, moved.x, moved.y)
        field.release(node.id)
      }
      const target = scene.nodes.find((point) => point.id === node.id)!
      target.x = node.x
      target.y = node.y
    }
    selected =
      options.restoreView && saved.selected
        ? saved.selected
        : focus && scene.nodes.some((node) => node.id === focus)
          ? focus
          : saved.selected
    hovered = undefined
    camera = saved.camera ? { ...saved.camera } : { x: 0, y: 0, k: 1 }
    width = saved.width
    height = saved.height
    returnTo =
      trigger ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
    renderScene()
    inspect(selected)
    if (selected) locator.value = selected
    if (!wasOpen) {
      if (callbacks.embedded) element.show()
      else element.showModal()
    }
    canvas.setAttribute("viewBox", `0 0 ${width} ${height}`)
    resize()
    requestPaint()
    if (!wasOpen && !callbacks.embedded) close.focus({ preventScroll: true })
  }
  const local = (event: { clientX: number; clientY: number }): MapPoint => {
    const box = stage.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }
  const midpoint = () => {
    const [a, b] = [...pointers.values()]
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      midpoint: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }
  // Linked SVG marks otherwise start a native URL drag, cancelling the pointer
  // stream after its first movement. Only that drag is suppressed; link clicks
  // and modifier/new-tab activation keep their browser behavior.
  canvas.addEventListener("dragstart", (event) => {
    if ((event.target as Element).closest("[data-global-map-node], [data-global-map-label]")) {
      event.preventDefault()
      event.stopPropagation()
    }
  })
  stage.addEventListener("pointerdown", (event) => {
    pendingActivation = undefined
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const point = local(event)
    pointers.set(event.pointerId, point)
    stage.setPointerCapture(event.pointerId)
    if (pointers.size === 2) {
      flushDrag()
      if (field?.heldID) field.release(field.heldID)
      const pair = midpoint()
      pinch = { ...pair, camera: { ...camera } }
      activeDrag = undefined
      pinched = true
      return
    }
    // Chromium can retarget a touch on a theme glyph to a nearby small link.
    // Use the actual topmost painted hit: visible node marks still win, while
    // a visibly touched theme name cannot silently open a neighboring article.
    const hit =
      event.pointerType === "touch"
        ? (document.elementFromPoint(event.clientX, event.clientY) ?? (event.target as Element))
        : (event.target as Element)
    const target = hit.closest<SVGAElement>("[data-global-map-node], [data-global-map-label]")
    const id = target?.dataset.globalMapNode ?? target?.dataset.globalMapLabel
    const group = id
      ? undefined
      : hit.closest<SVGGElement>("[data-global-map-group]")?.dataset.globalMapGroup
    const node = id ? byID.get(id) : undefined
    activeDrag = {
      pointer: event.pointerId,
      id,
      group,
      start: point,
      last: point,
      offset: node
        ? {
            x: node.x - (point.x - camera.x) / camera.k,
            y: node.y - (point.y - camera.y) / camera.k,
          }
        : { x: 0, y: 0 },
      moved: false,
    }
    if (id) {
      selected = id
      inspect(id)
    }
    stage.classList.add("is-grabbing")
    requestPaint()
  })
  stage.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return
    const point = local(event)
    pointers.set(event.pointerId, point)
    if (pinch && pointers.size >= 2) {
      const pair = midpoint()
      camera = mapZoom(pinch.camera, pair.distance / Math.max(1, pinch.distance), pinch.midpoint)
      camera.x += pair.midpoint.x - pinch.midpoint.x
      camera.y += pair.midpoint.y - pinch.midpoint.y
      requestPaint()
      return
    }
    if (!activeDrag || activeDrag.pointer !== event.pointerId) return
    const drag = activeDrag
    drag.moved ||= Math.hypot(point.x - drag.start.x, point.y - drag.start.y) > 5
    if (!drag.moved) return
    if (drag.id) {
      const x = (point.x - camera.x) / camera.k + drag.offset.x,
        y = (point.y - camera.y) / camera.k + drag.offset.y
      pendingDrag = { id: drag.id, x, y }
      work.dragInputs++
    } else {
      camera.x += point.x - drag.last.x
      camera.y += point.y - drag.last.y
    }
    drag.last = point
    requestPaint()
  })
  const endPointer = (event: PointerEvent) => {
    flushDrag()
    const drag = activeDrag
    if (event.type === "pointercancel" || pinched) pendingActivation = undefined
    if (pinched) suppressedUntil = performance.now() + 300
    pointers.delete(event.pointerId)
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId)
    if (drag?.pointer === event.pointerId) {
      if (drag.id && drag.moved) field?.release(drag.id)
      if ((drag.id || drag.group) && !drag.moved && !pinched && event.type === "pointerup") {
        // Keep the original surface until its compatibility click is consumed.
        // Hiding it during pointerup can retarget a touch click to a prose link
        // underneath and navigate twice before the reader sees the first note.
        pendingActivation = drag.id
          ? { kind: "node", id: drag.id }
          : { kind: "theme", id: drag.group! }
      } else if (drag.moved || pinched) suppressedUntil = performance.now() + 300
      activeDrag = undefined
    }
    if (pointers.size < 2) pinch = undefined
    if (!pointers.size) {
      pinched = false
      stage.classList.remove("is-grabbing")
    }
    persist()
    labelDirty = true
    requestPaint()
  }
  stage.addEventListener("pointerup", endPointer)
  stage.addEventListener("pointercancel", endPointer)
  stage.addEventListener(
    "click",
    (event) => {
      if (
        !pendingActivation ||
        !event.detail ||
        event.button ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const activation = pendingActivation
      pendingActivation = undefined
      event.preventDefault()
      event.stopPropagation()
      // Pointer capture can make stage itself the click target; don't rely on
      // an anchor handler. Keyboard and modified link clicks remain native.
      if (activation.kind === "node") navigate(activation.id)
      else locateGroup(activation.id)
    },
    { capture: true },
  )
  stage.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault()
      event.stopPropagation()
      camera = mapZoom(
        camera,
        Math.exp(-Math.max(-200, Math.min(200, event.deltaY)) * 0.002),
        local(event),
      )
      requestPaint()
    },
    { passive: false },
  )
  element.addEventListener("keydown", (event) => {
    // The embedded map is part of the page, not a modal keyboard island.
    // In particular Ctrl/Cmd+K belongs to the shared search controller.
    if (callbacks.embedded && (event.ctrlKey || event.metaKey || event.altKey)) return
    if (!callbacks.embedded) event.stopPropagation()
    if (
      !callbacks.embedded &&
      event.key === "Tab" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      const available = [
        ...element.querySelectorAll<HTMLElement | SVGElement>(
          "a[href], button, input, select, textarea, [tabindex]",
        ),
      ].filter((candidate) => {
        if (
          candidate.tabIndex < 0 ||
          candidate.matches(":disabled, [aria-disabled='true']") ||
          candidate.closest("[hidden], [inert], [aria-hidden='true']") ||
          !candidate.getClientRects().length
        )
          return false
        const style = getComputedStyle(candidate)
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.visibility !== "collapse"
        )
      })
      const first = available[0],
        last = available.at(-1)
      const current = document.activeElement
      if (!first || !last) {
        event.preventDefault()
        close.focus({ preventScroll: true })
      } else if (
        !available.some((candidate) => candidate === current) ||
        (event.shiftKey ? current === first : current === last)
      ) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus({ preventScroll: true })
      }
      return
    }
    if (event.key === "Escape") {
      if (inspectorExpanded) {
        event.preventDefault()
        event.stopPropagation()
        setInspectorExpanded(false, true)
        return
      }
      if (callbacks.embedded) {
        event.preventDefault()
        event.stopPropagation()
        hide()
      }
      return
    }
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement ||
      (event.target instanceof HTMLElement && event.target.isContentEditable)
    )
      return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    // Source/relationship reading keeps its native Home and arrow scrolling.
    if (
      event.target instanceof Node &&
      inspector.contains(event.target) &&
      (event.key === "Home" || event.key.startsWith("Arrow"))
    )
      return
    if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault()
      event.stopPropagation()
      camera = mapZoom(camera, event.key === "-" ? 0.8 : 1.25, { x: width / 2, y: height / 2 })
      requestPaint()
    } else if (event.key === "Home") {
      event.preventDefault()
      event.stopPropagation()
      fit.click()
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault()
      event.stopPropagation()
      camera.x += event.key === "ArrowLeft" ? 45 : event.key === "ArrowRight" ? -45 : 0
      camera.y += event.key === "ArrowUp" ? 45 : event.key === "ArrowDown" ? -45 : 0
      labelDirty = true
      requestPaint()
    }
  })
  element.addEventListener("cancel", (event) => {
    event.preventDefault()
    if (inspectorExpanded) setInspectorExpanded(false, true)
    else hide()
  })
  close.addEventListener("click", () => hide())
  connections.addEventListener("click", () => {
    if (inspectorExpanded) {
      setInspectorExpanded(false, true)
      return
    }
    setInspectorExpanded(compactScreen.matches)
    const target = inspector.querySelector<HTMLElement>(
      compactScreen.matches ? "h3" : "[data-global-map-relations-heading]",
    )
    inspector.scrollTop = compactScreen.matches ? 0 : (target?.offsetTop ?? 0) - inspector.offsetTop
    target?.focus({ preventScroll: true })
  })
  fit.addEventListener("click", () => {
    camera = mapFit(scene.nodes, width, height)
    labelDirty = true
    requestPaint()
  })
  neighborhood.addEventListener("click", () => {
    if (!selected) return
    const related = new Set([selected])
    for (const relation of allConnections.get(selected) ?? []) {
      related.add(relation.source)
      related.add(relation.target)
    }
    camera = mapFit(
      scene.nodes.filter((node) => related.has(node.id)),
      width,
      height,
    )
    labelDirty = true
    requestPaint()
  })
  for (const [button, factor] of [
    [minus, 0.75],
    [plus, 1.333333],
  ] as const)
    button.addEventListener("click", () => {
      camera = mapZoom(camera, factor, { x: width / 2, y: height / 2 })
      requestPaint()
    })
  locator.addEventListener("change", () => {
    if (locator.value) {
      select(locator.value, true)
      nodes.get(locator.value)?.focus({ preventScroll: true })
    }
  })
  const observer = new ResizeObserver(resize)
  observer.observe(stage)
  const screenChanged = () => {
    if (!compactScreen.matches && inspectorExpanded) setInspectorExpanded(false)
  }
  compactScreen.addEventListener("change", screenChanged)
  const visibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      lastFrame = 0
    } else requestPaint()
  }
  document.addEventListener("visibilitychange", visibility)
  window.addEventListener("pagehide", persist)
  return {
    element,
    show,
    hide,
    focusSelected() {
      const node = selected ? byID.get(selected) : undefined
      if (!node || !element.open) return
      const x = camera.x + node.x * camera.k,
        y = camera.y + node.y * camera.k
      restoringFocus = true
      if (x >= 12 && y >= 12 && x <= width - 12 && y <= height - 12)
        nodes.get(node.id)?.focus({ preventScroll: true })
      else
        inspector
          .querySelector<HTMLAnchorElement>(".global-map-read")
          ?.focus({ preventScroll: true })
      restoringFocus = false
    },
    captureView(): GlobalMapViewSnapshot | undefined {
      if (!saved) return undefined
      return {
        version: 1,
        arrangement: "continuous-1",
        signature,
        selection: selection ? [...selection] : undefined,
        selected,
        camera: { ...camera },
        width,
        height,
        layout: saved.layout ? { ...saved.layout } : undefined,
        physics: field?.snapshot(),
      }
    },
    restoreView(value: unknown) {
      if (!value || typeof value !== "object") return false
      const view = value as Partial<GlobalMapViewSnapshot>
      const finite = (n: unknown): n is number =>
        typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 1e7
      if (
        view.version !== 1 ||
        view.arrangement !== "continuous-1" ||
        view.signature !== signature ||
        !view.camera ||
        ![view.camera.x, view.camera.y, view.camera.k, view.width, view.height].every(finite) ||
        view.camera.k < 0.005 ||
        view.camera.k > 4 ||
        view.width! < 1 ||
        view.height! < 1
      )
        return false
      const knownTopics = new Set((model.topics ?? []).map((topic) => topic.id))
      if (
        view.selection !== undefined &&
        (!Array.isArray(view.selection) ||
          view.selection.length > knownTopics.size ||
          view.selection.some((id) => typeof id !== "string" || !knownTopics.has(id)) ||
          new Set(view.selection).size !== view.selection.length)
      )
        return false
      if (
        !view.physics ||
        !Array.isArray(view.physics.nodes) ||
        view.physics.nodes.length > knownIDs.size
      )
        return false
      if (
        view.layout &&
        (!finite(view.layout.columns ?? 1) ||
          !finite(view.layout.headingSpace ?? 75) ||
          (view.layout.columns ?? 1) < 1 ||
          (view.layout.headingSpace ?? 75) < 0)
      )
        return false
      const retained = new Map(
        view.physics.nodes
          .filter((node) => node && typeof node.id === "string" && finite(node.x) && finite(node.y))
          .map((node) => [node.id, { x: node.x, y: node.y }]),
      )
      const nextScene = globalMapScene(model, view.selection, retained, view.layout)
      const nextField = createGlobalMapField(nextScene.nodes, nextScene.relations)
      if (!nextField.restore(view.physics)) return false
      if (view.selected !== undefined && !nextScene.nodes.some((node) => node.id === view.selected))
        return false
      const key = view.selection === undefined ? "all" : JSON.stringify([...view.selection].sort())
      maps.set(key, {
        scene: nextScene,
        field: nextField,
        camera: { ...view.camera },
        width: view.width!,
        height: view.height!,
        selected: view.selected,
        layout: view.layout,
      })
      if (maps.size > 32) maps.delete(maps.keys().next().value!)
      if (key === currentKey) currentKey = undefined
      return true
    },
    snapshot() {
      const box = stage.getBoundingClientRect()
      return {
        open: element.open,
        backend: "svg",
        settled: !frame && !activeDrag && !pinch && (field?.settled ?? true),
        heldID: field?.heldID,
        selected,
        selection: selection ? [...selection] : undefined,
        eligibleIDs: scene.nodes.map((node) => node.id),
        nodeIDs: scene.nodes.map((node) => node.id),
        edgeIDs: scene.relations.map((edge) => edge.id),
        positions: scene.nodes.map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          screenX: box.left + camera.x + node.x * camera.k,
          screenY: box.top + camera.y + node.y * camera.k,
          ...(() => {
            const physical = field?.nodes.find((point) => point.id === node.id)
            return physical
              ? {
                  vx: physical.vx,
                  vy: physical.vy,
                  anchorX: physical.anchorX,
                  anchorY: physical.anchorY,
                  radius: physical.radius,
                  mass: physical.mass,
                  attraction: physical.attraction,
                  charge: physical.charge,
                }
              : {}
          })(),
        })),
        camera: { ...camera },
        width,
        height,
        renderCount,
        viewNotificationPending: viewRevision !== notifiedRevision,
        renderWork: { ...work },
        labelPlacements: labelBoxes.map((box) => ({
          ...box,
          x: box.x + labelPan.x,
          y: box.y + labelPan.y,
        })),
        omittedLabelIDs: [...omittedLabelIDs],
        groups: scene.groups.map((group) => ({
          id: group.id,
          title: group.title,
          ids: [...group.ids],
        })),
      }
    },
    destroy() {
      if (element.open) hide("history")
      observer.disconnect()
      compactScreen.removeEventListener("change", screenChanged)
      window.removeEventListener("pagehide", persist)
      document.removeEventListener("visibilitychange", visibility)
      if (frame) cancelAnimationFrame(frame)
      element.remove()
    },
  }
}
