import { chromium } from "playwright"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import path from "node:path"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.NODE_SPACE_OUTPUT ?? "artifacts/node-space/accepted")
const cases = (
  process.env.NODE_SPACE_CASES ??
  "field-1440,field-1024,field-390,field-390-reduced,field-390-fallback,global-1440,global-1024,global-390,global-390-reduced"
).split(",")
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const atlasModel = JSON.parse(await readFile("public/static/topos/atlas.json", "utf8")).model
const concepts = new Map(model.concepts.map((c) => [c.id, c]))
const report = {
  startedAt: new Date().toISOString(),
  scriptSha256: createHash("sha256")
    .update(await readFile(new URL(import.meta.url)))
    .digest("hex"),
  checks: [],
  errors: [],
  scenes: [],
  resources: [],
  screenshots: [],
  limits: [
    "Headless Edge; touch is simulated, not a physical phone.",
    "Coordinate changes and finite settling are measured, not FPS.",
    "The original model defines semantic relationships; geometric collision response does not create relationships.",
  ],
}
let browser, preview
const selector = (attribute, id) => `[${attribute}=${JSON.stringify(id)}]`
const snapshot = (page) => page.evaluate(() => window.__topos.snapshot())
function check(name, passed, evidence) {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
async function shot(page, name) {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
async function ready(page) {
  await page.waitForFunction(
    () => window.__topos && document.querySelector("#topos-world")?.dataset.ready === "true",
    null,
    { timeout: 20000 },
  )
  await page.evaluate(() => document.fonts.ready)
}
function positions(value, mode) {
  return mode === "field" ? value.nodes : value.globalMap.positions
}
function motion(before, after, mode) {
  const old = new Map(positions(before, mode).map((n) => [n.id, n]))
  const items = positions(after, mode)
    .filter((n) => old.has(n.id))
    .map((n) => ({
      id: n.id,
      distance: Math.hypot(
        n.x - old.get(n.id).x,
        n.y - old.get(n.id).y,
        (n.z ?? 0) - (old.get(n.id).z ?? 0),
      ),
    }))
  return {
    max: Math.max(0, ...items.map((n) => n.distance)),
    items: items.filter((n) => n.distance > 0.001),
  }
}
async function labelsAndHits(page, mode) {
  return page.evaluate((mode) => {
    const state = window.__topos.snapshot()
    const population =
      mode === "field"
        ? state.nodes.filter((n) => state.presentedIDs.includes(n.id))
        : state.globalMap.positions
    const selector =
      mode === "field"
        ? "a.topos-concept[data-concept]"
        : "[data-global-map-label],a[data-global-map-node] text"
    const labels = [...document.querySelectorAll(selector)]
      .filter((el) => {
        const s = getComputedStyle(el),
          box = el.getBoundingClientRect()
        return (
          s.visibility !== "hidden" &&
          Number(s.opacity) > 0.1 &&
          box.width > 1 &&
          box.height > 1 &&
          el.checkVisibility()
        )
      })
      .map((el) => {
        const owner = el.closest("[data-concept],[data-global-map-label],[data-global-map-node]")
        const range = document.createRange()
        range.selectNodeContents(el)
        return {
          id:
            owner?.dataset.concept ?? owner?.dataset.globalMapLabel ?? owner?.dataset.globalMapNode,
          text: el.textContent,
          lines: [...range.getClientRects()]
            .filter((r) => r.width && r.height)
            .map((r) => r.toJSON()),
          rect: el.getBoundingClientRect().toJSON(),
        }
      })
    const points = population.map((n) => {
      const hit = document.elementFromPoint(n.screenX, n.screenY)
      const owner = hit?.closest(
        "[data-node-mark],[data-global-map-node],[data-global-map-label],[data-concept]",
      )
      const id =
        owner?.dataset.nodeMark ??
        owner?.dataset.globalMapNode ??
        owner?.dataset.globalMapLabel ??
        owner?.dataset.concept
      const mark =
        mode === "field"
          ? document.querySelector(`[data-node-mark="${CSS.escape(n.id)}"]`)
          : document.querySelector(`[data-global-map-node="${CSS.escape(n.id)}"] .global-map-dot`)
      const visible =
        mode === "field"
          ? n.opacity > 0.05
          : !!mark &&
            getComputedStyle(mark).visibility !== "hidden" &&
            Number(getComputedStyle(mark).opacity) > 0.05
      const canvas = hit?.id === "topos-canvas" || hit?.classList.contains("topos-flat-canvas")
      return {
        id: n.id,
        x: n.screenX,
        y: n.screenY,
        radius: mode === "global" && mark ? mark.getBoundingClientRect().width / 2 : n.radius,
        visible,
        hitID: id,
        canvasHit: canvas,
        hitTag: hit?.tagName,
        hitClass: typeof hit?.className === "string" ? hit.className : hit?.getAttribute("class"),
        glyphOverlaps: labels
          .filter((label) =>
            label.lines.some(
              (r) =>
                n.screenX > r.left - 3 &&
                n.screenX < r.right + 3 &&
                n.screenY > r.top - 3 &&
                n.screenY < r.bottom + 3,
            ),
          )
          .map((l) => l.id),
      }
    })
    return { labels, points }
  }, mode)
}
async function dragStart(page, session, start, target, touch) {
  if (touch)
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: start.x, y: start.y, id: 1 }],
    })
  else {
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
  }
  for (let i = 1; i <= 18; i++) {
    const point = {
      x: start.x + ((target.x - start.x) * i) / 18,
      y: start.y + ((target.y - start.y) * i) / 18,
    }
    if (touch)
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ ...point, id: 1 }],
      })
    else await page.mouse.move(point.x, point.y)
    await page.waitForTimeout(20)
  }
  await page.waitForTimeout(200)
}
async function release(page, session, touch) {
  if (touch) await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  else await page.mouse.up()
}
async function run(name, base) {
  const [mode, widthText] = name.split("-"),
    width = Number(widthText),
    mobile = width === 390
  const context = await browser.newContext({
    viewport: { width, height: mobile ? 844 : width === 1024 ? 900 : 1000 },
    isMobile: mobile,
    hasTouch: mobile,
    reducedMotion: name.includes("reduced") ? "reduce" : "no-preference",
  })
  if (name.includes("fallback"))
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        return /webgl/i.test(type) ? null : original.call(this, type, ...args)
      }
    })
  const page = await context.newPage(),
    errors = [],
    record = { name, snapshots: {}, input: [] }
  report.scenes.push(record)
  await page.addInitScript(() => {
    window.__nodeSpacePointerEvents = []
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "dragstart"])
      document.addEventListener(
        type,
        (event) => {
          if (!event.target.closest?.("#topos-world,[data-global-map]")) return
          window.__nodeSpacePointerEvents.push({
            type,
            t: performance.now(),
            x: event.clientX,
            y: event.clientY,
            pointer: event.pointerId,
            target: event.target.tagName,
            node:
              event.target
                .closest?.("[data-node-mark],[data-global-map-node],[data-global-map-label]")
                ?.getAttribute("data-node-mark") ??
              event.target
                .closest?.("[data-global-map-node]")
                ?.getAttribute("data-global-map-node"),
          })
        },
        true,
      )
  })
  const cdp = mobile ? await context.newCDPSession(page) : undefined
  let documents = 0
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents++
  })
  page.on("pageerror", (error) => errors.push(error.stack))
  page.on("response", async (response) => {
    if (response.url().includes("/static/topos/topos.js"))
      try {
        report.resources.push({
          name,
          url: response.url(),
          sha256: createHash("sha256")
            .update(await response.body())
            .digest("hex"),
        })
      } catch {}
  })
  try {
    const address = new URL("topos.html", base)
    address.hash = "focus=a-000067&depth=2.1"
    await page.goto(address.href, { waitUntil: "domcontentloaded" })
    await ready(page)
    await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
    if (mode === "field") {
      await page.locator('.topos-unfolding[data-active="true"] [data-fold]').click()
      await page.waitForFunction(
        () => !window.__topos.snapshot().reader && !window.__topos.state.overview,
      )
    } else {
      await page.locator("[data-open-global-map]").click()
      // Bring the actual object into the graph's detailed level through its
      // existing locator; distant overview dots need not show all full names.
      await page.locator("[data-global-map-locate]").selectOption("a-000067")
    }
    await page.waitForTimeout(1400)
    let before = await snapshot(page)
    record.snapshots.before = before
    record.beforeLabels = await labelsAndHits(page, mode)
    await shot(page, `${name}-before`)
    const nodeList = positions(before, mode)
    const startNode = nodeList.find((n) => n.id === before.focus)
    const bounds = await page
      .locator(mode === "field" ? "#topos-world" : "[data-global-map-stage]")
      .boundingBox()
    const onScreen = (n) =>
      n.screenX > bounds.x + 24 &&
      n.screenX < bounds.x + bounds.width - 24 &&
      n.screenY > Math.max(100, bounds.y + 24) &&
      n.screenY < bounds.y + bounds.height - 90
    const neighbors = nodeList.filter(
      (n) =>
        n.id !== startNode.id &&
        onScreen(n) &&
        (mode === "global" || before.presentedIDs.includes(n.id)),
    )
    const named = new Set(record.beforeLabels.labels.map((label) => label.id))
    const neighbor = neighbors.sort(
      (a, b) =>
        Number(named.has(b.id)) - Number(named.has(a.id)) ||
        Math.hypot(a.screenX - startNode.screenX, a.screenY - startNode.screenY) -
          Math.hypot(b.screenX - startNode.screenX, b.screenY - startNode.screenY),
    )[0]
    if (!neighbor) throw new Error("No actually visible neighboring node for collision test")
    record.dragIDs = { dragged: startNode.id, neighbor: neighbor.id }
    const targetLabel = record.beforeLabels.labels.find((l) => l.id === neighbor.id)
    const target = targetLabel
      ? {
          x: Math.min(
            bounds.x + bounds.width - 25,
            Math.max(bounds.x + 25, targetLabel.rect.x + targetLabel.rect.width / 2),
          ),
          y: Math.min(
            bounds.y + bounds.height - 100,
            Math.max(bounds.y + 100, targetLabel.rect.y + targetLabel.rect.height / 2),
          ),
        }
      : { x: neighbor.screenX + 6, y: neighbor.screenY + 6 }
    const start = { x: startNode.screenX, y: startNode.screenY }
    record.gesture = {
      start,
      target,
      targetType: targetLabel ? "real-neighbor-label" : "real-neighbor-point",
    }
    const firstInputStart = await page.evaluate(() => window.__nodeSpacePointerEvents.length)
    await dragStart(page, cdp, start, target, mobile)
    const held = await snapshot(page),
      hitState = await labelsAndHits(page, mode)
    record.snapshots.held = held
    record.heldLabels = hitState
    const moved = positions(held, mode).find((n) => n.id === startNode.id)
    const point = hitState.points.find((n) => n.id === startNode.id)
    const pointerDistance = Math.hypot(moved.screenX - target.x, moved.screenY - target.y)
    const pointerEvents = await page.evaluate(
      (start) => window.__nodeSpacePointerEvents.slice(start),
      firstInputStart,
    )
    const stillHeld =
      mode === "field" ? held.layout?.[startNode.id]?.held : held.globalMap.heldID === startNode.id
    const reachedTarget =
      pointerDistance < 4 &&
      stillHeld &&
      !pointerEvents.some((event) => ["pointercancel", "dragstart"].includes(event.type))
    record.input.push({ gesture: "label", events: pointerEvents, pointerDistance, stillHeld })
    check(
      `${name}: every drag segment reaches the held pointer without native URL drag cancellation`,
      reachedTarget,
      { pointerDistance, stillHeld, events: pointerEvents },
    )
    if (!reachedTarget) {
      await shot(page, `${name}-interrupted-drag`)
      await release(page, cdp, mobile)
      record.notRun =
        "Contact, release and history assertions not run: the real pointer never reached the requested target."
      return
    }
    check(
      `${name}: actual dragged identity moves without opening another reader`,
      Math.hypot(moved.x - startNode.x, moved.y - startNode.y) > 10 &&
        held.focus === before.focus &&
        (mode === "field" ? held.scale === before.scale : held.globalMap.open),
      { before: startNode, moved, focus: held.focus },
    )
    check(
      `${name}: dragged point stays painted and independently hittable beside text`,
      Boolean(point?.visible && (point.hitID === startNode.id || point.canvasHit)),
      { point, missingFromPresented: !point, target },
    )
    const nearPoint = hitState.points.find((n) => n.id === neighbor.id)
    check(
      `${name}: text collision does not silently remove the neighboring point`,
      Boolean(nearPoint?.visible),
      { neighbor: neighbor.id, point: nearPoint, heldPresented: held.presentedIDs },
    )
    await shot(page, `${name}-held-near-label`)
    await release(page, cdp, mobile)
    await page.waitForTimeout(750)
    const at750 = await snapshot(page)
    await page.waitForTimeout(1250)
    const at2 = await snapshot(page)
    await page.waitForTimeout(1000)
    const at3 = await snapshot(page)
    record.snapshots.at750 = at750
    record.snapshots.at2 = at2
    record.snapshots.at3 = at3
    const steady = motion(at2, at3, mode)
    check(
      `${name}: released geometry reaches finite rest and stays still`,
      steady.max < 0.01 &&
        (mode === "field"
          ? at3.settled && at3.frame === at2.frame
          : at3.globalMap.settled && at3.globalMap.renderCount === at2.globalMap.renderCount),
      {
        maxWorldDrift: steady.max,
        settled: mode === "field" ? at3.settled : at3.globalMap.settled,
      },
    )
    const changed = motion(before, at750, mode)
    record.response = changed
    const linked = new Set(
      model.relations
        .filter((r) => r.source === startNode.id || r.target === startNode.id)
        .flatMap((r) => [r.source, r.target])
        .filter((id) => id !== startNode.id),
    )
    check(
      `${name}: real neighbors respond continuously to a nearby drag`,
      changed.items.some((n) => n.id !== startNode.id && linked.has(n.id) && n.distance > 0.01),
      { changed: changed.items, directModelNeighbors: [...linked] },
    )
    await shot(page, `${name}-settled`)
    const afterLabelHits = await labelsAndHits(page, mode)
    const targetStillAvailable = afterLabelHits.points.find((n) => n.id === neighbor.id)
    if (
      !targetStillAvailable?.visible ||
      !onScreen(positions(at3, mode).find((n) => n.id === neighbor.id))
    ) {
      record.notRun =
        "Further sphere-contact, modifier-click and history assertions were not run: the first real drag pushed its target outside the usable visible field."
      await writeFile(
        path.join(output, `${name}-contact-evidence.json`),
        JSON.stringify(record, null, 2),
      )
      return
    }
    // A second gesture deliberately contacts a real sphere. The preceding
    // label gesture cannot alone establish geometric collision behavior.
    const collisionBefore = await snapshot(page)
    const collisionStart = positions(collisionBefore, mode).find((n) => n.id === startNode.id)
    const collisionNeighbor = positions(collisionBefore, mode).find((n) => n.id === neighbor.id)
    const contactTarget = { x: collisionNeighbor.screenX + 1, y: collisionNeighbor.screenY + 1 }
    const contactInputStart = await page.evaluate(() => window.__nodeSpacePointerEvents.length)
    await dragStart(
      page,
      cdp,
      { x: collisionStart.screenX, y: collisionStart.screenY },
      contactTarget,
      mobile,
    )
    const collisionHeld = await snapshot(page)
    const contactNode = positions(collisionHeld, mode).find((n) => n.id === startNode.id)
    const contactDistance = Math.hypot(
      contactNode.screenX - contactTarget.x,
      contactNode.screenY - contactTarget.y,
    )
    const contactEvents = await page.evaluate(
      (start) => window.__nodeSpacePointerEvents.slice(start),
      contactInputStart,
    )
    record.input.push({
      gesture: "sphere",
      events: contactEvents,
      pointerDistance: contactDistance,
    })
    record.snapshots.collisionHeld = collisionHeld
    await shot(page, `${name}-held-near-point`)
    const contactReached =
      contactDistance < 4 &&
      (mode === "field"
        ? collisionHeld.layout?.[startNode.id]?.held
        : collisionHeld.globalMap.heldID === startNode.id) &&
      !contactEvents.some((event) => ["pointercancel", "dragstart"].includes(event.type))
    check(
      `${name}: the separate sphere-contact gesture really reaches its target`,
      contactReached,
      { contactDistance, contactTarget, actual: contactNode, events: contactEvents },
    )
    await release(page, cdp, mobile)
    if (!contactReached) {
      record.notRun =
        "Sphere-separation assertions not run because the pointer contact prerequisite failed."
      return
    }
    await page.waitForTimeout(750)
    const collisionAfter = await snapshot(page),
      collisionHits = await labelsAndHits(page, mode)
    record.snapshots.collisionAfter = collisionAfter
    record.collisionHits = collisionHits
    const pair = [startNode.id, neighbor.id].map((id) =>
      collisionHits.points.find((n) => n.id === id),
    )
    const separation = pair.every(Boolean)
      ? Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y)
      : 0
    const expectedGap = pair.every(Boolean) ? pair[0].radius + pair[1].radius : Infinity
    check(
      `${name}: contacted points remain visible, separately hittable and no longer overlap after release`,
      pair.every((point) => point?.visible && (point.hitID === point.id || point.canvasHit)) &&
        separation >= expectedGap - 1,
      { pair, separation, expectedGap },
    )
    await page.waitForTimeout(1250)
    const collisionRest = await snapshot(page)
    if (mode === "global") await page.waitForTimeout(1000)
    const collisionFinal = mode === "global" ? await snapshot(page) : collisionRest
    record.snapshots.collisionRest = collisionRest
    record.snapshots.collisionFinal = collisionFinal
    const settledCollision =
      mode === "global"
        ? motion(collisionRest, collisionFinal, mode)
        : motion(collisionAfter, collisionRest, mode)
    check(
      `${name}: collision response stops after the bounded release interval`,
      settledCollision.max < 0.01 &&
        (mode === "field"
          ? collisionRest.settled && collisionRest.frame === collisionAfter.frame
          : collisionRest.globalMap.settled &&
            collisionFinal.globalMap.settled &&
            collisionFinal.globalMap.renderCount === collisionRest.globalMap.renderCount),
      { drift: settledCollision.max },
    )
    await shot(page, `${name}-collision-rest`)
    await writeFile(
      path.join(output, `${name}-contact-evidence.json`),
      JSON.stringify(record, null, 2),
    )
    if (mode === "global") {
      const selected = at3.globalMap.selected
      const expected = model.relations.filter(
        (r) =>
          at3.globalMap.nodeIDs.includes(r.source) &&
          at3.globalMap.nodeIDs.includes(r.target) &&
          (r.source === selected || r.target === selected),
      )
      const rows = await page.locator("[data-global-map-relation]").evaluateAll((items) =>
        items.map((el) => ({
          id: el.dataset.globalMapRelation,
          text: el.textContent,
          reason: el.querySelector("[data-global-map-reason]")?.textContent,
          evidence: el.querySelector(".global-map-evidence")?.getAttribute("href"),
        })),
      )
      record.relations = { expectedIDs: expected.map((r) => r.id), rows }
      check(
        `${name}: highlighted relation list exactly matches real model endpoints`,
        rows.length === expected.length &&
          rows.every((row) => expected.some((r) => r.id === row.id)),
        { expected: expected.length, rows: rows.length },
      )
      check(
        `${name}: every highlighted relationship exposes its actual reason visibly`,
        expected.length > 0 &&
          rows.every((row) => {
            const r = expected.find((r) => r.id === row.id)
            return (
              row.reason &&
              ((r.explanation && row.reason.includes(r.explanation)) ||
                (r.evidence && row.reason.includes(r.evidence)))
            )
          }),
        rows,
      )
    } else {
      const visible = await page
        .locator("[data-relation]:not([inert])")
        .evaluateAll((items) =>
          items
            .filter((el) => Number(getComputedStyle(el).opacity) > 0.1)
            .map((el) => ({ id: el.dataset.relation, text: el.textContent, title: el.title })),
        )
      record.relations = visible
      check(
        `${name}: visible focused relationship labels retain actual model identities`,
        visible.every((row) =>
          model.relations.some((r) => r.id === row.id && r.label === row.text),
        ),
        visible,
      )
      const mark = page.locator(selector("data-node-mark", startNode.id))
      await mark.focus()
      const reasons = page.locator(selector("data-node-reasons", startNode.id))
      if (!(await reasons.evaluate((el) => el.open))) await reasons.locator("summary").click()
      const rows = await reasons
        .locator("[data-relation-reason]")
        .evaluateAll((items) => items.map((el) => el.dataset.relationReason))
      const actual = model.relations.filter(
        (r) => r.source === startNode.id || r.target === startNode.id,
      )
      check(
        `${name}: accessible point reasons include every real direct relationship`,
        rows.length === actual.length && rows.every((id) => actual.some((r) => r.id === id)),
        { actual: actual.map((r) => r.id), rows },
      )
      for (const id of rows) {
        const r = actual.find((edge) => edge.id === id)
        const trigger = reasons.locator(selector("data-relation-reason", id))
        await trigger.click()
        const panel = page.locator(".topos-relation-detail")
        const text = await panel.innerText()
        check(
          `${name}: relationship ${id} shows its exact original reason and endpoints`,
          text.includes(r.explanation) &&
            text.includes(concepts.get(r.source).title) &&
            text.includes(concepts.get(r.target).title),
          { id, text },
        )
        await panel.getByRole("button", { name: "关闭", exact: true }).click()
        check(
          `${name}: closing relationship ${id} restores keyboard focus`,
          await trigger.evaluate((el) => el === document.activeElement),
        )
      }
      await shot(page, `${name}-reasons`)
      if (await reasons.evaluate((el) => el.open)) await reasons.locator("summary").click()
    }
    const beforeRefresh = await snapshot(page)
    await page.reload({ waitUntil: "domcontentloaded" })
    await ready(page)
    await page.waitForTimeout(1400)
    const restored = await snapshot(page)
    const oldNode = positions(beforeRefresh, mode).find((n) => n.id === startNode.id),
      restoredNode = positions(restored, mode).find((n) => n.id === startNode.id)
    check(
      `${name}: refreshing the current address preserves settled dragged identity and position`,
      restoredNode &&
        Math.hypot(
          oldNode.x - restoredNode.x,
          oldNode.y - restoredNode.y,
          (oldNode.z ?? 0) - (restoredNode.z ?? 0),
        ) < 1,
      { before: oldNode, after: restoredNode },
    )
    const nativeLink = page.locator(
      selector(mode === "field" ? "data-node-mark" : "data-global-map-node", startNode.id),
    )
    const nativeHref = await nativeLink.getAttribute("href")
    if (!(await nativeLink.isVisible()))
      throw new Error(
        "The settled point is not visible; native-link testing cannot proceed with an unreachable point",
      )
    if (!mobile) {
      const [popup] = await Promise.all([
        context.waitForEvent("page"),
        nativeLink.click({ modifiers: ["Control"] }),
      ])
      await popup.waitForLoadState("domcontentloaded")
      check(
        `${name}: point retains native modifier-click canonical navigation`,
        new URL(popup.url()).pathname === new URL(nativeHref, page.url()).pathname,
        { actual: popup.url(), expected: nativeHref },
      )
      await popup.close()
    }
    if (mode === "field") {
      // A same-object activation intentionally advances semantic scale by0.65.
      // First enter a different true neighbor to create an object-history entry,
      // then follow the existing scale steps rather than assuming one-step reading.
      const nextID = positions(restored, mode).find(
        (n) => n.id === neighbor.id && restored.presentedIDs.includes(n.id),
      )?.id
      if (!nextID)
        throw new Error("No actual visible neighbor remains for the history-reading route")
      const nextMark = page.locator(selector("data-node-mark", nextID))
      await nextMark.focus()
      await page.keyboard.press("Enter")
      await page.waitForFunction((id) => window.__topos.state.focus === id, nextID)
      for (let step = 0; step < 3 && !(await snapshot(page)).reader; step++) {
        await nextMark.waitFor({ state: "visible" })
        await nextMark.focus()
        await page.keyboard.press("Enter")
        await page.waitForTimeout(50)
      }
    } else {
      await nativeLink.focus()
      await page.keyboard.press("Enter")
    }
    await page.waitForSelector('.topos-unfolding[data-active="true"] .topos-prose')
    const hiddenGuide = await page.locator(".topos-guide").evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        opacity: style.opacity,
        visibility: style.visibility,
        display: style.display,
        pointerEvents: style.pointerEvents,
      }
    })
    check(
      `${name}: the hidden field guide cannot intercept reading input`,
      hiddenGuide.display === "none" ||
        hiddenGuide.visibility === "hidden" ||
        hiddenGuide.pointerEvents === "none",
      hiddenGuide,
    )
    await page.goBack({ waitUntil: "domcontentloaded" })
    await ready(page)
    await page.waitForTimeout(1400)
    const back = await snapshot(page)
    const backPoint = positions(back, mode).find((n) => n.id === startNode.id)
    check(
      `${name}: Back from reading restores the settled point rather than an intermediate drop`,
      backPoint &&
        Math.hypot(
          backPoint.x - restoredNode.x,
          backPoint.y - restoredNode.y,
          (backPoint.z ?? 0) - (restoredNode.z ?? 0),
        ) < 1 &&
        (mode === "field" ? !back.reader : back.globalMap.open),
      { before: restoredNode, after: backPoint },
    )
    if (name.includes("fallback"))
      check(
        `${name}: actual Canvas2D fallback renders the field`,
        restored.renderer === "canvas2d" &&
          (await page.locator(".topos-flat-canvas").count()) === 1,
        { renderer: restored.renderer },
      )
    check(
      `${name}: native page remains bounded without uncaught errors`,
      errors.length === 0 &&
        (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)),
      { errors, documents },
    )
    if (name === "global-1440") {
      const atlasID = "math.region.analysis-pde"
      const atlasURL = new URL("atlas.html", base)
      atlasURL.hash = `focus=${atlasID}&depth=1`
      await page.goto(atlasURL.href, { waitUntil: "domcontentloaded" })
      await ready(page)
      await page.waitForTimeout(1200)
      await page.locator(selector("data-node-mark", atlasID)).focus()
      const reasons = page.locator(selector("data-node-reasons", atlasID))
      await reasons.waitFor({ state: "visible" })
      await reasons.locator("summary").click()
      const ids = await reasons
        .locator("[data-relation-reason]")
        .evaluateAll((items) => items.map((el) => el.dataset.relationReason))
      const actual = atlasModel.relations.filter(
        (r) => r.source === atlasID || r.target === atlasID,
      )
      check(
        `${name}: Atlas exposes the complete actual classification-reason set`,
        ids.length === actual.length && ids.every((id) => actual.some((r) => r.id === id)),
        { ids, expected: actual.map((r) => r.id) },
      )
      const edge = actual[0]
      await reasons.locator(selector("data-relation-reason", edge.id)).click()
      const panel = page.locator(".topos-relation-detail")
      const text = await panel.innerText()
      check(
        `${name}: Atlas reason preserves source evidence and disclaims mathematical inference`,
        text.includes(edge.explanation) &&
          text.includes(edge.evidence) &&
          [edge.source, edge.target].every((id) =>
            text.includes(atlasModel.concepts.find((c) => c.id === id).title),
          ),
        { edge, text },
      )
      await shot(page, `${name}-atlas-classification-reason`)
      await panel.getByRole("button", { name: "关闭", exact: true }).click()
    }
  } catch (error) {
    report.errors.push({ name, error: error.stack, pageErrors: errors })
  } finally {
    await context.close()
  }
}
try {
  await mkdir(output, { recursive: true })
  preview = process.env.NODE_SPACE_BASE ? undefined : await startPreview({ port: 0 })
  const base = process.env.NODE_SPACE_BASE ?? `${preview.url}/World/`
  report.base = base
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
  })
  for (const name of cases) {
    await run(name, base)
    if (report.errors.length || report.checks.some((item) => !item.passed)) break
  }
} finally {
  await browser?.close()
  await preview?.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((c) => c.passed).length
  report.failed = report.checks.filter((c) => !c.passed).length + report.errors.length
  await mkdir(output, { recursive: true })
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed, output }))
  if (report.failed) process.exitCode = 1
}
