import { QuartzEmitterPlugin } from "../types"
import { FullSlug } from "../../util/path"
import { buildBookDocuments, BookIndexData } from "../../util/bookSearch"
import { write } from "./helpers"
import { visit } from "unist-util-visit"
import { toString } from "hast-util-to-string"

export const BookIndex: QuartzEmitterPlugin = () => ({
  name: "BookIndex",
  async *emit(ctx, content) {
    const index: BookIndexData = {
      version: 1,
      documents: buildBookDocuments(content.map(([, file]) => file.data)),
    }
    const bySlug = new Map(index.documents.map((document) => [document.slug, document]))
    // The reading TOC deliberately stops at h2. Search also indexes deeper
    // headings without changing that compact navigation or reparsing Markdown.
    for (const [tree, file] of content) {
      const document = bySlug.get(file.data.slug!)
      if (!document) continue
      const headings = new Set(document.headings)
      visit(tree, "element", (node) => {
        if (/^h[1-6]$/.test(node.tagName)) headings.add(toString(node))
      })
      document.headings = [...headings]
    }
    yield write({
      ctx,
      slug: "static/bookIndex" as FullSlug,
      ext: ".json",
      content: JSON.stringify(index),
    })
  },
})
