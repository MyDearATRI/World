import type { KnowledgeModel } from "../../../util/topos/types"
import { topicIDs } from "../../../util/topos/topics"

export function createTopicSidebar(
  model: KnowledgeModel,
  callbacks: {
    select: (ids: string[]) => void
    focus: (id: string) => void
  },
) {
  if (!model.topics?.length) return undefined
  const mobile = matchMedia("(max-width: 760px)")
  let compact = false
  const isDrawer = () => mobile.matches || compact
  const dialog = document.createElement("dialog")
  dialog.className = "topos-topic-sidebar"
  dialog.id = "topos-topics"
  dialog.setAttribute("aria-label", "选择数学主题")
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text = "",
    parent: HTMLElement = dialog,
  ) => {
    const el = document.createElement(tag)
    el.textContent = text
    parent.append(el)
    return el
  }
  const header = add("header")
  add("span", "KNOWLEDGE TOPOS", header)
  const close = add("button", "关闭", header)
  close.type = "button"
  close.dataset.closeTopics = "true"
  const nav = add("nav")
  nav.setAttribute("aria-label", "知识范围")
  for (const [href, label, active] of [
    ["./topos.html", "已有笔记", model.mode === "published"],
    ["./atlas.html", "数学地图", model.mode === "atlas"],
  ] as const) {
    const link = add("a", label, nav)
    link.href = href
    if (active) link.setAttribute("aria-current", "page")
  }
  add("h2", "从主题开始")
  add(
    "p",
    model.mode === "atlas"
      ? "勾选领域，展开标题与分类联系。这里的标题不代表已有笔记。"
      : "勾选主题，让对应的知识点与原文联系出现在右侧。",
  )
  const commands = add("div")
  commands.className = "topos-topic-commands"
  const all = add("button", "全选", commands),
    clear = add("button", "清空", commands)
  all.type = clear.type = "button"
  const fields = add("fieldset")
  add("legend", "显示主题", fields)
  const inputs = new Map<string, HTMLInputElement>()
  for (const topic of model.topics) {
    const label = add("label", "", fields)
    label.style.setProperty("--topic-color", topic.color)
    const checkbox = add("input", "", label)
    checkbox.type = "checkbox"
    checkbox.value = topic.id
    checkbox.dataset.topic = topic.id
    const text = add("span", topic.title, label)
    text.title = topic.description
    const count = model.concepts.filter((n) => n.topicIDs?.includes(topic.id)).length
    add("small", String(count), label).setAttribute(
      "aria-label",
      `${count} 个节点，跨主题节点可重复归属`,
    )
    inputs.set(topic.id, checkbox)
    checkbox.addEventListener("change", () =>
      callbacks.select([...inputs].filter(([, n]) => n.checked).map(([id]) => id)),
    )
  }
  const status = add("p")
  status.className = "topos-topic-count"
  status.setAttribute("role", "status")
  const details = add("details")
  details.className = "topos-topic-directory"
  add("summary", "在选中主题中定位", details)
  const query = add("input", "", details)
  query.type = "search"
  query.placeholder = "筛选节点名称"
  query.setAttribute("aria-label", "在选中主题中筛选节点")
  const results = add("div", "", details)
  const footer = add("footer")
  const library = add("a", "按书连续阅读 ↗", footer)
  library.href = "./library.html"
  add(
    "small",
    model.mode === "atlas" ? "连线：分类归属 · 非数学推导" : "连线：原文引用、出处或有依据的论证",
    footer,
  )
  const open = document.createElement("button")
  open.className = "topos-topics-trigger"
  open.textContent = "主题"
  open.type = "button"
  open.setAttribute("aria-controls", dialog.id)
  open.setAttribute("aria-expanded", "false")
  document.body.prepend(dialog, open)
  document.body.classList.add("has-topic-sidebar")
  let selected: string[] | undefined
  let focused: string | undefined
  let navigating = false
  const redrawList = () => {
    results.replaceChildren()
    const allowed = topicIDs(model, selected),
      q = query.value.trim().toLocaleLowerCase()
    const nodes = model.concepts.filter(
      (n) =>
        allowed.has(n.id) &&
        `${n.title} ${n.zh} ${n.aliases?.join(" ") ?? ""}`.toLocaleLowerCase().includes(q),
    )
    if (!nodes.length) add("p", "没有匹配节点。试试其他名称或勾选更多主题。", results)
    for (const node of nodes) {
      const link = add("a", node.title, results)
      link.href = node.href ?? `#focus=${encodeURIComponent(node.id)}`
      link.style.setProperty("--topic-color", node.color ?? "#647b80")
      link.dataset.topicNode = node.id
      if (node.id === focused) link.setAttribute("aria-current", "true")
      link.addEventListener("click", (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        if (isDrawer()) {
          navigating = true
          dialog.close()
        }
        callbacks.focus(node.id)
      })
    }
  }
  query.addEventListener("input", redrawList)
  details.addEventListener("toggle", () => {
    if (details.open) redrawList()
  })
  all.addEventListener("click", () => callbacks.select(model.topics!.map((t) => t.id)))
  clear.addEventListener("click", () => callbacks.select([]))
  open.addEventListener("click", () => {
    navigating = false
    dialog.showModal()
    open.setAttribute("aria-expanded", "true")
  })
  close.addEventListener("click", () => dialog.close())
  dialog.addEventListener("cancel", (event) => {
    if (!isDrawer()) event.preventDefault()
  })
  dialog.addEventListener("keydown", (event) => {
    if (!dialog.matches(":modal") || event.key !== "Tab") return
    const available = [
      ...dialog.querySelectorAll<HTMLElement>("a[href],button,input,summary,[tabindex]"),
    ].filter((el) => el.tabIndex >= 0 && !el.matches(":disabled") && el.getClientRects().length > 0)
    const first = available[0],
      last = available.at(-1)
    if (!first || !last) return
    if (
      event.shiftKey &&
      (document.activeElement === first || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      last.focus()
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !dialog.contains(document.activeElement))
    ) {
      event.preventDefault()
      first.focus()
    }
  })
  dialog.addEventListener("close", () => {
    open.setAttribute("aria-expanded", "false")
    if (isDrawer() && !navigating) open.focus()
  })
  function resize() {
    if (dialog.open) dialog.close()
    if (!isDrawer()) dialog.show()
    close.hidden = !isDrawer()
    open.hidden = !isDrawer()
  }
  resize()
  mobile.addEventListener("change", resize)
  return {
    setCompact(value: boolean) {
      if (compact === value) return
      const wasDrawer = isDrawer()
      compact = value
      dialog.dataset.compact = String(value)
      // Mobile stays a drawer while selecting several themes, even as the
      // underlying reading changes to the overview.
      if (wasDrawer === isDrawer()) return
      // Switching layouts must not steal focus from the object being opened.
      navigating = true
      resize()
    },
    update(selection: string[] | undefined, focus: string) {
      if (
        focus === focused &&
        (selection === selected ||
          (selection !== undefined &&
            selected !== undefined &&
            selection.length === selected.length &&
            selection.every((id, i) => id === selected![i])))
      )
        return
      selected = selection
      focused = focus
      for (const [id, input] of inputs)
        input.checked = selected === undefined || selected.includes(id)
      const allowed = topicIDs(model, selection)
      const edges = model.relations.filter((r) => allowed.has(r.source) && allowed.has(r.target))
      status.textContent = `${allowed.size} 个独立节点 · ${edges.length} 条联系`
      if (details.open) redrawList()
    },
  }
}
