import { chromium } from "playwright"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { startPreview } from "./preview.mjs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const index = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"))
const atom =
  index.objects.find((o) => o.kind === "atom" && o.title.includes("连续性的三种刻画")) ??
  index.objects.find((o) => o.kind === "atom" && o.type === "definition")
const source = index.objects.find((o) => o.id === `note:${atom.sourceSlug}`)
const secondAtom =
  index.objects.find(
    (o) =>
      o.kind === "atom" &&
      o.id !== atom.id &&
      o.type === "proof" &&
      o.occurrences?.some((p) => p.slug === atom.sourceSlug),
  ) ??
  index.objects.find(
    (o) =>
      o.kind === "atom" &&
      o.id !== atom.id &&
      o.occurrences?.some((p) => p.slug === atom.sourceSlug),
  )
if (!atom || !source || !secondAtom)
  throw new Error(
    "The published snapshot must supply an atom, its source note and a second atom for the real reading journey.",
  )
const report = {
  startedAt: new Date().toISOString(),
  mode: process.env.SPATIAL_SITE_URL ? "live" : "local",
  proxyConfigured: Boolean(process.env.BROWSER_PROXY),
  checks: [],
  screenshots: [],
  errors: [],
  notRun: [],
  methods: [
    "Real generated /World/ pages in headless Edge",
    "Playwright mouse, keyboard and DOM scroll observations",
    "720 CSS-pixel reflow equivalent to half-width at 200% zoom; not native browser zoom",
    "Separately double computed text sizes without overriding KaTeX internal fonts",
  ],
}
const publishedNotes = index.objects.filter((object) => object.kind === "note")
let footnoteNote
for (const note of publishedNotes) {
  const html = await readFile(path.join(root, "public", note.href), "utf8")
  if (html.includes("data-footnote-ref")) {
    footnoteNote = note
    break
  }
}
if (!footnoteNote)
  report.notRun.push(
    "真实笔记脚注往返：当前公开索引内所有完整笔记均没有脚注引用，因此本轮未运行真实笔记脚注点击；不使用伪造正文填补验收。",
  )
const check = (pass, name, detail) => {
  report.checks.push({ name, pass: !!pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`)
}
await mkdir(path.join(root, "artifacts/screenshots"), { recursive: true })
const preview = process.env.SPATIAL_SITE_URL ? undefined : await startPreview({ port: 0 })
const base = process.env.SPATIAL_SITE_URL ?? `${preview.url}/World/`
const browser = await chromium.launch({
  channel: "msedge",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
const snapshot = async (page, name) => {
  const file = path.join(root, "artifacts/screenshots", `spatial-${report.mode}-${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  report.screenshots.push(file)
}
const waitObject = async (page, object) => {
  await page.waitForFunction(
    (title) =>
      document.querySelector("[data-space-title]")?.textContent === title &&
      document.querySelector("[data-space-status]")?.textContent === "" &&
      !!document.querySelector(".space-body .markdown-content"),
    object.title,
  )
  await page.evaluate(() => document.fonts.ready)
}
const selectorFor = (id) => `[data-object-id=${JSON.stringify(id)}]`
const readingScroll = (page) =>
  page.evaluate(
    () =>
      document.querySelector(
        matchMedia("(max-width: 1150px)").matches ? ".space-layout" : ".space-focus",
      ).scrollTop,
  )
const activeObject = (page) =>
  page.evaluate(
    () =>
      document.activeElement?.getAttribute("data-object-id") ??
      document.activeElement?.getAttribute("data-atom-id"),
  )

async function verifyMapReload(page, width) {
  const graph = page.locator("[data-knowledge-map].knowledge-map").first()
  await graph.locator(".kg-group-list-item").first().click()
  const groupName = await graph.locator(".kg-current").innerText()
  const objectCount = await graph.locator(".kg-list-item").count()
  const camera = () =>
    graph.locator(".kg-viewport").evaluate((e) => {
      const m = e.transform.baseVal.consolidate().matrix
      return { x: m.e, y: m.f, k: Math.hypot(m.a, m.b) }
    })
  let before
  if (width > 600) {
    await graph.getByRole("button", { name: "放大地图", exact: true }).click()
    await graph.locator(".kg-svg").focus()
    await page.keyboard.press("ArrowRight")
    before = await camera()
  }
  await page.reload()
  await graph.locator(".kg-list-item").first().waitFor()
  check(
    (await graph.locator(".kg-current").innerText()) === groupName &&
      (await graph.locator(".kg-list-item").count()) === objectCount,
    `${width}: 刷新探索页保留已进入章节与对象列表`,
  )
  if (before) {
    const after = await camera()
    check(
      Math.abs(before.x - after.x) < 0.01 &&
        Math.abs(before.y - after.y) < 0.01 &&
        Math.abs(before.k - after.k) < 0.001,
      `${width}: 刷新探索页保留缩放与平移后的地图镜头`,
      { before, after },
    )
  }
}

async function verifyReadingJourney(page, context, width) {
  // Begin at an ordinary complete source note, where the browser already has a reading position.
  await page.goto(new URL(source.href, base).href)
  await page.locator("#article-content .page-atoms").waitFor()
  await page.evaluate(() => document.fonts.ready)
  const sourceLink = page.locator(`#article-content .page-atoms a${selectorFor(atom.id)}`).first()
  await page.locator("#article-content .page-atoms > summary").click()
  await sourceLink.scrollIntoViewIfNeeded()
  await sourceLink.focus()
  await page.locator(".atom-preview:not([hidden])").waitFor()
  check(
    (await page.locator(".atom-preview h3").innerText()) === atom.title,
    `${width}: 键盘聚焦原子链接显示对应预览`,
  )
  check(
    (await page.locator(".atom-preview math").count()) > 0 &&
      (await page.locator(".atom-preview-relations").innerText()).includes("已登记联系"),
    `${width}: 键盘预览包含公式与真实联系说明`,
  )
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  )
  const previewBounds = await page.locator(".atom-preview").boundingBox()
  const viewport = page.viewportSize()
  check(
    previewBounds &&
      previewBounds.x >= 8 &&
      previewBounds.x + previewBounds.width <= viewport.width - 8 &&
      previewBounds.y >= 8 &&
      previewBounds.y + previewBounds.height <= viewport.height - 8,
    `${width}: 知识预览完整落在视口内`,
    previewBounds,
  )
  await snapshot(page, `${width}-keyboard-preview`)
  await page.keyboard.press("Escape")
  check(
    (await page.locator(".atom-preview").evaluate((e) => e.hidden)) &&
      (await sourceLink.evaluate((e) => e === document.activeElement)),
    `${width}: 关闭预览保留链接焦点`,
  )
  const baseUrl = page.url()
  const outerScroll = await page.evaluate(() => scrollY)
  if (width === 1440) {
    const popupEvent = context.waitForEvent("page")
    await sourceLink.click({ modifiers: ["Control"] })
    const popup = await popupEvent
    await popup.waitForLoadState("domcontentloaded")
    await waitObject(popup, atom)
    check(
      page.url() === baseUrl && new URL(popup.url()).pathname.endsWith(atom.href),
      "1440: Ctrl 点击原子保留原阅读页并打开真实独立标签",
    )
    await popup.close()
    await page.bringToFront()
    await sourceLink.focus()
  }
  await page.keyboard.press("Enter")
  await waitObject(page, atom)
  await page.goBack()
  await page.locator(".knowledge-space[hidden]").waitFor({ state: "attached" })
  check(
    page.url() === baseUrl && Math.abs((await page.evaluate(() => scrollY)) - outerScroll) <= 3,
    `${width}: 从原文打开原子后后退恢复原文地址与滚动位置`,
  )
  check(
    await sourceLink.evaluate((e) => e === document.activeElement),
    `${width}: 后退将键盘焦点还给原文入口`,
  )

  // Open, follow the complete source, then select a different object from that note.
  await sourceLink.focus()
  await page.keyboard.press("Enter")
  await waitObject(page, atom)
  const sourceInAside = page.locator(`[data-space-notes] a${selectorFor(source.id)}`).first()
  await sourceInAside.click()
  await waitObject(page, source)
  const atomList = page.locator(".space-body .page-atoms")
  if (!(await atomList.evaluate((e) => e.open))) await atomList.locator(":scope > summary").click()
  const next = atomList.locator(`a${selectorFor(secondAtom.id)}`).first()
  await next.scrollIntoViewIfNeeded()
  await next.focus()
  // Reading with the wheel leaves keyboard focus on its link, as it does in a real browser.
  // This makes the history check exercise a nonzero position, not merely two page tops.
  const pane = page.locator(width <= 1150 ? ".space-layout" : ".space-focus")
  const paneBox = await pane.boundingBox()
  await page.mouse.move(paneBox.x + 4, paneBox.y + Math.min(300, paneBox.height / 2))
  await page.mouse.wheel(0, 360)
  await page.waitForFunction(
    () =>
      document.querySelector(
        matchMedia("(max-width: 1150px)").matches ? ".space-layout" : ".space-focus",
      ).scrollTop > 100,
  )
  const notePosition = await readingScroll(page)
  check(
    notePosition > 100 && (await activeObject(page)) === secondAtom.id,
    `${width}: 实际滚动完整正文后仍可用键盘进入原子`,
    { scroll: notePosition },
  )
  await page.keyboard.press("Enter")
  await waitObject(page, secondAtom)
  check(
    (await page.locator("[data-space-trail]").innerText()).includes(atom.title) &&
      (await page.locator("[data-space-trail]").innerText()).includes(source.title),
    `${width}: 原子→完整笔记→另一原子的来路连续保留`,
  )
  const secondUrl = page.url()
  await page.goBack()
  await waitObject(page, source)
  check(
    Math.abs((await readingScroll(page)) - notePosition) <= 3,
    `${width}: 多层后退恢复完整笔记中的阅读位置`,
    { expected: notePosition, actual: await readingScroll(page) },
  )
  check(
    (await activeObject(page)) === secondAtom.id,
    `${width}: 多层后退恢复所选原子的链接焦点`,
    await activeObject(page),
  )
  check(
    await page.locator(".space-body .page-atoms").evaluate((e) => e.open),
    `${width}: 多层后退保留知识对象目录展开状态`,
  )
  await page.goForward()
  await waitObject(page, secondAtom)
  check(page.url() === secondUrl, `${width}: 浏览器前进回到第二个原子`)
  await page.reload()
  await waitObject(page, secondAtom)
  check(page.url() === secondUrl, `${width}: 刷新后的独立原子仍可读`)
  const response = await context.request.get(secondUrl)
  check(
    response.status() === 200 && (await response.text()).includes(secondAtom.id),
    `${width}: 当前原子地址在服务器上确实存在`,
  )

  // Close a chain without a reload first, so the original live focus target must remain intact.
  await page.goto(new URL(source.href, base).href)
  await page.locator("#article-content .page-atoms > summary").waitFor()
  await page.locator("#article-content .page-atoms > summary").click()
  const original = page.locator(`#article-content .page-atoms a${selectorFor(atom.id)}`).first()
  await original.scrollIntoViewIfNeeded()
  await original.focus()
  const closingPosition = await page.evaluate(() => scrollY)
  await page.keyboard.press("Enter")
  await waitObject(page, atom)
  await page
    .locator(`[data-space-notes] a${selectorFor(source.id)}`)
    .first()
    .click()
  await waitObject(page, source)
  await page.locator("[data-space-close]").click()
  await page.locator(".knowledge-space[hidden]").waitFor({ state: "attached" })
  check(
    page.url() === baseUrl && Math.abs((await page.evaluate(() => scrollY)) - closingPosition) <= 3,
    `${width}: 关闭连续探索回到起始原文与阅读位置`,
  )
  check(
    await original.evaluate((e) => e === document.activeElement),
    `${width}: 关闭连续探索恢复起始入口焦点`,
  )
}

async function verifyEnlargedReading(page) {
  await page.goto(new URL(source.href, base).href)
  await page.locator("#article-content .page-atoms > summary").waitFor()
  await page.locator("#article-content .page-atoms > summary").click()
  await page
    .locator(`#article-content .page-atoms a${selectorFor(atom.id)}`)
    .first()
    .click()
  await waitObject(page, atom)
  await page.setViewportSize({ width: 720, height: 500 })
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) &&
      (await page.locator(".space-body").evaluate((e) => e.scrollWidth <= e.clientWidth + 1)),
    "720px 重排：阅读页与正文不横向溢出（非原生浏览器缩放）",
  )
  const controlBounds = await page.locator("[data-space-close]").boundingBox()
  check(
    controlBounds &&
      controlBounds.x >= 0 &&
      controlBounds.x + controlBounds.width <= 721 &&
      controlBounds.y >= 0,
    "720px 重排：关闭与返回操作保持可见",
  )
  await snapshot(page, "1440-equivalent-reflow-720")
  await page.setViewportSize({ width: 1440, height: 1000 })
  const textSize = await page.evaluate(() => {
    const selectors =
      ".knowledge-space p,.knowledge-space li,.knowledge-space h2,.knowledge-space h3,.knowledge-space h4,.knowledge-space button,.knowledge-space summary,.knowledge-space .space-topbar a"
    const items = [...document.querySelectorAll(selectors)].filter((e) => !e.closest(".katex"))
    const sizes = items.map((e) => [e, parseFloat(getComputedStyle(e).fontSize)])
    const sample = document.querySelector(".space-body p")
    const before = parseFloat(getComputedStyle(sample).fontSize)
    for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
    return { before, after: parseFloat(getComputedStyle(sample).fontSize) }
  })
  check(
    Math.abs(textSize.after / textSize.before - 2) < 0.01,
    "正文文本实际放大到200%，KaTeX 内部字体未覆写",
    textSize,
  )
  check(
    (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)) &&
      (await page.locator(".space-body").evaluate((e) => e.scrollWidth <= e.clientWidth + 1)),
    "200% 文本：阅读容器保持收缩，长公式局部滚动",
  )
  check((await page.locator(".space-body math").count()) > 0, "200% 文本：数学公式和MathML仍然存在")
  await snapshot(page, "1440-text-200")
}

async function verifyBookContinuity(page, width) {
  const section = (number) =>
    publishedNotes.find((note) => note.type === "reading" && note.title.startsWith(`${number} `))
  const metric = section("1.2")
  if (!metric) throw new Error("Published 1.2 reading section missing")
  await page.goto(base)
  await page.locator(".shelf-enter").first().click()
  await page.locator("#chapter-readings .section-reading-link").first().waitFor()
  const metricLink = page
    .locator("#chapter-readings .section-reading-link")
    .filter({ has: page.locator(".section-number", { hasText: /^1\.2$/ }) })
    .first()
  await metricLink.click()
  await waitObject(page, metric)
  check(
    (await page.locator(".space-body").innerText()).includes("度量"),
    `${width}: 从书架经书籍目录直接进入1.2正文`,
  )
  check(
    (await page.locator(`.space-body .page-atoms a${selectorFor(atom.id)}`).count()) === 1,
    `${width}: 按书阅读与探索引用同一个连续性原子`,
  )
  check(
    (await page.evaluate(() =>
      document.getAnimations().every((animation) => animation.playState !== "running"),
    )) && (await page.locator(".space-opening-frame").count()) === 0,
    `${width}: 减少动画模式没有运行中的进入动画或残留过渡框`,
  )

  const heading = page.locator(".space-body a[data-space-anchor]").last()
  if (await heading.count()) {
    const targetId = decodeURIComponent((await heading.getAttribute("href")).slice(1))
    const originalWindowScroll = await page.evaluate(() => scrollY)
    await heading.click()
    const target = page.locator(`.space-body [id=${JSON.stringify(targetId)}]`)
    const targetBounds = await target.boundingBox()
    const paneBounds = await page
      .locator(width <= 1150 ? ".space-layout" : ".space-focus")
      .boundingBox()
    check(
      targetBounds &&
        targetBounds.y >= paneBounds.y - 2 &&
        targetBounds.y < paneBounds.y + paneBounds.height &&
        (await readingScroll(page)) > 100,
      `${width}: 正文标题锚点在当前阅读栏内定位`,
    )
    check(
      (await page.evaluate(() => scrollY)) === originalWindowScroll &&
        !new URL(page.url()).hash.startsWith("#space-"),
      `${width}: 标题定位保留原文可分享锚点且不滚动背景页`,
    )
  } else check(false, `${width}: 1.2正文应提供标题定位锚点`)

  for (const [fromNumber, toNumber] of [
    ["1.8", "2.1"],
    ["2.8", "3.1"],
  ]) {
    const from = section(fromNumber),
      to = section(toNumber)
    if (!from || !to) throw new Error(`Continuous sections ${fromNumber}/${toNumber} missing`)
    await page.goto(new URL(from.href, base).href)
    const next = page.locator("#article-content .reading-sequence a[rel=next]")
    await next.waitFor()
    check(
      (await next.innerText()).includes(to.title),
      `${width}: ${fromNumber}下一节明确指向${toNumber}`,
    )
    await next.click()
    await waitObject(page, to)
    check(
      new URL(page.url()).pathname === new URL(to.href, base).pathname,
      `${width}: ${fromNumber}→${toNumber}跨章连续阅读成功`,
    )
    const previous = page.locator(".space-body .reading-sequence a[rel=prev]")
    await previous.click()
    await waitObject(page, from)
    check(
      (await page.locator("[data-space-title]").innerText()) === from.title,
      `${width}: ${toNumber}上一节可返回${fromNumber}`,
    )
  }
}

async function verifyNormalMotion() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "no-preference",
  })
  const page = await context.newPage()
  page.on("pageerror", (error) =>
    report.errors.push({ width: 1440, motion: "normal", message: error.message }),
  )
  await page.goto(new URL(source.href, base).href)
  await page.locator("#article-content .page-atoms > summary").waitFor()
  await page.locator("#article-content .page-atoms > summary").click()
  await page
    .locator(`#article-content .page-atoms a${selectorFor(atom.id)}`)
    .first()
    .click()
  await page.waitForFunction(
    () =>
      !!document.querySelector(".space-opening-frame") &&
      document.getAnimations().some((animation) => animation.playState === "running"),
    undefined,
    { timeout: 5000 },
  )
  check(
    await page.evaluate(() =>
      document
        .getAnimations()
        .every((animation) => animation.effect?.getTiming().iterations !== Infinity),
    ),
    "普通动画模式：实际触发有限次数的对象进入过渡",
  )
  await waitObject(page, atom)
  await page.waitForFunction(
    () =>
      document.getAnimations().every((animation) => animation.playState !== "running") &&
      !document.querySelector(".space-opening-frame"),
  )
  check(
    (await page.locator(".space-opening-frame").count()) === 0,
    "普通动画模式：过渡结束后移除共享外框，没有持续运动",
  )
  await context.close()
}
try {
  for (const [width, height] of [
    [1440, 1000],
    [1024, 900],
    [390, 844],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    })
    const page = await context.newPage()
    const requests = []
    page.on("request", (r) => requests.push(r.url()))
    page.on("pageerror", (e) => report.errors.push({ width, message: e.message }))
    await page.goto(base)
    await page.locator("[data-space-command]").first().waitFor()
    await page.waitForFunction(
      () => document.querySelector(".knowledge-space")?.dataset.ready === "true",
    )
    await page.locator(".spatial-entry").waitFor()
    check(
      (await page.locator(".spatial-entry a").count()) === 2,
      `${width}: 首页提供阅读与探索双入口`,
    )
    await snapshot(page, `${width}-home`)
    await page.locator(".spatial-entry a").nth(1).click()
    await page.locator(".knowledge-map").waitFor()
    check(page.url().includes("explore.html"), `${width}: 探索页为可直接访问的静态地址`)
    await snapshot(page, `${width}-explore`)
    await verifyMapReload(page, width)
    await page.keyboard.press("Control+k")
    await page.locator(".knowledge-command[open]").waitFor()
    await page.locator("#knowledge-query").fill("度量")
    await page.waitForFunction(() => document.querySelectorAll(".command-results li").length > 0)
    check(
      (await page.locator(".command-results").innerText()).includes("度量"),
      `${width}: 中文概念搜索`,
    )
    check(
      !(await page.locator(".command-results").innerText()).includes("附属资料"),
      `${width}: 默认结果不混入附属资料`,
    )
    await page.locator("#knowledge-query").fill("compactness")
    await page.waitForFunction(() => document.querySelectorAll(".command-results li").length > 0)
    check(
      (await page.locator(".command-results").innerText()).toLowerCase().includes("compact"),
      `${width}: 英文术语搜索`,
    )
    await page.locator("#knowledge-query").fill("\\forall")
    await page.waitForFunction(() => document.querySelectorAll(".command-results li").length > 0)
    check((await page.locator(".command-results li").count()) > 0, `${width}: LaTeX 符号检索`)
    await snapshot(page, `${width}-search`)
    await page.keyboard.press("Escape")
    check(
      !(await page.locator(".knowledge-command").evaluate((e) => e.open)),
      `${width}: Escape 关闭搜索`,
    )
    await page.goto(new URL(atom.href, base).href)
    await page.locator(".knowledge-space:not([hidden]) .space-body .markdown-content").waitFor()
    check(
      (await page.locator("[data-space-title]").innerText()) === atom.title,
      `${width}: 原子独立地址载入正确对象`,
    )
    check((await page.locator(".space-body math").count()) > 0, `${width}: 原子正文保留 MathML`)
    await snapshot(page, `${width}-atom`)
    const oldUrl = page.url()
    const noteLink = page
      .locator(`[data-space-notes] a[data-object-id="${source.id.replaceAll('"', '\\"')}"]`)
      .first()
    await noteLink.click()
    await page.waitForFunction(
      (title) =>
        document.querySelector("[data-space-title]")?.textContent === title &&
        document.querySelector("[data-space-status]")?.textContent === "",
      source.title,
    )
    check(
      page.url() !== oldUrl && page.url().includes(".html"),
      `${width}: 相关笔记成为焦点并更新地址`,
    )
    check(
      (await page.locator("[data-space-trail]").innerText()).includes(atom.title),
      `${width}: 前一个原子留在探索来路`,
    )
    await snapshot(page, `${width}-note`)
    await page.goBack()
    await page.waitForFunction(
      (title) =>
        document.querySelector("[data-space-title]")?.textContent === title &&
        document.querySelector("[data-space-status]")?.textContent === "",
      atom.title,
    )
    check(page.url() === oldUrl, `${width}: 浏览器后退恢复原子地址`)
    await page.reload()
    await page.locator(".space-body .markdown-content").waitFor()
    check(
      (await page.locator("[data-space-title]").innerText()) === atom.title,
      `${width}: 刷新保留当前对象`,
    )
    check(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `${width}: 页面没有横向溢出`,
    )
    check(
      await page.locator(".space-body").evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      `${width}: 阅读栏没有横向溢出`,
    )
    await page.getByRole("button", { name: "局部地图", exact: true }).click()
    await page.locator("[data-space-local-map].knowledge-map").waitFor()
    await snapshot(page, `${width}-local-map`)
    await page.getByRole("button", { name: "收起地图", exact: true }).click()
    check(
      !requests.some((u) => /huggingface.co|\.onnx|api\.openai|localhost:11434/.test(u)),
      `${width}: 默认阅读不请求模型或账号服务`,
    )
    await page.keyboard.press("Control+k")
    await page.locator("#knowledge-query").fill("a_nonexistent_math_9328471")
    check((await page.locator(".command-results li").count()) === 0, `${width}: 无结果状态`)
    await page.keyboard.press("Escape")
    await verifyReadingJourney(page, context, width)
    if (width === 1440) await verifyEnlargedReading(page)
    await verifyBookContinuity(page, width)
    await context.close()
  }
  await verifyNormalMotion()
  if (preview) {
    for (const mount of ["/", "/math-notes/"]) {
      const page = await browser.newPage()
      const response = await page.goto(new URL(atom.href, preview.url + mount).href)
      await page.locator(".space-body .markdown-content").waitFor()
      check(response.status() === 200, `${mount}: 原子页面真实静态响应`)
      check(
        (await page.locator("[data-space-title]").innerText()) === atom.title,
        `${mount}: 资源与内容子路径兼容`,
      )
      await page.close()
    }
  }
} catch (error) {
  report.errors.push({ message: error.stack })
  console.error(error)
  process.exitCode = 1
} finally {
  check(report.errors.length === 0, "没有页面脚本或浏览器流程错误", report.errors)
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((c) => c.pass).length
  report.failed = report.checks.length - report.passed
  await writeFile(
    path.join(root, `artifacts/spatial-${report.mode}-report.json`),
    JSON.stringify(report, null, 2),
  )
  console.log(`Spatial checks: ${report.passed} passed, ${report.failed} failed`)
  if (report.failed) process.exitCode = 1
  await browser.close()
  await preview?.close()
}
