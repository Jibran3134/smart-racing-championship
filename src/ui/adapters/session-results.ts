import type { RaceDriver, RaceViewState } from './race-view';
import type { RaceSetupRequest } from './race-setup';
import { toCsv } from '../../shared/exports';

export interface SessionResult {
  schemaVersion: 1; id: string; kind: RaceDriver['kind']; circuit: string; recordedAt: string;
  simulationTime: number; totalLaps: number; checkpointCount: number; setup?: RaceSetupRequest;
  racers: readonly { id: number; name: string; isHuman: boolean; position: number; status: 'finished' | 'dnf'; reason: string | null; finishTime: number | null; lap: number; checkpoint: number; fuel: number; nitro: number }[];
  events: readonly { id: string; time: number; message: string }[];
}

/** Capture provider ordering and values verbatim. No scoring, sorting or lap estimation. */
export function captureSessionResult(state: RaceViewState, kind: RaceDriver['kind'], id: string, recordedAt: string, setup?: RaceSetupRequest): SessionResult {
  if (state.phase !== 'finished' || !Number.isFinite(state.clock) || state.clock < 0 || !state.cars.length || !Number.isSafeInteger(state.totalLaps) || state.totalLaps < 1 || !Number.isSafeInteger(state.checkpointCount) || state.checkpointCount < 0 || !Number.isFinite(Date.parse(recordedAt))) throw new Error('Only completed, readable sessions can be recorded.');
  const ids = new Set<number>();
  const racers = state.cars.map((car, index) => {
    if (ids.has(car.id) || !Number.isSafeInteger(car.id) || car.position !== index + 1 || !['finished', 'dnf'].includes(car.status)) throw new Error('Final racer IDs, provider order or statuses are invalid.');
    ids.add(car.id);
    const time = car.status === 'dnf' ? null : car.finishTime ?? null;
    if (time !== null && (!Number.isFinite(time) || time < 0 || time > state.clock + 0.001)) throw new Error('A finish time lies outside the completed session.');
    if (car.status === 'finished' && kind !== 'replay' && time === null) throw new Error('The engine must supply a finish time for each finisher.');
    if (!Number.isFinite(car.fuelCapacity) || car.fuelCapacity <= 0 || !Number.isFinite(car.fuel) || car.fuel < 0 || car.fuel > car.fuelCapacity || !Number.isSafeInteger(car.nitroCapacity) || car.nitroCapacity < 0 || !Number.isSafeInteger(car.nitro) || car.nitro < 0 || car.nitro > car.nitroCapacity) throw new Error('Final resource values are invalid.');
    if (!Number.isSafeInteger(car.lap) || car.lap < 1 || car.lap > state.totalLaps || !Number.isSafeInteger(car.checkpoint) || car.checkpoint < 0 || car.checkpoint > state.checkpointCount) throw new Error('Final lap or checkpoint values are invalid.');
    return { id: car.id, name: car.label, isHuman: car.isHuman, position: car.position, status: car.status as 'finished' | 'dnf', reason: car.statusReason ?? null, finishTime: time, lap: car.lap, checkpoint: car.checkpoint, fuel: car.fuel, nitro: car.nitro };
  });
  return { schemaVersion: 1, id, kind, circuit: state.track.name, recordedAt, simulationTime: state.clock, totalLaps: state.totalLaps, checkpointCount: state.checkpointCount,
    ...(setup ? { setup: { ...setup } } : {}), racers, events: state.events.map((event) => ({ ...event })) };
}

export function sessionResultsCsv(result: SessionResult): string {
  return toCsv(['sessionId', 'kind', 'circuit', 'recordedAt', 'racerId', 'racer', 'position', 'status', 'finishTimeSeconds', 'reason', 'lap', 'checkpoint', 'fuelRemaining', 'nitroRemaining'],
    result.racers.map((car) => [result.id, result.kind, result.circuit, result.recordedAt, car.id, car.name, car.position, car.status, car.finishTime, car.reason, car.lap, car.checkpoint, car.fuel, car.nitro]));
}

export function sessionEventsCsv(result: SessionResult): string {
  return toCsv(['sessionId', 'eventId', 'simulationTimeSeconds', 'message'], result.events.map((event) => [result.id, event.id, event.time, event.message]));
}
