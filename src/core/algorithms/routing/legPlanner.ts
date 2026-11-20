/**
 * Checkpoint Leg Planner — Alishba (Milestone 3).
 *
 * Plans a multi-leg route through an ordered list of checkpoints.
 * On road closure, recalculates remaining legs from the racer's current position.
 *
 * Uses dijkstra as the default solver (can be swapped to astar).
 *
 * Rules (AGENTS.md):
 *  - No UI/DOM/React imports.
 *  - Checkpoint ordering is enforced strictly; no skipping.
 *  - Returns one RouteResult per leg.
 */

import { dijkstra } from './dijkstra';
import type { TrackGraph } from '../../graph/TrackGraph';
import type { ActiveEffect } from '../../graph/TrackGraph';
import type { CostPreset, RouteResult } from '../../types';

export interface RacerPlanState {
  /** Vertex the racer is currently at. */
  currentVertex: number;
  /** Next checkpoint order number to visit (1-based). */
  nextCheckpoint: number;
}

/**
 * Plan a full route: source → checkpoint[0] → checkpoint[1] → … → finish.
 *
 * @param graph       - Live track graph.
 * @param source      - Start vertex id.
 * @param checkpoints - Ordered checkpoint vertex ids (must be visited in order).
 * @param finish      - Finish vertex id.
 * @param preset      - Cost profile.
 * @param effects     - Active event effects.
 * @returns Array of RouteResult, one per leg; null entries indicate an unreachable leg.
 */
export function planRoute(
  graph: TrackGraph,
  source: number,
  checkpoints: readonly number[],
  finish: number,
  preset: CostPreset,
  effects: readonly ActiveEffect[] = [],
): (RouteResult | null)[] {
  const waypoints = [...checkpoints, finish];
  const legs: (RouteResult | null)[] = [];
  let current = source;

  for (const wp of waypoints) {
    const result = dijkstra(graph, current, wp, preset, effects);
    legs.push(result);
    if (result) {
      current = wp;
    } else {
      // Can't reach this waypoint; fill remaining legs as null
      for (let i = legs.length; i < waypoints.length; i++) legs.push(null);
      return legs;
    }
  }

  return legs;
}

/**
 * Recalculate remaining legs after a road closure or racer position change.
 *
 * @param graph                - Live track graph (with updated edge statuses).
 * @param state                - Current racer state (position + next checkpoint index).
 * @param remainingCheckpoints - Checkpoint vertex ids not yet visited (in order).
 * @param finish               - Finish vertex id.
 * @param preset               - Cost profile.
 * @param effects              - Active event effects.
 * @returns Recalculated RouteResult legs from current position onward.
 */
export function recalculate(
  graph: TrackGraph,
  state: RacerPlanState,
  remainingCheckpoints: readonly number[],
  finish: number,
  preset: CostPreset,
  effects: readonly ActiveEffect[] = [],
): (RouteResult | null)[] {
  return planRoute(graph, state.currentVertex, remainingCheckpoints, finish, preset, effects);
}
