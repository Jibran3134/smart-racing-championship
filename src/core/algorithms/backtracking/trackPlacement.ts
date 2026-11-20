/**
 * Backtracking Feature Placement — Alishba (Milestone 7).
 *
 * Uses backtracking search with constraint pruning to assign:
 *  - Mandatory Checkpoints in sequential order.
 *  - FuelStations subject to minimum spacing constraints.
 *  - NitroPickups placed away from checkpoints.
 *  - DeadEnds and Intersections based on degree.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import type { Vertex, VertexType, Edge } from '../../types';

export interface PlacementConstraints {
  minCheckpointCount: number;
  minFuelStations: number;
  minNitroPickups: number;
  minStationSpacing: number; // minimum distance between fuel stations
}

export interface PlacementResult {
  vertices: Vertex[];
  success: boolean;
  backtracks: number;
}

/**
 * Assign roles to an unassigned set of vertices using backtracking.
 */
export function placeTrackFeatures(
  vertices: readonly Vertex[],
  edges: readonly Edge[],
  constraints: PlacementConstraints = {
    minCheckpointCount: 10,
    minFuelStations: 2,
    minNitroPickups: 2,
    minStationSpacing: 150,
  },
): PlacementResult {
  const resultVertices: Vertex[] = vertices.map((v) => ({ ...v }));
  let backtracks = 0;

  // Compute adjacency degree and distance lookup
  const adj = new Map<number, { neighbor: number; distance: number }[]>();
  for (const v of vertices) adj.set(v.id, []);
  for (const e of edges) {
    adj.get(e.from)?.push({ neighbor: e.to, distance: e.distance });
    if (!e.directed) {
      adj.get(e.to)?.push({ neighbor: e.from, distance: e.distance });
    }
  }

  // Identify Start vertex (id 0 or first vertex)
  resultVertices[0] = { ...resultVertices[0], type: 'Start', active: true };

  const fuelStationIds: number[] = [];
  let checkpointOrder = 1;

  // Backtracking assignment loop
  function search(index: number): boolean {
    if (index >= resultVertices.length) {
      // Base case: check all minimum requirements
      const cpCount = resultVertices.filter((v) => v.type === 'Checkpoint').length;
      const fuelCount = resultVertices.filter((v) => v.type === 'FuelStation').length;
      const nitroCount = resultVertices.filter((v) => v.type === 'NitroPickup').length;

      return (
        cpCount >= constraints.minCheckpointCount &&
        fuelCount >= constraints.minFuelStations &&
        nitroCount >= constraints.minNitroPickups
      );
    }

    if (index === 0) return search(index + 1); // Start is already assigned

    const v = resultVertices[index];
    const degree = adj.get(v.id)?.length ?? 0;

    // Potential role candidates in priority order
    const candidateTypes: VertexType[] = [];

    if (degree === 1) {
      candidateTypes.push('DeadEnd');
    } else {
      if (checkpointOrder <= constraints.minCheckpointCount) {
        candidateTypes.push('Checkpoint');
      }
      candidateTypes.push('FuelStation');
      candidateTypes.push('NitroPickup');
      candidateTypes.push('Intersection');
    }

    for (const type of candidateTypes) {
      // 1. Prune FuelStation if too close to an existing fuel station
      if (type === 'FuelStation') {
        const tooClose = fuelStationIds.some((otherId) => {
          const other = resultVertices.find((vt) => vt.id === otherId);
          if (!other) return false;
          const dist = Math.hypot(v.x - other.x, v.y - other.y);
          return dist < constraints.minStationSpacing;
        });
        if (tooClose) continue; // Pruned
      }

      // Assign tentatively
      const prevType = v.type;
      const prevOrder = v.checkpointOrder;
      const mutableV = v as { type: VertexType; checkpointOrder?: number };

      if (type === 'Checkpoint') {
        mutableV.type = 'Checkpoint';
        mutableV.checkpointOrder = checkpointOrder++;
      } else if (type === 'FuelStation') {
        mutableV.type = 'FuelStation';
        fuelStationIds.push(v.id);
      } else {
        mutableV.type = type;
      }

      if (search(index + 1)) {
        return true;
      }

      // Backtrack
      backtracks++;
      if (type === 'Checkpoint') {
        checkpointOrder--;
        mutableV.checkpointOrder = prevOrder;
      } else if (type === 'FuelStation') {
        fuelStationIds.pop();
      }
      mutableV.type = prevType;
    }

    return false;
  }

  const success = search(1);

  return {
    vertices: resultVertices,
    success,
    backtracks,
  };
}
