// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import { productionChampionshipProvider as championship, productionRaceSetupProvider as setup } from '../../src/adapters';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});

function openDashboard() {
  render(<App championshipProvider={championship} raceSetupProvider={setup} />);
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: /Championship/ }));
}

function finishNextRound() {
  const driver = setup.createRace({ mode: 'championship', circuitId: setup.championshipCircuitId!, laps: 2, initialNitro: 3, eventsEnabled: false });
  driver.start();
  driver.step(300);
  expect(driver.getState().phase).toBe('finished');
}

describe('Championship navigation', () => {
  beforeEach(() => championship.reset?.());

  it('shows a clean season and continues to the next circuit after a recorded round', async () => {
    finishNextRound();
    openDashboard();
    expect(screen.getByText(/1 of 3 championship races completed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue championship' }));
    const circuit = await screen.findByLabelText('Circuit', {}, { timeout: 10000 });
    expect(circuit).toHaveValue('circuit-desert-canyon');
    expect(circuit).toBeDisabled();
  }, 15000);

  it('declares the champion only after the final round and starts a fresh season', async () => {
    finishNextRound(); finishNextRound(); finishNextRound();
    openDashboard();
    expect(screen.getByText('CHAMPION')).toBeInTheDocument();
    expect(screen.getByText(/3 of 3 championship races completed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start new championship' }));
    expect(await screen.findByLabelText('Circuit', {}, { timeout: 10000 })).toHaveValue('circuit-grand-prix');
    expect(championship.races).toHaveLength(0);
    expect(championship.complete).toBe(false);
    expect(championship.getRanking('merge').every((row) => row.points === 0 && row.wins === 0)).toBe(true);
  }, 15000);

  it('offers a starting grid without fabricated historical results', () => {
    openDashboard();
    expect(screen.getByRole('button', { name: 'Start championship' })).toBeInTheDocument();
    expect(screen.getByText(/0 of 3 championship races completed/)).toBeInTheDocument();
    expect(screen.queryByText('CHAMPION')).not.toBeInTheDocument();
    expect(championship.pointsHistory).toEqual([]);
  });
});
