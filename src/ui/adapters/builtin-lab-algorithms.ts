import { bfs } from '../../core/algorithms/exploration/bfs';
import { dfs } from '../../core/algorithms/exploration/dfs';
import { reconstructPath } from '../../core/algorithms/exploration/contracts';
import type { ExplorationStep } from '../../core/algorithms/exploration/contracts';
import { MinHeap } from '../../core/structures/MinHeap';
import { EventQueue } from '../../core/events/EventQueue';
import { explorationAdapter } from './exploration-adapter';
import type { LabAlgorithm } from './algorithm-lab';

const searchCounters = { expandedVertices: 'Vertices expanded.', visitedVertices: 'Vertices discovered.', examinedEdges: 'Adjacency arcs examined; undirected roads contribute two.', relaxedEdges: 'New parent links.', heapOps: 'Zero: BFS/DFS do not use the heap.', comparisons: 'Discovery/color membership checks.' };
const heapCounters = { pushes: 'Heap insertions.', pops: 'Heap removals, including cancelled event entries.', heapOps: 'Pushes plus pops.', comparisons: 'Comparator calls.', swaps: 'Heap array swaps.' };

const searches: LabAlgorithm[] = (['bfs', 'dfs'] as const).map((id) => ({
  id, title: id === 'bfs' ? 'Breadth-first search' : 'Depth-first search', family: 'exploration', usesTrack: true,
  description: id === 'bfs' ? 'Minimum-edge exploration on the current track. Uses the same BFS as Track Explorer.' : 'Iterative traversal and reachable-cycle detection on the current track. Uses the same DFS as Track Explorer.',
  fields: [{ id: 'source', label: 'Start vertex', type: 'vertex' }, { id: 'target', label: 'Destination vertex', type: 'vertex', vertexDefault: 'last-checkpoint' }],
  counterDescriptions: searchCounters,
  run(input, { track, emit }) {
    const graph = explorationAdapter(track), source = Number(input.source), target = Number(input.target);
    const callback = (step: ExplorationStep) => { if (step.type !== 'done') emit({ type: step.type, message: `${step.type}${step.vertex === undefined ? '' : ` vertex ${step.vertex}`}`, counters: { ...step.counters }, graph: { vertex: step.vertex, edge: step.edge, frontier: step.frontier, visited: step.visited } }); };
    const result = id === 'bfs' ? bfs(graph, source, callback) : dfs(graph, source, callback);
    const path = reconstructPath(result, source, target);
    emit({ type: 'done', message: path ? `${id === 'bfs' ? 'Minimum-edge' : 'DFS tree'} path has ${path.edges.length} edges.` : 'The destination is unreachable.', counters: { ...result.counters }, graph: { visited: result.order, routeEdges: path?.edges ?? [] }, state: { reachable: Boolean(path), path: path?.vertices.join(' > ') ?? 'none' } });
    return { reachable: Boolean(path), pathEdges: path?.edges.length ?? null, cycleDetected: 'hasCycle' in result ? Boolean(result.hasCycle) : null, objective: id === 'bfs' ? 'Minimum number of edges, not weighted distance/time.' : 'DFS parent path; not a shortest-path guarantee.' };
  },
}));

const heap: LabAlgorithm = {
  id: 'min-heap', title: 'Generic min-heap', family: 'structures', usesTrack: false,
  description: 'Insert or bottom-up heapify numbers, then drain the production comparator-based heap. Snapshots show array order, not sorted order.',
  fields: [{ id: 'values', label: 'Values JSON', type: 'json', defaultValue: '[14, 3, 9, 1, 8, 3, -2]' }, { id: 'construction', label: 'Construction', type: 'select', defaultValue: 'insert', options: [{ value: 'insert', label: 'Repeated insertion' }, { value: 'heapify', label: 'Bottom-up heapify' }] }],
  counterDescriptions: heapCounters,
  run(input, { emit }) {
    const values: unknown = JSON.parse(input.values);
    if (!Array.isArray(values) || values.length > 200 || !values.every((value) => typeof value === 'number' && Number.isFinite(value))) throw new Error('Use a JSON array of at most 200 finite numbers.');
    const queue = new MinHeap<number>((a, b) => a - b, input.construction === 'heapify' ? values : []);
    const output: number[] = [];
    const snapshot = (type: string, message: string) => emit({ type, message, counters: { ...queue.counters }, array: queue.toArray().map((value, index) => ({ label: String(index), value, active: index === 0 })), state: { heapSize: queue.size, minimum: queue.peek() ?? null, extracted: output.join(', ') } });
    snapshot('initialize', input.construction === 'heapify' ? 'Bottom-up heap construction complete.' : 'Empty heap ready.');
    if (input.construction === 'insert') for (const value of values) { queue.push(value); snapshot('push', `Inserted ${value}.`); }
    while (!queue.isEmpty) { const value = queue.pop()!; output.push(value); snapshot('pop', `Extracted ${value}.`); }
    snapshot('done', 'The heap is empty.');
    return { construction: input.construction, extracted: output.join(', '), count: output.length, note: 'This reuses MinHeap; it is not the pending championship Heap Sort implementation.' };
  },
};

const events: LabAlgorithm = {
  id: 'event-queue', title: 'Event priority queue', family: 'events', usesTrack: false,
  description: 'Schedule, lazily cancel and drain the actual EventQueue by timestamp, lower priority number, then insertion sequence.',
  fields: [{ id: 'events', label: 'Events JSON', type: 'json', defaultValue: '[{"id":"late","time":9,"priority":1},{"id":"tie-a","time":2,"priority":3},{"id":"priority","time":2,"priority":1},{"id":"tie-b","time":2,"priority":3},{"id":"cancel-me","time":1,"priority":1,"cancel":true}]' }],
  counterDescriptions: heapCounters,
  run(input, { emit }) {
    const data: unknown = JSON.parse(input.events);
    if (!Array.isArray(data) || data.length > 100 || !data.every((event) => typeof event === 'object' && event !== null && typeof event.id === 'string' && typeof event.time === 'number' && typeof event.priority === 'number' && (event.cancel === undefined || typeof event.cancel === 'boolean'))) throw new Error('Use at most 100 events with id, time, priority and optional cancel.');
    const queue = new EventQueue<null>();
    const pending: { id: string; time: number; priority: number; sequence: number; status: string }[] = [];
    const extracted: string[] = [];
    const snapshot = (type: string, message: string) => emit({ type, message, counters: { ...queue.counters }, table: { columns: ['ID', 'Time', 'Priority', 'Sequence', 'Status'], rows: pending.map((event) => [event.id, event.time, event.priority, event.sequence, event.status]) }, state: { liveEvents: queue.size, retainedHeapEntries: queue.storageSize, extracted: extracted.join(', ') } });
    snapshot('initialize', 'Empty event queue ready.');
    for (const event of data) {
      const scheduled = queue.schedule({ eventId: event.id, triggerTime: event.time, priority: event.priority, payload: null });
      pending.push({ id: event.id, time: event.time, priority: event.priority, sequence: scheduled.insertionSequence, status: 'pending' }); snapshot('push', `Scheduled ${event.id}.`);
    }
    for (const event of data.filter((item) => item.cancel)) { queue.cancel(event.id); pending.find((row) => row.id === event.id)!.status = 'cancelled'; snapshot('cancel', `Cancelled ${event.id}; its heap entry is retained until it rises.`); }
    while (queue.storageSize) {
      const next = queue.peek();
      if (!next) break;
      for (const event of queue.popDue(next.triggerTime)) { extracted.push(event.eventId); pending.find((row) => row.id === event.eventId)!.status = 'fired'; }
      snapshot('pop', `Processed all live events due at ${next.triggerTime}.`);
    }
    snapshot('done', 'Live events and retained heap entries are empty.');
    return { order: extracted.join(', '), firedEvents: extracted.length, cancelledEvents: data.filter((event) => event.cancel).length, rule: 'Ascending (time, priority, insertionSequence). Effect resolution is available in Event simulation.' };
  },
};

export const builtinLabAlgorithms: readonly LabAlgorithm[] = [...searches, heap, events];
