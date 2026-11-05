// Hurda Akıncıları (scrap_raiders, lane D, C5) — the scrap cart-tank's own sound set (?look=v3 only;
// YENI_KARTLAR §C5 SFX, §5.1). src/audio/sounds.ts spreads V3_RAIDERS_RECIPES and SfxName gains RaidersSfxName.
//
// Identity (§5.1 C5): a 70 Hz single-cylinder ENGINE ("pat-pat-pat": a driven low thump per firing + an exhaust
// chuff), SCRAP TIN (thin, short, clattering FM plates at a high 1.73 ratio — never a long ring: the anvil's
// ring and the jester's brass coin keep those), and THREE GOBLIN MOUTHS (pulse voices through two formants, high
// registers 330 / 415 / 520 Hz, fast pitch jitter) that bicker, cheer, pant and squeal — always panned apart
// (slinger left / pedaller centre / wrench goblin right for P1). No glass, no sand, no spring "boing" (jester),
// no 110/111 beat (polar family): the raiders are low, rattly and loud-mouthed.
//
//   arrive  raidersScrapRain     the scrap pile falls from above: a whistle and the first junk clinks
//   land    raidersHeapCrash     the pile crashes onto the tile (tin avalanche + 70 Hz thud + dust)
//           raidersPop           the three goblins pop out of the heap: "hey! — hop! — ya!"
//           raidersHammer        one hammer blow on the cart (×3, pitched up each time)
//           raidersVuf           the stove catches: "VUF" + the engine coughs to life
//           raidersCheer         the war cheer of three mouths over the idling engine
//   roar    raidersRoar          cheer + VUF (the roar pose / flip)
//   charge  raidersRev           the back-pedal: the engine revs up, tyres squeal, tin rattles (sustained → swing)
//   release raidersLaunch        off it goes: a throttle blat, the slinger's falling "waaa!"
//           raidersRumble        the bouncing charge: engine at full rev + rattling tin (sustained → contact)
//           raidersBounce        one bounce of the cart (tin + thud)
//   impact  raidersRam           the ram hits: iron clank + 70 Hz thud + crack, bolts and gears pinging down after
//           raidersBonk          blocked: a dull iron bonk, the plates wobble, "ow!"
//           raidersLoose         the follow-through: the front wheel wobbles loose (squeal + a bolt tinks away)
//           raidersHop           the slinger jumps back in: "hop!" + a tin thunk
//   toGuard raidersWheelOff      the wheel drops off: clank, a rattling wobble that settles, the nose clunks down
//           raidersPant          the tired guard: three mouths panting + steam hiss from the stove
//           raidersTink          a repair tap of the wrench on the bare axle (guard frames)
//   lock end raidersWheelOn      the wheel is hammered back on: BANG + the engine coughs + a short cheer
//   deathStart raidersCreak      the cart groans under the blow (iron stress, rivets popping)
//           raidersFlee          the goblins bail out three ways: three squeals, L / C / R
//   dissolve   raidersCollapse   the tub caves in: descending clanks
//   afterDissolve raidersWheelRoll  a loose wheel rolls off and falls flat
//   burst   raidersBurst         the scrap settles: a last clatter, the engine's final cough
//   reviveGather raidersReviveGather  the scrap is dragged back together (sustained → land)
//   reviveLand   raidersReviveLand    the cart drops on its wheels: VUF + cheer
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { perc, type Pt, type Voice } from '../synth';
import { clank, crack, link, puff, scaled, sweep, thump } from './kit';

/** The engine's firing pitch (70 Hz). */
const ENGINE = 70;
/** The three goblin mouths: base pitch (Hz), formants (Hz), pan (P1 view: slinger left, pedaller centre, wrench right). */
const GOB = [
  { f: 415, fm: [900, 2300] as const, pan: -0.6 }, // the slinger (back)
  { f: 330, fm: [720, 1900] as const, pan: 0 }, // the pedaller (middle, goggles)
  { f: 520, fm: [1100, 2700] as const, pan: 0.6 }, // the wrench goblin (front)
] as const;

// ================================================================ building blocks

/** One engine firing: a driven 70 Hz thump + an exhaust chuff. */
function putt(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? ENGINE;
  thump(v, t, f * 1.35, f * 0.8, g, 0.075, { drive: 2.2, to: o.to });
  v.noise('brown', { t, g: perc(g * 0.9, 0.045, 0.002), to: v.filt('lowpass', 520, 0.9, { to: o.to }) });
}

/** A run of engine firings from rate r0 to r1 (Hz) over `d`; returns the times used. */
function engine(v: Voice, t: number, d: number, r0: number, r1: number, g0: number, g1: number, o: { f0?: number; f1?: number; to?: AudioNode } = {}): number[] {
  const out: number[] = [];
  let x = 0;
  while (x < d) {
    const k = x / d;
    out.push(t + x);
    putt(v, t + x, g0 + (g1 - g0) * k, { f: (o.f0 ?? ENGINE) + ((o.f1 ?? ENGINE) - (o.f0 ?? ENGINE)) * k, to: o.to });
    x += 1 / (r0 + (r1 - r0) * k);
  }
  return out;
}

/** A scrap-tin plate struck: thin FM clatter at a high ratio (short, never a ring) + a click. */
function tin(v: Voice, f: number, t: number, g: number, dec = 0.09, to?: AudioNode): void {
  v.bell(f, { t, g, dec, ratio: 1.73, index: 3.6, idxDec: dec * 0.3, to });
  v.bell(f * 1.47, { t: t + 0.003, g: g * 0.5, dec: dec * 0.7, ratio: 2.29, index: 2.2, to });
  v.noise('white', { t, g: perc(g * 1.4, 0.006, 0.0002), to: v.filt('bandpass', Math.min(8000, f * 2.4), 1.6, { to }) });
}

/** A rattle: `n` tin hits scattered over `d` (pitches from `lo`..`hi`). */
function rattle(v: Voice, t: number, d: number, n: number, g: number, lo = 900, hi = 2600, to?: AudioNode): void {
  for (let i = 0; i < n; i++) tin(v, v.r(lo, hi), t + v.r(0, d), g * v.r(0.5, 1), v.r(0.04, 0.08), to);
}

/**
 * One goblin mouth: a pulse voice with a pitch contour (multiples of its base), through its two formants,
 * jittered (a gabbling, nasal goblin), panned to its seat. `vowel` scales the first formant (0.7 "u" … 1.2 "a").
 */
function gob(v: Voice, who: 0 | 1 | 2, t: number, d: number, g: number, contour: readonly Pt[], o: { vowel?: number; pan?: number; to?: AudioNode; grit?: number } = {}): void {
  const G = GOB[who];
  const out = v.panner(o.pan ?? G.pan, { to: o.to });
  // the two narrow formants eat most of the pulse's energy: the mouth's level is made up here (×2.6)
  const G2 = g * 2.6;
  const sum = v.amp([[0, 0], [0.012, G2], [Math.max(0.02, d * 0.7), G2 * 0.8], [d, 0.0001, 'e']], { t, to: out });
  const vw = o.vowel ?? 1;
  const f1 = v.filt('bandpass', [[0, G.fm[0] * vw * 0.8], [d * 0.3, G.fm[0] * vw, 'e'], [d, G.fm[0] * vw * 0.85, 'e']], 3.2, { t, to: sum });
  const f2 = v.filt('bandpass', G.fm[1] * (0.9 + vw * 0.1), 4.5, { t, to: sum });
  const grit = v.drive(o.grit ?? 2.5, { to: f1, trim: 0.8 });
  grit.connect(f2);
  const f = contour.map(([x, k, c]) => [x, G.f * k, c] as Pt);
  const src = v.tone('p25', f, { t, d: d + 0.02, to: grit });
  v.wander(src.osc.detune, 22, 70, { t, d });
}

/** "hey!": a quick rise-fall. */
const HEY: Pt[] = [[0, 0.9], [0.05, 1.25, 'e'], [0.16, 0.95, 'e']];
/** "ya!": a shout that falls. */
const YA: Pt[] = [[0, 1.15], [0.04, 1.3, 'e'], [0.2, 0.85, 'e']];
/** "hop!": short up-flick. */
const HOP: Pt[] = [[0, 0.95], [0.07, 1.3, 'e']];
/** a cheer "hu-raa": two syllables, the second higher and held. */
function cheer(v: Voice, who: 0 | 1 | 2, t: number, g: number, k = 1): void {
  gob(v, who, t, 0.11, g * 0.8, [[0, 0.95 * k], [0.1, 1.05 * k, 'e']], { vowel: 0.75 });
  gob(v, who, t + 0.13, 0.32, g, [[0, 1.1 * k], [0.06, 1.35 * k, 'e'], [0.26, 1.25 * k], [0.32, 1.05 * k, 'e']], { vowel: 1.2 });
}

/** A panting breath: a filtered noise "hh" (in or out) in one mouth's register. */
function breath(v: Voice, who: 0 | 1 | 2, t: number, g: number, out: boolean): void {
  const G = GOB[who];
  const d = out ? 0.16 : 0.12;
  const env: Pt[] = out ? [[0, 0], [0.02, g], [d, 0.0001, 'e']] : [[0, 0], [d * 0.8, g], [d, 0.0001, 'e']];
  v.noise('pink', { t, g: scaled(env, 3.2), to: v.filt('bandpass', G.fm[0] * (out ? 1.4 : 1.8), 1.6, { to: v.panner(G.pan) }) });
  if (out) v.tone('p25', [[0, G.f * 0.9], [d, G.f * 0.75, 'e']], { t, g: scaled(env, 0.5), to: v.filt('bandpass', G.fm[0], 4, { to: v.panner(G.pan) }) });
}

/** Tyre squeal: a wobbling 1.9 kHz whine + scrubbing noise. */
function squeal(v: Voice, t: number, d: number, g: number, f = 1900): void {
  const env: Pt[] = [[0, 0], [0.04, g], [d * 0.8, g * 0.8], [d, 0.0001, 'e']];
  const s = v.tone('triangle', [[0, f * 0.9], [d, f * 1.06]], { t, g: env, to: v.filt('bandpass', f, 3) });
  v.lfo(s.osc.detune, 23, 60, { t, d });
  v.noise('white', { t, g: scaled(env, 0.5), to: v.filt('bandpass', f * 1.6, 2.5) });
}

/** The stove catching: a low "VUF" (a brown-noise whoomp that opens and closes) + a thud + fire crackle. */
function vuf(v: Voice, t: number, g: number): void {
  const lp = v.filt('lowpass', [[0, 160], [0.05, 1300, 'e'], [0.4, 220, 'e']], 1.4, { t });
  v.noise('brown', { t, g: [[0, 0], [0.03, g * 1.3], [0.12, g * 0.8], [0.45, 0.0001, 'e']], to: lp });
  thump(v, t, 110, 48, g * 0.9, 0.25, { drive: 1.6 });
  v.bursts([0.06, 0.1, 0.13, 0.19, 0.24, 0.31], [0.5, 0.35, 0.45, 0.3, 0.25, 0.15].map((x) => x * g * 0.6), { t, dec: 0.012, f: 3200, q: 0.9 });
}

/** A falling junk whistle (a plate cutting the air), `d` long, from `f0` to `f1`. */
function whistle(v: Voice, t: number, d: number, f0: number, f1: number, g: number, pan = 0): void {
  sweep(v, t, d, [f0, f0 * 0.95, f1], g, { q: 6, kind: 'white', peakAt: 0.8, pan: [pan, pan] });
}

// ================================================================ recipes

export const V3_RAIDERS_RECIPES = {
  // ---------------------------------------------------------------- summon
  /** The scrap pile falls from the sky: two descending whistles and the first junk clinks onto the tile. */
  raidersScrapRain: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      whistle(v, 0, 0.42, 2600, 1100, 0.2, -0.3);
      whistle(v, 0.08, 0.36, 3300, 1500, 0.14, 0.35);
      for (const [x, f, g] of [[0.2, 2300, 0.16], [0.29, 1700, 0.2], [0.35, 2900, 0.13], [0.41, 1300, 0.22]] as const) tin(v, f, x, g, 0.06);
    },
  },
  /** The pile crashes down: a tin avalanche over a 70 Hz thud, a crack, and the dust. */
  raidersHeapCrash: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      thump(v, 0, 140, 52, 0.62, 0.32, { drive: 2.4 });
      crack(v, 0, 0.22, { hp: 1800, lp: 9000, n: 2, gap: 0.014, dec: 0.02 });
      clank(v, 420, 0, 0.22, 0.22, { ratio: 1.73, index: 4, click: 1.2 });
      rattle(v, 0.01, 0.38, 14, 0.13, 800, 3000);
      puff(v, 0.01, 0.28, 0.4, 900, { kind: 'brown' });
    },
  },
  /** Three goblins pop out of the heap, one after the other: "hey!" (slinger) — "hop!" (pedaller) — "ya!" (wrench). */
  raidersPop: {
    cap: 1,
    gap: 0.15,
    verb: 0.2,
    duck: 0.35,
    play(v) {
      gob(v, 0, 0, 0.16, 0.2, HEY, { vowel: 1.1 });
      tin(v, 2100, 0.005, 0.06, 0.05);
      gob(v, 1, 0.09, 0.09, 0.2, HOP, { vowel: 0.8 });
      tin(v, 1600, 0.095, 0.06, 0.05);
      gob(v, 2, 0.17, 0.2, 0.2, YA, { vowel: 1.2 });
      tin(v, 2600, 0.175, 0.05, 0.05);
    },
  },
  /** One hammer blow of the wrench on the cart: a short iron clank, a tin answer, a little thud. */
  raidersHammer: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      clank(v, 1180, 0, 0.26, 0.16, { ratio: 1.41, index: 2.6, click: 2 });
      tin(v, 2400, 0.004, 0.08, 0.07);
      thump(v, 0, 190, 90, 0.3, 0.07, { drive: 1.4 });
    },
  },
  /** The stove catches — "VUF" — and the 70 Hz engine coughs to life (pat … pat-pat-pat). */
  raidersVuf: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      vuf(v, 0, 0.5);
      putt(v, 0.32, 0.3);
      engine(v, 0.52, 0.5, 7, 9, 0.32, 0.22);
      rattle(v, 0.5, 0.45, 4, 0.05, 1200, 2400);
    },
  },
  /** The war cheer: three mouths "hu-RAA!" (staggered), the engine idling under it. */
  raidersCheer: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.5,
    play(v) {
      cheer(v, 1, 0, 0.17, 1);
      cheer(v, 2, 0.05, 0.16, 1);
      cheer(v, 0, 0.1, 0.15, 1);
      engine(v, 0, 0.6, 8, 8, 0.12, 0.07);
      tin(v, 1900, 0.18, 0.06, 0.06);
    },
  },
  /** The roar pose: VUF, then the cheer. */
  raidersRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.6,
    play(v) {
      vuf(v, 0, 0.45);
      cheer(v, 1, 0.12, 0.17, 1.05);
      cheer(v, 2, 0.16, 0.16, 1.05);
      cheer(v, 0, 0.2, 0.15, 1.05);
      engine(v, 0.3, 0.45, 8, 10, 0.24, 0.14);
    },
  },

  // ---------------------------------------------------------------- strike "Hurda Hücumu"
  /** The back-pedal: the engine revs from a lazy pat-pat to a roar, the tyres squeal, the tin rattles (sustained). */
  raidersRev: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    duck: 0.35,
    play(v) {
      const D = 2.4;
      engine(v, 0, D, 6, 22, 0.13, 0.26, { f0: 66, f1: 92 });
      squeal(v, 0.22, D - 0.22, 0.06, 1850);
      rattle(v, 0.1, D - 0.1, 22, 0.06, 1100, 2800);
      // the goblins egg each other on
      gob(v, 1, 0.25, 0.14, 0.11, HEY, { vowel: 1 });
      gob(v, 2, 0.6, 0.16, 0.1, YA, { vowel: 1.15 });
    },
  },
  /** Off it goes: a throttle blat, the tyres bite, the slinger thrown off behind with a falling "waaa!". */
  raidersLaunch: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      const lp = v.filt('lowpass', [[0, 300], [0.06, 1400, 'e'], [0.35, 400, 'e']], 2);
      v.tone('sawtooth', [[0, 72], [0.08, 128, 'e'], [0.35, 105]], { g: perc(0.15, 0.35, 0.01), to: v.drive(2.5, { to: lp, trim: 0.7 }) });
      putt(v, 0, 0.28, { f: 85 });
      squeal(v, 0, 0.14, 0.08, 2100);
      gob(v, 0, 0.06, 0.42, 0.17, [[0, 1.35], [0.08, 1.45, 'e'], [0.42, 0.8, 'e']], { vowel: 1.15, pan: -0.75 });
      tin(v, 1500, 0.02, 0.09, 0.07);
    },
  },
  /** The bouncing charge: engine at full rev, the tub rattling (sustained → contact). */
  raidersRumble: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    duck: 0.4,
    play(v) {
      const D = 1.2;
      engine(v, 0, D, 20, 24, 0.27, 0.27, { f0: 92, f1: 98 });
      rattle(v, 0, D, 16, 0.07, 1000, 2900);
      puff(v, 0, 0.12, D, 500, { kind: 'brown', att: 0.05 });
    },
  },
  /** One bounce of the cart: the tub lands on its springs (thud + tin). */
  raidersBounce: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    duck: 0.25,
    vary: 0.06,
    play(v) {
      thump(v, 0, 120, 60, 0.36, 0.09, { drive: 1.8 });
      tin(v, 1400, 0.002, 0.09, 0.07);
      tin(v, 2350, 0.012, 0.06, 0.05);
    },
  },
  /** The ram hits: iron clank (1.41) + 70 Hz thud + crack; bolts and gears ping down after the hit-stop. */
  raidersRam: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.65,
    play(v) {
      clank(v, 520, 0, 0.4, 0.32, { ratio: 1.41, index: 3.2, click: 2.8 });
      thump(v, 0, 150, ENGINE * 0.75, 0.75, 0.26, { drive: 2.8 });
      crack(v, 0, 0.34, { hp: 2000, lp: 10000, n: 2, gap: 0.009 });
      // the ram's iron-on-target smack: a hard, short transient on top (the loudest beat of the strike)
      v.noise('white', { t: 0, g: perc(0.5, 0.018, 0.0005), to: v.filt('bandpass', 2600, 0.8) });
      tin(v, 1700, 0.003, 0.12, 0.1);
      // the flying bolts and gears land and bounce (after the freeze)
      for (const [x, f, g] of [[0.2, 3300, 0.07], [0.26, 2700, 0.06], [0.31, 3900, 0.05], [0.37, 3100, 0.045], [0.45, 2900, 0.04], [0.52, 3500, 0.03]] as const) link(v, f, x, g, 0.08);
      tin(v, 2200, 0.34, 0.05, 0.05);
    },
  },
  /** Blocked: a dull iron bonk on the guard, the tin plates wobble, a goblin "ow!". */
  raidersBonk: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      clank(v, 330, 0, 0.3, 0.26, { ratio: 1.22, index: 2, click: 1.2 });
      thump(v, 0, 110, 55, 0.5, 0.2, { drive: 2 });
      const w = v.tone('triangle', 640, { g: perc(0.07, 0.4, 0.004), to: v.filt('bandpass', 700, 2) });
      v.lfo(w.osc.detune, 11, 90, { d: 0.4 });
      rattle(v, 0.02, 0.25, 6, 0.07, 900, 2200);
      gob(v, 2, 0.08, 0.18, 0.15, [[0, 1.4], [0.18, 0.9, 'e']], { vowel: 0.9 });
    },
  },
  /** The follow-through: the front wheel works loose — an iron squeak and a bolt that tinks away. */
  raidersLoose: {
    cap: 1,
    gap: 0.15,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      const s = v.tone('triangle', [[0, 820], [0.28, 980]], { g: [[0, 0], [0.03, 0.16], [0.24, 0.1], [0.3, 0.0001, 'e']], to: v.filt('bandpass', 900, 3) });
      v.lfo(s.osc.detune, 17, 140, { d: 0.3 });
      link(v, 3400, 0.05, 0.08, 0.07);
      link(v, 3300, 0.17, 0.05, 0.06);
      link(v, 3250, 0.25, 0.03, 0.05);
    },
  },
  /** The slinger catches up and jumps back in: "hop!" and a tin thunk. */
  raidersHop: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    duck: 0.25,
    play(v) {
      gob(v, 0, 0, 0.1, 0.17, HOP, { vowel: 0.85 });
      thump(v, 0.09, 160, 90, 0.2, 0.06);
      tin(v, 1800, 0.09, 0.07, 0.06);
    },
  },

  // ---------------------------------------------------------------- tired guard (the lock)
  /** The wheel drops off: a clank, its rattling wobble settling on the floor, the nose clunks down, a groan. */
  raidersWheelOff: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      clank(v, 760, 0, 0.18, 0.16, { ratio: 1.73, index: 3, click: 1.6 });
      // the iron tyre's wobble on the floor: accelerating rattles, then quiet
      let x = 0.06;
      let gap = 0.07;
      let g = 0.1;
      for (let i = 0; i < 9; i++) {
        tin(v, 1250 + x * 600, x, g, 0.04);
        x += gap;
        gap = Math.max(0.014, gap * 0.78);
        g *= 0.88;
      }
      thump(v, 0.12, 110, 50, 0.45, 0.16, { drive: 2 });
      puff(v, 0.12, 0.12, 0.2, 700);
      for (const who of [1, 2, 0] as const) gob(v, who, 0.24 + who * 0.04, 0.3, 0.09, [[0, 1.05], [0.3, 0.7, 'e']], { vowel: 0.75 });
    },
  },
  /** The tired guard: three mouths panting out of step, the stove hissing steam. */
  raidersPant: {
    cap: 1,
    gap: 0.3,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      const seq: [0 | 1 | 2, number][] = [[1, 0], [2, 0.09], [0, 0.17], [1, 0.3], [2, 0.38], [0, 0.47], [1, 0.6], [2, 0.69]];
      for (const [who, t] of seq) {
        breath(v, who, t, 0.2, true);
        breath(v, who, t + 0.16, 0.14, false);
      }
      v.noise('white', { t: 0.05, g: [[0, 0], [0.1, 0.07], [0.7, 0.05], [0.95, 0.0001, 'e']], to: v.filt('highpass', 4200, 0.8, { to: v.panner(-0.4) }) });
    },
  },
  /** One repair tap of the wrench on the bare axle (quiet). */
  raidersTink: {
    cap: 2,
    gap: 0.08,
    verb: 0.25,
    duck: 0.1,
    vary: 0.04,
    play(v) {
      link(v, 1850, 0, 0.09, 0.09);
      v.noise('white', { g: perc(0.08, 0.004, 0.0002), to: v.filt('bandpass', 4000, 1.4) });
      thump(v, 0, 220, 140, 0.06, 0.03);
    },
  },
  /** Lock end: the last blow puts the wheel back on — BANG — the engine coughs twice, a short cheer. */
  raidersWheelOn: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      clank(v, 980, 0, 0.3, 0.22, { ratio: 1.41, index: 3, click: 2.2 });
      thump(v, 0, 170, 70, 0.5, 0.14, { drive: 2 });
      tin(v, 2200, 0.005, 0.1, 0.08);
      putt(v, 0.2, 0.3);
      putt(v, 0.33, 0.34);
      engine(v, 0.45, 0.3, 9, 9, 0.22, 0.14);
      cheer(v, 2, 0.32, 0.14, 1.08);
      cheer(v, 1, 0.36, 0.12, 1.08);
    },
  },

  // ---------------------------------------------------------------- idle / rested guard
  /** Idle identity: two goblins bicker (gabbled syllables) over a loose plate's takırtı. Quiet (a living detail). */
  raidersChatter: {
    cap: 1,
    gap: 1.2,
    verb: 0.2,
    duck: 0.1,
    vary: 0.06,
    play(v) {
      gob(v, 1, 0, 0.08, 0.05, [[0, 1.05], [0.08, 0.9, 'e']], { vowel: 0.85 });
      gob(v, 1, 0.1, 0.07, 0.045, [[0, 1.1], [0.07, 1.2, 'e']], { vowel: 1.1 });
      gob(v, 2, 0.2, 0.12, 0.05, [[0, 1.2], [0.05, 1.4, 'e'], [0.12, 1.0, 'e']], { vowel: 1.15 });
      gob(v, 1, 0.36, 0.09, 0.04, [[0, 0.95], [0.09, 0.8, 'e']], { vowel: 0.8 });
      // the loose plate rattles on the engine beat
      for (const x of [0.02, 0.16, 0.3, 0.44]) tin(v, v.r(1500, 2300), x, 0.025, 0.04);
    },
  },
  /** The rested guard: three "hup!"s as the crew ducks behind the rim, the wrench clanks down on the ram, a tin settle. */
  raidersBrace: {
    cap: 1,
    gap: 0.2,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      gob(v, 2, 0, 0.08, 0.11, HOP, { vowel: 0.8 });
      gob(v, 0, 0.04, 0.08, 0.09, HOP, { vowel: 0.8 });
      gob(v, 1, 0.08, 0.08, 0.09, [[0, 1.0], [0.08, 0.85, 'e']], { vowel: 0.7 });
      clank(v, 610, 0.13, 0.16, 0.14, { ratio: 1.41, index: 2.2, click: 1 });
      thump(v, 0.13, 120, 60, 0.18, 0.07, { drive: 1.6 });
      rattle(v, 0.15, 0.12, 3, 0.04, 1200, 2400);
    },
  },

  // ---------------------------------------------------------------- death
  /** The cart groans under the blow: iron stress (a resonant low saw bending down), rivets popping. */
  raidersCreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      const bp = v.filt('bandpass', [[0, 380], [0.35, 240, 'e']], 6);
      v.tone('sawtooth', [[0, ENGINE * 1.1], [0.35, ENGINE * 0.75, 'e']], { g: [[0, 0], [0.04, 0.5], [0.3, 0.36], [0.38, 0.0001, 'e']], to: bp });
      for (const x of [0.04, 0.13, 0.19]) crack(v, x, 0.1, { hp: 3000, lp: 9000, dec: 0.008 });
      tin(v, 2600, 0.1, 0.06, 0.05);
    },
  },
  /** The goblins bail out three ways: three squeals — left, centre, right — out of step. */
  raidersFlee: {
    cap: 1,
    gap: 0.2,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      gob(v, 1, 0, 0.3, 0.15, [[0, 1.2], [0.06, 1.55, 'e'], [0.3, 1.35, 'e']], { vowel: 1.2, pan: -0.8 });
      gob(v, 2, 0.07, 0.28, 0.14, [[0, 1.25], [0.06, 1.6, 'e'], [0.28, 1.4, 'e']], { vowel: 1.25, pan: 0.8 });
      gob(v, 0, 0.13, 0.3, 0.13, [[0, 1.3], [0.1, 1.7, 'e'], [0.3, 1.5, 'e']], { vowel: 1.3, pan: 0 });
      // three pairs of tiny running feet
      v.bursts([0.05, 0.11, 0.17, 0.23, 0.08, 0.15, 0.22, 0.29], [0.12, 0.1, 0.08, 0.06, 0.1, 0.08, 0.06, 0.05], { dec: 0.015, f: 1200, q: 1 });
    },
  },
  /** The tub caves in: five clanks tumbling down in pitch, quicker and quicker, over a heavy settle. */
  raidersCollapse: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      const seq = [[0, 880, 0.22], [0.09, 700, 0.2], [0.16, 560, 0.2], [0.21, 450, 0.18], [0.25, 360, 0.18]] as const;
      for (const [x, f, g] of seq) clank(v, f, x, g, 0.18, { ratio: 1.73, index: 3.4, click: 1.2 });
      thump(v, 0.18, 120, 45, 0.55, 0.3, { drive: 2.2 });
      rattle(v, 0.05, 0.4, 10, 0.08, 700, 2500);
      puff(v, 0.2, 0.2, 0.4, 800, { kind: 'brown' });
    },
  },
  /** A loose wheel rolls off over the marble (decelerating rattle) and falls flat (a settling wobble). */
  raidersWheelRoll: {
    cap: 1,
    gap: 0.2,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      let x = 0;
      let gap = 0.05;
      while (x < 0.45) {
        v.noise('white', { t: x, g: perc(0.12, 0.02, 0.001), to: v.filt('bandpass', 1500, 2) });
        x += gap;
        gap *= 1.12;
      }
      let y = 0.5;
      let gg = 0.2;
      let gp = 0.08;
      for (let i = 0; i < 8; i++) {
        tin(v, 1150, y, gg, 0.04);
        y += gp;
        gp = Math.max(0.012, gp * 0.75);
        gg *= 0.8;
      }
    },
  },
  /** The scrap settles: a last clatter, gears pinging, the engine's final dying cough. */
  raidersBurst: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      rattle(v, 0, 0.35, 12, 0.1, 900, 3200);
      thump(v, 0, 100, 45, 0.35, 0.22, { drive: 1.6 });
      for (const [x, f] of [[0.15, 3600], [0.24, 3100], [0.33, 2800]] as const) link(v, f, x, 0.05, 0.07);
      putt(v, 0.42, 0.2, { f: 62 });
      putt(v, 0.62, 0.12, { f: 52 });
    },
  },

  // ---------------------------------------------------------------- revive
  /** The scrap is dragged back together: clinks rising in density and pitch over a rising engine (sustained). */
  raidersReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 1.4;
      let x = 0;
      while (x < D) {
        const k = x / D;
        tin(v, 900 + k * 1800 + v.r(-150, 150), x, 0.05 + k * 0.06, 0.05);
        x += 0.14 * (1 - k * 0.7);
      }
      engine(v, 0.4, D - 0.4, 4, 10, 0.12, 0.26);
    },
  },
  /** The cart drops on its wheels: clank + VUF + a short cheer. */
  raidersReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      thump(v, 0, 140, 55, 0.5, 0.2, { drive: 2 });
      tin(v, 1500, 0.002, 0.12, 0.08);
      vuf(v, 0.06, 0.4);
      cheer(v, 1, 0.22, 0.14, 1.05);
      cheer(v, 2, 0.26, 0.13, 1.05);
      cheer(v, 0, 0.3, 0.12, 1.05);
    },
  },
} satisfies Record<string, Recipe>;

export type RaidersSfxName = keyof typeof V3_RAIDERS_RECIPES;
