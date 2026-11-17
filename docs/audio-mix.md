# Recorded multi-car race audio

The race uses one real engine recording and one recorded tyre-squeal loop, bundled locally as mono PCM WAV files. Each racer plays independent engine and half-speed bass layers with different pitch profiles and loop offsets. These are variations of the same recording, rather than recordings of four distinct engine models.

RPM controls playback speed. Acceleration/load, braking and brief gear cuts change the engine envelope and exhaust filtering. Tyre squeal follows high-speed braking, and nitro adds a restrained air texture. All cars feed a shared limiter and the user-controlled master volume.

The selected camera car is the audio listener. Nearby rivals stay audible, distant cars fade and lose high frequencies, and horizontal separation controls stereo position. Relative distance changes produce bounded Doppler shifts. Changing camera resets motion history to avoid a false pitch swoop. Circuit view uses a balanced field mix. Cars finishing or retiring fade individually while the remaining field continues.

Sound unlocks on Start race. Pause and mute suspend playback; explicit mute survives resume and restart. Samples load once per session, failed loads can be retried, and muting during loading prevents delayed automatic playback. Leaving the race aborts pending loads, stops sources and closes the audio context.

## Assets and attribution

See [CREDITS.txt](../public/audio/CREDITS.txt) for source URLs, authors, licenses and original hashes. The engine is CC0; the tyre recording is CC BY 3.0. Processing converts to mono PCM16 at 44.1 kHz, removes DC offset, normalizes levels and crossfades the loop seam. No external audio service is needed during a race.

## Verification

Unit tests check independent sources/rates/offsets, panning/distance/Doppler, reuse/retirement, decoding failures, abort and cleanup. UI tests check automatic start, mute persistence, mute during loading and camera perspective. Browser checks measure live output and verify that all four cars have independent recorded sources. Subjective realism and speaker/headphone balance remain listening judgments.
