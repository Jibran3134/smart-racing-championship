# Jibran's implementation plan

Scope: your responsibilities in `DAA Project division.docx`. This plan starts from the existing scaffold and groups the work into four substantial iterations. Each iteration ends with working, integrated behavior and relevant tests. Dates are targets based on the division's timeline; submission is due 5 December 2026 at 11:59 PM, Asia/Karachi.

## Starting point and working rules

- Complete: folder structure, dependencies, starter screen, TypeScript, lint, build and test configuration.
- Pending: shared contracts, all algorithms, event behavior, real screens and experiments. The current test command allows an empty suite; that is not evidence of implemented behavior.
- Keep personal names out of the product UI.
- Keep `src/core` independent of React, the DOM and rendering. The game, Lab and experiments must use the same algorithm implementations.
- Use seeded/reproducible fixtures and deterministic algorithm ordering. Rendering must not advance the simulation or change algorithm results.
- The full assignment brief is now available as `Project.pdf`; consult `docs/project-brief-review.md` for the detailed requirements. Use it to finalize the six event types and jointly agree on records/constants before freezing them.

## Iteration 1 — Shared foundation, application shell and reusable heap

**Target: 17–19 November. Outcome: a navigable app and a tested heap that Alishba can immediately reuse.**

### Work

1. Agree with Alishba on `src/core/types.ts` and `src/core/config.ts`. Record the agreed graph API, route results, trace schema/counters, engine state, event hooks and configuration ownership in `docs/interfaces/`. Freeze only after checking the full brief together.
2. Implement the generic comparator-based min-heap in `src/core/structures/`, with insertion, extraction, peek, size/empty access and explicitly defined operation counters. Keep cancellation and event-specific ordering in the event layer. Do not build separate heaps for each algorithm.
3. Build the app shell and navigation for Main Menu, Explorer, Racing, Algorithm Lab and Dashboard. Establish the dark motorsport palette, typography, spacing, panels, buttons, disabled states and focus styles.
4. Make the Main Menu functional: Start Championship, Quick Race, Algorithm Lab, instructions and settings entry points. Define settings from supported requirements; keep unavailable features visibly marked until their integrations exist.
5. Establish the reusable map renderer in `src/ui/components/map/`. Use SVG initially for graph interaction, with separate layers for roads, vertices, checkpoints, route overlays and later car/event highlights. Keep graph layout coordinates separate from algorithm costs.
6. Define the UI's engine/graph adapters and use small deterministic fixtures conforming to the agreed contract while real data is pending. Keep fixtures outside production core logic.

### Coordination and verification

- Deliver the heap API and usage example to Alishba by **19 November**.
- Receive the graph model, sample circuit and `getState()` stub from Alishba by **19 November**.
- Test heap ordering, empty and singleton behavior, duplicate priorities, custom comparators, and deterministic operation counters. Compare extraction against a sorted reference in tests.
- Check screen navigation, keyboard access, responsive layout and map rendering with the sample graph.
- Start the architecture/game-flow report notes and heap correctness/complexity notes.

**Completion demo:** navigate between all five screen shells, inspect the sample graph, and run the heap tests. Alishba can import the heap without importing any UI code.

## Iteration 2 — Exploration, event processing and the interactive Algorithm Lab

**Target: 20–24 November. Outcome: a working Explorer and Lab backed by your real algorithms, plus an event system ready for the race loop.**

### Work

1. Implement BFS in `src/core/algorithms/exploration/`: reachability, minimum-edge path, queue, visited state and parent reconstruction. Expose counters and the shared optional trace callback.
2. Implement DFS: traversal, directed/undirected cycle handling, connected components with documented semantics, dead-end analysis and bounded alternative-route search. The brief defines a dead end as a non-mandatory vertex from which the finish cannot be reached without reversing, and an alternative route as a simple start-to-finish path differing from the main route by at least one edge. State the route-count or length bound explicitly. Distinguish linear traversal complexity from potentially much larger route enumeration cost.
3. Complete Explorer interactions: choose start/target/checkpoints, inspect reachable vertices, display alternative paths and show route distance, time and scalar cost from the agreed data contract. Render blocked/restricted roads distinctly.
4. Build reusable Lab playback: algorithm selection, step/play/pause/reset, speed control, frontier/visited highlights, active edge and live counters. Preserve deterministic traces; resetting or changing inputs must clear the previous replay.
5. Connect Alishba's Dijkstra and A* to the same viewer through the shared trace interface. Do not implement replacement routing algorithms inside UI components.
6. Build the event queue in `src/core/events/` using the shared heap. Order by `(triggerTime, priority, insertionSequence)` with lower priority numbers first, as required by Section 4.5. Implement `schedule`, lazy-deletion `cancel` and `popDue`, with deterministic IDs/sequences and target validation.
7. Implement the six event effects after verifying their definitions in the full brief. Track overlapping temporary effects independently with expiry IDs. Recompute effective state from active effects, using maximum difficulty penalty and strictest speed cap as specified in the division.
8. Agree with Alishba on a tick contract: drain and apply all same-timestamp due events in heap order, including due expiries, before route recalculation. Cover scheduled expiry behavior and invalid targets explicitly.

### Coordination and verification

- Expect Dijkstra, A* and checkpoint planning to be available by **22 November**; use agreed route fixtures until then.
- Test BFS/DFS on singleton, disconnected, cyclic, branching, dead-end, directed and undirected graphs. Check BFS minimum edge count, DFS component/cycle semantics and alternative-route bounds.
- Test event ordering, equal-time ties, cancellation, expiry, missing targets and overlapping effects. Expiring one effect must not remove another active effect.
- Test Lab playback state transitions and trace/counter display. Integrate at least one real routing trace when the module is delivered.
- Write the BFS, DFS and queue pseudocode, correctness, complexity and integration notes while implementing them.

**Completion demo:** explore a graph, replay BFS/DFS and an available routing algorithm, then run a deterministic event scenario demonstrating tie ordering, cancellation and overlapping expiry behavior.

## Iteration 3 — Playable race flow, championship dashboard and preset comparison

**Target: 25–29 November. Outcome: all five screens work with the real engine and championship data.**

### Work

1. Wire Quick Race and Start Championship to Alishba's engine. Keep route decisions, laps, fuel, nitro, opponent behavior, DNF and standings calculations inside her core modules.
2. Complete the Racing screen: animated cars, roads/checkpoints, fuel and nitro gauges, race clock, lap/checkpoint progress and a live event feed. Display closures, restrictions and active temporary effects from engine state.
3. Connect your event queue/effect resolution to the race tick. Coordinate engine stepping and render timing so leaving a screen or restarting cannot leave duplicate animation loops or stale events.
4. Handle meaningful states across screens: no available route, invalid track, insufficient resources, loading/unavailable module data, race completion, DNF and restart. Use the engine's recovery policy rather than inventing UI-only behavior.
5. Complete the Dashboard: race results, championship standings, statistics, podium and a top-k toggle. Display Alishba's shared comparator/ranking output and heap-based top-k results; do not independently sort standings in the UI.
6. Implement Challenge 2: compare Balanced, Speed, Economy and Safety on the same track and route request. Show the route overlays side by side, a consistent legend, distance/time/scalar-cost metrics and the active preset weights. Explain that a weighted scalar cost reflects configured trade-offs and does not enumerate every Pareto-optimal route. Do not claim different presets' scalar scores are directly comparable without accounting for their weights.
7. Extend shared Recharts components for standings/statistics and the coming experiments. Apply Framer Motion to navigation/presentation without coupling animations to core state changes.
8. Finish instructions, supported settings, responsive behavior, readable contrast, keyboard focus and reduced-motion handling.
9. Extend the Lab beyond graph searches: provide relevant input, trace/state and counter views for resources, sorting/top-k, generation and event processing as Alishba's modules arrive. Section 2 requires stepping through algorithms on current track/data; these adapters must invoke the same gameplay functions.

### Coordination and verification

- Depend on Alishba for the real race loop, deterministic opponents, three circuits, route updates, resource recommendations and standings/top-k APIs.
- Review one full game flow together: menu → Explorer → race → results → Dashboard → next race/restart.
- Exercise road closure and rerouting, fuel/nitro changes, ordered checkpoints, multiple laps and DNF through the real engine. Verify the UI accurately displays those outcomes.
- Check live top-k against full ranking output through Alishba's shared APIs, including tie cases.
- Use the circuit where presets choose different routes to demonstrate Challenge 2. Handle coincident routes clearly on other circuits.
- Perform a walkthrough of your UI, exploration and event code with Alishba around **30 November**.

**Completion demo:** finish a real race, view the resulting championship standings, change top-k, and compare the four presets on the same track. All five screens use agreed production interfaces.

## Iteration 4 — Experiments, final validation, report and submission package

**Target: 30 November–4 December. Outcome: reproducible evidence, finished report contributions and a checked submission ZIP.**

### Work

1. Implement Experiment 1 in `experiments/01-exploration/`: vary vertex count and sparse/dense graph families; measure BFS/DFS runtime, visited vertices and examined edges. Verify BFS minimum-edge results and DFS cycle/component results against known fixtures or an independent test oracle.
2. Implement Experiment 4 in `experiments/04-events/`: vary event count; measure insertion and extraction; exercise equal timestamps, priority/sequence ties, cancellations and expirations. Validate resulting order and effective state separately from timing.
3. Use seeded datasets, record seeds/input sizes/environment, warm up runs and repeat measurements (the brief recommends at least five after warm-up). Report mean runtime, with median or standard deviation where useful. Exclude rendering, file I/O and artificial delays from algorithm timings; disclose whether initialization is included. Keep correctness checks separate from timed runs and retain every raw measurement.
4. Build shared CSV/JSON export helpers in `src/shared/` and experiment charts in `src/ui/components/charts/`. Agree on a results format with Alishba so her experiments 2, 3 and 5 can reuse the charts and exports. Keep generated outputs in `experiments/results/`.
5. Complete your report contributions: Introduction, GUI/game-flow architecture, pseudocode/complexity, integration, tests and experiments for BFS/DFS/event queue, and Challenge 2. Include screenshots, measured charts, limitations, references and any required AI/library acknowledgements.
6. Cross-review Alishba's sections and explain both members' modules in a mock viva on **3 December**. Verify every report claim against actual implementation or recorded experiment results.
7. Run the final acceptance flow and fix defects on **3–4 December**. Remove the empty-suite allowance once real tests exist so missing test discovery cannot silently pass.
8. On **4 December**, prepare and inspect the ZIP: required source, lockfile, report PDF, assets, setup/run instructions, reproducible experiment inputs, result files and raw measurements are present. Explicitly include `experiments/results/` even though generated outputs are gitignored. Exclude `node_modules`, caches and unnecessary build artifacts. Check for missing files, corruption, malware and submission errors. Verify installation/build and the executable application from a clean extracted copy. Check the required filename `24I-XXXX_24I-YYYY_Section.zip` using the actual two members' registration numbers and section.
9. Submit on Google Classroom as the designated submitting member after the team checks the final package. Treat **5 December** as buffer only.

**Completion demo:** rerun experiments from documented commands, inspect/export their charts, run the complete app from a clean install, and review the final report and ZIP.

## Completion gate for every iteration

- Demonstrate the iteration's working outcome, with unfinished dependencies recorded explicitly.
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`; add meaningful tests for newly implemented logic and interactions.
- Check core/UI separation, shared algorithm reuse, determinism and trace/counter consistency.
- Update report notes and interface documentation, then cross-review integration points with Alishba.

## Dependency and workload handling

| Situation | Action |
| --- | --- |
| Shared contract is pending | The full brief is available. Continue heap, UI shell and renderer work while agreeing on the remaining team-defined rules and values. |
| Graph, engine or routing delivery is late | Use contract-conforming deterministic fixtures in UI adapters; keep a named integration task open and replace fixtures before claiming completion. |
| Your UI work falls behind | Follow the division's fallback: agree to move Experiment 4 chart work or Challenge 2 to Alishba. Keep heap/event integration on schedule. |
| Alishba's workload falls behind | Agree before taking over Prim/Kruskal; do not silently expand your scope. |
| New ideas threaten the schedule | Finish the required five-screen flow, algorithm correctness and experiments before optional visual polish. |

The full brief labels the three advanced challenges extension/bonus unless the instructor says otherwise. Keep the task division's Challenge 2 allocation, but prioritize mandatory correctness and integration. Required baseline preset comparison, MST/backtracking use, and heap top-k remain in scope independently of bonus presentation.
