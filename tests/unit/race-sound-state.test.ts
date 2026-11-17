import { describe, expect, it } from 'vitest';
import { raceSoundState, spatialMix } from '../../src/ui/audio/race-sound-state';
import { createDrivingDemo } from '../../src/ui/fixtures/driving-demo';
import type { CarSoundState } from '../../src/ui/audio/race-sound-state';

const car: CarSoundState = { id: 2, x: 50, y: 0, rpm: 5000, speedKph: 180, gear: 4, braking: false, boosting: false, running: true };
const listener = { x: 0, y: 0, carId: 1, overview: false };

describe('race-field perspective', () => {
  it('includes all racers with independent telemetry and follows the selected car', () => {
    const driver = createDrivingDemo(); driver.start(); driver.step(5);
    const state = driver.getState();
    const sound = raceSoundState(state, { carId: 2, overview: false });
    expect(sound.cars).toHaveLength(4);
    expect(sound.listener.carId).toBe(2);
    expect(new Set(sound.cars.map((entry) => entry.id)).size).toBe(4);
    expect(sound.cars.find((entry) => entry.id === 2)?.rpm).toBe(state.cars.find((entry) => entry.id === 2)?.rpm);
    const stoppedPlayer = { ...state, cars: state.cars.map((entry) => entry.isHuman ? { ...entry, status: 'dnf' as const } : entry) };
    expect(raceSoundState(stoppedPlayer, { carId: 1, overview: false }).cars.filter((entry) => entry.running)).toHaveLength(3);
  });

  it('attenuates distant rivals and pans left/right while keeping the focus centered', () => {
    const near = spatialMix(car, listener);
    const far = spatialMix({ ...car, x: 400 }, listener);
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(near.pan).toBeGreaterThan(0);
    expect(spatialMix({ ...car, x: -50 }, listener).pan).toBeLessThan(0);
    expect(far.lowpass).toBeLessThan(near.lowpass);
    expect(spatialMix({ ...car, id: 1 }, listener)).toMatchObject({ gain: 1, pan: 0, doppler: 1 });
  });

  it('raises approaching pitch, lowers receding pitch and bounds camera changes', () => {
    expect(spatialMix(car, listener, -60).doppler).toBeGreaterThan(1);
    expect(spatialMix(car, listener, 60).doppler).toBeLessThan(1);
    expect(spatialMix(car, listener, -99999).doppler).toBeLessThanOrEqual(1.14);
    expect(spatialMix(car, listener, 99999).doppler).toBeGreaterThanOrEqual(0.88);
    expect(spatialMix({ ...car, x: 400 }, { ...listener, overview: true }).gain).toBeGreaterThan(spatialMix({ ...car, x: 400 }, listener).gain);
  });
});
