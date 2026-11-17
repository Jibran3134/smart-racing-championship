import { useCallback, useEffect, useRef, useState } from 'react';
import { RacingAudio } from '../audio/RacingAudio';
import type { RaceViewState } from '../adapters/race-view';
import { raceSoundState } from '../audio/race-sound-state';
import type { AudioPerspective } from '../audio/race-sound-state';

const defaultPerspective: AudioPerspective = { carId: null, overview: false };

export function useRaceAudio(state: RaceViewState | null, playing: boolean, perspective = defaultPerspective) {
  const audio = useRef<RacingAudio | null>(null);
  const mounted = useRef(false);
  const userMuted = useRef(false);
  const enableRequest = useRef(0);
  const previous = useRef<{ phase?: string; countdown?: number | null; gear?: number; checkpoint?: number; playing?: boolean; enabled?: boolean }>({});
  const [enabled, setEnabled] = useState(false);
  const [volume, setVolume] = useState(35);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; audio.current?.dispose(); audio.current = null; };
  }, []);

  const enable = useCallback(async () => {
    const request = ++enableRequest.current;
    setLoading(true);
    try {
      if (typeof AudioContext === 'undefined') throw new Error('Audio is unavailable in this browser.');
      if (!audio.current) audio.current = new RacingAudio(new AudioContext());
      const current = audio.current;
      current.setVolume(volume / 100);
      await current.resume();
      await current.loadSamples();
      if (mounted.current && audio.current === current && request === enableRequest.current) { setEnabled(true); setError(''); }
    } catch (failure) {
      if (request === enableRequest.current) {
        try { await audio.current?.setActive(false); } catch { /* Preserve the original load error. */ }
        if (mounted.current) setError(failure instanceof Error ? failure.message : 'Audio could not start.');
      }
    } finally { if (mounted.current && request === enableRequest.current) setLoading(false); }
  }, [volume]);

  const toggle = useCallback(async () => {
    if (enabled || loading) {
      userMuted.current = true;
      enableRequest.current++;
      setLoading(false);
      setEnabled(false);
      try { await audio.current?.setActive(false); }
      catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : 'Audio unavailable.'); }
      return;
    }
    userMuted.current = false;
    await enable();
  }, [enabled, loading, enable]);

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
    const active = enabled && playing && Boolean(state) && state?.phase !== 'finished';
    void current.setActive(active).catch(failed);
    if (!active || !state) return;
    current.update(raceSoundState(state, perspective));
    if (state.phase === 'countdown' && (state.countdown !== before.countdown || !before.enabled)) current.countdown();
    if (state.phase === 'running' && before.phase === 'countdown') current.countdown(true);
  }, [state, playing, enabled, perspective]);

  return { enabled, volume, setVolume, toggle, enableForRace, error, loading };
}
