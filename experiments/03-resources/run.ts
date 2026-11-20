/**
 * Experiment 3 Runner — Alishba (Milestone 8).
 * Benchmarks 0/1 Knapsack Dynamic Programming vs Greedy Heuristic.
 */

import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { knapsackDP } from '../../src/core/algorithms/resources/knapsackDP';
import { greedyKnapsack } from '../../src/core/algorithms/resources/greedyKnapsack';
import type { ResourcePlan, ResourceItem } from '../../src/core/types';
import type { ExperimentBundle, ExperimentSample } from '../../src/shared/experiment-results';
import type { ExperimentOptions } from '../shared/options';
import { resourceDataset, resourceFamilies } from './datasets';
import type { ResourceDataset } from './datasets';

/** Brute-force exhaustive search for small verification datasets (n <= 12). */
function bruteForceKnapsack(items: readonly ResourceItem[], budget: number): number {
  let best = 0;
  const n = items.length;
  const totalSubsets = 1 << n;
  for (let mask = 0; mask < totalSubsets; mask++) {
    let cost = 0;
    let benefit = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) !== 0) {
        cost += items[i].cost;
        benefit += items[i].benefit;
      }
    }
    if (cost <= budget && benefit > best) {
      best = benefit;
    }
  }
  return best;
}

export function runResources(
  options: ExperimentOptions,
): Pick<ExperimentBundle, 'samples' | 'checks' | 'counterDescriptions' | 'methodology'> {
  const samples: ExperimentSample[] = [];
  const checks: ExperimentBundle['checks'] = [];

  const algorithms: [string, (ds: ResourceDataset) => ResourcePlan][] = [
    ['0/1 Knapsack DP', (ds) => knapsackDP(ds.items, ds.budget)],
    ['Greedy Knapsack', (ds) => greedyKnapsack(ds.items, ds.budget)],
  ];

  const sizes = options.sizes ?? [10, 20, 50, 100];

  for (const size of sizes) {
    for (const [index, family] of resourceFamilies.entries()) {
      const seed = (options.seed ^ Math.imul(size, 2246822519) ^ index) >>> 0;
      const dataset = resourceDataset(size, family, seed);
      const caseId = `${family}-${size}`;

      const dpPlan = knapsackDP(dataset.items, dataset.budget);
      const greedyPlan = greedyKnapsack(dataset.items, dataset.budget);

      // 1. Feasibility verification
      assert.ok(dpPlan.feasible, `DP plan must be feasible in ${caseId}`);
      assert.ok(greedyPlan.feasible, `Greedy plan must be feasible in ${caseId}`);
      assert.ok(dpPlan.totalCost <= dataset.budget, `DP cost exceeds budget in ${caseId}`);
      assert.ok(greedyPlan.totalCost <= dataset.budget, `Greedy cost exceeds budget in ${caseId}`);

      // 2. Optimality certificate: DP benefit >= Greedy benefit
      assert.ok(
        dpPlan.totalBenefit >= greedyPlan.totalBenefit - 1e-9,
        `DP benefit (${dpPlan.totalBenefit}) must be >= Greedy (${greedyPlan.totalBenefit}) in ${caseId}`,
      );

      // 3. Exhaustive oracle on small cases (n <= 10)
      if (size <= 10) {
        const optimalBenefit = bruteForceKnapsack(dataset.items, dataset.budget);
        assert.equal(dpPlan.totalBenefit, optimalBenefit, `DP failed brute-force oracle in ${caseId}`);
      }

      checks.push({
        caseId,
        description:
          'DP optimality guarantee (benefit >= greedy); budget feasibility check; brute-force subset equivalence for small n.',
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
          const plan = execute(dataset);
          const runtimeMs = performance.now() - start;

          samples.push({
            caseId,
            family,
            size,
            seed,
            algorithm,
            phase: 'knapsack',
            run,
            runtimeMs,
            counters: {
              itemsSelected: plan.selectedIds.length,
              totalCost: plan.totalCost,
              totalBenefit: plan.totalBenefit,
              budget: dataset.budget,
              dpStateCount: plan.dpStateCount,
              itemCount: size,
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
      itemsSelected: 'Number of discrete resource items chosen in the final plan.',
      totalCost: 'Total discrete budget consumed by selected items.',
      totalBenefit: 'Total combined utility score achieved by the plan.',
      budget: 'Maximum allowable discrete capacity constraint.',
      dpStateCount: 'Total state cells evaluated in dynamic programming table ((n+1)*(B+1)).',
      itemCount: 'Total candidate items considered in the dataset.',
    },
    methodology: [
      'Problem instances evaluated across three distinct distribution families: uncorrelated, strongly-correlated, and adversarial greedy counter-examples.',
      'Dynamic programming builds a bottom-up 2D table of dimension (n+1) * (B+1) and reconstructs selections by backtracking.',
      'Greedy heuristic sorts items in descending order of benefit/cost ratio and greedily selects items while capacity allows.',
      'Correctness oracle checks feasibility (cost <= budget) and verifies DP optimality against greedy and against exhaustive brute-force search for small n <= 10.',
      'Timing measures solely table computation and backtracking. Allocation of input arrays and validation assertions are excluded.',
    ],
  };
}
