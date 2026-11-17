import type { TrackMapData } from '../components/map/map-model';
export type RoutePreset = 'balanced' | 'speed' | 'economy' | 'safety';
export const routePresets: readonly { id: RoutePreset; label: string; emphasis: string }[] = [
  { id: 'balanced', label: 'Balanced', emphasis: 'Moderate normalized weights across all criteria.' },
  { id: 'speed', label: 'Speed', emphasis: 'Higher time weight, lower fuel weight.' },
  { id: 'economy', label: 'Economy', emphasis: 'Higher fuel weight.' },
  { id: 'safety', label: 'Safety', emphasis: 'Higher difficulty and obstacle weights.' },
];
export interface PresetRouteView {
  preset: RoutePreset;
  status: 'available' | 'unreachable';
  vertices: readonly number[];
  edges: readonly string[];
  metrics: { distance: number; time: number; cost: number } | null;
  weights: { distance: number; time: number; fuel: number; difficulty: number; obstacle: number } | null;
}
export interface PresetProvider {
  /** Adapter calls the real planner; values must use the same optimized cost. */
  compare(request: { source: number; target: number; track: TrackMapData }): readonly PresetRouteView[];
}
