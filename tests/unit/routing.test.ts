import { describe, expect, it } from 'vitest';
import { TrackGraph } from '../../src/core/graph/TrackGraph';
import { dijkstra } from '../../src/core/algorithms/routing/dijkstra';
import { astar } from '../../src/core/algorithms/routing/astar';
import { planRoute, recalculate } from '../../src/core/algorithms/routing/legPlanner';
import type { Vertex, Edge } from '../../src/core/types';

describe('Routing Algorithms: Dijkstra, A*, Leg Planner (Alishba)', () => {
  const vertices: Vertex[] = [
    { id: 0, x: 0,   y: 0,   type: 'Start', active: true },
    { id: 1, x: 100, y: 0,   type: 'Checkpoint', checkpointOrder: 1, active: true },
    { id: 2, x: 200, y: 0,   type: 'Checkpoint', checkpointOrder: 2, active: true },
    { id: 3, x: 100, y: 100, type: 'Intersection', active: true },
    { id: 4, x: 300, y: 0,   type: 'Finish', active: true },
    { id: 5, x: 500, y: 500, type: 'DeadEnd', active: true }, // isolated
  ];

  const edges: Edge[] = [
    { id: 'e01', from: 0, to: 1, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e12', from: 1, to: 2, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e24', from: 2, to: 4, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    // Alternative path via vertex 3 (longer distance, higher baseTime)
    { id: 'e03', from: 0, to: 3, distance: 141, baseTime: 12, fuelCost: 6, difficulty: 3, status: 'Open', directed: false, isShortcut: false },
    { id: 'e32', from: 3, to: 2, distance: 141, baseTime: 12, fuelCost: 6, difficulty: 3, status: 'Open', directed: false, isShortcut: false },
  ];

  it('runs Dijkstra to find optimal shortest path', () => {
    const graph = new TrackGraph(vertices, edges);
    const result = dijkstra(graph, 0, 4, 'Balanced');
    expect(result).not.toBeNull();
    expect(result!.path).toEqual([0, 1, 2, 4]);
    expect(result!.distance).toBe(300);
    expect(result!.scalarCost).toBeGreaterThan(0);
  });

  it('handles source equals destination and unreachable target in Dijkstra', () => {
    const graph = new TrackGraph(vertices, edges);
    const same = dijkstra(graph, 0, 0, 'Balanced');
    expect(same).not.toBeNull();
    expect(same!.path).toEqual([0]);
    expect(same!.distance).toBe(0);

    const unreachable = dijkstra(graph, 0, 5, 'Balanced');
    expect(unreachable).toBeNull();
  });

  it('avoids blocked edges and diverts to alternative path in Dijkstra', () => {
    const graph = new TrackGraph(vertices, edges);
    // Block e01 -> must divert via vertex 3: 0 -> 3 -> 2 -> 4
    graph.blockEdge('e01');
    const result = dijkstra(graph, 0, 4, 'Balanced');
    expect(result).not.toBeNull();
    expect(result!.path).toEqual([0, 3, 2, 4]);
  });

  it('records operation counters and trace steps in Dijkstra', () => {
    const graph = new TrackGraph(vertices, edges);
    const steps: unknown[] = [];
    const result = dijkstra(graph, 0, 4, 'Balanced', [], (step) => steps.push(step));
    expect(result).not.toBeNull();
    expect(steps.length).toBeGreaterThan(0);
  });

  it('A* matches Dijkstra shortest path cost', () => {
    const graph = new TrackGraph(vertices, edges);
    const dijkstraRes = dijkstra(graph, 0, 4, 'Balanced');
    const astarRes = astar(graph, 0, 4, 'Balanced');

    expect(dijkstraRes).not.toBeNull();
    expect(astarRes).not.toBeNull();
    expect(Math.abs(dijkstraRes!.scalarCost - astarRes!.scalarCost)).toBeLessThan(1e-6);
    expect(astarRes!.path).toEqual(dijkstraRes!.path);
  });

  it('Leg Planner preserves mandatory checkpoint ordering', () => {
    const graph = new TrackGraph(vertices, edges);
    const legs = planRoute(graph, 0, [1, 2], 4, 'Balanced');
    expect(legs.length).toBe(3);
    expect(legs[0]?.path).toEqual([0, 1]);
    expect(legs[1]?.path).toEqual([1, 2]);
    expect(legs[2]?.path).toEqual([2, 4]);
  });

  it('Leg Planner recalculates remaining route after mid-race road closure', () => {
    const graph = new TrackGraph(vertices, edges);
    // Car has reached vertex 1, heading to CP 2, then Finish 4
    // Suddenly e12 is blocked
    graph.blockEdge('e12');
    const recalculated = recalculate(graph, { currentVertex: 1, nextCheckpoint: 2 }, [2], 4, 'Balanced');
    expect(recalculated.length).toBe(2);
    // Must go 1 -> 0 -> 3 -> 2 for leg 1, then 2 -> 4 for leg 2
    expect(recalculated[0]?.path[0]).toBe(1);
    expect(recalculated[0]?.path.at(-1)).toBe(2);
    expect(recalculated[1]?.path).toEqual([2, 4]);
  });

  it('handles zero-weight edges and equal-cost paths deterministically', () => {
    const zeroVertices: Vertex[] = [
      { id: 0, x: 0, y: 0, type: 'Start', active: true },
      { id: 1, x: 10, y: 0, type: 'Intersection', active: true },
      { id: 2, x: 20, y: 0, type: 'Finish', active: true },
    ];
    const zeroEdges: Edge[] = [
      { id: 'z1', from: 0, to: 1, distance: 0, baseTime: 0, fuelCost: 0, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
      { id: 'z2', from: 1, to: 2, distance: 0, baseTime: 0, fuelCost: 0, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    ];
    const graph = new TrackGraph(zeroVertices, zeroEdges);
    const res = dijkstra(graph, 0, 2, 'Balanced');
    expect(res).not.toBeNull();
    expect(res!.path).toEqual([0, 1, 2]);
    expect(res!.distance).toBe(0);
  });

  it('demonstrates preset-dependent routing where Speed takes shortcut and Safety avoids it', () => {
    // Branching graph: Top route is high-speed shortcut (fast but high difficulty and fuel)
    // Bottom route is safe standard road (low difficulty, low fuel, but slower)
    const forkVertices: Vertex[] = [
      { id: 0, x: 0, y: 0, type: 'Start', active: true },
      { id: 1, x: 100, y: -50, type: 'Intersection', active: true }, // high risk
      { id: 2, x: 100, y: 50, type: 'Intersection', active: true },  // safe
      { id: 3, x: 200, y: 0, type: 'Finish', active: true },
    ];
    const forkEdges: Edge[] = [
      // Top branch: very fast time (1s), but difficulty 5 and high fuel (15)
      { id: 'top-1', from: 0, to: 1, distance: 100, baseTime: 1, fuelCost: 15, difficulty: 5, status: 'Open', directed: true, isShortcut: true },
      { id: 'top-2', from: 1, to: 3, distance: 100, baseTime: 1, fuelCost: 15, difficulty: 5, status: 'Open', directed: true, isShortcut: true },
      // Bottom branch: very slow time (60s), but difficulty 1 and low fuel (2)
      { id: 'bot-1', from: 0, to: 2, distance: 100, baseTime: 60, fuelCost: 2, difficulty: 1, status: 'Open', directed: true, isShortcut: false },
      { id: 'bot-2', from: 2, to: 3, distance: 100, baseTime: 60, fuelCost: 2, difficulty: 1, status: 'Open', directed: true, isShortcut: false },
    ];
    const graph = new TrackGraph(forkVertices, forkEdges);

    const speedRoute = dijkstra(graph, 0, 3, 'Speed');
    const safetyRoute = dijkstra(graph, 0, 3, 'Safety');

    expect(speedRoute).not.toBeNull();
    expect(safetyRoute).not.toBeNull();
    // Speed preset prioritizes time and takes top branch [0, 1, 3]
    expect(speedRoute!.path).toEqual([0, 1, 3]);
    // Safety preset penalizes difficulty/risk and avoids top branch, choosing bottom [0, 2, 3]
    expect(safetyRoute!.path).toEqual([0, 2, 3]);
  });

  it('A* falls back to h=0 when geometric bounds are invalid, matching Dijkstra optimality', () => {
    // Non-Euclidean embedding where edge distance < Euclidean distance
    const abstractVertices: Vertex[] = [
      { id: 0, x: 0, y: 0, type: 'Start', active: true },
      { id: 1, x: 1000, y: 1000, type: 'Intersection', active: true },
      { id: 2, x: 2000, y: 2000, type: 'Finish', active: true },
    ];
    const abstractEdges: Edge[] = [
      { id: 'short-direct', from: 0, to: 1, distance: 1, baseTime: 1, fuelCost: 1, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
      { id: 'short-dest', from: 1, to: 2, distance: 1, baseTime: 1, fuelCost: 1, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    ];
    const graph = new TrackGraph(abstractVertices, abstractEdges);
    const dijkstraRes = dijkstra(graph, 0, 2, 'Balanced');
    const astarRes = astar(graph, 0, 2, 'Balanced');
    expect(astarRes).not.toBeNull();
    expect(dijkstraRes).not.toBeNull();
    expect(astarRes!.distance).toBe(dijkstraRes!.distance);
    expect(astarRes!.path).toEqual(dijkstraRes!.path);
  });
});
