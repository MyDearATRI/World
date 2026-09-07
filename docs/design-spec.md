# Design specification

## Current bookshelf and reading interface

The homepage is a quiet bookshelf with a clear book entry, source label and extent of existing exposition. Writing explanations and demonstrations sit in an expandable auxiliary area. Book pages offer chapter reading and a knowledge index; chapter pages group continuous section readings, reusable knowledge, connections and exercises. The primary directory follows the book and section order instead of mirroring every Vault folder. Original home/book/chapter navigation remains available in expandable source sections with its title and maintenance metadata.

Clicking knowledge opens a complete reading panel beside the current desktop context, using an approximately 740px maximum panel width; narrow screens devote the available viewport to reading. Preserve the original page and graph state underneath. The panel supports chained knowledge reading, back/close, an independent-page link, focus restoration, local heading and footnote navigation, MathML, and formula scrolling inside the formula container. Ordinary links must remain useful when JavaScript is unavailable or a panel request fails.

Graphs are secondary reading aids. The book level uses labelled chapter rectangles; the chapter level uses knowledge circles. A focused knowledge view exposes real direct references, listing cross-chapter references separately. A graph line never asserts a mathematical implication or prerequisite. Keep drag, pan, zoom, fit, reset, pause, accessible controls and reduced-motion behavior; avoid constantly moving decoration. Clicking a knowledge node shares the same reading panel. Canvas views continue to preserve authored groups, arrows and annotations separately from automatic link graphs.

Retain the near-white paper, dark ink, restrained blue, fine rules and serif reading direction. The desktop grid keeps a compact book navigation rail, approximately 720px reading column and margin region; index views can use more of the reading/margin space without widening long-form prose. Below 1280px navigation collapses above a clear single-column reading flow. Search starts within the current book where applicable and offers an explicit auxiliary-material toggle. Dialog controls and content must fit the viewport, restore focus on close, and remain usable by keyboard and at enlarged text sizes.

At 600px and below, the section's knowledge links start in a collapsed, labelled disclosure with the knowledge count. Opening it reveals every linked knowledge page. This keeps long lists of concepts from pushing the mathematical exposition below the phone's first screen; larger screens show the same list expanded.

## Historical phase-one defaults

The defaults below remain useful for typography and mathematics. Their synthetic-only metadata and omission of search/graphs describe the initial phase and are superseded by the current reader interface above.

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
