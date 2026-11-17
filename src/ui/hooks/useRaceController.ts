import { useCallback, useEffect, useState } from 'react';
import type { RaceDriver, RaceViewState } from '../adapters/race-view';

function readDriver(driver: RaceDriver): { state: RaceViewState | null; error: string | null } {
  try { return { state: driver.getState(), error: null }; }
  catch (error) { return { state: null, error: error instanceof Error ? error.message : 'Race state unavailable.' }; }
}

/** One owned animation loop; simulation rules stay inside the injected driver. */
export function useRaceController(driver: RaceDriver) {
  const [reading, setReading] = useState(() => readDriver(driver));
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    document.addEventListener('visibilitychange', pauseWhenHidden);
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden);
  }, []);

  const perform = useCallback((action: () => void) => {
    try { action(); setReading(readDriver(driver)); }
    catch (error) {
      setPlaying(false);
      setReading((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'Race update failed.' }));
    }
  }, [driver]);

  useEffect(() => {
    if (!playing) return;
    let request = 0;
    let last: number | undefined;
    let disposed = false;
    const tick = (timestamp: number) => {
      if (disposed) return;
      const dt = last === undefined ? 0 : Math.min(0.1, Math.max(0, (timestamp - last) / 1000));
      last = timestamp;
      try {
        driver.step(dt * (driver.kind === 'replay' ? speed : 1));
        const state = driver.getState();
        setReading({ state, error: null });
        if (state.phase === 'finished') { setPlaying(false); return; }
      } catch (error) {
        setReading((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'Race update failed.' }));
        setPlaying(false);
        return;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(request); };
  }, [driver, playing, speed]);

  return {
    ...reading, playing, speed, setSpeed,
    play: () => {
      try { driver.start(); const next = readDriver(driver); setReading(next); setPlaying(next.error === null && (next.state?.phase === 'running' || next.state?.phase === 'countdown')); }
      catch (error) { setReading((previous) => ({ ...previous, error: error instanceof Error ? error.message : 'Unable to start.' })); }
    },
    pause: () => setPlaying(false),
    restart: () => { setPlaying(false); perform(() => driver.restart()); },
    seek: (seconds: number) => { setPlaying(false); perform(() => driver.seek?.(seconds)); },
    activateNitro: () => perform(() => driver.activateNitro?.()),
  };
}
