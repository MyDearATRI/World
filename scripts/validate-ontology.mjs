import fs from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex")
export const SAMPLE_SEED = "phase-01-2026-09-10-v1"
export const REGIONS = [
  "foundations-logic",
  "categories-higher",
  "algebra-representation",
  "number-arithmetic",
  "algebraic-geometry",
  "topology-homotopy",
  "geometry",
  "analysis-pde",
  "probability-statistics",
  "combinatorics-discrete",
  "mathematical-physics",
  "applied-computational",
].map((id) => `math.region.${id}`)

export function selectSample(registry, seed = SAMPLE_SEED) {
  const byId = new Map(registry.nodes.map((n) => [n.stable_id, n]))
  const depth = (id, seen = new Set()) => {
    if (seen.has(id)) throw Error(`Cycle at ${id}`)
    const node = byId.get(id)
    if (!node) throw Error(`Unresolved parent ${id}`)
    return node.parent_ids.length
      ? 1 + Math.min(...node.parent_ids.map((p) => depth(p, new Set([...seen, id]))))
      : 0
  }
  const strata = new Map()
  const population = registry.nodes.filter(
    (n) =>
      n.volume_id === "vol-1-existing" && n.substantive && n.frontier.status !== "ACTIVE_FRONTIER",
  )
  for (const node of population) {
    const key = `${node.primary_region_id}|depth-${depth(node.stable_id)}`
    if (!strata.has(key)) strata.set(key, [])
    strata.get(key).push(node.stable_id)
  }
  return {
    schema_version: 1,
    seed,
    method:
      "SHA256(seed + NUL + stable_id), ascending hex; ceil(10%) per primary-region/depth stratum",
    population_count: population.length,
    strata: [...strata].map(([stratum, all]) => ({
      stratum,
      total: all.length,
      required: Math.ceil(all.length * 0.1),
      sample_ids: all
        .sort((a, b) => sha256(seed + "\0" + a).localeCompare(sha256(seed + "\0" + b)))
        .slice(0, Math.ceil(all.length * 0.1)),
    })),
    frontier_ids: registry.nodes
      .filter((n) => n.volume_id === "vol-1-existing" && n.frontier.status === "ACTIVE_FRONTIER")
      .map((n) => n.stable_id),
  }
}

export function validateOntology({
  registry,
  sources: sourceFile,
  audit,
  msc,
  arxiv,
  sample,
  outline,
}) {
  const errors = []
  const criteria = new Map(Array.from({ length: 6 }, (_, i) => [`P01-0${i + 1}`, []]))
  const check = (id, condition, message) => {
    if (!condition) {
      errors.push(`${id}: ${message}`)
      criteria.get(id).push(message)
    }
  }
  const nodes = registry.nodes ?? []
  const byId = new Map(nodes.map((node) => [node.stable_id, node]))
  const sources = new Map(sourceFile.sources.map((source) => [source.id, source]))
  const math = nodes.filter((node) => node.volume_id === "vol-1-existing" && node.substantive)
  const frontier = math.filter((node) => node.frontier?.status === "ACTIVE_FRONTIER")
  const plainLines = outline.split(/\r?\n/).filter((line) => line.trim())
  check(
    "P01-01",
    plainLines.length > 0 &&
      plainLines.every(
        (line) =>
          /^#{1,6} [^\r\n]+$/.test(line) && !/https?:\/\/|\[[^\]]*\]\(|<\/?\w|```/.test(line),
      ),
    "Outline must contain headings only, without reference links, HTML or prose",
  )
  const volumeHeadings = plainLines.filter((line) => /^# /.test(line))
  check(
    "P01-01",
    volumeHeadings.length === 3 &&
      volumeHeadings[0].includes("现有数学") &&
      volumeHeadings[1].includes("系统建设") &&
      volumeHeadings[2].includes("拟议研究"),
    "Exactly the three distinct volumes are required",
  )
  const expectedTitles = new Set(nodes.map((node) => `${node.title_zh} · ${node.canonical_title}`))
  const actualTitles = new Set(plainLines.map((line) => line.replace(/^#+ /, "")))
  check(
    "P01-01",
    [...expectedTitles].every((title) => actualTitles.has(title)) &&
      [...actualTitles].every((title) => expectedTitles.has(title)),
    "Outline must retain every registered title and contain no unregistered subject",
  )
  check(
    "P01-06",
    byId.size === nodes.length &&
      nodes.every(
        (node) =>
          typeof node.stable_id === "string" && /^[a-z0-9][a-z0-9.-]*$/.test(node.stable_id),
      ),
    "Stable IDs must be unique, nonempty ASCII identifiers",
  )
  check("P01-06", sources.size === sourceFile.sources.length, "Duplicate source identity")
  check(
    "P01-06",
    REGIONS.every((id) => byId.has(id) && byId.get(id).kind === "region"),
    "All twelve specified regions must exist",
  )
  for (const node of nodes) {
    check(
      "P01-06",
      Array.isArray(node.parent_ids) && new Set(node.parent_ids).size === node.parent_ids.length,
      `Duplicate parent on ${node.stable_id}`,
    )
    for (const id of node.parent_ids ?? [])
      check("P01-06", byId.has(id), `Missing parent ${id} from ${node.stable_id}`)
    for (const id of node.source_ids ?? [])
      check("P01-06", sources.has(id), `Missing source ${id} from ${node.stable_id}`)
    for (const placement of node.cross_memberships ?? []) {
      check(
        "P01-06",
        byId.has(placement.parent_id) &&
          node.parent_ids.includes(placement.parent_id) &&
          Boolean(placement.reason),
        `Unexplained cross-membership for ${node.stable_id}`,
      )
      check(
        "P01-06",
        placement.source_ids?.length > 0 && placement.source_ids.every((id) => sources.has(id)),
        `Unsourced cross-membership for ${node.stable_id}`,
      )
    }
  }
  const visiting = new Set(),
    done = new Set()
  const visit = (id) => {
    if (visiting.has(id)) {
      check("P01-06", false, `Parent cycle at ${id}`)
      return
    }
    if (done.has(id) || !byId.has(id)) return
    visiting.add(id)
    byId.get(id).parent_ids.forEach(visit)
    visiting.delete(id)
    done.add(id)
  }
  nodes.forEach((n) => visit(n.stable_id))
  for (const [key, snapshot, expectedTotal] of [
    ["msc", msc, 63],
    ["arxiv", arxiv, 32],
  ]) {
    const codes = snapshot.entries.map((entry) => entry.code)
    const mappings = registry.mappings[key]
    check(
      "P01-02",
      codes.length === expectedTotal &&
        snapshot.official_total === expectedTotal &&
        snapshot.acquired_total === expectedTotal &&
        new Set(codes).size === codes.length,
      `${key} official/acquired denominator mismatch`,
    )
    check(
      "P01-02",
      mappings.length === codes.length &&
        new Set(mappings.map((m) => m.code)).size === codes.length &&
        mappings.every((m) => codes.includes(m.code)),
      `${key} mapping must cover each acquired classification exactly once`,
    )
    for (const mapping of mappings)
      check(
        "P01-02",
        mapping.target_ids.length > 0 &&
          mapping.target_ids.every(
            (id) => byId.get(id)?.substantive && byId.get(id)?.volume_id === "vol-1-existing",
          ),
        `${key}:${mapping.code} must target concrete mathematical subjects, not region/root/proposal`,
      )
    check(
      "P01-02",
      /^[a-f0-9]{64}$/.test(snapshot.response_sha256) &&
        snapshot.accessed_date === registry.as_of &&
        snapshot.source_url.startsWith("https://"),
      `${key} actual acquisition evidence missing`,
    )
  }
  for (const node of math)
    check(
      "P01-03",
      node.source_ids.length > 0 &&
        node.source_ids.some((id) => {
          const source = sources.get(id)
          return (
            source?.retrieval_status === "VERIFIED" &&
            source.url?.startsWith("https://") &&
            source.locator &&
            source.support_summary &&
            source.accessed_date === registry.as_of
          )
        }),
      `No verified supporting source for ${node.stable_id}`,
    )
  for (const source of sourceFile.sources)
    check(
      "P01-03",
      source.reviewer_type === "AI" &&
        source.human_reviewer === null &&
        source.id === source.source_id,
      `Review authorship/identity is not explicit for ${source.id}`,
    )
  const cutoff = new Date(`${registry.as_of}T00:00:00Z`)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 5)
  const end = new Date(`${registry.as_of}T23:59:59Z`)
  for (const node of frontier) {
    const groups = new Set(
      node.source_ids.map((id) => sources.get(id)?.source_group).filter(Boolean),
    )
    const recent = node.frontier.activity_evidence.filter((activity) => {
      const date = /^\d{4}-\d{2}-\d{2}$/.test(activity.date) ? new Date(activity.date) : null
      return (
        date &&
        date >= cutoff &&
        date <= end &&
        node.source_ids.includes(activity.source_id) &&
        activity.evidence_summary
      )
    })
    check(
      "P01-04",
      groups.size >= 2 && recent.length > 0 && REGIONS.includes(node.primary_region_id),
      `Frontier needs two distinct evidence groups and dated activity in the five-year window: ${node.stable_id}`,
    )
  }
  for (const id of REGIONS)
    check(
      "P01-04",
      frontier.filter((node) => node.primary_region_id === id).length >= 2,
      `Fewer than two primary directions for ${id}`,
    )
  const reviews = audit.frontier_audit ?? []
  check(
    "P01-05",
    audit.reviewed_sources_sha256 === sha256(JSON.stringify(sourceFile)),
    "Source metadata changed after the recorded scope/independence review",
  )
  check(
    "P01-05",
    reviews.length === frontier.length &&
      new Set(reviews.map((r) => r.stable_id)).size === frontier.length,
    "Frontier review denominator/identity mismatch",
  )
  for (const node of frontier) {
    const r = reviews.find((r) => r.stable_id === node.stable_id)
    check(
      "P01-05",
      r?.status === "PASS" &&
        r.node_sha256 === sha256(JSON.stringify(node)) &&
        r.reviewer_type === "AI" &&
        r.human_reviewer === null &&
        r.findings &&
        r.source_ids?.every((id) => node.source_ids.includes(id)) &&
        r.source_ids.length >= 2,
      `Missing or stale scoped frontier review ${node.stable_id}`,
    )
  }
  try {
    const expected = selectSample(registry)
    check(
      "P01-05",
      JSON.stringify(expected) === JSON.stringify(sample),
      "Seeded raw sample differs from the frozen selection protocol",
    )
    const sampled = sample.strata.flatMap((s) => s.sample_ids)
    const reviewed = audit.sampling.reviews ?? []
    check(
      "P01-05",
      sampled.every((id) =>
        reviewed.some(
          (r) =>
            r.stable_id === id &&
            r.node_sha256 === sha256(JSON.stringify(byId.get(id))) &&
            r.status === "PASS" &&
            r.findings &&
            r.reviewer_type === "AI" &&
            r.human_reviewer === null,
        ),
      ),
      "At least one required stratified sample lacks a current scoped review",
    )
    check(
      "P01-05",
      audit.sampling.seed === SAMPLE_SEED && audit.sampling.status === "PASS",
      "Sampling seed/status missing",
    )
  } catch (error) {
    check("P01-06", false, error.message)
  }
  check(
    "P01-06",
    Array.isArray(audit.deduplication) && audit.deduplication.length > 0,
    "Deduplication decisions must be traceable",
  )
  return {
    status: errors.length ? "FAIL" : "PASS",
    as_of: registry.as_of,
    scope:
      "Frozen official classification mappings, registry structure and recorded AI topic/source audits; not mathematical proof correctness or human review",
    counts: {
      canonical_nodes: nodes.length,
      substantive_math_nodes: math.length,
      unique_frontiers: frontier.length,
      official_msc: msc.entries.length,
      official_arxiv: arxiv.entries.length,
      sources: sources.size,
      samples: sample.strata.reduce((sum, stratum) => sum + stratum.sample_ids.length, 0),
    },
    criteria: Object.fromEntries(
      [...criteria].map(([id, failures]) => [
        id,
        { status: failures.length ? "FAIL" : "PASS", failures },
      ]),
    ),
    errors,
  }
}

export async function loadOntology(directory) {
  if (directory instanceof URL) directory = fileURLToPath(directory)
  const json = async (file) => JSON.parse(await fs.readFile(path.join(directory, file), "utf8"))
  return {
    registry: await json("math_registry.json"),
    sources: await json("sources.json"),
    audit: await json("audit.json"),
    msc: await json("benchmarks/msc2020-level1.json"),
    arxiv: await json("benchmarks/arxiv-math.json"),
    sample: await json("benchmarks/sample-selection.json"),
    outline: await fs.readFile(path.join(directory, "math_outline.md"), "utf8"),
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = path.resolve(process.argv[2] ?? "ontology")
  const result = validateOntology(await loadOntology(directory))
  console.log(JSON.stringify(result, null, 2))
  if (result.status !== "PASS") process.exitCode = 1
}
