import { projectCar } from '../components/map/map-model';
import type { RaceViewState } from '../adapters/race-view';

export interface CarSoundState {
  id: number; x: number; y: number; rpm: number; speedKph: number; gear: number;
  braking: boolean; boosting: boolean; running: boolean;
}
export interface RaceSoundState {
  clock: number;
  listener: { x: number; y: number; carId: number; overview: boolean };
  cars: readonly CarSoundState[];
}
export interface AudioPerspective { carId: number | null; overview: boolean }

/** Projection is presentation-only and changes no race data. */
export function raceSoundState(state: RaceViewState, perspective: AudioPerspective): RaceSoundState {
  const focus = state.cars.find((car) => car.id === perspective.carId) ?? state.cars.find((car) => car.isHuman) ?? state.cars[0];
  const location = focus ? projectCar(state.track, focus) : null;
  const points = state.track.vertices;
  const centerX = points.length ? (Math.min(...points.map((point) => point.x)) + Math.max(...points.map((point) => point.x))) / 2 : 0;
  const centerY = points.length ? (Math.min(...points.map((point) => point.y)) + Math.max(...points.map((point) => point.y))) / 2 : 0;
  return {
    clock: state.clock,
    listener: { x: perspective.overview ? centerX : location?.x ?? 0, y: perspective.overview ? centerY : location?.y ?? 0, carId: focus?.id ?? -1, overview: perspective.overview },
    cars: state.cars.flatMap((car) => {
      const point = projectCar(state.track, car);
      return point ? [{ id: car.id, x: point.x, y: point.y, rpm: car.rpm ?? 1100, speedKph: car.speedKph ?? 0, gear: car.gear ?? 0, braking: Boolean(car.braking), boosting: Boolean(car.boosting), running: car.status !== 'dnf' && car.status !== 'finished' }] : [];
    }),
  };
}

export function spatialMix(car: CarSoundState, listener: RaceSoundState['listener'], radialSpeed = 0) {
  const distance = Math.hypot(car.x - listener.x, car.y - listener.y);
  const focus = !listener.overview && car.id === listener.carId;
  return {
    distance,
    gain: focus ? 1 : listener.overview ? 0.56 / (1 + distance / 1000) : 0.82 / (1 + (distance / 110) ** 1.45),
    pan: focus ? 0 : Math.max(-0.9, Math.min(0.9, (car.x - listener.x) / (listener.overview ? 420 : 175))),
    doppler: focus ? 1 : Math.max(0.88, Math.min(1.14, 343 / (343 + Math.max(-100, Math.min(100, radialSpeed))))),
    lowpass: focus ? 6800 : Math.max(1300, 6200 / (1 + distance / 280)),
  };
}
