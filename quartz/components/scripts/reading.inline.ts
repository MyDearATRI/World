document.addEventListener("nav", () => {
  const directory = document.querySelector<HTMLDetailsElement>(".book-directory")
  if (!directory) return
  const wide = matchMedia("(min-width: 1280px)")
  const adapt = () => {
    directory.open = wide.matches
  }
  adapt()
  wide.addEventListener("change", adapt)
  window.addCleanup(() => wide.removeEventListener("change", adapt))

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
