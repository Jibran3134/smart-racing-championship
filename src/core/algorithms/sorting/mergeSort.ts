/**
 * Merge Sort for ChampionshipEntry — Alishba (Milestone 5).
 *
 * Stable O(n log n) sort with O(n) auxiliary space.
 * Returns a sorted COPY; input array is not modified.
 * Tracks `comparisons` counter for the Algorithm Lab.
 *
 * Rules (AGENTS.md): No UI; hand-implemented; deterministic.
 */

import type { ChampionshipEntry } from '../../types';
import { compare } from '../../championship/comparator';

export interface MergeSortResult {
  sorted: ChampionshipEntry[];
  comparisons: number;
}

/**
 * Sort championship entries using stable merge sort.
 * @param entries - Input array (not mutated).
 */
export function mergeSort(entries: readonly ChampionshipEntry[]): MergeSortResult {
  let comparisons = 0;
  const arr = entries.slice(); // working copy

  _mergeSort(arr, 0, arr.length - 1);

  return { sorted: arr, comparisons };

  // -------------------------------------------------------------------------

  function _mergeSort(a: ChampionshipEntry[], lo: number, hi: number): void {
    if (lo >= hi) return;
    const mid = (lo + hi) >>> 1;
    _mergeSort(a, lo, mid);
    _mergeSort(a, mid + 1, hi);
    _merge(a, lo, mid, hi);
  }

  function _merge(a: ChampionshipEntry[], lo: number, mid: number, hi: number): void {
    // Copy both halves into auxiliary arrays
    const left  = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);
    let i = 0, j = 0, k = lo;

    while (i < left.length && j < right.length) {
      comparisons++;
      // ≤ 0 means left[i] ranks before or equal (stable: left wins ties)
      if (compare(left[i], right[j]) <= 0) {
        a[k++] = left[i++];
      } else {
        a[k++] = right[j++];
      }
    }
    while (i < left.length)  a[k++] = left[i++];
    while (j < right.length) a[k++] = right[j++];
  }
}
