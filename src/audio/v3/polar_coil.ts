// Kutup Bobini (polar_coil, lane D, C14) — the living coil's own sound set (?look=v3 only; YENI_KARTLAR §C14,
// §5.1). src/audio/sounds.ts spreads V3_POLAR_COIL_RECIPES and SfxName gains PolarCoilSfxName.
//
// Identity (§5.1, the polar family): the family's 110 / 111 Hz beating sine pair under the coil's own pitch
// D3 = 146.8 Hz, iron-dust glass pings — and what is the coil's alone: the WINDING BUZZ (a transformer hum on D3
// with its 2nd/3rd harmonics, amplitude-gated by the turns of the wire, its pitch and turn rate rising as it
// winds and falling as it unwinds), the spool ratchet (a regular, accelerating / decelerating tick train — the
// needle's ratchet is a slowing pivot at 220 Hz, the coil's is a turning spool at 2.6 kHz) and the copper wire
// TWANG (a plucked, dispersive spring chirp). The anvil's long ring and the sovereign's 35 Hz gong are not used.
//
//   arrive  polarCoilPin           the empty spindle plants its pin: a hollow "tok" + the field wakes
//           polarCoilWind          the wire flies in and winds: buzz rising D3 → D4, turn ticks accelerating (sustained → land)
//   land    polarCoilSnap          the wound coil snaps taut, limbs open: copper twang + whip crack + body thump
//           polarCoilSpools        the shoulder spools spin up: a ratchet flurry + light hum
//   roar    polarCoilRoar          the whips lash up, the core blazes: two cracks + a rising buzz swell
//   charge  polarCoilCharge        the dust gathers into three spikes orbiting the coil (circular pan, rising, sustained → release)
//   release polarCoilFling         the whips crack forward, the three spikes are flung (crack + three whooshes)
//           polarCoilOrbit         the spikes orbit the target: a circling three-voice whirr, faster (sustained → converge)
//           polarCoilTicks         the last lap's lead-in (converge − 110 ms): "tşak-tşak-tşak" 37 ms apart, each brighter
//   impact  polarCoilTshak         the three converge ON the contact frame: magnetic crack + thump at t = 0, the hum bursts
//   (flip)  polarCoilFlipWind      flip summon: the card turns, a fast 3-turn wind on the bare spindle (→ polarCoilSnap)
//   (toGuard) polarCoilWrap        position change: the whips wrap the drum (twang + lug ticks)
//           polarCoilDeflect       blocked: the spikes splinter on the guard into dust
//   (death f1) polarCoilUnwind     the wire unwinds (played by the hook, see cinematics/d/polar_coil.ts), the spools spin backwards: buzz falling, ticks slowing
//   dissolve   polarCoilSlack      the last turns slip off: slack twang + the empty spools rattling free (to the tok)
//   (+2)       polarCoilWobble     the empty spindle wobbles on its pin (creak + the hum dying)
//   (+5)       polarCoilTok        the spindle hits the marble (the impact frame): "tok"
//   burst   polarCoilBurst         the empty spool spins free and rolls on its rim (ratchet + rolling rumble), runs down
//           polarCoilBreak         the remains and the spool break: copper curls spring off, steel grit patters down
//   reviveGather polarCoilReviveGather  the wire snaps back onto the spindle (reverse wind, sustained → land)
//   reviveLand   polarCoilReviveSnap    a lighter snap
// Levels follow the slice (pre-chain linear amplitudes); big beats duck ≥ 0.55, small ≤ 0.3 (SE-7).

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { clank, crack, glassRain, link, puff, scaled, sweep, thump } from './kit';

/** The coil's pitch (D3 ≈ 146.8 Hz). */
const D3 = midiHz(50);
/** The iron dust: high D-major-ish pings (D7 F#7 A7 C#8) — a different set from the anvil's E minor. */
const DUST = [98, 102, 105, 109] as const;

/** The family hum: two sines at 110 / 111 Hz (1 Hz beat) under an envelope. */
function poleHum(v: Voice, t: number, env: readonly Pt[], k = 1): void {
  v.tone('sine', 110, { t, g: scaled(env, k) });
  v.tone('sine', 111, { t, g: scaled(env, k * 0.9) });
}

/** Tick times of a turning spool whose rate goes r0 → r1 (turns / s) over d seconds. */
function turnTimes(d: number, r0: number, r1: number, max = 80): number[] {
  const out: number[] = [];
  const a = (r1 - r0) / (2 * d);
  for (let k = 1; k < max; k++) {
    // solve r0 t + a t² = k
    const t = Math.abs(a) < 1e-6 ? k / r0 : (-r0 + Math.sqrt(Math.max(0, r0 * r0 + 4 * a * k))) / (2 * a);
    if (!Number.isFinite(t) || t > d || t < 0) break;
    out.push(t);
  }
  return out;
}

/**
 * The winding buzz: a transformer hum (saw + square on `f`, its octave) gated by the wire's turns
 * (`turns` Hz) through a band that follows the brightness `bp`. Everything is enveloped by `env`.
 */
function windBuzz(v: Voice, t: number, d: number, f: readonly Pt[], turns: readonly Pt[], bp: readonly Pt[], env: readonly Pt[], o: { pan?: AudioNode } = {}): void {
  const band = v.filt('bandpass', bp as Pt[], 1.8, { t, to: o.pan });
  const gate = v.ring(turns as Pt[], { t, d: d + 0.05, mix: 0.55, to: band });
  v.tone('sawtooth', f as Pt[], { t, g: env as Pt[], to: gate });
  v.tone('square', f.map(([x, y, c]) => [x, y * 2.003, c] as Pt), { t, g: scaled(env, 0.35), to: gate });
  v.tone('sine', f as Pt[], { t, g: scaled(env, 0.6) });
}

/** A copper wire twang: a plucked saw on `f` (+ fifth) through a closing lowpass, with a dispersive chirp falling under it. */
function twang(v: Voice, t: number, f: number, g: number, dec: number): void {
  const lp = v.filt('lowpass', [[0, 4200], [dec, 500, 'e']], 4, { t });
  v.tone('sawtooth', f, { t, g: perc(g, dec, 0.001), to: lp });
  v.tone('sawtooth', f * 1.498, { t, g: perc(g * 0.45, dec * 0.7, 0.001), to: lp });
  // the spring's dispersion: a quick downward chirp (the "boi-")
  v.tone('sine', [[0, f * 8], [dec * 0.3, f * 2, 'e']], { t, g: perc(g * 0.35, dec * 0.35, 0.0008) });
}

/** One spool tick (a small ratchet pawl over a brass tooth). */
function spoolTicks(v: Voice, t: number, times: readonly number[], g: number, f = 2600): void {
  v.bursts(times, times.map((_, i) => g * (0.75 + 0.25 * ((i * 7) % 3) / 2)), { t, dec: 0.006, f, q: 3.5 });
}

export const V3_POLAR_COIL_RECIPES = {
  /** Summon f0: the empty spindle plants its pin — a hollow "tok", the field hum wakes. */
  polarCoilPin: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      v.noise('white', { g: perc(0.18, 0.03, 0.0005), to: v.filt('bandpass', 900, 3) });
      thump(v, 0, 220, 90, 0.32, 0.12);
      link(v, 1240, 0.004, 0.04, 0.16);
      poleHum(v, 0, [[0, 0], [0.05, 0.1], [0.5, 0.0001, 'e']]);
    },
  },
  /** Summon f1 → 'land': the wire winds on — buzz rising D3 → D4, turns faster and brighter (stopped on land). */
  polarCoilWind: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.92;
      const E = D + 0.2;
      const env: Pt[] = [[0, 0], [0.08, 0.05], [D, 0.16], [E, 0.0001, 'e']];
      windBuzz(v, 0, E, [[0, D3], [D, D3 * 2, 'e'], [E, D3 * 2]], [[0, 7], [D, 46, 'e']], [[0, 400], [D, 2600, 'e']], env);
      // the wire whips in from the top-left: an incoming swish
      sweep(v, 0, 0.32, [600, 2400, 1200], 0.12, { kind: 'pink', q: 1.8, pan: [-0.6, 0], peakAt: 0.7 });
      // each turn of the wire clicks over the flange: a tick train that accelerates
      spoolTicks(v, 0.05, turnTimes(D, 6, 30), 0.07, 2600);
      poleHum(v, 0, [[0, 0], [D, 0.16], [E, 0.0001, 'e']]);
      glassRain(v, { t: 0.2, d: D - 0.1, n: 9, g: 0.025, notes: DUST, dec: [0.03, 0.08], curve: 0.6, fade: 0, modes: 2 });
    },
  },
  /** Summon 'land': the coil snaps taut, the limbs open — copper twang, whip crack, thump, hum burst. */
  polarCoilSnap: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      twang(v, 0, D3 * 2, 0.16, 0.55);
      twang(v, 0.006, D3, 0.12, 0.7);
      crack(v, 0.002, 0.24, { hp: 2600, n: 2, gap: 0.012 });
      thump(v, 0, 150, D3 * 0.5, 0.5, 0.2, { drive: 1.4 });
      clank(v, 880, 0.004, 0.08, 0.2, { ratio: 2.76, index: 1.4, click: 0.5 });
      poleHum(v, 0, perc(0.2, 0.5, 0.004));
      // the field rings out round the coil: a short zap
      const r = v.ring([[0, 60], [0.3, 20, 'e']], { d: 0.35, mix: 0.7 });
      v.tone('sawtooth', D3 * 3, { g: perc(0.05, 0.3, 0.003), to: r });
    },
  },
  /** Summon settle: the shoulder spools spin up and run down — a ratchet flurry over a light hum. */
  polarCoilSpools: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.15,
    play(v) {
      spoolTicks(v, 0, turnTimes(0.42, 34, 8), 0.06, 2900);
      spoolTicks(v, 0.03, turnTimes(0.4, 30, 7), 0.045, 2300);
      v.tone('sine', D3 * 2, { g: [[0, 0], [0.04, 0.04], [0.45, 0.0001, 'e']] });
    },
  },
  /** The roar: the whips lash up twice, the core blazes — a buzz swell up an octave and the field rings. */
  polarCoilRoar: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      crack(v, 0, 0.2, { hp: 2400, n: 2, gap: 0.01 });
      crack(v, 0.11, 0.26, { hp: 2200, n: 2, gap: 0.01 });
      const env: Pt[] = [[0, 0], [0.1, 0.18], [0.5, 0.12], [0.75, 0.0001, 'e']];
      windBuzz(v, 0.05, 0.75, [[0, D3], [0.25, D3 * 2, 'e'], [0.75, D3 * 2]], [[0, 18], [0.3, 52, 'e']], [[0, 600], [0.3, 3000, 'e'], [0.75, 900, 'e']], env);
      twang(v, 0.11, D3 * 2, 0.1, 0.5);
      thump(v, 0.11, 130, 55, 0.38, 0.2, { drive: 1.3 });
      poleHum(v, 0.1, [[0, 0], [0.08, 0.18], [0.65, 0.0001, 'e']]);
    },
  },
  /** Strike charge: iron dust gathers into three spikes that orbit the coil — a circling whirr rising (stopped on release). */
  polarCoilCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 0.9;
      const H = D + 0.4;
      const E = H + 0.15;
      // the orbit: the pan swings L ↔ R faster and faster (1.2 → 5 turns / s)
      const pan: Pt[] = [];
      let ph = 0;
      for (let t = 0; t <= E; t += 0.02) {
        const rate = 1.2 + 3.8 * Math.min(1, t / D);
        ph += rate * 0.02;
        pan.push([t, 0.7 * Math.sin(ph * Math.PI * 2)]);
      }
      const out = v.panner(pan);
      // (−4 dB from the first cut: the contact, not the charge, is the loudest beat of the strike — §5 "Darbe kutsaldır")
      const env: Pt[] = [[0, 0], [0.12, 0.03], [D, 0.08], [H, 0.08], [E, 0.0001, 'e']];
      windBuzz(v, 0, E, [[0, D3], [D, D3 * 1.5, 'e'], [E, D3 * 1.5]], [[0, 3.6], [D, 15, 'e']], [[0, 300], [D, 1800, 'e'], [E, 1800]], env, { pan: out });
      sweep(v, 0, H, [400, 1600, 2000], 0.032, { kind: 'pink', q: 2.5, peakAt: 0.9, to: out });
      poleHum(v, 0, [[0, 0], [D, 0.11], [H, 0.11], [E, 0.0001, 'e']]);
      glassRain(v, { t: 0.04, d: H, n: 14, g: 0.017, notes: DUST, dec: [0.03, 0.07], curve: 0.6, fade: 0, modes: 2 });
    },
  },
  /** Strike release: the whips crack forward and fling the three spikes — a crack and three quick whooshes. */
  polarCoilFling: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      crack(v, 0, 0.3, { hp: 2400, n: 2, gap: 0.009 });
      crack(v, 0.022, 0.18, { hp: 3200, n: 1 });
      for (let i = 0; i < 3; i++) sweep(v, 0.01 + i * 0.03, 0.2, [900, 3400 - i * 300, 1500], 0.12, { kind: 'white', q: 2.2, pan: [0, (i - 1) * 0.6], peakAt: 0.3 });
      twang(v, 0, D3 * 2, 0.09, 0.4);
      thump(v, 0, 160, 80, 0.22, 0.1);
      // the flight: a low magnetic whirr at the coil's pitch (D3) carries the three spikes across the board — a
      // chopped triangle + a noise band swelling and gliding up as they close in, handing over to polarCoilOrbit
      // (which starts ≈ 0.3 s after the fling and swallows the tail)
      const F0 = 0.07;
      const F1 = 0.46;
      const fl = v.panner([[F0, -0.2], [F1, 0.35]]);
      const chopT = v.ring([[F0, 9], [F1, 15, 'e']], { d: F1 - F0 + 0.02, mix: 0.7, to: fl });
      v.tone('triangle', [[F0, D3], [F1, D3 * 1.5, 'e']], { t: F0, g: [[F0, 0], [0.14, 0.07], [0.32, 0.085], [F1, 0.0001, 'e']], to: chopT });
      v.tone('sine', [[F0, D3 * 0.5], [F1, D3 * 0.75, 'e']], { t: F0, g: [[F0, 0], [0.16, 0.06], [0.3, 0.06], [F1, 0.0001, 'e']], to: fl });
      const bpF = v.filt('bandpass', [[F0, 700], [F1, 1500, 'e']], 3, { to: chopT });
      v.noise('white', { t: F0, g: [[F0, 0], [0.16, 0.05], [0.3, 0.07], [F1, 0.0001, 'e']], to: bpF });
    },
  },
  /** The spikes orbit the target: a circling three-voice whirr, faster and higher (stopped on the converge). */
  polarCoilOrbit: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 0.55;
      const E = D + 0.12;
      for (let i = 0; i < 3; i++) {
        // each spike passes front → back: its own pan swing a third of a turn behind the last
        const pan: Pt[] = [];
        let ph = i / 3;
        for (let t = 0; t <= E; t += 0.015) {
          const rate = 2.6 + 4.4 * Math.min(1, t / D);
          ph += rate * 0.015;
          pan.push([t, 0.75 * Math.sin(ph * Math.PI * 2)]);
        }
        const out = v.panner(pan);
        // the whirr: a band of noise chopped at the pass rate, its centre climbing
        const bp = v.filt('bandpass', [[0, 1300 + i * 260], [D, 3400 + i * 420, 'e']], 4, { to: out });
        const chop = v.ring([[0, 7.8], [D, 21, 'e']], { d: E + 0.02, mix: 0.8, to: bp });
        v.noise('white', { g: [[0, 0], [0.04, 0.11], [D, 0.15], [E, 0.0001, 'e']], to: chop });
        v.tone('triangle', [[0, D3 * (2 + i * 0.5)], [D, D3 * (3 + i * 0.75), 'e']], { g: [[0, 0], [0.05, 0.022], [D, 0.03], [E, 0.0001, 'e']], to: out });
      }
      poleHum(v, 0, [[0, 0], [0.04, 0.16], [D, 0.2], [E, 0.0001, 'e']]);
    },
  },
  /**
   * The last lap's lead-in (onConverge − 110 ms, the orbit hushed): "tşak-tşak-tşak" — three magnetised ticks
   * 37 ms apart, each brighter and a step louder, panning L → R → centre as the spikes turn in. They END where the
   * contact begins: polarCoilTshak lands the thump + crack on the convergence frame.
   */
  polarCoilTicks: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const pans = [-0.45, 0.45, 0];
      for (let i = 0; i < 3; i++) {
        const t = i * 0.037;
        const p = v.panner(pans[i]);
        crack(v, t, 0.2 + i * 0.05, { hp: 2600 + i * 700, n: 1, dec: 0.012, to: p });
        clank(v, 1180 + i * 220, t, 0.05 + i * 0.012, 0.09, { ratio: 2.76, index: 1.8, click: 0.8 + i * 0.25, to: p });
      }
      // the field drawing in: a short rising sine under the ticks
      v.tone('sine', [[0, D3 * 2], [0.11, D3 * 4, 'e']], { g: [[0, 0], [0.02, 0.05], [0.1, 0.07], [0.12, 0.0001, 'e']] });
    },
  },
  /**
   * The converge (on the convergence frame): the three spikes meet in the body — the heavy magnetic crack and the
   * thump AT ONCE (t = 0, the loudest beat of the strike), the hum bursts, a falling buzz and the dust rain off it.
   */
  polarCoilTshak: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      crack(v, 0, 0.8, { hp: 2200, n: 3, gap: 0.004, dec: 0.026 });
      clank(v, 1420, 0, 0.18, 0.24, { ratio: 2.76, index: 2, click: 1.6 });
      clank(v, 940, 0.003, 0.13, 0.3, { ratio: 2.4, index: 1.5, click: 0.8 });
      thump(v, 0.002, 120, 42, 0.62, 0.26, { drive: 1.6 });
      poleHum(v, 0, perc(0.32, 0.45, 0.003));
      v.tone('sawtooth', [[0, D3 * 2], [0.25, D3, 'e']], { g: perc(0.07, 0.26, 0.002), to: v.filt('lowpass', 1400, 1) });
      glassRain(v, { t: 0.02, d: 0.35, n: 8, g: 0.026, notes: DUST, dec: [0.03, 0.1], curve: 1.6, modes: 2 });
    },
  },
  /** Blocked: the spikes splinter on the guard — three bent tinks scattering, dust raining off. */
  polarCoilDeflect: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.35,
    play(v) {
      for (let i = 0; i < 3; i++) {
        const t = i * 0.03;
        link(v, 1900 - i * 230, t, 0.07, 0.18, v.panner((i - 1) * 0.6));
        crack(v, t, 0.12, { hp: 3400, n: 1 });
      }
      v.tone('sine', [[0, 600], [0.3, 300, 'e']], { t: 0.04, g: perc(0.06, 0.3, 0.003) });
      thump(v, 0.03, 140, 70, 0.25, 0.12);
      poleHum(v, 0, perc(0.12, 0.3, 0.004));
      glassRain(v, { t: 0.06, d: 0.45, n: 12, g: 0.03, notes: DUST, dec: [0.03, 0.1], curve: 1.4, modes: 2 });
    },
  },
  /**
   * Death f1 → f6 (≈ 0.4 s) and on: the wire unwinds, the spools spin backwards — the buzz falls D4 → D2, the turn
   * ticks slow down; the ratchet keeps running (slower and slower) through the wobble, so the death is one sound
   * gesture up to the "tok" (≈ 0.62 s after f1).
   */
  polarCoilUnwind: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      const D = 0.5;
      const E = 0.72;
      const env: Pt[] = [[0, 0], [0.02, 0.17], [0.3, 0.13], [D, 0.07], [E, 0.0001, 'e']];
      windBuzz(v, 0, E, [[0, D3 * 2], [D, D3 * 0.6, 'e'], [E, D3 * 0.5]], [[0, 40], [D, 7, 'e'], [E, 4]], [[0, 2800], [D, 420, 'e'], [E, 300]], env);
      spoolTicks(v, 0, turnTimes(E, 36, 5), 0.07, 2600);
      // the loose wire whipping off: an outgoing swish
      sweep(v, 0, 0.45, [2600, 1800, 500], 0.1, { kind: 'pink', q: 1.6, pan: [0, -0.6], peakAt: 0.25 });
      poleHum(v, 0, [[0, 0], [0.02, 0.16], [D, 0.06], [E, 0.0001, 'e']]);
    },
  },
  /**
   * Death 'dissolve' (f5): the last turns slip off the bare rod — a slack copper twang falling, and the empty spools
   * rattling free on the spindle (a low, slowing ratchet that runs on under the wobble to the "tok").
   */
  polarCoilSlack: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      twang(v, 0, D3 * 1.5, 0.07, 0.35);
      sweep(v, 0, 0.18, [1800, 900, 300], 0.05, { kind: 'pink', q: 1.4, pan: [0, -0.4], peakAt: 0.3 });
      // the free-running spools: low pawl rattle, slowing (two spools, slightly apart), over a continuous whirr bed
      // (a band of noise chopped at the spools' falling turn rate) that carries on under the wobble to the "tok"
      spoolTicks(v, 0.02, turnTimes(0.5, 26, 6), 0.08, 1500);
      spoolTicks(v, 0.03, turnTimes(0.48, 22, 5), 0.06, 1150);
      const bed = v.filt('bandpass', [[0, 1700], [0.52, 650, 'e']], 2.2);
      const chop = v.ring([[0, 28], [0.52, 8, 'e']], { d: 0.56, mix: 0.85, to: bed });
      v.noise('pink', { g: [[0, 0], [0.04, 0.2], [0.4, 0.24], [0.5, 0.14], [0.56, 0.0001, 'e']], to: chop });
      v.tone('sine', [[0, D3], [0.52, D3 * 0.7, 'e']], { g: [[0, 0], [0.03, 0.08], [0.45, 0.06], [0.55, 0.0001, 'e']] });
    },
  },
  /** Death 'dissolve' + 2 (f7): the bare spindle wobbles on its pin — a metal creak, the field's last breath. */
  polarCoilWobble: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      // creak: a slow train of tiny bursts through a resonant band
      const times: number[] = [];
      for (let i = 0; i < 14; i++) times.push(i * 0.014 + (i % 3) * 0.002);
      v.bursts(times, times.map((_, i) => 0.06 * (1 - i / 16)), { dec: 0.008, f: 1100, q: 6 });
      v.tone('sine', [[0, 110], [0.35, 72, 'e']], { g: [[0, 0], [0.02, 0.12], [0.35, 0.0001, 'e']] });
      v.tone('sine', [[0, 111], [0.35, 71, 'e']], { g: [[0, 0], [0.02, 0.1], [0.35, 0.0001, 'e']] });
      link(v, 1500, 0.02, 0.03, 0.12);
    },
  },
  /** Death: the empty spindle topples onto the marble — "tok" (hollow, with a short iron ring). */
  polarCoilTok: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      v.noise('white', { g: perc(0.22, 0.04, 0.0005), to: v.filt('bandpass', 720, 4) });
      thump(v, 0, 180, 70, 0.42, 0.14, { drive: 1.2 });
      clank(v, 640, 0.002, 0.09, 0.22, { ratio: 2.76, index: 1.6, click: 0.6 });
      puff(v, 0.01, 0.12, 0.2, 1200);
    },
  },
  /** Death burst: the empty spool spins free and runs down, loose copper springs off, the iron dust settles. */
  polarCoilBurst: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      spoolTicks(v, 0, turnTimes(0.75, 22, 2.5), 0.07, 2900);
      // the empty spool rolling on its rim over the marble: a low rumble chopped at its slowing turn rate
      const roll = v.filt('bandpass', [[0, 520], [0.62, 260, 'e']], 1.6);
      const turn = v.ring([[0, 18], [0.62, 5, 'e']], { d: 0.66, mix: 0.7, to: roll });
      v.noise('pink', { g: [[0, 0], [0.06, 0.2], [0.45, 0.15], [0.62, 0.0001, 'e']], to: turn });
      twang(v, 0.02, D3 * 3, 0.05, 0.3);
      twang(v, 0.12, D3 * 2.5, 0.04, 0.3);
      v.tone('sine', [[0, 110], [0.8, 66, 'e']], { g: [[0, 0], [0.02, 0.1], [0.8, 0.0001, 'e']] });
      v.tone('sine', [[0, 111], [0.8, 65, 'e']], { g: [[0, 0], [0.02, 0.09], [0.8, 0.0001, 'e']] });
      glassRain(v, { t: 0.04, d: 0.7, n: 14, g: 0.028, notes: DUST, dec: [0.04, 0.14], curve: 1.6, modes: 2 });
    },
  },
  /**
   * Death end: the remains and the empty spool break (the last ≈ 150 ms) — copper curls spring off (three bright
   * little twangs, rising), steel grit patters down, a dry crumble under it.
   */
  polarCoilBreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      twang(v, 0, D3 * 4, 0.1, 0.2);
      twang(v, 0.035, D3 * 5, 0.09, 0.18);
      twang(v, 0.07, D3 * 6, 0.08, 0.16);
      v.noise('white', { g: [[0, 0], [0.01, 0.12], [0.12, 0.05], [0.24, 0.0001, 'e']], to: v.filt('bandpass', 2400, 1.2) });
      v.bursts([0.02, 0.05, 0.07, 0.11, 0.14, 0.19, 0.23], [0.12, 0.1, 0.1, 0.08, 0.07, 0.06, 0.04], { dec: 0.006, f: 3600, q: 3 });
      puff(v, 0, 0.16, 0.18, 900);
    },
  },
  /** Flip summon: the card turns, the bare spindle takes a fast 3-turn wind — a short buzz whipping up D3 → D4, quickening ticks. */
  polarCoilFlipWind: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 0.42;
      const E = D + 0.06;
      const env: Pt[] = [[0, 0], [0.03, 0.08], [D, 0.17], [E, 0.0001, 'e']];
      windBuzz(v, 0, E, [[0, D3], [D, D3 * 2, 'e'], [E, D3 * 2]], [[0, 14], [D, 48, 'e']], [[0, 700], [D, 2800, 'e']], env);
      sweep(v, 0, 0.2, [900, 2600, 1400], 0.1, { kind: 'pink', q: 1.8, pan: [-0.4, 0.1], peakAt: 0.75 });
      spoolTicks(v, 0.02, turnTimes(D, 14, 40), 0.07, 2700);
      poleHum(v, 0, [[0, 0], [D, 0.12], [E, 0.0001, 'e']]);
    },
  },
  /** toGuard: the whips swing up and wrap the drum — a quick copper twang, the lugs ticking onto the windings. */
  polarCoilWrap: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      sweep(v, 0, 0.14, [1400, 3000, 1800], 0.07, { kind: 'pink', q: 2, pan: [0.3, -0.3], peakAt: 0.6 });
      twang(v, 0.09, D3 * 2, 0.09, 0.32);
      spoolTicks(v, 0.12, [0, 0.045, 0.085], 0.09, 2600);
      link(v, 1500, 0.2, 0.05, 0.12);
      thump(v, 0.2, 120, 80, 0.22, 0.1);
      poleHum(v, 0.09, perc(0.08, 0.35, 0.004));
    },
  },
  /** Revive: the wire snaps back onto the spindle top → bottom (a reverse wind: buzz rising, ticks quickening; stopped on land). */
  polarCoilReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      const D = 0.6;
      const E = D + 0.25;
      const env: Pt[] = [[0, 0], [D, 0.15], [E, 0.0001, 'e']];
      windBuzz(v, 0, E, [[0, D3 * 0.5], [D, D3 * 2, 'e'], [E, D3 * 2]], [[0, 5], [D, 40, 'e']], [[0, 300], [D, 2400, 'e']], env);
      spoolTicks(v, 0.05, turnTimes(D, 5, 34), 0.06, 2600);
      poleHum(v, 0, [[0, 0], [D, 0.18], [E, 0.0001, 'e']]);
      glassRain(v, { d: D, n: 10, g: 0.026, notes: DUST, dec: [0.03, 0.08], curve: 0.5, fade: 0, modes: 2 });
    },
  },
  /** Revive 'land': a lighter snap. */
  polarCoilReviveSnap: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      twang(v, 0, D3 * 2, 0.12, 0.5);
      crack(v, 0.002, 0.16, { hp: 2800, n: 1 });
      thump(v, 0, 140, 60, 0.36, 0.16, { drive: 1.3 });
      poleHum(v, 0, perc(0.14, 0.4, 0.004));
    },
  },
} satisfies Record<string, Recipe>;

export type PolarCoilSfxName = keyof typeof V3_POLAR_COIL_RECIPES;
