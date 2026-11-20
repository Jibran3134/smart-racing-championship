export type RankingMethod = 'merge' | 'quick' | 'heap';
export interface StandingView {
  racerId: number;
  name: string;
  color: string;
  points: number;
  wins: number;
  sumOfPositions: number;
  fastestLap: number | null;
}
export interface ResultView {
  racerId: number;
  name: string;
  position: number;
  status: 'finished' | 'dnf';
  finishTime: number | null;
  fastestLap: number | null;
  points: number;
}
export interface ChampionshipProvider {
  kind: 'live' | 'example';
  /** Optional presentation identity for highlighting the human racer. */
  humanRacerId?: number;
  complete: boolean;
  /** Starts a fresh season and invalidates unfinished grids from the old season. */
  reset?(): void;
  races: readonly { id: string; name: string; results: readonly ResultView[] }[];
  /** Ordered core outputs. The UI never computes a championship comparator. */
  getRanking(method: RankingMethod): readonly StandingView[];
  getTopK(k: number): readonly StandingView[];
  pointsHistory: readonly { race: string; [series: string]: number | string }[];
  /** Notify after core standings/history change; return an unsubscribe function. */
  subscribe?(listener: () => void): () => void;
}
