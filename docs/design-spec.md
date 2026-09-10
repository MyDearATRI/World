# Design specification

## One continuous field

Themes are color and text landmarks, without enclosing lines, tinted territories
or rectangular reserved slots. Their neighborhoods may overlap and share objects;
actual relation links remain visible across memberships. A theme name locates its
current member points. Only its text receives pointer input; dragging across the
rest of the field is uninterrupted. Nodes stay above names and can move freely
between neighborhoods. Movement responds to input and settles rather than drifting
continuously. Existing manual positions survive the layout update.

## Persistent reading geography

Place the selected-theme map beside the topic rail, on the page canvas. Keep a
quiet full reading surface when opening a source; collapse and Back restore the
same map. The name directory uses continuous rows. Named group entrances and an
explicit current-neighborhood view support progressive scale.

Keep arrows, relation labels and original evidence available together. Expose
links outside the current scope and expand them deliberately. A text relation
list remains usable when spatial labels cannot all fit. Do not move or remove a
node because its name is hidden by another label. Map distances express layout;
they do not certify mathematical dependence.

## Independent nodes and labels

Node marks and their hit targets occupy a layer independent from name labels. Give marks a restrained paper halo and visible keyboard focus. Resolve name/node conflicts by placing or receding the name, never by removing the mark. Keep visible relationship endpoints even when one full name cannot fit; focus, pointer inspection and the locator still disclose the full name.

Motion expresses a bounded layout equilibrium: stable topic positions, individual preferred positions and masses, springs derived from recorded relation kinds, and collision separation. The pointer owns the dragged node while neighbors respond; after release, damping converges and rendering stops. Hover does not restart physics. Layout coefficients and distances describe presentation, not the truth or significance of a mathematical claim. Existing relation explanations and provenance must be readable without relying on line color alone.

## Full reading surface and directional context

For published notes and audited Atlas titles, opening an object replaces the full field with a stationary reading surface. Keep only its title/type above the source body. At 1440px the central surface is roughly 1000px wide with a 760px inner prose column and 190px directional rails; at 1024px the rails narrow to 140px and the reading surface remains about 696px. At 900px and below, directions become two collapsed bottom disclosures and reading uses the available single column. The theme selector remains accessible as a drawer. No full field, horizon points or automatic motion stays behind the body.

Left and right mini maps show actual incoming and outgoing relationships, with visible names, original edge types and evidence. Structural inclusion is not a prerequisite. Pagination keeps crowded neighborhoods readable without deleting destinations. The top-right global-map button is available from both the named overview and reading. Its separate large SVG view contains all unique objects and all real edges inside the selected theme union, irrespective of overview pagination. Labels use zoom/selection for density; controls preserve accessible destinations even at a distant zoom. Native modifier links remain native.

Dragging, pan and zoom respond to input without continuing decorative animation. Opening/closing maps and navigating reader objects use the same browser history, with retained source scroll, entry focus and map camera. The Group demo retains its separate exploratory field; these new rules supersede the earlier always-visible field only for real-content and Atlas reading.

## Stable named exploration

Topic selection opens a named spatial index in the existing world. Use fine colored node marks and full titles, compact type labels and real relationship counts, with restrained separation rather than thick cards. Bound the number of simultaneous labels with explicit pages and filters; show the total and current range. Query, page and clicked identity belong to navigation history. Relations are disclosed on deliberate hover or keyboard focus, with a readable list for cross-page links and sources. Never infer mathematics from spatial arrangement.

Object reading retains the same controller and stable IDs. No anonymous background cloud, pointer parallax or periodic label shuffling should disturb the current object. Remember feasible label slots, preserve manual drops and keep drag feedback local. Structural layout transitions are brief and finite; identical context and zoom do not restart whole-scene relaxation. The phone overview scrolls within a clear single-column area, with no dependence on hover to find objects or relations.

## Responsive movement

Continuous wheel, pinch and depth-slider input is coalesced into the next animation frame. Pointer panning follows the pointer directly; camera changes use short time-based easing, and concept labels follow their actual anchors on every paint. Collision placement is independent from anchor tracking. Direct navigation supersedes any queued zoom from the previous context.

Cache graph analysis, text measurements and reusable GPU buffers with explicit invalidation. Hidden geometry and invisible text must not impose continuous drawing or layer costs. Do not animate font size, reading width or maximum height while the same properties are being recalculated each frame; use position and brief opacity/color transitions. Preserve exact mathematical relationships, node identity, finite settling, reduced motion and Canvas2D fallback.

## Theme navigation

The latest explicit sidebar request supersedes the historical sidebar prohibition. A 272px warm-gray rail (235px at intermediate desktop widths) contains six actual-note themes or twelve atlas regions, using stable colors, readable names, native checkboxes and counts. Color is not the sole state signal. Multi-selection is a union, shared objects occur once, and an empty selection has guidance. The selected-node directory can filter names and provides access to every identity.

At 760px and below, the rail becomes a native modal drawer. Closing returns focus; choosing a result enters its existing reader. Canvas bounds, pointer coordinates and annotations account for the remaining desktop viewport. Preserve calm 2.5D movement, reduced-motion handling, the 720px reading maximum and KaTeX typography. Atlas objects disclose taxonomy provenance and verification limits; their structural links never imply mathematical proof.

## Default field of the author's published mathematics

The actual-note follow-up uses the same continuous 2.5D field at `/` and `topos.html`. Focus, type, provenance and proof status identify the active object. Local search supports the actual titles, aliases, bilingual prose and literal LaTeX, without a mandatory book selection. The context model uses actual relationships; books and chapters do not determine positions or communities. Lens captions describe their real filtering/weighting purpose for these notes rather than reusing group-theory-specific names.

Formal objects and complete notes unfold from their existing rendered content in the field, with readable local headings, mathematical overflow containers and retained source context. Native independent-page links remain available. Structural occurrences and references are labelled distinctly from authored mathematical relations. The full original textbook interface is secondary at `library.html`, and the synthetic vertical prototype is secondary at `topos-demo.html`.

## Knowledge Topos — continuous contexts

The current vertical prototype uses a full-viewport field at `topos.html`, with small secondary lens/depth controls. There is no primary folder sidebar, top navigation, card grid or article transition. Click changes the force field while preserving node position and velocity. GPU marks, typed arrows, graph-derived boundaries, anchored DOM labels and mathematical sections belong to the same space. Screen-space annotation collision/leader placement is separate from semantic relationships.

Semantic depth runs from 0 to 3: collective structures; concepts and selective typed links; summaries and formal mathematics; recursive definitions/examples/constructions. The orthographic drawing layer communicates depth with opacity, scale and restrained parallax. Context changes cause attraction, recession and emergence, with finite damping and no decorative motion. Expanded explanations participate in collision spacing and retain local formula scrolling. Mathematical text uses dark serif type over warm paper, with muted blue structure. Inspect label-free recordings as well as readable content; the concrete evidence matrix is `topos-acceptance.md`.

## Three-dimensional tree and flat reading

The current map uses Three.js 0.185.1 and d3-force-3d 3.0.6. A stable book → chapter → section skeleton separates local neighborhoods. Collections have hollow geometry; mathematical objects have solid nodes and camera-facing labels. One atom keeps one identity and spatial position even when associated with several sections. The earliest explicit section in the catalog supplies its initial layout anchor, while all memberships remain visible. Chapter-level fallback retains unassigned objects and sections without atoms still link to their full reading.

Pointer dragging a node adjusts its layout; clicking reads. Empty-space dragging rotates; Shift/right dragging pans; wheel zooms. Camera and navigation controls have explicit keyboard alternatives. Mobile starts with grouped lists and opens a full-screen map deliberately; touch supports rotation, node-position mode and two-finger pan/zoom. Short damping settles after interaction, idle/hidden maps stop rendering, and reduced motion goes directly to stable states. WebGL2 failure exposes the same tree and object links as an accessible fallback.

Original mathematical relations and references attract more strongly than bounded, separately labelled model recommendations. Similarity starts enabled for layout and can be switched off, while relation paths still require explicit inclusion of recommendations. Direction markers identify actual directed relations; structure and similarity do not become proofs. The flat reader, original formulas, source context and native links retain the existing interaction contract.

## Current knowledge-space design

Home exposes book reading and exploration as two explicit destinations. Warm gray (#f1f0ec) supports near-white (#fffefa) reading surfaces, dark ink and a restrained blue. Object type, source title, proof status, source location and mathematical prose use separate typographic levels. Prose retains the existing serif and KaTeX keeps its own fonts. The focused desktop reader has context, central reading and related-content regions; narrower screens put context into compact controls and use a single reading flow.

Every object uses the same ID/title/type in search, preview, map and reader. Brief position/scale transitions connect activation to focus, while finite map camera motion explains group changes. Reduced-motion mode completes these changes directly. Dragging moves nodes without opening content. Stable positions and camera state survive filters and history changes. Mobile begins with readable grouped lists and opens its map full-screen when requested.

The command panel searches names, aliases, bilingual source text, literal LaTeX and common notation. It defaults to the current book and keeps an explicit all-content option. Auxiliary content is opt-in; mathematical examples remain ordinary content. Reader model download information is disclosed before loading, separately from ordinary search. Recommendations and explicit source relationships never share an unlabelled visual category.

Preserve source-relative links, internal anchors, footnote returns, native modifier-click, readable static fallback, and exact browser history. On return, restore the previous scroll position, focused link and expanded source disclosures. Use real screenshots to judge hierarchy and formula overflow; passing DOM assertions alone is not visual approval. The earlier sections below describe the preceding bookshelf/panel interface.

## Current bookshelf and reading interface

The homepage is a quiet bookshelf with a clear book entry, source label and extent of existing exposition. Writing explanations and demonstrations sit in an expandable auxiliary area. Book pages offer chapter reading and a knowledge index; chapter pages group continuous section readings, reusable knowledge, connections and exercises. The primary directory follows the book and section order instead of mirroring every Vault folder. Original home/book/chapter navigation remains available in expandable source sections with its title and maintenance metadata.

Clicking knowledge opens a complete reading panel beside the current desktop context, using an approximately 740px maximum panel width; narrow screens devote the available viewport to reading. Preserve the original page and graph state underneath. The panel supports chained knowledge reading, back/close, an independent-page link, focus restoration, local heading and footnote navigation, MathML, and formula scrolling inside the formula container. Ordinary links must remain useful when JavaScript is unavailable or a panel request fails.

Graphs are secondary reading aids. The book level uses labelled chapter rectangles; the chapter level uses knowledge circles. A focused knowledge view exposes real direct references, listing cross-chapter references separately. A graph line never asserts a mathematical implication or prerequisite. Keep drag, pan, zoom, fit, reset, pause, accessible controls and reduced-motion behavior; avoid constantly moving decoration. Clicking a knowledge node shares the same reading panel. Canvas views continue to preserve authored groups, arrows and annotations separately from automatic link graphs.

Use a gray-white page hierarchy, a near-white reading surface, dark ink, restrained blue accents and fine rules. Main titles use a sans-serif face at weight 700; chapter headings use weight 650. Long-form prose retains the locally supplied Chinese-friendly serif face at approximately 18px. Semantic mathematical blocks separate a compact `.block-kind` type badge from `.block-title`, which preserves the complete original rich title. A proof strategy remains explicitly a strategy. Only an opening paragraph explicitly labelled “来源：”, “来源:” or “Source:” receives `.note-provenance` and 12px sans-serif treatment; retain all citation text, links and identifiers, and do not guess provenance from author names, dates or PDF mentions in prose.

The desktop grid keeps a compact book navigation rail, approximately 720px reading column and margin region; index views can use more of the reading/margin space without widening long-form prose. Below 1280px navigation collapses above a clear single-column reading flow. Search starts within the current book where applicable and offers an explicit auxiliary-material toggle. Dialog controls and content must fit the viewport, restore focus on close, and remain usable by keyboard and at enlarged text sizes.

Controls use brief state feedback, with restrained entry/expansion treatment for native `details` and `dialog` elements. Respect `prefers-reduced-motion`; content, focus and control state must remain understandable without motion. Existing restrictions on unnecessary animation prohibit decorative or repeating loops, not short feedback that explains a user's action. This visual follow-up does not change ReaderCatalog, source content or publication permissions.

Typography hierarchy and interaction feedback take reference from the official [Apple MacBook Pro page](https://www.apple.com/macbook-pro/) and [Human Interface Guidelines: Motion](https://developer.apple.com/design/human-interface-guidelines/motion). This is a website-specific adaptation of those aspects, with its own typography, palette and graphics rather than copied trademark visuals. These are current design rules; successful acceptance or online publication must be established separately in validation.md.

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
