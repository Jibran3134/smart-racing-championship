import { useEffect, useId, useState } from 'react';
import type { LabTrace } from '../../adapters/algorithm-lab';
import { TrackMap } from '../map/TrackMap';

export function AlgorithmTracePlayer({ trace, showLabels }: { trace: LabTrace; showLabels: boolean }) {
  const [cursor, setCursor] = useState(0), [playing, setPlaying] = useState(false), [delay, setDelay] = useState(300);
  const sliderId = useId(), speedId = useId();
  const frame = cursor ? trace.steps[cursor - 1] : undefined;
  const running = playing && cursor < trace.steps.length;
  const track = frame?.graph?.track ?? trace.track;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setCursor((value) => Math.min(trace.steps.length, value + 1)), delay);
    return () => window.clearInterval(timer);
  }, [running, trace.steps.length, delay]);
  useEffect(() => {
    const hidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', hidden);
    return () => document.removeEventListener('visibilitychange', hidden);
  }, []);

  return <div className="algorithm-trace-layout">
    <section className="panel"><div className="panel-heading"><h2>{trace.title} replay</h2><span className="tag">{cursor} / {trace.steps.length} steps</span></div>
      {track && <TrackMap track={track} showLabels={showLabels} accessibleName="Algorithm trace map" selectedVertex={frame?.graph?.vertex} activeEdge={frame?.graph?.edge} frontierVertices={frame?.graph?.frontier} visitedVertices={frame?.graph?.visited} highlightedRoads={frame?.graph?.routeEdges} statusLabel="Captured computation" />}
      {frame?.array && <div className="trace-array" role="group" aria-label="Algorithm array state">{frame.array.length ? frame.array.map((item, index) => <div key={index} className={item.active ? 'active-array-item' : ''}><small>{item.label}</small><strong>{item.value}</strong></div>) : <p className="small-text">The array is empty.</p>}</div>}
      {frame?.table && <div className="table-scroll"><table><caption>State at step {cursor}</caption><thead><tr>{frame.table.columns.map((column, index) => <th scope="col" key={index}>{column}</th>)}</tr></thead><tbody>{frame.table.rows.map((row, index) => <tr key={index}>{row.map((value, column) => <td key={column}>{value === null ? '—' : String(value)}</td>)}</tr>)}</tbody></table></div>}
      {!track && !frame && <div className="trace-ready"><p className="eyebrow">CAPTURED STATE</p><h3>Step through the computation.</h3><p>Array, table and state snapshots appear as you move through the trace.</p></div>}
      <div className="playback-controls"><button className="button primary" disabled={cursor === trace.steps.length} onClick={() => setPlaying(!running)}>{running ? 'Pause trace' : 'Play trace'}</button><button className="button secondary" disabled={running || cursor === trace.steps.length} onClick={() => setCursor(cursor + 1)}>Next step</button><button className="button secondary" disabled={running || cursor === 0} onClick={() => setCursor(cursor - 1)}>Previous step</button><button className="text-button" onClick={() => { setPlaying(false); setCursor(0); }}>Reset trace</button><button className="text-button" onClick={() => { setPlaying(false); setCursor(trace.steps.length); }}>Go to result</button><div className="speed-label"><label htmlFor={speedId}>Trace speed</label><select id={speedId} value={delay} onChange={(event) => setDelay(Number(event.target.value))}><option value={700}>Slow</option><option value={300}>Normal</option><option value={100}>Fast</option></select></div></div>
      <div className="trace-seek"><label htmlFor={sliderId}>Trace position</label><input id={sliderId} type="range" min={0} max={trace.steps.length} value={cursor} onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }} /></div>
      <p className="lab-message" role="status">{frame?.message ?? 'Ready. Step or play to inspect the recorded computation.'}</p>
      {cursor === trace.steps.length && <section className="trace-result" aria-label="Algorithm result"><h3>Algorithm result</h3><dl className="details-list">{Object.entries(trace.summary).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null ? '—' : String(value)}</dd></div>)}</dl></section>}
    </section>
    <aside className="panel inspector"><p className="eyebrow">LIVE STEP COUNTERS</p><h2>State at this step</h2><dl className="details-list">{Object.entries(frame?.counters ?? trace.steps[0].counters).map(([key, value]) => <div key={key}><dt title={trace.counterDescriptions[key]}>{key}</dt><dd>{frame ? value : 0}</dd></div>)}</dl>
      <h3>State values</h3><dl className="details-list">{Object.entries(frame?.state ?? {}).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === null ? '—' : String(value)}</dd></div>)}</dl>
      {frame?.graph && <><h3>Frontier</h3><p className="trace-id-list">{frame.graph.frontier?.join(', ') || 'Empty'}</p><h3>Visited / expanded</h3><p className="trace-id-list">{frame.graph.visited?.join(', ') || 'None'}</p></>}
      <details><summary>Counter definitions</summary>{Object.entries(trace.counterDescriptions).map(([key, value]) => <p className="small-text" key={key}><strong>{key}:</strong> {value}</p>)}</details>
      <p className="small-text">Playback reads saved snapshots. It does not rerun the algorithm or advance a race. Trace allocation is excluded from the timing studies.</p>
    </aside>
  </div>;
}
