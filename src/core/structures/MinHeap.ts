export type Comparator<T> = (left: T, right: T) => number;

export interface HeapCounters {
  pushes: number;
  pops: number;
  comparisons: number;
  swaps: number;
  heapOps: number;
}

/** A negative comparison means left should be extracted first.
 * Equal keys are not stable: callers supply a sequence tie-breaker when needed.
 * Values must not be mutated in a way that changes their priority while queued.
 */
export class MinHeap<T> {
  private readonly items: T[];
  private counts: HeapCounters = MinHeap.emptyCounters();

  constructor(private readonly compare: Comparator<T>, initial: Iterable<T> = []) {
    this.items = Array.from(initial);
    // Bottom-up heap construction is O(n), unlike repeated O(log n) insertion.
    for (let index = Math.floor(this.items.length / 2) - 1; index >= 0; index--) {
      this.siftDown(index);
    }
  }

  get size(): number { return this.items.length; }
  get isEmpty(): boolean { return this.items.length === 0; }
  get counters(): Readonly<HeapCounters> { return { ...this.counts }; }

  peek(): T | undefined { return this.items[0]; }

  push(value: T): void {
    this.items.push(value);
    this.counts.pushes++;
    this.counts.heapOps++;
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.precedes(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): T | undefined {
    if (this.isEmpty) return undefined;
    const first = this.items[0];
    const last = this.items.pop()!;
    this.counts.pops++;
    this.counts.heapOps++;
    if (!this.isEmpty) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return first;
  }

  /** A shallow copy in heap order (not sorted order), useful for visualization. */
  toArray(): T[] { return [...this.items]; }

  resetCounters(): void { this.counts = MinHeap.emptyCounters(); }

  private static emptyCounters(): HeapCounters {
    return { pushes: 0, pops: 0, comparisons: 0, swaps: 0, heapOps: 0 };
  }

  private precedes(left: number, right: number): boolean {
    this.counts.comparisons++;
    return this.compare(this.items[left], this.items[right]) < 0;
  }

  private swap(left: number, right: number): void {
    [this.items[left], this.items[right]] = [this.items[right], this.items[left]];
    this.counts.swaps++;
  }

  private siftDown(start: number): void {
    let index = start;
    while (index * 2 + 1 < this.items.length) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = left;
      if (right < this.items.length && this.precedes(right, left)) smallest = right;
      if (!this.precedes(smallest, index)) break;
      this.swap(index, smallest);
      index = smallest;
    }
  }
}
