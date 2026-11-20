/**
 * Championship comparator — Alishba (Milestone 5).
 *
 * Implements the tie-breaking hierarchy from Project.pdf §4.6:
 *  1. totalPoints DESC
 *  2. wins DESC
 *  3. sumOfFinishPositions ASC
 *  4. bestFastestLap ASC (null sorts LAST via NO_FASTEST_LAP sentinel)
 *  5. racerId ASC (lexicographic — deterministic final tie-breaker)
 *
 * Returns negative when a should rank BEFORE b (i.e. a is "better").
 */

import type { ChampionshipEntry } from '../types';
import { NO_FASTEST_LAP } from '../config';

/**
 * Compare two championship entries.
 * Negative → a ranks higher; Positive → b ranks higher; 0 → equal.
 */
export function compare(a: ChampionshipEntry, b: ChampionshipEntry): number {
  // 1. totalPoints DESC
  if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;

  // 2. wins DESC
  if (b.wins !== a.wins) return b.wins - a.wins;

  // 3. sumOfFinishPositions ASC (fewer is better)
  if (a.sumOfFinishPositions !== b.sumOfFinishPositions)
    return a.sumOfFinishPositions - b.sumOfFinishPositions;

  // 4. bestFastestLap ASC (null → Infinity, sorts last)
  const lapA = a.bestFastestLap ?? NO_FASTEST_LAP;
  const lapB = b.bestFastestLap ?? NO_FASTEST_LAP;
  if (lapA !== lapB) return lapA - lapB;

  // 5. racerId ASC (lexicographic)
  if (a.racerId < b.racerId) return -1;
  if (a.racerId > b.racerId) return  1;
  return 0;
}
