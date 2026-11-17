import { describe, expect, it } from 'vitest';
import { formulaPowertrain } from '../../src/ui/adapters/formula-powertrain';

describe('formula demo rev progression', () => {
  it('revs through a gear and drops RPM on an upshift', () => {
    const low = formulaPowertrain(65, 1, false);
    const high = formulaPowertrain(97, 1, false);
    const shifted = formulaPowertrain(99, high.gear, false);
    expect(high.rpm).toBeGreaterThan(low.rpm);
    expect(high.rpm).toBeGreaterThan(14000);
    expect(shifted.gear).toBe(2);
    expect(shifted.rpm).toBeLessThan(high.rpm * 0.8);
    expect(shifted.rpm).toBeGreaterThan(10000);
  });

  it('keeps a gear near its shift boundary and raises RPM on a braking downshift', () => {
    expect(formulaPowertrain(97, 2, false).gear).toBe(2);
    const before = formulaPowertrain(95, 2, true);
    const after = formulaPowertrain(92, 2, true);
    expect(before.gear).toBe(2);
    expect(after.gear).toBe(1);
    expect(after.rpm).toBeGreaterThan(before.rpm);
  });

  it('idles in neutral, holds launch revs and does not reset RPM within top gear', () => {
    expect(formulaPowertrain(0, 8, false)).toEqual({ gear: 0, rpm: 3500 });
    expect(formulaPowertrain(10, 0, false).rpm).toBe(7000);
    expect(formulaPowertrain(330, 8, false).rpm).toBeGreaterThan(formulaPowertrain(305, 8, false).rpm);
    expect(formulaPowertrain(500, 8, false)).toEqual({ gear: 8, rpm: 15000 });
  });
});
