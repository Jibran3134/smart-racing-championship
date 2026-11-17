import { describe, expect, it } from 'vitest';
import { explorationDataset, graphFamilies } from '../../experiments/01-exploration/datasets';
import { runExploration, validateExploration } from '../../experiments/01-exploration/run';
import { eventDataset, runEvents } from '../../experiments/04-events/run';
import { parseOptions } from '../../experiments/shared/options';
import { experimentFixture } from '../fixtures/experiment';
import { parseExperiment } from '../../src/shared/experiment-results';

describe('reproducible production-algorithm experiments', () => {
  it('generates repeatable graphs and validates all graph families with independent certificates', () => {
    for (const family of graphFamilies) {
      const first = explorationDataset(16, family, 7);
      expect(first.edges).toEqual(explorationDataset(16, family, 7).edges);
      expect(() => validateExploration(first)).not.toThrow();
    }
    const options = { experiment: '1' as const, seed: 7, runs: 5, warmups: 1, sizes: [8, 16] };
    const result = runExploration(options);
    expect(result.samples).toHaveLength(80); expect(result.checks).toHaveLength(8);
    const deterministic = (rows: typeof result.samples) => rows.map((row) => ({ ...row, runtimeMs: 0 }));
    expect(deterministic(result.samples)).toEqual(deterministic(runExploration(options).samples));
    expect(() => parseExperiment(JSON.stringify({ ...experimentFixture(), ...result, config: options }))).not.toThrow();
  });

  it('checks queue order, ties, tombstone removal and real processor expirations', () => {
    expect(eventDataset(8, false, 12)).toEqual(eventDataset(8, false, 12));
    const result = runEvents({ experiment: '4', seed: 7, runs: 5, warmups: 1, sizes: [8, 16] });
    expect(result.samples).toHaveLength(70); expect(result.checks.every((check) => check.passed)).toBe(true);
    for (const sample of result.samples) {
      if (sample.phase === 'cancellation') { expect(sample.counters.heapOps).toBe(0); expect(sample.counters.storageSize).toBe(sample.size); }
      if (sample.phase === 'extraction') { expect(sample.counters.pops).toBe(sample.size); expect(sample.counters.storageSize).toBe(0); }
    }
  });

  it('validates CLI limits and accepts options independently of order', () => {
    expect(parseOptions([])).toBeNull();
    expect(parseOptions(['--sizes', '1000,10000', '--experiment', '4'])?.sizes).toEqual([1000, 10000]);
    for (const args of [['--runs', '0'], ['--sizes', '8,8'], ['--sizes', '999999,1000000'], ['--seed', '-1'], ['--experiment', '2'], ['--runs', '5', '--runs', '6']]) expect(() => parseOptions(args)).toThrow();
  });
});
