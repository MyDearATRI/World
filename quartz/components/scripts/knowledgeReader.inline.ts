import { bookResultHref, bookRoleLabels, type BookIndexData } from "../../util/bookSearch"

interface ReaderEntry {
  owner: string
  slug: string
  href: string
  depth: number
}
interface ReaderOpen {
  slug: string
  href?: string
  trigger?: HTMLElement | SVGElement
}

function initializeKnowledgeReader() {
  const dialog = document.querySelector<HTMLDialogElement>(".knowledge-reader")
  const context = document.querySelector<HTMLElement>("#reader-context")
  if (!dialog || !context || dialog.dataset.bound) return
  dialog.dataset.bound = "true"
  const panel = dialog
  const owner = `reader-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const rootPath = context.dataset.root || "."
  const siteRoot = new URL(`${rootPath.replace(/\/$/, "")}/`, document.baseURI)
  const body = panel.querySelector<HTMLElement>(".knowledge-reader-body")!
  const title = panel.querySelector<HTMLElement>("#knowledge-reader-title")!
  const location = panel.querySelector<HTMLElement>(".knowledge-reader-location")!
  const status = panel.querySelector<HTMLElement>(".knowledge-reader-status")!
  const independent = panel.querySelector<HTMLAnchorElement>(".knowledge-reader-independent")!
  const chapterLink = panel.querySelector<HTMLAnchorElement>(".knowledge-reader-chapter")!
  const back = panel.querySelector<HTMLButtonElement>(".knowledge-reader-back")!
  let catalog: BookIndexData["catalog"] | undefined
  let indexRequest: Promise<BookIndexData["catalog"]> | undefined
  let pending: AbortController | undefined
  let depth = 0
  let closing = false
  let queuedOpen: ReaderOpen | undefined
  let serial = 0
  let initialScroll = { x: 0, y: 0 }
  let initialFocus: HTMLElement | SVGElement | undefined

  async function loadCatalog() {
    if (catalog) return catalog
    indexRequest ??= fetch(new URL("static/bookIndex.json", siteRoot))
      .then(async (response) => {
        if (!response.ok) throw new Error("Cannot load the reading catalog")
        const index = (await response.json()) as BookIndexData
        if (index.version !== 2 || !index.catalog?.pages) throw new Error("Invalid reading catalog")
        catalog = index.catalog
        return catalog
      })
      .catch((error) => {
        indexRequest = undefined
        throw error
      })
    return indexRequest
  }

  function slugAt(href: string) {
    try {
      const url = new URL(href, document.baseURI)
      if (url.origin !== siteRoot.origin || !url.pathname.startsWith(siteRoot.pathname))
        return undefined
      const slug = decodeURIComponent(url.pathname.slice(siteRoot.pathname.length))
        .replace(/\.html$/, "")
        .replace(/\/$/, "")
      return catalog?.pages[slug]
        ? slug
        : catalog?.pages[`${slug}/index`]
          ? `${slug}/index`
          : slug || "index"
    } catch {
      return undefined
    }
  }

  // Use only the built article subtree. Prefix IDs, retarget local references,
  // and resolve resources against its own generated page rather than the host.
  function articleFrom(html: string, pageUrl: string, prefix: string): HTMLElement {
    const parsed = new DOMParser().parseFromString(html, "text/html")
    const article = parsed.querySelector<HTMLElement>(".markdown-content")
    if (!article) throw new Error("This page has no readable article")
    article
      .querySelectorAll(
        "script, style, link, meta, base, iframe, object, embed, form, .reading-sequence, .book-discovery, .knowledge-reader",
      )
      .forEach((item) => item.remove())
    const ids = new Map<string, string>()
    for (const item of [article, ...article.querySelectorAll<HTMLElement>("[id]")]) {
      if (item.id) {
        ids.set(item.id, `${prefix}-${item.id}`)
        item.id = ids.get(item.id)!
      }
    }
    article.removeAttribute("tabindex")
    for (const item of [article, ...article.querySelectorAll<HTMLElement>("*")]) {
      for (const attr of [...item.attributes]) {
        if (/^on/i.test(attr.name) || attr.name === "srcdoc") item.removeAttribute(attr.name)
      }
      for (const attr of [
        "aria-labelledby",
        "aria-describedby",
        "aria-controls",
        "for",
        "headers",
      ]) {
        const value = item.getAttribute(attr)
        if (value)
          item.setAttribute(
            attr,
            value
              .split(/\s+/)
              .map((id) => ids.get(id) ?? id)
              .join(" "),
          )
      }
      for (const attr of ["href", "src", "poster", "xlink:href"]) {
        const value = item.getAttribute(attr)
        if (!value) continue
        try {
          const url = new URL(value, pageUrl)
          if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
            item.removeAttribute(attr)
            continue
          }
          const local = new URL(pageUrl)
          if (url.origin === local.origin && url.pathname === local.pathname && url.hash) {
            const target = ids.get(decodeURIComponent(url.hash.slice(1)))
            if (target) {
              item.setAttribute(attr, `#${target}`)
              continue
            }
          }
          item.setAttribute(attr, url.href)
        } catch {
          item.removeAttribute(attr)
        }
      }
      const srcset = item.getAttribute("srcset")
      if (srcset)
        item.setAttribute(
          "srcset",
          srcset
            .split(",")
            .map((candidate) => {
              const [source, ...descriptor] = candidate.trim().split(/\s+/)
              try {
                const url = new URL(source, pageUrl)
                return /^https?:$/.test(url.protocol) ? [url.href, ...descriptor].join(" ") : ""
              } catch {
                return ""
              }
            })
            .filter(Boolean)
            .join(", "),
        )
    }
    const wrapper = document.createElement("article")
    wrapper.className = "knowledge-reader-article"
    wrapper.append(document.importNode(article, true))
    return wrapper
  }

  async function render(entry: ReaderEntry) {
    pending?.abort()
    const request = new AbortController()
    pending = request
    depth = entry.depth
    back.disabled = depth <= 1
    body.replaceChildren()
    status.textContent = "正在读取知识条目…"
    independent.href = entry.href
    chapterLink.hidden = true
    title.textContent = catalog?.pages[entry.slug]?.title ?? "知识条目"
    location.textContent = ""
    if (!panel.open) panel.showModal()
    panel.scrollTop = 0
    panel
      .querySelector<HTMLButtonElement>(".knowledge-reader-close")!
      .focus({ preventScroll: true })
    const renderSerial = ++serial
    try {
      const data = await loadCatalog()
      const page = data.pages[entry.slug]
      const book = data.books.find((item) => item.id === page?.bookId)
      const chapter = book?.chapters.find((item) => item.id === page?.chapterId)
      title.textContent = page?.title ?? "知识条目"
      location.textContent = [
        book?.title,
        chapter?.title,
        bookRoleLabels[page?.role ?? "knowledge"],
      ]
        .filter(Boolean)
        .join(" / ")
      if (chapter) {
        chapterLink.href = bookResultHref(siteRoot, chapter.slug)
        chapterLink.hidden = false
      }
      const response = await fetch(entry.href, { signal: request.signal })
      if (!response.ok) throw new Error(`Article returned ${response.status}`)
      const article = articleFrom(await response.text(), response.url, `knowledge-${renderSerial}`)
      if (request.signal.aborted || renderSerial !== serial || !panel.open) return
      body.replaceChildren(article)
      status.textContent = ""
      if (new URL(entry.href).hash) {
        const target = article.querySelector(
          `#${CSS.escape(`knowledge-${renderSerial}-${decodeURIComponent(new URL(entry.href).hash.slice(1))}`)}`,
        )
        target?.scrollIntoView({ block: "start" })
      }
    } catch (error) {
      if (request.signal.aborted || renderSerial !== serial) return
      status.textContent = "这条内容暂时无法加载。可以独立打开页面，或关闭面板继续阅读。"
      body.replaceChildren()
      console.info(
        "Knowledge reader could not load the article",
        error instanceof Error ? error.message : error,
      )
    }
  }

  function finishClose() {
    pending?.abort()
    serial++
    if (panel.open) panel.close()
    depth = 0
    if (initialFocus?.isConnected) initialFocus.focus({ preventScroll: true })
    window.scrollTo(initialScroll.x, initialScroll.y)
  }
  function close() {
    const entry = history.state?.knowledgeReader as ReaderEntry | undefined
    const remove = entry?.owner === owner ? entry.depth : 0
    closing = remove > 0
    finishClose()
    if (remove) history.go(-remove)
  }
  async function open(detail: ReaderOpen) {
    if (closing) {
      queuedOpen = detail
      return
    }
    const slug = detail.slug
    let href: string
    try {
      href = bookResultHref(siteRoot, slug)
      if (detail.href) {
        const requested = new URL(detail.href, document.baseURI)
        if (slugAt(requested.href) === slug) href += requested.hash
      }
    } catch {
      return
    }
    if (!panel.open) {
      initialFocus =
        detail.trigger ??
        (document.activeElement instanceof HTMLElement ? document.activeElement : undefined)
      initialScroll = { x: window.scrollX, y: window.scrollY }
      // A graph dialog remains beneath this native top-layer dialog. Closing the
      // reader returns focus to its original node without rebuilding the graph.
    }
    const entry: ReaderEntry = { owner, slug, href, depth: depth + 1 }
    history.pushState({ ...history.state, knowledgeReader: entry }, "", window.location.href)
    void render(entry)
  }

  panel.querySelector(".knowledge-reader-close")!.addEventListener("click", close)
  panel.addEventListener("cancel", (event) => {
    event.preventDefault()
    close()
  })
  back.addEventListener("click", () => {
    if (depth > 1) history.back()
  })
  window.addEventListener("popstate", (event) => {
    if (closing) {
      closing = false
      if (queuedOpen) {
        const detail = queuedOpen
        queuedOpen = undefined
        void open(detail)
      }
      return
    }
    const entry = event.state?.knowledgeReader as ReaderEntry | undefined
    if (entry?.owner === owner) void render(entry)
    else if (panel.open) finishClose()
  })
  document.addEventListener("reader:open", (event) => {
    const detail = (event as CustomEvent<ReaderOpen>).detail
    if (detail?.slug) void open(detail)
  })
  document.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return
    const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]")
    if (
      !link ||
      link.target === "_blank" ||
      link.hasAttribute("download") ||
      link.hasAttribute("data-reader-independent")
    )
      return
    const href = link.getAttribute("href")!
    if (href.startsWith("#")) {
      if (panel.contains(link)) {
        const target = document.getElementById(decodeURIComponent(href.slice(1)))
        if (target && panel.contains(target)) {
          event.preventDefault()
          target.scrollIntoView({ block: "start" })
        }
      }
      return
    }
    const slug = link.dataset.readerSlug ?? slugAt(link.href)
    if (
      !slug ||
      (!link.dataset.readerSlug &&
        (!link.closest(".markdown-content") || catalog?.pages[slug]?.role !== "knowledge"))
    )
      return
    event.preventDefault()
    void open({ slug, href: link.href, trigger: link })
  })
  // This is the same locally generated index used by search; load it in advance
  // so ordinary article links can be classified without delaying navigation.
  void loadCatalog().catch(() => {})
}

document.addEventListener("nav", initializeKnowledgeReader)
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initializeKnowledgeReader)
else initializeKnowledgeReader()
