import { spawn } from "node:child_process"
import { readFile, lstat } from "node:fs/promises"
import path from "node:path"
import { assertUnlinked, contained } from "./export-boundary.mjs"
import { digest, assertStableReview, assertStagedMatches } from "./publication-review.mjs"

export const approvedRepository = "https://github.com/MyDearATRI/World.git"
export const derivedSyncFiles = [
  "knowledge/registry.json",
  "knowledge/index.json",
  "knowledge/semantic.json",
]
// This website-authored prototype is an explicit publication scope. Do not infer
// permission from a directory glob or from a newly edited model's file list.
export const toposSyncFiles = Object.freeze([
  "knowledge/topos/README.md",
  "knowledge/topos/prototype.json",
  "knowledge/topos/sections/action-definition.md",
  "knowledge/topos/sections/action-example.md",
  "knowledge/topos/sections/action-overview.md",
  "knowledge/topos/sections/character-definition.md",
  "knowledge/topos/sections/character-example.md",
  "knowledge/topos/sections/character-overview.md",
  "knowledge/topos/sections/general-linear-group-definition.md",
  "knowledge/topos/sections/general-linear-group-example.md",
  "knowledge/topos/sections/general-linear-group-overview.md",
  "knowledge/topos/sections/group-algebra-definition.md",
  "knowledge/topos/sections/group-algebra-example.md",
  "knowledge/topos/sections/group-algebra-overview.md",
  "knowledge/topos/sections/group-associativity.md",
  "knowledge/topos/sections/group-definition.md",
  "knowledge/topos/sections/group-example.md",
  "knowledge/topos/sections/group-overview.md",
  "knowledge/topos/sections/homomorphism-definition.md",
  "knowledge/topos/sections/homomorphism-example.md",
  "knowledge/topos/sections/homomorphism-overview.md",
  "knowledge/topos/sections/intertwiner-definition.md",
  "knowledge/topos/sections/intertwiner-example.md",
  "knowledge/topos/sections/intertwiner-overview.md",
  "knowledge/topos/sections/invariant-subspace-definition.md",
  "knowledge/topos/sections/invariant-subspace-example.md",
  "knowledge/topos/sections/invariant-subspace-overview.md",
  "knowledge/topos/sections/irreducible-representation-definition.md",
  "knowledge/topos/sections/irreducible-representation-example.md",
  "knowledge/topos/sections/irreducible-representation-overview.md",
  "knowledge/topos/sections/linear-map-definition.md",
  "knowledge/topos/sections/linear-map-example.md",
  "knowledge/topos/sections/linear-map-overview.md",
  "knowledge/topos/sections/module-definition.md",
  "knowledge/topos/sections/module-example.md",
  "knowledge/topos/sections/module-overview.md",
  "knowledge/topos/sections/normal-subgroup-definition.md",
  "knowledge/topos/sections/normal-subgroup-example.md",
  "knowledge/topos/sections/normal-subgroup-overview.md",
  "knowledge/topos/sections/orbit-definition.md",
  "knowledge/topos/sections/orbit-example.md",
  "knowledge/topos/sections/orbit-overview.md",
  "knowledge/topos/sections/permutation-group-definition.md",
  "knowledge/topos/sections/permutation-group-example.md",
  "knowledge/topos/sections/permutation-group-overview.md",
  "knowledge/topos/sections/permutation-representation-definition.md",
  "knowledge/topos/sections/permutation-representation-example.md",
  "knowledge/topos/sections/permutation-representation-overview.md",
  "knowledge/topos/sections/quotient-definition.md",
  "knowledge/topos/sections/quotient-example.md",
  "knowledge/topos/sections/quotient-overview.md",
  "knowledge/topos/sections/representation-definition.md",
  "knowledge/topos/sections/representation-example.md",
  "knowledge/topos/sections/representation-overview.md",
  "knowledge/topos/sections/representation-theory-definition.md",
  "knowledge/topos/sections/representation-theory-example.md",
  "knowledge/topos/sections/representation-theory-overview.md",
  "knowledge/topos/sections/stabilizer-definition.md",
  "knowledge/topos/sections/stabilizer-example.md",
  "knowledge/topos/sections/stabilizer-overview.md",
  "knowledge/topos/sections/subgroup-definition.md",
  "knowledge/topos/sections/subgroup-example.md",
  "knowledge/topos/sections/subgroup-overview.md",
  "knowledge/topos/sections/symmetry-definition.md",
  "knowledge/topos/sections/symmetry-example.md",
  "knowledge/topos/sections/symmetry-overview.md",
  "knowledge/topos/sections/vector-space-definition.md",
  "knowledge/topos/sections/vector-space-example.md",
  "knowledge/topos/sections/vector-space-overview.md",
])
export const listGitPaths = (value) => value.split("\0").filter(Boolean)
export function gitTransportOptions({ platform, env, configuredProxy = "" }) {
  const inherited = { ...env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" }
  for (const name of ["https_proxy", "http_proxy", "all_proxy", "no_proxy"])
    if (!inherited[name] && inherited[name.toUpperCase()])
      inherited[name] = inherited[name.toUpperCase()]
  const proxied = Boolean(
    configuredProxy || inherited.https_proxy || inherited.http_proxy || inherited.all_proxy,
  )
  return {
    // Git for Windows ships OpenSSL too. Scope this workaround to proxied commands;
    // certificate verification stays enabled and no persistent Git config is changed.
    args: platform === "win32" && proxied ? ["-c", "http.sslBackend=openssl"] : [],
    env: inherited,
  }
}
const normalizedRemote = (value) =>
  value
    .replace(/\.git\/?$/i, "")
    .replace(/\/$/, "")
    .toLowerCase()
const sameSet = (left, right) =>
  left.length === right.length && left.every((item) => right.includes(item))

export function runProcess(
  root,
  program,
  args,
  { capture = false, binary = false, input, env = process.env } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: root,
      env,
      windowsHide: true,
      shell: false,
      stdio: [
        input === undefined ? "ignore" : "pipe",
        capture ? "pipe" : "inherit",
        capture ? "pipe" : "inherit",
      ],
    })
    const output = []
    let stderr = ""
    child.stdout?.on("data", (data) => output.push(data))
    child.stderr?.on("data", (data) => {
      stderr += data
    })
    child.once("error", reject)
    child.once("close", (code) =>
      code === 0
        ? resolve(binary ? Buffer.concat(output) : Buffer.concat(output).toString("utf8").trimEnd())
        : reject(
            new Error(
              `${path.basename(program)} failed (${code})${stderr ? `: ${stderr.trim()}` : ""}`,
            ),
          ),
    )
    if (input !== undefined) child.stdin.end(input)
  })
}
export function createGit(root) {
  const gitProgram =
    process.platform === "win32"
      ? path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Git/cmd/git.exe")
      : "git"
  return async (args, options = {}) => {
    let configuredProxy = ""
    const network = args.some((arg) => ["fetch", "push", "ls-remote"].includes(arg))
    if (network) {
      try {
        configuredProxy = await runProcess(
          root,
          gitProgram,
          ["-C", root, "config", "--get-urlmatch", "http.proxy", approvedRepository],
          { capture: true },
        )
      } catch {}
    }
    const transport = gitTransportOptions({
      platform: process.platform,
      env: options.env ?? process.env,
      configuredProxy,
    })
    return runProcess(root, gitProgram, ["-C", root, ...(network ? transport.args : []), ...args], {
      capture: true,
      ...options,
      env: transport.env,
    })
  }
}

export function assertSyncPath(file) {
  // Git/config paths must have the same meaning on Windows and the Linux runner.
  // win32.isAbsolute does not reject drive-relative paths such as C:notes.md.
  if (
    typeof file !== "string" ||
    path.posix.isAbsolute(file) ||
    path.win32.isAbsolute(file) ||
    /^[a-z]:/i.test(file) ||
    file.includes("\\")
  )
    throw new Error(`同步清单必须使用仓库内的相对 POSIX 路径：${file}`)
  contained(path.resolve("."), file)
  if (/[\x00-\x1f\x7f]/u.test(file)) throw new Error(`不支持控制字符路径：${JSON.stringify(file)}`)
  if (/^(?:content(?:\/|$)|publish-manifest\.json$)/i.test(file))
    throw new Error(`此入口不提交笔记快照：${file}；笔记更新请使用发布博客.cmd`)
  if (
    /(?:^|\/)(?:\.git|\.obsidian|\.codex|\.agents|\.cache|\.quartz-cache|\.setup|node_modules|public|artifacts|private)(?:\/|$)/i.test(
      file,
    ) ||
    /^quartz\/static\/(?:fonts|katex|semantic|graph|topos)(?:\/|$)/i.test(file) ||
    /(?:^|\/)(?:\.env(?:\..*)?|id_rsa|id_ed25519|credentials(?:\.[^/]+)?|secrets?(?:\.[^/]+)?)$/i.test(
      file,
    ) ||
    /\.(?:pdf|pem|key|p12|pfx|onnx|safetensors|pt|bin|zip|7z|bak)$/i.test(file)
  )
    throw new Error(`不属于网站工程同步范围：${file}`)
  if (
    /^knowledge\//i.test(file) &&
    !derivedSyncFiles.includes(file) &&
    !toposSyncFiles.includes(file) &&
    !["knowledge/overrides.json", "knowledge/model-manifest.json"].includes(file)
  )
    throw new Error(`未列明的知识派生文件：${file}`)
}

export function selectSyncPaths({ trackedChanges, untracked, allowedNewFiles }) {
  if (!Array.isArray(allowedNewFiles) || allowedNewFiles.some((file) => typeof file !== "string"))
    throw new Error("site-sync.config.json 的 newFiles 必须是明确的文件路径列表")
  const allowed = new Set()
  for (const file of allowedNewFiles) {
    assertSyncPath(file)
    if (/[?*]/.test(file) || allowed.has(file.toLowerCase()))
      throw new Error(`新文件清单不允许通配符或重复项：${file}`)
    allowed.add(file.toLowerCase())
  }
  for (const file of trackedChanges) assertSyncPath(file)
  const selectedNew = untracked.filter((file) => allowedNewFiles.includes(file))
  for (const file of selectedNew) assertSyncPath(file)
  return {
    paths: [...new Set([...trackedChanges, ...selectedNew])].sort(),
    skipped: untracked.filter((file) => !selectedNew.includes(file)).sort(),
  }
}

export async function discoverSyncPaths(git, config) {
  const trackedChanges = listGitPaths(
    await git(["diff", "--name-only", "--no-renames", "-z", "HEAD"]),
  )
  const untracked = listGitPaths(await git(["ls-files", "--others", "--exclude-standard", "-z"]))
  return selectSyncPaths({ trackedChanges, untracked, allowedNewFiles: config.newFiles })
}

export function assertSyncTopology({ ahead, behind, head, remoteHead, pending }) {
  if (!Number.isInteger(ahead) || !Number.isInteger(behind) || ahead < 0 || behind < 0)
    throw new Error("无法判断本地和远端分支关系")
  if (ahead && behind) throw new Error("本地与远端已有分叉；停止，不自动合并或强制推送")
  if (ahead && !(ahead === 1 && pending?.commit === head && pending?.base === remoteHead))
    throw new Error("本地有不属于本入口待重试记录的未推送提交；请先单独检查")
}

export async function inspectSyncRepository(
  root,
  git,
  { expectedRemote = approvedRepository } = {},
) {
  if (
    path.resolve(await git(["rev-parse", "--show-toplevel"])).toLowerCase() !==
    path.resolve(root).toLowerCase()
  )
    throw new Error("Git 根目录必须是 website")
  if ((await git(["branch", "--show-current"])) !== "main")
    throw new Error("请先回到 main；此入口不会自动切换分支")
  if (
    (await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])) !==
    "origin/main"
  )
    throw new Error("main 必须跟踪 origin/main")
  const fetchUrls = (await git(["remote", "get-url", "--all", "origin"])).split(/\r?\n/)
  const pushUrls = (await git(["remote", "get-url", "--push", "--all", "origin"])).split(/\r?\n/)
  if (
    fetchUrls.length !== 1 ||
    pushUrls.length !== 1 ||
    [...fetchUrls, ...pushUrls].some(
      (url) => normalizedRemote(url) !== normalizedRemote(expectedRemote),
    )
  )
    throw new Error("origin 的读取或推送地址不是已批准的 World 仓库")
  if (listGitPaths(await git(["diff", "--cached", "--name-only", "-z"])).length)
    throw new Error("已有暂存文件，请先处理；不会夹带、覆盖或清空现有暂存内容")
  if (listGitPaths(await git(["ls-files", "--unmerged", "-z"])).length)
    throw new Error("仓库存在尚未解决的冲突")
  for (const name of [
    "MERGE_HEAD",
    "CHERRY_PICK_HEAD",
    "REVERT_HEAD",
    "rebase-merge",
    "rebase-apply",
  ]) {
    const gitPath = await git(["rev-parse", "--git-path", name])
    try {
      await lstat(path.resolve(root, gitPath))
      throw new Error(`仓库有未完成的 Git 操作：${name}`)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
    }
  }
  return {
    head: await git(["rev-parse", "HEAD"]),
    remoteHead: await git(["rev-parse", "origin/main"]),
  }
}

async function readSyncBytes(root, file) {
  const absolute = contained(root, file)
  try {
    const status = await lstat(absolute)
    if (!status.isFile() || status.isSymbolicLink()) throw new Error(`只同步普通文件：${file}`)
    await assertUnlinked(root, file)
    return await readFile(absolute)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    const parent = file.split("/").slice(0, -1).join("/")
    if (parent) {
      try {
        await assertUnlinked(root, parent)
      } catch (parentError) {
        if (parentError.code !== "ENOENT") throw parentError
      }
    }
    return null
  }
}

export async function captureSyncReview(root, git, paths) {
  const blobs = {},
    hashes = {},
    modes = {}
  for (const file of paths) {
    assertSyncPath(file)
    const bytes = await readSyncBytes(root, file)
    hashes[file] = bytes === null ? null : digest(bytes)
    blobs[file] =
      bytes === null
        ? null
        : await git(["hash-object", "--path", file, "--stdin"], { input: bytes })
    const tracked = listGitPaths(
      await git(["--literal-pathspecs", "ls-files", "--stage", "-z", "--", file]),
    )[0]
    const previousMode = tracked?.split(" ")[0]
    if (previousMode && !["100644", "100755"].includes(previousMode))
      throw new Error(`不支持链接或子模块：${file}`)
    modes[file] = bytes === null ? null : (previousMode ?? "100644")
  }
  const manifestBytes = await readFile(path.join(root, "publish-manifest.json"))
  return {
    version: 1,
    head: await git(["rev-parse", "HEAD"]),
    manifestHash: digest(manifestBytes),
    manifestBlob: await git(["hash-object", "--path", "publish-manifest.json", "--stdin"], {
      input: manifestBytes,
    }),
    paths: [...paths],
    hashes,
    blobs,
    modes,
  }
}

export async function assertSyncReviewCurrent(root, git, config, review) {
  const selected = await discoverSyncPaths(git, config)
  const current = await captureSyncReview(root, git, selected.paths)
  assertStableReview(review, {
    ...current,
    staged: listGitPaths(await git(["diff", "--cached", "--name-only", "-z"])),
  })
  assertStagedMatches(review.hashes, current.hashes)
  assertStagedMatches(review.blobs, current.blobs)
  assertStagedMatches(review.modes, current.modes)
  if (review.manifestBlob !== current.manifestBlob)
    throw new Error("预览期间公开清单的 Git 内容发生变化")
}

export async function stageReviewedSync(root, git, config, review) {
  if (!review.paths.length) throw new Error("没有可提交改动，不创建空提交")
  await assertSyncReviewCurrent(root, git, config, review)
  await git(["--literal-pathspecs", "add", "--pathspec-from-file=-", "--pathspec-file-nul"], {
    input: Buffer.from(review.paths.join("\0") + "\0"),
  })
  const staged = listGitPaths(await git(["diff", "--cached", "--name-only", "--no-renames", "-z"]))
  const blobs = {},
    modes = {}
  for (const file of staged) {
    const entry = listGitPaths(
      await git(["--literal-pathspecs", "ls-files", "--stage", "-z", "--", file]),
    )[0]
    if (!entry) {
      blobs[file] = null
      modes[file] = null
    } else {
      const [mode, oid] = entry.split(" ")
      blobs[file] = oid
      modes[file] = mode
    }
    const bytes = await readSyncBytes(root, file)
    if ((bytes === null ? null : digest(bytes)) !== review.hashes[file])
      throw new Error(`暂存期间文件变化：${file}；停止，保留暂存现场`)
  }
  assertStagedMatches(review.blobs, blobs)
  assertStagedMatches(review.modes, modes)
  if (
    (await git(["rev-parse", "HEAD"])) !== review.head ||
    digest(await readFile(path.join(root, "publish-manifest.json"))) !== review.manifestHash
  )
    throw new Error("暂存期间版本或公开快照变化；停止，保留暂存现场")
}

export async function validatePendingSync(root, git, pending, remoteHead) {
  if (
    !pending ||
    pending.version !== 1 ||
    !/^[a-f0-9]{40}$/.test(pending.commit ?? "") ||
    !/^[a-f0-9]{40}$/.test(pending.base ?? "") ||
    !Array.isArray(pending.paths) ||
    !pending.paths.length
  )
    throw new Error("待重试记录无效；未执行推送")
  const head = await git(["rev-parse", "HEAD"])
  if (head !== pending.commit) throw new Error("本地 HEAD 已不等于待重试提交；请先单独检查")
  const parents = (await git(["rev-list", "--parents", "-n", "1", head])).split(" ")
  if (
    parents.length !== 2 ||
    parents[1] !== pending.base ||
    ![pending.base, pending.commit].includes(remoteHead)
  )
    throw new Error("待重试提交与远端基线不匹配；不会夹带其他提交")
  const changed = listGitPaths(
    await git(["diff", "--name-only", "--no-renames", "-z", pending.base, pending.commit]),
  )
  if (!sameSet(changed, pending.paths)) throw new Error("待重试提交的文件范围不等于已确认范围")
  for (const file of changed) {
    assertSyncPath(file)
    const entry = listGitPaths(
      await git(["--literal-pathspecs", "ls-tree", "-z", pending.commit, "--", file]),
    )[0]
    const [mode, , oid] = entry?.split(/[ \t]/) ?? []
    if ((oid ?? null) !== pending.blobs?.[file] || (mode ?? null) !== pending.modes?.[file])
      throw new Error(`待重试提交内容不匹配：${file}`)
  }
  if (
    (await git(["rev-parse", `${pending.commit}:publish-manifest.json`])) !==
      pending.manifestBlob ||
    digest(await readFile(path.join(root, "publish-manifest.json"))) !== pending.manifestHash
  )
    throw new Error("待重试公开快照与已确认版本不一致")
  return pending
}
