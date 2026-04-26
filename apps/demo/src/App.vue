<script setup lang="ts">
import { computed, ref, shallowReactive } from 'vue';

import { Monitor } from 'lucide-vue-next';

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
