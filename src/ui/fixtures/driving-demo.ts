import { RouteRace } from '../../core/engine/RouteRace';
import type { DrivingSetup } from '../../core/engine/RouteRace';
import type { RaceDriver, RacerView } from '../adapters/race-view';
import { previewTrack } from './preview-track';
import { formulaPowertrain } from '../adapters/formula-powertrain';

export interface DrivingDemoOptions { laps?: number; initialNitro?: number; eventsEnabled?: boolean }

/** Draft demonstration setup. Tunings are explicit, not frozen shared config. */
export function drivingDemoSetup(options: DrivingDemoOptions = {}): DrivingSetup {
  const { laps = 2, initialNitro = 3, eventsEnabled = true } = options;
  if (![2, 3].includes(laps) || !Number.isSafeInteger(initialNitro) || initialNitro < 0 || initialNitro > 3 || typeof eventsEnabled !== 'boolean') throw new Error('Invalid driving-demo configuration.');
  const route = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 0];
  return {
    start: 0,
    vertices: previewTrack.vertices.map((vertex) => ({ id: vertex.id, x: vertex.x, y: vertex.y, type: vertex.kind === 'start' ? 'Start' : vertex.kind === 'checkpoint' ? 'Checkpoint' : vertex.kind === 'fuel' ? 'FuelStation' : vertex.kind === 'nitro' ? 'NitroPickup' : 'Other', checkpointOrder: vertex.checkpointOrder, active: true })),
    edges: previewTrack.roads.map((road) => {
      const from = previewTrack.vertices.find((vertex) => vertex.id === road.from)!;
      const to = previewTrack.vertices.find((vertex) => vertex.id === road.to)!;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      return { id: road.id, from: road.from, to: road.to, distance, fuelCost: distance / 90, difficulty: road.shortcut ? 3 : 2, status: road.status === 'blocked' ? 'Blocked' : road.status === 'restricted' ? 'Restricted' : 'Open', directed: Boolean(road.directed), isShortcut: Boolean(road.shortcut), speedCap: road.status === 'restricted' ? 45 : undefined };
    }),
    racers: [
      { id: 1, name: 'You', isHuman: true, speed: 86, route },
      { id: 2, name: 'Rival 01', isHuman: false, speed: 90, route },
      { id: 3, name: 'Rival 02', isHuman: false, speed: 83, route },
      { id: 4, name: 'Rival 03', isHuman: false, speed: 88, route },
    ],
    config: { laps, fuelCapacity: 100, initialNitro, nitroCapacity: 3, nitroSeconds: 4, nitroMultiplier: 1.5, nitroFuelMultiplier: 2, acceleration: 14, braking: 45, countdown: 3, timeLimit: Math.max(120, laps * 60), refuelAmount: 40, refuelStopSeconds: 2 },
    events: eventsEnabled ? [
      { eventId: 'temporary-restriction', triggerTime: 14, effect: { type: 'speed-restriction', edgeId: 'road-6', duration: 12, speedCap: 48 } },
      { eventId: 'oil-at-south-sector', triggerTime: 28, effect: { type: 'oil-spill', edgeId: 'road-8', duration: 15, difficultyPenalty: 2 } },
      { eventId: 'shortcut-closure', triggerTime: 20, effect: { type: 'shortcut', edgeId: 'shortcut-west', open: false } },
      { eventId: 'shortcut-restored', triggerTime: 32, effect: { type: 'shortcut', edgeId: 'shortcut-west', open: true } },
    ] : [],
  };
}

export function createDrivingDemo(options: DrivingDemoOptions = {}): RaceDriver {
  const setup = drivingDemoSetup(options);
  let engine = new RouteRace(setup);
  const gears = new Map<number, number>();
  const colors = ['#d7ff59', '#58d5ff', '#ff6d90', '#c0a0ff'];
  return {
    kind: 'demo', start: () => engine.start(), step: (seconds) => engine.step(seconds),
    restart: () => { engine = new RouteRace(setup); gears.clear(); }, activateNitro: () => { engine.activateNitro(); },
    getState() {
      const state = engine.getState();
      const cars: RacerView[] = new Array(state.cars.length);
      state.cars.forEach((car, index) => {
        const speedKph = car.speed * 3.6;
        const powertrain = formulaPowertrain(speedKph, gears.get(car.id) ?? 0, car.braking);
        const { gear } = powertrain;
        gears.set(car.id, gear);
        cars[car.position - 1] = {
          id: car.id, label: car.name, color: colors[index % colors.length], isHuman: car.isHuman, position: car.position,
          location: { edge: car.edgeId, progress: car.reverse ? 1 - car.progress : car.progress, reverse: car.reverse },
          laneOffset: index % 2 === 0 ? -9.5 : 9.5,
          status: car.status, statusReason: car.reason, fuel: Math.round(car.fuel * 10) / 10, fuelCapacity: setup.config.fuelCapacity,
          finishTime: car.finishTime,
          nitro: car.nitro, nitroCapacity: setup.config.nitroCapacity, lap: Math.min(setup.config.laps, car.completedLaps + 1), checkpoint: car.checkpoint,
          speedKph, gear, rpm: state.phase === 'countdown' ? 6500 + index * 120 : powertrain.rpm, braking: car.braking, boosting: car.nitroUntil > state.clock && car.status === 'racing',
        };
      });
      return {
        phase: state.phase, clock: state.clock, countdown: state.countdown, cars, totalLaps: setup.config.laps, checkpointCount: 10,
        track: { ...previewTrack, vertices: previewTrack.vertices.map((vertex) => ({ ...vertex, active: state.vertices.find((item) => item.id === vertex.id)?.active })), roads: previewTrack.roads.map((road) => ({ ...road, status: state.edges.find((edge) => edge.id === road.id)!.status.toLowerCase() as 'open' | 'blocked' | 'restricted' })) },
        events: state.events, routeEdges: [],
      };
    },
  };
}
