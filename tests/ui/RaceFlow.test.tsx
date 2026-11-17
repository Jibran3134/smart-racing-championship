// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/app/App';
import { demoSetupProvider } from '../../src/ui/fixtures/demo-setup-provider';
import { createDrivingDemo } from '../../src/ui/fixtures/driving-demo';
import { validatePresetRoutes } from '../../src/ui/adapters/route-validation';
import { routePresets } from '../../src/ui/adapters/preset-view';
import { previewTrack } from '../../src/ui/fixtures/preview-track';
import type { RaceDriver } from '../../src/ui/adapters/race-view';
import type { RaceSetupProvider } from '../../src/ui/adapters/race-setup';
import type { PresetRouteView } from '../../src/ui/adapters/preset-view';
import { downloadText } from '../../src/ui/components/common/download';

vi.mock('../../src/ui/components/common/download', () => ({ downloadText: vi.fn() }));
vi.mock('../../src/ui/components/charts/SeriesChart', () => ({ SeriesChart: () => <div /> }));
let frames: Map<number, FrameRequestCallback>;
beforeEach(() => {
  HTMLDialogElement.prototype.close = vi.fn();
  HTMLDialogElement.prototype.showModal = vi.fn();
  frames = new Map(); let sequence = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn((frame: FrameRequestCallback) => { frames.set(++sequence, frame); return sequence; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
});
afterEach(() => vi.unstubAllGlobals());

describe('setup to actual results', () => {
  it('archives the real race once, exports it, and records a new run after restart', async () => {
    let driver: RaceDriver | undefined;
    const provider: RaceSetupProvider = { ...demoSetupProvider, createRace(request) { driver = createDrivingDemo({ laps: request.laps, initialNitro: request.initialNitro, eventsEnabled: request.eventsEnabled }); return driver; } };
    render(<App raceSetupProvider={provider} />);
    const nav = () => within(screen.getByRole('navigation'));
    fireEvent.click(nav().getByRole('button', { name: /Race/ }));
    fireEvent.change(await screen.findByLabelText('Starting nitro'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Start driving demo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start race', exact: true })).toBeEnabled());
    const complete = () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start race', exact: true }));
      act(() => { for (let i = 0; i < 1500 && driver?.getState().phase !== 'finished'; i++) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(i * 100)); } });
    };
    complete(); fireEvent.click(screen.getByRole('button', { name: 'View race results' }));
    expect(screen.getByRole('table', { name: 'Final results / session-1' })).toBeInTheDocument();
    expect(screen.queryByText('EXAMPLE CHAMPIONSHIP')).not.toBeInTheDocument();
    expect(within(screen.getByLabelText('Completed session')).getAllByRole('option')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Export session JSON' }));
    const json = JSON.parse(vi.mocked(downloadText).mock.calls.at(-1)![1]);
    expect(json.setup.initialNitro).toBe(0); expect(json.racers).toHaveLength(4); expect(json.racers.every((car: { finishTime: number }) => car.finishTime > 0)).toBe(true);
    fireEvent.click(nav().getByRole('button', { name: /Race/ }));
    fireEvent.click(screen.getByRole('button', { name: 'View race results' }));
    expect(within(screen.getByLabelText('Completed session')).getAllByRole('option')).toHaveLength(1);
    fireEvent.click(nav().getByRole('button', { name: /Race/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restart session' }));
    complete(); fireEvent.click(screen.getByRole('button', { name: 'View race results' }));
    await waitFor(() => expect(within(screen.getByLabelText('Completed session')).getAllByRole('option')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Completed session'), { target: { value: 'session-1' } });
    expect(screen.getByRole('table', { name: 'Final results / session-1' })).toBeInTheDocument();
  });

  it('explores and replays provider circuits whose IDs do not begin at zero', async () => {
    const original = demoSetupProvider.circuits[0];
    const track = { ...original.track, name: 'Offset test circuit', vertices: original.track.vertices.map((vertex) => ({ ...vertex, id: vertex.id + 100 })), roads: original.track.roads.map((road) => ({ ...road, id: `custom-${road.id}`, from: road.from + 100, to: road.to + 100 })) };
    render(<App raceSetupProvider={{ ...demoSetupProvider, circuits: [{ ...original, track, title: track.name }] }} />);
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Race/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Explore selected circuit' }));
    expect(screen.getByLabelText('Start vertex')).toHaveValue('100');
    fireEvent.click(screen.getByRole('button', { name: 'Block selected road' }));
    fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: /Algorithm Lab/ }));
    fireEvent.click(screen.getByRole('button', { name: 'BFS / DFS exploration' }));
    expect(screen.getByLabelText('Start vertex')).toHaveValue('100');
  });
});

describe('preset integration boundaries', () => {
  const routes = (): PresetRouteView[] => routePresets.map((preset) => ({ preset: preset.id, status: 'available', vertices: [0, 1], edges: ['road-0'], metrics: { distance: 1, time: 1, cost: 1 }, weights: { distance: 1, time: 1, fuel: 1, difficulty: 1, obstacle: 1 } }));
  it('checks all four results, path continuity, one-way direction and required numeric fields', () => {
    expect(() => validatePresetRoutes(previewTrack, 0, 1, routes())).not.toThrow();
    expect(() => validatePresetRoutes(previewTrack, 0, 1, routes().slice(1))).toThrow(/four presets/);
    const disconnected = routes(); disconnected[0].edges = ['road-1'];
    expect(() => validatePresetRoutes(previewTrack, 0, 1, disconnected)).toThrow(/disconnected/);
    const reverse = routes().map((route) => ({ ...route, vertices: [1, 0] }));
    const oneWay = { ...previewTrack, roads: previewTrack.roads.map((road) => ({ ...road, directed: true })) };
    expect(() => validatePresetRoutes(oneWay, 1, 0, reverse)).toThrow(/one-way/);
    const invalid = routes(); invalid[0].metrics = {} as PresetRouteView['metrics'];
    expect(() => validatePresetRoutes(previewTrack, 0, 1, invalid)).toThrow(/metrics/);
  });
});
