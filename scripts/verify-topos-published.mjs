import { access, mkdir, writeFile, readFile, copyFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(root, ".cache/topos-browser")
const { chromium } = await import("playwright")
const output = path.join(root, "artifacts", process.env.TOPOS_PUBLISHED_OUTPUT ?? "topos-published")
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  screenshots: [],
  videos: [],
  notRun: ["实体手机、Safari、Firefox与性能测量未运行。", "视频存在不自动构成人工视觉通过。"],
}
let browser, preview
function check(name, condition, evidence) {
  report.checks.push({ name, passed: Boolean(condition), evidence })
  console.log(`${condition ? "PASS" : "FAIL"} ${name}`)
}
const snap = (page) => page.evaluate(() => window.__topos.snapshot())
async function ready(page) {
  await page.waitForFunction(
    () => document.querySelector("#topos-world")?.dataset.ready === "true",
    { timeout: 30000 },
  )
  await page.evaluate(() => document.fonts.ready)
}
async function settled(page) {
  await page.waitForFunction(() => window.__topos?.settled === true, { timeout: 25000 })
}
async function readingReady(page) {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('.topos-unfolding[data-active="true"]')
      return (
        root?.querySelector(".topos-section .topos-prose") &&
        !root.querySelector("[data-section-loading]")
      )
    },
    { timeout: 30000 },
  )
}
async function stableScroll(reading) {
  let previous = -1,
    stable = 0
  const started = Date.now()
  while (Date.now() - started < 6000) {
    await reading.page().waitForTimeout(120)
    const value = await reading.evaluate((node) => node.scrollTop)
    stable = Math.abs(value - previous) < 0.5 ? stable + 1 : 0
    if (stable >= 3) return value
    previous = value
  }
  throw new Error("Reading scroll did not stop before its history position was measured")
}
async function shot(page, name) {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
async function search(page, query) {
  if (!(await page.locator(".topos-search").evaluate((node) => node.open)))
    await page.keyboard.press("Control+k")
  await page.locator("[data-topos-search-input]").fill(query)
  await page.waitForTimeout(80)
}
async function searchFocus(page, concept) {
  await search(page, concept.title)
  await page.locator(`[data-search-concept="${concept.id.replaceAll('"', '\\"')}"]`).click()
  await page.waitForFunction((id) => window.__topos.state.focus === id, concept.id)
  await readingReady(page)
}
async function mainScenario(base, model, viewport) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width === 390,
    hasTouch: viewport.width === 390,
    recordVideo:
      viewport.width === 1440 ? { dir: path.join(output, "raw-video"), size: viewport } : undefined,
  })
  const page = await context.newPage(),
    documents = [],
    sectionRequests = [],
    failures = []
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url())
    if (request.url().includes("/static/topos/sections/")) sectionRequests.push(request.url())
  })
  page.on("pageerror", (error) => failures.push(error.message))
  const prefix = `${viewport.width}`
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await settled(page)
    const initial = await snap(page)
    check(
      `${prefix} initial field does not download all original sections`,
      sectionRequests.length === 0,
      { sectionRequests: [...sectionRequests] },
    )
    const metric = model.concepts.find((c) => c.id === "a-000067"),
      continuity = model.concepts.find((c) => c.id === "a-000070"),
      proof = model.concepts.find((c) => c.id === "a-000095"),
      note = model.concepts.find(
        (c) => c.id === "note:笔记主体/书籍/Simon实分析/第一章/知识/度量拓扑与连续性的三种刻画",
      )
    if (![metric, continuity, proof, note].every(Boolean))
      throw new Error("Verified published mathematics route absent from actual data")
    check(
      `${prefix} published identities and counts come from actual model`,
      initial.mode === "published" &&
        initial.objectCount === model.concepts.length &&
        initial.nodes.length === model.concepts.length &&
        model.concepts.every((c) => !["group", "action", "representation"].includes(c.id)),
      { stats: model.stats, count: initial.objectCount },
    )
    check(
      `${prefix} actual renderer and model-adapted relation lenses`,
      ["webgl2", "canvas2d"].includes(initial.renderer) &&
        (await page.locator(".topos-lenses").innerText()).includes("正文引用") &&
        !(await page.locator(".topos-lenses").innerText()).includes("群作用"),
      { renderer: initial.renderer },
    )
    await page.evaluate(() => {
      window.__publishedIdentity = {
        world: document.querySelector("#topos-world"),
        canvas: document.querySelector("#topos-canvas"),
        nodes: new Map(window.__topos.nodes.map((n) => [n.id, n])),
      }
    })
    await shot(page, `${prefix}-published-field`)
    await search(page, "度量")
    check(
      `${prefix} Chinese search locates metric object`,
      (await page.locator('[data-search-concept="a-000067"]').count()) === 1,
    )
    await search(page, "continuity")
    const englishSource = model.concepts.find(
      (concept) =>
        concept.title === "Open Sets, Closure, and Continuity" && concept.objectKind === "note",
    )
    check(
      `${prefix} English search locates continuity source`,
      Boolean(englishSource) &&
        (await page.locator(`[data-search-concept="${englishSource.id}"]`).count()) === 1,
    )
    await shot(page, `${prefix}-search`)
    if (model.concepts.some((concept) => concept.searchText?.includes("\\forall"))) {
      await search(page, "\\forall")
      check(
        `${prefix} original LaTeX symbols can be searched locally`,
        (await page.locator(".topos-search-result").count()) > 0,
      )
    }
    const aliasObject = model.concepts.find((c) =>
      c.aliases?.some((a) => a.trim() && a !== c.title),
    )
    if (aliasObject) {
      const alias = aliasObject.aliases.find((a) => a.trim() && a !== aliasObject.title)
      await search(page, alias)
      check(
        `${prefix} real source alias can be found`,
        (await page
          .locator(`[data-search-concept="${aliasObject.id.replaceAll('"', '\\"')}"]`)
          .count()) === 1,
        { alias, id: aliasObject.id },
      )
    }
    await search(page, "zzNoMathematicalResult913799")
    check(
      `${prefix} no-result state explains next input`,
      (await page.locator(".topos-search-result").count()) === 0 &&
        (await page.locator(".topos-empty").innerText()).includes("没有匹配"),
    )
    await searchFocus(page, metric)
    await settled(page)
    check(
      `${prefix} metric full original mathematics and status visible`,
      (await page.locator('.topos-unfolding[data-owner="a-000067"] math').count()) > 0 &&
        (
          await page
            .locator('.topos-unfolding[data-owner="a-000067"] .topos-source-meta')
            .innerText()
        ).includes(metric.sourceTitle),
      { proofStatus: metric.proofStatus },
    )
    const before = await snap(page)
    await searchFocus(page, continuity)
    await page.waitForTimeout(200)
    const during = await snap(page)
    await settled(page)
    const after = await snap(page)
    const movement = before.nodes.filter((a) => {
      const b = after.nodes.find((n) => n.id === a.id)
      return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 2
    }).length
    check(
      `${prefix} mathematical context changes world coordinates without replacing scene`,
      after.focus === continuity.id &&
        movement > 2 &&
        (await page.evaluate(
          () =>
            window.__publishedIdentity.world === document.querySelector("#topos-world") &&
            window.__publishedIdentity.canvas === document.querySelector("#topos-canvas") &&
            window.__topos.nodes.every((n) => window.__publishedIdentity.nodes.get(n.id) === n),
        )) &&
        documents.length === 1,
      {
        movement,
        intermediateMoving: during.nodes.filter((n) => Math.hypot(n.vx, n.vy, n.vz) > 0.01).length,
        documents,
      },
    )
    check(
      `${prefix} original proof-state metadata is preserved`,
      !continuity.proofStatus ||
        (await page
          .locator('.topos-unfolding[data-owner="a-000070"] [data-proof-status]')
          .innerText()) === continuity.proofStatus,
    )
    const titleEvidence = await page.evaluate(() => {
      const focus = document
        .querySelector('.topos-concept[data-focus="true"]')
        .getBoundingClientRect()
      const overlap = [...document.querySelectorAll('.topos-concept:not([data-focus="true"])')]
        .filter((node) => Number(node.style.opacity) > 0.3)
        .map((node) => ({ id: node.dataset.concept, box: node.getBoundingClientRect() }))
        .filter(
          ({ box }) =>
            box.x < focus.right &&
            box.right > focus.x &&
            box.y < focus.bottom &&
            box.bottom > focus.y,
        )
        .map(({ id }) => id)
      return {
        focus: focus.toJSON(),
        overlap,
        rawSummary: document.querySelectorAll(
          '.topos-unfolding[data-active="true"] .topos-explanation-lead',
        ).length,
      }
    })
    check(
      `${prefix} stable focus title is clear and published body has no duplicated raw summary`,
      titleEvidence.overlap.length === 0 && titleEvidence.rawSummary === 0,
      titleEvidence,
    )
    await shot(page, `${prefix}-continuity`)
    const source = page.locator('.topos-unfolding[data-owner="a-000070"] .topos-original-source')
    const sourceAnchor = decodeURIComponent((await source.getAttribute("data-source-anchor")) ?? "")
    await source.click()
    await readingReady(page)
    await settled(page)
    check(
      `${prefix} complete note opens in same field`,
      (await snap(page)).focus === note.id && documents.length === 1,
    )
    await page.waitForTimeout(500)
    check(
      `${prefix} cold original-source link locates its actual source anchor after loading`,
      Boolean(sourceAnchor) &&
        (await page.evaluate(
          (id) => document.activeElement?.getAttribute("data-source-id") === id,
          sourceAnchor,
        )),
      { sourceAnchor },
    )
    const reading = page.locator(".topos-unfolding[data-active='true']")
    check(
      `${prefix} long note has usable local contents and full math`,
      (await reading.locator(".topos-reading-toc").count()) === 1 &&
        (await reading.locator("math").count()) > 5,
    )
    if (!(await reading.locator(".topos-reading-toc").count()))
      throw new Error(
        "A long source note has no reading contents; following directory actions were not run",
      )
    const localAnchors = await reading.locator("a[data-local-anchor]").evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        target: link.dataset.localAnchor,
        exists: Boolean(document.getElementById(link.dataset.localAnchor)),
      })),
    )
    check(
      `${prefix} relocated original heading anchors resolve after runtime namespacing`,
      localAnchors.length > 0 &&
        localAnchors.every(
          (link) => link.exists && decodeURIComponent(link.href.slice(1)) === link.target,
        ),
      { count: localAnchors.length },
    )
    if (localAnchors.length) {
      const addressBefore = page.url(),
        firstAnchor = reading.locator("a[data-local-anchor]").first()
      const target = await firstAnchor.getAttribute("data-local-anchor")
      await firstAnchor.click()
      check(
        `${prefix} native heading link scrolls locally without destroying focus hash`,
        page.url() === addressBefore &&
          (await page.evaluate((id) => document.activeElement?.id === id, target)),
      )
    }
    await reading.locator(".topos-reading-toc summary").click()
    const toc = reading.locator(".topos-reading-toc button")
    await toc.nth(Math.min(2, (await toc.count()) - 1)).click()
    await page.waitForTimeout(450)
    let scroll = await stableScroll(reading)
    check(
      `${prefix} actual contents moves only the reading surface`,
      scroll > 20 && (await page.evaluate(() => document.documentElement.scrollTop === 0)),
      { scroll },
    )
    if (viewport.width === 390) {
      const box = await reading.boundingBox(),
        session = await context.newCDPSession(page)
      const x = box.x + box.width / 2,
        y = Math.min(box.y + box.height - 55, viewport.height - 190)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y, id: 1 }],
      })
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y: y - step * 18, id: 1 }],
        })
        await page.waitForTimeout(25)
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      await page.waitForTimeout(350)
      const next = await stableScroll(reading)
      check(
        "390 native touch scroll reads long source without moving field",
        next > scroll + 20 && (await snap(page)).focus === note.id,
        { before: scroll, after: next },
      )
      scroll = next
      await session.detach()
    }
    await shot(page, `${prefix}-complete-note`)
    const address = page.url()
    await searchFocus(page, proof)
    await settled(page)
    check(
      `${prefix} proof object retains its original statement and proof metadata`,
      (await page.locator('.topos-unfolding[data-owner="a-000095"] math').count()) > 0 &&
        (!proof.proofStatus ||
          (await page
            .locator('.topos-unfolding[data-owner="a-000095"] [data-proof-status]')
            .innerText()) === proof.proofStatus),
    )
    await page.goBack({ waitUntil: "domcontentloaded" })
    await settled(page)
    check(
      `${prefix} Back restores note focus, share hash and reading position`,
      (await snap(page)).focus === note.id &&
        page.url() === address &&
        Math.abs(
          (await page
            .locator(".topos-unfolding[data-active='true']")
            .evaluate((n) => n.scrollTop)) - scroll,
        ) < 4,
      {
        expected: scroll,
        actual: await page
          .locator(".topos-unfolding[data-active='true']")
          .evaluate((node) => node.scrollTop),
        focus: (await snap(page)).focus,
        url: page.url(),
        expectedURL: address,
      },
    )
    const share = page.url()
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await readingReady(page)
    await settled(page)
    check(
      `${prefix} refresh reopens actual full note and its content`,
      page.url() === share &&
        (await snap(page)).focus === note.id &&
        (await page.locator(".topos-unfolding[data-active='true'] math").count()) > 5,
    )
    check(
      `${prefix} lazy refresh preserves exact saved reading position`,
      Math.abs(
        (await stableScroll(page.locator(".topos-unfolding[data-active='true']"))) - scroll,
      ) < 4,
      {
        expected: scroll,
        actual: await page
          .locator(".topos-unfolding[data-active='true']")
          .evaluate((node) => node.scrollTop),
      },
    )
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      width: innerWidth,
      formula: [...document.querySelectorAll('.topos-unfolding[data-active="true"] .katex-display')]
        .map((n, index) => ({
          index,
          width: n.clientWidth,
          content: n.scrollWidth,
          overflow: getComputedStyle(n).overflowX,
          tabIndex: n.tabIndex,
        }))
        .filter((n) => n.content > n.width + 8),
    }))
    check(
      `${prefix} reading page does not horizontally overflow`,
      overflow.page <= overflow.width + 1,
      overflow,
    )
    if (viewport.width === 390 && overflow.formula.length) {
      const formula = page
        .locator('.topos-unfolding[data-active="true"] .katex-display')
        .nth(overflow.formula[0].index)
      await formula.focus()
      await page.keyboard.press("ArrowRight")
      await page.waitForTimeout(160)
      check(
        `${prefix} source long equation scrolls locally by keyboard`,
        (await formula.evaluate((n) => n.scrollLeft > 0)) &&
          overflow.formula[0].overflow === "auto",
      )
      await shot(page, "390-source-long-formula")
    }
    await search(page, metric.title)
    const popupWait = context.waitForEvent("page")
    await page.locator('[data-search-concept="a-000067"]').click({ modifiers: ["Control"] })
    const popup = await popupWait
    await popup.bringToFront()
    await popup.waitForLoadState("domcontentloaded")
    check(
      `${prefix} modifier click preserves canonical original atom address`,
      popup.url().endsWith(metric.href) && (await snap(page)).focus === note.id,
      { url: popup.url(), href: metric.href },
    )
    await popup.close()
    await page.bringToFront()
    await page.keyboard.press("Escape")
    await settled(page)
    const first = await snap(page)
    await page.waitForTimeout(300)
    const second = await snap(page)
    check(
      `${prefix} layout cools and stops, no page errors`,
      first.frame === second.frame && failures.length === 0,
      { frames: [first.frame, second.frame], failures },
    )
  } catch (error) {
    report.errors.push({ scenario: prefix, message: error.stack })
  } finally {
    const video = page.video()
    await context.close()
    if (video) {
      const file = path.join(output, `${prefix}-real-notes.webm`)
      await copyFile(await video.path(), file)
      report.videos.push(file)
    }
  }
}
async function resilience(base, model) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  const page = await context.newPage(),
    docs = []
  page.on("request", (request) => {
    if (request.resourceType() === "document") docs.push(request.url())
  })
  try {
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await settled(page)
    const metric = model.concepts.find((c) => c.id === "a-000067")
    await page.route("**/static/topos/sections/*.json", (route) => route.abort("failed"))
    await search(page, metric.title)
    await page.locator('[data-search-concept="a-000067"]').click()
    await page.locator("[data-retry-section]").waitFor({ state: "visible" })
    check(
      "Missing section is an explicit recoverable state, field and original escape remain",
      (await snap(page)).focus === metric.id &&
        (await page.locator(".topos-source-fallback").count()) === 1 &&
        docs.length === 1,
    )
    await shot(page, "390-section-failed")
    await page.unroute("**/static/topos/sections/*.json")
    await page.locator("[data-retry-section]").click()
    await readingReady(page)
    await settled(page)
    check(
      "Actual retry reads source mathematics in same field",
      (await page.locator('.topos-unfolding[data-active="true"] math').count()) > 0 &&
        docs.length === 1,
    )
    const saved = await page.evaluate(() => history.state.topos)
    saved.field.nodes.pop()
    saved.view.unfolded.push({ concept: "retired-object", section: "retired-section" })
    const key = new URL(base).pathname
    await page.addInitScript(
      ({ key, saved }) => {
        history.replaceState(null, "", location.pathname)
        sessionStorage.setItem(`topos:${key}:v1`, JSON.stringify(saved))
      },
      { key, saved },
    )
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await readingReady(page)
    await settled(page)
    const restored = await snap(page)
    check(
      "Previous model cache missing a node preserves valid focus and rebuilds all current entities",
      restored.focus === metric.id &&
        restored.nodes.length === model.concepts.length &&
        !restored.unfoldedIDs.includes("retired-section") &&
        (await page.locator('.topos-unfolding[data-active="true"] math').count()) > 0,
      { objects: restored.nodes.length },
    )
    await shot(page, "390-old-cache-recovered")
  } catch (error) {
    report.errors.push({ scenario: "lazy-and-old-cache", message: error.stack })
  } finally {
    await context.close()
  }
}
async function readingRegression(base, model, viewport) {
  const context = await browser.newContext({
    viewport,
    isMobile: viewport.width === 390,
    hasTouch: viewport.width === 390,
    recordVideo:
      viewport.width === 1440 ? { dir: path.join(output, "raw-video"), size: viewport } : undefined,
  })
  const page = await context.newPage(),
    documents = []
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents.push(request.url())
  })
  const note = model.concepts.find(
    (c) => c.id === "note:笔记主体/书籍/Simon实分析/第一章/知识/度量拓扑与连续性的三种刻画",
  )
  const proof = model.concepts.find((c) => c.id === "a-000095")
  try {
    const address = new URL(base)
    address.hash = "focus=a-000070&depth=2.1"
    await page.goto(address.href, { waitUntil: "domcontentloaded" })
    await ready(page)
    await readingReady(page)
    await settled(page)
    const boxes = await page.evaluate(() => {
      const focus = document
        .querySelector('.topos-concept[data-focus="true"]')
        .getBoundingClientRect()
      return {
        focus: focus.toJSON(),
        overlap: [...document.querySelectorAll('.topos-concept:not([data-focus="true"])')]
          .filter((n) => +n.style.opacity > 0.3)
          .map((n) => ({ id: n.dataset.concept, rect: n.getBoundingClientRect() }))
          .filter(
            ({ rect }) =>
              rect.x < focus.right &&
              rect.right > focus.x &&
              rect.y < focus.bottom &&
              rect.bottom > focus.y,
          )
          .map((n) => n.id),
      }
    })
    check(
      `${viewport.width} strict reading title exclusion after settling`,
      boxes.overlap.length === 0,
      boxes,
    )
    await shot(page, `${viewport.width}-regression-continuity`)
    await page.locator(".topos-unfolding[data-active=true] .topos-original-source").click()
    await readingReady(page)
    await settled(page)
    const reading = page.locator(".topos-unfolding[data-active=true]")
    await reading.locator(".topos-reading-toc summary").click()
    await reading.locator(".topos-reading-toc button").last().click()
    const before = await stableScroll(reading),
      noteURL = page.url()
    await shot(page, `${viewport.width}-regression-complete-note`)
    await searchFocus(page, proof)
    await settled(page)
    await page.goBack({ waitUntil: "domcontentloaded" })
    await readingReady(page)
    await settled(page)
    const after = await stableScroll(page.locator(".topos-unfolding[data-active=true]"))
    check(
      `${viewport.width} Back restores a stationary reading position`,
      (await snap(page)).focus === note.id &&
        page.url() === noteURL &&
        Math.abs(before - after) < 4,
      { before, after, focus: (await snap(page)).focus, documents },
    )
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await readingReady(page)
    await settled(page)
    const refreshed = await stableScroll(page.locator(".topos-unfolding[data-active=true]"))
    check(
      `${viewport.width} cold-body refresh preserves desired reading offset`,
      (await snap(page)).focus === note.id && Math.abs(before - refreshed) < 4,
      { before, refreshed },
    )
    await shot(page, `${viewport.width}-regression-refreshed-note`)
  } catch (error) {
    report.errors.push({ scenario: `regression-${viewport.width}`, message: error.stack })
  } finally {
    const video = page.video()
    await context.close()
    if (video) {
      const file = path.join(output, `${viewport.width}-reading-regressions.webm`)
      await copyFile(await video.path(), file)
      report.videos.push(file)
    }
  }
}
try {
  await mkdir(output, { recursive: true })
  preview = process.env.TOPOS_PUBLISHED_URL ? undefined : await startPreview({ port: 0 })
  const base = process.env.TOPOS_PUBLISHED_URL ?? `${preview.url}/World/topos.html`
  const data = JSON.parse(await readFile(path.join(root, "public/static/topos/index.json"), "utf8"))
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    if (process.argv.includes("--regressions")) await readingRegression(base, data.model, viewport)
    else await mainScenario(base, data.model, viewport)
    if (
      await access(path.join(output, "stop-after-context")).then(
        () => true,
        () => false,
      )
    ) {
      report.notRun.push(
        "Further viewport scenarios deliberately stopped after saving the current context.",
      )
      break
    }
  }
  await resilience(base, data.model)
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  })
  try {
    const page = await context.newPage()
    await page.goto(base, { waitUntil: "domcontentloaded" })
    await ready(page)
    await settled(page)
    const target = data.model.concepts.find((c) => c.id === "a-000070")
    await searchFocus(page, target)
    await settled(page)
    const before = await snap(page)
    await page.waitForTimeout(250)
    const after = await snap(page)
    check(
      "Reduced motion preserves actual math and settles all published objects",
      before.nodes.every((a) => {
        const b = after.nodes.find((n) => n.id === a.id)
        return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 0.0001
      }) && (await page.locator(".topos-unfolding[data-active='true'] math").count()) > 0,
    )
    await shot(page, "390-reduced-motion")
  } finally {
    await context.close()
  }
} catch (error) {
  report.errors.push({ stage: "setup", message: error.stack })
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((c) => c.passed).length
  report.failed = report.checks.filter((c) => !c.passed).length + report.errors.length
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n")
  console.log(
    JSON.stringify({ passed: report.passed, failed: report.failed, videos: report.videos.length }),
  )
  if (report.failed) process.exitCode = 1
}
