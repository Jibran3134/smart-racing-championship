import { useMemo, useState } from 'react';
import { routePresets } from '../../adapters/preset-view';
import type { PresetProvider } from '../../adapters/preset-view';
import type { TrackMapData } from './map-model';
import { TrackMap } from './TrackMap';
import { validatePresetRoutes } from '../../adapters/route-validation';

interface ComparisonProps {
  track: TrackMapData;
  source: number;
  target: number;
  showLabels: boolean;
  examples: readonly { vertices: readonly number[]; edges: readonly string[] }[];
  provider?: PresetProvider;
}

export function PresetComparison({ track, source, target, showLabels, examples, provider }: ComparisonProps) {
  const [showExamples, setShowExamples] = useState(false);
  const reading = useMemo(() => {
    if (!provider) return { routes: [], error: null };
    try {
      const routes = provider.compare({ source, target, track });
      validatePresetRoutes(track, source, target, routes);
      return { routes, error: null };
    } catch (error) { return { routes: [], error: error instanceof Error ? error.message : 'Route comparison unavailable.' }; }
  }, [provider, source, target, track]);

  return <section className="preset-section" aria-label="Four-preset route comparison">
    <div className="page-heading"><div><p className="eyebrow">ONE TRACK / FOUR PRIORITIES</p><h2>Compare your route presets</h2><p>Same track and endpoints: vertex {source} → vertex {target}.</p></div><span className="tag muted-tag">{provider ? 'Planner output' : 'Planner pending'}</span></div>
    {!provider && <div className="preview-banner"><span>Optimized routes and numeric weights await the agreed routing model.</span><label><input type="checkbox" checked={showExamples} onChange={(event) => setShowExamples(event.target.checked)} />Show illustrative path overlays</label></div>}
    {showExamples && !provider && <p className="comparison-caution">These are existing exploratory paths, assigned to cards only to preview the display. They were not selected by preset weights and are not optimized routes.</p>}
    {reading.error && <p className="error-banner" role="alert">{reading.error}</p>}
    <div className="preset-grid">{routePresets.map((preset, index) => {
      const actual = reading.routes.find((route) => route.preset === preset.id);
      const example = !provider && showExamples && examples.length ? examples[index % examples.length] : undefined;
      const usable = actual?.status === 'available' ? actual : undefined;
      const path = usable ?? example;
      const matching = usable && reading.routes.find((route) => route.preset !== preset.id && route.status === 'available' && route.edges.length === usable.edges.length && route.edges.every((edge, at) => edge === usable.edges[at]));
      return <article key={preset.id} className={`panel preset-card preset-${preset.id}`}>
        <div className="panel-heading"><h3>{preset.label}</h3><span className="preset-color" /></div>
        <TrackMap track={track} showLabels={showLabels} highlightedRoads={path?.edges} accessibleName={`${preset.label} route comparison map`} showControls={false} />
        <div className="preset-details"><p>{preset.emphasis}</p><p className="small-text">{actual?.status === 'unreachable' ? 'No legal route reaches the destination.' : actual ? `${actual.edges.length} edges · ${actual.vertices.join(' → ')}` : example ? `Illustrative path · ${example.edges.length} edges` : 'Awaiting planner results.'}</p>
          <dl><div><dt>Distance</dt><dd>{usable?.metrics?.distance ?? '—'}</dd></div><div><dt>Estimated time</dt><dd>{usable?.metrics ? `${usable.metrics.time} s` : '—'}</dd></div><div><dt>Optimized scalar cost</dt><dd>{usable?.metrics?.cost ?? '—'}</dd></div></dl>
          {usable?.weights && <p className="weights-caption">Weights: distance {usable.weights.distance}, time {usable.weights.time}, fuel {usable.weights.fuel}, difficulty {usable.weights.difficulty}, obstacle {usable.weights.obstacle}.</p>}
          {matching && <p className="weights-caption">Same path as {routePresets.find((entry) => entry.id === matching.preset)?.label}; the objective weights may still differ.</p>}
        </div>
      </article>;
    })}</div>
    <div className="notice"><h3>Understand the trade-off</h3><p>A weighted scalar cost expresses a chosen trade-off between normalized distance, time, fuel, difficulty and obstacles. Changing weights can change the route, but some presets may choose the same path. This method does not enumerate every Pareto-optimal route. Compare physical metrics alongside the weights; scalar scores from different weight sets are not directly comparable.</p></div>
  </section>;
}
