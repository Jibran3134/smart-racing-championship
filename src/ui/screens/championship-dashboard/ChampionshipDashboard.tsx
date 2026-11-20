import { lazy, Suspense, useEffect, useState } from 'react';
import type { ChampionshipProvider, RankingMethod } from '../../adapters/championship-view';
import { exampleChampionship } from '../../fixtures/example-championship';
import { formatRaceTime } from '../../adapters/race-view';
import type { SessionResult } from '../../adapters/session-results';
import { SessionResults } from './SessionResults';
const SeriesChart = lazy(() => import('../../components/charts/SeriesChart').then((module) => ({ default: module.SeriesChart })));

interface DashboardProps {
  onRace: () => void;
  provider?: ChampionshipProvider;
  initialExample?: boolean;
  sessions?: readonly SessionResult[];
  selectedSessionId?: string;
  onSelectSession?: (id: string) => void;
  onSetupRace?: () => void;
  onNewChampionship?: () => void;
}

function readStandings(source: ChampionshipProvider | undefined, method: RankingMethod, topOnly: boolean, k: number) {
    if (!source) return null;
    try {
      const ranking = source.getRanking(method);
      const count = Math.min(k, ranking.length);
      const visible = topOnly ? source.getTopK(count) : ranking;
      if (topOnly && (visible.length !== count || visible.some((row, index) => row.racerId !== ranking[index]?.racerId))) throw new Error('Top-k output does not match the supplied full ranking.');
      return { ranking, visible, count, error: null };
    } catch (error) {
      return { ranking: [], visible: [], count: 0, error: error instanceof Error ? error.message : 'Ranking unavailable.' };
    }
}

export function ChampionshipDashboard({ onRace, provider, initialExample = false, sessions = [], selectedSessionId = '', onSelectSession = () => {}, onSetupRace = onRace, onNewChampionship }: DashboardProps) {
  const [showExample, setShowExample] = useState(initialExample);
  const [method, setMethod] = useState<RankingMethod>('merge');
  const [topOnly, setTopOnly] = useState(false);
  const [k, setK] = useState(3);
  const [raceId, setRaceId] = useState('');
  const [, setRevision] = useState(0);
  const source = provider ?? (showExample ? exampleChampionship : undefined);
  useEffect(() => source?.subscribe?.(() => setRevision((value) => value + 1)), [source]);
  const reading = readStandings(source, method, topOnly, k);
  const race = source?.races.find((item) => item.id === raceId) ?? source?.races[0];

  return <>
    <div className="page-heading"><div><p className="eyebrow">THE SEASON AT A GLANCE</p><h1>Championship Dashboard<span className="heading-dot">.</span></h1><p>Race results, championship standings and live top-k presentation.</p></div>{source ? <span className="tag">{source.kind === 'example' ? 'Example data' : 'Live championship'}</span> : <span className="tag muted-tag">{sessions.length ? 'Session results available' : 'No race results'}</span>}</div>
    <SessionResults sessions={sessions} selectedId={selectedSessionId} onSelect={onSelectSession} onRace={onSetupRace} />
    {source?.kind === 'live' && <section className="panel"><div className="panel-heading"><div><h2>{source.complete ? 'Season complete' : source.races.length ? 'Continue your season' : 'Your season starts here.'}</h2><p>{source.races.length} of 3 championship races completed. Circuit order: Grand Prix Raceway, Desert Canyon, City Grid.</p></div></div><div className="button-row">{!source.complete && <button className="button primary" onClick={onRace}>{source.races.length ? 'Continue championship' : 'Start championship'}</button>}{source.reset && onNewChampionship && (source.races.length > 0 || source.complete) && <button className="button secondary" onClick={onNewChampionship}>Start new championship</button>}</div></section>}
    {!source || !reading ? <section className={`panel ${sessions.length ? 'session-championship-pending' : 'integration-state'}`}><span className="state-mark" aria-hidden="true">01</span><p className="eyebrow">A CLEAN SLATE</p><h2>{sessions.length ? 'Championship standings await scoring.' : 'Your season starts here.'}</h2><p>Championship standings appear when a scoring provider is connected. You can inspect a separate example season below.</p><div className="button-row"><button className="button primary" onClick={() => setShowExample(true)}>Preview example dashboard</button><button className="button secondary" onClick={onRace}>Championship setup ↗</button></div></section> : <>
      {source.kind === 'example' && <div className="preview-banner"><strong>EXAMPLE CHAMPIONSHIP</strong><span>Independent sample season, not replay results. No race was played and no ranking algorithm is being benchmarked.</span>{!provider && <button className="text-button" onClick={() => setShowExample(false)}>Hide example data</button>}</div>}
      {reading.error ? <section className="panel integration-state" role="alert"><h2>Standings unavailable</h2><p>{reading.error}</p><button className="button secondary" onClick={() => { setTopOnly(false); setMethod('merge'); }}>Return to full Merge Sort view</button></section> : <>
        <section className="podium-grid" aria-label="Championship podium">{reading.ranking.slice(0, 3).map((entry, index) => <article className={`panel podium-card podium-${index + 1}`} key={entry.racerId}><p className="eyebrow">{index === 0 && source.complete ? 'CHAMPION' : `POSITION 0${index + 1}`}</p><div className="podium-place" style={{ color: entry.color }}>0{index + 1}</div><h2>{entry.name}</h2><p><strong>{entry.points}</strong> points · {entry.wins} wins</p></article>)}</section>
        {reading.ranking.length === 0 && <div className="notice"><h2>No standings yet</h2><p>The championship has no ranked racers.</p></div>}
        <section className="panel standings-panel"><div className="panel-heading"><h2>Championship standings</h2><span className="small-text">{source.complete ? 'Season complete' : 'Season in progress'}</span></div><div className="standings-controls"><div className="field-group"><label htmlFor="ranking-method">Ranking method</label><select id="ranking-method" value={method} onChange={(event) => setMethod(event.target.value as RankingMethod)}><option value="merge">Merge Sort</option><option value="quick">Quick Sort</option><option value="heap">Heap Sort</option></select></div><label className="top-k-toggle"><input type="checkbox" checked={topOnly} onChange={(event) => setTopOnly(event.target.checked)} />Show top-k only</label><div className="field-group"><label htmlFor="top-k">k</label><select id="top-k" disabled={!topOnly || reading.ranking.length === 0} value={reading.count || ''} onChange={(event) => setK(Number(event.target.value))}>{reading.ranking.map((_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}</select></div></div>
          <div className="table-scroll"><table><caption>{topOnly ? `Top ${reading.count} racers` : 'Full championship ranking'}</caption><thead><tr><th scope="col">Rank</th><th scope="col">Racer</th><th scope="col">Points</th><th scope="col">Wins</th><th scope="col">Position sum</th><th scope="col">Best fastest lap</th></tr></thead><tbody>{reading.visible.map((entry, index) => <tr key={entry.racerId} className={entry.racerId === source.humanRacerId ? 'player-row' : undefined}><td>{index + 1}</td><th scope="row"><span className="racer-swatch" style={{ background: entry.color }} />{entry.name}</th><td className="points-cell">{entry.points}</td><td>{entry.wins}</td><td>{entry.sumOfPositions}</td><td>{formatRaceTime(entry.fastestLap)}</td></tr>)}</tbody></table></div>
          <p className="ranking-note">{topOnly ? 'Top-k is supplied by the ranking provider and checked against the full ranking prefix.' : 'Rows are rendered in the order supplied by the selected core ranking method.'} Ties use points, wins, lower position sum, lower fastest lap and lower racer ID.</p>
        </section>
        <div className="dashboard-detail-grid"><section className="panel"><div className="panel-heading"><h2>Points progression</h2></div><Suspense fallback={<p className="chart-loading">Loading points chart?</p>}><SeriesChart label="Championship points progression" variant="bar" data={source.pointsHistory} xKey="race" series={reading.ranking.map((entry) => ({ key: `racer${entry.racerId}`, label: entry.name, color: entry.color }))} /></Suspense></section>
          <section className="panel"><div className="panel-heading"><h2>Race results</h2></div><div className="results-selector"><label htmlFor="result-race">Race</label><select id="result-race" value={race?.id ?? ''} onChange={(event) => setRaceId(event.target.value)} disabled={!source.races.length}>{source.races.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="table-scroll"><table><caption>{race?.name ?? 'No completed race'}</caption><thead><tr><th scope="col">Pos.</th><th scope="col">Racer</th><th scope="col">Time</th><th scope="col">Fastest lap</th><th scope="col">Points</th></tr></thead><tbody>{race?.results.map((result) => <tr key={result.racerId} className={result.racerId === source.humanRacerId ? 'player-row' : undefined}><td>{result.position}</td><th scope="row">{result.name}{result.status === 'dnf' && <span className="dnf-tag">DNF</span>}</th><td>{result.status === 'dnf' ? 'DNF' : formatRaceTime(result.finishTime)}</td><td>{formatRaceTime(result.fastestLap)}</td><td>{result.points}</td></tr>)}</tbody></table></div></section></div>
      </>}
    </>}
  </>;
}
