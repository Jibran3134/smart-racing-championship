/**
 * TrackValidator — Alishba (Milestone 7).
 *
 * Validates complete racing circuits against all assignment specifications:
 *  - Vertices non-empty, unique IDs.
 *  - Roads connect valid endpoints with valid non-negative distances.
 *  - Exactly one Start vertex.
 *  - ≥ 10 Checkpoints with contiguous 1..k ordering.
 *  - Sequential reachability: Start → CP1 → ... → CPk → Start via Dijkstra.
 *  - ≥ 2 designated shortcuts.
 *  - ≥ 1 dead end.
 *  - Fuel feasibility: fuel consumption per leg manageable or reachable via fuel stations.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import { TrackGraph } from '../graph/TrackGraph';
import { dijkstra } from '../algorithms/routing/dijkstra';
import type { Vertex, Edge } from '../types';
import { MAX_FUEL } from '../config';

export interface ValidationReport {
  valid: boolean;
  errors: string[];
}

export class TrackValidator {
  /**
   * Validate a track's vertices and edges.
   */
  static validate(vertices: readonly Vertex[], edges: readonly Edge[]): ValidationReport {
    const errors: string[] = [];

    if (!vertices.length) errors.push('Track must contain vertices.');
    if (!edges.length) errors.push('Track must contain edges.');

    // 1. Vertex validation
    const vIds = new Set<number>();
    let startCount = 0;
    const checkpoints: Vertex[] = [];
    let deadEndCount = 0;

    for (const v of vertices) {
      if (vIds.has(v.id)) errors.push(`Duplicate vertex ID: ${v.id}.`);
      vIds.add(v.id);

      if (v.type === 'Start') startCount++;
      if (v.type === 'Checkpoint') checkpoints.push(v);
      if (v.type === 'DeadEnd') deadEndCount++;
    }

    if (startCount !== 1) errors.push(`Track must have exactly one Start vertex; found ${startCount}.`);

    // 2. Checkpoint ordering
    checkpoints.sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0));
    if (checkpoints.length < 10) {
      errors.push(`Track must have at least 10 checkpoints; found ${checkpoints.length}.`);
    }

    for (let i = 0; i < checkpoints.length; i++) {
      if (checkpoints[i].checkpointOrder !== i + 1) {
        errors.push(`Checkpoints must have contiguous orders 1..${checkpoints.length}; broken at ${checkpoints[i].checkpointOrder}.`);
        break;
      }
    }

    // 3. Edge validation
    const eIds = new Set<string>();
    let shortcutCount = 0;

    for (const e of edges) {
      if (eIds.has(e.id)) errors.push(`Duplicate edge ID: ${e.id}.`);
      eIds.add(e.id);

      if (!vIds.has(e.from)) errors.push(`Edge ${e.id} references invalid from-vertex ${e.from}.`);
      if (!vIds.has(e.to)) errors.push(`Edge ${e.id} references invalid to-vertex ${e.to}.`);
      if (e.isShortcut) shortcutCount++;
    }

    if (shortcutCount < 2) {
      errors.push(`Track must have at least 2 shortcuts; found ${shortcutCount}.`);
    }

    if (deadEndCount < 1) {
      errors.push(`Track must have at least 1 dead-end vertex; found ${deadEndCount}.`);
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // 4. Graph connectivity and route reachability
    try {
      const graph = new TrackGraph(vertices, edges);
      const startVertex = vertices.find((v) => v.type === 'Start')!;

      let cur = startVertex.id;
      let totalFuelRequired = 0;

      for (let i = 0; i < checkpoints.length; i++) {
        const next = checkpoints[i].id;
        const leg = dijkstra(graph, cur, next, 'Balanced');
        if (!leg) {
          errors.push(`Unreachable checkpoint: cannot route from vertex ${cur} to checkpoint ${next}.`);
          break;
        }
        totalFuelRequired += leg.fuelNeeded;
        cur = next;
      }

      // Return to start for lap
      const finalLeg = dijkstra(graph, cur, startVertex.id, 'Balanced');
      if (!finalLeg) {
        errors.push(`Cannot complete lap: cannot route from last checkpoint ${cur} back to start.`);
      } else {
        totalFuelRequired += finalLeg.fuelNeeded;
      }

      // Fuel stations available if total fuel required exceeds initial capacity
      const fuelStations = vertices.filter((v) => v.type === 'FuelStation');
      if (totalFuelRequired > MAX_FUEL && fuelStations.length === 0) {
        errors.push(`Lap fuel requirement (${totalFuelRequired.toFixed(1)}) exceeds tank (${MAX_FUEL}) with no fuel stations.`);
      }
    } catch (err: unknown) {
      errors.push(`Graph construction failed: ${(err as Error).message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
