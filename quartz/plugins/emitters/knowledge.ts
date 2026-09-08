import type { Root, Element, Text, ElementContent } from "hast"
import { relocateAtomFragment } from "../../util/atomHast"
import { write } from "./helpers"
import { pageResources, renderPage } from "../../components/renderPage"
import { defaultContentPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { ReadingContent } from "../../components/Reading"
import { FullSlug, pathToRoot } from "../../util/path"
import type { QuartzEmitterPlugin } from "../types"
import type { QuartzComponentProps } from "../../components/types"
import type { KnowledgeIndex, KnowledgeObject } from "../../util/knowledge"
import { atomTypeLabels } from "../../util/knowledge"
import preparedJSON from "../../../knowledge/index.json"
import type { AtomFragment } from "../transformers/atoms"
import type { BuildCtx } from "../../util/ctx"
import type { StaticResources } from "../../util/resources"
import type { QuartzPluginData } from "../vfile"
import fs from "node:fs/promises"

const prepared = preparedJSON as KnowledgeIndex
const element = (
  tagName: string,
  properties: Element["properties"],
  children: Element["children"],
): Element => ({ type: "element", tagName, properties, children })
const text = (value: string): Text => ({ type: "text", value })
async function renderKnowledgePage(
  ctx: BuildCtx,
  resources: StaticResources,
  allFiles: QuartzPluginData[],
  slug: FullSlug,
  title: string,
  tree: Root,
  object?: KnowledgeObject,
) {
  const externalResources = pageResources(pathToRoot(slug), resources)
  const fileData: QuartzPluginData = {
    slug,
    frontmatter: { title, tags: [], siteKind: "body" },
    description: object?.excerpt ?? "按对象类型与真实引用探索数学笔记。",
    knowledgeObjectId: object?.id,
    text: object?.text ?? "",
    toc: [],
    links: [],
  }
  const props: QuartzComponentProps = {
    ctx,
    cfg: ctx.cfg.configuration,
    fileData,
    externalResources,
    children: [],
    tree,
    allFiles,
  }
  return write({
    ctx,
    slug,
    ext: ".html",
    content: renderPage(
      ctx.cfg.configuration,
      slug,
      props,
      { ...sharedPageComponents, ...defaultContentPageLayout, pageBody: ReadingContent },
      externalResources,
    ),
  })
}

export const Knowledge: QuartzEmitterPlugin = () => ({
  name: "Knowledge",
  async *emit(ctx, content, resources) {
    const files = content.map(([, file]) => file.data)
    const fragments = new Map<string, { slug: string; fragment: AtomFragment }>()
    for (const [, file] of content)
      for (const fragment of file.data.atomFragments ?? []) {
        const object = prepared.objects.find((item) => item.id === fragment.id)!
        if (object.sourceSlug === file.data.slug && fragment.id === fragment.occurrenceId)
          fragments.set(fragment.id, { slug: file.data.slug!, fragment })
      }
    for (const object of prepared.objects.filter((item) => item.kind === "atom")) {
      const entry = fragments.get(object.id)
      if (!entry) throw new Error(`Rendered atom missing: ${object.id}; publication stopped`)
      const sourceList = element(
        "nav",
        { className: ["atom-source-links"], "aria-label": "原文与出现位置" },
        [
          element("p", { className: ["atom-kind"] }, [
            text(
              `${atomTypeLabels[object.type] ?? object.type} · ${object.proofStatus ?? "原文状态保留"}`,
            ),
          ]),
          element(
            "ul",
            {},
            (object.occurrences ?? []).map((occurrence) =>
              element("li", {}, [
                element(
                  "a",
                  { href: `../${occurrence.href}`, "data-knowledge-id": `note:${occurrence.slug}` },
                  [
                    text(
                      prepared.objects.find((item) => item.id === `note:${occurrence.slug}`)
                        ?.title ?? occurrence.slug.split("/").at(-1)!,
                    ),
                  ],
                ),
              ]),
            ),
          ),
        ],
      )
      const fragment = relocateAtomFragment(entry.fragment.tree, entry.slug, object.id)
      const before = relocateAtomFragment(entry.fragment.before, entry.slug, `${object.id}-setting`)
      const context = relocateAtomFragment(
        entry.fragment.context,
        entry.slug,
        `${object.id}-context`,
      )
      const tree: Root = { type: "root", children: [] }
      if (before.children.length)
        tree.children.push(
          element("section", { className: ["atom-required-setting"], "aria-label": "原文设定" }, [
            element("p", { className: ["atom-setting-label"] }, [text("原文设定")]),
            ...(before.children as ElementContent[]),
          ]),
        )
      tree.children.push(...fragment.children)
      if (context.children.some((node) => node.type === "element"))
        tree.children.push(
          element("details", { className: ["atom-source-context"], open: true }, [
            element("summary", {}, [text("原文上下文 · 设定与相邻论证")]),
            ...(context.children as ElementContent[]),
          ]),
        )
      tree.children.push(sourceList)
      yield renderKnowledgePage(
        ctx,
        resources,
        files,
        `atoms/${object.id}` as FullSlug,
        object.title,
        tree,
        object,
      )
    }
    const grouped = prepared.groups.map((group) =>
      element("section", { className: ["knowledge-group"], id: group.id }, [
        element("h2", {}, [text(group.title)]),
        element(
          "ul",
          {},
          prepared.objects
            .filter((object) => object.kind === "atom" && group.objectIds.includes(object.id))
            .map((object) =>
              element("li", {}, [
                element("a", { href: `./${object.href}`, "data-atom-id": object.id }, [
                  text(`${atomTypeLabels[object.type] ?? object.type} · ${object.title}`),
                ]),
              ]),
            ),
        ),
      ]),
    )
    for (const alias of prepared.aliases ?? []) {
      const canonical = prepared.objects.find((object) => object.id === alias.canonicalId)
      if (!canonical || !/^a-\d+$/.test(alias.id) || !/^a-\d+$/.test(alias.canonicalId))
        throw new Error("Invalid registered atom alias")
      yield write({
        ctx,
        slug: `atoms/${alias.id}` as FullSlug,
        ext: ".html",
        content: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>数学对象的统一阅读地址</title><meta http-equiv="refresh" content="0;url=./${alias.canonicalId}.html"><link rel="canonical" href="./${alias.canonicalId}.html"></head><body><main class="markdown-content"><h1>数学对象已归入同一阅读页</h1><p>原来的笔记与出处仍然保留。</p><a href="./${alias.canonicalId}.html">打开数学对象</a></main></body></html>`,
      })
    }
    yield renderKnowledgePage(ctx, resources, files, "explore" as FullSlug, "探索知识", {
      type: "root",
      children: [
        element("p", {}, [
          text("从定义、定理和证明进入笔记。选择对象以阅读原文，并循有出处的关系继续探索。"),
        ]),
        element("div", { "data-knowledge-map": "", className: ["knowledge-map-host"] }, []),
        element("details", { className: ["knowledge-list-fallback"] }, [
          element("summary", {}, [text("按章节列出全部数学对象")]),
          ...grouped,
        ]),
      ],
    })
    yield write({
      ctx,
      slug: "static/knowledge-index" as FullSlug,
      ext: ".json",
      content: JSON.stringify(prepared),
    })
    const semantic = await fs
      .readFile("knowledge/semantic.json", "utf8")
      .then(JSON.parse)
      .catch((error) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
    if (semantic) {
      if (semantic.snapshotHash !== prepared.snapshotHash)
        throw new Error("Semantic index snapshot does not match prepared public content")
      yield write({
        ctx,
        slug: "static/semantic" as FullSlug,
        ext: ".json",
        content: JSON.stringify(semantic),
      })
    }
  },
})
