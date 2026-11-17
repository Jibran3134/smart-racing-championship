import { afterEach, describe, expect, it, vi } from 'vitest';
import { RacingAudio } from '../../src/ui/audio/RacingAudio';

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
function oscillator() { return { ...node(), frequency: parameter(), type: 'sine', start: vi.fn(), stop: vi.fn(), setPeriodicWave: vi.fn(), onended: null }; }

function audioFixture() {
  const gains: { gain: ReturnType<typeof parameter> }[] = [];
  const voices: ReturnType<typeof oscillator>[] = [];
  const noise = { ...node(), buffer: null, loop: false, start: vi.fn(), stop: vi.fn() };
  const context = {
    state: 'suspended', sampleRate: 8000, currentTime: 0, destination: node(),
    createGain: () => { const gain = { ...node(), gain: parameter() }; gains.push(gain); return gain; },
    createDynamicsCompressor: () => ({ ...node(), threshold: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }),
    createBiquadFilter: () => ({ ...node(), type: 'lowpass', frequency: parameter(), Q: parameter() }),
    createPeriodicWave: vi.fn(),
    createOscillator: () => { const voice = oscillator(); voices.push(voice); return voice; },
    createBuffer: (_channels: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBufferSource: () => noise,
    resume: vi.fn(async () => { context.state = 'running'; }),
    suspend: vi.fn(async () => { context.state = 'suspended'; }),
    close: vi.fn(async () => { context.state = 'closed'; }),
  };
  return { context, gains, voices, noise, sound: new RacingAudio(context as unknown as AudioContext) };
}
afterEach(() => vi.useRealTimers());

describe('racing audio', () => {
  it('starts silent, follows RPM, and suspends completely on pause/mute', async () => {
    const { sound, context, voices, gains } = audioFixture();
    expect(gains[0].gain.value).toBe(0);
    sound.setVolume(0.5); await sound.setActive(true);
    sound.update({ rpm: 6000, speedKph: 200, braking: true, boosting: true });
    expect(voices[0].frequency.value).toBe(200);
    expect(gains[0].gain.value).toBe(0.5);
    expect(context.state).toBe('running');
    await sound.setActive(false);
    expect(gains[0].gain.value).toBe(0);
    expect(context.state).toBe('suspended');
    sound.dispose();
  });

  it('suspends an enabled but idle context instead of leaving an audio device active', async () => {
    const { sound, context } = audioFixture();
    await sound.resume();
    expect(context.state).toBe('running');
    await sound.setActive(false);
    expect(context.state).toBe('suspended');
    sound.dispose();
  });

  it('schedules race cues and ends its finish fanfare without a background timer', async () => {
    vi.useFakeTimers();
    const { sound, context, voices } = audioFixture();
    sound.countdown(); sound.countdown(true); sound.shift(); sound.checkpoint();
    expect(voices).toHaveLength(7);
    await sound.finish();
    expect(voices).toHaveLength(11);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(850);
    expect(context.state).toBe('suspended');
    expect(vi.getTimerCount()).toBe(0);
    sound.dispose();
  });

  it('closes and disconnects all sources on leaving a race, even during a fanfare', async () => {
    vi.useFakeTimers();
    const { sound, context, voices, noise } = audioFixture();
    await sound.finish(); sound.dispose(); sound.dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledOnce();
    expect(noise.stop).toHaveBeenCalledOnce();
    expect(voices.every((voice) => voice.stop.mock.calls.length >= 1)).toBe(true);
    expect(context.state).toBe('closed');
  });
});
