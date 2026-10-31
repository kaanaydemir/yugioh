// Yansıyan Okçu (reflection_archer, lane D, C4) — the moon archer's own sound set (?look=v3 only; YENI_KARTLAR
// §C4, §5.1). src/audio/sounds.ts spreads V3_ARCHER_RECIPES and SfxName gains ArcherSfxName.
//
// Identity (§5.1 C4): ONE pitch, 660 Hz, sounded as a MIRROR pair — the note on the left and its phase-inverted
// twin on the right (a wide, hollow, "glass-surface" image; a mono fold keeps ~30 % of it) — and the REFLECTION:
// every note is answered 80 ms later an octave down (330 Hz), darker (low-passed), from the other side. Matter:
// a light wire (a plucked, very pure string: sine + soft 2nd / 3rd) and a glass surface (a flat, high band of
// noise that "spreads"). Its glass is the 660 harmonic series (1980 / 2640 / 3300 / 3960 Hz) — never the crystal
// wyrm's E-major pentatonic rain or bar-mode bell, never R2's glassReverse.
//
//   arrive  archerDrop          a drop of light falls: a thin falling glint (summon f0)
//           archerTip           it hits the tile: "tıp" + the glass surface spreading flat (summon f2)
//           archerReflect       the reflection wakes in the puddle FIRST: its 330 alone, swelling (summon f5)
//           archerRise          the archer unfolds up over it: the inverted-rise whine 330 → 660 (sustained → land)
//   land    archerLand          standing: the mirror note 660 / −660 + crown glint, echoed 80 ms later at 330
//   roar    archerRoar          two moons: 660 + 990 mirror dyad, echoed at 330 + 495, the puddle hum
//   charge  archerCharge        the long draw: the light string tightens (creak ticks, a rising 660 shimmer)
//                               and the reflection's own draw 80 ms behind, an octave down (sustained → release)
//   release archerRelease       the bow twang: plucked 660 wire + its inverted twin + the 330 echo
//           archerFlight        two arrows: a bright whistle above, a muffled whistle UNDER the floor (sustained → contact)
//   impact  archerImpact        they meet top and bottom: a two-note bell (660 above, 330 below at once) + the
//                               horizontal mirror flash "shing", the 80 ms echo an octave down of both
//           archerDeflect       blocked: the arrows glance off the guard (a beating 660 / 640 + glass skid)
//   (death f1) archerCrack      the puddle cracks (a glass-surface crack + the 330 bending down)
//   dissolve   archerFlat       the flat beat: the 660 sounds ONCE, dry — and no echo answers (the reflection is gone)
//   afterDissolve archerWeb     cracks of light web out of the chest gem (tiny glass ticks)
//   burst   archerShatter       the archer shatters into glass: harmonic-series shards, each echoed 80 ms lower
//   reviveGather archerReviveGather  the shards come home (rising, converging 660 shimmer; sustained → land)
//   reviveLand   archerReviveLand    the mirror note and its echo again — the reflection answers once more
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { perc, type Pt, type Voice } from '../synth';
import { crack, puff, scaled, sweep, thump } from './kit';

/** The archer's pitch. */
const F = 660;
/** The reflection's pitch (an octave down). */
const FR = 330;
/** The reflection's delay (s). */
const ECHO = 0.08;
/** The archer's glass: the harmonic series of 660. */
const GLASS = [1980, 2640, 3300, 3960, 4620] as const;

/**
 * A mirror pair: `f` on the left and its phase-inverted twin on the right (one oscillator, two paths). `w` the
 * stereo width (pan of each side), `inv` the inverted side's level relative to the direct one.
 */
function mirror(v: Voice, f: number, t: number, env: readonly Pt[], o: { w?: number; inv?: number; to?: AudioNode; wave?: 'sine' | 'triangle'; detune?: number } = {}): void {
  const w = o.w ?? 0.55;
  const l = v.panner(-w, { to: o.to });
  const r = v.panner(w, { to: o.to });
  const split = v.amp(1, { t, to: l });
  const inv = v.amp(-(o.inv ?? 0.7), { t, to: r });
  split.connect(inv);
  v.tone(o.wave ?? 'sine', f, { t, g: env, to: split, detune: o.detune });
}

/** The reflection's answer: `f` an octave down, `ECHO` later, darker (low-passed), from the side `side`. */
function reflect(v: Voice, f: number, t: number, env: readonly Pt[], o: { side?: number; lp?: number } = {}): void {
  const pan = v.panner(o.side ?? 0.35);
  const lp = v.filt('lowpass', o.lp ?? 1400, 0.8, { t: t + ECHO, to: pan });
  v.tone('sine', f / 2, { t: t + ECHO, g: env, to: lp });
  v.tone('triangle', f / 2, { t: t + ECHO, g: scaled(env, 0.25), to: lp });
}

/** A plucked light wire on `f`: the mirror pair, a bright pluck transient, soft 2nd and 3rd partials. */
function wire(v: Voice, f: number, t: number, g: number, dec: number, o: { echo?: boolean; w?: number } = {}): void {
  mirror(v, f, t, perc(g, dec, 0.002), { w: o.w });
  v.tone('sine', f * 2, { t, g: perc(g * 0.28, dec * 0.45, 0.002) });
  v.tone('sine', f * 3, { t, g: perc(g * 0.1, dec * 0.25, 0.002) });
  v.noise('white', { t, g: perc(g * 0.5, 0.006, 0.0003), to: v.filt('bandpass', f * 6, 2.5) });
  if (o.echo !== false) reflect(v, f, t, perc(g * 0.62, dec * 1.1, 0.004));
}

/** A small glass shard of the archer's series (pure partial pair, very short), optionally echoed. */
function shard(v: Voice, f: number, t: number, g: number, dec: number, pan: number, echo: boolean): void {
  const p = v.panner(pan);
  v.tone('sine', f, { t, g: perc(g, dec, 0.0006), to: p });
  v.tone('sine', f * 2.01, { t, g: perc(g * 0.3, dec * 0.4, 0.0006), to: p });
  if (echo) {
    const pr = v.panner(-pan * 0.8);
    const lp = v.filt('lowpass', 2200, 0.7, { t: t + ECHO, to: pr });
    v.tone('sine', f / 2, { t: t + ECHO, g: perc(g * 0.5, dec * 1.3, 0.002), to: lp });
  }
}

/** The glass surface: a flat high band of noise (a mirror being wiped flat / spreading). */
function surface(v: Voice, t: number, d: number, g: number, f0: number, f1: number, pan?: readonly [number, number]): void {
  sweep(v, t, d, [f0, (f0 + f1) / 2, f1], g, { kind: 'white', q: 3.2, pan, peakAt: 0.3 });
}

export const V3_ARCHER_RECIPES = {
  /** Summon f0: a drop of light falls out of the dark — a thin falling glint. */
  archerDrop: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      const D = 0.2;
      v.tone('sine', [[0, F * 4], [D, F * 2, 'e']], { g: [[0, 0], [0.04, 0.05], [D - 0.02, 0.06], [D + 0.02, 0.0001, 'e']] });
      v.tone('sine', [[0, F * 6], [D, F * 3, 'e']], { g: [[0, 0], [0.05, 0.015], [D, 0.0001, 'e']] });
      sweep(v, 0, D + 0.02, [7000, 4800, 2600], 0.035, { kind: 'pink', q: 2.2, peakAt: 0.8 });
    },
  },
  /** Summon f2: the drop hits the tile — "tıp" — and the glass surface spreads flat (f3–f4). */
  archerTip: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      // the drop: a tiny pitched blip falling a fifth (a water-drop "tıp" made of light)
      v.tone('sine', [[0, F * 2], [0.035, F * 1.5, 'e']], { g: perc(0.17, 0.06, 0.001) });
      v.noise('white', { g: perc(0.08, 0.004, 0.0002), to: v.filt('highpass', 5000, 0.8) });
      thump(v, 0, 260, 140, 0.08, 0.05);
      wire(v, F, 0.01, 0.07, 0.35, { w: 0.3 });
      // the surface spreads: a flat glassy band opening outward (narrow → wide)
      surface(v, 0.04, 0.32, 0.05, 9000, 3800, [0, 0]);
      surface(v, 0.06, 0.3, 0.03, 7000, 2900, [-0.6, 0.6]);
      surface(v, 0.06, 0.3, 0.03, 7000, 2900, [0.6, -0.6]);
    },
  },
  /** Summon f5: the reflection appears first — its 330 alone, swelling up out of the puddle, from below. */
  archerReflect: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.25,
    play(v) {
      const lp = v.filt('lowpass', [[0, 300], [0.25, 1200, 'e'], [0.55, 700, 'e']], 0.9);
      v.tone('sine', FR, { g: [[0, 0], [0.18, 0.09], [0.45, 0.06], [0.7, 0.0001, 'e']], to: lp });
      v.tone('triangle', FR, { g: [[0, 0], [0.2, 0.03], [0.6, 0.0001, 'e']], to: lp, detune: 4 });
      v.tone('sine', FR / 2, { g: [[0, 0], [0.2, 0.04], [0.6, 0.0001, 'e']] });
      // the dark blue: a slow under-surface shimmer
      const am = v.ring(7, { d: 0.7, mix: 0.5 });
      v.noise('pink', { g: [[0, 0], [0.2, 0.025], [0.6, 0.0001, 'e']], to: v.filt('bandpass', 900, 2.5, { to: am }) });
    },
  },
  /** Summon f7 → land: the archer unfolds up over its reflection — the inverted-rise whine 330 → 660 (sustained). */
  archerRise: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      const D = 0.5;
      const f: Pt[] = [[0, FR], [D * 0.85, F, 'e'], [D, F]];
      const l = v.panner(-0.5);
      const r = v.panner(0.5);
      const split = v.amp(1, { to: l });
      const inv = v.amp(-0.7, { to: r });
      split.connect(inv);
      const w = v.tone('sine', f, { g: [[0, 0], [0.08, 0.06], [D, 0.1], [D + 0.12, 0.0001, 'e']], to: split });
      v.lfo(w.osc.detune, [[0, 5], [D, 11, 'e']], 9, { d: D + 0.1 });
      // the reflection's half: the same glide an octave down, a hair behind
      const lp = v.filt('lowpass', 1100, 0.8);
      v.tone('sine', [[0, FR / 2], [ECHO, FR / 2], [D * 0.85 + ECHO, FR, 'e']], { g: [[0, 0], [0.12, 0.05], [D, 0.06], [D + 0.15, 0.0001, 'e']], to: lp });
      surface(v, 0, D, 0.025, 2400, 6800, [0.3, -0.3]);
    },
  },
  /** Summon 'land': standing over its reflection — the mirror note, a crown glint, the 330 answer 80 ms later. */
  archerLand: {
    cap: 2,
    gap: 0.05,
    verb: 0.5,
    duck: 0.5,
    play(v) {
      wire(v, F, 0, 0.2, 0.9);
      v.tone('sine', F * 2, { t: 0.012, g: perc(0.05, 0.5, 0.002) });
      shard(v, GLASS[1], 0.02, 0.05, 0.25, -0.3, false);
      thump(v, 0, 200, 90, 0.12, 0.09);
      puff(v, 0, 0.04, 0.12, 2400);
    },
  },
  /** Roar: two moons — the bow and the crown held up; the 660 / 990 mirror dyad and its 330 / 495 answer. */
  archerRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.6,
    play(v) {
      const env: Pt[] = [[0, 0], [0.1, 0.12], [0.55, 0.09], [1.0, 0.0001, 'e']];
      mirror(v, F, 0, env, { w: 0.6 });
      mirror(v, F * 1.5, 0.03, scaled(env, 0.7), { w: 0.45 });
      reflect(v, F, 0, scaled(env, 0.8), { side: 0.2 });
      reflect(v, F * 1.5, 0.03, scaled(env, 0.55), { side: -0.2 });
      const am = v.ring([[0, 4], [0.8, 9, 'e']], { d: 1.0, mix: 0.35 });
      v.tone('sine', F * 2, { g: scaled(env, 0.3), to: am });
      surface(v, 0.05, 0.6, 0.03, 3000, 8000, [-0.5, 0.5]);
      thump(v, 0, 160, 70, 0.1, 0.2);
    },
  },
  /**
   * Attack charge → release: the light string tightens over the long draw — creak ticks speeding up, a 660
   * shimmer rising in level and brightness — and the reflection's draw an octave down, 80 ms behind (sustained).
   */
  archerCharge: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 1.4;
      // the creak: ticks of the bending bow, faster as it bends (8 → 26 / s)
      let t = 0.02;
      let i = 0;
      while (t < D) {
        const k = t / D;
        v.noise('white', { t, g: perc(0.05 + 0.04 * k, 0.006, 0.0003), to: v.filt('bandpass', i % 2 ? 2600 : 3100, 3) });
        t += 1 / (8 + 18 * k * k);
        i++;
      }
      const env: Pt[] = [[0, 0], [0.15, 0.025], [D, 0.11], [D + 0.1, 0.0001, 'e']];
      const sh = v.ring([[0, 5], [D, 14, 'e']], { d: D + 0.12, mix: 0.4 });
      mirror(v, F, 0, env, { w: 0.5, to: sh });
      v.tone('sine', [[0, F * 2], [D, F * 2.02]], { g: scaled(env, 0.2) });
      // the reflection draws a step behind
      const lp = v.filt('lowpass', [[0, 500], [D, 1400, 'e']], 0.8);
      v.tone('sine', FR, { t: ECHO, g: scaled(env, 0.7), to: lp });
      surface(v, 0.1, D, 0.018, 3000, 6000, [-0.3, 0.3]);
    },
  },
  /** Attack 'release': the bow twang — the plucked light wire, its inverted twin and the 330 answer. */
  archerRelease: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      wire(v, F, 0, 0.22, 0.55, { w: 0.6 });
      // the string's snap and the hand flying back
      v.noise('white', { g: perc(0.14, 0.012, 0.0003), to: v.filt('bandpass', 4200, 1.6) });
      thump(v, 0, 300, 120, 0.09, 0.05);
      sweep(v, 0.01, 0.12, [1800, 5200, 3000], 0.05, { kind: 'pink', q: 1.4, pan: [-0.3, 0.4] });
    },
  },
  /** Release → contact: the two arrows — a bright whistle above, a muffled one UNDER the floor (sustained). */
  archerFlight: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.6;
      // above: a thin whistle (the arrow of light), panning across
      const hi = v.tone('sine', [[0, 3960], [D, 3300, 'e']], { g: [[0, 0], [0.03, 0.045], [D, 0.035], [D + 0.05, 0.0001, 'e']], to: v.panner([[0, -0.3], [D, 0.35]]) });
      v.lfo(hi.osc.detune, 31, 14, { d: D + 0.05 });
      sweep(v, 0, D, [5000, 7000, 5600], 0.04, { kind: 'white', q: 4, pan: [-0.3, 0.35], peakAt: 0.4 });
      // below: the reflection's arrow under the floor — the same whistle an octave down, muffled, lagging
      const lp = v.filt('lowpass', 900, 1.2, { to: v.panner([[0, -0.2], [D, 0.3]]) });
      const lo = v.tone('triangle', [[0, 1980], [D, 1650, 'e']], { t: ECHO * 0.5, g: [[0, 0], [0.05, 0.08], [D, 0.06], [D + 0.05, 0.0001, 'e']], to: lp });
      v.lfo(lo.osc.detune, 19, 20, { t: ECHO * 0.5, d: D });
      v.noise('brown', { g: [[0, 0], [0.06, 0.09], [D, 0.07], [D + 0.05, 0.0001, 'e']], to: v.filt('lowpass', 500, 0.9) });
    },
  },
  /**
   * Contact: the arrows meet top and bottom — a two-note bell (660 from above, 330 from below, together), the
   * horizontal mirror flash "shing" — and the reflection's answer an octave down of both, 80 ms later.
   */
  archerImpact: {
    cap: 2,
    gap: 0.04,
    verb: 0.5,
    duck: 0.6,
    play(v) {
      wire(v, F, 0, 0.2, 0.9, { w: 0.65 });
      v.tone('sine', FR, { g: perc(0.17, 0.8, 0.002) });
      v.tone('triangle', FR, { g: perc(0.05, 0.4, 0.002) });
      reflect(v, FR, 0, perc(0.1, 0.7, 0.004), { side: -0.3, lp: 700 });
      // the mirror flash: a flat bright band, wide in stereo, and two high glass partials
      surface(v, 0, 0.16, 0.08, 10000, 6000, [-0.7, 0.7]);
      surface(v, 0, 0.16, 0.08, 10000, 6000, [0.7, -0.7]);
      shard(v, GLASS[2], 0.004, 0.06, 0.3, -0.4, true);
      shard(v, GLASS[3], 0.009, 0.045, 0.25, 0.4, false);
      crack(v, 0, 0.12, { hp: 3500, lp: 11000, dec: 0.01 });
      thump(v, 0, 180, 70, 0.16, 0.12, { drive: 1.3 });
    },
  },
  /** Blocked: the two arrows glance off the guard — a beating 660 / 640, a glass skid, the low answer sags. */
  archerDeflect: {
    cap: 2,
    gap: 0.04,
    verb: 0.4,
    duck: 0.45,
    play(v) {
      mirror(v, F, 0, perc(0.14, 0.5, 0.002), { w: 0.4 });
      v.tone('sine', 640, { g: perc(0.11, 0.45, 0.002) });
      v.tone('sine', [[0, FR], [0.3, FR * 0.84, 'e']], { t: ECHO, g: perc(0.08, 0.4, 0.004), to: v.filt('lowpass', 900, 0.8) });
      sweep(v, 0, 0.18, [6000, 3200, 1800], 0.07, { kind: 'white', q: 2.5, pan: [0.2, -0.5], peakAt: 0.2 });
      crack(v, 0, 0.1, { hp: 3000, n: 2, gap: 0.02 });
      thump(v, 0, 220, 110, 0.1, 0.06);
    },
  },
  /** Death f1: the puddle cracks — a glass-surface crack running out, the 330 bending down under it. */
  archerCrack: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      crack(v, 0, 0.16, { hp: 2600, n: 3, gap: 0.018, dec: 0.014 });
      v.bursts([0.05, 0.08, 0.1, 0.13, 0.17, 0.2], [0.06, 0.05, 0.05, 0.04, 0.03, 0.02], { dec: 0.008, f: 5200, q: 2.5 });
      v.tone('sine', [[0, FR], [0.4, FR * 0.7, 'e']], { g: perc(0.11, 0.45, 0.004), to: v.filt('lowpass', 900, 0.8) });
      // the reflection's shards: dark, low-passed series notes falling
      for (const [i, f] of [GLASS[0], GLASS[1], GLASS[0] * 0.75].entries()) {
        v.tone('sine', f / 2, { t: 0.06 + i * 0.05, g: perc(0.04, 0.12, 0.001), to: v.filt('lowpass', 1600, 0.8) });
      }
    },
  },
  /** Death 'dissolve': the flat beat — the 660 once, dry and centred — and NO echo answers. */
  archerFlat: {
    cap: 1,
    gap: 0.1,
    verb: 0.15,
    duck: 0.3,
    play(v) {
      v.tone('sine', F, { g: perc(0.12, 0.35, 0.002) });
      v.tone('sine', F * 2, { g: perc(0.02, 0.15, 0.002) });
      v.noise('white', { g: perc(0.04, 0.005, 0.0003), to: v.filt('bandpass', 3800, 2) });
    },
  },
  /** Death (dissolve + 2): cracks of light web out from the chest gem — tiny glass ticks, accelerating. */
  archerWeb: {
    cap: 1,
    gap: 0.08,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const ts = [0, 0.03, 0.05, 0.07, 0.085, 0.1, 0.11, 0.12];
      v.bursts(ts, ts.map((_, i) => 0.05 + i * 0.006), { dec: 0.006, f: 6400, q: 3 });
      for (let i = 0; i < 4; i++) shard(v, GLASS[3 + (i % 2)], ts[i * 2], 0.02 + i * 0.006, 0.08, i % 2 ? 0.3 : -0.3, false);
    },
  },
  /** Death burst: the archer shatters into glass — shards of its harmonic series, each answered 80 ms lower. */
  archerShatter: {
    cap: 1,
    gap: 0.1,
    verb: 0.55,
    duck: 0.55,
    play(v) {
      crack(v, 0, 0.22, { hp: 2200, n: 3, gap: 0.012, dec: 0.016 });
      thump(v, 0, 240, 90, 0.1, 0.08);
      for (let i = 0; i < 14; i++) {
        const k = Math.pow(v.rnd(), 1.4);
        const f = GLASS[Math.floor(v.rnd() * GLASS.length) % GLASS.length];
        shard(v, f * v.r(0.996, 1.004), 0.01 + k * 0.55, 0.05 * (1 - 0.6 * k) * v.r(0.6, 1), v.r(0.08, 0.2), v.r(-0.6, 0.6), i % 2 === 0);
      }
      // the last of the mirror note, cut short
      mirror(v, F, 0, perc(0.08, 0.25, 0.002), { w: 0.6 });
      sweep(v, 0, 0.5, [7000, 5000, 2500], 0.04, { kind: 'white', q: 1.2, pan: [-0.4, 0.4], peakAt: 0.1 });
    },
  },
  /** Revive: the glass gathers back (rising, converging 660 shimmer; the 330 comes first) — sustained → land. */
  archerReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      const D = 0.9;
      // the reflection reforms first: the 330 fades in before anything else
      v.tone('sine', FR, { g: [[0, 0], [0.25, 0.07], [D, 0.06], [D + 0.1, 0.0001, 'e']], to: v.filt('lowpass', 1200, 0.8) });
      const env: Pt[] = [[0, 0], [0.3, 0.0001], [D, 0.08], [D + 0.08, 0.0001, 'e']];
      mirror(v, F, 0, env, { w: 0.5 });
      // shards flying home: series pings, denser toward the end, closing in from the sides
      for (let i = 0; i < 12; i++) {
        const k = Math.pow(i / 12, 0.7);
        const f = GLASS[i % GLASS.length];
        shard(v, f, 0.05 + k * (D - 0.1), 0.02 + 0.025 * k, 0.07, (i % 2 ? 1 : -1) * (0.6 - 0.5 * k), false);
      }
      surface(v, 0.2, D - 0.2, 0.03, 2500, 8000, [0.5, -0.5]);
    },
  },
  /** Revive 'land': whole again — the mirror note, and the reflection answers once more. */
  archerReviveLand: {
    cap: 1,
    gap: 0.1,
    verb: 0.5,
    duck: 0.5,
    play(v) {
      wire(v, F, 0, 0.18, 0.9);
      v.tone('sine', F * 1.5, { t: 0.02, g: perc(0.05, 0.6, 0.002) });
      shard(v, GLASS[1], 0.03, 0.05, 0.3, 0.3, true);
      thump(v, 0, 190, 90, 0.1, 0.09);
    },
  },
} satisfies Record<string, Recipe>;

export type ArcherSfxName = keyof typeof V3_ARCHER_RECIPES;
