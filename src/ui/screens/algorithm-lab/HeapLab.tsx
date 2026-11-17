import { useState } from 'react';
import { MinHeap } from '../../../core/structures/MinHeap';

function makeHeap() { return new MinHeap((a: number, b: number) => a - b, [18, 7, 24, 3, 11, 15, 9]); }
function nodePosition(index: number) {
  const depth = Math.floor(Math.log2(index + 1));
  return { x: (index - (2 ** depth - 1) + 0.5) * (800 / 2 ** depth), y: 45 + depth * 85 };
}
export function HeapLab() {
  const [heap, setHeap] = useState(makeHeap);
  const [snapshot, setSnapshot] = useState(() => ({ items: heap.toArray(), counters: heap.counters }));
  const [input, setInput] = useState('6');
  const [message, setMessage] = useState('Seven values loaded using bottom-up heap construction.');
  const value = input.trim() === '' ? Number.NaN : Number(input);
  const atCapacity = snapshot.items.length >= 31;
  const refresh = () => setSnapshot({ items: heap.toArray(), counters: heap.counters });
  const reset = () => {
    const next = makeHeap(); setHeap(next); setSnapshot({ items: next.toArray(), counters: next.counters });
    setMessage('Workspace reset. Construction comparisons are included in the counters.');
  };
  return <>
    <div className="page-heading"><div><p className="eyebrow">SEE THE STRUCTURE</p><h1>Algorithm Lab<span className="heading-dot">.</span></h1><p>Inspect insertions, extractions and the work needed to maintain heap order.</p></div><span className="tag">Interactive workspace</span></div>
    <div className="lab-layout"><section className="panel heap-workspace"><div className="panel-heading"><div><p className="eyebrow">DATA STRUCTURES / 01</p><h2>Binary min-heap</h2></div><span className="tag muted-tag">{snapshot.items.length} values</span></div>
      <div className="heap-canvas">{snapshot.items.length === 0 ? <p className="empty-heap">Heap empty. Insert a value to begin.</p> : <svg viewBox={`0 0 800 ${90 + Math.floor(Math.log2(snapshot.items.length)) * 85}`} role="img" aria-label={`Min-heap in array order: ${snapshot.items.join(', ')}`}>
        {snapshot.items.slice(1).map((_, index) => { const child = nodePosition(index + 1); const parent = nodePosition(Math.floor(index / 2)); return <line key={index} x1={parent.x} y1={parent.y} x2={child.x} y2={child.y} className="heap-link" />; })}
        {snapshot.items.map((item, index) => { const position = nodePosition(index); return <g key={index} className={index === 0 ? 'heap-node heap-root' : 'heap-node'}><circle cx={position.x} cy={position.y} r="22" /><text x={position.x} y={position.y + 5}>{item}</text></g>; })}
      </svg>}</div>
      <div className="array-view" aria-label="Heap array">{snapshot.items.map((item, index) => <div key={index}><span>{index}</span><strong>{item}</strong></div>)}</div>
      <form className="heap-controls" onSubmit={(event) => { event.preventDefault(); if (!Number.isFinite(value) || atCapacity) return; heap.push(value); refresh(); setMessage(`Inserted ${value}. Minimum is ${heap.peek()}.`); }}><div><label htmlFor="heap-value" className="field-label">Value to insert</label><input id="heap-value" type="number" step="any" value={input} onChange={(event) => setInput(event.target.value)} /></div><button className="button primary" type="submit" disabled={!Number.isFinite(value) || atCapacity}>Insert value</button><button className="button secondary" type="button" disabled={heap.isEmpty} onClick={() => { const removed = heap.pop(); refresh(); setMessage(`Extracted minimum: ${removed}.`); }}>Extract min</button><button className="text-button" type="button" onClick={reset}>Reset</button></form>
      <p className="lab-message" role="status">{message}</p>{atCapacity && <p className="small-text">Display limit: 31 values. The core heap has no such limit.</p>}
    </section>
    <aside className="panel inspector"><p className="eyebrow">OPERATION COUNTERS</p><h2>Measure the work</h2><dl className="details-list"><div><dt>Heap operations</dt><dd>{snapshot.counters.heapOps}</dd></div><div><dt>Comparisons</dt><dd>{snapshot.counters.comparisons}</dd></div><div><dt>Swaps</dt><dd>{snapshot.counters.swaps}</dd></div><div><dt>Insertions</dt><dd>{snapshot.counters.pushes}</dd></div><div><dt>Extractions</dt><dd>{snapshot.counters.pops}</dd></div></dl><button className="text-button" onClick={() => { heap.resetCounters(); refresh(); setMessage('Counters reset; queued values are unchanged.'); }}>Reset counters</button><div className="notice"><h3>Smallest value first</h3><p>A parent never exceeds its children. The array is in heap order, not sorted order. Insert and extract take O(log n); peek takes O(1).</p></div><p className="small-text">Heap operations count successful insertions and extractions. Construction comparisons and swaps are included until counters are reset. Each action shows the completed operation; sift-by-sift playback is pending.</p></aside></div>
  </>;
}
