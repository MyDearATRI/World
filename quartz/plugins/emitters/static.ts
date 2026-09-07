import { FilePath, QUARTZ, joinSegments } from "../../util/path"
import { QuartzEmitterPlugin } from "../types"
import fs from "fs"
import { globby } from "globby"
import { dirname } from "path"

export const Static: QuartzEmitterPlugin = () => ({
  name: "Static",
  async *emit({ argv, cfg }) {
    const staticPath = joinSegments(QUARTZ, "static")
    // These build resources are deliberately absent from Git. Respecting .gitignore
    // here would remove all prose and math fonts as soon as Git is initialized.
    // Keep the source bounded to the package assets prepared for this website.
    const fps = await globby(
      [
        "fonts/serif.css",
        "fonts/LICENSE.txt",
        "fonts/files/*.woff2",
        "katex/katex.min.css",
        "katex/LICENSE.txt",
        "katex/fonts/*.{ttf,woff,woff2}",
      ],
      {
        cwd: staticPath,
        ignore: cfg.configuration.ignorePatterns,
        gitignore: false,
        followSymbolicLinks: false,
        onlyFiles: true,
      },
    )
    const outputStaticPath = joinSegments(argv.output, "static")
    await fs.promises.mkdir(outputStaticPath, { recursive: true })
    for (const fp of fps) {
      const src = joinSegments(staticPath, fp) as FilePath
      const dest = joinSegments(outputStaticPath, fp) as FilePath
      await fs.promises.mkdir(dirname(dest), { recursive: true })
      await fs.promises.copyFile(src, dest)
      yield dest
    }
  },
  async *partialEmit() {},
})
