# Website implementation rules

## Current authorized reader interface

The latest approved interface is a bookshelf, book and chapter reading directories, complete in-place knowledge reading, book-scoped search, and hierarchical chapter/knowledge graphs. This section takes precedence over older interface descriptions below. The homepage presents books and folds writing/template material into an auxiliary area; do not restore the full-library homepage graph or the raw Vault directory tree as the primary reading route.

Use one shared reader model: `reader.config.ts` declares book/chapter entry points, exact auxiliary page identities, and the verified supplemental knowledge-to-section mappings. `ReaderMetadata()` follows FrontMatter and extracts headings and links from exported Markdown before OFM link rewriting. `quartz/util/readerCatalog.ts` builds browser-safe data from published file metadata; reading components, BookIndex v2, the knowledge panel, and graphs consume that same model. Keep many-to-many section mappings. New chapter content must remain visible at chapter level and produce diagnostics when its preferred mapping is not configured.

Auxiliary classification changes presentation, not publication permission. Planning metadata, explicit demonstration paths, and the exact `auxiliaryFiles` list control default search exclusion. Do not infer auxiliary identity from the word “example”, hide mathematical examples, or use a parent-path exclusion for the exact navigation pages. In particular, `知识主干` is currently auxiliary but future `知识主干/*` exposition must remain eligible; `笔记主体/发现归档` contains mathematical excerpts and remains readable. Search documents retain every published source note, while generated Canvas pages remain separate. Graphs show chapter rectangles and chapter knowledge nodes; edges are actual references, never inferred prerequisites.

The bookshelf and book/chapter headings may use the reading model's presentation titles. Keep source titles in the document title and preserve complete original navigation Markdown, status, layer, mathematics and anchors in the expandable source section. Knowledge panels read generated article HTML with MathML and working local links; they must retain an independent-page escape route and restore focus/reading position. Do not edit generated content or run a fresh export merely to adjust this interface. The ordinary `发布博客.cmd` / `预览博客.cmd` workflow and preview-before-`PUBLISH` confirmation remain unchanged. Record only checks actually run in `docs/validation.md`.

## Current authorized textbook publication

The user explicitly approved and requested implementation of the complete textbook site: read-only export of all textbook, navigation, planning and example Markdown and referenced illustrations; reading navigation, search, relationship graphs, Canvas views, and a preview-confirm-publish entry point. The approved destination is the existing public MyDearATRI/World repository and GitHub Pages. The current reader-interface section above defines their presentation. This supersedes the historical synthetic-only and no-graph scope below.

Only the exporter may read the Vault. It must never modify source notes. Exclude hidden configuration, backups, credentials, prompts (including standalone prompt documents), blank templates, maintenance logs and source PDFs. Respect explicit private/draft metadata. Keep the build rooted in website/content, verify publish-manifest.json, and use the explicit approved-assets emitter. Do not point Quartz or CI at the Vault. Generated content must not be reformatted by hand. New source content is exported and reviewed before publication; no unattended synchronization is authorized.

The site must preserve source status, proof status and provenance, with no invented dates. The old reading samples are test fixtures. Update the actual validation record after checks; historical results below do not count as current acceptance.

These rules supplement the repository-root instructions and apply only inside `website/`.

## Historical phase-one rules

The current authorizations above supersede the synthetic-only and unpublished scope in this historical record. Source integrity, mathematical accuracy and content-boundary requirements remain applicable.

- This project is the public reading interface for an Obsidian writing source. Phase 1 uses synthetic Markdown only. Do not read, copy, rename, reorganize, or modify private Vault notes or attachments to implement this phase.
- Keep implementation, generated output, screenshots, and validation records inside `website/`. Never point a build, watcher, search, asset copier, or content symlink at the parent Vault.
- Use one publishing engine: Quartz v4.5.2 from commit `d25a6eabf96751ffca56f8a8139272def7a65041`. Consult that version's source and documentation. Maintain only `package-lock.json`; do not add a second package-manager lockfile.
- Article prose and mathematics belong in Markdown. English carries the complete mathematical exposition; nearby Chinese remarks explain intuition or strategy without carrying otherwise missing arguments. Distinguish a proof strategy from a complete proof.
- Do not invent author credentials, personal history, research claims, or publication dates. Do not infer public dates from file timestamps or Git history.
- Preserve the restrained reading design and accessible document order described in `docs/design-spec.md`. Test mathematical overflow at the formula container rather than hiding overflow on the entire page.
- Keep mathematical styles and fonts aligned with the installed KaTeX version. Keep the render output's MathML. Do not replace the renderer's internal fonts with the prose font.
- Do not enable unrestricted content/attachment copying. In a future real-content phase, export only explicitly approved notes and approved dependencies into a separate content directory; approval for a note does not approve the entire Vault or attachment directory.
- This phase is local only. Do not upload, push, publish, deploy, connect a remote repository, or add automated publishing without explicit user authorization. Do not add authentication, a database, a backend editor, or an automatic synchronization service.
- Read the four documents in `docs/` before changing project behavior. Update documentation when implementation choices change, and record only checks actually run. Never present planned validation as completed validation.

## Authorized GitHub publication follow-up

The user subsequently explicitly authorized pushing this website's source and its two synthetic Markdown samples to the public `MyDearATRI/World` repository and enabling GitHub Pages. That approved publication has been completed. The site is live at `https://mydearatri.github.io/World/`; pushes to `main` trigger the installed Pages workflow. Git is rooted only in `website/`. This follow-up updates the original phase-one local-only status above; do not describe the current site as unpublished or treat the completed setup as still awaiting its initial authorization.

This authorization covers the website and the two synthetic samples. It does not authorize inspecting, exporting, changing, or publishing real Vault notes or private attachments. A real-content phase still requires an explicitly approved note and dependency/attachment list before implementing a read-only export. Preserve the existing source-note boundaries and do not introduce unattended synchronization or broaden the public content scope from the fact that Pages is enabled.
