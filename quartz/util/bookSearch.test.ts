import assert from "node:assert/strict"
import { test } from "node:test"
import type { QuartzPluginData } from "../plugins/vfile"
import {
  buildBookDocuments,
  bookHighlightParts,
  bookResultHref,
  bookSearchTokens,
  bookSnippet,
  createBookSearch,
  cleanBookSnippet,
  bookExpositionText,
  type BookDocument,
} from "./bookSearch"

const document = (slug: string, extra: Partial<BookDocument> = {}): BookDocument => ({
  slug,
  title: slug,
  aliases: [],
  headings: [],
  text: "",
  tags: [],
  kind: "body",
  status: "",
  layer: "",
  type: "",
  bookTitle: "",
  chapterTitle: "",
  role: "reading",
  auxiliary: false,
  ...extra,
})

test("book search derives published metadata and excludes Canvas pages", () => {
  const files = [
    {
      slug: "body/metric",
      text: " A\nmetric  space ",
      toc: [{ text: "Open balls" }],
      frontmatter: {
        title: "度量空间",
        aliases: ["Metric space"],
        siteKind: "body",
        status: "Working",
        layer: "主体",
        type: "lecture",
      },
    },
    { slug: "plan/topology", frontmatter: { title: "拓扑规划", siteKind: "plan" } },
    {
      slug: "canvas/map",
      text: "private-ish canvas title",
      frontmatter: { title: "Map", siteKind: "canvas" },
    },
  ] as unknown as QuartzPluginData[]
  const docs = buildBookDocuments(files)
  assert.equal(docs.length, 2)
  assert.equal(docs[0].title, "度量空间")
  assert.deepEqual(docs[0].aliases, ["Metric space"])
  assert.deepEqual(docs[0].headings, ["Open balls"])
  assert.equal(docs[0].text, "A metric space")
  assert.equal(docs[0].status, "Working")
  assert.equal(docs[1].kind, "plan")
})

test("bilingual encoding and title/alias ranking beat body-only mentions", () => {
  const docs = [
    document("body/review", { title: "Review", text: "We discuss compactness and 度量空间 here." }),
    document("body/metric", {
      title: "度量空间",
      aliases: ["Metric space"],
      text: "Open balls define a topology.",
    }),
    document("body/compact", { title: "Compactness", aliases: ["紧致性"] }),
  ]
  const search = createBookSearch(docs)
  assert.deepEqual(bookSearchTokens("度量 compactness"), ["度", "量", "compactness"])
  assert.equal(search("度量")[0].slug, "body/metric")
  assert.equal(search("COMPACTNESS")[0].slug, "body/compact")
  assert.equal(search("metric space")[0].slug, "body/metric")
  assert.equal(search("紧致性")[0].slug, "body/compact")
  assert.equal(search("compac")[0].slug, "body/compact")
})

test("headings, tags and cross-field words are searchable with semantic filtering", () => {
  const docs = [
    document("body/main", {
      title: "Topology",
      headings: ["Sequential compactness"],
      tags: ["analysis"],
      text: "Metric spaces",
    }),
    document("plan/main", { title: "Topology plan", kind: "plan", text: "Metric spaces" }),
    document("examples/main", { title: "Topology example", kind: "example" }),
  ]
  const search = createBookSearch(docs)
  assert.equal(search("sequential")[0].slug, "body/main")
  assert.equal(search("analysis")[0].slug, "body/main")
  assert.equal(search("topology metric", "body")[0].slug, "body/main")
  assert.deepEqual(
    search("topology", "plan").map((doc) => doc.slug),
    ["plan/main"],
  )
  assert.deepEqual(
    search("topology", "example").map((doc) => doc.slug),
    ["examples/main"],
  )
  assert.deepEqual(search("no_such_topic_9814"), [])
  assert.deepEqual(search("  "), [])
})

test("search links preserve the project subpath and reject path traversal", () => {
  assert.equal(
    bookResultHref("https://example.org/World/", "notes/度量空间"),
    "https://example.org/World/notes/%E5%BA%A6%E9%87%8F%E7%A9%BA%E9%97%B4",
  )
  assert.equal(bookResultHref("https://example.org/World/", "index"), "https://example.org/World/")
  assert.equal(
    bookResultHref("https://example.org/World/", "body/index"),
    "https://example.org/World/body/",
  )
  assert.throws(() => bookResultHref("https://example.org/World/", "../secret"))
  assert.throws(() => bookResultHref("https://example.org/World/", "/outside"))
})

test("snippets reveal a nearby match and highlighting preserves untrusted text literally", () => {
  const doc = document("body/long", {
    text: `${"Introduction. ".repeat(60)}Compactness is the key here. ${"Afterwards. ".repeat(40)}`,
  })
  const snippet = bookSnippet(doc, "compactness")
  assert.ok(snippet.includes("Compactness"))
  assert.ok(snippet.length <= 172)
  const dangerous = '<img src=x onerror="alert(1)"> compactness'
  const parts = bookHighlightParts(dangerous, "compactness")
  assert.equal(parts.map((part) => part.text).join(""), dangerous)
  assert.equal(parts.filter((part) => part.match)[0].text, "compactness")
  assert.deepEqual(bookHighlightParts("x + y", "+"), [
    { text: "x ", match: false },
    { text: "+", match: true },
    { text: " y", match: false },
  ])
})

test("reading search excludes auxiliaries by default and scopes before limiting results", () => {
  const search = createBookSearch([
    document("a/reading", { title: "Compactness", bookId: "a" }),
    document("b/reading", { title: "Compactness", bookId: "b" }),
    document("a/plan", {
      title: "Compactness plan",
      bookId: "a",
      role: "auxiliary",
      auxiliary: true,
    }),
  ])
  assert.deepEqual(
    search("compactness", { bookId: "a" }).map((doc) => doc.slug),
    ["a/reading"],
  )
  assert.equal(search("compactness").length, 2)
  assert.equal(search("compactness", { bookId: "a", includeAuxiliary: true }).length, 2)
  assert.equal(search("compactness", { bookId: "b" }, 1)[0].slug, "b/reading")
})

test("snippet text uses exposition and removes repeated tags and PDF maintenance labels", () => {
  const doc = document("a/compact", {
    text: "#用途/正文 PDF 158（来源 PDF，第158页，原文件未公开） metadata",
    snippetText: "Compactness supplies a finite subcover for every open cover.",
  })
  assert.equal(bookSnippet(doc, "compactness"), doc.snippetText)
  assert.ok(!cleanBookSnippet(doc.text).includes("#用途"))
  assert.ok(!cleanBookSnippet(doc.text).includes("原文件未公开"))
})

test("search exposition includes one visible math representation without TeX annotation duplicates", () => {
  const text = (value: string) => ({ type: "text" as const, value })
  const span = (className: string, children: any[]) => ({
    type: "element" as const,
    tagName: "span",
    properties: { className: [className] },
    children,
  })
  const paragraph = {
    type: "element" as const,
    tagName: "p",
    properties: {},
    children: [
      text("A point "),
      span("katex", [
        span("katex-mathml", [text("x ∈ X"), text("x \\in X")]),
        span("katex-html", [text("x ∈ X")]),
      ]),
      text(" has a neighbourhood."),
    ],
  }
  assert.equal(bookExpositionText(paragraph), "A point x ∈ X has a neighbourhood.")
})
