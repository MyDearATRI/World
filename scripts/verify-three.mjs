import { chromium } from "playwright"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { startPreview } from "./preview.mjs"

const root = fileURLToPath(new URL("../", import.meta.url))
const index = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"))
const catalog = JSON.parse(
  await readFile(path.join(root, "public/static/bookIndex.json"), "utf8"),
).catalog
const atom =
  index.objects.find(
    (object) => object.kind === "atom" && object.title.includes("连续性的三种刻画"),
  ) ?? index.objects.find((object) => object.kind === "atom" && object.latex.length)
const longNote = index.objects
  .filter((object) => object.kind === "note")
  .sort(
    (a, b) =>
      Math.max(0, ...b.latex.map((latex) => latex.length)) -
      Math.max(0, ...a.latex.map((latex) => latex.length)),
  )[0]
const appearances = new Map()
for (const relation of index.relations.filter(
  (relation) => relation.type === "appears-in-section",
)) {
  const entries = appearances.get(relation.source) ?? new Set()
  entries.add(relation.target)
  appearances.set(relation.source, entries)
}
const multipleAppearances = [...appearances].filter(
  ([id, members]) =>
    index.objects.some((object) => object.id === id && object.kind === "atom") && members.size > 1,
)
const multi =
  multipleAppearances.find(
    ([, members]) =>
      new Set([...members].map((id) => index.objects.find((object) => object.id === id)?.chapterId))
        .size > 1,
  ) ?? multipleAppearances[0]
if (!atom || !longNote || !multi || !catalog.books.length)
  throw new Error("Published snapshot lacks the real objects needed for 3D acceptance")
const [multiId, multiSections] = multi
const book = catalog.books[0]
const firstChapter = book.chapters[0]
const metricSection =
  firstChapter.sections.find((section) => section.title.startsWith("1.2 ")) ??
  firstChapter.sections[0]
const report = {
  startedAt: new Date().toISOString(),
  mode: process.env.THREE_SITE_URL ? "live" : "local",
  snapshotHash: index.snapshotHash,
  methods: [
    "Real generated /World/explore.html with real WebGL2 rendering; no renderer stubs",
    "Playwright mouse and keyboard plus CDP simulated touch; not a physical phone",
    "Read-only scene diagnostics corroborated by actual canvas, DOM, URL and screenshot observations",
    "Native WEBGL_lose_context extension for context-loss injection; separate browser launch with WebGL disabled for fallback",
    "720 CSS-pixel reflow is an equivalent-width check, not native browser zoom",
  ],
  checks: [],
  screenshots: [],
  errors: [],
  notRun: [],
}
const check = (name, passed, detail) => {
  report.checks.push({ name, passed: Boolean(passed), ...(detail === undefined ? {} : { detail }) })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const mapSelector = "[data-knowledge-map].knowledge-map-3d"
const nodeSelector = (id) => `.kg3d-node[data-node-id=${JSON.stringify(id)}]`
const scopeSelector = (id) => `[data-kg-scope=${JSON.stringify(id)}]`
const graph = (page) => page.locator(mapSelector).first()
const state = (page) => graph(page).evaluate((element) => element.knowledgeMapState)
const positionDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const cameraDistance = (a, b) =>
  Math.max(
    ...["position", "target", "up"].flatMap((key) =>
      a[key].map((value, i) => Math.abs(value - b[key][i])),
    ),
  )
const getScope = async (page, id) => {
  const candidate = graph(page).locator(scopeSelector(id)).filter({ visible: true }).first()
  await candidate.click()
  await page.waitForFunction(
    ({ selector, id }) => document.querySelector(selector)?.knowledgeMapState?.scopeId === id,
    { selector: mapSelector, id },
  )
}
async function settled(page) {
  await page.waitForFunction(
    (selector) => {
      const host = document.querySelector(selector)
      return (
        host &&
        ["settled", "paused"].includes(host.dataset.simulation) &&
        host.dataset.renderLoop === "idle"
      )
    },
    mapSelector,
    { timeout: 20000 },
  )
}
async function enterChapter(page, chapter = firstChapter) {
  await getScope(page, `collection:book:${book.id}`)
  await getScope(page, `collection:chapter:${chapter.id}`)
}
async function screenshot(page, suffix) {
  const file = path.join(root, "artifacts/screenshots", `three-${report.mode}-${suffix}.png`)
  await page.screenshot({ path: file, fullPage: false })
  report.screenshots.push(file)
}
async function waitReading(page, object) {
  await page.waitForFunction(
    (title) =>
      document.querySelector("[data-space-title]")?.textContent === title &&
      document.querySelector("[data-space-status]")?.textContent === "" &&
      !!document.querySelector(".space-body .markdown-content"),
    object.title,
  )
  await page.evaluate(() => document.fonts.ready)
}
async function observeIdle(page, label) {
  await settled(page)
  const a = await state(page)
  await page.waitForTimeout(350)
  const b = await state(page)
  check(
    `${label}: cooling stops the render loop and positions remain still`,
    a.diagnostics.renderCount === b.diagnostics.renderCount &&
      JSON.stringify(a.positions) === JSON.stringify(b.positions),
    { beforeFrames: a.diagnostics.renderCount, afterFrames: b.diagnostics.renderCount },
  )
}
async function labelBounds(page, label) {
  const clips = await graph(page).evaluate((host) => {
    const stage = host.querySelector(".kg3d-stage").getBoundingClientRect()
    return [...host.querySelectorAll(".kg3d-node:not([hidden])")]
      .map((node) => ({ id: node.dataset.nodeId, rect: node.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.x < stage.x - 1 ||
          rect.right > stage.right + 1 ||
          rect.y < stage.y - 1 ||
          rect.bottom > stage.bottom + 1,
      )
      .map(({ id }) => id)
  })
  check(
    `${label}: visible labels stay inside their canvas instead of being cropped`,
    clips.length === 0,
    clips,
  )
}
async function visibleNavigationLabels(page, ids, label) {
  const labels = await graph(page).evaluate((host, expected) => {
    const stage = host.querySelector(".kg3d-stage").getBoundingClientRect()
    return expected.map((id) => {
      const node = [...host.querySelectorAll(".kg3d-node")].find(
        (node) => node.dataset.nodeId === id,
      )
      const rect = node?.getBoundingClientRect()
      return {
        id,
        readable: Boolean(
          node &&
          !node.hidden &&
          rect?.width > 0 &&
          Number(node.dataset.screenX) >= 0 &&
          Number(node.dataset.screenX) <= stage.width &&
          Number(node.dataset.screenY) >= 0 &&
          Number(node.dataset.screenY) <= stage.height &&
          rect.x >= stage.x - 1 &&
          rect.right <= stage.right + 1 &&
          rect.y >= stage.y - 1 &&
          rect.bottom <= stage.bottom + 1,
        ),
      }
    })
  }, ids)
  check(
    `${label}: every navigation collection has a readable in-view label`,
    labels.every((entry) => entry.readable),
    labels,
  )
}
async function restoredFocus(page, id, label) {
  await page.waitForTimeout(80)
  const focused = await page.evaluate(() => {
    const active = document.activeElement
    return {
      id:
        active?.getAttribute("data-knowledge-id") ??
        active?.getAttribute("data-object-id") ??
        active?.getAttribute("data-node-id"),
      graph: Boolean(active?.closest("[data-knowledge-map]")),
    }
  })
  check(
    `${label}: browser back restores focus to the same graph object`,
    focused.id === id && focused.graph,
    focused,
  )
}
let preview
let browser
let fallbackBrowser
let base
try {
  await mkdir(path.join(root, "artifacts/screenshots"), { recursive: true })
  preview = process.env.THREE_SITE_URL ? undefined : await startPreview({ port: 0 })
  base = process.env.THREE_SITE_URL ?? `${preview.url}/World/`
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  report.browserVersion = browser.version()
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const label = `${size.width}`
    const context = await browser.newContext({
      viewport: size,
      isMobile: size.width === 390,
      hasTouch: size.width === 390,
      reducedMotion: "no-preference",
    })
    const page = await context.newPage()
    page.on("pageerror", (error) =>
      report.errors.push({ viewport: size.width, message: error.message }),
    )
    try {
      await page.goto(new URL("explore.html", base).href, { waitUntil: "networkidle" })
      await graph(page).waitFor()
      if (
        size.width === 390 &&
        !(await graph(page).evaluate((element) => element.classList.contains("is-fullscreen")))
      )
        await graph(page).getByRole("button", { name: "打开全屏地图", exact: true }).click()
      await page.waitForFunction(
        (selector) => document.querySelector(selector)?.dataset.renderer === "webgl2",
        mapSelector,
        { timeout: 15000 },
      )
      const gl = await graph(page)
        .locator(".kg3d-canvas")
        .evaluate((canvas) => {
          const context = canvas.getContext("webgl2")
          return {
            isWebGL2: context instanceof WebGL2RenderingContext,
            version: context?.getParameter(context.VERSION),
            renderer: context?.getParameter(context.RENDERER),
            drawingWidth: context?.drawingBufferWidth,
            drawingHeight: context?.drawingBufferHeight,
          }
        })
      check(
        `${label}: actual WebGL2 context has a nonempty drawing buffer`,
        gl.isWebGL2 && gl.drawingWidth > 0 && gl.drawingHeight > 0,
        gl,
      )
      check(
        `${label}: document fits viewport`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      )
      await settled(page)
      await visibleNavigationLabels(
        page,
        [
          `collection:book:${book.id}`,
          ...book.chapters.map((chapter) => `collection:chapter:${chapter.id}`),
        ],
        `${label} overview`,
      )
      await screenshot(page, `${label}-overview`)
      await graph(page).locator(".kg3d-canvas").scrollIntoViewIfNeeded()
      const bookPoint = await graph(page)
        .locator(nodeSelector(`collection:book:${book.id}`))
        .evaluate((node) => {
          const canvas = node
            .closest(".knowledge-map-3d")
            .querySelector(".kg3d-canvas")
            .getBoundingClientRect()
          return {
            x: canvas.x + Number(node.dataset.screenX),
            y: canvas.y + Number(node.dataset.screenY),
          }
        })
      if (size.width === 390) await page.touchscreen.tap(bookPoint.x, bookPoint.y)
      else await page.mouse.click(bookPoint.x, bookPoint.y)
      await page.waitForFunction(
        ({ selector, id }) => document.querySelector(selector)?.knowledgeMapState?.scopeId === id,
        { selector: mapSelector, id: `collection:book:${book.id}` },
      )
      check(
        `${label}: clicking or tapping the actual collection mesh enters the book`,
        (await state(page)).scopeId === `collection:book:${book.id}`,
      )
      await enterChapter(page)
      await settled(page)
      await graph(page).locator(".kg3d-canvas").scrollIntoViewIfNeeded()
      let scene = await state(page)
      check(
        `${label}: chapter opens its section skeleton without an atom hairball`,
        scene.scopeId === `collection:chapter:${firstChapter.id}` &&
          firstChapter.sections.every((section) =>
            scene.diagnostics.visibleIds.includes(`note:${section.slug}`),
          ) &&
          !scene.diagnostics.visibleIds.some((id) =>
            index.objects.some((object) => object.id === id && object.kind === "atom"),
          ),
      )
      check(
        `${label}: each published object has exactly one scene entity`,
        index.objects.every(
          (object) => scene.diagnostics.nodeIds.filter((id) => id === object.id).length === 1,
        ) && new Set(scene.diagnostics.nodeIds).size === scene.diagnostics.nodeIds.length,
      )
      const visiblePositions = scene.diagnostics.visibleIds
        .map((id) => scene.positions[id])
        .filter(Boolean)
      check(
        `${label}: expanded entities occupy actual depth instead of a 2D plane`,
        Math.max(...visiblePositions.map((point) => point.z)) -
          Math.min(...visiblePositions.map((point) => point.z)) >
          20,
      )
      await observeIdle(page, label)
      await labelBounds(page, label)
      await visibleNavigationLabels(
        page,
        firstChapter.sections.map((section) => `note:${section.slug}`),
        `${label} chapter`,
      )
      await screenshot(page, `${label}-chapter`)
      const beforeOrbit = await state(page)
      await graph(page).getByRole("button", { name: "旋转地图右", exact: true }).click()
      await settled(page)
      const afterOrbit = await state(page)
      check(
        `${label}: orbit changes the 3D camera while keeping target`,
        cameraDistance(beforeOrbit.camera, afterOrbit.camera) > 1 &&
          beforeOrbit.camera.target.every(
            (value, i) => Math.abs(value - afterOrbit.camera.target[i]) < 0.001,
          ),
      )
      const cameraBeforeZoom = afterOrbit.camera
      await graph(page).getByRole("button", { name: "放大地图", exact: true }).click()
      await settled(page)
      check(
        `${label}: explicit zoom changes camera distance`,
        cameraDistance(cameraBeforeZoom, (await state(page)).camera) > 1,
      )
      const beforeKeyboard = (await state(page)).camera
      await graph(page).locator(".kg3d-canvas").focus()
      await page.keyboard.press("Shift+ArrowRight")
      await settled(page)
      check(
        `${label}: keyboard pans the focused map without moving the document sideways`,
        cameraDistance(beforeKeyboard, (await state(page)).camera) > 1 &&
          (await page.evaluate(() => scrollX)) === 0,
      )
      const saved = await state(page)
      await page.reload({ waitUntil: "networkidle" })
      await graph(page).waitFor()
      if (
        size.width === 390 &&
        !(await graph(page).evaluate((element) => element.classList.contains("is-fullscreen")))
      )
        await graph(page).getByRole("button", { name: "打开全屏地图", exact: true }).click()
      await settled(page)
      const restored = await state(page)
      check(
        `${label}: refresh restores scope and exact 3D camera`,
        restored.scopeId === saved.scopeId && cameraDistance(restored.camera, saved.camera) < 0.01,
        { saved: saved.camera, restored: restored.camera },
      )
      const memberships = restored.diagnostics.memberships[multiId] ?? []
      check(
        `${label}: multi-section membership retains every evidenced appearance`,
        [...multiSections].every((id) => memberships.includes(id)),
        { object: multiId, expected: [...multiSections], actual: memberships },
      )
      for (const member of [...multiSections].slice(0, 2)) {
        const section = index.objects.find((object) => object.id === member)
        const chapter = book.chapters.find((chapter) =>
          chapter.sections.some((entry) => `note:${entry.slug}` === member),
        )
        await enterChapter(page, chapter)
        await getScope(page, member)
        await settled(page)
        scene = await state(page)
        check(
          `${label}: ${section?.title ?? member} exposes the same shared object ID`,
          scene.diagnostics.visibleIds.filter((id) => id === multiId).length === 1 &&
            scene.diagnostics.nodeIds.filter((id) => id === multiId).length === 1,
        )
      }
      const links = graph(page)
        .locator(`a[data-knowledge-id=${JSON.stringify(multiId)}]`)
        .filter({ visible: true })
      const targetLink = links.first()
      await targetLink.focus()
      const preRead = await state(page)
      const mapUrl = page.url()
      await page.keyboard.press("Enter")
      const shared = index.objects.find((object) => object.id === multiId)
      await waitReading(page, shared)
      check(
        `${label}: keyboard opens the same complete mathematical object`,
        new URL(page.url()).pathname === new URL(shared.href, base).pathname &&
          (await page.locator(".space-body math").count()) > 0,
      )
      if (size.width === 1440) {
        await page.locator("[data-space-map-toggle]").filter({ visible: true }).first().click()
        const localMap = page.locator(".space-map-region")
        await localMap.locator('.knowledge-map-3d[data-renderer="webgl2"]').waitFor()
        const pathTrigger = localMap.getByRole("button", { name: "查看连接路径", exact: true })
        await pathTrigger.click()
        const dialog = localMap.locator("dialog.kg3d-path[open]")
        await dialog.waitFor()
        check(
          "Local relation paths exclude model similarity by default",
          !(await dialog.locator('input[type="checkbox"]').isChecked()),
        )
        const relation = index.relations.find(
          (relation) =>
            relation.source === multiId &&
            relation.evidenceHref &&
            relation.source !== relation.target,
        )
        if (!relation) throw new Error("Published shared atom has no sourced relation to validate")
        await dialog.getByLabel("起点对象").selectOption(relation.source)
        await dialog.getByLabel("终点对象").selectOption(relation.target)
        await dialog.getByRole("button", { name: "查找连接", exact: true }).click()
        const evidence = dialog.getByRole("link", { name: "查看关系出处", exact: true })
        check(
          "Local relation path lists a real connection and its original evidence",
          (await evidence.count()) > 0 &&
            (await dialog.locator(".kg3d-path-results").innerText()).includes(
              "以下连接逐项列出原文或目录依据",
            ) &&
            (await evidence.first().getAttribute("href")) ===
              new URL(relation.evidenceHref, base).href,
        )
        await screenshot(page, "local-sourced-path")
        const urlBeforeClose = page.url()
        await page.keyboard.press("Escape")
        await dialog.waitFor({ state: "detached" })
        check(
          "Escape closes only the path dialog and restores its trigger focus",
          page.url() === urlBeforeClose &&
            (await localMap.isVisible()) &&
            (await pathTrigger.evaluate((element) => document.activeElement === element)),
        )
      }
      await page.goBack()
      await graph(page).waitFor()
      await settled(page)
      check(
        `${label}: browser back restores graph camera and location`,
        page.url() === mapUrl && cameraDistance((await state(page)).camera, preRead.camera) < 0.01,
      )
      await restoredFocus(page, multiId, label)
      await page.goForward()
      await waitReading(page, shared)
      check(
        `${label}: browser forward restores the selected mathematical object`,
        (await page.locator("[data-space-title]").innerText()) === shared.title,
      )
      await page.goBack()
      await settled(page)
      if (size.width === 1440) {
        await graph(page)
          .locator(`a[data-knowledge-id=${JSON.stringify(multiId)}]`)
          .filter({ visible: true })
          .first()
          .click()
        await waitReading(page, shared)
        await page.reload({ waitUntil: "networkidle" })
        await waitReading(page, shared)
        await page.goBack()
        await graph(page).waitFor()
        await settled(page)
        await restoredFocus(page, multiId, "1440 after refreshing the atom")
      }
      if (size.width === 1440) {
        const popup = context.waitForEvent("page")
        await graph(page)
          .locator(`a[data-knowledge-id=${JSON.stringify(multiId)}]`)
          .filter({ visible: true })
          .first()
          .click({ modifiers: ["Control"] })
        const opened = await popup
        await opened.waitForLoadState("domcontentloaded")
        check(
          "1440: Ctrl-click keeps native new-tab behavior",
          new URL(opened.url()).pathname === new URL(shared.href, base).pathname &&
            page.url() === mapUrl,
        )
        await opened.close()
      }
      await enterChapter(page)
      await getScope(page, `note:${metricSection.slug}`)
      await settled(page)
      if (size.width === 390) {
        if (!(await graph(page).evaluate((element) => element.classList.contains("is-fullscreen"))))
          await graph(page).getByRole("button", { name: "打开全屏地图", exact: true }).click()
        const settings = graph(page).locator(".kg3d-settings")
        if (!(await settings.evaluate((element) => element.open)))
          await settings.locator("summary").click()
        await graph(page).getByRole("button", { name: "调整节点位置", exact: true }).click()
        await settings.locator("summary").click()
        check(
          "390: closed view options do not cover the map",
          !(await settings.locator(".kg3d-settings-body").isVisible()),
        )
      }
      await graph(page).locator(".kg3d-canvas").scrollIntoViewIfNeeded()
      await graph(page).locator(".kg3d-canvas").focus()
      await page.mouse.move(5, 5)
      await settled(page)
      await screenshot(page, `${label}-section-fit`)
      const stageBounds = await graph(page).locator(".kg3d-canvas").boundingBox()
      const draggable = await graph(page)
        .locator(".kg3d-node[data-node-id]")
        .evaluateAll(
          (nodes, canvasBounds) =>
            nodes
              .filter(
                (node) =>
                  node instanceof HTMLElement &&
                  node.offsetWidth > 0 &&
                  !node.hidden &&
                  node.dataset.nodeId?.startsWith("a-") &&
                  document
                    .elementFromPoint(
                      canvasBounds.x + Number(node.dataset.screenX),
                      canvasBounds.y + Number(node.dataset.screenY),
                    )
                    ?.classList.contains("kg3d-canvas"),
              )
              .map((node) => ({
                id: node.dataset.nodeId,
                screenX: Number(node.dataset.screenX),
                screenY: Number(node.dataset.screenY),
              })),
          stageBounds,
        )
      const candidate = draggable.find(
        (entry) =>
          stageBounds.x + entry.screenX > 15 &&
          stageBounds.y + entry.screenY > 100 &&
          stageBounds.x + entry.screenX < size.width - 70 &&
          stageBounds.y + entry.screenY < size.height - 70,
      )
      if (!candidate) throw new Error(`${label}: no visible atom is reachable for drag acceptance`)
      const beforeDrag = await state(page)
      const urlBeforeDrag = page.url()
      const x = stageBounds.x + candidate.screenX,
        y = stageBounds.y + candidate.screenY
      if (size.width === 390) {
        const touch = await context.newCDPSession(page)
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y, id: 1 }],
        })
        for (let step = 1; step <= 8; step++)
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + step * 4, y: y + step * 3, id: 1 }],
          })
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      } else {
        await page.mouse.move(x, y)
        await page.mouse.down()
        await page.mouse.move(x + 70, y + 40, { steps: 12 })
        await page.mouse.up()
      }
      const afterDrag = await state(page)
      check(
        `${label}: dragging a real projected object changes position without opening it`,
        positionDistance(beforeDrag.positions[candidate.id], afterDrag.positions[candidate.id]) >
          5 && page.url() === urlBeforeDrag,
      )
      await page.waitForTimeout(180)
      const responding = await state(page)
      check(
        `${label}: connected layout responds after release`,
        beforeDrag.diagnostics.visibleIds.some(
          (id) =>
            id !== candidate.id &&
            beforeDrag.positions[id] &&
            responding.positions[id] &&
            positionDistance(beforeDrag.positions[id], responding.positions[id]) > 0.01,
        ),
      )
      await observeIdle(page, `${label} after drag`)
      await labelBounds(page, `${label} after drag`)
      if (size.width === 390) {
        const touch = await context.newCDPSession(page)
        const canvas = await graph(page).locator(".kg3d-canvas").boundingBox()
        const blank = await page.evaluate((bounds) => {
          for (const fx of [0.5, 0.4, 0.6])
            for (const fy of [0.15, 0.3, 0.85, 0.7]) {
              const x = bounds.x + bounds.width * fx,
                y = bounds.y + bounds.height * fy
              if (x < 65 || x > innerWidth - 65 || y < 20 || y > innerHeight - 20) continue
              if (
                [-56, -24, 24, 56].every((offset) =>
                  document.elementFromPoint(x + offset, y)?.classList.contains("kg3d-canvas"),
                )
              )
                return { x, y }
            }
          return null
        }, canvas)
        if (!blank) throw new Error("390: no two-finger canvas area is reachable")
        const cx = blank.x,
          cy = blank.y
        const beforePinch = (await state(page)).camera
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [
            { x: cx - 24, y: cy, id: 1 },
            { x: cx + 24, y: cy, id: 2 },
          ],
        })
        for (let step = 1; step <= 8; step++)
          await touch.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              { x: cx - 24 - step * 4, y: cy, id: 1 },
              { x: cx + 24 + step * 4, y: cy, id: 2 },
            ],
          })
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
        await settled(page)
        check(
          "390: simulated two-finger pinch changes the real 3D camera",
          cameraDistance(beforePinch, (await state(page)).camera) > 1,
        )
      }
      await screenshot(page, `${label}-dragged`)
      await page.goto(new URL(longNote.href, base).href, { waitUntil: "networkidle" })
      await page.evaluate(() => document.fonts.ready)
      check(
        `${label}: long mathematical note remains readable`,
        (await page.locator("#article-content math,.space-body math").count()) > 0 &&
          (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)),
      )
      const formulas = await page
        .locator("#article-content .math-scroll,.space-body .math-scroll")
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            width: node.clientWidth,
            scroll: node.scrollWidth,
            overflow: getComputedStyle(node).overflowX,
            math: !!node.querySelector("math"),
          })),
        )
      check(
        `${label}: display equations keep MathML and local scroll containment`,
        formulas.length > 0 &&
          formulas.every(
            (formula) => formula.math && ["auto", "scroll"].includes(formula.overflow),
          ),
        {
          formulas: formulas.length,
          overflowed: formulas.filter((formula) => formula.scroll > formula.width + 1).length,
        },
      )
      const formula = page.locator("#article-content .math-scroll,.space-body .math-scroll").first()
      await formula.focus()
      await page.keyboard.press("ArrowRight")
      await page.keyboard.press("ArrowRight")
      await page.waitForTimeout(180)
      check(
        `${label}: keyboard scrolls the long equation inside its own container`,
        (await formula.evaluate((element) => element.scrollLeft)) > 0 &&
          (await page.evaluate(() => scrollX)) === 0,
      )
      await screenshot(page, `${label}-reading`)
      const directory = size.width === 390 ? firstChapter : book
      await page.goto(new URL(`${directory.slug}.html`, base).href, { waitUntil: "networkidle" })
      const entry = page.locator("details.knowledge-map-entry").first()
      await entry.locator("summary").waitFor()
      check(
        `${label}: book or chapter map waits behind an explicit disclosure`,
        !(await entry.evaluate((element) => element.open)) &&
          (await entry.locator(".kg3d-canvas").count()) === 0,
      )
      await entry.locator("summary").click()
      await page.waitForFunction(
        () =>
          document.querySelector("details.knowledge-map-entry .knowledge-map-3d")?.dataset
            .renderer === "webgl2",
      )
      check(
        `${label}: book or chapter opens the same actual 3D renderer`,
        await entry
          .locator(".kg3d-canvas")
          .evaluate((canvas) => canvas.getContext("webgl2") instanceof WebGL2RenderingContext),
      )
    } catch (error) {
      report.errors.push({ viewport: size.width, message: error.stack })
      console.error(`${label}: ${error.message}`)
    } finally {
      await context.close()
    }
  }
  const reduced = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  })
  const reducedPage = await reduced.newPage()
  reducedPage.on("pageerror", (error) =>
    report.errors.push({ scenario: "reduced-motion-and-context-loss", message: error.message }),
  )
  await reducedPage.goto(new URL("explore.html", base).href, { waitUntil: "networkidle" })
  await graph(reducedPage).waitFor()
  await enterChapter(reducedPage)
  await observeIdle(reducedPage, "Reduced motion")
  check(
    "Reduced motion has no continuing geometric animation",
    await reducedPage.evaluate(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    ),
  )
  await reducedPage.setViewportSize({ width: 720, height: 500 })
  await graph(reducedPage).locator(".kg3d-canvas").scrollIntoViewIfNeeded()
  check(
    "720px equivalent zoom reflow keeps map controls inside document",
    await reducedPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  )
  await screenshot(reducedPage, "reduced-reflow")
  const loss = await graph(reducedPage)
    .locator(".kg3d-canvas")
    .evaluate((canvas) => {
      const extension = canvas.getContext("webgl2")?.getExtension("WEBGL_lose_context")
      extension?.loseContext()
      return Boolean(extension)
    })
  check("Real WebGL context-loss extension is available", loss)
  if (loss) {
    await reducedPage.waitForFunction(
      (selector) => document.querySelector(selector)?.dataset.renderer === "fallback",
      mapSelector,
    )
    check(
      "Context loss exposes a readable navigation fallback",
      (await graph(reducedPage)
        .locator("a[data-knowledge-id],button[data-kg-scope]")
        .filter({ visible: true })
        .count()) > 0,
    )
    await graph(reducedPage).locator(".kg3d-tree").scrollIntoViewIfNeeded()
    await screenshot(reducedPage, "context-loss-fallback")
  }
  await reduced.close()
  const slowContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const slowPage = await slowContext.newPage()
  slowPage.on("pageerror", (error) =>
    report.errors.push({ scenario: "optional-resources-delayed", message: error.message }),
  )
  const heldRoutes = []
  let releaseOptional
  const optionalGate = new Promise((resolve) => {
    releaseOptional = resolve
  })
  await slowPage.route(
    /\/(?:static\/graph\/knowledgeGraph3d\.js|static\/semantic\.json)(?:\?.*)?$/,
    async (route) => {
      heldRoutes.push(new URL(route.request().url()).pathname)
      await optionalGate
      await route.continue()
    },
  )
  try {
    await slowPage.goto(new URL("explore.html", base).href, { waitUntil: "domcontentloaded" })
    await slowPage.waitForFunction(
      () => Boolean(document.querySelector('[data-command-type] option[value="definition"]')),
      undefined,
      { timeout: 6000 },
    )
    await slowPage.keyboard.press("Control+k")
    await slowPage.locator(".knowledge-command[open]").waitFor({ timeout: 6000 })
    await slowPage.locator("#knowledge-query").fill("度量")
    await slowPage.waitForFunction(
      () => document.querySelector(".command-results")?.textContent.includes("度量"),
      undefined,
      { timeout: 6000 },
    )
    check(
      "Delayed graph and recommendations do not block Chinese command search",
      heldRoutes.some((url) => url.endsWith("knowledgeGraph3d.js")) &&
        heldRoutes.some((url) => url.endsWith("semantic.json")),
      heldRoutes,
    )
    const result = slowPage.locator('.command-results a[data-object-id^="a-"]').first()
    const target = await result.getAttribute("data-object-id")
    const object = index.objects.find((object) => object.id === target)
    if (!object) throw new Error("Delayed-resource search lacks a canonical atom result")
    await result.click()
    await waitReading(slowPage, object)
    check(
      "Delayed graph and recommendations do not block complete atom reading",
      new URL(slowPage.url()).pathname === new URL(object.href, base).pathname &&
        (await slowPage.locator(".space-body .markdown-content").innerText()).length > 50,
    )
    await screenshot(slowPage, "optional-resources-delayed-reading")
  } finally {
    releaseOptional()
    await slowPage.unrouteAll({ behavior: "wait" })
    await slowContext.close()
  }
  fallbackBrowser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
    args: ["--disable-webgl"],
  })
  const fallbackPage = await fallbackBrowser.newPage({ viewport: { width: 390, height: 844 } })
  fallbackPage.on("pageerror", (error) =>
    report.errors.push({ scenario: "webgl-disabled", message: error.message }),
  )
  await fallbackPage.goto(new URL("explore.html", base).href, { waitUntil: "networkidle" })
  await fallbackPage.waitForFunction(
    (selector) => document.querySelector(selector)?.dataset.renderer === "fallback",
    mapSelector,
  )
  check(
    "A browser without WebGL uses actual fallback rather than a fake canvas",
    (await graph(fallbackPage).locator("button[data-kg-scope]").filter({ visible: true }).count()) >
      0,
  )
  await enterChapter(fallbackPage)
  const fallbackLink = graph(fallbackPage)
    .locator("a[data-knowledge-id]")
    .filter({ visible: true })
    .first()
  await fallbackLink.click()
  await fallbackPage.locator(".space-body .markdown-content").waitFor()
  check(
    "WebGL-disabled fallback still opens real Markdown reading",
    (await fallbackPage.locator(".space-body").innerText()).length > 50,
  )
  await screenshot(fallbackPage, "webgl-disabled-reading")
} catch (error) {
  report.errors.push({ stage: "setup-or-fallback", message: error.stack })
  console.error(error)
} finally {
  await browser?.close()
  await fallbackBrowser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((entry) => entry.passed).length
  report.failed = report.checks.filter((entry) => !entry.passed).length + report.errors.length
  await writeFile(
    path.join(root, `artifacts/three-${report.mode}-report.json`),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(
    JSON.stringify({
      passed: report.passed,
      failed: report.failed,
      screenshots: report.screenshots.length,
    }),
  )
  if (report.failed) process.exitCode = 1
}
