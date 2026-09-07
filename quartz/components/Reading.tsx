import { ComponentChildren } from "preact"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { htmlToJsx } from "../util/jsx"
import { joinSegments, pathToRoot, resolveRelative, simplifySlug } from "../util/path"
import {
  CSSResourceToStyleElement,
  JSResourceToScriptElement,
  concatenateResources,
} from "../util/resources"
import NoteGraph from "./NoteGraph"
import BookSearch from "./BookSearch"
import {
  bookTree,
  compareBookLabels,
  readingSequence,
  type BookBranch,
} from "../util/bookNavigation"
// @ts-ignore
import readingScript from "./scripts/reading.inline"

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
      {externalResources.css.map((resource) => CSSResourceToStyleElement(resource))}
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

export const ReadingRail: QuartzComponent = (props) => {
  const { fileData, allFiles } = props
  const renderBranch = (branch: BookBranch): ComponentChildren => (
    <ul>
      {[...branch.files]
        .sort((a, b) =>
          a.slug === "index"
            ? -1
            : b.slug === "index"
              ? 1
              : compareBookLabels(a.frontmatter!.title, b.frontmatter!.title),
        )
        .map((file) => (
          <li key={file.slug}>
            <a
              href={resolveRelative(fileData.slug!, file.slug!)}
              aria-current={file.slug === fileData.slug ? "page" : undefined}
              title={file.frontmatter?.title}
            >
              {file.slug === "index" ? "首页" : file.frontmatter?.title}
            </a>
            {file.frontmatter?.siteKind === "plan" && <span class="tree-status">规划</span>}
            {file.frontmatter?.siteKind === "example" && <span class="tree-status">示例</span>}
          </li>
        ))}
      {[...branch.branches.values()]
        .sort((a, b) => compareBookLabels(a.name, b.name))
        .map((child) => (
          <li key={child.path} class="book-branch">
            <details open={fileData.slug?.startsWith(`${child.path}/`)}>
              <summary>{child.name}</summary>
              {renderBranch(child)}
            </details>
          </li>
        ))}
    </ul>
  )
  return (
    <>
      <a class="skip-link" href="#article-content">
        Skip to content · 跳至正文
      </a>
      <a class="site-title" href={pathToRoot(fileData.slug!)}>
        Notes &amp; Knowledge<span lang="zh-CN">数学与物理笔记</span>
      </a>
      <div class="book-tools">
        <BookSearch {...props} />
        <NoteGraph {...props} />
      </div>
      <nav class="book-navigation" aria-label="教材目录">
        <details class="book-directory">
          <summary>
            教材目录 <span>Contents</span>
          </summary>
          {renderBranch(bookTree(allFiles))}
        </details>
      </nav>
      <nav class="reading-toc" aria-label="On this page">
        <p class="rail-label">On this page</p>
        <Contents {...props} />
      </nav>
    </>
  )
}

ReadingRail.css = concatenateResources(NoteGraph.css, BookSearch.css)
ReadingRail.afterDOMLoaded = concatenateResources(
  NoteGraph.afterDOMLoaded,
  BookSearch.afterDOMLoaded,
  readingScript,
)

export const ReadingHeader: QuartzComponent = (props) => {
  const { fileData, allFiles } = props
  const home = fileData.slug === "index"
  const kind = String(fileData.frontmatter?.siteKind ?? "body")
  const labels: Record<string, string> = {
    body: "正文",
    navigation: "阅读路线",
    plan: "写作规划",
    example: "示例",
    canvas: "关系白板",
  }
  const parts = fileData.slug!.split("/").slice(0, -1)
  return (
    <>
      {!home && (
        <nav class="breadcrumbs" aria-label="所在位置">
          <a href={pathToRoot(fileData.slug!)}>首页</a>
          {parts.map((part, i) => {
            const directory = parts.slice(0, i + 1).join("/")
            const landing = allFiles.find(
              (file) =>
                file.frontmatter?.siteKind === "navigation" &&
                file.slug?.slice(0, file.slug.lastIndexOf("/")) === directory,
            )
            return (
              <span key={directory}>
                <span aria-hidden="true"> / </span>
                {landing && landing.slug !== fileData.slug ? (
                  <a href={resolveRelative(fileData.slug!, landing.slug!)}>{part}</a>
                ) : (
                  part
                )}
              </span>
            )
          })}
        </nav>
      )}
      <div class="article-eyebrow">
        <span>{home ? "Mathematics · Physics" : (labels[kind] ?? "笔记")}</span>
        <span class="note-status">
          {String(fileData.frontmatter?.status ?? "")}
          {fileData.frontmatter?.layer ? ` · ${String(fileData.frontmatter.layer)}` : ""}
        </span>
      </div>
      <h1>{props.fileData.frontmatter?.title}</h1>
      {fileData.frontmatter?.description && (
        <p class="article-deck">{fileData.frontmatter.description}</p>
      )}
      {!home && (
        <details class="mobile-toc">
          <summary>
            On this page <span lang="zh-CN">目录</span>
          </summary>
          <nav aria-label="On this page">
            <Contents {...props} />
          </nav>
        </details>
      )}
    </>
  )
}

export const ReadingContent: QuartzComponent = (props) => {
  const { fileData, tree, allFiles } = props
  const home = fileData.slug === "index"
  const sequence = readingSequence(fileData, allFiles)
  const position = sequence.findIndex((file) => file.slug === fileData.slug)
  const previous = sequence[position - 1],
    next = position >= 0 ? sequence[position + 1] : undefined
  const source = allFiles.find(
    (file) =>
      file.slug !== "index" &&
      file.frontmatter?.siteKind === "navigation" &&
      file.slug?.endsWith("笔记主体"),
  )
  return (
    <article
      id="article-content"
      class={home ? "home-article" : "book-article"}
      tabIndex={-1}
      aria-label={fileData.frontmatter?.title}
      role="main"
    >
      {home && (
        <div class="home-intro">
          <p>连续阅读 · 概念检索 · 笔记之间的联系</p>
          <a
            class="start-reading"
            href={source ? resolveRelative(fileData.slug!, source.slug!) : "#notes"}
          >
            进入笔记主体 <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}
      <div class="markdown-content">{htmlToJsx(fileData.filePath!, tree) as ComponentChildren}</div>
      {home && (
        <section class="home-graph" aria-label="全库关系图">
          <div class="section-caption">
            <h2>笔记之间</h2>
            <p>从已有链接探索教材结构</p>
          </div>
          <NoteGraph {...props} variant="inline" />
        </section>
      )}
      {(previous || next) && (
        <nav class="reading-sequence" aria-label="沿章节阅读">
          {previous ? (
            <a rel="prev" href={resolveRelative(fileData.slug!, previous.slug!)}>
              <span>上一节</span>
              {previous.frontmatter?.title}
            </a>
          ) : (
            <span />
          )}
          {next && (
            <a rel="next" href={resolveRelative(fileData.slug!, next.slug!)}>
              <span>下一节</span>
              {next.frontmatter?.title}
            </a>
          )}
        </nav>
      )}
    </article>
  )
}

export const ReadingConnections: QuartzComponent = ({ fileData, allFiles }) => {
  if (fileData.slug === "index") return null
  const backlinks = allFiles.filter(
    (file) => file.slug !== fileData.slug && file.links?.includes(simplifySlug(fileData.slug!)),
  )
  return (
    <nav class="connections" aria-label="Linked notes">
      <p class="rail-label">
        Connected notes <span lang="zh-CN">关联笔记</span>
      </p>
      <ul>
        {backlinks.slice(0, 8).map((file) => (
          <li key={file.slug}>
            <a key={file.slug} href={resolveRelative(fileData.slug!, file.slug!)}>
              {file.frontmatter?.title}
              <span aria-hidden="true"> ↗</span>
            </a>
          </li>
        ))}
      </ul>
      {backlinks.length > 8 && (
        <details>
          <summary>其余 {backlinks.length - 8} 篇引用</summary>
          <ul>
            {backlinks.slice(8).map((file) => (
              <li key={file.slug}>
                <a href={resolveRelative(fileData.slug!, file.slug!)}>{file.frontmatter?.title}</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      {!backlinks.length && <p>目前没有其他公开笔记链接到本页。</p>}
    </nav>
  )
}

export const ReadingFooter: QuartzComponent = () => (
  <footer class="reading-footer">
    <span>Notes &amp; Knowledge</span>
    <span lang="zh-CN">定义 · 推理 · 联系</span>
  </footer>
)
