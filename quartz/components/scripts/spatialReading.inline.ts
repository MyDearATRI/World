import { atomTypeLabels, type KnowledgeIndex, type KnowledgeObject } from "../../util/knowledge"
import type { ReaderCatalog } from "../../util/readerCatalog"
import { createSpatialSearch, spatialSnippet } from "../../util/spatialSearch"
import { mountKnowledgeGraph, renderKnowledgeExcerpt } from "./knowledgeGraph"
import { selectKnowledgeFormula } from "../../util/knowledgeGraph"
import { computePosition, flip, shift, offset } from "@floating-ui/dom"
import katex from "katex"
import { semanticCacheName } from "../../util/semantic"
import type { GraphRelation } from "../../util/knowledgeGraph"

type GraphController = {
  setFocus: (id: string) => void
  getState: () => unknown
  restoreState: (state: unknown) => void
  setRecommendations: (relations: GraphRelation[]) => void
  destroy: () => void
}

type SemanticIndex = {
  version: number
  snapshotHash: string
  model: { downloadBytes: number; source: string; id: string }
  recommendations: Record<string, { id: string; score: number }[]>
}
type SpaceState = {
  version: 1
  focus: string | null
  trail: string[]
  scroll: number
  outerScroll: number
  depth?: number
  map?: unknown
  focusTarget?: { href?: string; id?: string; objectId?: string; area?: string }
  returnFocus?: { objectId?: string; href?: string; graph: boolean; node: boolean }
  expanded?: number[]
  returnHref: string
  returnTitle: string
}
const typeLabels: Record<string, string> = {
  ...atomTypeLabels,
  definition: "定义",
  "definition-group": "定义组",
  theorem: "定理",
  lemma: "引理",
  proof: "证明",
  "proof-strategy": "证明策略",
  example: "数学例子",
  counterexample: "反例",
  insight: "观察",
  question: "问题",
  proposition: "命题",
  corollary: "推论",
  note: "完整笔记",
  research: "研究笔记",
  remark: "备注",
  intuition: "直觉",
  construction: "构造",
  reference: "参考",
  summary: "结构总结",
  reading: "章节研读",
  knowledge: "知识笔记",
  connection: "联系",
  exercise: "习题",
}
const label = (object: KnowledgeObject) => typeLabels[object.type] ?? object.type
const relationLabels: Record<string, string> = {
  references: "原文引用",
  reference: "原文引用",
  contains: "收录",
  occurs_in: "出现于",
  appears_in: "出现于",
  "appears-in": "出现于",
  "in-section": "相关研读节",
  "appears-in-section": "目录中的节关联",
  proves: "证明",
  proof_of: "证明",
  example_of: "例子",
  depends_on: "依赖",
  generalizes: "推广",
  motivates: "动机",
  embedded_in: "嵌入",
  related_reading: "相关研读",
  same_result: "同一结果",
  used_in: "用于",
  embeds: "嵌入",
  in_section: "所在节",
  source: "来源",
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string) => {
  const node = document.createElement(tag)
  if (text) node.textContent = text
  if (className) node.className = className
  return node
}

async function initializeSpace() {
  const context = document.querySelector<HTMLElement>("#reader-context")
  const shell = document.querySelector<HTMLElement>(".knowledge-space")
  const command = document.querySelector<HTMLDialogElement>(".knowledge-command")
  const preview = document.querySelector<HTMLElement>(".atom-preview")
  if (!context || !shell || !command || !preview || shell.dataset.ready) return
  shell.dataset.ready = "true"
  document.body.append(shell, command, preview)
  const siteRoot = new URL(`${(context.dataset.root || ".").replace(/\/$/, "")}/`, location.href)
  const pageRoot = document.querySelector<HTMLElement>("#quartz-root")!
  const documentPath = location.pathname
  const q = <T extends Element = HTMLElement>(selector: string) => shell.querySelector<T>(selector)!
  const cq = <T extends Element = HTMLElement>(selector: string) =>
    command.querySelector<T>(selector)!
  const focus = q<HTMLElement>(".space-focus")
  const layout = q<HTMLElement>(".space-layout")
  const body = q<HTMLElement>(".space-body")
  const title = q<HTMLElement>("[data-space-title]")
  const status = q<HTMLElement>("[data-space-status]")
  const scrollArea = () => (matchMedia("(max-width: 1150px)").matches ? layout : focus)
  let index: KnowledgeIndex
  try {
    const response = await fetch(new URL("static/knowledge-index.json", siteRoot))
    if (!response.ok) throw new Error("index unavailable")
    index = await response.json()
    if (index.version !== 1 || !Array.isArray(index.objects)) throw new Error("invalid index")
  } catch {
    document.querySelectorAll<HTMLButtonElement>("[data-space-command]").forEach((button) => {
      button.disabled = true
      button.title = "知识索引暂不可用，请沿章节阅读"
    })
    return
  }
  const objects = new Map(index.objects.map((object) => [object.id, object]))
  let catalog: ReaderCatalog | undefined
  const catalogRequest = fetch(new URL("static/bookIndex.json", siteRoot), {
    signal: AbortSignal.timeout(10_000),
  })
    .then(async (response) => {
      if (response.ok) catalog = (await response.json()).catalog
    })
    .catch(() => undefined)
  const urlFor = (href: string) => {
    const result = new URL(href, siteRoot)
    if (result.origin !== siteRoot.origin || !result.pathname.startsWith(siteRoot.pathname))
      throw new Error("Not a public site URL")
    return result.href
  }
  const byPath = new Map(
    index.objects.map((object) => [
      new URL(urlFor(object.href)).pathname.replace(/\.html$/, ""),
      object,
    ]),
  )
  for (const alias of index.aliases ?? []) {
    const canonical = objects.get(alias.canonicalId)
    if (canonical)
      byPath.set(new URL(urlFor(alias.href)).pathname.replace(/\.html$/, ""), canonical)
  }
  const objectAt = (href: string) => {
    try {
      const u = new URL(href, location.href)
      return u.origin === siteRoot.origin
        ? byPath.get(u.pathname.replace(/\.html$/, ""))
        : undefined
    } catch {
      return undefined
    }
  }
  let semantic: SemanticIndex | undefined
  const semanticRequest = fetch(new URL("static/semantic.json", siteRoot))
    .then(async (r) => {
      if (!r.ok) return
      const data = (await r.json()) as SemanticIndex
      if (data.version === 1 && data.snapshotHash === index.snapshotHash) semantic = data
    })
    .catch(() => undefined)
  const saved = history.state?.knowledge as SpaceState | undefined
  let state: SpaceState =
    saved?.version === 1
      ? saved
      : {
          version: 1,
          focus: null,
          trail: [],
          scroll: 0,
          outerScroll: scrollY,
          returnHref: location.href,
          returnTitle: document.title,
        }
  let opening = 0
  let abort: AbortController | undefined
  let initialTrigger: HTMLElement | SVGElement | undefined
  let localGraph: GraphController | undefined
  let localGraphRequest: Promise<GraphController> | undefined
  const htmlCache = new Map<string, string>()
  const rootGraphs: GraphController[] = []
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  const writeState = (replace = true, href = location.href) =>
    history[replace ? "replaceState" : "pushState"](
      { ...history.state, knowledge: state },
      "",
      href,
    )
  if (!saved) writeState()
  q<HTMLAnchorElement>("[data-space-home]").href = siteRoot.href
  q<HTMLAnchorElement>("[data-space-explore]").href = new URL("explore.html", siteRoot).href

  function objectLink(object: KnowledgeObject, text = object.title) {
    const a = el("a", text)
    a.href = urlFor(object.href)
    a.dataset.objectId = object.id
    return a
  }
  function listInto(host: HTMLElement, items: KnowledgeObject[], message: string) {
    host.replaceChildren()
    if (!items.length) {
      host.append(el("p", message, "space-aside-note"))
      return
    }
    const list = el("ul")
    for (const object of items) {
      const li = el("li")
      li.append(objectLink(object), el("small", label(object)))
      list.append(li)
    }
    host.append(list)
  }
  function renderContext(object: KnowledgeObject) {
    const trail = q<HTMLElement>("[data-space-trail]")
    trail.replaceChildren()
    const ids = [...state.trail, object.id].slice(-6)
    for (const id of ids) {
      const entry = objects.get(id)
      if (!entry) continue
      const li = el("li")
      const a = objectLink(entry)
      if (id === object.id) a.setAttribute("aria-current", "page")
      li.append(el("small", label(entry)), a)
      trail.append(li)
    }
    const origin = q<HTMLElement>("[data-space-origin]")
    origin.replaceChildren(el("p", "原文位置", "space-label"))
    const book = catalog?.books.find((entry) => entry.id === object.bookId)
    const chapter = book?.chapters.find((entry) => entry.id === object.chapterId)
    for (const entry of [book, chapter]) {
      if (!entry) continue
      const link = el("a", entry.title)
      link.href = urlFor(`${entry.slug}.html`)
      origin.append(link)
    }
    if (object.sourceHref) {
      const source = el("a", "在完整笔记中定位 ↗")
      source.href = urlFor(object.sourceHref)
      source.dataset.spaceNative = ""
      origin.append(source)
    }
    const noteIDs = [
      ...new Set([
        ...(object.relatedNotes ?? []),
        ...(object.kind === "atom" && object.sourceSlug ? [`note:${object.sourceSlug}`] : []),
      ]),
    ]
    listInto(
      q("[data-space-notes]"),
      noteIDs.map((id) => objects.get(id)).filter((item): item is KnowledgeObject => !!item),
      "完整出处见正文中的来源链接。",
    )
    const related = index.relations.filter((r) => r.source === object.id || r.target === object.id)
    const host = q<HTMLElement>("[data-space-relations]")
    host.replaceChildren()
    const list = el("ul")
    for (const relation of related.slice(0, 12)) {
      const target = objects.get(relation.source === object.id ? relation.target : relation.source)
      if (!target) continue
      const li = el("li")
      li.append(
        objectLink(target),
        el(
          "small",
          `${relation.source === object.id ? "→" : "←"} ${relationLabels[relation.type] ?? relation.type} · ${relation.provenance === "authored" ? "原文明确关系" : "结构与引用"}`,
        ),
      )
      if (relation.evidenceHref) {
        const evidence = el("a", "查看依据")
        evidence.href = urlFor(relation.evidenceHref)
        evidence.dataset.spaceNative = ""
        evidence.className = "space-aside-note"
        li.append(evidence)
      }
      list.append(li)
    }
    host.append(
      list.childElementCount ? list : el("p", "尚无已登记的直接联系。", "space-aside-note"),
    )
    const recommendations = semantic?.recommendations[object.id] ?? []
    listInto(
      q("[data-space-similar]"),
      recommendations
        .slice(0, 5)
        .map((item) => objects.get(item.id))
        .filter((item): item is KnowledgeObject => !!item),
      semantic ? "目前没有可用的相似推荐。" : "预计算推荐暂不可用；正文与引用仍可阅读。",
    )
  }

  function extract(html: string, pageUrl: string, serial: number) {
    const parsed = new DOMParser().parseFromString(html, "text/html")
    const content = parsed.querySelector<HTMLElement>(".markdown-content")
    if (!content) throw new Error("该页面暂时无法在阅读空间内展示")
    content
      .querySelectorAll(
        "script,style,link,meta,base,iframe,object,embed,form,.knowledge-space,.atom-open",
      )
      .forEach((node) => node.remove())
    const ids = new Map<string, string>()
    for (const node of [content, ...content.querySelectorAll<HTMLElement>("[id]")])
      if (node.id) {
        ids.set(node.id, `space-${serial}-${node.id}`)
        node.id = ids.get(node.id)!
      }
    for (const node of [content, ...content.querySelectorAll<HTMLElement>("*")]) {
      for (const attr of [...node.attributes])
        if (/^on/i.test(attr.name) || attr.name === "srcdoc") node.removeAttribute(attr.name)
      for (const attr of ["aria-labelledby", "aria-describedby", "for", "headers"]) {
        const value = node.getAttribute(attr)
        if (value)
          node.setAttribute(
            attr,
            value
              .split(/\s+/)
              .map((id) => ids.get(id) ?? id)
              .join(" "),
          )
      }
      for (const attr of ["href", "src", "poster", "xlink:href"]) {
        const value = node.getAttribute(attr)
        if (!value) continue
        try {
          const u = new URL(value, pageUrl)
          if (!["http:", "https:", "mailto:", "tel:"].includes(u.protocol)) {
            node.removeAttribute(attr)
            continue
          }
          const local = new URL(pageUrl)
          if (
            attr === "href" &&
            u.origin === local.origin &&
            u.pathname === local.pathname &&
            u.hash
          ) {
            const target = ids.get(decodeURIComponent(u.hash.slice(1)))
            if (target) {
              node.setAttribute(attr, `#${target}`)
              node.dataset.spaceAnchor = u.href
              continue
            }
          }
          node.setAttribute(attr, u.href)
        } catch {
          node.removeAttribute(attr)
        }
      }
      const srcset = node.getAttribute("srcset")
      if (srcset)
        node.setAttribute(
          "srcset",
          srcset
            .split(",")
            .map((part) => {
              const [src, size] = part.trim().split(/\s+/)
              return `${new URL(src, pageUrl).href}${size ? ` ${size}` : ""}`
            })
            .join(", "),
        )
    }
    const sequence = parsed.querySelector<HTMLElement>(".reading-sequence")
    if (sequence) {
      sequence.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
        a.href = new URL(a.getAttribute("href")!, pageUrl).href
      })
      content.append(sequence)
    }
    return content
  }
  function remember() {
    state.scroll = scrollArea().scrollTop
    const active = document.activeElement
    if (active instanceof HTMLElement && shell!.contains(active)) {
      state.focusTarget = {
        href: active instanceof HTMLAnchorElement ? active.href : undefined,
        id: active.id.replace(/^space-\d+-/, "") || undefined,
        objectId: active.dataset.objectId ?? active.dataset.atomId,
        area: active.closest(".space-body")
          ? ".space-body"
          : active.closest(".space-relations")
            ? ".space-relations"
            : ".space-context",
      }
    }
    state.expanded = [...body.querySelectorAll("details")].flatMap((node, i) =>
      node.open ? [i] : [],
    )
    if (state.focus && localGraph) state.map = localGraph.getState()
    else if (!state.focus && rootGraphs[0]) state.map = rootGraphs[0].getState()
    if (!state.focus) state.outerScroll = scrollY
    writeState()
  }
  function setDocumentTitle(value: string, canonicalHref: string) {
    document.title = value
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')
    if (!canonical) {
      canonical = el("link")
      canonical.rel = "canonical"
      document.head.append(canonical)
    }
    canonical.href = canonicalHref
  }
  async function show(
    id: string,
    trigger?: HTMLElement | SVGElement,
    mode: "push" | "restore" | "initial" = "push",
  ) {
    const object = objects.get(id)
    if (!object) return
    preview!.hidden = true
    const old = state.focus
    if (mode === "push") {
      if (!old && trigger) {
        state.returnFocus = {
          objectId:
            trigger.getAttribute("data-object-id") ??
            trigger.getAttribute("data-knowledge-id") ??
            trigger.getAttribute("data-atom-id") ??
            id,
          href: trigger instanceof HTMLAnchorElement ? trigger.href : undefined,
          graph: !!trigger.closest(".knowledge-map-3d,.knowledge-map"),
          node: !!trigger.closest(".kg3d-node"),
        }
      }
      remember()
      if (!old) {
        initialTrigger = trigger
        state.outerScroll = scrollY
        state.returnHref = location.href
        state.returnTitle = document.title
      }
      state = {
        ...state,
        focus: id,
        depth: (state.depth ?? 0) + 1,
        trail: old
          ? [...state.trail, old].slice(-30)
          : objectAt(state.returnHref)
            ? [objectAt(state.returnHref)!.id]
            : [],
        scroll: 0,
        map: undefined,
        focusTarget: undefined,
        expanded: undefined,
      }
      writeState(false, urlFor(object.href))
    } else state.focus = id
    const serial = ++opening
    abort?.abort()
    abort = new AbortController()
    const rect = trigger?.getBoundingClientRect()
    shell!.hidden = false
    pageRoot.inert = true
    document.body.classList.add("spatial-active")
    title.textContent = object.title
    q("[data-space-type]").textContent =
      `${label(object)} · ${object.kind === "atom" ? "知识原子" : "连续论述"}`
    const proof = q<HTMLElement>("[data-space-proof]")
    proof.textContent = object.proofStatus ?? ""
    proof.hidden = !object.proofStatus
    q<HTMLAnchorElement>("[data-space-independent]").href = urlFor(object.href)
    q<HTMLButtonElement>("[data-space-back]").disabled =
      !state.trail.length && !old && mode !== "push"
    setDocumentTitle(`${object.title} · Notes & Knowledge`, urlFor(object.href))
    renderContext(object)
    status.textContent = "正在展开原文…"
    body.replaceChildren()
    try {
      const pageUrl = urlFor(object.href)
      let html = htmlCache.get(pageUrl)
      if (!html) {
        const response = await fetch(pageUrl, { signal: abort.signal })
        if (!response.ok) throw new Error(`原文暂时无法载入（${response.status}）`)
        html = await response.text()
        htmlCache.set(pageUrl, html)
      }
      if (serial !== opening) return
      body.replaceChildren(extract(html, pageUrl, serial))
      status.textContent = ""
      renderAtomsWithin(body, object)
      if (mode === "restore" && state.expanded)
        [...body.querySelectorAll("details")].forEach((node, i) => {
          node.open = state.expanded!.includes(i)
        })
      scrollArea().scrollTop = mode === "restore" ? state.scroll : 0
      if (location.hash && mode !== "push") {
        const anchor = body.querySelector<HTMLElement>(
          `[id="space-${serial}-${CSS.escape(decodeURIComponent(location.hash.slice(1)))}"]`,
        )
        anchor?.scrollIntoView({ block: "start" })
      }
      const target = mode === "restore" ? state.focusTarget : undefined
      const restored = target
        ? [
            ...(
              shell!.querySelector(target.area ?? ".space-body") ?? shell!
            ).querySelectorAll<HTMLElement>("a, button, [id]"),
          ].find((node) =>
            target.objectId
              ? node.dataset.objectId === target.objectId || node.dataset.atomId === target.objectId
              : target.id
                ? node.id.replace(/^space-\d+-/, "") === target.id
                : target.href && node instanceof HTMLAnchorElement && node.href === target.href,
          )
        : undefined
      ;(restored ?? title).focus({ preventScroll: true })
      if (!reduced.matches && mode === "push") {
        const dest = title.getBoundingClientRect()
        if (rect && rect.width > 0 && rect.height > 0) {
          const frame = el("div", undefined, "space-opening-frame")
          frame.setAttribute("aria-hidden", "true")
          Object.assign(frame.style, {
            left: `${dest.x}px`,
            top: `${dest.y}px`,
            width: `${dest.width}px`,
            height: `${dest.height}px`,
          })
          document.body.append(frame)
          const motion = frame.animate(
            [
              {
                transform: `translate(${rect.x - dest.x}px, ${rect.y - dest.y}px) scale(${rect.width / dest.width}, ${rect.height / dest.height})`,
                opacity: 0.8,
              },
              { transform: "translate(0,0) scale(1)", opacity: 0 },
            ],
            { duration: 320, easing: "cubic-bezier(.18,.84,.2,1)" },
          )
          void motion.finished.then(
            () => frame.remove(),
            () => frame.remove(),
          )
        }
        const start =
          rect && rect.width > 0
            ? {
                transform: `translate(${Math.max(-180, Math.min(180, rect.x - dest.x))}px, ${Math.max(-120, Math.min(120, rect.y - dest.y))}px) scale(.84)`,
              }
            : { transform: "translateX(24px) scale(.985)" }
        title.animate([start, { transform: "translate(0,0) scale(1)" }], {
          duration: 320,
          easing: "cubic-bezier(.18,.84,.2,1)",
        })
        body.animate([{ transform: "translateX(18px)" }, { transform: "translateX(0)" }], {
          duration: 280,
          easing: "cubic-bezier(.2,.8,.2,1)",
        })
      }
      if (localGraph) {
        const restoredMap = state.map
        localGraph.setFocus(id)
        if (mode === "restore" && restoredMap)
          localGraph.restoreState(restoredMap as Parameters<typeof localGraph.restoreState>[0])
      }
    } catch (error) {
      if (serial !== opening || abort.signal.aborted) return
      status.textContent = String(error instanceof Error ? error.message : error)
      const message = el("p", "可以重试，或独立打开原文继续阅读。", "space-error")
      const retry = el("button", "重试")
      retry.addEventListener("click", () => void show(id, undefined, "restore"))
      message.append(retry)
      const a = objectLink(object, "独立打开原文 ↗")
      a.dataset.spaceNative = ""
      message.append(a)
      body.append(message)
    }
  }
  function restoreBase(next: SpaceState) {
    // After refreshing an atom URL, this document contains that atom's static
    // page, not the original explorer. Reload the restored history entry so its
    // real HTML and saved map/focus state are reconstructed together.
    if (new URL(next.returnHref, siteRoot).pathname !== documentPath) {
      location.reload()
      return
    }
    opening++
    abort?.abort()
    preview!.hidden = true
    shell!.hidden = true
    state = next
    document.body.classList.remove("spatial-active")
    pageRoot.inert = false
    setDocumentTitle(state.returnTitle, state.returnHref)
    window.scrollTo(0, state.outerScroll)
    if (state.map && rootGraphs[0])
      rootGraphs[0].restoreState(state.map as Parameters<(typeof rootGraphs)[0]["restoreState"]>[0])
    restoreReturnFocus()
  }
  function restoreReturnFocus() {
    if (initialTrigger?.isConnected) initialTrigger.focus({ preventScroll: true })
    else if (state.returnFocus) {
      const identity = state.returnFocus
      const host = identity.graph
        ? (pageRoot.querySelector("[data-knowledge-map]") ?? pageRoot)
        : pageRoot
      const id = CSS.escape(identity.objectId ?? "")
      const selectors = identity.node
        ? [
            `.kg3d-node[data-node-id="${id}"] a`,
            `[data-knowledge-id="${id}"]`,
            `[data-object-id="${id}"]`,
          ]
        : [`[data-knowledge-id="${id}"]`, `[data-object-id="${id}"]`, `[data-atom-id="${id}"]`]
      const restore = () => {
        const candidates = selectors.flatMap((selector) => [
          ...host.querySelectorAll<HTMLElement>(selector),
        ])
        const target = candidates.find(
          (node) => node.getClientRects().length && !node.closest("[hidden],[inert]"),
        )
        target?.focus({ preventScroll: true })
      }
      restore()
      requestAnimationFrame(restore)
    }
  }
  window.addEventListener("popstate", (event) => {
    const next = event.state?.knowledge as SpaceState | undefined
    if (next?.version === 1) {
      state = next
      if (next.focus) void show(next.focus, undefined, "restore")
      else restoreBase(next)
    } else if (!shell!.hidden) restoreBase({ ...state, focus: null })
  })
  q("[data-space-back]").addEventListener("click", () => history.back())
  q("[data-space-close]").addEventListener("click", () => {
    if (state.depth) {
      history.go(-state.depth)
      return
    }
    if (state.returnHref !== urlFor(objects.get(state.focus!)?.href ?? "")) {
      location.assign(state.returnHref)
      return
    }
    location.assign(siteRoot.href)
  })
  q("[data-space-copy]").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      status.textContent = "地址已复制。"
    } catch {
      status.textContent = "请复制浏览器地址栏中的当前地址。"
    }
  })
  const graphSelect = (id: string, trigger: HTMLElement | SVGElement) => {
    void show(id, trigger)
  }
  let graphModule: Promise<typeof import("./knowledgeGraph3d") | undefined> | undefined
  async function createGraph(
    host: HTMLElement,
    onStateChange: (map: unknown) => void,
    initialFocus?: string,
  ): Promise<GraphController> {
    host.setAttribute("aria-busy", "true")
    await catalogRequest
    graphModule ??= import(new URL("static/graph/knowledgeGraph3d.js", siteRoot).href).catch(
      () => undefined,
    )
    const module = await graphModule
    const recommendations = Object.entries(semantic?.recommendations ?? {}).flatMap(
      ([source, entries]) =>
        entries.map((entry) => ({
          id: `similar:${source}:${entry.id}`,
          source,
          target: entry.id,
          type: "similar_to",
          provenance: "similarity" as const,
          score: entry.score,
          evidenceHref: objects.get(source)?.href,
        })),
    )
    const options = {
      onSelect: graphSelect,
      siteRoot: siteRoot.href,
      onStateChange,
      initialFocus,
      recommendations,
      initialBookId: host.dataset.bookId,
      initialChapterId: host.dataset.chapterId,
    }
    try {
      if (module && catalog) return module.mountKnowledgeGraph(host, index, { ...options, catalog })
      const graph = mountKnowledgeGraph(host, index, options)
      return {
        ...graph,
        restoreState: (value) => {
          // A 3D camera cannot be interpreted as an SVG pixel transform.
          if (value && (value as { version?: number }).version !== 2)
            graph.restoreState(value as Parameters<typeof graph.restoreState>[0])
        },
      }
    } finally {
      host.removeAttribute("aria-busy")
    }
  }
  const initialMap = state.map
  for (const host of document.querySelectorAll<HTMLElement>("[data-knowledge-map]")) {
    let request: Promise<GraphController> | undefined
    const mount = async () => {
      if (request) return
      request = createGraph(
        host,
        (map) => {
          if (!state.focus) {
            state.map = map
            writeState()
          }
        },
        host.dataset.initialFocus,
      )
      const graph = await request
      rootGraphs.push(graph)
      if (!state.focus && initialMap) {
        graph.restoreState(initialMap)
        restoreReturnFocus()
      }
    }
    const disclosure = host.closest<HTMLDetailsElement>("details.knowledge-map-entry")
    if (disclosure && !state.focus && initialMap && state.returnFocus?.graph) disclosure.open = true
    if (disclosure && !disclosure.open)
      disclosure.addEventListener("toggle", () => {
        if (disclosure.open)
          void mount().catch(() => {
            host.removeAttribute("aria-busy")
            host.prepend(el("p", "地图暂时无法载入；原文和目录仍可使用。"))
          })
      })
    else
      void mount().catch(() => {
        host.removeAttribute("aria-busy")
        host.prepend(el("p", "地图暂时无法载入；下方目录与普通搜索仍可使用。"))
      })
  }
  shell.querySelectorAll("[data-space-map-toggle]").forEach((button) =>
    button.addEventListener("click", async () => {
      const region = q<HTMLElement>(".space-map-region")
      region.hidden = !region.hidden
      if (!region.hidden) {
        const savedMap = state.map
        localGraphRequest ??= createGraph(
          q("[data-space-local-map]"),
          (map) => {
            if (state.focus) {
              state.map = map
              writeState()
            }
          },
          state.focus ?? undefined,
        )
        localGraph = await localGraphRequest
        if (region.hidden) return
        if (state.focus) localGraph.setFocus(state.focus)
        if (savedMap)
          localGraph.restoreState(savedMap as Parameters<typeof localGraph.restoreState>[0])
        region.scrollIntoView({ block: "start", behavior: reduced.matches ? "instant" : "smooth" })
      }
    }),
  )
  function renderAtomsWithin(host: HTMLElement, object?: KnowledgeObject) {
    const sourceSlug =
      object?.kind === "note" ? (object.sourceSlug ?? object.id.slice(5)) : undefined
    const atoms = index.objects.filter(
      (o) =>
        o.kind === "atom" &&
        (sourceSlug
          ? o.occurrences?.some((p) => p.slug === sourceSlug)
          : o.occurrences?.some((p) => p.slug === context!.dataset.pageSlug)),
    )
    if (!atoms.length || object?.kind === "atom" || host.querySelector(".page-atoms")) return
    const details = el("details", undefined, "page-atoms")
    details.append(el("summary", `本篇知识原子 · ${atoms.length}`))
    const list = el("ul")
    for (const atom of atoms) {
      const li = el("li")
      li.append(objectLink(atom, `${label(atom)} · ${atom.title}`))
      list.append(li)
    }
    details.append(list)
    host.prepend(details)
  }
  const sourceBody = document.querySelector<HTMLElement>("#article-content > .markdown-content")
  if (sourceBody) renderAtomsWithin(sourceBody)

  let search = createSpatialSearch(index.objects)
  let active = -1
  let results: KnowledgeObject[] = []
  let commandTrigger: HTMLElement | undefined
  let querySequence = 0
  let worker: Worker | undefined
  let modelReady = false
  let downloadReviewed = false
  const input = cq<HTMLInputElement>("#knowledge-query")
  const typeFilter = cq<HTMLSelectElement>("[data-command-type]")
  const scope = cq<HTMLSelectElement>("[data-command-scope]")
  const relationFilter = cq<HTMLSelectElement>("[data-command-relation]")
  const aux = cq<HTMLInputElement>("[data-command-aux]")
  const resultHost = cq<HTMLOListElement>(".command-results")
  const searchStatus = cq<HTMLElement>("[data-command-status]")
  for (const type of [
    ...new Set(index.objects.filter((o) => o.kind === "atom").map((o) => o.type)),
  ].sort()) {
    const option = el("option", typeLabels[type] ?? type)
    option.value = type
    typeFilter.append(option)
  }
  void catalogRequest.then(() => {
    for (const book of catalog?.books ?? []) {
      const option = el("option", book.title)
      option.value = `book:${book.id}`
      scope.append(option)
    }
    if (
      !scope.value &&
      context.dataset.bookId &&
      catalog?.books.some((b) => b.id === context.dataset.bookId)
    )
      scope.value = `book:${context.dataset.bookId}`
    if (state.focus && objects.has(state.focus)) renderContext(objects.get(state.focus)!)
  })
  for (const group of index.groups) {
    const option = el("option", group.title)
    option.value = group.id
    scope.append(option)
  }
  for (const type of [...new Set(index.relations.map((r) => r.type))]) {
    const option = el("option", relationLabels[type] ?? type)
    option.value = type
    relationFilter.append(option)
  }
  if (context.dataset.bookId && catalog?.books.some((b) => b.id === context.dataset.bookId))
    scope.value = `book:${context.dataset.bookId}`
  const eligible = (o: KnowledgeObject) =>
    (!typeFilter.value || o.kind === typeFilter.value || o.type === typeFilter.value) &&
    (!scope.value ||
      (scope.value.startsWith("book:")
        ? o.bookId === scope.value.slice(5)
        : !!index.groups.find((g) => g.id === scope.value)?.objectIds.includes(o.id))) &&
    (!relationFilter.value ||
      index.relations.some(
        (r) => r.type === relationFilter.value && (r.source === o.id || r.target === o.id),
      ))
  function drawResults(items: KnowledgeObject[], isSemantic = false) {
    results = items
    active = -1
    resultHost.replaceChildren()
    for (const object of items) {
      const li = el("li")
      const a = objectLink(object, "")
      a.dataset.searchResult = ""
      a.append(
        el("span", label(object), "command-result-type"),
        el("span", object.title, "command-result-title"),
      )
      const group = index.groups.find((g) => g.id === object.chapterId)
      a.append(
        el(
          "small",
          `${group?.title ?? (object.kind === "atom" ? "原文数学对象" : "完整笔记")}${object.proofStatus ? ` · ${object.proofStatus}` : ""}`,
          "command-result-context",
        ),
        el("span", spatialSnippet(object, input.value), "command-result-excerpt"),
      )
      li.append(a)
      resultHost.append(li)
    }
    searchStatus.textContent = items.length
      ? `${items.length} 个结果${isSemantic ? " · 含本机语义匹配" : " · 名称与别名优先"}`
      : "没有匹配的对象。试试其他名称、英文术语或放宽范围。"
  }
  function runSearch() {
    const sequence = ++querySequence
    drawResults(search(input.value, eligible))
    if (modelReady && input.value.trim())
      worker?.postMessage({ type: "query", text: input.value, requestId: String(sequence) })
  }
  function openCommand(trigger?: HTMLElement) {
    commandTrigger = trigger ?? (document.activeElement as HTMLElement)
    const currentBook = objects.get(state.focus ?? "")?.bookId ?? context!.dataset.bookId
    if (currentBook && catalog?.books.some((book) => book.id === currentBook))
      scope.value = `book:${currentBook}`
    preview!.hidden = true
    command!.showModal()
    runSearch()
    input.focus()
  }
  function closeCommand() {
    command!.close()
    commandTrigger?.focus({ preventScroll: true })
  }
  cq("[data-command-close]").addEventListener("click", closeCommand)
  command.addEventListener("cancel", (event) => {
    event.preventDefault()
    closeCommand()
  })
  input.addEventListener("input", runSearch)
  for (const select of [typeFilter, scope, relationFilter])
    select.addEventListener("change", runSearch)
  let auxiliaryObjects: KnowledgeObject[] = []
  aux.addEventListener("change", async () => {
    if (aux.checked && !auxiliaryObjects.length) {
      try {
        const response = await fetch(new URL("static/bookIndex.json", siteRoot))
        if (!response.ok) throw new Error("附属索引暂不可用")
        const data = (await response.json()) as {
          documents: {
            auxiliary: boolean
            slug: string
            title: string
            text: string
            aliases: string[]
            bookId?: string
            chapterId?: string
          }[]
        }
        auxiliaryObjects = data.documents
          .filter((d) => d.auxiliary)
          .map((d) => ({
            id: `note:${d.slug}`,
            kind: "note",
            type: "附属资料",
            title: d.title,
            href: d.slug === "index" ? "index.html" : `${d.slug}.html`,
            text: d.text,
            excerpt: d.text.slice(0, 140),
            aliases: d.aliases,
            bookId: d.bookId,
            chapterId: d.chapterId,
            latex: [],
            relatedNotes: [],
          }))
      } catch {
        searchStatus.textContent = "附属资料索引暂时不可用。"
        aux.checked = false
      }
    }
    search = createSpatialSearch([...index.objects, ...(aux.checked ? auxiliaryObjects : [])])
    runSearch()
  })
  command.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault()
      closeCommand()
      return
    }
    if (
      !["ArrowDown", "ArrowUp", "Enter"].includes(event.key) ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLButtonElement
    )
      return
    if (event.key === "Enter") {
      if (active >= 0 && results[active]) {
        event.preventDefault()
        const object = results[active]
        closeCommand()
        if (objects.has(object.id)) void show(object.id)
        else location.assign(urlFor(object.href))
      }
      return
    }
    if (!results.length) return
    event.preventDefault()
    active = (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length
    resultHost.querySelectorAll<HTMLAnchorElement>("a").forEach((a, i) => {
      a.setAttribute("aria-selected", String(i === active))
      if (i === active) {
        a.focus({ preventScroll: true })
        a.scrollIntoView({ block: "nearest" })
      }
    })
  })
  document.addEventListener(
    "keydown",
    (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (command!.open) closeCommand()
        else openCommand()
      } else if (
        event.key === "Escape" &&
        !command!.open &&
        !(
          event.target instanceof Element &&
          event.target.closest(
            ".kg-path-dialog, .knowledge-map.is-fullscreen, .kg3d-path, .knowledge-map-3d.is-fullscreen",
          )
        )
      ) {
        preview!.hidden = true
        if (!q<HTMLElement>(".space-map-region").hidden)
          q<HTMLElement>(".space-map-region").hidden = true
        else if (!shell!.hidden && state.trail.length) {
          event.preventDefault()
          history.back()
        }
      }
    },
    true,
  )
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target : undefined
      const launcher = target?.closest<HTMLElement>("[data-space-command]")
      if (launcher) {
        event.preventDefault()
        event.stopImmediatePropagation()
        openCommand(launcher)
        return
      }
      const a = target?.closest<HTMLAnchorElement>("a")
      if (a?.hasAttribute("data-knowledge-id") && a.closest(".knowledge-map,.knowledge-map-3d"))
        return
      if (
        !a ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey ||
        a.target === "_blank" ||
        a.hasAttribute("download") ||
        a.hasAttribute("data-space-native")
      )
        return
      if (a.dataset.spaceAnchor) {
        event.preventDefault()
        const localId = a.getAttribute("href")!.slice(1)
        body
          .querySelector<HTMLElement>(`[id="${CSS.escape(localId)}"]`)
          ?.scrollIntoView({ block: "start" })
        remember()
        writeState(true, a.dataset.spaceAnchor)
        return
      }
      if (
        a.hash &&
        new URL(a.href).pathname === location.pathname &&
        !a.dataset.atomId &&
        !a.dataset.objectId
      )
        return
      const id = a.dataset.atomId ?? a.dataset.objectId ?? objectAt(a.href)?.id
      if (!id || !objects.has(id)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (command!.open) closeCommand()
      void show(id, a)
    },
    true,
  )
  document.addEventListener("reader:open", (event) => {
    const detail = (
      event as CustomEvent<{ slug?: string; href?: string; trigger?: HTMLElement | SVGElement }>
    ).detail
    const id = detail.slug
      ? `note:${detail.slug}`
      : detail.href
        ? objectAt(detail.href)?.id
        : undefined
    if (id) void show(id, detail.trigger)
  })

  let previewTimer: ReturnType<typeof setTimeout> | undefined
  let keyboardPreviewTarget: HTMLElement | undefined
  let hideTimer: ReturnType<typeof setTimeout> | undefined
  async function showPreview(a: HTMLElement, object: KnowledgeObject) {
    preview!.querySelector(".space-type")!.textContent = label(object)
    preview!.querySelector("h3")!.textContent = object.title
    renderKnowledgeExcerpt(
      preview!.querySelector<HTMLElement>(".atom-preview-excerpt")!,
      object.excerpt.slice(0, 200),
    )
    const math = preview!.querySelector<HTMLElement>(".atom-preview-formula")!
    math.replaceChildren()
    const formula = selectKnowledgeFormula(object.latex)
    if (formula) {
      try {
        katex.render(formula, math, {
          throwOnError: false,
          trust: false,
          output: "htmlAndMathml",
        })
      } catch {}
    }
    const count = index.relations.filter(
      (r) => r.source === object.id || r.target === object.id,
    ).length
    preview!.querySelector(".atom-preview-relations")!.textContent =
      `${count} 条已登记联系${object.proofStatus ? ` · ${object.proofStatus}` : ""}`
    const link = preview!.querySelector<HTMLAnchorElement>("a")!
    link.href = urlFor(object.href)
    link.dataset.objectId = object.id
    preview!.hidden = false
    const position = await computePosition(a, preview!, {
      strategy: "fixed",
      placement: "right-start",
      middleware: [offset(12), flip(), shift({ padding: 12, crossAxis: true })],
    })
    preview!.style.left = `${position.x}px`
    preview!.style.top = `${position.y}px`
  }
  function previewTarget(event: Event) {
    if (command!.open || (event.target instanceof Element && event.target.closest(".atom-preview")))
      return
    const a =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>("a[data-atom-id], a[data-object-id]")
        : null
    const object = a ? objects.get(a.dataset.atomId ?? a.dataset.objectId ?? "") : undefined
    if (!a || object?.kind !== "atom") return
    keyboardPreviewTarget = event.type === "focusin" ? a : undefined
    clearTimeout(hideTimer)
    clearTimeout(previewTimer)
    previewTimer = setTimeout(
      () => void showPreview(a, object),
      event.type === "focusin" ? 100 : 360,
    )
  }
  if (matchMedia("(hover: hover)").matches) document.addEventListener("pointerover", previewTarget)
  document.addEventListener("focusin", previewTarget)
  document.addEventListener("pointerout", (event) => {
    // A delayed touch pointerout must not cancel a keyboard-focused preview.
    if (keyboardPreviewTarget === document.activeElement) return
    if (event.relatedTarget instanceof Node && preview!.contains(event.relatedTarget)) return
    clearTimeout(previewTimer)
    hideTimer = setTimeout(() => {
      preview!.hidden = true
    }, 220)
  })
  document.addEventListener("focusout", (event) => {
    if (!keyboardPreviewTarget || event.target !== keyboardPreviewTarget) return
    if (event.relatedTarget instanceof Node && preview!.contains(event.relatedTarget)) return
    keyboardPreviewTarget = undefined
    clearTimeout(previewTimer)
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      preview!.hidden = true
    }, 220)
  })
  preview.addEventListener("pointerenter", () => clearTimeout(hideTimer))
  preview.addEventListener("focusin", () => clearTimeout(hideTimer))

  const enable = cq<HTMLButtonElement>("[data-model-enable]")
  const cancel = cq<HTMLButtonElement>("[data-model-cancel]")
  const modelStatus = cq<HTMLElement>("[data-model-status]")
  const progress = cq<HTMLProgressElement>("[data-model-progress]")
  enable.addEventListener("click", async () => {
    await semanticRequest
    if (!semantic) {
      modelStatus.textContent = "预计算索引暂不可用，请继续使用普通搜索。"
      return
    }
    if (!downloadReviewed) {
      cq("[data-model-description]").textContent =
        `模型：${semantic.model.id} · 模型文件 ${(semantic.model.downloadBytes / 1024 / 1024).toFixed(1)} MiB，另需约 21.5 MiB 本站运行资源。来源：Hugging Face 公开模型文件。仅在此设备缓存。`
      enable.textContent = "下载并启用本机语义搜索"
      downloadReviewed = true
      return
    }
    worker?.terminate()
    worker = new Worker(new URL("static/semantic/worker.js", siteRoot), { type: "module" })
    modelReady = false
    enable.disabled = true
    cancel.hidden = false
    progress.hidden = false
    modelStatus.textContent = "正在下载公开模型…"
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data
      if (data.type === "progress") {
        if (data.total) progress.value = Math.min(100, (100 * data.loaded) / data.total)
        modelStatus.textContent = `${data.phase ?? "准备模型"}${data.file ? ` · ${data.file}` : ""}`
      } else if (data.type === "ready") {
        modelReady = true
        cancel.hidden = true
        progress.hidden = true
        enable.disabled = false
        enable.textContent = "模型已就绪"
        modelStatus.textContent = "语义搜索在此设备运行，查询不会上传。"
        runSearch()
      } else if (data.type === "result" && data.requestId === String(querySequence)) {
        const lexical = search(input.value, eligible)
        const matches = data.matches
          .map((m: { id: string }) => objects.get(m.id))
          .filter((o: KnowledgeObject | undefined): o is KnowledgeObject => !!o && eligible(o))
        const unique = new Map(
          [...lexical.slice(0, 8), ...matches, ...lexical].map((o) => [o.id, o]),
        )
        drawResults([...unique.values()].slice(0, 45), true)
      } else if (data.type === "error") {
        modelReady = false
        cancel.hidden = true
        progress.hidden = true
        enable.disabled = false
        modelStatus.textContent = `模型暂不可用：${data.message}。普通搜索仍可使用。`
      } else if (data.type === "cleared") {
        modelReady = false
        modelStatus.textContent = "已清除本网站的模型缓存。"
      }
    }
    worker.onerror = () => {
      modelReady = false
      enable.disabled = false
      cancel.hidden = true
      progress.hidden = true
      modelStatus.textContent = "当前设备无法启动模型，已保留普通搜索。"
    }
    worker.postMessage({ type: "init", baseUrl: siteRoot.href })
  })
  cancel.addEventListener("click", () => {
    worker?.terminate()
    worker = undefined
    modelReady = false
    enable.disabled = false
    cancel.hidden = true
    progress.hidden = true
    modelStatus.textContent = "已取消模型加载，普通搜索与推荐可继续使用。"
  })
  cq("[data-model-clear]").addEventListener("click", async () => {
    worker?.terminate()
    worker = undefined
    modelReady = false
    enable.disabled = false
    cancel.hidden = true
    progress.hidden = true
    // Cache name belongs solely to this site and model subsystem; never clear
    // other origin caches, browser storage or a reader's unrelated models.
    const cacheName = semanticCacheName(siteRoot.href)
    await caches.delete(cacheName)
    modelStatus.textContent = "已清除本网站的模型缓存。"
    enable.textContent = "下载并启用本机语义搜索"
  })
  const graphRecommendations = () =>
    Object.entries(semantic?.recommendations ?? {}).flatMap(([source, entries]) =>
      entries.map((entry) => ({
        id: `similar:${source}:${entry.id}`,
        source,
        target: entry.id,
        type: "similar_to",
        provenance: "similarity" as const,
        score: entry.score,
        evidenceHref: objects.get(source)?.href,
      })),
    )
  void semanticRequest.then(() => {
    if (state.focus) renderContext(objects.get(state.focus)!)
    for (const graph of rootGraphs) graph.setRecommendations(graphRecommendations())
    localGraph?.setRecommendations(graphRecommendations())
  })
  window.addEventListener("pagehide", remember)
  let scrollTimer: ReturnType<typeof setTimeout> | undefined
  const saveScroll = () => {
    clearTimeout(scrollTimer)
    scrollTimer = setTimeout(() => {
      if (status.textContent) return
      if (!shell!.hidden) state.scroll = scrollArea().scrollTop
      else state.outerScroll = scrollY
      writeState()
    }, 120)
  }
  for (const surface of [window, focus, layout])
    surface.addEventListener("scroll", saveScroll, { passive: true })
  if (state.focus && objects.has(state.focus)) void show(state.focus, undefined, "restore")
  else {
    const initial = objectAt(location.href)
    if (initial?.kind === "atom") {
      state = {
        ...state,
        focus: initial.id,
        returnHref: initial.sourceHref ? urlFor(initial.sourceHref) : siteRoot.href,
        returnTitle: document.title,
      }
      writeState()
      void show(initial.id, undefined, "initial")
    }
  }
}
void initializeSpace()
