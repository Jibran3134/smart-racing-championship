// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RaceSession } from '../../src/ui/screens/racing/RaceSession';
import { createRecordedRace } from '../../src/ui/fixtures/recorded-race';
import { ChampionshipDashboard } from '../../src/ui/screens/championship-dashboard/ChampionshipDashboard';
import { exampleChampionship } from '../../src/ui/fixtures/example-championship';
import { PresetComparison } from '../../src/ui/components/map/PresetComparison';
import { previewTrack } from '../../src/ui/fixtures/preview-track';
import { projectCar } from '../../src/ui/components/map/map-model';
import type { PresetProvider, PresetRouteView } from '../../src/ui/adapters/preset-view';
import { routePresets } from '../../src/ui/adapters/preset-view';
import type { RaceDriver } from '../../src/ui/adapters/race-view';
import { formatRaceTime } from '../../src/ui/adapters/race-view';

let frames: Map<number, FrameRequestCallback>;
let frameId = 0;
beforeEach(() => {
  frames = new Map(); frameId = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

function frame(time: number) {
  const pending = [...frames.values()]; frames.clear();
  act(() => pending.forEach((callback) => callback(time)));
}

describe('race presentation', () => {
  it('renders replay resources/positions, seeks to DNF/finish and restarts without awarding points', () => {
    const results = vi.fn();
    render(<RaceSession driver={createRecordedRace()} showLabels onViewResults={results} />);
    expect(screen.getByText(/Illustrative snapshots only/)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /car$/ })).toHaveLength(4);
    expect(screen.getByRole('progressbar', { name: 'Fuel' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('button', { name: 'Activate nitro' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Preview timeline/), { target: { value: '28' } });
    expect(screen.getByText(/DNF · Insufficient fuel/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Fuel' })).toHaveAttribute('aria-valuenow', '60');
    fireEvent.change(screen.getByLabelText(/Preview timeline/), { target: { value: '36' } });
    expect(screen.getByText('Complete', { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View example dashboard' }));
    expect(results).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Restart session' }));
    expect(screen.getByRole('progressbar', { name: 'Fuel' })).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByRole('button', { name: 'Play preview' })).toBeEnabled();
    expect(frames.size).toBe(0);
  });

  it('owns one loop, clamps long frame gaps, pauses and cleans up on unmount', () => {
    const driver = createRecordedRace();
    const step = vi.spyOn(driver, 'step');
    const { unmount } = render(<RaceSession driver={driver} showLabels onViewResults={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play preview' }));
    expect(frames.size).toBe(1);
    frame(0); frame(2000);
    expect(step.mock.calls.at(-1)?.[0]).toBe(0.1);
    expect(frames.size).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Pause session' }));
    expect(frames.size).toBe(0);
    const clock = driver.getState().clock;
    frame(4000);
    expect(driver.getState().clock).toBe(clock);
    fireEvent.click(screen.getByRole('button', { name: 'Resume session' }));
    expect(frames.size).toBe(1);
    unmount();
    expect(frames.size).toBe(0);
  });

  it('delegates live nitro to the engine and stops on a driver failure', () => {
    const base = createRecordedRace();
    const activateNitro = vi.fn();
    const step = vi.fn();
    const live: RaceDriver = { ...base, kind: 'live', activateNitro, step };
    render(<RaceSession driver={live} showLabels onViewResults={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Start race', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Activate nitro' }));
    expect(activateNitro).toHaveBeenCalledOnce();
    step.mockImplementation(() => { throw new Error('Route unavailable'); });
    frame(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Route unavailable');
    expect(frames.size).toBe(0);
    expect(screen.getByRole('button', { name: 'Activate nitro' })).toBeDisabled();
  });

  it('renders a failed initial driver read as a recoverable state', () => {
    const base = createRecordedRace();
    const driver: RaceDriver = { ...base, getState: () => { throw new Error('Invalid track'); } };
    render(<RaceSession driver={driver} showLabels onViewResults={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid track');
    expect(screen.getByRole('button', { name: 'Retry race state' })).toBeEnabled();
  });

  it('projects only valid positions and formats missing/long lap times', () => {
    const car = { id: 1, label: 'You', color: '#fff', location: { edge: 'road-0', progress: 0.5 } };
    expect(projectCar(previewTrack, car)).toMatchObject({ x: 135, y: 320 });
    const forward = projectCar(previewTrack, car)!;
    expect(projectCar(previewTrack, { ...car, location: { ...car.location, reverse: true } })).toEqual({ ...forward, angle: forward.angle + 180 });
    expect(projectCar(previewTrack, { ...car, location: { vertex: 0 } })).toMatchObject({ x: 160, y: 390 });
    expect(projectCar(previewTrack, { ...car, location: { edge: 'missing', progress: 0.5 } })).toBeNull();
    expect(projectCar(previewTrack, { ...car, location: { edge: 'road-0', progress: 2 } })).toBeNull();
    expect(formatRaceTime(null)).toBe('—');
    expect(formatRaceTime(101.2)).toBe('01:41.2');
    expect(formatRaceTime(0)).toBe('00:00.0');
  });
});

describe('championship presentation', () => {
  it('refreshes on provider updates and unsubscribes when closed', async () => {
    let notify = () => {};
    let bonus = 0;
    const unsubscribe = vi.fn();
    const source = {
      ...exampleChampionship,
      kind: 'live' as const,
      getRanking: () => exampleChampionship.getRanking('merge').map((row) => ({ ...row, points: row.points + bonus })),
      subscribe: (listener: () => void) => { notify = listener; return unsubscribe; },
    };
    const { unmount } = render(<ChampionshipDashboard provider={source} onRace={() => {}} />);
    await screen.findByRole('group', { name: 'Championship points progression' }, { timeout: 5000 });
    const table = screen.getByRole('table', { name: 'Full championship ranking' });
    expect(within(table).getByText('61')).toBeInTheDocument();
    bonus = 1;
    act(() => notify());
    expect(within(table).getByText('62')).toBeInTheDocument();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  }, 10000);

  it('keeps example data opt-in and delegates method/top-k requests', async () => {
    const { unmount } = render(<ChampionshipDashboard onRace={() => {}} />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Preview example dashboard' }));
    expect(screen.getByText('EXAMPLE CHAMPIONSHIP')).toBeInTheDocument();
    await screen.findByRole('group', { name: 'Championship points progression' }, { timeout: 5000 });
    expect(screen.getByRole('table', { name: 'Full championship ranking' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide example data' }));
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    unmount();

    const getRanking = vi.fn(exampleChampionship.getRanking);
    const getTopK = vi.fn(exampleChampionship.getTopK);
    render(<ChampionshipDashboard onRace={() => {}} provider={{ ...exampleChampionship, kind: 'live', getRanking, getTopK }} />);
    await screen.findByRole('group', { name: 'Championship points progression' }, { timeout: 5000 });
    fireEvent.change(screen.getByLabelText('Ranking method'), { target: { value: 'quick' } });
    expect(getRanking).toHaveBeenLastCalledWith('quick');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show top-k only' }));
    fireEvent.change(screen.getByLabelText('k', { exact: true }), { target: { value: '2' } });
    expect(getTopK).toHaveBeenLastCalledWith(2);
    const table = screen.getByRole('table', { name: 'Top 2 racers' });
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    fireEvent.change(screen.getByLabelText('Race', { exact: true }), { target: { value: 'example-2' } });
    expect(screen.getByRole('table', { name: 'Example race 02' })).toHaveTextContent('Rival 02');
  }, 10000);

  it('rejects a top-k result inconsistent with the supplied full ranking', async () => {
    render(<ChampionshipDashboard onRace={() => {}} provider={{ ...exampleChampionship, getTopK: () => [] }} />);
    await screen.findByRole('group', { name: 'Championship points progression' }, { timeout: 5000 });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show top-k only' }));
    expect(screen.getByRole('alert')).toHaveTextContent('does not match');
    fireEvent.click(screen.getByRole('button', { name: 'Return to full Merge Sort view' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('preset presentation', () => {
  const path = { vertices: [0, 1], edges: ['road-0'] };
  const makeRoutes = (): PresetRouteView[] => routePresets.map((preset) => ({ preset: preset.id, status: 'available', ...path, metrics: { distance: 140, time: 12.5, cost: 23.4567 }, weights: { distance: 1, time: 2, fuel: 1, difficulty: 1, obstacle: 1 } }));

  it('does not invent optimized costs and labels opt-in illustrative overlays', () => {
    render(<PresetComparison track={previewTrack} source={0} target={1} showLabels examples={[path]} />);
    expect(screen.getByText('Planner pending')).toBeInTheDocument();
    expect(document.querySelectorAll('.preset-card .highlighted')).toHaveLength(0);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show illustrative path overlays' }));
    expect(screen.getByText(/They were not selected by preset weights/)).toBeInTheDocument();
    expect(document.querySelectorAll('.preset-card .highlighted')).toHaveLength(4);
    expect(screen.queryByText('23.4567')).not.toBeInTheDocument();
  });

  it('displays exact provider costs/weights and rejects stale blocked routes', () => {
    const compare = vi.fn(() => makeRoutes());
    const provider: PresetProvider = { compare };
    const { rerender } = render(<PresetComparison track={previewTrack} source={0} target={1} showLabels examples={[]} provider={provider} />);
    expect(compare).toHaveBeenCalledWith({ source: 0, target: 1, track: previewTrack });
    expect(screen.getAllByText('23.4567')).toHaveLength(4);
    expect(screen.getAllByText(/Weights: distance 1, time 2/)).toHaveLength(4);
    const blocked = { ...previewTrack, roads: previewTrack.roads.map((road) => road.id === 'road-0' ? { ...road, status: 'blocked' as const } : road) };
    rerender(<PresetComparison track={blocked} source={0} target={1} showLabels examples={[]} provider={provider} />);
    expect(screen.getByRole('alert')).toHaveTextContent('blocked road');
    expect(screen.queryByText('23.4567')).not.toBeInTheDocument();
  });
});
