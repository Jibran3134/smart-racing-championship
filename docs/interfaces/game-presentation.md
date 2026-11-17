# Racing, standings and route-comparison presentation handoff

Iteration 3 builds the remaining major UI views against provisional presentation adapters. These are in `src/ui/adapters/`; they do not freeze the shared core `types.ts` or `config.ts`. The real graph, routing, resource planning, race engine and ranking modules still belong to Alishba.

**Racing-upgrade update:** the app now uses the draft `RouteRace` core driving session through a `RaceDriver` of kind `demo`, with countdown, continuous movement, speed/RPM/gear, nitro and actual race-event effects. See `../racing-upgrade.md`. The snapshot-only preview described below remains a test fixture, not the current app entry point. The Canvas scene/audio consume the same adapter and can be retained when integrating the complete engine. `RaceViewState.phase` also supports `countdown`; racer telemetry may include speed/RPM/gear/braking/boost and finish time.

## Connecting the app

`App` accepts optional `raceDriver`, `championshipProvider` and `presetProvider` props. The app currently starts without these providers. A future composition module can construct adapters around the real core implementations and pass them in. Keep the adapters stable for a mounted session; remount the race session when replacing its driver. The UI factory delegates to the selected driver and never calculates championship rankings.

Without an injected driver, the race screen now opens configurable setup through `raceSetupProvider`, defaulting to the supplied-route demo. See [the setup/results handoff](race-setup-and-results.md). Without ranking data, the dashboard starts empty and offers an opt-in example season. Without a route provider, comparison costs and weights remain unavailable; illustrative path overlays are explicitly not optimized results.

## RaceDriver and RaceViewState

Defined in `src/ui/adapters/race-view.ts`:

- `getState()` returns a presentation snapshot: phase, simulation clock, total laps, checkpoint count, track view, ordered racer views, event feed and displayed route-edge IDs.
- `start()` starts/resumes the configured session; `step(seconds)` delegates advancement to the real engine; `restart()` restores the configured initial state and clears its events/resources/results as required by the agreed engine rules.
- Optional `activateNitro()` delegates the player's request to the engine. The engine must validate charges, duration, fuel penalty and status. UI enablement is only a convenience, not authoritative validation.
- `kind` distinguishes a live session from a display replay. Optional `seek`/`duration` are for replay only; the live engine is never rewound by presentation controls.

Racer views include ID/label/color, human flag, current supplied position/status/reason, fuel/capacity, nitro/capacity, lap/checkpoint progress and a map location. The UI renders the provider's running order without sorting or deciding rank. Positions on an edge use a canonical from-to fraction from 0 to 1; set optional `reverse` to face the car in the reverse direction. The renderer projects only valid edge/vertex locations. It does not choose roads or advance traversal.

`useRaceController` owns a single requestAnimationFrame loop. It advances the injected driver only while playing, caps a single browser-frame delta at 0.1 seconds to avoid hidden-tab catch-up spikes, and applies replay speed only for display replay. As a consequence, simulated time may run slower than wall time when frames are heavily delayed; the engine's recorded simulation clock is authoritative. Pausing, completion, errors, restart and unmount stop the loop. Returning to the screen reads the retained driver state and starts paused. No timers run from rendering or chart code.

Driver operations and snapshot reads are caught: a failed initial read shows a retry state; a step failure pauses the session and preserves the last readable state with an error message. Restart delegates cleanup to the driver and rereads it. `waiting` and `dnf` display the engine's supplied recovery/failure reason; the UI invents no recovery rule.

The engine adapter must integrate the real `EventProcessor` and checkpoint/resource logic inside `step`, using the event-boundary contract in `events.md`. The UI must not process a second event queue or recalculate its own race routes. Circuit selection, resource recommendations and championship progression still need actual core modules/configuration.

## Display replay is not game integration

`src/ui/fixtures/recorded-race.ts` supplies a short series of explicit illustrative snapshots. Its driver selects display samples by replay time; it does not compute paths, consumption, lap legality, checkpoint order, DNF decisions, event effects or standings. Those sample values are not frozen race defaults or evidence of a valid playable circuit. The replay shows closures, fuel/nitro changes, a DNF and completion to exercise presentation states. It awards no points. Nitro activation is disabled in replay mode.

Completion now records a separate session result. Replay records stay explicitly illustrative. The independent example season is available only through its own opt-in dashboard action. Never include these samples as experimental measurements or real integration-test evidence.

## ChampionshipProvider

Defined in `src/ui/adapters/championship-view.ts`. The provider supplies already ordered core results:

- `getRanking('merge' | 'quick' | 'heap')` calls the selected real sorting implementation using the common total comparator.
- `getTopK(k)` calls the real heap top-k implementation. The UI checks racer-ID order/length against the full ranking prefix before displaying it, and shows an error on mismatch. Core tests must additionally verify all ranking fields and comparator behavior.
- `races` contains per-race result records in their final order; `complete` indicates whether the current leader is the season champion.
- `pointsHistory` supplies cumulative chart series keyed as `racer<ID>`; the UI does not recompute scoring or cumulative standings.
- Optional `subscribe(listener)` notifies after standings/history change and returns an unsubscribe function. The dashboard refreshes ranking/top-k on notification and unsubscribes on unmount or provider replacement.

The comparator remains the brief's order: higher points, higher wins, lower position sum, lower best fastest lap, lower racer ID. Missing fastest laps are displayed as an em dash; their comparator sentinel must be agreed in core. No bonus or unfinished-racer scoring policy is set in this adapter.

The example provider contains fixed ordered arrays and a simple presentation slice for top-k. All method selections return the precomputed fixture order. This is not Merge/Quick/Heap Sort or heap retrieval and is explicitly labelled example data.

`SeriesChart` is a reusable, responsive Recharts line chart with a readable data-table alternative. Dashboard charts are loaded on demand in a separate build chunk, do not animate measurements and do not perform simulation work. This component can also display experiment results in Iteration 4.

## PresetProvider

Defined in `src/ui/adapters/preset-view.ts`. `compare({source, target, track})` must invoke the real planner for Balanced, Speed, Economy and Safety against the same graph state and endpoint request. Results provide legal path vertices/edges, explicit reachability, physical distance/time, the exact optimized scalar cost and the non-negative preset weights.

The UI displays returned cost directly without re-normalizing, reweighting or estimating it. It rejects mismatched endpoints, missing/blocked edges and invalid metrics/weights; a complete path/continuity/checkpoint validator still belongs to core. Unreachable routes display no cost. Different presets may legitimately return identical paths. The view explains weighted scalarization's limitations and why scalar scores with different weights are not directly comparable.

Until normalized costs/presets are agreed and routing arrives, the default comparison cards have no computed routes, numeric weights or costs. An opt-in presentation preview distributes existing simple Explorer paths across the cards, with an explicit statement that those assignments are not optimized by weights. Do not claim Challenge 2 is fully demonstrated until real preset-dependent routing is connected.

## Verification and remaining acceptance work

UI tests cover the race loop's lifecycle, long-frame clamping, replay seeking, resources, DNF display, live nitro delegation, error/retry states, valid/invalid map positions, provider method/top-k delegation, subscription cleanup, inconsistent output rejection and exact cost/weight display. Browser checks cover playback, completion-to-dashboard navigation, chart rendering, race selection, top-k controls, preset overlays and small screens.

Still required: agreed shared records/config, real circuits, human input mapping, feasible resource recommendations, live engine/event/routing integration, all sorting/top-k algorithms, preset-dependent routes, Lab adapters for the remaining algorithms and full race/championship acceptance tests. A finished UI preview does not satisfy those game-integration requirements.
