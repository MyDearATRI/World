import {
  globalMapScene,
  globalMapSignature,
  mapCurve,
  mapFit,
  mapTitleLines,
  mapZoom,
  readGlobalMapCache,
  type GlobalMapScene,
  type GlobalMapLayout,
  type MapCamera,
  type MapPoint,
} from "../../../util/topos/globalMap"
import { overviewKind, overviewTypeLabel } from "../../../util/topos/topicOverview"
import type { Concept, KnowledgeModel } from "../../../util/topos/types"
import "../../styles/globalMap.css"

type CloseReason = "dismiss" | "navigate" | "history"
type SavedMap = {
  scene: GlobalMapScene
  camera?: MapCamera
  width: number
  height: number
  selected?: string
  layout?: GlobalMapLayout
}
let sequence = 0

/** The complete selected collection; there is no pagination or force simulation here. */
export function createGlobalMap(
  model: KnowledgeModel,
  callbacks: { open: (id: string) => void; onClose?: (reason: "dismiss" | "navigate") => void },
) {
  const ns = "http://www.w3.org/2000/svg"
  const uid = `global-map-${++sequence}`
  const element = document.createElement("dialog")
  element.className = "global-map topos-global-map"
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
  const heading = html("h2", "全局地图", header)
  heading.id = `${uid}-title`
  element.setAttribute("aria-labelledby", heading.id)
  const count = html("p", "", header)
  count.setAttribute("role", "status")
  const close = html("button", "关闭地图", header)
  close.type = "button"
  close.dataset.globalMapClose = "true"
  const controls = html("div")
  controls.className = "global-map-controls"
  const fit = html("button", "适应全图", controls)
  fit.dataset.globalMapFit = "true"
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
  const nodeLayer = svgNode("g", cameraLayer)
  const empty = html("p", "尚未选择主题。关闭地图后，勾选想浏览的领域。", stage)
  empty.className = "global-map-empty"
  empty.hidden = true
  const inspector = html("aside", "", body)
  inspector.className = "global-map-inspector"
  inspector.setAttribute("aria-label", "所选对象与真实联系")
  const instruction = html("p", "拖动圆点 · 拖动空白平移 · 滚轮或双指缩放 · 点击名称阅读")
  instruction.className = "global-map-hint"
  const scopeNote = html(
    "p",
    "主题分区用于定位；箭头按原记录方向显示。引用、目录关联与数学关系分别标注，不把空间距离当作论证。",
  )
  scopeNote.className = "global-map-provenance"
  const maps = new Map<string, SavedMap>()
  const signature = globalMapSignature(model)
  const storageKey = `topos-global-map:1:${location.pathname}:${signature}`
  const knownIDs = new Set(model.concepts.map((node) => node.id))
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
  const restoredViews = new Map(restored.views.map((view) => [view.key, view]))
  let saved: SavedMap | undefined
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
  let pinched = false
  let activeDrag:
    | {
        pointer: number
        id?: string
        start: MapPoint
        last: MapPoint
        offset: MapPoint
        moved: boolean
      }
    | undefined
  let pinch: { distance: number; midpoint: MapPoint; camera: MapCamera } | undefined
  const pointers = new Map<number, MapPoint>()
  const nodes = new Map<string, SVGAElement>()
  const paths = new Map<string, SVGPathElement>()
  const groupLabels = new Map<string, SVGTextElement>()

  function hide(reason: CloseReason = "dismiss") {
    if (!element.open) return
    persist()
    activeDrag = undefined
    pinch = undefined
    pointers.clear()
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    element.close()
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
        })
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
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
    frame = requestAnimationFrame(() => {
      frame = 0
      paint()
    })
  }
  function paint() {
    if (!element.open) return
    renderCount++
    cameraLayer.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.k})`)
    const active = hovered ?? selected
    const related = new Set<string>(active ? [active] : [])
    for (const edge of scene.relations)
      if (edge.source === active || edge.target === active) {
        related.add(edge.source)
        related.add(edge.target)
      }
    for (const node of scene.nodes) {
      const link = nodes.get(node.id)!
      const emphasized = node.id === active
      const showLabel = camera.k >= 0.62 || (emphasized && width > 720)
      link.setAttribute("transform", `translate(${node.x} ${node.y})`)
      link.classList.toggle("is-active", emphasized)
      link.classList.toggle("is-related", related.has(node.id))
      link.classList.toggle("is-dim", Boolean(active && !related.has(node.id)))
      link.classList.toggle("has-label", showLabel)
      link
        .querySelector(".global-map-dot")!
        .setAttribute("r", String(Math.max(7, Math.min(17, 3.2 / camera.k))))
      link.querySelector(".global-map-hit")!.setAttribute("r", String(Math.max(18, 10 / camera.k)))
      const text = link.querySelector("text")!
      text.style.visibility = showLabel ? "visible" : "hidden"
      text.setAttribute("font-size", String(emphasized ? Math.max(15, 14 / camera.k) : 15))
      const alignEnd = emphasized && camera.x + node.x * camera.k > width - 200
      text.setAttribute("text-anchor", alignEnd ? "end" : "start")
      text.setAttribute("x", alignEnd ? "-19" : "19")
      for (const line of text.querySelectorAll("tspan"))
        line.setAttribute("x", alignEnd ? "-19" : "19")
    }
    for (const edge of scene.relations) {
      const path = paths.get(edge.id)!
      path.setAttribute("d", mapCurve(byID.get(edge.source)!, byID.get(edge.target)!))
      path.classList.toggle(
        "is-active",
        Boolean(active && (edge.source === active || edge.target === active)),
      )
      path.classList.toggle(
        "is-dim",
        Boolean(active && edge.source !== active && edge.target !== active),
      )
    }
    for (const group of scene.groups) {
      const label = groupLabels.get(group.id)!
      const fontSize = Math.max(22, 14 / camera.k)
      label.setAttribute("font-size", String(fontSize))
      label.setAttribute("y", String(group.y + fontSize * 1.12))
      const screenWidth = Math.max(
        16,
        Math.min(group.labelWidth * camera.k, width - (camera.x + (group.x + 22) * camera.k) - 12),
      )
      const lines = mapTitleLines(
        group.title,
        Math.max(1, screenWidth / (fontSize * camera.k * 1.05)),
      )
      const signature = JSON.stringify(lines)
      if (label.dataset.lines !== signature) {
        label.replaceChildren()
        lines.forEach((line, i) => {
          svgNode("tspan", label, { x: String(group.x + 22), dy: i ? "1.18em" : "0" }).textContent =
            line
        })
        label.dataset.lines = signature
      }
    }
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
    inspector.replaceChildren()
    const node = id ? byID.get(id) : undefined
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
    html("h3", concept.title, inspector)
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
    const relations = scene.relations.filter((edge) => edge.source === id || edge.target === id)
    html("h4", `本图中的直接联系 · ${relations.length}`, inspector)
    const list = html("ul", "", inspector)
    for (const edge of relations) {
      const row = html("li", "", list)
      row.dataset.globalMapRelation = edge.id
      const other = byID.get(edge.source === id ? edge.target : edge.source)!.concept
      const provenance =
        edge.provenance === "structure"
          ? "结构关联"
          : edge.provenance === "reference"
            ? "正文引用"
            : "原文关系"
      html("span", `${edge.source === id ? "→" : "←"} ${edge.label} · ${provenance}`, row)
      readLink(row, other, other.title)
      if (edge.evidenceHref) {
        const evidence = html("a", "查看依据", row)
        evidence.href = new URL(edge.evidenceHref, siteRoot).href
        evidence.className = "global-map-evidence"
        evidence.title = edge.evidence || edge.explanation
      } else if (edge.evidence) html("small", edge.evidence, row)
    }
    if (!relations.length) html("p", "当前所选范围内没有已记录的直接联系。", inspector)
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
    }
    requestPaint()
  }
  function renderScene() {
    byID = new Map(scene.nodes.map((node) => [node.id, node]))
    groupLayer.replaceChildren()
    edgeLayer.replaceChildren()
    nodeLayer.replaceChildren()
    nodes.clear()
    paths.clear()
    groupLabels.clear()
    for (const group of scene.groups) {
      const collection = svgNode("g", groupLayer, { "data-global-map-group": group.id })
      svgNode("rect", collection, {
        x: String(group.x),
        y: String(group.y),
        width: String(group.width),
        height: String(group.height),
        rx: "12",
        stroke: group.color,
      })
      const label = svgNode("text", collection, {
        x: String(group.x + 22),
        y: String(group.y + 32),
        fill: group.color,
        "aria-label": group.title,
      })
      label.textContent = group.title
      groupLabels.set(group.id, label)
    }
    for (const edge of scene.relations) {
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
      svgNode("circle", anchor, { r: "18", class: "global-map-hit" })
      svgNode("circle", anchor, {
        r: "9",
        class: "global-map-dot",
        "vector-effect": "non-scaling-stroke",
      })
      const label = svgNode("text", anchor, { x: "19", y: "5" })
      mapTitleLines(node.concept.title, 12).forEach((line, index) => {
        const span = svgNode("tspan", label, { x: "19", dy: index ? "1.22em" : "0" })
        span.textContent = line
      })
      const title = svgNode("title", anchor)
      title.textContent = node.concept.title
      anchor.addEventListener("pointerenter", () => {
        if (!activeDrag && !pinch) {
          hovered = node.id
          inspect(node.id)
          requestPaint()
        }
      })
      anchor.addEventListener("pointerleave", () => {
        if (hovered === node.id) {
          hovered = undefined
          inspect(selected)
          requestPaint()
        }
      })
      anchor.addEventListener("focus", () => select(node.id, !activeDrag && !pointers.size))
      anchor.addEventListener("click", (event) => {
        if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        if (performance.now() < suppressedUntil) return
        navigate(node.id)
      })
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
    if (saved?.camera) {
      camera.x += (nextWidth - width) / 2
      camera.y += (nextHeight - height) / 2
    } else camera = mapFit(scene.nodes, nextWidth, nextHeight)
    width = nextWidth
    height = nextHeight
    canvas.setAttribute("viewBox", `0 0 ${width} ${height}`)
    requestPaint()
  }
  function show(chosen?: string[], focus?: string, trigger?: HTMLElement) {
    if (element.open) return
    suppressedUntil = 0
    pinched = false
    activeDrag = undefined
    pinch = undefined
    pointers.clear()
    stage.classList.remove("is-grabbing")
    selection = chosen ? [...chosen] : undefined
    const key = selection === undefined ? "all" : JSON.stringify([...selection].sort())
    saved = maps.get(key)
    if (!saved) {
      const cached = restoredViews.get(key)
      const layout = cached
        ? cached.layout
        : window.innerWidth <= 720
          ? { columns: 2, headingSpace: 240 }
          : undefined
      saved = {
        scene: globalMapScene(model, selection, movedPoints, layout),
        width: cached?.width ?? 1,
        height: cached?.height ?? 1,
        camera: cached?.camera,
        selected: cached?.selected,
        layout,
      }
      maps.set(key, saved)
    }
    scene = saved.scene
    for (const node of scene.nodes) {
      const moved = movedPoints.get(node.id)
      if (moved) {
        node.x = moved.x
        node.y = moved.y
      }
    }
    selected = saved.selected ?? (scene.nodes.some((node) => node.id === focus) ? focus : undefined)
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
    element.showModal()
    resize()
    close.focus({ preventScroll: true })
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
  stage.addEventListener("pointerdown", (event) => {
    if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const point = local(event)
    pointers.set(event.pointerId, point)
    stage.setPointerCapture(event.pointerId)
    if (pointers.size === 2) {
      const pair = midpoint()
      pinch = { ...pair, camera: { ...camera } }
      activeDrag = undefined
      pinched = true
      return
    }
    const id = (event.target as Element).closest<SVGAElement>("[data-global-map-node]")?.dataset
      .globalMapNode
    const node = id ? byID.get(id) : undefined
    activeDrag = {
      pointer: event.pointerId,
      id,
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
      const node = byID.get(drag.id)!
      node.x = (point.x - camera.x) / camera.k + drag.offset.x
      node.y = (point.y - camera.y) / camera.k + drag.offset.y
      movedPoints.set(node.id, { x: node.x, y: node.y })
    } else {
      camera.x += point.x - drag.last.x
      camera.y += point.y - drag.last.y
    }
    drag.last = point
    requestPaint()
  })
  const endPointer = (event: PointerEvent) => {
    const drag = activeDrag
    if (pinched) suppressedUntil = performance.now() + 300
    pointers.delete(event.pointerId)
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId)
    if (drag?.pointer === event.pointerId) {
      if (drag.id && !drag.moved && !pinched && event.type === "pointerup") {
        suppressedUntil = performance.now() + 300
        navigate(drag.id)
      } else if (drag.moved || pinched) suppressedUntil = performance.now() + 300
      activeDrag = undefined
    }
    if (pointers.size < 2) pinch = undefined
    if (!pointers.size) {
      pinched = false
      stage.classList.remove("is-grabbing")
    }
    persist()
    requestPaint()
  }
  stage.addEventListener("pointerup", endPointer)
  stage.addEventListener("pointercancel", endPointer)
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
    event.stopPropagation()
    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
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
    if (event.key === "Escape") return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)
      return
    if (event.ctrlKey || event.metaKey || event.altKey) return
    if (["+", "=", "-"].includes(event.key)) {
      event.preventDefault()
      camera = mapZoom(camera, event.key === "-" ? 0.8 : 1.25, { x: width / 2, y: height / 2 })
      requestPaint()
    } else if (event.key === "Home") {
      event.preventDefault()
      fit.click()
    } else if (event.key.startsWith("Arrow")) {
      event.preventDefault()
      camera.x += event.key === "ArrowLeft" ? 45 : event.key === "ArrowRight" ? -45 : 0
      camera.y += event.key === "ArrowUp" ? 45 : event.key === "ArrowDown" ? -45 : 0
      requestPaint()
    }
  })
  element.addEventListener("cancel", (event) => {
    event.preventDefault()
    hide()
  })
  close.addEventListener("click", () => hide())
  fit.addEventListener("click", () => {
    camera = mapFit(scene.nodes, width, height)
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
  window.addEventListener("pagehide", persist)
  return {
    element,
    show,
    hide,
    snapshot() {
      const box = stage.getBoundingClientRect()
      return {
        open: element.open,
        backend: "svg",
        settled: !frame && !activeDrag && !pinch,
        selected,
        selection: selection ? [...selection] : undefined,
        eligibleIDs: scene.nodes.map((node) => node.id),
        nodeIDs: [...nodes.keys()],
        edgeIDs: scene.relations.map((edge) => edge.id),
        positions: scene.nodes.map((node) => ({
          id: node.id,
          x: node.x,
          y: node.y,
          screenX: box.left + camera.x + node.x * camera.k,
          screenY: box.top + camera.y + node.y * camera.k,
        })),
        camera: { ...camera },
        width,
        height,
        renderCount,
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
      window.removeEventListener("pagehide", persist)
      if (frame) cancelAnimationFrame(frame)
      element.remove()
    },
  }
}
