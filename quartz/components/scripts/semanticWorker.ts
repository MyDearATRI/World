import {
  averageVectors,
  semanticCacheName,
  semanticChunks,
  semanticMatches,
  validateSemanticModel,
  type SemanticIndex,
  type SemanticModelManifest,
  type SemanticRequest,
  type SemanticResponse,
} from "../../util/semantic"

// No runtime import or fetch occurs until the explicit init message.
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<SemanticRequest>) => void) | null
  postMessage: (message: SemanticResponse) => void
}
type Extractor = {
  (
    text: string,
    options: { pooling: string; normalize: boolean },
  ): Promise<{ data: Iterable<number> }>
  tokenizer: { encode: (text: string) => number[] }
  dispose: () => Promise<void>
}
let extractor: Extractor | undefined
let index: SemanticIndex | undefined
let initializing: Promise<void> | undefined
let activeBase: string | undefined

function siteBase(value: string): URL {
  const base = new URL(value, self.location.href)
  if (base.origin !== self.location.origin || !self.location.pathname.startsWith(base.pathname))
    throw new Error("模型只能用于当前网站")
  if (!base.pathname.endsWith("/")) base.pathname += "/"
  return base
}

async function checksum(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

async function initialize(baseValue: string): Promise<void> {
  const base = siteBase(baseValue)
  activeBase = base.href
  const runtime = new URL("static/semantic/", base)
  const manifestResponse = await fetch(new URL("model-manifest.json", runtime), {
    credentials: "omit",
  })
  if (!manifestResponse.ok) throw new Error("模型信息加载失败；普通搜索仍可使用")
  const manifest: SemanticModelManifest = await manifestResponse.json()
  validateSemanticModel(manifest)
  const response = await fetch(new URL("static/semantic.json", base), { credentials: "omit" })
  if (!response.ok) throw new Error("语义索引尚未准备好；普通搜索仍可使用")
  index = await response.json()
  if (index?.model.revision !== manifest.revision || index.model.dtype !== manifest.dtype)
    throw new Error("模型与公开索引版本不一致")

  const modelBase = `https://huggingface.co/${manifest.id}/resolve/${manifest.revision}/`
  const files = new Map<string, Response>()
  let cache: Cache | undefined
  try {
    cache = await caches.open(semanticCacheName(base.href))
  } catch {
    // Private browsing or storage restrictions still allow an in-memory session.
  }
  let allCached = true
  for (const file of manifest.files) {
    if (
      !/^(?:onnx\/model_quantized\.onnx|config\.json|tokenizer\.json|tokenizer_config\.json|special_tokens_map\.json)$/.test(
        file.path,
      )
    )
      throw new Error("模型文件不在固定清单中")
    const url = new URL(file.path, modelBase).href
    let bytes: ArrayBuffer | undefined
    const saved = await cache?.match(url)
    if (saved) {
      const candidate = await saved.arrayBuffer()
      if (candidate.byteLength === file.bytes && (await checksum(candidate)) === file.sha256)
        bytes = candidate
      else await cache?.delete(url)
    }
    if (!bytes) {
      allCached = false
      const download = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer" })
      if (!download.ok || !download.body) throw new Error(`模型下载失败：${file.path}`)
      const reader = download.body.getReader()
      const chunks: Uint8Array[] = []
      let loaded = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        loaded += value.length
        if (loaded > file.bytes) throw new Error("模型下载长度超出固定清单")
        chunks.push(value)
        worker.postMessage({
          type: "progress",
          phase: "download",
          file: file.path,
          loaded,
          total: file.bytes,
        })
      }
      const merged = new Uint8Array(loaded)
      let offset = 0
      for (const chunk of chunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }
      bytes = merged.buffer
      worker.postMessage({
        type: "progress",
        phase: "verify",
        file: file.path,
        loaded,
        total: file.bytes,
      })
      if (loaded !== file.bytes || (await checksum(bytes)) !== file.sha256)
        throw new Error(`模型校验失败：${file.path}`)
      try {
        await cache?.put(url, new Response(bytes))
      } catch {
        // A full cache must not prevent local inference with verified bytes.
      }
    }
    files.set(url, new Response(bytes))
  }
  worker.postMessage({ type: "progress", phase: "load", file: "量化模型", loaded: 0, total: 1 })
  const libraryUrl = new URL("transformers.js", runtime).href
  const { env, pipeline } = await import(libraryUrl)
  env.allowLocalModels = true
  env.allowRemoteModels = false
  env.useBrowserCache = false
  env.useFSCache = false
  env.useFS = false
  env.localModelPath = new URL("disabled-model-path/", runtime).href
  env.useCustomCache = true
  env.customCache = {
    match: async (key: string) => files.get(key)?.clone(),
    put: async () => {},
  }
  env.backends.onnx.wasm.wasmPaths = runtime.href
  env.backends.onnx.wasm.numThreads = 1
  env.backends.onnx.wasm.proxy = false
  extractor = await pipeline("feature-extraction", manifest.id, {
    revision: manifest.revision,
    dtype: manifest.dtype,
    device: "wasm",
    local_files_only: true,
  })
  files.clear()
  worker.postMessage({ type: "ready", cached: allCached })
}

worker.onmessage = (event) => {
  const message = event.data
  void (async () => {
    if (message.type === "clear") {
      if (initializing) await initializing.catch(() => {})
      await extractor?.dispose()
      extractor = undefined
      index = undefined
      initializing = undefined
      const base = siteBase(message.baseUrl || activeBase || self.location.href)
      await caches.delete(semanticCacheName(base.href))
      worker.postMessage({ type: "cleared", requestId: message.requestId })
    } else if (message.type === "init") {
      initializing ??= initialize(message.baseUrl).catch((error) => {
        initializing = undefined
        throw error
      })
      await initializing
    } else if (message.type === "query") {
      if (!extractor || !index) throw new Error("请先启用本机语义搜索")
      const text = message.text.trim()
      if (!text || text.length > 8000) throw new Error("请输入 1–8000 字的查询")
      const chunks = semanticChunks(
        text,
        (value) => extractor!.tokenizer.encode(value).length,
        "query: ",
      )
      const vectors: number[][] = []
      for (const chunk of chunks) {
        const output = await extractor(chunk, { pooling: "mean", normalize: true })
        vectors.push(Array.from(output.data))
      }
      worker.postMessage({
        type: "result",
        requestId: message.requestId,
        matches: semanticMatches(averageVectors(vectors), index.objects, 12),
      })
    }
  })().catch((error: unknown) => {
    worker.postMessage({
      type: "error",
      requestId: message.requestId,
      message: error instanceof Error ? error.message : "本机语义搜索暂不可用，普通搜索仍可使用",
    })
  })
}
