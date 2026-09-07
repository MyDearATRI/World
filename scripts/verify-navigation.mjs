import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const data = JSON.parse(await readFile("public/static/bookIndex.json", "utf8"))
const book = data.catalog.books[0]
const sections = book.chapters.flatMap((chapter) => chapter.sections)
const knowledge = book.chapters.flatMap((chapter) => chapter.knowledge)
const aliasNote = data.documents.find(
  (note) =>
    knowledge.includes(note.slug) &&
    note.aliases.some((alias) => alias.length > 3 && alias !== note.title),
)
assert.ok(aliasNote)
const alias = aliasNote.aliases.find((value) => value.length > 3 && value !== aliasNote.title)
const live = process.env.NAVIGATION_SITE_URL ? new URL(process.env.NAVIGATION_SITE_URL) : undefined
if (live) {
  assert.equal(live.protocol, "https:")
  assert.ok(!live.username && !live.password && !live.search && !live.hash)
  if (!live.pathname.endsWith("/")) live.pathname += "/"
}
await mkdir("artifacts/screenshots", { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  mode: live ? "live" : "local",
  site: live?.href,
  scenarios: [],
  screenshots: [],
}
let preview, browser
const check = (scenario, ok, name, detail) => {
  scenario.checks.push({ name, passed: Boolean(ok), ...(detail === undefined ? {} : { detail }) })
  console.log(`${ok ? "PASS" : "FAIL"} ${scenario.width}: ${name}`)
}
try {
  if (!live) preview = await startPreview({ port: 0 })
  const site = live?.href ?? `${preview.url}/World/`
  const url = (slug) =>
    new URL(slug === "index" ? "./" : slug.split("/").map(encodeURIComponent).join("/"), site).href
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const [width, height] of [
    [1440, 1000],
    [1024, 900],
    [390, 844],
  ]) {
    const scenario = { width, height, checks: [], errors: [] }
    report.scenarios.push(scenario)
    const context = await browser.newContext({ viewport: { width, height } })
    const page = await context.newPage()
    page.on("pageerror", (error) => scenario.errors.push(error.message))
    page.on("response", (response) => {
      if (response.status() >= 400) scenario.errors.push(`${response.status()} ${response.url()}`)
    })
    const capture = async (label) => {
      await page.evaluate(() => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      })
      const file = `artifacts/screenshots/${live ? "live-" : ""}navigation-${label}-${width}.png`
      await page.screenshot({ path: file })
      report.screenshots.push(file)
    }
    const fit = async () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    try {
      await page.goto(site, { waitUntil: "networkidle" })
      await page.evaluate(() => document.fonts.ready)
      check(
        scenario,
        (await page.locator("h1").textContent()) === "书架",
        "Home identifies the bookshelf",
      )
      const enter = page.locator(".shelf-enter").first()
      const box = await enter.boundingBox()
      check(
        scenario,
        box && box.y + box.height <= height,
        "A real book can be entered in the first viewport",
        box,
      )
      check(
        scenario,
        (await page.locator(".note-graph").count()) === 0,
        "Home does not instantiate a full graph",
      )
      check(
        scenario,
        await page.locator("#about-notes > details").evaluate((el) => !el.open),
        "Ancillary material starts folded",
      )
      check(scenario, await fit(), "Bookshelf fits the viewport")
      await capture("shelf")
      await enter.click()
      await page.waitForURL(url(book.slug))
      await page.waitForLoadState("networkidle")
      check(
        scenario,
        (await page.locator(".chapter-jump a").count()) === book.chapters.length,
        "All written chapters are directly presented",
      )
      check(
        scenario,
        (await page.locator(".section-reading-link").count()) === sections.length,
        "All twenty-four sections have direct links",
      )
      check(
        scenario,
        (await page.locator(".future-chapters").evaluate((el) => !el.open)) &&
          (await page.locator(".source-navigation").evaluate((el) => !el.open)),
        "Planning and source navigation are secondary",
      )
      check(scenario, await fit(), "Book navigation fits")
      await capture("book")
      await page.locator(".chapter-jump a").last().click()
      await page.locator(".chapter-block").last().locator(".section-reading-link").last().click()
      await page.waitForURL(url(sections.at(-1).slug))
      check(
        scenario,
        page.url() === url(sections.at(-1).slug),
        "Final section is three clicks from the shelf",
      )
      const breadcrumbs = await page.locator(".breadcrumbs").textContent()
      check(
        scenario,
        breadcrumbs.includes(book.title) && !/笔记主体|\/书籍|\/研读/.test(breadcrumbs),
        "Breadcrumbs use reading structure",
        breadcrumbs,
      )
      for (const [number, nextNumber] of [
        ["1.8", "2.1"],
        ["2.8", "3.1"],
      ]) {
        const before = sections.find((section) => section.number === number)
        const after = sections.find((section) => section.number === nextNumber)
        await page.goto(url(before.slug), { waitUntil: "networkidle" })
        check(
          scenario,
          (await page.locator('a[rel="next"]').evaluate((link) => link.href)) === url(after.slug),
          `${number} continues to ${nextNumber}`,
        )
      }
      await page.goto(url(book.slug) + "#knowledge-index", { waitUntil: "networkidle" })
      const filter = page.locator(".knowledge-filter")
      await filter.fill(alias)
      await page.waitForTimeout(200)
      check(
        scenario,
        await page
          .locator(".knowledge-index-item:not([hidden])")
          .evaluateAll(
            (rows, slug) => rows.some((row) => row.dataset.knowledgeSlug === slug),
            aliasNote.slug,
          ),
        "Aliases locate real knowledge",
      )
      await filter.fill("2.3")
      check(
        scenario,
        (await page.locator(".knowledge-index-item:not([hidden])").count()) > 0,
        "Section numbers locate related knowledge",
      )
      await filter.fill("this-concept-does-not-exist-6472")
      check(
        scenario,
        await page.locator(".knowledge-empty").isVisible(),
        "Empty results explain recovery",
      )
      await filter.fill("")
      check(
        scenario,
        (await page.locator(".knowledge-index-item:not([hidden])").count()) === knowledge.length,
        "Clear filter restores all knowledge",
      )
      await capture("knowledge")
      const multiple = Object.values(data.catalog.pages).find(
        (item) => item.role === "knowledge" && item.sections.length > 1,
      )
      await page.goto(url(multiple.slug), { waitUntil: "networkidle" })
      check(
        scenario,
        (await page.locator(".related-readings a").count()) === multiple.sections.length,
        "Direct knowledge pages retain all related sections",
      )
      check(
        scenario,
        (await page.locator(".markdown-content .katex").count()) > 0,
        "Knowledge retains real mathematics",
      )
      check(scenario, await fit(), "Knowledge page fits the viewport")
      check(
        scenario,
        scenario.errors.length === 0,
        "No runtime or resource failures",
        scenario.errors,
      )
    } catch (error) {
      check(scenario, false, "Scenario completed", String(error.stack ?? error))
    } finally {
      await context.close()
    }
  }
} finally {
  await browser?.close()
  await preview?.close()
  const checks = report.scenarios.flatMap((scenario) => scenario.checks)
  report.finishedAt = new Date().toISOString()
  report.summary = {
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length,
  }
  const file = `artifacts/${live ? "live-" : ""}navigation-report.json`
  await writeFile(file, JSON.stringify(report, null, 2) + "\n")
  console.log(report.summary, file)
  if (report.summary.failed) process.exitCode = 1
}
