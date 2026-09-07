# Phase-one validation record

This is a record of checks actually executed on the local synthetic-content project. It is separate from `acceptance.md`, which defines the requirements. No private Vault notes or attachments were used, and no files were uploaded, pushed, or deployed.

The phase-one sections below are retained as a historical record. The appended GitHub-connection follow-up describes the current repository configuration and the later regression checks. The current machine browser report contains the latest run, rather than the original eight-scenario report.

## Environment and versions

- Node 24.19.0, pnpm 11.19.0, isolated npm 10.9.2.
- Quartz 4.5.2 from `d25a6eabf96751ffca56f8a8139272def7a65041`.
- Local Noto Serif SC 5.3.0 and renderer-matched KaTeX 0.16.28.
- Playwright 1.62.1 with installed Microsoft Edge 152.0.4191.66.
- No Git repository was present at the workspace root. The implementation did not initialize one or associate a remote.

The following npm commands were invoked through `pnpm --package=npm@10.9.2 dlx npm`, except where the direct equivalent Node script is named.

## Executed checks

| Check                              | Actual result                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci` using the final lockfile  | Passed; installed 488 packages and audited 489. Reported zero vulnerabilities.                                                                                                                 |
| `npm run build`                    | Passed; parsed exactly two Markdown inputs and emitted 272 files, including two HTML pages and their explicit resources.                                                                       |
| `npm run dev`                      | Started successfully on port 8080; HTTP GET `/` returned 200. HTTP and the reload WebSocket bind only to loopback. The server was stopped after previewing.                                    |
| `npm run check`                    | Passed; TypeScript and the whole project's applicable Prettier check both succeeded.                                                                                                           |
| `npm test`                         | Passed; 69 upstream tests, zero failures or skipped tests. Repeated after the final dependency installation.                                                                                   |
| `node scripts/verify-content.mjs`  | Passed; 136 assertions over approved source/output paths, metadata, semantics, mathematics, links, anchors, and local resources.                                                               |
| `node scripts/verify-upstream.mjs` | Passed; four in-memory compatibility scenarios for the upgraded sharp and TOML APIs.                                                                                                           |
| `node scripts/verify-browser.mjs`  | Passed; 174 checks across eight scenarios, zero failures. Machine results are in `artifacts/browser-report.json`.                                                                              |
| Additional preview HTTP checks     | Eight checks passed, including root/subpath reads, HEAD, missing project-internal paths, malformed encoding and blocked directory traversal. These were run with a temporary in-memory driver. |

## Browser observations

The same production output was served locally under `/` and `/math-notes/`. Each mount was checked at 1440 × 1000, 1024 × 900, and 390 × 844.

| Viewport width | Article width | Horizontal page overflow | Sidenote behavior                            |
| -------------- | ------------- | ------------------------ | -------------------------------------------- |
| 1440px         | 720px         | None                     | In the reserved right margin.                |
| 1024px         | 720px         | None                     | Within the article's original content order. |
| 390px          | 350px         | None                     | Visible within the single reading column.    |

The longest formula has 878px of content and scrolls within its own container at all three widths. Keyboard ArrowRight changed the container's scroll position; the page stayed within the viewport. Actual screenshots were opened to inspect the math limits, vertical spacing, visible focus, body typography, and margin/inline sidenote placement.

Keyboard checks exercised the skip link, table-of-contents expansion and anchors, formula regions, Markdown links to the related note and back, and footnote references and return links. The six primary scenarios recorded no runtime errors, missing resources, failed requests, or external resource requests. Both Noto Serif SC and KaTeX fonts were observed loaded locally.

The two additional scenarios used 200% computed text scaling and a separate 720px viewport reflow. They are not native browser zoom tests. No physical mobile device, Safari, screen reader session, performance benchmark, or deployed GitHub Pages site was tested.

## Defects found and corrected

- The initial 390px page measured 460px wide because an absolutely positioned, visually hidden KaTeX MathML node escaped the formula container's positioning context. Adding `position: relative` to `.math-scroll` reduced the document width to 390px while preserving MathML and local equation scrolling. No page-level overflow masking was used.
- The browser return-link test initially inspected an execution context during full-page navigation. Waiting for the destination URL and completed navigation corrected the test race. The link itself was valid.
- The static-resource test initially interpreted the deliberately empty `data:,` favicon as a filesystem resource. It now permits only that exact empty icon value, while keeping other resource URLs local and allowlisted.
- Mobile navigation text was increased to 14px; the sample introduction was shortened to bring the mathematics earlier in the reading flow. Synthetic-content identification remains visible and is explained in a footnote.
- A separate visual inspection of the enlarged-text screenshot found the long site-title word crossing the left rail into the article header. This was missed by the initial document-overflow assertions. Navigation now allows word wrapping and the desktop rail is height-limited and scrollable; the browser regression checks measure actual text Range rectangles, rather than only element boxes.

Initial npm installation reported 12 dependency findings. Compatible audit fixes plus explicit, documented upgrades to sharp 0.35.4 and TOML 4.2.0 reduced the final install audit to zero. The updated APIs were independently checked with synthetic, in-memory data. A Node `DEP0040 punycode` deprecation warning remains in the upstream build dependency chain; builds and tests exit successfully.

## Evidence

The machine browser report is `artifacts/browser-report.json`. Actual screenshots are listed in that report and stored in `artifacts/screenshots/`, including the three viewport tops/full pages, the mobile long formula and sidenote, and the scaling/reflow checks. Temporary screenshots from the first failed test run were removed after verifying their exact project-local paths; the retained normal screenshots are from the final successful run.

The root and source note files were not modified. Real-content export, attachments, remote repository setup and publication remain outside this phase.

## GitHub-connection follow-up

The user subsequently requested connecting the website folder to the World repository. Git has now been initialized only inside `website/`; `origin` is `https://github.com/MyDearATRI/World.git`, and local `main` tracks `origin/main`. The existing remote initial commit `54e412c`, containing only a `# World` README, was fetched and used as the local branch base without discarding website working files. Website-source changes are saved in a local commit; no public push or deployment has been performed. Remote reads work. The Git Credential Manager device-login flow completed successfully, the expected account is saved, and a non-interactive git push --dry-run origin main passed without uploading commits.

The local Pages workflow is prepared at `.github/workflows/pages.yml`, with push-to-main and manual triggers. Its official Actions versions were checked, `.node-version` is 24.19.0, and the target Quartz `baseUrl` is `mydearatri.github.io/World`. The workflow has not been uploaded or run. The target site is not live. Explicit authorization for the first public push and deployment is still required; the request to operate the computer and finish Git setup does not itself authorize publication.

### Regression and repair

Initializing Git exposed a static-resource regression. The upstream `glob` helper applies `gitignore: true`; because generated fonts and KaTeX resources are deliberately ignored by Git, the Static emitter stopped copying them. The failing build emitted only six files. Content verification failed at the first missing font stylesheet after 71 passing assertions, and the expanded browser run reported 227 passing checks and 27 failures, including missing-font requests.

`quartz/plugins/emitters/static.ts` now uses explicit patterns for the prepared prose CSS/fonts/licenses and KaTeX CSS/fonts/licenses under `quartz/static`, with Git ignore filtering disabled for this copy step and symbolic-link following disabled. The generated resources remain Git-ignored. The unrestricted content Assets emitter remains disabled, and neither the private Vault nor the content input boundary was opened. A direct enumeration confirmed that the previous Git-aware path returned zero resources while the explicit website resource patterns returned 266.

### Follow-up verification actually run

| Check                                     | Actual result                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Production build after the Static repair  | Passed; two Markdown inputs, 272 emitted files, including the restored 266 static resources.                |
| Content pipeline                          | Passed; all 136 assertions.                                                                                 |
| TypeScript and applicable Prettier checks | Passed.                                                                                                     |
| Expanded Edge browser suite               | Passed after the repair; 254 checks, zero failures, across 11 scenarios.                                    |
| Git remote reading and tracking           | Remote fetch succeeded; local `main` tracks `origin/main`. This does not verify authenticated write access. |
| GitHub Actions and deployed Pages         | Not run. No website-source push or deployment was performed.                                                |

The preview and browser scripts now support `/`, `/math-notes/`, and `/World/`. Each mount is checked at 1440 × 1000, 1024 × 900, and 390 × 844, with separate 200% computed-text-scaling and 720px reflow scenarios. The latest machine results are in `artifacts/browser-report.json`. These remain local Edge checks; native browser zoom, physical mobile devices, Safari, screen readers, and the actual hosted site were not tested in this follow-up. Earlier phase-one test counts are retained above and should not be read as a second execution of those tests during the repository setup.

The upstream `punycode` deprecation notice remains non-fatal. Real-note export, approved attachment handling, and publication of personal content remain unimplemented.

## Authorized GitHub Pages publication

The user subsequently explicitly approved publishing the website source and two synthetic articles to the public World repository and enabling GitHub Pages. The earlier local-only and not-yet-published statements above describe the preceding stages, not the current deployment state. No private Vault content or attachments were read or uploaded.

The website commits were pushed normally to `MyDearATRI/World` on `main`, preserving the original remote README commit. Pages was enabled with `build_type: workflow` and HTTPS enforcement. The first deployed source commit was `def8717b976685284e7f0e92d00ac7bff70a9602`.

[The first GitHub Actions run](https://github.com/MyDearATRI/World/actions/runs/34099696588) completed successfully, including both `build` and `deploy`. The actual Ubuntu runner logs confirmed:

- Node 24.19.0, npm 10.9.2 and lockfile installation succeeded; npm reported zero vulnerabilities.
- TypeScript and Prettier passed.
- All 69 upstream tests passed, with zero failures; the additional sharp/TOML compatibility checks also passed.
- Quartz processed exactly two Markdown inputs and emitted 272 files.
- All 136 content assertions passed before the Pages artifact was uploaded.
- The deployment reported success for the same source commit.

The HTTPS home page at [mydearatri.github.io/World](https://mydearatri.github.io/World/) returned HTTP 200 with the expected article title and MathML. Its published content index contained only `index` and `notes/complete-metric-spaces`.

### Actual hosted-browser verification

Edge 152.0.4191.66 loaded the real HTTPS site at 1440 × 1000, 1024 × 900 and 390 × 844. All 77 checks passed, with zero failures. The document widths remained 1440, 1024 and 390 pixels respectively. The 878px formula scrolled within its own container using the keyboard. The actual Noto Serif SC and KaTeX fonts loaded; formula HTML and MathML were present, with no KaTeX errors.

The hosted checks exercised the skip link, compact table of contents, footnote reference/return links, and navigation to the related note and back using the keyboard. Sidenotes occupied the wide margin and retained their visible document order on smaller screens. No console/runtime errors, failed resource requests or third-party reading-resource requests were observed.

The real-site report is `artifacts/live-browser-report.json`; the local verification script is `artifacts/verify-live.mjs`. Four actual screenshots were generated and opened for visual inspection:

- `artifacts/screenshots/live-1440-top.png`
- `artifacts/screenshots/live-1024-top.png`
- `artifacts/screenshots/live-390-top.png`
- `artifacts/screenshots/live-390-sidenote.png`

These are desktop Edge tests of the hosted site, not physical-device, Safari, screen-reader or performance-benchmark results. The earlier local 200% text-scaling and reflow checks were not rerun against the hosted site. No new performance score is claimed. Approved real-note export and attachment handling remain the next content task.
