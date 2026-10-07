// Procedural chiptune music: a lookahead scheduler (setInterval pumps notes ~150 ms ahead on
// the audio clock, so timing is sample-accurate and loops are seamless) and three tracks:
//
//   title   — D minor, 84 bpm. Echoing 12.5 % pulse arpeggios over a slow pad, a heartbeat
//             kick and reverse swells; the second pass adds an FM bell melody.
//   duel    — E minor, 136 bpm. Pulse bass, kit, arps and pad. setIntensity() fades in a
//             "hot" layer: syncopated kicks, 16th hats, snare rolls, crashes, a galloping saw
//             bass and the heroic lead melody.
//   victory — 4-bar brass fanfare with timpani, then a calm C major loop.
//
// The same scheduler renders into an OfflineAudioContext for ?dev=audio (renderMusic()).

import type { MusicTrack } from './sfx';
import { audio, buildChain, peekLive, rng, safe, trim, whenRunning, type Chain } from './engine';
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

/** Per-track routing: every part has a strip → (main | hot) bus, with echo / reverb sends. */
class Mix {
  readonly ctx: BaseAudioContext;
  readonly fader: GainNode;
  readonly hot: GainNode;
  /** Parts that step back when the hot layer comes in (gain = 1 − 0.45·intensity). */
  readonly cool: GainNode;
  private readonly main: GainNode;
  private readonly echoIn: GainNode;
  private readonly verb: GainNode;
  readonly rnd = rng(77);
  /** Live mode: per-note output nodes waiting to be disconnected once their voice has ended. */
  readonly pending: Array<{ out: GainNode; v: Voice }> = [];

  constructor(
    readonly chain: Chain,
    echoTime: number,
    readonly live = false,
  ) {
    const ctx = (this.ctx = chain.ctx);
    this.fader = ctx.createGain();
    this.fader.connect(chain.music);
    this.main = ctx.createGain();
    this.main.connect(this.fader);
    this.hot = ctx.createGain();
    this.hot.gain.value = 0;
    this.hot.connect(this.fader);
    this.cool = ctx.createGain();
    this.cool.connect(this.main);
    // tempo-synced echo (dotted 8th), darkened each repeat
    this.echoIn = ctx.createGain();
    const dl = ctx.createDelay(2);
    dl.delayTime.value = echoTime;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2800;
    this.echoIn.connect(dl).connect(lp).connect(fb).connect(dl);
    const wet = ctx.createGain();
    wet.gain.value = 0.6;
    lp.connect(wet).connect(this.fader);
    this.verb = ctx.createGain();
    this.verb.gain.value = 0.8;
    this.verb.connect(chain.send);
  }

  strip(o: StripOpts, bus: 'main' | 'hot' | 'cool' = 'main'): GainNode {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = o.level;
    let tail: AudioNode = g;
    const c = ctx as BaseAudioContext & { createStereoPanner?: () => StereoPannerNode };
    if (o.pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      tail = p;
    }
    tail.connect(bus === 'hot' ? this.hot : bus === 'cool' ? this.cool : this.main);
    if (o.echo) {
      const s = ctx.createGain();
      s.gain.value = o.echo;
      tail.connect(s).connect(this.echoIn);
    }
    if (o.verb) {
      const s = ctx.createGain();
      s.gain.value = o.verb;
      tail.connect(s).connect(this.verb);
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
    const env: Pt[] = [[0, 0], [0.02, 0.1 * vel], [Math.max(0.03, dur * 0.8), 0.08 * vel], [dur + 0.14, 0.0001, 'e']];
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
}

// ---- duel (E minor)
const DUEL_CHORDS = [
  { root: 40, tones: [64, 67, 71] }, // Em
  { root: 36, tones: [60, 64, 67] }, // C
  { root: 38, tones: [62, 66, 69] }, // D
  { root: 35, tones: [59, 63, 66] }, // B
  { root: 40, tones: [64, 67, 71] }, // Em
  { root: 36, tones: [60, 64, 67] }, // C
  { root: 33, tones: [57, 60, 64] }, // Am
  { root: 35, tones: [59, 63, 66] }, // B
];
const DUEL_LEAD = melody(
  [
    'E5:6 F#5:2 G5:4 B5:4', 'A5:6 G5:2 F#5:4 E5:4',
    'G5:6 E5:2 C5:4 E5:4', 'G5:8 A5:4 G5:4',
    'F#5:6 D5:2 A4:4 D5:4', 'F#5:4 A5:4 D6:8',
    'D#5:6 F#5:2 B5:8', 'A5:4 G5:4 F#5:4 D#5:4',
    'E5:6 F#5:2 G5:4 B5:4', 'E6:8 D6:4 B5:4',
    'C6:6 B5:2 G5:4 E5:4', 'G5:8 r:4 E5:4',
    'A5:6 B5:2 C6:4 B5:4', 'A5:4 G5:4 E5:8',
    'F#5:6 G5:2 A5:4 B5:4', 'D#5:8 F#5:4 B4:4',
  ].join(' '),
);
const BASS_PAT = [0, 0, 12, 0, 0, 12, 0, 7];
const BASS_PAT2 = [0, 12, 0, 7, 12, 0, 7, 12];
const ARP_PAT = [0, 1, 2, 3, 2, 1, 0, 1, 0, 1, 2, 3, 2, 1, 2, 3];
const ARP_PAT2 = [0, 2, 1, 3, 0, 2, 1, 3, 2, 1, 0, 2, 3, 2, 1, 0];

const duel: Track = {
  bpm: 136,
  intro: 0,
  loop: 256,
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
  }),
  step(mx, s, pos, t, sd, hotOn) {
    const bar = Math.floor(pos / 16);
    const b = pos % 16;
    const ch = DUEL_CHORDS[Math.floor(bar / 2) % 8];
    const B = bar >= 8; // second half: varied bass / arp figures, ghost snares
    // base kit
    if (b === 0 || b === 8 || (b === 10 && bar % 2 === 1)) ins.kick(mx, s.drums, t, b === 0 ? 1 : 0.85);
    if (b === 4 || b === 12) ins.snare(mx, s.drums, t, 0.8);
    if (B && (b === 7 || b === 15) && bar % 2 === 1) ins.snare(mx, s.drums, t, 0.22);
    if (b % 2 === 0) ins.hat(mx, s.hats, t, b % 4 === 2 ? 0.55 : 0.3);
    // base bass: driving 8ths with octave pops
    if (b % 2 === 0) ins.bass(mx, s.bass, t, ch.root + (B ? BASS_PAT2 : BASS_PAT)[b / 2], sd * 1.5, b === 0 ? 1 : 0.8);
    // arpeggio
    const idx = (B ? ARP_PAT2 : ARP_PAT)[b];
    ins.arp(mx, s.arp, t, (idx === 3 ? ch.tones[0] + 12 : ch.tones[idx]) + 12, b % 4 === 0 ? 0.9 : 0.6, 0.12);
    // pad
    if (b === 0 && bar % 2 === 0) ins.pad(mx, s.pad, t, ch.tones.map((m) => m - 12), sd * 32, 0.9, 1600);
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
    if (n) ins.lead(mx, s.lead, t, n.m, n.len * sd * 0.92, 1);
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
    brass: mx.strip({ level: 0.75, verb: 0.35, echo: 0.1 }),
    chords: mx.strip({ level: 0.5, verb: 0.4 }),
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
  duelLead: { notes: DUEL_LEAD, steps: 256, chords: DUEL_CHORDS.map((c) => c.root), chordSteps: 32 },
  titleBell: { notes: TITLE_BELL, steps: 128, chords: TITLE_CHORDS.map((c) => c.root), chordSteps: 32 },
  victoryFanfare: { notes: VIC_FANFARE, steps: 64, chords: [36, 41, 38, 36], chordSteps: 16 },
  victoryBell: { notes: VIC_BELL, steps: 128, chords: VIC_LOOP.map((c) => c.root), chordSteps: 32 },
};

// ------------------------------------------------------------------ player

class Player {
  readonly mx: Mix;
  readonly strips: Record<string, GainNode>;
  readonly sd: number;
  step = 0;
  next: number;
  intensity = 0;
  hotUntil = 0;

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
  }

  /** Song position of an absolute step count (intro once, then the loop forever). */
  pos(step: number): number {
    const { intro, loop } = this.track;
    return step < intro ? step : intro + ((step - intro) % loop);
  }

  /** Schedule every step that starts before `until`. */
  pump(until: number): void {
    while (this.next < until) {
      const hotOn = this.track.hot && (this.intensity > 0.001 || this.next < this.hotUntil);
      this.track.step(this.mx, this.strips, this.pos(this.step), this.next, this.sd, hotOn);
      this.step++;
      this.next += this.sd;
    }
    if (this.mx.live) this.mx.reap();
  }

  setIntensity(v: number, now: number): void {
    const old = this.intensity;
    this.intensity = v;
    const tc = v > old ? 0.35 : 0.6;
    for (const [g, target] of [
      [this.mx.hot.gain, v],
      [this.mx.cool.gain, 1 - 0.45 * v],
    ] as const) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.setTargetAtTime(target, now, tc);
    }
    if (v < old) this.hotUntil = now + 3;
  }
}

// ------------------------------------------------------------------ live control

const LOOKAHEAD = 0.15;
let current: Player | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let wanted: MusicTrack | null = null;
let intensity = 0;
let volume = 0.45;

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
  const g = p.mx.fader.gain;
  g.cancelScheduledValues(now);
  g.setValueAtTime(g.value, now);
  g.linearRampToValueAtTime(0, now + Math.max(0.02, secs));
  setTimeout(() => safe(() => p.mx.fader.disconnect()), (secs + 3) * 1000);
}

function start(track: MusicTrack): void {
  const a = peekLive();
  if (!a) return;
  a.chain.music.gain.value = volume;
  const now = a.ctx.currentTime;
  if (current) fadeOut(current, now, 0.5);
  current = new Player(a.chain, track, TRACKS[track], now + 0.06, 0, true);
  current.mx.fader.gain.setValueAtTime(0, now);
  current.mx.fader.gain.linearRampToValueAtTime(1, now + (track === 'victory' ? 0.02 : 0.4));
  current.setIntensity(intensity, now);
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
    const g = a.chain.duck.gain;
    const depth = Math.max(0.35, 1 - 0.5 * Math.min(1, amount));
    g.cancelScheduledValues(at);
    g.setValueAtTime(Math.min(g.value, 1), at);
    g.linearRampToValueAtTime(Math.min(g.value, depth), at + 0.03);
    g.setTargetAtTime(1, at + 0.2, 0.4);
  },
};

// ------------------------------------------------------------------ offline (dev preview)

/** Render `seconds` of a track offline (through the real master chain). startStep lets you hear the loop seam. */
export async function renderMusic(track: MusicTrack, seconds: number, o: { intensity?: number; startStep?: number; sampleRate?: number } = {}): Promise<AudioBuffer | null> {
  try {
    const sr = o.sampleRate ?? 44100;
    const pre = 0.8; // compressor warm-up (see renderSfx)
    const ctx = new OfflineAudioContext(2, Math.ceil(sr * (seconds + pre)), sr);
    const chain = buildChain(ctx);
    chain.music.gain.value = volume;
    const p = new Player(chain, track, TRACKS[track], pre, o.startStep ?? 0);
    p.intensity = o.intensity ?? 0;
    p.mx.hot.gain.value = p.intensity;
    p.mx.cool.gain.value = 1 - 0.45 * p.intensity;
    p.pump(seconds + pre);
    return trim(await ctx.startRendering(), pre);
  } catch (err) {
    console.warn('[audio] renderMusic failed', err);
    return null;
  }
}

/** Seconds per loop and intro, for the preview's labels. */
export function trackInfo(track: MusicTrack): { bpm: number; introSec: number; loopSec: number; introSteps: number; loopSteps: number } {
  const t = TRACKS[track];
  const sd = 60 / t.bpm / 4;
  return { bpm: t.bpm, introSec: t.intro * sd, loopSec: t.loop * sd, introSteps: t.intro, loopSteps: t.loop };
}
