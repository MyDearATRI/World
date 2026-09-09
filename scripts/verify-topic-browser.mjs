import { mkdir, writeFile, readFile } from "node:fs/promises"
import path from "node:path"
import { chromium } from "playwright"
import { startPreview } from "./preview.mjs"

const output = path.resolve(process.env.TOPIC_OUTPUT ?? "artifacts/phase-01/browser")
await mkdir(output, { recursive: true })
const report = {
  startedAt: new Date().toISOString(),
  checks: [],
  screenshots: [],
  errors: [],
  notRun: ["Physical mobile devices, screen reader, Firefox and Safari"],
}
const check = (name, passed, evidence) => {
  report.checks.push({ name, passed: !!passed, evidence })
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`)
}
const preview = process.env.TOPIC_BASE ? undefined : await startPreview({ port: 0 })
const base = process.env.TOPIC_BASE ?? `${preview.url}/World/`
const browser = await chromium.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  ...(process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY } } : {}),
})
const model = JSON.parse(await readFile("public/static/topos/index.json", "utf8")).model
const expected = (topics) =>
  model.concepts
    .filter((c) => c.topicIDs.some((id) => topics.includes(id)))
    .map((c) => c.id)
    .sort()
const snapshot = (page) => page.evaluate(() => window.__topos.snapshot())
const ready = async (page) => {
  await page.waitForFunction(() => document.querySelector("#topos-world")?.dataset.ready === "true")
  await page.evaluate(() => document.fonts.ready)
}
const stable = (page) =>
  page.waitForFunction(() => window.__topos.settled, null, { timeout: 30000 })
const shot = async (page, name) => {
  const file = path.join(output, `${name}.png`)
  await page.screenshot({ path: file })
  report.screenshots.push(file)
}
const showSidebar = async (page, phone) => {
  if (phone && !(await page.locator(".topos-topic-sidebar").evaluate((e) => e.open)))
    await page.getByRole("button", { name: "主题", exact: true }).click()
}
const hideSidebar = async (page, phone) => {
  if (phone) await page.locator("[data-close-topics]").click()
}
try {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const phone = viewport.width === 390,
      prefix = String(viewport.width)
    const context = await browser.newContext({
      viewport,
      hasTouch: phone,
      isMobile: phone,
      reducedMotion: "reduce",
    })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    try {
      await page.goto(new URL("topos.html", base).href)
      await ready(page)
      await stable(page)
      check(
        `${prefix} complete actual collection at startup`,
        (await snapshot(page)).visibleIDs.length === 192,
      )
      check(
        `${prefix} page has no horizontal overflow`,
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      await shot(page, `${prefix}-notes`)
      await showSidebar(page, phone)
      check(
        `${prefix} six colored note themes`,
        (await page.locator("input[data-topic]").count()) === 6,
      )
      await page.getByRole("button", { name: "清空", exact: true }).click()
      check(
        `${prefix} no selected themes gives empty graph`,
        (await snapshot(page)).visibleIDs.length === 0,
      )
      await hideSidebar(page, phone)
      check(
        `${prefix} intentional empty state is readable`,
        await page.getByRole("heading", { name: "选一个主题，开始探索" }).isVisible(),
      )
      await showSidebar(page, phone)
      await page.locator('[data-topic="topology"]').check()
      check(
        `${prefix} one theme gives exact expected objects`,
        JSON.stringify((await snapshot(page)).visibleIDs.sort()) ===
          JSON.stringify(expected(["topology"])),
      )
      await page.locator('[data-topic="foundations"]').check()
      const selected = await snapshot(page),
        ids = new Set(selected.visibleIDs)
      check(
        `${prefix} two themes are a union with no duplicate nodes`,
        JSON.stringify([...ids].sort()) === JSON.stringify(expected(["topology", "foundations"])) &&
          selected.nodes.length === 192,
      )
      check(
        `${prefix} relations have both endpoints in selected themes`,
        selected.relations.every((r) => ids.has(r.source) && ids.has(r.target)),
      )
      await shot(page, `${prefix}-topic-selection`)
      await hideSidebar(page, phone)
      await page.reload()
      await ready(page)
      await stable(page)
      check(
        `${prefix} URL refresh restores checkbox union`,
        JSON.stringify((await snapshot(page)).topics.sort()) ===
          JSON.stringify(["foundations", "topology"]),
      )
      await showSidebar(page, phone)
      await page.locator(".topos-topic-directory summary").click()
      await page.getByRole("searchbox", { name: "在选中主题中筛选节点" }).fill("度量")
      const link = page.locator('[data-topic-node="a-000067"]')
      check(
        `${prefix} filtered directory preserves real canonical href`,
        (await link.getAttribute("href")).endsWith("atoms/a-000067.html"),
      )
      await link.click()
      await page.waitForFunction(() =>
        document.querySelector('.topos-unfolding[data-active="true"] .topos-prose .katex'),
      )
      check(
        `${prefix} theme node opens real math inside the same field`,
        (await snapshot(page)).focus === "a-000067" &&
          (await page.locator('.topos-unfolding[data-active="true"] math').count()) > 0,
      )
      await stable(page)
      await shot(page, `${prefix}-reading`)
      check(
        `${prefix} reader remains within viewport`,
        await page.locator('.topos-unfolding[data-active="true"]').evaluate((e) => {
          const r = e.getBoundingClientRect()
          return r.left >= 0 && r.right <= innerWidth + 1
        }),
      )
      await page.goBack()
      await ready(page)
      check(
        `${prefix} browser Back restores selected themes`,
        (await snapshot(page)).topics.includes("topology"),
      )
      await showSidebar(page, phone)
      await page.locator('.topos-topic-sidebar a[href="./atlas.html"]').click()
      await ready(page)
      await stable(page)
      check(
        `${prefix} atlas has twelve theme choices`,
        (await page.locator("input[data-topic]").count()) === 12,
      )
      check(
        `${prefix} atlas is explicitly distinct from actual notes`,
        (await snapshot(page)).mode === "atlas",
      )
      await showSidebar(page, phone)
      await page.locator('[data-topic="math.region.algebra-representation"]').check()
      await page.locator('[data-topic="math.region.analysis-pde"]').check()
      const atlas = await snapshot(page)
      check(
        `${prefix} selected classification regions and directed edges exist`,
        atlas.visibleIDs.includes("math.region.analysis-pde") &&
          atlas.visibleIDs.includes("math.region.algebra-representation") &&
          atlas.relations.length > 0,
      )
      check(
        `${prefix} no taxonomy edge claims a formal proof`,
        atlas.relations.every((r) => r.type === "appears-in" && r.provenance === "structure"),
      )
      await hideSidebar(page, phone)
      await stable(page)
      await shot(page, `${prefix}-atlas`)
      await showSidebar(page, phone)
      await page.locator(".topos-topic-directory summary").click()
      await page.locator('[data-topic-node="math.region.analysis-pde"]').click()
      await page.waitForFunction(() =>
        document
          .querySelector('.topos-unfolding[data-active="true"]')
          ?.textContent.includes("未执行 Lean"),
      )
      check(
        `${prefix} title panel shows sources and honest formal status`,
        (await page
          .locator('.topos-unfolding[data-active="true"] .topos-prose a[target="_blank"]')
          .count()) > 0,
      )
      await stable(page)
      await shot(page, `${prefix}-atlas-source`)
      await showSidebar(page, phone)
      if (phone) {
        await page.keyboard.press("Escape")
        check(
          `${prefix} mobile Escape returns focus to theme button`,
          await page.locator(".topos-topics-trigger").evaluate((e) => document.activeElement === e),
        )
      } else {
        const checkbox = page.locator('input[data-topic="math.region.geometry"]')
        await checkbox.focus()
        await page.keyboard.press("Space")
        check(
          `${prefix} keyboard Space toggles a theme with visible focus`,
          (await checkbox.isChecked()) &&
            (await checkbox.evaluate((e) => e.matches(":focus-visible"))),
        )
      }
      check(`${prefix} no runtime exceptions`, errors.length === 0, errors)
    } catch (error) {
      report.errors.push(`${prefix}: ${error.stack}`)
      console.error(error)
      await shot(page, `${prefix}-error`)
    }
    await context.close()
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
