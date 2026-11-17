/** Provisional read-only adapter. This does not freeze the shared game model. */
export interface ExplorationVertex {
  id: number;
  mandatory?: boolean;
}

export interface ExplorationNeighbor {
  vertex: number;
  edge: string;
}

export interface ExplorationGraph {
  /** Selects cycle semantics. Directed views treat reciprocal arcs as a cycle. */
  directed: boolean;
  getVertices(): readonly ExplorationVertex[];
  /** Must return legal, unblocked outgoing arcs in deterministic order. */
  getNeighbors(vertex: number): readonly ExplorationNeighbor[];
}

export interface ExplorationCounters {
  expandedVertices: number;
  visitedVertices: number;
  examinedEdges: number;
  relaxedEdges: number;
  heapOps: number;
  comparisons: number;
}

/** Common minimum trace envelope, with exploration-specific replay snapshots. */
export interface ExplorationStep {
  type: 'visit' | 'relax' | 'push' | 'pop' | 'done';
  vertex?: number;
  edge?: string;
  counters: ExplorationCounters;
  frontier: number[];
  visited: number[];
}

export type OnExplorationStep = (step: ExplorationStep) => void;

export interface ExplorationResult {
  order: number[];
  parents: Map<number, number>;
  parentEdges: Map<number, string>;
  counters: ExplorationCounters;
}

export function emptyCounters(): ExplorationCounters {
  return { expandedVertices: 0, visitedVertices: 0, examinedEdges: 0, relaxedEdges: 0, heapOps: 0, comparisons: 0 };
}

export function vertexIds(graph: ExplorationGraph): Set<number> {
  const vertices = graph.getVertices();
  const ids = new Set(vertices.map((vertex) => vertex.id));
  if (ids.size !== vertices.length) throw new Error('Duplicate vertex IDs.');
  return ids;
}

export function requireVertex(ids: ReadonlySet<number>, id: number): void {
  if (!ids.has(id)) throw new Error(`Unknown vertex: ${id}`);
}

export function reconstructPath(result: ExplorationResult, start: number, target: number): { vertices: number[]; edges: string[] } | null {
  if (!result.order.includes(target)) return null;
  const vertices = [target];
  const edges: string[] = [];
  while (vertices[vertices.length - 1] !== start) {
    const current = vertices[vertices.length - 1];
    const parent = result.parents.get(current);
    const edge = result.parentEdges.get(current);
    if (parent === undefined || edge === undefined || vertices.length > result.order.length) return null;
    vertices.push(parent);
    edges.push(edge);
  }
  return { vertices: vertices.reverse(), edges: edges.reverse() };
}
