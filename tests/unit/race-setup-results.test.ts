import { describe, expect, it } from 'vitest';
import { createDrivingDemo, drivingDemoSetup } from '../../src/ui/fixtures/driving-demo';
import { demoSetupProvider } from '../../src/ui/fixtures/demo-setup-provider';
import { validateCircuitChoices, validatePreparedRace, validateResourceAdvice, validateSetupRequest } from '../../src/ui/adapters/race-setup';
import type { RaceSetupRequest } from '../../src/ui/adapters/race-setup';
import { captureSessionResult, sessionResultsCsv, sessionEventsCsv } from '../../src/ui/adapters/session-results';

const request: RaceSetupRequest = { mode: 'quick', circuitId: 'driving-demo', laps: 2, initialNitro: 1, eventsEnabled: false };
function finish(laps = 2) {
  const driver = createDrivingDemo({ laps, initialNitro: 1, eventsEnabled: false }); driver.start();
  for (let step = 0; driver.getState().phase !== 'finished' && step < 2000; step++) driver.step(0.1);
  return driver.getState();
}

describe('race preparation boundaries', () => {
  it('applies supported settings to the real demo and keeps the original defaults', async () => {
    expect(drivingDemoSetup().config).toMatchObject({ laps: 2, initialNitro: 3, timeLimit: 120 });
    const configured = drivingDemoSetup({ laps: 3, initialNitro: 0, eventsEnabled: false });
    expect(configured.config).toMatchObject({ laps: 3, initialNitro: 0, timeLimit: 180 }); expect(configured.events).toEqual([]);
    const driver = await demoSetupProvider.createRace(request);
    expect(() => validatePreparedRace(driver, demoSetupProvider.circuits[0], request)).not.toThrow();
    driver.restart(); expect(driver.getState().cars.find((car) => car.isHuman)?.nitro).toBe(1);
  });

  it('rejects stale setups, invalid catalogue entries and unsupported championship requests', () => {
    expect(() => validateSetupRequest(demoSetupProvider, { ...request, laps: 1 })).toThrow();
    expect(() => validateSetupRequest(demoSetupProvider, { ...request, initialNitro: 4 })).toThrow();
    expect(() => validateSetupRequest(demoSetupProvider, { ...request, mode: 'championship' })).toThrow(/championship/);
    expect(() => validateCircuitChoices({ ...demoSetupProvider, circuits: [...demoSetupProvider.circuits, ...demoSetupProvider.circuits] })).toThrow(/unique/);
    expect(() => validatePreparedRace(createDrivingDemo(), demoSetupProvider.circuits[0], request)).toThrow(/loadout/);
    expect(() => drivingDemoSetup({ laps: 2.5 })).toThrow();
  });

  it('rejects a feasible recommendation that exceeds the provider budget', () => {
    expect(() => validateResourceAdvice({ required: true, plans: [{ id: 'x', label: 'Plan', method: 'dp', feasible: true, explanation: '', items: [], cost: 11, budget: 10, budgetLabel: 'units' }] })).toThrow(/exceeds/);
  });
});

describe('completed-session evidence', () => {
  it.each([2, 3])('records an actual %i-lap race without fabricated points or fastest laps', (laps) => {
    const state = finish(laps); expect(state.phase).toBe('finished'); expect(state.cars.every((car) => car.status === 'finished')).toBe(true);
    const record = captureSessionResult(state, 'demo', 'session-1', '2026-11-17T00:00:00Z');
    expect(record.racers.map((car) => car.finishTime)).toEqual(state.cars.map((car) => car.finishTime));
    expect(record.racers.map((car) => car.position)).toEqual([1, 2, 3, 4]);
    expect(record.racers[0]).not.toHaveProperty('points'); expect(record.racers[0]).not.toHaveProperty('fastestLap');
    const name = record.racers[0].name; state.cars[0].label = 'Changed later'; expect(record.racers[0].name).toBe(name);
    expect(sessionResultsCsv(record)).toContain('finishTimeSeconds'); expect(sessionEventsCsv(record)).toContain('simulationTimeSeconds');
  });

  it('rejects unfinished or misordered data, preserves DNF reasons and leaves missing replay times blank', () => {
    expect(() => captureSessionResult(createDrivingDemo().getState(), 'demo', 's', '2026-11-17')).toThrow(/completed/);
    const state = finish();
    expect(() => captureSessionResult({ ...state, cars: [...state.cars].reverse() }, 'demo', 's', '2026-11-17')).toThrow(/order/);
    const retired = { ...state, cars: state.cars.map((car, index) => index === 3 ? { ...car, status: 'dnf' as const, statusReason: 'Fuel depleted.', finishTime: null } : car) };
    expect(captureSessionResult(retired, 'demo', 's', '2026-11-17').racers[3]).toMatchObject({ status: 'dnf', reason: 'Fuel depleted.', finishTime: null });
    const missing = { ...state, cars: state.cars.map((car) => ({ ...car, finishTime: undefined })) };
    expect(() => captureSessionResult(missing, 'demo', 's', '2026-11-17')).toThrow(/supply a finish time/);
    expect(captureSessionResult(missing, 'replay', 's', '2026-11-17').racers[0].finishTime).toBeNull();
  });
});
