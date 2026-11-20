/**
 * computeEdgeCost — scalar edge cost function used by Dijkstra, A*, and the
 * Algorithm Lab preset-comparison panel.
 *
 * Formula (Project.pdf §3.3):
 *   cost(e) = w.distance × (e.distance  / REF.distance)
 *           + w.time     × (e.baseTime  / REF.time)
 *           + w.fuel     × (effectiveFuelCost / REF.fuel)
 *           + w.difficulty × (effectiveDifficulty / REF.difficulty)
 *           + w.obstacle × obstacleScore
 *
 * Rules:
 *  - Caller MUST NOT call this for Blocked edges; behaviour is undefined.
 *  - Always returns a non-negative finite number.
 *  - effectiveDifficulty = min(5, edge.difficulty + max difficultyPenalty from effects).
 *  - effectiveFuelCost   = edge.fuelCost × fuelMultiplier(effectiveDifficulty).
 *  - obstacleScore       = effectiveDifficulty / REF.difficulty  (reuses diff norm).
 *  - If a speedCap is active, baseTime is adjusted upward:
 *      adjustedTime = max(e.baseTime, e.distance / speedCap)   [cap slows traversal]
 *
 * No UI/DOM/React imports — src/core pure.
 */

import type { Edge, CostPreset, CostWeights } from '../types';
import { PRESET_WEIGHTS, NORMALIZATION_REF, fuelMultiplier } from '../config';
import type { ActiveEffect } from './TrackGraph';

/**
 * Compute the scalar routing cost for a single edge under a given preset or custom weights.
 *
 * @param edge          - The edge to evaluate. Must NOT be Blocked.
 * @param preset        - Cost profile ('Balanced' | 'Speed' | 'Economy' | 'Safety') or custom CostWeights.
 * @param activeEffects - Live event effects (oil spills, speed cams, etc.)
 *                        that modify this edge's traversal cost.
 */
export function computeEdgeCost(
  edge: Edge,
  preset: CostPreset | CostWeights,
  activeEffects: readonly ActiveEffect[] = [],
): number {
  const w = typeof preset === 'string' ? PRESET_WEIGHTS[preset] : preset;
  const ref = NORMALIZATION_REF;

  // ------------------------------------------------------------------
  // Collect effects that apply to this edge
  // ------------------------------------------------------------------
  let maxDiffPenalty = 0;
  let minSpeedCap = edge.speedCap ?? Infinity;

  for (const effect of activeEffects) {
    if (effect.edgeId !== edge.id) continue;
    if (effect.difficultyPenalty !== undefined && effect.difficultyPenalty > maxDiffPenalty) {
      maxDiffPenalty = effect.difficultyPenalty;
    }
    if (effect.speedCap !== undefined && effect.speedCap < minSpeedCap) {
      minSpeedCap = effect.speedCap;
    }
  }

  // ------------------------------------------------------------------
  // Effective difficulty (clamped to [1, 5])
  // ------------------------------------------------------------------
  const effectiveDifficulty = Math.min(5, Math.max(1, edge.difficulty + maxDiffPenalty));

  // ------------------------------------------------------------------
  // Effective fuel cost (difficulty multiplier applied)
  // ------------------------------------------------------------------
  const effectiveFuelCost = edge.fuelCost * fuelMultiplier(effectiveDifficulty);

  // ------------------------------------------------------------------
  // Effective traversal time (speed cap slows down the racer)
  // ------------------------------------------------------------------
  let effectiveTime = edge.baseTime;
  if (isFinite(minSpeedCap) && minSpeedCap > 0 && edge.distance > 0) {
    const cappedTime = edge.distance / minSpeedCap;
    effectiveTime = Math.max(edge.baseTime, cappedTime);
  }

  // ------------------------------------------------------------------
  // Obstacle score (normalized difficulty as a proxy for road hazard)
  // ------------------------------------------------------------------
  const obstacleScore = effectiveDifficulty / ref.difficulty;

  // ------------------------------------------------------------------
  // Weighted sum
  // ------------------------------------------------------------------
  const cost =
    w.distance  * (edge.distance        / ref.distance)  +
    w.time      * (effectiveTime         / ref.time)      +
    w.fuel      * (effectiveFuelCost     / ref.fuel)      +
    w.difficulty * (effectiveDifficulty  / ref.difficulty) +
    w.obstacle  * obstacleScore;

  // Guard: always return a non-negative finite number
  return Math.max(0, isFinite(cost) ? cost : 0);
}
