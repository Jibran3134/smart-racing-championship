export interface EngineSoundState { rpm: number; speedKph: number; braking: boolean; boosting: boolean }

/** Procedural Web Audio soundscape; created only after a user's sound gesture. */
export class RacingAudio {
  private readonly master: GainNode;
  private readonly engine: GainNode;
  private readonly wind: GainNode;
  private readonly tyres: GainNode;
  private readonly turbo: GainNode;
  private readonly voices: OscillatorNode[] = [];
  private readonly noise: AudioBufferSourceNode;
  private readonly cues = new Set<OscillatorNode>();
  private active = false;
  private volume = 0.35;
  private disposed = false;
  private cutUntil = 0;
  private celebration: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly context: AudioContext) {
    this.master = context.createGain(); this.master.gain.value = 0;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -18; limiter.ratio.value = 5; limiter.attack.value = 0.005; limiter.release.value = 0.15;
    this.master.connect(limiter); limiter.connect(context.destination);
    this.engine = context.createGain(); this.engine.gain.value = 0;
    const exhaust = context.createBiquadFilter(); exhaust.type = 'lowpass'; exhaust.frequency.value = 2300; exhaust.Q.value = 0.8;
    this.engine.connect(exhaust); exhaust.connect(this.master);
    const wave = context.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, 0.55, 0.3, 0.22, 0.14, 0.1, 0.07, 0.04]));
    for (const [index, ratio] of [1, 2.005, 0.501].entries()) {
      const voice = context.createOscillator(); voice.setPeriodicWave(wave);
      voice.frequency.value = 36 * ratio;
      const level = context.createGain(); level.gain.value = [0.26, 0.12, 0.14][index];
      voice.connect(level); level.connect(this.engine); voice.start(); this.voices.push(voice);
    }
    // Seeded brown noise avoids network assets and keeps the timbre reproducible.
    const buffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const samples = buffer.getChannelData(0); let seed = 137; let previous = 0;
    for (let index = 0; index < samples.length; index++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; previous = (previous + 0.02 * (seed / 2147483648 - 1)) / 1.02; samples[index] = previous * 2.5 + (seed / 2147483648 - 1) * 0.22; }
    this.noise = context.createBufferSource(); this.noise.buffer = buffer; this.noise.loop = true;
    const noiseBranch = (frequency: number, type: BiquadFilterType) => {
      const filter = context.createBiquadFilter(); filter.type = type; filter.frequency.value = frequency;
      const gain = context.createGain(); gain.gain.value = 0;
      this.noise.connect(filter); filter.connect(gain); gain.connect(this.master); return gain;
    };
    this.wind = noiseBranch(1600, 'lowpass'); this.tyres = noiseBranch(2300, 'bandpass'); this.turbo = noiseBranch(4200, 'highpass');
    this.noise.start();
  }

  resume(): Promise<void> { return this.context.resume(); }
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
  update(state: EngineSoundState): void {
    if (this.disposed) return;
    const time = this.context.currentTime;
    const fundamental = Math.max(25, Math.min(350, state.rpm / 60 * 2));
    this.voices.forEach((voice, index) => voice.frequency.setTargetAtTime(fundamental * [1, 2.005, 0.501][index], time, 0.045));
    this.engine.gain.setTargetAtTime(time < this.cutUntil ? 0.07 : 0.3 + Math.min(0.45, state.speedKph / 650), time, 0.018);
    this.wind.gain.setTargetAtTime(Math.min(0.22, state.speedKph / 1800), time, 0.08);
    this.tyres.gain.setTargetAtTime(state.braking && state.speedKph > 80 ? 0.18 : 0, time, 0.035);
    this.turbo.gain.setTargetAtTime(state.boosting ? 0.32 : 0, time, 0.035);
  }
  countdown(go = false): void { this.tone(go ? 1046 : 523, 0, go ? 0.32 : 0.12, 0.22); }
  shift(): void { this.cutUntil = this.context.currentTime + 0.08; this.tone(90, 0, 0.065, 0.1); }
  checkpoint(): void { this.tone(1396, 0, 0.055, 0.05); }
  async finish(): Promise<void> {
    if (this.disposed) return;
    this.cancelCelebration(); this.active = false;
    const time = this.context.currentTime;
    this.engine.gain.setValueAtTime(0, time); this.wind.gain.setValueAtTime(0, time); this.tyres.gain.setValueAtTime(0, time); this.turbo.gain.setValueAtTime(0, time);
    this.master.gain.setValueAtTime(this.volume, time);
    await this.context.resume();
    if (this.disposed) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => this.tone(frequency, index * 0.12, 0.2, 0.13));
    this.celebration = setTimeout(() => { this.celebration = undefined; if (!this.disposed) { this.master.gain.setValueAtTime(0, this.context.currentTime); void this.context.suspend().catch(() => {}); } }, 850);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.cancelCelebration(); this.master.gain.value = 0;
    for (const source of [...this.voices, this.noise, ...this.cues]) { try { source.stop(); source.disconnect(); } catch { /* Already ended. */ } }
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
