/**
 * Refuelling DP — Alishba (Milestone 4).
 *
 * Finds the minimum-time refuelling plan along a planned route given:
 *  - A sequence of fuel stations (vertex ids) in the order they appear on the route.
 *  - Fuel cost of each leg between consecutive stations.
 *  - Starting fuel level.
 *
 * State: dp[j][f] = minimum cumulative stop-time to arrive at station j with
 *         f discrete fuel units remaining.
 *
 * Transition: at station j-1, buy `a` units (0 ≤ a ≤ min(C - f_prev, MAX_STATION_PURCHASE × RESOURCE_UNIT)).
 *   stop_time = (a > 0) ? REFUEL_STOP_SECONDS : 0
 *   fuel_after = f_prev + a − leg_cost[j]   (must be ≥ 0 to reach next station)
 *
 * Returns the minimum total stop time (seconds) and the buy amounts at each station.
 *
 * Rules (AGENTS.md): No UI; hand-implemented DP; deterministic.
 */

import { MAX_FUEL, MAX_STATION_PURCHASE, REFUEL_STOP_SECONDS, RESOURCE_UNIT } from '../../config';

export interface RefuellingPlan {
  /** Minimum total stop time in seconds. */
  minStopTime: number;
  /**
   * Amount to buy at each station (index corresponds to stationIndices param).
   * Value in discrete units (divide by RESOURCE_UNIT for fuel units).
   */
  buyAmounts: number[];
  /** Whether a valid plan was found (false if fuel is insufficient even with max buying). */
  feasible: boolean;
}

/**
 * Compute the optimal refuelling plan.
 *
 * @param stationCount - Number of fuel stations along the route (≥ 0).
 * @param legFuelCosts - Discrete fuel cost of each leg; legFuelCosts[i] = cost of leg i→i+1.
 *                       Length = stationCount (cost from each station to next waypoint).
 *                       The last entry is the cost from the last station to the finish.
 * @param startFuel    - Discrete fuel at race start (integer, 0 ≤ startFuel ≤ C).
 */
export function refuellingDP(
  stationCount: number,
  legFuelCosts: readonly number[],
  startFuel: number,
): RefuellingPlan {
  const C = MAX_FUEL * RESOURCE_UNIT;                 // discrete tank capacity
  const maxBuy = MAX_STATION_PURCHASE * RESOURCE_UNIT; // max discrete units per stop
  const INF = Infinity;

  if (stationCount === 0) {
    // No stations — feasibility depends on whether we can reach finish directly
    const feasible = startFuel >= (legFuelCosts[0] ?? 0);
    return { minStopTime: 0, buyAmounts: [], feasible };
  }

  // dp[j][f] = min stop-time arriving at station j with f discrete fuel units
  // j = 0 means start (before first station); j = 1..stationCount are actual stations
  const dp: number[][] = Array.from({ length: stationCount + 1 }, () =>
    new Array<number>(C + 1).fill(INF),
  );
  // choice[j][f] = buy amount chosen at station j-1 to reach station j with f fuel
  const choice: number[][] = Array.from({ length: stationCount + 1 }, () =>
    new Array<number>(C + 1).fill(-1),
  );

  // Base: start position, startFuel units, 0 stop-time
  dp[0][Math.min(startFuel, C)] = 0;

  for (let j = 0; j < stationCount; j++) {
    const legCost = legFuelCosts[j] ?? 0; // fuel cost from station j to station j+1
    for (let f = 0; f <= C; f++) {
      if (dp[j][f] === INF) continue;
      // Try all possible buy amounts at station j
      const maxA = Math.min(C - f, maxBuy);
      for (let a = 0; a <= maxA; a++) {
        const fAfterBuy = f + a;
        const fAfterLeg = fAfterBuy - legCost;
        if (fAfterLeg < 0) continue; // can't make it to next station
        const stopTime = dp[j][f] + (a > 0 ? REFUEL_STOP_SECONDS : 0);
        const nextState = Math.min(fAfterLeg, C);
        if (stopTime < dp[j + 1][nextState]) {
          dp[j + 1][nextState] = stopTime;
          choice[j + 1][nextState] = a;
        }
      }
    }
  }

  // Find best final fuel state
  let bestTime = INF;
  let bestFinal = -1;
  for (let f = 0; f <= C; f++) {
    if (dp[stationCount][f] < bestTime) {
      bestTime = dp[stationCount][f];
      bestFinal = f;
    }
  }

  if (bestFinal === -1 || bestTime === INF) {
    return { minStopTime: 0, buyAmounts: new Array(stationCount).fill(0), feasible: false };
  }

  // Backtrack buy amounts
  const buyAmounts = new Array<number>(stationCount).fill(0);
  let f = bestFinal;
  for (let j = stationCount; j >= 1; j--) {
    const a = choice[j][f];
    buyAmounts[j - 1] = a;
    const legCost = legFuelCosts[j - 1] ?? 0;
    f = f - a + legCost; // undo the leg: reverse (f + a - legCost)
    // Handle discrete rounding
    f = Math.min(f, C);
  }

  return {
    minStopTime: bestTime,
    buyAmounts,
    feasible: true,
  };
}
