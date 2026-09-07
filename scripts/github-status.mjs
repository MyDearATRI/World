import { setTimeout as delay } from "node:timers/promises"

const sha = process.argv[2]
if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Expected the exact published Git commit")
const repo = "MyDearATRI/World"
const api = `https://api.github.com/repos/${repo}/actions/runs?branch=main&event=push&head_sha=${sha}&per_page=5`
const deadline = Date.now() + 20 * 60_000
let lastStatus = ""
while (Date.now() < deadline) {
  const response = await fetch(api, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "World-publication-check" },
    signal: AbortSignal.timeout(25_000),
  })
  if (!response.ok)
    throw new Error(
      `GitHub status HTTP ${response.status}; inspect https://github.com/${repo}/actions`,
    )
  const result = await response.json()
  const run = result.workflow_runs.find(
    (run) => run.head_sha === sha && run.path === ".github/workflows/pages.yml",
  )
  if (run) {
    const status = `${run.status} ${run.conclusion ?? ""}`.trim()
    if (status !== lastStatus) {
      console.log(`GitHub Pages: ${status}\n${run.html_url}`)
      lastStatus = status
    }
    if (run.status === "completed") {
      if (run.conclusion !== "success") throw new Error(`Publication failed: ${run.html_url}`)
      console.log("博客已更新：https://mydearatri.github.io/World/")
      process.exit(0)
    }
  } else if (!lastStatus) {
    console.log("推送已完成，等待 GitHub 创建发布任务……")
    lastStatus = "waiting"
  }
  await delay(30_000)
}
throw new Error(`等待发布超时；提交已推送，可继续在 https://github.com/${repo}/actions 查看结果。`)
