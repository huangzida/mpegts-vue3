# mpegts-vue3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone npm package `mpegts-vue3` (Vue 3 mpegts.js player component) with a demo site, automated npm publishing via GitHub Actions, and GitHub Pages deployment.

**Architecture:** pnpm monorepo with `packages/player` (the npm library built with tsdown) and `apps/demo` (a Vite SPA). GitHub Actions handle npm publish on tag and GitHub Pages on push to main.

**Tech Stack:** Vite, Vue 3, TypeScript, pnpm workspaces, Tailwind CSS v4, tsdown, antdv-next (demo), lucide-vue-next (demo)

---

## File Structure

```
mpegts-vue3/
├── packages/
│   └── player/
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts
│       │   └── components/
│       │       └── MpegtsPlayer.vue
│       ├── package.json
│       ├── tsconfig.json
│       └── tsdown.config.ts
├── apps/
│   └── demo/
│       ├── src/
│       │   ├── App.vue
│       │   ├── main.ts
│       │   └── style.css
│       ├── index.html
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.json
├── .gitignore
└── .github/
    └── workflows/
        ├── publish.yml
        └── pages.yml
```

---

### Task 1: Initialize pnpm monorepo root

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "mpegts-vue3-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -C apps/demo dev",
    "lint": "echo \"no linter configured\""
  },
  "engines": {
    "node": ">=18"
  },
  "packageManager": "pnpm@9.15.4"
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

- [ ] **Step 3: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create .gitignore**

```
node_modules
dist
*.local
.DS_Store
*.log
```

- [ ] **Step 5: Initialize git and commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git init
git add package.json pnpm-workspace.yaml tsconfig.json .gitignore
git commit -m "chore: init monorepo root"
```

---

### Task 2: Create packages/player — npm package scaffolding

**Files:**
- Create: `packages/player/package.json`
- Create: `packages/player/tsconfig.json`
- Create: `packages/player/tsdown.config.ts`
- Create: `packages/player/src/types.ts`

- [ ] **Step 1: Create packages/player/package.json**

```json
{
  "name": "mpegts-vue3",
  "version": "0.1.0",
  "type": "module",
  "description": "Vue 3 component for mpegts.js video streaming player",
  "keywords": ["vue", "vue3", "mpegts", "flv", "live-streaming", "player"],
  "license": "MIT",
  "author": "",
  "repository": {
    "type": "git",
    "url": ""
  },
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "peerDependencies": {
    "mpegts.js": "^1.8.0",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "mpegts.js": "^1.8.0",
    "tsdown": "^0.12.0",
    "typescript": "^5.8.0",
    "vue": "^3.5.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Create packages/player/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create packages/player/tsdown.config.ts**

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['./src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { vue: true },
  clean: true,
  deps: {
    neverBundle: ['vue', 'mpegts.js'],
  },
})
```

- [ ] **Step 4: Create packages/player/src/types.ts**

```ts
export type PlayerStatus =
  | 'connecting'
  | 'destroying'
  | 'error'
  | 'nosignal'
  | 'playing'
  | 'stopped'
```

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add packages/player/
git commit -m "chore: scaffold player package"
```

---

### Task 3: Create MpegtsPlayer component

**Files:**
- Create: `packages/player/src/components/MpegtsPlayer.vue`
- Create: `packages/player/src/index.ts`

- [ ] **Step 1: Create MpegtsPlayer.vue**

Migrate from source, replacing nothing — the original uses only Tailwind classes and mpegts.js (already a peer dep). Keep identical logic.

```vue
<script setup lang="ts">
import type { Ref } from 'vue';

import { onMounted, onUnmounted, ref, watch } from 'vue';

import Mpegts from 'mpegts.js';

import type { PlayerStatus } from '../types';

interface Props {
  src: string;
  autoplay?: boolean;
  isLive?: boolean;
  muted?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  isLive: true,
  muted: true,
});

const emit = defineEmits<{
  error: [errorType: string, errorDetail: string, errorInfo: any];
  status: [status: PlayerStatus];
}>();

const videoRef = ref<HTMLVideoElement>() as Ref<HTMLVideoElement>;
const status = ref<PlayerStatus>('nosignal');
let player: Mpegts.Player | null = null;

function destroyPlayer() {
  if (!player) return;
  status.value = 'destroying';
  try {
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
  } catch {
    // ignore cleanup errors
  }
  player = null;
  status.value = 'nosignal';
}

function play() {
  if (!player) return;
  videoRef.value.muted = props.muted;
  const result = player.play();
  if (result instanceof Promise) {
    result
      .then(() => {
        status.value = 'playing';
        emit('status', 'playing');
      })
      .catch(() => {
        status.value = 'stopped';
        emit('status', 'stopped');
      });
  } else {
    status.value = 'playing';
    emit('status', 'playing');
  }
}

function pause() {
  if (!player) return;
  player.pause();
  status.value = 'stopped';
  emit('status', 'stopped');
}

defineExpose({ play, pause });

function createPlayer(url: string) {
  destroyPlayer();

  if (!url || !videoRef.value) return;
  if (!Mpegts.isSupported()) {
    status.value = 'error';
    emit('status', 'error');
    return;
  }

  status.value = 'connecting';
  emit('status', 'connecting');

  player = Mpegts.createPlayer(
    {
      type: 'mse',
      isLive: props.isLive,
      url,
    },
    {
      enableStashBuffer: false,
      liveBufferLatencyChasing: true,
      liveBufferLatencyChasingOnPaused: true,
      liveBufferLatencyMaxLatency: 1.5,
      liveBufferLatencyMinRemain: 0.3,
      liveSync: true,
      liveSyncMaxLatency: 1.2,
      liveSyncTargetLatency: 0.5,
      autoCleanupSourceBuffer: true,
      autoCleanupMaxBackwardDuration: 30,
      autoCleanupMinBackwardDuration: 10,
      fixAudioTimestampGap: true,
    },
  );

  player.attachMediaElement(videoRef.value);

  player.on(
    Mpegts.Events.ERROR,
    (errorType: string, errorDetail: string, errorInfo: any) => {
      status.value = 'error';
      emit('status', 'error');
      emit('error', errorType, errorDetail, errorInfo);
    },
  );

  player.load();

  if (props.autoplay) {
    videoRef.value.muted = props.muted;
    const result = player.play();
    if (result instanceof Promise) {
      result
        .then(() => {
          status.value = 'playing';
          emit('status', 'playing');
        })
        .catch(() => {
          status.value = 'stopped';
          emit('status', 'stopped');
        });
    } else {
      status.value = 'playing';
      emit('status', 'playing');
    }
  }
}

watch(
  () => props.src,
  (newSrc) => {
    if (newSrc) {
      createPlayer(newSrc);
    } else {
      destroyPlayer();
      status.value = 'nosignal';
      emit('status', 'nosignal');
    }
  },
);

onMounted(() => {
  if (props.src) {
    createPlayer(props.src);
  }
});

watch(
  () => props.muted,
  (val) => {
    if (videoRef.value) {
      videoRef.value.muted = val;
    }
  },
);

onUnmounted(() => {
  destroyPlayer();
});
</script>

<template>
  <div class="relative w-full h-full bg-black rounded-lg overflow-hidden">
    <video
      ref="videoRef"
      class="absolute inset-0 w-full h-full object-contain"
      @click.prevent
      @contextmenu.prevent
    ></video>
    <div
      v-if="status === 'nosignal' || !src"
      class="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90"
    >
      <div class="mb-3 flex items-center gap-2 text-gray-400">
        <svg
          class="size-10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M18 12 6 12M18 8 6 8M18 16l-12 0"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
      <span class="text-sm font-medium text-gray-400 tracking-wider uppercase">
        No Signal
      </span>
    </div>
    <div
      v-if="status === 'connecting'"
      class="absolute inset-0 flex items-center justify-center bg-black/60"
    >
      <div class="flex flex-col items-center gap-3">
        <div
          class="size-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"
        ></div>
        <span class="text-sm text-gray-300">Connecting...</span>
      </div>
    </div>
    <div
      v-if="status === 'error' && src"
      class="absolute inset-0 flex items-center justify-center bg-black/60"
    >
      <div class="flex flex-col items-center gap-2">
        <svg
          class="size-8 text-red-400"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="text-sm text-red-400">Connection Failed</span>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Create packages/player/src/index.ts**

```ts
export { default as MpegtsPlayer } from './components/MpegtsPlayer.vue'
export type { PlayerStatus } from './types'
```

- [ ] **Step 3: Install dependencies and build**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
pnpm install
cd packages/player && pnpm build
```

Expected: `dist/` folder with `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add packages/player/src/
git commit -m "feat: add MpegtsPlayer component and package exports"
```

---

### Task 4: Create apps/demo — demo site scaffolding

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/index.html`
- Create: `apps/demo/src/main.ts`
- Create: `apps/demo/src/style.css`

- [ ] **Step 1: Create apps/demo/package.json**

```json
{
  "name": "@mpegts-vue3/demo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "antdv-next": "^1.1.6",
    "lucide-vue-next": "^0.504.0",
    "mpegts-vue3": "workspace:*",
    "mpegts.js": "^1.8.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.2.2",
    "@vitejs/plugin-vue": "^5.2.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Create apps/demo/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "env.d.ts"]
}
```

- [ ] **Step 3: Create apps/demo/env.d.ts**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: Create apps/demo/vite.config.ts**

```ts
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/mpegts-vue3/',
})
```

- [ ] **Step 5: Create apps/demo/index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>mpegts-vue3 Demo</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create apps/demo/src/main.ts**

```ts
import { createApp } from 'vue'

import App from './App.vue'
import './style.css'

createApp(App).mount('#app')
```

- [ ] **Step 7: Create apps/demo/src/style.css**

```css
@import 'tailwindcss';
```

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add apps/demo/
git commit -m "chore: scaffold demo app"
```

---

### Task 5: Create App.vue — migrate demo page

**Files:**
- Create: `apps/demo/src/App.vue`

- [ ] **Step 1: Create App.vue**

Migrated from source `index.vue`:
- Replace `Page` from `@vben/common-ui` → `<div>` container
- Replace `Monitor` from `@vben/icons` → `Monitor` from `lucide-vue-next`
- Replace inline SVG nosignal → `VideoOff` from `lucide-vue-next`
- Replace inline SVG error → `AlertTriangle` from `lucide-vue-next`
- Import `MpegtsPlayer` from `mpegts-vue3` package
- Keep `antdv-next` `Input`, `Slider`, `Switch`
- English text instead of Chinese (international package)

```vue
<script setup lang="ts">
import { computed, ref, shallowReactive } from 'vue';

import { AlertTriangle, Monitor, VideoOff } from 'lucide-vue-next';

import { Input, Slider, Switch } from 'antdv-next';

import { MpegtsPlayer } from 'mpegts-vue3';
import type { PlayerStatus } from 'mpegts-vue3';

type GridLayout = 1 | 4 | 9;

const DEFAULT_URL = 'ws://192.168.100.94:15354/live/chn1.flv';

const gridLayout = ref<GridLayout>(1);
const muted = ref(true);
const inputUrl = ref(DEFAULT_URL);

const presets = [
  { label: 'Channel 1', url: 'ws://192.168.100.94:15354/live/chn1.flv' },
  { label: 'Channel 2', url: 'ws://192.168.100.94:15354/live/chn2.flv' },
];

const gridSlots = computed(() => {
  return Array.from({ length: gridLayout.value }, (_, i) => ({
    id: i,
  }));
});

const playerRefs = ref<Record<number, InstanceType<typeof MpegtsPlayer>>>({});
const playerStatuses = ref<Record<number, PlayerStatus>>({});

const activePlayerStatus = computed<PlayerStatus>(() => {
  if (gridLayout.value === 1) {
    return playerStatuses.value[0] ?? 'nosignal';
  }
  return 'playing';
});

const statusColor = computed(() => {
  const map: Record<PlayerStatus, string> = {
    connecting: 'text-yellow-500',
    destroying: 'text-gray-400',
    error: 'text-red-500',
    nosignal: 'text-gray-400',
    playing: 'text-green-500',
    stopped: 'text-gray-400',
  };
  return map[activePlayerStatus.value];
});

const statusText = computed(() => {
  const map: Record<PlayerStatus, string> = {
    connecting: 'Connecting',
    destroying: 'Destroying',
    error: 'Error',
    nosignal: 'No Signal',
    playing: 'Playing',
    stopped: 'Stopped',
  };
  return map[activePlayerStatus.value];
});

const config = shallowReactive({
  enableStashBuffer: false,
  stashInitialSize: 384,
  liveBufferLatencyChasing: true,
  liveBufferLatencyChasingOnPaused: true,
  liveBufferLatencyMaxLatency: 1.5,
  liveBufferLatencyMinRemain: 0.3,
  liveSync: true,
  liveSyncMaxLatency: 1.2,
  liveSyncTargetLatency: 0.5,
  autoCleanupSourceBuffer: true,
  autoCleanupMaxBackwardDuration: 30,
  autoCleanupMinBackwardDuration: 10,
  fixAudioTimestampGap: true,
});

function applyUrl() {
  inputUrl.value = inputUrl.value.trim();
}

function setPreset(url: string) {
  inputUrl.value = url;
}

function onPlayerStatus(index: number, s: PlayerStatus) {
  playerStatuses.value[index] = s;
}

function playAll() {
  for (const r of Object.values(playerRefs.value)) {
    r?.play();
  }
}

function pauseAll() {
  for (const r of Object.values(playerRefs.value)) {
    r?.pause();
  }
}

function setPlayerRef(
  index: number,
  el: InstanceType<typeof MpegtsPlayer> | null,
) {
  if (el) {
    playerRefs.value[index] = el;
  } else {
    delete playerRefs.value[index];
  }
}

const gridColsClass = computed(() => {
  if (gridLayout.value === 9) return 'grid-cols-3';
  if (gridLayout.value === 4) return 'grid-cols-2';
  return 'grid-cols-1';
});
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-white p-6">
    <div class="mx-auto max-w-7xl flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Monitor class="size-6 text-blue-500" />
          <h2 class="m-0 text-lg font-semibold">Video Player Debug</h2>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Status:</span>
            <span class="text-sm font-medium" :class="statusColor">
              {{ statusText }}
            </span>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div class="xl:col-span-2">
          <div class="mb-3 flex items-center gap-2">
            <span class="text-xs text-gray-400">Windows:</span>
            <button
              v-for="layout in [1, 4, 9] as GridLayout[]"
              :key="layout"
              class="rounded border px-2 py-1 text-xs transition-colors"
              :class="
                gridLayout === layout
                  ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                  : 'border-gray-700 hover:border-blue-500 hover:text-blue-500'
              "
              @click="gridLayout = layout"
            >
              {{ layout }} Window{{ layout > 1 ? 's' : '' }}
            </button>
            <div class="ml-auto flex gap-2">
              <button
                class="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                @click="playAll"
              >
                Play All
              </button>
              <button
                class="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                @click="pauseAll"
              >
                Pause All
              </button>
            </div>
          </div>

          <div
            v-if="gridLayout === 1"
            class="aspect-video w-full rounded-lg border border-gray-700 bg-black shadow-sm"
          >
            <MpegtsPlayer
              :ref="(el: any) => setPlayerRef(0, el)"
              :src="inputUrl"
              :muted="muted"
              @status="(s: PlayerStatus) => onPlayerStatus(0, s)"
            />
          </div>

          <div v-else class="grid w-full gap-2" :class="gridColsClass">
            <div
              v-for="slot in gridSlots"
              :key="slot.id"
              class="aspect-video rounded-lg border border-gray-700 bg-black shadow-sm"
            >
              <MpegtsPlayer
                :ref="(el: any) => setPlayerRef(slot.id, el)"
                :src="inputUrl"
                :muted="muted"
                @status="(s: PlayerStatus) => onPlayerStatus(slot.id, s)"
              />
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">Stream URL</h3>
            <div class="flex gap-2">
              <Input
                v-model:value="inputUrl"
                placeholder="ws://host:port/live/stream.flv"
                class="flex-1"
                size="small"
                @press-enter="applyUrl"
              />
              <button
                class="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                @click="applyUrl"
              >
                Apply
              </button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <button
                v-for="preset in presets"
                :key="preset.label"
                class="rounded border border-gray-700 px-2 py-1 text-xs transition-colors hover:border-blue-500 hover:text-blue-500"
                :class="{
                  'border-blue-500 text-blue-500': inputUrl === preset.url,
                }"
                @click="setPreset(preset.url)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">Playback Control</h3>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">Muted</span>
                <Switch v-model:checked="muted" size="small" />
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                  @click="playAll"
                >
                  Play
                </button>
                <button
                  class="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                  @click="pauseAll"
                >
                  Pause
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">Live Parameters</h3>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Enable IO Buffer (enableStashBuffer)
                </span>
                <Switch
                  v-model:checked="config.enableStashBuffer"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Stash Initial Size (KB)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.stashInitialSize }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.stashInitialSize"
                  :min="64"
                  :max="2048"
                  :step="64"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Latency Chasing (liveBufferLatencyChasing)
                </span>
                <Switch
                  v-model:checked="config.liveBufferLatencyChasing"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Chase on Pause (liveBufferLatencyChasingOnPaused)
                </span>
                <Switch
                  v-model:checked="config.liveBufferLatencyChasingOnPaused"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Max Latency (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.liveBufferLatencyMaxLatency }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.liveBufferLatencyMaxLatency"
                  :min="0.5"
                  :max="10"
                  :step="0.1"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Min Remain (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.liveBufferLatencyMinRemain }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.liveBufferLatencyMinRemain"
                  :min="0.1"
                  :max="5"
                  :step="0.1"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Rate Sync (liveSync)
                </span>
                <Switch v-model:checked="config.liveSync" size="small" />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Sync Max Latency (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.liveSyncMaxLatency }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.liveSyncMaxLatency"
                  :min="0.5"
                  :max="10"
                  :step="0.1"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Sync Target Latency (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.liveSyncTargetLatency }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.liveSyncTargetLatency"
                  :min="0.1"
                  :max="5"
                  :step="0.1"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Auto Cleanup SourceBuffer
                </span>
                <Switch
                  v-model:checked="config.autoCleanupSourceBuffer"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Cleanup Max Backward (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.autoCleanupMaxBackwardDuration }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.autoCleanupMaxBackwardDuration"
                  :min="5"
                  :max="300"
                  :step="5"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    Cleanup Min Backward (s)
                  </span>
                  <span class="text-xs font-mono text-blue-400">
                    {{ config.autoCleanupMinBackwardDuration }}
                  </span>
                </div>
                <Slider
                  v-model:value="config.autoCleanupMinBackwardDuration"
                  :min="5"
                  :max="120"
                  :step="5"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  Fix Audio Timestamp Gap
                </span>
                <Switch
                  v-model:checked="config.fixAudioTimestampGap"
                  size="small"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add apps/demo/src/
git commit -m "feat: add demo App.vue migrated from api-admin"
```

---

### Task 6: Install all dependencies and verify build

**Files:** None new — verification only.

- [ ] **Step 1: Install all workspace dependencies**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
pnpm install
```

Expected: All packages installed, `mpegts-vue3` linked as workspace dependency for demo.

- [ ] **Step 2: Build the player package**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3/packages/player
pnpm build
```

Expected: `dist/` with `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`

- [ ] **Step 3: Build the demo site**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3/apps/demo
pnpm build
```

Expected: `dist/` folder with static HTML/CSS/JS

---

### Task 7: Create GitHub Actions — npm publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

- [ ] **Step 1: Create publish.yml**

```yaml
name: Publish to npm

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Dry run (skip actual publish)'
        required: false
        default: 'false'
        type: choice
        options:
          - 'false'
          - 'true'

permissions:
  contents: read

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: 'https://registry.npmjs.org'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm -C packages/player run build

      - name: Check package validity
        run: npx publint packages/player

      - name: Publish to npm
        if: github.event.inputs.dry_run != 'true'
        run: npm publish packages/player --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Dry run publish
        if: github.event.inputs.dry_run == 'true'
        run: npm publish packages/player --access public --dry-run
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add .github/
git commit -m "ci: add npm publish workflow (tag trigger + manual)"
```

---

### Task 8: Create GitHub Actions — GitHub Pages workflow

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Create pages.yml**

```yaml
name: Deploy Demo to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - run: pnpm -C packages/player run build

      - run: pnpm -C apps/demo run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: apps/demo/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add .github/workflows/pages.yml
git commit -m "ci: add GitHub Pages deploy workflow"
```

---

### Task 9: Final verification and dev server test

- [ ] **Step 1: Run full build from root**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
pnpm build
```

Expected: Both player and demo build successfully.

- [ ] **Step 2: Start dev server**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
pnpm dev
```

Expected: Vite dev server starts, demo accessible at localhost URL.

- [ ] **Step 3: Verify package output structure**

```bash
ls -la /Users/mac/Downloads/git/mpegts-vue3/packages/player/dist/
```

Expected files: `index.js`, `index.cjs`, `index.d.ts`, `index.d.cts`

- [ ] **Step 4: Final commit if any fixes needed**

```bash
cd /Users/mac/Downloads/git/mpegts-vue3
git add -A
git commit -m "chore: final fixes after verification"
```
