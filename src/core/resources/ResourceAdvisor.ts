/**
 * ResourceAdvisor — Alishba (Milestone 4).
 *
 * Bridges the core resource algorithms (knapsackDP, greedyKnapsack) with the
 * UI's RaceSetupProvider interface.  Returns both a DP plan and a Greedy plan
 * as ResourcePlanView objects so the UI can let the player choose.
 *
 * Rules (AGENTS.md): No UI/DOM/React imports; pure core logic only.
 * The adapter layer (RaceEngineAdapter.ts) is what imports from src/ui.
 */

import { knapsackDP }     from '../algorithms/resources/knapsackDP';
import { greedyKnapsack } from '../algorithms/resources/greedyKnapsack';
import type { ResourceItem } from '../types';
import { MAX_FUEL, RESOURCE_UNIT } from '../config';

// ---------------------------------------------------------------------------
// Public interface (kept in src/core — no ui import)
// ---------------------------------------------------------------------------

export interface ResourceRequest {
  /**
   * Candidate items derived from the selected circuit (fuel stops, nitro pickups).
   * Cost is in discrete RESOURCE_UNIT increments.
   */
  items: readonly ResourceItem[];
  /**
   * Total discrete budget (integer).  Defaults to MAX_FUEL × RESOURCE_UNIT.
   */
  budget?: number;
}

export interface ResourcePlanSummary {
  id: string;
  label: string;
  method: 'dp' | 'greedy';
  feasible: boolean;
  explanation: string;
  selectedIds: string[];
  totalCost: number;
  totalBenefit: number;
  budget: number;
  budgetLabel: string;
}

export interface ResourceAdviceSummary {
  required: boolean;
  plans: ResourcePlanSummary[];
}

// ---------------------------------------------------------------------------
// ResourceAdvisor
// ---------------------------------------------------------------------------

export class ResourceAdvisor {
  /**
   * Compute both DP-optimal and Greedy resource plans for a race setup.
   *
   * @param request - Items and optional budget.
   * @returns Two ResourcePlanSummary entries (dp, greedy).  Never infeasible plans.
   */
  getRecommendations(request: ResourceRequest): ResourceAdviceSummary {
    const budget = request.budget ?? MAX_FUEL * RESOURCE_UNIT;
    const items  = request.items;

    const dpPlan      = knapsackDP(items, budget);
    const greedyPlan  = greedyKnapsack(items, budget);

    const budgetLabel = `${(budget / RESOURCE_UNIT).toFixed(0)} fuel units`;

    const dpSummary: ResourcePlanSummary = {
      id: 'dp',
      label: 'Optimal (DP)',
      method: 'dp',
      feasible: dpPlan.feasible,
      explanation:
        `Dynamic programming guarantees the globally optimal selection ` +
        `(benefit ${dpPlan.totalBenefit.toFixed(2)}, cost ${dpPlan.totalCost} units). ` +
        `Filled ${dpPlan.dpStateCount.toLocaleString()} DP states.`,
      selectedIds: dpPlan.selectedIds,
      totalCost: dpPlan.totalCost,
      totalBenefit: dpPlan.totalBenefit,
      budget,
      budgetLabel,
    };

    const greedySummary: ResourcePlanSummary = {
      id: 'greedy',
      label: 'Greedy (Fast)',
      method: 'greedy',
      feasible: greedyPlan.feasible,
      explanation:
        `Greedy selection by benefit-to-cost ratio — fast O(n log n) but ` +
        `may not be globally optimal ` +
        `(benefit ${greedyPlan.totalBenefit.toFixed(2)}, cost ${greedyPlan.totalCost} units).`,
      selectedIds: greedyPlan.selectedIds,
      totalCost: greedyPlan.totalCost,
      totalBenefit: greedyPlan.totalBenefit,
      budget,
      budgetLabel,
    };

    return {
      required: items.length > 0,
      plans: [dpSummary, greedySummary],
    };
  }
}
