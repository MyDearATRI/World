document.addEventListener("nav", () => {
  const directory = document.querySelector<HTMLDetailsElement>(".book-directory")
  const wide = matchMedia("(min-width: 1280px)")
  const adapt = () => {
    if (directory) directory.open = wide.matches
  }
  adapt()
  wide.addEventListener("change", adapt)
  window.addCleanup(() => wide.removeEventListener("change", adapt))

  const concepts = document.querySelector<HTMLDetailsElement>(".section-knowledge")
  const phone = matchMedia("(max-width: 600px)")
  const adaptConcepts = () => {
    if (concepts) concepts.open = !phone.matches
  }
  adaptConcepts()
  phone.addEventListener("change", adaptConcepts)
  window.addCleanup(() => phone.removeEventListener("change", adaptConcepts))

  // Existing links into the preserved source navigation must still reveal their target.
  const revealHash = () => {
    if (!location.hash) return
    let target: HTMLElement | null = null
    try {
      target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
    } catch {
      return
    }
    if (!target) return
    let parent: HTMLElement | null = target.parentElement
    let opened = false
    while (parent) {
      if (parent instanceof HTMLDetailsElement && !parent.open) {
        parent.open = true
        opened = true
      }
      parent = parent.parentElement
    }
    if (opened) target.scrollIntoView({ block: "start" })
  }
  revealHash()
  window.addEventListener("hashchange", revealHash)
  window.addCleanup(() => window.removeEventListener("hashchange", revealHash))

  document.querySelectorAll<HTMLElement>(".knowledge-index").forEach((index) => {
    const input = index.querySelector<HTMLInputElement>(".knowledge-filter")!
    const rows = [...index.querySelectorAll<HTMLElement>(".knowledge-index-item")]
    const status = index.querySelector<HTMLElement>(".knowledge-filter-status")!
    const empty = index.querySelector<HTMLElement>(".knowledge-empty")!
    const normalize = (s: string) => s.normalize("NFKC").toLocaleLowerCase()
    const labels = new Map(
      rows.map((row) => [row.dataset.knowledgeSlug!, normalize(row.textContent ?? "")]),
    )
    const filter = () => {
      const words = normalize(input.value.trim()).split(/\s+/).filter(Boolean)
      let count = 0
      rows.forEach((row) => {
        row.hidden = !words.every((word) => labels.get(row.dataset.knowledgeSlug!)?.includes(word))
        if (!row.hidden) count++
      })
      index.querySelectorAll<HTMLElement>(".knowledge-group").forEach((group) => {
        group.hidden = !group.querySelector(".knowledge-index-item:not([hidden])")
      })
      status.textContent = `${count} 个知识点${input.value ? "匹配" : ""}`
      empty.hidden = count > 0
    }
    input.addEventListener("input", filter)
    filter()
    const root = document.querySelector<HTMLElement>("#reader-context")?.dataset.root ?? "."
    void fetch(new URL(`${root}/static/bookIndex.json`, document.baseURI))
      .then((response) => {
        if (!response.ok) throw new Error("Index unavailable")
        return response.json()
      })
      .then((data) => {
        for (const doc of data.documents ?? []) {
          if (labels.has(doc.slug) && Array.isArray(doc.aliases))
            labels.set(
              doc.slug,
              `${labels.get(doc.slug)} ${normalize(doc.aliases.filter((s: unknown) => typeof s === "string").join(" "))}`,
            )
        }
        filter()
      })
      .catch(() => {
        input.placeholder = "筛选名称或节号"
      })
  })

  document.querySelectorAll<HTMLElement>(".canvas-reading-map").forEach((map) => {
    const svg = map.querySelector<SVGSVGElement>("svg")
    if (!svg || map.dataset.viewerBound) return
    map.dataset.viewerBound = "true"
    const open = document.createElement("button")
    open.type = "button"
    open.className = "canvas-open"
    open.textContent = "放大查看关系白板"
    open.setAttribute("aria-haspopup", "dialog")
    map.prepend(open)
    const dialog = document.createElement("dialog")
    dialog.className = "canvas-viewer"
    dialog.setAttribute("aria-label", svg.getAttribute("aria-label") ?? "关系白板")
    const toolbar = document.createElement("div")
    toolbar.className = "canvas-viewer-toolbar"
    const viewport = document.createElement("div")
    viewport.className = "canvas-viewport"
    const close = document.createElement("button")
    close.type = "button"
    close.textContent = "关闭白板"
    const minus = document.createElement("button"),
      plus = document.createElement("button"),
      fit = document.createElement("button")
    minus.textContent = "缩小"
    plus.textContent = "放大"
    fit.textContent = "适应视图"
    toolbar.append(minus, plus, fit, close)
    dialog.append(toolbar, viewport)
    document.body.append(dialog)
    let size = 0
    const originalStyle = svg.getAttribute("style") ?? ""
    const resize = (width: number) => {
      size = Math.max(200, Math.min(20000, width))
      svg.style.width = `${size}px`
      svg.style.maxHeight = "none"
      svg.style.maxWidth = "none"
      svg.style.height = "auto"
    }
    open.addEventListener("click", () => {
      viewport.append(svg)
      dialog.showModal()
      document.documentElement.classList.add("canvas-active")
      resize(viewport.clientWidth)
      close.focus()
    })
    plus.addEventListener("click", () => resize(size * 1.4))
    minus.addEventListener("click", () => resize(size / 1.4))
    fit.addEventListener("click", () => resize(viewport.clientWidth))
    close.addEventListener("click", () => dialog.close())
    dialog.addEventListener("close", () => {
      map.append(svg)
      svg.setAttribute("style", originalStyle)
      document.documentElement.classList.remove("canvas-active")
      open.focus()
    })
    dialog.addEventListener("keydown", (event) => {
      if (event.key !== "Tab") return
      const items = [...dialog.querySelectorAll<HTMLElement>("button, a[href]")].filter(
        (element) => element.getClientRects().length,
      )
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault()
        items.at(-1)?.focus()
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault()
        items[0]?.focus()
      }
    })
    window.addCleanup(() => {
      if (dialog.open) dialog.close()
      dialog.remove()
    })
  })
})
