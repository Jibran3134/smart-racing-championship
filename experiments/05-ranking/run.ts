/**
 * Experiment 5 Runner — Alishba (Milestone 8).
 * Benchmarks Merge Sort, Quick Sort, Heap Sort, and Top-k Selection.
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { mergeSort } from '../../src/core/algorithms/sorting/mergeSort';
import { quickSort } from '../../src/core/algorithms/sorting/quickSort';
import { heapSort } from '../../src/core/algorithms/sorting/heapSort';
import { topK } from '../../src/core/algorithms/sorting/topK';
import type { ChampionshipEntry } from '../../src/core/types';
import type { ExperimentBundle, ExperimentSample } from '../../src/shared/experiment-results';
import type { ExperimentOptions } from '../shared/options';
import { rankingDataset, rankingFamilies } from './datasets';
import type { RankingDataset } from './datasets';

export function runRanking(
  options: ExperimentOptions,
): Pick<ExperimentBundle, 'samples' | 'checks' | 'counterDescriptions' | 'methodology'> {
  const samples: ExperimentSample[] = [];
  const checks: ExperimentBundle['checks'] = [];

  const K_PARAM = 5;

  const algorithms: [string, (ds: RankingDataset) => { sorted: ChampionshipEntry[]; comparisons: number }][] = [
    ['Merge Sort', (ds) => mergeSort(ds.entries)],
    ['Quick Sort', (ds) => quickSort(ds.entries)],
    ['Heap Sort', (ds) => heapSort(ds.entries)],
    ['Top-K (k=5)', (ds) => {
      const res = topK(ds.entries, K_PARAM);
      return { sorted: res.topK, comparisons: res.comparisons };
    }],
  ];

  const sizes = options.sizes ?? [10, 50, 100, 500];

  for (const size of sizes) {
    for (const [index, family] of rankingFamilies.entries()) {
      const seed = (options.seed ^ Math.imul(size, 2654435761) ^ index) >>> 0;
      const dataset = rankingDataset(size, family, seed);
      const caseId = `${family}-${size}`;

      const mergeRes = mergeSort(dataset.entries);
      const quickRes = quickSort(dataset.entries);
      const heapRes = heapSort(dataset.entries);
      const topKRes = topK(dataset.entries, K_PARAM);

      // Correctness oracle:
      // 1. All full sorts must match in elements and order
      const mergeIds = mergeRes.sorted.map((e) => e.racerId);
      const quickIds = quickRes.sorted.map((e) => e.racerId);
      const heapIds = heapRes.sorted.map((e) => e.racerId);

      assert.deepEqual(quickIds, mergeIds, `QuickSort output does not match MergeSort in ${caseId}`);
      assert.deepEqual(heapIds, mergeIds, `HeapSort output does not match MergeSort in ${caseId}`);

      // 2. Top-k must match the first min(k, size) elements of MergeSort
      const expectedTopK = mergeIds.slice(0, Math.min(K_PARAM, size));
      const actualTopK = topKRes.topK.map((e) => e.racerId);
      assert.deepEqual(actualTopK, expectedTopK, `Top-K output does not match prefix in ${caseId}`);

      checks.push({
        caseId,
        description:
          'Merge, Quick, and Heap sort output equivalence; strict tie-breaker order enforcement; Top-k prefix match.',
        passed: true,
      });

      // Warm-ups
      for (let warmup = 0; warmup < options.warmups; warmup++) {
        for (const [, runAlgo] of algorithms) runAlgo(dataset);
      }

      // Measured runs
      for (let run = 1; run <= options.runs; run++) {
        const order = run % 2 === 0 ? algorithms : [...algorithms].reverse();
        for (const [algorithm, execute] of order) {
          const start = performance.now();
          const result = execute(dataset);
          const runtimeMs = performance.now() - start;

          samples.push({
            caseId,
            family,
            size,
            seed,
            algorithm,
            phase: 'ranking',
            run,
            runtimeMs,
            counters: {
              comparisons: result.comparisons,
              inputEntries: size,
              outputEntries: result.sorted.length,
            },
          });
        }
      }
    }
  }

  return {
    samples,
    checks,
    counterDescriptions: {
      comparisons: 'Number of comparisons performed using the multi-level championship comparator.',
      inputEntries: 'Number of championship racer records supplied.',
      outputEntries: 'Number of sorted entries produced (k for top-k, n for full sorts).',
    },
    methodology: [
      'Championship entries generated across four distinct input arrangements: random, nearly-sorted, reverse-sorted, and duplicate-heavy.',
      'All sorting routines use the shared 5-tier championship comparator: points DESC, wins DESC, position sum ASC, fastest lap ASC, and racerId ASC.',
      'Merge Sort provides a stable baseline O(n log n) divide-and-conquer implementation.',
      'Quick Sort uses 3-way Dutch National Flag partitioning with median-of-three pivot selection to prevent quadratic degradation on duplicates.',
      'Heap Sort uses in-place array heapification with sift-down.',
      'Top-k maintains a size-k min-heap with reversed comparator for O(n log k) retrieval.',
      'Timing measures only sorting operations; input copying, validation, and JSON encoding are strictly excluded.',
    ],
  };
}
