import { EventProcessor } from '../../core/events/EventProcessor';
import type { EventEdgeState, EventWorld, RaceEventInput } from '../../core/events/EventProcessor';
import { previewTrack } from './preview-track';
import type { TrackMapData } from '../components/map/map-model';

/** Demonstration values, not frozen race configuration. */
export function createEventScenario() {
  const edges = new Map(previewTrack.roads.map((road) => [road.id, {
    status: road.status === 'blocked' ? 'Blocked' as const : road.status === 'restricted' ? 'Restricted' as const : 'Open' as const,
    difficulty: 2,
    speedCap: undefined as number | undefined,
    isShortcut: road.shortcut ?? false,
  }]));
  const vertices = new Map(previewTrack.vertices.map((vertex) => [vertex.id, {
    type: vertex.kind === 'fuel' ? 'FuelStation' as const : vertex.kind === 'nitro' ? 'NitroPickup' as const : 'Other' as const,
    active: vertex.kind !== 'nitro',
  }]));
  const world: EventWorld = {
    getEdge: (id) => edges.get(id), getVertex: (id) => vertices.get(id),
    setEdgeState: (id, state: EventEdgeState) => edges.set(id, { ...edges.get(id)!, ...state }),
    setVertexActive: (id, active) => vertices.set(id, { ...vertices.get(id)!, active }),
  };
  const processor = new EventProcessor(world);
  const schedule: RaceEventInput[] = [
    { eventId: 'mild-oil', triggerTime: 2, effect: { type: 'oil-spill', edgeId: 'road-5', difficultyPenalty: 1, duration: 20 } },
    { eventId: 'block-road', triggerTime: 5, effect: { type: 'road-blockage', edgeId: 'road-2', blocked: true } },
    { eventId: 'close-shortcut', triggerTime: 5, effect: { type: 'shortcut', edgeId: 'shortcut-west', open: false } },
    { eventId: 'severe-oil', triggerTime: 5, effect: { type: 'oil-spill', edgeId: 'road-5', difficultyPenalty: 3, duration: 8 } },
    { eventId: 'speed-cap', triggerTime: 5, effect: { type: 'speed-restriction', edgeId: 'road-5', speedCap: 15, duration: 15 } },
    { eventId: 'station-offline', triggerTime: 5, effect: { type: 'fuel-availability', vertexId: 11, active: false, duration: 12 } },
    { eventId: 'nitro-ready', triggerTime: 5, effect: { type: 'nitro-booster', vertexId: 12, duration: 10 } },
    { eventId: 'avoidable', triggerTime: 10, effect: { type: 'road-blockage', edgeId: 'road-0', blocked: true } },
    { eventId: 'clear-road', triggerTime: 18, effect: { type: 'road-blockage', edgeId: 'road-2', blocked: false } },
    { eventId: 'open-shortcut', triggerTime: 25, effect: { type: 'shortcut', edgeId: 'shortcut-west', open: true } },
  ];
  schedule.forEach((event) => processor.schedule(event));
  const track = (): TrackMapData => ({ ...previewTrack,
    roads: previewTrack.roads.map((road) => ({ ...road, status: edges.get(road.id)!.status.toLowerCase() as 'open' | 'blocked' | 'restricted' })),
    vertices: previewTrack.vertices.map((vertex) => ({ ...vertex, active: vertices.get(vertex.id)!.active })),
  });
  const snapshot = () => ({
    time: processor.currentTime, nextTime: processor.nextTime, pending: processor.pendingCount,
    effects: processor.activeEffects, counters: processor.counters, track: track(),
    road: { ...edges.get('road-5')! }, stationActive: vertices.get(11)!.active, nitroActive: vertices.get(12)!.active,
  });
  return { processor, snapshot, schedule };
}
