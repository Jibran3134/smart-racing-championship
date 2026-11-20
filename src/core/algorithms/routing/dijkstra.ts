/**
 * Dijkstra's shortest-path algorithm — Alishba (Milestone 3).
 *
 * Uses Jibran's MinHeap<T> from src/core/structures/MinHeap.ts.
 * Implements lazy-deletion pattern to avoid a decrease-key operation.
 *
 * Returns RouteResult if target is reachable; null otherwise.
 * Exposes OperationCounters and optional per-step trace callback.
 *
 * Rules (AGENTS.md):
 *  - No UI/DOM/React imports.
 *  - Deterministic: tie-break by insertion sequence number.
 *  - Algorithm implemented by hand; no library imports.
 */

import { MinHeap } from '../../structures/MinHeap';
import { computeEdgeCost } from '../../graph/cost';
import type { ActiveEffect } from '../../graph/TrackGraph';
import type { TrackGraph } from '../../graph/TrackGraph';
import type { CostPreset, CostWeights, RouteResult, OperationCounters, TraceStep, TraceStepType } from '../../types';

// ---------------------------------------------------------------------------
// Internal heap entry
// ---------------------------------------------------------------------------

interface DijkstraEntry {
  vertexId: number;
  cost: number;
  /** Monotonically increasing insertion counter for deterministic tie-breaking. */
  seq: number;
}

function entryComparator(a: DijkstraEntry, b: DijkstraEntry): number {
  if (a.cost !== b.cost) return a.cost - b.cost;
  return a.seq - b.seq; // deterministic tie-break
}

// ---------------------------------------------------------------------------
// Trace step
// ---------------------------------------------------------------------------

export interface DijkstraStep extends TraceStep {
  readonly type: TraceStepType;
  readonly vertex?: number;
  readonly edge?: string;
  readonly tentativeCost?: number;
}

export type OnDijkstraStep = (step: DijkstraStep) => void;

// ---------------------------------------------------------------------------
// dijkstra
// ---------------------------------------------------------------------------

/**
 * Run Dijkstra from `source` to `target` on the given graph.
 *
 * @param graph         - The track graph (live edge state).
 * @param source        - Start vertex id.
 * @param target        - Goal vertex id.
 * @param preset        - Cost profile used for edge weights.
 * @param activeEffects - In-flight event effects (oil spills, speed cams).
 * @param onStep        - Optional step callback for the Algorithm Lab trace.
 * @returns RouteResult on success, null if target is unreachable.
 */
export function dijkstra(
  graph: TrackGraph,
  source: number,
  target: number,
  preset: CostPreset | CostWeights,
  activeEffects: readonly ActiveEffect[] = [],
  onStep?: OnDijkstraStep,
): RouteResult | null {
  // Operation counters
  const counters: OperationCounters = {
    expandedVertices: 0,
    relaxedEdges: 0,
    heapOps: 0,
    comparisons: 0,
  };

  // dist[v] = best known cost to reach v
  const dist = new Map<number, number>();
  // parent[v] = {vertex, edgeId} used to reconstruct the path
  const parent = new Map<number, { vertex: number; edgeId: string }>();
  // Closed set (finalized vertices)
  const closed = new Set<number>();

  let seq = 0;
  const heap = new MinHeap<DijkstraEntry>(entryComparator);

  dist.set(source, 0);
  heap.push({ vertexId: source, cost: 0, seq: seq++ });
  counters.heapOps++;

  if (onStep) {
    onStep({ type: 'push', vertex: source, tentativeCost: 0, counters: { ...counters } });
  }

  while (!heap.isEmpty) {
    const entry = heap.pop()!;
    counters.heapOps++;

    // Lazy deletion: skip stale entries
    counters.comparisons++;
    if ((dist.get(entry.vertexId) ?? Infinity) < entry.cost) {
      continue; // stale
    }
    if (closed.has(entry.vertexId)) continue;
    closed.add(entry.vertexId);
    counters.expandedVertices++;

    if (onStep) {
      onStep({ type: 'pop', vertex: entry.vertexId, tentativeCost: entry.cost, counters: { ...counters } });
    }

    if (entry.vertexId === target) break; // found

    // Relax outgoing edges
    for (const edge of graph.getNeighbors(entry.vertexId)) {
      if (closed.has(edge.to)) continue;

      const edgeCost = computeEdgeCost(edge, preset, activeEffects);
      counters.comparisons++;
      const newCost = entry.cost + edgeCost;
      counters.relaxedEdges++;

      const bestSoFar = dist.get(edge.to) ?? Infinity;
      counters.comparisons++;
      if (newCost < bestSoFar) {
        dist.set(edge.to, newCost);
        parent.set(edge.to, { vertex: entry.vertexId, edgeId: edge.id });
        heap.push({ vertexId: edge.to, cost: newCost, seq: seq++ });
        counters.heapOps++;

        if (onStep) {
          onStep({ type: 'relax', vertex: edge.to, edge: edge.id, tentativeCost: newCost, counters: { ...counters } });
        }
      }
    }
  }

  // Merge heap counters
  const hc = heap.counters;
  counters.heapOps = hc.heapOps;
  counters.comparisons += hc.comparisons;

  if (onStep) {
    onStep({ type: 'done', counters: { ...counters } });
  }

  // Check reachability
  if (!closed.has(target)) return null;

  // Reconstruct path
  return _reconstruct(graph, source, target, parent, dist.get(target)!);
}

// ---------------------------------------------------------------------------
// Path reconstruction helper
// ---------------------------------------------------------------------------

function _reconstruct(
  graph: TrackGraph,
  source: number,
  target: number,
  parent: Map<number, { vertex: number; edgeId: string }>,
  scalarCost: number,
): RouteResult {
  const pathVertices: number[] = [];
  const edgeIds: string[] = [];
  let cur = target;

  while (cur !== source) {
    pathVertices.push(cur);
    const p = parent.get(cur)!;
    edgeIds.push(p.edgeId);
    cur = p.vertex;
  }
  pathVertices.push(source);
  pathVertices.reverse();
  edgeIds.reverse();

  // Compute distance, time, fuelNeeded from edge data
  let distance = 0;
  let time = 0;
  let fuelNeeded = 0;

  for (const eid of edgeIds) {
    const edge = graph.getEdge(eid);
    if (!edge) continue;
    // Strip ~rev suffix to get the real edge id for lookup
    const realEdge = eid.endsWith('~rev') ? graph.getEdge(eid.slice(0, -4)) ?? edge : edge;
    distance   += realEdge.distance;
    time       += realEdge.baseTime;
    fuelNeeded += realEdge.fuelCost;
  }

  return {
    path: pathVertices,
    edgeIds,
    distance,
    time,
    scalarCost,
    fuelNeeded,
  };
}
