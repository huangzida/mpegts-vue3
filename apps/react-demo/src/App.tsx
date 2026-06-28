import React, { useCallback, useEffect, useRef, useState } from 'react'

import {
  MpegtsPlayer as MpegtsPlayerImpl,
  type MediaInfo,
  type MpegtsPlayerProps,
  type MpegtsPlayerRef,
  type PlayerStatus,
  type StatisticsInfo,
} from 'mpegts-react'

const DEFAULT_URL = import.meta.env.VITE_DEMO_URL || ''

// ponytail: bridge a @types/react version gap — the lib's built .d.ts is
// emitted with @types/react@18 (forwardRef render returns ReactNode), while
// this app pins @types/react@17 (JSX needs ReactElement | null), so the raw
// import throws TS2786. Recast it to the React-17-typed forwardRef result;
// same component at runtime, only the static type is adjusted. Fix at the
// type-source (align @types/react across lib/app) is out of this file's scope.
const MpegtsPlayer = MpegtsPlayerImpl as unknown as React.ForwardRefExoticComponent<
  React.PropsWithoutRef<MpegtsPlayerProps> & React.RefAttributes<MpegtsPlayerRef>
>
const STORAGE_KEY = 'mpegts_demo_url'

type GridLayout = 1 | 4 | 9

const STATUS_COLORS: Record<PlayerStatus, string> = {
  connecting: 'text-yellow-500',
  reconnecting: 'text-yellow-500',
  error: 'text-red-500',
  nosignal: 'text-gray-400',
  playing: 'text-green-500',
  stopped: 'text-gray-400',
}

// ponytail: lower = worse. Worst-of aggregate = lowest severity across tiles.
// Format mpegts.js speed (KB/s float) — integer KB/s, auto MB/s past 1024.
function fmtSpeed(kbps?: number): string {
  if (kbps == null || kbps < 0 || Number.isNaN(kbps)) return '0 KB/s'
  return kbps < 1024 ? `${Math.round(kbps)} KB/s` : `${(kbps / 1024).toFixed(1)} MB/s`
}

const SEVERITY: Record<PlayerStatus, number> = {
  error: 0,
  reconnecting: 1,
  connecting: 2,
  playing: 3,
  stopped: 4,
  nosignal: 5,
}

const GRID_COLS: Record<GridLayout, string> = {
  1: 'grid-cols-1',
  4: 'grid-cols-2',
  9: 'grid-cols-3',
}

function worstOf(statuses: Record<number, PlayerStatus>, count: number): PlayerStatus {
  let worst: PlayerStatus = 'nosignal'
  let rank = SEVERITY.nosignal
  for (let i = 0; i < count; i++) {
    const s = statuses[i]
    if (s && SEVERITY[s] < rank) {
      worst = s
      rank = SEVERITY[s]
    }
  }
  return worst
}

export default function App() {
  const [url, setUrl] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_URL)
  const [inputUrl, setInputUrl] = useState(url)
  const [muted, setMuted] = useState(true)
  const [gridLayout, setGridLayout] = useState<GridLayout>(1)
  const [enableWorker, setEnableWorker] = useState(true)
  const [statuses, setStatuses] = useState<Record<number, PlayerStatus>>({})
  const [stats, setStats] = useState<Record<number, StatisticsInfo>>({})
  const [mediaInfos, setMediaInfos] = useState<Record<number, MediaInfo>>({})

  const playerRefs = useRef<Record<number, MpegtsPlayerRef>>({})

  useEffect(() => {
    if (url) localStorage.setItem(STORAGE_KEY, url)
    else localStorage.removeItem(STORAGE_KEY)
  }, [url])

  // ponytail: fresh object each render is fine — the lib collapses `config`
  // via JSON.stringify in its sourceSignature, so a rebuild only fires when
  // enableWorker actually flips, not every render.
  const config = { enableWorker }
  const aggregateStatus = worstOf(statuses, gridLayout)

  const applyUrl = useCallback(() => {
    const trimmed = inputUrl.trim()
    setUrl(trimmed)
    setInputUrl(trimmed)
  }, [inputUrl])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') applyUrl()
    },
    [applyUrl],
  )

  const setPlayerRef = useCallback((i: number, el: MpegtsPlayerRef | null) => {
    if (el) playerRefs.current[i] = el
    else delete playerRefs.current[i]
  }, [])

  const reloadAll = useCallback(() => {
    for (const r of Object.values(playerRefs.current)) r?.reload()
  }, [])

  const playAll = useCallback(() => {
    for (const r of Object.values(playerRefs.current)) r?.play()
  }, [])

  const pauseAll = useCallback(() => {
    for (const r of Object.values(playerRefs.current)) r?.pause()
  }, [])

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-[1800px] flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg
              className="size-6 text-blue-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h2 className="m-0 text-lg font-semibold">mpegts-react Demo</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Status:</span>
            <span className={`text-sm font-medium ${STATUS_COLORS[aggregateStatus]}`}>
              {aggregateStatus}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="xl:col-span-3">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Views:</span>
              {([1, 4, 9] as GridLayout[]).map((g) => (
                <button
                  key={g}
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    gridLayout === g
                      ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                      : 'border-gray-700 hover:border-blue-500 hover:text-blue-500'
                  }`}
                  onClick={() => setGridLayout(g)}
                >
                  {g}
                </button>
              ))}
              <div className="ml-auto flex gap-2">
                <button
                  className="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                  onClick={reloadAll}
                >
                  Reload
                </button>
                <button
                  className="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                  onClick={playAll}
                >
                  Play
                </button>
                <button
                  className="rounded border border-gray-700 px-3 py-1 text-xs hover:bg-gray-800"
                  onClick={pauseAll}
                >
                  Pause
                </button>
              </div>
            </div>

            <div className={`grid w-full gap-2 ${GRID_COLS[gridLayout]}`}>
              {Array.from({ length: gridLayout }, (_, i) => {
                const mi = mediaInfos[i]
                const st = stats[i]
                return (
                  <div
                    key={i}
                    className="relative aspect-video border border-gray-700 bg-black shadow-sm"
                  >
                    <MpegtsPlayer
                      ref={(el) => setPlayerRef(i, el)}
                      url={url}
                      muted={muted}
                      config={config}
                      onStatus={(s) => setStatuses((p) => ({ ...p, [i]: s }))}
                      onStatistics={(info) => setStats((p) => ({ ...p, [i]: info }))}
                      onMediaInfo={(info) => setMediaInfos((p) => ({ ...p, [i]: info }))}
                    />
                    {mi?.height && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                        {mi.height}p{mi.videoCodec ? ` · ${mi.videoCodec}` : ''}
                      </span>
                    )}
                    {st && (
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-200">
                        {st.speed != null ? `↓ ${fmtSpeed(st.speed)} · ` : ''}
                        {st.decodedFrames != null ? `${st.decodedFrames}f · ` : ''}
                        drop {st.droppedFrames ?? 0}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
              <h3 className="m-0 mb-3 text-sm font-semibold">Stream URL</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="ws://host:port/live/stream.flv"
                  className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-xs text-white outline-none focus:border-blue-500"
                />
                <button
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700"
                  onClick={applyUrl}
                >
                  Apply
                </button>
              </div>
              {!url && (
                <p className="mt-3 text-xs text-gray-500">
                  Enter a stream URL to begin. Empty URL shows No Signal.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4">
              <h3 className="m-0 mb-3 text-sm font-semibold">Playback</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Muted</span>
                  <button
                    className={`rounded border px-3 py-1 text-xs transition-colors ${
                      muted
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-gray-700 hover:border-blue-500'
                    }`}
                    onClick={() => setMuted((v) => !v)}
                  >
                    {muted ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <label htmlFor="enableWorker" className="text-xs text-gray-400">
                    enableWorker
                  </label>
                  <button
                    id="enableWorker"
                    className={`rounded border px-3 py-1 text-xs transition-colors ${
                      enableWorker
                        ? 'border-blue-500 bg-blue-500/10 text-blue-500'
                        : 'border-gray-700 hover:border-blue-500'
                    }`}
                    onClick={() => setEnableWorker((v) => !v)}
                    aria-pressed={enableWorker}
                  >
                    {enableWorker ? 'ON' : 'OFF'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                    onClick={playAll}
                  >
                    Play
                  </button>
                  <button
                    className="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                    onClick={pauseAll}
                  >
                    Pause
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
