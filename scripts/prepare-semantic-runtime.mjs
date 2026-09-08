import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { build } from "esbuild"

const root = fileURLToPath(new URL("../", import.meta.url))
const require = createRequire(import.meta.url)
const output = path.join(root, "quartz/static/semantic")
try {
  if ((await lstat(output)).isSymbolicLink()) throw new Error("Refusing linked semantic runtime")
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
await mkdir(output, { recursive: true })
const transformerRoot = path.resolve(
  path.dirname(require.resolve("@huggingface/transformers")),
  "..",
)
const packageInfo = JSON.parse(await readFile(path.join(transformerRoot, "package.json"), "utf8"))
if (packageInfo.version !== "3.8.1") throw new Error("Expected Transformers.js 3.8.1")
const manifest = JSON.parse(
  await readFile(path.join(root, "knowledge/model-manifest.json"), "utf8"),
)
await build({
  entryPoints: [path.join(root, "quartz/components/scripts/semanticWorker.ts")],
  outfile: path.join(output, "worker.js"),
  platform: "browser",
  format: "esm",
  target: "es2022",
  bundle: true,
  minify: true,
  legalComments: "eof",
})
await copyFile(
  path.join(transformerRoot, "dist/transformers.min.js"),
  path.join(output, "transformers.js"),
)
await copyFile(path.join(transformerRoot, "LICENSE"), path.join(output, "TRANSFORMERS-LICENSE.txt"))
const ortRoot = path.dirname(require.resolve("onnxruntime-web"))
for (const name of ["ort-wasm-simd-threaded.jsep.mjs", "ort-wasm-simd-threaded.jsep.wasm"])
  await copyFile(path.join(ortRoot, name), path.join(output, name))
await copyFile(path.join(root, "knowledge/ONNX-LICENSE.txt"), path.join(output, "ONNX-LICENSE.txt"))
await writeFile(path.join(output, "model-manifest.json"), JSON.stringify(manifest))
console.log(
  `Prepared on-demand semantic Worker and local Transformers.js ${packageInfo.version}; no model weights copied to public assets.`,
)
