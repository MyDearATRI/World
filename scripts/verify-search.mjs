import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const artifactRoot = path.join(root, "artifacts")
const screenshotRoot = path.join(artifactRoot, "screenshots")
const liveSite = process.env.SEARCH_SITE_URL ? new URL(process.env.SEARCH_SITE_URL) : undefined
if (liveSite) {
  assert.equal(liveSite.protocol, "https:", "SEARCH_SITE_URL must use HTTPS")
  assert.ok(
    !liveSite.username && !liveSite.password && !liveSite.search && !liveSite.hash,
    "SEARCH_SITE_URL must be a plain site URL",
  )
  if (!liveSite.pathname.endsWith("/")) liveSite.pathname += "/"
}
const primaryMount = liveSite?.pathname ?? "/World/"
let baseUrl = liveSite?.origin
const data = JSON.parse(await readFile(path.join(root, "public/static/bookIndex.json"), "utf8"))
assert.equal(data.version, 1)
assert.ok(data.documents.length > 2, "Build the real book content before running search acceptance")
assert.ok(
  data.documents.every((doc) => doc.kind !== "canvas"),
  "Canvas pages are excluded",
)
const documents = data.documents
const aliasDoc = documents.find(
  (doc) =>
    doc.aliases.some(
      (alias) => alias.length >= 3 && alias.toLowerCase() !== doc.title.toLowerCase(),
    ) && doc.slug.includes("/"),
)
assert.ok(aliasDoc, "The production index must include a real note with an alias")
const aliasQuery = aliasDoc.aliases.find(
  (alias) => alias.length >= 3 && alias.toLowerCase() !== aliasDoc.title.toLowerCase(),
)
for (const query of ["度量", "compactness"]) {
  assert.ok(
    documents.some((doc) =>
      [doc.title, ...doc.aliases, ...doc.headings, doc.text, ...doc.tags]
        .join(" ")
        .toLowerCase()
        .includes(query),
    ),
    `Production notes contain ${query}`,
  )
}
const filterDocuments = ["body", "plan", "example"].map((kind) => {
  const doc = documents.find((item) => item.kind === kind && item.title.trim().length > 2)
  assert.ok(doc, `Production notes include ${kind}`)
  return doc
})
const report = {
  startedAt: new Date().toISOString(),
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  mode: liveSite ? "live" : "local",
  siteUrl: liveSite?.href ?? null,
  proxyConfigured: Boolean(process.env.BROWSER_PROXY),
  source: "Production public/static/bookIndex.json; no injected search fixtures",
  documentCount: documents.length,
  queries: { chinese: "度量", english: "compactness", alias: aliasQuery, aliasSlug: aliasDoc.slug },
  scenarios: [],
  screenshots: [],
}
await mkdir(screenshotRoot, { recursive: true })
let browser
let preview
function check(scenario, condition, name, details) {
  scenario.checks.push({
    name,
    passed: Boolean(condition),
    ...(details === undefined ? {} : { details }),
  })
  console.log(`${condition ? "PASS" : "FAIL"} ${scenario.name}: ${name}`)
}
async function search(page, query) {
  await page.locator(".book-search-query").fill(query)
  await page.waitForFunction((value) => {
    const input = document.querySelector(".book-search-query")
    const status = document.querySelector(".book-search-status")
    return (
      input?.value === value &&
      status &&
      !status.textContent.includes("正在搜索") &&
      (value
        ? /条结果|没有找到|无法读取/.test(status.textContent)
        : status.textContent.includes("输入关键词"))
    )
  }, query)
  // Input debounce is 100ms. Wait for this query's render, not the previous status.
  await page.waitForTimeout(180)
  await page.waitForFunction(
    () => !document.querySelector(".book-search-status")?.textContent.includes("正在搜索"),
  )
}
try {
  if (!liveSite) {
    preview = await startPreview({ port: Number(process.env.SEARCH_VERIFY_PORT ?? 8085) })
    baseUrl = preview.url
  }
  browser = await chromium.launch({
    channel: report.browserChannel,
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const [mount, viewport] of [
    [primaryMount, { width: 1440, height: 1000 }],
    [primaryMount, { width: 1024, height: 900 }],
    [primaryMount, { width: 390, height: 844 }],
    ...(liveSite ? [] : [["/", { width: 1440, height: 1000 }]]),
  ]) {
    const scenario = {
      name: `search-${liveSite ? "live" : mount === "/" ? "root" : "world"}-${viewport.width}`,
      mount,
      viewport,
      checks: [],
      runtimeErrors: [],
      failedResources: [],
      externalRequests: [],
    }
    report.scenarios.push(scenario)
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
    const page = await context.newPage()
    page.on("pageerror", (error) => scenario.runtimeErrors.push(error.message))
    page.on("response", (response) => {
      if (response.status() >= 400)
        scenario.failedResources.push({ url: response.url(), status: response.status() })
    })
    page.on("requestfailed", (request) =>
      scenario.failedResources.push({ url: request.url(), error: request.failure()?.errorText }),
    )
    page.on("request", (request) => {
      if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== baseUrl)
        scenario.externalRequests.push(request.url())
    })
    try {
      await page.goto(`${baseUrl}${mount}`, { waitUntil: "networkidle" })
      const launch = page.locator(".book-search-launch-input")
      check(scenario, await launch.isVisible(), "Home has a visible text search input")
      await launch.click()
      await page.waitForSelector(".book-search-dialog[open]")
      check(
        scenario,
        await page
          .locator(".book-search-query")
          .evaluate((input) => input === document.activeElement),
        "Opening the native dialog focuses its query input",
      )
      check(
        scenario,
        (await page.locator(".book-search-status").innerText()).includes("输入关键词"),
        "Empty search presents a useful prompt",
      )

      for (const query of ["度量", "compactness", aliasQuery]) {
        await search(page, query)
        const links = page.locator(".book-search-result")
        check(
          scenario,
          (await links.count()) > 0,
          `Real production query returns results: ${query}`,
        )
        check(
          scenario,
          (await page
            .locator(".book-search-result-title mark, .book-search-result-snippet mark")
            .count()) > 0 || query === aliasQuery,
          "Matching title or snippet is safely highlighted",
        )
        const hrefs = await links.evaluateAll((items) => items.map((item) => item.href))
        check(
          scenario,
          hrefs.every((href) => href.startsWith(`${baseUrl}${mount}`)),
          "Result URLs keep the active site mount",
        )
        if (query === aliasQuery) {
          const found = hrefs.some((href) =>
            decodeURIComponent(new URL(href).pathname).includes(aliasDoc.slug),
          )
          check(scenario, found, "An alias finds its actual note")
        }
      }

      for (const doc of filterDocuments) {
        await page.locator(`[data-search-filter="${doc.kind}"]`).click()
        await search(page, doc.title)
        const kinds = await page
          .locator(".book-search-result")
          .evaluateAll((links) => links.map((link) => link.dataset.kind))
        check(
          scenario,
          kinds.length > 0 && kinds.every((kind) => kind === doc.kind),
          `The ${doc.kind} filter returns only that content category`,
        )
      }
      await page.locator('[data-search-filter="all"]').click()
      await search(page, "zz_no_such_book_topic_938714")
      check(
        scenario,
        (await page.locator(".book-search-result").count()) === 0 &&
          (await page.locator(".book-search-status").innerText()).includes("没有找到"),
        "No-match state offers query and filter guidance",
      )
      await search(page, '<img src=x onerror="alert(1)">')
      check(
        scenario,
        (await page.locator(".book-search-dialog img").count()) === 0,
        "User input cannot create HTML elements",
      )

      await search(page, "度量")
      const geometry = await page.locator(".book-search-dialog").evaluate((dialog) => ({
        viewport: document.documentElement.clientWidth,
        pageWidth: document.documentElement.scrollWidth,
        dialogWidth: dialog.clientWidth,
        contentWidth: dialog.scrollWidth,
        left: dialog.getBoundingClientRect().left,
        right: dialog.getBoundingClientRect().right,
      }))
      check(
        scenario,
        geometry.pageWidth <= geometry.viewport + 1 &&
          geometry.contentWidth <= geometry.dialogWidth + 1 &&
          geometry.left >= 0 &&
          geometry.right <= geometry.viewport + 1,
        "Search fits the viewport without horizontal overflow",
        geometry,
      )
      const screenshot = path.join(screenshotRoot, `${scenario.name}.png`)
      await page.screenshot({ path: screenshot, animations: "disabled" })
      report.screenshots.push(path.relative(root, screenshot).replaceAll(path.sep, "/"))
      await page.locator(".book-search-query").focus()
      await page.keyboard.press("ArrowDown")
      const firstSelection = await page
        .locator(".book-search-query")
        .getAttribute("aria-activedescendant")
      await page.keyboard.press("ArrowDown")
      await page.keyboard.press("ArrowUp")
      check(
        scenario,
        Boolean(firstSelection) &&
          (await page.locator(".book-search-query").getAttribute("aria-activedescendant")) ===
            firstSelection,
        "Arrow keys select and restore a result",
      )
      const focusOutline = await page.locator(".book-search-query").evaluate((input) => ({
        style: getComputedStyle(input).outlineStyle,
        width: getComputedStyle(input).outlineWidth,
      }))
      check(
        scenario,
        focusOutline.style !== "none" && parseFloat(focusOutline.width) > 0,
        "Keyboard focus is visibly outlined",
      )
      for (let step = 0; step < 12; step++) await page.keyboard.press("Tab")
      check(
        scenario,
        await page
          .locator(".book-search-dialog")
          .evaluate((dialog) => dialog.contains(document.activeElement)),
        "Native dialog keeps Tab focus within search",
      )
      await page.keyboard.press("Escape")
      check(
        scenario,
        (await page.locator(".book-search-dialog").evaluate((dialog) => !dialog.open)) &&
          (await launch.evaluate((input) => input === document.activeElement)),
        "Escape closes and restores opener focus",
      )
      await page.keyboard.press("Control+k")
      check(
        scenario,
        await page.locator(".book-search-dialog").evaluate((dialog) => dialog.open),
        "Ctrl+K opens search",
      )
      await search(page, aliasQuery)
      await page.locator(".book-search-query").focus()
      await page.keyboard.press("ArrowDown")
      const destination = await page
        .locator('.book-search-result[aria-selected="true"]')
        .getAttribute("href")
      await Promise.all([page.waitForURL(destination), page.keyboard.press("Enter")])
      check(
        scenario,
        page.url() === destination && (await page.locator("h1").first().innerText()).length > 0,
        "Enter opens an actual generated note",
      )
      await page.keyboard.press("Control+k")
      await search(page, "度量")
      check(
        scenario,
        (await page.locator(".book-search-result").count()) > 0,
        "Search index and links work from a nested note",
      )
      await page.keyboard.press("Escape")
    } catch (error) {
      check(scenario, false, "Scenario completed", error.stack ?? String(error))
    }
    check(
      scenario,
      scenario.runtimeErrors.length === 0,
      "No browser runtime errors",
      scenario.runtimeErrors,
    )
    check(
      scenario,
      scenario.failedResources.length === 0,
      "All requested site resources load",
      scenario.failedResources,
    )
    check(
      scenario,
      scenario.externalRequests.length === 0,
      "Search makes no external requests",
      scenario.externalRequests,
    )
    await context.close()
  }
} finally {
  if (browser) await browser.close()
  if (preview) await preview.close()
  report.completedAt = new Date().toISOString()
  report.passed = report.scenarios
    .flatMap((scenario) => scenario.checks)
    .filter((item) => item.passed).length
  report.failed = report.scenarios
    .flatMap((scenario) => scenario.checks)
    .filter((item) => !item.passed).length
  await writeFile(
    path.join(
      artifactRoot,
      liveSite ? "live-search-browser-report.json" : "search-browser-report.json",
    ),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(`Search browser checks: ${report.passed} passed, ${report.failed} failed`)
  if (report.failed) process.exitCode = 1
}
