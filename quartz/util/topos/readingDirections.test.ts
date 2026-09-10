import assert from "node:assert/strict"
import test from "node:test"
import prepared from "../../../knowledge/index.json"
import mapping from "../../../knowledge/topos/note-topics.json"
import { attachNoteTopics } from "./atlas"
import { createPublishedModel } from "./published"
import type { KnowledgeIndex } from "../knowledge"
import type { KnowledgeModel, Relation } from "./types"
import {
  createReadingDirectionIndex,
  locateReadingDirection,
  readingDirectionPage,
  readingRelationCategory,
} from "./readingDirections"

function fixture(): KnowledgeModel {
  return {
    version: 1,
    title: "Directional-navigation fixture",
    initial: "current",
    concepts: ["current", "left", "right", "isolated"].map((id) => ({
      id,
      title: id,
      zh: id,
      kind: "concept",
      summary: "Synthetic test object",
      symbol: "",
      terms: [],
      sections: [],
      topicIDs: id === "right" ? ["other"] : ["selected"],
    })),
    sections: [],
    sources: [],
    topics: ["selected", "other"].map((id) => ({
      id,
      title: id,
      color: "#345678",
      description: "Test membership",
    })),
    relations: [
      relation("incoming", "left", "current", "proves", "authored"),
      relation("outgoing", "current", "right", "references", "reference"),
      relation("occurrence", "current", "right", "appears-in", "structure"),
      relation("reverse", "right", "current", "references", "reference"),
    ],
  }
}
function relation(
  id: string,
  source: string,
  target: string,
  type: Relation["type"],
  provenance: Relation["provenance"],
): Relation {
  return {
    id,
    source,
    target,
    type,
    provenance,
    strength: 1,
    lenses: {},
    label: type,
    explanation: `Recorded explanation for ${id}`,
    evidence: `source.html#${id}`,
    evidenceHref: `source.html#${id}`,
  }
}

test("directions retain exact recorded endpoints, types, evidence and parallel edges", () => {
  const model = fixture(),
    before = structuredClone(model)
  const view = createReadingDirectionIndex(model)("current", ["selected"], ["isolated", "left"])
  assert.deepEqual(
    view.incoming.map((entry) => entry.concept.id),
    ["left", "right"],
  )
  assert.deepEqual(
    view.outgoing.map((entry) => entry.concept.id),
    ["right"],
  )
  assert.equal(
    view.outgoing[0].relations.length,
    2,
    "one destination keeps both distinct real relations",
  )
  for (const entry of [...view.incoming, ...view.outgoing])
    for (const edge of entry.relations) {
      assert.equal(
        edge,
        model.relations.find((r) => r.id === edge.id),
      )
      assert.equal(edge.evidenceHref, `source.html#${edge.id}`)
    }
  assert.equal(view.previous?.id, "left")
  assert.equal(view.outgoing[0].inSelection, false, "cross-theme directions remain reachable")
  assert.deepEqual(model, before)
})

test("empty selections preserve real directions; isolated content has navigation history but no fabricated edge", () => {
  const model = fixture(),
    index = createReadingDirectionIndex(model)
  const emptySelection = index("current", [])
  assert.equal(emptySelection.incoming.length, 2)
  assert.equal(emptySelection.outgoing.length, 1)
  assert.ok(
    [...emptySelection.incoming, ...emptySelection.outgoing].every((entry) => !entry.inSelection),
  )
  const isolated = index("isolated", undefined, ["missing", "current", "isolated"])
  assert.equal(isolated.incoming.length, 0)
  assert.equal(isolated.outgoing.length, 0)
  assert.equal(isolated.previous?.id, "current")
})

test("recorded self-reference is retained once, and unknown endpoints fail explicitly", () => {
  const model = fixture()
  model.relations.push(relation("self", "current", "current", "references", "reference"))
  const view = createReadingDirectionIndex(model)("current")
  const self = [...view.incoming, ...view.outgoing]
    .flatMap((entry) => entry.relations)
    .filter((edge) => edge.id === "self")
  assert.equal(self.length, 1)
  assert.ok(view.outgoing.some((entry) => entry.concept.id === "current"))
  model.relations.push(relation("broken", "current", "missing", "references", "reference"))
  assert.throws(
    () => createReadingDirectionIndex(model),
    /Unknown reading direction endpoint: broken/,
  )
  assert.throws(
    () => createReadingDirectionIndex(fixture())("missing"),
    /Unknown reading direction focus/,
  )
})

test("every destination is available through bounded deterministic pages without duplicate identities", () => {
  const model = fixture()
  for (let i = 0; i < 13; i++) {
    const id = `extra-${i.toString().padStart(2, "0")}`
    model.concepts.push({ ...model.concepts[1], id, title: id })
    model.relations.push(relation(`edge-${i}`, "current", id, "references", "reference"))
  }
  const entries = createReadingDirectionIndex(model)("current").outgoing
  const initial = readingDirectionPage(entries, 0)
  const ids: string[] = []
  for (let page = 0; page < initial.pages; page++) {
    const result = readingDirectionPage(entries, page)
    assert.ok(result.items.length <= 4)
    ids.push(...result.items.map((entry) => entry.concept.id))
  }
  assert.equal(ids.length, 14)
  assert.equal(new Set(ids).size, 14)
  assert.deepEqual(
    ids,
    entries.map((entry) => entry.concept.id),
  )
  assert.equal(readingDirectionPage(entries, -9).page, 0)
  assert.equal(readingDirectionPage(entries, NaN).page, 0)
  assert.equal(readingDirectionPage(entries, 999).page, initial.pages - 1)
  const reversed = {
    ...model,
    concepts: [...model.concepts].reverse(),
    relations: [...model.relations].reverse(),
  }
  assert.deepEqual(createReadingDirectionIndex(reversed)("current").outgoing, entries)
})

test("relationship categories remain distinct and never label ordinary references as prerequisites", () => {
  const model = fixture()
  assert.equal(readingRelationCategory(model.relations[0]).label, "原文论证")
  assert.equal(readingRelationCategory(model.relations[1]).label, "正文引用")
  assert.equal(readingRelationCategory(model.relations[2]).label, "出处与归属")
  assert.equal(
    new Set(model.relations.slice(0, 3).map((edge) => readingRelationCategory(edge).color)).size,
    3,
  )
  const unspecified = { ...model.relations[0], provenance: undefined }
  assert.equal(readingRelationCategory(unspecified).label, "已记录关系")
})

test("restoring a destination locates its later page and retains the clicked side for reciprocal links", () => {
  const model = fixture()
  for (let i = 0; i < 12; i++) {
    const id = `extra-${i.toString().padStart(2, "0")}`
    model.concepts.push({ ...model.concepts[1], id, title: id })
    model.relations.push(relation(`edge-${i}`, "current", id, "references", "reference"))
  }
  const view = createReadingDirectionIndex(model)("current")
  assert.deepEqual(locateReadingDirection(view, "extra-10"), { direction: "outgoing", page: 2 })
  assert.deepEqual(locateReadingDirection(view, "right", "outgoing"), {
    direction: "outgoing",
    page: 3,
  })
  assert.deepEqual(locateReadingDirection(view, "right", "incoming"), {
    direction: "incoming",
    page: 0,
  })
  assert.equal(locateReadingDirection(view, "isolated"), undefined)
})

test("all current public relationships remain reachable with exact identities through every reader direction", () => {
  const model = createPublishedModel(prepared as KnowledgeIndex)
  attachNoteTopics(model, mapping)
  const before = JSON.stringify(model)
  const index = createReadingDirectionIndex(model)
  const seen = new Map<string, number>()
  for (const concept of model.concepts) {
    const result = index(concept.id, [model.topics![0].id])
    for (const direction of ["incoming", "outgoing"] as const) {
      const entries = result[direction]
      assert.equal(entries.length, new Set(entries.map((entry) => entry.concept.id)).size)
      for (let page = 0; page < readingDirectionPage(entries, 0).pages; page++)
        for (const entry of readingDirectionPage(entries, page).items)
          for (const edge of entry.relations) {
            assert.equal(direction === "incoming" ? edge.target : edge.source, concept.id)
            assert.equal(direction === "incoming" ? edge.source : edge.target, entry.concept.id)
            assert.ok(edge.evidenceHref)
            seen.set(edge.id, (seen.get(edge.id) ?? 0) + 1)
          }
    }
  }
  assert.equal(seen.size, model.relations.length)
  for (const edge of model.relations)
    assert.equal(seen.get(edge.id), edge.source === edge.target ? 1 : 2)
  assert.equal(JSON.stringify(model), before)
})
