import { QuartzEmitterPlugin } from "../types"
import { FullSlug } from "../../util/path"
import { buildBookDocuments, BookIndexData, bookExpositionText } from "../../util/bookSearch"
import { write } from "./helpers"
import { visit } from "unist-util-visit"
import { toString } from "hast-util-to-string"
import { getReaderCatalog } from "../../util/readerCatalog"

export const BookIndex: QuartzEmitterPlugin = () => ({
  name: "BookIndex",
  async *emit(ctx, content) {
    const files = content.map(([, file]) => file.data)
    const catalog = getReaderCatalog(files)
    for (const diagnostic of catalog.diagnostics ?? []) {
      console.warn(`[BookIndex] ${diagnostic.code}: ${diagnostic.slug} — ${diagnostic.message}`)
    }
    const index: BookIndexData = {
      version: 2,
      documents: buildBookDocuments(files, catalog),
      catalog,
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
      // Prefer actual exposition paragraphs over the repeated tag/source header.
      const paragraphs: string[] = []
      visit(tree, "element", (node) => {
        if (node.tagName !== "p") return
        const text = bookExpositionText(node).trim()
        if (
          text.length < 35 ||
          /^(?:#|Barry Simon|Source\s*:|来源\s*[:：]|Status\s*:|PDF\s*\d)/iu.test(text) ||
          text.includes("原文件未公开")
        )
          return
        paragraphs.push(text)
      })
      document.snippetText = paragraphs.join(" ")
    }
    yield write({
      ctx,
      slug: "static/bookIndex" as FullSlug,
      ext: ".json",
      content: JSON.stringify(index),
    })
  },
})
