import test from "node:test"
import assert from "node:assert/strict"
import {
  averageVectors,
  semanticCacheName,
  semanticChunks,
  semanticMatches,
  validateSemanticModel,
} from "./semantic"
import manifest from "../../knowledge/model-manifest.json"

test("semantic chunks preserve all content including Chinese and astral characters", () => {
  const text = "定义。😀".repeat(600) + "\n\nThe final theorem remains available."
  const count = (value: string) => Array.from(value).length + 2
  const chunks = semanticChunks(text, count, "passage: ", 512)
  assert.ok(chunks.length > 4)
  assert.ok(chunks.every((chunk) => count(chunk) <= 512))
  assert.equal(chunks.map((chunk) => chunk.slice(9)).join(""), text)
  assert.ok(chunks.at(-1)?.includes("final theorem"))
})

test("semantic chunks preserve paragraph groups and do not depend on guessed word counts", () => {
  const count = (value: string) => value.length * 3 + 2
  const chunks = semanticChunks("first\n\nsecond\n\n" + "z".repeat(600), count)
  assert.ok(chunks.every((chunk) => count(chunk) <= 512))
  assert.ok(chunks[0].includes("first\n\nsecond"))
})

test("cosine matches exclude self and exact duplicate occurrences", () => {
  const objects = [
    { id: "self", vector: [1, 0] },
    { id: "duplicate", vector: [1, 0] },
    { id: "near", vector: [0.9, 0.1] },
    { id: "far", vector: [0, 1] },
  ]
  assert.deepEqual(
    semanticMatches([1, 0], objects, 5, new Set(["self", "duplicate"])).map((item) => item.id),
    ["near", "far"],
  )
})

test("mean embedding is normalized and rejects corrupt inference", () => {
  assert.deepEqual(
    averageVectors([
      [2, 0],
      [2, 0],
    ]),
    [1, 0],
  )
  assert.throws(() => averageVectors([[0, 0]]))
  assert.throws(() => averageVectors([[1, 0], [1]]))
})

test("model cache belongs only to this application mount", () => {
  assert.notEqual(
    semanticCacheName("https://a.test/World/"),
    semanticCacheName("https://a.test/Other/"),
  )
  assert.ok(semanticCacheName("https://a.test/World/").startsWith("world-semantic-v1:"))
})

test("model downloads reject traversal, mutable revisions and mismatched sizes", () => {
  const valid = manifest as Parameters<typeof validateSemanticModel>[0]
  assert.doesNotThrow(() => validateSemanticModel(valid))
  assert.throws(() => validateSemanticModel({ ...valid, revision: "main" }))
  assert.throws(() => validateSemanticModel({ ...valid, downloadBytes: 1 }))
  const files = valid.files.map((file) => ({ ...file }))
  files[0].path = "../../private.json"
  assert.throws(() => validateSemanticModel({ ...valid, files }))
  files[0] = { ...valid.files[1] }
  assert.throws(() => validateSemanticModel({ ...valid, files }))
})
