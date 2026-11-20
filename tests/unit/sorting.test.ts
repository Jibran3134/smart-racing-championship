import { describe, expect, it } from 'vitest';
import { compare } from '../../src/core/championship/comparator';
import { mergeSort } from '../../src/core/algorithms/sorting/mergeSort';
import { quickSort } from '../../src/core/algorithms/sorting/quickSort';
import { heapSort } from '../../src/core/algorithms/sorting/heapSort';
import { topK } from '../../src/core/algorithms/sorting/topK';
import { ChampionshipManager } from '../../src/core/championship/ChampionshipManager';
import type { ChampionshipEntry, RaceResult } from '../../src/core/types';

describe('Sorting & Championship Ranking (Alishba)', () => {
  const racers: ChampionshipEntry[] = [
    { racerId: 'racer-1', totalPoints: 50, wins: 2, sumOfFinishPositions: 4, bestFastestLap: 61.2 },
    { racerId: 'racer-2', totalPoints: 50, wins: 2, sumOfFinishPositions: 4, bestFastestLap: 60.5 }, // better lap
    { racerId: 'racer-3', totalPoints: 50, wins: 1, sumOfFinishPositions: 5, bestFastestLap: 59.8 }, // fewer wins
    { racerId: 'racer-4', totalPoints: 75, wins: 3, sumOfFinishPositions: 3, bestFastestLap: 62.0 }, // leader
    { racerId: 'racer-5', totalPoints: 20, wins: 0, sumOfFinishPositions: 15, bestFastestLap: null }, // no lap
  ];

  it('evaluates comparator tie-breaking hierarchy correctly', () => {
    // 1. Points: racer-4 (75) vs racer-1 (50) -> racer-4 ranks higher (< 0)
    expect(compare(racers[3], racers[0])).toBeLessThan(0);

    // 2. Wins: racer-1 (2 wins) vs racer-3 (1 win) -> racer-1 ranks higher
    expect(compare(racers[0], racers[2])).toBeLessThan(0);

    // 3. Best fastest lap: racer-2 (60.5) vs racer-1 (61.2) -> racer-2 ranks higher
    expect(compare(racers[1], racers[0])).toBeLessThan(0);

    // 4. Null lap sorts last: racer-1 vs racer-5 (null) -> racer-1 ranks higher
    expect(compare(racers[0], racers[4])).toBeLessThan(0);

    // 5. Lexicographic tie-breaker on identical stats
    const twinA: ChampionshipEntry = { racerId: 'alpha', totalPoints: 10, wins: 0, sumOfFinishPositions: 5, bestFastestLap: 60 };
    const twinB: ChampionshipEntry = { racerId: 'beta',  totalPoints: 10, wins: 0, sumOfFinishPositions: 5, bestFastestLap: 60 };
    expect(compare(twinA, twinB)).toBeLessThan(0);
  });

  it('mergeSort produces sorted array and preserves stability', () => {
    const res = mergeSort(racers);
    expect(res.sorted.length).toBe(5);
    expect(res.sorted[0].racerId).toBe('racer-4'); // 75 pts
    expect(res.sorted[1].racerId).toBe('racer-2'); // 50 pts, 2 wins, 60.5 lap
    expect(res.sorted[2].racerId).toBe('racer-1'); // 50 pts, 2 wins, 61.2 lap
    expect(res.sorted[3].racerId).toBe('racer-3'); // 50 pts, 1 win
    expect(res.sorted[4].racerId).toBe('racer-5'); // 20 pts
    expect(res.comparisons).toBeGreaterThan(0);
  });

  it('quickSort matches mergeSort output', () => {
    const mergeRes = mergeSort(racers);
    const quickRes = quickSort(racers);
    expect(quickRes.sorted.map((r) => r.racerId)).toEqual(mergeRes.sorted.map((r) => r.racerId));
    expect(quickRes.swaps).toBeGreaterThanOrEqual(0);
  });

  it('heapSort matches mergeSort output', () => {
    const mergeRes = mergeSort(racers);
    const heapRes = heapSort(racers);
    expect(heapRes.sorted.map((r) => r.racerId)).toEqual(mergeRes.sorted.map((r) => r.racerId));
  });

  it('topK extracts top-k elements matching mergeSort prefix in O(n log k)', () => {
    const mergeRes = mergeSort(racers);
    const top3 = topK(racers, 3);
    expect(top3.topK.length).toBe(3);
    expect(top3.topK.map((r) => r.racerId)).toEqual(mergeRes.sorted.slice(0, 3).map((r) => r.racerId));

    // Edge cases
    expect(topK([], 3).topK).toEqual([]);
    expect(topK(racers, 0).topK).toEqual([]);
  });

  it('ChampionshipManager records results, updates standings, and tracks history', () => {
    const manager = new ChampionshipManager();
    manager.registerRacer({ racerId: '1', name: 'Player' });
    manager.registerRacer({ racerId: '2', name: 'Rival' });

    const race1Results: RaceResult[] = [
      { raceId: 'r1', racerId: '1', finishPosition: 1, finishTime: 120, fastestLap: 58.5, bonusPoints: 0, pointsAwarded: 25 },
      { raceId: 'r1', racerId: '2', finishPosition: 2, finishTime: 122, fastestLap: 59.1, bonusPoints: 0, pointsAwarded: 18 },
    ];

    manager.addRaceResults('r1', 'Grand Prix', race1Results);

    const standings = manager.getStandings('merge');
    expect(standings[0].racerId).toBe('1');
    expect(standings[0].totalPoints).toBe(25);
    expect(standings[0].wins).toBe(1);

    const top1 = manager.getTopK(1);
    expect(top1.length).toBe(1);
    expect(top1[0].racerId).toBe('1');

    const history = manager.getPointsHistory();
    expect(history.length).toBe(1);
    expect(history[0]['Player']).toBe(25);
    expect(history[0]['Rival']).toBe(18);
  });

  it('verifies sorting and top-k on empty, singleton, sorted, reverse, and duplicate-heavy arrays', () => {
    // 1. Empty array
    expect(mergeSort([]).sorted).toEqual([]);
    expect(quickSort([]).sorted).toEqual([]);
    expect(heapSort([]).sorted).toEqual([]);
    expect(topK([], 5).topK).toEqual([]);

    // 2. Singleton array
    const single: ChampionshipEntry = { racerId: 'solo', totalPoints: 10, wins: 1, sumOfFinishPositions: 1, bestFastestLap: 60 };
    expect(mergeSort([single]).sorted).toEqual([single]);
    expect(quickSort([single]).sorted).toEqual([single]);
    expect(heapSort([single]).sorted).toEqual([single]);
    expect(topK([single], 1).topK).toEqual([single]);

    // 3. Pre-sorted array (descending points)
    const sortedRacers: ChampionshipEntry[] = [
      { racerId: 'a', totalPoints: 100, wins: 4, sumOfFinishPositions: 4, bestFastestLap: 58 },
      { racerId: 'b', totalPoints: 75, wins: 3, sumOfFinishPositions: 7, bestFastestLap: 59 },
      { racerId: 'c', totalPoints: 50, wins: 2, sumOfFinishPositions: 10, bestFastestLap: 60 },
      { racerId: 'd', totalPoints: 25, wins: 1, sumOfFinishPositions: 13, bestFastestLap: 61 },
    ];
    const msSorted = mergeSort(sortedRacers).sorted.map((r) => r.racerId);
    const qsSorted = quickSort(sortedRacers).sorted.map((r) => r.racerId);
    const hsSorted = heapSort(sortedRacers).sorted.map((r) => r.racerId);
    expect(msSorted).toEqual(['a', 'b', 'c', 'd']);
    expect(qsSorted).toEqual(msSorted);
    expect(hsSorted).toEqual(msSorted);

    // 4. Reverse-sorted array (ascending points)
    const reverseRacers = [...sortedRacers].reverse();
    const msRev = mergeSort(reverseRacers).sorted.map((r) => r.racerId);
    const qsRev = quickSort(reverseRacers).sorted.map((r) => r.racerId);
    const hsRev = heapSort(reverseRacers).sorted.map((r) => r.racerId);
    expect(msRev).toEqual(['a', 'b', 'c', 'd']);
    expect(qsRev).toEqual(msRev);
    expect(hsRev).toEqual(msRev);

    // 5. Duplicate-heavy array (many ties on points, wins, positions)
    const duplicateRacers: ChampionshipEntry[] = [
      { racerId: 'z-racer', totalPoints: 50, wins: 1, sumOfFinishPositions: 5, bestFastestLap: 60 },
      { racerId: 'a-racer', totalPoints: 50, wins: 1, sumOfFinishPositions: 5, bestFastestLap: 60 },
      { racerId: 'm-racer', totalPoints: 50, wins: 1, sumOfFinishPositions: 5, bestFastestLap: 60 },
      { racerId: 'b-racer', totalPoints: 50, wins: 1, sumOfFinishPositions: 5, bestFastestLap: 60 },
    ];
    const msDup = mergeSort(duplicateRacers).sorted.map((r) => r.racerId);
    const qsDup = quickSort(duplicateRacers).sorted.map((r) => r.racerId);
    const hsDup = heapSort(duplicateRacers).sorted.map((r) => r.racerId);
    // Deterministic tie-breaking by racerId ASC: a-racer, b-racer, m-racer, z-racer
    expect(msDup).toEqual(['a-racer', 'b-racer', 'm-racer', 'z-racer']);
    expect(qsDup).toEqual(msDup);
    expect(hsDup).toEqual(msDup);

    // Top-2 on duplicates matches first 2 of full sort
    const top2Dup = topK(duplicateRacers, 2).topK.map((r) => r.racerId);
    expect(top2Dup).toEqual(['a-racer', 'b-racer']);
  });
});
