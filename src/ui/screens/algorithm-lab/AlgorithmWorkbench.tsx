import { useEffect, useMemo, useRef, useState } from 'react';
import type { LabAlgorithm, LabTrace } from '../../adapters/algorithm-lab';
import { defaultLabInputs, executeLabAlgorithm, labTraceCsv, missingLabAlgorithms, parseLabTrace, validateLabRegistry } from '../../adapters/algorithm-lab';
import { builtinLabAlgorithms } from '../../adapters/builtin-lab-algorithms';
import type { TrackMapData } from '../../components/map/map-model';
import { AlgorithmTracePlayer } from '../../components/algorithm-viewer/AlgorithmTracePlayer';
import { downloadText } from '../../components/common/download';
import { toJson } from '../../../shared/exports';

const noAdapters: readonly LabAlgorithm[] = [];
export function AlgorithmWorkbench({ track, showLabels, algorithms = noAdapters }: { track: TrackMapData; showLabels: boolean; algorithms?: readonly LabAlgorithm[] }) {
  const catalogue = useMemo(() => {
    const entries = [...builtinLabAlgorithms, ...algorithms];
    try { validateLabRegistry(entries); return { entries, error: '' }; }
    catch (failure) { return { entries: builtinLabAlgorithms, error: failure instanceof Error ? failure.message : 'Algorithm adapters are unavailable.' }; }
  }, [algorithms]);
  const [selectedId, setSelectedId] = useState('bfs');
  const selected = catalogue.entries.find((entry) => entry.id === selectedId) ?? catalogue.entries[0];
  const defaults = useMemo(() => defaultLabInputs(selected, track), [selected, track]);
  const [edited, setEdited] = useState<{ key: string; inputs: Record<string, string> } | null>(null);
  const key = JSON.stringify([selected.id, selected.fields, track]);
  const inputs = edited?.key === key ? edited.inputs : defaults;
  const signature = JSON.stringify([key, inputs]);
  const [recording, setRecording] = useState<{ trace: LabTrace; signature: string; imported: boolean; revision: number; algorithm?: LabAlgorithm } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null), revision = useRef(0), importRequest = useRef(0);
  useEffect(() => () => { pending.current?.abort(); importRequest.current++; }, []);
  const active = recording && (recording.imported || recording.signature === signature && recording.algorithm === selected) ? recording : null;
  const cancel = () => { pending.current?.abort(); pending.current = null; setBusy(false); };
  const run = async () => {
    if (busy) return;
    const controller = new AbortController(); pending.current = controller; importRequest.current++;
    setBusy(true); setError(''); setRecording(null);
    try {
      const trace = await executeLabAlgorithm(selected, inputs, track, controller.signal);
      if (!controller.signal.aborted) { setRecording({ trace, signature, imported: false, revision: ++revision.current, algorithm: selected }); setBusy(false); pending.current = null; }
    } catch (failure) { if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'Algorithm execution failed.'); setBusy(false); pending.current = null; } }
  };

  return <>
    <div className="page-heading"><div><p className="eyebrow">ONE PLAYER / SHARED CORE CODE</p><h1>Algorithm workbench<span className="heading-dot">.</span></h1><p>Run actual core functions, then inspect graph, array and table snapshots.</p></div><span className="tag">{catalogue.entries.length} algorithms connected</span></div>
    {catalogue.error && <p className="error-banner" role="alert">{catalogue.error} Built-in algorithms remain available.</p>}
    <section className="panel workbench-inputs"><div className="workbench-fields"><div className="field-group"><label htmlFor="workbench-algorithm">Connected algorithm</label><select id="workbench-algorithm" value={selected.id} disabled={busy} onChange={(event) => { setSelectedId(event.target.value); setRecording(null); setError(''); }}><optgroup label="Connected core functions">{catalogue.entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.title} / {entry.family}</option>)}</optgroup><optgroup label="Awaiting core integration">{missingLabAlgorithms.filter((entry) => !catalogue.entries.some((item) => item.id === entry.id)).map((entry) => <option disabled value={entry.id} key={entry.id}>{entry.title}</option>)}</optgroup></select></div>
      {selected.fields.map((field) => <div key={`${selected.id}-${field.id}`} className={`field-group ${field.type === 'json' ? 'json-field' : ''}`}><label htmlFor={`lab-input-${field.id}`}>{field.label}</label>{field.type === 'json' ? <textarea id={`lab-input-${field.id}`} value={inputs[field.id] ?? ''} disabled={busy} spellCheck={false} onChange={(event) => { setEdited({ key, inputs: { ...inputs, [field.id]: event.target.value } }); setRecording(null); setError(''); }} /> : field.type === 'number' ? <input id={`lab-input-${field.id}`} type="number" min={field.min} max={field.max} value={inputs[field.id] ?? ''} disabled={busy} onChange={(event) => { setEdited({ key, inputs: { ...inputs, [field.id]: event.target.value } }); setRecording(null); }} /> : <select id={`lab-input-${field.id}`} value={inputs[field.id] ?? ''} disabled={busy} onChange={(event) => { setEdited({ key, inputs: { ...inputs, [field.id]: event.target.value } }); setRecording(null); setError(''); }}>{field.type === 'vertex' ? track.vertices.map((vertex) => <option key={vertex.id} value={vertex.id}>{vertex.label}</option>) : field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>}</div>)}
    </div><p className="lab-message">{selected.description}</p><div className="playback-controls"><button className="button primary" disabled={busy} onClick={() => { void run(); }}>{busy ? 'Capturing trace...' : 'Run algorithm'}</button>{busy && <button className="button secondary" onClick={cancel}>Cancel execution</button>}<button className="button secondary" disabled={busy} onClick={() => { setEdited(null); setRecording(null); setError(''); }}>Reset inputs</button><label className="button secondary experiment-import">Import trace JSON<input aria-label="Import algorithm trace" type="file" accept=".json,application/json" disabled={busy} onChange={async (event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (!file) return;
      const request = ++importRequest.current;
      try { if (file.size > 5_000_000) throw new Error('Trace file exceeds 5 MB.'); const trace = parseLabTrace(await file.text()); if (request === importRequest.current) { setRecording({ trace, signature: '', imported: true, revision: ++revision.current }); setError(''); } }
      catch (failure) { if (request === importRequest.current) setError(failure instanceof Error ? failure.message : 'Could not import trace.'); }
    }} /></label></div></section>
    {error && <p className="error-banner" role="alert">{error}</p>}
    {active ? <><div className="trace-provenance"><p>{active.imported ? 'Imported trace. Replayed as supplied; no algorithm was executed or authenticated.' : 'Captured from the connected algorithm on the selected inputs.'} {active.trace.track ? `Map snapshot: ${active.trace.track.name}.` : 'This trace uses array/table data.'}</p><div className="button-row"><button className="button secondary" onClick={() => downloadText(`${active.trace.algorithmId}.trace.json`, toJson(active.trace), 'application/json')}>Export trace JSON</button><button className="button secondary" onClick={() => downloadText(`${active.trace.algorithmId}.trace.csv`, labTraceCsv(active.trace), 'text/csv;charset=utf-8')}>Export trace CSV</button></div></div><AlgorithmTracePlayer key={active.revision} trace={active.trace} showLabels={showLabels} /></> : <section className="panel integration-state"><h2>Choose inputs. Run. Replay.</h2><p>BFS/DFS, the generic min-heap and event queue call the existing production modules. The other algorithms become selectable when their core adapters are connected.</p><p>Capture is limited to 10000 steps and 5 MB. It records decisions and counters, not benchmark timings.</p></section>}
  </>;
}
