import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const artifactRoot = path.join(root, "artifacts")
const screenshots = path.join(artifactRoot, "screenshots")
await mkdir(screenshots, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  zoomMethod:
    "200% computed text scaling; separate 720px viewport reflow. Native browser zoom was not tested.",
  scenarios: [],
  screenshots: [],
}
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
async function recordScreenshot(page, name, options = {}) {
  const output = path.join(screenshots, `${name}.png`)
  await page.screenshot({ path: output, animations: "disabled", ...options })
  report.screenshots.push(path.relative(root, output).replaceAll(path.sep, "/"))
}
async function settle(page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)
}
async function overflow(page) {
  return page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
}
const fits = (metrics) =>
  metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1
async function focusState(page) {
  return page.evaluate(() => {
    const element = document.activeElement
    const style = getComputedStyle(element)
    return {
      tag: element.tagName,
      id: element.id,
      className: typeof element.className === "string" ? element.className : "",
      role: element.getAttribute("role"),
      outline: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
      boxShadow: style.boxShadow,
      visible:
        element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0,
    }
  })
}
const focusVisible = (state) =>
  state.visible &&
  ((state.outline !== "none" && parseFloat(state.outlineWidth) > 0) || state.boxShadow !== "none")

try {
  preview = await startPreview({ port: Number(process.env.VERIFY_PORT ?? 8081) })
  browser = await chromium.launch({ channel: report.browserChannel, headless: true })
  report.browserVersion = browser.version()
  for (const mount of ["/", "/math-notes/", "/World/"]) {
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 1024, height: 900 },
      { width: 390, height: 844 },
    ]) {
      const name = `${mount === "/" ? "root" : mount === "/World/" ? "world" : "subpath"}-${viewport.width}`
      const scenario = {
        name,
        mount,
        viewport,
        checks: [],
        metrics: {},
        runtimeErrors: [],
        failedResources: [],
        externalRequests: [],
      }
      report.scenarios.push(scenario)
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 })
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
        scenario.failedResources.push({ url: request.url(), error: request.failure()?.errorText }),
      )
      page.on("request", (request) => {
        if (/^https?:/.test(request.url()) && !request.url().startsWith(preview.url))
          scenario.externalRequests.push(request.url())
      })
      const homeUrl = `${preview.url}${mount}`
      try {
        const response = await page.goto(homeUrl, { waitUntil: "networkidle" })
        check(scenario, response?.ok(), "Article loads from the production artifact")
        await settle(page)
        scenario.metrics.overflow = await overflow(page)
        check(
          scenario,
          fits(scenario.metrics.overflow),
          "Document has no horizontal overflow",
          scenario.metrics.overflow,
        )
        const article = page.locator("article#article-content")
        const articleBox = await article.boundingBox()
        check(
          scenario,
          articleBox &&
            articleBox.width >= (viewport.width >= 1024 ? 680 : 300) &&
            articleBox.width <= 760,
          "Article width fits the intended reading range",
          articleBox,
        )
        const note = article.locator("aside.sidenote").first()
        const noteBox = await note.boundingBox()
        const noteStyle = await note.evaluate((element) => ({
          position: getComputedStyle(element).position,
          display: getComputedStyle(element).display,
        }))
        check(
          scenario,
          noteBox && noteBox.width > 0 && noteStyle.display !== "none",
          "Sidenote remains visible",
        )
        check(
          scenario,
          viewport.width >= 1280
            ? noteBox.x >= articleBox.x + articleBox.width - 2
            : noteBox.x >= articleBox.x - 1 &&
                noteBox.x + noteBox.width <= articleBox.x + articleBox.width + 1 &&
                !["absolute", "fixed"].includes(noteStyle.position),
          "Sidenote occupies the margin or returns to the article flow",
          { articleBox, noteBox, noteStyle },
        )
        const noteOrder = await note.evaluate((element) => ({
          previous: element.previousElementSibling?.textContent?.trim().slice(0, 100),
          next: element.nextElementSibling?.textContent?.trim().slice(0, 100),
          withinArticle: Boolean(element.closest("article")),
        }))
        check(
          scenario,
          noteOrder.withinArticle && noteOrder.previous && noteOrder.next,
          "Sidenote has preceding and following content in source order",
          noteOrder,
        )
        check(
          scenario,
          viewport.width >= 1280
            ? (await page.locator("nav.reading-toc").isVisible()) &&
                !(await page.locator("details.mobile-toc").isVisible())
            : (await page.locator("details.mobile-toc").isVisible()) &&
                !(await page.locator("nav.reading-toc").isVisible()),
          "Responsive table-of-contents layout is correct",
        )
        const formulas = await page.locator(".math-scroll").evaluateAll((elements) =>
          elements.map((element) => ({
            width: element.clientWidth,
            contentWidth: element.scrollWidth,
            hasMathML: Boolean(element.querySelector("math")),
            hasHTML: Boolean(element.querySelector(".katex-html")),
            named: Boolean(element.getAttribute("aria-label")),
            focusable: element.tabIndex === 0,
            overflowY: getComputedStyle(element).overflowY,
            displayHeight: element.querySelector(".katex-display")?.getBoundingClientRect().height,
            height: element.clientHeight,
          })),
        )
        scenario.metrics.formulas = formulas
        check(
          scenario,
          formulas.length >= 3 &&
            formulas.every((f) => f.hasMathML && f.hasHTML && f.named && f.focusable),
          "All display mathematics retains accessible HTML and MathML",
          formulas,
        )
        check(
          scenario,
          formulas.every((f) => f.displayHeight <= f.height + 1),
          "Display formulas have sufficient vertical container height",
          formulas,
        )
        check(
          scenario,
          (await page.locator(".katex-error").count()) === 0,
          "No KaTeX rendering errors",
        )
        const fonts = await page.evaluate(() => ({
          status: document.fonts.status,
          loaded: [...document.fonts]
            .filter((font) => font.status === "loaded")
            .map((font) => font.family),
          bodyFamily: getComputedStyle(document.querySelector("article p")).fontFamily,
        }))
        scenario.metrics.fonts = fonts
        check(
          scenario,
          fonts.status === "loaded" &&
            fonts.loaded.some((name) => /Noto Serif SC/.test(name)) &&
            fonts.loaded.some((name) => /KaTeX/.test(name)),
          "Local prose and mathematics fonts actually loaded",
          fonts,
        )
        await page.evaluate(() => window.scrollTo(0, 0))
        if (mount === "/") {
          await recordScreenshot(page, `${name}-top`)
          await recordScreenshot(page, `${name}-full`, { fullPage: true })
        }
        await page.keyboard.press("Tab")
        let focused = await focusState(page)
        check(
          scenario,
          focused.className.includes("skip-link") && focusVisible(focused),
          "First keyboard focus is the visible skip link",
          focused,
        )
        await page.keyboard.press("Enter")
        focused = await focusState(page)
        check(
          scenario,
          focused.id === "article-content",
          "Skip link moves keyboard focus to the article",
          focused,
        )
        await page.keyboard.press("Tab")
        focused = await focusState(page)
        check(
          scenario,
          focused.visible &&
            ["A", "SUMMARY", "BUTTON", "DIV"].includes(focused.tag) &&
            focusVisible(focused),
          "Tab after article reaches a visible focusable reading control",
          focused,
        )
        if (viewport.width < 1280) {
          const summary = page.locator("details.mobile-toc > summary")
          await summary.focus()
          const before = await page
            .locator("details.mobile-toc")
            .evaluate((element) => element.open)
          await page.keyboard.press("Enter")
          const after = await page.locator("details.mobile-toc").evaluate((element) => element.open)
          check(scenario, before !== after, "Compact contents toggles with the keyboard")
          if (!after) await page.keyboard.press("Enter")
        }
        const tocLink = page
          .locator(viewport.width >= 1280 ? "nav.reading-toc a" : "details.mobile-toc a")
          .first()
        const tocHref = await tocLink.getAttribute("href")
        await tocLink.focus()
        await page.keyboard.press("Enter")
        await settle(page)
        check(
          scenario,
          new URL(page.url()).hash === new URL(tocHref, homeUrl).hash &&
            (await page.locator(new URL(page.url()).hash).count()) === 1,
          "Heading navigation works using the keyboard",
        )
        const longIndex = formulas.reduce(
          (max, formula, index) =>
            formula.contentWidth - formula.width > formulas[max].contentWidth - formulas[max].width
              ? index
              : max,
          0,
        )
        const longFormula = page.locator(".math-scroll").nth(longIndex)
        check(
          scenario,
          formulas[longIndex].contentWidth > formulas[longIndex].width + 1,
          "Long formula overflows only its local container",
          formulas[longIndex],
        )
        await longFormula.scrollIntoViewIfNeeded()
        await longFormula.evaluate((element) => {
          element.scrollLeft = 0
        })
        await longFormula.focus()
        focused = await focusState(page)
        check(
          scenario,
          focusVisible(focused),
          "Formula region has a visible keyboard focus ring",
          focused,
        )
        await page.keyboard.press("ArrowRight")
        await page.waitForTimeout(250)
        const scrollLeft = await longFormula.evaluate((element) => element.scrollLeft)
        check(scenario, scrollLeft > 0, "ArrowRight scrolls the long formula locally", {
          scrollLeft,
        })
        check(
          scenario,
          fits(await overflow(page)),
          "Formula keyboard scrolling does not overflow the document",
        )
        if (mount === "/" && viewport.width === 390) {
          await recordScreenshot(page, "root-390-long-formula")
          await note.scrollIntoViewIfNeeded()
          await recordScreenshot(page, "root-390-sidenote")
        }
        const ref = article.locator("a[data-footnote-ref]").first()
        await ref.focus()
        await page.keyboard.press("Enter")
        await settle(page)
        const refDestination = new URL(page.url()).hash
        check(
          scenario,
          refDestination.includes("fn-") && (await page.locator(refDestination).count()) === 1,
          "Footnote reference follows a valid target with the keyboard",
        )
        const backref = article.locator("a[data-footnote-backref]").first()
        await backref.focus()
        await page.keyboard.press("Enter")
        await settle(page)
        check(
          scenario,
          new URL(page.url()).hash.includes("fnref-") &&
            (await page.locator(new URL(page.url()).hash).count()) === 1,
          "Footnote return link works with the keyboard",
        )
        const internal = article.locator('a.internal[href*="complete-metric-spaces"]').first()
        await internal.focus()
        await page.keyboard.press("Enter")
        await page.waitForURL(/complete-metric-spaces/)
        await settle(page)
        check(
          scenario,
          new URL(page.url()).pathname.startsWith(`${mount}notes/complete-metric-spaces`) &&
            (await page.locator("article#article-content").count()) === 1,
          "Internal Markdown link opens the generated related note within its mount",
        )
        const noteLinks = page.locator("article#article-content a.internal")
        let returnLink
        for (let index = 0; index < (await noteLinks.count()); index++) {
          const link = noteLinks.nth(index)
          const href = await link.getAttribute("href")
          const destination = new URL(href, page.url()).pathname
          if ([mount, `${mount}index`, `${mount}index.html`].includes(destination)) {
            returnLink = link
            break
          }
        }
        if (!returnLink)
          throw new Error("Related Markdown note has no return link to the home article")
        await returnLink.focus()
        await page.keyboard.press("Enter")
        await page.waitForURL(
          (url) => [mount, `${mount}index`, `${mount}index.html`].includes(url.pathname),
          { waitUntil: "networkidle" },
        )
        await settle(page)
        check(
          scenario,
          [mount, `${mount}index`, `${mount}index.html`].includes(new URL(page.url()).pathname),
          "Related note returns to the article using the keyboard",
        )
        check(
          scenario,
          scenario.runtimeErrors.length === 0,
          "No console or uncaught runtime errors",
          scenario.runtimeErrors,
        )
        check(
          scenario,
          scenario.failedResources.length === 0,
          "No missing or failed resource requests",
          scenario.failedResources,
        )
        check(
          scenario,
          scenario.externalRequests.length === 0,
          "Reading requires no external resource requests",
          scenario.externalRequests,
        )
      } catch (error) {
        check(scenario, false, "Scenario completes", error.stack ?? error.message)
        try {
          await recordScreenshot(page, `${name}-failure`)
        } catch {
          /* browser may be unavailable */
        }
      } finally {
        await context.close()
      }
    }
  }
  for (const mode of ["text-scaling-200", "reflow-720"]) {
    const scenario = { name: mode, checks: [] }
    report.scenarios.push(scenario)
    const context = await browser.newContext({
      viewport: { width: mode === "reflow-720" ? 720 : 1440, height: 1000 },
      deviceScaleFactor: 1,
    })
    const page = await context.newPage()
    try {
      await page.goto(`${preview.url}/`, { waitUntil: "networkidle" })
      await settle(page)
      if (mode === "text-scaling-200") {
        await page.evaluate(() => {
          const sizes = [...document.querySelectorAll("body *")]
            .filter(
              (element) =>
                element instanceof HTMLElement && !element.parentElement?.closest(".katex, math"),
            )
            .map((element) => [element, parseFloat(getComputedStyle(element).fontSize)])
          for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
        })
      }
      await settle(page)
      const metrics = await overflow(page)
      check(
        scenario,
        fits(metrics),
        "Scaled/reflowed reading page has no document overflow",
        metrics,
      )
      check(
        scenario,
        (await page.locator("aside.sidenote").isVisible()) &&
          (await page.locator("article#article-content").isVisible()),
        "Article and sidenote remain visible",
      )
      await page.keyboard.press("Tab")
      check(scenario, focusVisible(await focusState(page)), "Keyboard focus remains visible")
      await page.keyboard.press("Enter")
      check(
        scenario,
        (await focusState(page)).id === "article-content",
        "Skip navigation remains usable",
      )
      if (mode === "text-scaling-200") {
        await page.evaluate(() => {
          window.scrollTo(0, 0)
          document.querySelector(".sidebar.left").scrollTop = 0
        })
        const railText = await page.evaluate(() => {
          const rail = document.querySelector(".sidebar.left")
          const serialize = (rect) => ({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            right: rect.right,
            bottom: rect.bottom,
          })
          const railBox = serialize(rail.getBoundingClientRect())
          const headers = [...document.querySelectorAll(".article-eyebrow, h1, .article-deck")].map(
            (element) => serialize(element.getBoundingClientRect()),
          )
          const walker = document.createTreeWalker(rail, NodeFilter.SHOW_TEXT)
          const text = []
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent.trim() || node.parentElement.closest(".skip-link")) continue
            const range = document.createRange()
            range.selectNodeContents(node)
            const rectangles = [...range.getClientRects()]
              .filter((rect) => rect.width > 0 && rect.height > 0)
              .map(serialize)
            if (!rectangles.length) continue
            text.push({
              text: node.textContent.trim(),
              group: node.parentElement.closest(".site-title")
                ? "site-title"
                : node.parentElement.closest(".note-navigation")
                  ? "note-navigation"
                  : "contents",
              rectangles,
              contained: rectangles.every(
                (rect) => rect.x >= railBox.x - 1 && rect.right <= railBox.right + 1,
              ),
              overlapsHeader: rectangles.some((rect) =>
                headers.some(
                  (header) =>
                    Math.min(rect.right, header.right) - Math.max(rect.x, header.x) > 1 &&
                    Math.min(rect.bottom, header.bottom) - Math.max(rect.y, header.y) > 1,
                ),
              ),
            })
          }
          return {
            railBox,
            headers,
            text,
            scrollHeight: rail.scrollHeight,
            clientHeight: rail.clientHeight,
            overflowY: getComputedStyle(rail).overflowY,
          }
        })
        scenario.railTextMetrics = railText
        for (const group of ["site-title", "note-navigation"]) {
          const text = railText.text.filter((entry) => entry.group === group)
          check(
            scenario,
            text.length > 0 && text.every((entry) => entry.contained),
            `200% ${group} text line rectangles stay within the sidebar`,
            text,
          )
        }
        check(
          scenario,
          railText.text.length > 0 && railText.text.every((entry) => entry.contained),
          "200% sidebar text remains within its column, including contents labels",
        )
        check(
          scenario,
          railText.text.every((entry) => !entry.overlapsHeader),
          "200% sidebar text does not overlap the main article header",
          railText.text.filter((entry) => entry.overlapsHeader),
        )
        check(
          scenario,
          railText.scrollHeight > railText.clientHeight &&
            railText.clientHeight <= 1000 &&
            ["auto", "scroll"].includes(railText.overflowY),
          "200% long sidebar is bounded by the viewport and can scroll vertically",
          {
            scrollHeight: railText.scrollHeight,
            clientHeight: railText.clientHeight,
            overflowY: railText.overflowY,
          },
        )
        const railLinks = page.locator(".sidebar.left .reading-toc a")
        await railLinks.first().focus()
        for (let index = 1; index < (await railLinks.count()); index++) {
          await page.keyboard.press("Tab")
        }
        const sidebarFocus = await page.evaluate(() => {
          const rail = document.querySelector(".sidebar.left")
          const links = [...rail.querySelectorAll(".reading-toc a")]
          const focused = document.activeElement
          const rect = focused.getBoundingClientRect()
          const railBox = rail.getBoundingClientRect()
          return {
            isLastLink: focused === links.at(-1),
            scrollTop: rail.scrollTop,
            visible: rect.top >= railBox.top - 1 && rect.bottom <= railBox.bottom + 1,
          }
        })
        check(
          scenario,
          sidebarFocus.isLastLink &&
            sidebarFocus.scrollTop > 0 &&
            sidebarFocus.visible &&
            focusVisible(await focusState(page)),
          "Keyboard Tab reaches the last scaled sidebar link and scrolls its focus into view",
          sidebarFocus,
        )
        await page.locator("article#article-content").focus()
        await page.evaluate(() => {
          document.querySelector(".sidebar.left").scrollTop = 0
          window.scrollTo(0, 0)
        })
        await recordScreenshot(page, "text-scaling-200-top")
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await recordScreenshot(page, mode, { fullPage: true })
    } catch (error) {
      check(scenario, false, "Scenario completes", error.stack ?? error.message)
    } finally {
      await context.close()
    }
  }
} catch (error) {
  report.fatalError = error.stack ?? error.message
  process.exitCode = 1
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed =
    !report.fatalError &&
    report.scenarios.length === 11 &&
    report.scenarios.every(
      (scenario) =>
        scenario.checks.length > 0 && scenario.checks.every((assertion) => assertion.passed),
    )
  report.summary = {
    passed: report.scenarios
      .flatMap((scenario) => scenario.checks)
      .filter((assertion) => assertion.passed).length,
    failed: report.scenarios
      .flatMap((scenario) => scenario.checks)
      .filter((assertion) => !assertion.passed).length,
  }
  await writeFile(
    path.join(artifactRoot, "browser-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    `\nBrowser report: artifacts/browser-report.json; ${report.summary.passed} passed, ${report.summary.failed} failed.`,
  )
  if (!report.passed) process.exitCode = 1
}
