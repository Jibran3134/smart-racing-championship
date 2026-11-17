// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExperimentLab } from '../../src/ui/screens/algorithm-lab/ExperimentLab';
import { experimentFixture } from '../fixtures/experiment';
import { downloadText } from '../../src/ui/components/common/download';
vi.mock('../../src/ui/components/charts/SeriesChart', () => ({ SeriesChart: ({ label }: { label: string }) => <div>{label}</div> }));
vi.mock('../../src/ui/components/common/download', () => ({ downloadText: vi.fn() }));

function upload(text: string) {
  const file = new File([text], 'results.json', { type: 'application/json' });
  Object.defineProperty(file, 'text', { value: async () => text });
  fireEvent.change(screen.getByLabelText('Import experiment results'), { target: { files: [file] } });
}

describe('measured experiment results workspace', () => {
  it('starts without fabricated timings, imports evidence and exports raw measurements', async () => {
    render(<ExperimentLab />);
    expect(screen.getByText(/No example timings/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export raw CSV' })).not.toBeInTheDocument();
    upload(JSON.stringify(experimentFixture()));
    await screen.findByRole('heading', { name: 'Test exploration' });
    expect(screen.getByText('10 measured samples')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Experiment metric'), { target: { value: 'visitedVertices' } });
    await screen.findByText('Mean visitedVertices');
    fireEvent.click(screen.getByRole('button', { name: 'Export raw CSV' }));
    expect(downloadText).toHaveBeenCalledWith('experiment-1.raw.csv', expect.stringContaining('runtimeMs,visitedVertices'), 'text/csv;charset=utf-8');
    upload('{}');
    await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: 'Test exploration' })).toBeInTheDocument();
  });

  it('marks failed checks rather than treating imported timings as verified', async () => {
    render(<ExperimentLab />); const bundle = experimentFixture(); bundle.checks[0].passed = false;
    upload(JSON.stringify(bundle));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('failed correctness checks'));
    expect(screen.getByText('0 / 1 passed')).toBeInTheDocument();
  });
});
