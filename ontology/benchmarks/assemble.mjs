import fs from "node:fs/promises"
import crypto from "node:crypto"
const root = new URL("../", import.meta.url)
const read = async (name) => JSON.parse(await fs.readFile(new URL(name, root), "utf8"))
const write = async (name, value) =>
  fs.writeFile(new URL(name, root), JSON.stringify(value, null, 2) + "\n")
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex")
const as_of = "2026-09-10"
const ids = [
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
]
const zh = [
  "基础与逻辑",
  "范畴与高阶结构",
  "代数与表示论",
  "数论与算术几何",
  "代数几何",
  "拓扑与同伦",
  "几何",
  "分析与 PDE",
  "概率与统计",
  "组合与离散数学",
  "数学物理",
  "应用与计算数学",
]
const en = [
  "Foundations and logic",
  "Categories and higher structures",
  "Algebra and representation theory",
  "Number theory and arithmetic geometry",
  "Algebraic geometry",
  "Topology and homotopy",
  "Geometry",
  "Analysis and PDE",
  "Probability and statistics",
  "Combinatorics and discrete mathematics",
  "Mathematical physics",
  "Applied and computational mathematics",
]
const msc = await read("benchmarks/msc2020-level1.json")
const arxiv = await read("benchmarks/arxiv-math.json")
const packs = [await read("research-regions-01-06.json")]
try {
  packs.push(await read("research-regions-07-12.json"))
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
const sources = [
  {
    id: "src.msc2020",
    source_id: "src.msc2020",
    title: "MSC2020 official two-digit classification",
    url: msc.source_url,
    source_group: "classification.ams-zbmath-msc2020",
    kind: "official-classification",
    accessed_date: as_of,
    locator: msc.locator,
    support_summary:
      "The complete official 63-item first-level list was parsed from the AMS form. Classification labels are evidence of subject scope, not a claim of an exhaustive ontology of all mathematics.",
    retrieval_status: "VERIFIED",
    reviewer_type: "AI",
    human_reviewer: null,
    snapshot: "ontology/benchmarks/msc2020-level1.json",
    response_sha256: msc.response_sha256,
  },
  {
    id: "src.arxiv-math",
    source_id: "src.arxiv-math",
    title: "arXiv Category Taxonomy: Mathematics",
    url: arxiv.source_url,
    source_group: "classification.arxiv",
    kind: "official-classification",
    accessed_date: as_of,
    locator: arxiv.locator,
    support_summary:
      "The official Mathematics section has 32 math.* categories. math.IT and math.MP are retained as official aliases to cs.IT and math-ph; those external canonical tags are not counted again as mathematics categories.",
    retrieval_status: "VERIFIED",
    reviewer_type: "AI",
    human_reviewer: null,
    snapshot: "ontology/benchmarks/arxiv-math.json",
    response_sha256: arxiv.response_sha256,
  },
  ...packs.flatMap((p) =>
    p.sources.map((s) => ({ ...s, id: s.id ?? s.source_id, source_id: s.source_id ?? s.id })),
  ),
]
const nodes = []
function add(id, title, title_zh, volume_id, kind, parents, source_ids, extra = {}) {
  const n = {
    stable_id: id,
    canonical_title: title,
    title_zh,
    aliases: [],
    volume_id,
    kind,
    substantive: kind !== "volume" && kind !== "region",
    parent_ids: parents,
    cross_memberships: [],
    source_ids,
    classification_codes: { msc: [], arxiv: [] },
    frontier: {
      status: volume_id === "vol-1-existing" ? "ESTABLISHED" : "PROPOSED",
      activity_evidence: [],
    },
    ...extra,
  }
  nodes.push(n)
  return n
}
add("vol-1-existing", "Existing mathematics", "第一卷 现有数学", "vol-1-existing", "volume", [], [])
add("vol-2-system", "System construction", "第二卷 系统建设", "vol-2-system", "volume", [], [])
add("vol-3-research", "Proposed research", "第三卷 拟议研究", "vol-3-research", "volume", [], [])
ids.forEach((id, i) =>
  add(
    `math.region.${id}`,
    en[i],
    zh[i],
    "vol-1-existing",
    "region",
    ["vol-1-existing"],
    ["src.msc2020", "src.arxiv-math"],
    { primary_region_id: `math.region.${id}` },
  ),
)
const regionCodes = [
  "00 01 03 97",
  "18",
  "06 08 12 13 15 16 17 20 22",
  "11",
  "14",
  "19 54 55 57",
  "51 52 53 58",
  "26 28 30 31 32 33 34 35 37 39 40 41 42 43 44 45 46 47 49",
  "60 62",
  "05",
  "70 74 76 78 80 81 82 83 85 86",
  "65 68 90 91 92 93 94",
]
const translations = {
  "00": "一般与总览主题；文集",
  "01": "数学史与传记",
  "03": "数理逻辑与基础",
  "05": "组合学",
  "06": "序、格与有序代数结构",
  "08": "一般代数系统",
  11: "数论",
  12: "域论与多项式",
  13: "交换代数",
  14: "代数几何",
  15: "线性与多重线性代数；矩阵理论",
  16: "结合环与结合代数",
  17: "非结合环与非结合代数",
  18: "范畴论与同调代数",
  19: "K 理论",
  20: "群论及其推广",
  22: "拓扑群与 Lie 群",
  26: "实函数",
  28: "测度与积分",
  30: "单复变函数",
  31: "位势论",
  32: "多复变函数与解析空间",
  33: "特殊函数",
  34: "常微分方程",
  35: "偏微分方程",
  37: "动力系统与遍历论",
  39: "差分与函数方程",
  40: "序列、级数与可和性",
  41: "逼近与展开",
  42: "Euclid 空间上的调和分析",
  43: "抽象调和分析",
  44: "积分变换与算子演算",
  45: "积分方程",
  46: "泛函分析",
  47: "算子理论",
  49: "变分法、最优控制与优化",
  51: "几何学",
  52: "凸几何与离散几何",
  53: "微分几何",
  54: "一般拓扑",
  55: "代数拓扑",
  57: "流形与胞腔复形",
  58: "整体分析与流形上的分析",
  60: "概率论与随机过程",
  62: "统计学",
  65: "数值分析",
  68: "计算机科学",
  70: "质点与系统力学",
  74: "可形变固体力学",
  76: "流体力学",
  78: "光学与电磁理论",
  80: "经典热力学与热传导",
  81: "量子理论",
  82: "统计力学与物质结构",
  83: "相对论与引力理论",
  85: "天文学与天体物理",
  86: "地球物理",
  90: "运筹学与数学规划",
  91: "博弈论、经济、金融及社会行为科学",
  92: "生物学与其他自然科学",
  93: "系统理论与控制",
  94: "信息、通信理论与电路",
  97: "数学教育",
}
for (const entry of msc.entries) {
  const i = regionCodes.findIndex((cs) => cs.split(" ").includes(entry.code))
  if (i < 0) throw Error("Unmapped MSC " + entry.code)
  add(
    `math.msc.${entry.code}`,
    entry.title,
    translations[entry.code],
    "vol-1-existing",
    "subject",
    [`math.region.${ids[i]}`],
    ["src.msc2020"],
    {
      primary_region_id: `math.region.${ids[i]}`,
      classification_codes: { msc: [entry.code], arxiv: [] },
      source_locator: `MSC2020 ${entry.code}-XX`,
    },
  )
}
const byId = new Map(nodes.map((n) => [n.stable_id, n]))
for (const code of ["00", "01", "97"]) {
  const n = byId.get(`math.msc.${code}`)
  n.membership_role = "editorial-context"
  n.placement_note =
    "Placed beside foundations for navigation because the twelve requested macroregions have no separate history/education/general-overview container. This parent does not assert that history, education or collections are branches of mathematical logic."
}
const extraSubjects = [
  [
    "representation-theory",
    "Representation theory",
    "表示论",
    2,
    ["math.msc.20", "math.msc.16"],
    "math.RT",
  ],
  ["quantum-algebra", "Quantum algebra", "量子代数", 2, ["math.msc.17", "math.msc.16"], "math.QA"],
  [
    "operator-algebras",
    "Operator algebras",
    "算子代数",
    7,
    ["math.msc.46", "math.msc.47"],
    "math.OA",
  ],
  ["symplectic-geometry", "Symplectic geometry", "辛几何", 6, ["math.msc.53"], "math.SG"],
  ["spectral-theory", "Spectral theory", "谱理论", 7, ["math.msc.47"], "math.SP"],
  ["metric-geometry", "Metric geometry", "度量几何", 6, ["math.msc.51", "math.msc.52"], "math.MG"],
  [
    "mathematical-physics",
    "Mathematical physics",
    "数学物理",
    10,
    ["math.region.mathematical-physics"],
    "math.MP",
  ],
]
const subjectCrossReasons = {
  "representation-theory":
    "arXiv RT explicitly includes representations of algebras, providing the associative-algebra connection alongside group representations.",
  "quantum-algebra":
    "arXiv QA includes quantum groups and diagrammatic algebra; associative-algebra placement records their algebraic methods, not equality with all associative algebras.",
  "operator-algebras":
    "arXiv OA studies algebras of Hilbert-space operators, supporting a connection to operator theory alongside functional analysis.",
  "metric-geometry":
    "arXiv MG explicitly includes discrete and convex geometry, supporting this additional specific geometric placement.",
}
for (const [id, title, title_zh, i, parent_ids, code] of extraSubjects) {
  const n = add(
    `math.subject.${id}`,
    title,
    title_zh,
    "vol-1-existing",
    "subject",
    parent_ids,
    ["src.arxiv-math"],
    {
      primary_region_id: `math.region.${ids[i]}`,
      classification_codes: { msc: [], arxiv: [code] },
      source_locator: `arXiv ${code} description`,
      cross_memberships: parent_ids.slice(1).map((parent_id) => ({
        parent_id,
        reason: subjectCrossReasons[id],
        source_ids: ["src.arxiv-math"],
      })),
    },
  )
  byId.set(n.stable_id, n)
}
const arxivTargets = {
  AC: ["13"],
  AG: ["14"],
  AP: ["35"],
  AT: ["55"],
  CA: ["26", "33", "34", "42", "49"],
  CO: ["05"],
  CT: ["18"],
  CV: ["30", "32"],
  DG: ["53"],
  DS: ["37"],
  FA: ["46"],
  GM: ["00"],
  GN: ["54"],
  GR: ["20"],
  GT: ["57"],
  HO: ["00", "01", "97"],
  IT: ["94"],
  KT: ["19"],
  LO: ["03"],
  MG: ["metric-geometry"],
  MP: ["mathematical-physics"],
  NA: ["65"],
  NT: ["11"],
  OA: ["operator-algebras"],
  OC: ["49", "90", "91", "93"],
  PR: ["60"],
  QA: ["quantum-algebra"],
  RA: ["06", "08", "15", "16", "17", "20"],
  RT: ["representation-theory"],
  SG: ["symplectic-geometry"],
  SP: ["spectral-theory"],
  ST: ["62"],
}
const mappings = {
  msc: msc.entries.map((e) => ({
    code: e.code,
    target_ids: [`math.msc.${e.code}`],
    relation: "exact-official-subject",
    rationale: "Official first-level title retained as a specific canonical subject.",
  })),
  arxiv: arxiv.entries.map((e) => {
    const target_ids = arxivTargets[e.code.slice(5)].map((t) =>
      t.length === 2 ? `math.msc.${t}` : `math.subject.${t}`,
    )
    for (const id of target_ids) {
      const n = byId.get(id)
      if (!n.classification_codes.arxiv.includes(e.code)) n.classification_codes.arxiv.push(e.code)
      if (!n.source_ids.includes("src.arxiv-math")) n.source_ids.push("src.arxiv-math")
    }
    return {
      code: e.code,
      target_ids,
      relation: target_ids.length > 1 ? "scope-distributed" : "covered-by-specific-subject",
      rationale:
        "Mapped by the explicit official category description; broader or compound categories are distributed across specific subjects, not equated to one unrelated branch.",
    }
  }),
}
const frontierParents = {
  "inner-models": ["math.msc.03"],
  "model-theoretic-tameness": ["math.msc.03"],
  "higher-categorical-models": ["math.msc.18"],
  "cubical-univalence": ["math.msc.18", "math.msc.03", "math.msc.55"],
  "representation-categorification": ["math.subject.representation-theory", "math.msc.18"],
  "modular-blocks": ["math.subject.representation-theory", "math.msc.20"],
  "prismatic-cohomology": ["math.msc.11", "math.msc.14"],
  "local-langlands-geometrization": [
    "math.msc.11",
    "math.subject.representation-theory",
    "math.msc.14",
  ],
  "birational-boundedness": ["math.msc.14"],
  "derived-sheaf-moduli": ["math.msc.14", "math.msc.18"],
  "chromatic-k-theory": ["math.msc.55", "math.msc.19"],
  "floer-homotopy": ["math.msc.55", "math.subject.symplectic-geometry"],
}
const crossReasons = {
  "cubical-univalence": {
    "math.msc.03":
      "Univalent and cubical type theories are formal logical foundations with identity types and computational rules.",
    "math.msc.55":
      "The HoTT source interprets types through homotopy and constructs higher inductive types; the cubical source studies their higher-dimensional boundaries.",
  },
  "representation-categorification": {
    "math.msc.18":
      "Representation invariants are categorified using module categories, functors and Grothendieck groups, making categorical structure part of the research object.",
  },
  "modular-blocks": {
    "math.msc.20":
      "The Brauer source studies blocks and defect groups of finite groups; the finite-group structure is essential to the represented objects.",
  },
  "prismatic-cohomology": {
    "math.msc.14":
      "The foundational source attaches a ringed prismatic site to a p-adic formal scheme, while crystals and cohomology are geometric constructions on that site.",
  },
  "local-langlands-geometrization": {
    "math.subject.representation-theory":
      "The correspondence constructs parameters associated with representations; the geometric framework acts on sheaf categories tied to local representation theory.",
    "math.msc.14":
      "The geometric side uses stacks of bundles and motivic or l-adic sheaves; these are algebraic-geometric structures in the cited construction.",
  },
  "derived-sheaf-moduli": {
    "math.msc.18":
      "Derived moduli constructions use infinity-categorical coefficients, dg-categories and Hochschild homology, as stated in the two source abstracts.",
  },
  "chromatic-k-theory": {
    "math.msc.19":
      "Both sources study algebraic K-theory and its behavior under chromatic localization; ring and category hypotheses remain distinct.",
  },
  "floer-homotopy": {
    "math.subject.symplectic-geometry":
      "The lecture series derives applications to symplectic manifolds from moduli of Floer trajectories; the symplectic placement records that geometric setting.",
  },
}
for (const pack of packs)
  for (const region of pack.regions)
    for (const d of region.directions) {
      const key = d.stable_id.replace("math.frontier.", "")
      const parents = frontierParents[key] ?? d.parent_ids
      const n = add(
        d.stable_id,
        d.canonical_title,
        d.title_zh,
        "vol-1-existing",
        "frontier",
        parents,
        d.source_ids,
        {
          primary_region_id: region.id,
          aliases: d.aliases ?? [],
          regional_relevance: d.regional_relevance,
          frontier: {
            status: "ACTIVE_FRONTIER",
            direction_id: d.stable_id,
            activity_evidence: d.activity_evidence,
          },
          cross_memberships: parents.slice(1).map((parent_id) => ({
            parent_id,
            reason: crossReasons[key]?.[parent_id] ?? d.regional_relevance,
            source_ids: d.source_ids,
          })),
        },
      )
      byId.set(n.stable_id, n)
    }
for (const [id, title, title_zh] of [
  ["data-contracts", "Versioned mathematical data contracts", "数学数据契约与版本管理"],
  ["formal-evidence", "Formal evidence extraction", "形式证据抽取"],
  ["continuous-reader", "Continuous knowledge-space reading", "连续知识空间阅读"],
  ["proof-alignment", "Author–formal proof alignment", "作者证明与形式证明对齐"],
  ["sandbox", "Isolated Lean execution", "隔离 Lean 执行"],
  ["graph-proof", "Graph proof obligations", "图形证明义务"],
  ["maintenance", "Evidence invalidation and maintenance", "证据失效与维护"],
])
  add(`system.${id}`, title, title_zh, "vol-2-system", "engineering", ["vol-2-system"], [], {
    proposal_basis:
      "PHASE_ROADMAP.md; engineering plan, not mathematical field or implemented capability",
  })
for (const [id, title, title_zh] of [
  ["alignment-fidelity", "Alignment fidelity evaluation", "证明对齐忠实度评估"],
  ["navigability", "Mathematical navigation evaluation", "数学导航效果评估"],
  ["abstraction-candidates", "Abstraction candidates and hypotheses", "抽象候选与假设"],
  ["graph-roundtrip", "Graph-to-proof round-trip experiments", "图形与证明往返实验"],
  ["generality", "Controlled generality experiments", "受控一般化实验"],
])
  add(`research.${id}`, title, title_zh, "vol-3-research", "proposal", ["vol-3-research"], [], {
    proposal_basis: "PHASE_ROADMAP.md; proposed evaluation, no novelty or success claim",
  })
const registry = {
  schema_version: 1,
  version: 1,
  as_of,
  scope:
    "A source-audited title map, not mathematical exposition, proof verification, or a complete enumeration of mathematics.",
  volumes: ["vol-1-existing", "vol-2-system", "vol-3-research"],
  regions: ids.map((id) => `math.region.${id}`),
  nodes,
  mappings,
  identity_policy:
    "Do not change stable_id after registration. Multiple placements refer to one identity; no hash- or title-derived renumbering.",
  historical_aliases: [
    {
      classification: "MSC",
      code: "02",
      title: "Logic and foundations",
      active_years: "1940–1979",
      successor_ids: ["math.msc.03"],
      status: "HISTORICAL_NOT_COUNTED",
      source_url: "https://mathscinet.ams.org/mathscinet/info/docs/search-extras/search-msc",
    },
    {
      classification: "arXiv",
      code: "math.IT",
      canonical_external_code: "cs.IT",
      target_ids: ["math.msc.94"],
      status: "CURRENT_ALIAS_COUNTED_ONCE",
    },
    {
      classification: "arXiv",
      code: "math.MP",
      canonical_external_code: "math-ph",
      target_ids: ["math.subject.mathematical-physics"],
      status: "CURRENT_ALIAS_COUNTED_ONCE",
    },
  ],
}
await write("math_registry.json", registry)
await write("sources.json", {
  schema_version: 1,
  as_of,
  sources,
  usage_policy:
    "Titles, metadata and short AI paraphrases only. No report or paper full text is republished.",
})
const lines = []
function outline(id, depth, seen = new Set()) {
  if (seen.has(id)) throw Error("cycle " + id)
  const n = byId.get(id) ?? nodes.find((n) => n.stable_id === id)
  lines.push(`${"#".repeat(depth)} ${n.title_zh} · ${n.canonical_title}`)
  for (const child of nodes.filter((n) => n.parent_ids.includes(id)))
    outline(child.stable_id, depth + 1, new Set([...seen, id]))
}
for (const id of registry.volumes) outline(id, 1)
await fs.writeFile(new URL("math_outline.md", root), lines.join("\n\n") + "\n")
const substantive = nodes.filter((n) => n.volume_id === "vol-1-existing" && n.substantive)
const frontiers = substantive.filter((n) => n.frontier.status === "ACTIVE_FRONTIER")
const others = substantive.filter((n) => n.frontier.status !== "ACTIVE_FRONTIER")
const depth = (id) => {
  const n = nodes.find((n) => n.stable_id === id)
  return n.parent_ids.length ? 1 + Math.min(...n.parent_ids.map(depth)) : 0
}
const strata = {}
for (const n of others) {
  const key = `${n.primary_region_id}|depth-${depth(n.stable_id)}`
  ;(strata[key] ??= []).push(n.stable_id)
}
const seed = "phase-01-2026-09-10-v1"
const samples = Object.entries(strata).map(([stratum, all]) => ({
  stratum,
  total: all.length,
  required: Math.ceil(all.length * 0.1),
  sample_ids: [...all]
    .sort((a, b) => sha(seed + "\0" + a).localeCompare(sha(seed + "\0" + b)))
    .slice(0, Math.ceil(all.length * 0.1)),
}))
await write("benchmarks/sample-selection.json", {
  schema_version: 1,
  seed,
  method:
    "SHA256(seed + NUL + stable_id), ascending hex; ceil(10%) per primary-region/depth stratum",
  population_count: others.length,
  strata: samples,
  frontier_ids: frontiers.map((n) => n.stable_id),
})
let audit
try {
  audit = await read("audit.json")
} catch {}
await write("audit.json", {
  schema_version: 1,
  as_of,
  status: "PARTIAL",
  classification_acquisition: {
    msc: {
      official_total: msc.official_total,
      acquired: msc.acquired_total,
      mapped: mappings.msc.length,
      snapshot: "ontology/benchmarks/msc2020-level1.json",
    },
    arxiv: {
      official_total: arxiv.official_total,
      acquired: arxiv.acquired_total,
      mapped: mappings.arxiv.length,
      snapshot: "ontology/benchmarks/arxiv-math.json",
    },
  },
  counts: {
    canonical_nodes: nodes.length,
    volume_one_substantive: substantive.length,
    frontiers_unique: frontiers.length,
    source_records: sources.length,
    outline_placements: lines.length,
  },
  source_coverage: {
    verified_nodes: substantive.filter((n) =>
      n.source_ids.some((id) =>
        sources.some((s) => s.id === id && s.retrieval_status === "VERIFIED"),
      ),
    ).length,
    total: substantive.length,
  },
  frontier_audit: frontiers.map((n) => ({
    stable_id: n.stable_id,
    region: n.primary_region_id,
    source_groups: [
      ...new Set(n.source_ids.map((id) => sources.find((s) => s.id === id)?.source_group)),
    ],
    reviewer_type: "AI",
    human_reviewer: null,
    status: "NOT_RUN",
  })),
  sampling: {
    selection: "ontology/benchmarks/sample-selection.json",
    seed,
    status: "NOT_RUN",
    reviews: [],
  },
  deduplication: [
    {
      case: "MSC and arXiv overlap",
      decision:
        "Official classifications map to one subject identity where scopes agree; compound scopes may map to several subjects. The mapping is not an assertion of equality.",
      retired_ids: [],
    },
    {
      case: "arXiv current aliases",
      decision:
        "math.IT and math.MP stay in the 32-category denominator, while cs.IT and math-ph are not duplicate nodes.",
    },
    {
      case: "Stokes paper split",
      decision:
        "Use arXiv:2504.05360 for derived moduli; do not count old 2401.12335v1 and its successor as independent works.",
    },
  ],
  gaps: [
    {
      code: "GRANULARITY_BOUNDARY",
      detail:
        "MSC first-level and arXiv category coverage is complete for the frozen lists; this is not coverage of every MSC lower-level code or every mathematical topic.",
    },
    {
      code: "NO_HUMAN_REVIEW",
      detail:
        "All present source/label review is AI; no mathematical proof or human expert review is claimed.",
    },
    ...packs.flatMap((p) => p.gaps ?? []),
  ],
  prior_audit_preserved: audit ? { status: audit.status } : undefined,
})
console.log(
  JSON.stringify({
    nodes: nodes.length,
    substantive: substantive.length,
    frontiers: frontiers.length,
    sources: sources.length,
    samples: samples.reduce((n, s) => n + s.sample_ids.length, 0),
  }),
)
