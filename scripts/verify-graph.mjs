import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const live = Boolean(process.env.GRAPH_SITE_URL)
const suffix = live ? "-live" : ""
const artifactRoot = path.join(root, "artifacts")
const screenshots = path.join(artifactRoot, "screenshots")
await mkdir(screenshots, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  browserChannel: process.env.BROWSER_CHANNEL ?? "msedge",
  browserVersion: null,
  site: process.env.GRAPH_SITE_URL ?? "local artifact at /World/",
  inputMethods: [
    "Playwright mouse, wheel and keyboard input",
    "Chromium CDP native touch drag, pan and pinch at 390px; no physical phone tested",
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
async function point(locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`No visible box: ${locator}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const node = (graph, id) => graph.locator(`a.note-graph-node[data-id=${JSON.stringify(id)}]`)
const dot = (graph, id) => node(graph, id).locator("circle.note-graph-dot")
const action = (graph, value) => graph.locator(`button[data-graph-action="${value}"]`)
async function state(graph) {
  return graph.evaluate((element) => ({
    paused: element.dataset.paused,
    running: element.dataset.running,
    scope: element.dataset.scope,
    filter: element.dataset.filter,
  }))
}
async function matrix(graph) {
  return graph.locator("g.note-graph-layer").evaluate((element) => {
    const m = element.transform.baseVal.consolidate()?.matrix
    return m ? { x: m.e, y: m.f, scale: Math.hypot(m.a, m.b) } : { x: 0, y: 0, scale: 1 }
  })
}
async function pause(graph, page) {
  if ((await state(graph)).paused !== "true") await action(graph, "pause").click()
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
  const touchPoints = (x, y) => [{ x, y, id: 1, radiusX: 3, radiusY: 3, force: 1 }]
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: touchPoints(start.x, start.y),
  })
  for (let i = 1; i <= 12; i++)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: touchPoints(start.x + (delta.x * i) / 12, start.y + (delta.y * i) / 12),
    })
  await held?.()
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}
async function graphRoot(page, preferInline = true) {
  const inline = page.locator(".note-graph--inline")
  if (preferInline && (await inline.count())) return inline.first()
  return page.locator(".note-graph--launcher").filter({ visible: true }).first()
}
async function openGraph(page, preferInline = true) {
  const graph = await graphRoot(page, preferInline)
  const trigger = graph.locator("button.note-graph-open")
  await trigger.focus()
  await page.keyboard.press("Enter")
  const dialog = graph.locator("dialog.note-graph-dialog")
  await dialog.waitFor({ state: "visible" })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(100)
  return { graph, trigger, dialog }
}
async function globalAll(graph) {
  await graph.locator('button[data-graph-scope="global"]').click()
  await graph.locator('button[data-graph-filter="all"]').click()
}
async function sourceData(graph) {
  return graph.evaluate((element) => JSON.parse(element.dataset.graph))
}
async function visibleIds(graph) {
  return graph
    .locator("a.note-graph-node")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.id).sort())
}
async function pickNode(graph, data) {
  const connected = [...new Set(data.links.flatMap((link) => [link.source, link.target]))]
  const found = await graph.locator("a.note-graph-node").evaluateAll((nodes, connected) => {
    const picks = nodes.map((node) => {
      const dot = node.querySelector("circle.note-graph-dot").getBoundingClientRect()
      const canvas = node.closest("svg").getBoundingClientRect()
      const x = dot.x + dot.width / 2,
        y = dot.y + dot.height / 2
      return {
        id: node.dataset.id,
        connected: connected.includes(node.dataset.id),
        current: node.getAttribute("aria-current") === "page",
        touchable: document.elementFromPoint(x, y)?.closest("a.note-graph-node") === node,
        safe:
          x > canvas.x + 45 &&
          x < canvas.right - 65 &&
          y > canvas.y + 50 &&
          y < canvas.bottom - 110,
      }
    })
    return picks
      .filter((pick) => pick.touchable && pick.safe)
      .sort(
        (a, b) =>
          Number(b.connected) - Number(a.connected) || Number(a.current) - Number(b.current),
      )[0]
  }, connected)
  if (!found) throw new Error("No unobscured graph node available for a real pointer drag")
  return found.id
}
async function fitAndPick(graph, data, page) {
  await action(graph, "fit").click()
  await page.waitForTimeout(80)
  return pickNode(graph, data)
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
      deviceScaleFactor: 1,
      hasTouch: viewport.width === 390,
      isMobile: viewport.width === 390,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
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
      check(scenario, response?.ok(), "Home page loads under the repository subpath")
      const inline = await graphRoot(page)
      check(
        scenario,
        (await inline.getAttribute("data-variant")) === "inline",
        "Homepage displays the global graph directly",
      )
      await inline.scrollIntoViewIfNeeded()
      await page.waitForTimeout(160)
      const data = await sourceData(inline)
      const expectedIds = data.nodes.map((node) => node.id).sort()
      check(
        scenario,
        data.nodes.length > 0 &&
          JSON.stringify(await visibleIds(inline)) === JSON.stringify(expectedIds),
        "Inline graph displays every real published non-Canvas node",
        { nodes: data.nodes.length, edges: data.links.length },
      )
      check(
        scenario,
        (await state(inline)).running === "false",
        "Inline graph settles without decorative animation",
      )
      await pause(inline, page)
      const inlineId = await fitAndPick(inline, data, page)
      const inlineStart = await point(dot(inline, inlineId))
      let inlineHeld
      await mouseDrag(page, inlineStart, { x: 24, y: 20 }, async () => {
        inlineHeld = await point(dot(inline, inlineId))
      })
      check(
        scenario,
        distance(inlineHeld, { x: inlineStart.x + 24, y: inlineStart.y + 20 }) < 8 &&
          page.url() === site.href,
        "Embedded graph supports direct dragging without navigation",
        { inlineStart, inlineHeld },
      )
      await action(inline, "reset").click()
      if (viewport.width !== 1024) await shot(page, `inline-${viewport.width}`)
      let { graph, trigger, dialog } = await openGraph(page)
      await globalAll(graph)
      await action(graph, "reset").click()
      const layout = await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect(),
          svg = element.querySelector("svg.note-graph-svg").getBoundingClientRect()
        return {
          x: box.x,
          y: box.y,
          right: box.right,
          bottom: box.bottom,
          width: innerWidth,
          height: innerHeight,
          documentWidth: document.documentElement.scrollWidth,
          client: element.clientWidth,
          scroll: element.scrollWidth,
          canvas: { x: svg.x, y: svg.y, width: svg.width, height: svg.height },
          named: Boolean(
            document.getElementById(element.getAttribute("aria-labelledby"))?.textContent.trim(),
          ),
        }
      })
      scenario.metrics.layout = layout
      check(
        scenario,
        layout.x >= -1 &&
          layout.y >= -1 &&
          layout.right <= layout.width + 1 &&
          layout.bottom <= layout.height + 1 &&
          layout.documentWidth <= layout.width + 1 &&
          layout.scroll <= layout.client + 1 &&
          layout.canvas.width > 200 &&
          layout.canvas.height > 150,
        "Expanded graph fits the viewport without page overflow",
        layout,
      )
      check(scenario, layout.named, "Expanded graph has an accessible dialog name")
      const controls = await dialog.locator("button").evaluateAll((buttons) =>
        buttons.map((button) => {
          const b = button.getBoundingClientRect()
          return {
            named: Boolean(button.getAttribute("aria-label") || button.textContent.trim()),
            visible:
              b.width > 0 &&
              b.x >= 0 &&
              b.y >= 0 &&
              b.right <= innerWidth + 1 &&
              b.bottom <= innerHeight + 1,
          }
        }),
      )
      check(
        scenario,
        controls.every((control) => control.named && control.visible),
        "All graph controls are named and visible",
        controls,
      )
      const ids = await visibleIds(graph)
      const uniquePairs = new Set(
        data.links.map((link) => [link.source, link.target].sort().join("\0")),
      )
      check(
        scenario,
        JSON.stringify(ids) === JSON.stringify(expectedIds) &&
          (await graph.locator("line.note-graph-edge").count()) === data.links.length &&
          uniquePairs.size === data.links.length,
        "Expanded graph uses the published graph data without duplicate relationships",
        { nodes: ids.length, edges: uniquePairs.size },
      )
      check(
        scenario,
        data.nodes.every(
          (entry) =>
            new URL(entry.href, site).href.startsWith(site.href) && entry.kind !== "canvas",
        ),
        "Every node is a local published note with a subpath-safe link",
      )
      const idCounts = await page.locator("[id]").evaluateAll((elements) => {
        const ids = elements.map((element) => element.id)
        return ids.filter((id, index) => ids.indexOf(id) !== index)
      })
      check(
        scenario,
        idCounts.length === 0,
        "Inline and launcher instances have unique document IDs",
        idCounts,
      )
      for (const filter of ["body", "plan", "example"]) {
        await graph.locator(`button[data-graph-filter="${filter}"]`).click()
        const expected = data.nodes
          .filter((node) => node.kind === filter)
          .map((node) => node.id)
          .sort()
        check(
          scenario,
          JSON.stringify(await visibleIds(graph)) === JSON.stringify(expected),
          `Type filter ${filter} shows only matching published notes`,
          { expected: expected.length, actual: await graph.locator("a.note-graph-node").count() },
        )
      }
      await graph.locator('button[data-graph-filter="all"]').click()
      let dragId = await fitAndPick(graph, data, page)
      const initial = await point(dot(graph, dragId))
      const initialState = await state(graph)
      await page.waitForTimeout(150)
      check(
        scenario,
        initialState.running === "false" &&
          distance(initial, await point(dot(graph, dragId))) < 0.5,
        "Nodes stay stationary until interaction",
      )
      const labelBounds = await graph.locator("a.note-graph-node text").evaluateAll((labels) =>
        labels
          .filter((label) => Number(label.getAttribute("opacity")) > 0)
          .map((label) => {
            const box = label.getBoundingClientRect(),
              canvas = label.closest("svg").getBoundingClientRect()
            return {
              text: label.textContent,
              fits: box.left >= canvas.left - 1 && box.right <= canvas.right + 1,
            }
          }),
      )
      check(
        scenario,
        labelBounds.length > 0 && labelBounds.every((label) => label.fits),
        "Visible labels stay inside the graph at the fitted scale",
        labelBounds.filter((label) => !label.fits),
      )
      await shot(page, viewport.width)
      await graph.locator("button.note-graph-close").focus()
      await page.keyboard.press("Shift+Tab")
      const last = await page.evaluate(() => ({
        inside: Boolean(document.activeElement?.closest("dialog.note-graph-dialog")),
        tag: document.activeElement?.tagName,
      }))
      await page.keyboard.press("Tab")
      const first = await graph
        .locator("button.note-graph-close")
        .evaluate((element) => document.activeElement === element)
      check(
        scenario,
        last.inside && first,
        "Shift+Tab and Tab wrap around both modal boundaries",
        last,
      )
      const focusStyle = await graph.locator("button.note-graph-close").evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          keyboard: element.matches(":focus-visible"),
          outline: style.outlineStyle,
          width: style.outlineWidth,
        }
      })
      check(
        scenario,
        focusStyle.keyboard && focusStyle.outline !== "none" && parseFloat(focusStyle.width) > 0,
        "Keyboard controls display a visible focus indicator",
        focusStyle,
      )
      const listSummary = graph.locator(".note-graph-list summary")
      await listSummary.focus()
      await page.keyboard.press("Enter")
      await graph.locator(".note-graph-list ul a").last().focus()
      await page.keyboard.press("Tab")
      check(
        scenario,
        await graph
          .locator("button.note-graph-close")
          .evaluate((element) => document.activeElement === element),
        "The expanded keyboard list also wraps its final link back to the close button",
      )
      await listSummary.focus()
      await page.keyboard.press("Enter")
      await page.waitForTimeout(80)
      await pause(graph, page)
      const beforeDrag = await point(dot(graph, dragId)),
        delta = { x: viewport.width === 390 ? 30 : 48, y: 27 }
      let held
      await mouseDrag(page, beforeDrag, delta, async () => {
        held = await point(dot(graph, dragId))
      })
      check(
        scenario,
        distance(held, { x: beforeDrag.x + delta.x, y: beforeDrag.y + delta.y }) < 8,
        "Node follows the pointer while dragging",
        { beforeDrag, held, delta },
      )
      check(
        scenario,
        page.url() === site.href &&
          (await dialog.isVisible()) &&
          distance(held, await point(dot(graph, dragId))) < 1,
        "Paused node stays released without accidental navigation",
      )
      const canvas = await graph.locator("svg.note-graph-svg").boundingBox()
      const blank = { x: canvas.x + 24, y: canvas.y + 26 }
      const beforePan = await matrix(graph)
      await mouseDrag(page, blank, { x: 35, y: 25 })
      const afterPan = await matrix(graph)
      check(
        scenario,
        Math.abs(afterPan.x - beforePan.x - 35) < 3 &&
          Math.abs(afterPan.y - beforePan.y - 25) < 3 &&
          Math.abs(afterPan.scale - beforePan.scale) < 0.001,
        "Dragging empty canvas pans without changing scale",
        { beforePan, afterPan },
      )
      await page.mouse.move(canvas.x + canvas.width / 2, canvas.y + canvas.height / 2)
      await page.mouse.wheel(0, -160)
      await page.waitForTimeout(160)
      const wheel = await matrix(graph)
      check(scenario, wheel.scale > afterPan.scale, "Mouse wheel zooms the graph")
      await action(graph, "zoom-in").click()
      const zoomed = await matrix(graph)
      check(scenario, zoomed.scale > wheel.scale, "Zoom-in control increases scale")
      await action(graph, "zoom-out").click()
      check(
        scenario,
        (await matrix(graph)).scale < zoomed.scale,
        "Zoom-out control decreases scale",
      )
      await action(graph, "fit").click()
      const dotsFit = await graph.locator("circle.note-graph-dot").evaluateAll((dots) =>
        dots.every((dot) => {
          const b = dot.getBoundingClientRect(),
            s = dot.closest("svg").getBoundingClientRect()
          return (
            b.x >= s.x - 1 && b.y >= s.y - 1 && b.right <= s.right + 1 && b.bottom <= s.bottom + 1
          )
        }),
      )
      check(scenario, dotsFit, "Fit brings every visible node inside the canvas")
      await action(graph, "reset").click()
      check(
        scenario,
        distance(initial, await point(dot(graph, dragId))) < 5,
        "Reset restores deterministic starting positions",
        { initial, reset: await point(dot(graph, dragId)) },
      )
      await pause(graph, page)
      await action(graph, "pause").click()
      check(
        scenario,
        (await state(graph)).paused === "false" && (await state(graph)).running === "true",
        "Resume starts the force layout",
      )
      const movingStart = await point(dot(graph, dragId))
      const relatedId = data.links.find((link) => link.source === dragId || link.target === dragId)
      const neighborId = relatedId
        ? relatedId.source === dragId
          ? relatedId.target
          : relatedId.source
        : undefined
      const neighborBefore = neighborId ? await point(dot(graph, neighborId)) : null
      let runningHeld
      await mouseDrag(page, movingStart, { x: 24, y: 24 }, async () => {
        await page.waitForTimeout(110)
        runningHeld = (await state(graph)).running
      })
      const neighborAfter = neighborId ? await point(dot(graph, neighborId)) : null
      check(
        scenario,
        runningHeld === "true" && (!neighborId || distance(neighborBefore, neighborAfter) > 0.15),
        "Unpaused drag gives connected nodes physical feedback",
        { neighborBefore, neighborAfter },
      )
      await pause(graph, page)
      check(scenario, (await state(graph)).running === "false", "Pause stops the simulation")
      if (viewport.width === 390) {
        const session = await context.newCDPSession(page)
        dragId = await fitAndPick(graph, data, page)
        const beforeTouch = await point(dot(graph, dragId))
        let touchHeld
        await touchDrag(session, beforeTouch, { x: 24, y: 23 }, async () => {
          touchHeld = await point(dot(graph, dragId))
        })
        check(
          scenario,
          distance(touchHeld, { x: beforeTouch.x + 24, y: beforeTouch.y + 23 }) < 10 &&
            page.url() === site.href,
          "Native touch drags a node without navigating",
          { beforeTouch, touchHeld },
        )
        const beforeTouchPan = await matrix(graph)
        await touchDrag(session, blank, { x: 24, y: 32 })
        const afterTouchPan = await matrix(graph)
        check(
          scenario,
          Math.abs(afterTouchPan.x - beforeTouchPan.x - 24) < 4 &&
            Math.abs(afterTouchPan.y - beforeTouchPan.y - 32) < 4,
          "Native touch pans empty canvas",
          { beforeTouchPan, afterTouchPan },
        )
        const pinchPoints = (spread) => [
          { x: canvas.x + canvas.width / 2 - spread, y: canvas.y + 36, id: 1 },
          { x: canvas.x + canvas.width / 2 + spread, y: canvas.y + 36, id: 2 },
        ]
        const beforePinch = await matrix(graph)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: pinchPoints(35),
        })
        for (let i = 1; i <= 8; i++)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: pinchPoints(35 + i * 4),
          })
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        check(
          scenario,
          (await matrix(graph)).scale > beforePinch.scale * 1.2,
          "Native two-finger pinch zooms the graph",
        )
        await session.detach()
      }
      await page.keyboard.press("Escape")
      check(
        scenario,
        !(await dialog.isVisible()) && (await state(graph)).running === "false",
        "Escape closes the modal and stops simulation",
      )
      check(
        scenario,
        await trigger.evaluate((element) => document.activeElement === element),
        "Closing returns focus to the opening button",
      )
      ;({ graph, trigger, dialog } = await openGraph(page))
      await globalAll(graph)
      const target =
        data.nodes.find((entry) => !entry.current && entry.kind === "body") ??
        data.nodes.find((entry) => !entry.current)
      if (!target)
        throw new Error("A second published note is required to verify real graph navigation")
      const targetUrl = new URL(target.href, site).href
      await node(graph, target.id).focus()
      await page.keyboard.press("Enter")
      await page.waitForURL((url) => url.href === targetUrl)
      await page.waitForLoadState("networkidle")
      check(
        scenario,
        (await page.locator("article#article-content").count()) === 1,
        "Enter activates the actual note link under the repository subpath",
        targetUrl,
      )
      ;({ graph, trigger, dialog } = await openGraph(page, false))
      const nestedData = await sourceData(graph)
      const currentId = nestedData.nodes.find((entry) => entry.current)?.id
      const adjacent = new Set([currentId])
      for (const edge of nestedData.links) {
        if (edge.source === currentId) adjacent.add(edge.target)
        if (edge.target === currentId) adjacent.add(edge.source)
      }
      check(
        scenario,
        (await state(graph)).scope === "local" &&
          JSON.stringify(await visibleIds(graph)) === JSON.stringify([...adjacent].sort()),
        "Article launcher initially shows exactly its one-hop relationships",
      )
      await globalAll(graph)
      const home = nestedData.nodes.find((entry) => entry.id === "index")
      check(
        scenario,
        Boolean(home) && new URL(home.href, page.url()).href === site.href,
        "Nested graph resolves the home link beneath the repository prefix",
        home?.href,
      )
      await node(graph, "index").locator("circle.note-graph-dot").click()
      await page.waitForURL(site.href)
      check(
        scenario,
        (await page.locator("article#article-content").count()) === 1,
        "Deliberate node click returns to the home page",
      )
      await page.emulateMedia({ reducedMotion: "reduce" })
      ;({ graph, trigger, dialog } = await openGraph(page))
      await globalAll(graph)
      check(
        scenario,
        (await state(graph)).running === "false",
        "Reduced-motion preference keeps the layout stationary",
      )
      dragId = await fitAndPick(graph, data, page)
      const reducedStart = await point(dot(graph, dragId))
      let reducedHeld
      await mouseDrag(page, reducedStart, { x: 24, y: 20 }, async () => {
        reducedHeld = await point(dot(graph, dragId))
      })
      check(
        scenario,
        distance(reducedHeld, { x: reducedStart.x + 24, y: reducedStart.y + 20 }) < 8 &&
          (await state(graph)).running === "false",
        "Reduced motion permits direct dragging without a force animation",
      )
      await graph.locator("button.note-graph-close").click()
      check(
        scenario,
        !(await dialog.isVisible()) && (await state(graph)).running === "false",
        "Close button also stops graph activity",
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
        "No failed website resources",
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
  const checks = report.scenarios.flatMap((scenario) => scenario.checks)
  report.summary = {
    passed: checks.filter((check) => check.passed).length,
    failed: checks.filter((check) => !check.passed).length,
  }
  report.passed = !report.fatalError && report.scenarios.length === 3 && report.summary.failed === 0
  await writeFile(
    path.join(artifactRoot, `graph${suffix}-report.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  )
  console.log(
    `\nGraph report: artifacts/graph${suffix}-report.json; ${report.summary.passed} passed, ${report.summary.failed} failed.`,
  )
  if (report.fatalError) console.error(report.fatalError)
  if (!report.passed) process.exitCode = 1
}
