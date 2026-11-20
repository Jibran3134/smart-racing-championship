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

    // If a pre-computed default route exists, follow it directly if all roads are open
    if (this._defaultRoute.length > 0) {
      const curIdx = this._defaultRoute.indexOf(currentVertex);
      if (curIdx !== -1) {
        // Find nextTarget after curIdx
        let targetIdx = this._defaultRoute.indexOf(nextTarget, curIdx + 1);
        if (targetIdx === -1 && curIdx < this._defaultRoute.length - 1) {
          targetIdx = curIdx + 1;
        }

        if (targetIdx > curIdx) {
          const subPath = this._defaultRoute.slice(curIdx, targetIdx + 1);
          // Verify all edges along subPath are open and exist in graph
          let routeValid = true;
          const edgeIds: string[] = [];
          let totalDist = 0;
          let totalTime = 0;
          let totalFuel = 0;

          for (let i = 0; i < subPath.length - 1; i++) {
            const u = subPath[i];
            const v = subPath[i + 1];
            const edge = graph.getNeighbors(u).find((e) => e.to === v && e.status !== 'Blocked');
            if (!edge) {
              routeValid = false;
              break;
            }
            edgeIds.push(edge.id);
            totalDist += edge.distance;
            totalTime += edge.baseTime;
            totalFuel += edge.fuelCost;
          }

          if (routeValid && edgeIds.length > 0) {
            return {
              path: subPath,
              edgeIds,
              distance: totalDist,
              time: totalTime,
              scalarCost: totalDist,
              fuelNeeded: totalFuel,
            };
          }
        }
      }
    }

    // Road blocked or off default route: recalculate detour to next checkpoint using Dijkstra
    return dijkstra(graph, currentVertex, nextTarget, 'Balanced');
  }
}
