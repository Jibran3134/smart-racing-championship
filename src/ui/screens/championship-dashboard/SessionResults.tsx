import { useState } from 'react';
import type { SessionResult } from '../../adapters/session-results';
import { sessionResultsCsv, sessionEventsCsv } from '../../adapters/session-results';
import { formatRaceTime } from '../../adapters/race-view';
import { downloadText } from '../../components/common/download';
import { toJson } from '../../../shared/exports';

export function SessionResults({ sessions, selectedId, onSelect, onRace }: { sessions: readonly SessionResult[]; selectedId: string; onSelect: (id: string) => void; onRace: () => void }) {
  const [showEvents, setShowEvents] = useState(false);
  const result = sessions.find((session) => session.id === selectedId) ?? sessions[0];
  if (!result) return null;
  const player = result.racers.find((car) => car.isHuman);
  return <section className="panel session-results" aria-label="Completed session results">
    <div className="panel-heading"><div><p className="eyebrow">{result.kind === 'demo' ? 'COMPLETED DRIVING DEMO' : result.kind === 'replay' ? 'DISPLAY REPLAY / ILLUSTRATIVE RESULTS' : 'COMPLETED RACE'}</p><h2>{result.circuit}</h2></div><span className="tag">{player?.status === 'dnf' ? 'Player DNF' : player ? `Player position ${player.position}` : 'Session complete'}</span></div>
    <div className="session-summary"><div className="session-picker"><label htmlFor="completed-session">Completed session</label><select id="completed-session" value={result.id} onChange={(event) => { onSelect(event.target.value); setShowEvents(false); }}>{sessions.map((session) => <option key={session.id} value={session.id}>{session.id} / {session.circuit} / {session.kind}</option>)}</select></div><p>{result.totalLaps} laps / {result.checkpointCount} checkpoints / {formatRaceTime(result.simulationTime)} simulation time</p><p>{new Date(result.recordedAt).toLocaleString()}</p></div>
    <div className="table-scroll"><table><caption>Final results / {result.id}</caption><thead><tr><th scope="col">Position</th><th scope="col">Racer</th><th scope="col">Status</th><th scope="col">Finish time</th><th scope="col">Fuel remaining</th><th scope="col">Nitro remaining</th></tr></thead><tbody>{result.racers.map((car) => <tr key={car.id}><td>{car.position}</td><th scope="row">{car.name}{car.isHuman && car.name.toLowerCase() !== 'you' ? ' / You' : ''}</th><td>{car.status === 'dnf' ? `DNF${car.reason ? ` / ${car.reason}` : ''}` : 'Finished'}</td><td>{formatRaceTime(car.finishTime)}</td><td>{car.fuel}</td><td>{car.nitro}</td></tr>)}</tbody></table></div>
    <p className="lab-message">{result.kind === 'replay' ? 'These are illustrative replay values, not a played race.' : 'These values come from the completed session. Finishing positions and times are supplied by its engine.'} Championship points and fastest laps are not calculated by this view.</p>
    <div className="playback-controls"><button className="button primary" onClick={onRace}>Set up another race</button><button className="button secondary" onClick={() => downloadText(`${result.id}.results.csv`, sessionResultsCsv(result), 'text/csv;charset=utf-8')}>Export race CSV</button><button className="button secondary" onClick={() => downloadText(`${result.id}.json`, toJson(result), 'application/json')}>Export session JSON</button><button className="text-button" aria-expanded={showEvents} onClick={() => setShowEvents(!showEvents)}>{showEvents ? 'Hide retained event log' : 'Show retained event log'}</button></div>
    {showEvents && <div className="session-event-log"><p className="small-text">The snapshot retains {result.events.length} events. Older feed entries may have been trimmed by the engine.</p><ol>{result.events.map((event) => <li key={event.id}><time>{formatRaceTime(event.time)}</time><span>{event.message}</span></li>)}</ol><button className="button secondary" onClick={() => downloadText(`${result.id}.events.csv`, sessionEventsCsv(result), 'text/csv;charset=utf-8')}>Export event log CSV</button></div>}
  </section>;
}
