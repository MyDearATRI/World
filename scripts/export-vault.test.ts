import test from "node:test"
import type { TestContext } from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
// @ts-expect-error The exporter is native Node ESM; its behavior is checked by these fixtures.
import { exportVault } from "./export-vault.mjs"
// @ts-expect-error Native Node ESM boundary helpers are exercised below.
import { verifyManifest, sha256 } from "./lib/export-boundary.mjs"
// @ts-expect-error Native Node ESM Markdown adapter is exercised below.
import { normalizeDisplayMath, normalizeTableMath } from "./lib/export-markdown.mjs"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import remarkGfm from "remark-gfm"
import { visit } from "unist-util-visit"
import katex from "katex"

async function fixture(t: TestContext) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "world-export-test-"))
  t.after(async () => {
    assert.ok(path.basename(directory).startsWith("world-export-test-"))
    await rm(directory, { recursive: true, force: true })
  })
  const root = path.join(directory, "site"),
    sourceRoot = path.join(directory, "vault")
  await mkdir(root)
  await mkdir(sourceRoot)
  async function source(relative: string, value: string) {
    const absolute = path.join(sourceRoot, relative)
    await mkdir(path.dirname(absolute), { recursive: true })
    await writeFile(absolute, value)
  }
  const config = {
    version: 1,
    sourceRoot: "../vault",
    home: "首页.md",
    excludeDirectories: ["website", "Prompts", "Templates"],
    excludeFiles: ["AGENTS.md", "更新日志.md"],
    excludeLinkTitles: ["知识笔记"],
    imageExtensions: [".svg", ".png"],
    respectPrivateMetadata: true,
  }
  await source("首页.md", "# Home\n\n[[notes/One|Read]]\n")
  await source(
    "notes/One.md",
    "---\nstatus: 已整理\nlayer: Working\naliases: [First]\n---\n# First note\n\nActual content.\n",
  )
  const run = () => exportVault({ root, sourceRoot, config, diagnostics: false })
  return { directory, root, sourceRoot, config, source, run }
}

test("exports approved notes and referenced images, omits private inputs, and is idempotent", async (t) => {
  const f = await fixture(t)
  await f.source(
    "首页.md",
    "# Home\n\n[[First|Read]]\n\n![[assets/figure.svg]]\n\n[[Book.pdf#page=7|Source]] [[Prompts/rules]] [[missing]]\n",
  )
  await f.source(
    "assets/figure.svg",
    '<svg xmlns="http://www.w3.org/2000/svg"><text>Figure</text></svg>',
  )
  await f.source("assets/not-referenced.svg", "Never publish me")
  await f.source("Book.pdf", "Never publish this source book")
  await f.source("Prompts/rules.md", "Do not publish instructions")
  await f.source(".obsidian/private.md", "Do not publish settings")
  await f.source("private.md", "---\nprivate: true\n---\nNot approved\n")
  const original = await readFile(path.join(f.sourceRoot, "首页.md"))
  const first = await f.run()
  assert.equal(first.manifest.notes.length, 2)
  assert.equal(first.manifest.assets.length, 1)
  const text = await readFile(path.join(f.root, "content/index.md"), "utf8")
  assert.match(text, /title: Home/)
  assert.doesNotMatch(text, /^# Home$/m)
  assert.match(text, /\[\[notes\/One\|Read\]\]/)
  assert.match(text, /第 7 页.*未公开/)
  assert.match(text, /尚未建立/)
  assert.doesNotMatch(
    JSON.stringify(first.manifest),
    /private\.md|Book\.pdf|Prompts|not-referenced/,
  )
  assert.deepEqual(await readFile(path.join(f.sourceRoot, "首页.md")), original)
  const second = await f.run()
  assert.equal(second.changed, 0)
  assert.deepEqual(first.manifest, second.manifest)
  await verifyManifest(f.root)
})

test("read-only snapshot checks allow unrelated copies but publication remains strict", async (t) => {
  const f = await fixture(t)
  await f.run()
  const extra = path.join(f.root, "content/unapproved copy.md")
  await writeFile(extra, "unreviewed material")
  const manifest = await verifyManifest(f.root, { allowUnmanaged: true })
  assert.equal(manifest.notes.length, 2)
  await assert.rejects(verifyManifest(f.root), /outside the publication manifest/)
  assert.equal(await readFile(extra, "utf8"), "unreviewed material")
  await writeFile(path.join(f.root, "content/index.md"), "changed approved content")
  await assert.rejects(verifyManifest(f.root, { allowUnmanaged: true }), /changed/)
})

test("production rules exclude the local atlas workspace and master prompt without hiding mathematical examples", async (t) => {
  const f = await fixture(t)
  const production = JSON.parse(
    await readFile(new URL("../publish.config.json", import.meta.url), "utf8"),
  )
  await f.source("MASTER_PROMPT_v2.md", "Private charter; not publication content")
  await f.source("Mathematics-Frontier-Atlas/00_META/charter.md", "Private copied charter")
  await f.source("Mathematics-Frontier-Atlas/00_META/logs/session.md", "Private process log")
  await f.source(
    "Mathematics-Frontier-Atlas/06_Topology_and_Homotopy/objects/test.md",
    "Unapproved atlas draft",
  )
  await f.source("notes/Example.md", "# A mathematical example\n\nKeep this readable.\n")
  const before = await readFile(path.join(f.sourceRoot, "MASTER_PROMPT_v2.md"))
  const exported = await exportVault({
    root: f.root,
    sourceRoot: f.sourceRoot,
    config: production,
    diagnostics: false,
  })
  assert.equal(exported.manifest.notes.length, 3)
  assert.ok(
    exported.manifest.notes.some(
      (entry: { source: string }) => entry.source === "notes/Example.md",
    ),
  )
  assert.doesNotMatch(JSON.stringify(exported.manifest), /MASTER_PROMPT|Mathematics-Frontier-Atlas/)
  assert.deepEqual(await readFile(path.join(f.sourceRoot, "MASTER_PROMPT_v2.md")), before)
  await verifyManifest(f.root)
})

test("preserves source metadata and block embeds without rewriting code examples", async (t) => {
  const f = await fixture(t)
  await f.source("首页.md", "# Home\n\n![[First#^claim]]\n\n```markdown\n[[missing]]\n```\n")
  await f.run()
  const text = await readFile(path.join(f.root, "content/index.md"), "utf8")
  assert.match(text, /!\[\[notes\/One#\^claim\|First\]\]/)
  assert.match(text, /```markdown\n\[\[missing\]\]\n```/)
  const note = await readFile(path.join(f.root, "content/notes/One.md"), "utf8")
  assert.match(note, /status: 已整理/)
  assert.match(note, /layer: Working/)
  assert.match(note, /siteKind: body/)
  assert.doesNotMatch(note, /published:/)
})

test("refuses unknown content and refuses to overwrite an edited managed copy", async (t) => {
  const f = await fixture(t)
  await f.run()
  await writeFile(path.join(f.root, "content/unknown.md"), "User content")
  await assert.rejects(f.run(), /outside the publication manifest/)
  await rm(path.join(f.root, "content/unknown.md"))
  await writeFile(path.join(f.root, "content/index.md"), "User edited copy")
  await assert.rejects(f.run(), /Publication copy changed/)
  assert.equal(await readFile(path.join(f.root, "content/index.md"), "utf8"), "User edited copy")
})

test("ambiguous basenames and escaping links stop export", async (t) => {
  const f = await fixture(t)
  await f.source("a/Duplicate.md", "# A")
  await f.source("b/Duplicate.md", "# B")
  await f.source("首页.md", "# Home\n\n[[Duplicate]]")
  await assert.rejects(f.run(), /Ambiguous note link/)
  await f.source("首页.md", "# Home\n\n[[../../outside]]")
  await assert.rejects(f.run(), /escapes the publication source/)
})

test("ignores linked source directories and refuses a linked content directory", async (t) => {
  const f = await fixture(t)
  const outside = path.join(f.directory, "outside")
  await mkdir(outside)
  await writeFile(path.join(outside, "secret.md"), "Unapproved data")
  try {
    await symlink(outside, path.join(f.sourceRoot, "linked"), "junction")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") {
      t.skip("Host denies symlink creation")
      return
    }
    throw error
  }
  const result = await f.run()
  assert.ok(
    result.manifest.notes.every((note: { source: string }) => !note.source.startsWith("linked/")),
  )
  await rm(path.join(f.root, "content"), { recursive: true })
  await symlink(outside, path.join(f.root, "content"), "junction")
  await assert.rejects(f.run(), /linked/)
  assert.equal(await readFile(path.join(outside, "secret.md"), "utf8"), "Unapproved data")
})

test("Canvas becomes a safe diagram page with complete text and approved links", async (t) => {
  const f = await fixture(t)
  const text = "<script>alert(1)</script> A long explanation that remains readable."
  await f.source("首页.md", "# Home\n\n![[map.canvas]]")
  await f.source(
    "map.canvas",
    JSON.stringify({
      nodes: [
        { id: "a", type: "file", file: "notes/One.md", x: 0, y: 0, width: 200, height: 100 },
        { id: "b", type: "text", text, x: 300, y: 0, width: 200, height: 100 },
        { id: "g", type: "group", label: "Group", x: -10, y: -20, width: 550, height: 200 },
      ],
      edges: [
        { id: "ab", fromNode: "a", fromSide: "right", toNode: "b", toSide: "left", label: "uses" },
      ],
    }),
  )
  const result = await f.run()
  const canvas = result.manifest.notes.find((note: { kind: string }) => note.kind === "canvas")!
  const output = await readFile(path.join(f.root, "content", canvas.output), "utf8")
  assert.match(output, /<svg/)
  assert.match(output, /marker-end=/)
  assert.match(output, /href="\.\.\/notes\/One"/)
  assert.match(output, /A long explanation that remains readable/)
  assert.match(output, /Directed connections/)
  assert.doesNotMatch(output, /<script>/)
  assert.match(output, /siteKind: canvas/)
  assert.ok(
    result.manifest.assets.every((asset: { source: string }) => !asset.source.endsWith(".canvas")),
  )
})

test("replaces only verified managed copies when sources change or disappear", async (t) => {
  const f = await fixture(t)
  await f.run()
  await f.source("首页.md", "---\ntitle: Explicit title\n---\n# Other heading\n\nUpdated source.")
  await rm(path.join(f.sourceRoot, "notes/One.md"))
  const updated = await f.run()
  assert.equal(updated.manifest.notes.length, 1)
  const text = await readFile(path.join(f.root, "content/index.md"), "utf8")
  assert.match(text, /title: Explicit title/)
  assert.doesNotMatch(text, /^# Other heading$/m)
  assert.match(text, /Updated source/)
  await assert.rejects(readFile(path.join(f.root, "content/notes/One.md")), /ENOENT/)
  assert.equal((await f.run()).changed, 0)
})

test("unsafe SVG resources stop publication", async (t) => {
  const f = await fixture(t)
  await f.source("首页.md", "# Home\n\n![[bad.svg]]")
  await f.source("bad.svg", "<svg><script>alert(1)</script></svg>")
  await assert.rejects(f.run(), /SVG requires a safe publication copy/)
})

test("normalizes Obsidian display-math closers without modifying mathematical content", () => {
  const raw =
    "$$\na_n = \\frac{1}{n}.$$\n\nThe next paragraph has $n$.\n\n```md\n$$ keep this $$\n```"
  const fixed = normalizeDisplayMath(raw)
  assert.match(fixed, /a_n = \\frac\{1\}\{n\}\.\n\$\$/)
  assert.match(fixed, /```md\n\$\$ keep this \$\$\n```/)
  let formulas = 0
  visit(unified().use(remarkParse).use(remarkMath).parse(fixed), (node) => {
    if (node.type === "math" || node.type === "inlineMath") {
      katex.renderToString(node.value, { throwOnError: true })
      formulas++
    }
  })
  assert.equal(formulas, 2)
  assert.equal(sha256(normalizeDisplayMath(fixed)), sha256(fixed))
})

test("normalizes a multiline display whose opening and closing delimiters share formula lines", () => {
  const raw = "$$a_n = \\frac{1}{n}\\qquad\nb_n=2.$$\n\nFollowing prose has $n$."
  const fixed = normalizeDisplayMath(raw)
  let formulas = 0
  visit(unified().use(remarkParse).use(remarkMath).parse(fixed), (node) => {
    if (node.type === "math" || node.type === "inlineMath") {
      katex.renderToString(node.value, { throwOnError: true })
      formulas++
    }
  })
  assert.equal(formulas, 2)
  assert.match(fixed, /^\$\$\na_n/)
  assert.match(fixed, /b_n=2\.\n\$\$/)
  assert.equal(normalizeDisplayMath(fixed), fixed)
})

test("preserves absolute values and norms inside GFM table formulas", () => {
  const raw = "| Statement | Bound |\n| --- | --- |\n| Bessel | $\\sum_j|a_j|^2\\le\\|y\\|^2$ |\n"
  const fixed = normalizeTableMath(raw)
  let formulas = 0
  visit(unified().use(remarkParse).use(remarkGfm).use(remarkMath).parse(fixed), (node) => {
    if (node.type === "inlineMath") {
      assert.equal(node.value, "\\sum_j\\vert a_j\\vert ^2\\le\\Vert y\\Vert ^2")
      katex.renderToString(node.value, { throwOnError: true })
      formulas++
    }
  })
  assert.equal(formulas, 1)
  assert.equal(normalizeTableMath(fixed), fixed)
})
