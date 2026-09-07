import { useId } from "preact/hooks"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { buildReaderGraph, readerChapterGraph } from "../util/noteGraph"
import { getReaderCatalog } from "../util/readerCatalog"
// @ts-ignore
import script from "./scripts/noteGraph.inline"
import style from "./styles/noteGraph.scss"

export type NoteGraphProps = QuartzComponentProps & {
  variant?: "inline" | "launcher"
  bookId?: string
  chapterId?: string
}
const NoteGraph: QuartzComponent = ({
  allFiles,
  fileData,
  variant = "launcher",
  bookId,
  chapterId,
}: NoteGraphProps) => {
  const id = `note-graph-${useId()}`
  const graph = buildReaderGraph(allFiles, fileData.slug!, getReaderCatalog(allFiles), {
    bookId,
    chapterId,
    focusCurrent: variant === "launcher",
  })
  if (!graph) return null
  const initial = graph.initialChapterId
    ? readerChapterGraph(graph, graph.initialChapterId, graph.initialFocusId)
    : undefined
  return (
    <div
      class={`note-graph note-graph--${variant}`}
      data-graph={JSON.stringify(graph)}
      data-variant={variant}
      data-graph-level={initial ? "chapter" : "book"}
    >
      <div class="note-graph-intro">
        {variant === "inline" && <p>{initial ? "这一章的知识点" : "按章节展开"}</p>}
        <button
          class="note-graph-open"
          type="button"
          aria-haspopup="dialog"
          aria-controls={`${id}-dialog`}
        >
          {variant === "inline" ? "打开关系图" : "查看相关知识"} <span aria-hidden="true">↗</span>
        </button>
      </div>
      {variant === "inline" && (
        <div class="note-graph-compact" aria-label="章节与知识点列表">
          <ul>
            {initial
              ? initial.nodes.map((node) => (
                  <li key={node.id}>
                    <a href={node.href} data-graph-read={node.id}>
                      {node.title}
                    </a>
                  </li>
                ))
              : graph.chapters.map((chapter) => (
                  <li key={chapter.id}>
                    <a href={chapter.href} data-graph-chapter-link={chapter.id}>
                      {chapter.title}
                      <span>{chapter.knowledge.length} 个知识点</span>
                    </a>
                  </li>
                ))}
          </ul>
        </div>
      )}
      <div class="note-graph-inline-host" hidden={variant !== "inline"}>
        <section class="note-graph-panel" aria-label="章节与知识点关系图">
          <header class="note-graph-header">
            <div>
              <p class="note-graph-kicker">Read through connections</p>
              <h2 id={`${id}-title`}>知识之间</h2>
            </div>
            <button class="note-graph-close" type="button" aria-label="关闭关系图">
              ×
            </button>
          </header>
          <div class="note-graph-toolbar">
            <nav class="note-graph-breadcrumbs" aria-label="关系图层级">
              <button type="button" data-graph-action="book">
                全书章节
              </button>
              <span class="note-graph-chapter-name" />
            </nav>
            <span class="note-graph-count" role="status" aria-live="polite" />
          </div>
          <label class="note-graph-focus-control">
            聚焦知识点
            <select class="note-graph-focus-select" aria-label="聚焦知识点">
              <option value="">本章全部知识点</option>
            </select>
          </label>
          <div class="note-graph-canvas">
            <svg
              class="note-graph-svg"
              role="group"
              aria-label="章节是矩形，知识点是圆点；可拖动知识点"
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
          <aside class="note-graph-cross" hidden>
            <p>跨章相关内容</p>
            <ul />
          </aside>
          <div class="note-graph-bottom">
            <p id={`${id}-help`}>
              矩形展开章节，圆点打开阅读面板。连线仅表示已有引用，不表示先修顺序。
            </p>
            <details class="note-graph-list">
              <summary>列表与键盘操作</summary>
              <p>
                Tab 选择，Enter 阅读或展开章节；拖动圆点或空白，滚轮／双指缩放。方向键移动节点，Esc
                关闭。
              </p>
              <ul />
            </details>
          </div>
        </section>
      </div>
      <dialog class="note-graph-dialog" id={`${id}-dialog`} aria-labelledby={`${id}-title`} />
    </div>
  )
}
NoteGraph.css = style
NoteGraph.afterDOMLoaded = script
export default NoteGraph
