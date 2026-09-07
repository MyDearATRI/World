import assert from "node:assert/strict"
import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const expectedSources = ["index.md", "notes/complete-metric-spaces.md"]
const expectedPages = ["index.html", "notes/complete-metric-spaces.html"]
let checks = 0
function check(condition, message) {
  assert.ok(condition, message)
  checks += 1
  console.log(`PASS ${message}`)
}

// Walk only the explicit synthetic input and generated output, never their parent Vault.
async function filesUnder(directory) {
  const entries = []
  check(!(await lstat(directory)).isSymbolicLink(), `${path.basename(directory)} is not a symlink`)
  async function walk(current, prefix = "") {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const relative = `${prefix}${entry.name}`
      assert.ok(!entry.isSymbolicLink(), `No symlink in ${path.basename(directory)}/${relative}`)
      if (entry.isDirectory()) await walk(path.join(current, entry.name), `${relative}/`)
      else entries.push(relative)
    }
  }
  await walk(directory)
  check(true, `${path.basename(directory)} tree contains no symlinks`)
  return entries.sort()
}

const decode = (value) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
const attributes = (tag) =>
  Object.fromEntries(
    [...tag.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)].map((m) => [m[1], decode(m[2] ?? m[3])]),
  )
const tags = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, "g"))].map((m) => attributes(m[0]))
const hasClass = (attrs, name) => (attrs.class ?? "").split(/\s+/).includes(name)

try {
  const sourceRoot = path.join(root, "content")
  const publicRoot = path.join(root, "public")
  check(
    (await realpath(sourceRoot)) === path.resolve(sourceRoot),
    "Synthetic content is a real project-local directory",
  )
  const sources = await filesUnder(sourceRoot)
  check(
    JSON.stringify(sources) === JSON.stringify(expectedSources),
    "Only the two approved synthetic Markdown sources exist",
  )
  const output = await filesUnder(publicRoot)
  check(
    JSON.stringify(output.filter((file) => file.endsWith(".html"))) ===
      JSON.stringify(expectedPages),
    "Only the two synthetic article HTML pages are published",
  )
  check(
    output.every(
      (file) =>
        expectedPages.includes(file) ||
        /^(?:index\.css|prescript\.js|postscript\.js|static\/contentIndex\.json|static\/fonts\/(?:serif\.css|LICENSE\.txt|files\/[\w-]+\.woff2)|static\/katex\/(?:katex\.min\.css|LICENSE\.txt|fonts\/[\w-]+\.(?:ttf|woff2?)))$/.test(
          file,
        ),
    ),
    "Every generated artifact belongs to the explicit page/resource allowlist",
  )

  const config = await readFile(path.join(root, "quartz.config.ts"), "utf8")
  check(
    !/Plugin\.(?:Assets|CreatedModifiedDate|FolderPage|TagPage|AliasRedirects)\s*\(/.test(config),
    "No unrestricted asset emitter, inferred dates, or additional page emitters",
  )
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"))
  for (const scriptName of ["build", "dev"]) {
    const command = pkg.scripts[scriptName] ?? ""
    check(
      /(?:-d|--directory)(?:=|\s+)content\b/.test(command) &&
        /(?:-o|--output)(?:=|\s+)public\b/.test(command),
      `${scriptName} explicitly uses content and public`,
    )
    check(
      !/\.\.[/\\]|Haru_Math_Physics_Obsidian/.test(command),
      `${scriptName} does not point into the Vault`,
    )
  }
  const htmlByPage = new Map()
  for (const name of expectedPages)
    htmlByPage.set(name, await readFile(path.join(publicRoot, name), "utf8"))
  const home = htmlByPage.get("index.html")
  for (const [name, html] of htmlByPage) {
    const markdown = await readFile(path.join(sourceRoot, name.replace(/\.html$/, ".md")), "utf8")
    const title = markdown.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1]
    check(Boolean(title) && html.includes(title), `${name}: Markdown title reaches rendered HTML`)
    check(
      /synthetic/i.test(markdown) && /synthetic/i.test(html),
      `${name}: source and page identify synthetic material`,
    )
    check(
      /\p{Script=Han}/u.test(markdown) && /\p{Script=Han}/u.test(html),
      `${name}: Chinese remarks survive rendering`,
    )
    check(
      !/^\s*(?:date|created|modified|published|author):/m.test(markdown),
      `${name}: no invented author/date frontmatter`,
    )
    check(
      !/<time\b|article:published_time|datePublished|name="author"/.test(html),
      `${name}: no inferred publication date or author metadata`,
    )
    check(!/katex-error/.test(html), `${name}: no KaTeX error output`)
    check(
      html.includes('class="katex-html"') &&
        html.includes("<math") &&
        html.includes('class="katex-mathml"'),
      `${name}: mathematics includes HTML and MathML`,
    )
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => decode(m[1])))
    const links = tags(html, "a")
    for (const link of links.filter((a) => a.href && !/^(?:https?:|mailto:|tel:)/.test(a.href))) {
      const url = new URL(link.href, `https://example.invalid/${name}`)
      let target = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html"
      if (!path.extname(target)) target = `${target.replace(/\/$/, "")}.html`
      const targetHtml = htmlByPage.get(target)
      check(Boolean(targetHtml), `${name}: local link resolves to approved page ${link.href}`)
      if (url.hash) {
        const id = decodeURIComponent(url.hash.slice(1))
        check(targetHtml.includes(`id="${id}"`), `${name}: anchor exists for ${link.href}`)
      }
    }
    check(
      ids.has("article-content") && /<article\b[^>]*id="article-content"/.test(html),
      `${name}: article has a stable skip-link target`,
    )
    const remote = [...tags(html, "script"), ...tags(html, "link"), ...tags(html, "img")].filter(
      (a) => /^(?:https?:)?\/\//.test(a.src ?? a.href ?? ""),
    )
    check(remote.length === 0, `${name}: scripts, stylesheets, and images are local`)
    for (const resource of [
      ...tags(html, "script").map((a) => a.src),
      ...tags(html, "link")
        .filter((a) => ["stylesheet", "icon", "preload"].includes(a.rel))
        .filter((a) => !(a.rel === "icon" && a.href === "data:,"))
        .map((a) => a.href),
    ].filter(Boolean)) {
      const target = decodeURIComponent(
        new URL(resource, `https://example.invalid/${name}`).pathname,
      ).slice(1)
      check(output.includes(target), `${name}: local resource exists: ${resource}`)
      check(!resource.startsWith("/"), `${name}: resource is repository-subpath safe: ${resource}`)
    }
  }
  for (const type of ["definition", "theorem", "proof-strategy", "example"]) {
    check(
      tags(home, "section").some(
        (a) => hasClass(a, "semantic-block") && a["data-block-type"] === type,
      ),
      `Semantic ${type} section exists`,
    )
  }
  check(
    /Proof strategy\s*(?:—|&mdash;)\s*not a complete proof/.test(home),
    "Proof strategy explicitly identifies itself as incomplete",
  )
  check(
    tags(home, "aside").some((a) => hasClass(a, "sidenote")),
    "Sidenote is a semantic aside",
  )
  check(
    home.indexOf('class="sidenote') > home.indexOf('id="article-content"') &&
      home.indexOf('class="sidenote') < home.indexOf("</article>"),
    "Sidenote preserves article document order",
  )
  const formulas = tags(home, "div").filter((a) => hasClass(a, "math-scroll"))
  check(
    formulas.length >= 3 &&
      formulas.every((a) => a.role === "region" && a.tabindex === "0" && a["aria-label"]),
    "Display formulas have named keyboard-focusable regions",
  )
  check(
    tags(home, "a").some((a) => "data-footnote-ref" in a || (a.href ?? "").includes("fn-")),
    "Footnote references render",
  )
  check(/data-footnote-backref/.test(home), "Footnote return links render")
  check(
    home.includes("reading-toc") && home.includes("mobile-toc"),
    "Desktop and compact heading navigation render",
  )
  const styles = await readFile(path.join(publicRoot, "index.css"), "utf8")
  check(
    !/@import\s+(?:url\()?['"]?https?:/.test(styles),
    "Built stylesheet does not import external resources",
  )
  check(!/url\(\s*['"]?(?:https?:)?\/\//.test(styles), "All stylesheet assets are local")
  console.log(`\nContent verification passed: ${checks} assertions.`)
} catch (error) {
  console.error(`\nContent verification failed after ${checks} passing assertions:`, error.message)
  process.exitCode = 1
}
