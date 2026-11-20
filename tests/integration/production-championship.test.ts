import { beforeEach, describe, expect, it, vi } from 'vitest';
import { productionChampionshipProvider as championship, productionRaceSetupProvider as setup } from '../../src/adapters';
import { RaceEngine } from '../../src/core/engine/RaceEngine';
import type { RaceSetupRequest } from '../../src/ui/adapters/race-setup';
import type { RaceResult } from '../../src/core/types';

const request = (mode: RaceSetupRequest['mode'], circuitId = 'circuit-grand-prix'): RaceSetupRequest => ({
  mode, circuitId, laps: 2, initialNitro: 3, eventsEnabled: false,
});
const results: RaceResult[] = [25, 18, 15, 12].map((pointsAwarded, index) => ({
  raceId: 'engine-race', racerId: String(index + 1), finishPosition: index + 1,
  finishTime: 100 + index, fastestLap: 45 + index, bonusPoints: 0, pointsAwarded,
}));

describe('Production season and race driver integration', () => {
  beforeEach(() => { vi.restoreAllMocks(); championship.reset?.(); });

  // Isolate lifecycle/scoring from engine physics, which has its own integration tests.
  function completePreparedGrids() {
    const getState = RaceEngine.prototype.getState;
    vi.spyOn(RaceEngine.prototype, 'step').mockImplementation(() => {});
    vi.spyOn(RaceEngine.prototype, 'restart').mockImplementation(() => {});
    vi.spyOn(RaceEngine.prototype, 'getState').mockImplementation(function (this: RaceEngine) {
      return { ...getState.call(this), phase: 'finished' as const };
    });
    vi.spyOn(RaceEngine.prototype, 'getResults').mockReturnValue(results);
  }

  it('keeps quick races separate and advances exactly once per championship round', () => {
    completePreparedGrids();
    const notify = vi.fn();
    const unsubscribe = championship.subscribe!(notify);
    const quick = setup.createRace(request('quick'));
    quick.step(1);
    expect(championship.races).toHaveLength(0);
    expect(notify).not.toHaveBeenCalled();
    for (const circuitId of ['circuit-grand-prix', 'circuit-desert-canyon', 'circuit-city-grid']) {
      expect(setup.championshipCircuitId).toBe(circuitId);
      const driver = setup.createRace(request('championship', circuitId));
      driver.step(1);
      driver.step(1);
      driver.restart();
      driver.step(1);
    }
    expect(championship.complete).toBe(true);
    expect(setup.championshipComplete).toBe(true);
    expect(setup.championshipCircuitId).toBeUndefined();
    expect(championship.races.map((race) => race.name)).toEqual(['Grand Prix Raceway', 'Desert Canyon', 'City Grid']);
    expect(notify).toHaveBeenCalledTimes(3);
    expect(championship.getRanking('merge')[0]).toMatchObject({ racerId: 1, points: 75, wins: 3 });
    expect(championship.getRanking('quick')).toEqual(championship.getRanking('heap'));
    expect(championship.pointsHistory).toEqual([
      { race: 'Grand Prix Raceway', racer1: 25, racer2: 18, racer3: 15, racer4: 12 },
      { race: 'Desert Canyon', racer1: 50, racer2: 36, racer3: 30, racer4: 24 },
      { race: 'City Grid', racer1: 75, racer2: 54, racer3: 45, racer4: 36 },
    ]);
    expect(() => setup.createRace(request('championship'))).toThrow(/complete/);
    setup.createRace(request('quick')).step(1);
    expect(championship.races).toHaveLength(3);
    championship.reset?.();
    expect(championship.complete).toBe(false);
    expect(setup.championshipCircuitId).toBe('circuit-grand-prix');
    expect(championship.races).toHaveLength(0);
    unsubscribe();
  });

  it('rejects out-of-order grids and prevents an old season from scoring after reset', () => {
    expect(() => setup.createRace(request('championship', 'circuit-city-grid'))).toThrow(/next circuit/);
    const stale = setup.createRace(request('championship'));
    championship.reset?.();
    completePreparedGrids();
    stale.step(1);
    expect(championship.races).toHaveLength(0);
    setup.createRace(request('championship')).step(1);
    expect(championship.races).toHaveLength(1);
  });
});
