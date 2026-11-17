import { describe, expect, it } from 'vitest';
import { parseExperiment, summarizeSamples, samplesCsv, summaryCsv } from '../../src/shared/experiment-results';
import { toCsv, toJson } from '../../src/shared/exports';
import { experimentFixture } from '../fixtures/experiment';

describe('shared evidence and exports', () => {
  it('recomputes mean, median, population dispersion and counters from all raw runs', () => {
    const bundle = parseExperiment(toJson(experimentFixture()));
    const [row] = summarizeSamples(bundle.samples);
    expect(row).toMatchObject({ size: 8, runs: 5, meanMs: 3, medianMs: 3, minMs: 1, maxMs: 5, counters: { visitedVertices: 8 } });
    expect(row.stddevMs).toBeCloseTo(Math.sqrt(2));
    expect(samplesCsv(bundle)).toContain('runtimeMs,visitedVertices\r\n');
    expect(summaryCsv(bundle)).toContain('meanMs,medianMs,stddevMs');
  });

  it('rejects invalid, incomplete, duplicated or inconsistent evidence', () => {
    expect(() => parseExperiment('{')).toThrow('Invalid experiment');
    for (const modify of [
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples.pop(); },
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples[1] = bundle.samples[0]; },
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples[0].runtimeMs = -1; },
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples[0].size = 99; },
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples[0].counters = {}; },
      (bundle: ReturnType<typeof experimentFixture>) => { bundle.samples[0].seed = 123; },
    ]) { const bundle = experimentFixture(); modify(bundle); expect(() => parseExperiment(toJson(bundle))).toThrow(); }
    expect(() => parseExperiment(' '.repeat(5_000_001))).toThrow('5 MB');
    const failed = experimentFixture(); failed.checks[0].passed = false;
    expect(parseExperiment(toJson(failed)).checks[0].passed).toBe(false);
  });

  it('quotes CSV commas, quotes and newlines while keeping numbers and neutralizing formulas', () => {
    expect(toCsv(['label', 'value'], [['a,"b"\nc', -2], ['=SUM(A1)', 3], [null, true]]))
      .toBe('label,value\r\n"a,""b""\nc",-2\r\n\'=SUM(A1),3\r\n,true\r\n');
  });
});
