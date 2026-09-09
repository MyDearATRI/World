import { createRenderer, type CameraState } from "./renderer"
import { createField, type FieldSnapshot } from "../../../util/topos/field"
import { deriveContext } from "../../../util/topos/context"
import { computeAnnotations, type AnnotationPlacement } from "../../../util/topos/annotations"
import type { Concept, KnowledgeModel, Lens, Section, ViewState } from "../../../util/topos/types"
import "../../styles/topos.css"

type Saved = { view: ViewState; field: FieldSnapshot; camera: CameraState }
const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector<T>(selector)!
const world = $("#topos-world"),
  canvas = $<HTMLCanvasElement>("#topos-canvas")
const labels = $("#topos-labels"),
  explanations = $("#topos-explanations"),
  communityLabels = $("#topos-communities"),
  relationLabels = $("#topos-relations")
const status = $(".topos-status"),
  guide = $(".topos-guide")
const depth = $<HTMLInputElement>(".topos-depth input"),
  output = $(".topos-depth output")
const reduce = matchMedia("(prefers-reduced-motion: reduce)")
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text) node.textContent = text
  return node
}

async function start() {
  const response = await fetch(new URL("./index.json", import.meta.url))
  if (!response.ok) throw new Error("概念数据暂时不可用，请重新载入。")
  const { model, sections: rendered } = (await response.json()) as {
    model: KnowledgeModel
    sections: Record<string, string>
  }
  const concepts = new Map(model.concepts.map((c) => [c.id, c])),
    sections = new Map(model.sections.map((s) => [s.id, s]))
  const fromHash = () => {
    const hash = new URLSearchParams(location.hash.slice(1))
    const focus = hash.get("focus") ?? model.initial
    const lens = hash.get("lens") ?? "structural"
    const unfolded = (hash.get("open") ?? "")
      .split(",")
      .filter((id) => sections.has(id))
      .map((id) => ({ concept: sections.get(id)!.concept, section: id }))
    return {
      version: 1,
      focus: concepts.has(focus) ? focus : model.initial,
      lens: ["structural", "action", "linear"].includes(lens) ? lens : "structural",
      scale: clamp(Number(hash.get("depth") ?? 1), 0, 3),
      trail: [],
      unfolded,
    } as ViewState
  }
  let state: ViewState = fromHash(),
    context = deriveContext(model, state)
  const field = createField(model, context),
    renderer = createRenderer(canvas, model)
  const key = `topos:${location.pathname}:v1`
  let saved: Saved | undefined = history.state?.topos
  if (!saved && !location.hash)
    try {
      saved = JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined
    } catch {
      /* Invalid old browser state does not block the field. */
    }
  if (saved && concepts.has(saved.view?.focus)) {
    state = saved.view
    context = deriveContext(model, state)
    field.setContext(context)
    field.restore(saved.field)
    Object.assign(renderer.view, saved.camera)
  } else field.settle()
  const labelNodes = new Map<string, HTMLAnchorElement>(),
    unfoldings = new Map<string, HTMLElement>(),
    communityNodes = new Map<string, HTMLElement>()
  const edgeLabels = new Map<string, HTMLButtonElement>()
  let frame = 0,
    raf = 0,
    last = 0,
    idle = false,
    pointer = { x: 0, y: 0 },
    requested = 1
  let targetZoom = 1,
    pan = { x: renderer.view.x, y: renderer.view.y },
    currentCenter = 0.47
  let labelsHidden = false,
    drag:
      | {
          pointer: number
          id?: string
          x: number
          y: number
          startX: number
          startY: number
          distance: number
        }
      | undefined
  const touches = new Map<number, { x: number; y: number }>()
  let pinch: { distance: number; scale: number; x: number; y: number } | undefined
  let suppressedClick = 0
  let transitionTime = 0
  let annotationTime = -Infinity
  const annotationTargets = new Map<string, AnnotationPlacement>(),
    annotationPositions = new Map<string, { x: number; y: number }>()
  const leaderLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  leaderLayer.classList.add("topos-annotation-leaders")
  world.insertBefore(leaderLayer, labels)
  const leaders = new Map<string, SVGLineElement>()
  const stats = {
    focusChanges: 0,
    unfolds: 0,
    scaleChanges: 0,
    lensChanges: 0,
    rendererInstances: 1,
  }
  let historyTimer: ReturnType<typeof setTimeout> | undefined

  const snapshot = () => ({
    time: performance.now(),
    frame,
    focus: state.focus,
    lens: state.lens,
    scale: state.scale,
    unfoldedIDs: state.unfolded.map((u) => u.section),
    trail: [...state.trail],
    settled: idle,
    renderer: renderer.backend,
    camera: { ...renderer.view },
    nodes: field.nodes.map((n) => ({
      ...n,
      ...renderer.appearance(n, context),
      screenX: renderer.project(n).x,
      screenY: renderer.project(n).y,
    })),
    relations: context.relations.map((r) => ({
      id: r.id,
      source: r.source,
      target: r.target,
      type: r.type,
    })),
    communities: context.communities.map((c) => ({
      ...c,
      strength: c.coherence,
      visual: renderer.communityVisuals.find((v) => v.id === c.id),
    })),
    stats: { ...stats },
  })
  const serialize = (): Saved => ({
    view: structuredClone(state),
    field: field.snapshot(),
    camera: { ...renderer.view },
  })
  function hash() {
    const params = new URLSearchParams({
      focus: state.focus,
      lens: state.lens,
      depth: state.scale.toFixed(2),
    })
    if (state.unfolded.length) params.set("open", state.unfolded.map((u) => u.section).join(","))
    return `#${params}`
  }
  function remember() {
    const s = serialize()
    history.replaceState({ ...history.state, topos: s }, "", hash())
    try {
      sessionStorage.setItem(key, JSON.stringify(s))
    } catch {
      /* Persistence is optional. */
    }
  }
  function laterRemember() {
    clearTimeout(historyTimer)
    historyTimer = setTimeout(remember, 250)
  }
  function wake() {
    idle = false
    requested = Math.max(requested, 2)
    if (!raf) raf = requestAnimationFrame(tick)
  }
  function commit(next: ViewState, push = true) {
    remember()
    state = next
    context = deriveContext(model, state)
    field.setContext(context)
    if (push) history.pushState({ topos: serialize() }, "", hash())
    update()
    wake()
  }
  function focus(id: string) {
    if (!concepts.has(id)) return
    if (id === state.focus) {
      zoom(Math.min(3, state.scale + 0.65))
      return
    }
    stats.focusChanges++
    transitionTime = performance.now()
    commit(
      {
        ...state,
        focus: id,
        trail: [...state.trail.filter((x) => x !== id), state.focus].slice(-8),
      },
      true,
    )
    document.title = `${concepts.get(id)!.title} · Knowledge Topos`
    guide.textContent = `${concepts.get(id)!.zh}成为当前语境。观察邻域变化，或向内展开解释。`
  }
  function zoom(value: number, push = false) {
    const scale = clamp(value, 0, 3)
    if (Math.abs(scale - state.scale) < 0.005) return
    stats.scaleChanges++
    const next = { ...state, scale }
    if (push) commit(next, true)
    else {
      state = next
      context = deriveContext(model, state)
      field.setContext(context)
      update()
      wake()
      laterRemember()
    }
  }
  function setLens(lens: Lens) {
    if (lens === state.lens) return
    stats.lensChanges++
    commit({ ...state, lens }, true)
  }
  function unfold(id: string, parent?: string) {
    const s = sections.get(id)
    if (!s) return
    if (state.unfolded.some((u) => u.section === id)) return
    stats.unfolds++
    commit(
      {
        ...state,
        scale: Math.max(2.05, state.scale),
        unfolded: [...state.unfolded, { concept: s.concept, section: id, parent }],
      },
      true,
    )
  }
  const preferredSection = (concept: Concept, level: number) =>
    concept.sections.map((id) => sections.get(id)!).find((s) => s?.level === level) ??
    concept.sections.map((id) => sections.get(id)!).find(Boolean)
  for (const concept of model.concepts) {
    const a = element("a", "topos-concept")
    a.href = `#focus=${concept.id}&depth=1`
    a.dataset.concept = concept.id
    a.setAttribute("aria-label", `${concept.title} · ${concept.zh}`)
    const small = element("span", "concept-zh", concept.zh),
      title = element("span", "concept-title", concept.title),
      summary = element("span", "concept-summary", concept.summary)
    const action = element("span", "concept-unfold", "展开含义 ↘")
    a.append(small, title, summary, action)
    a.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
      e.preventDefault()
      if (performance.now() < suppressedClick) return
      focus(concept.id)
    })
    labels.append(a)
    labelNodes.set(concept.id, a)
  }
  function sectionNode(section: Section, path: Set<string>, placed: Set<string>): HTMLElement {
    placed.add(section.id)
    const root = element("section", "topos-section")
    root.dataset.sectionId = section.id
    const heading = element("h3", undefined, section.title)
    const prose = element("div", "topos-prose")
    prose.innerHTML = rendered[section.id] ?? ""
    for (const link of prose.querySelectorAll<HTMLAnchorElement>("a")) {
      const target = link.getAttribute("href") ?? ""
      if (target.startsWith("concept:") || target.startsWith("#concept=")) {
        const id = target.replace(/^(concept:|#concept=)/, "")
        if (concepts.has(id)) {
          link.dataset.conceptTarget = id
          link.href = `#${new URLSearchParams({ focus: id, lens: state.lens, depth: "2.1" })}`
        }
      } else if (target.startsWith("section:")) {
        const id = target.slice(8),
          child = sections.get(id)
        if (child) {
          link.dataset.sectionTarget = id
          link.href = `#${new URLSearchParams({ focus: child.concept, lens: state.lens, depth: "2.1", open: id })}`
        }
      }
    }
    for (const math of prose.querySelectorAll<HTMLElement>(".katex-display")) {
      math.tabIndex = 0
      math.setAttribute("role", "region")
      math.setAttribute("aria-label", "数学公式，可横向滚动")
    }
    root.append(heading, prose)
    if (path.has(section.id)) return root
    const nextPath = new Set([...path, section.id])
    const children = element("div", "topos-children")
    for (const id of section.children) {
      const child = sections.get(id)
      if (!child || nextPath.has(id)) continue
      const branch = element("div", "topos-branch")
      const childOwner = concepts.get(child.concept)
      const childLabel =
        child.concept !== section.concept
          ? `${childOwner?.zh ?? child.concept} · ${child.title}`
          : child.title
      const button = element("button", "topos-unfold-button", childLabel)
      button.type = "button"
      button.dataset.openSection = id
      const expanded = state.unfolded.some((u) => u.section === id)
      button.setAttribute("aria-expanded", String(expanded))
      button.addEventListener("click", () => unfold(id, section.id))
      branch.append(button)
      if (expanded && !placed.has(child.id)) branch.append(sectionNode(child, nextPath, placed))
      children.append(branch)
    }
    if (children.childElementCount) root.append(children)
    return root
  }
  let contentVersion = ""
  function updateContent() {
    const version = [
      state.focus,
      state.scale >= 1.7,
      state.scale >= 2,
      state.scale >= 2.7,
      ...state.unfolded.map((u) => u.section),
    ].join("/")
    if (version === contentVersion) return
    contentVersion = version
    for (const [id, root] of unfoldings) {
      root.dataset.active = String(id === state.focus)
      root.dataset.memory = String(id === context.previous)
    }
    const concept = concepts.get(state.focus)!
    const formal = preferredSection(concept, 2)
    if (state.scale < 1.7 && !state.unfolded.some((u) => u.concept === concept.id)) {
      return
    }
    let root = unfoldings.get(concept.id)
    if (!root) {
      root = element("section", "topos-unfolding")
      root.dataset.owner = concept.id
      root.setAttribute("aria-label", `${concept.title}的原位解释`)
      root.tabIndex = -1
      unfoldings.set(concept.id, root)
      explanations.append(root)
    }
    const previousScroll = root.scrollTop
    root.dataset.active = "true"
    root.dataset.memory = "false"
    const oldFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.openSection
        : undefined
    root.replaceChildren()
    const header = element("header", "topos-unfolding-header")
    const label = element("span", undefined, "局部展开"),
      close = element("button", undefined, "收拢 ↗")
    close.type = "button"
    close.dataset.fold = "true"
    close.addEventListener("click", () =>
      commit(
        { ...state, scale: 1, unfolded: state.unfolded.filter((u) => u.concept !== concept.id) },
        true,
      ),
    )
    header.append(label, close)
    root.append(header)
    const lead = element("p", "topos-explanation-lead", concept.summary)
    root.append(lead)
    const placed = new Set<string>()
    if (formal && state.scale >= 2) {
      root.append(sectionNode(formal, new Set(), placed))
      const extra = state.unfolded.filter(
        (u) => u.concept === concept.id && !u.parent && u.section !== formal.id,
      )
      for (const u of extra) {
        const s = sections.get(u.section)
        if (s && !placed.has(s.id)) root.append(sectionNode(s, new Set(), placed))
      }
    } else if (formal) {
      const open = element("button", "topos-unfold-button", "展开正式定义")
      open.dataset.openSection = formal.id
      open.type = "button"
      open.addEventListener("click", () => unfold(formal.id))
      root.append(open)
    }
    if (state.scale >= 2.7) {
      const related = element("div", "topos-recursive-options")
      related.append(element("p", undefined, "继续展开相关构造"))
      const targets = context.relations
        .filter((r) => r.source === concept.id || r.target === concept.id)
        .slice(0, 4)
      for (const relation of targets) {
        const other = concepts.get(
          relation.source === concept.id ? relation.target : relation.source,
        )!
        const s = preferredSection(other, 2)
        if (!s) continue
        const button = element("button", "topos-unfold-button", `${relation.label} · ${other.zh}`)
        button.type = "button"
        button.dataset.openSection = s.id
        button.addEventListener("click", () => unfold(s.id, formal?.id))
        related.append(button)
        if (state.unfolded.some((u) => u.section === s.id) && !placed.has(s.id))
          related.append(sectionNode(s, new Set(), placed))
      }
      root.append(related)
    }
    root.scrollTop = previousScroll
    if (oldFocus)
      root
        .querySelector<HTMLElement>(`[data-open-section="${CSS.escape(oldFocus)}"]`)
        ?.focus({ preventScroll: true })
  }
  explanations.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a")
    if (!anchor || e.ctrlKey || e.metaKey || e.shiftKey) return
    if (anchor.dataset.conceptTarget) {
      e.preventDefault()
      focus(anchor.dataset.conceptTarget)
      return
    }
    if (anchor.dataset.sectionTarget) {
      e.preventDefault()
      unfold(
        anchor.dataset.sectionTarget,
        anchor.closest<HTMLElement>("[data-section-id]")?.dataset.sectionId,
      )
      return
    }
    const href = anchor.getAttribute("href") ?? ""
    if (href.startsWith("concept:") || href.startsWith("#concept=")) {
      e.preventDefault()
      focus(href.replace(/^(concept:|#concept=)/, ""))
    }
    if (href.startsWith("section:")) {
      e.preventDefault()
      unfold(href.slice(8))
    }
  })
  function update() {
    world.dataset.focus = state.focus
    world.dataset.lens = state.lens
    world.dataset.depth = String(Math.floor(state.scale))
    world.dataset.summary = String(state.scale >= 1.35 && state.scale < 1.7)
    world.dataset.explaining = String(state.scale >= 1.7)
    depth.value = String(state.scale)
    output.textContent =
      state.scale < 0.75
        ? "结构与聚合"
        : state.scale < 1.7
          ? "概念与关系"
          : state.scale < 2.7
            ? "定义与公式"
            : "递归展开"
    targetZoom = innerWidth < 600 ? 0.45 + state.scale * 0.065 : 0.79 + state.scale * 0.09
    for (const b of document.querySelectorAll<HTMLElement>("[data-lens]"))
      b.setAttribute("aria-pressed", String(b.dataset.lens === state.lens))
    for (const n of field.nodes)
      field.setRadius(n.id, n.id === state.focus ? (state.scale >= 1.7 ? 300 : 130) : 72)
    for (const [id, a] of labelNodes) {
      a.dataset.focus = String(id === state.focus)
      a.dataset.previous = String(id === context.previous)
      a.setAttribute("aria-current", id === state.focus ? "true" : "false")
    }
    updateContent()
    annotationTime = -Infinity
  }
  function drawLabels() {
    let annotationsMoving = false
    const activeUnfold = unfoldings.get(state.focus)
    const showUnfold = state.scale >= 1.7
    const now = performance.now()
    const focusedWidth = Math.min(360, renderer.size.width - 28)
    for (const n of field.nodes) {
      const a = labelNodes.get(n.id)!
      a.style.width = `${n.id === state.focus ? focusedWidth : innerWidth < 600 ? 128 : 185}px`
    }
    if (now - annotationTime > 220) {
      annotationTime = now
      const candidates = field.nodes
        .filter(
          (n) =>
            n.relevance > 0.3 &&
            n.id !== state.focus &&
            (state.scale >= 0.75 || renderer.appearance(n, context).major),
        )
        .sort(
          (a, b) =>
            (b.id === state.focus ? 100 : b.id === context.previous ? 90 : b.relevance) -
            (a.id === state.focus ? 100 : a.id === context.previous ? 90 : a.relevance),
        )
        .slice(0, innerWidth < 600 && showUnfold ? 4 : 12)
      const focused = field.nodes.find((n) => n.id === state.focus)!
      const focusedPoint = renderer.project(focused),
        focusedLabel = labelNodes.get(state.focus)!
      const focusBox = {
        id: state.focus,
        x: clamp(
          focusedPoint.x - focusedLabel.offsetWidth / 2,
          14,
          renderer.size.width - focusedLabel.offsetWidth - 14,
        ),
        y: clamp(
          focusedPoint.y - focusedLabel.offsetHeight - 28,
          98,
          renderer.size.height - focusedLabel.offsetHeight - 160,
        ),
        width: focusedLabel.offsetWidth,
        height: focusedLabel.offsetHeight,
      }
      const excluded: { x: number; y: number; width: number; height: number }[] = [focusBox]
      if (showUnfold) {
        const p = renderer.project(field.nodes.find((n) => n.id === state.focus)!)
        const w = Math.min(innerWidth < 600 ? innerWidth - 28 : 465, renderer.size.width - 32)
        const x = clamp(p.x - w / 2, 14, renderer.size.width - w - 14),
          y = clamp(p.y + 20, 130, renderer.size.height - 180)
        excluded.push({ x, y, width: w, height: Math.max(120, renderer.size.height - y - 96) })
      }
      const placed = computeAnnotations(
        candidates.map((n) => {
          const p = renderer.project(n),
            a = labelNodes.get(n.id)!
          return {
            id: n.id,
            anchorX: p.x,
            anchorY: p.y,
            width: a.offsetWidth,
            height: a.offsetHeight,
            priority:
              n.id === state.focus ? 100 : n.id === context.previous ? 90 : n.relevance * 10,
          }
        }),
        {
          left: 14,
          top: 100,
          right: renderer.size.width - 14,
          bottom: renderer.size.height - (innerWidth < 600 ? 167 : 110),
        },
        excluded,
      )
      annotationTargets.clear()
      annotationTargets.set(state.focus, focusBox)
      for (const box of placed) annotationTargets.set(box.id, box)
    }
    for (const n of field.nodes) {
      const a = labelNodes.get(n.id)!,
        p = renderer.project(n)
      const isFocus = n.id === state.focus
      const size = isFocus ? 1 : clamp(0.73 + n.relevance * 0.32, 0.72, 1)
      const labelWidth = isFocus ? focusedWidth : innerWidth < 600 ? 128 : 185
      let x = clamp(p.x + 18, 8, renderer.size.width - labelWidth - 8)
      let y = p.y - (isFocus ? 40 : 13)
      if (isFocus && showUnfold) y = p.y - 78
      const box = annotationTargets.get(n.id)
      if (box) {
        const previous = annotationPositions.get(n.id) ?? { x: box.x, y: box.y }
        previous.x += (box.x - previous.x) * (reduce.matches ? 1 : 0.18)
        previous.y += (box.y - previous.y) * (reduce.matches ? 1 : 0.18)
        annotationsMoving ||= Math.abs(previous.x - box.x) + Math.abs(previous.y - box.y) > 0.2
        annotationPositions.set(n.id, previous)
        x = previous.x
        y = previous.y
      }
      a.style.transform = `translate(${x}px,${y}px) scale(${box ? 1 : size})`
      a.style.width = `${labelWidth}px`
      const appearance = renderer.appearance(n, context)
      const farVisibility = appearance.major ? 1 : clamp((state.scale - 0.45) / 0.65, 0, 1)
      a.style.opacity = String(
        labelsHidden
          ? 0
          : farVisibility *
              (box
                ? clamp(0.45 + n.relevance * 0.65, 0, 1)
                : n.relevance * (showUnfold ? 0.08 : 0.5)),
      )
      a.style.filter = n.relevance < 0.28 ? `blur(${(0.28 - n.relevance) * 3}px)` : "none"
      a.style.zIndex = isFocus ? "8" : String(Math.floor(n.relevance * 5))
      a.tabIndex = box && !labelsHidden ? 0 : -1
      a.style.pointerEvents = box && !labelsHidden ? "auto" : "none"
      a.dataset.relevance = n.relevance.toFixed(3)
      let leader = leaders.get(n.id)
      if (!leader) {
        leader = document.createElementNS("http://www.w3.org/2000/svg", "line")
        leaders.set(n.id, leader)
        leaderLayer.append(leader)
      }
      leader.setAttribute("x1", String(p.x))
      leader.setAttribute("y1", String(p.y))
      leader.setAttribute("x2", String(clamp(p.x, x, x + labelWidth)))
      leader.setAttribute("y2", String(clamp(p.y, y, y + a.offsetHeight)))
      leader.style.opacity = labelsHidden || !box ? "0" : String(n.relevance * 0.28 * farVisibility)
      const root = unfoldings.get(n.id)
      if (root) {
        const active = isFocus && showUnfold,
          memory = n.id === context.previous && showUnfold
        root.style.opacity = active ? "1" : memory ? String(n.relevance * 0.3) : "0"
        root.style.pointerEvents = active ? "auto" : "none"
        root.inert = !active
        const maxWidth = Math.min(
          innerWidth < 600 ? innerWidth - 28 : 465,
          renderer.size.width - 32,
        )
        const left = active
          ? clamp(p.x - maxWidth / 2, 14, renderer.size.width - maxWidth - 14)
          : clamp(p.x + 20, 14, renderer.size.width - 236)
        const top = active ? clamp(p.y + 20, 130, renderer.size.height - 180) : p.y + 18
        root.style.transform = `translate(${left}px,${top}px) scale(${active ? 1 : 0.72})`
        root.style.width = `${active ? maxWidth : 230}px`
        root.style.maxHeight = active
          ? `${Math.max(120, renderer.size.height - top - 96)}px`
          : "100px"
      }
    }
    if (activeUnfold && !showUnfold) {
      activeUnfold.style.opacity = "0"
      activeUnfold.inert = true
    }
    const showCommunities = new Set(context.communities.map((c) => c.id))
    for (const [id, node] of communityNodes) if (!showCommunities.has(id)) node.style.opacity = "0"
    const communityItems = []
    for (const c of context.communities) {
      const visual = renderer.communityVisuals.find((v) => v.id === c.id)
      if (!visual) continue
      let label = communityNodes.get(c.id)
      if (!label) {
        label = element("div", "topos-community")
        label.dataset.community = c.id
        communityNodes.set(c.id, label)
        communityLabels.append(label)
      }
      label.textContent = c.label
      communityItems.push({
        id: c.id,
        anchorX: visual.x,
        anchorY: visual.y - visual.ry - 24,
        width: label.offsetWidth || 210,
        height: label.offsetHeight || 36,
        priority: visual.opacity,
      })
      label.style.opacity = String(
        labelsHidden || state.scale >= 0.9 ? 0 : clamp(visual.opacity * 3, 0, 0.95),
      )
      label.dataset.coherence = String(c.coherence)
    }
    const communityBoxes = computeAnnotations(
      communityItems,
      {
        left: 14,
        top: 100,
        right: innerWidth - 14,
        bottom: innerHeight - (innerWidth < 600 ? 167 : 110),
      },
      [...annotationTargets.values()],
    )
    for (const box of communityBoxes) {
      const previous = annotationPositions.get(box.id) ?? { x: box.x, y: box.y }
      previous.x += (box.x - previous.x) * (reduce.matches ? 1 : 0.12)
      previous.y += (box.y - previous.y) * (reduce.matches ? 1 : 0.12)
      annotationsMoving ||= Math.abs(previous.x - box.x) + Math.abs(previous.y - box.y) > 0.2
      annotationPositions.set(box.id, previous)
      communityNodes.get(box.id)!.style.transform = `translate(${previous.x}px,${previous.y}px)`
    }
    const direct = context.relations
      .filter((r) => r.source === state.focus || r.target === state.focus)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, state.scale < 0.7 || state.scale > 1.7 ? 0 : innerWidth < 600 ? 2 : 4)
    const directIds = new Set(direct.map((r) => r.id))
    for (const [id, label] of edgeLabels)
      if (!directIds.has(id)) {
        label.style.opacity = "0"
        label.inert = true
      }
    for (const r of direct) {
      let label = edgeLabels.get(r.id)
      if (!label) {
        label = element("button", "topos-relation", r.label)
        label.type = "button"
        label.dataset.relation = r.id
        label.title = `${r.type} · ${r.explanation}`
        label.addEventListener("click", () => showRelation(r.id))
        edgeLabels.set(r.id, label)
        relationLabels.append(label)
      }
      const a = renderer.project(field.nodes.find((n) => n.id === r.source)!),
        b = renderer.project(field.nodes.find((n) => n.id === r.target)!)
      const other = r.source === state.focus ? b : a,
        origin = r.source === state.focus ? a : b
      label.style.transform = `translate(${clamp(origin.x * 0.26 + other.x * 0.74, 12, innerWidth - 140)}px,${clamp(origin.y * 0.26 + other.y * 0.74 + 14, 100, innerHeight - 160)}px)`
      const rect = label.getBoundingClientRect()
      const occluded = [...labelNodes.values()]
        .filter((node) => Number(node.style.opacity) > 0.3)
        .map((node) => node.getBoundingClientRect())
        .some(
          (box) =>
            rect.x < box.x + box.width + 9 &&
            rect.x + rect.width > box.x - 9 &&
            rect.y < box.y + box.height + 9 &&
            rect.y + rect.height > box.y - 9,
        )
      // Decide first, then assign once. Reading geometry between two opacity
      // assignments restarts CSS transitions every frame and prevents hiding.
      label.style.opacity = labelsHidden || occluded ? "0" : "0.7"
      label.inert = labelsHidden || occluded
    }
    return annotationsMoving
  }
  const relationPopover = element("aside", "topos-relation-detail")
  relationPopover.hidden = true
  world.append(relationPopover)
  function showRelation(id: string) {
    const r = model.relations.find((e) => e.id === id)
    if (!r) return
    relationPopover.replaceChildren()
    const close = element("button", undefined, "关闭")
    close.type = "button"
    close.addEventListener("click", () => {
      relationPopover.hidden = true
      edgeLabels.get(id)?.focus()
    })
    relationPopover.append(
      close,
      element("small", undefined, r.type),
      element("h2", undefined, `${concepts.get(r.source)!.zh} → ${concepts.get(r.target)!.zh}`),
      element("p", undefined, r.explanation),
    )
    const source = model.sources.find((s) => r.evidence.startsWith(s.id))
    if (source) {
      const a = element("a", undefined, source.title)
      a.href = source.url
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      relationPopover.append(a)
    }
    relationPopover.append(element("p", "topos-evidence", r.evidence))
    relationPopover.hidden = false
    close.focus()
  }
  function tick(now: number) {
    raf = 0
    const dt = last ? Math.min((now - last) / 1000, 0.04) : 1 / 60
    last = now
    if (document.hidden) return
    frame++
    if (reduce.matches) {
      field.settle()
      renderer.view.zoom = targetZoom
      renderer.view.x = pan.x
      renderer.view.y = pan.y
    }
    const moving = field.step(dt)
    const zoomDelta = targetZoom - renderer.view.zoom
    renderer.view.zoom += zoomDelta * Math.min(1, dt * 7)
    renderer.view.x += (pan.x - renderer.view.x) * Math.min(1, dt * 8)
    renderer.view.y += (pan.y - renderer.view.y) * Math.min(1, dt * 8)
    const desiredCenter = state.scale >= 1.7 ? (innerWidth < 600 ? 0.29 : 0.31) : 0.47
    currentCenter += (desiredCenter - currentCenter) * Math.min(1, dt * 4)
    renderer.setCenterY(currentCenter)
    renderer.setParallax(pointer.x, pointer.y)
    const rendering = renderer.draw(field.nodes, context, reduce.matches ? 1 : dt)
    const annotationsMoving = drawLabels()
    requested--
    const cameraMoving =
      Math.abs(zoomDelta) > 0.001 ||
      Math.abs(pan.x - renderer.view.x) > 0.1 ||
      Math.abs(pan.y - renderer.view.y) > 0.1 ||
      Math.abs(desiredCenter - currentCenter) > 0.001
    if (moving || rendering || annotationsMoving || cameraMoving || requested > 0 || drag) {
      raf = requestAnimationFrame(tick)
    } else {
      idle = true
      remember()
    }
    world.dataset.settled = String(idle)
  }
  function hit(x: number, y: number) {
    return field.nodes
      .filter((n) => n.relevance > 0.18)
      .map((n) => ({ n, p: renderer.project(n) }))
      .filter(({ p }) => Math.hypot(p.x - x, p.y - y) < 24)
      .sort((a, b) => b.n.relevance - a.n.relevance)[0]?.n.id
  }
  function down(e: PointerEvent) {
    if (e.button > 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    const target = e.target as HTMLElement
    if (
      target.closest(
        ".topos-instruments,.topos-unfolding,.topos-help,.topos-utility,.topos-relation-detail,.topos-relation",
      )
    )
      return
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.size === 2) {
      if (drag?.id) field.release(drag.id)
      const [a, b] = [...touches.values()]
      pinch = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: state.scale,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      }
      drag = undefined
      return
    }
    const id =
      target.closest<HTMLElement>("[data-concept]")?.dataset.concept ?? hit(e.clientX, e.clientY)
    drag = {
      pointer: e.pointerId,
      id,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      distance: 0,
    }
    canvas.setPointerCapture(e.pointerId)
    wake()
  }
  function move(e: PointerEvent) {
    pointer = { x: (e.clientX / innerWidth - 0.5) * 2, y: (e.clientY / innerHeight - 0.5) * 2 }
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y),
        x = (a.x + b.x) / 2,
        y = (a.y + b.y) / 2
      zoom(pinch.scale + Math.log2(Math.max(1, distance) / Math.max(1, pinch.distance)) * 1.5)
      pan.x += (x - pinch.x) / renderer.view.zoom
      pan.y += (y - pinch.y) / renderer.view.zoom
      pinch.x = x
      pinch.y = y
      e.preventDefault()
      wake()
      return
    }
    if (!drag) {
      if (e.target === canvas && !reduce.matches) {
        requested = 3
        wake()
      }
      return
    }
    drag.distance = Math.max(
      drag.distance,
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY),
    )
    if (drag.distance > 5) {
      if (drag.id) {
        const p = renderer.unproject(e.clientX, e.clientY)
        field.drag(drag.id, p.x, p.y)
      } else {
        pan.x += (e.clientX - drag.x) / renderer.view.zoom
        pan.y += (e.clientY - drag.y) / renderer.view.zoom
      }
      drag.x = e.clientX
      drag.y = e.clientY
      e.preventDefault()
      wake()
    }
  }
  function up(e: PointerEvent) {
    touches.delete(e.pointerId)
    if (touches.size < 2) pinch = undefined
    if (!drag || drag.pointer !== e.pointerId) return
    if (drag.id) {
      field.release(drag.id)
      if (drag.distance <= 5) {
        suppressedClick = performance.now() + 250
        focus(drag.id)
      } else suppressedClick = performance.now() + 350
    }
    drag = undefined
    wake()
    laterRemember()
  }
  world.addEventListener("pointerdown", down)
  world.addEventListener("pointermove", move)
  world.addEventListener("pointerup", up)
  world.addEventListener("pointercancel", (e) => {
    if (drag?.id) field.release(drag.id)
    drag = undefined
    touches.delete(e.pointerId)
    pinch = undefined
    wake()
  })
  world.addEventListener(
    "wheel",
    (e) => {
      if ((e.target as HTMLElement).closest(".topos-unfolding,.topos-help,.topos-relation-detail"))
        return
      e.preventDefault()
      zoom(state.scale - e.deltaY * 0.003)
    },
    { passive: false },
  )
  document
    .querySelectorAll<HTMLElement>("[data-lens]")
    .forEach((b) => b.addEventListener("click", () => setLens(b.dataset.lens as Lens)))
  document
    .querySelectorAll<HTMLElement>("[data-zoom]")
    .forEach((b) =>
      b.addEventListener("click", () =>
        zoom(state.scale + (b.dataset.zoom === "in" ? 0.65 : -0.65), true),
      ),
    )
  depth.addEventListener("input", () => zoom(Number(depth.value)))
  $("[data-back]").addEventListener("click", () => {
    if (state.trail.length) history.back()
    else {
      pan = { x: 0, y: 0 }
      zoom(1)
      wake()
    }
  })
  const help = $<HTMLDialogElement>(".topos-help")
  $("[data-help]").addEventListener("click", () => help.showModal())
  $("[data-close-help]").addEventListener("click", () => help.close())
  $("[data-labels-toggle]").addEventListener("click", () => {
    labelsHidden = !labelsHidden
    world.classList.toggle("topos-no-labels", labelsHidden)
    help.close()
    wake()
  })
  document.addEventListener("keydown", (e) => {
    if ((e.target as HTMLElement).matches("input,textarea") || help.open) return
    if (e.key === "Escape") {
      if (!relationPopover.hidden) {
        relationPopover.hidden = true
        return
      }
      if (state.scale >= 1.7) {
        zoom(1, true)
        return
      }
      if (state.trail.length) history.back()
    }
    if (e.key === "+" || e.key === "=") {
      e.preventDefault()
      zoom(state.scale + 0.65, true)
    }
    if (e.key === "-") {
      e.preventDefault()
      zoom(state.scale - 0.65, true)
    }
    if (e.target === canvas && e.key.startsWith("Arrow")) {
      e.preventDefault()
      pan.x += e.key === "ArrowLeft" ? 35 : e.key === "ArrowRight" ? -35 : 0
      pan.y += e.key === "ArrowUp" ? 35 : e.key === "ArrowDown" ? -35 : 0
      wake()
    }
    if (e.key.toLowerCase() === "l" && e.altKey) {
      labelsHidden = !labelsHidden
      world.classList.toggle("topos-no-labels", labelsHidden)
      wake()
    }
  })
  window.addEventListener("popstate", (e) => {
    const s = e.state?.topos as Saved | undefined
    if (s && concepts.has(s.view.focus)) {
      state = s.view
      context = deriveContext(model, state)
      field.setContext(context)
      field.restore(s.field)
      pan = { x: s.camera.x, y: s.camera.y }
      Object.assign(renderer.view, s.camera)
    } else {
      state = fromHash()
      context = deriveContext(model, state)
      field.setContext(context)
    }
    contentVersion = ""
    update()
    wake()
    labelNodes.get(state.focus)?.focus({ preventScroll: true })
  })
  window.addEventListener("pagehide", remember)
  document.addEventListener("visibilitychange", () => {
    last = 0
    if (!document.hidden) wake()
    else {
      if (raf) cancelAnimationFrame(raf)
      raf = 0
      remember()
    }
  })
  window.addEventListener("resize", () => {
    renderer.resize()
    update()
    wake()
  })
  reduce.addEventListener("change", wake)
  // Re-measure real text bounds when fonts or the title-size transition finish.
  document.fonts.ready.then(() => {
    annotationTime = -Infinity
    wake()
  })
  labels.addEventListener("transitionend", (event) => {
    if ((event as TransitionEvent).propertyName === "font-size") {
      annotationTime = -Infinity
      wake()
    }
  })
  canvas.addEventListener("topos-context-lost", () => {
    status.hidden = false
    status.textContent = "图形上下文中断；概念与原位解释仍可操作。重新载入可恢复绘图。"
    world.dataset.renderer = "context-lost"
  })
  Object.defineProperty(window, "__topos", {
    value: {
      get state() {
        return state
      },
      get context() {
        return context
      },
      get nodes() {
        return field.nodes
      },
      get frame() {
        return frame
      },
      get settled() {
        return idle
      },
      get renderer() {
        return renderer.backend
      },
      snapshot,
      focus,
      zoom,
      setLens,
      unfold,
      get transitionTime() {
        return transitionTime
      },
    },
    configurable: true,
  })
  world.dataset.ready = "true"
  world.dataset.renderer = renderer.backend
  status.hidden = true
  update()
  remember()
  wake()
}
void start().catch((error) => {
  status.hidden = false
  status.textContent = error instanceof Error ? error.message : String(error)
  console.error(error)
})
