import { chromium } from "playwright"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.MAP_MOTION_OUTPUT ?? "artifacts/map-motion/local")
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const focus = model.concepts.find((node) => node.title === "度量拓扑与连续性的三种刻画")
if (!focus) throw new Error("The approved continuity passage is missing")
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex")
const report = {
  startedAt: new Date().toISOString(),
  runtimeSha256: hash(await readFile("public/static/topos/topos.js")),
  cssSha256: hash(await readFile("public/static/topos/topos.css")),
  scriptSha256: hash(await readFile(import.meta.filename)),
  checks: [],
  errors: [],
  motions: [],
  screenshots: [],
  resources: [],
  limits: [
    "One headless Edge, sequential fresh contexts; 390px touch is simulated, not a physical phone.",
    "MutationObserver records actual SVG camera transforms. These are intermediate DOM poses, not compositor timestamps or FPS/INP measurements.",
    "Full map snapshots are limited to task boundaries and 100ms readiness polls, never every animation frame. The camera trace reads only its SVG transform.",
    "Before, intermediate and after screenshots are captured during real button input. No video encoder or simulated animation is used. Motion gates require finite transitions, exact end state and direct-input cancellation.",
  ],
}
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: Boolean(passed), evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const selector = (attribute, value) => `[${attribute}=${JSON.stringify(value)}]`
const snapshot = (page) => page.evaluate(() => window.__topos.snapshot())
const mapState = async (page) => (await snapshot(page)).globalMap
const mapReady = (page) =>
  page.waitForFunction(
    () => {
      const map = window.__topos?.snapshot().globalMap
      return map?.open && map.settled
    },
    undefined,
    { polling: 100 },
  )
const near = (a, b, epsilon = 0.02) => Math.abs(a - b) <= epsilon
const sameCamera = (a, b) => ["x", "y", "k"].every((key) => near(a[key], b[key]))
const sameIDs = (a, b) =>
  a.length === b.length && new Set(a).size === a.length && a.every((id) => b.includes(id))
const zoomTarget = (map, factor) => {
  const k = Math.max(0.005, Math.min(4, map.camera.k * factor))
  return {
    x: map.width / 2 - ((map.width / 2 - map.camera.x) * k) / map.camera.k,
    y: map.height / 2 - ((map.height / 2 - map.camera.y) * k) / map.camera.k,
    k,
  }
}
async function observe(page) {
  await page.evaluate(() => {
    window.__cameraProbe?.observer.disconnect()
    const layer = document.querySelector("[data-global-map-group]").parentElement.parentElement
    const read = () => {
      const values = layer
        .getAttribute("transform")
        ?.match(/-?[\d.]+(?:e[+-]?\d+)?/gi)
        ?.map(Number)
      return values?.length === 3
        ? { x: values[0], y: values[1], k: values[2], at: performance.now() }
        : null
    }
    const probe = { samples: [], observer: null }
    const push = () => {
      const camera = read()
      if (camera) probe.samples.push(camera)
    }
    probe.observer = new MutationObserver(push)
    probe.observer.observe(layer, { attributes: true, attributeFilter: ["transform"] })
    window.__cameraProbe = probe
    push()
  })
}
async function stopObserve(page, name) {
  const samples = await page.evaluate(() => {
    const probe = window.__cameraProbe
    probe.observer.disconnect()
    return probe.samples
  })
  report.motions.push({ name, samples })
  return samples
}
async function press(page, control) {
  await page.locator(control).focus()
  await page.keyboard.press("Enter")
}
async function verifyTransition(page, name, action, reduced, expected) {
  const before = await mapState(page)
  await observe(page)
  await action()
  const dispatched = await mapState(page)
  const intended = expected ?? dispatched.cameraMotion?.to
  if (name.endsWith("button zoom")) {
    if (!reduced) await page.waitForTimeout(70)
    const captureBefore = (await mapState(page)).camera
    await screenshot(page, `${name.replaceAll(" ", "-")}-middle`)
    report.motions.push({
      name: `${name} screenshot interval`,
      captureBefore,
      captureAfter: (await mapState(page)).camera,
    })
  }
  await mapReady(page)
  const after = await mapState(page)
  const samples = await stopObserve(page, name)
  if (name.endsWith("button zoom")) await screenshot(page, `${name.replaceAll(" ", "-")}-after`)
  const intermediate = samples.filter(
    (pose) => !sameCamera(pose, before.camera) && !sameCamera(pose, after.camera),
  )
  check(
    `${name}: ${reduced ? "reduced motion completes directly" : "camera traverses intermediate poses"}`,
    reduced ? intermediate.length === 0 : intermediate.length >= 2,
    {
      before: before.camera,
      after: after.camera,
      intermediate: intermediate.length,
      samples: samples.length,
    },
  )
  check(
    `${name}: camera stops at the intended target`,
    intended ? sameCamera(after.camera, intended) : reduced && !after.cameraMotion,
    {
      expected: intended ?? "immediate reduced-motion view",
      actual: after.camera,
      dispatched: dispatched.cameraMotion,
    },
  )
  check(
    `${name}: transition does not move or duplicate knowledge objects`,
    sameIDs(before.nodeIDs, after.nodeIDs) &&
      before.positions.every((node) => {
        const next = after.positions.find((point) => point.id === node.id)
        return next && near(node.x, next.x) && near(node.y, next.y)
      }),
  )
  return { before, after, samples }
}
async function blankPoint(page) {
  return page.evaluate(() => {
    const stage = document.querySelector("[data-global-map-stage]")
    const rect = stage.getBoundingClientRect()
    const obstacles = [
      ...stage.querySelectorAll(
        "[data-global-map-node],[data-global-map-label],[data-global-map-group]",
      ),
    ]
      .filter((node) => getComputedStyle(node).visibility !== "hidden")
      .map((node) => node.getBoundingClientRect())
    for (let y = rect.top + 20; y < rect.bottom - 20; y += 16)
      for (let x = rect.left + 20; x < rect.right - 20; x += 16) {
        const hit = document.elementFromPoint(x, y)
        if (
          !hit ||
          !stage.contains(hit) ||
          hit.closest("[data-global-map-node],[data-global-map-label],[data-global-map-group]")
        )
          continue
        if (
          obstacles.every(
            (box) =>
              x < box.left - 30 || x > box.right + 30 || y < box.top - 30 || y > box.bottom + 30,
          )
        )
          return {
            x,
            y,
            dx: x > rect.left + rect.width / 2 ? -40 : 40,
            dy: y > rect.top + rect.height / 2 ? -24 : 24,
          }
      }
    throw new Error("No actual blank gesture start with a 30px margin")
  })
}
async function interruptCamera(page, name, reduced, touch, kind) {
  await press(page, "[data-global-map-fit]")
  await mapReady(page)
  await observe(page)
  await press(page, '[data-global-map-zoom="in"]')
  if (!reduced) await page.waitForTimeout(70)
  const preInput = await mapState(page)
  check(
    `${name}: interruption starts during the finite transition`,
    reduced || Boolean(preInput.cameraMotion),
    preInput.cameraMotion ?? "reduced motion has no camera tween",
  )
  const point = await blankPoint(page)
  const cdp = touch && kind === "pointer" ? await page.context().newCDPSession(page) : null
  await page.evaluate((kind) => {
    const stage = document.querySelector("[data-global-map-stage]")
    window.__directInputTrace = []
    const listen = (event) => {
      window.__directInputTrace.push({
        type: event.type,
        x: event.clientX,
        y: event.clientY,
        target:
          event.target.closest?.(
            "[data-global-map-node],[data-global-map-label],[data-global-map-group]",
          )?.outerHTML ?? null,
        at: performance.now(),
      })
    }
    stage.addEventListener(kind === "pointer" ? "pointerdown" : "wheel", listen, {
      once: true,
      capture: true,
    })
  }, kind)
  if (kind === "pointer") {
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: point.x, y: point.y, id: 1, radiusX: 1, radiusY: 1 }],
      })
    } else {
      await page.mouse.move(point.x, point.y)
      await page.mouse.down()
    }
    const heldCamera = (await mapState(page)).camera
    for (let step = 1; step <= 8; step++) {
      const x = point.x + (step * point.dx) / 8,
        y = point.y + (step * point.dy) / 8
      if (cdp)
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x, y, id: 1, radiusX: 1, radiusY: 1 }],
        })
      else await page.mouse.move(x, y)
    }
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    else await page.mouse.up()
    await cdp?.detach()
    await mapReady(page)
    const immediate = await mapState(page)
    check(
      `${name}: pointer takes over without delayed motion`,
      near(immediate.camera.x - heldCamera.x, point.dx, 1) &&
        near(immediate.camera.y - heldCamera.y, point.dy, 1) &&
        near(immediate.camera.k, heldCamera.k),
      { heldCamera, actual: immediate.camera },
    )
  } else {
    await page.mouse.move(point.x, point.y)
    await page.mouse.wheel(0, 95)
    await mapReady(page)
    const actualInputPose = await page.evaluate(() => {
      const input = window.__directInputTrace.find((event) => event.type === "wheel")
      return window.__cameraProbe.samples.filter((pose) => pose.at <= input.at).at(-1)
    })
    check(
      `${name}: wheel changes scale through direct input`,
      Boolean(actualInputPose) &&
        near((await mapState(page)).camera.k, actualInputPose.k * Math.exp(-0.19), 1e-7),
      {
        earlierSnapshot: preInput.camera,
        atWheel: actualInputPose,
        factor: Math.exp(-0.19),
        after: (await mapState(page)).camera,
      },
    )
  }
  const interrupted = await mapState(page)
  await page.waitForTimeout(650)
  const final = await mapState(page)
  const trace = await page.evaluate(() => window.__directInputTrace)
  check(
    `${name}: interrupted camera never snaps back`,
    sameCamera(interrupted.camera, final.camera) && final.open,
    { interrupted: interrupted.camera, final: final.camera, trace },
  )
  check(
    `${name}: input began on actual blank space`,
    trace.length > 0 && trace.every((event) => event.target === null),
    trace,
  )
  await stopObserve(page, name)
}
async function screenshot(page, name) {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
await mkdir(output, { recursive: true })
const preview = await startPreview({ port: 0 })
const base = `${preview.url}/World/`
report.base = base
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
})
report.browser = browser.version()
try {
  for (const [width, reduced] of [
    [1440, false],
    [1024, false],
    [390, false],
    [390, true],
  ]) {
    if (process.env.MAP_MOTION_WIDTH && String(width) !== process.env.MAP_MOTION_WIDTH) continue
    const name = `${width}${reduced ? "-reduced" : ""}`
    const height = width === 1440 ? 1000 : width === 1024 ? 900 : 844
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: width === 390,
      isMobile: width === 390,
      reducedMotion: reduced ? "reduce" : "no-preference",
    })
    await context.addInitScript(() => {
      window.__applicationRaf = { requested: 0, executed: 0 }
      const raf = window.requestAnimationFrame.bind(window)
      window.requestAnimationFrame = (callback) => {
        window.__applicationRaf.requested++
        return raf((time) => {
          window.__applicationRaf.executed++
          callback(time)
        })
      }
    })
    const page = await context.newPage()
    page.setDefaultTimeout(10000)
    const resourceTasks = []
    const errors = []
    page.on("pageerror", (error) => errors.push(String(error)))
    page.on("response", (response) => {
      if (/\/static\/topos\/topos\.(js|css)(\?|$)/.test(response.url()))
        resourceTasks.push(
          response
            .body()
            .then((body) =>
              report.resources.push({ name, url: response.url(), sha256: hash(body) }),
            ),
        )
    })
    try {
      await page.goto(base + "topos.html")
      await mapReady(page)
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(250)
      check(
        `${name}: full approved object set starts in the open field`,
        sameIDs(
          (await mapState(page)).nodeIDs,
          model.concepts.map((node) => node.id),
        ),
      )
      await screenshot(page, `${name}-before`)
      const beforeZoom = await mapState(page)
      await verifyTransition(
        page,
        `${name} button zoom`,
        () => press(page, '[data-global-map-zoom="in"]'),
        reduced,
        zoomTarget(beforeZoom, 1.333333),
      )
      const group = page.locator("[data-global-map-group]").first()
      const groupID = await group.getAttribute("data-global-map-group")
      await verifyTransition(
        page,
        `${name} theme locate`,
        async () => {
          await group.focus()
          await page.keyboard.press("Enter")
        },
        reduced,
      )
      const located = await mapState(page)
      check(
        `${name}: located theme remains a text landmark with visible members`,
        (await group.locator("text").isVisible()) &&
          located.groups.find((item) => item.id === groupID)?.ids.length > 0,
      )
      await verifyTransition(
        page,
        `${name} fit all`,
        () => press(page, "[data-global-map-fit]"),
        reduced,
      )
      await screenshot(page, `${name}-after`)
      await interruptCamera(page, `${name} interrupt by drag`, reduced, width === 390, "pointer")
      await interruptCamera(page, `${name} interrupt by wheel`, reduced, false, "wheel")
      if (width === 390 && !reduced) {
        await press(page, '[data-global-map-zoom="in"]')
        const during = await mapState(page)
        await page.emulateMedia({ reducedMotion: "reduce" })
        await mapReady(page)
        const stopped = await mapState(page)
        check(
          `${name}: enabling reduced motion ends an active transition immediately`,
          Boolean(during.cameraMotion) &&
            !stopped.cameraMotion &&
            stopped.visualEffects === 0 &&
            sameCamera(during.cameraMotion.to, stopped.camera),
          {
            target: during.cameraMotion?.to,
            stopped: stopped.camera,
            effects: stopped.visualEffects,
          },
        )
        await page.emulateMedia({ reducedMotion: "no-preference" })
      }
      await page.waitForTimeout(300)
      const idleBefore = await page.evaluate(() => ({
        raf: { ...window.__applicationRaf },
        renders: document.querySelector(".global-map").dataset.renderCount,
      }))
      await page.waitForTimeout(900)
      const idleAfter = await page.evaluate(() => ({
        raf: { ...window.__applicationRaf },
        renders: document.querySelector(".global-map").dataset.renderCount,
        animations: document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
      }))
      check(
        `${name}: stopped map has no idle RAF or animation loop`,
        idleBefore.raf.executed === idleAfter.raf.executed &&
          idleBefore.renders === idleAfter.renders &&
          idleAfter.animations === 0,
        { before: idleBefore, after: idleAfter },
      )

      await page.keyboard.press("Control+k")
      await page.locator("[data-topos-search-input]").fill(focus.title)
      await page.locator(selector("data-search-concept", focus.id)).click()
      const active = () => page.locator('.topos-unfolding[data-active="true"]')
      const readReady = () =>
        page.waitForFunction(
          (id) =>
            window.__topos.state.focus === id &&
            document.body.dataset.reader === "true" &&
            document.querySelector('.topos-unfolding[data-active="true"] math'),
          focus.id,
        )
      await readReady()
      await page.evaluate(() => document.fonts.ready)
      check(
        `${name}: animated navigation still reaches actual formulas and source`,
        (await active().innerText()).includes("Simon") &&
          (await active().locator("math").count()) > 0,
      )
      await active().evaluate((node) => node.scrollTo({ top: 540, behavior: "instant" }))
      await page.waitForTimeout(250)
      const scrollTop = await active().evaluate((node) => node.scrollTop)
      await screenshot(page, `${name}-reading`)
      await active().locator("[data-fold]").click()
      await mapReady(page)
      const collapsed = await mapState(page)
      check(
        `${name}: fold keeps source and keyboard context`,
        collapsed.selected === focus.id &&
          (await page.evaluate(() => Boolean(document.activeElement?.closest(".global-map")))),
      )
      await page.goBack()
      await readReady()
      await page.waitForTimeout(300)
      check(
        `${name}: Back restores original reading position`,
        near(scrollTop, await active().evaluate((node) => node.scrollTop), 2) &&
          (await active().isVisible()),
        { expected: scrollTop, actual: await active().evaluate((node) => node.scrollTop) },
      )
      await page.goForward()
      await mapReady(page)
      check(
        `${name}: Forward restores exact map camera`,
        sameCamera(collapsed.camera, (await mapState(page)).camera),
      )
      await page.reload()
      await mapReady(page)
      check(
        `${name}: refresh preserves current object and camera`,
        (await mapState(page)).selected === focus.id &&
          sameCamera(collapsed.camera, (await mapState(page)).camera),
      )

      const firstTheme = focus.topicIDs[0]
      if (width < 761) await page.locator(".topos-topics-trigger").click()
      await page.locator(".topos-topic-commands button").filter({ hasText: "清空" }).click()
      await page.locator(selector("data-topic", firstTheme)).check()
      if (width < 761) await page.locator("[data-close-topics]").click()
      await mapReady(page)
      const beforeExpand = await mapState(page)
      const secondTheme = model.topics.find((topic) => topic.id !== firstTheme).id
      if (width < 761) await page.locator(".topos-topics-trigger").click()
      await page.locator(selector("data-topic", secondTheme)).check()
      if (width < 761) await page.locator("[data-close-topics]").click()
      await mapReady(page)
      const afterExpand = await mapState(page)
      check(
        `${name}: theme expansion preserves shared identities and anchors`,
        beforeExpand.positions.every((node) => {
          const next = afterExpand.positions.find((point) => point.id === node.id)
          return next && near(node.anchorX, next.anchorX) && near(node.anchorY, next.anchorY)
        }) &&
          new Set(afterExpand.nodeIDs).size === afterExpand.nodeIDs.length &&
          afterExpand.nodeIDs.length >= beforeExpand.nodeIDs.length,
        { before: beforeExpand.nodeIDs.length, after: afterExpand.nodeIDs.length },
      )
      check(
        `${name}: motion introduces no horizontal document overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      )
      check(`${name}: no browser execution errors`, errors.length === 0, errors)
    } catch (error) {
      report.errors.push({
        name,
        error: error.stack,
        state: await mapState(page).catch(() => null),
      })
      await screenshot(page, `${name}-failure`).catch(() => {})
    } finally {
      await Promise.allSettled(resourceTasks)
      const resources = report.resources.filter((item) => item.name === name)
      check(
        `${name}: browser received the frozen runtime and styles`,
        resources.some((item) => item.sha256 === report.runtimeSha256) &&
          resources.some((item) => item.sha256 === report.cssSha256),
        resources,
      )
      await context.close()
    }
  }
} catch (error) {
  report.errors.push({ name: "browser setup", error: error.stack })
} finally {
  await browser.close()
  await preview.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((item) => item.passed).length
  report.failed = report.checks.filter((item) => !item.passed).length + report.errors.length
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
