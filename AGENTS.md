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
