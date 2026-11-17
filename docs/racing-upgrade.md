# Route racing and sound upgrade

Requested 17 November 2026. The selected control style is **route-based automatic racing with player-controlled nitro**, matching the project brief. This update replaces the app's snapshot-only race preview with a continuously simulated driving demo.

## Try it

Run `npm run dev`, open **Race**, choose **Start driving demo**, optionally choose **Enable sound**, then **Start race**. After the start-light countdown, cars accelerate and brake automatically along the supplied circuit route.

| Control | Action |
| --- | --- |
| N | Activate one nitro charge while racing; a second activation waits for the first boost to expire |
| Space | Pause/resume, including the start sequence |
| C | Switch follow/circuit cameras |
| M | Enable/mute sound |
| Camera car | Follow a chosen racer without changing the human-controlled car |
| − / 1:1 / + | Adjust/reset camera zoom |
| Fullscreen | Expand the racing viewport; native Escape exits |
| Master volume | Set synthesized audio volume |

Keyboard shortcuts apply when the racing viewport has focus: click/tap the circuit first. They do not intercept input/select/button controls. Mobile users have camera, pause and nitro buttons. Leaving the race or hiding the browser tab pauses advancement; returning starts paused.

## Driving session

`src/core/engine/RouteRace.ts` is a deterministic, model-independent supplied-route session. This implementation is scoped to the user's racing upgrade and does not freeze the jointly owned shared record/config files. Alishba can review/reuse it or replace it through the existing `RaceDriver` interface when the complete engine is integrated.

- Fixed 1/120-second updates make the same inputs reproducible across different caller frame partitions.
- Cars start on a staggered grid on the start approach, follow actual legal graph edges continuously, accelerate, brake before corners and obey effective speed caps.
- The supplied lap route must return to the start and visit mandatory checkpoints in order. Laps count only when those checkpoints and the lap boundary are complete.
- Nitro consumes one charge, raises the speed target and doubles fuel consumption over the boosted travelled portion. Boosts cannot stack, and fuel remains constrained.
- Effective difficulty affects speed and fuel. A car unable to afford its next road stops as DNF; depletion while boosting also ends its race.
- The existing `EventProcessor` handles scheduled closures/restrictions/oil and independent expiries. Cars already on a subsequently closed road may complete that road; cars waiting to enter it wait for reopening, with elapsed time continuing. A configured limit prevents indefinite waiting.
- A supplied route may include active fuel stations/pickups: the session supports the brief's below-25% stop rule, capped purchases, stop time, nitro capacity and pickup consumption. The default main-loop demonstration route does not detour to the internal service vertices.
- Running positions are determined from completion time or lap/checkpoint/travel progress with racer-ID ties. No championship points or sorting-family algorithms are implemented by the driving session.

The draft setup in `src/ui/fixtures/driving-demo.ts` explicitly supplies two laps, three starting nitro charges, a four-second 1.5× boost, 2× boost fuel use, fuel capacity 100, difficulty-scaled consumption, acceleration/braking, service/time limits and deterministic event inputs. These are demonstration tunings, not jointly frozen course configuration. The rivals use fixed routes with different deterministic pace values. The three official opponent strategies, route optimization, resource recommendation and real championship progression remain integration work.

The old `recorded-race.ts` is retained as a presentation test fixture; it is no longer the app's driving entry point. Example dashboard data remains an independent, labelled sample season. Driving-demo results are not converted into fabricated championship points.

## Racing scene

`RaceScene` and `race-renderer.ts` draw the simulation state using Canvas 2D. Detailed code-native formula-style cars include suspension/tyres, bodywork, wings, cockpit/helmet, brake lights and nitro exhaust. The circuit uses continuous asphalt junctions, red/white kerbs, markings, barriers, service markers, trackside buildings, trees, a start line and a minimap.

The camera follows the selected car by default or shows the entire circuit. The cockpit displays provider-supplied speed, RPM, gear, braking/boost state, start lights and the chequered-flag result. Rendering heading smoothing and lane offsets are presentation only and never change graph traversal or race outcomes. DPR is capped at 2. No second animation loop is introduced; the scene redraws from the existing race controller's snapshots. Reduced-motion settings disable decorative flame flicker and heading interpolation while retaining essential car movement.

This is a 2D route-racing model with arcade acceleration/corner braking. It does not claim professional tyre, collision, suspension or aerodynamic simulation. Car movement and effects are functional; the complete three-circuit championship still depends on the remaining modules and joint rule review.

## Audio

`RacingAudio` synthesizes engine harmonics/exhaust, wind, tyre scrub, turbo/boost, gear cuts, countdown/go tones, checkpoint cues and a finish fanfare. It downloads no audio assets and requires no additional package. Pitch follows RPM; noise/envelopes follow speed, braking and boost.

Audio is instantiated/resumed only after **Enable sound** or the sound hotkey. Master volume defaults to 35%. Pause/mute suspend the audio context; leaving the race stops/disconnects sources, clears the fanfare timer and closes the context. Unsupported/blocked audio produces a status message while racing remains usable. Implementation follows [MDN's Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices) and [AudioContext resume behavior](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume).

## Verification

Core tests cover countdown, fixed-step equivalence, full ordered two-lap finishes, position continuity through road changes, nitro charge/fuel/expiry behavior, waiting/reopening, fuel DNF, time limits, service stops, pickup capacity/consumption and independent snapshots/configuration.

Audio tests cover silent initialization, RPM changes, pause/mute suspension, race cues, fanfare termination, source disconnection and context disposal. UI tests cover camera/hotkeys, input-field isolation, unsupported audio and hidden-tab pausing. Existing exploration/event/dashboard tests remain in place.

Chrome checks additionally measured a non-zero live Web Audio output signal, checked countdown/racing/nitro, camera views, mute/resume/cleanup, and responsive layouts at 320/390/768/1600 pixels. Hardware-specific speaker/headphone playback and subjective sound quality still need user review.
