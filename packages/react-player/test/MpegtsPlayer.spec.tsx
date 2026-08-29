import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { createRef } from 'react';
import { MpegtsPlayer, type MpegtsPlayerRef } from '../src/MpegtsPlayer';
import { recorder, resetRecorder } from '../../core/src/testing';

// The engine's default factory imports mpegts.js — swap it for the shared
// MockPlayer harness that lives in mpegts-core (src/testing.ts). The dynamic
// import is required: vi.mock factories are hoisted above static imports, so
// the module can only be loaded inside the factory.
vi.mock('mpegts.js', async () => (await import('../../core/src/testing')).mockMpegtsModule());

// Adapter smoke tests: full behavioural coverage lives in mpegts-core's
// engine suite; these pin the React wiring (props in, callbacks/ref out).
describe('MpegtsPlayer (React adapter)', () => {
  const statuses: string[] = [];
  const errors: Array<[string, string, unknown]> = [];
  const statistics: unknown[] = [];
  const mediaInfos: unknown[] = [];
  let ended = 0;
  const onStatus = (s: string) => statuses.push(s);
  const onError = (t: string, d: string, i: unknown) => errors.push([t, d, i]);
  const onStatistics = (i: unknown) => statistics.push(i);
  const onMediaInfo = (i: unknown) => mediaInfos.push(i);
  const onRecovered = () => {};
  const onEnded = () => { ended += 1 };

  beforeEach(() => {
    resetRecorder();
    statuses.length = 0;
    errors.length = 0;
    statistics.length = 0;
    mediaInfos.length = 0;
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

  it('mount: creates the player through the engine with load-bearing source fields', () => {
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

  it('engine status flows to the onStatus callback', async () => {
    renderIt();
    expect(statuses).toEqual(['connecting']);

    await act(async () => {
      recorder.players[0].playDeferred!.resolve();
    });
    expect(statuses.at(-1)).toBe('playing');
  });

  it('ref methods delegate: reload() recreates, getPlayer() returns the instance', () => {
    const { ref } = renderIt();
    expect(recorder.players).toHaveLength(1);
    expect(ref.current?.getPlayer()).toBe(recorder.players[0]);
    act(() => {
      ref.current?.reload();
    });
    expect(recorder.players).toHaveLength(2);
  });

  it('unmount: cleanup order pause→unload→detach→destroy', () => {
    const { unmount } = renderIt();
    const p = recorder.players[0];
    p.calls.length = 0;
    unmount();
    expect(p.calls).toEqual(['pause', 'unload', 'detachMediaElement', 'destroy']);
  });

  it('MSE gate failure surfaces as NotSupportedError + error status', () => {
    recorder.isSupported = false;
    renderIt();
    expect(recorder.players).toHaveLength(0);
    expect(statuses.includes('error')).toBe(true);
    expect(errors[0]?.[0]).toBe('NotSupportedError');
  });

  it('forwards statistics / mediaInfo / ended events', async () => {
    renderIt();
    const p = recorder.players[0];
    await act(async () => {
      p.fire('statistics_info', { speed: 100 });
      p.fire('media_info', { width: 1920 });
      p.fire('loading_complete');
    });
    expect(statistics[0]).toMatchObject({ speed: 100 });
    expect(mediaInfos[0]).toMatchObject({ width: 1920 });
    expect(ended).toBe(1);
  });
});
