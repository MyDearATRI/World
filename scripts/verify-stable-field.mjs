import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.STABLE_OUTPUT ?? "artifacts/stable-field/accepted")
const cases = process.env.STABLE_CASES?.split(",") ?? [
  "notes-1440",
  "notes-1024",
  "notes-390",
  "atlas-1440",
  "atlas-1024",
  "atlas-390",
  "fallback-390",
]
await mkdir(output, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
  scenes: [],
  screenshots: [],
  limits: [
    "Normal-motion headless Edge, mobile simulated touch, no physical-device claim.",
    "New information/stability requirements; previous performance PASS is not reused.",
    "Titles may extend vertically and require scrolling. The test forbids clipping/overlap, not normal vertical reading.",
  ],
}
report.scriptSha256 = createHash("sha256")
  .update(await readFile(new URL(import.meta.url)))
  .digest("hex")
const payloads = Object.fromEntries(
  await Promise.all(
    ["notes", "atlas"].map(async (mode) => [
      mode,
      JSON.parse(
        await readFile(`public/static/topos/${mode === "notes" ? "index" : "atlas"}.json`, "utf8"),
      ),
    ]),
  ),
)
const preview = process.env.STABLE_BASE ? undefined : await startPreview({ port: 0 })
const base = process.env.STABLE_BASE ?? `${preview.url}/World/`
report.base = base
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: !!passed, evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const shot = async (page, name) => {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
const snap = (page) => page.evaluate(() => window.__topos.snapshot())
const selector = (attribute, id) => `[${attribute}=${JSON.stringify(id)}]`
const equalIDs = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())
const overview = (page) =>
  page.waitForFunction(
    () =>
      window.__topos?.snapshot().overview?.visible &&
      document.querySelector("#topos-world")?.dataset.overview === "true",
    null,
    { timeout: 8000 },
  )

async function titles(page, kind = "overview") {
  return page.evaluate((kind) => {
    const world = document.querySelector("#topos-world").getBoundingClientRect(),
      obstacles =
        kind === "field"
          ? [
              ...document.querySelectorAll(
                ".topos-instruments,.topos-utility,.topos-identity,.topos-guide,.topos-status,.topos-topics-trigger",
              ),
            ]
              .filter((e) => {
                const s = getComputedStyle(e)
                return e.checkVisibility() && Number(s.opacity) > 0.1
              })
              .map((e) => ({
                name: e.className,
                rect: e.getBoundingClientRect(),
              }))
          : []
    const nodes =
      kind === "overview"
        ? [...document.querySelectorAll("[data-overview-node] .overview-node-title")]
        : [...document.querySelectorAll("a[data-concept] .concept-title")]
    const items = nodes
      .map((el) => {
        const owner = el.closest(kind === "overview" ? "[data-overview-node]" : "a[data-concept]"),
          style = getComputedStyle(owner),
          ts = getComputedStyle(el)
        const box = el.getBoundingClientRect(),
          container = owner.getBoundingClientRect()
        const range = document.createRange()
        range.selectNodeContents(el)
        const lines = [...range.getClientRects()]
          .filter((r) => r.width && r.height)
          .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }))
        const visible =
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          Number(style.opacity) >= 0.3 &&
          ts.visibility !== "hidden" &&
          box.width > 0 &&
          box.height > 0
        const coveredBy = obstacles
          .filter(({ rect }) =>
            lines.some(
              (line) =>
                Math.min(line.x + line.width, rect.right) - Math.max(line.x, rect.left) > 1 &&
                Math.min(line.y + line.height, rect.bottom) - Math.max(line.y, rect.top) > 1,
            ),
          )
          .map((o) => o.name)
        const insideWorld = lines.every(
          (r) =>
            r.x >= Math.max(0, world.left) &&
            r.x + r.width <= Math.min(innerWidth, world.right) &&
            r.y >= Math.max(0, world.top) &&
            r.y + r.height <= Math.min(innerHeight, world.bottom),
        )
        const full =
          el.textContent.trim().length > 0 &&
          el.scrollWidth <= el.clientWidth + 1 &&
          el.scrollHeight <= el.clientHeight + 1 &&
          lines.every((r) => r.x >= container.x - 1 && r.x + r.width <= container.right + 1) &&
          (kind === "overview" || (insideWorld && coveredBy.length === 0))
        return {
          id: owner.dataset.overviewNode ?? owner.dataset.concept,
          text: el.textContent,
          visible,
          full,
          insideWorld,
          coveredBy,
          box: { x: box.x, y: box.y, width: box.width, height: box.height },
          lines,
          clip: ts.textOverflow,
        }
      })
      .filter((t) => t.visible)
    const overlaps = []
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++) {
        if (
          items[i].lines.some((a) =>
            items[j].lines.some(
              (b) =>
                Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
                Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 1,
            ),
          )
        )
          overlaps.push([items[i].id, items[j].id])
      }
    return { items, overlaps }
  }, kind)
}
function drift(a, b) {
  const byID = new Map(a.nodes.map((n) => [n.id, n]))
  const diffs = b.nodes
    .filter((n) => byID.has(n.id))
    .map((n) => {
      const old = byID.get(n.id)
      return {
        id: n.id,
        world: Math.hypot(n.x - old.x, n.y - old.y, n.z - old.z),
        screen: Math.hypot(n.screenX - old.screenX, n.screenY - old.screenY),
      }
    })
  return {
    frames: b.frame - a.frame,
    worldMax: Math.max(0, ...diffs.map((n) => n.world)),
    screenMax: Math.max(0, ...diffs.map((n) => n.screen)),
    nodes: diffs,
  }
}
async function stationary(page, record, stage) {
  await page.waitForTimeout(2000)
  const at2 = await snap(page),
    names2 = await titles(page, at2.overview ? "overview" : "field")
  await page.waitForTimeout(3000)
  const at5 = await snap(page),
    names5 = await titles(page, at5.overview ? "overview" : "field")
  const motion = drift(at2, at5),
    oldNames = new Map(names2.items.map((t) => [t.id, t]))
  const titleMax = Math.max(
    0,
    ...names5.items
      .filter((t) => oldNames.has(t.id))
      .map((t) =>
        Math.hypot(t.box.x - oldNames.get(t.id).box.x, t.box.y - oldNames.get(t.id).box.y),
      ),
  )
  record[stage] = { at2, at5, motion, titleMax }
  check(
    `${record.name} ${stage}: stationary after 2s`,
    motion.worldMax <= 0.1 && motion.screenMax <= 0.5 && titleMax <= 0.5,
    { ...motion, nodes: undefined, titleMax },
  )
  check(
    `${record.name} ${stage}: no continuing render loop`,
    at2.settled && at5.settled && motion.frames === 0,
    { settled2: at2.settled, settled5: at5.settled, frames: motion.frames },
  )
}
async function visitPages(page, expected, record, label) {
  const seen = [],
    pageEvidence = []
  let safeguard = 0
  while (true) {
    const state = await snap(page),
      visible = await page
        .locator("[data-overview-node]")
        .evaluateAll((es) => es.map((e) => e.dataset.overviewNode)),
      names = await titles(page)
    pageEvidence.push({ page: state.overview.view.page, ids: visible, names })
    seen.push(...visible)
    check(
      `${record.name} ${label} page ${state.overview.view.page + 1}: full names without collision`,
      visible.length === names.items.length &&
        names.items.every((t) => t.full) &&
        names.overlaps.length === 0,
      {
        names: names.items.length,
        items: visible.length,
        invalid: names.items.filter((t) => !t.full),
        overlaps: names.overlaps,
      },
    )
    if (await page.locator('[data-overview-page="next"]').isDisabled()) break
    if (++safeguard > 60) throw new Error("Pagination did not terminate")
    await page.locator('[data-overview-page="next"]').click()
  }
  check(
    `${record.name} ${label}: every selected ID appears exactly once across pages`,
    equalIDs(seen, expected) && new Set(seen).size === seen.length,
    {
      expected: expected.length,
      seen: seen.length,
      unique: new Set(seen).size,
      missing: expected.filter((id) => !seen.includes(id)),
    },
  )
  record[label] = pageEvidence
}

try {
  for (const name of cases) {
    const [modeText, widthText] = name.split("-"),
      mode = modeText === "fallback" ? "notes" : modeText,
      width = Number(widthText),
      mobile = width === 390,
      model = payloads[mode].model
    const record = { name, viewport: { width, height: mobile ? 844 : width === 1024 ? 900 : 1000 } }
    report.scenes.push(record)
    const context = await browser.newContext({
      viewport: record.viewport,
      isMobile: mobile,
      hasTouch: mobile,
      reducedMotion: "no-preference",
    })
    if (modeText === "fallback")
      await context.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          if (["webgl", "webgl2", "experimental-webgl"].includes(type)) return null
          return original.call(this, type, ...args)
        }
      })
    const page = await context.newPage(),
      cdp = await context.newCDPSession(page)
    let documents = 0
    page.on("request", (r) => {
      if (r.resourceType() === "document") documents++
    })
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    const showTopics = async () => {
      if (mobile) await page.locator(".topos-topics-trigger").click()
    }
    const closeTopics = async () => {
      if (mobile) await page.locator("[data-close-topics]").click()
    }
    try {
      await page.goto(new URL(mode === "notes" ? "topos.html" : "atlas.html", base).href, {
        waitUntil: "domcontentloaded",
      })
      await page.waitForFunction(
        () => document.querySelector("#topos-world")?.dataset.ready === "true",
      )
      await page.evaluate(() => document.fonts.ready)
      await page.evaluate(() => {
        window.__stableIdentity = {
          canvas: document.querySelector("#topos-canvas"),
          world: document.querySelector("#topos-world"),
        }
      })
      const topics =
        mode === "notes"
          ? ["topology", "foundations"]
          : ["math.region.analysis-pde", "math.region.geometry"]
      const expected = (selection) =>
        model.concepts
          .filter((n) => n.topicIDs?.some((id) => selection.includes(id)))
          .map((n) => n.id)
      await showTopics()
      await page.getByRole("button", { name: "清空", exact: true }).click()
      const start = Date.now()
      await page.locator(selector("data-topic", topics[0])).check()
      await closeTopics()
      await overview(page)
      record.entryMs = Date.now() - start
      check(
        `${name}: theme selection immediately exposes named overview`,
        record.entryMs < 1500 && (await page.locator("[data-overview-node]").count()) > 0,
        { entryMs: record.entryMs },
      )
      check(
        `${name}: unnamed horizon is absent from overview`,
        await page.evaluate(() => {
          const c = document.querySelector("#topos-canvas"),
            s = getComputedStyle(c)
          return (
            !c.checkVisibility() ||
            s.visibility === "hidden" ||
            s.display === "none" ||
            Number(s.opacity) === 0
          )
        }),
      )
      await shot(page, `${name}-single-topic-overview`)
      await stationary(page, record, "overviewIdle")
      await visitPages(page, expected([topics[0]]), record, "singleTopicPages")
      await showTopics()
      await page.locator(selector("data-topic", topics[1])).check()
      await closeTopics()
      await overview(page)
      await visitPages(page, expected(topics), record, "unionPages")
      const query = page.locator("[data-overview-query]"),
        kind = page.locator("[data-overview-kind]")
      for (const word of mode === "notes" ? ["度量", "compact"] : ["分析", "differential"]) {
        await query.fill(word)
        const found = await page.locator("[data-overview-node]").count()
        check(`${name}: real name query ${word} returns entries`, found > 0, { count: found })
      }
      await query.fill("__certainly_no_such_math_object_734__")
      check(
        `${name}: no-results state is explicit`,
        (await page.locator("[data-overview-node]").count()) === 0 &&
          (await page.locator(".overview-empty").isVisible()),
      )
      await query.fill("")
      await kind.selectOption(mode === "notes" ? "note" : "classification")
      if (!(await page.locator('[data-overview-page="next"]').isDisabled()))
        await page.locator('[data-overview-page="next"]').click()
      const saved = await snap(page),
        entry = saved.overview.visibleIDs[0]
      check(
        `${name}: actual type filter applies to every visible result`,
        saved.overview.visibleIDs.every((id) => {
          const c = model.concepts.find((c) => c.id === id)
          return mode === "notes" ? c.objectKind === "note" : c.mathType === "classification"
        }),
      )
      const relationEntry = saved.overview.visibleIDs.find((id) =>
        model.relations.some((r) => r.source === id || r.target === id),
      )
      if (relationEntry) {
        await page.locator(selector("data-overview-connections", relationEntry)).click()
        const rows = await page
          .locator("[data-overview-relation-row]")
          .evaluateAll((es) => es.map((e) => e.dataset.overviewRelationRow))
        const actual = model.relations
          .filter((r) => r.source === relationEntry || r.target === relationEntry)
          .map((r) => r.id)
        check(
          `${name}: readable relationship list uses only exact source edges`,
          equalIDs(rows, actual),
          { shown: rows.length, expected: actual.length },
        )
        const paths = await page.locator("path[data-overview-relation]").evaluateAll((es) =>
          es.map((e) => ({
            id: e.dataset.overviewRelation,
            source: e.dataset.source,
            target: e.dataset.target,
            provenance: e.dataset.provenance,
          })),
        )
        check(
          `${name}: drawn links preserve endpoints and provenance`,
          paths.every((p) =>
            model.relations.some(
              (r) =>
                r.id === p.id &&
                r.source === p.source &&
                r.target === p.target &&
                (r.provenance ?? "reference") === p.provenance,
            ),
          ),
          paths,
        )
      }
      const href = await page.locator(selector("data-overview-open", entry)).getAttribute("href")
      await page.locator(selector("data-overview-open", entry)).click()
      await page.waitForFunction(
        (id) => window.__topos.state.focus === id && !window.__topos.state.overview,
        entry,
      )
      await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
      check(
        `${name}: ordinary name activation opens original reading in the same scene`,
        documents === 1 &&
          (await page.evaluate(
            () =>
              window.__stableIdentity.canvas === document.querySelector("#topos-canvas") &&
              window.__stableIdentity.world === document.querySelector("#topos-world"),
          )),
        { documents, href },
      )
      await page.goBack()
      await overview(page)
      const restored = await snap(page)
      check(
        `${name}: Back restores type, query and page`,
        restored.overview.view.page === saved.overview.view.page &&
          restored.overview.view.query === saved.overview.view.query &&
          restored.overview.view.kind === saved.overview.view.kind,
        { before: saved.overview.view, after: restored.overview.view },
      )
      check(
        `${name}: Back restores focus to the same named entry`,
        await page.evaluate(
          (id) => document.activeElement?.getAttribute("data-overview-open") === id,
          entry,
        ),
        { entry },
      )
      await page.reload({ waitUntil: "domcontentloaded" })
      await overview(page)
      const refreshed = await snap(page)
      check(
        `${name}: overview state survives direct refresh`,
        refreshed.overview.view.page === saved.overview.view.page &&
          refreshed.overview.view.kind === saved.overview.view.kind &&
          refreshed.overview.view.query === saved.overview.view.query,
      )
      await page.locator("[data-overview-kind]").selectOption("all")
      const known = mode === "notes" ? "a-000067" : "math.region.analysis-pde",
        title = model.concepts.find((c) => c.id === known).title
      await page.locator("[data-overview-query]").fill(title)
      await page.locator(selector("data-overview-open", known)).click()
      await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
      if (mode === "notes")
        check(
          `${name}: formal source mathematics remains rendered`,
          (await page.locator('.topos-unfolding[data-active="true"] .katex').count()) > 0,
        )
      else
        check(
          `${name}: classification and verification limits remain explicit`,
          (await page.locator('.topos-unfolding[data-active="true"]').innerText()).includes("Lean"),
        )
      await page.waitForTimeout(700)
      await shot(page, `${name}-reading`)
      await page.locator('.topos-unfolding[data-active="true"] [data-fold]').click()
      await stationary(page, record, "fieldIdle")
      if (!mobile) {
        const before = await snap(page)
        for (let i = 0; i < 12; i++) {
          await page.mouse.move(
            before.nodes.find((n) => n.id === before.focus).screenX - 120 + i * 20,
            120 + (i % 2) * 20,
          )
          await page.waitForTimeout(40)
        }
        await page.waitForTimeout(300)
        const after = await snap(page),
          motion = drift(before, after)
        record.hover = motion
        check(
          `${name}: mouse movement does not shift or wake the field`,
          motion.worldMax <= 0.1 && motion.screenMax <= 0.5 && motion.frames === 0,
          { ...motion, nodes: undefined },
        )
      }
      const before = await snap(page),
        center = before.nodes.find((n) => n.id === before.focus)
      const startPoint = await page.evaluate(
        ({ x, y }) =>
          [
            [0, 0],
            [0, 8],
            [0, -8],
            [8, 0],
            [-8, 0],
          ]
            .map(([dx, dy]) => ({
              x: x + dx,
              y: y + dy,
              id: document.elementFromPoint(x + dx, y + dy)?.id,
            }))
            .find(
              (p) =>
                p.id === "topos-canvas" ||
                (p.id === "" &&
                  document.elementFromPoint(p.x, p.y)?.classList.contains("topos-flat-canvas")),
            ),
        { x: center.screenX, y: center.screenY },
      )
      if (!startPoint) throw new Error("Visible focus ball has no unobstructed canvas hit point")
      const neighbor = before.nodes
        .filter(
          (n) =>
            n.id !== before.focus &&
            before.presentedIDs.includes(n.id) &&
            n.screenX > 20 &&
            n.screenX < width - 20 &&
            n.screenY > 100 &&
            n.screenY < record.viewport.height - 170,
        )
        .sort(
          (a, b) =>
            Math.hypot(a.screenX - center.screenX, a.screenY - center.screenY) -
            Math.hypot(b.screenX - center.screenX, b.screenY - center.screenY),
        )[0]
      const target = neighbor
        ? { x: neighbor.screenX, y: neighbor.screenY }
        : { x: startPoint.x + (mobile ? 65 : 120), y: startPoint.y + 35 }
      if (mobile)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: startPoint.x, y: startPoint.y, id: 1 }],
        })
      else {
        await page.mouse.move(startPoint.x, startPoint.y)
        await page.mouse.down()
      }
      for (let i = 1; i <= 18; i++) {
        const x = startPoint.x + ((target.x - startPoint.x) * i) / 18,
          y = startPoint.y + ((target.y - startPoint.y) * i) / 18
        if (mobile)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y, id: 1 }],
          })
        else await page.mouse.move(x, y)
        await page.waitForTimeout(25)
      }
      const held = await snap(page),
        heldNames = await titles(page, "field")
      const moved = held.nodes.find((n) => n.id === before.focus)
      check(
        `${name}: drag moves the real node without opening reading`,
        Math.hypot(moved.x - center.x, moved.y - center.y) > 20 &&
          held.focus === before.focus &&
          held.scale === before.scale,
      )
      check(
        `${name}: dragging near a neighbor does not overlap visible title text`,
        heldNames.overlaps.length === 0,
        heldNames.overlaps,
      )
      const worldBounds = await page.locator("#topos-world").boundingBox(),
        visibleMarks = held.nodes.filter(
          (n) =>
            held.presentedIDs.includes(n.id) &&
            n.opacity >= 0.1 &&
            n.radius >= 2 &&
            n.screenX >= worldBounds.x &&
            n.screenX <= worldBounds.x + worldBounds.width &&
            n.screenY >= worldBounds.y &&
            n.screenY <= worldBounds.y + worldBounds.height,
        ),
        namedIDs = new Set(heldNames.items.filter((t) => t.full).map((t) => t.id))
      check(
        `${name}: every visible dragged-field point retains a complete visible name`,
        visibleMarks.length > 0 && visibleMarks.every((n) => namedIDs.has(n.id)),
        {
          visibleMarks: visibleMarks.map((n) => n.id),
          completeVisibleNames: [...namedIDs],
          unnamed: visibleMarks.filter((n) => !namedIDs.has(n.id)).map((n) => n.id),
          invalidNames: heldNames.items.filter((t) => !t.full),
        },
      )
      record.dragHeld = { snapshot: held, names: heldNames }
      await shot(page, `${name}-held-near-neighbor`)
      if (mobile) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      else await page.mouse.up()
      const released = await snap(page)
      await stationary(page, record, "releasedIdle")
      await page.waitForTimeout(5000)
      const end = await snap(page),
        at2 = record.releasedIdle.at2,
        post = drift(at2, end),
        releasedFocus = released.nodes.find((n) => n.id === released.focus),
        finalFocus = end.nodes.find((n) => n.id === end.focus)
      check(
        `${name}: released layout remains still from 2 to 10 seconds`,
        post.worldMax <= 0.1 && post.screenMax <= 0.5 && post.frames === 0,
        { ...post, nodes: undefined },
      )
      check(
        `${name}: dragged node retains its released position`,
        Math.hypot(finalFocus.x - releasedFocus.x, finalFocus.y - releasedFocus.y) <= 1,
        { released: releasedFocus, final: finalFocus },
      )
      check(
        `${name}: persistent node IDs are unchanged`,
        equalIDs(
          before.nodes.map((n) => n.id),
          end.nodes.map((n) => n.id),
        ),
      )
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForFunction(
        () => document.querySelector("#topos-world")?.dataset.ready === "true",
      )
      await page.waitForTimeout(2000)
      const afterReload = await snap(page),
        restoredFocus = afterReload.nodes.find((n) => n.id === finalFocus.id),
        restoredDistance = restoredFocus
          ? Math.hypot(
              restoredFocus.x - finalFocus.x,
              restoredFocus.y - finalFocus.y,
              restoredFocus.z - finalFocus.z,
            )
          : Infinity
      check(
        `${name}: refresh restores the manually released world position`,
        afterReload.focus === end.focus && restoredDistance <= 1,
        { distance: restoredDistance, before: finalFocus, after: restoredFocus },
      )
      if (modeText === "fallback")
        check(
          `${name}: actual Canvas2D fallback remains active`,
          end.renderer === "canvas2d" && (await page.locator(".topos-flat-canvas").count()) === 1,
          { renderer: end.renderer },
        )
      check(
        `${name}: page stays within viewport width`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      check(`${name}: no uncaught errors`, errors.length === 0, errors)
    } catch (error) {
      report.errors.push({ name, error: error.stack, pageErrors: [...errors] })
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
