/**
 * Experiment 5 Datasets — Championship Sorting & Ranking.
 */

import type { ChampionshipEntry } from '../../src/core/types';
import { random } from '../shared/random';

export const rankingFamilies = ['random', 'nearly-sorted', 'reverse-sorted', 'duplicate-heavy'] as const;
export type RankingFamily = typeof rankingFamilies[number];

export interface RankingDataset {
  entries: ChampionshipEntry[];
  size: number;
  family: RankingFamily;
  seed: number;
}

export function rankingDataset(size: number, family: RankingFamily, seed: number): RankingDataset {
  const next = random(seed);
  const entries: ChampionshipEntry[] = [];

  for (let i = 0; i < size; i++) {
    const id = `racer-${String(i + 1).padStart(4, '0')}`;
    let totalPoints: number;
    let wins: number;
    let sumOfFinishPositions: number;
    let bestFastestLap: number | null;

    if (family === 'duplicate-heavy') {
      totalPoints = Math.floor(next() * 3) * 25; // clustered points
      wins = Math.floor(next() * 2);
      sumOfFinishPositions = 10 + Math.floor(next() * 3);
      bestFastestLap = next() < 0.3 ? null : 60 + Math.floor(next() * 3);
    } else if (family === 'nearly-sorted') {
      totalPoints = (size - i) * 10 + Math.floor(next() * 5);
      wins = Math.max(0, Math.floor((size - i) / 10));
      sumOfFinishPositions = i * 2 + 1;
      bestFastestLap = 50 + i * 0.5;
    } else if (family === 'reverse-sorted') {
      totalPoints = i * 10;
      wins = Math.floor(i / 10);
      sumOfFinishPositions = (size - i) * 2 + 1;
      bestFastestLap = 100 - i * 0.5;
    } else {
      // random
      totalPoints = Math.floor(next() * 100);
      wins = Math.floor(next() * 5);
      sumOfFinishPositions = Math.floor(next() * 100);
      bestFastestLap = next() < 0.1 ? null : 50 + next() * 50;
    }

    entries.push({
      racerId: id,
      totalPoints,
      wins,
      sumOfFinishPositions,
      bestFastestLap,
    });
  }

  return {
    entries,
    size,
    family,
    seed,
  };
}
