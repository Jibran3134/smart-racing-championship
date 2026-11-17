# Technical report contribution draft

Prepared 17 November 2026. Merge and cross-review with the remaining team sections before producing the final report PDF. This is a contribution draft, not a claim that the three-circuit championship or all required algorithms are complete. The source requirements are [Project.pdf](../../Project.pdf) and [the division](../../DAA%20Project%20division.docx).

## 2. Introduction

Smart Racing Championship applies graph traversal, weighted route planning, resource optimization, event scheduling and ranking to a strategic racing game. The player follows legal road connections and uses nitro while navigating ordered checkpoints and resource constraints. The interface makes algorithm behavior inspectable through traversal replay, counters and event timelines.

The implementation uses TypeScript, React and Vite. Core algorithms are pure modules that operate on data adapters; they do not import React or browser rendering. This separation lets the game, Lab and Node experiments call the same functions. A recorded trace supports teaching and demonstration without changing algorithm decisions. The present application includes a functional supplied-route driving demo; optimized routing, the official opponent strategies and complete championship still require integration.

## 3. GUI and game-flow architecture

The application shell navigates Main Menu, Track Explorer, Racing, Algorithm Lab and Championship Dashboard. The Explorer calls BFS/DFS through a read-only graph view that supplies legal, unblocked arcs in deterministic order. The Lab shares these functions and adds a generic heap workspace, event simulation and an imported experimental-results workspace. The latter shows measured data rather than placeholder timing values.

The race driver owns simulation state and exposes start/step/getState/restart/nitro methods. One controller animation loop advances it with bounded frame deltas. Canvas renders detailed cars and the circuit from snapshots. Camera smoothing, lane offsets, cockpit instruments, engine voices and other effects remain presentation concerns. Pausing, hiding the browser tab or navigating away stops advancement; cleanup releases rendering and audio resources.

The dashboard and preset comparison accept providers. Ranking/top-k and optimized scalar route metrics belong to those providers rather than being recomputed in components. Labelled presentation fixtures help develop the interface but do not count as integrated championship results or experimental measurements. See [the presentation contract](../interfaces/game-presentation.md).

Iteration 5 adds circuit/loadout setup with abortable driver preparation and a resource-provider handoff. Only supported presets and feasible resource candidates can be selected, and changed inputs invalidate the previous plan. Completed sessions are copied into a ten-entry in-memory history, preserving engine order, finish times, DNF reasons and resources without awarding points. Their CSV/JSON exports now describe the session actually run; a separate example season is never opened automatically. See [the setup/results contract](../interfaces/race-setup-and-results.md).

## 5. Assigned algorithms: design, correctness and complexity

### Breadth-first search

```text
mark source discovered; queue = [source]; head = 0
while head < queue length:
    u = queue[head++]; record expansion
    for each legal outgoing arc (u,v):
        record examined arc
        if v is undiscovered:
            mark v; parent[v] = u; parentEdge[v] = arc
            append v to queue
return traversal, parents and counters
```

Vertices enter the queue at discovery, so each enters once. FIFO processing expands vertices in nondecreasing edge distance. When v is first discovered from u, any shorter path to v would have discovered it from an earlier level. Thus the parent chain is a minimum-edge path. This objective differs from minimum distance/time/scalar cost; a one-edge expensive road can be chosen instead of a cheaper multi-edge route.

The queue uses a head index, avoiding repeated array shifts. Ordinary traversal is O(V+E) time and O(V) auxiliary space, excluding the supplied graph and optional trace snapshots. Counters distinguish discovered/expanded vertices and examined adjacency arcs. An undirected road has two arcs. The full reachable component is explored even if a target path is later reconstructed.

### Depth-first search and components

```text
push source frame; color source gray
while frame stack is not empty:
    if top frame has no remaining neighbor:
        color its vertex black; pop frame
    else:
        inspect next arc (u,v)
        skip the undirected parent edge
        if v is gray: record cycle
        if v has no color:
            set parent and parent edge; color v gray; push its frame
```

The stack stores each vertex's next neighbor index, reproducing recursive DFS without risking the JavaScript call-stack limit. Gray vertices represent the active ancestor path. A gray neighbor detects a directed back edge; for an undirected graph the exact parent edge must be excluded, while a distinct parallel edge can still reveal a cycle. Cycle detection concerns only the source-reachable subgraph.

Each vertex is entered once and each adjacency arc examined once: O(V+E) time and O(V) auxiliary space for ordinary traversal. The component function builds an undirected adjacency view and starts a traversal at each unseen vertex. Its directed interpretation is weak connectivity, not strongly connected components.

Dead-end analysis is explicitly relative to the DFS arrival edge. A reachable non-mandatory vertex is tested for a continuation to the finish without reusing that edge; this can take O(V(V+E)). Bounded simple alternative-route enumeration can be exponential and is not covered by DFS's linear ordinary-traversal bound. Both bounds and semantics must remain distinct in the final report.

### Generic binary min-heap

```text
push(x): append x; swap upward while x precedes its parent
pop(): remove root; move last value to root; swap downward with earlier child
```

The heap invariant is that every parent is no later than its children according to the supplied comparator. Sift-up repairs only the new leaf-to-root path; sift-down repairs only the replaced root-to-leaf path. Therefore the root is the minimum element. Push and pop are O(log n), peek is O(1), retained array space is O(n), and bottom-up initial heap construction is O(n). Equal comparator keys are not stable unless the caller supplies a tie-breaker. Counters separately report pushes, pops, comparisons, swaps and `heapOps = pushes + pops`.

### Event scheduling and temporary effects

Events use the same heap with ascending `(triggerTime, priority, insertionSequence)` order. Lower priority numbers run first. Each schedule call receives a monotonically increasing sequence, making equal timestamp/priority events deterministic. A live-ID map supports lazy cancellation. Cancelled entries are discarded when they reach the top, so they cannot appear in `popDue` output. The ID-history set prevents reuse of an already allocated ID.

```text
schedule(event): validate ID/time/priority; assign sequence; push; mark live
cancel(id): remove id from live map
popDue(t):
    discard cancelled top entries
    while top timestamp <= t:
        pop minimum; remove live id; append to output
        discard cancelled top entries
```

Schedule and physical extraction are O(log n) per entry; a full drain is O(n log n). Live-ID deletion has expected O(1) map cost and does not immediately reduce heap storage. Pending/live maps use O(n) space; tombstones remain until they rise, and the used-ID history grows with all IDs scheduled during the queue lifetime.

The EventProcessor applies all same-time events before reporting changed targets for engine rerouting. Its six effect types match the brief. Temporary effects retain independent IDs and expiry actions. Effective oil penalty is the maximum active penalty; speed cap is the strictest active cap. Recomputing from the remaining effects preserves an overlapping effect when another expires. Nitro collection cancels this pickup's active effects/expiry IDs so an older expiry cannot reactivate it. Payloads, targets and monotonic simulation times are validated. See [event semantics](../interfaces/events.md).

Effect recomputation currently scans the active-effect collection for a target, so total processor work is not merely the queue's O(log n) cost. Keep queue microbenchmarks separate from effect-resolution cost.

## 6. Gameplay integration and visualization

Explorer and Lab use the same exploration functions. The supplied-route race imports EventProcessor directly, stepping through due event timestamps before movement and preserving an occupied road's legal completion policy. The complete graph/routing engine still needs to coordinate rerouting and effective costs using the agreed handoff. Provisional shared gameplay records remain unfrozen.

Trace playback stores deterministic snapshots and counters. Reset/input changes clear the previous replay. Trace snapshots copy frontier/visited data, increasing allocation and potentially total cost; experimental traversals disable tracing. Shared charts provide accessible tables and measured-result exports. Formula-style engine sounds use credited simulator audio assets with RPM/gear telemetry; these presentation effects do not provide algorithm evidence. Commentary was removed at the user's request.

## 7. Tests

Existing tests cover heap extraction against a reference ordering; singleton/empty/tied cases; directed/undirected traversal, cycles, components and dead ends; minimum-edge BFS versus weighted-route intuition; deterministic traces; event time/priority/sequence ties, cancellation, invalid targets and independent expiries; route-race laps, resources and time limits; UI playback, keyboard isolation and cleanup.

Iteration 4 adds seeded dataset reproducibility, independent traversal certificates, real event-processor expiry checks, exact queue phase counters, aggregate statistics, complete/duplicate run validation, CSV quoting/formula handling and UI import/export/error behavior. Run `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`. Browser review additionally loads actual measured files and checks chart filters, downloads, invalid-file retention and narrow layouts. State the final checked commit and test count at report freeze rather than treating this draft as permanent evidence of later changes.

Iteration 5 additionally checks complete configured two/three-lap runs, resource-plan invalidation, preparation cancellation, actual result capture/exports, navigation deduplication, restart history, nonzero circuit IDs and preset road direction/continuity. Browser tests exercised both development and production builds; accelerated test frame timestamps shortened race QA while retaining the engine's fixed simulation steps. No production fast-forward control or fabricated results were added.

## 8. Experiments 1 and 4

Use [the reproducible procedure](../experiments.md) and the generated `experiments/results/experiment-{1,4}.report.md` tables. Both default studies use two warm-ups and five measured repetitions. Experiment 1 alternates measured algorithm order on identical inputs; Experiment 4 separates insertion, cancellation and extraction and checks outputs outside each timing interval.

The first run produced 120 exploration and 105 event measurements, with 26 recorded correctness checks. At 1024 vertices the dense family had 127884 arcs, examined by both traversals. In the 10000-event lazy-cancellation case, 2500 live IDs were cancelled without heap operations; the heap retained all 10000 entries until extraction, which returned 7500 events and removed every heap entry. Exact timings, dispersion, environment and seed belong in the generated evidence rather than being fabricated or copied from a different machine.

Compare empirical growth to V+E and n log n respectively; do not infer a bound from one timing or claim universal speed superiority. Measurements include the JavaScript engine's allocation/JIT/GC effects, while initialization exclusions are documented in the result metadata. The remaining experiments must use the same machine/settings for comparable conclusions.

## Challenge 2 contribution and open work

The preset UI displays the same track/request under Balanced, Speed, Economy and Safety, provider-supplied weights and metrics, and coincident/unreachable states. Weighted scalar cost expresses a configured trade-off; it does not enumerate the Pareto frontier. Different presets' scalar scores should not be directly compared as if they used the same objective. The final demonstration still requires actual optimized routes and a real circuit where preset choices differ.

## References, acknowledgements and completion limits

The course brief and task division define required behavior. External runtime libraries are React, Vite, Tailwind CSS, Framer Motion and Recharts; algorithm implementations are handwritten. Vitest supports tests. Audio attributions and licenses ship under `public/audio/`. No algorithm library is installed. AI-assisted coding/documentation should be disclosed in the team acknowledgements according to the course policy; this draft has not been independently cross-reviewed by the teammate or instructor.

Before final submission: integrate the missing core modules/circuits; agree on shared rules; complete all five experiment studies, references and report sections; cross-review; compile the final report PDF; provide actual registration numbers/section; and inspect the extracted submission package. This contribution does not replace those gates.
