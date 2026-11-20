/**
 * ShortcutBot — Alishba (Milestone 6).
 *
 * Deterministic opponent bot that aggressively exploits shortcuts when open.
 *  - Uses 'Speed' preset weights to prioritize fast routes.
 *  - Proactively checks adjacent shortcut edges; if open and valid, takes them.
 *  - Falls back to standard speed routing when shortcuts are closed/blocked.
 *  - Refuels when fuel <= 25%.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import type { TrackGraph } from '../../graph/TrackGraph';
import { dijkstra } from '../../algorithms/routing/dijkstra';
import { MAX_FUEL } from '../../config';
import type { RouteResult } from '../../types';

export class ShortcutBot {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'bot-shortcut', name: string = 'Shortcut Phantom') {
    this.id = id;
    this.name = name;
  }

  planNextLeg(
    graph: TrackGraph,
    currentVertex: number,
    remainingCheckpoints: readonly number[],
    finishVertex: number,
    currentFuel: number,
  ): RouteResult | null {
    const nextTarget = remainingCheckpoints.length > 0 ? remainingCheckpoints[0] : finishVertex;

    // Refuel check if critically low (< 50% — proactive)
    if (currentFuel <= MAX_FUEL * 0.50) {
      let nearestStation: number | null = null;
      let minStationDist = Infinity;

      for (const v of graph.getVertices()) {
        if (v.type === 'FuelStation' && v.active) {
          const leg = dijkstra(graph, currentVertex, v.id, 'Economy');
          if (leg && leg.distance < minStationDist) {
            minStationDist = leg.distance;
            nearestStation = v.id;
          }
        }
      }

      if (nearestStation !== null && nearestStation !== currentVertex) {
        const toStation = dijkstra(graph, currentVertex, nearestStation, 'Economy');
        if (toStation) return toStation;
      }
    }

    // Explicitly prioritize open legal shortcuts from current position
    const openShortcuts = graph
      .getNeighbors(currentVertex)
      .filter((e) => e.isShortcut && e.status === 'Open');

    let bestShortcutRoute: RouteResult | null = null;
    let minShortcutTime = Infinity;

    for (const scEdge of openShortcuts) {
      if (scEdge.to === nextTarget) {
        bestShortcutRoute = {
          path: [currentVertex, nextTarget],
          edgeIds: [scEdge.id],
          distance: scEdge.distance,
          time: scEdge.baseTime,
          scalarCost: scEdge.baseTime,
          fuelNeeded: scEdge.fuelCost,
        };
        break;
      }
      const onward = dijkstra(graph, scEdge.to, nextTarget, 'Speed');
      if (onward) {
        const totalTime = scEdge.baseTime + onward.time;
        if (totalTime < minShortcutTime) {
          minShortcutTime = totalTime;
          bestShortcutRoute = {
            path: [currentVertex, ...onward.path],
            edgeIds: [scEdge.id, ...onward.edgeIds],
            distance: scEdge.distance + onward.distance,
            time: totalTime,
            scalarCost: totalTime,
            fuelNeeded: scEdge.fuelCost + onward.fuelNeeded,
          };
        }
      }
    }

    if (bestShortcutRoute) return bestShortcutRoute;

    // Attempt speed routing (which favors low time and shortcuts)
    const speedRoute = dijkstra(graph, currentVertex, nextTarget, 'Speed');
    if (speedRoute) return speedRoute;

    // Fallback to balanced if speed route fails
    return dijkstra(graph, currentVertex, nextTarget, 'Balanced');
  }
}
