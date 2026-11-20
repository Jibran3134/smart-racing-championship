import { beforeEach, describe, expect, it } from 'vitest';
import {
  productionPresetProvider,
  productionChampionshipProvider,
  productionRaceSetupProvider,
  productionLabAlgorithms,
} from '../../src/adapters';
import { executeLabAlgorithm, defaultLabInputs } from '../../src/ui/adapters/algorithm-lab';
import { previewTrack } from '../../src/ui/fixtures/preview-track';

describe('Production Adapters Integration', () => {
  beforeEach(() => productionChampionshipProvider.reset?.());
  it('productionPresetProvider produces valid routes across all 4 presets', () => {
    const res = productionPresetProvider.compare({
      source: 0,
      target: 6,
      track: previewTrack,
    });
    expect(res.length).toBe(4);
    const presets = res.map((r) => r.preset);
    expect(presets).toEqual(['balanced', 'speed', 'economy', 'safety']);
    for (const route of res) {
      expect(route.weights).toBeDefined();
      if (route.status === 'available') {
        expect(route.vertices[0]).toBe(0);
        expect(route.vertices[route.vertices.length - 1]).toBe(6);
        expect(route.metrics?.cost).toBeGreaterThan(0);
      }
    }
  });

  it('productionChampionshipProvider provides rankings, top-k, and history', () => {
    const mergeRanking = productionChampionshipProvider.getRanking('merge');
    const quickRanking = productionChampionshipProvider.getRanking('quick');
    const heapRanking = productionChampionshipProvider.getRanking('heap');

    expect(mergeRanking.length).toBe(4);
    expect(quickRanking).toEqual(mergeRanking);
    expect(heapRanking).toEqual(mergeRanking);

    const top2 = productionChampionshipProvider.getTopK(2);
    expect(top2.length).toBe(2);
    expect(top2[0].racerId).toBe(mergeRanking[0].racerId);
    expect(top2[1].racerId).toBe(mergeRanking[1].racerId);

    const history = productionChampionshipProvider.pointsHistory;
    expect(history).toEqual([]);
    expect(productionChampionshipProvider.races).toEqual([]);
    expect(mergeRanking.every((racer) => racer.points === 0 && racer.wins === 0)).toBe(true);
  });

  it('productionRaceSetupProvider exposes all 3 official circuits and creates live driver', () => {
    expect(productionRaceSetupProvider.circuits.length).toBe(4); // 3 circuits + demo
    const ids = productionRaceSetupProvider.circuits.map((c) => c.id);
    expect(ids).toContain('circuit-grand-prix');
    expect(ids).toContain('circuit-desert-canyon');
    expect(ids).toContain('circuit-city-grid');

    const advice = productionRaceSetupProvider.getRecommendations!({
      circuitId: 'circuit-grand-prix',
      mode: 'quick',
      laps: 2,
      initialNitro: 3,
      eventsEnabled: true,
    });
    expect(advice.required).toBe(true);
    expect(advice.plans.length).toBe(2); // DP + Greedy

    const driver = productionRaceSetupProvider.createRace({
      circuitId: 'circuit-grand-prix',
      mode: 'quick',
      laps: 2,
      initialNitro: 3,
      eventsEnabled: true,
    });
    expect(driver.kind).toBe('live');
    const state = driver.getState();
    expect(state.phase).toBe('ready');
    expect(state.totalLaps).toBe(2);
    expect(state.cars.length).toBe(4);
  });

  it('completely satisfies missingLabAlgorithms so no algorithm is disabled in the UI', () => {
    const allLabAlgorithms = [...productionLabAlgorithms];
    const missing = [
      'dijkstra', 'astar', 'knapsack', 'greedy',
      'merge-sort', 'quick-sort', 'heap-sort', 'top-k',
      'mst', 'backtracking',
    ];
    for (const id of missing) {
      expect(allLabAlgorithms.some((a) => a.id === id)).toBe(true);
    }
  });

  it('runs all 10 Algorithm Lab adapters through executeLabAlgorithm without validation errors', async () => {
    expect(productionLabAlgorithms.length).toBe(10);

    for (const algo of productionLabAlgorithms) {
      const inputs = defaultLabInputs(algo, previewTrack);
      const controller = new AbortController();
      const trace = await executeLabAlgorithm(algo, inputs, previewTrack, controller.signal);

      expect(trace.algorithmId).toBe(algo.id);
      expect(trace.steps.length).toBeGreaterThanOrEqual(1);
      const lastStep = trace.steps[trace.steps.length - 1];
      expect(lastStep.type).toBe('done');
    }
  });
});
