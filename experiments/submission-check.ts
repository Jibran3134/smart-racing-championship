import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parseExperiment } from '../src/shared/experiment-results';

const root = fileURLToPath(new URL('../', import.meta.url));
const missing: string[] = [];
async function read(path: string): Promise<string> { try { return await readFile(join(root, path), 'utf8'); } catch { return ''; } }
for (const path of ['package.json', 'package-lock.json', 'README.md', 'Project.pdf', 'DAA Project division.docx', 'public/audio/CREDITS.txt', 'docs/report/jibran-contribution.md']) {
  if (!(await read(path)).length) missing.push(`Missing required source/document: ${path}`);
}
for (const experiment of [1, 2, 3, 4, 5]) {
  try {
    const bundle = parseExperiment(await read(`experiments/results/experiment-${experiment}.json`));
    if (bundle.experiment !== experiment) throw new Error('Mismatched experiment identity.');
    if (bundle.checks.some((check) => !check.passed)) missing.push(`Experiment ${experiment} has failed checks.`);
    if (bundle.config.runs < 5 || bundle.config.warmups < 1) missing.push(`Experiment ${experiment} needs at least five measured runs after warm-up.`);
  } catch { missing.push(`Experiment ${experiment} valid measured results JSON is missing or pending integration.`); continue; }
  for (const suffix of ['raw.csv', 'summary.csv', 'report.md']) if (!(await read(`experiments/results/experiment-${experiment}.${suffix}`))) missing.push(`Experiment ${experiment} ${suffix} is missing.`);
}
for (const path of ['src/core/types.ts', 'src/core/config.ts']) if ((await read(path)).includes('export {};')) missing.push(`${path} is still an unfrozen shared placeholder.`);
let circuits: string[] = []; try { circuits = (await readdir(join(root, 'src/data/tracks'))).filter((path) => path.endsWith('.json')); } catch { /* Recorded below. */ }
if (circuits.length < 3) missing.push('Three production circuit JSON files are not present in src/data/tracks.');
const report = await read('docs/report/technical-report.pdf');
if (!report.startsWith('%PDF-') || report.length < 1000) missing.push('Final technical report PDF is missing: docs/report/technical-report.pdf.');
try {
  const metadata = JSON.parse(await read('docs/submission.json'));
  if (!Array.isArray(metadata.registrationNumbers) || metadata.registrationNumbers.length !== 2 || !metadata.registrationNumbers.every((id: unknown) => typeof id === 'string' && /^\d{2}[A-Z]-\d{4}$/.test(id)) || new Set(metadata.registrationNumbers).size !== 2 || typeof metadata.section !== 'string' || !/^[a-zA-Z0-9-]{1,20}$/.test(metadata.section)) missing.push('Both registration numbers and the section must be filled in docs/submission.json.');
  else console.info(`Required ZIP filename: ${metadata.registrationNumbers.join('_')}_${metadata.section}.zip`);
} catch { missing.push('Submission metadata is missing or invalid.'); }
if (missing.length) { console.error(`Submission is not ready (${missing.length} outstanding checks):\n${missing.map((item) => `- ${item}`).join('\n')}`); process.exitCode = 1; }
else console.info('Required-file preflight passed. Still perform joint content review, clean-extraction install/build/run, ZIP integrity and malware checks before submitting.');
console.info('This is a read-only preflight. It does not build a ZIP, upload coursework or certify algorithm correctness.');
