import type { TrackMapData } from '../components/map/map-model';
import { toCsv } from '../../shared/exports';

export type LabValue = string | number | boolean | null;
export type LabFamily = 'exploration' | 'routing' | 'structures' | 'events' | 'resources' | 'ranking' | 'generation';
export interface LabField {
  id: string; label: string; type: 'vertex' | 'number' | 'select' | 'json'; defaultValue?: string;
  vertexDefault?: 'start' | 'last-checkpoint'; min?: number; max?: number;
  options?: readonly { value: string; label: string }[];
}
export interface LabStep {
  type: string; message: string; counters: Record<string, number>;
  graph?: { track?: TrackMapData; vertex?: number; edge?: string; frontier?: readonly number[]; visited?: readonly number[]; routeEdges?: readonly string[] };
  array?: readonly { label: string; value: number; active?: boolean }[];
  table?: { columns: readonly string[]; rows: readonly (readonly LabValue[])[] };
  state?: Record<string, LabValue>;
}
export interface LabAlgorithm {
  id: string; title: string; family: LabFamily; description: string; usesTrack: boolean;
  fields: readonly LabField[]; counterDescriptions: Record<string, string>;
  /** Delegate to actual core code and emit bounded, cumulative snapshots. */
  run(input: Readonly<Record<string, string>>, context: { track: TrackMapData; signal: AbortSignal; emit: (step: LabStep) => void }): Record<string, LabValue> | Promise<Record<string, LabValue>>;
}
export interface LabTrace {
  schemaVersion: 1; format: 'algorithm-trace'; algorithmId: string; title: string; family: LabFamily;
  capturedAt: string; inputs: Record<string, string>; counterDescriptions: Record<string, string>;
  track: TrackMapData | null; steps: LabStep[]; summary: Record<string, LabValue>;
}
export const missingLabAlgorithms = [
  { id: 'dijkstra', title: 'Dijkstra', family: 'routing' }, { id: 'astar', title: 'A*', family: 'routing' },
  { id: 'knapsack', title: '0/1 Knapsack', family: 'resources' }, { id: 'greedy', title: 'Greedy resources', family: 'resources' },
  { id: 'merge-sort', title: 'Merge Sort', family: 'ranking' }, { id: 'quick-sort', title: 'Quick Sort', family: 'ranking' },
  { id: 'heap-sort', title: 'Heap Sort', family: 'ranking' }, { id: 'top-k', title: 'Heap top-k', family: 'ranking' },
  { id: 'mst', title: 'Minimum spanning tree', family: 'generation' }, { id: 'backtracking', title: 'Backtracking placement', family: 'generation' },
] as const;

export function defaultLabInputs(algorithm: LabAlgorithm, track: TrackMapData): Record<string, string> {
  return Object.fromEntries(algorithm.fields.map((field) => [field.id, field.defaultValue ?? (field.type === 'vertex' ? String((field.vertexDefault === 'last-checkpoint' ? track.vertices.filter((vertex) => vertex.kind === 'checkpoint').at(-1) : track.vertices.find((vertex) => vertex.kind === 'start'))?.id ?? track.vertices[0]?.id ?? '') : '')]));
}

export function validateLabRegistry(algorithms: readonly LabAlgorithm[]): void {
  const ids = new Set<string>();
  for (const algorithm of algorithms) {
    if (!/^[a-z0-9-]+$/.test(algorithm.id) || ids.has(algorithm.id) || !algorithm.title || typeof algorithm.run !== 'function') throw new Error('Algorithm IDs must be unique and adapters must provide a run function.');
    ids.add(algorithm.id);
    const fields = new Set<string>();
    for (const field of algorithm.fields) {
      if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(field.id) || fields.has(field.id) || !field.label || !['vertex', 'number', 'select', 'json'].includes(field.type)) throw new Error('Algorithm input fields are invalid or duplicated.');
      fields.add(field.id);
      if (field.type === 'select' && !field.options?.length) throw new Error('A selectable algorithm input needs options.');
    }
  }
}

function validateInputs(algorithm: LabAlgorithm, inputs: Record<string, string>, track: TrackMapData): void {
  for (const field of algorithm.fields) {
    const value = inputs[field.id];
    if (typeof value !== 'string' || value.length > 20000) throw new Error(`Invalid input: ${field.label}.`);
    if (field.type === 'vertex' && !track.vertices.some((vertex) => vertex.id === Number(value))) throw new Error(`Select an existing ${field.label.toLowerCase()}.`);
    if (field.type === 'number' && (!value.trim() || !Number.isFinite(Number(value)) || field.min !== undefined && Number(value) < field.min || field.max !== undefined && Number(value) > field.max)) throw new Error(`${field.label} is outside its allowed numeric range.`);
    if (field.type === 'select' && !field.options?.some((option) => option.value === value)) throw new Error(`Select a supported ${field.label.toLowerCase()}.`);
    if (field.type === 'json') { try { JSON.parse(value); } catch { throw new Error(`${field.label} must be valid JSON.`); } }
  }
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 2000;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const cell = (value: unknown): value is LabValue => value === null || typeof value === 'boolean' || text(value) || finite(value);
const families = ['exploration', 'routing', 'structures', 'events', 'resources', 'ranking', 'generation'];
function invalid(): never { throw new Error('Invalid algorithm trace. Check the exported trace format, map IDs, cells and cumulative counters.'); }

function validateTrack(value: unknown): asserts value is TrackMapData {
  if (!record(value) || !text(value.name) || !Array.isArray(value.vertices) || value.vertices.length < 1 || value.vertices.length > 500 || !Array.isArray(value.roads) || value.roads.length > 5000) invalid();
  const ids = new Set<number>(), roads = new Set<string>();
  for (const vertex of value.vertices) {
    if (!record(vertex) || !Number.isSafeInteger(vertex.id) || !finite(vertex.x) || !finite(vertex.y) || !text(vertex.label) || !['start', 'checkpoint', 'intersection', 'fuel', 'nitro', 'dead-end'].includes(String(vertex.kind)) || ids.has(vertex.id as number)) invalid();
    ids.add(vertex.id as number);
  }
  for (const road of value.roads) {
    if (!record(road) || !text(road.id) || !road.id || roads.has(road.id) || !ids.has(road.from as number) || !ids.has(road.to as number) || !['open', 'blocked', 'restricted'].includes(String(road.status)) || road.directed !== undefined && typeof road.directed !== 'boolean') invalid();
    roads.add(road.id);
  }
}

function validateStep(value: unknown, track: TrackMapData | null, previous?: LabStep): asserts value is LabStep {
  if (!record(value) || !text(value.type) || !value.type || !text(value.message) || !record(value.counters) || Object.keys(value.counters).length > 50) invalid();
  const keys = Object.keys(value.counters);
  const counts = value.counters;
  if (!keys.every((key) => { const count = counts[key]; return text(key) && finite(count) && Number.isSafeInteger(count) && count >= 0; })) invalid();
  if (previous && (keys.length !== Object.keys(previous.counters).length || keys.some((key) => !Object.hasOwn(previous.counters, key) || Number((value.counters as Record<string, unknown>)[key]) < previous.counters[key]))) invalid();
  if (value.state !== undefined && (!record(value.state) || Object.keys(value.state).length > 50 || !Object.values(value.state).every(cell))) invalid();
  if (value.array !== undefined && (!Array.isArray(value.array) || value.array.length > 200 || !value.array.every((item) => record(item) && text(item.label) && finite(item.value) && (item.active === undefined || typeof item.active === 'boolean')))) invalid();
  if (value.table !== undefined && (!record(value.table) || !Array.isArray(value.table.columns) || value.table.columns.length < 1 || value.table.columns.length > 20 || !value.table.columns.every(text) || !Array.isArray(value.table.rows) || value.table.rows.length > 250 || !value.table.rows.every((row) => Array.isArray(row) && row.length === (value.table as { columns: unknown[] }).columns.length && row.every(cell)))) invalid();
  if (value.graph !== undefined) {
    if (!record(value.graph)) invalid();
    const graph = value.graph;
    if (graph.track !== undefined) validateTrack(graph.track);
    const map = (graph.track as TrackMapData | undefined) ?? track;
    if (!map) invalid();
    const ids = new Set(map.vertices.map((vertex) => vertex.id)), roads = new Set(map.roads.map((road) => road.id));
    if (graph.vertex !== undefined && !ids.has(graph.vertex as number) || graph.edge !== undefined && !roads.has(graph.edge as string)) invalid();
    for (const key of ['frontier', 'visited']) if (graph[key] !== undefined && (!Array.isArray(graph[key]) || !(graph[key] as unknown[]).every((id) => ids.has(id as number)))) invalid();
    if (graph.routeEdges !== undefined && (!Array.isArray(graph.routeEdges) || !graph.routeEdges.every((id) => roads.has(id as string)))) invalid();
  }
}

export async function executeLabAlgorithm(algorithm: LabAlgorithm, inputs: Record<string, string>, track: TrackMapData, signal: AbortSignal): Promise<LabTrace> {
  validateLabRegistry([algorithm]); validateInputs(algorithm, inputs, track);
  const snapshot = structuredClone(track); if (algorithm.usesTrack) validateTrack(snapshot);
  snapshot.vertices.forEach(Object.freeze); snapshot.roads.forEach(Object.freeze);
  Object.freeze(snapshot.vertices); Object.freeze(snapshot.roads); Object.freeze(snapshot);
  const steps: LabStep[] = []; let bytes = 0;
  const checkCancelled = () => { if (signal.aborted) throw new Error('Algorithm execution cancelled.'); };
  checkCancelled();
  const summary = await algorithm.run({ ...inputs }, { track: snapshot, signal, emit: (step) => {
    checkCancelled();
    if (steps.length >= 10000) throw new Error('Trace exceeds 10000 steps. Use a smaller input.');
    validateStep(step, algorithm.usesTrack ? snapshot : null, steps.at(-1));
    const json = JSON.stringify(step); bytes += json.length;
    if (bytes > 4_500_000) throw new Error('Trace exceeds the playback size limit. Use a smaller input.');
    steps.push(JSON.parse(json) as LabStep);
  } });
  checkCancelled();
  if (!record(summary) || !Object.values(summary).every(cell)) invalid();
  const result: LabTrace = { schemaVersion: 1, format: 'algorithm-trace', algorithmId: algorithm.id, title: algorithm.title, family: algorithm.family, capturedAt: new Date().toISOString(),
    inputs: { ...inputs }, counterDescriptions: { ...algorithm.counterDescriptions }, track: algorithm.usesTrack ? snapshot : null, steps, summary };
  return parseLabTrace(JSON.stringify(result));
}

export function parseLabTrace(json: string): LabTrace {
  if (json.length > 5_000_000) throw new Error('Trace file exceeds 5 MB.');
  let value: unknown; try { value = JSON.parse(json); } catch { return invalid(); }
  if (!record(value) || value.schemaVersion !== 1 || value.format !== 'algorithm-trace' || !text(value.algorithmId) || !/^[a-z0-9-]+$/.test(value.algorithmId) || !text(value.title) || !families.includes(String(value.family)) || !text(value.capturedAt) || !Number.isFinite(Date.parse(value.capturedAt)) || !record(value.inputs) || !Object.values(value.inputs).every((input) => typeof input === 'string' && input.length <= 20000) || !record(value.counterDescriptions) || !Object.values(value.counterDescriptions).every(text) || !record(value.summary) || !Object.values(value.summary).every(cell)) invalid();
  if (value.track !== null) validateTrack(value.track);
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.length > 10000) invalid();
  let previous: LabStep | undefined;
  for (const step of value.steps) { if (previous?.type === 'done') invalid(); validateStep(step, value.track as TrackMapData | null, previous); previous = step; }
  if (previous?.type !== 'done') invalid();
  return value as unknown as LabTrace;
}

export function labTraceCsv(trace: LabTrace): string {
  const keys = Object.keys(trace.steps[0].counters);
  return toCsv(['algorithm', 'step', 'type', 'message', ...keys, 'stateJSON'], trace.steps.map((step, index) => [trace.algorithmId, index + 1, step.type, step.message, ...keys.map((key) => step.counters[key]), JSON.stringify(step.state ?? {})]));
}
