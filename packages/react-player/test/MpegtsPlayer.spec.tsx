import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef } from 'react';
import { MpegtsPlayer, type MpegtsPlayerRef } from '../src/MpegtsPlayer';

const { recorder, MockPlayer } = vi.hoisted(() => {
  type Deferred = {
    promise: Promise<unknown>;
    resolve: (v?: unknown) => void;
    reject: (e?: unknown) => void;
  };
  function createDeferred(): Deferred {
    let resolve!: (v?: unknown) => void;
    let reject!: (e?: unknown) => void;
    const promise = new Promise<unknown>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  class MockPlayer {
    calls: string[] = [];
    source: any;
    config: any;
    errorCb: ((t: string, d: string, i: unknown) => void) | null = null;
    handlers = new Map<string, (...args: any[]) => void>();
    playDeferred: Deferred | null = null;
    currentTime = 0;
    statisticsInfo: any = { speed: 0, decodedFrames: 0, droppedFrames: 0 };
    constructor(source: any, config: any) {
      this.source = source;
      this.config = config;
      recorder.players.push(this);
    }
    attachMediaElement() {
      this.calls.push('attachMediaElement');
    }
    on(event: string, cb: any) {
      this.handlers.set(event, cb);
    }
    fire(event: string, ...args: any[]) {
      this.handlers.get(event)?.(...args);
    }
    load() {
      this.calls.push('load');
    }
    play() {
      this.calls.push('play');
      this.playDeferred = createDeferred();
      return this.playDeferred.promise;
    }
    pause() {
      this.calls.push('pause');
    }
    unload() {
      this.calls.push('unload');
    }
    detachMediaElement() {
      this.calls.push('detachMediaElement');
    }
    destroy() {
      this.calls.push('destroy');
    }
  }

  const recorder = { players: [] as MockPlayer[], isSupported: true };
  return { recorder, MockPlayer };
});

vi.mock('mpegts.js', () => ({
  default: {
    isSupported: () => recorder.isSupported,
    createPlayer: (source: any, config: any) => new MockPlayer(source, config),
    Events: { ERROR: 'error', STATISTICS_INFO: 'statistics_info', MEDIA_INFO: 'media_info', RECOVERED_EARLY_EOF: 'recovered_early_eof', LOADING_COMPLETE: 'loading_complete' },
  },
}));

describe('MpegtsPlayer (React)', () => {
  const statuses: string[] = [];
  const errors: Array<[string, string, unknown]> = [];
  const statistics: any[] = [];
  const mediaInfos: any[] = [];
  let recovered = 0;
  let ended = 0;
  const onStatus = (s: string) => statuses.push(s);
  const onError = (t: string, d: string, i: unknown) => errors.push([t, d, i]);
  const onStatistics = (i: any) => statistics.push(i);
  const onMediaInfo = (i: any) => mediaInfos.push(i);
  const onRecovered = () => { recovered++ };
  const onEnded = () => { ended++ };

  beforeEach(() => {
    recorder.players.length = 0;
    recorder.isSupported = true;
    statuses.length = 0;
    errors.length = 0;
    statistics.length = 0;
    mediaInfos.length = 0;
    recovered = 0;
    ended = 0;
  });
  afterEach(() => cleanup());

  const renderIt = (props: Record<string, unknown> = {}) => {
    const ref = createRef<MpegtsPlayerRef>();
    const utils = render(
      <MpegtsPlayer
        ref={ref}
        url="ws://x/live.flv"
        onStatus={onStatus}
        onError={onError}
        onStatistics={onStatistics}
        onMediaInfo={onMediaInfo}
        onRecovered={onRecovered}
        onEnded={onEnded}
        {...props}
      />,
    );
    return { ref, ...utils };
  };

  it('mount: lifecycle order + load-bearing source fields (hasVideo guard)', () => {
    renderIt();
    expect(recorder.players).toHaveLength(1);
    const p = recorder.players[0];
    expect(p.calls).toEqual(['attachMediaElement', 'load', 'play']);
    expect(p.source).toMatchObject({
      url: 'ws://x/live.flv',
      isLive: true,
      type: 'mse',
      hasAudio: true,
      hasVideo: true, // ← the black-screen regression lived here
    });
  });

  it('unmount: cleanup order pause→unload→detach→destroy', () => {
    const { unmount } = renderIt();
    const p = recorder.players[0];
    p.calls.length = 0;
    unmount();
    expect(p.calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
  });

  it('config merge: user key wins, default key present', () => {
    renderIt({ config: { enableStashBuffer: true } });
    const cfg = recorder.players[0].config;
    expect(cfg.enableStashBuffer).toBe(true);
    expect(cfg.liveSync).toBe(true);
  });

  it('gen guard: stale play promise after url change does not emit playing', async () => {
    const { rerender } = renderIt({ url: 'url1' });
    const p1 = recorder.players[0];
    expect(statuses.includes('playing')).toBe(false);

    // change a create-affecting prop → effect cleanup (gen++) + recreate
    rerender(<MpegtsPlayer url="url2" onStatus={onStatus} />);
    const p2 = recorder.players[1];

    await act(async () => {
      p1.playDeferred!.resolve(); // stale generation → must bail
    });
    expect(statuses.filter((s) => s === 'playing')).toHaveLength(0);

    await act(async () => {
      p2.playDeferred!.resolve(); // current generation → emits playing
    });
    expect(statuses.filter((s) => s === 'playing')).toHaveLength(1);
  });

  it('sourceSignature: changing config recreates the player', () => {
    const { rerender } = renderIt();
    expect(recorder.players).toHaveLength(1);
    rerender(<MpegtsPlayer url="ws://x/live.flv" onStatus={onStatus} config={{ enableStashBuffer: true }} />);
    expect(recorder.players).toHaveLength(2);
  });

  it('ref methods: reload() recreates, getPlayer() returns instance', () => {
    const { ref } = renderIt();
    expect(recorder.players).toHaveLength(1);
    expect(ref.current?.getPlayer()).toBe(recorder.players[0]);
    act(() => {
      ref.current?.reload();
    });
    expect(recorder.players).toHaveLength(2);
  });

  it('isSupported() false (MSE type) → error status + NotSupportedError, no player', () => {
    recorder.isSupported = false;
    renderIt();
    expect(recorder.players).toHaveLength(0);
    expect(statuses.includes('error')).toBe(true);
    expect(errors[0]?.[0]).toBe('NotSupportedError');
  });

  it('non-MSE type bypasses the MSE gate (NativePlayer path)', () => {
    recorder.isSupported = false;
    renderIt({ type: 'mp4' });
    expect(recorder.players).toHaveLength(1);
  });

  it('forwards STATISTICS_INFO and MEDIA_INFO events', async () => {
    renderIt();
    const p = recorder.players[0];
    await act(async () => {
      p.fire('statistics_info', { speed: 100 });
      p.fire('media_info', { width: 1920 });
    });
    expect(statistics[0]).toMatchObject({ speed: 100 });
    expect(mediaInfos[0]).toMatchObject({ width: 1920 });
  });

  it('autoReconnect=false → transient network error is terminal', async () => {
    renderIt({ autoReconnect: false });
    await act(async () => {
      recorder.players[0].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    });
    expect(statuses.at(-1)).toBe('error');
    expect(statuses.includes('reconnecting')).toBe(false);
  });

  it('auto-reconnects on transient network error, resets on success', async () => {
    vi.useFakeTimers();
    renderIt({ reconnect: { retries: 3, minDelay: 1000, maxDelay: 8000 } });
    const p1 = recorder.players[0];
    await act(async () => {
      p1.fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    });
    expect(statuses.includes('reconnecting')).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(recorder.players).toHaveLength(2);
    await act(async () => { recorder.players[1].playDeferred!.resolve(); });
    expect(statuses.filter((s) => s === 'playing')).toHaveLength(1);
    vi.useRealTimers();
  });

  it('gives up after retries exhausted → terminal error', async () => {
    vi.useFakeTimers();
    renderIt({ reconnect: { retries: 2, minDelay: 500, maxDelay: 500 } });
    await act(async () => { recorder.players[0].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await act(async () => { recorder.players[1].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    await act(async () => { recorder.players[2].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {}); });
    expect(recorder.players).toHaveLength(3);
    expect(statuses.at(-1)).toBe('error');
    vi.useRealTimers();
  });

  it('control-bar ref methods: volume / seek / statistics', () => {
    const { ref } = renderIt();
    const api = ref.current!;
    act(() => { api.setVolume(0.5); });
    expect(api.getVolume()).toBe(0.5);
    act(() => { api.seek(42); });
    expect(recorder.players[0].currentTime).toBe(42);
    expect(api.getStatistics()).toBe(recorder.players[0].statisticsInfo);
  });

  it('forwards LOADING_COMPLETE → ended event', async () => {
    renderIt();
    await act(async () => { recorder.players[0].fire('loading_complete'); });
    expect(ended).toBe(1);
  });
});
