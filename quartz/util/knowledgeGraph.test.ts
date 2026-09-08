import { test } from "node:test"
import assert from "node:assert/strict"
import {
  findKnowledgePath,
  graphBounds,
  graphObjectSize,
  layoutKnowledgeGroups,
  rectanglesOverlap,
  selectKnowledgeFormula,
  splitKnowledgeExcerpt,
  type GraphObject,
  type GraphRelation,
} from "./knowledgeGraph"

test("formula previews prefer intact relations over isolated variables without truncation", () => {
  assert.equal(selectKnowledgeFormula(["f", "V\\subset Y", "f(x_n)\\to f(x)"]), "f(x_n)\\to f(x)")
  assert.equal(selectKnowledgeFormula(["x=" + "a".repeat(200), "f(x) = y"]), "f(x) = y")
  assert.equal(selectKnowledgeFormula(["x".repeat(200)]), undefined)
  assert.equal(selectKnowledgeFormula([]), undefined)
})

test("excerpt parsing preserves source math and leaves HTML as inert text", () => {
  assert.deepEqual(splitKnowledgeExcerpt("For **each** $f(x)\\to y$, [[note|see source]]."), [
    { kind: "text", text: "For each " },
    { kind: "math", text: "f(x)\\to y" },
    { kind: "text", text: ", see source." },
  ])
  assert.deepEqual(splitKnowledgeExcerpt("<img src=x onerror=alert(1)> $x"), [
    { kind: "text", text: "<img src=x onerror=alert(1)> x" },
  ])
})

const object = (id: string, title = id): GraphObject => ({
  id,
  title,
  kind: "atom",
  type: "definition",
  href: `atoms/${id}.html`,
  excerpt: "A complete statement.",
  text: "A complete statement.",
  latex: [],
  aliases: [],
  relatedNotes: [],
})
const edge = (
  source: string,
  target: string,
  provenance: GraphRelation["provenance"] = "reference",
): GraphRelation => ({
  id: `${source}-${target}`,
  source,
  target,
  type: "references",
  provenance,
  evidenceHref: `notes/${source}.html`,
})

test("graph packing accommodates mixed-script labels without overlap", () => {
  const objects = Array.from({ length: 31 }, (_, i) =>
    object(
      `a-${i}`,
      i % 2
        ? "A long mathematical definition of uniform continuity"
        : "度量空间中的连续映射与一致连续映射定义",
    ),
  )
  const { positions } = layoutKnowledgeGroups(objects, [
    { id: "chapter", title: "Chapter", objectIds: objects.map((o) => o.id) },
  ])
  assert.equal(Object.keys(positions).length, 31)
  for (const [i, a] of Object.values(positions).entries())
    for (const b of Object.values(positions).slice(i + 1))
      assert.equal(rectanglesOverlap(a, b, 20), false)
})

test("inserting a node and filtering do not alter cached positions", () => {
  const objects = [object("a"), object("b"), object("c")]
  const groups = [{ id: "chapter", title: "Chapter", objectIds: objects.map((o) => o.id) }]
  const first = layoutKnowledgeGroups(objects, groups)
  const added = object("new")
  const second = layoutKnowledgeGroups(
    [added, ...objects],
    [{ ...groups[0], objectIds: [added.id, ...groups[0].objectIds] }],
    first.positions,
  )
  for (const original of objects)
    assert.deepEqual(second.positions[original.id], first.positions[original.id])
  const subset = layoutKnowledgeGroups(objects.slice(1), groups, second.positions)
  assert.deepEqual(subset.positions.b, first.positions.b)
  assert.equal(rectanglesOverlap(second.positions.new, second.positions.a, 20), false)
})

test("chapter groups are disjoint and every atom is packed once", () => {
  const objects = [
    object("a"),
    object("b"),
    object("c"),
    { ...object("note"), kind: "note" as const },
  ]
  const { bounds, positions } = layoutKnowledgeGroups(objects, [
    { id: "one", title: "One", objectIds: ["a", "b", "note"] },
    { id: "two", title: "Two", objectIds: ["c"] },
  ])
  assert.equal(rectanglesOverlap(bounds.one, bounds.two), false)
  assert.equal(positions.note, undefined)
  assert.deepEqual(Object.keys(positions).sort(), ["a", "b", "c"])
  assert.ok(graphBounds(Object.values(positions)).width > 500)
})

test("formula nodes reserve a formula region and long labels increase height", () => {
  const short = object("a", "Metric")
  assert.equal(
    graphObjectSize({ ...short, latex: ["x^2"] }).height,
    graphObjectSize(short).height + 60,
  )
  assert.ok(
    graphObjectSize(object("b", "Long theorem title ".repeat(12))).height >
      graphObjectSize(short).height,
  )
})

test("path uses real edges and records traversal direction and evidence", () => {
  const objects = [object("a"), object("b"), object("c")]
  const relations = [edge("a", "b", "authored"), edge("c", "b", "structure")]
  const path = findKnowledgePath("a", "c", objects, relations)!
  assert.equal(path.length, 2)
  assert.equal(path[0].relation.provenance, "authored")
  assert.equal(path[1].reversed, true)
  assert.equal(path[1].relation.evidenceHref, "notes/c.html")
})

test("machine similarity is absent from paths unless explicitly enabled", () => {
  const objects = [object("a"), object("b"), object("c")]
  const relations = [edge("a", "b"), edge("b", "c", "similarity")]
  assert.equal(findKnowledgePath("a", "c", objects, relations), null)
  assert.equal(findKnowledgePath("a", "c", objects, relations, true)?.length, 2)
  assert.equal(findKnowledgePath("a", "missing", objects, relations, true), null)
  assert.deepEqual(findKnowledgePath("a", "a", objects, relations), [])
})

test("path traversal terminates for cycles, ignores missing endpoints, and is deterministic", () => {
  const objects = [object("a"), object("b"), object("c"), object("d")]
  const relations = [edge("a", "b"), edge("b", "c"), edge("c", "a"), edge("c", "ghost")]
  assert.equal(findKnowledgePath("a", "d", objects, relations), null)
  assert.deepEqual(
    findKnowledgePath("b", "c", objects, relations),
    findKnowledgePath("b", "c", objects, [...relations].reverse()),
  )
})
