import assert from "node:assert/strict"
import { createHash } from "node:crypto"

export const digest = (value) => createHash("sha256").update(value).digest("hex")
const ordered = (values) => [...values].sort()
export function assertStableReview(expected, current) {
  assert.equal(current.head, expected.head, "预览期间 HEAD 已变化，请重新预览")
  assert.equal(current.manifestHash, expected.manifestHash, "预览期间导出内容已变化，请重新预览")
  assert.deepEqual(
    ordered(current.paths),
    ordered(expected.paths),
    "预览期间提交文件范围已变化，请重新预览",
  )
  assert.equal(current.staged.length, 0, "预览期间出现已有暂存内容，请先单独处理")
}
export function assertStagedMatches(expected, actual) {
  assert.deepEqual(
    ordered(Object.keys(actual)),
    ordered(Object.keys(expected)),
    "暂存文件超出已预览范围",
  )
  for (const file of Object.keys(expected))
    assert.equal(actual[file], expected[file], `暂存内容不等于已预览版本：${file}`)
}
