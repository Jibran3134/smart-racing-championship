import type { TrackMapData, MapCar } from '../components/map/map-model';

/** Presentation contracts only. Core game records/configuration remain shared work. */
export interface RacerView extends MapCar {
  isHuman: boolean;
  position: number;
  status: 'racing' | 'finished' | 'dnf' | 'waiting';
  statusReason?: string;
  fuel: number;
  fuelCapacity: number;
  nitro: number;
  nitroCapacity: number;
  lap: number;
  checkpoint: number;
  speedKph?: number;
  rpm?: number;
  gear?: number;
  braking?: boolean;
  boosting?: boolean;
  finishTime?: number | null;
}

export interface RaceViewState {
  phase: 'ready' | 'countdown' | 'running' | 'finished';
  countdown?: number | null;
  clock: number;
  totalLaps: number;
  checkpointCount: number;
  track: TrackMapData;
  cars: readonly RacerView[];
  events: readonly { id: string; time: number; message: string }[];
  routeEdges: readonly string[];
}

export interface RaceDriver {
  kind: 'live' | 'replay' | 'demo';
  getState(): RaceViewState;
  start(): void;
  step(seconds: number): void;
  restart(): void;
  activateNitro?(): void;
  /** Replay only: presentation seeking never rewinds a live engine. */
  seek?(seconds: number): void;
  duration?: number;
}

export function formatRaceTime(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const tenths = Math.max(0, Math.floor(seconds * 10));
  return `${Math.floor(tenths / 600).toString().padStart(2, '0')}:${Math.floor(tenths / 10) % 60 < 10 ? '0' : ''}${Math.floor(tenths / 10) % 60}.${tenths % 10}`;
}
