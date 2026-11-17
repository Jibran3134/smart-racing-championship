import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { MainMenu } from '../ui/screens/main-menu/MainMenu';
import { TrackExplorer } from '../ui/screens/track-explorer/TrackExplorer';
import { AlgorithmLab } from '../ui/screens/algorithm-lab/AlgorithmLab';
import { RacingScreen } from '../ui/screens/racing/RacingScreen';
import { ChampionshipDashboard } from '../ui/screens/championship-dashboard/ChampionshipDashboard';
import { previewTrack } from '../ui/fixtures/preview-track';
import type { MapRoad, TrackMapData } from '../ui/components/map/map-model';
import type { RaceDriver, RaceViewState } from '../ui/adapters/race-view';
import type { ChampionshipProvider } from '../ui/adapters/championship-view';
import type { PresetProvider } from '../ui/adapters/preset-view';
import type { RaceSetupProvider, RaceSetupRequest } from '../ui/adapters/race-setup';
import { captureSessionResult } from '../ui/adapters/session-results';
import type { SessionResult } from '../ui/adapters/session-results';
import type { LabAlgorithm } from '../ui/adapters/algorithm-lab';

const screens = [
  { id: 'menu', label: 'Overview' },
  { id: 'explorer', label: 'Track Explorer' },
  { id: 'racing', label: 'Race' },
  { id: 'lab', label: 'Algorithm Lab' },
  { id: 'dashboard', label: 'Championship' },
] as const;
type Screen = typeof screens[number]['id'];

interface AppProps {
  raceDriver?: RaceDriver;
  championshipProvider?: ChampionshipProvider;
  presetProvider?: PresetProvider;
  raceSetupProvider?: RaceSetupProvider;
  labAlgorithms?: readonly LabAlgorithm[];
}

export function App({ raceDriver, championshipProvider, presetProvider, raceSetupProvider, labAlgorithms }: AppProps = {}) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<'quick' | 'championship'>('quick');
  const [showLabels, setShowLabels] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const systemReducedMotion = useReducedMotion();
  const [dialog, setDialog] = useState<'instructions' | 'settings' | null>(null);
  const [roadOverrides, setRoadOverrides] = useState<Record<string, MapRoad['status']>>({});
  const [previewRace, setPreviewRace] = useState<RaceDriver | null>(null);
  const [baseTrack, setBaseTrack] = useState<TrackMapData>(previewTrack);
  const [setup, setSetup] = useState<RaceSetupRequest>();
  const [sessions, setSessions] = useState<SessionResult[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [resultError, setResultError] = useState('');
  const savedDrivers = useRef(new WeakMap<RaceDriver, string>());
  const resultSequence = useRef(0);
  const currentTrack = useMemo(() => ({ ...baseTrack, roads: baseTrack.roads.map((road) => ({ ...road, status: roadOverrides[road.id] ?? road.status })) }), [baseTrack, roadOverrides]);
  const activeDriver = raceDriver ?? previewRace;
  const saveResult = useCallback((state: RaceViewState) => {
    if (!activeDriver) return;
    const saved = savedDrivers.current.get(activeDriver);
    if (saved) { setSelectedSessionId(saved); return; }
    try {
      const id = `session-${++resultSequence.current}`;
      const result = captureSessionResult(state, activeDriver.kind, id, new Date().toISOString(), raceDriver ? undefined : setup);
      savedDrivers.current.set(activeDriver, id); setSessions((previous) => [result, ...previous].slice(0, 10)); setSelectedSessionId(id); setResultError('');
    } catch (failure) { setResultError(failure instanceof Error ? failure.message : 'Could not capture the completed race.'); }
  }, [activeDriver, raceDriver, setup]);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (dialog) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [dialog]);

  const navigate = (next: Screen) => {
    setScreen(next);
    requestAnimationFrame(() => mainRef.current?.focus());
  };
  const openRace = (nextMode: 'quick' | 'championship') => { setMode(nextMode); setPreviewRace(null); setSetup(undefined); navigate('racing'); };
  const exploreCircuit = (track: TrackMapData) => { setBaseTrack(track); setRoadOverrides({}); navigate('explorer'); };

  return <MotionConfig reducedMotion={reduceMotion ? 'always' : 'user'}>
    <div className={`app-shell ${reduceMotion ? 'reduce-motion' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="app-header">
        <button className="brand" aria-label="Smart Racing Championship home" onClick={() => navigate('menu')}><span className="brand-mark" aria-hidden="true">S<span>R</span></span><span>SMART RACING<small>CHAMPIONSHIP</small></span></button>
        <div className="header-actions"><span className="build-badge">DEVELOPMENT / 06</span><button className="text-button" onClick={(event) => { returnFocusRef.current = event.currentTarget; setDialog('instructions'); }}>Instructions</button><button className="settings-button" aria-label="Open settings" onClick={(event) => { returnFocusRef.current = event.currentTarget; setDialog('settings'); }}>Settings <span aria-hidden="true">⚙</span></button></div>
      </header>
      <nav className="main-nav" aria-label="Main navigation">{screens.map((item, index) => <button key={item.id} aria-current={screen === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><span className="nav-number">0{index + 1}</span>{item.label}</button>)}<span className="nav-status"><span className="live-light" /> LOCAL WORKSPACE</span></nav>
      <main id="main-content" tabIndex={-1} ref={mainRef}>
        <motion.div key={screen} initial={{ opacity: reduceMotion || systemReducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ duration: reduceMotion || systemReducedMotion ? 0 : 0.18 }}>
          {screen === 'menu' && <MainMenu onExplore={() => navigate('explorer')} onLab={() => navigate('lab')} onRace={openRace} showLabels={showLabels} track={currentTrack} />}
          {screen === 'explorer' && <TrackExplorer showLabels={showLabels} track={currentTrack} onChangeRoad={(id, status) => setRoadOverrides((previous) => ({ ...previous, [id]: status }))} onRestoreRoads={() => setRoadOverrides({})} presetProvider={presetProvider} />}
          {screen === 'racing' && <RacingScreen mode={mode} onExplore={() => navigate('explorer')} driver={activeDriver} showLabels={showLabels} setupProvider={raceSetupProvider} canChangeSetup={Boolean(previewRace && !raceDriver)} onPrepared={(driver, request) => { setPreviewRace(driver); setSetup(request); setMode(request.mode); setBaseTrack(driver.getState().track); setRoadOverrides({}); }} onExploreCircuit={exploreCircuit} onExitPreview={() => setPreviewRace(null)} onComplete={saveResult} onRestart={() => { if (activeDriver) savedDrivers.current.delete(activeDriver); }} onViewResults={() => navigate('dashboard')} />}
          {screen === 'lab' && <AlgorithmLab showLabels={showLabels} track={currentTrack} algorithms={labAlgorithms} />}
          {screen === 'dashboard' && <>{resultError && <p className="error-banner" role="alert">{resultError}</p>}<ChampionshipDashboard onRace={() => openRace('championship')} onSetupRace={() => openRace('quick')} provider={championshipProvider} sessions={sessions} selectedSessionId={selectedSessionId} onSelectSession={setSelectedSessionId} /></>}
        </motion.div>
      </main>
      <footer className="app-footer"><span>SMART RACING CHAMPIONSHIP</span><span>Explore. Optimize. Compete.</span><span>ITERATION 06 / ALGORITHM WORKBENCH</span></footer>
      <dialog ref={dialogRef} aria-labelledby="dialog-title" className="app-dialog" onCancel={() => setDialog(null)} onClose={() => { setDialog(null); returnFocusRef.current?.focus(); }}>
        <div className="dialog-heading"><p className="eyebrow">WORKSPACE GUIDE</p><button className="text-button" onClick={() => setDialog(null)} aria-label="Close dialog">Close ×</button></div><h2 id="dialog-title">{dialog === 'settings' ? 'Make it your workspace.' : 'Choose your next move.'}</h2>
        {dialog === 'settings' ? <div className="settings-list"><label><span><strong>Map labels</strong><small>Show labels for services and special vertices.</small></span><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /></label><label><span><strong>Reduce motion</strong><small>Turn off transitions. System preferences are also respected.</small></span><input type="checkbox" checked={reduceMotion} onChange={(event) => setReduceMotion(event.target.checked)} /></label><p className="small-text">Settings apply for this session.</p></div> : <div className="instructions-copy"><p><strong>Explore:</strong> open Track Explorer, choose start and destination vertices, compare BFS and alternative paths, or block a road to test reachability. Zoom and Fit adjust the map view.</p><p><strong>Inspect:</strong> open Algorithm Lab for the heap workspace, BFS/DFS step playback, or a deterministic event simulation with independent expiries.</p><p><strong>Coming next:</strong> the full championship and optimized routing. The driving demo already provides continuous route racing, nitro, camera controls and optional sound.</p><p>To race: open Race, start the driving demo, configure your loadout, then Start race (sound starts automatically). Click the circuit to use Space to pause, N for nitro, C for camera and M for sound. Cars visit mandatory checkpoints automatically.</p></div>}
      </dialog>
    </div>
  </MotionConfig>;
}
