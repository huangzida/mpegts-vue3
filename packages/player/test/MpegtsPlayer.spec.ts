import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MpegtsPlayer from '../src/components/MpegtsPlayer.vue';

// vi.mock is hoisted above imports, so the recorder + MockPlayer must be created
// inside vi.hoisted() to be visible to the factory. The recorder is the single
// source of truth the tests assert against.
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
    playDeferred: Deferred | null = null;
    constructor(source: any, config: any) {
      this.source = source;
      this.config = config;
      recorder.players.push(this);
    }
    attachMediaElement() {
      this.calls.push('attachMediaElement');
    }
    on(event: string, cb: any) {
      if (event === 'error') this.errorCb = cb;
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
    Events: { ERROR: 'error' },
  },
}));

function statuses(wrapper: ReturnType<typeof mount>): string[] {
  return (wrapper.emitted('status') ?? []).map((args) => args[0] as string);
}

describe('MpegtsPlayer (Vue)', () => {
  beforeEach(() => {
    recorder.players.length = 0;
    recorder.isSupported = true;
  });

  const mountIt = (props: Record<string, unknown> = {}) =>
    mount(MpegtsPlayer, { props: { url: 'ws://x/live.flv', ...props } });

  it('mount: lifecycle order + load-bearing source fields (hasVideo guard)', async () => {
    const w = mountIt();
    await nextTick();
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
    w.unmount();
  });

  it('unmount: cleanup order pause→unload→detach→destroy', async () => {
    const w = mountIt();
    await nextTick();
    const p = recorder.players[0];
    p.calls.length = 0;
    w.unmount();
    await nextTick();
    expect(p.calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
  });

  it('config merge: user key wins, default key present', async () => {
    const w = mountIt({ config: { enableStashBuffer: true } });
    await nextTick();
    const cfg = recorder.players[0].config;
    expect(cfg.enableStashBuffer).toBe(true); // user override
    expect(cfg.liveSync).toBe(true); // default still present
    w.unmount();
  });

  it('gen guard: stale play promise after url change does not emit playing', async () => {
    vi.useFakeTimers();
    const w = mountIt({ url: 'url1' });
    await vi.advanceTimersByTimeAsync(0);
    const p1 = recorder.players[0];
    expect(statuses(w).includes('playing')).toBe(false);

    await w.setProps({ url: 'url2' });
    await vi.advanceTimersByTimeAsync(300); // debounce recreate
    const p2 = recorder.players[1];

    p1.playDeferred!.resolve(); // stale generation → must bail
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses(w).filter((s) => s === 'playing')).toHaveLength(0);

    p2.playDeferred!.resolve(); // current generation → emits playing
    await vi.advanceTimersByTimeAsync(0);
    expect(statuses(w).filter((s) => s === 'playing')).toHaveLength(1);

    vi.useRealTimers();
    w.unmount();
  });

  it('debounce: 3 rapid config changes collapse to 1 recreate', async () => {
    vi.useFakeTimers();
    const w = mountIt();
    await vi.advanceTimersByTimeAsync(0);
    expect(recorder.players).toHaveLength(1);

    await w.setProps({ config: { liveBufferLatencyMaxLatency: 2 } });
    await w.setProps({ config: { liveBufferLatencyMaxLatency: 2.2 } });
    await w.setProps({ config: { liveBufferLatencyMaxLatency: 2.5 } });
    expect(recorder.players).toHaveLength(1); // debounced, not yet

    await vi.advanceTimersByTimeAsync(300);
    expect(recorder.players).toHaveLength(2); // single recreate

    vi.useRealTimers();
    w.unmount();
  });

  it('ref methods: reload() recreates, getPlayer() returns instance', async () => {
    const w = mountIt();
    await nextTick();
    expect(recorder.players).toHaveLength(1);
    expect((w.vm as any).getPlayer()).toBe(recorder.players[0]);
    (w.vm as any).reload();
    await nextTick();
    expect(recorder.players).toHaveLength(2);
    w.unmount();
  });

  it('isSupported() false (MSE type) → error status + NotSupportedError, no player', async () => {
    recorder.isSupported = false;
    const w = mountIt();
    await nextTick();
    expect(recorder.players).toHaveLength(0);
    expect(statuses(w).includes('error')).toBe(true);
    const err = w.emitted('error');
    expect(err).toBeTruthy();
    expect(err![0][0]).toBe('NotSupportedError');
    w.unmount();
  });

  it('non-MSE type bypasses the MSE gate (NativePlayer path)', async () => {
    recorder.isSupported = false; // would block mse/flv, but not mp4
    const w = mountIt({ type: 'mp4' });
    await nextTick();
    expect(recorder.players).toHaveLength(1); // created via NativePlayer, gate skipped
    w.unmount();
  });
});
