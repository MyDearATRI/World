import type { Root, RootContent } from "hast"
import { visit } from "unist-util-visit"

export function isAtomFootnoteSection(node: RootContent): boolean {
  return (
    node.type === "element" &&
    (node.properties.dataFootnotes !== undefined || node.properties["data-footnotes"] !== undefined)
  )
}

/** Keep one source footnote section even when a final heading range already contains it. */
export function snapshotAtomRegion(nodes: RootContent[], sourceFootnotes: RootContent[]): Root {
  return {
    type: "root",
    children: structuredClone([
      ...nodes.filter((node) => !isAtomFootnoteSection(node)),
      ...new Set(sourceFootnotes.filter(isAtomFootnoteSection)),
    ]),
  }
}

/** Rebase copied IDs and relative URLs; omitted source backlinks stay attached to the source page. */
export function relocateAtomFragment(fragment: Root, sourceSlug: string, id: string): Root {
  const tree = structuredClone(fragment)
  const source = new URL(`${sourceSlug}.html`, "https://site.invalid/")
  const identifiers = new Map<string, string>()
  visit(tree, "element", (node) => {
    if (typeof node.properties.id === "string") {
      if (identifiers.has(node.properties.id))
        throw new Error(`Duplicate atom fragment ID: ${node.properties.id}`)
      identifiers.set(node.properties.id, `${id}-${node.properties.id}`)
    }
  })
  visit(tree, "element", (node) => {
    if (typeof node.properties.id === "string")
      node.properties.id = identifiers.get(node.properties.id)!
    for (const property of [
      "aria-labelledby",
      "aria-describedby",
      "ariaLabelledBy",
      "ariaDescribedBy",
    ]) {
      const value = node.properties[property]
      if (typeof value === "string" || Array.isArray(value)) {
        const values = typeof value === "string" ? value.split(" ") : value.map(String)
        const relocated = values.map((value) => identifiers.get(value) ?? value)
        node.properties[property] = typeof value === "string" ? relocated.join(" ") : relocated
      }
    }
    for (const property of ["href", "src", "poster"]) {
      const value = node.properties[property]
      if (typeof value !== "string" || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue
      if (value.startsWith("#") && identifiers.has(decodeURIComponent(value.slice(1)))) {
        node.properties[property] = `#${identifiers.get(decodeURIComponent(value.slice(1)))}`
      } else {
        const resolved = new URL(value, source)
        node.properties[property] =
          `../${resolved.pathname.slice(1)}${resolved.search}${resolved.hash}`
      }
    }
  })
  return tree
}
