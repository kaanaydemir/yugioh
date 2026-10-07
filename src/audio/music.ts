// Procedural chiptune music: a lookahead scheduler (setInterval pumps notes ~150 ms ahead on
// the audio clock, so timing is sample-accurate and loops are seamless) and three tracks:
//
//   title   — D minor, 84 bpm, 46 s loop. Echoing 12.5 % pulse arpeggios over a slow pad, a
//             heartbeat kick and reverse swells; the second pass adds an FM bell melody.
//   duel    — E minor, 136 bpm, 56 s loop in two 16-bar sections (A: the theme, B: a soaring
//             answer ending on the Neapolitan F → B → Em). Pulse bass, kit, arps and pad.
//             setIntensity() glides in a "hot" layer: syncopated kicks, 16th hats, snare
//             rolls, crashes, a galloping saw bass and the heroic lead (doubled in late B); a
//             jump up (≥ +0.3 to ≥ 0.5, e.g. into the battle phase) adds a drum fill + crash on
//             the next downbeat.
//   victory — 4-bar brass fanfare with timpani, then a calm C major loop. Started right after
//             the victory sting (sfx), it waits for the sting and skips its own fanfare.
//
// Mixing: strips → buses (main / hot / cool) whose echo and reverb sends are scaled post-bus,
// so intensity and track fades apply to the wet signal too. Big sfx duck the music bus.
// The same scheduler renders into an OfflineAudioContext for ?dev=audio (renderMusic(),
// scheduleMusic() — also used by renderScene() in sfx.ts).

import type { MusicTrack } from './sfx';
import { applyDuck, audio, buildChain, peekLive, rng, safe, trim, whenRunning, type Chain } from './engine';
import { midiHz, perc, Voice, type Pt } from './synth';

// ------------------------------------------------------------------ notation

const NAMES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'F#5' / 'Bb4' / 'C6' → MIDI number. */
function note(s: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`bad note ${s}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + acc;
}

/** "E5:6 F#5:2 r:4" (lengths in 16th steps) → notes keyed by start step. */
function melody(src: string): Map<number, { m: number; len: number }> {
  const out = new Map<number, { m: number; len: number }>();
  let pos = 0;
  for (const tok of src.trim().split(/\s+/)) {
    const [n, l] = tok.split(':');
    const len = Number(l);
    if (n !== 'r') out.set(pos, { m: note(n), len });
    pos += len;
  }
  return out;
}

// ------------------------------------------------------------------ mixer strips

interface StripOpts {
  level: number;
  pan?: number;
  echo?: number;
  verb?: number;
}

/** A gain that glides (setTargetAtTime) and remembers its curve, so its value at any time is known. */
class Glide {
  private from: number;
  private to: number;
  private t0 = 0;
  private tc = 0.01;
  constructor(
    readonly params: readonly AudioParam[],
    v: number,
  ) {
    this.from = this.to = v;
    for (const p of params) p.value = v;
  }
  valueAt(t: number): number {
    if (t <= this.t0) return this.from;
    return this.to + (this.from - this.to) * Math.exp(-(t - this.t0) / this.tc);
  }
  set(v: number, at: number, tc: number): void {
    const cur = this.valueAt(at);
    for (const p of this.params) {
      p.cancelScheduledValues(at);
      p.setValueAtTime(cur, at);
      p.setTargetAtTime(v, at, tc);
    }
    this.from = cur;
    this.to = v;
    this.t0 = at;
    this.tc = Math.max(0.001, tc);
  }
}

/** A gain that moves in linear ramps and remembers them (track fades). */
class Ramp {
  private a: number;
  private b: number;
  private ta = 0;
  private tb = 0;
  constructor(
    readonly params: readonly AudioParam[],
    v: number,
  ) {
    this.a = this.b = v;
    for (const p of params) p.value = v;
  }
  valueAt(t: number): number {
    if (t <= this.ta) return this.a;
    if (t >= this.tb) return this.b;
    return this.a + ((this.b - this.a) * (t - this.ta)) / (this.tb - this.ta);
  }
  to(v: number, at: number, secs: number): void {
    const cur = this.valueAt(at);
    const end = at + Math.max(0.005, secs);
    for (const p of this.params) {
      p.cancelScheduledValues(at);
      p.setValueAtTime(cur, at);
      p.linearRampToValueAtTime(v, end);
    }
    this.a = cur;
    this.b = v;
    this.ta = at;
    this.tb = end;
  }
}

/** A bus: dry signal plus its echo / reverb send collectors, all scaled by the same gain. */
interface Bus {
  dry: GainNode;
  echo: GainNode;
  verb: GainNode;
}

/**
 * Per-track routing: every part has a strip → bus (main | hot | cool). Sends are taken per strip
 * but scaled post-bus, so a quiet hot layer also has quiet echoes and reverb, and a track fade
 * (fader) also fades its reverb send.
 */
class Mix {
  readonly ctx: BaseAudioContext;
  /** Track fade (dry + echo, and the reverb send). */
  readonly fader: Ramp;
  /** Intensity layer: gain = intensity. */
  readonly hot: Glide;
  /** Parts that step back when the hot layer comes in (gain = 1 − 0.45·intensity). */
  readonly cool: Glide;
  private readonly buses: Record<'main' | 'hot' | 'cool', Bus>;
  private readonly nodes: AudioNode[] = [];
  readonly rnd = rng(77);
  /** Live mode: per-note output nodes waiting to be disconnected once their voice has ended. */
  readonly pending: Array<{ out: GainNode; v: Voice }> = [];

  constructor(
    readonly chain: Chain,
    echoTime: number,
    readonly live = false,
  ) {
    const ctx = (this.ctx = chain.ctx);
    const g = (v = 1): GainNode => {
      const n = ctx.createGain();
      n.gain.value = v;
      this.nodes.push(n);
      return n;
    };
    const fader = g();
    fader.connect(chain.music);
    // tempo-synced echo (dotted 8th), darkened each repeat
    const echoIn = g();
    const dl = ctx.createDelay(2);
    dl.delayTime.value = echoTime;
    const fb = g(0.38);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    this.nodes.push(dl, lp);
    echoIn.connect(dl).connect(lp).connect(fb).connect(dl);
    lp.connect(g(0.6)).connect(fader);
    const verbFader = g();
    verbFader.connect(g(0.8)).connect(chain.send);
    this.fader = new Ramp([fader.gain, verbFader.gain], 1);
    const bus = (to: Bus): Bus => {
      const b = { dry: g(), echo: g(), verb: g() };
      b.dry.connect(to.dry);
      b.echo.connect(to.echo);
      b.verb.connect(to.verb);
      return b;
    };
    const out: Bus = { dry: fader, echo: echoIn, verb: verbFader };
    const main = bus(out);
    const hot = bus(out);
    const cool = bus(main);
    this.buses = { main, hot, cool };
    this.hot = new Glide([hot.dry.gain, hot.echo.gain, hot.verb.gain], 0);
    this.cool = new Glide([cool.dry.gain, cool.echo.gain, cool.verb.gain], 1);
  }

  strip(o: StripOpts, bus: 'main' | 'hot' | 'cool' = 'main'): GainNode {
    const ctx = this.ctx;
    const to = this.buses[bus];
    const g = ctx.createGain();
    g.gain.value = o.level;
    this.nodes.push(g);
    let tail: AudioNode = g;
    const c = ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      this.nodes.push(p);
      tail = p;
    }
    tail.connect(to.dry);
    for (const [amt, dest] of [
      [o.echo, to.echo],
      [o.verb, to.verb],
    ] as const) {
      if (!amt) continue;
      const s = ctx.createGain();
      s.gain.value = amt;
      this.nodes.push(s);
      tail.connect(s).connect(dest);
    }
    return g;
  }

  voice(t: number, to: AudioNode): Voice {
    if (!this.live) return new Voice(this.ctx, to, t, 1, this.rnd);
    const out = this.ctx.createGain();
    out.connect(to);
    const v = new Voice(this.ctx, out, t, 1, this.rnd);
    this.pending.push({ out, v });
    return v;
  }

  /** Schedule disconnection of every note voice created since the last call. */
  reap(): void {
    const now = this.ctx.currentTime;
    for (const { out, v } of this.pending.splice(0)) {
      const ms = (v.t0 + v.end - now + 0.6) * 1000;
      setTimeout(() => safe(() => out.disconnect()), Math.max(50, ms));
    }
  }

  /** Tear the whole track graph down (after its fade-out). */
  dispose(): void {
    for (const n of this.nodes) safe(() => n.disconnect());
    this.nodes.length = 0;
  }
}

// ------------------------------------------------------------------ instruments

function scaleEnv(pts: readonly Pt[], s: number): Pt[] {
  return pts.map(([t, v, c]) => [t, v * s, c] as Pt);
}

const ins = {
  kick(mx: Mix, to: AudioNode, t: number, vel: number): void {
    const v = mx.voice(t, to);
    v.tone('sine', [[0, 150], [0.09, 48, 'e']], { g: perc(0.9 * vel, 0.28, 0.001) });
    v.tone('triangle', [[0, 420], [0.02, 110, 'e']], { g: perc(0.22 * vel, 0.03, 0.0005) });
  },
  snare(mx: Mix, to: AudioNode, t: number, vel: number): void {
    const v = mx.voice(t, to);
    v.noise('white', { g: perc(0.42 * vel, 0.14, 0.001), to: v.filt('bandpass', 2200, 0.8) });
    v.noise('white', { g: perc(0.16 * vel, 0.06), to: v.filt('highpass', 5000) });
    v.tone('triangle', [[0, 240], [0.05, 160, 'e']], { g: perc(0.38 * vel, 0.07, 0.001) });
  },
  hat(mx: Mix, to: AudioNode, t: number, vel: number, open = false): void {
    const v = mx.voice(t, to);
    v.noise('white', { g: perc(0.17 * vel, open ? 0.2 : 0.032, 0.0005), to: v.filt('highpass', 7500) });
  },
  crash(mx: Mix, to: AudioNode, t: number, vel: number): void {
    const v = mx.voice(t, to);
    v.noise('white', { g: perc(0.22 * vel, 1.5, 0.002), to: v.filt('highpass', 4500) });
    v.noise('white', { g: perc(0.1 * vel, 0.5, 0.002), to: v.filt('bandpass', 3200, 0.7) });
  },
  tom(mx: Mix, to: AudioNode, t: number, f: number, vel: number): void {
    const v = mx.voice(t, to);
    v.tone('sine', [[0, f * 1.6], [0.12, f, 'e']], { g: perc(0.6 * vel, 0.35, 0.002) });
    v.noise('pink', { g: perc(0.1 * vel, 0.05), to: v.filt('lowpass', 1500) });
  },
  timpani(mx: Mix, to: AudioNode, t: number, m: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    v.tone('sine', [[0, f * 1.12], [0.06, f, 'e']], { g: perc(0.75 * vel, 1.1, 0.002) });
    v.tone('sine', f * 1.5, { g: perc(0.18 * vel, 0.5, 0.002) });
    v.noise('brown', { g: perc(0.35 * vel, 0.12), to: v.filt('lowpass', 900) });
  },
  swell(mx: Mix, to: AudioNode, t: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    v.noise('white', { g: [[0, 0.0001], [dur * 0.7, 0.03 * vel, 'e'], [dur, 0.12 * vel, 'e'], [dur + 0.03, 0.0001, 'e']], to: v.filt('highpass', 3500) });
  },
  bass(mx: Mix, to: AudioNode, t: number, m: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    v.tone('triangle', f, { g: [[0, 0], [0.004, 0.55 * vel], [dur, 0.42 * vel], [dur + 0.05, 0.0001, 'e']] });
    v.tone('p25', f, { g: [[0, 0], [0.004, 0.11 * vel], [dur, 0.05 * vel], [dur + 0.04, 0.0001, 'e']], to: v.filt('lowpass', [[0, 2400], [0.12, 700, 'e']]) });
  },
  sawBass(mx: Mix, to: AudioNode, t: number, m: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    const lp = v.filt('lowpass', [[0, 2600], [Math.max(0.05, dur), 450, 'e']], 5);
    for (const det of [-9, 9]) v.tone('sawtooth', f, { g: [[0, 0], [0.003, 0.16 * vel], [dur, 0.1 * vel], [dur + 0.03, 0.0001, 'e']], to: lp, detune: det });
  },
  arp(mx: Mix, to: AudioNode, t: number, m: number, vel: number, dec = 0.14, w: 'p12' | 'p25' | 'triangle' = 'p12'): void {
    const v = mx.voice(t, to);
    v.tone(w, [[0, midiHz(m) * 1.012], [0.012, midiHz(m), 'e']], { g: perc(0.12 * vel, dec, 0.002) });
  },
  pad(mx: Mix, to: AudioNode, t: number, ms: readonly number[], dur: number, vel: number, cutoff = 1400): void {
    const v = mx.voice(t, to);
    const lp = v.filt('lowpass', [[0, cutoff * 0.6], [dur * 0.5, cutoff, 'e'], [dur + 1, cutoff * 0.5, 'e']], 0.6);
    for (const m of ms)
      for (const det of [-9, 9])
        v.tone('sawtooth', midiHz(m), { g: [[0, 0], [Math.min(0.7, dur * 0.3), 0.024 * vel], [dur, 0.02 * vel], [dur + 1, 0.0001, 'e']], to: lp, detune: det });
  },
  lead(mx: Mix, to: AudioNode, t: number, m: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    const lp = v.filt('lowpass', 5200, 0.8);
    const env: Pt[] = [[0, 0], [0.006, 0.15 * vel], [0.08, 0.115 * vel], [dur, 0.1 * vel], [dur + 0.09, 0.0001, 'e']];
    const a = v.tone('p25', f, { g: env, to: lp });
    const b = v.tone('p12', f, { g: scaleEnv(env, 0.45), to: lp, detune: 7 });
    if (dur > 0.25) {
      const vib: Pt[] = [[0, 0], [0.2, 0], [0.45, 16]];
      v.lfo(a.osc.detune, 5.6, vib, { d: dur + 0.1 });
      v.lfo(b.osc.detune, 5.6, vib, { d: dur + 0.1 });
    }
  },
  bell(mx: Mix, to: AudioNode, t: number, m: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    v.bell(f, { g: 0.12 * vel, dec: Math.max(0.8, dur * 1.6), ratio: 2, index: 1.3, idxDec: 0.25 });
    v.tone('sine', f * 2, { g: perc(0.025 * vel, Math.max(0.4, dur)) });
  },
  brass(mx: Mix, to: AudioNode, t: number, m: number, dur: number, vel: number): void {
    const v = mx.voice(t, to);
    const f = midiHz(m);
    const lp = v.filt('lowpass', [[0, 500], [0.04, 3600, 'e'], [Math.max(0.06, dur), 1700, 'e']], 1.3);
    // blat, settle, hold full to the end of the note, then a short release
    const env: Pt[] = [[0, 0], [0.02, 0.13 * vel], [Math.min(0.12, dur * 0.5), 0.105 * vel], [Math.max(0.13, dur), 0.095 * vel], [Math.max(0.13, dur) + 0.12, 0.0001, 'e']];
    for (const det of [-7, 7]) {
      const o = v.tone('sawtooth', f, { g: env, to: lp, detune: det });
      if (dur > 0.3) v.lfo(o.osc.detune, 5.2, [[0, 0], [0.25, 0], [0.5, 12]], { d: dur + 0.15 });
    }
  },
};

// ------------------------------------------------------------------ tracks

interface Track {
  bpm: number;
  /** Steps (16ths) played once before the loop. */
  intro: number;
  /** Loop length in steps. */
  loop: number;
  /** Has an intensity layer. */
  hot: boolean;
  setup(mx: Mix): Record<string, GainNode>;
  /** Schedule song position `pos` at time t (sd = step duration). */
  step(mx: Mix, s: Record<string, GainNode>, pos: number, t: number, sd: number, hotOn: boolean): void;
  /**
   * Optional drum fill played when the intensity jumps up (e.g. entering the battle phase):
   * called for k = 0..n-1 on the n 16ths before the next downbeat, then once with k = n on it.
   */
  fill?(mx: Mix, s: Record<string, GainNode>, t: number, k: number, n: number): void;
}

// ---- duel (E minor). 32 bars: A (Em C D B · Em C Am B, the main theme) then B (Am Em C D ·
// Am Em F B — a soaring answer that ends on the Neapolitan F → B → back to Em at the loop seam).
const DUEL_CHORDS = [
  // A
  { root: 40, tones: [64, 67, 71] }, // Em
  { root: 36, tones: [60, 64, 67] }, // C
  { root: 38, tones: [62, 66, 69] }, // D
  { root: 35, tones: [59, 63, 66] }, // B
  { root: 40, tones: [64, 67, 71] }, // Em
  { root: 36, tones: [60, 64, 67] }, // C
  { root: 33, tones: [57, 60, 64] }, // Am
  { root: 35, tones: [59, 63, 66] }, // B
  // B
  { root: 33, tones: [57, 60, 64] }, // Am
  { root: 40, tones: [59, 64, 67] }, // Em (B in the bass of the arp)
  { root: 36, tones: [60, 64, 67] }, // C
  { root: 38, tones: [62, 66, 69] }, // D
  { root: 33, tones: [57, 60, 64] }, // Am
  { root: 40, tones: [59, 64, 67] }, // Em
  { root: 41, tones: [60, 65, 69] }, // F (Neapolitan)
  { root: 35, tones: [59, 63, 66] }, // B
];
const DUEL_LEAD = melody(
  [
    // A — the theme
    'E5:6 F#5:2 G5:4 B5:4', 'A5:6 G5:2 F#5:4 E5:4',
    'G5:6 E5:2 C5:4 E5:4', 'G5:8 A5:4 G5:4',
    'F#5:6 D5:2 A4:4 D5:4', 'F#5:4 A5:4 D6:8',
    'D#5:6 F#5:2 B5:8', 'A5:4 G5:4 F#5:4 D#5:4',
    'E5:6 F#5:2 G5:4 B5:4', 'E6:8 D6:4 B5:4',
    'C6:6 B5:2 G5:4 E5:4', 'G5:8 r:4 E5:4',
    'A5:6 B5:2 C6:4 B5:4', 'A5:4 G5:4 E5:8',
    'F#5:6 G5:2 A5:4 B5:4', 'D#5:8 F#5:4 B4:4',
    // B — the answer (higher, longer notes; doubled an octave down in its second half)
    'C6:8 B5:4 A5:4', 'E5:12 A5:4',
    'B5:8 A5:4 G5:4', 'E5:12 G5:4',
    'A5:6 G5:2 E5:4 G5:4', 'C6:8 B5:4 C6:4',
    'D6:6 C6:2 A5:4 F#5:4', 'A5:8 B5:4 D6:4',
    'E6:8 D6:4 C6:4', 'A5:12 C6:4',
    'B5:6 A5:2 G5:4 B5:4', 'G5:4 F#5:4 E5:8',
    'F5:6 G5:2 A5:4 C6:4', 'F6:8 E6:4 C6:4',
    'D#6:6 C#6:2 B5:4 A5:4', 'B5:8 A5:4 F#5:2 D#5:2',
  ].join(' '),
);
const BASS_PAT = [0, 0, 12, 0, 0, 12, 0, 7];
const BASS_PAT2 = [0, 12, 0, 7, 12, 0, 7, 12];
const BASS_PAT3 = [0, 0, 7, 12, 0, 7, 12, 7];
const ARP_PAT = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3];
const ARP_PAT2 = [0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 0, 2, 3, 2, 1, 0];
const ARP_PAT3 = [3, 2, 1, 0, 1, 2, 3, 2, 3, 1, 2, 0, 1, 2, 3, 1];

const duel: Track = {
  bpm: 136,
  intro: 0,
  loop: 512,
  hot: true,
  setup: (mx) => ({
    drums: mx.strip({ level: 0.55, verb: 0.08 }),
    hats: mx.strip({ level: 0.5, pan: 0.2 }),
    bass: mx.strip({ level: 0.5 }),
    arp: mx.strip({ level: 0.42, pan: -0.25, echo: 0.3, verb: 0.15 }, 'cool'),
    pad: mx.strip({ level: 0.55, verb: 0.35 }, 'cool'),
    hdrums: mx.strip({ level: 0.62, verb: 0.1 }, 'hot'),
    hhats: mx.strip({ level: 0.48, pan: -0.15 }, 'hot'),
    hbass: mx.strip({ level: 0.55 }, 'hot'),
    lead: mx.strip({ level: 0.66, pan: 0.08, echo: 0.22, verb: 0.25 }, 'hot'),
    lead2: mx.strip({ level: 0.4, pan: -0.12, echo: 0.15, verb: 0.3 }, 'hot'),
  }),
  step(mx, s, pos, t, sd, hotOn) {
    const bar = Math.floor(pos / 16);
    const b = pos % 16;
    const ch = DUEL_CHORDS[Math.floor(bar / 2) % 16];
    const sectB = bar >= 16;
    const half2 = bar % 16 >= 8; // second half of a section: varied bass / arp figures, ghost snares
    // base kit
    if (b === 0 || b === 8 || (b === 10 && bar % 2 === 1)) ins.kick(mx, s.drums, t, b === 0 ? 1 : 0.85);
    if (sectB && b === 13 && bar % 4 === 3) ins.kick(mx, s.drums, t, 0.6);
    if (b === 4 || b === 12) ins.snare(mx, s.drums, t, 0.8);
    if (half2 && (b === 7 || b === 15) && bar % 2 === 1) ins.snare(mx, s.drums, t, 0.22);
    if (b % 2 === 0) ins.hat(mx, s.hats, t, b % 4 === 2 ? 0.55 : 0.3);
    // base bass: driving 8ths with octave pops
    const bp = sectB ? (half2 ? BASS_PAT2 : BASS_PAT3) : half2 ? BASS_PAT2 : BASS_PAT;
    if (b % 2 === 0) ins.bass(mx, s.bass, t, ch.root + bp[b / 2], sd * 1.5, b === 0 ? 1 : 0.8);
    // arpeggio
    const idx = (sectB ? ARP_PAT3 : half2 ? ARP_PAT2 : ARP_PAT)[b];
    ins.arp(mx, s.arp, t, (idx === 3 ? ch.tones[0] + 12 : ch.tones[idx]) + 12, b % 4 === 0 ? 0.9 : 0.6, 0.12);
    // pad (brighter in the B section)
    if (b === 0 && bar % 2 === 0) ins.pad(mx, s.pad, t, ch.tones.map((m) => m - 12), sd * 32, 0.9, sectB ? 2000 : 1600);
    if (!hotOn) return;
    // hot layer
    if (b === 6 || b === 11 || b === 14) ins.kick(mx, s.hdrums, t, 0.75);
    if (b % 2 === 1) ins.hat(mx, s.hhats, t, 0.4);
    if (b === 14) ins.hat(mx, s.hhats, t, 0.6, true);
    if (bar % 4 === 3 && b >= 12) ins.snare(mx, s.hdrums, t, 0.45 + (b - 12) * 0.15);
    if (bar % 4 === 3 && b === 10) ins.snare(mx, s.hdrums, t, 0.5);
    if (bar % 8 === 0 && b === 0) ins.crash(mx, s.hdrums, t, 1);
    if (b % 4 !== 1) ins.sawBass(mx, s.hbass, t, ch.root + (b % 8 === 6 ? 12 : 0), sd * 0.85, b % 4 === 0 ? 1 : 0.7);
    const n = DUEL_LEAD.get(pos);
    if (n) {
      ins.lead(mx, s.lead, t, n.m, n.len * sd * 0.92, 1);
      if (sectB && half2) ins.lead(mx, s.lead2, t, n.m - 12, n.len * sd * 0.92, 0.8);
    }
  },
  fill(mx, s, t, k, n) {
    // k = 0..n-1: a 16th snare roll rising into the downbeat; k = n: crash + kick on the downbeat
    if (k < n) {
      ins.snare(mx, s.drums, t, 0.35 + (0.5 * k) / Math.max(1, n - 1));
      if (k === n - 2) ins.tom(mx, s.drums, t, 110, 0.6);
      if (k === n - 1) ins.tom(mx, s.drums, t, 82, 0.7);
    } else {
      ins.crash(mx, s.drums, t, 0.95);
      ins.kick(mx, s.drums, t, 1);
    }
  },
};

// ---- title (D minor)
const TITLE_CHORDS = [
  { root: 38, tones: [62, 65, 69, 72, 76], pad: [53, 57, 60, 64] }, // Dm9
  { root: 34, tones: [62, 65, 69, 70, 74], pad: [50, 53, 57, 62] }, // Bbmaj7
  { root: 43, tones: [58, 62, 65, 69, 74], pad: [53, 57, 58, 62] }, // Gm9
  { root: 45, tones: [57, 62, 64, 67, 74], pad: [50, 52, 55, 57] }, // A7sus4
];
const TITLE_A7 = { tones: [57, 61, 64, 67, 73], pad: [49, 52, 55, 57] };
const TITLE_BELL = melody(
  ['A5:8 G5:4 F5:4', 'E5:12 D5:4', 'F5:8 E5:4 D5:4', 'A4:16', 'Bb4:8 D5:4 G5:4', 'F5:12 E5:4', 'E5:8 D5:8', 'C#5:12 E5:4'].join(' '),
);
const TITLE_ARP = [0, 1, 2, 3, 4, 3, 2, 1];

const title: Track = {
  bpm: 84,
  intro: 0,
  loop: 256,
  hot: false,
  setup: (mx) => ({
    arp: mx.strip({ level: 0.5, pan: -0.2, echo: 0.55, verb: 0.35 }),
    pad: mx.strip({ level: 0.7, verb: 0.5 }),
    bass: mx.strip({ level: 0.55 }),
    drums: mx.strip({ level: 0.5, verb: 0.4 }),
    air: mx.strip({ level: 0.5, pan: 0.3, verb: 0.5 }),
    bell: mx.strip({ level: 0.6, pan: 0.15, echo: 0.35, verb: 0.55 }),
  }),
  step(mx, s, pos, t, sd) {
    const bar = Math.floor(pos / 16);
    const b = pos % 16;
    const ci = Math.floor(bar / 2) % 4;
    const second = bar % 2 === 1;
    const c = TITLE_CHORDS[ci];
    const tones = ci === 3 && second ? TITLE_A7.tones : c.tones;
    const pad = ci === 3 && second ? TITLE_A7.pad : c.pad;
    // arpeggio (second bar of each chord climbs an octave on the top notes)
    const idx = TITLE_ARP[b % 8];
    const m = tones[idx] + (second && b >= 8 && idx >= 3 ? 12 : 0);
    ins.arp(mx, s.arp, t, m, b % 4 === 0 ? 0.85 : 0.55, 0.16);
    // pad
    if (b === 0 && (!second || ci === 3)) ins.pad(mx, s.pad, t, pad, sd * (ci === 3 ? 16 : 32), 1, 1100);
    // bass
    if (b === 0 && !second) ins.bass(mx, s.bass, t, c.root, sd * 15, 0.8);
    if (second && b === 0) ins.bass(mx, s.bass, t, c.root, sd * 9.5, 0.7);
    if (second && b === 10) ins.bass(mx, s.bass, t, c.root + 7, sd * 5.5, 0.6);
    // heartbeat
    if (!second && b === 0) ins.kick(mx, s.drums, t, 0.55);
    if (!second && b === 3) ins.kick(mx, s.drums, t, 0.35);
    if (bar >= 4 && b % 4 === 2) ins.hat(mx, s.drums, t, 0.25);
    // reverse swell into each chord change
    if (second && b === 8) ins.swell(mx, s.air, t, sd * 8, 1);
    // bell melody on the second pass
    if (bar >= 8) {
      const n = TITLE_BELL.get(pos - 128);
      if (n) ins.bell(mx, s.bell, t, n.m, n.len * sd, 1);
    }
  },
};

// ---- victory (C major)
const VIC_FANFARE = melody(['G4:2 C5:2 E5:2 G5:10', 'F5:4 E5:2 D5:2 E5:8', 'D5:4 E5:2 F5:2 G5:4 A5:4', 'C6:16'].join(' '));
const VIC_CHORDS: Array<[number, readonly number[], number]> = [
  // [step, notes, len]
  [6, [60, 64, 67], 10],
  [16, [65, 69, 72], 8],
  [24, [64, 67, 72], 8],
  [32, [62, 65, 69, 72], 8],
  [40, [62, 67, 71], 8],
  [48, [60, 64, 67, 72], 16],
];
const VIC_TIMP: Array<[number, number, number]> = [
  [6, 48, 1],
  [16, 41, 0.8],
  [24, 48, 0.7],
  [32, 38, 0.8],
  [40, 43, 0.7],
  [44, 43, 0.4],
  [45, 43, 0.45],
  [46, 43, 0.5],
  [47, 43, 0.6],
  [48, 36, 1.1],
];
const VIC_LOOP = [
  { root: 36, tones: [60, 64, 67, 72] }, // C
  { root: 45, tones: [57, 60, 64, 69] }, // Am
  { root: 41, tones: [57, 60, 65, 69] }, // F
  { root: 43, tones: [59, 62, 67, 71] }, // G
];
const VIC_BELL = melody(['E5:8 G5:8', 'C6:12 B5:4', 'A5:8 E5:8', 'C5:16', 'F5:8 A5:8', 'C6:8 B5:4 A5:4', 'G5:8 D5:8', 'G5:16'].join(' '));

const victory: Track = {
  bpm: 120,
  intro: 64,
  loop: 128,
  hot: false,
  setup: (mx) => ({
    brass: mx.strip({ level: 0.9, verb: 0.35, echo: 0.1 }),
    chords: mx.strip({ level: 0.55, verb: 0.4 }),
    drums: mx.strip({ level: 0.6, verb: 0.3 }),
    sparkle: mx.strip({ level: 0.5, pan: 0.25, echo: 0.3, verb: 0.5 }),
    arp: mx.strip({ level: 0.45, pan: -0.2, echo: 0.3, verb: 0.3 }),
    pad: mx.strip({ level: 0.55, verb: 0.45 }),
    bass: mx.strip({ level: 0.45 }),
    bell: mx.strip({ level: 0.55, pan: 0.15, echo: 0.3, verb: 0.5 }),
  }),
  step(mx, s, pos, t, sd) {
    if (pos < 64) {
      const n = VIC_FANFARE.get(pos);
      if (n) ins.brass(mx, s.brass, t, n.m, n.len * sd * 0.92, 1);
      for (const [at, ms, len] of VIC_CHORDS) if (at === pos) for (const m of ms) ins.brass(mx, s.chords, t, m - 12, len * sd * 0.95, 0.6);
      for (const [at, m, vel] of VIC_TIMP) if (at === pos) ins.timpani(mx, s.drums, t, m, vel);
      if (pos >= 40 && pos < 48) ins.snare(mx, s.drums, t, 0.25 + (pos - 40) * 0.08);
      if (pos === 48) {
        ins.crash(mx, s.drums, t, 1.2);
        [84, 88, 91, 96, 100].forEach((m, i) => ins.bell(mx, s.sparkle, t + i * sd * 0.5, m, 0.6, 0.8));
      }
      if (pos === 6) ins.crash(mx, s.drums, t, 0.6);
      return;
    }
    const lp = pos - 64;
    const bar = Math.floor(lp / 16);
    const b = lp % 16;
    const ch = VIC_LOOP[Math.floor(bar / 2) % 4];
    if (b % 2 === 0) ins.arp(mx, s.arp, t, ch.tones[[0, 1, 2, 3, 2, 1, 2, 1][b / 2]] + 12, b === 0 ? 0.8 : 0.5, 0.3, 'triangle');
    if (b === 0 && bar % 2 === 0) ins.pad(mx, s.pad, t, ch.tones.slice(0, 3), sd * 32, 0.8, 1300);
    if (b === 0) ins.bass(mx, s.bass, t, ch.root, sd * 14, 0.7);
    if (b === 0) ins.kick(mx, s.drums, t, 0.35);
    if (b % 4 === 2) ins.hat(mx, s.drums, t, 0.2);
    const n = VIC_BELL.get(lp);
    if (n) ins.bell(mx, s.bell, t, n.m, n.len * sd, 0.9);
  },
};

export const TRACKS: Record<MusicTrack, Track> = { title, duel, victory };

/** Melodic lines and harmony (step-keyed), exported for the ?dev=audio&page=score piano roll. */
export const SCORE = {
  duelLead: { notes: DUEL_LEAD, steps: 512, chords: DUEL_CHORDS.map((c) => c.root), chordSteps: 32 },
  titleBell: { notes: TITLE_BELL, steps: 128, chords: TITLE_CHORDS.map((c) => c.root), chordSteps: 32 },
  victoryFanfare: { notes: VIC_FANFARE, steps: 64, chords: [36, 41, 38, 36], chordSteps: 16 },
  victoryBell: { notes: VIC_BELL, steps: 128, chords: VIC_LOOP.map((c) => c.root), chordSteps: 32 },
};

// ------------------------------------------------------------------ player

class Player {
  readonly mx: Mix;
  readonly strips: Record<string, GainNode>;
  readonly sd: number;
  /** Context time of absolute step 0 (may be a negative offset when starting mid-song). */
  readonly t0: number;
  /** The absolute step the track started on (≥ intro: the intro was skipped). */
  readonly startStep: number;
  step = 0;
  next: number;
  intensity = 0;
  hotUntil = 0;
  /** Pending drum fill: absolute step of the downbeat it lands on (−1 = none) and its length. */
  fillAt = -1;
  fillLen = 0;

  constructor(
    chain: Chain,
    readonly name: MusicTrack,
    readonly track: Track,
    start: number,
    startStep = 0,
    live = false,
  ) {
    this.sd = 60 / track.bpm / 4;
    this.mx = new Mix(chain, this.sd * 3, live);
    this.strips = track.setup(this.mx);
    this.next = start;
    this.step = startStep;
    this.startStep = startStep;
    this.t0 = start - startStep * this.sd;
  }

  /** Song position of an absolute step count (intro once, then the loop forever). */
  pos(step: number): number {
    const { intro, loop } = this.track;
    return step < intro ? step : intro + ((step - intro) % loop);
  }

  /** True while the one-shot intro (the victory fanfare) is playing at context time t (false if it was skipped). */
  inIntro(t: number): boolean {
    return this.startStep < this.track.intro && t < this.t0 + this.track.intro * this.sd;
  }

  /** Schedule every step that starts before `until`. */
  pump(until: number): void {
    while (this.next < until) {
      const hotOn = this.track.hot && (this.intensity > 0.001 || this.next < this.hotUntil);
      this.track.step(this.mx, this.strips, this.pos(this.step), this.next, this.sd, hotOn);
      if (this.fillAt >= 0 && this.track.fill) {
        const k = this.step - (this.fillAt - this.fillLen);
        if (k >= 0 && k <= this.fillLen) this.track.fill(this.mx, this.strips, this.next, k, this.fillLen);
        if (k >= this.fillLen) this.fillAt = -1;
      }
      this.step++;
      this.next += this.sd;
    }
    if (this.mx.live) this.mx.reap();
  }

  /** Queue a short snare/tom fill into the next downbeat (2–4 sixteenths, never cut mid-roll). */
  queueFill(): void {
    if (!this.track.fill || this.fillAt >= 0) return;
    const intro = this.track.intro;
    if (this.step < intro) return;
    let down = intro + Math.ceil((this.step - intro) / 16) * 16;
    if (down - this.step < 2) down += 16;
    this.fillAt = down;
    this.fillLen = Math.min(4, down - this.step);
  }

  /** Glide the hot / cool layers to intensity v. A real jump up also queues a drum fill. */
  setIntensity(v: number, now: number, fill = true): void {
    const old = this.intensity;
    this.intensity = v;
    const tc = v > old ? 0.35 : 0.6;
    this.mx.hot.set(v, now, tc);
    this.mx.cool.set(1 - 0.45 * v, now, tc);
    if (v < old) this.hotUntil = now + 3;
    // e.g. entering the battle phase: a snare/tom roll and a crash on the next downbeat
    if (fill && v >= 0.5 && v - old >= 0.3) this.queueFill();
  }
}

/** Length of the victory sting (sfx 'victory') up to the end of its held chord, in seconds. */
export const VICTORY_STING_SEC = 1.8;

/**
 * Where a track starts. The victory track normally opens with its own 4-bar fanfare; when the
 * short victory sting (sfx) has just played, it waits for the sting's chord to ring out and goes
 * straight into its calm loop instead, so the two fanfares never clash.
 */
export function startPlan(track: MusicTrack, now: number, stingEnd: number): { at: number; step: number } {
  if (track === 'victory' && stingEnd > now - 0.4) return { at: Math.max(now + 0.06, stingEnd - 0.1), step: TRACKS.victory.intro };
  return { at: now + 0.06, step: 0 };
}

// ------------------------------------------------------------------ live control

const LOOKAHEAD = 0.15;
let current: Player | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let wanted: MusicTrack | null = null;
let intensity = 0;
let volume = 0.45;
/** Context time at which the last victory sting's held chord ends (−1 = none). */
let stingEnd = -1;

function tick(): void {
  const a = peekLive();
  if (!a || !current || a.ctx.state !== 'running') return;
  const now = a.ctx.currentTime;
  // after a stall (tab in background, debugger, suspended context) skip the missed steps
  if (current.next < now - 0.1) {
    const missed = Math.ceil((now + 0.05 - current.next) / current.sd);
    current.step += missed;
    current.next += missed * current.sd;
  }
  const ahead = typeof document !== 'undefined' && document.hidden ? 1.2 : LOOKAHEAD;
  current.pump(now + ahead);
}

function fadeOut(p: Player, now: number, secs: number): void {
  p.mx.fader.to(0, now, Math.max(0.02, secs));
  setTimeout(() => safe(() => p.mx.dispose()), (secs + 3) * 1000);
}

function start(track: MusicTrack): void {
  const a = peekLive();
  if (!a) return;
  a.chain.music.gain.value = volume;
  const now = a.ctx.currentTime;
  if (current) fadeOut(current, now, 0.5);
  const plan = startPlan(track, now, stingEnd);
  current = new Player(a.chain, track, TRACKS[track], plan.at, plan.step, true);
  current.mx.fader.to(0, now, 0.005);
  current.mx.fader.to(1, plan.at - 0.04, track === 'victory' && plan.step === 0 ? 0.02 : 0.4);
  current.setIntensity(intensity, now, false);
  if (!timer) timer = setInterval(() => safe(tick), 25);
  tick();
}

export const musicEngine = {
  play(track: MusicTrack): void {
    if (!TRACKS[track]) return;
    if (wanted === track && current?.name === track) return;
    wanted = track;
    if (!audio()) return; // no gesture yet: sfx.unlock() will kick() it later
    whenRunning(() => {
      if (wanted === track && current?.name !== track) start(track);
    });
  },
  /** Called by sfx.unlock(): start the wanted track once the context runs. */
  kick(): void {
    const track = wanted;
    if (!track || current?.name === track || !peekLive()) return;
    whenRunning(() => {
      if (wanted === track && current?.name !== track) start(track);
    });
  },
  stop(fadeMs = 600): void {
    wanted = null;
    const a = peekLive();
    if (!a || !current) return;
    fadeOut(current, a.ctx.currentTime, fadeMs / 1000);
    current = null;
    if (timer) clearInterval(timer);
    timer = null;
  },
  setIntensity(v: number): void {
    intensity = Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
    const a = peekLive();
    if (a && current) current.setIntensity(intensity, a.ctx.currentTime);
  },
  getIntensity(): number {
    return intensity;
  },
  current(): MusicTrack | null {
    return current?.name ?? null;
  },
  setVolume(v: number): void {
    volume = Math.max(0, Math.min(1, Number.isFinite(v) ? v : volume));
    const a = peekLive();
    if (a) a.chain.music.gain.setTargetAtTime(volume, a.ctx.currentTime, 0.05);
  },
  /** Pull the music down for a moment (called by big sfx). */
  duck(amount: number, at: number): void {
    const a = peekLive();
    if (!a || !current) return;
    applyDuck(a.chain, amount, at);
  },
  /** The victory sting (sfx) starts at context time `at`: a victory track started now waits for it. */
  sting(at: number, pitch = 1): void {
    stingEnd = at + VICTORY_STING_SEC / Math.max(0.25, pitch);
  },
  /** True while the victory track's own fanfare is playing (the sting would clash with it). */
  fanfarePlaying(): boolean {
    const a = peekLive();
    return !!a && current?.name === 'victory' && current.inIntro(a.ctx.currentTime);
  },
};

// ------------------------------------------------------------------ offline (dev preview)

export interface MusicRenderOpts {
  /** Start intensity (0..1). */
  intensity?: number;
  /** Intensity changes during the render: [seconds, value] (a jump up plays the drum fill). */
  intensityAt?: ReadonlyArray<readonly [number, number]>;
  /** Start mid-song (absolute step), e.g. to hear the loop seam. */
  startStep?: number;
}

/**
 * Schedule `seconds` of a track into an offline chain, starting at context time `start`.
 * Shared by renderMusic() and the sfx scene renderer (renderScene in sfx.ts).
 */
export function scheduleMusic(chain: Chain, track: MusicTrack, start: number, seconds: number, o: MusicRenderOpts = {}): void {
  const p = new Player(chain, track, TRACKS[track], start, o.startStep ?? 0);
  const v0 = Math.max(0, Math.min(1, o.intensity ?? 0));
  p.intensity = v0;
  p.mx.hot.set(v0, 0, 0.001);
  p.mx.cool.set(1 - 0.45 * v0, 0, 0.001);
  const changes = [...(o.intensityAt ?? [])].sort((x, y) => x[0] - y[0]);
  for (const [at, v] of changes) {
    p.pump(start + at);
    p.setIntensity(Math.max(0, Math.min(1, v)), start + at);
  }
  p.pump(start + seconds);
}

/** Render `seconds` of a track offline (through the real master chain). startStep lets you hear the loop seam. */
export async function renderMusic(track: MusicTrack, seconds: number, o: MusicRenderOpts & { sampleRate?: number } = {}): Promise<AudioBuffer | null> {
  try {
    const sr = o.sampleRate ?? 44100;
    const pre = 0.8; // compressor warm-up (see renderSfx)
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * (seconds + pre)), sr);
    const chain = buildChain(ctx);
    chain.music.gain.value = volume;
    scheduleMusic(chain, track, pre, seconds, o);
    return trim(await ctx.startRendering(), pre);
  } catch (err) {
    console.warn('[audio] renderMusic failed', err);
    return null;
  }
}

/** Default music volume (the music bus gain), for offline renders that mirror the live mix. */
export function musicVolume(): number {
  return volume;
}

/** Seconds per loop and intro, for the preview's labels. */
export function trackInfo(track: MusicTrack): { bpm: number; introSec: number; loopSec: number; introSteps: number; loopSteps: number } {
  const t = TRACKS[track];
  const sd = 60 / t.bpm / 4;
  return { bpm: t.bpm, introSec: t.intro * sd, loopSec: t.loop * sd, introSteps: t.intro, loopSteps: t.loop };
}
