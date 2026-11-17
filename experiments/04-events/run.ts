import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { EventQueue } from '../../src/core/events/EventQueue';
import type { QueueInput } from '../../src/core/events/EventQueue';
import type { HeapCounters } from '../../src/core/structures/MinHeap';
import type { ExperimentBundle, ExperimentSample } from '../../src/shared/experiment-results';
import type { ExperimentOptions } from '../shared/options';
import { random } from '../shared/random';
import { validateEffects } from './effect-checks';

export function eventDataset(size: number, ties: boolean, seed: number): QueueInput<number>[] {
  const next = random(seed);
  return Array.from({ length: size }, (_, index) => ({ eventId: `event-${index}`, triggerTime: ties ? 100 : Math.floor(next() * 100), priority: ties ? 3 : 1 + Math.floor(next() * 6), payload: index }));
}
function difference(before: Readonly<HeapCounters>, after: Readonly<HeapCounters>) {
  return Object.fromEntries(Object.keys(after).map((key) => [key, after[key as keyof HeapCounters] - before[key as keyof HeapCounters]]));
}

export function runEvents(options: ExperimentOptions): Pick<ExperimentBundle, 'samples' | 'checks' | 'counterDescriptions' | 'methodology'> {
  const samples: ExperimentSample[] = [], checks = validateEffects();
  for (const size of options.sizes ?? [100, 1000, 10000]) for (const [index, family] of ['mixed-priorities', 'exact-ties', 'lazy-cancellation'].entries()) {
    const seed = (options.seed ^ Math.imul(size, 2246822519) ^ index) >>> 0;
    const inputs = eventDataset(size, family === 'exact-ties', seed), caseId = `${family}-${size}`;
    const cancelled = new Set(family === 'lazy-cancellation' ? inputs.filter((_, i) => i % 4 === 0).map((event) => event.eventId) : []);
    const expected = inputs.map((input, insertionSequence) => ({ ...input, insertionSequence })).filter((event) => !cancelled.has(event.eventId))
      .sort((a, b) => a.triggerTime - b.triggerTime || a.priority - b.priority || a.insertionSequence - b.insertionSequence).map((event) => event.eventId);
    const execute = (run: number, measured: boolean) => {
      const queue = new EventQueue<number>();
      let counts = queue.counters;
      let start = performance.now(); for (const input of inputs) queue.schedule(input); let duration = performance.now() - start;
      const record = (phase: string, runtimeMs: number, before: Readonly<HeapCounters>, storage: number) => {
        if (measured) samples.push({ caseId, family, size, seed, algorithm: 'Event queue', phase, run, runtimeMs, counters: { ...difference(before, queue.counters), inputEvents: size, cancelledEvents: cancelled.size, liveEvents: size - cancelled.size, storageSize: storage } });
      };
      record('insertion', duration, counts, queue.storageSize);
      counts = queue.counters; start = performance.now(); for (const id of cancelled) queue.cancel(id); duration = performance.now() - start;
      if (cancelled.size) record('cancellation', duration, counts, queue.storageSize);
      assert.equal(queue.size, size - cancelled.size); assert.equal(queue.storageSize, size);
      counts = queue.counters; start = performance.now(); const output = queue.popDue(100); duration = performance.now() - start;
      record('extraction', duration, counts, queue.storageSize);
      // Native sort is an independent test oracle only, never a production queue.
      assert.deepEqual(output.map((event) => event.eventId), expected);
      assert.equal(queue.size, 0); assert.equal(queue.storageSize, 0);
      assert.equal(queue.counters.pushes, size); assert.equal(queue.counters.pops, size);
    };
    for (let warmup = 0; warmup < options.warmups; warmup++) execute(0, false);
    for (let run = 1; run <= options.runs; run++) execute(run, true);
    checks.push({ caseId, description: 'Every output matches the independent timestamp/priority/insertion-sequence oracle; cancelled IDs excluded; live and retained storage empty after drain; exact push/pop counters.', passed: true });
  }
  return { samples, checks, counterDescriptions: { pushes: 'Heap insertions during this phase.', pops: 'Heap removals, including lazy-deleted tombstones.', heapOps: 'pushes + pops, excluding comparisons and swaps.', comparisons: 'Comparator calls during this phase.', swaps: 'Heap array swaps during this phase.', inputEvents: 'Number of initially scheduled events.', cancelledEvents: 'Number of cancelled live IDs (every fourth input in cancellation cases).', liveEvents: 'Number of events returned by the drain.', storageSize: 'Retained heap entries after this phase; includes tombstones before extraction.' }, methodology: [
    'Three seeded families: random timestamps in [0,99] and priorities 1-6; identical time/priority to isolate insertion-sequence ties; and mixed events with every fourth ID cancelled before extraction.',
    'Each trial uses a fresh queue. Insertion times all schedule calls; extraction times one bulk popDue(100); cancellation times live-ID removal separately. Queue construction, dataset generation, oracle sorting, validation and I/O are excluded. Internal maps, allocation, output arrays and counters are included.',
    'Warm-ups precede the measured runs. Operation counters are phase deltas. Cancel is lazy: no heap operations during cancellation, retained storage remains n, and extraction still pops n entries including tombstones.',
    'Every measured output is checked outside the timing interval against an independently sorted timestamp/priority/insertion-sequence oracle. Untimed EventProcessor checks cover all six effects, cancellation, missing targets, overlapping expiry and pickup consumption.',
    'Per insertion/pop is O(log n); full insertion and full drain are O(n log n). Cancellation has expected O(1) map deletion but retains heap memory until the entry rises. Timings include JavaScript JIT, allocation and GC variability.',
  ] };
}
