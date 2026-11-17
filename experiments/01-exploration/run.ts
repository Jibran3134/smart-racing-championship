import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { bfs } from '../../src/core/algorithms/exploration/bfs';
import { connectedComponents, dfs } from '../../src/core/algorithms/exploration/dfs';
import type { ExplorationResult } from '../../src/core/algorithms/exploration/contracts';
import type { ExperimentBundle, ExperimentSample } from '../../src/shared/experiment-results';
import type { ExperimentOptions } from '../shared/options';
import { explorationDataset, graphFamilies } from './datasets';
import type { ExplorationDataset } from './datasets';

/** Independent connectivity/cycle oracle: disjoint sets over the input edge list. */
export function validateExploration(dataset: ExplorationDataset): void {
  const { graph, edges, size } = dataset;
  const parent = Array.from({ length: size }, (_, id) => id);
  const root = (vertex: number): number => { while (parent[vertex] !== vertex) { parent[vertex] = parent[parent[vertex]]; vertex = parent[vertex]; } return vertex; };
  for (const [a, b] of edges) parent[root(a)] = root(b);
  const expected = new Map<number, number[]>();
  for (let id = 0; id < size; id++) { const key = root(id); const group = expected.get(key) ?? []; group.push(id); expected.set(key, group); }
  const canonical = (components: number[][]) => components.map((group) => [...group].sort((a, b) => a - b)).sort((a, b) => a[0] - b[0]);
  assert.deepEqual(canonical(connectedComponents(graph)), canonical([...expected.values()]));
  const reachable = expected.get(root(0))!; const reachableSet = new Set(reachable);
  const traversal = bfs(graph, 0), depth = dfs(graph, 0);
  for (const result of [traversal, depth]) {
    assert.deepEqual([...result.order].sort((a, b) => a - b), reachable);
    assert.equal(result.counters.visitedVertices, reachable.length);
    assert.equal(result.counters.examinedEdges, reachable.reduce((sum, id) => sum + graph.getNeighbors(id).length, 0));
  }
  const componentEdges = edges.filter(([a]) => reachableSet.has(a)).length;
  assert.equal(depth.hasCycle, componentEdges >= reachable.length);
  // Shortest-path certificate: parent depths and every arc's triangle inequality.
  const distances = new Map([[0, 0]]);
  for (const id of traversal.order.slice(1)) distances.set(id, distances.get(traversal.parents.get(id)!)! + 1);
  for (const id of reachable) for (const neighbor of graph.getNeighbors(id)) assert.ok(distances.get(neighbor.vertex)! <= distances.get(id)! + 1);
  assert.ok([...distances.values()].every(Number.isFinite));
}

export function runExploration(options: ExperimentOptions): Pick<ExperimentBundle, 'samples' | 'checks' | 'counterDescriptions' | 'methodology'> {
  const samples: ExperimentSample[] = [], checks: ExperimentBundle['checks'] = [];
  const algorithms: [string, (dataset: ExplorationDataset) => ExplorationResult][] = [['BFS', (dataset) => bfs(dataset.graph, 0)], ['DFS', (dataset) => dfs(dataset.graph, 0)]];
  for (const size of options.sizes ?? [64, 256, 1024]) for (const [index, family] of graphFamilies.entries()) {
    const seed = (options.seed ^ Math.imul(size, 2654435761) ^ index) >>> 0;
    const dataset = explorationDataset(size, family, seed), caseId = `${family}-${size}`;
    validateExploration(dataset);
    checks.push({ caseId, description: 'BFS shortest-edge certificate; DFS cycle, reachability and weak/undirected component oracle; exact counters.', passed: true });
    for (let warmup = 0; warmup < options.warmups; warmup++) for (const [, algorithm] of algorithms) algorithm(dataset);
    for (let run = 1; run <= options.runs; run++) for (const [algorithm, execute] of run % 2 ? algorithms : [...algorithms].reverse()) {
      const start = performance.now(); const result = execute(dataset); const runtimeMs = performance.now() - start;
      samples.push({ caseId, family, size, seed, algorithm, phase: 'traversal', run, runtimeMs,
        counters: { ...result.counters, vertices: size, edges: dataset.edges.length, arcs: dataset.edges.length * 2 } });
    }
  }
  return { samples, checks, counterDescriptions: {
    visitedVertices: 'Discovered vertices reachable from source 0.', expandedVertices: 'Vertices whose adjacency list is expanded.', examinedEdges: 'Outgoing adjacency arcs examined; each reachable undirected edge contributes two.',
    relaxedEdges: 'New DFS/BFS tree links.', comparisons: 'Discovery/color membership checks on examined arcs.', heapOps: 'Zero: exploration does not use the heap.', vertices: 'Total vertices, including unreachable components.', edges: 'Unique undirected edges.', arcs: 'Stored directed adjacency entries (2E).',
  }, methodology: [
    'Input graphs are generated once per case before timing: seeded random trees; sparse cyclic graphs; trees with 12% of possible extra edges; and two disconnected trees. These are experiment datasets, not gameplay circuits.',
    'Both algorithms traverse the entire component reachable from vertex 0 on the identical graph. Each measured call includes its internal validation, sets/maps, result arrays and counters; graph generation, tracing, correctness checks and I/O are excluded.',
    'Each algorithm receives warm-up calls before measured runs. Measured order alternates BFS/DFS by run. No manual garbage collection is forced; JIT, allocation and machine load affect timings.',
    'Correctness is checked separately with disjoint-set connectivity, component edge counts for undirected cycles, and a BFS shortest-edge certificate (parent depths plus every arc triangle inequality). Disconnected counters cover only the source component.',
    'Compare growth against V + examined adjacency arcs. Dense cases grow quadratically in vertex count because E grows quadratically. This does not change traversal complexity O(V+E). DFS dead-end and alternative-route enumeration are excluded.',
  ] };
}
