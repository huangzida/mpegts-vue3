# AGENTS.md

pnpm monorepo publishing two independent mpegts.js player components: `mpegts-vue3` (Vue 3) and `mpegts-react` (React 17+). `packages/*` are the publishable libs; `apps/*` are private dev demos.

## Commands

Run from repo root unless noted. `pnpm` recurses with `-r`; target one package with `-C <pkg>`.

| Task | Command |
|------|---------|
| Install | `pnpm install` |
| Build all packages | `pnpm build` |
| Build one package | `pnpm -C packages/player build` (or `packages/react-player`) |
| Typecheck all | `pnpm typecheck` |
| Test all | `pnpm test` |
| Test one package | `pnpm -C packages/player test` |
| **Single test file** | `pnpm -C packages/player exec vitest run test/MpegtsPlayer.spec.ts` |
| Vue demo dev server | `pnpm dev` |
| React demo dev server | `pnpm dev:react` |
| Release | `pnpm release` (see Release below) |

Required order for any change you intend to ship: **typecheck → test → build**. `release-it` enforces `typecheck && test` in `before:init`.

Requires **Node >=18** and **pnpm@9.15.4** (`packageManager` is pinned).

## Architecture

- **One engine, two thin adapters** (ADR-0001, supersedes the old "no shared source" rule). `packages/core` (private, never published) owns `createPlayerEngine()`: the entire framework-agnostic lifecycle — config merge, MSE gate, generation guard, 重建 debounce (`rebuild` option, default 300 ms), Live 重连, event mapping, autoplay fallback, destroy sequence. `packages/player/src/` (Vue SFC) and `packages/react-player/src/` are adapters: props → `engine.update()`, engine handlers → emits/callbacks, ref → engine delegation. Their public contracts (props, emits/callbacks, ref methods, exported type names — `types.ts` re-exports them from core) are **frozen**; behavioural changes go in `packages/core`, never duplicated per adapter. See `CONTEXT.md` for domain vocabulary.
- Versions are **lockstep**: root + both packages share one version. `release-it` bumps root, then `after:bump` sets the version in every `packages/*`.
- Peer deps (`vue`, `react`, `react-dom`, `mpegts.js`) are kept external via tsdown `neverBundle` — never bundle them into `dist`. `packages/core` is the opposite: it is **bundled into each player's `dist`** via relative source imports (deliberately not in `neverBundle`, deliberately not a workspace dependency, so no `mpegts-core` entry appears in the published manifests).
- Each package has an `@/*` → `./src/*` path alias (per-package `tsconfig.json`).
- `mpegts.js` touches `window` at import, so the components are **client-only**. In SSR frameworks wrap with `<ClientOnly>` (Nuxt) or `next/dynamic(..., { ssr: false })`.

## Build quirks

- tsdown emits **content-hashed** declaration files (e.g. `index-AbC123.d.ts`). `scripts/fix-dts.mjs` renames them to the stable `index.d.ts` / `index.d.cts` that `package.json` `exports` points at. Both packages run it after `tsdown`. If you change the build output naming, keep this rename step or the published `types` field breaks.
- The same script **copies the root `README.md` into each package dir** (gitignored) so `npm publish` ships it. The root README is the single source of truth — **do not edit `packages/*/README.md` directly**; they are regenerated each build.
- Vue package typechecks with `vue-tsc --noEmit`; React package with `tsc --noEmit`. The Vue build needs `unplugin-vue/rolldown` + `dts.vue: true` to compile the `.vue` SFC.

## Testing conventions

- vitest + jsdom. Behavioural coverage lives **once** in `packages/core/test/engine.spec.ts` (pure DI — pass `createMockFactory()` from `src/testing.ts`, no module mocking). Adapter specs in each package's `test/` dir only pin the wiring (props in, emits/callbacks/ref out).
- Adapter specs mock `mpegts.js` with the **shared harness**: `vi.mock('mpegts.js', async () => (await import('../../core/src/testing')).mockMpegtsModule())`. The `MockPlayer` + `recorder` live in `packages/core/src/testing.ts` (the recorder is the single source of truth assertions read against). The dynamic import inside the factory is required — `vi.mock` factories are hoisted above static imports. No `vi.hoisted` anywhere anymore.
- Engine tests rely on `vi.useFakeTimers()` for the 重建 debounce and reconnect backoff — advance timers explicitly (`await vi.advanceTimersByTimeAsync(300)`).

## Release

`pnpm release` runs release-it (conventional-changelog, **angular** preset). It: typechecks+tests → prompts for version → bumps root → mirrors version into `packages/*` → regenerates `CHANGELOG.md` → commits, tags `v${version}`, pushes.

- **Conventional commits are required** (`feat:`, `fix:`, etc.) — the changelog is generated from them.
- `npm.publish` and `github.release` are both `false` in `.release-it.json`, and `.github/workflows/` is empty — **npm publishing is not automated in this repo.** Tagging/pushing is the end of `pnpm release`; publish separately if needed.

## Constraints worth knowing

- `enableWorker: true`, `enableWorkerForMSE: true`, `enableStashBuffer: false`, `liveSyncMaxLatency: 0.7` / `liveSyncTargetLatency: 0.3`, `reuseRedirectedURL: true` are the load-bearing low-latency defaults. `config` is **shallow-merged** over them (`{ ...DEFAULT_CONFIG, ...config }`) — passing `undefined` does not unset a default; omit the key.
- `hasAudio` / `hasVideo` default to `true` (not from mpegts.js) to avoid FLV header-flag false negatives dropping packets.
- The live auto-reconnect logic is owned by these wrappers (mpegts.js only auto-reconnects VOD). HTTP 4xx/5xx are treated as permanent and not retried; retries are unlimited by default (1s→16s backoff) and a cleanly closed live stream (`LOADING_COMPLETE`) is retried too — VOD end is not.
