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
const readReady = async (page, id) => {
  await page.waitForFunction(
    (id) =>
      window.__topos?.state.focus === id &&
      document.body.dataset.reader === "true" &&
      document.querySelector('.topos-unfolding[data-active="true"] .topos-prose'),
    id,
  )
  // Public font subsets may still be loading when the source tree first exists.
  // Match the reader's restoration lifecycle instead of assuming local-cache
  // timing; this waits for readiness, not for a desired scroll assertion.
  await page.evaluate(async () => {
    void document.querySelector('.topos-unfolding[data-active="true"]')?.offsetHeight
    await document.fonts.ready
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    )
  })
}
const closeNumber = (a, b, tolerance = 1) => Math.abs(a - b) <= tolerance
const sameCamera = (a, b) => ["x", "y", "k"].every((key) => closeNumber(a[key], b[key], 0.01))
async function checkOpenThemeMap(page, name, expected) {
  const evidence = await page.evaluate(() => {
    const stage = document.querySelector("[data-global-map-stage]"),
      bounds = stage.getBoundingClientRect(),
      themes = [...stage.querySelectorAll("[data-global-map-group]")],
      nodes = [...stage.querySelectorAll("[data-global-map-node]")],
      labels = [...stage.querySelectorAll("[data-global-map-label]")]
    const shapes = themes.flatMap((theme) =>
      [...theme.querySelectorAll("rect,path,polygon,polyline,circle,ellipse,line")].map(
        (shape) => ({
          id: theme.dataset.globalMapGroup,
          tag: shape.tagName,
        }),
      ),
    )
    const walls = []
    for (let y = bounds.top + 12; y < bounds.bottom - 12; y += 28)
      for (let x = bounds.left + 12; x < bounds.right - 12; x += 28) {
        const theme = document.elementFromPoint(x, y)?.closest("[data-global-map-group]")
        if (!theme) continue
        const text = theme.querySelector("text")?.getBoundingClientRect()
        if (
          !text ||
          x < text.left - 1 ||
          x > text.right + 1 ||
          y < text.top - 1 ||
          y > text.bottom + 1
        )
          walls.push({ id: theme.dataset.globalMapGroup, x, y })
      }
    const annotation = labels[0] ?? themes[0]
    return {
      nodeIDs: nodes.map((node) => node.dataset.globalMapNode),
      shapes,
      walls,
      themes: themes.map((theme) => ({
        id: theme.dataset.globalMapGroup,
        role: theme.getAttribute("role"),
        tabIndex: theme.tabIndex,
        name: theme.getAttribute("aria-label"),
        text: theme.querySelector("text")?.textContent,
      })),
      layering:
        Boolean(annotation) &&
        nodes.every((node) =>
          Boolean(annotation.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING),
        ),
      missingMarks: nodes
        .filter((node) => {
          const dot = node.querySelector(".global-map-dot"),
            style = dot && getComputedStyle(dot)
          return (
            !dot ||
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0
          )
        })
        .map((node) => node.dataset.globalMapNode),
    }
  })
  const expectedIDs = new Set(expected.concepts.map((node) => node.id))
  check(
    `${name}: open field keeps exact unique object identities`,
    evidence.nodeIDs.length === expectedIDs.size &&
      new Set(evidence.nodeIDs).size === expectedIDs.size &&
      evidence.nodeIDs.every((id) => expectedIDs.has(id)),
    { count: evidence.nodeIDs.length, expected: expectedIDs.size },
  )
  check(
    `${name}: themes have no enclosing geometry or broad hit walls`,
    evidence.shapes.length === 0 && evidence.walls.length === 0,
    { shapes: evidence.shapes, walls: evidence.walls },
  )
  check(
    `${name}: theme controls retain keyboard semantics and names`,
    evidence.themes.length > 0 &&
      evidence.themes.every(
        (theme) =>
          theme.role === "button" && theme.tabIndex === 0 && theme.name && theme.text?.trim(),
      ),
    evidence.themes,
  )
  check(
    `${name}: object marks remain above annotation layers`,
    evidence.layering && evidence.missingMarks.length === 0,
    { layering: evidence.layering, missingMarks: evidence.missingMarks },
  )
}
async function checkThemeFocus(page, name) {
  const group = page.locator("[data-global-map-group]").first(),
    id = await group.getAttribute("data-global-map-group"),
    before = (await snap(page)).globalMap
  await group.focus()
  await page.keyboard.press("Enter")
  await mapReady(page)
  const after = (await snap(page)).globalMap,
    memberIDs = after.groups.find((group) => group.id === id)?.ids ?? []
  check(
    `${name}: theme Enter locates members without changing object positions`,
    after.open &&
      before.nodeIDs.length === after.nodeIDs.length &&
      before.positions.every((node) => {
        const next = after.positions.find((entry) => entry.id === node.id)
        return next && closeNumber(node.x, next.x, 0.01) && closeNumber(node.y, next.y, 0.01)
      }),
    { id, members: memberIDs.length },
  )
  const themeFit = () =>
    group.evaluate((group, ids) => {
      const title = group.querySelector("text").getBoundingClientRect(),
        stage = group.closest(".global-map-stage").getBoundingClientRect(),
        members = new Set(ids),
        marks = [
          ...group.closest(".global-map-stage").querySelectorAll("[data-global-map-node]"),
        ].filter((node) => members.has(node.dataset.globalMapNode))
      const outside = marks
        .filter((node) => {
          const box = node.querySelector(".global-map-dot").getBoundingClientRect(),
            x = box.x + box.width / 2,
            y = box.y + box.height / 2
          return (
            x < stage.left - 1 || x > stage.right + 1 || y < stage.top - 1 || y > stage.bottom + 1
          )
        })
        .map((node) => node.dataset.globalMapNode)
      return {
        titleVisible:
          title.left >= stage.left - 1 &&
          title.right <= stage.right + 1 &&
          title.top >= stage.top - 1 &&
          title.bottom <= stage.bottom + 1,
        members: marks.length,
        outside,
      }
    }, memberIDs)
  const fit = await themeFit()
  check(
    `${name}: focused theme text and actual members fit the view`,
    fit.titleVisible &&
      memberIDs.length > 0 &&
      fit.members === memberIDs.length &&
      fit.outside.length === 0,
    fit,
  )
  await page.keyboard.press("Space")
  await mapReady(page)
  check(
    `${name}: theme Space remains in the same map and object set`,
    (await snap(page)).globalMap.open &&
      sameCamera(after.camera, (await snap(page)).globalMap.camera),
  )
  await page.locator("[data-global-map-fit]").click()
  await mapReady(page)
  const title = group.locator("text")
  const textPoint = () =>
    title.evaluate((text) => {
      const group = text.closest("[data-global-map-group]"),
        box = text.getBoundingClientRect(),
        centerHit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
        matrix = text.getScreenCTM()
      for (let index = 0; index < text.getNumberOfChars(); index++) {
        const extent = text.getExtentOfChar(index)
        if (extent.width <= 0 || extent.height <= 0) continue
        const point = new DOMPoint(
          extent.x + extent.width / 2,
          extent.y + extent.height / 2,
        ).matrixTransform(matrix)
        if (
          document.elementFromPoint(point.x, point.y)?.closest("[data-global-map-group]") === group
        )
          return {
            x: point.x,
            y: point.y,
            id: group.dataset.globalMapGroup,
            boxCenterTarget:
              centerHit
                ?.closest("[data-global-map-node],[data-global-map-label],[data-global-map-group]")
                ?.outerHTML.slice(0, 250) ?? null,
          }
      }
      return null
    })
  const tapPoint = await textPoint()
  if (!tapPoint) throw new Error(`No actual theme glyph can receive pointer input: ${name}`)
  if (page.viewportSize().width === 390) {
    await page.touchscreen.tap(tapPoint.x, tapPoint.y)
  } else await page.mouse.click(tapPoint.x, tapPoint.y)
  await mapReady(page)
  const pointerFit = await themeFit(),
    pointerMap = (await snap(page)).globalMap
  check(
    `${name}: a real theme-name click or tap locates its members`,
    pointerMap.open &&
      pointerMap.nodeIDs.length === before.nodeIDs.length &&
      before.nodeIDs.every((id) => pointerMap.nodeIDs.includes(id)) &&
      tapPoint.id === id &&
      pointerFit.titleVisible &&
      pointerFit.members === memberIDs.length &&
      pointerFit.outside.length === 0,
    { target: tapPoint, fit: pointerFit, camera: pointerMap.camera },
  )
  const point = await textPoint(),
    beforeDrag = (await snap(page)).globalMap.camera
  if (!point) throw new Error(`No actual theme glyph can receive a drag: ${name}`)
  if (page.viewportSize().width === 390) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ id: 1, x: point.x, y: point.y }],
    })
    for (let step = 1; step <= 8; step++)
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ id: 1, x: point.x + step * 4, y: point.y + step * 3 }],
      })
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await cdp.detach()
  } else {
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await page.mouse.move(point.x + 32, point.y + 24, { steps: 8 })
    await page.mouse.up()
  }
  await mapReady(page)
  const afterDrag = (await snap(page)).globalMap.camera
  check(
    `${name}: dragging theme text pans continuously without activating it`,
    closeNumber(afterDrag.x - beforeDrag.x, 32, 1) &&
      closeNumber(afterDrag.y - beforeDrag.y, 24, 1) &&
      closeNumber(afterDrag.k, beforeDrag.k, 0.001) &&
      (await snap(page)).globalMap.open,
    { before: beforeDrag, after: afterDrag, target: point },
  )
  await group.focus()
  await page.keyboard.press("Enter")
  await mapReady(page)
}
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
      await checkOpenThemeMap(page, name, model)
      await checkThemeFocus(page, name)
      await page.locator("[data-global-map-fit]").click()
      await mapReady(page)
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
      hasTouch: width === 390,
      isMobile: width === 390,
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
      await checkOpenThemeMap(page, name, atlas)
      await checkThemeFocus(page, name)
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
  // A bounded migration fixture uses genuine public IDs and a current valid
  // snapshot, but marks its saved view as the previous arrangement. Explicit
  // manual coordinates survive; a poisoned old default camera/physics must not.
  const legacyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let legacyPage = await legacyContext.newPage()
  try {
    await legacyPage.goto(base + "topos.html")
    await mapReady(legacyPage)
    const current = await legacyPage.evaluate(() => history.state?.topos?.mapView)
    if (!current?.physics?.nodes?.length) throw new Error("No actual map view for cache fixture")
    const manual = {
        id: current.physics.nodes[0].id,
        x: current.physics.nodes[0].x + 241,
        y: current.physics.nodes[0].y - 173,
      },
      poisonedCamera = { x: 543210, y: -432100, k: 0.07 }
    const legacy = {
      version: 1,
      signature: current.signature,
      points: [manual],
      views: [
        {
          key:
            current.selection === undefined ? "all" : JSON.stringify([...current.selection].sort()),
          camera: poisonedCamera,
          width: current.width,
          height: current.height,
          selected: current.selected,
          layout: { columns: 3, headingSpace: 75 },
          physics: {
            ...current.physics,
            settled: true,
            nodes: current.physics.nodes.map((node, index) => ({
              ...node,
              x: 100000 + index * 200,
              y: 200000,
              anchorX: 100000 + index * 200,
              anchorY: 200000,
              vx: 0,
              vy: 0,
            })),
          },
        },
      ],
    }
    // A different document entry must not inherit the current valid history
    // snapshot or the departing page's later cache write.
    await legacyPage.close()
    legacyPage = await legacyContext.newPage()
    await legacyPage.addInitScript((cache) => {
      sessionStorage.setItem(
        `topos-global-map:1:${location.pathname}:${cache.signature}`,
        JSON.stringify(cache),
      )
      window.__legacyMapFixture = cache
    }, legacy)
    await legacyPage.goto(base + "topos.html?legacy-cache-fixture=1")
    await mapReady(legacyPage)
    const migrated = (await snap(legacyPage)).globalMap,
      restored = migrated.positions.find((node) => node.id === manual.id)
    check(
      "legacy cache: manual coordinates survive without the old arrangement marker",
      restored &&
        closeNumber(restored.anchorX, manual.x, 0.01) &&
        closeNumber(restored.anchorY, manual.y, 0.01),
      {
        expected: manual,
        actual: restored && { id: restored.id, x: restored.anchorX, y: restored.anchorY },
      },
    )
    check(
      "legacy cache: obsolete default camera and physics do not replace the open field",
      !sameCamera(migrated.camera, poisonedCamera) &&
        migrated.positions.every(
          (node) => Math.abs(node.anchorX) < 100000 && Math.abs(node.anchorY) < 100000,
        ) &&
        migrated.nodeIDs.length === model.concepts.length,
      { camera: migrated.camera, count: migrated.nodeIDs.length },
    )
    const historyView = await legacyPage.evaluate(() => history.state?.topos?.mapView)
    check(
      "current history: open arrangement and actual camera are recorded together",
      historyView?.arrangement === "continuous-1" &&
        sameCamera(historyView.camera, migrated.camera),
      { arrangement: historyView?.arrangement, camera: historyView?.camera },
    )
  } catch (error) {
    report.errors.push({ name: "legacy-cache", error: error.stack })
  }
  await legacyContext.close()
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
    JSON.stringify({
      passed: report.passed,
      failed: report.failed,
      errors: report.errors.map(({ name, error }) => ({ name, error })),
    }),
  )
  if (report.failed) process.exitCode = 1
}
