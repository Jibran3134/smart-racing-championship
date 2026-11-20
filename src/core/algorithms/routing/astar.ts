/**
 * A* (A-star) shortest-path algorithm — Alishba (Milestone 3).
 *
 * Uses Jibran's MinHeap<T> from src/core/structures/MinHeap.ts.
 * Heuristic: Euclidean distance × minCostPerMetre across all edges.
 * Falls back to h = 0 (Dijkstra behaviour) when ratio is unavailable.
 *
 * The heuristic is admissible (never overestimates true cost) and consistent
 * (triangle inequality holds for Euclidean geometry), so closed vertices are
 * never reopened, giving optimal O((V + E) log V) performance.
 *
 * Rules (AGENTS.md):
 *  - No UI/DOM/React imports.
 *  - Deterministic: tie-break by insertion sequence number.
 *  - Algorithm implemented by hand.
 */

import { MinHeap } from '../../structures/MinHeap';
import { computeEdgeCost } from '../../graph/cost';
import type { ActiveEffect } from '../../graph/TrackGraph';
import type { TrackGraph } from '../../graph/TrackGraph';
import type { CostPreset, CostWeights, RouteResult, OperationCounters, TraceStepType } from '../../types';

// ---------------------------------------------------------------------------
// Internal heap entry
// ---------------------------------------------------------------------------

interface AStarEntry {
  vertexId: number;
  /** f = g + h */
  f: number;
  /** g = cost from source */
  g: number;
  seq: number;
}

function entryComparator(a: AStarEntry, b: AStarEntry): number {
  if (a.f !== b.f) return a.f - b.f;
  return a.seq - b.seq;
}

// ---------------------------------------------------------------------------
// Trace step
// ---------------------------------------------------------------------------

export interface AStarStep {
  readonly type: TraceStepType;
  readonly vertex?: number;
  readonly edge?: string;
  readonly g?: number;
  readonly h?: number;
  readonly f?: number;
  readonly counters: OperationCounters;
}

export type OnAStarStep = (step: AStarStep) => void;

// ---------------------------------------------------------------------------
// Heuristic builder
// ---------------------------------------------------------------------------

/**
 * Compute minCostPerMetre across all non-blocked edges for the given preset.
 * Returns 0 if no valid ratio exists.
 */
function buildMinCostPerMetre(graph: TrackGraph, preset: CostPreset | CostWeights): number {
  let min = Infinity;
  for (const edge of graph.getEdges()) {
    if (edge.status === 'Blocked') continue;
    if (edge.distance <= 0) continue;
    const cost = computeEdgeCost(edge, preset);
    const ratio = cost / edge.distance;
    if (ratio < min) min = ratio;
  }
  return isFinite(min) ? min : 0;
}

/** Euclidean distance between two vertices (using their x,y layout coordinates). */
function euclidean(graph: TrackGraph, u: number, v: number): number {
  const vu = graph.getVertex(u);
  const vv = graph.getVertex(v);
  if (!vu || !vv) return 0;
  const dx = vu.x - vv.x;
  const dy = vu.y - vv.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// astar
// ---------------------------------------------------------------------------

/**
 * Run A* from `source` to `target`.
 *
 * @param graph           - Live track graph.
 * @param source          - Start vertex id.
 * @param target          - Goal vertex id.
 * @param preset          - Cost profile or custom CostWeights.
 * @param activeEffects   - In-flight event effects.
 * @param onStep          - Optional trace callback.
 * @returns RouteResult on success, null if unreachable.
 */
export function astar(
  graph: TrackGraph,
  source: number,
  target: number,
  preset: CostPreset | CostWeights,
  activeEffects: readonly ActiveEffect[] = [],
  onStep?: OnAStarStep,
): RouteResult | null {
  const counters: OperationCounters = {
    expandedVertices: 0,
    relaxedEdges: 0,
    heapOps: 0,
    comparisons: 0,
  };

  const minCPM = buildMinCostPerMetre(graph, preset);

  // h(u): admissible heuristic
  function h(u: number): number {
    if (minCPM === 0) return 0;
    return euclidean(graph, u, target) * minCPM;
  }

  // g[v] = best known cost from source to v
  const g = new Map<number, number>();
  const parent = new Map<number, { vertex: number; edgeId: string }>();
  const closed = new Set<number>();

  let seq = 0;
  const heap = new MinHeap<AStarEntry>(entryComparator);

  g.set(source, 0);
  const hSource = h(source);
  heap.push({ vertexId: source, f: hSource, g: 0, seq: seq++ });
  counters.heapOps++;

  if (onStep) {
    onStep({ type: 'push', vertex: source, g: 0, h: hSource, f: hSource, counters: { ...counters } });
  }

  while (!heap.isEmpty) {
    const entry = heap.pop()!;
    counters.heapOps++;

    // Lazy deletion
    counters.comparisons++;
    if ((g.get(entry.vertexId) ?? Infinity) < entry.g) continue;
    if (closed.has(entry.vertexId)) continue;
    closed.add(entry.vertexId);
    counters.expandedVertices++;

    if (onStep) {
      onStep({
        type: 'pop',
        vertex: entry.vertexId,
        g: entry.g,
        h: entry.f - entry.g,
        f: entry.f,
        counters: { ...counters },
      });
    }

    if (entry.vertexId === target) break;

    for (const edge of graph.getNeighbors(entry.vertexId)) {
      if (closed.has(edge.to)) continue;

      const edgeCost = computeEdgeCost(edge, preset, activeEffects);
      counters.relaxedEdges++;
      const newG = entry.g + edgeCost;
      counters.comparisons++;

      const bestG = g.get(edge.to) ?? Infinity;
      counters.comparisons++;
      if (newG < bestG) {
        g.set(edge.to, newG);
        parent.set(edge.to, { vertex: entry.vertexId, edgeId: edge.id });
        const hTo = h(edge.to);
        heap.push({ vertexId: edge.to, f: newG + hTo, g: newG, seq: seq++ });
        counters.heapOps++;

        if (onStep) {
          onStep({
            type: 'relax',
            vertex: edge.to,
            edge: edge.id,
            g: newG,
            h: hTo,
            f: newG + hTo,
            counters: { ...counters },
          });
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

  if (!closed.has(target)) return null;

  return _reconstruct(graph, source, target, parent, g.get(target)!);
}

// ---------------------------------------------------------------------------
// Path reconstruction (shared with dijkstra pattern)
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

  let distance = 0;
  let time = 0;
  let fuelNeeded = 0;

  for (const eid of edgeIds) {
    const edge = graph.getEdge(eid);
    if (!edge) continue;
    const realEdge = eid.endsWith('~rev') ? graph.getEdge(eid.slice(0, -4)) ?? edge : edge;
    distance   += realEdge.distance;
    time       += realEdge.baseTime;
    fuelNeeded += realEdge.fuelCost;
  }

  return { path: pathVertices, edgeIds, distance, time, scalarCost, fuelNeeded };
}
