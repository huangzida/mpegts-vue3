# Shared PlayerEngine core for both player packages

Both published components (`mpegts-vue3`, `mpegts-react`) had drifted into hand-maintaining ~60% identical mpegts.js logic (config merge, MSE gate, generation guard, 重建 debounce, Live 重连 backoff, event mapping, autoplay fallback, destroy sequence), and had already diverged in observable behavior — only Vue had the 300 ms rebuild debounce, and AGENTS.md still described the debounce as a shared trait. We reversed the earlier "no shared source between the two packages" convention: a private workspace package `packages/core` now owns a framework-agnostic `createPlayerEngine()` (see `CONTEXT.md` "PlayerEngine"), and the Vue/React components are thin adapters whose public contracts (props, emits/callbacks, ref methods, exported type names) are frozen byte-for-byte. Considered and rejected: publishing the engine as a third package (no consumer needs it), transport-registry/hooks extension seams (single-adapter seams — the mpegts.js port with its test MockPlayer is the only seam with two real adapters).

## Consequences

- `packages/core` is `private` and never published; it is bundled into each player's `dist` via relative source imports (it is deliberately absent from tsdown `neverBundle`, and deliberately NOT a workspace dependency, so no `mpegts-core` entry pollutes the published manifests).
- Rebuild policy is an engine option (`rebuild: { debounceMs } | false`, default 300 ms) instead of per-adapter folklore; behavioural tests live once in `packages/core/test`, adapters keep only wiring smoke tests.
- The engine stays framework-free and client-only: `mpegts.js` is imported at runtime in exactly one file (`src/factory.ts`), which is also the injected port used by tests.
