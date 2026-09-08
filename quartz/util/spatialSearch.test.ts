import test from "node:test"
import assert from "node:assert/strict"
import { createSpatialSearch, spatialTerms } from "./spatialSearch"
import type { KnowledgeObject } from "./knowledge"
const object = (
  id: string,
  title: string,
  text: string,
  aliases: string[] = [],
): KnowledgeObject => ({
  id,
  title,
  text,
  aliases,
  kind: "atom",
  type: "definition",
  href: `${id}.html`,
  excerpt: text,
  latex: [],
  relatedNotes: [],
})
test("mathematical notation can be found through LaTeX or common symbols", () => {
  assert.deepEqual(spatialTerms("∀ ε ∈ ℝ"), spatialTerms("\\forall \\epsilon \\in \\mathbb R"))
  const search = createSpatialSearch([object("a", "Metric", "For every point, \\forall x \\in X")])
  assert.equal(search("∀", () => true)[0]?.id, "a")
})
test("Chinese substrings and real aliases rank before incidental prose", () => {
  const search = createSpatialSearch([
    object("body", "Discussion", "This proof uses compactness and 度量"),
    object("metric", "Metric spaces", "Distances", ["度量空间"]),
    object("compact", "Compactness", "Finite subcovers"),
  ])
  assert.equal(search("度量", () => true)[0]?.id, "metric")
  assert.equal(search("compactness", () => true)[0]?.id, "compact")
  assert.equal(search("compactness", (o) => o.id !== "compact")[0]?.id, "body")
})
