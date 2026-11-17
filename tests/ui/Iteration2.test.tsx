// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackExplorer } from '../../src/ui/screens/track-explorer/TrackExplorer';
import { SearchLab } from '../../src/ui/screens/algorithm-lab/SearchLab';
import { EventLab } from '../../src/ui/screens/algorithm-lab/EventLab';

afterEach(() => vi.useRealTimers());

describe('Explorer integration', () => {
  it('recalculates paths after closures and handles unreachable/source-equals-target states', () => {
    render(<TrackExplorer showLabels />);
    fireEvent.change(screen.getByLabelText('Destination vertex'), { target: { value: '1' } });
    expect(screen.getByRole('status')).toHaveTextContent('0 → 1 · 1 edges');
    fireEvent.click(screen.getByRole('button', { name: 'Block selected road' }));
    expect(screen.getByRole('status')).not.toHaveTextContent('0 → 1 · 1 edges');
    fireEvent.change(screen.getByLabelText('Road', { exact: true }), { target: { value: 'road-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Block selected road' }));
    expect(screen.getByRole('status')).toHaveTextContent('No route reaches this destination');
    expect(screen.getByText('0 of 10 checkpoints reachable from vertex 0.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore road layout' }));
    expect(screen.getByRole('status')).toHaveTextContent('0 → 1 · 1 edges');
    fireEvent.change(screen.getByLabelText('Start vertex'), { target: { value: '1' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 · 0 edges');
  });

  it('selects a genuine alternative and resets its selection when endpoints change', () => {
    render(<TrackExplorer showLabels />);
    fireEvent.click(screen.getByRole('button', { name: /Alternative 1/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Alternative 1:');
    expect(document.querySelectorAll('.map-road.highlighted').length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('Destination vertex'), { target: { value: '2' } });
    expect(screen.getByRole('status')).toHaveTextContent('BFS minimum-edge route:');
  });
});

describe('trace replay', () => {
  it('steps, plays, pauses, changes speed, resets and clears old runs on new inputs', () => {
    vi.useFakeTimers();
    render(<SearchLab showLabels />);
    expect(screen.getByRole('status')).toHaveTextContent('Ready.');
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(screen.getByRole('status')).toHaveTextContent('PUSH vertex 0');
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
    expect(screen.getByRole('button', { name: 'Step', exact: true })).toBeDisabled();
    act(() => vi.advanceTimersByTime(600));
    fireEvent.click(screen.getByRole('button', { name: 'Pause', exact: true }));
    const paused = screen.getByRole('status').textContent;
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole('status').textContent).toBe(paused);
    fireEvent.change(screen.getByLabelText('Playback speed'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
    act(() => vi.advanceTimersByTime(20000));
    expect(screen.getByRole('status')).toHaveTextContent('Traversal complete.');
    expect(screen.getByRole('button', { name: 'Step', exact: true })).toBeDisabled();
    expect(vi.getTimerCount()).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Reset replay' }));
    expect(screen.getByRole('status')).toHaveTextContent('Ready.');
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    fireEvent.change(screen.getByLabelText('Algorithm', { exact: true }), { target: { value: 'dfs' } });
    expect(screen.getByRole('status')).toHaveTextContent('Ready.');
    fireEvent.change(screen.getByLabelText('Start vertex'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Step', exact: true }));
    expect(screen.getByRole('status')).toHaveTextContent('PUSH vertex 3');
  });

  it('cleans up a playing timer when leaving the viewer', () => {
    vi.useFakeTimers();
    const { unmount } = render(<SearchLab showLabels />);
    fireEvent.click(screen.getByRole('button', { name: 'Play', exact: true }));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('event simulation', () => {
  it('demonstrates cancellation, priority order, independent expiry and nitro collection', () => {
    render(<EventLab showLabels />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel 10 s blockage' }));
    expect(screen.getByRole('status')).toHaveTextContent('Cancelled the road-0 blockage');
    fireEvent.click(screen.getByRole('button', { name: 'Next timestamp' }));
    expect(screen.getByRole('status')).toHaveTextContent('Clock advanced to 2 s.');
    fireEvent.click(screen.getByRole('button', { name: 'Next timestamp' }));
    expect(screen.getByRole('status')).toHaveTextContent('Clock advanced to 5 s.');
    expect(screen.getByText('road-5 difficulty').parentElement).toHaveTextContent('5 / 5');
    expect(screen.getByText('road-5 speed cap').parentElement).toHaveTextContent('15');
    fireEvent.click(screen.getByRole('button', { name: 'Collect nitro' }));
    expect(screen.getByRole('status')).toHaveTextContent('Nitro collected.');
    expect(screen.getByRole('button', { name: 'Collect nitro' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next timestamp' }));
    expect(screen.getByRole('status')).toHaveTextContent('Clock advanced to 13 s.');
    expect(screen.getByText('road-5 difficulty').parentElement).toHaveTextContent('3 / 5');
    expect(screen.getByText('road-5 speed cap').parentElement).toHaveTextContent('15');
    expect(document.querySelectorAll('.event-batch')[1].textContent).toMatch(/block-road.*close-shortcut.*severe-oil.*speed-cap.*station-offline.*nitro-ready/);
    fireEvent.click(screen.getByRole('button', { name: 'Reset scenario' }));
    expect(screen.getByRole('button', { name: 'Cancel 10 s blockage' })).toBeEnabled();
    expect(screen.getByText('road-5 difficulty').parentElement).toHaveTextContent('2 / 5');
  });
});
