# Iteration 2 implementation status

Implemented 17 November 2026, following the agreed iteration sequence ahead of its target dates. This delivers Jibran's independent exploration/event work and UI integration; external graph/routing/engine integrations remain open.

## Delivered

- Hand-written BFS and iterative DFS with parent reconstruction, counters and optional independent trace snapshots.
- Directed/undirected cycle semantics, ordinary/weak components, documented arrival-relative dead-end analysis and bounded simple alternative-route search.
- Explorer source/destination selection, reachable checkpoints, main/alternative path overlays, unreachable/source-equals-target handling and block/reopen controls that recompute using the same algorithms.
- Shared trace player with step/play/pause/reset, playback speed, frontier/visited/active-edge visualization and live counters. Input changes reset runs; leaving the viewer removes playback timers.
- Explorer road changes persist across screen navigation and are shared with the traversal Lab, so replay uses the current road view.
- Event queue using the shared heap with deterministic time/priority/sequence order, lazy cancellation and validation.
- Six event effects, independent expiries, maximum oil penalty, strictest speed cap, service restoration and nitro collection.
- Event Lab showing same-time order, live effects, cancellation, collection and expiry on a changing track.
- Regression and new core/UI tests; detailed API, correctness and complexity notes in `interfaces/exploration.md` and `interfaces/events.md`.

## Pending dependencies and acceptance work

- Alishba's graph, real circuit data, Dijkstra/A*, route metrics and race engine are not present. Their implementations have not been replaced by UI algorithms or invented weighted costs.
- The Explorer shows edge counts; physical distance, estimated time and scalar-cost comparisons remain pending. Arbitrary exploratory paths do not enforce racing checkpoint order.
- Dijkstra/A* entries are visibly unavailable in the Lab. `TracePlayer` is ready for their trace adapters once delivered.
- Shared `types.ts` and `config.ts` remain placeholders. The narrow module contracts, dead-end/reversal semantics, mixed-network cycle interpretation, event aggregation and expiry priority need joint review before freezing.
- Effects currently run against the same model-independent processor through a Lab fixture adapter. Connecting them to the real race loop, cost normalization and service scopes is still required for final gameplay integration.
- Experiments 1/4 and measured report charts remain assigned to Iteration 4; this iteration supplies correctness tests and operation counters.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Tests cover traversal/cycle/component cases, BFS edge optimality, 15,000-vertex DFS depth, alternative bounds, event resolution and queue behavior, road recalculation/unreachable paths, timer lifecycle, input resets and event-simulation flows. Browser checks additionally cover replay controls, dynamic map changes and desktop/mobile layouts.
