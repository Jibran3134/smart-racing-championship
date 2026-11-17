// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RaceSetup } from '../../src/ui/screens/racing/RaceSetup';
import { demoSetupProvider } from '../../src/ui/fixtures/demo-setup-provider';
import { createDrivingDemo } from '../../src/ui/fixtures/driving-demo';
import type { RaceDriver } from '../../src/ui/adapters/race-view';
import type { RaceSetupProvider } from '../../src/ui/adapters/race-setup';

describe('race setup controls', () => {
  it('prepares the selected demo settings and delegates the selected circuit to Explorer', async () => {
    const prepared = vi.fn(), explore = vi.fn();
    render(<RaceSetup mode="quick" provider={demoSetupProvider} showLabels onPrepared={prepared} onExplore={explore} />);
    expect(screen.getByLabelText('Route preset')).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Laps'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Starting nitro'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Timed track events' }));
    fireEvent.click(screen.getByRole('button', { name: 'Explore selected circuit' })); expect(explore).toHaveBeenCalledWith(demoSetupProvider.circuits[0].track);
    fireEvent.click(screen.getByRole('button', { name: 'Start driving demo' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
    expect(prepared.mock.calls[0][1]).toMatchObject({ laps: 3, initialNitro: 0, eventsEnabled: false });
    expect(prepared.mock.calls[0][0].getState().totalLaps).toBe(3);
  });

  it('requires an explicit feasible resource plan and invalidates it after input changes', async () => {
    const circuit = { ...demoSetupProvider.circuits[0], kind: 'live' as const, presets: ['balanced' as const, 'safety' as const] };
    const createRace = vi.fn<RaceSetupProvider['createRace']>((request) => ({ ...createDrivingDemo({ laps: request.laps, initialNitro: request.initialNitro }), kind: 'live' }));
    const provider: RaceSetupProvider = { circuits: [circuit], createRace, getRecommendations: () => ({ required: true, plans: [
      { id: 'dp', label: 'DP plan', method: 'dp', feasible: true, explanation: 'Test resource output.', items: ['Item A'], cost: 5, budget: 10, budgetLabel: 'units' },
      { id: 'greedy', label: 'Greedy plan', method: 'greedy', feasible: false, explanation: 'Not enough fuel.', items: [], cost: 0, budget: 10, budgetLabel: 'units' },
    ] }) };
    const prepared = vi.fn(); render(<RaceSetup mode="quick" provider={provider} showLabels onPrepared={prepared} onExplore={() => {}} />);
    expect(screen.getByRole('button', { name: 'Prepare race' })).toBeDisabled();
    expect(screen.getByLabelText('Select Greedy plan')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select DP plan')); expect(screen.getByRole('button', { name: 'Prepare race' })).toBeEnabled();
    fireEvent.change(screen.getByLabelText('Route preset'), { target: { value: 'safety' } });
    expect(screen.getByRole('button', { name: 'Prepare race' })).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Select DP plan')); fireEvent.click(screen.getByRole('button', { name: 'Prepare race' }));
    await waitFor(() => expect(prepared).toHaveBeenCalledOnce());
    expect(createRace.mock.calls[0][0]).toMatchObject({ preset: 'safety', resourcePlanId: 'dp' });
  });

  it('cancels pending preparation and ignores its eventual result', async () => {
    let resolve: (driver: RaceDriver) => void = () => {};
    const createRace = vi.fn<RaceSetupProvider['createRace']>(() => new Promise((complete) => { resolve = complete; }));
    const prepared = vi.fn(); render(<RaceSetup mode="quick" provider={{ ...demoSetupProvider, createRace }} showLabels onPrepared={prepared} onExplore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start driving demo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel preparation' }));
    expect(createRace.mock.calls[0][1]?.aborted).toBe(true);
    await act(async () => { resolve(createDrivingDemo()); }); expect(prepared).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Start driving demo' })).toBeEnabled();
  });

  it('keeps a failed preparation retryable and enforces engine-selected championship order', async () => {
    const createRace = vi.fn<RaceSetupProvider['createRace']>().mockRejectedValueOnce(new Error('Resource service unavailable')).mockImplementation(() => createDrivingDemo());
    const { unmount } = render(<RaceSetup mode="quick" provider={{ ...demoSetupProvider, createRace }} showLabels onPrepared={() => {}} onExplore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start driving demo' }));
    await screen.findByRole('alert'); expect(screen.getByRole('button', { name: 'Start driving demo' })).toBeEnabled(); unmount();
    const provider: RaceSetupProvider = { circuits: [{ ...demoSetupProvider.circuits[0], kind: 'live' }], championshipCircuitId: 'driving-demo', createRace };
    render(<RaceSetup mode="championship" provider={provider} showLabels onPrepared={() => {}} onExplore={() => {}} />);
    expect(screen.getByLabelText('Circuit')).toBeDisabled();
  });
});
