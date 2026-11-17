import type { ExplorationGraph, ExplorationNeighbor } from '../../src/core/algorithms/exploration/contracts';

export function graphFixture(ids: number[], edges: [number, number, string][], directed = false, mandatory: number[] = []): ExplorationGraph {
  const adjacency = new Map(ids.map((id) => [id, [] as ExplorationNeighbor[]]));
  for (const [from, to, edge] of edges) {
    adjacency.get(from)!.push({ vertex: to, edge });
    if (!directed) adjacency.get(to)!.push({ vertex: from, edge });
  }
  return {
    directed,
    getVertices: () => ids.map((id) => ({ id, mandatory: mandatory.includes(id) })),
    getNeighbors: (id) => adjacency.get(id) ?? [],
  };
}
