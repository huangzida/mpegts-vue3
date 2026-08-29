import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createPlayerEngine } from '../src/index';
import { createMockFactory, recorder, resetRecorder } from '../src/testing';
import type { PlayerEngineOptions, PlayerEventHandlers } from '../src/index';

function makeVideo(): HTMLVideoElement {
  return document.createElement('video');
}

function makeHandlers() {
  const calls = {
    status: [] as string[],
    errors: [] as Array<[string, string, unknown]>,
    statistics: [] as unknown[],
    mediaInfos: [] as unknown[],
    recovered: 0,
    ended: 0,
  };
  const handlers: PlayerEventHandlers = {
    onStatus: (s) => calls.status.push(s),
    onError: (t, d, i) => calls.errors.push([t, d, i]),
    onStatistics: (i) => calls.statistics.push(i),
    onMediaInfo: (i) => calls.mediaInfos.push(i),
    onRecovered: () => calls.recovered++,
    onEnded: () => calls.ended++,
  };
  return { calls, handlers };
}

type Over = Partial<Omit<PlayerEngineOptions, 'handlers'>>;

function makeEngine(over: Over = {}) {
  const { calls, handlers } = makeHandlers();
  const video = makeVideo();
  const engine = createPlayerEngine(
    { video, url: 'ws://x/live.flv', handlers, ...over },
    createMockFactory(),
  );
  // update() replaces handlers wholesale, so the helper must keep passing the
  // same recorder-backed handlers on every snapshot.
  const updateOpts = (o: Over): PlayerEngineOptions => ({ video: makeVideo(), url: 'ws://x/live.flv', handlers, ...o });
  return { engine, calls, video, updateOpts };
}

async function flush() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('PlayerEngine', () => {
  beforeEach(() => resetRecorder());
  afterEach(() => {
    vi.useRealTimers();
  });

  it('create (constructor): lifecycle order + load-bearing source fields (hasVideo guard)', () => {
    const { engine } = makeEngine();
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
    engine.destroy();
  });

  it('config merge: user key wins, default key present', () => {
    const { engine } = makeEngine({ config: { enableStashBuffer: true } });
    const cfg = recorder.players[0].config;
    expect(cfg.enableStashBuffer).toBe(true); // user override
    expect(cfg.liveSync).toBe(true); // default still present
    engine.destroy();
  });

  it('autoplay=false → no play call', () => {
    const { engine, calls } = makeEngine({ autoplay: false });
    expect(recorder.players[0].calls).toEqual(['attachMediaElement', 'load']);
    expect(calls.status).toEqual(['connecting']);
    engine.destroy();
  });

  it('isSupported() false (MSE type) → NotSupportedError + error status, no player', () => {
    recorder.isSupported = false;
    const { engine, calls } = makeEngine();
    expect(recorder.players).toHaveLength(0);
    expect(calls.errors[0]?.[0]).toBe('NotSupportedError');
    expect(calls.status.at(-1)).toBe('error');
    engine.destroy();
  });

  it('non-MSE type bypasses the MSE gate (NativePlayer path)', () => {
    recorder.isSupported = false; // would block mse/flv, but not mp4
    const { engine } = makeEngine({ type: 'mp4' });
    expect(recorder.players).toHaveLength(1); // gate skipped
    engine.destroy();
  });

  it('MSE gate failure consumes the cold start — repeated updates do not re-emit', async () => {
    vi.useFakeTimers();
    recorder.isSupported = false;
    const { engine, calls, updateOpts } = makeEngine();
    expect(calls.errors).toHaveLength(1);
    expect(calls.status.filter((s) => s === 'error')).toHaveLength(1);

    // identical-source updates: no re-entry into createPlayer, no error spam
    engine.update(updateOpts({}));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls.errors).toHaveLength(1);
    expect(calls.status.filter((s) => s === 'error')).toHaveLength(1);

    // a real source change flows through the debounced rebuild → gate fails once more
    engine.update(updateOpts({ url: 'ws://x/other.flv' }));
    await vi.advanceTimersByTimeAsync(300);
    expect(calls.errors).toHaveLength(2);
    engine.destroy();
  });

  it('destroy(silent) tears down without the trailing nosignal (React unmount parity)', () => {
    const { engine, calls } = makeEngine({ autoplay: false });
    const p = recorder.players[0];
    p.calls.length = 0;
    engine.destroy(true);
    expect(p.calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
    expect(calls.status.includes('nosignal')).toBe(false);
  });

  it('destroy: cleanup order pause→unload→detach→destroy + nosignal; idempotent', () => {
    const { engine, calls } = makeEngine();
    const p = recorder.players[0];
    p.calls.length = 0;
    engine.destroy();
    expect(p.calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
    expect(calls.status.at(-1)).toBe('nosignal');
    engine.destroy(); // no player left → no extra emits
    expect(calls.status.filter((s) => s === 'nosignal')).toHaveLength(1);
  });

  it('gen guard: stale play promise after rebuild does not mark playing; current one does', async () => {
    vi.useFakeTimers();
    const { engine, calls, updateOpts } = makeEngine({ url: 'url1' });
    const p1 = recorder.players[0];
    expect(calls.status.includes('playing')).toBe(false);

    engine.update(updateOpts({ url: 'url2' }));
    await vi.advanceTimersByTimeAsync(300); // debounced rebuild
    const p2 = recorder.players[1];

    p1.playDeferred!.resolve(); // stale generation → must bail
    await flush();
    expect(calls.status.filter((s) => s === 'playing')).toHaveLength(0);

    p2.playDeferred!.resolve(); // current generation → playing
    await flush();
    expect(calls.status.filter((s) => s === 'playing')).toHaveLength(1);
    engine.destroy();
  });

  it('debounce: 3 rapid updates collapse to 1 rebuild', async () => {
    vi.useFakeTimers();
    const { engine, updateOpts } = makeEngine();
    expect(recorder.players).toHaveLength(1);

    engine.update(updateOpts({ config: { liveBufferLatencyMaxLatency: 2 } }));
    engine.update(updateOpts({ config: { liveBufferLatencyMaxLatency: 2.2 } }));
    engine.update(updateOpts({ config: { liveBufferLatencyMaxLatency: 2.5 } }));
    expect(recorder.players).toHaveLength(1); // debounced, not yet

    await vi.advanceTimersByTimeAsync(300);
    expect(recorder.players).toHaveLength(2); // single rebuild
    engine.destroy();
  });

  it('rebuild: false → immediate rebuild on change', () => {
    const { engine, updateOpts } = makeEngine({ rebuild: false });
    // update() is a full snapshot — the adapter passes the rebuild policy
    // every time, exactly like any other option.
    engine.update(updateOpts({ config: { enableStashBuffer: true }, rebuild: false }));
    expect(recorder.players).toHaveLength(2);
    expect(recorder.players[1].config.enableStashBuffer).toBe(true);
    engine.destroy();
  });

  it('muted-only update: no rebuild, element synced', () => {
    const { engine, video, updateOpts } = makeEngine({ muted: true });
    engine.update(updateOpts({ muted: false }));
    expect(recorder.players).toHaveLength(1); // no rebuild
    expect(video.muted).toBe(false);
    engine.destroy();
  });

  it('value-equal update: no rebuild', () => {
    const { engine, updateOpts } = makeEngine();
    engine.update(updateOpts({ url: 'ws://x/live.flv', type: 'mse' }));
    expect(recorder.players).toHaveLength(1);
    engine.destroy();
  });

  it('url cleared → teardown + nosignal; no player → no nosignal emit', () => {
    const { engine, calls, updateOpts } = makeEngine();
    recorder.players[0].calls.length = 0;
    engine.update(updateOpts({ url: '' }));
    expect(recorder.players[0].calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
    expect(calls.status.at(-1)).toBe('nosignal');

    engine.update(updateOpts({ url: '' })); // no player → silent
    expect(calls.status.filter((s) => s === 'nosignal')).toHaveLength(1);
  });

  it('url restored after teardown → debounced rebuild', async () => {
    vi.useFakeTimers();
    const { engine, updateOpts } = makeEngine();
    engine.update(updateOpts({ url: '' }));
    engine.update(updateOpts({ url: 'ws://x/live2.flv' }));
    expect(recorder.players).toHaveLength(1); // debounced, not yet
    await vi.advanceTimersByTimeAsync(300);
    expect(recorder.players).toHaveLength(2);
    expect(recorder.players[1].source.url).toBe('ws://x/live2.flv');
    engine.destroy();
  });

  it('forwards STATISTICS_INFO / MEDIA_INFO / RECOVERED_EARLY_EOF / LOADING_COMPLETE', () => {
    const { engine, calls } = makeEngine({ autoplay: false });
    const p = recorder.players[0];
    p.fire('statistics_info', { speed: 100 });
    p.fire('media_info', { width: 1920 });
    p.fire('recovered_early_eof');
    p.fire('loading_complete');
    expect(calls.statistics[0]).toMatchObject({ speed: 100 });
    expect(calls.mediaInfos[0]).toMatchObject({ width: 1920 });
    expect(calls.recovered).toBe(1);
    expect(calls.ended).toBe(1);
    engine.destroy();
  });

  it('forwards error event before the reconnect/terminal decision', () => {
    const { engine, calls } = makeEngine();
    recorder.players[0].fire('error', 'NetworkError', 'Exception', {});
    expect(calls.errors[0]).toEqual(['NetworkError', 'Exception', {}]);
    engine.destroy();
  });

  it('autoReconnect=false → transient network error is terminal', () => {
    const { engine, calls } = makeEngine({ autoReconnect: false });
    recorder.players[0].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    expect(calls.status.at(-1)).toBe('error');
    expect(calls.status.includes('reconnecting')).toBe(false);
    engine.destroy();
  });

  it('HttpStatusCodeInvalid (permanent 4xx/5xx) is never retried', () => {
    const { engine, calls } = makeEngine();
    recorder.players[0].fire('error', 'NetworkError', 'HttpStatusCodeInvalid', {});
    expect(calls.status.at(-1)).toBe('error');
    expect(recorder.players).toHaveLength(1);
    engine.destroy();
  });

  it('auto-reconnects on transient error, resets attempts on success', async () => {
    vi.useFakeTimers();
    const { engine, calls } = makeEngine({ reconnect: { retries: 3, minDelay: 1000, maxDelay: 8000 } });
    recorder.players[0].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    expect(calls.status.includes('reconnecting')).toBe(true);

    await vi.advanceTimersByTimeAsync(1000); // attempt 0 → minDelay * 2^0
    expect(recorder.players).toHaveLength(2);

    recorder.players[1].fire('error', 'NetworkError', 'Exception', {});
    await vi.advanceTimersByTimeAsync(2000); // attempt 1 → 2000
    expect(recorder.players).toHaveLength(3);

    recorder.players[2].playDeferred!.resolve(); // success resets attempts
    await flush();
    expect(calls.status.filter((s) => s === 'playing')).toHaveLength(1);

    recorder.players[2].fire('error', 'NetworkError', 'Exception', {});
    await vi.advanceTimersByTimeAsync(999);
    expect(recorder.players).toHaveLength(3); // reset → waits the full 1000 again
    await vi.advanceTimersByTimeAsync(1);
    expect(recorder.players).toHaveLength(4);
    engine.destroy();
  });

  it('backoff caps at maxDelay', async () => {
    vi.useFakeTimers();
    const { engine } = makeEngine({ reconnect: { retries: 5, minDelay: 3000, maxDelay: 4000 } });
    recorder.players[0].fire('error', 'NetworkError', 'Exception', {});
    await vi.advanceTimersByTimeAsync(3000); // attempt 0 → 3000
    expect(recorder.players).toHaveLength(2);

    recorder.players[1].fire('error', 'NetworkError', 'Exception', {});
    await vi.advanceTimersByTimeAsync(3999); // attempt 1 → 6000 capped to 4000
    expect(recorder.players).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(recorder.players).toHaveLength(3);
    engine.destroy();
  });

  it('gives up after retries exhausted → terminal error', async () => {
    vi.useFakeTimers();
    const { engine, calls } = makeEngine({ reconnect: { retries: 2, minDelay: 500, maxDelay: 500 } });
    recorder.players[0].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    await vi.advanceTimersByTimeAsync(500);
    recorder.players[1].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    await vi.advanceTimersByTimeAsync(500);
    recorder.players[2].fire('error', 'NetworkError', 'UnrecoverableEarlyEof', {});
    expect(recorder.players).toHaveLength(3); // initial + 2 reconnects
    expect(calls.status.at(-1)).toBe('error'); // 3rd error → exhausted → terminal
    engine.destroy();
  });

  it('autoplay muted-fallback: blocked play retries muted, then plays', async () => {
    vi.useFakeTimers();
    const { engine, calls, video } = makeEngine({ muted: false });
    const p = recorder.players[0];
    p.playDeferred!.reject(new Error('NotAllowedError'));
    await flush();
    expect(p.calls.filter((c) => c === 'play')).toHaveLength(2); // muted retry
    expect(video.muted).toBe(true);
    p.playDeferred!.resolve();
    await flush();
    expect(calls.status.filter((s) => s === 'playing')).toHaveLength(1);
    engine.destroy();
  });

  it('muted=true → blocked play is terminal stopped (no retry)', async () => {
    vi.useFakeTimers();
    const { engine, calls } = makeEngine({ muted: true });
    const p = recorder.players[0];
    p.playDeferred!.reject(new Error('NotAllowedError'));
    await flush();
    expect(p.calls.filter((c) => c === 'play')).toHaveLength(1);
    expect(calls.status.at(-1)).toBe('stopped');
    engine.destroy();
  });

  it('control: volume / seek (through player) / statistics / getPlayer / reload', () => {
    const { engine } = makeEngine({ autoplay: false });
    const p = recorder.players[0];
    engine.setVolume(0.5);
    expect(engine.getVolume()).toBe(0.5);
    engine.seek(42);
    expect(p.currentTime).toBe(42); // routes through the player, not the element
    engine.reload();
    expect(recorder.players).toHaveLength(2);
    expect(engine.getPlayer()).toBe(recorder.players[1]);
    expect(engine.getStatistics()).toBe(recorder.players[1].statisticsInfo);
    engine.destroy();
  });

  it('update replaces handlers wholesale — fresh closures receive later events', () => {
    const late: string[] = [];
    const video = makeVideo();
    const engine = createPlayerEngine(
      { video, url: 'ws://x/live.flv', autoplay: false, handlers: { onStatus: () => {} } },
      createMockFactory(),
    );
    engine.update({ video, url: 'ws://x/live.flv', autoplay: false, handlers: { onStatus: (s) => late.push(s) } });
    engine.getPlayer()!.fire('error', 'NetworkError', 'HttpStatusCodeInvalid', {});
    expect(late).toContain('error');
    engine.destroy();
  });
});
