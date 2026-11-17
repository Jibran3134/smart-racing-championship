/** Presentation gearbox for the supplied-route demo, not shared engine physics. */
export const FORMULA_REDLINE = 14500;
const shiftSpeeds = [98, 139, 177, 211, 242, 272, 300, 335];

export function formulaPowertrain(speedKph: number, previousGear: number, braking: boolean) {
  if (speedKph < 1.8) return { gear: 0, rpm: 3500 };
  let gear = Math.max(1, Math.min(8, previousGear));
  while (gear < 8 && speedKph >= shiftSpeeds[gear - 1]) gear++;
  // Hysteresis prevents gear chatter around a shift speed. Downshifts raise RPM.
  while (gear > 1 && speedKph / shiftSpeeds[gear - 1] * FORMULA_REDLINE < 9800) gear--;
  const coupledRpm = speedKph / shiftSpeeds[gear - 1] * FORMULA_REDLINE;
  return { gear, rpm: Math.min(15000, Math.max(braking ? 3500 : 7000, coupledRpm)) };
}
