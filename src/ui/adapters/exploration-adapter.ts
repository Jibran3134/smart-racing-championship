import type { ExplorationGraph, ExplorationNeighbor } from '../../core/algorithms/exploration/contracts';
import type { TrackMapData } from '../components/map/map-model';

/** UI projection only. The engine's real graph can implement the same tiny view. */
export function explorationAdapter(track: TrackMapData): ExplorationGraph {
  const adjacency = new Map(track.vertices.map((vertex) => [vertex.id, [] as ExplorationNeighbor[]]));
  for (const road of track.roads) {
    if (road.status === 'blocked') continue;
    if (!adjacency.has(road.from) || !adjacency.has(road.to)) throw new Error('Road references an unknown vertex.');
    adjacency.get(road.from)!.push({ vertex: road.to, edge: road.id });
    if (!road.directed) adjacency.get(road.to)!.push({ vertex: road.from, edge: road.id });
  }
  return {
    directed: track.roads.some((road) => road.directed),
    getVertices: () => track.vertices.map((vertex) => ({ id: vertex.id, mandatory: vertex.kind === 'checkpoint' || vertex.kind === 'start' })),
    getNeighbors: (id) => adjacency.get(id) ?? [],
  };
}
