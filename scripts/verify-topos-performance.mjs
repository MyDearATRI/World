import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createHash } from "node:crypto"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

// A repeatable local diagnostic, not a claim about physical display FPS or field INP.
const args = process.argv.slice(2)
const option = (key, fallback) => {
  const at = args.indexOf(`--${key}`)
  return at >= 0 ? args[at + 1] : fallback
}
const root = fileURLToPath(new URL("../", import.meta.url))
if (option("analyze")) {
  const sourceFile = path.resolve(root, option("analyze"))
  const sourceBytes = await readFile(sourceFile)
  const source = JSON.parse(sourceBytes)
  const phases = []
  for (const record of source.cases) {
    for (const phase of record.measurements) {
      const raw = JSON.parse(
        await readFile(
          path.join(path.dirname(sourceFile), `${record.name}-${phase.name}-raw.json`),
          "utf8",
        ),
      )
      const completed = raw.inputs.filter((e) => e.renderCompleted !== undefined)
      phases.push({
        case: record.name,
        phase: phase.name,
        validOperation: !(
          phase.name === "drag" &&
          source.checks.some(
            (c) => c.name === `${record.name}: real node follows drag without opening` && !c.passed,
          )
        ),
        timestampToRenderMs: stats(completed.map((e) => e.renderCompleted - e.timestamp)),
        byType: Object.fromEntries(
          [...new Set(completed.map((e) => e.type))].map((type) => [
            type,
            stats(
              completed.filter((e) => e.type === type).map((e) => e.renderCompleted - e.timestamp),
            ),
          ]),
        ),
      })
    }
  }
  const destination = path.join(path.dirname(sourceFile), "end-to-end-latency.json")
  await writeFile(
    destination,
    JSON.stringify(
      {
        derivedAt: new Date().toISOString(),
        sourceReport: sourceFile,
        sourceReportSha256: createHash("sha256").update(sourceBytes).digest("hex"),
        method:
          "Pure reanalysis of already captured raw trusted input events: completed application frame time minus original DOM event.timeStamp. Includes pre-handler dispatch delay. No new browser run, GPU presentation claim, or field INP measurement. Invalid drag operations remain excluded from improvement claims.",
        phases,
      },
      null,
      2,
    ),
  )
  console.log(destination)
  process.exit(0)
}
const output = path.resolve(root, option("output", "artifacts/motion/baseline"))
const selected = option("cases", "notes-1440,notes-390,atlas-1440,atlas-390").split(",")
const thresholds = {
  renderCallbackP95Ms: 16.7,
  activeRenderIntervalP95Ms: 33.4,
  inputToRenderP95Ms: 100,
  inputToRenderMaxMs: 200,
  longestTaskMs: 200,
  settleMs: 15000,
  localBodyReadyMs: 1500,
}
const report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  thresholds,
  thresholdRationale:
    "Diagnostic targets chosen before baseline: 16.7ms application callback budget and 33.4ms p95 render-callback interval correspond to one/two nominal 60Hz intervals; inputs should complete a scene frame within 100ms p95 / 200ms maximum; no >200ms main-thread task; finite motion should cool in 15s. Local first-body display has a 1.5s target. These are project targets, not measured hardware refresh, Web Vitals INP, or mathematical guarantees.",
  environment: {},
  cases: [],
  checks: [],
  performanceChecks: [],
  errors: [],
  limitations: [
    "Headless Edge on this Windows host. GPU details are recorded; software rendering may dominate results and does not represent a physical phone.",
    "390px uses browser mobile/touch emulation, with no CPU/network throttling. 1440px is a desktop viewport. Both use normal motion.",
    "Application RAF callback completion is measured, not GPU presentation or screen pixels. No FPS score or production INP is inferred.",
    "Input-to-render matches captured trusted events to the next completed application frame; ignored/coalesced events can share a frame. Event Timing entries are separately reported when available.",
    "RAF wrappers and Performance observers add small instrumentation cost. CDP CPU metrics include automation evaluation. No full tracing or CPU profiler is enabled.",
    "Local preview uses no-store responses. First requested body is locally cold, not a simulated internet download.",
    "One ordered run per scene/viewport. Compare repeated runs on the same otherwise idle machine before generalizing a small change.",
  ],
}
await mkdir(output, { recursive: true })
const sha = (b) => createHash("sha256").update(b).digest("hex")
report.scriptSha256 = sha(await readFile(fileURLToPath(import.meta.url)))
report.artifacts = Object.fromEntries(
  await Promise.all(
    ["topos.js", "topos.css", "index.json", "atlas.json"].map(async (file) => {
      const bytes = await readFile(path.join(root, "public/static/topos", file))
      return [file, { sha256: sha(bytes), bytes: bytes.length }]
    }),
  ),
)
const models = Object.fromEntries(
  await Promise.all(
    ["notes", "atlas"].map(async (name) => [
      name,
      JSON.parse(
        await readFile(
          path.join(root, "public/static/topos", name === "notes" ? "index.json" : "atlas.json"),
          "utf8",
        ),
      ).model,
    ]),
  ),
)
const preview = option("url") ? undefined : await startPreview({ port: 0 })
const base = option("url", `${preview?.url}/World/`)
report.base = base
const browser = await chromium.launch({
  executablePath: option("browser", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"),
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
report.environment.browserVersion = browser.version()
try {
  const cdp = await browser.newBrowserCDPSession()
  report.environment.system = await cdp.send("SystemInfo.getInfo")
  await cdp.detach()
} catch (error) {
  report.environment.systemUnavailable = error.message
}

function installProbe() {
  const nativeRAF = window.requestAnimationFrame.bind(window)
  const data = { phase: null, renders: [], inputs: [], longTasks: [], eventTiming: [] }
  const pending = []
  window.requestAnimationFrame = (callback) =>
    nativeRAF((timestamp) => {
      const before = window.__topos?.frame
      const start = performance.now()
      callback(timestamp)
      const end = performance.now()
      if (data.phase && window.__topos?.frame !== before && before !== undefined) {
        data.renders.push({
          phase: data.phase,
          timestamp,
          start,
          duration: end - start,
          frame: window.__topos.frame,
        })
        for (const event of pending.splice(0)) {
          event.renderCompleted = end
          event.inputToRenderMs = end - event.captured
          event.renderFrame = window.__topos.frame
        }
      }
    })
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "pointercancel",
    "dragstart",
    "wheel",
    "click",
    "input",
  ]) {
    document.addEventListener(
      type,
      (event) => {
        if (!data.phase || !event.isTrusted) return
        if (!event.target?.closest?.("#topos-world,.topos-topic-sidebar,.topos-topics-trigger"))
          return
        const captured = performance.now()
        const entry = {
          phase: data.phase,
          type,
          captured,
          timestamp: event.timeStamp,
          dispatchDelayMs: Math.max(0, captured - event.timeStamp),
          pointerType: event.pointerType,
          target: {
            tag: event.target.tagName,
            id: event.target.id,
            concept: event.target.closest?.("[data-concept]")?.dataset.concept,
          },
          x: event.clientX,
          y: event.clientY,
        }
        data.inputs.push(entry)
        pending.push(entry)
      },
      { capture: true, passive: true },
    )
  }
  const support = PerformanceObserver.supportedEntryTypes
  if (support.includes("longtask")) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        data.longTasks.push({ start: e.startTime, duration: e.duration, name: e.name })
    }).observe({ type: "longtask", buffered: true })
  }
  if (support.includes("event")) {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        data.eventTiming.push({
          type: e.name,
          start: e.startTime,
          duration: e.duration,
          processingStart: e.processingStart,
          processingEnd: e.processingEnd,
          interactionId: e.interactionId,
        })
    }).observe({ type: "event", buffered: true, durationThreshold: 16 })
  }
  window.__motionProbe = {
    data,
    support,
    begin(phase) {
      pending.length = 0
      data.phase = phase
      return performance.now()
    },
    end() {
      data.phase = null
      pending.length = 0
      return performance.now()
    },
  }
}

function stats(values) {
  if (!values.length) return { count: 0, p50: null, p95: null, max: null, mean: null }
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (p) => sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)]
  return {
    count: values.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    max: sorted.at(-1),
    mean: sorted.reduce((sum, v) => sum + v, 0) / sorted.length,
  }
}
const check = (name, passed, evidence, performance = false) => {
  ;(performance ? report.performanceChecks : report.checks).push({
    name,
    passed: !!passed,
    evidence,
  })
  console.log(`${passed ? "PASS" : performance ? "BUDGET" : "FAIL"} ${name}`)
}
const snapshot = (page) => page.evaluate(() => window.__topos.snapshot())
const tiny = (page) =>
  page.evaluate(() => ({
    time: performance.now(),
    frame: window.__topos.frame,
    settled: window.__topos.settled,
    focus: window.__topos.state.focus,
    scale: window.__topos.state.scale,
    topics: window.__topos.state.topics,
    nodes: window.__topos.nodes.map(({ id, x, y, z }) => ({ id, x, y, z })),
  }))
const stable = (page) =>
  page.waitForFunction(() => window.__topos?.settled, null, { polling: 150, timeout: 45000 })
const delta = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const metricMap = async (cdp) =>
  Object.fromEntries(
    (await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]),
  )
const metricDelta = (a, b) =>
  Object.fromEntries(
    [
      "TaskDuration",
      "ScriptDuration",
      "LayoutDuration",
      "RecalcStyleDuration",
      "LayoutCount",
      "RecalcStyleCount",
    ].map((key) => [key, b[key] - a[key]]),
  )

async function measure(page, cdp, record, name, action) {
  const metricsBefore = await metricMap(cdp)
  const start = await page.evaluate((phase) => window.__motionProbe.begin(phase), name)
  const value = await action()
  const actionEnd = await page.evaluate(() => performance.now())
  let settled = true
  try {
    await stable(page)
  } catch {
    settled = false
  }
  const stableAt = await page.evaluate(() => performance.now())
  const end = await page.evaluate(() => window.__motionProbe.end())
  const metricsAfter = await metricMap(cdp)
  const raw = await page.evaluate(() => structuredClone(window.__motionProbe.data))
  const renders = raw.renders.filter((e) => e.phase === name)
  const inputs = raw.inputs.filter((e) => e.phase === name)
  const intervals = renders.slice(1).map((e, i) => e.timestamp - renders[i].timestamp)
  const tasks = raw.longTasks.filter((e) => e.start >= start && e.start < end)
  const summary = {
    name,
    start,
    end,
    actionMs: actionEnd - start,
    settleAfterActionMs: stableAt - actionEnd,
    settled,
    value,
    renderCallbackMs: stats(renders.map((e) => e.duration)),
    renderIntervalMs: stats(intervals),
    renderIntervalsOver50Ms: intervals.filter((v) => v > 50).length,
    inputToRenderMs: stats(
      inputs.filter((e) => e.inputToRenderMs !== undefined).map((e) => e.inputToRenderMs),
    ),
    inputTimestampToRenderMs: stats(
      inputs
        .filter((e) => e.renderCompleted !== undefined)
        .map((e) => e.renderCompleted - e.timestamp),
    ),
    inputDispatchDelayMs: stats(inputs.map((e) => e.dispatchDelayMs)),
    inputsWithoutSubsequentFrame: inputs.filter((e) => e.inputToRenderMs === undefined).length,
    longTasks: {
      count: tasks.length,
      totalMs: tasks.reduce((sum, e) => sum + e.duration, 0),
      longestMs: Math.max(0, ...tasks.map((e) => e.duration)),
    },
    cdpDelta: metricDelta(metricsBefore, metricsAfter),
    heapUsedBytes: metricsAfter.JSHeapUsedSize,
  }
  record.measurements.push(summary)
  const prefix = `${record.name} ${name}`
  check(`${prefix}: motion settles`, settled)
  check(
    `${prefix}: settle budget`,
    settled && summary.settleAfterActionMs <= thresholds.settleMs,
    summary.settleAfterActionMs,
    true,
  )
  check(
    `${prefix}: render callback p95 budget`,
    summary.renderCallbackMs.count > 0 &&
      summary.renderCallbackMs.p95 <= thresholds.renderCallbackP95Ms,
    summary.renderCallbackMs,
    true,
  )
  check(
    `${prefix}: render interval p95 budget`,
    summary.renderIntervalMs.count > 0 &&
      summary.renderIntervalMs.p95 <= thresholds.activeRenderIntervalP95Ms,
    summary.renderIntervalMs,
    true,
  )
  if (summary.inputToRenderMs.count)
    check(
      `${prefix}: input response budget`,
      summary.inputToRenderMs.p95 <= thresholds.inputToRenderP95Ms &&
        summary.inputToRenderMs.max <= thresholds.inputToRenderMaxMs,
      summary.inputToRenderMs,
      true,
    )
  if (summary.inputTimestampToRenderMs.count)
    check(
      `${prefix}: timestamp-to-render budget`,
      summary.inputTimestampToRenderMs.p95 <= thresholds.inputToRenderP95Ms &&
        summary.inputTimestampToRenderMs.max <= thresholds.inputToRenderMaxMs,
      summary.inputTimestampToRenderMs,
      true,
    )
  check(
    `${prefix}: long task budget`,
    summary.longTasks.longestMs <= thresholds.longestTaskMs,
    summary.longTasks,
    true,
  )
  const quietStart = await tiny(page)
  await page.waitForTimeout(750)
  const quietEnd = await tiny(page)
  check(
    `${prefix}: settled application renders stop`,
    settled && quietStart.frame === quietEnd.frame,
    { before: quietStart.frame, after: quietEnd.frame },
  )
  await writeFile(
    path.join(output, `${record.name}-${name}-raw.json`),
    JSON.stringify(
      {
        start,
        end,
        renders,
        inputs,
        longTasks: tasks,
        eventTiming: raw.eventTiming.filter((e) => e.start >= start && e.start < end),
      },
      null,
      2,
    ),
  )
  return value
}

try {
  for (const name of selected) {
    const [mode, widthText] = name.split("-")
    const width = Number(widthText)
    if (!models[mode] || ![1440, 390].includes(width)) throw new Error(`Unknown case ${name}`)
    const phone = width === 390
    const record = {
      name,
      viewport: { width, height: phone ? 844 : 1000 },
      measurements: [],
      errors: [],
    }
    report.cases.push(record)
    const context = await browser.newContext({
      viewport: record.viewport,
      isMobile: phone,
      hasTouch: phone,
      reducedMotion: "no-preference",
    })
    await context.addInitScript(installProbe)
    const page = await context.newPage()
    page.on("pageerror", (error) => record.errors.push(error.message))
    let documents = 0
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents++
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send("Performance.enable")
    const showTopics = async () => {
      if (phone) await page.locator(".topos-topics-trigger").click()
    }
    const closeTopics = async () => {
      if (phone) await page.locator("[data-close-topics]").click()
    }
    try {
      const route = option(
        mode === "notes" ? "notes-path" : "atlas-path",
        mode === "notes" ? "topos.html" : "atlas.html",
      )
      const navigationAt = Date.now()
      await page.goto(new URL(route, base).href, { waitUntil: "domcontentloaded" })
      await page.waitForFunction(
        () => document.querySelector("#topos-world")?.dataset.ready === "true",
        null,
        { polling: 100, timeout: 45000 },
      )
      await page.evaluate(() => document.fonts.ready)
      record.readyMs = Date.now() - navigationAt
      await stable(page)
      record.environment = await page.evaluate(() => {
        const canvas = document.querySelector("#topos-canvas")
        const gl = canvas.getContext("webgl2")
        const debug = gl?.getExtension("WEBGL_debug_renderer_info")
        window.__performanceIdentity = { canvas, world: document.querySelector("#topos-world") }
        return {
          userAgent: navigator.userAgent,
          devicePixelRatio,
          hardwareConcurrency: navigator.hardwareConcurrency,
          reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
          renderer: window.__topos.renderer,
          webgl: gl
            ? {
                vendor: gl.getParameter(gl.VENDOR),
                renderer: gl.getParameter(gl.RENDERER),
                unmasked: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : null,
              }
            : null,
          observers: window.__motionProbe.support,
        }
      })
      check(`${name}: normal motion`, !record.environment.reducedMotion)
      await showTopics()
      await page.getByRole("button", { name: "全选", exact: true }).click()
      await closeTopics()
      await stable(page)
      const before = await snapshot(page)
      record.collection = {
        expected: models[mode].concepts.length,
        actual: before.objectCount,
        visible: before.visibleIDs.length,
      }
      check(
        `${name}: complete real multi-topic collection`,
        before.objectCount === models[mode].concepts.length &&
          before.visibleIDs.length === models[mode].concepts.length,
        record.collection,
      )
      const node = before.nodes.find((n) => n.id === before.focus)
      await page.mouse.move(node.screenX, node.screenY)
      await stable(page)
      const origin = await snapshot(page)
      const point = origin.nodes.find((n) => n.id === origin.focus)
      const startPoint = await page.evaluate(
        ({ x, y }) => {
          const offsets = [
            [0, 0],
            [0, 8],
            [0, -8],
            [8, 0],
            [-8, 0],
            [8, 8],
            [-8, 8],
          ]
          const inspected = offsets.map(([dx, dy]) => {
            const el = document.elementFromPoint(x + dx, y + dy)
            return {
              x: x + dx,
              y: y + dy,
              tag: el?.tagName,
              id: el?.id,
              concept: el?.closest("[data-concept]")?.dataset.concept,
            }
          })
          return { chosen: inspected.find((p) => p.id === "topos-canvas"), inspected }
        },
        { x: point.screenX, y: point.screenY },
      )
      record.dragHitTest = startPoint
      check(
        `${name}: drag begins on actual canvas within the focus ball`,
        !!startPoint.chosen,
        startPoint,
      )
      if (!startPoint.chosen)
        throw new Error(
          "Focus ball is occluded by DOM; no actual canvas drag target within its radius",
        )
      const start = startPoint.chosen
      const held = await measure(page, cdp, record, "drag", async () => {
        if (phone)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x: start.x, y: start.y, id: 1 }],
          })
        else {
          await page.mouse.move(start.x, start.y)
          await page.mouse.down()
        }
        for (let i = 1; i <= 28; i++) {
          const x = start.x + (phone ? 2 : 4) * i
          const y = start.y + Math.sin((i / 28) * Math.PI) * 28
          if (phone)
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [{ x, y, id: 1 }],
            })
          else await page.mouse.move(x, y)
          await page.waitForTimeout(16)
        }
        const held = await tiny(page)
        if (phone) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        else await page.mouse.up()
        return held
      })
      const moved = held.nodes.find((n) => n.id === point.id)
      check(
        `${name}: real node follows drag without opening`,
        delta(point, moved) > 20 && held.focus === origin.focus && held.scale === origin.scale,
        { displacement: delta(point, moved), beforeScale: origin.scale, heldScale: held.scale },
      )
      const neighborIDs = new Set(
        origin.relations.flatMap((r) =>
          r.source === point.id ? [r.target] : r.target === point.id ? [r.source] : [],
        ),
      )
      const neighborMotion = held.nodes
        .filter((n) => neighborIDs.has(n.id))
        .map((n) =>
          delta(
            n,
            origin.nodes.find((old) => old.id === n.id),
          ),
        )
      check(
        `${name}: connected neighbors respond`,
        neighborMotion.some((d) => d > 0.2),
        { maxWorldDisplacement: Math.max(0, ...neighborMotion) },
      )

      const scaleBefore = (await tiny(page)).scale
      await measure(page, cdp, record, "zoom", async () => {
        if (phone) {
          const bounds = await page.locator("#topos-world").boundingBox()
          const x = bounds.x + bounds.width / 2,
            y = bounds.y + 140
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [
              { x: x - 36, y, id: 1 },
              { x: x + 36, y, id: 2 },
            ],
          })
          for (let i = 1; i <= 12; i++) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [
                { x: x - 36 - i * 0.7, y, id: 1 },
                { x: x + 36 + i * 0.7, y, id: 2 },
              ],
            })
            await page.waitForTimeout(24)
          }
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        } else {
          const bounds = await page.locator("#topos-world").boundingBox()
          await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + 180)
          for (let i = 0; i < 6; i++) {
            await page.mouse.wheel(0, -25)
            await page.waitForTimeout(30)
          }
        }
      })
      check(
        `${name}: wheel or two-finger gesture changes semantic scale`,
        (await tiny(page)).scale > scaleBefore + 0.1,
        { before: scaleBefore, after: (await tiny(page)).scale },
      )

      const target = await page.locator("a[data-concept]").evaluateAll((links) => {
        const focus = window.__topos.state.focus
        return links
          .filter(
            (el) =>
              el.dataset.concept !== focus &&
              !el.inert &&
              Number(getComputedStyle(el).opacity) > 0.3,
          )
          .map((el) => ({
            id: el.dataset.concept,
            title: el.textContent,
            rect: el.getBoundingClientRect(),
          }))
          .find(
            ({ rect }) =>
              rect.left >= 0 &&
              rect.top > 80 &&
              rect.right <= innerWidth &&
              rect.bottom < innerHeight - 160,
          )
      })
      if (!target)
        throw new Error("No readable neighboring concept link is available for focus test")
      await measure(page, cdp, record, "focus", async () => {
        await page.locator(`a[data-concept=${JSON.stringify(target.id)}]`).click()
      })
      check(`${name}: real neighbor click updates focus`, (await tiny(page)).focus === target.id, {
        target: target.id,
      })
      const opening = await measure(page, cdp, record, "open-body", async () => {
        const t = await page.evaluate(() => performance.now())
        while ((await tiny(page)).scale < 2) await page.locator('[data-zoom="in"]').click()
        await page.waitForFunction(
          (isNote) => {
            const body = document.querySelector('.topos-unfolding[data-active="true"] .topos-prose')
            return (
              !!body &&
              body.textContent.trim().length > 20 &&
              (!isNote || body.querySelector(".katex"))
            )
          },
          mode === "notes",
          { polling: 50, timeout: 15000 },
        )
        return { readyMs: await page.evaluate((t) => performance.now() - t, t) }
      })
      check(
        `${name}: local body becomes readable within target`,
        opening.readyMs <= thresholds.localBodyReadyMs,
        opening,
        true,
      )
      check(
        `${name}: real body or classification provenance visible`,
        await page.locator('.topos-unfolding[data-active="true"] .topos-prose').isVisible(),
      )
      const screenshot = path.join(output, `${name}-reading.png`)
      await page.screenshot({ path: screenshot })
      record.screenshot = screenshot
      await page.locator('.topos-unfolding[data-active="true"] [data-fold]').click()
      await stable(page)

      await showTopics()
      const topics = models[mode].topics.map((t) => t.id)
      await measure(page, cdp, record, "theme-filter", async () => {
        await page.locator(`input[data-topic=${JSON.stringify(topics.at(-1))}]`).uncheck()
        await closeTopics()
      })
      check(
        `${name}: topic selection changes without replacing identities`,
        (await tiny(page)).nodes.length === origin.nodes.length,
      )
      const final = await snapshot(page)
      check(
        `${name}: document, canvas and scene identity persist`,
        documents === 1 &&
          (await page.evaluate(
            () =>
              window.__performanceIdentity.canvas === document.querySelector("#topos-canvas") &&
              window.__performanceIdentity.world === document.querySelector("#topos-world"),
          )),
        { documents },
      )
      check(
        `${name}: no horizontal page overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      check(`${name}: no uncaught runtime errors`, record.errors.length === 0, record.errors)
      record.final = {
        focus: final.focus,
        scale: final.scale,
        objectCount: final.objectCount,
        visibleCount: final.visibleIDs.length,
        frame: final.frame,
      }
      await writeFile(
        path.join(output, `${name}-all-probe.json`),
        JSON.stringify(await page.evaluate(() => window.__motionProbe.data), null, 2),
      )
    } catch (error) {
      record.errors.push(error.stack)
      report.errors.push({ case: name, error: error.stack })
      console.error(error.stack)
      await page.screenshot({ path: path.join(output, `${name}-error.png`) }).catch(() => {})
    } finally {
      await context.close()
      await writeFile(path.join(output, "progress.json"), JSON.stringify(report, null, 2))
    }
  }
} finally {
  await browser.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.functionalPassed = report.checks.filter((c) => c.passed).length
  report.functionalFailed = report.checks.filter((c) => !c.passed).length + report.errors.length
  report.performancePassed = report.performanceChecks.filter((c) => c.passed).length
  report.performanceMissed = report.performanceChecks.filter((c) => !c.passed).length
  if (option("compare")) {
    const baseline = JSON.parse(await readFile(path.resolve(root, option("compare")), "utf8"))
    report.comparison = report.cases.flatMap((current) =>
      current.measurements.map((m) => {
        const previous = baseline.cases
          .find((c) => c.name === current.name)
          ?.measurements.find((s) => s.name === m.name)
        if (!previous) return { case: current.name, stage: m.name, missingBaseline: true }
        return {
          case: current.name,
          stage: m.name,
          renderP95Ms: { baseline: previous.renderCallbackMs.p95, current: m.renderCallbackMs.p95 },
          intervalP95Ms: {
            baseline: previous.renderIntervalMs.p95,
            current: m.renderIntervalMs.p95,
          },
          responseP95Ms: { baseline: previous.inputToRenderMs.p95, current: m.inputToRenderMs.p95 },
          longTasksMs: { baseline: previous.longTasks.totalMs, current: m.longTasks.totalMs },
        }
      }),
    )
  }
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  await writeFile(
    path.join(output, `report-${report.startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(report, null, 2),
  )
  console.log(
    JSON.stringify({
      output,
      functionalPassed: report.functionalPassed,
      functionalFailed: report.functionalFailed,
      performancePassed: report.performancePassed,
      performanceMissed: report.performanceMissed,
    }),
  )
  if (report.functionalFailed || (args.includes("--enforce") && report.performanceMissed))
    process.exitCode = 1
}
