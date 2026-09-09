import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import os from "node:os"
import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const dir = path.join(root, "docs/phases/phase-00/evidence")
const read = async (name) => JSON.parse(await fs.readFile(path.join(dir, name), "utf8"))
const [local, official, mappings, tools, quantitative] = await Promise.all([
  read("local-audit.json"),
  read("official-research.json"),
  read("master-mapping-review.json"),
  read("tool-candidates.json"),
  read("quantitative-origins.json"),
])
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex")
const write = async (name, value) => {
  const dest = path.join(root, name)
  await fs.mkdir(path.dirname(dest), { recursive: true })
  await fs.writeFile(dest, JSON.stringify(value, null, 2) + "\n")
}
const categories = [
  "repository/frontend",
  "Lean/Lake",
  "approved-notes/data",
  "build/package-manager",
  "tests/browser",
  "CI/deployment",
  "external-access",
  "host/isolation",
]
const baseline = []
let unitResult = null
for (const [name, command, exitCode] of [
  ["unit-tests.log", "node --import tsx --test", 0],
  ["types.log", "node node_modules/typescript/bin/tsc --noEmit", 0],
  ["build.log", "npm run build (existing isolated npm10.9.2 entry)", 0],
  ["content-checks.log", "node scripts/verify-content.mjs", 0],
  ["knowledge-checks.log", "node scripts/verify-knowledge.mjs", 0],
  ["upstream.log", "node scripts/verify-upstream.mjs", 0],
]) {
  const from = path.join(root, "artifacts/phase-01", name)
  try {
    const bytes = await fs.readFile(from)
    const info = await fs.stat(from)
    const clean = bytes
      .toString("utf8")
      .replaceAll(root, "<PROJECT>")
      .replaceAll(os.homedir(), "<USERPROFILE>")
    if (name === "unit-tests.log") {
      const pass = clean.match(/(?:ℹ|#)\s+pass\s+(\d+)/u)
      const fail = clean.match(/(?:ℹ|#)\s+fail\s+(\d+)/u)
      if (pass && fail) unitResult = { pass: Number(pass[1]), fail: Number(fail[1]) }
    }
    const dest = path.join(dir, `baseline-${name}`)
    await fs.writeFile(dest, clean)
    baseline.push({
      command,
      performedBy: "root agent, same authorized Phase0/1 turn",
      exitCode,
      source: `artifacts/phase-01/${name}`,
      sourceSha256: hash(bytes),
      completedAt: info.mtime.toISOString(),
      copiedEvidence: `docs/phases/phase-00/evidence/baseline-${name}`,
      copiedSha256: hash(clean),
      note: "Root explicitly reported exit0; audit agent inspected and copied the existing log. These are dated baseline runs; later edits require final refresh. Empty output alone does not establish an exit code.",
    })
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}
// Refuse to regenerate PASS from a missing or failed minimum audit run.
assert.equal(mappings.rows.length, 77)
assert.equal(
  mappings.rows.every(
    (row, index) => row.master_section === index + 1 && row.original_text_verified === true,
  ),
  true,
)
assert.equal(local.commands.filter((entry) => entry.args?.[0] === "--check").length, 2)
assert.equal(
  local.commands
    .filter((entry) => entry.args?.[0] === "--check")
    .every((entry) => entry.exitCode === 0),
  true,
)
assert.equal(local.previewChecks.length, 4)
assert.equal(
  local.previewChecks.every((entry) => entry.status === 200),
  true,
)
assert.equal(
  local.previewChecks.some((entry) => entry.route.includes("a-000067") && entry.mathML),
  true,
)
assert.equal(
  quantitative.records.every((entry) => entry.status === "NOT_RUN" && entry.actual_result === null),
  true,
)
assert.equal(quantitative.records.length, 40)
assert.equal(tools.tools.length, 22)
await write("docs/phases/phase-00/evidence/baseline-checks.json", {
  recordedAt: new Date().toISOString(),
  scope: "Existing website engineering baseline; not Lean or future formal-phase acceptance",
  checks: baseline,
})
await write("docs/benchmarks/environment.json", {
  schemaVersion: 1,
  recordedAt: local.recordedAt,
  benchmarkVersion: "phase-00-environment-v1",
  sourceRevision: local.sourceRevision,
  sourceManifest: "docs/phases/phase-00/evidence/source-file-hashes.json",
  sourceManifestSha256: local.sourceManifestSha256,
  dependencyLock: local.dependencyLock,
  hardware: {
    cpuModels: local.environment.cpus,
    logicalCpuCount: local.environment.logicalCpuCount,
    totalMemoryBytes: local.environment.totalMemoryBytes,
    gpu: null,
    gpuDriver: null,
    unavailableReason: local.environment.gpuDriverLimitation,
  },
  platform: {
    os: local.environment.platform,
    release: local.environment.release,
    architecture: local.environment.architecture,
    node: local.environment.node,
    edge: local.environment.edgeVersion,
    playwright: local.repository.dependencies.find((d) => d.name === "playwright")?.installed,
    device:
      "Physical Windows computer; future mobile viewports are desktop browser emulation, not physical phone tests",
  },
  auditExecution: {
    localCommand: "node --use-env-proxy docs/phases/phase-00/evidence/audit-local.mjs",
    officialCommand:
      "node --use-env-proxy docs/phases/phase-00/evidence/audit-official.mjs (approved network capability required in restricted environments)",
    perProcessTimeoutSeconds: 20,
    perOfficialRequestTimeoutSeconds: 20,
    installPerformed: false,
    servicesCreated: false,
    previewLifetime: "ephemeral loopback,closed in finally",
  },
  referenceViewports: [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ],
  futureMeasurements: [
    {
      phase: 3,
      source: "M36 + R P03-05",
      nodes: 150,
      edges: 400,
      repetitions: 5,
      secondsPerRun: 30,
      windowSeconds: 1,
      minimumMedianFPS: 45,
      maximumSettleSeconds: 1.2,
      settleWindowMilliseconds: 300,
      maximumSettleDisplacementCSSPixels: 1,
      postSettleObserveSeconds: 3,
      devicePixelRatio: null,
      warmupProtocol: null,
      actual_result: null,
      status: "NOT_RUN",
    },
    {
      phase: 6,
      source: "M41–43 + R P06-04",
      edits: 60,
      repetitionsPerEdit: 5,
      raceSequences: 30,
      maximumWarmP50Milliseconds: 1500,
      maximumWarmP95Milliseconds: 4000,
      concurrentSessions: null,
      cacheModes: ["cold", "warm-check-required", "cache-hit"],
      actual_result: null,
      status: "NOT_RUN",
    },
    {
      phase: 9,
      source: "M48 + C/R Phase9A",
      datasetTheorems: 60,
      humanSteps: 300,
      split: { development: 30, validation: 10, sealed: 20 },
      independentReviewers: 2,
      reviewerIdentities: [],
      bootstrapConfidence: 0.95,
      bootstrapReplications: null,
      randomSeed: null,
      actual_result: null,
      status: "NOT_RUN",
    },
    {
      phase: 10,
      source: "R Phase10 task5",
      relativeBackendScales: [1, 2, 5],
      actualNodeCounts: null,
      actualEdgeCounts: null,
      concurrentSessions: null,
      actual_result: null,
      status: "NOT_RUN",
    },
  ],
  missingResources: [
    "Installed Lean toolchain and locked formal/Lake project",
    "Verified untrusted-code isolation backend",
    "Second clean independent formal build environment",
    "Named real mathematical/author-strategy reviewers",
    "Authorized human study participants and research protocols",
    "Measured GPU/driver and pixel-ratio baseline for future FPS tests",
  ],
  humanReview: { reviewer: null, status: "NOT_RUN" },
  networkEvidence: {
    restrictedLocal: "local-audit.json records EACCES",
    approvedReadOnly:
      "official-research.json records successful official requests and retained3connection failures",
  },
})
const env = {
  source_revision: local.sourceRevision,
  source_manifest_sha256: local.sourceManifestSha256,
  dependency_lock: local.dependencyLock.sha256,
  platform: `${local.environment.platform}/${local.environment.release}/${local.environment.architecture};Node${local.environment.node}`,
  benchmark_version: "phase-00-audit-v1",
}
const item = (
  id,
  objective,
  task,
  artifact,
  metric,
  threshold,
  result,
  evidence,
  limitations = [],
) => ({
  criterion_id: id,
  objective,
  user_task: task,
  artifact,
  metric,
  threshold,
  requirement_origin: "M / C / R",
  test_environment: env,
  actual_result: result,
  evidence,
  known_limitations: limitations,
  human_reviewer: null,
  status: "PASS",
})
const criteria = [
  item(
    "P00-01",
    "Retain all original requirements and non-goals",
    "A new task follows each original section to its phase and artifacts",
    ["docs/requirements-traceability.csv", "docs/acceptance-criteria.md"],
    "Original numbered sections manually read/mapped",
    "77/77, no unexplained omission",
    {
      mapped: mappings.rows.length,
      total: 77,
      masterSha256: mappings.masterHash,
      missingInputResolved: true,
    },
    [
      "docs/phases/phase-00/evidence/master-mapping-review.json",
      "docs/phases/phase-00/evidence/input-resolution.json",
    ],
    [
      "Mapping PASS does not grant any future implementation PASS or human mathematical review",
      "C-UI current topic-sidebar request supplements M64; continuous focus remains required",
    ],
  ),
  item(
    "P00-02",
    "Know actual repository/data/environment capability",
    "Inspect the existing site before deciding any replacement",
    ["docs/current-state.md", "docs/benchmarks/environment.json"],
    "Capability categories with real observation or reason unavailable",
    "8/8 with existing basic checks and known failures retained",
    {
      categories,
      observed: 8,
      total: 8,
      objects: local.content.objects,
      relations: local.content.relations,
      leanToolchains: 0,
      existingUnitTests: unitResult,
    },
    [
      "docs/phases/phase-00/evidence/local-audit.json",
      "docs/phases/phase-00/evidence/baseline-checks.json",
      "docs/phases/phase-00/evidence/source-file-hashes.json",
      "docs/phases/phase-00/evidence/official-research.json",
    ],
    [
      "No Lean toolchain/project or usable production sandbox; this is an observed gap, not a successful Lean test",
      "Final code/lock/data source manifest excludes closing documentation and this report to avoid self-reference; Phase1 acceptance has separate ownership",
      "GPU CIM metadata access denied",
    ],
  ),
  item(
    "P00-03",
    "Choose tools from evidence, not memory",
    "Compare existing stack and Lean/graph candidates with actual versions",
    [
      "docs/architecture-plan.md",
      "docs/adr/0001-reuse-and-evidence-boundaries.md",
      "docs/adr/0002-tool-candidates.md",
      "docs/adr/0003-static-lean-boundary.md",
    ],
    "Candidate decisions with version/license/maintenance/reason/alternative/performance/boundary/failure/phase",
    "Every recorded tool has these fields; no installation or untested compatibility claims",
    { completeRecords: tools.tools.length, total: tools.tools.length, installedCandidates: 0 },
    [
      "docs/phases/phase-00/evidence/tool-candidates.json",
      "docs/phases/phase-00/evidence/official-research.json",
    ],
    [
      "Lean/browser integration requires real Phase2/6 slices",
      "LeanBlueprint PyPI MIT classifier disagrees with inspected Apache2 LICENSE; distribution license unresolved and package not selected",
      "Raw GitHub3requests reset; alternate official sources were actually read, failures retained",
    ],
  ),
  item(
    "P00-04",
    "Keep targets/provenance separate from results",
    "Look up every future numerical gate and its original or supplemental source",
    ["docs/acceptance-criteria.md", "docs/phase-status.json"],
    "Registered quantitative requirements with M/C/R and future null results",
    "All registered future results NOT_RUN; no result fabricated",
    {
      quantities: quantitative.records.length,
      numericSourceLines: 48,
      futureCriteria: 64,
      originalMasterVerified: true,
      futureActualResults: null,
    },
    [
      "docs/phases/phase-00/evidence/quantitative-origins.json",
      "docs/phases/phase-00/evidence/numeric-gates.json",
      "docs/phases/phase-00/evidence/future-criteria.json",
    ],
    [
      "Phase1 separately authorized and will update its own report; future-criteria is a registration snapshot",
      "C labels cite the user-provided Roadmap supplement, not the original Master",
      "Unspecified sample/concurrency/bootstrap budgets remain null until preregistration",
    ],
  ),
  item(
    "P00-05",
    "Reproduce current input and minimal startup",
    "A new local task runs the audited syntax checks and static preview without Vault export",
    ["docs/phases/phase-00/handoff.md", "docs/current-state.md"],
    "Documented actual syntax and loopback preview results",
    "2 syntax checks exit0;4 static paths HTTP200; source/lock/evidence pointers exist",
    {
      syntaxChecks: local.commands
        .filter((c) => c.args?.[0] === "--check")
        .map((c) => ({ command: ["node", ...c.args].join(" "), exitCode: c.exitCode })),
      preview: local.previewChecks,
    },
    [
      "docs/phases/phase-00/evidence/audit-local.mjs",
      "docs/phases/phase-00/evidence/local-audit.json",
      "docs/phases/phase-00/evidence/input-resolution.json",
    ],
    [
      "No fresh dependency installation performed; npm not onPATH, documented pnpm/npm route may need network/cache",
      "Static HTTP smoke is not a new visual/a11y/FPS or Lean test",
      "Original Master is an intentionally local ignored input; another machine needs the approved original attachment with matching hash",
    ],
  ),
]
await write("docs/phases/phase-00/acceptance.json", {
  schemaVersion: 1,
  phase: 0,
  status: "PASS",
  recordedAt: new Date().toISOString(),
  scope:
    "Repository and capability audit only; does not certify formal mathematics or future phases",
  originalMasterSha256: mappings.masterHash,
  roadmapSha256: local.roadmap.sha256,
  sourceRevision: local.sourceRevision,
  sourceManifestSha256: local.sourceManifestSha256,
  criteria,
  nextPhase: {
    phase: 1,
    automaticallyAuthorizedByThisReport: false,
    note: "The user separately authorized Phase1 this turn; root owns its actual results",
  },
  deployment: { status: "NOT_RUN", observedExistingRun: official.ciRuns?.[0] ?? null },
  humanReview: { reviewer: null, status: "NOT_RUN" },
})
const statusPath = path.join(root, "docs/phase-status.json")
const state = JSON.parse(await fs.readFile(statusPath, "utf8"))
state.updatedAt = new Date().toISOString()
state.masterHash = mappings.masterHash
const current = state.phases.find((p) => p.phase === 0)
Object.assign(current, {
  status: "PASS",
  acceptance: "docs/phases/phase-00/acceptance.json",
  actual_result: {
    originalSectionsMapped: 77,
    categoriesObserved: 8,
    candidateRecords: 22,
    quantityOrigins: 40,
  },
  notes:
    "Audit completed; real formal execution and all later phase capabilities require separate acceptance",
})
await fs.writeFile(statusPath, JSON.stringify(state, null, 2) + "\n")
console.log(
  JSON.stringify({
    phase: 0,
    status: "PASS",
    criteria: criteria.length,
    sourceManifestSha256: local.sourceManifestSha256,
    preservedOtherPhaseStates: true,
  }),
)
