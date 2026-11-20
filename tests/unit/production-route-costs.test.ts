import { describe, expect, it } from 'vitest';
import { productionLabAlgorithms, productionPresetProvider, productionRaceSetupProvider } from '../../src/adapters';
import { TrackGraph } from '../../src/core/graph/TrackGraph';
import { dijkstra } from '../../src/core/algorithms/routing/dijkstra';
import { executeLabAlgorithm, parseLabTrace } from '../../src/ui/adapters/algorithm-lab';
import type { CostPreset, Edge, Vertex } from '../../src/core/types';
import type { TrackMapData } from '../../src/ui/components/map/map-model';
import gp from '../../src/data/tracks/circuit-grand-prix.json';
import desert from '../../src/data/tracks/circuit-desert-canyon.json';
import city from '../../src/data/tracks/circuit-city-grid.json';

const circuits = [gp, desert, city];
const presets: CostPreset[] = ['Balanced', 'Speed', 'Economy', 'Safety'];

describe('Production routing uses the original circuit attributes', () => {
  it.each(circuits)('$name: Explorer and both Lab searches agree with core costs under every preset', async (raw) => {
    const track = productionRaceSetupProvider.circuits.find((circuit) => circuit.track.name === raw.name)!.track;
    const graph = new TrackGraph(raw.vertices as Vertex[], raw.edges as Edge[]);
    for (const road of track.roads) {
      const original = raw.edges.find((edge) => edge.id === road.id)!;
      expect(road.routing).toMatchObject({ distance: original.distance, baseTime: original.baseTime, fuelCost: original.fuelCost, difficulty: original.difficulty });
    }
    const comparisons = productionPresetProvider.compare({ track, source: 0, target: 10 });
    for (const preset of presets) {
      const actual = dijkstra(graph, 0, 10, preset)!;
      const explorer = comparisons.find((route) => route.preset === preset.toLowerCase())!;
      expect(explorer.metrics).toEqual({ distance: actual.distance, time: actual.time, cost: actual.scalarCost });
      for (const id of ['dijkstra', 'astar']) {
        const algorithm = productionLabAlgorithms.find((candidate) => candidate.id === id)!;
        const trace = await executeLabAlgorithm(algorithm, { source: '0', target: '10', preset }, track, new AbortController().signal);
        expect(trace.summary.cost).toBeCloseTo(actual.scalarCost, 12);
        expect(trace.steps.at(-1)?.state?.cost).toBeCloseTo(actual.scalarCost, 12);
        expect(trace.summary.time).toBe(actual.time);
        expect(parseLabTrace(JSON.stringify(trace)).track?.roads[0].routing).toEqual(track.roads[0].routing);
      }
    }
  });

  it('preserves costs when map geometry changes, and applies Explorer closures without losing attributes', () => {
    const track = productionRaceSetupProvider.circuits[0].track;
    const moved = { ...track, vertices: track.vertices.map((vertex) => ({ ...vertex, x: vertex.x * 3, y: vertex.y * 3 })) };
    expect(productionPresetProvider.compare({ source: 0, target: 1, track: moved })).toEqual(productionPresetProvider.compare({ source: 0, target: 1, track }));
    const blocked = { ...track, roads: track.roads.map((road) => ({ ...road, status: 'blocked' as const })) };
    expect(productionPresetProvider.compare({ source: 0, target: 1, track: blocked }).every((route) => route.status === 'unreachable')).toBe(true);
    const original = productionPresetProvider.compare({ source: 0, target: 1, track });
    expect(original[0].metrics?.time).toBe(5);
    expect(original[0].metrics?.cost).toBeCloseTo(0.9833333333333332, 12);
  });

  it('keeps zero-valued attributes and reports effective restricted travel time', async () => {
    const track: TrackMapData = {
      name: 'Restricted source data',
      vertices: [{ id: 0, x: 0, y: 0, kind: 'start', label: 'S' }, { id: 1, x: 10, y: 0, kind: 'intersection', label: 'T' }],
      roads: [{ id: 'road', from: 0, to: 1, status: 'restricted', directed: true, routing: { distance: 10, baseTime: 0, fuelCost: 0, difficulty: 1, speedCap: 2 } }],
    };
    const expected = dijkstra(new TrackGraph([
      { id: 0, x: 0, y: 0, type: 'Start', active: true }, { id: 1, x: 10, y: 0, type: 'Intersection', active: true },
    ], [{ id: 'road', from: 0, to: 1, status: 'Restricted', directed: true, isShortcut: false, ...track.roads[0].routing! }]), 0, 1, 'Balanced')!;
    expect(productionPresetProvider.compare({ source: 0, target: 1, track })[0].metrics).toEqual({ distance: 10, time: 5, cost: expected.scalarCost });
    const lab = productionLabAlgorithms.find((algorithm) => algorithm.id === 'dijkstra')!;
    const trace = await executeLabAlgorithm(lab, { source: '0', target: '1', preset: 'Balanced' }, track, new AbortController().signal);
    expect(trace.summary.time).toBe(5);
    expect(trace.summary.cost).toBe(expected.scalarCost);
  });
});
