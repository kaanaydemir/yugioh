// Hortlak Muhafız (grim_warden) — v3 sounds (lane B). Spread into the game through ./kart-b.ts.
// Identity: docs/v3/YENI_KARTLAR.md §5.1 R2 "sarkaç zincir · cam fener + ruh ateşi · emme (glassReverse iner)".
// Built from ./kit.ts blocks and the Voice primitives only (no new DSP).
//
// Palette (one parameter set, clear of the slice's two characters and the lane's other three cards):
//   key        B♭ minor — the lantern's glass rings on B♭4 … F6 (MIDI 70–89): a full octave + below the
//              wyrm's E-major pentatonic glass (E6–B7) and in a minor key; its tritone choir sits on F / B
//              (never the magus' D / G#).
//   chain      the pendulum chain: `link` pings on two inharmonic pitches (1180 / 1630 Hz) that come in
//              slow, periodic pairs with a dry iron creak (band-passed brown friction) — a creak, never a
//              rattle, except when the chain runs out on the throw.
//   soul fire  a breathy band of pink noise with a slow flutter and a hollow F1 / C2 hum under it (a saw
//              drone on F, not the magus' D saw tritone).
//   siphon     the drain is the only layer in the game built on `glassReverse` as its identity: reversed
//              glass swells stepping DOWN the B♭-minor ladder, each one stopping dead, faster and faster.
//   iron       the cage helm and the spade: FM clanks at ratio 2.13 / 1.73 on 330–380 Hz and 1.1–1.2 kHz
//              (away from the magus' 1.41 armour at 470–760 Hz).
//
//   gwRise       summon: earth cracks, a gravestone grinds, the soul light seeps out (sustained, faded at land)
//   gwStone      summon: the gravestone is flung up / topples onto the soil
//   gwLand       summon 'land': boots on soil, the chain settles, the lantern catches
//   gwRoar       cut-in eye flare: the tritone choir (F / B) under a lantern flare and one deep bell
//   gwCharge     strike charge (sustained): the chain whirls up overhead, the lantern hums
//   gwSwing      strike f4: the whirl comes over — a heavy chain whoosh and a creak
//   gwRelease    strike 'release': the chain runs out (links), a ghost whine flies with the lantern
//   gwImpact     strike 'contact': the lantern smashes — glass, a green soul burst, the whine breaks
//   gwChop       strike f8: the spade-halberd sweeps through — iron scrape, a thud into the floor
//   gwSiphon     effect: the glassReverse siphon (sustained, ≈1.2 s, faded when the thread closes)
//   gwThread     effect: a sine falling from the target's own pitch (the cinematic passes `pitch`)
//   gwDebuff     effect: the −400 — a low dull bell
//   gwGiveBack   effect: the target survives — the light flows back (a short rising glass breath)
//   gwKeep       effect aftermath: the target died — the lantern locks its colour (a low glass knock)
//   gwShatter    death: the lantern slips and shatters on the floor
//   gwWail       death: the soul fire leaves as a skull-shaped mist — a hollow falling wail
//   gwCollapse   death 'dissolve': the empty shroud collapses (cloth, a soft dull thud)
//   gwHelm       death: the empty cage helm hits the floor and rocks (also its bounce, quieter)
//   gwFade       death: the heap fades to ash (the last exhale, a faint glass ring)
//   gwReviveGather / gwReviveLand   soul_recall's revive pair

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Voice } from '../synth';
import { clank, crack, drone, glassBell, glassRain, glassReverse, link, puff, sweep, thump } from './kit';

// ================================================================ palette

/** B♭ minor lantern glass, B♭4 … F6 (midi). */
const GLASS = [70, 73, 75, 77, 78, 80, 82, 85, 87, 89] as const;
/** The descending siphon ladder (B♭6 → B♭4, B♭ natural minor). */
const SIPHON = [94, 92, 89, 87, 85, 84, 82, 80, 77, 75, 73, 70] as const;
/** The soul fire's hollow hum: F1 (43.7 Hz). */
const F1 = midiHz(29);
/** The chain's two link pitches (inharmonic pair). */
const LINK_A = 1180;
const LINK_B = 1630;

/** One creak of the pendulum chain: a dry iron friction (band-passed brown) and two link pings. */
function creak(v: Voice, t: number, g: number, o: { pan?: number; to?: AudioNode; up?: boolean } = {}): void {
  const out = o.pan !== undefined ? v.panner(o.pan, { to: o.to }) : o.to;
  const d = 0.13;
  const fr = v.flutter(70, 0.7, { t, d: d + 0.02, base: 0.35, to: v.filt('bandpass', [[0, o.up ? 820 : 1050], [d, o.up ? 1150 : 760, 'e']], 4, { t, to: out }) });
  v.noise('brown', { t, g: [[0, 0], [0.02, g * 1.6], [d, 0.0001, 'e']], to: fr });
  link(v, LINK_A * v.r(0.99, 1.01), t + 0.01, g * 0.5, 0.09, out);
  link(v, LINK_B * v.r(0.99, 1.01), t + 0.05, g * 0.32, 0.07, out);
}

/** The soul fire's breath: a fluttering band of pink noise (centre `f`) over `d` seconds. */
function soulBreath(v: Voice, t: number, d: number, f: number, g: number, o: { to?: AudioNode; rate?: number } = {}): void {
  const fl = v.flutter(o.rate ?? 9, 0.45, { t, d: d + 0.05, base: 0.6, to: v.filt('bandpass', [[0, f * 0.8], [d * 0.5, f * 1.15, 'e'], [d, f * 0.9, 'e']], 2.2, { t, to: o.to }) });
  v.noise('pink', { t, g: [[0, 0], [d * 0.3, g], [d * 0.75, g * 0.8], [d, 0.0001, 'e']], to: fl });
}

/** A ghost whine: a thin sine pair gliding f0 → f1 with a slow, wide vibrato (the soul in flight). */
function whine(v: Voice, t: number, d: number, f0: number, f1: number, g: number, o: { to?: AudioNode } = {}): void {
  for (const [det, gg] of [
    [0, 1],
    [13, 0.6],
  ] as const) {
    const s = v.tone('sine', [[0, f0], [d, f1, 'e']], { t, g: [[0, 0], [d * 0.25, g * gg], [d * 0.7, g * gg * 0.7], [d, 0.0001, 'e']], detune: det, to: o.to });
    v.lfo(s.osc.detune, [[0, 5], [d, 8, 'e']], [[0, 18], [d, 55]], { t, d: d + 0.02 });
  }
}

// ================================================================ recipes

export const GRIM_WARDEN_RECIPES = {
  /** Summon: the grave mound swells — the earth cracks, a gravestone grinds, the soul light seeps out. Faded at land. */
  gwRise: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      const D = 1.6;
      // the earth cracks: low, dry, accelerating clods of brown noise (driven a little)
      const times: number[] = [];
      const gains: number[] = [];
      let t = 0.02;
      for (let i = 0; t < D * 0.75; i++) {
        times.push(t);
        gains.push(0.2 + 0.35 * (t / D) * v.r(0.6, 1));
        t += Math.max(0.03, 0.16 * Math.pow(0.86, i)) * v.r(0.75, 1.25);
      }
      v.bursts(times, gains, { dec: 0.03, f: 420, q: 1.3, kind: 'brown', drive: 2.5, trim: 0.6 });
      v.bursts(times.filter((_, i) => i % 2 === 1), gains.filter((_, i) => i % 2 === 1).map((g) => g * 0.5), { dec: 0.012, f: 2400, q: 1.6 });
      // the gravestone grinds against the soil: a gritty low sweep that rises with the stone
      const grit = v.flutter(38, 0.6, { t: 0.25, d: 0.9, base: 0.4, to: v.filt('bandpass', [[0, 260], [0.7, 520, 'e'], [0.9, 380, 'e']], 2.5, { t: 0.25 }) });
      v.noise('brown', { t: 0.25, g: [[0, 0], [0.3, 0.55], [0.75, 0.45], [0.9, 0.0001, 'e']], to: v.drive(3, { to: grit, trim: 0.6 }) });
      // the soul light seeps through the cracks: a hollow F hum and glass that swells in reverse
      drone(v, 0.1, D + 0.2, F1, 0.075, { lp: [120, 520, 200], beat: 0.35 });
      soulBreath(v, 0.35, D - 0.2, 900, 0.09, { rate: 7 });
      [77, 73, 70].forEach((m, i) => glassReverse(v, midiHz(m), 0.45 + i * 0.32, 0.03 + i * 0.008, 0.28));
      v.tone('sine', [[0, midiHz(65)], [D, midiHz(70), 'e']], { t: 0.4, g: [[0, 0], [0.6, 0.03], [D - 0.4, 0.035], [D, 0.0001, 'e']] });
    },
  },
  /** Summon: the gravestone is flung up off the mound and topples onto the soil (stone knock + gravel). */
  gwStone: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      thump(v, 0, 150, 48, 0.55, 0.28, { drive: 2 });
      v.tone('triangle', [[0, 330], [0.06, 140, 'e']], { g: perc(0.22, 0.09, 0.001) });
      crack(v, 0, 0.3, { hp: 1800, lp: 6000, n: 2, gap: 0.014, dec: 0.01 });
      puff(v, 0.005, 0.32, 0.4, 1100, { kind: 'brown' });
      // gravel pattering down after it
      v.crackle({ t: 0.06, d: 0.42, n: 16, g: 0.14, f: 2600, q: 1.1, curve: 1.5, dec: 0.008 });
    },
  },
  /** Summon 'land': iron-shod boots on soil, the chain settles link by link, the lantern catches (whoomp). */
  gwLand: {
    cap: 2,
    gap: 0.06,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      thump(v, 0, 120, 40, 0.55, 0.36, { drive: 2 });
      puff(v, 0.004, 0.3, 0.35, 900, { kind: 'brown' });
      // the boots' iron: a short dull clank (ratio 2.13, low)
      clank(v, 360, 0.008, 0.05, 0.22, { ratio: 2.13, index: 2.2, click: 0.8 });
      // the chain settles: three links falling slack, slower each time
      [0.05, 0.13, 0.25].forEach((t, i) => link(v, (i % 2 ? LINK_B : LINK_A) * v.r(0.99, 1.01), t, 0.05 * (1 - i * 0.25), 0.08));
      // the lantern catches: a rising whoomp of soul fire and its glass answering on B♭5
      sweep(v, 0.03, 0.32, [300, 1400, 700], 0.22, { q: 1.4, kind: 'pink', peakAt: 0.35 });
      glassBell(v, midiHz(82), 0.06, 0.05, 0.9, { modes: 3 });
      glassBell(v, midiHz(77), 0.07, 0.03, 0.7, { modes: 2 });
    },
  },
  /** The cut-in's eye flare: a tritone choir on F / B ("oo"), the lantern flaring white, one deep bell. */
  gwRoar: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.65,
    play(v) {
      const D = 1.4;
      const out = v.amp(1);
      // the choir: formant "oo → oh" over detuned saws — F2, C3, B2 (the tritone) and F3
      const split = v.amp(1, { to: v.filt('bandpass', [[0, 320], [0.45, 520, 'e'], [D, 360, 'e']], 3, { to: out }) });
      split.connect(v.filt('bandpass', [[0, 780], [0.45, 980, 'e'], [D, 700, 'e']], 4, { to: out }));
      for (const [m, det, gg] of [
        [41, 0, 1],
        [48, 5, 0.75],
        [47, -6, 0.7],
        [53, 3, 0.55],
      ] as const) {
        const s = v.tone('sawtooth', midiHz(m), { t: m === 47 ? 0.12 : 0, g: [[0, 0], [0.18, 0.26 * gg], [0.7, 0.2 * gg], [D, 0.0001, 'e']], to: split, detune: det + v.r(-4, 4) });
        v.lfo(s.osc.detune, 5.2, 9, { d: D });
      }
      // the lantern flares: a fast rising band of fire and its B♭ glass ringing out
      sweep(v, 0, 0.42, [500, 3200, 1800], 0.2, { q: 1.6, kind: 'pink', peakAt: 0.3 });
      glassBell(v, midiHz(82), 0.12, 0.06, 1.3, { modes: 3 });
      glassBell(v, midiHz(89), 0.16, 0.035, 1, { modes: 2 });
      glassRain(v, { t: 0.2, d: 0.9, n: 9, g: 0.03, notes: GLASS, curve: 1.3, dec: [0.1, 0.35] });
      // one deep bell under it (F2, a dull FM partial set) and the chest of the warden
      v.bell(midiHz(41), { t: 0.02, g: 0.12, dec: 1.4, ratio: 2.13, index: 1.6 });
      thump(v, 0, 85, 30, 0.24, 0.7, { drive: 1.5 });
      creak(v, 0.5, 0.08, { pan: -0.2 });
    },
  },
  /** Strike charge (sustained): the chain whirls up overhead — whooshes and link ticks quicken, the lantern hums. Faded at the release. */
  gwCharge: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const D = 0.55;
      const H = D + 0.45;
      const E = H + 0.15;
      // the whirl: a whoosh per turn, each one shorter (the chain speeding up), left ↔ right
      let t = 0.02;
      let period = 0.3;
      for (let i = 0; t < H; i++) {
        const k = Math.min(1, t / D);
        sweep(v, t, period * 0.9, [380, 900 + 500 * k, 420], 0.12 + 0.12 * k, { q: 1.5, kind: 'pink', peakAt: 0.45, pan: i % 2 ? [0.25, -0.25] : [-0.25, 0.25] });
        link(v, (i % 2 ? LINK_B : LINK_A) * v.r(0.98, 1.02), t + period * 0.45, 0.03 + 0.03 * k, 0.06);
        t += period;
        period = Math.max(0.12, period * 0.82);
      }
      // the lantern hums: a soul-fire tone pair on F4 rising to B♭4, its vibrato quickening
      for (const [det, g] of [
        [0, 0.045],
        [11, 0.03],
      ] as const) {
        const s = v.tone('triangle', [[0, midiHz(65)], [D, midiHz(70), 'e']], { g: [[0, 0.0001], [D, g, 'e'], [H, g], [E, 0.0001, 'e']], detune: det });
        v.lfo(s.osc.detune, [[0, 4], [D, 11, 'e']], [[0, 8], [D, 26]], { d: E });
      }
      soulBreath(v, 0, H, 1200, 0.08, { rate: 11 });
      v.tone('sine', [[0, F1], [D, F1 * 1.5, 'e']], { g: [[0, 0], [D, 0.14], [H, 0.14], [E, 0.0001, 'e']] });
    },
  },
  /** Strike f4: the whirl comes over the head — one heavy chain whoosh, a creak at the top. */
  gwSwing: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    vary: 0.03,
    play(v) {
      sweep(v, 0, 0.11, [320, 1300, 500], 1.8, { q: 1.4, kind: 'pink', pan: [-0.3, 0.3], peakAt: 0.4 });
      sweep(v, 0.01, 0.09, [900, 2600, 1200], 0.5, { q: 2, kind: 'white', peakAt: 0.4 });
      creak(v, 0.0, 0.16, { up: true });
    },
  },
  /** Strike 'release': the chain runs out to its full length (a fast run of links) and a ghost whine flies with the lantern. */
  gwRelease: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.35,
    play(v) {
      for (let i = 0; i < 7; i++) link(v, (i % 2 ? LINK_B : LINK_A) * (1 - i * 0.015) * v.r(0.99, 1.01), i * 0.016, 0.13 * (1 - i * 0.08), 0.05);
      sweep(v, 0, 0.16, [700, 2200, 900], 0.75, { q: 1.3, kind: 'white', pan: [-0.2, 0.3], peakAt: 0.3 });
      whine(v, 0.01, 0.2, midiHz(89), midiHz(82), 0.07);
      soulBreath(v, 0, 0.18, 1600, 0.3, { rate: 14 });
    },
  },
  /** Strike 'contact': the lantern smashes — glass bursting (B♭ minor), a green soul burst, the whine breaks downward. */
  gwImpact: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      crack(v, 0, 0.7, { hp: 2400, lp: 9000, n: 3, gap: 0.009, dec: 0.011 });
      thump(v, 0, 130, 38, 0.5, 0.38, { drive: 2.2 });
      // the soul burst: a pink whoomp swelling through a rising band, its hollow hum under it
      v.noise('pink', { g: [[0, 0], [0.012, 0.42], [0.32, 0.0001, 'e']], to: v.filt('bandpass', [[0, 500], [0.08, 1800, 'e'], [0.32, 600, 'e']], 1.3) });
      v.tone('sawtooth', [[0, F1 * 2], [0.4, F1, 'e']], { g: perc(0.07, 0.42, 0.004), to: v.filt('lowpass', 320, 1.2) });
      // the glass: struck panes and a shard rain in the warden's key
      glassBell(v, midiHz(82), 0.002, 0.085, 0.8, { modes: 4 });
      glassBell(v, midiHz(77), 0.006, 0.06, 0.7, { modes: 3 });
      glassRain(v, { t: 0.01, d: 0.55, n: 16, g: 0.07, notes: GLASS, curve: 1.8, dec: [0.04, 0.2], spread: 0.7 });
      // the ghost's whine breaks and falls away
      whine(v, 0.02, 0.36, midiHz(87), midiHz(70), 0.03);
    },
  },
  /** Strike f8: the spade-halberd sweeps through and bites the floor — iron scrape, a heavy thud, a dull clank. */
  gwChop: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      sweep(v, 0, 0.12, [600, 2600, 1200], 0.45, { q: 2.2, kind: 'white', pan: [-0.3, 0.3], peakAt: 0.55 });
      // the iron edge rasps
      const rasp = v.flutter(90, 0.6, { t: 0.02, d: 0.12, base: 0.4, to: v.filt('bandpass', 3400, 3) });
      v.noise('white', { t: 0.02, g: perc(0.14, 0.1, 0.01), to: rasp });
      thump(v, 0.09, 140, 44, 0.5, 0.26, { drive: 1.8 });
      clank(v, 380, 0.09, 0.07, 0.4, { ratio: 2.13, index: 2.6, click: 1.2 });
      puff(v, 0.095, 0.22, 0.3, 1100, { kind: 'brown' });
    },
  },
  /**
   * Effect: the siphon — reversed glass swells stepping DOWN the B♭-minor ladder, each stopping dead, faster and
   * faster; an inhaled soul-fire breath and the hollow hum under it. Sustained (≈1.2 s), faded when the thread closes.
   */
  gwSiphon: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.45,
    play(v) {
      const D = 1.25;
      let t = 0;
      let rise = 0.16;
      for (let i = 0; i < SIPHON.length && t < D - 0.05; i++) {
        glassReverse(v, midiHz(SIPHON[i]), t, 0.1 + Math.min(i, 6) * 0.008, rise);
        // a low double an octave under every third step (the body of the pull)
        if (i % 3 === 2) glassReverse(v, midiHz(SIPHON[i] - 12), t, 0.065, rise);
        t += rise * 0.72;
        rise = Math.max(0.06, rise * 0.9);
      }
      // the inhale: pink breath through a band falling 2.4 kHz → 500 Hz (drawn INTO the lantern)
      v.noise('pink', { g: [[0, 0.0001], [0.25, 0.12, 'e'], [D - 0.2, 0.14], [D, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2400], [D, 500, 'e']], 1.8) });
      drone(v, 0, D + 0.15, F1, 0.035, { lp: [160, 480, 180], att: 0.4, beat: 0.5 });
      v.tone('sine', [[0, F1 * 2], [D, F1 * 1.5, 'e']], { g: [[0, 0], [0.3, 0.07], [D, 0.0001, 'e']] });
    },
  },
  /** Effect: the target's own tone, a sine falling toward the lantern (the cinematic passes the target's `pitch`). */
  gwThread: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    play(v) {
      const D = 0.95;
      // (base A5; the attribute pitch factor moves it: fire up, water down …)
      for (const [det, g] of [
        [0, 0.08],
        [7, 0.05],
      ] as const) {
        const s = v.tone('sine', [[0, 880], [D, 440, 'e']], { g: [[0, 0], [0.08, g], [D * 0.75, g * 0.8], [D, 0.0001, 'e']], detune: det });
        v.lfo(s.osc.detune, 6, [[0, 6], [D, 30]], { d: D + 0.02 });
      }
      v.tone('sine', [[0, 1760], [D, 880, 'e']], { g: [[0, 0], [0.1, 0.012], [D, 0.0001, 'e']] });
    },
  },
  /** Effect: the −400 lands on the target's plate — a low, dull bell (F3, FM 2.13) with a soft knock. */
  gwDebuff: {
    cap: 2,
    gap: 0.1,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      v.bell(midiHz(53), { g: 0.2, dec: 1.2, ratio: 2.13, index: 1.8, idxDec: 0.25 });
      v.bell(midiHz(41), { t: 0.004, g: 0.12, dec: 1.4, ratio: 1.73, index: 1.2 });
      thump(v, 0, 110, 50, 0.3, 0.2);
      v.tone('sine', midiHz(53) * 1.004, { g: perc(0.04, 1.1, 0.01) });
    },
  },
  /** Effect: the target survives — the borrowed light flows back (a short rising glass breath, quiet). */
  gwGiveBack: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      sweep(v, 0, 0.4, [600, 2200, 3000], 0.22, { q: 2.2, kind: 'pink', peakAt: 0.7 });
      [70, 73, 77].forEach((m, i) => glassBell(v, midiHz(m), 0.05 + i * 0.07, 0.06, 0.4, { modes: 2 }));
    },
  },
  /** Effect aftermath: the target died — the lantern locks its colour (a low glass knock and its ring). */
  gwKeep: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      glassBell(v, midiHz(70), 0, 0.1, 1.1, { modes: 3 });
      glassBell(v, midiHz(58), 0.003, 0.07, 1.3, { modes: 2 });
      v.noise('white', { g: perc(0.12, 0.006, 0.0003), to: v.filt('bandpass', 2600, 2) });
    },
  },
  /** Death: the lantern slips off its chain and shatters on the floor (glass, a burst of soul fire guttering). */
  gwShatter: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.4,
    play(v) {
      link(v, LINK_A, 0, 0.06, 0.08);
      crack(v, 0.07, 0.5, { hp: 2600, n: 3, gap: 0.01, dec: 0.012 });
      thump(v, 0.07, 160, 60, 0.3, 0.16, { drive: 1.4 });
      glassRain(v, { t: 0.075, d: 0.5, n: 16, g: 0.055, notes: GLASS, curve: 1.9, dec: [0.04, 0.18], spread: 0.6 });
      glassBell(v, midiHz(85), 0.075, 0.04, 0.5, { modes: 3 });
      // the soul fire gutters: a fluttering breath that chokes off
      soulBreath(v, 0.08, 0.38, 1400, 0.14, { rate: 18 });
    },
  },
  /** Death: the soul fire escapes as a skull-shaped mist — a hollow formant wail ("oo → ah → oo") that falls away. */
  gwWail: {
    cap: 1,
    gap: 0.3,
    verb: 0.7,
    duck: 0.35,
    play(v) {
      const D = 0.95;
      const out = v.amp(1);
      const split = v.amp(1, { to: v.filt('bandpass', [[0, 360], [0.3, 700, 'e'], [D, 380, 'e']], 3, { to: out }) });
      split.connect(v.filt('bandpass', [[0, 900], [0.3, 1150, 'e'], [D, 800, 'e']], 4, { to: out }));
      for (const [det, gg] of [
        [0, 1],
        [19, 0.7],
        [-14, 0.6],
      ] as const) {
        const s = v.tone('sawtooth', [[0, midiHz(65)], [0.22, midiHz(70), 'e'], [D, midiHz(58), 'e']], { g: [[0, 0], [0.12, 0.3 * gg], [0.5, 0.24 * gg], [D, 0.0001, 'e']], to: split, detune: det });
        v.lfo(s.osc.detune, [[0, 5], [D, 3.5]], [[0, 15], [D, 45]], { d: D });
      }
      whine(v, 0.05, D - 0.1, midiHz(82), midiHz(70), 0.03);
      v.noise('pink', { g: [[0, 0], [0.2, 0.06], [D, 0.0001, 'e']], to: v.filt('highpass', 2500) });
    },
  },
  /** Death 'dissolve': the empty shroud collapses — falling cloth flutter, a soft dull thud, dust. */
  gwCollapse: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const flap = v.flutter(26, 0.65, { d: 0.5, base: 0.4, to: v.filt('bandpass', [[0, 1300], [0.45, 420, 'e']], 1.2) });
      v.noise('white', { g: [[0, 0], [0.04, 0.26], [0.48, 0.0001, 'e']], to: flap });
      thump(v, 0.12, 90, 36, 0.32, 0.32, { drive: 1.3 });
      puff(v, 0.13, 0.22, 0.45, 800, { kind: 'brown' });
    },
  },
  /** Death: the empty cage helm hits the floor and rocks (FM 2.13 iron on 330 Hz + a high 1.1 kHz bar). Also its bounce. */
  gwHelm: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    play(v) {
      clank(v, 330, 0, 0.1, 0.55, { ratio: 2.13, index: 2.8, click: 1.6 });
      clank(v, 1120, 0.004, 0.045, 0.35, { ratio: 1.73, index: 1.6, click: 0 });
      thump(v, 0, 170, 70, 0.22, 0.1);
      // the rock: two quieter knocks closing in
      clank(v, 335, 0.17, 0.035, 0.25, { ratio: 2.13, index: 2, click: 0.6 });
      clank(v, 338, 0.27, 0.02, 0.18, { ratio: 2.13, index: 1.6, click: 0.4 });
    },
  },
  /** Death: the empty heap fades to ash — the last exhale of soul fire and one faint glass ring (B♭4). */
  gwFade: {
    cap: 1,
    gap: 0.2,
    verb: 0.6,
    duck: 0.25,
    play(v) {
      v.noise('pink', { g: [[0, 0], [0.05, 0.4], [0.6, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [0.6, 300, 'e']], 1.4) });
      v.crackle({ d: 0.5, n: 18, g: 0.16, f: 3200, q: 1.2, curve: 1.3, dec: 0.006 });
      glassBell(v, midiHz(70), 0.02, 0.07, 1.4, { modes: 2 });
      v.tone('sine', midiHz(70) * 1.003, { t: 0.02, g: perc(0.012, 1.3, 0.01) });
    },
  },
  /** Revive: the heap refills — the chain drawn up link by link, reversed glass climbing, the hum rising. Faded at land. */
  gwReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    duck: 0.3,
    play(v) {
      const D = 0.45;
      const H = D + 0.3;
      const E = H + 0.12;
      // the chain is drawn up: link ticks closing in
      for (let i = 0; i < 9; i++) link(v, (i % 2 ? LINK_B : LINK_A) * (1 + i * 0.012), Math.pow(i / 9, 0.8) * D, 0.025 + i * 0.004, 0.05);
      // reversed glass climbing the ladder (the siphon's mirror: up, not down)
      let t = 0;
      for (let i = 0; t < H; i++) {
        const rise = Math.max(0.05, 0.12 - i * 0.01);
        glassReverse(v, midiHz(GLASS[Math.min(GLASS.length - 1, i)]), t, 0.022 + i * 0.002, rise);
        t += rise * 0.7;
      }
      drone(v, 0, E, F1, 0.08, { lp: [120, 480, 260], att: D, beat: 0.4 });
      soulBreath(v, 0, H, 1000, 0.1, { rate: 8 });
    },
  },
  /** Revive 'land': whole again — boots on stone, the helm seats with an iron clunk, the lantern relights. */
  gwReviveLand: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.35,
    play(v) {
      thump(v, 0, 115, 42, 0.5, 0.3, { drive: 1.6 });
      clank(v, 345, 0.01, 0.06, 0.35, { ratio: 2.13, index: 2.2, click: 1 });
      sweep(v, 0.02, 0.28, [300, 1300, 700], 0.18, { q: 1.4, kind: 'pink', peakAt: 0.35 });
      glassBell(v, midiHz(82), 0.05, 0.045, 0.9, { modes: 3 });
    },
  },
} satisfies Record<string, Recipe>;

export type GrimWardenSfxName = keyof typeof GRIM_WARDEN_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry). */
export const GRIM_WARDEN_VOICE: CharacterSounds | null = {
  roar: 'gwRoar',
  arrive: 'gwRise',
  land: 'gwLand',
  charge: 'gwCharge',
  swing: 'gwSwing',
  release: 'gwRelease',
  impact: 'gwImpact',
  deathStart: 'gwShatter',
  dissolve: 'gwCollapse',
  afterDissolve: [[2, 'gwHelm', 0.8]],
  burst: 'gwFade',
  reviveGather: 'gwReviveGather',
  reviveLand: 'gwReviveLand',
};

