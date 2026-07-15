# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-13)

- No CI workflow / empty root `package.json` scripts — out of approved scope. CI/lint infrastructure was never part of the approved epics/stories plan (`epics.md`) or `docs/technical-constraints.md`; adding it now would be scope creep beyond the frozen assignment.
- `.gitignore`'s unanchored `dist`/`tmp`/`out-tsc` patterns match at any depth, not just expected build-output locations — deferred because this is Nx's own official generator default convention (used verbatim by nearly every Nx workspace) and the real risk is negligible in this specific small repo (no directories with those names exist or are planned outside build output).
- `pnpm-workspace.yaml` has no `packages:` key, so a future workspace package with its own `package.json` wouldn't be auto-recognized as a workspace member — deferred because this project's architecture (AD-2) explicitly commits to exactly one Nx project with no additional libs/packages; adding this key now would be future-proofing against a shape the architecture already rejected.
- `apps/api/tsconfig.app.json`'s `outDir` (`../../dist/out-tsc`) diverges from the `@nx/esbuild` executor's own `outputPath` (`dist/apps/api`) in `project.json` — deferred because only `tsc --noEmit` is ever invoked today (no consequence yet); fixing it now would mean guessing at a future build-pipeline shape not yet decided by any story.
