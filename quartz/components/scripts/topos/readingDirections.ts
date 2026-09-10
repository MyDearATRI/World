import type { Concept, KnowledgeModel } from "../../../util/topos/types"
import {
  createReadingDirectionIndex,
  locateReadingDirection,
  readingDirectionPage,
  readingRelationCategory,
  type ReadingDirection,
  type ReadingDirectionsView,
} from "../../../util/topos/readingDirections"
import { overviewKind, overviewTypeLabel } from "../../../util/topos/topicOverview"
import "../../styles/readingDirections.css"

let instance = 0

/** Quiet, bounded directional maps around the unchanged mathematical reading surface. */
export function createReadingDirections(
  model: KnowledgeModel,
  callbacks: { open: (id: string) => void; overview: () => void },
) {
  const index = createReadingDirectionIndex(model)
  const prefix = `reading-direction-${++instance}`
  const element = document.createElement("nav")
  element.className = "topos-reading-directions"
  element.setAttribute("aria-label", "当前阅读的联系与去向")
  const mobile = matchMedia("(max-width: 900px)")
  const base = new URL("./", location.href)
  const pages: Record<ReadingDirection, number> = { incoming: 0, outgoing: 0 }
  let view: ReadingDirectionsView | undefined
  let updateKey = ""
  const remembered = new Map<
    string,
    Record<ReadingDirection, { page: number; open: boolean; scroll: number }>
  >()
  const lastSide = new Map<string, ReadingDirection>()
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text: string,
    parent: HTMLElement,
  ) => {
    const node = document.createElement(tag)
    node.textContent = text
    parent.append(node)
    return node
  }
  const svgNode = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string>,
  ) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag)
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
    return node
  }
  const href = (concept: Concept) =>
    concept.href
      ? new URL(concept.href, base).href
      : `#focus=${encodeURIComponent(concept.id)}&depth=2.1`
  const activate = (link: HTMLAnchorElement | SVGAElement, concept: Concept) => {
    link.setAttribute("href", href(concept))
    link.dataset.directionTarget = concept.id
    link.addEventListener("click", (event) => {
      const pointer = event as MouseEvent
      if (
        pointer.button ||
        pointer.ctrlKey ||
        pointer.metaKey ||
        pointer.shiftKey ||
        pointer.altKey
      )
        return
      event.preventDefault()
      const side = link.closest<HTMLElement>("[data-reading-direction]")?.dataset.readingDirection
      if (view && (side === "incoming" || side === "outgoing"))
        lastSide.set(`${view.focus.id}\0${concept.id}`, side)
      callbacks.open(concept.id)
    })
  }
  const rails = (["incoming", "outgoing"] as const).map((direction) => {
    const rail = add("details", "", element)
    rail.className = "reading-direction-rail"
    rail.dataset.readingDirection = direction
    rail.open = !mobile.matches
    const summary = add("summary", "", rail)
    const name = add("span", direction === "incoming" ? "指向这里" : "从这里出发", summary)
    name.id = `${prefix}-${direction}`
    const count = add("small", "", summary)
    const body = add("div", "", rail)
    body.className = "reading-direction-body"
    add("p", "按原文连线方向 · 不表示先修顺序", body).className = "reading-direction-caption"
    const content = add("div", "", body)
    const pager = add("div", "", body)
    pager.className = "reading-direction-pager"
    pager.setAttribute("aria-label", `${name.textContent}分页`)
    const previous = add("button", "上一组", pager)
    previous.type = "button"
    previous.dataset.directionPage = "previous"
    const status = add("span", "", pager)
    status.dataset.directionStatus = "true"
    status.setAttribute("role", "status")
    const next = add("button", "下一组", pager)
    next.type = "button"
    next.dataset.directionPage = "next"
    const footer = add("div", "", body)
    footer.className = "reading-direction-footer"
    const overview = add("button", "浏览主题", footer)
    overview.type = "button"
    overview.dataset.directionOverview = "true"
    overview.addEventListener("click", callbacks.overview)
    const trail = add("span", "", footer)
    previous.addEventListener("click", () => {
      pages[direction]--
      render(direction)
    })
    next.addEventListener("click", () => {
      pages[direction]++
      render(direction)
    })
    return { direction, rail, count, content, previous, next, status, pager, trail }
  })
  const configureDisclosure = () => {
    for (const { rail } of rails) rail.open = !mobile.matches
  }
  mobile.addEventListener("change", configureDisclosure)

  function rememberView() {
    if (!view) return
    remembered.set(
      view.focus.id,
      Object.fromEntries(
        rails.map(({ direction, rail }) => [
          direction,
          { page: pages[direction], open: rail.open, scroll: rail.scrollTop },
        ]),
      ) as Record<ReadingDirection, { page: number; open: boolean; scroll: number }>,
    )
  }

  function render(direction: ReadingDirection) {
    if (!view) return
    const rail = rails.find((item) => item.direction === direction)!
    const entries = view[direction]
    const page = readingDirectionPage(entries, pages[direction])
    pages[direction] = page.page
    rail.count.textContent = String(page.total)
    rail.content.replaceChildren()
    rail.pager.hidden = page.pages <= 1
    rail.previous.disabled = page.page === 0
    rail.next.disabled = page.page + 1 >= page.pages
    rail.status.textContent = `${page.page + 1} / ${page.pages}`
    rail.trail.replaceChildren()
    if (direction === "incoming" && view.previous) {
      add("small", "你的来路 · ", rail.trail)
      const previous = add("a", view.previous.title, rail.trail)
      previous.dataset.readingTrail = "true"
      activate(previous, view.previous)
    }
    if (!entries.length) {
      add(
        "p",
        direction === "incoming"
          ? "暂无指向这份内容的已记录联系。"
          : "这份内容暂无向外的已记录联系。",
        rail.content,
      ).className = "reading-direction-empty"
      return
    }
    const svg = svgNode("svg", {
      viewBox: "0 0 190 132",
      "data-direction-map": direction,
      "aria-label": `${view.focus.title}：${direction === "incoming" ? "指向这里" : "从这里出发"}的原文联系`,
    })
    rail.content.append(svg)
    const defs = svgNode("defs", {})
    svg.append(defs)
    const focusX = direction === "incoming" ? 174 : 16
    const neighborX = direction === "incoming" ? 22 : 168
    const focusY = 65
    const focusNode = svgNode("circle", {
      cx: String(focusX),
      cy: String(focusY),
      r: "7",
      class: "reading-direction-focus",
      "data-direction-current": view.focus.id,
    })
    const currentTitle = svgNode("title", {})
    currentTitle.textContent = `当前阅读：${view.focus.title}`
    focusNode.append(currentTitle)
    const currentLabel = svgNode("text", {
      x: String(focusX),
      y: "88",
      "text-anchor": "middle",
      class: "reading-direction-current-label",
    })
    currentLabel.textContent = "当前"
    const list = add("ol", "", rail.content)
    list.className = "reading-direction-list"
    list.start = page.page * 4 + 1
    page.items.forEach((entry, i) => {
      const number = page.page * 4 + i + 1
      const y = page.items.length === 1 ? 65 : 18 + (i * 94) / (page.items.length - 1)
      for (const [edgeIndex, relation] of entry.relations.entries()) {
        const category = readingRelationCategory(relation)
        const markerID = `${prefix}-${direction}-${i}-${edgeIndex}`
        const marker = svgNode("marker", {
          id: markerID,
          viewBox: "0 0 8 8",
          refX: "7",
          refY: "4",
          markerWidth: "5",
          markerHeight: "5",
          orient: "auto",
        })
        marker.append(
          svgNode("path", {
            d: "M1,1 L7,4 L1,7",
            fill: "none",
            stroke: category.color,
            "stroke-width": "1.3",
          }),
        )
        defs.append(marker)
        const incoming = direction === "incoming"
        const sourceX = incoming ? neighborX + 7 : focusX + 10
        const targetX = incoming ? focusX - 10 : neighborX - 7
        const sourceY = incoming ? y : focusY
        const targetY = incoming ? focusY : y
        const bend = (edgeIndex - (entry.relations.length - 1) / 2) * 4
        const path = svgNode("path", {
          d: `M${sourceX},${sourceY} C90,${sourceY + bend} 100,${targetY + bend} ${targetX},${targetY}`,
          fill: "none",
          stroke: category.color,
          "marker-end": `url(#${markerID})`,
          "data-relation-id": relation.id,
          "data-source": relation.source,
          "data-target": relation.target,
          "data-relation-type": relation.type,
          "data-provenance": relation.provenance ?? "recorded",
        })
        const title = svgNode("title", {})
        title.textContent = `${category.label} · ${relation.label}`
        path.append(title)
        svg.append(path)
      }
      const node = svgNode("a", { "aria-label": `打开 ${entry.concept.title}`, tabindex: "-1" })
      activate(node, entry.concept)
      node.append(
        svgNode("circle", {
          cx: String(neighborX),
          cy: String(y),
          r: "8",
          fill: entry.concept.color ?? "#71868d",
        }),
      )
      const digit = svgNode("text", {
        x: String(neighborX),
        y: String(y + 3),
        "text-anchor": "middle",
        class: "reading-direction-number",
      })
      digit.textContent = String(number)
      node.append(digit)
      svg.append(node)
      const item = add("li", "", list)
      const link = add("a", entry.concept.title, item)
      activate(link, entry.concept)
      link.className = "reading-direction-title"
      const metadata = [overviewTypeLabel(overviewKind(entry.concept))]
      if (!entry.inSelection) metadata.push("其他主题")
      add("small", metadata.join(" · "), item).className = "reading-direction-type"
      const labels = [...new Set(entry.relations.map((relation) => relation.label))]
      add("p", labels.join(" · "), item).className = "reading-direction-label"
      const evidence = add("details", "", item)
      evidence.className = "reading-direction-evidence"
      add(
        "summary",
        `联系依据${entry.relations.length > 1 ? ` · ${entry.relations.length}` : ""}`,
        evidence,
      )
      for (const relation of entry.relations) {
        const record = add("div", "", evidence)
        record.dataset.directionEvidence = relation.id
        record.dataset.provenance = relation.provenance ?? "recorded"
        record.style.setProperty("--relation-color", readingRelationCategory(relation).color)
        add("strong", `${readingRelationCategory(relation).label} · ${relation.label}`, record)
        add("p", relation.explanation || relation.evidence, record)
        if (relation.evidenceHref) {
          const source = add("a", "查看原文出处 ↗", record)
          source.href = new URL(relation.evidenceHref, base).href
        }
      }
    })
    svg.append(focusNode, currentLabel)
  }

  return {
    element,
    update(focus: string, selected?: string[], trail?: string[]) {
      const key = JSON.stringify([focus, selected ? [...selected].sort() : undefined, trail])
      if (key === updateKey) return
      rememberView()
      updateKey = key
      const previous = remembered.get(focus)
      if (view?.focus.id !== focus) {
        pages.incoming = previous?.incoming.page ?? 0
        pages.outgoing = previous?.outgoing.page ?? 0
        for (const { direction, rail } of rails)
          rail.open = previous?.[direction].open ?? !mobile.matches
      }
      view = index(focus, selected, trail)
      element.dataset.readingFocus = focus
      render("incoming")
      render("outgoing")
      for (const { direction, rail } of rails) rail.scrollTop = previous?.[direction].scroll ?? 0
    },
    focus(id: string) {
      if (!view) return false
      const target = locateReadingDirection(view, id, lastSide.get(`${view.focus.id}\0${id}`))
      if (target) {
        pages[target.direction] = target.page
        render(target.direction)
        const rail = rails.find((item) => item.direction === target.direction)!
        rail.rail.open = true
        const link = rail.content.querySelector<HTMLAnchorElement>(
          `.reading-direction-title[data-direction-target="${CSS.escape(id)}"]`,
        )
        if (link) {
          link.focus({ preventScroll: true })
          link.scrollIntoView({ block: "nearest", behavior: "instant" })
          rememberView()
          return true
        }
      }
      const trail = element.querySelector<HTMLAnchorElement>(
        `[data-reading-trail][data-direction-target="${CSS.escape(id)}"]`,
      )
      if (trail) {
        trail.closest<HTMLDetailsElement>(".reading-direction-rail")!.open = true
        trail.focus({ preventScroll: true })
        trail.scrollIntoView({ block: "nearest", behavior: "instant" })
        rememberView()
        return true
      }
      return false
    },
    snapshot() {
      const side = (direction: ReadingDirection) => {
        const entries = view?.[direction] ?? []
        const page = readingDirectionPage(entries, pages[direction])
        return {
          page: page.page,
          pages: page.pages,
          open: rails.find((item) => item.direction === direction)!.rail.open,
          allIDs: entries.map((entry) => entry.concept.id),
          visibleIDs: page.items.map((entry) => entry.concept.id),
          relations: entries.flatMap((entry) =>
            entry.relations.map((relation) => ({
              id: relation.id,
              source: relation.source,
              target: relation.target,
              type: relation.type,
              provenance: relation.provenance,
              evidenceHref: relation.evidenceHref,
            })),
          ),
        }
      }
      return { focus: view?.focus.id, incoming: side("incoming"), outgoing: side("outgoing") }
    },
  }
}
