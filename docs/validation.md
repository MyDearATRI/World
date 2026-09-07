# 网站验收记录

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
