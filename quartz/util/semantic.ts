export interface SemanticModelFile {
  path: string
  bytes: number
  sha256: string
}

export interface SemanticModelManifest {
  version: 1
  library: string
  libraryVersion: string
  id: string
  revision: string
  dtype: "q8"
  dimensions: number
  maxTokens: number
  source: string
  downloadBytes: number
  files: SemanticModelFile[]
}

export interface SemanticMatch {
  id: string
  score: number
}

export interface SemanticIndex {
  version: 1
  snapshotHash: string
  model: SemanticModelManifest
  objects: { id: string; contentHash: string; vector: number[] }[]
  recommendations: Record<string, SemanticMatch[]>
}

export type SemanticRequest =
  | { type: "init"; baseUrl: string; requestId?: string }
  | { type: "query"; text: string; requestId: string }
  | { type: "clear"; baseUrl: string; requestId?: string }

export function validateSemanticModel(model: SemanticModelManifest): void {
  const allowed = new Set([
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "onnx/model_quantized.onnx",
  ])
  if (
    model.id !== "Xenova/multilingual-e5-small" ||
    model.revision !== "761b726dd34fb83930e26aab4e9ac3899aa1fa78" ||
    model.libraryVersion !== "3.8.1" ||
    model.dtype !== "q8" ||
    model.dimensions !== 384 ||
    model.maxTokens !== 512 ||
    model.files.length !== allowed.size
  )
    throw new Error("Unsupported semantic model manifest")
  for (const file of model.files) {
    if (
      !allowed.delete(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes <= 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw new Error("Model file is outside the immutable allowlist")
  }
  if (model.downloadBytes !== model.files.reduce((sum, file) => sum + file.bytes, 0))
    throw new Error("Model download size mismatch")
}

export type SemanticResponse =
  | {
      type: "progress"
      phase: "download" | "verify" | "load"
      file: string
      loaded: number
      total: number
    }
  | { type: "ready"; cached: boolean }
  | { type: "result"; requestId: string; matches: SemanticMatch[] }
  | { type: "cleared"; requestId?: string }
  | { type: "error"; message: string; requestId?: string }

/** Keep complete paragraphs where possible, then split at a token-checked boundary. */
export function semanticChunks(
  text: string,
  countTokens: (text: string) => number,
  prefix = "passage: ",
  maxTokens = 512,
): string[] {
  if (countTokens(prefix) >= maxTokens) throw new Error("Token prefix exceeds model capacity")
  const pieces = text.split(/(?<=\n\n)/u).filter((part) => part.trim())
  const chunks: string[] = []
  let current = ""
  for (const piece of pieces) {
    if (countTokens(prefix + current + piece) <= maxTokens) {
      current += piece
      continue
    }
    if (current.trim()) chunks.push(prefix + current)
    current = ""
    let rest = piece
    while (countTokens(prefix + rest) > maxTokens) {
      const points = Array.from(rest)
      let low = 1
      let high = points.length
      while (low < high) {
        const middle = Math.ceil((low + high) / 2)
        if (countTokens(prefix + points.slice(0, middle).join("")) <= maxTokens) low = middle
        else high = middle - 1
      }
      let end = low
      const candidate = points.slice(0, low).join("")
      const boundary = [...candidate.matchAll(/[\s。；;.!?]\s*/gu)].at(-1)
      if (boundary && boundary.index > candidate.length / 2)
        end = Array.from(candidate.slice(0, boundary.index + boundary[0].length)).length
      const part = points.slice(0, end).join("")
      if (!part || countTokens(prefix + part) > maxTokens)
        throw new Error("A character exceeds the model token capacity")
      chunks.push(prefix + part)
      rest = points.slice(end).join("")
    }
    current = rest
  }
  if (current.trim()) chunks.push(prefix + current)
  return chunks.length ? chunks : [prefix + text.trim()]
}

export function normalizeVector(vector: readonly number[]): number[] {
  const length = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(length) || length === 0) throw new Error("Invalid model embedding")
  return vector.map((value) => value / length)
}

export function averageVectors(vectors: readonly (readonly number[])[]): number[] {
  if (!vectors.length) throw new Error("No chunk embeddings")
  const sum = new Array<number>(vectors[0].length).fill(0)
  for (const vector of vectors) {
    if (vector.length !== sum.length) throw new Error("Embedding dimensions differ")
    vector.forEach((value, index) => (sum[index] += value))
  }
  return normalizeVector(sum)
}

export function semanticMatches(
  vector: readonly number[],
  objects: readonly { id: string; vector: readonly number[] }[],
  limit = 5,
  exclude: ReadonlySet<string> = new Set(),
): SemanticMatch[] {
  return objects
    .filter((object) => !exclude.has(object.id))
    .map((object) => {
      if (object.vector.length !== vector.length) throw new Error("Embedding dimensions differ")
      return {
        id: object.id,
        score: object.vector.reduce((sum, value, index) => sum + value * vector[index], 0),
      }
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
}

export function semanticCacheName(baseUrl: string): string {
  const base = new URL(baseUrl)
  return `world-semantic-v1:${base.origin}${base.pathname}`
}
