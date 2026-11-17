import { TrackMap } from '../../components/map/TrackMap';
import { previewTrack } from '../../fixtures/preview-track';

interface MainMenuProps {
  onExplore: () => void;
  onLab: () => void;
  onRace: (mode: 'quick' | 'championship') => void;
  showLabels: boolean;
}
export function MainMenu({ onExplore, onLab, onRace, showLabels }: MainMenuProps) {
  return <>
    <section className="hero-panel"><div className="hero-copy"><p className="eyebrow"><span className="live-light" /> THE ALGORITHMIC RACING CHALLENGE</p><h1>Every route.<br />A new <em>decision.</em></h1><p className="hero-description">Explore the network. Find your line. Make every checkpoint count.</p><div className="button-row"><button className="button primary" onClick={onExplore}>Explore the circuit <span>↗</span></button><button className="button secondary" onClick={onLab}>Open Algorithm Lab</button></div><div className="hero-caption"><span>01 / EXPLORE</span><span>02 / PLAN</span><span>03 / RACE</span></div></div><div className="hero-map"><TrackMap track={previewTrack} showLabels={showLabels} /></div></section>
    <section className="mode-grid" aria-label="Choose a mode">
      <button className="mode-card" onClick={() => onRace('championship')}><span className="card-number">01 / CHAMPIONSHIP</span><h2>Build your legacy <span>↗</span></h2><p>Three circuits. One championship. Plan for the whole season.</p><span className="tag muted-tag">Race mode coming soon</span></button>
      <button className="mode-card" onClick={() => onRace('quick')}><span className="card-number">02 / QUICK RACE</span><h2>Find your pace <span>↗</span></h2><p>Inspect the circuit and prepare your next race.</p><span className="tag muted-tag">Race mode coming soon</span></button>
      <button className="mode-card accent-card" onClick={onLab}><span className="card-number">03 / ALGORITHM LAB</span><h2>Under the hood <span>↗</span></h2><p>Insert, extract and inspect a real binary min-heap.</p><span className="tag">Heap workspace available</span></button>
    </section>
  </>;
}
