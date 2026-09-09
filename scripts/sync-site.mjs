import { readFile, mkdir, writeFile, rename, unlink } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline/promises"
import { verifyManifest, assertUnlinked } from "./lib/export-boundary.mjs"
import { startPreview } from "./preview.mjs"
import {
  createGit,
  runProcess,
  discoverSyncPaths,
  inspectSyncRepository,
  assertSyncTopology,
  captureSyncReview,
  assertSyncReviewCurrent,
  stageReviewedSync,
  validatePendingSync,
  listGitPaths,
} from "./lib/site-sync-core.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const args = process.argv.slice(2)
const previewOnly = args.includes("--preview-only")
const noOpen = args.includes("--no-open")
const git = createGit(root)
const node = (args, options) => runProcess(root, process.execPath, args, options)
const pendingFile = path.join(root, "artifacts/site-sync-pending.json")
let preview, input

async function readPending() {
  try {
    return JSON.parse(await readFile(pendingFile, "utf8"))
  } catch (error) {
    if (error.code === "ENOENT") return undefined
    throw new Error(`无法读取待重试记录：${error.message}`)
  }
}
async function savePending(value) {
  await mkdir(path.join(root, "artifacts"), { recursive: true })
  await assertUnlinked(root, "artifacts")
  await writeFile(pendingFile + ".tmp", JSON.stringify(value, null, 2) + "\n", { mode: 0o600 })
  await rename(pendingFile + ".tmp", pendingFile)
}
async function publicSnapshot() {
  const manifest = await verifyManifest(root, { allowUnmanaged: true })
  const currentBlob = await git(["hash-object", "--path", "publish-manifest.json", "--stdin"], {
    input: await readFile(path.join(root, "publish-manifest.json")),
  })
  if (currentBlob !== (await git(["rev-parse", "HEAD:publish-manifest.json"])))
    throw new Error("公开清单相对 HEAD 已改变；此入口只同步网站工程，笔记更新请用发布博客.cmd")
  if (
    listGitPaths(
      await git([
        "diff",
        "--name-only",
        "--no-renames",
        "-z",
        "HEAD",
        "--",
        "content",
        "publish-manifest.json",
      ]),
    ).length
  )
    throw new Error("公开内容副本相对 HEAD 已改变；此入口不会提交或重导出它们")
  return manifest
}
async function topology(pending) {
  const state = await inspectSyncRepository(root, git)
  const [ahead, behind] = (await git(["rev-list", "--left-right", "--count", "HEAD...origin/main"]))
    .split(/\s+/)
    .map(Number)
  assertSyncTopology({ ...state, ahead, behind, pending })
  return { ...state, ahead, behind }
}
async function runChecks() {
  const commands = [
    ["类型检查", ["node_modules/typescript/bin/tsc", "--noEmit"]],
    ["格式检查", ["node_modules/prettier/bin/prettier.cjs", ".", "--check"]],
    ["单元测试", ["--import", "tsx", "--test"]],
    ["上游版本检查", ["scripts/verify-upstream.mjs"]],
    ["批准资源检查", ["scripts/prepare-assets.mjs"]],
    ["原子索引检查", ["--import", "tsx", "scripts/prepare-atoms.ts", "--check"]],
    ["已准备向量检查", ["scripts/prepare-semantics.mjs", "--check"]],
    ["本地运行资源准备", ["scripts/prepare-semantic-runtime.mjs"]],
    ["关系图运行资源准备", ["scripts/prepare-graph-runtime.mjs"]],
    [
      "正式构建",
      ["quartz/bootstrap-cli.mjs", "build", "-d", "content", "-o", "public", "--concurrency", "2"],
    ],
    ["全量内容检查", ["scripts/verify-content.mjs"]],
    ["原子页面与链接检查", ["scripts/verify-knowledge.mjs"]],
  ]
  // Use the already installed Node and project dependencies; no global npm configuration is required.
  for (const [label, command] of commands) {
    console.log(`\n${label}……`)
    await node(command)
  }
}
async function openPreview() {
  preview = await startPreview({ port: 0 })
  const url = preview.url + "/World/"
  console.log(`本地预览：${url}`)
  if (!noOpen && process.platform === "win32")
    await runProcess(root, "powershell.exe", ["-NoProfile", "-Command", `Start-Process '${url}'`])
}
async function confirm(message) {
  if (previewOnly || !process.stdin.isTTY) {
    console.log(
      previewOnly
        ? "仅预览：没有提交或推送。"
        : "未检测到交互终端，停止在预览阶段；没有提交或推送。",
    )
    if (process.stdin.isTTY) {
      input = createInterface({ input: process.stdin, output: process.stdout })
      await input.question("预览完按 Enter 关闭本地服务……")
    }
    return false
  }
  input = createInterface({ input: process.stdin, output: process.stdout })
  return (await input.question(`${message}\n确认请输入 SYNC，其余输入取消：`)).trim() === "SYNC"
}
async function waitForPages(sha) {
  let proxy = ""
  try {
    proxy = await git(["config", "--get", "http.proxy"])
  } catch {}
  await node(["--use-env-proxy", "scripts/github-status.mjs", sha], {
    env: {
      ...process.env,
      ...(proxy ? { HTTP_PROXY: proxy, HTTPS_PROXY: proxy } : {}),
      NO_PROXY: "localhost,127.0.0.1",
    },
  })
}
async function pushPending(pending) {
  await inspectSyncRepository(root, git)
  await git(["fetch", "--no-tags", "origin", "main"], { capture: false })
  const remoteHead = await git(["rev-parse", "origin/main"])
  await validatePendingSync(root, git, pending, remoteHead)
  if (remoteHead !== pending.commit) {
    try {
      await git(["push", "origin", `${pending.commit}:refs/heads/main`], { capture: false })
    } catch (error) {
      throw new Error(
        `提交 ${pending.commit} 已在本地保存，普通推送未完成。再次双击“同步到GitHub.cmd”可核验并重试同一提交；不会创建空提交或强推。\n${error.message}`,
      )
    }
  }
  await savePending({ ...pending, pushed: true })
  try {
    await waitForPages(pending.commit)
  } catch (error) {
    throw new Error(
      `提交 ${pending.commit} 已推送，部署状态尚未成功确认。重开入口可继续核验；运行详情：https://github.com/MyDearATRI/World/actions\n${error.message}`,
    )
  }
  await unlink(pendingFile)
}

try {
  if (args.includes("--help")) {
    console.log(
      "同步网站工程：双击 同步到GitHub.cmd，或 node scripts/sync-site.mjs\n仅预览：node scripts/sync-site.mjs --preview-only\n新代码文件须逐项登记在 site-sync.config.json 的 newFiles 中。\n本入口不运行 Obsidian 导出器，不提交 content 或 publish-manifest.json；确认 SYNC 后才推送。",
    )
  } else {
    if (args.some((arg) => !["--preview-only", "--no-open"].includes(arg)))
      throw new Error("未知参数；运行 --help 查看入口用法")
    await inspectSyncRepository(root, git)
    await publicSnapshot()
    await git(["fetch", "--no-tags", "origin", "main"], { capture: false })
    let pending = await readPending()
    let state = await topology(pending)
    let config = JSON.parse(await readFile(path.join(root, "site-sync.config.json"), "utf8"))
    if (config.version !== 1) throw new Error("无法识别 site-sync.config.json 版本")
    let selected = await discoverSyncPaths(git, config)
    if (state.behind) {
      const dirty = listGitPaths(await git(["diff", "--name-only", "-z", "HEAD"]))
      if (dirty.length || selected.paths.length)
        throw new Error("远端有更新且本地有改动；停止，不自动覆盖或合并")
      if (previewOnly)
        throw new Error("远端有新提交；仅预览模式不会更新工作目录。请使用普通同步入口先快进更新")
      await git(["merge", "--ff-only", "origin/main"], { capture: false })
      await inspectSyncRepository(root, git)
      await publicSnapshot()
      console.log(
        "已安全快进到远端最新版本。请重新打开同步入口，以使用更新后的工程检查配置；没有创建提交或推送。",
      )
    } else if (state.ahead) {
      await validatePendingSync(root, git, pending, state.remoteHead)
      if (selected.paths.length)
        throw new Error("待重试提交之外还有新改动，请先单独处理；不会夹带进重试提交")
      console.log(
        `将重试已有提交 ${pending.commit}，不创建新提交。\n${pending.paths.map((file) => "  " + file).join("\n")}`,
      )
      await runChecks()
      await openPreview()
      if (await confirm("将上述已确认网站提交同步到 World 并更新线上博客。")) {
        await publicSnapshot()
        await pushPending(pending)
      } else console.log("已取消，待重试提交仍保留在本地。")
    } else if (!selected.paths.length && pending?.commit === state.head) {
      await validatePendingSync(root, git, pending, state.remoteHead)
      if (previewOnly) {
        await runChecks()
        await openPreview()
        await confirm("仅预览已推送版本。")
      } else {
        console.log(`该提交已在远端，继续核验部署：${pending.commit}`)
        await pushPending(pending)
      }
    } else if (!selected.paths.length && !previewOnly) {
      console.log(
        `网站工程没有需要同步的改动，没有创建空提交。${selected.skipped.length ? `\n另有 ${selected.skipped.length} 个未登记文件，保持本地且不会上传。` : ""}`,
      )
    } else {
      const review = await captureSyncReview(root, git, selected.paths)
      console.log(
        `本次网站改动 ${review.paths.length} 个文件：\n${review.paths.map((file) => `  ${review.hashes[file] === null ? "移除" : "新增或修改"} ${file}`).join("\n")}`,
      )
      console.log(
        `沿用既有公开快照；${selected.skipped.length} 个未登记文件保持本地，不会暂存或上传。`,
      )
      await mkdir(path.join(root, "artifacts"), { recursive: true })
      await assertUnlinked(root, "artifacts")
      await writeFile(
        path.join(root, "artifacts/site-sync-review.json"),
        JSON.stringify(review, null, 2) + "\n",
      )
      const patch = review.paths.length
        ? await git([
            "--literal-pathspecs",
            "diff",
            "--no-ext-diff",
            "--binary",
            "HEAD",
            "--",
            ...review.paths,
          ])
        : ""
      await writeFile(path.join(root, "artifacts/site-sync-review.patch"), patch + "\n")
      console.log(
        `版本清单：${path.join(root, "artifacts/site-sync-review.json")}\n已跟踪文件差异：${path.join(root, "artifacts/site-sync-review.patch")}`,
      )
      await runChecks()
      await publicSnapshot()
      await assertSyncReviewCurrent(root, git, config, review)
      await openPreview()
      if (await confirm("将上述网站工程改动公开到 World，并由现有 GitHub Pages 工作流更新博客。")) {
        if (!review.paths.length) console.log("没有改动，不创建空提交。")
        else {
          await inspectSyncRepository(root, git)
          await publicSnapshot()
          await git(["fetch", "--no-tags", "origin", "main"], { capture: false })
          if ((await git(["rev-parse", "origin/main"])) !== review.head)
            throw new Error("预览期间远端已更新；请重新核对，不创建提交或覆盖远端")
          await stageReviewedSync(root, git, config, review)
          await publicSnapshot()
          await git(["commit", "-m", `Update website interface (${review.paths.length} files)`], {
            capture: false,
          })
          pending = {
            version: 1,
            base: review.head,
            commit: await git(["rev-parse", "HEAD"]),
            paths: review.paths,
            manifestHash: review.manifestHash,
            manifestBlob: review.manifestBlob,
            blobs: review.blobs,
            modes: review.modes,
          }
          await savePending(pending)
          await validatePendingSync(root, git, pending, review.head)
          await pushPending(pending)
        }
      } else console.log("已取消；工程改动与本地预览产物保留。")
    }
  }
} catch (error) {
  console.error(`网站同步停止：${error.message}`)
  process.exitCode = 1
} finally {
  input?.close()
  await preview?.close()
}
