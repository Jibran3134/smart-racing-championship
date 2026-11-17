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
    <div className="page-heading"><div><p className="eyebrow">RACE CONTROL</p><h1>{mode === 'quick' ? 'Quick Race' : 'Championship'}<span className="heading-dot">.</span></h1><p>Take your line. Time the boost. Race to the flag.</p></div>{driver?.kind === 'replay' || driver?.kind === 'demo' ? <button className="text-button" onClick={onExitPreview}>{driver.kind === 'demo' ? 'Leave driving demo' : 'Exit display preview'}</button> : <span className="tag muted-tag">{driver ? 'Engine connected' : 'Driving demo available'}</span>}</div>
    {driver ? <RaceSession driver={driver} showLabels={showLabels} onViewResults={onViewResults} /> : <section className="panel integration-state race-entry"><span className="state-mark" aria-hidden="true">⚑</span><p className="eyebrow">LIGHTS OUT. EYES FORWARD.</p><h2>Your seat is waiting.</h2><p>Four cars. Two laps. Route-based automatic racing with corner braking and player-controlled nitro. Enable sound on the racing screen for the engine, tyres and boost.</p><div className="button-row"><button className="button primary" onClick={onPreview} disabled={!onPreview}>Start driving demo</button><button className="button secondary" onClick={onExplore}>Explore the layout ↗</button><button className="button secondary" disabled>Start race</button></div><p className="entry-footnote">The draft driving session is available now. Full championship mode and optimized route planning are still being integrated.</p></section>}
  </>;
}
