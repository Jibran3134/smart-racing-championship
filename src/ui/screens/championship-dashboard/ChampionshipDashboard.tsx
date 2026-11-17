export function ChampionshipDashboard({ onRace }: { onRace: () => void }) {
  return <>
    <div className="page-heading"><div><p className="eyebrow">THE SEASON AT A GLANCE</p><h1>Championship Dashboard<span className="heading-dot">.</span></h1><p>Results, standings and the story of every race.</p></div><span className="tag muted-tag">No race results</span></div>
    <section className="panel integration-state"><span className="state-mark" aria-hidden="true">01</span><p className="eyebrow">A CLEAN SLATE</p><h2>Your season starts here.</h2><p>Race results, points, podiums and live top-k will be available with racing in a future update. There are no recorded races yet.</p><button className="button primary" onClick={onRace}>Championship setup ↗</button></section>
  </>;
}
