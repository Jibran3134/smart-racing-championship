// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { App } from '../../src/app/App';
import {
  productionPresetProvider,
  productionChampionshipProvider,
  productionRaceSetupProvider,
  productionLabAlgorithms,
} from '../../src/adapters';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

describe('All 5 screens with production providers', () => {
  it('Screen 1 (Main Menu): renders cleanly and navigates to all modes', () => {
    render(
      <App
        presetProvider={productionPresetProvider}
        championshipProvider={productionChampionshipProvider}
        raceSetupProvider={productionRaceSetupProvider}
        labAlgorithms={productionLabAlgorithms}
      />
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every route.');
    expect(screen.getByText(/MAIN MENU \/ SMART RACING CHAMPIONSHIP/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Explore the circuit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Algorithm Lab/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /01 \/ CHAMPIONSHIP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /02 \/ QUICK RACE/i })).toBeInTheDocument();
  });

  it('Screen 2 (Track Explorer): runs real preset comparison and BFS/DFS analysis', () => {
    render(
      <App
        presetProvider={productionPresetProvider}
        championshipProvider={productionChampionshipProvider}
        raceSetupProvider={productionRaceSetupProvider}
        labAlgorithms={productionLabAlgorithms}
      />
    );

    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(nav.getByRole('button', { name: /Track Explorer/i }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Track Explorer');
    // Checks that Presets are displayed
    expect(screen.getByRole('heading', { name: /Route presets/i })).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('Speed')).toBeInTheDocument();
    expect(screen.getByText('Economy')).toBeInTheDocument();
    expect(screen.getByText('Safety')).toBeInTheDocument();

    // Check Vertex Inspector & Analysis
    expect(screen.getByRole('heading', { name: 'Graph analysis' })).toBeInTheDocument();
    expect(screen.getByText('Connected components')).toBeInTheDocument();
  });

  it('Screen 3 (Racing Screen): prepares real race with DP and Greedy resource recommendations', async () => {
    render(
      <App
        presetProvider={productionPresetProvider}
        championshipProvider={productionChampionshipProvider}
        raceSetupProvider={productionRaceSetupProvider}
        labAlgorithms={productionLabAlgorithms}
      />
    );

    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(nav.getByRole('button', { name: /Race/i }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Quick Race');
    // Check circuit catalogue (loaded lazily)
    const circuitSelect = (await screen.findByLabelText('Circuit')) as HTMLSelectElement;
    expect(circuitSelect).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Grand Prix Raceway/i })).toBeInTheDocument();

    // Check resource advice
    expect(screen.getByRole('heading', { name: 'Resource recommendations' })).toBeInTheDocument();
    expect(screen.getAllByText(/Dynamic programming/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Greedy/i).length).toBeGreaterThan(0);

    // Select a feasible plan
    const dpPlan = screen.getByLabelText(/Select Optimal \(DP\)/i);
    expect(dpPlan).toBeInTheDocument();
    fireEvent.click(dpPlan);

    // Prepare race button becomes enabled
    const prepareBtn = screen.getByRole('button', { name: 'Prepare race' });
    expect(prepareBtn).toBeEnabled();
    fireEvent.click(prepareBtn);

    // Transitions to race session
    expect(await screen.findByRole('button', { name: 'Start race' })).toBeInTheDocument();
    expect(screen.getByText('Race event feed')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Running order' })).toBeInTheDocument();
  });

  it('Screen 4 (Algorithm Lab): loads workbench with all 14 algorithms and executes Dijkstra', async () => {
    render(
      <App
        presetProvider={productionPresetProvider}
        championshipProvider={productionChampionshipProvider}
        raceSetupProvider={productionRaceSetupProvider}
        labAlgorithms={productionLabAlgorithms}
      />
    );

    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(nav.getByRole('button', { name: /Algorithm Lab/i }));

    // Switch to Algorithm workbench tab
    fireEvent.click(screen.getByRole('button', { name: 'Algorithm workbench' }));

    expect(await screen.findByRole('heading', { name: /Algorithm workbench/i })).toBeInTheDocument();
    expect(screen.getByText(/14 algorithms connected/i)).toBeInTheDocument();

    // Select Dijkstra
    const algoSelect = screen.getByLabelText('Connected algorithm');
    fireEvent.change(algoSelect, { target: { value: 'dijkstra' } });

    // Run Dijkstra
    const runBtn = screen.getByRole('button', { name: 'Run algorithm' });
    fireEvent.click(runBtn);

    // Verify trace playback elements appear
    expect(await screen.findByRole('button', { name: 'Play trace' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next step' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export trace JSON' })).toBeInTheDocument();
  });

  it('Screen 5 (Championship Dashboard): displays live standings and sorting methods', () => {
    render(
      <App
        presetProvider={productionPresetProvider}
        championshipProvider={productionChampionshipProvider}
        raceSetupProvider={productionRaceSetupProvider}
        labAlgorithms={productionLabAlgorithms}
      />
    );

    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
    fireEvent.click(nav.getByRole('button', { name: /Championship/i }));

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Championship Dashboard');
    expect(screen.getByText('Live championship')).toBeInTheDocument();

    // Check podium and standings
    expect(screen.getByLabelText('Championship podium')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Championship standings' })).toBeInTheDocument();

    // Check sorting methods
    const methodSelect = screen.getByLabelText('Ranking method') as HTMLSelectElement;
    expect(methodSelect.value).toBe('merge');
    fireEvent.change(methodSelect, { target: { value: 'quick' } });
    expect(methodSelect.value).toBe('quick');
    fireEvent.change(methodSelect, { target: { value: 'heap' } });
    expect(methodSelect.value).toBe('heap');

    // Check top-k toggle
    const topKToggle = screen.getByRole('checkbox', { name: 'Show top-k only' });
    fireEvent.click(topKToggle);
    expect(topKToggle).toBeChecked();
  });
});
