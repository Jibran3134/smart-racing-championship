# Full project brief review

Reviewed all 14 pages of `Project.pdf` against `DAA Project division.docx`, the implementation plan and the current scaffold on 17 November 2026. Page references below are PDF page numbers. This is a requirements review; it does not mark unimplemented features complete.

## Scope and assessment

The deadline is **5 December 2026, 11:59 PM** (p. 1). Submit one ZIP through Google Classroom, with the actual members' registration numbers and section in its name. The three-number example supports groups of up to three; a two-person group uses its actual two registration numbers (p. 2).

The application must provide three playable circuit topologies, at least ten mandatory checkpoints and two shortcuts per circuit, one human and at least three deterministic opponents, five accessible screen functions, twelve algorithm families and five experimental studies (pp. 2–3). Each circuit also needs intersections, alternative paths, a cycle, a dead end, difficulty variation, fuel stations, nitro pickups and dynamic obstacles/closures (p. 5).

The brief prioritizes correct modelling, hand-written algorithms, actual gameplay integration, analysis, tests and measurements over graphics. The Algorithm Lab must reuse gameplay implementations. All members must understand the complete project and attend the demonstration/viva (p. 2).

## Your assigned scope

The task division remains consistent with the brief: all five screens and shared visual components; BFS/DFS; generic heap; event scheduling/effect resolution; Lab playback/adapters; experiments 1 and 4; shared charts and exports; assigned report sections; package checks and submission. Alishba retains graph/routing/engine/resources/ranking/generation and experiments 2, 3 and 5. Shared types/configuration still require agreement.

The UI must expose instructions/settings, arbitrary start/destination selection, reachable checkpoints, alternative routes, route metrics, cars/resources/race time/events, algorithm stepping/counters, race results/standings/statistics and top-k. The race setup flow includes circuit selection and resource recommendations (pp. 2–3). Do not limit the Lab architecture to BFS/DFS; support the other algorithm families through adapters as their modules arrive.

## Data contract now supplied by the brief

Section 3 (pp. 3–5) specifies adjacency lists and these records:

| Record | Fields |
| --- | --- |
| Vertex | Integer `id`, `x`, `y`, `type`, optional `checkpointOrder`, service `active` |
| Edge | `id`, `from`, `to`, non-negative `distance`, `baseTime`, `fuelCost`, difficulty 1–5, `status`, `isShortcut`, `directed` |
| Racer | `id`, `name`, `isHuman`, `strategyType`, `currentVertex`, `fuel`, `nitroCharges`, `lap`, `nextCheckpoint`, `totalTime` |
| RaceResult | `raceId`, `racerId`, `finishPosition`, `finishTime`, `fastestLap`, `bonusPoints`, `pointsAwarded` |
| ChampionshipEntry | `racerId`, `totalPoints`, `wins`, `sumOfFinishPositions`, `bestFastestLap` |
| Event | `eventId`, `type`, `triggerTime`, `priority`, `insertionSequence`, `targetEdgeOrVertex`, `duration`, `cancelled` |

Vertex kinds are Start, Finish, Checkpoint, Intersection, FuelStation, NitroPickup and DeadEnd. Edge status is Open, Blocked or Restricted. Blocked edges are excluded from searches; restricted edges remain traversable with their effective cost/time adjusted. Dynamic updates must not require rebuilding the graph. Field representations and additional state such as active effects and traversal progress still need a shared TypeScript design.

## Exploration details that affect your implementation

Section 5.1 (p. 8) explicitly distinguishes BFS's minimum edge count from distance, time and weighted cost. Include the supplied example in tests or the Lab: direct S–T has distance 10 and one edge; S–A–B–T has distance 6 and three edges. BFS chooses the direct edge.

DFS must support traversal, cycles, components, dead ends and bounded alternative paths. The brief defines a dead end as a **non-mandatory vertex from which the finish cannot be reached without reversing**; a degree-one test alone does not establish this for directed/mixed graphs. Agree on precise reversal semantics and directed component interpretation. An alternative route is a simple start-to-finish path differing from the selected main route by at least one edge. Document an enumeration bound; O(V+E) applies to an ordinary traversal, not enumeration of all simple paths.

## Event rules

Section 4.5 (p. 7) fixes ascending order by `(triggerTime, priority, insertionSequence)`; **lower priority number fires first**.

| Priority | Type | Required behavior | Duration guidance |
| --- | --- | --- | --- |
| 1 | Road blockage | Set edge Blocked and exclude it from routing | Until cleared |
| 2 | Shortcut open/close | Toggle designated shortcut Open/Blocked | Until reversed |
| 3 | Oil spill | Increase effective difficulty/reduce speed | About 20 s |
| 4 | Speed restriction | Cap speed on an edge/region | About 15 s |
| 5 | Fuel station availability | Activate/deactivate a station | About 30 s |
| 6 | Nitro booster | Activate pickup vertex | Until collected or about 25 s |

Apply same-time events in heap order before rerouting. Validate target existence and state eligibility. Cancel by marking events and skipping them at the heap top; document retained-memory trade-offs. Every temporary effect needs a clear/restore action. Keep overlapping effects independently identified, schedule expiry deterministically and recompute effective state so one expiry cannot erase another active effect. The division selects maximum difficulty penalty and strictest speed cap for the implementation.

The brief does not fix all payload fields, speed-cap values, oil severity or expiry-event priority semantics. Agree on those rather than assuming them. Explicitly handle expiry-versus-new-effect ties and collection-versus-expiry behavior.

## Game rules the UI must reflect

Sections 4.1–4.4 (pp. 5–6) require multiple laps, checkpoints in order, valid edge traversal, legal open shortcuts, full starting fuel and configured initial nitro. A racer without fuel for the next edge stops; without permitted refuelling/recovery it is DNF. Finish-time ties use lower racer ID. If a time limit is used, unfinished ranking uses laps, checkpoints, elapsed time, then ID; the points policy must be stated.

Suggested defaults are tank capacity 100; edge fuel `fuelCost × (1 + 0.1 × (difficulty − 1))`; up to 40 units purchased per station stop with a fixed positive-purchase stop time; nitro capacity 3; nitro speed 1.5× for 4 s; and 2× fuel consumption over the affected portion. Teams may tune these but must freeze and document values before testing. Suggested laps are 2 or 3. Fractional resource values need an explicit discretization/scaling scheme for DP.

Opponents use fixed main route, designated shortcuts, and minimum-distance routing respectively. The first two refuel at the first eligible station below 25% fuel; the third uses the nearest reachable station on route below 25%. The same physical rules and documented recovery policy apply to everyone. Display the engine's decisions; do not reproduce them inside UI components.

## Routing, resource and ranking integration

- **Routing (pp. 5, 8–9):** optimize normalized, non-negative distance/time/fuel/difficulty/obstacle scalar cost. Show exactly that cost plus distance/time, compare at least two routes and preserve ordered checkpoints through leg planning. Reroute after relevant closures/cost changes. A* needs a valid lower bound; h=0 is the fallback. Do not promise it always expands fewer vertices.
- **Resources (pp. 9–10):** recommendations must be physically feasible. Knapsack's scalar budget must be defined explicitly. The division assigns 0/1 Knapsack with reconstruction; refuelling DP is a recommended extension in the brief. Greedy needs zero-cost handling, deterministic ties, the supplied A/B/C counterexample and two team-made counterexamples. Verify DP against exhaustive search on small cases.
- **Generation (p. 11):** MST on a connected undirected candidate graph, then extra edges and backtracking placement. Add one-way edges only with subsequent directed validation. Check checkpoint order, lap return, alternatives and feasible fuel, with a bounded retry policy.
- **Ranking (pp. 7–8, 11–12):** points for positions 1–10 are `[25,18,15,12,10,8,6,4,2,1]`. Comparator: higher total points, higher wins, lower sum of finish positions, lower best fastest lap, lower racer ID. All three sorts and heap top-k must share this total order. Top-k must equal the full ranking prefix. Agree on DNF/no-lap representation and bonus points before testing.

## Experiment requirements

Section 7 (pp. 12–13) requires multiple sizes and repeated runs, recommending at least five measured runs after warm-up. **Report mean runtime** and optionally median/standard deviation. Use matching machine/build/settings and inputs for comparisons. Exclude rendering, file I/O and artificial delays; disclose initialization costs. Keep correctness checks outside timing and publish raw measurements.

Your Experiment 1 varies vertices/edges across sparse/denser graphs, records runtime, visited vertices and examined edges, verifies BFS minimum-edge paths and DFS cycles/components, and discusses O(V+E) growth. Your Experiment 4 varies event count, measures insertion/extraction time and **heap operations**, validates tie order, and covers cancellation/expiry.

Every experiment report needs objective, environment, generation method, sizes, procedure, metrics, tables/charts, interpretation, limitations and conclusion. Shared trace counters alone do not include every Experiment 1 metric: ensure examined-edge and visited counts have an agreed representation.

Raw results currently live in gitignored `experiments/results/`. That is acceptable for repository hygiene only if the final submission explicitly includes the result files/raw measurements. A ZIP created only from tracked files would otherwise omit required evidence.

## Mandatory work versus bonus work

Section 8 (pp. 13–14) calls the three advanced challenges **extension/bonus unless the instructor makes them compulsory**. The division assigns you Challenge 2, but basic preset comparison is already required, as are MST/backtracking and heap top-k. Keep these baseline requirements even if optional challenge polish is deferred. Do not treat refuelling DP as a mandatory extra algorithm when the assigned Knapsack already satisfies the DP requirement.

## Decisions still required before freezing the contract

1. Normalization references, all preset weights and obstacle-penalty representation.
2. Lap count/boundary, time limit, unfinished/DNF ranking and points policy, bonus points, missing fastest-lap representation.
3. Fuel/nitro tunings, initial nitro, fixed station stop time, pickup consumption/availability scope and discrete resource unit.
4. Recovery behavior, timing while waiting, behavior when an occupied edge closes, and how traversal state survives rerouting.
5. Event payloads, effect aggregation/restoration, expiry order and deterministic ID allocation.
6. Directed component/reversal semantics, alternative-path bounds, trace replay strategy and exact counter definitions.
7. Human controls and how route selection, nitro activation and resource choices reach the engine. The brief describes strategic choices but leaves the exact control scheme to the team.

These are team design choices or underspecified behavior, not missing project files. Record them in `docs/interfaces/` and configuration before testing.

## Final acceptance and deliverables

Section 9 (p. 14) requires graph, routing, resource, event, sorting and full-race integration edge cases. Complete-race checks include multiple laps, ordered checkpoints, DNF, road closure and standings. The report has ten sections: title page; introduction; architecture; data/rules; algorithm design/correctness/complexity; gameplay integration; tests; five experiments; limitations/challenges; conclusion/references.

Deliver the executable application and source, required assets, README/setup instructions, **technical report PDF**, integrated visualization, experiment results and **raw measurements**, and the correctly named ZIP. Check missing files, corruption, malware and upload errors. Acknowledge permitted external libraries/assets and follow course disclosure requirements. The current Vite setup is an implementation choice; verify the documented install/build/run procedure works from the final extracted package.

## Impact on the current repository

The four-iteration sequence remains appropriate. The full brief removes the previous document dependency, but does not itself finalize team-defined semantics. No extra runtime dependency is implied. Current source remains a scaffold: no algorithms, playable circuits, race engine or real screens have been implemented, and no test files exist yet. This review updates documentation and placeholder comments only; it does not implement or freeze the shared contract.
