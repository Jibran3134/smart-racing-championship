import { lazy, Suspense, useState } from 'react';
import { HeapLab } from './HeapLab';
import { SearchLab } from './SearchLab';
import { EventLab } from './EventLab';
import { previewTrack } from '../../fixtures/preview-track';
import type { TrackMapData } from '../../components/map/map-model';
import { ExperimentLab } from './ExperimentLab';
import type { LabAlgorithm } from '../../adapters/algorithm-lab';
const AlgorithmWorkbench = lazy(() => import('./AlgorithmWorkbench').then((module) => ({ default: module.AlgorithmWorkbench })));

export function AlgorithmLab({ showLabels = true, track = previewTrack, algorithms }: { showLabels?: boolean; track?: TrackMapData; algorithms?: readonly LabAlgorithm[] }) {
  const [workspace, setWorkspace] = useState('heap');
  return <>
    <div className="workspace-switch" role="group" aria-label="Lab workspace">
      <button aria-pressed={workspace === 'heap'} onClick={() => setWorkspace('heap')}>Binary heap</button>
      <button aria-pressed={workspace === 'search'} onClick={() => setWorkspace('search')}>BFS / DFS exploration</button>
      <button aria-pressed={workspace === 'events'} onClick={() => setWorkspace('events')}>Event simulation</button>
      <button aria-pressed={workspace === 'experiments'} onClick={() => setWorkspace('experiments')}>Experiment results</button>
      <button aria-pressed={workspace === 'workbench'} onClick={() => setWorkspace('workbench')}>Algorithm workbench</button>
    </div>
    {workspace === 'heap' && <HeapLab />}
    {workspace === 'search' && <SearchLab showLabels={showLabels} track={track} />}
    {workspace === 'events' && <EventLab showLabels={showLabels} />}
    {workspace === 'experiments' && <ExperimentLab />}
    {workspace === 'workbench' && <Suspense fallback={<p className="lab-message">Loading algorithm workbench...</p>}><AlgorithmWorkbench track={track} showLabels={showLabels} algorithms={algorithms} /></Suspense>}
  </>;
}
