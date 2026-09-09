import { strict as assert } from "node:assert"
import { test } from "node:test"
import { forceSimulation, forceLink, forceManyBody } from "d3-force-3d"
import {
  buildKnowledgeScene,
  sceneScopeNodes,
  migrateSceneState,
  sceneLinkStrength,
} from "./knowledgeScene"
import type { GraphIndex, GraphObject } from "./knowledgeGraph"
import type { ReaderCatalog } from "./readerCatalog"

const object = (id: string, chapterId = "chapter-a"): GraphObject => ({
  id,
  kind: id.startsWith("note:") ? "note" : "atom",
  type: "definition",
  title: id,
  href: `${id}.html`,
  bookId: "book-a",
  chapterId,
  text: "Definition",
  excerpt: "Definition",
  aliases: [],
  latex: [],
  relatedNotes: [],
})
function fixture(): { index: GraphIndex; catalog: ReaderCatalog } {
  const sections = [
    { slug: "s1", title: "1.1 First", number: "1.1", knowledge: [] },
    { slug: "s2", title: "2.1 Second", number: "2.1", knowledge: [] },
    { slug: "s3", title: "2.2 Existing prose without atoms", number: "2.2", knowledge: [] },
  ]
  const catalog: ReaderCatalog = {
    version: 1,
    books: [
      {
        id: "book-a",
        title: "Book",
        subtitle: "",
        source: "",
        slug: "book",
        contentsSlug: "contents",
        plans: [],
        chapters: [
          {
            id: "chapter-a",
            title: "Chapter A",
            slug: "ca",
            sections: sections.slice(0, 1),
            knowledge: [],
            connections: [],
            exercises: [],
            canvas: [],
          },
          {
            id: "chapter-b",
            title: "Chapter B",
            slug: "cb",
            sections: sections.slice(1),
            knowledge: [],
            connections: [],
            exercises: [],
            canvas: [],
          },
        ],
      },
    ],
    pages: {},
  }
  const index: GraphIndex = {
    objects: [
      object("note:s1"),
      object("note:s2", "chapter-b"),
      object("note:s3", "chapter-b"),
      object("shared"),
      object("unmapped", "chapter-b"),
    ],
    relations: [
      {
        id: "m1",
        source: "shared",
        target: "note:s1",
        type: "appears-in-section",
        provenance: "structure",
      },
      {
        id: "m2",
        source: "shared",
        target: "note:s2",
        type: "appears-in-section",
        provenance: "structure",
      },
    ],
    groups: [],
  }
  return { catalog, index }
}
test("one mathematical identity retains cross-chapter membership without duplicating scene objects", () => {
  const { index, catalog } = fixture(),
    before = JSON.stringify({ index, catalog }),
    scene = buildKnowledgeScene(index, catalog)
  assert.equal(JSON.stringify({ index, catalog }), before)
  assert.equal(scene.nodes.filter((n) => n.id === "shared").length, 1)
  assert.deepEqual(scene.memberships.shared, ["note:s1", "note:s2"])
  assert.equal(new Set(scene.nodes.map((n) => n.id)).size, scene.nodes.length)
  for (const scope of ["note:s1", "note:s2"])
    assert.equal(sceneScopeNodes(scene, scope).filter((n) => n.id === "shared").length, 1)
  assert.ok(sceneScopeNodes(scene, "collection:chapter:chapter-a").some((n) => n.id === "note:s1"))
  assert.ok(sceneScopeNodes(scene, "collection:chapter:chapter-b").some((n) => n.id === "note:s2"))
  assert.ok(sceneScopeNodes(scene, "collection:chapter:chapter-a").every((n) => n.kind !== "atom"))
})
test("empty atom sections still expose their real reading destination and unmapped atoms remain discoverable", () => {
  const { index, catalog } = fixture(),
    scene = buildKnowledgeScene(index, catalog)
  assert.equal(scene.nodes.find((n) => n.id === "note:s3")?.href, "s3.html")
  assert.ok(sceneScopeNodes(scene, "collection:chapter:chapter-b").some((n) => n.id === "note:s3"))
  const fallback = scene.nodes.find((n) => n.id === scene.memberships.unmapped[0])!
  assert.equal(fallback.parentId, "collection:chapter:chapter-b")
  assert.ok(sceneScopeNodes(scene, fallback.id).some((n) => n.id === "unmapped"))
})
test("initial geometry is stable and genuinely three dimensional with a strict collection tree", () => {
  const { index, catalog } = fixture(),
    a = buildKnowledgeScene(index, catalog),
    b = buildKnowledgeScene(index, catalog)
  assert.deepEqual(a, b)
  assert.ok(new Set(a.nodes.map((n) => n.anchor.z)).size > 3)
  for (const n of a.nodes) {
    const visited = new Set<string>()
    let p: typeof n | undefined = n
    while (p) {
      assert.ok(!visited.has(p.id))
      visited.add(p.id)
      p = a.nodes.find((q) => q.id === p?.parentId)
    }
  }
})
test("old two-dimensional camera migration preserves scope and identity without pretending to restore 3D coordinates", () => {
  const { index, catalog } = fixture(),
    scene = buildKnowledgeScene(index, catalog)
  const migrated = migrateSceneState(
    {
      groupId: "chapter-b",
      focusId: "shared",
      type: "definition",
      layers: ["authored", "structure"],
      positions: { shared: { x: 1, y: 2, width: 3, height: 4 } },
      camera: { x: 10, y: 20, k: 2 },
    },
    scene,
  )
  assert.equal(migrated.scopeId, "collection:chapter:chapter-b")
  assert.equal(migrated.focusId, "shared")
  assert.equal(migrated.positions, undefined)
  assert.equal(migrated.camera, undefined)
})
test("3D history validates finite coordinates and drops retired or unknown identities", () => {
  const { index, catalog } = fixture(),
    scene = buildKnowledgeScene(index, catalog)
  const migrated = migrateSceneState(
    {
      version: 2,
      scopeId: "note:s2",
      positions: {
        shared: { x: 1, y: 2, z: 3 },
        unknown: { x: 1, y: 2, z: 3 },
        unmapped: { x: Infinity, y: 0, z: 0 },
      },
      camera: { position: [0, 1, 2], target: [0, 0, 0], up: [0, 1, 0] },
      cameraViewport: { width: 368, height: 589, fullscreen: true },
    },
    scene,
  )
  assert.deepEqual(Object.keys(migrated.positions!), ["shared"])
  assert.deepEqual(migrated.camera?.position, [0, 1, 2])
  assert.deepEqual(migrated.cameraViewport, { width: 368, height: 589, fullscreen: true })
})
test("actual force engine attracts explicit relationships more than weak similarity; disconnected objects repel", () => {
  function separation(strength?: number) {
    const nodes = [
      { id: "a", x: -150, y: 0, z: -20 },
      { id: "b", x: 150, y: 0, z: 20 },
    ]
    const sim = forceSimulation(nodes, 3).stop().force("repulsion", forceManyBody().strength(-50))
    if (strength !== undefined)
      sim.force(
        "link",
        forceLink([{ source: "a", target: "b" }])
          .id((n) => (n as (typeof nodes)[number]).id)
          .distance(100)
          .strength(strength),
      )
    sim.tick(30)
    return Math.hypot(nodes[0].x - nodes[1].x, nodes[0].y - nodes[1].y, nodes[0].z - nodes[1].z)
  }
  assert.ok(separation(sceneLinkStrength("authored")) < separation(sceneLinkStrength("similarity")))
  assert.ok(separation() > Math.hypot(300, 40))
})
