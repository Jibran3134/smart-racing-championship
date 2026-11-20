/**
 * Greedy 0/1 Knapsack — Alishba (Milestone 4).
 *
 * Sort items by (benefit / cost) DESC.
 * Handle cost === 0 items specially: select all with positive benefit first.
 * Tie-break by lower item id (lexicographic).
 * Iterate in sorted order and greedily include while budget permits.
 *
 * NOT guaranteed to be optimal (see DP for optimal solution).
 * Time: O(n log n)   Space: O(n)
 *
 * Rules (AGENTS.md): No UI/DOM/React; hand-implemented; deterministic.
 */

import type { ResourceItem, ResourcePlan } from '../../types';

/**
 * Solve the 0/1 Knapsack problem using the greedy ratio heuristic.
 *
 * @param items  - Candidate items.
 * @param budget - Total discrete budget units (non-negative integer).
 * @returns ResourcePlan with method 'greedy' and dpStateCount = 0.
 */
export function greedyKnapsack(items: readonly ResourceItem[], budget: number): ResourcePlan {
  const B = Math.floor(budget);

  if (items.length === 0 || B <= 0) {
    return {
      method: 'greedy',
      selectedIds: [],
      totalCost: 0,
      totalBenefit: 0,
      feasible: true,
      dpStateCount: 0,
    };
  }

  // Separate zero-cost items (infinite ratio) from normal items
  const zeroCost: ResourceItem[]  = [];
  const normal:   ResourceItem[]  = [];

  for (const item of items) {
    if (Math.floor(item.cost) === 0) zeroCost.push(item);
    else normal.push(item);
  }

  // Sort zero-cost items: positive benefit only; tie-break by id
  zeroCost.sort((a, b) => {
    if (b.benefit !== a.benefit) return b.benefit - a.benefit;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  // Sort normal items by benefit/cost DESC; tie-break by id ASC
  normal.sort((a, b) => {
    const ratioA = a.benefit / Math.floor(a.cost);
    const ratioB = b.benefit / Math.floor(b.cost);
    if (Math.abs(ratioB - ratioA) > 1e-12) return ratioB - ratioA;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const selectedIds: string[] = [];
  let remaining = B;
  let totalBenefit = 0;

  // Always take positive-benefit zero-cost items (they cost nothing)
  for (const item of zeroCost) {
    if (item.benefit > 0) {
      selectedIds.push(item.id);
      totalBenefit += item.benefit;
      // remaining unchanged (cost = 0)
    }
  }

  // Greedily take normal items
  for (const item of normal) {
    const cost = Math.floor(item.cost);
    if (cost <= remaining) {
      selectedIds.push(item.id);
      remaining -= cost;
      totalBenefit += item.benefit;
    }
  }

  const totalCost = B - remaining;

  return {
    method: 'greedy',
    selectedIds,
    totalCost,
    totalBenefit,
    feasible: totalCost <= B,
    dpStateCount: 0,
  };
}
