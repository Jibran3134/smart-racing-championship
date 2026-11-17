import { useContext, useEffect, useRef, useState } from 'react';
import { MotionConfigContext, useReducedMotion } from 'framer-motion';
import { drawRaceScene } from './race-renderer';
import type { SceneCache } from './race-renderer';
import type { RaceViewState } from '../../adapters/race-view';
import { formatRaceTime } from '../../adapters/race-view';

interface RaceSceneProps {
  state: RaceViewState;
  playing: boolean;
  showLabels: boolean;
  onTogglePause: () => void;
  onNitro: () => void;
  nitroAvailable: boolean;
  onToggleSound: () => void;
}

export function RaceScene({ state, playing, showLabels, onTogglePause, onNitro, nitroAvailable, onToggleSound }: RaceSceneProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const cache = useRef<SceneCache>({ angles: new Map(), time: 0 });
  const [camera, setCamera] = useState<'follow' | 'overview'>('follow');
  const [focusId, setFocusId] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [resizeVersion, setResizeVersion] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [message, setMessage] = useState('');
  const systemReducedMotion = useReducedMotion();
  const motionConfig = useContext(MotionConfigContext);
  const reducedMotion = systemReducedMotion || motionConfig.reducedMotion === 'always';
  const player = state.cars.find((car) => car.isHuman) ?? state.cars[0];
  const selected = state.cars.find((car) => car.id === focusId) ?? player;
  const speed = player?.speedKph;
  const rpm = player?.rpm ?? 0;

  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setResizeVersion((version) => version + 1));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === stage.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  useEffect(() => {
    if (typeof CanvasRenderingContext2D === 'undefined') return;
    const element = canvas.current;
    const context = element?.getContext('2d');
    if (!element || !context) return;
    const box = element.getBoundingClientRect();
    const width = Math.max(1, box.width); const height = Math.max(1, box.height);
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) { element.width = Math.round(width * ratio); element.height = Math.round(height * ratio); }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawRaceScene(context, width, height, state, { mode: camera, carId: selected?.id ?? 1, zoom, labels: showLabels, reducedMotion: Boolean(reducedMotion) }, cache.current);
  }, [state, camera, selected?.id, zoom, showLabels, reducedMotion, resizeVersion]);

  return <div className={`race-scene ${player?.boosting ? 'nitro-active' : ''}`} ref={stage}>
    <div className="scene-toolbar"><div role="group" aria-label="Race camera"><button aria-pressed={camera === 'overview'} onClick={() => setCamera('overview')}>Circuit view</button><button aria-pressed={camera === 'follow'} onClick={() => setCamera('follow')}>Follow car</button></div><div className="camera-car"><label htmlFor="camera-car">Camera car</label><select id="camera-car" value={selected?.id ?? ''} onChange={(event) => setFocusId(Number(event.target.value))}>{state.cars.map((car) => <option key={car.id} value={car.id}>{car.label}</option>)}</select></div><div className="scene-zoom"><button aria-label="Zoom racing camera out" disabled={zoom <= 0.8} onClick={() => setZoom((value) => Math.max(0.8, value - 0.2))}>−</button><button aria-label="Reset racing camera zoom" onClick={() => setZoom(1)}>1:1</button><button aria-label="Zoom racing camera in" disabled={zoom >= 1.8} onClick={() => setZoom((value) => Math.min(1.8, value + 0.2))}>+</button><button onClick={() => {
      if (fullscreen) void document.exitFullscreen().catch(() => setMessage('Unable to exit fullscreen. Press Escape.'));
      else if (stage.current?.requestFullscreen) void stage.current.requestFullscreen().catch(() => setMessage('Fullscreen is unavailable in this view.'));
      else setMessage('Fullscreen is unavailable in this browser.');
    }}>{fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button></div></div>
    <div className="race-viewport" tabIndex={0} role="group" aria-label="Racing viewport. Space pauses, N activates nitro, C changes camera, M toggles sound."
      onPointerDown={(event) => { if (!(event.target instanceof HTMLElement) || !event.target.closest('button,input,select')) event.currentTarget.focus(); }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest('button,input,select') || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        if (event.code === 'Space') { event.preventDefault(); onTogglePause(); }
        if (event.code === 'KeyN' && nitroAvailable) { event.preventDefault(); onNitro(); }
        if (event.code === 'KeyC') { event.preventDefault(); setCamera((mode) => mode === 'follow' ? 'overview' : 'follow'); }
        if (event.code === 'KeyM') { event.preventDefault(); onToggleSound(); }
      }}>
      <canvas ref={canvas} className="race-canvas" role="img" aria-label={`Racing circuit with ${state.cars.length} cars. Camera following ${selected?.label ?? 'the circuit'}.`} />
      <ul className="sr-only" aria-label="Cars on circuit">{state.cars.map((car) => <li key={car.id}><span role="img" aria-label={`${car.label} car`}>{car.label}, position {car.position}, {car.status}, lap {car.lap}.</span></li>)}</ul>
      <div className="scene-top-hud"><span className="scene-live"><i />{state.phase === 'ready' ? 'GRID READY' : state.phase === 'countdown' ? 'START SEQUENCE' : playing ? 'ON TRACK' : state.phase === 'finished' ? 'SESSION COMPLETE' : 'PAUSED'}</span><span>{state.track.name.toUpperCase()}</span></div>
      {state.phase === 'countdown' && <div className="start-sequence" role="status"><div className="start-lights">{[0, 1, 2, 3, 4].map((light) => <i key={light} className={light < 6 - (state.countdown ?? 3) ? 'lit' : ''} />)}</div><strong>{state.countdown}</strong><span>HOLD YOUR LINE</span></div>}
      {state.phase === 'running' && state.clock < 1.2 && playing && <div className="lights-out">GO!</div>}
      {state.phase === 'ready' && <div className="grid-ready"><span>THE GRID IS SET</span><strong>Find your racing line.</strong><p>Automatic racing · N for nitro</p></div>}
      {state.phase === 'finished' && <div className="finish-overlay"><div className="chequered-strip" /><span>CHEQUERED FLAG</span><strong>{player?.status === 'dnf' ? 'DID NOT FINISH' : player?.position === 1 ? 'VICTORY!' : `POSITION ${player?.position ?? '—'}`}</strong><p>{player?.status === 'dnf' ? player.statusReason : `Finish time ${formatRaceTime(player?.finishTime ?? state.clock)}`}</p><small>Restart below to take another run.</small></div>}
      <div className="cockpit-hud" aria-label="Driving instruments"><div className="rev-lights">{Array.from({ length: 18 }, (_, index) => <i key={index} className={`${index < rpm / 10000 * 18 ? 'on' : ''} ${index > 13 ? 'redline' : ''}`} />)}</div><div className="speedometer"><strong>{speed === undefined ? '—' : Math.round(speed)}</strong><span>KM/H</span><div className="gear"><small>GEAR</small><b>{player?.gear || 'N'}</b></div></div><div className="rpm-line"><span>{rpm ? `${Math.round(rpm / 100) * 100} RPM` : 'TELEMETRY PENDING'}</span><span>{player?.boosting ? 'NITRO ACTIVE' : player?.braking ? 'BRAKING' : 'AUTO DRIVE'}</span></div></div>
      {player?.boosting && <div className="boost-vignette" aria-hidden="true" />}
      <button className="scene-nitro" disabled={!nitroAvailable} onClick={onNitro}><span>N</span><strong>NITRO</strong><small>{player?.nitro ?? 0} charges</small></button>
    </div>
    <div className="scene-help"><span>Click the track to use keyboard controls.</span><span><kbd>SPACE</kbd> Pause <kbd>N</kbd> Nitro <kbd>C</kbd> Camera <kbd>M</kbd> Sound</span></div>
    {message && <p className="small-text" role="status">{message}</p>}
  </div>;
}
