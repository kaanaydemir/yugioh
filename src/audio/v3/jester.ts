// Kadran Soytarısı (dial_jester, lane D, C2) — the clockwork jester's own sound set (?look=v3 only;
// YENI_KARTLAR §C2 SFX, §5.1). src/audio/sounds.ts spreads V3_JESTER_RECIPES and SfxName gains JesterSfxName.
//
// Identity (§5.1 C2): the 3.2 kHz TICK / 2.6 kHz TOCK of a pocket watch, a struck BRASS COIN (FM partials at
// 1 : 1.5 : 2.3 : 3.8 around 3 kHz — thin, bright, long, "çın"), a coil SPRING ("boing": a triangle whose pitch
// wobbles in a damped 16–19 Hz vibrato), the key's RATCHET ("cırt": pawl clicks through a narrow 4 kHz band) and
// the REWINDING clock (reversed ticks that accelerate + a rising tape chirp). Never sand (hourglass_imp's), never
// a glass shatter (crystal / R2), no low drone: the jester is small, bright and mechanical. Every beat is short.
//
//   arrive  jesterDialRewind     the floor dial's hands race BACK to midnight (accelerating reversed ratchet)
//           jesterMidnight       midnight: glassBell 880 + 1320 over a brass clock dong
//   land    jesterPop            the cuckoo pop: a big spring boing, a cork pop, the coin jingles
//           jesterBounce         one damped bounce (played three times, softer and higher each time)
//           jesterBow            the bow: tick-tock and a little coin "ting"
//   roar    jesterRoar           "ta-da": ratchet run, hands snap to 12 with a bright chord, boing
//   effect  jesterActivate       the coin presented: two key cranks, the dial whirls up, a chime
//   charge  jesterCharge         the wind-up: the watch ticks faster and faster over a straining spring (sustained → contact)
//           jesterCrank          one turn of the key: "cırt" (×3 on the attack's wind frames)
//   swing   jesterSpring         the spring lets go: launch boing + air
//   release jesterFlip           the somersault: a looping whoosh
//   impact  jesterCoinEdge       the coin's edge strikes: "ÇIN" (the ticking stops dead under it: the freeze)
//           jesterBlocked        the edge glances off a guard: dull brass clank + wobbling ring
//           jesterLandBack       it springs back home: small boing + tock
//   deathStart jesterCrack       the dial glass cracks
//   dissolve   jesterSprings     springs burst out of the dial (two detuned boings + clank)
//   afterDissolve jesterGear     a cog drops and rolls away (rolling clicks)
//           jesterLastTick       the very last tick — and silence
//   burst   jesterBurst          the brass crumbles: tiny pings and a soft clatter
//   reviveGather jesterReviveGather  reversed ticks speeding up (sustained → land)
//   reviveLand   jesterReviveLand    the key wound once, the dial dings
//   coin    jesterFlick          the thumb flick: a bright "ping"
//           jesterSpin           the coin spinning in the air: a whirring flutter (sustained → landing)
//           jesterHandsRace      the arena dial's hands race (fast ratchet, sustained → result)
//           jesterTin1 / 2       the two landings: "tın" (3.1 kHz), "tın" (2.9 kHz)
//           jesterWobble         the coin settles on its edge (Euler's disk rattle, accelerating)
//           jesterReveal         the face shows: one hard tick
//           jesterWin            right call: the hands strike 12 — major chime arpeggio
//           jesterLose           wrong call: falling tritone bells
//           jesterRewind         the targets rewind: a reversed tape chirp accelerating up (+ reversed ticks)
//           jesterFold           a body folds into its card: "fwip-tak"
//           jesterCardWhirl      the card spins away along the clock hand
//           jesterLpHit          lose: the cards slam the own LP panel (brass thunk + tick spray)
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { crack, glassBell, puff, scaled, sweep, thump } from './kit';

const TICK = 3200;
const TOCK = 2600;

/** One watch tick: a short sine at `f` with an inharmonic overtone and a 3-ms click. */
function tick(v: Voice, t: number, g: number, f = TICK): void {
  v.tone('sine', f, { t, g: perc(g, 0.022, 0.0004) });
  v.tone('sine', f * 2.71, { t, g: perc(g * 0.3, 0.009, 0.0003) });
  v.noise('white', { t, g: perc(g * 0.9, 0.003, 0.0002), to: v.filt('bandpass', f * 1.35, 2.2) });
}

/** A REVERSED tick (swells and stops dead) — the rewinding clock. */
function revTick(v: Voice, t: number, g: number, f = TICK, len = 0.03): void {
  const env: Pt[] = [[0, 0.0001], [len, g, 'e'], [len + 0.002, 0.0001, 'e']];
  v.tone('sine', f, { t, g: env });
  v.tone('sine', f * 2.71, { t, g: scaled(env, 0.3) });
}

/** The struck brass coin: FM carrier + inharmonic partials + a tiny click; `f` ≈ 3 kHz. */
function coin(v: Voice, t: number, f: number, g: number, dec: number, o: { click?: number } = {}): void {
  v.bell(f, { t, g, dec, ratio: 1.505, index: 1.1, idxDec: 0.04 });
  v.tone('sine', f * 2.32, { t, g: perc(g * 0.45, dec * 0.55, 0.0005) });
  v.tone('sine', f * 3.83, { t, g: perc(g * 0.18, dec * 0.3, 0.0005) });
  v.tone('sine', f * 0.5, { t, g: perc(g * 0.22, dec * 0.4, 0.001) });
  v.noise('white', { t, g: perc(g * (o.click ?? 1.2), 0.004, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 2), 1.5) });
}

/** A coil spring "boing": a triangle at f0 whose pitch wobbles in a damped vibrato, sliding down a little. */
function boing(v: Voice, t: number, f0: number, g: number, d: number, o: { rate?: number; depth?: number; bend?: number } = {}): void {
  const f: Pt[] = [[0, f0 * (o.bend ?? 1.35)], [0.05, f0, 'e'], [d, f0 * 0.9, 'e']];
  const env: Pt[] = [[0, 0], [0.006, g], [d * 0.4, g * 0.5], [d, 0.0001, 'e']];
  const lp = v.filt('lowpass', [[0, 3200], [d, 900, 'e']], 1.2, { t });
  const o1 = v.tone('triangle', f, { t, g: env, to: lp });
  v.lfo(o1.osc.frequency, o.rate ?? 17, [[0, f0 * (o.depth ?? 0.22)], [d, 0.5, 'e']], { t, d });
  const o2 = v.tone('sine', f, { t, g: scaled(env, 0.5), detune: 7 });
  v.lfo(o2.osc.frequency, (o.rate ?? 17) * 1.03, [[0, f0 * (o.depth ?? 0.22)], [d, 0.5, 'e']], { t, d });
  // the coil's metallic shimmer on the attack
  v.tone('sine', f0 * 7.3, { t, g: perc(g * 0.12, 0.08, 0.001) });
}

/** The key's ratchet: `n` pawl clicks at `rate` Hz through a narrow band at `f`. */
function ratchet(v: Voice, t: number, n: number, rate: number | ((i: number) => number), g: number, o: { f?: number; q?: number; rise?: number } = {}): number {
  const times: number[] = [];
  const gains: number[] = [];
  let x = 0;
  for (let i = 0; i < n; i++) {
    times.push(x);
    gains.push(g * (0.75 + 0.25 * v.rnd()) * (1 + (o.rise ?? 0) * (i / Math.max(1, n - 1))));
    x += 1 / (typeof rate === 'number' ? rate : rate(i));
  }
  v.bursts(times, gains, { t, dec: 0.006, f: o.f ?? 4200, q: o.q ?? 4 });
  return x;
}

/** A brass clock dong (low, inharmonic, short sustain) — the big clock under the bells. */
function dong(v: Voice, t: number, f: number, g: number, dec: number): void {
  v.bell(f, { t, g, dec, ratio: 2.76, index: 1.6, idxDec: dec * 0.15 });
  v.tone('sine', f * 2.02, { t, g: perc(g * 0.35, dec * 0.6, 0.002) });
  v.tone('sine', f * 0.5, { t, g: perc(g * 0.4, dec * 0.8, 0.004) });
}

export const V3_JESTER_RECIPES = {
  // ================================================================ summon
  /** The floor dial's hands race BACK to midnight: an accelerating reversed ratchet over a rising whirr. */
  jesterDialRewind: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const D = 0.42;
      const n = 26;
      for (let i = 0; i < n; i++) {
        const k = i / n;
        const t = D * (1 - Math.pow(1 - k, 1.8));
        revTick(v, t, 0.07 + 0.06 * k, i % 2 ? TOCK : TICK, 0.018);
      }
      sweep(v, 0, D, [900, 2400, 4800], 0.08, { q: 3, peakAt: 0.95, pan: [0.4, -0.4] });
    },
  },
  /** Midnight: the bell (glassBell 880 + 1320) over a brass clock dong, the hands click home. */
  jesterMidnight: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.55,
    play(v) {
      tick(v, 0, 0.22, TICK);
      dong(v, 0.004, 220, 0.22, 1.3);
      glassBell(v, 880, 0.006, 0.16, 1.4, { modes: 3 });
      glassBell(v, 1320, 0.012, 0.11, 1.2, { modes: 3 });
      glassBell(v, 1760, 0.02, 0.05, 0.8, { modes: 2 });
    },
  },
  /** The cuckoo pop ('land'): a big spring boing, a cork pop, the coin jingles. */
  jesterPop: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      // cork pop
      thump(v, 0, 900, 260, 0.3, 0.05);
      v.noise('white', { g: perc(0.25, 0.012, 0.0005), to: v.filt('bandpass', 1500, 1.4) });
      boing(v, 0.008, 230, 0.34, 0.75, { rate: 16, depth: 0.28, bend: 1.6 });
      coin(v, 0.05, 3100, 0.07, 0.45);
      coin(v, 0.11, 3420, 0.045, 0.35);
      tick(v, 0.16, 0.08, TOCK);
    },
  },
  /** One damped bounce of the spring (the entrance plays three, softer and higher each time via volume / pitch). */
  jesterBounce: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      boing(v, 0, 300, 0.2, 0.32, { rate: 19, depth: 0.16, bend: 1.25 });
      tick(v, 0, 0.07, TICK);
    },
  },
  /** The bow: tick-tock and a small coin "ting" — the toy's flourish. */
  jesterBow: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.2,
    play(v) {
      tick(v, 0, 0.12, TICK);
      tick(v, 0.13, 0.1, TOCK);
      coin(v, 0.24, 3600, 0.08, 0.7, { click: 0.6 });
    },
  },
  /** "Ta-da": a ratchet run, the hands snap to 12 with a bright major chord, a spring boing. */
  jesterRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      const run = ratchet(v, 0, 12, (i) => 26 + i * 4, 0.16, { rise: 0.6 });
      const t = run + 0.02;
      tick(v, t, 0.2, TICK);
      for (const [m, dt, g] of [[84, 0, 0.09], [88, 0.03, 0.07], [91, 0.06, 0.065], [96, 0.09, 0.05]] as const) coin(v, t + dt, midiHz(m), g, 0.9, { click: 0.4 });
      boing(v, t + 0.02, 260, 0.2, 0.5);
    },
  },
  /** The effect: the coin presented — two key cranks, the dial whirls up, a chime: "watch this". */
  jesterActivate: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      ratchet(v, 0, 6, 34, 0.14);
      ratchet(v, 0.2, 6, 38, 0.15);
      const t = 0.42;
      for (let i = 0; i < 10; i++) tick(v, t + i * 0.035 * (1 - i * 0.05), 0.05 + i * 0.008, i % 2 ? TOCK : TICK);
      sweep(v, t, 0.36, [1200, 3000, 5200], 0.06, { q: 3, peakAt: 0.9 });
      coin(v, t + 0.36, 3100, 0.12, 1.1);
      glassBell(v, 1320, t + 0.37, 0.06, 0.9, { modes: 2 });
    },
  },
  // ================================================================ strike "Kurmalı Takla"
  /** One turn of the wind-up key: "cırt" — pawl clicks + a short creak of the mainspring. */
  jesterCrank: {
    cap: 3,
    gap: 0.04,
    verb: 0.2,
    duck: 0.15,
    vary: 0.03,
    play(v) {
      ratchet(v, 0, 7, 42, 0.2, { rise: 0.4 });
      v.tone('sawtooth', [[0, 140], [0.16, 175, 'e']], { g: [[0, 0], [0.02, 0.03], [0.16, 0.0001, 'e']], to: v.filt('bandpass', 1100, 5) });
    },
  },
  /** The wind-up (declaration → contact): the watch ticks faster and faster over a straining spring. Stopped on contact. */
  jesterCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      const D = 2.6;
      let t = 0;
      let i = 0;
      while (t < D) {
        const k = t / D;
        tick(v, t, 0.07 + 0.05 * k, i % 2 ? TOCK : TICK);
        t += Math.max(0.055, 0.2 * (1 - k * 1.2));
        i++;
      }
      // the mainspring straining: a creaking narrow-band saw rising slowly
      const bp = v.filt('bandpass', [[0, 600], [D, 1500, 'e']], 6);
      const fl = v.flutter(11, 0.4, { d: D, base: 0.6, to: bp });
      v.tone('sawtooth', [[0, 95], [D, 140, 'e']], { g: [[0, 0], [0.4, 0.05], [D - 0.1, 0.08], [D, 0.0001, 'e']], to: fl });
    },
  },
  /** The spring lets go: a launch boing and the air. */
  jesterSpring: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      boing(v, 0, 180, 0.3, 0.45, { rate: 15, depth: 0.3, bend: 1.8 });
      sweep(v, 0.02, 0.28, [500, 1800, 900], 0.12, { kind: 'pink', q: 1.2, peakAt: 0.4 });
    },
  },
  /** The somersault: a looping whoosh (two lobes, the body over the top). */
  jesterFlip: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.25,
    play(v) {
      sweep(v, 0, 0.16, [700, 2600, 1200], 0.12, { q: 1.6, peakAt: 0.55, pan: [-0.2, 0.2] });
      sweep(v, 0.11, 0.16, [900, 3200, 1400], 0.1, { q: 1.6, peakAt: 0.55, pan: [0.2, -0.1] });
      coin(v, 0.12, 4200, 0.02, 0.18, { click: 0.2 });
    },
  },
  /** The coin's edge strikes: "ÇIN" — a hard bright brass hit, a clipped click, a short body knock. */
  jesterCoinEdge: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      coin(v, 0, 3100, 0.2, 1.3, { click: 1.8 });
      coin(v, 0.002, 1555, 0.08, 0.6, { click: 0 });
      crack(v, 0, 0.18, { hp: 3500, lp: 11000, n: 1 });
      thump(v, 0, 340, 120, 0.3, 0.08);
    },
  },
  /** Blocked: the coin glances off the guard — dull clank, a wobbling ring that dies, a spring rebound. */
  jesterBlocked: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      thump(v, 0, 260, 110, 0.28, 0.1);
      const c = v.bell(2300, { g: 0.1, dec: 0.6, ratio: 1.505, index: 0.8, idxDec: 0.05 });
      v.lfo(c.amp.gain, 9, [[0, 0.06], [0.6, 0.0001, 'e']], { d: 0.6 });
      boing(v, 0.05, 210, 0.16, 0.35, { rate: 21, depth: 0.2, bend: 1.2 });
    },
  },
  /** It springs back home: a small boing and a tock. */
  jesterLandBack: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.15,
    play(v) {
      boing(v, 0, 340, 0.13, 0.25, { rate: 20, depth: 0.12, bend: 1.2 });
      tick(v, 0, 0.09, TOCK);
      puff(v, 0, 0.05, 0.06, 900);
    },
  },
  // ================================================================ death
  /** The dial glass cracks (thin, short — a watch crystal, not a crystal monster). */
  jesterCrack: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      crack(v, 0, 0.22, { hp: 4500, n: 3, gap: 0.014, dec: 0.008 });
      v.tone('sine', 5200, { t: 0.006, g: perc(0.035, 0.12, 0.0005) });
      tick(v, 0.04, 0.06, TOCK);
    },
  },
  /** Springs burst out of the dial: two detuned boings flying apart + a release clank. */
  jesterSprings: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      const L = v.panner(-0.45);
      const R = v.panner(0.45);
      thump(v, 0, 500, 160, 0.22, 0.05);
      v.bell(1900, { g: 0.08, dec: 0.25, ratio: 1.41, index: 2, idxDec: 0.04 });
      const make = (to: AudioNode, t: number, f: number) => {
        const env: Pt[] = [[0, 0], [0.005, 0.2], [0.55, 0.0001, 'e']];
        const o = v.tone('triangle', [[0, f * 1.6], [0.06, f, 'e'], [0.55, f * 0.7, 'e']], { t, g: env, to });
        v.lfo(o.osc.frequency, 15, [[0, f * 0.3], [0.55, 0.5, 'e']], { t, d: 0.55 });
      };
      make(L, 0.01, 240);
      make(R, 0.05, 330);
    },
  },
  /** A cog drops on the marble and rolls away: a clink, then rolling clicks slowing down. */
  jesterGear: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    vary: 0.06,
    play(v) {
      coin(v, 0, 2450, 0.06, 0.25, { click: 0.9 });
      const times: number[] = [];
      const gains: number[] = [];
      let t = 0.05;
      for (let i = 0; i < 12; i++) {
        times.push(t);
        gains.push(0.09 * (1 - i / 13));
        t += 0.028 + i * 0.006;
      }
      v.bursts(times, gains, { dec: 0.005, f: 3600, q: 3 });
    },
  },
  /** The very last tick: one tick, a held breath of its overtone — then nothing. */
  jesterLastTick: {
    cap: 1,
    gap: 0.2,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      tick(v, 0, 0.2, TICK);
      v.tone('sine', TICK, { t: 0.002, g: perc(0.025, 0.6, 0.002) });
    },
  },
  /** The brass crumbles: a fine rain of tiny pings and a soft clatter. */
  jesterBurst: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      puff(v, 0, 0.14, 0.18, 2200, { kind: 'white' });
      v.crackle({ d: 0.45, n: 26, g: 0.12, f: 5200, q: 2, curve: 1.5, dec: 0.004 });
      for (let i = 0; i < 9; i++) coin(v, v.r(0, 0.4), v.r(3800, 6200), v.r(0.012, 0.03), v.r(0.08, 0.2), { click: 0.3 });
    },
  },
  /** Revive: reversed ticks speeding up, the spring tightening (stopped on 'land'). */
  jesterReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 1.4;
      let t = 0;
      let i = 0;
      while (t < D) {
        revTick(v, t, 0.04 + 0.08 * (t / D), i % 2 ? TOCK : TICK, 0.025);
        t += Math.max(0.04, 0.16 * (1 - t / D));
        i++;
      }
      sweep(v, 0, D, [600, 1800, 4200], 0.07, { q: 3, peakAt: 0.97 });
    },
  },
  /** Revive 'land': the key wound once, the dial dings. */
  jesterReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.5,
    play(v) {
      ratchet(v, 0, 6, 40, 0.15);
      tick(v, 0.15, 0.18);
      coin(v, 0.16, 3100, 0.1, 0.9);
      glassBell(v, 1320, 0.17, 0.05, 0.8, { modes: 2 });
    },
  },
  // ================================================================ the coin toss (İmza an)
  /** The thumb flick: a bright brass "ping" with a nail click. */
  jesterFlick: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      v.noise('white', { g: perc(0.25, 0.003, 0.0002), to: v.filt('bandpass', 5200, 2) });
      coin(v, 0.002, 3600, 0.16, 0.7, { click: 0.6 });
      v.tone('sine', [[0, 3600], [0.3, 3900, 'e']], { t: 0.002, g: perc(0.03, 0.3, 0.002) });
    },
  },
  /** The coin spinning in the air: a whirring brass flutter (edge-face-edge) — stopped on the first landing. */
  jesterSpin: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 2.4;
      const bp = v.filt('bandpass', [[0, 2600], [0.5, 3300, 'e'], [D, 2900, 'e']], 5);
      const am = v.ring([[0, 22], [0.4, 30], [D, 14, 'e']], { d: D + 0.05, mix: 0.85, to: bp, w: 'triangle' });
      v.noise('white', { g: [[0, 0], [0.06, 0.28], [D * 0.6, 0.22], [D, 0.0001, 'e']], to: am });
      const t = v.tone('sine', [[0, 3100], [D, 2950, 'e']], { g: [[0, 0], [0.05, 0.03], [D, 0.0001, 'e']] });
      v.lfo(t.amp.gain, [[0, 22], [D, 14, 'e']], 0.025, { d: D });
    },
  },
  /** The arena dial's hands race round (fast steady ratchet + whirr) — stopped on the result. */
  jesterHandsRace: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const D = 2.4;
      ratchet(v, 0, 70, (i) => 22 + Math.min(14, i * 0.5), 0.05, { f: 3800, q: 3 });
      sweep(v, 0, D, [400, 900, 700], 0.03, { kind: 'pink', q: 2, peakAt: 0.3 });
    },
  },
  /** First landing: "tın" (3.1 kHz). */
  jesterTin1: {
    cap: 1,
    gap: 0.05,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      coin(v, 0, 3100, 0.17, 0.9, { click: 1.4 });
      thump(v, 0, 420, 180, 0.12, 0.04);
    },
  },
  /** Second landing: "tın" (2.9 kHz, softer). */
  jesterTin2: {
    cap: 1,
    gap: 0.05,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      coin(v, 0, 2900, 0.12, 0.8, { click: 1 });
      thump(v, 0, 380, 170, 0.08, 0.035);
    },
  },
  /** The coin settles on its rim: Euler's-disk rattle, faster and faster, then still. */
  jesterWobble: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const times: number[] = [];
      const gains: number[] = [];
      let t = 0;
      let i = 0;
      while (t < 0.55) {
        times.push(t);
        gains.push(0.11 * (1 - t / 0.7));
        t += Math.max(0.012, 0.075 * (1 - t / 0.6));
        i++;
      }
      v.bursts(times, gains, { dec: 0.008, f: 3000, q: 5 });
      v.tone('sine', [[0, 2950], [0.6, 3080, 'e']], { g: [[0, 0.03], [0.6, 0.0001, 'e']] });
      void i;
    },
  },
  /** The face shows: one hard tick. */
  jesterReveal: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      tick(v, 0, 0.26, TICK);
      v.tone('sine', TICK / 2, { g: perc(0.05, 0.25, 0.001) });
    },
  },
  /** Right call: the hands strike 12 — a brass dong and a rising major chime arpeggio (C E G C E). */
  jesterWin: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.65,
    play(v) {
      dong(v, 0, 262, 0.2, 1.4);
      tick(v, 0, 0.18, TICK);
      const notes = [84, 88, 91, 96, 100];
      notes.forEach((m, i) => {
        const t = 0.06 + i * 0.075;
        glassBell(v, midiHz(m), t, 0.085 - i * 0.008, 1.1 - i * 0.1, { modes: 2 });
        coin(v, t, midiHz(m) * 2, 0.025, 0.4, { click: 0.2 });
      });
    },
  },
  /** Wrong call: falling bells on a tritone (C6 → F#5 → C5 → F#4), the clock stumbles. */
  jesterLose: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.65,
    play(v) {
      tick(v, 0, 0.16, TOCK);
      const notes = [84, 78, 72, 66];
      notes.forEach((m, i) => {
        const t = 0.05 + i * 0.12;
        glassBell(v, midiHz(m), t, 0.09 - i * 0.008, 1.2, { modes: 3, detune: -12 * i });
        dong(v, t, midiHz(m - 24), 0.05, 0.6);
      });
    },
  },
  /** The rewind: a tape played backwards — reversed ticks accelerating and a rising chirp with a warble. */
  jesterRewind: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      const D = 1.1;
      let t = 0;
      let i = 0;
      while (t < D) {
        revTick(v, t, 0.04 + 0.07 * (t / D), i % 2 ? TOCK : TICK, 0.02);
        t += Math.max(0.022, 0.11 * (1 - t / D) * (1 - t / D));
        i++;
      }
      // the chirp: a squealing sine sweeping up with a fast warble (the tape's speed)
      const s = v.tone('sine', [[0, 500], [D * 0.8, 2600, 'e'], [D, 3600, 'e']], { g: [[0, 0], [0.15, 0.05], [D * 0.9, 0.07], [D, 0.0001, 'e']] });
      v.lfo(s.osc.frequency, [[0, 9], [D, 26, 'e']], [[0, 60], [D, 260, 'e']], { d: D });
      const s2 = v.tone('triangle', [[0, 250], [D * 0.8, 1300, 'e'], [D, 1800, 'e']], { g: [[0, 0], [0.15, 0.04], [D, 0.0001, 'e']], to: v.filt('lowpass', 2500, 1) });
      v.lfo(s2.osc.frequency, [[0, 9], [D, 26, 'e']], [[0, 30], [D, 120, 'e']], { d: D });
      sweep(v, 0, D, [800, 2600, 6000], 0.05, { q: 2, peakAt: 0.97, pan: [-0.3, 0.3] });
    },
  },
  /** A body folds into its card: "fwip-tak". */
  jesterFold: {
    cap: 3,
    gap: 0.04,
    verb: 0.3,
    duck: 0.2,
    vary: 0.05,
    play(v) {
      sweep(v, 0, 0.12, [3000, 1500, 700], 0.12, { q: 1.6, peakAt: 0.4 });
      tick(v, 0.12, 0.13, TOCK);
      v.noise('white', { t: 0.12, g: perc(0.12, 0.012, 0.0004), to: v.filt('bandpass', 1600, 1.2) });
    },
  },
  /** The card spins away along the clock hand: a fine fluttering whir with a tick at each half turn. */
  jesterCardWhirl: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    duck: 0.15,
    vary: 0.05,
    play(v) {
      const D = 0.45;
      const bp = v.filt('bandpass', [[0, 1400], [D, 2600, 'e']], 2.5);
      const am = v.ring([[0, 16], [D, 24, 'e']], { d: D, mix: 0.8, to: bp });
      v.noise('white', { g: [[0, 0], [0.04, 0.1], [D, 0.0001, 'e']], to: am });
      for (let i = 0; i < 4; i++) revTick(v, i * 0.1, 0.035, TICK, 0.015);
    },
  },
  /** Lose: the cards slam the own LP panel along the clock hand — brass thunk, a spray of ticks. */
  jesterLpHit: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      thump(v, 0, 300, 70, 0.45, 0.18, { drive: 1.3 });
      dong(v, 0, 196, 0.12, 0.7);
      coin(v, 0.003, 2600, 0.08, 0.5, { click: 1.2 });
      for (let i = 0; i < 7; i++) tick(v, 0.03 + i * 0.03 + v.r(0, 0.01), 0.06 * (1 - i / 8), i % 2 ? TOCK : TICK);
    },
  },
} satisfies Record<string, Recipe>;

export type JesterSfxName = keyof typeof V3_JESTER_RECIPES;
