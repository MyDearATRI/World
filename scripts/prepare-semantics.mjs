import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  averageVectors,
  semanticChunks,
  semanticMatches,
  validateSemanticModel,
} from "../quartz/util/semantic.ts"

const root = fileURLToPath(new URL("../", import.meta.url))
const hash = (value) => createHash("sha256").update(value).digest("hex")
const modelManifest = JSON.parse(
  await readFile(path.join(root, "knowledge/model-manifest.json"), "utf8"),
)
const modelRoot = path.join(root, ".quartz-cache/semantic-model")
validateSemanticModel(modelManifest)
const modelSignature = hash(JSON.stringify(modelManifest))
const modelId = modelManifest.id
const snapshotPath = path.join(root, "knowledge/index.json")
const cachePath = path.join(root, ".quartz-cache/semantic-embeddings.json")
const outputPath = path.join(root, "knowledge/semantic.json")
const objectText = (object) =>
  [object.title, ...(object.aliases ?? []), object.text, ...(object.latex ?? [])]
    .filter(Boolean)
    .join("\n\n")

async function plainDirectory(directory) {
  const relative = path.relative(root, directory)
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("Output escapes website")
  let current = root
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Refusing linked directory: ${current}`)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      await mkdir(current)
    }
  }
}

async function modelFiles() {
  for (const file of modelManifest.files) {
    const target = path.join(modelRoot, modelId, file.path)
    await plainDirectory(path.dirname(target))
    let bytes
    try {
      if ((await lstat(target)).isSymbolicLink()) throw new Error("Refusing linked model file")
      bytes = await readFile(target)
    } catch (error) {
      if (error.code !== "ENOENT") throw error
      console.log(`Downloading public model resource: ${file.path} (${file.bytes} bytes)`)
      const response = await fetch(
        `https://huggingface.co/${modelId}/resolve/${modelManifest.revision}/${file.path}`,
        {
          credentials: "omit",
          signal: AbortSignal.timeout(30 * 60 * 1000),
        },
      )
      if (!response.ok) throw new Error(`Model download HTTP ${response.status}`)
      bytes = Buffer.from(await response.arrayBuffer())
      if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
        throw new Error(`Model hash mismatch: ${file.path}`)
      await writeFile(target, bytes)
    }
    if (bytes.length !== file.bytes || hash(bytes) !== file.sha256)
      throw new Error(`Cached model hash mismatch: ${file.path}`)
  }
}

async function extractor() {
  await modelFiles()
  const { env, pipeline } = await import("@huggingface/transformers")
  env.allowRemoteModels = false
  env.allowLocalModels = true
  env.useFSCache = false
  env.localModelPath = modelRoot + path.sep
  return pipeline("feature-extraction", modelId, {
    revision: modelManifest.revision,
    dtype: modelManifest.dtype,
    device: "cpu",
    local_files_only: true,
    session_options: { intraOpNumThreads: 2, interOpNumThreads: 1 },
  })
}

if (process.argv.includes("--check")) {
  const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"))
  const prepared = JSON.parse(await readFile(outputPath, "utf8"))
  if (prepared.version !== 1 || snapshot.snapshotHash !== prepared.snapshotHash)
    throw new Error("Semantic snapshot is stale; run prepare:semantics locally")
  if (hash(JSON.stringify(prepared.model)) !== modelSignature)
    throw new Error("Semantic model manifest differs")
  const expected = new Map(snapshot.objects.map((object) => [object.id, hash(objectText(object))]))
  if (expected.size !== snapshot.objects.length || prepared.objects.length !== expected.size)
    throw new Error("Semantic object coverage differs from the knowledge index")
  const seen = new Set()
  for (const object of prepared.objects) {
    if (seen.has(object.id) || expected.get(object.id) !== object.contentHash)
      throw new Error(`Semantic content is stale or duplicated: ${object.id}`)
    seen.add(object.id)
    if (object.vector.length !== modelManifest.dimensions || !object.vector.every(Number.isFinite))
      throw new Error(`Invalid prepared vector: ${object.id}`)
    const norm = Math.sqrt(object.vector.reduce((sum, value) => sum + value * value, 0))
    if (Math.abs(norm - 1) > 0.0001) throw new Error(`Unnormalized prepared vector: ${object.id}`)
    const matches = prepared.recommendations[object.id]
    if (
      !Array.isArray(matches) ||
      matches.length > 5 ||
      new Set(matches.map((item) => item.id)).size !== matches.length
    )
      throw new Error(`Invalid recommendations: ${object.id}`)
    for (const match of matches)
      if (!expected.has(match.id) || match.id === object.id || !Number.isFinite(match.score))
        throw new Error(`Recommendation target is outside the public index: ${object.id}`)
  }
  if (Object.keys(prepared.recommendations).length !== expected.size)
    throw new Error("Recommendation coverage differs")
  console.log(
    `Verified ${expected.size} semantic objects, content hashes, normalized vectors, fixed model and recommendation targets without loading a model or reading the Vault.`,
  )
} else if (process.argv.includes("--smoke")) {
  const model = await extractor()
  const examples = [
    "query: 度量空间中的距离",
    "passage: A metric measures distance in a metric space.",
    "passage: Fourier coefficients describe a periodic function.",
  ]
  const vectors = []
  for (const text of examples) {
    const tensor = await model(text, { pooling: "mean", normalize: true })
    vectors.push(Array.from(tensor.data))
  }
  if (vectors.some((vector) => vector.length !== modelManifest.dimensions))
    throw new Error("Wrong embedding dimensions")
  const matches = semanticMatches(vectors[0], [
    { id: "metric", vector: vectors[1] },
    { id: "fourier", vector: vectors[2] },
  ])
  if (matches[0].id !== "metric")
    throw new Error("Actual bilingual inference did not rank the metric passage first")
  console.log(
    JSON.stringify(
      {
        mode: "actual-local-cpu-inference",
        revision: modelManifest.revision,
        dimensions: vectors[0].length,
        matches,
      },
      null,
      2,
    ),
  )
  await model.dispose()
} else {
  const snapshotBytes = await readFile(snapshotPath)
  const snapshot = JSON.parse(snapshotBytes)
  if (snapshot.version !== 1 || !snapshot.snapshotHash || !Array.isArray(snapshot.objects))
    throw new Error("Build the published knowledge index before preparing embeddings")
  let cached = { modelSignature, objects: {} }
  try {
    const value = JSON.parse(await readFile(cachePath, "utf8"))
    if (value.modelSignature === modelSignature) cached = value
  } catch (error) {
    if (error.code !== "ENOENT") throw error
  }
  let model
  let reused = 0
  let computed = 0
  let chunkCount = 0
  const objects = []
  const nextCache = { modelSignature, objects: {} }
  const exactTextIds = new Map()
  for (const object of snapshot.objects) {
    const text = objectText(object)
    const contentHash = hash(text)
    const existing = cached.objects[contentHash]
    let vector = existing?.vector
    if (vector?.length === modelManifest.dimensions && vector.every(Number.isFinite)) reused++
    else {
      model ??= await extractor()
      const chunks = semanticChunks(
        text,
        (value) => model.tokenizer.encode(value).length,
        "passage: ",
        modelManifest.maxTokens,
      )
      const vectors = []
      for (const chunk of chunks) {
        const embedding = await model(chunk, { pooling: "mean", normalize: true })
        vectors.push(Array.from(embedding.data))
      }
      vector = averageVectors(vectors).map((value) => Number(value.toFixed(7)))
      chunkCount += chunks.length
      computed++
      cached.objects[contentHash] = { vector }
    }
    nextCache.objects[contentHash] = { vector }
    objects.push({ id: object.id, contentHash, vector })
    const normalized = hash((object.text ?? "").replace(/\s+/g, " ").trim())
    exactTextIds.set(object.id, normalized)
    if (objects.length % 10 === 0) {
      await plainDirectory(path.dirname(cachePath))
      await writeFile(cachePath, JSON.stringify(cached))
      console.log(
        `Embeddings ${objects.length}/${snapshot.objects.length}: ${computed} computed, ${reused} reused`,
      )
    }
  }
  await model?.dispose()
  if (hash(await readFile(snapshotPath)) !== hash(snapshotBytes))
    throw new Error("Public index changed during preparation; refusing stale vectors")
  const recommendations = {}
  for (const object of objects) {
    const exclude = new Set(
      objects
        .filter(
          (other) =>
            other.id === object.id || exactTextIds.get(other.id) === exactTextIds.get(object.id),
        )
        .map((other) => other.id),
    )
    recommendations[object.id] = semanticMatches(object.vector, objects, 5, exclude).map(
      (match) => ({ ...match, score: Number(match.score.toFixed(5)) }),
    )
  }
  await plainDirectory(path.dirname(outputPath))
  await writeFile(cachePath, JSON.stringify(nextCache))
  const output = {
    version: 1,
    snapshotHash: snapshot.snapshotHash,
    model: modelManifest,
    objects,
    recommendations,
  }
  await writeFile(outputPath + ".tmp", JSON.stringify(output) + "\n")
  await rename(outputPath + ".tmp", outputPath)
  console.log(
    `Prepared ${objects.length} published embeddings (${computed} computed, ${reused} reused, ${chunkCount} model chunks); each object has up to 5 explicitly labelled similarity recommendations.`,
  )
}
