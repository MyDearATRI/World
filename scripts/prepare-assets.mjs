import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { copyFile, mkdir, readFile, readdir, lstat } from "node:fs/promises"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
const approved = new Set(["index.md", "notes/complete-metric-spaces.md"])

async function checkInput(directory, prefix = "") {
  if ((await lstat(directory)).isSymbolicLink())
    throw new Error(`Refusing linked content: ${prefix}`)
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name
    if (entry.isSymbolicLink()) throw new Error(`Refusing linked input: ${relative}`)
    if (entry.isDirectory() && relative === "notes")
      await checkInput(path.join(directory, entry.name), "notes/")
    else if (!entry.isFile() || !approved.has(relative))
      throw new Error(`Unapproved phase-one input: ${relative}`)
  }
}

await checkInput(path.join(root, "content"))
for (const name of ["public", ".quartz-cache", "quartz/static"]) {
  try {
    if ((await lstat(path.join(root, name))).isSymbolicLink())
      throw new Error(`Refusing linked output: ${name}`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}

const fontRoot = path.dirname(require.resolve("@fontsource/noto-serif-sc/400.css"))
const fontOutput = path.join(root, "quartz/static/fonts")
await mkdir(path.join(fontOutput, "files"), { recursive: true })
let fontCss = ""
for (const weight of [400, 600])
  fontCss += await readFile(path.join(fontRoot, `${weight}.css`), "utf8")
// Modern browsers use WOFF2; keep the complete Unicode coverage, not a sample-text subset.
fontCss = fontCss.replace(/src:[^;]+;/g, (source) => {
  const fontPath = source.match(/url\(([^)]+\.woff2)\)/)?.[1]
  if (!fontPath) throw new Error("Unexpected Fontsource CSS")
  return `src: url(${fontPath}) format('woff2');`
})
const fontFiles = [
  ...new Set([...fontCss.matchAll(/url\(\.\/files\/([^)]+)\)/g)].map((match) => match[1])),
]
for (const name of fontFiles)
  await copyFile(path.join(fontRoot, "files", name), path.join(fontOutput, "files", name))
const { writeFile } = await import("node:fs/promises")
await writeFile(path.join(fontOutput, "serif.css"), fontCss)
await copyFile(path.join(fontRoot, "LICENSE"), path.join(fontOutput, "LICENSE.txt"))

const rendererRequire = createRequire(require.resolve("rehype-katex"))
const katexRoot = path.dirname(rendererRequire.resolve("katex/package.json"))
const katexOutput = path.join(root, "quartz/static/katex")
await mkdir(path.join(katexOutput, "fonts"), { recursive: true })
await copyFile(path.join(katexRoot, "dist/katex.min.css"), path.join(katexOutput, "katex.min.css"))
for (const name of await readdir(path.join(katexRoot, "dist/fonts"))) {
  await copyFile(path.join(katexRoot, "dist/fonts", name), path.join(katexOutput, "fonts", name))
}
await copyFile(path.join(katexRoot, "LICENSE"), path.join(katexOutput, "LICENSE.txt"))
const katex = JSON.parse(await readFile(path.join(katexRoot, "package.json"), "utf8"))
console.log(
  `Prepared local Noto Serif SC (${fontFiles.length} WOFF2 files) and renderer-matched KaTeX ${katex.version}; input limited to two synthetic notes.`,
)
