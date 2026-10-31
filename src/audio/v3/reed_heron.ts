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
import { puff, sweep } from './kit';

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
  const lp = v.filt('lowpass', [[0, o.lp?.[0] ?? 1800], [dec, o.lp?.[1] ?? 900, 'e']], 0.8, { t, to: hp });
  v.noise('pink', { t, g: [[0, 0], [dec * 0.28, g], [dec, 0.0001, 'e']], to: lp });
  const fl = v.flutter(48, 0.45, { t, d: dec + 0.06, base: 0.5, to: v.filt('bandpass', 1400, 1.1, { to: out }) });
  v.noise('pink', { t, g: perc(g * 0.55, dec + 0.05, 0.01), to: fl });
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

/** The beak "tak": a dry Q 9 click at `f`, the same pitch as a 25 ms sine, a 15 ms wood body at 900 Hz. */
function tak(v: Voice, t: number, f: number, g: number): void {
  v.noise('white', { t, g: perc(g * 1.9, 0.006, 0.0002), to: v.filt('bandpass', f, 9) });
  v.tone('sine', f, { t, g: perc(g * 0.6, 0.028, 0.0004) });
  v.tone('sine', f * 1.5, { t, g: perc(g * 0.08, 0.012, 0.0004) });
  v.noise('white', { t, g: perc(g * 1.1, 0.015, 0.0004), to: v.filt('bandpass', 900, 2.4) });
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
  const bp = v.filt('bandpass', [[0, f[0]], [d, f[1], 'e']], 0.9, { t, to: out });
  v.noise('pink', { t, g: env, to: bp });
}

/**
 * Run a recipe body at a make-up gain (dB) on its own sub-voice: the layers are written at their relative
 * levels (the spec's table), the level matches the loudness of the other v3 sets (the heron stays the
 * quietest: about 6 dB under them, every peak ≤ −3 dBFS through the chain; shots/kartc/reed_heron/sfx-probe.txt).
 */
function level(v: Voice, db: number, fn: (w: Voice) => void): void {
  const g = v.ctx.createGain();
  g.gain.value = Math.pow(10, db / 20);
  g.connect(v.out);
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
        const frogs: [number, number][] = [[380, -0.7], [460, 0], [520, 0.7]];
        const starts = [0.02, 0.21, 0.47, 0.66, 0.93, 1.18, 1.42, 1.61];
        starts.forEach((t, i) => {
          const [f, pan] = frogs[(i * 2 + (i > 3 ? 1 : 0)) % 3];
          croak(v, t, f * v.r(0.985, 1.015), 0.05 * v.r(0.7, 1), pan, 3 + Math.floor(v.r(0, 3)), v.r(24, 30));
        });
        rustle(v, 0, 1.9, 0.018, 0.2);
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
        const env: [number, number, ('e' | 'l')?][] = [[0, 0.0001], [0.3, 0.075, 'e'], [0.8, 0.065], [1.2, 0.0001, 'e']];
        mist(v, 0, [900, 600], env, [-0.8, -0.2]);
        mist(v, 0.04, [980, 640], env, [0.8, 0.2]);
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
        mist(v, 0, [500, 1500], [[0, 0.0001], [0.15, 0.03, 'e'], [0.25, 0.09, 'e'], [0.275, 0.0001, 'e']]);
        sweep(v, 0.05, 0.22, [1200, 2600, 3000], 0.018, { kind: 'pink', q: 1.4, peakAt: 0.9, pan: [-0.3, 0.3] });
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
  /** The bow tension of the neck coil (charge, sustained): a sine 300 → 600 Hz with a little breath, no creak. */
  heronCoil: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v0) {
      level(v0, 5, (v) => {
        v.tone('sine', [[0, 300], [0.62, 600, 'e'], [0.9, 640, 'e']], { g: [[0, 0], [0.12, 0.05], [0.6, 0.07], [0.9, 0.0001, 'e']] });
        v.tone('sine', [[0, 452], [0.62, 902, 'e'], [0.9, 960, 'e']], { g: [[0, 0], [0.2, 0.012], [0.6, 0.016], [0.9, 0.0001, 'e']] });
        const bp = v.filt('bandpass', [[0, 1300], [0.7, 2300, 'e']], 1.3);
        v.noise('pink', { g: [[0, 0], [0.3, 0.02], [0.75, 0.03], [0.9, 0.0001, 'e']], to: bp });
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
  /** The mist trail of the glide: a pink sweep 600 → 1200 → 500 Hz over 0.42 s (the caller pans it to the target). */
  heronTrail: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v0) {
      level(v0, 20, (v) => {
        sweep(v, 0, 0.42, [600, 1200, 500], 0.07, { kind: 'pink', q: 1.1, peakAt: 0.45 });
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
      level(v0, 14, (v) => {
        tak(v, 0, 2400, 0.2);
        plip(v, 0.03, 0.012, 1500);
      });
    },
  },
  /** Thrust 2 (bottom): tak at 2.54 kHz (the pitch goes up). */
  heronTak2: {
    cap: 2,
    gap: 0.02,
    verb: 0.2,
    duck: 0.2,
    play(v0) {
      level(v0, 13.5, (v) => {
        tak(v, 0, 2540, 0.2);
        plip(v, 0.028, 0.012, 1350);
      });
    },
  },
  /** Thrust 3 (centre, the contact): TAK at 2.14 kHz +3 dB, then the blade ring (FM 2140 / 3.53) and two plips. */
  heronTak3: {
    cap: 2,
    gap: 0.02,
    verb: 0.3,
    duck: 0.45,
    play(v0) {
      level(v0, 11.5, (v) => {
        tak(v, 0, 2140, 0.28);
        v.bell(2140, { t: 0.004, g: 0.028, dec: 0.6, ratio: 3.53, index: 1.1 });
        v.bell(2140 * 2.01, { t: 0.004, g: 0.006, dec: 0.35, ratio: 3.53, index: 0.6 });
        plip(v, 0.05, 0.016, 1400);
        plip(v, 0.11, 0.011, 1150);
      });
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
      level(v0, 26, (v) => {
        mist(v, 0, [700, 520], [[0, 0.0001], [0.16, 0.03, 'e'], [0.3, 0.0001, 'e']]);
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
        puff(v, 0, 0.12, 0.15, 600, { kind: 'pink' });
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
      level(v0, 11.5, (v) => {
        const fl = v.flutter(60, 0.55, { d: 0.14, base: 0.5, to: v.filt('bandpass', 3000, 1.5) });
        v.noise('white', { g: perc(0.17, 0.11, 0.003), to: fl });
        puff(v, 0, 0.16, 0.18, 620, { kind: 'pink' });
        v.noise('white', { t: 0.06, g: perc(0.1, 0.1, 0.005), to: v.filt('bandpass', 1500, 1.8) });
        fuff(v, 0.0, 0.14, { dec: 0.06 });
        fuff(v, 0.08, 0.09, { dec: 0.06, lp: [1500, 800] });
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
        puff(v, 0, 0.08, 0.12, 560, { kind: 'pink' });
      });
    },
  },
  /** The guard takes a blow: one fuff of the cloak and a reed rustle (the sheathed sword). */
  heronGuard: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v0) {
      level(v0, 14.5, (v) => {
        fuff(v, 0, 0.2, { dec: 0.08, lp: [1500, 700] });
        rustle(v, 0.02, 0.3, 0.03);
        puff(v, 0, 0.06, 0.1, 500, { kind: 'pink' });
      });
    },
  },
  /** Death f1: the wings close around the body — a closing pair of fuffs, the second softer and darker. */
  heronWingClose: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v0) {
      level(v0, 14.5, (v) => {
        fuff(v, 0, 0.2, { dec: 0.08, lp: [1500, 700] });
        fuff(v, 0.085, 0.12, { dec: 0.08, lp: [1100, 520] });
      });
    },
  },
  /** Death f2: the one step back — a slip on the still water. */
  heronBackSlip: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v0) {
      level(v0, 18, (v) => {
        slip(v, 0, 0.13, 0.15);
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
      level(v0, 25, (v) => {
        mist(v, 0, [420, 900], [[0, 0.0001], [0.3, 0.085, 'e'], [0.6, 0.0001, 'e']], [-0.35, 0.35]);
        mist(v, 0.05, [700, 1300], [[0, 0.0001], [0.28, 0.035, 'e'], [0.55, 0.0001, 'e']], [0.35, -0.35]);
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
  /** Revive: the mist gathers him back (sustained; stopped on 'land'). */
  heronReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v0) {
      level(v0, 22, (v) => {
        mist(v, 0, [1300, 600], [[0, 0.0001], [0.45, 0.07, 'e'], [0.75, 0.06], [0.95, 0.0001, 'e']], [0.4, -0.1]);
        mist(v, 0.04, [1100, 520], [[0, 0.0001], [0.45, 0.05, 'e'], [0.75, 0.04], [0.95, 0.0001, 'e']], [-0.4, 0.1]);
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
