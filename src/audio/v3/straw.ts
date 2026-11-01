// Saman Korkuluk (straw_decoy_token, lane D) — the straw scarecrow token's own sound set (?look=v3 only;
// YENI_KARTLAR §S9, §5.1 "S9 Korkuluk: saman hışırtısı · saman + ahşap kazık · kazık 'tok' + uzak karga 'gak'").
// src/audio/sounds.ts spreads V3_STRAW_RECIPES and SfxName gains StrawSfxName. Every name is prefixed
// `scarecrow` (the spell straw_decoys is lane E's: its names never collide with these).
//
// Identity: DRY straw (a dense, bright, high-passed rustle — many tiny noise grains, never a soft puff: there is
// NO "pof" here, that one belongs to wisp_imp), a DRY wooden stake (a short, high, splintery "tok": three pitches
// for the three stakes — not the hollow 180 Hz knot of hollow_ogre), a rope (a rasping zip as the binding comes
// undone), a burlap sack (a gritty dull tap), the button eyes (a small horn-button "tik" with a tiny glint, far
// from the jester's 3.2 kHz clock tick), and the far crow: an FM-rasped sawtooth through three formants, low-passed
// and wet so it sits in the distance ("gak").
//
//   arrive  scarecrowFall          the stake whistles down out of the sky (a short falling air streak)
//   land    scarecrowStakeA/B/C    the stake is planted: dry wood "tok" + dirt crunch (three pitches)
//           scarecrowWrap          straw wraps round the stake in the wind (sustained; stopped when the jacket flies on)
//           scarecrowJacket        the old jacket flies on and snaps
//           scarecrowSack          the sack head drops onto the stake (gritty burlap tap)
//           scarecrowHat           the felt hat lands (a soft brim flick)
//           scarecrowEye           the button eyes light once: "tik" + a glint
//           scarecrowCrow          a distant crow: "gak … gak"
//   roar    scarecrowRoar          a gust bursts the scarecrow open, the crow flies off cawing
//   charge  scarecrowCharge        it rocks back on its stake: a rope-and-wood creak, straw bristling (sustained → release)
//           scarecrowHop           a hop on the stake across the floor: a light "tok" (vary)
//   release scarecrowWhip          the straw arm whips forward (swish + straw rattle)
//   impact  scarecrowSlap          a straw slap: a dense burst of straw grains on a light dull thud
//           scarecrowBounce        blocked: the straw splays on the guard, the stake wobbles back (wood boing)
//   (vanish) scarecrowUntie        the rope binding comes undone (a rasping zip + a slack flick)
//   dissolve scarecrowSpill        the straw bundles spill to the floor (a pouring rustle)
//   afterDissolve scarecrowTopple  the stake topples onto the floor: a clatter "tok" and two little bounces
//   burst   scarecrowScatter       the wind takes the last of the straw (an airy gust + sparse grains)
//   reviveGather scarecrowGather   the straw gathers back (rising rustle, sustained → land)
//   reviveLand   scarecrowRise     the stake rights itself (a "tok" + the eyes' tik)
// Levels: pre-chain linear amplitudes like the slice; small beats duck ≤ 0.3, the planted stake and the topple
// ≤ 0.45 (a token is small: nothing here ducks like a monster's signature, SE-7).

import type { Recipe } from '../sounds';
import { perc, type Pt, type Voice } from '../synth';
import { puff, scaled, sweep, thump } from './kit';

/** Dry wood "tok": a splintery click + three short inharmonic wood modes (+ an optional dirt thud). */
function tok(v: Voice, t: number, f: number, g: number, o: { dirt?: number; dec?: number; to?: AudioNode } = {}): void {
  const dec = o.dec ?? 0.07;
  // the strike: a few ms of band-passed noise (the bark splinters)
  v.noise('white', { t, g: perc(g * 0.9, 0.006, 0.0003), to: v.filt('bandpass', f * 3.1, 2.2, { to: o.to }) });
  // the stake rings very briefly: f, 2.57 f, 4.2 f (dry: the upper ones die at once)
  v.tone('sine', [[0, f * 1.04], [0.01, f, 'e']], { t, g: perc(g, dec, 0.0006), to: o.to });
  v.tone('sine', f * 2.57, { t, g: perc(g * 0.42, dec * 0.45, 0.0006), to: o.to });
  v.tone('sine', f * 4.21, { t, g: perc(g * 0.16, dec * 0.25, 0.0006), to: o.to });
  if (o.dirt) {
    // the point bites the dirt: a low thud and a crunch of grit
    thump(v, t, 150, 62, g * o.dirt, 0.09, { to: o.to });
    v.crackle({ t: t + 0.004, d: 0.07, n: 9, g: g * o.dirt * 0.22, f: 1400, q: 0.9, dec: 0.008, curve: 1.6, to: o.to });
  }
}

/** Dry straw rustle: a bright crackle of straw grains (`n` over `d` s) through a high band, panned by `pan`. */
function rustle(v: Voice, t: number, d: number, n: number, g0: number, o: { f?: number; curve?: number; to?: AudioNode; dec?: number } = {}): void {
  // (a grain of a few ms through a wide band carries little energy: the levels below are per grain, ×5)
  const g = g0 * 5;
  v.crackle({ t, d, n, g, f: o.f ?? 5200, q: 0.8, dec: o.dec ?? 0.007, curve: o.curve ?? 1, to: o.to });
  v.crackle({ t: t + 0.003, d, n: Math.round(n * 0.6), g: g * 0.6, f: (o.f ?? 5200) * 0.55, q: 1.1, dec: (o.dec ?? 0.007) * 1.6, curve: o.curve ?? 1, to: o.to });
}

/** The far crow: an FM-rasped sawtooth through three formants (a, then the closing "k"). */
function caw(v: Voice, t: number, f0: number, d: number, g: number, to?: AudioNode): void {
  const out = v.drive(2.2, { to, trim: 0.6 });
  const bank = v.amp(1, { t, to: out });
  const F: readonly [number, number, number][] = [
    [820, 640, 5],
    [1350, 1100, 6],
    [2500, 2100, 7],
  ];
  for (const [a, b, q] of F) {
    const bp = v.filt('bandpass', [[0, a * 0.85], [d * 0.25, a, 'e'], [d, b, 'e']], q, { t, to: out });
    bank.connect(bp);
  }
  const env: Pt[] = [[0, 0], [0.014, g], [d * 0.45, g * 0.75], [d, 0.0001, 'e']];
  const o = v.tone('sawtooth', [[0, f0 * 0.92], [0.03, f0 * 1.08, 'e'], [d, f0 * 0.78, 'e']], { t, g: env, to: bank });
  // the rasp: a fast frequency modulation (the crow's harsh throat)
  v.lfo(o.osc.frequency, 74, f0 * 0.32, { t, d: d + 0.02 });
  v.tone('square', [[0, f0 * 1.5], [d, f0 * 1.15, 'e']], { t, g: scaled(env, 0.18), to: bank });
  // the closing "k": a click at the end
  v.noise('white', { t: t + d * 0.82, g: perc(g * 0.25, 0.01, 0.0005), to: v.filt('bandpass', 2600, 2, { to }) });
}

/** A stake's planting: wood "tok" at pitch f, dirt thud and crunch, a few straw flecks jump. */
function stake(v: Voice, f: number): void {
  tok(v, 0, f, 0.34, { dirt: 0.8, dec: 0.08 });
  // the dry pole buzzes once as it settles
  v.tone('triangle', f * 0.5, { t: 0.012, g: perc(0.05, 0.12, 0.002), to: v.filt('lowpass', 900, 0.8) });
  rustle(v, 0.02, 0.12, 6, 0.04, { curve: 1.8 });
}

/** Distance for the crow: a lowpass and a little echo. */
function far(v: Voice): AudioNode {
  const lp = v.filt('lowpass', 2900, 0.7);
  return v.echo(0.19, 0.28, { to: lp, wet: 0.35, tone: 2000 });
}

export const V3_STRAW_RECIPES = {
  /** Summon: the stake drops out of the sky — a short falling air streak. */
  scarecrowFall: {
    cap: 4,
    gap: 0.03,
    verb: 0.2,
    duck: 0.1,
    play(v) {
      sweep(v, 0, 0.14, [1800, 1100, 600], 0.3, { kind: 'pink', q: 1.4, peakAt: 0.75 });
    },
  },
  /** Summon 'land': the first stake is planted — dry wood "tok" (the low one) + dirt. */
  scarecrowStakeA: { cap: 2, gap: 0.03, verb: 0.25, duck: 0.35, play: (v) => stake(v, 520) },
  /** Summon 'land': the second stake (a third higher). */
  scarecrowStakeB: { cap: 2, gap: 0.03, verb: 0.25, duck: 0.35, play: (v) => stake(v, 655) },
  /** Summon 'land': the third stake (a fifth above the first). */
  scarecrowStakeC: { cap: 2, gap: 0.03, verb: 0.25, duck: 0.35, play: (v) => stake(v, 780) },
  /** Summon: straw wraps round the stake in the wind — a swirling rustle on a wind band (sustained, ≈ 0.55 s). */
  scarecrowWrap: {
    cap: 3,
    gap: 0.05,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      const D = 0.5;
      const pan = v.panner([[0, -0.4], [0.17, 0.4], [0.34, -0.3], [D, 0.25]]);
      rustle(v, 0, D, 60, 0.07, { curve: 0.8, to: pan });
      sweep(v, 0, D + 0.08, [700, 2400, 1400], 0.2, { kind: 'pink', q: 1.3, peakAt: 0.6, to: pan });
      // the bundle tightens: two little squeaks of straw on wood
      v.tone('sine', [[0, 1700], [0.05, 2300, 'e']], { t: 0.2, g: perc(0.012, 0.05, 0.004), to: pan });
      v.tone('sine', [[0, 1900], [0.05, 2600, 'e']], { t: 0.38, g: perc(0.012, 0.05, 0.004), to: pan });
    },
  },
  /** Summon: the old jacket flies on and snaps open on the cross bar (a cloth snap, two flutters). */
  scarecrowJacket: {
    cap: 3,
    gap: 0.04,
    verb: 0.22,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.1, [500, 1500, 900], 0.25, { kind: 'pink', q: 1.2, peakAt: 0.7 });
      v.noise('white', { t: 0.085, g: perc(0.6, 0.018, 0.0004), to: v.filt('bandpass', 1500, 1.6) });
      v.noise('pink', { t: 0.085, g: perc(0.32, 0.05, 0.001), to: v.filt('bandpass', 700, 1.2) });
      v.bursts([0.13, 0.155], [0.16, 0.1], { dec: 0.02, f: 1200, q: 1.4, kind: 'pink' });
    },
  },
  /** Summon: the sack head drops onto the stake — a gritty, dull burlap tap (not a puff). */
  scarecrowSack: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      thump(v, 0, 210, 120, 0.2, 0.05);
      v.crackle({ d: 0.05, n: 10, g: 0.05, f: 900, q: 1.2, dec: 0.006, curve: 1.4 });
      v.noise('white', { g: perc(0.06, 0.012, 0.0004), to: v.filt('bandpass', 2400, 1.5) });
    },
  },
  /** Summon: the felt hat lands — a soft brim flick. */
  scarecrowHat: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    duck: 0.1,
    play(v) {
      v.noise('pink', { g: perc(0.2, 0.03, 0.002), to: v.filt('bandpass', 1100, 1.5) });
      v.tone('sine', [[0, 340], [0.04, 260, 'e']], { g: perc(0.1, 0.04, 0.002) });
    },
  },
  /** Summon: the button eyes light once — a horn-button "tik" and a small glint. */
  scarecrowEye: {
    cap: 4,
    gap: 0.03,
    verb: 0.35,
    duck: 0.15,
    play(v) {
      v.noise('white', { g: perc(0.3, 0.004, 0.0002), to: v.filt('bandpass', 2100, 3) });
      v.tone('sine', 1880, { g: perc(0.13, 0.03, 0.0004) });
      v.tone('sine', 1880 * 2.9, { g: perc(0.04, 0.012, 0.0004) });
      // the glint: a soft high shimmer that dies at once
      v.tone('sine', [[0, 4400], [0.12, 4700]], { t: 0.012, g: [[0, 0], [0.02, 0.03], [0.16, 0.0001, 'e']] });
    },
  },
  /** A distant crow: "gak … gak" (FM rasp through formants, far away). */
  scarecrowCrow: {
    cap: 1,
    gap: 0.6,
    verb: 0.6,
    duck: 0.15,
    play(v) {
      const to = far(v);
      caw(v, 0, 560, 0.15, 0.13, to);
      caw(v, 0.27, 520, 0.17, 0.1, to);
    },
  },
  /** The roar: a gust bursts the scarecrow open, the crow flies off cawing (wing flaps). */
  scarecrowRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.55, [400, 2200, 900], 0.12, { kind: 'pink', q: 0.9, peakAt: 0.35, pan: [-0.3, 0.3] });
      rustle(v, 0.06, 0.4, 40, 0.08, { curve: 1.3 });
      v.noise('white', { t: 0.12, g: perc(0.15, 0.018, 0.0004), to: v.filt('bandpass', 1500, 1.6) });
      v.bursts([0.18, 0.26, 0.34], [0.06, 0.05, 0.035], { dec: 0.03, f: 900, q: 1.1, kind: 'pink' });
      caw(v, 0.2, 600, 0.15, 0.12);
    },
  },
  /** Strike charge: it rocks back on its stake — a rope-and-wood creak, straw bristling, wind holding (sustained). */
  scarecrowCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      const D = 0.75;
      const E = D + 0.15;
      // the creak: a rough friction tone (a rope on dry wood) around 330 Hz, stick-slip gated
      const bp = v.filt('bandpass', [[0, 320], [D, 420, 'e']], 4);
      const gate = v.ring([[0, 22], [D, 34, 'e']], { d: E, mix: 0.85, to: bp });
      v.tone('sawtooth', [[0, 300], [D, 360, 'e']], { g: [[0, 0], [0.12, 0.09], [D, 0.11], [E, 0.0001, 'e']], to: gate });
      rustle(v, 0.05, D, 28, 0.04, { curve: 0.7 });
      sweep(v, 0, E, [500, 1300, 1700], 0.035, { kind: 'pink', q: 1.5, peakAt: 0.85 });
    },
  },
  /** A hop on the stake across the floor: a light "tok" (the scene varies the pitch). */
  scarecrowHop: {
    cap: 4,
    gap: 0.04,
    verb: 0.2,
    duck: 0.1,
    vary: 0.06,
    play(v) {
      tok(v, 0, 610, 0.2, { dirt: 0.35, dec: 0.05 });
      rustle(v, 0.01, 0.06, 4, 0.025);
    },
  },
  /** Strike release: the straw arm whips forward — a swish and a straw rattle. */
  scarecrowWhip: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      sweep(v, 0, 0.13, [900, 3800, 1600], 0.4, { kind: 'white', q: 1.6, peakAt: 0.55, pan: [-0.2, 0.25] });
      rustle(v, 0.02, 0.12, 14, 0.06);
    },
  },
  /** Strike contact: a straw slap — a dense burst of grains on a light, dull thud (it does no harm). */
  scarecrowSlap: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      v.noise('white', { g: perc(0.22, 0.016, 0.0003), to: v.filt('bandpass', 1900, 1.3) });
      rustle(v, 0, 0.16, 26, 0.1, { curve: 2 });
      thump(v, 0, 190, 110, 0.18, 0.05);
    },
  },
  /** Blocked: the straw splays on the guard and the stake wobbles back — a wood "boing" and a creak. */
  scarecrowBounce: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      v.noise('white', { g: perc(0.18, 0.012, 0.0003), to: v.filt('bandpass', 2300, 1.4) });
      rustle(v, 0, 0.12, 16, 0.08, { curve: 1.8 });
      // the stake flexes: a wobbling wood tone (vibrato that slows)
      const o = v.tone('triangle', [[0, 250], [0.35, 205, 'e']], { t: 0.02, g: perc(0.1, 0.35, 0.004), to: v.filt('lowpass', 1100, 1.2) });
      v.lfo(o.osc.frequency, [[0, 14], [0.35, 6, 'e']], 26, { t: 0.02, d: 0.36 });
      tok(v, 0.02, 700, 0.1, { dec: 0.04 });
    },
  },
  /** Vanish f1: the rope binding comes undone — a rasping zip and a slack flick. */
  scarecrowUntie: {
    cap: 3,
    gap: 0.05,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      // the rope slides through the knot: a band of rasp falling, gated by its fibres
      const bp = v.filt('bandpass', [[0, 2600], [0.16, 900, 'e']], 2.2);
      const gate = v.ring([[0, 90], [0.16, 40, 'e']], { d: 0.2, mix: 0.75, to: bp });
      v.noise('white', { g: [[0, 0], [0.02, 0.45], [0.13, 0.28], [0.19, 0.0001, 'e']], to: gate });
      // the slack end flicks free
      v.noise('white', { t: 0.17, g: perc(0.3, 0.012, 0.0003), to: v.filt('bandpass', 1700, 1.8) });
      rustle(v, 0.1, 0.12, 10, 0.05);
    },
  },
  /** Vanish dissolve: the straw bundles spill to the floor — a pouring rustle that thins out. */
  scarecrowSpill: {
    cap: 3,
    gap: 0.05,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      rustle(v, 0, 0.5, 70, 0.08, { curve: 1.5, f: 4600 });
      // bundles land on the marble: soft dull pats
      v.bursts([0.05, 0.16, 0.29, 0.4], [0.07, 0.06, 0.045, 0.03], { dec: 0.025, f: 650, q: 1, kind: 'pink' });
      puff(v, 0.02, 0.04, 0.3, 1800, { kind: 'pink', att: 0.03 });
    },
  },
  /** Vanish: the stake topples onto the floor — a clatter "tok" and two smaller bounces. */
  scarecrowTopple: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      tok(v, 0, 470, 0.36, { dirt: 0.5, dec: 0.09 });
      tok(v, 0.012, 610, 0.15, { dec: 0.05 });
      tok(v, 0.13, 500, 0.14, { dec: 0.05 });
      tok(v, 0.21, 520, 0.07, { dec: 0.04 });
      rustle(v, 0.01, 0.2, 14, 0.05, { curve: 1.6 });
    },
  },
  /** Vanish burst: the wind takes the last of the straw — an airy gust and sparse grains. */
  scarecrowScatter: {
    cap: 3,
    gap: 0.05,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.5, [600, 1900, 3000], 0.25, { kind: 'pink', q: 1, peakAt: 0.4, pan: [-0.25, 0.35] });
      rustle(v, 0.04, 0.42, 20, 0.04, { curve: 1.2, f: 6200 });
    },
  },
  /** Revive gather: the straw gathers back round the stake — a rising rustle (sustained). */
  scarecrowGather: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      const D = 0.6;
      v.crackle({ d: D, n: 50, g: 0.3, f: 4800, q: 0.8, dec: 0.007, curve: 0.5 });
      sweep(v, 0, D + 0.1, [500, 1500, 2600], 0.2, { kind: 'pink', q: 1.4, peakAt: 0.9 });
    },
  },
  /** Revive land: the stake rights itself — a "tok" and the button eyes' tik. */
  scarecrowRise: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      tok(v, 0, 655, 0.3, { dirt: 0.5 });
      v.noise('white', { t: 0.09, g: perc(0.08, 0.004, 0.0002), to: v.filt('bandpass', 2100, 3) });
      v.tone('sine', 1880, { t: 0.09, g: perc(0.04, 0.03, 0.0004) });
    },
  },
} satisfies Record<string, Recipe>;

export type StrawSfxName = keyof typeof V3_STRAW_RECIPES;
