# Smart Racing Championship

DAA project by Jibran and Alishba. Iteration 1 is underway: the reusable min-heap, application shell, interactive map preview and heap Lab are implemented. Racing and championship results are not yet available. See [implementation status](docs/iteration-1-status.md).

## Setup

Use Node.js 22.12+ (Node 24 LTS recommended) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. On PowerShell, use `npm.cmd` if your execution policy prevents `npm.ps1` from running.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | TypeScript checks and production build in `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | Check app, tooling and experiment TypeScript |
| `npm run lint` | ESLint, including core/UI import restrictions |
| `npm test` | Run heap correctness and UI interaction tests |
| `npm run test:watch` | Watch tests during implementation |
| `npm run test:coverage` | Core coverage using V8 |
| `npm run experiments` | List the five experiment workspaces |

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
3. Implement BFS/DFS, event handling and trace playback, then connect the UI to routing, resources, racing and ranking modules.

No backend, database, algorithm library, or extra Canvas/SVG package is needed for the specified stack. Canvas and SVG are browser features.
