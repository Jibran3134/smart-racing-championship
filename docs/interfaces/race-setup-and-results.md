# Race setup and completed-session handoff

Iteration 5, 17 November 2026. These are presentation adapters in `src/ui/adapters/`; shared core records and configuration remain unfrozen. No routing, DP/Greedy, championship scoring or official circuit generator was added by this iteration.

## Composition

`App` accepts `raceSetupProvider` alongside its existing `raceDriver`, `presetProvider` and `championshipProvider` props. An injected `raceDriver` retains the direct-session path for existing integrations. Without it, the setup screen delegates preparation to the supplied factory. The default is `demoSetupProvider`, with one explicitly labelled supplied-route circuit.

```tsx
<App
  raceSetupProvider={setupAdapter}
  presetProvider={presetAdapter}
  championshipProvider={standingsAdapter}
/>
```

All values in the production adapters must come from actual core modules. Test adapters that wrap a demo as `live` are only test fixtures and are not shipped in the default app.

## Catalogue and request

`CircuitChoice` supplies a stable ID/title, rendering-only map, provenance (`demo` or `live`), allowed/default laps, full starting tank capacity, nitro capacity/default, optional supported route presets, and whether timed events are configurable. The UI validates basic map identity/coordinates/endpoints and legal configuration ranges. This is not the assignment's full generated-circuit validator: ordered checkpoint reachability, alternatives, feasible fuel and lap return must still be checked by core.

`RaceSetupRequest` carries mode, circuit ID, laps, initial nitro, event setting, optional preset and optional selected resource-plan ID. The UI does not invent weights, normalize metrics or choose a route. Demo configuration supports two or three laps, zero through three initial nitro charges, and timed events on/off. Default settings remain two laps/three charges/events on. Three-lap demo time limit is 180 simulation seconds; other draft movement/resource values are unchanged. These tunings are not jointly frozen game rules.

For championship mode, the provider supplies `championshipCircuitId` and owns its progression. The circuit control locks to that ID. Missing/invalid next-circuit state prevents production championship preparation. The default demo has no championship engine; its explicit **Start driving demo** action prepares a standalone quick demo rather than claiming a championship was started.

**Explore selected circuit** sends that circuit's map to the shared Explorer/Lab view. Defaults now use supplied vertex/road IDs rather than assuming zero-based IDs or fixture road names. Explorer closures are analysis edits; they do not mutate the provider's prepared engine. Preparing a race refreshes the shared map from that driver's initial snapshot and clears old exploration overrides.

## Resource advice

An optional synchronous `getRecommendations(request)` calls the actual DP/Greedy planner through an adapter. It returns whether selection is required and a list of `ResourcePlanView` values: ID/label, method, feasibility, explanation, items, scalar cost, budget and explicit budget-unit label. No candidate values are synthesized when the provider is absent.

The UI rejects invalid/negative budget data and a purportedly feasible plan exceeding its stated budget. Physical fuel/route/capacity feasibility remains the core planner's responsibility. Infeasible candidates are visible but unselectable. If selection is required, no race is prepared until the user explicitly selects a feasible plan. A circuit/lap/nitro/event/preset change invalidates the previous selection by request fingerprint. The factory must revalidate the chosen ID and feasibility against its authoritative data before constructing a session.

## Preparation lifecycle

`createRace(request, signal?)` returns a stable `RaceDriver` or a promise for it. The setup controls lock while it prepares. Cancellation or unmount aborts the signal and prevents a delayed result from mounting a race. A factory with workers/network resources should observe that signal and clean up its own resources. Remove temporary abort listeners when preparation successfully finishes; ownership then transfers to the mounted driver/controller.

Failures remain on setup with a retryable message. Returned drivers are checked for kind, required methods, ready phase, selected lap count/map identity, exactly one human racer and the selected full tank/nitro values and capacities. The grid is shown without advancing the engine. **Start race** unlocks sound and begins the controller. A successfully prepared local driver can return to setup through the race header.

## Actual completed results

`RaceSession` notifies `onComplete` once upon entering the finished phase and resets that notification after restart. `App` captures a separate `SessionResult` using engine ordering and values. The record contains kind, circuit, setup request, capture timestamp, simulation clock, laps/checkpoints, final racer rows and a copy of the retained event feed. It does not calculate championship points, comparator rankings or fastest laps.

Capture rejects unfinished/nonterminal data, duplicate IDs, inconsistent position order, invalid resources, invalid lap/checkpoint progress, and finish times outside the session. Demo/live finishers must have engine-supplied times. Replay may have missing times; those stay blank and the result remains explicitly illustrative. DNF retains its supplied reason and a missing finish time.

The dashboard displays actual session results separately from a scoring provider or an opt-in example season. The app no longer opens fabricated season standings after a demo completes. Revisiting a completed driver does not duplicate its archive entry; restarting allows a new record. The ten most recent completed sessions stay in tab memory. Reloading the page clears this memory; export JSON/CSV to retain evidence.

Results CSV contains raw seconds and final resources; JSON also includes setup and retained events. The event feed can be expanded/exported separately, and is labelled retained because the engine may trim older entries. The shared serializers handle CSV quoting and spreadsheet formula prefixes. Exported UI records are evidence of that session, not the final shared `RaceResult`/championship contract.

## Preset validation

`validatePresetRoutes` now requires one result for each of the four presets and checks endpoint identity, vertex/edge cardinality, road continuity, one-way direction, blocked roads, all required numeric metrics and weights, and empty data for unreachable routes. Matching paths are labelled explicitly. These checks cannot prove optimality or mandatory checkpoint legality; that remains core responsibility.

## Review

Run the required checks and tests, then configure a demo, complete it, inspect/export actual results, revisit the driver and restart it. Verify history is not duplicated on navigation and that a restart adds a separate run. Exercise provider errors, pending cancellation, mandatory infeasible resource advice, nonzero circuit IDs and rejected malformed preset paths. Joint review and production module integration remain pending.
