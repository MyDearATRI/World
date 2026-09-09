import test from "node:test"
import assert from "node:assert/strict"
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  rm,
  symlink,
  chmod,
  realpath,
  unlink,
} from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  createGit,
  runProcess,
  selectSyncPaths,
  assertSyncPath,
  inspectSyncRepository,
  assertSyncTopology,
  discoverSyncPaths,
  captureSyncReview,
  assertSyncReviewCurrent,
  stageReviewedSync,
  validatePendingSync,
  listGitPaths,
  gitTransportOptions,
  toposSyncFiles,
} from "./lib/site-sync-core.mjs"

const project = fileURLToPath(new URL("../", import.meta.url))
const artifacts = path.join(project, "artifacts")
async function fixture(callback) {
  await mkdir(artifacts, { recursive: true })
  const directory = await mkdtemp(path.join(artifacts, "site-sync-test-"))
  const root = path.join(directory, "website")
  const remote = path.join(directory, "remote.git")
  await mkdir(root)
  const git = createGit(root)
  try {
    await git(["init", "--initial-branch=main"])
    await git(["config", "user.name", "Website sync test"])
    await git(["config", "user.email", "sync-test@example.invalid"])
    await git(["config", "core.autocrlf", "false"])
    await git(["config", "core.filemode", "false"])
    await mkdir(path.join(root, "scripts"))
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 1 }\n")
    await writeFile(path.join(root, "scripts/helper.mjs"), "export const current = 1\n")
    await writeFile(
      path.join(root, "publish-manifest.json"),
      '{"version":1,"notes":[],"assets":[]}\n',
    )
    await git(["add", "quartz.config.ts", "scripts/helper.mjs", "publish-manifest.json"])
    await git(["commit", "-m", "Fixture base"])
    await git(["init", "--bare", "--initial-branch=main", remote])
    await git(["remote", "add", "origin", remote])
    await git(["push", "--set-upstream", "origin", "main"])
    return await callback({ root, remote, directory, git })
  } finally {
    const resolved = await realpath(directory)
    const expectedParent = await realpath(artifacts)
    assert.ok(
      resolved.startsWith(expectedParent + path.sep),
      "test cleanup must stay in generated artifacts",
    )
    assert.ok(path.basename(resolved).startsWith("site-sync-test-"))
    await rm(resolved, { recursive: true, force: true })
  }
}

test("sync policy selects exact new code names and excludes unknown files without reading them", () => {
  const result = selectSyncPaths({
    trackedChanges: ["quartz.config.ts", "knowledge/index.json"],
    untracked: ["scripts/new [draft].mjs", "scripts/new d.mjs", "content/private copy.md", ".env"],
    allowedNewFiles: ["scripts/new [draft].mjs"],
  })
  assert.deepEqual(result.paths, [
    "knowledge/index.json",
    "quartz.config.ts",
    "scripts/new [draft].mjs",
  ])
  assert.deepEqual(result.skipped, [".env", "content/private copy.md", "scripts/new d.mjs"])
  for (const file of [
    "../outside",
    "content/new.md",
    "publish-manifest.json",
    ".env",
    "public/index.html",
    "artifacts/capture.png",
    "knowledge/model.onnx",
    "quartz/static/semantic/worker.js",
    "quartz/static/graph/graph.js",
    "private/key.json",
    "keys/private.pem",
  ])
    assert.throws(() => assertSyncPath(file), undefined, file)
  assert.throws(
    () =>
      selectSyncPaths({ trackedChanges: [], untracked: [], allowedNewFiles: ["scripts/*.mjs"] }),
    /通配符/,
  )
  assert.throws(
    () =>
      selectSyncPaths({
        trackedChanges: [],
        untracked: [],
        allowedNewFiles: ["scripts/A.mjs", "scripts/a.mjs"],
      }),
    /重复/,
  )
})

test("the Topos publication scope exactly matches the reviewed model and explicit new-file list", async () => {
  const model = JSON.parse(
    await readFile(path.join(project, "knowledge/topos/prototype.json"), "utf8"),
  )
  const config = JSON.parse(await readFile(path.join(project, "site-sync.config.json"), "utf8"))
  const expected = [
    "knowledge/topos/prototype.json",
    "knowledge/topos/README.md",
    "knowledge/topos/note-topics.json",
    ...model.sections.map((section) => `knowledge/topos/${section.markdown}`),
  ].sort()
  assert.equal(model.sections.length, 67)
  assert.equal(toposSyncFiles.length, 70)
  assert.deepEqual([...toposSyncFiles].sort(), expected)
  assert.deepEqual(
    config.newFiles.filter((file) => file.startsWith("knowledge/topos/")).sort(),
    expected,
  )
  for (const file of expected) assert.doesNotThrow(() => assertSyncPath(file), file)
  // Existing prepared indices and their narrow supporting configuration retain permission.
  for (const file of [
    "knowledge/index.json",
    "knowledge/registry.json",
    "knowledge/semantic.json",
    "knowledge/overrides.json",
    "knowledge/model-manifest.json",
  ])
    assert.doesNotThrow(() => assertSyncPath(file), file)
})

test("sync paths reject Windows, POSIX and UNC escapes on every runner", () => {
  const rejected = [
    "C:/Users/Someone/private.md",
    "c:/Users/Someone/private.md",
    "Z:/outside.md",
    String.raw`C:\Users\Someone\private.md`,
    "C:private.md",
    "c:private.md",
    "Z:outside/notes.md",
    "C:",
    "/home/someone/private.md",
    "//server/share/private.md",
    String.raw`\\server\share\private.md`,
    String.raw`\\?\C:\Users\Someone\private.md`,
    String.raw`\\?\UNC\server\share\private.md`,
    String.raw`\private.md`,
    String.raw`..\outside.md`,
    String.raw`scripts\helper.mjs`,
    String.raw`scripts/..\outside.md`,
    String.raw`knowledge\topos\sections\group-definition.md`,
  ]
  // These two drive forms are not absolute POSIX paths; rejecting them must not
  // depend on the host-specific path.isAbsolute that previously passed on Windows.
  assert.equal(path.posix.isAbsolute(rejected[0]), false)
  assert.equal(path.posix.isAbsolute("C:private.md"), false)
  assert.equal(path.win32.isAbsolute("C:private.md"), false)
  for (const file of rejected) {
    assert.throws(() => assertSyncPath(file), /相对 POSIX 路径/, file)
    assert.throws(
      () => selectSyncPaths({ trackedChanges: [file], untracked: [], allowedNewFiles: [] }),
      /相对 POSIX 路径/,
      file,
    )
    assert.throws(
      () => selectSyncPaths({ trackedChanges: [], untracked: [file], allowedNewFiles: [file] }),
      /相对 POSIX 路径/,
      file,
    )
  }
  for (const file of [
    "scripts/helper.mjs",
    "docs/同步说明.md",
    "knowledge/topos/sections/group-definition.md",
  ])
    assert.doesNotThrow(() => assertSyncPath(file), file)
})

test("new Topos prose does not authorize unknown notes, model weights, caches or path escapes", () => {
  for (const file of [
    "knowledge/topos/sections/not-approved.md",
    "knowledge/topos/sections/group-definition (1).md",
    "knowledge/topos/notes/private.md",
    "knowledge/topos/cache/result.json",
    "knowledge/topos/model.onnx",
    "knowledge/topos/weights.safetensors",
    "knowledge/topos/sections/../../other-note.md",
    "knowledge/topos/sections/../../../content/private.md",
    "knowledge/topos/sections/../../../../outside.md",
    "knowledge/topos/sections/%2e%2e/private.md",
    "Knowledge/topos/sections/not-approved.md",
    "KNOWLEDGE/private.md",
    "knowledge/notes/private.md",
    "quartz/static/topos/main.js",
    "C:/Users/Someone/private.md",
  ]) {
    assert.throws(() => assertSyncPath(file), undefined, file)
    // Listing a new file in configuration alone cannot widen the bounded content scope.
    assert.throws(
      () => selectSyncPaths({ trackedChanges: [], untracked: [file], allowedNewFiles: [file] }),
      undefined,
      file,
    )
    assert.throws(
      () => selectSyncPaths({ trackedChanges: [file], untracked: [], allowedNewFiles: [] }),
      undefined,
      file,
    )
  }
  assert.deepEqual(
    selectSyncPaths({
      trackedChanges: [],
      untracked: [
        "knowledge/topos/sections/group-definition.md",
        "knowledge/topos/sections/not-approved.md",
      ],
      allowedNewFiles: ["knowledge/topos/sections/group-definition.md"],
    }),
    {
      paths: ["knowledge/topos/sections/group-definition.md"],
      skipped: ["knowledge/topos/sections/not-approved.md"],
    },
  )
})

test("reviewed synthetic Markdown uses exact-byte staging while adjacent unlisted notes remain local", async () =>
  fixture(async ({ root, git }) => {
    const approved = "knowledge/topos/sections/group-definition.md"
    const unapproved = "knowledge/topos/sections/not-approved.md"
    await mkdir(path.join(root, "knowledge/topos/sections"), { recursive: true })
    const original = "Synthetic fixture: a group has an associative operation.\n"
    await writeFile(path.join(root, approved), original)
    await writeFile(path.join(root, unapproved), "Unapproved fixture note; do not stage.\n")
    const config = { newFiles: [approved] }
    const selected = await discoverSyncPaths(git, config)
    assert.deepEqual(selected.paths, [approved])
    assert.deepEqual(selected.skipped, [unapproved])
    const review = await captureSyncReview(root, git, selected.paths)
    await writeFile(path.join(root, approved), original + "Changed after preview.\n")
    await assert.rejects(stageReviewedSync(root, git, config, review))
    assert.equal(await git(["diff", "--cached", "--name-only"]), "")
    await writeFile(path.join(root, approved), original)
    await stageReviewedSync(root, git, config, review)
    assert.deepEqual(listGitPaths(await git(["diff", "--cached", "--name-only", "-z"])), [approved])
    assert.equal(await git(["show", `:${approved}`]), original.trimEnd())
    await assert.rejects(git(["show", `:${unapproved}`]))
  }))

test("Git reuses configured or environment proxies without disabling TLS or changing persistent config", () => {
  const existingProxy = "http://proxy.example.invalid:8080"
  const environment = { HTTPS_PROXY: existingProxy, PATH: "test-path" }
  const original = { ...environment }
  const windows = gitTransportOptions({ platform: "win32", env: environment })
  assert.deepEqual(windows.args, ["-c", "http.sslBackend=openssl"])
  assert.equal(windows.env.https_proxy, existingProxy)
  assert.equal(windows.env.GIT_TERMINAL_PROMPT, "0")
  assert.deepEqual(environment, original)
  assert.deepEqual(
    gitTransportOptions({ platform: "win32", env: {}, configuredProxy: existingProxy }).args,
    windows.args,
  )
  assert.deepEqual(gitTransportOptions({ platform: "win32", env: {} }).args, [])
  assert.deepEqual(gitTransportOptions({ platform: "linux", env: environment }).args, [])
  assert.ok(!JSON.stringify(windows).includes("sslVerify"))
})

test("repository guard checks branch, upstream, both remote URLs and pre-existing staged content", async () =>
  fixture(async ({ root, remote, git }) => {
    await inspectSyncRepository(root, git, { expectedRemote: remote })
    await assert.rejects(inspectSyncRepository(root, git), /World/)
    await git(["config", "remote.origin.pushurl", "https://example.invalid/wrong.git"])
    await assert.rejects(inspectSyncRepository(root, git, { expectedRemote: remote }), /World/)
    await git(["config", "--unset", "remote.origin.pushurl"])
    await git(["switch", "-c", "other"])
    await assert.rejects(inspectSyncRepository(root, git, { expectedRemote: remote }), /main/)
    await git(["switch", "main"])
    await writeFile(path.join(root, "scripts/helper.mjs"), "export const current = 2\n")
    await git(["add", "scripts/helper.mjs"])
    const stagedBefore = await git(["show", ":scripts/helper.mjs"])
    await assert.rejects(inspectSyncRepository(root, git, { expectedRemote: remote }), /暂存/)
    assert.equal(await git(["show", ":scripts/helper.mjs"]), stagedBefore)
  }))

test("reviewed tracked bytes and literal untracked filenames stage exactly, excluding similarly named unknown files", async () =>
  fixture(async ({ root, git }) => {
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 2 }\n")
    await writeFile(path.join(root, "scripts/new [draft].mjs"), "export const approved = true\n")
    await writeFile(path.join(root, "scripts/new d.mjs"), "must not be committed\n")
    const config = { newFiles: ["scripts/new [draft].mjs"] }
    const selected = await discoverSyncPaths(git, config)
    const review = await captureSyncReview(root, git, selected.paths)
    await stageReviewedSync(root, git, config, review)
    assert.deepEqual(
      listGitPaths(await git(["diff", "--cached", "--name-only", "-z"])).sort(),
      selected.paths,
    )
    assert.equal(await git(["show", ":scripts/new [draft].mjs"]), "export const approved = true")
    await assert.rejects(git(["show", ":scripts/new d.mjs"]))
  }))

test("same-path edits after preview stop before staging", async () =>
  fixture(async ({ root, git }) => {
    const config = { newFiles: [] }
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 2 }\n")
    const review = await captureSyncReview(root, git, (await discoverSyncPaths(git, config)).paths)
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 3 }\n")
    await assert.rejects(assertSyncReviewCurrent(root, git, config, review), /预览版本|预览|不等于/)
    await assert.rejects(stageReviewedSync(root, git, config, review))
    assert.equal(await git(["diff", "--cached", "--name-only"]), "")
  }))

test("new staged contamination and an empty review cannot be committed", async () =>
  fixture(async ({ root, git }) => {
    const config = { newFiles: [] }
    const empty = await captureSyncReview(root, git, [])
    await assert.rejects(stageReviewedSync(root, git, config, empty), /空提交/)
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 2 }\n")
    const review = await captureSyncReview(root, git, (await discoverSyncPaths(git, config)).paths)
    await writeFile(path.join(root, "scripts/helper.mjs"), "export const late = 3\n")
    await git(["add", "scripts/helper.mjs"])
    await assert.rejects(stageReviewedSync(root, git, config, review))
    assert.equal(await git(["show", ":scripts/helper.mjs"]), "export const late = 3")
  }))

test("Git newline normalization remains bound to reviewed bytes and file deletion is explicit", async () =>
  fixture(async ({ root, git }) => {
    await git(["config", "core.autocrlf", "true"])
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 2 }\r\n")
    const manifest = await readFile(path.join(root, "publish-manifest.json"), "utf8")
    await writeFile(path.join(root, "publish-manifest.json"), manifest.replace(/\r?\n/g, "\r\n"))
    await unlink(path.join(root, "scripts/helper.mjs"))
    const config = { newFiles: [] }
    const review = await captureSyncReview(root, git, (await discoverSyncPaths(git, config)).paths)
    assert.equal(review.blobs["scripts/helper.mjs"], null)
    await stageReviewedSync(root, git, config, review)
    assert.equal(await git(["rev-parse", ":quartz.config.ts"]), review.blobs["quartz.config.ts"])
    await assert.rejects(git(["show", ":scripts/helper.mjs"]))
    await git(["commit", "-m", "Normalized working copy"])
    await validatePendingSync(
      root,
      git,
      {
        version: 1,
        base: review.head,
        commit: await git(["rev-parse", "HEAD"]),
        paths: review.paths,
        blobs: review.blobs,
        modes: review.modes,
        manifestHash: review.manifestHash,
        manifestBlob: review.manifestBlob,
      },
      review.head,
    )
  }))

test("linked path prefixes are refused before source bytes are read", async (t) =>
  fixture(async ({ root, directory, git }) => {
    const elsewhere = path.join(directory, "elsewhere")
    await mkdir(elsewhere)
    await writeFile(path.join(elsewhere, "file.mjs"), "test fixture only\n")
    try {
      await symlink(
        elsewhere,
        path.join(root, "linked"),
        process.platform === "win32" ? "junction" : "dir",
      )
    } catch (error) {
      if (["EPERM", "EACCES"].includes(error.code)) {
        t.skip("Host disallows creating a fixture link")
        return
      }
      throw error
    }
    await assert.rejects(captureSyncReview(root, git, ["linked/file.mjs"]), /linked/)
  }))

test("branch divergence and unrelated ahead commits cannot be disguised as retries", () => {
  const state = { head: "a".repeat(40), remoteHead: "b".repeat(40), ahead: 1, behind: 0 }
  assert.throws(() => assertSyncTopology(state), /未推送提交/)
  assert.throws(() => assertSyncTopology({ ...state, behind: 1 }), /分叉/)
  assert.throws(
    () =>
      assertSyncTopology({
        ...state,
        ahead: 2,
        pending: { commit: state.head, base: state.remoteHead },
      }),
    /未推送提交/,
  )
  assert.doesNotThrow(() =>
    assertSyncTopology({ ...state, pending: { commit: state.head, base: state.remoteHead } }),
  )
})

test("failed ordinary push can retry the exact verified commit without creating another commit", async () =>
  fixture(async ({ root, remote, git }) => {
    const config = { newFiles: [] }
    await writeFile(path.join(root, "quartz.config.ts"), "export default { value: 2 }\n")
    const review = await captureSyncReview(root, git, (await discoverSyncPaths(git, config)).paths)
    await stageReviewedSync(root, git, config, review)
    await git(["commit", "-m", "Reviewed website update"])
    const commit = await git(["rev-parse", "HEAD"])
    const pending = {
      version: 1,
      base: review.head,
      commit,
      paths: review.paths,
      blobs: review.blobs,
      modes: review.modes,
      manifestHash: review.manifestHash,
      manifestBlob: review.manifestBlob,
    }
    await validatePendingSync(root, git, pending, review.head)
    const hook = path.join(remote, "hooks/pre-receive")
    await writeFile(hook, "#!/bin/sh\nexit 1\n")
    await chmod(hook, 0o755)
    await assert.rejects(git(["push", "origin", `${commit}:refs/heads/main`]))
    assert.equal(await git(["rev-parse", "HEAD"]), commit)
    await validatePendingSync(root, git, pending, review.head)
    await unlink(hook)
    await git(["push", "origin", `${commit}:refs/heads/main`])
    assert.equal(await git(["rev-parse", "origin/main"]), commit)
    assert.equal(await git(["rev-list", "--count", `${review.head}..HEAD`]), "1")
    await validatePendingSync(root, git, pending, commit)
    await assert.rejects(
      validatePendingSync(
        root,
        git,
        { ...pending, paths: [...pending.paths, "private/key.pem"] },
        commit,
      ),
      /范围/,
    )
    await assert.rejects(
      validatePendingSync(
        root,
        git,
        { ...pending, blobs: { ...pending.blobs, "quartz.config.ts": "0".repeat(40) } },
        commit,
      ),
      /内容不匹配/,
    )
  }))

test("entry help is offline, documents confirmation, and rejects an unattended approval flag", async () => {
  const help = await runProcess(project, process.execPath, ["scripts/sync-site.mjs", "--help"], {
    capture: true,
  })
  assert.match(help, /SYNC/)
  assert.match(help, /不运行 Obsidian 导出器/)
  await assert.rejects(
    runProcess(project, process.execPath, ["scripts/sync-site.mjs", "--yes"], { capture: true }),
    /未知参数/,
  )
  const entry = await readFile(path.join(project, "scripts/sync-site.mjs"), "utf8")
  assert.ok(!entry.includes("export-vault"))
})
