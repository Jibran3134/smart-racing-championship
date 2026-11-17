import type { ExperimentBundle } from '../../src/shared/experiment-results';

/** Synthetic small values for format/UI tests only, never bundled as evidence. */
export function experimentFixture(): ExperimentBundle {
  return { schemaVersion: 1, experiment: 1, title: 'Test exploration', generatedAt: '2026-11-17T00:00:00Z', environment: { runtime: 'test runtime' }, config: { seed: 7, runs: 5, warmups: 2, sizes: [8, 16] },
    methodology: ['Test fixture only.'], counterDescriptions: { visitedVertices: 'Discovered vertices.' }, checks: [{ caseId: 'test', description: 'Test check.', passed: true }],
    samples: [8, 16].flatMap((size) => Array.from({ length: 5 }, (_, i) => ({ caseId: `tree-${size}`, family: 'tree', size, seed: 7, algorithm: 'BFS', phase: 'traversal', run: i + 1, runtimeMs: i + 1, counters: { visitedVertices: size } }))) };
}
