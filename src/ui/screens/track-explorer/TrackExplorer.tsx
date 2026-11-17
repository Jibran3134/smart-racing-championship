import { useState } from 'react';
import { TrackMap } from '../../components/map/TrackMap';
import { previewTrack } from '../../fixtures/preview-track';

export function TrackExplorer({ showLabels }: { showLabels: boolean }) {
  const [selected, setSelected] = useState(0);
  const vertex = previewTrack.vertices.find((item) => item.id === selected)!;
  return <>
    <div className="page-heading"><div><p className="eyebrow">CIRCUIT WORKSPACE</p><h1>Track Explorer<span className="heading-dot">.</span></h1><p>Inspect checkpoints, services and the roads that connect them.</p></div><span className="tag">Layout preview</span></div>
    <div className="explorer-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">LAYOUT 01</p><h2>{previewTrack.name}</h2></div><span className="small-text">Select a vertex to inspect</span></div><TrackMap track={previewTrack} selectedVertex={selected} onSelectVertex={setSelected} showLabels={showLabels} /></section>
      <aside className="panel inspector"><p className="eyebrow">VERTEX INSPECTOR</p><h2>{vertex.label}</h2><dl className="details-list"><div><dt>Vertex ID</dt><dd>{vertex.id.toString().padStart(2, '0')}</dd></div><div><dt>Type</dt><dd>{vertex.kind}</dd></div><div><dt>Map coordinates</dt><dd>{vertex.x}, {vertex.y}</dd></div><div><dt>Checkpoint order</dt><dd>{vertex.checkpointOrder ?? '—'}</dd></div></dl><label className="field-label" htmlFor="inspect-vertex">Jump to vertex</label><select id="inspect-vertex" value={selected} onChange={(event) => setSelected(Number(event.target.value))}>{previewTrack.vertices.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><div className="notice"><h3>Route planning comes next</h3><p>Inspect checkpoints and services now. Reachability, route comparisons and costs will be available in the next update.</p></div></aside>
    </div>
  </>;
}
