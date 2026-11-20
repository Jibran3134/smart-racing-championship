import type { Edge, VertexType } from '../../../core/types';

/** Map geometry with optional source data for production algorithm adapters. */
export interface MapVertex {
  id: number;
  x: number;
  y: number;
  label: string;
  kind: 'start' | 'checkpoint' | 'intersection' | 'fuel' | 'nitro' | 'dead-end';
  checkpointOrder?: number;
  active?: boolean;
  coreType?: VertexType;
}
export interface MapRoad {
  id: string;
  from: number;
  to: number;
  status: 'open' | 'blocked' | 'restricted';
  shortcut?: boolean;
  directed?: boolean;
  /** Original road attributes; geometry must never replace these routing costs. */
  routing?: Pick<Edge, 'distance' | 'baseTime' | 'fuelCost' | 'difficulty' | 'speedCap'>;
}
export interface TrackMapData {
  name: string;
  vertices: readonly MapVertex[];
  roads: readonly MapRoad[];
}

export interface MapCar {
  id: number;
  label: string;
  color: string;
  laneOffset?: number;
  location: { vertex: number } | { edge: string; progress: number; reverse?: boolean };
}

/** Rendering interpolation along one supplied road, never route planning. */
export function projectCar(track: TrackMapData, car: MapCar): { x: number; y: number; angle: number } | null {
  if ('vertex' in car.location) {
    const id = car.location.vertex;
    const vertex = track.vertices.find((item) => item.id === id);
    return vertex ? { x: vertex.x, y: vertex.y, angle: 0 } : null;
  }
  const { edge, progress, reverse = false } = car.location;
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) return null;
  const road = track.roads.find((item) => item.id === edge);
  const from = track.vertices.find((item) => item.id === road?.from);
  const to = track.vertices.find((item) => item.id === road?.to);
  if (!from || !to) return null;
  const heading = Math.atan2(to.y - from.y, to.x - from.x);
  const lane = car.laneOffset ?? 0;
  return { x: from.x + (to.x - from.x) * progress - Math.sin(heading) * lane, y: from.y + (to.y - from.y) * progress + Math.cos(heading) * lane, angle: heading * 180 / Math.PI + (reverse ? 180 : 0) };
}
