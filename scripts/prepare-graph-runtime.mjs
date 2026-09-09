import { build } from "esbuild"
import { mkdir, lstat, readFile, copyFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const output = path.join(root, "quartz/static/graph")
for (const directory of ["quartz", "quartz/static", "quartz/static/graph"]) {
  try {
    if ((await lstat(path.join(root, directory))).isSymbolicLink())
      throw new Error(`Refusing linked graph runtime: ${directory}`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}
await mkdir(output, { recursive: true })
for (const [name, version] of [
  ["three", "0.185.1"],
  ["d3-force-3d", "3.0.6"],
]) {
  const packageRoot = path.join(root, "node_modules", name)
  const actual = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"))
  if (actual.version !== version) throw new Error(`Expected ${name} ${version}`)
  await copyFile(path.join(packageRoot, "LICENSE"), path.join(output, `${name}-LICENSE.txt`))
}
await build({
  entryPoints: [path.join(root, "quartz/components/scripts/knowledgeGraph3d.ts")],
  outfile: path.join(output, "knowledgeGraph3d.js"),
  platform: "browser",
  format: "esm",
  target: "es2022",
  bundle: true,
  minify: true,
  legalComments: "eof",
})
console.log("Prepared on-demand Three.js 0.185.1 and d3-force-3d 3.0.6; no model weights included.")
