import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const output = path.join(root, "artifacts", process.env.TOPOS_OUTPUT ?? "topos")
const runFile = promisify(execFile)
const scenarios = [
  "Persistent field: Group → Action → Representation with no document navigation",
  "World-coordinate trajectories, velocity, relevance, recession and emergence",
  "Semantic zoom 0–3, formal MathML and recursive in-place explanation",
  "Typed relation lenses; history, keyboard, wheel and simulated touch",
  "Three viewport recordings with labels and without any field text",
  "Frame extraction from actual WebM recordings and separate human visual judgement",
  "Reduced motion and readable mathematical overflow",
]
if (process.argv.includes("--describe")) {
  console.log(JSON.stringify({ scenarios, browserStarted: false, buildStarted: false }, null, 2))
  process.exit(0)
}

// Keep the small recorder tool in the project cache, never install another browser.
const recorderRoot = path.join(root, ".cache/topos-browser")
process.env.PLAYWRIGHT_BROWSERS_PATH ??= recorderRoot
const { chromium } = await import("playwright")
const ffmpeg = path.join(process.env.PLAYWRIGHT_BROWSERS_PATH, "ffmpeg-1011/ffmpeg-win64.exe")
const report = {
  startedAt: new Date().toISOString(),
  target: process.env.TOPOS_SITE_URL ?? "local /World/topos-demo.html",
  methods: [
    "Independent Knowledge Topos requirements; no old graph acceptance counts are inherited",
    "All navigation uses real UI input; the runtime API is read only",
    "Real Edge canvas and DOM video recording; no renderer, physics or content responses are stubbed",
    "World-coordinate samples supplement rather than replace human review of dynamic behaviour",
    "CDP touch is simulated input, not a physical phone",
  ],
  checks: [],
  recordings: [],
  errors: [],
  notRun: [],
  visualReview: {
    status: "pending",
    criteria: [
      "focus",
      "neighborhood",
      "context change",
      "attraction",
      "recession",
      "emergence",
      "hierarchy",
      "continuity",
      "semantic depth",
    ],
    instruction:
      "Do not turn this into a pass automatically: actually open the recorded videos or their extracted time sequences, state which behaviours remain weak or absent, and record reviewed files/times.",
  },
}
const check = (id, name, passed, evidence) => {
  report.checks.push({ id, name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${id} ${name}`)
}
const host = (page) => page.locator("#topos-world")
const canvas = (page) => page.locator("#topos-canvas")

// The adapter is explicit: absent diagnostics are errors, never invented zero values.
function normalize(raw) {
  const view = raw.state ?? raw.view ?? raw
  const nodes = raw.nodes ?? raw.particles
  const values = Array.isArray(nodes) ? nodes : Object.values(nodes ?? {})
  const normalized = values.map((node) => ({
    ...node,
    id: node.id,
    x: node.x ?? node.position?.x,
    y: node.y ?? node.position?.y,
    z: node.z ?? node.position?.z,
    vx: node.vx ?? node.velocity?.x,
    vy: node.vy ?? node.velocity?.y,
    vz: node.vz ?? node.velocity?.z,
    relevance: node.relevance,
    opacity: node.opacity ?? node.alpha,
  }))
  const result = {
    raw,
    focus: view.focusId ?? view.focus ?? raw.focusId,
    lens: view.lens ?? raw.lens,
    scale: view.scale ?? view.semanticScale ?? view.zoom ?? raw.scale,
    frame: raw.frame ?? view.frame,
    settled: raw.settled,
    nodes: normalized,
    relations: raw.context?.relations ?? raw.relations ?? raw.context?.edges ?? [],
    unfolded: view.unfolded ?? view.unfoldedSections ?? raw.unfoldedIDs ?? raw.unfolded ?? [],
  }
  if (!result.focus || !Number.isFinite(result.scale) || !normalized.length)
    throw new Error(
      "Topos read-only snapshot must expose focus, numerical semantic scale and nodes",
    )
  if (normalized.some((node) => !node.id || ![node.x, node.y, node.z].every(Number.isFinite)))
    throw new Error("Topos snapshot contains a node without stable ID or world XYZ coordinates")
  return result
}
async function snapshot(page) {
  return normalize(await page.evaluate(() => window.__topos.snapshot()))
}
async function ready(page) {
  await host(page).waitFor()
  await canvas(page).waitFor()
  await page.waitForFunction(
    () => Boolean(window.__topos?.snapshot && window.__topos?.renderer),
    undefined,
    { timeout: 30000 },
  )
}
async function calm(page) {
  await page.waitForFunction(() => window.__topos?.settled === true, undefined, { timeout: 20000 })
}
async function visibleExplanations(page) {
  return page.locator(".topos-unfolding").evaluateAll((roots) =>
    roots
      .filter(
        (root) =>
          !root.inert &&
          Number(getComputedStyle(root).opacity) > 0.05 &&
          root.getBoundingClientRect().width > 0,
      )
      .map((root) => ({
        owner: root.dataset.owner,
        content: root.textContent,
        mathCount: root.querySelectorAll("math").length,
        recursiveOptions: root.querySelectorAll("[data-open-section]").length,
      })),
  )
}
async function sample(page, milliseconds = 1800) {
  const samples = await page.evaluate(async (duration) => {
    const output = []
    const start = performance.now()
    await new Promise((resolve) => {
      const capture = (time) => {
        const value = window.__topos.snapshot()
        if (document.querySelector("#topos-world").classList.contains("topos-no-labels")) {
          value.acceptanceVisibleFieldLabels = [
            ...document.querySelectorAll(".topos-relation,.topos-concept,.topos-community"),
          ]
            .filter((element) => {
              let opacity = 1
              for (let node = element; node; node = node.parentElement) {
                const style = getComputedStyle(node)
                if (style.visibility === "hidden" || style.display === "none") return false
                opacity *= Number(style.opacity)
              }
              return opacity > 0.02 && element.getBoundingClientRect().width > 0
            })
            .map((element) => element.textContent.trim().slice(0, 60))
        }
        output.push({ time: time - start, value })
        if (time - start < duration) requestAnimationFrame(capture)
        else resolve()
      }
      requestAnimationFrame(capture)
    })
    return output
  }, milliseconds)
  return samples.map((entry) => ({ time: entry.time, ...normalize(entry.value) }))
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const byId = (state, id) => state.nodes.find((node) => node.id === id)
function dynamics(before, samples, after) {
  const initialDistances = []
  for (let i = 0; i < before.nodes.length; i++)
    for (let j = i + 1; j < before.nodes.length; j++) {
      const value = distance(before.nodes[i], before.nodes[j])
      if (value > 0) initialDistances.push(value)
    }
  initialDistances.sort((a, b) => a - b)
  const fieldScale = initialDistances[Math.floor(initialDistances.length / 2)] ?? 1
  const moved = before.nodes.filter((node) => {
    const end = byId(after, node.id)
    return end && distance(node, end) / fieldScale > 0.0001
  })
  const continuous = moved.filter((node) => {
    const points = samples.map((sample) => byId(sample, node.id)).filter(Boolean)
    return (
      new Set(points.map((point) => [point.x, point.y, point.z].map((x) => x.toFixed(4)).join(",")))
        .size > 3
    )
  })
  const speeds = samples.flatMap((sample) =>
    sample.nodes.map((node) => Math.hypot(node.vx, node.vy, node.vz)).filter(Number.isFinite),
  )
  const pairChanges = []
  for (let i = 0; i < before.nodes.length; i++)
    for (let j = i + 1; j < before.nodes.length; j++) {
      const a = before.nodes[i],
        b = before.nodes[j]
      const nextA = byId(after, a.id),
        nextB = byId(after, b.id)
      if (nextA && nextB) pairChanges.push(Math.abs(distance(a, b) - distance(nextA, nextB)))
    }
  const oldCenter = byId(before, after.focus),
    newCenter = byId(after, after.focus)
  const changingNeighbors = before.nodes
    .filter((node) => node.id !== after.focus)
    .map((node) => {
      const next = byId(after, node.id)
      if (!next || !oldCenter || !newCenter) return undefined
      return {
        id: node.id,
        relevanceBefore: node.relevance,
        relevanceAfter: next.relevance,
        opacityBefore: node.opacity,
        opacityAfter: next.opacity,
        distanceBefore: distance(node, oldCenter) / fieldScale,
        distanceAfter: distance(next, newCenter) / fieldScale,
      }
    })
    .filter(Boolean)
  return {
    fieldScale,
    sharedIds: before.nodes.filter((node) => byId(after, node.id)).map((node) => node.id),
    movedIds: moved.map((node) => node.id),
    continuousIds: continuous.map((node) => node.id),
    maximumRecordedSpeed: speeds.length ? Math.max(...speeds) : null,
    maximumPairDistanceChange: Math.max(0, ...pairChanges) / fieldScale,
    previousFocus: byId(after, before.focus),
    changedRelevance: before.nodes
      .filter((node) => byId(after, node.id)?.relevance !== node.relevance)
      .map((node) => node.id),
    changingNeighbors,
  }
}
async function identity(page) {
  return page.evaluate(() => {
    const old = window.__toposAcceptanceIdentity
    return {
      document: old.document === document,
      world: old.world === document.querySelector("#topos-world"),
      canvas: old.canvas === document.querySelector("#topos-canvas"),
      runtime: old.runtime === window.__topos,
      nodes: window.__topos.nodes.every((node) => old.nodes.get(node.id) === node),
    }
  })
}
async function clickConcept(page, id, touch = false) {
  const control = page
    .locator(`[data-concept=${JSON.stringify(id)}]`)
    .filter({ visible: true })
    .first()
  if (
    (await control.count()) &&
    (await control.evaluate((element) => Number(getComputedStyle(element).opacity) > 0.05))
  ) {
    if (touch) await control.tap()
    else await control.click()
    return
  }
  const current = await snapshot(page)
  const node = byId(current, id)
  if (!Number.isFinite(node?.screenX) || !Number.isFinite(node?.screenY))
    throw new Error(`Concept ${id} has no reachable UI or projected canvas hit target`)
  const box = await canvas(page).boundingBox()
  if (touch) await page.touchscreen.tap(box.x + node.screenX, box.y + node.screenY)
  else await page.mouse.click(box.x + node.screenX, box.y + node.screenY)
}
async function transition(page, id, entry, documents, touch) {
  await calm(page)
  const before = await snapshot(page)
  const requests = documents.length
  const start = Date.now() - entry.recordingStart
  await clickConcept(page, id, touch)
  const samples = await sample(page)
  await calm(page)
  const after = await snapshot(page)
  const evidence = dynamics(before, samples, after)
  const persistent = await identity(page)
  entry.transitions.push({
    from: before.focus,
    to: id,
    start,
    end: Date.now() - entry.recordingStart,
    before: before.raw,
    samples: samples.map((sample) => ({ time: sample.time, value: sample.raw })),
    after: after.raw,
    evidence,
  })
  const prefix = `${entry.name} ${before.focus}→${id}`
  if (entry.withoutLabels)
    check(
      "T10",
      `${prefix}: newly created field captions remain hidden throughout the transition`,
      samples.every((sample) => sample.raw.acceptanceVisibleFieldLabels.length === 0),
      samples
        .filter((sample) => sample.raw.acceptanceVisibleFieldLabels.length)
        .map((sample) => ({ time: sample.time, text: sample.raw.acceptanceVisibleFieldLabels })),
    )
  check(
    "T01",
    `${prefix}: the same world receives a new focus`,
    after.focus === id && Object.values(persistent).every(Boolean) && documents.length === requests,
    { persistent, documentRequestsBefore: requests, documentRequestsAfter: documents.length },
  )
  check(
    "T02",
    `${prefix}: multiple objects move through intermediate world positions`,
    evidence.continuousIds.length >= 3 &&
      evidence.maximumRecordedSpeed > 0 &&
      evidence.maximumPairDistanceChange > 0.0001,
    evidence,
  )
  check(
    "T03",
    `${prefix}: the previous focus retains its stable identity`,
    Boolean(evidence.previousFocus) && evidence.sharedIds.length >= before.nodes.length - 1,
    { previousFocus: evidence.previousFocus, shared: evidence.sharedIds.length },
  )
  check(
    "T04",
    `${prefix}: context changes actual semantic relevance`,
    evidence.changedRelevance.length >= 3,
    { changedRelevance: evidence.changedRelevance },
  )
  const expectedIncoming =
    id === "action"
      ? ["orbit", "stabilizer"]
      : ["module", "character", "irreducible-representation"]
  const incoming = expectedIncoming.map((id) =>
    evidence.changingNeighbors.find((node) => node.id === id),
  )
  check(
    "T04",
    `${prefix}: the specified new neighborhood approaches and gains relevance`,
    incoming.every(
      (node) =>
        node &&
        node.relevanceAfter > node.relevanceBefore &&
        node.distanceAfter < node.distanceBefore,
    ),
    incoming,
  )
  const receding = evidence.changingNeighbors.filter(
    (node) =>
      node.relevanceAfter < node.relevanceBefore &&
      (node.distanceAfter > node.distanceBefore || node.opacityAfter < node.opacityBefore),
  )
  check(
    "T03",
    `${prefix}: weaker context recedes spatially or in semantic depth`,
    receding.length > 0,
    receding,
  )
  if (!entry.withoutLabels) await checkLabels(page, `${prefix}: settled labels`)
}
async function checkLabels(page, name) {
  await page.evaluate(() => document.fonts.ready)
  const intersections = await page.evaluate(() => {
    const visible = (element) => {
      let opacity = 1
      for (let e = element; e; e = e.parentElement) {
        const style = getComputedStyle(e)
        if (style.visibility === "hidden" || style.display === "none") return false
        opacity *= Number(style.opacity)
      }
      return opacity > 0.25
    }
    const rects = (element, owner) => {
      const range = document.createRange()
      range.selectNodeContents(element)
      return [...range.getClientRects()].map((box) => ({
        left: box.left,
        right: box.right,
        top: box.top,
        bottom: box.bottom,
        text: element.textContent,
        title: element.classList.contains("concept-title"),
        owner,
      }))
    }
    const elements = [...document.querySelectorAll(".concept-title,.topos-relation")]
      .filter(visible)
      .flatMap(rects)
      .filter((box) => box.right > box.left && box.bottom > box.top)
    const collisions = []
    for (let i = 0; i < elements.length; i++)
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i],
          b = elements[j]
        if (a.owner === b.owner || (!a.title && !b.title)) continue
        const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
        const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
        if (width > 2 && height > 2) collisions.push({ a: a.text, b: b.text, width, height })
      }
    return collisions
  })
  check(
    "T12",
    `${name} keep concept titles separate from other titles and relation captions`,
    intersections.length === 0,
    intersections,
  )
}
async function hiddenTextEvidence(page) {
  return page.evaluate(() => {
    const world = document.querySelector("#topos-world")
    const walker = document.createTreeWalker(world, NodeFilter.SHOW_TEXT)
    const visible = []
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim()) continue
      const owner = text.parentElement
      let opacity = 1,
        concealed = false
      for (let node = owner; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        opacity *= Number(style.opacity)
        if (style.display === "none" || style.visibility === "hidden") concealed = true
      }
      const color = getComputedStyle(owner).color
      const transparent = color === "transparent" || /rgba\([^)]*,\s*0\s*\)$/.test(color)
      if (!concealed && opacity > 0.02 && !transparent && owner.getBoundingClientRect().width > 0)
        visible.push(text.textContent.trim().slice(0, 80))
    }
    return { mode: world.classList.contains("topos-no-labels"), visible }
  })
}
const inSemanticBand = (value, target) =>
  target === 0
    ? value < 0.1
    : target === 1
      ? value >= 0.85 && value < 1.7
      : target === 2
        ? value >= 2 && value < 2.7
        : value >= 2.7
async function zoomTo(page, target, withoutLabels = false) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const value = (await snapshot(page)).scale
    if (inSemanticBand(value, target)) return
    if (withoutLabels) {
      await canvas(page).focus()
      await page.keyboard.press(value < target ? "+" : "-")
    } else await page.locator(`[data-zoom="${value < target ? "in" : "out"}"]`).click()
    await page.waitForTimeout(100)
  }
  throw new Error(`Semantic zoom did not reach ${target} using actual controls`)
}
async function recordScenario(browser, base, viewport, withoutLabels) {
  const name = `${viewport.width}-${withoutLabels ? "no-text" : "labelled"}`
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width === 390,
    hasTouch: viewport.width === 390,
    reducedMotion: "no-preference",
    recordVideo: { dir: path.join(output, "videos/raw"), size: viewport },
  })
  context.setDefaultTimeout(30000)
  const page = await context.newPage()
  const entry = {
    name,
    viewport,
    withoutLabels,
    recordingStart: Date.now(),
    transitions: [],
    stateSamples: [],
    screenshots: [],
  }
  const documents = []
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url())
  })
  page.on("pageerror", (error) => report.errors.push({ name, message: error.message }))
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    const drawing = await canvas(page).evaluate((element) => {
      const gl = element.getContext("webgl2")
      return {
        webgl2: gl instanceof WebGL2RenderingContext,
        width: gl?.drawingBufferWidth,
        height: gl?.drawingBufferHeight,
      }
    })
    check(
      "T09",
      `${name}: the recorded field is actually GPU rendered`,
      drawing.webgl2 && drawing.width > 0 && drawing.height > 0,
      drawing,
    )
    await page.evaluate(() => {
      window.__toposAcceptanceIdentity = {
        document,
        world: document.querySelector("#topos-world"),
        canvas: document.querySelector("#topos-canvas"),
        runtime: window.__topos,
        nodes: new Map(window.__topos.nodes.map((node) => [node.id, node])),
      }
    })
    if (withoutLabels) {
      await page.locator("[data-help]").click()
      await page.locator("[data-labels-toggle]").click()
      await page.waitForTimeout(350)
      check(
        "T10",
        `${name}: recorded no-text mode hides semantic text without replacing the field`,
        (await hiddenTextEvidence(page)).mode &&
          (await hiddenTextEvidence(page)).visible.length === 0 &&
          Object.values(await identity(page)).every(Boolean),
      )
    }
    entry.initial = (await snapshot(page)).raw
    entry.initialTime = Date.now() - entry.recordingStart
    if (!withoutLabels) await checkLabels(page, `${name}: initial font-ready labels`)
    await page.waitForTimeout(500)
    await transition(page, "action", entry, documents, viewport.width === 390)
    await transition(page, "representation", entry, documents, viewport.width === 390)
    if (!withoutLabels && viewport.width !== 390) {
      const beforeWheel = await snapshot(page)
      // Pick real uncovered canvas, not its centre (which may contain a concept label).
      const wheelPoint = await page.evaluate(() => {
        const surface = document.querySelector("#topos-canvas")
        for (const y of [0.2, 0.35, 0.65, 0.8])
          for (const x of [0.2, 0.35, 0.65, 0.8]) {
            const point = { x: innerWidth * x, y: innerHeight * y }
            if (document.elementFromPoint(point.x, point.y) === surface) return point
          }
        throw new Error("No uncovered field position available for real wheel input")
      })
      await page.mouse.move(wheelPoint.x, wheelPoint.y)
      await page.mouse.wheel(0, -400)
      await page.waitForTimeout(350)
      const afterWheel = await snapshot(page)
      check(
        "T05",
        `${name}: actual wheel input changes semantic scale`,
        beforeWheel.scale !== afterWheel.scale && beforeWheel.focus === afterWheel.focus,
      )
    }
    for (const level of [0, 1, 2, 3]) {
      await zoomTo(page, level, withoutLabels)
      await calm(page)
      const state = await snapshot(page)
      entry.stateSamples.push({
        kind: "semantic-scale",
        level,
        time: Date.now() - entry.recordingStart,
        state: state.raw,
        mathCount: await page.locator(".topos-unfolding math").count(),
        content: await page.locator(".topos-unfolding").allTextContents(),
        visibleExplanations: await visibleExplanations(page),
      })
      await page.waitForTimeout(500)
    }
    if (withoutLabels) {
      const textEvidence = await hiddenTextEvidence(page)
      const boundaries = await page.locator(".topos-unfolding").evaluateAll((elements) =>
        elements.map((element) => {
          const style = getComputedStyle(element),
            box = element.getBoundingClientRect()
          return {
            width: box.width,
            height: box.height,
            opacity: Number(style.opacity),
            border: parseFloat(style.borderLeftWidth),
          }
        }),
      )
      check(
        "T10",
        `${name}: deep no-text view keeps the original explanatory geometry but hides its actual text`,
        textEvidence.visible.length === 0 &&
          boundaries.some(
            (boundary) =>
              boundary.width > 100 &&
              boundary.height > 100 &&
              boundary.opacity > 0.1 &&
              boundary.border > 0,
          ),
        { textEvidence, boundaries },
      )
    }
    if (!withoutLabels) {
      check(
        "T05",
        `${name}: every semantic resolution is reachable`,
        entry.stateSamples
          .filter((sample) => sample.kind === "semantic-scale")
          .every((sample) => inSemanticBand(normalize(sample.state).scale, sample.level)),
        entry.stateSamples.map(({ state, ...sample }) => sample),
      )
      const scaleSamples = entry.stateSamples.filter((sample) => sample.kind === "semantic-scale")
      const farState = normalize(scaleSamples.find((sample) => sample.level === 0).state)
      const conceptState = normalize(scaleSamples.find((sample) => sample.level === 1).state)
      const suppressed = farState.nodes.filter(
        (node) =>
          !node.major &&
          node.opacity < 0.1 &&
          byId(conceptState, node.id)?.opacity > node.opacity * 2,
      )
      check(
        "T05",
        `${name}: distant semantic resolution suppresses minor objects instead of only shrinking all labels`,
        suppressed.length >= 3 && farState.nodes.some((node) => node.major && node.opacity > 0.4),
        { suppressedIds: suppressed.map((node) => node.id) },
      )
      const communities = farState.raw.communities ?? []
      check(
        "T08",
        `${name}: coherent graph communities have actual nonzero rendered boundaries`,
        communities.some(
          (community) =>
            community.members.length >= 3 &&
            community.coherence > 0 &&
            community.visual?.opacity > 0.05 &&
            community.visual.rx > 0 &&
            community.visual.ry > 0,
        ),
        communities,
      )
      check(
        "T05",
        `${name}: semantic zoom exposes mathematical content beyond graphic magnification`,
        scaleSamples.find((sample) => sample.level === 0).visibleExplanations.length === 0 &&
          scaleSamples
            .find((sample) => sample.level === 2)
            .visibleExplanations.some((content) => content.mathCount > 0) &&
          scaleSamples
            .find((sample) => sample.level === 3)
            .visibleExplanations.some((content) => content.recursiveOptions > 0),
      )
      check(
        "T06",
        `${name}: close semantic scale contains real rendered mathematics`,
        (await page.locator(".topos-unfolding math").count()) > 0 &&
          (await page.locator(".topos-unfolding .katex-error").count()) === 0,
      )
      const child = page
        .locator(".topos-unfolding [data-open-section]")
        .filter({ visible: true })
        .first()
      if (!(await child.count()))
        throw new Error("Deep semantic level has no recursive explanatory section control")
      const before = await snapshot(page)
      const oldContent = await page.locator(".topos-unfolding").allTextContents()
      const requestCount = documents.length
      await child.click()
      await page.waitForTimeout(300)
      const after = await snapshot(page)
      check(
        "T06",
        `${name}: a child explanation unfolds without replacing the focus or world`,
        before.focus === after.focus &&
          Object.values(await identity(page)).every(Boolean) &&
          documents.length === requestCount &&
          JSON.stringify(oldContent) !==
            JSON.stringify(await page.locator(".topos-unfolding").allTextContents()),
      )
      entry.recursive = {
        time: Date.now() - entry.recordingStart,
        state: after.raw,
        content: await page.locator(".topos-unfolding").allTextContents(),
      }
      for (const lens of ["structural", "action", "linear"]) {
        await page.locator(`button[data-lens="${lens}"]`).click()
        await calm(page)
        const state = await snapshot(page)
        entry.stateSamples.push({
          kind: "lens",
          lens,
          time: Date.now() - entry.recordingStart,
          state: state.raw,
        })
        check("T07", `${name}: ${lens} lens changes the active view`, state.lens === lens)
      }
      const lensSamples = entry.stateSamples
        .filter((sample) => sample.kind === "lens")
        .map((sample) => normalize(sample.state))
      const relationSets = new Set(
        lensSamples.map((sample) =>
          JSON.stringify(
            sample.relations.map((relation) => `${relation.id}:${relation.type}`).sort(),
          ),
        ),
      )
      const lensMovement = lensSamples.slice(1).some((sample) =>
        lensSamples[0].nodes.some((node) => {
          const next = byId(sample, node.id)
          return next && distance(node, next) > 0.01
        }),
      )
      check(
        "T07",
        `${name}: semantic lenses change the typed subgraph or the spatial field`,
        relationSets.size > 1 || lensMovement,
        { distinctRelationSets: relationSets.size, lensMovement },
      )
      check(
        "T12",
        `${name}: mathematical content does not widen the document`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      )
      const beforeBack = await snapshot(page)
      await page.goBack()
      await ready(page)
      await calm(page)
      const backed = await snapshot(page)
      await page.goForward()
      await ready(page)
      await calm(page)
      const forwarded = await snapshot(page)
      check(
        "T11",
        `${name}: history restores a previous semantic state and returns`,
        (backed.focus !== beforeBack.focus ||
          backed.lens !== beforeBack.lens ||
          backed.scale !== beforeBack.scale ||
          JSON.stringify(backed.unfolded) !== JSON.stringify(beforeBack.unfolded)) &&
          forwarded.focus === beforeBack.focus &&
          forwarded.lens === beforeBack.lens &&
          forwarded.scale === beforeBack.scale,
      )
      await zoomTo(page, 1)
      const keyboardScale = (await snapshot(page)).scale
      await page.locator('[data-zoom="in"]').focus()
      await page.keyboard.press("Enter")
      await page.waitForTimeout(200)
      check(
        "T11",
        `${name}: keyboard activates semantic zoom with visible focus`,
        (await snapshot(page)).scale > keyboardScale &&
          (await page
            .locator('[data-zoom="in"]')
            .evaluate((element) => element === document.activeElement)),
      )
    }
    await zoomTo(page, 1, withoutLabels)
    await calm(page)
    if (!withoutLabels) await directManipulation(page, context, name, viewport)
    entry.final = (await snapshot(page)).raw
    await page.waitForTimeout(350)
    const idleState = (await snapshot(page)).raw
    check(
      "T02",
      `${name}: damping ends with a stopped render loop rather than perpetual decorative drift`,
      entry.final.settled && idleState.settled && entry.final.frame === idleState.frame,
      { firstFrame: entry.final.frame, laterFrame: idleState.frame },
    )
    entry.documents = documents
    check(
      "T01",
      `${name}: concept exploration makes only the initial document request`,
      documents.length === 1,
      documents,
    )
    const shot = path.join(output, `${name}-final.png`)
    await page.screenshot({ path: shot })
    entry.screenshots.push(shot)
  } catch (error) {
    report.errors.push({ name, message: error.stack })
    entry.error = error.message
  } finally {
    const video = page.video()
    await context.close()
    const rawVideo = await video.path()
    entry.video = path.join(output, "videos", `${name}.webm`)
    await copyFile(rawVideo, entry.video)
    await writeFile(
      path.join(output, `${name}-trajectory.json`),
      JSON.stringify(entry, null, 2) + "\n",
    )
    report.recordings.push(entry)
  }
}
async function directManipulation(page, context, name, viewport) {
  const before = await snapshot(page)
  const box = await canvas(page).boundingBox()
  const nodeId = await page.evaluate(
    ({ nodes, focus }) => {
      const surface = document.querySelector("#topos-canvas")
      return nodes.find(
        (node) =>
          node.id !== focus &&
          node.opacity > 0.45 &&
          node.screenX > 55 &&
          node.screenX < innerWidth - 65 &&
          node.screenY > 80 &&
          node.screenY < innerHeight - 100 &&
          document.elementFromPoint(node.screenX, node.screenY) === surface,
      )?.id
    },
    { nodes: before.nodes, focus: before.focus },
  )
  if (!nodeId) throw new Error("No visible neighboring sphere available for direct dragging")
  const node = byId(before, nodeId)
  const point = { x: box.x + node.screenX, y: box.y + node.screenY }
  let during
  if (viewport.width > 500) {
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 55, point.y + 35, { steps: 8 })
    during = await snapshot(page)
    await page.mouse.up()
  } else {
    const session = await context.newCDPSession(page)
    const touch = (x, y, id = 1) => ({ x, y, id })
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [touch(point.x, point.y)],
    })
    for (let step = 1; step <= 8; step++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [touch(point.x + step * 5, point.y + step * 3)],
      })
    during = await snapshot(page)
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await calm(page)
    const pinchBefore = await snapshot(page)
    // Both fingers start on the actual canvas, away from labels and controls.
    const pinchOrigin = await page.evaluate(() => {
      const surface = document.querySelector("#topos-canvas")
      const nodes = window.__topos.snapshot().nodes
      for (let y = 100; y < innerHeight - 110; y += 35) {
        const candidates = []
        for (let x = 45; x < innerWidth - 45; x += 25)
          if (
            document.elementFromPoint(x, y) === surface &&
            nodes.every((node) => Math.hypot(x - node.screenX, y - node.screenY) > 26)
          )
            candidates.push({ x, y })
        if (candidates.length > 1 && candidates.at(-1).x - candidates[0].x >= 80)
          return { left: candidates[0], right: candidates.at(-1) }
      }
      throw new Error("No uncovered two-finger field positions")
    })
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [touch(pinchOrigin.left.x, pinchOrigin.left.y)],
    })
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        touch(pinchOrigin.left.x, pinchOrigin.left.y),
        touch(pinchOrigin.right.x, pinchOrigin.right.y, 2),
      ],
    })
    for (let step = 1; step <= 6; step++)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          touch(pinchOrigin.left.x - step * 5, pinchOrigin.left.y),
          touch(pinchOrigin.right.x + step * 5, pinchOrigin.right.y, 2),
        ],
      })
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await page.waitForTimeout(250)
    const pinched = await snapshot(page)
    check(
      "T11",
      `${name}: two real simulated fingers change semantic scale without concept navigation`,
      pinched.scale !== pinchBefore.scale && pinched.focus === pinchBefore.focus,
      { before: pinchBefore.scale, after: pinched.scale },
    )
    await session.detach()
  }
  await calm(page)
  const after = await snapshot(page)
  check(
    "T11",
    `${name}: dragging changes a real node position without becoming a concept click`,
    during.focus === before.focus &&
      after.focus === before.focus &&
      distance(node, byId(during, node.id)) > 1 &&
      Object.values(await identity(page)).every(Boolean),
    { id: node.id, worldDisplacementDuringDrag: distance(node, byId(during, node.id)) },
  )
}
async function extractFrames(entry) {
  const frames = []
  for (const [index, transition] of entry.transitions.entries()) {
    const duration = transition.end - transition.start
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const milliseconds = transition.start + duration * fraction
      const file = path.join(
        output,
        "frames",
        `${entry.name}-transition-${index + 1}-${String(Math.round(fraction * 100)).padStart(3, "0")}.png`,
      )
      await runFile(
        ffmpeg,
        ["-y", "-ss", (milliseconds / 1000).toFixed(3), "-i", entry.video, "-frames:v", "1", file],
        { windowsHide: true, maxBuffer: 1024 * 1024 },
      )
      await access(file)
      frames.push({ transition: index + 1, fraction, milliseconds, file })
    }
  }
  for (const state of entry.stateSamples.filter((sample) => sample.kind === "semantic-scale")) {
    const file = path.join(output, "frames", `${entry.name}-semantic-${state.level}.png`)
    await runFile(
      ffmpeg,
      ["-y", "-ss", String((state.time + 100) / 1000), "-i", entry.video, "-frames:v", "1", file],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    )
    await access(file)
    frames.push({
      kind: "semantic-scale",
      level: state.level,
      milliseconds: state.time + 100,
      file,
    })
  }
  entry.frames = frames
  await writeFile(
    path.join(output, `${entry.name}-frames.json`),
    JSON.stringify({ video: entry.video, frames }, null, 2) + "\n",
  )
}
async function reducedMotion(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    await zoomTo(page, 3)
    await page
      .locator('[data-open-section="group-associativity"]')
      .filter({ visible: true })
      .first()
      .click()
    const formulaWidths = await page
      .locator(".topos-unfolding .katex-display")
      .evaluateAll((formulas) =>
        formulas.map((formula, index) => ({
          index,
          width: formula.clientWidth,
          content: formula.scrollWidth,
          overflow: getComputedStyle(formula).overflowX,
          tabIndex: formula.tabIndex,
        })),
      )
    const longFormula = formulaWidths.find((formula) => formula.content > formula.width + 8)
    check(
      "T12",
      "Narrow-view long mathematical expressions use their own scrollable focusable region",
      Boolean(longFormula && longFormula.overflow === "auto" && longFormula.tabIndex === 0) &&
        (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)),
      formulaWidths,
    )
    if (longFormula) {
      const formula = page.locator(".topos-unfolding .katex-display").nth(longFormula.index)
      await formula.focus()
      await page.keyboard.press("ArrowRight")
      await page.waitForTimeout(180)
      check(
        "T12",
        "A keyboard reader can scroll the long formula without moving the whole document",
        (await formula.evaluate((element) => element.scrollLeft > 0)) &&
          (await page.evaluate(() => document.documentElement.scrollLeft === 0)),
      )
      await page.screenshot({ path: path.join(output, "long-formula-390.png") })
    }
    await zoomTo(page, 1)
    await calm(page)
    await clickConcept(page, "action")
    await calm(page)
    const first = await snapshot(page)
    await page.waitForTimeout(350)
    const second = await snapshot(page)
    check(
      "T12",
      "Reduced motion preserves the Action context and stops continuing field motion",
      second.focus === "action" &&
        first.nodes.every((node) => {
          const next = byId(second, node.id)
          return next && distance(node, next) < 0.00001
        }),
    )
    await zoomTo(page, 3)
    await calm(page)
    check(
      "T12",
      "Reduced motion retains formal mathematics and a readable narrow viewport",
      (await page.locator(".topos-unfolding math").count()) > 0 &&
        (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)),
    )
    await page.screenshot({ path: path.join(output, "reduced-motion-390.png") })
  } catch (error) {
    report.errors.push({ name: "reduced-motion", message: error.stack })
  } finally {
    await context.close()
  }
}
async function refreshState(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 900 } })
  const page = await context.newPage()
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    await clickConcept(page, "action")
    await calm(page)
    await zoomTo(page, 3)
    await page
      .locator(".topos-unfolding [data-open-section]")
      .filter({ visible: true })
      .first()
      .click()
    await page.locator('button[data-lens="action"]').click()
    await calm(page)
    await page.waitForTimeout(300)
    const before = await snapshot(page)
    const address = page.url()
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    const after = await snapshot(page)
    check(
      "T11",
      "Refresh restores the shared focus, lens, semantic scale and recursive explanation",
      address === page.url() &&
        before.focus === after.focus &&
        before.lens === after.lens &&
        before.scale === after.scale &&
        JSON.stringify(before.unfolded) === JSON.stringify(after.unfolded) &&
        (await page.locator(".topos-unfolding math").count()) > 0,
      {
        address,
        before: {
          focus: before.focus,
          lens: before.lens,
          scale: before.scale,
          unfolded: before.unfolded,
        },
        after: {
          focus: after.focus,
          lens: after.lens,
          scale: after.scale,
          unfolded: after.unfolded,
        },
      },
    )
    await page.screenshot({ path: path.join(output, "refreshed-context-1024.png") })
    await zoomTo(page, 1)
    await calm(page)
    const originalFocus = (await snapshot(page)).focus
    const popupPromise = context.waitForEvent("page")
    await page.locator('a[data-concept="representation"]').click({ modifiers: ["Control"] })
    const popup = await popupPromise
    await popup.bringToFront()
    await ready(popup)
    check(
      "T11",
      "Modifier click retains native new-tab semantics while the original field keeps its context",
      (await snapshot(popup)).focus === "representation" &&
        (await snapshot(page)).focus === originalFocus,
      { popupUrl: popup.url(), originalFocus },
    )
    await popup.close()
  } catch (error) {
    report.errors.push({ name: "refresh-state", message: error.stack })
  } finally {
    await context.close()
  }
}
async function recursiveReferences(browser, base) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  const page = await context.newPage()
  const documents = []
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url())
  })
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    await zoomTo(page, 3)
    await page.locator('a[data-section-target="group-associativity"]').click()
    await calm(page)
    const count = (id) =>
      page.locator(`.topos-unfolding[data-owner="group"] [data-section-id="${id}"]`).count()
    check(
      "T06",
      "An inline section reference opens exactly one original associativity explanation",
      (await count("group-associativity")) === 1 &&
        (await snapshot(page)).focus === "group" &&
        documents.length === 1,
    )
    await page.locator('button[data-open-section="group-example"]').first().click()
    await calm(page)
    check(
      "T06",
      "Recursive example and its mathematical parent each occur once in the explanation tree",
      (await count("group-associativity")) === 1 && (await count("group-example")) === 1,
    )
    const address = page.url()
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await calm(page)
    check(
      "T11",
      "Copied recursive context refreshes without duplicating either mathematical section",
      page.url() === address &&
        (await count("group-associativity")) === 1 &&
        (await count("group-example")) === 1,
    )
    const popupPromise = context.waitForEvent("page")
    await page
      .locator('a[data-section-target="group-associativity"]')
      .click({ modifiers: ["Control"] })
    const popup = await popupPromise
    await popup.bringToFront()
    await ready(popup)
    await calm(popup)
    check(
      "T11",
      "Inline section references also retain native new-tab and deep-link semantics",
      (await snapshot(popup)).focus === "group" &&
        (await popup.locator('[data-section-id="group-associativity"]').count()) === 1 &&
        (await count("group-example")) === 1,
      { popup: popup.url(), original: page.url() },
    )
    await popup.close()
    await page.screenshot({ path: path.join(output, "recursive-references-390.png") })
  } catch (error) {
    report.errors.push({ name: "recursive-references", message: error.stack })
  } finally {
    await context.close()
  }
}
async function labelRegressions(browser, base) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width === 390,
      hasTouch: viewport.width === 390,
    })
    const page = await context.newPage()
    try {
      await page.goto(base, { waitUntil: "domcontentloaded" })
      await ready(page)
      await calm(page)
      await page.evaluate(() => {
        window.__toposAcceptanceIdentity = {
          document,
          world: document.querySelector("#topos-world"),
          canvas: document.querySelector("#topos-canvas"),
          runtime: window.__topos,
          nodes: new Map(window.__topos.nodes.map((node) => [node.id, node])),
        }
      })
      await checkLabels(page, `${viewport.width} Group glyph regression`)
      for (const id of ["action", "representation"]) {
        await clickConcept(page, id)
        await calm(page)
        await checkLabels(page, `${viewport.width} ${id} glyph regression`)
      }
      if (viewport.width === 390) {
        await page.locator('button[data-lens="linear"]').click()
        await calm(page)
        await directManipulation(page, context, "390 input regression", viewport)
      }
      await page.screenshot({ path: path.join(output, `labels-regression-${viewport.width}.png`) })
    } catch (error) {
      report.errors.push({ name: `labels-${viewport.width}`, message: error.stack })
    } finally {
      await context.close()
    }
  }
}
async function recordRecursiveDepth(browser, base) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const name = `${viewport.width}-recursive-no-text`
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width === 390,
      hasTouch: viewport.width === 390,
      recordVideo: { dir: path.join(output, "videos/raw"), size: viewport },
    })
    const page = await context.newPage()
    const entry = {
      name,
      viewport,
      recordingStart: Date.now(),
      frames: [],
      samples: [],
      transitions: [],
      stateSamples: [],
      withoutLabels: true,
    }
    const documents = []
    page.on("request", (request) => {
      if (request.resourceType() === "document") documents.push(request.url())
    })
    try {
      const address = new URL(base)
      address.hash = new URLSearchParams({
        focus: "group",
        lens: "structural",
        depth: "1",
      }).toString()
      await page.goto(address.href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await calm(page)
      await page.evaluate(() => {
        window.__toposDepthIdentity = {
          canvas: document.querySelector("#topos-canvas"),
          world: document.querySelector("#topos-world"),
        }
        window.__toposAcceptanceIdentity = {
          document,
          world: document.querySelector("#topos-world"),
          canvas: document.querySelector("#topos-canvas"),
          runtime: window.__topos,
          nodes: new Map(window.__topos.nodes.map((node) => [node.id, node])),
        }
      })
      await page.locator("[data-help]").click()
      await page.locator("[data-labels-toggle]").click()
      await transition(page, "action", entry, documents, viewport.width === 390)
      await transition(page, "representation", entry, documents, viewport.width === 390)
      await zoomTo(page, 3, true)
      await calm(page)
      entry.samples.push({
        kind: "before-recursion",
        time: Date.now() - entry.recordingStart,
        state: (await snapshot(page)).raw,
      })
      await page.waitForTimeout(1800)
      const branch = page
        .locator('.topos-unfolding[data-owner="representation"] button[data-open-section]')
        .first()
      const childId = await branch.getAttribute("data-open-section")
      const before = await snapshot(page)
      entry.openTime = Date.now() - entry.recordingStart
      await branch.click()
      await calm(page)
      const after = await snapshot(page)
      check(
        "T06",
        `${name}: actual recursive button adds a single child in the same field`,
        after.focus === before.focus &&
          after.unfolded.length > before.unfolded.length &&
          (await page
            .locator(`.topos-unfolding[data-owner="representation"] [data-section-id="${childId}"]`)
            .count()) === 1 &&
          (await page.evaluate(
            () =>
              window.__toposDepthIdentity.canvas === document.querySelector("#topos-canvas") &&
              window.__toposDepthIdentity.world === document.querySelector("#topos-world"),
          )) &&
          documents.length === 1,
        { childId, before: before.unfolded, after: after.unfolded },
      )
      entry.samples.push({
        kind: "after-recursion",
        time: Date.now() - entry.recordingStart,
        state: after.raw,
      })
      await page.waitForTimeout(1800)
      const unfolding = page.locator('.topos-unfolding[data-owner="representation"]')
      const box = await unfolding.boundingBox()
      await page.mouse.move(
        box.x + box.width * 0.7,
        Math.min(viewport.height - 110, box.y + box.height * 0.6),
      )
      await page.mouse.wheel(0, 360)
      await page.waitForTimeout(500)
      entry.samples.push({
        kind: "nested-boundary-in-view",
        time: Date.now() - entry.recordingStart,
        state: (await snapshot(page)).raw,
      })
      const boundary = await page
        .locator(`.topos-unfolding[data-owner="representation"] [data-section-id="${childId}"]`)
        .evaluate((element) => {
          const box = element.getBoundingClientRect(),
            container = element.closest(".topos-unfolding").getBoundingClientRect()
          return {
            top: box.top,
            bottom: box.bottom,
            parentTop: container.top,
            parentBottom: container.bottom,
            nested: Boolean(element.closest(".topos-branch")),
            border: parseFloat(getComputedStyle(element).borderLeftWidth),
          }
        })
      const text = await hiddenTextEvidence(page)
      check(
        "T10",
        `${name}: nested original branch geometry is visible while mathematical text stays hidden`,
        text.visible.length === 0 &&
          boundary.nested &&
          boundary.border > 0 &&
          boundary.top < boundary.parentBottom &&
          boundary.bottom > boundary.parentTop,
        { boundary, text },
      )
      await page.waitForTimeout(1800)
      await page.screenshot({ path: path.join(output, `${name}.png`) })
    } catch (error) {
      report.errors.push({ name, message: error.stack })
      entry.error = error.message
    } finally {
      const video = page.video()
      await context.close()
      entry.video = path.join(output, "videos", `${name}.webm`)
      await copyFile(await video.path(), entry.video)
      for (const state of entry.samples) {
        const file = path.join(output, "frames", `${name}-${state.kind}.png`)
        const milliseconds = state.time + 400
        await runFile(
          ffmpeg,
          ["-y", "-ss", String(milliseconds / 1000), "-i", entry.video, "-frames:v", "1", file],
          { windowsHide: true, maxBuffer: 1024 * 1024 },
        )
        await access(file)
        entry.frames.push({ kind: state.kind, milliseconds, file })
      }
      await writeFile(
        path.join(output, `${name}-trajectory.json`),
        JSON.stringify(entry, null, 2) + "\n",
      )
      report.recordings.push(entry)
    }
  }
}
let browser, preview
let stopRequested = false
process.on("SIGINT", () => {
  stopRequested = true
})
try {
  await access(ffmpeg)
  await mkdir(path.join(output, "videos/raw"), { recursive: true })
  await mkdir(path.join(output, "frames"), { recursive: true })
  preview = process.env.TOPOS_SITE_URL ? undefined : await startPreview({ port: 0 })
  const base = process.env.TOPOS_SITE_URL ?? `${preview.url}/World/topos-demo.html`
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  const labelsOnly = process.argv.includes("--labels-only")
  const depthOnly = process.argv.includes("--depth-recording")
  const referencesOnly = process.argv.includes("--references-only")
  const regressionsOnly =
    process.argv.includes("--regressions") || labelsOnly || depthOnly || referencesOnly
  if (depthOnly) await recordRecursiveDepth(browser, base)
  if (referencesOnly) await recursiveReferences(browser, base)
  if (regressionsOnly && !depthOnly && !referencesOnly) await labelRegressions(browser, base)
  viewportLoop: for (const viewport of regressionsOnly
    ? []
    : [
        { width: 1440, height: 1000 },
        { width: 1024, height: 900 },
        { width: 390, height: 844 },
      ])
    for (const withoutLabels of [false, true]) {
      await recordScenario(browser, base, viewport, withoutLabels)
      stopRequested ||= await access(path.join(output, "stop-after-context")).then(
        () => true,
        () => false,
      )
      if (stopRequested) {
        report.notRun.push(
          "Further browser scenarios deliberately stopped after saving the current recording.",
        )
        break viewportLoop
      }
    }
  for (const entry of report.recordings) if (entry.transitions) await extractFrames(entry)
  if (!stopRequested && !labelsOnly && !depthOnly && !referencesOnly) {
    await reducedMotion(browser, base)
    await refreshState(browser, base)
    await recursiveReferences(browser, base)
  }
  report.notRun.push(
    "Human visual judgement of the nine no-text dynamic criteria is pending; frame generation is not acceptance.",
  )
} catch (error) {
  report.errors.push({ stage: "setup-or-video-extraction", message: error.stack })
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((check) => check.passed).length
  report.failed = report.checks.filter((check) => !check.passed).length + report.errors.length
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
  console.log(
    JSON.stringify({
      passed: report.passed,
      failed: report.failed,
      recordings: report.recordings.length,
      visualReview: report.visualReview.status,
    }),
  )
  if (report.failed) process.exitCode = 1
}
