/**
 * ShortestDistanceBot — Alishba (Milestone 6).
 *
 * Deterministic opponent bot that strictly prioritizes shortest distance.
 *  - Calculates routes with minimum spatial/graph distance.
 *  - Recalculates dynamically whenever graph topology or restrictions change.
 *  - Diverts to nearest fuel station when fuel <= 25%.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import type { TrackGraph } from '../../graph/TrackGraph';
import { dijkstra } from '../../algorithms/routing/dijkstra';
import { MAX_FUEL, REFUEL_THRESHOLD } from '../../config';
import type { RouteResult, CostWeights } from '../../types';

const DISTANCE_WEIGHTS: CostWeights = {
  distance: 1.0,
  time: 0,
  fuel: 0,
  difficulty: 0,
  obstacle: 0,
};

export class ShortestDistanceBot {
  readonly id: string;
  readonly name: string;

  constructor(id: string = 'bot-distance', name: string = 'Metric Shadow') {
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

    // Check refuelling
    if (currentFuel <= MAX_FUEL * REFUEL_THRESHOLD) {
      let nearestStation: number | null = null;
      let minStationDist = Infinity;

      for (const v of graph.getVertices()) {
        if (v.type === 'FuelStation' && v.active) {
          const leg = dijkstra(graph, currentVertex, v.id, DISTANCE_WEIGHTS);
          if (leg && leg.distance < minStationDist) {
            minStationDist = leg.distance;
            nearestStation = v.id;
          }
        }
      }

      if (nearestStation !== null && nearestStation !== currentVertex) {
        const toStation = dijkstra(graph, currentVertex, nearestStation, DISTANCE_WEIGHTS);
        if (toStation) return toStation;
      }
    }

    // Minimum total distance routing per Project.pdf §4.4
    return dijkstra(graph, currentVertex, nextTarget, DISTANCE_WEIGHTS);
  }
}
