# mpegts-vue3

A Vue 3 component for [mpegts.js](https://github.com/nicedreams/mpegts.js) video streaming player. Supports FLV live streams over HTTP/WebSocket with low-latency playback.

## Features

- Vue 3 Composition API with full TypeScript support
- Low-latency live stream playback optimized via mpegts.js MSE
- Auto-play with muted fallback
- Status overlay states: connecting, playing, error, no signal
- Exposed `play()` / `pause()` methods for programmatic control
- ESM + CJS dual format with type declarations

## Install

```bash
pnpm add mpegts-vue3 mpegts.js
```

`mpegts.js` and `vue` are peer dependencies and must be installed separately.

## Usage

```vue
<script setup lang="ts">
import { MpegtsPlayer } from 'mpegts-vue3'
import type { PlayerStatus } from 'mpegts-vue3'
</script>

<template>
  <MpegtsPlayer
    src="ws://host:port/live/stream.flv"
    :autoplay="true"
    :is-live="true"
    :muted="true"
    @status="(s: PlayerStatus) => console.log(s)"
    @error="(type, detail, info) => console.error(type, detail)"
  />
</template>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | — | Stream URL (required) |
| `autoplay` | `boolean` | `true` | Auto-play on mount |
| `isLive` | `boolean` | `true` | Live stream mode |
| `muted` | `boolean` | `true` | Muted playback |
| `config` | `Partial<MpegtsConfig>` | `{}` | mpegts.js player config, overrides defaults. See [mpegts.js API](https://github.com/xqq/mpegts.js/blob/master/docs/api.md) |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `status` | `(status: PlayerStatus)` | Emitted on status change |
| `error` | `(errorType, errorDetail, errorInfo)` | Emitted on playback error |

### Exposed Methods

| Method | Description |
|--------|-------------|
| `play()` | Resume playback |
| `pause()` | Pause playback |

### PlayerStatus Type

```ts
type PlayerStatus =
  | 'connecting'  // Connecting to stream
  | 'destroying'  // Destroying player instance
  | 'error'       // Playback error
  | 'nosignal'    // No signal / no src
  | 'playing'     // Playing
  | 'stopped'     // Paused / stopped
```

## Tailwind CSS

This component uses [Tailwind CSS](https://tailwindcss.com/) utility classes for styling. If your project uses Tailwind CSS v4, add the following to your main CSS file to include the component's classes:

```css
@import 'tailwindcss';
@source 'node_modules/mpegts-vue3/dist/**/*.js';
```

If you're not using Tailwind, the component will still render — just without the overlay styling (connecting spinner, error icon, etc.).

## Demo

A live demo is available at [GitHub Pages](https://your-username.github.io/mpegts-vue3/).

To run locally:

```bash
pnpm install
pnpm dev
```

## Development

```bash
# Install dependencies
pnpm install

# Build the library
pnpm -C packages/player build

# Build the demo
pnpm -C apps/demo build

# Run demo dev server
pnpm dev
```

## Publishing

The package is published automatically via GitHub Actions when a version tag is pushed:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Manual publish is also available via the `Publish to npm` workflow with a dry-run option.

## Tech Stack

- [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- [mpegts.js](https://github.com/nicedreams/mpegts.js) — FLV over HTTP/WebSocket playback
- [tsdown](https://tsdown.dev/) — Library bundler powered by Rolldown
- [Tailwind CSS v4](https://tailwindcss.com/) — Utility-first CSS
- [antdv-next](https://antdv-next.com/) + [lucide-vue-next](https://lucide.dev/) — Demo UI

## License

MIT
