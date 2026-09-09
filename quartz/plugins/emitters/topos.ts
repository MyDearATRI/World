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

/** A Quartz-emitted vertical prototype; never a second publisher or Vault reader. */
export const Topos: QuartzEmitterPlugin = () => ({
  name: "Topos",
  async *emit(ctx) {
    const base = path.resolve("knowledge/topos")
    for (const target of [path.dirname(base), base, path.join(base, "prototype.json")])
      if ((await fs.lstat(target)).isSymbolicLink())
        throw new Error(`Linked Topos source: ${target}`)
    const model = JSON.parse(
      await fs.readFile(path.join(base, "prototype.json"), "utf8"),
    ) as KnowledgeModel
    const sections: Record<string, string> = {}
    const pipeline = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype)
      .use(rehypeKatex, { output: "htmlAndMathml", strict: "error" })
    for (const section of model.sections) {
      if (!/^sections\/[a-z0-9-]+\.md$/.test(section.markdown))
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
    yield write({
      ctx,
      slug: "static/topos/index" as FullSlug,
      ext: ".json",
      content: JSON.stringify({ model, sections }),
    })
    yield write({
      ctx,
      slug: "topos" as FullSlug,
      ext: ".html",
      content: `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f4f2ed"><title>Knowledge Topos · Group</title><link rel="icon" href="data:,"><link rel="stylesheet" href="./static/fonts/serif.css"><link rel="stylesheet" href="./static/katex/katex.min.css"><link rel="stylesheet" href="./static/topos/topos.css"></head>
<body><main id="topos-world" aria-label="可连续探索的数学知识场"><canvas id="topos-canvas" aria-label="数学关系场：拖动概念，或拖动空白平移" tabindex="0"></canvas><div id="topos-labels"></div><div id="topos-explanations"></div><div id="topos-communities"></div><div id="topos-relations"></div>
<div class="topos-identity"><span>KNOWLEDGE TOPOS</span><small>群、作用与表示 · 交互原型</small></div>
<div class="topos-utility"><button type="button" data-back aria-label="返回上一语境">↶</button><button type="button" data-help aria-label="操作说明">?</button></div>
<div class="topos-guide" aria-live="polite">点击一个概念，观察周围如何改变。滚轮向内，展开它的含义。</div>
<div class="topos-instruments" aria-label="语境与语义深度"><div class="topos-lenses"><span>观察方式</span><button data-lens="structural" type="button">结构</button><button data-lens="action" type="button">作用</button><button data-lens="linear" type="button">线性</button></div><div class="topos-depth"><button data-zoom="out" type="button" aria-label="收拢语义层级">−</button><input type="range" min="0" max="3" step="0.05" value="1" aria-label="语义深度"><button data-zoom="in" type="button" aria-label="深入语义层级">＋</button><output>概念与关系</output></div></div>
<dialog class="topos-help"><button type="button" data-close-help aria-label="关闭说明">关闭</button><h1>沿着一个想法走进去</h1><p>点击改变当前语境；拖动概念感受关联牵引。拖动空白移动视野，滚轮或双指缩放逐层展开含义。</p><p>聚焦概念后，用“展开定义”进入原位解释。解释中的条目可以继续展开；浏览器后退恢复上一语境。键盘 Tab 选择概念，Enter 聚焦；＋／− 调整语义深度，方向键平移。</p><p>这是以公开数学定义编写的 Group → Action → Representation 合成原型，不是私人笔记的新导出。线条的名称与来源说明其关系；空间距离不是数学命题。</p><button type="button" data-labels-toggle>暂时隐藏文字，观察结构</button><a href="./index.html">已有教材与完整笔记</a></dialog>
<p class="topos-status" role="status">正在准备概念场…</p><noscript><p>这个交互原型需要 JavaScript。<a href="./index.html">阅读已有教材</a>。</p></noscript></main><script type="module" src="./static/topos/topos.js"></script></body></html>`,
    })
  },
})
