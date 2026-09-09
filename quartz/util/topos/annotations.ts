export interface AnnotationItem {
  id: string
  anchorX: number
  anchorY: number
  width: number
  height: number
  priority: number
}
export interface AnnotationBounds {
  left: number
  top: number
  right: number
  bottom: number
}
export interface AnnotationBox {
  x: number
  y: number
  width: number
  height: number
}
export interface AnnotationPlacement extends AnnotationBox {
  id: string
}
type Candidate = AnnotationBox & { bias: number }
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n))
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

function overlap(a: AnnotationBox, b: AnnotationBox, gap = 0) {
  return (
    Math.max(0, Math.min(a.x + a.width, b.x + b.width + gap) - Math.max(a.x, b.x - gap)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height + gap) - Math.max(a.y, b.y - gap))
  )
}
function anchorDistance(box: AnnotationBox, item: AnnotationItem) {
  return Math.hypot(
    item.anchorX - clamp(item.anchorX, box.x, box.x + box.width),
    item.anchorY - clamp(item.anchorY, box.y, box.y + box.height),
  )
}

/**
 * Pure screen-space annotations. Coordinates are top-left CSS pixels.
 * All items are mandatory. A finite local search minimizes weighted overlap,
 * then leader length; this is not a claim of globally optimal rectangle packing.
 * Oversized measurements are clipped to bounds; the DOM must apply these dimensions.
 */
export function computeAnnotations(
  items: readonly AnnotationItem[],
  bounds: AnnotationBounds,
  exclusions: readonly AnnotationBox[] = [],
): AnnotationPlacement[] {
  const { left, top, right, bottom } = bounds
  if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top)
    throw new Error("Annotation bounds must enclose a finite positive area")
  const ids = new Set<string>()
  const normalized = items.map((item) => {
    if (ids.has(item.id)) throw new Error(`Duplicate annotation: ${item.id}`)
    ids.add(item.id)
    if (
      ![item.anchorX, item.anchorY, item.width, item.height, item.priority].every(Number.isFinite)
    )
      throw new Error(`Invalid annotation measurement: ${item.id}`)
    return {
      ...item,
      width: clamp(item.width, 1, right - left),
      height: clamp(item.height, 1, bottom - top),
    }
  })
  const obstacles = exclusions.filter(
    (box) =>
      [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
      box.width > 0 &&
      box.height > 0,
  )
  const ordered = [...normalized].sort(
    (a, b) =>
      b.priority - a.priority ||
      a.anchorY - b.anchorY ||
      a.anchorX - b.anchorX ||
      compare(a.id, b.id),
  )
  const priority = new Map(
    ordered.map((item) => [item.id, 1 + Math.log1p(Math.max(0, item.priority))]),
  )
  const placed = new Map<string, AnnotationPlacement>()
  const gap = 7

  function choose(item: AnnotationItem): AnnotationPlacement {
    const { width, height, anchorX: ax, anchorY: ay } = item
    const candidates: Candidate[] = []
    const seen = new Set<string>()
    function add(x: number, y: number, bias: number) {
      x = clamp(x, left, right - width)
      y = clamp(y, top, bottom - height)
      const key = `${x.toFixed(2)}:${y.toFixed(2)}`
      if (seen.has(key)) return
      seen.add(key)
      candidates.push({ x, y, width, height, bias })
    }
    // Prefer upper-right, then other sides of the same anchor before seeking distance.
    const bases = [
      [ax + 14, ay - height - 14],
      [ax - width - 14, ay - height - 14],
      [ax + 14, ay + 14],
      [ax - width - 14, ay + 14],
      [ax + 14, ay - height / 2],
      [ax - width - 14, ay - height / 2],
      [ax - width / 2, ay - height - 14],
      [ax - width / 2, ay + 14],
    ]
    bases.forEach(([x, y], i) => add(x, y, i * 300))
    const diagonal = Math.hypot(right - left, bottom - top)
    for (const radius of [24, 48, 80, 124, 180, 252, 340, 450, 590]) {
      if (radius > diagonal) break
      for (let direction = 0; direction < 8; direction++) {
        const angle = (direction * Math.PI) / 4
        const dx = Math.cos(angle) * radius,
          dy = Math.sin(angle) * radius
        add(ax + dx - width / 2, ay + dy - height / 2, 850 + radius * 0.8)
      }
    }
    // Blocker edges expose narrow valid slots which a coarse spiral could miss.
    const blockers = [...obstacles, ...[...placed.values()].filter((p) => p.id !== item.id)]
    const xs = [left, right - width, ax + 14, ax - width - 14]
    const ys = [top, bottom - height, ay - height - 14, ay + 14]
    for (const box of blockers) {
      xs.push(box.x - width - gap, box.x + box.width + gap)
      ys.push(box.y - height - gap, box.y + box.height + gap)
    }
    for (const x of xs) for (const y of ys) add(x, y, 1100)

    let best: Candidate | undefined,
      bestCollision = Infinity,
      bestDistance = Infinity
    for (const candidate of candidates) {
      let collision = 0
      for (const box of obstacles) collision += overlap(candidate, box, gap) * 12
      for (const [id, box] of placed) {
        if (id === item.id) continue
        collision += overlap(candidate, box, gap) * (priority.get(id) ?? 1)
      }
      // Keep the concept marks themselves perceivable, including the current anchor.
      for (const anchor of normalized) {
        collision +=
          overlap(candidate, {
            x: anchor.anchorX - 8,
            y: anchor.anchorY - 8,
            width: 16,
            height: 16,
          }) * 0.7
      }
      const length = anchorDistance(candidate, item)
      const distance = length * length + candidate.bias
      if (
        collision < bestCollision - 0.01 ||
        (Math.abs(collision - bestCollision) <= 0.01 && distance < bestDistance)
      ) {
        best = candidate
        bestCollision = collision
        bestDistance = distance
      }
    }
    return { id: item.id, x: best!.x, y: best!.y, width, height }
  }

  for (const item of ordered) placed.set(item.id, choose(item))
  // Earlier mandatory labels can create poor greedy gaps. Repair lower priorities
  // around the retained high-priority anchors, without rebuilding or dropping IDs.
  for (let pass = 0; pass < 1; pass++) {
    for (let i = ordered.length - 1; i >= 1; i--) placed.set(ordered[i].id, choose(ordered[i]))
  }
  return normalized.map((item) => placed.get(item.id)!)
}
