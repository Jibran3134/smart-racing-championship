import type { RaceSetupProvider } from '../adapters/race-setup';
import { validateSetupRequest } from '../adapters/race-setup';
import { createDrivingDemo } from './driving-demo';
import { previewTrack } from './preview-track';

export const demoSetupProvider: RaceSetupProvider = {
  circuits: [{ id: 'driving-demo', title: previewTrack.name, description: 'Supplied-route demonstration. Four cars, ordered checkpoints and timed track events.', kind: 'demo', track: previewTrack,
    lapOptions: [2, 3], defaultLaps: 2, initialFuel: 100, nitroCapacity: 3, defaultNitro: 3, eventsConfigurable: true }],
  createRace(request) {
    validateSetupRequest(demoSetupProvider, request);
    if (request.resourcePlanId) throw new Error('The demo has no resource optimization provider.');
    return createDrivingDemo({ laps: request.laps, initialNitro: request.initialNitro, eventsEnabled: request.eventsEnabled });
  },
};
