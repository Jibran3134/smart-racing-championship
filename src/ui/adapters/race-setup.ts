import type { TrackMapData } from '../components/map/map-model';
import type { RaceDriver } from './race-view';
import type { RoutePreset } from './preset-view';

/** Provisional UI handoff. Actual planning, feasibility and progression stay in core. */
export interface CircuitChoice {
  id: string; title: string; description: string; kind: 'demo' | 'live'; track: TrackMapData;
  lapOptions: readonly number[]; defaultLaps: number;
  initialFuel: number; nitroCapacity: number; defaultNitro: number;
  presets?: readonly RoutePreset[]; eventsConfigurable: boolean;
}
export interface RaceSetupRequest {
  mode: 'quick' | 'championship'; circuitId: string; laps: number; initialNitro: number;
  eventsEnabled: boolean; preset?: RoutePreset; resourcePlanId?: string;
}
export interface ResourcePlanView {
  id: string; label: string; method: 'dp' | 'greedy'; feasible: boolean;
  explanation: string; items: readonly string[]; cost: number; budget: number; budgetLabel: string;
}
export interface ResourceAdvice { required: boolean; plans: readonly ResourcePlanView[] }
export interface RaceSetupProvider {
  circuits: readonly CircuitChoice[];
  /** Engine selects the next championship circuit; UI cannot override its order. */
  championshipCircuitId?: string;
  championshipComplete?: boolean;
  getRecommendations?(request: RaceSetupRequest): ResourceAdvice;
  createRace(request: RaceSetupRequest, signal?: AbortSignal): RaceDriver | Promise<RaceDriver>;
}

export function validateCircuitChoices(provider: RaceSetupProvider): void {
  if (!provider.circuits.length) throw new Error('No circuits are available from the race provider.');
  const ids = new Set<string>();
  for (const circuit of provider.circuits) {
    if (!circuit.id.trim() || ids.has(circuit.id)) throw new Error('Circuit IDs must be nonempty and unique.');
    ids.add(circuit.id);
    if (!circuit.title.trim() || !['demo', 'live'].includes(circuit.kind) || !circuit.lapOptions.length || !circuit.lapOptions.every((lap) => Number.isSafeInteger(lap) && lap > 0) || !circuit.lapOptions.includes(circuit.defaultLaps)) throw new Error('The circuit has invalid identity or lap options.');
    if (!Number.isFinite(circuit.initialFuel) || circuit.initialFuel <= 0 || !Number.isSafeInteger(circuit.nitroCapacity) || circuit.nitroCapacity < 0 || !Number.isSafeInteger(circuit.defaultNitro) || circuit.defaultNitro < 0 || circuit.defaultNitro > circuit.nitroCapacity || circuit.nitroCapacity > 100) throw new Error('The circuit loadout is invalid.');
    const vertices = new Set(circuit.track.vertices.map((vertex) => vertex.id));
    if (!vertices.size || vertices.size !== circuit.track.vertices.length || circuit.track.vertices.some((vertex) => !Number.isSafeInteger(vertex.id) || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y))) throw new Error('The circuit map has invalid vertices.');
    const roads = new Set(circuit.track.roads.map((road) => road.id));
    if (!roads.size || roads.size !== circuit.track.roads.length || circuit.track.roads.some((road) => !road.id || !vertices.has(road.from) || !vertices.has(road.to) || !['open', 'restricted', 'blocked'].includes(road.status))) throw new Error('The circuit map has invalid roads.');
    if (circuit.presets?.some((preset) => !['balanced', 'speed', 'economy', 'safety'].includes(preset))) throw new Error('The circuit exposes an unknown route preset.');
  }
  if (provider.championshipCircuitId && !provider.circuits.some((circuit) => circuit.id === provider.championshipCircuitId && circuit.kind === 'live')) throw new Error('The next championship circuit is unavailable.');
}

export function validateSetupRequest(provider: RaceSetupProvider, request: RaceSetupRequest): CircuitChoice {
  validateCircuitChoices(provider);
  if (request.mode === 'championship' && provider.championshipComplete) throw new Error('The championship is complete. Start a new championship to race again.');
  if (!['quick', 'championship'].includes(request.mode)) throw new Error('The race mode is invalid.');
  const circuit = provider.circuits.find((entry) => entry.id === request.circuitId);
  if (!circuit || !circuit.lapOptions.includes(request.laps)) throw new Error('Select a supported circuit and lap count.');
  if (!Number.isSafeInteger(request.initialNitro) || request.initialNitro < 0 || request.initialNitro > circuit.nitroCapacity || typeof request.eventsEnabled !== 'boolean' || !circuit.eventsConfigurable && !request.eventsEnabled) throw new Error('The selected loadout or event setting is invalid.');
  if (request.preset !== undefined && !circuit.presets?.includes(request.preset)) throw new Error('The selected route preset is unavailable.');
  if (request.mode === 'championship' && (circuit.kind !== 'live' || provider.championshipCircuitId !== circuit.id)) throw new Error('The championship engine must select its next circuit.');
  return circuit;
}

export function validateResourceAdvice(advice: ResourceAdvice): void {
  const ids = new Set<string>();
  for (const plan of advice.plans) {
    if (!plan.id.trim() || ids.has(plan.id) || !plan.label.trim() || !['dp', 'greedy'].includes(plan.method) || typeof plan.feasible !== 'boolean' || !Array.isArray(plan.items) || plan.items.some((item) => typeof item !== 'string') || !Number.isFinite(plan.cost) || plan.cost < 0 || !Number.isFinite(plan.budget) || plan.budget < 0 || !plan.budgetLabel.trim()) throw new Error('Resource recommendations contain invalid data.');
    if (plan.feasible && plan.cost > plan.budget) throw new Error('A resource recommendation exceeds its stated budget.');
    ids.add(plan.id);
  }
  if (typeof advice.required !== 'boolean') throw new Error('The resource selection requirement is invalid.');
}

export function validatePreparedRace(driver: RaceDriver, circuit: CircuitChoice, request: RaceSetupRequest): void {
  if (!driver || driver.kind !== circuit.kind || ['getState', 'start', 'step', 'restart'].some((key) => typeof driver[key as keyof RaceDriver] !== 'function')) throw new Error('The provider did not return a matching race driver.');
  const state = driver.getState();
  if (state.phase !== 'ready' || state.totalLaps !== request.laps || state.track.name !== circuit.track.name || !state.cars.length) throw new Error('The prepared race does not match the selected setup.');
  const human = state.cars.filter((car) => car.isHuman);
  if (human.length !== 1 || human[0].nitro !== request.initialNitro || human[0].nitroCapacity !== circuit.nitroCapacity || human[0].fuel !== circuit.initialFuel || human[0].fuelCapacity !== circuit.initialFuel) throw new Error('The prepared player loadout does not match the selected setup.');
}
