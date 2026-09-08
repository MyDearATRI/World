import { createHash } from "node:crypto"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkFrontmatter from "remark-frontmatter"
import remarkMath from "remark-math"
import { toString } from "mdast-util-to-string"
import type { Root, RootContent } from "mdast"

export interface AtomCandidate {
  slug: string
  locator: string
  syntax: "callout" | "heading" | "reviewed-paragraph"
  type: string
  title: string
  text: string
  latex: string[]
  fingerprint: string
  start: number
  end: number
  contextStart: number
  relatedProof?: string
  relatedProofs?: string[]
}
export interface AtomRegistryEntry {
  id: string
  slug: string
  locator: string
  fingerprint: string
  type: string
  title: string
}
export interface AtomRegistry {
  version: 1
  nextId: number
  entries: AtomRegistryEntry[]
}
export interface AtomOverrides {
  exclude: { slug: string; title: string; reason: string }[]
  paragraphs: {
    slug: string
    startsWith: string
    title: string
    type: string
    paragraphCount?: number
  }[]
  merges: {
    primary: { slug: string; title: string }
    occurrences: { slug: string; title: string }[]
    evidence: string
  }[]
  types?: { slug: string; title: string; type: string }[]
  contextBefore?: { slug: string; title: string; atomTitles: string[] }[]
  relations?: {
    source: { slug: string; title: string }
    target: { slug: string; title: string }
    type: string
    evidence: string
  }[]
}
export const normalizeAtomText = (text: string) => text.replace(/\s+/gu, " ").trim()
export const digest = (text: string) => createHash("sha256").update(text).digest("hex")
export const parseAtomSource = (text: string) =>
  unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml", "toml"])
    .use(remarkMath)
    .parse(text) as Root
const headingKinds: Record<string, string> = {
  DEF: "definition",
  DEFINITION: "definition",
  THM: "theorem",
  THEOREM: "theorem",
  PROP: "proposition",
  PROPOSITION: "proposition",
  LEMMA: "lemma",
  LEM: "lemma",
  COR: "corollary",
  COROLLARY: "corollary",
  PROOF: "proof",
  EXAMPLE: "example",
}
const atomKinds = new Set([
  "definition",
  "theorem",
  "proposition",
  "lemma",
  "corollary",
  "proof",
  "proof-strategy",
  "example",
  "insight",
  "question",
])
/** Metadata only. Offsets are re-extracted from Quartz's transformed input before HTML matching. */
export function extractAtomCandidates(
  text: string,
  slug: string,
  overrides: AtomOverrides,
): AtomCandidate[] {
  const tree = parseAtomSource(text)
  const children = tree.children
  const result: AtomCandidate[] = []
  let sectionStart = 0
  const sourceSlice = (node: RootContent) =>
    text.slice(node.position!.start.offset!, node.position!.end.offset!)
  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (["yaml", "toml"].includes(node.type)) {
      sectionStart = node.position!.end.offset!
      continue
    }
    let syntax: AtomCandidate["syntax"] = "callout"
    let type: string | undefined
    let title = ""
    let end = node.position?.end.offset ?? 0
    let proofTitle: string | undefined
    let proofTitles: string[] | undefined
    if (node.type === "blockquote") {
      const match = sourceSlice(node).match(/^>\s*\[!([\w-]+)\][+-]?\s*(.*)/)
      if (match && atomKinds.has(match[1])) {
        type = match[1] === "insight" ? "observation" : match[1]
        title = match[2].trim() || match[1]
      }
    } else if (node.type === "heading") {
      syntax = "heading"
      title = toString(node)
      const match = title.match(
        /^(DEF(?:INITION)?|THM|THEOREM|PROP(?:OSITION)?|LEMMA|LEM|COR(?:OLLARY)?|PROOF|EXAMPLE)\s*(?:[—–:：-]|$)/i,
      )
      if (match) {
        type = headingKinds[match[1].toUpperCase()]
        if (/proof\s*strategy/i.test(title)) type = "proof-strategy"
        let j = i + 1
        while (
          j < children.length &&
          !(
            children[j].type === "heading" && (children[j] as { depth: number }).depth <= node.depth
          )
        )
          j++
        end = j < children.length ? children[j].position!.start.offset! : text.length
        const nestedProofs = children
          .slice(i + 1, j)
          .filter((child) => child.type === "heading" && /^Proof\s*[—–:：-]/i.test(toString(child)))
        proofTitles = nestedProofs.map((proof) => toString(proof))
        proofTitle = proofTitles[0]
      }
    } else if (node.type === "paragraph") {
      const rule = overrides.paragraphs.find(
        (item) =>
          item.slug === slug && normalizeAtomText(sourceSlice(node)).startsWith(item.startsWith),
      )
      if (rule) {
        syntax = "reviewed-paragraph"
        type = rule.type
        title = rule.title
        if (rule.paragraphCount && rule.paragraphCount > 1) {
          const following = children.slice(i, i + rule.paragraphCount)
          if (
            following.length !== rule.paragraphCount ||
            following.some((child) => child.type !== "paragraph")
          )
            throw new Error(`Reviewed paragraph range changed: ${slug} ${title}`)
          end = following.at(-1)!.position!.end.offset!
        }
      }
    }
    if (type && !overrides.exclude.some((item) => item.slug === slug && item.title === title)) {
      type =
        overrides.types?.find((item) => item.slug === slug && item.title === title)?.type ?? type
      const start = node.position!.start.offset!
      const body = text.slice(start, end).trim()
      const latex = [...body.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)/g)].map(
        (match) => (match[1] ?? match[2]).trim(),
      )
      const normalized = normalizeAtomText(
        body.replace(/^>\s*/gm, "").replace(/^#{1,6}\s+[^\n]+\n|^\[![\w-]+\][+-]?[^\n]+\n/, ""),
      )
      result.push({
        slug,
        locator: `${syntax}:${normalizeAtomText(title)}`,
        syntax,
        type,
        title,
        text: body,
        latex,
        fingerprint: digest(normalized),
        start,
        end,
        contextStart: sectionStart,
        relatedProof: proofTitle,
        relatedProofs: proofTitles,
      })
    }
    if (node.type === "heading" && !type) sectionStart = node.position!.start.offset!
  }
  return result
}

/** Exact locator handles edits; unique unchanged body handles a renamed heading. IDs never use ordering. */
export function reconcileAtoms(candidates: AtomCandidate[], registry: AtomRegistry): AtomRegistry {
  const entries: AtomRegistryEntry[] = []
  let nextId = registry.nextId
  const used = new Set<string>()
  for (const candidate of candidates) {
    if (
      candidates.filter(
        (item) => item.slug === candidate.slug && item.locator === candidate.locator,
      ).length !== 1
    )
      throw new Error(`Ambiguous atom locator: ${candidate.slug} ${candidate.locator}`)
    let matches = registry.entries.filter(
      (entry) => entry.slug === candidate.slug && entry.locator === candidate.locator,
    )
    if (!matches.length)
      matches = registry.entries.filter(
        (entry) =>
          entry.slug === candidate.slug &&
          entry.fingerprint === candidate.fingerprint &&
          !used.has(entry.id),
      )
    if (matches.length > 1 || (matches[0] && used.has(matches[0].id)))
      throw new Error(`Ambiguous atom identity: ${candidate.slug} ${candidate.title}`)
    const id = matches[0]?.id ?? `a-${String(nextId++).padStart(6, "0")}`
    used.add(id)
    entries.push({
      id,
      slug: candidate.slug,
      locator: candidate.locator,
      fingerprint: candidate.fingerprint,
      type: candidate.type,
      title: candidate.title,
    })
  }
  // Retired entries reserve IDs; no object is emitted unless its current source is present.
  for (const entry of registry.entries) if (!used.has(entry.id)) entries.push(entry)
  return { version: 1, nextId, entries }
}
