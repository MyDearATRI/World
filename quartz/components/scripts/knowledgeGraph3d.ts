import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import {
  forceSimulation,
  forceManyBody,
  forceCollide,
  forceLink,
  forceX,
  forceY,
  forceZ,
  type SimulationNodeDatum,
} from "d3-force-3d"
import type { ReaderCatalog } from "../../util/readerCatalog"
import {
  findKnowledgePath,
  graphTypeLabel,
  type GraphIndex,
  type GraphRelation,
} from "../../util/knowledgeGraph"
import {
  buildKnowledgeScene,
  sceneScopeNodes,
  sceneLinkStrength,
  migrateSceneState,
  type KnowledgeSceneState,
  type SceneNode,
} from "../../util/knowledgeScene"

export interface KnowledgeGraph3dOptions {
  catalog: ReaderCatalog
  siteRoot?: string | URL
  initialFocus?: string
  initialChapterId?: string
  initialBookId?: string
  onSelect: (id: string, trigger: HTMLElement | SVGElement) => void
  onStateChange?: (state: KnowledgeSceneState) => void
  recommendations?: GraphRelation[]
}
interface SimNode extends SimulationNodeDatum {
  id: string
  x: number
  y: number
  z: number
  data: SceneNode
}
const provenance = {
  authored: "原文数学关系",
  reference: "正文引用",
  structure: "内容归属",
  similarity: "相似推荐 · 模型计算",
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text) n.textContent = text
  return n
}
function button(text: string, action: () => void, label = text) {
  const n = el("button", "kg3d-control", text)
  n.type = "button"
  n.setAttribute("aria-label", label)
  n.addEventListener("click", action)
  return n
}
const isCollection = (n: SceneNode) => !["atom", "note"].includes(n.kind)
const plain = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/** Independently loaded WebGL enhancement. Every destination remains a real DOM link. */
export function mountKnowledgeGraph(
  host: HTMLElement,
  index: GraphIndex,
  options: KnowledgeGraph3dOptions,
) {
  const model = buildKnowledgeScene(index, options.catalog)
  const byId = new Map(model.nodes.map((n) => [n.id, n]))
  const objectById = new Map(index.objects.map((o) => [o.id, o]))
  const root = new URL(options.siteRoot ?? "./", location.href)
  const urlFor = (href: string) => {
    const u = new URL(href, root)
    return u.origin === root.origin && u.pathname.startsWith(root.pathname) ? u.href : "#"
  }
  const reduced = matchMedia("(prefers-reduced-motion: reduce)")
  let state: KnowledgeSceneState = {
    version: 2,
    scopeId: undefined,
    focusId: options.initialFocus,
    type: "all",
    layers: ["authored", "reference", "structure", "similarity"],
    expanded: [],
    positions: {},
    camera: { position: [0, 600, 1800], target: [0, 0, 0], up: [0, 1, 0] },
  }
  if (state.focusId) {
    const n = byId.get(state.focusId)
    state.scopeId = n && isCollection(n) ? n.id : n?.parentId
  } else if (options.initialChapterId)
    state.scopeId = `collection:chapter:${options.initialChapterId}`
  else if (options.initialBookId) state.scopeId = `collection:book:${options.initialBookId}`
  let recommendations = options.recommendations ?? []
  let destroyed = false,
    paused = false,
    fullscreen = false,
    dragMode = false
  let visible: SceneNode[] = [],
    nodes: SimNode[] = []
  let renderer: THREE.WebGLRenderer | undefined
  let controls: OrbitControls | undefined
  let frame = 0,
    renderCount = 0,
    ticks = 0,
    dirty = true,
    controlsMoving = false
  let lastCamera: number[] = []
  let rendering = false
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(42, 1, 1, 40000)
  const meshes = new Map<string, THREE.Mesh>()
  const labels = new Map<string, HTMLElement>()
  const links: {
    line: THREE.Line
    source: string
    target: string
    layer: string
    arrow?: THREE.Mesh
  }[] = []
  const geometries = {
    atom: new THREE.SphereGeometry(7, 16, 10),
    note: new THREE.BoxGeometry(10, 10, 10),
    collection: new THREE.OctahedronGeometry(12, 0),
  }
  const cleanup: (() => void)[] = []
  const simulation = forceSimulation<SimNode>([], 3).stop().alphaDecay(0.06).velocityDecay(0.43)
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const dragPlane = new THREE.Plane()
  const hitPoint = new THREE.Vector3()
  let dragNode: SimNode | undefined,
    downNode: string | undefined,
    downX = 0,
    downY = 0,
    moved = 0
  const touches = new Map<number, { x: number; y: number }>()

  host.replaceChildren()
  host.classList.add("knowledge-map-3d")
  host.setAttribute("aria-label", "三维数学知识地图")
  host.dataset.renderer = "loading"
  host.dataset.simulation = "settled"
  host.dataset.renderLoop = "idle"
  const toolbar = el("div", "kg3d-toolbar")
  const current = el("strong", "kg3d-current", "知识地图")
  const back = button("返回上一层", () => enter(byId.get(state.scopeId ?? "")?.parentId))
  const fitButton = button("适应视图", () => fit())
  const fullButton = button("打开全屏地图", () => toggleFullscreen())
  const pathButton = button("查看连接路径", () => openPath(pathButton))
  const toggleSettings = el("details", "kg3d-settings"),
    settingsSummary = el("summary", undefined, "视图选项")
  const settings = el("div", "kg3d-settings-body")
  const pauseButton = button("暂停布局", () => {
    paused = !paused
    pauseButton.textContent = paused ? "继续布局" : "暂停布局"
    pauseButton.setAttribute("aria-label", pauseButton.textContent)
    host.dataset.simulation = paused ? "paused" : "running"
    if (!paused) reheat()
    invalidate()
  })
  const dragButton = button("调整节点位置", () => {
    dragMode = !dragMode
    dragButton.setAttribute("aria-pressed", String(dragMode))
    help.textContent = dragMode ? "拖动节点调整位置。空白仍可旋转；双指缩放和平移。" : defaultHelp
  })
  dragButton.setAttribute("aria-pressed", "false")
  const defaultHelp = "拖动空白旋转 · 滚轮缩放 · 点击名称阅读。触屏单指旋转，双指缩放与平移。"
  const help = el("p", "kg3d-help", defaultHelp)
  const typeSelect = el("select")
  typeSelect.setAttribute("aria-label", "知识对象类型")
  typeSelect.add(new Option("全部类型", "all"))
  for (const type of new Set(index.objects.filter((o) => o.kind === "atom").map((o) => o.type)))
    typeSelect.add(new Option(graphTypeLabel(type), type))
  typeSelect.addEventListener("change", () => {
    state.type = typeSelect.value
    rebuild(false)
  })
  const layerInputs = new Map<string, HTMLInputElement>()
  for (const [key, title] of Object.entries(provenance)) {
    const label = el("label", "kg3d-layer"),
      input = el("input")
    input.type = "checkbox"
    input.checked = true
    layerInputs.set(key, input)
    input.addEventListener("change", () => {
      state.layers = [...layerInputs]
        .filter(([, i]) => i.checked)
        .map(([k]) => k as GraphRelation["provenance"])
      rebuild(false)
    })
    label.append(input, document.createTextNode(title))
    settings.append(label)
  }
  const resetButton = button("重置布局", () => {
    state.positions = {}
    paused = false
    rebuild(true, false)
  })
  settings.append(typeSelect, pauseButton, resetButton, dragButton)
  toggleSettings.append(settingsSummary, settings)
  toolbar.append(
    back,
    current,
    button("−", () => dolly(1.2), "缩小地图"),
    button("+", () => dolly(0.8), "放大地图"),
    fitButton,
    pathButton,
    toggleSettings,
    fullButton,
  )
  const stage = el("div", "kg3d-stage"),
    overlay = el("div", "kg3d-labels"),
    fallback = el("p", "kg3d-fallback")
  const labelLines = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  labelLines.classList.add("kg3d-label-lines")
  labelLines.setAttribute("aria-hidden", "true")
  const canvas = el("canvas", "kg3d-canvas")
  canvas.tabIndex = 0
  canvas.setAttribute(
    "aria-label",
    "三维地图。方向键旋转，Shift 加方向键平移，加减键缩放，Home 适应视图。下方提供完整文字目录。",
  )
  stage.append(canvas, labelLines, overlay, fallback)
  const cameraTools = el("div", "kg3d-camera-tools")
  for (const [text, dx, dy] of [
    ["左", 0.15, 0],
    ["右", -0.15, 0],
    ["上", 0, 0.15],
    ["下", 0, -0.15],
  ] as const)
    cameraTools.append(button(`旋转${text}`, () => orbit(dx, dy), `旋转地图${text}`))
  for (const [text, dx, dy] of [
    ["左", -35, 0],
    ["右", 35, 0],
    ["上", 0, 35],
    ["下", 0, -35],
  ] as const)
    cameraTools.append(button(`平移${text}`, () => pan(dx, dy), `平移地图${text}`))
  const legend = el(
    "p",
    "kg3d-legend",
    "棱形是书章集合，圆点是数学原子，方点是完整笔记。相似度只帮助发现内容，不表示数学推导。",
  )
  const body = el("div", "kg3d-lists"),
    tree = el("nav", "kg3d-tree"),
    contents = el("section", "kg3d-contents"),
    related = el("section", "kg3d-related")
  tree.setAttribute("aria-label", "书籍章节目录")
  const live = el("p", "kg3d-status")
  live.setAttribute("role", "status")
  live.setAttribute("aria-live", "polite")
  body.append(tree, contents, related)
  host.append(toolbar, help, stage, cameraTools, legend, live, body)

  function getState() {
    for (const n of nodes) state.positions[n.id] = { x: n.x, y: n.y, z: n.z }
    if (controls)
      state.camera = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        up: camera.up.toArray(),
      }
    // A hidden phone stage has no viewport; retain its last visible camera provenance.
    if (stage.clientWidth > 0 && stage.clientHeight > 0)
      state.cameraViewport = { width: stage.clientWidth, height: stage.clientHeight, fullscreen }
    return structuredClone(state)
  }
  Object.defineProperty(host, "knowledgeMapState", {
    configurable: true,
    get: () => ({
      ...getState(),
      diagnostics: {
        nodeIds: model.nodes.map((n) => n.id),
        visibleIds: visible.map((n) => n.id),
        collectionIds: model.nodes.filter(isCollection).map((n) => n.id),
        memberships: model.memberships,
        renderCount,
      },
    }),
  })
  function notify() {
    if (destroyed) return
    const snapshot = getState()
    options.onStateChange?.(snapshot)
    host.dispatchEvent(new CustomEvent("knowledge-map-state", { detail: snapshot }))
  }
  function saveCamera() {
    if (controls)
      state.camera = {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
        up: camera.up.toArray(),
      }
  }
  function invalidate() {
    dirty = true
    if (!frame && !rendering && !destroyed && renderer) {
      host.dataset.renderLoop = "active"
      frame = requestAnimationFrame(renderFrame)
    }
  }
  function reheat() {
    if (paused || reduced.matches) return
    simulation.alpha(0.5)
    ticks = 0
    host.dataset.simulation = "running"
    invalidate()
  }
  function directRelations() {
    return [
      ...index.relations,
      ...recommendations.filter((e) => e.provenance === "similarity"),
    ].filter((e) => byId.has(e.source) && byId.has(e.target))
  }

  function enter(id?: string) {
    state.scopeId = id
    state.focusId = undefined
    state.expanded = []
    rebuild(true)
    live.textContent = `已进入${byId.get(id ?? "")?.title ?? "全部书籍"}`
  }
  function activate(id: string, trigger: HTMLElement) {
    const n = byId.get(id)
    if (!n) return
    if (isCollection(n)) enter(id)
    else {
      state.focusId = id
      notify()
      options.onSelect(n.objectId!, trigger)
    }
  }
  function objectLink(n: SceneNode, text = n.title) {
    const a = el("a", undefined, text)
    a.href = urlFor(n.href ?? "#")
    if (n.objectId) {
      a.dataset.knowledgeId = n.objectId
      a.dataset.objectId = n.objectId
    }
    a.addEventListener("click", (event) => {
      if (plain(event) && n.objectId) {
        event.preventDefault()
        state.focusId = n.objectId
        notify()
        options.onSelect(n.objectId, a)
      }
    })
    a.addEventListener("focus", () => {
      host.dataset.highlight = n.id
      highlight(n.id)
    })
    a.addEventListener("blur", () => highlight(state.focusId))
    return a
  }
  function scopeButton(n: SceneNode) {
    const b = button(n.title, () => enter(n.id))
    b.dataset.kgScope = n.id
    if (n.id === state.scopeId) b.setAttribute("aria-current", "true")
    return b
  }
  function renderLists() {
    current.textContent = byId.get(state.scopeId ?? "")?.title ?? "书籍与知识"
    back.disabled = !state.scopeId
    tree.replaceChildren(el("h3", undefined, "书 · 章 · 节"))
    function branch(id: string, depth: number): HTMLElement {
      const n = byId.get(id)!,
        box = el("div", "kg3d-branch")
      box.style.setProperty("--tree-depth", String(depth))
      box.append(scopeButton(n))
      const children = (model.children[id] ?? []).map((i) => byId.get(i)!).filter(isCollection)
      const shouldOpen =
        n.kind === "book" ||
        n.id === state.scopeId ||
        children.some((c) => c.id === state.scopeId) ||
        n.chapterId === byId.get(state.scopeId ?? "")?.chapterId
      if (children.length) {
        const d = el("details")
        d.open = shouldOpen
        const s = el("summary", undefined, n.kind === "book" ? "章节" : "小节与其他知识")
        d.append(s, ...children.map((c) => branch(c.id, depth + 1)))
        box.append(d)
      }
      return box
    }
    tree.append(...model.roots.map((id) => branch(id, 0)))
    contents.replaceChildren(el("h3", undefined, "当前范围"))
    const scope = byId.get(state.scopeId ?? "")
    if (scope?.href)
      contents.append(
        objectLink(
          scope,
          `阅读${scope.kind === "section" ? "本节" : scope.kind === "chapter" ? "本章目录" : "书籍目录"} →`,
        ),
      )
    const objects =
      scope?.kind === "chapter"
        ? model.nodes.filter(
            (n) =>
              !isCollection(n) &&
              (n.chapterId === scope.chapterId ||
                model.memberships[n.id]?.some((id) => byId.get(id)?.parentId === scope.id)),
          )
        : visible.filter((n) => !isCollection(n))
    const childCollections = visible.filter((n) => isCollection(n) && n.parentId === state.scopeId)
    const list = el("ul", "kg3d-object-list")
    for (const n of childCollections) {
      const li = el("li")
      li.append(scopeButton(n))
      list.append(li)
    }
    for (const n of objects) {
      const li = el("li")
      li.dataset.listNodeId = n.id
      li.append(el("span", "kg3d-type", graphTypeLabel(n.type)), objectLink(n))
      const memberships = model.memberships[n.id] ?? []
      if (memberships.length > 1)
        li.append(
          el("small", undefined, `见于 ${memberships.map((id) => byId.get(id)?.title).join("、")}`),
        )
      list.append(li)
    }
    contents.append(
      el(
        "p",
        "kg3d-count",
        `${objects.filter((n) => n.kind === "atom").length} 个数学原子 · ${objects.filter((n) => n.kind === "note").length} 篇完整笔记`,
      ),
      list,
    )
    if (!objects.length && scope?.kind === "section")
      contents.append(el("p", undefined, "本节正文可阅读，当前尚无独立登记的知识原子。"))
    related.replaceChildren(el("h3", undefined, "直接联系"))
    if (!state.focusId) {
      related.append(el("p", undefined, "选择知识对象后，查看有出处的联系与跨节入口。"))
      return
    }
    const edges = directRelations().filter(
      (e) => e.source === state.focusId || e.target === state.focusId,
    )
    if (!edges.length) related.append(el("p", undefined, "当前没有已登记的直接联系。"))
    const ul = el("ul")
    for (const edge of edges.filter((e) => state.layers.includes(e.provenance)).slice(0, 24)) {
      const other = byId.get(edge.source === state.focusId ? edge.target : edge.source)!
      const li = el("li")
      li.append(
        objectLink(other),
        el(
          "small",
          undefined,
          `${provenance[edge.provenance]} · ${edge.type === "proves" ? "证明" : edge.type === "appears-in-section" ? "小节关联" : edge.type === "appears-in" ? "原文出现" : edge.type === "references" ? "引用" : "内容相似"}`,
        ),
      )
      if (edge.evidenceHref && edge.provenance !== "similarity") {
        const a = el("a", "kg3d-evidence", "查看出处")
        a.href = urlFor(edge.evidenceHref)
        li.append(a)
      }
      if (!visible.some((n) => n.id === other.id))
        li.append(
          button("在图中展开", () => {
            state.expanded.push(other.id)
            rebuild(false)
          }),
        )
      ul.append(li)
    }
    related.append(ul)
  }

  function clearScene() {
    for (const m of meshes.values()) {
      scene.remove(m)
      ;(m.material as THREE.Material).dispose()
    }
    meshes.clear()
    for (const l of links) {
      scene.remove(l.line)
      l.line.geometry.dispose()
      ;(l.line.material as THREE.Material).dispose()
      if (l.arrow) {
        scene.remove(l.arrow)
        l.arrow.geometry.dispose()
        ;(l.arrow.material as THREE.Material).dispose()
      }
    }
    links.length = 0
    overlay.replaceChildren()
    labels.clear()
  }
  function addLine(source: string, target: string, layer: string) {
    const color =
      layer === "tree"
        ? 0x889aab
        : layer === "authored"
          ? 0x1f609e
          : layer === "similarity"
            ? 0xb0adb9
            : 0x91a2b3
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(),
    ])
    const material =
      layer === "similarity"
        ? new THREE.LineDashedMaterial({
            color,
            dashSize: 7,
            gapSize: 6,
            transparent: true,
            opacity: 0.5,
          })
        : new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: layer === "tree" ? 0.65 : 0.4,
          })
    const line = new THREE.Line(geometry, material)
    scene.add(line)
    const arrow =
      layer === "authored"
        ? new THREE.Mesh(
            new THREE.ConeGeometry(3, 11, 8),
            new THREE.MeshBasicMaterial({ color: 0x1f609e }),
          )
        : undefined
    if (arrow) scene.add(arrow)
    links.push({ line, source, target, layer, arrow })
  }
  function rebuild(shouldFit: boolean, preserveCurrent = true, animateLayout = true) {
    if (preserveCurrent) getState()
    clearScene()
    host.dataset.scope = byId.get(state.scopeId ?? "")?.kind ?? "overview"
    visible = sceneScopeNodes(model, state.scopeId, state.focusId, state.expanded).filter(
      (n) =>
        isCollection(n) ||
        n.kind === "note" ||
        state.type === "all" ||
        n.type === state.type ||
        n.id === state.focusId,
    )
    const visibleIds = new Set(visible.map((n) => n.id))
    nodes = visible.map((data) => {
      const p = state.positions[data.id] ?? data.anchor
      return {
        id: data.id,
        data,
        x: p.x,
        y: p.y,
        z: p.z,
        ...(isCollection(data) ? { fx: data.anchor.x, fy: data.anchor.y, fz: data.anchor.z } : {}),
      }
    })
    const real = directRelations().filter(
      (e) =>
        visibleIds.has(e.source) && visibleIds.has(e.target) && state.layers.includes(e.provenance),
    )
    const seenPairs = new Set<string>()
    const forceEdges: { source: string; target: string; strength: number; distance: number }[] = []
    for (const edge of model.treeLinks.filter(
      (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
    )) {
      addLine(edge.source, edge.target, "tree")
    }
    // Keep the strongest physical link per pair; repeated occurrences cannot multiply attraction.
    for (const edge of real.sort(
      (a, b) => sceneLinkStrength(b.provenance) - sceneLinkStrength(a.provenance),
    )) {
      const key = [edge.source, edge.target].sort().join("\u0000")
      if (seenPairs.has(key)) continue
      seenPairs.add(key)
      forceEdges.push({
        source: edge.source,
        target: edge.target,
        strength: sceneLinkStrength(edge.provenance),
        distance: edge.provenance === "similarity" ? 210 : 105,
      })
      if (
        edge.provenance !== "structure" ||
        !model.treeLinks.some(
          (e) =>
            (e.source === edge.target && e.target === edge.source) ||
            (e.source === edge.source && e.target === edge.target),
        )
      )
        addLine(edge.source, edge.target, edge.provenance)
    }
    for (const n of nodes) {
      const col = isCollection(n.data),
        geometry = col
          ? geometries.collection
          : n.data.kind === "note"
            ? geometries.note
            : geometries.atom
      const material = new THREE.MeshBasicMaterial({
        color: col ? 0x748ba0 : n.data.kind === "atom" ? 0x2c689d : 0x9aa5ad,
        wireframe: col,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData.nodeId = n.id
      mesh.position.set(n.x, n.y, n.z)
      scene.add(mesh)
      meshes.set(n.id, mesh)
      const label = col ? scopeButton(n.data) : objectLink(n.data)
      label.classList.add("kg3d-node")
      label.dataset.nodeId = n.id
      label.dataset.kind = n.data.kind
      label.title = n.data.title
      overlay.append(label)
      labels.set(n.id, label)
    }
    simulation
      .nodes(nodes)
      .force(
        "charge",
        forceManyBody<SimNode>()
          .strength((n) => (isCollection(n.data) ? -35 : -130))
          .distanceMax(440),
      )
      .force(
        "collide",
        forceCollide<SimNode>((n) => (isCollection(n.data) ? 35 : 23)).iterations(2),
      )
      .force(
        "link",
        forceLink<SimNode, { source: string; target: string; strength: number; distance: number }>(
          forceEdges,
        )
          .id((n) => n.id)
          .strength((l) => l.strength)
          .distance((l) => l.distance),
      )
      .force("x", forceX<SimNode>((n) => n.data.anchor.x).strength(0.035))
      .force("y", forceY<SimNode>((n) => n.data.anchor.y).strength(0.05))
      .force("z", forceZ<SimNode>((n) => n.data.anchor.z).strength(0.035))
      .alpha(0.5)
      .stop()
    ticks = 0
    if (!animateLayout) {
      simulation.alpha(0)
      host.dataset.simulation = "settled"
    } else if (reduced.matches) {
      simulation.tick(90)
      simulation.alpha(0)
      host.dataset.simulation = "settled"
    } else host.dataset.simulation = paused ? "paused" : "running"
    typeSelect.value = state.type
    for (const [key, input] of layerInputs)
      input.checked = state.layers.includes(key as GraphRelation["provenance"])
    renderLists()
    highlight(state.focusId)
    if (shouldFit) fit()
    invalidate()
    notify()
  }

  function highlight(id?: string) {
    const neighbors = new Set(
      id
        ? [
            id,
            ...directRelations()
              .filter((e) => e.source === id || e.target === id)
              .flatMap((e) => [e.source, e.target]),
          ]
        : [],
    )
    for (const [nodeId, mesh] of meshes) {
      const m = mesh.material as THREE.MeshBasicMaterial
      m.transparent = true
      m.opacity = !id || neighbors.has(nodeId) || isCollection(byId.get(nodeId)!) ? 1 : 0.24
      mesh.scale.setScalar(nodeId === id ? 1.8 : 1)
    }
    for (const edge of links)
      (edge.line.material as THREE.LineBasicMaterial).opacity =
        !id || edge.layer === "tree" ? 0.4 : edge.source === id || edge.target === id ? 0.85 : 0.1
    invalidate()
  }
  function fit() {
    if (!controls || !nodes.length) return
    if (stage.clientWidth && stage.clientHeight) {
      camera.aspect = stage.clientWidth / stage.clientHeight
      camera.updateProjectionMatrix()
    }
    const ancestors = new Set<string>()
    let parent = byId.get(state.scopeId ?? "")?.parentId
    while (parent) {
      ancestors.add(parent)
      parent = byId.get(parent)?.parentId
    }
    const framed = nodes.filter((n) => !ancestors.has(n.id))
    const box = new THREE.Box3()
    for (const n of framed.length ? framed : nodes)
      box.expandByPoint(new THREE.Vector3(n.x, n.y, n.z))
    const center = box.getCenter(new THREE.Vector3())
    const direction = new THREE.Vector3(0, 0.18, 1).normalize()
    const cameraUp = new THREE.Vector3(0, 1, -0.18).normalize()
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const limitX = Math.max(0.3, 1 - 90 / Math.max(1, stage.clientWidth))
    const limitY = Math.max(0.3, 1 - 125 / Math.max(1, stage.clientHeight))
    let distance = 230
    for (const n of framed.length ? framed : nodes) {
      const delta = new THREE.Vector3(n.x, n.y, n.z).sub(center)
      const depth = delta.dot(direction)
      distance = Math.max(
        distance,
        depth + Math.abs(delta.x) / (tanY * camera.aspect * limitX),
        depth + Math.abs(delta.dot(cameraUp)) / (tanY * limitY),
      )
    }
    camera.position.copy(center).addScaledVector(direction, distance + 30)
    controls.target.copy(center)
    camera.up.set(0, 1, 0)
    controls.update()
    saveCamera()
    invalidate()
    notify()
  }
  function orbit(x: number, y: number) {
    if (!controls) return
    const spherical = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(controls.target),
    )
    spherical.theta += x
    spherical.phi = Math.min(Math.PI - 0.05, Math.max(0.05, spherical.phi + y))
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical))
    controls.update()
    saveCamera()
    invalidate()
    notify()
  }
  function dolly(factor: number) {
    if (!controls) return
    const v = camera.position.clone().sub(controls.target)
    v.setLength(Math.min(18000, Math.max(80, v.length() * factor)))
    camera.position.copy(controls.target).add(v)
    controls.update()
    invalidate()
    notify()
  }
  function pan(x: number, y: number) {
    if (!controls) return
    const scale = camera.position.distanceTo(controls.target) / 1000
    const right = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrix, 0)
      .multiplyScalar(x * scale)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).multiplyScalar(y * scale)
    const delta = right.add(up)
    camera.position.add(delta)
    controls.target.add(delta)
    controls.update()
    invalidate()
    notify()
  }
  function renderFrame() {
    frame = 0
    if (destroyed || !renderer) return
    if (document.hidden || host.closest("[hidden],[inert]") || !stage.getClientRects().length) {
      host.dataset.renderLoop = "idle"
      return
    }
    rendering = true
    let moving = false
    if (!paused && simulation.alpha() > 0.004 && ticks < 160 && !reduced.matches) {
      simulation.tick()
      ticks++
      moving = true
      dirty = true
    }
    controls?.update()
    const now = [...camera.position.toArray(), ...(controls?.target.toArray() ?? [])]
    const cameraChanged = now.some((n, i) => Math.abs(n - (lastCamera[i] ?? Infinity)) > 1e-5)
    lastCamera = now
    if (dirty || cameraChanged || moving) {
      for (const n of nodes) meshes.get(n.id)?.position.set(n.x, n.y, n.z)
      const nodeMap = new Map(nodes.map((n) => [n.id, n]))
      for (const edge of links) {
        const a = nodeMap.get(edge.source)!,
          b = nodeMap.get(edge.target)!
        const p = edge.line.geometry.getAttribute("position")
        p.setXYZ(0, a.x, a.y, a.z)
        p.setXYZ(1, b.x, b.y, b.z)
        p.needsUpdate = true
        if (edge.layer === "similarity") edge.line.computeLineDistances()
        if (edge.arrow) {
          const direction = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z).normalize()
          edge.arrow.position.set(
            a.x + (b.x - a.x) * 0.7,
            a.y + (b.y - a.y) * 0.7,
            a.z + (b.z - a.z) * 0.7,
          )
          edge.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
        }
      }
      renderer.render(scene, camera)
      renderCount++
      host.dataset.renderCount = String(renderCount)
      positionLabels()
      dirty = false
    }
    rendering = false
    if (moving || controlsMoving || cameraChanged) {
      host.dataset.renderLoop = "active"
      frame = requestAnimationFrame(renderFrame)
    } else {
      host.dataset.renderLoop = "idle"
      host.dataset.simulation = paused ? "paused" : "settled"
      notify()
    }
  }
  function positionLabels() {
    const width = stage.clientWidth,
      height = stage.clientHeight,
      occupied: { x: number; y: number; w: number; h: number }[] = []
    const ordered = [...nodes].sort(
      (a, b) =>
        (b.id === state.focusId ? 1000 : isCollection(b.data) ? 100 : 0) -
          (a.id === state.focusId ? 1000 : isCollection(a.data) ? 100 : 0) ||
        camera.position.distanceToSquared(new THREE.Vector3(a.x, a.y, a.z)) -
          camera.position.distanceToSquared(new THREE.Vector3(b.x, b.y, b.z)),
    )
    labelLines.replaceChildren()
    labelLines.setAttribute("viewBox", `0 0 ${width} ${height}`)
    const scope = byId.get(state.scopeId ?? "")
    const required = ordered.filter(
      (n) => isCollection(n.data) && n.data.parentId === state.scopeId,
    )
    const chapterLabels = scope?.kind === "chapter" ? required : []
    const placements = new Map<string, { x: number; y: number; w: number; h: number }>()
    if (chapterLabels.length) {
      if (scope)
        placements.set(scope.id, { x: width / 2, y: 10, w: Math.min(260, width - 30), h: 46 })
      const sorted = [...chapterLabels].sort(
        (a, b) => a.data.anchor.x - b.data.anchor.x || a.data.anchor.z - b.data.anchor.z,
      )
      const left = sorted.slice(0, Math.ceil(sorted.length / 2)),
        right = sorted.slice(Math.ceil(sorted.length / 2))
      const w = Math.min(185, (width - 48) / 2),
        h = 50
      for (const [column, isRight] of [
        [left, false],
        [right, true],
      ] as const) {
        for (const [i, n] of column.entries())
          placements.set(n.id, {
            x: isRight ? width - w / 2 - 10 : w / 2 + 10,
            y: 68 + (i * (height - 88 - h)) / Math.max(1, column.length - 1),
            w,
            h,
          })
      }
    }
    if (!scope || scope.kind === "book") {
      const chapters = ordered
        .filter((n) => n.data.kind === "chapter")
        .sort((a, b) => a.data.anchor.x - b.data.anchor.x)
      if (width < 500) {
        const w = Math.min(330, width - 32),
          h = 50
        for (const [i, n] of chapters.entries())
          placements.set(n.id, { x: width / 2, y: height - 18 - (chapters.length - i) * 56, w, h })
      } else {
        const w = Math.min(220, (width - 32) / Math.max(1, chapters.length) - 12),
          h = 50
        for (const [i, n] of chapters.entries())
          placements.set(n.id, {
            x: ((i + 0.5) * width) / Math.max(1, chapters.length),
            y: height - 68,
            w,
            h,
          })
      }
    }
    let count = 0
    for (const n of ordered) {
      const label = labels.get(n.id)!
      const p = new THREE.Vector3(n.x, n.y, n.z).project(camera)
      const x = ((p.x + 1) * width) / 2,
        y = ((1 - p.y) * height) / 2
      label.dataset.screenX = String(x)
      label.dataset.screenY = String(y)
      const placement = placements.get(n.id)
      const w = placement?.w ?? Math.min(190, width - 24),
        h = placement?.h ?? 46
      const labelX = placement?.x ?? Math.max(w / 2 + 10, Math.min(width - w / 2 - 10, x))
      const labelY = placement?.y ?? Math.max(8, Math.min(height - h - 8, y + 11))
      const bounds = { x: labelX - w / 2, y: labelY, w, h }
      const overlaps = occupied.some(
        (r) =>
          bounds.x < r.x + r.w && bounds.x + w > r.x && bounds.y < r.y + r.h && bounds.y + h > r.y,
      )
      const show =
        p.z > -1 &&
        p.z < 1 &&
        x > 8 &&
        x < width - 8 &&
        y > 8 &&
        y < height - 8 &&
        (!overlaps || isCollection(n.data) || n.id === state.focusId) &&
        (isCollection(n.data) || count < 24)
      label.hidden = !show
      label.style.left = `${labelX}px`
      label.style.top = `${labelY}px`
      label.style.maxWidth = `${w}px`
      label.classList.toggle("has-leader", !!placement)
      if (show) {
        occupied.push(bounds)
        count++
        if (placement) {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line")
          line.setAttribute("x1", String(x))
          line.setAttribute("y1", String(y))
          line.setAttribute("x2", String(labelX + (labelX < width / 2 ? w / 2 : -w / 2)))
          line.setAttribute("y2", String(labelY + 20))
          labelLines.append(line)
        }
      }
    }
  }

  function fallbackToList(message: string) {
    host.dataset.renderer = "fallback"
    host.dataset.renderLoop = "idle"
    host.dataset.simulation = "settled"
    fallback.textContent = message
    labelLines.replaceChildren()
    fallback.hidden = false
    canvas.hidden = true
    overlay.hidden = true
    cameraTools.hidden = true
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    simulation.stop()
    renderer?.dispose()
    renderer = undefined
    controls?.dispose()
    controls = undefined
    notify()
  }
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "low-power",
    })
    renderer.setClearColor(0xf5f5f1)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    host.dataset.renderer = "webgl2"
    fallback.hidden = true
    controls = new OrbitControls(camera, canvas)
    controls.enableDamping = !reduced.matches
    controls.dampingFactor = 0.16
    controls.autoRotate = false
    controls.minDistance = 80
    controls.maxDistance = 18000
    controls.addEventListener("change", () => invalidate())
    controls.addEventListener("start", () => {
      controlsMoving = true
      invalidate()
    })
    controls.addEventListener("end", () => {
      controlsMoving = false
      notify()
      invalidate()
    })
    camera.position.fromArray(state.camera.position)
    controls.target.fromArray(state.camera.target)
    controls.update()
  } catch {
    fallbackToList("此设备未能启用三维显示。仍可使用下面的书章目录、知识对象和关联列表继续阅读。")
  }
  const contextLost = (event: Event) => {
    event.preventDefault()
    fallbackToList("三维显示暂时中断。书章目录和完整阅读仍然可用；重新载入页面可再尝试地图。")
  }
  canvas.addEventListener("webglcontextlost", contextLost)
  cleanup.push(() => canvas.removeEventListener("webglcontextlost", contextLost))
  const resize = new ResizeObserver(() => {
    const w = stage.clientWidth,
      h = stage.clientHeight
    if (w && h && renderer) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      invalidate()
    }
  })
  resize.observe(stage)

  function hit(event: PointerEvent) {
    const r = canvas.getBoundingClientRect()
    pointer.set(
      ((event.clientX - r.left) / r.width) * 2 - 1,
      (-(event.clientY - r.top) / r.height) * 2 + 1,
    )
    raycaster.setFromCamera(pointer, camera)
    const picked = raycaster.intersectObjects([...meshes.values()], false)[0]
    return picked?.object.userData.nodeId as string | undefined
  }
  function startDrag(id: string, event: PointerEvent) {
    const n = nodes.find((n) => n.id === id)
    if (!n || isCollection(n.data)) return
    dragNode = n
    if (controls) controls.enabled = false
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()),
      new THREE.Vector3(n.x, n.y, n.z),
    )
    n.fx = n.x
    n.fy = n.y
    n.fz = n.z
    canvas.setPointerCapture(event.pointerId)
    reheat()
  }
  function moveDrag(event: PointerEvent) {
    if (!dragNode) return
    hit(event)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragNode.x = dragNode.fx = hitPoint.x
      dragNode.y = dragNode.fy = hitPoint.y
      dragNode.z = dragNode.fz = hitPoint.z
      reheat()
      invalidate()
    }
  }
  function endDrag() {
    if (dragNode) {
      state.positions[dragNode.id] = { x: dragNode.x, y: dragNode.y, z: dragNode.z }
      dragNode.fx = dragNode.fy = dragNode.fz = undefined
      dragNode = undefined
      reheat()
    }
    if (controls) controls.enabled = true
    notify()
  }
  const pointerDown = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      e.stopImmediatePropagation()
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.setPointerCapture(e.pointerId)
      if (touches.size > 1) {
        endDrag()
        downNode = undefined
        return
      }
    }
    if (e.button !== 0) return
    downX = e.clientX
    downY = e.clientY
    moved = 0
    downNode = hit(e)
    if (downNode && (e.pointerType !== "touch" || dragMode)) {
      const n = byId.get(downNode)!
      if (!isCollection(n)) {
        e.stopImmediatePropagation()
        startDrag(downNode, e)
      }
    }
  }
  const pointerMove = (e: PointerEvent) => {
    if (downNode) moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY))
    if (e.pointerType === "touch" && touches.has(e.pointerId)) {
      e.stopImmediatePropagation()
      const prev = touches.get(e.pointerId)!
      const all = [...touches.values()]
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY))
      if (touches.size === 2) {
        const next = [...touches.values()]
        const before = Math.hypot(all[0].x - all[1].x, all[0].y - all[1].y),
          after = Math.hypot(next[0].x - next[1].x, next[0].y - next[1].y)
        if (before > 5 && after > 5) dolly(before / after)
        pan((prev.x - e.clientX) * 0.5, (e.clientY - prev.y) * 0.5)
      } else if (dragNode) moveDrag(e)
      else orbit((prev.x - e.clientX) * 0.008, (prev.y - e.clientY) * 0.008)
      return
    }
    if (dragNode) {
      e.stopImmediatePropagation()
      moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY))
      moveDrag(e)
    }
  }
  const pointerUp = (e: PointerEvent) => {
    const wasTouch = touches.delete(e.pointerId)
    if (wasTouch) e.stopImmediatePropagation()
    const selected = downNode,
      wasDrag = !!dragNode
    if (wasDrag) {
      e.stopImmediatePropagation()
      endDrag()
    }
    if (selected && moved < 6 && touches.size === 0) {
      const trigger = labels.get(selected) ?? canvas
      const node = byId.get(selected)!
      if ((e.ctrlKey || e.metaKey) && node.href)
        window.open(urlFor(node.href), "_blank", "noopener")
      else activate(selected, trigger)
    }
    if (touches.size === 0) downNode = undefined
  }
  const pointerCancel = () => {
    touches.clear()
    downNode = undefined
    endDrag()
  }
  for (const [name, listener] of [
    ["pointerdown", pointerDown],
    ["pointermove", pointerMove],
    ["pointerup", pointerUp],
    ["pointercancel", pointerCancel],
  ] as const) {
    canvas.addEventListener(name, listener as EventListener, true)
    cleanup.push(() => canvas.removeEventListener(name, listener as EventListener, true))
  }
  const key = (e: KeyboardEvent) => {
    if (e.key === "Home") {
      e.preventDefault()
      fit()
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault()
      dolly(0.8)
    } else if (e.key === "-") {
      e.preventDefault()
      dolly(1.2)
    } else if (e.key.startsWith("Arrow")) {
      e.preventDefault()
      const dx = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0,
        dy = e.key === "ArrowUp" ? 1 : e.key === "ArrowDown" ? -1 : 0
      if (e.shiftKey) pan(-dx * 35, dy * 35)
      else orbit(dx * 0.15, dy * 0.15)
    }
  }
  canvas.addEventListener("keydown", key)
  cleanup.push(() => canvas.removeEventListener("keydown", key))
  function toggleFullscreen() {
    const savedViewport = state.cameraViewport
    fullscreen = !fullscreen
    host.classList.toggle("is-fullscreen", fullscreen)
    fullButton.textContent = fullscreen ? "关闭全屏地图" : "打开全屏地图"
    fullButton.setAttribute("aria-label", fullButton.textContent)
    if (fullscreen) canvas.focus()
    else fullButton.focus({ preventScroll: true })
    const width = stage.clientWidth,
      height = stage.clientHeight
    if (width > 0 && height > 0) {
      const sameViewport =
        savedViewport &&
        savedViewport.fullscreen === fullscreen &&
        Math.abs(savedViewport.width - width) < 2 &&
        Math.abs(savedViewport.height - height) < 2
      if (sameViewport) {
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        controls?.update()
        invalidate()
        notify()
      } else fit()
    }
  }
  const hostKey = (e: KeyboardEvent) => {
    if (!fullscreen || host.querySelector("dialog[open]")) return
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      toggleFullscreen()
    }
    if (e.key === "Tab") {
      const list = [
        ...host.querySelectorAll<HTMLElement>("button,a[href],select,input,summary,canvas"),
      ].filter((n) => !n.hidden && n.getClientRects().length)
      const first = list[0],
        last = list.at(-1)
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
  }
  host.addEventListener("keydown", hostKey)
  cleanup.push(() => host.removeEventListener("keydown", hostKey))
  const visibility = () => {
    if (document.hidden) {
      simulation.stop()
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      host.dataset.renderLoop = "idle"
    } else invalidate()
  }
  document.addEventListener("visibilitychange", visibility)
  cleanup.push(() => document.removeEventListener("visibilitychange", visibility))
  const hiddenChanges = new MutationObserver(() => {
    if (host.closest("[hidden],[inert]") || !stage.getClientRects().length) {
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      controlsMoving = false
      host.dataset.renderLoop = "idle"
    } else invalidate()
  })
  for (let ancestor: Element | null = host; ancestor; ancestor = ancestor.parentElement)
    hiddenChanges.observe(ancestor, {
      attributes: true,
      attributeFilter: ["hidden", "inert", "class", "style"],
    })
  cleanup.push(() => hiddenChanges.disconnect())

  function openPath(trigger: HTMLElement) {
    const dialog = el("dialog", "kg3d-path"),
      title = el("h2", undefined, "两个对象如何相连"),
      from = el("select"),
      to = el("select"),
      results = el("div", "kg3d-path-results")
    from.setAttribute("aria-label", "起点对象")
    to.setAttribute("aria-label", "终点对象")
    for (const o of index.objects) {
      from.add(new Option(`${graphTypeLabel(o.type)} · ${o.title}`, o.id))
      to.add(new Option(`${graphTypeLabel(o.type)} · ${o.title}`, o.id))
    }
    if (state.focusId) from.value = state.focusId
    if (index.objects.length > 1) to.selectedIndex = 1
    const include = el("input")
    include.type = "checkbox"
    const label = el("label", undefined, "主动纳入相似推荐（探索路径）")
    label.prepend(include)
    const show = button("查找连接", () => {
      results.replaceChildren()
      const path = findKnowledgePath(
        from.value,
        to.value,
        index.objects,
        [...index.relations, ...recommendations],
        include.checked,
      )
      if (!path) {
        results.append(el("p", undefined, "没有找到已登记的连接。可以直接阅读两个对象。"))
        return
      }
      if (!path.length) {
        results.append(el("p", undefined, "起点和终点是同一个对象。"))
        return
      }
      const ol = el("ol")
      for (const step of path) {
        const li = el("li")
        li.append(
          el(
            "p",
            undefined,
            `${objectById.get(step.from)?.title} → ${objectById.get(step.to)?.title}`,
          ),
          el("small", undefined, `${provenance[step.relation.provenance]} · ${step.relation.type}`),
        )
        if (step.relation.evidenceHref && step.relation.provenance !== "similarity") {
          const a = el("a", undefined, "查看关系出处")
          a.href = urlFor(step.relation.evidenceHref)
          li.append(a)
        }
        ol.append(li)
      }
      results.append(
        el(
          "p",
          undefined,
          include.checked
            ? "探索路径：可能包含模型推荐，不表示数学推导。"
            : "以下连接逐项列出原文或目录依据。",
        ),
        ol,
      )
    })
    const close = button("关闭", () => dialog.close())
    dialog.append(title, from, to, label, show, results, close)
    host.append(dialog)
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove()
        trigger.focus({ preventScroll: true })
      },
      { once: true },
    )
    dialog.addEventListener("keydown", (e) => e.stopPropagation())
    dialog.showModal()
    from.focus()
  }
  function setFocus(id?: string) {
    if (id && !byId.has(id)) return
    const same = id === state.focusId
    state.focusId = id
    if (id) {
      const n = byId.get(id)!
      state.scopeId = isCollection(n) ? n.id : n.parentId
    }
    rebuild(!same)
  }
  rebuild(true)
  return {
    setFocus,
    getState,
    restoreState(saved: unknown) {
      const migrated = migrateSceneState(saved, model)
      state = { ...state, ...migrated, positions: { ...state.positions, ...migrated.positions } }
      rebuild(!migrated.camera, false, false)
      if (migrated.camera && controls) {
        camera.position.fromArray(migrated.camera.position)
        camera.up.fromArray(migrated.camera.up)
        controls.target.fromArray(migrated.camera.target)
        controls.update()
        invalidate()
        notify()
      }
    },
    setRecommendations(edges: GraphRelation[]) {
      recommendations = edges.filter((e) => e.provenance === "similarity")
      rebuild(false)
    },
    destroy() {
      destroyed = true
      if (frame) cancelAnimationFrame(frame)
      simulation.stop()
      resize.disconnect()
      for (const fn of cleanup) fn()
      host.querySelectorAll("dialog").forEach((d) => d.close())
      controls?.dispose()
      clearScene()
      renderer?.dispose()
      for (const g of Object.values(geometries)) g.dispose()
      delete (host as HTMLElement & { knowledgeMapState?: unknown }).knowledgeMapState
      host.replaceChildren()
      host.classList.remove("knowledge-map-3d", "is-fullscreen")
    },
  }
}
