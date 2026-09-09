import { build } from "esbuild"
import { mkdir, lstat, copyFile } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const output = path.join(root, "quartz/static/topos")
for (const directory of ["quartz", "quartz/static", "quartz/static/topos"]) {
  try {
    if ((await lstat(path.join(root, directory))).isSymbolicLink())
      throw new Error(`Refusing linked Topos runtime: ${directory}`)
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
}
await mkdir(output, { recursive: true })
await build({
  entryPoints: [path.join(root, "quartz/components/scripts/topos/main.ts")],
  outfile: path.join(output, "topos.js"),
  platform: "browser",
  format: "esm",
  target: "es2022",
  bundle: true,
  minify: true,
  legalComments: "eof",
})
await copyFile(
  path.join(root, "node_modules/three/LICENSE"),
  path.join(output, "three-LICENSE.txt"),
)
console.log(
  "Prepared the Knowledge Topos reader for the approved notes and separate demonstration.",
)
