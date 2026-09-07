import { QuartzComponent } from "./types"
import { joinSegments, pathToRoot } from "../util/path"
// @ts-ignore
import script from "./scripts/bookSearch.inline"
import style from "./styles/bookSearch.scss"

const BookSearch: QuartzComponent = ({ fileData }) => {
  const root = pathToRoot(fileData.slug!)
  return (
    <div class="book-search" data-search-index={joinSegments(root, "static/bookIndex.json")}>
      <form class="book-search-launch" role="search">
        <label class="book-search-label" for="book-search-launch-input">
          搜索教材
        </label>
        <div class="book-search-launch-row">
          <input
            id="book-search-launch-input"
            class="book-search-launch-input"
            type="search"
            placeholder="标题、别名或正文"
            autoComplete="off"
            aria-haspopup="dialog"
          />
          <button type="submit" class="book-search-open" aria-label="打开教材搜索">
            搜索
          </button>
        </div>
        <span class="book-search-shortcut">Ctrl / ⌘ K</span>
      </form>
      <dialog class="book-search-dialog" aria-labelledby="book-search-title">
        <header class="book-search-header">
          <h2 id="book-search-title">搜索教材</h2>
          <button class="book-search-close" type="button" aria-label="关闭搜索">
            关闭 <span aria-hidden="true">×</span>
          </button>
        </header>
        <label class="book-search-label" for="book-search-query">
          标题、别名、章节、正文或标签
        </label>
        <input
          id="book-search-query"
          class="book-search-query"
          type="search"
          autoComplete="off"
          placeholder="例如：度量、compactness"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded="false"
          aria-controls="book-search-results"
          autoFocus
        />
        <div class="book-search-filters">
          <label class="book-search-scope-label" for="book-search-scope">
            搜索范围
            <select id="book-search-scope" class="book-search-scope" aria-label="搜索范围">
              <option value="">所有书籍</option>
            </select>
          </label>
          <label class="book-search-aux-label">
            <input type="checkbox" class="book-search-aux" />
            包含规划与辅助资料
          </label>
        </div>
        <p class="book-search-status" role="status" aria-live="polite">
          输入关键词，搜索公开教材。
        </p>
        <ul
          id="book-search-results"
          class="book-search-results"
          role="listbox"
          aria-label="搜索结果"
        />
        <p class="book-search-help">↑ ↓ 选择 · Enter 阅读 · Esc 关闭。搜索只在本网站进行。</p>
      </dialog>
    </div>
  )
}

BookSearch.css = style
BookSearch.afterDOMLoaded = script
export default BookSearch
