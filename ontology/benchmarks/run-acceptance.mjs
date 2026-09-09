import fs from "node:fs/promises"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { sha256, loadOntology, validateOntology } from "../../scripts/validate-ontology.mjs"
const root = path.resolve(fileURLToPath(new URL("../../", import.meta.url)))
const out = path.join(root, "docs/phases/phase-01/evidence")
await fs.mkdir(out, { recursive: true })
const runs = []
for (const [name, args] of [
  ["ontology-validation", ["scripts/validate-ontology.mjs"]],
  ["ontology-tests", ["--test", "scripts/ontology.test.mjs"]],
  [
    "ontology-format",
    [
      "node_modules/prettier/bin/prettier.cjs",
      "--check",
      "ontology",
      "scripts/validate-ontology.mjs",
      "scripts/ontology.test.mjs",
    ],
  ],
]) {
  const started_at = new Date().toISOString()
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" })
  const log = result.stdout + (result.stderr ? "\nSTDERR\n" + result.stderr : "")
  await fs.writeFile(path.join(out, name + ".txt"), log)
  runs.push({
    name,
    command: ["node", ...args].join(" "),
    started_at,
    finished_at: new Date().toISOString(),
    exit_code: result.status,
    signal: result.signal,
    stdout_stderr: `docs/phases/phase-01/evidence/${name}.txt`,
    log_sha256: sha256(log),
  })
}
const files = [
  "ontology/math_registry.json",
  "ontology/math_outline.md",
  "ontology/sources.json",
  "ontology/audit.json",
  "ontology/benchmarks/msc2020-level1.json",
  "ontology/benchmarks/arxiv-math.json",
  "ontology/benchmarks/schema-contract.json",
  "ontology/benchmarks/sample-selection.json",
  "ontology/benchmarks/review-records.json",
  "ontology/benchmarks/regions-07-12-verification.json",
  "ontology/research-regions-01-06.json",
  "ontology/research-regions-07-12.json",
  "ontology/benchmarks/retrieval-regions-01-06.json",
  "ontology/benchmarks/assemble.mjs",
  "ontology/benchmarks/record-audit.mjs",
  "ontology/benchmarks/run-acceptance.mjs",
  "scripts/validate-ontology.mjs",
  "scripts/ontology.test.mjs",
  "package-lock.json",
]
const hashes = []
for (const file of files)
  hashes.push({ path: file, sha256: sha256(await fs.readFile(path.join(root, file))) })
const revision = spawnSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).stdout.trim()
const validation = validateOntology(await loadOntology(path.join(root, "ontology")))
const report = {
  schema_version: 1,
  captured_at: new Date().toISOString(),
  status: runs.every((run) => run.exit_code === 0) ? "PASS" : "FAIL",
  source_revision: revision,
  working_tree: "Uncommitted ontology files; exact source hashes below identify this run",
  node: process.version,
  platform: `${process.platform}/${process.arch}`,
  dependency_lock: hashes.find((file) => file.path === "package-lock.json").sha256,
  benchmark_version: "phase-01-2026-09-10-v1",
  runs,
  validation,
  files: hashes,
}
await fs.writeFile(path.join(out, "run-report.json"), JSON.stringify(report, null, 2) + "\n")
console.log(
  JSON.stringify({
    status: report.status,
    runs: runs.map(({ name, exit_code }) => ({ name, exit_code })),
    counts: validation.counts,
  }),
)
if (report.status !== "PASS") process.exitCode = 1
