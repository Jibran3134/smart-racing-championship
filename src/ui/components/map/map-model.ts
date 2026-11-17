/** Rendering-only view models; these do not freeze the shared graph contract. */
export interface MapVertex {
  id: number;
  x: number;
  y: number;
  label: string;
  kind: 'start' | 'checkpoint' | 'intersection' | 'fuel' | 'nitro' | 'dead-end';
  checkpointOrder?: number;
}
export interface MapRoad {
  id: string;
  from: number;
  to: number;
  status: 'open' | 'blocked' | 'restricted';
  shortcut?: boolean;
}
export interface TrackMapData {
  name: string;
  vertices: readonly MapVertex[];
  roads: readonly MapRoad[];
}
