import { EventQueue } from './EventQueue';

export interface EventEdgeState {
  status: 'Open' | 'Blocked' | 'Restricted';
  difficulty: number;
  speedCap?: number;
}
export interface EventWorld {
  getEdge(id: string): (EventEdgeState & { isShortcut: boolean }) | undefined;
  getVertex(id: number): { type: 'FuelStation' | 'NitroPickup' | 'Other'; active: boolean } | undefined;
  setEdgeState(id: string, state: EventEdgeState): void;
  setVertexActive(id: number, active: boolean): void;
}

export type RaceEvent =
  | { type: 'road-blockage'; edgeId: string; blocked: boolean }
  | { type: 'shortcut'; edgeId: string; open: boolean }
  | { type: 'oil-spill'; edgeId: string; duration: number; difficultyPenalty: number; speedCap?: number }
  | { type: 'speed-restriction'; edgeId: string; duration: number; speedCap: number }
  | { type: 'fuel-availability'; vertexId: number; duration: number; active: boolean }
  | { type: 'nitro-booster'; vertexId: number; duration: number };

export interface RaceEventInput { eventId: string; triggerTime: number; effect: RaceEvent }
interface Expiry { type: 'expiry'; effectId: string }
interface ActiveEffect { eventId: string; expiresAt: number; effect: Exclude<RaceEvent, { type: 'road-blockage' | 'shortcut' }> }
export interface EventOutcome { eventId: string; type: RaceEvent['type'] | 'expiry'; outcome: 'applied' | 'expired' | 'skipped'; reason?: string }
export interface EventBatch { time: number; events: EventOutcome[]; changedEdges: string[]; changedVertices: number[] }

const priorities: Record<RaceEvent['type'], number> = {
  'road-blockage': 1, shortcut: 2, 'oil-spill': 3, 'speed-restriction': 4, 'fuel-availability': 5, 'nitro-booster': 6,
};
const expiryId = (eventId: string) => `@expiry/${eventId}`;

/** Model-independent event resolution. The engine supplies a state adapter.
 * This instance owns dynamic changes to targets once they have been captured.
 */
export class EventProcessor {
  private readonly queue = new EventQueue<RaceEvent | Expiry>();
  private readonly effects = new Map<string, ActiveEffect>();
  private readonly baseEdges = new Map<string, EventEdgeState>();
  private readonly baseVertices = new Map<number, boolean>();
  private time = 0;

  constructor(private readonly world: EventWorld) {}

  get currentTime(): number { return this.time; }
  get pendingCount(): number { return this.queue.size; }
  get nextTime(): number | undefined { return this.queue.peek()?.triggerTime; }
  get counters() { return this.queue.counters; }
  get activeEffects(): ActiveEffect[] { return [...this.effects.values()].map((entry) => ({ ...entry, effect: { ...entry.effect } })); }

  schedule(input: RaceEventInput): void {
    if (input.eventId.startsWith('@expiry/')) throw new Error('Reserved event ID prefix.');
    if (input.triggerTime < this.time) throw new Error('Cannot schedule an event in the past.');
    this.validate(input.effect);
    if ('duration' in input.effect) {
      const expiry = input.triggerTime + input.effect.duration;
      if (!Number.isFinite(expiry) || expiry <= input.triggerTime) throw new Error('Expiry must be a representable future time.');
    }
    this.queue.schedule({ eventId: input.eventId, triggerTime: input.triggerTime, priority: priorities[input.effect.type], payload: { ...input.effect } });
  }

  /** Cancels pending user events; applied effects end through their own expiry. */
  cancel(eventId: string): boolean {
    return !eventId.startsWith('@expiry/') && this.queue.cancel(eventId);
  }

  /** Process timestamps in order, resolving a whole timestamp before reporting it.
   * Engines should step to nextTime boundaries before advancing car traversal.
   */
  advanceTo(time: number): EventBatch[] {
    if (!Number.isFinite(time) || time < this.time) throw new Error('Time must be finite and monotonic.');
    const batches: EventBatch[] = [];
    while (this.nextTime !== undefined && this.nextTime <= time) {
      const timestamp = this.nextTime;
      this.time = timestamp;
      const changedEdges = new Set<string>();
      const changedVertices = new Set<number>();
      const events: EventOutcome[] = [];
      for (const scheduled of this.queue.popDue(timestamp)) {
        const effect = scheduled.payload;
        if (effect.type === 'expiry') {
          const active = this.effects.get(effect.effectId);
          if (active) {
            this.effects.delete(effect.effectId);
            this.recomputeTarget(active.effect, changedEdges, changedVertices);
          }
          events.push({ eventId: scheduled.eventId, type: 'expiry', outcome: active ? 'expired' : 'skipped' });
          continue;
        }
        try { this.validate(effect); }
        catch (error) {
          events.push({ eventId: scheduled.eventId, type: effect.type, outcome: 'skipped', reason: error instanceof Error ? error.message : 'Invalid target.' });
          continue;
        }
        this.captureBase(effect);
        if (effect.type === 'road-blockage' || effect.type === 'shortcut') {
          this.baseEdges.get(effect.edgeId)!.status = (effect.type === 'road-blockage' ? effect.blocked : !effect.open) ? 'Blocked' : 'Open';
        } else {
          const expiresAt = timestamp + effect.duration;
          this.effects.set(scheduled.eventId, { eventId: scheduled.eventId, expiresAt, effect });
          this.queue.schedule({ eventId: expiryId(scheduled.eventId), triggerTime: expiresAt, priority: priorities[effect.type], payload: { type: 'expiry', effectId: scheduled.eventId } });
        }
        this.recomputeTarget(effect, changedEdges, changedVertices);
        events.push({ eventId: scheduled.eventId, type: effect.type, outcome: 'applied' });
      }
      batches.push({ time: timestamp, events, changedEdges: [...changedEdges], changedVertices: [...changedVertices] });
    }
    this.time = time;
    return batches;
  }

  /** Consumes this processor's pickup instance; capacity checks belong to engine.
   * All active boosts for this vertex are consumed so an older expiry cannot
   * reactivate a collected pickup. Future scheduled boosts may activate it again.
   */
  collectNitro(vertexId: number): boolean {
    const vertex = this.world.getVertex(vertexId);
    if (vertex?.type !== 'NitroPickup' || !vertex.active) return false;
    this.baseVertices.set(vertexId, false);
    for (const [id, active] of this.effects) {
      if (active.effect.type === 'nitro-booster' && active.effect.vertexId === vertexId) {
        this.effects.delete(id);
        this.queue.cancel(expiryId(id));
      }
    }
    this.world.setVertexActive(vertexId, false);
    return true;
  }

  private validate(effect: RaceEvent): void {
    if ('edgeId' in effect) {
      const edge = this.world.getEdge(effect.edgeId);
      if (!edge) throw new Error(`Missing edge: ${effect.edgeId}`);
      if (effect.type === 'shortcut' && !edge.isShortcut) throw new Error('Target is not a shortcut.');
    } else {
      const vertex = this.world.getVertex(effect.vertexId);
      const required = effect.type === 'fuel-availability' ? 'FuelStation' : 'NitroPickup';
      if (!vertex || vertex.type !== required) throw new Error(`Invalid ${required} target: ${effect.vertexId}`);
    }
    if ('duration' in effect && (!Number.isFinite(effect.duration) || effect.duration <= 0)) throw new Error('Duration must be finite and positive.');
    if ('speedCap' in effect && effect.speedCap !== undefined && (!Number.isFinite(effect.speedCap) || effect.speedCap <= 0)) throw new Error('Speed cap must be finite and positive.');
    if (effect.type === 'oil-spill' && (!Number.isInteger(effect.difficultyPenalty) || effect.difficultyPenalty < 0 || effect.difficultyPenalty > 4)) throw new Error('Oil difficulty penalty must be an integer from 0 to 4.');
  }

  private captureBase(effect: RaceEvent): void {
    if ('edgeId' in effect) {
      if (!this.baseEdges.has(effect.edgeId)) {
        const edge = this.world.getEdge(effect.edgeId)!;
        this.baseEdges.set(effect.edgeId, { status: edge.status, difficulty: edge.difficulty, speedCap: edge.speedCap });
      }
    } else if (!this.baseVertices.has(effect.vertexId)) this.baseVertices.set(effect.vertexId, this.world.getVertex(effect.vertexId)!.active);
  }

  private recomputeTarget(effect: RaceEvent, changedEdges: Set<string>, changedVertices: Set<number>): void {
    if ('edgeId' in effect) {
      const edgeId = effect.edgeId;
      if (!this.world.getEdge(edgeId)) return;
      const base = this.baseEdges.get(edgeId)!;
      let penalty = 0;
      let cap = base.speedCap;
      for (const active of this.effects.values()) {
        const item = active.effect;
        if (!('edgeId' in item) || item.edgeId !== edgeId) continue;
        if (item.type === 'oil-spill') penalty = Math.max(penalty, item.difficultyPenalty);
        if (item.speedCap !== undefined) cap = Math.min(cap ?? Infinity, item.speedCap);
      }
      const next: EventEdgeState = { status: base.status === 'Blocked' ? 'Blocked' : cap !== undefined ? 'Restricted' : base.status, difficulty: Math.min(5, base.difficulty + penalty), speedCap: cap };
      const previous = this.world.getEdge(edgeId)!;
      if (previous.status !== next.status || previous.difficulty !== next.difficulty || previous.speedCap !== next.speedCap) changedEdges.add(edgeId);
      this.world.setEdgeState(edgeId, next);
    } else {
      const vertexId = effect.vertexId;
      const vertex = this.world.getVertex(vertexId);
      if (!vertex) return;
      let active = this.baseVertices.get(vertexId)!;
      // Map insertion order is heap application order: most recent surviving
      // fuel override wins; overlapping nitro activations remain independent.
      for (const entry of this.effects.values()) {
        const item = entry.effect;
        if ('vertexId' in item && item.vertexId === vertexId) active = item.type === 'nitro-booster' ? true : item.active;
      }
      if (vertex.active !== active) changedVertices.add(vertexId);
      this.world.setVertexActive(vertexId, active);
    }
  }
}
