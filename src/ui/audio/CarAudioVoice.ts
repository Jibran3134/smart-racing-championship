import type { RacingSamples } from './racing-samples';
import type { CarSoundState, RaceSoundState } from './race-sound-state';
import { spatialMix } from './race-sound-state';

/** One independently pitched, filtered and spatialized recorded car. */
export class CarAudioVoice {
  private readonly engine: AudioBufferSourceNode;
  private readonly bass: AudioBufferSourceNode;
  private readonly tyre: AudioBufferSourceNode;
  private readonly output: GainNode;
  private readonly engineLevel: GainNode;
  private readonly bassLevel: GainNode;
  private readonly tyreLevel: GainNode;
  private readonly boostLevel: GainNode;
  private readonly mechanicalLevel: GainNode;
  private readonly exhaust: BiquadFilterNode;
  private readonly panner: StereoPannerNode;
  private readonly boostFilter: BiquadFilterNode;
  private readonly mechanicalFilter: BiquadFilterNode;
  private readonly nodes: AudioNode[] = [];
  private history: { clock: number; distance: number; speed: number; gear: number } | undefined;
  private cutUntil = 0;
  private readonly profile: number;

  constructor(private readonly context: AudioContext, samples: RacingSamples, private readonly noise: AudioBufferSourceNode, destination: AudioNode, id: number) {
    this.profile = [0.94, 1.035, 0.985, 1.075][Math.abs(id) % 4];
    this.output = context.createGain(); this.output.gain.value = 0;
    this.panner = context.createStereoPanner(); this.output.connect(this.panner); this.panner.connect(destination);
    this.exhaust = context.createBiquadFilter(); this.exhaust.type = 'lowpass'; this.exhaust.frequency.value = 4000; this.exhaust.Q.value = 0.45;
    this.exhaust.connect(this.output);
    this.engineLevel = context.createGain(); this.engineLevel.gain.value = 0;
    this.engineLevel.connect(this.exhaust);
    const createLoop = (buffer: AudioBuffer, destination: AudioNode, offset: number) => {
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = true;
      source.connect(destination); source.start(context.currentTime, offset % buffer.duration); return source;
    };
    this.engine = createLoop(samples.engine, this.engineLevel, id * 0.217);
    const bassFilter = context.createBiquadFilter(); bassFilter.type = 'lowpass'; bassFilter.frequency.value = 230;
    this.bassLevel = context.createGain(); this.bassLevel.gain.value = 0;
    bassFilter.connect(this.bassLevel); this.bassLevel.connect(this.output);
    this.bass = createLoop(samples.engine, bassFilter, id * 0.079);
    this.tyreLevel = context.createGain(); this.tyreLevel.gain.value = 0; this.tyreLevel.connect(this.output);
    this.tyre = createLoop(samples.tyres, this.tyreLevel, id * 0.41);
    this.boostFilter = context.createBiquadFilter(); this.boostFilter.type = 'highpass'; this.boostFilter.frequency.value = 1800;
    this.boostLevel = context.createGain(); this.boostLevel.gain.value = 0;
    noise.connect(this.boostFilter); this.boostFilter.connect(this.boostLevel); this.boostLevel.connect(this.output);
    this.mechanicalFilter = context.createBiquadFilter(); this.mechanicalFilter.type = 'bandpass'; this.mechanicalFilter.frequency.value = 320; this.mechanicalFilter.Q.value = 0.6;
    this.mechanicalLevel = context.createGain(); this.mechanicalLevel.gain.value = 0;
    noise.connect(this.mechanicalFilter); this.mechanicalFilter.connect(this.mechanicalLevel); this.mechanicalLevel.connect(this.output);
    this.nodes.push(this.engine, this.bass, this.tyre, this.output, this.engineLevel, this.bassLevel, this.tyreLevel, this.boostLevel, this.mechanicalLevel, this.exhaust, this.panner, bassFilter, this.boostFilter, this.mechanicalFilter);
  }

  resetMotionHistory(): void { this.history = undefined; this.cutUntil = 0; }

  update(car: CarSoundState, frame: RaceSoundState): void {
    const now = this.context.currentTime;
    const distance = Math.hypot(car.x - frame.listener.x, car.y - frame.listener.y);
    const dt = this.history ? frame.clock - this.history.clock : 0;
    const validHistory = this.history && dt > 0 && dt < 0.4;
    const radialSpeed = validHistory ? (distance - this.history!.distance) / dt : 0;
    const acceleration = validHistory ? (car.speedKph - this.history!.speed) / (3.6 * dt) : 0;
    const mix = spatialMix(car, frame.listener, radialSpeed);
    if (validHistory && car.gear > 0 && this.history!.gear > 0 && car.gear !== this.history!.gear) {
      this.cutUntil = now + 0.085;
      this.mechanicalLevel.gain.cancelScheduledValues(now);
      this.mechanicalLevel.gain.setValueAtTime(0.0001, now);
      this.mechanicalLevel.gain.linearRampToValueAtTime(car.gear < this.history!.gear ? 0.15 : 0.07, now + 0.008);
      this.mechanicalLevel.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
    }
    const load = car.speedKph < 4 ? 0.38 : car.braking ? 0.3 : acceleration > 0.8 ? 1 : 0.7;
    const rate = Math.max(0.55, Math.min(2.3, 0.48 + car.rpm / 6000)) * this.profile * mix.doppler;
    this.engine.playbackRate.setTargetAtTime(rate, now, 0.055);
    this.bass.playbackRate.setTargetAtTime(rate * 0.5, now, 0.06);
    this.tyre.playbackRate.setTargetAtTime(0.87 + Math.min(0.25, car.speedKph / 1000), now, 0.08);
    const cut = now < this.cutUntil ? 0.25 : 1;
    this.engineLevel.gain.setTargetAtTime((0.55 + load * 0.4) * cut, now, 0.025);
    this.bassLevel.gain.setTargetAtTime((0.22 + load * 0.12) * cut, now, 0.035);
    this.exhaust.frequency.setTargetAtTime(Math.min(mix.lowpass, 1200 + car.rpm * 0.65) * (car.braking ? 0.6 : 1), now, 0.08);
    const groupLevel = 0.9 / Math.sqrt(Math.max(1, frame.cars.length));
    this.output.gain.setTargetAtTime(car.running ? mix.gain * groupLevel : 0, now, 0.08);
    this.panner.pan.setTargetAtTime(mix.pan, now, 0.085);
    this.tyreLevel.gain.setTargetAtTime(car.running && car.braking && car.speedKph > 90 ? 0.19 : 0, now, 0.045);
    this.boostLevel.gain.setTargetAtTime(car.running && car.boosting ? 0.19 : 0, now, 0.04);
    this.history = { clock: frame.clock, distance, speed: car.speedKph, gear: car.gear };
  }

  fadeOut(): void { this.output.gain.setTargetAtTime(0, this.context.currentTime, 0.12); }
  dispose(): void {
    for (const source of [this.engine, this.bass, this.tyre]) { try { source.stop(); } catch { /* Already stopped. */ } }
    this.noise.disconnect(this.boostFilter); this.noise.disconnect(this.mechanicalFilter);
    this.nodes.forEach((node) => node.disconnect());
  }
}
