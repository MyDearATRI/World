import { Root, Element } from "hast"
import { visit, SKIP } from "unist-util-visit"
import { QuartzTransformerPlugin } from "../types"

const types = new Set(["definition", "theorem", "proof-strategy", "example", "sidenote"])
const classes = (node: Element): string[] => (node.properties.className ?? []) as string[]

export const SemanticBlocks: QuartzTransformerPlugin = () => ({
  name: "SemanticBlocks",
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        let blockNumber = 0
        let equationNumber = 0
        visit(tree, "element", (node, index, parent) => {
          const type = String(node.properties["data-callout"] ?? node.properties.dataCallout ?? "")
          if (node.tagName === "blockquote" && types.has(type)) {
            blockNumber++
            node.tagName = type === "sidenote" ? "aside" : "section"
            node.properties = {
              className: type === "sidenote" ? ["sidenote"] : ["semantic-block", type],
              "data-block-type": type,
              "aria-labelledby": `block-label-${blockNumber}`,
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
              title.properties = { className: ["block-label"], id: `block-label-${blockNumber}` }
              title.children = inner?.children ?? [{ type: "text", value: type }]
            }
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
