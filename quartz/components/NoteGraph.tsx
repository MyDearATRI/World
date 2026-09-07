import { useId } from "preact/hooks"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { buildNoteGraph, filterNoteGraph } from "../util/noteGraph"
// @ts-ignore
import script from "./scripts/noteGraph.inline"
import style from "./styles/noteGraph.scss"

export type NoteGraphProps = QuartzComponentProps & { variant?: "inline" | "launcher" }

const NoteGraph: QuartzComponent = ({
  allFiles,
  fileData,
  variant = "launcher",
}: NoteGraphProps) => {
  const id = `note-graph-${useId()}`
  if (fileData.frontmatter?.siteKind === "canvas") return null
  const graph = buildNoteGraph(allFiles, fileData.slug!)
  const scope = variant === "inline" ? "global" : "local"
  const initial = filterNoteGraph(graph, fileData.slug, scope, "all")
  return (
    <div
      class={`note-graph note-graph--${variant}`}
      data-graph={JSON.stringify(graph)}
      data-variant={variant}
      data-scope={scope}
      data-filter="all"
    >
      {variant === "inline" ? (
        <div class="note-graph-intro">
          <p>从联系中浏览</p>
          <button
            class="note-graph-open"
            type="button"
            aria-haspopup="dialog"
            aria-controls={`${id}-dialog`}
          >
            展开关系图 <span aria-hidden="true">↗</span>
          </button>
        </div>
      ) : (
        <button
          class="note-graph-open"
          type="button"
          aria-haspopup="dialog"
          aria-controls={`${id}-dialog`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" width="20" height="20">
            <path d="M5 6 18 8 10 19 5 6" fill="none" stroke="currentColor" />
            <circle cx="5" cy="6" r="3" fill="currentColor" />
            <circle cx="18" cy="8" r="2.5" fill="currentColor" />
            <circle cx="10" cy="19" r="2" fill="currentColor" />
          </svg>
          关联笔记 <span class="graph-open-en">Graph</span>
        </button>
      )}
      <div class="note-graph-inline-host" hidden={variant !== "inline"}>
        <section class="note-graph-panel" aria-label="公开笔记关系图">
          <header class="note-graph-header">
            <div>
              <p class="note-graph-kicker">The connected notebook</p>
              <h2 id={`${id}-title`}>笔记之间</h2>
            </div>
            <button class="note-graph-close" type="button" aria-label="关闭关系图">
              <span aria-hidden="true">×</span>
            </button>
          </header>
          <div class="note-graph-toolbar">
            <div class="note-graph-scope" role="group" aria-label="关系图范围">
              <button type="button" data-graph-scope="global" aria-pressed={scope === "global"}>
                全局
              </button>
              <button type="button" data-graph-scope="local" aria-pressed={scope === "local"}>
                当前关联
              </button>
            </div>
            <span class="note-graph-count" role="status" aria-live="polite">
              {initial.nodes.length} 篇笔记 · {initial.links.length} 条联系
            </span>
          </div>
          <div class="note-graph-filters" role="group" aria-label="笔记类型筛选">
            {(
              [
                ["all", "全部"],
                ["body", "正文"],
                ["plan", "规划"],
                ["example", "样例"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-graph-filter={value}
                aria-pressed={value === "all"}
              >
                {label}
              </button>
            ))}
          </div>
          <div class="note-graph-canvas">
            <svg
              class="note-graph-svg"
              role="group"
              aria-label="公开笔记关系图，可拖动节点或平移缩放"
              aria-describedby={`${id}-help`}
              tabIndex={0}
            />
            <p class="note-graph-error" role="status" hidden />
            <p class="note-graph-hover" aria-hidden="true" hidden />
            <div class="note-graph-controls" role="group" aria-label="关系图视图控制">
              <button type="button" data-graph-action="zoom-out" aria-label="缩小关系图">
                −
              </button>
              <button type="button" data-graph-action="zoom-in" aria-label="放大关系图">
                +
              </button>
              <button type="button" data-graph-action="fit">
                适应
              </button>
              <button type="button" data-graph-action="reset">
                重置
              </button>
              <button type="button" data-graph-action="pause" aria-pressed="false">
                暂停
              </button>
            </div>
          </div>
          <div class="note-graph-bottom">
            <p id={`${id}-help`}>拖动圆点或空白处 · 滚轮 / 双指缩放 · 点击圆点阅读</p>
            <details class="note-graph-list">
              <summary>笔记列表与键盘操作</summary>
              <p>
                Tab 选择节点，Enter 阅读。方向键移动节点或平移画布，+ / − 缩放，0 适应视图，Esc
                关闭。
              </p>
              <ul>
                {initial.nodes.map((node) => (
                  <li key={node.id}>
                    <a href={node.href} aria-current={node.current ? "page" : undefined}>
                      {node.title}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>
      </div>
      <dialog class="note-graph-dialog" id={`${id}-dialog`} aria-labelledby={`${id}-title`} />
      <noscript>
        <p>关系图的拖动与展开需要 JavaScript。已公开笔记仍可通过网站目录阅读。</p>
      </noscript>
    </div>
  )
}

NoteGraph.css = style
NoteGraph.afterDOMLoaded = script
export default NoteGraph
