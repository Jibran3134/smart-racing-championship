# Shared Algorithm Lab workbench handoff

Iteration 6, 17 November 2026. The UI adapter lives in `src/ui/adapters/algorithm-lab.ts`. It is separate from the jointly owned core records/configuration and does not freeze them.

## Open and use

Open **Algorithm Lab → Algorithm workbench**. Choose a connected function, edit its inputs and press **Run algorithm**. Capture happens once; Play/Next/Previous/seek read saved snapshots. Input or current-track changes invalidate an executed trace. Switching algorithm, resetting inputs or rerunning remounts the player at step zero.

The default adapters call the actual core implementations:

| Adapter | Existing core call | Recorded boundaries |
| --- | --- | --- |
| BFS | `bfs` and parent reconstruction | Production exploration trace callbacks and final path |
| DFS | `dfs` and parent reconstruction | Production trace callbacks, final tree path and source-reachable cycle result |
| Generic min-heap | `MinHeap` | After construction, each push/pop and final empty state |
| Event queue | `EventQueue` | After scheduling/cancelling and each due-time drain |

Heap/event snapshots are public-operation boundaries, not fabricated internal sift steps. Their cumulative counters still include the actual comparator calls/swaps inside those operations. Heap array order is not a sorted array. Bottom-up heapify does not count synthetic pushes. Event lazy cancellation retains heap entries until they rise; the final drain's pop count includes cancelled entries. Effects remain available in the separate Event simulation workspace.

BFS minimizes edge count, not weighted cost. DFS exposes its parent path without a shortest-path guarantee. The trace player does not advance a race and the trace's allocations are not experiment timings.

## Connect the remaining algorithms

Pass stable `LabAlgorithm` adapters through `App.labAlgorithms` or directly to `AlgorithmLab.algorithms`. The built-ins remain present. IDs must be unique; an invalid registry reports an error and leaves the built-ins usable. Known routing/resource/ranking/generation slots remain disabled until the matching adapter is supplied. No substitute algorithm is implemented in a component.

```tsx
<App labAlgorithms={[routingAdapter, resourceAdapter, rankingAdapter, generationAdapter]} />
```

Each adapter provides:

- Stable lowercase/hyphen ID, title, family, description, `usesTrack` and counter definitions.
- Input fields of type `vertex`, `number`, `select` or `json`, with labels/defaults and optional numeric bounds/selection options. Input values are strings; the adapter converts and validates its domain-specific data before calling core. JSON syntax alone is not a resource/graph feasibility check.
- `run(inputs, {track, signal, emit})`, which calls the same core function used by gameplay and returns a JSON-cell summary, synchronously or as a promise.

The context track is a cloned, frozen map snapshot. Build a separate core graph from it; do not mutate it. For a generation candidate or changing graph, emit a per-frame `graph.track` snapshot with its new vertex/road IDs. Keep adapters stable for a workbench session. Replacing an adapter invalidates its executed trace even when its ID is unchanged.

The workbench does not provide DP, Greedy, sorting, MST or routing implementations. Their authors must supply actual core calls, input validation, physical rules and counter semantics. It does not claim that a callable adapter alone proves gameplay integration or algorithm correctness.

## Step and result shape

`LabStep` has a type, message and fixed-key cumulative nonnegative safe-integer counters. Types can describe operations such as visit, relax, compare, swap, choose, reject or DP-cell updates. Finish with exactly one `done` step at the end.

Optional snapshot views:

- `graph`: active vertex/edge, frontier/visited IDs, route edge IDs, and an optional complete map override. References must exist in the corresponding map.
- `array`: labelled finite numeric values with an optional active flag, suitable for heap/sort order.
- `table`: column labels and rectangular primitive-cell rows, suitable for resource states, ranking, event status and generation decisions.
- `state`: named primitive scalar values. The final returned summary is displayed when playback reaches the end.

Primitive cells are strings, finite numbers, booleans or null. Snapshots are copied on emit so later mutation cannot rewrite earlier steps. Cumulative counter keys cannot disappear or reset midway; adapt per-phase counters into explicitly documented cumulative values where necessary.

Playback has previous/next/play/pause/reset/result controls, a seek slider and three speeds. Hidden-tab events pause it. Unmount/reset clears the active timer. Changing playback speed changes only display timing, never algorithm inputs or counters.

## Bounds, cancellation and async work

Capture accepts at most 10000 steps, with an approximate 4.5 MB frame-content limit so the exported trace can fit within 5 MB including metadata. Map snapshots are limited to 500 vertices/5000 roads; arrays to 200 values; tables to 20 columns/250 rows; text cells/messages to 2000 characters. Built-in event inputs allow 100 events. Large inputs fail with a readable message rather than publishing a partial successful trace.

Async adapters receive an AbortSignal. Cancellation/unmount aborts the signal; late results are ignored. An adapter using workers or network resources must observe the signal and release its own resources. Synchronous computation cannot be interrupted by a browser click while it blocks the event loop; emit/size checks bound capture, but expensive algorithms should use a worker-backed adapter. A failed/cancelled capture does not leave a playable partial result.

## Trace evidence and exports

`LabTrace` uses `schemaVersion: 1`, `format: "algorithm-trace"`, algorithm identity/family, capture timestamp, inputs, counter descriptions, optional map snapshot, steps and summary. This is a teaching/debugging trace format, distinct from benchmark evidence and championship results.

JSON export preserves snapshots and metadata. CSV exports each step's type/message/counters and scalar state JSON; array/table/map snapshots remain in JSON. CSV uses the shared quoting/spreadsheet-text handling. These files are downloaded by the browser and are not committed as generated study outputs.

Import is a bounded, read-only replay: it validates structure, map IDs, cell types, counter monotonicity and completion but does not execute a function, prove optimality or authenticate edited evidence. The UI labels imported traces explicitly. Invalid files retain the prior displayed trace. Import never loads JavaScript or installs an adapter.

## Verification

Tests compare recorded BFS counters with the production function, verify real heapify/event ties/cancellation, check empty/invalid inputs and nonzero vertex defaults, and exercise injected table adapters, duplicate IDs, malformed maps/cells, incomplete traces, step limits and abort handling. UI tests cover exports/import provenance, input invalidation, async cancellation, seeking, back-step, hidden-tab pause and timer cleanup. Browser checks use actual core traces and JSON/CSV downloads at desktop/mobile widths.
