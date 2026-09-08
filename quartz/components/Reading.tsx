import { ComponentChildren } from "preact"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { htmlToJsx } from "../util/jsx"
import { joinSegments, pathToRoot, resolveRelative, simplifySlug, FullSlug } from "../util/path"
import {
  CSSResourceToStyleElement,
  JSResourceToScriptElement,
  concatenateResources,
} from "../util/resources"
import NoteGraph from "./NoteGraph"
import { KnowledgeSearch, SpatialReading } from "./SpatialReading"
import { getReaderCatalog, ReaderBook, ReaderChapter, ReaderCatalog } from "../util/readerCatalog"
// @ts-ignore
import readingScript from "./scripts/reading.inline"
// @ts-ignore
import interfaceMotion from "./scripts/interfaceMotion.inline"

const href = (from: string, to: string) => resolveRelative(from as FullSlug, to as FullSlug)
const roleNames: Record<string, string> = {
  reading: "章节研读",
  knowledge: "知识点",
  connection: "联系",
  exercise: "习题与核校",
  auxiliary: "附属资料",
  other: "笔记",
}
function context(props: QuartzComponentProps) {
  const catalog = getReaderCatalog(props.allFiles)
  const slug = props.fileData.slug!
  const page = catalog.pages[slug]
  const book = catalog.books.find((item) => item.id === page?.bookId)
  const chapter = book?.chapters.find((item) => item.id === page?.chapterId)
  return { catalog, slug, page, book, chapter }
}

export const ReadingHead: QuartzComponent = ({ cfg, fileData, externalResources }) => {
  const root = pathToRoot(fileData.slug!)
  return (
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>
        {fileData.frontmatter?.title}
        {cfg.pageTitleSuffix}
      </title>
      <meta
        name="description"
        content={fileData.frontmatter?.description ?? fileData.description}
      />
      <meta name="generator" content="Quartz 4.5.2" />
      <meta name="color-scheme" content="light" />
      <link rel="icon" href="data:," />
      <link rel="stylesheet" href={joinSegments(root, "static/fonts/serif.css")} />
      <link rel="stylesheet" href={joinSegments(root, "static/katex/katex.min.css")} />
      {externalResources.css.map((r) => CSSResourceToStyleElement(r))}
      {externalResources.js
        .filter((r) => r.loadTime === "beforeDOMReady")
        .map((r) => JSResourceToScriptElement(r))}
    </head>
  )
}

function Contents({ fileData }: QuartzComponentProps) {
  return (
    <ol>
      {(fileData.toc ?? []).map((entry) => (
        <li key={entry.slug}>
          <a href={`#${entry.slug}`}>{entry.text}</a>
        </li>
      ))}
    </ol>
  )
}

function NoteLink({
  catalog,
  from,
  to,
  children,
}: {
  catalog: ReaderCatalog
  from: string
  to: string
  children?: ComponentChildren
}) {
  const item = catalog.pages[to]
  if (!item) return null
  return (
    <a href={href(from, to)} data-reader-slug={item.role === "knowledge" ? to : undefined}>
      {children ?? item.title}
    </a>
  )
}

export const ReadingRail: QuartzComponent = (props) => {
  const { slug, page, book, chapter } = context(props)
  const landing = slug === "index" || page?.role === "book" || page?.role === "chapter"
  return (
    <>
      <a class="skip-link" href="#article-content">
        跳至正文
      </a>
      <div
        id="reader-context"
        data-page-slug={slug}
        data-root={pathToRoot(slug)}
        data-book-id={book?.id ?? ""}
        hidden
      />
      <a class="site-title" href={pathToRoot(slug)}>
        Notes &amp; Knowledge<span lang="zh-CN">数学与物理笔记</span>
      </a>
      <div class="book-tools">
        <KnowledgeSearch {...props} />
      </div>
      {book ? (
        <nav class="book-navigation" aria-label="本书目录">
          <a class="rail-book-title" href={href(slug, book.slug)}>
            {book.title}
          </a>
          <details class="book-directory">
            <summary>
              章节目录{" "}
              <span class="current-section-label">
                {page?.role === "reading" ? props.fileData.frontmatter?.title : "选择章节"}
              </span>
            </summary>
            <div class="reader-chapters">
              {book.chapters.map((item) => (
                <details class="reader-chapter" key={item.id} open={item.id === chapter?.id}>
                  <summary>{item.title}</summary>
                  <a class="chapter-overview-link" href={href(slug, item.slug)}>
                    本章总览
                  </a>
                  <ol>
                    {item.sections.map((section) => (
                      <li key={section.slug}>
                        <a
                          href={href(slug, section.slug)}
                          aria-current={section.slug === slug ? "page" : undefined}
                        >
                          {section.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </details>
              ))}
            </div>
          </details>
          <a class="rail-knowledge-link" href={`${href(slug, book.slug)}#knowledge-index`}>
            查找本书知识点
          </a>
          <a class="rail-shelf-link" href={pathToRoot(slug)}>
            返回书架
          </a>
        </nav>
      ) : (
        <nav class="shelf-navigation" aria-label="网站导航">
          <a href={pathToRoot(slug)} aria-current={slug === "index" ? "page" : undefined}>
            书架
          </a>
          <a href={`${pathToRoot(slug)}/#about-notes`}>关于这些笔记</a>
        </nav>
      )}
      {!landing && (props.fileData.toc?.length ?? 0) > 0 && (
        <nav class="reading-toc" aria-label="本页目录">
          <p class="rail-label">本页内容</p>
          <Contents {...props} />
        </nav>
      )}
      <a class="rail-explore-link" href={joinSegments(pathToRoot(slug), "explore.html")}>
        探索知识空间 →
      </a>
      <SpatialReading {...props} />
    </>
  )
}
ReadingRail.css = concatenateResources(SpatialReading.css, NoteGraph.css)
ReadingRail.afterDOMLoaded = concatenateResources(
  SpatialReading.afterDOMLoaded,
  NoteGraph.afterDOMLoaded,
  readingScript,
  interfaceMotion,
)

export const ReadingHeader: QuartzComponent = (props) => {
  const { slug, page, book, chapter } = context(props)
  const home = slug === "index"
  const title = home
    ? "数学知识空间"
    : page?.role === "book"
      ? book!.title
      : page?.role === "chapter"
        ? chapter!.title
        : props.fileData.frontmatter?.title
  return (
    <>
      {!home && (
        <nav class="breadcrumbs" aria-label="所在位置">
          <a href={pathToRoot(slug)}>书架</a>
          {book && (
            <>
              <span aria-hidden="true"> / </span>
              {page?.role === "book" ? (
                <span>{book.title}</span>
              ) : (
                <a href={href(slug, book.slug)}>{book.title}</a>
              )}
            </>
          )}
          {chapter && (
            <>
              <span aria-hidden="true"> / </span>
              {page?.role === "chapter" ? (
                <span>{chapter.title}</span>
              ) : (
                <a href={href(slug, chapter.slug)}>{chapter.title}</a>
              )}
            </>
          )}
        </nav>
      )}
      <div class="article-eyebrow">
        <span>
          {home
            ? "数学与物理 · 知识空间"
            : page?.role === "book"
              ? "按章节读 · 按知识点查"
              : page?.role === "chapter"
                ? "本章阅读"
                : slug === "explore"
                  ? "按对象探索"
                  : roleNames[page?.role ?? "other"]}
        </span>
        {!home && slug !== "explore" && !props.fileData.knowledgeObjectId && (
          <details class="reader-meta">
            <summary>整理信息</summary>
            <div>
              {String(props.fileData.frontmatter?.status ?? "")}
              {props.fileData.frontmatter?.layer
                ? ` · ${String(props.fileData.frontmatter.layer)}`
                : ""}
            </div>
          </details>
        )}
      </div>
      <h1 class="page-title" data-reading-role={home ? "shelf" : (page?.role ?? "other")}>
        {title}
      </h1>
      {home ? (
        <p class="article-deck shelf-deck">沿一本书读下去，也可以从一个定义出发。</p>
      ) : page?.role === "book" ? (
        <p class="article-deck">
          {book!.subtitle}
          <span class="book-source">{book!.source}</span>
        </p>
      ) : null}
      {!home &&
        page?.role !== "book" &&
        page?.role !== "chapter" &&
        (props.fileData.toc?.length ?? 0) > 0 && (
          <details class="mobile-toc">
            <summary>本页目录</summary>
            <nav aria-label="本页目录">
              <Contents {...props} />
            </nav>
          </details>
        )}
    </>
  )
}

function SectionList({
  chapter,
  catalog,
  from,
}: {
  chapter: ReaderChapter
  catalog: ReaderCatalog
  from: string
}) {
  return (
    <ol class="section-list">
      {chapter.sections.map((section) => (
        <li key={section.slug}>
          <a class="section-reading-link" href={href(from, section.slug)}>
            <span class="section-number">{section.number}</span>
            <span>{section.title.replace(/^\d+\.\d+\s*[·.、—-]?\s*/, "")}</span>
            <span class="section-arrow" aria-hidden="true">
              →
            </span>
          </a>
          {section.knowledge.length > 0 && (
            <div class="section-concepts">
              <span class="concept-label">知识点</span>
              {section.knowledge.map((target) => (
                <NoteLink key={target} catalog={catalog} from={from} to={target} />
              ))}
            </div>
          )}
        </li>
      ))}
    </ol>
  )
}

function KnowledgeIndex({
  book,
  catalog,
  from,
  chapterOnly,
}: {
  book: ReaderBook
  catalog: ReaderCatalog
  from: string
  chapterOnly?: ReaderChapter
}) {
  const chapters = chapterOnly ? [chapterOnly] : book.chapters
  return (
    <section class="knowledge-index" id="knowledge-index" aria-label="知识点索引">
      <div class="section-caption">
        <h2>知识点</h2>
        <p>点开查看，关闭后继续读</p>
      </div>
      <label class="knowledge-filter-label">
        筛选知识点
        <input
          type="search"
          class="knowledge-filter"
          placeholder="名称、别名或节号"
          autoComplete="off"
        />
      </label>
      <p class="knowledge-filter-status" role="status" aria-live="polite" />
      {chapters.map((chapter) => (
        <section class="knowledge-group" key={chapter.id} data-knowledge-group={chapter.id}>
          {!chapterOnly && <h3>{chapter.title}</h3>}
          <ul>
            {chapter.knowledge.map((target) => {
              const item = catalog.pages[target]
              if (!item) return null
              const related = book.chapters
                .flatMap((ch) => ch.sections)
                .filter((section) => item.sections.includes(section.slug))
              return (
                <li key={target} class="knowledge-index-item" data-knowledge-slug={target}>
                  <NoteLink catalog={catalog} from={from} to={target} />
                  <span class="knowledge-related">
                    {related.length ? (
                      <>
                        相关节{" "}
                        {related.map((section, i) => (
                          <span key={section.slug}>
                            {i > 0 && " · "}
                            <a href={href(from, section.slug)}>{section.number}</a>
                          </span>
                        ))}
                      </>
                    ) : (
                      "本章补充知识"
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <p class="knowledge-empty" hidden>
        没有匹配的知识点。换一个名称，或使用教材全文搜索。
      </p>
    </section>
  )
}

function ChapterExtras({
  chapter,
  catalog,
  from,
}: {
  chapter: ReaderChapter
  catalog: ReaderCatalog
  from: string
}) {
  const groups = [
    { title: "联系与应用", items: chapter.connections },
    { title: "习题与核校", items: chapter.exercises },
    { title: "作者编排的关系白板", items: chapter.canvas },
  ]
  return (
    <div class="chapter-extras">
      {groups
        .filter((group) => group.items.length)
        .map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            <ul>
              {group.items.map((target) => (
                <li key={target}>
                  <NoteLink catalog={catalog} from={from} to={target} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function Original({
  props,
  title = "原始导航说明",
}: {
  props: QuartzComponentProps
  title?: string
}) {
  return (
    <details class="source-navigation">
      <summary>{title}</summary>
      <div class="source-note-metadata">
        <h2>{props.fileData.frontmatter?.title}</h2>
        <p class="source-note-status">
          {String(props.fileData.frontmatter?.status ?? "")}
          {props.fileData.frontmatter?.layer
            ? ` · ${String(props.fileData.frontmatter.layer)}`
            : ""}
        </p>
      </div>
      <div class="markdown-content">
        {htmlToJsx(props.fileData.filePath!, props.tree) as ComponentChildren}
      </div>
    </details>
  )
}

export const ReadingContent: QuartzComponent = (props) => {
  const { catalog, slug, page, book, chapter } = context(props)
  const home = slug === "index"
  const landing = home || slug === "explore" || page?.role === "book" || page?.role === "chapter"
  const sequence = book?.chapters.flatMap((item) => item.sections) ?? []
  const position = sequence.findIndex((item) => item.slug === slug)
  const previous = position > 0 ? sequence[position - 1] : undefined
  const next = position >= 0 ? sequence[position + 1] : undefined
  const concepts = position >= 0 ? sequence[position].knowledge : []
  return (
    <article
      id="article-content"
      class={`${landing ? "catalog-article" : "book-article"}${home ? " home-article" : ""}`}
      tabIndex={-1}
      aria-label={home ? "书架" : props.fileData.frontmatter?.title}
      role="main"
    >
      {home ? (
        <>
          <nav class="spatial-entry" aria-label="选择进入知识空间的方式">
            <a href="#bookshelf">
              <span class="entry-number">01 / READ</span>
              <strong>按书阅读 →</strong>
              <small>保留完整论述，沿章节逐步展开。</small>
            </a>
            <a href={joinSegments(pathToRoot(slug), "explore.html")}>
              <span class="entry-number">02 / EXPLORE</span>
              <strong>探索知识 →</strong>
              <small>从定义、定理与证明，走向相关笔记。</small>
            </a>
          </nav>
          <div class="bookshelf" id="bookshelf">
            {catalog.books.map((item, index) => (
              <section class="shelf-book" key={item.id}>
                <div class="book-spine" aria-hidden="true">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <svg class="book-cover-art" viewBox="0 0 120 110" fill="none">
                    <path d="M18 82 57 22 103 70 18 82 83 94 57 22M18 82 66 61 103 70M66 61 83 94" />
                    <circle cx="18" cy="82" r="4" />
                    <circle cx="57" cy="22" r="4" />
                    <circle cx="103" cy="70" r="4" />
                    <circle cx="66" cy="61" r="4" />
                    <circle cx="83" cy="94" r="4" />
                  </svg>
                  <span>ANALYSIS</span>
                </div>
                <div class="shelf-book-body">
                  <p class="shelf-book-source">{item.source}</p>
                  <h2>
                    <a href={href(slug, item.slug)}>{item.title}</a>
                  </h2>
                  <p>{item.subtitle}</p>
                  <p class="shelf-book-extent">
                    {item.chapters.length} 章已有正文 ·{" "}
                    {item.chapters.reduce((sum, ch) => sum + ch.sections.length, 0)} 节研读 ·{" "}
                    {item.chapters.reduce((sum, ch) => sum + ch.knowledge.length, 0)} 个知识点
                  </p>
                  <a class="reader-primary shelf-enter" href={href(slug, item.slug)}>
                    进入阅读 <span aria-hidden="true">→</span>
                  </a>
                </div>
              </section>
            ))}
          </div>
          <section id="about-notes" class="about-notes">
            <details>
              <summary>
                关于这些笔记 <span>写作说明与附属资料</span>
              </summary>
              <p>这里保留写作说明、模板演示与规划入口，供需要时查阅。</p>
              <ul>
                {Object.values(catalog.pages)
                  .filter(
                    (item) =>
                      item.auxiliary &&
                      item.slug !== "index" &&
                      !item.bookId &&
                      !item.slug.startsWith("maps/"),
                  )
                  .map((item) => (
                    <li key={item.slug}>
                      <a href={href(slug, item.slug)}>{item.title}</a>
                    </li>
                  ))}
              </ul>
              <Original props={props} title="查看原首页说明" />
            </details>
          </section>
        </>
      ) : page?.role === "book" && book ? (
        <>
          <nav class="book-view-nav" aria-label="选择阅读方式">
            <a href="#chapter-readings">按章节阅读</a>
            <a href="#knowledge-index">查找知识点</a>
            <a href="#book-map" class="secondary-view-link">
              查看章节地图
            </a>
          </nav>
          <nav class="chapter-jump" aria-label="快速选择章节">
            {book.chapters.map((item, index) => (
              <a href={`#${item.id}`} key={item.id}>
                <span class="chapter-jump-number" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span class="chapter-jump-main">
                  {item.title}
                  <small>{item.sections.length} 节研读</small>
                </span>
              </a>
            ))}
          </nav>
          <section id="chapter-readings" class="book-chapters-view">
            {book.chapters.map((item) => (
              <section class="chapter-block" key={item.id} id={item.id}>
                <header>
                  <h2>
                    <a href={href(slug, item.slug)}>{item.title}</a>
                  </h2>
                  <span>
                    {item.sections.length} 节 · {item.knowledge.length} 个知识点
                  </span>
                </header>
                <SectionList chapter={item} catalog={catalog} from={slug} />
              </section>
            ))}
          </section>
          <KnowledgeIndex book={book} catalog={catalog} from={slug} />
          <section class="reader-map-section" id="book-map">
            <div class="section-caption">
              <h2>章节地图</h2>
              <p>先选章，再看知识点之间的联系</p>
            </div>
            <NoteGraph {...props} bookId={book.id} variant="inline" />
          </section>
          <details class="future-chapters">
            <summary>后续章节与写作规划</summary>
            <p>以下资料保留来源目录与写作安排，不代表章节正文已经完成。</p>
            <ul>
              {book.plans.map((target) => (
                <li key={target}>
                  <NoteLink catalog={catalog} from={slug} to={target} />
                </li>
              ))}
            </ul>
            <a href={href(slug, book.contentsSlug)}>完整来源目录</a>
          </details>
          <Original props={props} />
        </>
      ) : page?.role === "chapter" && chapter && book ? (
        <>
          <div class="chapter-start">
            <p>
              {chapter.sections.length} 节研读 · {chapter.knowledge.length} 个知识点
            </p>
            {chapter.sections[0] && (
              <a class="reader-primary" href={href(slug, chapter.sections[0].slug)}>
                开始本章 <span aria-hidden="true">→</span>
              </a>
            )}
          </div>
          <nav class="book-view-nav" aria-label="本章入口">
            <a href="#chapter-readings">按节阅读</a>
            <a href="#knowledge-index">本章知识点</a>
            <a href="#chapter-map" class="secondary-view-link">
              看本章关系
            </a>
          </nav>
          <section id="chapter-readings">
            <SectionList chapter={chapter} catalog={catalog} from={slug} />
          </section>
          <KnowledgeIndex book={book} catalog={catalog} from={slug} chapterOnly={chapter} />
          <ChapterExtras chapter={chapter} catalog={catalog} from={slug} />
          <section id="chapter-map" class="reader-map-section">
            <div class="section-caption">
              <h2>本章关系</h2>
              <p>点开知识点，对照正文阅读</p>
            </div>
            <NoteGraph {...props} bookId={book.id} chapterId={chapter.id} variant="inline" />
          </section>
          <Original props={props} />
        </>
      ) : (
        <>
          {concepts.length > 0 && (
            <details class="section-knowledge" aria-label="本节知识点" open>
              <summary>本节知识点 · {concepts.length}</summary>
              <div>
                {concepts.map((target) => (
                  <NoteLink key={target} catalog={catalog} from={slug} to={target} />
                ))}
              </div>
            </details>
          )}
          {page?.role === "knowledge" && page.sections.length > 0 && (
            <nav class="related-readings" aria-label="相关研读节">
              <span>在这些章节中使用</span>
              {page.sections.map((target) => (
                <NoteLink key={target} catalog={catalog} from={slug} to={target} />
              ))}
            </nav>
          )}
          <div class="markdown-content">
            {htmlToJsx(props.fileData.filePath!, props.tree) as ComponentChildren}
          </div>
          {(previous || next) && (
            <nav class="reading-sequence" aria-label="沿章节阅读">
              {previous ? (
                <a rel="prev" href={href(slug, previous.slug)}>
                  <span>上一节</span>
                  {previous.title}
                </a>
              ) : (
                <span />
              )}
              {next && (
                <a rel="next" href={href(slug, next.slug)}>
                  <span>下一节</span>
                  {next.title}
                </a>
              )}
            </nav>
          )}
        </>
      )}
    </article>
  )
}

export const ReadingConnections: QuartzComponent = (props) => {
  const { catalog, slug, page, book, chapter } = context(props)
  if (slug === "index" || page?.role === "book" || page?.role === "chapter" || page?.auxiliary)
    return null
  const backlinks = props.allFiles.filter(
    (file) =>
      file.slug !== slug &&
      file.links?.includes(simplifySlug(slug)) &&
      catalog.pages[file.slug!]?.bookId &&
      !catalog.pages[file.slug!]?.auxiliary &&
      !["book", "chapter"].includes(catalog.pages[file.slug!]?.role),
  )
  return (
    <section class="connections" aria-label="继续阅读">
      <div class="section-caption">
        <h2>继续阅读</h2>
        {chapter && <a href={href(slug, chapter.slug)}>返回本章目录</a>}
      </div>
      {backlinks.length > 0 && (
        <>
          <p class="rail-label">引用本页的正文</p>
          <ul>
            {backlinks.slice(0, 5).map((file) => (
              <li key={file.slug}>
                <NoteLink catalog={catalog} from={slug} to={file.slug!} />
              </li>
            ))}
          </ul>
          {backlinks.length > 5 && (
            <details>
              <summary>其余 {backlinks.length - 5} 篇引用</summary>
              <ul>
                {backlinks.slice(5).map((file) => (
                  <li key={file.slug}>
                    <NoteLink catalog={catalog} from={slug} to={file.slug!} />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {book && <NoteGraph {...props} bookId={book.id} chapterId={chapter?.id} variant="launcher" />}
    </section>
  )
}

export const ReadingFooter: QuartzComponent = ({ fileData }) => (
  <footer class="reading-footer">
    <a href={pathToRoot(fileData.slug!)}>Notes &amp; Knowledge</a>
    <a href={`${pathToRoot(fileData.slug!)}/#about-notes`}>关于这些笔记</a>
  </footer>
)
