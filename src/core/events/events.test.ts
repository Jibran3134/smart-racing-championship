import { describe, expect, it } from 'vitest';
import { EventQueue } from './EventQueue';
import { EventProcessor } from './EventProcessor';
import type { EventWorld, EventEdgeState } from './EventProcessor';

function worldFixture() {
  const edges = new Map<string, EventEdgeState & { isShortcut: boolean }>([
    ['road', { status: 'Open', difficulty: 2, isShortcut: false }],
    ['shortcut', { status: 'Open', difficulty: 1, isShortcut: true }],
  ]);
  const vertices = new Map<number, { type: 'FuelStation' | 'NitroPickup'; active: boolean }>([
    [1, { type: 'FuelStation', active: true }], [2, { type: 'NitroPickup', active: false }],
  ]);
  const world: EventWorld = {
    getEdge: (id) => edges.get(id), getVertex: (id) => vertices.get(id),
    setEdgeState: (id, state) => edges.set(id, { ...edges.get(id)!, ...state }),
    setVertexActive: (id, active) => vertices.set(id, { ...vertices.get(id)!, active }),
  };
  return { world, edges, vertices, processor: new EventProcessor(world) };
}

describe('EventQueue', () => {
  it('orders time, then lower priority, then insertion sequence', () => {
    const queue = new EventQueue<string>();
    for (const [eventId, triggerTime, priority] of [['a', 10, 3], ['b', 5, 6], ['c', 10, 1], ['d', 10, 1]] as const) queue.schedule({ eventId, triggerTime, priority, payload: eventId });
    expect(queue.popDue(4)).toEqual([]);
    expect(queue.popDue(10).map((event) => event.eventId)).toEqual(['b', 'c', 'd', 'a']);
    expect(queue.size).toBe(0);
  });

  it('uses lazy cancellation, releases cancelled heads and rejects ID reuse', () => {
    const queue = new EventQueue<null>();
    queue.schedule({ eventId: 'a', triggerTime: 1, priority: 1, payload: null });
    queue.schedule({ eventId: 'b', triggerTime: 2, priority: 1, payload: null });
    expect(queue.cancel('b')).toBe(true);
    expect(queue.cancel('b')).toBe(false);
    expect(queue.storageSize).toBe(2);
    expect(queue.size).toBe(1);
    expect(queue.popDue(10).map((entry) => entry.eventId)).toEqual(['a']);
    expect(queue.storageSize).toBe(0);
    expect(() => queue.schedule({ eventId: 'b', triggerTime: 3, priority: 1, payload: null })).toThrow('already used');
  });

  it('copies envelopes and rejects invalid times/priorities', () => {
    const queue = new EventQueue<null>();
    const input = { eventId: 'a', triggerTime: 1, priority: 1, payload: null };
    queue.schedule(input);
    input.triggerTime = 99;
    queue.peek()!.triggerTime = 99;
    expect(queue.popDue(1)).toHaveLength(1);
    expect(() => queue.schedule({ ...input, eventId: 'b', triggerTime: NaN })).toThrow('time');
    expect(() => queue.schedule({ ...input, eventId: 'b', priority: 0.5 })).toThrow('priority');
    expect(() => queue.popDue(-1)).toThrow('time');
  });
});

describe('EventProcessor', () => {
  it('applies all six types, ordered at the same timestamp before reporting a batch', () => {
    const { processor, edges, vertices } = worldFixture();
    processor.schedule({ eventId: 'nitro', triggerTime: 1, effect: { type: 'nitro-booster', vertexId: 2, duration: 25 } });
    processor.schedule({ eventId: 'fuel', triggerTime: 1, effect: { type: 'fuel-availability', vertexId: 1, active: false, duration: 30 } });
    processor.schedule({ eventId: 'cap', triggerTime: 1, effect: { type: 'speed-restriction', edgeId: 'road', speedCap: 20, duration: 15 } });
    processor.schedule({ eventId: 'oil', triggerTime: 1, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 2, duration: 20 } });
    processor.schedule({ eventId: 'shortcut', triggerTime: 1, effect: { type: 'shortcut', edgeId: 'shortcut', open: false } });
    processor.schedule({ eventId: 'block', triggerTime: 1, effect: { type: 'road-blockage', edgeId: 'road', blocked: true } });
    const batches = processor.advanceTo(1);
    expect(batches).toHaveLength(1);
    expect(batches[0].events.map((event) => event.eventId)).toEqual(['block', 'shortcut', 'oil', 'cap', 'fuel', 'nitro']);
    expect(edges.get('road')).toMatchObject({ status: 'Blocked', difficulty: 4, speedCap: 20 });
    expect(edges.get('shortcut')?.status).toBe('Blocked');
    expect(vertices.get(1)?.active).toBe(false);
    expect(vertices.get(2)?.active).toBe(true);
    processor.advanceTo(31);
    expect(processor.activeEffects).toEqual([]);
    expect(edges.get('road')).toMatchObject({ status: 'Blocked', difficulty: 2, speedCap: undefined });
    expect(vertices.get(1)?.active).toBe(true);
    expect(vertices.get(2)?.active).toBe(false);
  });

  it('preserves independent oil/cap effects and restores only expired contributions', () => {
    const { processor, edges } = worldFixture();
    processor.schedule({ eventId: 'mild', triggerTime: 0, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 1, duration: 20 } });
    processor.schedule({ eventId: 'severe', triggerTime: 0, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 3, duration: 10 } });
    processor.schedule({ eventId: 'loose', triggerTime: 0, effect: { type: 'speed-restriction', edgeId: 'road', speedCap: 30, duration: 20 } });
    processor.schedule({ eventId: 'strict', triggerTime: 0, effect: { type: 'speed-restriction', edgeId: 'road', speedCap: 10, duration: 10 } });
    processor.advanceTo(0);
    expect(edges.get('road')).toMatchObject({ difficulty: 5, speedCap: 10 });
    processor.advanceTo(10);
    expect(edges.get('road')).toMatchObject({ difficulty: 3, speedCap: 30, status: 'Restricted' });
    processor.advanceTo(20);
    expect(edges.get('road')).toMatchObject({ difficulty: 2, speedCap: undefined, status: 'Open' });
  });

  it('handles expiry and new effect ties deterministically without erasing the new effect', () => {
    const { processor, edges } = worldFixture();
    processor.schedule({ eventId: 'first', triggerTime: 0, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 2, duration: 10 } });
    processor.schedule({ eventId: 'second', triggerTime: 10, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 1, duration: 10 } });
    processor.advanceTo(0);
    const [batch] = processor.advanceTo(10);
    expect(batch.events.map((event) => event.eventId)).toEqual(['second', '@expiry/first']);
    expect(edges.get('road')?.difficulty).toBe(3);
    expect(processor.activeEffects.map((entry) => entry.eventId)).toEqual(['second']);
  });

  it('supports cancellation and validates targets both at schedule and firing', () => {
    const { processor, edges } = worldFixture();
    processor.schedule({ eventId: 'cancelled', triggerTime: 1, effect: { type: 'road-blockage', edgeId: 'road', blocked: true } });
    expect(processor.cancel('cancelled')).toBe(true);
    expect(processor.advanceTo(1)).toEqual([]);
    expect(edges.get('road')?.status).toBe('Open');
    expect(() => processor.schedule({ eventId: 'bad', triggerTime: 2, effect: { type: 'road-blockage', edgeId: 'missing', blocked: true } })).toThrow('Missing edge');
    expect(() => processor.schedule({ eventId: 'bad', triggerTime: 2, effect: { type: 'shortcut', edgeId: 'road', open: true } })).toThrow('not a shortcut');
    processor.schedule({ eventId: 'removed', triggerTime: 2, effect: { type: 'road-blockage', edgeId: 'road', blocked: true } });
    edges.delete('road');
    expect(processor.advanceTo(2)[0].events[0]).toMatchObject({ outcome: 'skipped', reason: 'Missing edge: road' });
  });

  it('restores overlapping station overrides in application order', () => {
    const { processor, vertices } = worldFixture();
    processor.schedule({ eventId: 'closed', triggerTime: 0, effect: { type: 'fuel-availability', vertexId: 1, active: false, duration: 20 } });
    processor.schedule({ eventId: 'open', triggerTime: 1, effect: { type: 'fuel-availability', vertexId: 1, active: true, duration: 5 } });
    processor.advanceTo(1);
    expect(vertices.get(1)?.active).toBe(true);
    processor.advanceTo(6);
    expect(vertices.get(1)?.active).toBe(false);
    processor.advanceTo(20);
    expect(vertices.get(1)?.active).toBe(true);
  });

  it('collects active nitro once and cancels all associated expiries without resurrection', () => {
    const { processor, vertices } = worldFixture();
    for (const eventId of ['a', 'b']) processor.schedule({ eventId, triggerTime: 0, effect: { type: 'nitro-booster', vertexId: 2, duration: 10 } });
    processor.advanceTo(0);
    expect(processor.collectNitro(2)).toBe(true);
    expect(processor.collectNitro(2)).toBe(false);
    expect(processor.pendingCount).toBe(0);
    processor.advanceTo(20);
    expect(vertices.get(2)?.active).toBe(false);
  });

  it('large time jumps produce the same state and expiry order as incremental ticks', () => {
    const first = worldFixture(); const second = worldFixture();
    for (const fixture of [first, second]) fixture.processor.schedule({ eventId: 'oil', triggerTime: 2, effect: { type: 'oil-spill', edgeId: 'road', difficultyPenalty: 2, duration: 3 } });
    const jumped = first.processor.advanceTo(20);
    const stepped = [...second.processor.advanceTo(2), ...second.processor.advanceTo(5), ...second.processor.advanceTo(20)];
    expect(jumped).toEqual(stepped);
    expect(first.edges).toEqual(second.edges);
    expect(first.processor.counters).toEqual(second.processor.counters);
  });

  it('rejects invalid durations, caps, target kinds, past events and backward time', () => {
    const { processor } = worldFixture();
    expect(() => processor.schedule({ eventId: 'a', triggerTime: 0, effect: { type: 'speed-restriction', edgeId: 'road', duration: 0, speedCap: 1 } })).toThrow('Duration');
    expect(() => processor.schedule({ eventId: 'a', triggerTime: 0, effect: { type: 'speed-restriction', edgeId: 'road', duration: 1, speedCap: NaN } })).toThrow('Speed cap');
    expect(() => processor.schedule({ eventId: 'a', triggerTime: 0, effect: { type: 'fuel-availability', vertexId: 2, active: false, duration: 1 } })).toThrow('FuelStation');
    expect(() => processor.schedule({ eventId: '@expiry/a', triggerTime: 0, effect: { type: 'nitro-booster', vertexId: 2, duration: 1 } })).toThrow('Reserved');
    expect(() => processor.schedule({ eventId: 'rounded-expiry', triggerTime: Number.MAX_VALUE, effect: { type: 'nitro-booster', vertexId: 2, duration: 1 } })).toThrow('representable future');
    processor.advanceTo(5);
    expect(() => processor.advanceTo(4)).toThrow('monotonic');
    expect(() => processor.schedule({ eventId: 'a', triggerTime: 4, effect: { type: 'nitro-booster', vertexId: 2, duration: 1 } })).toThrow('past');
  });
});
