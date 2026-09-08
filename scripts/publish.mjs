import { spawn } from "node:child_process"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { createInterface } from "node:readline/promises"
import { exportVault } from "./export-vault.mjs"
import { verifyManifest } from "./lib/export-boundary.mjs"
import { startPreview } from "./preview.mjs"
import { digest, assertStableReview, assertStagedMatches } from "./lib/publication-review.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const previewOnly = process.argv.includes("--preview-only")
const noOpen = process.argv.includes("--no-open")
const gitProgram =
  process.platform === "win32"
    ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git/cmd/git.exe")
    : "git"
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" }
const knowledgeFiles = [
  "knowledge/registry.json",
  "knowledge/index.json",
  "knowledge/semantic.json",
]
const managed = (file) =>
  file === "publish-manifest.json" || file.startsWith("content/") || knowledgeFiles.includes(file)
const list = (value) => value.split("\0").filter(Boolean)
async function run(
  program,
  args,
  { capture = false, binary = false, input, env = process.env } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: root,
      env,
      windowsHide: true,
      stdio: [
        input === undefined ? "ignore" : "pipe",
        capture ? "pipe" : "inherit",
        capture ? "pipe" : "inherit",
      ],
    })
    const chunks = []
    let stderr = ""
    child.stdout?.on("data", (data) => {
      chunks.push(data)
    })
    child.stderr?.on("data", (data) => {
      stderr += data
    })
    child.once("error", reject)
    child.once("close", (code) =>
      code === 0
        ? resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString("utf8").trimEnd())
        : reject(
            new Error(
              `${path.basename(program)} failed (${code})${stderr ? ": " + stderr.trim() : ""}`,
            ),
          ),
    )
    if (input !== undefined) child.stdin.end(input)
  })
}
const git = (args, options = {}) =>
  run(gitProgram, ["-C", root, ...args], { capture: true, env: gitEnv, ...options })
const node = (args) => run(process.execPath, args)
async function changedPaths() {
  return [
    ...new Set([
      ...list(await git(["diff", "--name-only", "-z"])),
      ...list(await git(["ls-files", "--others", "--exclude-standard", "-z"])),
    ]),
  ]
}
async function checkRepository() {
  if (
    path.resolve(await git(["rev-parse", "--show-toplevel"])).toLowerCase() !==
    path.resolve(root).toLowerCase()
  )
    throw new Error("Git 根目录必须是 website")
  if ((await git(["branch", "--show-current"])) !== "main")
    throw new Error("请先回到 main 分支；此入口不会自动切换分支")
  if (
    !/^https:\/\/github\.com\/MyDearATRI\/World(?:\.git)?\/?$/i.test(
      await git(["remote", "get-url", "origin"]),
    )
  )
    throw new Error("origin 不是已批准的 World 仓库")
  if (list(await git(["diff", "--cached", "--name-only", "-z"])).length)
    throw new Error("已有暂存文件，请先处理它们；此入口不会夹带已有提交内容")
  if (!previewOnly) {
    const unrelated = (await changedPaths()).filter((file) => !managed(file))
    if (unrelated.length)
      throw new Error(`网站代码另有未提交改动，请先单独处理：\n${unrelated.join("\n")}`)
    await git(["fetch", "origin"], { capture: false })
    const [ahead, behind] = (
      await git(["rev-list", "--left-right", "--count", "HEAD...origin/main"])
    )
      .split(/\s+/)
      .map(Number)
    if (ahead) throw new Error("本地有尚未推送的其他提交，请先单独处理")
    if (behind) {
      if ((await changedPaths()).length)
        throw new Error("远端有更新且本地有改动，请先处理；不会自动覆盖")
      await git(["merge", "--ff-only", "origin/main"], { capture: false })
    }
  }
}
let preview, input
try {
  await checkRepository()
  await verifyManifest(root)
  let previous = { notes: [], assets: [] }
  try {
    previous = JSON.parse(await git(["show", "HEAD:publish-manifest.json"]))
  } catch {
    if (await git(["ls-tree", "--name-only", "HEAD", "publish-manifest.json"]))
      throw new Error("无法读取已提交的发布清单")
  }
  const result = await exportVault()
  const review = {
    head: await git(["rev-parse", "HEAD"]),
    manifestHash: digest(await readFile(path.join(root, "publish-manifest.json"))),
    paths: await changedPaths(),
  }
  const before = new Map(
    [...previous.notes, ...previous.assets].map((entry) => [entry.output, entry.outputSha256]),
  )
  const after = new Map(
    [...result.manifest.notes, ...result.manifest.assets].map((entry) => [
      entry.output,
      entry.outputSha256,
    ]),
  )
  const added = [...after.keys()].filter((file) => !before.has(file))
  const modified = [...after.keys()].filter(
    (file) => before.has(file) && before.get(file) !== after.get(file),
  )
  const removed = [...before.keys()].filter((file) => !after.has(file))
  console.log(
    `本次公开范围：${result.manifest.notes.filter((note) => note.kind === "note").length} 篇笔记，${result.manifest.notes.filter((note) => note.kind === "canvas").length} 幅 Canvas，${result.manifest.assets.length} 幅插图。`,
  )
  for (const [label, files] of [
    ["新增", added],
    ["修改", modified],
    ["移除公开副本", removed],
  ])
    console.log(
      `${label} ${files.length}${files.length ? "\n" + files.map((file) => "  " + file).join("\n") : ""}`,
    )
  console.log(
    `排除 ${result.report.excluded.length} 项目录或文件；未建立链接 ${result.report.missingLinks.length} 处。完整清单仅保存在本地 artifacts/export-diagnostics.json。`,
  )
  await mkdir(path.join(root, "artifacts"), { recursive: true })
  await writeFile(
    path.join(root, "artifacts/publication-preview.json"),
    JSON.stringify(
      {
        added,
        modified,
        removed,
        notes: result.manifest.notes.map((note) => ({ source: note.source, output: note.output })),
        excluded: result.report.excluded,
        missingLinks: result.report.missingLinks,
      },
      null,
      2,
    ),
  )
  await node(["node_modules/typescript/bin/tsc", "--noEmit"])
  await node(["scripts/prepare-knowledge.mjs"])
  review.paths = await changedPaths()
  const reviewedKnowledge = Object.fromEntries(
    await Promise.all(
      knowledgeFiles.map(async (file) => [file, digest(await readFile(path.join(root, file)))]),
    ),
  )
  const knowledgeIndex = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"))
  console.log(
    `知识索引：${knowledgeIndex.objects.filter((object) => object.kind === "atom").length} 个原子；${knowledgeIndex.relations.length} 条有出处的联系。完整笔记仍为原文。`,
  )
  await node(["scripts/prepare-assets.mjs"])
  await node([
    "quartz/bootstrap-cli.mjs",
    "build",
    "-d",
    "content",
    "-o",
    "public",
    "--concurrency",
    "2",
  ])
  await node(["scripts/verify-content.mjs"])
  await node(["scripts/verify-knowledge.mjs"])
  preview = await startPreview({ port: 0 })
  const url = preview.url + "/World/"
  console.log(`本地预览：${url}\n清单：${path.join(root, "artifacts/publication-preview.json")}`)
  if (!noOpen && process.platform === "win32")
    await run("powershell.exe", ["-NoProfile", "-Command", `Start-Process '${url}'`])
  if (previewOnly || !process.stdin.isTTY) {
    console.log(
      previewOnly
        ? "仅预览：未提交、未上传。"
        : "未检测到交互终端，停止在预览阶段，未提交、未上传。",
    )
    if (process.stdin.isTTY) {
      input = createInterface({ input: process.stdin, output: process.stdout })
      await input.question("预览完按 Enter 关闭本地服务……")
    }
  } else {
    const changes = await changedPaths()
    if (!changes.length) console.log("公开内容与仓库一致，无需创建提交。")
    else {
      if (changes.some((file) => !managed(file)))
        throw new Error("预览期间出现了非内容改动，请单独处理")
      input = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await input.question(
        "上面的内容将公开到 World。确认发布请输入 PUBLISH，其余输入取消：",
      )
      if (answer.trim() !== "PUBLISH") console.log("已取消发布，本地导出与预览保留。")
      else {
        await verifyManifest(root)
        assertStableReview(review, {
          head: await git(["rev-parse", "HEAD"]),
          manifestHash: digest(await readFile(path.join(root, "publish-manifest.json"))),
          paths: await changedPaths(),
          staged: list(await git(["diff", "--cached", "--name-only", "-z"])),
        })
        const expectedBlobs = Object.fromEntries(
          changes.map((file) => [
            file,
            file === "publish-manifest.json"
              ? review.manifestHash
              : (reviewedKnowledge[file] ?? after.get(file.slice("content/".length)) ?? null),
          ]),
        )
        // NUL-delimited input safely handles Chinese names, spaces, and punctuation.
        await git(["--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"], {
          input: Buffer.from(changes.join("\0") + "\0"),
        })
        const staged = list(await git(["diff", "--cached", "--name-only", "-z"]))
        const stagedBlobs = {}
        for (const file of staged) {
          if (expectedBlobs[file] === null) {
            let exists = false
            try {
              await git(["cat-file", "-e", `:${file}`])
              exists = true
            } catch {}
            stagedBlobs[file] = exists ? "unexpected-present-blob" : null
          } else stagedBlobs[file] = digest(await git(["show", `:${file}`], { binary: true }))
        }
        assertStagedMatches(expectedBlobs, stagedBlobs)
        await verifyManifest(root)
        if (
          digest(await readFile(path.join(root, "publish-manifest.json"))) !== review.manifestHash
        )
          throw new Error("暂存期间预览版本已变化；停止发布")
        await git(
          [
            "commit",
            "-m",
            `Update textbook notes (${result.manifest.notes.filter((note) => note.kind === "note").length} notes)`,
          ],
          { capture: false },
        )
        const sha = await git(["rev-parse", "HEAD"])
        try {
          await git(["push", "origin", "main"], { capture: false })
        } catch (error) {
          throw new Error(
            `本地提交 ${sha} 已保存，但推送失败。连接恢复后在 website 运行 git push origin main；不要重复创建提交。\n${error.message}`,
          )
        }
        let proxy = ""
        try {
          proxy = await git(["config", "--get", "http.proxy"])
        } catch {}
        try {
          await run(process.execPath, ["--use-env-proxy", "scripts/github-status.mjs", sha], {
            env: {
              ...process.env,
              ...(proxy ? { HTTP_PROXY: proxy, HTTPS_PROXY: proxy } : {}),
              NO_PROXY: "localhost,127.0.0.1",
            },
          })
        } catch (error) {
          throw new Error(
            `提交 ${sha} 已成功推送；在线部署状态尚未确认。请查看 https://github.com/MyDearATRI/World/actions 。\n${error.message}`,
          )
        }
      }
    }
  }
} catch (error) {
  console.error(`发布流程停止：${error.message}`)
  process.exitCode = 1
} finally {
  input?.close()
  await preview?.close()
}
