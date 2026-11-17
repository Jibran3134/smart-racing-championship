# Iteration 6: unified Algorithm Lab playback

Implemented 17 November 2026. This completes the independent shared-player and Lab adapter framework work while leaving the remaining core algorithm implementations with their assigned owner.

## Delivered

- A lazy-loaded Algorithm workbench with shared execution and replay for graph, array and rectangular-table snapshots.
- Real BFS/DFS, generic heap and event queue adapters using the same core modules as Explorer, event processing and Node experiments.
- Generated input controls for vertex, numeric, selection and JSON inputs, plus stable adapter registration through `App.labAlgorithms`.
- A typed extension interface for routing, resources, sorting/top-k and generation; unavailable functions stay disabled rather than producing illustrative computations.
- Step/play/pause, previous step, result jump, seek, speed control, live cumulative counters, state values and counter explanations.
- Immutable input-map snapshots, copied frame snapshots, bounded capture, asynchronous cancellation and stale-result protection.
- Trace JSON/CSV exports and validated imported playback with explicit provenance; malformed files preserve the previous trace.
- Hidden-tab playback pause and timer cleanup, responsive layouts and no changes to racing sounds or commentary.

## Evidence

Production browser checks ran BFS, heapify and event scheduling/cancellation, verified JSON/CSV downloads and imported replay, rejected malformed JSON and checked graph/table views at 320/390/768/1440px with no page errors. The workbench chunk loads only when its tab is selected. The initial app bundle remains below Vite's 500 kB warning threshold.

Tests compare BFS counters directly with production traversal, verify bottom-up heap counters and real tie/cancellation order, check empty/malformed data, enforce import/size/cancellation rules and exercise controls/lifecycle. Test-only table/async adapters verify integration without claiming a DP or sorting implementation.

All 115 tests passed, along with TypeScript, lint and the production build. The workbench is a separate approximately 22.8 kB minified chunk; existing race setup and chart chunks remain independently loaded.

## Still open

Actual Dijkstra/A*, resources, ranking/top-k, MST/backtracking and official engine/circuit integrations remain absent. Their adapters can now supply inputs, core calls and snapshots without writing another player. Shared game records/configuration still require joint agreement. Their pending experiments, complete championship acceptance, cross-review, final report PDF and submission metadata/package remain required.

See [the workbench contract](interfaces/algorithm-workbench.md), [the setup handoff](interfaces/race-setup-and-results.md) and `npm run submission:check`. Imported traces are not benchmark evidence or proof of algorithm correctness. No teammate review or final submission is claimed.
