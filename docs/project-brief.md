# Project brief

## Actual notes in a continuous knowledge field

The current follow-up connects the approved mathematical notes to Topos rather than retaining an isolated demonstration as the main experience. The root and `topos.html` expose existing mathematical objects and complete source notes. Book-independent context and relationship exploration become the default; books remain useful provenance and optional reading routes under `library.html`. The Group demonstration remains separately available at `topos-demo.html`.

Source prose can already be reused through the formal Markdown/HAST pipeline. Necessary writing-template and governance changes are local, incremental, and do not authorize publication of excluded files. The full existing public object set must remain accessible, including notes without extracted atoms; no new proof, authorship or completion claim follows from indexing or visual grouping.

## Knowledge Topos — current direction

The September 10 specification replaces page-centered exploration with continuous context transformations. The immediate deliverable is one Group → Group Action → Representation vertical prototype, not a whole-site migration. In one persistent field, selected concepts become the focus, old contexts remain perceivable, nearby concepts approach and irrelevant concepts recede. Source explanations unfold in place rather than opening an article.

The six independent primitives are Concept, Relation, Context, Section, Lens and ViewState. A separate graph/context/physics/render/content architecture supports calm 2.5D semantic depth, typed relations and graph-derived collective structures. The prototype uses website-owned synthetic Markdown based on checked public mathematical references. It does not read or re-export the Vault. Existing textbook content remains available. Requirements and actual evidence must be assessed under `topos-acceptance.md`, not the earlier map acceptance.

## Three-dimensional exploration follow-up

The map is a spatial reading interface built around the actual book, chapter and section sequence. Readers progressively enter a section, inspect named mathematical objects and follow typed, sourced relations into the existing flat reading space. The tree gives orientation; local attraction and repulsion make relationships visible without asserting mathematical significance for geometric distance. Model similarity is a weaker, explicitly labelled and switchable discovery layer. This follow-up does not change writing conventions, public content scope or canonical article/atom URLs.

## Current mathematical knowledge space

The approved product is a connected research notebook with two entrances: read a book in chapter order, or explore source-derived mathematical objects. Complete notes remain the sole mathematical writing source. The website registers definitions, definition groups, theorems, propositions, proofs, observations and questions without requiring changes to Vault titles, folders or frontmatter.

Stable atom identities have independent static URLs and one or more source occurrences. The central reader shows a complete atom or note; the left context retains the exploration trail and book position, and the right context separates source notes, evidenced links and precomputed machine recommendations. Search and maps share that identity model. A graph path lists actual edge types and evidence, and never manufactures a mathematical explanation for a missing connection.

Reading, ordinary text/formula-symbol search and recommendations work without a reader model download. Optional local semantic queries require the reader's explicit download action and execute in a browser Worker using the pinned multilingual-e5-small model. This feature has no assistant chat, author-account dependency, subscription API or private Vault endpoint.

The task uses the existing approved snapshot only. Original notes, public Markdown and the publication manifest stay unchanged. Unlisted files concurrently added to the website content directory are left untouched and omitted before parsing. Current validation, exact coverage and remaining unregistered prose are recorded separately. Earlier brief sections below describe historical interfaces.

## Current reader-interface follow-up

The approved site is a reading interface for complete mathematical textbook notes. Its entry is a bookshelf: choose a book, browse its chapters, and follow the continuous section readings. Book and chapter pages also expose reusable knowledge, connections and exercises. Knowledge opens in an in-place reading panel with full generated content and an independent article link. The original home, book and chapter navigation Markdown remains available in expandable source sections rather than being rewritten to fit the website.

Reading, search and graphs share the website-owned ReaderCatalog. Explicit book/chapter configuration combines with headings and links extracted from exported Markdown; verified supplements fill only the known gaps in section associations. Preserve cross-chapter and many-to-many reuse. New published sections, knowledge and chapters remain discoverable even when a preferred mapping is not configured, and the model reports that condition.

Search defaults to the current book where applicable and excludes explicit auxiliary material until requested. Mathematical examples and the discovery archive remain part of ordinary reading. Book graphs begin with chapter rectangles; chapter graphs show local knowledge circles, and focused views distinguish direct references from cross-chapter references. No full-library graph dominates the homepage, and no edge is presented as a prerequisite or implication. Canvas remains a separate representation of authored groups, arrows and annotations.

Publication still includes the approved textbook, navigation, planning and example notes and referenced illustrations, excluding configuration, backups, prompts, blank templates, maintenance logs, source PDFs and explicitly private/draft material. The reader-interface change does not alter source notes, exported Markdown or the publication manifest. The existing manual entry point exports, checks and previews, then publishes only after `PUBLISH`. Current verification and deployment evidence belongs in validation.md.

## Historical implementation scope

The remaining sections record earlier phases. Their two-sample content limit, old interface descriptions and initial GitHub setup are historical and are superseded by the current follow-up above.

This document was created for the approved phase-one implementation request. There was no pre-existing project brief to preserve. It records the intended behavior; test results belong in the implementation's validation report.

The original phase-one scope is preserved below as historical scope. The appended initial GitHub-connection account is also historical; the current approved export boundary is defined above and in content-contract.md.

## Purpose

Obsidian is the sole writing source. The website is a personal mathematics blog and a connected note-reading interface, with the density, typographic care, and explicit mathematical structure of an academic notebook. The visual direction is Mathematical Neo-Modernism: an asymmetric reading grid, semantic typography, restrained blue accents, and reusable layout rules.

## Phase-one deliverable

- Build a real, locally runnable article page from synthetic Markdown, with the article as the home page.
- Add one short linked note about complete metric spaces to exercise Obsidian-style internal links and return links.
- Include English exposition, nearby Chinese remarks, inline and display mathematics, a long formula, semantic mathematical blocks, a table of contents, a footnote, and a sidenote.
- Explicitly distinguish a proof strategy from a complete proof. Present all content as a synthetic demonstration, without attributed personal accomplishments or an invented publication date.
- Verify desktop, intermediate, and mobile reading behavior, the content pipeline, and static hosting under a repository subpath.

## Engineering baseline

The project lives entirely in `website/`, independently of the parent Obsidian library. Use Quartz v4.5.2, fixed to upstream commit `d25a6eabf96751ffca56f8a8139272def7a65041`, with the source and documentation from that commit. Preserve the upstream license. Use one publishing engine and one npm lockfile; Astro is not part of this implementation.

The available host runtime is Node 24.19.0 with pnpm 11.19.0. Invoke npm 10.9.2 through pnpm rather than changing the machine's global package-manager installation. The public local commands are documented in the project README. The development port is 8080; build content and output are explicitly bounded to this project's `content/` and `public/` directories.

The mathematical pipeline uses `remark-math` and `rehype-katex` with HTML and MathML output. Styles and fonts are local resources taken from the same installed KaTeX version. Prose font assets are local so reading does not depend on a third-party font request.

## Boundaries

This phase must not inspect the real Vault, mutate source notes, expose private attachments, upload files, push commits, deploy a site, or create an automatic publication workflow. It adds no login, database, backend editor, synchronization service, knowledge graph, search service, or analytics. Local subpath testing is a compatibility check, not a GitHub Pages deployment.

## Smallest next phase

After explicit approval of a small note list and its attachment/dependency list, implement a read-only export into a separate staging content directory. Verify that unapproved notes, embeds, links, and attachments cannot be included implicitly. Decide the actual GitHub repository address and publication path only when remote setup and publication are separately authorized.

## GitHub-connection and publication follow-up

The user requested connecting the website to a GitHub repository for convenient future pushes and updates, then explicitly approved publicly pushing the website source and its two synthetic examples and enabling GitHub Pages. Git exists only in `website/`, with `origin` set to `https://github.com/MyDearATRI/World.git`. Local `main` tracks `origin/main`. The existing README-only initial commit `54e412c` and website implementation commit `153b5cd` were preserved; version `def8717` was pushed to `main`. Git Credential Manager authentication is complete and credentials are saved locally.

The uploaded `.github/workflows/pages.yml` builds and deploys through GitHub Actions on pushes to `main`, with a manual trigger as well. The site is live at `https://mydearatri.github.io/World/`, with the corresponding Quartz base URL configured, the Pages source set to GitHub Actions, and HTTPS enforced. The first Actions run, `34099696588`, completed both build and deploy successfully. The online homepage returned HTTP 200 with the correct sample title and MathML. Online Edge checks at 1440px, 1024px, and 390px passed all 77 assertions; all four generated screenshots were opened for inspection. Detailed results are recorded in `validation.md`.

Daily updates use standard Git commands, including `git pull --ff-only`, inspection of changed and staged files, commits with deliberate file selection, and ordinary `git push`. Quartz's force-pushing `sync` command is not the daily update interface. Build output, generated font assets, caches, and local credentials stay outside version control.

The content scope remains the two synthetic Markdown examples. The next minimal content task is still an explicitly approved note/dependency list, a read-only export, and verification that unapproved notes and attachments cannot enter the build. The approved synthetic-site publication does not authorize reading or uploading the private Vault. Actual follow-up results, including the Git-ignore resource regression and its repair and deployment verification, are recorded in `validation.md`.
