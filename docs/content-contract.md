# Content contract

## Authorized textbook export contract

The current source boundary is publish.config.json plus the committed publish-manifest.json, replacing the historical two-file input restriction below. The exporter reads the approved source files, preserves their prose and metadata, generates a home index and Canvas representations, and copies only referenced approved illustrations. Source filenames/hashes are recorded only for public files; excluded-path diagnostics remain local under ignored artifacts. Configuration, backups, prompts, templates, maintenance logs, source PDFs and explicitly private/draft notes are excluded.

Build input stays inside website/content; CI never reads the source Vault. Export uses staging, verifies the source file list and hashes, rejects unknown/modified public copies, and replaces only its managed output with rollback on failure. Canonical links and compatibility conversions exist only in the copies. Missing links become labelled text; ambiguous targets fail export. PDF references retain their citation/page context without serving the original file. Display-math delimiters and table formula pipes are normalized without changing mathematical meaning. Preserve block identifiers through semantic conversion, and allow independent excerpts from the same source without falsely calling them cycles.

Title uses explicit source title or the first H1 with a filename fallback. Source status/layer/tags/aliases remain available; no source timestamp is converted to a public date. siteKind distinguishes body, plan, example, navigation and generated canvas pages. All derived reader data is bounded to this approved snapshot. Original synthetic samples remain only under tests/fixtures/synthetic.

## Current reader-model contract

`reader.config.ts` contains website-only book/chapter identities and entry slugs, display labels, precise auxiliary classifications, and five verified supplements to knowledge-to-section mappings. `ReaderMetadata()` runs after FrontMatter and before OFM link rewriting, extracting ordered links and heading groups from exported Markdown without including code examples. `buildReaderCatalog` is pure and browser-safe; `getReaderCatalog` caches by the supplied file-array reference. Neither may read the Vault or filesystem, change exported content, or synthesize unavailable note targets.

The model has books, chapters, continuous reading sections and a record for every published page. Page roles are book, chapter, reading, knowledge, connection, exercise, auxiliary or other. `ReaderPage.sections` holds associated reading-page slugs; `ReaderSection.knowledge` holds knowledge-page slugs. Association may be many-to-many and cross chapters, while a knowledge page keeps its own chapter identity. Chapter entry links determine the reading order, contents headings supply section associations, and explicit supplements fill only the verified missing associations. Newly published chapters, unindexed sections and unmapped knowledge remain visible at chapter level with diagnostics; they must not silently disappear.

Auxiliary identity changes default presentation, not the public file allowlist. Use planning metadata, explicit demonstration paths and exact `auxiliaryFiles`. The exact current auxiliary navigation pages are `index`, `笔记科学与逻辑`, `笔记主体/笔记主体`, `知识主干`, and the Simon contents page. This does not exclude future `知识主干/*` or similarly named subdirectory exposition. `笔记主体/发现归档` remains ordinary readable material. A mathematical example is not auxiliary merely because its title or siteKind says example.

BookIndex v2 includes the shared catalog and all published source-note search documents, including auxiliary documents; generated Canvas pages do not duplicate source notes in search. Default search filters auxiliaries and supports a book scope, while its explicit toggle restores them. Graph nodes come from that same catalog's published non-auxiliary section, knowledge, connection and exercise pages. Book-level chapter rectangles are navigation controls, not fabricated note nodes. Chapter overview circles represent chapter knowledge only. Every graph edge must correspond to an actual source link; Canvas remains a separate derived resource.

The homepage may display “书架” and book/chapter pages may use reader presentation titles. Keep the source title in the HTML document title and source-navigation section. Full original navigation Markdown, source status/layer, formulas and anchors remain in the rendered document. The knowledge panel loads this generated article content, retains accessible mathematics and links, and offers independent page navigation. This interface work must not rewrite source notes or trigger a new export merely for presentation changes.

## Historical sample contract

The remaining two-note examples document the original rendering sample and its mathematical semantics. The authorized export and reader-model contracts above supersede their input and publication limits.

This document originated in the synthetic-content phase; the sample rules below do not grant any additional source access beyond the current approved export boundary.

## Source boundary and page metadata

The only article inputs are the two explicitly maintained synthetic Markdown files in this project's `content/` directory: the home article, “Contractions and fixed points”, and a short linked note about complete metric spaces. Page components contain layout and metadata presentation, not a hard-coded duplicate of the article.

Declare a meaningful Markdown title and identify the material as a synthetic reading demonstration. Do not declare an author biography, credentials, research accomplishment, or publication date. Do not derive publication dates from filesystem timestamps or Git history.

English must carry all required mathematical definitions, assumptions, conclusions, and reasoning. Chinese remarks may explain intuition, prerequisites, and key steps without repeating every sentence or becoming the sole location of a required argument. Standard results must be stated accurately; distinguish mathematical claims from commentary.

## Required Markdown features

- Inline mathematics uses `$...$`; display mathematics uses `$$...$$` on separate lines. Include at least one display formula long enough to exercise local horizontal scrolling on a narrow screen.
- Use real headings for the article outline and the generated table of contents.
- Use an Obsidian wikilink to connect the home article to the complete-metric-spaces note. The linked note must render as a real page and provide a return route to the home article.
- Use GFM footnotes with both a citation link and a return link.
- Write semantic mathematical blocks with Obsidian callout syntax, using the supported types below. Callouts are not collapsible in this sample.

| Markdown callout    | Rendered meaning | Required treatment                                                                       |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `[!definition]`     | Definition       | Visible definition label and full assumptions in English.                                |
| `[!theorem]`        | Theorem          | Visible theorem label with accurate hypotheses and conclusion.                           |
| `[!proof-strategy]` | Proof strategy   | Visible `Proof strategy — not a complete proof` declaration; no proof-completion symbol. |
| `[!example]`        | Example          | Concrete instance with enough computation to verify the claimed behavior.                |
| `[!sidenote]`       | Sidenote         | Semantic `aside`; preserve source order; return to inline flow on smaller screens.       |

For example:

```markdown
> [!proof-strategy] Iterating the contraction
> Proof strategy — not a complete proof.
>
> Compare successive iterates, then use the geometric tail estimate to show
> that the iteration is Cauchy. Completeness supplies a limit in the space.
```

The strategy label is required even when the content explains several correct proof steps. Do not silently relabel a partial argument as a complete proof.

## Rendering contract

Retain Quartz's Markdown processing, Obsidian link resolution, GFM footnotes, heading outline, and link relationships. Apply the semantic callout transformation without losing child Markdown, mathematics, links, or note order.

Use `remark-math` with `rehype-katex` to emit HTML and MathML. Serve KaTeX styles and fonts from the same installed package version rather than an independently versioned CDN. Do not overwrite the renderer's font family with the prose font. Treat a visible KaTeX error as a failed validation.

Display formulas receive individual scrolling containers with accessible names and keyboard focus. A formula wider than its reading column must not enlarge the document viewport. The visible formula and its MathML must remain present after semantic transformations.

## Private content and attachments

Keep the build input inside `website/content/` and the output inside `website/public/`. Do not point the source path at the parent directory, use a symlink to the Vault, or make the Vault or its attachment folder a public assets directory.

Do not enable the unrestricted Quartz `Assets` emitter for this phase. It can copy files discovered under the content directory into public output; that behavior is unsafe as a substitute for an explicit publication boundary. Required site resources are copied from specific, known package resources, not from a recursive Vault or attachment scan.

A later read-only export must start from the user's explicitly approved notes and dependencies. Approval for a note does not implicitly authorize all linked notes or nearby attachments. Unapproved dependencies must be excluded and reported for review. Export must not modify, rename, move, or reorganize original files. Remote upload and publishing require separate explicit authorization.
