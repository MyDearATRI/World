import readerConfig from "../../reader.config"
import { simplifySlug, slugifyFilePath } from "./path"
import type { FilePath, FullSlug } from "./path"

export interface ReaderMetadata {
  links: string[]
  headings: { depth: number; title: string; links: string[] }[]
}

export interface ReaderFile {
  slug?: string
  frontmatter?: { title?: string; siteKind?: unknown; [key: string]: unknown }
  links?: readonly string[]
  readerMetadata?: ReaderMetadata
}

export interface ReaderSection {
  slug: string
  title: string
  number: string
  knowledge: string[]
}

export interface ReaderChapter {
  id: string
  title: string
  slug: string
  sections: ReaderSection[]
  knowledge: string[]
  connections: string[]
  exercises: string[]
  canvas: string[]
}

export interface ReaderBook {
  id: string
  title: string
  subtitle: string
  source: string
  slug: string
  contentsSlug: string
  chapters: ReaderChapter[]
  plans: string[]
}

export type ReaderRole =
  | "book"
  | "chapter"
  | "reading"
  | "knowledge"
  | "connection"
  | "exercise"
  | "auxiliary"
  | "other"

export interface ReaderPage {
  slug: string
  title: string
  bookId?: string
  chapterId?: string
  role: ReaderRole
  /** Full slugs of associated continuous section readings, possibly in several chapters. */
  sections: string[]
  auxiliary: boolean
}

export interface ReaderDiagnostic {
  code:
    | "missing-config-target"
    | "unconfigured-chapter"
    | "missing-chapter-entry"
    | "unmapped-knowledge"
    | "unindexed-reading"
    | "duplicate-section-number"
  slug: string
  message: string
}

export interface ReaderCatalog {
  version: 1
  books: ReaderBook[]
  pages: Record<string, ReaderPage>
  diagnostics?: ReaderDiagnostic[]
}

export interface ReaderChapterConfig {
  id: string
  root: string
  slug: string
  title?: string
}

export interface ReaderBookConfig {
  id: string
  title: string
  subtitle: string
  source: string
  root: string
  slug: string
  contentsSlug: string
  chapters: ReaderChapterConfig[]
  sectionKnowledge?: { slug: string; sections: string[] }[]
}

export interface ReaderConfig {
  books: ReaderBookConfig[]
  auxiliaryPaths?: string[]
  auxiliaryFiles?: string[]
}

/** Normalize exported, root-relative Markdown paths with this installed Quartz version. */
export function readerSlug(value: string): string {
  const path = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "") || "index"
  return slugifyFilePath((/\.(md|html)$/.test(path) ? path : `${path}.md`) as FilePath)
}

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" })
const compare = (a: string, b: string) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
const unique = (values: readonly string[]) => [...new Set(values)]
const under = (slug: string, root: string) => slug === root || slug.startsWith(`${root}/`)
const sectionNumber = (value: string) => value.match(/(?:^|\/)(\d+\.\d+)(?=[\s.\-]|$)/)?.[1]

/** Pure model: every navigable slug must exist in the supplied published files. */
export function buildReaderCatalog(
  files: readonly ReaderFile[],
  config: ReaderConfig = readerConfig,
): ReaderCatalog {
  const ordered = files
    .filter((file) => file.slug)
    .slice()
    .sort((a, b) => compare(a.slug!, b.slug!))
  const bySlug = new Map(ordered.map((file) => [file.slug!, file]))
  const bySimple = new Map(ordered.map((file) => [simplifySlug(file.slug as FullSlug), file.slug!]))
  const resolve = (value: string): string | undefined => {
    const normalized = readerSlug(value)
    return bySlug.has(normalized) ? normalized : bySimple.get(simplifySlug(normalized as FullSlug))
  }
  const linksFor = (slug: string) =>
    unique(
      (bySlug.get(slug)?.readerMetadata?.links ?? bySlug.get(slug)?.links ?? []).flatMap((link) => {
        const found = resolve(link)
        return found ? [found] : []
      }),
    )
  const auxiliaryPaths = (config.auxiliaryPaths ?? []).map(readerSlug)
  const auxiliaryFiles = new Set((config.auxiliaryFiles ?? []).map(readerSlug))
  const pages: Record<string, ReaderPage> = Object.create(null)
  for (const file of ordered) {
    const slug = file.slug!
    const auxiliary =
      file.frontmatter?.siteKind === "plan" ||
      file.frontmatter?.siteKind === "canvas" ||
      auxiliaryFiles.has(slug) ||
      auxiliaryPaths.some((root) => under(slug, root))
    pages[slug] = {
      slug,
      title: file.frontmatter?.title ?? slug.split("/").at(-1)!,
      role: auxiliary ? "auxiliary" : "other",
      sections: [],
      auxiliary,
    }
  }
  const diagnostics: ReaderDiagnostic[] = []
  const report = (code: ReaderDiagnostic["code"], slug: string, message: string) =>
    diagnostics.push({ code, slug, message })
  const books: ReaderBook[] = []
  for (const definition of config.books) {
    const root = readerSlug(definition.root)
    const slug = resolve(definition.slug)
    if (!slug) {
      report(
        "missing-config-target",
        readerSlug(definition.slug),
        "Configured book entry is absent from the published snapshot.",
      )
      continue
    }
    const contentsSlug = resolve(definition.contentsSlug)
    if (!contentsSlug)
      report(
        "missing-config-target",
        readerSlug(definition.contentsSlug),
        "Configured contents page is absent; chapter links still supply the reading order.",
      )
    const book: ReaderBook = {
      id: definition.id,
      title: definition.title,
      subtitle: definition.subtitle,
      source: definition.source,
      slug,
      contentsSlug: contentsSlug ?? slug,
      chapters: [],
      plans: [],
    }
    books.push(book)
    for (const page of Object.values(pages)) {
      if (under(page.slug, root)) {
        page.bookId = book.id
        if (bySlug.get(page.slug)?.frontmatter?.siteKind === "plan") book.plans.push(page.slug)
      }
    }
    pages[slug].role = "book"
    const chapterDefinitions = definition.chapters.map((chapter) => ({
      ...chapter,
      root: readerSlug(chapter.root),
    }))
    const knownRoots = new Set(chapterDefinitions.map((chapter) => chapter.root))
    // Future chapters are visible even before an editor adds a preferred title/order.
    const newRoots = unique(
      ordered.flatMap((file) => {
        if (!under(file.slug!, root) || pages[file.slug!].auxiliary) return []
        const folder = file.slug!.slice(root.length + 1).split("/")[0]
        return /^(?:第[一二三四五六七八九十百\d]+章|chapter[-\s]?\d+)$/i.test(folder)
          ? [`${root}/${folder}`]
          : []
      }),
    )
      .filter((chapterRoot) => !knownRoots.has(chapterRoot))
      .sort(compare)
    for (const chapterRoot of newRoots) {
      const candidates = ordered.filter(
        (file) => under(file.slug!, chapterRoot) && !pages[file.slug!].auxiliary,
      )
      const entry =
        candidates.find(
          (file) =>
            file.frontmatter?.siteKind === "navigation" &&
            file.slug!.slice(chapterRoot.length + 1).indexOf("/") < 0,
        ) ?? candidates[0]
      if (!entry) continue
      const folder = chapterRoot.split("/").at(-1)!
      chapterDefinitions.push({
        id: `${book.id}-${folder}`,
        root: chapterRoot,
        slug: entry.slug!,
        title: entry.frontmatter?.siteKind === "navigation" ? undefined : folder,
      })
      report(
        "unconfigured-chapter",
        entry.slug!,
        "A newly published chapter is included automatically; add its preferred identity and order to reader.config.ts.",
      )
      if (entry.frontmatter?.siteKind !== "navigation")
        report(
          "missing-chapter-entry",
          entry.slug!,
          "No chapter navigation page exists; the chapter temporarily opens its first published page.",
        )
    }
    for (const chapterDefinition of chapterDefinitions) {
      const chapterSlug = resolve(chapterDefinition.slug)
      if (!chapterSlug) {
        report(
          "missing-config-target",
          readerSlug(chapterDefinition.slug),
          "Configured chapter entry is absent from the published snapshot.",
        )
        continue
      }
      const chapter: ReaderChapter = {
        id: chapterDefinition.id,
        title: chapterDefinition.title ?? pages[chapterSlug].title,
        slug: chapterSlug,
        sections: [],
        knowledge: [],
        connections: [],
        exercises: [],
        canvas: [],
      }
      book.chapters.push(chapter)
      const within = Object.values(pages).filter((page) => under(page.slug, chapterDefinition.root))
      for (const page of within) {
        page.chapterId = chapter.id
        if (page.auxiliary) continue
        const relative = page.slug.slice(chapterDefinition.root.length + 1)
        if (relative.startsWith("研读/")) page.role = "reading"
        else if (relative.startsWith("知识/")) page.role = "knowledge"
        else if (relative.startsWith("联系/")) page.role = "connection"
        else if (/^(?:习题|[^/]*习题与原书核校)/.test(relative)) page.role = "exercise"
      }
      if (bySlug.get(chapterSlug)?.frontmatter?.siteKind === "navigation")
        pages[chapterSlug].role = "chapter"
      const navigationLinks = linksFor(chapterSlug)
      const inSourceOrder = (role: ReaderRole) =>
        unique([
          ...navigationLinks.filter(
            (target) => pages[target].chapterId === chapter.id && pages[target].role === role,
          ),
          ...within
            .filter((page) => page.role === role)
            .map((page) => page.slug)
            .sort(compare),
        ])
      chapter.knowledge = inSourceOrder("knowledge")
      chapter.connections = inSourceOrder("connection")
      chapter.exercises = inSourceOrder("exercise")
      chapter.canvas = navigationLinks.filter(
        (target) => bySlug.get(target)?.frontmatter?.siteKind === "canvas",
      )
      for (const target of chapter.canvas) {
        pages[target].bookId ??= book.id
        pages[target].chapterId ??= chapter.id
      }
      for (const reading of inSourceOrder("reading")) {
        chapter.sections.push({
          slug: reading,
          title: pages[reading].title,
          number: sectionNumber(reading) ?? "",
          knowledge: [],
        })
        pages[reading].sections = [reading]
        if (!navigationLinks.includes(reading))
          report(
            "unindexed-reading",
            reading,
            "Published section is missing from the chapter navigation; it is appended in numeric order.",
          )
      }
    }
    const sectionByNumber = new Map<string, ReaderSection>()
    const sectionBySlug = new Map<string, ReaderSection>()
    for (const section of book.chapters.flatMap((chapter) => chapter.sections)) {
      sectionBySlug.set(section.slug, section)
      if (section.number) {
        if (sectionByNumber.has(section.number))
          report(
            "duplicate-section-number",
            section.slug,
            `Several published readings use section number ${section.number}; number-only supplements are not applied.`,
          )
        else sectionByNumber.set(section.number, section)
      }
    }
    const associate = (section: ReaderSection, target: string) => {
      const page = pages[target]
      if (
        !page ||
        page.bookId !== book.id ||
        page.auxiliary ||
        !["knowledge", "connection", "exercise"].includes(page.role)
      )
        return
      if (!page.sections.includes(section.slug)) page.sections.push(section.slug)
      if (page.role === "knowledge" && !section.knowledge.includes(target))
        section.knowledge.push(target)
    }
    for (const heading of bySlug.get(contentsSlug ?? "")?.readerMetadata?.headings ?? []) {
      const number = heading.title.match(/^(\d+\.\d+)(?:\s|$)/)?.[1]
      if (!number) continue
      const targets = heading.links.flatMap((link) => {
        const found = resolve(link)
        return found ? [found] : []
      })
      const section =
        targets.map((target) => sectionBySlug.get(target)).find(Boolean) ??
        sectionByNumber.get(number)
      if (section) for (const target of targets) associate(section, target)
    }
    for (const supplement of definition.sectionKnowledge ?? []) {
      const target = resolve(supplement.slug)
      if (!target) {
        report(
          "missing-config-target",
          readerSlug(supplement.slug),
          "Configured knowledge supplement is absent from the published snapshot.",
        )
        continue
      }
      for (const number of supplement.sections) {
        const section = sectionByNumber.get(number)
        if (
          section &&
          !diagnostics.some(
            (item) =>
              item.code === "duplicate-section-number" && sectionNumber(item.slug) === number,
          )
        )
          associate(section, target)
        else
          report(
            "missing-config-target",
            target,
            `Knowledge supplement has no unambiguous published section ${number}.`,
          )
      }
    }
    for (const chapter of book.chapters) {
      for (const knowledge of chapter.knowledge) {
        if (!pages[knowledge].sections.length)
          report(
            "unmapped-knowledge",
            knowledge,
            "Published knowledge remains visible at chapter level; its section mapping is not established by the source contents or website configuration.",
          )
      }
    }
  }
  return { version: 1, books, pages, diagnostics }
}

const cache = new WeakMap<readonly ReaderFile[], ReaderCatalog>()
export function getReaderCatalog(files: readonly ReaderFile[]): ReaderCatalog {
  let catalog = cache.get(files)
  if (!catalog) {
    catalog = buildReaderCatalog(files)
    cache.set(files, catalog)
  }
  return catalog
}
