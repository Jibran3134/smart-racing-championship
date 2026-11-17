import { emptyCounters, requireVertex, vertexIds } from './contracts';
import type { ExplorationGraph, ExplorationNeighbor, ExplorationResult, ExplorationStep, OnExplorationStep } from './contracts';

/** Iterative color DFS avoids recursion limits. Cycle detection is source-reachable. */
export function dfs(graph: ExplorationGraph, start: number, onStep?: OnExplorationStep): ExplorationResult & { hasCycle: boolean } {
  const ids = vertexIds(graph);
  requireVertex(ids, start);
  const colors = new Map<number, 'gray' | 'black'>();
  const parents = new Map<number, number>();
  const parentEdges = new Map<number, string>();
  const order: number[] = [];
  const counters = emptyCounters();
  const stack: { vertex: number; neighbors: readonly ExplorationNeighbor[]; next: number }[] = [];
  let hasCycle = false;
  const emit = (type: ExplorationStep['type'], vertex?: number, edge?: string) => {
    if (onStep) onStep({ type, vertex, edge, counters: { ...counters }, frontier: stack.map((frame) => frame.vertex), visited: [...order] });
  };
  const enter = (vertex: number) => {
    colors.set(vertex, 'gray');
    counters.visitedVertices++;
    stack.push({ vertex, neighbors: graph.getNeighbors(vertex), next: 0 });
    emit('push', vertex);
    order.push(vertex);
    counters.expandedVertices++;
    emit('visit', vertex);
  };
  enter(start);
  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    if (frame.next >= frame.neighbors.length) {
      colors.set(frame.vertex, 'black');
      stack.pop();
      emit('pop', frame.vertex);
      continue;
    }
    const neighbor = frame.neighbors[frame.next++];
    requireVertex(ids, neighbor.vertex);
    counters.examinedEdges++;
    counters.comparisons++;
    if (!graph.directed && neighbor.edge === parentEdges.get(frame.vertex)) continue;
    const color = colors.get(neighbor.vertex);
    if (color === 'gray') hasCycle = true;
    if (color !== undefined) continue;
    parents.set(neighbor.vertex, frame.vertex);
    parentEdges.set(neighbor.vertex, neighbor.edge);
    counters.relaxedEdges++;
    emit('relax', neighbor.vertex, neighbor.edge);
    enter(neighbor.vertex);
  }
  emit('done');
  return { order, parents, parentEdges, counters: { ...counters }, hasCycle };
}

/** Weak components for directed views; ordinary components for undirected views. */
export function connectedComponents(graph: ExplorationGraph): number[][] {
  const ids = vertexIds(graph);
  const adjacency = new Map([...ids].map((id) => [id, [] as number[]]));
  for (const id of ids) for (const neighbor of graph.getNeighbors(id)) {
    requireVertex(ids, neighbor.vertex);
    adjacency.get(id)!.push(neighbor.vertex);
    adjacency.get(neighbor.vertex)!.push(id);
  }
  const seen = new Set<number>();
  const components: number[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id];
    const component: number[] = [];
    seen.add(id);
    while (stack.length) {
      const current = stack.pop()!;
      component.push(current);
      for (const next of adjacency.get(current)!) if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
    components.push(component);
  }
  return components;
}

/** Dead-end analysis is relative to arrival along the DFS tree edge.
 * For each reachable, non-mandatory vertex, try to reach finish without reusing
 * its arrival edge. A simple continuation never needs to reverse another edge.
 * O(V(V+E)) worst case; intentionally separate from O(V+E) ordinary DFS.
 */
export function analyzeDeadEnds(graph: ExplorationGraph, traversal: ExplorationResult, finish: number): number[] {
  const ids = vertexIds(graph);
  requireVertex(ids, finish);
  const mandatory = new Set(graph.getVertices().filter((vertex) => vertex.mandatory).map((vertex) => vertex.id));
  return traversal.order.filter((start) => {
    if (start === finish || mandatory.has(start)) return false;
    const arrivalEdge = traversal.parentEdges.get(start);
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      const current = stack.pop()!;
      if (current === finish) return false;
      for (const neighbor of graph.getNeighbors(current)) {
        requireVertex(ids, neighbor.vertex);
        if (neighbor.edge === arrivalEdge || seen.has(neighbor.vertex)) continue;
        seen.add(neighbor.vertex);
        stack.push(neighbor.vertex);
      }
    }
    return true;
  });
}
