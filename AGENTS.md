# Smart Racing Championship

## Architecture
- TypeScript, React, Vite, Tailwind CSS, Framer Motion, Recharts and Vitest.
- Keep `src/core` pure: no UI imports, DOM access, React or rendering side effects.
- The game, Algorithm Lab and Node experiments must call the same core functions.
- Implement course algorithms by hand; do not install algorithm libraries.
- Keep algorithms deterministic and expose operation counters and optional trace steps.
- Agree on `src/core/types.ts` and `src/core/config.ts` together before freezing them.
- `Project.pdf` is the full assignment brief and the source of truth for required behavior. Consult it alongside `DAA Project division.docx`; document and jointly agree on tunable values and rules left open by the brief.

## Ownership
- Jibran: all UI, BFS/DFS, generic heap, event queue/effects, experiments 1/4, preset comparison.
- Alishba: graph/costs, routing, engine/opponents, resources, ranking, generation, circuits, experiments 2/3/5.
- Both: shared interfaces/configuration, integration and cross-review.

## Verification
- Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` after relevant changes.
- Unit tests live alongside core modules or in `tests/unit`; integration tests in `tests/integration`.
- UI tests in `tests/ui` use `// @vitest-environment jsdom`.
- Keep generated experiment outputs out of version control; retain reproducible inputs and seeds.
