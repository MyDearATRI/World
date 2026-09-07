// Progressive enhancement only: native disclosures, dialog focus and history
// remain owned by the browser and the existing reading/search/graph scripts.
let disposeInterfaceMotion: (() => void) | undefined

function installInterfaceMotion() {
  disposeInterfaceMotion?.()
  const html = document.documentElement
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  const dialogSelector = ".knowledge-reader, .book-search-dialog, .note-graph-dialog"
  const entrances = new Map<HTMLDialogElement, Animation>()
  const openStates = new WeakMap<HTMLDialogElement, boolean>()
  const frames = new Set<number>()
  let disposed = false

  function nextFrame(callback: () => void) {
    const id = requestAnimationFrame(() => {
      frames.delete(id)
      if (!disposed) callback()
    })
    frames.add(id)
    return id
  }

  // Both open and closed states stay native. ::details-content keeps the
  // closing content painted for its discrete transition without retaining open
  // in JavaScript, intercepting summary clicks, or postponing accessibility state.
  const supportsDisclosureMotion =
    CSS.supports("selector(details::details-content)") &&
    CSS.supports("interpolate-size", "allow-keywords") &&
    CSS.supports("transition-behavior", "allow-discrete")
  const style = document.createElement("style")
  style.dataset.interfaceMotion = "true"
  if (supportsDisclosureMotion) {
    style.textContent = `
      @media (prefers-reduced-motion: no-preference) {
        .interface-motion-ready details::details-content {
          interpolate-size: allow-keywords;
          block-size: 0;
          overflow: clip;
          transition: block-size 180ms cubic-bezier(.2,.75,.25,1),
                      content-visibility 180ms allow-discrete;
        }
        .interface-motion-ready details[open]::details-content { block-size: auto; }
        .interface-motion-ready.interface-motion-instant details::details-content {
          transition: none;
        }
      }
    `
    document.head.append(style)
    html.classList.add("interface-motion-ready")
  }

  let hashRelease: number | undefined
  function immediateDisclosure() {
    html.classList.add("interface-motion-instant")
    if (hashRelease !== undefined) {
      cancelAnimationFrame(hashRelease)
      frames.delete(hashRelease)
    }
    // Give the existing hash revealer a complete style/layout opportunity. No
    // scroll is requested here, and the native open state is never rewritten.
    hashRelease = nextFrame(() => {
      hashRelease = nextFrame(() => {
        html.classList.remove("interface-motion-instant")
        hashRelease = undefined
      })
    })
  }
  immediateDisclosure()
  window.addEventListener("hashchange", immediateDisclosure, { capture: true })

  function observeDialog(dialog: HTMLDialogElement) {
    const wasOpen = openStates.get(dialog) ?? false
    openStates.set(dialog, dialog.open)
    if (!dialog.open) {
      entrances.get(dialog)?.cancel()
      entrances.delete(dialog)
      return
    }
    if (wasOpen || reduced.matches || typeof dialog.animate !== "function") return
    entrances.get(dialog)?.cancel()
    const drawer = dialog.classList.contains("knowledge-reader")
    // Individual transform properties preserve any layout transform supplied by
    // the theme. No exit animation delays close(), Escape or history traversal.
    const animation = dialog.animate(
      [
        { opacity: 0.45, translate: `0 ${drawer ? 8 : 6}px`, scale: drawer ? "1" : ".99" },
        { opacity: 1, translate: "0 0", scale: "1" },
      ],
      { duration: 180, easing: "cubic-bezier(.2,.75,.25,1)" },
    )
    entrances.set(dialog, animation)
    const forget = () => {
      if (entrances.get(dialog) === animation) entrances.delete(dialog)
    }
    animation.addEventListener("finish", forget, { once: true })
    animation.addEventListener("cancel", forget, { once: true })
  }
  document.querySelectorAll<HTMLDialogElement>(dialogSelector).forEach((dialog) => {
    openStates.set(dialog, dialog.open)
  })
  const observer = new MutationObserver((records) => {
    const changed = new Set<HTMLDialogElement>()
    for (const record of records) {
      if (record.target instanceof HTMLDialogElement && record.target.matches(dialogSelector)) {
        changed.add(record.target)
      }
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue
        if (node instanceof HTMLDialogElement && node.matches(dialogSelector)) changed.add(node)
        node
          .querySelectorAll<HTMLDialogElement>(dialogSelector)
          .forEach((dialog) => changed.add(dialog))
      }
    }
    changed.forEach(observeDialog)
  })
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
    childList: true,
  })
  const honorReducedMotion = () => {
    if (reduced.matches) {
      entrances.forEach((animation) => animation.cancel())
      entrances.clear()
    }
  }
  reduced.addEventListener("change", honorReducedMotion)

  // The book's three long reading regions use a location indicator, not a tab
  // widget: these remain ordinary anchors and never manipulate scroll or URLs.
  const regions = [
    ...document.querySelectorAll<HTMLAnchorElement>('.book-view-nav a[href^="#"]'),
  ].flatMap((link) => {
    try {
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)))
      return target ? [{ link, target, original: link.getAttribute("aria-current") }] : []
    } catch {
      return []
    }
  })
  let current: HTMLAnchorElement | undefined
  let locationFrame: number | undefined
  const updateLocation = () => {
    locationFrame = undefined
    if (!regions.length) return
    let active = regions[0]
    for (const region of regions) {
      if (region.target.getBoundingClientRect().top <= 120) active = region
    }
    if (current === active.link) return
    for (const region of regions) {
      if (region.link === active.link) region.link.setAttribute("aria-current", "location")
      else region.link.removeAttribute("aria-current")
    }
    current = active.link
  }
  const scheduleLocation = () => {
    if (locationFrame === undefined && regions.length) locationFrame = nextFrame(updateLocation)
  }
  window.addEventListener("scroll", scheduleLocation, { passive: true })
  window.addEventListener("resize", scheduleLocation, { passive: true })
  document.addEventListener("toggle", scheduleLocation, { capture: true })
  document.addEventListener("transitionend", scheduleLocation, { capture: true })
  scheduleLocation()

  const cleanup = () => {
    if (disposed) return
    disposed = true
    observer.disconnect()
    entrances.forEach((animation) => animation.cancel())
    entrances.clear()
    frames.forEach(cancelAnimationFrame)
    frames.clear()
    reduced.removeEventListener("change", honorReducedMotion)
    window.removeEventListener("hashchange", immediateDisclosure, { capture: true })
    window.removeEventListener("scroll", scheduleLocation)
    window.removeEventListener("resize", scheduleLocation)
    document.removeEventListener("toggle", scheduleLocation, { capture: true })
    document.removeEventListener("transitionend", scheduleLocation, { capture: true })
    regions.forEach(({ link, original }) => {
      if (original === null) link.removeAttribute("aria-current")
      else link.setAttribute("aria-current", original)
    })
    html.classList.remove("interface-motion-ready", "interface-motion-instant")
    style.remove()
  }
  disposeInterfaceMotion = cleanup
  window.addCleanup(cleanup)
}

document.addEventListener("nav", installInterfaceMotion)
