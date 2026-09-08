import type { Root, RootContent, Element } from "hast"
import { toString } from "hast-util-to-string"
import { visit } from "unist-util-visit"
import type { QuartzTransformerPlugin } from "../types"
import { pathToRoot } from "../../util/path"
import type { AtomRegistry, AtomOverrides, AtomCandidate } from "../../../scripts/lib/atomSource"
import { extractAtomCandidates, normalizeAtomText } from "../../../scripts/lib/atomSource"
import registryJSON from "../../../knowledge/registry.json"
import overridesJSON from "../../../knowledge/overrides.json"
import indexJSON from "../../../knowledge/index.json"
import type { KnowledgeIndex } from "../../util/knowledge"
import { isAtomFootnoteSection, snapshotAtomRegion } from "../../util/atomHast"

const registry = registryJSON as AtomRegistry
const overrides = overridesJSON as AtomOverrides
const knowledge = indexJSON as KnowledgeIndex
export interface AtomFragment {
  id: string
  occurrenceId: string
  tree: Root
  context: Root
  before: Root
}
const clone = <T>(value: T): T => structuredClone(value)
const element = (
  tagName: string,
  properties: Element["properties"],
  children: Element["children"],
): Element => ({ type: "element", tagName, properties, children })
const classNames = (node: Element) => node.properties.className as string[] | undefined
function containsOffset(node: RootContent, start: number) {
  return node.position?.start.offset === start
}
function matchesTitle(node: RootContent, candidate: AtomCandidate): boolean {
  if (node.type !== "element") return false
  if (candidate.syntax === "heading")
    return (
      /^h[1-6]$/.test(node.tagName) &&
      normalizeAtomText(toString(node).replace(/§$/, "")) === normalizeAtomText(candidate.title)
    )
  if (candidate.syntax === "callout") {
    let title = ""
    visit(node, "element", (child) => {
      if (
        classNames(child)?.includes("block-title") ||
        classNames(child)?.includes("callout-title-inner")
      )
        title = toString(child)
    })
    return normalizeAtomText(title) === normalizeAtomText(candidate.title)
  }
  return false
}
/** Uses the already rendered HAST. A second article renderer is deliberately not introduced. */
export const Atoms: QuartzTransformerPlugin = () => ({
  name: "Atoms",
  htmlPlugins() {
    return [
      () => (tree: Root, file) => {
        const slug = String(file.data.slug)
        if (
          !knowledge.objects.some((object) => object.kind === "note" && object.sourceSlug === slug)
        )
          return
        const candidates = extractAtomCandidates(String(file.value), slug, overrides)
        const originalChildren = tree.children.slice()
        const fragments: AtomFragment[] = []
        const sourceFootnotes = originalChildren.filter(isAtomFootnoteSection)
        for (const candidate of candidates) {
          const entry = registry.entries.find(
            (item) => item.slug === slug && item.locator === candidate.locator,
          )
          if (!entry)
            throw new Error(
              `Unregistered atom ${slug}: ${candidate.title}; prepare and review atoms first`,
            )
          const object = knowledge.objects.find(
            (item) =>
              item.kind === "atom" &&
              item.occurrences?.some(
                (occurrence) =>
                  occurrence.slug === slug && occurrence.anchor === `atom-${entry.id}`,
              ),
          )
          if (!object) throw new Error(`Atom index missing ${entry.id}`)
          let startIndex = originalChildren.findIndex((node) =>
            containsOffset(node, candidate.start),
          )
          if (startIndex < 0) {
            const matches = originalChildren.flatMap((node, index) =>
              matchesTitle(node, candidate) ? [index] : [],
            )
            if (matches.length !== 1)
              throw new Error(
                `Rendered atom locator ambiguous or missing ${slug}: ${candidate.title}`,
              )
            startIndex = matches[0]
          }
          const startNode = originalChildren[startIndex]
          let endIndex = startIndex + 1
          if (candidate.syntax === "heading") {
            const depth = Number((startNode as Element).tagName.slice(1))
            while (endIndex < originalChildren.length) {
              const node = originalChildren[endIndex]
              if (
                node.type === "element" &&
                /^h[1-6]$/.test(node.tagName) &&
                Number(node.tagName.slice(1)) <= depth
              )
                break
              endIndex++
            }
          } else if (candidate.syntax === "reviewed-paragraph") {
            while (
              endIndex < originalChildren.length &&
              (originalChildren[endIndex].position?.start.offset ?? Infinity) < candidate.end
            )
              endIndex++
          }
          let contextStart = startIndex
          while (contextStart > 0) {
            const previous = originalChildren[contextStart - 1]
            if (previous.type === "element" && /^h[1-6]$/.test(previous.tagName)) {
              contextStart--
              break
            }
            contextStart--
          }
          let contextEnd = endIndex
          while (contextEnd < originalChildren.length) {
            const next = originalChildren[contextEnd]
            if (next.type === "element" && /^h[1-6]$/.test(next.tagName)) break
            contextEnd++
          }
          const required = new Set<RootContent>()
          const includeSetup = (target: AtomCandidate, withStatement: boolean) => {
            const rule = overrides.contextBefore?.find(
              (item) => item.slug === slug && item.title === target.title,
            )
            for (const title of rule?.atomTitles ?? []) {
              const setup = candidates.find((item) => item.title === title)
              if (!setup) throw new Error(`Reviewed setting missing: ${slug} ${title}`)
              for (const node of originalChildren)
                if (
                  (node.position?.start.offset ?? -1) >= setup.start &&
                  (node.position?.start.offset ?? Infinity) < setup.end
                )
                  required.add(node)
            }
            if (withStatement) {
              const firstProof = candidates.find((item) => item.title === target.relatedProofs?.[0])
              const statementEnd = firstProof?.start ?? target.end
              for (const node of originalChildren)
                if (
                  (node.position?.start.offset ?? -1) >= target.start &&
                  (node.position?.start.offset ?? Infinity) < statementEnd
                )
                  required.add(node)
            }
          }
          includeSetup(candidate, false)
          // Authored proof relations supply their statement, before the proof is read.
          // No prose keywords are used to infer hypotheses or dependency claims.
          for (const relation of knowledge.relations.filter(
            (item) =>
              item.source === object.id && item.provenance === "authored" && item.type === "proves",
          )) {
            const targetEntry = registry.entries.find(
              (item) => item.id === relation.target && item.slug === slug,
            )
            const target = candidates.find((item) => item.locator === targetEntry?.locator)
            if (target) includeSetup(target, true)
          }
          // Snapshot before appending navigation anchors; extracted maths is untouched.
          fragments.push({
            id: object.id,
            occurrenceId: entry.id,
            before: {
              type: "root",
              children: clone(originalChildren.filter((node) => required.has(node))),
            },
            tree: snapshotAtomRegion(originalChildren.slice(startIndex, endIndex), sourceFootnotes),
            context: {
              type: "root",
              children: clone(
                [
                  ...originalChildren
                    .slice(contextStart, startIndex)
                    .filter((node) => !required.has(node)),
                  ...originalChildren.slice(endIndex, contextEnd),
                ].filter((node) => !isAtomFootnoteSection(node)),
              ),
            },
          })
        }
        for (let n = candidates.length - 1; n >= 0; n--) {
          const candidate = candidates[n]
          const fragment = fragments[n]
          const entry = registry.entries.find((item) => item.id === fragment.occurrenceId)!
          const node =
            originalChildren.find((item) => containsOffset(item, candidate.start)) ??
            originalChildren.find((item) => matchesTitle(item, candidate))!
          const position = tree.children.indexOf(node)
          const anchor = element(
            "span",
            {
              id: `atom-${entry.id}`,
              className: ["atom-origin-anchor"],
              "data-atom-id": fragment.id,
            },
            [],
          )
          const open = element(
            "a",
            {
              className: ["atom-open"],
              "data-atom-id": fragment.id,
              href: `${pathToRoot(file.data.slug!)}/atoms/${fragment.id}.html`,
              "aria-label": `查看原子：${candidate.title}`,
            },
            [{ type: "text", value: "查看原子 ↗" }],
          )
          tree.children.splice(position, 0, anchor)
          tree.children.splice(position + 2, 0, open)
        }
        file.data.atomFragments = fragments
      },
    ]
  },
})

declare module "vfile" {
  interface DataMap {
    atomFragments: AtomFragment[]
    knowledgeObjectId?: string
  }
}
