import { useRaceController } from '../../hooks/useRaceController';
import { formatRaceTime } from '../../adapters/race-view';
import type { RaceDriver } from '../../adapters/race-view';
import { TrackMap } from '../../components/map/TrackMap';
import { ResourceGauge } from '../../components/common/ResourceGauge';

export function RaceSession({ driver, showLabels, onViewResults }: { driver: RaceDriver; showLabels: boolean; onViewResults: () => void }) {
  const control = useRaceController(driver);
  const state = control.state;
  const player = state?.cars.find((car) => car.isHuman);
  const replay = driver.kind === 'replay';
  const complete = state?.phase === 'finished';

  if (!state) return <section className="panel integration-state" role="alert"><h2>Race state unavailable</h2><p>{control.error}</p><button className="button secondary" onClick={control.restart}>Retry race state</button></section>;

  return <>
    {replay && <div className="preview-banner"><strong>DISPLAY PREVIEW</strong><span>Illustrative snapshots only. This is not a playable race and awards no points.</span></div>}
    {control.error && <div className="error-banner" role="alert"><strong>Race paused:</strong> {control.error} <button className="text-button" onClick={control.restart}>Restart session</button></div>}
    <section className="race-telemetry" aria-label="Race telemetry">
      <div><span>Race clock</span><strong>{formatRaceTime(state.clock)}</strong></div>
      <div><span>Lap</span><strong>{player?.lap ?? '—'} <small>/ {state.totalLaps}</small></strong></div>
      <div><span>Next checkpoint progress</span><strong>{player?.checkpoint ?? '—'} <small>/ {state.checkpointCount}</small></strong></div>
      <div><span>Position</span><strong>{player?.position ?? '—'} <small>/ {state.cars.length}</small></strong></div>
      <div><span>Session state</span><strong className="session-state">{control.error ? 'Error' : complete ? 'Complete' : control.playing ? 'Running' : state.phase === 'ready' ? 'Ready' : 'Paused'}</strong></div>
    </section>
    <div className="race-layout">
      <div className="explorer-main">
        <section className="panel race-map-panel">
          <div className="panel-heading"><div><p className="eyebrow">RACE CONTROL</p><h2>{state.track.name}</h2></div><span className="tag muted-tag">{replay ? 'Sample replay' : 'Live engine'}</span></div>
          <TrackMap track={state.track} cars={state.cars} showLabels={showLabels} highlightedRoads={state.routeEdges} statusLabel={replay ? 'Display preview' : 'Live track'} />
          <div className="playback-controls">
            <button className="button primary" disabled={complete || Boolean(control.error)} onClick={control.playing ? control.pause : control.play}>{control.playing ? 'Pause session' : state.phase === 'ready' ? replay ? 'Play preview' : 'Start race' : 'Resume session'}</button>
            <button className="button secondary" onClick={control.restart}>Restart session</button>
            {complete && <button className="button primary" onClick={onViewResults}>{replay ? 'View example dashboard' : 'View race results'}</button>}
          </div>
          {replay && driver.seek && <div className="replay-seek"><label htmlFor="race-seek">Preview timeline <span>{formatRaceTime(state.clock)} / {formatRaceTime(driver.duration ?? 0)}</span></label><input id="race-seek" type="range" min={0} max={driver.duration ?? 0} step={1} value={state.clock} onChange={(event) => control.seek(Number(event.target.value))} /><div className="replay-speed"><label htmlFor="race-speed">Replay speed</label><select id="race-speed" value={control.speed} onChange={(event) => control.setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></div></div>}
        </section>
        <section className="panel race-event-panel"><div className="panel-heading"><h2>Race event feed</h2><span className="small-text">{state.events.length} updates</span></div><ol className="race-events">{state.events.length ? state.events.map((event) => <li key={event.id}><time>{formatRaceTime(event.time)}</time><span>{event.message}</span></li>) : <li className="small-text">No events yet.</li>}</ol></section>
      </div>
      <aside className="race-sidebar">
        <section className="panel inspector"><p className="eyebrow">YOUR RESOURCES</p><h2>{player?.label ?? 'Player unavailable'}</h2>
          <ResourceGauge label="Fuel" value={player?.fuel ?? NaN} maximum={player?.fuelCapacity ?? 0} unit="units" />
          <ResourceGauge label="Nitro" value={player?.nitro ?? NaN} maximum={player?.nitroCapacity ?? 0} unit="charges" />
          <button className="button secondary nitro-button" disabled={replay || !driver.activateNitro || !control.playing || !player || player.status !== 'racing' || player.nitro <= 0} onClick={control.activateNitro}>Activate nitro</button>
          <p className="small-text">{replay ? 'Resources are recorded display values. Nitro activation is available only in a connected live race.' : 'The race engine validates capacity, duration and fuel use.'}</p>
          {player?.status === 'dnf' && <div className="error-banner" role="status">DNF: {player.statusReason ?? 'Unable to continue.'}</div>}
          {player?.status === 'waiting' && <div className="notice"><h3>Waiting for recovery</h3><p>{player.statusReason ?? 'No route is currently available.'}</p></div>}
        </section>
        <section className="panel inspector"><p className="eyebrow">ON THE CIRCUIT</p><h2>Running order</h2><ol className="running-order">{state.cars.map((car) => <li key={car.id}><span className="racer-swatch" style={{ background: car.color }} /><div><strong>{car.position}. {car.label}</strong><small>{car.status === 'dnf' ? `DNF · ${car.statusReason ?? 'Unable to finish'}` : car.status === 'finished' ? 'Finished' : `Lap ${car.lap} · checkpoint ${car.checkpoint}`}</small></div></li>)}</ol></section>
      </aside>
    </div>
  </>;
}
