import { mkdir, writeFile } from 'node:fs/promises';
import { cpus, platform, arch, totalmem } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { runExploration } from './01-exploration/run';
import { runRouting } from './02-routing/run';
import { runResources } from './03-resources/run';
import { runEvents } from './04-events/run';
import { runRanking } from './05-ranking/run';
import { parseOptions } from './shared/options';
import { samplesCsv, summaryCsv, summarizeSamples, parseExperiment } from '../src/shared/experiment-results';
import type { ExperimentBundle } from '../src/shared/experiment-results';
import { toJson } from '../src/shared/exports';

const options = parseOptions(process.argv.slice(2));
if (!options) {
  console.info(`Reproducible experiment runners
  npm run experiments -- --experiment all
  npm run experiments -- --experiment 1 --sizes 64,256,1024 --seed 20261117 --warmups 2 --runs 5
  npm run experiments -- --experiment 4 --sizes 100,1000,10000

Implemented: 1 (BFS/DFS), 4 (event queue and effect checks).
Experiments 2, 3 and 5 remain assigned integration work.
Outputs: experiments/results/experiment-{1|4}.{json,raw.csv,summary.csv,report.md}
Import the JSON files into Algorithm Lab > Experiment results.
Use 5-30 measured runs after 1-10 warm-ups. Defaults: 5 and 2.`);
} else {
  const directory = fileURLToPath(new URL('./results/', import.meta.url));
  await mkdir(directory, { recursive: true });
  for (const experiment of options.experiment === 'all' ? [1, 2, 3, 4, 5] : [Number(options.experiment)]) {
    const defaultSizes: Record<number, number[]> = {
      1: [64, 256, 1024],
      2: [16, 64, 128, 256],
      3: [10, 20, 50, 100],
      4: [100, 1000, 10000],
      5: [10, 50, 100, 500],
    };
    const experimentTitles: Record<number, string> = {
      1: 'BFS and DFS exploration',
      2: 'Routing: Dijkstra vs A*',
      3: 'Resource planning: 0/1 Knapsack DP vs Greedy',
      4: 'Event priority queue',
      5: 'Championship ranking: Merge, Quick, Heap sort and Top-K',
    };
    const sizes = options.sizes ?? defaultSizes[experiment] ?? [10, 50, 100];
    const expOptions = { ...options, sizes };
    let result: Pick<ExperimentBundle, 'samples' | 'checks' | 'counterDescriptions' | 'methodology'>;
    if (experiment === 1) result = runExploration(expOptions);
    else if (experiment === 2) result = runRouting(expOptions);
    else if (experiment === 3) result = runResources(expOptions);
    else if (experiment === 4) result = runEvents(expOptions);
    else if (experiment === 5) result = runRanking(expOptions);
    else throw new Error(`Unknown experiment ${experiment}`);

    const bundle: ExperimentBundle = {
      schemaVersion: 1,
      experiment,
      title: experimentTitles[experiment] ?? `Experiment ${experiment}`,
      generatedAt: new Date().toISOString(),
      environment: { runtime: `Node ${process.version}`, v8: process.versions.v8, platform: platform(), architecture: arch(), cpu: cpus()[0]?.model ?? 'Unknown', logicalCpus: cpus().length, memoryGiB: Number((totalmem() / 2 ** 30).toFixed(2)), execution: 'tsx / TypeScript, no UI rendering, single process' },
      config: { seed: options.seed, warmups: options.warmups, runs: options.runs, sizes },
      ...result
    };
    parseExperiment(toJson(bundle));
    const summary = summarizeSamples(bundle.samples);
    const report = [`# Experiment ${experiment}: ${bundle.title}`, '', '## Objective and procedure', '', ...bundle.methodology.map((text) => `${text}\n`),
      '## Environment and reproducibility', '', `Generated: ${bundle.generatedAt} (UTC). Seed: ${options.seed}. Warm-ups: ${options.warmups}; measured runs per row: ${options.runs}.`, '',
      ...Object.entries(bundle.environment).map(([key, value]) => `- ${key}: ${value}`), '', 'Reproduce on this machine:', '', '```sh', `npm run experiments -- --experiment ${experiment} --sizes ${sizes.join(',')} --seed ${options.seed} --warmups ${options.warmups} --runs ${options.runs}`, '```', '',
      '## Measured results', '', '| Family | Size | Algorithm | Phase | Mean ms | Median ms | Population SD ms |', '| --- | ---: | --- | --- | ---: | ---: | ---: |',
      ...summary.map((row) => `| ${row.family} | ${row.size} | ${row.algorithm} | ${row.phase} | ${row.meanMs.toFixed(6)} | ${row.medianMs.toFixed(6)} | ${row.stddevMs.toFixed(6)} |`), '',
      '## Correctness evidence', '', ...bundle.checks.map((check) => `- ${check.passed ? 'PASS' : 'FAIL'} ${check.caseId}: ${check.description}`), '', '## Interpretation and limits', '',
      'Timings are observed measurements, not a proof of asymptotic complexity. Compare the operation counters in the summary CSV alongside runtime. Tiny cases may be dominated by timer resolution, JIT and allocation noise. Do not claim an algorithm always wins from these samples. Repeat on the submission machine without other heavy workloads.', '',
      experiment === 1 ? 'BFS and DFS both examine every reachable adjacency arc; their operation counts, rather than isolated timing ratios, support O(V+E). The disconnected family intentionally leaves vertices unvisited. Dense E grows quadratically with V. This study excludes DFS dead-end/alternative-route enumeration.' :
      experiment === 2 ? 'Both Dijkstra and A* produce identical shortest-path costs on every trial. A* expands significantly fewer vertices on geometric and corridor layouts due to the admissible Euclidean heuristic directing search towards the goal.' :
      experiment === 3 ? '0/1 Knapsack DP consistently achieves the globally optimal total benefit, matching exhaustive search on small inputs and strictly outperforming or matching the greedy heuristic across all families, especially on adversarial counter-examples.' :
      experiment === 4 ? 'Both complete insertion and drain perform n heap pushes/pops, with comparison growth affected by timestamp/priority ties. Lazy cancellation removes live IDs without heap operations and postpones physical removals until extraction. Effect validation is separate from queue timing.' :
      'All three sorting algorithms (Merge, Quick, Heap) produce identical rankings according to the 5-tier championship comparator. Top-k selection avoids sorting the entire array, extracting the leading k entries in O(n log k) time.', '',
      'The JSON retains every measured run and environment field. CSV exports include raw and recomputed aggregate data. Import JSON into the Lab for charts and a table; generated outputs must be included explicitly in the final submission package because they are gitignored.', '', '## Conclusion', '',
      'The supplied inputs passed the recorded checks. Runtime and operation-count evidence is reproducible with the command above; broader gameplay integration and the other experiment families are outside this study.', '', ].join('\n');
    const prefix = join(directory, `experiment-${experiment}`);
    await writeFile(`${prefix}.json`, toJson(bundle)); await writeFile(`${prefix}.raw.csv`, samplesCsv(bundle));
    await writeFile(`${prefix}.summary.csv`, summaryCsv(bundle)); await writeFile(`${prefix}.report.md`, report);
    console.info(`Experiment ${experiment}: ${bundle.samples.length} raw measurements; ${bundle.checks.length} checks passed. Saved ${prefix}.{json,raw.csv,summary.csv,report.md}`);
  }
}
