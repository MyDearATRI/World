import FlexSearch from "flexsearch"
import type { QuartzPluginData } from "../plugins/vfile"
import type { ReaderCatalog } from "./readerCatalog"
import type { Root, RootContent } from "hast"

export type BookKind = "body" | "plan" | "example" | "navigation"
export type BookFilter = "all" | "body" | "plan" | "example"
export interface BookDocument {
  slug: string
  title: string
  aliases: string[]
  headings: string[]
  text: string
  tags: string[]
  kind: BookKind
  status: string
  layer: string
  type: string
  bookId?: string
  bookTitle: string
  chapterTitle: string
  role: string
  auxiliary: boolean
  snippetText?: string
}
export interface BookIndexData {
  version: 2
  documents: BookDocument[]
  catalog: ReaderCatalog
}
export interface BookSearchOptions {
  bookId?: string
  includeAuxiliary?: boolean
  filter?: BookFilter
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : []
const scalar = (value: unknown) => (typeof value === "string" ? value : "")
export const normalizeSearch = (value: string) => value.normalize("NFKC").toLocaleLowerCase()

// FlexSearch 0.8.205 accepts a custom encode function. Individual Han characters
// preserve Chinese substring queries; Latin words retain forward-prefix matching.
export function bookSearchTokens(value: string): string[] {
  return normalizeSearch(value).match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? []
}

export function buildBookDocuments(
  files: QuartzPluginData[],
  catalog?: ReaderCatalog,
): BookDocument[] {
  return files
    .filter((file) => file.slug && file.frontmatter?.siteKind !== "canvas")
    .map((file): BookDocument => {
      const meta = file.frontmatter
      const rawKind = scalar(meta?.siteKind)
      const page = catalog?.pages[file.slug!]
      const book = catalog?.books.find((item) => item.id === page?.bookId)
      const chapter = book?.chapters.find((item) => item.id === page?.chapterId)
      const kind: BookKind = ["body", "plan", "example", "navigation"].includes(rawKind)
        ? (rawKind as BookKind)
        : meta?.sample
          ? "example"
          : "body"
      return {
        slug: file.slug!,
        title: scalar(meta?.title) || file.slug!,
        aliases: strings(meta?.aliases),
        headings: (file.toc ?? []).map((heading) => heading.text),
        text: (file.text ?? "").replace(/\s+/gu, " ").trim(),
        tags: strings(meta?.tags),
        kind,
        status: scalar(meta?.status),
        layer: scalar(meta?.layer),
        type: scalar(meta?.type),
        bookId: page?.bookId,
        bookTitle: book?.title ?? "",
        chapterTitle: chapter?.title ?? "",
        role: page?.role ?? kind,
        auxiliary: page?.auxiliary ?? kind !== "body",
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))
}

export const bookRoleLabels: Record<string, string> = {
  section: "正文",
  reading: "正文",
  knowledge: "知识条目",
  connection: "联系",
  exercise: "习题",
  other: "独立笔记",
  book: "书籍导读",
  chapter: "章节导读",
  home: "书架",
  auxiliary: "辅助资料",
  body: "正文",
  plan: "规划",
  example: "示例",
  navigation: "导航",
}

export function cleanBookSnippet(text: string): string {
  return text
    .replace(/#[\p{L}\p{N}_/-]+/gu, " ")
    .replace(
      /(?:PDF|来源 PDF)[，,:： ]*(?:第\s*)?\d+(?:\s*[–—-]\s*\d+)?\s*(?:页)?(?:[（(][^）)]*原文件未公开[^）)]*[）)])?/giu,
      " ",
    )
    .replace(/[（(]来源 PDF[^）)]*[）)]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

/** Read one visible formula representation; KaTeX also stores MathML and TeX. */
export function bookExpositionText(node: Root | RootContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element" && node.type !== "root") return ""
  if (
    node.type === "element" &&
    (node.properties.className as string[] | undefined)?.includes("katex")
  ) {
    const visible = node.children.find(
      (child) =>
        child.type === "element" &&
        (child.properties.className as string[] | undefined)?.includes("katex-html"),
    )
    return visible ? bookExpositionText(visible) : ""
  }
  return node.children.map(bookExpositionText).join("")
}

export const bookKindLabels: Record<BookKind, string> = {
  body: "正文",
  plan: "规划",
  example: "示例",
  navigation: "导航",
}

export function bookResultHref(root: string | URL, slug: string): string {
  // Slugs originate in the build, but keep the client boundary same-site even if
  // an unexpected value reaches the index. Encode segments rather than a URL.
  if (slug.startsWith("/") || slug.split("/").some((part) => part === ".." || part === "."))
    throw new Error("Invalid book search slug")
  const path = slug === "index" ? "" : slug.replace(/\/index$/, "/")
  return new URL(path.split("/").map(encodeURIComponent).join("/"), root).href
}

export function bookSnippet(document: BookDocument, query: string, length = 170): string {
  const text =
    cleanBookSnippet(document.snippetText ?? document.text) ||
    document.headings.join(" · ") ||
    document.aliases.join(" · ")
  if (text.length <= length) return text
  const normalized = normalizeSearch(text)
  const terms = [normalizeSearch(query).trim(), ...bookSearchTokens(query)]
  const offsets = terms
    .filter(Boolean)
    .map((term) => normalized.indexOf(term))
    .filter((at) => at >= 0)
  const start = Math.max(0, (offsets.length ? Math.min(...offsets) : 0) - 48)
  return `${start ? "…" : ""}${text.slice(start, start + length).trim()}${start + length < text.length ? "…" : ""}`
}

export function bookHighlightParts(
  text: string,
  query: string,
): { text: string; match: boolean }[] {
  const terms = [query.trim(), ...bookSearchTokens(query)]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  if (!terms.length) return [{ text, match: false }]
  const pattern = [...new Set(terms)]
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")
  const matches = text.matchAll(new RegExp(pattern, "giu"))
  const parts: { text: string; match: boolean }[] = []
  let offset = 0
  for (const match of matches) {
    const at = match.index!
    if (at > offset) parts.push({ text: text.slice(offset, at), match: false })
    parts.push({ text: match[0], match: true })
    offset = at + match[0].length
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), match: false })
  return parts
}

export function createBookSearch(documents: BookDocument[]) {
  const fields = ["title", "aliases", "headings", "all"] as const
  const indexes = fields.map(
    () => new FlexSearch.Index({ encode: bookSearchTokens, tokenize: "forward" }),
  )
  documents.forEach((doc, id) => {
    const values = [
      doc.title,
      doc.aliases.join(" "),
      doc.headings.join(" "),
      [doc.title, ...doc.aliases, ...doc.headings, ...doc.tags, doc.text].join(" "),
    ]
    indexes.forEach((index, field) => index.add(id, values[field]))
  })

  return (
    query: string,
    options: BookSearchOptions | BookFilter = {},
    limit = 40,
  ): BookDocument[] => {
    const {
      filter = "all",
      bookId,
      includeAuxiliary = false,
    } = typeof options === "string"
      ? { filter: options, includeAuxiliary: options !== "all" }
      : options
    const phrase = normalizeSearch(query).trim()
    if (!bookSearchTokens(phrase).length) return []
    const score = new Map<number, number>()
    indexes.forEach((index, field) => {
      const weight = [700, 650, 300, 50][field]
      const ids = index.search(phrase, { limit: documents.length })
      ids.forEach((id, rank) => {
        const numericId = Number(id)
        score.set(numericId, (score.get(numericId) ?? 0) + weight + 1 / (rank + 1))
      })
    })
    for (const [id, value] of score) {
      const doc = documents[id]
      const title = normalizeSearch(doc.title)
      const aliases = doc.aliases.map(normalizeSearch)
      score.set(
        id,
        value +
          (title === phrase ? 2000 : title.includes(phrase) ? 900 : 0) +
          (aliases.includes(phrase)
            ? 1700
            : aliases.some((alias) => alias.includes(phrase))
              ? 800
              : 0),
      )
    }
    return [...score]
      .filter(
        ([id]) =>
          (filter === "all" || documents[id].kind === filter) &&
          (!bookId || documents[id].bookId === bookId) &&
          (includeAuxiliary || !documents[id].auxiliary),
      )
      .sort(
        ([a, scoreA], [b, scoreB]) =>
          scoreB - scoreA || documents[a].title.localeCompare(documents[b].title),
      )
      .slice(0, limit)
      .map(([id]) => documents[id])
  }
}
