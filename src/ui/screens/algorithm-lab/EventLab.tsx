import { useState } from 'react';
import { createEventScenario } from '../../fixtures/event-scenario';
import { TrackMap } from '../../components/map/TrackMap';
import type { EventBatch } from '../../../core/events/EventProcessor';

export function EventLab({ showLabels }: { showLabels: boolean }) {
  const [model, setModel] = useState(createEventScenario);
  const [view, setView] = useState(() => model.snapshot());
  const [history, setHistory] = useState<EventBatch[]>([]);
  const [cancelled, setCancelled] = useState(false);
  const [message, setMessage] = useState('Ready. Six event types share one deterministic queue.');
  const advance = (time: number) => {
    const batches = model.processor.advanceTo(time);
    setHistory((previous) => [...previous, ...batches]);
    setView(model.snapshot());
    setMessage(`Clock advanced to ${time} s. ${batches.length} timestamp batches processed.`);
  };
  const reset = () => {
    const next = createEventScenario();
    setModel(next); setView(next.snapshot()); setHistory([]); setCancelled(false);
    setMessage('Scenario reset. All IDs, sequences and initial states are restored.');
  };
  return <>
    <div className="page-heading"><div><p className="eyebrow">A TRACK THAT CHANGES</p><h1>Event Lab<span className="heading-dot">.</span></h1><p>Watch closures, spills, restrictions and service availability resolve in order.</p></div><span className="tag">Simulation clock: {view.time} s</span></div>
    <div className="lab-layout"><section className="panel"><div className="panel-heading"><h2>Dynamic track scenario</h2><span className="tag muted-tag">Next event: {view.nextTime === undefined ? 'none' : `${view.nextTime} s`}</span></div><TrackMap track={view.track} showLabels={showLabels} />
      <div className="playback-controls"><button className="button primary" disabled={view.nextTime === undefined} onClick={() => { if (view.nextTime !== undefined) advance(view.nextTime); }}>Next timestamp</button><button className="button secondary" onClick={() => advance(view.time + 5)}>Advance 5 s</button><button className="text-button" onClick={reset}>Reset scenario</button></div>
      <p role="status" className="lab-message">{message}</p>
      <div className="event-actions"><button className="button secondary" disabled={cancelled || view.time >= 10} onClick={() => { const result = model.processor.cancel('avoidable'); setCancelled(result); setView(model.snapshot()); setMessage(result ? 'Cancelled the road-0 blockage scheduled for 10 s.' : 'The event is no longer pending.'); }}>Cancel 10 s blockage</button><button className="button secondary" disabled={!view.nitroActive} onClick={() => { model.processor.collectNitro(12); setView(model.snapshot()); setMessage('Nitro collected. Its expiry cannot reactivate the pickup.'); }}>Collect nitro</button></div>
      <div className="event-feed"><h3>Processed events</h3>{history.length === 0 ? <p className="small-text">Advance to 2 s for the first oil spill, then to 5 s for six simultaneous event types.</p> : history.map((batch) => <div key={batch.time} className="event-batch"><strong>{batch.time} s</strong><ol>{batch.events.map((event) => <li key={event.eventId}><span>{event.eventId}</span><span className="small-text">{event.outcome}{event.reason ? `: ${event.reason}` : ''}</span></li>)}</ol></div>)}</div>
    </section><aside className="panel inspector"><p className="eyebrow">EFFECT RESOLUTION</p><h2>Independent expiries</h2><dl className="details-list"><div><dt>Pending events / expiries</dt><dd>{view.pending}</dd></div><div><dt>Active temporary effects</dt><dd>{view.effects.length}</dd></div><div><dt>road-5 difficulty</dt><dd>{view.road.difficulty} / 5</dd></div><div><dt>road-5 speed cap</dt><dd>{view.road.speedCap ?? 'None'}</dd></div><div><dt>Fuel station</dt><dd>{view.stationActive ? 'Active' : 'Offline'}</dd></div><div><dt>Nitro pickup</dt><dd>{view.nitroActive ? 'Active' : 'Inactive'}</dd></div><div><dt>Heap operations</dt><dd>{view.counters.heapOps}</dd></div></dl><div className="effect-list">{view.effects.map((entry) => <p key={entry.eventId}><strong>{entry.eventId}</strong><span>expires at {entry.expiresAt} s</span></p>)}</div><div className="notice"><h3>One clock, predictable order</h3><p>Lower priority numbers run first at equal times. Oil penalties use the maximum active penalty; speed caps use the strictest cap. Every effect expires independently.</p></div><p className="small-text">At 13 s the severe spill expires, but mild oil and the speed cap remain. Scenario values illustrate the rules and are not final race settings.</p></aside></div>
  </>;
}
