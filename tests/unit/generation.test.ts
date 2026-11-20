import { describe, expect, it } from 'vitest';
import { primMST } from '../../src/core/algorithms/mst/mst';
import { placeTrackFeatures } from '../../src/core/algorithms/backtracking/trackPlacement';
import { TrackValidator } from '../../src/core/generation/TrackValidator';
import { TrackGenerator } from '../../src/core/generation/TrackGenerator';
import type { Vertex, Edge } from '../../src/core/types';

import gpCircuit from '../../src/data/tracks/circuit-grand-prix.json';
import dcCircuit from '../../src/data/tracks/circuit-desert-canyon.json';
import cgCircuit from '../../src/data/tracks/circuit-city-grid.json';

describe('Track Generation & Validation (Alishba)', () => {
  const vertices: Vertex[] = [
    { id: 0, x: 0,   y: 0,   type: 'Start', active: true },
    { id: 1, x: 100, y: 0,   type: 'Intersection', active: true },
    { id: 2, x: 200, y: 0,   type: 'Intersection', active: true },
    { id: 3, x: 100, y: 100, type: 'Intersection', active: true },
  ];

  const candidateEdges: Edge[] = [
    { id: 'e01', from: 0, to: 1, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e12', from: 1, to: 2, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e03', from: 0, to: 3, distance: 141, baseTime: 7, fuelCost: 3, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e13', from: 1, to: 3, distance: 100, baseTime: 5, fuelCost: 2, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
    { id: 'e23', from: 2, to: 3, distance: 141, baseTime: 7, fuelCost: 3, difficulty: 1, status: 'Open', directed: false, isShortcut: false },
  ];

  it('Prim MST computes minimal connected spanning tree backbone', () => {
    const res = primMST(vertices, candidateEdges);
    expect(res.mstEdges.length).toBe(vertices.length - 1); // 3 edges for 4 vertices
    expect(res.totalWeight).toBe(300); // 100 + 100 + 100
    expect(res.counters.expandedVertices).toBe(vertices.length);
  });

  it('backtracking feature placement assigns mandatory roles respecting constraints', () => {
    const vList: Vertex[] = Array.from({ length: 15 }, (_, id) => ({
      id,
      x: id * 50,
      y: (id % 2) * 50,
      type: 'Intersection',
      active: true,
    }));
    const eList: Edge[] = [];
    for (let i = 0; i < 14; i++) {
      eList.push({
        id: `e-${i}`,
        from: i,
        to: i + 1,
        distance: 50,
        baseTime: 3,
        fuelCost: 1,
        difficulty: 1,
        status: 'Open',
        directed: false,
        isShortcut: false,
      });
    }

    const result = placeTrackFeatures(vList, eList, {
      minCheckpointCount: 10,
      minFuelStations: 1,
      minNitroPickups: 1,
      minStationSpacing: 100,
    });

    expect(result.success).toBe(true);
    expect(result.vertices[0].type).toBe('Start');
    const checkpoints = result.vertices.filter((v) => v.type === 'Checkpoint');
    expect(checkpoints.length).toBeGreaterThanOrEqual(10);
  });

  it('TrackValidator validates all 3 official production circuits', () => {
    const gpVal = TrackValidator.validate(gpCircuit.vertices as Vertex[], gpCircuit.edges as Edge[]);
    expect(gpVal.valid).toBe(true);
    expect(gpVal.errors).toEqual([]);

    const dcVal = TrackValidator.validate(dcCircuit.vertices as Vertex[], dcCircuit.edges as Edge[]);
    expect(dcVal.valid).toBe(true);
    expect(dcVal.errors).toEqual([]);

    const cgVal = TrackValidator.validate(cgCircuit.vertices as Vertex[], cgCircuit.edges as Edge[]);
    expect(cgVal.valid).toBe(true);
    expect(cgVal.errors).toEqual([]);
  });

  it('TrackValidator rejects invalid candidate circuits with explicit reasons (Adv. Challenge 1)', () => {
    // 1. Missing Start vertex
    const noStart = gpCircuit.vertices.map((v) => (v.type === 'Start' ? { ...v, type: 'Intersection' } : v));
    const rep1 = TrackValidator.validate(noStart as Vertex[], gpCircuit.edges as Edge[]);
    expect(rep1.valid).toBe(false);
    expect(rep1.errors.some((e) => e.includes('exactly one Start vertex'))).toBe(true);

    // 2. Fewer than 10 checkpoints
    const fewCP = gpCircuit.vertices.map((v) => (v.type === 'Checkpoint' && (v.checkpointOrder ?? 0) > 8 ? { ...v, type: 'Intersection' } : v));
    const rep2 = TrackValidator.validate(fewCP as Vertex[], gpCircuit.edges as Edge[]);
    expect(rep2.valid).toBe(false);
    expect(rep2.errors.some((e) => e.includes('at least 10 checkpoints'))).toBe(true);

    // 3. Fewer than 2 shortcuts
    const noShortcuts = gpCircuit.edges.map((e) => ({ ...e, isShortcut: false }));
    const rep3 = TrackValidator.validate(gpCircuit.vertices as Vertex[], noShortcuts as Edge[]);
    expect(rep3.valid).toBe(false);
    expect(rep3.errors.some((e) => e.includes('at least 2 shortcuts'))).toBe(true);
  });

  it('TrackGenerator procedurally generates a valid track passing validation', () => {
    const generated = TrackGenerator.generate({ name: 'Procedural Circuit', vertexCount: 16, seed: 101 });
    expect(generated.vertices.length).toBeGreaterThanOrEqual(16);
    expect(generated.edges.length).toBeGreaterThanOrEqual(16);

    const val = TrackValidator.validate(generated.vertices, generated.edges);
    expect(val.valid).toBe(true);
  });
});
