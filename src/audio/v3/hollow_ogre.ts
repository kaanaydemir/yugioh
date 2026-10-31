// Kovuk Devi (hollow_ogre) — v3 sounds (lane B). Spread into the game through ./kart-b.ts.
// Identity: docs/v3/YENI_KARTLAR.md §5.1 C6 "180 Hz ahşap gıcırtısı · kovuk kütük + kök · budak 'tok' (içi boş
// ahşap rezonansı)". Built from ./kit.ts blocks and the Voice primitives only (no new DSP).
//
// Palette (one parameter set, clear of the slice's two characters, the lane's other three cards and §5.1's
// neighbours — not S1's ratchet, not S9's dry stake click, not the stone-grind rumble, not C3's wind ring):
//   creak      the card's signature: a STICK-SLIP creak of bending wood around 180 Hz — a sawtooth gliding slowly
//              (165 → 195 Hz) whose amplitude is chopped by an irregular stick-slip pulse train (bursts of brown
//              noise through a resonant 540 / 900 Hz band = the trunk's body), never a regular ratchet click.
//   tok        the knot "tok": a HOLLOW log resonance — a short band-passed click and a pair of decaying sines on
//              the slit-drum ratio 1 : 1.48 inside 300–600 Hz, with a low air-cavity "oom" under it (the hollow).
//              Pitches from F# major pentatonic (F#4 G#4 A#4 C#5 D#5 = 370 … 622 Hz; the lowest knot 311 Hz).
//   seed       the seed's flight: a pure sine arcing UP (≈ 700 → 1300 Hz, its pitch following the arc) with a
//              breathy band of pink air and a soft 6 Hz vibrato — a low, round "fiuuu", far from C3's high
//              rising wind ring and from the wisp's 5 kHz feathers.
//   roots      root fibres: dry rustle (pink noise through a moving 1.2–2.6 kHz band with a fast flutter) and
//              short fibre snaps (tiny cracks at 3–6 kHz) — wrapping, gripping, unravelling.
//   weight     the giant: driven 40–60 Hz body thumps, the club's wooden knock (the tok an octave down + a
//              splinter crack), leaves (a short high rustle) and loam (brown puffs).
//
//   hoLogFall       summon (sustained, faded at the stake): the log drops from above the screen — a falling
//                   whistle (air around a big body, pitch dropping), the log turning with a creak
//   hoStake         summon 'land': the log stakes into the tile — a huge driven thump, the hollow booms, splinters
//   hoBarkSplit     summon f3: the bark splits open from inside like a door (tearing creak, wood crack, two hinges)
//   hoStep          summon f6 / strike path: a heavy root foot comes down and the roots grip the floor
//   hoClubSlam      summon f9 SLAM / the roar role: the trunk groans (low creak) and the club pounds the ground
//   hoCharge        strike charge (sustained): the roots tighten round the club and heave it up — creaks climb
//   hoSwing         strike f4: the club comes over the shoulder (a low, wide wooden whoosh)
//   hoRelease       strike 'release': the smash comes down (the whoosh peaks, the trunk creaks forward)
//   hoImpact        strike 'contact': "Kütük Ezmesi" — the club smashes the floor: thump, tok, splinters, leaves
//   hoPollen        strike contact when boosted: the sprouts burst into violet pollen (soft knot chimes, air)
//   hoShoulder      strike f9: the club is thrown onto the shoulder (a wooden knock on wood, a creak)
//   hoReach         effect: the club reaches toward the graveyard, the roots creak, the graveyard stirs
//   hoShrink        effect (per seed): a graveyard monster shrinks into a violet light seed (a hollow inhale)
//   hoSeed          effect (per seed): the seed's arc through the air (the rising sine "fiuuu")
//   hoCatch         effect (per seed): the seed lands on the root tip and the tendril wraps it (rustle + tick)
//   hoKnot          effect (per seed): planted in the hollow — the knot "tok" and its glow (pass `pitch` 1 / 1.19)
//   hoSprout        effect (per seed): a new sprout springs on the club (+400 tick)
//   hoGlow          effect end: the hollow glows with its knot lights (a warm hollow chord, embers)
//   hoUnravel       death f1: the root arms unravel (a run of fibre snaps and creaks)
//   hoRootsRetract  death 'dissolve' (sustained): the roots snake back into the tile (loam rustle sliding down)
//   hoCollapse      death f5: the trunk caves in (a hollow crumple and a low boom)
//   hoWilt          death 'burst': the last sprout wilts — one leaf, a faint falling knot tone
//   hoReviveGather / hoReviveLand   soul_recall's revive pair (roots braid back up; whole again, eyes ignite)

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

// ================================================================ palette

/** The creak's centre pitch (Hz). */
const CREAK = 180;
/** F# major pentatonic knot pitches, D#4 … D#5 (midi). */
const KNOTS = [63, 66, 68, 70, 73, 75] as const;
/** The slit-drum mode ratio of a hollow log. */
const SLIT = 1.48;

/**
 * The stick-slip creak of bending wood: a 180 Hz saw gliding f0 → f1 over `d`, chopped by an irregular pulse
 * train (the fibres sticking and slipping), through the trunk's resonant body bands.
 */
function creak(v: Voice, t: number, d: number, g: number, o: { f0?: number; f1?: number; rate?: number; body?: number; pan?: number; to?: AudioNode } = {}): void {
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  const body = o.body ?? 1;
  const f0 = (o.f0 ?? CREAK * 0.92) * v.r(0.98, 1.02);
  const f1 = (o.f1 ?? CREAK * 1.08) * v.r(0.98, 1.02);
  // the trunk's body: two resonant bands
  const res = v.amp(1, { to: out });
  const bA = v.filt('bandpass', 540 * body, 5, { to: res });
  const bB = v.filt('bandpass', 900 * body, 6, { to: res });
  const bC = v.filt('lowpass', 420 * body, 1.2, { to: res });
  // the stick-slip pulse train: irregular gaps around the creak's period × a slow grouping
  const rate = o.rate ?? 34;
  const times: number[] = [];
  const gains: number[] = [];
  let x = 0;
  while (x < d) {
    const k = x / d;
    times.push(x);
    gains.push(g * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, k * 1.2))) * v.r(0.55, 1));
    x += (1 / rate) * v.r(0.6, 1.5) * (1 - 0.3 * Math.sin(k * 9.0));
  }
  v.bursts(times, gains, { t, dec: 0.018, f: 700 * body, q: 2.2, kind: 'brown', drive: 2, trim: 0.7, to: bA });
  // the tonal groan under the pulses (sawtooth, amplitude chopped by a flutter = the stick-slip)
  const fl = v.flutter(rate, 0.8, { t, d: d + 0.03, base: 0.25, to: bB });
  fl.connect(bC);
  const env: [number, number, ('e' | 'l')?][] = [[0, 0], [Math.min(0.05, d * 0.2), g * 0.9], [d * 0.8, g * 0.7], [d, 0.0001, 'e']];
  const s = v.tone('sawtooth', [[0, f0], [d, f1, 'e']], { t, g: env, to: fl });
  v.wander(s.osc.detune, 7, 35, { t, d });
}

/**
 * The hollow knot "tok": a band-passed click, two decaying sines on the slit-drum ratio, and a low air-cavity
 * "oom" (the hollow behind the knot). `f` in 300–600 Hz.
 */
function tok(v: Voice, t: number, f: number, g: number, o: { dec?: number; cavity?: number; pan?: number; to?: AudioNode } = {}): void {
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  const dec = o.dec ?? 0.18;
  v.noise('white', { t, g: perc(g * 1.4, 0.006, 0.0002), to: v.filt('bandpass', f * 3.2, 2.5, { to: out }) });
  v.tone('sine', [[0, f * 1.04], [0.03, f, 'e']], { t, g: perc(g, dec, 0.0008), to: out });
  v.tone('sine', f * SLIT, { t, g: perc(g * 0.45, dec * 0.55, 0.0008), to: out });
  v.tone('triangle', f * 2.71, { t, g: perc(g * 0.12, dec * 0.25, 0.0005), to: out });
  // the cavity: a low sine an octave and a fifth down, swelling a hair after the strike
  v.tone('sine', [[0, f / 3], [dec * 1.5, (f / 3) * 0.94, 'e']], { t: t + 0.004, g: perc(g * (o.cavity ?? 0.7), dec * 1.6, 0.01), to: out });
}

/** Root fibres rustling (wrap, grip, unravel): a fluttering pink band moving c0 → c1 over `d`. */
function rustle(v: Voice, t: number, d: number, g: number, o: { c0?: number; c1?: number; rate?: number; pan?: readonly [number, number]; to?: AudioNode } = {}): void {
  const out = o.pan ? v.panner([[0, o.pan[0]], [d, o.pan[1]]], { t, to: o.to }) : o.to;
  const fl = v.flutter(o.rate ?? 24, 0.7, { t, d: d + 0.03, base: 0.35, to: v.filt('bandpass', [[0, o.c0 ?? 1300], [d, o.c1 ?? 2400, 'e']], 1.6, { t, to: out }) });
  v.noise('pink', { t, g: [[0, 0], [d * 0.25, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']], to: fl });
}

/** Short fibre snaps (tiny cracks, 3–6 kHz) spread over `d`. */
function snaps(v: Voice, t: number, d: number, n: number, g: number, to?: AudioNode): void {
  v.crackle({ t, d, n, g, f: 4200, q: 1.4, dec: 0.006, curve: 1.2, to });
}

/** Leaves shaken loose: a short high rustle. */
function leaves(v: Voice, t: number, g: number, d = 0.35): void {
  const fl = v.flutter(40, 0.75, { t, d: d + 0.02, base: 0.3, to: v.filt('bandpass', [[0, 3200], [d, 2200, 'e']], 1.2, { t }) });
  v.noise('white', { t, g: [[0, 0], [0.02, g], [d, 0.0001, 'e']], to: fl });
}

/** The seed's voice: a sine arcing up f0 → f1 (and settling a little lower), soft vibrato and a breath of air. */
function seedArc(v: Voice, t: number, d: number, f0: number, f1: number, g: number, o: { pan?: readonly [number, number] } = {}): void {
  const out = o.pan ? v.panner([[0, o.pan[0]], [d, o.pan[1]]], { t }) : undefined;
  for (const [det, gg] of [
    [0, 1],
    [9, 0.45],
  ] as const) {
    const s = v.tone('sine', [[0, f0], [d * 0.7, f1, 'e'], [d, f1 * 0.94, 'e']], { t, g: [[0, 0], [d * 0.2, g * gg], [d * 0.75, g * gg * 0.85], [d, 0.0001, 'e']], detune: det, to: out });
    v.lfo(s.osc.detune, 6, [[0, 4], [d, 22]], { t, d: d + 0.02 });
  }
  v.noise('pink', { t, g: [[0, 0], [d * 0.4, g * 0.9], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f0 * 1.5], [d * 0.7, f1 * 1.6, 'e']], 3, { t, to: out }) });
}

// ================================================================ recipes

export const HOLLOW_OGRE_RECIPES = {
  /** Summon (sustained, faded at the stake): the log falls from above — air roaring past it, pitch dropping, a turn creak. */
  hoLogFall: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      const D = 0.75;
      // air around a big falling body: a low band whose centre DROPS (doppler) while it swells
      sweep(v, 0, D, [1400, 900, 420], 0.5, { q: 1.1, kind: 'pink', peakAt: 0.85 });
      sweep(v, 0.05, D - 0.05, [2600, 1800, 900], 0.16, { q: 1.6, kind: 'white', peakAt: 0.9 });
      // a whistle through the open log top (a hollow tube): a breathy tone falling 620 → 340 Hz
      v.noise('pink', { g: [[0, 0], [D * 0.6, 0.12], [D, 0.16]], to: v.filt('bandpass', [[0, 620], [D, 340, 'e']], 9) });
      v.tone('sine', [[0, 610], [D, 330, 'e']], { g: [[0, 0], [D * 0.5, 0.025], [D, 0.04]] });
      // the log turns once in the air: a creak
      creak(v, 0.12, 0.3, 0.16, { f0: 190, f1: 160, rate: 30 });
    },
  },
  /** Summon 'land': the log stakes into the tile — a huge driven thump, the hollow booms, splinters, loam. */
  hoStake: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.7,
    play(v) {
      thump(v, 0, 120, 34, 0.9, 0.5, { drive: 2.8 });
      thump(v, 0.004, 260, 90, 0.35, 0.12, { drive: 1.6 });
      // the hollow booms: the whole log rings as a tube (low knot modes)
      tok(v, 0.002, midiHz(51), 0.32, { dec: 0.55, cavity: 1 });
      tok(v, 0.01, midiHz(58), 0.14, { dec: 0.35, cavity: 0.4 });
      crack(v, 0, 0.55, { hp: 1500, lp: 7000, n: 3, gap: 0.012, dec: 0.014 });
      puff(v, 0.006, 0.5, 0.55, 900, { kind: 'brown' });
      // splinters and loam raining back down
      v.crackle({ t: 0.05, d: 0.5, n: 22, g: 0.16, f: 2800, q: 1.1, curve: 1.6, dec: 0.008 });
      creak(v, 0.08, 0.28, 0.12, { f0: 175, f1: 150, rate: 40 });
    },
  },
  /** Summon f3: the bark splits open from inside like a door — a tearing creak, a wood crack, two hinges swinging. */
  hoBarkSplit: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      // the tear: a creak rising fast and snapping
      creak(v, 0, 0.22, 0.28, { f0: 160, f1: 240, rate: 55, body: 1.2 });
      snaps(v, 0.02, 0.2, 12, 0.18);
      crack(v, 0.2, 0.6, { hp: 1200, lp: 8000, n: 4, gap: 0.01, dec: 0.016 });
      thump(v, 0.2, 180, 70, 0.38, 0.16, { drive: 1.6 });
      // the two bark doors swing open on their hinges (left, right)
      creak(v, 0.24, 0.26, 0.14, { f0: 200, f1: 150, rate: 26, pan: -0.35 });
      creak(v, 0.3, 0.24, 0.12, { f0: 215, f1: 165, rate: 28, pan: 0.35 });
      tok(v, 0.21, midiHz(66), 0.14, { dec: 0.2 });
      leaves(v, 0.22, 0.1, 0.4);
    },
  },
  /** A heavy root foot comes down and the roots grip the floor (summon step / strike path). */
  hoStep: {
    cap: 3,
    gap: 0.06,
    verb: 0.25,
    duck: 0.3,
    vary: 0.04,
    play(v) {
      thump(v, 0, 95, 38, 0.6, 0.3, { drive: 2 });
      puff(v, 0.003, 0.28, 0.3, 700, { kind: 'brown' });
      // the roots grip: a short dry rustle and fibre ticks into the floor
      rustle(v, 0.02, 0.16, 0.16, { c0: 1100, c1: 1700, rate: 30 });
      snaps(v, 0.03, 0.12, 6, 0.1);
      creak(v, 0.0, 0.12, 0.08, { f0: 175, f1: 165, rate: 45 });
    },
  },
  /** The club pounds the ground and the trunk groans after it (a deep, long creak with a hollow "oom") — summon SLAM / roar. */
  hoClubSlam: {
    cap: 1,
    gap: 0.25,
    verb: 0.5,
    duck: 0.7,
    play(v) {
      // the slam
      thump(v, 0, 110, 32, 0.85, 0.48, { drive: 2.6 });
      tok(v, 0, midiHz(54), 0.3, { dec: 0.45, cavity: 0.9 });
      crack(v, 0, 0.45, { hp: 1600, lp: 7000, n: 3, gap: 0.011, dec: 0.012 });
      puff(v, 0.005, 0.42, 0.5, 900, { kind: 'brown' });
      leaves(v, 0.02, 0.14, 0.5);
      v.crackle({ t: 0.04, d: 0.4, n: 14, g: 0.12, f: 2600, q: 1.1, curve: 1.5, dec: 0.008 });
      // the groan: the creak an octave down, slow, the body bands lower — the log's "voice" rising out of the slam
      creak(v, 0.06, 0.62, 0.3, { f0: 84, f1: 98, rate: 22, body: 0.7 });
      creak(v, 0.12, 0.5, 0.18, { f0: 168, f1: 186, rate: 31 });
      v.noise('pink', { t: 0.1, g: [[0, 0], [0.12, 0.08], [0.6, 0.0001, 'e']], to: v.filt('bandpass', [[0, 180], [0.6, 260, 'e']], 6, { t: 0.1 }) });
    },
  },
  /** Strike charge (sustained): the roots tighten round the club and heave it up — creaks climbing, fibres rustling. */
  hoCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.6;
      const H = D + 0.45;
      creak(v, 0, 0.36, 0.2, { f0: 165, f1: 195, rate: 30 });
      creak(v, 0.3, 0.5, 0.24, { f0: 190, f1: 225, rate: 38, body: 1.1 });
      creak(v, 0.75, 0.32, 0.12, { f0: 220, f1: 230, rate: 44, body: 1.15 });
      rustle(v, 0.02, H, 0.14, { c0: 1200, c1: 2200, rate: 26 });
      snaps(v, 0.1, H - 0.1, 9, 0.08);
      // the strain: a low swelling hum of the hollow
      v.tone('sine', [[0, 62], [D, 74, 'e']], { g: [[0, 0], [D, 0.16], [H, 0.12], [H + 0.12, 0.0001, 'e']] });
    },
  },
  /** Strike f4: the club comes over the shoulder — a low, wide wooden whoosh. */
  hoSwing: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    vary: 0.03,
    play(v) {
      sweep(v, 0, 0.16, [220, 900, 300], 1.6, { q: 1.2, kind: 'pink', pan: [-0.35, 0.3], peakAt: 0.5 });
      sweep(v, 0.02, 0.12, [600, 1600, 700], 0.35, { q: 1.6, kind: 'white', peakAt: 0.5 });
      creak(v, 0, 0.1, 0.08, { f0: 200, f1: 230, rate: 50 });
    },
  },
  /** Strike 'release': the smash comes down — the whoosh peaks lower and heavier, the trunk creaks forward. */
  hoRelease: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      sweep(v, 0, 0.12, [800, 420, 160], 2.2, { q: 1.1, kind: 'pink', pan: [0.1, 0.35], peakAt: 0.55 });
      sweep(v, 0, 0.1, [2200, 1200, 500], 0.4, { q: 1.4, kind: 'white', peakAt: 0.5 });
      creak(v, 0, 0.14, 0.16, { f0: 230, f1: 150, rate: 48 });
    },
  },
  /** Strike 'contact': "Kütük Ezmesi" — the club smashes the floor: driven thump, the club's tok, splinters, leaves, loam. */
  hoImpact: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.65,
    play(v) {
      thump(v, 0, 135, 34, 0.85, 0.45, { drive: 3 });
      thump(v, 0.002, 300, 110, 0.3, 0.08, { drive: 2 });
      // the club itself rings: a knotted log, hollow, an octave under the knots
      tok(v, 0, midiHz(56), 0.36, { dec: 0.32, cavity: 0.8 });
      tok(v, 0.004, midiHz(63), 0.16, { dec: 0.2, cavity: 0.2 });
      crack(v, 0, 0.7, { hp: 1400, lp: 8000, n: 4, gap: 0.009, dec: 0.014 });
      puff(v, 0.004, 0.45, 0.45, 1000, { kind: 'brown' });
      leaves(v, 0.03, 0.16, 0.45);
      v.crackle({ t: 0.03, d: 0.45, n: 20, g: 0.14, f: 3000, q: 1.1, curve: 1.6, dec: 0.007 });
    },
  },
  /** Strike contact when boosted: the sprouts burst into violet pollen — soft knot chimes rising, a breath of air. */
  hoPollen: {
    cap: 2,
    gap: 0.1,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      v.noise('pink', { g: [[0, 0], [0.02, 0.22], [0.5, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1800], [0.5, 4200, 'e']], 1.4) });
      const notes = [70, 73, 75, 78, 80, 82];
      for (let i = 0; i < 9; i++) {
        const m = notes[Math.floor(v.rnd() * notes.length) % notes.length];
        const f = midiHz(m) * v.r(0.997, 1.003);
        const t = 0.02 + Math.pow(i / 9, 1.3) * 0.5;
        const pan = v.panner(v.r(-0.6, 0.6));
        v.tone('sine', f, { t, g: perc(0.05 * (1 - i / 14), 0.35, 0.002), to: pan });
        v.tone('sine', f * SLIT, { t, g: perc(0.018, 0.18, 0.002), to: pan });
      }
      v.tone('sine', [[0, midiHz(54)], [0.4, midiHz(58), 'e']], { g: perc(0.08, 0.5, 0.02) });
    },
  },
  /** Strike f9: the club is thrown onto the shoulder — wood knocking on wood, a short creak. */
  hoShoulder: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    play(v) {
      sweep(v, 0, 0.1, [300, 900, 400], 0.5, { q: 1.3, kind: 'pink', peakAt: 0.7 });
      tok(v, 0.09, midiHz(61), 0.22, { dec: 0.16, cavity: 0.5 });
      thump(v, 0.09, 150, 70, 0.22, 0.1);
      creak(v, 0.1, 0.18, 0.1, { f0: 175, f1: 185, rate: 36 });
      leaves(v, 0.1, 0.05, 0.25);
    },
  },
  /** Effect: the club reaches toward the graveyard — the roots creak, a low violet hum stirs over the pile. */
  hoReach: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      creak(v, 0, 0.4, 0.2, { f0: 170, f1: 200, rate: 28 });
      rustle(v, 0.08, 0.4, 0.12, { c0: 1000, c1: 2200, rate: 22, pan: [-0.2, 0.3] });
      // the graveyard stirs: a hollow hum on F#2 / C#3 swelling (the hollow wants)
      for (const [m, gg] of [
        [42, 0.12],
        [49, 0.07],
        [54, 0.04],
      ] as const) {
        const s = v.tone('triangle', midiHz(m), { t: 0.1, g: [[0, 0], [0.35, gg], [0.7, gg * 0.7], [0.95, 0.0001, 'e']], to: v.filt('lowpass', 600, 1) });
        v.lfo(s.osc.detune, 4.5, 8, { t: 0.1, d: 0.9 });
      }
      v.noise('pink', { t: 0.15, g: [[0, 0], [0.4, 0.05], [0.8, 0.0001, 'e']], to: v.filt('bandpass', [[0, 600], [0.8, 1400, 'e']], 3) });
    },
  },
  /** Effect (per seed): a graveyard monster shrinks into a violet light seed — a hollow inhale closing to a point. */
  hoShrink: {
    cap: 4,
    gap: 0.01,
    verb: 0.5,
    duck: 0.25,
    play(v) {
      const D = 0.32;
      // the inhale: a band closing in from wide and low to a narrow high point
      v.noise('pink', { g: [[0, 0.0001], [D * 0.8, 0.22, 'e'], [D, 0.0001, 'e']], to: v.filt('bandpass', [[0, 500], [D, 2600, 'e']], [[0, 1], [D, 6]]) });
      v.tone('sine', [[0, 220], [D, 880, 'e']], { g: [[0, 0], [D * 0.85, 0.06], [D, 0.0001, 'e']] });
      // the seed forms: one small glassy-wood "tik" on the arrival
      tok(v, D, midiHz(80), 0.06, { dec: 0.09, cavity: 0 });
    },
  },
  /** Effect (per seed): the seed's arc through the air — the rising round sine "fiuuu". */
  hoSeed: {
    cap: 4,
    gap: 0.01,
    verb: 0.55,
    play(v) {
      seedArc(v, 0, 0.42, 720, 1320, 0.08, { pan: [0.35, -0.1] });
    },
  },
  /** Effect (per seed): the seed lands on the root tip and the tendril wraps it — a soft high tok, a dry rustle. */
  hoCatch: {
    cap: 6,
    gap: 0.008,
    verb: 0.35,
    play(v) {
      tok(v, 0, midiHz(75), 0.12, { dec: 0.1, cavity: 0.15 });
      rustle(v, 0.02, 0.22, 0.14, { c0: 1600, c1: 2600, rate: 34 });
      snaps(v, 0.03, 0.16, 5, 0.06);
      creak(v, 0.05, 0.18, 0.08, { f0: 210, f1: 180, rate: 40 });
    },
  },
  /** Effect (per seed): planted in the hollow — the knot "tok" (A#4; `pitch` moves the 2nd one) and its warm glow. */
  hoKnot: {
    cap: 6,
    gap: 0.008,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      tok(v, 0, midiHz(70), 0.42, { dec: 0.4, cavity: 1 });
      tok(v, 0.002, midiHz(58), 0.16, { dec: 0.5, cavity: 0.6 });
      // the knot light catches: a soft swelling hum and ember ticks
      v.tone('sine', [[0, midiHz(70)], [0.6, midiHz(70) * 1.003]], { t: 0.03, g: [[0, 0], [0.08, 0.04], [0.6, 0.0001, 'e']] });
      v.tone('triangle', midiHz(82), { t: 0.04, g: perc(0.018, 0.5, 0.03) });
      v.crackle({ t: 0.03, d: 0.35, n: 8, g: 0.06, f: 3600, q: 1.3, dec: 0.005 });
    },
  },
  /** Effect (per seed): a new sprout springs on the club (+400) — a quick rising pluck and a leaf unfolding. */
  hoSprout: {
    cap: 6,
    gap: 0.008,
    verb: 0.4,
    play(v) {
      v.tone('triangle', [[0, midiHz(73)], [0.07, midiHz(85), 'e']], { g: perc(0.08, 0.16, 0.002) });
      v.tone('sine', [[0, midiHz(85)], [0.09, midiHz(90), 'e']], { t: 0.015, g: perc(0.04, 0.2, 0.002) });
      rustle(v, 0.02, 0.14, 0.08, { c0: 2200, c1: 3200, rate: 40 });
    },
  },
  /** Effect end: the hollow glows with its knot lights — a warm hollow chord (F# major, low) and embers. */
  hoGlow: {
    cap: 1,
    gap: 0.2,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      const D = 0.8;
      for (const [m, gg, det] of [
        [54, 0.07, 0],
        [61, 0.05, 4],
        [66, 0.035, -5],
        [70, 0.025, 3],
      ] as const) {
        const s = v.tone('triangle', midiHz(m), { g: [[0, 0], [0.1, gg], [D * 0.6, gg * 0.7], [D, 0.0001, 'e']], detune: det, to: v.filt('lowpass', 1400, 0.9) });
        v.lfo(s.osc.detune, 5, 6, { d: D });
      }
      tok(v, 0, midiHz(66), 0.12, { dec: 0.3, cavity: 0.8 });
      v.crackle({ t: 0.05, d: D - 0.2, n: 12, g: 0.05, f: 3400, q: 1.2, dec: 0.005 });
    },
  },
  /** Death f1: the root arms unravel — a run of fibre snaps, a strained creak sliding down. */
  hoUnravel: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      creak(v, 0, 0.45, 0.24, { f0: 210, f1: 140, rate: 36 });
      snaps(v, 0.02, 0.42, 22, 0.16);
      rustle(v, 0, 0.45, 0.16, { c0: 2400, c1: 1100, rate: 28 });
      // the club drops: a knock on the floor
      tok(v, 0.12, midiHz(56), 0.2, { dec: 0.22, cavity: 0.6 });
      thump(v, 0.12, 140, 60, 0.3, 0.16, { drive: 1.4 });
    },
  },
  /** Death 'dissolve' (sustained): the roots snake back into the tile — loam rustle sliding down, a slow creak. */
  hoRootsRetract: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 0.7;
      const fl = v.flutter(18, 0.6, { d: D + 0.05, base: 0.4, to: v.filt('bandpass', [[0, 1600], [D, 380, 'e']], 1.4) });
      v.noise('brown', { g: [[0, 0], [0.08, 0.5], [D * 0.7, 0.35], [D, 0.0001, 'e']], to: fl });
      rustle(v, 0, D, 0.12, { c0: 2000, c1: 700, rate: 20, pan: [0.3, -0.3] });
      creak(v, 0.05, 0.5, 0.12, { f0: 150, f1: 110, rate: 24, body: 0.8 });
      v.crackle({ t: 0.05, d: D - 0.1, n: 14, g: 0.08, f: 1800, q: 1, kind: 'brown', dec: 0.012 });
    },
  },
  /** Death f5: the trunk caves in — a hollow crumple, a low boom, a crack of old wood. */
  hoCollapse: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.45,
    play(v) {
      tok(v, 0, midiHz(46), 0.3, { dec: 0.5, cavity: 1 });
      thump(v, 0, 100, 36, 0.5, 0.42, { drive: 1.8 });
      crack(v, 0.01, 0.35, { hp: 900, lp: 5000, n: 4, gap: 0.03, dec: 0.02 });
      puff(v, 0.02, 0.4, 0.5, 700, { kind: 'brown' });
      v.crackle({ t: 0.04, d: 0.35, n: 12, g: 0.1, f: 2000, q: 1.1, curve: 1.5, dec: 0.01 });
    },
  },
  /** Death 'burst': the last sprout wilts — one leaf rustle, a faint knot tone falling (D#5 → A#4), a breath. */
  hoWilt: {
    cap: 1,
    gap: 0.2,
    verb: 0.65,
    duck: 0.2,
    play(v) {
      leaves(v, 0, 0.06, 0.3);
      v.tone('sine', [[0, midiHz(75)], [0.7, midiHz(70), 'e']], { t: 0.03, g: [[0, 0], [0.05, 0.05], [0.7, 0.0001, 'e']] });
      v.tone('sine', [[0, midiHz(75) * SLIT], [0.4, midiHz(70) * SLIT, 'e']], { t: 0.03, g: perc(0.012, 0.35, 0.02) });
      v.noise('pink', { t: 0.1, g: [[0, 0], [0.15, 0.04], [0.6, 0.0001, 'e']], to: v.filt('bandpass', 900, 2) });
    },
  },
  /** Revive (sustained, faded at land): the roots braid back up out of the tile — rustle rising, creaks climbing. */
  hoReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      const D = 0.55;
      const H = D + 0.3;
      rustle(v, 0, H, 0.16, { c0: 700, c1: 2400, rate: 22 });
      creak(v, 0.05, 0.35, 0.14, { f0: 120, f1: 160, rate: 26, body: 0.85 });
      creak(v, 0.4, 0.4, 0.16, { f0: 160, f1: 200, rate: 34 });
      snaps(v, 0.05, H - 0.1, 10, 0.07);
      v.tone('sine', [[0, 55], [H, 74, 'e']], { g: [[0, 0], [D, 0.14], [H, 0.1], [H + 0.1, 0.0001, 'e']] });
    },
  },
  /** Revive 'land': whole again — the root feet thud, the hollow tok, the eyes ignite (a soft rising pair). */
  hoReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      thump(v, 0, 110, 38, 0.6, 0.34, { drive: 2 });
      tok(v, 0.005, midiHz(58), 0.24, { dec: 0.3, cavity: 0.9 });
      puff(v, 0.006, 0.3, 0.35, 800, { kind: 'brown' });
      v.tone('sine', [[0, midiHz(KNOTS[2])], [0.15, midiHz(KNOTS[4]), 'e']], { t: 0.08, g: perc(0.05, 0.35, 0.01) });
      creak(v, 0.06, 0.2, 0.1, { f0: 175, f1: 190, rate: 34 });
    },
  },
} satisfies Record<string, Recipe>;

export type HollowOgreSfxName = keyof typeof HOLLOW_OGRE_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry). */
export const HOLLOW_OGRE_VOICE: CharacterSounds | null = {
  roar: 'hoClubSlam',
  arrive: 'hoLogFall',
  land: 'hoStake',
  charge: 'hoCharge',
  swing: 'hoSwing',
  release: 'hoRelease',
  impact: 'hoImpact',
  deathStart: 'hoUnravel',
  dissolve: 'hoRootsRetract',
  afterDissolve: [[1, 'hoCollapse', 0.85]],
  burst: 'hoWilt',
  reviveGather: 'hoReviveGather',
  reviveLand: 'hoReviveLand',
};
