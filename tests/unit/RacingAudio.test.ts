import { afterEach, describe, expect, it, vi } from 'vitest';
import { RacingAudio } from '../../src/ui/audio/RacingAudio';
import type { RaceSoundState } from '../../src/ui/audio/race-sound-state';

function parameter(initial = 0) {
  const value = {
    value: initial,
    setValueAtTime: vi.fn((next: number) => { value.value = next; }),
    setTargetAtTime: vi.fn((next: number) => { value.value = next; }),
    linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn(),
  };
  return value;
}
function node() { return { connect: vi.fn(), disconnect: vi.fn() }; }
function oscillator() { return { ...node(), frequency: parameter(), type: 'sine', start: vi.fn(), stop: vi.fn(), onended: null }; }
function bufferSource() { return { ...node(), buffer: null as AudioBuffer | null, loop: false, playbackRate: parameter(1), start: vi.fn(), stop: vi.fn() }; }

function audioFixture(withSamples = true) {
  const gains: ReturnType<typeof createGain>[] = [];
  const sources: ReturnType<typeof bufferSource>[] = [];
  const oscillators: ReturnType<typeof oscillator>[] = [];
  const panners: ReturnType<typeof createPanner>[] = [];
  function createGain() { return { ...node(), gain: parameter() }; }
  function createPanner() { return { ...node(), pan: parameter() }; }
  const samples = { engine: { duration: 0.824 } as AudioBuffer, tyres: { duration: 2.96 } as AudioBuffer };
  const context = {
    state: 'suspended', sampleRate: 8000, currentTime: 0, destination: node(),
    createGain: () => { const gain = createGain(); gains.push(gain); return gain; },
    createStereoPanner: () => { const panner = createPanner(); panners.push(panner); return panner; },
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: parameter(), Q: parameter() }),
    createOscillator: () => { const voice = oscillator(); oscillators.push(voice); return voice; },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => { const source = bufferSource(); sources.push(source); return source; },
    decodeAudioData: vi.fn(async () => samples.engine),
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
  };
  return { context, gains, sources, oscillators, panners, samples, sound: new RacingAudio(context as unknown as AudioContext, withSamples ? samples : undefined) };
}
function frame(): RaceSoundState {
  return {
    clock: 1, listener: { x: 0, y: 0, carId: 1, overview: false },
    cars: [0, 1, 2, 3].map((index) => ({ id: index + 1, x: index * 80, y: 0, rpm: 2200 + index * 1400, speedKph: 100 + index * 20, gear: 2 + index, braking: false, boosting: index === 0, running: true })),
  };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('recorded multi-car race audio', () => {
  it('starts silent and creates independent sample-based engines for every car', async () => {
    const { sound, context, sources, oscillators, panners, samples, gains } = audioFixture();
    expect(gains[0].gain.value).toBe(0);
    expect(sources).toHaveLength(1); // Shared air/mechanical texture, not an engine.
    sound.setVolume(0.5); await sound.setActive(true);
    sound.update(frame());
    const engineLoops = sources.filter((source) => source.buffer === samples.engine);
    expect(engineLoops).toHaveLength(8);
    expect(sources.filter((source) => source.buffer === samples.tyres)).toHaveLength(4);
    expect(new Set(engineLoops.filter((_, index) => index % 2 === 0).map((source) => source.playbackRate.value)).size).toBe(4);
    expect(new Set(engineLoops.filter((_, index) => index % 2 === 0).map((source) => source.start.mock.calls[0][1])).size).toBe(4);
    expect(panners).toHaveLength(4);
    expect(panners[0].pan.value).toBe(0);
    expect(panners[3].pan.value).toBeGreaterThan(panners[1].pan.value);
    expect(oscillators).toHaveLength(0); // No continuous synthetic engine tone.
    expect(context.state).toBe('running');
    await sound.setActive(false);
    expect(gains[0].gain.value).toBe(0);
    expect(context.state).toBe('suspended');
    sound.dispose();
  });

  it('reuses bounded car voices and releases sources for removed cars', () => {
    const { sound, sources, panners, gains } = audioFixture();
    const state = frame(); sound.update(state);
    const count = sources.length;
    sound.update({ ...state, clock: 1.1 });
    expect(sources).toHaveLength(count);
    const stopped = { ...state, clock: 1.2, cars: state.cars.map((car) => car.id === 2 ? { ...car, running: false } : car) };
    sound.update(stopped);
    const secondOutput = gains.find((gain) => gain.connect.mock.calls.some(([destination]) => destination === panners[1]))!;
    expect(secondOutput.gain.value).toBe(0);
    sound.update({ ...state, clock: 1.3, cars: state.cars.slice(0, 1) });
    expect(sources.filter((source) => source.stop.mock.calls.length > 0)).toHaveLength(9);
    sound.dispose();
  });

  it('suspends enabled idle audio and closes every source, including pending cues', async () => {
    const { sound, context, sources } = audioFixture();
    await sound.resume(); await sound.setActive(false);
    expect(context.state).toBe('suspended');
    sound.update(frame()); sound.countdown();
    sound.dispose(); sound.dispose();
    expect(sources.every((source) => source.stop.mock.calls.length >= 1)).toBe(true);
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.state).toBe('closed');
  });

  it('uses quiet race-control cues and suspends after the finish tail', async () => {
    vi.useFakeTimers();
    const { sound, context, oscillators } = audioFixture();
    sound.update(frame()); sound.countdown(); sound.countdown(true);
    expect(oscillators).toHaveLength(2);
    await sound.finish();
    expect(oscillators).toHaveLength(4);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(850);
    expect(context.state).toBe('suspended');
    expect(vi.getTimerCount()).toBe(0);
    sound.dispose();
  });

  it('aborts pending sample downloads when the race closes', async () => {
    const { sound } = audioFixture(false);
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))))));
    const loading = sound.loadSamples();
    sound.dispose();
    await expect(loading).rejects.toThrow('Aborted');
  });
});
