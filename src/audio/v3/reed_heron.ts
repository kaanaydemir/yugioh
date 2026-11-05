// Sazlık Balıkçılı (reed_heron) sounds — the quietest card in the game (docs/v3/oturum-c-tasarim.md §2.2 SOUND,
// YENI_KARTLAR §5.1 row C8: 2.4 kHz beak "tak" · reed + mist · a double wing "fuff" over a frog-chorus bed).
//
// Identity, by layer:
//   - the night marsh: three frogs (sines 380 / 460 / 520 Hz gated by 24–30 Hz pulses, 3–5 pulses a croak, panned
//     −0.7 / 0 / +0.7, low-passed at 1.4 kHz for distance) and a reed rustle (pink noise, band 2.8 kHz, wandering);
//   - mist: slow pink "fşş" swells, never a thump; two panners converging when it rolls in;
//   - the wings: ALWAYS a pair of soft fuffs (high-passed at 250 Hz, no low end: R3 owns the single "pof");
//   - the beak: a dry 2.4 kHz "tak" (a Q 9 noise click + a sine at the same pitch + a short 900 Hz wood body),
//     the triple at 2.40 / 2.54 / 2.14 kHz (up, then down), only the third rings like a blade;
//   - the water: never a splash — only slips under the feet and the single ripple-ring glide (520 → 390 Hz).
// Silence is an instrument: the frog bed is stopped dead at the eye glint, the charge is stopped at the start of the
// 200 ms freeze (the cinematics do it; these recipes only make sure both cuts can be clean).
// Banned (oturum-c-tasarim §0.2): no v1 shared recipe, no glassBell / glassRain / glassReverse, no single pof,
// no tritone drone, no link pings, no pentatonic runs.

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { Voice, perc } from '../synth';
import { sweep } from './kit';

// ---------------------------------------------------------------- building blocks

/** One frog croak: a sine gated by a 24–30 Hz square (3–5 pulses), a little nasal reed partial, distant (lp 1.4 kHz). */
function croak(v: Voice, t: number, f: number, g: number, pan: number, pulses: number, rate: number): void {
  const d = pulses / rate;
  const out = v.panner(pan);
  const lp = v.filt('lowpass', 1400, 0.7, { to: out });
  const gate = v.ring(rate, { t, d: d + 0.02, w: 'triangle', mix: 0.5, to: lp });
  const env: [number, number, ('e' | 'l')?][] = [[0, 0], [0.012, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']];
  v.tone('sine', [[0, f * 1.04], [d, f * 0.97, 'e']], { t, g: env, to: gate });
  v.tone('triangle', [[0, f * 2.08], [d, f * 1.94, 'e']], { t, g: env.map(([x, y, c]) => [x, y * 0.22, c] as [number, number, ('e' | 'l')?]), to: gate });
}

/** A soft wing "fuff": pink noise high-passed at 250 Hz, a closing low-pass, a 48 Hz feather flutter on 1.4 kHz. */
function fuff(v: Voice, t: number, g: number, o: { lp?: readonly [number, number]; dec?: number; pan?: number } = {}): void {
  const dec = o.dec ?? 0.07;
  const out = o.pan !== undefined ? v.panner(o.pan) : undefined;
  const hp = v.filt('highpass', 250, 0.7, { to: out });
  // (a sharp closing sweep, resonant at the top: the feathers' "f" opens bright and shuts — apart from the mist bed)
  const lp = v.filt('lowpass', [[0, o.lp?.[0] ?? 1800], [dec * 0.6, o.lp?.[1] ?? 900, 'e']], 2.2, { t, to: hp });
  v.noise('pink', { t, g: [[0, 0], [dec * 0.18, g], [dec, 0.0001, 'e']], to: lp });
  const fl = v.flutter(48, 0.45, { t, d: dec + 0.06, base: 0.5, to: v.filt('bandpass', 1400, 1.1, { to: out }) });
  v.noise('pink', { t, g: perc(g * 0.55, dec + 0.05, 0.01), to: fl });
  // the feather edges: a short airy hiss at 3.2 kHz riding the opening of the sweep (the mist never has it)
  v.noise('white', { t, g: perc(g * 0.22, dec * 0.6, 0.004), to: v.filt('bandpass', 3200, 1.4, { to: out }) });
}

/** A low slosh of still water (pink, high-passed at 150 Hz — no sub thump, never a "pof" — low-passed at `lp`). */
function slosh(v: Voice, t: number, g: number, dec: number, lp = 600): void {
  const hp = v.filt('highpass', 150, 0.7);
  v.noise('pink', { t, g: perc(g, dec, 0.004), to: v.filt('lowpass', [[0, lp], [dec, lp * 0.45, 'e']], 0.8, { t, to: hp }) });
}

/** The reed rustle: pink noise in a 2.8 kHz band (Q 1), a slow wander on the band, swelling with the sway. */
function rustle(v: Voice, t: number, d: number, g: number, pan = 0): void {
  const out = v.panner(pan);
  const bp = v.filt('bandpass', 2800, 1, { t, to: out });
  v.wander(bp.frequency, 3, 700, { t, d });
  v.noise('pink', { t, g: [[0, 0], [d * 0.4, g], [d * 0.6, g * 0.7], [d, 0.0001, 'e']], to: bp });
}

/** A water slip under a foot: a band of noise sliding 1.1 kHz → 700 Hz, short. */
function slip(v: Voice, t: number, g: number, dec = 0.12): void {
  const bp = v.filt('bandpass', [[0, 1100], [dec, 700, 'e']], 2.2, { t });
  v.noise('white', { t, g: perc(g, dec, 0.006), to: bp });
  v.tone('sine', [[0, 760], [dec, 520, 'e']], { t, g: perc(g * 0.18, dec * 0.8, 0.004) });
}

/**
 * The beak "tak": a 2.5 ms band of noise at 5 kHz first (the blade's edge meeting the target), then the dry Q 9
 * click at `f` with a sine at the same pitch (`ring` s decay: 28 ms, the third 45 ms) and the WOOD BODY — a 35 ms
 * 900 Hz noise knock under a falling 940 → 780 Hz triangle, the part that makes it a "tak" and not a tick.
 */
function tak(v: Voice, t: number, f: number, g: number, ring = 0.028): void {
  v.noise('white', { t, g: perc(g * 1.3, 0.0025, 0.0001), to: v.filt('bandpass', 5000, 3) });
  v.noise('white', { t: t + 0.001, g: perc(g * 1.9, 0.006, 0.0002), to: v.filt('bandpass', f, 9) });
  v.tone('sine', f, { t: t + 0.001, g: perc(g * 0.6, ring, 0.0004) });
  v.tone('sine', f * 1.5, { t: t + 0.001, g: perc(g * 0.08, 0.012, 0.0004) });
  v.noise('white', { t, g: perc(g * 1.75, 0.035, 0.0005), to: v.filt('bandpass', 900, 2.4) });
  v.tone('triangle', [[0, 940], [0.03, 780, 'e']], { t, g: perc(g * 0.45, 0.035, 0.0005) });
}

/** A cloth fold: the straw cloak and the plumage closing over each other — a low pink rustle, band 700 Hz, short. */
function fold(v: Voice, t: number, g: number, d: number, pan = 0): void {
  const out = v.panner(pan);
  const bp = v.filt('bandpass', [[0, 900], [d, 520, 'e']], 1.6, { t, to: out });
  v.noise('pink', { t, g: [[0, 0], [d * 0.25, g], [d * 0.55, g * 0.45], [d, 0.0001, 'e']], to: bp });
  v.crackle({ t, d: d * 0.8, n: 5, g: g * 0.6, f: 1800, q: 1.2, dec: 0.008, kind: 'pink' });
}

/** A droplet plip: a sine flicked up an octave in 15 ms (the drop), a ripple sine falling under it. */
function plip(v: Voice, t: number, g: number, f = 1200): void {
  v.tone('sine', [[0, f], [0.015, f * 2, 'e'], [0.03, f * 1.6, 'e']], { t, g: perc(g, 0.035, 0.001) });
  v.tone('sine', [[0, 600], [0.08, 420, 'e']], { t: t + 0.012, g: perc(g * 0.45, 0.08, 0.004) });
}

/** A mist swell: pink noise through a slowly gliding band, its envelope given. */
function mist(v: Voice, t: number, f: readonly [number, number], env: readonly [number, number, ('e' | 'l')?][], pan?: readonly [number, number]): void {
  const d = env[env.length - 1][0];
  const out = pan ? v.panner([[0, pan[0]], [d, pan[1]]], { t }) : undefined;
  const bp = v.filt('bandpass', [[0, f[0]], [d, f[1], 'e']], 3, { t, to: out });
  v.noise('pink', { t, g: env, to: bp });
}

/**
 * Run a recipe body at a make-up gain (dB) on its own sub-voice: the layers are written at their relative
 * levels (the spec's table), the level matches the loudness of the other v3 sets (the heron stays the
 * quietest: about 6 dB under them, every peak ≤ −3 dBFS through the chain; shots/kartc/reed_heron/sfx-probe.txt).
 */
function level(v: Voice, db: number, fn: (w: Voice) => void, o: { sat?: number; ceil?: number } = {}): void {
  const g = v.ctx.createGain();
  g.gain.value = Math.pow(10, db / 20);
  // sat: a soft tanh saturation after the make-up gain (the TAK's body comes up without its click going over the
  // ceiling: `ceil` is the hard output bound of the shaper, linear)
  if (o.sat) g.connect(v.drive(o.sat, { trim: o.ceil ?? 0.8 }));
  else g.connect(v.out);
  const w = new Voice(v.ctx, g, v.t0, v.pm, v.rnd);
  fn(w);
  v.end = Math.max(v.end, w.end);
  v.sources.push(...w.sources);
  if (w.stereo) v.stereo = true;
}

// ---------------------------------------------------------------- recipes

export const V3_HERON_RECIPES = {
  /** The marsh at night (the summon's bed, until the eye glint stops it dead): three distant frogs and the reeds. */
  heronFrogBed: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    play(v0) {
      level(v0, 10, (v) => {
        // (started on the card slam: five croaks across the three pans before the eye glint at ≈ 0.75 s, the
        // chorus a little louder as it goes — so the dead stop is a HOLE you hear)
        const frogs: [number, number][] = [[380, -0.7], [520, 0.7], [460, 0]];
        const starts = [0.03, 0.17, 0.3, 0.45, 0.58, 0.72, 0.88, 1.04, 1.22, 1.4];
        starts.forEach((t, i) => {
          const [f, pan] = frogs[(i + (i > 4 ? 1 : 0)) % 3];
          croak(v, t, f * v.r(0.985, 1.015), (0.05 + 0.01 * Math.min(1, t / 0.6)) * v.r(0.8, 1), pan, 3 + Math.floor(v.r(0, 3)), v.r(24, 30));
        });
        rustle(v, 0, 1.7, 0.018, 0.2);
      });
    },
  },
  /** The marsh goes on without him: two quiet croaks after the death ring (frogs back from the left and right). */
  heronFrogsReturn: {
    cap: 1,
    gap: 0.3,
    verb: 0.4,
    play(v0) {
      level(v0, 11, (v) => {
        croak(v, 0, 460, 0.045, -0.5, 4, 26);
        croak(v, 0.38, 520 * 0.99, 0.035, 0.6, 3, 28);
        rustle(v, 0, 0.7, 0.01, -0.2);
      });
    },
  },
  /** Mist rolls in from both sides: a pink "fşş" (band 900 → 600 Hz), two layers converging on the tile. */
  heronMistIn: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.25,
    play(v0) {
      level(v0, 20, (v) => {
        // rolls in over 160 ms, then thins ~8 dB in the 200 ms before the eye glint (≈ 0.39 s), where the cinematic
        // stops it dead with the frogs: the glint hangs in silence
        const env: [number, number, ('e' | 'l')?][] = [[0, 0.0001], [0.16, 0.08, 'e'], [0.2, 0.075], [0.36, 0.03, 'e'], [0.7, 0.025], [1.0, 0.0001, 'e']];
        // (low and wide: 620 → 420 Hz, the two banks converging from the far left and right)
        mist(v, 0, [620, 420], env, [-0.85, -0.2]);
        mist(v, 0.03, [680, 460], env, [0.85, 0.2]);
      });
    },
  },
  /** The mist parts (the bands slide 10 px apart): a rising pink swell, 250 ms, cut at the top. */
  heronMistPart: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play(v0) {
      level(v0, 20, (v) => {
        // (bright and opening: a band rising 900 → 2400 Hz, an airy 2.6 → 5 kHz sweep splitting left / right)
        mist(v, 0, [900, 2400], [[0, 0.0001], [0.15, 0.03, 'e'], [0.25, 0.09, 'e'], [0.275, 0.0001, 'e']]);
        sweep(v, 0.05, 0.22, [2600, 4800, 5200], 0.02, { kind: 'pink', q: 1.6, peakAt: 0.9, pan: [-0.4, 0.4] });
      });
    },
  },
  /** The wings open once (the roar of the summon / the reveal): fuff fuff — 90 ms apart, the second −4 dB. */
  heronWingFuff: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v0) {
      level(v0, 10, (v) => {
        fuff(v, 0, 0.32, { dec: 0.07 });
        fuff(v, 0.09, 0.2, { dec: 0.07, lp: [1600, 820] });
        rustle(v, 0.02, 0.32, 0.03);
      });
    },
  },
  /** The cloak settles, the reeds stand back up ('land'): a reed rustle and one soft lap on the still water. */
  heronSettle: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    play(v0) {
      level(v0, 22, (v) => {
        rustle(v, 0, 0.34, 0.035, 0.1);
        plip(v, 0.12, 0.02, 1000);
      });
    },
  },
  /** The bow tension of the neck coil (charge, sustained): a sine 300 → 700 Hz with a little breath, no creak. */
  heronCoil: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v0) {
      level(v0, 9, (v) => {
        // a held breath under the declaration (≈ −30 dB while the battle's lock-on rings), then — as the S snaps tight
        // and the lock-on has faded (≥ 0.28 s) — a steep crescendo that is still climbing when the freeze cuts it
        // (≈ 0.35 s): stop(20) leaves a hole after the loudest moment of the build-up, not a fade
        const g: [number, number, ('e' | 'l')?][] = [[0, 0], [0.1, 0.008], [0.26, 0.012], [0.31, 0.05, 'e'], [0.37, 0.15, 'e'], [0.6, 0.18], [1.1, 0.0001, 'e']];
        v.tone('sine', [[0, 300], [0.26, 420, 'e'], [0.4, 700, 'e'], [1.1, 760, 'e']], { g });
        v.tone('sine', [[0, 452], [0.26, 630, 'e'], [0.4, 1050, 'e'], [1.1, 1140, 'e']], { g: g.map(([x, y, c]) => [x, y * 0.25, c] as [number, number, ('e' | 'l')?]) });
        const bp = v.filt('bandpass', [[0, 1300], [0.4, 2600, 'e']], 1.3);
        v.noise('pink', { g: g.map(([x, y, c]) => [x, y * 0.35, c] as [number, number, ('e' | 'l')?]), to: bp });
      });
    },
  },
  /** One gliding stride: the water slips under the foot (no thud, no gravel). */
  heronSlip: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    vary: 0.04,
    play(v0) {
      level(v0, 17, (v) => {
        slip(v, 0, 0.16, 0.12);
      });
    },
  },
  /** The mist trail of the glide: a LOW breath of air over still water + the skim hiss (no mid: never a wing). */
  heronTrail: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v0) {
      // (the glide is AIR over still water: a long low breath 140 → 300 → 130 Hz that leans across the stereo field
      // with the bird, and a thin 6.5 kHz skim riding its crest — nothing between 400 Hz and 5 kHz, where the wing
      // fuffs, the slips and the beak live)
      level(v0, 22, (v) => {
        sweep(v, 0, 0.5, [140, 300, 130], 0.11, { kind: 'pink', q: 1.1, peakAt: 0.55, pan: [-0.25, 0.25] });
        v.noise('pink', { g: [[0, 0], [0.25, 0.05], [0.5, 0.0001, 'e']], to: v.filt('lowpass', 260, 0.8) });
        v.noise('white', { t: 0.1, g: [[0, 0], [0.2, 0.009], [0.4, 0.0001, 'e']], to: v.filt('bandpass', 6500, 1.8) });
      });
    },
  },
  /** The neck uncoils in one frame (release): a short white "fwip" 3 → 6 → 4 kHz. */
  heronFwip: {
    cap: 1,
    gap: 0.05,
    verb: 0.15,
    play(v0) {
      level(v0, 14.5, (v) => {
        sweep(v, 0, 0.05, [3000, 6000, 4000], 0.16, { kind: 'white', q: 2.4, peakAt: 0.5 });
      });
    },
  },
  /** Thrust 1 (top): tak at 2.40 kHz, two droplets. */
  heronTak1: {
    cap: 2,
    gap: 0.02,
    verb: 0.2,
    duck: 0.2,
    play(v0) {
      level(v0, 15, (v) => {
        tak(v, 0, 2400, 0.2);
        plip(v, 0.03, 0.012, 1500);
      }, { sat: 2.2, ceil: 0.62 });
    },
  },
  /** Thrust 2 (bottom): tak at 2.54 kHz (the pitch goes up). */
  heronTak2: {
    cap: 2,
    gap: 0.02,
    verb: 0.2,
    duck: 0.2,
    play(v0) {
      level(v0, 15, (v) => {
        tak(v, 0, 2540, 0.2);
        plip(v, 0.028, 0.012, 1350);
      }, { sat: 2.2, ceil: 0.62 });
    },
  },
  /** Thrust 3 (centre, the contact): TAK at 2.14 kHz +3 dB, then the blade ring (FM 2140 / 3.53) and two plips. */
  heronTak3: {
    cap: 2,
    gap: 0.02,
    verb: 0.3,
    duck: 0.45,
    play(v0) {
      // (the loudest heron-owned event of the attack: soft-saturated so its loudest 50 ms comes up to ≈ −11 dB
      // while the click stays under the −1 dBTP ceiling; ~4 dB under the aces' contacts — sparse, not inaudible)
      // (the body held a little longer — a second 1.1 kHz wood knock under the click — and driven harder into the soft
      // shaper: the first 33 ms are the loudest window of the whole strike, the shared LP tick included)
      level(v0, 17.5, (v) => {
        tak(v, 0, 2140, 0.28, 0.045);
        v.noise('white', { t: 0.002, g: perc(0.3, 0.05, 0.0008), to: v.filt('bandpass', 1100, 2.2) });
        v.bell(2140, { t: 0.004, g: 0.028, dec: 0.6, ratio: 3.53, index: 1.1 });
        v.bell(2140 * 2.01, { t: 0.004, g: 0.006, dec: 0.35, ratio: 3.53, index: 0.6 });
        plip(v, 0.05, 0.016, 1400);
        plip(v, 0.11, 0.011, 1150);
      }, { sat: 3.4, ceil: 0.76 });
    },
  },
  /** Blocked: the third thrust glances off the guard — a bright steel "TING" that bends up, a short scrape. */
  heronTing: {
    cap: 1,
    gap: 0.05,
    verb: 0.35,
    duck: 0.4,
    play(v0) {
      level(v0, 12, (v) => {
        tak(v, 0, 2140, 0.22);
        v.bell(3300, { t: 0.002, g: 0.05, dec: 0.75, ratio: 1.41, index: 1.6, detune: 0 });
        v.tone('sine', [[0, 3300], [0.4, 3420, 'e']], { t: 0.002, g: perc(0.02, 0.5, 0.001) });
        sweep(v, 0.01, 0.09, [5200, 7000, 4200], 0.03, { kind: 'white', q: 3, peakAt: 0.2 });
      });
    },
  },
  /** Recover: the mist closes around the ankle — a 300 ms pink swell. */
  heronMistClose: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    play(v0) {
      // (the mist settling back round the ankle: a low 380 → 300 Hz breath and one soft lap of the pond on landing)
      level(v0, 24, (v) => {
        mist(v, 0, [380, 300], [[0, 0.0001], [0.16, 0.035, 'e'], [0.32, 0.0001, 'e']]);
        plip(v, 0.2, 0.006, 900);
      });
    },
  },
  /** The heron is struck (feather + still water): a 60 Hz feather flutter on 3.2 kHz, a low slosh; never a pof. */
  heronStruck: {
    cap: 2,
    gap: 0.04,
    verb: 0.25,
    play(v0) {
      level(v0, 13.5, (v) => {
        const fl = v.flutter(60, 0.5, { d: 0.12, base: 0.5, to: v.filt('bandpass', 3200, 1.6) });
        v.noise('white', { g: perc(0.14, 0.09, 0.003), to: fl });
        slosh(v, 0, 0.12, 0.15, 600);
        fuff(v, 0.01, 0.1, { dec: 0.05, lp: [2400, 1200] });
      });
    },
  },
  /** Struck hard (the hop back on one foot): the feather flutter, the slosh and a "plash" (band 1.5 kHz). */
  heronStruckHeavy: {
    cap: 2,
    gap: 0.04,
    verb: 0.3,
    play(v0) {
      // (driven back on one foot: a feather burst, then the PLASH of the foot coming down in the pond 120 ms
      // later — a wet band 1.2 kHz with a falling droplet — and the tick of the hop landing on the reed root)
      level(v0, 12, (v) => {
        // (the body blow is LOW — a feather thump at 400 Hz — where the light struck sound is a bright 3.2 kHz flutter)
        v.noise('pink', { g: perc(0.22, 0.08, 0.002), to: v.filt('bandpass', 420, 1.2) });
        slosh(v, 0, 0.1, 0.1, 700);
        v.noise('white', { t: 0.12, g: perc(0.14, 0.13, 0.004), to: v.filt('bandpass', [[0, 1000], [0.13, 520, 'e']], 1.6, { t: 0.12 }) });
        v.tone('sine', [[0, 1100], [0.06, 520, 'e']], { t: 0.13, g: perc(0.03, 0.08, 0.002) });
        v.noise('white', { t: 0.125, g: perc(0.06, 0.008, 0.0003), to: v.filt('bandpass', 3600, 4) });
        slosh(v, 0.12, 0.14, 0.2, 560);
      });
    },
  },
  /** Struck by magic: the plumage edges light up, the neck goes rigid — a thin rising shimmer over the flutter. */
  heronStruckMagic: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    play(v0) {
      level(v0, 14, (v) => {
        const fl = v.flutter(60, 0.45, { d: 0.12, base: 0.5, to: v.filt('bandpass', 3400, 1.6) });
        v.noise('white', { g: perc(0.12, 0.1, 0.003), to: fl });
        v.tone('sine', [[0, 1900], [0.18, 2600, 'e']], { g: perc(0.02, 0.22, 0.004) });
        v.tone('sine', [[0, 2860], [0.18, 3900, 'e']], { g: perc(0.008, 0.16, 0.004) });
        slosh(v, 0, 0.08, 0.12, 560);
      });
    },
  },
  /** The guard takes a blow: one fuff of the cloak and a reed rustle (the sheathed sword). */
  heronGuard: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v0) {
      // (the sheathed sword takes the blow: a muffled thud of folded plumage — a low pink knock at 300 Hz, no
      // feather hiss — the straw cloak's fold, the reeds shivering after)
      level(v0, 12.5, (v) => {
        const hp = v.filt('highpass', 160, 0.7);
        v.noise('pink', { g: perc(0.24, 0.06, 0.002), to: v.filt('bandpass', 300, 1.4, { to: hp }) });
        v.tone('sine', [[0, 230], [0.07, 160, 'e']], { g: perc(0.07, 0.08, 0.002) });
        // the sheath: the folded beak knocks once against the breast (a dull 180 Hz wood tock)
        v.tone('triangle', [[0, 190], [0.04, 170, 'e']], { t: 0.012, g: perc(0.05, 0.05, 0.001) });
        fold(v, 0.01, 0.06, 0.14);
      });
    },
  },
  /** Death f1: the wings close around the body — the fuff PAIR, closing: the second softer and darker. */
  heronWingClose: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v0) {
      // (the wing language — a PAIR of feather brushes with a flutter, 120 ms apart — but CLOSING and from the inside:
      // the wing edges brushing the body, high and narrow (hp 900, the low-pass shutting 2600 → 1300 and 2200 → 1100),
      // a 34 Hz flutter on 2 kHz, no low "fuff" body at all — the opening fuff of the summon is low and round; then
      // the straw cloak's fold tucking under)
      level(v0, 13, (v) => {
        for (const [t, g, lp0, lp1, pan] of [[0, 0.24, 2600, 1300, -0.1], [0.12, 0.15, 2200, 1100, 0.1]] as const) {
          const out = v.panner(pan);
          const hp = v.filt('highpass', 900, 0.7, { to: out });
          const lp = v.filt('lowpass', [[0, lp0], [0.08, lp1, 'e']], 1.6, { t, to: hp });
          v.noise('pink', { t, g: [[0, 0], [0.03, g], [0.11, 0.0001, 'e']], to: lp });
          const fl = v.flutter(34, 0.5, { t, d: 0.14, base: 0.5, to: v.filt('bandpass', 2000, 1.4, { to: out }) });
          v.noise('pink', { t, g: perc(g * 0.5, 0.12, 0.01), to: fl });
        }
        fold(v, 0.2, 0.05, 0.16, -0.15);
      });
    },
  },
  /** Death f2: the one step back — a short WET slip on the still water (≥ 120 ms after the wing close). */
  heronBackSlip: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v0) {
      // (wet and short, LOWER than a stride's slip — the weight going back: white noise in a narrow band 850 → 480 Hz
      // over 0.12 s, a sucking sine under it, then two bubbles flicking up — no pink, no long tail: never the mist)
      level(v0, 15, (v) => {
        const hp = v.filt('highpass', 300, 0.7);
        const bp = v.filt('bandpass', [[0, 850], [0.12, 480, 'e']], 4.5, { to: hp });
        v.noise('white', { g: perc(0.2, 0.12, 0.004), to: bp });
        v.tone('sine', [[0, 430], [0.12, 290, 'e']], { g: perc(0.06, 0.12, 0.006) });
        // the bubbles: two quick upward chirps (the water closing behind the lifted foot)
        v.tone('sine', [[0, 900], [0.025, 1500, 'e']], { t: 0.1, g: perc(0.03, 0.035, 0.002) });
        v.tone('sine', [[0, 1100], [0.02, 1750, 'e']], { t: 0.15, g: perc(0.02, 0.03, 0.002) });
      });
    },
  },
  /** Death 'dissolve': the mist swells over him from the bottom up (pink, rising and falling, 600 ms). */
  heronMistSwell: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.3,
    play(v0) {
      // (the fog taking him from the feet up: DARK and low — a 260 → 520 Hz band climbing under a slow 2.5 Hz breath,
      // centred, swelling to the head and falling away; the summon's mist-in is bright and wide, this is close)
      level(v0, 16.5, (v) => {
        const bp = v.filt('bandpass', [[0, 260], [0.55, 520, 'e'], [0.7, 440, 'e']], 2.4);
        v.lfo(bp.frequency, 2.5, 60, { d: 0.7 });
        v.noise('pink', { g: [[0, 0.0001], [0.42, 0.11, 'e'], [0.7, 0.0001, 'e']], to: bp });
        v.tone('sine', [[0, 180], [0.6, 240, 'e']], { g: [[0, 0], [0.4, 0.012], [0.7, 0.0001, 'e']] });
      });
    },
  },
  /** The single ripple ring left on the water: a sine glide 520 → 390 Hz (dec 0.5) with a short echo. */
  heronRing: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v0) {
      level(v0, 9, (v) => {
        const e = v.echo(0.12, 0.3, { wet: 0.5, tone: 2400 });
        v.tone('sine', [[0, 520], [0.5, 390, 'e']], { g: perc(0.09, 0.5, 0.004), to: e });
        v.tone('sine', [[0, 520], [0.5, 390, 'e']], { g: perc(0.09, 0.5, 0.004) });
        v.tone('sine', [[0, 1040], [0.3, 790, 'e']], { g: perc(0.012, 0.25, 0.004) });
      });
    },
  },
  /** Idle f13: the single drop from the beak tip — a sine flicked 1.2 → 2.4 kHz in 15 ms, a ripple 600 → 420 Hz. */
  heronDrop: {
    cap: 1,
    gap: 1.5,
    verb: 0.4,
    duck: 0,
    play(v0) {
      level(v0, 1, (v) => {
        v.tone('sine', [[0, 1200], [0.015, 2400, 'e'], [0.03, 1900, 'e']], { g: perc(0.05, 0.035, 0.001) });
        v.tone('sine', [[0, 600], [0.08, 420, 'e']], { t: 0.014, g: perc(0.022, 0.08, 0.004) });
      });
    },
  },
  /** Idle: one distant frog (a single croak, 3–5 pulses, low-passed for distance) — the marsh around him. */
  heronIdleFrog: {
    cap: 1,
    gap: 1.5,
    verb: 0.45,
    duck: 0,
    play(v0) {
      level(v0, 2.5, (v) => {
        const f = [380, 460, 520][Math.floor(v.r(0, 3))];
        croak(v, 0, f * v.r(0.985, 1.015), 0.03, 0, 3 + Math.floor(v.r(0, 3)), v.r(24, 30));
      });
    },
  },
  /** Idle: the reeds swell once with the sway (pink in a 2.8 kHz band, a slow wander). */
  heronIdleReed: {
    cap: 1,
    gap: 1.5,
    verb: 0.35,
    duck: 0,
    play(v0) {
      level(v0, 22, (v) => {
        rustle(v, 0, 0.9, 0.012, v.r(-0.3, 0.3));
      });
    },
  },
  /** Revive: the mist gathers him back (sustained; stopped on 'land'). */
  heronReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v0) {
      // (the death's swell run backwards: a band RISING 500 → 1400 Hz from both far sides converging on him, the
      // level falling as he condenses — the opposite contour of heronMistSwell / heronMistIn)
      level(v0, 19, (v) => {
        const nb = (t: number, f: readonly [number, number], g: number, pan: number) => {
          const out = v.panner([[0, pan], [0.9, 0]], { t });
          const bp = v.filt('bandpass', [[0, f[0]], [0.9, f[1], 'e']], 5, { t, to: out });
          v.noise('pink', { t, g: [[0, 0.0001], [0.12, g, 'e'], [0.55, g * 0.6], [0.95, 0.0001, 'e']], to: bp });
        };
        nb(0, [900, 2200], 0.1, -0.9);
        nb(0.06, [1000, 2500], 0.08, 0.9);
        // he condenses: two faint sines drawing together (a fifth closing to a unison), the mist's only pitch
        v.tone('sine', [[0, 880], [0.8, 1320, 'e']], { g: [[0, 0], [0.4, 0.006], [0.9, 0.0001, 'e']] });
        v.tone('sine', [[0, 1320], [0.8, 1330, 'e']], { g: [[0, 0], [0.4, 0.005], [0.9, 0.0001, 'e']] });
      });
    },
  },
} satisfies Record<string, Recipe>;

export type HeronSfxName = keyof typeof V3_HERON_RECIPES;

/**
 * The heron's role set (_v3/sound.ts CHARACTER_SOUNDS: the kits' declaration, death and revive beats). No
 * `deathStart`: the wing close and the back-step slip are scored by the card's own death watcher on the frame the
 * death pose really starts from (src/cinematics/kartc/reed_heron.ts).
 */
export const HERON_VOICE = {
  roar: 'heronWingFuff',
  arrive: 'heronMistIn',
  land: 'heronSettle',
  charge: 'heronCoil',
  release: 'heronFwip',
  impact: 'heronTak3',
  dissolve: 'heronMistSwell',
  burst: 'heronRing',
  reviveGather: 'heronReviveGather',
  reviveLand: 'heronSettle',
} satisfies CharacterSounds;
