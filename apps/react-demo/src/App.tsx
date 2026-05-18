import React, { useCallback, useRef, useState } from 'react'

import { MpegtsPlayer, type MpegtsPlayerRef, type PlayerStatus } from 'mpegts-react'

const DEFAULT_URL = 'ws://192.168.100.94:15354/live/chn1.flv'

const STATUS_COLORS: Record<PlayerStatus, string> = {
  connecting: 'text-yellow-500',
  destroying: 'text-gray-400',
  error: 'text-red-500',
  nosignal: 'text-gray-400',
  playing: 'text-green-500',
  stopped: 'text-gray-400',
}

export default function App() {
  const playerRef = useRef<MpegtsPlayerRef>(null)
  const [url, setUrl] = useState(DEFAULT_URL)
  const [inputUrl, setInputUrl] = useState(DEFAULT_URL)
  const [muted, setMuted] = useState(true)
  const [status, setStatus] = useState<PlayerStatus>('nosignal')

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

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="mx-auto max-w-5xl flex flex-col gap-6">
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
            <span className={`text-sm font-medium ${STATUS_COLORS[status]}`}>
              {status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <div className="aspect-video w-full border border-gray-700 bg-black shadow-sm">
              <MpegtsPlayer
                ref={playerRef}
                url={url}
                muted={muted}
                onStatus={setStatus}
              />
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={`rounded border px-2 py-1 text-xs transition-colors ${
                    url === DEFAULT_URL
                      ? 'border-blue-500 text-blue-500'
                      : 'border-gray-700 hover:border-blue-500 hover:text-blue-500'
                  }`}
                  onClick={() => {
                    setInputUrl(DEFAULT_URL)
                    setUrl(DEFAULT_URL)
                  }}
                >
                  Channel 1
                </button>
              </div>
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
                <div className="flex gap-2">
                  <button
                    className="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                    onClick={() => playerRef.current?.play()}
                  >
                    Play
                  </button>
                  <button
                    className="flex-1 rounded border border-gray-700 px-3 py-1.5 text-xs hover:bg-gray-800"
                    onClick={() => playerRef.current?.pause()}
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
