# Website implementation rules

These rules supplement the repository-root instructions and apply only inside `website/`.

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
