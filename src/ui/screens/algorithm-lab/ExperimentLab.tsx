import { lazy, Suspense, useState } from 'react';
import { parseExperiment, samplesCsv, summaryCsv, summarizeSamples } from '../../../shared/experiment-results';
import type { ExperimentBundle } from '../../../shared/experiment-results';
import { toJson } from '../../../shared/exports';
import { downloadText } from '../../components/common/download';
import { chartPaints } from '../../styles/palette';

const SeriesChart = lazy(() => import('../../components/charts/SeriesChart').then((module) => ({ default: module.SeriesChart })));
const colors = chartPaints;

export function ExperimentLab() {
  const [bundle, setBundle] = useState<ExperimentBundle | null>(null);
  const [family, setFamily] = useState('');
  const [metric, setMetric] = useState('runtime');
  const [error, setError] = useState('');
  const summary = bundle ? summarizeSamples(bundle.samples) : [];
  const families = [...new Set(summary.map((row) => row.family))];
  const currentFamily = families.includes(family) ? family : families[0];
  const visible = summary.filter((row) => row.family === currentFamily).sort((a, b) => a.size - b.size);
  const seriesNames = [...new Set(visible.map((row) => `${row.algorithm} / ${row.phase}`))];
  const series = seriesNames.map((label, index) => ({ label, key: `series${index}`, color: colors[index % colors.length] }));
  const counters = [...new Set(visible.flatMap((row) => Object.keys(row.counters)))];
  const activeMetric = metric === 'runtime' || counters.includes(metric) ? metric : 'runtime';
  const chartData = [...new Set(visible.map((row) => row.size))].map((size) => {
    const point: Record<string, number> = { size };
    for (const row of visible.filter((entry) => entry.size === size)) point[`series${seriesNames.indexOf(`${row.algorithm} / ${row.phase}`)}`] = activeMetric === 'runtime' ? row.meanMs : row.counters[activeMetric];
    return point;
  });

  return <>
    <div className="page-heading"><div><p className="eyebrow">MEASURE. VERIFY. COMPARE.</p><h1>Experiment results<span className="heading-dot">.</span></h1><p>Inspect measured runs, operation counters and correctness evidence.</p></div><label className="button primary experiment-import">Import results JSON<input aria-label="Import experiment results" type="file" accept=".json,application/json" onChange={async (event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
      if (!file) return;
      try {
        if (file.size > 5_000_000) throw new Error('Results file exceeds the 5 MB limit.');
        const result = parseExperiment(await file.text()); setBundle(result); setFamily(''); setMetric('runtime'); setError('');
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not read results.'); }
    }} /></label></div>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {!bundle ? <section className="panel integration-state"><p className="eyebrow">REPRODUCIBLE EVIDENCE</p><h2>Run the studies, then load the measurements.</h2><p>No example timings are displayed. Run these commands from the project folder:</p><pre className="experiment-command">npm run experiments -- --experiment all</pre><p>Import <code>experiments/results/experiment-1.json</code> or <code>experiment-4.json</code>. The runner also saves raw CSV, summary CSV and a report with the environment and procedure.</p><p>Experiments 1 and 4 are available. The shared results format supports the remaining studies when their runners are integrated.</p></section> : <>
      <section className="panel experiment-overview"><div className="panel-heading"><div><p className="eyebrow">EXPERIMENT {bundle.experiment}</p><h2>{bundle.title}</h2></div><span className="tag">{bundle.samples.length} measured samples</span></div>
        <div className="experiment-meta"><span>Seed <strong>{bundle.config.seed}</strong></span><span>Warm-ups <strong>{bundle.config.warmups}</strong></span><span>Runs per case <strong>{bundle.config.runs}</strong></span><span>Generated <strong>{new Date(bundle.generatedAt).toLocaleString()}</strong></span></div>
        {bundle.config.runs < 5 && <p className="notice">Fewer than the recommended five measured runs are present.</p>}
        {bundle.checks.some((check) => !check.passed) && <p className="error-banner" role="alert">This file contains failed correctness checks. Treat its timing results as unverified.</p>}
        <div className="playback-controls"><button className="button secondary" onClick={() => downloadText(`experiment-${bundle.experiment}.raw.csv`, samplesCsv(bundle), 'text/csv;charset=utf-8')}>Export raw CSV</button><button className="button secondary" onClick={() => downloadText(`experiment-${bundle.experiment}.summary.csv`, summaryCsv(bundle), 'text/csv;charset=utf-8')}>Export summary CSV</button><button className="button secondary" onClick={() => downloadText(`experiment-${bundle.experiment}.json`, toJson(bundle), 'application/json')}>Export results JSON</button></div>
      </section>
      <div className="experiment-grid"><section className="panel"><div className="experiment-filters"><label>Graph / event family<select aria-label="Experiment family" value={currentFamily} onChange={(event) => setFamily(event.target.value)}>{families.map((value) => <option key={value}>{value}</option>)}</select></label><label>Chart metric<select aria-label="Experiment metric" value={activeMetric} onChange={(event) => setMetric(event.target.value)}><option value="runtime">Mean runtime (ms)</option>{counters.map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
        <Suspense fallback={<p className="lab-message">Loading chart...</p>}><SeriesChart label={activeMetric === 'runtime' ? 'Mean algorithm runtime in milliseconds' : `Mean ${activeMetric}`} data={chartData} xKey="size" numericX series={series} /></Suspense>
        <p className="lab-message">{activeMetric === 'runtime' ? 'Mean across measured runs; warm-ups excluded. Inspect dispersion and raw runs before drawing conclusions.' : bundle.counterDescriptions[activeMetric] ?? 'Mean counter value across measured runs.'}</p>
        <div className="table-scroll"><table><caption>Measured summaries for {currentFamily}</caption><thead><tr><th>Size</th><th>Algorithm / phase</th><th>Mean ms</th><th>Median ms</th><th>SD ms</th><th>Runs</th></tr></thead><tbody>{visible.map((row) => <tr key={`${row.caseId}-${row.algorithm}-${row.phase}`}><th scope="row">{row.size}</th><td>{row.algorithm} / {row.phase}</td><td>{row.meanMs.toFixed(6)}</td><td>{row.medianMs.toFixed(6)}</td><td>{row.stddevMs.toFixed(6)}</td><td>{row.runs}</td></tr>)}</tbody></table></div>
      </section><aside className="panel inspector"><p className="eyebrow">MEASUREMENT CONTEXT</p><h2>Environment</h2><dl className="details-list">{Object.entries(bundle.environment).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl><h3>Procedure and limits</h3>{bundle.methodology.map((text, index) => <p className="small-text" key={index}>{text}</p>)}</aside></div>
      <section className="panel experiment-checks"><div className="panel-heading"><h2>Correctness checks</h2><span className="tag">{bundle.checks.filter((check) => check.passed).length} / {bundle.checks.length} passed</span></div><ul>{bundle.checks.map((check, index) => <li key={index}><strong>{check.passed ? 'PASS' : 'FAIL'} / {check.caseId}</strong><p>{check.description}</p></li>)}</ul><p className="lab-message">These are checks recorded by the runner. Importing a file validates its structure; it does not independently rerun the algorithms or authenticate externally edited evidence.</p></section>
    </>}
  </>;
}
