# Alishba's Implementation Plan & Master Checklist

Scope: Alishba's responsibilities from `DAA Project division.docx`, `Project.pdf`, and `AGENTS.md`.  
Target deadline: 5 December 2026, 11:59 PM (Asia/Karachi).  
Status: **100% Implemented & Verified**.

---

## Milestone 1: Shared Interface Contract & Configuration Agreement
*Target: Day 1 (Must be agreed upon with Jibran before freezing)*

- [x] **1.1 Jointly finalize and populate `src/core/types.ts`**
  - [x] Define `VertexType` enum (`'Start' | 'Finish' | 'Checkpoint' | 'Intersection' | 'FuelStation' | 'NitroPickup' | 'DeadEnd'`)
  - [x] Define `Vertex` interface (`id: number`, `x: number`, `y: number`, `type: VertexType`, `checkpointOrder?: number`, `active: boolean`)
  - [x] Define `EdgeStatus` enum (`'Open' | 'Blocked' | 'Restricted'`)
  - [x] Define `Edge` interface (`id: string`, `from: number`, `to: number`, `distance: number`, `baseTime: number`, `fuelCost: number`, `difficulty: number` [1–5], `status: EdgeStatus`, `isShortcut: boolean`, `directed: boolean`, `speedCap?: number`)
  - [x] Define `Racer` interface (`id: string`, `name: string`, `isHuman: boolean`, `strategyType: 'player' | 'main-route' | 'shortcut' | 'shortest-distance'`, `currentVertex: number`, `fuel: number`, `nitroCharges: number`, `lap: number`, `nextCheckpoint: number`, `totalTime: number`, `status: 'racing' | 'finished' | 'dnf'`)
  - [x] Define `RaceResult` interface (`raceId: string`, `racerId: string`, `finishPosition: number`, `finishTime: number | null`, `fastestLap: number | null`, `bonusPoints: number`, `pointsAwarded: number`, `dnfReason?: string`)
  - [x] Define `ChampionshipEntry` interface (`racerId: string`, `totalPoints: number`, `wins: number`, `sumOfFinishPositions: number`, `bestFastestLap: number | null`)
  - [x] Define `RouteResult` interface (`path: number[]`, `edgeIds: string[]`, `distance: number`, `time: number`, `scalarCost: number`, `fuelNeeded: number`)
  - [x] Define `CostPreset` type (`'Balanced' | 'Speed' | 'Economy' | 'Safety'`) and `CostWeights` interface
  - [x] Define `AlgorithmTraceStep` and `OperationCounters` (`expandedVertices`, `relaxedEdges`, `heapOps`, `comparisons`)

- [x] **1.2 Jointly finalize and populate `src/core/config.ts`**
  - [x] Tank capacity: `MAX_FUEL = 100` units
  - [x] Fuel consumption multiplier: `1.0 + 0.1 * (difficulty - 1)`
  - [x] Station refuel rate: up to `MAX_STATION_PURCHASE = 40` units per stop
  - [x] Fixed pit stop time penalty (`REFUEL_STOP_SECONDS = 2`) for any positive fuel purchase
  - [x] Nitro configuration: `MAX_NITRO = 3` charges, boost multiplier `1.5x` speed for `4` seconds, fuel consumption `2x` while active
  - [x] Lap configuration: default `2` or `3` laps
  - [x] Championship points table: `POINTS_TABLE = [0, 25, 18, 15, 12, 10, 8, 6, 4, 2, 1]` for positions 1–10
  - [x] Normalization reference denominators ($D_{\text{ref}} = 500$, $T_{\text{ref}} = 60$, $F_{\text{ref}} = 20$, $R_{\text{ref}} = 5$) for scalar cost
  - [x] Preset weight definitions for Balanced, Speed, Economy, and Safety

---

## Milestone 2: Graph Model & Dynamic Mutation (`src/core/graph/`)

- [x] **2.1 Adjacency List Graph Implementation (`src/core/graph/TrackGraph.ts`)**
  - [x] Adjacency list representation supporting directed and undirected edges
  - [x] Node and edge lookup by ID in $O(1)$
  - [x] Query methods: `getVertices()`, `getEdges()`, `getNeighbors(vertexId)`
  - [x] Neighbor iteration excluding blocked edges when calculating routes
- [x] **2.2 Dynamic Graph Mutation (Without Rebuilding)**
  - [x] `blockEdge(edgeId: string): void` (excludes edge from routing)
  - [x] `unblockEdge(edgeId: string): void` (restores edge availability)
  - [x] `setEdgeRestriction(edgeId: string, speedCap?: number, difficultyPenalty?: number): void`
  - [x] `setStationActive(vertexId: number, active: boolean): void`
  - [x] `setShortcutStatus(edgeId: string, open: boolean): void`
- [x] **2.3 Multi-Objective Cost Function & Presets (`src/core/graph/cost.ts`)**
  - [x] Implement scalar edge cost formula with normalization denominators
  - [x] Ensure non-negative edge costs under all conditions
  - [x] Displayed cost exactly matches the algorithm's optimized cost
  - [x] Preset configurations:
    - **Balanced:** Equal moderate weights across all criteria
    - **Speed:** High time weight, low fuel weight
    - **Economy:** High fuel weight, moderate time weight
    - **Safety:** High difficulty penalty ($w_r$) and obstacle penalty ($w_o$)

---

## Milestone 3: Route Optimization Algorithms (`src/core/algorithms/routing/`)

- [x] **3.1 Hand-written Dijkstra's Algorithm (`src/core/algorithms/routing/dijkstra.ts`)**
  - [x] Uses shared `MinHeap` from `src/core/structures/MinHeap.ts`
  - [x] Returns optimal shortest path for non-negative scalar weights
  - [x] Handles edge cases: source equals target, unreachable target, zero-weight edges
  - [x] Exposes operation counters: `expandedVertices`, `relaxedEdges`, `heapOps`, `comparisons`
  - [x] Supports optional step-by-step trace callback for Algorithm Lab
- [x] **3.2 Hand-written A\* Search (`src/core/algorithms/routing/astar.ts`)**
  - [x] Admissible and consistent Euclidean distance lower-bound heuristic:
    $$h(u, v) = \text{EuclideanDistance}(u, v) \times \min_{e \in E} \left(\frac{\text{cost}(e)}{\text{distance}(e)}\right)$$
  - [x] Fallback to $h=0$ if valid positive ratio cannot be determined
  - [x] Exposes identical operation counters and trace step callbacks as Dijkstra
  - [x] Consistent heuristic avoids reopening closed vertices
- [x] **3.3 Checkpoint-Aware Leg Planner (`src/core/algorithms/routing/legPlanner.ts`)**
  - [x] Decomposes route into sequential legs: $\text{Current} \to \text{CP}_1 \to \text{CP}_2 \to \dots \to \text{Finish}$
  - [x] Preserves mandatory checkpoint order (never skips a checkpoint)
  - [x] Multi-lap support: routes from last checkpoint back across the Start/Finish line
  - [x] Dynamic recalculation: re-plans remaining legs upon road blockages or cost updates

---

## Milestone 4: Resource Management (`src/core/algorithms/resources/`)

- [x] **4.1 Hand-written 0/1 Knapsack DP with Reconstruction (`src/core/algorithms/resources/knapsackDP.ts`)**
  - [x] Inputs: item array with discrete cost $c_i$, benefit $v_i$, and total budget $B$
  - [x] Recurrence relation: $\text{dp}[i][b] = \max(\text{dp}[i-1][b], \text{dp}[i-1][b - c_i] + v_i)$
  - [x] Base cases handled: $\text{dp}[0][b] = 0$
  - [x] Backtracking table reconstruction to retrieve selected items
  - [x] Exposes DP state count ($m \times B$)
  - [x] Verification: exact match with exhaustive search / brute force on small instances ($n \le 15$)
- [x] **4.2 Hand-written Greedy Resource Heuristic (`src/core/algorithms/resources/greedyKnapsack.ts`)**
  - [x] Sorts candidates by benefit-to-cost ratio $v_i / c_i$ descending
  - [x] Handles zero-cost items: pre-selects zero-cost positive-benefit items
  - [x] Deterministic tie-breaking: lower item ID on equal ratio
  - [x] Demonstrates suboptimality on standard counterexample:
    - Items: $A(c=6, v=30)$, $B(c=5, v=24)$, $C(c=5, v=24)$, Budget $10 \implies$ Greedy picks $A$ (30); DP picks $B+C$ (48)
- [x] **4.3 Refuelling DP (Problem B Extension) (`src/core/algorithms/resources/refuelingDP.ts`)**
  - [x] Formulates minimum stop-time state $\text{dp}[j][f]$ across ordered stations $0 \dots m$
  - [x] Discrete fuel units with bounded purchase $0 \le a \le \min(1000 - f, 400)$
  - [x] Fixed stop-time penalty for $a > 0$
- [x] **4.4 Resource Recommendation Provider (`src/core/resources/ResourceAdvisor.ts`)**
  - [x] Connects to race setup UI contract via `getRecommendations(request)`
  - [x] Feasibility check: verifies tank capacity, fuel reachability, pickup availability
  - [x] Never recommends physically infeasible plans

---

## Milestone 5: Sorting & Championship Ranking (`src/core/algorithms/sorting/` & `src/core/championship/`)

- [x] **5.1 Common Total Order Comparator (`src/core/championship/comparator.ts`)**
  - [x] Evaluates ties in strict hierarchical order:
    1. Higher `totalPoints` (DESC)
    2. Higher `wins` (DESC)
    3. Lower `sumOfFinishPositions` (ASC)
    4. Lower `bestFastestLap` time (ASC)
    5. Lower `racerId` (ASC, deterministic final tie-breaker)
  - [x] Shared across all sorting methods, top-$k$ retrieval, and leaderboard displays
- [x] **5.2 Hand-written Merge Sort (`src/core/algorithms/sorting/mergeSort.ts`)**
  - [x] Stable $O(n \log n)$ divide-and-conquer implementation with $O(n)$ auxiliary array
  - [x] Tracks comparison counters
- [x] **5.3 Hand-written Quick Sort (`src/core/algorithms/sorting/quickSort.ts`)**
  - [x] In-place 3-way Dutch National Flag partitioning for duplicate keys
  - [x] Median-of-three pivot selection
  - [x] Tracks comparison and swap counts
- [x] **5.4 Hand-written Heap Sort (`src/core/algorithms/sorting/heapSort.ts`)**
  - [x] In-place $O(n \log n)$ array-based heap sort
  - [x] Sift-down heap construction $O(n)$ + repeated extraction $O(n \log n)$
- [x] **5.5 Live Top-\(k\) Analytics with Priority Queue (`src/core/algorithms/sorting/topK.ts`)**
  - [x] Size-$k$ min-heap implementation for $O(n \log k)$ top-$k$ extraction
  - [x] Proves top-$k$ output exactly matches the first $k$ entries of full Merge Sort
- [x] **5.6 Championship System (`src/core/championship/ChampionshipManager.ts`)**
  - [x] Points allocation table: positions 1–10 receive `[25, 18, 15, 12, 10, 8, 6, 4, 2, 1]` points
  - [x] Accumulates cumulative season statistics across multi-race calendar
  - [x] Handles DNF racers (0 points, last position, recorded reason)

---

## Milestone 6: Race Engine & Deterministic Opponents (`src/core/engine/`)

- [x] **6.1 Race Engine Simulation Loop (`src/core/engine/RaceEngine.ts`)**
  - [x] Implements `step(dt: number)` and `getState()`
  - [x] Progress tracking: current edge traversal, progress percentage, distance covered
  - [x] Laps & checkpoints: checks that checkpoints are cleared in mandatory order
  - [x] Fuel dynamics: consumes $F(e) \times (1.0 + 0.1 \times (\text{difficulty} - 1))$; doubles fuel burn while nitro active
  - [x] Nitro dynamics: boosts speed to $1.5\times$ for 4 seconds; decrements charges
  - [x] Pit stops: applies fixed stop time penalty; refuels up to 40 units at active fuel stations
  - [x] DNF handling: flags racer DNF if fuel hits zero
  - [x] Integration with Jibran's `EventProcessor`: pops due events each tick and applies dynamic edge/station mutations
- [x] **6.2 Three Deterministic Opponent Bots (`src/core/engine/opponents/`)**
  - [x] **Bot 1 (Main Route Follower):** Follows fixed route; detours only on closure; refuels below 25% fuel
  - [x] **Bot 2 (Shortcut User):** Takes designated shortcuts when open; falls back to main route when closed; refuels below 25% fuel
  - [x] **Bot 3 (Shortest-Distance Router):** Continuously routes via shortest distance; recalculates on closures; refuels below 25% fuel

---

## Milestone 7: Track Circuits, Procedural Generation & Validation (`src/core/generation/`)

- [x] **7.1 Three Official Playable Circuit Topologies (`src/data/tracks/`)**
  - [x] **Circuit 1 (Grand Prix Raceway):** `circuit-grand-prix.json`
  - [x] **Circuit 2 (Desert Canyon):** `circuit-desert-canyon.json`
  - [x] **Circuit 3 (City Grid):** `circuit-city-grid.json`
  - [x] *Each circuit satisfies:*
    - [x] $\ge 10$ mandatory checkpoints in designated order
    - [x] $\ge 2$ designated shortcut edges
    - [x] At least 1 cycle / alternative route
    - [x] At least 1 dead-end branch
    - [x] Fuel stations and nitro pickups placed strategically
- [x] **7.2 Procedural Generator: Spanning Tree Backbone (`src/core/algorithms/mst/mst.ts`)**
  - [x] Hand-written Prim's algorithm using `MinHeap`
  - [x] Guarantees an undirected, connected, cycle-free MST backbone
- [x] **7.3 Procedural Generator: Extra Edges & Loops (`src/core/generation/TrackGenerator.ts`)**
  - [x] Adds chords to introduce cycles and shortcuts
- [x] **7.4 Backtracking Constraint Placement (`src/core/algorithms/backtracking/trackPlacement.ts`)**
  - [x] Places checkpoints (in sequence), fuel stations, nitro pickups, and obstacles
  - [x] Explicit pruning: minimum fuel station spacing, degree constraints
- [x] **7.5 Track Validator (`src/core/generation/TrackValidator.ts`)**
  - [x] Validates ordered checkpoint reachability ($\text{Start} \to \text{CP}_1 \to \dots \to \text{CP}_{10} \to \text{Finish}$)
  - [x] Validates lap return loop
  - [x] Validates fuel feasibility
- [x] **7.6 Advanced Challenge 1 Implementation**
  - [x] Rejection check: rejects invalid candidate graphs with explicit rejection reasons

---

## Milestone 8: Experiments Assigned to Alishba (`experiments/`)

- [x] **8.1 Experiment 2: Routing Performance — Dijkstra vs. A\* (`experiments/02-routing/`)**
  - [x] Script: `experiments/02-routing/run.ts`
  - [x] Datasets: `experiments/02-routing/datasets.ts`
  - [x] Verifies cost equality: $\text{Cost}(\text{Dijkstra}) == \text{Cost}(A^*)$
  - [x] Integrated into master runner `experiments/run.ts`
- [x] **8.2 Experiment 3: Resource Allocation — DP vs. Greedy (`experiments/03-resources/`)**
  - [x] Script: `experiments/03-resources/run.ts`
  - [x] Datasets: `experiments/03-resources/datasets.ts`
  - [x] Benchmarks against exhaustive search on small cases ($n \le 10$)
  - [x] Integrated into master runner `experiments/run.ts`
- [x] **8.3 Experiment 5: Sorting & Ranking Performance (`experiments/05-ranking/`)**
  - [x] Script: `experiments/05-ranking/run.ts`
  - [x] Datasets: `experiments/05-ranking/datasets.ts`
  - [x] Evaluates Merge, Quick, Heap sort and Top-k
  - [x] Integrated into master runner `experiments/run.ts`
- [x] **8.4 Advanced Challenge 3 Implementation**
  - [x] Live top-$k$ championship analytics using a size-$k$ min-heap

---

## Milestone 9: Testing Suite & Quality Verification (`tests/`)

- [x] **9.1 Graph & Cost Unit Tests (`tests/unit/graph.test.ts`)**
- [x] **9.2 Routing Unit Tests (`tests/unit/routing.test.ts`)**
- [x] **9.3 Resource Planning Unit Tests (`tests/unit/resources.test.ts`)**
- [x] **9.4 Sorting & Ranking Unit Tests (`tests/unit/sorting.test.ts`)**
- [x] **9.5 Track Generation & Validator Tests (`tests/unit/generation.test.ts`)**
- [x] **9.6 Full Race Integration Tests (`tests/integration/race-engine.test.ts`)**
- [x] **9.7 Production UI Integration Tests (`tests/unit/adapters.test.ts`)**

---

## Milestone 10: Technical Report Sections & Final Deliverables

- [x] **10.1 Report Contribution Draft (`docs/report/alishba-contribution.md`)**
  - [x] Section 4: Data Models & Game Mechanics
  - [x] Section 5: Algorithm Design & Analysis for all 9 algorithms
  - [x] Section 8: Experimental Studies for Experiments 2, 3, and 5
  - [x] Section 9: Advanced Challenges 1 and 3
- [x] **10.2 Full Application Integration Layer (`src/adapters/index.ts`)**
  - [x] `productionPresetProvider` wired with real Dijkstra cost optimization across all 4 presets
  - [x] `productionChampionshipProvider` wired with ChampionshipManager (Merge, Quick, Heap sort & Top-k)
  - [x] `productionRaceSetupProvider` wired with Grand Prix, Desert Canyon, City Grid, and live RaceEngine
  - [x] `productionLabAlgorithms` connecting all 10 remaining algorithms to Algorithm Lab (zero disabled algorithms)
- [x] **10.3 Quality Verification Checks**
  - [x] `npm run typecheck` passes with 0 errors
  - [x] `npm run lint` passes with 0 errors and 0 warnings (`--max-warnings 0`)
  - [x] `npm test` passes all 161 tests across 28 test suites
  - [x] `npm run build` bundles successfully
  - [x] All 5 experiments run and generate reproducible output files
