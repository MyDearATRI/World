import { test } from "node:test"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"

test("approved atom preparation is identical under Chinese and English host sorting", () => {
  const root = path.resolve(import.meta.dirname, "..")
  for (const locale of ["en-US", "zh-CN"]) {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "./tests/fixtures/build-locale.mjs",
        "--import",
        "tsx",
        "scripts/prepare-atoms.ts",
        "--check",
      ],
      {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, WORLD_TEST_LOCALE: locale },
        timeout: 30_000,
      },
    )
    assert.equal(result.status, 0, `${locale}: ${result.error ?? result.stderr}`)
    assert.match(result.stdout, /Atoms verified:/)
  }
})
