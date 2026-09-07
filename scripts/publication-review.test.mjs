import { test } from "node:test"
import assert from "node:assert/strict"
import { assertStableReview, assertStagedMatches } from "./lib/publication-review.mjs"

const review = {
  head: "commit-a",
  manifestHash: "snapshot-a",
  paths: ["content/概念.md", "publish-manifest.json"],
  staged: [],
}
test("a second self-consistent export cannot replace an already reviewed snapshot", () => {
  assert.throws(
    () => assertStableReview(review, { ...review, manifestHash: "snapshot-b" }),
    /导出内容已变化/,
  )
  assert.throws(() => assertStableReview(review, { ...review, head: "commit-b" }), /HEAD 已变化/)
})
test("pre-existing staged work and a changed publication scope stop the commit", () => {
  assert.throws(
    () => assertStableReview(review, { ...review, staged: ["content/概念.md"] }),
    /暂存/,
  )
  assert.throws(
    () => assertStableReview(review, { ...review, paths: [...review.paths, "content/新增.md"] }),
    /范围/,
  )
  assert.doesNotThrow(() =>
    assertStableReview(review, { ...review, paths: [...review.paths].reverse() }),
  )
})
test("staged blobs must match reviewed bytes, including deletions and same-path substitutions", () => {
  const approved = { "content/概念.md": "reviewed-hash", "content/旧页.md": null }
  assert.throws(
    () => assertStagedMatches(approved, { ...approved, "content/概念.md": "unreviewed-hash" }),
    /暂存内容/,
  )
  assert.throws(
    () => assertStagedMatches(approved, { ...approved, "content/额外.md": "extra" }),
    /范围/,
  )
  assert.throws(
    () => assertStagedMatches(approved, { ...approved, "content/旧页.md": "still-present" }),
    /暂存内容/,
  )
  assert.doesNotThrow(() => assertStagedMatches(approved, approved))
})
