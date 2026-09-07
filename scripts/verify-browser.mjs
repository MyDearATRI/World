import assert from "node:assert/strict"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"
import { webSlug } from "./lib/export-canvas.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const artifactRoot = path.join(root, "artifacts")
const screenshots = path.join(artifactRoot, "screenshots")
const liveSite = process.env.BOOK_SITE_URL ? new URL(process.env.BOOK_SITE_URL) : undefined
if (liveSite) {
  assert.equal(liveSite.protocol, "https:", "BOOK_SITE_URL must use HTTPS")
  assert.ok(
    !liveSite.username && !liveSite.password && !liveSite.search && !liveSite.hash,
    "BOOK_SITE_URL must be a plain site URL",
  )
  if (!liveSite.pathname.endsWith("/")) liveSite.pathname += "/"
}
const primaryMount = liveSite?.pathname ?? "/World/"
let baseUrl = liveSite?.origin
await mkdir(screenshots, { recursive: true })
const manifest = JSON.parse(await readFile(path.join(root, "publish-manifest.json"), "utf8"))
const index = JSON.parse(await readFile(path.join(root, "public/static/bookIndex.json"), "utf8"))
const pages = []
for (const entry of manifest.notes) {
  const simplified = webSlug(entry.output)
  const slug = !simplified ? "index" : simplified.endsWith("/") ? simplified + "index" : simplified
  const html = await readFile(path.join(root, "public", slug + ".html"), "utf8")
  pages.push({
    slug,
    entry,
    html,
    length: index.documents.find((doc) => doc.slug === slug)?.text.length ?? 0,
    math: (html.match(/class="katex"/g) ?? []).length,
    formulaLength: Math.max(
      0,
      ...[...html.matchAll(/<annotation[^>]*>([\s\S]*?)<\/annotation>/g)].map(
        (match) => match[1].length,
      ),
    ),
  })
}
const longest = (items) => [...items].sort((a, b) => b.length - a.length)[0]
const reading =
  longest(
    pages.filter(
      (page) =>
        page.math > 3 && page.html.includes('rel="prev"') && page.html.includes('rel="next"'),
    ),
  ) ?? longest(pages.filter((page) => page.math > 3))
assert.ok(reading, "Production notes include a substantial mathematical reading page")
const sequence = pages.find(
  (page) => page.html.includes('rel="prev"') && page.html.includes('rel="next"'),
)
const embedded = longest(pages.filter((page) => /class="[^"]*transclude/.test(page.html)))
const tablePage = longest(pages.filter((page) => page.html.includes('class="table-scroll"')))
const footnotePage = pages.find((page) => page.html.includes("data-footnote-ref"))
const sidenotePage = pages.find((page) => page.html.includes('class="sidenote"'))
const canvas = pages.find(
  (page) => page.entry.kind === "canvas" && page.html.includes("canvas-reading-map"),
)
const imagePage = pages.find((page) => /<img[^>]+src="[^"]*assets\//.test(page.html))
const formulaPages = pages
  .filter((page) => page.math > 0)
  .sort((a, b) => b.formulaLength - a.formulaLength)
  .slice(0, 6)
const report = {
  startedAt: new Date().toISOString(),
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  mode: liveSite ? "live" : "local",
  siteUrl: liveSite?.href ?? null,
  proxyConfigured: Boolean(process.env.BROWSER_PROXY),
  source:
    "Production pages selected from the publication manifest and actual generated HTML; no injected content.",
  selected: Object.fromEntries(
    Object.entries({
      reading,
      sequence,
      embedded,
      tablePage,
      footnotePage,
      sidenotePage,
      canvas,
      imagePage,
    }).map(([key, page]) => [key, page?.slug ?? null]),
  ),
  zoomMethod:
    "200% computed text scaling and a separate 720px reflow viewport. Native browser zoom was not tested.",
  scenarios: [],
  screenshots: [],
  limitations: [],
}
if (!sidenotePage)
  report.limitations.push(
    "No production sidenote exists. The historical synthetic sidenote fixture is preserved but was not rebuilt by this production acceptance run.",
  )
if (!footnotePage)
  report.limitations.push(
    "No production footnote exists. The historical synthetic footnote fixture is preserved but was not rebuilt by this production acceptance run.",
  )
let browser, preview
function check(scenario, condition, name, details) {
  scenario.checks.push({
    name,
    passed: Boolean(condition),
    ...(details === undefined ? {} : { details }),
  })
  console.log((condition ? "PASS " : "FAIL ") + scenario.name + ": " + name)
}
const urlFor = (base, mount, slug) =>
  base + mount + (slug === "index" ? "" : slug.split("/").map(encodeURIComponent).join("/"))
async function screenshot(page, name) {
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  const destination = path.join(screenshots, (liveSite ? "live-" : "") + name + ".png")
  await page.screenshot({ path: destination, animations: "disabled" })
  report.screenshots.push(path.relative(root, destination).replaceAll(path.sep, "/"))
}
const dimensions = (page) =>
  page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
const fits = (metrics) =>
  metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1
async function goto(page, mount, selected) {
  await page.goto(urlFor(baseUrl, mount, selected.slug), { waitUntil: "networkidle" })
  await page.evaluate(() => document.fonts.ready)
}
async function checkFootnotes(page, scenario) {
  const ref = page.locator("[data-footnote-ref]").first()
  await ref.focus()
  const href = await ref.getAttribute("href")
  await page.keyboard.press("Enter")
  check(
    scenario,
    await page.evaluate(
      (hash) => Boolean(document.getElementById(decodeURIComponent(hash.slice(1)))),
      href,
    ),
    "Footnote citation targets a real footnote",
  )
  const back = page.locator("[data-footnote-backref]").first()
  await back.focus()
  const returnHref = await back.getAttribute("href")
  await page.keyboard.press("Enter")
  check(
    scenario,
    await page.evaluate(
      (hash) => Boolean(document.getElementById(decodeURIComponent(hash.slice(1)))),
      returnHref,
    ),
    "Footnote return targets its citation",
  )
}
async function scrollRegion(page, scenario, selector, label) {
  const metrics = await page.locator(selector).evaluateAll((elements) =>
    elements.map((element) => ({
      scroll: element.scrollWidth,
      client: element.clientWidth,
      label: element.getAttribute("aria-label"),
      tabIndex: element.tabIndex,
      overflow: getComputedStyle(element).overflowX,
    })),
  )
  check(
    scenario,
    metrics.length > 0 &&
      metrics.every(
        (region) =>
          region.tabIndex >= 0 && region.label && ["auto", "scroll"].includes(region.overflow),
      ),
    label + " regions have focus, accessible labels, and local scrolling",
  )
  const at = metrics.findIndex((region) => region.scroll > region.client + 2)
  if (at >= 0) {
    const region = page.locator(selector).nth(at)
    await region.focus()
    await page.keyboard.press("ArrowRight")
    await page.waitForTimeout(180)
    check(
      scenario,
      await region.evaluate((element) => element.scrollLeft > 0),
      label + " can be scrolled horizontally with the keyboard",
    )
  }
  return at
}
try {
  if (!liveSite) {
    preview = await startPreview({ port: Number(process.env.VERIFY_PORT ?? 8081) })
    baseUrl = preview.url
  }
  browser = await chromium.launch({
    channel: report.browserChannel,
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const mount of liveSite ? [primaryMount] : ["/", "/math-notes/", "/World/"]) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const scenario = {
        name:
          "book-" +
          (liveSite ? "live" : mount === "/" ? "root" : mount === "/World/" ? "world" : "subpath") +
          "-" +
          viewport.width,
        mount,
        viewport,
        checks: [],
        runtimeErrors: [],
        failedResources: [],
      }
      report.scenarios.push(scenario)
      const context = await browser.newContext({ viewport, reducedMotion: "reduce" })
      const page = await context.newPage()
      page.on("pageerror", (error) => scenario.runtimeErrors.push(error.message))
      page.on("console", (message) => {
        if (message.type() === "error") scenario.runtimeErrors.push(message.text())
      })
      page.on("response", (response) => {
        if (response.status() >= 400)
          scenario.failedResources.push({ url: response.url(), status: response.status() })
      })
      page.on("requestfailed", (request) =>
        scenario.failedResources.push({ url: request.url(), reason: request.failure()?.errorText }),
      )
      try {
        await goto(page, mount, { slug: "index" })
        check(
          scenario,
          (await page.locator("h1").count()) === 1 &&
            (await page.locator(".home-article").count()) === 1,
          "Home is a Markdown reading entrance with one title",
        )
        check(
          scenario,
          await page.locator(".book-search-launch-input").isVisible(),
          "Home includes a visible search input",
        )
        check(
          scenario,
          (await page.locator(".home-graph .note-graph-node").count()) > 2,
          "Home graph contains real published notes",
        )
        check(
          scenario,
          fits(await dimensions(page)),
          "Home does not overflow horizontally",
          await dimensions(page),
        )
        await page.keyboard.press("Tab")
        check(
          scenario,
          await page
            .locator(".skip-link")
            .evaluate(
              (element) =>
                element === document.activeElement &&
                getComputedStyle(element).outlineStyle !== "none",
            ),
          "First keyboard target is a visibly focused skip link",
        )
        await page.keyboard.press("Enter")
        check(
          scenario,
          await page.locator("article").evaluate((element) => element === document.activeElement),
          "Skip link focuses the article",
        )
        if (mount === primaryMount) {
          await page.evaluate(() => window.scrollTo(0, 0))
          await screenshot(page, "book-home-" + viewport.width)
        }
        await goto(page, mount, reading)
        const articleBox = await page.locator("article").boundingBox()
        check(
          scenario,
          articleBox.width <= 760 && articleBox.width >= (viewport.width >= 1024 ? 680 : 300),
          "Long article retains the intended reading width",
          articleBox,
        )
        check(
          scenario,
          fits(await dimensions(page)),
          "Long article does not overflow the page",
          await dimensions(page),
        )
        const directory = page.locator(".book-directory")
        const summary = directory.locator(":scope > summary")
        const initiallyOpen = await directory.evaluate((element) => element.open)
        await summary.focus()
        await page.keyboard.press("Enter")
        check(
          scenario,
          (await directory.evaluate((element) => element.open)) !== initiallyOpen,
          "Keyboard toggles the textbook directory",
        )
        if (!(await directory.evaluate((element) => element.open)))
          await page.keyboard.press("Enter")
        check(
          scenario,
          await page.locator('.book-navigation a[aria-current="page"]').isVisible(),
          "Current note appears in its expanded directory branch",
        )
        if (viewport.width < 1280) {
          await summary.focus()
          await page.keyboard.press("Enter")
        }
        const toc =
          viewport.width < 1280 ? page.locator(".mobile-toc") : page.locator(".reading-toc")
        if (viewport.width < 1280) {
          await toc.locator("summary").focus()
          await page.keyboard.press("Enter")
        }
        const anchors = await toc
          .locator("a")
          .evaluateAll((links) => links.map((link) => link.hash))
        check(
          scenario,
          anchors.length > 0 &&
            (await page.evaluate(
              (hashes) =>
                hashes.every((hash) => document.getElementById(decodeURIComponent(hash.slice(1)))),
              anchors,
            )),
          "Every contents link targets a real heading",
        )
        await toc.locator("a").first().focus()
        await page.keyboard.press("Enter")
        check(scenario, Boolean(new URL(page.url()).hash), "Keyboard activates a contents anchor")
        const math = await page.locator("article").evaluate((article) => ({
          visual: article.querySelectorAll(".katex-html").length,
          mathml: article.querySelectorAll("math").length,
          errors: article.querySelectorAll(".katex-error").length,
          font: getComputedStyle(article).fontFamily,
          size: getComputedStyle(article).fontSize,
        }))
        check(
          scenario,
          math.visual > 0 && math.mathml === math.visual && math.errors === 0,
          "Math has visual HTML and MathML without renderer errors",
          math,
        )
        check(
          scenario,
          math.font.includes("Noto Serif SC") && parseFloat(math.size) >= 18,
          "Article uses the intended serif face and readable size",
        )
        check(
          scenario,
          await page.evaluate(() =>
            [...document.fonts].some(
              (face) => face.family.includes("Noto Serif SC") && face.status === "loaded",
            ),
          ),
          "The local Chinese prose font actually loads",
        )
        await scrollRegion(page, scenario, ".math-scroll", "Formula")
        if (sequence) {
          await goto(page, mount, sequence)
          const links = page.locator(
            '.reading-sequence a[rel="prev"], .reading-sequence a[rel="next"]',
          )
          check(
            scenario,
            (await links.count()) === 2,
            "Chapter order provides previous and next sections",
          )
          const href = await links.last().getAttribute("href")
          await links.last().focus()
          await Promise.all([
            page.waitForURL(new URL(href, page.url()).href),
            page.keyboard.press("Enter"),
          ])
          check(
            scenario,
            (await page.locator("article").count()) === 1,
            "Next section opens a generated reading page",
          )
        }
        if (embedded) {
          await goto(page, mount, embedded)
          const block = page.locator("blockquote.transclude")
          check(
            scenario,
            (await block.count()) > 0 && (await block.first().innerText()).length > 100,
            "A real note embed contains rendered linked material",
          )
          check(
            scenario,
            fits(await dimensions(page)),
            "Transcluded material stays within the viewport",
            await dimensions(page),
          )
        }
        if (tablePage) {
          await goto(page, mount, tablePage)
          await scrollRegion(page, scenario, ".table-scroll", "Table")
          check(
            scenario,
            fits(await dimensions(page)),
            "Tables do not widen the document",
            await dimensions(page),
          )
        }
        if (imagePage) {
          await goto(page, mount, imagePage)
          const images = await page
            .locator('article img[src*="assets/"]')
            .evaluateAll((images) =>
              images.map((image) => image.complete && image.naturalWidth > 0),
            )
          check(
            scenario,
            images.length > 0 && images.every(Boolean),
            "Approved article illustrations load",
          )
          check(
            scenario,
            fits(await dimensions(page)),
            "Illustrations respect the reading width",
            await dimensions(page),
          )
        }
        if (canvas) {
          await goto(page, mount, canvas)
          check(
            scenario,
            (await page.locator(".canvas-reading-map svg").count()) > 0,
            "A real Canvas renders an SVG map",
          )
          const open = page.locator(".canvas-open").first()
          if (await open.count()) {
            await open.click()
            const dialog = page.locator("dialog.canvas-viewer[open]")
            check(
              scenario,
              (await dialog.count()) === 1,
              "Canvas opens in its native enlarged-view dialog",
            )
            const before = await dialog.locator("svg").first().boundingBox()
            await dialog.getByRole("button", { name: "放大", exact: true }).click()
            const after = await dialog.locator("svg").first().boundingBox()
            check(scenario, after.width > before.width, "Canvas zoom enlarges the SVG")
            await page.keyboard.press("Escape")
            check(
              scenario,
              await open.evaluate((button) => button === document.activeElement),
              "Canvas Escape returns focus to its opener",
            )
          }
          const link = page.locator(".canvas-reading-map svg a[href]").first()
          if (await link.count()) {
            const destination = new URL(await link.getAttribute("href"), page.url()).href
            await link.click()
            await page.waitForLoadState("networkidle")
            check(
              scenario,
              page.url() === destination && (await page.locator("article").count()) === 1,
              "Canvas note click opens its generated page",
            )
          } else check(scenario, false, "Canvas includes a clickable published note")
        }
        if (footnotePage) {
          await goto(page, mount, footnotePage)
          await checkFootnotes(page, scenario)
        }
        if (sidenotePage) {
          await goto(page, mount, sidenotePage)
          const note = page.locator("aside.sidenote").first(),
            box = await note.boundingBox(),
            article = await page.locator("article").boundingBox()
          check(scenario, box?.height > 0, "Production sidenote remains visible")
          check(
            scenario,
            viewport.width >= 1280
              ? box.x >= article.x + article.width - 3
              : box.x >= article.x - 1 && box.x + box.width <= article.x + article.width + 1,
            "Sidenote uses the margin or returns to the article column",
            { box, article },
          )
        }
        if (viewport.width === 390) {
          let found = false
          for (const candidate of formulaPages) {
            await goto(page, mount, candidate)
            const hasOverflow = await page
              .locator(".math-scroll")
              .evaluateAll((regions) =>
                regions.some((region) => region.scrollWidth > region.clientWidth + 2),
              )
            if (hasOverflow) {
              const at = await scrollRegion(page, scenario, ".math-scroll", "Long formula")
              found = at >= 0
              check(
                scenario,
                fits(await dimensions(page)),
                "A real long formula scrolls without widening the phone page",
                await dimensions(page),
              )
              if (mount === primaryMount) {
                await page.locator(".math-scroll").nth(at).scrollIntoViewIfNeeded()
                await screenshot(page, "book-long-formula-390")
              }
              break
            }
          }
          check(scenario, found, "Production notes exercise a genuinely overflowing formula")
        }
        if (mount === primaryMount) {
          await goto(page, mount, reading)
          await screenshot(page, "book-reading-" + viewport.width)
        }
      } catch (error) {
        check(scenario, false, "Scenario completes", error.stack ?? error.message)
      }
      check(
        scenario,
        scenario.runtimeErrors.length === 0,
        "No console or runtime errors",
        scenario.runtimeErrors,
      )
      check(
        scenario,
        scenario.failedResources.length === 0,
        "No missing requested resources",
        scenario.failedResources,
      )
      await context.close()
    }
  }
  for (const mode of ["text-scaling-200", "reflow-720"]) {
    const viewport = { width: mode === "reflow-720" ? 720 : 1440, height: 1000 }
    const scenario = { name: "book-" + mode, viewport, checks: [] }
    report.scenarios.push(scenario)
    const context = await browser.newContext({ viewport, reducedMotion: "reduce" }),
      page = await context.newPage()
    try {
      await goto(page, primaryMount, reading)
      if (mode === "text-scaling-200")
        await page.evaluate(() => {
          const elements = [
            ...document.querySelectorAll(
              ".sidebar.left, .sidebar.left *, .center > header *, article, article p, article h2, article h3, article li, article td, article th",
            ),
          ].filter((element) => !element.closest(".katex, dialog, .note-graph, .table-scroll"))
          const values = elements.map((element) => [
            element,
            parseFloat(getComputedStyle(element).fontSize) * 2,
          ])
          values.forEach(([element, size]) => {
            element.style.fontSize = size + "px"
          })
        })
      check(
        scenario,
        fits(await dimensions(page)),
        "Scaled/reflowed reading fits the document",
        await dimensions(page),
      )
      await page.locator(".skip-link").focus()
      await page.keyboard.press("Enter")
      check(
        scenario,
        await page.locator("article").evaluate((element) => element === document.activeElement),
        "Skip navigation remains usable with enlarged text",
      )
      const rail = await page.locator(".sidebar.left").evaluate((element) => ({
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        overflow: getComputedStyle(element).overflowY,
      }))
      check(
        scenario,
        viewport.width < 1280 || ["auto", "scroll"].includes(rail.overflow),
        "Desktop navigation can scroll independently as text grows",
        rail,
      )
      await page.evaluate(() => window.scrollTo(0, 0))
      await screenshot(page, "book-" + mode)
    } catch (error) {
      check(scenario, false, "Scaled scenario completes", error.stack ?? error.message)
    }
    await context.close()
  }
} catch (error) {
  report.fatalError = error.stack ?? error.message
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.summary = {
    passed: report.scenarios.flatMap((scenario) => scenario.checks).filter((check) => check.passed)
      .length,
    failed: report.scenarios.flatMap((scenario) => scenario.checks).filter((check) => !check.passed)
      .length,
  }
  report.passed = !report.fatalError && report.summary.failed === 0
  await writeFile(
    path.join(artifactRoot, liveSite ? "live-book-browser-report.json" : "browser-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(
    "Browser report: " +
      report.summary.passed +
      " passed, " +
      report.summary.failed +
      " failed" +
      (report.fatalError ? "; " + report.fatalError : "") +
      ".",
  )
  if (!report.passed) process.exitCode = 1
}
