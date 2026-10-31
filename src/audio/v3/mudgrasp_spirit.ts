// Çamur Pençe Ruhu (mudgrasp_spirit) — v3 sounds (lane B). Spread into the game through ./kart-b.ts.
// Identity: docs/v3/YENI_KARTLAR.md §5.1 C10 "600 Hz vantuz · çamur · inilti (growl yavaş)".
// Built from ./kit.ts blocks and the Voice primitives only (no new DSP).
//
// Palette (one parameter set, clear of the slice's two characters and the lane's other three cards):
//   suction    the card's signature: the "şlop" — a band of air sucked through wet mud, centred on 600 Hz
//              (Q high), swelling and then cut dead by a low "plop" (a sine dropping from 600 Hz). Every
//              grab, every hand leaving the mud is one of these, so the card is recognisable by ear.
//   glub       mud bubbles: LOW and THICK (a sine gliding UP 90–260 Hz in ~60 ms, a muffled brown-noise
//              body) — an octave and more under the spring's A4–E5 blips (A5) and never C8's frog croak.
//   moan       the owner of the slow `growl`: a 55–85 Hz voice with very little grit, a slow rasp (19 Hz)
//              and its own dark "uu-oh" formants 250 / 560 / 1420 Hz (the wyrm's are 330 / 760 / 1950).
//   squelch    wet mass: brown noise through a moving 350–900 Hz band with a fast irregular flutter
//              (the clay slurping), plus soft droplet pats (band-passed pink clicks at 1.6–2.6 kHz).
//   clay       the mask: a dry ceramic "tık" (a short, high, inharmonic sine pair at 2.3 / 3.7 kHz) — the
//              only hard sound the card makes.
//   death      liquid draining: a rising-then-falling run of glubs (a drain gulping) and a last "glk" —
//              never a dry crumble, never a 28 Hz swell (S3).
//
//   mgVortex     summon (sustained, faded at land): the tile softens into a turning mud vortex
//   mgBurst      summon f2 / pin: hands burst up out of the mud (the 600 Hz "şlop" + a spray)
//   mgSlap       summon f3: two palms slap down and grip the tile edges (el şaplağı)
//   mgHaul       summon f5: the body is hauled up between the hands (a long wet drag, a strained grunt)
//   mgLand       summon 'land': out of the mud — a heavy wet settle, the mask clicks home, the eyes catch
//   mgRoar       the slow growl moan (the roar role; also the pin's "inilti")
//   mgCharge     strike charge (sustained): the hand digs a fistful out of the mound, a low hum rising
//   mgRelease    strike 'release': the lump leaves the palm (a suction pull-off + a heavy throw whoosh)
//   mgImpact     strike 'contact': "ŞLAP" — a fat wet splat, droplets pattering
//   mgSink       strike f8: the hands slap into the ground and sink (a slurp down, a glub)
//   mgGrumble    pin: the ground under the attacker rumbles and starts to churn (gürleme)
//   mgGrab       pin: the mud hands seize the feet — staggered suction cups clamping (kavrayan vantuz)
//   mgClamp      pin: the attacker is forced down into its guard (a heavy squelch, a low thud)
//   mgRing       pin: the ring of mud sets on the tile (a short churning settle with a glub)
//   mgDrip       small wet pat (drops off the lump, splat stains; quiet, repeatable)
//   mgMaskSlip   death f1: the clay mask slips on the melting face (a ceramic scrape)
//   mgDrain      death 'dissolve' (sustained): the body runs back into the tile's cracks — the drain
//   mgGlk        death: the mask sinks last — the final "glk" and the cracks closing
//   mgReviveGather / mgReviveLand   soul_recall's revive pair (the drain backwards; şlop + click)

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Voice } from '../synth';
import { crack, growl, puff, sweep, thump, type GrowlParams } from './kit';

// ================================================================ palette

/** The signature suction pitch (Hz). */
const SLOP = 600;

/** The moan's formants ("uu-oh", dark). */
const MOAN_FORMANTS = [250, 560, 1420] as const;

/**
 * The "şlop": air sucked through wet mud around `f` (a narrow band swelling over `d`), cut dead by a
 * low plop (a sine dropping from `f`) and a damp click.
 */
function slop(v: Voice, t: number, g: number, o: { f?: number; d?: number; pan?: number; to?: AudioNode } = {}): void {
  const f = (o.f ?? SLOP) * v.r(0.97, 1.03);
  const d = o.d ?? 0.075;
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  // the suck: a resonant band rising into the pitch, swelling, then stopping
  const bp = v.filt('bandpass', [[0, f * 0.55], [d, f, 'e'], [d + 0.03, f * 1.1, 'e']], 7, { t, to: out });
  v.noise('pink', { t, g: [[0, 0], [d * 0.85, g * 7], [d, g * 7.5], [d + 0.012, 0.0001, 'e']], to: bp });
  // the cavity's own tone, glottal-ish (it gives the "o")
  v.tone('triangle', [[0, f * 0.6], [d, f, 'e']], { t, g: [[0, 0], [d * 0.8, g * 0.7], [d + 0.01, 0.0001, 'e']], to: out });
  // the plop: the seal breaks, a sine dropping from the pitch
  v.tone('sine', [[0, f], [0.07, f * 0.38, 'e']], { t: t + d, g: perc(g * 1.4, 0.08, 0.001), to: out });
  // a damp click at the break
  v.noise('white', { t: t + d, g: perc(g * 0.5, 0.006, 0.0002), to: v.filt('bandpass', 2200, 1.4, { to: out }) });
}

/** A low, thick mud bubble (a sine gliding UP f0 → f0·2.6, muffled body). */
function glub(v: Voice, t: number, g: number, f0: number, o: { pan?: number; to?: AudioNode; len?: number } = {}): void {
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  const L = o.len ?? 0.06;
  const f = f0 * v.r(0.94, 1.06);
  v.tone('sine', [[0, f], [L, f * 2.6, 'e']], { t, g: [[0, 0], [0.006, g], [L * 0.7, g * 0.6], [L + 0.02, 0.0001, 'e']], to: out });
  v.tone('sine', [[0, f * 2], [L, f * 4.4, 'e']], { t, g: [[0, 0], [0.006, g * 0.18], [L, 0.0001, 'e']], to: out });
  v.noise('brown', { t, g: perc(g * 0.9, L * 0.8, 0.003), to: v.filt('lowpass', f * 3, 0.9, { t, to: out }) });
}

/** A run of glubs over `d` (density `n`, base pitch drifting f0 → f1). */
function glubs(v: Voice, t: number, d: number, n: number, g: number, f0: number, f1: number, o: { curve?: number; to?: AudioNode; spread?: number; shape?: (k: number) => number } = {}): void {
  const sp = o.spread ?? 0.4;
  for (let i = 0; i < n; i++) {
    const k = Math.pow(v.rnd(), o.curve ?? 1);
    const amp = g * v.r(0.5, 1) * (o.shape ? o.shape(k) : 1);
    glub(v, t + k * d, amp, f0 + (f1 - f0) * k, { pan: v.r(-sp, sp), to: o.to, len: v.r(0.045, 0.08) });
  }
}

/** Wet mass moving: brown noise through a moving band with a fast irregular flutter (slurp). */
function squelch(v: Voice, t: number, d: number, g: number, o: { f?: readonly [number, number, number]; rate?: number; to?: AudioNode } = {}): void {
  const [a, b, c] = o.f ?? [380, 820, 420];
  const fl = v.flutter(o.rate ?? 34, 0.75, { t, d: d + 0.03, base: 0.3, to: v.filt('bandpass', [[0, a], [d * 0.45, b, 'e'], [d, c, 'e']], 2.6, { t, to: o.to }) });
  v.noise('brown', { t, g: [[0, 0], [Math.min(0.04, d * 0.2), g * 2], [d * 0.6, g * 1.6], [d, 0.0001, 'e']], to: fl });
}

/** Soft droplet pats (wet, never gravel): band-passed pink clicks with a little low body. */
function pats(v: Voice, t: number, d: number, n: number, g: number, o: { f?: number; curve?: number; to?: AudioNode } = {}): void {
  v.crackle({ t, d, n, g, f: o.f ?? 1900, q: 1.6, dec: 0.016, kind: 'pink', curve: o.curve ?? 1.4, to: o.to });
  v.crackle({ t: t + 0.004, d, n: Math.ceil(n * 0.6), g: g * 0.8, f: 420, q: 1.2, dec: 0.02, kind: 'brown', curve: o.curve ?? 1.4, to: o.to });
}

/** The clay mask's dry ceramic "tık" (inharmonic sine pair, a hair of noise). */
function clay(v: Voice, t: number, g: number, o: { to?: AudioNode; f?: number } = {}): void {
  const f = o.f ?? 2300;
  v.tone('sine', f, { t, g: perc(g, 0.05, 0.0004), to: o.to });
  v.tone('sine', f * 1.61, { t, g: perc(g * 0.6, 0.032, 0.0004), to: o.to });
  v.tone('sine', f * 0.43, { t, g: perc(g * 0.4, 0.07, 0.0006), to: o.to });
  crack(v, t, g * 0.6, { hp: 3000, lp: 8000, dec: 0.005, to: o.to });
}

/** The slow moan (the card's growl): low, little grit, slow rasp, its own formants. */
function moan(v: Voice, t: number, d: number, g: number, f: GrowlParams['f'], o: { to?: AudioNode; grit?: number } = {}): void {
  growl(v, t, { d, f, formants: MOAN_FORMANTS, g, grit: o.grit ?? 2.6, rasp: 19 }, o.to);
}

/** A wet slap: a pink noise smack (1–2.5 kHz), a short low body, a few droplets. */
function smack(v: Voice, t: number, g: number, o: { pan?: number; to?: AudioNode; low?: number } = {}): void {
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  v.noise('pink', { t, g: perc(g * 4, 0.035, 0.0008), to: v.filt('bandpass', [[0, 2400], [0.03, 1100, 'e']], 1.1, { t, to: out }) });
  v.noise('white', { t, g: perc(g * 0.7, 0.01, 0.0003), to: v.filt('bandpass', 3800, 1.5, { to: out }) });
  thump(v, t, o.low ?? 170, 62, g * 1.3, 0.12, { to: out });
}

// ================================================================ recipes

export const MUDGRASP_SPIRIT_RECIPES = {
  /** Summon: the tile softens into a turning mud vortex (sustained ≈1.6 s; faded at land). */
  mgVortex: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      const D = 1.7;
      // the slurry turning: a band sweeping round and round (pan circling), slow flutter
      const pan = v.panner([[0, -0.5], [0.4, 0.5], [0.8, -0.4], [1.2, 0.45], [D, 0]]);
      const bp = v.filt('bandpass', [[0, 260], [0.4, 520, 'e'], [0.8, 330, 'e'], [1.2, 600, 'e'], [D, 380, 'e']], 2.2, { to: pan });
      const fl = v.flutter(14, 0.5, { d: D + 0.05, base: 0.5, to: bp });
      v.noise('brown', { g: [[0, 0], [0.5, 0.9], [D - 0.3, 1.1], [D, 0.0001, 'e']], to: fl });
      // the deep soft give of the floor: a low sine swelling, a little beat
      v.tone('sine', [[0, 48], [D, 58, 'e']], { g: [[0, 0], [0.6, 0.14], [D - 0.2, 0.16], [D, 0.0001, 'e']] });
      v.tone('sine', [[0, 49.5], [D, 59, 'e']], { g: [[0, 0], [0.6, 0.08], [D, 0.0001, 'e']] });
      // glubs thicken as the vortex turns faster
      glubs(v, 0.15, D - 0.3, 14, 0.2, 95, 140, { curve: 0.7, shape: (k) => 0.5 + 0.5 * k });
      // a low moan stirring under the mud (the spirit's breath, far below)
      moan(v, 0.5, 1.15, 0.06, [52, 56, 60, 57, 50], { grit: 1.8 });
    },
  },
  /** Summon f2 / pin: hands burst up out of the mud — the 600 Hz "şlop", a spray of wet. */
  mgBurst: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      slop(v, 0, 0.42, { d: 0.07, pan: -0.25 });
      slop(v, 0.05, 0.38, { d: 0.06, f: SLOP * 1.06, pan: 0.25 });
      puff(v, 0.075, 0.22, 0.18, 900, { kind: 'brown' });
      sweep(v, 0.07, 0.16, [700, 1600, 900], 0.12, { q: 1.2, kind: 'pink' });
      pats(v, 0.12, 0.35, 10, 0.12);
      glub(v, 0.15, 0.12, 100);
    },
  },
  /** Summon f3: two palms slap down and grip the tile edges (el şaplağı, left then right). */
  mgSlap: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      smack(v, 0, 0.32, { pan: -0.45 });
      smack(v, 0.045, 0.3, { pan: 0.45, low: 150 });
      // fingers curling over the edge: a short wet squeeze
      squelch(v, 0.07, 0.16, 0.14, { f: [600, 900, 500], rate: 46 });
      pats(v, 0.05, 0.3, 8, 0.1);
    },
  },
  /** Summon f5: the body is hauled up between the hands — a long wet drag, a strained low grunt. */
  mgHaul: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      squelch(v, 0, 0.5, 0.3, { f: [300, 700, 380], rate: 28 });
      moan(v, 0.02, 0.5, 0.13, [62, 74, 70, 66, 58], { grit: 3.2 });
      slop(v, 0.38, 0.16, { d: 0.09, f: SLOP * 0.9 });
      glubs(v, 0.05, 0.4, 5, 0.14, 110, 150);
    },
  },
  /** Summon 'land': out of the mud — a heavy wet settle, the mask clicks home, the eyes catch. */
  mgLand: {
    cap: 2,
    gap: 0.08,
    verb: 0.4,
    duck: 0.45,
    play(v) {
      thump(v, 0, 120, 44, 0.5, 0.3, { drive: 1.6 });
      puff(v, 0.003, 0.3, 0.32, 700, { kind: 'brown' });
      squelch(v, 0.01, 0.22, 0.18, { f: [500, 300, 260], rate: 22 });
      pats(v, 0.03, 0.4, 9, 0.1, { curve: 1.8 });
      // the mask seats: the ceramic click, a beat later
      clay(v, 0.13, 0.16);
      // the eyes ignite: a low violet hum blooming under it
      v.tone('sine', [[0, 82], [0.4, 110, 'e']], { t: 0.15, g: [[0, 0], [0.08, 0.1], [0.45, 0.0001, 'e']] });
      v.tone('triangle', [[0, 164], [0.4, 220, 'e']], { t: 0.15, g: [[0, 0], [0.08, 0.035], [0.4, 0.0001, 'e']] });
    },
  },
  /** The slow growl moan (roar role; the pin's inilti too). */
  mgRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.6,
    play(v) {
      moan(v, 0, 1.55, 0.3, [58, 66, 82, 74, 52]);
      // the chest boils while it moans
      glubs(v, 0.2, 1.1, 10, 0.14, 85, 120, { curve: 0.9 });
      // a wet low body under the voice
      v.tone('sine', [[0, 41], [1.4, 36, 'e']], { g: [[0, 0], [0.3, 0.12], [1.1, 0.1], [1.5, 0.0001, 'e']] });
    },
  },
  /** Strike charge (sustained): the hand digs a fistful out of the mound, a low hum rising under it. */
  mgCharge: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 1.3;
      squelch(v, 0.02, 0.28, 0.5, { f: [320, 760, 400], rate: 40 });
      slop(v, 0.26, 0.15, { d: 0.09, f: SLOP * 0.85 });
      // the arm draws back: a creaking wet stretch, a hum rising
      squelch(v, 0.38, 0.6, 0.25, { f: [400, 650, 900], rate: 20 });
      moan(v, 0.3, D - 0.3, 0.08, [56, 62, 70, 74, 76], { grit: 2 });
      v.tone('sine', [[0, 70], [D, 96, 'e']], { t: 0.3, g: [[0, 0], [0.5, 0.08], [D - 0.35, 0.1], [D - 0.3, 0.0001, 'e']] });
      pats(v, 0.3, 0.7, 6, 0.06);
    },
  },
  /** Strike 'release': the lump leaves the palm (suction pull-off) and is hurled (a heavy whoosh). */
  mgRelease: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      slop(v, 0, 0.18, { d: 0.05, f: SLOP * 1.12 });
      sweep(v, 0.02, 0.24, [260, 820, 380], 0.8, { q: 1.4, pan: [-0.3, 0.35], kind: 'pink', peakAt: 0.35 });
      v.tone('sine', [[0, 140], [0.2, 90, 'e']], { t: 0.02, g: perc(0.12, 0.2, 0.01) });
      // the lump wobbling in flight: a few wet flaps
      squelch(v, 0.08, 0.2, 0.08, { f: [500, 700, 500], rate: 18 });
    },
  },
  /** Strike 'contact': "ŞLAP" — a fat wet splat, droplets pattering after it. */
  mgImpact: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      smack(v, 0, 0.5, { low: 190 });
      thump(v, 0.002, 130, 46, 0.45, 0.24, { drive: 2 });
      puff(v, 0.004, 0.42, 0.26, 1300, { kind: 'pink' });
      // the mud spreading over the body: a short squelch
      squelch(v, 0.02, 0.2, 0.22, { f: [900, 500, 300], rate: 50 });
      slop(v, 0.1, 0.12, { d: 0.05, f: SLOP * 0.92 });
      pats(v, 0.05, 0.55, 16, 0.14, { curve: 1.7 });
      glub(v, 0.2, 0.12, 120);
    },
  },
  /** Strike f8: the hands slap into the ground and sink (slurp down, a glub). */
  mgSink: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      smack(v, 0, 0.2, { low: 140 });
      squelch(v, 0.03, 0.35, 0.45, { f: [700, 380, 220], rate: 26 });
      v.tone('sine', [[0, SLOP * 0.8], [0.3, 180, 'e']], { t: 0.04, g: [[0, 0], [0.05, 0.05], [0.3, 0.0001, 'e']] });
      glub(v, 0.28, 0.16, 92);
      glub(v, 0.36, 0.1, 110);
    },
  },
  /** Pin: the ground under the attacker rumbles and starts to churn (gürleme). */
  mgGrumble: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      const D = 0.75;
      const fl = v.flutter(9, 0.55, { d: D + 0.05, base: 0.55, to: v.drive(2.2, { trim: 0.7, to: v.filt('lowpass', [[0, 90], [D * 0.6, 210, 'e'], [D, 120, 'e']], 1.2) }) });
      v.noise('brown', { g: [[0, 0], [D * 0.5, 1.2], [D, 0.0001, 'e']], to: fl });
      v.tone('sine', [[0, 38], [D, 46, 'e']], { g: [[0, 0], [D * 0.4, 0.18], [D, 0.0001, 'e']] });
      squelch(v, 0.25, D - 0.2, 0.14, { f: [260, 520, 300], rate: 16 });
      glubs(v, 0.2, D - 0.2, 7, 0.16, 90, 130, { curve: 0.6 });
    },
  },
  /** Pin: the mud hands seize the attacker's feet — staggered suction cups clamping (kavrayan vantuz). */
  mgGrab: {
    cap: 2,
    gap: 0.06,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      [0, 0.07, 0.13, 0.2].forEach((t, i) => slop(v, t, 0.42 - i * 0.05, { d: 0.05 + i * 0.008, f: SLOP * (1 - i * 0.035), pan: (i % 2 ? 0.35 : -0.35) * (1 - i * 0.15) }));
      squelch(v, 0.02, 0.4, 0.08, { f: [300, 450, 260], rate: 44 });
      puff(v, 0, 0.2, 0.2, 800, { kind: 'brown' });
      pats(v, 0.05, 0.35, 9, 0.1);
    },
  },
  /** Pin: the attacker is forced down into its guard (a heavy squelch, a low thud). */
  mgClamp: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      thump(v, 0, 105, 38, 0.5, 0.34, { drive: 2.2 });
      squelch(v, 0, 0.32, 0.3, { f: [700, 320, 200], rate: 30 });
      puff(v, 0.004, 0.26, 0.3, 600, { kind: 'brown' });
      slop(v, 0.2, 0.14, { d: 0.08, f: SLOP * 0.8 });
      pats(v, 0.03, 0.3, 7, 0.08);
    },
  },
  /** Pin: the ring of mud sets on the tile (a short churning settle, one deep glub). */
  mgRing: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      squelch(v, 0, 0.3, 0.3, { f: [300, 420, 260], rate: 12 });
      glub(v, 0.06, 0.32, 84);
      glub(v, 0.2, 0.2, 104);
      v.tone('sine', [[0, 66], [0.4, 60, 'e']], { g: [[0, 0], [0.1, 0.06], [0.45, 0.0001, 'e']] });
    },
  },
  /** A small wet pat (drops off the lump, a stain landing; quiet, repeatable). */
  mgDrip: {
    cap: 6,
    gap: 0.008,
    verb: 0.25,
    duck: 0.1,
    vary: 0.08,
    play(v) {
      v.noise('pink', { g: perc(0.5, 0.018, 0.0005), to: v.filt('bandpass', 1700, 1.8) });
      glub(v, 0.004, 0.16, 170, { len: 0.035 });
    },
  },
  /** Death f1: the clay mask slips on the melting face (a ceramic scrape over wet). */
  mgMaskSlip: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const fl = v.flutter(60, 0.6, { d: 0.18, base: 0.35, to: v.filt('bandpass', [[0, 2600], [0.16, 1800, 'e']], 4) });
      v.noise('white', { g: [[0, 0], [0.02, 0.8], [0.16, 0.0001, 'e']], to: fl });
      clay(v, 0, 0.1, { f: 2100 });
      squelch(v, 0.02, 0.26, 0.35, { f: [600, 380, 260], rate: 24 });
      moan(v, 0.03, 0.42, 0.14, [60, 54, 46, 42, 38], { grit: 1.6 });
    },
  },
  /** Death 'dissolve' (sustained ≈0.9 s): the body runs back into the cracks — a drain gulping, rising then falling. */
  mgDrain: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.45,
    play(v) {
      const D = 0.95;
      // the run of liquid into the cracks: a band falling, a fast flutter (the trickle)
      const pan = v.panner([[0, 0.3], [0.3, -0.3], [0.6, 0.25], [D, 0]]);
      const fl = v.flutter(26, 0.7, { d: D + 0.04, base: 0.35, to: v.filt('bandpass', [[0, 900], [D * 0.4, 600, 'e'], [D, 260, 'e']], 2, { to: pan }) });
      v.noise('pink', { g: [[0, 0], [0.08, 1.3], [D * 0.6, 1.1], [D, 0.0001, 'e']], to: fl });
      // the drain's gulps: pitch rising then falling (giderden akan su gibi yükselen-inen glub)
      const n = 13;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const t = 0.03 + k * (D - 0.12) + v.r(-0.015, 0.015);
        const f = 95 + 140 * Math.sin(Math.PI * Math.min(1, k * 1.15));
        glub(v, t, 0.22 * (1 - 0.45 * k) * v.r(0.7, 1), f, { pan: v.r(-0.35, 0.35), len: v.r(0.05, 0.075) });
      }
      // the swirl's low hollow (reversed vortex), sinking
      v.tone('sine', [[0, 70], [D, 42, 'e']], { g: [[0, 0], [0.1, 0.12], [D, 0.0001, 'e']] });
    },
  },
  /** Death: the mask sinks last — the final "glk" (a bubble choked off) and the cracks closing. */
  mgGlk: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      // the mask going under: a last suction, lower than the şlop
      slop(v, 0, 0.12, { d: 0.09, f: SLOP * 0.62 });
      // the glk: a thick bubble, pitch up, choked
      v.tone('sine', [[0, 140], [0.03, 420, 'e']], { t: 0.12, g: [[0, 0], [0.004, 0.32], [0.028, 0.18], [0.034, 0.0001, 'e']] });
      v.noise('brown', { t: 0.12, g: perc(0.3, 0.03, 0.002), to: v.filt('lowpass', 600, 1) });
      // the cracks seal: a soft low close and a faint hollow ring
      thump(v, 0.16, 70, 40, 0.22, 0.25);
      v.tone('sine', [[0, 220], [0.5, 210, 'e']], { t: 0.18, g: perc(0.03, 0.5, 0.02) });
    },
  },
  /** Revive: the drain backwards — the mud gathers up out of the cracks (sustained; faded at land). */
  mgReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      const D = 1.2;
      const fl = v.flutter(20, 0.6, { d: D + 0.04, base: 0.35, to: v.filt('bandpass', [[0, 240], [D, 820, 'e']], 2) });
      v.noise('pink', { g: [[0, 0], [D * 0.7, 0.6], [D, 0.0001, 'e']], to: fl });
      for (let i = 0; i < 11; i++) {
        const k = i / 10;
        glub(v, 0.05 + k * (D - 0.15), 0.12 + 0.12 * k, 90 + 100 * k, { pan: v.r(-0.3, 0.3) });
      }
      moan(v, 0.4, 0.8, 0.09, [46, 52, 60, 64, 66], { grit: 1.8 });
      v.tone('sine', [[0, 42], [D, 66, 'e']], { g: [[0, 0], [D * 0.8, 0.12], [D, 0.0001, 'e']] });
    },
  },
  /** Revive 'land': the body whole again — a şlop, the mask clicks, a first wet breath. */
  mgReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.45,
    play(v) {
      slop(v, 0, 0.2, { d: 0.08 });
      thump(v, 0.08, 110, 44, 0.4, 0.28, { drive: 1.5 });
      clay(v, 0.16, 0.16);
      moan(v, 0.2, 0.5, 0.1, [64, 70, 66, 60, 56], { grit: 2 });
      pats(v, 0.1, 0.35, 7, 0.08);
    },
  },
} satisfies Record<string, Recipe>;

export type MudgraspSpiritSfxName = keyof typeof MUDGRASP_SPIRIT_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry). */
export const MUDGRASP_SPIRIT_VOICE: CharacterSounds | null = {
  roar: 'mgRoar',
  arrive: 'mgVortex',
  land: 'mgLand',
  charge: 'mgCharge',
  release: 'mgRelease',
  impact: 'mgImpact',
  deathStart: 'mgMaskSlip',
  dissolve: 'mgDrain',
  burst: 'mgGlk',
  reviveGather: 'mgReviveGather',
  reviveLand: 'mgReviveLand',
};
