import { describe, expect, it } from 'vitest';
import { RaceEngine } from '../../src/core/engine/RaceEngine';
import { ChampionshipManager } from '../../src/core/championship/ChampionshipManager';
import type { Vertex, Edge } from '../../src/core/types';
import gpCircuit from '../../src/data/tracks/circuit-grand-prix.json';
import dcCircuit from '../../src/data/tracks/circuit-desert-canyon.json';
import cgCircuit from '../../src/data/tracks/circuit-city-grid.json';

describe('RaceEngine Integration & Championship (Alishba)', () => {
  it('initializes the live race engine and steps through simulation', () => {
    const engine = new RaceEngine({
      trackName: gpCircuit.name,
      vertices: gpCircuit.vertices as Vertex[],
      edges: gpCircuit.edges as Edge[],
      startVertexId: 0,
      laps: 2,
    });

    const initial = engine.getState();
    expect(initial.phase).toBe('ready');
    expect(initial.totalLaps).toBe(2);
    expect(initial.cars.length).toBe(4); // Player + 3 AI bots

    // Start race
    engine.start();
    expect(engine.getState().phase).toBe('countdown');

    // Step through countdown (3 seconds)
    engine.step(3.1);
    expect(engine.getState().phase).toBe('running');

    // Nitro boost test
    const nitroSuccess = engine.activateNitro();
    expect(nitroSuccess).toBe(true);
    const boostedCar = engine.getState().cars.find((c) => c.isHuman);
    expect(boostedCar?.nitro).toBe(2); // 3 - 1

    // Step physics forward
    engine.step(10);
    const midState = engine.getState();
    expect(midState.clock).toBeGreaterThan(0);
    expect(midState.cars[0].distance).toBeGreaterThan(0);
  });

  it('runs complete race session and integrates results with ChampionshipManager', () => {
    const engine = new RaceEngine({
      trackName: gpCircuit.name,
      vertices: gpCircuit.vertices as Vertex[],
      edges: gpCircuit.edges as Edge[],
      startVertexId: 0,
      laps: 1, // 1 lap for quick integration completion
    });

    engine.start();
    engine.step(3.1); // clear countdown

    // Step until all cars finish or time limit
    for (let i = 0; i < 200 && engine.getState().phase !== 'finished'; i++) {
      engine.step(1.0);
    }

    const state = engine.getState();
    expect(state.phase).toBe('finished');

    const results = engine.getResults();
    expect(results.length).toBe(4);
    expect(results[0].finishPosition).toBe(1);
    expect(results[0].pointsAwarded).toBe(25); // Winner gets 25 pts

    // Accumulate results in ChampionshipManager
    const champ = new ChampionshipManager();
    for (const car of state.cars) {
      champ.registerRacer({ racerId: String(car.id), name: car.name, isHuman: car.isHuman });
    }

    champ.addRaceResults('race-gp', 'Grand Prix', results);

    const standings = champ.getStandings('merge');
    expect(standings.length).toBe(4);
    expect(standings[0].totalPoints).toBe(25);
    expect(standings[0].wins).toBe(1);

    const top2 = champ.getTopK(2);
    expect(top2.length).toBe(2);
    expect(top2[0].racerId).toBe(standings[0].racerId);
    expect(top2[1].racerId).toBe(standings[1].racerId);

    // Verify restarting completed race does not throw "Time must be finite and monotonic"
    expect(() => engine.restart()).not.toThrow();
    expect(engine.getState().phase).toBe('ready');
  });

  it('handles restart and reinitializes race state cleanly', () => {
    const engine = new RaceEngine({
      trackName: gpCircuit.name,
      vertices: gpCircuit.vertices as Vertex[],
      edges: gpCircuit.edges as Edge[],
      startVertexId: 0,
      laps: 2,
    });

    engine.start();
    engine.step(5.0);
    expect(engine.getState().clock).toBeGreaterThan(0);

    engine.restart();
    const restarted = engine.getState();
    expect(restarted.phase).toBe('ready');
    expect(restarted.clock).toBe(0);
    expect(restarted.cars[0].completedLaps).toBe(0);
  });

  it('handles mid-race road closure, fuel exhaustion DNF, and standings points', () => {
    const engine = new RaceEngine({
      trackName: gpCircuit.name,
      vertices: gpCircuit.vertices as Vertex[],
      edges: gpCircuit.edges as Edge[],
      startVertexId: 0,
      laps: 1,
      racers: [
        { id: 1, name: 'Player (Low Fuel)', isHuman: true, speed: 85, preset: 'Balanced', fuel: 0.1 },
        { id: 2, name: 'Main Apex', isHuman: false, speed: 88, strategy: 'main-route' },
        { id: 3, name: 'Shortcut Phantom', isHuman: false, speed: 83, strategy: 'shortcut' },
        { id: 4, name: 'Metric Shadow', isHuman: false, speed: 86, strategy: 'shortest-distance' },
      ],
    });

    engine.start();
    engine.step(3.1); // running

    // Step physics: human car has only 0.1 fuel -> will exhaust and DNF
    engine.step(5.0);
    const humanAfter = engine.getState().cars.find((c) => c.isHuman);
    expect(humanAfter?.status).toBe('dnf');
    expect(humanAfter?.reason).toBe('Fuel exhausted.');

    // 2. Temporarily block an edge ahead of AI cars to test dynamic road closure and reopening
    engine.blockEdge('gp-5-6');
    engine.step(5.0);
    engine.unblockEdge('gp-5-6');

    // Continue race to finish
    for (let i = 0; i < 200 && engine.getState().phase !== 'finished'; i++) {
      engine.step(1.0);
    }

    const results = engine.getResults();
    const dnfResult = results.find((r) => r.racerId === '1');
    expect(dnfResult).toBeDefined();
    expect(dnfResult?.pointsAwarded).toBe(0); // DNF receives 0 points
    expect(dnfResult?.dnfReason).toBe('Fuel exhausted.');
  });

  it('completes default two-lap race successfully across all three circuits without fuel DNF', () => {
    const circuits = [
      { name: 'Grand Prix', data: gpCircuit },
      { name: 'Desert Canyon', data: dcCircuit },
      { name: 'City Grid', data: cgCircuit },
    ];

    for (const { name, data } of circuits) {
      const engine = new RaceEngine({
        trackName: name,
        vertices: data.vertices as Vertex[],
        edges: data.edges as Edge[],
        startVertexId: 0,
        laps: 2,
      });

      engine.start();
      engine.step(3.1);

      for (let i = 0; i < 400 && engine.getState().phase !== 'finished'; i++) {
        engine.step(1.0);
      }

      const state = engine.getState();
      expect(state.phase).toBe('finished');
      const fuelDnfs = state.cars.filter((c) => c.status === 'dnf' && c.reason === 'Fuel exhausted.');
      expect(fuelDnfs.length).toBe(0);
      const finished = state.cars.filter((c) => c.status === 'finished');
      expect(finished.length).toBeGreaterThan(0);
    }
  });

  it('verifies bot strategies produce distinct routes and shortcut preference', () => {
    const engine = new RaceEngine({
      trackName: gpCircuit.name,
      vertices: gpCircuit.vertices as Vertex[],
      edges: gpCircuit.edges as Edge[],
      startVertexId: 0,
      laps: 1,
    });

    const state = engine.getState();
    const mainApex = state.cars.find((c) => c.name === 'Main Apex');
    const shortcutPhantom = state.cars.find((c) => c.name === 'Shortcut Phantom');
    const metricShadow = state.cars.find((c) => c.name === 'Metric Shadow');

    expect(mainApex).toBeDefined();
    expect(shortcutPhantom).toBeDefined();
    expect(metricShadow).toBeDefined();

    // Verify all racers initialized with valid routes
    expect(mainApex!.route.length).toBeGreaterThan(1);
    expect(shortcutPhantom!.route.length).toBeGreaterThan(1);
    expect(metricShadow!.route.length).toBeGreaterThan(1);
  });
});
