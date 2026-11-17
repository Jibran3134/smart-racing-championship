import { useCallback, useEffect, useRef, useState } from 'react';
import { RacingAudio } from '../audio/RacingAudio';
import type { RaceViewState } from '../adapters/race-view';

export function useRaceAudio(state: RaceViewState | null, playing: boolean) {
  const audio = useRef<RacingAudio | null>(null);
  const mounted = useRef(false);
  const userMuted = useRef(false);
  const previous = useRef<{ phase?: string; countdown?: number | null; gear?: number; checkpoint?: number; playing?: boolean; enabled?: boolean }>({});
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(35);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; audio.current?.dispose(); audio.current = null; };
  }, []);

  const enable = useCallback(async () => {
    try {
      if (typeof AudioContext === 'undefined') throw new Error('Audio is unavailable in this browser.');
      if (!audio.current) audio.current = new RacingAudio(new AudioContext());
      const current = audio.current;
      current.setVolume(volume / 100);
      await current.resume();
      if (mounted.current && audio.current === current) { setEnabled(true); setError(''); }
    } catch (failure) {
      if (mounted.current) setError(failure instanceof Error ? failure.message : 'Audio could not start.');
    }
  }, [volume]);

  const toggle = useCallback(async () => {
    if (enabled) {
      userMuted.current = true;
      setEnabled(false);
      try { await audio.current?.setActive(false); }
      catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Audio unavailable.'); }
      return;
    }
    userMuted.current = false;
    await enable();
  }, [enabled, enable]);

  // Call directly from Start/Resume/Space so browser audio unlock happens in
  // the same user gesture. An explicit mute survives resume and restart.
  const enableForRace = useCallback(async () => {
    if (!userMuted.current) await enable();
  }, [enable]);

  useEffect(() => { audio.current?.setVolume(volume / 100); }, [volume]);

  useEffect(() => {
    const player = state?.cars.find((car) => car.isHuman);
    const current = audio.current;
    const before = previous.current;
    previous.current = { phase: state?.phase, countdown: state?.countdown, gear: player?.gear, checkpoint: player?.checkpoint, playing, enabled };
    if (!current) return;
    const failed = (failure: unknown) => { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Audio unavailable.'); };
    if (enabled && state?.phase === 'finished' && before.phase !== 'finished' && before.playing) { void current.finish().catch(failed); return; }
    const active = enabled && playing && Boolean(state) && player?.status !== 'finished' && player?.status !== 'dnf';
    void current.setActive(active).catch(failed);
    if (!active || !state) return;
    current.update({ rpm: player?.rpm ?? 1100, speedKph: player?.speedKph ?? 0, braking: Boolean(player?.braking), boosting: Boolean(player?.boosting) });
    if (state.phase === 'countdown' && (state.countdown !== before.countdown || !before.enabled)) current.countdown();
    if (state.phase === 'running' && before.phase === 'countdown') current.countdown(true);
    if (player?.gear && before.gear && player.gear !== before.gear) current.shift();
    if (before.checkpoint !== undefined && player?.checkpoint !== before.checkpoint) current.checkpoint();
  }, [state, playing, enabled]);

  return { enabled, volume, setVolume, toggle, enableForRace, error };
}
