import type { QuartzPluginData } from "../plugins/vfile"
import { simplifySlug } from "./path"

export interface BookBranch {
  name: string
  path: string
  branches: Map<string, BookBranch>
  files: QuartzPluginData[]
}

const collator = new Intl.Collator("zh-CN", { numeric: true })
const chapterNumber = (s: string) =>
  s.replace(/第([一二三四五六七八九十]+)章/g, (_, n: string) => {
    const digits = "零一二三四五六七八九"
    const [tens, ones] = n.split("十")
    const value = n.includes("十")
      ? (digits.indexOf(tens) > 0 ? digits.indexOf(tens) : 1) * 10 +
        Math.max(0, digits.indexOf(ones))
      : digits.indexOf(n)
    return `chapter-${String(value).padStart(3, "0")}`
  })
export const compareBookLabels = (a: string, b: string) =>
  collator.compare(chapterNumber(a), chapterNumber(b))

export function bookTree(files: QuartzPluginData[]): BookBranch {
  const root: BookBranch = { name: "教材目录", path: "", branches: new Map(), files: [] }
  for (const file of files) {
    if (!file.slug || file.frontmatter?.siteKind === "canvas") continue
    const segments = file.slug.split("/").slice(0, -1)
    let branch = root
    for (const part of segments) {
      if (!branch.branches.has(part))
        branch.branches.set(part, {
          name: part,
          path: [branch.path, part].filter(Boolean).join("/"),
          branches: new Map(),
          files: [],
        })
      branch = branch.branches.get(part)!
    }
    branch.files.push(file)
  }
  return root
}

/** Reading order comes only from an existing chapter's explicit links to its reading notes. */
export function readingSequence(file: QuartzPluginData, files: QuartzPluginData[]) {
  const slug = file.slug ?? ""
  if (!slug.includes("/研读/")) return []
  const chapter = slug.split("/研读/")[0]
  const entry = files.find(
    (candidate) =>
      candidate.frontmatter?.siteKind === "navigation" &&
      candidate.slug?.slice(0, candidate.slug.lastIndexOf("/")) === chapter,
  )
  if (!entry) return []
  const bySlug = new Map(files.map((candidate) => [simplifySlug(candidate.slug!), candidate]))
  return [...new Set(entry.links ?? [])]
    .filter((link) => link.startsWith(`${chapter}/研读/`))
    .map((link) => bySlug.get(link))
    .filter((candidate): candidate is QuartzPluginData => Boolean(candidate))
}
