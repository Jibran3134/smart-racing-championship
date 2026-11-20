/**
 * TrackGenerator — Alishba (Milestone 7).
 *
 * Procedural racing track generator:
 *  1. Layout: Spatially distributes vertices across a 2D coordinate box.
 *  2. Backbone: Computes Prim's MST across proximity candidate edges to guarantee connectivity.
 *  3. Loops & Shortcuts: Adds extra chords to form cycles and distinct shortcut opportunities.
 *  4. Placement: Uses backtracking feature placement to assign Start, Checkpoints, FuelStations, NitroPickups, and DeadEnds.
 *  5. Verification: Validates using TrackValidator with automated retry.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import { primMST } from '../algorithms/mst/mst';
import { placeTrackFeatures } from '../algorithms/backtracking/trackPlacement';
import { TrackValidator } from './TrackValidator';
import type { Vertex, Edge } from '../types';

export interface GeneratorConfig {
  name: string;
  vertexCount?: number;
  width?: number;
  height?: number;
  seed?: number;
}

export interface GeneratedTrack {
  name: string;
  vertices: Vertex[];
  edges: Edge[];
}

export class TrackGenerator {
  /**
   * Procedurally generate a fully validated track.
   */
  static generate(config: GeneratorConfig): GeneratedTrack {
    const name = config.name;
    const count = Math.max(16, config.vertexCount ?? 18);
    const width = config.width ?? 1000;
    const height = config.height ?? 800;
    let seed = config.seed ?? 42;

    // Pseudo-random linear congruential generator for reproducible layouts
    function random(): number {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const MAX_ATTEMPTS = 10;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // 1. Generate vertices along an elliptical loop with jitter
      const rawVertices: Vertex[] = [];
      const centerX = width / 2;
      const centerY = height / 2;
      const radiusX = width * 0.38;
      const radiusY = height * 0.38;

      for (let i = 0; i < count; i++) {
        const theta = (i / count) * 2 * Math.PI;
        const jitterR = 0.85 + 0.3 * random();
        const x = Math.round(centerX + radiusX * Math.cos(theta) * jitterR);
        const y = Math.round(centerY + radiusY * Math.sin(theta) * jitterR);

        rawVertices.push({
          id: i,
          x,
          y,
          type: 'Intersection',
          active: true,
        });
      }

      // Add 2 spur vertices for dead ends
      rawVertices.push({
        id: count,
        x: Math.round(rawVertices[2].x + 70),
        y: Math.round(rawVertices[2].y + 70),
        type: 'DeadEnd',
        active: true,
      });

      // 2. Build candidate edges (main ring + cross-links)
      const candidateEdges: Edge[] = [];
      let edgeCounter = 0;

      // Primary ring loop
      for (let i = 0; i < count; i++) {
        const next = (i + 1) % count;
        const dist = Math.round(Math.hypot(rawVertices[next].x - rawVertices[i].x, rawVertices[next].y - rawVertices[i].y));
        edgeCounter += 1;
        candidateEdges.push({
          id: `road-${edgeCounter}`,
          from: i,
          to: next,
          distance: dist,
          baseTime: Math.max(2, Math.round(dist / 15)),
          fuelCost: Math.max(1, Math.round(dist / 40)),
          difficulty: 2,
          status: 'Open',
          directed: false,
          isShortcut: false,
        });
      }

      // Spur road to dead end
      const spurDist = 100;
      edgeCounter += 1;
      candidateEdges.push({
        id: `road-${edgeCounter}`,
        from: 2,
        to: count,
        distance: spurDist,
        baseTime: 6,
        fuelCost: 3,
        difficulty: 3,
        status: 'Open',
        directed: false,
        isShortcut: false,
      });

      // 3. Compute MST to guarantee connectivity backbone
      primMST(rawVertices, candidateEdges);

      // 4. Add 2 designated shortcut chords across the ring
      const sc1From = 1;
      const sc1To = Math.floor(count / 2);
      const sc1Dist = Math.round(Math.hypot(rawVertices[sc1To].x - rawVertices[sc1From].x, rawVertices[sc1To].y - rawVertices[sc1From].y));
      candidateEdges.push({
        id: `shortcut-1`,
        from: sc1From,
        to: sc1To,
        distance: sc1Dist,
        baseTime: Math.max(2, Math.round(sc1Dist / 22)), // faster!
        fuelCost: Math.max(1, Math.round(sc1Dist / 35)),
        difficulty: 4, // higher risk
        status: 'Open',
        directed: false,
        isShortcut: true,
      });

      const sc2From = Math.floor(count * 0.6);
      const sc2To = Math.floor(count * 0.9);
      const sc2Dist = Math.round(Math.hypot(rawVertices[sc2To].x - rawVertices[sc2From].x, rawVertices[sc2To].y - rawVertices[sc2From].y));
      candidateEdges.push({
        id: `shortcut-2`,
        from: sc2From,
        to: sc2To,
        distance: sc2Dist,
        baseTime: Math.max(2, Math.round(sc2Dist / 22)),
        fuelCost: Math.max(1, Math.round(sc2Dist / 35)),
        difficulty: 4,
        status: 'Open',
        directed: false,
        isShortcut: true,
      });

      // Combined edge set (ring + spur + shortcuts)
      const allEdges = candidateEdges;

      // 5. Backtracking feature placement (Start, Checkpoints 1..10, FuelStations, Nitro)
      const placement = placeTrackFeatures(rawVertices, allEdges, {
        minCheckpointCount: 10,
        minFuelStations: 2,
        minNitroPickups: 2,
        minStationSpacing: 120,
      });

      // 6. Validate complete circuit
      const validation = TrackValidator.validate(placement.vertices, allEdges);
      if (validation.valid) {
        return {
          name,
          vertices: placement.vertices,
          edges: allEdges,
        };
      }
    }

    throw new Error(`Failed to generate a valid track after ${MAX_ATTEMPTS} attempts.`);
  }
}
