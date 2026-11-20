/**
 * Shared interface contract — jointly owned by Jibran and Alishba.
 * Source of truth: Project.pdf Sections 3 and 4; DAA Project division.docx.
 * Frozen: 19 November 2026.
 *
 * Rules:
 *  - No UI imports here. This file is imported by src/core, experiments/, and src/ui adapters.
 *  - All numeric fields must be finite; callers validate before calling core functions.
 *  - Graph mutations must NOT rebuild the graph — use dynamic update methods only.
 */

// ---------------------------------------------------------------------------
// Vertex
// ---------------------------------------------------------------------------

/** All legal vertex kinds as per Project.pdf Section 3.1. */
export type VertexType =
  | 'Start'
  | 'Finish'
  | 'Checkpoint'
  | 'Intersection'
  | 'FuelStation'
  | 'NitroPickup'
  | 'DeadEnd';

/**
 * A node in the racing track graph.
 * - `id`: unique non-negative integer.
 * - `x`, `y`: 2-D layout coordinates (pixels) used for rendering and heuristics.
 * - `type`: vertex role, determines what interactions are allowed.
 * - `checkpointOrder`: 1-based mandatory visit order; present only when type === 'Checkpoint'.
 * - `active`: whether the service vertex is currently usable (fuel station / nitro pickup).
 */
export interface Vertex {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly type: VertexType;
  readonly checkpointOrder?: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Edge
// ---------------------------------------------------------------------------

/** Runtime traversal status of an edge. Blocked edges are excluded from routing. */
export type EdgeStatus = 'Open' | 'Blocked' | 'Restricted';

/**
 * A directed or undirected road segment in the track graph.
 * - `id`: unique stable string identifier.
 * - `from`, `to`: vertex IDs (order determines direction for directed edges).
 * - `distance`: physical length in metres (positive).
 * - `baseTime`: nominal traversal time in seconds at standard difficulty (positive).
 * - `fuelCost`: base fuel units consumed at difficulty 1 (non-negative).
 * - `difficulty`: integer 1–5; affects fuel consumption multiplier and routing cost.
 * - `status`: current traversal status; Blocked edges are excluded from search.
 * - `isShortcut`: whether this edge is a designated shortcut (can be toggled by events).
 * - `directed`: one-way if true; traversable in both directions if false.
 * - `speedCap`: optional maximum speed (units/s); present on Restricted edges.
 */
export interface Edge {
  readonly id: string;
  readonly from: number;
  readonly to: number;
  readonly distance: number;
  readonly baseTime: number;
  readonly fuelCost: number;
  readonly difficulty: number; // integer, 1–5
  status: EdgeStatus;
  readonly isShortcut: boolean;
  readonly directed: boolean;
  speedCap?: number;
}

// ---------------------------------------------------------------------------
// Route cost presets
// ---------------------------------------------------------------------------

/** The four cost profiles the route optimizer supports. */
export type CostPreset = 'Balanced' | 'Speed' | 'Economy' | 'Safety';

/**
 * Non-negative scalar weights for the five normalized cost components.
 * cost(e) = wD·D_norm + wT·T_norm + wF·F_norm + wR·R + wO·O
 * All weights ≥ 0; at least one must be positive.
 */
export interface CostWeights {
  readonly distance: number;
  readonly time: number;
  readonly fuel: number;
  readonly difficulty: number;
  readonly obstacle: number;
}

// ---------------------------------------------------------------------------
// Route result
// ---------------------------------------------------------------------------

/**
 * Output of the route planner for a single source-to-target leg.
 * The optimized cost must equal the displayed cost (Project.pdf §3.3).
 * - `path`: ordered vertex IDs from source to target.
 * - `edgeIds`: ordered edge IDs, length === path.length - 1.
 * - `distance`: total edge distance in metres.
 * - `time`: estimated traversal time in seconds (base, before events).
 * - `scalarCost`: the value minimized by Dijkstra / A*.
 * - `fuelNeeded`: total fuel required at standard difficulty.
 */
export interface RouteResult {
  readonly path: number[];
  readonly edgeIds: string[];
  readonly distance: number;
  readonly time: number;
  readonly scalarCost: number;
  readonly fuelNeeded: number;
}

// ---------------------------------------------------------------------------
// Algorithm operation counters (shared trace schema)
// ---------------------------------------------------------------------------

/**
 * Cumulative operation counters emitted with each trace step.
 * Matches the counter keys used by ExplorationCounters in contracts.ts
 * and extended for weighted-graph algorithms.
 */
export interface OperationCounters {
  expandedVertices: number;
  relaxedEdges: number;
  heapOps: number;
  comparisons: number;
  /** Additional algorithm-specific counters (e.g. visitedVertices, swaps). */
  [key: string]: number;
}

/** Step type tokens shared across all core trace interfaces. */
export type TraceStepType = 'visit' | 'relax' | 'push' | 'pop' | 'compare' | 'swap' | 'choose' | 'reject' | 'done';

/** Minimal common trace step envelope; algorithms extend this. */
export interface TraceStep {
  readonly type: TraceStepType;
  readonly counters: OperationCounters;
}

// ---------------------------------------------------------------------------
// Racer
// ---------------------------------------------------------------------------

/** Deterministic opponent strategy identifiers (Project.pdf §4.4). */
export type StrategyType = 'player' | 'main-route' | 'shortcut' | 'shortest-distance';

/** Runtime status of a racer in a session. */
export type RacerStatus = 'racing' | 'waiting' | 'finished' | 'dnf';

/**
 * Live race state for one racer, updated each engine tick.
 * - `currentVertex`: the vertex the racer is currently at or last visited.
 * - `fuel`: remaining fuel (0 → possible DNF depending on recovery policy).
 * - `nitroCharges`: remaining nitro charges (0 ≤ nitroCharges ≤ nitroCapacity).
 * - `lap`: current lap number (1-based; equals totalLaps when finished).
 * - `nextCheckpoint`: 1-based index of the next mandatory checkpoint to visit.
 * - `totalTime`: elapsed simulation seconds.
 * - `status`: current race status.
 * - `dnfReason`: human-readable reason string when status === 'dnf'.
 */
export interface Racer {
  readonly id: string;
  readonly name: string;
  readonly isHuman: boolean;
  readonly strategyType: StrategyType;
  currentVertex: number;
  fuel: number;
  nitroCharges: number;
  lap: number;
  nextCheckpoint: number;
  totalTime: number;
  status: RacerStatus;
  dnfReason?: string;
}

// ---------------------------------------------------------------------------
// Race result & championship
// ---------------------------------------------------------------------------

/**
 * Immutable result record for one racer in one completed race.
 * Produced by the championship manager after each race finishes.
 * - `finishPosition`: 1-based finish order (DNF racers receive last positions).
 * - `finishTime`: simulation seconds; null for DNF.
 * - `fastestLap`: fastest single-lap time in seconds; null if no lap completed.
 * - `bonusPoints`: additional points (fastest-lap bonus etc.; 0 if unused).
 * - `pointsAwarded`: total points including bonus from POINTS_TABLE + bonusPoints.
 */
export interface RaceResult {
  readonly raceId: string;
  readonly racerId: string;
  readonly finishPosition: number;
  readonly finishTime: number | null;
  readonly fastestLap: number | null;
  readonly bonusPoints: number;
  readonly pointsAwarded: number;
  readonly dnfReason?: string;
}

/**
 * Cumulative championship standing for one racer across all completed races.
 * Used as input to all three sorting algorithms and top-k retrieval.
 *
 * Tie-breaking order (Project.pdf §4.6):
 *  1. totalPoints DESC
 *  2. wins DESC
 *  3. sumOfFinishPositions ASC
 *  4. bestFastestLap ASC (null means no lap completed; sorts last)
 *  5. racerId ASC (lexicographic, deterministic final tie-breaker)
 */
export interface ChampionshipEntry {
  readonly racerId: string;
  totalPoints: number;
  wins: number;
  sumOfFinishPositions: number;
  bestFastestLap: number | null;
}

// ---------------------------------------------------------------------------
// Resource planning
// ---------------------------------------------------------------------------

/**
 * One candidate item for the 0/1 Knapsack resource planner.
 * - `id`: stable unique identifier.
 * - `label`: human-readable description (e.g. 'Nitro pickup at vertex 12').
 * - `cost`: non-negative integer discrete budget units (see config.ts for unit definition).
 * - `benefit`: non-negative numeric value gained by selecting this item.
 */
export interface ResourceItem {
  readonly id: string;
  readonly label: string;
  readonly cost: number;    // integer ≥ 0
  readonly benefit: number; // finite ≥ 0
}

/**
 * Output of the resource planner (DP or Greedy).
 * - `selectedIds`: IDs of chosen items.
 * - `totalCost`: sum of costs of selected items (≤ budget).
 * - `totalBenefit`: sum of benefits of selected items.
 * - `feasible`: true if totalCost ≤ budget and all physical constraints satisfied.
 * - `dpStateCount`: number of DP table cells filled (m × B); 0 for greedy plans.
 */
export interface ResourcePlan {
  readonly method: 'dp' | 'greedy';
  readonly selectedIds: string[];
  readonly totalCost: number;
  readonly totalBenefit: number;
  readonly feasible: boolean;
  readonly dpStateCount: number;
}

