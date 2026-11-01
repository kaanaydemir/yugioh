// Kül Ejderi (ashen_drake) sounds — docs/v3/kart-a/ashen_drake.md §6. Kept in a file of its own (like
// ./dawn.ts): src/audio/sounds.ts spreads V3_ASHEN_RECIPES, SfxName gains AshenSfxName, and
// CHARACTER_SOUNDS.ashen_drake (src/cinematics/_v3/sound.ts) names the role set.
//
// Identity: a 50 Hz DOUBLE ember heartbeat (lub 62 → 46 Hz, DUB 170 ms later 56 → 42 Hz) made audible on
// small speakers by a 2nd / 3rd-harmonic layer, a 165 Hz band-passed knock and the 160 / 320 Hz rib-tube
// band; ash = brown / pink noise, dry ember crackle (1.5–4 kHz). The signature: a held breath holding ONE
// heartbeat (ashenLub), true silence, a short suck, then the VUF on the beat where the DUB should be — a
// brown-noise low-pass that slams open (ashenIgnite). No glass, no saw drones, no FM metal.
// Built from ./kit.ts blocks and the Voice primitives only.

import type { Recipe } from '../sounds';
import type { Pt, Voice } from '../synth';
import { crack, growl, puff, sweep, thump } from './kit';

/** The 165 Hz band-passed knock (the heartbeat's audible body). */
function knock(v: Voice, t: number, g: number, dec = 0.08): void {
  v.noise('pink', { t, g: [[0, 0], [0.004, g], [dec, 0.0001, 'e']], to: v.filt('bandpass', 165, 4, { t }) });
}

/** The hollow two-tube rib resonance (160 / 320 Hz band-passes). */
function ribs(v: Voice, t: number, d: number, g: number): void {
  sweep(v, t, d, [160, 170, 160], g, { kind: 'pink', q: 8 });
  sweep(v, t, d, [320, 340, 320], g * 0.6, { kind: 'pink', q: 9 });
}

/** One ember heartbeat pair: LUB, then DUB 0.17 s later (`k` level, `sub` the sine thumps' share). */
function heartbeat(v: Voice, t: number, k: number, sub = 1): void {
  for (const [dt, f0, f1, g, dec, m] of [
    [0, 62, 46, 0.55, 0.16, 1],
    [0.17, 56, 42, 0.4, 0.2, 0.8],
  ] as const) {
    if (sub > 0) {
      thump(v, t + dt, f0, f1, g * k * sub, dec, { drive: 1.5 });
      thump(v, t + dt, f0 * 2, f1 * 2, 0.25 * k * m * sub, dec * 0.8, { drive: 2.5 });
    }
    knock(v, t + dt, 0.16 * k * m);
    ribs(v, t + dt, 0.18, 0.05 * k * m);
  }
  crack(v, t + 0.24, 0.05 * k, { hp: 2200, lp: 6000, n: 2, gap: 0.03, dec: 0.004 });
}

/** A sustained hold envelope: rise to D, plateau to H, natural fade to E. */
const hold = (g: number, D: number, H: number, E: number): Pt[] => [[0, 0.0001], [D, g, 'e'], [H, g], [E, 0.0001, 'e']];

export const V3_ASHEN_RECIPES = {
  /** The chest "güm" (summon f3, the fuse's arrival): the double heartbeat. */
  ashenHeartbeat: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      heartbeat(v, 0, 1);
    },
  },
  /** The ash mound grows on the tile (summon `arrive`). */
  ashenMound: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      // r2 (SE-4 vs magusPresence): a low brown slump and dry grains sliding off it, no mid sweep
      puff(v, 0, 0.45, 0.4, 320, { kind: 'brown' });
      thump(v, 0, 70, 44, 0.25, 0.22);
      crack(v, 0.03, 0.3, { hp: 3500, lp: 7000, n: 12, gap: 0.025, dec: 0.004 });
      sweep(v, 0.02, 0.3, [5200, 4200, 3400], 0.18, { kind: 'white', q: 2 });
    },
  },

  /** A single ember touches the mound. */
  ashenEmber: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    play(v) {
      v.tone('sine', 2200, { g: [[0, 0], [0.0005, 0.06], [0.12, 0.0001, 'e']] });
      v.tone('sine', 3300, { g: [[0, 0], [0.0005, 0.02], [0.1, 0.0001, 'e']] });
      crack(v, 0, 0.08, { hp: 5000, dec: 0.003 });
    },
  },
  /** The ring ignition round the mound. */
  ashenKindle: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      sweep(v, 0, 0.14, [500, 2400, 1200], 0.12, { kind: 'pink', pan: [-0.5, 0.5], peakAt: 0.3 });
      puff(v, 0.02, 0.2, 0.3, 1800, { kind: 'brown' });
      crack(v, 0.05, 0.08, { hp: 1800, n: 4, gap: 0.04, dec: 0.006 });
    },
  },
  /** The ash tornado building the body (sustained; the cinematic stops it on the burst). */
  ashenTornado: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      const D = 0.5;
      const H = 1.4;
      const E = 1.7;
      for (const [f, p] of [
        [[200, 900, 1600], -0.4],
        [[250, 1100, 1800], 0.4],
      ] as const) {
        const out = v.panner(p);
        const bp = v.filt('bandpass', [[0, f[0]], [D, f[1], 'e'], [E, f[2], 'e']], 2, { to: out });
        v.noise('pink', { g: hold(0.09, D, H, E), to: bp });
      }
      const rum = v.amp(1);
      v.wander(rum.gain, 7, 0.4, { d: E });
      v.noise('brown', { g: hold(0.35, D, H, E), to: v.filt('lowpass', 160, 0.8, { to: rum }) });
      for (let i = 0; i < 40; i++) {
        const t = i * 0.03 + v.r(0, 0.02);
        if (t > H) break;
        const k = Math.min(1, t / D);
        crack(v, t, 0.03 * (0.3 + 0.7 * k), { hp: 3500, lp: 8000, dec: 0.004 });
      }
    },
  },
  /** The talons land (summon `land`). */
  ashenTalon: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      thump(v, 0, 110, 50, 0.4, 0.3, { drive: 1.5 });
      // r2 (SE-4 vs magusLand): the talons crunch into ash: a dry ember spray up top, the dust kept low
      crack(v, 0, 0.6, { hp: 5000, lp: 10000, n: 6, gap: 0.014, dec: 0.008 });
      puff(v, 0.005, 0.25, 0.3, 380, { kind: 'brown' });
    },
  },

  /** The hollow roar (the cut-in flare). */
  ashenRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.65,
    play(v) {
      // r2 (critic r1 #8, SE-4): no formant growl at all (that is the wyrm's and the magus' voice). The drake
      // roars THROUGH its rib cage: brown-noise bellows in the two rib tubes throbbing at 24 Hz, a driven
      // 46 Hz saw kept under 300 Hz, the double heartbeat under it, and a dry ember storm (3.5–7 kHz)
      // riding over a hollow, empty middle (500 Hz – 2.5 kHz stays quiet)
      const D = 1.5;
      const tube = v.filt('bandpass', [[0, 130], [0.25, 175, 'e'], [D, 120, 'e']], 6);
      const tube2 = v.filt('bandpass', [[0, 260], [0.25, 340, 'e'], [D, 240, 'e']], 7);
      const fl = v.flutter(24, 0.65, { d: D, base: 0.5, to: tube });
      v.noise('brown', { g: hold(1.1, 0.12, 0.8, D), to: fl });
      const fl2 = v.flutter(24, 0.6, { d: D, base: 0.5, to: tube2 });
      v.noise('brown', { g: hold(0.7, 0.12, 0.8, D), to: fl2 });
      const lp = v.filt('lowpass', [[0, 180], [0.2, 300, 'e'], [D, 150, 'e']], 1.2);
      v.tone('sawtooth', [[0, 40], [0.25, 62, 'e'], [D, 34, 'e']], { g: hold(0.32, 0.1, 0.9, D), to: v.drive(3, { to: lp, trim: 0.8 }) });
      heartbeat(v, 0, 0.9);
      heartbeat(v, 0.75, 0.6);
      for (let i = 0; i < 34; i++) crack(v, 0.04 + i * 0.04 + v.r(0, 0.02), 0.42 * (1 - i / 40), { hp: 3500, lp: 7000, dec: 0.004 });
    },
  },

  /** The cloak slams over the shoulders: the landing ash shock (summon finale, played by the cinematic). */
  ashenLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.6,
    play(v) {
      // r3 (critic r2 #3): a hard onset of its own (the roar is faded out 90 ms before, see the summon): a
      // dry plate clack on the first ms, the body thump, a sub drop under it and the ash billow
      crack(v, 0, 0.55, { hp: 1800, lp: 6500, n: 3, gap: 0.006, dec: 0.006 });
      thump(v, 0, 70, 30, 0.9, 0.6, { drive: 3 });
      thump(v, 0.008, 44, 24, 0.55, 0.45, { drive: 1.5 });
      puff(v, 0.004, 0.5, 0.9, 1200, { kind: 'brown' });
      sweep(v, 0.05, 1.0, [1200, 600, 300], 0.08, { kind: 'pink' });
      heartbeat(v, 0.25, 0.6);
    },
  },
  /** The rib spill: sand through a grate, density falling, a cooling hiss. */
  ashenSpill: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const top = v.filt('lowpass', 7000, 0.7);
      const hp = v.filt('highpass', 2800, 0.8, { to: top });
      for (let i = 0; i < 26; i++) {
        const t = i * 0.018 * (1 + i * 0.03) + v.r(0, 0.008);
        v.noise('white', { t, g: [[0, 0], [0.0002, 0.08 * (1 - i / 30)], [0.003, 0.0001, 'e']], to: hp });
      }
      sweep(v, 0, 0.5, [2400, 1400, 700], 0.05, { kind: 'pink', q: 1.5 });
      v.noise('white', { t: 0.1, g: [[0, 0], [0.05, 0.04], [0.6, 0.0001, 'e']], to: v.filt('highpass', 5000, 0.7, { t: 0.1 }) });
    },
  },
  /** The inhale (sustained, the strike's charge): plate rips, the held breath, two quickening thumps. */
  ashenInhale: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    duck: 0.3,
    play(v) {
      const D = 0.45;
      const H = 1.1;
      const E = 1.4;
      // three dry plate rips (the cloak tears into the ribs)
      for (const t of [0.3, 0.42, 0.55]) {
        v.noise('pink', { t, g: [[0, 0], [0.001, 0.22], [0.006, 0.0001, 'e']], to: v.filt('bandpass', 1800, 2, { t }) });
        crack(v, t, 0.1, { hp: 2500, n: 2, gap: 0.008, dec: 0.006 });
      }
      // the reversed breath, then the held plateau (a narrow 2.8 kHz band with a slow wobble)
      sweep(v, 0, D, [600, 1600, 2800], 0.12, { kind: 'pink', peakAt: 0.98 });
      const band = v.filt('bandpass', 2800, 6, { t: D });
      v.lfo(band.frequency, 3, 120, { t: D, d: E - D });
      v.noise('pink', { t: D, g: [[0, 0.0001], [0.05, 0.05], [H - D, 0.05], [E - D, 0.0001, 'e']], to: band });
      // the rib rattle through the plateau
      const rat = v.flutter(22, 0.8, { t: 0.2, d: H, to: v.filt('bandpass', 900, 3, { t: 0.2 }) });
      v.noise('pink', { t: 0.2, g: hold(0.06, 0.25, H - 0.2, E - 0.2), to: rat });
      // two quickening heart thumps
      for (const t of [0.3, 0.42]) {
        thump(v, t, 48, 38, 0.4, 0.14, { drive: 1.5 });
        thump(v, t, 96, 76, 0.16, 0.1, { drive: 2.5 });
        knock(v, t, 0.1, 0.06);
      }
    },
  },
  /** The exhale (the bank is born at the muzzle). */
  ashenExhale: {
    cap: 2,
    gap: 0.1,
    verb: 0.15,
    duck: 0.35,
    play(v) {
      puff(v, 0, 0.45, 0.35, 2500, { kind: 'pink' });
      thump(v, 0, 80, 40, 0.4, 0.25);
      crack(v, 0.01, 0.06, { hp: 2500, n: 3, gap: 0.02 });
    },
  },
  /** The bank rolls to the target (sustained; faded 40 ms before the swallow). */
  ashenRoll: {
    cap: 2,
    gap: 0.1,
    verb: 0.1,
    duck: 0.3,
    play(v) {
      sweep(v, 0, 1.2, [800, 1800, 2500], 0.12, { kind: 'pink', q: 1.1, peakAt: 0.6 });
      const tum = v.amp(1);
      v.wander(tum.gain, 7.5, 0.5, { d: 1.2 });
      v.noise('brown', { g: [[0, 0], [0.08, 0.4], [0.9, 0.35], [1.2, 0.0001, 'e']], to: v.filt('lowpass', 180, 0.8, { to: tum }) });
      for (let i = 0; i < 8; i++) crack(v, 0.05 + i * 0.13 + v.r(0, 0.05), 0.035, { hp: 2200, lp: 6000, dec: 0.004 });
    },
  },
  /** The duck carrier: the roll's last collapse, gone by 50 ms. No ticks. */
  ashenHush: {
    cap: 1,
    gap: 0.1,
    verb: 0,
    // the deepest duck the shared engine gives (applyDuck: depth = 1 − 0.5 × duck × volume ≥ 0.5, −6 dB);
    // ashenLub re-anchors it 40 ms later so the music stays down through the suck (critic r1 #10)
    duck: 1,
    play(v) {
      v.noise('brown', { g: [[0, 0], [0.015, 0.03], [0.05, 0.0001, 'e']], to: v.filt('lowpass', 300, 0.7) });
    },
  },
  /** THE ONE event of the silence: the drake's LUB carried to the target (under −40 dBFS by 60 ms). */
  ashenLub: {
    cap: 1,
    gap: 0.1,
    verb: 0,
    duck: 1,
    play(v) {
      thump(v, 0, 62, 46, 0.35, 0.05, { drive: 1.5 });
      thump(v, 0, 124, 92, 0.15, 0.04, { drive: 2.5 });
      knock(v, 0, 0.14, 0.03);
      sweep(v, 0, 0.04, [160, 170, 160], 0.05, { kind: 'pink', q: 8 });
    },
  },
  /** The suck: a 55 ms brown riser that peaks INTO the VUF. */
  ashenSuck: {
    cap: 1,
    gap: 0.05,
    verb: 0,
    play(v) {
      sweep(v, 0, 0.055, [180, 600, 1400], 0.05, { kind: 'brown', peakAt: 0.95 });
    },
  },
  /** The ignition — the VUF on the beat where the DUB should be: a whomp and a low-pass that slams open. */
  ashenIgnite: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.8,
    play(v) {
      thump(v, 0, 90, 34, 0.5, 0.45, { drive: 2.5 });
      // the whomp's floor: a 55 → 28 Hz sine under it (the ash bank's weight; the wyrm's impact has none)
      thump(v, 0, 55, 28, 0.7, 0.7);
      puff(v, 0, 0.6, 0.5, 600, { kind: 'brown', att: 0.002 });
      // the low-pass slams open — to 3 kHz only (r2, SE-4 vs wyrmBreathImpact: the glassy top stays the wyrm's)
      v.noise('brown', { g: [[0, 0], [0.002, 0.25], [0.9, 0.0001, 'e']], to: v.filt('lowpass', [[0, 250], [0.03, 1200, 'e'], [0.9, 300, 'e']], 0.9) });
      crack(v, 0.002, 0.7, { hp: 5000, lp: 10000, n: 4, gap: 0.009, dec: 0.02 });
      // the fire bed, then the ember sizzle (3.5–7 kHz)
      v.noise('brown', { t: 0.02, g: [[0, 0], [0.03, 0.2], [1.0, 0.0001, 'e']], to: v.filt('bandpass', 260, 1.2, { t: 0.02 }) });
      for (let i = 0; i < 14; i++) crack(v, 0.1 + i * 0.045 + v.r(0, 0.02), 0.5 * (1 - i * 0.05), { hp: 5500, lp: 10000, dec: 0.006 });
    },
  },

  /** The fuse back: 4 shrinking whomps from the target toward the attacker. */
  ashenFuse: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      [0.35, 0.25, 0.17, 0.11].forEach((g, i) => {
        const t = i * 0.08;
        const out = v.panner(0.5 - i * 0.33, { t });
        thump(v, t, 90, 34, g, 0.2, { drive: 2, to: out });
        puff(v, t, g * 0.6, 0.15, 2000 - i * 260, { kind: 'brown', to: out });
      });
    },
  },
  /** The losing ignition: the fire does not take. */
  ashenSputter: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      for (const t of [0, 0.09, 0.2]) puff(v, t, 0.12, 0.12, 1400, { kind: 'brown' });
      crack(v, 0.02, 0.06, { hp: 2000, n: 3, gap: 0.08, dec: 0.006 });
      sweep(v, 0.05, 0.4, [900, 400, 200], 0.05, { kind: 'pink' });
    },
  },
  /** The blocked pile-up against the guard. */
  ashenSnuff: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      puff(v, 0, 0.35, 0.3, 900, { kind: 'brown' });
      sweep(v, 0, 0.3, [300, 900, 300], 0.12, { kind: 'pink', q: 2 });
    },
  },
  /** Death start: the first crackle. */
  ashenCrackle: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      crack(v, 0, 0.2, { hp: 1800, lp: 6000, n: 6, gap: 0.03, dec: 0.008 });
      thump(v, 0, 70, 40, 0.25, 0.2);
    },
  },
  /** Death `dissolve`: the top-down crumble. */
  ashenCrumble: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      // r2: +7 dB (critic r1 #9: the collapse sat at about −40 dB) and re-voiced away from magusCollapse
      // (SE-4): a sand-and-ember sizzle up top and a soft low slump, the middle left empty
      sweep(v, 0, 0.6, [6000, 4500, 3200], 0.25, { kind: 'white', q: 2 });
      for (let i = 0; i < 22; i++) crack(v, i * 0.025 + v.r(0, 0.01), 0.16 * (1 - i * 0.03), { hp: 3500, lp: 8000, dec: 0.004 });
      puff(v, 0.1, 0.6, 0.5, 260, { kind: 'brown' });
      thump(v, 0.12, 80, 40, 0.3, 0.25, { drive: 1.5 });
    },
  },

  /** The heart drops into the heap. */
  ashenCoreDrop: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      thump(v, 0, 120, 60, 0.35, 0.2, { to: v.filt('lowpass', 600, 0.7) });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.03, 0.035], [0.4, 0.0001, 'e']], to: v.filt('highpass', 4000, 0.7, { t: 0.02 }) });
    },
  },
  /** The heap cools and the wind takes it. */
  ashenCool: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      v.noise('white', { g: [[0, 0], [0.05, 0.04], [1.0, 0.0001, 'e']], to: v.filt('highpass', 5000, 0.7) });
      sweep(v, 0.25, 0.8, [400, 1400, 500], 0.14, { kind: 'pink', pan: [-0.4, 0.6] });
      for (const t of [0.15, 0.4, 0.7]) crack(v, t, 0.05, { hp: 2200, lp: 6000, dec: 0.006 });
    },
  },
  /** The cloak re-seating plate by plate (attack f10–f13). */
  ashenRegrow: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.15,
    play(v) {
      const top = v.filt('lowpass', 4000, 0.7);
      const hp = v.filt('highpass', 1600, 0.8, { to: top });
      for (let i = 0; i < 12; i++) v.noise('white', { t: i * 0.035 + v.r(0, 0.01), g: [[0, 0], [0.0003, 0.07 * (1 - i * 0.06)], [0.006, 0.0001, 'e']], to: hp });
      sweep(v, 0, 0.25, [600, 1200, 900], 0.03, { kind: 'pink' });
    },
  },
  /** The last ember's pulse: a faint double tick (no sub), then it goes out. */
  ashenLastBeat: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      heartbeat(v, 0, 0.25, 0);
      v.noise('white', { t: 0.3, g: [[0, 0], [0.02, 0.02], [0.15, 0.0001, 'e']], to: v.filt('highpass', 5000, 0.7, { t: 0.3 }) });
    },
  },
  /** Revive: the gathering in the heap (sustained; stopped on `land`). */
  ashenReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      // r2 (SE-4 vs magusReviveGather): the riser stays low, the gathering embers crackle up top
      sweep(v, 0, 1.2, [150, 400, 600], 0.08, { kind: 'brown', peakAt: 0.5 });
      ribs(v, 0.1, 1.0, 0.12);
      for (let i = 0; i < 30; i++) {
        const t = 1.2 * Math.sqrt(i / 30);
        crack(v, t, 0.18 + i * 0.006, { hp: 3500, lp: 7500, dec: 0.004 });
      }
      for (const t of [0.15, 0.32, 0.62, 0.79]) {
        thump(v, t, 50, 36, 0.45, 0.18, { drive: 1.5 });
        thump(v, t, 112, 84, 0.12, 0.1, { drive: 2.5 });
        knock(v, t, 0.12, 0.06);
      }
    },
  },
  /** Revive `land`: the heartbeat ×2, louder, with the kindle's puff. */
  ashenReviveBeat: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      heartbeat(v, 0, 1.4);
      puff(v, 0.02, 0.2, 0.3, 500, { kind: 'brown' });
      // r2 (SE-4 vs magusReviveSettle): the re-lit plates flare as a dry ember burst
      crack(v, 0.01, 0.3, { hp: 3500, lp: 7500, n: 8, gap: 0.02, dec: 0.006 });
    },
  },
} satisfies Record<string, Recipe>;

export type AshenSfxName = keyof typeof V3_ASHEN_RECIPES;

/** The sustained sounds (the cinematic ends them with sfx.start(...).stop()). */
export const ASHEN_SUSTAINED: readonly AshenSfxName[] = ['ashenTornado', 'ashenInhale', 'ashenRoll', 'ashenReviveGather'];
