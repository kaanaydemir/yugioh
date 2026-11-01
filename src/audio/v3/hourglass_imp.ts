// Kum Saati Cücesi (hourglass_imp) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/hourglass_imp.md §7 (checked against docs/v3/YENI_KARTLAR.md §5.1). Built from ./kit.ts blocks and the Voice primitives only.
//
// Palette (one parameter set):
//   bulb    the glass bulb's hum: B♭4 (466 Hz) sine + a weak 2nd partial + a little breath noise through the same
//           pitch (blowing across a bottle), a slow 0.3 Hz pitch wobble; the fifth F5 (698 Hz) for the big beats
//   grains  fine sand INSIDE glass: an aperiodic train of tiny noise clicks (random gaps, never a pulse) through the
//           bulb's two narrow cavity resonances (1.4 kHz q 6, 2.8 kHz q 4) over a 1.2 kHz high-pass — grains in
//           glass, never an outdoor hiss or a broadband "şşş"
//   brass   the caps' brass rims: a HARMONIC FM tink (1180 Hz, ratio 2.0 — never the 2.76 plate / 1.41 clank ratios)
//   base    the glass foot on the tile: a dull sine thud ≤ 150 Hz (never a hollow wood "tok")
//   imp     a tiny nasal giggle: square blips through 700 / 1100 Hz formants gliding up
//   the time seal (signature): the trickle cuts DEAD, 60 ms of silence, one dry 4 kHz "tık", then a flat B♭4 + F5
//           glass tone held 380 ms that stops without decay — "time stopped" heard as sound stopping
//
//   hgiPour          summon `arrive` (sustained): the hanging glass pours a glowing stream onto the tile
//   hgiShed          summon f6 / f7: sand slides off him in two soft bands
//   hgiCatch         summon `land`: he catches the falling glass (brass tink) and plants it (soft thud)
//   hgiGiggle        `roar` / summon f12: the giggle
//   hgiFlip          strike `charge` (the declaration) / effect flip: brass tink-tink, sand sliding inside, the "turn"
//   hgiCork          strike f5: the stopper flicked off ("pop")
//   hgiJet           strike `release` (sustained): the sand jet's hiss
//   hgiScour         strike `impact` on a body: the sand-blast "fssh-t" + a bulb blip
//   hgiSplash        blocked contact: the jet cut by the guard, a dull "fff"
//   hgiJetLp         direct contact: the soft dune "fff" against the LP panel + an F5 hum
//   hgiDune          direct: the dune slides off the panel (a short dry trickle)
//   hgiRight         strike / effect recover: re-corked, the glass turned upright and thunked down, trickle restarts
//   hgiThread        effect release (sustained): the thin glowing sand thread arcing over the field, hum rising
//   hgiCage          effect: the glass builds round the target (three stepped glass tings B♭5 D6 F6)
//   hgiFill          effect: sand fills the cage's lower bulb (short trickle swell)
//   hgiSeal          effect THE STOP (signature, see above)
//   hgiCondense      effect: the giant cage collapses into the emblem (a tight glass "zip" up)
//   hgiBite          the frozen turn starts: a muffled tick + a refused 80 ms trickle (cap 6, gap 8 ms)
//   hgiStrain        the frozen monster's battle phase: grains clamp ×3 rising, a choked hum (cap 6)
//   hgiThaw          the frozen turn is spent: a trickle that runs out + an F6 glass ting
//   hgiEmblemDrop    the sealed monster leaves the field: the emblem falls and its grains scatter
//   hgiDrain         death `dissolve` (sustained): he pours into his own glass, hum gliding down B♭4 → F4
//   hgiTopple        death f8: the glass tips over (dull thud + a glass crack)
//   hgiBleed         death cinematic: the sand bleeds from the crack, the trickle slowing to nothing
//   hgiLastGrain     death `burst`: one dry tick + a tiny B♭6 ping, then nothing
//   hgiReviveGather  revive `reviveGather` (sustained): the drain reversed, rising F4 → B♭4
//   hgiReviveLand    revive `reviveLand`: the sandal plant + the sand sneeze "pff"

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

// ================================================================ palette

/** B♭4, the bulb's hum. */
const BB4 = 466.16;
/** F5, its fifth (big beats). */
const F5 = 698.46;
/** The brass tink. */
const TINK = 1180;

/**
 * The bulb hum: a sine on `f` (+ a weak 2nd partial) and breath noise through a narrow band at `f`, a slow 0.3 Hz
 * pitch wobble. `env` shapes the level; `f` may be an envelope (a glide).
 */
function hum(v: Voice, t: number, f: number | readonly Pt[], env: readonly Pt[], o: { breath?: number; partial?: number; to?: AudioNode } = {}): void {
  const d = env[env.length - 1][0];
  const a = v.tone('sine', f, { t, g: env, to: o.to });
  v.lfo(a.osc.detune, 0.3, 9, { t, d: d + 0.02 });
  const p2 = v.tone('sine', typeof f === 'number' ? f * 2 : f.map(([x, y, c]) => [x, y * 2, c] as Pt), { t, g: env.map(([x, y, c]) => [x, y * (o.partial ?? 0.14), c] as Pt), to: o.to });
  v.lfo(p2.osc.detune, 0.3, 9, { t, d: d + 0.02 });
  const br = o.breath ?? 0.35;
  if (br > 0) {
    const bp = v.filt('bandpass', f, 18, { t, to: o.to });
    v.noise('white', { t, g: env.map(([x, y, c]) => [x, y * br * 2.2, c] as Pt), to: bp });
  }
}

/** The bulb's cavity: two narrow resonances over a 1.2 kHz high-pass. Returns the input node. */
function bulb(v: Voice, o: { to?: AudioNode; lo?: number; hi?: number; tilt?: number } = {}): AudioNode {
  const top = v.filt('lowpass', 9000, 0.7, { to: o.to });
  const hp = v.filt('highpass', 1200, 0.7, { to: top });
  const inp = v.amp(1);
  const a = v.filt('bandpass', o.lo ?? 1400, 6, { to: hp });
  const b = v.filt('bandpass', o.hi ?? 2800, 4, { to: hp });
  const ga = v.amp(1.0);
  const gb = v.amp(o.tilt ?? 0.8);
  inp.connect(ga).connect(a);
  inp.connect(gb).connect(b);
  // a little of the raw grain too, so it is never just a whistle
  inp.connect(v.amp(0.08, { to: hp }));
  return inp;
}

/**
 * Grains inside the glass: `rate` grains / s over `d` seconds (rate may glide `rate1`), aperiodic (random gaps),
 * each a 2–8 ms click; level `g` shaped by `shape` (0…1 over the length). Deterministic for a seeded voice.
 */
function grains(v: Voice, t: number, d: number, rate: number, g: number, o: { rate1?: number; to?: AudioNode; shape?: (k: number) => number; dec?: number; lo?: number; hi?: number } = {}): void {
  const times: number[] = [];
  const gains: number[] = [];
  const decs: number[] = [];
  const r1 = o.rate1 ?? rate;
  let x = 0;
  while (x < d) {
    const k = x / d;
    const r = rate + (r1 - rate) * k;
    times.push(x);
    const s = o.shape ? o.shape(k) : 1;
    gains.push(g * s * (0.4 + 0.6 * v.rnd()));
    decs.push((o.dec ?? 0.004) * (0.5 + v.rnd()));
    // exponential gaps: random, never periodic
    x += (-Math.log(1 - v.rnd() * 0.98) / Math.max(1, r));
  }
  if (!times.length) return;
  v.bursts(times, gains, { t, dec: decs, f: 2000, q: 0.45, to: bulb(v, { to: o.to, lo: o.lo, hi: o.hi }) });
}

/** The brass tink: a harmonic FM ping (ratio 2.0) + a tiny click. */
function tink(v: Voice, t: number, g: number, o: { f?: number; dec?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? TINK;
  v.bell(f, { t, g, dec: o.dec ?? 0.18, ratio: 2, index: 1.6, idxDec: 0.04, to: o.to });
  v.tone('sine', f * 2, { t, g: perc(g * 0.25, (o.dec ?? 0.18) * 0.5, 0.0005), to: o.to });
  v.noise('white', { t, g: perc(g * 1.2, 0.004, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 3.2), 1.6, { to: o.to }) });
}

/** One dry "tık": a 1–2 ms filtered click at 4 kHz. */
function tick(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode } = {}): void {
  v.noise('white', { t, g: perc(g, 0.0018, 0.0002), to: v.filt('bandpass', o.f ?? 4000, 2.4, { to: o.to }) });
}

/** A pure glass ting (sine + its octave, short decay — never bar modes: those are the wyrm's). */
function ting(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', f, { t, g: perc(g, dec, 0.0008), to });
  v.tone('sine', f * 2, { t, g: perc(g * 0.22, dec * 0.45, 0.0008), to });
}

/** The glass foot on the tile: a dull sine thud (≤ 150 Hz) + a soft low puff. */
function base(v: Voice, t: number, g: number, o: { f0?: number; f1?: number } = {}): void {
  thump(v, t, o.f0 ?? 140, o.f1 ?? 78, g, 0.12, { drive: 1.1 });
  puff(v, t + 0.004, g * 0.22, 0.09, 900, { kind: 'pink' });
}

/** One nasal imp blip: a square at f through the 700 / 1100 Hz formants. */
function blip(v: Voice, t: number, f0: number, f1: number, g: number, d = 0.055): void {
  const sum = v.amp(1);
  const f1n = v.filt('bandpass', 700, 5, { to: sum });
  const f2n = v.filt('bandpass', 1100, 6, { to: sum });
  const src = v.amp(1);
  src.connect(f1n);
  src.connect(f2n);
  v.tone('square', [[0, f0], [d, f1, 'e']], { t, g: [[0, 0], [0.006, g], [d * 0.7, g * 0.7], [d, 0.0001, 'e']], to: src });
}

const SEAL_MS = 0.38;

export const HOURGLASS_IMP_RECIPES = {
  // ---------------------------------------------------------------- summon
  /** The hanging glass pours: grains thickening onto the tile + the bulb hum swelling (≈ 1.6 s, stopped at the catch). */
  hgiPour: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const d = 1.6;
      grains(v, 0, d, 70, 0.5, { rate1: 120, shape: (k) => Math.min(1, k * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1) });
      // the pile receiving it: a soft low hush of sand landing (low, never a broadband hiss)
      v.noise('pink', { t: 0.08, g: [[0, 0], [0.3, 0.05], [d - 0.2, 0.06], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, 500], [d, 900, 'e']], 1.4, { t: 0.08 }) });
      hum(v, 0, BB4, [[0, 0], [0.35, 0.05], [d - 0.3, 0.06], [d, 0.0001, 'e']], { breath: 0.4 });
    },
  },
  /** The sculpt: sand slides off him in two soft bands (2.4 → 1.2 kHz). */
  hgiShed: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      for (const [t, g] of [[0, 0.16], [0.11, 0.12]] as const) {
        sweep(v, t, 0.12, [2400, 1900, 1200], g, { q: 3, kind: 'white', peakAt: 0.3 });
        grains(v, t, 0.12, 160, 0.22, { shape: (k) => 1 - k });
      }
    },
  },
  /** The catch + plant: a brass tink, a beat later the soft thud of the foot, a puff, the trickle restarting. */
  hgiCatch: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      tink(v, 0, 0.13);
      tink(v, 0.07, 0.07, { f: TINK * 1.122 });
      base(v, 0.09, 0.55);
      grains(v, 0.16, 0.5, 40, 0.18, { shape: (k) => 1 - k * 0.7 });
    },
  },
  /** The giggle: three nasal blips gliding up 760 → 1020 Hz. */
  hgiGiggle: {
    cap: 2,
    gap: 0.15,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      blip(v, 0, 760, 820, 0.15);
      blip(v, 0.075, 840, 920, 0.13);
      blip(v, 0.15, 930, 1020, 0.14, 0.075);
      v.noise('white', { t: 0.02, g: [[0, 0], [0.04, 0.012], [0.2, 0.0001, 'e']], to: v.filt('bandpass', 2400, 2) });
    },
  },
  // ---------------------------------------------------------------- strike
  /** The flip / heave: two brass tinks, the sand sliding inside the glass, a low "turn" thump (≈ 0.5 s). */
  hgiFlip: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      tink(v, 0, 0.1);
      tink(v, 0.09, 0.08, { f: 1324 });
      grains(v, 0.03, 0.18, 260, 0.34, { shape: (k) => Math.sin(Math.PI * k) });
      thump(v, 0.12, 110, 70, 0.32, 0.16);
      hum(v, 0.05, [[0, BB4 * 0.98], [0.4, BB4, 'e']], [[0, 0], [0.08, 0.025], [0.4, 0.0001, 'e']], { breath: 0.2 });
    },
  },
  /** The stopper flicked off: a tiny pop. */
  hgiCork: {
    cap: 2,
    gap: 0.04,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      v.tone('sine', [[0, 900], [0.025, 300, 'e']], { g: perc(0.22, 0.028, 0.0005) });
      crack(v, 0.002, 0.1, { hp: 3000, lp: 9000, n: 1, dec: 0.006 });
    },
  },
  /** The jet (sustained ≈ 0.7 s; stopped after contact): dense grains at the upper resonance + a thin hiss rising. */
  hgiJet: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.4,
    play(v) {
      const d = 0.75;
      grains(v, 0, d, 230, 0.42, { rate1: 300, hi: 3000, shape: (k) => Math.min(1, k * 10) });
      const hp = v.filt('highpass', [[0, 1500], [d, 2100, 'e']], 0.8);
      const bp = v.filt('bandpass', [[0, 2600], [d, 3300, 'e']], 1.6, { to: hp });
      v.noise('white', { g: [[0, 0], [0.03, 0.06], [d - 0.1, 0.07], [d, 0.0001, 'e']], to: bp });
      hum(v, 0, [[0, BB4], [d, BB4 * 1.06, 'e']], [[0, 0], [0.05, 0.022], [d, 0.0001, 'e']], { breath: 0.3 });
    },
  },
  /** The scour (our impact on a body): grain bursts + a falling sand-blast sweep + a bulb blip. */
  hgiScour: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    duck: 0.5,
    play(v) {
      v.bursts([0, 0.012, 0.03, 0.052], [0.8, 0.55, 0.42, 0.3], { dec: 0.014, f: 2800, q: 1.2 });
      sweep(v, 0, 0.17, [3000, 2600, 1500], 0.24, { q: 1.4, kind: 'white', peakAt: 0.15 });
      thump(v, 0, 150, 90, 0.24, 0.07);
      hum(v, 0.02, F5, [[0, 0], [0.01, 0.06], [0.16, 0.0001, 'e']], { breath: 0.25 });
      grains(v, 0.06, 0.3, 120, 0.25, { shape: (k) => 1 - k });
    },
  },
  /** Blocked: the jet cut short on the guard — a dull "fff", grains bouncing off. */
  hgiSplash: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      v.bursts([0, 0.01, 0.024], [0.42, 0.3, 0.2], { dec: 0.01, f: 2400, q: 1.1 });
      puff(v, 0, 0.36, 0.12, 600, { kind: 'pink' });
      grains(v, 0.02, 0.22, 180, 0.24, { shape: (k) => (1 - k) * (1 - k) });
    },
  },
  /** Direct contact: the soft dune "fff" against the LP panel + an F5 bulb hum. */
  hgiJetLp: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      puff(v, 0, 0.36, 0.2, 1400, { kind: 'pink' });
      hum(v, 0.01, F5, [[0, 0], [0.02, 0.06], [0.2, 0.0001, 'e']], { breath: 0.3 });
      grains(v, 0, 0.35, 140, 0.3, { shape: (k) => 1 - k });
      thump(v, 0, 130, 80, 0.2, 0.08);
    },
  },
  /** Direct: the little dune slides off the panel. */
  hgiDune: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      sweep(v, 0, 0.22, [1600, 1400, 900], 0.06, { q: 2, kind: 'pink', peakAt: 0.3 });
      grains(v, 0, 0.26, 90, 0.2, { rate1: 30, shape: (k) => 1 - k });
    },
  },
  /** Re-cork + right: a thumb press, the glass turned upright and thunked, two jumps of sand, the trickle back. */
  hgiRight: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      tick(v, 0, 0.12, { f: 2600 });
      grains(v, 0.06, 0.07, 260, 0.26);
      grains(v, 0.17, 0.07, 260, 0.22);
      tink(v, 0.21, 0.06);
      base(v, 0.22, 0.4, { f0: 125, f1: 80 });
      grains(v, 0.33, 0.4, 40, 0.14, { shape: (k) => 1 - k * 0.8 });
    },
  },
  // ---------------------------------------------------------------- effect: "Kum Mührü"
  /** The thread (sustained ≈ 0.6 s): a thin grain trickle at the upper resonance + the hum rising B♭4 → F5. */
  hgiThread: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      const d = 0.65;
      grains(v, 0, d, 60, 0.36, { rate1: 90, lo: 2000, hi: 2800, shape: (k) => Math.min(1, k * 8) });
      hum(v, 0, [[0, BB4], [d * 0.9, F5, 'e']], [[0, 0], [0.08, 0.04], [d, 0.05]], { breath: 0.45 });
    },
  },
  /** The glass builds round the target: three stepped glass tings B♭5 D6 F6 + the pour inside. */
  hgiCage: {
    cap: 6,
    gap: 0.008,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      ting(v, midiHz(82), 0, 0.09, 0.07);
      ting(v, midiHz(86), 0.075, 0.08, 0.07);
      ting(v, midiHz(89), 0.15, 0.08, 0.09);
      grains(v, 0, 0.28, 120, 0.26);
    },
  },
  /** Sand fills the cage's lower bulb: a short trickle swell at the lower resonance. */
  hgiFill: {
    cap: 3,
    gap: 0.02,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      grains(v, 0, 0.13, 240, 0.34, { lo: 1400, hi: 2200, shape: (k) => Math.sin(Math.PI * Math.min(1, k * 1.1)) });
      puff(v, 0.02, 0.08, 0.12, 700, { kind: 'pink' });
    },
  },
  /**
   * THE STOP: (the caller cuts every trickle dead first) 60 ms of silence, one dry 4 kHz "tık", then a flat B♭4 + F5
   * glass tone held 380 ms that stops with a 2 ms cut — no decay, no reverb tail on it.
   */
  hgiSeal: {
    cap: 1,
    gap: 0.2,
    verb: 0,
    duck: 0.75,
    play(v) {
      const t0 = 0.06;
      tick(v, t0, 0.7);
      const t1 = t0 + 0.004;
      const flat = (g: number): Pt[] => [[0, 0], [0.004, g], [SEAL_MS, g], [SEAL_MS + 0.002, 0.0001, 'l']];
      v.tone('sine', BB4, { t: t1, g: flat(0.13) });
      v.tone('sine', F5, { t: t1, g: flat(0.04) });
      v.tone('sine', BB4 * 2, { t: t1, g: flat(0.018) });
    },
  },
  /** Condense: the cage collapses into the emblem — a tight glass "zip" up + a tiny brass tick. */
  hgiCondense: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 0.18, [1200, 2600, 4000], 0.09, { q: 5, kind: 'white', peakAt: 0.7 });
      v.tone('sine', [[0, BB4], [0.17, BB4 * 3, 'e']], { g: [[0, 0], [0.12, 0.03], [0.18, 0.0001, 'e']] });
      tink(v, 0.18, 0.05, { f: 2360, dec: 0.1 });
    },
  },
  // ---------------------------------------------------------------- the seal across turns
  /** The frozen turn starts: a muffled tick + an 80 ms trickle that is refused (stops dead). */
  hgiBite: {
    cap: 6,
    gap: 0.008,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      tick(v, 0, 0.3, { f: 1800 });
      grains(v, 0.03, 0.08, 220, 0.2);
      v.tone('sine', BB4, { t: 0.03, g: [[0, 0], [0.01, 0.03], [0.08, 0.03], [0.082, 0.0001, 'l']] });
    },
  },
  /** The strain: grains clamping ×3 rising, a choked hum cut at 150 ms. */
  hgiStrain: {
    cap: 6,
    gap: 0.008,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      v.bursts([0, 0.06, 0.12], [0.18, 0.24, 0.32], { dec: 0.03, f: 1800, q: 2.4 });
      grains(v, 0, 0.16, 200, 0.18, { lo: 1400, hi: 2400 });
      v.tone('sine', [[0, BB4 * 0.94], [0.15, BB4, 'e']], { g: [[0, 0], [0.03, 0.04], [0.15, 0.05], [0.152, 0.0001, 'l']] });
    },
  },
  /** The thaw: a quick trickle that thins and runs out + a light F6 glass ting. */
  hgiThaw: {
    cap: 3,
    gap: 0.05,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      grains(v, 0, 0.26, 180, 0.32, { rate1: 30, shape: (k) => 1 - k * 0.7 });
      ting(v, midiHz(89), 0.27, 0.07, 0.22);
      v.tone('sine', [[0, F5], [0.25, BB4, 'e']], { g: [[0, 0], [0.03, 0.025], [0.26, 0.0001, 'e']] });
    },
  },
  /** The sealed monster leaves the field: the emblem falls — a falling glass blip + a short grain scatter. */
  hgiEmblemDrop: {
    cap: 3,
    gap: 0.02,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      v.tone('sine', [[0, F5], [0.12, BB4 * 0.75, 'e']], { g: perc(0.04, 0.13, 0.003) });
      tick(v, 0.12, 0.18, { f: 3200 });
      grains(v, 0.12, 0.16, 160, 0.2, { shape: (k) => 1 - k });
    },
  },
  // ---------------------------------------------------------------- death: "Kendi kum saatine akar"
  /** The drain (sustained ≈ 0.55 s): a fast inward trickle + the hum gliding DOWN B♭4 → F4. */
  hgiDrain: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      const d = 0.6;
      grains(v, 0, d, 160, 0.42, { rate1: 220, shape: (k) => Math.min(1, k * 8) });
      hum(v, 0, [[0, BB4], [d, BB4 * 0.749, 'e']], [[0, 0], [0.05, 0.06], [d, 0.03]], { breath: 0.4 });
    },
  },
  /** The topple: the glass tips over — a dull thud + a glass crack (3 re-strikes). */
  hgiTopple: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      base(v, 0, 0.6, { f0: 130, f1: 70 });
      crack(v, 0.025, 0.22, { hp: 4000, lp: 11000, n: 3, gap: 0.006, dec: 0.01 });
      tink(v, 0.01, 0.04, { f: 1580, dec: 0.12 });
    },
  },
  /** The bleed: the trickle thinning from 80 grains / s to 4 and stopping (≈ 0.4 s). */
  hgiBleed: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      grains(v, 0, 0.42, 80, 0.3, { rate1: 4, lo: 1400, hi: 2600, shape: (k) => 1 - k * 0.5 });
      hum(v, 0, [[0, BB4 * 0.749], [0.4, BB4 * 0.7, 'e']], [[0, 0], [0.04, 0.016], [0.42, 0.0001, 'e']], { breath: 0.5 });
    },
  },
  /** The last grain: one dry tick + a tiny B♭6 ping (30 ms) — then silence. */
  hgiLastGrain: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      tick(v, 0, 0.9, { f: 3500 });
      ting(v, midiHz(94), 0.004, 0.2, 0.05);
    },
  },
  // ---------------------------------------------------------------- revive
  /** The sand runs back up (sustained ≈ 1.1 s): grains rising + the hum rising F4 → B♭4 (the drain reversed). */
  hgiReviveGather: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      const d = 1.1;
      grains(v, 0, d, 20, 0.36, { rate1: 200, shape: (k) => 0.3 + 0.7 * k });
      hum(v, 0, [[0, BB4 * 0.749], [d, BB4, 'e']], [[0, 0], [0.2, 0.03], [d, 0.06]], { breath: 0.45 });
    },
  },
  /** Revive land: the sandal plant + the sand sneeze "pff". */
  hgiReviveLand: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      thump(v, 0, 160, 90, 0.5, 0.1, { drive: 1.1 });
      puff(v, 0.16, 0.2, 0.06, 3000, { kind: 'white', att: 0.01 });
      blip(v, 0.15, 980, 700, 0.06, 0.05);
      grains(v, 0.17, 0.14, 160, 0.18, { shape: (k) => 1 - k });
    },
  },
} satisfies Record<string, Recipe>;

export type HourglassImpSfxName = keyof typeof HOURGLASS_IMP_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry), shipped with its strike / death cinematics. */
export const HOURGLASS_IMP_VOICE: CharacterSounds | null = {
  roar: 'hgiGiggle',
  arrive: 'hgiPour',
  land: 'hgiCatch',
  charge: 'hgiFlip',
  release: 'hgiJet',
  impact: 'hgiScour',
  dissolve: 'hgiDrain',
  burst: 'hgiLastGrain',
  reviveGather: 'hgiReviveGather',
  reviveLand: 'hgiReviveLand',
};
