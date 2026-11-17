import { describe, expect, it, vi } from 'vitest';
import { defaultLabInputs, executeLabAlgorithm, labTraceCsv, parseLabTrace, validateLabRegistry } from '../../src/ui/adapters/algorithm-lab';
import type { LabAlgorithm } from '../../src/ui/adapters/algorithm-lab';
import { builtinLabAlgorithms } from '../../src/ui/adapters/builtin-lab-algorithms';
import { previewTrack } from '../../src/ui/fixtures/preview-track';
import { bfs } from '../../src/core/algorithms/exploration/bfs';
import { explorationAdapter } from '../../src/ui/adapters/exploration-adapter';

const algorithm = (id: string) => builtinLabAlgorithms.find((entry) => entry.id === id)!;
const execute = (id: string, inputs?: Record<string, string>) => executeLabAlgorithm(algorithm(id), inputs ?? defaultLabInputs(algorithm(id), previewTrack), previewTrack, new AbortController().signal);

describe('shared core trace adapters', () => {
  it('captures the same BFS counters/path as production traversal and snapshots input state', async () => {
    const result = await execute('bfs');
    const actual = bfs(explorationAdapter(previewTrack), 0);
    expect(result.steps.at(-1)?.counters).toEqual(actual.counters);
    expect(result.steps.filter((step) => step.type === 'done')).toHaveLength(1);
    expect(result.summary.reachable).toBe(true);
    expect(result.track).not.toBe(previewTrack);
    const imported = parseLabTrace(JSON.stringify(result)); expect(imported).toEqual(result);
    expect(labTraceCsv(result)).toContain('expandedVertices');
    const offset = { ...previewTrack, vertices: previewTrack.vertices.map((vertex) => ({ ...vertex, id: vertex.id + 100 })), roads: previewTrack.roads.map((road) => ({ ...road, from: road.from + 100, to: road.to + 100 })) };
    expect(defaultLabInputs(algorithm('dfs'), offset).source).toBe('100');
  });

  it('shows real heap construction and event tie/cancellation operations', async () => {
    const heap = await execute('min-heap', { values: '[5, 1, 1, -2]', construction: 'heapify' });
    expect(heap.summary.extracted).toBe('-2, 1, 1, 5');
    expect(heap.steps.at(-1)?.counters).toMatchObject({ pushes: 0, pops: 4, heapOps: 4 });
    const events = await execute('event-queue');
    expect(events.summary.order).toBe('priority, tie-a, tie-b, late');
    const cancelled = events.steps.find((step) => step.type === 'cancel')!;
    expect(cancelled.state).toMatchObject({ liveEvents: 4, retainedHeapEntries: 5 });
    expect(events.steps.at(-1)?.counters.pops).toBe(5);
    expect(events.steps.at(-1)?.state).toMatchObject({ liveEvents: 0, retainedHeapEntries: 0 });
  });

  it('handles empty data and rejects malformed algorithm inputs through the real core', async () => {
    expect((await execute('min-heap', { values: '[]', construction: 'insert' })).summary.count).toBe(0);
    expect((await execute('event-queue', { events: '[]' })).summary.firedEvents).toBe(0);
    await expect(execute('bfs', { source: '99999', target: '0' })).rejects.toThrow(/existing/);
    await expect(execute('min-heap', { values: '[1,"x"]', construction: 'insert' })).rejects.toThrow(/finite numbers/);
    await expect(execute('event-queue', { events: '[{"id":"x","time":-1,"priority":1}]' })).rejects.toThrow(/event time/);
  });

  it('delegates to injected adapters, preserves table states and rejects duplicate IDs', async () => {
    const run: LabAlgorithm['run'] = vi.fn((_inputs, { emit }) => { emit({ type: 'done', message: 'Test table output', counters: { cells: 1 }, table: { columns: ['Item', 'Value'], rows: [['test', 3]] } }); return { total: 3 }; });
    const adapter: LabAlgorithm = { id: 'table-test', title: 'Table adapter test', family: 'resources', description: 'Test fixture, not a DP implementation.', usesTrack: false, fields: [], counterDescriptions: { cells: 'Test cells' }, run };
    const result = await executeLabAlgorithm(adapter, {}, previewTrack, new AbortController().signal);
    expect(run).toHaveBeenCalledOnce(); expect(result.steps[0].table?.rows).toEqual([['test', 3]]);
    expect(() => validateLabRegistry([adapter, adapter])).toThrow(/unique/);
  });

  it('freezes the input map and copies frames before an adapter mutates its working array', async () => {
    const adapter: LabAlgorithm = { ...algorithm('min-heap'), id: 'snapshot-test', fields: [], run(_input, { track, emit }) {
      expect(Object.isFrozen(track.vertices[0])).toBe(true);
      const array = [{ label: '0', value: 5 }];
      emit({ type: 'visit', message: 'Original', counters: { operations: 1 }, array });
      array[0].value = 9;
      emit({ type: 'done', message: 'Changed', counters: { operations: 2 }, array });
      return {};
    } };
    const trace = await executeLabAlgorithm(adapter, {}, previewTrack, new AbortController().signal);
    expect(trace.steps[0].array?.[0].value).toBe(5);
    expect(trace.steps[1].array?.[0].value).toBe(9);
  });
});

describe('bounded execution and imported trace validation', () => {
  it('rejects malformed maps, cells, incomplete traces and noncumulative counters', async () => {
    const original = await execute('bfs');
    for (const modify of [
      (value: typeof original) => { value.steps[1].counters.comparisons = -1; },
      (value: typeof original) => { value.steps.pop(); value.steps.pop(); },
      (value: typeof original) => { value.steps[0].graph = { vertex: 999999 }; },
      (value: typeof original) => { value.track!.vertices = [value.track!.vertices[0], value.track!.vertices[0]]; },
      (value: typeof original) => { value.steps[0].table = { columns: ['x'], rows: [[1, 2]] }; },
      (value: typeof original) => { value.steps[0].counters = { different: 1 }; },
    ]) { const value = structuredClone(original); modify(value); expect(() => parseLabTrace(JSON.stringify(value))).toThrow(/Invalid algorithm trace/); }
    expect(() => parseLabTrace(' '.repeat(5_000_001))).toThrow(/5 MB/);
    expect(() => parseLabTrace('{}')).toThrow(/Invalid algorithm trace/);
  });

  it('cancels execution and enforces a step limit without returning a partial successful trace', async () => {
    const controller = new AbortController(); controller.abort();
    await expect(executeLabAlgorithm(algorithm('bfs'), { source: '0', target: '1' }, previewTrack, controller.signal)).rejects.toThrow(/cancelled/);
    const excessive: LabAlgorithm = { ...algorithm('min-heap'), id: 'limit-test', fields: [], run(_inputs, { emit }) { for (let i = 0; i < 10001; i++) emit({ type: 'visit', message: '', counters: {} }); return {}; } };
    await expect(executeLabAlgorithm(excessive, {}, previewTrack, new AbortController().signal)).rejects.toThrow(/10000/);
    const broken: LabAlgorithm = { ...excessive, run: () => ({ value: NaN }) };
    await expect(executeLabAlgorithm(broken, {}, previewTrack, new AbortController().signal)).rejects.toThrow(/Invalid algorithm trace/);
  });
});
