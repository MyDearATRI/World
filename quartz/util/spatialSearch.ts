import FlexSearch from "flexsearch"
import type { KnowledgeObject } from "./knowledge"

const symbols: Record<string, string> = {
  "∀": "forall",
  "∃": "exists",
  "∈": "in",
  "∉": "notin",
  "⊂": "subset",
  "⊆": "subseteq",
  "∪": "cup",
  "∩": "cap",
  "∞": "infty",
  "→": "to",
  "⇒": "implies",
  ε: "epsilon",
  δ: "delta",
  "≤": "leq",
  "≥": "geq",
  ℝ: "mathbb r",
  ℂ: "mathbb c",
  "∑": "sum",
  "∫": "int",
}
export function spatialTerms(value: string): string[] {
  return (
    value
      .replace(/[∀∃∈∉⊂⊆∪∩∞→⇒εδ≤≥ℝℂ∑∫]/gu, (c) => ` ${symbols[c]} `)
      .normalize("NFKC")
      .toLowerCase()
      .match(/\p{Script=Han}|[\p{L}\p{N}]+/gu) ?? []
  )
}
export function createSpatialSearch(objects: KnowledgeObject[]) {
  const fields = [
    new FlexSearch.Index({ encode: spatialTerms, tokenize: "forward" }),
    new FlexSearch.Index({ encode: spatialTerms, tokenize: "forward" }),
  ]
  objects.forEach((object, i) => {
    fields[0].add(i, [object.title, ...object.aliases].join(" "))
    fields[1].add(
      i,
      [object.title, object.type, object.text, ...object.latex, ...object.aliases].join(" "),
    )
  })
  return (query: string, eligible: (object: KnowledgeObject) => boolean, limit = 45) => {
    if (!query.trim())
      return objects
        .filter(eligible)
        .filter((o) => o.kind === "atom")
        .slice(0, limit)
    const scores = new Map<number, number>()
    fields.forEach((field, i) =>
      field.search(query, { limit: objects.length }).forEach((key, rank) => {
        const id = Number(key)
        scores.set(id, (scores.get(id) ?? 0) + (i ? 20 : 300) + 1 / (rank + 1))
      }),
    )
    const phrase = query.normalize("NFKC").toLowerCase().trim()
    for (const [id, score] of scores) {
      const object = objects[id]
      const title = object.title.normalize("NFKC").toLowerCase()
      scores.set(
        id,
        score +
          (title === phrase ? 2000 : title.includes(phrase) ? 700 : 0) +
          (object.aliases.some((alias) => alias.toLowerCase() === phrase) ? 1500 : 0),
      )
    }
    return [...scores]
      .filter(([id]) => eligible(objects[id]))
      .sort((a, b) => b[1] - a[1] || objects[a[0]].id.localeCompare(objects[b[0]].id))
      .slice(0, limit)
      .map(([id]) => objects[id])
  }
}

export function spatialSnippet(object: KnowledgeObject, query: string) {
  const source = object.text.replace(/\s+/gu, " ")
  const at = source.toLowerCase().indexOf(query.trim().toLowerCase())
  const start = at > 60 ? at - 35 : 0
  return `${start ? "…" : ""}${source.slice(start, start + 155)}${source.length > start + 155 ? "…" : ""}`
}
