# Iteration 1 implementation status

Implemented 17 November 2026. This is a foundation milestone, not completion of all Iteration 1 acceptance criteria.

## Delivered

- Generic hand-written comparator-based min-heap, bottom-up construction, snapshots and documented operation counters. See `interfaces/min-heap.md` for Alishba's handoff.
- Five navigable screen shells, a Main Menu with Quick Race/Championship/Lab entry points, session settings and an instructions dialog.
- Dark motorsport styling, responsive layout, visible keyboard focus, native modal dialogs, skip link and reduced-motion support.
- Reusable SVG map with road-state/shortcut styling, vertex selection through pointer/keyboard/selector, zoom/Fit controls and route-highlight input.
- A layout-only fixture with ten checkpoint markers, service vertices and example road states. It is not one of the required validated circuits.
- Algorithm Lab heap workspace that directly calls the production heap. Insert/extract/reset and counters are functional. This currently shows completed operations rather than internal trace playback.
- Heap correctness tests and UI behavior tests. Empty-suite success has been removed from the npm test scripts.

## Still open

- Joint agreement on shared graph/game types, settings, engine state, counter/trace definitions and remaining game-rule choices. The shared files remain placeholders.
- Alishba's real graph, circuit JSON and engine state adapter. The map uses a rendering-only model so it does not impose an unreviewed core API.
- BFS/DFS, event queue/effects and trace playback (Iteration 2).
- Routing/resource/race/ranking integrations and preset comparison (later iterations). Race and Dashboard explicitly show their unavailable/empty state without fabricated results.
- Actual championship instructions and game settings once the rules are frozen.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. UI tests use jsdom with a modal-method shim; real-browser checks additionally cover native dialog Escape/focus restoration, map selection, heap actions, desktop/mobile navigation and horizontal overflow. The browser checks use the local installed Chrome through Python Playwright; they do not add a runtime or repository dependency.

The app's navigation state and settings are session-local. Reload returns to Overview. Race entry points currently lead to a preparation screen with a disabled Start button. Preview at `npm run dev`.
