import { QuartzComponent } from "./types"
// @ts-ignore
import script from "./scripts/knowledgeReader.inline"
import style from "./styles/knowledgeReader.scss"

const KnowledgeReader: QuartzComponent = () => (
  <dialog class="knowledge-reader" aria-labelledby="knowledge-reader-title">
    <div class="knowledge-reader-toolbar">
      <button type="button" class="knowledge-reader-back" disabled>
        返回上一条
      </button>
      <button type="button" class="knowledge-reader-close" aria-label="关闭知识阅读面板">
        关闭 ×
      </button>
    </div>
    <header class="knowledge-reader-header">
      <p class="knowledge-reader-location" />
      <h2 id="knowledge-reader-title" tabIndex={-1}>
        知识条目
      </h2>
      <nav aria-label="知识条目位置">
        <a class="knowledge-reader-chapter" href="#" hidden>
          所属章节
        </a>
        <a class="knowledge-reader-independent" href="#" data-reader-independent="true">
          独立打开 ↗
        </a>
      </nav>
    </header>
    <p class="knowledge-reader-status" role="status" aria-live="polite" />
    <div class="knowledge-reader-body" />
  </dialog>
)

KnowledgeReader.css = style
KnowledgeReader.afterDOMLoaded = script
export default KnowledgeReader
