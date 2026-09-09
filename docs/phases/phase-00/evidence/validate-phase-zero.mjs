import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { format, resolveConfig } from "prettier"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const dir = path.join(root, "docs/phases/phase-00/evidence")
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex")
const read = async (name) => JSON.parse(await fs.readFile(path.join(dir, name), "utf8"))
const results = []
async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, status: "PASS", detail: detail ?? null })
  } catch (error) {
    results.push({ name, status: "FAIL", detail: error.message })
  }
}
const [local, mapping, quantities, future, tools, numeric, hashes, baseline] = await Promise.all([
  read("local-audit.json"),
  read("master-mapping-review.json"),
  read("quantitative-origins.json"),
  read("future-criteria.json"),
  read("tool-candidates.json"),
  read("numeric-gates.json"),
  read("source-file-hashes.json"),
  read("baseline-checks.json"),
])
const master = await fs.readFile(
  path.join(root, "artifacts/phase-00/private-inputs/master-prompt.txt"),
)
const roadmap = await fs.readFile(path.join(root, "../PHASE_ROADMAP.md"))
const text = master.toString("utf8")
const sections = [...text.matchAll(/^# (\d+)\. (.+)$/gmu)]
const acceptance = JSON.parse(
  await fs.readFile(path.join(root, "docs/phases/phase-00/acceptance.json"), "utf8"),
)
const criterionIDs = new Set(
  [...acceptance.criteria, ...future.criteria].map((entry) => entry.criterion_id),
)

await check("Original input and roadmap match the reviewed whole-file hashes", () => {
  assert.equal(sha(master), mapping.masterHash)
  assert.equal(master.length, 51992)
  assert.equal(sha(roadmap), local.roadmap.sha256)
  assert.equal(sha(roadmap), quantities.roadmap_sha256)
  assert.equal(sha(master), acceptance.originalMasterSha256)
  return { masterBytes: master.length, masterHash: sha(master), roadmapHash: sha(roadmap) }
})
await check("All 77 original sections retain exact boundaries, headings and hashes", () => {
  assert.equal(sections.length, 77)
  assert.equal(mapping.rows.length, 77)
  for (const [i, row] of mapping.rows.entries()) {
    const section = sections[i]
    assert.equal(row.master_section, i + 1)
    assert.equal(Number(section[1]), i + 1)
    assert.equal(row.original_heading, section[2])
    assert.equal(row.original_start_line, text.slice(0, section.index).split(/\r?\n/u).length)
    assert.equal(
      row.original_section_sha256,
      sha(text.slice(section.index, sections[i + 1]?.index ?? text.length)),
    )
    assert.equal(row.original_text_verified, true)
    assert.equal(row.implementation_status, "NOT_RUN")
    assert.ok(row.requirement_summary.length > 10)
    for (const id of row.phase_and_criteria.split(";"))
      assert.ok(
        criterionIDs.has(id) || id.startsWith("GLOBAL-"),
        `${row.master_section}: unknown criterion ${id}`,
      )
  }
  assert.equal(mapping.rows[1].non_goal, true)
  assert.equal(mapping.rows[63].non_goal, true)
  return { reviewedSections: 77, scopeOverrides: [64, 76] }
})
await check("CSV is a lossless public view of the reviewed mapping", async () => {
  const csv = await fs.readFile(path.join(root, "docs/requirements-traceability.csv"), "utf8")
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
  const keys = Object.keys(mapping.rows[0])
  const expected =
    [
      keys.map(escape).join(","),
      ...mapping.rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
    ].join("\n") + "\n"
  assert.equal(csv.replaceAll("\r\n", "\n"), expected)
})
await check("Private original is ignored and not tracked or copied to public", async () => {
  const ignored = spawnSync(
    "git",
    ["check-ignore", "--quiet", "artifacts/phase-00/private-inputs/master-prompt.txt"],
    { cwd: root, windowsHide: true },
  )
  assert.equal(ignored.status, 0)
  const tracked = spawnSync("git", ["ls-files", "artifacts/phase-00/private-inputs"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  })
  assert.equal(tracked.status, 0)
  assert.equal(tracked.stdout.trim(), "")
  for (const relative of [
    "public/pasted-text.txt",
    "public/master-prompt.txt",
    "public/artifacts/phase-00/private-inputs/master-prompt.txt",
  ]) {
    await assert.rejects(fs.access(path.join(root, relative)), { code: "ENOENT" })
  }
})
await check("Future gates keep actual results and human reviews empty", () => {
  assert.equal(future.criteria.length, 64)
  assert.equal(new Set(future.criteria.map((entry) => entry.criterion_id)).size, 64)
  const lines = roadmap.toString("utf8").split(/\r?\n/u)
  for (const item of future.criteria) {
    assert.equal(item.status, "NOT_RUN")
    assert.equal(item.actual_result, null)
    assert.equal(item.human_reviewer, null)
    assert.equal(item.evidence.length, 0)
    assert.ok(
      lines[item.source_line - 1].includes(item.objective_and_threshold),
      `${item.criterion_id} original acceptance source differs`,
    )
    assert.ok(item.master_sections.length > 0)
    assert.ok(item.master_sections.every((section) => section >= 1 && section <= 77))
  }
  for (const item of numeric.numericLines) {
    assert.equal(lines[item.line - 1].trim(), item.text)
    assert.equal(item.status, "NOT_RUN")
    assert.equal(item.actual_result, null)
  }
  return { criteria: future.criteria.length, numericalSourceLines: numeric.numericLines.length }
})
await check("Every numerical requirement has M/C/R provenance and known criterion IDs", () => {
  assert.equal(quantities.records.length, 40)
  assert.equal(new Set(quantities.records.map((entry) => entry.id)).size, 40)
  const counts = { M: 0, C: 0, R: 0 }
  for (const item of quantities.records) {
    assert.ok(item.requirement_origin in counts)
    counts[item.requirement_origin]++
    assert.ok(item.threshold.length > 0)
    assert.ok(item.roadmap_location.length > 0)
    assert.equal(item.roadmap_sha256, sha(roadmap))
    assert.equal(item.status, "NOT_RUN")
    assert.equal(item.actual_result, null)
    assert.equal(item.evidence.length, 0)
    for (const id of item.criteria) assert.ok(criterionIDs.has(id), `${item.id}: ${id}`)
    if (item.requirement_origin === "M") {
      assert.equal(item.master_sha256, sha(master))
      assert.ok(item.master_sections.length > 0)
    }
  }
  return counts
})
await check("All 22 candidate records include actual decision and compatibility boundaries", () => {
  assert.equal(tools.tools.length, 22)
  assert.equal(new Set(tools.tools.map((item) => item.id)).size, 22)
  for (const item of tools.tools) {
    for (const field of [
      "version",
      "license",
      "selection",
      "source",
      "documentation",
      "reason",
      "compatibility",
      "alternative",
      "performanceHypothesis",
      "failureMode",
      "boundary",
      "verifyPhase",
    ])
      assert.ok(typeof item[field] === "string" && item[field].length, `${item.id}.${field}`)
    assert.ok(item.maintenanceEvidence && Object.keys(item.maintenanceEvidence).length > 0)
    assert.ok(/^https:\/\//u.test(item.documentation))
    assert.ok(item.selection !== "INSTALLED_BY_PHASE0")
  }
  return { records: tools.tools.length, installationPerformed: false }
})
await check("Recorded minimal startup actually succeeded and retained MathML", () => {
  const syntax = local.commands.filter((entry) => entry.args?.[0] === "--check")
  assert.equal(syntax.length, 2)
  assert.ok(syntax.every((entry) => entry.exitCode === 0 && !entry.error))
  assert.equal(local.previewChecks.length, 4)
  assert.ok(
    local.previewChecks.every((entry) => entry.status === 200 && entry.bytes > 0 && entry.sha256),
  )
  assert.equal(local.previewChecks.find((entry) => entry.route.includes("a-000067")).mathML, true)
  assert.equal(local.repository.leanProjectFiles.length, 0)
  assert.ok(
    !local.commands.some((entry) => /(?:^|[\\/])(lean|lake)(?:\.exe)?$/u.test(entry.program)),
  )
  return { syntax: 2, http: 4, leanInvoked: false }
})
await check(
  "Current lock and every code/data/build file match the frozen source manifest",
  async () => {
    assert.equal(
      sha(await fs.readFile(path.join(root, "package-lock.json"))),
      local.dependencyLock.sha256,
    )
    assert.equal(sha(JSON.stringify(hashes)), local.sourceManifestSha256)
    for (const item of hashes) {
      assert.ok(!item.error, `${item.path}: ${item.error}`)
      assert.equal(
        sha(await fs.readFile(path.join(root, item.path))),
        item.sha256,
        `Source changed after audit: ${item.path}`,
      )
    }
    assert.ok(
      !hashes.some(
        (item) =>
          item.path.startsWith("docs/") ||
          item.path.startsWith("artifacts/") ||
          item.path.startsWith("public/"),
      ),
    )
    return { files: hashes.length, sourceManifestHash: local.sourceManifestSha256 }
  },
)
await check(
  "Baseline log copies retain the exact recorded checks and sanitized hashes",
  async () => {
    assert.equal(baseline.checks.length, 6)
    for (const item of baseline.checks) {
      assert.equal(sha(await fs.readFile(path.join(root, item.copiedEvidence))), item.copiedSha256)
      assert.equal(
        sha(await fs.readFile(path.join(root, item.source))),
        item.sourceSha256,
        `Baseline changed: ${item.source}`,
      )
      assert.equal(item.exitCode, 0)
      assert.ok(item.note.includes("explicitly reported"))
    }
    const unit = await fs.readFile(path.join(dir, "baseline-unit-tests.log"), "utf8")
    assert.ok(/(?:ℹ|#)\s+fail\s+0\b/u.test(unit))
    return {
      copiedLogs: baseline.checks.length,
      exitCodeSource: "root explicitly reported; not inferred from empty output",
    }
  },
)
await check(
  "Phase0 report contains all required evidence and does not approve later phases",
  async () => {
    assert.equal(acceptance.criteria.length, 5)
    for (const item of acceptance.criteria) {
      for (const field of [
        "criterion_id",
        "objective",
        "user_task",
        "artifact",
        "metric",
        "threshold",
        "requirement_origin",
        "test_environment",
        "actual_result",
        "evidence",
        "known_limitations",
        "status",
      ])
        assert.ok(item[field] !== undefined, `${item.criterion_id}.${field}`)
      assert.equal(item.status, "PASS")
      assert.equal(item.human_reviewer, null)
      for (const file of [...item.artifact, ...item.evidence])
        await fs.access(path.join(root, file))
    }
    assert.equal(acceptance.nextPhase.automaticallyAuthorizedByThisReport, false)
    assert.equal(acceptance.humanReview.reviewer, null)
    assert.equal(acceptance.deployment.status, "NOT_RUN")
    const statuses = JSON.parse(
      await fs.readFile(path.join(root, "docs/phase-status.json"), "utf8"),
    )
    assert.equal(statuses.phases.length, 11)
    for (const item of statuses.phases.filter((entry) => entry.phase >= 2))
      assert.equal(item.status, "NOT_RUN")
  },
)
await check("Report files do not leak the absolute local home path", async () => {
  for (const name of ["local-audit.json", "official-research.json", "baseline-checks.json"]) {
    const body = await fs.readFile(path.join(dir, name), "utf8")
    assert.ok(!/C:[\\/]+Users[\\/]+Lenovo/iu.test(body), name)
  }
})

const report = {
  schemaVersion: 1,
  command: "node docs/phases/phase-00/evidence/validate-phase-zero.mjs",
  recordedAt: new Date().toISOString(),
  sourceManifestSha256: local.sourceManifestSha256,
  scope:
    "Audit provenance, evidence integrity and recorded startup checks; not future feature tests or human review",
  passed: results.filter((item) => item.status === "PASS").length,
  failed: results.filter((item) => item.status === "FAIL").length,
  results,
}
const config = await resolveConfig(path.join(root, ".prettierrc"))
async function json(file, value) {
  await fs.writeFile(file, await format(JSON.stringify(value), { ...config, parser: "json" }))
}
await json(path.join(dir, "validation-report.json"), report)
// This evidence manifest deliberately excludes itself and shared phase-status.
const top = [
  "docs/current-state.md",
  "docs/assumptions.md",
  "docs/architecture-plan.md",
  "docs/acceptance-criteria.md",
  "docs/requirements-traceability.csv",
  "docs/benchmarks/environment.json",
  "docs/adr/0001-reuse-and-evidence-boundaries.md",
  "docs/adr/0002-tool-candidates.md",
  "docs/adr/0003-static-lean-boundary.md",
]
async function walk(relative) {
  const out = []
  for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = `${relative}/${item.name}`
    if (item.isDirectory()) out.push(...(await walk(file)))
    else if (!file.endsWith("/evidence-sha256.json")) out.push(file)
  }
  return out
}
const files = [...top, ...(await walk("docs/phases/phase-00"))].sort()
const entries = await Promise.all(
  files.map(async (file) => {
    const bytes = await fs.readFile(path.join(root, file))
    return { path: file, bytes: bytes.length, sha256: sha(bytes) }
  }),
)
await json(path.join(dir, "evidence-sha256.json"), {
  recordedAt: report.recordedAt,
  excludes: [
    "this manifest (self reference)",
    "docs/phase-status.json (shared phase index, Phase0 semantics checked above)",
    "ignored artifacts and private Master",
  ],
  files: entries,
})
console.log(JSON.stringify(report, null, 2))
if (report.failed) process.exitCode = 1
