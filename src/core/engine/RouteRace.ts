import { EventProcessor } from '../events/EventProcessor';
import type { EventWorld, RaceEventInput } from '../events/EventProcessor';

/** Standalone route-driving contract. Shared game types/config remain unfrozen. */
export interface DrivingVertex {
  id: number; x: number; y: number;
  type: 'Start' | 'Checkpoint' | 'FuelStation' | 'NitroPickup' | 'Other';
  checkpointOrder?: number;
  active: boolean;
}
export interface DrivingEdge {
  id: string; from: number; to: number; distance: number; fuelCost: number;
  difficulty: number; status: 'Open' | 'Blocked' | 'Restricted';
  directed: boolean; isShortcut: boolean; speedCap?: number;
}
export interface DrivingSetup {
  vertices: readonly DrivingVertex[];
  edges: readonly DrivingEdge[];
  start: number;
  racers: readonly { id: number; name: string; isHuman: boolean; speed: number; route: readonly number[] }[];
  config: {
    laps: number; fuelCapacity: number; initialNitro: number; nitroCapacity: number;
    nitroSeconds: number; nitroMultiplier: number; nitroFuelMultiplier: number;
    acceleration: number; braking: number; countdown: number; timeLimit: number;
    refuelAmount: number; refuelStopSeconds: number;
  };
  events: readonly RaceEventInput[];
}
export interface DrivingCar {
  id: number; name: string; isHuman: boolean; status: 'racing' | 'finished' | 'dnf' | 'waiting';
  reason?: string; routeIndex: number; edgeId: string; progress: number; reverse: boolean;
  speed: number; fuel: number; nitro: number; nitroUntil: number;
  completedLaps: number; checkpoint: number; distance: number; finishTime: number | null;
  stoppingUntil: number; braking: boolean;
}
interface Participant { car: DrivingCar; definition: DrivingSetup['racers'][number] }

const FIXED_STEP = 1 / 120;

/** Deterministic supplied-route driving. No shortest-path, resource planner,
 * championship scoring or ranking algorithm is implemented here.
 */
export class RouteRace {
  private readonly vertices: Map<number, DrivingVertex>;
  private readonly edges: Map<string, DrivingEdge>;
  private readonly participants: Participant[];
  private readonly processor: EventProcessor;
  private readonly checkpointIds: number[];
  private readonly feed: { id: string; time: number; message: string }[] = [];
  private sequence = 0;
  private accumulator = 0;
  private time: number;
  private phase: 'ready' | 'countdown' | 'running' | 'finished' = 'ready';
  private readonly setup: DrivingSetup;

  constructor(setup: DrivingSetup) {
    this.setup = { ...setup, config: { ...setup.config }, vertices: setup.vertices.map((vertex) => ({ ...vertex })), edges: setup.edges.map((edge) => ({ ...edge })), racers: setup.racers.map((racer) => ({ ...racer, route: [...racer.route] })), events: setup.events.map((event) => ({ ...event, effect: { ...event.effect } })) };
    this.validateSetup();
    this.vertices = new Map(setup.vertices.map((vertex) => [vertex.id, { ...vertex }]));
    this.edges = new Map(setup.edges.map((edge) => [edge.id, { ...edge }]));
    // Checkpoint orders must be contiguous; indexed placement is not a sort.
    this.checkpointIds = [];
    for (const vertex of setup.vertices) if (vertex.type === 'Checkpoint') this.checkpointIds[vertex.checkpointOrder! - 1] = vertex.id;
    if (!this.vertices.has(setup.start) || this.vertices.get(setup.start)!.type !== 'Start') throw new Error('Invalid start vertex.');
    const orders = new Set(setup.vertices.filter((vertex) => vertex.type === 'Checkpoint').map((vertex) => vertex.checkpointOrder));
    if (orders.size !== setup.vertices.filter((vertex) => vertex.type === 'Checkpoint').length || orders.size !== this.checkpointIds.length || this.checkpointIds.some((id) => id === undefined)) throw new Error('Checkpoint order must be contiguous and unique.');
    this.participants = setup.racers.map((definition, gridIndex) => {
      const route = definition.route;
      if (route[0] !== setup.start || route.at(-1) !== setup.start || route.length < 2) throw new Error('Each route must be a closed start-to-start lap.');
      let checkpoint = 0;
      for (let index = 0; index < route.length - 1; index++) {
        this.edgeBetween(route[index], route[index + 1]);
        if (route[index + 1] === this.checkpointIds[checkpoint]) checkpoint++;
      }
      if (checkpoint !== this.checkpointIds.length) throw new Error('Route does not preserve mandatory checkpoint order.');
      const edge = this.edgeBetween(route[route.length - 2], route[route.length - 1]);
      const gridDistance = Math.min(edge.distance * 0.85, gridIndex * 22);
      return { definition: { ...definition, route: [...route] }, car: {
        id: definition.id, name: definition.name, isHuman: definition.isHuman, status: 'racing', routeIndex: -1,
        edgeId: edge.id, progress: 1 - gridDistance / edge.distance, reverse: edge.to === route[route.length - 2], speed: 0,
        fuel: setup.config.fuelCapacity, nitro: setup.config.initialNitro, nitroUntil: -1,
        completedLaps: 0, checkpoint: 0, distance: -gridDistance, finishTime: null, stoppingUntil: 0, braking: false,
      } };
    });
    const world: EventWorld = {
      getEdge: (id) => this.edges.get(id),
      getVertex: (id) => { const vertex = this.vertices.get(id); return vertex ? { type: vertex.type === 'FuelStation' || vertex.type === 'NitroPickup' ? vertex.type : 'Other', active: vertex.active } : undefined; },
      setEdgeState: (id, state) => Object.assign(this.edges.get(id)!, state),
      setVertexActive: (id, active) => { this.vertices.get(id)!.active = active; },
    };
    this.processor = new EventProcessor(world);
    setup.events.forEach((event) => this.processor.schedule(event));
    this.time = -setup.config.countdown;
  }

  start(): void { if (this.phase === 'ready') this.phase = this.time < 0 ? 'countdown' : 'running'; }
  activateNitro(): boolean {
    const car = this.participants.find((entry) => entry.car.isHuman)?.car;
    if (this.phase !== 'running' || !car || car.status !== 'racing' || car.nitro <= 0 || car.nitroUntil > this.time) return false;
    car.nitro--;
    car.nitroUntil = this.time + this.setup.config.nitroSeconds;
    this.log(`${car.name}: nitro engaged.`);
    return true;
  }

  step(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid driving delta.');
    if (this.phase === 'ready' || this.phase === 'finished') return;
    this.accumulator += seconds;
    while (this.accumulator + 1e-10 >= FIXED_STEP && this.phase !== 'finished') {
      this.accumulator = Math.max(0, this.accumulator - FIXED_STEP);
      if (this.time < 0) {
        this.time = Math.min(0, this.time + FIXED_STEP);
        if (this.time > -1e-9) { this.time = 0; this.phase = 'running'; this.log('Lights out. Race underway.'); this.applyEvents(); }
        continue;
      }
      let remaining = FIXED_STEP;
      while (remaining > 1e-9) {
        this.applyEvents();
        const nextEvent = this.processor.nextTime;
        const duration = Math.min(remaining, nextEvent === undefined ? remaining : Math.max(0, nextEvent - this.time));
        if (duration <= 1e-9) { this.time = nextEvent!; this.applyEvents(); continue; }
        for (const participant of this.participants) this.advanceCar(participant, duration);
        this.time += duration;
        remaining -= duration;
        this.applyEvents();
      }
      if (this.time >= this.setup.config.timeLimit) {
        for (const { car } of this.participants) if (car.status !== 'finished' && car.status !== 'dnf') this.dnf(car, 'Race time limit reached.');
      }
      if (this.participants.every(({ car }) => car.status === 'finished' || car.status === 'dnf')) { this.phase = 'finished'; this.log('All racers resolved. Session complete.'); }
    }
  }

  getState() {
    const cars = this.participants.map(({ car }) => ({ ...car, position: 1 }));
    // Running position by supplied-route progress; no championship sorting.
    for (const car of cars) car.position = 1 + cars.filter((other) => this.ahead(other, car)).length;
    return {
      phase: this.phase, clock: Math.max(0, this.time), countdown: this.phase === 'countdown' ? Math.max(1, Math.ceil(-this.time - 1e-8)) : null,
      cars, edges: [...this.edges.values()].map((edge) => ({ ...edge })), vertices: [...this.vertices.values()].map((vertex) => ({ ...vertex })),
      events: this.feed.map((event) => ({ ...event })),
    };
  }

  private validateSetup(): void {
    const { config } = this.setup;
    for (const value of Object.values(config)) if (!Number.isFinite(value) || value < 0) throw new Error('Invalid driving configuration.');
    if (!Number.isInteger(config.laps) || config.laps < 1 || config.fuelCapacity <= 0 || config.timeLimit <= 0 || config.acceleration <= 0 || config.braking <= 0) throw new Error('Invalid race limits.');
    if (!Number.isInteger(config.nitroCapacity) || !Number.isInteger(config.initialNitro) || config.initialNitro > config.nitroCapacity || config.nitroMultiplier < 1 || config.nitroFuelMultiplier < 1) throw new Error('Invalid nitro configuration.');
    if (!this.setup.racers.length || new Set(this.setup.racers.map((racer) => racer.id)).size !== this.setup.racers.length || this.setup.racers.some((racer) => !Number.isFinite(racer.speed) || racer.speed <= 0)) throw new Error('Invalid racers.');
    if (new Set(this.setup.vertices.map((vertex) => vertex.id)).size !== this.setup.vertices.length || new Set(this.setup.edges.map((edge) => edge.id)).size !== this.setup.edges.length) throw new Error('Duplicate graph IDs.');
    const points = new Map(this.setup.vertices.map((vertex) => [vertex.id, vertex]));
    for (const vertex of points.values()) if (!Number.isSafeInteger(vertex.id) || !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y)) throw new Error('Invalid vertex coordinates.');
    for (const edge of this.setup.edges) {
      const from = points.get(edge.from); const to = points.get(edge.to);
      if (!from || !to || from.x === to.x && from.y === to.y) throw new Error('Invalid road endpoints.');
      if (edge.speedCap !== undefined && (!Number.isFinite(edge.speedCap) || edge.speedCap <= 0)) throw new Error('Invalid speed cap.');
    }
    for (const edge of this.setup.edges) if (![edge.distance, edge.fuelCost, edge.difficulty].every(Number.isFinite) || edge.distance <= 0 || edge.fuelCost < 0 || edge.difficulty < 1 || edge.difficulty > 5 || !Number.isInteger(edge.difficulty)) throw new Error('Invalid road attributes.');
    const checkpoints = this.setup.vertices.filter((vertex) => vertex.type === 'Checkpoint');
    if (checkpoints.some((vertex) => !Number.isSafeInteger(vertex.checkpointOrder) || vertex.checkpointOrder! <= 0)) throw new Error('Invalid checkpoint order.');
  }

  private edgeBetween(from: number, to: number): DrivingEdge {
    const edge = [...this.edges.values()].find((entry) => entry.from === from && entry.to === to || !entry.directed && entry.to === from && entry.from === to);
    if (!edge || !this.vertices.has(from) || !this.vertices.has(to)) throw new Error(`No legal road from ${from} to ${to}.`);
    return edge;
  }

  private advanceCar({ car, definition }: Participant, dt: number): void {
    if (car.status === 'finished' || car.status === 'dnf') return;
    if (car.stoppingUntil > this.time) { car.speed = 0; return; }
    const edge = this.edges.get(car.edgeId)!;
    if (car.progress === 0 && edge.status === 'Blocked') { car.status = 'waiting'; car.reason = 'Waiting for the road to reopen.'; car.speed = 0; return; }
    const remainingFuel = edge.fuelCost * (1 + 0.1 * (edge.difficulty - 1));
    if (car.progress === 0 && car.fuel + 1e-9 < remainingFuel) { this.dnf(car, 'Insufficient fuel for the next road.'); return; }
    car.status = 'racing'; car.reason = undefined;
    const boosted = car.nitroUntil > this.time;
    let target = definition.speed * (boosted ? this.setup.config.nitroMultiplier : 1) / (1 + 0.08 * (edge.difficulty - 1));
    if (edge.speedCap !== undefined) target = Math.min(target, edge.speedCap);
    const route = definition.route;
    const from = this.vertices.get(car.routeIndex < 0 ? route[route.length - 2] : route[car.routeIndex])!;
    const at = this.vertices.get(route[car.routeIndex + 1])!;
    const next = this.vertices.get(route[(car.routeIndex + 2) % (route.length - 1)])!;
    const angle = Math.acos(Math.max(-1, Math.min(1, ((at.x - from.x) * (next.x - at.x) + (at.y - from.y) * (next.y - at.y)) / (Math.hypot(at.x - from.x, at.y - from.y) * Math.hypot(next.x - at.x, next.y - at.y)))));
    const cornerSpeed = definition.speed * Math.max(0.3, 1 - angle / Math.PI * 0.8);
    const distanceLeft = edge.distance * (1 - car.progress);
    target = Math.min(target, Math.sqrt(cornerSpeed * cornerSpeed + 2 * this.setup.config.braking * distanceLeft));
    car.braking = car.speed > target + 1;
    const acceleration = this.setup.config.acceleration * (boosted ? this.setup.config.nitroMultiplier : 1);
    car.speed = Math.max(0, car.speed + Math.max(-this.setup.config.braking * dt, Math.min(acceleration * dt, target - car.speed)));
    const travel = Math.min(distanceLeft, car.speed * dt);
    const required = edge.fuelCost * travel / edge.distance * (1 + 0.1 * (edge.difficulty - 1)) * (boosted ? this.setup.config.nitroFuelMultiplier : 1);
    if (required > car.fuel + 1e-9) { this.dnf(car, 'Fuel exhausted.'); return; }
    car.fuel = Math.max(0, car.fuel - required);
    car.progress = Math.min(1, car.progress + travel / edge.distance);
    car.distance += travel;
    if (car.progress < 1 - 1e-9) return;
    const arrived = route[car.routeIndex + 1];
    if (arrived === this.checkpointIds[car.checkpoint]) car.checkpoint++;
    if (arrived === this.setup.start && car.routeIndex === route.length - 2) {
      if (car.checkpoint !== this.checkpointIds.length) { this.dnf(car, 'Mandatory checkpoints incomplete.'); return; }
      car.completedLaps++;
      this.log(`${car.name}: lap ${car.completedLaps} complete.`);
      if (car.completedLaps >= this.setup.config.laps) { car.status = 'finished'; car.speed = 0; car.finishTime = this.time + dt; return; }
      car.checkpoint = 0; car.routeIndex = -1;
    }
    const service = this.vertices.get(arrived)!;
    if (service.type === 'FuelStation' && service.active && car.fuel < this.setup.config.fuelCapacity * 0.25) {
      car.fuel = Math.min(this.setup.config.fuelCapacity, car.fuel + this.setup.config.refuelAmount);
      car.stoppingUntil = this.time + dt + this.setup.config.refuelStopSeconds;
      car.status = 'waiting'; car.reason = 'Refuelling.'; car.speed = 0; this.log(`${car.name}: fuel stop.`);
    }
    if (service.type === 'NitroPickup' && service.active && car.nitro < this.setup.config.nitroCapacity && this.processor.collectNitro(arrived)) { car.nitro++; this.log(`${car.name}: nitro pickup collected.`); }
    car.routeIndex++;
    const nextEdge = this.edgeBetween(route[car.routeIndex], route[car.routeIndex + 1]);
    car.edgeId = nextEdge.id; car.reverse = nextEdge.to === route[car.routeIndex]; car.progress = 0;
  }

  private ahead(a: DrivingCar, b: DrivingCar): boolean {
    if (a.id === b.id) return false;
    if (a.status === 'finished' || b.status === 'finished') {
      if (a.status !== 'finished') return false;
      if (b.status !== 'finished') return true;
      return a.finishTime! < b.finishTime! || a.finishTime === b.finishTime && a.id < b.id;
    }
    return a.completedLaps > b.completedLaps || a.completedLaps === b.completedLaps && (a.checkpoint > b.checkpoint || a.checkpoint === b.checkpoint && (a.distance > b.distance || a.distance === b.distance && a.id < b.id));
  }
  private applyEvents(): void {
    for (const batch of this.processor.advanceTo(this.time)) for (const event of batch.events) this.log(`${event.eventId}: ${event.outcome}.`);
  }
  private dnf(car: DrivingCar, reason: string): void { car.status = 'dnf'; car.reason = reason; car.speed = 0; this.log(`${car.name}: DNF — ${reason}`); }
  private log(message: string): void {
    this.feed.push({ id: `race-${this.sequence++}`, time: Math.max(0, this.time), message });
    if (this.feed.length > 80) this.feed.shift();
  }
}
