import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
const root = fileURLToPath(new URL("../", import.meta.url))
for (const args of [
  ["--import", "tsx", "scripts/prepare-atoms.ts"],
  ["--use-env-proxy", "scripts/prepare-semantics.mjs"],
  ["scripts/prepare-semantic-runtime.mjs"],
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      windowsHide: true,
    })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${args.at(-1)} failed (${code})`)),
    )
  })
}
