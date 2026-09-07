# Phase-one acceptance

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
