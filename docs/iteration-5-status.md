# Iteration 5: configured racing and actual results

Implemented 17 November 2026. This closes more of the assigned UI/game-flow work while retaining the existing core ownership boundaries.

## Delivered

- Race setup with a supplied circuit catalogue/map, lap and nitro selection, timed event control, supported preset selection and an explicit review-before-grid flow.
- A real default demo factory with two/three-lap and zero-to-three nitro configuration. Default behavior is unchanged; optional three-lap sessions use a 180-second limit.
- Production setup/resource interfaces: explicit feasible-plan selection, budget validation, stale-plan invalidation, championship circuit locking, retryable errors and abortable preparation with late-result protection.
- Explorer/Lab defaults that accept nonzero IDs and provider-specific road names. Preparing a race aligns the shared map with its initial snapshot.
- Actual completion records and history, preserving engine positions, finish times, DNF reasons, resources and retained events. No invented points or fastest laps.
- Dashboard session selection, race CSV, complete session JSON and retained-event CSV exports. Example season data remains an independent opt-in view.
- Completion deduplication across navigation, a new archive entry after restart and a ten-session in-memory history limit.
- Stronger four-preset result validation for complete presets, road continuity/direction, field completeness and blocked/unreachable paths; identical routes are identified.
- Lazy-loaded race setup to reduce the initial app bundle, responsive setup/results views and updated integration documentation.

## Verification

Tests cover actual two- and three-lap demo completion, provider/loadout rejection, required/infeasible/stale resource advice, preparation errors/cancellation, result capture/mutation isolation, DNF/replay semantics, custom circuit IDs, complete App setup-to-results navigation, restart history and malformed preset routes.

All 104 tests, TypeScript checks, lint and the production build passed. Setup is a separate approximately 8 kB minified chunk; the initial app chunk remains below Vite's 500 kB warning threshold. Tests used four workers to reduce contention during browser/build checks.

Chrome completed a configured three-lap, zero-nitro, events-disabled race with all four cars finishing. Exported JSON retained exactly that setup and actual engine finish times; race CSV had one row per racer. No example championship was automatically opened. Setup/results were checked at 320/390/768/1440px with no page errors. Test-only accelerated frame timestamps shortened browser QA without adding production debug controls.

## Remaining dependencies

The default catalogue still contains one draft demo, not the three required production circuits. The real graph/costs, Dijkstra/A*, resources, scoring/sorts/top-k, official opponents and generator remain assigned core integrations. The setup adapters and route validation do not implement those algorithms. Shared `types.ts`/`config.ts` and remaining rule choices still require joint agreement.

Remaining Lab adapters, experiments 2/3/5, complete championship acceptance, joint report review/PDF and final packaging remain open. See [the setup/results handoff](interfaces/race-setup-and-results.md) and `npm run submission:check`. Commentary remains excluded, and personal team names are not added to the UI.
