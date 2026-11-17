# Iteration 4: experiment and report evidence milestone

Implemented 17 November 2026. This completes the independent experiment/export/chart work and prepares the assigned report contribution. Final championship acceptance, joint report review and submission packaging remain open.

## Delivered

- Experiment 1: production BFS/DFS on four seeded graph families at multiple sizes, alternating run order, warm-ups, repeated measurements, exact visited/arc counters and independent shortest-edge/cycle/component checks.
- Experiment 4: production EventQueue insertion/cancellation/extraction timing, timestamp/priority/sequence ties, retained lazy-deletion storage, phase heap counters and independently ordered expected output.
- Untimed production EventProcessor checks for all six effects, overlapping expiry, target validation, cancellation and pickup consumption.
- Shared version 1 evidence schema, strict results import, raw/summary CSV and JSON serialization, mean/median/population standard deviation, full-precision numeric exports and spreadsheet-safe text quoting.
- Algorithm Lab results workspace: actual evidence imports, family/metric filters, proportional-size charts, tables, machine/procedure/check details and three export actions. No sample timings are presented.
- Reusable shared chart numeric-axis support, preserving category axes for championship charts.
- Reproducibility and format handoff notes in [experiments.md](experiments.md), and the assigned Introduction/GUI/algorithm/integration/tests/experiment report sections in [the report contribution](report/jibran-contribution.md).
- Read-only `npm run submission:check`, with explicit missing-file/integration/metadata reporting. It does not create a ZIP or upload anything.

## Evidence

The default studies ran on the local machine with seed 20261117, two warm-ups and five measured runs. Experiment 1 produced 120 raw measurements and 12 successful checks; Experiment 4 produced 105 measurements and 14 successful checks. Their local JSON files retain timestamps, environment and every measured value. Generated reports/CSVs live in the ignored `experiments/results/` directory and must be included explicitly in the final package.

Browser checks imported both actual result files, changed chart families/counters, verified raw and summary CSV downloads, rejected invalid JSON while preserving previous results, and checked widths 320, 390, 768 and 1440 with no page errors. Required checks are TypeScript, lint, tests and build; run those before reviewing or extending this milestone.

## Still open

1. Agreed core records/configuration, production graph/costs, routing/resources/ranking/generation and official opponents; the supplied-route demo does not replace them.
2. Three production circuits and full championship/preset/top-k integration and acceptance.
3. Experiments 2, 3 and 5 and their report contributions; the shared evidence format is ready for coordination.
4. Joint review, final report PDF at `docs/report/technical-report.pdf`, and real registration numbers/section in `docs/submission.json`.
5. Final ZIP generation, complete raw-result inclusion, clean-extracted install/build/run, corruption/malware checks and authorized submission.

The initial preflight correctly reports eight outstanding groups: three missing study outputs, two shared placeholders, production circuits, final PDF and submission metadata. A passing file preflight will still require a human/joint correctness and packaging review. Shared gameplay types/config were not frozen, and no teammate review or course submission has been claimed.
