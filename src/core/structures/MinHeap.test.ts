import { describe, expect, it } from 'vitest';
import { MinHeap } from './MinHeap';

const ascending = (a: number, b: number) => a - b;

function drain<T>(heap: MinHeap<T>): T[] {
  const values: T[] = [];
  while (!heap.isEmpty) values.push(heap.pop()!);
  return values;
}

describe('MinHeap', () => {
  it('handles empty and singleton heaps without counting empty extractions', () => {
    const heap = new MinHeap(ascending);
    expect(heap.peek()).toBeUndefined();
    expect(heap.pop()).toBeUndefined();
    expect(heap.counters.heapOps).toBe(0);
    heap.push(7);
    expect(heap.size).toBe(1);
    expect(heap.peek()).toBe(7);
    expect(heap.peek()).toBe(7);
    expect(heap.pop()).toBe(7);
    expect(heap.isEmpty).toBe(true);
    expect(heap.counters).toEqual({ pushes: 1, pops: 1, heapOps: 2, comparisons: 0, swaps: 0 });
  });

  it.each([[], [1], [1, 2, 3, 4], [4, 3, 2, 1], [4, 4, -2, 0, 4, -2]].map((values) => ({ values })))(
    'heapifies and drains numeric input $values', ({ values }) => {
      const heap = new MinHeap(ascending, values);
      expect(drain(heap)).toEqual([...values].sort(ascending));
    },
  );

  it('matches a sorted reference after 2,000 seeded interleaved operations', () => {
    let seed = 12345;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    const heap = new MinHeap(ascending);
    const reference: number[] = [];
    for (let index = 0; index < 2000; index++) {
      if (random() % 3 !== 0 || reference.length === 0) {
        const value = random() % 100 - 50;
        heap.push(value);
        reference.push(value);
        reference.sort(ascending);
      } else {
        expect(heap.pop()).toBe(reference.shift());
      }
      expect(heap.peek()).toBe(reference[0]);
      expect(heap.size).toBe(reference.length);
      const items = heap.toArray();
      expect(items.every((value, child) => child === 0 || items[Math.floor((child - 1) / 2)] <= value)).toBe(true);
    }
    expect(drain(heap)).toEqual(reference);
  });

  it('supports a reversed comparator for bounded top-k consumers', () => {
    const heap = new MinHeap((a: number, b: number) => b - a, [2, 9, 1, 5]);
    expect(drain(heap)).toEqual([9, 5, 2, 1]);
  });

  it('supports the event time, priority and sequence total order', () => {
    type Entry = { time: number; priority: number; sequence: number };
    const compare = (a: Entry, b: Entry) => a.time - b.time || a.priority - b.priority || a.sequence - b.sequence;
    const values = [
      { time: 10, priority: 2, sequence: 0 },
      { time: 5, priority: 6, sequence: 1 },
      { time: 10, priority: 1, sequence: 3 },
      { time: 10, priority: 1, sequence: 2 },
    ];
    expect(drain(new MinHeap(compare, values))).toEqual([...values].sort(compare));
  });

  it('copies constructor input, array snapshots and counter snapshots', () => {
    const input = [5, 2, 3];
    const heap = new MinHeap(ascending, input);
    input[0] = -100;
    heap.toArray().push(-200);
    const counters = heap.counters;
    heap.push(1);
    expect(counters.pushes).toBe(0);
    expect(drain(heap)).toEqual([1, 2, 3, 5]);
  });

  it('counts actual comparisons/swaps and resets without changing heap content', () => {
    const heap = new MinHeap(ascending);
    heap.push(3);
    heap.push(1);
    heap.push(2);
    expect(heap.counters).toEqual({ pushes: 3, pops: 0, heapOps: 3, comparisons: 2, swaps: 1 });
    heap.pop();
    expect(heap.counters).toEqual({ pushes: 3, pops: 1, heapOps: 4, comparisons: 3, swaps: 1 });
    heap.resetCounters();
    expect(heap.counters).toEqual({ pushes: 0, pops: 0, heapOps: 0, comparisons: 0, swaps: 0 });
    expect(drain(heap)).toEqual([2, 3]);
  });

  it('heapifies in linear comparisons rather than repeated insertion', () => {
    const input = Array.from({ length: 1024 }, (_, index) => 1024 - index);
    const heap = new MinHeap(ascending, input);
    expect(heap.counters.comparisons).toBeLessThan(2 * input.length);
    expect(heap.counters.heapOps).toBe(0);
    expect(drain(heap)).toEqual([...input].reverse());
  });
});
