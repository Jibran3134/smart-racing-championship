import { toCsv } from './exports';

/** Reusable evidence format; it does not freeze shared gameplay interfaces. */
export interface ExperimentSample {
  caseId: string; family: string; size: number; seed: number;
  algorithm: string; phase: string; run: number; runtimeMs: number;
  counters: Record<string, number>;
}
export interface ExperimentBundle {
  schemaVersion: 1; experiment: number; title: string; generatedAt: string;
  environment: Record<string, string | number>;
  config: { seed: number; runs: number; warmups: number; sizes: number[] };
  methodology: string[];
  counterDescriptions: Record<string, string>;
  checks: { caseId: string; description: string; passed: boolean }[];
  samples: ExperimentSample[];
}
export interface ExperimentSummary {
  caseId: string; family: string; size: number; seed: number; algorithm: string; phase: string;
  runs: number; meanMs: number; medianMs: number; stddevMs: number; minMs: number; maxMs: number;
  counters: Record<string, number>;
}

export function summarizeSamples(samples: readonly ExperimentSample[]): ExperimentSummary[] {
  const groups = new Map<string, ExperimentSample[]>();
  for (const sample of samples) {
    const key = JSON.stringify([sample.caseId, sample.algorithm, sample.phase]);
    const group = groups.get(key) ?? []; group.push(sample); groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const first = group[0]; const times = group.map((row) => row.runtimeMs).sort((a, b) => a - b);
    const mean = times.reduce((sum, value) => sum + value, 0) / times.length;
    const counters: Record<string, number> = Object.create(null);
    for (const key of Object.keys(first.counters)) counters[key] = group.reduce((sum, row) => sum + row.counters[key], 0) / group.length;
    return { caseId: first.caseId, family: first.family, size: first.size, seed: first.seed, algorithm: first.algorithm, phase: first.phase, runs: times.length,
      meanMs: mean, medianMs: (times[Math.floor((times.length - 1) / 2)] + times[Math.floor(times.length / 2)]) / 2,
      stddevMs: Math.sqrt(times.reduce((sum, time) => sum + (time - mean) ** 2, 0) / times.length), minMs: times[0], maxMs: times[times.length - 1], counters };
  });
}

export function samplesCsv(bundle: ExperimentBundle): string {
  const keys = [...new Set(bundle.samples.flatMap((row) => Object.keys(row.counters)))].sort();
  return toCsv(['experiment', 'caseId', 'family', 'size', 'seed', 'algorithm', 'phase', 'run', 'runtimeMs', ...keys],
    bundle.samples.map((row) => [bundle.experiment, row.caseId, row.family, row.size, row.seed, row.algorithm, row.phase, row.run, row.runtimeMs, ...keys.map((key) => row.counters[key])]));
}

export function summaryCsv(bundle: ExperimentBundle): string {
  const rows = summarizeSamples(bundle.samples);
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row.counters)))].sort();
  return toCsv(['caseId', 'family', 'size', 'algorithm', 'phase', 'runs', 'meanMs', 'medianMs', 'stddevMs', 'minMs', 'maxMs', ...keys],
    rows.map((row) => [row.caseId, row.family, row.size, row.algorithm, row.phase, row.runs, row.meanMs, row.medianMs, row.stddevMs, row.minMs, row.maxMs, ...keys.map((key) => row.counters[key])]));
}

/** Validate imported evidence before charting. Summaries are always recomputed. */
export function parseExperiment(text: string): ExperimentBundle {
  if (text.length > 5_000_000) throw new Error('Results file exceeds the 5 MB limit.');
  const fail = (): never => { throw new Error('Invalid experiment results. Import a version 1 results JSON file produced by the experiment runner.'); };
  let input: unknown; try { input = JSON.parse(text); } catch { return fail(); }
  const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
  const positiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
  const nonnegative = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const string = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 2000;
  const seed = (value: unknown) => nonnegative(value) && Number.isSafeInteger(value) && value <= 0xffffffff;
  if (!object(input) || input.schemaVersion !== 1 || !positiveInteger(input.experiment) || Number(input.experiment) > 5 || !string(input.title) || !string(input.generatedAt) || !Number.isFinite(Date.parse(input.generatedAt))) return fail();
  if (!object(input.config) || !seed(input.config.seed) || !positiveInteger(input.config.runs) || !nonnegative(input.config.warmups) || !Number.isInteger(input.config.warmups) || !Array.isArray(input.config.sizes) || !input.config.sizes.length || !input.config.sizes.every(positiveInteger)) return fail();
  const expectedRuns = input.config.runs;
  if (!object(input.environment) || !Object.values(input.environment).every((value) => typeof value === 'string' || typeof value === 'number' && Number.isFinite(value))) return fail();
  if (!object(input.counterDescriptions) || !Object.values(input.counterDescriptions).every(string) || !Array.isArray(input.methodology) || !input.methodology.every(string)) return fail();
  if (!Array.isArray(input.checks) || !input.checks.length || !input.checks.every((check) => object(check) && string(check.caseId) && string(check.description) && typeof check.passed === 'boolean')) return fail();
  if (!Array.isArray(input.samples) || !input.samples.length || input.samples.length > 20000) return fail();
  const seen = new Set<string>();
  const metadata = new Map<string, string>();
  const counts = new Map<string, number>();
  for (const row of input.samples) {
    if (!object(row) || !string(row.caseId) || !string(row.family) || !string(row.algorithm) || !string(row.phase) || !positiveInteger(row.size) || !seed(row.seed) || !positiveInteger(row.run) || row.run > expectedRuns || !nonnegative(row.runtimeMs) || !object(row.counters) || !Object.values(row.counters).every(nonnegative)) return fail();
    if (!input.config.sizes.includes(row.size)) return fail();
    const key = JSON.stringify([row.caseId, row.algorithm, row.phase]);
    const signature = JSON.stringify([row.family, row.size, row.seed, Object.keys(row.counters).sort()]);
    if (metadata.has(key) && metadata.get(key) !== signature) return fail();
    metadata.set(key, signature);
    const run = `${key}:${row.run}`; if (seen.has(run)) return fail(); seen.add(run);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if ([...counts.values()].some((count) => count !== expectedRuns)) return fail();
  return input as unknown as ExperimentBundle;
}
