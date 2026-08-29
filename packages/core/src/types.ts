import type Mpegts from 'mpegts.js'

// Frozen contract types — identical to what mpegts-vue3 / mpegts-react have
// always exported. Both player packages re-export from here.

export type MediaDataSource = Mpegts.MediaDataSource
export type MediaSegment = Mpegts.MediaSegment
export type MpegtsConfig = Mpegts.Config
export type StatisticsInfo = Mpegts.MSEPlayerStatisticsInfo
export type MediaInfo = Mpegts.MSEPlayerMediaInfo

export interface ReconnectConfig {
  retries?: number
  minDelay?: number
  maxDelay?: number
}

export type PlayerStatus =
  | 'connecting'
  | 'reconnecting'
  | 'error'
  | 'nosignal'
  | 'playing'
  | 'stopped'

/** Structural subset of mpegts.Player that the engine touches. */
export interface MpegtsPlayerLike {
  attachMediaElement(el: HTMLMediaElement): void
  load(): void
  play(): void | Promise<unknown>
  pause(): void
  unload(): void
  detachMediaElement(): void
  destroy(): void
  on(event: string, cb: (...args: never[]) => void): void
  currentTime: number
  statisticsInfo?: unknown
}

/**
 * Seam behind which mpegts.js itself sits. Production wires the real factory
 * (factory.ts — the only runtime import of mpegts.js); tests inject
 * createMockFactory() from ./testing. Two adapters = a real seam.
 */
export interface PlayerFactory {
  isSupported(): boolean
  createPlayer(source: MediaDataSource, config: MpegtsConfig): MpegtsPlayerLike
}

/**
 * Replaced wholesale on every update() and re-read at dispatch time, so
 * adapters can pass fresh closures without ref juggling.
 */
export interface PlayerEventHandlers {
  onStatus?(status: PlayerStatus): void
  onError?(errorType: string, errorDetail: string, errorInfo: unknown): void
  onStatistics?(info: StatisticsInfo): void
  onMediaInfo?(info: MediaInfo): void
  onRecovered?(): void
  onEnded?(): void
}

export interface PlayerEngineOptions {
  /** Target <video>; captured at construction and fixed for the engine's life. */
  video: HTMLVideoElement
  handlers?: PlayerEventHandlers
  url: string
  type?: string
  isLive?: boolean
  /** Create-time only; changing it later does not rebuild. */
  autoplay?: boolean
  muted?: boolean
  cors?: boolean
  withCredentials?: boolean
  hasAudio?: boolean
  hasVideo?: boolean
  duration?: number
  filesize?: number
  config?: Partial<MpegtsConfig>
  autoReconnect?: boolean
  reconnect?: ReconnectConfig
  /** 重建策略: default `{ debounceMs: 300 }`; `false` rebuilds immediately. */
  rebuild?: { debounceMs?: number } | false
}

export interface PlayerEngine {
  /**
   * Full-snapshot sync. The engine diffs the create-affecting keys itself,
   * so calling this on every render/tick is safe and cheap.
   */
  update(options: PlayerEngineOptions): void
  destroy(): void
  play(): void
  pause(): void
  reload(): void
  setMuted(muted: boolean): void
  getPlayer(): MpegtsPlayerLike | null
  getVolume(): number
  setVolume(volume: number): void
  seek(seconds: number): void
  getCurrentTime(): number
  getBufferedRanges(): TimeRanges | null
  getStatistics(): StatisticsInfo | null
}
