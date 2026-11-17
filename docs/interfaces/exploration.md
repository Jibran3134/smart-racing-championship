# Exploration handoff and provisional contracts

Implemented by Jibran in `src/core/algorithms/exploration/`. These read-only adapter interfaces are provisional and intentionally separate from the joint `types.ts`/`config.ts` contract. Review them with Alishba before adopting or freezing them in the graph model.

## Graph input

`ExplorationGraph` supplies `directed`, `getVertices()` and `getNeighbors(vertex)`. Vertices have integer IDs and optional `mandatory`; neighbors carry a destination vertex ID and a stable road/edge ID. The adapter must exclude blocked roads, respect one-way travel and return deterministic adjacency order. Restricted roads remain traversable. Vertex IDs need not be contiguous. IDs must be unique; every returned neighbor must reference a listed vertex. Algorithms reject unknown sources and malformed reached adjacency.

The UI adapter in `src/ui/adapters/exploration-adapter.ts` translates the layout fixture without creating a replacement engine graph. Alishba's adjacency-list model can directly supply this view. Do not rebuild the adjacency view inside every `getNeighbors` call: preprocessing should take O(V+E), with O(out-degree) neighbor iteration.

`directed` selects cycle semantics. Undirected views must expose both arcs of each road with the same edge ID; DFS skips only the reverse of its tree edge. Directed views detect ordinary directed cycles. For a mixed road network, the current adapter expands bidirectional roads to reciprocal directed arcs and uses directed cycle semantics; that includes two-arc cycles along a bidirectional road. This is not a claim that the physical track has an alternate road cycle. Agree on a mixed-network physical cycle definition before using this result for circuit validation.

## APIs

| Function | Output and scope |
| --- | --- |
| `bfs(graph, source, onStep?)` | Entire source-reachable order, parent vertices/edges and counters; tree paths minimize number of edges |
| `dfs(graph, source, onStep?)` | Iterative source-reachable traversal, parent vertices/edges, counters and reachable `hasCycle` |
| `reconstructPath(result, source, target)` | `{vertices, edges}` or null for an unreachable target |
| `connectedComponents(graph)` | All ordinary components for undirected input; weak components for directed input, not SCCs |
| `analyzeDeadEnds(graph, traversal, finish)` | Reachable non-mandatory vertices with no finish continuation after removing their DFS arrival edge |
| `alternativeRoutes(graph, source, target, mainEdges, limits)` | Simple candidate paths different from the main edge sequence, candidate-examination count and a conservative `truncated` flag |

BFS/DFS do not stop at one target: the Explorer also needs all reachable checkpoints. A source equal to the target has a zero-edge path. Invalid vertex IDs throw; valid but unreachable targets yield null from reconstruction and no candidate paths. Changing the road view and calling the functions again incorporates closures immediately. Paths here do not enforce race checkpoint order; Alishba's checkpoint-leg planner must apply that rule.

Alternative enumeration requires explicit positive integer `maxRoutes` and `maxExpansions`, and non-negative integer `maxEdges`. The Explorer uses four alternatives, fourteen edges per path, and two thousand examined neighbor candidates. All three bounds are displayed. `truncated` means a bound was encountered, not proof that another valid path exists. This search can be exponential without bounds; do not report it as a linear DFS traversal.

## Dead ends: explicit arrival context

The brief defines a non-mandatory vertex from which the finish cannot be reached without reversing. The reversal context is not fixed for an isolated vertex. The current analysis uses each vertex's DFS tree arrival edge: exclude that edge and search for a simple continuation to the selected finish. Mandatory vertices and the finish itself are excluded. The DFS root has no arrival edge. This convention is shown in the UI and needs joint review before becoming the game's dead-end rule.

Ordinary DFS remains O(V+E). Dead-end analysis performs a separate traversal for each reachable candidate, costing O(V(V+E)) worst-case time and O(V) additional working space. It is suitable for the small preview circuit and must not be included in the timed ordinary DFS study without explicitly declaring that extra workload.

## Counters and tracing

- `visitedVertices`: discovered vertices, including the source.
- `expandedVertices`: vertices whose adjacency exploration has started.
- `examinedEdges`: outgoing adjacency entries examined; an undirected road normally contributes two entries.
- `relaxedEdges`: successful first-discovery/tree edges, not weighted relaxation attempts.
- `comparisons`: explicit discovery/color membership decisions, one per examined adjacency entry. This is not a count of every internal JavaScript operation.
- `heapOps`: zero, since these traversals use a queue/stack rather than a heap.

The optional callback emits independent snapshots `{type, vertex?, edge?, counters, frontier, visited}`. Types use the division's `visit | relax | push | pop | done` envelope. `visited` contains expanded order. BFS frontier is next-first queue order; DFS frontier is bottom-to-top active stack order. Missing callback means no trace snapshot arrays are constructed.

Normal BFS, DFS and component traversal cost O(V+E) time and O(V) traversal working space (component symmetrization uses O(V+E)). Trace snapshots add O(KV) time/storage for K emitted frames and must be disabled for fair timings. `TracePlayer` consumes the common envelope plus optional frontier/visited snapshots; routing adapters can reuse the viewer once Alishba's modules arrive. A new run must remount/reset the player to discard old cursor/timer state.

## Correctness outline

**BFS:** enqueue the source, then repeatedly remove the next vertex and discover unvisited neighbors, recording each parent before enqueueing. FIFO expansion processes increasing edge distance, so each discovered parent path has minimum edge count. Mark on discovery to prevent duplicate queue entries.

**DFS:** push a frame containing the current adjacency cursor, color gray on entry and black on completion. Advance one arc at a time; enter only uncolored neighbors. A gray outgoing target is a back edge and detects a cycle under the chosen directed/undirected semantics. An explicit frame stack avoids recursive call-stack overflow.

**Alternatives:** maintain a path-local visited set; extend only to a vertex not already on the current path and undo membership on backtracking. Every emitted path is simple, uses legal arcs and ends at the requested target. Exclude the main edge sequence and stop when a configured bound is encountered.

Tests include singleton, branching, disconnected, cyclic, dead-end, directed/undirected and parallel/self-loop cases; minimum-edge versus weighted-distance behavior; deterministic independent traces; input errors; bounds; and a 15,000-vertex chain.
