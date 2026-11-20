/**
 * 0/1 Knapsack DP — Alishba (Milestone 4).
 *
 * Classic bottom-up DP.
 *   dp[i][b] = max total benefit selecting from items[0..i-1] with budget b.
 *
 * Time: O(n × B)   Space: O(n × B)
 * (B = budget discrete units; n = number of items)
 *
 * Rules (AGENTS.md):
 *  - No UI/DOM/React imports.
 *  - Algorithm implemented by hand; no library calls.
 *  - Deterministic: items processed in input order; ties keep lower-index item.
 */

import type { ResourceItem, ResourcePlan } from '../../types';

/**
 * Solve the 0/1 Knapsack problem using dynamic programming.
 *
 * @param items  - Candidate items; cost and benefit must be non-negative integers.
 * @param budget - Total discrete budget units (non-negative integer).
 * @returns ResourcePlan with method 'dp' and dpStateCount = n × (B+1).
 */
export function knapsackDP(items: readonly ResourceItem[], budget: number): ResourcePlan {
  const n = items.length;
  const B = Math.floor(budget); // ensure integer

  // Edge case: nothing to choose from
  if (n === 0 || B <= 0) {
    return {
      method: 'dp',
      selectedIds: [],
      totalCost: 0,
      totalBenefit: 0,
      feasible: true,
      dpStateCount: 0,
    };
  }

  // Build DP table: (n+1) × (B+1)
  // Using flat typed array for performance
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(B + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const item = items[i - 1];
    const cost = Math.floor(item.cost);   // discrete cost units
    const val  = item.benefit;

    for (let b = 0; b <= B; b++) {
      // Don't take item i
      dp[i][b] = dp[i - 1][b];
      // Take item i (if affordable)
      if (cost <= b) {
        const take = dp[i - 1][b - cost] + val;
        if (take > dp[i][b]) {
          dp[i][b] = take;
        }
      }
    }
  }

  // Backtrack to find which items are selected
  const selectedIds: string[] = [];
  let b = B;
  for (let i = n; i >= 1; i--) {
    if (dp[i][b] !== dp[i - 1][b]) {
      selectedIds.push(items[i - 1].id);
      b -= Math.floor(items[i - 1].cost);
    }
  }
  selectedIds.reverse(); // restore input order

  const totalCost    = selectedIds.reduce((s, id) => s + Math.floor(items.find(it => it.id === id)!.cost), 0);
  const totalBenefit = dp[n][B];

  return {
    method: 'dp',
    selectedIds,
    totalCost,
    totalBenefit,
    feasible: totalCost <= B,
    dpStateCount: (n + 1) * (B + 1),
  };
}
