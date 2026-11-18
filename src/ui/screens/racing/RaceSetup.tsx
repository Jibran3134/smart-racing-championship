import { useEffect, useMemo, useRef, useState } from 'react';
import type { RaceDriver } from '../../adapters/race-view';
import type { RaceSetupProvider, RaceSetupRequest } from '../../adapters/race-setup';
import { validateCircuitChoices, validatePreparedRace, validateResourceAdvice, validateSetupRequest } from '../../adapters/race-setup';
import { routePresets } from '../../adapters/preset-view';
import { TrackMap } from '../../components/map/TrackMap';
import type { TrackMapData } from '../../components/map/map-model';

interface Props {
  mode: 'quick' | 'championship'; provider: RaceSetupProvider; showLabels: boolean;
  onPrepared: (driver: RaceDriver, request: RaceSetupRequest) => void;
  onExplore: (track: TrackMapData) => void;
}

export function RaceSetup({ mode, provider, showLabels, onPrepared, onExplore }: Props) {
  const [circuitId, setCircuitId] = useState('');
  const [settings, setSettings] = useState<{ id: string; laps: number; nitro: number; events: boolean; preset?: RaceSetupRequest['preset'] } | null>(null);
  const [selection, setSelection] = useState<{ key: string; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { pending.current?.abort(); }, []);
  const catalogue = useMemo(() => {
    try { validateCircuitChoices(provider); return { choices: provider.circuits, error: '' }; }
    catch (failure) { return { choices: [], error: failure instanceof Error ? failure.message : 'Circuits are unavailable.' }; }
  }, [provider]);
  const circuit = catalogue.choices.find((entry) => entry.id === (mode === 'championship' && provider.championshipCircuitId ? provider.championshipCircuitId : circuitId)) ?? catalogue.choices[0];
  const config = useMemo(() => circuit ? settings?.id === circuit.id ? settings : { id: circuit.id, laps: circuit.defaultLaps, nitro: circuit.defaultNitro, events: true, preset: circuit.presets?.[0] } : null, [circuit, settings]);
  const request = useMemo<RaceSetupRequest | null>(() => circuit && config ? { circuitId: circuit.id, mode: circuit.kind === 'demo' ? 'quick' : mode, laps: config.laps, initialNitro: config.nitro, eventsEnabled: config.events, preset: config.preset } : null, [circuit, mode, config]);
  const requestKey = JSON.stringify(request);
  const advice = useMemo(() => {
    if (!request || !provider.getRecommendations) return { data: null, error: '' };
    try { const data = provider.getRecommendations(request); validateResourceAdvice(data); return { data, error: '' }; }
    catch (failure) { return { data: null, error: failure instanceof Error ? failure.message : 'Resource recommendations are unavailable.' }; }
  }, [provider, request]);
  const selectedPlan = selection?.key === requestKey ? advice.data?.plans.find((plan) => plan.id === selection.id && plan.feasible) : undefined;
  const championshipReady = mode !== 'championship' || circuit?.kind === 'demo' || provider.championshipCircuitId === circuit?.id;
  const canPrepare = Boolean(request && championshipReady && !advice.error && (!advice.data?.required || selectedPlan) && !busy);

  const prepare = async () => {
    if (!request || !circuit || !canPrepare) return;
    const controller = new AbortController(); pending.current?.abort(); pending.current = controller;
    const chosen = { ...request, ...(selectedPlan ? { resourcePlanId: selectedPlan.id } : {}) };
    setBusy(true); setError('');
    try {
      validateSetupRequest(provider, chosen);
      const driver = await provider.createRace(chosen, controller.signal);
      if (controller.signal.aborted) return;
      validatePreparedRace(driver, circuit, chosen);
      pending.current = null; setBusy(false); onPrepared(driver, chosen);
    } catch (failure) {
      if (!controller.signal.aborted) { setError(failure instanceof Error ? failure.message : 'Race preparation failed.'); setBusy(false); pending.current = null; }
    }
  };

  if (!circuit || !config) return <section className="panel integration-state" role="alert"><h2>Race setup unavailable</h2><p>{catalogue.error}</p></section>;
  const update = (change: Partial<typeof config>) => { setSettings({ ...config, ...change }); setError(''); };
  return <>
    {mode === 'championship' && circuit.kind === 'demo' && <p className="preview-banner">The full championship is awaiting its engine. You can configure a standalone driving demo below.</p>}
    {mode === 'championship' && circuit.kind === 'live' && !championshipReady && <p className="error-banner" role="alert">The championship engine has not supplied its next circuit.</p>}
    <div className="race-setup-layout"><section className="panel"><div className="panel-heading"><div><p className="eyebrow">01 / CHOOSE YOUR CIRCUIT</p><h2>{circuit.title}</h2></div><span className="tag muted-tag">{circuit.kind === 'demo' ? 'Driving demo' : 'Engine circuit'}</span></div>
      <div className="race-setup-fields"><label htmlFor="setup-circuit">Circuit</label><select id="setup-circuit" value={circuit.id} disabled={busy || mode === 'championship' && Boolean(provider.championshipCircuitId)} onChange={(event) => { setCircuitId(event.target.value); setError(''); }}>{catalogue.choices.map((entry) => <option key={entry.id} value={entry.id}>{entry.title}</option>)}</select><p>{circuit.description}</p></div>
      <TrackMap track={circuit.track} showLabels={showLabels} accessibleName="Selected race circuit" />
      <div className="playback-controls"><button className="button secondary" disabled={busy} onClick={() => onExplore(circuit.track)}>Explore selected circuit</button><span className="small-text">{circuit.track.vertices.filter((vertex) => vertex.kind === 'checkpoint').length} checkpoints / {circuit.track.roads.filter((road) => road.shortcut).length} shortcuts</span></div>
    </section><aside className="panel inspector"><p className="eyebrow">02 / SET YOUR RACE</p><h2>Race setup</h2><fieldset className="setup-loadout" disabled={busy}><label htmlFor="setup-laps">Laps</label><select id="setup-laps" value={config.laps} onChange={(event) => update({ laps: Number(event.target.value) })}>{circuit.lapOptions.map((lap) => <option key={lap} value={lap}>{lap} laps</option>)}</select>
      <label htmlFor="setup-nitro">Starting nitro</label><select id="setup-nitro" value={config.nitro} onChange={(event) => update({ nitro: Number(event.target.value) })}>{Array.from({ length: circuit.nitroCapacity + 1 }, (_, count) => <option key={count} value={count}>{count} charges</option>)}</select>
      <label htmlFor="setup-preset">Route preset</label><select id="setup-preset" value={config.preset ?? ''} disabled={!circuit.presets?.length} onChange={(event) => update({ preset: event.target.value as RaceSetupRequest['preset'] })}>{!circuit.presets?.length && <option value="">Planner not connected</option>}{routePresets.filter((preset) => circuit.presets?.includes(preset.id)).map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select>
      {!circuit.presets?.length && <p className="small-text">This circuit uses a predefined racing route. Exploring a path does not select it for this race.</p>}
      <label className="setup-events"><input type="checkbox" checked={config.events} disabled={!circuit.eventsConfigurable} onChange={(event) => update({ events: event.target.checked })} />Timed track events</label>
    </fieldset><dl className="details-list"><div><dt>Starting fuel</dt><dd>{circuit.initialFuel} / full tank</dd></div><div><dt>Nitro capacity</dt><dd>{circuit.nitroCapacity}</dd></div></dl>
      {circuit.kind === 'demo' && <div className="interaction-guide"><h3>Your controls</h3><p>Choose laps, starting nitro and timed events here. On the grid, press Start race. Cars accelerate and steer automatically.</p><p>During the race, click the track and press <kbd>N</kbd> or use Activate nitro to boost. Nitro increases fuel use, so watch your fuel gauge.</p><p className="small-text">Three-lap sessions have a 180-second simulation limit.</p></div>}
    </aside></div>
    <section className="panel resource-advice"><div className="panel-heading"><div><p className="eyebrow">03 / REVIEW YOUR LOADOUT</p><h2>Resource recommendations</h2></div><span className="tag muted-tag">{advice.data ? 'Planner output' : 'Configured loadout'}</span></div>
      {advice.error ? <p className="error-banner" role="alert">{advice.error}</p> : advice.data ? <><div className="resource-plan-grid">{advice.data.plans.map((plan) => <label className={`resource-plan ${!plan.feasible ? 'infeasible-plan' : ''}`} key={plan.id}><input type="radio" name="resource-plan" aria-label={`Select ${plan.label}`} checked={selectedPlan?.id === plan.id} disabled={busy || !plan.feasible} onChange={() => setSelection({ key: requestKey, id: plan.id })} /><strong>{plan.label}</strong><span>{plan.method === 'dp' ? 'Dynamic programming' : 'Greedy'} / {plan.feasible ? 'Feasible' : 'Infeasible'}</span><p>{plan.explanation}</p><p>{plan.items.join(', ') || 'No optional items'}</p><p>Budget: {plan.cost} / {plan.budget} {plan.budgetLabel}</p></label>)}</div>{!advice.data.plans.some((plan) => plan.feasible) && <p className="notice">No feasible recommendation is available for this setup.</p>}{advice.data.required && !selectedPlan && <p className="lab-message">Select a feasible recommendation before preparing the race.</p>}</> : <p className="lab-message">The configured loadout is {circuit.initialFuel} fuel and {config.nitro} nitro charges. DP and Greedy recommendations will appear when their resource provider is connected.</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="playback-controls"><button className="button primary" disabled={!canPrepare} onClick={() => { void prepare(); }}>{busy ? 'Preparing race...' : circuit.kind === 'demo' ? 'Start driving demo' : 'Prepare race'}</button>{busy && <button className="button secondary" onClick={() => { pending.current?.abort(); pending.current = null; setBusy(false); }}>Cancel preparation</button>}<p className="small-text">Next: open the grid, then press Start race when you are ready. Sound begins with the race.</p></div>
    </section>
  </>;
}
