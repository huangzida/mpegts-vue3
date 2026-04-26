# mpegts-vue3 NPM Package Design

## Overview

Migrate the `MpegtsPlayer.vue` component from `api-admin/apps/gateway` into a standalone npm package called `mpegts-vue3`, with a demo site deployed to GitHub Pages and automated CI/CD via GitHub Actions.

## Tech Stack

- **Build**: Vite + tsdown
- **Framework**: Vue 3 + TypeScript
- **Package Manager**: pnpm (workspace monorepo)
- **Styling**: Tailwind CSS v4
- **UI Library (demo only)**: antdv-next
- **Icons (demo only)**: lucide-vue-next

## Project Structure

```
mpegts-vue3/
├── packages/
│   └── player/                  # npm package: mpegts-vue3
│       ├── src/
│       │   ├── index.ts         # exports
│       │   ├── components/
│       │   │   └── MpegtsPlayer.vue
│       │   └── types.ts
│       ├── package.json
│       └── tsdown.config.ts
├── apps/
│   └── demo/                    # GitHub Pages demo site
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.ts
│       │   └── style.css
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/
        ├── publish.yml          # tag → npmjs publish
        └── pages.yml            # push main → GitHub Pages
```

## Package Design (packages/player)

### Exports

- `MpegtsPlayer` Vue component (default export)
- `PlayerStatus` type: `'connecting' | 'destroying' | 'error' | 'nosignal' | 'playing' | 'stopped'`

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| src | string | - | Stream URL |
| autoplay | boolean | true | Auto-play on mount |
| isLive | boolean | true | Live stream mode |
| muted | boolean | true | Muted playback |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| error | (errorType, errorDetail, errorInfo) | Playback error |
| status | (status: PlayerStatus) | Status change |

### Exposed Methods

- `play()` — Resume playback
- `pause()` — Pause playback

### Dependencies

- `mpegts.js` as `peerDependencies` (user installs separately)
- `vue` as `peerDependencies`

### Build

- tsdown outputs ESM + CJS + type declarations
- No external CSS — uses Tailwind utility classes inline

## Demo Site (apps/demo)

### Migration from index.vue

| Source | Target | Change |
|--------|--------|--------|
| `Page` from `@vben/common-ui` | Plain `<div>` container | Remove vben dependency |
| `Monitor` from `@vben/icons` | `Monitor` from `lucide-vue-next` | Icon library swap |
| Inline SVG (nosignal) | `VideoOff` from `lucide-vue-next` | Icon library swap |
| Inline SVG (error) | `AlertTriangle` from `lucide-vue-next` | Icon library swap |
| `Input`, `Slider`, `Switch` from antdv-next | Same components | Keep as-is |
| `MpegtsPlayer` local import | `mpegts-vue3` package import | Use published package |

### Build & Deploy

- Vite builds static SPA to `dist/`
- GitHub Actions deploys to GitHub Pages on push to `main`

## CI/CD

### publish.yml (npm publish)

- **Trigger**: Push tag `v*.*.*` + `workflow_dispatch` (manual)
- **Steps**: Checkout → pnpm install → build package → npm publish
- **Environment**: Uses `NPM_TOKEN` secret

### pages.yml (GitHub Pages)

- **Trigger**: Push to `main` branch
- **Steps**: Checkout → pnpm install → build demo → deploy to GitHub Pages
- **Permissions**: `contents: read`, `pages: write`, `id-token: write`
