# Formula engine race audio

The race uses two formula engine loops from Speed Dreams: `renault-v10.wav` and `v8_formula.wav`, plus a recorded tyre loop. Each racer has an independent engine voice, with alternating V10/V8 sound banks, small pitch variations and different loop offsets. These are simulator sound assets, rather than recordings of four real F1 teams. The V8 source is a GT recording adapted by the upstream project into a formula loop.

Playback speed is RPM divided by the loop's estimated reference RPM (6150 for the V10, 7750 for the V8), based on its crank/firing harmonic spectrum. This replaces the generic pitch offset and half-speed bass duplication. Upper engine harmonics remain audible; tyre, wind and nitro layers sit below the engines.

The driving demo now presents an eight-speed gearbox with a 14500 RPM shift point, launch clutch revs, RPM drops on upshift and hysteresis on downshift. Top gear no longer repeatedly resets revs across arbitrary speed bands. This is presentation telemetry for the supplied-route demo; core racing rules and shared configuration are unchanged. Each car's gear change schedules a short torque cut; a braking downshift adds a brief rev blip. The dashboard uses the same RPM values and redline.

The selected camera car is the audio listener. Nearby rivals stay audible, distant cars fade and lose high frequencies, and horizontal separation controls stereo position. Relative distance changes produce bounded Doppler shifts. Changing camera resets motion history to avoid a false pitch swoop. Circuit view uses a balanced field mix. Cars finishing or retiring fade individually while the remaining field continues.

Sound unlocks on Start race. Pause and mute suspend playback; explicit mute survives resume and restart. Samples load once per session, failed loads can be retried, and muting during loading prevents delayed automatic playback. Leaving the race aborts pending loads, stops sources and closes the audio context.

## Assets and attribution

See [CREDITS.txt](../public/audio/CREDITS.txt) for source URLs, authors, licenses and original hashes. The V10 adaptation retains the upstream Free Art License; the V8 is CC0; the tyre recording is CC BY 3.0. Formula processing removes DC offset, normalizes levels and applies an 8ms seam crossfade. Upstream declarations and the Free Art License text ship with the assets. All recordings load locally; no external audio service is needed during a race.

## Verification

Unit tests check rising revs, RPM drops, gear hysteresis, top-gear continuity, scheduled shift envelopes, downshift blips, independent sources, spatial audio, loading and cleanup. UI tests check automatic start, mute persistence, mute during loading and camera perspective. Browser checks trace all four engines through acceleration and shifts. Subjective realism and speaker/headphone balance remain listening judgments.
