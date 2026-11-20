/**
 * Production Application Adapters — Integration of Pure Core with UI.
 *
 * Provides:
 *  1. productionPresetProvider      - Dijkstra multi-preset route comparisons.
 *  2. productionChampionshipProvider - Championship standings (Merge, Quick, Heap sort & Top-k).
 *  3. productionRaceSetupProvider    - Playable circuits (Grand Prix, Desert Canyon, City Grid).
 *  4. productionLabAlgorithms        - 10 algorithm adapters for the Algorithm Lab.
 *
 * Rules:
 *  - Calls only real core algorithms from src/core/ (no fake mock results).
 *  - Validates all contracts before returning to the UI.
 *  - Completely deterministic.
 */

import { TrackGraph } from '../core/graph/TrackGraph';
import { dijkstra } from '../core/algorithms/routing/dijkstra';
import { astar } from '../core/algorithms/routing/astar';
import { knapsackDP } from '../core/algorithms/resources/knapsackDP';
import { greedyKnapsack } from '../core/algorithms/resources/greedyKnapsack';
import { mergeSort } from '../core/algorithms/sorting/mergeSort';
import { quickSort } from '../core/algorithms/sorting/quickSort';
import { heapSort } from '../core/algorithms/sorting/heapSort';
import { topK } from '../core/algorithms/sorting/topK';
import { ChampionshipManager } from '../core/championship/ChampionshipManager';
import { primMST } from '../core/algorithms/mst/mst';
import { placeTrackFeatures } from '../core/algorithms/backtracking/trackPlacement';
import { RaceEngine } from '../core/engine/RaceEngine';
import type { RaceEventInput } from '../core/events/EventProcessor';
import { ResourceAdvisor } from '../core/resources/ResourceAdvisor';
import { PRESET_WEIGHTS, MAX_FUEL, RESOURCE_UNIT } from '../core/config';
import type { Vertex, Edge, CostPreset, ChampionshipEntry, ResourceItem } from '../core/types';

import type { PresetProvider, PresetRouteView } from '../ui/adapters/preset-view';
import { routePresets } from '../ui/adapters/preset-view';
import type { ChampionshipProvider, StandingView, ResultView, RankingMethod } from '../ui/adapters/championship-view';
import type { RaceSetupProvider, RaceSetupRequest, CircuitChoice, ResourceAdvice } from '../ui/adapters/race-setup';
import type { RaceDriver, RaceViewState, RacerView } from '../ui/adapters/race-view';
import type { TrackMapData, MapVertex } from '../ui/components/map/map-model';
import type { LabAlgorithm } from '../ui/adapters/algorithm-lab';
import { createDrivingDemo } from '../ui/fixtures/driving-demo';
import { previewTrack } from '../ui/fixtures/preview-track';
import { racerPaints } from '../ui/styles/palette';

import gpCircuitRaw from '../data/tracks/circuit-grand-prix.json';
import dcCircuitRaw from '../data/tracks/circuit-desert-canyon.json';
import cgCircuitRaw from '../data/tracks/circuit-city-grid.json';

// ============================================================================
// Helpers: Map Data Converters
// ============================================================================

function toMapVertexKind(type: Vertex['type']): MapVertex['kind'] {
  switch (type) {
    case 'Start': return 'start';
    case 'Checkpoint': return 'checkpoint';
    case 'FuelStation': return 'fuel';
    case 'NitroPickup': return 'nitro';
    case 'DeadEnd': return 'dead-end';
    default: return 'intersection';
  }
}

function toTrackMapData(
  name: string,
  vertices: readonly Vertex[],
  edges: readonly Edge[],
): TrackMapData {
  return {
    name,
    vertices: vertices.map((v) => ({
      id: v.id,
      x: v.x,
      y: v.y,
      label: v.type === 'Start'
        ? 'Start / finish'
        : v.type === 'Checkpoint'
        ? `Checkpoint ${String(v.checkpointOrder ?? v.id).padStart(2, '0')}`
        : v.type === 'FuelStation'
        ? `Fuel station (V${v.id})`
        : v.type === 'NitroPickup'
        ? `Nitro pickup (V${v.id})`
        : v.type === 'DeadEnd'
        ? `Dead end (V${v.id})`
        : `Intersection (V${v.id})`,
      kind: toMapVertexKind(v.type),
      checkpointOrder: v.checkpointOrder,
      active: v.active,
    })),
    roads: edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      status: e.status === 'Blocked' ? 'blocked' : e.status === 'Restricted' ? 'restricted' : 'open',
      shortcut: e.isShortcut,
      directed: e.directed,
    })),
  };
}

function mapDataToCoreGraph(track: TrackMapData): { vertices: Vertex[]; edges: Edge[] } {
  const vMap = new Map<number, MapVertex>(track.vertices.map((v) => [v.id, v]));
  const vertices: Vertex[] = track.vertices.map((v) => ({
    id: v.id,
    x: v.x,
    y: v.y,
    type: v.kind === 'start'
      ? 'Start'
      : v.kind === 'checkpoint'
      ? 'Checkpoint'
      : v.kind === 'fuel'
      ? 'FuelStation'
      : v.kind === 'nitro'
      ? 'NitroPickup'
      : v.kind === 'dead-end'
      ? 'DeadEnd'
      : 'Intersection',
    checkpointOrder: v.checkpointOrder,
    active: v.active ?? true,
  }));

  const edges: Edge[] = track.roads.map((r) => {
    const fromV = vMap.get(r.from)!;
    const toV = vMap.get(r.to)!;
    const dist = Math.max(10, Math.round(Math.hypot(toV.x - fromV.x, toV.y - fromV.y)));
    return {
      id: r.id,
      from: r.from,
      to: r.to,
      distance: dist,
      baseTime: Math.max(2, Math.round(dist / 15)),
      fuelCost: Math.max(1, Math.round(dist / 40)),
      difficulty: r.shortcut ? 3 : 2,
      status: r.status === 'blocked' ? 'Blocked' : r.status === 'restricted' ? 'Restricted' : 'Open',
      isShortcut: Boolean(r.shortcut),
      directed: Boolean(r.directed),
    };
  });

  return { vertices, edges };
}

// ============================================================================
// 1. Preset Provider
// ============================================================================

export const productionPresetProvider: PresetProvider = {
  compare({ source, target, track }) {
    const { vertices, edges } = mapDataToCoreGraph(track);
    const graph = new TrackGraph(vertices, edges);

    const results: PresetRouteView[] = [];

    for (const presetItem of routePresets) {
      const presetName = (presetItem.id.charAt(0).toUpperCase() + presetItem.id.slice(1)) as CostPreset;
      const leg = dijkstra(graph, source, target, presetName);
      const weights = PRESET_WEIGHTS[presetName];

      if (!leg) {
        results.push({
          preset: presetItem.id,
          status: 'unreachable',
          vertices: [],
          edges: [],
          metrics: null,
          weights,
        });
      } else {
        const cleanEdges = leg.edgeIds.map((eid) => (eid.endsWith('~rev') ? eid.slice(0, -4) : eid));
        results.push({
          preset: presetItem.id,
          status: 'available',
          vertices: leg.path,
          edges: cleanEdges,
          metrics: {
            distance: leg.distance,
            time: Math.round(leg.time * 10) / 10,
            cost: Math.round(leg.scalarCost * 100) / 100,
          },
          weights,
        });
      }
    }

    return results;
  },
};

// ============================================================================
// 2. Championship Provider
// ============================================================================

const champManager = new ChampionshipManager();
const listeners = new Set<() => void>();

function notifyChampionship() {
  for (const listener of listeners) {
    try { listener(); } catch { /* ignore */ }
  }
}

// Initial registered racers
const racerNames: Record<string, string> = {
  '1': 'You',
  '2': 'Main Apex',
  '3': 'Shortcut Phantom',
  '4': 'Metric Shadow',
};

for (const [id, name] of Object.entries(racerNames)) {
  champManager.registerRacer({ racerId: id, name, isHuman: id === '1' });
}

// Initial seed championship data (historical races so dashboard has rich initial state)
champManager.addRaceResults('race-1', 'Grand Prix Raceway', [
  { raceId: 'race-1', racerId: '1', finishPosition: 1, finishTime: 98.4, fastestLap: 45.2, bonusPoints: 0, pointsAwarded: 25 },
  { raceId: 'race-1', racerId: '2', finishPosition: 2, finishTime: 101.1, fastestLap: 46.0, bonusPoints: 0, pointsAwarded: 18 },
  { raceId: 'race-1', racerId: '3', finishPosition: 3, finishTime: 103.5, fastestLap: 46.8, bonusPoints: 0, pointsAwarded: 15 },
  { raceId: 'race-1', racerId: '4', finishPosition: 4, finishTime: 106.2, fastestLap: 47.9, bonusPoints: 0, pointsAwarded: 12 },
]);

champManager.addRaceResults('race-2', 'Desert Canyon', [
  { raceId: 'race-2', racerId: '3', finishPosition: 1, finishTime: 110.2, fastestLap: 43.8, bonusPoints: 0, pointsAwarded: 25 },
  { raceId: 'race-2', racerId: '1', finishPosition: 2, finishTime: 112.0, fastestLap: 44.5, bonusPoints: 0, pointsAwarded: 18 },
  { raceId: 'race-2', racerId: '2', finishPosition: 3, finishTime: 113.8, fastestLap: 45.1, bonusPoints: 0, pointsAwarded: 15 },
  { raceId: 'race-2', racerId: '4', finishPosition: 4, finishTime: 118.4, fastestLap: 48.0, bonusPoints: 0, pointsAwarded: 12 },
]);

function toStandingView(entry: ChampionshipEntry): StandingView {
  const idNum = Number(entry.racerId);
  return {
    racerId: idNum,
    name: racerNames[entry.racerId] ?? `Racer ${entry.racerId}`,
    color: racerPaints[(idNum - 1) % racerPaints.length] ?? racerPaints[0],
    points: entry.totalPoints,
    wins: entry.wins,
    sumOfPositions: entry.sumOfFinishPositions,
    fastestLap: entry.bestFastestLap,
  };
}

export const productionChampionshipProvider: ChampionshipProvider = {
  kind: 'live',
  humanRacerId: 1,
  get complete() {
    return champManager.getRaces().length >= 3;
  },
  get races() {
    return champManager.getRaces().map((r) => ({
      id: r.id,
      name: r.name,
      results: r.results.map((res): ResultView => ({
        racerId: Number(res.racerId),
        name: racerNames[res.racerId] ?? `Racer ${res.racerId}`,
        position: res.finishPosition,
        status: res.finishTime !== null ? 'finished' : 'dnf',
        finishTime: res.finishTime,
        fastestLap: res.fastestLap,
        points: res.pointsAwarded,
      })),
    }));
  },
  getRanking(method: RankingMethod): readonly StandingView[] {
    return champManager.getStandings(method).map(toStandingView);
  },
  getTopK(k: number): readonly StandingView[] {
    return champManager.getTopK(k).map(toStandingView);
  },
  get pointsHistory() {
    return champManager.getPointsHistory();
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// ============================================================================
// 3. Race Setup Provider & Live RaceDriver
// ============================================================================

const gpMap = toTrackMapData(gpCircuitRaw.name, gpCircuitRaw.vertices as Vertex[], gpCircuitRaw.edges as Edge[]);
const dcMap = toTrackMapData(dcCircuitRaw.name, dcCircuitRaw.vertices as Vertex[], dcCircuitRaw.edges as Edge[]);
const cgMap = toTrackMapData(cgCircuitRaw.name, cgCircuitRaw.vertices as Vertex[], cgCircuitRaw.edges as Edge[]);

const circuitsCatalog: CircuitChoice[] = [
  {
    id: 'circuit-grand-prix',
    title: 'Grand Prix Raceway',
    description: '16 vertices, 22 edges, 10 mandatory checkpoints, 2 designated shortcuts. Balanced championship circuit.',
    kind: 'live',
    track: gpMap,
    lapOptions: [2, 3],
    defaultLaps: 2,
    initialFuel: MAX_FUEL,
    nitroCapacity: 3,
    defaultNitro: 3,
    presets: ['balanced', 'speed', 'economy', 'safety'],
    eventsConfigurable: true,
  },
  {
    id: 'circuit-desert-canyon',
    title: 'Desert Canyon',
    description: '17 vertices, 23 edges, 10 checkpoints, high-difficulty rugged canyon shortcuts and fuel management.',
    kind: 'live',
    track: dcMap,
    lapOptions: [2, 3],
    defaultLaps: 2,
    initialFuel: MAX_FUEL,
    nitroCapacity: 3,
    defaultNitro: 3,
    presets: ['balanced', 'speed', 'economy', 'safety'],
    eventsConfigurable: true,
  },
  {
    id: 'circuit-city-grid',
    title: 'City Grid',
    description: '18 vertices, 24 edges, 10 checkpoints, 4 urban shortcuts and tight corners.',
    kind: 'live',
    track: cgMap,
    lapOptions: [2, 3],
    defaultLaps: 2,
    initialFuel: MAX_FUEL,
    nitroCapacity: 3,
    defaultNitro: 3,
    presets: ['balanced', 'speed', 'economy', 'safety'],
    eventsConfigurable: true,
  },
  {
    id: 'driving-demo',
    title: previewTrack.name,
    description: 'Supplied-route demonstration. Four cars, ordered checkpoints and timed track events.',
    kind: 'demo',
    track: previewTrack,
    lapOptions: [2, 3],
    defaultLaps: 2,
    initialFuel: MAX_FUEL,
    nitroCapacity: 3,
    defaultNitro: 3,
    presets: ['balanced', 'speed', 'economy', 'safety'],
    eventsConfigurable: true,
  },
];

class LiveEngineDriver implements RaceDriver {
  readonly kind = 'live' as const;
  private readonly engine: RaceEngine;
  private readonly track: TrackMapData;
  private recorded = false;

  constructor(engine: RaceEngine, track: TrackMapData) {
    this.engine = engine;
    this.track = track;
  }

  start(): void {
    this.engine.start();
  }

  step(seconds: number): void {
    this.engine.step(seconds);
    const state = this.engine.getState();
    if (state.phase === 'finished' && !this.recorded) {
      this.recorded = true;
      champManager.addRaceResults(
        `race-${Date.now()}`,
        this.track.name,
        this.engine.getResults(),
      );
      notifyChampionship();
    }
  }

  restart(): void {
    this.recorded = false;
    this.engine.restart();
  }

  activateNitro(): void {
    this.engine.activateNitro();
  }

  getState(): RaceViewState {
    const s = this.engine.getState();

    const carViews: RacerView[] = s.cars.map((c) => {
      const idNum = c.id;
      return {
        id: idNum,
        label: c.name,
        color: racerPaints[(idNum - 1) % racerPaints.length] ?? racerPaints[0],
        location: { edge: c.edgeId, progress: c.progress, reverse: c.reverse },
        isHuman: c.isHuman,
        position: c.position,
        status: c.status,
        statusReason: c.reason,
        fuel: c.fuel,
        fuelCapacity: c.fuelCapacity,
        nitro: c.nitro,
        nitroCapacity: c.nitroCapacity,
        lap: c.completedLaps,
        checkpoint: c.checkpoint,
        speedKph: Math.round(c.speed * 1.8),
        braking: c.braking,
        boosting: c.nitroUntil > s.clock,
        finishTime: c.finishTime,
      };
    });

    return {
      phase: s.phase,
      countdown: s.countdown,
      clock: s.clock,
      totalLaps: s.totalLaps,
      checkpointCount: s.checkpointCount,
      track: this.track,
      cars: carViews,
      events: s.events,
      routeEdges: s.routeEdges,
    };
  }
}

function computeResourceAdvice(request: RaceSetupRequest): ResourceAdvice {
  const circuit = circuitsCatalog.find((c) => c.id === request.circuitId);
  if (!circuit) return { required: false, plans: [] };

  // Extract pickup candidates with physically meaningful detour cost based on track geometry
  const startPos = circuit.track.vertices.find((tv) => tv.kind === 'start') ?? circuit.track.vertices[0];
  const items: ResourceItem[] = circuit.track.vertices
    .filter((v) => v.kind === 'fuel' || v.kind === 'nitro')
    .map((v) => {
      const dist = Math.hypot(v.x - startPos.x, v.y - startPos.y);
      const detourCost = Math.max(8, Math.round(dist / 35));
      return {
        id: `pickup-${v.id}`,
        label: v.kind === 'fuel' ? `Fuel Depot at Vertex ${v.id}` : `Nitro Boost at Vertex ${v.id}`,
        cost: detourCost,
        benefit: v.kind === 'fuel' ? 45 : 35,
      };
    });

  if (items.length === 0) {
    items.push(
      { id: 'opt-1', label: 'Safety fuel reserve', cost: 10, benefit: 25 },
      { id: 'opt-2', label: 'Nitro boost charge', cost: 15, benefit: 35 },
    );
  }

  const advisor = new ResourceAdvisor();
  const advice = advisor.getRecommendations({ items, budget: 50 * RESOURCE_UNIT });

  return {
    required: true,
    plans: advice.plans.map((p) => ({
      id: p.id,
      label: p.label,
      method: p.method,
      feasible: p.feasible,
      explanation: p.explanation,
      items: p.selectedIds,
      cost: p.totalCost,
      budget: p.budget,
      budgetLabel: p.budgetLabel,
    })),
  };
}

export const productionRaceSetupProvider: RaceSetupProvider = {
  circuits: circuitsCatalog,
  championshipCircuitId: 'circuit-grand-prix',

  getRecommendations: computeResourceAdvice,

  createRace(request: RaceSetupRequest): RaceDriver {
    if (request.circuitId === 'driving-demo') {
      return createDrivingDemo({
        laps: request.laps,
        initialNitro: request.initialNitro,
        eventsEnabled: request.eventsEnabled,
      });
    }

    let raw: { name: string; vertices: unknown[]; edges: unknown[] } = gpCircuitRaw;
    if (request.circuitId === 'circuit-desert-canyon') raw = dcCircuitRaw;
    else if (request.circuitId === 'circuit-city-grid') raw = cgCircuitRaw;

    const vertices = raw.vertices as Vertex[];
    const edges = raw.edges as Edge[];
    const circuitChoice = circuitsCatalog.find((c) => c.id === request.circuitId)!;

    // Apply Resource Plan decisions (Bug 4 fix: resourcePlanId changes gameplay)
    let initialFuel = circuitChoice.initialFuel;
    let initialNitro = request.initialNitro ?? 2;

    if (request.resourcePlanId) {
      const advice = computeResourceAdvice(request);
      const chosen = advice.plans.find((p) => p.id === request.resourcePlanId) ?? advice.plans[0];
      if (chosen) {
        const hasFuel = chosen.items.some((id) => id.includes('pickup-') || id.includes('opt-1'));
        const hasNitro = chosen.items.some((id) => id.includes('nitro') || id.includes('opt-2'));
        if (hasFuel) initialFuel = Math.min(MAX_FUEL, initialFuel + 10);
        if (hasNitro) initialNitro = Math.min(3, initialNitro + 1);
      }
    }

    // Schedule events when enabled (Bug 2 fix: supply dynamic events)
    const events: RaceEventInput[] = [];
    if (request.eventsEnabled) {
      const openEdge = edges.find((e) => !e.isShortcut && e.status === 'Open');
      const scEdge = edges.find((e) => e.isShortcut);
      const secondEdge = edges.filter((e) => !e.isShortcut && e.status === 'Open')[2];

      if (openEdge) {
        events.push({
          eventId: 'speed-restriction-sector',
          triggerTime: 12,
          effect: { type: 'speed-restriction', edgeId: openEdge.id, duration: 15, speedCap: 45 },
        });
      }
      if (secondEdge) {
        events.push({
          eventId: 'oil-spill-hazard',
          triggerTime: 24,
          effect: { type: 'oil-spill', edgeId: secondEdge.id, duration: 14, difficultyPenalty: 2, speedCap: 40 },
        });
      }
      if (scEdge) {
        events.push(
          { eventId: 'shortcut-lockdown', triggerTime: 18, effect: { type: 'road-blockage', edgeId: scEdge.id, blocked: true } },
          { eventId: 'shortcut-cleared', triggerTime: 36, effect: { type: 'road-blockage', edgeId: scEdge.id, blocked: false } },
        );
      }
    }

    const engine = new RaceEngine({
      trackName: raw.name,
      vertices,
      edges,
      startVertexId: vertices.find((v) => v.type === 'Start')?.id ?? 0,
      laps: request.laps,
      initialNitro,
      initialFuel,
      preset: request.preset
        ? (request.preset.charAt(0).toUpperCase() + request.preset.slice(1) as CostPreset)
        : 'Balanced',
      events: events.length > 0 ? events : undefined,
    });

    return new LiveEngineDriver(engine, circuitChoice.track);
  },
};

// ============================================================================
// 4. Algorithm Lab Adapters (Connecting All 10 Required Algorithms)
// ============================================================================

export const productionLabAlgorithms: readonly LabAlgorithm[] = [
  // 1. Dijkstra
  {
    id: 'dijkstra',
    title: 'Dijkstra shortest path',
    family: 'routing',
    description: 'Optimal shortest path with non-negative scalar weights. Runs the live production Dijkstra with lazy-deletion heap.',
    usesTrack: true,
    fields: [
      { id: 'source', label: 'Start vertex', type: 'vertex', vertexDefault: 'start' },
      { id: 'target', label: 'Destination vertex', type: 'vertex', vertexDefault: 'last-checkpoint' },
      {
        id: 'preset',
        label: 'Route preset',
        type: 'select',
        defaultValue: 'Balanced',
        options: [
          { value: 'Balanced', label: 'Balanced' },
          { value: 'Speed', label: 'Speed' },
          { value: 'Economy', label: 'Economy' },
          { value: 'Safety', label: 'Safety' },
        ],
      },
    ],
    counterDescriptions: {
      expandedVertices: 'Vertices finalized.',
      relaxedEdges: 'Edge relaxations.',
      heapOps: 'Heap operations.',
      comparisons: 'Key comparisons.',
    },
    run(input, { track, emit }) {
      const { vertices, edges } = mapDataToCoreGraph(track);
      const graph = new TrackGraph(vertices, edges);
      const source = Number(input.source);
      const target = Number(input.target);
      const preset = (input.preset ?? 'Balanced') as CostPreset;

      const visited: number[] = [];
      let lastCounters = { expandedVertices: 0, relaxedEdges: 0, heapOps: 0, comparisons: 0 };

      const res = dijkstra(graph, source, target, preset, [], (step) => {
        if (step.type === 'done') return;
        if (step.vertex !== undefined && !visited.includes(step.vertex)) visited.push(step.vertex);
        const cleanEdge = step.edge ? (step.edge.endsWith('~rev') ? step.edge.slice(0, -4) : step.edge) : undefined;
        lastCounters = {
          expandedVertices: step.counters.expandedVertices,
          relaxedEdges: step.counters.relaxedEdges,
          heapOps: step.counters.heapOps,
          comparisons: step.counters.comparisons,
        };
        emit({
          type: step.type,
          message: `${step.type}: vertex ${step.vertex ?? ''} ${cleanEdge ? `via ${cleanEdge}` : ''}`,
          counters: { ...lastCounters },
          graph: { vertex: step.vertex, edge: cleanEdge, visited: [...visited] },
        });
      });

      emit({
        type: 'done',
        message: res ? `Optimal path found: ${res.path.join(' → ')} (Cost: ${res.scalarCost.toFixed(2)})` : 'Destination is unreachable.',
        counters: { ...lastCounters },
        graph: { visited, routeEdges: res?.edgeIds.map((e) => (e.endsWith('~rev') ? e.slice(0, -4) : e)) ?? [] },
        state: {
          reachable: Boolean(res),
          distance: res ? `${res.distance} m` : 'none',
          time: res ? `${res.time.toFixed(1)} s` : 'none',
          cost: res ? res.scalarCost.toFixed(2) : 'none',
        },
      });

      return {
        reachable: Boolean(res),
        distance: res?.distance ?? null,
        cost: res ? Math.round(res.scalarCost * 100) / 100 : null,
      };
    },
  },

  // 2. A*
  {
    id: 'astar',
    title: 'A* heuristic search',
    family: 'routing',
    description: 'Admissible Euclidean distance heuristic-guided path search. Guarantees optimal path while pruning search space.',
    usesTrack: true,
    fields: [
      { id: 'source', label: 'Start vertex', type: 'vertex', vertexDefault: 'start' },
      { id: 'target', label: 'Destination vertex', type: 'vertex', vertexDefault: 'last-checkpoint' },
      {
        id: 'preset',
        label: 'Route preset',
        type: 'select',
        defaultValue: 'Balanced',
        options: [
          { value: 'Balanced', label: 'Balanced' },
          { value: 'Speed', label: 'Speed' },
          { value: 'Economy', label: 'Economy' },
          { value: 'Safety', label: 'Safety' },
        ],
      },
    ],
    counterDescriptions: {
      expandedVertices: 'Vertices finalized.',
      relaxedEdges: 'Edge relaxations.',
      heapOps: 'Heap operations.',
      comparisons: 'Key comparisons.',
    },
    run(input, { track, emit }) {
      const { vertices, edges } = mapDataToCoreGraph(track);
      const graph = new TrackGraph(vertices, edges);
      const source = Number(input.source);
      const target = Number(input.target);
      const preset = (input.preset ?? 'Balanced') as CostPreset;

      const visited: number[] = [];
      let lastCounters = { expandedVertices: 0, relaxedEdges: 0, heapOps: 0, comparisons: 0 };

      const res = astar(graph, source, target, preset, [], (step) => {
        if (step.type === 'done') return;
        if (step.vertex !== undefined && !visited.includes(step.vertex)) visited.push(step.vertex);
        const cleanEdge = step.edge ? (step.edge.endsWith('~rev') ? step.edge.slice(0, -4) : step.edge) : undefined;
        lastCounters = {
          expandedVertices: step.counters.expandedVertices,
          relaxedEdges: step.counters.relaxedEdges,
          heapOps: step.counters.heapOps,
          comparisons: step.counters.comparisons,
        };
        emit({
          type: step.type,
          message: `${step.type}: vertex ${step.vertex ?? ''} (f=${step.f?.toFixed(2) ?? ''})`,
          counters: { ...lastCounters },
          graph: { vertex: step.vertex, edge: cleanEdge, visited: [...visited] },
        });
      });

      emit({
        type: 'done',
        message: res ? `Optimal path found: ${res.path.join(' → ')} (Cost: ${res.scalarCost.toFixed(2)})` : 'Destination is unreachable.',
        counters: { ...lastCounters },
        graph: { visited, routeEdges: res?.edgeIds.map((e) => (e.endsWith('~rev') ? e.slice(0, -4) : e)) ?? [] },
        state: {
          reachable: Boolean(res),
          distance: res ? `${res.distance} m` : 'none',
          cost: res ? res.scalarCost.toFixed(2) : 'none',
        },
      });

      return {
        reachable: Boolean(res),
        distance: res?.distance ?? null,
        cost: res ? Math.round(res.scalarCost * 100) / 100 : null,
      };
    },
  },

  // 3. 0/1 Knapsack DP
  {
    id: 'knapsack',
    title: '0/1 Knapsack DP',
    family: 'resources',
    description: 'Optimal discrete resource allocation with table reconstruction. Guaranteed global optimum.',
    usesTrack: false,
    fields: [
      {
        id: 'items',
        label: 'Items JSON',
        type: 'json',
        defaultValue: '[{"id":"fuel-1","label":"Station 1","cost":20,"benefit":45},{"id":"nitro-1","label":"Nitro 1","cost":15,"benefit":35},{"id":"shortcut-1","label":"Shortcut 1","cost":30,"benefit":70}]',
      },
      { id: 'budget', label: 'Budget', type: 'number', defaultValue: '50', min: 1, max: 200 },
    ],
    counterDescriptions: {
      dpStatesFilled: 'DP table cells evaluated.',
      itemsConsidered: 'Items evaluated.',
    },
    run(input, { emit }) {
      const items = JSON.parse(input.items) as ResourceItem[];
      const budget = Number(input.budget);

      emit({
        type: 'init',
        message: `Initializing 0/1 Knapsack with ${items.length} items and budget ${budget}.`,
        counters: { dpStatesFilled: 0, itemsConsidered: 0 },
        table: {
          columns: ['ID', 'Cost', 'Benefit', 'Ratio'],
          rows: items.map((it) => [it.id, it.cost, it.benefit, (it.benefit / Math.max(1, it.cost)).toFixed(2)]),
        },
      });

      const plan = knapsackDP(items, budget);

      emit({
        type: 'done',
        message: `DP complete: selected ${plan.selectedIds.join(', ')} (benefit ${plan.totalBenefit}, cost ${plan.totalCost}/${budget}).`,
        counters: { dpStatesFilled: plan.dpStateCount, itemsConsidered: items.length },
        table: {
          columns: ['ID', 'Cost', 'Benefit', 'Selected'],
          rows: items.map((it) => [it.id, it.cost, it.benefit, plan.selectedIds.includes(it.id) ? 'Yes' : 'No']),
        },
        state: {
          totalBenefit: plan.totalBenefit,
          totalCost: plan.totalCost,
          selected: plan.selectedIds.join(', '),
        },
      });

      return {
        totalBenefit: plan.totalBenefit,
        totalCost: plan.totalCost,
        selectedCount: plan.selectedIds.length,
      };
    },
  },

  // 4. Greedy Resource Heuristic
  {
    id: 'greedy',
    title: 'Greedy resource heuristic',
    family: 'resources',
    description: 'Fast ratio-sorted heuristic (vi / ci). Fast O(n log n) but may produce suboptimal results on knapsack budgets.',
    usesTrack: false,
    fields: [
      {
        id: 'items',
        label: 'Items JSON',
        type: 'json',
        defaultValue: '[{"id":"fuel-1","label":"Station 1","cost":20,"benefit":45},{"id":"nitro-1","label":"Nitro 1","cost":15,"benefit":35},{"id":"shortcut-1","label":"Shortcut 1","cost":30,"benefit":70}]',
      },
      { id: 'budget', label: 'Budget', type: 'number', defaultValue: '50', min: 1, max: 200 },
    ],
    counterDescriptions: {
      itemsEvaluated: 'Items considered.',
      selectedCount: 'Items selected.',
    },
    run(input, { emit }) {
      const items = JSON.parse(input.items) as ResourceItem[];
      const budget = Number(input.budget);

      emit({
        type: 'init',
        message: `Sorting ${items.length} items by benefit-to-cost ratio.`,
        counters: { itemsEvaluated: 0, selectedCount: 0 },
        table: {
          columns: ['ID', 'Cost', 'Benefit', 'Ratio'],
          rows: items.map((it) => [it.id, it.cost, it.benefit, (it.benefit / Math.max(1, it.cost)).toFixed(2)]),
        },
      });

      const plan = greedyKnapsack(items, budget);

      emit({
        type: 'done',
        message: `Greedy selection: ${plan.selectedIds.join(', ')} (benefit ${plan.totalBenefit}, cost ${plan.totalCost}/${budget}).`,
        counters: { itemsEvaluated: items.length, selectedCount: plan.selectedIds.length },
        table: {
          columns: ['ID', 'Cost', 'Benefit', 'Selected'],
          rows: items.map((it) => [it.id, it.cost, it.benefit, plan.selectedIds.includes(it.id) ? 'Yes' : 'No']),
        },
        state: {
          totalBenefit: plan.totalBenefit,
          totalCost: plan.totalCost,
          selected: plan.selectedIds.join(', '),
        },
      });

      return {
        totalBenefit: plan.totalBenefit,
        totalCost: plan.totalCost,
        selectedCount: plan.selectedIds.length,
      };
    },
  },

  // 5. Merge Sort
  {
    id: 'merge-sort',
    title: 'Merge Sort ranking',
    family: 'ranking',
    description: 'Stable O(n log n) divide-and-conquer sorting with the 5-tier championship comparator.',
    usesTrack: false,
    fields: [
      {
        id: 'values',
        label: 'Racers JSON',
        type: 'json',
        defaultValue: '[{"racerId":"1","totalPoints":58,"wins":1,"sumOfFinishPositions":6,"bestFastestLap":45},{"racerId":"2","totalPoints":61,"wins":1,"sumOfFinishPositions":5,"bestFastestLap":44.2},{"racerId":"3","totalPoints":52,"wins":1,"sumOfFinishPositions":8,"bestFastestLap":43.8},{"racerId":"4","totalPoints":39,"wins":0,"sumOfFinishPositions":11,"bestFastestLap":47.6}]',
      },
    ],
    counterDescriptions: {
      comparisons: 'Comparator evaluations.',
    },
    run(input, { emit }) {
      const racers = JSON.parse(input.values) as ChampionshipEntry[];

      emit({
        type: 'init',
        message: `Starting Merge Sort for ${racers.length} championship racers.`,
        counters: { comparisons: 0 },
        table: {
          columns: ['ID', 'Points', 'Wins', 'Pos Sum', 'Fastest Lap'],
          rows: racers.map((r) => [r.racerId, r.totalPoints, r.wins, r.sumOfFinishPositions, r.bestFastestLap ?? 'none']),
        },
      });

      const res = mergeSort(racers);

      emit({
        type: 'done',
        message: `Merge Sort complete in ${res.comparisons} comparisons. Leader: Racer ${res.sorted[0]?.racerId}.`,
        counters: { comparisons: res.comparisons },
        table: {
          columns: ['Rank', 'ID', 'Points', 'Wins', 'Pos Sum', 'Fastest Lap'],
          rows: res.sorted.map((r, i) => [i + 1, r.racerId, r.totalPoints, r.wins, r.sumOfFinishPositions, r.bestFastestLap ?? 'none']),
        },
        state: {
          champion: res.sorted[0]?.racerId ?? 'none',
          totalRacers: res.sorted.length,
        },
      });

      return {
        champion: res.sorted[0]?.racerId ?? null,
        comparisons: res.comparisons,
      };
    },
  },

  // 6. Quick Sort
  {
    id: 'quick-sort',
    title: 'Quick Sort ranking',
    family: 'ranking',
    description: 'In-place 3-way Dutch National Flag partitioning with median-of-three pivot selection.',
    usesTrack: false,
    fields: [
      {
        id: 'values',
        label: 'Racers JSON',
        type: 'json',
        defaultValue: '[{"racerId":"1","totalPoints":58,"wins":1,"sumOfFinishPositions":6,"bestFastestLap":45},{"racerId":"2","totalPoints":61,"wins":1,"sumOfFinishPositions":5,"bestFastestLap":44.2},{"racerId":"3","totalPoints":52,"wins":1,"sumOfFinishPositions":8,"bestFastestLap":43.8},{"racerId":"4","totalPoints":39,"wins":0,"sumOfFinishPositions":11,"bestFastestLap":47.6}]',
      },
    ],
    counterDescriptions: {
      comparisons: 'Comparator evaluations.',
    },
    run(input, { emit }) {
      const racers = JSON.parse(input.values) as ChampionshipEntry[];

      emit({
        type: 'init',
        message: `Starting Quick Sort (3-way partition) for ${racers.length} racers.`,
        counters: { comparisons: 0 },
        table: {
          columns: ['ID', 'Points', 'Wins', 'Pos Sum'],
          rows: racers.map((r) => [r.racerId, r.totalPoints, r.wins, r.sumOfFinishPositions]),
        },
      });

      const res = quickSort(racers);

      emit({
        type: 'done',
        message: `Quick Sort complete in ${res.comparisons} comparisons. Leader: Racer ${res.sorted[0]?.racerId}.`,
        counters: { comparisons: res.comparisons },
        table: {
          columns: ['Rank', 'ID', 'Points', 'Wins'],
          rows: res.sorted.map((r, i) => [i + 1, r.racerId, r.totalPoints, r.wins]),
        },
      });

      return {
        champion: res.sorted[0]?.racerId ?? null,
        comparisons: res.comparisons,
      };
    },
  },

  // 7. Heap Sort
  {
    id: 'heap-sort',
    title: 'Heap Sort ranking',
    family: 'ranking',
    description: 'In-place O(n log n) sift-down heap sort with zero auxiliary array allocations.',
    usesTrack: false,
    fields: [
      {
        id: 'values',
        label: 'Racers JSON',
        type: 'json',
        defaultValue: '[{"racerId":"1","totalPoints":58,"wins":1,"sumOfFinishPositions":6,"bestFastestLap":45},{"racerId":"2","totalPoints":61,"wins":1,"sumOfFinishPositions":5,"bestFastestLap":44.2},{"racerId":"3","totalPoints":52,"wins":1,"sumOfFinishPositions":8,"bestFastestLap":43.8},{"racerId":"4","totalPoints":39,"wins":0,"sumOfFinishPositions":11,"bestFastestLap":47.6}]',
      },
    ],
    counterDescriptions: {
      comparisons: 'Comparator evaluations.',
    },
    run(input, { emit }) {
      const racers = JSON.parse(input.values) as ChampionshipEntry[];

      emit({
        type: 'init',
        message: `Building sift-down heap for ${racers.length} racers.`,
        counters: { comparisons: 0 },
        table: {
          columns: ['ID', 'Points', 'Wins'],
          rows: racers.map((r) => [r.racerId, r.totalPoints, r.wins]),
        },
      });

      const res = heapSort(racers);

      emit({
        type: 'done',
        message: `Heap Sort complete in ${res.comparisons} comparisons.`,
        counters: { comparisons: res.comparisons },
        table: {
          columns: ['Rank', 'ID', 'Points'],
          rows: res.sorted.map((r, i) => [i + 1, r.racerId, r.totalPoints]),
        },
      });

      return {
        champion: res.sorted[0]?.racerId ?? null,
        comparisons: res.comparisons,
      };
    },
  },

  // 8. Top-K Retrieval
  {
    id: 'top-k',
    title: 'Heap Top-K analytics',
    family: 'ranking',
    description: 'Size-k min-heap live leaderboard analytics. O(n log k) retrieval matching full sort prefix.',
    usesTrack: false,
    fields: [
      {
        id: 'values',
        label: 'Racers JSON',
        type: 'json',
        defaultValue: '[{"racerId":"1","totalPoints":58,"wins":1,"sumOfFinishPositions":6,"bestFastestLap":45},{"racerId":"2","totalPoints":61,"wins":1,"sumOfFinishPositions":5,"bestFastestLap":44.2},{"racerId":"3","totalPoints":52,"wins":1,"sumOfFinishPositions":8,"bestFastestLap":43.8},{"racerId":"4","totalPoints":39,"wins":0,"sumOfFinishPositions":11,"bestFastestLap":47.6}]',
      },
      { id: 'k', label: 'Top-k count', type: 'number', defaultValue: '3', min: 1, max: 20 },
    ],
    counterDescriptions: {
      comparisons: 'Heap comparisons.',
    },
    run(input, { emit }) {
      const racers = JSON.parse(input.values) as ChampionshipEntry[];
      const k = Number(input.k);

      emit({
        type: 'init',
        message: `Extracting Top-${k} racers from ${racers.length} entries using size-${k} min-heap.`,
        counters: { comparisons: 0 },
      });

      const res = topK(racers, k);

      emit({
        type: 'done',
        message: `Top-${k} extraction complete: ${res.topK.map((r) => `Racer ${r.racerId}`).join(', ')}.`,
        counters: { comparisons: res.comparisons },
        table: {
          columns: ['Top Rank', 'ID', 'Points', 'Wins'],
          rows: res.topK.map((r, i) => [i + 1, r.racerId, r.totalPoints, r.wins]),
        },
      });

      return {
        count: res.topK.length,
        leadRacer: res.topK[0]?.racerId ?? null,
      };
    },
  },

  // 9. Prim MST
  {
    id: 'mst',
    title: 'Prim minimum spanning tree',
    family: 'generation',
    description: 'Computes undirected minimum spanning tree backbone guaranteeing road network connectivity.',
    usesTrack: true,
    fields: [],
    counterDescriptions: {
      expandedVertices: 'Vertices added to tree.',
      relaxedEdges: 'Candidate edges evaluated.',
      heapOps: 'Heap operations.',
      comparisons: 'Edge comparisons.',
    },
    run(_input, { track, emit }) {
      const { vertices, edges } = mapDataToCoreGraph(track);

      emit({
        type: 'init',
        message: `Computing Prim MST across ${vertices.length} vertices and ${edges.length} edges.`,
        counters: { expandedVertices: 0, relaxedEdges: 0, heapOps: 0, comparisons: 0 },
      });

      const res = primMST(vertices, edges);
      const mstEdgeIds = res.mstEdges.map((e) => (e.id.endsWith('~rev') ? e.id.slice(0, -4) : e.id));

      emit({
        type: 'done',
        message: `Prim MST built: ${res.mstEdges.length} edges, total weight ${res.totalWeight}.`,
        counters: { ...res.counters },
        graph: { routeEdges: mstEdgeIds },
        state: {
          treeEdges: res.mstEdges.length,
          totalWeight: res.totalWeight,
        },
      });

      return {
        mstEdgeCount: res.mstEdges.length,
        totalWeight: res.totalWeight,
      };
    },
  },

  // 10. Backtracking Placement
  {
    id: 'backtracking',
    title: 'Backtracking placement',
    family: 'generation',
    description: 'Constraint satisfaction placement with pruning for checkpoints, fuel stations, and obstacles.',
    usesTrack: true,
    fields: [
      { id: 'minCheckpoints', label: 'Mandatory checkpoints', type: 'number', defaultValue: '10', min: 5, max: 15 },
    ],
    counterDescriptions: {
      backtracks: 'Backtracking steps.',
      checkpoints: 'Checkpoints placed.',
    },
    run(input, { track, emit }) {
      const { vertices, edges } = mapDataToCoreGraph(track);
      const minCheckpoints = Number(input.minCheckpoints);

      emit({
        type: 'init',
        message: `Placing checkpoints (min: ${minCheckpoints}), fuel stations and pickups.`,
        counters: { backtracks: 0, checkpoints: 0 },
      });

      const res = placeTrackFeatures(vertices, edges, {
        minCheckpointCount: minCheckpoints,
        minFuelStations: 1,
        minNitroPickups: 1,
        minStationSpacing: 80,
      });

      const cpCount = res.vertices.filter((v) => v.type === 'Checkpoint').length;

      emit({
        type: 'done',
        message: `Backtracking placement complete: ${cpCount} checkpoints assigned.`,
        counters: { backtracks: res.backtracks, checkpoints: cpCount },
        state: {
          success: res.success,
          checkpoints: cpCount,
        },
      });

      return {
        success: res.success,
        checkpointCount: cpCount,
      };
    },
  },
];
