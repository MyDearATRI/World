import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { QuartzTransformerPlugin } from "../types"

// CSS/fonts are copied from this renderer's resolved KaTeX by prepare-assets.mjs.
export const LocalMath: QuartzTransformerPlugin = () => ({
  name: "LocalMath",
  markdownPlugins() {
    return [remarkMath]
  },
  htmlPlugins() {
    return [[rehypeKatex, { output: "htmlAndMathml", strict: "error", throwOnError: true }]]
  },
})
