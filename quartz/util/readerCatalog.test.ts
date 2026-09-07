import test from "node:test"
import assert from "node:assert/strict"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import { extractReaderMetadata } from "../plugins/transformers/readerMetadata"
import { buildReaderCatalog, getReaderCatalog, readerSlug } from "./readerCatalog"
import type { ReaderConfig, ReaderFile } from "./readerCatalog"

const root = "Book"
const chapter = `${root}/第一章`
const slug = readerSlug
const config: ReaderConfig = {
  books: [
    {
      id: "book",
      title: "A mathematical book",
      subtitle: "Reading",
      source: "An identified source",
      root,
      slug: "Book/Entry",
      contentsSlug: "Book/Contents",
      chapters: [{ id: "chapter-1", root: chapter, slug: `${chapter}/Entry` }],
      sectionKnowledge: [{ slug: `${chapter}/知识/Supplement`, sections: ["1.2"] }],
    },
  ],
  auxiliaryPaths: ["Examples"],
}

function file(path: string, source = "", siteKind = "body", title = path): ReaderFile {
  const fullSlug = slug(path)
  const tree = unified().use(remarkParse).use(remarkGfm).parse(source)
  return {
    slug: fullSlug,
    frontmatter: { title, siteKind },
    readerMetadata: extractReaderMetadata(tree, fullSlug),
  }
}

function fixture(): ReaderFile[] {
  return [
    file("Book/Entry", "", "navigation"),
    file(
      "Book/Contents",
      `## Chapter 1\n### 1.1 First\n[[${chapter}/研读/1.1 First]] [[${chapter}/知识/Shared]]\n### 1.2 Second\n[[${chapter}/研读/1.2 Second]] [[${chapter}/知识/Shared]]`,
      "navigation",
    ),
    file(
      `${chapter}/Entry`,
      `[[${chapter}/研读/1.1 First]] [[${chapter}/研读/1.2 Second]]\n[[${chapter}/知识/Shared]] [[${chapter}/知识/Supplement]]\n[[maps/Diagram]]`,
      "navigation",
      "First chapter",
    ),
    file(`${chapter}/研读/1.2 Second`),
    file(`${chapter}/研读/1.1 First`),
    file(`${chapter}/知识/Shared`, "", "example", "Example of a theorem"),
    file(`${chapter}/知识/Supplement`),
    file(`${chapter}/联系/A comparison`),
    file(`${chapter}/第一章 习题与原书核校`),
    file("Book/写作规划/Later", "", "plan"),
    file("Examples/Demonstration", "", "example"),
    file("maps/Diagram", "", "canvas"),
    file("index", "", "navigation"),
  ]
}

test("source heading groups preserve many-to-many section knowledge and explicit supplements", () => {
  const files = fixture()
  const original = structuredClone(files)
  const catalog = buildReaderCatalog(files, config)
  const first = catalog.books[0].chapters[0]
  assert.deepEqual(
    first.sections.map((section) => section.number),
    ["1.1", "1.2"],
  )
  assert.deepEqual(first.sections[0].knowledge, [slug(`${chapter}/知识/Shared`)])
  assert.deepEqual(first.sections[1].knowledge, [
    slug(`${chapter}/知识/Shared`),
    slug(`${chapter}/知识/Supplement`),
  ])
  assert.deepEqual(
    catalog.pages[slug(`${chapter}/知识/Shared`)].sections,
    first.sections.map((section) => section.slug),
  )
  assert.deepEqual(first.exercises, [slug(`${chapter}/第一章 习题与原书核校`)])
  assert.deepEqual(first.canvas, ["maps/Diagram"])
  assert.equal(catalog.pages[slug(`${chapter}/知识/Shared`)].auxiliary, false)
  assert.equal(catalog.pages["Examples/Demonstration"].auxiliary, true)
  assert.equal(catalog.pages["maps/Diagram"].role, "auxiliary")
  assert.deepEqual(catalog.books[0].plans, ["Book/写作规划/Later"])
  assert.deepEqual(catalog.diagnostics, [])
  assert.deepEqual(files, original)
  assert.deepEqual(buildReaderCatalog(files.slice().reverse(), config), catalog)
})

test("new knowledge, unindexed readings and new chapters remain visible with diagnostics", () => {
  const files = fixture().concat([
    file(`${chapter}/知识/New result`),
    file(`${chapter}/研读/1.10 Later`),
    file("Book/第四章/Entry", "[[Book/第四章/研读/4.1 New reading]]", "navigation"),
    file("Book/第四章/研读/4.1 New reading"),
    file("Book/第四章/知识/New chapter theorem"),
  ])
  const catalog = buildReaderCatalog(files, config)
  assert(catalog.books[0].chapters[0].knowledge.includes(slug(`${chapter}/知识/New result`)))
  assert.equal(catalog.books[0].chapters[0].sections.at(-1)?.number, "1.10")
  assert.equal(catalog.books[0].chapters[1].sections[0].number, "4.1")
  assert(
    catalog.books[0].chapters[1].knowledge.includes(slug("Book/第四章/知识/New chapter theorem")),
  )
  for (const code of ["unconfigured-chapter", "unindexed-reading", "unmapped-knowledge"])
    assert(catalog.diagnostics?.some((item) => item.code === code))
})

test("only published targets participate, absent configuration is diagnosed, and empty input is safe", () => {
  const files = fixture().filter((entry) => !entry.slug?.endsWith("Supplement"))
  files
    .find((entry) => entry.slug === slug(`${chapter}/Entry`))!
    .readerMetadata!.links.push("Private/Hidden", "https://example.com", "maps/Missing")
  const catalog = buildReaderCatalog(files, config)
  assert.equal(catalog.pages["Private/Hidden"], undefined)
  assert(catalog.diagnostics?.some((item) => item.code === "missing-config-target"))
  assert.deepEqual(catalog.books[0].chapters[0].canvas, ["maps/Diagram"])
  assert.equal(buildReaderCatalog([], config).books.length, 0)
  assert.deepEqual(Object.keys(buildReaderCatalog([], { books: [] }).pages), [])
})

test("metadata excludes code, handles aliases, nested headings, escaped table pipes and local Markdown links", () => {
  const source =
    "## Reading\n[[Book/Note#A|label]]\n### 1.1 Section\n[[Book/One]]\n#### Detail\n[[Book/Two]]\n`[[Secret/Inline]]`\n\n```md\n[[Secret/Code]]\n```\n\n[local](../Note.md#anchor) [external](https://example.com)\n\n| Note |\n| --- |\n| [[Book/Three\\|alias]] |\n\n### 1.2 Next\n[[Book/Four]]"
  const metadata = file("Book/Chapter/Entry", source).readerMetadata!
  assert.deepEqual(metadata.links, ["Book/Note", "Book/One", "Book/Two", "Book/Three", "Book/Four"])
  assert.deepEqual(metadata.headings.find((heading) => heading.title === "1.1 Section")?.links, [
    "Book/One",
    "Book/Two",
    "Book/Note",
    "Book/Three",
  ])
  assert.deepEqual(metadata.headings.find((heading) => heading.title === "1.2 Next")?.links, [
    "Book/Four",
  ])
})

test("cache shares only the same file array and root index has an explicit page record", () => {
  const files = [file("index", "", "navigation", "Home")]
  assert.strictEqual(getReaderCatalog(files), getReaderCatalog(files))
  assert.notStrictEqual(getReaderCatalog(files), getReaderCatalog([...files]))
  assert.equal(getReaderCatalog(files).pages.index.title, "Home")
  assert.equal(readerSlug("A B/C & D.md"), "A-B/C--and--D")
})

test("exact auxiliary navigation pages do not suppress future notes in same-named directories", () => {
  const files = [
    file("index", "", "navigation"),
    file("笔记科学与逻辑", "", "navigation"),
    file("笔记主体/笔记主体", "", "navigation"),
    file("知识主干", "", "navigation"),
    file("笔记主体/书籍/Simon实分析/Simon - Real Analysis - Contents", "", "navigation"),
    file("知识主干/完整的定理"),
    file("笔记科学与逻辑/实际论述"),
    file("笔记主体/发现归档", "A genuine mathematical excerpt.", "navigation"),
  ]
  const catalog = buildReaderCatalog(files)
  for (const entry of files.slice(0, 5)) assert.equal(catalog.pages[entry.slug!].auxiliary, true)
  for (const entry of files.slice(5)) assert.equal(catalog.pages[entry.slug!].auxiliary, false)
  assert.equal(catalog.pages["笔记主体/发现归档"].role, "other")
})
