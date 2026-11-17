import { requireVertex, vertexIds } from './contracts';
import type { ExplorationGraph } from './contracts';

export interface SimpleRoute { vertices: number[]; edges: string[] }
export interface RouteLimits { maxRoutes: number; maxEdges: number; maxExpansions: number }

/** Bounded iterative simple-path enumeration. Excludes the supplied main edge sequence. */
export function alternativeRoutes(graph: ExplorationGraph, start: number, finish: number, main: readonly string[], limits: RouteLimits) {
  const ids = vertexIds(graph);
  requireVertex(ids, start);
  requireVertex(ids, finish);
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (name === 'maxEdges' ? 0 : 1)) throw new Error(`Invalid ${name}.`);
  }
  const routes: SimpleRoute[] = [];
  const vertices = [start];
  const edges: string[] = [];
  const seen = new Set([start]);
  const stack = [{ vertex: start, next: 0, neighbors: graph.getNeighbors(start) }];
  let expansions = 0;
  let truncated = false;
  const backtrack = () => { stack.pop(); seen.delete(vertices.pop()!); edges.pop(); };
  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.vertex === finish) {
      if (edges.length !== main.length || edges.some((edge, index) => edge !== main[index])) routes.push({ vertices: [...vertices], edges: [...edges] });
      backtrack();
      if (routes.length >= limits.maxRoutes) { truncated = stack.length > 0; break; }
      continue;
    }
    if (frame.next >= frame.neighbors.length) { backtrack(); continue; }
    if (edges.length >= limits.maxEdges) { truncated = true; backtrack(); continue; }
    if (expansions >= limits.maxExpansions) { truncated = true; break; }
    const next = frame.neighbors[frame.next++];
    requireVertex(ids, next.vertex);
    expansions++;
    if (seen.has(next.vertex)) continue;
    seen.add(next.vertex);
    vertices.push(next.vertex);
    edges.push(next.edge);
    stack.push({ vertex: next.vertex, next: 0, neighbors: graph.getNeighbors(next.vertex) });
  }
  return { routes, expansions, truncated, limits: { ...limits } };
}
