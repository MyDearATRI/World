import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../../../../", import.meta.url))
const evidence = path.join(root, "docs/phases/phase-00/evidence")
const research = JSON.parse(
  await fs.readFile(path.join(evidence, "official-research.json"), "utf8"),
)
const local = JSON.parse(await fs.readFile(path.join(evidence, "local-audit.json"), "utf8"))
const repositories = Object.fromEntries(research.repositories.map((item) => [item.repo, item]))
const packages = Object.fromEntries(research.packages.map((item) => [item.name, item]))
const installed = Object.fromEntries(local.repository.dependencies.map((item) => [item.name, item]))
const rows = []
function lean(id, name, repo, version, role, compatibility, alternative, failure, phase, docs) {
  const r = repositories[repo]
  rows.push({
    id,
    name,
    version,
    selection: "CANDIDATE_NOT_INSTALLED",
    license: r.license,
    maintenanceEvidence: {
      kind: "Observed official repository commit, not a support guarantee",
      commit: r.commit,
      date: r.commitDate,
      archived: r.archived,
    },
    source: `${r.url}/tree/${r.commit}`,
    documentation: docs ?? r.readmeEvidence?.url ?? r.url,
    reason: role,
    compatibility,
    alternative,
    performanceHypothesis:
      "No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable",
    failureMode: failure,
    boundary:
      "Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session",
    verifyPhase: phase,
    compatibilityStatus: "NOT_RUN",
  })
}
lean(
  "lean-lsp",
  "Lean language server",
  "leanprover/lean4",
  "4.33.1 (stable release candidate for project adoption)",
  "复用官方真实诊断与文件快照，不实现假检查器。",
  "官方v4.33.1服务器源码已读；同名mathlib toolchain已核对。未安装，不能声称本机或跨版本兼容。",
  "Phase2离线Lean抽取，Phase6前不接实时服务",
  "进程退出/依赖缺失/旧修订响应；LSP进程分离不是安全沙箱",
  "2;6",
  "https://github.com/leanprover/lean4/tree/v4.33.1/src/Lean/Server",
)
lean(
  "lean-rpc",
  "Lean RPC",
  "leanprover/lean4",
  "4.33.1 (core API)",
  "可查询交互状态/表达式，避免搬运完整Environment。",
  "RpcRef依附文件会话和wire format，不能当永久公开ID；需要版本与释放协议。",
  "持久的离线JSON证据；浏览器只读预计算结果",
  "会话重连后引用无效、未释放引用、跨修订误配",
  "2;6",
  "https://github.com/leanprover/lean4/blob/v4.33.1/src/Lean/Server/Rpc/Basic.lean",
)
lean(
  "lean-infotree",
  "InfoTree / TacticInfo",
  "leanprover/lean4",
  "4.33.1 (core API)",
  "TacticInfo实际含前后metavariable context及goals，适合作为状态抽取来源。",
  "不是现成完整ProofGraph；失败choice、分支、隐式上下文和作用域需要保留。",
  "SubVerso辅助导出；仅声明级数据不满足步骤验收",
  "丢失前提/作用域、只见最终项而丢轨迹、内部API变化",
  "2;7",
  "https://github.com/leanprover/lean4/blob/v4.33.1/src/Lean/Elab/InfoTree/Types.lean",
)
lean(
  "verso",
  "Verso",
  "leanprover/verso",
  repositories["leanprover/verso"].commit,
  "研究带Lean状态的静态文档能力，不替换Obsidian主源。",
  "观察快照toolchain为4.34.0-rc2；官方要求按Lean release配套tag，不与4.33.1直接混用。",
  "Quartz HAST +网站自有正式数据契约",
  "重写文档格式、版本不匹配、无意维护两套发布引擎",
  "2;4",
  "https://github.com/leanprover/verso",
)
lean(
  "subverso",
  "SubVerso",
  "leanprover/subverso",
  repositories["leanprover/subverso"].commit,
  "候选用于高亮、模块抽取、命名代码区间和状态辅助。",
  "官方说明跨Lean版本测试，但内部序列化无跨SubVerso版本兼容承诺；旧Lean还有module-gap分支要求。",
  "自有Lean extractor与版本化公开schema",
  "依赖私有JSON、抽取格式升级、用说明性高亮冒充验证",
  "2",
  "https://github.com/leanprover/subverso",
)
lean(
  "infoview",
  "Lean Infoview",
  "leanprover/vscode-lean4",
  packages["@leanprover/infoview"].version,
  "候选复用真实目标/消息的交互呈现。",
  "npm版本0.13.0与扩展v0.0.239不是同一版本号；不能按名称假定所有RPC版本兼容。",
  "网站自有只读状态面；必要时独立编辑区域",
  "RPC会话丢失、DOM/样式冲突、静态地址资源缺失",
  "6",
  "https://github.com/leanprover/vscode-lean4/tree/5a25e6abb2e973b4c89a053acc74c479c0bb2e9f/lean4-infoview",
)
lean(
  "lean4monaco",
  "lean4monaco",
  "hhu-adam/lean4monaco",
  packages.lean4monaco.version,
  "候选浏览器编辑与Infoview连接层。",
  "官方要求单LeanMonaco实例、start生命周期和WS连接；Vite/polyfills示例不自动适配当前esbuild。",
  "独立按需editor island，或保留静态阅读与外部Lean工作流",
  "重复挂载、Worker路径、polyfill体积、断开后旧结果覆盖",
  "6",
  "https://github.com/hhu-adam/lean4monaco",
)
lean(
  "lean4web",
  "lean4web",
  "leanprover-community/lean4web",
  "0.2.2; inspected commit " + repositories["leanprover-community/lean4web"].commit,
  "候选参考真实前后端连接与项目管理，不直接部署。",
  "官方为server-side Lean、小型片段用途；不是纯浏览器/Pages运行时。",
  "自有最小LSP网关 + Phase6独立沙箱；静态预计算阅读",
  "公开执行无资源隔离、会话串读、托管服务成本",
  "6",
  "https://github.com/leanprover-community/lean4web",
)
lean(
  "proofwidgets",
  "ProofWidgets4",
  "leanprover-community/ProofWidgets4",
  "0.0.110",
  "候选显示领域特定对象/目标，不将可视化当真值。",
  "观察release/head toolchain 4.34.0-rc2；要按Lean匹配release。预构建JS不保证用户自定义widget免构建。",
  "DOM/KaTeX的只读状态视图",
  "不可信widget脚本、版本失配、界面组件不能提供证明证据",
  "2;6;7",
  "https://github.com/leanprover-community/ProofWidgets4",
)
lean(
  "leanblueprint",
  "LeanBlueprint",
  "PatrickMassot/leanblueprint",
  "0.0.20; inspected commit " + repositories["PatrickMassot/leanblueprint"].commit,
  "候选借鉴论证计划/声明关联，可作为对照而非第二写作引擎。",
  "Python/plasTeX/Graphviz依赖；checkdecls验证声明存在，不证明作者步骤对齐。PyPI标MIT而该commit LICENSE是Apache-2.0，采用前须核验发行包许可。",
  "Quartz Markdown +自有Alignment/Evidence",
  "许可证元数据冲突、Windows原生Graphviz依赖、leanok仅标注被误当实检",
  "2;5",
  "https://github.com/PatrickMassot/leanblueprint",
)
rows.at(-1).license =
  "Apache-2.0 in inspected repository LICENSE; PyPI 0.0.20 classifier says MIT (unresolved distribution metadata mismatch)"
lean(
  "mathlib",
  "mathlib4 / cache tooling",
  "leanprover-community/mathlib4",
  "v4.33.1 (proposed project pin); inspected head " +
    repositories["leanprover-community/mathlib4"].commit,
  "首批声明、定理与实例来源，复用正式库及其锁定依赖和缓存工具。",
  "已读同名tag toolchain=4.33.1；head当前4.34rc2。Phase2必须解析实际commit并固定Lake锁。缓存存在不等于当前源码重检。",
  "Lean core的受控小样例先验证导出器，再加入mathlib",
  "缓存/源版本不符、传递公理未核查、冷构建资源不足",
  "2;4",
  "https://github.com/leanprover-community/mathlib4/blob/v4.33.1/lean-toolchain",
)
lean(
  "docgen",
  "doc-gen4",
  "leanprover/doc-gen4",
  repositories["leanprover/doc-gen4"].commit,
  "候选声明文档/源码链接参考，不作为proofstate或对齐替代。",
  "当前toolchain=4.34.0-rc2；官方要求release对应branch。",
  "自有声明JSON与Quartz证据组件",
  "toolchain不匹配、链接映射失效、文档元数据被当证明结构",
  "2",
  "https://github.com/leanprover/doc-gen4",
)
const graph = [
  [
    "pixi.js",
    "PixiJS",
    "CONSIDERED_NOT_SELECTED",
    "已安装8.15.0源于既有依赖；不为审计替换现有Three。候选提供WebGL/WebGPU场景。",
    "官方v8文档；现装与注册表版本不同。数学DOM/焦点/键盘仍需单独实现。",
    "Three.js0.185.1 + DOM",
    "纹理文字不可选、无意义ticker常驻、迁移增加两套渲染维护",
    "3",
    "https://pixijs.com/8.x/guides/concepts/architecture",
  ],
  [
    "sigma",
    "Sigma.js",
    "CONSIDERED_NOT_INSTALLED",
    "大规模图渲染候选，只有固定负载测量显示需要时考虑。",
    "官方stable文档3.x；4为alpha。以Graphology为数据后端，不能直接替换当前typed relation与2.5D阅读。",
    "既有Three renderer",
    "label/卡片尺寸自定义成本、图数据与正式证据误耦合",
    "3;10",
    "https://www.sigmajs.org/docs/",
  ],
  [
    "graphology",
    "Graphology",
    "CONSIDERED_NOT_INSTALLED",
    "多重/混合图与算法候选，六种关系图需要typed edge identity。",
    "peer graphology-types>=0.24；并行边可以保留多来源。标准库整包可能滞后。",
    "现有typed JSON+Map邻接索引",
    "可变属性覆盖来源、混合图方向含义丢失、打入整个算法库",
    "2;3;10",
    "https://graphology.github.io/",
  ],
  [
    "d3-force",
    "D3 force",
    "AVAILABLE_ALTERNATIVE",
    "既有D37.9中含force3.0.0；碰撞/力布局替代选项。",
    "无DOM依赖，可手动tick；会修改节点，必须与不可变ontology分离。",
    "当前Topos自有有阻尼field",
    "无限tick、对语义关系一视同仁、布局对象反向改数学状态",
    "3",
    "https://d3js.org/d3-force",
  ],
  [
    "d3-force-3d",
    "D3 force 3D",
    "RETAIN_EXISTING_LEGACY",
    "旧3D图已用3.0.6；主体验仍为自有2.5D field，不另重写。",
    "现装/锁定/官方registry均3.0.6；二维三维布局接口不等于语义推理。",
    "现有Topos field",
    "模型与速度混放、过密吸引、三维遮挡影响读者",
    "3",
    "https://github.com/vasturiano/d3-force-3d",
  ],
  [
    "three",
    "Three.js",
    "RETAIN_CURRENT",
    "保留已实现的正交GPU世界、按需帧与Canvas2D降级。",
    "使用0.185.1；registry已0.186.0，本轮不升级。2.5D用DOM阅读而非贴图数学。",
    "Pixi8或Sigma3，经固定场景比较后决定",
    "WebGL初始化/丢上下文、DOM标签碰撞、资源泄漏",
    "3;10",
    "https://github.com/mrdoob/three.js/tree/r185",
  ],
  [
    "preact",
    "Preact",
    "RETAIN_CURRENT",
    "Quartz现有组件10.28.2沿用。",
    "不把React兼容模式当Infoview实际兼容证据。",
    "独立React editor island；不重写全站",
    "双框架渲染所有权冲突、重复事件/历史管理",
    "3;6",
    "https://preactjs.com/guide/v10/getting-started/",
  ],
  [
    "react",
    "React",
    "CONSIDERED_NOT_INSTALLED",
    "只在后续编辑库确需时用于独立按需区域。",
    "观察registry19.3.0；实际Infoview/Monaco版本与peer链需Phase6测，不默认追新。",
    "现有Preact和DOM；静态证据无需React",
    "体积与hydration开销、共享DOM生命周期冲突",
    "6",
    "https://react.dev/learn/add-react-to-an-existing-project",
  ],
  [
    "motion",
    "Motion",
    "CONSIDERED_NOT_INSTALLED",
    "有限UI过渡的可选工具；当前物理与CSS已可复用，无新增必要。",
    "13.2.0有JS/React等API，React peers为18/19；不是布局本体引擎。",
    "现有有限RAF/CSS/WAAPI",
    "装饰动画替代语义变化、reduced-motion未覆盖、两个RAF循环",
    "3",
    "https://motion.dev/docs",
  ],
  [
    "katex",
    "KaTeX",
    "RETAIN_CURRENT",
    "保留0.16.28真实Markdown的HTML+MathML和同版字体。",
    "registry0.18.7不直接套配置；现有0.16.28类型/源码和渲染检查是当前依据。",
    "MathJax（若出现明确不兼容再研究）",
    "宏/信任策略、长式溢出、字体版本失配；渲染成功不是数学正确",
    "3;4",
    "https://github.com/KaTeX/KaTeX/tree/v0.16.28",
  ],
]
for (const [
  name,
  title,
  selection,
  reason,
  compatibility,
  alternative,
  failureMode,
  phase,
  docs,
] of graph) {
  const pkg = packages[name]
  rows.push({
    id: name,
    name: title,
    version: installed[name]?.installed ?? pkg.version,
    registryObservedVersion: pkg.version,
    selection,
    license: installed[name]?.license ?? pkg.license,
    maintenanceEvidence: {
      kind: "Official npm publication timestamp; not a maintenance/support guarantee",
      version: pkg.version,
      date: pkg.publishedAt,
    },
    source: `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    documentation: docs,
    reason,
    compatibility,
    alternative,
    performanceHypothesis:
      name === "katex"
        ? "Static rendering should avoid client cold compilation; actual long-formula/MathML and lazy document checks must be run"
        : "Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here",
    failureMode,
    boundary:
      name === "graphology" || name.startsWith("d3-")
        ? "Pure graph/layout code, browser or Node; never formal execution"
        : "Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority",
    verifyPhase: phase,
    compatibilityStatus: selection.startsWith("RETAIN")
      ? "Existing integration observed; future phase gates NOT_RUN"
      : "NOT_RUN",
  })
}
const report = {
  version: 1,
  observedAt: research.recordedAt,
  selectionDoesNotInstall: true,
  criteria: "P00-03",
  tools: rows,
  limitations: [
    "Current registry version and inspected repository head are recorded separately; neither is automatically a project upgrade",
    "Licensing is package/source metadata observation, not a legal determination; LeanBlueprint distribution metadata mismatch is unresolved",
    "Formal runtime, browser editor and performance compatibility are not executed in Phase0",
    "Three raw GitHub connection failures are retained in official-research.json; alternate official pages/API support the relevant recorded facts",
  ],
}
await fs.writeFile(
  path.join(evidence, "tool-candidates.json"),
  JSON.stringify(report, null, 2) + "\n",
)
let md =
  "# ADR 0002：工具候选、版本与验证边界\n\n状态：保留既有技术栈；Lean与编辑器选型仅为待实测候选。调查于2026-09-10执行，未安装任何候选或新增服务。各版本来自实际官方API、发布登记、固定commit及本地锁；维护证据记录具体日期，不用“活跃/最新版”代替事实。\n\n本轮列出全部要求调查的Lean与图形工具。主体验继续Quartz4.5.2/Preact10.28.2、Three0.185.1、自有2.5D field、KaTeX0.16.28。注册表更高版本不是升级指令。机器可读详情见[tool-candidates.json](../phases/phase-00/evidence/tool-candidates.json)，原始请求摘要及失败见[official-research.json](../phases/phase-00/evidence/official-research.json)。\n\n"
for (const item of rows)
  md += `## ${item.name}\n\n- 版本：\`${item.version}\`；许可证：${item.license}。${item.registryObservedVersion ? `本次registry观察版本：${item.registryObservedVersion}。` : ""}\n- 决策：${item.selection}。${item.reason}\n- 维护证据：${item.maintenanceEvidence.date}；${item.maintenanceEvidence.commit ? `commit \`${item.maintenanceEvidence.commit}\`。` : `发布版本${item.maintenanceEvidence.version}。`} [官方版本/源码](${item.source})、[文档](${item.documentation})。\n- 兼容性：${item.compatibility}\n- 替代方案：${item.alternative}。\n- 性能假设：${item.performanceHypothesis}。\n- 失败模式：${item.failureMode}。\n- 执行边界：${item.boundary}。\n- 验证：Phase ${item.verifyPhase.replaceAll(";", " / ")}，${item.compatibilityStatus}。\n\n`
md +=
  "## 尚未选型的基础设施\n\n数据库与沙箱没有安装/配置，因而没有可诚实填写的部署版本。初期版本化JSON保持源码可审计；数据库仅在正式查询、会话或规模证据要求时考虑。公开实时执行前必须在Phase6选定具体环境并验证隔离/配额/恢复。当前仅有受限本机进程，不能宣称它就是产品的沙箱。测试仍沿用Node/tsx、TypeScript、Prettier、Playwright与静态内容检查；部署沿用Pages，不新增托管服务。\n"
await fs.writeFile(path.join(root, "docs/adr/0002-tool-candidates.md"), md)
console.log(
  JSON.stringify({
    tools: rows.length,
    licensesRecorded: rows.every((x) => Boolean(x.license)),
    phasesRecorded: rows.every((x) => Boolean(x.verifyPhase)),
    installedAnything: false,
  }),
)
