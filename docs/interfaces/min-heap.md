# Generic min-heap handoff

Implemented in `src/core/structures/MinHeap.ts`. Available for Alishba's routing, MST and top-k, and Jibran's event queue. This structure is independent of the shared graph/game records and does not freeze `types.ts` or `config.ts`.

```ts
import { MinHeap } from '../../structures/MinHeap';

type Entry = { vertex: number; cost: number; sequence: number };
const frontier = new MinHeap<Entry>(
  (a, b) => a.cost - b.cost || a.sequence - b.sequence,
);

frontier.push({ vertex: 1, cost: 4, sequence: 0 });
const next = frontier.pop();
const metrics = frontier.counters;
```

Adjust the relative import to the consuming module. The comparator returns a negative number when its first argument should be extracted first, zero for an equal key and a positive number otherwise. It must define a consistent order. Reject invalid priorities such as NaN at the consuming API boundary. Do not mutate queued objects' priority fields. Equal keys are not inherently stable; include deterministic tie-breakers where required.

| API | Behavior | Complexity |
| --- | --- | --- |
| `new MinHeap(compare, initial?)` | Copies an optional iterable and heapifies bottom-up | O(n) time/space for n initial entries |
| `push(value)` | Inserts a value | O(log n) time |
| `pop()` | Extracts minimum, or returns undefined when empty | O(log n) time |
| `peek()` | Reads minimum, or undefined when empty | O(1) |
| `size`, `isEmpty` | Read-only accessors | O(1) |
| `counters` | Returns a copy of the operation counters | O(1) |
| `resetCounters()` | Resets metrics without changing queued entries | O(1) |
| `toArray()` | Returns a shallow array copy in heap order, not sorted order | O(n) |

The heap uses O(n) storage and O(1) auxiliary working space per push/pop. Array growth may allocate backing storage. Snapshot entries are not deep-cloned; callers must treat them as immutable.

## Counters and trace integration

- `pushes`/`pops`: successful public insertions/extractions. Empty pop does not count.
- `heapOps`: `pushes + pops`. Peek, snapshots, reset and bulk construction do not increment it.
- `comparisons`: actual calls to the supplied comparator, including heap construction.
- `swaps`: actual pair exchanges, including construction. Replacing the root with the final item is not counted as a swap.
- Initial construction comparisons/swaps remain visible until reset. Reset after construction when an experiment excludes initialization; record that decision.

Routing/event algorithms should copy the appropriate heap counters into their algorithm counters and emit their own domain trace steps. The heap does not know vertex/edge IDs, events or the shared trace schema. The current Lab renders completed heap operations; internal sift playback is not implemented yet.

## Reuse patterns

- Events: `(triggerTime, priority, insertionSequence)` ascending. Cancellation belongs to the queue wrapper, which skips cancelled entries on extraction.
- Dijkstra/A*: push a new immutable entry when a priority improves, then discard stale entries on extraction. No decrease-key method is currently provided.
- Prim: order candidate edges by weight with deterministic edge-ID/sequence ties.
- Size-k top-k: reverse the championship comparator to keep the worst retained candidate at the root, then replace it only when a better entry arrives. Convert the retained heap to the required final order using the shared ranking implementation.

## Correctness and tests

Invariant: every parent compares less than or equal to each child. Push restores it along the new leaf's ancestor path; pop replaces the root with the final leaf and restores it down one path. Therefore the root is always a minimum. Bottom-up construction restores subtrees from the final internal node to the root.

Tests cover empty/singleton, ascending/descending/duplicate/negative values, a reversed comparator, event tie ordering, independent snapshots, exact counter behavior, linear construction comparison bounds and 2,000 seeded interleaved operations against a sorted reference and the parent-child invariant.
