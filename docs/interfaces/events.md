# Event queue and resolution handoff

Implemented in `src/core/events/EventQueue.ts` and `EventProcessor.ts`. The interfaces are provisional adapters for Alishba's graph/engine; joint shared types and race configuration remain open. Core code imports no rendering libraries and uses no wall clock or random IDs.

## Queue

`EventQueue<T>.schedule({eventId, triggerTime, priority, payload})` assigns an increasing insertion sequence. `cancel(eventId)` removes the live ID, and `popDue(time)` returns uncancelled events ordered by ascending `(triggerTime, priority, insertionSequence)`. Lower priority numbers fire first. `peek`, live `size`, backing `storageSize`, heap counters and counter reset are available. Invalid IDs/times/priorities are rejected, and an ID may not be reused within one queue instance.

Cancellation is lazy: the pending-ID map is the authoritative cancellation marker, while the heap entry remains until it reaches the top. `peek()` may discard cancelled entries and therefore increment extraction counters; callers must not read it as a side-effect-free rendering operation. Snapshots copy the envelope, not arbitrary generic payloads: treat payloads as immutable. `EventProcessor` copies its flat effect payloads when scheduled.

Schedule/extraction costs O(log n) per heap operation; a peek that discards c cancelled entries costs O(c log n), otherwise O(1). Cancellation is O(1) expected map work. Retained cancelled entries occupy heap memory until drained; the used-ID set costs O(total scheduled events) for the queue lifetime. Counters include actual discarded heap entries. This is the explicit simplicity/memory trade-off, rather than an indexed decrease-key/removal heap.

## Processor

Supply `EventWorld` with `getEdge`, `getVertex`, `setEdgeState` and `setVertexActive`. Edge state includes status, difficulty, optional speed cap and shortcut eligibility; service vertices include kind and active state. The engine adapter must apply effective speed caps to travel time and the optimized route cost. The processor does not calculate weighted costs, move racers or enforce fuel/nitro capacities.

Public methods/accessors:

- `schedule({eventId, triggerTime, effect})`: validate now, assign the brief's fixed priority, copy the payload and enqueue.
- `cancel(eventId)`: cancel a pending user event; return false for a fired/unknown event. Internal expiry IDs cannot be cancelled through this API.
- `advanceTo(time)`: move monotonically through all due timestamp batches, returning outcomes and changed-target IDs after complete batches. Validate target eligibility again at firing; invalidated targets are skipped with a reason.
- `nextTime`: next uncancelled timestamp, for engine stepping boundaries. This may clean cancelled heap heads; read during simulation updates and copy it into UI snapshots.
- `activeEffects`, `currentTime`, `pendingCount`, `counters`: copied state/metrics for integration.
- `collectNitro(vertexId)`: consume this processor instance's active pickup, remove all its active boosters and cancel their expiry entries. The engine must first validate racer capacity and pickup eligibility.

The event lab demonstrates these exact methods, not an alternative resolver.

## Effect definitions and provisional aggregation choices

| Priority | Effect | Payload |
| --- | --- | --- |
| 1 | `road-blockage` | edge ID, `blocked` boolean; persists until a later command |
| 2 | `shortcut` | shortcut edge ID, `open` boolean; persists until reversed |
| 3 | `oil-spill` | edge ID, positive duration, difficulty penalty 0–4, optional positive speed cap |
| 4 | `speed-restriction` | edge ID, positive duration and speed cap |
| 5 | `fuel-availability` | fuel station ID, positive duration and temporary active boolean |
| 6 | `nitro-booster` | pickup ID and positive duration; activate until collected or expired |

Durations/severity/caps are supplied explicitly; there are no hidden race defaults. Scenario fixtures are illustrative, not frozen config. Difficulty uses base difficulty plus the **maximum** active oil penalty, clamped to the model's 1–5 range. Effective speed cap is the **minimum** of the base cap and all active caps. Blocked status wins over restrictions; an active cap makes an otherwise traversable edge Restricted. Clearing a blockage does not remove oil or speed effects.

Permanent edge-status commands update the captured base status in heap application order; the last command wins, including blockage versus shortcut commands on the same shortcut. Temporary effects never overwrite that base. Fuel availability uses the latest surviving applied override, falling back to baseline availability when all overrides expire. Nitro boosters independently activate a pickup; collection consumes all currently active boosts so an expiry cannot resurrect the pickup. Whether pickup instances are global or per racer is an engine-scope decision; use the appropriate processor/world instance and document it jointly.

Baseline state is captured before the first effect on a target. After that, dynamic writes to touched targets must flow through this processor; out-of-band changes to the world would bypass the baseline. The engine should provide valid baseline difficulty/status/cap units. Review these provisional choices with Alishba before freezing them.

## Expiry and race tick contract

Every successfully applied temporary event schedules `@expiry/<original event ID>` at trigger time plus duration. The expiry inherits the original effect priority and receives its own sequence at scheduling time. User IDs cannot use that reserved prefix. A previously queued same-time, same-priority user event therefore precedes an expiry scheduled later. Each expiry removes only its own contribution and recomputes state from remaining effects. The tests cover both overlap and new-effect/expiry ties.

The engine should enqueue known events before processing a tick, step car motion to `nextTime`, apply the whole timestamp using `advanceTo(nextTime)`, then reroute from the updated graph if relevant edge IDs changed, and continue to the tick end. Never reroute inside the per-event loop. If many timestamps are processed in one `advanceTo` call, the final world is at the final time; returned batch records do not preserve intermediate world snapshots. Use event-boundary stepping when movement/recalculation must observe those intermediate states. Backward time and past scheduling are rejected.

Current event batches are a domain event trace, while BFS/DFS use the generic algorithm-step envelope. Event playback advances timestamps; it does not animate internal heap comparisons. The future real engine and routing adapters remain pending, so final gameplay integration is not yet claimed.

## Complexity and correctness

Heap ordering gives deterministic delivery. Unique effect IDs ensure expiry removes exactly one contribution; full recomputation ensures another active effect survives. Targets are checked at schedule and execution, cancellation suppresses processing, and generated expiries are handled even when advancing across large time jumps.

With A active temporary effects, current target recomputation scans A entries per applied/expired event, in addition to O(log n) heap operations. State storage includes pending/retained queue entries, used IDs, A effects and baseline entries for touched targets. The queue benchmark must time queue operations separately from effect resolution and state/UI work.

Tests cover all six types, time/priority/sequence ties, lazy cancellation, ID reuse, invalid targets/values, target deletion before firing, overlapping oil/caps/stations, deterministic expiry ties, nitro collection, persistent closure survival and incremental-versus-jump equivalence.
