# Project brief

This document was created for the approved phase-one implementation request. There was no pre-existing project brief to preserve. It records the intended behavior; test results belong in the implementation's validation report.

The original phase-one scope is preserved below. The appended GitHub-connection follow-up records the later request and current state without treating it as authorization to publish.

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

## GitHub-connection follow-up

The user requested connecting the website to a GitHub repository for convenient future pushes and updates. Git now exists only in `website/`, with `origin` set to `https://github.com/MyDearATRI/World.git`. Local `main` tracks `origin/main` and is based on the remote's existing README-only initial commit. All website working files were preserved; website-source changes are saved in a local commit; public pushes and deployment have not been performed. GitHub Credential Manager authentication is still awaiting completion.

The local `.github/workflows/pages.yml` is prepared to build and deploy through GitHub Actions after authorized pushes to `main`, with a manual trigger as well. The target URL is `https://mydearatri.github.io/World/`, and the corresponding Quartz base URL has been set, but the site is not live. This preparation does not grant permission to upload or deploy; the first public push and deployment still require explicit authorization.

Daily updates use standard Git commands, including `git pull --ff-only`, inspection of changed and staged files, commits with deliberate file selection, and ordinary `git push`. Quartz's force-pushing `sync` command is not the daily update interface. Build output, generated font assets, caches, and local credentials stay outside version control.

The content scope remains the two synthetic Markdown examples. The next minimal content task is still an explicitly approved note/dependency list, a read-only export, and verification that unapproved notes and attachments cannot enter the build. Repository setup does not authorize reading or uploading the private Vault. Actual local follow-up results, including the Git-ignore resource regression and its repair, are recorded in `validation.md`.
