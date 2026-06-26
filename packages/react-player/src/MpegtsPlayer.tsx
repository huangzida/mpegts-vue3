import Mpegts from 'mpegts.js'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import type { MediaDataSource, MpegtsConfig, PlayerStatus } from './types'

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
}

export interface MpegtsPlayerProps {
  url: string
  autoplay?: boolean
  isLive?: boolean
  muted?: boolean
  objectFit?: React.CSSProperties['objectFit']
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
}

export interface MpegtsPlayerRef {
  play: () => void
  pause: () => void
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
      hasVideo,
      duration,
      filesize,
      showLoading = true,
      config,
      onStatus,
      onError,
    } = props

    const videoRef = useRef<HTMLVideoElement>(null)
    const playerRef = useRef<Mpegts.Player | null>(null)
    const [status, setStatus] = useState<PlayerStatus>('nosignal')

    const onStatusRef = useRef(onStatus)
    onStatusRef.current = onStatus
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError
    const configRef = useRef(config)
    configRef.current = config
    const autoplayRef = useRef(autoplay)
    autoplayRef.current = autoplay
    const mutedRef = useRef(muted)
    mutedRef.current = muted

    const propsRef = useRef({ type, isLive, cors, withCredentials, hasAudio, hasVideo, duration, filesize })
    propsRef.current = { type, isLive, cors, withCredentials, hasAudio, hasVideo, duration, filesize }

    const updateStatus = useCallback((s: PlayerStatus) => {
      setStatus(s)
      onStatusRef.current?.(s)
    }, [])

    const doPlay = useCallback(() => {
      const player = playerRef.current
      if (!player || !videoRef.current) return
      videoRef.current.muted = mutedRef.current
      const result = player.play()
      if (result instanceof Promise) {
        result
          .then(() => updateStatus('playing'))
          .catch(() => updateStatus('stopped'))
      } else {
        updateStatus('playing')
      }
    }, [updateStatus])

    const doPause = useCallback(() => {
      const player = playerRef.current
      if (!player) return
      player.pause()
      updateStatus('stopped')
    }, [updateStatus])

    useImperativeHandle(ref, () => ({ play: doPlay, pause: doPause }), [doPlay, doPause])

    useEffect(() => {
      if (!url || !videoRef.current) return
      if (!Mpegts.isSupported()) {
        updateStatus('error')
        return
      }

      updateStatus('connecting')

      const currentProps = propsRef.current
      const mergedConfig: MpegtsConfig = { ...DEFAULT_CONFIG, ...configRef.current }
      const source: MediaDataSource = {
        type: currentProps.type ?? 'mse',
        isLive: currentProps.isLive,
        url,
      }
      if (currentProps.cors !== undefined) source.cors = currentProps.cors
      if (currentProps.withCredentials !== undefined) source.withCredentials = currentProps.withCredentials
      // 默认 hasAudio: true（via 解构默认值），避免某些 FLV 流（如 ZLMediaKit）
      // 的 header flag 未标记音频导致音频包被丢弃
      source.hasAudio = currentProps.hasAudio
      if (currentProps.hasVideo !== undefined) source.hasVideo = currentProps.hasVideo
      if (currentProps.duration !== undefined) source.duration = currentProps.duration
      if (currentProps.filesize !== undefined) source.filesize = currentProps.filesize

      const player = Mpegts.createPlayer(source, mergedConfig)
      playerRef.current = player

      player.attachMediaElement(videoRef.current)

      player.on(
        Mpegts.Events.ERROR,
        (errorType: string, errorDetail: string, errorInfo: any) => {
          updateStatus('error')
          onErrorRef.current?.(errorType, errorDetail, errorInfo)
        },
      )

      player.load()

      if (autoplayRef.current) {
        videoRef.current.muted = mutedRef.current
        const result = player.play()
        if (result instanceof Promise) {
          result
            .then(() => updateStatus('playing'))
            .catch(() => updateStatus('stopped'))
        } else {
          updateStatus('playing')
        }
      }

      return () => {
        try {
          player.pause()
          player.unload()
          player.detachMediaElement()
          player.destroy()
        } catch {
          // ignore
        }
        playerRef.current = null
      }
    }, [url, updateStatus])

    useEffect(() => {
      if (videoRef.current) {
        videoRef.current.muted = muted
      }
    }, [muted])

    const containerStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: '#000',
      overflow: 'hidden',
    }

    const videoStyle: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit,
    }

    const overlayBase: React.CSSProperties = {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }

    const noSignalOverlay: React.CSSProperties = {
      ...overlayBase,
      backgroundColor: 'rgba(0, 0, 0, 1)',
    }

    const connectingOverlay: React.CSSProperties = {
      ...overlayBase,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    }

    const errorOverlay: React.CSSProperties = {
      ...overlayBase,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
    }

    const spinnerStyle: React.CSSProperties = {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: '2px solid #3b82f6',
      borderTopColor: 'transparent',
      animation: 'mpegts-spin 1s linear infinite',
    }

    const showNoSignal = status === 'nosignal' || !url
    const showConnecting = status === 'connecting' && showLoading
    const showError = status === 'error' && !!url

    return (
      <div className="mpegts-player" style={containerStyle}>
        <video
          ref={videoRef}
          style={videoStyle}
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

        <style>{`@keyframes mpegts-spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  },
)
