import type { Root, RootContent } from "mdast"
import { toString } from "mdast-util-to-string"
import type { QuartzTransformerPlugin } from "../types"
import { readerSlug } from "../../util/readerCatalog"
import type { ReaderMetadata as ReadingMetadata } from "../../util/readerCatalog"

function targetSlug(value: string, current: string, relative: boolean): string | undefined {
  let target = value.trim().split(/[|#]/, 1)[0]
  if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(target)) return undefined
  try {
    target = decodeURI(target)
  } catch {
    return undefined
  }
  if (/\.(?!md$|html$)[a-z\d]{1,8}$/i.test(target)) return undefined
  if (relative && /^\.{1,2}\//.test(target))
    target = `${current.split("/").slice(0, -1).join("/")}/${target}`
  const parts: string[] = []
  for (const part of target.replace(/\\/g, "/").split("/")) {
    if (part === "..") {
      if (!parts.length) return undefined
      parts.pop()
    } else if (part && part !== ".") parts.push(part)
  }
  return readerSlug(parts.join("/"))
}

/** Inspect the parsed source before OFM rewrites links; code examples are excluded. */
export function extractReaderMetadata(tree: Root, currentSlug: string): ReadingMetadata {
  const metadata: ReadingMetadata = { links: [], headings: [] }
  const active: ReadingMetadata["headings"] = []
  const add = (target: string | undefined) => {
    if (!target) return
    if (!metadata.links.includes(target)) metadata.links.push(target)
    for (const heading of active) if (!heading.links.includes(target)) heading.links.push(target)
  }
  const scan = (node: RootContent) => {
    if (["code", "inlineCode", "html", "math", "inlineMath", "yaml", "toml"].includes(node.type))
      return
    if (node.type === "link") add(targetSlug(node.url, currentSlug, true))
    if (node.type === "text") {
      for (const match of node.value.matchAll(/!?\[\[([^\]\n]+)\]\]/g))
        add(targetSlug(match[1], currentSlug, false))
    }
    if ("children" in node) for (const child of node.children) scan(child as RootContent)
  }
  for (const node of tree.children) {
    if (node.type === "heading") {
      while (active.length && active.at(-1)!.depth >= node.depth) active.pop()
      const heading = { depth: node.depth, title: toString(node), links: [] as string[] }
      active.push(heading)
      metadata.headings.push(heading)
    }
    scan(node)
  }
  return metadata
}

export const ReaderMetadata: QuartzTransformerPlugin = () => ({
  name: "ReaderMetadata",
  markdownPlugins() {
    return [
      () => (tree: Root, file) => {
        file.data.readerMetadata = extractReaderMetadata(tree, file.data.slug ?? "index")
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    readerMetadata: ReadingMetadata
  }
}
