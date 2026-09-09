import { readFile } from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { parse } from "parse5"

const attributes = (node) =>
  Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]))
const hasClass = (node, name) => (attributes(node).class ?? "").split(/\s+/).includes(name)
const text = (node) =>
  hasClass(node, "atom-open")
    ? ""
    : node.nodeName === "#text"
      ? node.value
      : (node.childNodes ?? []).map(text).join("")
const normalized = (value) =>
  String(value ?? "")
    .replace(/\s+/gu, " ")
    .trim()
function elements(node) {
  const found = []
  const walk = (current) => {
    if (current.tagName) found.push(current)
    for (const child of current.childNodes ?? []) walk(child)
  }
  walk(node)
  return found
}
const formulas = (nodes) =>
  nodes
    .filter(
      (node) => node.tagName === "annotation" && attributes(node).encoding === "application/x-tex",
    )
    .map((node) => normalized(text(node)))
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sameIds = (left, right) => equal([...left].sort(), [...right].sort())
function withinSourceNavigation(node) {
  for (let current = node; current; current = current.parentNode)
    if (hasClass(current, "atom-source-links")) return true
  return false
}

/** Compare the actual field to independently emitted canonical source pages. */
export async function verifyPublishedTopos({ root, publicRoot, check, verifyHref, sourceBySlug }) {
  const original = JSON.parse(await readFile(path.join(root, "knowledge/index.json"), "utf8"))
  const {
    model,
    sections: inlineSections,
    sectionFiles,
  } = JSON.parse(await readFile(path.join(publicRoot, "static/topos/index.json"), "utf8"))
  const sections = { ...inlineSections }
  check(
    sameIds(
      Object.keys(sectionFiles ?? {}),
      model.sections.map((section) => section.id),
    ),
    "Every real explanation has one explicitly indexed lazy resource",
  )
  check(
    Object.keys(inlineSections ?? {}).length === 0,
    "Initial field request does not include all mathematical HTML",
  )
  for (const [id, file] of Object.entries(sectionFiles ?? {})) {
    if (!/^\.\/static\/topos\/sections\/[a-f0-9]{64}\.json$/.test(file))
      throw new Error("Unsafe section file path")
    const section = JSON.parse(await readFile(path.join(publicRoot, file.slice(2)), "utf8"))
    check(
      section.id === id && typeof section.html === "string",
      "Lazy section retains its stable ID",
      id,
    )
    const hash = createHash("sha256").update(`${id}\0${section.html}`).digest("hex")
    check(
      file === `./static/topos/sections/${hash}.json`,
      "Section URL is bound to actual content bytes",
      id,
    )
    sections[id] = section.html
  }
  const ids = new Set(model.concepts.map((concept) => concept.id))
  check(
    model.mode === "published" && model.snapshotHash === original.snapshotHash,
    "Default Topos uses the exact approved snapshot",
  )
  check(
    ids.size === model.concepts.length &&
      sameIds(
        ids,
        original.objects.map((object) => object.id),
      ),
    "Every public mathematical identity enters the field exactly once",
  )
  check(
    sameIds(
      model.relations.map((relation) => relation.id),
      original.relations.map((relation) => relation.id),
    ),
    "The field preserves every original relation",
  )
  check(
    sameIds(
      Object.keys(sections),
      model.sections.map((section) => section.id),
    ),
    "Only registered real-note explanations are emitted",
  )
  const originalRelations = new Map(original.relations.map((relation) => [relation.id, relation]))
  for (const relation of model.relations) {
    const source = originalRelations.get(relation.id)
    check(
      source &&
        ["source", "target", "type", "provenance", "evidenceHref"].every(
          (key) => relation[key] === source[key],
        ),
      "Relation direction, type and source classification are unchanged",
      relation.id,
    )
  }
  let formulaCount = 0,
    paragraphCount = 0
  for (const object of original.objects) {
    const concept = model.concepts.find((item) => item.id === object.id)
    const metadata = sourceBySlug.get(object.sourceSlug)?.meta
    check(
      concept?.sourceStatus ===
        (typeof metadata?.status === "string" ? metadata.status : undefined) &&
        concept?.sourceLayer === (typeof metadata?.layer === "string" ? metadata.layer : undefined),
      "Document maintenance state is retained separately from proof status",
      object.id,
    )
    check(
      concept &&
        concept.title === object.title &&
        concept.mathType === object.type &&
        concept.objectKind === object.kind &&
        concept.href === object.href &&
        concept.proofStatus === object.proofStatus,
      "Real object retains title, kind, source address and proof status",
      object.id,
    )
    check(
      concept?.searchText ===
        [object.title, ...object.aliases, object.text, ...object.latex].join("\n") &&
        equal(concept?.aliases, object.aliases),
      "Search retains actual complete text and aliases",
      object.id,
    )
    check(
      equal(concept?.occurrences ?? [], object.occurrences ?? []) &&
        equal(concept?.relatedNotes, object.relatedNotes),
      "All original occurrences and complete-note associations survive",
      object.id,
    )
    const body = model.sections.find(
      (section) => section.concept === object.id && section.role === "body",
    )
    const context = model.sections.find(
      (section) => section.concept === object.id && section.role === "context",
    )
    check(
      body && typeof sections[body.id] === "string",
      "Every object has complete source-derived content",
      object.id,
    )
    const fieldNodes = elements(parse((sections[body?.id] ?? "") + (sections[context?.id] ?? "")))
    const canonical = elements(
      parse(await readFile(path.join(publicRoot, object.href), "utf8")),
    ).find((node) => hasClass(node, "markdown-content"))
    check(Boolean(canonical), "Canonical source exposition remains available", object.id)
    const sourceNodes = canonical ? elements(canonical) : []
    const sourceMath = formulas(sourceNodes),
      fieldMath = formulas(fieldNodes)
    formulaCount += fieldMath.length
    check(
      equal(sourceMath, fieldMath),
      "All canonical formulas and required context survive in order",
      object.id,
      { source: sourceMath.length, field: fieldMath.length },
    )
    const fieldParagraphs = fieldNodes
      .filter((node) => node.tagName === "p")
      .map((node) => normalized(text(node)))
      .filter(Boolean)
    const sourceParagraphs = sourceNodes
      .filter((node) => node.tagName === "p" && !withinSourceNavigation(node))
      .map((node) => normalized(text(node)))
      .filter(Boolean)
    check(
      equal(sourceParagraphs, fieldParagraphs),
      "Canonical paragraphs retain order without additions or duplication",
      object.id,
      { source: sourceParagraphs.length, field: fieldParagraphs.length },
    )
    const actualParagraphs = new Set(fieldParagraphs)
    for (const paragraph of sourceNodes.filter(
      (node) => node.tagName === "p" && !withinSourceNavigation(node),
    )) {
      const value = normalized(text(paragraph))
      if (!value) continue
      paragraphCount++
      check(
        actualParagraphs.has(value),
        "Original mathematical and source paragraphs remain intact",
        object.id,
        value.slice(0, 180),
      )
    }
  }
  for (const section of model.sections) {
    check(
      ids.has(section.concept) &&
        ["body", "context"].includes(section.role) &&
        section.id === `${section.role}:${section.concept}`,
      "Only actual object bodies and source contexts become explanation resources",
      section.id,
    )
    const nodes = elements(parse(sections[section.id] ?? ""))
    const localIds = nodes.map((node) => attributes(node).id).filter(Boolean)
    check(
      new Set(localIds).size === localIds.length,
      "Rendered explanation IDs are unique",
      section.id,
    )
    check(
      !nodes.some((node) => hasClass(node, "katex-error")),
      "Real-note formulas render without KaTeX errors",
      section.id,
    )
    for (const node of nodes) {
      const attrs = attributes(node)
      if (attrs["data-concept-target"])
        check(
          ids.has(attrs["data-concept-target"]),
          "In-field link resolves to a real object",
          section.id,
        )
      for (const key of ["href", "src", "poster"]) {
        const value = attrs[key]
        if (!value) continue
        if (value.startsWith("#"))
          check(
            localIds.includes(decodeURIComponent(value.slice(1))),
            "Local explanation anchor or footnote resolves",
            section.id,
            value,
          )
        else verifyHref(value, "topos.html", "Real-note field source/resource link")
      }
    }
  }
  for (const host of ["index.html", "topos.html", "topos-demo.html"]) {
    const dom = elements(parse(await readFile(path.join(publicRoot, host), "utf8")))
    const body = dom.find((node) => node.tagName === "body")
    const modelFile = host === "topos-demo.html" ? "demo.json" : "index.json"
    const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
    const expectedIndex = `./static/topos/${modelFile}?v=${digest(await readFile(path.join(publicRoot, "static/topos", modelFile)))}`
    check(
      attributes(body)["data-topos-index"] === expectedIndex &&
        dom.some((node) => attributes(node)["data-index"] === expectedIndex),
      "Entry selects its exact data and invalidates older cached models",
      host,
    )
    for (const [file, key] of [
      ["topos.js", "src"],
      ["topos.css", "href"],
    ]) {
      const expected = `./static/topos/${file}?v=${digest(await readFile(path.join(publicRoot, "static/topos", file)))}`
      check(
        dom.some((node) => attributes(node)[key] === expected),
        "Runtime cache version matches the actual emitted bytes",
        host,
        file,
      )
      verifyHref(expected, host, "Versioned field resource")
    }
  }
  return {
    concepts: ids.size,
    notes: original.objects.filter((object) => object.kind === "note").length,
    relations: model.relations.length,
    sections: model.sections.length,
    formulas: formulaCount,
    paragraphs: paragraphCount,
  }
}
