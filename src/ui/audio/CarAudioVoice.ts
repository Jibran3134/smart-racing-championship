import type { RacingSamples } from './racing-samples';
import type { CarSoundState, RaceSoundState } from './race-sound-state';
import { spatialMix } from './race-sound-state';

/** One independently pitched, filtered and spatialized recorded car. */
export class CarAudioVoice {
  private readonly engine: AudioBufferSourceNode;
  private readonly gearCut: GainNode;
  private readonly naturalRpm: number;
  private readonly tyre: AudioBufferSourceNode;
  private readonly output: GainNode;
  private readonly engineLevel: GainNode;
  private readonly tyreLevel: GainNode;
  private readonly boostLevel: GainNode;
  private readonly mechanicalLevel: GainNode;
  private readonly exhaust: BiquadFilterNode;
  private readonly panner: StereoPannerNode;
  private readonly boostFilter: BiquadFilterNode;
  private readonly mechanicalFilter: BiquadFilterNode;
  private readonly nodes: AudioNode[] = [];
  private history: { clock: number; distance: number; speed: number; gear: number } | undefined;
  private blipUntil = 0;
  private readonly profile: number;

  constructor(private readonly context: AudioContext, samples: RacingSamples, private readonly noise: AudioBufferSourceNode, destination: AudioNode, id: number) {
    this.profile = [0.992, 1.006, 1.012, 0.985][Math.abs(id) % 4];
    // Crank fundamentals measured from the original loops: ~102.5 and ~129 Hz.
    // Direct RPM / recorded RPM preserves the firing harmonics across the rev range.
    const v10 = id % 2 !== 0;
    const recording = v10 ? samples.v10 : samples.v8;
    this.naturalRpm = v10 ? 6150 : 7750;
    this.output = context.createGain(); this.output.gain.value = 0;
    this.panner = context.createStereoPanner(); this.output.connect(this.panner); this.panner.connect(destination);
    this.exhaust = context.createBiquadFilter(); this.exhaust.type = 'lowpass'; this.exhaust.frequency.value = 12000; this.exhaust.Q.value = 0.45;
    this.exhaust.connect(this.output);
    this.engineLevel = context.createGain(); this.engineLevel.gain.value = 0;
    this.gearCut = context.createGain(); this.gearCut.gain.value = 1;
    const rumbleCut = context.createBiquadFilter(); rumbleCut.type = 'highpass'; rumbleCut.frequency.value = 100; rumbleCut.Q.value = 0.5;
    this.engineLevel.connect(this.gearCut); this.gearCut.connect(rumbleCut); rumbleCut.connect(this.exhaust);
    const createLoop = (buffer: AudioBuffer, destination: AudioNode, offset: number) => {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(destination); source.start(context.currentTime, offset % buffer.duration); return source;
    };
    this.engine = createLoop(recording, this.engineLevel, id * 0.317);
    this.tyreLevel = context.createGain(); this.tyreLevel.gain.value = 0; this.tyreLevel.connect(this.output);
    this.tyre = createLoop(samples.tyres, this.tyreLevel, id * 0.41);
    this.boostFilter = context.createBiquadFilter(); this.boostFilter.type = 'highpass'; this.boostFilter.frequency.value = 1800;
    this.boostLevel = context.createGain(); this.boostLevel.gain.value = 0;
    noise.connect(this.boostFilter); this.boostFilter.connect(this.boostLevel); this.boostLevel.connect(this.output);
    this.mechanicalFilter = context.createBiquadFilter(); this.mechanicalFilter.type = 'bandpass'; this.mechanicalFilter.frequency.value = 320; this.mechanicalFilter.Q.value = 0.6;
    this.mechanicalLevel = context.createGain(); this.mechanicalLevel.gain.value = 0;
    noise.connect(this.mechanicalFilter); this.mechanicalFilter.connect(this.mechanicalLevel); this.mechanicalLevel.connect(this.output);
    this.nodes.push(this.engine, this.tyre, this.output, this.engineLevel, this.gearCut, rumbleCut, this.tyreLevel, this.boostLevel, this.mechanicalLevel, this.exhaust, this.panner, this.boostFilter, this.mechanicalFilter);
  }

  resetMotionHistory(): void { this.history = undefined; this.blipUntil = 0; }

  update(car: CarSoundState, frame: RaceSoundState): void {
    const now = this.context.currentTime;
    const distance = Math.hypot(car.x - frame.listener.x, car.y - frame.listener.y);
    const dt = this.history ? frame.clock - this.history.clock : 0;
    const validHistory = this.history && dt > 0 && dt < 0.4;
    const radialSpeed = validHistory ? (distance - this.history!.distance) / dt : 0;
    const acceleration = validHistory ? (car.speedKph - this.history!.speed) / (3.6 * dt) : 0;
    const mix = spatialMix(car, frame.listener, radialSpeed);
    if (validHistory && car.gear > 0 && this.history!.gear > 0 && car.gear !== this.history!.gear) {
      const downshift = car.gear < this.history!.gear;
      this.blipUntil = downshift ? now + 0.09 : 0;
      this.gearCut.gain.cancelScheduledValues(now);
      this.gearCut.gain.setValueAtTime(downshift ? 0.75 : 0.16, now);
      this.gearCut.gain.linearRampToValueAtTime(1, now + (downshift ? 0.035 : 0.065));
      this.mechanicalLevel.gain.cancelScheduledValues(now);
      this.mechanicalLevel.gain.setValueAtTime(0.0001, now);
      this.mechanicalLevel.gain.linearRampToValueAtTime(car.gear < this.history!.gear ? 0.025 : 0.012, now + 0.008);
      this.mechanicalLevel.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    }
    const load = car.speedKph < 4 ? 0.45 : car.braking ? 0.24 : acceleration > 0.3 ? 1 : 0.78;
    const blip = now < this.blipUntil ? 1 + (this.blipUntil - now) / 0.09 * 0.075 : 1;
    const rate = Math.max(0.45, Math.min(2.65, car.rpm / this.naturalRpm)) * this.profile * mix.doppler * blip;
    this.engine.playbackRate.setTargetAtTime(rate, now, 0.022);
    this.tyre.playbackRate.setTargetAtTime(0.87 + Math.min(0.25, car.speedKph / 1000), now, 0.08);
    this.engineLevel.gain.setTargetAtTime(0.32 + load * 0.58, now, car.braking ? 0.035 : 0.06);
    // Keep the upper firing harmonics audible, including on the overrun.
    this.exhaust.frequency.setTargetAtTime(Math.min(mix.lowpass, 5500 + car.rpm * 0.6) * (car.braking ? 0.85 : 1), now, 0.045);
    const groupLevel = 1.1 / Math.sqrt(Math.max(1, frame.cars.length));
    this.output.gain.setTargetAtTime(car.running ? mix.gain * groupLevel : 0, now, 0.08);
    this.panner.pan.setTargetAtTime(mix.pan, now, 0.085);
    this.tyreLevel.gain.setTargetAtTime(car.running && car.braking && car.speedKph > 90 ? 0.035 : 0, now, 0.07);
    this.boostLevel.gain.setTargetAtTime(car.running && car.boosting ? 0.045 : 0, now, 0.04);
    this.history = { clock: frame.clock, distance, speed: car.speedKph, gear: car.gear };
  }

  fadeOut(): void { this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.12); }
  dispose(): void {
    for (const source of [this.engine, this.tyre]) { try { source.stop(); } catch { /* Already stopped. */ } }
    this.noise.disconnect(this.boostFilter); this.noise.disconnect(this.mechanicalFilter);
    this.nodes.forEach((node) => node.disconnect());
  }
}
