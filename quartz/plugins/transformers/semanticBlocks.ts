import { Root, Element } from "hast"
import { visit, SKIP } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"
import { createHash } from "node:crypto"

const types = new Set([
  "definition",
  "theorem",
  "proof-strategy",
  "example",
  "sidenote",
  "insight",
  "relation",
  "question",
  "warning",
  "info",
  "proof",
  "lemma",
  "proposition",
  "corollary",
])
const classes = (node: Element): string[] => (node.properties.className ?? []) as string[]

export const SemanticBlocks: QuartzTransformerPlugin = () => ({
  name: "SemanticBlocks",
  htmlPlugins() {
    return [
      () => (tree: Root, file) => {
        let blockNumber = 0
        let equationNumber = 0
        let tableNumber = 0
        const prefix = createHash("sha256")
          .update(String(file.data.slug))
          .digest("hex")
          .slice(0, 10)
        visit(tree, "element", (node, index, parent) => {
          const type = String(node.properties["data-callout"] ?? node.properties.dataCallout ?? "")
          if (node.tagName === "blockquote" && types.has(type)) {
            blockNumber++
            node.tagName = type === "sidenote" ? "aside" : "section"
            node.properties = {
              ...node.properties,
              className: type === "sidenote" ? ["sidenote"] : ["semantic-block", type],
              "data-block-type": type,
              "aria-labelledby": `block-label-${prefix}-${blockNumber}`,
            }
            const title = node.children.find(
              (child): child is Element =>
                child.type === "element" && classes(child).includes("callout-title"),
            )
            if (title) {
              const inner = title.children.find(
                (child): child is Element =>
                  child.type === "element" && classes(child).includes("callout-title-inner"),
              )
              title.properties = {
                className: ["block-label"],
                id: `block-label-${prefix}-${blockNumber}`,
              }
              title.children = inner?.children ?? [{ type: "text", value: type }]
            }
          }
          if (
            node.tagName === "p" &&
            node.children.every((child) => child.type === "text") &&
            /^(?:\s*#[^\s#]+)+\s*$/.test(
              node.children.map((child) => (child.type === "text" ? child.value : "")).join(""),
            )
          )
            node.properties.className = ["note-tags"]
          if (node.tagName === "table" && parent && index !== undefined) {
            parent.children[index] = {
              type: "element",
              tagName: "div",
              properties: {
                className: ["table-scroll"],
                role: "region",
                tabIndex: 0,
                "aria-label": `Table ${++tableNumber}; scroll horizontally if needed`,
              },
              children: [node],
            }
            // Visit its children normally so mathematical expressions still receive wrappers.
          }
          if (classes(node).includes("katex-display") && parent && index !== undefined) {
            equationNumber++
            const wrapper: Element = {
              type: "element",
              tagName: "div",
              properties: {
                className: ["math-scroll"],
                role: "region",
                tabIndex: 0,
                "aria-label": `Equation ${equationNumber}; scroll horizontally if needed`,
              },
              children: [node],
            }
            parent.children[index] = wrapper
            return SKIP
          }
        })
      },
    ]
  },
})
