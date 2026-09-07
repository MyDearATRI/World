import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"
const root = fileURLToPath(new URL("../", import.meta.url)),
  live = Boolean(process.env.GRAPH_SITE_URL),
  suffix = live ? "-live" : ""
const artifactRoot = path.join(root, "artifacts"),
  screenshots = path.join(artifactRoot, "screenshots")
await mkdir(screenshots, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  site: process.env.GRAPH_SITE_URL ?? "local /World/",
  inputMethods: [
    "Playwright mouse, wheel and keyboard",
    "Chromium CDP touch drag, pan and pinch; no physical mobile device",
  ],
  scenarios: [],
  screenshots: [],
}
let browser, preview
function check(scenario, condition, name, details) {
  scenario.checks.push({
    name,
    passed: Boolean(condition),
    ...(details === undefined ? {} : { details }),
  })
  console.log(`${condition ? "PASS" : "FAIL"} ${scenario.name}: ${name}`)
}
async function shot(page, name) {
  const file = path.join(screenshots, `graph${suffix}-${name}.png`)
  await page.screenshot({ path: file, animations: "disabled" })
  report.screenshots.push(path.relative(root, file).replaceAll(path.sep, "/"))
}
const node = (graph, id) => graph.locator(`a.note-graph-node[data-id=${JSON.stringify(id)}]`)
const dot = (graph, id) => node(graph, id).locator("circle.note-graph-dot")
const action = (graph, name) => graph.locator(`button[data-graph-action="${name}"]`)
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const hrefFor = (site, slug) => new URL(slug.replace(/(^|\/)index$/, "$1"), site).href
async function point(locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error(`No visible box for ${locator}`)
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
async function matrix(graph) {
  return graph.locator("g.note-graph-layer").evaluate((g) => {
    const m = g.transform.baseVal.consolidate()?.matrix
    return m ? { x: m.e, y: m.f, scale: Math.hypot(m.a, m.b) } : { x: 0, y: 0, scale: 1 }
  })
}
async function pause(graph, page) {
  if ((await graph.getAttribute("data-paused")) !== "true") await action(graph, "pause").click()
  await page.waitForTimeout(60)
}
async function mouseDrag(page, start, delta, held) {
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + delta.x, start.y + delta.y, { steps: 12 })
  await held?.()
  await page.mouse.up()
  await page.waitForTimeout(80)
}
async function touchDrag(session, start, delta, held) {
  const points = (x, y) => [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }]
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: points(start.x, start.y),
  })
  for (let i = 1; i <= 10; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: points(start.x + (delta.x * i) / 10, start.y + (delta.y * i) / 10),
    })
  await held?.()
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}
async function ids(graph) {
  return graph
    .locator("a.note-graph-node")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.id).sort())
}
async function openGraph(page) {
  const graph = page.locator(".note-graph").first(),
    trigger = graph.locator(".note-graph-open")
  await trigger.focus()
  await page.keyboard.press("Enter")
  const dialog = graph.locator("dialog.note-graph-dialog")
  await dialog.waitFor({ state: "visible" })
  await page.waitForTimeout(100)
  return { graph, trigger, dialog }
}
async function defaultChapter(graph, chapterId) {
  await action(graph, "book").click()
  const group = graph.locator(`g.note-graph-chapter[data-chapter-id=${JSON.stringify(chapterId)}]`)
  await group.focus()
  await group.press("Enter")
}
async function labelMetrics(graph) {
  return graph.locator("a.note-graph-node text").evaluateAll((labels) => {
    const rects = labels.map((label) => {
      const b = label.getBoundingClientRect(),
        s = label.closest("svg").getBoundingClientRect()
      return {
        text: label.textContent,
        left: b.left,
        right: b.right,
        top: b.top,
        bottom: b.bottom,
        fits:
          b.left >= s.left - 1 &&
          b.right <= s.right + 1 &&
          b.top >= s.top - 1 &&
          b.bottom <= s.bottom + 1,
      }
    })
    const overlaps = []
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
          b = rects[j]
        if (
          a.left < b.right - 1 &&
          a.right > b.left + 1 &&
          a.top < b.bottom - 1 &&
          a.bottom > b.top + 1
        )
          overlaps.push([a.text, b.text])
      }
    return {
      labels: rects.length,
      outside: rects.filter((rect) => !rect.fits).map((rect) => rect.text),
      overlaps,
    }
  })
}
try {
  if (!live) preview = await startPreview({ port: Number(process.env.VERIFY_PORT ?? 0) })
  const site = new URL(process.env.GRAPH_SITE_URL ?? `${preview.url}/World/`)
  if (!site.pathname.endsWith("/")) site.pathname += "/"
  report.site = site.href
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
      name: `graph${suffix}-${viewport.width}`,
      viewport,
      checks: [],
      metrics: {},
      runtimeErrors: [],
      failedResources: [],
    }
    report.scenarios.push(scenario)
    const context = await browser.newContext({
        viewport,
        hasTouch: viewport.width === 390,
        isMobile: viewport.width === 390,
        deviceScaleFactor: 1,
      }),
      page = await context.newPage()
    page.setDefaultTimeout(12_000)
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
    try {
      const response = await page.goto(site.href, { waitUntil: "networkidle" })
      check(scenario, response?.ok(), "Reader shelf loads under the Pages subpath")
      check(
        scenario,
        (await page.locator(".note-graph").count()) === 0,
        "Shelf has no whole-library graph",
      )
      const indexResponse = await context.request.get(new URL("static/bookIndex.json", site).href),
        index = await indexResponse.json(),
        book = index.catalog.books[0]
      check(
        scenario,
        indexResponse.ok() && Boolean(book?.chapters?.length),
        "Graph test uses the actual published reading catalog",
      )
      const bookUrl = hrefFor(site, book.slug)
      await page.goto(bookUrl, { waitUntil: "networkidle" })
      const inline = page.locator(".note-graph--inline").first()
      const data = await inline.evaluate((element) => JSON.parse(element.dataset.graph))
      scenario.metrics.book = {
        id: data.book.id,
        chapters: data.chapters.map((chapter) => ({
          id: chapter.id,
          count: chapter.knowledge.length,
        })),
      }
      if (viewport.width === 390)
        check(
          scenario,
          (await inline.locator(".note-graph-compact").isVisible()) &&
            !(await inline.locator(".note-graph-inline-host").isVisible()),
          "Mobile book graph starts as chapter links and an explicit open button",
        )
      else
        check(
          scenario,
          await inline.locator(".note-graph-svg").isVisible(),
          "Desktop book graph is directly visible",
        )
      let { graph, trigger, dialog } = await openGraph(page)
      check(
        scenario,
        (await graph.getAttribute("data-graph-level")) === "book" &&
          (await graph.locator("g.note-graph-chapter rect").count()) === data.chapters.length &&
          (await graph.locator("a.note-graph-node").count()) === 0,
        "Book overview shows chapter rectangles, not a cloud of article nodes",
      )
      const chapterTitles = await graph.locator("g.note-graph-chapter").evaluateAll((groups) =>
        groups.map((group) => {
          const chapter = group.__data__,
            rect = group.querySelector("rect"),
            lines = [...group.querySelectorAll(".note-graph-chapter-title tspan")],
            availableWidth = Number(rect.getAttribute("width")) - 32,
            words = (value) => value.match(/[A-Za-z]+/g) ?? []
          return {
            title: chapter.title,
            lines: lines.map((line) => line.textContent),
            availableWidth,
            fits: lines.every((line) => line.getComputedTextLength() <= availableWidth + 1),
            preservesWords:
              JSON.stringify(words(chapter.title)) ===
              JSON.stringify(words(lines.map((line) => line.textContent).join(" "))),
          }
        }),
      )
      scenario.metrics.chapterTitles = chapterTitles
      check(
        scenario,
        chapterTitles.every((title) => title.fits && title.preservesWords),
        "Chapter titles use the card width and preserve complete English words",
        chapterTitles,
      )
      check(
        scenario,
        (await graph.getAttribute("data-running")) === "false",
        "Chapter overview has no force animation",
      )
      const layout = await dialog.evaluate((element) => {
        const b = element.getBoundingClientRect()
        return {
          left: b.left,
          top: b.top,
          right: b.right,
          bottom: b.bottom,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          pageWidth: document.documentElement.scrollWidth,
          scroll: element.scrollWidth,
          client: element.clientWidth,
          named: Boolean(
            document.getElementById(element.getAttribute("aria-labelledby"))?.textContent.trim(),
          ),
        }
      })
      check(
        scenario,
        layout.named &&
          layout.left >= -1 &&
          layout.top >= -1 &&
          layout.right <= layout.viewportWidth + 1 &&
          layout.bottom <= layout.viewportHeight + 1 &&
          layout.pageWidth <= layout.viewportWidth + 1 &&
          layout.scroll <= layout.client + 1,
        "Named graph dialog fits the viewport without document overflow",
        layout,
      )
      await shot(page, `book-${viewport.width}`)
      for (const chapter of data.chapters) {
        await defaultChapter(graph, chapter.id)
        await page.waitForTimeout(100)
        check(
          scenario,
          JSON.stringify(await ids(graph)) === JSON.stringify([...chapter.knowledge].sort()),
          `Chapter ${chapter.id} starts with its real knowledge points only`,
          {
            expected: chapter.knowledge.length,
            actual: await graph.locator("a.note-graph-node").count(),
          },
        )
        const labels = await labelMetrics(graph)
        check(
          scenario,
          labels.labels === chapter.knowledge.length &&
            labels.outside.length === 0 &&
            labels.overlaps.length === 0,
          `Chapter ${chapter.id} labels are visible, separated and inside the canvas`,
          labels,
        )
      }
      const chapter = data.chapters[0]
      await defaultChapter(graph, chapter.id)
      await page.waitForTimeout(100)
      check(
        scenario,
        data.nodes.every(
          (entry) =>
            !index.catalog.pages[entry.id]?.auxiliary &&
            ["reading", "knowledge", "connection", "exercise"].includes(entry.role),
        ) &&
          data.links.every(
            (edge) =>
              data.nodes.some((n) => n.id === edge.source) &&
              data.nodes.some((n) => n.id === edge.target),
          ),
        "Graph data includes real reader content and excludes navigation, demos, planning and Canvas",
      )
      check(
        scenario,
        (await graph.locator(".note-graph-bottom").textContent()).includes("不表示先修顺序"),
        "Graph explicitly describes references rather than invented prerequisites",
      )
      const duplicatedIds = await page.locator("[id]").evaluateAll((elements) => {
        const ids = elements.map((element) => element.id)
        return ids.filter((id, i) => ids.indexOf(id) !== i)
      })
      check(
        scenario,
        duplicatedIds.length === 0,
        "Graph and reader components have unique IDs",
        duplicatedIds,
      )
      await shot(page, `chapter-${viewport.width}`)
      await graph.locator(".note-graph-close").focus()
      await page.keyboard.press("Shift+Tab")
      const lastInside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("dialog.note-graph-dialog")),
      )
      await page.keyboard.press("Tab")
      check(
        scenario,
        lastInside &&
          (await graph
            .locator(".note-graph-close")
            .evaluate((element) => document.activeElement === element)),
        "Tab and Shift+Tab wrap inside the graph modal",
      )
      const focusCss = await graph.locator(".note-graph-close").evaluate((element) => {
        const css = getComputedStyle(element)
        return (
          element.matches(":focus-visible") &&
          css.outlineStyle !== "none" &&
          parseFloat(css.outlineWidth) > 0
        )
      })
      check(scenario, focusCss, "Graph controls show visible keyboard focus")
      await pause(graph, page)
      const dragId = chapter.knowledge[0],
        initial = await point(dot(graph, dragId))
      let held
      await mouseDrag(page, initial, { x: 32, y: 21 }, async () => {
        held = await point(dot(graph, dragId))
      })
      check(
        scenario,
        distance(held, { x: initial.x + 32, y: initial.y + 21 }) < 8,
        "Knowledge node follows the pointer",
      )
      check(
        scenario,
        page.url() === bookUrl &&
          !(await page.locator("dialog.knowledge-reader").isVisible()) &&
          distance(held, await point(dot(graph, dragId))) < 1,
        "Dragging and releasing does not open a reader or navigate",
      )
      const canvas = await graph.locator("svg.note-graph-svg").boundingBox(),
        blank = { x: canvas.x + 16, y: canvas.y + 12 },
        beforePan = await matrix(graph)
      await mouseDrag(page, blank, { x: 30, y: 22 })
      const afterPan = await matrix(graph)
      check(
        scenario,
        Math.abs(afterPan.x - beforePan.x - 30) < 3 && Math.abs(afterPan.y - beforePan.y - 22) < 3,
        "Dragging blank canvas pans the chapter graph",
      )
      await page.mouse.move(blank.x + 50, blank.y + 50)
      await page.mouse.wheel(0, -140)
      await page.waitForTimeout(150)
      const wheel = await matrix(graph)
      check(scenario, wheel.scale > afterPan.scale, "Wheel input zooms the chapter graph")
      await action(graph, "zoom-in").click()
      const zoomed = await matrix(graph)
      await action(graph, "zoom-out").click()
      check(
        scenario,
        zoomed.scale > wheel.scale && (await matrix(graph)).scale < zoomed.scale,
        "Zoom controls work in both directions",
      )
      await action(graph, "reset").click()
      check(
        scenario,
        distance(initial, await point(dot(graph, dragId))) < 5,
        "Reset restores the spread-out chapter layout",
      )
      await pause(graph, page)
      await action(graph, "pause").click()
      check(
        scenario,
        (await graph.getAttribute("data-running")) === "true",
        "Resume enables bounded physical feedback",
      )
      await pause(graph, page)
      check(
        scenario,
        (await graph.getAttribute("data-running")) === "false",
        "Pause stops the force simulation",
      )
      if (viewport.width === 390) {
        const session = await context.newCDPSession(page),
          start = await point(dot(graph, dragId))
        let touched
        await touchDrag(session, start, { x: 22, y: 18 }, async () => {
          touched = await point(dot(graph, dragId))
        })
        check(
          scenario,
          distance(touched, { x: start.x + 22, y: start.y + 18 }) < 10 &&
            !(await page.locator("dialog.knowledge-reader").isVisible()),
          "Native touch drags without opening a note",
        )
        const before = await matrix(graph)
        await touchDrag(session, blank, { x: 22, y: 28 })
        const after = await matrix(graph)
        check(
          scenario,
          Math.abs(after.x - before.x - 22) < 4 && Math.abs(after.y - before.y - 28) < 4,
          "Native touch pans the graph",
        )
        const points = (spread) => [
            { x: canvas.x + canvas.width / 2 - spread, y: canvas.y + 14, id: 1 },
            { x: canvas.x + canvas.width / 2 + spread, y: canvas.y + 14, id: 2 },
          ],
          beforePinch = await matrix(graph)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: points(30),
        })
        for (let i = 1; i <= 8; i++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: points(30 + i * 4),
          })
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        check(
          scenario,
          (await matrix(graph)).scale > beforePinch.scale * 1.2,
          "Native pinch zooms the graph",
        )
        await session.detach()
      }
      const focusTarget =
        chapter.knowledge.find((id) =>
          data.links.some(
            (edge) =>
              (edge.source === id &&
                data.nodes.find((n) => n.id === edge.target)?.chapterId !== chapter.id) ||
              (edge.target === id &&
                data.nodes.find((n) => n.id === edge.source)?.chapterId !== chapter.id),
          ),
        ) ?? dragId
      await graph.locator(".note-graph-focus-select").selectOption(focusTarget)
      await page.waitForTimeout(100)
      const adjacent = new Set([focusTarget])
      for (const edge of data.links) {
        if (edge.source === focusTarget) adjacent.add(edge.target)
        if (edge.target === focusTarget) adjacent.add(edge.source)
      }
      const sameChapter = data.nodes
          .filter((entry) => entry.chapterId === chapter.id && adjacent.has(entry.id))
          .map((entry) => entry.id)
          .sort(),
        crossChapter = data.nodes
          .filter((entry) => entry.chapterId !== chapter.id && adjacent.has(entry.id))
          .map((entry) => entry.id)
          .sort()
      check(
        scenario,
        JSON.stringify(await ids(graph)) === JSON.stringify(sameChapter),
        "Focus shows the selected knowledge point and only its direct same-chapter content",
      )
      const visibleCross = await graph
        .locator(".note-graph-cross a")
        .evaluateAll((links) => links.map((link) => link.dataset.graphRead).sort())
      check(
        scenario,
        JSON.stringify(visibleCross) === JSON.stringify(crossChapter),
        "Cross-chapter references appear as explicit reading entrances",
        { expected: crossChapter.length, actual: visibleCross.length },
      )
      await graph.locator(".note-graph-focus-select").selectOption("")
      await page.waitForTimeout(100)
      const beforeReader = await matrix(graph)
      await node(graph, dragId).focus()
      await page.keyboard.press("Enter")
      const reader = page.locator("dialog.knowledge-reader")
      await reader.waitFor({ state: "visible" })
      await reader.locator(".knowledge-reader-body .markdown-content").waitFor({ state: "visible" })
      check(
        scenario,
        page.url() === bookUrl &&
          (await dialog.isVisible()) &&
          (await reader.locator("#knowledge-reader-title").textContent()) ===
            index.catalog.pages[dragId].title,
        "Enter opens the real knowledge reader above the preserved graph",
      )
      await page.keyboard.press("Escape")
      await reader.waitFor({ state: "hidden" })
      await page.waitForTimeout(80)
      const afterReader = await matrix(graph)
      check(
        scenario,
        (await dialog.isVisible()) &&
          distance(beforeReader, afterReader) < 0.5 &&
          Math.abs(beforeReader.scale - afterReader.scale) < 0.001 &&
          (await node(graph, dragId).evaluate((element) => document.activeElement === element)),
        "Escape closes only the reader and restores the same graph view and focused bubble",
      )
      await dot(graph, dragId).click()
      await reader.waitFor({ state: "visible" })
      check(scenario, page.url() === bookUrl, "Ordinary bubble click uses the reading panel")
      await reader.locator(".knowledge-reader-close").click()
      await reader.waitFor({ state: "hidden" })
      if (viewport.width === 1440) {
        const popupPromise = context.waitForEvent("page")
        await node(graph, dragId).click({ modifiers: ["Control"] })
        const popup = await popupPromise
        await popup.waitForLoadState("domcontentloaded")
        check(
          scenario,
          popup.url() === new URL(data.nodes.find((n) => n.id === dragId).href, bookUrl).href,
          "Ctrl-click preserves native independent note navigation",
        )
        await popup.close()
      }
      await page.keyboard.press("Escape")
      check(
        scenario,
        !(await dialog.isVisible()) && (await graph.getAttribute("data-running")) === "false",
        "Escape closes the graph and stops simulation",
      )
      check(
        scenario,
        await trigger.evaluate((element) => document.activeElement === element),
        "Graph closure returns keyboard focus to its trigger",
      )
      await page.goto(hrefFor(site, book.chapters[0].slug), { waitUntil: "networkidle" })
      const chapterInline = page.locator(".note-graph--inline").first()
      check(
        scenario,
        (await chapterInline.getAttribute("data-graph-level")) === "chapter",
        "A chapter page starts directly in its chapter knowledge view",
      )
      if (viewport.width === 390)
        check(
          scenario,
          (await chapterInline.locator(".note-graph-compact a[data-graph-read]").count()) ===
            chapter.knowledge.length &&
            (await chapterInline.locator(".note-graph-compact").isVisible()),
          "Mobile chapter entry is a complete readable knowledge list",
        )
      await page.emulateMedia({ reducedMotion: "reduce" })
      ;({ graph, trigger, dialog } = await openGraph(page))
      const reducedStart = await point(dot(graph, dragId))
      let reducedHeld
      await mouseDrag(page, reducedStart, { x: 22, y: 18 }, async () => {
        reducedHeld = await point(dot(graph, dragId))
      })
      check(
        scenario,
        distance(reducedHeld, { x: reducedStart.x + 22, y: reducedStart.y + 18 }) < 8 &&
          (await graph.getAttribute("data-running")) === "false",
        "Reduced motion preserves direct dragging without force animation",
      )
      await graph.locator(".note-graph-close").click()
      check(
        scenario,
        !(await dialog.isVisible()) && (await graph.getAttribute("data-running")) === "false",
        "Close control also stops the graph",
      )
    } catch (error) {
      check(scenario, false, "Scenario completes", error.stack ?? error.message)
    } finally {
      check(
        scenario,
        scenario.runtimeErrors.length === 0,
        "No browser runtime or console errors",
        scenario.runtimeErrors,
      )
      check(
        scenario,
        scenario.failedResources.length === 0,
        "No failed resources",
        scenario.failedResources,
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
  const checks = report.scenarios.flatMap((s) => s.checks)
  report.summary = {
    passed: checks.filter((c) => c.passed).length,
    failed: checks.filter((c) => !c.passed).length,
  }
  report.passed = !report.fatalError && report.scenarios.length === 3 && report.summary.failed === 0
  await writeFile(
    path.join(artifactRoot, `graph${suffix}-report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(`\nGraph report: ${report.summary.passed} passed, ${report.summary.failed} failed.`)
  if (report.fatalError) console.error(report.fatalError)
  if (!report.passed) process.exitCode = 1
}
