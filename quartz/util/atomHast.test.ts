import test from "node:test"
import assert from "node:assert/strict"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkRehype from "remark-rehype"
import rehypeKatex from "rehype-katex"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"
import type { Root, Element } from "hast"
import { isAtomFootnoteSection, snapshotAtomRegion, relocateAtomFragment } from "./atomHast"

const elements = (tree: Root) => {
  const result: Element[] = []
  visit(tree, "element", (node) => {
    result.push(node)
  })
  return result
}
async function renderFixture(body: string): Promise<Root> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { output: "htmlAndMathml" })
  return (await processor.run(processor.parse(body))) as Root
}
const sharedNotes =
  "\n\n[^shared]: A shared source citation with $\\frac{1}{2}$.\n\n[^inside]: A precise qualification.\n\n[^outside]: A note belonging to omitted exposition."

for (const syntax of ["callout", "heading"] as const) {
  test(`${syntax} synthetic Markdown preserves and rebases footnotes without duplicating the last footnote section`, async () => {
    const intro = "Outside the extracted atom[^shared] and an unrelated note[^outside].\n\n"
    const statement =
      syntax === "callout"
        ? "> [!definition] Synthetic definition\n> A value $x$ has this property[^shared]. A qualification[^inside] is repeated[^inside]."
        : "## THM — Synthetic final section\n\nA value $x$ has this property[^shared]. A qualification[^inside] is repeated[^inside]."
    const source = await renderFixture(intro + statement + sharedNotes)
    const untouched = toHtml(source)
    const footnotes = source.children.filter(isAtomFootnoteSection)
    assert.equal(footnotes.length, 1)
    const start = source.children.findIndex(
      (node) =>
        node.type === "element" && node.tagName === (syntax === "callout" ? "blockquote" : "h2"),
    )
    assert.ok(start >= 0)
    // The final heading range intentionally contains the already-generated footnotes.
    const selected =
      syntax === "callout" ? source.children.slice(start, start + 1) : source.children.slice(start)
    if (syntax === "heading") assert.equal(selected.filter(isAtomFootnoteSection).length, 1)
    const snapshot = snapshotAtomRegion(selected, footnotes)
    assert.equal(snapshot.children.filter(isAtomFootnoteSection).length, 1)
    const relocated = relocateAtomFragment(snapshot, "book/原始笔记", `a-test-${syntax}`)
    const all = elements(relocated)
    const ids = all.flatMap((node) =>
      typeof node.properties.id === "string" ? [node.properties.id] : [],
    )
    assert.equal(new Set(ids).size, ids.length)
    assert.ok(all.some((node) => node.tagName === "math"))
    assert.ok(toHtml(relocated).includes("A precise qualification."))
    assert.ok(toHtml(relocated).includes("A shared source citation"))
    const backlinks = all.filter((node) => node.properties.dataFootnoteBackref !== undefined)
    assert.ok(backlinks.length >= 4)
    // The first shared citation and the unrelated citation occurred outside the atom.
    assert.ok(
      backlinks.some((node) =>
        String(node.properties.href).includes(
          "../book/%E5%8E%9F%E5%A7%8B%E7%AC%94%E8%AE%B0.html#user-content-fnref-shared",
        ),
      ),
    )
    assert.ok(
      backlinks.some((node) =>
        String(node.properties.href).endsWith(".html#user-content-fnref-outside"),
      ),
    )
    assert.ok(
      backlinks.some(
        (node) => node.properties.href === `#a-test-${syntax}-user-content-fnref-shared-2`,
      ),
    )
    assert.ok(
      backlinks.some(
        (node) => node.properties.href === `#a-test-${syntax}-user-content-fnref-inside-2`,
      ),
    )
    for (const node of all) {
      const href = node.properties.href
      if (typeof href === "string" && href.startsWith("#"))
        assert.ok(
          ids.includes(decodeURIComponent(href.slice(1))),
          `missing local footnote target ${href}`,
        )
      const described = node.properties.ariaDescribedBy
      if (described)
        for (const target of Array.isArray(described) ? described : String(described).split(" "))
          assert.ok(ids.includes(String(target)), `missing accessible footnote label ${target}`)
    }
    assert.equal(toHtml(source), untouched, "rendered source was mutated by extraction")
  })
}

test("duplicate IDs fail rather than silently rebasing to the same fragment identity", () => {
  const source: Root = {
    type: "root",
    children: [
      { type: "element", tagName: "p", properties: { id: "duplicate" }, children: [] },
      { type: "element", tagName: "p", properties: { id: "duplicate" }, children: [] },
    ],
  }
  assert.throws(
    () => relocateAtomFragment(source, "book/source", "a-test"),
    /Duplicate atom fragment ID/,
  )
})

test("sidenote HAST stays in source order and rebases image, heading and ARIA references", () => {
  const source: Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: "Before" }],
      },
      {
        type: "element",
        tagName: "aside",
        properties: { className: ["sidenote"], ariaLabelledBy: ["margin-title"] },
        children: [
          {
            type: "element",
            tagName: "span",
            properties: { id: "margin-title" },
            children: [{ type: "text", value: "A mathematical note" }],
          },
          {
            type: "element",
            tagName: "a",
            properties: { href: "#not-in-excerpt" },
            children: [{ type: "text", value: "Original context" }],
          },
          {
            type: "element",
            tagName: "img",
            properties: { src: "../assets/diagram.svg", alt: "Synthetic diagram" },
            children: [],
          },
        ],
      },
      {
        type: "element",
        tagName: "p",
        properties: {},
        children: [{ type: "text", value: "After" }],
      },
    ],
  }
  const relocated = relocateAtomFragment(
    snapshotAtomRegion(source.children, []),
    "book/source",
    "a-margin",
  )
  assert.deepEqual(
    relocated.children.map((node) => (node.type === "element" ? node.tagName : node.type)),
    ["p", "aside", "p"],
  )
  const all = elements(relocated)
  assert.deepEqual(all.find((node) => node.tagName === "aside")?.properties.ariaLabelledBy, [
    "a-margin-margin-title",
  ])
  assert.equal(
    all.find((node) => node.tagName === "a")?.properties.href,
    "../book/source.html#not-in-excerpt",
  )
  assert.equal(all.find((node) => node.tagName === "img")?.properties.src, "../assets/diagram.svg")
})
