import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const artifactRoot = path.join(root, "artifacts")
const screenshotRoot = path.join(artifactRoot, "screenshots")
const live = process.env.INTERFACE_SITE_URL ? new URL(process.env.INTERFACE_SITE_URL) : undefined
if (live) {
  assert.equal(live.protocol, "https:", "INTERFACE_SITE_URL must use HTTPS")
  assert.ok(!live.username && !live.password && !live.search && !live.hash)
  if (!live.pathname.endsWith("/")) live.pathname += "/"
}
const suffix = live ? "-live" : ""
const report = {
  startedAt: new Date().toISOString(),
  mode: live ? "live" : "local",
  site: live?.href,
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  scope:
    "Visual hierarchy and interface motion; dedicated graph/search/reader suites cover full content behavior",
  inputMethods: ["Playwright mouse and keyboard; mobile viewport emulation, not a physical phone"],
  scenarios: [],
  screenshots: [],
}
const check = (scenario, passed, name, details) => {
  scenario.checks.push({
    name,
    passed: Boolean(passed),
    ...(details === undefined ? {} : { details }),
  })
  console.log(`${passed ? "PASS" : "FAIL"} ${scenario.name}: ${name}`)
}
const urlFor = (site, slug) =>
  new URL(
    slug
      .replace(/(^|\/)index$/, "$1")
      .split("/")
      .map(encodeURIComponent)
      .join("/"),
    site,
  ).href
const geometryKeys = [
  "transform",
  "translate",
  "scale",
  "rotate",
  "height",
  "width",
  "maxHeight",
  "maxWidth",
  "top",
  "left",
  "right",
  "bottom",
  "margin",
  "padding",
]
const moves = (record) =>
  geometryKeys.some((key) => {
    const values = record.frames.map((frame) => frame[key]).filter((value) => value !== undefined)
    return new Set(values).size > 1
  })
async function typography(locator) {
  return locator.evaluate((element) => {
    const css = getComputedStyle(element)
    return {
      tag: element.tagName,
      text: element.textContent.trim().slice(0, 100),
      family: css.fontFamily,
      size: parseFloat(css.fontSize),
      weight: parseFloat(css.fontWeight),
      lineHeight: parseFloat(css.lineHeight),
    }
  })
}
async function settle(locator) {
  await locator.page().waitForFunction(
    (selector) => {
      const target = document.querySelector(selector)
      return (
        target &&
        target
          .getAnimations({ subtree: true })
          .every((animation) => !["running", "pending"].includes(animation.playState))
      )
    },
    await locator.evaluate((element) => {
      if (!element.dataset.interfaceTestId)
        element.dataset.interfaceTestId = `test-${Math.random().toString(36).slice(2)}`
      return `[data-interface-test-id="${element.dataset.interfaceTestId}"]`
    }),
    { timeout: 3000 },
  )
}
async function animations(page) {
  return page.evaluate(() => {
    const current = document.getAnimations().map((animation) => ({
      target:
        animation.effect?.target?.className?.baseVal ?? animation.effect?.target?.className ?? "",
      frames: animation.effect?.getKeyframes?.() ?? [],
      state: animation.playState,
      duration: animation.effect?.getTiming?.().duration,
    }))
    return [...(window.__interfaceAnimations ?? []), ...current]
  })
}
async function fit(scenario, page, label, dialog) {
  const dimensions = await page.evaluate((selector) => {
    const element = selector ? document.querySelector(selector) : document.documentElement
    const rect = element.getBoundingClientRect()
    return {
      document: document.documentElement.scrollWidth,
      viewport: innerWidth,
      x: rect.left,
      right: rect.right,
      width: rect.width,
      scroll: element.scrollWidth,
      client: element.clientWidth,
    }
  }, dialog)
  check(
    scenario,
    dimensions.document <= dimensions.viewport + 1 &&
      (!dialog ||
        (dimensions.x >= -1 &&
          dimensions.right <= dimensions.viewport + 1 &&
          dimensions.scroll <= dimensions.client + 1)),
    `${label} has no horizontal overflow`,
    dimensions,
  )
}
async function shot(page, label, width) {
  const file = path.join(screenshotRoot, `interface${suffix}-${label}-${width}.png`)
  await page.screenshot({ path: file, animations: "disabled" })
  report.screenshots.push(path.relative(root, file).replaceAll(path.sep, "/"))
}
async function hierarchy(scenario, page, label, paragraphSelector) {
  const title = await typography(page.locator("h1").first())
  const paragraph = await typography(page.locator(paragraphSelector).first())
  const heading = await typography(page.locator("#article-content h2").first())
  scenario.metrics[`${label}Typography`] = { title, heading, paragraph }
  check(
    scenario,
    (await page.locator("h1").count()) === 1 &&
      (await page.locator("#article-content[role=main]").count()) === 1,
    `${label} retains one semantic page title and main reading region`,
  )
  check(
    scenario,
    title.weight > paragraph.weight && title.size >= paragraph.size * 1.25,
    `${label} title is visibly larger and heavier than its body`,
    { title, paragraph },
  )
  check(
    scenario,
    heading.weight > paragraph.weight && heading.size > paragraph.size,
    `${label} section heading has distinct weight and size`,
    { heading, paragraph },
  )
  if (label === "reading")
    check(
      scenario,
      paragraph.size >= 17.5 &&
        paragraph.lineHeight / paragraph.size >= 1.7 &&
        paragraph.family.includes("Noto Serif"),
      "Reading retains a Chinese-capable serif body and open line spacing",
      paragraph,
    )
}
async function disclosure(scenario, page, selector, label) {
  const detail = page.locator(selector).first(),
    summary = detail.locator(":scope > summary")
  if (!scenario.metrics.disclosureMotion) {
    const motion = await detail.evaluate((item) => ({
      supported:
        CSS.supports("selector(details::details-content)") &&
        CSS.supports("interpolate-size", "allow-keywords") &&
        CSS.supports("transition-behavior", "allow-discrete"),
      duration: getComputedStyle(item, "::details-content").transitionDuration,
      property: getComputedStyle(item, "::details-content").transitionProperty,
    }))
    scenario.metrics.disclosureMotion = motion
    const durations = motion.duration
      .split(",")
      .map((value) => (value.trim().endsWith("ms") ? parseFloat(value) : parseFloat(value) * 1000))
    check(
      scenario,
      !motion.supported ||
        (durations.some((duration) => duration > 0) &&
          durations.every((duration) => duration <= 220)),
      motion.supported
        ? "Supported native disclosures enable a short transition"
        : "Browser uses the native disclosure fallback without forced animation",
      motion,
    )
  }
  await summary.scrollIntoViewIfNeeded()
  await summary.focus()
  if (await detail.evaluate((item) => item.open)) {
    await page.keyboard.press("Enter")
    await settle(detail)
  }
  await page.keyboard.press("Enter")
  await settle(detail)
  check(
    scenario,
    await detail.evaluate((item) => item.open && item.contains(document.activeElement)),
    `${label} opens with the keyboard and retains summary focus`,
  )
  await page.keyboard.press("Enter")
  await settle(detail)
  for (let i = 0; i < 5; i++) await page.keyboard.press("Enter")
  await settle(detail)
  const readable = await detail.evaluate((item) => {
    const children = [...item.children].filter((child) => child.tagName !== "SUMMARY")
    const clipped = [item, ...children].filter((child) => {
      const css = getComputedStyle(child)
      return (
        ["hidden", "clip"].includes(css.overflowY) && child.scrollHeight > child.clientHeight + 1
      )
    })
    return {
      open: item.open,
      height: item.getBoundingClientRect().height,
      contentVisible: children.some(
        (child) =>
          child.getBoundingClientRect().height > 0 &&
          getComputedStyle(child).visibility !== "hidden",
      ),
      clipped: clipped.map((child) => child.className),
    }
  })
  check(
    scenario,
    readable.open && readable.contentVisible && readable.clipped.length === 0,
    `${label} remains open and unclipped after five rapid toggles`,
    readable,
  )
}
async function waitReader(page) {
  await page.locator(".knowledge-reader[open] .knowledge-reader-body .markdown-content").waitFor()
  await page.waitForFunction(() => !document.querySelector(".knowledge-reader-status")?.textContent)
}
await mkdir(screenshotRoot, { recursive: true })
let preview, browser
try {
  if (!live) preview = await startPreview({ port: Number(process.env.INTERFACE_VERIFY_PORT ?? 0) })
  const site = live?.href ?? `${preview.url}/World/`
  report.site = site
  browser = await chromium.launch({
    channel: report.browserChannel,
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const scenario = {
      name: `interface${suffix}-${viewport.width}`,
      viewport,
      checks: [],
      metrics: {},
      errors: [],
      missingResources: [],
    }
    report.scenarios.push(scenario)
    const context = await browser.newContext({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: "no-preference",
    })
    await context.addInitScript(() => {
      window.__interfaceAnimations = []
      const animate = Element.prototype.animate
      Element.prototype.animate = function (...args) {
        const animation = Reflect.apply(animate, this, args)
        window.__interfaceAnimations.push({
          target: this.className?.baseVal ?? this.className,
          frames: animation.effect?.getKeyframes?.() ?? [],
          duration: animation.effect?.getTiming?.().duration,
          reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
        })
        return animation
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(12000)
    page.on("pageerror", (error) => scenario.errors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") scenario.errors.push(message.text())
    })
    page.on("response", (response) => {
      if (response.status() >= 400)
        scenario.missingResources.push({ url: response.url(), status: response.status() })
    })
    page.on("requestfailed", (request) =>
      scenario.missingResources.push({ url: request.url(), error: request.failure()?.errorText }),
    )
    try {
      const response = await page.goto(site, { waitUntil: "networkidle" })
      check(scenario, response?.ok(), "Published interface loads")
      await page.evaluate(() => document.fonts.ready)
      const indexResponse = await context.request.get(new URL("static/bookIndex.json", site).href)
      assert.ok(indexResponse.ok())
      const index = await indexResponse.json(),
        book = index.catalog.books[0],
        section = book.chapters
          .flatMap((chapter) => chapter.sections)
          .find((item) => item.knowledge.length)
      assert.ok(section, "A real reading section offers knowledge links")
      const bookUrl = urlFor(site, book.slug),
        readingUrl = urlFor(site, section.slug)
      scenario.metrics.source = {
        book: book.slug,
        reading: section.slug,
        knowledge: section.knowledge[0],
      }
      await hierarchy(scenario, page, "home", ".article-deck")
      await fit(scenario, page, "Home")
      await shot(page, "home", viewport.width)
      const enter = page.locator(".shelf-enter").first()
      const styles = () =>
        enter.evaluate((item) => {
          const css = getComputedStyle(item)
          return {
            color: css.color,
            background: css.backgroundColor,
            border: css.borderColor,
            shadow: css.boxShadow,
            transform: css.transform,
            filter: css.filter,
          }
        })
      await page.mouse.move(0, 0)
      await settle(enter)
      const resting = await styles()
      await enter.hover()
      await settle(enter)
      const hovered = await styles()
      await page.mouse.down()
      await settle(enter)
      const pressed = await styles()
      await page.mouse.move(0, 0)
      await page.mouse.up()
      check(
        scenario,
        JSON.stringify(resting) !== JSON.stringify(hovered),
        "Primary reading entrance provides visible hover feedback",
        { resting, hovered },
      )
      check(
        scenario,
        JSON.stringify(hovered) !== JSON.stringify(pressed),
        "Primary reading entrance provides distinct pressed feedback",
        { hovered, pressed },
      )
      await disclosure(scenario, page, "#about-notes > details", "Ancillary disclosure")

      await page.goto(bookUrl, { waitUntil: "networkidle" })
      await hierarchy(scenario, page, "book", ".article-deck")
      await fit(scenario, page, "Book")
      await shot(page, "book", viewport.width)
      await disclosure(scenario, page, ".future-chapters", "Planning disclosure")
      const graphTrigger = page.locator(".note-graph-open").first()
      await graphTrigger.focus()
      await page.keyboard.press("Enter")
      const graph = page.locator("dialog.note-graph-dialog[open]")
      await graph.waitFor()
      await graph.locator('[data-graph-action="book"]').focus()
      check(
        scenario,
        await graph.evaluate((item) => item.contains(document.activeElement)),
        "Graph controls are focusable during entry",
      )
      await settle(graph)
      const graphAnimations = await animations(page)
      scenario.metrics.graphAnimations = graphAnimations
      check(
        scenario,
        graphAnimations.some(
          (animation) =>
            String(animation.target).includes("note-graph-dialog") &&
            Number(animation.duration) > 0 &&
            Number(animation.duration) <= 220,
        ),
        "Graph has a real bounded entrance animation",
      )
      await fit(scenario, page, "Graph dialog", "dialog.note-graph-dialog[open]")
      await shot(page, "graph", viewport.width)
      await page.keyboard.press("Escape")
      await page.locator("dialog.note-graph-dialog[open]").waitFor({ state: "hidden" })
      check(
        scenario,
        await graphTrigger.evaluate((item) => item === document.activeElement),
        "Graph dismissal restores its trigger focus",
      )

      await page.goto(readingUrl, { waitUntil: "networkidle" })
      await hierarchy(
        scenario,
        page,
        "reading",
        "#article-content .markdown-content p:not(.note-tags):not(.note-provenance)",
      )
      await fit(scenario, page, "Reading")
      await shot(page, "reading", viewport.width)
      await disclosure(scenario, page, ".section-knowledge", "Knowledge disclosure")
      const link = page
        .locator(`.section-knowledge [data-reader-slug=${JSON.stringify(section.knowledge[0])}]`)
        .first()
      const independentHref = await link.evaluate((item) => item.href)
      if (viewport.width === 1440) {
        const opened = context.waitForEvent("page")
        await link.click({ modifiers: ["Control"] })
        const popup = await opened
        await popup.waitForLoadState("domcontentloaded")
        check(
          scenario,
          decodeURI(popup.url()) === decodeURI(independentHref) && page.url() === readingUrl,
          "Ctrl-click retains native independent reading",
        )
        await popup.close()
      }
      await link.focus()
      await page.keyboard.press("Enter")
      const panel = page.locator("dialog.knowledge-reader[open]")
      await panel.waitFor()
      await panel.locator(".knowledge-reader-close").focus()
      check(
        scenario,
        await panel.evaluate((item) => item.contains(document.activeElement)),
        "Reader controls are focusable during entry",
      )
      await waitReader(page)
      await settle(panel)
      const panelTitle = await typography(panel.locator("#knowledge-reader-title")),
        panelBody = await typography(
          panel.locator(".markdown-content p:not(.note-tags):not(.note-provenance)").first(),
        )
      check(
        scenario,
        panelTitle.size > panelBody.size && panelTitle.weight > panelBody.weight,
        "Reading panel preserves a distinct heading and body",
        { panelTitle, panelBody },
      )
      await fit(scenario, page, "Reader panel", "dialog.knowledge-reader[open]")
      await shot(page, "panel", viewport.width)
      await page.keyboard.press("Escape")
      await panel.waitFor({ state: "hidden" })
      check(
        scenario,
        await link.evaluate((item) => item === document.activeElement),
        "Reader dismissal restores the source link focus",
      )

      const searchTrigger = page.locator(
        viewport.width < 600 ? ".book-search-open" : ".book-search-launch-input",
      )
      await searchTrigger.click()
      const search = page.locator("dialog.book-search-dialog[open]"),
        query = page.locator(".book-search-query")
      await search.waitFor()
      await query.fill("度量")
      check(
        scenario,
        (await query.inputValue()) === "度量" &&
          (await query.evaluate((item) => item === document.activeElement)),
        "Search accepts typing during entry",
      )
      await page.locator(".book-search-result").first().waitFor()
      await settle(search)
      await fit(scenario, page, "Search dialog", "dialog.book-search-dialog[open]")
      await shot(page, "search", viewport.width)
      await page.keyboard.press("Escape")
      const searchClosed = await search.waitFor({ state: "hidden", timeout: 1000 }).then(
        () => true,
        () => false,
      )
      check(scenario, searchClosed, "One Escape dismisses search while its query has text")
      if (!searchClosed) await search.locator(".book-search-close").click()
      check(
        scenario,
        await searchTrigger.evaluate((item) => item === document.activeElement),
        "Search dismissal restores its opener focus",
      )
      scenario.metrics.normalAnimations = await animations(page)
      for (const name of ["knowledge-reader", "book-search-dialog"])
        check(
          scenario,
          scenario.metrics.normalAnimations.some(
            (animation) =>
              String(animation.target).includes(name) &&
              Number(animation.duration) > 0 &&
              Number(animation.duration) <= 220,
          ),
          `${name} has a real bounded entrance animation`,
        )

      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.evaluate(() => {
        window.__interfaceAnimations = []
      })
      const reducedDisclosure = await page.locator(".section-knowledge").evaluate((item) => ({
        duration: getComputedStyle(item, "::details-content").transitionDuration,
        property: getComputedStyle(item, "::details-content").transitionProperty,
      }))
      scenario.metrics.reducedDisclosure = reducedDisclosure
      check(
        scenario,
        reducedDisclosure.duration.split(",").every((duration) => parseFloat(duration) === 0),
        "Reduced-motion disables the native disclosure transition",
        reducedDisclosure,
      )
      await disclosure(scenario, page, ".section-knowledge", "Reduced-motion knowledge disclosure")
      await link.focus()
      await page.keyboard.press("Enter")
      await waitReader(page)
      const reducedPanel = await animations(page)
      check(
        scenario,
        !reducedPanel.some(moves),
        "Reduced-motion reader and disclosures have no displacement animations",
        reducedPanel,
      )
      await page.keyboard.press("Escape")
      await page.locator("dialog.knowledge-reader[open]").waitFor({ state: "hidden" })
      await searchTrigger.click()
      await search.waitFor()
      check(
        scenario,
        !(await animations(page)).some(moves),
        "Reduced-motion search has no displacement animation",
      )
      await query.fill("compactness")
      check(
        scenario,
        (await query.inputValue()) === "compactness",
        "Reduced-motion search remains operable",
      )
      await search.locator(".book-search-close").click()
      await page.goto(bookUrl, { waitUntil: "networkidle" })
      await page.locator(".note-graph-open").first().click()
      await page.locator("dialog.note-graph-dialog[open]").waitFor()
      check(
        scenario,
        !(await animations(page)).some(moves),
        "Reduced-motion graph has no displacement animation",
      )
      await page.keyboard.press("Escape")
      await page.locator("dialog.note-graph-dialog[open]").waitFor({ state: "hidden" })
    } catch (error) {
      check(scenario, false, "Scenario completes", error.stack ?? error.message)
    } finally {
      check(
        scenario,
        scenario.errors.length === 0,
        "No browser runtime or console errors",
        scenario.errors,
      )
      check(
        scenario,
        scenario.missingResources.length === 0,
        "No failed interface resources",
        scenario.missingResources,
      )
      await context.close()
    }
  }
} catch (error) {
  report.fatalError = error.stack ?? error.message
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  const checks = report.scenarios.flatMap((scenario) => scenario.checks)
  report.summary = {
    passed: checks.filter((item) => item.passed).length,
    failed: checks.filter((item) => !item.passed).length,
  }
  report.passed = !report.fatalError && report.scenarios.length === 3 && report.summary.failed === 0
  await writeFile(
    path.join(artifactRoot, `interface${suffix}-report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    `\nInterface report: ${report.summary.passed} passed, ${report.summary.failed} failed.`,
  )
  if (report.fatalError) console.error(report.fatalError)
  if (!report.passed) process.exitCode = 1
}
