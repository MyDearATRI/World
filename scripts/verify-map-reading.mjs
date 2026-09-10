import { chromium } from "playwright"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.MAP_READING_OUTPUT ?? "artifacts/wo-005/reading")
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const focus = model.concepts.find((c) => c.title === "度量拓扑与连续性的三种刻画")
if (!focus) throw new Error("The approved reading fixture is missing")
const report = {
  checks: [],
  screenshots: [],
  errors: [],
  limits: [
    "Headless Edge; simulated touch and enlarged text, not a physical phone or native browser zoom.",
    "2D relation tasks check recorded directions and evidence; distance is not a mathematical statement.",
  ],
}
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const selector = (attribute, value) => `[${attribute}=${JSON.stringify(value)}]`
const active = (page) => page.locator('.topos-unfolding[data-active="true"]')
const snap = (page) => page.evaluate(() => window.__topos.snapshot())
const mapReady = (page) =>
  page.waitForFunction(
    () => window.__topos?.snapshot().globalMap?.open && window.__topos.snapshot().globalMap.settled,
  )
const readReady = (page, id) =>
  page.waitForFunction(
    (id) =>
      window.__topos?.state.focus === id &&
      document.body.dataset.reader === "true" &&
      document.querySelector('.topos-unfolding[data-active="true"] .topos-prose'),
    id,
  )
const closeNumber = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const sameCamera = (a, b) => ["x", "y", "k"].every((key) => closeNumber(a[key], b[key], 0.01))
await mkdir(output, { recursive: true })
const preview = process.env.MAP_READING_BASE ? undefined : await startPreview({ port: 0 })
const base = process.env.MAP_READING_BASE ?? `${preview.url}/World/`
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
report.browser = browser.version()
async function shot(page, name) {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
try {
  for (const [width, reduced] of [
    [1440, false],
    [1024, false],
    [390, false],
    [390, true],
  ]) {
    if (process.env.MAP_READING_WIDTH && String(width) !== process.env.MAP_READING_WIDTH) continue
    const name = `${width}${reduced ? "-reduced" : ""}`
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : width === 1024 ? 900 : 844 },
      reducedMotion: reduced ? "reduce" : "no-preference",
      hasTouch: width === 390,
      isMobile: width === 390,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    page.on("pageerror", (error) => report.errors.push({ name, error: String(error) }))
    try {
      await page.goto(base + "topos.html")
      await mapReady(page)
      await page.evaluate(() => document.fonts.ready)
      check(
        `${name}: entry uses a continuous map`,
        (await snap(page)).globalMap.nodeIDs.length === model.concepts.length &&
          !(await snap(page)).overview,
      )
      await shot(page, `${name}-entry`)
      await page.keyboard.press("Control+k")
      await page.locator("[data-topos-search-input]").fill(focus.title)
      await page.locator(selector("data-search-concept", focus.id)).click()
      await readReady(page, focus.id)
      check(
        `${name}: search reaches original mathematics`,
        (await active(page).locator("math").count()) > 0 &&
          (await active(page).innerText()).includes("Simon"),
      )
      await active(page).evaluate((node) => {
        node.scrollTo({ top: 690, behavior: "instant" })
      })
      await page.waitForTimeout(180)
      const readingTop = await active(page).evaluate((node) => node.scrollTop)
      await active(page).locator("[data-fold]").click()
      await mapReady(page)
      const collapsed = await snap(page)
      check(
        `${name}: collapse keeps current object on map`,
        collapsed.globalMap.selected === focus.id && !collapsed.reader,
      )
      check(
        `${name}: collapse returns keyboard focus`,
        await page.evaluate(() => Boolean(document.activeElement?.closest(".global-map"))),
      )
      await page.goBack()
      await readReady(page, focus.id)
      await page.waitForTimeout(180)
      check(
        `${name}: Back from collapse reveals the original passage`,
        (await active(page).isVisible()) &&
          closeNumber(readingTop, await active(page).evaluate((node) => node.scrollTop), 2),
      )
      await page.goForward()
      await mapReady(page)
      check(
        `${name}: Forward restores the collapsed map`,
        sameCamera(collapsed.globalMap.camera, (await snap(page)).globalMap.camera) &&
          (await snap(page)).globalMap.selected === focus.id,
      )
      await page.locator("[data-global-map-neighborhood]").click()
      await mapReady(page)
      const connections = model.relations.filter(
        (edge) => edge.source === focus.id || edge.target === focus.id,
      )
      for (const edge of connections) {
        const row = page.locator(selector("data-global-map-relation", edge.id))
        const text = await row.innerText()
        check(
          `${name}: direction and provenance ${edge.id}`,
          text.includes(edge.source === focus.id ? "→" : "←") &&
            text.includes(
              edge.provenance === "reference"
                ? "正文引用"
                : edge.provenance === "structure"
                  ? "结构关联"
                  : "原文关系",
            ),
        )
        if (edge.evidenceHref)
          check(
            `${name}: traceable source ${edge.id}`,
            await row
              .locator("a")
              .evaluateAll(
                (links, href) =>
                  links.some(
                    (a) => new URL(a.href).pathname === new URL(href, location.href).pathname,
                  ),
                edge.evidenceHref,
              ),
          )
      }
      await shot(page, `${name}-context`)
      if (width === 390) {
        await page.locator("[data-global-map-connections]").click()
        check(
          `${name}: explicit mobile relation reading`,
          await page
            .locator(".global-map")
            .evaluate((node) => node.classList.contains("global-map--connections")),
        )
        await shot(page, `${name}-relations`)
        await page.keyboard.press("Escape")
        check(
          `${name}: Escape returns from relations to map`,
          (await page.locator("[data-global-map-stage]").isVisible()) &&
            (await snap(page)).globalMap.open,
        )
      }
      const mapBefore = (await snap(page)).globalMap
      await page.locator(`.global-map-read${selector("data-global-map-read", focus.id)}`).click()
      await readReady(page, focus.id)
      await page.waitForTimeout(250)
      check(
        `${name}: original passage restored`,
        closeNumber(readingTop, await active(page).evaluate((node) => node.scrollTop), 2),
        { expected: readingTop, actual: await active(page).evaluate((node) => node.scrollTop) },
      )
      await shot(page, `${name}-reading`)
      await page.goBack()
      await mapReady(page)
      check(
        `${name}: Back restores map camera`,
        sameCamera(mapBefore.camera, (await snap(page)).globalMap.camera),
      )
      await page.reload()
      await mapReady(page)
      check(
        `${name}: refresh preserves object and camera`,
        (await snap(page)).globalMap.selected === focus.id &&
          sameCamera(mapBefore.camera, (await snap(page)).globalMap.camera),
      )
      await page.locator("[data-open-global-map]").click()
      await page.locator('[data-global-map-zoom="in"]').click()
      const immediateView = (await snap(page)).globalMap.camera
      await page.goBack()
      await mapReady(page)
      await page.goForward()
      await mapReady(page)
      check(
        `${name}: immediate Back and Forward retain last camera`,
        sameCamera(immediateView, (await snap(page)).globalMap.camera),
      )

      // Follow an actual outgoing structural occurrence into its formal source.
      const structural = model.relations.find((edge) => edge.provenance === "structure")
      await page.locator("[data-global-map-locate]").selectOption(structural.source)
      const structuralRow = page.locator(selector("data-global-map-relation", structural.id))
      check(
        `${name}: structural membership is not presented as proof`,
        (await structuralRow.innerText()).includes("结构关联"),
      )
      await structuralRow.locator(selector("data-global-map-read", structural.target)).click()
      await readReady(page, structural.target)
      check(
        `${name}: relation opens the recorded destination`,
        (await snap(page)).focus === structural.target,
      )
      await page.goBack()
      await mapReady(page)
      const link = page.locator(
        `.global-map-read${selector("data-global-map-read", structural.source)}`,
      )
      const href = await link.getAttribute("href")
      const popupPromise = context.waitForEvent("page")
      await link.click({ modifiers: ["Control"] })
      const popup = await popupPromise
      await popup.waitForLoadState("domcontentloaded")
      check(
        `${name}: native new tab retains static URL`,
        popup.url().split("#")[0] === href.split("#")[0] && !(await popup.title()).includes("404"),
      )
      await popup.close()

      // Restrict to a real theme and disclose edges whose other endpoint is outside it.
      if (width < 761) await page.locator(".topos-topics-trigger").click()
      const theme = focus.topicIDs[0]
      await page.locator(".topos-topic-commands button").filter({ hasText: "清空" }).click()
      await page.locator(selector("data-topic", theme)).check()
      if (width < 761) await page.locator("[data-close-topics]").click()
      await mapReady(page)
      const eligible = new Set(
        model.concepts.filter((c) => c.topicIDs?.includes(theme)).map((c) => c.id),
      )
      const outsideEdge = model.relations.find(
        (e) => eligible.has(e.source) !== eligible.has(e.target),
      )
      if (outsideEdge) {
        const inside = eligible.has(outsideEdge.source) ? outsideEdge.source : outsideEdge.target
        const outside = inside === outsideEdge.source ? outsideEdge.target : outsideEdge.source
        await page.locator("[data-global-map-locate]").selectOption(inside)
        const row = page.locator(selector("data-global-map-relation", outsideEdge.id))
        check(
          `${name}: out-of-scope relation remains discoverable`,
          (await row.getAttribute("data-map-relation-scope")) === "outside",
        )
        const before = (await snap(page)).globalMap
        await row.locator(selector("data-global-map-expand", outside)).click()
        await mapReady(page)
        const after = (await snap(page)).globalMap
        check(
          `${name}: expansion keeps old identity and adds actual destination`,
          before.nodeIDs.every((id) => after.nodeIDs.includes(id)) &&
            after.nodeIDs.includes(outside) &&
            new Set(after.nodeIDs).size === after.nodeIDs.length,
        )
      }
      check(
        `${name}: no document overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      )
      await shot(page, `${name}-expanded`)
    } catch (error) {
      report.errors.push({ name, error: error.stack, state: await snap(page).catch(() => null) })
      await shot(page, `${name}-failure`).catch(() => {})
    }
    await context.close()
  }
  const atlas = JSON.parse(await readFile("public/static/topos/atlas.json", "utf8")).model
  for (const width of [1440, 1024, 390]) {
    if (process.env.MAP_READING_WIDTH && String(width) !== process.env.MAP_READING_WIDTH) continue
    const context = await browser.newContext({
      viewport: { width, height: width === 1440 ? 1000 : width === 1024 ? 900 : 844 },
    })
    const page = await context.newPage()
    const name = `atlas-${width}`
    try {
      await page.goto(base + "atlas.html")
      await mapReady(page)
      if (width < 761) await page.locator(".topos-topics-trigger").click()
      await page.locator(".topos-topic-commands button").filter({ hasText: "全选" }).click()
      if (width < 761) await page.locator("[data-close-topics]").click()
      await mapReady(page)
      check(
        `${name}: all twelve themes retain unique real objects`,
        (await snap(page)).globalMap.nodeIDs.length === atlas.concepts.length &&
          new Set((await snap(page)).globalMap.nodeIDs).size === atlas.concepts.length,
      )
      const group = page.locator("[data-global-map-group]").first()
      await group.focus()
      await page.keyboard.press("Enter")
      await mapReady(page)
      check(
        `${name}: a named group is keyboard navigable`,
        await page.locator("[data-global-map]").isVisible(),
      )
      check(
        `${name}: focused group fits with its title`,
        await group.evaluate((node) => {
          const group = node.getBoundingClientRect(),
            stage = node.closest(".global-map-stage").getBoundingClientRect()
          return (
            group.left >= stage.left - 1 &&
            group.right <= stage.right + 1 &&
            group.top >= stage.top - 1 &&
            group.bottom <= stage.bottom + 1
          )
        }),
      )
      await shot(page, name)
      const node = atlas.concepts.find((c) => !c.id.startsWith("math.region.") && c.sections.length)
      if (node) {
        await page.locator("[data-global-map-locate]").selectOption(node.id)
        await page.locator(`.global-map-read${selector("data-global-map-read", node.id)}`).click()
        await readReady(page, node.id)
        check(
          `${name}: title source stays explicit`,
          (await active(page).innerText()).includes("来源"),
        )
      }
    } catch (error) {
      report.errors.push({ name, error: error.stack })
    }
    await context.close()
  }
  const fallback = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  await fallback.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null
      return original.call(this, type, ...args)
    }
  })
  const page = await fallback.newPage()
  try {
    await page.goto(base + "topos.html#focus=a-000010&depth=2.1")
    await readReady(page, "a-000010")
    check(
      "fallback: full formula source remains readable",
      (await active(page).locator("math").count()) > 0,
    )
    await active(page)
      .locator(".topos-prose")
      .evaluateAll((nodes) => nodes.forEach((n) => (n.style.fontSize = "34px")))
    check(
      "enlarged text: formulas scroll locally",
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          [
            ...document.querySelectorAll('.topos-unfolding[data-active="true"] .katex-display'),
          ].every(
            (n) => getComputedStyle(n).overflowX === "auto" || n.scrollWidth <= n.clientWidth + 1,
          ),
      ),
    )
    const displayedFormula = active(page).locator(".katex-display").first()
    if (await displayedFormula.count()) await displayedFormula.scrollIntoViewIfNeeded()
    await shot(page, "390-enlarged-formula")
    await page.locator("[data-open-global-map]").click()
    await mapReady(page)
    check(
      "fallback: no WebGL still has full functional SVG map",
      (await snap(page)).globalMap.backend === "svg" &&
        (await snap(page)).globalMap.nodeIDs.length === model.concepts.length,
    )
    await shot(page, "390-no-webgl-map")
  } catch (error) {
    report.errors.push({ name: "fallback", error: error.stack })
  }
  await fallback.close()
} finally {
  await browser.close()
  await preview?.close()
  report.passed = report.checks.filter((c) => c.passed).length
  report.failed = report.checks.filter((c) => !c.passed).length + report.errors.length
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify({ passed: report.passed, failed: report.failed, errors: report.errors }),
  )
  if (report.failed) process.exitCode = 1
}
