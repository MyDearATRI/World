import type { QuartzEmitterPlugin } from "../types"
import type { FullSlug } from "../../util/path"
import type { KnowledgeModel } from "../../util/topos/types"
import { write } from "./helpers"
import fs from "node:fs/promises"
import path from "node:path"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import remarkRehype from "remark-rehype"
import rehypeKatex from "rehype-katex"
import { toHtml } from "hast-util-to-html"
import preparedJSON from "../../../knowledge/index.json"
import type { KnowledgeIndex } from "../../util/knowledge"
import { buildPublishedTopos } from "../../util/topos/published"
import type { Root } from "hast"
import { renderTranscludes } from "../../util/transcludes"
import type { QuartzPluginData } from "../vfile"
import { createHash } from "node:crypto"
import noteTopics from "../../../knowledge/topos/note-topics.json"
import { attachNoteTopics, createAtlas } from "../../util/topos/atlas"

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

const contentHash = (content: string | Uint8Array) =>
  createHash("sha256").update(content).digest("hex")

function host(
  model: KnowledgeModel,
  indexPath: string,
  runtime: { script: string; style: string },
) {
  const demo = model.mode === "demo"
  const atlas = model.mode === "atlas"
  const identity = atlas
    ? "数学标题地图 · 分类、前沿与来源"
    : demo
      ? "群、作用与表示 · 合成演示"
      : `${model.stats?.atoms ?? 0} 个知识原子 · ${model.stats?.notes ?? 0} 篇完整笔记`
  const description = atlas
    ? "标题来自独立的分类与来源注册表，归属连线不表示证明依赖；未提供个人正文或 Lean 验证。"
    : demo
      ? "这是以公开数学定义编写的 Group → Action → Representation 合成演示，与实际笔记分开保存。"
      : "这里展开已有公开笔记中的定义、定理、论证和完整正文。没有独立登记原子的笔记也完整保留；书籍和章节仅说明出处。"
  const lenses = model.lenses ?? [
    { id: "structural", label: "结构" },
    { id: "action", label: "作用" },
    { id: "linear", label: "线性" },
  ]
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f4f2ed"><title>${escapeHtml(model.title)} · Knowledge Topos</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./static/fonts/serif.css"><link rel="stylesheet" href="./static/katex/katex.min.css"><link rel="stylesheet" href="./static/topos/topos.css?v=${runtime.style}"></head>
<body data-topos-index="${indexPath}"><main id="topos-world" data-mode="${model.mode}" data-index="${indexPath}" aria-label="可连续探索的数学知识场"><canvas id="topos-canvas" aria-label="数学关系场：拖动概念，或拖动空白平移" tabindex="0"></canvas><div id="topos-labels"></div><div id="topos-explanations"></div><div id="topos-communities"></div><div id="topos-relations"></div>
<div class="topos-identity"><span>KNOWLEDGE TOPOS</span><small>${escapeHtml(identity)}</small></div>
<div class="topos-utility"><button type="button" data-back aria-label="返回上一语境">↶</button><button type="button" data-help aria-label="操作说明">?</button></div>
<div class="topos-guide" aria-live="polite">${demo ? "点击一个概念，观察周围如何改变。" : "从主题栏勾选范围，点击节点继续探索。"}滚轮向内，展开${atlas ? "分类与来源" : "它的含义"}。</div>
<div class="topos-instruments" aria-label="语境与语义深度"><div class="topos-lenses"><span>观察方式</span>${lenses.map((lens) => `<button data-lens="${lens.id}" type="button">${escapeHtml(lens.label)}</button>`).join("")}</div><div class="topos-depth"><button data-zoom="out" type="button" aria-label="收拢语义层级">−</button><input type="range" min="0" max="3" step="0.05" value="1" aria-label="语义深度"><button data-zoom="in" type="button" aria-label="深入语义层级">＋</button><output>概念与关系</output></div></div>
<dialog class="topos-help"><button type="button" data-close-help aria-label="关闭说明">关闭</button><h1>沿着一个想法走进去</h1><p>选择主题先查看完整名称、对象类型和联系，再进入一处知识。拖动节点调整它的位置，松手后保留落点；关联对象只作短暂的局部响应。拖动空白移动视野，滚轮或双指缩放展开原文。</p><p>聚焦后可以展开原文，继续查看相关内容；浏览器后退恢复上一语境。键盘 Tab 选择概念，Enter 聚焦；＋／− 调整语义深度，方向键平移。</p><p>${escapeHtml(description)} 线条的名称与来源说明其关系；正文引用不等同于先修条件，空间距离不是数学命题。</p><button type="button" data-labels-toggle>暂时隐藏文字，观察结构</button><a href="./library.html">按书阅读与完整目录</a><a href="${demo ? "./topos.html" : "./topos-demo.html"}">${demo ? "回到实际笔记的知识空间" : "查看群、作用与表示的合成演示"}</a></dialog>
<p class="topos-status" role="status">正在准备知识空间…</p><noscript><p>知识空间的交互需要 JavaScript。<a href="./library.html">阅读已有笔记与教材目录</a>。</p></noscript></main><script type="module" src="./static/topos/topos.js?v=${runtime.script}"></script></body></html>`
}

/** One Quartz pipeline: real rendered notes by default, the synthetic prototype kept separately. */
export const Topos: QuartzEmitterPlugin = () => ({
  name: "Topos",
  async *emit(ctx, content, resources) {
    const [scriptBytes, styleBytes] = await Promise.all([
      fs.readFile("quartz/static/topos/topos.js"),
      fs.readFile("quartz/static/topos/topos.css"),
    ])
    const runtime = { script: contentHash(scriptBytes), style: contentHash(styleBytes) }
    const allFiles = content.map(([, file]) => file.data)
    const expand = (original: Root, fileData: QuartzPluginData) => {
      const tree = structuredClone(original)
      renderTranscludes(
        tree,
        ctx.cfg.configuration,
        fileData.slug!,
        {
          ctx,
          cfg: ctx.cfg.configuration,
          tree,
          fileData,
          allFiles,
          children: [],
          externalResources: resources,
        },
        new Set([fileData.slug!]),
      )
      return tree
    }
    const published = buildPublishedTopos(
      preparedJSON as KnowledgeIndex,
      content.map(([tree, file]) => ({
        slug: String(file.data.slug),
        tree: expand(tree, file.data),
        fragments: file.data.atomFragments?.map((fragment) => ({
          ...fragment,
          before: expand(fragment.before, file.data),
          tree: expand(fragment.tree, file.data),
          context: expand(fragment.context, file.data),
        })),
        status:
          typeof file.data.frontmatter?.status === "string"
            ? file.data.frontmatter.status
            : undefined,
        layer:
          typeof file.data.frontmatter?.layer === "string"
            ? file.data.frontmatter.layer
            : undefined,
      })),
    )
    const sectionFiles: Record<string, string> = {}
    attachNoteTopics(published.model, noteTopics)
    for (const section of published.model.sections) {
      const html = published.sections[section.id]
      const digest = createHash("sha256").update(`${section.id}\0${html}`).digest("hex")
      sectionFiles[section.id] = `./static/topos/sections/${digest}.json`
      yield write({
        ctx,
        slug: `static/topos/sections/${digest}` as FullSlug,
        ext: ".json",
        content: JSON.stringify({ id: section.id, html }),
      })
    }
    const publishedIndex = JSON.stringify({ model: published.model, sections: {}, sectionFiles })
    yield write({
      ctx,
      slug: "static/topos/index" as FullSlug,
      ext: ".json",
      content: publishedIndex,
    })
    for (const slug of ["index", "topos"])
      yield write({
        ctx,
        slug: slug as FullSlug,
        ext: ".html",
        content: host(
          published.model,
          `./static/topos/index.json?v=${contentHash(publishedIndex)}`,
          runtime,
        ),
      })

    const registry = JSON.parse(await fs.readFile("ontology/math_registry.json", "utf8"))
    const sourceRegistry = JSON.parse(await fs.readFile("ontology/sources.json", "utf8"))
    const atlas = createAtlas(registry, sourceRegistry.sources)
    const atlasIndex = JSON.stringify(atlas)
    yield write({ ctx, slug: "static/topos/atlas" as FullSlug, ext: ".json", content: atlasIndex })
    yield write({
      ctx,
      slug: "atlas" as FullSlug,
      ext: ".html",
      content: host(atlas.model, `./static/topos/atlas.json?v=${contentHash(atlasIndex)}`, runtime),
    })
    // Explicit public research outputs only; no prompt, machine audit, or private input copy.
    for (const file of ["math_registry.json", "math_outline.md", "sources.json", "audit.json"]) {
      const ext = path.extname(file) as `.${string}`
      yield write({
        ctx,
        slug: `static/ontology/${file.slice(0, -ext.length)}` as FullSlug,
        ext,
        content: await fs.readFile(`ontology/${file}`, "utf8"),
      })
    }

    const base = path.resolve("knowledge/topos")
    for (const target of [path.dirname(base), base, path.join(base, "prototype.json")])
      if ((await fs.lstat(target)).isSymbolicLink())
        throw new Error(`Linked Topos source: ${target}`)
    const model = JSON.parse(
      await fs.readFile(path.join(base, "prototype.json"), "utf8"),
    ) as KnowledgeModel
    model.mode = "demo"
    const sections: Record<string, string> = {}
    const pipeline = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex, { output: "htmlAndMathml", strict: "error" })
    for (const section of model.sections) {
      if (!section.markdown || !/^sections\/[a-z0-9-]+\.md$/.test(section.markdown))
        throw new Error(`Invalid Topos section: ${section.markdown}`)
      const file = path.join(base, section.markdown)
      for (const target of [base, path.join(base, "sections"), file])
        if ((await fs.lstat(target)).isSymbolicLink())
          throw new Error(`Linked Topos content: ${target}`)
      const markdown = await fs.readFile(file, "utf8")
      const rendered = await pipeline.run(pipeline.parse(markdown))
      sections[section.id] = toHtml(rendered)
      if (sections[section.id].includes('class="katex-error"'))
        throw new Error(`Topos formula error: ${section.id}`)
    }
    const demoIndex = JSON.stringify({ model, sections })
    yield write({
      ctx,
      slug: "static/topos/demo" as FullSlug,
      ext: ".json",
      content: demoIndex,
    })
    yield write({
      ctx,
      slug: "topos-demo" as FullSlug,
      ext: ".html",
      content: host(model, `./static/topos/demo.json?v=${contentHash(demoIndex)}`, runtime),
    })
  },
})
