import {
  select,
  drag,
  zoom,
  zoomIdentity,
  forceSimulation,
  forceLink,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
  type ZoomTransform,
} from "d3"
import {
  readerChapterGraph,
  wrapGraphTitle,
  type ReaderGraphData,
  type ReaderGraphNode,
} from "../../util/noteGraph"

type GraphNode = ReaderGraphNode &
  SimulationNodeDatum & {
    anchorX: number
    anchorY: number
    labelWidth: number
    labelHeight: number
    labelLines: string[]
  }
type GraphEdge = SimulationLinkDatum<GraphNode> & { source: GraphNode; target: GraphNode }
function initialize(root: HTMLElement) {
  if (root.dataset.graphBound) return
  root.dataset.graphBound = "true"
  const data = JSON.parse(root.dataset.graph!) as ReaderGraphData
  const inline = root.dataset.variant === "inline"
  const dialog = root.querySelector<HTMLDialogElement>(".note-graph-dialog")!
  const host = root.querySelector<HTMLElement>(".note-graph-inline-host")!
  const panel = root.querySelector<HTMLElement>(".note-graph-panel")!
  const opener = root.querySelector<HTMLButtonElement>(".note-graph-open")!
  const closer = root.querySelector<HTMLButtonElement>(".note-graph-close")!
  const svgElement = root.querySelector<SVGSVGElement>(".note-graph-svg")!
  const canvas = root.querySelector<HTMLElement>(".note-graph-canvas")!
  const tooltip = root.querySelector<HTMLElement>(".note-graph-hover")!
  const error = root.querySelector<HTMLElement>(".note-graph-error")!
  const pauseButton = root.querySelector<HTMLButtonElement>('[data-graph-action="pause"]')!
  const focusControl = root.querySelector<HTMLLabelElement>(".note-graph-focus-control")!
  const focusSelect = root.querySelector<HTMLSelectElement>(".note-graph-focus-select")!
  const list = root.querySelector<HTMLUListElement>(".note-graph-list ul")!
  const cross = root.querySelector<HTMLElement>(".note-graph-cross")!
  const count = root.querySelector<HTMLElement>(".note-graph-count")!
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  let chapterId = data.initialChapterId
  let focusId = data.initialFocusId
  let paused = false,
    width = 0,
    height = 0,
    suppressUntil = 0
  let transform: ZoomTransform = zoomIdentity
  let nodes: GraphNode[] = [],
    links: GraphEdge[] = []
  const measure = document.createElement("canvas").getContext("2d")!
  const nodeLabelFont = `12px ${getComputedStyle(root).fontFamily}`
  const svg = select(svgElement)
  const layer = svg.append("g").attr("class", "note-graph-layer")
  const edgeGroup = layer.append("g").attr("aria-hidden", "true")
  const chapterGroup = layer.append("g").attr("class", "note-graph-chapters")
  const nodeGroup = layer.append("g")
  let nodeElements = nodeGroup.selectAll<SVGAElement, GraphNode>("a")
  let edgeElements = edgeGroup.selectAll<SVGLineElement, GraphEdge>("line")
  const simulation = forceSimulation<GraphNode>([]).stop().alphaDecay(0.08).velocityDecay(0.5)
  const active = () => dialog.open || (inline && host.getBoundingClientRect().height > 0)
  function stop() {
    simulation.stop().alphaTarget(0)
    root.dataset.running = dialog.dataset.running = "false"
  }
  function wake() {
    if (paused || reduced.matches || !active() || document.hidden || !nodes.length) return stop()
    simulation.alpha(0.3).alphaTarget(0).restart()
    root.dataset.running = dialog.dataset.running = "true"
  }
  function emitRead(node: ReaderGraphNode, trigger: Element) {
    document.dispatchEvent(
      new CustomEvent("reader:open", { detail: { slug: node.id, href: node.href, trigger } }),
    )
  }
  function wrapTitle(
    title: string,
    limit = width < 600 ? 142 : 182,
    font = nodeLabelFont,
    maxLines = 3,
  ) {
    measure.font = font
    const lines = wrapGraphTitle(title, limit, (text) => measure.measureText(text).width)
    if (lines.length > maxLines) {
      lines.length = maxLines
      let last = lines[maxLines - 1]
      while (last && measure.measureText(last + "…").width > limit) {
        const space = last.lastIndexOf(" ")
        last = space > 0 ? last.slice(0, space) : Array.from(last).slice(0, -1).join("")
      }
      lines[maxLines - 1] = last + "…"
    }
    return lines
  }
  function updateLabels() {
    nodeElements.select("text").attr("font-size", 12 / Math.max(0.8, transform.k))
  }
  function render() {
    nodeElements.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`)
    edgeElements
      .attr("x1", (edge) => edge.source.x ?? 0)
      .attr("y1", (edge) => edge.source.y ?? 0)
      .attr("x2", (edge) => edge.target.x ?? 0)
      .attr("y2", (edge) => edge.target.y ?? 0)
    updateLabels()
  }
  const zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.35, 3])
    .filter(
      (event) =>
        event.type === "wheel" ||
        event.touches?.length > 1 ||
        (!event.button &&
          !(event.target as Element).closest(".note-graph-node,.note-graph-chapter")),
    )
    .on("zoom", (event) => {
      transform = event.transform
      layer.attr("transform", transform.toString())
      updateLabels()
    })
  svg.call(zoomBehavior).on("dblclick.zoom", null)
  function fit() {
    if (!width || !height) return
    const bounds = layer.node()!.getBBox()
    if (!bounds.width || !bounds.height) return
    const k = Math.min(1, (width - 28) / bounds.width, (height - 76) / bounds.height)
    svg.call(
      zoomBehavior.transform,
      zoomIdentity
        .translate(
          width / 2 - (bounds.x + bounds.width / 2) * k,
          (height - 58) / 2 - (bounds.y + bounds.height / 2) * k,
        )
        .scale(Math.max(0.35, k)),
    )
  }
  function collideLabels(alpha: number) {
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i],
          b = nodes[j],
          dx = (b.x ?? 0) - (a.x ?? 0),
          dy = (b.y ?? 0) - (a.y ?? 0)
        const overlapX = (a.labelWidth + b.labelWidth) / 2 + 18 - Math.abs(dx)
        const overlapY = Math.max(a.labelHeight, b.labelHeight) + 28 - Math.abs(dy)
        if (overlapX <= 0 || overlapY <= 0) continue
        if (overlapX < overlapY) {
          const nudge = Math.sign(dx || 1) * overlapX * alpha * 0.6
          if (a.fx == null) a.vx = (a.vx ?? 0) - nudge
          if (b.fx == null) b.vx = (b.vx ?? 0) + nudge
        } else {
          const nudge = Math.sign(dy || 1) * overlapY * alpha * 0.6
          if (a.fy == null) a.vy = (a.vy ?? 0) - nudge
          if (b.fy == null) b.vy = (b.vy ?? 0) + nudge
        }
      }
  }
  function reset() {
    stop()
    if (!width || !height) return
    if (!chapterId) {
      renderChapters()
      return
    }
    const cols = width < 600 ? 2 : Math.min(4, Math.max(2, Math.floor(width / 205)))
    const rows = Math.ceil(nodes.length / cols)
    const cellW = Math.max(width / cols, width < 600 ? 174 : 200)
    const cellH = Math.max(76, Math.min(112, (height - 80) / Math.max(1, rows)))
    nodes.forEach((node, index) => {
      node.labelLines = wrapTitle(node.title)
      node.labelWidth = Math.max(
        60,
        ...node.labelLines.map((line) => measure.measureText(line).width),
      )
      node.labelHeight = node.labelLines.length * 15
      node.x = node.anchorX = ((index % cols) + 0.5) * cellW
      node.y = node.anchorY = Math.floor(index / cols) * cellH + 20
      node.fx = node.fy = null
      node.vx = node.vy = 0
    })
    nodeElements.selectAll("text").remove()
    nodeElements.each(function (node) {
      const text = select(this)
        .append("text")
        .attr("text-anchor", "middle")
        .attr("y", 21)
        .attr("font-size", 12)
      node.labelLines.forEach((line, index) =>
        text
          .append("tspan")
          .attr("x", 0)
          .attr("dy", index ? 15 : 0)
          .text(line),
      )
    })
    simulation
      .nodes(nodes)
      .force("link", forceLink<GraphNode, GraphEdge>(links).distance(160).strength(0.018))
      .force("x", forceX<GraphNode>((node) => node.anchorX).strength(0.28))
      .force("y", forceY<GraphNode>((node) => node.anchorY).strength(0.28))
      .force("label-collision", collideLabels)
    render()
    fit()
  }
  function highlight(id?: string) {
    const adjacent = new Set(id ? [id] : [])
    if (id)
      for (const edge of links) {
        if (edge.source.id === id) adjacent.add(edge.target.id)
        if (edge.target.id === id) adjacent.add(edge.source.id)
      }
    nodeElements
      .classed("is-active", (node) => node.id === id)
      .classed("is-dim", (node) => Boolean(id && !adjacent.has(node.id)))
    edgeElements.classed("is-active", (edge) => edge.source.id === id || edge.target.id === id)
    tooltip.hidden = !id
    tooltip.textContent = data.nodes.find((node) => node.id === id)?.title ?? ""
    if (id) nodeElements.filter((node) => node.id === id).raise()
  }
  function listLink(node: ReaderGraphNode) {
    const li = document.createElement("li"),
      a = document.createElement("a")
    a.href = node.href
    a.dataset.graphRead = node.id
    a.textContent = node.title
    li.append(a)
    return li
  }
  function renderChapters() {
    if (!width || !height) return
    const columns = width < 700 ? 1 : Math.min(3, data.chapters.length)
    const cardWidth = Math.min(300, width / columns - 36)
    const groups = chapterGroup
      .selectAll<SVGGElement, ReaderGraphData["chapters"][number]>("g")
      .data(data.chapters)
      .join("g")
      .attr("class", "note-graph-chapter")
      .attr("data-chapter-id", (chapter) => chapter.id)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", (chapter) => `展开${chapter.title}，${chapter.knowledge.length}个知识点`)
      .attr(
        "transform",
        (_, index) =>
          `translate(${(((index % columns) + 0.5) * width) / columns - cardWidth / 2},${Math.floor(index / columns) * 128 + 36})`,
      )
    groups.selectAll("*").remove()
    groups.append("rect").attr("width", cardWidth).attr("height", 92).attr("rx", 2)
    groups.each(function (chapter) {
      const group = select(this),
        title = group
          .append("text")
          .attr("class", "note-graph-chapter-title")
          .attr("x", 16)
          .attr("y", 27)
      const titleStyle = getComputedStyle(title.node()!)
      const lines = wrapTitle(
        chapter.title,
        cardWidth - 32,
        `${titleStyle.fontWeight} ${titleStyle.fontSize} ${titleStyle.fontFamily}`,
        2,
      )
      lines.forEach((line, i) =>
        title
          .append("tspan")
          .attr("x", 16)
          .attr("dy", i ? 18 : 0)
          .text(line),
      )
      group
        .append("text")
        .attr("class", "note-graph-chapter-meta")
        .attr("x", 16)
        .attr("y", 75)
        .text(`${chapter.knowledge.length} 个知识点 · 展开`)
    })
    groups
      .on("click.graph", (_, chapter) => {
        chapterId = chapter.id
        focusId = undefined
        populate()
      })
      .on("keydown.graph", (event: KeyboardEvent, chapter) => {
        if (["Enter", " "].includes(event.key)) {
          event.preventDefault()
          chapterId = chapter.id
          focusId = undefined
          populate()
          focusSelect.focus()
        }
      })
    fit()
  }
  function populate() {
    stop()
    tooltip.hidden = true
    const chapter = data.chapters.find((entry) => entry.id === chapterId)
    if (!chapter) chapterId = undefined
    root.dataset.graphLevel = chapter ? "chapter" : "book"
    root.dataset.chapterId = chapterId ?? ""
    root.dataset.focusId = focusId ?? ""
    panel.querySelector<HTMLElement>(".note-graph-chapter-name")!.textContent = chapter
      ? ` / ${chapter.title}`
      : data.book.title
    focusControl.hidden = !chapter
    pauseButton.disabled = !chapter
    focusSelect.replaceChildren(
      new Option("本章全部知识点", ""),
      ...(chapter?.knowledge ?? []).map(
        (id) => new Option(data.nodes.find((node) => node.id === id)?.title ?? id, id),
      ),
    )
    focusSelect.value = focusId ?? ""
    chapterGroup.selectAll("*").remove()
    if (!chapter) {
      nodes = []
      links = []
      nodeGroup.selectAll("*").remove()
      edgeGroup.selectAll("*").remove()
      cross.hidden = true
      count.textContent = `${data.chapters.length} 章 · ${data.chapters.reduce((sum, entry) => sum + entry.knowledge.length, 0)} 个知识点`
      list.replaceChildren(
        ...data.chapters.map((entry) => {
          const li = document.createElement("li"),
            a = document.createElement("a")
          a.href = entry.href
          a.textContent = `${entry.title} · ${entry.knowledge.length} 个知识点`
          li.append(a)
          return li
        }),
      )
      error.hidden = data.chapters.length > 0
      renderChapters()
      return
    }
    const view = readerChapterGraph(data, chapter.id, focusId)
    nodes = view.nodes.map((node) => ({
      ...node,
      anchorX: 0,
      anchorY: 0,
      labelWidth: 0,
      labelHeight: 0,
      labelLines: [],
    }))
    const byId = new Map(nodes.map((node) => [node.id, node]))
    links = view.links.map((link) => ({
      source: byId.get(link.source)!,
      target: byId.get(link.target)!,
    }))
    edgeElements = edgeGroup
      .selectAll<SVGLineElement, GraphEdge>("line")
      .data(links)
      .join("line")
      .attr("class", "note-graph-edge")
    nodeElements = nodeGroup
      .selectAll<SVGAElement, GraphNode>("a")
      .data(nodes, (node) => node.id)
      .join<SVGAElement>("a")
      .attr(
        "class",
        (node) =>
          `note-graph-node${node.current ? " is-current" : ""}${node.id === focusId ? " is-focus" : ""}`,
      )
      .attr("data-id", (node) => node.id)
      .attr("data-role", (node) => node.role)
      .attr("href", (node) => node.href)
      .attr("tabindex", 0)
      .attr("aria-label", (node) => `阅读${node.title}`)
      .attr("aria-current", (node) => (node.current ? "page" : null))
    nodeElements.selectAll("*").remove()
    nodeElements.append("circle").attr("class", "note-graph-hit").attr("r", 19)
    nodeElements.append("circle").attr("class", "note-graph-focus").attr("r", 15)
    nodeElements
      .append("circle")
      .attr("class", "note-graph-dot")
      .attr("r", (node) => (node.id === focusId ? 8 : 6))
    nodeElements.append("title").text((node) => node.title)
    let moved = 0
    nodeElements.call(
      drag<SVGAElement, GraphNode>()
        .clickDistance(6)
        .on("start", (event, node) => {
          event.sourceEvent.stopPropagation()
          moved = 0
          node.fx = node.x
          node.fy = node.y
          highlight(node.id)
          wake()
        })
        .on("drag", (event, node) => {
          moved += Math.hypot(event.dx, event.dy) * transform.k
          node.fx = node.x = event.x
          node.fy = node.y = event.y
          render()
        })
        .on("end", (_, node) => {
          if (moved > 6) suppressUntil = performance.now() + 400
          node.anchorX = node.x ?? node.anchorX
          node.anchorY = node.y ?? node.anchorY
          node.fx = node.fy = null
          wake()
          highlight()
        }),
    )
    nodeElements
      .on("click.graph", function (event, node) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        if (event.defaultPrevented || performance.now() < suppressUntil) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        emitRead(node, this)
      })
      .on("focus.graph", (_, node) => highlight(node.id))
      .on("blur.graph", () => highlight())
      .on("mouseenter.graph", (_, node) => highlight(node.id))
      .on("mouseleave.graph", () => highlight())
      .on("keydown.graph", function (event: KeyboardEvent, node) {
        if (event.key === "Enter") {
          if (!event.ctrlKey && !event.metaKey) {
            event.preventDefault()
            event.stopPropagation()
            emitRead(node, this)
          }
          return
        }
        const delta: Record<string, [number, number]> = {
          ArrowLeft: [-20, 0],
          ArrowRight: [20, 0],
          ArrowUp: [0, -20],
          ArrowDown: [0, 20],
        }
        if (delta[event.key]) {
          event.preventDefault()
          event.stopPropagation()
          stop()
          node.x = node.anchorX = (node.x ?? 0) + delta[event.key][0] / transform.k
          node.y = node.anchorY = (node.y ?? 0) + delta[event.key][1] / transform.k
          render()
        }
      })
    list.replaceChildren(...nodes.map(listLink))
    cross.hidden = view.crossChapter.length === 0
    cross.querySelector("ul")!.replaceChildren(
      ...view.crossChapter.map((node) => {
        const li = listLink(node)
        const chapter = data.chapters.find((entry) => entry.id === node.chapterId)
        li.append(document.createTextNode(` · ${chapter?.title ?? "其他章节"}`))
        return li
      }),
    )
    count.textContent = `${nodes.length} 个${focusId ? "相关条目" : "知识点"} · ${links.length} 处引用`
    error.hidden = nodes.length > 0
    error.textContent = "这个章节暂时没有知识点。"
    reset()
  }
  root.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>("a[data-graph-read]")
    if (
      !link ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return
    const entry = data.nodes.find((node) => node.id === link.dataset.graphRead)
    if (entry) {
      event.preventDefault()
      emitRead(entry, link)
    }
  })
  focusSelect.addEventListener("change", () => {
    focusId = focusSelect.value || undefined
    populate()
  })
  panel.querySelectorAll<HTMLButtonElement>("[data-graph-action]").forEach((button) =>
    button.addEventListener("click", () => {
      switch (button.dataset.graphAction) {
        case "book":
          chapterId = undefined
          focusId = undefined
          populate()
          break
        case "zoom-in":
          svg.call(zoomBehavior.scaleBy, 1.2)
          break
        case "zoom-out":
          svg.call(zoomBehavior.scaleBy, 1 / 1.2)
          break
        case "fit":
          fit()
          break
        case "reset":
          reset()
          break
        case "pause":
          paused = !paused
          root.dataset.paused = dialog.dataset.paused = String(paused)
          pauseButton.setAttribute("aria-pressed", String(paused))
          pauseButton.textContent = paused ? "恢复" : "暂停"
          if (paused) stop()
          else wake()
      }
    }),
  )
  simulation.on("tick", render).on("end", () => {
    root.dataset.running = dialog.dataset.running = "false"
  })
  function resizeCanvas() {
    if (!active()) return
    const bounds = canvas.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const changed = width !== bounds.width || height !== bounds.height
    width = bounds.width
    height = bounds.height
    svg.attr("viewBox", `0 0 ${width} ${height}`)
    zoomBehavior.extent([
      [0, 0],
      [width, height],
    ])
    if (changed) reset()
  }
  const resize = new ResizeObserver(resizeCanvas)
  resize.observe(canvas)
  stop()
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
    const candidates = [
      ...dialog.querySelectorAll<HTMLElement | SVGElement>(
        'button:not([disabled]),select,a[href],summary,[tabindex="0"]',
      ),
    ].filter((element) => {
      const closed = element.closest("details:not([open])")
      return (
        (!closed || closed.querySelector("summary")?.contains(element)) &&
        element.getClientRects().length > 0 &&
        getComputedStyle(element).visibility !== "hidden"
      )
    })
    if (!candidates.length) return
    const first = candidates[0],
      last = candidates.at(-1)!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      ;(last as HTMLElement).focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      ;(first as HTMLElement).focus()
    }
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
    document.removeEventListener("visibilitychange", visibility)
    reduced.removeEventListener("change", motion)
    window.removeEventListener("pagehide", stop)
  })
}
document.addEventListener("nav", () =>
  document.querySelectorAll<HTMLElement>(".note-graph").forEach(initialize),
)
