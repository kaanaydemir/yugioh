// Zehir Ejderi (venom_drake) sounds — docs/v3/kart-a/venom_drake.md §6. Kept in a file of its own (like
// ./ashen.ts): src/audio/sounds.ts spreads V3_VENOM_RECIPES, SfxName gains VenomSfxName, and
// CHARACTER_SOUNDS.venom_drake (src/cinematics/_v3/sound.ts) names the role set.
//
// Identity: BIMODAL. A 55 Hz wet throat-sac gurgle (a 7 Hz detune wobble) and sub knocks below 120 Hz; a
// STATIC acid hiss (white noise through a fixed ≥ 5.5 kHz high-pass, shaped by amplitude only — it never
// sweeps), a dense high fizz (≥ 110 clicks/s at 6.5–7.5 kHz) and the stinger RATTLE (a periodic 4.2 kHz click
// train that speeds up 14 → 22/26/30 clicks/s with the strike's power) above 1.6 kHz. Nothing sits in the
// 300 Hz–1.5 kHz valley for longer than a transient. No growl, no flutter, no glass, no rising sweep.
// The leitmotif: the drop "tıp→tsss" (a 2.4 → 1.6 kHz falling tick + a dense fizz).
// Built from ./kit.ts blocks and the Voice primitives only (SE-3: no new DSP).

import type { Recipe } from '../sounds';
import { perc, type Pt, type Voice } from '../synth';
import { crack, drone, puff, sweep, thump } from './kit';

/** Click times (s) for a rattle: the period eases from p0 to p1 over `ramp` s, then holds. */
function rattleTimes(d: number, p0: number, p1: number, ramp = 0): number[] {
  const out: number[] = [];
  for (let t = 0; t < d; ) {
    out.push(t);
    const k = ramp > 0 ? Math.min(1, t / ramp) : 1;
    t += p0 + (p1 - p0) * k;
  }
  return out;
}

/** The stinger rattle: one periodic click train at 4.2 kHz (one source, one gain), a 3-step accent cycle. */
function rattle(v: Voice, t: number, times: readonly number[], g: number, fade = 0): void {
  const n = times.length;
  v.bursts(
    times,
    times.map((_, i) => g * (0.8 + (0.2 * ((i * 7) % 3)) / 2) * (fade > 0 ? 1 - fade * (i / Math.max(1, n - 1)) : 1)),
    { t, f: 4200, q: 1.4, dec: 0.006, kind: 'white' },
  );
}

/** The static acid hiss: white noise through a FIXED high-pass (≥ 5.5 kHz); `env` is amplitude only. */
function hiss(v: Voice, t: number, env: readonly Pt[], hp = 5500): void {
  v.noise('white', { t, g: env, to: v.filt('highpass', hp, 0.7, { t }) });
}

/** The sac gurgle: a low sine with the 7 Hz detune wobble (the LFO runs `d` s). */
function gurgle(v: Voice, t: number, f: number | readonly Pt[], env: readonly Pt[], d: number, depth = 60): void {
  const g = v.tone('sine', f, { t, g: env });
  v.lfo(g.osc.detune, 7, depth, { t, d });
}

/** The drop leitmotif "tıp→tsss" at `t` (`k` level). */
function drip(v: Voice, t: number, k: number): void {
  v.tone('sine', [[0, 2400], [0.025, 1600, 'e']], { t, g: perc(0.06 * k, 0.04) });
  v.crackle({ t: t + 0.03, d: 0.25, n: 30, g: 0.02 * k, f: 7500, q: 0.9, dec: 0.003, curve: 1.3 });
  hiss(v, t + 0.03, [[0, 0], [0.02, 0.012 * k], [0.25, 0.0001, 'e']], 6500);
}

/** The splat body (below the valley) + the separate wet edge click + a sub knock + a short hiss flare. */
function splat(v: Voice, t: number, k: number): void {
  v.bursts([0, 0.012, 0.03], [0.5 * k, 0.3 * k, 0.15 * k], { t, dec: [0.05, 0.04, 0.03], f: 110, q: 1.4, kind: 'brown' });
  v.bursts([0.001], [0.22 * k], { t, dec: 0.008, f: 3000, q: 2, kind: 'white' });
  thump(v, t, 110, 50, 0.4 * k, 0.08);
  hiss(v, t, [[0, 0], [0.004, 0.1 * k], [0.04, 0.0001, 'e']]);
}

/** The landing knuckles (thump ×2, a wet low slap, a hiss tick, two drip ticks). */
function knuckles(v: Voice, t: number, k: number): void {
  thump(v, t, 140, 58, 0.55 * k, 0.14, { drive: 1.5 });
  thump(v, t + 0.045, 130, 55, 0.45 * k, 0.12, { drive: 1.5 });
  puff(v, t + 0.01, 0.12 * k, 0.06, 220, { kind: 'brown' });
  hiss(v, t + 0.004, [[0, 0], [0.001, 0.06 * k], [0.005, 0.0001, 'e']]);
  for (const [dt, f] of [[0.07, 2400], [0.13, 2100]] as const) v.tone('sine', [[0, f], [0.02, f * 0.68, 'e']], { t: t + dt, g: perc(0.03 * k, 0.025) });
}

const CHARGE_D = 1.6;
/** The charge: the rattle speeds up from 14 clicks/s to 1/P over 0.5 s and holds, over a faint gurgle. */
function charge(v: Voice, P: number): void {
  rattle(v, 0, rattleTimes(CHARGE_D, 1 / 14, P, 0.5), 0.22);
  gurgle(v, 0, 55, [[0, 0], [0.15, 0.08], [CHARGE_D - 0.1, 0.08], [CHARGE_D, 0.0001, 'e']], CHARGE_D, 40);
  hiss(v, 0, [[0, 0], [0.5, 0.02], [CHARGE_D - 0.1, 0.035], [CHARGE_D, 0.0001, 'e']]);
}

export const V3_VENOM_RECIPES = {
  /** `roar` (the cut-in's eye flare): the sac gurgle + sub, the static hiss, the fixed rattle. */
  venomRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.3,
    duck: 0.65,
    play(v) {
      gurgle(v, 0, [[0, 52], [0.15, 58, 'e'], [1.0, 50, 'e']], [[0, 0], [0.06, 0.5], [0.8, 0.4], [1.1, 0.0001, 'e']], 1.1);
      thump(v, 0, 70, 38, 0.5, 0.25);
      hiss(v, 0.04, [[0, 0], [0.08, 0.24], [0.7, 0.18], [1.0, 0.0001, 'e']]);
      rattle(v, 0.05, rattleTimes(0.95, 1 / 26, 1 / 26), 0.28, 0.5);
    },
  },
  /** `arrive` (sustained; stopped on `land`): the gas rolls in — a hiss swell, a dense fizz, a low boil, blups. */
  venomArrive: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      hiss(v, 0, [[0, 0.0001], [1.6, 0.06, 'e'], [1.9, 0.0001, 'e']]);
      v.crackle({ d: 1.6, n: 200, g: 0.03, f: 7000, q: 0.8, dec: 0.004 });
      v.noise('brown', { g: [[0, 0], [0.3, 0.12], [1.6, 0.12], [1.9, 0.0001, 'e']], to: v.filt('lowpass', 160, 0.8) });
      for (const t of [0.12, 0.38, 0.55, 0.81, 1.07, 1.36]) v.tone('sine', [[0, 90], [0.04, 140, 'e']], { t, g: perc(0.12, 0.05) });
    },
  },
  /** `land`: the knuckles slam (summon f4). */
  venomLand: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      knuckles(v, 0, 1);
    },
  },
  /** Summon f6: the gas spirals into the mouth — a reverse hiss (swell, hard cut) + the sac rising. */
  venomInhale: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      hiss(v, 0, [[0, 0.0001], [0.2, 0.03, 'e'], [0.32, 0.11, 'e'], [0.335, 0.0001, 'e']]);
      v.tone('sine', [[0, 55], [0.3, 82, 'e']], { g: [[0, 0], [0.05, 0.2], [0.3, 0.2], [0.36, 0.0001, 'e']] });
    },
  },
  /** `charge` (sustained, stopped on `release`): power 2 — the rattle ends at 26 clicks/s. */
  venomCharge: { cap: 2, gap: 0.05, verb: 0.15, duck: 0.25, play: (v) => charge(v, 1 / 26) },
  /** power 1: the rattle ends at 22 clicks/s. */
  venomChargeLight: { cap: 2, gap: 0.05, verb: 0.15, duck: 0.25, play: (v) => charge(v, 1 / 22) },
  /** power 3: the rattle ends at 30 clicks/s. */
  venomChargeHeavy: { cap: 2, gap: 0.05, verb: 0.15, duck: 0.25, play: (v) => charge(v, 1 / 30) },
  /** The wind-up swells (attack f2 / f3 / f4, pitch 1 / 1.12 / 1.26): a sac "glug" + a high bubble tick. */
  venomSwell: {
    cap: 3,
    gap: 0.03,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      v.tone('sine', [[0, 70], [0.05, 52, 'e']], { g: perc(0.3, 0.12) });
      v.tone('sine', [[0, 2400], [0.02, 3000, 'e']], { g: perc(0.04, 0.02) });
    },
  },
  /** `swing` (attack f5): a FALLING high band masked by a crack (the only sweep the card has). */
  venomWhip: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.09, [6800, 4200, 2400], 0.28, { kind: 'white', q: 1.1, peakAt: 0.3, pan: [-0.2, 0.2] });
      crack(v, 0.075, 0.12, { hp: 2500, lp: 8000, n: 2 });
    },
  },
  /** `release`: the sub mouth-pop, a wet hiss burst and the glob's wobbling whir (sub-band, 11 Hz). */
  venomSpit: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    duck: 0.3,
    play(v) {
      v.tone('sine', [[0, 180], [0.015, 70, 'e']], { g: perc(0.35, 0.06) });
      hiss(v, 0, [[0, 0], [0.002, 0.12], [0.012, 0.0001, 'e']]);
      const w = v.tone('sine', [[0, 120], [0.28, 96, 'e']], { g: [[0, 0], [0.02, 0.14], [0.22, 0.1], [0.28, 0.0001, 'e']] });
      v.lfo(w.amp.gain, 11, 0.07, { d: 0.28 });
      const h = v.amp(0.5);
      v.noise('white', { g: [[0, 0], [0.02, 0.03], [0.24, 0.02], [0.28, 0.0001, 'e']], to: v.filt('highpass', 5500, 0.7, { to: h }) });
      v.lfo(h.gain, 11, 0.45, { d: 0.28 });
    },
  },
  /** `impact`: the splat — its body ends at 0.12 s: the held breath (the hard duck is the exception, §6). */
  venomSplat: {
    cap: 2,
    gap: 0.05,
    verb: 0.15,
    duck: 0.9,
    play(v) {
      splat(v, 0, 1);
    },
  },
  /** One hole step (× 3, and the death f4–f6): dry and close, a tiny fizz-pop. */
  venomEat: {
    cap: 4,
    gap: 0.03,
    verb: 0,
    duck: 0.1,
    play(v) {
      v.crackle({ d: 0.06, n: 9, g: 0.07, f: 6500, q: 1, dec: 0.003 });
      v.tone('sine', [[0, 3200], [0.01, 2200, 'e']], { g: perc(0.04, 0.012) });
    },
  },
  /** The third eat tick: the acid steams (a static hiss 0 → 0.1 → 0 with a back-loaded dense fizz). */
  venomSteam: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    duck: 0.25,
    play(v) {
      hiss(v, 0, [[0, 0], [0.12, 0.1], [0.5, 0.0001, 'e']]);
      v.crackle({ d: 0.5, n: 60, g: 0.04, f: 7000, q: 0.8, dec: 0.004, curve: 1.6 });
    },
  },
  /** Blocked: the acid fizzes on the guard (no eat ticks). */
  venomFizz: {
    cap: 2,
    gap: 0.1,
    verb: 0.2,
    duck: 0.25,
    play(v) {
      hiss(v, 0, [[0, 0], [0.04, 0.09], [0.4, 0.0001, 'e']]);
      v.crackle({ d: 0.4, n: 50, g: 0.045, f: 7000, q: 0.8, dec: 0.004, curve: 1.3 });
      v.tone('sine', [[0, 90], [0.04, 130, 'e']], { t: 0.05, g: perc(0.1, 0.05) });
    },
  },
  /** Attack f9: the stinger rattles once it has thrown (a short fixed train fading out). */
  venomRattle: {
    cap: 2,
    gap: 0.1,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      rattle(v, 0, rattleTimes(0.25, 1 / 26, 1 / 26), 0.2, 0.7);
    },
  },
  /** The leitmotif "tıp→tsss" (drops, "the scar remembers", the death's last beat). */
  venomDrip: {
    cap: 5,
    gap: 0.03,
    verb: 0.2,
    duck: 0.1,
    play(v) {
      drip(v, 0, 1);
    },
  },
  /** The summon finale (the etch ring): a sub settle, a long etch fizz, a hiss decay, a sour low dyad. */
  venomScar: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      puff(v, 0, 0.2, 0.5, 240, { kind: 'brown' });
      v.crackle({ d: 0.7, n: 90, g: 0.04, f: 6500, q: 0.9, dec: 0.004, curve: 1.2 });
      hiss(v, 0, [[0, 0], [0.03, 0.08], [0.7, 0.0001, 'e']]);
      thump(v, 0, 90, 50, 0.3, 0.12);
      v.tone('sine', 55, { g: [[0, 0], [0.03, 0.06], [0.6, 0.0001, 'e']] });
      v.tone('sine', 58.27, { g: [[0, 0], [0.03, 0.05], [0.6, 0.0001, 'e']] });
    },
  },
  /** `deathStart`: a wet rip in the high band + a gurgle drop. */
  venomTear: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      v.crackle({ d: 0.18, n: 40, f: 5000, q: 2, g: 0.12, dec: 0.004 });
      hiss(v, 0, [[0, 0], [0.01, 0.06], [0.18, 0.0001, 'e']]);
      v.tone('sine', [[0, 82], [0.2, 46, 'e']], { g: [[0, 0], [0.01, 0.35], [0.25, 0.0001, 'e']] });
    },
  },
  /** `dissolve`: the low boil and gurgle (no fizz: the eat ticks over it stay dry). */
  venomMelt: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      v.noise('brown', { g: [[0, 0.0001], [0.6, 0.22, 'e'], [0.75, 0.18], [1.0, 0.0001, 'e']], to: v.filt('lowpass', 180, 0.8) });
      for (let i = 0; i < 9; i++) {
        const t = 0.05 + i * 0.09 + v.r(-0.02, 0.02);
        const f = 70 + v.r(0, 40);
        v.tone('sine', [[0, f], [0.05, f * 1.4, 'e']], { t, g: perc(0.12 + i * 0.012, 0.05) });
      }
      drone(v, 0, 0.6, 55, 0.08, { lp: [120, 200, 120], att: 0.2 });
    },
  },
  /** Death f8: the lace slumps into the pool — a wet collapse. */
  venomSlump: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      const lp = v.filt('lowpass', 150, 0.8);
      v.noise('brown', { g: perc(0.5, 0.09, 0.003), to: lp });
      v.noise('brown', { t: 0.02, g: perc(0.25, 0.06, 0.003), to: lp });
      thump(v, 0, 90, 45, 0.3, 0.12);
      v.bursts([0.002], [0.16], { dec: 0.008, f: 3000, q: 2, kind: 'white' });
    },
  },
  /** Death f10: the stinger marker — a dry chitin "tık" + the last four rattle clicks. */
  venomMarker: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      v.bursts([0], [0.3], { dec: 0.01, f: 3600, q: 4 });
      rattle(v, 0.05, rattleTimes(0.16, 1 / 26, 1 / 26), 0.12, 0.6);
    },
  },
  /** `burst`: the puddle — an etch sizzle + a static hiss decay + a sub settle. */
  venomPuddle: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.55,
    play(v) {
      v.crackle({ d: 0.5, n: 70, g: 0.05, f: 6500, q: 0.9, dec: 0.004, curve: 1.2 });
      hiss(v, 0, [[0, 0], [0.02, 0.08], [0.9, 0.0001, 'e']]);
      thump(v, 0, 70, 40, 0.2, 0.2);
      for (const t of [0.18, 0.37, 0.6]) v.tone('sine', [[0, 85], [0.04, 125, 'e']], { t, g: perc(0.09, 0.05) });
    },
  },
  /**
   * `reviveGather` (soul_recall starts it with the revive pose's f0, stops it on `land`): timed to the pose
   * (scene ms × V3_TEMPO 1.35): the glob wobbles (0–0.12 s), a drip tick at f1 (0.12 s), the splat at f2's
   * start (0.19 s), then the fizz of re-forming over a rising hiss bed.
   */
  venomReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      gurgle(v, 0, [[0, 46], [0.19, 55, 'e']], [[0, 0], [0.03, 0.12], [0.17, 0.1], [0.2, 0.0001, 'e']], 1.0, 40);
      hiss(v, 0, [[0, 0], [0.05, 0.05], [0.18, 0.04], [0.2, 0.0001, 'e']]);
      v.tone('sine', [[0, 2400], [0.02, 1800, 'e']], { t: 0.12, g: perc(0.05, 0.03) });
      splat(v, 0.19, 0.7);
      v.crackle({ t: 0.25, d: 0.75, n: 90, g: 0.04, f: 7000, q: 0.8, dec: 0.004, curve: 0.8 });
      hiss(v, 0.25, [[0, 0.0001], [0.75, 0.12, 'e'], [0.85, 0.0001, 'e']]);
      gurgle(v, 0.3, [[0, 50], [0.7, 58, 'e']], [[0, 0], [0.2, 0.1], [0.7, 0.14], [0.8, 0.0001, 'e']], 0.8, 40);
    },
  },
  /** `reviveLand`: the knuckles + a short rattle (it is armed again). */
  venomReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      knuckles(v, 0, 1);
      rattle(v, 0.05, rattleTimes(0.2, 1 / 26, 1 / 26), 0.18, 0.5);
    },
  },
} satisfies Record<string, Recipe>;

export type VenomSfxName = keyof typeof V3_VENOM_RECIPES;

/** The sustained sounds (the cinematic ends them with sfx.start(...).stop()). */
export const V3_VENOM_SUSTAINED: readonly VenomSfxName[] = ['venomArrive', 'venomCharge', 'venomChargeLight', 'venomChargeHeavy', 'venomReviveGather'];
