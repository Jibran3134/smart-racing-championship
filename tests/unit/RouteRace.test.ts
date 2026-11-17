import { describe, expect, it } from 'vitest';
import { RouteRace } from '../../src/core/engine/RouteRace';
import { drivingDemoSetup, createDrivingDemo } from '../../src/ui/fixtures/driving-demo';
import { projectCar } from '../../src/ui/components/map/map-model';

describe('supplied-route driving session', () => {
  it('holds a three-second grid countdown before moving', () => {
    const engine = new RouteRace(drivingDemoSetup());
    const grid = engine.getState().cars;
    engine.start(); engine.step(2);
    expect(engine.getState()).toMatchObject({ phase: 'countdown', clock: 0, countdown: 1 });
    expect(engine.getState().cars).toEqual(grid);
    engine.step(1.2);
    expect(engine.getState().phase).toBe('running');
    expect(engine.getState().cars[0].distance).toBeGreaterThan(0);
  });

  it('is deterministic across large and irregular input step partitions', () => {
    const first = new RouteRace(drivingDemoSetup()); const second = new RouteRace(drivingDemoSetup());
    first.start(); second.start();
    first.step(75);
    for (let index = 0; index < 300; index++) second.step(0.25);
    expect(first.getState()).toEqual(second.getState());
    expect(first.getState().phase).toBe('finished');
    expect(first.getState().cars.every((car) => car.status === 'finished' && car.completedLaps === 2 && car.checkpoint === 10)).toBe(true);
  });

  it('moves continuously on legal roads rather than jumping between snapshots', () => {
    const driver = createDrivingDemo(); driver.start();
    let previous = driver.getState();
    let edgeChanges = 0;
    for (let index = 0; index < 1400; index++) {
      driver.step(1 / 60);
      const current = driver.getState();
      current.cars.forEach((car) => {
        const before = previous.cars.find((item) => item.id === car.id)!;
        const oldPosition = projectCar(previous.track, { ...before, laneOffset: 0 })!;
        const newPosition = projectCar(current.track, { ...car, laneOffset: 0 })!;
        expect(Math.hypot(newPosition.x - oldPosition.x, newPosition.y - oldPosition.y)).toBeLessThan(3);
        if ('edge' in car.location && 'edge' in before.location && car.location.edge !== before.location.edge) edgeChanges++;
      });
      previous = current;
    }
    expect(edgeChanges).toBeGreaterThan(12);
  });

  it('uses one charge per nitro activation, increases consumption and expires independently', () => {
    const boosted = new RouteRace(drivingDemoSetup()); const normal = new RouteRace(drivingDemoSetup());
    boosted.start(); normal.start();
    expect(boosted.activateNitro()).toBe(false);
    boosted.step(3.1); normal.step(3.1);
    expect(boosted.activateNitro()).toBe(true);
    expect(boosted.activateNitro()).toBe(false);
    boosted.step(3); normal.step(3);
    expect(boosted.getState().cars[0].nitro).toBe(2);
    expect(boosted.getState().cars[0].fuel).toBeLessThan(normal.getState().cars[0].fuel);
    expect(boosted.getState().cars[0].distance).toBeGreaterThan(normal.getState().cars[0].distance);
    boosted.step(1.1);
    expect(boosted.activateNitro()).toBe(true);
  });

  it('waits for a closure to clear and keeps elapsed time advancing', () => {
    const setup = drivingDemoSetup();
    setup.events = [
      { eventId: 'close', triggerTime: 0, effect: { type: 'road-blockage', edgeId: 'road-0', blocked: true } },
      { eventId: 'open', triggerTime: 2, effect: { type: 'road-blockage', edgeId: 'road-0', blocked: false } },
    ];
    const engine = new RouteRace(setup); engine.start(); engine.step(4);
    expect(engine.getState().cars[0]).toMatchObject({ status: 'waiting', progress: 0 });
    expect(engine.getState().clock).toBeGreaterThan(0.9);
    engine.step(2);
    expect(engine.getState().cars[0].status).toBe('racing');
    expect(engine.getState().cars[0].distance).toBeGreaterThan(0);
  });

  it('handles insufficient fuel, time limits and invalid checkpoint routes', () => {
    const setup = drivingDemoSetup(); setup.config.fuelCapacity = 0.1;
    const engine = new RouteRace(setup); engine.start(); engine.step(4);
    expect(engine.getState().cars[0]).toMatchObject({ status: 'dnf', reason: 'Insufficient fuel for the next road.' });
    const timed = drivingDemoSetup(); timed.config.timeLimit = 0.2;
    const limited = new RouteRace(timed); limited.start(); limited.step(4);
    expect(limited.getState().phase).toBe('finished');
    expect(limited.getState().cars.every((car) => car.status === 'dnf')).toBe(true);
    const invalid = drivingDemoSetup();
    invalid.vertices = invalid.vertices.map((vertex) => vertex.id === 1 ? { ...vertex, checkpointOrder: 2 } : vertex.id === 2 ? { ...vertex, checkpointOrder: 1 } : vertex);
    expect(() => new RouteRace(invalid)).toThrow('checkpoint order');
  });

  it('supports route service stops and consumes a pickup only when capacity permits', () => {
    const setup = drivingDemoSetup();
    setup.racers = [{ ...setup.racers[0], route: [0, 1, 2, 11, 2, 3, 4, 5, 6, 7, 12, 7, 8, 9, 10, 0] }];
    setup.config.fuelCapacity = 38; setup.config.initialNitro = 0;
    const engine = new RouteRace(setup); engine.start(); engine.step(100);
    const state = engine.getState();
    expect(state.events.some((event) => event.message.includes('fuel stop'))).toBe(true);
    expect(state.cars[0].nitro).toBe(1);
    expect(state.vertices.find((vertex) => vertex.id === 12)?.active).toBe(false);
    expect(state.cars[0].status).toBe('finished');
  });

  it('does not retain mutable configuration or expose mutable state', () => {
    const setup = drivingDemoSetup(); const engine = new RouteRace(setup);
    setup.config.nitroSeconds = 900;
    const state = engine.getState(); state.cars[0].fuel = -999; state.edges[0].status = 'Blocked';
    engine.start(); engine.step(3.1); engine.activateNitro();
    expect(engine.getState().cars[0].nitroUntil).toBeLessThan(5);
    expect(engine.getState().cars[0].fuel).toBeGreaterThan(90);
    expect(engine.getState().edges[0].status).toBe('Open');
  });
});
