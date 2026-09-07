import assert from "node:assert/strict"
import test from "node:test"
import type { Element, ElementContent, Root } from "hast"
import { toString } from "hast-util-to-string"
import { unified } from "unified"
import { VFile } from "vfile"
import { SemanticBlocks } from "./semanticBlocks"
import type { BuildCtx } from "../../util/ctx"
import type { FullSlug } from "../../util/path"

const element = (
  tagName: string,
  children: ElementContent[],
  properties: Element["properties"] = {},
): Element => ({ type: "element", tagName, properties, children })
const text = (value: string): ElementContent => ({ type: "text", value })
const classes = (node: Element) => node.properties.className as string[] | undefined
async function transform(children: Root["children"]) {
  const tree: Root = { type: "root", children }
  await unified()
    .use(SemanticBlocks().htmlPlugins!({} as BuildCtx))
    .run(tree, new VFile({ data: { slug: "test/note" as FullSlug } }))
  return tree
}

function callout(type: string, title: ElementContent[], body: ElementContent[]) {
  return element(
    "blockquote",
    [
      element(
        "div",
        [element("div", title, { className: ["callout-title-inner"], id: "source-title-inline" })],
        { className: ["callout-title"], id: "source-title", lang: "en" },
      ),
      element("div", body, { className: ["callout-content"] }),
    ],
    { className: ["callout"], "data-callout": type, id: "original-block" },
  )
}

test("semantic type and original rich title are separate, while IDs and body survive", async () => {
  const title = [
    text("A "),
    element("em", [text("local")]),
    text(" result "),
    element("a", [text("source")], { href: "./reference#theorem" }),
  ]
  const body = [
    element("p", [text("The assumptions and full statement remain here.")], { id: "statement" }),
  ]
  const block = callout("theorem", title, body)
  const before = structuredClone(body)
  await transform([block])
  assert.equal(block.tagName, "section")
  assert.equal(block.properties.id, "original-block")
  assert.equal(block.properties["data-callout"], "theorem")
  assert.equal(block.properties["aria-labelledby"], "source-title")
  const label = block.children[0] as Element
  assert.equal(label.properties.id, "source-title")
  assert.equal(label.properties.lang, "en")
  assert.equal(toString(label.children[0]), "定理")
  assert.deepEqual(classes(label.children[0] as Element), ["block-kind"])
  const renderedTitle = label.children[2] as Element
  assert.deepEqual(classes(renderedTitle), ["block-title"])
  assert.equal(renderedTitle.properties.id, "source-title-inline")
  assert.deepEqual(renderedTitle.children, title)
  assert.deepEqual((block.children[1] as Element).children, before)
})

test("proof strategy retains its explicit incomplete status and other known types have labels", async () => {
  const strategy = callout(
    "proof-strategy",
    [text("Proof strategy — not a complete proof")],
    [element("p", [text("Only an outline; the convergence argument is still needed.")])],
  )
  await transform([strategy])
  const label = strategy.children[0] as Element
  assert.equal(toString(label.children[0]), "证明策略")
  assert.equal(toString(label.children[2]), "Proof strategy — not a complete proof")
  assert.equal(strategy.properties["data-block-type"], "proof-strategy")
  assert(!toString(strategy).includes("∎"))
  for (const [type, expected] of [
    ["definition", "定义"],
    ["proof", "证明"],
    ["lemma", "引理"],
    ["example", "例子"],
    ["sidenote", "边注"],
  ]) {
    const block = callout(type, [text("Original title")], [element("p", [text("Unchanged body")])])
    await transform([block])
    assert.equal(toString((block.children[0] as Element).children[0]), expected)
    assert.equal(block.tagName, type === "sidenote" ? "aside" : "section")
  }
})

test("unknown callouts are untouched and a title without OFM inner markup is preserved", async () => {
  const unknown = callout(
    "custom-research-status",
    [text("Uncertain result")],
    [element("p", [text("Keep this precise status.")])],
  )
  const expected = structuredClone(unknown)
  await transform([unknown])
  assert.deepEqual(unknown, expected)
  const plain = element(
    "blockquote",
    [
      element("div", [text("A plain title")], { className: ["callout-title"] }),
      element("p", [text("Body")]),
    ],
    { dataCallout: "definition" },
  )
  await transform([plain])
  const label = plain.children[0] as Element
  assert.equal(toString(label.children[2]), "A plain title")
  assert.match(String(label.properties.id), /^block-label-[a-f0-9]{10}-1$/)
  assert.equal(plain.properties["aria-labelledby"], label.properties.id)
})

test("only the explicitly labelled opening source paragraph receives provenance styling", async () => {
  const tags = element("p", [text("#用途/正式 #类型/知识")])
  const source = element(
    "p",
    [
      text("来源：Author，"),
      element("em", [text("A book")]),
      text("，§1.2。"),
      element("a", [text("Chapter")], { href: "./chapter" }),
    ],
    { id: "source", className: ["original"] },
  )
  const preserved = structuredClone(source.children)
  const later = element("p", [text("来源：This later paragraph is ordinary content.")])
  await transform([
    tags,
    source,
    element("p", [text("The mathematical exposition begins here.")]),
    later,
  ])
  assert.deepEqual(classes(tags), ["note-tags"])
  assert.deepEqual(classes(source), ["original", "note-provenance"])
  assert.deepEqual(source.children, preserved)
  assert.equal(source.properties.id, "source")
  assert.equal(classes(later), undefined)
  const english = element("p", [text("Source: Author, Book, section 2.")])
  await transform([english])
  assert.deepEqual(classes(english), ["note-provenance"])
})

test("author names, dates, PDF mentions, and Source words do not classify unlabelled prose", async () => {
  for (const value of [
    "Barry Simon, Real Analysis, AMS, 2015 · §3.5 · PDF 158.",
    "Source independence is an assumption of this example.",
    "This result was published in 2015; the PDF explains its proof.",
  ]) {
    const paragraph = element("p", [text(value)])
    await transform([paragraph])
    assert.equal(classes(paragraph), undefined)
    assert.equal(toString(paragraph), value)
  }
  const labelled = element("p", [text("Source: after a heading, this is not the source preamble.")])
  await transform([element("h2", [text("An actual exposition heading")]), labelled])
  assert.equal(classes(labelled), undefined)
})
