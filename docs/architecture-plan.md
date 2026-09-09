# Phase 0 架构计划

继续使用现有 Quartz 4.5.2、TypeScript 与稳定对象注册表。Phase 0 只记录架构边界和候选，不创建另一套前端、发布引擎或 Lean 服务。各选择的版本、许可证、维护证据、失败模式与验证阶段见 [工具选型记录](adr/0002-tool-candidates.md)。

## 当前可复用的链路

批准的 Markdown 副本经 manifest 校验、Quartz Markdown/HAST 与 KaTeX 生成完整正文。`knowledge/registry.json` 保持原子身份；`knowledge/index.json` 提供对象、出处与关系。`quartz/util/topos/published.ts` 将这些来源适配为知识场数据；纯 `context.ts` 与 `field.ts` 处理相关性与几何；浏览器 `main.ts`、`renderer.ts` 和 DOM 正文处理交互与阅读。本文不是这些既有文件的新实现记录。

已批准的内容和数学证明只维护在写作源；网站持久化的是身份、映射、证据及派生索引，不能另抄一份证明作为第二写作源。书籍顺序属于教学/来源结构，不作为形式依赖或空间布局的真值。

## 后续分层契约

| 层             | 责任与候选工件                                                                                       | 明确不承担的责任                                                    | 首次实际验证                                            |
| -------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- |
| 数学本体       | 在既有稳定 ID 之上定义 Concept/Theory/Statement/Proof 等数据；Phase 1 来源地图与标题注册表。         | 不能从标题或图距离授予正确性。                                      | Phase 1 来源审计；Phase 2 类型与迁移。                  |
| 形式数据       | 独立 Lean 导出项目产生 declaration、type/body/instance dependency、目标/上下文与版本化 Evidence。    | 不能把 imports 当定理实际依赖，不能把 InfoTree 片段直接当完整证明。 | Phase 2 固定环境与至少 20 个声明。                      |
| 证据与对齐存储 | 初期版本化 JSON/JSONL 与明确 ID/哈希的多对多 Alignment，历史不可覆盖；独立形式状态和对齐状态。       | 不把浏览器 localStorage 或缓存作为权威数学证据。                    | Phase 2/5 失效、重复来源和改名/拆并。                   |
| 图查询         | Module/Declaration/Structure/Proof/Semantic/Pedagogy 六图可有共同 ID，但关系语义分开。               | 不由布局或相似推荐推导形式边。                                      | Phase 2 分类，Phase 5/7 跨层查询。                      |
| 布局与渲染     | 复用 Three.js 0.185.1、平静 2.5D、按需帧、DOM 可访问标签/公式、Canvas2D 降级；纯物理状态与本体分开。 | 不执行 Lean，不改变论证状态，不要求所有内容塞进一张图。             | Phase 3 的真实 150/400 场景、连续语境、五级信息与键盘。 |
| 文档呈现       | Quartz HAST 正文 + KaTeX 0.16.28；后续可嵌入静态形式状态与证据片段。                                 | 不用显示数学的 HTML/MathML 代替 Lean 证明。                         | Phase 3/4 真实 source/goal/footnote 保真。              |
| Lean 执行      | Phase 2 先在已授权环境离线导出；Phase 6 才增加隔离会话与实际 LSP/RPC，编辑器为按需独立区域。         | 不在 Pages 内“伪服务端执行”，不把本机账户或凭据暴露给读者。         | Phase 2 构建，Phase 6 沙箱/乱序/配额/服务失败。         |
| 部署           | Pages 托管静态阅读及预计算公开证据，GitHub Actions 校验同版本工件。                                  | 静态托管不承担实时服务；未获明确授权不新建外部服务。                | 每次授权发布核对确切提交；Phase 10 适用放行。           |

暂不引入数据库服务。192 个阅读对象本身不能证明必须使用数据库；Phase 2 的导出规模、Phase 5 的增量维护和 Phase 6 的会话生命周期才是选择索引/SQLite/服务端存储的依据。若引入 SQL，仍保留可导出的版本化证据清单；不把图形库的可变节点属性作为唯一事实存储。

## Lean 与浏览器连接的最小路线

候选基础环境是官方存在的 Lean 4.33.1 与 mathlib v4.33.1。Phase 2 在创建项目时必须将 tag 解析为确切 commit、固定 `lean-toolchain` 和 `lake-manifest.json`，保存环境/源码哈希，并通过完整性与公理依赖政策；本轮没有安装或运行它。Verso、ProofWidgets、doc-gen4 的本次分支快照多跟随 4.34.0-rc2，不能直接拼到 4.33.1 上宣称兼容。

先输出网站自有、可版本迁移的正式数据结构。InfoTree/TacticInfo 是抽取来源；SubVerso 是可评估的高亮/状态辅助，使用其 API 而非依赖未稳定的私有 JSON。现有 Obsidian Markdown 不迁移成 Verso 文档格式。

Phase 6 的浏览器编辑候选为 lean4monaco 与 Infoview；它们需要真实 Lean 通道、资源与生命周期管理。可把 React 仅用于这一独立编辑区域，不重写 Quartz/Preact 全站。lean4monaco 官方当前示例涉及 Vite、VSCode polyfills 与单实例限制，现有 esbuild 打包不能由纸面推断兼容。必须在小切片验证 Worker、资源子路径、重复挂载、断开、取消与响应版本，然后再决定是否采用。

## 证据与发布界线

完整性状态固定为 `UNKNOWN / INCOMPLETE / ELABORATED / CHECKED / FAILED / STALE`；对齐状态为 `UNALIGNED / AI_CANDIDATE / AUTHOR_ALIGNED / HUMAN_REVIEWED / REJECTED / STALE`。CHECKED 依赖可解析的当前形式工件、完整环境、无未闭合义务及允许的公理闭包；不是源文本没有 `sorry` 就通过。记录作者、审阅、候选身份的维度独立，不用单个标签相互覆盖。

所有推理代码、正文、锁文件或映射变化按影响范围使证据失效；几何坐标变化不改变形式状态。静态阅读在执行后端失败时仍可用。未来不可信代码应在独立会话、受限网络、只读依赖、资源配额及短生命周期环境中执行；具体隔离技术当前未定且未配置，Phase 6 安全验收前不能公开执行。
