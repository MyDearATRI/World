# Notes & Knowledge

数学与物理教材笔记网站。线上地址：[mydearatri.github.io/World/](https://mydearatri.github.io/World/)；仓库：[MyDearATRI/World](https://github.com/MyDearATRI/World)。

正文来自本地 Obsidian 笔记，网站提供教材首页、分层目录、章节前后导航、全文搜索、全局/局部关系图及 Canvas 阅读视图。规划、示例和整理状态沿用源笔记，不推断作者经历、掌握程度或发布日期。

## 平时怎样写、怎样更新

1. 在 Obsidian 中写作并保存。不要编辑 `website/content`，它是自动生成的公开副本。
2. 双击网站文件夹中的 `发布博客.cmd`。它会列出本次新增、修改、移除，导出公开内容，构建并检查，再打开本地预览。
3. 看过预览后，在窗口输入 `PUBLISH` 才会提交并上传；其他输入取消上传。窗口会等待 GitHub Pages 发布结果。

只看预览时，双击 `预览博客.cmd`。保存笔记本身不会自动上传，没有后台同步或监控服务。

本机入口会先查找 PATH 中的 Node，缺少时使用已经安装的 Codex 本地运行时，不修改系统 PATH。Git 使用已有 Git for Windows 和凭据管理器。运行时或依赖不存在时会报错，不会悄悄安装其他服务。

公开范围由 `publish.config.json` 控制：包括教材正文、目录、规划和示例，以及实际引用的插图和 Canvas 图示；排除隐藏配置、备份、提示词、空白模板、维护日志、原版 PDF，以及标了 `private: true`、`publish: false` 或 `draft: true` 的笔记。新建符合范围的 Markdown 会出现在下次预览清单中。PDF 的引用文字和页码保留，原文件不公开。原始 Canvas 留在本地，网站发布其图示和说明。

## 界面操作

- 首页按原有 Obsidian 首页展示笔记主体、知识主干、规划和示例。桌面左侧为教材目录，手机点击“教材目录”展开。
- 搜索框支持中文、英文、标题、别名、章节、正文和标签；`Ctrl/Cmd+K` 打开，方向键选择，Enter 阅读，Esc 关闭。可筛选正文、规划和示例。
- 首页关系图直接可操作；文章页“关系图”从当前笔记的一层关联打开，可切换全局。拖动节点改变布局，拖动空白处平移，滚轮或双指缩放。按钮提供拟合、重置和暂停；键盘也可操作。关系图只表达已有链接，不把连线解释成定理间的逻辑蕴含。
- Canvas 页面保留原分组、方向和说明，点“放大查看关系白板”后可放大、滚动和点击笔记。

## 本地开发命令

在已配置 Node 和 pnpm 的 Codex 终端中进入 `website` 后：

```powershell
pnpm --package=npm@10.9.2 dlx npm ci
pnpm --package=npm@10.9.2 dlx npm run export
pnpm --package=npm@10.9.2 dlx npm run dev
```

开发地址为 `http://127.0.0.1:8080/`。开发服务器只读取导出副本，修改源 Vault 后需重新运行导出。构建命令不访问 Vault；因此克隆仓库到另一台机器后，安装依赖即可构建和阅读已经公开的内容。

已有 Node ≥22、npm ≥10.9.2 的环境也可以直接用 `npm ci`、`npm run build` 和 `npm run dev`。本工程实际采用 Node 24.19.0、npm 10.9.2、Quartz 4.5.2，单一 `package-lock.json`。上游源码固定于 `d25a6eabf96751ffca56f8a8139272def7a65041`，保留 Quartz 的 MIT 许可证；内容中的原始来源说明继续保留。

## 构建与验收

```powershell
pnpm --package=npm@10.9.2 dlx npm run check
pnpm --package=npm@10.9.2 dlx npm test
pnpm --package=npm@10.9.2 dlx npm run test:upstream
pnpm --package=npm@10.9.2 dlx npm run build
pnpm --package=npm@10.9.2 dlx npm run test:content
pnpm --package=npm@10.9.2 dlx npm run test:browser
pnpm --package=npm@10.9.2 dlx npm run test:search
pnpm --package=npm@10.9.2 dlx npm run test:graph
```

浏览器检查使用本机 Edge 和隔离的本地端口。检查期间不要同时重建 `public`。`npm run preview` 可单独查看正式产物，默认端口 8081，同一产物支持根路径、`/World/` 和 `/math-notes/`。

真实验收记录见 [docs/validation.md](docs/validation.md)。完整本地报告和截图位于被 Git 忽略的 `artifacts/`。线上复测可设置 `GRAPH_SITE_URL`、`SEARCH_SITE_URL` 或 `BOOK_SITE_URL`；本机需要代理时设置 `BROWSER_PROXY`，测试不会把代理或凭据写入仓库。

## 内容边界与实现入口

`publish-manifest.json` 是公开副本清单，记录批准路径及 SHA-256。导出器先暂存、验证源快照和所有输出，再替换自己的公开副本；未托管文件或被手工改动的副本会阻止覆盖。完整排除项和缺链诊断只保留在本地 `artifacts/export-diagnostics.json`，不上传私人目录清单。

页面、搜索和关系图都以同一批导出后的内容为准。KaTeX 输出 HTML 与 MathML，字体使用同一安装版本的本地资源；中文正文使用本地 Noto Serif SC。原版 PDF、整库附件目录、Obsidian 配置和备份不会作为网站静态目录使用。

主要入口：`scripts/export-vault.mjs`、`scripts/publish.mjs`、`quartz/components/Reading.tsx`、`BookSearch.tsx`、`NoteGraph.tsx`，以及 `quartz/styles/custom.scss` 和 `book.scss`。源笔记只读，导出层负责 Obsidian 链接、公式分隔符、表格公式与 Canvas 的兼容转换。

## GitHub 发布与失败恢复

仓库只位于 `website`。向 `main` 普通 push 后，已有 `.github/workflows/pages.yml` 会安装锁定依赖、检查、构建、校验产物，再部署到 GitHub Pages。CI 无法访问本机 Vault，只使用已经批准并提交的公开副本。

发布入口不会夹带其他暂存或网站代码改动；预览后 HEAD、文件范围或清单变化会要求重新预览，暂存字节必须等于已预览版本。不使用强制推送。手动维护网站代码时，单独检查、提交，再普通 `git push`。

如果显示“本地提交已保存，但推送失败”，恢复连接后在网站目录运行 `git push origin main`，不要重复创建提交。如果显示“已推送，部署状态尚未确认”，到 [Actions](https://github.com/MyDearATRI/World/actions) 查看该提交；仓库上传和站点部署是两个不同阶段。
