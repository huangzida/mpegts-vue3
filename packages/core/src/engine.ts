import type {
  MediaDataSource,
  MediaInfo,
  MpegtsConfig,
  MpegtsPlayerLike,
  PlayerEngine,
  PlayerEngineOptions,
  PlayerFactory,
  PlayerStatus,
  ReconnectConfig,
  StatisticsInfo,
} from './types'

import { mpegtsFactory } from './factory'

// Load-bearing low-latency defaults. `config` is shallow-merged over these
// ({ ...DEFAULT_CONFIG, ...config }) — passing `undefined` does not unset a
// default; omit the key.
const DEFAULT_CONFIG: MpegtsConfig = {
  enableWorker: true,
  // Chromium 108+: moves the whole MSE pipeline (MediaSource + SourceBuffer
  // appends) into the same worker as the transmuxer. Auto-detected and falls
  // back to the main-thread engine on other kernels, so it is safe by default.
  enableWorkerForMSE: true,
  reuseRedirectedURL: true,
  enableStashBuffer: false,
  liveBufferLatencyChasing: true,
  liveBufferLatencyChasingOnPaused: true,
  liveBufferLatencyMaxLatency: 1.5,
  liveBufferLatencyMinRemain: 0.3,
  liveSync: true,
  // mpegts.js/mpegts-react shipped 1.2/0.5, which leaves a dead band: between
  // 0.5s and 1.2s neither the chaser nor liveSync acts, so the buffer parks at
  // ~1s forever. 0.7/0.3 converges to 0.3-0.5s (measured p50 0.71s → 0.30s).
  liveSyncMaxLatency: 0.7,
  liveSyncTargetLatency: 0.3,
  autoCleanupSourceBuffer: true,
  autoCleanupMaxBackwardDuration: 30,
  autoCleanupMinBackwardDuration: 10,
  fixAudioTimestampGap: true,
}

// mpegts.js createPlayer() routes these types to MSEPlayer (needs MediaSource);
// any other type (e.g. 'mp4') routes to NativePlayer (native <video>, no MSE).
// Only gate on isSupported() for the MSE-required set — otherwise we wrongly
// block native playback on MSE-less browsers (e.g. iOS Safari playing an mp4).
const MSE_REQUIRED_TYPES: string[] = ['mse', 'mpegts', 'm2ts', 'flv']

// mpegts.js auto-reconnects VOD internally but for live it throws
// UnrecoverableEarlyEof to the upper layer — so the engine owns live reconnect.
// These transient network error details are the ones worth retrying (not
// HttpStatusCodeInvalid, which is a permanent 4xx/5xx).
const RECONNECTABLE_ERRORS = new Set(['Exception', 'ConnectingTimeout', 'UnrecoverableEarlyEof'])

// mpegts.js Events values, kept local so the engine never imports mpegts.js
// at runtime (factory.ts holds the single runtime import).
const PLAYER_EVENTS = {
  ERROR: 'error',
  STATISTICS_INFO: 'statistics_info',
  MEDIA_INFO: 'media_info',
  RECOVERED_EARLY_EOF: 'recovered_early_eof',
  LOADING_COMPLETE: 'loading_complete',
} as const

interface Snapshot {
  url: string
  type: string
  isLive: boolean
  autoplay: boolean
  muted: boolean
  cors: boolean | undefined
  withCredentials: boolean | undefined
  hasAudio: boolean
  hasVideo: boolean
  duration: number | undefined
  filesize: number | undefined
  config: Partial<MpegtsConfig> | undefined
  autoReconnect: boolean
  reconnect: ReconnectConfig | undefined
  rebuild: { debounceMs?: number } | false | undefined
}

function resolve(o: PlayerEngineOptions): Snapshot {
  return {
    url: o.url,
    type: o.type ?? 'mse',
    isLive: o.isLive ?? true,
    autoplay: o.autoplay ?? true,
    muted: o.muted ?? true,
    cors: o.cors,
    withCredentials: o.withCredentials,
    hasAudio: o.hasAudio ?? true,
    hasVideo: o.hasVideo ?? true,
    duration: o.duration,
    filesize: o.filesize,
    config: o.config,
    autoReconnect: o.autoReconnect ?? true,
    reconnect: o.reconnect,
    rebuild: o.rebuild,
  }
}

/**
 * The canonical create signature: every key that forces a rebuild when it
 * changes. Adding a create-affecting option = one Snapshot field + one line
 * here, inherited by both framework adapters.
 */
function sourceEqual(a: Snapshot, b: Snapshot): boolean {
  if (
    a.url !== b.url ||
    a.type !== b.type ||
    a.isLive !== b.isLive ||
    a.cors !== b.cors ||
    a.withCredentials !== b.withCredentials ||
    a.hasAudio !== b.hasAudio ||
    a.hasVideo !== b.hasVideo ||
    a.duration !== b.duration ||
    a.filesize !== b.filesize
  ) {
    return false
  }
  // config is shallow-merged at create time → compare per key.
  const ac: Partial<MpegtsConfig> = a.config ?? {}
  const bc: Partial<MpegtsConfig> = b.config ?? {}
  const aKeys = Object.keys(ac) as Array<keyof MpegtsConfig>
  const bKeys = Object.keys(bc) as Array<keyof MpegtsConfig>
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => bc[key] === ac[key])
}

export function createPlayerEngine(
  options: PlayerEngineOptions,
  playerFactory: PlayerFactory = mpegtsFactory,
): PlayerEngine {
  const video = options.video
  let opts = resolve(options)
  // Always read by reference at dispatch time — update() swaps it wholesale,
  // so adapters pass fresh closures without ref juggling.
  let handlers = options.handlers

  let player: MpegtsPlayerLike | null = null
  // Generation guard: bumped on every destroy so in-flight autoplay promise
  // callbacks bail instead of resurrecting a dead player or leaking status.
  let gen = 0
  // Whether the first create happened. Never reset: url teardown→restore goes
  // back through the debounced rebuild (Vue watcher parity).
  let created = false
  let recreateTimer: number | undefined
  let reconnectAttempts = 0
  let reconnectTimer: number | undefined

  function markPlaying() {
    reconnectAttempts = 0
    handlers?.onStatus?.('playing')
  }

  function destroyPlayer(silent = false) {
    gen++
    if (recreateTimer) {
      clearTimeout(recreateTimer)
      recreateTimer = undefined
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = undefined
    }
    if (!player) return
    try {
      player.pause()
      player.unload()
      player.detachMediaElement()
      player.destroy()
    } catch {
      // ignore cleanup errors
    }
    player = null
    if (!silent) handlers?.onStatus?.('nosignal')
  }

  function buildSource(): MediaDataSource {
    const source: MediaDataSource = {
      type: opts.type,
      isLive: opts.isLive,
      url: opts.url,
    }
    if (opts.cors !== undefined) source.cors = opts.cors
    if (opts.withCredentials !== undefined) source.withCredentials = opts.withCredentials
    // 默认 hasAudio/hasVideo: true，避免某些 FLV 流（如 ZLMediaKit）
    // 的 header flag 未标记音/视频导致对应包被丢弃（表现为黑屏/无声）
    source.hasAudio = opts.hasAudio
    source.hasVideo = opts.hasVideo
    if (opts.duration !== undefined) source.duration = opts.duration
    if (opts.filesize !== undefined) source.filesize = opts.filesize
    return source
  }

  // Live 重连: exponential backoff, capped; the burst resets on successful
  // playback (markPlaying). Retries are unlimited by default — a live source
  // that comes back hours later still recovers — capped by the 16s delay, and
  // the caller can bound it with `reconnect: { retries: 5 }`.
  function scheduleReconnect(): boolean {
    const { retries = Infinity, minDelay = 1000, maxDelay = 16000 } = opts.reconnect ?? {}
    if (reconnectAttempts >= retries) return false
    const delay = Math.min(maxDelay, minDelay * 2 ** reconnectAttempts)
    reconnectAttempts++
    handlers?.onStatus?.('reconnecting')
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined
      createPlayer()
    }, delay)
    return true
  }

  // Shared by public play() and the autoplay flow. onFail runs only for the
  // current generation when the play promise rejects.
  function playOnce(onFail: () => void) {
    if (!player) return
    const myGen = gen
    // Re-sync muted on every play (pause() intentionally leaves it untouched).
    video.muted = opts.muted
    const result = player.play()
    if (result instanceof Promise) {
      result.then(
        () => {
          if (myGen !== gen) return
          markPlaying()
        },
        () => {
          if (myGen !== gen) return
          onFail()
        },
      )
    } else {
      markPlaying()
    }
  }

  function createPlayer() {
    // Consume the cold start on entry — even when the url/video guard or the
    // MSE gate bails below, later update()s must flow through the diff +
    // debounce path instead of re-entering createPlayer (and re-emitting
    // NotSupportedError) on every single call.
    created = true
    destroyPlayer(true)
    const myGen = gen

    if (!opts.url || !video) return
    if (MSE_REQUIRED_TYPES.includes(opts.type) && !playerFactory.isSupported()) {
      handlers?.onError?.('NotSupportedError', 'MediaSource Extensions (MSE) are not supported by this browser', { type: opts.type })
      handlers?.onStatus?.('error')
      return
    }

    handlers?.onStatus?.('connecting')

    const mergedConfig: MpegtsConfig = { ...DEFAULT_CONFIG, ...opts.config }
    const source = buildSource()

    player = playerFactory.createPlayer(source, mergedConfig)
    player.attachMediaElement(video)

    player.on(PLAYER_EVENTS.ERROR, (errorType: string, errorDetail: string, errorInfo: unknown) => {
      if (myGen !== gen) return
      handlers?.onError?.(errorType, errorDetail, errorInfo)
      if (
        opts.autoReconnect &&
        errorType === 'NetworkError' &&
        RECONNECTABLE_ERRORS.has(errorDetail) &&
        scheduleReconnect()
      ) {
        return // reconnect scheduled — not a terminal error
      }
      handlers?.onStatus?.('error')
    })

    player.on(PLAYER_EVENTS.STATISTICS_INFO, (info: StatisticsInfo) => {
      if (myGen !== gen) return
      handlers?.onStatistics?.(info)
    })
    player.on(PLAYER_EVENTS.MEDIA_INFO, (info: MediaInfo) => {
      if (myGen !== gen) return
      handlers?.onMediaInfo?.(info)
    })
    player.on(PLAYER_EVENTS.RECOVERED_EARLY_EOF, () => {
      if (myGen !== gen) return
      handlers?.onRecovered?.()
    })
    player.on(PLAYER_EVENTS.LOADING_COMPLETE, () => {
      if (myGen !== gen) return
      handlers?.onEnded?.()
      // A live stream closed by the server arrives here as a clean completion
      // with no error (mpegts.js never errors on ws close) — without a retry the
      // picture freezes on the last frame forever. VOD ends normally, so only
      // live streams reconnect.
      if (opts.autoReconnect && opts.isLive) scheduleReconnect()
    })

    player.load()

    if (opts.autoplay) {
      playOnce(() => {
        // 浏览器自动播放策略拦截了带声音的播放，降级为静音重试
        // （与 video.js 的 manualAutoplay_("any") 行为保持一致）
        if (!opts.muted && player) {
          video.muted = true
          const fallback = player.play()
          if (fallback instanceof Promise) {
            fallback.then(
              () => {
                if (myGen !== gen) return
                markPlaying()
              },
              () => {
                if (myGen !== gen) return
                handlers?.onStatus?.('stopped')
              },
            )
          } else {
            markPlaying()
          }
        } else {
          handlers?.onStatus?.('stopped')
        }
      })
    }
  }

  function update(next: PlayerEngineOptions) {
    const prev = opts
    handlers = next.handlers
    opts = resolve(next)

    if (!opts.url) {
      // Vue url-watcher parity: clearing the url tears down (nosignal only
      // when a player actually existed — destroyPlayer handles that).
      destroyPlayer()
      return
    }
    if (!created) {
      // Cold start: engine constructed without url (or url arrived late).
      createPlayer()
      return
    }
    if (!sourceEqual(prev, opts)) {
      // 重建: debounce collapsing rapid prop mutations (e.g. config slider)
      // into a single rebuild. `rebuild: false` rebuilds immediately.
      clearTimeout(recreateTimer)
      if (opts.rebuild === false) {
        createPlayer()
      } else {
        recreateTimer = window.setTimeout(() => {
          recreateTimer = undefined
          createPlayer()
        }, opts.rebuild?.debounceMs ?? 300)
      }
    }
    if (opts.muted !== prev.muted) {
      video.muted = opts.muted
    }
  }

  // Mount parity: constructing with a url creates immediately (the adapters
  // used to call createPlayer() right in onMounted / first effect).
  if (opts.url && video) createPlayer()

  return {
    update,
    destroy: (silent = false) => destroyPlayer(silent),
    play: () => playOnce(() => handlers?.onStatus?.('stopped')),
    pause: () => {
      if (!player) return
      player.pause()
      handlers?.onStatus?.('stopped')
    },
    reload: () => createPlayer(),
    setMuted: (muted: boolean) => {
      video.muted = muted
    },
    getPlayer: () => player,
    getVolume: () => video.volume,
    setVolume: (volume: number) => {
      video.volume = volume
    },
    seek: (seconds: number) => {
      // player.currentTime routes through mpegts.js (range-load), not a bare
      // <video> assign which would bypass segment loading for VOD.
      if (player) player.currentTime = seconds
    },
    getCurrentTime: () => video.currentTime,
    getBufferedRanges: () => video.buffered ?? null,
    getStatistics: () => (player?.statisticsInfo as StatisticsInfo | undefined) ?? null,
  }
}
