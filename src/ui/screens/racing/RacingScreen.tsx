import { RaceSession } from './RaceSession';
import type { RaceDriver } from '../../adapters/race-view';

interface RacingScreenProps {
  mode: 'quick' | 'championship';
  onExplore: () => void;
  driver?: RaceDriver | null;
  showLabels?: boolean;
  onPreview?: () => void;
  onExitPreview?: () => void;
  onViewResults?: () => void;
}

export function RacingScreen({ mode, onExplore, driver, showLabels = true, onPreview, onExitPreview, onViewResults = () => {} }: RacingScreenProps) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">RACE CONTROL</p><h1>{mode === 'quick' ? 'Quick Race' : 'Championship'}<span className="heading-dot">.</span></h1><p>Track position, resources and every change on the circuit.</p></div>{driver?.kind === 'replay' ? <button className="text-button" onClick={onExitPreview}>Exit display preview</button> : <span className="tag muted-tag">{driver ? 'Engine connected' : 'Not yet playable'}</span>}</div>
    {driver ? <RaceSession driver={driver} showLabels={showLabels} onViewResults={onViewResults} /> : <section className="panel integration-state"><span className="state-mark" aria-hidden="true">⚑</span><p className="eyebrow">RACE MODE COMING SOON</p><h2>The grid is being prepared.</h2><p>Playable racing awaits the engine and validated circuits. Preview the race display now, or inspect the current track in Explorer.</p><div className="button-row"><button className="button primary" onClick={onPreview} disabled={!onPreview}>Preview race display</button><button className="button secondary" onClick={onExplore}>Explore the layout ↗</button><button className="button secondary" disabled>Start race</button></div></section>}
  </>;
}
