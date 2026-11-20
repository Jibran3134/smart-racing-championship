/**
 * Top-k Selection for ChampionshipEntry — Alishba (Milestone 5).
 *
 * Uses a size-k heap (MinHeap with reversed comparator so the worst candidate is at the root).
 * Time complexity: O(n log k)   Space complexity: O(k)
 *
 * Reuses Jibran's generic MinHeap from src/core/structures/MinHeap.ts.
 * Returns the top-k entries sorted from 1st to kth place.
 *
 * Rules (AGENTS.md): No UI; hand-implemented; deterministic.
 */

import { MinHeap } from '../../structures/MinHeap';
import type { ChampionshipEntry } from '../../types';
import { compare } from '../../championship/comparator';

export interface TopKResult {
  topK: ChampionshipEntry[];
  comparisons: number;
  heapOps: number;
}

/**
 * Retrieve the top-k championship entries.
 *
 * @param entries - Array of championship entries.
 * @param k       - Number of top entries to return (integer ≥ 0).
 */
export function topK(entries: readonly ChampionshipEntry[], k: number): TopKResult {
  const boundedK = Math.max(0, Math.floor(k));

  if (boundedK === 0 || entries.length === 0) {
    return { topK: [], comparisons: 0, heapOps: 0 };
  }

  const targetK = Math.min(boundedK, entries.length);
  let comparisons = 0;

  // Comparator where WORST entry (compare > 0) has highest extraction priority (< 0)
  // i.e., root of MinHeap will be the worst among the current top-k candidates.
  const rootIsWorst = (a: ChampionshipEntry, b: ChampionshipEntry): number => {
    comparisons++;
    return -compare(a, b);
  };

  const heap = new MinHeap<ChampionshipEntry>(rootIsWorst);

  // 1. Insert first targetK entries
  for (let i = 0; i < targetK; i++) {
    heap.push(entries[i]);
  }

  // 2. For remaining entries, replace root if candidate is better than current worst
  for (let i = targetK; i < entries.length; i++) {
    const candidate = entries[i];
    const worstInTopK = heap.peek()!;
    comparisons++;
    if (compare(candidate, worstInTopK) < 0) {
      heap.pop();
      heap.push(candidate);
    }
  }

  // 3. Extract all elements (comes out worst to best)
  const result: ChampionshipEntry[] = [];
  while (!heap.isEmpty) {
    result.push(heap.pop()!);
  }
  // Reverse to get rank 1 to rank targetK (best to worst)
  result.reverse();

  const hc = heap.counters;

  return {
    topK: result,
    comparisons: comparisons + hc.comparisons,
    heapOps: hc.heapOps,
  };
}
