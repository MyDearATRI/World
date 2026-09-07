import path from "node:path"
import { htmlText, markdownText, rewriteLinks, serializeNote } from "./export-markdown.mjs"
import { sha256 } from "./export-boundary.mjs"

// Mirrors Quartz v4's segment slug rules so links inside the inline SVG retain /World/.
export function webSlug(file) {
  return file
    .replace(/\.md$/, "")
    .split("/")
    .map((part) =>
      part
        .replace(/\s/g, "-")
        .replaceAll("&", "-and-")
        .replaceAll("%", "-percent")
        .replace(/[?#]/g, ""),
    )
    .join("/")
    .replace(/(^|\/)index$/, "$1")
}

export function renderCanvas(raw, source, output, title, resolve, diagnostics) {
  const canvas = JSON.parse(raw)
  const markerId = `canvas-arrow-${sha256(source).slice(0, 12)}`
  if (!Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges))
    throw new Error(`Invalid Canvas: ${source}`)
  const nodes = canvas.nodes
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback)
  const minX = Math.min(0, ...nodes.map((node) => finite(node.x))) - 30
  const minY = Math.min(0, ...nodes.map((node) => finite(node.y))) - 30
  const maxX = Math.max(300, ...nodes.map((node) => finite(node.x) + finite(node.width, 240))) + 30
  const maxY = Math.max(200, ...nodes.map((node) => finite(node.y) + finite(node.height, 120))) + 30
  const parts = [
    `<div class="canvas-reading-map"><svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="img" aria-label="${htmlText(title)}" style="display:block;width:100%;height:auto;max-height:760px;background:#fafaf8"><defs><marker id="canvas-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#65707a"/></marker></defs>`,
  ]
  const labels = new Map()
  for (const [i, node] of nodes.entries()) {
    const result = node.type === "file" ? resolve(source, node.file + (node.subpath ?? "")) : null
    const label =
      node.label ||
      result?.title ||
      (node.type === "file"
        ? path.posix.basename(node.file, ".md")
        : node.type === "text"
          ? "说明 " + (i + 1)
          : "分组 " + (i + 1))
    labels.set(node.id, label)
  }
  for (const node of nodes.filter((item) => item.type === "group")) {
    parts.push(
      `<rect x="${finite(node.x)}" y="${finite(node.y)}" width="${finite(node.width, 240)}" height="${finite(node.height, 120)}" fill="none" stroke="#aeb7c1" stroke-dasharray="7 5"/><text x="${finite(node.x) + 12}" y="${finite(node.y) + 24}" font-family="sans-serif" font-size="17" fill="#31577c">${htmlText(labels.get(node.id))}</text>`,
    )
  }
  function port(node, side) {
    const x = finite(node.x),
      y = finite(node.y),
      w = finite(node.width, 240),
      h = finite(node.height, 120)
    return side === "left"
      ? [x, y + h / 2]
      : side === "right"
        ? [x + w, y + h / 2]
        : side === "top"
          ? [x + w / 2, y]
          : [x + w / 2, y + h]
  }
  for (const edge of canvas.edges) {
    const from = byId.get(edge.fromNode),
      to = byId.get(edge.toNode)
    if (!from || !to) {
      diagnostics.canvasWarnings.push({ source, reason: "Missing edge endpoint" })
      continue
    }
    const [x1, y1] = port(from, edge.fromSide),
      [x2, y2] = port(to, edge.toSide)
    parts.push(
      `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#65707a" stroke-width="2"${edge.fromEnd === "arrow" ? ' marker-start="url(#canvas-arrow)"' : ""}${edge.toEnd !== "none" ? ' marker-end="url(#canvas-arrow)"' : ""}/>`,
    )
    if (edge.label)
      parts.push(
        `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" font-family="sans-serif" font-size="15" fill="#282c32">${htmlText(edge.label)}</text>`,
      )
  }
  for (const node of nodes.filter((item) => item.type !== "group")) {
    const result = node.type === "file" ? resolve(source, node.file + (node.subpath ?? "")) : null
    const href =
      result && ["note", "canvas"].includes(result.kind) ? "../" + webSlug(result.output) : null
    if (href)
      parts.push(
        `<a href="${htmlText(encodeURI(href))}" aria-label="${htmlText(labels.get(node.id))}">`,
      )
    parts.push(
      `<rect x="${finite(node.x)}" y="${finite(node.y)}" width="${finite(node.width, 240)}" height="${finite(node.height, 120)}" fill="#fafaf8" stroke="${href ? "#31577c" : "#aeb7c1"}"/><text x="${finite(node.x) + 12}" y="${finite(node.y) + 28}" font-family="sans-serif" font-size="16" fill="#282c32">`,
    )
    const line =
      node.type === "text" ? String(node.text ?? "").replace(/[\n#>*_]/g, " ") : labels.get(node.id)
    const chunks = line.match(/.{1,28}/gu) ?? [""]
    for (const [i, chunk] of chunks
      .slice(0, Math.max(1, Math.floor((finite(node.height, 120) - 20) / 24)))
      .entries())
      parts.push(`<tspan x="${finite(node.x) + 12}" dy="${i ? 24 : 0}">${htmlText(chunk)}</tspan>`)
    parts.push("</text>")
    if (href) parts.push("</a>")
  }
  parts.push("</svg></div>")
  let body =
    "This diagram preserves the source Canvas groups and directed connections. Full text and note links follow the diagram.\n\n此图从批准公开的 Canvas 生成；箭头与标签保留原来的关系说明，未被解释为逻辑等价。\n\n" +
    parts.join("") +
    "\n\n## Notes and annotations\n\n"
  for (const node of nodes) {
    body += `### ${markdownText(labels.get(node.id))}\n\n`
    if (node.type === "file")
      body +=
        rewriteLinks(
          `[[${node.file}${node.subpath ?? ""}|${labels.get(node.id)}]]`,
          source,
          resolve,
          diagnostics,
        ) + "\n\n"
    else if (node.type === "text")
      body +=
        rewriteLinks(
          String(node.text ?? "").replace(/[<>]/g, htmlText),
          source,
          resolve,
          diagnostics,
        ) + "\n\n"
    else if (node.type === "link")
      body += /^https?:\/\//i.test(node.url ?? "")
        ? `[External reference](<${node.url}>)\n\n`
        : "External reference not published.\n\n"
    else body += "Canvas group.\n\n"
  }
  body += "## Directed connections\n\n"
  for (const edge of canvas.edges) {
    if (!byId.has(edge.fromNode) || !byId.has(edge.toNode)) continue
    body += `- ${markdownText(labels.get(edge.fromNode))} ${edge.fromEnd === "arrow" ? "←" : ""}${edge.toEnd === "none" ? "—" : "→"} ${markdownText(labels.get(edge.toNode))}${edge.label ? `: ${markdownText(edge.label)}` : ""}\n`
  }
  body = body
    .replaceAll('id="canvas-arrow"', `id="${markerId}"`)
    .replaceAll("url(#canvas-arrow)", `url(#${markerId})`)
  return serializeNote(
    {
      title,
      siteKind: "canvas",
      canvasCategory: source.includes("示范") ? "example" : "navigation",
      type: "路线",
      canvasSource: true,
    },
    body,
  )
}
