import fs from "node:fs/promises"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

// Official public metadata only. No credentials, project content, code execution,
// dependency installation or remote mutation is involved.
const output = fileURLToPath(new URL("official-research.json", import.meta.url))
const records = []
const sha256 = (data) => crypto.createHash("sha256").update(data).digest("hex")
async function read(url) {
  const startedAt = new Date().toISOString()
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "World-Phase0-Audit", Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
    })
    const text = await response.text()
    const record = {
      url,
      startedAt,
      status: response.status,
      bytes: Buffer.byteLength(text),
      sha256: sha256(text),
    }
    records.push(record)
    if (!response.ok) {
      record.error = text.slice(0, 500)
      return null
    }
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  } catch (error) {
    records.push({
      url,
      startedAt,
      status: null,
      error: error.message,
      cause: error.cause?.code ?? null,
    })
    return null
  }
}
const repositoryNames = [
  "leanprover/lean4",
  "leanprover/verso",
  "leanprover/subverso",
  "leanprover/vscode-lean4",
  "hhu-adam/lean4monaco",
  "leanprover-community/lean4web",
  "leanprover-community/ProofWidgets4",
  "PatrickMassot/leanblueprint",
  "leanprover-community/mathlib4",
  "leanprover/doc-gen4",
]
const repositories = []
for (const repo of repositoryNames) {
  const base = `https://api.github.com/repos/${repo}`
  const metadata = await read(base)
  if (!metadata) {
    repositories.push({ repo, status: "EXTERNAL_RESEARCH_BLOCKED" })
    continue
  }
  const [commits, releases] = await Promise.all([
    read(`${base}/commits?per_page=1`),
    read(`${base}/releases?per_page=1`),
  ])
  const commit = commits?.[0]
  const release = releases?.[0]
  const result = {
    repo,
    url: metadata.html_url,
    license: metadata.license?.spdx_id ?? null,
    archived: metadata.archived,
    defaultBranch: metadata.default_branch,
    pushedAt: metadata.pushed_at,
    commit: commit?.sha ?? null,
    commitDate: commit?.commit?.committer?.date ?? null,
    release: release
      ? {
          tag: release.tag_name,
          prerelease: release.prerelease,
          publishedAt: release.published_at,
          url: release.html_url,
        }
      : null,
  }
  if (result.commit) {
    const prefix = `https://raw.githubusercontent.com/${repo}/${result.commit}`
    if (
      [
        "leanprover/lean4",
        "leanprover/verso",
        "leanprover/subverso",
        "leanprover-community/ProofWidgets4",
        "leanprover-community/mathlib4",
        "leanprover/doc-gen4",
      ].includes(repo)
    )
      result.toolchain = await read(`${prefix}/lean-toolchain`)
    const readme = await read(`${prefix}/README.md`)
    result.readmeEvidence =
      typeof readme === "string"
        ? {
            url: `${prefix}/README.md`,
            sha256: sha256(readme),
            headings: readme
              .split(/\r?\n/u)
              .filter((line) => /^#{1,3}\s/u.test(line))
              .slice(0, 30),
          }
        : null
    const license = await read(`${prefix}/LICENSE`)
    if (typeof license === "string")
      result.licenseEvidence = {
        url: `${prefix}/LICENSE`,
        sha256: sha256(license),
        firstLines: license.split(/\r?\n/u).slice(0, 4),
      }
  }
  repositories.push(result)
}
const npmNames = [
  "@leanprover/infoview",
  "lean4monaco",
  "pixi.js",
  "sigma",
  "graphology",
  "d3-force",
  "d3-force-3d",
  "three",
  "react",
  "motion",
  "katex",
  "preact",
  "npm",
]
const packages = []
for (const name of npmNames) {
  const data = await read(`https://registry.npmjs.org/${encodeURIComponent(name)}`)
  const version = data?.["dist-tags"]?.latest
  const pkg = data?.versions?.[version]
  packages.push({
    name,
    version: version ?? null,
    publishedAt: version ? (data.time?.[version] ?? null) : null,
    license: pkg?.license ?? null,
    repository: pkg?.repository ?? null,
    engines: pkg?.engines ?? null,
    peerDependencies: pkg?.peerDependencies ?? null,
    integrity: pkg?.dist?.integrity ?? null,
    status: pkg ? "OBSERVED" : "EXTERNAL_RESEARCH_BLOCKED",
  })
}
const blueprint = await read("https://pypi.org/pypi/leanblueprint/json")
const pypi = blueprint
  ? {
      name: "leanblueprint",
      version: blueprint.info.version,
      license: blueprint.info.license,
      classifiers: blueprint.info.classifiers.filter((x) => x.startsWith("License")),
      publishedAt: blueprint.urls?.[0]?.upload_time_iso_8601,
      fileDigests: blueprint.urls.map((x) => ({ filename: x.filename, sha256: x.digests.sha256 })),
    }
  : null
const leanStable = await read("https://api.github.com/repos/leanprover/lean4/releases/latest")
const ci = await read("https://api.github.com/repos/MyDearATRI/World/actions/runs?per_page=3")
const runs =
  ci?.workflow_runs?.map((run) => ({
    id: run.id,
    name: run.name,
    headSha: run.head_sha,
    status: run.status,
    conclusion: run.conclusion,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    htmlUrl: run.html_url,
  })) ?? null
const online = await read("https://mydearatri.github.io/World/")
const result = {
  schemaVersion: 1,
  recordedAt: new Date().toISOString(),
  method:
    "Read-only unauthenticated official HTTPS metadata using approved network access; public package names only",
  repositories,
  packages,
  pypi,
  leanStable: leanStable
    ? { tag: leanStable.tag_name, publishedAt: leanStable.published_at, url: leanStable.html_url }
    : null,
  ciRuns: runs,
  onlineHome:
    typeof online === "string"
      ? { sha256: sha256(online), bytes: Buffer.byteLength(online) }
      : null,
  records,
}
await fs.writeFile(output, JSON.stringify(result, null, 2) + "\n")
console.log(
  JSON.stringify(
    {
      output,
      repositories: repositories.map(({ repo, commit, license, release }) => ({
        repo,
        commit,
        license,
        release,
      })),
      packages,
      pypi,
      ciRuns: runs,
      failedRequests: records.filter((r) => r.status !== 200),
    },
    null,
    2,
  ),
)
