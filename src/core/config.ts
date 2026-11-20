/**
 * Shared game configuration — jointly owned by Jibran and Alishba.
 * Source of truth: Project.pdf Sections 3 and 4; DAA Project division.docx.
 * Frozen: 19 November 2026.
 *
 * Rules:
 *  - All tunable values are documented with their source and rationale.
 *  - Freeze these values before writing algorithm tests; changing them invalidates evidence.
 *  - Weights must be non-negative; normalization denominators must be strictly positive.
 *  - Fuel/nitro/resource units must be internally consistent (see RESOURCE_UNIT).
 */

import type { CostPreset, CostWeights } from './types';

// ---------------------------------------------------------------------------
// Race mechanics (Project.pdf §4.1–4.3)
// ---------------------------------------------------------------------------

/** Maximum fuel tank capacity in units (Project.pdf §4.3 suggested default). */
export const MAX_FUEL = 100;

/**
 * Maximum units of fuel that can be purchased at a single station stop.
 * (Project.pdf §4.3 suggested default.)
 */
export const MAX_STATION_PURCHASE = 40;

/**
 * Fixed stop time (seconds) added to a racer's elapsed time for any positive fuel purchase.
 * Applies to both human and AI racers (Project.pdf §4.3).
 * Value is a team decision; agreed as 2 seconds.
 */
export const REFUEL_STOP_SECONDS = 2;

/**
 * Fuel consumption multiplier for edge difficulty d:
 *   fuelConsumed(e) = edge.fuelCost × FUEL_DIFFICULTY_MULTIPLIER(d)
 *   where FUEL_DIFFICULTY_MULTIPLIER(d) = 1.0 + 0.1 × (d − 1)
 * (Project.pdf §4.3 exact formula.)
 */
export function fuelMultiplier(difficulty: number): number {
  return 1.0 + 0.1 * (difficulty - 1);
}

/** Maximum number of nitro charges a racer can hold (Project.pdf §4.3 suggested default). */
export const MAX_NITRO = 3;

/** Initial nitro charges at race start (team decision; matches demo default). */
export const INITIAL_NITRO = 3;

/** Speed multiplier while nitro is active — 1.5× base speed (Project.pdf §4.3). */
export const NITRO_SPEED_MULTIPLIER = 1.5;

/** Duration of a single nitro charge in seconds (Project.pdf §4.3 suggested: 4 s). */
export const NITRO_DURATION_SECONDS = 4;

/** Fuel consumption multiplier while nitro is active — 2× normal burn (Project.pdf §4.3). */
export const NITRO_FUEL_MULTIPLIER = 2;

/** Refuel trigger: racers (and AI) consider refuelling when fuel falls below this fraction. */
export const REFUEL_THRESHOLD = 0.25; // 25 % of MAX_FUEL

/** Default number of laps per race (Project.pdf §4.2 recommended 2 or 3). */
export const DEFAULT_LAPS = 2;

/** Maximum allowed laps option. */
export const MAX_LAPS = 3;

// ---------------------------------------------------------------------------
// Discrete resource unit for DP (Project.pdf §5.3)
// ---------------------------------------------------------------------------

/**
 * Scaling factor that converts continuous fuel/cost values to discrete DP integers.
 * cost_integer = Math.round(continuous_cost × RESOURCE_UNIT).
 * Agreed as 10 (tenths of a fuel unit), giving integer states 0–1000 for a 100-unit tank.
 * This determines DP state-space size: m × (MAX_FUEL × RESOURCE_UNIT).
 */
export const RESOURCE_UNIT = 10;

/** Maximum discrete budget for the 0/1 Knapsack DP: MAX_FUEL × RESOURCE_UNIT. */
export const MAX_DISCRETE_BUDGET = MAX_FUEL * RESOURCE_UNIT; // 1000

// ---------------------------------------------------------------------------
// Championship scoring (Project.pdf §4.6)
// ---------------------------------------------------------------------------

/**
 * Points awarded by finishing position (1-based index).
 * POINTS_TABLE[0] is undefined (no position 0).
 * POINTS_TABLE[1]  = 25 (1st place)
 * POINTS_TABLE[10] = 1  (10th place)
 * Positions beyond 10 receive 0 points.
 */
export const POINTS_TABLE: Readonly<number[]> = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

/**
 * Returns points for a given finish position.
 * @param position 1-based finish position.
 */
export function pointsForPosition(position: number): number {
  return POINTS_TABLE[position] ?? 0;
}

/**
 * Sentinel value for missing fastest-lap time in the championship comparator.
 * A racer who never completed a lap sorts after all racers who have one.
 */
export const NO_FASTEST_LAP = Infinity;

// ---------------------------------------------------------------------------
// Cost normalization reference denominators (Project.pdf §3.3)
// ---------------------------------------------------------------------------

/**
 * Reference values used to normalize raw edge attributes before combining with weights.
 * Normalized value = raw_value / reference.
 * These are track-independent upper-bound estimates; teams must agree and document rationale.
 *
 * - distanceRef:   maximum expected single-edge distance in metres  (agreed: 500 m)
 * - timeRef:       maximum expected single-edge traversal time in s  (agreed: 60 s)
 * - fuelRef:       maximum expected single-edge fuel cost in units   (agreed: 20 units)
 * - difficultyRef: maximum raw difficulty value                      (always 5, per schema)
 */
export const NORMALIZATION_REF = Object.freeze({
  distance: 500,    // metres
  time: 60,         // seconds
  fuel: 20,         // fuel units
  difficulty: 5,    // difficulty scale max
} as const);

// ---------------------------------------------------------------------------
// Cost presets (Project.pdf §3.3)
// ---------------------------------------------------------------------------

/**
 * Preset weight sets for the scalar edge cost formula:
 *   cost(e) = w.distance × D_norm + w.time × T_norm + w.fuel × F_norm
 *           + w.difficulty × R_norm + w.obstacle × O_norm
 *
 * All weights ≥ 0. Rationale for each preset is documented inline.
 */
export const PRESET_WEIGHTS: Readonly<Record<CostPreset, CostWeights>> = Object.freeze({
  /** Balanced: moderate equal-ish weights across all criteria. */
  Balanced: { distance: 1.0, time: 1.0, fuel: 1.0, difficulty: 1.0, obstacle: 1.0 },

  /** Speed: high time weight; reduced fuel weight; reach destination fastest. */
  Speed: { distance: 0.5, time: 3.0, fuel: 0.3, difficulty: 0.5, obstacle: 0.5 },

  /** Economy: maximize fuel conservation; minimize consumption cost. */
  Economy: { distance: 0.5, time: 0.5, fuel: 3.0, difficulty: 1.0, obstacle: 0.5 },

  /** Safety: avoid high difficulty and obstacle-penalty roads. */
  Safety: { distance: 0.5, time: 0.5, fuel: 0.5, difficulty: 3.0, obstacle: 3.0 },
});

// ---------------------------------------------------------------------------
// Difficulty obstacle penalty (EventProcessor integration)
// ---------------------------------------------------------------------------

/**
 * Maximum difficulty penalty that oil-spill events can apply (0–4 added to base difficulty).
 * Clamped so effective difficulty never exceeds 5.
 * (Defined in EventProcessor; documented here for routing cost clarity.)
 */
export const MAX_OIL_PENALTY = 4;

// ---------------------------------------------------------------------------
// Experiment configuration defaults
// ---------------------------------------------------------------------------

/** Default graph sizes for Experiment 2 (Routing). */
export const EXP2_DEFAULT_SIZES = [10, 50, 100, 250, 500];

/** Default item counts for Experiment 3 (DP vs Greedy). */
export const EXP3_DEFAULT_SIZES = [10, 20, 50, 100, 200];

/** Default racer counts for Experiment 5 (Sorting). */
export const EXP5_DEFAULT_SIZES = [10, 50, 100, 500, 1000, 5000];

