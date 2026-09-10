import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"
import { performance } from "node:perf_hooks"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.MAP_WORKFLOW_OUTPUT ?? "artifacts/wo-005/map-workflow")
const widths = (process.env.MAP_WORKFLOW_WIDTHS ?? "1440,1024,390").split(",").map(Number)
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const focusConcept = model.concepts.find(
  (concept) => concept.title === "度量拓扑与连续性的三种刻画",
)
if (!focusConcept) throw new Error("The approved continuity note is missing")
const runtimeDirectory = process.env.MAP_WORKFLOW_RUNTIME_DIR
const runtimeBytes = await readFile(
  runtimeDirectory ? path.join(runtimeDirectory, "runtime.js.txt") : "public/static/topos/topos.js",
)
const cssBytes = await readFile(
  runtimeDirectory
    ? path.join(runtimeDirectory, "runtime.css.txt")
    : "public/static/topos/topos.css",
)
const compare = process.env.MAP_WORKFLOW_COMPARE
  ? JSON.parse(await readFile(process.env.MAP_WORKFLOW_COMPARE, "utf8"))
  : undefined
const report = {
  startedAt: new Date().toISOString(),
  runtimeSha256: createHash("sha256").update(runtimeBytes).digest("hex"),
  cssSha256: createHash("sha256").update(cssBytes).digest("hex"),
  mode: runtimeDirectory ? "captured-baseline" : "candidate",
  comparisonReport: process.env.MAP_WORKFLOW_COMPARE ?? null,
  diagnosticOnly:
    process.env.MAP_WORKFLOW_TRACE_ONLY === "1" || process.env.MAP_WORKFLOW_PROFILE_ONLY === "cold",
  scriptSha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  expectedNodes: model.concepts.length,
  checks: [],
  measurements: [],
  errors: [],
  screenshots: [],
  resources: [],
  limits: [
    "One headless Edge browser, fresh context per viewport, scenarios run sequentially.",
    "390px uses simulated touch; this is not a physical phone test.",
    "Input-to-next-RAF and input-to-observed-map-render are diagnostics, not FPS or INP.",
    "A renderCount observation marks an executed renderer update, not a compositor presentation timestamp.",
    "Both versions start at the same direct reader depth=2.1 URL. Cold means its first explicit map-button open; warm means reopen in the same context. Default-entry construction is excluded, not mislabeled cold.",
    "Captured-baseline mode fulfills only the saved baseline JS/CSS bytes through browser routing; approved index, source bodies and the /World/ preview are shared.",
    "No screenshots, full snapshots, or geometry reads are taken per animation frame. Instrumentation polls only dataset.renderCount and dialog.open.",
    "A MutationObserver records data-render-count completion independently of the earlier RAF observer. This is DOM update timing, not compositor presentation. Continuous pan uses the corrected declared DOM-completion gate; original full-motion RAF estimator results remain diagnostic. Cold/warm and drag/zoom RAF limits remain unchanged.",
    "Motion samples retain the initial gesture activation delay. Additional continuous-motion samples exclude pointer moves within the existing 5px drag-intent threshold; both series are retained.",
    "Pan selection stays at least 30px away from all visible node and label hit boxes. The actual pointerdown target must also be blank; invalid input is diagnostic only.",
  ],
}
let browser, preview
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const snap = (page) => page.evaluate(() => window.__topos.snapshot())
const quantiles = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b)
  return {
    count: sorted.length,
    median: sorted.length ? sorted[Math.floor(sorted.length / 2)] : null,
    p95: sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null,
    max: sorted.length ? sorted.at(-1) : null,
  }
}
const mapOpen = (page) =>
  page.evaluate(() => Boolean(document.querySelector("[data-global-map]")?.open))
async function shot(page, label) {
  const file = path.join(output, `${label}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
async function startPhase(page, name) {
  await page.evaluate((name) => {
    window.__mapWorkflow.phaseEnds[window.__mapWorkflow.phase] = performance.now()
    window.__mapWorkflow.phase = name
    window.__mapWorkflow.phaseStarts[name] = performance.now()
    window.__mapWorkflow.pending = []
    window.__mapWorkflow.domPending = []
  }, name)
}
async function pauseRecording(page) {
  await page.evaluate(() => {
    window.__mapWorkflow.phaseEnds[window.__mapWorkflow.phase] = performance.now()
    window.__mapWorkflow.phase = "idle"
    window.__mapWorkflow.pending = []
    window.__mapWorkflow.domPending = []
  })
}
async function collectRecording(page, result) {
  const instrument = await page.evaluate(() => ({
    events: window.__mapWorkflow.events,
    actions: window.__mapWorkflow.actions,
    longTasks: window.__mapWorkflow.longTasks,
    phaseStarts: window.__mapWorkflow.phaseStarts,
    phaseEnds: window.__mapWorkflow.phaseEnds,
  }))
  result.raw = instrument
  const starts = Object.entries(instrument.phaseStarts).sort((a, b) => a[1] - b[1])
  for (let i = 0; i < starts.length; i++) {
    const [phase, at] = starts[i],
      end = instrument.phaseEnds[phase] ?? starts[i + 1]?.[1] ?? Infinity
    const events = instrument.events.filter((event) => event.phase === phase)
    const motionEvents = events.filter(
      (event) => event.type === "pointermove" || event.type === "wheel",
    )
    const continuousEvents = motionEvents.filter(
      (event) => event.type === "wheel" || event.pointerDistance > 5,
    )
    const longTasks = instrument.longTasks.filter(
      (task) => task.startTime >= at && task.startTime < end,
    )
    result.phases[phase] = {
      inputToNextRafMs: quantiles(events.map((event) => event.nextRafMs)),
      inputToObservedMapRenderMs: quantiles(events.map((event) => event.observedMapRenderMs)),
      inputToDomUpdateMs: quantiles(events.map((event) => event.domUpdateMs)),
      motionInputToDomUpdateMs: quantiles(motionEvents.map((event) => event.domUpdateMs)),
      continuousInputToDomUpdateMs: quantiles(continuousEvents.map((event) => event.domUpdateMs)),
      gestureActivationWaitingMs: quantiles(
        motionEvents
          .filter((event) => event.type === "pointermove" && event.pointerDistance <= 5)
          .map((event) => event.domUpdateMs),
      ),
      motionInputToObservedMapRenderMs: quantiles(
        motionEvents.map((event) => event.observedMapRenderMs),
      ),
      browserEventToHandlerMs: quantiles(events.map((event) => event.handlerDelayMs)),
      longTaskDurationsMs: quantiles(longTasks.map((task) => task.duration)),
      longTaskTotalMs: longTasks.reduce((total, task) => total + task.duration, 0),
      ...(phase === "pan"
        ? { validity: result.panInputValidity, diagnosticsOnly: !result.panInputValidity?.valid }
        : {}),
    }
  }
}
async function quietMap(page, timeout = 12000) {
  return page.evaluate(
    (timeout) =>
      new Promise((resolve) => {
        const begin = performance.now()
        let last = Number(document.querySelector("[data-global-map]")?.dataset.renderCount ?? 0),
          changed = begin
        const poll = () => {
          const now = performance.now(),
            count = Number(document.querySelector("[data-global-map]")?.dataset.renderCount ?? 0)
          if (count !== last) {
            last = count
            changed = now
          }
          if (now - changed >= 350 || now - begin > timeout)
            resolve({ quiet: now - changed >= 350, elapsedMs: now - begin, renderCount: count })
          else setTimeout(poll, 70)
        }
        setTimeout(poll, 70)
      }),
    timeout,
  )
}
async function mapReady(page) {
  await page.waitForFunction(
    (expected) =>
      document.querySelector("[data-global-map]")?.open &&
      document.querySelectorAll("[data-global-map-node]").length === expected,
    model.concepts.length,
    { timeout: 20000 },
  )
  return quietMap(page)
}
async function move(page, cdp, touch, from, to, steps = 24) {
  if (touch) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: from.x, y: from.y }],
    })
    for (let i = 1; i <= steps; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            id: 1,
            x: from.x + ((to.x - from.x) * i) / steps,
            y: from.y + ((to.y - from.y) * i) / steps,
          },
        ],
      })
      await page.waitForTimeout(12)
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  } else {
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        from.x + ((to.x - from.x) * i) / steps,
        from.y + ((to.y - from.y) * i) / steps,
      )
      await page.waitForTimeout(12)
    }
    await page.mouse.up()
  }
}
async function safeNode(page) {
  // One geometry pass before input; never performed inside the timing loop.
  return page.evaluate(() => {
    const stage = document.querySelector("[data-global-map-stage]").getBoundingClientRect()
    const nodes = [...document.querySelectorAll("[data-global-map-node]")]
    for (const node of nodes) {
      const box = node.querySelector(".global-map-dot").getBoundingClientRect(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2
      if (x < stage.x + 28 || x > stage.right - 80 || y < stage.y + 28 || y > stage.bottom - 65)
        continue
      if (document.elementFromPoint(x, y)?.closest("[data-global-map-node]") === node)
        return { id: node.dataset.globalMapNode, x, y }
    }
    return null
  })
}
async function blankPoint(page) {
  return page.evaluate(() => {
    const root = document.querySelector("[data-global-map-stage]"),
      box = root.getBoundingClientRect()
    const targets = [...root.querySelectorAll("[data-global-map-node],[data-global-map-label]")]
      .map((node) => ({ box: node.getBoundingClientRect(), style: getComputedStyle(node) }))
      .filter(
        ({ box, style }) =>
          box.width > 0 &&
          box.height > 0 &&
          style.visibility !== "hidden" &&
          style.display !== "none",
      )
      .map(({ box }) => box)
    let safest = null
    for (let y = box.y + 35; y < box.bottom - 60; y += 25)
      for (let x = box.x + 35; x < box.right - 70; x += 25) {
        const hit = document.elementFromPoint(x, y)
        if (root.contains(hit) && !hit.closest("[data-global-map-node],[data-global-map-label]")) {
          const clearance = Math.min(
            ...targets.map((target) =>
              Math.hypot(
                Math.max(target.left - x, 0, x - target.right),
                Math.max(target.top - y, 0, y - target.bottom),
              ),
            ),
          )
          if (clearance >= 30 && (!safest || clearance > safest.clearance))
            safest = { x, y, clearance }
        }
      }
    return safest
  })
}
async function saveProfile(profile, name) {
  const file = path.join(output, `${name}.cpuprofile`)
  await writeFile(file, JSON.stringify(profile))
  const totals = new Map(),
    nodes = new Map(profile.nodes.map((node) => [node.id, node])),
    parents = new Map()
  for (const node of profile.nodes)
    for (const child of node.children ?? []) parents.set(child, node.id)
  for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
    const sampled = profile.samples[i],
      ms = (profile.timeDeltas?.[i] ?? 0) / 1000
    let current = sampled
    while (current) {
      const total = totals.get(current) ?? { selfMs: 0, inclusiveMs: 0 }
      total.inclusiveMs += ms
      if (current === sampled) total.selfMs += ms
      totals.set(current, total)
      current = parents.get(current)
    }
  }
  const hotspots = [...totals]
    .map(([id, total]) => ({ ...total, ...nodes.get(id).callFrame }))
    .sort((a, b) => b.selfMs - a.selfMs)
  const summary = {
    file,
    samples: profile.samples?.length ?? 0,
    durationMs: (profile.endTime - profile.startTime) / 1000,
    top20Self: hotspots.slice(0, 20),
    top20InclusiveRuntime: hotspots
      .filter((entry) => entry.url?.includes("topos.js"))
      .sort((a, b) => b.inclusiveMs - a.inclusiveMs)
      .slice(0, 20),
    separateFromTimingRun: true,
  }
  await writeFile(path.join(output, `${name}-hotspots.json`), JSON.stringify(summary, null, 2))
  return summary
}
async function profileCold(base) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page)
  try {
    if (runtimeDirectory)
      await page.route(/\/static\/topos\/topos\.(js|css)(?:\?.*)?$/, (route) => {
        const js = new URL(route.request().url()).pathname.endsWith(".js")
        return route.fulfill({
          status: 200,
          contentType: js ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8",
          body: js ? runtimeBytes : cssBytes,
        })
      })
    const address = new URL("topos.html", base)
    address.hash = new URLSearchParams({
      focus: focusConcept.id,
      depth: "2.1",
      topics: model.topics.map((topic) => topic.id).join(","),
    }).toString()
    await page.goto(address.href)
    await page.waitForFunction(
      () =>
        window.__topos &&
        document.querySelector('.topos-unfolding[data-active="true"] .topos-prose'),
    )
    await page.evaluate(() => document.fonts.ready)
    const initial = await snap(page)
    if (initial.globalMap.open || initial.globalMap.renderCount)
      throw new Error("Cold profile precondition was warmed")
    await cdp.send("Profiler.enable")
    await cdp.send("Profiler.setSamplingInterval", { interval: 500 })
    await cdp.send("Profiler.start")
    await page.locator("[data-open-global-map]").click()
    const quiet = await mapReady(page)
    const { profile } = await cdp.send("Profiler.stop")
    await cdp.send("Profiler.disable")
    report.coldProfile = {
      ...(await saveProfile(profile, "390-cold-map")),
      quiet,
      runtimeSha256: report.runtimeSha256,
      purpose:
        "Separate fresh-context cold map activation; CPU profile overhead is excluded from formal latency results.",
    }
    await shot(page, "390-cold-profile-view")
  } finally {
    await context.close()
  }
}
async function runViewport(width, base) {
  const height = width === 1440 ? 1000 : width === 1024 ? 900 : 844
  const name = String(width),
    context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width === 390,
      isMobile: width === 390,
    })
  const page = await context.newPage(),
    cdp = await context.newCDPSession(page)
  if (runtimeDirectory)
    await page.route(/\/static\/topos\/topos\.(js|css)(?:\?.*)?$/, (route) => {
      const js = new URL(route.request().url()).pathname.endsWith(".js")
      return route.fulfill({
        status: 200,
        contentType: js ? "text/javascript; charset=utf-8" : "text/css; charset=utf-8",
        body: js ? runtimeBytes : cssBytes,
        headers: { "cache-control": "no-store" },
      })
    })
  const result = { width, height, phases: {}, workflow: {}, consoleErrors: [] }
  report.measurements.push(result)
  page.on("pageerror", (error) => result.consoleErrors.push(error.message))
  const pendingResponses = []
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname
    if (pathname.endsWith("/static/topos/topos.js") || pathname.endsWith("/static/topos/topos.css"))
      pendingResponses.push(
        response.body().then((body) =>
          report.resources.push({
            width,
            kind: pathname.endsWith(".js") ? "javascript" : "stylesheet",
            url: response.url(),
            sha256: createHash("sha256").update(body).digest("hex"),
          }),
        ),
      )
  })
  await page.addInitScript(() => {
    const instrument = (window.__mapWorkflow = {
      phase: "startup",
      phaseStarts: {},
      phaseEnds: {},
      events: [],
      actions: [],
      longTasks: [],
      pending: [],
      domPending: [],
      frame: 0,
    })
    const pointerOrigins = new Map()
    new MutationObserver((mutations) => {
      const relevant = mutations.find((mutation) => mutation.target.matches?.("[data-global-map]"))
      if (!relevant) return
      const now = performance.now(),
        count = Number(relevant.target.dataset.renderCount ?? 0)
      for (const event of instrument.domPending)
        if (count !== event.initialRenderCount) event.domUpdateMs = now - event.receivedAt
      instrument.domPending = instrument.domPending.filter(
        (event) => event.domUpdateMs === undefined && now - event.receivedAt < 1200,
      )
    }).observe(document, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-render-count"],
    })
    if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          instrument.longTasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
            name: entry.name,
          })
      })
      observer.observe({ type: "longtask", buffered: true })
    }
    const sample = () => {
      instrument.frame = 0
      const now = performance.now(),
        map = document.querySelector("[data-global-map]"),
        renderCount = Number(map?.dataset.renderCount ?? 0)
      for (const event of instrument.pending) {
        event.nextRafMs ??= now - event.receivedAt
        if (renderCount !== event.initialRenderCount || (!event.initialOpen && map?.open))
          event.observedMapRenderMs = now - event.receivedAt
      }
      instrument.pending = instrument.pending.filter(
        (event) => event.observedMapRenderMs === undefined && now - event.receivedAt < 1200,
      )
      if (instrument.pending.length) instrument.frame = requestAnimationFrame(sample)
    }
    for (const type of ["pointerdown", "pointermove", "pointerup", "wheel", "click"])
      window.addEventListener(
        type,
        (event) => {
          if (["pointerdown", "pointerup", "click"].includes(type)) {
            const target = event.target.closest?.(
              "a,button,[data-global-map-node],[data-global-map-label]",
            )
            const action = {
              type,
              time: performance.now(),
              phase: instrument.phase,
              pointerType: event.pointerType ?? null,
              x: event.clientX,
              y: event.clientY,
              targetTag: event.target.tagName,
              targetNodeID: target?.dataset.globalMapNode ?? target?.dataset.globalMapLabel ?? null,
              href: target?.getAttribute("href") ?? null,
              targetText: target?.textContent?.slice(0, 120) ?? null,
              defaultPrevented: event.defaultPrevented,
              mapOpen: Boolean(document.querySelector("[data-global-map]")?.open),
              focus: document.querySelector("#topos-world")?.dataset.focus,
            }
            instrument.actions.push(action)
            setTimeout(() => {
              action.defaultPreventedAfterDispatch = event.defaultPrevented
            }, 0)
          }
          if (instrument.phase === "idle") return
          const map = document.querySelector("[data-global-map]")
          if (!map?.open && !event.target.closest?.("[data-open-global-map],[data-fold]")) return
          if (type === "pointermove" && !event.buttons) return
          if (type === "pointerdown")
            pointerOrigins.set(event.pointerId, { x: event.clientX, y: event.clientY })
          const origin = pointerOrigins.get(event.pointerId)
          const pointerDistance = origin
            ? Math.hypot(event.clientX - origin.x, event.clientY - origin.y)
            : null
          const target =
            type === "pointerdown"
              ? event.target.closest?.("[data-global-map-node],[data-global-map-label]")
              : null
          const now = performance.now(),
            record = {
              phase: instrument.phase,
              type,
              receivedAt: now,
              handlerDelayMs: Math.max(0, now - event.timeStamp),
              initialRenderCount: Number(map?.dataset.renderCount ?? 0),
              initialOpen: Boolean(map?.open),
              pointerDistance,
              targetNodeID: target?.dataset.globalMapNode ?? target?.dataset.globalMapLabel ?? null,
            }
          instrument.events.push(record)
          instrument.pending.push(record)
          instrument.domPending.push(record)
          if (type === "pointerup") pointerOrigins.delete(event.pointerId)
          if (!instrument.frame) instrument.frame = requestAnimationFrame(sample)
        },
        { capture: true, passive: true },
      )
  })
  try {
    const began = performance.now()
    const address = new URL("topos.html", base)
    address.hash = new URLSearchParams({
      focus: focusConcept.id,
      depth: "2.1",
      topics: model.topics.map((topic) => topic.id).join(","),
    }).toString()
    await page.goto(address.href, { waitUntil: "domcontentloaded" })
    await page.waitForFunction(
      () => window.__topos && document.querySelector("#topos-world")?.dataset.ready === "true",
    )
    await page.evaluate(() => document.fonts.ready)
    result.startupReadyWallMs = performance.now() - began
    await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
    const reader = await snap(page)
    result.workflow.readerFocus = reader.focus
    const source = model.concepts.find((concept) => concept.id === reader.focus)
    check(
      `${name}: real continuity note opens with rendered mathematics`,
      /度量拓扑与连续性/.test(source?.title ?? "") &&
        (await page.locator('.topos-unfolding[data-active="true"] math').count()) > 0,
      { id: reader.focus, title: source?.title },
    )
    check(
      `${name}: cold precondition starts in reader before any map draw`,
      !reader.globalMap.open && (reader.globalMap.renderCount ?? 0) === 0,
      { open: reader.globalMap.open, renderCount: reader.globalMap.renderCount },
    )
    await shot(page, `${name}-reading`)
    await startPhase(page, "cold-map-open")
    const coldStart = performance.now()
    result.coldMapEntry = "first-explicit-map-button-from-direct-reader"
    await page.locator("[data-open-global-map]").click()
    result.coldMapReady = await mapReady(page)
    result.coldMapReadyWallMs = performance.now() - coldStart
    await pauseRecording(page)
    const all = await snap(page)
    check(
      `${name}: full theme union keeps every real object exactly once`,
      all.globalMap.nodeIDs.length === model.concepts.length &&
        new Set(all.globalMap.nodeIDs).size === model.concepts.length,
      { count: all.globalMap.nodeIDs.length, expected: model.concepts.length },
    )
    await pauseRecording(page)
    await shot(page, `${name}-map-cold`)
    await page.locator("[data-global-map-close]").click()
    await startPhase(page, "warm-map-open")
    const warmStart = performance.now()
    await page.locator("[data-open-global-map]").click()
    result.warmMapReady = await mapReady(page)
    result.warmMapReadyWallMs = performance.now() - warmStart
    await pauseRecording(page)
    const warm = await snap(page)
    result.warmRenderWork = {
      before: all.globalMap.renderWork ?? null,
      after: warm.globalMap.renderWork ?? null,
    }
    if (!runtimeDirectory)
      check(
        `${name}: warm reopen does not recreate nodes`,
        warm.globalMap.renderWork?.nodesCreated === all.globalMap.renderWork?.nodesCreated &&
          Number.isFinite(warm.globalMap.renderWork?.nodesCreated),
        result.warmRenderWork,
      )
    const safe = await safeNode(page)
    if (!safe) throw new Error("No on-screen graph marker can receive a real drag")
    const before = await snap(page),
      focusBefore = before.focus
    await startPhase(page, "node-drag")
    await move(page, cdp, width === 390, safe, { x: safe.x + 52, y: safe.y + 35 })
    await startPhase(page, "node-settling")
    const dragQuiet = await quietMap(page)
    await pauseRecording(page)
    const after = await snap(page),
      first = before.globalMap.positions.find((node) => node.id === safe.id),
      moved = after.globalMap.positions.find((node) => node.id === safe.id)
    result.nodeDrag = {
      id: safe.id,
      worldDisplacement: Math.hypot(moved.x - first.x, moved.y - first.y),
      quiet: dragQuiet,
    }
    check(
      `${name}: displacement gesture moves a node without opening an article`,
      result.nodeDrag.worldDisplacement > 4 && after.globalMap.open && after.focus === focusBefore,
      result.nodeDrag,
    )
    const blank = await blankPoint(page)
    if (!blank) throw new Error("No empty stage location can receive a pan")
    const beforePan = after.globalMap.camera
    const beforePanWork = after.globalMap.renderWork
    await startPhase(page, "pan")
    await move(page, cdp, width === 390, blank, { x: blank.x + 40, y: blank.y + 24 })
    await quietMap(page)
    await pauseRecording(page)
    const panned = (await snap(page)).globalMap,
      afterPan = panned.camera
    const panDown = await page.evaluate(() =>
      window.__mapWorkflow.events.find(
        (event) => event.phase === "pan" && event.type === "pointerdown",
      ),
    )
    result.panInputValidity = {
      valid: Boolean(panDown && !panDown.targetNodeID),
      actualPointerDownTarget: panDown?.targetNodeID ?? null,
      blank,
    }
    check(
      `${name}: pan starts in a confirmed blank touch-safe target`,
      result.panInputValidity.valid,
      result.panInputValidity,
    )
    check(
      `${name}: blank drag pans the view`,
      Math.hypot(afterPan.x - beforePan.x, afterPan.y - beforePan.y) > 10,
      { before: beforePan, after: afterPan },
    )
    result.panRenderWork = { before: beforePanWork ?? null, after: panned.renderWork ?? null }
    if (!runtimeDirectory)
      check(
        `${name}: pure pan does not rewrite edge geometry`,
        Number.isFinite(beforePanWork?.edgeWrites) &&
          panned.renderWork?.edgeWrites === beforePanWork.edgeWrites,
        result.panRenderWork,
      )
    await startPhase(page, "zoom")
    const stage = await page.locator("[data-global-map-stage]").boundingBox()
    if (width === 390) {
      const x = stage.x + stage.width / 2,
        y = stage.y + stage.height / 2
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { id: 1, x: x - 25, y },
          { id: 2, x: x + 25, y },
        ],
      })
      for (let i = 1; i <= 16; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { id: 1, x: x - 25 - i * 2, y },
            { id: 2, x: x + 25 + i * 2, y },
          ],
        })
        await page.waitForTimeout(12)
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    } else {
      await page.mouse.move(stage.x + stage.width / 2, stage.y + stage.height / 2)
      for (let i = 0; i < 12; i++) {
        await page.mouse.wheel(0, -24)
        await page.waitForTimeout(16)
      }
    }
    await quietMap(page)
    await pauseRecording(page)
    const zoomed = await snap(page)
    check(
      `${name}: wheel or simulated two-finger input changes map scale`,
      zoomed.globalMap.camera.k > afterPan.k,
      { before: afterPan.k, after: zoomed.globalMap.camera.k },
    )
    const restBefore = await page.locator("[data-global-map]").getAttribute("data-render-count")
    await page.waitForTimeout(1200)
    const restAfter = await page.locator("[data-global-map]").getAttribute("data-render-count")
    check(`${name}: settled map stops renderer updates`, restBefore === restAfter, {
      before: restBefore,
      after: restAfter,
      restMs: 1200,
    })
    const clickTarget = await safeNode(page)
    if (!clickTarget) throw new Error("No actual marker remains available for the click task")
    result.workflow.clickTarget = clickTarget
    await collectRecording(page, result)
    if (width === 390) await page.touchscreen.tap(clickTarget.x, clickTarget.y)
    else await page.mouse.click(clickTarget.x, clickTarget.y)
    await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
    const clicked = await snap(page)
    check(
      `${name}: deliberate click opens the selected object's actual prose`,
      clicked.focus === clickTarget.id && !clicked.globalMap.open && clicked.reader,
      { expected: clickTarget.id, actual: clicked.focus, reader: clicked.reader },
    )
    if (process.env.MAP_WORKFLOW_TRACE_ONLY === "1") {
      await shot(page, `${name}-click-trace`)
      result.diagnosticOnly = true
      return
    }
    await page.goBack()
    await page.waitForFunction(() => document.querySelector("[data-global-map]")?.open)
    await quietMap(page)
    check(
      `${name}: browser Back restores the map and its object set`,
      (await snap(page)).globalMap.nodeIDs.length === model.concepts.length,
    )
    await shot(page, `${name}-map-restored`)
    // Separately exercise the human search/reading/fold task after the matched
    // performance run. Its cached map is not presented as the cold-open sample.
    // Both versions exit the map first: the saved baseline swallowed Ctrl+K
    // inside its modal, which is a separate known task defect, not a timer.
    await page.locator("[data-global-map-close]").click()
    await page.keyboard.press("Control+k")
    await page.locator("[data-topos-search-input]").fill(focusConcept.title)
    await page.locator(`[data-search-concept=${JSON.stringify(focusConcept.id)}]`).click()
    await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
    check(
      `${name}: search returns the intended actual continuity note`,
      (await snap(page)).focus === focusConcept.id,
    )
    await startPhase(page, "fold")
    await page.locator('.topos-unfolding[data-active="true"] [data-fold]').click()
    await page.waitForTimeout(150)
    result.workflow.foldReachedMap = await mapOpen(page)
    if (result.workflow.foldReachedMap) await quietMap(page)
    await pauseRecording(page)
    const folded = await snap(page)
    result.workflow.foldedFocus = folded.focus
    check(
      `${name}: fold returns directly to the meaningful map`,
      result.workflow.foldReachedMap && folded.focus === focusConcept.id,
      { focus: folded.focus, reader: folded.reader, overview: folded.overview },
    )
    await shot(page, `${name}-folded`)
    if (!result.workflow.foldReachedMap) {
      await page.locator("[data-open-global-map]").click()
      await mapReady(page)
    }
    await collectRecording(page, result)
    if (!runtimeDirectory) {
      for (const phase of ["cold-map-open", "warm-map-open"])
        check(
          `${name}: ${phase} next RAF stays below 120 ms`,
          Number.isFinite(result.phases[phase]?.inputToNextRafMs.p95) &&
            result.phases[phase].inputToNextRafMs.p95 < 120,
          result.phases[phase],
        )
      for (const phase of ["node-drag", "zoom"])
        check(
          `${name}: ${phase} motion update stays below 32 ms`,
          Number.isFinite(result.phases[phase]?.motionInputToObservedMapRenderMs.p95) &&
            result.phases[phase].motionInputToObservedMapRenderMs.p95 < 32,
          result.phases[phase],
        )
      for (const phase of ["node-drag", "pan"])
        check(
          `${name}: ${phase} has no continuous-input long task`,
          result.phases[phase]?.longTaskDurationsMs.count === 0,
          result.phases[phase],
        )
      const fixedPanTarget = { 1440: 21.44, 1024: 19.12, 390: 22.4 }[width]
      const baselineCase = compare?.measurements?.find((item) => item.width === width)
      const matched = baselineCase?.phases?.pan?.continuousInputToDomUpdateMs.p95
      const panTarget = Number.isFinite(matched)
        ? Math.min(fixedPanTarget, matched * 0.8)
        : fixedPanTarget
      result.historicalPanRafDiagnostic = {
        estimator: "all-motion input to RAF-observed render; includes <=5px activation waiting",
        measuredP95: result.phases.pan.motionInputToObservedMapRenderMs.p95,
        matchedBaselineP95: baselineCase?.phases?.pan?.motionInputToObservedMapRenderMs.p95 ?? null,
        previousAbsoluteLimit: fixedPanTarget,
        wouldPassPreviousAbsoluteLimit:
          result.phases.pan.motionInputToObservedMapRenderMs.p95 <= fixedPanTarget,
      }
      check(
        `${name}: valid continuous pan DOM update meets 20 percent improvement and retained absolute limit`,
        result.panInputValidity.valid &&
          baselineCase?.panInputValidity?.valid &&
          Number.isFinite(matched) &&
          Number.isFinite(result.phases.pan.continuousInputToDomUpdateMs.p95) &&
          result.phases.pan.continuousInputToDomUpdateMs.p95 <= panTarget,
        {
          measuredP95: result.phases.pan.continuousInputToDomUpdateMs.p95,
          fixedPanTarget,
          matchedBaselineP95: matched ?? null,
          requiredMaximum: panTarget,
          historicalRafDiagnostic: result.historicalPanRafDiagnostic,
        },
      )
    }
    if (width === 1440 && process.env.MAP_WORKFLOW_PROFILE !== "0") {
      // Profile a separate repetition. Its instrumentation overhead is excluded
      // from the timed workflow above and must not be used as a latency sample.
      await cdp.send("Profiler.enable")
      await cdp.send("Profiler.setSamplingInterval", { interval: 1000 })
      await cdp.send("Profiler.start")
      for (let repetition = 0; repetition < 2; repetition++) {
        const marker = await safeNode(page)
        if (!marker) throw new Error("No profile drag marker")
        await move(page, cdp, false, marker, { x: marker.x + 36, y: marker.y + 24 })
        await quietMap(page)
        const blank = await blankPoint(page)
        if (!blank) throw new Error("No profile pan surface")
        await move(page, cdp, false, blank, { x: blank.x + 30, y: blank.y + 22 })
        await quietMap(page)
      }
      const { profile } = await cdp.send("Profiler.stop")
      await cdp.send("Profiler.disable")
      const profileFile = path.join(output, `${name}-drag-pan.cpuprofile`)
      await writeFile(profileFile, JSON.stringify(profile))
      const totals = new Map(),
        nodes = new Map(profile.nodes.map((node) => [node.id, node])),
        parents = new Map()
      for (const node of profile.nodes)
        for (const child of node.children ?? []) parents.set(child, node.id)
      for (let i = 0; i < (profile.samples?.length ?? 0); i++) {
        const sampled = profile.samples[i],
          ms = (profile.timeDeltas?.[i] ?? 0) / 1000
        let current = sampled
        while (current) {
          const total = totals.get(current) ?? { selfMs: 0, inclusiveMs: 0 }
          total.inclusiveMs += ms
          if (current === sampled) total.selfMs += ms
          totals.set(current, total)
          current = parents.get(current)
        }
      }
      const hotspots = [...totals]
        .map(([id, total]) => ({ ...total, ...nodes.get(id).callFrame }))
        .sort((a, b) => b.selfMs - a.selfMs)
      result.profile = {
        file: profileFile,
        samples: profile.samples?.length ?? 0,
        durationMs: (profile.endTime - profile.startTime) / 1000,
        top20Self: hotspots.slice(0, 20),
        top20InclusiveRuntime: hotspots
          .filter((entry) => entry.url?.includes("topos.js"))
          .sort((a, b) => b.inclusiveMs - a.inclusiveMs)
          .slice(0, 20),
        separateFromTimingRun: true,
      }
      await writeFile(
        path.join(output, `${name}-hotspots.json`),
        JSON.stringify(result.profile, null, 2),
      )
    }
    check(
      `${name}: no browser execution errors`,
      result.consoleErrors.length === 0,
      result.consoleErrors,
    )
  } catch (error) {
    report.errors.push({ width, message: error.stack })
    await shot(page, `${name}-failure`).catch(() => {})
  } finally {
    await collectRecording(page, result).catch((error) => {
      result.recordingCollectionError = error.message
    })
    await Promise.allSettled(pendingResponses)
    const assets = report.resources.filter((resource) => resource.width === width)
    check(
      `${name}: browser received the exact measured runtime and stylesheet`,
      assets.some(
        (asset) => asset.kind === "javascript" && asset.sha256 === report.runtimeSha256,
      ) && assets.some((asset) => asset.kind === "stylesheet" && asset.sha256 === report.cssSha256),
      assets,
    )
    await context.close()
  }
}
try {
  await mkdir(output, { recursive: true })
  preview = await startPreview({ port: 0 })
  const base = `${preview.url}/World/`
  report.base = base
  browser = await chromium.launch({
    executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless: true,
  })
  report.browser = browser.version()
  if (process.env.MAP_WORKFLOW_PROFILE_ONLY !== "cold")
    for (const width of widths) await runViewport(width, base)
  if (
    process.env.MAP_WORKFLOW_COLD_PROFILE === "1" ||
    process.env.MAP_WORKFLOW_PROFILE_ONLY === "cold"
  )
    await profileCold(base)
} catch (error) {
  report.errors.push({ stage: "runner", message: error.stack })
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((entry) => entry.passed).length
  report.failed = report.checks.filter((entry) => !entry.passed).length + report.errors.length
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {
        passed: report.passed,
        failed: report.failed,
        output,
        measurements: report.measurements.map(({ width, phases }) => ({ width, phases })),
      },
      null,
      2,
    ),
  )
  if (report.failed) process.exitCode = 1
}
