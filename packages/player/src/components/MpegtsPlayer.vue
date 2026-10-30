<script setup lang="ts">
import type { CSSProperties, Ref } from 'vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import type Mpegts from 'mpegts.js';

import type { MediaDataSource, MediaInfo, MpegtsConfig, PlayerStatus, ReconnectConfig, StatisticsInfo } from '../types';

// Client-only: mpegts.js touches `window` at module load. SSR consumers must
// wrap this component (Nuxt <ClientOnly> / next/dynamic { ssr: false }).

// PlayerEngine — the framework-agnostic module that owns the whole mpegts.js
// lifecycle (config merge, MSE gate, gen guard, 重建 debounce, Live 重连,
// event mapping, autoplay fallback, destroy sequence). This component is just
// the Vue adapter: props → engine.update(), engine handlers → emits.
import { createPlayerEngine, type PlayerEngine } from '../../../core/src/index';

interface Props {
  url: string;
  autoplay?: boolean;
  isLive?: boolean;
  muted?: boolean;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
  type?: string;
  cors?: boolean;
  withCredentials?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
  duration?: number;
  filesize?: number;
  showLoading?: boolean;
  config?: Partial<MpegtsConfig>;
  autoReconnect?: boolean;
  reconnect?: ReconnectConfig;
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  isLive: true,
  muted: true,
  type: 'mse',
  hasAudio: true,
  hasVideo: true,
  showLoading: true,
  config: () => ({}),
  autoReconnect: true,
  // reconnect 默认值由 PlayerEngine 提供（retries 无限 + 1s→16s 退避），
  // 适配层不再重复一份，避免两处默认值漂移。
});

const emit = defineEmits<{
  error: [errorType: string, errorDetail: string, errorInfo: any];
  status: [status: PlayerStatus];
  statistics: [info: StatisticsInfo];
  mediaInfo: [info: MediaInfo];
  recovered: [];
  ended: [];
}>();

const videoRef = ref<HTMLVideoElement>() as Ref<HTMLVideoElement>;
const status = ref<PlayerStatus>('nosignal');
let engine: PlayerEngine | null = null;

// Full snapshot on every call — the engine diffs create-affecting keys itself,
// so this is safe to run on any prop change. Handlers are passed fresh each
// time and re-read at dispatch.
function collectOptions() {
  return {
    video: videoRef.value as HTMLVideoElement,
    url: props.url,
    autoplay: props.autoplay,
    isLive: props.isLive,
    muted: props.muted,
    type: props.type,
    cors: props.cors,
    withCredentials: props.withCredentials,
    hasAudio: props.hasAudio,
    hasVideo: props.hasVideo,
    duration: props.duration,
    filesize: props.filesize,
    config: props.config,
    autoReconnect: props.autoReconnect,
    reconnect: props.reconnect,
    handlers: {
      onStatus: (s: PlayerStatus) => {
        status.value = s;
        emit('status', s);
      },
      onError: (errorType: string, errorDetail: string, errorInfo: unknown) => emit('error', errorType, errorDetail, errorInfo),
      onStatistics: (info: StatisticsInfo) => emit('statistics', info),
      onMediaInfo: (info: MediaInfo) => emit('mediaInfo', info),
      onRecovered: () => emit('recovered'),
      onEnded: () => emit('ended'),
    },
  };
}

// One watcher for every prop (deep covers `config`); the engine decides
// rebuild vs muted-sync vs no-op.
watch(props, () => {
  engine?.update(collectOptions());
}, { deep: true });

const videoStyle = computed<CSSProperties>(() => ({
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: props.objectFit ?? 'fill',
}));

// ponytail: rolldown removed CSS bundling, so styles are inlined for zero-CSS-deps
// parity with the React sibling. The one keyframe is injected at runtime.
const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  overflow: 'hidden',
};
const overlayBase: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const noSignalOverlay: CSSProperties = { ...overlayBase, flexDirection: 'column', backgroundColor: 'rgb(17 24 39 / 0.9)' };
const maskOverlay: CSSProperties = { ...overlayBase, backgroundColor: 'rgb(0 0 0 / 0.6)' };
const connectingInner: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' };
const errorInner: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' };
const spinnerStyle: CSSProperties = {
  width: '2rem',
  height: '2rem',
  borderRadius: '9999px',
  border: '2px solid #3b82f6',
  borderTopColor: 'transparent',
  animation: 'mpegts-spin 1s linear infinite',
};
const noSignalTextStyle: CSSProperties = { fontSize: '0.875rem', fontWeight: 500, color: '#9ca3af', letterSpacing: '0.05em', textTransform: 'uppercase' };
const connectingTextStyle: CSSProperties = { fontSize: '0.875rem', color: '#d1d5db' };
const errorTextStyle: CSSProperties = { fontSize: '0.875rem', color: '#f87171' };

let keyframeInjected = false;
function ensureKeyframe() {
  if (keyframeInjected || typeof document === 'undefined') return;
  keyframeInjected = true;
  const el = document.createElement('style');
  el.textContent = '@keyframes mpegts-spin { to { transform: rotate(360deg) } }';
  document.head.appendChild(el);
}

function play() {
  engine?.play();
}

function pause() {
  engine?.pause();
}

function reload() {
  engine?.reload();
}

function setMuted(muted: boolean) {
  engine?.setMuted(muted);
}

function getPlayer(): Mpegts.Player | null {
  return (engine?.getPlayer() as Mpegts.Player | null) ?? null;
}

function getVolume(): number {
  return engine?.getVolume() ?? 0;
}
function setVolume(volume: number) {
  engine?.setVolume(volume);
}
function seek(seconds: number) {
  engine?.seek(seconds);
}
function getCurrentTime(): number {
  return engine?.getCurrentTime() ?? 0;
}
function getBufferedRanges(): TimeRanges | null {
  return engine?.getBufferedRanges() ?? null;
}
function getStatistics(): StatisticsInfo | null {
  return engine?.getStatistics() ?? null;
}

defineExpose({
  play,
  pause,
  reload,
  setMuted,
  getPlayer,
  getVolume,
  setVolume,
  seek,
  getCurrentTime,
  getBufferedRanges,
  getStatistics,
});

onMounted(() => {
  ensureKeyframe();
  // Constructing with a url creates immediately (mount parity).
  engine = createPlayerEngine(collectOptions());
});

onUnmounted(() => {
  engine?.destroy();
  engine = null;
});
</script>

<template>
  <div class="mpegts-player" :style="containerStyle">
    <!-- ponytail: data-stream-url/type 无测试覆盖，删除绑定会静默回归 -->
    <video
      ref="videoRef"
      :style="videoStyle"
      :data-stream-url="url"
      :data-stream-type="type"
      @click.prevent
      @contextmenu.prevent
    ></video>
    <div v-if="status === 'nosignal' || !url" :style="noSignalOverlay">
      <svg
        :style="{ width: '2.5rem', height: '2.5rem', marginBottom: '0.75rem', color: '#9ca3af' }"
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
      <span :style="noSignalTextStyle">No Signal</span>
    </div>
    <div v-if="status === 'connecting' && showLoading" :style="maskOverlay">
      <div :style="connectingInner">
        <div :style="spinnerStyle"></div>
        <span :style="connectingTextStyle">Connecting...</span>
      </div>
    </div>
    <div v-if="status === 'error' && url" :style="maskOverlay">
      <div :style="errorInner">
        <svg
          :style="{ width: '2rem', height: '2rem', color: '#f87171' }"
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
        <span :style="errorTextStyle">Connection Failed</span>
      </div>
    </div>
  </div>
</template>
