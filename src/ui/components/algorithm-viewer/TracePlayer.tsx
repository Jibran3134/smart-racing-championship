import { useEffect, useState } from 'react';
import { TrackMap } from '../map/TrackMap';
import type { TrackMapData } from '../map/map-model';

/** Structural adapter: future routing traces can supply this UI view directly. */
export interface TraceFrame {
  type: 'visit' | 'relax' | 'push' | 'pop' | 'done';
  vertex?: number;
  edge?: string;
  counters: { expandedVertices: number; relaxedEdges: number; heapOps: number; comparisons: number; examinedEdges?: number };
  frontier?: readonly number[];
  visited?: readonly number[];
}

export function TracePlayer({ steps, track, showLabels, frontierLabel }: { steps: readonly TraceFrame[]; track: TrackMapData; showLabels: boolean; frontierLabel: string }) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [delay, setDelay] = useState(300);
  const running = playing && cursor < steps.length;
  const frame = cursor > 0 ? steps[cursor - 1] : undefined;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setCursor((current) => Math.min(steps.length, current + 1)), delay);
    return () => window.clearInterval(timer);
  }, [running, delay, steps.length]);

  return <div className="lab-layout">
    <section className="panel">
      <div className="panel-heading"><h2>Traversal replay</h2><span className="tag muted-tag">{cursor} / {steps.length} steps</span></div>
      <TrackMap track={track} showLabels={showLabels} selectedVertex={frame?.vertex} activeEdge={frame?.edge} visitedVertices={frame?.visited} frontierVertices={frame?.frontier} />
      <div className="playback-controls">
        <button className="button primary" disabled={cursor >= steps.length} onClick={() => setPlaying(!running)}>{running ? 'Pause' : 'Play'}</button>
        <button className="button secondary" disabled={running || cursor >= steps.length} onClick={() => setCursor((value) => value + 1)}>Step</button>
        <button className="text-button" onClick={() => { setPlaying(false); setCursor(0); }}>Reset replay</button>
        <div className="speed-label"><label htmlFor="playback-speed">Playback speed</label><select id="playback-speed" value={delay} onChange={(event) => setDelay(Number(event.target.value))}><option value={700}>Slow</option><option value={300}>Normal</option><option value={100}>Fast</option></select></div>
      </div>
      <p className="lab-message" role="status">{!frame ? 'Ready. Step or play to begin.' : frame.type === 'done' ? 'Traversal complete.' : `${frame.type.toUpperCase()}${frame.vertex !== undefined ? ` vertex ${frame.vertex}` : ''}${frame.edge ? ` via ${frame.edge}` : ''}`}</p>
    </section>
    <aside className="panel inspector"><p className="eyebrow">LIVE TRACE</p><h2>State at this step</h2><dl className="details-list"><div><dt>Expanded vertices</dt><dd>{frame?.counters.expandedVertices ?? 0}</dd></div><div><dt>Examined edges</dt><dd>{frame?.counters.examinedEdges ?? 0}</dd></div><div><dt>Relaxed edges</dt><dd>{frame?.counters.relaxedEdges ?? 0}</dd></div><div><dt>Heap operations</dt><dd>{frame?.counters.heapOps ?? 0}</dd></div><div><dt>Comparisons</dt><dd>{frame?.counters.comparisons ?? 0}</dd></div></dl><h3 className="field-label">{frontierLabel}</h3><div className="state-chips">{frame?.frontier?.length ? frame.frontier.map((id, index) => <span key={`${id}-${index}`} className="frontier-chip">{id}</span>) : <span className="small-text">Empty</span>}</div><h3 className="field-label">Visited / expanded</h3><div className="state-chips">{frame?.visited?.length ? frame.visited.map((id) => <span key={id}>{id}</span>) : <span className="small-text">None yet</span>}</div><div className="notice"><h3>Replay the same computation</h3><p>These snapshots come from the same BFS/DFS functions used by Track Explorer. Green vertices have been visited; amber vertices are in the frontier.</p></div></aside>
  </div>;
}
