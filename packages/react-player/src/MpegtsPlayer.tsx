// Client-only: mpegts.js touches `window` at module load. SSR consumers must
// wrap this component (Nuxt <ClientOnly> / next/dynamic { ssr: false }).
import { forwardRef, type CSSProperties, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type Mpegts from 'mpegts.js'

// PlayerEngine — the framework-agnostic module that owns the whole mpegts.js
// lifecycle (config merge, MSE gate, gen guard, 重建 debounce, Live 重连,
// event mapping, autoplay fallback, destroy sequence). This component is just
// the React adapter: props → engine.update(), engine handlers → callbacks.
import { createPlayerEngine, type PlayerEngine } from '../../core/src/index'

import type { MediaInfo, MpegtsConfig, PlayerStatus, ReconnectConfig, StatisticsInfo } from './types'

// ponytail: static styles hoisted to module scope (allocated once, not per
// render) and the one keyframe injected once.
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
  onError?: (errorType: string, errorDetail: string, errorInfo: unknown) => void
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
    const { url, type = 'mse', objectFit = 'fill', showLoading = true } = props

    const videoRef = useRef<HTMLVideoElement>(null)
    const engineRef = useRef<PlayerEngine | null>(null)
    const [status, setStatus] = useState<PlayerStatus>('nosignal')

    // Full snapshot on every call — the engine diffs create-affecting keys
    // itself. Handlers are rebuilt each render and re-read at dispatch, so
    // callbacks are always fresh without ref juggling.
    function collect() {
      const {
        url, autoplay = true, isLive = true, muted = true, type = 'mse',
        cors, withCredentials, hasAudio = true, hasVideo = true,
        duration, filesize, config, autoReconnect = true, reconnect,
        onStatus, onError, onStatistics, onMediaInfo, onRecovered, onEnded,
      } = props
      return {
        video: videoRef.current as HTMLVideoElement,
        url, autoplay, isLive, muted, type, cors, withCredentials,
        hasAudio, hasVideo, duration, filesize, config, autoReconnect, reconnect,
        handlers: {
          onStatus: (s: PlayerStatus) => {
            setStatus(s)
            onStatus?.(s)
          },
          onError: (errorType: string, errorDetail: string, errorInfo: unknown) => onError?.(errorType, errorDetail, errorInfo),
          onStatistics: (info: StatisticsInfo) => onStatistics?.(info),
          onMediaInfo: (info: MediaInfo) => onMediaInfo?.(info),
          onRecovered: () => onRecovered?.(),
          onEnded: () => onEnded?.(),
        },
      }
    }

    useEffect(() => {
      ensureKeyframe()
      // Constructing with a url creates immediately (mount parity).
      engineRef.current = createPlayerEngine(collect())
      return () => {
        engineRef.current?.destroy()
        engineRef.current = null
      }
      // Mount/unmount only: every render below flows through engine.update().
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
      engineRef.current?.update(collect())
    })

    useImperativeHandle(
      ref,
      () => ({
        play: () => engineRef.current?.play(),
        pause: () => engineRef.current?.pause(),
        reload: () => engineRef.current?.reload(),
        setMuted: (muted: boolean) => engineRef.current?.setMuted(muted),
        getPlayer: () => (engineRef.current?.getPlayer() as Mpegts.Player | null) ?? null,
        getVolume: () => engineRef.current?.getVolume() ?? 0,
        setVolume: (volume: number) => engineRef.current?.setVolume(volume),
        seek: (seconds: number) => engineRef.current?.seek(seconds),
        getCurrentTime: () => engineRef.current?.getCurrentTime() ?? 0,
        getBufferedRanges: () => engineRef.current?.getBufferedRanges() ?? null,
        getStatistics: () => engineRef.current?.getStatistics() ?? null,
      }),
      [],
    )

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
