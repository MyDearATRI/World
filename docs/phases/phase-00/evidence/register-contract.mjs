import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const text = await fs.readFile(path.join(root, "../PHASE_ROADMAP.md"), "utf8")
const roadmapHash = crypto.createHash("sha256").update(text).digest("hex")
const lines = text.split(/\r?\n/u)
let originalReview = null
try {
  originalReview = JSON.parse(
    await fs.readFile(
      path.join(root, "docs/phases/phase-00/evidence/master-mapping-review.json"),
      "utf8",
    ),
  )
} catch {}
const csv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
const rows = []
let inAppendix = false
for (const [i, line] of lines.entries()) {
  if (line.startsWith("## 附录 B")) inAppendix = true
  if (line.startsWith("## 附录 C")) inAppendix = false
  if (!inAppendix) continue
  const cells = line.split("|").map((x) => x.trim())
  const match = cells[1]?.match(/^(\d+)(?:–(\d+))?$/u)
  if (!match) continue
  for (let n = Number(match[1]); n <= Number(match[2] ?? match[1]); n++) {
    rows.push({
      master_section: n,
      roadmap_group: cells[1],
      provisional_requirement: cells[2],
      phase_and_criteria: cells[3],
      artifact_plan:
        "docs/architecture-plan.md; docs/acceptance-criteria.md; owning future Phase artifacts (not yet produced)",
      source_basis: "PHASE_ROADMAP.md Appendix B only; not original Master",
      roadmap_line: i + 1,
      roadmap_sha256: roadmapHash,
      master_sha256: null,
      original_text_verified: false,
      mapping_status: "BLOCKED",
      result: null,
      limitation:
        "Original 77-section Master is missing; grouped appendix wording cannot identify the individual original section's full requirements or non-goals",
    })
  }
}
if (rows.length !== 77 || new Set(rows.map((row) => row.master_section)).size !== 77)
  throw new Error("Appendix mapping does not cover exactly 1–77")
const keys = Object.keys(rows[0])
if (!originalReview)
  await fs.writeFile(
    path.join(root, "docs/requirements-traceability.csv"),
    [
      keys.map(csv).join(","),
      ...rows.map((row) => keys.map((key) => csv(row[key])).join(",")),
    ].join("\n") + "\n",
  )
const criteria = []
// These Roadmap gates refine broader Master sections; their extra quantitative
// or integration requirements are not falsely attributed to original wording.
const supplementalGates = {
  "P08-04": {
    sections: [22, 24, 25],
    origin: "R",
    explanation:
      "Roadmap adds one known positive control to the Master's refactoring/weakening/abstraction programme; the number is not an original Master threshold.",
  },
  "P08-05": {
    sections: [9, 11, 54],
    origin: "M / R",
    explanation:
      "Roadmap applies original alignment/versioning and maintenance requirements to the refactoring pipeline.",
  },
  "P08-06": {
    sections: [52, 56],
    origin: "M",
    explanation:
      "Original abstraction-research and related-work requirements distinguish refactoring, rediscovery and novelty; Roadmap adds an explicit Phase8 check.",
  },
  "P10-01": {
    sections: [31, 33, 46, 58, 74],
    origin: "M / R",
    explanation:
      "Roadmap extends original traceability, environment and review requirements to every newly scaled item.",
  },
  "P10-02": {
    sections: [38, 66],
    origin: "R",
    explanation:
      "24 theorem/8 theme/120 step scale is a Roadmap first-batch budget; original Master38 has the smaller12/4/60 benchmark and Master66 the staged expansion.",
  },
  "P10-03": {
    sections: [39, 41, 42, 44, 45, 67],
    origin: "M / R",
    explanation:
      "Roadmap combines original navigation, editing, race, graph-operation, roundtrip and end-to-end datasets as a mandatory scale regression gate.",
  },
}
let phase = null
let active = false
for (const [i, line] of lines.entries()) {
  const heading = line.match(/^## Phase (\d+)/u)
  if (heading) {
    phase = Number(heading[1])
    active = false
  }
  if (line === "### 验收标准") active = true
  else if (active && /^### /u.test(line)) active = false
  if (!active || !phase) continue
  const item = line.match(/^- (P\d\d-\d\d)：(.+)$/u)
  const research = line.match(/^\| \*\*9([A-H]) /u)
  if (item || research) {
    const id = item?.[1] ?? `P09-${research[1]}`
    const directlyMapped =
      originalReview?.rows
        .filter((row) => row.phase_and_criteria.split(";").includes(id))
        .map((row) => row.master_section) ?? []
    const supplemental = supplementalGates[id]
    const masterSections = directlyMapped.length
      ? directlyMapped
      : originalReview
        ? (supplemental?.sections ?? [])
        : []
    criteria.push({
      criterion_id: id,
      phase,
      objective_and_threshold: item?.[2] ?? line,
      source: "PHASE_ROADMAP.md",
      source_line: i + 1,
      source_sha256: roadmapHash,
      original_master_verified: Boolean(originalReview),
      master_sha256: originalReview?.masterHash ?? null,
      master_sections: masterSections,
      requirement_origin: supplemental?.origin ?? "M / C / R",
      origin_status: !originalReview
        ? "BLOCKED pending original Master"
        : (supplemental?.explanation ??
          "Full Master mapped; exact quantitative origins are separated in quantitative-origins.json. C supplements are cited to the user-provided Roadmap, not invented as original Master wording."),
      actual_result: null,
      evidence: [],
      human_reviewer: null,
      status: "NOT_RUN",
    })
  }
}
await fs.writeFile(
  path.join(root, "docs/phases/phase-00/evidence/future-criteria.json"),
  JSON.stringify(
    {
      version: 1,
      basis: originalReview
        ? "Roadmap acceptance clauses with manually reviewed original Master mapping; this file registers future tests and is not their execution report"
        : "Roadmap acceptance sections only, original unavailable",
      roadmapHash,
      criteria,
    },
    null,
    2,
  ) + "\n",
)
const numericLines = []
phase = null
for (const [i, line] of lines.entries()) {
  const heading = line.match(/^## Phase (\d+)/u)
  if (heading) phase = Number(heading[1])
  if (line.startsWith("## 附录")) phase = null
  if (
    phase &&
    /(?:\d+[.,]?\d*\s*(?:%|FPS|秒|ms|CSS|个|条|步|次|定理|主题|有效|无效)|p50|p95|F1|150\/400|12\/4\/6\/60|24 定理|1×、2×、5×)/u.test(
      line,
    )
  )
    numericLines.push({
      phase,
      line: i + 1,
      text: line,
      explicit_labels: [...line.matchAll(/(?:（|\(|：|^|\s)([MCR])(?:\s|：|）|\))/gu)].map(
        (m) => m[1],
      ),
      origin_note:
        "Exact Roadmap wording retained; see quantitative-origins.json for separately reviewed M/C/R attribution",
      actual_result: null,
      status: "NOT_RUN",
    })
}
await fs.writeFile(
  path.join(root, "docs/phases/phase-00/evidence/numeric-gates.json"),
  JSON.stringify(
    {
      version: 1,
      roadmapHash,
      original_master_verified: Boolean(originalReview),
      status: originalReview ? "PASS" : "BLOCKED",
      note: "PASS concerns source registration only; every test result below remains NOT_RUN",
      numericLines,
    },
    null,
    2,
  ) + "\n",
)
const statusPath = path.join(root, "docs/phase-status.json")
try {
  await fs.access(statusPath)
} catch {
  await fs.writeFile(
    statusPath,
    JSON.stringify(
      {
        version: 1,
        updatedAt: new Date().toISOString(),
        roadmapHash,
        masterHash: null,
        phases: Array.from({ length: 11 }, (_, phase) => ({
          phase,
          status: phase === 0 ? "PARTIAL" : "NOT_RUN",
          acceptance: phase === 0 ? "docs/phases/phase-00/acceptance.json" : null,
          actual_result: null,
          notes:
            phase === 0
              ? "Audit artifacts exist; original Master missing; see individual criteria"
              : "Initial state only; owning phase updates after its own current evidence",
        })),
      },
      null,
      2,
    ) + "\n",
  )
}
console.log(
  JSON.stringify({
    mappedAppendixRows: rows.length,
    futureCriteria: criteria.length,
    numericSourceLines: numericLines.length,
    allFutureResults: "NOT_RUN",
    originalMasterAudit: originalReview ? "PASS" : "BLOCKED",
  }),
)
