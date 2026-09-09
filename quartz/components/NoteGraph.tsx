import { QuartzComponent, QuartzComponentProps } from "./types"
import { buildReaderGraph, readerChapterGraph } from "../util/noteGraph"
import { getReaderCatalog } from "../util/readerCatalog"

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
    <details class="knowledge-map-entry" data-graph={JSON.stringify(graph)}>
      <summary>
        展开三维关系图 <span>沿书、章、节探索知识</span>
      </summary>
      <div
        class="knowledge-map-host"
        data-knowledge-map=""
        data-book-id={bookId}
        data-chapter-id={chapterId}
        data-initial-focus={variant === "launcher" ? `note:${fileData.slug}` : undefined}
      >
        <p>正在准备知识地图。也可以沿下列入口阅读。</p>
        <ul>
          {(initial?.nodes ?? graph.chapters).map((node) => (
            <li key={node.id}>
              <a href={node.href}>{node.title}</a>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
// The shared SpatialReading controller loads the 3D map only when expanded.
NoteGraph.css = ""
NoteGraph.afterDOMLoaded = ""
export default NoteGraph
