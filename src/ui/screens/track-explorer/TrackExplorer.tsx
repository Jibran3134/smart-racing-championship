import { useMemo, useState } from 'react';
import { TrackMap } from '../../components/map/TrackMap';
import { previewTrack } from '../../fixtures/preview-track';
import { explorationAdapter } from '../../adapters/exploration-adapter';
import { bfs } from '../../../core/algorithms/exploration/bfs';
import { dfs, connectedComponents, analyzeDeadEnds } from '../../../core/algorithms/exploration/dfs';
import { reconstructPath } from '../../../core/algorithms/exploration/contracts';
import { alternativeRoutes } from '../../../core/algorithms/exploration/alternativeRoutes';
import type { MapRoad, TrackMapData } from '../../components/map/map-model';
import { PresetComparison } from '../../components/map/PresetComparison';
import type { PresetProvider } from '../../adapters/preset-view';

const limits = { maxRoutes: 4, maxEdges: 14, maxExpansions: 2000 };

export function TrackExplorer({ showLabels, track: sharedTrack, onChangeRoad, onRestoreRoads, presetProvider }: { showLabels: boolean; track?: TrackMapData; onChangeRoad?: (id: string, status: MapRoad['status']) => void; onRestoreRoads?: () => void; presetProvider?: PresetProvider }) {
  const initialTrack = sharedTrack ?? previewTrack;
  const defaultStart = initialTrack.vertices.find((vertex) => vertex.kind === 'start')?.id ?? initialTrack.vertices[0].id;
  const [selected, setSelected] = useState(defaultStart);
  const [source, setSource] = useState(defaultStart);
  const [target, setTarget] = useState(initialTrack.vertices.find((vertex) => vertex.checkpointOrder === 6)?.id ?? initialTrack.vertices.at(-1)!.id);
  const [routeIndex, setRouteIndex] = useState(0);
  const [roadId, setRoadId] = useState(initialTrack.roads[0].id);
  const [originalRoads] = useState(() => new Map(initialTrack.roads.map((road) => [road.id, road.status])));
  const [overrides, setOverrides] = useState<Record<string, MapRoad['status']>>({});
  const track = useMemo(() => sharedTrack ?? ({ ...previewTrack, roads: previewTrack.roads.map((road) => ({ ...road, status: overrides[road.id] ?? road.status })) }), [sharedTrack, overrides]);
  const changeRoad = (id: string, status: MapRoad['status']) => {
    if (onChangeRoad) onChangeRoad(id, status);
    else setOverrides((previous) => ({ ...previous, [id]: status }));
    setRouteIndex(0);
  };
  const analysis = useMemo(() => {
    const graph = explorationAdapter(track);
    const breadth = bfs(graph, source);
    const depth = dfs(graph, source);
    const main = reconstructPath(breadth, source, target);
    const alternatives = alternativeRoutes(graph, source, target, main?.edges ?? [], limits);
    return { breadth, depth, main, alternatives, components: connectedComponents(graph), deadEnds: analyzeDeadEnds(graph, depth, target) };
  }, [track, source, target]);
  const routes = analysis.main ? [analysis.main, ...analysis.alternatives.routes] : [];
  const route = routes[routeIndex];
  const vertex = track.vertices.find((item) => item.id === selected)!;
  const road = track.roads.find((item) => item.id === roadId)!;
  const reachable = new Set(analysis.breadth.order);
  const checkpoints = track.vertices.filter((item) => item.kind === 'checkpoint' && reachable.has(item.id));
  const options = track.vertices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>);

  return <>
    <div className="page-heading"><div><p className="eyebrow">CIRCUIT WORKSPACE</p><h1>Track Explorer<span className="heading-dot">.</span></h1><p>Find reachable checkpoints, compare simple paths and test a road closure.</p></div><span className="tag">BFS / DFS connected</span></div>
    <div className="panel search-controls"><div className="field-group"><label htmlFor="explorer-source">Start vertex</label><select id="explorer-source" value={source} onChange={(event) => { setSource(Number(event.target.value)); setRouteIndex(0); }}>{options}</select></div><div className="field-group"><label htmlFor="explorer-target">Destination vertex</label><select id="explorer-target" value={target} onChange={(event) => { setTarget(Number(event.target.value)); setRouteIndex(0); }}>{options}</select></div><p className="small-text">BFS minimizes the number of edges. These exploratory paths do not enforce racing checkpoint order.</p></div>
    <div className="explorer-layout"><div className="explorer-main"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">LAYOUT PREVIEW</p><h2>{track.name}</h2></div><span className="small-text">Select a vertex to inspect</span></div><TrackMap track={track} selectedVertex={selected} onSelectVertex={setSelected} showLabels={showLabels} highlightedRoads={route?.edges} />
      <div className="route-summary" role="status">{route ? `${routeIndex === 0 ? 'BFS minimum-edge route' : `Alternative ${routeIndex}`}: ${route.vertices.join(' → ')} · ${route.edges.length} edges` : 'No route reaches this destination from the selected start.'}</div>
    </section>
    <section className="panel route-panel"><h2>Candidate paths</h2><div className="route-options">{routes.map((candidate, index) => <button key={index} aria-pressed={index === routeIndex} onClick={() => setRouteIndex(index)}><strong>{index === 0 ? 'BFS route' : `Alternative ${index}`}</strong><span>{candidate.edges.length} edges · {candidate.vertices.join(' → ')}</span></button>)}</div><p className="small-text">Alternatives: up to {limits.maxRoutes} paths, {limits.maxEdges} edges per path and {limits.maxExpansions} examined candidates. {analysis.alternatives.truncated ? 'A search bound was reached; more paths may exist.' : 'Search completed within these bounds.'}</p><div className="notice"><h3>Weighted routing is next</h3><p>Distance, travel time and scalar cost will be shown when the shared route model and Dijkstra/A* are available. Minimum edge count does not imply shortest distance or fastest time.</p></div></section>
    <section className="panel route-panel"><h2>Reachable checkpoints</h2><p className="small-text">{checkpoints.length} of {track.vertices.filter((item) => item.kind === 'checkpoint').length} checkpoints reachable from vertex {source}.</p><div className="state-chips">{checkpoints.map((item) => <button key={item.id} aria-label={`Inspect ${item.label}`} onClick={() => setSelected(item.id)}>{item.label}</button>)}</div></section></div>
    <aside className="panel inspector"><p className="eyebrow">VERTEX INSPECTOR</p><h2>{vertex.label}</h2><dl className="details-list"><div><dt>Vertex ID</dt><dd>{vertex.id.toString().padStart(2, '0')}</dd></div><div><dt>Type</dt><dd>{vertex.kind}</dd></div><div><dt>Map coordinates</dt><dd>{vertex.x}, {vertex.y}</dd></div><div><dt>Checkpoint order</dt><dd>{vertex.checkpointOrder ?? '—'}</dd></div><div><dt>Reachable from start</dt><dd>{reachable.has(vertex.id) ? 'Yes' : 'No'}</dd></div></dl>
      <label className="field-label" htmlFor="inspect-vertex">Jump to vertex</label><select id="inspect-vertex" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{options}</select>
      <h3 className="inspector-section">Graph analysis</h3><dl className="details-list"><div><dt>Connected components</dt><dd>{analysis.components.length}</dd></div><div><dt>Reachable cycle</dt><dd>{analysis.depth.hasCycle ? 'Yes' : 'No'}</dd></div><div><dt>Arrival-relative dead ends</dt><dd>{analysis.deadEnds.length}</dd></div><div><dt>BFS expanded vertices</dt><dd>{analysis.breadth.counters.expandedVertices}</dd></div><div><dt>BFS examined edges</dt><dd>{analysis.breadth.counters.examinedEdges}</dd></div></dl>
      <p className="small-text">Dead-end IDs: {analysis.deadEnds.join(', ') || 'none'}. This test excludes each vertex’s DFS arrival edge; mandatory vertices are excluded.</p>
      <h3 className="inspector-section">Try a road change</h3><label className="field-label" htmlFor="road-selection">Road</label><select id="road-selection" value={roadId} onChange={(event) => setRoadId(event.target.value)}>{track.roads.map((item) => <option key={item.id} value={item.id}>{item.id} ({item.status})</option>)}</select><button className="button secondary road-toggle" onClick={() => { const original = originalRoads.get(roadId) ?? 'open'; changeRoad(roadId, road.status === 'blocked' ? original === 'blocked' ? 'open' : original : 'blocked'); }}>{road.status === 'blocked' ? 'Reopen selected road' : 'Block selected road'}</button><button className="text-button" onClick={() => { if (onRestoreRoads) onRestoreRoads(); else setOverrides({}); setRouteIndex(0); }}>Restore road layout</button>
    </aside></div>
    <PresetComparison track={track} source={source} target={target} showLabels={showLabels} examples={routes} provider={presetProvider} />
  </>;
}
