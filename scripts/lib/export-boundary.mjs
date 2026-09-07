import { createHash } from "node:crypto"
import { lstat, readdir, readFile, realpath } from "node:fs/promises"
import path from "node:path"

export const sha256 = (value) => createHash("sha256").update(value).digest("hex")
export const posix = (value) => value.replaceAll("\\", "/")
export function contained(root, relative) {
  if (!relative || path.isAbsolute(relative) || relative.includes("\\"))
    throw new Error(`Expected a relative POSIX path: ${relative}`)
  const parts = relative.split("/")
  if (parts.some((part) => !part || part === "." || part === ".."))
    throw new Error(`Unsafe relative path: ${relative}`)
  const result = path.resolve(root, ...parts)
  if (!result.startsWith(path.resolve(root) + path.sep)) throw new Error("Path escapes root")
  return result
}

export async function assertUnlinked(root, relative = "") {
  const canonicalRoot = await realpath(root)
  if (path.resolve(canonicalRoot).toLowerCase() !== path.resolve(root).toLowerCase())
    throw new Error("Refusing a linked root")
  const parts = relative ? relative.split("/") : []
  let current = root
  for (const part of parts) {
    current = path.join(current, part)
    const stat = await lstat(current)
    if (stat.isSymbolicLink()) throw new Error(`Refusing a linked path: ${relative}`)
  }
  if ((await lstat(root)).isSymbolicLink()) throw new Error("Refusing a linked root")
}

export async function listFiles(root) {
  await assertUnlinked(root)
  const result = []
  async function walk(directory, prefix = "") {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name
      if (entry.isSymbolicLink()) throw new Error(`Refusing linked content: ${relative}`)
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), relative + "/")
      else if (entry.isFile()) result.push(relative)
      else throw new Error(`Unsupported content entry: ${relative}`)
    }
  }
  await walk(root)
  return result.sort()
}

export async function verifyManifest(root) {
  const manifest = JSON.parse(await readFile(path.join(root, "publish-manifest.json"), "utf8"))
  if (manifest.version !== 1 || !Array.isArray(manifest.notes) || !Array.isArray(manifest.assets))
    throw new Error("Invalid publication manifest")
  const approved = [...manifest.notes, ...manifest.assets]
  const expected = new Set()
  for (const entry of approved) {
    contained(root, entry.source)
    const output = contained(path.join(root, "content"), entry.output)
    if (expected.has(entry.output)) throw new Error(`Duplicate manifest output: ${entry.output}`)
    expected.add(entry.output)
    await assertUnlinked(path.join(root, "content"), entry.output)
    if (sha256(await readFile(output)) !== entry.outputSha256)
      throw new Error(`Publication copy changed; export it again: ${entry.output}`)
  }
  const actual = await listFiles(path.join(root, "content"))
  if (actual.length !== expected.size || actual.some((file) => !expected.has(file)))
    throw new Error("Content contains files outside the publication manifest")
  return manifest
}
