# Website acceptance

## Knowledge Topos prototype acceptance

The current Group → Action → Representation prototype must satisfy the independent T01–T13 matrix in `topos-acceptance.md`. It requires persistent scene identity and real context-dependent node motion, semantic levels 0–3, source Markdown with MathML, recursive local unfolding, typed relations, graph-computed communities and both labelled and label-free screen recordings. Screenshots or older map test results alone are insufficient. Scope is this vertical prototype, not full textbook migration. Record failures, fixes, actual video/frame observations and untested limitations separately.

## Three-dimensional map acceptance

Validate the real book/chapter/section tree, multi-section identity, empty 3.7 section, unmapped objects, finite attractive/repulsive physics and explicit relation provenance. Test scene persistence after filtering, drag versus click, native links, camera controls, back/forward/refresh, keyboard focus, mobile grouped lists, simulated touch, reduced motion and WebGL initialization/context-loss fallback. Check at 1440×1000, 1024×900 and 390×844 and inspect actual screenshots. Preserve ordinary search, Markdown, source state, MathML and local formula scrolling.

Run type/format/unit/build/content checks and compare preparation under Chinese and English host sort rules. Validate one-click website synchronization with isolated Git repositories, including preview drift, unrelated staging, divergence, rejected pushes and same-commit retries. After the authorized ordinary push, wait for the exact SHA's Pages success and verify hosted /World/ routes and graph resources. Record results separately; this section states acceptance requirements only.

## Current atomic knowledge-space acceptance

This section supersedes earlier bookshelf-only expectations. Test the book route and the object route against the same approved export: home → Simon → §1.2, and explore/search → a metric definition or continuity object. Definitions, mathematical examples, observations, and questions retain their distinct meanings; plans and demonstrations stay outside the default mathematical index.

- Registry verification must retain an existing identity after insertion, reordering, a body edit, and a uniquely resolvable title rename; reject duplicate/ambiguous locators. Test a reviewed ordinary-paragraph range and ensure code demonstrations do not produce atoms. Repeated appearances consolidate without deleting the original source anchors. Check all four compatibility atom URLs and their canonical targets.
- `test:knowledge` must compare prepared and emitted indices, verify actual static pages for every object, inspect math/source links and duplicate IDs, and check every local link and anchor on canonical atom pages, compatibility pages, and the exploration page under `/World/`. The metric-space setting must precede the continuity statement. An atom whose source was removed from the approved snapshot cannot silently remain published.
- Build and content tests must remain bounded by the manifest even when unrelated files are present in `content/`. Unmanaged input must stay untouched, unparsed and absent from output/search/maps/vectors. The public HTML allowlist is the approved source pages plus registered atoms, explicit compatibility pages and exploration; model weights and private cache files are not allowed output.
- Read an atom, enter its full source note, open another object, and use close/back/forward/refresh/copy-address/new-tab actions. Restore reading position and focus. Confirm full mathematical notation, citations, source notes and strategy qualifications; preserving a proof label is not proof certification.
- Explore chapter groups and named objects with pointer and keyboard, drag without opening, and test semantic zoom, stable map placement, typed/evidenced paths and opt-in similarity edges. Confirm aliases, Chinese/English terms and LaTeX/symbol lookup. No-match and disconnected-path states must remain honest.
- Test ordinary reading/search before any optional model download, explicit activation, progress, cancellation, cached reuse, failure fallback and cache removal. Observe network requests to confirm that queries remain on the reader device and no subscription/API credential or private Vault endpoint is involved.
- Inspect 1440×1000, 1024×900 and 390×844 layouts for the entry page, exploration, atom/note reading, search and maps. Check local formula scrolling, keyboard focus, reduced motion and enlarged-text reflow; open actual screenshots. Physical-device, screen-reader, browser-support and performance claims require separate actual measurements.

The final coverage target for this snapshot is 119 canonical atoms from 123 occurrences, 73 complete mathematical notes, four compatibility pages and 25 explicit no-atom diagnostics. Source parsing/identity checks are separate from content accuracy review. Record fresh commands, failures, screenshots and live deployment evidence in `validation.md`; these requirements and the current registry counts are not themselves a claim that browser or deployment acceptance has passed.

## Current reader-interface acceptance

The current reader interface replaces the historical two-sample and full-library-graph requirements below. Verify every manifest output and asset hash, the exact generated-page/resource allowlist, all local links and block/heading anchors, source document titles, status/layer metadata and HTML/MathML equations. Bookshelf and book/chapter presentation headings may differ from source titles; complete original navigation remains in expandable `.source-navigation` sections. Presentation changes must leave content and the publication manifest unchanged.

Verify ReaderCatalog covers every approved page and every classified chapter reading, knowledge, connection and exercise is exposed in its chapter. Test section ordering, many-to-many and cross-chapter knowledge mappings, the five explicit supplements, stable output, input immutability, caching, missing-target diagnostics and discoverability of new chapter content. Exact auxiliary navigation pages must not suppress same-named directories; mathematical examples and the discovery archive remain eligible for ordinary reading.

BookIndex v2 retains every approved source-note document and includes the shared catalog. Check titles, aliases, headings, source statuses and catalog grouping. Test current-book and all-book search, default auxiliary exclusion, the explicit auxiliary toggle, real exposition snippets, Chinese/English queries and keyboard result navigation. Generated Canvas must not duplicate source notes in search.

Check the bookshelf, book/chapter directories and continuous section navigation at 1440×1000, 1024×900 and 390×844. Open knowledge from directories, search, body links and graph nodes; verify complete content, formulas, footnotes, heading links, chained reading, back/close, restored focus/position, independent navigation and request-failure recovery. Check book chapter rectangles, default chapter knowledge circles, focused direct-reference views, separate cross-chapter references, real node destinations, drag/pan/zoom and keyboard operation. Graph nodes must match the catalog's allowed non-auxiliary book contents; edges must correspond to real source links. Do not require a homepage graph or an all-note graph on every page.

Continue checking Canvas zoom and note links, formula/table overflow, root, /World/ and /math-notes/ hosting. Document text scaling separately from native browser zoom and simulated touch separately from a physical phone. Preserve exporter fixture coverage for additions, changes, removals, idempotence, source drift, unknown outputs, aliases, math/table compatibility and Canvas conversion. The existing publication entry point must reject pre-existing staging, changes after preview, and staged bytes that differ from the approved snapshot; its ordinary Windows runtime fallback remains supported.

If publication is included in the current authorized task, use the existing World workflow, wait for the exact commit's successful Pages run, and verify the hosted reader, search, graph and resources. Record actual local and online results in validation.md. This document describes checks to perform and makes no assertion that the latest release has passed or deployed.

## Historical phase-one acceptance

The remaining sections record the first two-note sample. Their content limit, missing publication features and homepage assumptions are superseded by the current acceptance above; typography, mathematical integrity and honest evidence requirements continue to apply.

This document was created from the approved implementation request. It specifies required checks and expected behavior. It does not claim that any check has run or passed; record actual commands, outcomes, limitations, and screenshot paths in the README or validation report after running them.

## Local build and content pipeline

- A documented install command works with the npm lockfile, and a documented development command starts the site on port 8080 with project-local input/output directories.
- Run a production build, TypeScript checking, the applicable formatting check, upstream tests, and focused content-pipeline checks. Record failures rather than omitting them.
- The home article and linked complete-metric-spaces note are generated from their Markdown sources. The build output contains only those synthetic notes plus deliberately included website resources, not private Vault notes or attachments.
- Inspect emitted HTML for visible semantic labels, the explicit incomplete-proof-strategy declaration, HTML and MathML mathematics, absence of renderer error markup, valid table-of-contents anchors, a working internal note link, and working footnote/return anchors.
- Verify that build configuration points only to local synthetic content, that no content symlink escapes to the parent Vault, and that the unrestricted Assets emitter is not enabled.

## Browser matrix

Use the available local Edge browser through Playwright. Check the actual page in these viewports:

| Viewport    | Required observations                                                                                                                                          |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440 × 1000 | Asymmetric wide layout; article near the intended desktop reading width; left navigation and contents; visible margin sidenote; no overlapping columns.        |
| 1024 × 900  | Compact navigation/contents above the article; sidenote restored to source order; comfortable reading width; no residual empty sidebar allocation.             |
| 390 × 844   | Clear single column; readable mixed-language prose; accessible navigation; sidenote visible in flow; formulas scroll locally; no horizontal document overflow. |

At every width, inspect inline, display, and long formulas. Check that tall formulas retain their limits, fractions, and superscripts/subscripts without clipping. Confirm the page width remains within the viewport while a long equation can scroll inside its own container.

Use keyboard input to exercise the skip link, table-of-contents expansion, heading links, the internal note link, footnotes and their return links, and the long-formula scrolling region. Verify visible focus and a sensible focus order; a click-only check does not satisfy keyboard navigation acceptance.

Check 200% browser zoom or an explicitly documented equivalent reflow check. Keep navigation and reading content usable, and state which method was actually tested. Automated layout assertions supplement, rather than replace, opening and inspecting actual screenshots.

## Static-hosting compatibility

Serve the same generated output at a local root URL and under `/math-notes/`. Test the article, linked note, return links, local prose fonts, KaTeX stylesheet/fonts, and heading/footnote navigation. Inspect for missing resource requests and runtime errors. This is a local simulation of a GitHub Pages repository path; no upload, push, or deployment is part of acceptance.

## Evidence and delivery

- Report the files changed, exact local install/start/build/check commands, and actual results, including failed or unrun checks.
- Store screenshots inside the website project and cite only files that were actually generated and opened for inspection.
- Do not invent screenshots, test outcomes, browser observations, or performance scores. Do not call simulated zoom a native browser-zoom test.
- Record visual adjustments made after inspection and any remaining limitations.
- Identify unimplemented work: approved real-content export, a real GitHub repository/public URL, and publication automation are outside this phase.
- State the next minimal task: obtain an explicit small public-note/dependency list, implement read-only export, and prove that unapproved content cannot enter the build.
