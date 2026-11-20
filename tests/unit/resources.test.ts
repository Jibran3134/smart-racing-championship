import { describe, expect, it } from 'vitest';
import { knapsackDP } from '../../src/core/algorithms/resources/knapsackDP';
import { greedyKnapsack } from '../../src/core/algorithms/resources/greedyKnapsack';
import { refuellingDP } from '../../src/core/algorithms/resources/refuelingDP';
import { ResourceAdvisor } from '../../src/core/resources/ResourceAdvisor';
import type { ResourceItem } from '../../src/core/types';

describe('Resource Algorithms: 0/1 Knapsack DP, Greedy, Refuelling DP (Alishba)', () => {
  it('handles empty items and zero budget gracefully in DP and Greedy', () => {
    const emptyDP = knapsackDP([], 100);
    expect(emptyDP.selectedIds).toEqual([]);
    expect(emptyDP.totalBenefit).toBe(0);
    expect(emptyDP.feasible).toBe(true);

    const zeroBudget = greedyKnapsack([{ id: '1', label: 'Item 1', cost: 10, benefit: 50 }], 0);
    expect(zeroBudget.selectedIds).toEqual([]);
    expect(zeroBudget.totalBenefit).toBe(0);
  });

  it('proves DP optimality vs Greedy on the assignment counterexample', () => {
    // Project.pdf Section 5.3 counterexample:
    // Item A: cost = 6, benefit = 30 (ratio 5.0)
    // Item B: cost = 5, benefit = 24 (ratio 4.8)
    // Item C: cost = 5, benefit = 24 (ratio 4.8)
    // Budget = 10
    const items: ResourceItem[] = [
      { id: 'A', label: 'Item A', cost: 6, benefit: 30 },
      { id: 'B', label: 'Item B', cost: 5, benefit: 24 },
      { id: 'C', label: 'Item C', cost: 5, benefit: 24 },
    ];
    const budget = 10;

    const greedyPlan = greedyKnapsack(items, budget);
    const dpPlan = knapsackDP(items, budget);

    // Greedy picks A (cost 6, benefit 30), cannot afford B or C
    expect(greedyPlan.selectedIds).toEqual(['A']);
    expect(greedyPlan.totalBenefit).toBe(30);

    // DP picks B and C (cost 10, benefit 48) -> strictly superior!
    expect(dpPlan.selectedIds.sort()).toEqual(['B', 'C']);
    expect(dpPlan.totalBenefit).toBe(48);
    expect(dpPlan.totalBenefit).toBeGreaterThan(greedyPlan.totalBenefit);
  });

  it('handles zero-cost positive-benefit items without division by zero', () => {
    const items: ResourceItem[] = [
      { id: 'free1', label: 'Free Booster', cost: 0, benefit: 20 },
      { id: 'paid1', label: 'Paid Upgrade', cost: 10, benefit: 50 },
    ];
    const budget = 15;

    const greedyPlan = greedyKnapsack(items, budget);
    const dpPlan = knapsackDP(items, budget);

    expect(greedyPlan.selectedIds).toContain('free1');
    expect(greedyPlan.selectedIds).toContain('paid1');
    expect(dpPlan.selectedIds).toContain('free1');
    expect(dpPlan.selectedIds).toContain('paid1');
  });

  it('verifies DP against exhaustive brute-force search', () => {
    const items: ResourceItem[] = [
      { id: '1', label: 'I1', cost: 3, benefit: 12 },
      { id: '2', label: 'I2', cost: 4, benefit: 17 },
      { id: '3', label: 'I3', cost: 2, benefit: 10 },
      { id: '4', label: 'I4', cost: 5, benefit: 25 },
      { id: '5', label: 'I5', cost: 1, benefit: 4 },
    ];
    const budget = 8;

    // Brute force
    let maxBenefit = 0;
    for (let mask = 0; mask < (1 << items.length); mask++) {
      let cost = 0;
      let ben = 0;
      for (let i = 0; i < items.length; i++) {
        if ((mask & (1 << i)) !== 0) {
          cost += items[i].cost;
          ben += items[i].benefit;
        }
      }
      if (cost <= budget && ben > maxBenefit) maxBenefit = ben;
    }

    const dpPlan = knapsackDP(items, budget);
    expect(dpPlan.totalBenefit).toBe(maxBenefit);
  });

  it('runs Refuelling DP to compute minimum stop-time', () => {
    // 2 stations, leg costs: [400, 300], startFuel: 500 (in discrete tenths)
    const plan = refuellingDP(2, [400, 300], 500);
    expect(plan.feasible).toBe(true);
    expect(plan.buyAmounts.length).toBe(2);
  });

  it('ResourceAdvisor provides both DP and Greedy recommendations to UI', () => {
    const advisor = new ResourceAdvisor();
    const advice = advisor.getRecommendations({
      items: [
        { id: 'p1', label: 'Nitro 1', cost: 20, benefit: 40 },
        { id: 'p2', label: 'Nitro 2', cost: 30, benefit: 70 },
      ],
      budget: 40,
    });

    expect(advice.required).toBe(true);
    expect(advice.plans.length).toBe(2);
    expect(advice.plans[0].method).toBe('dp');
    expect(advice.plans[1].method).toBe('greedy');
    expect(advice.plans[0].feasible).toBe(true);
  });

  it('demonstrates team-made counterexample 1 where greedy is strictly worse than DP', () => {
    // Team-made counterexample 1: Heavy trap item vs twin optimal items
    // Budget: 100
    // Item 1 (Greedy Trap): Cost = 51, Benefit = 60 (Ratio = 1.176)
    // Item 2: Cost = 50, Benefit = 55 (Ratio = 1.100)
    // Item 3: Cost = 50, Benefit = 55 (Ratio = 1.100)
    const items: ResourceItem[] = [
      { id: 'trap', label: 'Greedy Trap Upgrade', cost: 51, benefit: 60 },
      { id: 'opt1', label: 'Twin Upgrade Alpha', cost: 50, benefit: 55 },
      { id: 'opt2', label: 'Twin Upgrade Beta', cost: 50, benefit: 55 },
    ];
    const budget = 100;

    const greedy = greedyKnapsack(items, budget);
    const dp = knapsackDP(items, budget);

    // Greedy picks 'trap' (cost 51, ben 60), leaving 49 budget (neither opt1 nor opt2 fits)
    expect(greedy.selectedIds).toEqual(['trap']);
    expect(greedy.totalBenefit).toBe(60);

    // DP picks 'opt1' and 'opt2' (cost 100, ben 110) -> +83.3% higher benefit!
    expect(dp.selectedIds.sort()).toEqual(['opt1', 'opt2']);
    expect(dp.totalBenefit).toBe(110);
    expect(dp.totalBenefit).toBeGreaterThan(greedy.totalBenefit);
  });

  it('demonstrates team-made counterexample 2 where greedy is strictly worse than DP', () => {
    // Team-made counterexample 2: Granularity mismatch in race part weight budget
    // Budget: 12
    // Item A: Cost = 7, Benefit = 14 (Ratio = 2.0)
    // Item B: Cost = 6, Benefit = 11 (Ratio = 1.833)
    // Item C: Cost = 6, Benefit = 11 (Ratio = 1.833)
    const items: ResourceItem[] = [
      { id: 'partA', label: 'Turbo Charger', cost: 7, benefit: 14 },
      { id: 'partB', label: 'Aero Wing', cost: 6, benefit: 11 },
      { id: 'partC', label: 'Lightweight Chassis', cost: 6, benefit: 11 },
    ];
    const budget = 12;

    const greedy = greedyKnapsack(items, budget);
    const dp = knapsackDP(items, budget);

    // Greedy picks partA (cost 7, ben 14), leaves 5 budget (neither partB nor partC fits)
    expect(greedy.selectedIds).toEqual(['partA']);
    expect(greedy.totalBenefit).toBe(14);

    // DP picks partB and partC (cost 12, ben 22) -> +57% higher benefit!
    expect(dp.selectedIds.sort()).toEqual(['partB', 'partC']);
    expect(dp.totalBenefit).toBe(22);
    expect(dp.totalBenefit).toBeGreaterThan(greedy.totalBenefit);
  });

  it('verifies resource feasibility under capacity limits, full tank, and insufficient fuel', () => {
    // Refuelling with insufficient fuel across distance that exceeds max possible fuel
    // 1 station, leg 1 costs 1500 (tank max is 1000) -> impossible!
    const infeasiblePlan = refuellingDP(1, [1500, 100], 500);
    expect(infeasiblePlan.feasible).toBe(false);

    // Already full tank: leg costs 100, startFuel 1000 (full) -> 0 purchase needed
    const fullTankPlan = refuellingDP(1, [100, 100], 1000);
    expect(fullTankPlan.feasible).toBe(true);
    expect(fullTankPlan.buyAmounts[0]).toBe(0);
  });
});
