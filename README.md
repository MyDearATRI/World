# Mathematical Notes — 本地阅读样板

以 Markdown 为正文来源的数学阅读页，基于 Quartz 4.5.2。首页为合成文章 **Contractions and fixed points**，另有一篇 **Complete metric spaces** 关联笔记。网站目录已初始化 Git，`origin` 已连接公开仓库 [MyDearATRI/World](https://github.com/MyDearATRI/World)，本地 `main` 跟踪 `origin/main`。网站源码已保存为本地提交，尚未推送，目标站点尚未上线。只有本网站目录进入版本管理；没有读取或接入私人 Vault。

## 本地运行

本机已验证 Node 24.19.0、pnpm 11.19.0。上游要求 Node ≥22、npm ≥10.9.2；以下命令通过 pnpm 调用隔离的 npm 10.9.2，不改变全局 npm 安装，且只维护 `package-lock.json`。

从当前库根目录打开 PowerShell 时，先运行 `cd website`；已经在网站目录中则无需切换目录。在新机器上，待首次推送完成后，可以运行 `git clone https://github.com/MyDearATRI/World.git`，然后 `cd World`。接着安装依赖并启动：

```powershell
pnpm --package=npm@10.9.2 dlx npm ci
pnpm --package=npm@10.9.2 dlx npm run dev
```

打开 <http://127.0.0.1:8080/>。开发服务器与热更新 WebSocket 都仅监听 `127.0.0.1`，按 Ctrl+C 停止。修改 `content/` 中的样例 Markdown 后，Quartz 会重新渲染文章；修改组件、配置或样式会触发重建。

如果机器已有符合要求的 npm，同一工程也支持 `npm ci` 和 `npm run dev`。

## 构建与检查

```powershell
pnpm --package=npm@10.9.2 dlx npm run build
pnpm --package=npm@10.9.2 dlx npm run check
pnpm --package=npm@10.9.2 dlx npm test
pnpm --package=npm@10.9.2 dlx npm run test:content
pnpm --package=npm@10.9.2 dlx npm run test:upstream
pnpm --package=npm@10.9.2 dlx npm run test:browser
```

`build` 明确从 `content` 构建到 `public`。启动与构建前会检查输入范围，并将依赖中的正文和数学字体复制到网站静态资源目录。首次安装需要下载公开 npm 包；构建后的阅读页面不向外部字体/CDN服务发请求。

`test:browser` 使用本机 Edge，无需下载另一份 Chromium。可通过 `BROWSER_CHANNEL=chrome` 改用已安装的 Chrome；该替代通道未作为本次最终验收环境。脚本自行启动仅监听本机的 8081 端口，完成后关闭浏览器和服务器。运行前应先构建；不要在浏览器验收期间运行会重写 `public` 的开发重建。

```powershell
# 单独查看正式产物；同一份输出同时挂载到三个路径。
pnpm --package=npm@10.9.2 dlx npm run preview
```

正式产物预览同时支持 <http://127.0.0.1:8081/>、<http://127.0.0.1:8081/math-notes/> 和 <http://127.0.0.1:8081/World/>。最后一个路径对应已经配置的目标站点 [mydearatri.github.io/World/](https://mydearatri.github.io/World/)，该站点尚未上线。这些本机预览用于检查路径兼容性，不代表已部署。

## GitHub 更新

仓库、首次推送边界、日常提交命令和后续 Pages 流程见 [GitHub 使用说明](docs/github.md)。日常使用标准 Git：先 `git pull --ff-only`，修改后检查 `git status` 和 `git diff`，只添加本次需要的路径，再提交并 `git push`。不要使用 Quartz 的 `sync` 命令代替这些步骤；当前引擎的该命令包含强制推送。

本地分支已经接上远端原有的 README 初始提交，并保留了全部网站工作文件。Git Credential Manager 已完成设备登录并保存本机凭据，普通推送的 dry-run 验证通过；首次公开推送及部署仍需明确授权。[Pages 工作流](.github/workflows/pages.yml)已在本地准备，获准上传和启用 Pages 后，向 `main` 推送会触发构建与部署，也支持手动触发。

当前构建仍只允许两篇合成样本。新增真实文章前，需要批准具体笔记与附件清单，并完成只读导出和输入清单调整；连接仓库不代表允许上传整个私人库。

## 文件与内容接口

| 位置                                            | 用途                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| `content/index.md`                              | 主样板，包含双语正文、定义、定理、证明策略、例子、脚注、边注和长公式。         |
| `content/notes/complete-metric-spaces.md`       | 真实生成的关联页面，含返回主文及指定小节的链接。                               |
| `quartz.config.ts`、`quartz.layout.ts`          | 内容管道、阅读组件与页面布局；不启用日期推断、附件复制、分析统计或额外列表页。 |
| `quartz/components/Reading.tsx`                 | 页头、目录、导航、正文容器与从真实链接关系生成的关联笔记。                     |
| `quartz/styles/custom.scss`                     | 独立阅读主题，包含宽屏边注、窄屏回流、公式滚动与键盘焦点。                     |
| `quartz/plugins/transformers/localMath.ts`      | `remark-math` → `rehype-katex`，输出 HTML 与 MathML。                          |
| `quartz/plugins/transformers/semanticBlocks.ts` | 从 Obsidian callout 生成有标签的 `section`/`aside`，并包装独立公式。           |
| `scripts/prepare-assets.mjs`                    | 限定输入，复制同版本数学资源和完整字体 Unicode 覆盖。                          |
| `scripts/verify-*.mjs`、`scripts/preview.mjs`   | 内容、浏览器、依赖兼容性检查及受限静态预览。                                   |
| `.github/workflows/pages.yml`                   | 已在本地准备的 GitHub Pages 构建与部署工作流；尚未上传或运行。                 |
| `docs/`、`AGENTS.md`                            | 本次需求新建的工程、设计、内容与验收约定。                                     |
| `artifacts/`                                    | 实际验证报告与截图；不参与网站构建。                                           |

所有文章论述与公式来自 Markdown，页面组件没有第二份文章正文。支持 `[!definition]`、`[!theorem]`、`[!proof-strategy]`、`[!example]`、`[!sidenote]`；策略必须明确标为 `Proof strategy — not a complete proof`。双链使用相对于合成内容根的 Obsidian 路径，如 `[[notes/complete-metric-spaces|complete metric space]]`。

正文字体为本地 Noto Serif SC 5.3.0（400、600 字重），导航为系统无衬线。数学渲染器与静态资源均来自同一安装的 KaTeX 0.16.28。正文从 720px / 18px / 1.85 行高起调，1280px 以下进入单栏主阅读区，边注保持原始文档顺序。

## 版本来源与本地改动

Quartz 引擎来自官方提交 [`d25a6eabf96751ffca56f8a8139272def7a65041`](https://github.com/jackyzha0/quartz/tree/d25a6eabf96751ffca56f8a8139272def7a65041)，该提交版本为 4.5.2。配置参照该提交的[配置文档](https://github.com/jackyzha0/quartz/blob/d25a6eabf96751ffca56f8a8139272def7a65041/docs/configuration.md)和[布局文档](https://github.com/jackyzha0/quartz/blob/d25a6eabf96751ffca56f8a8139272def7a65041/docs/layout.md)，不混用官网后续大版本的接口。上游 MIT 许可证保留在 `LICENSE.txt`；字体与数学依赖许可证随本地资源复制。

保留单一 npm 锁文件，并加入正文/数学字体与 Playwright。针对安装时真实报告的依赖公告，应用兼容更新，再显式固定 `sharp@0.35.4` 与 `toml@4.2.0`，而没有使用 `audit fix --force`。前者使用的图片 API 已核实，后者采用含递归限制的最小修复系列，避免引入 TOML 5 的整数语义变化。另在 `quartz/cli/handlers.js` 中把开发 HTTP 与 WebSocket 绑定改为回环地址。

初始化 Git 后发现，上游 Static emitter 会按 `.gitignore` 跳过生成的字体与 KaTeX 资源。现已将该 emitter 限定为明确的网站资源模式，并在这一步关闭 Git 忽略过滤；生成资源依然不提交到 Git，私人内容与附件的输入边界保持不变。

## 验证记录

详细实际结果记录在 `docs/validation.md`；浏览器机器报告位于 `artifacts/browser-report.json`。截图均由本机浏览器实际生成，视觉检查后才纳入交付引用。

Git 连接后的本地复验结果：构建从两篇 Markdown 生成 272 个文件，内容检查 136 项通过，TypeScript 和格式检查通过；Edge 浏览器在三个挂载路径及缩放/重排场景中共检查 11 个场景，254 项通过、0 项失败。新增的 `/World/` 检查与初始化 Git 后的资源回归已纳入本次结果；GitHub Actions 和线上 Pages 尚未运行。

构建仍会输出上游间接依赖的 Node `DEP0040 punycode` 弃用提示；它不是构建失败。浏览器测试使用 Edge 模拟视口，不等同于真实手机或 Safari 测试。200% 检查采用明确记录的计算字号翻倍与 720px 重排，并非浏览器原生缩放。

## 未实现与下一阶段

真实 Vault 导出、附件处理和正式个人内容尚未实现。网站源码已在本地提交；公开推送、GitHub Actions 运行和 Pages 部署尚未完成；现阶段仅完成本地 Git 连接、发布配置准备与本地验证。Git 根目录为当前网站目录，不能在父级私人库根目录初始化 Git 来代替它。

下一阶段只需批准少量公开笔记及其依赖/附件清单，再实现到独立内容目录的只读导出。现有构建前检查只接受两篇合成文件，后续必须与批准清单一起明确调整；不能把整个 Vault 或附件目录改成 `content`、`public` 或它们的符号链接。上传与公开发布另需明确授权。
