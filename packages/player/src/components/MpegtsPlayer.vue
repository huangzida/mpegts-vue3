<script setup lang="ts">
import type { Ref } from 'vue';

import { onMounted, onUnmounted, ref, watch } from 'vue';

import Mpegts from 'mpegts.js';

import type { MpegtsConfig, PlayerStatus } from '../types';

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
  src: string;
  autoplay?: boolean;
  isLive?: boolean;
  muted?: boolean;
  config?: Partial<MpegtsConfig>;
}

const props = withDefaults(defineProps<Props>(), {
  autoplay: true,
  isLive: true,
  muted: true,
  config: () => ({}),
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

  const mergedConfig: MpegtsConfig = { ...DEFAULT_CONFIG, ...props.config };

  player = Mpegts.createPlayer(
    {
      type: 'mse',
      isLive: props.isLive,
      url,
    },
    mergedConfig,
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

watch(
  () => props.config,
  () => {
    if (props.src) {
      createPlayer(props.src);
    }
  },
  { deep: true },
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
