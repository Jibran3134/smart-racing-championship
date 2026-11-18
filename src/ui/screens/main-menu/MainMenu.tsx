import { previewTrack } from '../../fixtures/preview-track';
import type { TrackMapData } from '../../components/map/map-model';

interface MainMenuProps {
  onExplore: () => void;
  onLab: () => void;
  onRace: (mode: 'quick' | 'championship') => void;
  showLabels: boolean;
  track?: TrackMapData;
}
export function MainMenu({ onExplore, onLab, onRace, track = previewTrack }: MainMenuProps) {
  return <>
    <section className="hero-panel">
      <svg className="hero-ribbons" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><g fill="none"><path d="M-180 70C170 490 335 300 550 100S1010-100 1370 195" stroke="#7b7b83" strokeWidth="50" opacity=".13" /><path d="M-180 170C170 590 335 400 550 200S1010 0 1370 295" stroke="#a7a7b0" strokeWidth="24" opacity=".09" /><path d="M-200 550C140 750 400 350 660 380S1090 700 1400 340" stroke="#797982" strokeWidth="70" opacity=".08" /><path d="M-180 70C170 490 335 300 550 100S1010-100 1370 195" stroke="#d91f2b" strokeWidth="2" opacity=".3" /></g></svg>
      <div className="hero-copy"><p className="eyebrow"><span className="live-light" /> MAIN MENU / SMART RACING CHAMPIONSHIP</p><h1>Every route.<br />A new <em>decision.</em></h1><p className="hero-description">Explore the network. Find your line. Make every checkpoint count.</p><div className="button-row"><button className="button primary" onClick={onExplore}>Explore the circuit <span>↗</span></button><button className="button secondary" onClick={onLab}>Open Algorithm Lab</button></div><div className="hero-caption"><span>01 / EXPLORE</span><span>02 / PLAN</span><span>03 / RACE</span></div></div>
      <section className="hero-menu" aria-label="Choose a mode">
      <button className="mode-card" onClick={() => onRace('championship')}><span className="card-number">01 / CHAMPIONSHIP</span><h2>Championship <span>↗</span></h2><p>Prepare your season. Full championship integration is in progress.</p></button>
      <button className="mode-card accent-card" onClick={() => onRace('quick')}><span className="card-number">02 / QUICK RACE</span><h2>Quick Race <span>↗</span></h2><p>Four cars. Your racing line. Time the boost and chase the flag.</p></button>
      <button className="mode-card" onClick={onLab}><span className="card-number">03 / ALGORITHM LAB</span><h2>Algorithm Lab <span>↗</span></h2><p>Inspect the searches, heap and events that drive the simulation.</p></button>
      </section>
    </section>
    <section className="panel menu-circuit-strip" aria-label="Current circuit"><span>SELECTED CIRCUIT / <strong>{track.name}</strong></span><span>{track.vertices.filter((vertex) => vertex.kind === 'checkpoint').length} checkpoints / {track.roads.filter((road) => road.shortcut).length} shortcuts</span><span className="tag muted-tag">Route-racing demo available</span></section>
  </>;
}
