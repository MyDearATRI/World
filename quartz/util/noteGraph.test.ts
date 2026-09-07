import assert from "node:assert/strict"
import test, { describe } from "node:test"
import {
  buildNoteGraph,
  filterNoteGraph,
  buildReaderGraph,
  readerChapterGraph,
  wrapGraphTitle,
  type NoteGraphFile,
  type ReaderGraphCatalog,
} from "./noteGraph"
import type { FullSlug, SimpleSlug } from "./path"

const full = (value: string) => value as FullSlug
const simple = (value: string) => value as SimpleSlug
const note = (slug: string, links: string[] = [], title = slug): NoteGraphFile => ({
  slug: full(slug),
  frontmatter: { title },
  links: links.map(simple),
})

describe("graph title wrapping", () => {
  const measure = (text: string) =>
    Array.from(text).reduce(
      (width, character) => width + (/\p{Script=Han}/u.test(character) ? 2 : 1),
      0,
    )

  test("wraps mixed Chinese and English at word boundaries", () => {
    assert.deepEqual(wrapGraphTitle("第一章 Topological Spaces and 连续映射", 16, measure), [
      "第一章",
      "Topological",
      "Spaces and 连续",
      "映射",
    ])
    assert.deepEqual(wrapGraphTitle("Topology and Fourier", 12, measure), [
      "Topology and",
      "Fourier",
    ])
  })

  test("only splits an English token when the token itself is wider than the line", () => {
    assert.deepEqual(wrapGraphTitle("Topological Spaces", 11, measure), ["Topological", "Spaces"])
    assert.deepEqual(wrapGraphTitle("Topological Spaces", 8, measure), [
      "Topologi",
      "cal",
      "Spaces",
    ])
    assert.deepEqual(wrapGraphTitle("中文测度", 4, measure), ["中文", "测度"])
  })
})

describe("reader hierarchy graph", () => {
  const catalog: ReaderGraphCatalog = {
    books: [
      {
        id: "book",
        title: "Book",
        slug: "book/index",
        chapters: [
          {
            id: "one",
            title: "Chapter one",
            slug: "book/one",
            sections: [{ slug: "reading" }],
            knowledge: ["a", "b", "aux", "unpublished"],
            connections: ["math-example"],
            exercises: [],
            canvas: ["map"],
          },
          {
            id: "two",
            title: "Chapter two",
            slug: "book/two",
            sections: [],
            knowledge: ["c"],
            connections: [],
            exercises: [],
            canvas: [],
          },
        ],
      },
    ],
    pages: Object.fromEntries(
      [
        ["book/index", "book", undefined, false],
        ["book/one", "chapter", "one", false],
        ["a", "knowledge", "one", false],
        ["b", "knowledge", "one", false],
        ["c", "knowledge", "two", false],
        ["reading", "reading", "one", false],
        ["math-example", "connection", "one", false],
        ["aux", "knowledge", "one", true],
        ["unpublished", "knowledge", "one", false],
      ].map(([slug, role, chapterId, auxiliary]) => [
        String(slug),
        {
          slug: String(slug),
          title: String(slug),
          bookId: "book",
          role: String(role),
          chapterId: chapterId as string | undefined,
          auxiliary: Boolean(auxiliary),
        },
      ]),
    ),
  }
  const files = [
    note("book/index"),
    note("book/one"),
    note("book/two"),
    note("a", ["b", "c", "reading", "math-example", "aux", "map", "unpublished"]),
    note("b", ["reading"]),
    note("c"),
    note("reading"),
    {
      ...note("math-example"),
      frontmatter: { title: "A mathematical counterexample", siteKind: "example" },
    },
    note("aux"),
    { ...note("map"), frontmatter: { title: "Canvas", siteKind: "canvas" } },
  ]

  test("book overview is real chapter metadata, not invented ordinary note nodes", () => {
    const graph = buildReaderGraph(files, full("book/index"), catalog)!
    assert.equal(graph.chapters.length, 2)
    assert.equal(graph.initialChapterId, undefined)
    assert.deepEqual(graph.chapters[0].knowledge, ["a", "b"])
    assert.equal(
      graph.nodes.some((node) =>
        ["book/index", "book/one", "aux", "map", "unpublished"].includes(node.id),
      ),
      false,
    )
    assert.equal(buildReaderGraph(files, full("index"), catalog), undefined)
  })

  test("chapter view starts with knowledge; mathematical examples are retained as related content", () => {
    const graph = buildReaderGraph(files, full("book/one"), catalog)!
    assert.equal(graph.initialChapterId, "one")
    assert.deepEqual(
      readerChapterGraph(graph, "one").nodes.map((node) => node.id),
      ["a", "b"],
    )
    assert.equal(graph.nodes.find((node) => node.id === "math-example")?.role, "connection")
  })

  test("focused graph keeps only direct same-chapter references and exposes cross-chapter links separately", () => {
    const graph = buildReaderGraph(files, full("a"), catalog, { focusCurrent: true })!
    assert.equal(graph.initialFocusId, "a")
    const focused = readerChapterGraph(graph, "one", "a")
    assert.deepEqual(
      focused.nodes.map((node) => node.id),
      ["reading", "a", "b", "math-example"],
    )
    assert.deepEqual(
      focused.crossChapter.map((node) => node.id),
      ["c"],
    )
    assert.equal(
      focused.links.every((link) => link.source === "a" || link.target === "a"),
      true,
    )
    assert.deepEqual(readerChapterGraph(graph, "missing"), {
      nodes: [],
      links: [],
      crossChapter: [],
    })
    assert.deepEqual(readerChapterGraph(graph, "one", "aux"), readerChapterGraph(graph, "one"))
  })
})

describe("published note graph", () => {
  test("excludes unpublished, external, and self-link targets without inventing nodes", () => {
    const graph = buildNoteGraph(
      [
        note("index", ["/", "notes/approved", "notes/private", "https://example.com/note"]),
        note("notes/approved"),
        { frontmatter: { title: "No published slug" }, links: [simple("notes/private")] },
      ],
      full("index"),
    )
    assert.deepEqual(
      graph.nodes.map((node) => node.id),
      ["index", "notes/approved"],
    )
    assert.deepEqual(graph.links, [{ source: "index", target: "notes/approved" }])
    assert.equal(graph.nodes[0].current, true)
    assert.equal(graph.nodes[1].current, false)
  })

  test("resolves both home-link forms and folder indexes while keeping nested names distinct", () => {
    const graph = buildNoteGraph(
      [
        note("a/space", ["", "/", "b/space", "notes/"], "Space"),
        note("index"),
        note("b/space", [], "Space"),
        note("notes/index"),
      ],
      full("a/space"),
    )
    assert.deepEqual(graph.links, [
      { source: "a/space", target: "b/space" },
      { source: "a/space", target: "index" },
      { source: "a/space", target: "notes/index" },
    ])
    assert.equal(graph.nodes.filter((node) => node.current).length, 1)
    assert.equal(graph.nodes.find((node) => node.current)?.id, "a/space")
  })

  test("relative hrefs retain the GitHub Pages repository prefix from root and nested pages", () => {
    const files = [note("index"), note("notes/space"), note("notes/index")]
    for (const [current, pageUrl] of [
      ["index", "https://example.github.io/World/"],
      ["notes/space", "https://example.github.io/World/notes/space"],
      ["notes/index", "https://example.github.io/World/notes/"],
    ]) {
      const graph = buildNoteGraph(files, full(current))
      const urls = Object.fromEntries(
        graph.nodes.map((node) => [node.id, new URL(node.href, pageUrl).pathname]),
      )
      assert.deepEqual(urls, {
        index: "/World/",
        "notes/index": "/World/notes/",
        "notes/space": "/World/notes/space",
      })
    }
  })

  test("reciprocal and repeated links form a single undirected edge with stable ordering", () => {
    const files = [note("z", ["b", "a", "b"]), note("b", ["z", "a"]), note("a", ["b", "z"])]
    const graph = buildNoteGraph(files, full("a"))
    assert.deepEqual(graph.links, [
      { source: "a", target: "b" },
      { source: "a", target: "z" },
      { source: "b", target: "z" },
    ])
    assert.deepEqual(graph, buildNoteGraph(files.toReversed(), full("a")))
  })

  test("supports empty and isolated single-note graphs", () => {
    assert.deepEqual(buildNoteGraph([], full("index")), { nodes: [], links: [] })
    assert.deepEqual(buildNoteGraph([{ slug: full("isolated") }], full("index")), {
      nodes: [
        { id: "isolated", title: "isolated", href: "./isolated", current: false, kind: "body" },
      ],
      links: [],
    })
  })

  test("preserves literal title text and leaves the supplied metadata unchanged", () => {
    const title = '<img src=x onerror="alert(1)"> & 数学'
    const files = [note("z", ["/"], title), note("index", ["z"])]
    const before = structuredClone(files)
    for (const file of files) {
      Object.freeze(file.links)
      Object.freeze(file.frontmatter)
      Object.freeze(file)
    }
    Object.freeze(files)
    const graph = buildNoteGraph(files, full("index"))
    assert.equal(graph.nodes.find((node) => node.id === "z")?.title, title)
    assert.deepEqual(files, before)
    graph.nodes[1].title = "Modified output"
    graph.links[0].source = "Modified output"
    assert.deepEqual(files, before)
  })

  test("excludes Canvas pages and retains explicit content metadata", () => {
    const graph = buildNoteGraph(
      [
        {
          ...note("lesson", ["map", "planning"]),
          frontmatter: { title: "Lesson", siteKind: "body", status: "Working", layer: "主体" },
        },
        { ...note("map", ["lesson"]), frontmatter: { title: "Canvas", siteKind: "canvas" } },
        { ...note("planning"), frontmatter: { title: "Plan", siteKind: "plan" } },
        { ...note("example"), frontmatter: { title: "Example", sample: true } },
      ],
      full("lesson"),
    )
    assert.equal(
      graph.nodes.some((node) => node.id === "map"),
      false,
    )
    assert.equal(graph.nodes.find((node) => node.id === "lesson")?.status, "Working")
    assert.equal(graph.nodes.find((node) => node.id === "lesson")?.layer, "主体")
    assert.equal(graph.nodes.find((node) => node.id === "example")?.kind, "example")
    assert.deepEqual(graph.links, [{ source: "lesson", target: "planning" }])
  })

  test("one-hop scope and type filters exclude second-hop and disallowed nodes", () => {
    const graph = buildNoteGraph(
      [
        { ...note("a", ["b", "plan"]), frontmatter: { title: "A", siteKind: "body" } },
        { ...note("b", ["c"]), frontmatter: { title: "B", siteKind: "body" } },
        note("c"),
        { ...note("plan"), frontmatter: { title: "Plan", siteKind: "plan" } },
        { ...note("index", ["a"]), frontmatter: { title: "Home", siteKind: "navigation" } },
      ],
      full("a"),
    )
    assert.deepEqual(
      filterNoteGraph(graph, "a", "local", "all").nodes.map((node) => node.id),
      ["a", "b", "index", "plan"],
    )
    assert.deepEqual(filterNoteGraph(graph, "a", "local", "body").links, [
      { source: "a", target: "b" },
    ])
    assert.deepEqual(
      filterNoteGraph(graph, "a", "global", "plan").nodes.map((node) => node.id),
      ["plan"],
    )
    assert.equal(filterNoteGraph(graph, undefined, "local", "all").nodes.length, 0)
    assert.equal(filterNoteGraph(graph, "missing", "global", "all").nodes.length, 5)
  })
})
