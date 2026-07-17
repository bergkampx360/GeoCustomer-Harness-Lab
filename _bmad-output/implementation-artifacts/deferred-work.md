# Deferred Work

## Deferred from: code review of story-1.1 (2026-07-13)

- No CI workflow / empty root `package.json` scripts — out of approved scope. CI/lint infrastructure was never part of the approved epics/stories plan (`epics.md`) or `docs/technical-constraints.md`; adding it now would be scope creep beyond the frozen assignment.
- `.gitignore`'s unanchored `dist`/`tmp`/`out-tsc` patterns match at any depth, not just expected build-output locations — deferred because this is Nx's own official generator default convention (used verbatim by nearly every Nx workspace) and the real risk is negligible in this specific small repo (no directories with those names exist or are planned outside build output).
- `pnpm-workspace.yaml` has no `packages:` key, so a future workspace package with its own `package.json` wouldn't be auto-recognized as a workspace member — deferred because this project's architecture (AD-2) explicitly commits to exactly one Nx project with no additional libs/packages; adding this key now would be future-proofing against a shape the architecture already rejected.
- `apps/api/tsconfig.app.json`'s `outDir` (`../../dist/out-tsc`) diverges from the `@nx/esbuild` executor's own `outputPath` (`dist/apps/api`) in `project.json` — deferred because only `tsc --noEmit` is ever invoked today (no consequence yet); fixing it now would mean guessing at a future build-pipeline shape not yet decided by any story.

## Deferred from: code review of story-1.2 (2026-07-13)

- No automated regression tests for `app.ts`/`server.ts`/`db/client.ts` — deferred because Vitest wiring is explicitly Story 1.5's job (AD-8 scopes it to pure domain logic, not infra/lifecycle code); consistent with Story 1.1's precedent.
- Race between an in-flight boot (`start()` still awaiting `prisma.customer.count()`/`app.listen()`) and an incoming `SIGINT`/`SIGTERM` — deferred as real but very low-probability and low-consequence for this project's actual usage; partially mitigated incidentally by the shutdown re-entrancy guard applied in this review, not fully solved.
- Driver-adapter/Docker portability (no `binaryTargets` declared for a Linux container target) unverified — deferred because no story in the approved plan containerizes the API itself; only PostgreSQL runs in Docker Compose (SPEC's own Assumption), and cloud deployment is explicitly excluded scope.

## Deferred from: code review of story-1.2 (2026-07-17, final pass)

- `server.ts` hardcodes `port: 3000` with no `PORT`/`API_PORT` environment override — deferred because no acceptance criterion or Dev Note requires port configurability for this story, and zero HTTP routes exist yet; real but low-consequence given this project's small scope.
- No process-level `unhandledRejection`/`uncaughtException` handlers beyond the explicit `SIGINT`/`SIGTERM` and `start()`/`shutdown()` try/catch blocks — deferred because AC4 only requires clean handling of `SIGINT`/`SIGTERM`, and this follows the same "no new shutdown abstraction, disproportionate for this project's scope" reasoning already applied to the declined watchdog timeout.
