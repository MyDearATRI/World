import assert from "node:assert/strict"
import { createReadStream } from "node:fs"
import { createServer } from "node:http"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const manifest = JSON.parse(
  await readFile(path.join(root, "knowledge/model-manifest.json"), "utf8"),
)
const index = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"))
const modelBase = `https://huggingface.co/${manifest.id}/resolve/${manifest.revision}/`
const modelFiles = new Map()
for (const file of manifest.files)
  modelFiles.set(modelBase + file.path, {
    path: path.join(root, ".quartz-cache/semantic-model", manifest.id, file.path),
    file,
  })
const report = {
  startedAt: new Date().toISOString(),
  mode: "Actual Edge WebAssembly model inference; model HTTP downloads replayed from the exact verified public model bytes, not a real browser internet download",
  revision: manifest.revision,
  checks: [],
  requests: [],
  network: [],
}
const check = (name, value, details) => {
  report.checks.push({ name, passed: Boolean(value), ...(details ? { details } : {}) })
  assert.ok(value, name)
  console.log(`PASS ${name}`)
}
let preview
let browser
let modelServer
let modelTransport
try {
  modelServer = createServer((request, response) => {
    const file = manifest.files.find((file) => `/${file.path}` === request.url)
    if (request.method !== "GET" || !file) {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, {
      "content-type": "application/octet-stream",
      "content-length": file.bytes,
      "access-control-allow-origin": "*",
    })
    createReadStream(modelFiles.get(modelBase + file.path).path).pipe(response)
  })
  await new Promise((resolve) => modelServer.listen(0, "127.0.0.1", resolve))
  modelTransport = `http://127.0.0.1:${modelServer.address().port}`
  preview = await startPreview({ port: 0 })
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
  })
  report.browserVersion = browser.version()
  const context = await browser.newContext({ serviceWorkers: "block" })
  context.on("request", (request) => report.network.push(request.url()))
  let mode = "normal"
  await context.route("https://huggingface.co/**", async (route) => {
    const request = route.request()
    report.requests.push({
      url: request.url(),
      method: request.method(),
      body: request.postData(),
      authorization: Boolean(request.headers().authorization),
      cookie: Boolean(request.headers().cookie),
    })
    if (mode === "failure") return route.abort("failed")
    if (mode === "cancel") {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      return route.abort("aborted").catch(() => {})
    }
    const item = modelFiles.get(request.url())
    assert.ok(item, "Only immutable allowlisted model URLs are requested")
    await route.fulfill({
      status: 302,
      headers: {
        "access-control-allow-origin": "*",
        location: `${modelTransport}/${item.file.path}`,
      },
    })
  })
  const page = await context.newPage()
  const site = `${preview.url}/World/`
  await page.goto(site, { waitUntil: "networkidle" })
  check("Ordinary reading makes no model request", report.requests.length === 0)
  await page.evaluate((baseUrl) => {
    window.semanticMessages = []
    window.semanticTestWorker = new Worker(new URL("static/semantic/worker.js", baseUrl), {
      type: "module",
    })
    window.semanticTestWorker.onmessage = (event) => window.semanticMessages.push(event.data)
    window.semanticTestWorker.onerror = (event) =>
      window.semanticMessages.push({ type: "error", message: event.message })
  }, site)
  await page.waitForTimeout(250)
  check("A Worker without explicit init does not download a model", report.requests.length === 0)
  const waitForMessage = async (type) => {
    await page.waitForFunction(
      (wanted) =>
        window.semanticMessages.some(
          (message) => message.type === wanted || message.type === "error",
        ),
      type,
      { timeout: 90000 },
    )
    const messages = await page.evaluate(() => window.semanticMessages)
    const error = messages.find((message) => message.type === "error")
    if (error) throw new Error(error.message)
    return messages.find((message) => message.type === type)
  }
  await page.evaluate(
    (baseUrl) => window.semanticTestWorker.postMessage({ type: "init", baseUrl }),
    site,
  )
  const ready = await waitForMessage("ready")
  check(
    "Explicit enable loads verified model bytes and actual WASM session",
    ready.cached === false,
  )
  check(
    "First enable requests exactly five fixed model files",
    report.requests.length === manifest.files.length,
  )
  const progress = await page.evaluate(() =>
    window.semanticMessages.filter((message) => message.type === "progress"),
  )
  check(
    "Download, hash verification and model loading each report progress",
    ["download", "verify", "load"].every((phase) =>
      progress.some((message) => message.phase === phase),
    ),
  )
  const beforeQuery = report.requests.length
  const networkBeforeQuery = report.network.length
  await page.evaluate(() =>
    window.semanticTestWorker.postMessage({
      type: "query",
      requestId: "metric-test",
      text: "度量空间中的距离和开球",
    }),
  )
  const result = await waitForMessage("result")
  const titles = result.matches.map(
    (match) => index.objects.find((object) => object.id === match.id)?.title,
  )
  check(
    "Actual bilingual query finds a metric concept in the first five results",
    titles.slice(0, 5).some((title) => /metric|度量|open ball/i.test(title)),
    titles.slice(0, 5),
  )
  check(
    "Query returns request identity and finite scores",
    result.requestId === "metric-test" &&
      result.matches.every((match) => Number.isFinite(match.score)),
  )
  check("Query inference sends no network request", report.network.length === networkBeforeQuery)
  await page.evaluate(async (baseUrl) => {
    window.semanticTestWorker.terminate()
    window.semanticMessages = []
    window.semanticTestWorker = new Worker(new URL("static/semantic/worker.js", baseUrl), {
      type: "module",
    })
    window.semanticTestWorker.onmessage = (event) => window.semanticMessages.push(event.data)
    window.semanticTestWorker.onerror = (event) =>
      window.semanticMessages.push({ type: "error", message: event.message })
    window.semanticTestWorker.postMessage({ type: "init", baseUrl })
  }, site)
  const cached = await waitForMessage("ready")
  check(
    "Second session reuses only verified cached model bytes",
    cached.cached === true && report.requests.length === beforeQuery,
  )
  await page.evaluate(() => window.semanticTestWorker.terminate())
  await page.waitForFunction(
    () => document.querySelector(".knowledge-space")?.dataset.ready === "true",
  )
  await page.keyboard.press("Control+k")
  await page.locator(".knowledge-command[open]").waitFor()
  check(
    "Keyboard opens the real command panel",
    await page
      .locator("#knowledge-query")
      .evaluate((element) => element === document.activeElement),
  )
  await page.locator(".semantic-options summary").click()
  const uiEnable = page.locator("[data-model-enable]")
  const uiCancel = page.locator("[data-model-cancel]")
  const uiStatus = page.locator("[data-model-status]")
  const commandStatus = page.locator("[data-command-status]")
  const query = page.locator("#knowledge-query")
  const beforeDisclosure = report.requests.length
  await uiEnable.click()
  await page.waitForFunction(() =>
    document.querySelector("[data-model-enable]")?.textContent.includes("下载并启用"),
  )
  check(
    "First UI click discloses download information without fetching model files",
    report.requests.length === beforeDisclosure,
  )
  const description = await page.locator("[data-model-description]").innerText()
  check(
    "UI disclosure includes actual model size, extra runtime size and public source",
    description.includes((manifest.downloadBytes / 1024 / 1024).toFixed(1)) &&
      description.includes("21.5 MiB") &&
      description.includes("Hugging Face") &&
      description.includes(manifest.id),
    description,
  )
  await uiEnable.click()
  await page.waitForFunction(
    () =>
      document.querySelector("[data-model-status]")?.textContent.includes("语义搜索在此设备运行"),
    null,
    { timeout: 90000 },
  )
  check(
    "Second explicit UI click initializes the cached actual model without another download",
    report.requests.length === beforeDisclosure && (await uiEnable.innerText()).includes("就绪"),
  )
  const beforeUiQuery = report.network.length
  await query.fill("度量空间中的距离和开球")
  await page.waitForFunction(
    () => document.querySelector("[data-command-status]")?.textContent.includes("含本机语义匹配"),
    null,
    { timeout: 15000 },
  )
  check(
    "Real UI receives matching Worker request IDs and marks semantic results",
    (await commandStatus.innerText()).includes("含本机语义匹配"),
  )
  check(
    "Chinese semantic query shows actual metric reading and objects in UI",
    (await page.locator(".command-results").innerText()).includes("度量"),
  )
  check(
    "Typing a semantic query in the real UI makes no network request",
    report.network.length === beforeUiQuery,
  )
  await page.evaluate(() => caches.open("unrelated-app-cache"))
  await page.locator("[data-model-clear]").click()
  await page.waitForFunction(() =>
    document.querySelector("[data-model-status]")?.textContent.includes("已清除本网站"),
  )
  const cacheNames = await page.evaluate(() => caches.keys())
  check(
    "Real UI clear removes only this site's model cache",
    cacheNames.includes("unrelated-app-cache") &&
      !cacheNames.some((name) => name.startsWith("world-semantic-v1:")),
  )
  mode = "cancel"
  const beforeCancel = report.requests.length
  await uiEnable.click()
  for (let attempt = 0; attempt < 100 && report.requests.length === beforeCancel; attempt++)
    await page.waitForTimeout(30)
  check(
    "Real UI cancel scenario starts a model download",
    report.requests.length > beforeCancel && (await uiCancel.isVisible()),
  )
  await uiCancel.click()
  await page.waitForTimeout(1800)
  check(
    "UI cancel terminates download and resets enabled progress controls",
    (await uiStatus.innerText()).includes("已取消") &&
      (await uiEnable.isEnabled()) &&
      !(await uiCancel.isVisible()) &&
      !(await page.locator("[data-model-progress]").isVisible()),
  )
  await query.fill("compactness")
  await page.waitForFunction(() =>
    document.querySelector("[data-command-status]")?.textContent.includes("名称与别名优先"),
  )
  check(
    "Ordinary English search remains usable after UI cancellation",
    (await page.locator(".command-results").innerText()).toLowerCase().includes("compact"),
  )
  mode = "failure"
  await uiEnable.click()
  await page.waitForFunction(
    () => document.querySelector("[data-model-status]")?.textContent.includes("普通搜索仍可使用"),
    null,
    { timeout: 15000 },
  )
  check(
    "UI presents download failure and restores model controls",
    (await uiEnable.isEnabled()) &&
      !(await uiCancel.isVisible()) &&
      !(await page.locator("[data-model-progress]").isVisible()),
  )
  await query.fill("度量")
  await page.waitForFunction(() =>
    document.querySelector("[data-command-status]")?.textContent.includes("名称与别名优先"),
  )
  check(
    "Chinese ordinary results remain available after model failure",
    (await page.locator(".command-results").innerText()).includes("度量"),
  )
  await page.keyboard.press("Escape")
  check(
    "Command panel closes normally after model failure",
    !(await page.locator(".knowledge-command").evaluate((element) => element.open)),
  )
  check(
    "Model requests never contain query, body, credentials or mutable revision",
    report.requests.every(
      (request) =>
        modelFiles.has(request.url) &&
        request.method === "GET" &&
        !request.body &&
        !request.authorization &&
        !request.cookie,
    ),
  )
  check(
    "All external requests belong to the exact public model allowlist",
    report.network.every(
      (url) =>
        new URL(url).origin === preview.url ||
        modelFiles.has(url) ||
        manifest.files.some((file) => url === `${modelTransport}/${file.path}`),
    ),
  )
  await context.close()
} catch (error) {
  report.error = error.message
  console.error(error)
  process.exitCode = 1
} finally {
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((check) => check.passed).length
  report.failed = report.checks.filter((check) => !check.passed).length + (report.error ? 1 : 0)
  await browser?.close()
  await preview?.close()
  await new Promise((resolve) => (modelServer ? modelServer.close(resolve) : resolve()))
  await mkdir(path.join(root, "artifacts"), { recursive: true })
  await writeFile(
    path.join(root, "artifacts/semantic-browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  )
}
