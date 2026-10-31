// Kutup Örsü (polar_anvil, lane D, C13) — the living anvil's own sound set (?look=v3 only; YENI_KARTLAR §C13,
// §5.1). src/audio/sounds.ts spreads V3_POLAR_ANVIL_RECIPES and SfxName gains PolarAnvilSfxName.
//
// Identity (§5.1, the polar family): the family's 110 / 111 Hz beating sine pair (a 1 Hz magnetic "wah") under
// the anvil's own pitch E2 = 82.4 Hz, iron-dust glass pings (glassRain on high iron notes) — and what is the
// anvil's alone: a real anvil RING (a struck steel block: long, bright, inharmonic partials at 1.24 / 1.75 /
// 2.93 kHz that outlast the blow — no other card's metal rings that long) and the descending FM push wave.
// The needle (220 Hz, ticking compass) and the coil (147 Hz, winding buzz) keep their own registers; the
// sovereign's 35 Hz gong is not used here.
//
//   arrive  polarAnvilSlide         the two half-anvils grind in from both sides, an electric arc between them (sustained → land)
//   land    polarAnvilKlak          "KLAK": the halves weld (clank + short thump + weld crack + anvil ring)
//           polarAnvilFount         the spark fountain sizzles and the sparks ping on the floor
//           polarAnvilArms          the hammer-arms unfold and tap the face: "tık tık"
//   roar    polarAnvilRoar          the double strike that makes the poles blaze (dang–DANG + pole buzz)
//   charge  polarAnvilCharge        the mauls rise: a magnetic hum swells on E2 with the 110/111 beat (sustained → release)
//   release polarAnvilDang          both mauls on the face: the anvil's ring
//           polarAnvilWave          the push wave rolls out: a descending FM sweep (sustained → arrival)
//   impact  polarAnvilWaveHit       the wave lands: a magnetic shove (beat burst + low thud)
//           polarAnvilRebound       blocked: the wave breaks on the guard and rings back
//   deathStart polarAnvilSwap       the poles swap wildly (a two-note square trill, ring-modulated)
//   dissolve   polarAnvilRepel      the pieces repel outwards (diverging whooshes, release clanks, falling FM)
//   afterDissolve polarAnvilPlate   an iron plate lands on the floor
//   burst   polarAnvilBurst         the last breath: the plates clatter, the pole hum dies, the dust settles
//   reviveGather polarAnvilReviveGather  the pieces are pulled back together (sustained → land)
//   reviveLand   polarAnvilReviveLock    a lighter KLAK
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt } from '../synth';
import type { Voice } from '../synth';
import { clank, crack, glassRain, link, puff, scaled, sweep, thump } from './kit';

/** The anvil's pitch (E2 ≈ 82.4 Hz). */
const E2 = midiHz(40);
/** The iron dust: high E-minor pings (E7 G7 B7 D8). */
const DUST = [100, 103, 107, 110] as const;

/** The family hum: two sines at 110 / 111 Hz (1 Hz beat) under an envelope. */
function poleHum(v: Voice, t: number, env: readonly Pt[], k = 1): void {
  v.tone('sine', 110, { t, g: scaled(env, k) });
  v.tone('sine', 111, { t, g: scaled(env, k * 0.9) });
}

/** The struck anvil: its long inharmonic ring (steel block modes), `g` the loudest partial. */
function anvilRing(v: Voice, t: number, g: number, dec: number, f = 1240): void {
  v.bell(f, { t, g, dec, ratio: 1.41, index: 0.6, idxDec: 0.04 });
  v.tone('sine', f * 1.41, { t, g: perc(g * 0.55, dec * 0.8, 0.0006) });
  v.tone('sine', f * 2.36, { t, g: perc(g * 0.3, dec * 0.45, 0.0006) });
  v.tone('sine', f * 3.9, { t, g: perc(g * 0.12, dec * 0.22, 0.0006) });
}

export const V3_POLAR_ANVIL_RECIPES = {
  /** Summon: two iron halves grind in from left and right, an electric arc buzzing up between them (stopped on 'land'). */
  polarAnvilSlide: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const D = 0.62;
      // the two scrapes converge from the sides to the centre
      sweep(v, 0, D, [700, 1500, 2300], 0.24, { kind: 'pink', q: 2.4, pan: [-0.7, -0.1], peakAt: 0.8 });
      sweep(v, 0.02, D, [760, 1600, 2400], 0.24, { kind: 'pink', q: 2.4, pan: [0.7, 0.1], peakAt: 0.8 });
      // the arc: a buzzing saw on E2 through a band that climbs, its buzz faster as the gap closes
      const bp = v.filt('bandpass', [[0, 500], [D, 2600, 'e']], 3);
      const buzz = v.ring([[0, 18], [D, 60, 'e']], { d: D + 0.1, mix: 0.7, to: bp });
      v.tone('sawtooth', E2 * 2, { g: [[0, 0], [0.12, 0.09], [D, 0.24], [D + 0.08, 0.0001, 'e']], to: buzz });
      // the family's beat swelling underneath
      poleHum(v, 0, [[0, 0], [D, 0.16], [D + 0.1, 0.0001, 'e']]);
      // arc sparks: dry ticks thickening toward the weld
      v.crackle({ t: 0.08, d: D - 0.1, n: 16, g: 0.2, f: 4200, q: 1.5, curve: 0.55, dec: 0.006 });
    },
  },
  /** Summon 'land': KLAK — the halves weld. A heavy clank, a short body thump, the weld's crack, the anvil ring. */
  polarAnvilKlak: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      clank(v, 410, 0, 0.26, 0.42, { ratio: 1.41, index: 2.6, click: 1.2 });
      clank(v, 620, 0.012, 0.14, 0.3, { ratio: 2.76, index: 1.8, click: 0.6 });
      thump(v, 0, 130, E2 * 0.55, 0.55, 0.22, { drive: 1.5 });
      crack(v, 0.004, 0.22, { hp: 3000, n: 2, gap: 0.009 });
      anvilRing(v, 0.01, 0.07, 0.9);
      poleHum(v, 0, perc(0.14, 0.5, 0.005));
    },
  },
  /** Summon: the spark fountain — a bright sizzle with the sparks pinging as they fall. */
  polarAnvilFount: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.03, 0.15], [0.5, 0.0001, 'e']], to: v.filt('highpass', [[0, 5200], [0.5, 2600, 'e']], 0.8) });
      v.crackle({ d: 0.55, n: 22, g: 0.22, f: 6000, q: 1.2, curve: 1.4, dec: 0.005 });
      glassRain(v, { t: 0.08, d: 0.6, n: 12, g: 0.06, notes: DUST, dec: [0.04, 0.12], curve: 1.2, modes: 2 });
    },
  },
  /** Summon: the hammer-arms unfold and tap the face twice — the idle's smith rhythm. */
  polarAnvilArms: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      for (const [t, f, g] of [
        [0, 1660, 0.07],
        [0.085, 1520, 0.085],
      ] as const) {
        link(v, f, t, g, 0.16);
        v.noise('white', { t, g: perc(0.09, 0.006, 0.0002), to: v.filt('bandpass', 3800, 1.6) });
        thump(v, t, 180, 90, 0.12, 0.06);
      }
      anvilRing(v, 0.085, 0.018, 0.5);
    },
  },
  /** The roar: dang–DANG, the second higher, and the poles blaze with a rising buzz. */
  polarAnvilRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      clank(v, 560, 0, 0.13, 0.3, { ratio: 1.41, index: 2.2, click: 0.8 });
      anvilRing(v, 0, 0.04, 0.5, 1180);
      clank(v, 640, 0.14, 0.18, 0.34, { ratio: 1.41, index: 2.4, click: 1 });
      anvilRing(v, 0.14, 0.06, 0.8, 1310);
      thump(v, 0.14, 120, 55, 0.4, 0.2, { drive: 1.3 });
      const bp = v.filt('bandpass', [[0, 300], [0.5, 1400, 'e']], 2.5, { t: 0.16 });
      const r = v.ring([[0, 12], [0.4, 30, 'e']], { t: 0.16, d: 0.6, mix: 0.6, to: bp });
      v.tone('sawtooth', E2 * 2, { t: 0.16, g: [[0, 0], [0.12, 0.09], [0.55, 0.0001, 'e']], to: r });
      poleHum(v, 0.14, [[0, 0], [0.08, 0.16], [0.6, 0.0001, 'e']]);
    },
  },
  /** Strike charge: the mauls rise — a magnetic hum on E2 swelling with the 110/111 beat, iron dust gathering. Faded at the release. */
  polarAnvilCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.6;
      const H = D + 0.35;
      const E = H + 0.15;
      const env: Pt[] = [[0, 0], [0.1, 0.05], [D, 0.13], [H, 0.13], [E, 0.0001, 'e']];
      const lp = v.filt('lowpass', [[0, 220], [D, 1300, 'e'], [E, 1300]], 3);
      v.tone('sawtooth', E2, { g: env, to: lp });
      v.tone('sawtooth', E2 * 1.006, { g: scaled(env, 0.8), to: lp });
      poleHum(v, 0, [[0, 0], [D, 0.2], [H, 0.2], [E, 0.0001, 'e']]);
      // a field whine climbing a fifth (FM: it thickens as it rises)
      const w = v.tone('sine', [[0, 330], [D, 495, 'e'], [E, 500]], { g: [[0, 0], [D, 0.035], [H, 0.035], [E, 0.0001, 'e']] });
      v.lfo(w.osc.detune, [[0, 3], [D, 9, 'e']], [[0, 4], [D, 14]], { d: E });
      // iron dust streams in: pings thickening toward the top
      glassRain(v, { t: 0.05, d: D, n: 10, g: 0.03, notes: DUST, dec: [0.03, 0.08], curve: 0.6, fade: 0, modes: 2 });
    },
  },
  /** Strike release: DANG — both mauls hit the face. The anvil's long ring is the card's signature. */
  polarAnvilDang: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.5,
    play(v) {
      clank(v, 700, 0, 0.2, 0.36, { ratio: 1.41, index: 2.8, click: 1.4 });
      clank(v, 760, 0.016, 0.14, 0.3, { ratio: 1.41, index: 2.2, click: 0.8 });
      anvilRing(v, 0.002, 0.085, 1.3);
      thump(v, 0, 140, E2 * 0.6, 0.42, 0.18, { drive: 1.3 });
      v.noise('white', { g: perc(0.06, 0.12, 0.001), to: v.filt('highpass', 5000, 0.7) });
    },
  },
  /** The push wave rolls out of the horn: a descending FM sweep (sustained: stopped when the wave arrives). */
  polarAnvilWave: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 0.5;
      const car = v.tone('sine', [[0, 620], [D, 140, 'e']], { g: [[0, 0], [0.02, 0.12], [D * 0.7, 0.09], [D, 0.0001, 'e']] });
      const mod = v.ctx.createGain();
      v.set(mod.gain, [[0, 900], [D, 60, 'e']]);
      v.tone('sine', [[0, 620 * 1.5], [D, 140 * 1.5, 'e']], { d: D + 0.02, to: mod });
      mod.connect(car.osc.frequency);
      // the rings' pulse: the low pole hum chopped at the ring rate
      const rr = v.ring([[0, 22], [D, 9, 'e']], { d: D + 0.05, mix: 0.85 });
      poleHum(v, 0, [[0, 0], [0.03, 0.2], [D, 0.0001, 'e']], 1);
      v.tone('sine', E2, { g: [[0, 0], [0.03, 0.16], [D, 0.0001, 'e']], to: rr });
      // the air pushed ahead of it
      sweep(v, 0, D, [2600, 1400, 500], 0.07, { kind: 'pink', q: 1.4, peakAt: 0.2 });
    },
  },
  /** The wave lands: a magnetic shove — the family beat bursts, a low thud, a short field clank. */
  polarAnvilWaveHit: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      thump(v, 0, 110, 42, 0.55, 0.26, { drive: 1.6 });
      poleHum(v, 0, perc(0.3, 0.35, 0.003));
      v.tone('sine', [[0, 330], [0.18, 165, 'e']], { g: perc(0.08, 0.2, 0.002) });
      clank(v, 380, 0, 0.08, 0.2, { ratio: 2.1, index: 1.6, click: 0.5 });
      puff(v, 0, 0.18, 0.2, 900, { kind: 'pink' });
    },
  },
  /** Blocked: the wave breaks on the guard and rings back toward the anvil (a bent, falling ring). */
  polarAnvilRebound: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      v.tone('sine', [[0, 260], [0.3, 520, 'e']], { g: perc(0.08, 0.3, 0.003) });
      v.tone('sine', [[0, 262], [0.3, 526, 'e']], { g: perc(0.06, 0.3, 0.003) });
      poleHum(v, 0, perc(0.14, 0.3, 0.004));
      crack(v, 0, 0.1, { hp: 2200, n: 1 });
    },
  },
  /** Death, the first beat: the poles swap wildly — a ring-modulated square trill between E2 and its octave. */
  polarAnvilSwap: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      const D = 0.42;
      const steps: Pt[] = [];
      for (let i = 0; i < 9; i++) steps.push([i * (D / 9), i % 2 ? E2 * 2 : E2 * 1.5, 's']);
      const lp = v.filt('lowpass', [[0, 2400], [D, 700, 'e']], 2);
      const rm = v.ring([[0, 31], [D, 11, 'e']], { d: D + 0.05, mix: 0.6, to: lp });
      v.tone('square', steps, { g: [[0, 0], [0.01, 0.15], [D, 0.0001, 'e']], to: rm });
      poleHum(v, 0, [[0, 0], [0.02, 0.12], [D, 0.0001, 'e']]);
      v.crackle({ d: D, n: 12, g: 0.08, f: 3000, q: 1.3, dec: 0.008 });
    },
  },
  /** Death 'dissolve': the pieces repel outwards — two whooshes diverging L / R, release clanks, a falling FM. */
  polarAnvilRepel: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      sweep(v, 0, 0.42, [900, 2200, 600], 0.16, { kind: 'pink', q: 1.6, pan: [0, -0.75], peakAt: 0.25 });
      sweep(v, 0.01, 0.42, [950, 2300, 620], 0.16, { kind: 'pink', q: 1.6, pan: [0, 0.75], peakAt: 0.25 });
      clank(v, 470, 0, 0.16, 0.3, { ratio: 1.41, index: 2.4, click: 1 });
      clank(v, 530, 0.035, 0.1, 0.24, { ratio: 2.76, index: 1.6, click: 0.6 });
      v.tone('sine', [[0, 220], [0.45, 55, 'e']], { g: perc(0.14, 0.45, 0.003) });
      thump(v, 0, 120, 48, 0.42, 0.24, { drive: 1.4 });
      poleHum(v, 0, perc(0.2, 0.4, 0.003));
    },
  },
  /** Death: one iron plate lands on the floor (also its bounce, quieter). */
  polarAnvilPlate: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      clank(v, 520, 0, 0.1, 0.22, { ratio: 2.76, index: 2, click: 1.6 });
      thump(v, 0, 160, 70, 0.2, 0.08);
      link(v, 1880, 0.03, 0.03, 0.08);
    },
  },
  /** Death burst: the plates clatter to a stop, the pole hum dies away, the dust rains. */
  polarAnvilBurst: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      const hits = [0, 0.06, 0.11, 0.19, 0.26, 0.36];
      hits.forEach((t, i) => clank(v, 560 + ((i * 137) % 300), t, 0.1 * (1 - i * 0.12), 0.16, { ratio: 2.76, index: 1.8, click: 1.2 }));
      thump(v, 0, 100, 45, 0.3, 0.2, { drive: 1.2 });
      // the field lets go: the beat falls off the pitch and dies
      v.tone('sine', [[0, 110], [0.8, 70, 'e']], { g: [[0, 0], [0.02, 0.14], [0.8, 0.0001, 'e']] });
      v.tone('sine', [[0, 111], [0.8, 69, 'e']], { g: [[0, 0], [0.02, 0.12], [0.8, 0.0001, 'e']] });
      glassRain(v, { t: 0.04, d: 0.7, n: 14, g: 0.03, notes: DUST, dec: [0.04, 0.14], curve: 1.6, modes: 2 });
    },
  },
  /** Revive: the pieces are pulled back together — the beat swells and quickens, dust streams in (stopped on 'land'). */
  polarAnvilReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 0.6;
      const E = D + 0.3;
      const trem = v.ring([[0, 4], [D, 16, 'e']], { d: E + 0.02, mix: 0.6 });
      v.tone('sine', 110, { g: [[0, 0], [D, 0.22], [E, 0.0001, 'e']], to: trem });
      v.tone('sine', 111, { g: [[0, 0], [D, 0.2], [E, 0.0001, 'e']], to: trem });
      v.tone('triangle', [[0, E2], [D, E2 * 2, 'e']], { g: [[0, 0], [D, 0.16], [E, 0.0001, 'e']] });
      sweep(v, 0, D, [500, 1800, 2400], 0.12, { kind: 'pink', q: 2, peakAt: 0.9 });
      glassRain(v, { d: D, n: 12, g: 0.028, notes: DUST, dec: [0.03, 0.08], curve: 0.5, fade: 0, modes: 2 });
    },
  },
  /** Revive 'land': the pieces lock — a lighter KLAK with a short ring. */
  polarAnvilReviveLock: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      clank(v, 480, 0, 0.18, 0.3, { ratio: 1.41, index: 2.2, click: 1 });
      thump(v, 0, 120, 55, 0.4, 0.16, { drive: 1.3 });
      anvilRing(v, 0.01, 0.045, 0.7);
      poleHum(v, 0, perc(0.12, 0.35, 0.004));
    },
  },
} satisfies Record<string, Recipe>;

export type PolarAnvilSfxName = keyof typeof V3_POLAR_ANVIL_RECIPES;
