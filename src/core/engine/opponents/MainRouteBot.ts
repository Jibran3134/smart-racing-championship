/**
 * MainRouteBot — Alishba (Milestone 6).
 *
 * Deterministic opponent bot that follows a pre-computed main route.
 *  - Follows stored route through mandatory checkpoints.
 *  - When blocked edge encountered: recalculates detour to the next checkpoint using Dijkstra.
 *  - When fuel < 25%: diverts to refuel at the first eligible fuel station on route.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import type { TrackGraph } from '../../graph/TrackGraph';
import { dijkstra } from '../../algorithms/routing/dijkstra';
import { MAX_FUEL, REFUEL_THRESHOLD } from '../../config';
import type { RouteResult } from '../../types';

export class MainRouteBot {
  readonly id: string;
  readonly name: string;
  private readonly _defaultRoute: readonly number[];

  constructor(id: string = 'bot-main', name: string = 'Apex Cruiser', defaultRoute: readonly number[] = []) {
    this.id = id;
    this.name = name;
    this._defaultRoute = defaultRoute;
  }

  get defaultRoute(): readonly number[] {
    return this._defaultRoute;
  }

  /**
   * Decide next route segment.
   *
   * @param graph                - Live track graph.
   * @param currentVertex        - Current position of bot.
   * @param remainingCheckpoints - Ordered list of checkpoints still to visit.
   * @param finishVertex         - Final finish line vertex.
   * @param currentFuel          - Remaining fuel units.
   */
  planNextLeg(
    graph: TrackGraph,
    currentVertex: number,
    remainingCheckpoints: readonly number[],
    finishVertex: number,
    currentFuel: number,
  ): RouteResult | null {
    const nextTarget = remainingCheckpoints.length > 0 ? remainingCheckpoints[0] : finishVertex;

    // Check if refuelling is critically needed (< 25%)
    const lowFuel = currentFuel <= MAX_FUEL * REFUEL_THRESHOLD;
    if (lowFuel) {
      // Find nearest active FuelStation
      let nearestStation: number | null = null;
      let minStationDist = Infinity;

      for (const v of graph.getVertices()) {
        if (v.type === 'FuelStation' && v.active) {
          const leg = dijkstra(graph, currentVertex, v.id, 'Balanced');
          if (leg && leg.distance < minStationDist) {
            minStationDist = leg.distance;
            nearestStation = v.id;
          }
        }
      }

      if (nearestStation !== null && nearestStation !== currentVertex) {
        const toStation = dijkstra(graph, currentVertex, nearestStation, 'Balanced');
        if (toStation) return toStation;
      }
    }

    // Normal progression to next target using standard Balanced routing
    return dijkstra(graph, currentVertex, nextTarget, 'Balanced');
  }
}
