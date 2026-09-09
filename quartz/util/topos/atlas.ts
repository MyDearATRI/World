import type { KnowledgeModel, Concept, Relation } from "./types"

export interface AtlasRegistry {
  nodes: {
    stable_id: string
    canonical_title: string
    title_zh?: string
    aliases: string[]
    volume_id: string
    kind: string
    parent_ids: string[]
    cross_memberships: { parent_id: string; reason: string; source_ids: string[] }[]
    source_ids: string[]
    frontier: { status: string }
    membership_role?: string
    placement_note?: string
  }[]
}
export interface AtlasSource {
  id: string
  title: string
  url: string
}
const palette = [
  "#805894",
  "#6a639d",
  "#3c7291",
  "#477594",
  "#328079",
  "#347664",
  "#718047",
  "#aa7936",
  "#95683e",
  "#9b6265",
  "#a15677",
  "#69779a",
]
const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")

/** Classification edges describe an editorial taxonomy, never a proof dependency. */
export function createAtlas(registry: AtlasRegistry, sources: AtlasSource[]) {
  const nodes = registry.nodes.filter(
    (n) => n.volume_id === "vol-1-existing" && n.stable_id !== "vol-1-existing",
  )
  const byID = new Map(nodes.map((n) => [n.stable_id, n]))
  const regions = nodes.filter((n) => n.stable_id.startsWith("math.region."))
  const topics = regions.map((n, i) => ({
    id: n.stable_id,
    title: n.title_zh || n.canonical_title,
    color: palette[i % palette.length],
    description: "有来源的数学标题；不代表已有笔记或 Lean 验证",
  }))
  function memberships(id: string, path = new Set<string>()): string[] {
    if (path.has(id)) throw new Error(`Cyclic ontology: ${id}`)
    if (topics.some((t) => t.id === id)) return [id]
    const n = byID.get(id)
    if (!n) return []
    return [
      ...new Set(
        [...n.parent_ids, ...n.cross_memberships.map((m) => m.parent_id)].flatMap((p) =>
          memberships(p, new Set([...path, id])),
        ),
      ),
    ]
  }
  const sections: Record<string, string> = {}
  const concepts: Concept[] = nodes.map((n) => {
    const topicIDs = memberships(n.stable_id)
    const title = n.title_zh || n.canonical_title
    const verifiedSources = n.source_ids
      .map((id) => sources.find((s) => s.id === id))
      .filter((s): s is AtlasSource => !!s)
    const frontier = n.frontier?.status === "ACTIVE_FRONTIER"
    const editorial = n.membership_role === "editorial-context"
    sections[`atlas:${n.stable_id}`] =
      `<h2>${escape(title)}</h2><p>${escape(n.canonical_title)}</p><p>${frontier ? "前沿方向：来源与活动证据已单独登记。" : "这是数学分类中的标题节点。"} 此处没有对应的个人数学正文，也未执行 Lean 检查。</p><h3>分类位置</h3><ul>${[
        ...n.parent_ids,
        ...n.cross_memberships.map((m) => m.parent_id),
      ]
        .filter((id) => byID.has(id))
        .map(
          (id) =>
            `<li><a href="./atlas.html#focus=${encodeURIComponent(id)}&depth=2" data-concept-target="${escape(id)}">${escape(byID.get(id)!.title_zh || byID.get(id)!.canonical_title)}</a></li>`,
        )
        .join(
          "",
        )}</ul><h3>核验来源</h3><ul>${verifiedSources.map((s) => `<li><a href="${escape(s.url)}" target="_blank" rel="noopener noreferrer">${escape(s.title)}</a></li>`).join("")}</ul><p><a href="./static/ontology/audit.json">查看覆盖、抽样与缺口记录</a> · <a href="./static/ontology/math_outline.md">三卷标题树</a></p>`
    sections[`atlas:${n.stable_id}`] = sections[`atlas:${n.stable_id}`].replace(
      "<h3>分类位置</h3><ul></ul>",
      "<p>第一卷 · 现有数学</p>",
    )
    if (editorial)
      sections[`atlas:${n.stable_id}`] +=
        "<p>导航说明：总览、数学史与数学教育暂放在基础区域便于查找；这不表示它们是数理逻辑的分支。</p>"
    return {
      id: n.stable_id,
      title,
      zh: n.canonical_title,
      kind: "concept",
      mathType: frontier ? "frontier" : "classification",
      summary: frontier ? "前沿方向 · 查看活动与来源" : "数学标题地图 · 分类归属不是证明依赖",
      symbol: "",
      terms: n.aliases,
      aliases: n.aliases,
      sections: [`atlas:${n.stable_id}`],
      href: `./atlas.html#focus=${encodeURIComponent(n.stable_id)}&depth=2`,
      topicIDs,
      color: topics.find((t) => topicIDs.includes(t.id))?.color,
      searchText: [title, n.canonical_title, ...n.aliases].join(" "),
    }
  })
  const relations: Relation[] = []
  for (const n of nodes) {
    const parents = new Map(
      n.parent_ids.map((id) => [
        id,
        { reason: n.placement_note ?? "规范标题树的上级分类", source_ids: n.source_ids },
      ]),
    )
    for (const cross of n.cross_memberships)
      if (!parents.has(cross.parent_id)) parents.set(cross.parent_id, cross)
    for (const [parent, evidence] of parents)
      if (byID.has(parent))
        relations.push({
          id: `classification:${parent}:${n.stable_id}`,
          source: parent,
          target: n.stable_id,
          type: "appears-in",
          strength: 0.7,
          label: n.membership_role === "editorial-context" ? "导航归档" : "分类归属",
          explanation: evidence.reason,
          evidence: "Phase 1 来源审计；这条线不声称先修关系或数学推导。",
          provenance: "structure",
          evidenceHref: sources.find((s) => evidence.source_ids.includes(s.id))?.url,
          lenses: { structural: 1, action: 1, linear: 1 },
        })
  }
  const model: KnowledgeModel = {
    version: 1,
    title: "数学标题地图",
    mode: "atlas",
    initial: topics[0]?.id ?? concepts[0].id,
    concepts,
    relations,
    sources,
    topics,
    sections: concepts.map((c) => ({
      id: c.sections[0],
      concept: c.id,
      title: "标题与来源",
      level: 2,
      role: "body",
      children: [],
    })),
    lenses: [{ id: "structural", label: "分类与跨区归属" }],
  }
  return { model, sections }
}

export function attachNoteTopics(
  model: KnowledgeModel,
  config: {
    topics: NonNullable<KnowledgeModel["topics"]>
    memberships: Record<string, string[]>
  },
) {
  model.topics = [...config.topics]
  let other = false
  for (const node of model.concepts) {
    const notes =
      node.objectKind === "note"
        ? [node.id]
        : (node.occurrences?.map((o) => `note:${o.slug}`) ?? [])
    node.topicIDs = [...new Set(notes.flatMap((id) => config.memberships[id] ?? []))]
    if (!node.topicIDs.length) {
      node.topicIDs = ["other"]
      other = true
    }
    node.color = model.topics.find((t) => node.topicIDs!.includes(t.id))?.color ?? "#697579"
  }
  if (other)
    model.topics.push({
      id: "other",
      title: "其他已公开笔记",
      color: "#697579",
      description: "暂未分配导航主题；原文完整保留",
    })
}
