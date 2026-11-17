import type { ExplorationGraph, ExplorationNeighbor } from '../../src/core/algorithms/exploration/contracts';
import { random } from '../shared/random';

export const graphFamilies = ['sparse-tree', 'sparse-cyclic', 'dense', 'disconnected'] as const;
export type GraphFamily = typeof graphFamilies[number];
export interface ExplorationDataset { graph: ExplorationGraph; edges: [number, number][]; size: number; family: GraphFamily; seed: number }

/** Experiment-only graphs, not production circuit generation. Undirected, simple. */
export function explorationDataset(size: number, family: GraphFamily, seed: number): ExplorationDataset {
  if (!Number.isSafeInteger(size) || size < 2 || size > 2048) throw new Error('Graph size must be 2-2048.');
  const next = random(seed);
  const adjacency: ExplorationNeighbor[][] = Array.from({ length: size }, () => []);
  const edges: [number, number][] = []; const keys = new Set<string>();
  const add = (a: number, b: number) => {
    if (a === b) return;
    const key = `${Math.min(a, b)}:${Math.max(a, b)}`; if (keys.has(key)) return;
    keys.add(key); const edge = `e${edges.length}`; edges.push([a, b]);
    adjacency[a].push({ vertex: b, edge }); adjacency[b].push({ vertex: a, edge });
  };
  for (let vertex = 1; vertex < size; vertex++) {
    if (family === 'disconnected' && vertex === Math.floor(size / 2)) continue;
    const base = family === 'disconnected' && vertex > Math.floor(size / 2) ? Math.floor(size / 2) : 0;
    add(vertex, base + Math.floor(next() * (vertex - base)));
  }
  if (family === 'sparse-cyclic') { add(0, size - 1); for (let i = 0; i < size * 2; i++) add(Math.floor(next() * size), Math.floor(next() * size)); }
  if (family === 'dense') for (let a = 0; a < size; a++) for (let b = a + 1; b < size; b++) if (next() < 0.12) add(a, b);
  const vertices = Array.from({ length: size }, (_, id) => ({ id }));
  return { size, family, seed, edges, graph: { directed: false, getVertices: () => vertices, getNeighbors: (id) => adjacency[id] ?? [] } };
}
