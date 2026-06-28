<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import { Languages, Monitor } from 'lucide-vue-next';

import { Input, Slider, Switch } from 'antdv-next';

import { MpegtsPlayer } from 'mpegts-vue3';
import type { MediaInfo, MpegtsConfig, PlayerStatus, StatisticsInfo } from 'mpegts-vue3';

import { t, toggleLocale, useLocale } from './i18n';

type GridLayout = 1 | 4 | 9;

const lang = useLocale();
const langLabel = computed(() => (lang.value === 'en' ? '中文' : 'EN'));

const DEFAULT_URL = import.meta.env.VITE_DEMO_URL || '';
const STORAGE_KEY = 'mpegts_demo_url';

const gridLayout = ref<GridLayout>(1);
const muted = ref(true);
const inputUrl = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_URL);

watch(inputUrl, (v) => {
  v ? localStorage.setItem(STORAGE_KEY, v) : localStorage.removeItem(STORAGE_KEY);
});

const gridSlots = computed(() => {
  return Array.from({ length: gridLayout.value }, (_, i) => ({
    id: i,
  }));
});

const playerRefs = ref<Record<number, InstanceType<typeof MpegtsPlayer>>>({});
const playerStatuses = ref<Record<number, PlayerStatus>>({});
const playerStats = ref<Record<number, StatisticsInfo>>({});
const playerMediaInfo = ref<Record<number, MediaInfo>>({});

const activePlayerStatus = computed<PlayerStatus>(() => {
  const statuses = Object.values(playerStatuses.value);
  if (statuses.length === 0) return 'nosignal';
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('reconnecting')) return 'reconnecting';
  if (statuses.includes('connecting')) return 'connecting';
  if (statuses.includes('playing')) return 'playing';
  return 'nosignal';
});

const statusColor = computed(() => {
  const map: Record<PlayerStatus, string> = {
    connecting: 'text-yellow-500',
    reconnecting: 'text-amber-500',
    error: 'text-red-500',
    nosignal: 'text-gray-400',
    playing: 'text-green-500',
    stopped: 'text-gray-400',
  };
  return map[activePlayerStatus.value];
});

const statusText = computed(() => {
  const key = activePlayerStatus.value as string
  return t(key)
});

const config: MpegtsConfig = reactive({
  enableWorker: true,
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

function onPlayerStatus(index: number, s: PlayerStatus) {
  playerStatuses.value[index] = s;
}

function onStatistics(index: number, info: StatisticsInfo) {
  playerStats.value[index] = info;
}

function onMediaInfo(index: number, info: MediaInfo) {
  playerMediaInfo.value[index] = info;
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

function reloadAll() {
  for (const r of Object.values(playerRefs.value)) {
    r?.reload();
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
    <div class="mx-auto max-w-[1800px] flex flex-col gap-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <Monitor class="size-6 text-blue-500" />
          <h2 class="m-0 text-lg font-semibold">{{ t('title') }}</h2>
        </div>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">{{ t('status') }}:</span>
            <span class="text-sm font-medium" :class="statusColor">
              {{ statusText }}
            </span>
          </div>
          <button
            class="flex items-center gap-1 rounded border border-gray-700 px-2 py-1 text-xs transition-colors hover:border-blue-500 hover:text-blue-500"
            @click="toggleLocale"
          >
            <Languages class="size-3.5" />
            {{ langLabel }}
          </button>
        </div>
      </div>

      <div class="flex flex-col gap-6 xl:flex-row">
        <div class="min-w-0 xl:flex-1">
          <div class="mb-3 flex items-center gap-2">
            <span class="text-xs text-gray-400">{{ t('windows') }}:</span>
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
              {{ layout }} {{ layout === 1 ? t('window') : t('windows') }}
            </button>
            <div class="ml-auto flex gap-2">
              <button
                class="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                @click="playAll"
              >
                {{ t('playAll') }}
              </button>
              <button
                class="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                @click="pauseAll"
              >
                {{ t('pauseAll') }}
              </button>
            </div>
          </div>

          <div
            v-if="gridLayout === 1"
            class="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-700 bg-black shadow-sm"
          >
            <MpegtsPlayer
              :ref="(el: any) => setPlayerRef(0, el)"
              :url="inputUrl"
              :muted="muted"
              :config="config"
              @status="(s: PlayerStatus) => onPlayerStatus(0, s)"
              @statistics="(info: StatisticsInfo) => onStatistics(0, info)"
              @mediaInfo="(info: MediaInfo) => onMediaInfo(0, info)"
            />
            <div
              v-if="playerMediaInfo[0]?.height"
              class="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300"
            >
              {{ playerMediaInfo[0].height }}p · {{ playerMediaInfo[0].videoCodec }}
            </div>
            <div
              v-if="playerStats[0]"
              class="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-gray-200"
            >
              ↓ {{ playerStats[0].speed ?? 0 }} KB/s · {{ playerStats[0].decodedFrames ?? 0 }}f · drop {{ playerStats[0].droppedFrames ?? 0 }}
            </div>
          </div>

          <div v-else class="grid w-full gap-2" :class="gridColsClass">
            <div
              v-for="slot in gridSlots"
              :key="slot.id"
              class="relative aspect-video w-full overflow-hidden rounded-lg border border-gray-700 bg-black shadow-sm"
            >
              <MpegtsPlayer
                :ref="(el: any) => setPlayerRef(slot.id, el)"
                :url="inputUrl"
                :muted="muted"
                :config="config"
                @status="(s: PlayerStatus) => onPlayerStatus(slot.id, s)"
                @statistics="(info: StatisticsInfo) => onStatistics(slot.id, info)"
                @mediaInfo="(info: MediaInfo) => onMediaInfo(slot.id, info)"
              />
              <div
                v-if="playerMediaInfo[slot.id]?.height"
                class="pointer-events-none absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300"
              >
                {{ playerMediaInfo[slot.id].height }}p · {{ playerMediaInfo[slot.id].videoCodec }}
              </div>
              <div
                v-if="playerStats[slot.id]"
                class="pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-gray-200"
              >
                ↓ {{ playerStats[slot.id].speed ?? 0 }} KB/s · {{ playerStats[slot.id].decodedFrames ?? 0 }}f · drop {{ playerStats[slot.id].droppedFrames ?? 0 }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4 xl:w-80 xl:shrink-0">
          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">{{ t('streamUrl') }}</h3>
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
                {{ t('apply') }}
              </button>
            </div>
          </div>

          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">{{ t('playbackControl') }}</h3>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">{{ t('muted') }}</span>
                <Switch v-model:checked="muted" size="small" />
              </div>
              <div class="flex gap-2">
                <button
                  class="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                  @click="playAll"
                >
                  {{ t('play') }}
                </button>
                <button
                  class="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                  @click="pauseAll"
                >
                  {{ t('pause') }}
                </button>
                <button
                  class="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                  @click="reloadAll"
                >
                  {{ t('reload') }}
                </button>
              </div>
            </div>
          </div>

          <div class="rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 class="m-0 mb-3 text-sm font-semibold">{{ t('liveParameters') }}</h3>
            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  {{ t('enableWorker') }}
                </span>
                <Switch v-model:checked="config.enableWorker" size="small" />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  {{ t('enableStashBuffer') }}
                </span>
                <Switch
                  v-model:checked="config.enableStashBuffer"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    {{ t('stashInitialSize') }}
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
                  {{ t('latencyChasing') }}
                </span>
                <Switch
                  v-model:checked="config.liveBufferLatencyChasing"
                  size="small"
                />
              </div>

              <div class="flex items-center justify-between">
                <span class="text-xs text-gray-400">
                  {{ t('chaseOnPause') }}
                </span>
                <Switch
                  v-model:checked="config.liveBufferLatencyChasingOnPaused"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    {{ t('maxLatency') }}
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
                    {{ t('minRemain') }}
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
                  {{ t('rateSync') }}
                </span>
                <Switch v-model:checked="config.liveSync" size="small" />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    {{ t('syncMaxLatency') }}
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
                    {{ t('syncTargetLatency') }}
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
                  {{ t('autoCleanup') }}
                </span>
                <Switch
                  v-model:checked="config.autoCleanupSourceBuffer"
                  size="small"
                />
              </div>

              <div>
                <div class="mb-1 flex items-center justify-between">
                  <span class="text-xs text-gray-400">
                    {{ t('cleanupMaxBackward') }}
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
                    {{ t('cleanupMinBackward') }}
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
                  {{ t('fixAudioTimestampGap') }}
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
