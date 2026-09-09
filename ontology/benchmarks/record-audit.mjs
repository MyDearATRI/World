import fs from "node:fs/promises"
import { selectSample, sha256 } from "../../scripts/validate-ontology.mjs"
const root = new URL("../", import.meta.url)
const read = async (name) => JSON.parse(await fs.readFile(new URL(name, root), "utf8"))
const registry = await read("math_registry.json")
const sourceFile = await read("sources.json")
// This script reproduces a completed, bounded AI review. It cannot sign off changed inputs.
if (
  sha256(JSON.stringify(registry)) !==
    "1385a10911ffb0908ac8f3f8be4bc3ff1475243cc70a33e550ded32d4e933252" ||
  sha256(JSON.stringify(sourceFile)) !==
    "45028eb4ca8cd529006f46c46bd7d2fb5f7e4f51a0bc3f4553360af69080e951"
) {
  throw Error(
    "Frozen review input changed; conduct and record a new actual review before updating these explicit hashes.",
  )
}
const audit = await read("audit.json")
const sample = selectSample(registry)
const byId = new Map(registry.nodes.map((n) => [n.stable_id, n]))
const sources = new Map(sourceFile.sources.map((s) => [s.id, s]))
const findings = {
  "math.msc.00":
    "Official MSC 00 explicitly includes overarching topics and collections; arXiv GM maps here as general-interest material. This remains an explicitly general subject and not a catch-all destination for other codes. Its primary macroregion is an editorial placement, not a claim that all collections are logic.",
  "math.msc.05":
    "The MSC title is Combinatorics. arXiv CO names graphs, enumeration, Ramsey theory and discrete mathematics. The single canonical node covers these at classification granularity; frontiers are distinct children.",
  "math.msc.22":
    "Official MSC 22 is topological groups and Lie groups. The Chinese title preserves both. It is not renamed Lie algebras or merged with all abstract group theory; macroregion placement under algebra is navigational.",
  "math.msc.11":
    "MSC 11 and arXiv NT agree on number-theoretic scope; the arXiv description explicitly includes arithmetic geometry. Arithmetic frontiers therefore have a specific number-theory parent without becoming book-based categories.",
  "math.msc.14":
    "MSC 14 and arXiv AG identify algebraic geometry. arXiv explicitly mentions schemes, stacks and moduli, supporting the derived-moduli child as a mathematical topic, without claiming all derived geometry is contained in classical schemes.",
  "math.msc.18":
    "The MSC heading contains both category theory and homological algebra; the canonical Chinese heading retains both. arXiv CT is mapped by coverage rather than an exact equivalence of two taxonomies.",
  "math.msc.55":
    "MSC 55 is algebraic topology; arXiv AT explicitly includes homotopy theory. It is distinct from MSC 54 general topology and MSC 57 manifolds/cell complexes. Chromatic and Floer homotopy source relations do not assert prerequisite order.",
  "math.msc.49":
    "The full MSC label includes calculus of variations, optimal control and optimization. arXiv OC is distributed across this node, MSC 90, MSC 91 and MSC 93, retaining operations research, game theory and systems/control scope.",
  "math.msc.45":
    "The official heading is integral equations, preserved separately from integral transforms (44), ordinary differential equations (34) and PDE (35). No unsupported identification was introduced.",
  "math.msc.53":
    "Differential geometry is an official MSC and arXiv DG heading. The geometric region is an editorial container; the symplectic geometry subtopic is supported independently by arXiv SG.",
  "math.msc.60":
    "Probability and stochastic processes are both retained from MSC 60. arXiv PR explicitly lists probability and stochastic models. Statistics (62) remains a separate node, rather than a synonym.",
  "math.msc.93":
    "Systems theory and control are retained exactly in scope from MSC 93. The arXiv OC mapping includes this specific target alongside optimization and mathematical programming; the source does not imply one universal control theorem.",
  "math.msc.81":
    "The official subject is quantum theory, not quantum computing alone. It remains a mathematics-classification subject under mathematical physics, with no claim that all physical descriptions are rigorous proofs.",
  "math.msc.78":
    "The MSC heading jointly names optics and electromagnetic theory; neither portion is omitted by the Chinese heading. It is retained in the mathematics classification because MSC includes it, not because it is a purely mathematical field.",
  "math.subject.representation-theory":
    "arXiv RT explicitly covers linear representations of groups/algebras and Lie theory. Group and algebra parent placements identify one subject; repeated outline placements never create a second identity.",
  "math.subject.spectral-theory":
    "arXiv SP describes differential, integral, discrete and random operators. Placement under operator theory is justified; this is not limited to matrix eigenvalues or quantum mechanics alone.",
  "math.subject.metric-geometry":
    "arXiv MG includes Euclidean, hyperbolic, convex, coarse and comparison geometry. The metric-geometry node is supported by that label and is not silently substituted for the different notion of a metric-space definition.",
}
const frontierFindings = {
  "inner-models":
    "Vienna is a dedicated 2024 research workshop; Steel's separately recorded JMM tutorial is a second activity group. Both explicitly concern inner models/large cardinals. Tutorial content is evidence of an active direction, not an independently verified new theorem.",
  "model-theoretic-tameness":
    "The MFO programme and the independently authored Moconja–Tanović v2 paper concern model-theoretic tameness. The 2026 revision is read as an actual revised research item, not a crawler timestamp.",
  "higher-categorical-models":
    "The polygraphs monograph and Rasekh's published construction are separate author groups. They study different models/coherence questions within higher-category theory; the title intentionally does not equate strict and weak higher categories.",
  "cubical-univalence":
    "The HoTT book is the established conceptual source; the 2026 cubical boundary-filling paper supplies recent research. Higher structures and univalence justify cross-placement in categories, logic and topology. Undecidable general Kan solving is not presented as solved.",
  "representation-categorification":
    "The Columbia programme and Rui–Song paper are separate contributions. They explicitly use representation categories and categorification; characteristic restrictions in the paper are retained in its summary.",
  "modular-blocks":
    "The Brauer article and independent tensor-triangular workshop support modular representation research. Brauer's Height Zero Conjecture is completed in the cited result, so the direction is blocks/methods rather than an allegedly still-open named conjecture.",
  "prismatic-cohomology":
    "The foundational published paper and Tsuji's distinct q-Higgs/crystal work have independent research content. The IAS abstract was actually read even though a later optional raw-HTTP corroboration returned403. Publisher MSC metadata on the Annals page appears unrelated and was deliberately not used.",
  "local-langlands-geometrization":
    "Scholze's motivic extension and Imai's independent exposition provide two source groups. The direction is local Langlands geometrization; this is not a claim to have independently verified or universally completed all Langlands correspondences.",
  "birational-boundedness":
    "The MFO research programme and Birkar's paper independently support birational geometry/boundedness. Hypotheses concerning singularities and positivity are preserved in the summary; the direction is not merged into canonical-metric geometry.",
  "derived-sheaf-moduli":
    "Porta–Teyssier and Casals–Li are separate author groups studying derived sheaf-related moduli. The Stokes paper split was checked against the current version; only the correct successor provides derived-moduli evidence.",
  "chromatic-k-theory":
    "The Nullstellensatz/redshift and Ramzi's categorical noshift paper are distinct contributions. The difference between E-infinity rings and rigid stable categories is explicit, preventing a false claim of contradiction or a universal redshift theorem.",
  "floer-homotopy":
    "MIT's programme and Princeton's Minerva lectures are separately organized activities. Both explicitly connect Floer theory and generalized/stable homotopy; work in progress in the lecture abstract is not relabelled complete.",
}
const reviewRecords = []
for (const stratum of sample.strata)
  for (const id of stratum.sample_ids) {
    if (!findings[id]) throw Error("New sample needs actual review: " + id)
    const n = byId.get(id)
    reviewRecords.push({
      stable_id: id,
      stratum: stratum.stratum,
      source_ids: n.source_ids,
      node_sha256: sha256(JSON.stringify(n)),
      findings: findings[id],
      status: "PASS",
      reviewer_type: "AI",
      reviewer_role: "ontology integration agent",
      human_reviewer: null,
      reviewed_date: registry.as_of,
    })
  }
audit.frontier_audit = registry.nodes
  .filter((n) => n.frontier.status === "ACTIVE_FRONTIER")
  .map((n) => {
    const source_groups = [...new Set(n.source_ids.map((id) => sources.get(id).source_group))]
    const own = frontierFindings[n.stable_id.replace("math.frontier.", "")]
    return {
      stable_id: n.stable_id,
      region: n.primary_region_id,
      source_ids: n.source_ids,
      source_groups,
      node_sha256: sha256(JSON.stringify(n)),
      findings:
        own ??
        `${n.regional_relevance} Independent originating source groups and dated scientific activity were reviewed by the delegated source-research agent; integrating agent cross-checked the submitted source locators, scopes and group identities.`,
      status: "PASS",
      reviewer_type: "AI",
      reviewer_role: own
        ? "ontology integration agent"
        : "delegated source-research agent; integrating metadata audit",
      human_reviewer: null,
      reviewed_date: registry.as_of,
    }
  })
audit.sampling = {
  selection: "ontology/benchmarks/sample-selection.json",
  seed: sample.seed,
  population_count: sample.population_count,
  sampled_count: reviewRecords.length,
  sampled_fraction: reviewRecords.length / sample.population_count,
  status: "PASS",
  reviews: reviewRecords,
}
audit.errors_and_corrections = [
  {
    id: "cross-membership-specificity",
    stage: "independent AI integration review",
    original_issue:
      "Early cross-membership explanations used a generic primary-region sentence rather than explaining each target parent.",
    correction:
      "Replace each secondary placement with a target-specific mathematical explanation, including the four multi-parent arXiv subjects.",
    expanded_review:
      "Rechecked every secondary parent across all current multi-parent nodes against its official category description or frontier abstract; no source or title removed from the sample.",
    status: "RESOLVED",
  },
  {
    id: "compound-arxiv-scopes",
    stage: "independent AI classification review",
    original_issue:
      "Initial math.OC mapping omitted game theory; math.RA mapping omitted explicit lattice, linear-algebra and semigroup scope.",
    correction:
      "Add MSC91 to OC and MSC06/15/20 to RA; add general-overview scope to HO. Clarify mapping as distribution across related specific subjects, not taxonomy equality.",
    expanded_review:
      "Re-read all32 official Mathematics category headings/descriptions, and inspect all compound mappings CA, CV, HO, OC and RA. Preserve the original denominator32 and all failures in this record.",
    status: "RESOLVED",
  },
  {
    id: "editorial-context-placement",
    stage: "independent AI classification review",
    original_issue:
      "MSC00/01/97 under the foundations navigation region could imply that collections, history and education are branches of logic.",
    correction:
      "Explicitly mark all3 as editorial-context placements with a note denying a mathematical-subdiscipline assertion. No13th required macroregion is invented.",
    expanded_review:
      "Inspect all12 regional placements and preserve official names. Region membership is editorial navigation; detailed node identity remains source-defined.",
    status: "RESOLVED",
  },
  {
    id: "source-version-stokes",
    stage: "source-candidate review",
    original_issue:
      "Search results retained the old combined title of arXiv:2401.12335, although v2 moved derived moduli to a separate paper.",
    correction:
      "Read current page and successor arXiv:2504.05360; use only successor for derived-moduli evidence, preserving source split as a deduplication decision.",
    expanded_review:
      "Re-read title/version/history for all 10 arXiv primary-source items in the first-six-region pack, plus the superseded Stokes source; the cubical paper's title/version is likewise updated to v5.",
    status: "RESOLVED",
  },
  {
    id: "publisher-msc-prisms",
    stage: "source-metadata review",
    original_issue:
      "Annals prismatic-cohomology page displays MSC 58C40/35P99, unrelated to the actual abstract.",
    correction:
      "Do not infer mathematical classification from this anomalous metadata; use the official MSC taxonomy and the article's explicit p-adic/formal-scheme abstract.",
    expanded_review:
      "All three publisher-research article scopes in the first-six-region pack were checked using their abstracts rather than blind MSC import (Prisms, Brauer, polarised varieties).",
    status: "RESOLVED",
  },
]
audit.review_scope =
  "AI audit of topic identity, bilingual labels, classification placement, source independence, publication/activity dates and source scope. No paper's complete proof was audited, no human sign-off exists, and no Lean check ran."
audit.status = "PASS"
audit.reviewed_sources_sha256 = sha256(JSON.stringify(sourceFile))
audit.phase_exit_status = "PARTIAL"
audit.phase_exit_reason =
  "Data-specific criteria pass independently. The original Master Prompt has now been recovered; final Phase1 exit awaits the current Phase0 acceptance, recorded separately in the phase handoff."
await fs.writeFile(new URL("audit.json", root), JSON.stringify(audit, null, 2) + "\n")
await fs.writeFile(
  new URL("benchmarks/review-records.json", root),
  JSON.stringify(
    {
      schema_version: 1,
      as_of: registry.as_of,
      frontier: audit.frontier_audit,
      sampling: audit.sampling,
      corrections: audit.errors_and_corrections,
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    frontier_reviews: audit.frontier_audit.length,
    sampled_reviews: reviewRecords.length,
    population: sample.population_count,
    reviewer_type: "AI",
    human_reviewer: null,
  }),
)
