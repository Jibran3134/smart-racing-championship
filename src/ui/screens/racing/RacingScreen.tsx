import { RaceSession } from './RaceSession';
import { lazy, Suspense } from 'react';
import type { RaceDriver, RaceViewState } from '../../adapters/race-view';
import type { RaceSetupProvider, RaceSetupRequest } from '../../adapters/race-setup';
import type { TrackMapData } from '../../components/map/map-model';
import { demoSetupProvider } from '../../fixtures/demo-setup-provider';
const RaceSetup = lazy(() => import('./RaceSetup').then((module) => ({ default: module.RaceSetup })));

interface RacingScreenProps {
  mode: 'quick' | 'championship';
  onExplore: () => void;
  driver?: RaceDriver | null;
  showLabels?: boolean;
  setupProvider?: RaceSetupProvider;
  onPrepared?: (driver: RaceDriver, request: RaceSetupRequest) => void;
  onExploreCircuit?: (track: TrackMapData) => void;
  onExitPreview?: () => void;
  onViewResults?: () => void;
  onComplete?: (state: RaceViewState) => void;
  onRestart?: () => void;
  canChangeSetup?: boolean;
}

export function RacingScreen({ mode, onExplore, driver, showLabels = true, setupProvider = demoSetupProvider, onPrepared = () => {}, onExploreCircuit, onExitPreview, onViewResults = () => {}, onComplete, onRestart, canChangeSetup = false }: RacingScreenProps) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">RACE CONTROL</p><h1>{mode === 'quick' ? 'Quick Race' : 'Championship'}<span className="heading-dot">.</span></h1><p>Take your line. Time the boost. Race to the flag.</p></div>{driver && (canChangeSetup || driver.kind === 'replay' || driver.kind === 'demo') ? <button className="text-button" onClick={onExitPreview}>{driver.kind === 'demo' ? 'Leave driving demo' : driver.kind === 'replay' ? 'Exit display preview' : 'Change race setup'}</button> : <span className="tag muted-tag">{driver ? 'Engine connected' : 'Driving demo available'}</span>}</div>
    {driver ? <RaceSession driver={driver} showLabels={showLabels} onViewResults={onViewResults} onComplete={onComplete} onRestart={onRestart} /> : <Suspense fallback={<p className="lab-message" role="status">Loading race setup...</p>}><RaceSetup mode={mode} provider={setupProvider} showLabels={showLabels} onPrepared={onPrepared} onExplore={onExploreCircuit ?? (() => onExplore())} /></Suspense>}
  </>;
}
