import type { TrackMapData } from '../components/map/map-model';

/** UI layout fixture, not a validated playable circuit or engine graph. */
export const previewTrack: TrackMapData = {
  name: 'Apex District',
  vertices: [
    { id: 0, x: 160, y: 390, label: 'Start / finish', kind: 'start' },
    { id: 1, x: 110, y: 250, label: 'Checkpoint 01', kind: 'checkpoint', checkpointOrder: 1 },
    { id: 2, x: 170, y: 130, label: 'Checkpoint 02', kind: 'checkpoint', checkpointOrder: 2 },
    { id: 3, x: 330, y: 95, label: 'Checkpoint 03', kind: 'checkpoint', checkpointOrder: 3 },
    { id: 4, x: 500, y: 135, label: 'Checkpoint 04', kind: 'checkpoint', checkpointOrder: 4 },
    { id: 5, x: 680, y: 90, label: 'Checkpoint 05', kind: 'checkpoint', checkpointOrder: 5 },
    { id: 6, x: 800, y: 190, label: 'Checkpoint 06', kind: 'checkpoint', checkpointOrder: 6 },
    { id: 7, x: 790, y: 340, label: 'Checkpoint 07', kind: 'checkpoint', checkpointOrder: 7 },
    { id: 8, x: 660, y: 430, label: 'Checkpoint 08', kind: 'checkpoint', checkpointOrder: 8 },
    { id: 9, x: 470, y: 450, label: 'Checkpoint 09', kind: 'checkpoint', checkpointOrder: 9 },
    { id: 10, x: 310, y: 430, label: 'Checkpoint 10', kind: 'checkpoint', checkpointOrder: 10 },
    { id: 11, x: 330, y: 250, label: 'Fuel station', kind: 'fuel' },
    { id: 12, x: 630, y: 265, label: 'Nitro pickup', kind: 'nitro' },
    { id: 13, x: 495, y: 290, label: 'Central junction', kind: 'intersection' },
    { id: 14, x: 585, y: 355, label: 'Service dead end', kind: 'dead-end' },
  ],
  roads: [
    ...Array.from({ length: 11 }, (_, index) => ({ id: `road-${index}`, from: index, to: (index + 1) % 11, status: 'open' as const })),
    { id: 'shortcut-west', from: 2, to: 11, status: 'open', shortcut: true },
    { id: 'west-junction', from: 11, to: 13, status: 'open' },
    { id: 'shortcut-east', from: 13, to: 12, status: 'restricted', shortcut: true },
    { id: 'east-junction', from: 12, to: 7, status: 'open' },
    { id: 'north-junction', from: 4, to: 13, status: 'blocked' },
    { id: 'service-road', from: 13, to: 14, status: 'open' },
    { id: 'south-junction', from: 13, to: 9, status: 'open' },
  ],
};
