import fs from "node:fs/promises"
import path from "node:path"
import matter from "gray-matter"
// @ts-expect-error Shared audited JavaScript boundary module has no declaration file.
import { verifyManifest } from "./lib/export-boundary.mjs"
import { buildReaderCatalog, readerSlug, type ReaderFile } from "../quartz/util/readerCatalog"
import { extractReaderMetadata } from "../quartz/plugins/transformers/readerMetadata"
import type { KnowledgeIndex, KnowledgeObject, KnowledgeRelation } from "../quartz/util/knowledge"
import {
  digest,
  extractAtomCandidates,
  normalizeAtomText,
  parseAtomSource,
  reconcileAtoms,
  type AtomOverrides,
  type AtomRegistry,
  type AtomCandidate,
} from "./lib/atomSource"

const root = path.resolve(import.meta.dirname, "..")
const folder = path.join(root, "content")
const check = process.argv.includes("--check")
const overrides: AtomOverrides = JSON.parse(
  await fs.readFile(path.join(root, "knowledge/overrides.json"), "utf8"),
)
const previous: AtomRegistry = await fs
  .readFile(path.join(root, "knowledge/registry.json"), "utf8")
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return { version: 1, nextId: 1, entries: [] }
    throw error
  })
const files: (ReaderFile & { raw: string; body: string; relative: string })[] = []
const manifest: { notes: { output: string; outputSha256: string }[] } = await verifyManifest(root, {
  allowUnmanaged: true,
})
// Reading input is the approved snapshot, never a wildcard over the export directory.
for (const entry of manifest.notes
  .filter((item) => item.output.endsWith(".md"))
  // Stable publication order must not depend on the host's ICU locale.
  .sort((a, b) => (a.output < b.output ? -1 : a.output > b.output ? 1 : 0))) {
  const raw = await fs.readFile(path.join(folder, entry.output), "utf8")
  if (digest(raw) !== entry.outputSha256)
    throw new Error(`Approved content changed while preparing atoms: ${entry.output}`)
  const relative = entry.output
  const slug = readerSlug(relative)
  const parsed = matter(raw)
  files.push({
    raw,
    body: parsed.content,
    relative,
    slug,
    frontmatter: parsed.data,
    readerMetadata: extractReaderMetadata(parseAtomSource(raw), slug),
  })
}
const catalog = buildReaderCatalog(files)
const eligible = files.filter((file) => {
  const page = catalog.pages[file.slug!]
  return (
    page &&
    !page.auxiliary &&
    !["book", "chapter"].includes(page.role) &&
    file.frontmatter?.siteKind !== "navigation"
  )
})
const candidates = eligible.flatMap((file) =>
  extractAtomCandidates(file.raw, file.slug!, overrides),
)
const eligibleSlugs = new Set(eligible.map((file) => file.slug!))
const registry = reconcileAtoms(candidates, previous)
const entryFor = (candidate: AtomCandidate) =>
  registry.entries.find(
    (entry) => entry.slug === candidate.slug && entry.locator === candidate.locator,
  )!
const primaryIds = new Map<string, string>()
for (const rule of overrides.merges) {
  if (!eligibleSlugs.has(rule.primary.slug)) continue
  const primary = candidates.find(
    (candidate) => candidate.slug === rule.primary.slug && candidate.title === rule.primary.title,
  )
  if (!primary) throw new Error(`Reviewed primary missing: ${rule.primary.title}`)
  for (const occurrence of rule.occurrences) {
    if (!eligibleSlugs.has(occurrence.slug)) continue
    const candidate = candidates.find(
      (item) => item.slug === occurrence.slug && item.title === occurrence.title,
    )
    if (!candidate) throw new Error(`Reviewed occurrence missing: ${occurrence.title}`)
    primaryIds.set(entryFor(candidate).id, entryFor(primary).id)
  }
}
const idFor = (candidate: AtomCandidate) =>
  primaryIds.get(entryFor(candidate).id) ?? entryFor(candidate).id
const cleanup = (text: string) =>
  normalizeAtomText(
    text
      .replace(/^>\s*\[![\w-]+\][+-]?[^\n]*\n/gm, "")
      .replace(/^>\s*/gm, "")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1"),
  )
const excerpt = (text: string) => cleanup(text).slice(0, 240)
const objects: KnowledgeObject[] = []
const relations: KnowledgeRelation[] = []
const addRelation = (
  source: string,
  target: string,
  type: string,
  provenance: KnowledgeRelation["provenance"],
  evidenceHref: string,
  evidenceText?: string,
) => {
  const id = `r-${digest(`${source}|${target}|${type}`).slice(0, 20)}`
  if (!relations.some((item) => item.id === id))
    relations.push({ id, source, target, type, provenance, evidenceHref, evidenceText })
}
for (const file of eligible) {
  const slug = file.slug!
  const page = catalog.pages[slug]
  const paragraphs = file.body
    .split(/\n\s*\n/)
    .filter((text) => !/^(?:#|>|来源|Source)/.test(text.trim()) && !text.includes("原文件未公开"))
  const aliases = file.frontmatter?.aliases
  objects.push({
    id: `note:${slug}`,
    kind: "note",
    type: page.role,
    title: page.title,
    href: `${slug}.html`,
    sourceSlug: slug,
    bookId: page.bookId,
    chapterId: page.chapterId,
    excerpt: excerpt(paragraphs[0] ?? page.title),
    text: cleanup(file.body),
    latex: [...file.body.matchAll(/\$\$([\s\S]*?)\$\$|(?<!\$)\$([^$\n]+)\$(?!\$)/g)].map((match) =>
      (match[1] ?? match[2]).trim(),
    ),
    aliases: Array.isArray(aliases) ? aliases.map(String) : [],
    relatedNotes: (file.readerMetadata?.links ?? [])
      .filter((link) => eligibleSlugs.has(link))
      .map((link) => `note:${link}`),
  })
  for (const target of file.readerMetadata?.links ?? [])
    if (eligibleSlugs.has(target) && target !== slug)
      addRelation(`note:${slug}`, `note:${target}`, "references", "reference", `${slug}.html`)
}
for (const candidate of candidates) {
  const id = idFor(candidate)
  const ownId = entryFor(candidate).id
  const occurrence = {
    slug: candidate.slug,
    anchor: `atom-${ownId}`,
    href: `${candidate.slug}.html#atom-${ownId}`,
  }
  const existing = objects.find((object) => object.id === id)
  if (existing) {
    existing.occurrences!.push(occurrence)
    existing.relatedNotes = [...new Set([...existing.relatedNotes, `note:${candidate.slug}`])]
    continue
  }
  const primary = candidates.find((item) => entryFor(item).id === id)!
  const page = catalog.pages[primary.slug]
  const note = objects.find((item) => item.id === `note:${primary.slug}`)!
  const text = cleanup(primary.text)
  const strategy =
    /not a complete proof|rather than.*complete solution|proof (?:strategy|mechanism)|未完成|证明策略/i.test(
      primary.text,
    )
  objects.push({
    id,
    kind: "atom",
    type: primary.type,
    title: primary.title,
    href: `atoms/${id}.html`,
    sourceSlug: primary.slug,
    sourceHref: `${primary.slug}.html#atom-${id}`,
    bookId: page.bookId,
    chapterId: page.chapterId,
    excerpt: excerpt(primary.text),
    text,
    latex: primary.latex,
    aliases: note.aliases,
    proofStatus:
      strategy || primary.type === "proof-strategy"
        ? "策略或论证机制；原文未宣称完整证明"
        : primary.type === "proof"
          ? "原文证明；条件与状态见正文"
          : "原文陈述；证明状态见原文",
    occurrences: [occurrence],
    relatedNotes: [`note:${primary.slug}`],
  })
}
for (const candidate of candidates) {
  const id = idFor(candidate)
  const occurrenceHref = `${candidate.slug}.html#atom-${entryFor(candidate).id}`
  addRelation(id, `note:${candidate.slug}`, "appears-in", "structure", occurrenceHref)
  const object = objects.find((item) => item.id === id)!
  const referenced = extractReaderMetadata(
    parseAtomSource(candidate.text),
    candidate.slug,
  ).links.filter((target) => eligibleSlugs.has(target))
  for (const target of referenced) {
    if (target !== candidate.slug)
      addRelation(id, `note:${target}`, "references", "reference", occurrenceHref)
    object.relatedNotes = [...new Set([...object.relatedNotes, `note:${target}`])]
  }
  for (const target of catalog.pages[candidate.slug].sections.filter((section) =>
    eligibleSlugs.has(section),
  )) {
    object.relatedNotes = [...new Set([...object.relatedNotes, `note:${target}`])]
    addRelation(
      id,
      `note:${target}`,
      "appears-in-section",
      "structure",
      occurrenceHref,
      "The source knowledge note is explicitly associated with this reading section in the book catalog.",
    )
  }
  for (const proofTitle of candidate.relatedProofs ?? []) {
    const proof = candidates.find(
      (item) => item.slug === candidate.slug && item.title === proofTitle,
    )
    if (proof)
      addRelation(
        idFor(proof),
        id,
        "proves",
        "authored",
        `${proof.slug}.html#atom-${entryFor(proof).id}`,
        "Proof subsection in the original theorem section; its own limitations remain in the source text.",
      )
  }
}
const snapshotHash = digest(
  files
    .map((file) => `${file.relative}:${digest(file.raw)}`)
    .sort()
    .join("\n"),
)
for (const rule of overrides.relations ?? []) {
  if (!eligibleSlugs.has(rule.source.slug) || !eligibleSlugs.has(rule.target.slug)) continue
  const source = candidates.find(
    (item) => item.slug === rule.source.slug && item.title === rule.source.title,
  )
  const target = candidates.find(
    (item) => item.slug === rule.target.slug && item.title === rule.target.title,
  )
  if (!source || !target)
    throw new Error(`Reviewed authored relation target missing: ${rule.source.title}`)
  addRelation(
    idFor(source),
    idFor(target),
    rule.type,
    "authored",
    `${source.slug}.html#atom-${entryFor(source).id}`,
    rule.evidence,
  )
}
const index: KnowledgeIndex = {
  version: 1,
  snapshotHash,
  objects,
  aliases: [...primaryIds].map(([id, canonicalId]) => ({
    id,
    canonicalId,
    href: `atoms/${id}.html`,
  })),
  relations,
  groups: catalog.books
    .flatMap((book) =>
      book.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        bookId: book.id,
        objectIds: objects
          .filter((object) => object.chapterId === chapter.id)
          .map((object) => object.id),
      })),
    )
    .filter((group) => group.objectIds.length),
  diagnostics: eligible
    .filter((file) => !candidates.some((candidate) => candidate.slug === file.slug))
    .map((file) => ({
      code: "no-explicit-atom",
      slug: file.slug!,
      message: "完整笔记可读；本页尚无独立登记的数学对象。",
    })),
}
const writeJSON = async (name: string, value: unknown) => {
  const output = JSON.stringify(value, null, 2) + "\n"
  const target = path.join(root, "knowledge", name)
  if (check) {
    const old = await fs.readFile(target, "utf8")
    if (JSON.stringify(JSON.parse(old)) !== JSON.stringify(value))
      throw new Error(`${name} is stale; run npm run prepare:atoms and review changes`)
  } else await fs.writeFile(target, output)
}
await fs.mkdir(path.join(root, "knowledge"), { recursive: true })
await writeJSON("registry.json", registry)
await writeJSON("index.json", index)
console.log(
  `Atoms ${check ? "verified" : "prepared"}: ${objects.filter((object) => object.kind === "atom").length} objects, ${candidates.length} occurrences, ${eligible.length} notes, ${relations.length} evidence relations; snapshot ${snapshotHash}`,
)
