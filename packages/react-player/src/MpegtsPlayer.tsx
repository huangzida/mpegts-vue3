// Client-only: mpegts.js touches `window` at module load. SSR consumers must
// wrap this component (Nuxt <ClientOnly> / next/dynamic { ssr: false }).
import Mpegts from 'mpegts.js'
import {
  forwardRef,
  type CSSProperties,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import type { MediaDataSource, MediaInfo, MpegtsConfig, PlayerStatus, ReconnectConfig, StatisticsInfo } from './types'

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
}

// mpegts.js createPlayer() routes these types to MSEPlayer (needs MediaSource);
// any other type routes to NativePlayer (native <video>, no MSE). Only gate on
// isSupported() for the MSE-required set.
const MSE_REQUIRED_TYPES: string[] = ['mse', 'mpegts', 'm2ts', 'flv']

// mpegts.js only auto-reconnects VOD; for live it throws to the upper layer.
// These transient network error details are the ones worth retrying (not
// HttpStatusCodeInvalid, which is a permanent 4xx/5xx).
const RECONNECTABLE_ERRORS = new Set(['Exception', 'ConnectingTimeout', 'UnrecoverableEarlyEof'])

// ponytail: static styles hoisted to module scope (allocated once, not per
// render) and the one keyframe injected once — mirrors the Vue sibling's
// ensureKeyframe, instead of rendering a <style> per instance.
const containerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  backgroundColor: '#000',
  overflow: 'hidden',
}
const overlayBase: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
}
const noSignalOverlay: CSSProperties = { ...overlayBase, backgroundColor: 'rgba(0, 0, 0, 1)' }
const connectingOverlay: CSSProperties = { ...overlayBase, backgroundColor: 'rgba(0, 0, 0, 0.6)' }
const errorOverlay: CSSProperties = { ...overlayBase, backgroundColor: 'rgba(0, 0, 0, 0.6)' }
const spinnerStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  border: '2px solid #3b82f6',
  borderTopColor: 'transparent',
  animation: 'mpegts-spin 1s linear infinite',
}
let keyframeInjected = false
function ensureKeyframe() {
  if (keyframeInjected || typeof document === 'undefined') return
  keyframeInjected = true
  const el = document.createElement('style')
  el.textContent = '@keyframes mpegts-spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(el)
}

export interface MpegtsPlayerProps {
  url: string
  autoplay?: boolean
  isLive?: boolean
  muted?: boolean
  objectFit?: CSSProperties['objectFit']
  type?: string
  cors?: boolean
  withCredentials?: boolean
  hasAudio?: boolean
  hasVideo?: boolean
  duration?: number
  filesize?: number
  showLoading?: boolean
  config?: Partial<MpegtsConfig>
  onStatus?: (status: PlayerStatus) => void
  onError?: (errorType: string, errorDetail: string, errorInfo: any) => void
  onStatistics?: (info: StatisticsInfo) => void
  onMediaInfo?: (info: MediaInfo) => void
  onRecovered?: () => void
  onEnded?: () => void
  autoReconnect?: boolean
  reconnect?: ReconnectConfig
}

export interface MpegtsPlayerRef {
  play: () => void
  pause: () => void
  reload: () => void
  setMuted: (muted: boolean) => void
  getPlayer: () => Mpegts.Player | null
  getVolume: () => number
  setVolume: (volume: number) => void
  seek: (seconds: number) => void
  getCurrentTime: () => number
  getBufferedRanges: () => TimeRanges | null
  getStatistics: () => StatisticsInfo | null
}

export const MpegtsPlayer = forwardRef<MpegtsPlayerRef, MpegtsPlayerProps>(
  function MpegtsPlayer(props, ref) {
    const {
      url,
      autoplay = true,
      isLive = true,
      muted = true,
      objectFit = 'fill',
      type = 'mse',
      cors,
      withCredentials,
      hasAudio = true,
      hasVideo = true,
      duration,
      filesize,
      showLoading = true,
      config,
      onStatus,
      onError,
      onStatistics,
      onMediaInfo,
      onRecovered,
      onEnded,
      autoReconnect = true,
      reconnect,
    } = props

    const videoRef = useRef<HTMLVideoElement>(null)
    const playerRef = useRef<Mpegts.Player | null>(null)
    const [status, setStatus] = useState<PlayerStatus>('nosignal')

    const onStatusRef = useRef(onStatus)
    onStatusRef.current = onStatus
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError
    const onStatisticsRef = useRef(onStatistics)
    onStatisticsRef.current = onStatistics
    const onMediaInfoRef = useRef(onMediaInfo)
    onMediaInfoRef.current = onMediaInfo
    const onRecoveredRef = useRef(onRecovered)
    onRecoveredRef.current = onRecovered
    const onEndedRef = useRef(onEnded)
    onEndedRef.current = onEnded
    const autoReconnectRef = useRef(autoReconnect)
    autoReconnectRef.current = autoReconnect
    const reconnectRef = useRef(reconnect)
    reconnectRef.current = reconnect

    // ponytail: generation guard — bump on every destroy/cleanup so in-flight
    // autoplay promise callbacks bail instead of setState after unmount or
    // writing status for a stale player (P0-3).
    const genRef = useRef(0)
    const reconnectAttemptsRef = useRef(0)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // ponytail: JSON signature collapses all create-affecting props into one
    // effect dep, so config/source changes now recreate the player instead of
    // being silently ignored (P0-2). String compare = value equality.
    const sourceSignature = JSON.stringify({
      url,
      type,
      isLive,
      cors,
      withCredentials,
      hasAudio,
      hasVideo,
      duration,
      filesize,
      config,
    })

    // Imperative reload: bumping this re-runs the create effect (reconnect).
    const [reloadNonce, setReloadNonce] = useState(0)

    const updateStatus = useCallback((s: PlayerStatus) => {
      setStatus(s)
      onStatusRef.current?.(s)
    }, [])

    const markPlaying = useCallback(() => {
      reconnectAttemptsRef.current = 0
      updateStatus('playing')
    }, [updateStatus])

    // mpegts.js throws live early-eof to the upper layer; we own reconnect.
    const scheduleReconnect = useCallback((): boolean => {
      const { retries = 5, minDelay = 1000, maxDelay = 16000 } = reconnectRef.current ?? {}
      if (reconnectAttemptsRef.current >= retries) return false
      const delay = Math.min(maxDelay, minDelay * 2 ** reconnectAttemptsRef.current)
      reconnectAttemptsRef.current++
      updateStatus('reconnecting')
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        setReloadNonce((n) => n + 1)
      }, delay)
      return true
    }, [updateStatus])

    const doPlay = useCallback(() => {
      const player = playerRef.current
      if (!player || !videoRef.current) return
      const myGen = genRef.current
      videoRef.current.muted = muted
      const result = player.play()
      if (result instanceof Promise) {
        result
          .then(() => { if (myGen === genRef.current) markPlaying() })
          .catch(() => { if (myGen === genRef.current) updateStatus('stopped') })
      } else {
        markPlaying()
      }
    }, [updateStatus, markPlaying, muted])

    const doPause = useCallback(() => {
      const player = playerRef.current
      if (!player) return
      player.pause()
      updateStatus('stopped')
    }, [updateStatus])

    const reload = useCallback(() => setReloadNonce((n) => n + 1), [])
    const setMuted = useCallback((m: boolean) => {
      if (videoRef.current) videoRef.current.muted = m
    }, [])
    const getPlayer = useCallback((): Mpegts.Player | null => playerRef.current, [])
    const getVolume = useCallback(() => videoRef.current?.volume ?? 0, [])
    const setVolume = useCallback((v: number) => {
      if (videoRef.current) videoRef.current.volume = v
    }, [])
    const seek = useCallback((seconds: number) => {
      // player.currentTime routes through mpegts.js (range-load), not a bare
      // <video> assign which would bypass segment loading for VOD.
      if (playerRef.current) playerRef.current.currentTime = seconds
    }, [])
    const getCurrentTime = useCallback(() => videoRef.current?.currentTime ?? 0, [])
    const getBufferedRanges = useCallback(() => videoRef.current?.buffered ?? null, [])
    const getStatistics = useCallback((): StatisticsInfo | null =>
      (playerRef.current?.statisticsInfo as StatisticsInfo | undefined) ?? null, [])

    useImperativeHandle(
      ref,
      () => ({
        play: doPlay, pause: doPause, reload, setMuted, getPlayer,
        getVolume, setVolume, seek, getCurrentTime, getBufferedRanges, getStatistics,
      }),
      [doPlay, doPause, reload, setMuted, getPlayer, getVolume, setVolume, seek, getCurrentTime, getBufferedRanges, getStatistics],
    )

    useEffect(() => {
      if (!url || !videoRef.current) return
      if (MSE_REQUIRED_TYPES.includes(type) && !Mpegts.isSupported()) {
        updateStatus('error')
        onErrorRef.current?.('NotSupportedError', 'MediaSource Extensions (MSE) are not supported by this browser', { type })
        return
      }

      const myGen = ++genRef.current

      updateStatus('connecting')

      const mergedConfig: MpegtsConfig = { ...DEFAULT_CONFIG, ...config }
      const source: MediaDataSource = {
        type,
        isLive,
        url,
      }
      if (cors !== undefined) source.cors = cors
      if (withCredentials !== undefined) source.withCredentials = withCredentials
      // 默认 hasAudio/hasVideo: true，避免某些 FLV 流（如 ZLMediaKit）
      // 的 header flag 未标记音/视频导致对应包被丢弃（表现为黑屏/无声）
      source.hasAudio = hasAudio
      source.hasVideo = hasVideo
      if (duration !== undefined) source.duration = duration
      if (filesize !== undefined) source.filesize = filesize

      const player = Mpegts.createPlayer(source, mergedConfig)
      playerRef.current = player

      player.attachMediaElement(videoRef.current)

      player.on(
        Mpegts.Events.ERROR,
        (errorType: string, errorDetail: string, errorInfo: any) => {
          if (myGen !== genRef.current) return
          onErrorRef.current?.(errorType, errorDetail, errorInfo)
          if (
            autoReconnectRef.current &&
            errorType === 'NetworkError' &&
            RECONNECTABLE_ERRORS.has(errorDetail) &&
            scheduleReconnect()
          ) {
            return // reconnect scheduled — not a terminal error
          }
          updateStatus('error')
        },
      )

      player.on(Mpegts.Events.STATISTICS_INFO, (info: StatisticsInfo) => {
        if (myGen !== genRef.current) return
        onStatisticsRef.current?.(info)
      })
      player.on(Mpegts.Events.MEDIA_INFO, (info: MediaInfo) => {
        if (myGen !== genRef.current) return
        onMediaInfoRef.current?.(info)
      })
      player.on(Mpegts.Events.RECOVERED_EARLY_EOF, () => {
        if (myGen !== genRef.current) return
        onRecoveredRef.current?.()
      })
      player.on(Mpegts.Events.LOADING_COMPLETE, () => {
        if (myGen !== genRef.current) return
        onEndedRef.current?.()
      })

      player.load()

      if (autoplay) {
        videoRef.current.muted = muted
        const result = player.play()
        if (result instanceof Promise) {
          result
            .then(() => { if (myGen === genRef.current) markPlaying() })
            .catch(() => {
              // 浏览器自动播放策略拦截了带声音的播放，降级为静音重试
              // （与 video.js 的 manualAutoplay_("any") 行为保持一致）
              if (myGen !== genRef.current) return
              if (!muted && videoRef.current && player) {
                videoRef.current.muted = true
                const fallbackResult = player.play()
                if (fallbackResult instanceof Promise) {
                  fallbackResult
                    .then(() => { if (myGen === genRef.current) markPlaying() })
                    .catch(() => { if (myGen === genRef.current) updateStatus('stopped') })
                } else {
                  markPlaying()
                }
              } else {
                updateStatus('stopped')
              }
            })
        } else {
          markPlaying()
        }
      }

      return () => {
        genRef.current++
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current)
          reconnectTimerRef.current = null
        }
        try {
          player.pause()
          player.unload()
          player.detachMediaElement()
          player.destroy()
        } catch {
          // ignore
        }
        if (playerRef.current === player) playerRef.current = null
      }
      // Create-affecting props are captured by `sourceSignature`; `reloadNonce`
      // forces a rebuild. autoplay/muted are read at create time only.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceSignature, reloadNonce])

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = muted
      }
    }, [muted])

    useEffect(() => {
      ensureKeyframe()
    }, [])

    const videoStyle: CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit,
    }

    const showNoSignal = status === 'nosignal' || !url
    const showConnecting = status === 'connecting' && showLoading
    const showError = status === 'error' && !!url

    return (
      <div className="mpegts-player" style={containerStyle}>
        {/* ponytail: data-stream-url/type 无测试覆盖，删除绑定会静默回归 */}
        <video
          ref={videoRef}
          style={videoStyle}
          data-stream-url={url}
          data-stream-type={type}
          onClick={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />

        {showNoSignal && (
          <div style={noSignalOverlay}>
            <svg
              width={40}
              height={40}
              fill="none"
              stroke="#fff"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18 12 6 12M18 8 6 8M18 16l-12 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: '#fff',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              No Signal
            </span>
          </div>
        )}

        {showConnecting && (
          <div style={connectingOverlay}>
            <div style={spinnerStyle} />
            <span style={{ marginTop: 12, fontSize: 14, color: '#d1d5db' }}>
              Connecting...
            </span>
          </div>
        )}

        {showError && (
          <div style={errorOverlay}>
            <svg
              width={32}
              height={32}
              fill="none"
              stroke="#f87171"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span style={{ marginTop: 8, fontSize: 14, color: '#f87171' }}>
              Connection Failed
            </span>
          </div>
        )}
      </div>
    )
  },
)
