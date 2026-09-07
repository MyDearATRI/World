import { test } from "node:test"
import assert from "node:assert/strict"
import type { Element, Root } from "hast"
import type { QuartzComponentProps } from "../components/types"
import type { GlobalConfiguration } from "../cfg"
import { renderTranscludes } from "./transcludes"
import type { FullSlug } from "./path"

const paragraph = (text: string): Element => ({
  type: "element",
  tagName: "p",
  properties: {},
  children: [{ type: "text", value: text }],
})
const embed = (target: string, block = ""): Element => ({
  type: "element",
  tagName: "blockquote",
  properties: { className: ["transclude"], dataBlock: block },
  children: [
    {
      type: "element",
      tagName: "a",
      properties: { "data-slug": target, href: `./${target}${block}` },
      children: [],
    },
  ],
})
const cfg = { locale: "en-US" } as GlobalConfiguration
const props = (allFiles: unknown[]) => ({ allFiles }) as QuartzComponentProps

test("independent block excerpts from one note each render without a false cycle", () => {
  const root: Root = {
    type: "root",
    children: [embed("source", "#^first"), embed("source", "#^second"), embed("source", "#^first")],
  }
  renderTranscludes(
    root,
    cfg,
    "archive" as FullSlug,
    props([
      {
        slug: "source",
        blocks: { first: paragraph("first excerpt"), second: paragraph("second excerpt") },
      },
    ]),
    new Set(["archive"]),
  )
  const output = JSON.stringify(root)
  assert.equal(output.split("first excerpt").length - 1, 2)
  assert.match(output, /second excerpt/)
  assert.doesNotMatch(output, /Circular transclusion/)
})
test("a self-referencing block is bounded but another block remains readable", () => {
  const root: Root = {
    type: "root",
    children: [embed("source", "#^loop"), embed("source", "#^good")],
  }
  const original = console.warn
  console.warn = () => {}
  try {
    renderTranscludes(
      root,
      cfg,
      "archive" as FullSlug,
      props([
        {
          slug: "source",
          blocks: { loop: embed("source", "#^loop"), good: paragraph("independent content") },
        },
      ]),
      new Set(["archive"]),
    )
  } finally {
    console.warn = original
  }
  assert.match(JSON.stringify(root), /Circular transclusion/)
  assert.match(JSON.stringify(root), /independent content/)
})
