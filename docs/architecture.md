# Setup and integration notes

Source of requirements: `Project.pdf` (14 pages). Source of ownership and schedule: `DAA Project division.docx`, prepared 17 November 2026. See `project-brief-review.md` for the detailed reconciliation.

Dependencies installed for the planned work: React/React DOM, Framer Motion, Recharts; Vite/React plugin, TypeScript, Tailwind/Vite plugin, Vitest/V8 coverage, Testing Library/jest-dom, jsdom, tsx, ESLint and TypeScript/React lint plugins.

Tailwind uses its official Vite plugin and CSS import: https://tailwindcss.com/docs/installation/using-vite
Vitest configuration reference: https://vitest.dev/config/

## Integration boundaries

- `src/app` composes screens and navigation; `src/ui` renders data from the core.
- `src/core` contains hand-written, deterministic game and algorithm logic. ESLint rejects imports of UI modules and the main rendering libraries here.
- `src/core/structures` supplies the generic min-heap for events, routing, MST and top-k.
- `src/core/types.ts` will define shared graph, route, trace, event, engine state and ranking records.
- `src/core/config.ts` will hold all agreed game constants and preset normalization.
- `experiments` imports the same `src/core` functions as the app and records timings, counters and correctness results.
- Tests use Node by default. UI tests opt into jsdom with a file-level Vitest environment comment.

## Contract still to agree

The full brief is now available as `Project.pdf`. Sections 3 and 4 supply the record fields, six event definitions, scoring table and suggested fuel/nitro defaults. The team must still agree on normalization references, weights, tunable values, recovery policy and other open semantics before freezing the contract. The two shared files remain intentional placeholders until that agreement.

## Folder conventions

Use `.test.ts` for core tests and `.test.tsx` for UI tests. Keep reusable test graphs in `tests/fixtures`. Numbered experiment folders map directly to the five experiments in the division. Keep report sources and experiment analysis under `docs`; generated benchmark CSV/JSON belongs in `experiments/results`.
