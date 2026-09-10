# Notes & Knowledge

打开知识对象后，正文使用主要阅读面；上方保留当前题名，两侧的小关系图分别列出已有的来向和去向。主题选择收进左上角抽屉，手机将两侧方向收进底部的“指向这里／从这里出发”。阅读时不再保留或计算整张背景地图。

右上角“全局地图”提供另一种探索方式：所有勾选主题的对象和真实连线同时进入地图，与概览分页无关。拖节点改变位置，拖空白平移，滚轮或双指缩放，“适应全部”回到全图；点击或 Enter 打开同一阅读空间，Ctrl/Cmd 点击保留新标签。返回时恢复地图和正文位置。地图按输入更新，松手后停止；这是全量 SVG 交互图，不把它描述为三维视图。

新版可用 `pnpm --package=npm@10.9.2 dlx npm run test:reading-space` 验证；实际结果与截图见 [验证记录](docs/validation.md)。以下保留已有具名概览、知识场和阶段说明，阅读布局以本节为准。

选主题后，先看到位置稳定、带完整名称和类型的知识对象。定义、定理等对象优先呈现；筛选、明确分页与关联列表让全部公开对象保持可达。点名称进入原位阅读，点“查看联系”读真实方向与依据；从阅读区用“主题概览”返回。这一层不运行力学，也不摆放无名的背景小点。

原位关系视图只展示能够同时标明名字的对象。鼠标悬停不移动场景；拖过的节点留下，直接邻居作有限响应，无关节点不跟随。文字保留已选位置，拖动时相交标签短暂退隐，松手后重新避让；只有主动切换对象或重排时才安排有限过渡。帮助菜单的“重新整理当前布局”可清除手动落点。可用 `pnpm --package=npm@10.9.2 dlx npm run test:stable-field` 复跑名称覆盖、拖动、停稳与返回检查；实际证据及限制记录在 [验证记录](docs/validation.md)。

## 从主题开始

主页与 `topos.html` 增加主题侧栏。勾选“集合、序与实数”“线性结构与谱”“度量、拓扑与紧性”“微积分与逼近”“Hilbert 空间与算子”“Fourier 展开”，右侧显示对应知识对象与原文联系。多个主题取并集，同一对象只出现一次；清空后可以重新选择。“在选中主题中定位”支持按名称筛选并直接展开正式渲染的原文。手机使用左上角的“主题”抽屉，原有书籍阅读入口保留。

切换“数学地图”进入 `atlas.html`：十二个宏观区域来自 Phase 1 标题注册表，分类节点只展示标题、归属、活动来源及边界，尚无你的正文的方向不会冒充成已有笔记。三卷完整标题树与源审计在 [ontology](ontology/math_outline.md)，阶段进度在 [phase-status.json](docs/phase-status.json)。主网站仍使用已批准的 Obsidian 导出快照，本轮不扩大私人库范围。

Phase 0 的仓库与能力审计，以及 Phase 1 的来源核对、标题注册表和分类基准已完成；详细状态分别见 [Phase 0](docs/phases/phase-00/acceptance.json) 与 [Phase 1](docs/phases/phase-01/acceptance.json)。标题地图包含 94 个有来源的数学主题，其中 24 个为前沿方向；这些是导航标题，不能当成已经写成或形式化验证过的数学讲义。

新增验证命令为 `pnpm --package=npm@10.9.2 dlx npm run check:ontology`、`npm run test:topic-map`、`npm run test:topics` 和 `npm run test:topic-interactions`（后三条使用同样的 pnpm/npm 前缀；先构建）。双击 `同步到GitHub.cmd` 继续走检查、预览、确认、普通推送的流程；这个入口不扫描源 Vault。检查结果见 [验证记录](docs/validation.md)。

数学与物理教材笔记网站。线上地址：[mydearatri.github.io/World/](https://mydearatri.github.io/World/)；仓库：[MyDearATRI/World](https://github.com/MyDearATRI/World)。

网站首页与 `/World/topos.html` 使用已有公开数学笔记的 Knowledge Topos：119 个数学对象和 73 篇完整正文共享连续知识场，保持原来的稳定身份、条件、来源与证明状态。普通点击改变当前语境，拉近展开原文和公式，链接可在场内继续深入；书籍与章号用于来源追溯，不再决定默认知识结构。没有独立登记对象的正文仍完整可读。

鼠标点选概念、拖动节点、拖动空白平移，滚轮或底部控件调整语义层次。`Ctrl/Cmd+K` 查找标题、别名、中英文正文和 LaTeX；键盘 Tab / Enter 进入对象，`+` / `-` 改变深度，前进后退保留探索来路。定义、定理、证明策略与完整笔记分别标明身份，引用关系不会被显示成证明。减少动画模式保留相同内容和操作。

正文仍以本地 Obsidian 为唯一写作源，本轮适配复用已批准的发布快照，没有重新导出私人库或改写数学证明。以前的书架及完整首页说明位于 `/World/library.html`，原文章和原子网址继续有效。规划与写作示范保留为次级材料，数学例子、反例、习题不因名字而隐藏。独立的 Group → Action → Representation 合成演示移到 `/World/topos-demo.html`，不混入真实笔记的搜索与计数。实际部署与验收见 [验证记录](docs/validation.md)。

当前视觉规则用灰白页面层次和近白阅读区域区分导航与正文：主标题采用 700 字重无衬线字体，章节标题采用 650 字重，正文保持约 18px 的中文友好衬线字体。数学块以简短类型标记和原题名分别呈现；有明确“来源：”或“Source:”标记的开头来源段用 12px 无衬线字体，保留全部引用文字与链接。控件提供短暂反馈，原生 `details` / `dialog` 提供轻量展开或入场效果，并响应减少动态效果设置。排版层级与交互反馈参考 [Apple MacBook Pro 页面](https://www.apple.com/macbook-pro/)和 [Human Interface Guidelines：Motion](https://developer.apple.com/design/human-interface-guidelines/motion)，使用本站自己的字体、配色和图形，不复制商标视觉。具体效果及验证结果仍以验证记录为准。

## 平时怎样写、怎样更新

修改网站界面或交互后，双击 `同步到GitHub.cmd` 即可检查、预览并同步网站工程。看过预览后输入 `SYNC`，它才会普通提交并 push，等待对应提交的 Pages 结果。它沿用已经公开的内容快照，不扫描私人 Obsidian 库；未登记的新文件不会自动加入。检查失败、已有无关暂存文件、分支分叉或预览后文件改变时会停止。推送失败可重开入口重试同一个提交。

下面的 `发布博客.cmd` 则用于在 Obsidian 写了新文章后的内容更新。这两个入口都不建立后台自动上传。

1. 在 Obsidian 中写作并保存。不要编辑 `website/content`，它是自动生成的公开副本。
2. 双击网站文件夹中的 `发布博客.cmd`。它会列出本次新增、修改、移除，导出公开内容，准备原子清单与推荐索引，构建并检查，再打开本地预览。推荐按内容哈希缓存，未变化的内容无需重新计算。
3. 看过预览后，在窗口输入 `PUBLISH` 才会提交并上传；其他输入取消上传。窗口会等待 GitHub Pages 发布结果。

只看预览时，双击 `预览博客.cmd`。保存笔记本身不会自动上传，没有后台同步或监控服务。

本机入口会先查找 PATH 中的 Node，缺少时使用已经安装的 Codex 本地运行时，不修改系统 PATH。Git 使用已有 Git for Windows 和凭据管理器。运行时或依赖不存在时会报错，不会悄悄安装其他服务。

公开范围由 `publish.config.json` 控制：包括教材正文、目录、规划和示例，以及实际引用的插图和 Canvas 图示；排除隐藏配置、备份、提示词、空白模板、维护日志、原版 PDF，以及标了 `private: true`、`publish: false` 或 `draft: true` 的笔记。新建符合范围的 Markdown 会出现在下次预览清单中。PDF 的引用文字和页码保留，原文件不公开。原始 Canvas 留在本地，网站发布其图示和说明。

## 保留的旧阅读空间与三维地图

三维地图按“书 → 章 → 节”逐层展开；进入小节后查看其数学对象，同一个原子不会因为关联多个小节而复制身份。拖动节点感受关联牵引，拖动空白旋转视角，Shift／右键拖动平移，滚轮缩放；也可使用镜头按钮。手机先显示目录，按需打开全屏地图，调整节点时开启位置调整模式。布局收敛后停止运动，返回和刷新保留镜头与位置。

原文关系、内容归属、模型相似分别标识，链接强弱只服务布局。相似推荐默认提供较弱牵引，可在视图选项关闭；将相似推荐纳入连接路径仍需单独选择。没有 WebGL2 时使用同一目录和关系列表，完整阅读不受影响。地图资源仅在探索页或主动展开地图时加载，图的查看不触发模型下载。

- “按书阅读”沿用书章目录、连续研读顺序和完整 Markdown。“探索知识”进入有名称的章节分组，再查看定义、定理、证明、观察等对象；手机优先显示名称列表，地图可全屏打开。
- 点击原子会展开完整阅读面，保留来源、证明状态、相关笔记与探索来路。每一步都有真实静态地址；后退/前进恢复阅读状态，Ctrl/Cmd 点击继续使用浏览器的新标签方式。悬停或键盘聚焦原子链接会显示原文预览与公式。
- `Ctrl/Cmd+K` 打开统一搜索，支持中英文、别名、正文、原始 LaTeX 和常见符号写法。默认查当前书，类型和关系可以筛选；“包含附属资料”需主动勾选。公式搜索用于找文本与符号，不判断数学等价。
- 地图可拖动、平移、缩放、适应视图和逐层返回；拉近后显示摘录与公式。查看两个对象的连接时，每一步都有关系类型和出处。普通引用不解释成先修条件。机器推荐单独标注，默认不进入路径搜索。
- 阅读、普通搜索和预计算推荐不下载模型。只有在搜索面板里主动启用本机语义搜索才下载公开模型，约 129.1 MiB，另需约 21.5 MiB 本站运行资源；提供进度、取消和本站模型缓存清除。查询在读者设备运行，不用作者订阅、账号或电脑，也不发送查询正文。模型说明和校验值见 [模型记录](knowledge/SEMANTIC-MODEL.md)。

## 保留的教材功能

- `library.html` 从书架进入一本书，写作说明与模板资料放在“关于这些笔记”中。书页提供“按章节阅读”和“查找知识点”，章页列出本章研读、知识、联系与习题入口。桌面显示本书目录，窄屏可展开“章节目录”。连续研读页保留前后节导航。
- 书页的关系图保留章节与完整知识笔记层级，点击进入同一阅读空间。原子地图提供更细的数学对象入口；两种层级都不将普通引用解释成先修关系。
- Canvas 页面保留原分组、方向和说明，点“放大查看关系白板”后可放大、滚动和点击笔记。

原来的首页、书籍和章节导航 Markdown 保留在页面的“原始导航说明”等展开区域中，源标题和整理状态仍可查阅；网站的目录视图没有回写这些笔记。

## 本地开发命令

在已配置 Node 和 pnpm 的 Codex 终端中进入 `website` 后：

```powershell
pnpm --package=npm@10.9.2 dlx npm ci
pnpm --package=npm@10.9.2 dlx npm run dev
```

开发地址为 `http://127.0.0.1:8080/`。开发服务器只读取清单内的公开副本。修改源 Vault 后通过发布/预览入口重新导出；单独调整网站界面无需导出。构建命令不访问 Vault，也不运行模型推理；克隆仓库后安装依赖即可构建和阅读已经公开的内容。

已有 Node ≥22、npm ≥10.9.2 的环境也可以直接用 `npm ci`、`npm run build` 和 `npm run dev`。本工程实际采用 Node 24.19.0、npm 10.9.2、Quartz 4.5.2，单一 `package-lock.json`。上游源码固定于 `d25a6eabf96751ffca56f8a8139272def7a65041`，保留 Quartz 的 MIT 许可证；内容中的原始来源说明继续保留。

## 构建与验收

```powershell
pnpm --package=npm@10.9.2 dlx npm run check
pnpm --package=npm@10.9.2 dlx npm test
pnpm --package=npm@10.9.2 dlx npm run test:upstream
pnpm --package=npm@10.9.2 dlx npm run build
pnpm --package=npm@10.9.2 dlx npm run test:content
pnpm --package=npm@10.9.2 dlx npm run test:knowledge
pnpm --package=npm@10.9.2 dlx npm run test:spatial
pnpm --package=npm@10.9.2 dlx npm run test:knowledge-graph
pnpm --package=npm@10.9.2 dlx npm run test:semantics
pnpm --package=npm@10.9.2 dlx npm run test:topos
```

浏览器检查使用本机 Edge 和隔离的本地端口。检查期间不要同时重建 `public`。`npm run preview` 可单独查看正式产物，默认端口 8081，同一产物支持根路径、`/World/` 和 `/math-notes/`。

`test:semantics` 需要本机已校验模型缓存，用原模型字节重放下载并实际运行 WASM；没有缓存时不能把该项视为通过。仅校验已准备的公开索引时使用 `npm run check:semantics`，不会下载或加载模型。更新公开导出后使用 `npm run prepare:knowledge` 准备原子和向量；模型权重与缓存均被 Git 忽略。

真实验收记录见 [docs/validation.md](docs/validation.md)。完整本地报告和截图位于被 Git 忽略的 `artifacts/`。线上复测可设置 `GRAPH_SITE_URL`、`SEARCH_SITE_URL` 或 `BOOK_SITE_URL`；本机需要代理时设置 `BROWSER_PROXY`，测试不会把代理或凭据写入仓库。

## 内容边界与实现入口

`publish-manifest.json` 是公开副本清单，记录批准路径及 SHA-256。导出器先暂存、验证源快照和所有输出，再替换自己的公开副本；未托管文件或被手工改动的副本会阻止覆盖。完整排除项和缺链诊断只保留在本地 `artifacts/export-diagnostics.json`，不上传私人目录清单。

页面、搜索和关系图共享 `ReaderCatalog` 阅读模型：`reader.config.ts` 记录书章入口和少量明确的补充映射，`ReaderMetadata` 从导出 Markdown 的标题与链接提取结构。研读顺序来自章导航，知识所属节主要来自原书目录；跨章或多节使用保留多重关联。新研读、知识或章节不会因为漏配而消失，未确定的归属会显示在章级并产生诊断。

辅助资料身份与是否公开是两件事：这些资料仍保留独立页面及完整搜索文档，只改变默认展示。`auxiliaryFiles` 精确排除当前导航页面；不会把同名目录下未来新增的实际正文一并隐藏。“发现归档”保留默认搜索资格，数学正文也不会因为标题包含 example 而被归入模板演示。

KaTeX 输出 HTML 与 MathML，字体使用同一安装版本的本地资源；中文正文使用本地 Noto Serif SC。原版 PDF、整库附件目录、Obsidian 配置和备份不会作为网站静态目录使用。

主要入口：`scripts/export-vault.mjs`、`scripts/publish.mjs`、`reader.config.ts`、`quartz/util/readerCatalog.ts`、`quartz/plugins/transformers/readerMetadata.ts`，以及 `quartz/components/Reading.tsx`、`BookSearch.tsx`、`KnowledgeReader.tsx`、`NoteGraph.tsx` 和对应样式。源笔记只读，导出层负责 Obsidian 链接、公式分隔符、表格公式与 Canvas 的兼容转换；目录和交互调整只改网站工程。

## GitHub 发布与失败恢复

仓库只位于 `website`。向 `main` 普通 push 后，已有 `.github/workflows/pages.yml` 会安装锁定依赖、检查、构建、校验产物，再部署到 GitHub Pages。CI 无法访问本机 Vault，只使用已经批准并提交的公开副本。

发布入口不会夹带其他暂存或网站代码改动；预览后 HEAD、文件范围或清单变化会要求重新预览，暂存字节必须等于已预览版本。不使用强制推送。手动维护网站代码时，单独检查、提交，再普通 `git push`。

如果显示“本地提交已保存，但推送失败”，恢复连接后在网站目录运行 `git push origin main`，不要重复创建提交。如果显示“已推送，部署状态尚未确认”，到 [Actions](https://github.com/MyDearATRI/World/actions) 查看该提交；仓库上传和站点部署是两个不同阶段。
