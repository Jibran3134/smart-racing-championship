import { useRaceController } from '../../hooks/useRaceController';
import { useEffect, useRef, useState } from 'react';
import { formatRaceTime } from '../../adapters/race-view';
import type { RaceDriver, RaceViewState } from '../../adapters/race-view';
import { RaceScene } from '../../components/racing/RaceScene';
import { ResourceGauge } from '../../components/common/ResourceGauge';
import { useRaceAudio } from '../../hooks/useRaceAudio';
import type { AudioPerspective } from '../../audio/race-sound-state';

export function RaceSession({ driver, showLabels, onViewResults, onComplete, onRestart }: { driver: RaceDriver; showLabels: boolean; onViewResults: () => void; onComplete?: (state: RaceViewState) => void; onRestart?: () => void }) {
  const control = useRaceController(driver);
  const state = control.state;
  const [perspective, setPerspective] = useState<AudioPerspective>({ carId: null, overview: false });
  const sound = useRaceAudio(state, control.playing, perspective);
  const player = state?.cars.find((car) => car.isHuman);
  const replay = driver.kind === 'replay';
  const complete = state?.phase === 'finished';
  const demo = driver.kind === 'demo';
  const nitroAvailable = !replay && Boolean(driver.activateNitro) && control.playing && state?.phase === 'running' && Boolean(player && player.status === 'racing' && player.nitro > 0 && !player.boosting);
  const nitroHint = replay ? 'Nitro cannot be activated in a recorded preview.'
    : !driver.activateNitro ? 'Nitro control is unavailable for this session.'
    : complete ? 'Session complete. Restart to race again.'
    : !player || player.status === 'dnf' || player.status === 'finished' ? 'Nitro is unavailable because your car is no longer racing.'
    : player.nitro <= 0 && !player.boosting ? 'No nitro charges left. Restart with more charges to try another strategy.'
    : state?.phase === 'ready' ? 'Start the race to use nitro.'
    : !control.playing ? 'Resume the race to use nitro.'
    : state?.phase === 'countdown' ? 'Wait for the starting lights to go out.'
    : player.boosting ? 'Boost is active. Wait for it to finish before using another charge.'
    : player.status === 'waiting' ? 'Nitro is unavailable while your car is waiting for recovery.'
    : 'Click Activate nitro, or focus the track and press N. Boosting uses extra fuel.';
  const startRace = () => { void sound.enableForRace(); control.play(); };
  const reported = useRef(false);
  useEffect(() => {
    if (state?.phase !== 'finished') { reported.current = false; return; }
    if (!reported.current) { reported.current = true; onComplete?.(state); }
  }, [state, onComplete]);

  if (!state) return <section className="panel integration-state" role="alert"><h2>Race state unavailable</h2><p>{control.error}</p><button className="button secondary" onClick={control.restart}>Retry race state</button></section>;

  return <>
    {replay && <div className="preview-banner"><strong>DISPLAY PREVIEW</strong><span>Illustrative snapshots only. This is not a playable race and awards no points.</span></div>}
    {demo && <div className="driving-demo-banner"><strong>ROUTE RACING</strong><span>Automatic driving · N to boost · draft circuit and settings</span></div>}
    {control.error && <div className="error-banner" role="alert"><strong>Race paused:</strong> {control.error} <button className="text-button" onClick={() => { onRestart?.(); control.restart(); }}>Restart session</button></div>}
    <section className="race-telemetry" aria-label="Race telemetry">
      <div><span>Race clock</span><strong>{formatRaceTime(state.clock)}</strong></div>
      <div><span>Lap</span><strong>{player?.lap ?? '—'} <small>/ {state.totalLaps}</small></strong></div>
      <div><span>Checkpoint progress</span><strong>{player?.checkpoint ?? '—'} <small>/ {state.checkpointCount}</small></strong></div>
      <div><span>Position</span><strong>{player?.position ?? '—'} <small>/ {state.cars.length}</small></strong></div>
      <div><span>Session state</span><strong className="session-state">{control.error ? 'Error' : complete ? 'Complete' : control.playing ? 'Running' : state.phase === 'ready' ? 'Ready' : 'Paused'}</strong></div>
    </section>
    <div className="race-layout">
      <div className="explorer-main">
        <section className="panel race-map-panel">
          <div className="panel-heading"><div><p className="eyebrow">RACE CONTROL</p><h2>{state.track.name}</h2></div><span className="tag muted-tag">{replay ? 'Sample replay' : demo ? 'Driving demo' : 'Live engine'}</span></div>
          <div className="race-audio-controls">
            <button className={`sound-toggle ${sound.enabled ? 'sound-on' : ''}`} aria-pressed={sound.enabled} onClick={() => { void sound.toggle(); }}>
              <span aria-hidden="true">{sound.enabled ? '◖))' : '◖×'}</span>
              {sound.loading ? 'Mute loading audio' : sound.enabled ? 'Mute sound' : 'Enable sound'}
            </button>
            <label htmlFor="race-volume">Master volume</label>
            <input id="race-volume" type="range" min={0} max={100} value={sound.volume} onChange={(event) => sound.setVolume(Number(event.target.value))} />
            <output htmlFor="race-volume">{sound.volume}%</output>
            <span className="audio-caption">{state.cars.length} cars · spatial race mix</span>
            <a className="audio-credits" href={`${import.meta.env.BASE_URL}audio/CREDITS.txt`} target="_blank" rel="noreferrer">Sound credits</a>
          </div>
          {sound.error && <p className="audio-error" role="status">{sound.error} Racing is available without sound.</p>}
          {!sound.enabled && !sound.error && state.phase === 'ready' && <p className="audio-start-hint">Sound starts with the race. Use M or the sound button to mute.</p>}
          <RaceScene state={state} playing={control.playing} showLabels={showLabels} onTogglePause={() => { if (!complete && !control.error) { if (control.playing) control.pause(); else startRace(); } }} onNitro={control.activateNitro} nitroAvailable={nitroAvailable} onToggleSound={() => { void sound.toggle(); }} onPerspectiveChange={setPerspective} />
          <div className="playback-controls">
            <button className="button primary" disabled={complete || Boolean(control.error)} onClick={control.playing ? control.pause : startRace}>{control.playing ? 'Pause session' : state.phase === 'ready' ? replay ? 'Play preview' : 'Start race' : 'Resume session'}</button>
            <button className="button secondary" onClick={() => { onRestart?.(); control.restart(); }}>Restart session</button>
            {complete && <button className="button primary" onClick={onViewResults}>{replay ? 'View preview results' : 'View race results'}</button>}
          </div>
          {replay && driver.seek && <div className="replay-seek"><label htmlFor="race-seek">Preview timeline <span>{formatRaceTime(state.clock)} / {formatRaceTime(driver.duration ?? 0)}</span></label><input id="race-seek" type="range" min={0} max={driver.duration ?? 0} step={1} value={state.clock} onChange={(event) => control.seek(Number(event.target.value))} /><div className="replay-speed"><label htmlFor="race-speed">Replay speed</label><select id="race-speed" value={control.speed} onChange={(event) => control.setSpeed(Number(event.target.value))}><option value={1}>1×</option><option value={2}>2×</option><option value={4}>4×</option></select></div></div>}
        </section>
        <section className="panel race-event-panel"><div className="panel-heading"><h2>Race event feed</h2><span className="small-text">{state.events.length} updates</span></div><ol className="race-events">{state.events.length ? state.events.map((event) => <li key={event.id}><time>{formatRaceTime(event.time)}</time><span>{event.message}</span></li>) : <li className="small-text">No events yet.</li>}</ol></section>
      </div>
      <aside className="race-sidebar">
        <section className="panel inspector"><p className="eyebrow">YOUR RESOURCES</p><h2>{player?.label ?? 'Player unavailable'}</h2>
          <ResourceGauge label="Fuel" value={player?.fuel ?? NaN} maximum={player?.fuelCapacity ?? 0} unit="units" />
          <ResourceGauge label="Nitro" value={player?.nitro ?? NaN} maximum={player?.nitroCapacity ?? 0} unit="charges" />
          <button className="button secondary nitro-button" aria-describedby="nitro-help" disabled={!nitroAvailable} onClick={control.activateNitro}>{player?.boosting ? 'Nitro engaged' : 'Activate nitro'}</button>
          <p id="nitro-help" className="small-text">{nitroHint}</p>
          {player?.status === 'dnf' && <div className="error-banner" role="status">DNF: {player.statusReason ?? 'Unable to continue.'}</div>}
          {player?.status === 'waiting' && <div className="notice"><h3>Waiting for recovery</h3><p>{player.statusReason ?? 'No route is currently available.'}</p></div>}
        </section>
        <section className="panel inspector"><p className="eyebrow">ON THE CIRCUIT</p><h2>Running order</h2><ol className="running-order">{state.cars.map((car) => <li key={car.id}><span className="racer-swatch" style={{ background: car.color }} /><div><strong>{car.position}. {car.label}</strong><small>{car.status === 'dnf' ? `DNF · ${car.statusReason ?? 'Unable to finish'}` : car.status === 'finished' ? 'Finished' : `Lap ${car.lap} · checkpoint ${car.checkpoint}`}</small></div></li>)}</ol></section>
      </aside>
    </div>
  </>;
}
