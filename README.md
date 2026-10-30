# mpegts-vue3 / mpegts-react

[![npm version](https://img.shields.io/npm/v/mpegts-vue3.svg)](https://www.npmjs.com/package/mpegts-vue3)
[![npm downloads](https://img.shields.io/npm/dm/mpegts-vue3.svg)](https://www.npmjs.com/package/mpegts-vue3)
[![npm version](https://img.shields.io/npm/v/mpegts-react.svg)](https://www.npmjs.com/package/mpegts-react)
[![npm downloads](https://img.shields.io/npm/dm/mpegts-react.svg)](https://www.npmjs.com/package/mpegts-react)
[![license](https://img.shields.io/npm/l/mpegts-vue3.svg)](./LICENSE)

Vue 3 and React components for [mpegts.js](https://github.com/xqq/mpegts.js) video streaming player. Supports FLV live streams over HTTP/WebSocket with low-latency playback.

This monorepo contains two packages:

- **`mpegts-vue3`** — Vue 3 component (self-contained inline styles, zero CSS deps)
- **`mpegts-react`** — React 17+ component (inline styles, zero CSS dependency)

## Features

**Performance**
- Web Worker transmuxing on by default (`enableWorker`) — FLV remuxing off the main thread; the biggest lever for multi-view dashboards
- MSE-in-worker on by default (`enableWorkerForMSE`) — on Chromium 108+ the whole MediaSource pipeline (incl. `SourceBuffer` appends) runs in the worker too; capability is auto-detected and falls back to the main-thread engine everywhere else
- Low-latency live tuning out of the box (`enableStashBuffer: false`, `liveSyncMaxLatency: 0.7` / `liveSyncTargetLatency: 0.3`) — sub-second latency, measured p50 buffer latency 0.30 s (vs 0.71 s for the previous 1.2/0.5 defaults)
- CDN redirect reuse (`reuseRedirectedURL`) — reuses 301/302 across seek/reconnect, pure upside for HTTP live-FLV

**Resilience**
- Live auto-reconnect with exponential backoff — mpegts.js only auto-reconnects VOD; this wrapper owns live reconnect (emits `reconnecting`, skips permanent HTTP errors, and treats a server-closed live stream as retryable instead of freezing on the last frame)
- VOD early-EOF self-heal, surfaced via `onRecovered`

**Observability**
- Real-time telemetry: `onStatistics` (speed, dropped frames, fps ~every 600 ms) and `onMediaInfo` (resolution, codec, bitrate)

**Control**
- Imperative ref API — `play` / `pause` / `reload` / `seek` / volume / `getCurrentTime` / `getBufferedRanges` / `getStatistics`
- mpegts.js escape hatch — `getPlayer()` for the raw instance, plus a re-exported `Mpegts` namespace (`getFeatureList`, `isSupported`, `Events`)

**DX**
- Full TypeScript, dual ESM/CJS with type declarations, zero CSS dependencies (inline styles), transparent `config` passthrough

---

## Vue 3 (`mpegts-vue3`)

### Install

```bash
pnpm add mpegts-vue3 mpegts.js
```

`mpegts.js` and `vue` are peer dependencies and must be installed separately.

### Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { MpegtsPlayer } from 'mpegts-vue3'
import type { PlayerStatus } from 'mpegts-vue3'

const playerRef = ref()
</script>

<template>
  <MpegtsPlayer
    ref="playerRef"
    url="ws://host:port/live/stream.flv"
    :autoplay="true"
    :is-live="true"
    :muted="true"
    object-fit="fill"
    @status="(s: PlayerStatus) => console.log(s)"
    @error="(type, detail, info) => console.error(type, detail)"
    @statistics="(s) => console.log('speed KB/s:', s.speed)"
  />
</template>
```

### Styling

The Vue 3 component ships with self-contained inline styles (the spinner keyframe is injected once at runtime) — zero Tailwind or CSS setup required. Status overlays (connecting, reconnecting, playing, error, no-signal) render correctly in any project out of the box.

---

## React (`mpegts-react`)

### Install

```bash
pnpm add mpegts-react mpegts.js
```

`mpegts.js` and `react` are peer dependencies and must be installed separately.

### Usage

```tsx
import { useRef } from 'react'
import { MpegtsPlayer } from 'mpegts-react'
import type { MpegtsPlayerRef, PlayerStatus } from 'mpegts-react'

function App() {
  const ref = useRef<MpegtsPlayerRef>(null)

  return (
    <MpegtsPlayer
      ref={ref}
      url="ws://host:port/live/stream.flv"
      autoplay={true}
      isLive={true}
      muted={true}
      objectFit="fill"
      onStatus={(s: PlayerStatus) => console.log(s)}
      onError={(type, detail, info) => console.error(type, detail)}
      onStatistics={(s) => console.log('speed KB/s:', s.speed)}
    />
  )
}
```

### Styling

The React component uses inline styles — zero CSS dependency, works in any project.

---

## Shared Props API

Both Vue 3 and React components share the same props interface:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `url` | `string` | — | Stream URL (required, same as mpegts.js `MediaDataSource.url`) |
| `autoplay` | `boolean` | `true` | Auto-play on mount. Create-time only — toggling after mount has no effect. |
| `isLive` | `boolean` | `true` | Live stream mode |
| `muted` | `boolean` | `true` | Muted playback |
| `objectFit` | `'fill' \| 'contain' \| 'cover' \| 'none' \| 'scale-down'` | `'fill'` | Video element `object-fit` style |
| `type` | `string` | `'mse'` | Media type: `'mse'`, `'mpegts'`, `'m2ts'`, `'flv'`, `'mp4'` |
| `cors` | `boolean` | — | Enable CORS for HTTP fetching |
| `withCredentials` | `boolean` | — | HTTP fetching with cookies |
| `hasAudio` | `boolean` | `true` | Whether stream has audio track. Defaults to `true` to avoid audio packets being dropped for FLV streams (e.g. ZLMediaKit) whose header flag doesn't mark audio |
| `hasVideo` | `boolean` | `true` | Whether stream has video track. Defaults to `true` to avoid video packets being dropped for FLV streams (e.g. ZLMediaKit) whose header flag doesn't mark video — same rationale as `hasAudio`. Set `false` for audio-only streams. |
| `duration` | `number` | — | Total media duration in milliseconds |
| `filesize` | `number` | — | Total file size in bytes |
| `showLoading` | `boolean` | `true` | Show the "Connecting..." loading overlay (spinner + text) while connecting to the stream |
| `config` | `Partial<MpegtsConfig>` | `{}` | mpegts.js player config. See [mpegts.js API](https://github.com/xqq/mpegts.js/blob/master/docs/api.md) |
| `autoReconnect` | `boolean` | `true` | Auto-reconnect on transient live errors and on a server-closed live stream (mpegts.js only auto-reconnects VOD). Exponential backoff, unlimited attempts by default. |
| `reconnect` | `{ retries?, minDelay?, maxDelay? }` | `{ retries: Infinity, minDelay: 1000, maxDelay: 16000 }` | Reconnect backoff tuning (ms). delay = `min(maxDelay, minDelay * 2^attempt)`. Pass `retries` to cap the attempts (e.g. `{ retries: 5 }`). |

### Config merge

`config` is shallow-merged with the package's low-latency live defaults: `{ ...DEFAULT_CONFIG, ...config }`. Your `config` overrides matching top-level keys; keys you don't set keep their defaults. There is no way to "unset" a default by passing `undefined` — omit the key to keep the default, or pass an explicit value to override. `config` is treated as create-time: changing it after mount debounces a player rebuild (~300 ms). Notable defaults: **`enableWorker: true`** (transmuxing off the main thread — the biggest perf lever for multi-view; pass `false` under CSP/no-Worker constraints), **`enableWorkerForMSE: true`** (MSE pipeline in the worker on Chromium 108+, auto-falls-back elsewhere), `enableStashBuffer: false`, `liveSyncMaxLatency: 0.7` / `liveSyncTargetLatency: 0.3`, **`reuseRedirectedURL: true`** (reuse CDN 301/302 redirects across seek/reconnect — pure upside for HTTP live-FLV).

### Notes

- **Latency**: defaults (`enableStashBuffer: false`, `liveSyncMaxLatency: 0.7` / `liveSyncTargetLatency: 0.3`, `liveBufferLatencyChasing: true`) target sub-second live latency and converge to ~0.3–0.5 s of playback buffer. On lossy networks that headroom can cause stalls — raise `liveSyncMaxLatency` / `liveBufferLatencyMinRemain` or enable `enableStashBuffer` via `config` if you need stability over latency.
- **Auto-reconnect**: on transient live errors (`ConnectingTimeout`, `UnrecoverableEarlyEof`, `Exception`) **and** on a live stream the server closed cleanly (`LOADING_COMPLETE` — otherwise the picture would freeze on the last frame forever) the player retries with exponential backoff (1s→16s, unlimited attempts by default), emitting a `reconnecting` status. HTTP status errors (4xx/5xx) are **not** retried (permanent). Cap the attempts with `reconnect={{ retries: 5 }}`, or disable with `autoReconnect={false}`. VOD playback end is never retried.
- **Performance tuning**: `enableWorker: true` (transmuxing in a Web Worker) and `enableWorkerForMSE: true` (MSE pipeline — `MediaSource`/`SourceBuffer` appends — also in a worker on Chromium 108+, auto-detected, falls back elsewhere) are both on by default. Pass `config: { enableWorkerForMSE: false }` if you need the main-thread engine (e.g. debugging `SourceBuffer` state in the console). Statistics fire every `statisticsInfoReportInterval` (default 600 ms) — raise it under heavy multi-view to cut reactivity load, or use the `getStatistics()` ref method to pull on demand.
- **`type` and MSE**: types `mse` / `mpegts` / `m2ts` / `flv` route through mpegts.js's MSE path and require `MediaSource Extensions`. Any other `type` (e.g. `mp4`) uses native `<video>` playback and works on browsers without MSE (e.g. iOS Safari). FLV **cannot** play on MSE-less browsers — there is no software-decode fallback.
- **SSR / client-only**: the component imports `mpegts.js`, which touches `window` at module load, so it is **client-only**. In Nuxt wrap with `<ClientOnly>`; in Next.js use `next/dynamic(() => import(...), { ssr: false })`.

### Events / Callbacks

| Event | Payload | Description |
|-------|---------|-------------|
| `onStatus` / `@status` | `(status: PlayerStatus)` | Status change |
| `onError` / `@error` | `(errorType, errorDetail, errorInfo)` | Playback error |
| `onStatistics` / `@statistics` | `(info: StatisticsInfo)` | mpegts.js telemetry (speed KB/s, decoded/dropped frames, segment counts) every ~600 ms |
| `onMediaInfo` / `@mediaInfo` | `(info: MediaInfo)` | Resolved media info (resolution, fps, codecs, bitrate) — fires once when known |
| `onRecovered` / `@recovered` | `()` | Stream self-healed after an early-EOF (mpegts.js internal VOD reconnect) |
| `onEnded` / `@ended` | `()` | Stream reached end-of-stream (`LOADING_COMPLETE`): VOD finished, or a live stream the server closed (live also auto-reconnects afterwards when `autoReconnect` is on) |

### Ref Methods

| Method | Description |
|--------|-------------|
| `play()` | Resume playback |
| `pause()` | Pause playback |
| `reload()` | Destroy and recreate the player — reconnects to the current `url`/`config`. Use to recover from stalls. |
| `setMuted(muted: boolean)` | Imperatively mute/unmute the underlying `<video>` element without re-rendering. |
| `getPlayer()` | Returns the underlying `mpegts.js` `Player` instance (or `null`) as an escape hatch for advanced APIs (statistics, buffered ranges, custom events). |
| `getVolume()` / `setVolume(v)` | Get/set the underlying `<video>` volume (`0`–`1`) imperatively, without re-rendering. |
| `seek(seconds)` | Seek — routes through mpegts.js so it range-loads the right segment (don't assign `<video>.currentTime` directly for VOD). |
| `getCurrentTime()` | Current playback position in seconds. |
| `getBufferedRanges()` | The `<video>` `TimeRanges` that have been downloaded/buffered. |
| `getStatistics()` | Pull mpegts.js telemetry on demand (same shape as `onStatistics`) — for overlays that only show stats when visible. |

### PlayerStatus Type

```ts
type PlayerStatus =
  | 'connecting'   // Connecting to stream
  | 'reconnecting' // Auto-reconnecting after a transient network error
  | 'error'        // Playback error (terminal: retries exhausted or non-recoverable)
  | 'nosignal'     // No signal / no url
  | 'playing'      // Playing
  | 'stopped'      // Paused / stopped
```

## Demo

To run locally:

```bash
pnpm install

# Vue 3 demo
pnpm dev

# React 17 demo
pnpm dev:react
```

## Development

```bash
pnpm install

# Build all packages
pnpm build

# Build Vue 3 package only
pnpm -C packages/player build

# Build React package only
pnpm -C packages/react-player build
```

## Publishing

Releases are managed via [release-it](https://github.com/release-it/release-it) with auto-generated CHANGELOG from conventional commits:

```bash
pnpm release
```

This will:

1. Prompt to select version (patch / minor / major)
2. Auto-generate `CHANGELOG.md` from git log
3. Update version in all `package.json` files
4. Commit, tag (`v${version}`), and push

GitHub Actions will then detect the tag and publish to npm automatically.

## Tech Stack

- [Vue 3](https://vuejs.org/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [mpegts.js](https://github.com/xqq/mpegts.js) — FLV over HTTP/WebSocket playback
- [tsdown](https://tsdown.dev/) — Library bundler powered by Rolldown
- [release-it](https://github.com/release-it/release-it) — Automated versioning and changelog

## License

MIT
