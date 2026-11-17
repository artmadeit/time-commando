// Sonido 100% sintetizado con WebAudio (sin archivos).

export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private crowdGain: GainNode | null = null;
  private musicTimer = 0;
  private seq = 0;
  private nextTime = 0;
  intensity = 0; // 0 = exploración, 1 = combate

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(this.ctx.destination);
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(comp);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.32;
    this.music.connect(this.master);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1, when = 0, out?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out ?? this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, when = 0, out?: AudioNode, attack = 0.005) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out ?? this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  swing(heavy = false) { this.noise(heavy ? 0.28 : 0.18, 'bandpass', heavy ? 500 : 900, heavy ? 1800 : 3200, heavy ? 0.4 : 0.28, 1.6); }
  hit(heavy = false) {
    this.tone('sine', heavy ? 140 : 180, 45, heavy ? 0.3 : 0.18, heavy ? 0.9 : 0.6);
    this.noise(0.12, 'lowpass', 2500, 300, heavy ? 0.6 : 0.4);
  }
  clang() {
    for (const f of [620, 1480, 2330, 3410]) this.tone('triangle', f, f * 0.97, 0.45, 0.07);
    this.noise(0.08, 'highpass', 4000, 6000, 0.25);
  }
  hurt() { this.tone('sawtooth', 240, 90, 0.22, 0.18); this.noise(0.15, 'lowpass', 1200, 200, 0.4); }
  step() { this.noise(0.06, 'lowpass', 700, 200, 0.06); }
  roll() { this.noise(0.32, 'lowpass', 900, 150, 0.22); }
  pickup() { [660, 880, 1320, 1760].forEach((f, i) => this.tone('sine', f, f, 0.25, 0.14, i * 0.06)); }
  heal() { [523, 659, 784].forEach((f, i) => this.tone('triangle', f, f * 1.01, 0.35, 0.12, i * 0.08)); }
  spawn() { this.tone('sine', 900, 120, 0.6, 0.18); this.noise(0.5, 'bandpass', 3000, 300, 0.2, 4); }
  gate() { this.tone('sine', 120, 700, 0.9, 0.22); this.noise(0.9, 'bandpass', 400, 4000, 0.15, 3); }
  slam() { this.tone('sine', 90, 30, 0.6, 1.0); this.noise(0.5, 'lowpass', 900, 80, 0.8); }
  portal() { this.tone('sine', 80, 900, 2.2, 0.35, 0, undefined, 0.6); this.noise(2.0, 'bandpass', 200, 5000, 0.2, 2); }
  death() { this.tone('sine', 200, 60, 0.6, 0.4); this.noise(0.4, 'lowpass', 800, 100, 0.3); }
  blockBreak() { this.clang(); this.tone('square', 300, 80, 0.3, 0.12); }

  crowd(level: number) {
    const c = this.ctx;
    if (!c) return;
    if (!this.crowdGain) {
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 700;
      f.Q.value = 0.7;
      this.crowdGain = c.createGain();
      this.crowdGain.gain.value = 0;
      src.connect(f).connect(this.crowdGain).connect(this.master);
      src.start();
    }
    this.crowdGain.gain.setTargetAtTime(level * 0.12, c.currentTime, 0.5);
  }

  /** Música procedural: tambores de guerra + bajo + melodía modal */
  startMusic() {
    const c = this.ctx;
    if (!c || this.musicTimer) return;
    this.nextTime = c.currentTime + 0.1;
    const bpm = 96;
    const sixteenth = 60 / bpm / 4;
    // Re frigio (D Eb F G A Bb C)
    const scale = [146.83, 155.56, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66];
    const bassLine = [0, 0, 1, 0, 5, 5, 4, 3];
    const melody = [7, -1, 5, 4, 5, -1, 3, 1, 3, -1, 2, 1, 0, -1, -1, -1, 4, -1, 5, 7, 5, 4, 3, -1, 1, 3, 1, 0, 1, -1, 0, -1];
    const tick = () => {
      if (!this.ctx) return;
      while (this.nextTime < this.ctx.currentTime + 0.2) {
        const s = this.seq;
        const when = this.nextTime - this.ctx.currentTime;
        const bar16 = s % 16;
        const I = this.intensity;
        // tambor grave
        if (bar16 === 0 || bar16 === 6 || bar16 === 10 || (I > 0.5 && bar16 === 14)) {
          this.tone('sine', 110, 38, 0.4, 0.55, when, this.music);
          this.noise(0.08, 'lowpass', 600, 100, 0.2, 1, when, this.music);
        }
        // caja/marcha
        if (I > 0.3 && (bar16 === 4 || bar16 === 12)) this.noise(0.14, 'bandpass', 1800, 900, 0.22 * I, 1, when, this.music);
        if (I > 0.6 && s % 2 === 1) this.noise(0.03, 'highpass', 7000, 8000, 0.05, 1, when, this.music);
        // bajo
        if (bar16 % 4 === 0) {
          const n = scale[bassLine[Math.floor(s / 16) % bassLine.length]] / 2;
          this.tone('sawtooth', n, n, sixteenth * 3.6, 0.07 + I * 0.05, when, this.music, 0.02);
          this.tone('sine', n / 2, n / 2, sixteenth * 3.8, 0.18, when, this.music, 0.02);
        }
        // melodía (solo cada 2 compases para dejar aire)
        const m = melody[s % melody.length];
        if (m >= 0 && Math.floor(s / 32) % 2 === 0) {
          const f = scale[m] * 2;
          this.tone('triangle', f, f, sixteenth * 2.4, 0.06 + I * 0.03, when, this.music, 0.02);
        }
        // pad/drone
        if (s % 64 === 0) {
          for (const f of [73.42, 110, 146.83]) this.tone('sawtooth', f, f * 1.002, sixteenth * 64, 0.025, when, this.music, 1.5);
        }
        this.nextTime += sixteenth;
        this.seq++;
      }
    };
    this.musicTimer = window.setInterval(tick, 50);
  }
}
