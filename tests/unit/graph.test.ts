import { describe, expect, it } from 'vitest';
import { TrackGraph } from '../../src/core/graph/TrackGraph';
import { computeEdgeCost } from '../../src/core/graph/cost';
import type { Vertex, Edge } from '../../src/core/types';

describe('TrackGraph & Cost Calculation (Alishba)', () => {
  const sampleVertices: Vertex[] = [
    { id: 0, x: 0, y: 0, type: 'Start', active: true },
    { id: 1, x: 100, y: 0, type: 'Checkpoint', checkpointOrder: 1, active: true },
    { id: 2, x: 200, y: 0, type: 'FuelStation', active: true },
    { id: 3, x: 300, y: 0, type: 'DeadEnd', active: true },
  ];

  const sampleEdges: Edge[] = [
    { id: 'e1', from: 0, to: 1, distance: 100, baseTime: 10, fuelCost: 5, difficulty: 2, status: 'Open', directed: false, isShortcut: false },
    { id: 'e2', from: 1, to: 2, distance: 100, baseTime: 10, fuelCost: 5, difficulty: 3, status: 'Open', directed: true, isShortcut: false },
    { id: 'e3', from: 2, to: 3, distance: 50,  baseTime: 5,  fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: true },
  ];

  it('constructs a valid track graph and retrieves vertices and edges', () => {
    const graph = new TrackGraph(sampleVertices, sampleEdges);
    expect(graph.getVertices().length).toBe(4);
    expect(graph.getVertex(0)?.type).toBe('Start');
    expect(graph.getVertex(99)).toBeUndefined();
    expect(graph.getEdge('e1')?.distance).toBe(100);
  });

  it('rejects duplicate vertex IDs and invalid checkpoint orders', () => {
    const dupVertices: Vertex[] = [
      { id: 0, x: 0, y: 0, type: 'Start', active: true },
      { id: 0, x: 10, y: 10, type: 'Checkpoint', checkpointOrder: 1, active: true },
    ];
    expect(() => new TrackGraph(dupVertices, [])).toThrow(/Duplicate vertex id/);

    const nonContiguousCP: Vertex[] = [
      { id: 0, x: 0, y: 0, type: 'Start', active: true },
      { id: 1, x: 10, y: 10, type: 'Checkpoint', checkpointOrder: 2, active: true }, // missing order 1
    ];
    expect(() => new TrackGraph(nonContiguousCP, [])).toThrow(/contiguous starting at 1/);
  });

  it('handles directed vs undirected edges in neighbor lookups', () => {
    const graph = new TrackGraph(sampleVertices, sampleEdges);
    // e1 is undirected: 0 -> 1 and 1 -> 0
    const neighbors0 = graph.getNeighbors(0).map((e) => e.to);
    expect(neighbors0).toContain(1);

    const neighbors1 = graph.getNeighbors(1).map((e) => e.to);
    expect(neighbors1).toContain(0); // reverse direction available
    expect(neighbors1).toContain(2); // e2 is directed: 1 -> 2

    // e2 is directed (1 -> 2): 2 should NOT have edge back to 1 via e2
    const neighbors2 = graph.getNeighbors(2).map((e) => e.to);
    expect(neighbors2).not.toContain(1);
    expect(neighbors2).toContain(3); // e3 is undirected: 2 -> 3
  });

  it('dynamically blocks and unblocks edges without graph reconstruction', () => {
    const graph = new TrackGraph(sampleVertices, sampleEdges);
    expect(graph.getNeighbors(0).map((e) => e.id)).toContain('e1');

    graph.blockEdge('e1');
    expect(graph.getNeighbors(0).map((e) => e.id)).not.toContain('e1');
    expect(graph.getEdge('e1')?.status).toBe('Blocked');

    graph.unblockEdge('e1');
    expect(graph.getNeighbors(0).map((e) => e.id)).toContain('e1');
    expect(graph.getEdge('e1')?.status).toBe('Open');
  });

  it('dynamically mutates edge restrictions and station active status', () => {
    const graph = new TrackGraph(sampleVertices, sampleEdges);
    graph.setEdgeRestriction('e1', 30);
    expect(graph.getEdge('e1')?.status).toBe('Restricted');
    expect(graph.getEdge('e1')?.speedCap).toBe(30);

    graph.setStationActive(2, false);
    expect(graph.getVertex(2)?.active).toBe(false);

    graph.setShortcutStatus('e3', false);
    expect(graph.getEdge('e3')?.status).toBe('Blocked');
  });

  it('adapts TrackGraph to ExplorationGraph for exploration algorithms', () => {
    const graph = new TrackGraph(sampleVertices, sampleEdges);
    const expGraph = graph.toExplorationGraph();
    expect(expGraph.getVertices().length).toBe(4);
    const neighbors0 = expGraph.getNeighbors(0);
    expect(neighbors0.length).toBeGreaterThan(0);
    expect(neighbors0[0].vertex).toBe(1);
  });

  it('computes edge cost correctly for all 4 presets and active effects', () => {
    const edge = sampleEdges[0]; // distance 100, baseTime 10, fuelCost 5, difficulty 2
    const balancedCost = computeEdgeCost(edge, 'Balanced');
    const speedCost = computeEdgeCost(edge, 'Speed');
    const economyCost = computeEdgeCost(edge, 'Economy');
    const safetyCost = computeEdgeCost(edge, 'Safety');

    expect(balancedCost).toBeGreaterThan(0);
    expect(speedCost).toBeGreaterThan(0);
    expect(economyCost).toBeGreaterThan(0);
    expect(safetyCost).toBeGreaterThan(0);

    // Active effect (oil spill penalty of +2 difficulty)
    const costWithOil = computeEdgeCost(edge, 'Balanced', [{ edgeId: 'e1', difficultyPenalty: 2 }]);
    expect(costWithOil).toBeGreaterThan(balancedCost);

    // Active speed cap slowing traversal
    const costWithCap = computeEdgeCost(edge, 'Balanced', [{ edgeId: 'e1', speedCap: 5 }]);
    expect(costWithCap).toBeGreaterThan(balancedCost);
  });
});
