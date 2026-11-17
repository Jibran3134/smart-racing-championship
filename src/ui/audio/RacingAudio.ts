import { CarAudioVoice } from './CarAudioVoice';
import { loadRacingSamples } from './racing-samples';
import type { RacingSamples } from './racing-samples';
import type { RaceSoundState } from './race-sound-state';

/** Recorded multi-car field mix; audio sources are independent of race logic. */
export class RacingAudio {
  private readonly master: GainNode;
  private readonly wind: GainNode;
  private readonly noise: AudioBufferSourceNode;
  private readonly cars = new Map<number, CarAudioVoice>();
  private readonly cues = new Set<OscillatorNode>();
  private readonly abort = new AbortController();
  private samples: RacingSamples | undefined;
  private loading: Promise<void> | undefined;
  private active = false;
  private volume = 0.35;
  private disposed = false;
  private perspective = '';
  private celebration: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: AudioContext, samples?: RacingSamples) {
    this.samples = samples;
    this.master = context.createGain(); this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -14; limiter.ratio.value = 8; limiter.attack.value = 0.004; limiter.release.value = 0.18;
    this.master.connect(limiter); limiter.connect(context.destination);
    // Wind/air and mechanical textures only; engine and tyres use recordings.
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const values = buffer.getChannelData(0); let seed = 137; let brown = 0;
    for (let index = 0; index < values.length; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      brown = (brown + 0.02 * white) / 1.02;
      values[index] = brown * 2.5 + white * 0.22;
    }
    this.noise = context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
    const filter = context.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 1100;
    this.wind = context.createGain(); this.wind.gain.value = 0;
    this.noise.connect(filter); filter.connect(this.wind); this.wind.connect(this.master); this.noise.start();
  }

  resume(): Promise<void> { return this.context.resume(); }
  loadSamples(): Promise<void> {
    if (this.samples || this.disposed) return Promise.resolve();
    if (!this.loading) this.loading = loadRacingSamples(this.context, this.abort.signal)
      .then((samples) => { if (!this.disposed) this.samples = samples; })
      .catch((error: unknown) => { this.loading = undefined; throw error; });
    return this.loading;
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.master.gain.setTargetAtTime(this.active ? this.volume : 0, this.context.currentTime, 0.02);
  }
  async setActive(active: boolean): Promise<void> {
    if (this.disposed) return;
    if (this.active === active && this.celebration === undefined && (active ? this.context.state === 'running' : this.context.state !== 'running')) return;
    this.cancelCelebration(); this.active = active;
    const time = this.context.currentTime;
    this.master.gain.cancelScheduledValues(time);
    this.master.gain.setValueAtTime(active ? this.volume : 0, time);
    if (active) await this.context.resume();
    else if (this.context.state === 'running') await this.context.suspend();
  }
  update(frame: RaceSoundState): void {
    if (this.disposed || !this.samples) return;
    const perspective = `${frame.listener.carId}-${frame.listener.overview}`;
    if (perspective !== this.perspective) { this.cars.forEach((voice) => voice.resetMotionHistory()); this.perspective = perspective; }
    const ids = new Set(frame.cars.map((car) => car.id));
    for (const [id, voice] of this.cars) if (!ids.has(id)) { voice.dispose(); this.cars.delete(id); }
    for (const car of frame.cars) {
      let voice = this.cars.get(car.id);
      if (!voice) { voice = new CarAudioVoice(this.context, this.samples, this.noise, this.master, car.id); this.cars.set(car.id, voice); }
      voice.update(car, frame);
    }
    const focus = frame.cars.find((car) => car.id === frame.listener.carId);
    this.wind.gain.setTargetAtTime(focus?.running ? Math.min(0.14, focus.speedKph / 2200) : 0, this.context.currentTime, 0.1);
  }
  countdown(go = false): void { this.tone(go ? 1046 : 523, 0, go ? 0.22 : 0.1, 0.12); }
  async finish(): Promise<void> {
    if (this.disposed) return;
    this.cancelCelebration(); this.active = false;
    const time = this.context.currentTime;
    this.cars.forEach((voice) => voice.fadeOut()); this.wind.gain.setTargetAtTime(0, time, 0.12);
    this.master.gain.setValueAtTime(this.volume, time);
    await this.context.resume();
    if (this.disposed) return;
    // Quiet race-control acknowledgement instead of a melodic arcade fanfare.
    this.tone(880, 0.15, 0.09, 0.075); this.tone(660, 0.3, 0.1, 0.075);
    this.celebration = setTimeout(() => { this.celebration = undefined; if (!this.disposed) { this.master.gain.setValueAtTime(0, this.context.currentTime); void this.context.suspend().catch(() => {}); } }, 850);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.abort.abort(); this.cancelCelebration(); this.master.gain.value = 0;
    this.cars.forEach((voice) => voice.dispose()); this.cars.clear();
    for (const source of [this.noise, ...this.cues]) { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
    this.cues.clear(); this.master.disconnect();
    if (this.context.state !== 'closed') void this.context.close().catch(() => {});
  }
  private cancelCelebration(): void { if (this.celebration !== undefined) { clearTimeout(this.celebration); this.celebration = undefined; } }
  private tone(frequency: number, delay: number, duration: number, amplitude: number): void {
    if (this.disposed) return;
    const start = this.context.currentTime + delay;
    const voice = this.context.createOscillator(); const gain = this.context.createGain();
    voice.type = 'sine'; voice.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(amplitude, start + 0.008); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    voice.connect(gain); gain.connect(this.master); this.cues.add(voice);
    voice.onended = () => { this.cues.delete(voice); voice.disconnect(); gain.disconnect(); };
    voice.start(start); voice.stop(start + duration + 0.02);
  }
}
