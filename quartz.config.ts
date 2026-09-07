import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import { LocalMath } from "./quartz/plugins/transformers/localMath"
import { SemanticBlocks } from "./quartz/plugins/transformers/semanticBlocks"
import { ReadingContent } from "./quartz/components/Reading"
import { ApprovedAssets } from "./quartz/plugins/emitters/approvedAssets"
import { BookIndex } from "./quartz/plugins/emitters/bookIndex"
import { ReaderMetadata } from "./quartz/plugins/transformers/readerMetadata"

// Quartz 4.5.2 — d25a6eabf96751ffca56f8a8139272def7a65041.
// Only the manifest-verified website/content export is an input.
const colors = {
  light: "#fafaf8",
  lightgray: "#d9dde2",
  gray: "#65707a",
  darkgray: "#282c32",
  dark: "#1c2430",
  secondary: "#31577c",
  tertiary: "#23425e",
  highlight: "#edf1f5",
  textHighlight: "#e4ebf2",
}

const config: QuartzConfig = {
  configuration: {
    pageTitle: "Notes & Knowledge",
    pageTitleSuffix: " · Notes & Knowledge",
    enableSPA: false,
    enablePopovers: false,
    analytics: null,
    locale: "en-US",
    baseUrl: "mydearatri.github.io/World",
    ignorePatterns: [".obsidian", "private", "templates"],
    defaultDateType: "published",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: { header: "system-ui", body: "Noto Serif SC", code: "monospace" },
      colors: { lightMode: colors, darkMode: colors },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      ReaderMetadata(),
      Plugin.SyntaxHighlighting({ keepBackground: false }),
      Plugin.ObsidianFlavoredMarkdown({
        enableInHtmlEmbed: false,
        mermaid: false,
        parseTags: false,
      }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents({ minEntries: 0, maxDepth: 2 }),
      Plugin.CrawlLinks({ markdownLinkResolution: "absolute", externalLinkIcon: false }),
      Plugin.Description(),
      LocalMath(),
      SemanticBlocks(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.ComponentResources(),
      Plugin.ContentPage({ pageBody: ReadingContent }),
      Plugin.ContentIndex({ enableSiteMap: false, enableRSS: false }),
      BookIndex(),
      ApprovedAssets(),
      Plugin.Static(),
    ],
  },
}

export default config
