import { createRenderer, type CameraState } from "./renderer"
import { createField, type FieldSnapshot } from "../../../util/topos/field"
import { deriveContext } from "../../../util/topos/context"
import { computeAnnotations, type AnnotationPlacement } from "../../../util/topos/annotations"
import type { Concept, KnowledgeModel, Lens, Section, ViewState } from "../../../util/topos/types"
import "../../styles/topos.css"

type Saved = {
  view: ViewState
  field: FieldSnapshot
  camera: CameraState
  readingScroll?: Record<string, number>
  modelSignature?: string
}
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
const decodeAnchor = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
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
  const response = await fetch(
    document.body.dataset.toposIndex
      ? new URL(document.body.dataset.toposIndex, location.href)
      : new URL(
          location.pathname.endsWith("topos-demo.html") ? "./demo.json" : "./index.json",
          import.meta.url,
        ),
  )
  if (!response.ok) throw new Error("概念数据暂时不可用，请重新载入。")
  const {
    model,
    sections: rendered,
    sectionFiles = {},
  } = (await response.json()) as {
    model: KnowledgeModel
    sections: Record<string, string>
    sectionFiles?: Record<string, string>
  }
  const concepts = new Map(model.concepts.map((c) => [c.id, c])),
    sections = new Map(model.sections.map((s) => [s.id, s]))
  const published = model.mode === "published"
  world.dataset.mode = published ? "published" : "demo"
  const siteRoot = new URL("./", location.href)
  const sourceURL = (href: string) => new URL(href, siteRoot).href
  const pendingSections = new Map<string, Promise<void>>()
  const sectionErrors = new Map<string, string>()
  const modelSignature = (() => {
    let value = 2166136261
    const source = JSON.stringify([
      model.snapshotHash,
      model.concepts.map((c) => c.id),
      model.relations,
    ])
    for (let i = 0; i < source.length; i++)
      value = Math.imul(value ^ source.charCodeAt(i), 16777619)
    return (value >>> 0).toString(36)
  })()
  const typeNames: Record<string, string> = {
    note: "完整笔记",
    definition: "定义",
    "definition-group": "定义组",
    theorem: "定理",
    lemma: "引理",
    proposition: "命题",
    proof: "证明",
    "proof-strategy": "证明策略",
    example: "例子",
    observation: "观察",
    question: "问题",
    concept: "概念",
  }
  const typeLabel = (c: Concept) =>
    c.objectKind === "note" ? "完整笔记" : (typeNames[c.mathType ?? c.kind] ?? c.mathType ?? c.kind)
  const relationCategory = (r: KnowledgeModel["relations"][number]) =>
    r.provenance === "authored"
      ? "原文论证"
      : r.provenance === "reference"
        ? "正文引用"
        : r.provenance === "structure"
          ? "出处关联"
          : "原文关系"
  if (model.lenses) {
    const lenses = $(".topos-lenses")
    lenses.replaceChildren(element("span", undefined, "联系"))
    for (const lens of model.lenses) {
      const button = element("button", undefined, lens.label)
      button.type = "button"
      button.dataset.lens = lens.id
      if (lens.description) button.title = lens.description
      lenses.append(button)
    }
  }
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
      scale: Number.isFinite(Number(hash.get("depth") ?? 1))
        ? clamp(Number(hash.get("depth") ?? 1), 0, 3)
        : 1,
      trail: [],
      unfolded,
    } as ViewState
  }
  let state: ViewState = fromHash(),
    context = deriveContext(model, state)
  const field = createField(model, context),
    renderer = createRenderer(canvas, model)
  function restoreSaved(value: Saved) {
    const view = value.view
    state = {
      version: 1,
      focus: concepts.has(view?.focus) ? view.focus : model.initial,
      lens: ["structural", "action", "linear"].includes(view?.lens) ? view.lens : "structural",
      scale: Number.isFinite(view?.scale) ? clamp(view.scale, 0, 3) : 1,
      trail: Array.isArray(view?.trail) ? view.trail.filter((id) => concepts.has(id)) : [],
      unfolded: Array.isArray(view?.unfolded)
        ? view.unfolded
            .filter((u) => sections.has(u.section))
            .map((u) => ({
              concept: sections.get(u.section)!.concept,
              section: u.section,
              parent: u.parent && sections.has(u.parent) ? u.parent : undefined,
            }))
        : [],
    }
    context = deriveContext(model, state)
    field.setContext(context)
    const compatible =
      value.modelSignature === modelSignature &&
      Array.isArray(value.field?.nodes) &&
      value.field.nodes.length === concepts.size &&
      new Set(value.field.nodes.map((n) => n.id)).size === concepts.size &&
      value.field.nodes.every((node) => concepts.has(node.id))
    try {
      if (!compatible) throw new Error("The published model changed")
      field.restore(value.field)
    } catch {
      // Old content and coordinates are optional history, never a startup dependency.
      field.settle()
    }
    if (
      compatible &&
      value.camera &&
      [value.camera.x, value.camera.y, value.camera.zoom].every(Number.isFinite) &&
      value.camera.zoom > 0
    )
      Object.assign(renderer.view, value.camera)
    else Object.assign(renderer.view, { x: 0, y: 0, zoom: 1 })
  }
  const key = `topos:${location.pathname}:v1`
  let saved: Saved | undefined = history.state?.topos
  if (!saved && !location.hash)
    try {
      saved = JSON.parse(sessionStorage.getItem(key) ?? "null") ?? undefined
    } catch {
      /* Invalid old browser state does not block the field. */
    }
  if (saved && concepts.has(saved.view?.focus)) {
    restoreSaved(saved)
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
  const readingScroll = new Map<string, number>(Object.entries(saved?.readingScroll ?? {}))
  const restoringScroll = new Set<string>()
  let pendingAnchor: { concept: string; anchor: string } | undefined

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
    mode: model.mode ?? "demo",
    objectCount: model.concepts.length,
    modelStats: model.stats,
    camera: { ...renderer.view },
    modelSignature,
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
      provenance: r.provenance,
      evidenceHref: r.evidenceHref,
    })),
    communities: context.communities.map((c) => ({
      ...c,
      strength: c.coherence,
      visual: renderer.communityVisuals.find((v) => v.id === c.id),
    })),
    stats: { ...stats },
  })
  const serialize = (): Saved => {
    const reading = unfoldings.get(state.focus)
    if (
      reading &&
      reading.dataset.active === "true" &&
      !restoringScroll.has(state.focus) &&
      reading.querySelector(".topos-section .topos-prose")
    )
      readingScroll.set(state.focus, reading.scrollTop)
    return {
      view: structuredClone(state),
      field: field.snapshot(),
      camera: { ...renderer.view },
      modelSignature,
      readingScroll: Object.fromEntries(readingScroll),
    }
  }
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
  function focus(id: string, anchor?: string) {
    if (!concepts.has(id)) return
    pendingAnchor = anchor
      ? { concept: id, anchor: decodeAnchor(anchor.replace(/^#/, "")) }
      : undefined
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
    guide.textContent = published
      ? `${typeLabel(concepts.get(id)!)} · 点击当前对象展开原文，或查找另一个知识点。`
      : `${concepts.get(id)!.zh}成为当前语境。观察邻域变化，或向内展开解释。`
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
  function fold(id: string) {
    const descendants = new Set([id])
    let added = true
    while (added) {
      added = false
      for (const u of state.unfolded)
        if (u.parent && descendants.has(u.parent) && !descendants.has(u.section)) {
          descendants.add(u.section)
          added = true
        }
    }
    commit({ ...state, unfolded: state.unfolded.filter((u) => !descendants.has(u.section)) }, true)
  }
  const preferredSection = (concept: Concept, level: number) =>
    concept.sections.map((id) => sections.get(id)!).find((s) => s?.level === level) ??
    concept.sections.map((id) => sections.get(id)!).find(Boolean)
  for (const concept of model.concepts) {
    const a = element("a", "topos-concept")
    a.href = published && concept.href ? sourceURL(concept.href) : `#focus=${concept.id}&depth=1`
    a.dataset.concept = concept.id
    a.setAttribute("aria-label", `${concept.title} · ${concept.zh}`)
    const small = element("span", "concept-zh", published ? typeLabel(concept) : concept.zh),
      title = element("span", "concept-title", concept.title),
      summary = element("span", "concept-summary", concept.summary)
    const action = element("span", "concept-unfold", published ? "展开原文 ↘" : "展开含义 ↘")
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
  const search = element("dialog", "topos-search")
  search.setAttribute("aria-label", "查找公开笔记与知识点")
  const searchHeader = element("header"),
    searchTitle = element("h2", undefined, "查找知识点"),
    searchClose = element("button", undefined, "关闭"),
    searchInput = element("input"),
    searchResults = element("div", "topos-search-results"),
    searchStatus = element("p", "topos-search-status"),
    searchFilter = element("select"),
    searchTrigger = element("button", "topos-search-trigger", "查找知识点")
  searchInput.type = "search"
  searchInput.placeholder = "名称、别名、正文或 LaTeX"
  searchInput.setAttribute("aria-label", "搜索公开数学内容")
  searchInput.autocomplete = "off"
  searchInput.dataset.toposSearchInput = "true"
  searchFilter.setAttribute("aria-label", "搜索对象类型")
  for (const [value, label] of [
    ["all", "全部对象"],
    ["atom", "知识点"],
    ["note", "完整笔记"],
  ]) {
    const option = element("option", undefined, label)
    option.value = value
    searchFilter.append(option)
  }
  searchClose.type = searchTrigger.type = "button"
  searchTrigger.dataset.toposSearch = "true"
  searchTrigger.setAttribute("aria-keyshortcuts", "Control+K Meta+K")
  searchHeader.append(searchTitle, searchClose)
  const searchControls = element("div", "topos-search-controls")
  searchControls.append(searchInput, searchFilter)
  searchStatus.setAttribute("role", "status")
  search.append(searchHeader, searchControls, searchStatus, searchResults)
  world.append(search)
  if (published) $(".topos-utility").prepend(searchTrigger)
  const normalize = (value: string) =>
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\\(?:left|right|mathrm|mathbf|operatorname)/g, "")
      .replace(
        /\\(?:alpha|beta|gamma|delta|epsilon|lambda|mu|sigma|phi|omega|infty|forall|exists)/g,
        (v) =>
          ({
            "\\alpha": "α",
            "\\beta": "β",
            "\\gamma": "γ",
            "\\delta": "δ",
            "\\epsilon": "ε",
            "\\lambda": "λ",
            "\\mu": "μ",
            "\\sigma": "σ",
            "\\phi": "φ",
            "\\omega": "ω",
            "\\infty": "∞",
            "\\forall": "∀",
            "\\exists": "∃",
          })[v] ?? v,
      )
      .replace(/[{}$]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  const searchIndex = model.concepts.map((concept) => ({
    concept,
    title: normalize(concept.title),
    aliases: normalize([concept.zh, ...(concept.aliases ?? []), ...concept.terms].join(" ")),
    body: normalize(concept.searchText ?? concept.summary),
  }))
  function renderSearch() {
    const query = normalize(searchInput.value),
      terms = query.split(" ").filter(Boolean)
    const matches = searchIndex
      .filter(
        ({ concept }) => searchFilter.value === "all" || concept.objectKind === searchFilter.value,
      )
      .map((entry) => ({
        ...entry,
        score: terms.length
          ? terms.reduce(
              (score, term) =>
                score +
                (entry.title.includes(term) ? 12 : 0) +
                (entry.aliases.includes(term) ? 7 : 0) +
                (entry.body.includes(term) ? 1 : 0),
              0,
            )
          : 1,
      }))
      .filter(
        (entry) =>
          entry.score > 0 &&
          terms.every(
            (term) =>
              entry.title.includes(term) ||
              entry.aliases.includes(term) ||
              entry.body.includes(term),
          ),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          model.concepts.indexOf(a.concept) - model.concepts.indexOf(b.concept),
      )
    searchResults.replaceChildren()
    searchStatus.textContent = `${matches.length} 个结果 · 本地检索 ${model.concepts.length} 个公开对象`
    if (!matches.length)
      searchResults.append(
        element("p", "topos-empty", "没有匹配内容。可试试英文术语、别名或公式中的符号。"),
      )
    for (const { concept, title, aliases, body } of matches.slice(0, 60)) {
      const link = element("a", "topos-search-result")
      link.href = concept.href ? sourceURL(concept.href) : `#focus=${concept.id}&depth=2.1`
      link.dataset.searchConcept = concept.id
      const summary = concept.summary.trim(),
        match = terms.length ? Math.max(0, body.indexOf(terms[0])) : 0,
        summaryStart = body.indexOf(normalize(summary)),
        namesMatch = terms.some((term) => title.includes(term) || aliases.includes(term)),
        original = (concept.searchText ?? concept.summary).replace(/\s+/g, " ").trim(),
        originalStart = original.indexOf(summary),
        originalMatch = terms.length ? original.toLowerCase().indexOf(terms[0]) : -1
      // The search index includes aliases and source metadata. Show the actual
      // introductory prose for name matches, and preserve source casing in body excerpts.
      const snippet =
        !terms.length ||
        namesMatch ||
        match < summaryStart ||
        originalMatch < Math.max(0, originalStart)
          ? summary
          : original.slice(Math.max(originalStart, originalMatch - 45, 0), originalMatch + 125)
      link.append(
        element("small", undefined, typeLabel(concept)),
        element("strong", undefined, concept.title),
        element("span", "topos-search-source", concept.sourceTitle ?? ""),
        element("p", undefined, snippet),
      )
      link.addEventListener("click", (e) => {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
        e.preventDefault()
        search.close()
        focus(concept.id)
        zoom(2.1)
        requestAnimationFrame(() => unfoldings.get(concept.id)?.focus({ preventScroll: true }))
      })
      searchResults.append(link)
    }
    if (matches.length > 60)
      searchResults.append(element("p", "topos-empty", "显示前60项，输入名称可缩小范围。"))
  }
  let searchReturn: HTMLElement | null = null
  function openSearch() {
    searchReturn =
      document.activeElement instanceof HTMLElement ? document.activeElement : searchTrigger
    renderSearch()
    search.showModal()
    searchInput.focus()
  }
  searchTrigger.addEventListener("click", openSearch)
  searchClose.addEventListener("click", () => search.close())
  search.addEventListener("close", () => searchReturn?.focus({ preventScroll: true }))
  searchInput.addEventListener("input", renderSearch)
  searchFilter.addEventListener("change", renderSearch)
  searchInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      searchResults.querySelector<HTMLAnchorElement>("a")?.focus()
    }
    if (event.key === "Enter") {
      event.preventDefault()
      searchResults.querySelector<HTMLAnchorElement>("a")?.click()
    }
  })
  function sectionNode(section: Section, path: Set<string>, placed: Set<string>): HTMLElement {
    placed.add(section.id)
    const root = element("section", "topos-section")
    root.dataset.sectionId = section.id
    const heading = element("h3", undefined, section.title)
    const prose = element("div", "topos-prose")
    if (!(section.id in rendered)) {
      root.append(heading)
      const message = element(
        "p",
        "topos-section-loading",
        sectionErrors.get(section.id) ?? "正在读取这段公开原文…",
      )
      message.setAttribute("role", "status")
      message.dataset.sectionLoading = section.id
      root.append(message)
      if (sectionErrors.has(section.id)) {
        const retry = element("button", "topos-unfold-button", "重新读取")
        retry.type = "button"
        retry.dataset.retrySection = section.id
        retry.addEventListener("click", () => {
          sectionErrors.delete(section.id)
          contentVersion = ""
          updateContent()
          wake()
        })
        root.append(retry)
        const href = section.sourceHref ?? concepts.get(section.concept)?.href
        if (href) {
          const fallback = element("a", "topos-source-fallback", "打开原文独立页面 ↗")
          fallback.href = sourceURL(href)
          root.append(fallback)
        }
      } else requestSection(section.id)
      return root
    }
    prose.innerHTML = rendered[section.id] ?? ""
    const anchors = new Map<string, string>()
    for (const node of prose.querySelectorAll<HTMLElement>("[id]")) {
      const id = `${state.focus}--${section.id}--${node.id}`
      anchors.set(node.id, id)
      node.id = id
    }
    for (const node of prose.querySelectorAll<HTMLElement>("[aria-labelledby],[aria-describedby]"))
      for (const name of ["aria-labelledby", "aria-describedby"])
        if (node.hasAttribute(name))
          node.setAttribute(
            name,
            node
              .getAttribute(name)!
              .split(/\s+/)
              .map((id) => anchors.get(id) ?? id)
              .join(" "),
          )
    for (const link of prose.querySelectorAll<HTMLAnchorElement>("a")) {
      const target = link.getAttribute("href") ?? ""
      const localId = target.startsWith("#") ? decodeAnchor(target.slice(1)) : ""
      if (target.startsWith("#") && anchors.has(localId)) {
        link.href = `#${encodeURIComponent(anchors.get(localId)!)}`
        link.dataset.localAnchor = anchors.get(localId)
      }
      if (target.startsWith("concept:") || target.startsWith("#concept=")) {
        const id = target.replace(/^(concept:|#concept=)/, "")
        if (concepts.has(id)) {
          link.dataset.conceptTarget = id
          link.href =
            published && concepts.get(id)?.href
              ? sourceURL(concepts.get(id)!.href!)
              : `#${new URLSearchParams({ focus: id, lens: state.lens, depth: "2.1" })}`
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
      button.addEventListener("click", () => (expanded ? fold(id) : unfold(id, section.id)))
      branch.append(button)
      if (expanded && !placed.has(child.id)) branch.append(sectionNode(child, nextPath, placed))
      children.append(branch)
    }
    if (children.childElementCount) root.append(children)
    return root
  }
  function requestSection(id: string) {
    if (pendingSections.has(id) || id in rendered) return
    const request = Promise.resolve().then(async () => {
      try {
        if (!sectionFiles[id]) throw new Error("未找到这段原文的数据位置。")
        const url = new URL(sectionFiles[id], siteRoot)
        if (
          url.origin !== siteRoot.origin ||
          !url.pathname.startsWith(new URL("./static/topos/sections/", siteRoot).pathname)
        )
          throw new Error("原文数据地址不属于本站公开内容。")
        const response = await fetch(url)
        if (!response.ok) throw new Error(`原文读取暂时失败（${response.status}）。`)
        const result = await response.json()
        if (result.id !== id || typeof result.html !== "string")
          throw new Error("原文数据不匹配，请重新读取。")
        rendered[id] = result.html
        sectionErrors.delete(id)
      } catch (error) {
        sectionErrors.set(id, error instanceof Error ? error.message : "原文读取暂时失败。")
      } finally {
        pendingSections.delete(id)
        contentVersion = ""
        updateContent()
        annotationTime = -Infinity
        wake()
      }
    })
    pendingSections.set(id, request)
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
    const previousScroll = readingScroll.get(concept.id) ?? root.scrollTop
    restoringScroll.add(concept.id)
    root.dataset.active = "true"
    root.dataset.memory = "false"
    const oldFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.dataset.openSection
        : undefined
    root.replaceChildren()
    const header = element("header", "topos-unfolding-header")
    const label = element("span", undefined, published ? typeLabel(concept) : "局部展开"),
      close = element("button", undefined, "收拢 ↗")
    close.type = "button"
    close.dataset.fold = "true"
    close.addEventListener("click", () => {
      commit(
        { ...state, scale: 1, unfolded: state.unfolded.filter((u) => u.concept !== concept.id) },
        true,
      )
      labelNodes.get(concept.id)?.focus({ preventScroll: true })
    })
    header.append(label, close)
    root.append(header)
    if (published) {
      const meta = element("div", "topos-source-meta")
      meta.dataset.objectType = concept.mathType ?? concept.kind
      if (concept.sourceStatus)
        meta.append(
          element("span", "topos-maintenance-status", `整理状态：${concept.sourceStatus}`),
        )
      if (concept.sourceLayer)
        meta.append(element("span", "topos-maintenance-layer", `维护阶段：${concept.sourceLayer}`))
      if (concept.proofStatus) {
        const proof = element("span", "topos-proof-status", concept.proofStatus)
        proof.dataset.proofStatus = concept.proofStatus
        meta.append(proof)
      }
      if (concept.sourceTitle)
        meta.append(element("span", "topos-source-title", `来源 · ${concept.sourceTitle}`))
      const source = element("a", "topos-original-source", "原文位置 ↗")
      if (concept.sourceHref ?? concept.href) {
        source.href = sourceURL((concept.sourceHref ?? concept.href)!)
        const owner =
          model.concepts.find(
            (candidate) =>
              candidate.objectKind === "note" &&
              candidate.href &&
              new URL(sourceURL(candidate.href)).pathname === new URL(source.href).pathname,
          )?.id ?? concept.relatedNotes?.find((id) => concepts.has(id))
        source.dataset.conceptTarget = owner ?? concept.id
        source.dataset.sourceAnchor = new URL(source.href).hash.slice(1)
        meta.append(source)
      }
      if (concept.occurrences && concept.occurrences.length > 1) {
        const occurrences = element("details", "topos-occurrences")
        occurrences.append(
          element("summary", undefined, `${concept.occurrences.length} 处原文出现位置`),
        )
        for (const occurrence of concept.occurrences) {
          const note = model.concepts.find(
            (candidate) =>
              candidate.objectKind === "note" &&
              candidate.href &&
              new URL(sourceURL(candidate.href)).pathname ===
                new URL(sourceURL(occurrence.href)).pathname,
          )
          const occurrenceLink = element(
            "a",
            undefined,
            note?.title ?? occurrence.slug.split("/").at(-1),
          )
          occurrenceLink.href = sourceURL(occurrence.href)
          if (note) occurrenceLink.dataset.conceptTarget = note.id
          occurrenceLink.dataset.sourceAnchor = occurrence.anchor
          occurrences.append(occurrenceLink)
        }
        meta.append(occurrences)
      }
      for (const id of concept.relatedNotes ?? []) {
        const note = concepts.get(id)
        if (!note || id === concept.id) continue
        const link = element("a", "topos-source-note", `完整笔记 · ${note.title}`)
        link.dataset.conceptTarget = id
        link.href = note.href ? sourceURL(note.href) : `#focus=${encodeURIComponent(id)}&depth=2.1`
        meta.append(link)
      }
      root.append(meta)
    }
    const lead = element("p", "topos-explanation-lead", concept.summary)
    if (!published) root.append(lead)
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
      const open = element(
        "button",
        "topos-unfold-button",
        published ? "展开完整原文" : "展开正式定义",
      )
      open.dataset.openSection = formal.id
      open.type = "button"
      open.addEventListener("click", () => unfold(formal.id))
      root.append(open)
    }
    if (state.scale >= 2.7) {
      const related = element("div", "topos-recursive-options")
      related.append(element("p", undefined, published ? "原文中的联系" : "继续展开相关构造"))
      const targets = context.relations
        .filter((r) => r.source === concept.id || r.target === concept.id)
        .slice(0, 4)
      for (const relation of targets) {
        const other = concepts.get(
          relation.source === concept.id ? relation.target : relation.source,
        )!
        const s = preferredSection(other, 2)
        if (!s) continue
        if (published) {
          const link = element(
            "a",
            "topos-related-object",
            `${relationCategory(relation)} · ${other.title}`,
          )
          link.dataset.conceptTarget = other.id
          link.dataset.provenance = relation.provenance ?? "reference"
          link.href = other.href
            ? sourceURL(other.href)
            : `#focus=${encodeURIComponent(other.id)}&depth=2.1`
          related.append(link)
          continue
        }
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
    if (published && state.scale >= 2) {
      const headings = [
        ...root.querySelectorAll<HTMLElement>(
          ".topos-prose h1,.topos-prose h2,.topos-prose h3,.topos-prose h4",
        ),
      ]
      if (headings.length > (concept.objectKind === "note" ? 0 : 2)) {
        const toc = element("details", "topos-reading-toc"),
          summary = element("summary", undefined, `本文目录 · ${headings.length} 节`),
          nav = element("nav")
        nav.setAttribute("aria-label", "原位正文目录")
        headings.forEach((heading, index) => {
          heading.id ||= `${concept.id}--heading-${index}`
          const button = element("button", undefined, heading.textContent?.replace(/#$/, "").trim())
          button.type = "button"
          button.addEventListener("click", () => {
            heading.tabIndex = -1
            heading.focus({ preventScroll: true })
            root!.scrollTo({
              top:
                root!.scrollTop +
                heading.getBoundingClientRect().top -
                root!.getBoundingClientRect().top -
                20,
              behavior: reduce.matches ? "instant" : "smooth",
            })
            toc.open = false
          })
          nav.append(button)
        })
        toc.append(summary, nav)
        header.after(toc)
      }
    }
    root.onscroll = () => {
      if (
        state.focus !== concept.id ||
        root!.dataset.active !== "true" ||
        restoringScroll.has(concept.id) ||
        !root!.querySelector(".topos-section .topos-prose")
      )
        return
      readingScroll.set(concept.id, root!.scrollTop)
      laterRemember()
    }
    if (root.querySelector(".topos-section .topos-prose"))
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (state.focus !== concept.id || root!.dataset.active !== "true") return
          root!.scrollTo({ top: previousScroll, behavior: "instant" })
          restoringScroll.delete(concept.id)
          readingScroll.set(concept.id, root!.scrollTop)
          applyPendingAnchor()
        }),
      )
    if (oldFocus)
      root
        .querySelector<HTMLElement>(`[data-open-section="${CSS.escape(oldFocus)}"]`)
        ?.focus({ preventScroll: true })
    applyPendingAnchor()
  }
  function applyPendingAnchor() {
    if (!pendingAnchor || pendingAnchor.concept !== state.focus || restoringScroll.has(state.focus))
      return
    const root = unfoldings.get(pendingAnchor.concept)
    const target = root?.querySelector<HTMLElement>(
      `[data-source-id="${CSS.escape(pendingAnchor.anchor)}"]`,
    )
    if (!root || !target) return
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    root.scrollTo({
      top:
        root.scrollTop + target.getBoundingClientRect().top - root.getBoundingClientRect().top - 16,
      behavior: reduce.matches ? "instant" : "smooth",
    })
    pendingAnchor = undefined
  }
  explanations.addEventListener("click", (e) => {
    const anchor = (e.target as HTMLElement).closest<HTMLAnchorElement>("a")
    if (!anchor || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return
    if (anchor.dataset.localAnchor) {
      e.preventDefault()
      const target = document.getElementById(anchor.dataset.localAnchor)
      if (target) {
        target.tabIndex = -1
        target.focus({ preventScroll: true })
        target.scrollIntoView({ block: "nearest", behavior: reduce.matches ? "instant" : "smooth" })
      }
      return
    }
    if (anchor.dataset.conceptTarget) {
      e.preventDefault()
      focus(anchor.dataset.conceptTarget, anchor.dataset.sourceAnchor)
      zoom(Math.max(2.1, state.scale))
      applyPendingAnchor()
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
            ? published
              ? "原文与公式"
              : "定义与公式"
            : "递归展开"
    targetZoom = innerWidth < 600 ? 0.45 + state.scale * 0.065 : 0.79 + state.scale * 0.09
    for (const b of document.querySelectorAll<HTMLElement>("button[data-lens]"))
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
    const mobileReading = published && innerWidth < 600 && showUnfold
    const now = performance.now()
    const focusedWidth = Math.min(published ? 650 : 360, renderer.size.width - 28)
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
        .slice(0, mobileReading ? 0 : innerWidth < 600 && showUnfold ? 4 : 12)
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
        const w = Math.min(
          innerWidth < 600 ? innerWidth - 28 : published ? 720 : 465,
          renderer.size.width - 32,
        )
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
      for (const box of placed) {
        if (
          published &&
          excluded.some(
            (obstacle) =>
              box.x < obstacle.x + obstacle.width + 7 &&
              box.x + box.width > obstacle.x - 7 &&
              box.y < obstacle.y + obstacle.height + 7 &&
              box.y + box.height > obstacle.y - 7,
          )
        )
          continue
        annotationTargets.set(box.id, box)
      }
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
                : published
                  ? 0
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
        root.style.opacity = active
          ? "1"
          : memory && !mobileReading
            ? String(n.relevance * 0.3)
            : "0"
        root.style.pointerEvents = active ? "auto" : "none"
        root.inert = !active
        const maxWidth = Math.min(
          innerWidth < 600 ? innerWidth - 28 : published ? 720 : 465,
          renderer.size.width - 32,
        )
        const left = active
          ? clamp(p.x - maxWidth / 2, 14, renderer.size.width - maxWidth - 14)
          : clamp(p.x + 20, 14, renderer.size.width - 236)
        const top = active ? clamp(p.y + 20, 130, renderer.size.height - 180) : p.y + 18
        root.style.transform = `translate(${left}px,${top}px) scale(${active ? 1 : 0.72})`
        root.style.width = `${active ? maxWidth : 230}px`
        root.style.maxHeight = active
          ? `${Math.max(120, renderer.size.height - top - (innerWidth < 600 ? 145 : 96))}px`
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
      element("small", undefined, published ? `${relationCategory(r)} · ${r.type}` : r.type),
      element(
        "h2",
        undefined,
        published
          ? `${concepts.get(r.source)!.title} → ${concepts.get(r.target)!.title}`
          : `${concepts.get(r.source)!.zh} → ${concepts.get(r.target)!.zh}`,
      ),
      element("p", undefined, r.explanation),
    )
    if (published)
      for (const [position, id] of [
        ["起点", r.source],
        ["终点", r.target],
      ]) {
        const concept = concepts.get(id)!
        if (concept.proofStatus)
          relationPopover.append(
            element(
              "p",
              "topos-relation-proof-status",
              `${position}证明状态：${concept.proofStatus}`,
            ),
          )
      }
    const source = model.sources.find((s) => r.evidence.startsWith(s.id))
    if (r.evidenceHref) {
      const evidence = element("a", undefined, "查看原文依据 ↗")
      evidence.href = sourceURL(r.evidenceHref)
      const target = model.concepts.find(
        (candidate) =>
          candidate.objectKind === "note" &&
          candidate.href &&
          new URL(sourceURL(candidate.href)).pathname === new URL(evidence.href).pathname,
      )
      if (target)
        evidence.addEventListener("click", (event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          relationPopover.hidden = true
          focus(target.id)
          zoom(2.1)
        })
      relationPopover.append(evidence)
    }
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
    const desiredCenter =
      state.scale >= 1.7 ? (published ? 0.235 : innerWidth < 600 ? 0.29 : 0.31) : 0.47
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
        ".topos-instruments,.topos-unfolding,.topos-help,.topos-utility,.topos-relation-detail,.topos-relation,.topos-search",
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
      if (
        (e.target as HTMLElement).closest(
          ".topos-unfolding,.topos-help,.topos-relation-detail,.topos-search",
        )
      )
        return
      e.preventDefault()
      zoom(state.scale - e.deltaY * 0.003)
    },
    { passive: false },
  )
  document
    .querySelectorAll<HTMLElement>("button[data-lens]")
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
    if (published && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault()
      if (search.open) search.close()
      else openSearch()
      return
    }
    if ((e.target as HTMLElement).matches("input,textarea,select") || help.open || search.open)
      return
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
    pendingAnchor = undefined
    const s = e.state?.topos as Saved | undefined
    if (s && concepts.has(s.view.focus)) {
      restoreSaved(s)
      pan = { x: renderer.view.x, y: renderer.view.y }
      readingScroll.clear()
      for (const [id, top] of Object.entries(s.readingScroll ?? {})) readingScroll.set(id, top)
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
