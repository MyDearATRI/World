# Content contract

This document was created for the approved synthetic-content phase. It is the contract for the sample input and its rendering, not permission to access or publish real Vault content.

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
