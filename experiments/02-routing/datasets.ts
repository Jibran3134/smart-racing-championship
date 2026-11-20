/**
 * Experiment 2 Datasets — Routing (Dijkstra vs A*).
 * Generates geometric 2D graphs with non-negative edge costs and Euclidean layout.
 */

import { TrackGraph } from '../../src/core/graph/TrackGraph';
import type { Vertex, Edge } from '../../src/core/types';
import { random } from '../shared/random';

export const routingFamilies = ['geometric-grid', 'dense-network', 'long-corridor'] as const;
export type RoutingFamily = typeof routingFamilies[number];

export interface RoutingDataset {
  graph: TrackGraph;
  vertices: Vertex[];
  edges: Edge[];
  source: number;
  target: number;
  size: number;
  family: RoutingFamily;
  seed: number;
}

export function routingDataset(size: number, family: RoutingFamily, seed: number): RoutingDataset {
  const next = random(seed);
  const vertices: Vertex[] = [];
  const edges: Edge[] = [];

  // Generate 2D spatial layout
  const side = Math.ceil(Math.sqrt(size));
  for (let i = 0; i < size; i++) {
    let x: number;
    let y: number;

    if (family === 'geometric-grid') {
      const col = i % side;
      const row = Math.floor(i / side);
      x = col * 80 + Math.floor(next() * 20);
      y = row * 80 + Math.floor(next() * 20);
    } else if (family === 'long-corridor') {
      x = i * 40;
      y = 200 + (i % 2 === 0 ? 30 : -30) + Math.floor(next() * 15);
    } else {
      // dense-network
      x = Math.floor(next() * 800);
      y = Math.floor(next() * 600);
    }

    vertices.push({
      id: i,
      x,
      y,
      type: i === 0 ? 'Start' : i === size - 1 ? 'Finish' : 'Intersection',
      active: true,
    });
  }

  // Connect edges
  let edgeId = 1;
  const edgeSet = new Set<string>();

  const addEdge = (u: number, v: number) => {
    if (u === v) return;
    const key = `${Math.min(u, v)}:${Math.max(u, v)}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);

    const vu = vertices[u];
    const vv = vertices[v];
    const dist = Math.max(10, Math.round(Math.hypot(vv.x - vu.x, vv.y - vu.y)));
    const baseTime = Math.max(1, Math.round(dist / 15));
    const fuelCost = Math.max(1, Math.round(dist / 30));
    const difficulty = 1 + (Math.floor(next() * 5));

    edges.push({
      id: `e-${edgeId++}`,
      from: u,
      to: v,
      distance: dist,
      baseTime,
      fuelCost,
      difficulty,
      status: 'Open',
      directed: false,
      isShortcut: false,
    });
  };

  // Ensure connectivity along the spine
  for (let i = 0; i < size - 1; i++) {
    addEdge(i, i + 1);
  }

  // Additional cross edges based on family
  if (family === 'geometric-grid') {
    for (let i = 0; i < size - side; i++) {
      if (next() < 0.8) addEdge(i, i + side);
    }
  } else if (family === 'dense-network') {
    for (let i = 0; i < size; i++) {
      for (let j = i + 1; j < size; j++) {
        const d = Math.hypot(vertices[i].x - vertices[j].x, vertices[i].y - vertices[j].y);
        if (d < 180 && next() < 0.4) {
          addEdge(i, j);
        }
      }
    }
  } else if (family === 'long-corridor') {
    // Shortcuts jumping 2 or 3 steps ahead
    for (let i = 0; i < size - 3; i++) {
      if (next() < 0.3) addEdge(i, i + 3);
    }
  }

  const graph = new TrackGraph(vertices, edges);

  return {
    graph,
    vertices,
    edges,
    source: 0,
    target: size - 1,
    size,
    family,
    seed,
  };
}
