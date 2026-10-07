// Tiny synthesis DSL used by every sound recipe and every music instrument.
//
//   const bp = v.filt('bandpass', [[0, 800], [0.2, 4000, 'e']], 3);
//   v.noise('white', { g: perc(0.6, 0.25), to: bp });
//   v.tone('sawtooth', [[0, 90], [0.4, 45, 'e']], { g: perc(0.8, 0.5), to: v.drive(3) });
//
// Times are seconds relative to the source's own start `t` (and the voice start), scaled by the
// voice's time scale (playback-rate style pitch: pitch 2 → twice as high, twice as short).
// Frequencies passed to tone()/filt()/bell() are multiplied by the voice's pitch factor.

import { driveCurve, noiseBuffer, periodicWave, type CustomWave, type NoiseKind } from './engine';

/** Envelope point: [time, value, curve INTO this point: 'l' linear (default) | 'e' exponential | 's' step]. */
export type Pt = readonly [number, number, ('l' | 'e' | 's')?];
/** A constant or a list of points. */
export type Env = number | readonly Pt[];
export type Wave = Exclude<OscillatorType, 'custom'> | CustomWave;

export interface SrcOpts {
  /** Start time (s, relative to the voice). */
  t?: number;
  /** Duration (s). Default: the end of the gain envelope (+ 20 ms). */
  d?: number;
  /** Gain envelope (times relative to `t`). Default 1. */
  g?: Env;
  /** Destination node or param (default: the voice output). */
  to?: AudioNode | AudioParam;
  /** Detune in cents (constant or envelope). */
  detune?: Env;
}

export interface Tone {
  osc: OscillatorNode;
  amp: GainNode;
}

// ------------------------------------------------------------------ envelope shorthands

/** Percussive: `att` linear rise to `peak`, exponential fall over `dec`. */
export function perc(peak: number, dec: number, att = 0.002): Pt[] {
  return [
    [0, 0],
    [att, peak],
    [att + dec, 0.0001, 'e'],
  ];
}

/** Attack → hold → exponential release. */
export function ahr(peak: number, att: number, hold: number, rel: number): Pt[] {
  return [
    [0, 0],
    [att, peak],
    [att + hold, peak],
    [att + hold + rel, 0.0001, 'e'],
  ];
}

/** Slow swell (exponential-ish rise), then a quick cut — reverse-cymbal / riser shape. */
export function swell(peak: number, rise: number, cut = 0.03): Pt[] {
  return [
    [0, 0.0001],
    [rise * 0.6, peak * 0.25, 'e'],
    [rise, peak, 'e'],
    [rise + cut, 0.0001, 'e'],
  ];
}

function envEnd(e: Env | undefined): number {
  if (e === undefined || typeof e === 'number') return 0;
  return e.length ? e[e.length - 1][0] : 0;
}

function link(node: AudioNode, to: AudioNode | AudioParam): void {
  if (to instanceof AudioParam) node.connect(to);
  else node.connect(to);
}

export function midiHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

// ------------------------------------------------------------------ voice

export class Voice {
  /** Latest stop time (relative, unscaled seconds). */
  end = 0;
  /** True once a sub-layer was placed with panner() (the voice's output is stereo). */
  stereo = false;
  readonly sources: AudioScheduledSourceNode[] = [];

  constructor(
    readonly ctx: BaseAudioContext,
    /** Default destination of every source. */
    readonly out: AudioNode,
    /** Absolute context time of relative t = 0. */
    readonly t0: number,
    /** Pitch factor (frequencies ×pm, times ÷pm). */
    readonly pm = 1,
    readonly rnd: () => number = Math.random,
  ) {}

  /** Absolute context time of relative time `x`. */
  at(x: number): number {
    return this.t0 + x / this.pm;
  }

  /** Uniform random in [lo, hi). */
  r(lo: number, hi: number): number {
    return lo + (hi - lo) * this.rnd();
  }

  /** Schedule an envelope on a param. `k` scales values, `t` offsets times. */
  set(param: AudioParam, e: Env, t = 0, k = 1): void {
    if (typeof e === 'number') {
      param.setValueAtTime(e * k, this.at(t));
      return;
    }
    let prev = 0;
    for (let i = 0; i < e.length; i++) {
      const [x, val, c] = e[i];
      const v = val * k;
      const when = this.at(t + x);
      if (i === 0 || c === 's') param.setValueAtTime(v, when);
      else if (c === 'e' && prev * v > 0) param.exponentialRampToValueAtTime(v, when);
      else param.linearRampToValueAtTime(v, when);
      prev = v;
    }
  }

  private run(src: AudioScheduledSourceNode, t: number, d: number, offset?: number): void {
    const start = this.at(t);
    if (offset !== undefined) (src as AudioBufferSourceNode).start(start, offset);
    else src.start(start);
    src.stop(this.at(t + d) + 0.02);
    this.end = Math.max(this.end, t + d);
    this.sources.push(src);
  }

  /** Gain stage with an envelope; returns the node (connect sources into it). */
  amp(e: Env, o: { t?: number; to?: AudioNode } = {}): GainNode {
    const g = this.ctx.createGain();
    this.set(g.gain, e, o.t ?? 0);
    g.connect(o.to ?? this.out);
    return g;
  }

  /** Oscillator → gain envelope → destination. */
  tone(w: Wave, f: Env, o: SrcOpts = {}): Tone {
    const t = o.t ?? 0;
    const osc = this.ctx.createOscillator();
    if (w === 'p12' || w === 'p25' || w === 'p33' || w === 'organ' || w === 'reed') osc.setPeriodicWave(periodicWave(this.ctx, w));
    else osc.type = w;
    this.set(osc.frequency, f, t, this.pm);
    if (o.detune !== undefined) this.set(osc.detune, o.detune, t);
    const amp = this.ctx.createGain();
    this.set(amp.gain, o.g ?? 1, t);
    osc.connect(amp);
    link(amp, o.to ?? this.out);
    this.run(osc, t, o.d ?? envEnd(o.g) + 0.02);
    return { osc, amp };
  }

  /** Looping noise → gain envelope → destination. `rate` bends the noise colour (playbackRate). */
  noise(kind: NoiseKind, o: SrcOpts & { rate?: Env } = {}): { src: AudioBufferSourceNode; amp: GainNode } {
    const t = o.t ?? 0;
    const src = this.ctx.createBufferSource();
    src.buffer = noiseBuffer(this.ctx, kind);
    src.loop = true;
    if (o.rate !== undefined) this.set(src.playbackRate, o.rate, t);
    const amp = this.ctx.createGain();
    this.set(amp.gain, o.g ?? 1, t);
    src.connect(amp);
    link(amp, o.to ?? this.out);
    this.run(src, t, o.d ?? envEnd(o.g) + 0.02, this.rnd() * 2);
    return { src, amp };
  }

  /** Biquad filter (frequency ×pitch). */
  filt(type: BiquadFilterType, f: Env, q: Env = 0.707, o: { t?: number; to?: AudioNode | AudioParam; gain?: number } = {}): BiquadFilterNode {
    const t = o.t ?? 0;
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    this.set(b.frequency, f, t, this.pm);
    this.set(b.Q, q, t);
    if (o.gain !== undefined) b.gain.value = o.gain;
    link(b, o.to ?? this.out);
    return b;
  }

  /**
   * Random wander added onto a param (pitch jitter, breath flutter): brown noise through a
   * lowpass at `rate` Hz, scaled by `depth` (param units, e.g. cents for detune).
   */
  wander(param: AudioParam, rate: number, depth: Env, o: { t?: number; d: number }): void {
    const g = this.ctx.createGain();
    this.set(g.gain, depth, o.t ?? 0);
    g.connect(param);
    const lp = this.filt('lowpass', rate / this.pm, 0.5, { to: g });
    this.noise('brown', { t: o.t, d: o.d, g: 2.5, to: lp });
  }

  /** tanh waveshaper (drive 1 warm … 20 fuzz) with an output trim. */
  drive(drive: number, o: { to?: AudioNode; trim?: number } = {}): AudioNode {
    const ws = this.ctx.createWaveShaper();
    ws.curve = driveCurve(drive);
    ws.oversample = '2x';
    const trim = this.ctx.createGain();
    trim.gain.value = o.trim ?? 1;
    ws.connect(trim).connect(o.to ?? this.out);
    return ws;
  }

  /** Stereo placement (−1..1) for a sub-layer. */
  panner(p: Env, o: { t?: number; to?: AudioNode } = {}): AudioNode {
    const to = o.to ?? this.out;
    this.stereo = true;
    const ctx = this.ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (!ctx.createStereoPanner) {
      const g = this.ctx.createGain();
      g.connect(to);
      return g;
    }
    const sp = ctx.createStereoPanner();
    this.set(sp.pan, p, o.t ?? 0);
    sp.connect(to);
    return sp;
  }

  /** LFO added onto a param: `depth` in the param's own units (use detune for pitch). */
  lfo(param: AudioParam, rate: Env, depth: Env, o: { t?: number; d?: number; w?: Wave } = {}): OscillatorNode {
    const t = o.t ?? 0;
    const g = this.ctx.createGain();
    this.set(g.gain, depth, t);
    const { osc } = this.tone(o.w ?? 'sine', rate, { t, d: o.d ?? Math.max(0.05, envEnd(depth)), to: g });
    // tone() scales rate by pitch already (LFOs follow playback rate like everything else)
    g.connect(param);
    return osc;
  }

  /**
   * Ring modulator: returns an input node; signal × oscillator(rate) → destination.
   * `mix` 1 = pure ring mod, 0.5 = half AM (keeps the dry signal).
   */
  ring(rate: Env, o: { t?: number; d: number; to?: AudioNode; w?: Wave; mix?: number }): GainNode {
    const t = o.t ?? 0;
    const mix = o.mix ?? 1;
    const g = this.ctx.createGain();
    g.gain.value = 1 - mix;
    g.connect(o.to ?? this.out);
    this.tone(o.w ?? 'sine', rate, { t, d: o.d, g: mix, to: g.gain });
    return g;
  }

  /**
   * FM bell / metal: sine carrier `f`, sine modulator at f×ratio with a decaying index.
   * `index` is the peak modulation depth in multiples of f.
   */
  bell(f: number, o: { t?: number; g?: number; dec?: number; ratio?: number; index?: number; idxDec?: number; to?: AudioNode; detune?: number }): Tone {
    const t = o.t ?? 0;
    const dec = o.dec ?? 1;
    const ratio = o.ratio ?? 3.5;
    const index = o.index ?? 2;
    const car = this.tone('sine', f, { t, g: perc(o.g ?? 0.3, dec, 0.002), to: o.to, detune: o.detune });
    const modG = this.ctx.createGain();
    this.set(modG.gain, perc(index * f, o.idxDec ?? dec * 0.5, 0.001), t, this.pm);
    this.tone('sine', f * ratio, { t, d: dec + 0.01, to: modG, detune: o.detune });
    modG.connect(car.osc.frequency);
    return car;
  }

  /**
   * Irregular amplitude flutter (vocal fry, rasp, crackling fire): returns an input node whose
   * gain is `base` ± band-limited noise around `rate` Hz (depth ≈ RMS of the wobble).
   */
  flutter(rate: number, depth: number, o: { t?: number; d: number; base?: number; to?: AudioNode }): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = o.base ?? 0.5;
    g.connect(o.to ?? this.out);
    const bp = this.filt('bandpass', rate / this.pm, 1.2, { to: g.gain });
    // white noise through a ~rate/1.2 Hz wide band has RMS ≈ 0.577·√(bw / nyquist)
    const bw = rate / 1.2;
    const k = depth / (0.577 * Math.sqrt(bw / (this.ctx.sampleRate / 2)));
    this.noise('white', { t: o.t, d: o.d, g: k, to: bp });
    return g;
  }

  /** Feedback echo; returns its input node. Wet goes to `to`. */
  echo(time: number, fb: number, o: { to?: AudioNode; wet?: number; tone?: number } = {}): GainNode {
    const inp = this.ctx.createGain();
    const dl = this.ctx.createDelay(2);
    dl.delayTime.value = time / this.pm;
    const fbG = this.ctx.createGain();
    fbG.gain.value = fb;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.tone ?? 3500;
    const wet = this.ctx.createGain();
    wet.gain.value = o.wet ?? 0.5;
    inp.connect(dl).connect(lp).connect(fbG).connect(dl);
    lp.connect(wet).connect(o.to ?? this.out);
    return inp;
  }

  /**
   * Many short noise bursts through ONE source and ONE gain param (cheap: 3–5 nodes however
   * many bursts). Bursts are sorted; each one is cut short where the next begins.
   */
  bursts(times: readonly number[], gains: readonly number[], o: { t?: number; dec: number | readonly number[]; att?: number; f?: number; q?: number; to?: AudioNode; kind?: NoiseKind; drive?: number; trim?: number }): void {
    if (!times.length) return;
    const t = o.t ?? 0;
    const order = times.map((x, i) => i).sort((a, b) => times[a] - times[b]);
    const att = o.att ?? 0.0005;
    let to: AudioNode = this.filt('bandpass', o.f ?? 3000, o.q ?? 1.2, { to: o.to });
    if (o.drive) to = this.drive(o.drive, { to, trim: o.trim ?? 0.5 });
    const amp = this.ctx.createGain();
    amp.gain.value = 0;
    amp.connect(to);
    const p = amp.gain;
    let end = 0;
    order.forEach((i, k) => {
      const at = t + times[i];
      const next = k + 1 < order.length ? t + times[order[k + 1]] : Infinity;
      const dec = typeof o.dec === 'number' ? o.dec : o.dec[i];
      const stop = Math.min(at + att + dec, next - 0.0003);
      const g = Math.max(0.0002, gains[i]);
      p.setValueAtTime(0.0001, this.at(at));
      if (stop > at + att + 0.0002) {
        p.linearRampToValueAtTime(g, this.at(at + att));
        p.exponentialRampToValueAtTime(0.0001, this.at(stop));
      }
      end = Math.max(end, stop);
    });
    p.setValueAtTime(0, this.at(end + 0.001));
    this.noise(o.kind ?? 'white', { t: t + times[order[0]], d: end - (t + times[order[0]]) + 0.01, to: amp });
  }

  /** A sparse random train of tiny noise clicks (crackle, embers, debris, riffles). */
  crackle(o: { t?: number; d: number; n: number; g: number; f?: number; q?: number; dec?: number; to?: AudioNode; kind?: NoiseKind; curve?: number; drive?: number }): void {
    const times: number[] = [];
    const gains: number[] = [];
    const decs: number[] = [];
    for (let i = 0; i < o.n; i++) {
      const k = Math.pow(this.rnd(), o.curve ?? 1);
      times.push(k * o.d);
      gains.push(o.g * (0.35 + 0.65 * this.rnd()) * (1 - 0.6 * k));
      decs.push((o.dec ?? 0.012) * (0.6 + this.rnd() * 0.8));
    }
    this.bursts(times, gains, { t: o.t, dec: decs, f: o.f, q: o.q, to: o.to, kind: o.kind, drive: o.drive });
  }
}
