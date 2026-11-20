/**
 * Heap Sort for ChampionshipEntry — Alishba (Milestone 5).
 *
 * In-place O(n log n) sort using bottom-up heapify.
 * Returns a sorted COPY (rank 1 to n, winner at index 0); input array is not mutated.
 * Tracks `comparisons` and `swaps` counters for the Algorithm Lab.
 *
 * Rules (AGENTS.md): No UI; hand-implemented; deterministic.
 */

import type { ChampionshipEntry } from '../../types';
import { compare } from '../../championship/comparator';

export interface HeapSortResult {
  sorted: ChampionshipEntry[];
  comparisons: number;
  swaps: number;
}

/**
 * Sort championship entries using Heap Sort (winner at index 0).
 * @param entries - Input array (not mutated).
 */
export function heapSort(entries: readonly ChampionshipEntry[]): HeapSortResult {
  let comparisons = 0;
  let swaps = 0;
  const arr = entries.slice(); // working copy
  const n = arr.length;

  if (n <= 1) {
    return { sorted: arr, comparisons, swaps };
  }

  function _swap(i: number, j: number): void {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    swaps++;
  }

  /**
   * Sift-down for a max-heap where "max" means WORSE ranking (compare > 0).
   * This ensures the worst entry ends up at the back of the array.
   */
  function _siftDown(root: number, limit: number): void {
    let curr = root;
    while (curr * 2 + 1 < limit) {
      const left = curr * 2 + 1;
      const right = left + 1;
      let worst = curr;

      comparisons++;
      if (compare(arr[left], arr[worst]) > 0) {
        worst = left;
      }

      if (right < limit) {
        comparisons++;
        if (compare(arr[right], arr[worst]) > 0) {
          worst = right;
        }
      }

      if (worst === curr) break;

      _swap(curr, worst);
      curr = worst;
    }
  }

  // 1. Build heap bottom-up (O(n))
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    _siftDown(i, n);
  }

  // 2. Extract worst element from root to end of heap (O(n log n))
  for (let end = n - 1; end > 0; end--) {
    _swap(0, end);
    _siftDown(0, end);
  }

  return { sorted: arr, comparisons, swaps };
}
