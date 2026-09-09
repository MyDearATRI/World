import test from "node:test"
import assert from "node:assert/strict"
import { readFile, readdir, lstat } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkMath from "remark-math"
import remarkRehype from "remark-rehype"
import rehypeKatex from "rehype-katex"
import { toHtml } from "hast-util-to-html"
import katex from "katex"
import { visit } from "unist-util-visit"
import type { KnowledgeModel, RelationType } from "../quartz/util/topos/types"

const root = fileURLToPath(new URL("../knowledge/topos/", import.meta.url))
const model: KnowledgeModel = JSON.parse(await readFile(path.join(root, "prototype.json"), "utf8"))
const conceptById = new Map(model.concepts.map((concept) => [concept.id, concept]))
const sectionById = new Map(model.sections.map((section) => [section.id, section]))
const sourceById = new Map(model.sources.map((source) => [source.id, source]))
const text = async (id: string) => {
  const markdown = sectionById.get(id)?.markdown
  assert.ok(markdown, `The demonstration section ${id} must declare a Markdown file`)
  return readFile(path.join(root, markdown), "utf8")
}
const relationTypes: Record<RelationType, true> = {
  prerequisite: true,
  generalization: true,
  specialization: true,
  analogy: true,
  duality: true,
  equivalence: true,
  construction: true,
  example: true,
  representation: true,
  dependency: true,
  contradiction: true,
  adjunction: true,
  localization: true,
  completion: true,
  categorification: true,
  decategorification: true,
  historical: true,
  definition: true,
  references: true,
  "appears-in": true,
  "appears-in-section": true,
  proves: true,
}

test("prototype identities, metadata, and typed evidence all resolve", () => {
  assert.equal(model.version, 1)
  assert.equal(model.initial, "group")
  assert.ok(model.concepts.length >= 18 && model.concepts.length <= 24)
  for (const list of [model.concepts, model.sections, model.relations, model.sources])
    assert.equal(new Set(list.map((item) => item.id)).size, list.length)
  for (const concept of model.concepts) {
    assert.match(concept.id, /^[a-z][a-z0-9-]*$/)
    assert.ok(
      concept.title && concept.zh && concept.summary && concept.symbol && concept.terms.length,
    )
    assert.match(concept.zh, /\p{Script=Han}/u)
    assert.ok(["concept", "construction", "example", "structure"].includes(concept.kind))
    assert.equal(sectionById.get(concept.sections[0])?.level, 1)
    for (const id of concept.sections) assert.equal(sectionById.get(id)?.concept, concept.id)
  }
  for (const relation of model.relations) {
    assert.ok(conceptById.has(relation.source) && conceptById.has(relation.target), relation.id)
    assert.notEqual(relation.source, relation.target)
    assert.ok(relationTypes[relation.type], relation.id)
    assert.ok(relation.strength > 0 && relation.strength <= 1)
    assert.ok(relation.label && relation.explanation)
    const evidence = /^([^#]+)#(.+); section:([a-z0-9-]+)$/.exec(relation.evidence)
    assert.ok(evidence, relation.id)
    assert.ok(sourceById.has(evidence[1]), relation.id)
    assert.ok(sectionById.has(evidence[3]), relation.id)
    for (const [lens, value] of Object.entries(relation.lenses)) {
      assert.ok(["structural", "action", "linear"].includes(lens))
      assert.ok(value >= 0 && value <= 1)
    }
  }
  for (const source of model.sources) {
    const url = new URL(source.url)
    assert.equal(url.protocol, "https:")
    assert.ok(
      ["ocw.mit.edu", "www.math.brown.edu", "people.math.carleton.ca"].includes(url.hostname),
    )
  }
})

test("section files are ordinary bounded Markdown, with no hidden extra manuscript", async () => {
  const paths = model.sections.map((section) => section.markdown)
  assert.equal(new Set(paths).size, paths.length)
  const listed = (await readdir(path.join(root, "sections")))
    .map((file) => `sections/${file}`)
    .sort()
  assert.deepEqual([...paths].sort(), listed)
  for (const section of model.sections) {
    assert.ok(section.markdown, `The demonstration section ${section.id} needs Markdown`)
    assert.match(section.markdown, /^sections\/[a-z0-9-]+\.md$/)
    const resolved = path.resolve(root, section.markdown)
    assert.ok(resolved.startsWith(path.resolve(root) + path.sep))
    const status = await lstat(resolved)
    assert.ok(status.isFile() && !status.isSymbolicLink())
    const markdown = await readFile(resolved, "utf8")
    assert.ok(markdown.trim().length > 30)
    assert.doesNotMatch(
      markdown,
      /<script|<iframe|file:\/\/|[A-Z]:\\(?:Users|Windows|Program Files)\\|\.obsidian/,
    )
    assert.ok(conceptById.has(section.concept))
    assert.ok([1, 2, 3].includes(section.level))
  }
})

test("recursive sections have no cycles and expose the actual required prerequisite chains", () => {
  function traverse(id: string, stack: string[] = []): Set<string> {
    assert.ok(sectionById.has(id), `Missing ${id}`)
    assert.ok(!stack.includes(id), `Cycle: ${[...stack, id].join(" → ")}`)
    const seen = new Set([id])
    for (const child of sectionById.get(id)!.children)
      for (const descendant of traverse(child, [...stack, id])) seen.add(descendant)
    return seen
  }
  const all = new Set<string>()
  for (const concept of model.concepts) {
    const descendants = traverse(concept.sections[0])
    for (const id of concept.sections)
      assert.ok(descendants.has(id), `Unreachable own section ${id}`)
    for (const id of descendants) all.add(id)
  }
  assert.equal(all.size, model.sections.length)
  for (const [parent, child] of [
    ["group-overview", "group-definition"],
    ["group-definition", "group-associativity"],
    ["group-associativity", "group-example"],
    ["action-definition", "orbit-definition"],
    ["action-definition", "stabilizer-definition"],
    ["representation-definition", "vector-space-definition"],
    ["representation-definition", "linear-map-definition"],
  ])
    assert.ok(sectionById.get(parent)!.children.includes(child))
})

test("the transition has supported neighbors rather than isolated decorative concepts", () => {
  const neighbors = (id: string) =>
    new Set(
      model.relations.flatMap((r) =>
        r.source === id ? [r.target] : r.target === id ? [r.source] : [],
      ),
    )
  for (const id of ["symmetry", "homomorphism", "subgroup", "quotient", "action", "representation"])
    assert.ok(neighbors("group").has(id), id)
  for (const id of ["group", "orbit", "stabilizer", "representation"])
    assert.ok(neighbors("action").has(id), id)
  for (const id of ["action", "module", "character", "irreducible-representation", "intertwiner"])
    assert.ok(neighbors("representation").has(id), id)
  const reached = new Set([model.initial]),
    queue = [model.initial]
  for (let i = 0; i < queue.length; i++)
    for (const id of neighbors(queue[i]))
      if (!reached.has(id)) {
        reached.add(id)
        queue.push(id)
      }
  assert.equal(reached.size, model.concepts.length)
})

test("every formula renders to KaTeX HTML and MathML, and in-field links resolve", async () => {
  const processor = unified().use(remarkParse).use(remarkMath).use(remarkRehype).use(rehypeKatex, {
    strict: "error",
    trust: false,
    output: "htmlAndMathml",
  })
  let formulas = 0,
    localLinks = 0
  for (const concept of model.concepts)
    assert.match(
      katex.renderToString(concept.symbol, {
        throwOnError: true,
        strict: "error",
        output: "htmlAndMathml",
      }),
      /<math/,
    )
  for (const section of model.sections) {
    const markdown = await text(section.id)
    const ast = unified().use(remarkParse).use(remarkMath).parse(markdown)
    visit(ast, (node) => {
      if (node.type === "math" || node.type === "inlineMath") formulas++
      if (node.type === "link") {
        const { url } = node as { type: string; url: string }
        if (url.startsWith("concept:")) {
          assert.ok(conceptById.has(url.slice(8)))
          localLinks++
        } else if (url.startsWith("section:")) {
          assert.ok(sectionById.has(url.slice(8)))
          localLinks++
        } else assert.equal(new URL(url).protocol, "https:")
      }
    })
    const html = toHtml(await processor.run(processor.parse(markdown)))
    assert.doesNotMatch(html, /katex-error/)
    if (/\$/.test(markdown)) assert.match(html, /<math/)
  }
  assert.ok(formulas >= 80, String(formulas))
  assert.ok(localLinks >= 8, String(localLinks))
})

test("short mathematical definitions retain their necessary hypotheses", async () => {
  assert.match(await text("quotient-definition"), /normal subgroup/)
  assert.match(await text("stabilizer-definition"), /coset set;.*need not be normal/)
  assert.match(await text("group-algebra-definition"), /only finitely many coefficients/)
  assert.match(await text("module-definition"), /unital.*algebra[\s\S]*left.*module[\s\S]*1_Av=v/)
  assert.match(await text("character-definition"), /finite group[\s\S]*dim_\{\\mathbb C\}V<\\infty/)
  assert.match(await text("irreducible-representation-definition"), /V\\ne0/)
  assert.match(
    await text("representation-theory-example"),
    /finite group over.*mathbb C[\s\S]*finite-dimensional/,
  )
  assert.match(await text("linear-map-definition"), /same field/)
})

test("the displayed triangle, C3 rotation, and C2 module examples satisfy finite computations", () => {
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ]
  const compose = (p: number[], q: number[]) => q.map((value) => p[value])
  for (const p of permutations)
    for (const q of permutations)
      for (const r of permutations)
        assert.deepEqual(compose(compose(p, q), r), compose(p, compose(q, r)))
  const r = [1, 2, 0],
    s = [0, 2, 1],
    identity = [0, 1, 2]
  assert.deepEqual(compose(r, compose(r, r)), identity)
  assert.deepEqual(compose(s, s), identity)
  assert.deepEqual(compose(s, compose(r, s)), compose(r, r))
  const orbit = new Set(permutations.map((p) => p[0]))
  const stabilizer = permutations.filter((p) => p[0] === 0)
  assert.equal(orbit.size * stabilizer.length, permutations.length)
  const matrix = [-0.5, -Math.sqrt(3) / 2, Math.sqrt(3) / 2, -0.5]
  const multiply = (a: number[], b: number[]) => [
    a[0] * b[0] + a[1] * b[2],
    a[0] * b[1] + a[1] * b[3],
    a[2] * b[0] + a[3] * b[2],
    a[2] * b[1] + a[3] * b[3],
  ]
  multiply(matrix, multiply(matrix, matrix)).forEach((value, i) =>
    assert.ok(Math.abs(value - [1, 0, 0, 1][i]) < 1e-12),
  )
  const act = ([a, b]: number[], [x, y]: number[]) =>
    [a * x + b * y, a * y + b * x].map((value) => (value === 0 ? 0 : value))
  const algebraProduct = ([a, b]: number[], [c, d]: number[]) => [a * c + b * d, a * d + b * c]
  for (const vector of [
    [-1, 2],
    [0, 1],
    [3, -2],
  ]) {
    assert.deepEqual(act([1, 0], vector), vector)
    assert.deepEqual(act([0, 1], act([0, 1], vector)), vector)
    for (const a of [-1, 0, 2])
      for (const b of [-1, 0, 2])
        for (const c of [-1, 0, 2])
          for (const d of [-1, 0, 2])
            assert.deepEqual(
              act(algebraProduct([a, b], [c, d]), vector),
              act([a, b], act([c, d], vector)),
            )
  }
})
