import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"
import { startPreview } from "./preview.mjs"

// The IDs below are actual published reading fixtures, not synthetic replacements.
// Every population, topic union, direction and edge expectation comes from the model.
const fixtures = {
  notes: {
    focus: "note:笔记主体/书籍/Simon实分析/第一章/知识/度量拓扑与连续性的三种刻画",
    formula: "a-000010",
  },
  atlas: { focus: "math.region.analysis-pde" },
}
const output = path.resolve(process.env.READING_SPACE_OUTPUT ?? "artifacts/reading-space/local")
const cases = process.env.READING_SPACE_CASES?.split(",") ?? [
  "notes-1440",
  "notes-1024",
  "notes-390",
  "atlas-1440",
  "atlas-1024",
  "atlas-390",
  "notes-390-reduced",
  "atlas-1440-reduced",
]
await mkdir(output, { recursive: true })
const models = Object.fromEntries(
  await Promise.all(
    ["notes", "atlas"].map(async (mode) => [
      mode,
      JSON.parse(
        await readFile(`public/static/topos/${mode === "notes" ? "index" : "atlas"}.json`, "utf8"),
      ).model,
    ]),
  ),
)
const report = {
  startedAt: new Date().toISOString(),
  scriptSha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  checks: [],
  errors: [],
  scenes: [],
  screenshots: [],
  resources: [],
  limits: [
    "New reading-space and complete-map requirements; earlier stable-overview results are not reused.",
    "Headless Edge; mobile touch is simulated. No physical phone or FPS claim.",
    "The complete graph must contain every eligible selected ID. Side direction thumbnails may page independently.",
  ],
}
const preview = process.env.READING_SPACE_BASE ? undefined : await startPreview({ port: 0 })
const base = process.env.READING_SPACE_BASE ?? `${preview.url}/World/`
report.base = base
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const selector = (attribute, id) => `[${attribute}=${JSON.stringify(id)}]`
const sameIDs = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const snap = (page) => page.evaluate(() => window.__topos.snapshot())
const activeReading = (page) => page.locator('.topos-unfolding[data-active="true"]')
const shot = async (page, name) => {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
async function ready(page) {
  await page.waitForFunction(() => document.querySelector("#topos-world")?.dataset.ready === "true")
  await page.evaluate(() => document.fonts.ready)
}
async function readReady(page, id) {
  await page.waitForFunction((id) => {
    const root = document.querySelector('.topos-unfolding[data-active="true"]')
    return (
      window.__topos.state.focus === id &&
      root?.querySelector(".topos-prose") &&
      !root.querySelector("[data-section-loading]") &&
      document.querySelector("#topos-world")?.dataset.reader === "true"
    )
  }, id)
  await page.waitForFunction(() => window.__topos.settled, null, { timeout: 12000 })
}
async function mapReady(page) {
  await page.waitForFunction(() => window.__topos.snapshot().globalMap?.open === true)
  await page.waitForFunction(() => window.__topos.snapshot().globalMap?.settled, null, {
    timeout: 12000,
  })
}
async function readingStill(page) {
  return activeReading(page).evaluate(
    (root) =>
      new Promise((resolve, reject) => {
        const started = performance.now(),
          initial = root.scrollTop
        let previous = initial,
          stable = 0
        const sample = () => {
          const value = root.scrollTop
          stable = value === previous ? stable + 1 : 0
          previous = value
          if (stable >= 8) resolve({ initial, final: value, elapsed: performance.now() - started })
          else if (performance.now() - started > 4000)
            reject(new Error("Native touch scroll did not settle"))
          else requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
      }),
  )
}
async function captureReadingGeometry(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.topos-unfolding[data-active="true"]'),
      bounds = root.getBoundingClientRect(),
      heading = document.querySelector(".topos-reader-title"),
      isVisible = (node) => {
        if (!node?.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false
        const style = getComputedStyle(node)
        return Number(style.opacity) > 0.1 && style.visibility !== "hidden"
      }
    const utilityButtons = [...document.querySelectorAll(".topos-utility button")]
      .filter(isVisible)
      .map((node) => ({
        label: node.getAttribute("aria-label") ?? node.textContent,
        ...node.getBoundingClientRect().toJSON(),
      }))
    const directionRails = [...document.querySelectorAll("[data-reading-direction]")]
      .filter(isVisible)
      .map((node) => ({
        side: node.getAttribute("data-reading-direction"),
        ...node.getBoundingClientRect().toJSON(),
      }))
    const utilityOverlaps = utilityButtons.flatMap((button) =>
      directionRails
        .filter(
          (rail) =>
            Math.min(button.right, rail.right) - Math.max(button.left, rail.left) > 1 &&
            Math.min(button.bottom, rail.bottom) - Math.max(button.top, rail.top) > 1,
        )
        .map((rail) => ({ button: button.label, side: rail.side })),
    )
    return {
      reading: bounds.toJSON(),
      clientHeight: root.clientHeight,
      scrollHeight: root.scrollHeight,
      title: heading?.textContent,
      titleRect: heading?.getBoundingClientRect().toJSON(),
      titleVisible: isVisible(heading),
      backgroundCanvasVisible: [
        document.querySelector("#topos-canvas"),
        document.querySelector(".topos-flat-canvas"),
      ].some(isVisible),
      backgroundLabels: [...document.querySelectorAll("#topos-labels a[data-concept]")]
        .filter(isVisible)
        .map((a) => a.dataset.concept),
      horizontalOverflow: document.documentElement.scrollWidth - innerWidth,
      overflowY: getComputedStyle(root).overflowY,
      utilityButtons,
      directionRails,
      utilityOverlaps,
    }
  })
}
async function directionalEvidence(page, model, focus, prefix) {
  const traces = {}
  for (const side of ["incoming", "outgoing"]) {
    const edges = model.relations.filter((r) =>
      side === "incoming" ? r.target === focus && r.source !== focus : r.source === focus,
    )
    const expected = [...new Set(edges.map((r) => (side === "incoming" ? r.source : r.target)))]
    const root = page.locator(selector("data-reading-direction", side))
    if (!(await root.evaluate((e) => e.open))) await root.locator(":scope > summary").click()
    const seen = new Set(),
      seenEdges = new Set()
    let iterations = 0
    while (true) {
      const links = await root
        .locator("a.reading-direction-title[data-direction-target]")
        .evaluateAll((elements) =>
          elements.map((a) => ({ id: a.dataset.directionTarget, text: a.textContent })),
        )
      for (const link of links) seen.add(link.id)
      const drawn = await root.locator("path[data-relation-id]").evaluateAll((elements) =>
        elements.map((e) => ({
          id: e.dataset.relationId,
          source: e.dataset.source,
          target: e.dataset.target,
          provenance: e.dataset.provenance,
          type: e.dataset.relationType,
        })),
      )
      for (const edge of drawn) seenEdges.add(edge.id)
      check(
        `${prefix} ${side} thumbnail page ${iterations + 1}: source directions and categories are exact`,
        drawn.every((d) =>
          edges.some(
            (e) =>
              e.id === d.id &&
              e.source === d.source &&
              e.target === d.target &&
              e.type === d.type &&
              (e.provenance ?? "recorded") === d.provenance,
          ),
        ) &&
          links.every((l) => model.concepts.find((c) => c.id === l.id)?.title === l.text?.trim()),
        { links, drawn },
      )
      const next = root.locator('[data-direction-page="next"]')
      if (!(await next.count()) || (await next.isDisabled())) break
      if (++iterations > model.concepts.length)
        throw new Error("Direction paging did not terminate")
      await next.click()
    }
    check(
      `${prefix} ${side}: all genuine adjacent objects are reachable`,
      sameIDs([...seen], expected),
      {
        seen: [...seen],
        expected,
        edgeIDs: [...seenEdges],
      },
    )
    if (!expected.length)
      check(
        `${prefix} ${side}: empty direction has no invented thumbnail`,
        (await root.locator("svg").count()) === 0 &&
          (await root.locator("[data-direction-overview]").count()) > 0,
      )
    traces[side] = { expected, seen: [...seen], edgeIDs: [...seenEdges] }
  }
  return traces
}
async function touchDrag(cdp, from, to) {
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: from.x, y: from.y, id: 1 }],
  })
  for (let step = 1; step <= 12; step++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / 12,
          y: from.y + ((to.y - from.y) * step) / 12,
          id: 1,
        },
      ],
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
}
async function nativeLink(page, context, locator, prefix) {
  const href = await locator.getAttribute("href"),
    before = page.url(),
    opened = context.waitForEvent("page")
  const dot = locator.locator("circle.global-map-dot")
  if (await dot.count()) {
    await locator.focus()
    await mapReady(page)
    await dot.click({ modifiers: ["Control"] })
  } else await locator.click({ modifiers: ["Control"] })
  const popup = await opened
  await popup.waitForLoadState("domcontentloaded")
  const expected = new URL(href, before)
  check(
    `${prefix}: Ctrl activation preserves the native independent address`,
    new URL(popup.url()).pathname === expected.pathname && page.url() === before,
    { expected: expected.href, actual: popup.url() },
  )
  await popup.close()
  await page.bringToFront()
}

async function movePointer(page, cdp, mobile, from, to) {
  if (mobile) return touchDrag(cdp, from, to)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 12 })
  await page.mouse.up()
}

try {
  for (const name of cases) {
    const [mode, widthText, variation] = name.split("-"),
      width = Number(widthText),
      mobile = width === 390,
      model = models[mode],
      fixture = fixtures[mode],
      focus = model.concepts.find((c) => c.id === fixture.focus)
    if (!focus) throw new Error(`Actual reading fixture missing: ${fixture.focus}`)
    const viewport = { width, height: mobile ? 844 : width === 1024 ? 900 : 1000 },
      context = await browser.newContext({
        viewport,
        isMobile: mobile,
        hasTouch: mobile,
        reducedMotion: variation === "reduced" ? "reduce" : "no-preference",
      })
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page),
      record = { name, viewport, variation },
      errors = []
    report.scenes.push(record)
    let documents = 0
    page.on("pageerror", (e) => errors.push(e.stack ?? e.message))
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents++
    })
    page.on("response", async (response) => {
      if (new URL(response.url()).pathname.endsWith("/static/topos/topos.js")) {
        const bytes = await response.body().catch(() => null)
        report.resources.push({
          scene: name,
          url: response.url(),
          sha256: bytes ? createHash("sha256").update(bytes).digest("hex") : null,
        })
      }
    })
    try {
      const selectedTopics = model.topics.map((t) => t.id),
        expectedIDs = model.concepts
          .filter((c) => c.topicIDs?.some((id) => selectedTopics.includes(id)))
          .map((c) => c.id),
        url = new URL(mode === "notes" ? "topos.html" : "atlas.html", base)
      url.hash = new URLSearchParams({
        focus: focus.id,
        depth: "2.1",
        topics: selectedTopics.join(","),
      })
      await page.goto(url.href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await readReady(page, focus.id)
      await page.evaluate(() => {
        window.__readingSpaceIdentity = {
          canvas: document.querySelector("#topos-canvas"),
          world: document.querySelector("#topos-world"),
        }
      })
      const geometry = await captureReadingGeometry(page)
      record.geometry = geometry
      check(
        `${name}: source reader has substantial width and height`,
        geometry.reading.width >= (width === 1440 ? 900 : width === 1024 ? 680 : width - 32) &&
          geometry.clientHeight >= viewport.height * 0.65 &&
          geometry.reading.top >= 0 &&
          geometry.reading.bottom <= viewport.height + 1,
        geometry,
      )
      check(
        `${name}: reading keeps only its current title and no large background map`,
        geometry.titleVisible &&
          geometry.title?.trim() === focus.title &&
          !geometry.backgroundCanvasVisible &&
          geometry.backgroundLabels.length === 0,
        geometry,
      )
      check(
        `${name}: utility controls do not cover the directional reading rails`,
        geometry.utilityOverlaps.length === 0,
        {
          buttons: geometry.utilityButtons,
          rails: geometry.directionRails,
          overlaps: geometry.utilityOverlaps,
        },
      )
      const bodyText = await activeReading(page).innerText()
      check(
        `${name}: source identity and mathematical status remain present`,
        mode === "notes"
          ? (await activeReading(page).locator(".katex-mathml math").count()) > 0 &&
              (!focus.proofStatus || bodyText.includes(focus.proofStatus))
          : bodyText.includes("Lean") && bodyText.includes("来源"),
      )
      await shot(page, `${name}-reading`)
      record.directions = await directionalEvidence(page, model, focus.id, name)
      await shot(page, `${name}-directions`)
      const direction = page
        .locator(
          `a.reading-direction-title[data-direction-target]:not(${selector("data-direction-target", focus.id)})`,
        )
        .first()
      if (!(await direction.count()))
        throw new Error("Reading fixture has no genuine direction link")
      if (!mobile) await nativeLink(page, context, direction, `${name} direction`)
      const sourceBounds = await activeReading(page).boundingBox()
      if (mode === "notes") {
        if (mobile)
          await touchDrag(
            cdp,
            {
              x: sourceBounds.x + sourceBounds.width / 2,
              y: sourceBounds.y + sourceBounds.height - 45,
            },
            { x: sourceBounds.x + sourceBounds.width / 2, y: sourceBounds.y + 110 },
          )
        else {
          await page.mouse.move(sourceBounds.x + sourceBounds.width / 2, sourceBounds.y + 180)
          await page.mouse.wheel(0, 420)
        }
        await page.waitForTimeout(400)
        record.scrollSettling = await readingStill(page)
      }
      const scrollBeforeDirection = await activeReading(page).evaluate((e) => e.scrollTop)
      if (mode === "notes")
        check(
          `${name}: long original prose scrolls inside the larger reading surface`,
          scrollBeforeDirection > 50 && (await page.evaluate(() => window.scrollY)) === 0,
          { scrollTop: scrollBeforeDirection },
        )
      await direction.focus()
      await page.evaluate(() => {
        window.__readingSpaceSourceActivation = null
        const capture = (event) => {
          if (!event.target.closest("[data-direction-target]")) return
          window.__readingSpaceSourceActivation = document.querySelector(
            '.topos-unfolding[data-active="true"]',
          ).scrollTop
          document.removeEventListener("click", capture, true)
        }
        document.addEventListener("click", capture, true)
      })
      const target = await direction.getAttribute("data-direction-target")
      await direction.press("Enter")
      await readReady(page, target)
      record.sourceActivationScroll = await page.evaluate(
        () => window.__readingSpaceSourceActivation,
      )
      check(
        `${name}: keyboard direction activation reuses the same reader and scene`,
        documents === 1 &&
          (await page.evaluate(
            () =>
              window.__readingSpaceIdentity.canvas === document.querySelector("#topos-canvas") &&
              window.__readingSpaceIdentity.world === document.querySelector("#topos-world"),
          )),
      )
      await page.goBack()
      await readReady(page, focus.id)
      check(
        `${name}: Back restores the direction link focus`,
        await page.evaluate(
          (id) => document.activeElement?.getAttribute("data-direction-target") === id,
          target,
        ),
      )
      check(
        `${name}: Back restores the original source reading position`,
        typeof record.sourceActivationScroll === "number" &&
          Math.abs(
            (await activeReading(page).evaluate((e) => e.scrollTop)) -
              record.sourceActivationScroll,
          ) < 3,
        {
          sampledBeforeActivation: scrollBeforeDirection,
          atActualActivation: record.sourceActivationScroll,
          after: await activeReading(page).evaluate((e) => e.scrollTop),
        },
      )
      const trigger = page.locator("[data-open-global-map]"),
        triggerBounds = await trigger.boundingBox(),
        originalURL = page.url(),
        originalScroll = await activeReading(page).evaluate((r) => r.scrollTop)
      check(
        `${name}: global graph has an explicit upper-right entry`,
        triggerBounds.x + triggerBounds.width / 2 > width * 0.5 && triggerBounds.y < 100,
        triggerBounds,
      )
      await trigger.click()
      await mapReady(page)
      const map = page.locator("[data-global-map]"),
        stage = page.locator("[data-global-map-stage]")
      const beforeMap = (await snap(page)).globalMap
      record.mapInitial = beforeMap
      const renderedIDs = await map
        .locator("a[data-global-map-node]")
        .evaluateAll((nodes) => nodes.map((a) => a.dataset.globalMapNode))
      check(
        `${name}: every selected object is a genuine unpaginated graph node`,
        sameIDs(renderedIDs, expectedIDs) &&
          sameIDs(beforeMap.nodeIDs, expectedIDs) &&
          (await map.locator("circle.global-map-dot").count()) === expectedIDs.length &&
          new Set(renderedIDs).size === renderedIDs.length,
        { expected: expectedIDs, rendered: renderedIDs, snapshot: beforeMap.nodeIDs },
      )
      check(
        `${name}: global graph edges only connect actual selected source relations`,
        sameIDs(
          beforeMap.edgeIDs,
          model.relations
            .filter((r) => expectedIDs.includes(r.source) && expectedIDs.includes(r.target))
            .map((r) => r.id),
        ),
      )
      await page.locator("[data-global-map-fit]").click()
      await mapReady(page)
      const fitted = (await snap(page)).globalMap,
        bounds = await stage.boundingBox()
      check(
        `${name}: fit includes every selected physical node in the stage`,
        fitted.positions.length === expectedIDs.length &&
          fitted.positions.every(
            (p) =>
              p.screenX >= bounds.x &&
              p.screenX <= bounds.x + bounds.width &&
              p.screenY >= bounds.y &&
              p.screenY <= bounds.y + bounds.height,
          ),
        { stage: bounds, camera: fitted.camera },
      )
      const groupNames = await map.locator("[data-global-map-group] text").evaluateAll((texts) =>
        texts.map((text) => ({
          title: text.textContent,
          ...text.getBoundingClientRect().toJSON(),
        })),
      )
      const groupOverlaps = groupNames.flatMap((a, i) =>
        groupNames
          .slice(i + 1)
          .filter(
            (b) =>
              Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
              Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1,
          )
          .map((b) => [a.title, b.title]),
      )
      check(
        `${name}: fitted theme names are present and do not overlap`,
        groupNames.length === fitted.groups.length && groupOverlaps.length === 0,
        { names: groupNames, overlaps: groupOverlaps },
      )
      await shot(page, `${name}-global-map`)
      const safeNodes = fitted.positions.filter(
        (p) =>
          p.id !== focus.id &&
          p.screenX > bounds.x + 55 &&
          p.screenX < bounds.x + bounds.width - 80 &&
          p.screenY > bounds.y + 55 &&
          p.screenY < bounds.y + bounds.height - 80,
      )
      const selected = await page.evaluate(
        (nodes) =>
          nodes.find(
            (p) =>
              document
                .elementFromPoint(p.screenX, p.screenY)
                ?.closest("[data-global-map-node]")
                ?.getAttribute("data-global-map-node") === p.id,
          ),
        safeNodes,
      )
      if (!selected) throw new Error("No fitted node has a safe drag target")
      const from = { x: selected.screenX, y: selected.screenY },
        to = { x: from.x + 40, y: from.y + 30 }
      await movePointer(page, cdp, mobile, from, to)
      await page.waitForTimeout(250)
      const dragged = (await snap(page)).globalMap,
        moved = dragged.positions.find((p) => p.id === selected.id)
      check(
        `${name}: graph dragging changes real node coordinates without opening a reader`,
        dragged.open &&
          (await snap(page)).focus === focus.id &&
          Math.hypot(moved.x - selected.x, moved.y - selected.y) > 2,
        { id: selected.id, before: selected, after: moved },
      )
      const zoomBefore = dragged.camera.k
      await page.locator('[data-global-map-zoom="in"]').click()
      await mapReady(page)
      const zoomed = (await snap(page)).globalMap
      check(`${name}: zoom changes the actual graph camera`, zoomed.camera.k > zoomBefore)
      const blank = await stage.evaluate(
        (stage, { positions, mobile }) => {
          const r = stage.getBoundingClientRect()
          for (let x = r.x + 35; x < r.right - 65; x += 23)
            for (let y = r.y + 35; y < r.bottom - 65; y += 23) {
              const hit = document.elementFromPoint(x, y)
              if (
                hit &&
                stage.contains(hit) &&
                !hit.closest("[data-global-map-node]") &&
                positions.every(
                  (node) => Math.hypot(node.screenX - x, node.screenY - y) > (mobile ? 38 : 20),
                )
              )
                return { x, y }
            }
          return null
        },
        { positions: zoomed.positions, mobile },
      )
      if (!blank) throw new Error("The real graph has no safe blank pan start")
      const beforePan = (await snap(page)).globalMap
      await page.evaluate(() => {
        window.__readingSpacePanTarget = null
        document.querySelector("[data-global-map-stage]").addEventListener(
          "pointerdown",
          (event) => {
            window.__readingSpacePanTarget = {
              tag: event.target.tagName,
              node: event.target
                .closest("[data-global-map-node]")
                ?.getAttribute("data-global-map-node"),
              x: event.clientX,
              y: event.clientY,
            }
          },
          { capture: true, once: true },
        )
      })
      await movePointer(page, cdp, mobile, blank, { x: blank.x + 35, y: blank.y + 25 })
      const afterPan = (await snap(page)).globalMap
      check(
        `${name}: blank dragging pans the camera without dragging an object`,
        Math.hypot(afterPan.camera.x - beforePan.camera.x, afterPan.camera.y - beforePan.camera.y) >
          5 &&
          afterPan.positions.every((p) => {
            const previous = beforePan.positions.find((q) => q.id === p.id)
            return Math.hypot(p.x - previous.x, p.y - previous.y) < 1
          }),
        {
          before: beforePan.camera,
          after: afterPan.camera,
          start: blank,
          pointerTarget: await page.evaluate(() => window.__readingSpacePanTarget),
          movedIDs: afterPan.positions
            .filter((p) => {
              const previous = beforePan.positions.find((q) => q.id === p.id)
              return Math.hypot(p.x - previous.x, p.y - previous.y) >= 1
            })
            .map((p) => p.id),
        },
      )
      if (mobile) {
        const middle = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
          beforePinch = (await snap(page)).globalMap.camera.k
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: middle.x - 35, y: middle.y, id: 1 },
            { x: middle.x + 35, y: middle.y, id: 2 },
          ],
        })
        for (let step = 1; step <= 8; step++) {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              { x: middle.x - 35 - step * 4, y: middle.y, id: 1 },
              { x: middle.x + 35 + step * 4, y: middle.y, id: 2 },
            ],
          })
          await page.waitForTimeout(20)
        }
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        check(
          `${name}: simulated two-finger pinch zooms the graph`,
          (await snap(page)).globalMap.camera.k > beforePinch,
        )
      } else {
        const beforeWheel = (await snap(page)).globalMap.camera.k
        await page.mouse.move(blank.x, blank.y)
        await page.mouse.wheel(0, -180)
        await page.waitForTimeout(150)
        check(
          `${name}: wheel changes graph scale locally`,
          (await snap(page)).globalMap.camera.k > beforeWheel,
        )
      }
      await mapReady(page)
      const mapBeforeRefresh = (await snap(page)).globalMap
      await page.waitForTimeout(700)
      check(
        `${name}: the untouched complete graph stops repainting`,
        (await snap(page)).globalMap.renderCount === mapBeforeRefresh.renderCount,
      )
      await page.reload({ waitUntil: "domcontentloaded" })
      await ready(page)
      await mapReady(page)
      const mapAfterRefresh = (await snap(page)).globalMap
      check(
        `${name}: refreshing the map URL restores node positions and camera`,
        sameIDs(mapBeforeRefresh.nodeIDs, mapAfterRefresh.nodeIDs) &&
          mapAfterRefresh.positions.every((p) => {
            const previous = mapBeforeRefresh.positions.find((q) => q.id === p.id)
            return Math.hypot(p.x - previous.x, p.y - previous.y) < 0.1
          }) &&
          Math.abs(mapAfterRefresh.camera.k - mapBeforeRefresh.camera.k) < 0.001 &&
          Math.hypot(
            mapAfterRefresh.camera.x - mapBeforeRefresh.camera.x,
            mapAfterRefresh.camera.y - mapBeforeRefresh.camera.y,
          ) < 1,
        { before: mapBeforeRefresh.camera, after: mapAfterRefresh.camera },
      )
      await page.locator("[data-global-map-fit]").click()
      await mapReady(page)
      await page.locator("[data-global-map-close]").focus()
      await page.keyboard.press("Shift+Tab")
      check(
        `${name}: keyboard focus stays inside the global map`,
        await map.evaluate((e) => e.contains(document.activeElement)),
        await page.evaluate(() => ({
          active: document.activeElement?.outerHTML.slice(0, 800),
          open: document.querySelector("[data-global-map]")?.open,
        })),
      )
      await page.keyboard.press("Control+k")
      check(
        `${name}: modal graph isolates the underlying reader shortcuts`,
        !(await page.locator(".topos-search").evaluate((e) => e.open)),
      )
      await page.keyboard.press("Escape")
      await readReady(page, focus.id)
      check(
        `${name}: Escape closes only the map and restores its trigger`,
        !(await snap(page)).globalMap.open &&
          page.url() === originalURL &&
          (await trigger.evaluate((e) => document.activeElement === e)) &&
          Math.abs((await activeReading(page).evaluate((r) => r.scrollTop)) - originalScroll) < 2,
        {
          currentURL: page.url(),
          originalURL,
          scroll: await activeReading(page).evaluate((r) => r.scrollTop),
          originalScroll,
          active: await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 800)),
          mapOpen: (await snap(page)).globalMap.open,
        },
      )
      await trigger.click()
      await mapReady(page)
      await page.goBack()
      await readReady(page, focus.id)
      check(
        `${name}: browser Back closes map before leaving the reading`,
        !(await snap(page)).globalMap.open,
      )
      await trigger.click()
      await mapReady(page)
      const targetID = selected.id,
        nativeNode = map.locator(selector("data-global-map-node", targetID))
      if (!mobile) await nativeLink(page, context, nativeNode, `${name} graph`)
      await nativeNode.focus()
      await page.evaluate(() => {
        window.__readingSpaceEvents = []
        for (const type of ["click", "keydown", "keyup", "pointerdown", "pointerup"])
          document.addEventListener(
            type,
            (e) =>
              window.__readingSpaceEvents.push({
                type,
                key: e.key,
                target: e.target
                  ?.closest("[data-global-map-node]")
                  ?.getAttribute("data-global-map-node"),
                time: performance.now(),
                detail: e.detail,
              }),
            true,
          )
      })
      await nativeNode.press("Enter")
      await readReady(page, targetID)
      check(
        `${name}: keyboard graph selection opens the actual object`,
        !(await snap(page)).globalMap.open,
      )
      await page.goBack()
      await mapReady(page)
      check(
        `${name}: Back from a graph selection returns to the same whole graph`,
        sameIDs((await snap(page)).globalMap.nodeIDs, expectedIDs),
      )
      await nativeNode.focus()
      await nativeNode.press("Enter")
      await readReady(page, targetID)
      record.repeatGraphActivation = {
        events: await page.evaluate(() => window.__readingSpaceEvents),
        focus: (await snap(page)).focus,
      }
      await page.reload({ waitUntil: "domcontentloaded" })
      await ready(page)
      await readReady(page, targetID)
      check(
        `${name}: chosen object survives direct URL refresh`,
        (await snap(page)).focus === targetID,
      )
      check(
        `${name}: no document-wide horizontal overflow`,
        (await captureReadingGeometry(page)).horizontalOverflow <= 0,
      )
      const sharedTopic = model.concepts.find((c) => c.id === selected.id).topicIDs[0],
        subTopics = [...new Set([sharedTopic, model.topics[0].id])]
      const topicButton = page.locator(".topos-topics-trigger")
      if (await topicButton.isVisible()) await topicButton.click()
      await page.getByRole("button", { name: "清空", exact: true }).click()
      for (const topic of subTopics) {
        const input = page.locator(selector("data-topic", topic))
        if (!(await input.isVisible())) await topicButton.click()
        await input.check()
      }
      const topicClose = page.locator("[data-close-topics]")
      if (await topicClose.isVisible()) await topicClose.click()
      await trigger.click()
      await mapReady(page)
      const subset = (await snap(page)).globalMap,
        subsetExpected = model.concepts
          .filter((c) => c.topicIDs?.some((id) => subTopics.includes(id)))
          .map((c) => c.id),
        sharedBefore = mapBeforeRefresh.positions.find((p) => p.id === selected.id),
        sharedAfter = subset.positions.find((p) => p.id === selected.id)
      check(
        `${name}: checkbox topic union includes every selected physical node exactly once`,
        sameIDs(subset.nodeIDs, subsetExpected),
        { topics: subTopics, expected: subsetExpected, actual: subset.nodeIDs },
      )
      check(
        `${name}: changing selected topics retains a shared node's manual coordinates`,
        sharedAfter &&
          Math.hypot(sharedAfter.x - sharedBefore.x, sharedAfter.y - sharedBefore.y) < 0.1,
        { id: selected.id, before: sharedBefore, after: sharedAfter },
      )
      await page.locator("[data-global-map-close]").click()
      if (mode === "atlas") {
        const commutative = model.concepts.find((c) => c.title === "交换代数")
        if (!commutative)
          throw new Error("Reference image object 交换代数 is absent from the actual atlas")
        const referenceURL = new URL("atlas.html", base)
        referenceURL.hash = new URLSearchParams({ focus: commutative.id, depth: "2.1" })
        await page.goto(referenceURL.href, { waitUntil: "domcontentloaded" })
        await ready(page)
        await readReady(page, commutative.id)
        record.referenceReading = await captureReadingGeometry(page)
        check(
          `${name}: reference commutative-algebra title uses the large clean reader`,
          record.referenceReading.title?.trim() === commutative.title &&
            !record.referenceReading.backgroundCanvasVisible &&
            record.referenceReading.backgroundLabels.length === 0,
        )
        await shot(page, `${name}-commutative-algebra`)
      }
      if (mode === "notes" && mobile) {
        const formulaURL = new URL("topos.html", base)
        formulaURL.hash = new URLSearchParams({ focus: fixture.formula, depth: "2.1" })
        await page.goto(formulaURL.href, { waitUntil: "domcontentloaded" })
        await ready(page)
        await readReady(page, fixture.formula)
        const displays = activeReading(page).locator(".katex-display")
        let longFormula
        for (const display of await displays.all()) {
          if (await display.evaluate((e) => e.scrollWidth > e.clientWidth + 30)) {
            longFormula = display
            break
          }
        }
        if (!longFormula)
          throw new Error(
            "Actual long-formula fixture does not expose an overflowing local formula",
          )
        await longFormula.scrollIntoViewIfNeeded()
        await longFormula.focus()
        const before = await longFormula.evaluate((e) => ({
          left: e.scrollLeft,
          width: e.clientWidth,
          fullWidth: e.scrollWidth,
          start: e.querySelector(".katex-html")?.getBoundingClientRect().left,
          bounds: e.getBoundingClientRect().toJSON(),
        }))
        await page.keyboard.press("ArrowRight")
        await page.waitForTimeout(200)
        const after = await longFormula.evaluate((e) => e.scrollLeft)
        check(
          `${name}: actual long formula remains locally keyboard-scrollable with its left edge reachable`,
          after > before.left &&
            before.start >= before.bounds.left - 1 &&
            (await captureReadingGeometry(page)).horizontalOverflow <= 0,
          { before, after },
        )
        await shot(page, `${name}-long-formula`)
      }
      if (variation === "reduced") {
        const before = await snap(page)
        await page.waitForTimeout(1200)
        const after = await snap(page)
        check(
          `${name}: reduced-motion reading does not keep rendering`,
          after.frame === before.frame && after.settled,
        )
      }
      check(`${name}: no uncaught errors`, errors.length === 0, errors)
    } catch (error) {
      report.errors.push({
        name,
        error: error.stack,
        pageErrors: [...errors],
        snapshot: await snap(page).catch(() => null),
        active: await page
          .evaluate(() => document.activeElement?.outerHTML.slice(0, 900))
          .catch(() => null),
        events: await page.evaluate(() => window.__readingSpaceEvents ?? []).catch(() => []),
      })
      console.error(error.stack)
      await shot(page, `${name}-error`).catch(() => {})
    } finally {
      record.pageErrors = [...errors]
      await context.close()
      await writeFile(path.join(output, "progress.json"), JSON.stringify(report, null, 2))
    }
  }
} finally {
  await browser.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((c) => c.passed).length
  report.failed = report.checks.filter((c) => !c.passed).length + report.errors.length
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, output }))
  if (report.failed) process.exitCode = 1
}
