import type { ChampionshipProvider, ResultView } from '../adapters/championship-view';

/** Fixed, already ordered presentation data. No scoring/sorting algorithms here. */
const ranking = [
  { racerId: 2, name: 'Rival 01', color: '#72cce4', points: 61, wins: 1, sumOfPositions: 5, fastestLap: 44.2 },
  { racerId: 1, name: 'You', color: '#c5f568', points: 58, wins: 1, sumOfPositions: 6, fastestLap: 45 },
  { racerId: 3, name: 'Rival 02', color: '#c8a3ef', points: 52, wins: 1, sumOfPositions: 8, fastestLap: 43.8 },
  { racerId: 4, name: 'Rival 03', color: '#f0b77b', points: 39, wins: 0, sumOfPositions: 11, fastestLap: 47.6 },
];
const first: ResultView[] = [
  { racerId: 1, name: 'You', position: 1, status: 'finished', finishTime: 101.2, fastestLap: 46, points: 25 },
  { racerId: 2, name: 'Rival 01', position: 2, status: 'finished', finishTime: 103.1, fastestLap: 45.2, points: 18 },
  { racerId: 3, name: 'Rival 02', position: 3, status: 'finished', finishTime: 104.8, fastestLap: 46.5, points: 15 },
  { racerId: 4, name: 'Rival 03', position: 4, status: 'finished', finishTime: 108.3, fastestLap: 48.1, points: 12 },
];
const second: ResultView[] = [
  { racerId: 3, name: 'Rival 02', position: 1, status: 'finished', finishTime: 98.1, fastestLap: 43.8, points: 25 },
  { racerId: 2, name: 'Rival 01', position: 2, status: 'finished', finishTime: 99.3, fastestLap: 44.2, points: 18 },
  { racerId: 1, name: 'You', position: 3, status: 'finished', finishTime: 100.6, fastestLap: 45, points: 15 },
  { racerId: 4, name: 'Rival 03', position: 4, status: 'finished', finishTime: 105.9, fastestLap: 47.6, points: 12 },
];
const third: ResultView[] = [
  { racerId: 2, name: 'Rival 01', position: 1, status: 'finished', finishTime: 107, fastestLap: 46.2, points: 25 },
  { racerId: 1, name: 'You', position: 2, status: 'finished', finishTime: 108.4, fastestLap: 46.8, points: 18 },
  { racerId: 4, name: 'Rival 03', position: 3, status: 'finished', finishTime: 110.8, fastestLap: 49.1, points: 15 },
  { racerId: 3, name: 'Rival 02', position: 4, status: 'finished', finishTime: 112.3, fastestLap: 50, points: 12 },
];

export const exampleChampionship: ChampionshipProvider = {
  kind: 'example', complete: true,
  races: [
    { id: 'example-1', name: 'Example race 01', results: first },
    { id: 'example-2', name: 'Example race 02', results: second },
    { id: 'example-3', name: 'Example race 03', results: third },
  ],
  getRanking: () => ranking.map((entry) => ({ ...entry })),
  // A display fixture, not a replacement for Alishba's heap top-k algorithm.
  getTopK: (k) => ranking.slice(0, k).map((entry) => ({ ...entry })),
  pointsHistory: [
    { race: 'Race 01', racer1: 25, racer2: 18, racer3: 15, racer4: 12 },
    { race: 'Race 02', racer1: 40, racer2: 36, racer3: 40, racer4: 24 },
    { race: 'Race 03', racer1: 58, racer2: 61, racer3: 52, racer4: 39 },
  ],
};
