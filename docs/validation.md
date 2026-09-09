# 网站验收记录

## 原有公开笔记接入连续知识场（2026-09-10）

首页与 `topos.html` 现在从现有公开 KnowledgeIndex 生成实际知识场：119 个原子、73 篇完整数学笔记，保留全部 605 条关系的端点、方向、类型与依据。25 篇没有登记原子的笔记仍以完整正文进入搜索和阅读。书籍与章节用于来源追溯，空间分组没有使用书籍目录作为输入。旧书架与完整首页说明移到 `library.html`；独立的合成演示保留在 `topos-demo.html`，不进入实际笔记的默认模型。

本轮没有重新扫描或导出私人库，没有拆分、移动、改写原数学笔记。178 个批准页面和 1 幅 SVG 的副本哈希全部通过核对；公开清单 SHA-256 仍为 `3529deb78e8d950d91d65ce58e72827056df9f5de2fb6b59a17f26d5d5145684`。本地写作约定、五种现有模板、模板总文档及对应协作入口作了增量调整，并记录实际日志，共九个本地文件；备份、并发修改保护、模板变量和排除边界检查 50 项通过。它们仍是本地规约，不随网站工程上传；没有运行 Obsidian 原生模板插入验收。

原子与完整笔记复用正式 HAST、Quartz 嵌入和同版本 KaTeX，包含实际前提与相邻论证。独立产物检查将每个对象与原来的正式页面逐一比对：6,563 处公式按序一致，2,207 段正文保持文本和顺序，来源、维护阶段、证明状态、多处出现位置及局部链接保留。此处计数包含同一数学内容在原子和完整笔记中的不同阅读位置，不表示新增了这些数学结论。

306 个正文／上下文资源使用内容哈希文件名并按需加载；初始模型为 1,392,333 bytes，未打包全部约 11 MB 的数学 HTML。入口为模型、脚本和样式附上实际内容 SHA-256 版本，避免更新后与旧演示缓存混用。加载失败可重试或直接打开正式原页；旧模型缓存缺失节点时重新建立场，保留合法的阅读焦点。

最终工程检查：TypeScript 与适用 Prettier 检查通过；210 项单元、4 项上游兼容检查通过。正式 npm 构建处理 178 个批准输入、生成 900 个产物；内容与链接检查 65,344 通过、0 失败，原子完整性检查 6,411 通过、0 失败。没有为通过检查放宽发布文件白名单。保留演示的原位链接、递归内容唯一性、复制地址刷新及原生新标签行为另有 4 项短浏览器回归通过。

浏览器检查以实际度量定义、连续性定理、完整原文及证明对象为路径，在 1440×1000、1024×900、390×844 下运行。过程中实际修复了来源锚点编码与冷加载定位、长正文目录、重复原始 LaTeX 摘要、放不下的邻域文字遮挡标题、故障提示位置和非活动面板污染滚动缓存。测试本身也修正了错误的英文目标和在平滑滚动结束前读取位置的时序问题；修复前报告保留，没有把失败计入通过。

完整阅读脚本最终 80 项通过、0 失败；返回／刷新位置和标题避让的独立定向复验 13 项通过。Edge 的 WebGL 禁用与真实上下文丢失功能检查 31 项通过；修正手机故障提示后，受影响场景再跑 19 项通过。三视口截图和实际 53.68 秒阅读录像的关键帧均已打开查看。最后搜索摘要显示改用实际原文段落，评分和完整索引未变，单独复验结果随交付记录保存，旧 80 项结果未回填或覆盖。

真实长公式另有 16 项通过：390px 页面内，`a-000010` 的 795px 公式在 325px 容器中可从键盘和模拟触摸滚动，初始左端及最大滚动位置的右端均可达；页面和正文不跟随横移。同文没有上下标，因此另读 `a-000092` 的真实 Taylor 公式，检查求和上下限、上标、下标和分式的字形范围位于容器内。

实际测试产物保存在忽略目录 `artifacts/`：`topos-published-first/`、`topos-published-final/`、`topos-published-accepted/`、`topos-published-regressions/`、`topos-fallback-review/status-polish/`、`topos-long-formula/`，以及本地规约的 `writing-contract-20260910/`。部署证据在交付时另行记录。当前真实笔记没有脚注引用，脚注迁移由 Markdown／HAST 夹具测试覆盖；没有声称在真实笔记中完成脚注点击测试。实体手机、Safari、Firefox、屏幕阅读器、GPU 上下文恢复和浏览器性能评分未运行；本轮也没有下载或重新计算语义模型。

## Knowledge Topos 纵向原型（2026-09-10）

本轮按新的 Knowledge Topos 规格先建立 `/World/topos.html`，完成 Group → Group Action → Representation 的连续语境转换。原型数据为网站专用的 22 个合成概念、40 条带类型与依据的关系、67 段 Markdown、222 处公式；不是重新导出的私人教材。既有 178 个原页面、119 个原子页继续保留，公开清单 SHA-256 仍为 `3529deb78e8d950d91d65ce58e72827056df9f5de2fb6b59a17f26d5d5145684`。

知识模型、语境推导、力学、GPU/Canvas2D 渲染和 Markdown 内容各自独立。每次语境改变保留节点对象与速度；图关系计算局部聚合，远景降低次要节点的信息量，近景在同一场中展开数学内容。群落轮廓的视觉重叠不表示数学集合包含；物理参数和观察方式权重也不声称是数学依赖的测量值。

实际工程检查：TypeScript、适用格式检查通过；200 项单元测试通过，0 失败、0 跳过；4 项上游兼容检查通过；完整 npm 构建处理 178 个既有输入，生成 591 个产物。正式产物内容检查 57,174 通过、0 失败，包含 67 段原型公式与输出 MathML 按序一致、实际内部目标、清单边界及既有本地链接；原子完整性检查 6,411 通过、0 失败。

浏览器采用现有 Edge，在 1440×1000、1024×900、390×844 下录制有文字与去文字的真实操作，原始 WebM、逐时刻世界坐标及视频抽帧保存在忽略目录 `artifacts/`。逐项验收与失败修复记录见 [Topos 验收](topos-acceptance.md)，不将机器数值或录屏文件存在本身当作艺术方向已被用户认可，也不沿用旧三维图的通过数。

首次推送 `6c4a885` 的 [Actions 运行](https://github.com/MyDearATRI/World/actions/runs/34382339732) 在单元测试阶段得到 199 通过、1 失败，构建与部署未执行。失败来自同步路径检查使用宿主平台的 `path.isAbsolute`：Linux 不把 `C:/Users/Someone/private.md` 识别为 Windows 绝对路径，而现有保护测试要求两种平台都拒绝它。修复同时检查 POSIX、Windows 绝对路径，并拒绝盘符相对路径与反斜杠，不放宽发布白名单或删除失败断言。新增跨平台回归后，本机完整测试 201 通过、0 失败，定向同步测试 15 通过；该次失败日志保存在 `artifacts/topos-first-ci-failure.txt`。后续部署与线上复验另按最终提交记录。

发现并修复的具体问题包括：远景只是同图缩放、社区轮廓被弱相关的远处成员撑大、手机关系短语压住标题、解释文字消失时连空间边界也一并隐藏、递归内联链接和复制地址产生重复段落。首轮不完整检查、修复前的有字碰撞结果和深链失败报告均保留，后续定向复验单独记录。

本轮没有运行全库重新导出、浏览器语义模型下载或推理，也没有进行实体手机、Safari、屏幕阅读器或性能评分测试。旧教材系统仍为现有正式阅读入口，完整知识库接入 Topos 不属于这个纵向原型。代码和合成内容已逐项加入同步白名单，缓存、视频和模型权重不进入仓库。部署状态以本次精确提交的 GitHub Actions 与线上实际复查为准。

## 树状三维知识空间（2026-09-09）

继续使用原公开快照：178 个原页面、1 幅 SVG、119 个原子、123 个出现位置、73 篇完整数学笔记。发布清单 SHA-256 仍为 `3529deb78e8d950d91d65ce58e72827056df9f5de2fb6b59a17f26d5d5145684`，没有读取或重新导出私人 Vault，正文和附件副本未修改。三维适配层有 199 个唯一空间实体；29 个原子保留多节归属，3.7 保留研读入口，三个无节归属原子留在章级入口。

实际查明此前 Actions 运行 `34253091418` 的失败来自原子准备顺序：默认 `localeCompare` 使中文 Windows 和英文 Linux 生成不同注册表顺序。已用英文默认排序注入复现同一错误，改为与系统语言无关的固定排序，并新增跨语言检查。注册表 ID 完全相同；知识对象仅四处出现位置数组的顺序改变，正文、公式、出处集合、源快照和推荐向量内容不变。

地图现按书、章、节逐层展开。章层先显示八个小节骨架，进入小节才展开原子。真实 Three.js 0.185.1 与 d3-force-3d 3.0.6 提供三维镜头、排斥、强原文关联／弱相似关联、碰撞与阻尼。集合标签采用引线排布；地图稳定、隐藏或被阅读面遮挡后停止绘制。新 `同步到GitHub.cmd` 只同步明确审阅的网站工程，不运行笔记导出，输入 `SYNC` 后普通推送。

| 已实际执行 | 结果                                                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 类型与格式 | TypeScript 和全项目适用 Prettier 检查通过。                                                                                                                                  |
| 单元测试   | 166 通过、0 失败、0 跳过；包括六项场景／真实三维力模拟、跨语言生成检查及十一项隔离 Git 同步测试。                                                                            |
| 上游兼容   | 4 项通过。                                                                                                                                                                   |
| 正式构建   | 178 个批准输入，586 个产物；最终修复经过完整 prebuild 和正式构建，退出码 0。                                                                                                 |
| 全量内容   | 56,962 通过、0 失败；3,632 处公式、12,723 个本地链接和 77 份原引用数据；三维静态资源逐项白名单。                                                                             |
| 原子完整性 | 6,411 通过、0 失败；119 原子页及静态兼容链接。                                                                                                                               |
| 阅读浏览器 | 最终本地 Edge 150 通过、0 失败，覆盖三个宽度的阅读、搜索、跨章顺序、前后退、焦点、键盘预览和公式。                                                                           |
| 三维浏览器 | 最终本地 Edge 106 通过、0 失败、0 页面错误，20 张实际截图；覆盖真实 WebGL2、三维拖动／引力与冷却、全部小节标签、刷新后返回焦点、全屏镜头、真实关系出处、慢网独立搜索及降级。 |

实际失败及修复保留记录：初次三维产物未列入内容校验白名单，补齐三个固定资源后通过；旧浏览器脚本选到手机隐藏标签，改用可见操作入口；390px 键盘预览受延迟触摸 pointerout 干扰，改为以焦点维护预览后完整阅读验收通过。独立审查另发现地图重建后旧焦点元素失效、图下载阻塞普通搜索，已按稳定 ID 恢复焦点并独立加载可选资源。最终补测还修复了刷新原子后返回时缺少探索页真实 HTML、手机全屏打开重置保存镜头，以及已关闭视图菜单仍遮挡画布；统一重跑后通过。

本轮没有重新测试可选模型的首次下载和推理；其公开向量、内容哈希及固定模型清单检查通过。实体手机、Safari、屏幕阅读器、原生浏览器 200% 缩放和 FPS 评分未测；放大检查使用 720 CSS px 重排与实际文本字号翻倍。现有公开内容没有脚注／边注，源管道单元夹具继续覆盖它们，未声称本轮在真实文章中点测。npm audit 仍报告既有 Transformers.js 3.8.1 嵌套 sharp 的两个 high 项（图像处理依赖）；本次未升级用户指定模型栈，Three.js 与 d3-force-3d 未出现在该报告中。

本地证据位于 `artifacts/three-local-report.json`、`artifacts/spatial-local-report.json`、`artifacts/content-report.json` 和 `artifacts/screenshots/three-local-*.png`。线上部署需在本次提交推送后按精确 SHA 检查；后续实际部署与在线验证记录保存在本机 `artifacts/three-delivery.md`，不把本地通过当作线上已更新。

## 数学知识空间（2026-09-09）

本轮采用既有公开快照，没有重新导出或改写 Vault。清单 SHA-256 仍为 `3529deb78e8d950d91d65ce58e72827056df9f5de2fb6b59a17f26d5d5145684`；178 个原页面包括 172 篇 Markdown 与 6 个 Canvas，另有 1 幅 SVG。工作期间其他进程新增了 17 个带 `(1)` 的未托管副本，未修改或删除它们，也未纳入发布。原子准备和 Quartz 解析现在严格使用清单白名单；只读验证仍核验每个批准文件的哈希。导出和日常发布入口继续默认拒绝未托管文件。

最终登记 119 个原子、123 个原文出现位置、73 篇完整数学笔记及 605 条带出处的关系。四组已核对的摘要／详述重复出现共享身份，原来四个 ID 有真实静态兼容页。统一索引为 192 个对象；25 篇完整笔记尚无独立登记原子，保留完整阅读并列入诊断。定义组不擅自拆分，观察和问题不升级为定理，证明状态沿用原文。

首页提供按书阅读与探索入口。阅读空间保留来源、书章位置、探索来路与独立地址；后退、前进、刷新和关闭恢复滚动、焦点及展开状态。章节地图逐层展开到原子，近景显示原文摘录与公式，布局按稳定 ID 保存，拖动不会打开正文。路径区分原文明示关系、结构引用和明确标注的模型推荐。320ms 阅读定位和 240ms 镜头过渡结束后停止，减少动画模式直接完成。

| 已执行检查           | 实际结果                                                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`      | TypeScript 与全项目适用格式检查通过。                                                                                                          |
| `npm test`           | 148 通过，0 失败、0 跳过；包括来源提取、稳定 ID、冲突、关系路径、检索、脚注迁移、导出边界和发布保护。                                          |
| 上游兼容             | 4 项通过。                                                                                                                                     |
| 正式构建             | 178 个批准输入，583 个产物，退出码 0；明确忽略 17 个未托管副本。                                                                               |
| 全量内容             | 55,568 通过，0 失败；178 原页、3,632 处公式、12,026 个本地链接及 77 份既有图谱数据。                                                           |
| 原子完整性           | 6,411 通过，0 失败；119 原子页、4 兼容页、原文定位、数学和部署子路径。                                                                         |
| 原有教材浏览器回归   | 300 通过，0 失败；三个尺寸与根路径、`/World/`、`/math-notes/`，包括真实长公式的键盘局部滚动、字体、目录、嵌入、表格、插图和 Canvas。           |
| 知识空间真实阅读任务 | 150 通过，0 失败；书架到 1.2、`1.8 → 2.1`、`2.8 → 3.1`、原子／笔记多层切换、焦点与滚动、原生新标签、预览、标题锚点、缩放重排及正常／减少动画。 |
| 关系图独立浏览器夹具 | 56 通过，0 失败；分组标签、数学预览、拖动、镜头、路径依据、手机全屏及模拟触摸。此项是独立组件夹具，不冒充线上验收。                            |
| 语义索引             | 192 对象的 ID、内容哈希、384 维归一化向量、模型清单和推荐范围全部校验通过；最终增量运行全部复用缓存，0 次重新推理。                            |
| 可选浏览器模型       | Edge 实际 WASM 推理与真实界面 25 通过，0 失败：默认不下载、显式启用、进度、中文查询、缓存复用、取消、下载失败回退、本站缓存隔离与查询不出网。  |

本机实际下载并核验了 multilingual-e5-small q8 的 5 个文件，总计 135,392,183 字节；固定修订和各文件 SHA-256 在 `knowledge/model-manifest.json`。CPU 与浏览器 WASM 均执行过真实推理。浏览器下载测试用这些已核验的公开模型字节通过本地流式 HTTP 夹具重放，未重新联网下载 135 MB；该测试不是公网下载速度或可用性的保证。最初通过 CDP 一次传递大模型的测试方法导致测试目标关闭，改为流式夹具后通过，生产 Worker 无需修改。

实际视口为 1440×1000、1024×900、390×844。截图在 `artifacts/screenshots/spatial-local-*.png` 和 `artifacts/knowledge-graph-fixture/`，报告为 `spatial-local-report.json`、`browser-report.json`、`knowledge-graph-report.json`、`semantic-browser-report.json`、`knowledge-report.json` 和 `content-report.json`。已打开检查桌面／手机阅读、地图、检索和预览。早期截图发现的标题横向挤压、来源链接连在一起、章节标签过小、预览只显示孤立字母，均已修改并重验。后续手机键盘预览截图发现横向越界，已补齐双轴边界约束；地图视角改为操作后立即保存，避免 Edge 在刷新时丢失 pagehide 内较晚写入的状态。

当前生产快照没有脚注和边注；它们在本轮通过实际合成 Markdown→GFM→HAST→KaTeX 与边注 HAST 测试验证，不记为生产笔记的浏览器覆盖。修复了末节片段已含脚注区时的重复追加。旧阅读浏览器脚本最初等待无扩展名地址而超时，改为同时认可真实 `.html` 规范地址后，最终 300 项通过。

未测试实体手机、Safari、屏幕阅读器或帧率。720 CSS 像素重排与两倍计算字号分别测试，不能称为浏览器原生缩放；触摸使用 Chromium CDP 模拟。25 篇未登记原子的完整笔记以及未标记的普通数学段落仍可全文阅读。未将相似推荐说成数学等价或作者论证。日常导出／发布入口本轮没有运行真实 Vault 导出；其保护由夹具测试覆盖。网站代码按本任务的既有授权单独提交并普通推送，确切提交、Actions 及线上复查结果写入本地 `artifacts/knowledge-delivery.md`，不得引用历史部署作为本次结果。

## 视觉层级与交互动效（2026-09-07）

本轮依据用户要求参考苹果的排版层级与操作反馈，继续保持 Quartz 4.5.2 和既有阅读路径。页面采用浅灰背景、近白阅读面与克制的蓝色；主标题使用 700 字重无衬线，章节和语义块标题使用 650 字重，正文保留 18px / 1.85 衬线。语义块的类型与原题名分别显示，原始标签、ID、正文和证明状态保留。只有正文开头明确带“来源：”或“Source:”的段落会获得辅助排版，不通过作者名、年份或 PDF 关键词猜测正文身份。

`interfaceMotion.inline.ts` 为原生 details 添加可中断的 180ms 展开过渡，并给阅读、搜索和图谱 dialog 提供 180ms 入场反馈；不延后关闭、焦点或历史变化。书页区域选中态随阅读位置更新，仍使用普通锚点。按钮与入口有短暂的颜色、阴影和微小位移反馈。启用系统减少动态效果时关闭位移反馈；不支持原生 details 过渡的浏览器保留即时操作。没有持续循环或滚动劫持。

本轮没有导出源 Vault，`content/` 与 `publish-manifest.json` 相对 `ab13d84` 无改动。修改限于网站 UI、语义展示、交互和验证脚本。

| 已执行检查                  | 真实结果                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript / 全项目适用格式 | `npm run check` 通过。                                                                                                                                                                      |
| 单元                        | `npm test`：117 通过、0 失败、0 跳过，包括 5 组新语义展示与来源边界测试。                                                                                                                   |
| 上游兼容                    | 4 项通过。                                                                                                                                                                                  |
| 正式构建                    | 178 输入、450 产物，退出码 0。                                                                                                                                                              |
| 全量内容                    | 54,250 项通过、0 失败；178 页、3,632 处数学、11,367 个本地链接、77 份图谱数据集。                                                                                                           |
| 正文浏览器回归              | 300 项通过、0 失败；根路径、`/World/`、`/math-notes/`、三视口及字号放大/重排。                                                                                                              |
| 新 UI / 动效专项            | 139 项通过、0 失败；三视口的真实字号与字重、按钮 hover/pressed、details 快速切换、dialog 入场与焦点、Ctrl 开页、正常模式实际 180ms 动画记录、减少动画模式无几何动画及原生展开过渡时长为零。 |
| 搜索回归                    | 144 项通过、0 失败，包括非空查询下一次 Escape 关闭、焦点返回且不误清查询。                                                                                                                  |
| 知识面板回归                | 136 项通过、0 失败，包括 details 的 open 立即更新、展开内容及时可见，以及原有完整正文、历史、焦点、滚动位置和独立开页。                                                                     |

初次专项测试发现非空 `type=search` 输入会吞掉第一次 Escape，用于清空搜索而非关闭 dialog；已改为在输入键盘处理器中使用原有关闭路径，并验证焦点返回。原失败报告保留为 `artifacts/interface-first-attempt.json`。阅读测试曾将 details 展开后的同步可见性当成即时状态；已分别验证 open 立即改变以及内容在 500ms 上限内可见，保持原生可访问状态，不让动画推迟操作。

本轮截图使用 `interface-{home,book,reading,panel,search,graph}-{1440,1024,390}.png`，共 18 张；机器报告 `artifacts/interface-report.json`。已实际打开检查。发布后的精确提交、Actions 状态和独立线上报告记录在 `artifacts/interface-delivery-report.md`。前轮线上结果不作为本轮结果。

未测试实体手机、Safari、屏幕阅读器或帧率；字号放大与 720px 重排不是浏览器原生缩放。当前生产快照没有脚注和边注，本轮未重建历史合成夹具。未添加依赖、后台同步或改动写作方式。

## 以书籍和知识点为中心的阅读导航（2026-09-07）

本轮只调整网站展示、共享阅读模型和浏览器交互。没有读取或重新导出源 Vault；`content/` 与 `publish-manifest.json` 相对已发布提交 `35b55f7` 无变化，清单 SHA-256 为 `3529deb78e8d950d91d65ce58e72827056df9f5de2fb6b59a17f26d5d5145684`。生产内容继续是 172 篇源笔记、6 个 Canvas 网页和 1 幅 SVG。

首页为书架，实际包含 Simon 一本书；统一模型提供前三章、24 节连续阅读和 38 篇知识页。24 节按原目录顺序连接，五项补充关联在网站配置中声明。原首页、书页和章页 Markdown 完整保留于可展开的来源说明。数学例子、习题和发现归档没有按 `example` 关键词排除。规划和明确的附属页面仍可单独访问并主动纳入搜索。

本机沿用 Node 24.19.0、隔离 npm 10.9.2、Quartz 4.5.2、Playwright 1.62.1、Edge 152.0.4191.66。以下 npm 命令均通过 `pnpm --package=npm@10.9.2 dlx npm` 调用。

### 本轮实际执行的工程检查

| 检查                    | 真实结果                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`         | TypeScript 和全项目适用格式检查通过。                                                                                                                         |
| `npm test`              | 112 通过，0 失败、0 跳过。覆盖共享目录、多节关联、新内容诊断、精确附属边界、搜索、图谱与混排标题换行，以及既有导出、嵌入和发布保护。                          |
| `npm run test:upstream` | 4 项通过。                                                                                                                                                    |
| `npm run build`         | 178 个 Markdown 输入、450 个产物文件，退出码 0。仅从已批准的导出副本构建。                                                                                    |
| `npm run test:content`  | 54,250 通过，0 失败；检查 178 页、3,632 处数学、11,367 个本地链接、77 份图谱数据，以及根路径与 `/World/` 挂载。导航重复链接计入检查数量，该数字不是性能分数。 |

### 浏览器与发布记录

本轮浏览器报告分别保存在 `artifacts/navigation-report.json`、`browser-report.json`、`search-browser-report.json`、`reader-browser-report.json` 和 `graph-report.json`。线上复查使用独立的 `live-*` / `graph-live-report.json` 文件。截图统一位于 `artifacts/screenshots/`；下方完成记录只列实际执行结果。

| 本地浏览器检查   | 真实结果                                                                                                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 读者导航任务     | 63 通过、0 失败；书架首屏、三次点击内到达第 3 章末节、24 节目录、`1.8 → 2.1` / `2.8 → 3.1`、别名与小节筛选、多节关联知识页。                                                                           |
| 教材阅读回归     | 300 通过、0 失败；根路径、`/World/`、`/math-notes/` 三种尺寸，以及字号放大和重排，包含公式、表格、插图、Canvas、目录和键盘。                                                                           |
| 搜索             | 136 通过、0 失败；中文、英文、真实别名、标题优先、书内/全书范围、附属开关、无结果恢复、键盘和知识面板入口。                                                                                            |
| 完整知识阅读面板 | 134 通过、0 失败；从真实研读节打开知识页、HTML/MathML、18px 衬线与 1.85 行高、真实正文的嵌套知识链接、浏览器后退、焦点/滚动返回、独立页与 Ctrl 开页、加载失败恢复，手机知识入口默认折叠及 Enter 展开。 |
| 分层关系图       | 122 通过、0 失败；章节集合与知识点区分、直接引用和跨章列表、拖动/平移/缩放、键盘、模拟触摸，以及三尺寸英文整词换行和标签宽度。                                                                         |

三种主要视口为 1440×1000、1024×900、390×844。本地书架/目录/知识列表截图 9 张、阅读截图 9 张、搜索截图 4 张、阅读面板截图 5 张、分层图谱截图 6 张均实际生成并打开检查。重复运行的同名截图只代表最后一次产物；线上截图使用独立前缀。发布后的 Actions 链接、确切提交和线上结果记录在本地交付报告 `artifacts/reader-delivery-report.md`，不得用前一版线上报告替代。

视觉检查发现并修复了知识面板继承导航字体/头部布局、英文图谱标题逐字符断词、搜索摘要重复读取 KaTeX 辅助层的问题。手机上较长的本节知识列表改为带数量的可展开入口，正文更早出现；其内容全部保留。

本轮没有测试实体手机、Safari、屏幕阅读器或帧率。放大场景使用 200% 计算字号及 720px 重排，不是浏览器原生缩放。触摸通过 Chromium CDP 模拟。当前生产快照没有脚注和边注；本轮未重新构建历史合成夹具，不能把历史结果当成本轮脚注/边注覆盖。日常双击发布入口保持原样，本轮未为界面修改重新运行真实 Vault 导出。

## 历史：教材全量接入版本（2026-09-07）

用户已明确批准公开教材、目录、规划、示例和引用插图，并要求实现后推送现有 World 仓库。以下是本次全量教材版本的记录；后面的 phase-one 和 GitHub-connection 段落是历史记录，其中的两篇样例限制、尚未上传等表述不适用于当前授权范围。

最终只读导出快照包含 172 篇源 Markdown、6 个 Canvas 网页图示和 1 幅引用 SVG，合计 178 个页面。两篇合成样例保存在 `tests/fixtures/synthetic/`，不进入正式内容、搜索或关系图。搜索和图谱都包含 172 篇实际笔记；Canvas 以作者编排的独立图示呈现。

本机使用 Node 24.19.0、隔离 npm 10.9.2、Quartz 4.5.2、Playwright 1.62.1 和 Edge 152.0.4191.66。没有更换发布引擎或添加后台同步服务。

### 已实际执行

| 检查                            | 本次实际结果                                                                                                                                                                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows 双击入口的同等命令调用  | 在只有普通用户/系统 PATH 的环境中调用 `发布博客.cmd --preview-only --no-open`，成功找到已有 Codex Node 运行时，完成只读导出、类型检查、构建、内容检查和本地预览；退出码 0，没有提交或上传。自动打开浏览器步骤在这次非交互测试中用 `--no-open` 跳过。 |
| TypeScript 与全项目适用格式检查 | `npm run check` 通过。                                                                                                                                                                                                                               |
| 单元测试                        | `npm test`：98 项通过，0 失败、0 跳过，包括 11 项导出边界夹具、8 项图谱测试、5 项搜索测试、2 项嵌入回归和 3 项发布预览保护测试。                                                                                                                     |
| 上游兼容检查                    | `npm run test:upstream`：4 项通过。                                                                                                                                                                                                                  |
| 正式构建                        | 178 个 Markdown 输入，450 个产物文件，退出码 0。原版 PDF、Canvas 原文件、配置、备份、提示词与维护日志不在内容产物中。                                                                                                                                |
| 全量内容检查                    | 178 页、3,632 处渲染数学、39,367 个本地链接、173 份页面图谱数据，根路径和 `/World/` 路径共 175,178 项检查通过、0 失败。验证标题、状态、MathML、块锚点、路径、资源、搜索范围和图谱集合；重复导航链接也计入断言数量，该数值不是性能评分。              |

最终本地 Edge 回归也已通过：教材阅读 300 项、搜索 116 项、关系图 126 项，均为 0 失败。阅读检查覆盖根路径、`/World/`、`/math-notes/` 各三种视口，搜索覆盖 `/World/` 三种视口和根路径，图谱检查三种视口及鼠标、键盘和 CDP 触摸输入。最终图谱为 172 个节点、951 条去重连线。

机器报告为 `artifacts/browser-report.json`、`search-browser-report.json`、`graph-report.json` 和 `content-report.json`。9 张阅读截图、4 张搜索截图和 5 张图谱截图均实际打开检查。本次线上部署状态以对应提交的 GitHub Actions 为准；部署后的浏览器记录使用独立的 `live-book-browser-report.json`、`live-search-browser-report.json`、`graph-live-report.json`，避免与历史两篇样例的 `live-browser-report.json` 混淆。

没有实体手机、Safari、屏幕阅读器或帧率基准测试。200% 场景使用计算字号放大与独立的 720px 重排，不能称为原生浏览器缩放测试。当前生产快照没有边注和脚注，本轮未重新构建历史合成夹具，因此不把历史样例测试当成本次真实笔记覆盖。

### 已修复的问题

- Obsidian 的 `$$` 闭合符与正文同行导致公式吞入正文，以及表格公式中的绝对值/范数竖线被 GFM 当成列分隔符：只在导出副本中规范化。
- 语义块转换丢失源块锚点；同一来源的多个独立嵌入被误判为循环：保留原节点 ID，并按嵌入分支追踪真正的递归。
- `3.5` 等章节编号被本地预览服务器当作文件扩展名，导致真实章节页面 404：对安全路径同时尝试 HTML 与目录页面。
- 图谱对话框的焦点循环和 Enter 打开节点、触摸与拖动状态冲突：完成键盘与真实 CDP 触摸事件回归。
- 发布清单未以已提交版本作基线，以及预览后夹带暂存改动：使用 HEAD 清单差异、预览版本校验、精确文件集合和暂存 blob 哈希校验。
- Windows Explorer 的普通 PATH 中没有 Node：双击入口复用已安装的 Codex 运行时；不修改全局环境。

导出器未写入源笔记。读取期间通过哈希与文件集合检查建立一致快照；源库仍会被其他写作任务更新，之后的新修改会在下一次预览出现，不能把网站快照描述为持续实时同步。

## Historical phase-one validation record

This is a record of checks actually executed on the local synthetic-content project. It is separate from `acceptance.md`, which defines the requirements. No private Vault notes or attachments were used, and no files were uploaded, pushed, or deployed.

The phase-one sections below are retained as a historical record. The appended GitHub-connection follow-up describes the current repository configuration and the later regression checks. The current machine browser report contains the latest run, rather than the original eight-scenario report.

## Environment and versions

- Node 24.19.0, pnpm 11.19.0, isolated npm 10.9.2.
- Quartz 4.5.2 from `d25a6eabf96751ffca56f8a8139272def7a65041`.
- Local Noto Serif SC 5.3.0 and renderer-matched KaTeX 0.16.28.
- Playwright 1.62.1 with installed Microsoft Edge 152.0.4191.66.
- No Git repository was present at the workspace root. The implementation did not initialize one or associate a remote.

The following npm commands were invoked through `pnpm --package=npm@10.9.2 dlx npm`, except where the direct equivalent Node script is named.

## Executed checks

| Check                              | Actual result                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` using the final lockfile  | Passed; installed 488 packages and audited 489. Reported zero vulnerabilities.                                                                                                                 |
| `npm run build`                    | Passed; parsed exactly two Markdown inputs and emitted 272 files, including two HTML pages and their explicit resources.                                                                       |
| `npm run dev`                      | Started successfully on port 8080; HTTP GET `/` returned 200. HTTP and the reload WebSocket bind only to loopback. The server was stopped after previewing.                                    |
| `npm run check`                    | Passed; TypeScript and the whole project's applicable Prettier check both succeeded.                                                                                                           |
| `npm test`                         | Passed; 69 upstream tests, zero failures or skipped tests. Repeated after the final dependency installation.                                                                                   |
| `node scripts/verify-content.mjs`  | Passed; 136 assertions over approved source/output paths, metadata, semantics, mathematics, links, anchors, and local resources.                                                               |
| `node scripts/verify-upstream.mjs` | Passed; four in-memory compatibility scenarios for the upgraded sharp and TOML APIs.                                                                                                           |
| `node scripts/verify-browser.mjs`  | Passed; 174 checks across eight scenarios, zero failures. Machine results are in `artifacts/browser-report.json`.                                                                              |
| Additional preview HTTP checks     | Eight checks passed, including root/subpath reads, HEAD, missing project-internal paths, malformed encoding and blocked directory traversal. These were run with a temporary in-memory driver. |

## Browser observations

The same production output was served locally under `/` and `/math-notes/`. Each mount was checked at 1440 × 1000, 1024 × 900, and 390 × 844.

| Viewport width | Article width | Horizontal page overflow | Sidenote behavior                            |
| -------------- | ------------- | ------------------------ | -------------------------------------------- |
| 1440px         | 720px         | None                     | In the reserved right margin.                |
| 1024px         | 720px         | None                     | Within the article's original content order. |
| 390px          | 350px         | None                     | Visible within the single reading column.    |

The longest formula has 878px of content and scrolls within its own container at all three widths. Keyboard ArrowRight changed the container's scroll position; the page stayed within the viewport. Actual screenshots were opened to inspect the math limits, vertical spacing, visible focus, body typography, and margin/inline sidenote placement.

Keyboard checks exercised the skip link, table-of-contents expansion and anchors, formula regions, Markdown links to the related note and back, and footnote references and return links. The six primary scenarios recorded no runtime errors, missing resources, failed requests, or external resource requests. Both Noto Serif SC and KaTeX fonts were observed loaded locally.

The two additional scenarios used 200% computed text scaling and a separate 720px viewport reflow. They are not native browser zoom tests. No physical mobile device, Safari, screen reader session, performance benchmark, or deployed GitHub Pages site was tested.

## Defects found and corrected

- The initial 390px page measured 460px wide because an absolutely positioned, visually hidden KaTeX MathML node escaped the formula container's positioning context. Adding `position: relative` to `.math-scroll` reduced the document width to 390px while preserving MathML and local equation scrolling. No page-level overflow masking was used.
- The browser return-link test initially inspected an execution context during full-page navigation. Waiting for the destination URL and completed navigation corrected the test race. The link itself was valid.
- The static-resource test initially interpreted the deliberately empty `data:,` favicon as a filesystem resource. It now permits only that exact empty icon value, while keeping other resource URLs local and allowlisted.
- Mobile navigation text was increased to 14px; the sample introduction was shortened to bring the mathematics earlier in the reading flow. Synthetic-content identification remains visible and is explained in a footnote.
- A separate visual inspection of the enlarged-text screenshot found the long site-title word crossing the left rail into the article header. This was missed by the initial document-overflow assertions. Navigation now allows word wrapping and the desktop rail is height-limited and scrollable; the browser regression checks measure actual text Range rectangles, rather than only element boxes.

Initial npm installation reported 12 dependency findings. Compatible audit fixes plus explicit, documented upgrades to sharp 0.35.4 and TOML 4.2.0 reduced the final install audit to zero. The updated APIs were independently checked with synthetic, in-memory data. A Node `DEP0040 punycode` deprecation warning remains in the upstream build dependency chain; builds and tests exit successfully.

## Evidence

The machine browser report is `artifacts/browser-report.json`. Actual screenshots are listed in that report and stored in `artifacts/screenshots/`, including the three viewport tops/full pages, the mobile long formula and sidenote, and the scaling/reflow checks. Temporary screenshots from the first failed test run were removed after verifying their exact project-local paths; the retained normal screenshots are from the final successful run.

The root and source note files were not modified. Real-content export, attachments, remote repository setup and publication remain outside this phase.

## GitHub-connection follow-up

The user subsequently requested connecting the website folder to the World repository. Git has now been initialized only inside `website/`; `origin` is `https://github.com/MyDearATRI/World.git`, and local `main` tracks `origin/main`. The existing remote initial commit `54e412c`, containing only a `# World` README, was fetched and used as the local branch base without discarding website working files. Website-source changes are saved in a local commit; no public push or deployment has been performed. Remote reads work. The Git Credential Manager device-login flow completed successfully, the expected account is saved, and a non-interactive git push --dry-run origin main passed without uploading commits.

The local Pages workflow is prepared at `.github/workflows/pages.yml`, with push-to-main and manual triggers. Its official Actions versions were checked, `.node-version` is 24.19.0, and the target Quartz `baseUrl` is `mydearatri.github.io/World`. The workflow has not been uploaded or run. The target site is not live. Explicit authorization for the first public push and deployment is still required; the request to operate the computer and finish Git setup does not itself authorize publication.

### Regression and repair

Initializing Git exposed a static-resource regression. The upstream `glob` helper applies `gitignore: true`; because generated fonts and KaTeX resources are deliberately ignored by Git, the Static emitter stopped copying them. The failing build emitted only six files. Content verification failed at the first missing font stylesheet after 71 passing assertions, and the expanded browser run reported 227 passing checks and 27 failures, including missing-font requests.

`quartz/plugins/emitters/static.ts` now uses explicit patterns for the prepared prose CSS/fonts/licenses and KaTeX CSS/fonts/licenses under `quartz/static`, with Git ignore filtering disabled for this copy step and symbolic-link following disabled. The generated resources remain Git-ignored. The unrestricted content Assets emitter remains disabled, and neither the private Vault nor the content input boundary was opened. A direct enumeration confirmed that the previous Git-aware path returned zero resources while the explicit website resource patterns returned 266.

### Follow-up verification actually run

| Check                                     | Actual result                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Production build after the Static repair  | Passed; two Markdown inputs, 272 emitted files, including the restored 266 static resources.                |
| Content pipeline                          | Passed; all 136 assertions.                                                                                 |
| TypeScript and applicable Prettier checks | Passed.                                                                                                     |
| Expanded Edge browser suite               | Passed after the repair; 254 checks, zero failures, across 11 scenarios.                                    |
| Git remote reading and tracking           | Remote fetch succeeded; local `main` tracks `origin/main`. This does not verify authenticated write access. |
| GitHub Actions and deployed Pages         | Not run. No website-source push or deployment was performed.                                                |

The preview and browser scripts now support `/`, `/math-notes/`, and `/World/`. Each mount is checked at 1440 × 1000, 1024 × 900, and 390 × 844, with separate 200% computed-text-scaling and 720px reflow scenarios. The latest machine results are in `artifacts/browser-report.json`. These remain local Edge checks; native browser zoom, physical mobile devices, Safari, screen readers, and the actual hosted site were not tested in this follow-up. Earlier phase-one test counts are retained above and should not be read as a second execution of those tests during the repository setup.

The upstream `punycode` deprecation notice remains non-fatal. Real-note export, approved attachment handling, and publication of personal content remain unimplemented.

## Authorized GitHub Pages publication

The user subsequently explicitly approved publishing the website source and two synthetic articles to the public World repository and enabling GitHub Pages. The earlier local-only and not-yet-published statements above describe the preceding stages, not the current deployment state. No private Vault content or attachments were read or uploaded.

The website commits were pushed normally to `MyDearATRI/World` on `main`, preserving the original remote README commit. Pages was enabled with `build_type: workflow` and HTTPS enforcement. The first deployed source commit was `def8717b976685284e7f0e92d00ac7bff70a9602`.

[The first GitHub Actions run](https://github.com/MyDearATRI/World/actions/runs/34099696588) completed successfully, including both `build` and `deploy`. The actual Ubuntu runner logs confirmed:

- Node 24.19.0, npm 10.9.2 and lockfile installation succeeded; npm reported zero vulnerabilities.
- TypeScript and Prettier passed.
- All 69 upstream tests passed, with zero failures; the additional sharp/TOML compatibility checks also passed.
- Quartz processed exactly two Markdown inputs and emitted 272 files.
- All 136 content assertions passed before the Pages artifact was uploaded.
- The deployment reported success for the same source commit.

The HTTPS home page at [mydearatri.github.io/World](https://mydearatri.github.io/World/) returned HTTP 200 with the expected article title and MathML. Its published content index contained only `index` and `notes/complete-metric-spaces`.

### Actual hosted-browser verification

Edge 152.0.4191.66 loaded the real HTTPS site at 1440 × 1000, 1024 × 900 and 390 × 844. All 77 checks passed, with zero failures. The document widths remained 1440, 1024 and 390 pixels respectively. The 878px formula scrolled within its own container using the keyboard. The actual Noto Serif SC and KaTeX fonts loaded; formula HTML and MathML were present, with no KaTeX errors.

The hosted checks exercised the skip link, compact table of contents, footnote reference/return links, and navigation to the related note and back using the keyboard. Sidenotes occupied the wide margin and retained their visible document order on smaller screens. No console/runtime errors, failed resource requests or third-party reading-resource requests were observed.

The real-site report is `artifacts/live-browser-report.json`; the local verification script is `artifacts/verify-live.mjs`. Four actual screenshots were generated and opened for visual inspection:

- `artifacts/screenshots/live-1440-top.png`
- `artifacts/screenshots/live-1024-top.png`
- `artifacts/screenshots/live-390-top.png`
- `artifacts/screenshots/live-390-sidenote.png`

These are desktop Edge tests of the hosted site, not physical-device, Safari, screen-reader or performance-benchmark results. The earlier local 200% text-scaling and reflow checks were not rerun against the hosted site. No new performance score is claimed. Approved real-note export and attachment handling remain the next content task.
