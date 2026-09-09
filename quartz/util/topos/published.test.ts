import test from "node:test"
import assert from "node:assert/strict"
import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import { toHtml } from "hast-util-to-html"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkRehype from "remark-rehype"
import rehypeKatex from "rehype-katex"
import prepared from "../../../knowledge/index.json"
import type { KnowledgeIndex, KnowledgeObject } from "../knowledge"
import {
  buildPublishedTopos,
  createPublishedModel,
  publishedInitial,
  publishedSectionId,
  relocatePublishedTree,
} from "./published"

const index = prepared as KnowledgeIndex
const root = (text: string): Root => ({
  type: "root",
  children: [
    { type: "element", tagName: "p", properties: {}, children: [{ type: "text", value: text }] },
  ],
})
const fixtureIndex = (): KnowledgeIndex => {
  const note = (slug: string): KnowledgeObject => ({
    id: `note:${slug}`,
    kind: "note",
    type: "knowledge",
    title: slug,
    href: `${slug}.html`,
    sourceSlug: slug,
    excerpt: "Exact source excerpt.",
    text: "Original complete mathematical exposition.",
    latex: [],
    aliases: [],
    relatedNotes: [],
  })
  return {
    version: 1,
    snapshotHash: "fixture",
    groups: [],
    objects: [
      note("notes/metric"),
      note("notes/second"),
      {
        id: "a-test",
        kind: "atom",
        type: "theorem",
        title: "Continuity equivalence",
        href: "atoms/a-test.html",
        sourceHref: "notes/metric.html#atom-a-test",
        sourceSlug: "notes/metric",
        excerpt: "The same statement.",
        text: "The same statement with original hypotheses.",
        latex: ["f:X\\to Y"],
        aliases: ["连续性"],
        proofStatus: "原文证明状态保留",
        occurrences: [
          { slug: "notes/metric", anchor: "atom-a-test", href: "notes/metric.html#atom-a-test" },
          { slug: "notes/second", anchor: "atom-a-old", href: "notes/second.html#atom-a-old" },
        ],
        relatedNotes: ["note:notes/metric", "note:notes/second"],
      },
    ],
    aliases: [{ id: "a-old", canonicalId: "a-test", href: "atoms/a-old.html" }],
    relations: [
      {
        id: "r-test",
        source: "a-test",
        target: "note:notes/metric",
        type: "appears-in",
        provenance: "structure",
        evidenceHref: "notes/metric.html#atom-a-test",
      },
    ],
    diagnostics: [
      { code: "no-explicit-atom", slug: "notes/second", message: "Full source retained." },
    ],
  }
}

test("published model contains all 119 atoms and 73 complete notes with unchanged identity and provenance", () => {
  const before = JSON.stringify(index)
  const model = createPublishedModel(index)
  assert.equal(model.mode, "published")
  assert.equal(model.initial, publishedInitial)
  assert.equal(model.snapshotHash, index.snapshotHash)
  assert.equal(model.concepts.length, 192)
  assert.deepEqual(model.stats, { atoms: 119, notes: 73, relations: 605, unregisteredNotes: 25 })
  assert.deepEqual(
    model.concepts.map((c) => c.id),
    index.objects.map((o) => o.id),
  )
  for (const object of index.objects) {
    const concept = model.concepts.find((c) => c.id === object.id)!
    assert.equal(concept.href, object.href)
    assert.equal(concept.proofStatus, object.proofStatus)
    assert.deepEqual(concept.occurrences, object.occurrences)
    assert.deepEqual(concept.aliases, object.aliases)
    assert.equal(concept.mathType, object.type)
    assert.ok(concept.searchText!.includes(object.text))
    for (const note of object.relatedNotes) assert.ok(concept.relatedNotes!.includes(note))
  }
  assert.equal(JSON.stringify(index), before)
})

test("all 605 actual links keep exact direction, relation type, category and evidence", () => {
  const model = createPublishedModel(index)
  assert.equal(model.relations.length, 605)
  const categories: Record<string, number> = {}
  for (const edge of model.relations) {
    const original = index.relations.find((r) => r.id === edge.id)!
    assert.deepEqual(
      {
        source: edge.source,
        target: edge.target,
        type: edge.type,
        provenance: edge.provenance,
        evidenceHref: edge.evidenceHref,
      },
      {
        source: original.source,
        target: original.target,
        type: original.type,
        provenance: original.provenance,
        evidenceHref: original.evidenceHref,
      },
    )
    categories[edge.provenance!] = (categories[edge.provenance!] ?? 0) + 1
    assert.ok(!["prerequisite", "dependency", "equivalence"].includes(edge.type))
  }
  assert.deepEqual(categories, { reference: 323, structure: 272, authored: 10 })
})

test("book/chapter catalog metadata cannot determine published scene organization", () => {
  const altered = structuredClone(index)
  altered.groups = [
    {
      id: "invented-book",
      title: "Different source organization",
      objectIds: altered.objects.map((o) => o.id),
      bookId: "different",
    },
  ]
  for (const object of altered.objects) {
    object.bookId = "different"
    object.chapterId = "reordered"
  }
  assert.deepEqual(createPublishedModel(altered), createPublishedModel(index))
  const model = createPublishedModel(index)
  assert.ok(!("groups" in model) && !("chapters" in model))
  assert.deepEqual(
    model.lenses!.map((l) => l.label),
    ["来源与联系", "原文论证", "正文引用"],
  )
})

test("all 25 notes without registered atoms still have their own complete body entry", () => {
  const model = createPublishedModel(index)
  const missing = index.diagnostics!.filter((d) => d.code === "no-explicit-atom")
  assert.equal(missing.length, 25)
  for (const item of missing) {
    const id = `note:${item.slug}`
    assert.ok(model.concepts.some((c) => c.id === id && c.objectKind === "note"))
    assert.ok(
      model.sections.some((s) => s.id === publishedSectionId(id, "body") && s.role === "body"),
    )
  }
})

test("multiple occurrences share one atom body while full notes and required context remain independent", () => {
  const index = fixtureIndex()
  const primary = {
    id: "a-test",
    occurrenceId: "a-test",
    before: root("Let X and Y be metric spaces."),
    tree: root("The same statement."),
    context: root("The original argument is retained here."),
  }
  const repeated = {
    id: "a-test",
    occurrenceId: "a-old",
    before: root(""),
    tree: root("A summary occurrence; do not duplicate the canonical body."),
    context: root(""),
  }
  const sources = [
    {
      slug: "notes/metric",
      tree: root("First complete note with all original mathematics."),
      fragments: [primary],
      status: "Working",
      layer: "主体",
    },
    {
      slug: "notes/second",
      tree: root("Second complete note, including paragraphs without registered atoms."),
      fragments: [repeated],
    },
  ]
  const before = JSON.stringify(sources)
  const result = buildPublishedTopos(index, sources, { initial: "a-test" })
  assert.equal(result.model.concepts.filter((c) => c.id === "a-test").length, 1)
  const body = result.sections["body:a-test"]
  assert.equal(body.match(/The same statement/g)?.length, 1)
  assert.ok(body.indexOf("Let X and Y") < body.indexOf("The same statement"))
  assert.ok(!body.includes("summary occurrence"))
  assert.ok(result.sections["context:a-test"].includes("original argument"))
  assert.ok(
    result.sections["body:note:notes/second"].includes("paragraphs without registered atoms"),
  )
  assert.equal(result.model.concepts.find((c) => c.id === "a-test")!.occurrences!.length, 2)
  assert.equal(result.model.concepts.find((c) => c.id === "a-test")!.sourceStatus, "Working")
  assert.equal(result.model.concepts.find((c) => c.id === "a-test")!.sourceLayer, "主体")
  assert.equal(
    result.model.concepts.find((c) => c.id === "a-test")!.proofStatus,
    "原文证明状态保留",
  )
  assert.deepEqual(result.model.sections.find((s) => s.id === "body:a-test")!.children, [
    "context:a-test",
  ])
  assert.equal(JSON.stringify(sources), before)
})

test("Markdown math, footnotes, local anchors and source-relative object/Canvas/image links survive relocation", async () => {
  const source = String.raw`## Setting

Let $X$ be a metric space. A complete statement keeps this assumption.[^one]

$$
d(x,z)\le d(x,y)+d(y,z).
$$

[Second note](second.html) · [Same object](../atoms/a-old.html) · [Canvas](../maps/author-map.html)

![Source illustration](../assets/diagram.svg)

[^one]: The source footnote belongs to this statement.
`
  const pipeline = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypeKatex, { output: "htmlAndMathml" })
  const tree = (await pipeline.run(pipeline.parse(source))) as Root
  const original = JSON.stringify(tree)
  const moved = relocatePublishedTree(tree, "notes/metric", "body:a-test", fixtureIndex())
  const html = toHtml(moved)
  assert.ok(html.includes("<math"), "MathML must remain in the actual rendered output")
  assert.ok(html.includes("katex-html"))
  assert.ok(html.includes("source footnote belongs"))
  const elements: Element[] = []
  visit(moved, "element", (node) => {
    elements.push(node)
  })
  const ids = elements.flatMap((node) =>
    typeof node.properties.id === "string" ? [node.properties.id] : [],
  )
  assert.equal(ids.length, new Set(ids).size)
  for (const node of elements) {
    const href = node.properties.href
    if (typeof href === "string" && href.startsWith("#"))
      assert.ok(ids.includes(decodeURIComponent(href.slice(1))), href)
  }
  assert.ok(
    elements.some(
      (node) =>
        node.properties["data-concept-target"] === "note:notes/second" &&
        node.properties.href === "./notes/second.html",
    ),
  )
  assert.ok(
    elements.some(
      (node) =>
        node.properties["data-concept-target"] === "a-test" &&
        node.properties.href === "./atoms/a-old.html",
    ),
  )
  assert.ok(
    elements.some(
      (node) =>
        node.properties.href === "./maps/author-map.html" &&
        !node.properties["data-concept-target"],
    ),
  )
  assert.ok(elements.some((node) => node.properties.src === "./assets/diagram.svg"))
  assert.equal(JSON.stringify(tree), original)
})

test("footnotes omitted from an atom keep real source backlinks; repeated local IDs fail instead of misbinding", () => {
  const fragment: Root = {
    type: "root",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: { href: "#user-content-fnref-other", dataFootnoteBackref: true },
        children: [{ type: "text", value: "Back" }],
      },
    ],
  }
  const moved = relocatePublishedTree(fragment, "notes/metric", "context:a-test", fixtureIndex())
  const link = moved.children[0] as Element
  assert.equal(link.properties.href, "./notes/metric.html#user-content-fnref-other")
  assert.equal(link.properties["data-concept-target"], undefined)
  const duplicate: Root = {
    type: "root",
    children: [
      { type: "element", tagName: "p", properties: { id: "duplicate" }, children: [] },
      { type: "element", tagName: "p", properties: { id: "duplicate" }, children: [] },
    ],
  }
  assert.throws(
    () => relocatePublishedTree(duplicate, "notes/metric", "body:a-test", fixtureIndex()),
    /Duplicate published section ID/,
  )
})

test("missing relations, occurrence sources, rendered bodies and canonical fragments stop preparation", () => {
  const bad = fixtureIndex()
  bad.relations[0].target = "missing"
  assert.throws(
    () => createPublishedModel(bad, { initial: "a-test" }),
    /Dangling published relation/,
  )
  const occurrence = fixtureIndex()
  occurrence.objects[2].occurrences![0].slug = "missing"
  assert.throws(
    () => createPublishedModel(occurrence, { initial: "a-test" }),
    /Missing public occurrence/,
  )
  assert.throws(
    () => buildPublishedTopos(fixtureIndex(), [], { initial: "a-test" }),
    /Missing rendered public note/,
  )
  assert.throws(
    () =>
      buildPublishedTopos(
        fixtureIndex(),
        [
          { slug: "notes/metric", tree: root("first") },
          { slug: "notes/second", tree: root("second") },
        ],
        { initial: "a-test" },
      ),
    /Missing or ambiguous rendered public atom/,
  )
})
