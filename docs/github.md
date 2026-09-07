# World 仓库与日常更新

网站使用公开仓库 [MyDearATRI/World](https://github.com/MyDearATRI/World)。本地网站目录已初始化 Git，`origin` 已设置为 `https://github.com/MyDearATRI/World.git`，`main` 已跟踪 `origin/main`。本地现有工程目录叫 `website`，新机器克隆后的默认目录叫 `World`；两者都是网站工程根目录。

本地分支保留了远端已有的 README 初始提交 `54e412c`，网站实现提交为 `153b5cd`；首次公开推送到 `main` 的版本为 `def8717`。Git Credential Manager 已完成设备登录并保存本机凭据。用户已明确批准网站源码与两篇合成样本的公开推送及 Pages 部署，这些操作已完成。网站地址为 [mydearatri.github.io/World/](https://mydearatri.github.io/World/)。

## 哪些文件会进入仓库

Git 的范围仅限网站目录，包括 Quartz 源码、配置、脚本、文档和 `content/` 中批准的内容。父目录的 Obsidian 库、真实源笔记和私人附件不在这个 Git 仓库内。不要在父目录运行 `git init`，也不要通过符号链接、递归复制或更改构建输入把整个库纳入网站。

`.gitignore` 排除了 `node_modules/`、`public/`、生成的字体和 KaTeX 资源、缓存、截图报告、本地环境变量和常见私钥文件。新机器通过安装和构建重新生成需要的资源。不要把令牌、密码或本机密钥写进源码、Markdown、远程 URL 或提交消息。

当前 `scripts/prepare-assets.mjs` 的输入清单只允许 `content/index.md` 和 `content/notes/complete-metric-spaces.md` 两篇合成样本。真实 Obsidian 笔记仍是唯一写作源；新增真实文章应先明确批准笔记、所需链接和附件清单，再实现只读导出，并同步调整输入清单。批准一篇文章不等于批准所有关联笔记或附件。

## 拉取和提交更新

在网站目录打开 PowerShell。现有 `main` 已跟踪 `origin/main`，下面的命令可以用于日常更新。拉取前先处理已有的未提交改动，不要为了拉取而丢弃文件：

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

当前跟踪关系已经设置，在 `main` 上直接 `git push` 即可。推送后 GitHub Actions 会自动构建并更新网站；只在 Obsidian 保存文件不会自动上传。切换机器时，使用 `git clone https://github.com/MyDearATRI/World.git`，进入 `World` 并按照 README 安装依赖。身份认证使用 GitHub 或本机凭据管理器，不在命令和文件中存放令牌。本机网络配置属于本地 Git 配置，不纳入仓库。

不要把 `quartz sync` 当作普通同步命令：本项目固定的 Quartz 版本会自动执行 `git add .` 和 `git push -uf`。`quartz update` 用于引入 Quartz 上游变更，也不等于拉取 World 仓库的日常更新。这里统一使用标准 Git 命令。

## GitHub Pages 自动更新

`.github/workflows/pages.yml` 已上传并启用，配置为向 `main` 推送时触发，也支持 `workflow_dispatch` 手动触发；使用的官方 Actions 版本已核对。`.node-version` 固定为本机验证过的 Node 24.19.0，Quartz `baseUrl` 已设置为 `mydearatri.github.io/World`。仓库 Pages 的发布来源已设为 GitHub Actions（`build_type: workflow`），并启用强制 HTTPS。

向 `main` 推送提交会触发 Actions：根据 npm 锁文件安装依赖、运行检查、从 `content/` 构建 `public/`，再将构建产物部署到 Pages。仓库里维护源码，不提交本机生成的 `public/`。

首次 [Actions 运行 34099696588](https://github.com/MyDearATRI/World/actions/runs/34099696588) 的构建和部署均成功，线上首页返回 HTTP 200，并包含正确的样本标题和 MathML。线上 Edge 在 1440px、1024px、390px 三种视口的检查为 77 项通过、0 项失败，4 张实际截图均已打开检查。每次推送后到仓库的 [Actions 页面](https://github.com/MyDearATRI/World/actions)确认运行结果；构建或部署失败时先查看日志，不能把推送成功当作网站已更新。详细线上浏览器验收记录见 `validation.md`。

当前仍只有两篇合成样本进入公开仓库。真实文章尚未接入：下一步是批准少量笔记及其依赖/附件清单，再实现只读导出。现有网站上线和自动部署不包含读取、上传或公开私人 Vault 的授权。
