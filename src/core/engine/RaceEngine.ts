/**
 * RaceEngine — Alishba (Milestone 6).
 *
 * Full-featured live race execution engine.
 *  - Dynamic graph routing via Dijkstra, A*, and checkpoint legPlanner.
 *  - 3 deterministic opponent bots with distinct strategies (MainRoute, Shortcut, ShortestDistance).
 *  - EventProcessor integration for dynamic road blockages, oil spills, speed caps.
 *  - Fuel consumption with difficulty multipliers; pit-stop refuelling.
 *  - Nitro boost mechanics (1.5x speed, 2x fuel burn, 4s duration).
 *  - Strict checkpoint progression and lap validation.
 *  - Generates RaceResult records with official championship scoring.
 *
 * Rules (AGENTS.md): No UI imports; pure core logic; deterministic.
 */

import { TrackGraph } from '../graph/TrackGraph';
import { dijkstra } from '../algorithms/routing/dijkstra';
import { planRoute } from '../algorithms/routing/legPlanner';
import { EventProcessor } from '../events/EventProcessor';
import type { EventWorld, RaceEventInput } from '../events/EventProcessor';
import { MainRouteBot } from './opponents/MainRouteBot';
import { ShortcutBot } from './opponents/ShortcutBot';
import { ShortestDistanceBot } from './opponents/ShortestDistanceBot';
import type { Vertex, Edge, EdgeStatus, CostPreset, RaceResult, RouteResult } from '../types';
import {
  MAX_FUEL,
  INITIAL_NITRO,
  MAX_NITRO,
  NITRO_SPEED_MULTIPLIER,
  NITRO_DURATION_SECONDS,
  NITRO_FUEL_MULTIPLIER,
  REFUEL_STOP_SECONDS,
  MAX_STATION_PURCHASE,
  fuelMultiplier,
  pointsForPosition,
} from '../config';

export interface RacerConfig {
  id: number;
  name: string;
  isHuman: boolean;
  speed: number;
  strategy?: 'player' | 'main-route' | 'shortcut' | 'shortest-distance';
  preset?: CostPreset;
  fuel?: number;
}

export interface EngineSetup {
  trackName: string;
  vertices: readonly Vertex[];
  edges: readonly Edge[];
  startVertexId: number;
  laps?: number;
  initialNitro?: number;
  initialFuel?: number;
  racers?: readonly RacerConfig[];
  preset?: CostPreset;
  events?: readonly RaceEventInput[];
}

export interface EngineCarState {
  id: number;
  name: string;
  isHuman: boolean;
  position: number;
  status: 'racing' | 'finished' | 'dnf' | 'waiting';
  reason?: string;
  route: number[];
  routeIndex: number;
  edgeId: string;
  progress: number;
  reverse: boolean;
  speed: number;
  fuel: number;
  fuelCapacity: number;
  nitro: number;
  nitroCapacity: number;
  nitroUntil: number;
  completedLaps: number;
  checkpoint: number;
  distance: number;
  finishTime: number | null;
  stoppingUntil: number;
  braking: boolean;
  lapStartTime: number;
  fastestLap: number | null;
}

export interface EngineFeedMessage {
  id: string;
  time: number;
  message: string;
}

const FIXED_STEP = 1 / 120;

export class RaceEngine {
  readonly trackName: string;
  private readonly graph: TrackGraph;
  private readonly startId: number;
  private readonly totalLaps: number;
  private readonly initialNitro: number;
  private readonly initialFuel: number;
  private readonly checkpointIds: number[] = [];
  private readonly cars: EngineCarState[] = [];
  private processor!: EventProcessor;
  private readonly feed: EngineFeedMessage[] = [];
  private readonly botMap = new Map<number, MainRouteBot | ShortcutBot | ShortestDistanceBot>();
  /** Stores original event inputs so restart() can recreate the processor cleanly. */
  private readonly initialEvents: readonly RaceEventInput[];

  private phase: 'ready' | 'countdown' | 'running' | 'finished' = 'ready';
  private time: number = -3; // 3-second countdown
  private accumulator = 0;
  private sequence = 0;
  private results: RaceResult[] = [];

  constructor(setup: EngineSetup) {
    this.trackName = setup.trackName;
    this.totalLaps = setup.laps ?? 2;
    this.startId = setup.startVertexId;
    this.initialNitro = setup.initialNitro ?? INITIAL_NITRO;
    this.initialFuel = setup.initialFuel ?? MAX_FUEL;
    this.initialEvents = setup.events ? [...setup.events] : [];

    // 1. Build TrackGraph
    this.graph = new TrackGraph(setup.vertices, setup.edges);

    // 2. Identify and validate mandatory checkpoints
    const checkpoints = setup.vertices
      .filter((v) => v.type === 'Checkpoint')
      .sort((a, b) => (a.checkpointOrder ?? 0) - (b.checkpointOrder ?? 0));
    this.checkpointIds = checkpoints.map((c) => c.id);

    // 3. Connect EventProcessor via EventWorld
    this._initProcessor();

    // 4. Set up racers with distinct strategies
    const racers = setup.racers ?? [
      { id: 1, name: 'Player', isHuman: true, speed: 85, preset: setup.preset ?? 'Balanced' },
      { id: 2, name: 'Main Apex', isHuman: false, speed: 88, strategy: 'main-route' },
      { id: 3, name: 'Shortcut Phantom', isHuman: false, speed: 83, strategy: 'shortcut' },
      { id: 4, name: 'Metric Shadow', isHuman: false, speed: 86, strategy: 'shortest-distance' },
    ];

    racers.forEach((def, index) => {
      const fullPath: number[] = [this.startId];

      if (!def.isHuman) {
        const strat = def.strategy ?? 'main-route';
        if (strat === 'shortcut') {
          this.botMap.set(def.id, new ShortcutBot(`bot-${def.id}`, def.name));
          const legs = planRoute(this.graph, this.startId, this.checkpointIds, this.startId, 'Speed');
          for (const leg of legs) {
            if (leg && leg.path.length > 1) fullPath.push(...leg.path.slice(1));
          }
        } else if (strat === 'shortest-distance') {
          this.botMap.set(def.id, new ShortestDistanceBot(`bot-${def.id}`, def.name));
          const distWeights = { distance: 1.0, time: 0, fuel: 0, difficulty: 0, obstacle: 0 };
          let cur = this.startId;
          for (const wp of [...this.checkpointIds, this.startId]) {
            const leg = dijkstra(this.graph, cur, wp, distWeights);
            if (leg && leg.path.length > 1) {
              fullPath.push(...leg.path.slice(1));
              cur = wp;
            }
          }
        } else {
          // Main route bot gets and stores the pre-computed balanced main route
          const legs = planRoute(this.graph, this.startId, this.checkpointIds, this.startId, 'Balanced');
          for (const leg of legs) {
            if (leg && leg.path.length > 1) fullPath.push(...leg.path.slice(1));
          }
          this.botMap.set(def.id, new MainRouteBot(`bot-${def.id}`, def.name, fullPath));
        }
      } else {
        const preset: CostPreset = def.preset ?? 'Balanced';
        const legs = planRoute(this.graph, this.startId, this.checkpointIds, this.startId, preset);
        for (const leg of legs) {
          if (leg && leg.path.length > 1) fullPath.push(...leg.path.slice(1));
        }
      }

      // Find initial edge
      const edge = this._findEdgeBetween(fullPath[fullPath.length - 2] ?? this.startId, this.startId);
      const gridOffset = Math.min((edge ? edge.distance * 0.8 : 20), index * 18);

      this.cars.push({
        id: def.id,
        name: def.name,
        isHuman: def.isHuman,
        position: index + 1,
        status: 'racing',
        route: fullPath,
        routeIndex: -1,
        edgeId: edge ? edge.id : '',
        progress: edge ? 1 - gridOffset / edge.distance : 0,
        reverse: edge ? edge.to === (fullPath[fullPath.length - 2] ?? this.startId) : false,
        speed: 0,
        fuel: def.fuel ?? this.initialFuel,
        fuelCapacity: this.initialFuel,
        nitro: def.isHuman ? this.initialNitro : INITIAL_NITRO,
        nitroCapacity: MAX_NITRO,
        nitroUntil: -1,
        completedLaps: 0,
        checkpoint: 0,
        distance: -gridOffset,
        finishTime: null,
        stoppingUntil: 0,
        braking: false,
        lapStartTime: 0,
        fastestLap: null,
      });
    });
  }

  private _initProcessor(): void {
    const world: EventWorld = {
      getEdge: (id) => {
        const edge = this.graph.getEdge(id);
        if (!edge) return undefined;
        return {
          status: edge.status,
          difficulty: edge.difficulty,
          speedCap: edge.speedCap,
          isShortcut: edge.isShortcut,
        };
      },
      getVertex: (id) => {
        const vertex = this.graph.getVertex(id);
        if (!vertex) return undefined;
        const type = vertex.type === 'FuelStation' || vertex.type === 'NitroPickup' ? vertex.type : 'Other';
        return { type, active: vertex.active };
      },
      setEdgeState: (id, state) => {
        const edge = this.graph.getEdge(id);
        if (edge) {
          const mutableEdge = edge as {
            status: EdgeStatus;
            difficulty: number;
            speedCap?: number;
          };
          mutableEdge.status = state.status;
          mutableEdge.difficulty = state.difficulty;
          if (state.speedCap !== undefined) {
            mutableEdge.speedCap = state.speedCap;
          } else {
            delete mutableEdge.speedCap;
          }

          const revEdge = this.graph.getEdge(`${id}~rev`);
          if (revEdge) {
            const mutableRev = revEdge as {
              status: EdgeStatus;
              difficulty: number;
              speedCap?: number;
            };
            mutableRev.status = state.status;
            mutableRev.difficulty = state.difficulty;
            if (state.speedCap !== undefined) {
              mutableRev.speedCap = state.speedCap;
            } else {
              delete mutableRev.speedCap;
            }
          }
        }
      },
      setVertexActive: (id, active) => {
        this.graph.setStationActive(id, active);
      },
    };

    this.processor = new EventProcessor(world);
    for (const ev of this.initialEvents) {
      this.processor.schedule(ev);
    }
  }

  // -------------------------------------------------------------------------
  // Control methods
  // -------------------------------------------------------------------------

  start(): void {
    if (this.phase === 'ready') {
      this.phase = this.time < 0 ? 'countdown' : 'running';
    }
  }

  restart(): void {
    // Reset to ready phase
    this.phase = 'ready';
    this.time = -3;
    this.accumulator = 0;
    this.feed.length = 0;
    this.results = [];

    // Recreate processor cleanly so internal clock starts at 0 without monotonic time error
    this._initProcessor();

    for (const car of this.cars) {
      car.status = 'racing';
      car.reason = undefined;
      car.routeIndex = -1;
      car.progress = 0;
      car.speed = 0;
      car.fuel = this.initialFuel;
      car.nitro = car.isHuman ? this.initialNitro : INITIAL_NITRO;
      car.nitroUntil = -1;
      car.completedLaps = 0;
      car.checkpoint = 0;
      car.finishTime = null;
      car.stoppingUntil = 0;
      car.braking = false;
      car.lapStartTime = 0;
      car.fastestLap = null;
    }
  }

  activateNitro(racerId?: number): boolean {
    const car = racerId !== undefined ? this.cars.find((c) => c.id === racerId) : this.cars.find((c) => c.isHuman);
    if (!car || this.phase !== 'running' || car.status !== 'racing') return false;
    if (car.nitro <= 0 || car.nitroUntil > this.time) return false;

    car.nitro--;
    car.nitroUntil = this.time + NITRO_DURATION_SECONDS;
    this._log(`${car.name}: Nitro engaged!`);
    return true;
  }

  /**
   * Dynamically block an edge during race execution, forcing cars to detour.
   */
  blockEdge(edgeId: string): void {
    this.graph.blockEdge(edgeId);
    this._log(`Race Control: Road ${edgeId} has been closed.`);
  }

  /**
   * Reopen a previously blocked edge.
   */
  unblockEdge(edgeId: string): void {
    this.graph.unblockEdge(edgeId);
    this._log(`Race Control: Road ${edgeId} has been reopened.`);
  }

  /**
   * Schedule a dynamic race event (hazard, road closure, safety car, etc.).
   */
  scheduleEvent(event: RaceEventInput): void {
    this.processor.schedule(event);
  }

  step(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    if (this.phase === 'ready' || this.phase === 'finished') return;

    this.accumulator += seconds;

    while (this.accumulator + 1e-10 >= FIXED_STEP && this.phase !== 'finished') {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);

      // Countdown phase
      if (this.time < 0) {
        this.time = Math.min(0, this.time + FIXED_STEP);
        if (this.time > -1e-9) {
          this.time = 0;
          this.phase = 'running';
          this._log('Lights out! Race underway!');
          this._applyEvents();
        }
        continue;
      }

      // Running phase: advance physics
      let remaining = FIXED_STEP;
      while (remaining > 1e-9) {
        this._applyEvents();
        const nextEvTime = this.processor.nextTime;
        const dt = Math.min(remaining, nextEvTime === undefined ? remaining : Math.max(0, nextEvTime - this.time));
        if (dt <= 1e-9) {
          this.time = nextEvTime!;
          this._applyEvents();
          continue;
        }

        for (const car of this.cars) {
          this._advanceCar(car, dt);
        }

        this.time += dt;
        remaining -= dt;
        this._applyEvents();
      }

      // Check race completion
      if (this.cars.every((c) => c.status === 'finished' || c.status === 'dnf')) {
        this.phase = 'finished';
        this._finalizeResults();
        this._log('Race completed! All positions finalized.');
      }
    }
  }

  // -------------------------------------------------------------------------
  // State accessor
  // -------------------------------------------------------------------------

  getState() {
    // Calculate running positions
    const sorted = [...this.cars];
    for (const car of sorted) {
      car.position = 1 + sorted.filter((other) => this._isAhead(other, car)).length;
    }

    return {
      phase: this.phase,
      clock: Math.max(0, this.time),
      countdown: this.phase === 'countdown' ? Math.max(1, Math.ceil(-this.time - 1e-8)) : null,
      totalLaps: this.totalLaps,
      checkpointCount: this.checkpointIds.length,
      cars: this.cars.map((c) => ({ ...c })),
      events: this.feed.map((f) => ({ ...f })),
      routeEdges: this._collectRouteEdges(),
    };
  }

  getResults(): readonly RaceResult[] {
    return this.results;
  }

  // -------------------------------------------------------------------------
  // Private simulation logic
  // -------------------------------------------------------------------------

  private _advanceCar(car: EngineCarState, dt: number): void {
    if (car.status === 'finished' || car.status === 'dnf') return;

    // Pit stop refuelling delay
    if (car.stoppingUntil > this.time) {
      car.speed = 0;
      return;
    }

    const edge = this.graph.getEdge(car.edgeId);
    if (!edge) return;

    // Road blockage check
    if (car.progress === 0 && edge.status === 'Blocked') {
      // Re-route dynamically around the blocked edge
      this._recalculateCarRoute(car);
      const newEdge = this.graph.getEdge(car.edgeId);
      if (!newEdge || newEdge.status === 'Blocked') {
        car.status = 'waiting';
        car.reason = 'Waiting for blocked road to reopen.';
        car.speed = 0;
        return;
      }
    }

    car.status = 'racing';
    car.reason = undefined;

    const boosted = car.nitroUntil > this.time;
    const speedMult = boosted ? NITRO_SPEED_MULTIPLIER : 1.0;
    const baseSpeed = 85 * speedMult;
    let targetSpeed = baseSpeed / (1 + 0.08 * (edge.difficulty - 1));

    if (edge.speedCap !== undefined) {
      targetSpeed = Math.min(targetSpeed, edge.speedCap);
    }

    // Cornering deceleration
    const distRemaining = edge.distance * (1 - car.progress);
    targetSpeed = Math.min(targetSpeed, Math.sqrt(20 * 20 + 2 * 45 * distRemaining));
    car.braking = car.speed > targetSpeed + 1;

    // Speed update
    const accel = 14 * speedMult;
    car.speed = Math.max(0, car.speed + Math.max(-45 * dt, Math.min(accel * dt, targetSpeed - car.speed)));

    const travel = Math.min(distRemaining, car.speed * dt);

    // Fuel consumption formula (Project.pdf §4.3)
    const fuelBurnMult = boosted ? NITRO_FUEL_MULTIPLIER : 1.0;
    const fuelRate = (edge.fuelCost / Math.max(1, edge.distance)) * fuelMultiplier(edge.difficulty) * fuelBurnMult;
    const fuelNeeded = travel * fuelRate;

    // Pre-edge fuel guard: if the car cannot complete this entire edge, attempt to
    // reroute via a fuel station (proactive — avoids mid-edge DNF on high-difficulty tracks).
    // Only reroute if the car has enough fuel to actually reach a station.
    const fullEdgeFuel = (edge.fuelCost / Math.max(1, edge.distance)) * fuelMultiplier(edge.difficulty) * edge.distance;
    if (car.progress < 1e-9 && fullEdgeFuel > car.fuel + 1e-9) {
      const prevEdgeId = car.edgeId;
      this._recalculateCarRoute(car);
      if (car.edgeId !== prevEdgeId) {
        // _recalculateCarRoute found a station route and updated car.edgeId — skip this tick
        return;
      }
      // No reachable station — fall through to DNF below
    }

    if (fuelNeeded > car.fuel + 1e-9) {
      this._dnf(car, 'Fuel exhausted.');
      return;
    }

    car.fuel = Math.max(0, car.fuel - fuelNeeded);
    car.progress = Math.min(1, car.progress + travel / edge.distance);
    car.distance += travel;

    if (car.progress < 1 - 1e-9) return;

    // Reached end of current edge
    const arrivedVertexId = car.reverse ? edge.from : edge.to;

    // Checkpoint progress
    if (arrivedVertexId === this.checkpointIds[car.checkpoint]) {
      car.checkpoint++;
      this._log(`${car.name}: Checkpoint ${car.checkpoint} reached.`);
    }

    // Lap / Finish progress
    if (arrivedVertexId === this.startId && car.routeIndex >= car.route.length - 2) {
      if (car.checkpoint !== this.checkpointIds.length) {
        this._dnf(car, 'Mandatory checkpoints incomplete.');
        return;
      }

      car.completedLaps++;
      const lapDuration = this.time - car.lapStartTime;
      car.lapStartTime = this.time;

      if (car.fastestLap === null || lapDuration < car.fastestLap) {
        car.fastestLap = lapDuration;
      }

      this._log(`${car.name}: Lap ${car.completedLaps} finished in ${lapDuration.toFixed(2)}s.`);

      if (car.completedLaps >= this.totalLaps) {
        car.status = 'finished';
        car.speed = 0;
        car.finishTime = this.time;
        this._log(`${car.name} crossed the FINISH line! Time: ${this.time.toFixed(2)}s.`);
        return;
      }

      // Start new lap — recalculate full route from current position
      car.checkpoint = 0;
      car.routeIndex = -1;
      this._recalculateCarRoute(car);
    }

    // Vertex services: Fuel Station & Nitro Pickup
    const vertex = this.graph.getVertex(arrivedVertexId);
    if (vertex && vertex.active) {
      if (vertex.type === 'FuelStation' && car.fuel < MAX_FUEL * 0.90) {
        const refuelAmount = Math.min(MAX_FUEL - car.fuel, MAX_STATION_PURCHASE);
        car.fuel = Math.min(MAX_FUEL, car.fuel + refuelAmount);
        car.stoppingUntil = this.time + dt + REFUEL_STOP_SECONDS;
        car.status = 'waiting';
        car.reason = 'Pit stop refuelling.';
        car.speed = 0;
        this._log(`${car.name}: Pit stop refuelling (+${MAX_STATION_PURCHASE} fuel).`);
        this._recalculateCarRoute(car);
      }
      if (vertex.type === 'NitroPickup' && car.nitro < MAX_NITRO) {
        if (this.processor.collectNitro(arrivedVertexId)) {
          car.nitro++;
          this._log(`${car.name}: Nitro charge collected!`);
        }
      }
    }

    // Emergency refuel detour check when fuel critically low (< 50%)
    const isHeadingToStation = car.route.slice(Math.max(0, car.routeIndex)).some((v) => this.graph.getVertex(v)?.type === 'FuelStation');
    if (car.fuel <= MAX_FUEL * 0.50 && !isHeadingToStation && vertex?.type !== 'FuelStation') {
      this._recalculateCarRoute(car);
    } else {
      // Advance to next edge in planned route
      car.routeIndex++;
      if (car.routeIndex >= car.route.length - 1) {
        this._recalculateCarRoute(car);
      }
    }

    const nextFrom = car.route[car.routeIndex];
    const nextTo = car.route[car.routeIndex + 1];
    const nextEdge = this._findEdgeBetween(nextFrom, nextTo);

    if (nextEdge) {
      car.edgeId = nextEdge.id;
      car.reverse = nextEdge.to === nextFrom;
      car.progress = 0;
    }
  }

  private _recalculateCarRoute(car: EngineCarState): void {
    // Bug fix: when reverse===false the car travels from→to, so the car is AT edge.to upon arrival.
    // When reverse===true the car travels to→from, so the car is AT edge.from upon arrival.
    const edge = this.graph.getEdge(car.edgeId);
    const curVertex = edge
      ? (car.reverse ? edge.from : edge.to)
      : this.startId;

    const remainingCheckpoints = this.checkpointIds.slice(car.checkpoint);
    const bot = this.botMap.get(car.id);

    let nextLeg: RouteResult | null = null;

    // ----------------------------------------------------------------
    // Proactive fuel station detour: triggered whenever the car cannot
    // safely reach the next checkpoint + return to a station without
    // running dry.  Threshold = 50% of tank so there is margin.
    // ----------------------------------------------------------------
    const PROACTIVE_THRESHOLD = MAX_FUEL * 0.50;
    const nextTarget = remainingCheckpoints[0] ?? this.startId;
    const legToNext = dijkstra(this.graph, curVertex, nextTarget, 'Economy');
    const fuelToNext = legToNext?.fuelNeeded ?? Infinity;

    const needsRefuel = car.fuel < PROACTIVE_THRESHOLD || car.fuel < fuelToNext + 2;

    if (needsRefuel && curVertex !== this.startId) {
      // Find nearest active fuel station reachable with current fuel
      let nearestStation: number | null = null;
      let minStationFuel = Infinity;
      for (const v of this.graph.getVertices()) {
        if (v.type === 'FuelStation' && v.active && v.id !== curVertex) {
          const leg = dijkstra(this.graph, curVertex, v.id, 'Economy');
          if (leg && leg.fuelNeeded < car.fuel && leg.fuelNeeded < minStationFuel) {
            minStationFuel = leg.fuelNeeded;
            nearestStation = v.id;
          }
        }
      }
      if (nearestStation !== null) {
        nextLeg = dijkstra(this.graph, curVertex, nearestStation, 'Economy');
      }
    }

    if (!nextLeg) {
      if (bot) {
        nextLeg = bot.planNextLeg(this.graph, curVertex, remainingCheckpoints, this.startId, car.fuel);
      } else {
        nextLeg = dijkstra(this.graph, curVertex, nextTarget, 'Balanced');
      }
    }

    if (nextLeg && nextLeg.path.length > 1) {
      car.route = nextLeg.path;
      car.routeIndex = 0;
    }
  }

  private _applyEvents(): void {
    const batches = this.processor.advanceTo(this.time);
    for (const batch of batches) {
      for (const ev of batch.events) {
        this._log(`Event ${ev.eventId}: ${ev.outcome}`);
      }
      // Dynamic cost changes: road blockage, speed restriction, or oil spill triggers rerouting
      if (batch.changedEdges.length > 0) {
        for (const car of this.cars) {
          if (car.status === 'racing') {
            const upcoming = car.route.slice(Math.max(0, car.routeIndex));
            let affected = false;
            for (let i = 0; i < upcoming.length - 1; i++) {
              const e = this._findEdgeBetween(upcoming[i], upcoming[i + 1]);
              if (e && batch.changedEdges.includes(e.id)) {
                affected = true;
                break;
              }
            }
            if (affected) {
              this._recalculateCarRoute(car);
            }
          }
        }
      }
    }
  }

  private _dnf(car: EngineCarState, reason: string): void {
    car.status = 'dnf';
    car.reason = reason;
    car.speed = 0;
    this._log(`${car.name}: DNF (${reason})`);
  }

  private _isAhead(a: EngineCarState, b: EngineCarState): boolean {
    if (a.id === b.id) return false;
    if (a.status === 'finished' || b.status === 'finished') {
      if (a.status !== 'finished') return false;
      if (b.status !== 'finished') return true;
      return a.finishTime! < b.finishTime!;
    }
    if (a.completedLaps !== b.completedLaps) return a.completedLaps > b.completedLaps;
    if (a.checkpoint !== b.checkpoint) return a.checkpoint > b.checkpoint;
    return a.distance > b.distance;
  }

  private _finalizeResults(): void {
    const sorted = [...this.cars].sort((a, b) => {
      if (this._isAhead(a, b)) return -1;
      if (this._isAhead(b, a)) return 1;
      return a.id - b.id;
    });

    this.results = sorted.map((car, index) => {
      const position = index + 1;
      return {
        raceId: `race-${this.trackName.toLowerCase().replace(/\s+/g, '-')}`,
        racerId: String(car.id),
        finishPosition: position,
        finishTime: car.finishTime,
        fastestLap: car.fastestLap,
        bonusPoints: 0,
        pointsAwarded: car.status === 'dnf' ? 0 : pointsForPosition(position),
        dnfReason: car.reason,
      };
    });
  }

  private _findEdgeBetween(from: number, to: number): Edge | undefined {
    return this.graph.getEdges().find(
      (e) => (e.from === from && e.to === to) || (!e.directed && e.from === to && e.to === from),
    );
  }

  private _collectRouteEdges(): string[] {
    const humanCar = this.cars.find((c) => c.isHuman);
    if (!humanCar || !humanCar.route) return [];
    const edgeIds: string[] = [];
    for (let i = 0; i < humanCar.route.length - 1; i++) {
      const e = this._findEdgeBetween(humanCar.route[i], humanCar.route[i + 1]);
      if (e) edgeIds.push(e.id);
    }
    return edgeIds;
  }

  private _log(message: string): void {
    this.feed.push({ id: `msg-${this.sequence++}`, time: Math.max(0, this.time), message });
    if (this.feed.length > 100) this.feed.shift();
  }
}
