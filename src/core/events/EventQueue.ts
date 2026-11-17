import { MinHeap } from '../structures/MinHeap';

export interface QueueInput<T> {
  eventId: string;
  triggerTime: number;
  priority: number;
  payload: T;
}
export interface ScheduledEvent<T> extends QueueInput<T> { insertionSequence: number }

export class EventQueue<T> {
  private readonly heap = new MinHeap<ScheduledEvent<T>>((a, b) => a.triggerTime - b.triggerTime || a.priority - b.priority || a.insertionSequence - b.insertionSequence);
  private readonly pending = new Map<string, ScheduledEvent<T>>();
  private readonly usedIds = new Set<string>();
  private nextSequence = 0;

  get size(): number { return this.pending.size; }
  get storageSize(): number { return this.heap.size; }
  get counters() { return this.heap.counters; }
  resetCounters(): void { this.heap.resetCounters(); }

  schedule(input: QueueInput<T>): ScheduledEvent<T> {
    if (!input.eventId.trim() || this.usedIds.has(input.eventId)) throw new Error('Event ID is empty or already used.');
    if (!Number.isFinite(input.triggerTime) || input.triggerTime < 0) throw new Error('Invalid event time.');
    if (!Number.isSafeInteger(input.priority) || input.priority < 0) throw new Error('Invalid event priority.');
    if (!Number.isSafeInteger(this.nextSequence)) throw new Error('Event sequence exhausted.');
    const entry = { ...input, insertionSequence: this.nextSequence++ };
    this.heap.push(entry);
    this.pending.set(entry.eventId, entry);
    this.usedIds.add(entry.eventId);
    return { ...entry };
  }

  /** Lazy deletion: remove the live ID, retaining the heap entry until it rises. */
  cancel(eventId: string): boolean { return this.pending.delete(eventId); }

  peek(): ScheduledEvent<T> | undefined {
    while (!this.heap.isEmpty && !this.pending.has(this.heap.peek()!.eventId)) this.heap.pop();
    const entry = this.heap.peek();
    return entry ? { ...entry } : undefined;
  }

  popDue(time: number): ScheduledEvent<T>[] {
    if (!Number.isFinite(time) || time < 0) throw new Error('Invalid current time.');
    const events: ScheduledEvent<T>[] = [];
    while (this.peek() && this.peek()!.triggerTime <= time) {
      const event = this.heap.pop()!;
      this.pending.delete(event.eventId);
      events.push({ ...event });
    }
    return events;
  }
}
