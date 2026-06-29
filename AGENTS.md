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

- **No shared source between the two packages.** `packages/player/src/` (Vue SFC) and `packages/react-player/src/` implement the same component independently. `types.ts` is duplicated verbatim in both. A change to shared props/types/behavior must be applied to **both** packages — and both test files (`test/MpegtsPlayer.spec.{ts,tsx}`), which are also mirrored.
- Versions are **lockstep**: root + both packages share one version. `release-it` bumps root, then `after:bump` sets the version in every `packages/*`.
- Peer deps (`vue`, `react`, `react-dom`, `mpegts.js`) are kept external via tsdown `neverBundle` — never bundle them into `dist`.
- Each package has an `@/*` → `./src/*` path alias (per-package `tsconfig.json`).
- `mpegts.js` touches `window` at import, so the components are **client-only**. In SSR frameworks wrap with `<ClientOnly>` (Nuxt) or `next/dynamic(..., { ssr: false })`.

## Build quirks

- tsdown emits **content-hashed** declaration files (e.g. `index-AbC123.d.ts`). `scripts/fix-dts.mjs` renames them to the stable `index.d.ts` / `index.d.cts` that `package.json` `exports` points at. Both packages run it after `tsdown`. If you change the build output naming, keep this rename step or the published `types` field breaks.
- The same script **copies the root `README.md` into each package dir** (gitignored) so `npm publish` ships it. The root README is the single source of truth — **do not edit `packages/*/README.md` directly**; they are regenerated each build.
- Vue package typechecks with `vue-tsc --noEmit`; React package with `tsc --noEmit`. The Vue build needs `unplugin-vue/rolldown` + `dts.vue: true` to compile the `.vue` SFC.

## Testing conventions

- vitest + jsdom. Specs live in each package's `test/` dir (`test/**/*.spec.ts` for Vue, `test/**/*.spec.{ts,tsx}` for React).
- **Always mock `mpegts.js`** with `vi.mock('mpegts.js', ...)`. Because it touches `window` and `vi.mock` is hoisted above imports, the mock factory + the `MockPlayer` recorder must be created inside `vi.hoisted(() => { ... })`. The recorder is the single source of truth assertions read against. Follow the existing `test/MpegtsPlayer.spec.ts` pattern exactly when adding tests.
- Several tests rely on `vi.useFakeTimers()` for the ~300 ms debounced player rebuild and reconnect backoff — advance timers explicitly.

## Release

`pnpm release` runs release-it (conventional-changelog, **angular** preset). It: typechecks+tests → prompts for version → bumps root → mirrors version into `packages/*` → regenerates `CHANGELOG.md` → commits, tags `v${version}`, pushes.

- **Conventional commits are required** (`feat:`, `fix:`, etc.) — the changelog is generated from them.
- `npm.publish` and `github.release` are both `false` in `.release-it.json`, and `.github/workflows/` is empty — **npm publishing is not automated in this repo.** Tagging/pushing is the end of `pnpm release`; publish separately if needed.

## Constraints worth knowing

- `enableWorker: true`, `enableStashBuffer: false`, `liveSyncTargetLatency: 0.5`, `reuseRedirectedURL: true` are the load-bearing low-latency defaults. `config` is **shallow-merged** over them (`{ ...DEFAULT_CONFIG, ...config }`) — passing `undefined` does not unset a default; omit the key.
- `hasAudio` / `hasVideo` default to `true` (not from mpegts.js) to avoid FLV header-flag false negatives dropping packets.
- The live auto-reconnect logic is owned by these wrappers (mpegts.js only auto-reconnects VOD). HTTP 4xx/5xx are treated as permanent and not retried.
