import { useState } from 'react';
import { HeapLab } from './HeapLab';
import { SearchLab } from './SearchLab';
import { EventLab } from './EventLab';
import { previewTrack } from '../../fixtures/preview-track';
import type { TrackMapData } from '../../components/map/map-model';

export function AlgorithmLab({ showLabels = true, track = previewTrack }: { showLabels?: boolean; track?: TrackMapData }) {
  const [workspace, setWorkspace] = useState('heap');
  return <>
    <div className="workspace-switch" role="group" aria-label="Lab workspace">
      <button aria-pressed={workspace === 'heap'} onClick={() => setWorkspace('heap')}>Binary heap</button>
      <button aria-pressed={workspace === 'search'} onClick={() => setWorkspace('search')}>BFS / DFS exploration</button>
      <button aria-pressed={workspace === 'events'} onClick={() => setWorkspace('events')}>Event simulation</button>
    </div>
    {workspace === 'heap' && <HeapLab />}
    {workspace === 'search' && <SearchLab showLabels={showLabels} track={track} />}
    {workspace === 'events' && <EventLab showLabels={showLabels} />}
  </>;
}
