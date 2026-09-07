import { ComponentChildren } from "preact"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { htmlToJsx } from "../util/jsx"
import { joinSegments, pathToRoot, resolveRelative, simplifySlug } from "../util/path"
import { CSSResourceToStyleElement, JSResourceToScriptElement } from "../util/resources"

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
  const sorted = [...allFiles].sort((a, b) =>
    a.slug === "index" ? -1 : b.slug === "index" ? 1 : a.slug!.localeCompare(b.slug!),
  )
  return (
    <>
      <a class="skip-link" href="#article-content">
        Skip to content · 跳至正文
      </a>
      <a class="site-title" href={pathToRoot(fileData.slug!)}>
        Mathematical
        <br class="desktop-break" /> Notes<span lang="zh-CN">数学笔记</span>
      </a>
      <nav class="note-navigation" aria-label="Notes">
        <p class="rail-label">The notebook</p>
        <ol>
          {sorted.map((file, index) => (
            <li key={file.slug}>
              <span class="note-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <a
                href={resolveRelative(fileData.slug!, file.slug!)}
                aria-current={file.slug === fileData.slug ? "page" : undefined}
              >
                {file.frontmatter?.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <nav class="reading-toc" aria-label="On this page">
        <p class="rail-label">On this page</p>
        <Contents {...props} />
      </nav>
    </>
  )
}

export const ReadingHeader: QuartzComponent = (props) => (
  <>
    <div class="article-eyebrow">
      <span>Analysis</span>
      <span>
        Sample note · <span lang="zh-CN">合成示例</span>
      </span>
    </div>
    <h1>{props.fileData.frontmatter?.title}</h1>
    <p class="article-deck">{props.fileData.frontmatter?.description}</p>
    <details class="mobile-toc">
      <summary>
        On this page <span lang="zh-CN">目录</span>
      </summary>
      <nav aria-label="On this page">
        <Contents {...props} />
      </nav>
    </details>
  </>
)

export const ReadingContent: QuartzComponent = ({ fileData, tree }) => (
  <article id="article-content" tabIndex={-1} aria-label={fileData.frontmatter?.title} role="main">
    {htmlToJsx(fileData.filePath!, tree) as ComponentChildren}
  </article>
)

export const ReadingConnections: QuartzComponent = ({ fileData, allFiles }) => {
  const backlinks = allFiles.filter(
    (file) => file.slug !== fileData.slug && file.links?.includes(simplifySlug(fileData.slug!)),
  )
  return (
    <nav class="connections" aria-label="Linked notes">
      <p class="rail-label">
        Connected notes <span lang="zh-CN">关联笔记</span>
      </p>
      {backlinks.map((file) => (
        <a key={file.slug} href={resolveRelative(fileData.slug!, file.slug!)}>
          {file.frontmatter?.title}
          <span aria-hidden="true"> ↗</span>
        </a>
      ))}
    </nav>
  )
}

export const ReadingFooter: QuartzComponent = () => (
  <footer class="reading-footer">
    <span>Mathematical Notes</span>
    <span lang="zh-CN">定义 · 推理 · 联系</span>
  </footer>
)
