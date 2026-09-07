import {
  select,
  drag,
  zoom,
  zoomIdentity,
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
  type ZoomTransform,
} from "d3"
import { filterNoteGraph, type NoteGraphData, type NoteGraphFilter } from "../../util/noteGraph"

type GraphNode = NoteGraphData["nodes"][number] & SimulationNodeDatum
type GraphEdge = SimulationLinkDatum<GraphNode> & { source: GraphNode; target: GraphNode }
const kindLabels = { body: "正文", plan: "规划", example: "样例", navigation: "导航" }

function initialize(root: HTMLElement) {
  if (root.dataset.graphBound) return
  root.dataset.graphBound = "true"
  const data = JSON.parse(root.dataset.graph!) as NoteGraphData
  const currentId = data.nodes.find((node) => node.current)?.id
  const inline = root.dataset.variant === "inline"
  const dialog = root.querySelector<HTMLDialogElement>(".note-graph-dialog")!
  const host = root.querySelector<HTMLElement>(".note-graph-inline-host")!
  const panel = root.querySelector<HTMLElement>(".note-graph-panel")!
  const opener = root.querySelector<HTMLButtonElement>(".note-graph-open")!
  const closer = root.querySelector<HTMLButtonElement>(".note-graph-close")!
  const svgElement = root.querySelector<SVGSVGElement>(".note-graph-svg")!
  const canvas = root.querySelector<HTMLElement>(".note-graph-canvas")!
  const error = root.querySelector<HTMLElement>(".note-graph-error")!
  const tooltip = root.querySelector<HTMLElement>(".note-graph-hover")!
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-graph-action="pause"]')!
  const list = root.querySelector<HTMLUListElement>(".note-graph-list ul")!
  const count = root.querySelector<HTMLElement>(".note-graph-count")!
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  let scope: "local" | "global" = inline ? "global" : "local"
  let filter: NoteGraphFilter = "all"
  let paused = false
  let width = 0
  let height = 0
  let onScreen = inline
  let transform: ZoomTransform = zoomIdentity
  let suppressClickUntil = 0
  let focused: string | undefined
  let nodes: GraphNode[] = []
  let links: GraphEdge[] = []
  let neighbours = new Map<string, Set<string>>()
  let labelPriority: GraphNode[] = []
  let labelOrder = ""
  const labelWidths = new Map<string, number>()
  const measure = document.createElement("canvas").getContext("2d")!
  measure.font = `12px ${getComputedStyle(root).fontFamily}`
  const svg = select(svgElement)
  const layer = svg.append("g").attr("class", "note-graph-layer")
  const edgeGroup = layer.append("g").attr("aria-hidden", "true")
  const nodeGroup = layer.append("g")
  let edgeElements = edgeGroup.selectAll<SVGLineElement, GraphEdge>("line")
  let nodeElements = nodeGroup.selectAll<SVGAElement, GraphNode>("a")
  const simulation = forceSimulation<GraphNode>([])
    .stop()
    .force("charge", forceManyBody<GraphNode>().strength(-180).distanceMax(300))
    .force("collision", forceCollide<GraphNode>(20).iterations(2))
    .alphaDecay(0.055)
    .velocityDecay(0.4)
  const radius = (node: GraphNode) =>
    Math.min(15, 5 + Math.sqrt((neighbours.get(node.id)?.size ?? 1) - 1) * 1.5)
  const active = () => dialog.open || (inline && onScreen)

  function running(value: boolean) {
    root.dataset.running = dialog.dataset.running = String(value)
  }
  function stop() {
    simulation.stop().alphaTarget(0)
    running(false)
  }
  function wake() {
    if (paused || reduced.matches || !active() || document.hidden || !nodes.length) return stop()
    simulation.alpha(0.35).alphaTarget(0).restart()
    running(true)
  }
  function labels() {
    const shown = new Set<string>()
    const offsets = new Map<string, number>()
    const placed: { x: number; y: number; width: number }[] = []
    const nearby = focused ? neighbours.get(focused) : undefined
    for (const node of labelPriority) {
      const important = node.id === focused || node.current
      const dense = nodes.length > 32 && transform.k < 0.85
      if (dense && !important && !nearby?.has(node.id) && (neighbours.get(node.id)?.size ?? 1) < 5)
        continue
      const x = (node.x ?? 0) * transform.k + transform.x
      const y = (node.y ?? 0) * transform.k + transform.y + 30
      const labelWidth = labelWidths.get(node.id) ?? 150
      const safeX = Math.max(labelWidth / 2 + 7, Math.min(width - labelWidth / 2 - 7, x))
      if (!important && (safeX !== x || y < 0 || y > height - 25)) continue
      if (
        !important &&
        placed.some(
          (point) =>
            Math.abs(point.x - safeX) < (point.width + labelWidth) / 2 + 10 &&
            Math.abs(point.y - y) < 44,
        )
      )
        continue
      shown.add(node.id)
      offsets.set(node.id, (safeX - x) / transform.k)
      placed.push({ x: safeX, y, width: labelWidth })
    }
    nodeElements
      .select("text")
      .attr("opacity", (node) => (shown.has(node.id) ? 1 : 0))
      .attr("font-size", 12 / transform.k)
      .attr("y", (node) => radius(node) + 15 / transform.k)
      .attr("stroke-width", 3 / transform.k)
    nodeElements
      .selectAll<SVGTSpanElement, GraphNode>("tspan")
      .attr("x", (node) => offsets.get(node.id) ?? 0)
      .attr("dy", function (_, index) {
        return index ? 15 / transform.k : 0
      })
    const order = [...shown].join("\0")
    if (order !== labelOrder) {
      // Draw readable labels over nearby unlabelled dots, with focus/current last.
      for (const node of labelPriority.toReversed()) {
        if (shown.has(node.id)) nodeElements.filter((entry) => entry.id === node.id).raise()
      }
      labelOrder = order
    }
  }
  function render() {
    nodeElements.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`)
    edgeElements
      .attr("x1", (edge) => edge.source.x ?? 0)
      .attr("y1", (edge) => edge.source.y ?? 0)
      .attr("x2", (edge) => edge.target.x ?? 0)
      .attr("y2", (edge) => edge.target.y ?? 0)
    labels()
  }
  simulation.on("tick", render).on("end", () => running(false))
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.12, 5])
    .filter((event) => {
      if (event.type === "wheel") return true
      if (event.touches?.length > 1) return true
      return !event.button && !(event.target as Element).closest(".note-graph-node")
    })
    .on("zoom", (event) => {
      transform = event.transform
      layer.attr("transform", transform.toString())
      labels()
    })
  svg.call(zoomBehavior).on("dblclick.zoom", null)

  function fit() {
    if (!width || !height || !nodes.length) return
    // Bounds derive from real node positions rather than hidden full-length labels.
    const xs = nodes.map((node) => node.x ?? 0)
    const ys = nodes.map((node) => node.y ?? 0)
    const left = Math.min(...xs),
      right = Math.max(...xs)
    const top = Math.min(...ys),
      bottom = Math.max(...ys)
    const scale = Math.max(
      0.12,
      Math.min(
        1.2,
        (width - 90) / Math.max(110, right - left + 60),
        (height - 130) / Math.max(100, bottom - top + 60),
      ),
    )
    svg.call(
      zoomBehavior.transform,
      zoomIdentity
        .translate(
          width / 2 - ((left + right) / 2) * scale,
          (height - 38) / 2 - ((top + bottom) / 2) * scale,
        )
        .scale(scale),
    )
  }
  function reset() {
    stop()
    if (!width || !height) return
    nodes.forEach((node, index) => {
      const angle = index * Math.PI * (3 - Math.sqrt(5))
      const spread = Math.sqrt(index + 1) * (nodes.length > 12 ? 26 : 55)
      node.x = width / 2 + Math.cos(angle) * spread
      node.y = height / 2 + Math.sin(angle) * spread
      node.fx = node.fy = null
      node.vx = node.vy = 0
    })
    simulation
      .nodes(nodes)
      .force(
        "link",
        forceLink<GraphNode, GraphEdge>(links)
          .distance(nodes.length > 20 ? 65 : 130)
          .strength(0.4),
      )
      .force("x", forceX<GraphNode>(width / 2).strength(0.035))
      .force("y", forceY<GraphNode>(height / 2).strength(0.035))
      .alpha(1)
      .tick(180)
    render()
    fit()
  }
  function highlight(id?: string) {
    const adjacent = id ? neighbours.get(id) : undefined
    nodeElements
      .classed("is-active", (node) => node.id === id)
      .classed("is-dim", (node) => Boolean(adjacent && !adjacent.has(node.id)))
    edgeElements.classed("is-active", (edge) => edge.source.id === id || edge.target.id === id)
    const node = nodes.find((entry) => entry.id === id)
    tooltip.hidden = !node
    tooltip.textContent = node
      ? [node.title, kindLabels[node.kind], node.status, node.layer].filter(Boolean).join(" · ")
      : ""
    // Put the active node first so its full label is never sacrificed to density rules.
    labelPriority = [...nodes].sort(
      (a, b) =>
        Number(b.id === id) - Number(a.id === id) ||
        Number(b.current) - Number(a.current) ||
        (neighbours.get(b.id)?.size ?? 0) - (neighbours.get(a.id)?.size ?? 0),
    )
    labels()
  }
  function navigate(node: GraphNode, event: KeyboardEvent) {
    event.preventDefault()
    event.stopPropagation()
    // SVG links do not consistently provide native Enter activation in Chromium.
    // Keyboard navigation deliberately bypasses the short pointer-drag click guard.
    if (event.ctrlKey || event.metaKey) window.open(node.href, "_blank", "noopener")
    else window.location.assign(node.href)
  }
  function populate() {
    stop()
    focused = undefined
    const graph = filterNoteGraph(data, currentId, scope, filter)
    nodes = graph.nodes.map((node) => ({ ...node }))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    links = graph.links.map((edge) => ({
      source: byId.get(edge.source)!,
      target: byId.get(edge.target)!,
    }))
    neighbours = new Map(nodes.map((node) => [node.id, new Set([node.id])]))
    for (const edge of links) {
      neighbours.get(edge.source.id)!.add(edge.target.id)
      neighbours.get(edge.target.id)!.add(edge.source.id)
    }
    edgeElements = edgeGroup
      .selectAll<SVGLineElement, GraphEdge>("line")
      .data(links, (edge) => `${edge.source.id}\0${edge.target.id}`)
      .join("line")
      .attr("class", "note-graph-edge")
    nodeElements = nodeGroup
      .selectAll<SVGAElement, GraphNode>("a")
      .data(nodes, (node) => node.id)
      .join<SVGAElement>("a")
      .attr("class", (node) => `note-graph-node${node.current ? " is-current" : ""}`)
      .attr("href", (node) => node.href)
      .attr("data-id", (node) => node.id)
      .attr("data-kind", (node) => node.kind)
      .attr("tabindex", 0)
      .attr("aria-label", (node) => `${node.title}${node.current ? "（当前文章）" : ""}`)
      .attr("aria-current", (node) => (node.current ? "page" : null))
    nodeElements.selectAll("*").remove()
    nodeElements.append("circle").attr("class", "note-graph-hit").attr("r", 22)
    nodeElements
      .append("circle")
      .attr("class", "note-graph-focus")
      .attr("r", (node) => radius(node) + 6)
    nodeElements.append("circle").attr("class", "note-graph-dot").attr("r", radius)
    nodeElements.append("title").text((node) => node.title)
    nodeElements.each(function (node) {
      const label = select(this).append("text").attr("text-anchor", "middle")
      const words = Array.from(node.title)
      const lines: string[] = []
      while (words.length && lines.length < 2) {
        let length = Math.min(22, words.length)
        if (words.length > length) {
          const space = words.slice(0, length).lastIndexOf(" ")
          if (space >= 10) length = space + 1
        }
        lines.push(words.splice(0, length).join("").trim())
      }
      if (words.length) lines[1] = `${lines[1].slice(0, 20)}…`
      labelWidths.set(
        node.id,
        Math.max(0, ...lines.map((line) => measure.measureText(line).width)) + 4,
      )
      lines.forEach((line) => label.append("tspan").attr("x", 0).text(line))
    })
    let dragDistance = 0
    nodeElements.call(
      drag<SVGAElement, GraphNode>()
        .clickDistance(6)
        .on("start", (event, node) => {
          event.sourceEvent.stopPropagation()
          dragDistance = 0
          node.fx = node.x
          node.fy = node.y
          highlight(node.id)
          wake()
          if (!paused && !reduced.matches) simulation.alphaTarget(0.12)
        })
        .on("drag", (event, node) => {
          dragDistance += Math.hypot(event.dx, event.dy) * transform.k
          node.fx = node.x = event.x
          node.fy = node.y = event.y
          render()
        })
        .on("end", (_, node) => {
          if (dragDistance > 6) suppressClickUntil = performance.now() + 400
          node.fx = node.fy = null
          wake()
          highlight(focused)
        }),
    )
    nodeElements
      .on("click.graph", (event) => {
        if (
          event.detail !== 0 &&
          (performance.now() < suppressClickUntil || event.defaultPrevented)
        )
          event.preventDefault()
      })
      .on("mouseenter.graph", (_, node) => highlight(node.id))
      .on("mouseleave.graph", () => highlight(focused))
      .on("focus.graph", (_, node) => {
        focused = node.id
        highlight(node.id)
      })
      .on("blur.graph", () => {
        focused = undefined
        highlight()
      })
      .on("keydown.graph", (event: KeyboardEvent, node) => {
        if (event.key === "Enter") return navigate(node, event)
        const deltas: Record<string, [number, number]> = {
          ArrowLeft: [-20, 0],
          ArrowRight: [20, 0],
          ArrowUp: [0, -20],
          ArrowDown: [0, 20],
        }
        const delta = deltas[event.key]
        if (!delta) return
        event.preventDefault()
        event.stopPropagation()
        stop()
        node.x = (node.x ?? 0) + delta[0] / transform.k
        node.y = (node.y ?? 0) + delta[1] / transform.k
        render()
      })
    list.replaceChildren(
      ...nodes.map((node) => {
        const li = document.createElement("li")
        const link = document.createElement("a")
        link.href = node.href
        link.textContent = node.title
        if (node.current) link.setAttribute("aria-current", "page")
        li.append(link)
        return li
      }),
    )
    count.textContent = `${nodes.length} 篇笔记 · ${links.length} 条联系`
    root.dataset.scope = scope
    root.dataset.filter = filter
    panel
      .querySelectorAll<HTMLButtonElement>("[data-graph-scope]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.graphScope === scope)),
      )
    panel
      .querySelectorAll<HTMLButtonElement>("[data-graph-filter]")
      .forEach((button) =>
        button.setAttribute("aria-pressed", String(button.dataset.graphFilter === filter)),
      )
    error.hidden = nodes.length > 0
    error.textContent = "这个范围暂时没有笔记。可以切换类型或查看全局。"
    highlight()
    reset()
  }
  svgElement.addEventListener("keydown", (event) => {
    if (["+", "=", "-", "0"].includes(event.key)) {
      event.preventDefault()
      if (event.key === "0") fit()
      else svg.call(zoomBehavior.scaleBy, event.key === "-" ? 1 / 1.25 : 1.25)
    }
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [30, 0],
      ArrowRight: [-30, 0],
      ArrowUp: [0, 30],
      ArrowDown: [0, -30],
    }
    if (pan[event.key]) {
      event.preventDefault()
      svg.call(
        zoomBehavior.translateBy,
        ...(pan[event.key].map((value) => value / transform.k) as [number, number]),
      )
    }
  })
  panel.querySelectorAll<HTMLButtonElement>("[data-graph-action]").forEach((button) =>
    button.addEventListener("click", () => {
      switch (button.dataset.graphAction) {
        case "zoom-in":
          svg.call(zoomBehavior.scaleBy, 1.25)
          break
        case "zoom-out":
          svg.call(zoomBehavior.scaleBy, 1 / 1.25)
          break
        case "fit":
          fit()
          break
        case "reset":
          reset()
          break
        case "pause":
          paused = !paused
          pauseButton.setAttribute("aria-pressed", String(paused))
          pauseButton.textContent = paused ? "恢复" : "暂停"
          root.dataset.paused = dialog.dataset.paused = String(paused)
          if (paused) stop()
          else wake()
      }
    }),
  )
  panel.querySelectorAll<HTMLButtonElement>("[data-graph-scope]").forEach((button) =>
    button.addEventListener("click", () => {
      scope = button.dataset.graphScope as typeof scope
      populate()
    }),
  )
  panel.querySelectorAll<HTMLButtonElement>("[data-graph-filter]").forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.graphFilter as NoteGraphFilter
      populate()
    }),
  )
  function resizeCanvas() {
    if (!active()) return
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const first = !width
    width = bounds.width
    height = bounds.height
    svg.attr("viewBox", `0 0 ${width} ${height}`)
    zoomBehavior.extent([
      [0, 0],
      [width, height],
    ])
    if (first) reset()
    else {
      stop()
      fit()
    }
  }
  const resize = new ResizeObserver(resizeCanvas)
  resize.observe(canvas)
  const intersection = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    if (!active()) stop()
    else if (!width) resizeCanvas()
  })
  intersection.observe(host)
  running(false)
  root.dataset.paused = dialog.dataset.paused = "false"
  populate()
  opener.addEventListener("click", () => {
    stop()
    dialog.append(panel)
    dialog.showModal()
    document.documentElement.classList.add("note-graph-active")
    resizeCanvas()
    closer.focus()
  })
  closer.addEventListener("click", () => dialog.close())
  dialog.addEventListener("close", () => {
    stop()
    host.append(panel)
    if (!document.querySelector("dialog.note-graph-dialog[open]"))
      document.documentElement.classList.remove("note-graph-active")
    if (inline) resizeCanvas()
    opener.focus({ preventScroll: true })
  })
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return
    const focusable = [
      ...dialog.querySelectorAll<HTMLElement | SVGElement>(
        'button:not([disabled]), a[href], summary, [tabindex="0"]',
      ),
    ].filter((element) => {
      const closedDetails = element.closest("details:not([open])")
      if (closedDetails && !closedDetails.querySelector("summary")?.contains(element)) return false
      return (
        element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden"
      )
    })
    if (!focusable.length) return
    const first = focusable[0],
      last = focusable.at(-1)!
    if (
      event.shiftKey &&
      (document.activeElement === first || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      ;(last as HTMLElement).focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      ;(first as HTMLElement).focus()
    }
  })
  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect()
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close()
  })
  const visibility = () => {
    if (document.hidden) stop()
  }
  const motion = () => {
    if (reduced.matches) stop()
  }
  document.addEventListener("visibilitychange", visibility)
  reduced.addEventListener("change", motion)
  window.addEventListener("pagehide", stop)
  window.addCleanup(() => {
    stop()
    resize.disconnect()
    intersection.disconnect()
    document.removeEventListener("visibilitychange", visibility)
    reduced.removeEventListener("change", motion)
    window.removeEventListener("pagehide", stop)
    if (dialog.open) dialog.close()
    root.dataset.graphBound = ""
  })
}

document.addEventListener("nav", () => {
  document.querySelectorAll<HTMLElement>(".note-graph").forEach(initialize)
})
