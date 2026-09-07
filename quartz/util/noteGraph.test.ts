import assert from "node:assert/strict"
import test, { describe } from "node:test"
import { buildNoteGraph, filterNoteGraph, type NoteGraphFile } from "./noteGraph"
import type { FullSlug, SimpleSlug } from "./path"

const full = (value: string) => value as FullSlug
const simple = (value: string) => value as SimpleSlug
const note = (slug: string, links: string[] = [], title = slug): NoteGraphFile => ({
  slug: full(slug),
  frontmatter: { title },
  links: links.map(simple),
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
