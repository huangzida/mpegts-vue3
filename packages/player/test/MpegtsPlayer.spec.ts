import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MpegtsPlayer from '../src/components/MpegtsPlayer.vue';
import { recorder, resetRecorder } from '../../core/src/testing';

// The engine's default factory imports mpegts.js — swap it for the shared
// MockPlayer harness that lives in mpegts-core (src/testing.ts). The dynamic
// import is required: vi.mock factories are hoisted above static imports, so
// the module can only be loaded inside the factory.
vi.mock('mpegts.js', async () => (await import('../../core/src/testing')).mockMpegtsModule());

function statuses(wrapper: ReturnType<typeof mount>): string[] {
  return (wrapper.emitted('status') ?? []).map((args) => args[0] as string);
}

// Adapter smoke tests: full behavioural coverage lives in mpegts-core's
// engine suite; these pin the Vue wiring (props in, emits/ref out).
describe('MpegtsPlayer (Vue adapter)', () => {
  beforeEach(() => resetRecorder());

  const mountIt = (props: Record<string, unknown> = {}) =>
    mount(MpegtsPlayer, { props: { url: 'ws://x/live.flv', ...props } });

  it('mount: creates the player through the engine with load-bearing source fields', async () => {
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

  it('engine status flows to the status emit', async () => {
    const w = mountIt();
    await nextTick();
    expect(statuses(w)).toEqual(['connecting']);

    recorder.players[0].playDeferred!.resolve();
    await nextTick();
    expect(statuses(w).at(-1)).toBe('playing');
    w.unmount();
  });

  it('ref methods delegate: reload() recreates, getPlayer() returns the instance', async () => {
    const w = mountIt();
    await nextTick();
    // @vue/test-utils does not reflect defineExpose shapes onto vm's type —
    // cast once to the exposed surface instead of inline member casts.
    const exposed = w.vm as unknown as {
      getPlayer: () => unknown
      reload: () => void
    };
    expect(recorder.players).toHaveLength(1);
    expect(exposed.getPlayer()).toBe(recorder.players[0]);
    exposed.reload();
    await nextTick();
    expect(recorder.players).toHaveLength(2);
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

  it('MSE gate failure surfaces as NotSupportedError + error status', async () => {
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

  it('forwards statistics / mediaInfo / ended events', async () => {
    const w = mountIt();
    await nextTick();
    const p = recorder.players[0];
    p.fire('statistics_info', { speed: 100, decodedFrames: 10 });
    p.fire('media_info', { width: 1920, height: 1080 });
    p.fire('loading_complete');
    await nextTick();
    expect(w.emitted('statistics')?.[0]?.[0]).toMatchObject({ speed: 100 });
    expect(w.emitted('mediaInfo')?.[0]?.[0]).toMatchObject({ width: 1920 });
    expect(w.emitted('ended')).toBeTruthy();
    w.unmount();
  });
});
