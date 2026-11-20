/**
 * ChampionshipManager — Alishba (Milestone 5).
 *
 * Manages championship state across multiple races:
 *  - Accumulates RaceResult records per race.
 *  - Updates ChampionshipEntry (points, wins, position sums, fastest lap).
 *  - Computes standings using mergeSort, quickSort, heapSort, or topK.
 *  - Maintains race-by-race point history.
 *  - Provides listener subscriptions for reactive UI updates.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import type { RaceResult, ChampionshipEntry } from '../types';
import { mergeSort } from '../algorithms/sorting/mergeSort';
import { quickSort } from '../algorithms/sorting/quickSort';
import { heapSort } from '../algorithms/sorting/heapSort';
import { topK } from '../algorithms/sorting/topK';

export type RankingMethod = 'merge' | 'quick' | 'heap';

export interface RacerMeta {
  racerId: string;
  name: string;
  color?: string;
  isHuman?: boolean;
}

export interface StoredRace {
  id: string;
  name: string;
  results: readonly RaceResult[];
}

export class ChampionshipManager {
  private readonly _entries = new Map<string, ChampionshipEntry>();
  private readonly _metadata = new Map<string, RacerMeta>();
  private readonly _races: StoredRace[] = [];
  private readonly _listeners = new Set<() => void>();

  constructor(racers: readonly RacerMeta[] = []) {
    for (const r of racers) {
      this.registerRacer(r);
    }
  }

  /** Register a racer before the championship starts or when entering. */
  registerRacer(meta: RacerMeta): void {
    this._metadata.set(meta.racerId, meta);
    if (!this._entries.has(meta.racerId)) {
      this._entries.set(meta.racerId, {
        racerId: meta.racerId,
        totalPoints: 0,
        wins: 0,
        sumOfFinishPositions: 0,
        bestFastestLap: null,
      });
    }
  }

  /** Get metadata for a registered racer. */
  getRacerMeta(racerId: string): RacerMeta | undefined {
    return this._metadata.get(racerId);
  }

  /** All registered championship entries (unsorted snapshot). */
  getEntries(): ChampionshipEntry[] {
    return Array.from(this._entries.values()).map((e) => ({ ...e }));
  }

  /** Recorded races so far. */
  getRaces(): readonly StoredRace[] {
    return this._races;
  }

  /**
   * Add results for a completed race.
   * Updates cumulative points, wins, position sum, and best fastest lap.
   */
  addRaceResults(raceId: string, raceName: string, results: readonly RaceResult[]): void {
    for (const res of results) {
      let entry = this._entries.get(res.racerId);
      if (!entry) {
        entry = {
          racerId: res.racerId,
          totalPoints: 0,
          wins: 0,
          sumOfFinishPositions: 0,
          bestFastestLap: null,
        };
        this._entries.set(res.racerId, entry);
      }

      entry.totalPoints += res.pointsAwarded;
      if (res.finishPosition === 1) {
        entry.wins += 1;
      }
      entry.sumOfFinishPositions += res.finishPosition;

      if (res.fastestLap !== null && Number.isFinite(res.fastestLap)) {
        if (entry.bestFastestLap === null || res.fastestLap < entry.bestFastestLap) {
          entry.bestFastestLap = res.fastestLap;
        }
      }
    }

    this._races.push({
      id: raceId,
      name: raceName,
      results: [...results],
    });

    this._notify();
  }

  /**
   * Get sorted championship standings using the requested sorting method.
   *
   * @param method - 'merge' | 'quick' | 'heap' (defaults to 'merge')
   */
  getStandings(method: RankingMethod = 'merge'): ChampionshipEntry[] {
    const list = this.getEntries();
    switch (method) {
      case 'merge':
        return mergeSort(list).sorted;
      case 'quick':
        return quickSort(list).sorted;
      case 'heap':
        return heapSort(list).sorted;
    }
  }

  /**
   * Get top-k championship entries.
   * Guaranteed to match the first k elements of getStandings().
   */
  getTopK(k: number): ChampionshipEntry[] {
    const list = this.getEntries();
    return topK(list, k).topK;
  }

  /**
   * Cumulative points progression table across races.
   * e.g. [{ race: 'Race 1', 'racer1': 25, 'racer2': 18 }, ...]
   */
  getPointsHistory(): Array<{ race: string; [racerId: string]: number | string }> {
    const runningPoints = new Map<string, number>();
    for (const id of this._entries.keys()) {
      runningPoints.set(id, 0);
    }

    const history: Array<{ race: string; [racerId: string]: number | string }> = [];

    for (const race of this._races) {
      for (const res of race.results) {
        const cur = runningPoints.get(res.racerId) ?? 0;
        runningPoints.set(res.racerId, cur + res.pointsAwarded);
      }

      const pointRow: { race: string; [racerId: string]: number | string } = {
        race: race.name,
      };

      for (const [id, total] of runningPoints.entries()) {
        const meta = this._metadata.get(id);
        const key = meta ? meta.name : id;
        pointRow[key] = total;
      }

      history.push(pointRow);
    }

    return history;
  }

  /** Reset the championship back to clean slate. */
  reset(): void {
    for (const entry of this._entries.values()) {
      entry.totalPoints = 0;
      entry.wins = 0;
      entry.sumOfFinishPositions = 0;
      entry.bestFastestLap = null;
    }
    this._races.length = 0;
    this._notify();
  }

  /** Subscribe a listener to changes; returns unsubscribe callback. */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch {
        // Suppress listener errors in core
      }
    }
  }
}
