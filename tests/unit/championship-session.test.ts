import { describe, expect, it } from 'vitest';
import { ChampionshipSession, championshipCalendar } from '../../src/adapters/championship-session';
import type { RaceResult } from '../../src/core/types';

const results: RaceResult[] = [25, 18, 15, 12].map((pointsAwarded, index) => ({
  raceId: 'engine-race', racerId: String(index + 1), finishPosition: index + 1,
  finishTime: 90 + index, fastestLap: 40 + index, bonusPoints: 0, pointsAwarded,
}));

describe('Championship season lifecycle', () => {
  it('starts empty, enforces the calendar, and declares completion after all three rounds', () => {
    const season = new ChampionshipSession();
    expect(season.manager.getRaces()).toEqual([]);
    expect(season.complete).toBe(false);
    expect(() => season.prepare('circuit-city-grid')).toThrow(/next championship circuit/);
    for (const [round, circuit] of championshipCalendar.entries()) {
      expect(season.nextCircuitId).toBe(circuit.id);
      const record = season.prepare(circuit.id);
      record(results);
      record(results);
      expect(season.manager.getRaces()).toHaveLength(round + 1);
      expect(season.manager.getStandings()[0].totalPoints).toBe(25 * (round + 1));
      expect(season.complete).toBe(round === 2);
    }
    expect(season.nextCircuitId).toBeUndefined();
    expect(() => season.prepare('circuit-grand-prix')).toThrow(/complete/);
    expect(new Set(season.manager.getRaces().map((race) => race.id)).size).toBe(3);
    expect(season.manager.getRaces()[0].results.every((row) => row.raceId === season.manager.getRaces()[0].id)).toBe(true);
    expect(season.manager.getTopK(3)).toEqual(season.manager.getStandings().slice(0, 3));
  });

  it('reset clears scoring and invalidates unfinished grids; a newer grid supersedes an older one', () => {
    const season = new ChampionshipSession();
    const abandoned = season.prepare('circuit-grand-prix');
    const current = season.prepare('circuit-grand-prix');
    abandoned(results);
    expect(season.manager.getRaces()).toHaveLength(0);
    current(results);
    const next = season.prepare('circuit-desert-canyon');
    season.reset();
    next(results);
    expect(season.manager.getRaces()).toHaveLength(0);
    expect(season.nextCircuitId).toBe('circuit-grand-prix');
    expect(season.manager.getEntries().every((row) => row.totalPoints === 0 && row.wins === 0 && row.sumOfFinishPositions === 0 && row.bestFastestLap === null)).toBe(true);
    season.prepare('circuit-grand-prix')(results);
    expect(season.manager.getStandings()[0].totalPoints).toBe(25);
  });

  it('does not record incomplete result sets or count a DNF as a win', () => {
    const season = new ChampionshipSession();
    const record = season.prepare('circuit-grand-prix');
    expect(() => record(results.slice(0, 1))).toThrow(/each registered racer/);
    expect(season.manager.getRaces()).toHaveLength(0);
    record(results.map((row) => ({ ...row, finishTime: null, fastestLap: null, pointsAwarded: 0 })));
    expect(season.manager.getStandings().every((row) => row.wins === 0 && row.totalPoints === 0)).toBe(true);
  });
});
