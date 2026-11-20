/**
 * Quick Sort for ChampionshipEntry — Alishba (Milestone 5).
 *
 * In-place 3-way Dutch National Flag partitioning with median-of-three pivot.
 * Handles duplicate scores efficiently in O(n) rather than O(n^2).
 * Returns a sorted COPY; input array is not mutated.
 * Tracks `comparisons` and `swaps` counters for the Algorithm Lab.
 *
 * Rules (AGENTS.md): No UI; hand-implemented; deterministic.
 */

import type { ChampionshipEntry } from '../../types';
import { compare } from '../../championship/comparator';

export interface QuickSortResult {
  sorted: ChampionshipEntry[];
  comparisons: number;
  swaps: number;
}

/**
 * Sort championship entries using 3-way Quick Sort.
 * @param entries - Input array (not mutated).
 */
export function quickSort(entries: readonly ChampionshipEntry[]): QuickSortResult {
  let comparisons = 0;
  let swaps = 0;
  const arr = entries.slice(); // working copy

  _quickSort(arr, 0, arr.length - 1);

  return { sorted: arr, comparisons, swaps };

  // -------------------------------------------------------------------------

  function _swap(a: ChampionshipEntry[], i: number, j: number): void {
    if (i === j) return;
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
    swaps++;
  }

  function _medianOfThree(a: ChampionshipEntry[], lo: number, hi: number): number {
    const mid = (lo + hi) >>> 1;
    comparisons++;
    if (compare(a[mid], a[lo]) < 0) {
      _swap(a, lo, mid);
    }
    comparisons++;
    if (compare(a[hi], a[lo]) < 0) {
      _swap(a, lo, hi);
    }
    comparisons++;
    if (compare(a[hi], a[mid]) < 0) {
      _swap(a, mid, hi);
    }
    return mid;
  }

  function _quickSort(a: ChampionshipEntry[], lo: number, hi: number): void {
    if (lo >= hi) return;

    // Median-of-three pivot selection placed at lo
    const pivotIdx = _medianOfThree(a, lo, hi);
    _swap(a, lo, pivotIdx);
    const pivot = a[lo];

    // 3-way partitioning (Dutch National Flag)
    // a[lo..lt-1] < pivot (ranks better)
    // a[lt..i-1] == pivot
    // a[gt+1..hi] > pivot (ranks worse)
    let lt = lo;
    let gt = hi;
    let i = lo + 1;

    while (i <= gt) {
      comparisons++;
      const cmp = compare(a[i], pivot);
      if (cmp < 0) {
        _swap(a, lt, i);
        lt++;
        i++;
      } else if (cmp > 0) {
        _swap(a, i, gt);
        gt--;
      } else {
        i++;
      }
    }

    _quickSort(a, lo, lt - 1);
    _quickSort(a, gt + 1, hi);
  }
}
