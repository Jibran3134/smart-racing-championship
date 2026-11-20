import { ChampionshipManager } from '../core/championship/ChampionshipManager';
import type { RaceResult } from '../core/types';

export const championshipCalendar = [
  { id: 'circuit-grand-prix', name: 'Grand Prix Raceway' },
  { id: 'circuit-desert-canyon', name: 'Desert Canyon' },
  { id: 'circuit-city-grid', name: 'City Grid' },
] as const;

export const racerNames: Record<string, string> = {
  '1': 'You', '2': 'Main Apex', '3': 'Shortcut Phantom', '4': 'Metric Shadow',
};

/** Owns a season lifecycle while core owns scoring and the ranking algorithms. */
export class ChampionshipSession {
  readonly manager = new ChampionshipManager(
    Object.entries(racerNames).map(([racerId, name]) => ({ racerId, name, isHuman: racerId === '1' })),
  );
  private generation = 0;
  private attempt = 0;

  get complete(): boolean { return this.manager.getRaces().length === championshipCalendar.length; }
  get nextCircuitId(): string | undefined { return championshipCalendar[this.manager.getRaces().length]?.id; }

  reset(): void {
    this.generation++;
    this.attempt++;
    this.manager.reset();
  }

  /** A prepared grid can score once, only in its original season and round. */
  prepare(circuitId: string): (results: readonly RaceResult[]) => void {
    const round = this.manager.getRaces().length;
    const circuit = championshipCalendar[round];
    if (!circuit) throw new Error('The championship is complete. Start a new championship to race again.');
    if (circuitId !== circuit.id) throw new Error(`The next championship circuit is ${circuit.name}.`);
    const generation = this.generation;
    const attempt = ++this.attempt;
    let recorded = false;
    return (results) => {
      if (recorded || generation !== this.generation || attempt !== this.attempt || round !== this.manager.getRaces().length) return;
      const ids = results.map((result) => result.racerId);
      if (ids.length !== Object.keys(racerNames).length || new Set(ids).size !== ids.length || ids.some((id) => !(id in racerNames))) {
        throw new Error('Championship results must include each registered racer exactly once.');
      }
      const raceId = `season-${generation + 1}-round-${round + 1}`;
      recorded = true;
      this.manager.addRaceResults(raceId, circuit.name, results.map((result) => ({ ...result, raceId })));
    };
  }
}
