<script setup lang="ts">
import type { CSSProperties, Ref } from 'vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import type { MediaDataSource, MediaInfo, MpegtsConfig, PlayerStatus, ReconnectConfig, StatisticsInfo } from '../types';

// Client-only: mpegts.js touches `window` at module load. SSR consumers must
// wrap this component (Nuxt <ClientOnly> / next/dynamic { ssr: false }).
import Mpegts from 'mpegts.js';

const DEFAULT_CONFIG: MpegtsConfig = {
  enableWorker: true,
  reuseRedirectedURL: true,
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
};

// mpegts.js createPlayer() routes these types to MSEPlayer (needs MediaSource);
// any other type (e.g. 'mp4') routes to NativePlayer (native <video>, no MSE).
// Only gate on isSupported() for the MSE-required set — otherwise we wrongly
// block native playback on MSE-less browsers (e.g. iOS Safari playing an mp4).
const MSE_REQUIRED_TYPES: string[] = ['mse', 'mpegts', 'm2ts', 'flv'];

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
  reconnect: () => ({ retries: 5, minDelay: 1000, maxDelay: 16000 }),
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
let player: Mpegts.Player | null = null;
// ponytail: generation guard — bump on every destroy so in-flight autoplay
// promise callbacks bail instead of writing stale status / resurrecting a
// dead player. One variable kills the whole stale-closure class (P0-3).
let gen = 0;
let recreateTimer: ReturnType<typeof setTimeout> | null = null;

// Collapse rapid prop mutations (e.g. dragging a config slider) into a single
// recreate — deep watcher fires per field, this debounces to one rebuild (P0-1).
function scheduleRecreate() {
  if (recreateTimer) clearTimeout(recreateTimer);
  recreateTimer = setTimeout(() => {
    recreateTimer = null;
    createPlayer();
  }, 300);
}

// mpegts.js auto-reconnects VOD internally but for live it throws
// UnrecoverableEarlyEof to the upper layer — so the wrapper owns live reconnect.
// Backoff caps retries; the burst resets on successful playback (markPlaying).
const RECONNECTABLE_ERRORS = new Set(['Exception', 'ConnectingTimeout', 'UnrecoverableEarlyEof']);
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function markPlaying() {
  reconnectAttempts = 0;
  status.value = 'playing';
  emit('status', 'playing');
}

function scheduleReconnect(): boolean {
  const { retries = 5, minDelay = 1000, maxDelay = 16000 } = props.reconnect;
  if (reconnectAttempts >= retries) return false;
  const delay = Math.min(maxDelay, minDelay * 2 ** reconnectAttempts);
  reconnectAttempts++;
  status.value = 'reconnecting';
  emit('status', 'reconnecting');
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    createPlayer();
  }, delay);
  return true;
}

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

function destroyPlayer(silent = false) {
  gen++;
  if (recreateTimer) {
    clearTimeout(recreateTimer);
    recreateTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (!player) return;
  try {
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
  } catch {
    // ignore cleanup errors
  }
  player = null;
  if (!silent) {
    status.value = 'nosignal';
    emit('status', 'nosignal');
  }
}

function play() {
  if (!player) return;
  const myGen = gen;
  // Re-sync muted on resume (pause() intentionally leaves it untouched).
  videoRef.value.muted = props.muted;
  const result = player.play();
  if (result instanceof Promise) {
    result
      .then(() => {
        if (myGen !== gen) return;
        markPlaying();
      })
      .catch(() => {
        if (myGen !== gen) return;
        status.value = 'stopped';
        emit('status', 'stopped');
      });
  } else {
    markPlaying();
  }
}

function pause() {
  if (!player) return;
  player.pause();
  status.value = 'stopped';
  emit('status', 'stopped');
}

function reload() {
  createPlayer();
}

function setMuted(muted: boolean) {
  if (videoRef.value) videoRef.value.muted = muted;
}

function getPlayer(): Mpegts.Player | null {
  return player;
}

function getVolume(): number {
  return videoRef.value?.volume ?? 0;
}
function setVolume(volume: number) {
  if (videoRef.value) videoRef.value.volume = volume;
}
function seek(seconds: number) {
  // player.currentTime setter routes through mpegts.js (triggers range-load),
  // not a bare <video> assign which would bypass segment loading for VOD.
  if (player) player.currentTime = seconds;
}
function getCurrentTime(): number {
  return videoRef.value?.currentTime ?? 0;
}
function getBufferedRanges(): TimeRanges | null {
  return videoRef.value?.buffered ?? null;
}
function getStatistics(): StatisticsInfo | null {
  return (player?.statisticsInfo as StatisticsInfo | undefined) ?? null;
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

function buildMediaDataSource(): MediaDataSource {
  const source: MediaDataSource = {
    type: props.type ?? 'mse',
    isLive: props.isLive,
    url: props.url,
  };
  if (props.cors !== undefined) source.cors = props.cors;
  if (props.withCredentials !== undefined) source.withCredentials = props.withCredentials;
  // 默认 hasAudio/hasVideo: true，避免某些 FLV 流（如 ZLMediaKit）
  // 的 header flag 未标记音/视频导致对应包被丢弃（表现为黑屏/无声）
  source.hasAudio = props.hasAudio;
  source.hasVideo = props.hasVideo;
  if (props.duration !== undefined) source.duration = props.duration;
  if (props.filesize !== undefined) source.filesize = props.filesize;
  return source;
}

function createPlayer() {
  destroyPlayer(true);
  const myGen = gen;

  if (!props.url || !videoRef.value) return;
  if (MSE_REQUIRED_TYPES.includes(props.type) && !Mpegts.isSupported()) {
    status.value = 'error';
    emit('status', 'error');
    emit('error', 'NotSupportedError', 'MediaSource Extensions (MSE) are not supported by this browser', { type: props.type });
    return;
  }

  status.value = 'connecting';
  emit('status', 'connecting');

  const mergedConfig: MpegtsConfig = { ...DEFAULT_CONFIG, ...props.config };
  const mediaSource = buildMediaDataSource();

  player = Mpegts.createPlayer(mediaSource, mergedConfig);

  player.attachMediaElement(videoRef.value);

  player.on(
    Mpegts.Events.ERROR,
    (errorType: string, errorDetail: string, errorInfo: any) => {
      if (myGen !== gen) return;
      emit('error', errorType, errorDetail, errorInfo);
      if (
        props.autoReconnect &&
        errorType === 'NetworkError' &&
        RECONNECTABLE_ERRORS.has(errorDetail) &&
        scheduleReconnect()
      ) {
        return; // reconnect scheduled — not a terminal error
      }
      status.value = 'error';
      emit('status', 'error');
    },
  );

  player.on(Mpegts.Events.STATISTICS_INFO, (info: StatisticsInfo) => {
    if (myGen !== gen) return;
    emit('statistics', info);
  });
  player.on(Mpegts.Events.MEDIA_INFO, (info: MediaInfo) => {
    if (myGen !== gen) return;
    emit('mediaInfo', info);
  });
  player.on(Mpegts.Events.RECOVERED_EARLY_EOF, () => {
    if (myGen !== gen) return;
    emit('recovered');
  });
  player.on(Mpegts.Events.LOADING_COMPLETE, () => {
    if (myGen !== gen) return;
    emit('ended');
  });

  player.load();

  if (props.autoplay) {
    videoRef.value.muted = props.muted;
    const result = player.play();
    if (result instanceof Promise) {
      result
        .then(() => {
          if (myGen !== gen) return;
          markPlaying();
        })
        .catch(() => {
          // 浏览器自动播放策略拦截了带声音的播放，降级为静音重试
          // （与 video.js 的 manualAutoplay_("any") 行为保持一致）
          if (myGen !== gen) return;
          if (!props.muted && videoRef.value && player) {
            videoRef.value.muted = true;
            const fallbackResult = player.play();
            if (fallbackResult instanceof Promise) {
              fallbackResult
                .then(() => {
                  if (myGen !== gen) return;
                  markPlaying();
                })
                .catch(() => {
                  if (myGen !== gen) return;
                  status.value = 'stopped';
                  emit('status', 'stopped');
                });
            } else {
              markPlaying();
            }
          } else {
            status.value = 'stopped';
            emit('status', 'stopped');
          }
        });
    } else {
      markPlaying();
    }
  }
}

watch(
  () => props.url,
  (newUrl) => {
    if (newUrl) {
      scheduleRecreate();
    } else {
      destroyPlayer();
    }
  },
);

watch(
  () => props.config,
  () => {
    if (props.url) {
      scheduleRecreate();
    }
  },
  { deep: true },
);

watch(
  () => [
    props.type,
    props.isLive,
    props.cors,
    props.withCredentials,
    props.hasAudio,
    props.hasVideo,
    props.duration,
    props.filesize,
  ],
  () => {
    if (props.url) {
      scheduleRecreate();
    }
  },
);

onMounted(() => {
  ensureKeyframe();
  if (props.url) {
    createPlayer();
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
  <div class="mpegts-player" :style="containerStyle">
    <video
      ref="videoRef"
      :style="videoStyle"
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
