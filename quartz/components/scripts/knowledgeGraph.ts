import { drag, select, zoom, zoomIdentity, easeCubicOut, type D3ZoomEvent } from "d3"
import katex from "katex"
import {
  findKnowledgePath,
  graphBounds,
  graphTypeLabel,
  layoutKnowledgeGroups,
  selectKnowledgeFormula,
  splitKnowledgeExcerpt,
  type GraphIndex,
  type GraphObject,
  type GraphPosition,
  type GraphRelation,
  type KnowledgeGraphState,
} from "../../util/knowledgeGraph"

export type { KnowledgeGraphState } from "../../util/knowledgeGraph"

export function renderKnowledgeExcerpt(host: HTMLElement, source: string) {
  host.replaceChildren()
  for (const part of splitKnowledgeExcerpt(source)) {
    if (part.kind === "text") host.append(document.createTextNode(part.text))
    else {
      const math = document.createElement("span")
      katex.render(part.text, math, {
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
      })
      host.append(math)
    }
  }
}

export interface KnowledgeGraphOptions {
  onSelect: (id: string, trigger: HTMLElement | SVGElement) => void
  siteRoot?: string | URL
  initialFocus?: string
  onStateChange?: (state: KnowledgeGraphState) => void
  recommendations?: GraphRelation[]
}

const provenanceLabels: Record<GraphRelation["provenance"], string> = {
  authored: "原文数学关系",
  reference: "正文引用",
  structure: "内容归属",
  similarity: "相似推荐 · 模型计算",
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

function control(text: string, action: () => void, label = text): HTMLButtonElement {
  const button = element("button", "kg-control", text)
  button.type = "button"
  button.setAttribute("aria-label", label)
  button.addEventListener("click", action)
  return button
}

function plainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey
}

function safeHref(href: string, base: string | URL): string {
  try {
    const url = new URL(href, base)
    return url.origin === location.origin ? url.href : "#"
  } catch {
    return "#"
  }
}

/** A finite, keyed spatial layout; no background force simulation or decorative movement. */
export function mountKnowledgeGraph(
  host: HTMLElement,
  index: GraphIndex,
  options: KnowledgeGraphOptions,
) {
  const siteRoot =
    options.siteRoot ??
    new URL(
      `${(document.querySelector<HTMLElement>("#reader-context")?.dataset.root ?? ".").replace(/\/$/, "")}/`,
      location.href,
    )
  const objects = new Map(index.objects.map((object) => [object.id, object]))
  const covered = new Set(index.groups.flatMap((group) => group.objectIds))
  const ungrouped = index.objects.filter(
    (object) => object.kind === "atom" && !covered.has(object.id),
  )
  const groups = [
    ...index.groups,
    ...(ungrouped.length
      ? [
          {
            id: "ungrouped",
            title: "其他知识对象",
            objectIds: ungrouped.map((object) => object.id),
          },
        ]
      : []),
  ].filter((group) => group.objectIds.some((id) => objects.get(id)?.kind === "atom"))
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)")
  let recommendations = options.recommendations ?? []
  let destroyed = false
  let fullscreen = false
  let state: KnowledgeGraphState = {
    groupId: options.initialFocus
      ? groups.find((group) => group.objectIds.includes(options.initialFocus!))?.id
      : undefined,
    focusId: options.initialFocus,
    type: "all",
    layers: ["authored", "reference", "structure"],
    expanded: [],
    positions: {},
    camera: { x: 0, y: 0, k: 1 },
  }
  let groupBounds: Record<string, GraphPosition> = {}
  const summaryBounds: Record<string, GraphPosition> = Object.fromEntries(
    groups.map((group, i) => [
      group.id,
      { x: (i % 3) * 374, y: Math.floor(i / 3) * 188, width: 340, height: 146 },
    ]),
  )
  let visible: GraphObject[] = []
  let savedGlobalCamera = { ...state.camera }
  let dragDistance = 0
  let suppressClickUntil = 0
  const cleanups: (() => void)[] = []
  const animations = new Set<Animation>()

  host.classList.add("knowledge-map")
  host.setAttribute("aria-label", "数学知识地图")
  const toolbar = element("div", "kg-toolbar")
  const backButton = control("← 全部章节", () => {
    state.groupId = undefined
    state.focusId = undefined
    state.expanded = []
    render()
    moveCamera(savedGlobalCamera, true)
  })
  const current = element("span", "kg-current", "知识地图")
  const fitButton = control("适应视图", () => fit())
  const minusButton = control("−", () => changeZoom(0.78), "缩小地图")
  const plusButton = control("+", () => changeZoom(1.28), "放大地图")
  const pathButton = control("查看连接路径", () => openPath(pathButton))
  const fullButton = control("打开全屏地图", () => toggleFullscreen())
  const details = element("details", "kg-options")
  const summary = element("summary", undefined, "显示选项")
  const filters = element("div", "kg-filter-content")
  const typeLabel = element("label", undefined, "知识对象类型")
  const typeSelect = element("select")
  for (const type of [
    "all",
    ...new Set(index.objects.filter((o) => o.kind === "atom").map((o) => o.type)),
  ]) {
    typeSelect.add(new Option(type === "all" ? "全部类型" : graphTypeLabel(type), type))
  }
  typeSelect.addEventListener("change", () => {
    state.type = typeSelect.value
    render()
    notify()
  })
  typeLabel.append(typeSelect)
  filters.append(typeLabel)
  const layerInputs = new Map<GraphRelation["provenance"], HTMLInputElement>()
  for (const provenance of Object.keys(provenanceLabels) as GraphRelation["provenance"][]) {
    const label = element("label", "kg-checkbox")
    const input = element("input")
    input.type = "checkbox"
    input.checked = state.layers.includes(provenance)
    input.addEventListener("change", () => {
      state.layers = [...layerInputs].filter(([, checkbox]) => checkbox.checked).map(([key]) => key)
      render()
      notify()
    })
    layerInputs.set(provenance, input)
    label.append(input, document.createTextNode(provenanceLabels[provenance]))
    filters.append(label)
  }
  details.append(summary, filters)
  toolbar.append(
    backButton,
    current,
    minusButton,
    plusButton,
    fitButton,
    pathButton,
    details,
    fullButton,
  )

  const hint = element("p", "kg-hint", "选择章节，再逐层查看知识对象。拖动调整位置，点击打开正文。")
  const stage = element("div", "kg-stage")
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.classList.add("kg-svg")
  svg.setAttribute("role", "group")
  svg.setAttribute("aria-label", "可缩放知识地图；下方列表提供相同的阅读入口")
  svg.setAttribute("tabindex", "0")
  const viewport = select(svg).append("g").attr("class", "kg-viewport")
  const groupLayer = viewport.append("g").attr("class", "kg-groups")
  const edgeLayer = viewport.append("g").attr("class", "kg-edges").attr("aria-hidden", "true")
  const nodeLayer = viewport.append("g").attr("class", "kg-nodes")
  stage.append(svg)
  const listDetails = element("details", "kg-list-disclosure")
  listDetails.open = true
  const listSummary = element("summary", undefined, "按名称定位")
  const list = element("div", "kg-list")
  listDetails.append(listSummary, list)
  const related = element("div", "kg-related")
  const status = element("p", "kg-status")
  status.setAttribute("role", "status")
  const legend = element(
    "p",
    "kg-legend",
    "章节外框表示内容分组。实线为原文数学关系，细线为引用，虚线为归属；相似推荐单独标记。",
  )
  host.replaceChildren(toolbar, hint, stage, listDetails, related, legend, status)

  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.035, 2.5])
    .filter((event: MouseEvent | WheelEvent | TouchEvent) => {
      const target = event.target as Element
      if ("touches" in event && event.touches.length > 1) return true
      if (event.type === "wheel")
        return fullscreen || document.activeElement === svg || event.ctrlKey
      return !target.closest(".kg-node, .kg-group-button") && !("button" in event && event.button)
    })
    .on("zoom.knowledge", (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
      viewport.attr("transform", event.transform.toString())
      state.camera = { x: event.transform.x, y: event.transform.y, k: event.transform.k }
      setZoomLevel()
    })
    .on("end.knowledge", () => notify())
  select(svg).call(zoomBehavior).on("dblclick.zoom", null)

  // Capture a second touch before an active one-finger node drag consumes it.
  // This also lets a reader start a pinch directly on a node or formula.
  let pinch:
    | { distance: number; x: number; y: number; camera: KnowledgeGraphState["camera"] }
    | undefined
  let pinchConsumed = false
  const touchCenter = (touches: TouchList) => {
    const bounds = svg.getBoundingClientRect()
    return {
      distance: Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY,
      ),
      x: (touches[0].clientX + touches[1].clientX) / 2 - bounds.x,
      y: (touches[0].clientY + touches[1].clientY) / 2 - bounds.y,
    }
  }
  const pinchStart = (event: TouchEvent) => {
    if (event.touches.length < 2) return
    pinch = { ...touchCenter(event.touches), camera: { ...state.camera } }
    pinchConsumed = true
    event.preventDefault()
    event.stopImmediatePropagation()
  }
  const pinchMove = (event: TouchEvent) => {
    if (!pinchConsumed) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (!pinch || event.touches.length < 2) return
    const next = touchCenter(event.touches)
    const k = Math.min(
      2.5,
      Math.max(0.035, (pinch.camera.k * next.distance) / Math.max(1, pinch.distance)),
    )
    moveCamera({
      x: next.x - ((pinch.x - pinch.camera.x) * k) / pinch.camera.k,
      y: next.y - ((pinch.y - pinch.camera.y) * k) / pinch.camera.k,
      k,
    })
  }
  const pinchEnd = (event: TouchEvent) => {
    if (!pinchConsumed) return
    suppressClickUntil = performance.now() + 350
    if (!event.touches.length) {
      pinch = undefined
      pinchConsumed = false
      notify()
    }
  }
  svg.addEventListener("touchstart", pinchStart, { capture: true, passive: false })
  svg.addEventListener("touchmove", pinchMove, { capture: true, passive: false })
  svg.addEventListener("touchend", pinchEnd, true)
  svg.addEventListener("touchcancel", pinchEnd, true)
  cleanups.push(() => {
    svg.removeEventListener("touchstart", pinchStart, true)
    svg.removeEventListener("touchmove", pinchMove, true)
    svg.removeEventListener("touchend", pinchEnd, true)
    svg.removeEventListener("touchcancel", pinchEnd, true)
  })

  const keyHandler = (event: KeyboardEvent) => {
    if (event.target !== svg) return
    const camera = state.camera
    const movements: Record<string, [number, number]> = {
      ArrowLeft: [60, 0],
      ArrowRight: [-60, 0],
      ArrowUp: [0, 60],
      ArrowDown: [0, -60],
    }
    if (movements[event.key]) {
      event.preventDefault()
      const [x, y] = movements[event.key]
      moveCamera({ ...camera, x: camera.x + x, y: camera.y + y })
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault()
      changeZoom(1.28)
    } else if (event.key === "-") {
      event.preventDefault()
      changeZoom(0.78)
    } else if (event.key === "0") {
      event.preventDefault()
      fit()
    }
  }
  svg.addEventListener("keydown", keyHandler)
  cleanups.push(() => svg.removeEventListener("keydown", keyHandler))

  const measureCanvas = document.createElement("canvas")
  const measureContext = measureCanvas.getContext("2d")
  if (measureContext) measureContext.font = "600 14px system-ui, sans-serif"
  const packed = layoutKnowledgeGroups(
    index.objects,
    groups,
    state.positions,
    (text) => measureContext?.measureText(text).width ?? text.length * 14,
  )
  state.positions = packed.positions
  groupBounds = packed.bounds

  function allRelations(): GraphRelation[] {
    return [...index.relations, ...recommendations].filter(
      (edge) => objects.has(edge.source) && objects.has(edge.target),
    )
  }

  function activeRelations(): GraphRelation[] {
    return allRelations().filter((edge) => state.layers.includes(edge.provenance))
  }

  function notify() {
    if (!destroyed) options.onStateChange?.(getState())
  }

  function getState(): KnowledgeGraphState {
    return JSON.parse(JSON.stringify(state)) as KnowledgeGraphState
  }

  function setZoomLevel() {
    const level = state.camera.k < 0.46 ? "far" : state.camera.k < 0.95 ? "middle" : "near"
    host.dataset.zoom = level
    groupLayer
      .selectAll<HTMLButtonElement, unknown>("button.kg-group-button")
      .style("font-size", `${state.groupId ? 18 : Math.max(18, 12 / state.camera.k)}px`)
    for (const anchor of nodeLayer
      .selectAll<HTMLAnchorElement, GraphObject>("a.kg-object-link")
      .nodes()) {
      anchor.tabIndex = level === "far" ? -1 : 0
    }
    nodeLayer.attr("aria-hidden", level === "far" ? "true" : null)
  }

  function moveCamera(camera: KnowledgeGraphState["camera"], animate = false) {
    const selection = select(svg)
    const transform = zoomIdentity.translate(camera.x, camera.y).scale(camera.k)
    selection.interrupt("knowledge-camera")
    if (animate && !reducedMotion.matches)
      selection
        .transition("knowledge-camera")
        .duration(240)
        .ease(easeCubicOut)
        .call(zoomBehavior.transform, transform)
    else selection.call(zoomBehavior.transform, transform)
  }

  function changeZoom(factor: number) {
    select(svg).call(zoomBehavior.scaleBy, factor)
  }

  function fit() {
    const extent = state.groupId
      ? graphBounds(visible.map((object) => state.positions[object.id]).filter(Boolean))
      : graphBounds(Object.values(summaryBounds))
    const width = Math.max(280, stage.clientWidth)
    const height = Math.max(360, stage.clientHeight)
    const k = Math.min(
      1.05,
      Math.max(0.035, Math.min((width - 64) / extent.width, (height - 64) / extent.height)),
    )
    moveCamera(
      {
        x: width / 2 - (extent.x + extent.width / 2) * k,
        y: height / 2 - (extent.y + extent.height / 2) * k,
        k,
      },
      true,
    )
  }

  function chooseGroup(id: string) {
    if (!state.groupId) savedGlobalCamera = { ...state.camera }
    state.groupId = id
    state.expanded = []
    state.focusId = undefined
    render()
    frameObjects(visible.slice(0, 6))
    status.textContent = `${groups.find((group) => group.id === id)?.title ?? "当前章节"}，${visible.length} 个知识对象。可继续放大，或使用下方名称列表。`
  }

  function frameObjects(items: GraphObject[]) {
    const extent = graphBounds(items.map((object) => state.positions[object.id]).filter(Boolean))
    const width = Math.max(280, stage.clientWidth)
    const height = Math.max(360, stage.clientHeight)
    const k = Math.min(
      1.05,
      Math.max(0.58, Math.min((width - 48) / extent.width, (height - 48) / extent.height)),
    )
    moveCamera(
      {
        x: width / 2 - (extent.x + extent.width / 2) * k,
        y: height / 2 - (extent.y + extent.height / 2) * k,
        k,
      },
      true,
    )
  }

  function objectLink(object: GraphObject, className = "kg-object-link"): HTMLAnchorElement {
    const anchor = element("a", className)
    anchor.href = safeHref(object.href, siteRoot)
    anchor.dataset.knowledgeId = object.id
    anchor.addEventListener("click", (event) => {
      if (!plainClick(event)) return
      event.preventDefault()
      event.stopPropagation()
      if (performance.now() < suppressClickUntil) return
      setFocus(object.id)
      options.onSelect(object.id, anchor)
    })
    return anchor
  }

  function render() {
    if (destroyed) return
    const group = groups.find((item) => item.id === state.groupId)
    const allowed = group ? new Set([...group.objectIds, ...state.expanded]) : undefined
    visible = state.groupId
      ? index.objects.filter(
          (object) =>
            object.kind === "atom" &&
            (!allowed || allowed.has(object.id)) &&
            (state.type === "all" || object.type === state.type),
        )
      : []
    host.classList.toggle("has-group", Boolean(group))
    current.textContent = group?.title ?? "知识地图"
    backButton.hidden = !group
    typeSelect.value = state.type
    for (const [layer, input] of layerInputs) input.checked = state.layers.includes(layer)
    renderGroups()
    renderNodes()
    drawEdges()
    renderList()
    renderRelated()
    setZoomLevel()
  }

  function renderGroups() {
    const activeGroups = groups.filter((group) => !state.groupId || group.id === state.groupId)
    const groupSelection = groupLayer
      .selectAll<SVGGElement, (typeof groups)[number]>("g.kg-group")
      .data(activeGroups, (group) => group.id)
      .join((enter) => {
        const container = enter.append("g").attr("class", "kg-group")
        container.append("rect").attr("class", "kg-group-outline").attr("rx", 6)
        container
          .append("foreignObject")
          .attr("class", "kg-group-label")
          .append("xhtml:button")
          .attr("class", "kg-group-button")
          .attr("type", "button")
        return container
      })
    groupSelection.each(function (group) {
      const bounds = state.groupId ? groupBounds[group.id] : summaryBounds[group.id]
      if (!bounds) return
      const node = select(this)
      node
        .select("rect")
        .attr("x", bounds.x)
        .attr("y", bounds.y)
        .attr("width", bounds.width)
        .attr("height", bounds.height)
      node
        .select("foreignObject")
        .attr("x", bounds.x + 18)
        .attr("y", bounds.y + 10)
        .attr("width", Math.max(300, bounds.width - 36))
        .attr("height", state.groupId ? 64 : bounds.height - 20)
      node
        .select<HTMLButtonElement>("button")
        .text(
          `${group.title} · ${group.objectIds.filter((id) => objects.get(id)?.kind === "atom").length} 个对象`,
        )
        .on("click", () => chooseGroup(group.id))
    })
  }

  function renderNodes() {
    const neighbors = new Set(
      activeRelations().flatMap((edge) =>
        edge.source === state.focusId
          ? [edge.target]
          : edge.target === state.focusId
            ? [edge.source]
            : [],
      ),
    )
    const selection = nodeLayer
      .selectAll<SVGGElement, GraphObject>("g.kg-node")
      .data(visible, (object) => object.id)
      .join((enter) => {
        const node = enter.append("g").attr("class", "kg-node")
        node.append("rect").attr("class", "kg-node-surface").attr("rx", 8)
        node.append("foreignObject").attr("class", "kg-node-content")
        return node
      })
    selection.each(function (object) {
      const position = state.positions[object.id]
      if (!position) return
      const node = select(this)
      node
        .attr("transform", `translate(${position.x},${position.y})`)
        .attr("data-id", object.id)
        .classed("is-current", object.id === state.focusId)
        .classed("is-related", neighbors.has(object.id))
        .classed(
          "is-muted",
          Boolean(state.focusId && object.id !== state.focusId && !neighbors.has(object.id)),
        )
      node.select("rect").attr("width", position.width).attr("height", position.height)
      const foreign = node
        .select<SVGForeignObjectElement>("foreignObject")
        .attr("width", position.width)
        .attr("height", position.height)
        .node()!
      if (!foreign.firstChild) {
        const anchor = objectLink(object)
        anchor.setAttribute("xmlns", "http://www.w3.org/1999/xhtml")
        const type = element("span", "kg-object-type", graphTypeLabel(object.type))
        const title = element("strong", "kg-object-title", object.title)
        const excerpt = element("span", "kg-object-excerpt")
        renderKnowledgeExcerpt(excerpt, object.excerpt)
        anchor.append(type, title, excerpt)
        const selectedFormula = selectKnowledgeFormula(object.latex)
        if (selectedFormula) {
          const formula = element("span", "kg-object-formula")
          formula.innerHTML = katex.renderToString(selectedFormula, {
            throwOnError: false,
            trust: false,
            strict: "ignore",
            output: "htmlAndMathml",
            displayMode: false,
          })
          anchor.append(formula)
        }
        const open = element("span", "kg-object-open", "阅读对象 →")
        anchor.append(open)
        foreign.append(anchor)
      }
    })
    const dragBehavior = drag<SVGGElement, GraphObject>()
      .clickDistance(7)
      .filter(
        (event: MouseEvent | TouchEvent) =>
          !("touches" in event && event.touches.length > 1) &&
          !event.ctrlKey &&
          !event.metaKey &&
          !("button" in event && event.button),
      )
      .on("start", function () {
        dragDistance = 0
        select(this).classed("is-dragging", true)
      })
      .on("drag", function (event, object) {
        dragDistance += Math.hypot(event.dx, event.dy)
        const position = state.positions[object.id]
        position.x += event.dx
        position.y += event.dy
        select(this).attr("transform", `translate(${position.x},${position.y})`)
        drawEdges()
      })
      .on("end", function () {
        select(this).classed("is-dragging", false)
        if (dragDistance > 7) suppressClickUntil = performance.now() + 350
        notify()
      })
    selection.call(dragBehavior)
  }

  function drawEdges() {
    const ids = new Set(visible.map((object) => object.id))
    const edges = activeRelations().filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    edgeLayer
      .selectAll<SVGPathElement, GraphRelation>("path")
      .data(edges, (edge) => edge.id)
      .join("path")
      .attr("class", (edge) => `kg-edge kg-edge-${edge.provenance}`)
      .classed("is-muted", (edge) =>
        Boolean(state.focusId && edge.source !== state.focusId && edge.target !== state.focusId),
      )
      .classed(
        "is-focused",
        (edge) => edge.source === state.focusId || edge.target === state.focusId,
      )
      .attr("d", (edge) => {
        const a = state.positions[edge.source],
          b = state.positions[edge.target]
        const ax = a.x + a.width / 2,
          ay = a.y + a.height / 2
        const bx = b.x + b.width / 2,
          by = b.y + b.height / 2
        return `M${ax},${ay} C${(ax + bx) / 2},${ay} ${(ax + bx) / 2},${by} ${bx},${by}`
      })
  }

  function renderList() {
    list.replaceChildren()
    if (!state.groupId) {
      listSummary.textContent = `按章节定位 · ${groups.length} 个分组`
      for (const group of groups) {
        const button = control(group.title, () => chooseGroup(group.id))
        button.className = "kg-group-list-item"
        button.append(
          element(
            "span",
            undefined,
            `${group.objectIds.filter((id) => objects.get(id)?.kind === "atom").length} 个知识对象 →`,
          ),
        )
        list.append(button)
      }
    } else {
      listSummary.textContent = `按名称定位 · ${visible.length} 个知识对象`
      for (const object of visible) {
        const link = objectLink(object, "kg-list-item")
        link.append(
          element("span", "kg-object-type", graphTypeLabel(object.type)),
          element("strong", undefined, object.title),
        )
        if (object.id === state.focusId) link.setAttribute("aria-current", "true")
        list.append(link)
      }
      if (!visible.length)
        list.append(
          element("p", undefined, "本章没有符合当前类型的对象。可切换类型，或返回全部章节。"),
        )
    }
  }

  function renderRelated() {
    related.replaceChildren()
    const object = state.focusId ? objects.get(state.focusId) : undefined
    if (!object) return
    related.append(element("h3", undefined, `与「${object.title}」直接相连`))
    const edges = activeRelations().filter(
      (edge) => edge.source === object.id || edge.target === object.id,
    )
    const relatedList = element("ul")
    for (const edge of edges) {
      const other = objects.get(edge.source === object.id ? edge.target : edge.source)!
      const li = element("li")
      const link = objectLink(other, "kg-related-link")
      link.textContent = other.title
      li.append(
        link,
        element("span", "kg-relation-kind", `${provenanceLabels[edge.provenance]} · ${edge.type}`),
      )
      if (edge.evidenceHref) {
        const evidence = element("a", "kg-evidence", "查看出处")
        evidence.href = safeHref(edge.evidenceHref, siteRoot)
        evidence.dataset.spaceNative = ""
        li.append(evidence)
      }
      relatedList.append(li)
    }
    related.append(relatedList)
    if (!edges.length) related.append(element("p", undefined, "当前关系层中没有已登记的直接联系。"))
    const cross = edges
      .map((edge) => objects.get(edge.source === object.id ? edge.target : edge.source)!)
      .filter((other) => other.kind === "atom" && !visible.some((item) => item.id === other.id))
    if (cross.length)
      related.append(
        control(`展开 ${new Set(cross.map((o) => o.id)).size} 个章外对象`, () => {
          const previouslyExpanded = new Set(state.expanded)
          state.expanded = [...new Set([...state.expanded, ...cross.map((other) => other.id)])]
          state.type = "all"
          const origin = state.positions[object.id]
          for (const [i, other] of cross.entries()) {
            const p = state.positions[other.id]
            if (origin && p && !previouslyExpanded.has(other.id)) {
              p.x = origin.x + 390
              p.y = origin.y + i * 260
            }
          }
          render()
          frameObjects([object, ...cross].slice(0, 6))
        }),
      )
  }

  function setFocus(id?: string) {
    const previousGroup = state.groupId
    state.focusId = id && objects.has(id) ? id : undefined
    if (id) {
      const group = groups.find((item) => item.objectIds.includes(id))
      if (group && state.groupId !== group.id && !state.expanded.includes(id))
        state.groupId = group.id
    }
    if (previousGroup !== state.groupId) {
      render()
      const object = id ? objects.get(id) : undefined
      if (object) frameObjects([object])
    } else {
      renderNodes()
      drawEdges()
      renderRelated()
      for (const link of list.querySelectorAll<HTMLAnchorElement>("a[data-knowledge-id]")) {
        if (link.dataset.knowledgeId === id) link.setAttribute("aria-current", "true")
        else link.removeAttribute("aria-current")
      }
    }
    notify()
  }

  function openPath(trigger: HTMLElement) {
    const dialog = element("dialog", "kg-path-dialog")
    const heading = element("h2", undefined, "两个对象如何相连")
    const note = element(
      "p",
      undefined,
      "逐步显示已登记关系及出处。连接路径用于探索，不表示数学推导或证明。",
    )
    const fromLabel = element("label", undefined, "起点")
    const toLabel = element("label", undefined, "终点")
    const from = element("select"),
      to = element("select")
    for (const object of index.objects) {
      const title = `${graphTypeLabel(object.type)} · ${object.title}`
      from.add(new Option(title, object.id))
      to.add(new Option(title, object.id))
    }
    if (state.focusId) from.value = state.focusId
    if (index.objects.length > 1) to.selectedIndex = from.selectedIndex === 0 ? 1 : 0
    fromLabel.append(from)
    toLabel.append(to)
    const similarityLabel = element("label", "kg-checkbox")
    const similarity = element("input")
    similarity.type = "checkbox"
    similarityLabel.append(similarity, document.createTextNode("纳入模型相似推荐（探索路径）"))
    const output = element("div", "kg-path-output")
    output.setAttribute("role", "status")
    const submit = control("查找路径", () => {
      output.replaceChildren()
      const path = findKnowledgePath(
        from.value,
        to.value,
        index.objects,
        allRelations(),
        similarity.checked,
      )
      if (!path) {
        output.textContent = "在所选关系范围内没有已登记的连接路径。"
        return
      }
      if (!path.length) {
        output.textContent = "起点和终点是同一个对象。"
        return
      }
      output.append(
        element(
          "p",
          "kg-path-label",
          path.some((step) => step.relation.provenance === "similarity")
            ? "探索路径 · 含模型推荐"
            : "已登记关系路径",
        ),
      )
      const ordered = element("ol")
      for (const step of path) {
        const li = element("li")
        const a = objects.get(step.from)!,
          b = objects.get(step.to)!
        li.append(
          element("strong", undefined, `${a.title} → ${b.title}`),
          element(
            "span",
            "kg-relation-kind",
            `${provenanceLabels[step.relation.provenance]} · ${step.relation.type}${step.reversed ? " · 反向查看" : ""}`,
          ),
        )
        if (step.relation.evidenceText)
          li.append(element("p", undefined, step.relation.evidenceText))
        if (step.relation.evidenceHref) {
          const evidence = element("a", "kg-evidence", "查看原文依据")
          evidence.href = safeHref(step.relation.evidenceHref, siteRoot)
          evidence.dataset.spaceNative = ""
          li.append(evidence)
        }
        ordered.append(li)
      }
      output.append(ordered)
    })
    const close = control("关闭", () => dialog.close())
    dialog.append(heading, note, fromLabel, toLabel, similarityLabel, submit, output, close)
    const holder = fullscreen ? stage : host
    holder.append(dialog)
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove()
        trigger.focus({ preventScroll: true })
      },
      { once: true },
    )
    dialog.showModal()
    from.focus()
  }

  function toggleFullscreen() {
    fullscreen = !fullscreen
    host.classList.toggle("is-fullscreen", fullscreen)
    fullButton.textContent = fullscreen ? "关闭全屏地图" : "打开全屏地图"
    fullButton.setAttribute("aria-label", fullButton.textContent)
    if (fullscreen) {
      host.setAttribute("role", "dialog")
      host.setAttribute("aria-modal", "true")
      fullButton.focus()
    } else {
      host.removeAttribute("role")
      host.removeAttribute("aria-modal")
      fullButton.focus({ preventScroll: true })
    }
    if (state.groupId && visible.length) {
      frameObjects([visible.find((object) => object.id === state.focusId) ?? visible[0]])
    } else fit()
  }

  const fullscreenKeys = (event: KeyboardEvent) => {
    if (!fullscreen || host.querySelector("dialog[open]")) return
    if (event.key === "Escape") {
      event.preventDefault()
      toggleFullscreen()
      return
    }
    if (event.key === "Tab") {
      const focusable = [
        ...host.querySelectorAll<HTMLElement>(
          "button, a[href], select, input, summary, [tabindex='0']",
        ),
      ].filter((node) => !node.hidden && node.getClientRects().length && node.tabIndex >= 0)
      const first = focusable[0],
        last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
  }
  host.addEventListener("keydown", fullscreenKeys)
  cleanups.push(() => host.removeEventListener("keydown", fullscreenKeys))
  const resize = new ResizeObserver(() => {
    svg.setAttribute(
      "viewBox",
      `0 0 ${Math.max(280, stage.clientWidth)} ${Math.max(360, stage.clientHeight)}`,
    )
  })
  resize.observe(stage)
  render()
  if (state.focusId && objects.has(state.focusId)) frameObjects([objects.get(state.focusId)!])
  else fit()
  if (!reducedMotion.matches && host.animate) {
    const animation = host.animate(
      [
        { opacity: 0.5, transform: "translateY(6px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" },
    )
    animations.add(animation)
    animation.finished.then(() => animations.delete(animation)).catch(() => {})
  }

  return {
    setFocus,
    getState,
    restoreState(saved: KnowledgeGraphState) {
      if (!saved || !Array.isArray(saved.layers)) return
      const validPositions = Object.fromEntries(
        Object.entries(saved.positions ?? {}).filter(
          ([id, p]) => objects.has(id) && Number.isFinite(p.x) && Number.isFinite(p.y),
        ),
      )
      state = {
        ...state,
        ...saved,
        positions: { ...state.positions, ...validPositions },
        expanded: (saved.expanded ?? []).filter((id) => objects.has(id)),
        layers: saved.layers.filter((layer) => layer in provenanceLabels),
      }
      render()
      if ([saved.camera?.x, saved.camera?.y, saved.camera?.k].every(Number.isFinite))
        moveCamera({ ...saved.camera, k: Math.min(2.5, Math.max(0.035, saved.camera.k)) })
    },
    setRecommendations(edges: GraphRelation[]) {
      recommendations = edges.filter((edge) => edge.provenance === "similarity")
      render()
    },
    destroy() {
      destroyed = true
      resize.disconnect()
      for (const cleanup of cleanups) cleanup()
      for (const animation of animations) animation.cancel()
      select(svg).on(".zoom", null)
      select(svg).interrupt("knowledge-camera")
      host.querySelectorAll("dialog").forEach((dialog) => dialog.close())
      host.classList.remove("is-fullscreen")
      host.replaceChildren()
    },
  }
}
