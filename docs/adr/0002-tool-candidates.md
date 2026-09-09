# ADR 0002：工具候选、版本与验证边界

状态：保留既有技术栈；Lean与编辑器选型仅为待实测候选。调查于2026-09-10执行，未安装任何候选或新增服务。各版本来自实际官方API、发布登记、固定commit及本地锁；维护证据记录具体日期，不用“活跃/最新版”代替事实。

本轮列出全部要求调查的Lean与图形工具。主体验继续Quartz4.5.2/Preact10.28.2、Three0.185.1、自有2.5D field、KaTeX0.16.28。注册表更高版本不是升级指令。机器可读详情见[tool-candidates.json](../phases/phase-00/evidence/tool-candidates.json)，原始请求摘要及失败见[official-research.json](../phases/phase-00/evidence/official-research.json)。

## Lean language server

- 版本：`4.33.1 (stable release candidate for project adoption)`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。复用官方真实诊断与文件快照，不实现假检查器。
- 维护证据：2026-09-09T14:19:38Z；commit `11636539d4150daeabe43cbc5cc5826b06f1e3ce`。 [官方版本/源码](https://github.com/leanprover/lean4/tree/11636539d4150daeabe43cbc5cc5826b06f1e3ce)、[文档](https://github.com/leanprover/lean4/tree/v4.33.1/src/Lean/Server)。
- 兼容性：官方v4.33.1服务器源码已读；同名mathlib toolchain已核对。未安装，不能声称本机或跨版本兼容。
- 替代方案：Phase2离线Lean抽取，Phase6前不接实时服务。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：进程退出/依赖缺失/旧修订响应；LSP进程分离不是安全沙箱。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 6，NOT_RUN。

## Lean RPC

- 版本：`4.33.1 (core API)`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。可查询交互状态/表达式，避免搬运完整Environment。
- 维护证据：2026-09-09T14:19:38Z；commit `11636539d4150daeabe43cbc5cc5826b06f1e3ce`。 [官方版本/源码](https://github.com/leanprover/lean4/tree/11636539d4150daeabe43cbc5cc5826b06f1e3ce)、[文档](https://github.com/leanprover/lean4/blob/v4.33.1/src/Lean/Server/Rpc/Basic.lean)。
- 兼容性：RpcRef依附文件会话和wire format，不能当永久公开ID；需要版本与释放协议。
- 替代方案：持久的离线JSON证据；浏览器只读预计算结果。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：会话重连后引用无效、未释放引用、跨修订误配。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 6，NOT_RUN。

## InfoTree / TacticInfo

- 版本：`4.33.1 (core API)`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。TacticInfo实际含前后metavariable context及goals，适合作为状态抽取来源。
- 维护证据：2026-09-09T14:19:38Z；commit `11636539d4150daeabe43cbc5cc5826b06f1e3ce`。 [官方版本/源码](https://github.com/leanprover/lean4/tree/11636539d4150daeabe43cbc5cc5826b06f1e3ce)、[文档](https://github.com/leanprover/lean4/blob/v4.33.1/src/Lean/Elab/InfoTree/Types.lean)。
- 兼容性：不是现成完整ProofGraph；失败choice、分支、隐式上下文和作用域需要保留。
- 替代方案：SubVerso辅助导出；仅声明级数据不满足步骤验收。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：丢失前提/作用域、只见最终项而丢轨迹、内部API变化。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 7，NOT_RUN。

## Verso

- 版本：`a20c785be9fae260bd53b83a53f75055a49627b9`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。研究带Lean状态的静态文档能力，不替换Obsidian主源。
- 维护证据：2026-08-31T06:35:55Z；commit `a20c785be9fae260bd53b83a53f75055a49627b9`。 [官方版本/源码](https://github.com/leanprover/verso/tree/a20c785be9fae260bd53b83a53f75055a49627b9)、[文档](https://github.com/leanprover/verso)。
- 兼容性：观察快照toolchain为4.34.0-rc2；官方要求按Lean release配套tag，不与4.33.1直接混用。
- 替代方案：Quartz HAST +网站自有正式数据契约。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：重写文档格式、版本不匹配、无意维护两套发布引擎。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 4，NOT_RUN。

## SubVerso

- 版本：`9b90b7f938d6169246325df002351014f49945ef`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选用于高亮、模块抽取、命名代码区间和状态辅助。
- 维护证据：2026-09-04T15:49:04Z；commit `9b90b7f938d6169246325df002351014f49945ef`。 [官方版本/源码](https://github.com/leanprover/subverso/tree/9b90b7f938d6169246325df002351014f49945ef)、[文档](https://github.com/leanprover/subverso)。
- 兼容性：官方说明跨Lean版本测试，但内部序列化无跨SubVerso版本兼容承诺；旧Lean还有module-gap分支要求。
- 替代方案：自有Lean extractor与版本化公开schema。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：依赖私有JSON、抽取格式升级、用说明性高亮冒充验证。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2，NOT_RUN。

## Lean Infoview

- 版本：`0.13.0`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选复用真实目标/消息的交互呈现。
- 维护证据：2026-07-29T08:34:24Z；commit `5a25e6abb2e973b4c89a053acc74c479c0bb2e9f`。 [官方版本/源码](https://github.com/leanprover/vscode-lean4/tree/5a25e6abb2e973b4c89a053acc74c479c0bb2e9f)、[文档](https://github.com/leanprover/vscode-lean4/tree/5a25e6abb2e973b4c89a053acc74c479c0bb2e9f/lean4-infoview)。
- 兼容性：npm版本0.13.0与扩展v0.0.239不是同一版本号；不能按名称假定所有RPC版本兼容。
- 替代方案：网站自有只读状态面；必要时独立编辑区域。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：RPC会话丢失、DOM/样式冲突、静态地址资源缺失。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 6，NOT_RUN。

## lean4monaco

- 版本：`1.1.16`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选浏览器编辑与Infoview连接层。
- 维护证据：2026-08-21T20:55:02Z；commit `f1828e854f85fc5f958cc3018ce4155af3e3f755`。 [官方版本/源码](https://github.com/hhu-adam/lean4monaco/tree/f1828e854f85fc5f958cc3018ce4155af3e3f755)、[文档](https://github.com/hhu-adam/lean4monaco)。
- 兼容性：官方要求单LeanMonaco实例、start生命周期和WS连接；Vite/polyfills示例不自动适配当前esbuild。
- 替代方案：独立按需editor island，或保留静态阅读与外部Lean工作流。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：重复挂载、Worker路径、polyfill体积、断开后旧结果覆盖。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 6，NOT_RUN。

## lean4web

- 版本：`0.2.2; inspected commit 27e95901718055152e6d5468e251ca34c13d0b4a`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选参考真实前后端连接与项目管理，不直接部署。
- 维护证据：2026-08-30T12:53:27Z；commit `27e95901718055152e6d5468e251ca34c13d0b4a`。 [官方版本/源码](https://github.com/leanprover-community/lean4web/tree/27e95901718055152e6d5468e251ca34c13d0b4a)、[文档](https://github.com/leanprover-community/lean4web)。
- 兼容性：官方为server-side Lean、小型片段用途；不是纯浏览器/Pages运行时。
- 替代方案：自有最小LSP网关 + Phase6独立沙箱；静态预计算阅读。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：公开执行无资源隔离、会话串读、托管服务成本。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 6，NOT_RUN。

## ProofWidgets4

- 版本：`0.0.110`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选显示领域特定对象/目标，不将可视化当真值。
- 维护证据：2026-08-21T12:03:02Z；commit `a8acbfd87375ff4abe14ce09db5b7664d383bc7f`。 [官方版本/源码](https://github.com/leanprover-community/ProofWidgets4/tree/a8acbfd87375ff4abe14ce09db5b7664d383bc7f)、[文档](https://github.com/leanprover-community/ProofWidgets4)。
- 兼容性：观察release/head toolchain 4.34.0-rc2；要按Lean匹配release。预构建JS不保证用户自定义widget免构建。
- 替代方案：DOM/KaTeX的只读状态视图。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：不可信widget脚本、版本失配、界面组件不能提供证明证据。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 6 / 7，NOT_RUN。

## LeanBlueprint

- 版本：`0.0.20; inspected commit 56e066d30fb7b608a63f4241fee80982d7eae3ef`；许可证：Apache-2.0 in inspected repository LICENSE; PyPI 0.0.20 classifier says MIT (unresolved distribution metadata mismatch)。
- 决策：CANDIDATE_NOT_INSTALLED。候选借鉴论证计划/声明关联，可作为对照而非第二写作引擎。
- 维护证据：2025-12-23T15:55:53Z；commit `56e066d30fb7b608a63f4241fee80982d7eae3ef`。 [官方版本/源码](https://github.com/PatrickMassot/leanblueprint/tree/56e066d30fb7b608a63f4241fee80982d7eae3ef)、[文档](https://github.com/PatrickMassot/leanblueprint)。
- 兼容性：Python/plasTeX/Graphviz依赖；checkdecls验证声明存在，不证明作者步骤对齐。PyPI标MIT而该commit LICENSE是Apache-2.0，采用前须核验发行包许可。
- 替代方案：Quartz Markdown +自有Alignment/Evidence。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：许可证元数据冲突、Windows原生Graphviz依赖、leanok仅标注被误当实检。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 5，NOT_RUN。

## mathlib4 / cache tooling

- 版本：`v4.33.1 (proposed project pin); inspected head e37d88a26f3791ed5a93daa1f949af1021b8d103`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。首批声明、定理与实例来源，复用正式库及其锁定依赖和缓存工具。
- 维护证据：2026-09-09T16:59:49Z；commit `e37d88a26f3791ed5a93daa1f949af1021b8d103`。 [官方版本/源码](https://github.com/leanprover-community/mathlib4/tree/e37d88a26f3791ed5a93daa1f949af1021b8d103)、[文档](https://github.com/leanprover-community/mathlib4/blob/v4.33.1/lean-toolchain)。
- 兼容性：已读同名tag toolchain=4.33.1；head当前4.34rc2。Phase2必须解析实际commit并固定Lake锁。缓存存在不等于当前源码重检。
- 替代方案：Lean core的受控小样例先验证导出器，再加入mathlib。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：缓存/源版本不符、传递公理未核查、冷构建资源不足。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2 / 4，NOT_RUN。

## doc-gen4

- 版本：`97d4ecdfc8e09e7f511724c25e303d448de6a3db`；许可证：Apache-2.0。
- 决策：CANDIDATE_NOT_INSTALLED。候选声明文档/源码链接参考，不作为proofstate或对齐替代。
- 维护证据：2026-08-21T13:12:10Z；commit `97d4ecdfc8e09e7f511724c25e303d448de6a3db`。 [官方版本/源码](https://github.com/leanprover/doc-gen4/tree/97d4ecdfc8e09e7f511724c25e303d448de6a3db)、[文档](https://github.com/leanprover/doc-gen4)。
- 兼容性：当前toolchain=4.34.0-rc2；官方要求release对应branch。
- 替代方案：自有声明JSON与Quartz证据组件。
- 性能假设：No runtime performance measured in Phase0; verify bounded extraction in Phase2, or the fixed 60×5 warm edit corpus in Phase6 as applicable。
- 失败模式：toolchain不匹配、链接映射失效、文档元数据被当证明结构。
- 执行边界：Lean/compiler extraction runs in a controlled build process; browser receives versioned static data or a separately isolated Phase6 session。
- 验证：Phase 2，NOT_RUN。

## PixiJS

- 版本：`8.15.0`；许可证：MIT。本次registry观察版本：8.20.1。
- 决策：CONSIDERED_NOT_SELECTED。已安装8.15.0源于既有依赖；不为审计替换现有Three。候选提供WebGL/WebGPU场景。
- 维护证据：2026-08-26T15:11:35.469Z；发布版本8.20.1。 [官方版本/源码](https://registry.npmjs.org/pixi.js)、[文档](https://pixijs.com/8.x/guides/concepts/architecture)。
- 兼容性：官方v8文档；现装与注册表版本不同。数学DOM/焦点/键盘仍需单独实现。
- 替代方案：Three.js0.185.1 + DOM。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：纹理文字不可选、无意义ticker常驻、迁移增加两套渲染维护。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3，NOT_RUN。

## Sigma.js

- 版本：`3.0.3`；许可证：MIT。本次registry观察版本：3.0.3。
- 决策：CONSIDERED_NOT_INSTALLED。大规模图渲染候选，只有固定负载测量显示需要时考虑。
- 维护证据：2026-04-30T13:04:02.520Z；发布版本3.0.3。 [官方版本/源码](https://registry.npmjs.org/sigma)、[文档](https://www.sigmajs.org/docs/)。
- 兼容性：官方stable文档3.x；4为alpha。以Graphology为数据后端，不能直接替换当前typed relation与2.5D阅读。
- 替代方案：既有Three renderer。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：label/卡片尺寸自定义成本、图数据与正式证据误耦合。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3 / 10，NOT_RUN。

## Graphology

- 版本：`0.26.0`；许可证：MIT。本次registry观察版本：0.26.0。
- 决策：CONSIDERED_NOT_INSTALLED。多重/混合图与算法候选，六种关系图需要typed edge identity。
- 维护证据：2025-01-26T10:25:05.589Z；发布版本0.26.0。 [官方版本/源码](https://registry.npmjs.org/graphology)、[文档](https://graphology.github.io/)。
- 兼容性：peer graphology-types>=0.24；并行边可以保留多来源。标准库整包可能滞后。
- 替代方案：现有typed JSON+Map邻接索引。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：可变属性覆盖来源、混合图方向含义丢失、打入整个算法库。
- 执行边界：Pure graph/layout code, browser or Node; never formal execution。
- 验证：Phase 2 / 3 / 10，NOT_RUN。

## D3 force

- 版本：`3.0.0`；许可证：ISC。本次registry观察版本：3.0.0。
- 决策：AVAILABLE_ALTERNATIVE。既有D37.9中含force3.0.0；碰撞/力布局替代选项。
- 维护证据：2021-06-05T19:11:01.836Z；发布版本3.0.0。 [官方版本/源码](https://registry.npmjs.org/d3-force)、[文档](https://d3js.org/d3-force)。
- 兼容性：无DOM依赖，可手动tick；会修改节点，必须与不可变ontology分离。
- 替代方案：当前Topos自有有阻尼field。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：无限tick、对语义关系一视同仁、布局对象反向改数学状态。
- 执行边界：Pure graph/layout code, browser or Node; never formal execution。
- 验证：Phase 3，NOT_RUN。

## D3 force 3D

- 版本：`3.0.6`；许可证：MIT。本次registry观察版本：3.0.6。
- 决策：RETAIN_EXISTING_LEGACY。旧3D图已用3.0.6；主体验仍为自有2.5D field，不另重写。
- 维护证据：2025-04-09T19:05:37.836Z；发布版本3.0.6。 [官方版本/源码](https://registry.npmjs.org/d3-force-3d)、[文档](https://github.com/vasturiano/d3-force-3d)。
- 兼容性：现装/锁定/官方registry均3.0.6；二维三维布局接口不等于语义推理。
- 替代方案：现有Topos field。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：模型与速度混放、过密吸引、三维遮挡影响读者。
- 执行边界：Pure graph/layout code, browser or Node; never formal execution。
- 验证：Phase 3，Existing integration observed; future phase gates NOT_RUN。

## Three.js

- 版本：`0.185.1`；许可证：MIT。本次registry观察版本：0.186.0。
- 决策：RETAIN_CURRENT。保留已实现的正交GPU世界、按需帧与Canvas2D降级。
- 维护证据：2026-09-08T19:25:22.027Z；发布版本0.186.0。 [官方版本/源码](https://registry.npmjs.org/three)、[文档](https://github.com/mrdoob/three.js/tree/r185)。
- 兼容性：使用0.185.1；registry已0.186.0，本轮不升级。2.5D用DOM阅读而非贴图数学。
- 替代方案：Pixi8或Sigma3，经固定场景比较后决定。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：WebGL初始化/丢上下文、DOM标签碰撞、资源泄漏。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3 / 10，Existing integration observed; future phase gates NOT_RUN。

## Preact

- 版本：`10.28.2`；许可证：MIT。本次registry观察版本：10.29.8。
- 决策：RETAIN_CURRENT。Quartz现有组件10.28.2沿用。
- 维护证据：2026-08-01T09:59:54.572Z；发布版本10.29.8。 [官方版本/源码](https://registry.npmjs.org/preact)、[文档](https://preactjs.com/guide/v10/getting-started/)。
- 兼容性：不把React兼容模式当Infoview实际兼容证据。
- 替代方案：独立React editor island；不重写全站。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：双框架渲染所有权冲突、重复事件/历史管理。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3 / 6，Existing integration observed; future phase gates NOT_RUN。

## React

- 版本：`19.3.0`；许可证：MIT。本次registry观察版本：19.3.0。
- 决策：CONSIDERED_NOT_INSTALLED。只在后续编辑库确需时用于独立按需区域。
- 维护证据：2026-09-09T17:21:30.071Z；发布版本19.3.0。 [官方版本/源码](https://registry.npmjs.org/react)、[文档](https://react.dev/learn/add-react-to-an-existing-project)。
- 兼容性：观察registry19.3.0；实际Infoview/Monaco版本与peer链需Phase6测，不默认追新。
- 替代方案：现有Preact和DOM；静态证据无需React。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：体积与hydration开销、共享DOM生命周期冲突。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 6，NOT_RUN。

## Motion

- 版本：`13.2.0`；许可证：MIT。本次registry观察版本：13.2.0。
- 决策：CONSIDERED_NOT_INSTALLED。有限UI过渡的可选工具；当前物理与CSS已可复用，无新增必要。
- 维护证据：2026-09-02T15:25:47.792Z；发布版本13.2.0。 [官方版本/源码](https://registry.npmjs.org/motion)、[文档](https://motion.dev/docs)。
- 兼容性：13.2.0有JS/React等API，React peers为18/19；不是布局本体引擎。
- 替代方案：现有有限RAF/CSS/WAAPI。
- 性能假设：Fixed 150 visible nodes/400 relationships: median>=45FPS and all focus transitions settle<=1.2s; no result is claimed here。
- 失败模式：装饰动画替代语义变化、reduced-motion未覆盖、两个RAF循环。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3，NOT_RUN。

## KaTeX

- 版本：`0.16.28`；许可证：MIT。本次registry观察版本：0.18.7。
- 决策：RETAIN_CURRENT。保留0.16.28真实Markdown的HTML+MathML和同版字体。
- 维护证据：2026-09-06T17:47:14.402Z；发布版本0.18.7。 [官方版本/源码](https://registry.npmjs.org/katex)、[文档](https://github.com/KaTeX/KaTeX/tree/v0.16.28)。
- 兼容性：registry0.18.7不直接套配置；现有0.16.28类型/源码和渲染检查是当前依据。
- 替代方案：MathJax（若出现明确不兼容再研究）。
- 性能假设：Static rendering should avoid client cold compilation; actual long-formula/MathML and lazy document checks must be run。
- 失败模式：宏/信任策略、长式溢出、字体版本失配；渲染成功不是数学正确。
- 执行边界：Browser renderer/DOM; KaTeX may also render during static build; no Lean verification authority。
- 验证：Phase 3 / 4，Existing integration observed; future phase gates NOT_RUN。

## 尚未选型的基础设施

数据库与沙箱没有安装/配置，因而没有可诚实填写的部署版本。初期版本化JSON保持源码可审计；数据库仅在正式查询、会话或规模证据要求时考虑。公开实时执行前必须在Phase6选定具体环境并验证隔离/配额/恢复。当前仅有受限本机进程，不能宣称它就是产品的沙箱。测试仍沿用Node/tsx、TypeScript、Prettier、Playwright与静态内容检查；部署沿用Pages，不新增托管服务。
