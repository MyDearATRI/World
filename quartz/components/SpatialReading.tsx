import type { QuartzComponent } from "./types"
// @ts-ignore
import script from "./scripts/spatialReading.inline"
import style from "./styles/spatialReading.scss"

export const KnowledgeSearch: QuartzComponent = () => (
  <button class="space-search-launch" type="button" data-space-command>
    <span>搜索知识与笔记</span>
    <kbd>⌘ / Ctrl K</kbd>
  </button>
)

export const SpatialReading: QuartzComponent = () => (
  <>
    <section class="knowledge-space" aria-label="知识阅读空间" hidden>
      <header class="space-topbar">
        <a data-space-home href="#">
          Notes &amp; Knowledge
        </a>
        <nav aria-label="探索操作">
          <button type="button" data-space-back>
            返回
          </button>
          <button type="button" data-space-command>
            搜索
          </button>
          <button type="button" data-space-map-toggle>
            局部地图
          </button>
          <button type="button" data-space-close>
            回到来处
          </button>
        </nav>
      </header>
      <div class="space-layout">
        <aside class="space-context" aria-label="探索来路">
          <p class="space-label">探索来路</p>
          <ol data-space-trail />
          <div data-space-origin />
          <a data-space-explore href="#">
            探索全部知识 →
          </a>
        </aside>
        <main class="space-focus" tabIndex={-1}>
          <header class="space-object-heading">
            <p class="space-type" data-space-type />
            <h2 data-space-title aria-level={1} tabIndex={-1} />
            <p class="space-proof-status" data-space-proof hidden />
            <nav class="space-object-tools" aria-label="对象操作">
              <a data-space-independent data-space-native href="#">
                独立打开 ↗
              </a>
              <button type="button" data-space-copy>
                复制地址
              </button>
            </nav>
          </header>
          <p class="space-loading" data-space-status role="status" />
          <div class="space-body" />
          <section class="space-map-region" hidden>
            <header>
              <h2>周围的知识</h2>
              <button type="button" data-space-map-toggle>
                收起地图
              </button>
            </header>
            <div data-space-local-map />
          </section>
        </main>
        <aside class="space-relations" aria-label="相关内容">
          <details open>
            <summary>相关笔记与出处</summary>
            <div data-space-notes />
          </details>
          <details open>
            <summary>原文中的联系</summary>
            <div data-space-relations />
          </details>
          <details open>
            <summary>内容相似 · 机器推荐</summary>
            <p class="space-aside-note">根据已公开内容计算，不代表数学推导或先修关系。</p>
            <div data-space-similar />
          </details>
        </aside>
      </div>
    </section>
    <dialog class="knowledge-command" aria-labelledby="knowledge-command-title">
      <header>
        <h2 id="knowledge-command-title">找到一个知识对象</h2>
        <button type="button" data-command-close aria-label="关闭知识搜索">
          关闭 ×
        </button>
      </header>
      <label for="knowledge-query">名称、别名、正文或数学记号</label>
      <input
        id="knowledge-query"
        type="search"
        placeholder="例如：度量、compactness、\\forall"
        autoComplete="off"
      />
      <div class="command-filters">
        <label>
          类型
          <select data-command-type>
            <option value="">全部对象</option>
            <option value="atom">知识原子</option>
            <option value="note">完整笔记</option>
          </select>
        </label>
        <label>
          范围
          <select data-command-scope>
            <option value="">全部公开内容</option>
          </select>
        </label>
        <label>
          关系
          <select data-command-relation>
            <option value="">全部关系</option>
          </select>
        </label>
        <label class="command-aux">
          <input type="checkbox" data-command-aux />
          包含附属资料
        </label>
      </div>
      <p data-command-status role="status">
        搜索在此设备上进行。
      </p>
      <ol class="command-results" aria-label="知识搜索结果" />
      <details class="semantic-options">
        <summary>本机语义搜索 · 可选</summary>
        <p>
          普通搜索与相似推荐无需下载。启用后，查询只在你自己的设备运行，不连接作者账号或私人笔记。
        </p>
        <p data-model-description>公开开源模型 · multilingual-e5-small</p>
        <div class="semantic-actions">
          <button type="button" data-model-enable>
            查看下载信息
          </button>
          <button type="button" data-model-cancel hidden>
            取消
          </button>
          <button type="button" data-model-clear>
            清除本网站模型缓存
          </button>
        </div>
        <progress data-model-progress max="100" value="0" hidden />
        <p data-model-status role="status">
          未启用，不影响阅读与普通搜索。
        </p>
      </details>
      <p class="command-help">↑ ↓ 选择 · Enter 阅读 · Esc 关闭</p>
    </dialog>
    <aside class="atom-preview" aria-label="知识预览" hidden>
      <p class="space-type" />
      <h3 />
      <div class="atom-preview-excerpt" />
      <div class="atom-preview-formula" />
      <p class="atom-preview-relations" />
      <a href="#">展开阅读 →</a>
    </aside>
  </>
)
SpatialReading.css = style
SpatialReading.afterDOMLoaded = script
