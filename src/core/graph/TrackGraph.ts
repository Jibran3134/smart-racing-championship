/**
 * TrackGraph — Alishba's core graph data model.
 * Implements an adjacency-list directed graph over Vertex and Edge.
 * Also exposes an ExplorationGraph adapter for Jibran's BFS/DFS algorithms.
 *
 * Constraints (from Project.pdf §3.1–3.2 and AGENTS.md):
 *  - No UI/DOM/React imports.
 *  - Graph mutations MUST NOT rebuild internal structures from scratch.
 *  - All adjacency lookups are O(degree) or better.
 *  - Deterministic neighbor ordering: sorted by edge id (lexicographic).
 */

import type { Vertex, Edge, EdgeStatus } from '../types';
import type { ExplorationGraph, ExplorationVertex, ExplorationNeighbor } from '../algorithms/exploration/contracts';

// ---------------------------------------------------------------------------
// ActiveEffect — an in-flight event effect applied during routing
// ---------------------------------------------------------------------------

/**
 * A live event effect that may alter traversal cost for a specific edge.
 * Produced by EventProcessor and passed into cost computation.
 */
export interface ActiveEffect {
  /** Edge id this effect applies to. */
  edgeId: string;
  /** Additional difficulty to add (oil spill etc.). */
  difficultyPenalty?: number;
  /** Speed cap override for this edge (lower wins). */
  speedCap?: number;
}

// ---------------------------------------------------------------------------
// TrackGraph
// ---------------------------------------------------------------------------

export class TrackGraph {
  // Canonical vertex and edge storage
  private readonly _vertices: Map<number, Vertex> = new Map();
  private readonly _edges: Map<string, Edge> = new Map();

  // Adjacency list: fromVertex → sorted array of edge ids leaving that vertex.
  // For undirected edges, both directions are stored.
  private readonly _adj: Map<number, string[]> = new Map();

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  /**
   * @param vertices - unique vertex list; duplicate ids throw.
   * @param edges    - unique edge list; duplicate ids throw.
   *
   * Validation:
   *  - Vertex ids unique and non-negative.
   *  - Edge ids unique; from/to must reference existing vertices.
   *  - distance, baseTime ≥ 0; fuelCost ≥ 0; difficulty in [1,5].
   *  - Checkpoint orders: each present value is a unique positive integer.
   */
  constructor(vertices: readonly Vertex[], edges: readonly Edge[]) {
    this._validateAndStoreVertices(vertices);
    this._validateAndStoreEdges(edges);
  }

  // -------------------------------------------------------------------------
  // Read accessors
  // -------------------------------------------------------------------------

  /** All vertices in insertion order. */
  getVertices(): readonly Vertex[] {
    return Array.from(this._vertices.values());
  }

  /** All edges in insertion order. */
  getEdges(): readonly Edge[] {
    return Array.from(this._edges.values());
  }

  /** Look up a single vertex by id; returns undefined if not found. */
  getVertex(id: number): Vertex | undefined {
    return this._vertices.get(id);
  }

  /** Look up a single edge by id; returns undefined if not found. */
  getEdge(id: string): Edge | undefined {
    return this._edges.get(id);
  }

  /**
   * Returns the outgoing open (non-Blocked) edges from `vertexId` in
   * deterministic (lexicographic by edge id) order.
   * Caller must check status before using; this filters Blocked but keeps Restricted.
   */
  getNeighbors(vertexId: number): readonly Edge[] {
    const edgeIds = this._adj.get(vertexId) ?? [];
    const result: Edge[] = [];
    for (const eid of edgeIds) {
      const edge = this._edges.get(eid);
      if (edge && edge.status !== 'Blocked') {
        result.push(edge);
      }
    }
    return result;
  }

  /**
   * Returns ALL outgoing edges from a vertex regardless of status.
   * Used for validation and generation code.
   */
  getAllNeighborEdges(vertexId: number): readonly Edge[] {
    const edgeIds = this._adj.get(vertexId) ?? [];
    return edgeIds
      .map((eid) => this._edges.get(eid))
      .filter((e): e is Edge => e !== undefined);
  }

  // -------------------------------------------------------------------------
  // Dynamic mutation methods (MUST NOT rebuild the full adjacency list)
  // -------------------------------------------------------------------------

  /** Block an edge by id. Idempotent. Throws if edge not found. */
  blockEdge(id: string): void {
    const edge = this._requireEdge(id);
    (edge as { status: EdgeStatus }).status = 'Blocked';
    const rev = this._edges.get(`${id}~rev`);
    if (rev) (rev as { status: EdgeStatus }).status = 'Blocked';
  }

  /** Unblock a previously blocked edge. Idempotent. Throws if edge not found. */
  unblockEdge(id: string): void {
    const edge = this._requireEdge(id);
    (edge as { status: EdgeStatus }).status = 'Open';
    const rev = this._edges.get(`${id}~rev`);
    if (rev) (rev as { status: EdgeStatus }).status = 'Open';
  }

  /**
   * Apply a speed cap or difficulty penalty restriction to an edge.
   * Sets status to 'Restricted' and updates the optional speedCap field.
   * Pass undefined to remove an individual override.
   */
  setEdgeRestriction(
    id: string,
    speedCap?: number,
    difficultyPenalty?: number,
  ): void {
    const edge = this._requireEdge(id);
    const mutable = edge as {
      status: EdgeStatus;
      speedCap?: number;
      _difficultyPenalty?: number;
    };
    mutable.status = 'Restricted';
    if (speedCap !== undefined) mutable.speedCap = speedCap;
    if (difficultyPenalty !== undefined) mutable._difficultyPenalty = difficultyPenalty;

    const rev = this._edges.get(`${id}~rev`);
    if (rev) {
      const mutableRev = rev as {
        status: EdgeStatus;
        speedCap?: number;
        _difficultyPenalty?: number;
      };
      mutableRev.status = 'Restricted';
      if (speedCap !== undefined) mutableRev.speedCap = speedCap;
      if (difficultyPenalty !== undefined) mutableRev._difficultyPenalty = difficultyPenalty;
    }
  }

  /** Toggle a fuel station or nitro pickup vertex's active flag. Throws if not found. */
  setStationActive(vertexId: number, active: boolean): void {
    const vertex = this._requireVertex(vertexId);
    (vertex as { active: boolean }).active = active;
  }

  /**
   * Open or close a shortcut edge.
   * Opening sets status to 'Open'; closing sets it to 'Blocked'.
   * Throws if edge not found or if edge.isShortcut is false.
   */
  setShortcutStatus(edgeId: string, open: boolean): void {
    const edge = this._requireEdge(edgeId);
    if (!edge.isShortcut) {
      throw new Error(`Edge "${edgeId}" is not a shortcut.`);
    }
    (edge as { status: EdgeStatus }).status = open ? 'Open' : 'Blocked';
  }

  // -------------------------------------------------------------------------
  // ExplorationGraph adapter
  // -------------------------------------------------------------------------

  /**
   * Returns a lightweight ExplorationGraph view of this TrackGraph.
   * Jibran's BFS/DFS algorithms consume this interface.
   * The adapter reads live edge state so blocking an edge is reflected immediately.
   */
  toExplorationGraph(directed = true): ExplorationGraph {
    return {
      directed,
      getVertices: (): readonly ExplorationVertex[] =>
        this.getVertices().map((v) => ({
          id: v.id,
          mandatory: v.type === 'Checkpoint',
        })),
      getNeighbors: (vertex: number): readonly ExplorationNeighbor[] =>
        this.getNeighbors(vertex).map((e) => ({
          vertex: e.to,
          edge: e.id,
        })),
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _validateAndStoreVertices(vertices: readonly Vertex[]): void {
    const checkpointOrders = new Set<number>();
    for (const v of vertices) {
      if (v.id < 0 || !Number.isInteger(v.id)) {
        throw new Error(`Vertex id must be a non-negative integer; got ${v.id}.`);
      }
      if (this._vertices.has(v.id)) {
        throw new Error(`Duplicate vertex id: ${v.id}.`);
      }
      if (v.type === 'Checkpoint') {
        if (v.checkpointOrder === undefined || v.checkpointOrder <= 0) {
          throw new Error(`Checkpoint vertex ${v.id} must have a positive checkpointOrder.`);
        }
        if (checkpointOrders.has(v.checkpointOrder)) {
          throw new Error(`Duplicate checkpointOrder ${v.checkpointOrder} at vertex ${v.id}.`);
        }
        checkpointOrders.add(v.checkpointOrder);
      }
      this._vertices.set(v.id, { ...v });
      this._adj.set(v.id, []);
    }
    // Validate contiguous checkpoint ordering (1,2,3,...,n)
    if (checkpointOrders.size > 0) {
      for (let i = 1; i <= checkpointOrders.size; i++) {
        if (!checkpointOrders.has(i)) {
          throw new Error(`Checkpoint orders must be contiguous starting at 1; missing ${i}.`);
        }
      }
    }
  }

  private _validateAndStoreEdges(edges: readonly Edge[]): void {
    for (const e of edges) {
      if (this._edges.has(e.id)) {
        throw new Error(`Duplicate edge id: "${e.id}".`);
      }
      if (!this._vertices.has(e.from)) {
        throw new Error(`Edge "${e.id}" references unknown vertex ${e.from}.`);
      }
      if (!this._vertices.has(e.to)) {
        throw new Error(`Edge "${e.id}" references unknown vertex ${e.to}.`);
      }
      if (e.distance < 0 || !isFinite(e.distance)) {
        throw new Error(`Edge "${e.id}" distance must be ≥ 0 and finite.`);
      }
      if (e.baseTime < 0 || !isFinite(e.baseTime)) {
        throw new Error(`Edge "${e.id}" baseTime must be ≥ 0 and finite.`);
      }
      if (e.fuelCost < 0 || !isFinite(e.fuelCost)) {
        throw new Error(`Edge "${e.id}" fuelCost must be ≥ 0 and finite.`);
      }
      if (!Number.isInteger(e.difficulty) || e.difficulty < 1 || e.difficulty > 5) {
        throw new Error(`Edge "${e.id}" difficulty must be an integer in [1,5]; got ${e.difficulty}.`);
      }
      this._edges.set(e.id, { ...e });

      // Insert into adjacency list (lexicographic order maintained via sort)
      this._insertAdj(e.from, e.id);
      if (!e.directed) {
        // Undirected: also add reverse direction by wrapping as a virtual edge
        // We store a synthetic reverse-edge in the edge map with id `${e.id}~rev`
        const rev: Edge = {
          id: `${e.id}~rev`,
          from: e.to,
          to: e.from,
          distance: e.distance,
          baseTime: e.baseTime,
          fuelCost: e.fuelCost,
          difficulty: e.difficulty,
          status: e.status,
          isShortcut: e.isShortcut,
          directed: false,
          speedCap: e.speedCap,
        };
        this._edges.set(rev.id, rev);
        this._insertAdj(e.to, rev.id);
      }
    }
  }

  /** Insert edge id into adjacency list for a vertex, maintaining lex order. */
  private _insertAdj(vertexId: number, edgeId: string): void {
    const list = this._adj.get(vertexId);
    if (!list) {
      this._adj.set(vertexId, [edgeId]);
      return;
    }
    // Binary-insert for maintained sort
    let lo = 0;
    let hi = list.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (list[mid] < edgeId) lo = mid + 1;
      else hi = mid;
    }
    list.splice(lo, 0, edgeId);
  }

  private _requireVertex(id: number): Vertex {
    const v = this._vertices.get(id);
    if (!v) throw new Error(`Unknown vertex: ${id}.`);
    return v;
  }

  private _requireEdge(id: string): Edge {
    const e = this._edges.get(id);
    if (!e) throw new Error(`Unknown edge: "${id}".`);
    return e;
  }
}
