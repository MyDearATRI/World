import type { Root, Element } from "hast"
import { visit, SKIP } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "../types"
import { createHash } from "node:crypto"
import { toString } from "hast-util-to-string"

const kindLabels: Record<string, string> = {
  definition: "定义",
  theorem: "定理",
  "proof-strategy": "证明策略",
  example: "例子",
  sidenote: "边注",
  insight: "观察",
  relation: "联系",
  question: "问题",
  warning: "提醒",
  info: "说明",
  proof: "证明",
  lemma: "引理",
  proposition: "命题",
  corollary: "推论",
}
const types = new Set(Object.keys(kindLabels))
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
                ...title.properties,
                className: ["block-label"],
                id: title.properties.id ?? `block-label-${prefix}-${blockNumber}`,
              }
              node.properties["aria-labelledby"] = title.properties.id
              const originalTitle: Element = {
                type: "element",
                tagName: "span",
                properties: {
                  ...inner?.properties,
                  className: ["block-title"],
                },
                children: inner?.children ?? title.children,
              }
              title.children = [
                {
                  type: "element",
                  tagName: "span",
                  properties: { className: ["block-kind"] },
                  children: [{ type: "text", value: kindLabels[type] }],
                },
                { type: "text", value: " " },
                originalTitle,
              ]
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
        // An explicit source label in the opening paragraph is reliable metadata.
        // Do not infer provenance from author names, dates, PDFs or later prose.
        const opening = tree.children.find(
          (node): node is Element =>
            node.type === "element" && !classes(node).includes("note-tags"),
        )
        if (
          opening?.tagName === "p" &&
          /^(?:来源\s*[:：]|Source\s*:)(?=\s*\S)/u.test(toString(opening).trimStart())
        )
          opening.properties.className = [...new Set([...classes(opening), "note-provenance"])]
      },
    ]
  },
})
