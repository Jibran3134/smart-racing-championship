/**
 * Prim's Minimum Spanning Tree (MST) Algorithm — Alishba (Milestone 7).
 *
 * Computes an undirected MST backbone to ensure full connectivity.
 * Reuses Jibran's generic MinHeap from src/core/structures/MinHeap.ts.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import { MinHeap } from '../../structures/MinHeap';
import type { Vertex, Edge, OperationCounters } from '../../types';

export interface MSTResult {
  mstEdges: Edge[];
  totalWeight: number;
  counters: OperationCounters;
}

interface MSTHeapEntry {
  edge: Edge;
  weight: number;
  seq: number;
}

/**
 * Compute the Minimum Spanning Tree using Prim's algorithm.
 *
 * @param vertices       - List of track vertices.
 * @param candidateEdges - Undirected candidate edges connecting vertices.
 */
export function primMST(vertices: readonly Vertex[], candidateEdges: readonly Edge[]): MSTResult {
  const counters: OperationCounters = {
    expandedVertices: 0,
    relaxedEdges: 0,
    heapOps: 0,
    comparisons: 0,
  };

  if (vertices.length <= 1) {
    return { mstEdges: [], totalWeight: 0, counters };
  }

  // Build adjacency lookup
  const adj = new Map<number, Edge[]>();
  for (const v of vertices) {
    adj.set(v.id, []);
  }

  for (const e of candidateEdges) {
    adj.get(e.from)?.push(e);
    adj.get(e.to)?.push({
      ...e,
      id: `${e.id}~rev`,
      from: e.to,
      to: e.from,
    });
  }

  let seq = 0;
  const heap = new MinHeap<MSTHeapEntry>((a, b) => {
    counters.comparisons++;
    if (a.weight !== b.weight) return a.weight - b.weight;
    return a.seq - b.seq; // tie-breaker
  });

  const visited = new Set<number>();
  const mstEdges: Edge[] = [];
  let totalWeight = 0;

  // Start with the first vertex
  const startVertex = vertices[0].id;
  visited.add(startVertex);
  counters.expandedVertices++;

  for (const edge of adj.get(startVertex) ?? []) {
    heap.push({ edge, weight: edge.distance, seq: seq++ });
    counters.heapOps++;
  }

  while (!heap.isEmpty && visited.size < vertices.length) {
    const entry = heap.pop()!;
    counters.heapOps++;

    const { edge } = entry;
    const dest = edge.to;

    if (visited.has(dest)) continue;

    visited.add(dest);
    mstEdges.push(edge);
    totalWeight += edge.distance;
    counters.expandedVertices++;

    for (const nextEdge of adj.get(dest) ?? []) {
      if (!visited.has(nextEdge.to)) {
        heap.push({ edge: nextEdge, weight: nextEdge.distance, seq: seq++ });
        counters.heapOps++;
        counters.relaxedEdges++;
      }
    }
  }

  const hc = heap.counters;
  counters.heapOps = hc.heapOps;
  counters.comparisons += hc.comparisons;

  return { mstEdges, totalWeight, counters };
}
