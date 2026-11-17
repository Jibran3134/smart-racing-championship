import type { TrackMapData } from '../components/map/map-model';
import { routePresets } from './preset-view';
import type { PresetRouteView } from './preset-view';

/** Presentation boundary checks; optimality/checkpoint planning still belong to core. */
export function validatePresetRoutes(track: TrackMapData, source: number, target: number, routes: readonly PresetRouteView[]): void {
  const ids = new Set(track.vertices.map((vertex) => vertex.id));
  if (!ids.has(source) || !ids.has(target)) throw new Error('Comparison endpoints are missing from the selected circuit.');
  if (routes.length !== routePresets.length || new Set(routes.map((route) => route.preset)).size !== routePresets.length || routes.some((route) => !routePresets.some((preset) => preset.id === route.preset))) throw new Error('The planner must return exactly one result for each of the four presets.');
  const roads = new Map(track.roads.map((road) => [road.id, road]));
  const weights = ['distance', 'time', 'fuel', 'difficulty', 'obstacle'] as const;
  for (const route of routes) {
    if (route.weights && weights.some((key) => !Number.isFinite(route.weights![key]) || route.weights![key] < 0)) throw new Error('Comparison requires non-negative preset weights.');
    if (route.status === 'unreachable') {
      if (route.vertices.length || route.edges.length || route.metrics !== null) throw new Error('Unreachable comparisons must not contain a route or cost.');
      continue;
    }
    if (route.status !== 'available' || route.vertices[0] !== source || route.vertices.at(-1) !== target) throw new Error('Comparison paths do not match the selected endpoints.');
    if (route.vertices.length !== route.edges.length + 1 || route.vertices.some((vertex) => !ids.has(vertex))) throw new Error('Comparison path vertices and roads are inconsistent.');
    for (const [index, id] of route.edges.entries()) {
      const road = roads.get(id);
      if (!road || road.status === 'blocked') throw new Error('Comparison contains a missing or blocked road.');
      const from = route.vertices[index], to = route.vertices[index + 1];
      if (!(road.from === from && road.to === to || !road.directed && road.to === from && road.from === to)) throw new Error('Comparison contains a disconnected or reversed one-way road.');
    }
    if (!route.metrics || ['distance', 'time', 'cost'].some((key) => !Number.isFinite(route.metrics![key as keyof NonNullable<typeof route.metrics>]) || route.metrics![key as keyof NonNullable<typeof route.metrics>] < 0)) throw new Error('Comparison contains invalid route metrics.');
    if (!route.weights) throw new Error('Comparison requires non-negative preset weights.');
  }
}
