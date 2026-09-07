# Design specification

## Textbook interface extension

The approved follow-up adds a structured home page from the Vault's home Markdown, a collapsible directory tree, breadcrumbs, source-defined chapter navigation, a visible search field and interactive relation graphs. Body/plan/example/navigation status is textual and follows source metadata. A graph line means an actual note link, not a mathematical implication. The homepage contains an inline full-library graph; article launchers begin at one-hop neighbours. Graph panels use the same restrained paper/ink/blue palette, with drag/pan/zoom, fit/reset/pause, keyboard access and reduced motion. Canvas views preserve the author's groups, arrows and annotations separately from the automatic note graph.

The wide grid now starts at a 224px directory rail, 720px reading column, 160px margin, and 48px gaps. The home page can span the reading and margin columns. Below 1280px the directory is collapsed above the text; the phone returns to one reading column. Search and graph modal focus must remain usable, return to the trigger on close, and fit the viewport. These additions supersede the historical phase-one omission of search/graph below.

This document was created from the approved phase-one design request. Its values are implementation defaults to be checked against the actual mixed Chinese/English article; the acceptance document defines required browser observations.

## Reading character

The page should feel like a mathematics research notebook in a browser. Favor a near-white paper background, dark readable prose, one restrained blue for links and small accents, fine rules, and generous separation between mathematical ideas. Avoid gradient heroes, glass effects, decorative particles, large rounded cards, unnecessary animation, and rotating graph displays.

English exposition and Chinese remarks share one reading flow. Use a locally provided Noto Serif SC body face with appropriate serif fallbacks; use system sans-serif faces for navigation, labels, and metadata. KaTeX controls mathematical typography and its own internal font family. Do not force prose typography into formula descendants.

## Grid and responsive behavior

- Start at a 720 px article column, 18 px body type, and a 1.85 line height; keep the resulting reading width within approximately 680–760 px on suitable desktop viewports.
- At widths of 1280 px and above, use an asymmetric layout with a compact navigation/table-of-contents column to the left, the article in the center, and a narrow sidenote region to the right. The article remains the visual priority.
- Below 1280 px, place navigation and a keyboard-operable expandable table of contents above the article. Return sidenotes to their original position in the document flow.
- At 390 px, use a single reading column with modest horizontal padding, reachable links, legible labels, and no whole-page horizontal scrolling.
- Keep grid tracks and flex items shrinkable. Fix overflow at the responsible component; do not mask defects with a page-level horizontal overflow hide rule.
- At enlarged text sizes, allow long navigation words to wrap within the rail. The desktop rail is limited to the viewport height and can scroll independently so its last keyboard target stays reachable.

## Semantic article elements

Definition, theorem, proof strategy, and example blocks use visible text labels, fine lines, typographic hierarchy, and spacing. Their meaning must not depend on color. These are prose regions rather than heavy colored cards.

The proof strategy label explicitly says that it is not a complete proof. A strategy must not acquire a proof-completion mark through styling or a renderer default. A sidenote is an `aside` with an accessible visible label and keeps its source order even when visually placed in the wide-screen margin.

Display formulas scroll only inside their own containers. Leave adequate vertical space for fractions, summation limits, and subscripts/superscripts. Long formulas have a keyboard-focusable scrolling region, an accessible name, and a visible focus indicator. Inline formulas participate in ordinary prose flow; do not reduce all mathematics to an unreadably small font to fit a phone.

## Navigation and accessibility

Include a skip-to-article link, a title and meaningful heading hierarchy, real heading anchors in the table of contents, a visible keyboard focus treatment, and footnote return links. Links should remain recognizable without relying solely on color. Preserve MathML in the delivered HTML.

Show concise synthetic-content metadata. Do not show fabricated authorship, affiliation, article dates, or dates inferred from file metadata. Omit unused controls and avoid adding a search interface, graph, preview popovers, theme animation, or decorative motion during this phase.

## Local assets and hosting

Use local font and KaTeX assets with subpath-safe references. The same static output must read correctly at a local root URL and beneath `/math-notes/`, including the linked note, fonts, mathematics, and navigation. This requirement does not authorize remote publishing.
