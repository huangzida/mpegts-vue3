import { ref } from 'vue'

export type Locale = 'en' | 'zh'

const locale = ref<Locale>(
  (typeof navigator !== 'undefined' &&
    (navigator.language.startsWith('zh') ? 'zh' : 'en')) ||
    'en',
)

export function useLocale() {
  return locale
}

export function toggleLocale() {
  locale.value = locale.value === 'en' ? 'zh' : 'en'
}

const messages: Record<Locale, Record<string, string>> = {
  en: {
    title: 'Video Player Debug',
    status: 'Status',
    windows: 'Windows',
    window: 'Window',
    playAll: 'Play All',
    pauseAll: 'Pause All',
    streamUrl: 'Stream URL',
    apply: 'Apply',
    playbackControl: 'Playback Control',
    muted: 'Muted',
    play: 'Play',
    pause: 'Pause',
    reload: 'Reload',
    liveParameters: 'Live Parameters',
    enableWorker: 'Web Worker (enableWorker)',
    enableStashBuffer: 'Enable IO Buffer (enableStashBuffer)',
    stashInitialSize: 'Stash Initial Size (KB)',
    latencyChasing: 'Latency Chasing (liveBufferLatencyChasing)',
    chaseOnPause: 'Chase on Pause (liveBufferLatencyChasingOnPaused)',
    maxLatency: 'Max Latency (s)',
    minRemain: 'Min Remain (s)',
    rateSync: 'Rate Sync (liveSync)',
    syncMaxLatency: 'Sync Max Latency (s)',
    syncTargetLatency: 'Sync Target Latency (s)',
    autoCleanup: 'Auto Cleanup SourceBuffer',
    cleanupMaxBackward: 'Cleanup Max Backward (s)',
    cleanupMinBackward: 'Cleanup Min Backward (s)',
    fixAudioTimestampGap: 'Fix Audio Timestamp Gap',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    error: 'Error',
    nosignal: 'No Signal',
    playing: 'Playing',
    stopped: 'Stopped',
    channel: 'Channel',
  },
  zh: {
    title: '视频播放调试',
    status: '状态',
    windows: '窗口',
    window: '窗口',
    playAll: '全部播放',
    pauseAll: '全部暂停',
    streamUrl: '播放地址',
    apply: '应用',
    playbackControl: '播放控制',
    muted: '静音',
    play: '播放',
    pause: '暂停',
    reload: '重载',
    liveParameters: '直播参数',
    enableWorker: 'Web Worker 解码 (enableWorker)',
    enableStashBuffer: '启用 IO 缓存 (enableStashBuffer)',
    stashInitialSize: '缓存初始大小 (KB)',
    latencyChasing: '延迟追赶 (liveBufferLatencyChasing)',
    chaseOnPause: '暂停时追赶 (liveBufferLatencyChasingOnPaused)',
    maxLatency: '最大延迟 (秒)',
    minRemain: '最小保留 (秒)',
    rateSync: '速率追赶 (liveSync)',
    syncMaxLatency: '速率追赶最大延迟 (秒)',
    syncTargetLatency: '速率追赶目标延迟 (秒)',
    autoCleanup: '自动清理 SourceBuffer',
    cleanupMaxBackward: '清理最大向后时长 (秒)',
    cleanupMinBackward: '清理最小保留时长 (秒)',
    fixAudioTimestampGap: '修复音频时间戳间隙',
    connecting: '连接中',
    reconnecting: '重连中',
    error: '错误',
    nosignal: '无信号',
    playing: '播放中',
    stopped: '已停止',
    channel: '通道',
  },
}

export function t(key: string): string {
  return messages[locale.value][key] ?? key
}
