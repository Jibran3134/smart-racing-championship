// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlgorithmWorkbench } from '../../src/ui/screens/algorithm-lab/AlgorithmWorkbench';
import { AlgorithmTracePlayer } from '../../src/ui/components/algorithm-viewer/AlgorithmTracePlayer';
import { builtinLabAlgorithms } from '../../src/ui/adapters/builtin-lab-algorithms';
import { defaultLabInputs, executeLabAlgorithm } from '../../src/ui/adapters/algorithm-lab';
import type { LabAlgorithm, LabTrace } from '../../src/ui/adapters/algorithm-lab';
import { previewTrack } from '../../src/ui/fixtures/preview-track';
import { downloadText } from '../../src/ui/components/common/download';
vi.mock('../../src/ui/components/common/download', () => ({ downloadText: vi.fn() }));
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

describe('algorithm workbench', () => {
  it('runs real exploration, exposes result counters, exports and resets on input changes', async () => {
    render(<AlgorithmWorkbench track={previewTrack} showLabels />);
    expect(screen.getByRole('option', { name: 'Dijkstra' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Run algorithm' }));
    await screen.findByRole('button', { name: 'Go to result' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to result' }));
    expect(screen.getByRole('region', { name: 'Algorithm result' })).toHaveTextContent('Minimum number of edges');
    fireEvent.click(screen.getByRole('button', { name: 'Export trace JSON' }));
    expect(downloadText).toHaveBeenCalledWith('bfs.trace.json', expect.stringContaining('"format": "algorithm-trace"'), 'application/json');
    fireEvent.change(screen.getByLabelText('Start vertex'), { target: { value: '1' } });
    expect(screen.queryByRole('button', { name: 'Export trace JSON' })).not.toBeInTheDocument();
  });

  it('displays heap arrays and event tables and labels imported replay without executing it', async () => {
    render(<AlgorithmWorkbench track={previewTrack} showLabels />);
    fireEvent.change(screen.getByLabelText('Connected algorithm'), { target: { value: 'min-heap' } });
    fireEvent.change(screen.getByLabelText('Values JSON'), { target: { value: '[5,1,3]' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run algorithm' })); await screen.findByRole('button', { name: 'Next step' });
    fireEvent.click(screen.getByRole('button', { name: 'Next step' })); expect(screen.getByRole('group', { name: 'Algorithm array state' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Connected algorithm'), { target: { value: 'event-queue' } });
    fireEvent.click(screen.getByRole('button', { name: 'Run algorithm' })); await screen.findByRole('button', { name: 'Go to result' });
    fireEvent.click(screen.getByRole('button', { name: 'Go to result' })); expect(screen.getByRole('table')).toHaveTextContent('cancel-me');
    fireEvent.click(screen.getByRole('button', { name: 'Export trace JSON' })); const json = vi.mocked(downloadText).mock.calls.at(-1)![1];
    const file = new File([json], 'trace.json'); Object.defineProperty(file, 'text', { value: async () => json });
    fireEvent.change(screen.getByLabelText('Import algorithm trace'), { target: { files: [file] } });
    await screen.findByText(/Imported trace. Replayed as supplied/);
  });

  it('supports cancellable asynchronous adapters and ignores their late completion', async () => {
    let resolve: (value: Record<string, number>) => void = () => {};
    const run = vi.fn<LabAlgorithm['run']>(() => new Promise((complete) => { resolve = complete; }));
    const adapter: LabAlgorithm = { id: 'async-test', title: 'Async test', family: 'ranking', description: 'Test only.', usesTrack: false, fields: [], counterDescriptions: {}, run };
    render(<AlgorithmWorkbench track={previewTrack} showLabels algorithms={[adapter]} />);
    fireEvent.change(screen.getByLabelText('Connected algorithm'), { target: { value: 'async-test' } }); fireEvent.click(screen.getByRole('button', { name: 'Run algorithm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel execution' }));
    expect(run.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { resolve({ count: 1 }); });
    expect(screen.queryByRole('button', { name: 'Export trace JSON' })).not.toBeInTheDocument();
  });
});

describe('shared trace playback lifecycle', () => {
  it('seeks, steps backward, pauses on visibility change and clears playback timers', async () => {
    const algorithm = builtinLabAlgorithms[0];
    const trace = await executeLabAlgorithm(algorithm, defaultLabInputs(algorithm, previewTrack), previewTrack, new AbortController().signal);
    vi.useFakeTimers();
    const { unmount } = render(<AlgorithmTracePlayer trace={trace as LabTrace} showLabels />);
    fireEvent.click(screen.getByRole('button', { name: 'Play trace' }));
    act(() => { vi.advanceTimersByTime(600); }); expect(screen.getByLabelText('Trace position')).toHaveValue('2');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange')); expect(screen.getByRole('button', { name: 'Play trace' })).toBeInTheDocument();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent.click(screen.getByRole('button', { name: 'Previous step' })); expect(screen.getByLabelText('Trace position')).toHaveValue('1');
    fireEvent.change(screen.getByLabelText('Trace position'), { target: { value: '5' } }); expect(screen.getByLabelText('Trace position')).toHaveValue('5');
    fireEvent.click(screen.getByRole('button', { name: 'Play trace' })); unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
