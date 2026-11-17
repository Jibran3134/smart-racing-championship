# Iteration 3 presentation milestone

Implemented 17 November 2026. This delivers the UI and adapter portion of Iteration 3. The iteration's playable-race and real championship acceptance criteria remain open because Alishba's modules are not yet present.

## Delivered

- Race control view with map-based cars, race clock, lap/checkpoint/position telemetry, fuel/nitro gauges, running order, event feed and supplied waiting/DNF/error/completion states.
- An injected race-driver controller with one owned animation loop, bounded frame deltas, pause/resume/restart, live nitro delegation and cleanup on leaving the screen.
- Opt-in display replay with timeline seek/speed controls and explicit illustrative-data labels. It performs no race planning, consumption, scoring or game-rule simulation.
- Dashboard podiums, standings, selected sorting-method controls, top-k controls with prefix consistency checking, race-result selection and cumulative points charts.
- Optional live standings subscription and cleanup. Dashboard rendering delegates all sorting/scoring/top-k to its provider.
- Opt-in independent example championship, kept separate from actual race data and clearly identified as presentation-only data.
- Four-preset comparison cards on the same track/endpoints, route overlays, provider-supplied metrics/weights, unreachable/stale-result handling and a weighted-scalarization explanation. No weights or optimized costs are invented when the planner is absent.
- Shared responsive Recharts component with table fallback, loaded separately from the main app.
- Responsive styling and accessible labels, resource progressbars, named maps, keyboard controls and existing reduced-motion support.
- Provider/driver handoff documentation in `interfaces/game-presentation.md`, plus unit/UI/browser verification.

## Still pending

- Graph and actual circuit data, agreed configuration and shared core records.
- Real engine/opponents, resource recommendations, recovery rules and actual race controls.
- Connection of the existing EventProcessor to engine ticks and route cost updates.
- Dijkstra/A*, real normalized route metrics/preset comparison and checkpoint-aware planning.
- Scoring, Merge/Quick/Heap Sort, heap top-k and actual championship progression from race results.
- Remaining Lab adapters, complete-race/multiple-lap acceptance tests and final preset Challenge 2 demonstration.

These dependencies are called out in the UI and handoff notes. The sample replay/season are not gameplay tests or experimental evidence. Shared `types.ts` and `config.ts` remain open for joint agreement.

## How to review

Run `npm run dev`. Open Race → Preview race display, play/pause or seek the timeline, and finish at the end to open the example dashboard. The Dashboard also offers an independent example-data preview from its empty state. In Explorer, inspect the four preset cards and optionally enable illustrative path overlays; no optimized costs are shown without a real provider.

Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Browser checks cover race replay, DNF display, completion navigation, chart rendering, ranking/race selectors, top-k and preset overlays at 320, 390, 768 and 1440-pixel widths. Measurements and exports remain Iteration 4 work.
