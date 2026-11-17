import { describe, expect, it } from 'vitest';
import { graphFixture } from '../../../../tests/fixtures/exploration';
import { bfs } from './bfs';
import { dfs, connectedComponents, analyzeDeadEnds } from './dfs';
import { alternativeRoutes } from './alternativeRoutes';
import { reconstructPath } from './contracts';
import type { ExplorationStep } from './contracts';

describe('BFS and DFS', () => {
  it('handles a single vertex and source equals destination', () => {
    const graph = graphFixture([0], []);
    for (const result of [bfs(graph, 0), dfs(graph, 0)]) {
      expect(result.order).toEqual([0]);
      expect(reconstructPath(result, 0, 0)).toEqual({ vertices: [0], edges: [] });
      expect(result.counters.examinedEdges).toBe(0);
    }
    expect(dfs(graph, 0).hasCycle).toBe(false);
    expect(connectedComponents(graph)).toEqual([[0]]);
  });

  it('finds minimum edge count rather than minimum weighted distance', () => {
    // The brief's S-T distance 10 versus S-A-B-T distance 6 example.
    const graph = graphFixture([0, 1, 2, 3], [[0, 3, 'distance-10'], [0, 1, 'distance-2a'], [1, 2, 'distance-2b'], [2, 3, 'distance-2c']]);
    expect(reconstructPath(bfs(graph, 0), 0, 3)).toEqual({ vertices: [0, 3], edges: ['distance-10'] });
    expect(dfs(graph, 0).hasCycle).toBe(true);
  });

  it('handles branching, disconnected components and unreachable destinations', () => {
    const graph = graphFixture([0, 1, 2, 3, 4], [[0, 1, 'a'], [0, 2, 'b'], [2, 3, 'c']]);
    const breadth = bfs(graph, 0);
    expect(breadth.order).toEqual([0, 1, 2, 3]);
    expect(reconstructPath(breadth, 0, 4)).toBeNull();
    expect(dfs(graph, 0).hasCycle).toBe(false);
    expect(connectedComponents(graph).map((component) => component.length)).toEqual([4, 1]);
    expect(breadth.counters).toEqual({ expandedVertices: 4, visitedVertices: 4, examinedEdges: 6, relaxedEdges: 3, heapOps: 0, comparisons: 6 });
  });

  it('respects directed arcs and distinguishes weak components from reachability', () => {
    const graph = graphFixture([0, 1, 2, 3], [[0, 1, 'a'], [2, 1, 'b']], true);
    expect(bfs(graph, 1).order).toEqual([1]);
    expect(connectedComponents(graph).map((component) => component.length)).toEqual([3, 1]);
    expect(dfs(graph, 0).hasCycle).toBe(false);
    const cyclic = graphFixture([0, 1, 2], [[0, 1, 'a'], [1, 2, 'b'], [2, 0, 'c']], true);
    expect(dfs(cyclic, 0).hasCycle).toBe(true);
    // A finished neighbor is not a cycle in a DAG.
    expect(dfs(graphFixture([0, 1, 2], [[0, 1, 'a'], [0, 2, 'b'], [2, 1, 'c']], true), 0).hasCycle).toBe(false);
  });

  it('detects self-loops and parallel undirected edge cycles', () => {
    expect(dfs(graphFixture([0], [[0, 0, 'loop']]), 0).hasCycle).toBe(true);
    expect(dfs(graphFixture([0, 1], [[0, 1, 'a'], [0, 1, 'b']]), 0).hasCycle).toBe(true);
  });

  it('identifies arrival-relative dead ends and excludes mandatory vertices', () => {
    const graph = graphFixture([0, 1, 2, 3, 4], [[0, 1, 'a'], [1, 2, 'b'], [1, 3, 'c'], [1, 4, 'd']], false, [0, 4]);
    expect(analyzeDeadEnds(graph, dfs(graph, 0), 2)).toEqual([3]);
    const directed = graphFixture([0, 1, 2], [[0, 1, 'a'], [0, 2, 'b']], true, [0]);
    expect(analyzeDeadEnds(directed, dfs(directed, 0), 2)).toEqual([1]);
  });

  it('rejects missing vertices and malformed adjacency', () => {
    const graph = graphFixture([0], []);
    expect(() => bfs(graph, 9)).toThrow('Unknown vertex');
    expect(() => dfs(graph, 9)).toThrow('Unknown vertex');
    expect(() => bfs({ ...graph, getNeighbors: () => [{ vertex: 7, edge: 'bad' }] }, 0)).toThrow('Unknown vertex');
    expect(() => dfs({ ...graph, getVertices: () => [{ id: 0 }, { id: 0 }] }, 0)).toThrow('Duplicate');
  });

  it.each([bfs, dfs])('produces deterministic independent trace snapshots: %s', (algorithm) => {
    const graph = graphFixture([0, 1, 2], [[0, 1, 'a'], [1, 2, 'b']]);
    const first: ExplorationStep[] = [];
    const second: ExplorationStep[] = [];
    const result = algorithm(graph, 0, (step) => first.push(step));
    algorithm(graph, 0, (step) => second.push(step));
    expect(first).toEqual(second);
    expect(first[0].counters.expandedVertices).toBe(0);
    expect(first.at(-1)?.type).toBe('done');
    expect(first.at(-1)?.counters).toEqual(result.counters);
    expect(first.at(-1)?.frontier).toEqual([]);
    expect(first.at(-1)?.visited).toEqual(result.order);
    first[0].visited.push(999);
    expect(first.at(-1)?.visited).not.toContain(999);
  });

  it('traverses a long chain without recursive stack overflow', () => {
    const ids = Array.from({ length: 15000 }, (_, index) => index);
    const graph = graphFixture(ids, ids.slice(1).map((id) => [id - 1, id, `e${id}`]));
    expect(dfs(graph, 0).order).toHaveLength(ids.length);
  });
});

describe('bounded alternatives', () => {
  const graph = graphFixture([0, 1, 2, 3], [[0, 1, 'a'], [1, 3, 'b'], [0, 2, 'c'], [2, 3, 'd'], [1, 2, 'e']]);
  const limits = { maxRoutes: 10, maxEdges: 4, maxExpansions: 100 };

  it('returns only simple alternatives and excludes the main edge sequence', () => {
    const result = alternativeRoutes(graph, 0, 3, ['a', 'b'], limits);
    expect(result.routes).toHaveLength(3);
    for (const route of result.routes) {
      expect(new Set(route.vertices).size).toBe(route.vertices.length);
      expect(route.edges).not.toEqual(['a', 'b']);
    }
    expect(result.truncated).toBe(false);
  });

  it('enforces route count, length and search-work bounds', () => {
    expect(alternativeRoutes(graph, 0, 3, [], { ...limits, maxRoutes: 1 }).routes).toHaveLength(1);
    expect(alternativeRoutes(graph, 0, 3, [], { ...limits, maxEdges: 1 }).routes).toEqual([]);
    const bounded = alternativeRoutes(graph, 0, 3, [], { ...limits, maxExpansions: 1 });
    expect(bounded.expansions).toBe(1);
    expect(bounded.truncated).toBe(true);
    expect(() => alternativeRoutes(graph, 0, 3, [], { ...limits, maxRoutes: 0 })).toThrow('Invalid');
  });

  it('handles source equals target and unreachable targets', () => {
    expect(alternativeRoutes(graph, 0, 0, [], limits).routes).toEqual([]);
    expect(alternativeRoutes(graphFixture([0, 1], []), 0, 1, [], limits).routes).toEqual([]);
  });
});
