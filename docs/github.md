# World 仓库与日常更新

网站使用公开仓库 [MyDearATRI/World](https://github.com/MyDearATRI/World)。本地网站目录已初始化 Git，`origin` 已设置为 `https://github.com/MyDearATRI/World.git`，`main` 已跟踪 `origin/main`。本地现有工程目录叫 `website`，新机器克隆后的默认目录叫 `World`；两者都是网站工程根目录。

当前本地分支以远端已有提交 `54e412c` 为起点，该提交只有 `# World` README；全部网站工作文件已保留，网站源码已保存为本地提交，尚未推送。远端读取已连通，GitHub Credential Manager 设备登录仍待完成。首次公开推送和上线尚未授权或执行；连接 Git 与准备工作流不代表网站已经发布。

## 哪些文件会进入仓库

Git 的范围仅限网站目录，包括 Quartz 源码、配置、脚本、文档和 `content/` 中批准的内容。父目录的 Obsidian 库、真实源笔记和私人附件不在这个 Git 仓库内。不要在父目录运行 `git init`，也不要通过符号链接、递归复制或更改构建输入把整个库纳入网站。

`.gitignore` 排除了 `node_modules/`、`public/`、生成的字体和 KaTeX 资源、缓存、截图报告、本地环境变量和常见私钥文件。新机器通过安装和构建重新生成需要的资源。不要把令牌、密码或本机密钥写进源码、Markdown、远程 URL 或提交消息。

当前 `scripts/prepare-assets.mjs` 的输入清单只允许 `content/index.md` 和 `content/notes/complete-metric-spaces.md` 两篇合成样本。真实 Obsidian 笔记仍是唯一写作源；新增真实文章应先明确批准笔记、所需链接和附件清单，再实现只读导出，并同步调整输入清单。批准一篇文章不等于批准所有关联笔记或附件。

## 拉取和提交更新

在网站目录打开 PowerShell。下面是完成首次网站提交与获准推送后的日常流程；现有 `main` 已跟踪 `origin/main`。拉取前先处理已有的未提交改动，不要为了拉取而丢弃文件：

```powershell
git status
git pull --ff-only
```

`--ff-only` 在本地与远端历史分叉时会停下，不自动合并或改写历史。遇到这种情况先检查双方提交，再决定如何处理；不要直接使用强制推送。

完成修改后，检查改动并运行与改动相符的验证。样例文章、样式或内容管道修改至少重新构建并检查内容；改变阅读布局时还应运行浏览器验收：

```powershell
git status
git diff
pnpm --package=npm@10.9.2 dlx npm run build
pnpm --package=npm@10.9.2 dlx npm run check
pnpm --package=npm@10.9.2 dlx npm run test:content
```

只添加本次实际修改的文件。以下路径仅演示一次修改样例正文的提交；修改其他文件时使用相应的具体路径：

```powershell
git add -- content/index.md
git diff --cached
git commit -m "Revise contraction sample"
git push
```

当前跟踪关系已经设置，首次获准推送时可使用 `git push origin main`，后续在 `main` 上直接 `git push` 即可。切换机器时，在网站源码首次推送完成后使用 `git clone https://github.com/MyDearATRI/World.git`，进入 `World` 并按照 README 安装依赖；此前克隆只会得到远端原有的初始 README。身份认证使用 GitHub 或本机凭据管理器，不在命令和文件中存放令牌。本机网络配置属于本地 Git 配置，不纳入仓库。

不要把 `quartz sync` 当作普通同步命令：本项目固定的 Quartz 版本会自动执行 `git add .` 和 `git push -uf`。`quartz update` 用于引入 Quartz 上游变更，也不等于拉取 World 仓库的日常更新。这里统一使用标准 Git 命令。

## 后续 GitHub Pages 更新

`.github/workflows/pages.yml` 已在本地准备，配置为向 `main` 推送时触发，也支持 `workflow_dispatch` 手动触发；使用的官方 Actions 版本已核对。`.node-version` 固定为本机验证过的 Node 24.19.0，Quartz `baseUrl` 已设置为 `mydearatri.github.io/World`。这份工作流尚未上传或在 GitHub 运行。

在明确授权首次推送及部署、工作流上传且仓库 Pages 来源设置为 GitHub Actions 后，向 `main` 推送提交将触发 Actions：根据 npm 锁文件安装依赖、运行检查、从 `content/` 构建 `public/`，再将构建产物部署到 Pages。仓库里维护源码，不提交本机生成的 `public/`。

目标地址为 [MyDearATRI.github.io/World/](https://mydearatri.github.io/World/)，目前尚未上线。本地已通过 `/`、`/math-notes/`、`/World/` 三个路径的浏览器检查，但本地结果不能证明线上部署成功。每次推送后到仓库的 Actions 页面确认运行结果；构建或部署失败时先查看日志，不能把推送成功当作网站已更新。连接仓库、准备工作流与发布真实私人内容是不同的授权范围。
