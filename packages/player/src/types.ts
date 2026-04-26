export type PlayerStatus =
  | 'connecting'
  | 'destroying'
  | 'error'
  | 'nosignal'
  | 'playing'
  | 'stopped'

export interface MpegtsConfig {
  enableWorker?: boolean
  enableWorkerForMSE?: boolean
  enableStashBuffer?: boolean
  stashInitialSize?: number
  isLive?: boolean
  liveBufferLatencyChasing?: boolean
  liveBufferLatencyChasingOnPaused?: boolean
  liveBufferLatencyMaxLatency?: number
  liveBufferLatencyMinRemain?: number
  liveSync?: boolean
  liveSyncMaxLatency?: number
  liveSyncTargetLatency?: number
  liveSyncPlaybackRate?: number
  lazyLoad?: boolean
  lazyLoadMaxDuration?: number
  lazyLoadRecoverDuration?: number
  deferLoadAfterSourceOpen?: boolean
  autoCleanupSourceBuffer?: boolean
  autoCleanupMaxBackwardDuration?: number
  autoCleanupMinBackwardDuration?: number
  fixAudioTimestampGap?: boolean
  accurateSeek?: boolean
  seekType?: 'range' | 'param' | 'custom'
  seekParamStart?: string
  seekParamEnd?: string
  rangeLoadZeroStart?: boolean
  customSeekHandler?: any
  reuseRedirectedURL?: boolean
  headers?: Record<string, string>
  customLoader?: any
}
