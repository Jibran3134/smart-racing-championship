export function RacingScreen({ mode, onExplore }: { mode: 'quick' | 'championship'; onExplore: () => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">RACE PREPARATION</p><h1>{mode === 'quick' ? 'Quick Race' : 'Championship'}<span className="heading-dot">.</span></h1><p>Your next race starts with a plan.</p></div><span className="tag muted-tag">Not yet playable</span></div>
    <section className="panel integration-state"><span className="state-mark" aria-hidden="true">⚑</span><p className="eyebrow">RACE MODE COMING SOON</p><h2>The grid is being prepared.</h2><p>Race simulation is not available in this version. You can inspect checkpoints, services and roads in the preview layout while the grid is being prepared.</p><div className="button-row"><button className="button primary" onClick={onExplore}>Explore the layout ↗</button><button className="button secondary" disabled>Start race</button></div></section>
  </>;
}
