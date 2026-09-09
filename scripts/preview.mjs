import { createServer } from "node:http"
import { readFile, realpath, stat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const projectRoot = fileURLToPath(new URL("../", import.meta.url))
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
}

/** Serve one artifact at root and simulated Pages paths without reading outside public. */
export async function startPreview({ port = 8081, host = "127.0.0.1" } = {}) {
  const expectedRoot = path.resolve(projectRoot, "public")
  const publicRoot = await realpath(expectedRoot)
  if (publicRoot !== expectedRoot) {
    throw new Error("The preview requires a real website/public directory, not a symlink")
  }
  const server = createServer(async (request, response) => {
    const fail = (status, message) => {
      response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" })
      response.end(message)
    }
    if (!["GET", "HEAD"].includes(request.method)) return fail(405, "Method not allowed")
    let pathname
    try {
      pathname = decodeURIComponent((request.url ?? "/").split(/[?#]/u)[0])
    } catch {
      return fail(400, "Malformed path")
    }
    if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").includes("..")) {
      return fail(403, "Path outside the public directory")
    }
    const mounts = ["/math-notes", "/World"]
    if (mounts.includes(pathname)) {
      response.writeHead(302, { Location: `${pathname}/` })
      return response.end()
    }
    const mount = mounts.find((prefix) => pathname.startsWith(`${prefix}/`))
    const relativePath = mount ? pathname.slice(mount.length + 1) : pathname.replace(/^\/+/, "")
    const candidate = path.resolve(publicRoot, relativePath || "index.html")
    const inside = (file) => {
      const relative = path.relative(publicRoot, file)
      return (
        relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
      )
    }
    if (!inside(candidate)) return fail(403, "Path outside the public directory")
    // A chapter such as 3.5-Classical-Fourier-Series is still an extensionless
    // article route. Only a successfully found file determines its content type.
    const candidates = [candidate, `${candidate}.html`, path.join(candidate, "index.html")]
    for (const file of candidates) {
      try {
        const actual = await realpath(file)
        if (!inside(actual)) return fail(403, "Symlink outside the public directory")
        const info = await stat(actual)
        if (!info.isFile()) continue
        response.writeHead(200, {
          "Content-Type": types[path.extname(actual)] ?? "application/octet-stream",
          "Content-Length": info.size,
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        })
        response.end(request.method === "HEAD" ? undefined : await readFile(actual))
        return
      } catch (error) {
        if (!["ENOENT", "ENOTDIR"].includes(error.code)) {
          console.error(error)
          return fail(500, "Unable to read public artifact")
        }
      }
    }
    fail(404, "Public artifact not found")
  })
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, host, resolve)
  })
  const address = server.address()
  return {
    server,
    url: `http://${host}:${address.port}`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const preview = await startPreview({ port: Number(process.env.PORT ?? 8081) })
  console.log(
    `Production preview: ${preview.url}/, ${preview.url}/math-notes/, ${preview.url}/World/`,
  )
  console.log("Only website/public is served. Stop with Ctrl+C.")
}
