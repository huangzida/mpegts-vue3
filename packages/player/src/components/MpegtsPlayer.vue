<script setup lang="ts">
import type { Ref } from 'vue';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import Mpegts from 'mpegts.js';

import type { MediaDataSource, MpegtsConfig, PlayerStatus } from '../types';

const DEFAULT_CONFIG: MpegtsConfig = {
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
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  isLive: true,
  muted: true,
  type: 'mse',
  hasVideo: true,
  hasAudio: true,
  showLoading: true,
  config: () => ({}),
});

const emit = defineEmits<{
  error: [errorType: string, errorDetail: string, errorInfo: any];
  status: [status: PlayerStatus];
}>();

const videoRef = ref<HTMLVideoElement>() as Ref<HTMLVideoElement>;
const status = ref<PlayerStatus>('nosignal');
let player: Mpegts.Player | null = null;

const videoStyle = computed(() => ({
  objectFit: props.objectFit ?? 'fill',
}));

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

function buildMediaDataSource(): MediaDataSource {
  const source: MediaDataSource = {
    type: props.type ?? 'mse',
    isLive: props.isLive,
    url: props.url,
  };
  if (props.cors !== undefined) source.cors = props.cors;
  if (props.withCredentials !== undefined) source.withCredentials = props.withCredentials;
  // 默认 hasAudio: true（via withDefaults），避免某些 FLV 流（如 ZLMediaKit）
  // 的 header flag 未标记音频导致音频包被丢弃
  source.hasAudio = props.hasAudio;
  if (props.hasVideo !== undefined) source.hasVideo = props.hasVideo;
  if (props.duration !== undefined) source.duration = props.duration;
  if (props.filesize !== undefined) source.filesize = props.filesize;
  return source;
}

function createPlayer() {
  destroyPlayer();

  if (!props.url || !videoRef.value) return;
  if (!Mpegts.isSupported()) {
    status.value = 'error';
    emit('status', 'error');
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
          // 浏览器自动播放策略拦截了带声音的播放，降级为静音重试
          // （与 video.js 的 manualAutoplay_("any") 行为保持一致）
          if (!props.muted && videoRef.value && player) {
            videoRef.value.muted = true;
            const fallbackResult = player.play();
            if (fallbackResult instanceof Promise) {
              fallbackResult
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
          } else {
            status.value = 'stopped';
            emit('status', 'stopped');
          }
        });
    } else {
      status.value = 'playing';
      emit('status', 'playing');
    }
  }
}

watch(
  () => props.url,
  (newUrl) => {
    if (newUrl) {
      createPlayer();
    } else {
      destroyPlayer();
      status.value = 'nosignal';
      emit('status', 'nosignal');
    }
  },
);

watch(
  () => props.config,
  () => {
    if (props.url) {
      createPlayer();
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
      createPlayer();
    }
  },
);

onMounted(() => {
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
  <div class="mpegts-player relative w-full h-full bg-black overflow-hidden">
    <video
      ref="videoRef"
      class="absolute inset-0 w-full h-full"
      :style="videoStyle"
      @click.prevent
      @contextmenu.prevent
    ></video>
    <div
      v-if="status === 'nosignal' || !url"
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
      v-if="status === 'connecting' && showLoading"
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
      v-if="status === 'error' && url"
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
