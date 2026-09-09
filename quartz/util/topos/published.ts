import type { Element, Root, RootContent } from "hast"
import { toHtml } from "hast-util-to-html"
import { visit } from "unist-util-visit"
import type { KnowledgeIndex, KnowledgeObject } from "../knowledge"
import { atomTypeLabels } from "../knowledge"
import type { AtomFragment } from "../../plugins/transformers/atoms"
import type { Concept, KnowledgeModel, Relation, RelationType, Section } from "./types"

/** A reviewed existing identity, not a title search or a folder-dependent layout rule. */
export const publishedInitial = "a-000067"
export const publishedSectionId = (id: string, role: "body" | "context") => `${role}:${id}`

export interface PublishedSource {
  slug: string
  tree: Root
  fragments?: AtomFragment[]
  status?: string
  layer?: string
}

const relationLabels: Partial<Record<RelationType, string>> = {
  references: "正文引用",
  "appears-in": "出现于原文",
  "appears-in-section": "关联研读节",
  proves: "证明",
}
const plain = (value: string) => ({ type: "text" as const, value })
const element = (
  tagName: string,
  properties: Element["properties"],
  children: Element["children"],
): Element => ({ type: "element", tagName, properties, children })

function assertRelativeHref(href: string) {
  if (!href || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(href) || href.includes("\\"))
    throw new Error(`Published Topos requires a site-relative source URL: ${href}`)
  const pathname = decodeURIComponent(href.split(/[?#]/)[0])
  if (pathname.split("/").some((part) => !part || part === "." || part === ".."))
    throw new Error(`Unsafe published Topos source URL: ${href}`)
}

/** Exact public objects/relations are the ontology. ReaderCatalog and book folders are not inputs. */
export function createPublishedModel(
  index: KnowledgeIndex,
  { initial = publishedInitial, contextIds = new Set<string>() } = {},
): KnowledgeModel {
  const objects = new Map<string, KnowledgeObject>()
  for (const object of index.objects) {
    if (objects.has(object.id)) throw new Error(`Duplicate public knowledge ID: ${object.id}`)
    objects.set(object.id, object)
    assertRelativeHref(object.href)
    if (object.sourceHref) assertRelativeHref(object.sourceHref)
  }
  if (!objects.has(initial)) throw new Error(`Published Topos initial object missing: ${initial}`)
  const sections: Section[] = []
  const concepts: Concept[] = index.objects.map((object) => {
    for (const note of object.relatedNotes)
      if (objects.get(note)?.kind !== "note")
        throw new Error(`Missing related public note: ${object.id} → ${note}`)
    for (const occurrence of object.occurrences ?? []) {
      if (objects.get(`note:${occurrence.slug}`)?.kind !== "note")
        throw new Error(`Missing public occurrence note: ${object.id} → ${occurrence.slug}`)
      assertRelativeHref(occurrence.href)
    }
    const bodyId = publishedSectionId(object.id, "body")
    const contextId = publishedSectionId(object.id, "context")
    const sourceHref = object.sourceHref ?? object.href
    sections.push({
      id: bodyId,
      concept: object.id,
      title: object.kind === "note" ? "完整笔记" : (atomTypeLabels[object.type] ?? object.type),
      level: 2,
      role: "body",
      sourceHref,
      children: contextIds.has(object.id) ? [contextId] : [],
    })
    if (contextIds.has(object.id))
      sections.push({
        id: contextId,
        concept: object.id,
        title: "原文上下文与相邻论证",
        level: 3,
        role: "context",
        sourceHref,
        children: [],
      })
    return {
      id: object.id,
      title: object.title,
      zh: object.kind === "note" ? "完整笔记" : (atomTypeLabels[object.type] ?? object.type),
      kind:
        object.kind === "note" ? "structure" : object.type === "example" ? "example" : "concept",
      summary: object.excerpt,
      symbol: object.latex.find((formula) => formula.length <= 180) ?? "",
      // Only actual titles and aliases contribute to communities; source/book metadata cannot.
      terms: [...new Set([object.title, ...object.aliases])],
      sections: [bodyId, ...(contextIds.has(object.id) ? [contextId] : [])],
      objectKind: object.kind,
      mathType: object.type,
      href: object.href,
      sourceHref,
      sourceTitle: objects.get(`note:${object.sourceSlug}`)?.title ?? object.title,
      proofStatus: object.proofStatus,
      searchText: [object.title, ...object.aliases, object.text, ...object.latex].join("\n"),
      aliases: [...object.aliases],
      occurrences: object.occurrences ? structuredClone(object.occurrences) : undefined,
      relatedNotes: [...object.relatedNotes],
    }
  })
  const relationIds = new Set<string>()
  const relations: Relation[] = index.relations.map((relation) => {
    if (!objects.has(relation.source) || !objects.has(relation.target))
      throw new Error(`Dangling published relation: ${relation.id}`)
    if (relationIds.has(relation.id))
      throw new Error(`Duplicate published relation: ${relation.id}`)
    relationIds.add(relation.id)
    if (!Object.hasOwn(relationLabels, relation.type))
      throw new Error(`Unmapped published relation type: ${relation.type}`)
    assertRelativeHref(relation.evidenceHref)
    const authored = relation.provenance === "authored"
    const reference = relation.provenance === "reference"
    return {
      ...relation,
      type: relation.type as RelationType,
      strength: authored ? 0.94 : reference ? 0.68 : 0.52,
      label: relationLabels[relation.type as RelationType]!,
      explanation: relation.evidenceText ?? relationLabels[relation.type as RelationType]!,
      evidence: relation.evidenceHref,
      // IDs are shared with the demo; model.lenses supplies their published interpretation.
      lenses: { structural: 1, action: authored ? 1 : 0.3, linear: reference ? 1 : 0.35 },
    }
  })
  return {
    version: 1,
    mode: "published",
    title: "数学知识空间",
    initial,
    snapshotHash: index.snapshotHash,
    concepts,
    relations,
    sections,
    sources: index.objects
      .filter((object) => object.kind === "note")
      .map((object) => ({ id: object.id, title: object.title, url: object.href })),
    lenses: [
      { id: "structural", label: "来源与联系", description: "原文出现位置、正文引用与明确论证" },
      { id: "action", label: "原文论证", description: "突出原文明示的数学关系；不推断先修条件" },
      { id: "linear", label: "正文引用", description: "突出笔记中已有的引用；不表示数学推导" },
    ],
    stats: {
      atoms: index.objects.filter((object) => object.kind === "atom").length,
      notes: index.objects.filter((object) => object.kind === "note").length,
      unregisteredNotes: (index.diagnostics ?? []).filter(
        (item) => item.code === "no-explicit-atom",
      ).length,
      relations: relations.length,
    },
  }
}

const site = "https://published-topos.invalid/"
const pathnameKey = (url: URL) => decodeURIComponent(url.pathname).replace(/\.html$/, "")
function sourceLookup(index: KnowledgeIndex) {
  const links = new Map<string, string>()
  for (const object of index.objects) {
    const url = new URL(object.href, site)
    links.set(pathnameKey(url), object.id)
    for (const occurrence of object.occurrences ?? []) {
      const at = new URL(occurrence.href, site)
      links.set(`${pathnameKey(at)}${decodeURIComponent(at.hash)}`, object.id)
    }
  }
  for (const alias of index.aliases ?? []) {
    if (!index.objects.some((object) => object.id === alias.canonicalId))
      throw new Error(`Dangling published alias: ${alias.id}`)
    links.set(pathnameKey(new URL(alias.href, site)), alias.canonicalId)
  }
  return links
}

/** Keep mathematical/source markup; remove only the Atoms transformer's injected open control. */
function withoutOpenControls(tree: Root): Root {
  const copy = structuredClone(tree)
  visit(copy, "element", (node) => {
    node.children = node.children.filter(
      (child) =>
        child.type !== "element" ||
        !Array.isArray(child.properties.className) ||
        !child.properties.className.includes("atom-open"),
    )
  })
  copy.children = copy.children.filter(
    (node) =>
      node.type !== "element" ||
      !Array.isArray(node.properties.className) ||
      !node.properties.className.includes("atom-open"),
  )
  return copy
}

/** Move rendered HAST into a root-level host without changing its mathematical text. */
export function relocatePublishedTree(
  fragment: Root,
  sourceSlug: string,
  sectionId: string,
  index: KnowledgeIndex,
): Root {
  const tree = withoutOpenControls(fragment)
  const source = new URL(`${sourceSlug}.html`, site)
  const identifiers = new Map<string, string>()
  const links = sourceLookup(index)
  const prefix = `topos-${encodeURIComponent(sectionId)}`
  visit(tree, "element", (node) => {
    const id = node.properties.id
    if (typeof id !== "string") return
    if (identifiers.has(id)) throw new Error(`Duplicate published section ID: ${sectionId} #${id}`)
    identifiers.set(id, `${prefix}--${id}`)
  })
  visit(tree, "element", (node) => {
    if (typeof node.properties.id === "string") {
      node.properties["data-source-id"] = node.properties.id
      node.properties.id = identifiers.get(node.properties.id)!
    }
    for (const property of [
      "ariaLabelledBy",
      "ariaDescribedBy",
      "aria-labelledby",
      "aria-describedby",
    ]) {
      const value = node.properties[property]
      if (typeof value === "string" || Array.isArray(value)) {
        const old = typeof value === "string" ? value.split(" ") : value.map(String)
        const next = old.map((id) => identifiers.get(id) ?? id)
        node.properties[property] = typeof value === "string" ? next.join(" ") : next
      }
    }
    for (const property of ["href", "src", "poster"]) {
      const value = node.properties[property]
      if (typeof value !== "string" || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue
      const resolved = new URL(value, source)
      const originalAnchor = decodeURIComponent(resolved.hash.slice(1))
      if (
        property === "href" &&
        pathnameKey(resolved) === pathnameKey(source) &&
        identifiers.has(originalAnchor)
      ) {
        node.properties.href = `#${encodeURIComponent(identifiers.get(originalAnchor)!)}`
        continue
      }
      node.properties[property] = `.${resolved.pathname}${resolved.search}${resolved.hash}`
      if (property !== "href") continue
      const id =
        links.get(`${pathnameKey(resolved)}${decodeURIComponent(resolved.hash)}`) ??
        links.get(pathnameKey(resolved))
      // A missing local footnote/backlink must remain a source-page link, not a focus action.
      if (id && !(value.startsWith("#") && !identifiers.has(originalAnchor))) {
        node.properties["data-concept-target"] = id
        if (originalAnchor) node.properties["data-source-anchor"] = originalAnchor
      }
    }
  })
  return tree
}

/** No IO: Quartz provides the already-approved source trees and their registered atom fragments. */
export function buildPublishedTopos(
  index: KnowledgeIndex,
  sources: PublishedSource[],
  { initial = publishedInitial } = {},
): { model: KnowledgeModel; sections: Record<string, string> } {
  const sourceBySlug = new Map(sources.map((source) => [source.slug, source]))
  if (sourceBySlug.size !== sources.length) throw new Error("Duplicate published source tree")
  const fragments = new Map<string, { source: PublishedSource; fragment: AtomFragment }>()
  for (const object of index.objects) {
    const source = object.sourceSlug ? sourceBySlug.get(object.sourceSlug) : undefined
    if (!source) throw new Error(`Missing rendered public note: ${object.id}`)
    if (object.kind === "atom") {
      const matches = (source.fragments ?? []).filter(
        (fragment) => fragment.id === object.id && fragment.occurrenceId === object.id,
      )
      if (matches.length !== 1)
        throw new Error(`Missing or ambiguous rendered public atom: ${object.id}`)
      fragments.set(object.id, { source, fragment: matches[0] })
    }
  }
  const contextIds = new Set(
    [...fragments]
      .filter(([, { fragment }]) =>
        fragment.context.children.some((node) => node.type === "element"),
      )
      .map(([id]) => id),
  )
  const model = createPublishedModel(index, { initial, contextIds })
  for (const concept of model.concepts) {
    const object = index.objects.find((item) => item.id === concept.id)!
    const source = sourceBySlug.get(object.sourceSlug!)!
    concept.sourceStatus = source.status
    concept.sourceLayer = source.layer
  }
  const sections: Record<string, string> = {}
  for (const object of index.objects) {
    const source = sourceBySlug.get(object.sourceSlug!)!
    const bodyId = publishedSectionId(object.id, "body")
    let body: Root
    if (object.kind === "note") body = source.tree
    else {
      const fragment = fragments.get(object.id)!.fragment
      const before: RootContent[] = fragment.before.children.length
        ? [
            element("section", { className: ["atom-required-setting"], "aria-label": "原文设定" }, [
              element("p", { className: ["atom-setting-label"] }, [plain("原文设定")]),
              ...(fragment.before.children as Element["children"]),
            ]),
          ]
        : []
      body = { type: "root", children: [...before, ...fragment.tree.children] }
      if (contextIds.has(object.id)) {
        const contextId = publishedSectionId(object.id, "context")
        sections[contextId] = toHtml(
          relocatePublishedTree(fragment.context, source.slug, contextId, index),
        )
      }
    }
    sections[bodyId] = toHtml(relocatePublishedTree(body, source.slug, bodyId, index))
  }
  for (const section of model.sections)
    if (!Object.hasOwn(sections, section.id))
      throw new Error(`Missing Topos section HTML: ${section.id}`)
  return { model, sections }
}
