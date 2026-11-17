import { useMemo, useState } from 'react';
import { bfs } from '../../../core/algorithms/exploration/bfs';
import { dfs } from '../../../core/algorithms/exploration/dfs';
import type { ExplorationStep } from '../../../core/algorithms/exploration/contracts';
import { explorationAdapter } from '../../adapters/exploration-adapter';
import { previewTrack } from '../../fixtures/preview-track';
import { TracePlayer } from '../../components/algorithm-viewer/TracePlayer';
import type { TrackMapData } from '../../components/map/map-model';

export function SearchLab({ showLabels, track = previewTrack }: { showLabels: boolean; track?: TrackMapData }) {
  const [algorithm, setAlgorithm] = useState<'bfs' | 'dfs'>('bfs');
  const [source, setSource] = useState(() => track.vertices.find((vertex) => vertex.kind === 'start')?.id ?? track.vertices[0].id);
  const steps = useMemo(() => {
    const trace: ExplorationStep[] = [];
    const graph = explorationAdapter(track);
    (algorithm === 'bfs' ? bfs : dfs)(graph, source, (step) => trace.push(step));
    return trace;
  }, [algorithm, source, track]);
  return <>
    <div className="page-heading"><div><p className="eyebrow">FOLLOW EVERY DECISION</p><h1>Exploration Lab<span className="heading-dot">.</span></h1><p>Step through the queue, stack, visited vertices and operation counters.</p></div><span className="tag">Deterministic replay</span></div>
    <div className="panel search-controls"><div className="field-group"><label htmlFor="lab-algorithm">Algorithm</label><select id="lab-algorithm" value={algorithm} onChange={(event) => setAlgorithm(event.target.value as 'bfs' | 'dfs')}><option value="bfs">Breadth-first search</option><option value="dfs">Depth-first search</option><option disabled>Dijkstra — awaiting routing module</option><option disabled>A* — awaiting routing module</option></select></div><div className="field-group"><label htmlFor="lab-source">Start vertex</label><select id="lab-source" value={source} onChange={(event) => setSource(Number(event.target.value))}>{track.vertices.map((vertex) => <option value={vertex.id} key={vertex.id}>{vertex.label}</option>)}</select></div><p className="small-text">Changing the algorithm or start vertex resets playback. The blocked road is excluded; restricted roads stay traversable.</p></div>
    <TracePlayer key={`${algorithm}-${source}-${track.roads.map((road) => road.status).join(',')}`} steps={steps} track={track} showLabels={showLabels} frontierLabel={algorithm === 'bfs' ? 'Queue / next first' : 'DFS stack / top last'} />
  </>;
}
