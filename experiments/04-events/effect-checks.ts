import assert from 'node:assert/strict';
import { EventProcessor } from '../../src/core/events/EventProcessor';
import type { EventEdgeState, EventWorld } from '../../src/core/events/EventProcessor';
import type { ExperimentBundle } from '../../src/shared/experiment-results';

/** Untimed integration checks for expiry/aggregation and all six effect types. */
export function validateEffects(): ExperimentBundle['checks'] {
  const edges = new Map<string, EventEdgeState & { isShortcut: boolean }>([['road', { status: 'Open', difficulty: 2, isShortcut: false }], ['shortcut', { status: 'Blocked', difficulty: 1, isShortcut: true }]]);
  const vertices = new Map([[1, { type: 'FuelStation' as const, active: true }], [2, { type: 'NitroPickup' as const, active: false }]]);
  const world: EventWorld = { getEdge: (id) => edges.get(id), getVertex: (id) => vertices.get(id), setEdgeState: (id, state) => Object.assign(edges.get(id)!, state), setVertexActive: (id, active) => { vertices.get(id)!.active = active; } };
  const processor = new EventProcessor(world);
  processor.schedule({ eventId: 'block', triggerTime: 0, effect: { type: 'road-blockage', edgeId: 'road', blocked: true } });
  processor.schedule({ eventId: 'shortcut', triggerTime: 0, effect: { type: 'shortcut', edgeId: 'shortcut', open: true } });
  processor.schedule({ eventId: 'mild', triggerTime: 0, effect: { type: 'oil-spill', edgeId: 'road', duration: 12, difficultyPenalty: 1 } });
  processor.schedule({ eventId: 'cap', triggerTime: 0, effect: { type: 'speed-restriction', edgeId: 'road', duration: 20, speedCap: 40 } });
  processor.schedule({ eventId: 'fuel', triggerTime: 0, effect: { type: 'fuel-availability', vertexId: 1, duration: 10, active: false } });
  processor.schedule({ eventId: 'nitro', triggerTime: 0, effect: { type: 'nitro-booster', vertexId: 2, duration: 8 } });
  processor.schedule({ eventId: 'severe', triggerTime: 2, effect: { type: 'oil-spill', edgeId: 'road', duration: 4, difficultyPenalty: 3, speedCap: 30 } });
  processor.schedule({ eventId: 'cancelled-clear', triggerTime: 3, effect: { type: 'road-blockage', edgeId: 'road', blocked: false } });
  assert.ok(processor.cancel('cancelled-clear'));
  assert.throws(() => processor.schedule({ eventId: 'invalid', triggerTime: 0, effect: { type: 'road-blockage', edgeId: 'missing', blocked: true } }));
  assert.deepEqual(processor.advanceTo(0)[0].events.map((event) => event.eventId), ['block', 'shortcut', 'mild', 'cap', 'fuel', 'nitro']);
  assert.equal(edges.get('road')!.status, 'Blocked'); assert.equal(edges.get('shortcut')!.status, 'Open');
  assert.equal(vertices.get(1)!.active, false); assert.equal(vertices.get(2)!.active, true);
  assert.ok(processor.collectNitro(2));
  processor.advanceTo(2); assert.equal(edges.get('road')!.difficulty, 5); assert.equal(edges.get('road')!.speedCap, 30);
  processor.advanceTo(6); assert.equal(edges.get('road')!.difficulty, 3); assert.equal(edges.get('road')!.speedCap, 40);
  processor.advanceTo(10); assert.equal(vertices.get(1)!.active, true); assert.equal(vertices.get(2)!.active, false);
  processor.advanceTo(12); assert.equal(edges.get('road')!.difficulty, 2); assert.equal(edges.get('road')!.speedCap, 40);
  processor.advanceTo(20); assert.equal(edges.get('road')!.speedCap, undefined); assert.equal(edges.get('road')!.status, 'Blocked');
  assert.equal(processor.activeEffects.length, 0); assert.equal(processor.pendingCount, 0);
  return ['Six simultaneous event types follow priority order.', 'Cancelled blockage-clear never runs; missing targets are rejected.', 'Maximum oil penalty and strictest cap survive independent expiries.', 'Station expiry restores availability; collected nitro remains consumed.', 'Every remaining temporary effect expires and the queue drains.']
    .map((description, index) => ({ caseId: `effects-${index + 1}`, description, passed: true }));
}
