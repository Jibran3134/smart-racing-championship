/**
 * Experiment 3 Datasets — Resources (0/1 Knapsack DP vs Greedy).
 */

import type { ResourceItem } from '../../src/core/types';
import { random } from '../shared/random';

export const resourceFamilies = ['uncorrelated', 'strongly-correlated', 'counter-example'] as const;
export type ResourceFamily = typeof resourceFamilies[number];

export interface ResourceDataset {
  items: ResourceItem[];
  budget: number;
  size: number;
  family: ResourceFamily;
  seed: number;
}

export function resourceDataset(size: number, family: ResourceFamily, seed: number): ResourceDataset {
  const next = random(seed);
  const items: ResourceItem[] = [];

  const baseBudget = Math.max(50, size * 15);

  if (family === 'counter-example') {
    // Classic counter-example where Greedy fails:
    // Item 1: cost = B/2 + 1, benefit = 1.05 * (B/2 + 1) -> ratio ~ 1.05
    // Items 2 & 3: cost = B/2 each, benefit = 0.9 * B/2 each -> ratio 0.9, but together sum to 1.8 * B/2 > 1.05 * B/2
    const half = Math.floor(baseBudget / 2);
    items.push({ id: 'item-greedy-trap', label: 'Greedy Trap', cost: half + 1, benefit: Math.round((half + 1) * 1.2) });
    items.push({ id: 'item-opt-1', label: 'Optimal Part 1', cost: half, benefit: Math.round(half * 1.0) });
    items.push({ id: 'item-opt-2', label: 'Optimal Part 2', cost: half, benefit: Math.round(half * 1.0) });

    for (let i = 4; i <= size; i++) {
      const c = Math.max(5, Math.floor(next() * 30));
      const b = Math.max(1, Math.floor(next() * 30));
      items.push({ id: `item-${i}`, label: `Resource ${i}`, cost: c, benefit: b });
    }
  } else if (family === 'strongly-correlated') {
    for (let i = 1; i <= size; i++) {
      const cost = 10 + Math.floor(next() * 50);
      const benefit = cost + 15; // benefit strictly tied to cost
      items.push({ id: `item-${i}`, label: `Resource ${i}`, cost, benefit });
    }
  } else {
    // uncorrelated
    for (let i = 1; i <= size; i++) {
      const cost = 5 + Math.floor(next() * 60);
      const benefit = 10 + Math.floor(next() * 100);
      items.push({ id: `item-${i}`, label: `Resource ${i}`, cost, benefit });
    }
  }

  return {
    items,
    budget: baseBudget,
    size,
    family,
    seed,
  };
}
