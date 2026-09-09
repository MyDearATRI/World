# Phase 1 frozen mathematical cartography benchmark

The benchmark date is 2026-09-10. Its scope is the official MSC2020 two-digit list, the arXiv Mathematics category list, 24 explicitly evidenced current research directions, and the registry built from those inputs. It is not a claim to enumerate all mathematics or all lower-level MSC entries.

`msc2020-level1.json` preserves all 63 entries from the official AMS form. `arxiv-math.json` preserves all 32 `math.*` headings from the official taxonomy. Both list the exact response hash, retrieval date, URL and source position. Official totals are counted from the complete acquired official lists; they are not presented as a separate publisher-stated statistic. The first attempted zbMATH PDF returned HTTP403; the official AMS HTML succeeded. Raw HTML was read in the ignored `artifacts/ontology-research/` directory; only the factual classification extraction is distributed.

The two `research-regions-*.json` packs are source-reviewed research metadata. Region01–06's extra raw-HTTP checks appear in `retrieval-regions-01-06.json`: 23 HTTP200 responses and one403 on a later IAS follow-up. That IAS abstract had already been successfully read with the web tool, so the failed follow-up is retained without inventing a successful HTTP response. Region07–12's agent-produced source audit and reproducible127 checks are in `regions-07-12-verification.json`.

The sampling protocol and seed were recorded before generation in `schema-contract.json`. `sample-selection.json` freezes the actual17 selected IDs from70 nonfrontier substantive nodes, stratified by primary region and hierarchy depth; each nonempty stratum takes the ceiling of10%. All24 frontiers have additional review records. Region headings and the two planning volumes do not inflate the mathematical denominator. `review-records.json` records AI topic/source review only; no human reviewer or proof-checking result is implied.

`assemble.mjs` deterministically prepares the registry, headings and an unreviewed audit from the two research packs and classification snapshots. `record-audit.mjs` reproduces the actual completed review only for its explicitly frozen registry and source hashes; changed inputs stop instead of obtaining an automatic PASS. The public validator is independent of both preparation scripts.

Run from the website directory:

```powershell
node scripts/validate-ontology.mjs
node --test scripts/ontology.test.mjs
```

The source snapshots do not contain copyrighted report or article full text. Titles, short source descriptions, bibliographic metadata, response hashes and AI paraphrases are kept for audit. Event dates and publication dates are distinct; month precision stays month precision. A research lecture/course can evidence current activity and topic scope; it does not independently verify every result discussed there.

All parent edges are editorial navigation placements, not mathematical dependencies or proofs of subfield inclusion. MSC00,01 and97 have explicit `editorial-context` notes because the twelve required macroregions lack a separate history/education/overview container. Cross-placements retain one canonical ID and now carry a target-specific rationale.

The original Master Prompt was recovered during this run. Formal Phase1 exit is subject to the current Phase0 contract acceptance. Data-specific checks can pass independently; that does not authorize later phases or imply their numerical goals were run.
