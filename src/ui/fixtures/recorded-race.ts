import type { RaceDriver, RacerView, RaceViewState } from '../adapters/race-view';
import { previewTrack } from './preview-track';

/** Explicit UI sample snapshots, NOT a race engine or validated race recording.
 * No routes, consumption, checkpoint progression or standings are calculated.
 */
const samples = [
  { time: 0, edge: 'road-0', progress: 0, fuel: 100, nitro: 2, lap: 1, checkpoint: 0 },
  { time: 4, edge: 'road-0', progress: 0.5, fuel: 92, nitro: 2, lap: 1, checkpoint: 0 },
  { time: 8, edge: 'road-1', progress: 0.3, fuel: 82, nitro: 2, lap: 1, checkpoint: 1 },
  { time: 12, edge: 'shortcut-west', progress: 0.7, fuel: 67, nitro: 1, lap: 1, checkpoint: 2 },
  { time: 16, edge: 'east-junction', progress: 0.4, fuel: 54, nitro: 1, lap: 1, checkpoint: 6 },
  { time: 20, edge: 'road-8', progress: 0.6, fuel: 38, nitro: 1, lap: 1, checkpoint: 8 },
  { time: 24, edge: 'road-0', progress: 0.3, fuel: 78, nitro: 1, lap: 2, checkpoint: 0 },
  { time: 28, edge: 'road-4', progress: 0.6, fuel: 60, nitro: 0, lap: 2, checkpoint: 4 },
  { time: 32, edge: 'road-9', progress: 0.8, fuel: 22, nitro: 0, lap: 2, checkpoint: 9 },
  { time: 36, edge: 'road-10', progress: 1, fuel: 14, nitro: 0, lap: 2, checkpoint: 10 },
] as const;

const messages = [
  { id: 'start', time: 0, message: 'Display preview started. Values are illustrative snapshots.' },
  { id: 'closure', time: 8, message: 'Example road closure: road-3 blocked.' },
  { id: 'restriction', time: 12, message: 'Example speed restriction remains active on shortcut-east.' },
  { id: 'fuel', time: 24, message: 'Example fuel-stop state displayed at the next lap.' },
  { id: 'dnf', time: 28, message: 'Rival 03: sample DNF state — insufficient fuel.' },
  { id: 'finish', time: 36, message: 'Preview complete. No race points have been awarded.' },
];

export function createRecordedRace(): RaceDriver {
  let clock = 0;
  let started = false;
  const duration = samples[samples.length - 1].time;
  return {
    kind: 'replay', duration,
    start() { if (clock < duration) started = true; },
    step(seconds) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid replay delta.');
      if (started) clock = Math.min(duration, clock + seconds);
    },
    restart() { clock = 0; started = false; },
    seek(seconds) {
      if (!Number.isFinite(seconds)) throw new Error('Invalid replay time.');
      clock = Math.max(0, Math.min(duration, seconds));
    },
    getState(): RaceViewState {
      const sample = samples.filter((frame) => frame.time <= clock).at(-1)!;
      const finished = clock >= duration;
      const cars: RacerView[] = [
        { id: 1, label: 'You', color: '#c5f568', isHuman: true, position: 1, status: finished ? 'finished' : 'racing', location: { edge: sample.edge, progress: sample.progress }, fuel: sample.fuel, fuelCapacity: 100, nitro: sample.nitro, nitroCapacity: 3, lap: sample.lap, checkpoint: sample.checkpoint },
        { id: 2, label: 'Rival 01', color: '#72cce4', isHuman: false, position: 2, status: finished ? 'finished' : 'racing', location: { edge: sample.edge, progress: Math.max(0, sample.progress - 0.14) }, fuel: 52, fuelCapacity: 100, nitro: 1, nitroCapacity: 3, lap: sample.lap, checkpoint: sample.checkpoint },
        { id: 3, label: 'Rival 02', color: '#c8a3ef', isHuman: false, position: 3, status: finished ? 'finished' : 'racing', location: { edge: sample.edge, progress: Math.max(0, sample.progress - 0.28) }, fuel: 44, fuelCapacity: 100, nitro: 2, nitroCapacity: 3, lap: sample.lap, checkpoint: sample.checkpoint },
        { id: 4, label: 'Rival 03', color: '#f0b77b', isHuman: false, position: 4, status: clock >= 28 ? 'dnf' : 'racing', statusReason: clock >= 28 ? 'Insufficient fuel' : undefined, location: clock >= 28 ? { vertex: 4 } : { edge: sample.edge, progress: Math.max(0, sample.progress - 0.4) }, fuel: clock >= 28 ? 0 : 35, fuelCapacity: 100, nitro: 0, nitroCapacity: 3, lap: sample.lap, checkpoint: clock >= 28 ? 4 : sample.checkpoint },
      ];
      return {
        phase: finished ? 'finished' : started ? 'running' : 'ready', clock, totalLaps: 2, checkpointCount: 10, cars,
        track: { ...previewTrack, roads: previewTrack.roads.map((road) => ({ ...road, status: clock >= 8 && road.id === 'road-3' ? 'blocked' : road.status })) },
        events: messages.filter((message) => message.time <= clock).map((message) => ({ ...message })),
        routeEdges: [],
      };
    },
  };
}
