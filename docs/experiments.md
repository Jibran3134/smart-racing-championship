# Reproducible experiments and evidence

Experiments 1 and 4 import the same `src/core` implementations used by the Explorer, Algorithm Lab and supplied-route racing demo. No algorithm dependency was added. Experiments 2, 3 and 5 await their assigned modules.

## Run

```sh
npm run experiments -- --experiment all
npm run experiments -- --experiment 1 --sizes 64,256,1024 --seed 20261117 --warmups 2 --runs 5
npm run experiments -- --experiment 4 --sizes 100,1000,10000 --seed 20261117 --warmups 2 --runs 5
```

On PowerShell, use `npm.cmd` if execution policy prevents the `npm.ps1` shim from running. Running `npm run experiments` without arguments prints help. Each execution overwrites that experiment's previous output files, so copy evidence you want to retain before a new run.

The CLI accepts experiments `1`, `4`, or `all`; a uint32 seed; 5–30 measured runs; 1–10 warm-ups; and 2–8 distinct sizes. Graph sizes are capped at 2048 to bound dense-case memory. Event sizes are capped at 100000. Defaults are 64/256/1024 vertices and 100/1000/10000 events. Small test sizes are used in automated verification; they are not substituted for the default study evidence.

Outputs in `experiments/results/`:

- `experiment-N.json`: raw measurements, seeds, configuration, environment, methodology, counter definitions and recorded checks.
- `experiment-N.raw.csv`: every measured run; no warm-ups.
- `experiment-N.summary.csv`: per-case/algorithm/phase mean, median, population standard deviation, minimum, maximum and mean counters.
- `experiment-N.report.md`: objective/procedure, machine, reproduction command, measured table, correctness evidence, interpretation, limits and conclusion.

Outputs are ignored by Git. Include them explicitly in the final submission; a tracked-files-only ZIP will omit them. Seeds reproduce datasets and counters, not exact wall-clock timings.

## Experiment 1

Four undirected simple-graph families use a stable uint32 LCG: random sparse trees; trees with sparse extra cyclic edges; trees with a 12% chance of each possible additional edge; and two disconnected trees. Both algorithms use identical adjacency lists and traverse the component reachable from vertex 0. Measured algorithm order alternates between BFS-first and DFS-first.

Timing includes the production function's validation, internal sets/maps, result allocation and counters. It excludes dataset generation, tracing, correctness checks, rendering and file I/O. Tracing is disabled. Ordinary DFS traversal is measured; dead-end analysis and bounded alternative-path enumeration are separate operations with different worst-case costs.

Untimed checks use disjoint-set connectivity over the edge list, component edge counts for cycles, and the production connected-components result. BFS minimum edge count is certified by its parent depths and each reachable arc's triangle inequality. Reachability and exact visited/examined-arc counters are checked for both algorithms. Each reachable undirected edge contributes two examined arcs. The disconnected case intentionally visits fewer than V vertices.

## Experiment 4

Three families cover mixed timestamps/priorities, exact timestamp/priority ties and lazy cancellation of every fourth scheduled ID. Each trial uses a fresh production EventQueue. Insertion, cancellation and bulk extraction are separate timed intervals. Queue construction, datasets, reference sorting, validation and I/O are excluded. Internal ID maps, event copies, returned arrays and counters remain included.

Counters are phase deltas. A cancelled ID is removed from the live map immediately, but its heap entry stays until extraction. Consequently, cancellation performs zero heap operations and retains n heap entries; a full drain still physically pops n entries, returning only n minus the cancelled count. `heapOps` means pushes plus pops; comparator calls and swaps have separate counters. The input ID history is intentionally retained by EventQueue to reject ID reuse even after its heap drains.

Every measured drain is checked outside timing against a reference ordering by `(triggerTime, priority, insertionSequence)`. Native sorting is an independent oracle, not a replacement algorithm. Separate EventProcessor assertions cover all six effects, same-time priority, cancellation, missing targets, maximum oil penalty, strictest speed cap, independent expiry, station restoration and consumed nitro.

## Inspect and export

Open **Algorithm Lab → Experiment results**, import either JSON output, select a family and metric, then inspect the chart and table. Numeric input sizes use proportional spacing. Mean runtimes have six decimal places in the table; CSV retains full numeric precision. Inspect median/dispersion and raw samples before interpreting apparent speed differences.

The viewer never fabricates timings. It validates version, fields, finite/nonnegative values, complete run groups and duplicate runs before importing. Invalid files preserve the currently displayed evidence and show an error. Failed recorded checks remain visible and are marked unverified. Structural validation does not authenticate a file or rerun its algorithms. Files are limited to 5 MB.

Raw CSV, summary CSV and JSON can be downloaded. Shared serialization quotes CSV commas/quotes/newlines and prefixes spreadsheet formulas in text cells; numeric negative values remain numbers. Metadata and imported strings are rendered as text.

## Initial run and limits

The first full run on 17 November 2026 used Node 24.19.0, Windows x64, a 12th Gen Intel Core i7-1265U, two warm-ups and five measured runs per group. It produced 120 exploration samples / 12 checks and 105 event samples / 14 checks. The local result files contain exact environment and timestamp details.

At 1024 vertices, the dense graph had 127884 adjacency arcs, and both traversals examined all of them. At 10000 events, cancelling 2500 IDs left 10000 retained heap entries until extraction, which popped every entry and returned 7500 live events. These operation counts verify the intended workload; they do not prove timing-based complexity. Mean runtime ratios vary by size/family and include JIT, GC, allocation and machine-load effects. No universal BFS-versus-DFS winner is claimed.

## Shared handoff

`src/shared/experiment-results.ts` provides the provisional version 1 evidence interface, parser and aggregators. Experiments 2/3/5 can use `ExperimentBundle` with their own algorithm names, phases and numeric counters. Coordinate changes before depending on it. This evidence interface does not freeze the jointly owned game model or configuration. Each case ID must denote a stable dataset; samples within each algorithm/phase group share its family, size, seed and counter keys, with exactly the configured number of distinct run indices.
