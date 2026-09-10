import {
  createOverviewIndex,
  type OverviewPage,
  type TopicOverviewView,
} from "../../../util/topos/topicOverview"
import type { Concept, KnowledgeModel } from "../../../util/topos/types"
import "../../styles/overview.css"

/** A bounded, named navigation surface; source identities and reader callbacks stay shared. */
export function createTopicOverview(
  model: KnowledgeModel,
  callbacks: {
    change: (value: TopicOverviewView) => void
    open: (id: string) => void
    close: () => void
  },
) {
  const index = createOverviewIndex(model)
  const root = document.createElement("section")
  root.className = "topos-overview"
  root.dataset.toposOverview = "true"
  root.hidden = true
  root.setAttribute("aria-label", "按主题浏览知识对象")
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
    parent: HTMLElement = root,
  ) => {
    const node = document.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }
  const siteRoot = new URL("./", location.href)
  const href = (concept: Concept) =>
    concept.href
      ? new URL(concept.href, siteRoot).href
      : `#focus=${encodeURIComponent(concept.id)}&depth=2.1`
  const intercept = (anchor: HTMLAnchorElement, concept: Concept) => {
    anchor.href = href(concept)
    anchor.dataset.overviewTarget = concept.id
    anchor.addEventListener("click", (event) => {
      if (event.button || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
      event.preventDefault()
      callbacks.open(concept.id)
    })
  }
  const header = add("header")
  header.className = "overview-header"
  const eyebrow = add(
    "p",
    model.mode === "atlas" ? "数学地图 · 分类标题目录" : "已有笔记 · 名称目录",
    header,
  )
  eyebrow.className = "overview-eyebrow"
  const back = add("button", "回到知识地图", header)
  back.type = "button"
  back.dataset.overviewClose = "true"
  back.addEventListener("click", callbacks.close)
  const title = add("h1", "", header)
  title.id = "topos-overview-title"
  title.tabIndex = -1
  root.setAttribute("aria-labelledby", title.id)
  add(
    "p",
    model.mode === "atlas"
      ? "按名称进入分类与来源。这些标题不代表已有个人正文，也不表示形式化验证。"
      : "每个名称都是一处可阅读的笔记或知识点。按类型筛选，或直接查找名称。",
    header,
  ).className = "overview-introduction"
  const controls = add("div")
  controls.className = "overview-filters"
  const searchLabel = add("label", "查找名称", controls)
  const query = add("input", "", searchLabel)
  query.type = "search"
  query.placeholder = "名称、英文或别名"
  query.autocomplete = "off"
  query.dataset.overviewQuery = "true"
  const kindLabel = add("label", "对象类型", controls)
  const kind = add("select", "", kindLabel)
  kind.dataset.overviewKind = "true"
  const status = add("p")
  status.className = "overview-status"
  status.setAttribute("role", "status")
  status.setAttribute("aria-live", "polite")
  const stage = add("div")
  stage.className = "overview-stage"
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.classList.add("overview-links")
  svg.setAttribute("aria-hidden", "true")
  stage.append(svg)
  const grid = add("div", "", stage)
  grid.className = "overview-nodes"
  grid.setAttribute("role", "list")
  grid.setAttribute("aria-label", "当页知识对象")
  const empty = add("p", "", stage)
  empty.className = "overview-empty"
  const pager = add("nav")
  pager.className = "overview-pagination"
  pager.setAttribute("aria-label", "知识对象分页")
  const previous = add("button", "上一页", pager)
  previous.type = "button"
  previous.dataset.overviewPage = "previous"
  const pageLabel = add("span", "", pager)
  const next = add("button", "下一页", pager)
  next.type = "button"
  next.dataset.overviewPage = "next"
  const connections = add("section")
  connections.className = "overview-connections"
  const connectionTitle = add("h2", "查看对象之间的联系", connections)
  connectionTitle.tabIndex = -1
  const connectionStatus = add("p", "指向一个名称、用键盘移到它，或点击“查看联系”。", connections)
  const connectionBody = add("div", "", connections)
  connectionBody.className = "overview-connection-list"
  let selection: string[] | undefined
  let view: TopicOverviewView = { page: 0, query: "", kind: "all" }
  let current: OverviewPage | undefined
  let active: string | undefined
  let signature = ""
  let facetSignature = ""
  let measuredWidth = 0
  const links = new Map<string, HTMLAnchorElement>()
  const marks = new Map<string, HTMLElement>()
  let edgeIDs: string[] = []

  function paintEdges() {
    svg.replaceChildren()
    edgeIDs = []
    if (!active || !current || root.hidden) return
    const bounds = stage.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    svg.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`)
    const origin = marks.get(active)?.getBoundingClientRect()
    if (!origin) return
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs")
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "marker")
    arrow.id = "topos-overview-direction"
    arrow.setAttribute("viewBox", "0 0 8 8")
    arrow.setAttribute("refX", "7")
    arrow.setAttribute("refY", "4")
    arrow.setAttribute("markerWidth", "7")
    arrow.setAttribute("markerHeight", "7")
    arrow.setAttribute("markerUnits", "userSpaceOnUse")
    arrow.setAttribute("orient", "auto")
    const tip = document.createElementNS("http://www.w3.org/2000/svg", "polygon")
    tip.setAttribute("points", "1,1 7,4 1,7")
    tip.setAttribute("fill", "#567e8a")
    arrow.append(tip)
    defs.append(arrow)
    svg.append(defs)
    const x1 = origin.left + origin.width / 2 - bounds.left
    const y1 = origin.top + origin.height / 2 - bounds.top
    for (const item of index.relations(active, current)) {
      if (!item.onPage || item.target.id === active) continue
      const target = marks.get(item.target.id)?.getBoundingClientRect()
      if (!target) continue
      const x2 = target.left + target.width / 2 - bounds.left
      const y2 = target.top + target.height / 2 - bounds.top
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
      path.dataset.overviewRelation = item.relation.id
      path.dataset.source = item.relation.source
      path.dataset.target = item.relation.target
      path.dataset.provenance = item.relation.provenance ?? "reference"
      // The hovered object can be either endpoint; geometry follows the source record.
      const [sx, sy, tx, ty] = item.direction === "outgoing" ? [x1, y1, x2, y2] : [x2, y2, x1, y1]
      const dx = tx - sx,
        dy = ty - sy,
        distance = Math.max(1, Math.hypot(dx, dy)),
        bend = Math.min(35, distance * 0.08)
      // Stop short of the target mark so the DOM dot does not cover the arrowhead.
      const endX = tx - (dx / distance) * 9,
        endY = ty - (dy / distance) * 9,
        cx = (sx + endX) / 2 - (dy / distance) * bend,
        cy = (sy + endY) / 2 + (dx / distance) * bend
      path.setAttribute("d", `M ${sx} ${sy} Q ${cx} ${cy} ${endX} ${endY}`)
      path.setAttribute("marker-end", "url(#topos-overview-direction)")
      svg.append(path)
      edgeIDs.push(item.relation.id)
    }
  }

  function showConnections(id: string, force = false) {
    if (!current || !links.has(id) || (!force && id === active)) return
    active = id
    const concept = current.items.find((item) => item.concept.id === id)!.concept
    for (const [key, link] of links) link.parentElement!.dataset.active = String(key === id)
    connectionTitle.textContent = `${concept.title} · 联系`
    const related = index.relations(id, current)
    connectionStatus.textContent = related.length
      ? `${related.length} 条原始记录。箭头保留原文方向；跨页与主题外的对象也可直接阅读。`
      : "目前没有已登记的原文联系；这里不会补造连接。"
    connectionBody.replaceChildren()
    for (const item of related) {
      const row = add("article", "", connectionBody)
      row.dataset.overviewRelationRow = item.relation.id
      const relationLabel = add("p", "", row)
      relationLabel.className = "overview-relation-kind"
      const category =
        item.relation.provenance === "authored"
          ? "原文论证"
          : item.relation.provenance === "structure"
            ? model.mode === "atlas"
              ? "分类归属"
              : "出处关联"
            : "正文引用"
      relationLabel.textContent = `${category} · ${item.relation.label}`
      const direction = add("p", "", row)
      direction.className = "overview-relation-direction"
      if (item.direction === "outgoing") {
        direction.append(document.createTextNode(`${concept.title} → `))
        intercept(add("a", item.target.title, direction), item.target)
      } else {
        intercept(add("a", item.target.title, direction), item.target)
        direction.append(document.createTextNode(` → ${concept.title}`))
      }
      add("small", item.onPage ? "本页" : item.inSelection ? "其他页" : "所选主题之外", row)
      if (item.relation.evidence)
        add("p", item.relation.evidence, row).className = "overview-evidence"
      if (item.relation.evidenceHref) {
        const source = add("a", "查看原文依据 ↗", row)
        source.href = new URL(item.relation.evidenceHref, siteRoot).href
        source.className = "overview-evidence-link"
      }
    }
    paintEdges()
  }

  function redraw() {
    const width = root.clientWidth || Math.max(300, innerWidth - (innerWidth > 760 ? 272 : 0))
    current = index.page(selection, view, width)
    title.textContent = current.title
    const facets = JSON.stringify(current.facets)
    if (facets !== facetSignature) {
      facetSignature = facets
      kind.replaceChildren()
      const all = add("option", "全部类型", kind)
      all.value = "all"
      for (const facet of current.facets) {
        const option = add("option", `${facet.label} · ${facet.count}`, kind)
        option.value = facet.kind
      }
    }
    if (query.value !== view.query) query.value = view.query
    if (
      ![...kind.options].some((option) => option.value === view.kind) &&
      view.kind &&
      view.kind !== "all"
    ) {
      const absent = add("option", "该类型在所选主题中没有内容", kind)
      absent.value = view.kind
    }
    kind.value = view.kind || "all"
    status.textContent = `${current.total} 个独立对象 · 当前筛选 ${current.filtered} 个 · 每页最多 ${current.pageSize} 个`
    pageLabel.textContent = `第 ${current.page + 1} / ${current.pages} 页`
    previous.disabled = current.page === 0
    next.disabled = current.page >= current.pages - 1
    empty.hidden = current.items.length > 0
    empty.textContent =
      current.total === 0
        ? "尚未选择主题。先在主题栏勾选要阅读的范围。"
        : "没有匹配的名称或类型。清除筛选，或选择其他主题。"
    const nextSignature = JSON.stringify([
      current.items.map((item) => item.concept.id),
      current.eligibleIDs,
      current.pageSize,
    ])
    if (signature === nextSignature) return
    signature = nextSignature
    const wasActive = active
    const focused = [...links].find(([, link]) => link === document.activeElement)?.[0]
    grid.replaceChildren()
    links.clear()
    marks.clear()
    svg.replaceChildren()
    edgeIDs = []
    for (const entry of current.items) {
      const item = add("article", "", grid)
      item.setAttribute("role", "listitem")
      item.className = "overview-node"
      item.style.setProperty("--object-color", entry.concept.color ?? "#476c77")
      item.dataset.overviewNode = entry.concept.id
      const link = add("a", "", item)
      link.className = "overview-node-link"
      link.dataset.overviewOpen = entry.concept.id
      const mark = add("span", "", link)
      mark.className = "overview-mark"
      mark.setAttribute("aria-hidden", "true")
      marks.set(entry.concept.id, mark)
      add("span", entry.typeLabel, link).className = "overview-node-type"
      add("span", entry.concept.title, link).className = "overview-node-title"
      intercept(link, entry.concept)
      links.set(entry.concept.id, link)
      link.addEventListener("pointerenter", () => showConnections(entry.concept.id))
      link.addEventListener("focus", () => showConnections(entry.concept.id))
      const relationButton = add("button", `${entry.neighborCount} 个关联对象 · 查看联系`, item)
      relationButton.type = "button"
      relationButton.dataset.overviewConnections = entry.concept.id
      relationButton.setAttribute("aria-label", `查看${entry.concept.title}的联系`)
      relationButton.addEventListener("click", () => {
        showConnections(entry.concept.id)
        connectionTitle.focus()
        connectionTitle.scrollIntoView({ block: "nearest", behavior: "instant" })
      })
    }
    active = undefined
    if (wasActive && links.has(wasActive)) showConnections(wasActive, true)
    else {
      connectionTitle.textContent = "查看对象之间的联系"
      connectionStatus.textContent = "指向一个名称、用键盘移到它，或点击“查看联系”。"
      connectionBody.replaceChildren()
    }
    if (focused) links.get(focused)?.focus({ preventScroll: true })
  }

  const change = (nextView: TopicOverviewView) => callbacks.change(nextView)
  query.addEventListener("input", () => change({ ...view, page: 0, query: query.value }))
  kind.addEventListener("change", () => change({ ...view, page: 0, kind: kind.value }))
  const turnPage = (page: number) => {
    change({ ...view, page })
    // The controller updates synchronously. Start this page at its first named
    // object, instead of leaving keyboard users at the previous page's footer.
    const first = links.values().next().value
    ;(first ?? title).focus({ preventScroll: true })
    ;(first ?? title).scrollIntoView({ block: "start", behavior: "instant" })
  }
  previous.addEventListener("click", () => turnPage(Math.max(0, (current?.page ?? 0) - 1)))
  next.addEventListener("click", () => turnPage((current?.page ?? 0) + 1))
  // Native scrolling and link activation belong to this surface, never canvas dragging/zoom.
  for (const event of ["pointerdown", "pointermove", "pointerup", "pointercancel", "wheel"])
    root.addEventListener(event, (e) => e.stopPropagation(), { passive: true })
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      callbacks.close()
    }
    if (["+", "-", "="].includes(event.key)) event.stopPropagation()
  })
  const observer = new ResizeObserver(() => {
    if (root.hidden || root.clientWidth === measuredWidth) return
    measuredWidth = root.clientWidth
    redraw()
    paintEdges()
  })
  observer.observe(root)
  document.fonts.ready.then(() => {
    if (!root.hidden) paintEdges()
  })

  return {
    element: root,
    update(selected: string[] | undefined, value: TopicOverviewView | undefined) {
      if (!value) return
      selection = selected ? [...selected] : undefined
      view = { ...value }
      redraw()
    },
    focus(id?: string) {
      // An off-page relation opens the same reader without changing this page.
      // Its original source and relation list remain mounted while reading.
      const target = id
        ? (links.get(id) ??
          [...connectionBody.querySelectorAll<HTMLAnchorElement>("a[data-overview-target]")].find(
            (link) => link.dataset.overviewTarget === id,
          ))
        : undefined
      ;(target ?? title).focus({ preventScroll: true })
      if (target) target.scrollIntoView({ block: "nearest", behavior: "instant" })
      paintEdges()
    },
    snapshot() {
      return {
        visible: !root.hidden,
        view: { ...view, page: current?.page ?? view.page },
        total: current?.total ?? 0,
        filtered: current?.filtered ?? 0,
        pages: current?.pages ?? 1,
        eligibleIDs: current?.eligibleIDs ?? [],
        visibleIDs: current?.items.map((item) => item.concept.id) ?? [],
        selected: active,
        edgeIDs: [...edgeIDs],
        links: [...links].map(([id, link]) => ({ id, href: link.href, title: link.textContent })),
        relationIDs:
          active && current ? index.relations(active, current).map((item) => item.relation.id) : [],
      }
    },
  }
}
