import type { MediaDataSource, MpegtsConfig, PlayerFactory } from './types'

export type Deferred = {
  promise: Promise<unknown>
  resolve: (v?: unknown) => void
  reject: (e?: unknown) => void
}

export function createDeferred(): Deferred {
  let resolve!: (v?: unknown) => void
  let reject!: (e?: unknown) => void
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** The single source of truth that tests assert against. */
export const recorder = {
  players: [] as MockPlayer[],
  isSupported: true,
}

export function resetRecorder() {
  recorder.players.length = 0
  recorder.isSupported = true
}

export class MockPlayer {
  calls: string[] = []
  source: MediaDataSource
  config: MpegtsConfig
  handlers: Record<string, (...args: never[]) => void> = {}
  playDeferred: Deferred | null = null
  currentTime = 0
  statisticsInfo: unknown = { speed: 0, decodedFrames: 0, droppedFrames: 0 }

  constructor(source: MediaDataSource, config: MpegtsConfig) {
    this.source = source
    this.config = config
    recorder.players.push(this)
  }

  attachMediaElement() {
    this.calls.push('attachMediaElement')
  }

  on(event: string, cb: (...args: never[]) => void) {
    this.handlers[event] = cb
  }

  fire(event: string, ...args: unknown[]) {
    // Test-only widening: handlers are stored variance-erased (never[] cb) to
    // satisfy MpegtsPlayerLike.on; re-widen for invocation.
    (this.handlers[event] as ((...a: unknown[]) => void) | undefined)?.(...args)
  }

  load() {
    this.calls.push('load')
  }

  play() {
    this.calls.push('play')
    this.playDeferred = createDeferred()
    return this.playDeferred.promise
  }

  pause() {
    this.calls.push('pause')
  }

  unload() {
    this.calls.push('unload')
  }

  detachMediaElement() {
    this.calls.push('detachMediaElement')
  }

  destroy() {
    this.calls.push('destroy')
  }
}

/** For engine tests: plain dependency injection, no module mocking. */
export function createMockFactory(): PlayerFactory {
  return {
    isSupported: () => recorder.isSupported,
    createPlayer: (source, config) => new MockPlayer(source, config),
  }
}

/**
 * For adapter (component) specs, which go through the real default factory:
 * `vi.mock('mpegts.js', async () => (await import('mpegts-core/testing')).mockMpegtsModule())`.
 * Replaces the ~75-line vi.hoisted harness both specs used to carry.
 */
export function mockMpegtsModule() {
  return {
    default: {
      isSupported: () => recorder.isSupported,
      createPlayer: (source: MediaDataSource, config: MpegtsConfig) => new MockPlayer(source, config),
      Events: {
        ERROR: 'error',
        STATISTICS_INFO: 'statistics_info',
        MEDIA_INFO: 'media_info',
        RECOVERED_EARLY_EOF: 'recovered_early_eof',
        LOADING_COMPLETE: 'loading_complete',
      },
    },
  }
}
