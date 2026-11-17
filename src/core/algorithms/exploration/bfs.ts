import { emptyCounters, requireVertex, vertexIds } from './contracts';
import type { ExplorationGraph, ExplorationResult, OnExplorationStep, ExplorationStep } from './contracts';

/** Full reachable-component traversal: O(V+E), excluding optional trace snapshots. */
export function bfs(graph: ExplorationGraph, start: number, onStep?: OnExplorationStep): ExplorationResult {
  const ids = vertexIds(graph);
  requireVertex(ids, start);
  const queue = [start];
  let head = 0;
  const discovered = new Set([start]);
  const order: number[] = [];
  const parents = new Map<number, number>();
  const parentEdges = new Map<number, string>();
  const counters = emptyCounters();
  counters.visitedVertices = 1;
  const emit = (type: ExplorationStep['type'], vertex?: number, edge?: string) => {
    if (onStep) onStep({ type, vertex, edge, counters: { ...counters }, frontier: queue.slice(head), visited: [...order] });
  };
  emit('push', start);
  while (head < queue.length) {
    const current = queue[head++];
    emit('pop', current);
    order.push(current);
    counters.expandedVertices++;
    emit('visit', current);
    for (const neighbor of graph.getNeighbors(current)) {
      requireVertex(ids, neighbor.vertex);
      counters.examinedEdges++;
      counters.comparisons++;
      if (discovered.has(neighbor.vertex)) continue;
      discovered.add(neighbor.vertex);
      parents.set(neighbor.vertex, current);
      parentEdges.set(neighbor.vertex, neighbor.edge);
      counters.visitedVertices++;
      counters.relaxedEdges++;
      emit('relax', neighbor.vertex, neighbor.edge);
      queue.push(neighbor.vertex);
      emit('push', neighbor.vertex, neighbor.edge);
    }
  }
  emit('done');
  return { order, parents, parentEdges, counters: { ...counters } };
}
