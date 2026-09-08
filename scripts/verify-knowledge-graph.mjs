import { mkdir, writeFile, readFile } from "node:fs/promises"
import { createServer } from "node:http"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { build } from "esbuild"
import { sassPlugin } from "esbuild-sass-plugin"
import { chromium } from "playwright"

const root = fileURLToPath(new URL("../", import.meta.url))
const dir = path.join(root, "artifacts", "knowledge-graph-fixture")
await mkdir(dir, { recursive: true })
await build({
  stdin: {
    contents: `import {mountKnowledgeGraph} from './quartz/components/scripts/knowledgeGraph'; import './quartz/styles/knowledgeGraph.scss'; import './node_modules/katex/dist/katex.min.css'; const object=(id,type='definition')=>({id,kind:'atom',type,title:id==='a0'?'度量空间 · Metric space':id==='a1'?'Uniform continuity':('Mathematical object '+id),href:'atoms/'+id+'.html',excerpt:'Let $X$ be a set equipped with a metric. Every statement retains its original assumptions.',text:'Mathematics',latex:['d(x,z)\\\\le d(x,y)+d(y,z)'],aliases:[],relatedNotes:[]}); const objects=Array.from({length:18},(_,i)=>object('a'+i,i%3?'definition':'theorem')); const relations=[{id:'one',source:'a0',target:'a1',type:'references',provenance:'reference',evidenceHref:'notes/source.html'},{id:'two',source:'a1',target:'a2',type:'proof_of',provenance:'authored',evidenceHref:'notes/proof.html'},{id:'cross',source:'a0',target:'a13',type:'references',provenance:'reference',evidenceHref:'notes/cross.html'}]; window.opened=[]; window.graph=mountKnowledgeGraph(document.querySelector('#map'),{objects,relations,groups:[{id:'one',title:'第一章 · 度量与连续',objectIds:objects.slice(0,12).map(o=>o.id)},{id:'two',title:'第二章 · 紧性',objectIds:objects.slice(12).map(o=>o.id)}]},{siteRoot:new URL('/World/',location.href),onSelect:(id)=>window.opened.push(id)}); window.graph.setRecommendations([{id:'similar',source:'a2',target:'a3',type:'similar_to',provenance:'similarity'}]);`,
    resolveDir: root,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  outfile: path.join(dir, "fixture.js"),
  plugins: [sassPlugin()],
  loader: { ".woff": "file", ".woff2": "file", ".ttf": "file" },
})
await writeFile(
  path.join(dir, "index.html"),
  `<!doctype html><html lang="zh"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/World/fixture.css"><style>body{margin:0;background:#f5f5f3;font-family:system-ui}main{max-width:1180px;margin:24px auto;padding:20px}h1{font-size:28px}</style><main><h1>探索数学知识</h1><div id="map"></div></main><script type="module" src="/World/fixture.js"></script></html>`,
)
const server = createServer(async (req, res) => {
  const filename = new URL(req.url, "http://localhost").pathname.split("/").pop() || "index.html"
  try {
    const data = await readFile(path.join(dir, filename))
    res.setHeader(
      "Content-Type",
      filename.endsWith(".js")
        ? "text/javascript"
        : filename.endsWith(".css")
          ? "text/css"
          : filename.endsWith(".html")
            ? "text/html"
            : "application/octet-stream",
    )
    res.end(data)
  } catch {
    res.statusCode = 404
    res.end("Not found")
  }
})
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
const site = `http://127.0.0.1:${server.address().port}/World/`
const report = { startedAt: new Date().toISOString(), checks: [], screenshots: [] }
const check = (name, value) => {
  report.checks.push({ name, passed: Boolean(value) })
  console.log(`${value ? "PASS" : "FAIL"} ${name}`)
}
let browser
try {
  browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL ?? "msedge",
    headless: true,
  })
  report.browser = browser.version()
  for (const size of [
    { width: 1440, height: 1000 },
    { width: 1024, height: 900 },
    { width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({
      viewport: size,
      reducedMotion: "reduce",
      isMobile: size.width === 390,
      hasTouch: size.width === 390,
    })
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(site)
    await page.locator(".kg-group-list-item").first().waitFor()
    check(
      `${size.width}: global collection shapes present`,
      (await page.locator(".kg-group-outline").count()) === 2,
    )
    check(`${size.width}: no global atom hairball`, (await page.locator(".kg-node").count()) === 0)
    check(
      `${size.width}: no document overflow`,
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    if (size.width > 390)
      check(
        `${size.width}: chapter labels stay at least 12 screen pixels`,
        await page
          .locator(".kg-group-button")
          .first()
          .evaluate(
            (e) =>
              (parseFloat(getComputedStyle(e).fontSize) * e.getBoundingClientRect().width) /
                e.offsetWidth >=
              11.9,
          ),
      )
    const shot = async (suffix) => {
      const name = `knowledge-graph-${size.width}-${suffix}.png`
      await page.screenshot({ path: path.join(dir, name) })
      report.screenshots.push(path.relative(root, path.join(dir, name)).replaceAll(path.sep, "/"))
    }
    await shot("overview")
    await page.locator(".kg-group-list-item").first().click()
    check(
      `${size.width}: group exposes every registered object`,
      (await page.locator(".kg-list-item").count()) === 12,
    )
    check(
      `${size.width}: excerpt renders source inline math instead of Markdown markers`,
      (await page.locator(".kg-object-excerpt math").count()) === 12 &&
        !(await page.locator(".kg-object-excerpt").first().textContent()).includes("$"),
    )
    const first = page.locator(".kg-list-item").first()
    check(
      `${size.width}: subpath-safe independent address`,
      (await first.getAttribute("href")).endsWith("/World/atoms/a0.html"),
    )
    await first.focus()
    await page.keyboard.press("Enter")
    check(
      `${size.width}: keyboard opens object`,
      await page.evaluate(() => window.opened.at(-1) === "a0"),
    )
    check(
      `${size.width}: focus trigger survives selection`,
      await first.evaluate((node) => node === document.activeElement && node.isConnected),
    )
    check(
      `${size.width}: direct references with evidence shown`,
      (await page.locator(".kg-related-link").count()) === 2 &&
        (await page.locator(".kg-related .kg-evidence").count()) === 2,
    )
    if (size.width === 390) {
      check(
        "390: list is default; dense map is hidden",
        !(await page.locator(".kg-stage").isVisible()),
      )
      await page.getByRole("button", { name: "打开全屏地图", exact: true }).click()
      check("390: full map opens with touch surface", await page.locator(".kg-stage").isVisible())
      check(
        "390: full map opens at a readable semantic scale",
        await page.evaluate(() => window.graph.getState().camera.k >= 0.95),
      )
    }
    await shot("chapter")
    const pathTrigger = page.getByRole("button", { name: "查看连接路径", exact: true })
    await pathTrigger.click()
    const dialog = page.locator(".kg-path-dialog")
    await dialog.locator("select").nth(0).selectOption("a0")
    await dialog.locator("select").nth(1).selectOption("a2")
    await dialog.getByRole("button", { name: "查找路径", exact: true }).click()
    check(
      `${size.width}: path lists two evidence-backed steps`,
      (await dialog.locator("ol li").count()) === 2,
    )
    await dialog.locator("select").nth(1).selectOption("a3")
    await dialog.getByRole("button", { name: "查找路径", exact: true }).click()
    check(
      `${size.width}: model edge excluded by default`,
      (await dialog.locator(".kg-path-output").innerText()).includes("没有已登记"),
    )
    await dialog.locator("input").check()
    await dialog.getByRole("button", { name: "查找路径", exact: true }).click()
    check(
      `${size.width}: opt-in path visibly marks recommendation`,
      (await dialog.locator(".kg-path-output").innerText()).includes("含模型推荐") &&
        (await dialog.locator("ol li").count()) === 3,
    )
    await page.keyboard.press("Escape")
    check(
      `${size.width}: path Escape restores trigger focus`,
      await pathTrigger.evaluate((node) => node === document.activeElement),
    )
    if (size.width === 390) {
      const touch = await page.context().newCDPSession(page)
      const nodeBox = await page.locator(".kg-node[data-id='a0']").boundingBox()
      const before = await page.evaluate(() => ({
        p: window.graph.getState().positions.a0,
        n: window.opened.length,
      }))
      const x = nodeBox.x + nodeBox.width / 2,
        y = nodeBox.y + nodeBox.height / 2
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
      const after = await page.evaluate(() => ({
        p: window.graph.getState().positions.a0,
        n: window.opened.length,
      }))
      check(
        "390: simulated touch drag changes layout without opening object",
        Math.abs(after.p.x - before.p.x) > 10 && before.n === after.n,
      )
      const box = await page.locator(".kg-stage").boundingBox()
      const cx = box.x + box.width / 2,
        cy = box.y + box.height - 50
      const k = await page.evaluate(() => window.graph.getState().camera.k)
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: cx - 25, y: cy, id: 1 },
          { x: cx + 25, y: cy, id: 2 },
        ],
      })
      for (let step = 1; step <= 8; step++)
        await touch.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            { x: cx - 25 - step * 3, y: cy, id: 1 },
            { x: cx + 25 + step * 3, y: cy, id: 2 },
          ],
        })
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
      check(
        "390: simulated pinch zoom changes lens",
        await page.evaluate((previous) => window.graph.getState().camera.k > previous + 0.1, k),
      )
      await page.keyboard.press("Escape")
      check(
        "390: Escape leaves full map",
        (await page.locator(".knowledge-map.is-fullscreen").count()) === 0,
      )
    } else {
      await page.locator(".kg-svg").scrollIntoViewIfNeeded()
      const currentNode = page.locator(".kg-node[data-id='a0']")
      const point = await currentNode.boundingBox()
      const before = await page.evaluate(() => ({
        p: window.graph.getState().positions.a0,
        n: window.opened.length,
      }))
      await page.mouse.move(point.x + point.width / 2, point.y + 30)
      await page.mouse.down()
      await page.mouse.move(point.x + point.width / 2 + 60, point.y + 70, { steps: 10 })
      await page.mouse.up()
      const after = await page.evaluate(() => ({
        p: window.graph.getState().positions.a0,
        n: window.opened.length,
      }))
      check(
        `${size.width}: node drag changes layout without navigation`,
        Math.abs(after.p.x - before.p.x) > 10 && before.n === after.n,
      )
      const cameraBefore = await page.evaluate(() => window.graph.getState().camera.k)
      await page.getByRole("button", { name: "放大地图", exact: true }).click()
      check(
        `${size.width}: explicit zoom works`,
        await page.evaluate((k) => window.graph.getState().camera.k > k, cameraBefore),
      )
      const state = await page.evaluate(() => window.graph.getState())
      await page.evaluate(() => window.graph.setFocus("a13"))
      await page.evaluate((saved) => window.graph.restoreState(saved), state)
      check(
        `${size.width}: returning restores map positions and lens`,
        await page.evaluate(
          (saved) => JSON.stringify(window.graph.getState()) === JSON.stringify(saved),
          state,
        ),
      )
    }
    check(`${size.width}: no runtime errors`, errors.length === 0)
    await page.close()
  }
} catch (error) {
  report.error = error.stack
  console.error(error)
} finally {
  await browser?.close()
  await new Promise((resolve) => server.close(resolve))
  report.finishedAt = new Date().toISOString()
  report.passed = report.checks.filter((check) => check.passed).length
  report.failed = report.checks.filter((check) => !check.passed).length + (report.error ? 1 : 0)
  await writeFile(
    path.join(root, "artifacts", "knowledge-graph-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  )
  console.log(JSON.stringify({ passed: report.passed, failed: report.failed }))
  if (report.failed) process.exitCode = 1
}
