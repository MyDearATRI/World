import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const output = path.resolve(
  process.env.TOPIC_INTERACTION_OUTPUT ?? "artifacts/stable-field/topic-interactions",
)
await mkdir(output, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  screenshots: [],
  observations: {},
  notRun: [
    "Native browser 200% zoom: 720px is a viewport reflow check only.",
    "Physical phones, screen readers, Safari and Firefox.",
  ],
}
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const snapshot = (page) => page.evaluate(() => window.__topos.snapshot())
const ready = async (page) => {
  await page.waitForFunction(() => document.querySelector("#topos-world")?.dataset.ready === "true")
  await page.evaluate(() => document.fonts.ready)
}
const stable = (page) =>
  page.waitForFunction(() => window.__topos.settled, null, { timeout: 35000 })
const enterCurrentField = async (page) => {
  // Theme selection now opens a named overview. Exercise its real return control
  // before testing the spatial reader; do not interact with the hidden canvas.
  await page.locator("[data-overview-close]").click()
  await page.waitForFunction(() => !window.__topos.snapshot().overview)
  await stable(page)
}
const shot = async (page, name) => {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
const displacement = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const expected = (topics) =>
  model.concepts
    .filter((node) => node.topicIDs.some((id) => topics.includes(id)))
    .map((node) => node.id)
    .sort()
const preview = process.env.TOPIC_BASE ? undefined : await startPreview({ port: 0 })
const base = process.env.TOPIC_BASE ?? `${preview.url}/World/`
report.base = base
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
const cases = process.env.TOPIC_INTERACTION_CASES?.split(",")
const run = async (name, options, test) => {
  if (cases && !cases.includes(name)) return
  const context = await browser.newContext(options)
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (error) => errors.push(error.message))
  try {
    await test(page, context)
    check(`${name}: no uncaught runtime error`, errors.length === 0, errors)
  } catch (error) {
    report.errors.push({ case: name, error: error.stack })
    console.error(`${name}: ${error.stack}`)
    await shot(page, `${name}-error`).catch(() => {})
  } finally {
    await context.close()
    await writeFile(path.join(output, "progress.json"), JSON.stringify(report, null, 2))
  }
}

try {
  await run(
    "desktop",
    { viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference" },
    async (page) => {
      let documents = 0
      page.on("request", (request) => {
        if (request.resourceType() === "document") documents++
      })
      await page.goto(new URL("topos.html", base).href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await page.getByRole("button", { name: "清空", exact: true }).click()
      await page.locator('[data-topic="topology"]').check()
      await stable(page)
      await enterCurrentField(page)
      const bounds = await page.locator("#topos-world").boundingBox()
      check("desktop: real scene is offset by sidebar", bounds.x > 200, bounds)
      check("desktop: actual WebGL2 renderer", (await snapshot(page)).renderer === "webgl2")
      await page.evaluate(() => {
        window.__topicTestIdentity = {
          canvas: document.querySelector("#topos-canvas"),
          world: document.querySelector("#topos-world"),
        }
      })
      let before = await snapshot(page)
      let target = before.nodes.find((node) => node.id === before.focus)
      await page.mouse.move(target.screenX, target.screenY)
      await stable(page)
      before = await snapshot(page)
      target = before.nodes.find((node) => node.id === before.focus)
      const hit = await page.evaluate(
        ({ x, y }) => {
          const el = document.elementFromPoint(x, y)
          return {
            tag: el?.tagName,
            id: el?.id,
            concept: el?.closest("[data-concept]")?.dataset.concept,
          }
        },
        { x: target.screenX, y: target.screenY },
      )
      check(
        "desktop: drag starts at visible real node, not sidebar",
        hit.id === "topos-canvas" || hit.concept === target.id,
        hit,
      )
      const relationNeighbors = new Set(
        before.relations.flatMap((r) =>
          r.source === target.id ? [r.target] : r.target === target.id ? [r.source] : [],
        ),
      )
      await page.mouse.down()
      for (let i = 1; i <= 14; i++) {
        await page.mouse.move(target.screenX + i * 9, target.screenY + i * 3)
        await page.waitForTimeout(30)
      }
      const held = await snapshot(page)
      const moved = held.nodes.find((node) => node.id === target.id)
      const neighborMotion = held.nodes
        .filter((node) => relationNeighbors.has(node.id))
        .map((node) => ({
          id: node.id,
          distance: displacement(
            node,
            before.nodes.find((old) => old.id === node.id),
          ),
        }))
      check(
        "desktop: sidebar-adjusted pointer changes node world position",
        displacement(target, moved) > 30,
        { id: target.id, distance: displacement(target, moved) },
      )
      check(
        "desktop: directly linked neighbors respond in world coordinates",
        neighborMotion.some((node) => node.distance > 0.5),
        neighborMotion,
      )
      await page.mouse.up()
      const released = await snapshot(page)
      check(
        "desktop: drag is not focus activation or zoom",
        released.focus === before.focus &&
          released.scale === before.scale &&
          released.stats.focusChanges === before.stats.focusChanges,
        { before: before.stats, after: released.stats, scale: released.scale },
      )
      check(
        "desktop: dragging preserves canvas, scene and document",
        documents === 1 &&
          (await page.evaluate(
            () =>
              window.__topicTestIdentity.canvas === document.querySelector("#topos-canvas") &&
              window.__topicTestIdentity.world === document.querySelector("#topos-world"),
          )),
        { documents },
      )
      await stable(page)
      const cooled = await snapshot(page)
      await page.waitForTimeout(600)
      const quiet = await snapshot(page)
      check(
        "desktop: cooled field stops requesting frames",
        quiet.frame === cooled.frame && quiet.settled,
        { before: cooled.frame, after: quiet.frame },
      )
      await shot(page, "1440-drag-cooled")
      const baseline = await snapshot(page)
      await page.locator('[data-topic="foundations"]').check()
      await stable(page)
      await page.goBack()
      await stable(page)
      const restored = await snapshot(page)
      const maxDelta = Math.max(
        ...restored.nodes.map((node) =>
          displacement(
            node,
            baseline.nodes.find((old) => old.id === node.id),
          ),
        ),
      )
      check(
        "desktop: Back restores exact topic selection",
        JSON.stringify(restored.topics) === JSON.stringify(baseline.topics),
        { before: baseline.topics, after: restored.topics },
      )
      check("desktop: Back restores stable node positions", maxDelta < 1, {
        maxWorldDelta: maxDelta,
      })
      check(
        "desktop: topic filtering retains all persistent identities",
        JSON.stringify(restored.nodes.map((n) => n.id).sort()) ===
          JSON.stringify(baseline.nodes.map((n) => n.id).sort()),
      )
      report.observations.desktop = { before, held, cooled, restored }
      await shot(page, "1440-back-restored")
    },
  )

  await run(
    "atlas",
    { viewport: { width: 1024, height: 900 }, reducedMotion: "reduce" },
    async (page, context) => {
      await page.goto(new URL("atlas.html", base).href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await page.locator('[data-topic="math.region.analysis-pde"]').check()
      await page.locator(".topos-topic-directory summary").click()
      const link = page.locator('[data-topic-node="math.msc.35"]')
      const href = await link.getAttribute("href")
      check(
        "atlas: classification href carries a real non-foundation focus",
        href.includes("focus=math.msc.35") && !href.includes("topics="),
        href,
      )
      // A native Ctrl-click tab need not expose an opener in Edge.
      const popupPromise = context.waitForEvent("page")
      await link.click({ modifiers: ["Control"] })
      const popup = await popupPromise
      await popup.bringToFront()
      await ready(popup)
      await stable(popup)
      let state = await snapshot(popup)
      check(
        "atlas: native Ctrl-click opens the requested visible object",
        state.focus === "math.msc.35" &&
          state.visibleIDs.includes("math.msc.35") &&
          state.topics.includes("math.region.analysis-pde"),
        { focus: state.focus, topics: state.topics },
      )
      await popup.waitForFunction(() =>
        document.querySelector('.topos-unfolding[data-active="true"] .topos-prose'),
      )
      check(
        "atlas: native new tab has readable provenance",
        (await popup.locator('.topos-unfolding[data-active="true"]').innerText()).includes(
          "未执行 Lean",
        ),
      )
      await popup.reload({ waitUntil: "domcontentloaded" })
      await ready(popup)
      await stable(popup)
      state = await snapshot(popup)
      check(
        "atlas: refresh preserves non-foundation membership",
        state.focus === "math.msc.35" &&
          state.visibleIDs.includes(state.focus) &&
          state.topics.includes("math.region.analysis-pde"),
      )
      await shot(popup, "1024-atlas-native-tab-refresh")
      await popup.close()
      const direct = await context.newPage()
      await direct.goto(new URL(href, base).href, { waitUntil: "domcontentloaded" })
      await ready(direct)
      await stable(direct)
      const directState = await snapshot(direct)
      check(
        "atlas: fresh direct URL derives focus membership",
        directState.focus === "math.msc.35" &&
          directState.visibleIDs.includes("math.msc.35") &&
          directState.topics.includes("math.region.analysis-pde"),
        { focus: directState.focus, topics: directState.topics },
      )
      await shot(direct, "1024-atlas-direct-url")
      await direct.close()
    },
  )

  await run(
    "fallback",
    { viewport: { width: 1024, height: 900 }, reducedMotion: "reduce" },
    async (page) => {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
          if (kind === "webgl2" || kind === "webgl" || kind === "experimental-webgl") return null
          return original.call(this, kind, ...args)
        }
      })
      await page.goto(new URL("topos.html", base).href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await stable(page)
      check(
        "fallback: WebGL failure uses real Canvas2D renderer",
        (await snapshot(page)).renderer === "canvas2d",
      )
      await page.getByRole("button", { name: "清空", exact: true }).click()
      await page.locator('[data-topic="topology"]').check()
      await stable(page)
      check(
        "fallback: checkboxes still filter exact public union",
        JSON.stringify((await snapshot(page)).visibleIDs.sort()) ===
          JSON.stringify(expected(["topology"])),
      )
      await enterCurrentField(page)
      const pixels = await page.locator(".topos-flat-canvas").evaluate((canvas) => {
        const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
        let distinct = 0
        for (let i = 0; i < data.length; i += 100) if (data[i] < 220 && data[i + 3] > 0) distinct++
        return { nonBackgroundSamples: distinct, width: canvas.width, height: canvas.height }
      })
      check(
        "fallback: actual fallback canvas paints non-background content",
        pixels.nonBackgroundSamples > 5,
        pixels,
      )
      await shot(page, "1024-canvas2d-filter")
    },
  )

  await run(
    "mobile",
    {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      reducedMotion: "reduce",
    },
    async (page) => {
      await page.goto(new URL("topos.html#focus=a-000067&depth=2.1", base).href, {
        waitUntil: "domcontentloaded",
      })
      await ready(page)
      await page.waitForFunction(() =>
        document.querySelector('.topos-unfolding[data-active="true"] math'),
      )
      await stable(page)
      const before = await snapshot(page)
      await page.getByRole("button", { name: "主题", exact: true }).tap()
      const drawer = page.locator(".topos-topic-sidebar")
      check(
        "mobile: touch opens a genuine modal drawer",
        await drawer.evaluate((e) => e.open && e.matches(":modal")),
      )
      const focusTrail = []
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press(i < 15 ? "Tab" : "Shift+Tab")
        focusTrail.push(
          await page.evaluate(() => ({
            inside: Boolean(document.activeElement?.closest(".topos-topic-sidebar")),
            browserChrome: document.activeElement === document.body,
            tag: document.activeElement?.tagName,
            text: document.activeElement?.textContent?.slice(0, 60),
          })),
        )
      }
      check(
        "mobile: forward and reverse Tab never focus background controls",
        focusTrail.every((entry) => entry.inside || entry.browserChrome),
        focusTrail,
      )
      await page.locator("[data-close-topics]").focus()
      await page.keyboard.press("Control+k")
      check(
        "mobile: drawer shortcut does not open a second search modal",
        !(await page.locator(".topos-search").evaluate((e) => e.open)),
      )
      await page.locator("[data-close-topics]").focus()
      await page.keyboard.press("+")
      check(
        "mobile: drawer keyboard input leaves background depth unchanged",
        (await snapshot(page)).scale === before.scale,
      )
      await page.keyboard.press("Escape")
      check(
        "mobile: Escape closes drawer and restores trigger focus",
        !(await drawer.evaluate((e) => e.open)) &&
          (await page
            .locator(".topos-topics-trigger")
            .evaluate((e) => e === document.activeElement)),
      )
      const afterEscape = await snapshot(page)
      check(
        "mobile: drawer Escape leaves underlying reading depth unchanged",
        before.focus === afterEscape.focus && before.scale === afterEscape.scale,
        {
          before: { focus: before.focus, scale: before.scale },
          after: { focus: afterEscape.focus, scale: afterEscape.scale },
        },
      )
      await page.getByRole("button", { name: "主题", exact: true }).tap()
      await page.getByRole("button", { name: "清空", exact: true }).tap()
      await page.locator('[data-topic="topology"]').tap()
      check(
        "mobile: real touch selects expected topic objects",
        JSON.stringify((await snapshot(page)).visibleIDs.sort()) ===
          JSON.stringify(expected(["topology"])),
      )
      await shot(page, "390-touch-modal-drawer")
      await page.locator("[data-close-topics]").tap()
      await stable(page)
      check(
        "mobile: closing drawer preserves selection and focus",
        (await snapshot(page)).topics.includes("topology") &&
          (await page
            .locator(".topos-topics-trigger")
            .evaluate((e) => e === document.activeElement)),
      )
      await shot(page, "390-touch-selected-topic-overview")
      await page.locator("[data-overview-query]").fill("度量与度量拓扑")
      await page.locator('[data-overview-open="a-000067"]').tap()
      await page.waitForFunction(() =>
        document.querySelector('.topos-unfolding[data-active="true"] math'),
      )
      await stable(page)
      await shot(page, "390-touch-return-reading")
    },
  )

  await run(
    "reflow",
    { viewport: { width: 720, height: 900 }, reducedMotion: "reduce" },
    async (page) => {
      await page.goto(new URL("topos.html#focus=a-000067&depth=2.1", base).href, {
        waitUntil: "domcontentloaded",
      })
      await ready(page)
      await page.waitForFunction(() =>
        document.querySelector('.topos-unfolding[data-active="true"] math'),
      )
      await stable(page)
      const layout = await page.evaluate(() => {
        const world = document.querySelector("#topos-world").getBoundingClientRect()
        const reading = document
          .querySelector('.topos-unfolding[data-active="true"]')
          .getBoundingClientRect()
        return {
          viewport: innerWidth,
          page: document.documentElement.scrollWidth,
          world: { left: world.left, right: world.right },
          reading: { left: reading.left, right: reading.right },
        }
      })
      check(
        "720px reflow: scene and reading stay inside narrow viewport",
        layout.page <= 720 &&
          layout.world.left === 0 &&
          layout.world.right <= 721 &&
          layout.reading.left >= 0 &&
          layout.reading.right <= 721,
        layout,
      )
      check(
        "720px reflow: theme access changes to collapsible trigger",
        (await page.locator(".topos-topics-trigger").isVisible()) &&
          !(await page.locator(".topos-topic-sidebar").evaluate((e) => e.open)),
      )
      await page.locator(".topos-topics-trigger").click()
      check(
        "720px reflow: keyboard-accessible modal theme selection",
        await page.locator(".topos-topic-sidebar").evaluate((e) => e.matches(":modal")),
      )
      await page.locator("[data-close-topics]").click()
      await shot(page, "720-width-reflow-not-native-zoom")
    },
  )
} finally {
  await browser.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((entry) => entry.passed).length
  report.failed = report.checks.filter((entry) => !entry.passed).length + report.errors.length
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  await writeFile(
    path.join(output, `report-${report.startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, output }))
  if (report.failed) process.exitCode = 1
}
