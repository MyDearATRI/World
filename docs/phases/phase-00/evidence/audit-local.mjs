import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"
import crypto from "node:crypto"
import { spawnSync } from "node:child_process"
import { fileURLToPath, pathToFileURL } from "node:url"

// Read-only project/environment inventory. Only these Phase 0 reports are written.
const root = fileURLToPath(new URL("../../../../", import.meta.url))
const output = path.join(root, "docs/phases/phase-00/evidence")
const sanitize = (text) =>
  String(text)
    .replaceAll(root, "<PROJECT>")
    .replaceAll(os.homedir(), "<USERPROFILE>")
    .replaceAll(JSON.stringify(root).slice(1, -1), "<PROJECT>")
    .replaceAll(JSON.stringify(os.homedir()).slice(1, -1), "<USERPROFILE>")
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex")
const digest = async (name) => {
  try {
    const data = await fs.readFile(path.resolve(root, name))
    return { path: name.replaceAll("\\", "/"), bytes: data.length, sha256: sha256(data) }
  } catch (error) {
    return { path: name, error: error.code }
  }
}
const commands = []
function command(program, args, timeout = 20000) {
  const startedAt = new Date().toISOString()
  const result = spawnSync(program, args, {
    cwd: root,
    encoding: "utf8",
    timeout,
    windowsHide: true,
  })
  const entry = {
    program: sanitize(program),
    args,
    startedAt,
    finishedAt: new Date().toISOString(),
    exitCode: result.status,
    signal: result.signal,
    error: result.error?.code ?? null,
    stdout: sanitize(result.stdout ?? ""),
    stderr: sanitize(result.stderr ?? ""),
  }
  commands.push(entry)
  return entry
}
const ps = (code) => command("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", code])
const inventory = ps(
  "$names='node','npm','npx','pnpm','git','lean','lake','elan','docker','wsl'; $items=foreach($name in $names){$c=Get-Command $name -ErrorAction SilentlyContinue; [pscustomobject]@{name=$name;found=[bool]$c;path=if($c){$c.Source}else{$null}}}; ConvertTo-Json -InputObject @($items)",
)
const discovered = JSON.parse(inventory.stdout.replace(/^\uFEFF/u, ""))
command(process.execPath, ["--version"])
ps("pnpm --version")
command("git", ["--version"])
const gitHead = command("git", ["rev-parse", "HEAD"]).stdout.trim()
const dirty = command("git", ["status", "--porcelain=v1", "--untracked-files=all"]).stdout
const tracked = command("git", ["ls-files", "-z"]).stdout.split("\0").filter(Boolean)
const untracked = command("git", ["ls-files", "--others", "--exclude-standard", "-z"])
  .stdout.split("\0")
  .filter(Boolean)
command("git", ["remote", "get-url", "origin"])
ps("elan --version; elan toolchain list")
// Do not run lean/lake shims: without an installed toolchain they may download one.
const wslStartedAt = new Date().toISOString()
const wslRaw = spawnSync("wsl.exe", ["--list", "--quiet"], {
  cwd: root,
  timeout: 15000,
  windowsHide: true,
})
const wsl = {
  program: "wsl.exe",
  args: ["--list", "--quiet"],
  startedAt: wslStartedAt,
  finishedAt: new Date().toISOString(),
  exitCode: wslRaw.status,
  stdout: wslRaw.stdout?.toString("utf16le") ?? "",
  stderr: wslRaw.stderr?.toString("utf16le") ?? "",
  error: wslRaw.error?.code ?? null,
}
commands.push(wsl)
const edge = ps(
  "$p='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; if(Test-Path -LiteralPath $p){(Get-Item -LiteralPath $p).VersionInfo.ProductVersion}else{'NOT_DISCOVERED'}",
)
command(process.execPath, ["--check", "scripts/preview.mjs"])
command(process.execPath, ["--check", "quartz/bootstrap-cli.mjs"])
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"))
const lock = JSON.parse(await fs.readFile(path.join(root, "package-lock.json"), "utf8"))
const dependencies = await Promise.all(
  Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).map(async ([name, declared]) => {
    let installed = null
    try {
      installed = JSON.parse(
        await fs.readFile(path.join(root, "node_modules", name, "package.json"), "utf8"),
      ).version
    } catch {}
    const locked = lock.packages[`node_modules/${name}`]
    return {
      name,
      declared,
      locked: locked?.version ?? null,
      installed,
      license: locked?.license ?? null,
      integrity: locked?.integrity ?? null,
    }
  }),
)
const npmCandidates = [
  path.resolve(path.dirname(process.execPath), "../node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
]
for (const npm of npmCandidates) {
  try {
    await fs.access(npm)
    command(process.execPath, [npm, "--version"])
    break
  } catch {}
}
const knowledge = JSON.parse(await fs.readFile(path.join(root, "knowledge/index.json"), "utf8"))
const manifest = JSON.parse(await fs.readFile(path.join(root, "publish-manifest.json"), "utf8"))
const countBy = (xs, field) =>
  Object.fromEntries(
    [...new Set(xs.map((x) => x[field]))].map((value) => [
      value ?? "undefined",
      xs.filter((x) => x[field] === value).length,
    ]),
  )
// Code, dependency lock, approved snapshot and build inputs have a separate digest
// from the audit documents: a report cannot include its own hash recursively.
const sourceRoots = [
  ".github/",
  "quartz/",
  "scripts/",
  "tests/",
  "knowledge/",
  "ontology/",
  "content/",
]
const sourceTopLevel = [
  "package.json",
  "package-lock.json",
  ".node-version",
  ".npmrc",
  ".gitattributes",
  ".gitignore",
  ".prettierrc",
  ".prettierignore",
  "globals.d.ts",
  "index.d.ts",
  "tsconfig.json",
  "quartz.config.ts",
  "quartz.layout.ts",
  "reader.config.ts",
  "publish.config.json",
  "publish-manifest.json",
]
const sourceFiles = [...new Set([...tracked, ...untracked])]
  .filter(
    (name) =>
      sourceRoots.some((prefix) => name.startsWith(prefix)) || sourceTopLevel.includes(name),
  )
  .sort()
const sourceHashes = await Promise.all(sourceFiles.map(digest))
const leanPaths = tracked.filter((name) =>
  /(?:^|\/)(?:lean-toolchain|lakefile\.(?:lean|toml)|lake-manifest\.json)$|\.lean$/u.test(name),
)
const attachments = [
  ["project/docs/MASTER_PROMPT.md", path.join(root, "docs/MASTER_PROMPT.md")],
  ["vault/docs/MASTER_PROMPT.md", path.resolve(root, "../docs/MASTER_PROMPT.md")],
  ["vault/MASTER_PROMPT.md", path.resolve(root, "../MASTER_PROMPT.md")],
  [
    "provided-interaction-spec",
    path.join(
      os.homedir(),
      ".codex/attachments/9a424511-ea86-4a8d-932a-47a904e7f768/pasted-text-1.txt",
    ),
  ],
  [
    "provided-graph-blog-spec",
    path.join(
      os.homedir(),
      ".codex/attachments/841ba0dc-5c98-468e-8fda-1350a8ecebb3/pasted-text.txt",
    ),
  ],
]
const inputs = []
for (const [name, file] of attachments) {
  try {
    const bytes = await fs.readFile(file)
    const text = bytes.toString("utf8")
    inputs.push({
      name,
      exists: true,
      bytes: bytes.length,
      sha256: sha256(bytes),
      firstLine: text.split(/\r?\n/u)[0],
      containsMasterTitle: /MASTER ENGINEERING PROMPT/u.test(text),
      headingCount: text.split(/\r?\n/u).filter((line) => /^#{1,6}\s/u.test(line)).length,
    })
  } catch (error) {
    inputs.push({ name, exists: false, error: error.code })
  }
}
const directNetwork = []
for (const url of [
  "https://api.github.com/repos/leanprover/lean4/releases/latest",
  "https://registry.npmjs.org/katex/latest",
  "https://mydearatri.github.io/World/",
]) {
  const start = new Date().toISOString()
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "World-Phase0-Audit" },
    })
    const body = await response.text()
    directNetwork.push({
      url,
      start,
      status: response.status,
      bytes: Buffer.byteLength(body),
      sha256: sha256(body),
    })
  } catch (error) {
    directNetwork.push({
      url,
      start,
      status: null,
      error: error.message,
      cause: error.cause?.code ?? null,
    })
  }
}
const previewChecks = []
let preview
try {
  const { startPreview } = await import(pathToFileURL(path.join(root, "scripts/preview.mjs")))
  preview = await startPreview({ port: 0 })
  for (const route of ["/", "/World/", "/World/atoms/a-000067.html", "/World/library.html"]) {
    const response = await fetch(`${preview.url}${route}`)
    const body = await response.text()
    previewChecks.push({
      route,
      status: response.status,
      bytes: Buffer.byteLength(body),
      sha256: sha256(body),
      mathML: /<math[\s>]/u.test(body),
    })
  }
} catch (error) {
  previewChecks.push({ error: error.message })
} finally {
  await preview?.close()
}
const report = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  project: "World website",
  scope:
    "Explicit website files and named input attachments only; no fresh Vault export or toolchain installation",
  sourceRevision: gitHead,
  sourceManifestSha256: sha256(JSON.stringify(sourceHashes)),
  sourceManifestScope: {
    roots: sourceRoots,
    topLevel: sourceTopLevel,
    excludes:
      "docs,README,site-sync.config and audit evidence are separately reviewed delivery records; artifacts/public/node_modules are derived or local resources",
  },
  dependencyLock: await digest("package-lock.json"),
  roadmap: await digest("../PHASE_ROADMAP.md"),
  inputs,
  dirty,
  environment: {
    platform: process.platform,
    release: os.release(),
    architecture: process.arch,
    node: process.version,
    cpus: os
      .cpus()
      .map(({ model }) => model)
      .filter((x, i, xs) => xs.indexOf(x) === i),
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
    edgeVersion: edge.stdout.trim(),
    gpuDriver: null,
    gpuDriverLimitation:
      "CIM read attempt returned Access denied; no escalation for hardware metadata",
    tools: discovered,
    wsl: { exitCode: wsl.exitCode, stdout: wsl.stdout, stderr: wsl.stderr },
  },
  repository: {
    trackedFiles: tracked.length,
    topLevel: await fs.readdir(root),
    leanProjectFiles: leanPaths,
    package: { name: pkg.name, version: pkg.version, engines: pkg.engines, scripts: pkg.scripts },
    dependencies,
  },
  content: {
    snapshotHash: knowledge.snapshotHash,
    objects: knowledge.objects.length,
    objectKinds: countBy(knowledge.objects, "kind"),
    mathTypes: countBy(knowledge.objects, "type"),
    relations: knowledge.relations.length,
    relationTypes: countBy(knowledge.relations, "type"),
    provenance: countBy(knowledge.relations, "provenance"),
    manifestNotes: manifest.notes.length,
    manifestAssets: manifest.assets?.length ?? null,
  },
  directNetwork,
  previewChecks,
  commands,
}
await fs.mkdir(output, { recursive: true })
await fs.writeFile(path.join(output, "local-audit.json"), JSON.stringify(report, null, 2) + "\n")
await fs.writeFile(
  path.join(output, "source-file-hashes.json"),
  JSON.stringify(sourceHashes, null, 2) + "\n",
)
console.log(
  JSON.stringify(
    {
      output: "docs/phases/phase-00/evidence/local-audit.json",
      sourceFiles: sourceHashes.length,
      objects: knowledge.objects.length,
      leanFiles: leanPaths.length,
      previewChecks,
      directNetwork,
    },
    null,
    2,
  ),
)
