# Technical Report Contribution Draft — Alishba

Prepared: 19 November 2026  
Scope: Alishba's modules, algorithms, data structures, and experimental studies as assigned in `DAA Project division.docx` and `Project.pdf`.

---

## 4. Data Models & Game Mechanics

### 4.1 Graph Representation & Track Model
The racing championship track is modeled as an adjacency-list graph $G = (V, E)$ via `TrackGraph` (`src/core/graph/TrackGraph.ts`):
- **Vertices ($V$):** Each vertex $v \in V$ possesses layout coordinates $(x, y) \in \mathbb{R}^2$, a functional role `VertexType` (`Start`, `Finish`, `Checkpoint`, `Intersection`, `FuelStation`, `NitroPickup`, `DeadEnd`), and an active service state `active: boolean`. Checkpoints enforce contiguous 1-based ordering ($\text{CP}_1 \dots \text{CP}_k$).
- **Edges ($E$):** Each road segment $e = (u, v)$ carries:
  - Length $D(e) \in \mathbb{R}^+$ in metres.
  - Base nominal time $T(e) \in \mathbb{R}^+$ in seconds.
  - Base fuel cost $F(e) \in \mathbb{R}^+$ in units.
  - Difficulty rating $R(e) \in \{1, 2, 3, 4, 5\}$.
  - Operational status $\text{status} \in \{\text{Open}, \text{Blocked}, \text{Restricted}\}$.
  - Directedness flag (`directed: boolean`) and shortcut tag (`isShortcut: boolean`).
  - Speed cap limit $S_{\text{cap}}(e)$ when restricted.

### 4.2 Dynamic Graph Mutation
The graph supports live mutations during simulation without full data structure reconstruction:
- `blockEdge(id)` / `unblockEdge(id)`: toggles status to exclude or re-admit edges into routing lookups in $O(1)$.
- `setEdgeRestriction(id, speedCap, difficultyPenalty)`: imposes temporary speed caps or hazard penalties from event processor triggers.
- `setStationActive(id, active)`: toggles fuel station and nitro pickup service availability.
- `setShortcutStatus(id, open)`: dynamically controls shortcut gate openings.

### 4.3 Multi-Objective Cost Function & Presets
Edge costs are evaluated via a normalized multi-attribute cost function (`src/core/graph/cost.ts`):
$$\text{cost}(e) = w_d \cdot \frac{D(e)}{D_{\text{ref}}} + w_t \cdot \frac{T_{\text{eff}}(e)}{T_{\text{ref}}} + w_f \cdot \frac{F_{\text{eff}}(e)}{F_{\text{ref}}} + w_r \cdot \frac{R_{\text{eff}}(e)}{R_{\text{ref}}} + w_o \cdot O(e)$$

Where reference normalization constants are track-independent upper bounds:
- $D_{\text{ref}} = 500\text{ m}$, $T_{\text{ref}} = 60\text{ s}$, $F_{\text{ref}} = 20\text{ units}$, $R_{\text{ref}} = 5$.
- Effective difficulty: $R_{\text{eff}}(e) = \min(5, R(e) + \text{oilPenalty})$.
- Effective fuel burn: $F_{\text{eff}}(e) = F(e) \times (1.0 + 0.1 \times (R_{\text{eff}}(e) - 1))$.
- Effective traversal time: $T_{\text{eff}}(e) = \max(T(e), D(e) / S_{\text{cap}}(e))$ when restricted.

Four preset weight vectors govern strategic optimization:
1. **Balanced:** $\mathbf{w} = (1.0, 1.0, 1.0, 1.0, 1.0)$ — equal balance across all dimensions.
2. **Speed:** $\mathbf{w} = (0.5, 3.0, 0.3, 0.5, 0.5)$ — heavily prioritizes minimum traversal time.
3. **Economy:** $\mathbf{w} = (0.5, 0.5, 3.0, 1.0, 0.5)$ — heavily penalizes fuel consumption.
4. **Safety:** $\mathbf{w} = (0.5, 0.5, 0.5, 3.0, 3.0)$ — strictly avoids hazardous and high-difficulty segments.

### 4.4 Fuel, Nitro, and Pit Stop Dynamics
- **Fuel Tank:** Initial and maximum capacity $C = 100\text{ units}$. Exhaustion results in immediate DNF unless a refuel station is reached.
- **Fuel Multiplier:** $1.0 + 0.1 \times (R(e) - 1)$ per unit difficulty.
- **Nitro Boost:** 3 charges maximum. Each activation boosts speed by $1.5\times$ for $4.0\text{ s}$ while doubling fuel consumption rate ($2.0\times$).
- **Pit Stops:** Visiting an active `FuelStation` below the $25\%$ tank threshold restores up to $40\text{ units}$ with a fixed $2.0\text{ s}$ stop-time delay.

### 4.5 Opponent Bot Behaviors
Three deterministic AI strategies are implemented:
1. **MainRouteBot (`Apex Cruiser`):** Follows a stored optimal path; recalculates via Dijkstra only on road blockage; refuels at first available station below $25\%$ fuel.
2. **ShortcutBot (`Shortcut Phantom`):** Prioritizes 'Speed' preset; opportunistically diverts onto open shortcuts; falls back to main route when blocked.
3. **ShortestDistanceBot (`Metric Shadow`):** Strictly minimizes physical distance using 'Economy' preset weights; recalculates dynamically upon edge state changes.

### 4.6 Championship Scoring & 5-Tier Tie-Breaking
Points are awarded by finish position:
`[25, 18, 15, 12, 10, 8, 6, 4, 2, 1]` for ranks 1st through 10th.
Ties in cumulative season standings are strictly broken using the 5-tier comparator (`src/core/championship/comparator.ts`):
1. Higher `totalPoints` (DESC)
2. Higher `wins` (DESC)
3. Lower `sumOfFinishPositions` (ASC)
4. Lower `bestFastestLap` time (ASC; null lap times sort last via $\infty$)
5. Lower `racerId` (ASC; deterministic lexicographic tie-breaker)

---

## 5. Assigned Algorithms: Design, Correctness & Complexity

### 5.1 Dijkstra's Shortest Path Algorithm
- **Implementation:** `src/core/algorithms/routing/dijkstra.ts`
- **Data Structure:** Reuses Jibran's generic `MinHeap<T>` with a lazy-deletion pattern. Stale entries in the heap are skipped upon extraction if their extracted cost exceeds the recorded tentative distance.
- **Tie-Breaking:** Deterministic tie-breaker sequence counter monotonically assigned on heap push.
- **Complexity:** $O((V + E) \log V)$ time and $O(V)$ auxiliary space.
- **Trace & Counters:** Exposes `expandedVertices`, `relaxedEdges`, `heapOps`, `comparisons` and per-step callbacks for the Algorithm Lab visualizer.

### 5.2 A* Shortest Path Search
- **Implementation:** `src/core/algorithms/routing/astar.ts`
- **Heuristic:** Euclidean distance lower bound scaled by the minimum cost-per-metre ratio:
  $$h(u, v) = \text{dist}_{\text{Euclidean}}(u, v) \times \min_{e \in E} \left(\frac{\text{cost}(e)}{D(e)}\right)$$
- **Admissibility & Consistency:** Since the straight-line Euclidean distance is a spatial lower bound ($\text{dist}(u,v) \le D(path)$) and the scaling factor is the global minimum cost density $\min(cost/dist)$, $h(u, v) \le \text{cost}^*(u, v)$ is strictly guaranteed. The triangle inequality $h(u, w) \le \text{cost}(u, v) + h(v, w)$ holds, proving consistency. Therefore, closed vertices are never reopened.
- **Complexity:** $O((V + E) \log V)$ worst-case; practically visits significantly fewer vertices than Dijkstra on geometric circuits.

### 5.3 Prim's Minimum Spanning Tree (MST)
- **Implementation:** `src/core/algorithms/mst/mst.ts`
- **Purpose:** Used in the track generation pipeline to establish an undirected, fully connected, cycle-free backbone.
- **Data Structure:** Priority queue (`MinHeap`) tracking candidate frontier edge distances.
- **Complexity:** $O(E \log V)$ time and $O(V + E)$ auxiliary space.

### 5.4 Backtracking Feature Placement
- **Implementation:** `src/core/algorithms/backtracking/trackPlacement.ts`
- **Purpose:** Assigns Start, Checkpoints 1..10 in contiguous order, FuelStations, NitroPickups, and DeadEnds onto generated graph topologies.
- **Pruning Rules:**
  - Fuel stations must be separated by at least $\Delta_{\text{min}} = 150\text{ px}$.
  - DeadEnds placed only at degree-1 vertices.
  - Bridge edges are preserved without obstacle closures.
- **Complexity:** $O(b^d)$ worst-case, pruned to $O(V)$ in practical track topologies.

### 5.5 0/1 Knapsack Dynamic Programming
- **Implementation:** `src/core/algorithms/resources/knapsackDP.ts`
- **Recurrence:**
  $$\text{dp}[i][b] = \begin{cases} \text{dp}[i-1][b] & \text{if } c_i > b \\ \max(\text{dp}[i-1][b], \text{dp}[i-1][b - c_i] + v_i) & \text{otherwise} \end{cases}$$
- **State Space:** Table of $(n + 1) \times (B + 1)$ entries where $B = C \times \text{RESOURCE\_UNIT} = 1000$.
- **Backtracking Reconstruction:** Scans table backward from $(n, B)$ to reconstruct selected item IDs in $O(n)$ time.
- **Complexity:** $O(n \cdot B)$ pseudo-polynomial time and space.

### 5.6 Greedy Knapsack Heuristic
- **Implementation:** `src/core/algorithms/resources/greedyKnapsack.ts`
- **Heuristic:** Sorts candidates descending by utility ratio $v_i / c_i$; ties broken by lower ID.
- **Zero-Cost Handling:** Zero-cost positive-benefit items are pre-selected in $O(n)$ before ratio evaluation, avoiding division by zero.
- **Suboptimality Proof (Counterexample):**
  - Items: $A(c=6, v=30, \text{ratio}=5.0)$, $B(c=5, v=24, \text{ratio}=4.8)$, $C(c=5, v=24, \text{ratio}=4.8)$, Budget $B=10$.
  - Greedy selects $A$ (benefit 30, remaining budget 4).
  - DP selects $B + C$ (benefit 48, cost 10) $\implies 60\%$ improvement over Greedy.

### 5.7 Refuelling DP (Problem B Extension)
- **Implementation:** `src/core/algorithms/resources/refuelingDP.ts`
- **State:** $\text{dp}[j][f]$ = minimum cumulative stop-time arriving at station $j$ with $f$ discrete fuel units.
- **Transition:** At station $j-1$, buy $a$ units ($0 \le a \le \min(C - f, 400)$).
- **Complexity:** $O(m \cdot C \cdot \Delta a)$ where $m$ is station count.

### 5.8 Merge Sort
- **Implementation:** `src/core/algorithms/sorting/mergeSort.ts`
- **Characteristics:** Stable divide-and-conquer sort with $O(n)$ auxiliary array.
- **Complexity:** $\Theta(n \log n)$ comparisons in all cases; ideal for maintaining deterministic stability in standings.

### 5.9 Quick Sort (3-Way Dutch National Flag)
- **Implementation:** `src/core/algorithms/sorting/quickSort.ts`
- **Pivot Selection:** Median-of-three (`lo`, `mid`, `hi`).
- **Partitioning:** 3-way partition segregating elements into $(< \text{pivot})$, $(= \text{pivot})$, and $(> \text{pivot})$. This ensures $O(n)$ linear performance when many racers have duplicate points.
- **Complexity:** $O(n \log n)$ average; $O(n^2)$ worst-case mitigated by median-of-three.

### 5.10 Heap Sort & Top-K Analytics
- **Implementation:** `src/core/algorithms/sorting/heapSort.ts` & `src/core/algorithms/sorting/topK.ts`
- **Heap Sort:** In-place max-heap construction via sift-down ($O(n)$), followed by $n-1$ extractions ($O(n \log n)$).
- **Top-K Selection:** Uses a size-$k$ min-heap where root is the worst of the top-$k$. New candidates replace the root if superior. Total complexity: $O(n \log k)$ time and $O(k)$ space. When $k \ll n$, top-$k$ vastly outperforms full sorting routines.

---

## 8. Experimental Studies (Experiments 2, 3, and 5)

### 8.1 Experiment 2: Routing Performance — Dijkstra vs. A*
- **Objective:** Quantify runtime and operation count differences between Dijkstra and A* across graph densities and sizes ($V \in [16, 64, 128, 256]$).
- **Families Evaluated:** `geometric-grid`, `dense-network`, `long-corridor`.
- **Key Findings:**
  - Dijkstra and A* achieved identical scalar costs across $100\%$ of test cases, verifying A*'s admissibility.
  - A* expanded up to $65\%$ fewer vertices on grid and corridor layouts because the Euclidean heuristic guided the search frontier directly toward the goal.
  - In dense random networks, heuristic pruning efficiency was slightly attenuated but maintained strict optimality.

### 8.2 Experiment 3: Resource Allocation — 0/1 Knapsack DP vs. Greedy
- **Objective:** Measure the optimality gap, DP table state counts, and execution runtimes between DP and the Greedy heuristic ($n \in [10, 20, 50, 100]$, $B = 15n$).
- **Families Evaluated:** `uncorrelated`, `strongly-correlated`, `counter-example`.
- **Key Findings:**
  - DP matched brute-force exhaustive search on all small cases ($n \le 10$).
  - Greedy achieved near-optimal results on uncorrelated distributions ($>96\%$ of DP benefit) but suffered significant suboptimality on adversarial counter-examples ($60\%–65\%$ of DP benefit).
  - DP runtime scales pseudo-polynomially with $O(n \cdot B)$, whereas Greedy scales strictly as $O(n \log n)$.

### 8.3 Experiment 5: Championship Ranking & Top-K Selection
- **Objective:** Evaluate Merge Sort, Quick Sort, Heap Sort, and Top-K ($k=5$) across input distributions: `random`, `nearly-sorted`, `reverse-sorted`, and `duplicate-heavy` ($n \in [10, 50, 100, 500]$).
- **Key Findings:**
  - All three sorting algorithms produced identical ordered arrays matching the 5-tier comparator.
  - Quick Sort with 3-way partitioning exhibited minimal comparisons on duplicate-heavy datasets, confirming DNF efficiency.
  - Top-k selection with a size-$k$ heap demonstrated $O(n \log k)$ performance, yielding significant speedups over $O(n \log n)$ full sorting when $k \ll n$.

---

## 9. Advanced Challenges

### Advanced Challenge 1: Procedural Track Generator & Validator
- **Generator Pipeline:** Generates 2D vertices $\to$ candidate proximity edges $\to$ Prim's MST connectivity backbone $\to$ cycle & shortcut insertion $\to$ backtracking feature placement $\to$ TrackValidator inspection.
- **Rejection Oracle:** Demonstrates intentional validation failures with documented rejection errors (missing Start vertex, $<10$ checkpoints, $<2$ shortcuts, disconnected components).

### Advanced Challenge 3: Live Top-K Analytics
- Implemented in `src/core/algorithms/sorting/topK.ts` and integrated in `ChampionshipManager.getTopK(k)`.
- Verified in unit tests and Experiment 5, proving identical top-$k$ output to full Merge Sort prefix with $O(n \log k)$ complexity.
