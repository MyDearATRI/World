import {
  bookHighlightParts,
  bookKindLabels,
  bookResultHref,
  bookSnippet,
  createBookSearch,
  type BookFilter,
  type BookIndexData,
} from "../../util/bookSearch"

const loaded = new Map<string, Promise<ReturnType<typeof createBookSearch>>>()

function initializeBookSearch(root: HTMLElement) {
  if (root.dataset.searchBound) return
  root.dataset.searchBound = "true"
  const dialog = root.querySelector<HTMLDialogElement>(".book-search-dialog")!
  const launch = root.querySelector<HTMLFormElement>(".book-search-launch")!
  const opener = root.querySelector<HTMLInputElement>(".book-search-launch-input")!
  const input = root.querySelector<HTMLInputElement>(".book-search-query")!
  const closer = root.querySelector<HTMLButtonElement>(".book-search-close")!
  const results = root.querySelector<HTMLUListElement>(".book-search-results")!
  const status = root.querySelector<HTMLElement>(".book-search-status")!
  const filters = [...root.querySelectorAll<HTMLButtonElement>("[data-search-filter]")]
  const indexUrl = new URL(root.dataset.searchIndex!, document.baseURI)
  const siteRoot = new URL("../", indexUrl)
  let filter: BookFilter = "all"
  let selected = -1
  let previousFocus: HTMLElement = opener
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined

  function highlight(target: HTMLElement, text: string, query: string) {
    for (const part of bookHighlightParts(text, query)) {
      if (part.match) {
        const mark = document.createElement("mark")
        mark.textContent = part.text
        target.append(mark)
      } else target.append(document.createTextNode(part.text))
    }
  }

  function select(index: number) {
    const items = [...results.querySelectorAll<HTMLAnchorElement>("a")]
    selected = items.length ? (index + items.length) % items.length : -1
    items.forEach((item, at) => item.setAttribute("aria-selected", String(at === selected)))
    if (selected < 0) input.removeAttribute("aria-activedescendant")
    else {
      input.setAttribute("aria-activedescendant", items[selected].id)
      items[selected].scrollIntoView({ block: "nearest" })
    }
  }

  async function search() {
    const ownGeneration = ++generation
    const query = input.value.trim()
    results.replaceChildren()
    select(-1)
    input.setAttribute("aria-expanded", "false")
    if (!query) {
      status.textContent = "输入关键词，搜索公开教材。"
      return
    }
    status.textContent = "正在搜索…"
    try {
      if (!loaded.has(indexUrl.href)) {
        loaded.set(
          indexUrl.href,
          fetch(indexUrl)
            .then(async (response) => {
              if (!response.ok) throw new Error("Search index unavailable")
              const data = (await response.json()) as BookIndexData
              if (data.version !== 1 || !Array.isArray(data.documents))
                throw new Error("Invalid search index")
              return createBookSearch(data.documents)
            })
            .catch((error) => {
              loaded.delete(indexUrl.href)
              throw error
            }),
        )
      }
      const engine = await loaded.get(indexUrl.href)!
      if (ownGeneration !== generation || !dialog.open) return
      const matches = engine(query, filter)
      status.textContent = matches.length
        ? `${matches.length}${matches.length === 40 ? "+" : ""} 条结果`
        : "没有找到匹配内容。试试别名、英文术语或切换到“全部”。"
      for (const [at, match] of matches.entries()) {
        const li = document.createElement("li")
        li.setAttribute("role", "presentation")
        const link = document.createElement("a")
        link.className = "book-search-result"
        link.id = `book-search-result-${at}`
        link.href = bookResultHref(siteRoot, match.slug)
        link.setAttribute("role", "option")
        link.setAttribute("aria-selected", "false")
        link.dataset.kind = match.kind
        const title = document.createElement("span")
        title.className = "book-search-result-title"
        highlight(title, match.title, query)
        const meta = document.createElement("span")
        meta.className = "book-search-result-meta"
        meta.textContent = [bookKindLabels[match.kind], match.status, match.layer, match.type]
          .filter(Boolean)
          .join(" · ")
        const path = document.createElement("span")
        path.className = "book-search-result-path"
        path.textContent = match.slug
        const snippet = document.createElement("span")
        snippet.className = "book-search-result-snippet"
        highlight(snippet, bookSnippet(match, query), query)
        link.append(title, meta, path, snippet)
        li.append(link)
        results.append(li)
      }
      input.setAttribute("aria-expanded", String(matches.length > 0))
    } catch {
      if (ownGeneration === generation)
        status.textContent = "搜索索引暂时无法读取，请稍后重试。文章仍可通过目录阅读。"
    }
  }

  function open() {
    if (dialog.open || document.querySelector("dialog[open]")) return
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : opener
    input.value = opener.value
    dialog.showModal()
    input.focus()
    void search()
  }
  launch.addEventListener("submit", (event) => {
    event.preventDefault()
    open()
  })
  opener.addEventListener("click", open)
  opener.addEventListener("input", open)
  closer.addEventListener("click", () => dialog.close())
  dialog.addEventListener("close", () => {
    generation++
    clearTimeout(timer)
    opener.value = input.value
    previousFocus.focus()
  })
  input.addEventListener("input", (event) => {
    if ((event as InputEvent).isComposing) return
    // A quick Enter after changing the query must never open an old result
    // while the next debounced search is waiting to run.
    generation++
    results.replaceChildren()
    select(-1)
    input.setAttribute("aria-expanded", "false")
    status.textContent = input.value.trim() ? "正在搜索…" : "输入关键词，搜索公开教材。"
    clearTimeout(timer)
    timer = setTimeout(() => void search(), 100)
  })
  input.addEventListener("compositionend", () => void search())
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      select(
        selected < 0
          ? event.key === "ArrowDown"
            ? 0
            : -1
          : selected + (event.key === "ArrowDown" ? 1 : -1),
      )
    } else if (event.key === "Enter") {
      const items = [...results.querySelectorAll<HTMLAnchorElement>("a")]
      const target = items[selected < 0 ? 0 : selected]
      if (target) {
        event.preventDefault()
        target.click()
      }
    }
  })
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.searchFilter as BookFilter
      filters.forEach((item) => item.setAttribute("aria-pressed", String(item === button)))
      void search()
    }),
  )
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault()
      if (dialog.open) input.focus()
      else open()
    }
  })
}

function initializeAllBookSearch() {
  document.querySelectorAll<HTMLElement>(".book-search").forEach(initializeBookSearch)
}
document.addEventListener("nav", initializeAllBookSearch)
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initializeAllBookSearch)
else initializeAllBookSearch()
