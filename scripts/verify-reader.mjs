import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { fromHtml } from "hast-util-from-html"
import { visit } from "unist-util-visit"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const artifacts = path.join(root, "artifacts")
const screenshotRoot = path.join(artifacts, "screenshots")
const index = JSON.parse(await readFile(path.join(root, "public/static/bookIndex.json"), "utf8"))
assert.equal(index.version, 2, "Build the current reading interface first")
const catalog = index.catalog
const sections = catalog.books.flatMap((book) =>
  book.chapters.flatMap((chapter) => chapter.sections),
)
let selected
for (const section of sections.filter((item) => item.knowledge.length > 1)) {
  for (const slug of section.knowledge) {
    const tree = fromHtml(await readFile(path.join(root, "public", `${slug}.html`), "utf8"))
    let article
    visit(tree, "element", (node) => {
      if (node.properties.className?.includes("markdown-content")) article = node
    })
    if (!article) continue
    const nested = []
    visit(article, "element", (node) => {
      if (node.tagName !== "a" || typeof node.properties.href !== "string") return
      try {
        const linked = decodeURIComponent(
          new URL(node.properties.href, `https://example.test/${slug}`).pathname,
        ).slice(1)
        if (linked !== slug && catalog.pages[linked]?.role === "knowledge") nested.push(linked)
      } catch {}
    })
    if (nested.length) {
      selected = { section, slug }
      break
    }
  }
  if (selected) break
}
assert.ok(
  selected,
  "A real section links to a knowledge article with further knowledge links in its body",
)
const chosen = selected.section
const targetSlug = selected.slug
const targetPage = catalog.pages[targetSlug]
const live = process.env.READER_SITE_URL ? new URL(process.env.READER_SITE_URL) : undefined
if (live) {
  assert.equal(live.protocol, "https:")
  assert.ok(!live.username && !live.password && !live.search && !live.hash)
  if (!live.pathname.endsWith("/")) live.pathname += "/"
}
const hrefFor = (site, slug) =>
  new URL(slug.split("/").map(encodeURIComponent).join("/"), site).href
const report = {
  startedAt: new Date().toISOString(),
  mode: live ? "live" : "local",
  siteUrl: live?.href,
  source: { section: chosen.slug, target: targetSlug },
  browserVersion: null,
  scenarios: [],
  screenshots: [],
}
await mkdir(screenshotRoot, { recursive: true })
let preview
let browser
const check = (scenario, passed, name, details) => {
  scenario.checks.push({
    name,
    passed: Boolean(passed),
    ...(details === undefined ? {} : { details }),
  })
  console.log(`${passed ? "PASS" : "FAIL"} ${scenario.name}: ${name}`)
}
async function waitLoaded(page) {
  await page.waitForSelector(".knowledge-reader[open] .knowledge-reader-body .markdown-content")
  await page.waitForFunction(() => !document.querySelector(".knowledge-reader-status")?.textContent)
}
try {
  if (!live) preview = await startPreview({ port: Number(process.env.READER_VERIFY_PORT ?? 0) })
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const [mount, viewport] of [
    [live?.href ?? `${preview.url}/World/`, { width: 1440, height: 1000 }],
    [live?.href ?? `${preview.url}/World/`, { width: 1024, height: 900 }],
    [live?.href ?? `${preview.url}/World/`, { width: 390, height: 844 }],
    ...(live
      ? []
      : [
          [`${preview.url}/`, { width: 1440, height: 1000 }],
          [`${preview.url}/math-notes/`, { width: 390, height: 844 }],
        ]),
  ]) {
    const scenario = {
      name: `reader-${live ? "live" : new URL(mount).pathname.replaceAll("/", "") || "root"}-${viewport.width}`,
      viewport,
      mount,
      checks: [],
      errors: [],
      missingResources: [],
    }
    report.scenarios.push(scenario)
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    page.on("pageerror", (error) => scenario.errors.push(error.message))
    page.on("response", (response) => {
      if (response.status() >= 400)
        scenario.missingResources.push({ url: response.url(), status: response.status() })
    })
    try {
      await page.goto(hrefFor(mount, chosen.slug), { waitUntil: "networkidle" })
      const originalUrl = page.url()
      const sourceCount = await page
        .locator("article.markdown-content")
        .first()
        .locator(".katex-mathml")
        .count()
        .catch(() => 0)
      const links = page.locator("[data-reader-slug]")
      const available = await links.evaluateAll((items) =>
        items.map((item) => item.dataset.readerSlug),
      )
      check(
        scenario,
        available.includes(targetSlug),
        "Real section offers its catalog knowledge link",
      )
      const target = page.locator(`[data-reader-slug=${JSON.stringify(targetSlug)}]`).first()
      if (viewport.width <= 600) {
        const knowledge = page.locator("details.section-knowledge")
        check(
          scenario,
          await knowledge.evaluate((item) => !item.open),
          "Mobile knowledge links start collapsed to keep the main reading in view",
        )
        await knowledge.locator("summary").focus()
        await page.keyboard.press("Enter")
        check(scenario, await target.isVisible(), "Keyboard expands the section knowledge links")
      }
      await target.scrollIntoViewIfNeeded()
      await target.focus()
      const baseline = await page.evaluate(() => ({
        x: scrollX,
        y: scrollY,
        h: document.querySelector(".center")?.getBoundingClientRect().height,
      }))
      await target.click()
      await waitLoaded(page)
      const panel = page.locator(".knowledge-reader")
      check(
        scenario,
        page.url() === originalUrl,
        "Opening knowledge keeps the main article URL and reading position",
      )
      check(
        scenario,
        (await page.locator("#knowledge-reader-title").innerText()) === targetPage.title,
        "Panel loads the real selected knowledge title",
      )
      check(
        scenario,
        await panel.evaluate((item) => item.contains(document.activeElement)),
        "Panel receives focus when it opens",
      )
      const geometry = await panel.evaluate((item) => ({
        w: item.getBoundingClientRect().width,
        x: item.getBoundingClientRect().left,
        right: item.getBoundingClientRect().right,
        scroll: item.scrollWidth,
        client: item.clientWidth,
        view: innerWidth,
        doc: document.documentElement.scrollWidth,
        mainY: scrollY,
      }))
      check(
        scenario,
        geometry.scroll <= geometry.client + 1 &&
          geometry.doc <= geometry.view + 1 &&
          geometry.right <= geometry.view + 1,
        "Reading panel has no document or panel horizontal overflow",
        geometry,
      )
      check(
        scenario,
        viewport.width <= 800
          ? geometry.x === 0 && Math.abs(geometry.w - viewport.width) <= 1
          : geometry.x > 0,
        "Desktop panel sits on the right; mobile is full width",
      )
      check(
        scenario,
        geometry.mainY === baseline.y,
        "Opening the panel does not scroll the underlying article",
      )
      const typography = await panel.locator("article").evaluate((item) => ({
        font: getComputedStyle(item).fontFamily,
        size: parseFloat(getComputedStyle(item).fontSize),
        line: parseFloat(getComputedStyle(item).lineHeight),
      }))
      check(
        scenario,
        typography.font.includes("Noto Serif") &&
          typography.size >= 18 &&
          typography.line / typography.size >= 1.75,
        "Panel uses the article serif size and readable line spacing",
        typography,
      )
      const ids = await page.locator("[id]").evaluateAll((items) => items.map((item) => item.id))
      check(
        scenario,
        new Set(ids).size === ids.length,
        "Inserted article IDs do not collide with the original document",
      )
      check(
        scenario,
        (await panel.locator("article script, article iframe, article .sidebar").count()) === 0,
        "Only article content enters the panel",
      )
      const expectedHtml = await readFile(path.join(root, "public", `${targetSlug}.html`), "utf8")
      const expectedMath = (expectedHtml.match(/class="katex-mathml"/g) ?? []).length
      check(
        scenario,
        (await panel.locator(".katex-mathml").count()) === expectedMath,
        "Complete rendered article retains its MathML",
        { expectedMath, originalMainMath: sourceCount },
      )
      const expectedText = await page.evaluate(
        (html) =>
          new DOMParser()
            .parseFromString(html, "text/html")
            .querySelector(".markdown-content")
            ?.textContent.trim(),
        expectedHtml,
      )
      check(
        scenario,
        (await panel.locator(".markdown-content").textContent()).trim() === expectedText,
        "The complete article text is loaded rather than a preview excerpt",
      )
      const hrefs = await panel
        .locator("article a[href]")
        .evaluateAll((items) => items.map((item) => item.getAttribute("href")))
      check(
        scenario,
        hrefs.every((href) => /^(?:#|https?:|mailto:|tel:)/.test(href)),
        "Article-relative links resolve against the fetched note",
      )
      check(
        scenario,
        (await page.locator(".knowledge-reader-independent").getAttribute("href")) ===
          hrefFor(mount, targetSlug),
        "Independent-open link points to the real generated article",
      )
      check(
        scenario,
        await page.locator(".knowledge-reader-chapter").isVisible(),
        "Panel offers its owning chapter",
      )
      const screenshot = path.join(screenshotRoot, `${scenario.name}.png`)
      await page.screenshot({ path: screenshot, animations: "disabled" })
      report.screenshots.push(path.relative(root, screenshot).replaceAll(path.sep, "/"))
      await panel.evaluate((item) => {
        item.scrollTop = item.scrollHeight
      })
      const closePosition = await page.locator(".knowledge-reader-close").boundingBox()
      check(
        scenario,
        closePosition &&
          closePosition.y >= 0 &&
          closePosition.y + closePosition.height <= viewport.height,
        "The close control remains visible while reading the end of a long entry",
      )
      for (let step = 0; step < 8; step++) await page.keyboard.press("Tab")
      check(
        scenario,
        await panel.evaluate((item) => item.contains(document.activeElement)),
        "Native dialog keeps keyboard focus within the reader",
      )

      const nested = await panel
        .locator("article a[href]")
        .evaluateAll(
          (items, pages) =>
            items
              .map((item) => ({ href: item.href, text: item.textContent }))
              .find((item) =>
                Object.entries(pages).some(
                  ([slug, info]) =>
                    info.role === "knowledge" &&
                    decodeURIComponent(new URL(item.href).pathname).endsWith(slug),
                ),
              ),
          catalog.pages,
        )
      if (nested) {
        await panel
          .locator(`article a[href=${JSON.stringify(nested.href)}]`)
          .first()
          .click()
        await waitLoaded(page)
        check(
          scenario,
          await page.locator(".knowledge-reader-back").isEnabled(),
          "A real nested knowledge link adds panel history",
        )
        await page.goBack()
        await waitLoaded(page)
        check(
          scenario,
          (await page.locator("#knowledge-reader-title").innerText()) === targetPage.title,
          "Browser Back restores the previous knowledge entry",
        )
      } else {
        await page.evaluate(
          ({ slug, href }) =>
            document.dispatchEvent(new CustomEvent("reader:open", { detail: { slug, href } })),
          { slug: chosen.knowledge[1], href: hrefFor(mount, chosen.knowledge[1]) },
        )
        await waitLoaded(page)
        check(
          scenario,
          await page.locator(".knowledge-reader-back").isEnabled(),
          "Reader-open integration adds another real entry to panel history",
        )
        await page.goBack()
        await waitLoaded(page)
        check(
          scenario,
          (await page.locator("#knowledge-reader-title").innerText()) === targetPage.title,
          "Browser Back restores the previous knowledge entry",
        )
      }
      await page.keyboard.press("Escape")
      await page.waitForFunction(
        () => !document.querySelector(".knowledge-reader")?.open && !history.state?.knowledgeReader,
      )
      check(
        scenario,
        await target.evaluate((item) => item === document.activeElement),
        "Escape restores the original link focus",
      )
      check(
        scenario,
        await page.evaluate((saved) => scrollY === saved.y && scrollX === saved.x, baseline),
        "Closing restores the original main article scroll",
      )

      // Deliberately abort one article fetch. This is a controlled failure test,
      // not a claim that the deployed production resource is missing.
      await page.route(hrefFor(mount, targetSlug), (route) => route.abort("failed"))
      await target.click()
      await page.waitForFunction(() =>
        document.querySelector(".knowledge-reader-status")?.textContent.includes("暂时无法加载"),
      )
      check(
        scenario,
        await page.locator(".knowledge-reader-independent").isVisible(),
        "A failed fetch retains an independent-open escape route",
      )
      await page.locator(".knowledge-reader-close").click()
      await page.waitForFunction(
        () => !document.querySelector(".knowledge-reader")?.open && !history.state?.knowledgeReader,
      )
      check(
        scenario,
        await target.evaluate((item) => item === document.activeElement),
        "A failed fetch can close and return to the original reading focus",
      )
      await page.unroute(hrefFor(mount, targetSlug))
      const [newPage] = await Promise.all([
        context.waitForEvent("page"),
        target.click({ modifiers: ["Control"] }),
      ])
      await newPage.waitForLoadState("domcontentloaded")
      check(
        scenario,
        newPage.url() === hrefFor(mount, targetSlug) &&
          (await panel.evaluate((item) => !item.open)),
        "Ctrl-click retains the browser's independent-tab behavior",
      )
      await newPage.close()
    } catch (error) {
      check(scenario, false, "Scenario completed", error.stack ?? String(error))
    }
    check(scenario, scenario.errors.length === 0, "No browser runtime errors", scenario.errors)
    check(
      scenario,
      scenario.missingResources.length === 0,
      "All production resources respond successfully",
      scenario.missingResources,
    )
    await context.close()
  }
} finally {
  if (browser) await browser.close()
  if (preview) await preview.close()
  report.completedAt = new Date().toISOString()
  report.passed = report.scenarios
    .flatMap((scenario) => scenario.checks)
    .filter((check) => check.passed).length
  report.failed = report.scenarios
    .flatMap((scenario) => scenario.checks)
    .filter((check) => !check.passed).length
  await writeFile(
    path.join(artifacts, `${live ? "live-" : ""}reader-browser-report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(`Reader browser checks: ${report.passed} passed, ${report.failed} failed`)
  if (report.failed) process.exitCode = 1
}
