# Smart Racing Championship

DAA project by Jibran and Alishba. The min-heap, BFS/DFS Explorer, trace playback and event queue/effects are implemented. A continuous route-racing demo now includes detailed cars, acceleration/braking, nitro, cameras and a recorded four-car spatial engine/tyre mix. The dashboard and preset UI are available; actual championship scoring, optimized routes and the complete three-circuit game still await integration. See [the racing upgrade](docs/racing-upgrade.md).

## Setup

Use Node.js 22.12+ (Node 24 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On PowerShell, use `npm.cmd` if your execution policy prevents `npm.ps1` from running.

To race: **Race > configure laps/nitro/events > Start driving demo > Start race**. After completion, **View race results** opens the actual session with CSV/JSON exports. Sound starts with the race. Click the circuit to use **N** for nitro, **Space** for pause, **C** for camera and **M** for sound. Follow/circuit cameras, fullscreen, volume and touch-friendly nitro controls are available on the racing screen. See the [audio mix and credits](docs/audio-mix.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | TypeScript checks and production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Check app, tooling and experiment TypeScript |
| `npm run lint` | ESLint, including core/UI import restrictions |
| `npm test` | Run heap, exploration, events, race lifecycle and UI interaction tests |
| `npm run test:watch` | Watch tests during implementation |
| `npm run test:coverage` | Core coverage using V8 |
| `npm run experiments -- --experiment all` | Run seeded BFS/DFS and event queue studies; save raw CSV/JSON and reports |
| `npm run submission:check` | Check required submission files and report outstanding integration/metadata |

## Structure and ownership

```text
src/
  app/                         App entry and future navigation
  core/                        Pure logic; never imports UI
    types.ts, config.ts        Shared contract (pending agreement)
    graph/                     Graph model and scalar costs — Alishba
    structures/                Generic min-heap — Jibran
    algorithms/
      exploration/             BFS and DFS — Jibran
      routing/                 Dijkstra, A*, checkpoint planning — Alishba
      mst/                     Prim or Kruskal — Alishba
      backtracking/            Constraint placement — Alishba
      resources/               DP and Greedy — Alishba
      sorting/                 Merge, Quick, Heap Sort and top-k — Alishba
    events/                    Event queue and overlapping effects — Jibran
    engine/                    Race loop and opponents — Alishba
    resources/                 Resource recommendations — Alishba
    championship/              Scoring, comparator and standings — Alishba
    generation/                Track generation and validation — Alishba
  data/tracks/                 Three circuit JSON files — Alishba
  ui/                          All owned by Jibran
    screens/                   main-menu, track-explorer, racing,
                               algorithm-lab, championship-dashboard
    components/                common, map, charts, algorithm-viewer
    hooks/, styles/, assets/
  shared/                      CSV/JSON exports and non-UI helpers
tests/                         unit, integration, UI and fixtures
experiments/                   Five numbered runners, shared helpers, results
docs/                          Architecture, interface contract, report, experiments
public/                        Static assets copied as-is by Vite
```

See [the setup notes](docs/architecture.md) for integration rules and [the full brief review](docs/project-brief-review.md) for requirements and outstanding decisions. `Project.pdf` and `DAA Project division.docx` are retained at the root.

## Next implementation steps

1. Use `Project.pdf` to agree on `types.ts` and `config.ts`, and record the contract in `docs/interfaces/`.
2. Alishba can reuse the [implemented heap](docs/interfaces/min-heap.md) and supply the graph, sample circuit and engine state stub.
3. Review the [exploration](docs/interfaces/exploration.md) and [event](docs/interfaces/events.md) adapters together, then connect them to Alishba's real graph, routing and race engine.
4. Connect the [game-presentation adapters](docs/interfaces/game-presentation.md) for live racing, championship ranking/top-k and optimized preset comparison. The labelled UI fixtures are not substitutes for those algorithms.

No backend, database, algorithm library, or extra Canvas/SVG package is needed for the specified stack. Canvas and SVG are browser features.

## Experiments and report evidence

Run `npm run experiments -- --experiment all`, then open **Algorithm Lab > Experiment results** and import the generated JSON from `experiments/results/`. Both studies reuse production core functions and include warm-ups, five measured runs, counters and correctness checks. Export raw/summary CSV or JSON from the viewer. See [the full procedure](docs/experiments.md) and [Iteration 4 status](docs/iteration-4-status.md). Generated measurements stay local and must be explicitly included in the final submission.

The [Iteration 5 race flow](docs/iteration-5-status.md) adds circuit/resource-provider handoffs, preparation cancellation and actual session history. See [the integration contract](docs/interfaces/race-setup-and-results.md) for connecting production modules.
