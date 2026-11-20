import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import {
  productionPresetProvider,
  productionChampionshipProvider,
  productionRaceSetupProvider,
  productionLabAlgorithms,
} from './adapters';
import './ui/styles/index.css';
import './ui/styles/racing-theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App
      presetProvider={productionPresetProvider}
      championshipProvider={productionChampionshipProvider}
      raceSetupProvider={productionRaceSetupProvider}
      labAlgorithms={productionLabAlgorithms}
    />
  </StrictMode>,
);
