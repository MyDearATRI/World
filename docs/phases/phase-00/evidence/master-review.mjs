import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const input = path.join(
  os.homedir(),
  ".codex/attachments/8f12098b-5076-47aa-a1fc-c806017ac927/pasted-text.txt",
)
const raw = await fs.readFile(input)
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex")
const expected = "e3ff6b57f67b198f81cb8234aa835c9e5bf1c12c4c6a5a3763a8c60074141619"
if (sha(raw) !== expected)
  throw new Error("Original Master changed: review again before updating mappings")
const text = raw.toString("utf8")
const sections = [...text.matchAll(/^# (\d+)\. (.+)$/gmu)]
if (sections.length !== 77 || sections.some((s, i) => Number(s[1]) !== i + 1))
  throw new Error("Expected the original 77 ordered sections")
// Written after reading all 2,580 source lines. These are audited summaries,
// not auto-inferred labels and not claims that the future features exist.
const review = [
  [
    "原文步骤、形式上下文、Lean前后状态与图双向定位，编辑真实重检；形式正确和作者忠实分开。",
    "P05-01;P05-02;P06-05;P07-06",
    "5;6;7",
  ],
  [
    "传统博客、卡片、装饰图、无对齐编辑器、只可下载证明均不能替代主目标；视觉新颖不足以完成。",
    "P03-01;P07-06;GLOBAL-NONGOALS",
    "0;3;7",
  ],
  [
    "23类核心对象；ViewState以focus/lens/resolution/localgraph/unfolding变换，URL保留但不主导交互。",
    "P02-02;P03-01;P03-03",
    "2;3",
  ],
  [
    "连续语境，至少五级语义信息，MVP三种指定视角；切换不改形式真值，Topos只是名称。",
    "P03-01;P03-02;P03-03",
    "2;3",
  ],
  [
    "关系类型、方向、上下文、来源、形式/语义证据与置信分离；布局不是本体，对偶不等于排斥。",
    "P02-03;P02-06;P03-01",
    "2;3",
  ],
  [
    "Module、Declaration、Structure、Proof、Semantic、Pedagogy六图互通不混淆。",
    "P02-03;P05-06;P07-04",
    "2;5;7",
  ],
  [
    "Lean是形式证据层；不能模拟proofstate或诊断，不由AI/UI决定正确性。",
    "P02-01;P02-04;P02-05;P06-01",
    "2;6",
  ],
  [
    "每份形式工件绑定Lean/toolchain/Lake锁/依赖/提交/源版本/构建配置；变化失效。",
    "P02-01;P02-06;P04-04;P10-05",
    "2;4;10",
  ],
  [
    "发布禁止未闭合目标、占位与未授权公理，暴露传递公理；学生未完成保持INCOMPLETE。",
    "P02-05;P06-01;GLOBAL-INTEGRITY",
    "2;6",
  ],
  [
    "定理单元包括原文/形式陈述及证明、步骤、对齐、状态、依赖、图、替代、证据和版本，渐进展开。",
    "P04-01;P04-02;P04-05",
    "4",
  ],
  [
    "多对多对齐包含prose/formal/proofnode IDs、范围、前后状态、假设、策略、审阅与证据；不用行号唯一定位。",
    "P05-01;P05-02;P05-04;P05-06",
    "5",
  ],
  ["形式验证六态与作者对齐六态独立，不合并绿勾。", "P02-05;P05-05;P06-05", "2;5;6"],
  [
    "默认保留作者路线，区分忠实形式化、实现细节、补充步骤、替代证明；报告原证明缺口。",
    "P04-03;P04-06;P05-03",
    "4;5",
  ],
  [
    "发布阅读使用版本化预计算证据；编辑模式真实运行Lean并区分学生与作者版本。",
    "P04-05;P06-01;P06-05;P06-06",
    "4;6",
  ],
  [
    "调查当前Lean生态版本/维护/许可证/边界/性能/失败模式，断网明确BLOCKED。",
    "P00-03;P02-01;P06-03",
    "0;2;6",
  ],
  [
    "不可信学生代码必须有进程/会话/文件/网络隔离、CPU内存时间限制，无宿主凭据与发布写权限。",
    "P06-03;P07-07;P10-06",
    "6;7;10",
  ],
  [
    "Graph Prove从图操作生成形式义务并经Lean检查，不是只展示完成证明。",
    "P07-01;P07-02;P07-06",
    "7",
  ],
  [
    "证明图记录局部上下文、变量、类型、目标、作用域、分支、多前提与见证；类型化图/超图/DAG候选须论证。",
    "P02-04;P07-03;P07-04",
    "2;7",
  ],
  [
    "八类图操作：引入、应用、exact、重写、构造、分类、归纳、中间引理；不支持项明确标注。",
    "P07-01;P07-02",
    "7",
  ],
  ["已验证推理边必须指向实际形式片段、声明、项或检查义务；连通不等于证明。", "P07-04", "7"],
  [
    "受支持子集Graph→Lean→Graph语义往返保持陈述/上下文/作用域/依赖/分支/状态，不要求文本相同。",
    "P07-03",
    "7",
  ],
  ["证明语义缩放可回到具体步骤/状态，折叠保留来源与形式边界。", "P07-05;P09-C", "7;9"],
  [
    "结构化重组形式库，检查实际假设、原始定义、重复抽象、过强结构、共同构造与模块边界。",
    "P08-01;P08-02;P08-03",
    "8",
  ],
  ["类型、体、类型类、模块、语义和教学依赖分开，不能都由文本相似生成。", "P02-03;P08-01", "2;8"],
  ["弱化实验明确搜索空间与预算；四类科学结果分开，证明失败不等于假。", "P08-02;P09-D", "8;9"],
  [
    "抽象成功要求一般陈述/一般证明及至少三个原实例的形式推导，可得时有保留例。",
    "P08-03;P09-E",
    "8;9",
  ],
  ["跨理论传输需真实接口与保持条件，不靠名称/语义相似。", "P09-F", "9"],
  [
    "多证明共存并保存策略/依赖/结构/一般性/教学性；proof irrelevance不等于策略相同。",
    "P05-06;P09-A;P09-E",
    "5;9",
  ],
  [
    "涌现来自可追溯共同结构/图群落等；视觉区域不授予定理/新领域/已验证抽象身份。",
    "P03-01;P03-02;P08-03;P09-E",
    "3;8;9",
  ],
  [
    "数学全景覆盖经典/现代/专门/前沿/物理/形式基础/理论CS/应用，不能只凭模型记忆。",
    "P01-02;P01-03;P01-04",
    "1",
  ],
  [
    "实际核查官方分类、研究机构、会议/期刊/书籍/综述等来源，前沿用近期证据。",
    "P01-03;P01-04;P01-05",
    "1",
  ],
  [
    "三个工件：纯标题大纲、稳定注册表、基准/来源/前沿/缺口审计；标题内无说明/证明/引用。",
    "P01-01;P01-06",
    "1",
  ],
  [
    "MSC一级与arXiv已取得分类映射100%，每个实质节点有支持来源；不宣称100%数学。",
    "P01-02;P01-03",
    "1",
  ],
  ["十二宏区各至少两个活跃前沿，有实质近期证据；不足明确不确定。", "P01-04;P01-05", "1"],
  ["先做Group→Action→Representation连续小切片，成功前不扩张千节点。", "P03-01;P03-02;P03-03", "3"],
  [
    "150可见概念/400关系固定场景，median≥45FPS、约1.2秒稳定、无漂移/清屏，必须实测。",
    "P03-04;P03-05;P10-04",
    "3;10",
  ],
  ["键盘、减少动画、冻结布局、高对比、焦点与文本选择；无需动画也可读证明。", "P03-06", "3"],
  [
    "至少12定理/4主题/6证明模式/60实质步骤，完整原文/形式/对齐/图/证据，不按语法凑数。",
    "P04-01;P04-02",
    "4",
  ],
  [
    "十二单元冻结集所有原文步骤→全部形式对应和反向导航均100%；不外推通用准确率。",
    "P05-01;P05-02",
    "5",
  ],
  ["至少12对同结论不同策略，错误标忠于作者为0。", "P04-06;P05-03", "4;5"],
  [
    "至少60真实编辑用例包含有效/语法/类型/应用/未闭合/假设/重写/修复，状态与Lean100%一致。",
    "P06-01",
    "6",
  ],
  ["至少30快速乱序编辑序列，旧响应覆盖当前修订为0。", "P06-02", "6"],
  [
    "固定预热环境编辑延迟p50≤1.5s/p95≤4s，实测瓶颈；只读阅读不依赖实时编译。",
    "P06-04;P06-06;P10-04",
    "6;10",
  ],
  [
    "八操作每类10有效/8无效，共80/64/144；有效义务及补全路线通过，无效拒绝或不验证。",
    "P07-01;P07-02",
    "7",
  ],
  ["至少40受支持证明工件往返，逐字段保持陈述/上下文/作用域/依赖/分支/状态。", "P07-03", "7"],
  [
    "两个干净独立环境各12/12验证，记录toolchain/lock/commit/platform/date。",
    "P04-04;P10-05",
    "4;6;10",
  ],
  ["研究议程均为候选研究，不是既成贡献。", "P09-A;P09-B;P09-C;P09-D;P09-E;P09-F;P09-G;P09-H", "9"],
  [
    "A：60定理300人类步骤，建议30/10/20划分，两人独立封存标注；macroF1≥.90且较最强可复现基线绝对提升≥.05。",
    "P09-A",
    "9",
  ],
  [
    "B：图操作可理解性与正确性，任务/修复/时间/往返，对照适当Lean编辑器；无比较不宣称教学优越。",
    "P09-B",
    "9",
  ],
  ["C：多尺度压缩测边界/上下文/恢复/对齐/人类理解/来源，每压缩点可返回正式证据。", "P09-C", "9"],
  ["D：至少10弱化注册实验，固定原陈述/候选/空间/预算/分类/形式证据，不无界称最小。", "P09-D", "9"],
  ["E：一般定理检查及至少三原定理导出，保留例可得时测试；重构/再发现/新颖性分开。", "P09-E", "9"],
  ["F：每成功传输有源目标定理/形式接口/保持假设/传输证明/结果。", "P09-F", "9"],
  ["G：受控变异测失效召回/误报/修复/人工维护时间；编译通过也可能解释失效。", "P09-G", "9"],
  ["H：近远迁移、重建、假设识别、修复和延迟保持，有明确对照，不用停留时间替代。", "P09-H", "9"],
  [
    "新颖性前查文献软件；每贡献记录问题/最邻近工作/相同差别/基线/声明/所需证据/状态。",
    "P09-A;P09-B;P09-C;P09-D;P09-E;P09-F;P09-G;P09-H",
    "9",
  ],
  [
    "认识状态区分已验证、仅陈述、作者/审阅、AI生成/猜测、研究候选、未解/陈旧/拒绝。",
    "P02-05;P05-05;GLOBAL-EPISTEMIC",
    "2;5",
  ],
  [
    "每重要声明有证据、环境、版本、时间与假设，不只verified布尔值。",
    "P02-01;P02-06;GLOBAL-EVIDENCE",
    "0;2",
  ],
  ["五种完成状态；不能凭预期或阻塞伪造PASS。", "GLOBAL-STATUS;P00-04", "0;1;2;3;4;5;6;7;8;9;10"],
  [
    "机器验收报告包含目标/用户任务/工件/指标/门槛/环境/实测/证据/限制/状态。",
    "P00-04;P00-05;GLOBAL-REPORT",
    "0;1;2;3;4;5;6;7;8;9;10",
  ],
  [
    "本体、查询、布局、渲染、Lean、抽取、对齐、GraphProve、文档等显式契约分层。",
    "P00-03;P02-02;P05-06;P07-04",
    "0;2;5;7",
  ],
  [
    "GPU动态世界与DOM数学阅读，调查现行图形工具兼容性，不因流行选库。",
    "P00-03;P03-04;P03-06",
    "0;3",
  ],
  ["默认2.5D语义层次，全3D须有语义价值；不可读星系失败。", "P03-01;P03-02;P03-06", "3"],
  [
    "避免卡片仪表盘、玻璃/霓虹/粒子/无义运动、固定主题栏主导、巨hero/SaaS；动画须传达结构。",
    "GLOBAL-NONGOALS;P03-01;P03-06",
    "0;3",
  ],
  ["空仓先ADR后切片；已有实现先审计并复用，不为偏好重写。", "P00-02;P00-03", "0"],
  [
    "Phase0–10逐阶段，以真实前置验收进入；覆盖审计→地图→形式→视觉→笔记→对齐→编辑→图证→分析→研究→扩展。",
    "P00-01;P00-04;GLOBAL-PHASE-GATES",
    "0;1;2;3;4;5;6;7;8;9;10",
  ],
  [
    "集成完成须原文步骤→Lean/真实状态→图→编辑实检→恢复作者且身份状态版本一致。",
    "P06-05;P07-06",
    "6;7",
  ],
  [
    "视觉完成须同空间连续重排、旧新语境、语义深入、视角不改真值，录像可辨层次与连续性。",
    "P03-01;P03-02;P03-03;P03-05",
    "3",
  ],
  ["形式切片必须读取真实Lean工件和依赖，AI推断漂亮图不算。", "P02-01;P02-03;P02-04", "2"],
  [
    "假诊断/错验证/策略替换/候选混同/假图/造前沿/作者归属错/陈旧/越权/漏失败均触发失败。",
    "GLOBAL-FAILURE;P02-05;P06-03;P07-07;P10-07",
    "0;2;6;7;10",
  ],
  [
    "小切片、类型契约、来源、迁移、隔离、状态可观察、可重放测试，避免投机大重写。",
    "P00-03;P02-02;P05-04;P06-02",
    "0;2;5;6",
  ],
  [
    "变化事实与研究必须实查权威来源，不幻觉文献/创新优先权。",
    "P00-03;P01-03;P01-04;P09-A",
    "0;1;9",
  ],
  [
    "相似度/聚类/置信/距离只产候选，数学主张需形式证明或恰当证据。",
    "GLOBAL-EPISTEMIC;P08-03;P09-E",
    "0;8;9",
  ],
  [
    "AI辅助搜索分类对齐与建议，Lean核验形式，人类审阅意义；候选不能静默升级。",
    "GLOBAL-REVIEW;P04-03;P05-05;P09-A",
    "0;4;5;9",
  ],
  [
    "长期双向从领域到形式工件并保留身份来源，从模式到一般定理/验证/重构，目标不是既有能力。",
    "P08-03;P09-E;P10-07",
    "8;9;10",
  ],
  [
    "先审计/四文档/可验收目标，原文要求随后Phase1；路线图按用户指定阶段停止并交接。",
    "P00-01;P00-05;P01-01;GLOBAL-SCOPE",
    "0;1",
  ],
  [
    "最终三转换：人类↔已验证形式、证明↔可导航结构、局部↔全局；缺一仍为中间原型。",
    "P07-06;P10-07",
    "7;10",
  ],
]
if (review.length !== 77) throw new Error(`Expected 77 reviewed rows, got ${review.length}`)
const artifacts = {
  0: "docs/current-state.md;docs/assumptions.md;docs/architecture-plan.md;docs/acceptance-criteria.md;docs/phases/phase-00/acceptance.json",
  1: "ontology/math_outline.md;ontology/math_registry.json;ontology/audit.json",
  2: "formal/;schemas/;data/formal/;docs/verification-policy.md",
  3: "data/visual-slice/;tests/navigation/;benchmarks/visual/",
  4: "notes/benchmark-12/;data/notes/;benchmarks/notes/manifest.json;reviews/notes/",
  5: "data/alignments/;tests/alignment/;tests/versioning/;docs/alignment-policy.md",
  6: "tests/live-edit/;tests/race/;tests/sandbox/;benchmarks/lean-latency/;docs/security-boundary.md",
  7: "docs/graph-prove-supported-subset.md;benchmarks/graph-prove/operations/;benchmarks/graph-prove/roundtrip/",
  8: "docs/bourbaki-analysis.md;analysis/dependency-report.json;experiments/hypothesis-weakening/;analysis/abstraction-candidates.json",
  9: "research/phase-9/;research/phase-9/index.md",
  10: "benchmarks/scale/;docs/scale-report.md;docs/release-gate.md;docs/deployment.md",
}
const rows = sections.map((section, i) => {
  const [summary, criteria, phases] = review[i]
  const content = text.slice(section.index, sections[i + 1]?.index ?? text.length)
  return {
    master_section: i + 1,
    original_heading: section[2],
    original_start_line: text.slice(0, section.index).split(/\r?\n/u).length,
    original_section_sha256: sha(content),
    requirement_summary: summary,
    requirement_origin: "M",
    source_basis: "Full original Master read and mapped; Roadmap provides phase refinements",
    master_sha256: expected,
    phase_and_criteria: criteria,
    phases,
    target_artifacts: [...new Set(phases.split(";").flatMap((p) => artifacts[p].split(";")))].join(
      ";",
    ),
    mapping_status: "PASS",
    original_text_verified: true,
    implementation_status: "NOT_RUN",
    non_goal: [2, 64].includes(i + 1),
    limitations:
      i === 63
        ? "Current user explicitly requested topic/sidebar filters; C-UI permits secondary controls without replacing continuous focus. Phase3 must verify this distinction."
        : i === 75
          ? "Roadmap/user per-phase scope supersedes automatic indefinite continuation. Current user authorized Phase0 and Phase1 only."
          : "Mapping PASS only; does not assert feature implementation, Lean verification or human review",
  }
})
const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`
const keys = Object.keys(rows[0])
await fs.writeFile(
  path.join(root, "docs/requirements-traceability.csv"),
  [
    keys.map(escape).join(","),
    ...rows.map((row) => keys.map((key) => escape(row[key])).join(",")),
  ].join("\n") + "\n",
)
const evidence = path.join(root, "docs/phases/phase-00/evidence")
await fs.writeFile(
  path.join(evidence, "master-mapping-review.json"),
  JSON.stringify(
    {
      version: 1,
      reviewedAt: new Date().toISOString(),
      method:
        "Codex read all 2580 lines and manually summarized each of the 77 sections; machine checks only verify numbering, hashes and destinations",
      reviewerRole: "AI engineering audit; not human mathematical review",
      masterHash: expected,
      rows,
    },
    null,
    2,
  ) + "\n",
)
await fs.mkdir(path.join(root, "artifacts/phase-00/private-inputs"), { recursive: true })
const backup = path.join(root, "artifacts/phase-00/private-inputs/master-prompt.txt")
try {
  const existing = await fs.readFile(backup)
  if (sha(existing) !== expected)
    throw new Error("Existing private Master backup differs; refusing overwrite")
} catch (error) {
  if (error.code !== "ENOENT") throw error
  await fs.writeFile(backup, raw, { flag: "wx" })
}
await fs.writeFile(
  path.join(evidence, "input-resolution.json"),
  JSON.stringify(
    {
      status: "PASS",
      sourceThread: "01a0871b-9721-7c50-92b8-9d1aa3376150",
      userMessage: "01a0871f-af22-7392-a6c1-c28502dfcd3b",
      attachmentID: "8f12098b-5076-47aa-a1fc-c806017ac927",
      fileName: "pasted-text.txt",
      masterBytes: raw.length,
      masterSha256: expected,
      numberedSections: 77,
      sourceLines: 2580,
      resolvedAt: new Date().toISOString(),
      priorCheck:
        "local-audit.json inputs recorded three missing proposed locations and two unrelated earlier attachments; this was a bounded search, not evidence that the user never supplied the Master",
      privateBackup:
        "artifacts/phase-00/private-inputs/master-prompt.txt (ignored; not an upload artifact)",
      publicationBoundary:
        "Only section summaries/headers/hashes are public; original text remains local",
      requiredHumanReview: null,
    },
    null,
    2,
  ) + "\n",
)
console.log(
  JSON.stringify({
    reviewedSections: rows.length,
    masterSha256: expected,
    mappingStatus: "PASS",
    implementationStatus: "NOT_RUN",
    originalCopiedToPublic: false,
  }),
)
