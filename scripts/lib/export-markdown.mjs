import matter from "gray-matter"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import { visit } from "unist-util-visit"
import { slug } from "github-slugger"

const parser = unified().use(remarkParse).use(remarkMath)
export const markdownText = (text) => String(text).replace(/[\\`*_[\]<>]/g, "\\$&")
export const htmlText = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  )

export function normalizeDisplayMath(text) {
  let display = false
  let fence = ""
  return text
    .replaceAll("\r\n", "\n")
    .split("\n")
    .map((line) => {
      const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1]
      if (marker) {
        fence = fence ? "" : marker
        return line
      }
      if (fence) return line
      const quote = line.match(/^(?:>\s*)*/)?.[0] ?? ""
      const value = line.slice(quote.length)
      if (value.trim() === "$$") {
        display = !display
        return line
      }
      if (display && /\$\$\s*$/.test(value)) {
        display = false
        return line.replace(/\$\$\s*$/, "") + "\n" + quote + "$$"
      }
      if (!display && /^\s*\$\$.+\$\$\s*$/.test(value))
        return quote + "$$\n" + quote + value.trim().slice(2, -2) + "\n" + quote + "$$"
      if (!display && /^\s*\$\$\S/.test(value)) {
        display = true
        return quote + "$$\n" + quote + value.trim().slice(2)
      }
      return line
    })
    .join("\n")
}

export function readNote(raw, source) {
  const parsed = matter(raw)
  const displayNormalized = normalizeDisplayMath(parsed.content)
  const body = normalizeTableMath(displayNormalized)
  const firstH1 = /^#\s+(.+)$/m.exec(body)
  const title =
    parsed.data.title ||
    firstH1?.[1].replace(/\s+#+\s*$/, "").trim() ||
    source.split("/").at(-1).slice(0, -3)
  return {
    data: parsed.data,
    title: String(title),
    normalizations: {
      displayMath: displayNormalized !== parsed.content.replaceAll("\r\n", "\n"),
      tableMath: body !== displayNormalized,
    },
    body: firstH1
      ? body.slice(0, firstH1.index) + body.slice(firstH1.index + firstH1[0].length)
      : body,
  }
}

export function normalizeTableMath(body) {
  const protectedRanges = []
  visit(parser.parse(body), (node) => {
    if (["code", "inlineCode"].includes(node.type) && node.position)
      protectedRanges.push([node.position.start.offset, node.position.end.offset])
  })
  return body.replace(/^\s*\|[^\n]*\|\s*$/gm, (line, offset) =>
    line.replace(/(?<!\\)\$(?!\$)([^$\n]+)(?<!\\)\$(?!\$)/g, (formula, value, index) => {
      if (protectedRanges.some(([start, end]) => offset + index >= start && offset + index < end))
        return formula
      // Literal pipes are GFM column delimiters even inside math; use equivalent KaTeX commands.
      return "$" + value.replace(/\\\|/g, "\\Vert ").replace(/\|/g, "\\vert ") + "$"
    }),
  )
}

export function siteKind(source, data) {
  if (source.includes("/Examples/") || data.status === "示例" || data.tags?.includes?.("用途/示例"))
    return "example"
  if (source.includes("/写作规划/") || data.status === "待写" || data.tags?.includes?.("用途/规划"))
    return "plan"
  if (data.type === "路线") return "navigation"
  return "body"
}

export function rewriteLinks(body, source, resolve, diagnostics) {
  const protectedRanges = []
  visit(parser.parse(body), (node) => {
    if (["code", "inlineCode", "math", "inlineMath", "html"].includes(node.type) && node.position)
      protectedRanges.push([node.position.start.offset, node.position.end.offset])
  })
  const changes = []
  const protectedAt = (offset) =>
    protectedRanges.some(([start, end]) => offset >= start && offset < end)
  function replacement(target, label, embed, syntax) {
    const result = resolve(source, target)
    const display =
      label ||
      target
        .split("#")[0]
        .split("/")
        .at(-1)
        .replace(/\.(md|canvas)$/i, "") ||
      "本页"
    if (result.kind === "external")
      return syntax === "wiki" ? `[${markdownText(display)}](<${result.url}>)` : null
    if (result.kind === "pdf") {
      const page = /(?:^|[#&])page=(\d+)/i.exec(target)?.[1]
      diagnostics.pdfReferences.push({ source, page: page ? Number(page) : null })
      return `${markdownText(display)}（来源 PDF${page ? `，第 ${page} 页` : ""}；原文件未公开）`
    }
    if (result.kind === "excluded") {
      diagnostics.excludedReferences.push({ source, target })
      return `${markdownText(display)}（未公开）`
    }
    if (result.kind === "missing") {
      diagnostics.missingLinks.push({ source, target })
      return `${markdownText(display)}（尚未建立）`
    }
    if (result.kind === "image")
      return `${embed ? "!" : ""}[${markdownText(display)}](<${result.output}>)`
    if (result.kind === "canvas")
      return `[[${result.output.slice(0, -3)}|${display.replaceAll("|", " ")}]]`
    const anchor =
      result.anchor && slug(result.anchor) !== slug(result.title) ? "#" + result.anchor : ""
    return `${embed ? "!" : ""}[[${result.output.slice(0, -3)}${anchor}|${display.replaceAll("|", " ")}]]`
  }
  for (const match of body.matchAll(/(!?)\[\[([^\]\n]+)\]\]/g)) {
    if (protectedAt(match.index)) continue
    const split = match[2].replaceAll("\\|", "|").split("|")
    const value = replacement(split[0], split.slice(1).join("|"), !!match[1], "wiki")
    if (value !== null)
      changes.push({ start: match.index, end: match.index + match[0].length, value })
  }
  visit(parser.parse(body), (node) => {
    if (!["link", "image"].includes(node.type) || !node.position) return
    const start = node.position.start.offset,
      end = node.position.end.offset
    if (protectedAt(start) || changes.some((change) => start >= change.start && start < change.end))
      return
    const label =
      node.type === "image"
        ? node.alt
        : (node.children ?? []).map((child) => child.value ?? "").join("")
    const value = replacement(node.url, label, node.type === "image", "markdown")
    if (value !== null) changes.push({ start, end, value })
  })
  for (const change of changes.sort((a, b) => b.start - a.start))
    body = body.slice(0, change.start) + change.value + body.slice(change.end)
  return body
}

export function serializeNote(data, body) {
  // created/status/layer are source metadata, never invented publication dates.
  return matter.stringify(body.trim() + "\n", data)
}
