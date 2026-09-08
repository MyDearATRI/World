import test from "node:test"
import assert from "node:assert/strict"
import {
  extractAtomCandidates,
  reconcileAtoms,
  type AtomOverrides,
  type AtomRegistry,
} from "./lib/atomSource"

const rules: AtomOverrides = { exclude: [], paragraphs: [], merges: [] }
const empty: AtomRegistry = { version: 1, nextId: 1, entries: [] }
const scan = (value: string, overrides = rules) =>
  extractAtomCandidates(value, "book/note", overrides)

test("callouts, semantic headings, and mathematics remain source-derived", () => {
  const candidates = scan(
    "> [!definition] Metric\n> Let $d:X\\times X\\to[0,\\infty)$ satisfy the axioms.\n\n## THM — A result\n\nFor $x=1$ we have\n\n$$\nx^2=1.\n$$\n\n### Proof — Calculation\n\nSquare $1$.\n\n## Source trail\n\nReference.",
  )
  assert.equal(candidates.length, 3)
  assert.deepEqual(
    candidates.map((item) => item.type),
    ["definition", "theorem", "proof"],
  )
  assert.equal(candidates[1].relatedProof, "Proof — Calculation")
  assert.ok(candidates[1].text.includes("Square $1$"))
  assert.ok(!candidates[1].text.includes("Source trail"))
  assert.ok(candidates[0].latex.includes("d:X\\times X\\to[0,\\infty)"))
})

test("reviewed summary exclusion is exact and keeps mathematical examples", () => {
  const overrides: AtomOverrides = {
    ...rules,
    exclude: [{ slug: "book/note", title: "Summary", reason: "Not one theorem" }],
  }
  const candidates = scan(
    "> [!theorem] Summary\n> This chapter has two topics.\n\n> [!example] Example\n> A counterexample.\n\n> [!proof-strategy] Approach\n> Not a complete proof.",
    overrides,
  )
  assert.deepEqual(
    candidates.map((item) => item.type),
    ["example", "proof-strategy"],
  )
  assert.ok(candidates[1].text.includes("Not a complete proof"))
})

test("ordinary paragraph extraction requires explicit reviewed identity and range", () => {
  const input =
    "A setting.\n\nLet the proof begin.\n\nNow prove the reverse implication.\n\nA separate remark."
  assert.equal(scan(input).length, 0)
  const overrides: AtomOverrides = {
    ...rules,
    paragraphs: [
      {
        slug: "book/note",
        startsWith: "Let the proof begin.",
        title: "Two directions",
        type: "proof",
        paragraphCount: 2,
      },
    ],
  }
  const candidate = scan(input, overrides)[0]
  assert.ok(candidate.text.includes("reverse implication"))
  assert.ok(!candidate.text.includes("separate remark"))
  assert.throws(() => scan(input.replace("Now prove", "## Now prove"), overrides), /range changed/)
})

test("insertion and source reordering preserve assigned IDs", () => {
  const first = reconcileAtoms(scan("> [!definition] A\n> One.\n\n> [!theorem] B\n> Two."), empty)
  const updated = reconcileAtoms(
    scan("> [!lemma] C\n> Three.\n\n> [!theorem] B\n> Two.\n\n> [!definition] A\n> One."),
    first,
  )
  assert.equal(updated.entries.find((item) => item.title === "A")?.id, "a-000001")
  assert.equal(updated.entries.find((item) => item.title === "B")?.id, "a-000002")
  assert.equal(updated.entries.find((item) => item.title === "C")?.id, "a-000003")
})

test("unique unchanged body preserves identity through title rename", () => {
  const first = reconcileAtoms(
    scan("> [!definition] Old title\n> A distance satisfies axioms."),
    empty,
  )
  const renamed = reconcileAtoms(
    scan("> [!definition] New title\n> A distance satisfies axioms."),
    first,
  )
  assert.equal(renamed.entries[0].id, first.entries[0].id)
  assert.equal(renamed.entries[0].title, "New title")
})

test("body edits retain a unique exact locator and removed IDs are never reused", () => {
  const first = reconcileAtoms(scan("> [!definition] A\n> Old prose."), empty)
  const edited = reconcileAtoms(scan("> [!definition] A\n> Corrected prose."), first)
  assert.equal(edited.entries[0].id, first.entries[0].id)
  assert.notEqual(edited.entries[0].fingerprint, first.entries[0].fingerprint)
  const removed = reconcileAtoms([], edited)
  const added = reconcileAtoms(scan("> [!definition] B\n> Different prose."), removed)
  assert.equal(added.entries.find((item) => item.title === "B")?.id, "a-000002")
})

test("duplicate locators and ambiguous renamed bodies stop identity assignment", () => {
  assert.throws(
    () => reconcileAtoms(scan("> [!definition] A\n> One.\n\n> [!definition] A\n> Two."), empty),
    /Ambiguous/,
  )
  const first = reconcileAtoms(
    scan("> [!definition] A\n> Same prose.\n\n> [!definition] B\n> Same prose."),
    empty,
  )
  assert.throws(() => reconcileAtoms(scan("> [!definition] C\n> Same prose."), first), /Ambiguous/)
})

test("code demonstrations do not create mathematical objects", () => {
  assert.equal(
    scan(
      "```md\n> [!theorem] Fake\n> example syntax\n```\n\n## Proof coverage\n\nA maintenance list.",
    ).length,
    0,
  )
})

test("authored observations and questions are atomic without upgrading them to theorems", () => {
  const input =
    "> [!insight] IDEA — A structural observation\n> A limited interpretation, not a new theorem.\n\n^stable-insight-source\n\n> [!question] An open question\n> Is the stronger claim true?\n\n> [!warning] Caution\n> Keep the hypotheses."
  const candidates = scan(input)
  assert.deepEqual(
    candidates.map((item) => item.type),
    ["observation", "question"],
  )
  assert.ok(candidates[0].text.includes("not a new theorem"))
  assert.ok(input.includes("^stable-insight-source"))
})
