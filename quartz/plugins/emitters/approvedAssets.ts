import { readFile, realpath, mkdir, copyFile } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import type { QuartzEmitterPlugin } from "../types"
import type { FilePath } from "../../util/path"

/** Copy only the hash-verified attachment files in the committed publication manifest. */
export const ApprovedAssets: QuartzEmitterPlugin = () => ({
  name: "ApprovedAssets",
  async *emit({ argv }) {
    const manifest = JSON.parse(await readFile("publish-manifest.json", "utf8")) as {
      assets: { output: string; outputSha256: string }[]
    }
    const input = path.resolve(argv.directory)
    const output = path.resolve(argv.output)
    if ((await realpath(input)) !== input || (await realpath(output)) !== output)
      throw new Error("Asset directories cannot be symbolic links")
    for (const asset of manifest.assets) {
      if (!/^assets\/[\w.-]+$/.test(asset.output) || /\.\./.test(asset.output))
        throw new Error(`Invalid approved asset path: ${asset.output}`)
      const source = path.resolve(input, asset.output),
        destination = path.resolve(output, asset.output)
      if ((await realpath(source)) !== source) throw new Error("Linked attachment is not allowed")
      const data = await readFile(source)
      if (createHash("sha256").update(data).digest("hex") !== asset.outputSha256)
        throw new Error(`Attachment changed after export: ${asset.output}`)
      await mkdir(path.dirname(destination), { recursive: true })
      await copyFile(source, destination)
      yield destination as FilePath
    }
  },
})
