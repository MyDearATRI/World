# Local semantic retrieval

The site has no inference server, API token, subscription integration or access to a reader's files. Ordinary reading, full-text search and precomputed recommendations do not download a model. Selecting the explicit local semantic-search action downloads public model resources and runs query inference in a dedicated browser Worker. Query text stays in that Worker.

## Fixed resources

- Library: `@huggingface/transformers` **3.8.1**, pinned in the npm lockfile.
- Model: `Xenova/multilingual-e5-small`, immutable revision `761b726dd34fb83930e26aab4e9ac3899aa1fa78`, q8 ONNX, 384 dimensions, 512-token capacity.
- `model-manifest.json` records the actual byte count and SHA256 of each of the five downloaded files. Their combined uncompressed size is 135,392,183 bytes. Browser runtime resources are separately hosted by this website, approximately 22.5 MB, and loaded on demand.
- Model source: <https://huggingface.co/Xenova/multilingual-e5-small/tree/761b726dd34fb83930e26aab4e9ac3899aa1fa78>. Input prefixes, normalization and limits follow <https://huggingface.co/intfloat/multilingual-e5-small>.
- ONNX browser runtime is the exact transitive version locked by Transformers.js. Its distributed package identifies commit `89f8206ba4f1c22c39e0297fb55272e8ce8cd7d0`; the upstream MIT license is retained in `ONNX-LICENSE.txt` and copied alongside the generated runtime. Transformers.js's Apache license is copied from the installed package.

## Preparing a publication

`node scripts/prepare-semantics.mjs` reads only the website-owned `knowledge/index.json`, downloads missing fixed public model files to ignored `.quartz-cache/semantic-model/`, verifies every file hash, and computes embeddings on the local CPU. No Vault scan is performed. On machines using a system proxy, invoke Node with `--use-env-proxy` and the existing proxy environment; the script does not configure a proxy or credentials.

Every passage uses the `passage: ` prefix. Actual tokenizer counts split complete paragraphs into chunks bounded by 512 tokens, splitting oversized paragraphs at checked text boundaries while preserving their final text. Each chunk is mean-pooled and normalized; an object's chunk vectors are averaged and normalized. Content-hash caching reuses unchanged vectors. The generated `semantic.json` includes public vectors and up to five cosine-similarity recommendations per object, excluding the object itself and exact duplicate text. A recommendation is a similarity result, never an asserted theorem dependency or proof.

`node scripts/prepare-semantics.mjs --check` checks exact object IDs, content hashes, vector dimensions and normalization, model identity and recommendation destinations without loading or downloading a model. CI uses this mode. `--smoke` runs actual local inference on a short bilingual metric-space example. Model weights, runtime output, checkpoint caches and diagnostics stay outside Git; the fixed manifest and prepared public index are versioned.

## Browser protocol

The generated module Worker is `static/semantic/worker.js`. Its typed request and response contract is in `quartz/util/semantic.ts`:

- `init`: `{ type: "init", baseUrl }` starts verified downloads and the single-threaded WASM runtime. It reports `progress` by phase/file/loaded/total, then `ready` with the cache-use flag.
- `query`: `{ type: "query", text, requestId }` returns `result` with the same request ID and up to 12 object IDs and similarity scores. Queries are token-bounded with the `query: ` prefix. Errors return an `error` message so the interface can keep ordinary search available.
- Cancel by terminating the Worker. This aborts its pending network and inference work. Cached, already verified files can be reused after another explicit enable action.
- `clear`: `{ type: "clear", baseUrl, requestId }` disposes an initialized model and deletes only this mount's `world-semantic-v1:<origin><mount>` Cache API entry. To clear during an active download, first terminate the Worker, then delete the exact name returned by `semanticCacheName(baseUrl)`. No other application's caches are enumerated or removed.

The Worker requests only the five immutable public-model URLs, with credentials omitted and no query in a URL, header or request body. It verifies both downloaded and cached bytes before inference. The library cannot fetch additional remote models. If storage is restricted, verified model bytes can be used for that session without persistence. No cross-origin isolation or multithread support is required.

## Verification boundaries

`node scripts/verify-semantics.mjs` runs Edge with the real WASM model, checks explicit opt-in, progress, bilingual results, reuse, cancellation, failure recovery, cache isolation and network scope. To avoid re-downloading 135 MB for each test run, model HTTP responses are replayed from the exact locally downloaded and verified files. The report explicitly distinguishes that simulated transport from real inference. The test does not represent a physical phone or a live internet download by a reader.
