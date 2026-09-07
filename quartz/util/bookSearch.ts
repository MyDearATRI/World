import FlexSearch from "flexsearch"
import type { QuartzPluginData } from "../plugins/vfile"

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
}
export interface BookIndexData {
  version: 1
  documents: BookDocument[]
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

export function buildBookDocuments(files: QuartzPluginData[]): BookDocument[] {
  return files
    .filter((file) => file.slug && file.frontmatter?.siteKind !== "canvas")
    .map((file): BookDocument => {
      const meta = file.frontmatter
      const rawKind = scalar(meta?.siteKind)
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
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug))
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
  const text = document.text || document.headings.join(" · ") || document.aliases.join(" · ")
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

  return (query: string, filter: BookFilter = "all", limit = 40): BookDocument[] => {
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
      .filter(([id]) => filter === "all" || documents[id].kind === filter)
      .sort(
        ([a, scoreA], [b, scoreB]) =>
          scoreB - scoreA || documents[a].title.localeCompare(documents[b].title),
      )
      .slice(0, limit)
      .map(([id]) => documents[id])
  }
}
