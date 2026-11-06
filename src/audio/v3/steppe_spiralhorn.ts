// Bozkır Boynuzlusu (steppe_spiralhorn, C11) sounds — docs/v3/oturum-c-tasarim.md §2.5 "SOUND", YENI_KARTLAR §5.1.
// Spread into src/audio/sounds.ts RECIPES (V3_SPIRALHORN_RECIPES); SfxName gains SpiralhornSfxName; the voice object
// SPIRALHORN_VOICE is the card's CHARACTER_SOUNDS entry (src/cinematics/_v3/sound.ts). Only the v3 look plays these.
//
// Identity (owned by C11 in lane C, §3.6): the 3 kHz GRASS HISS (broadband white noise band-passed at 3 kHz, sustained,
// wandering), HORN + HOOF (keratin cracks band-passed 1.5 → 3.5 kHz, quad hoof ticks at 2.2 kHz over a 220 → 160 Hz
// knock), and the SPIRAL-HORN FLUTE: a breathy sine on the open fifth of a steppe mode, A5 880 / D6 1175 Hz, with a
// band-passed breath, an octave below at a quarter and a DELAYED 6 Hz vibrato. It never sweeps continuously (C3's
// whistle), never runs more than 3 notes in a moment (S12's pentatonic runs) and never buzzes (C9's string).
// Bans honoured (§0.2): no v1 shared recipe, no glassBell / glassRain / glassReverse, no pillow "pof", no tritone
// drone, no chain links, no pentatonic runs, nothing from the `rumble` palette. Built from ./kit.ts blocks and Voice
// primitives.
//
//   sshIdleFlute     idle accent (the horn-tip curls): grass swell + D6 flute slid in from C6 + a sniff (no ambient hook yet)
//   sshGrassGrow     summon: the tile grass grows in a travelling wave (rising rustle + soft riffle)
//   sshGustR / L     summon: the gust sweeps across the tile from his entry side (pink, panned L → R / R → L)
//   sshLeap          summon: the one long high bound in from off screen (a long low air sweep + the push-off tick)
//   sshFluteRise     summon: the flute at the leap's apex — A5 → D6, a rising fifth
//   sshTiptoe        summon 'land' / revive 'land': four hoof-tip ticks 25 ms apart + the grass flattening
//   sshHonk          roar: the saiga honk (nasal formants 450 / 1300 / 2400) and the flute after it
//   sshSeedLift      summon: seedheads lift off the tile grass (a sparse high riffle)
//   sshSnort         attack charge (held by the declaration): a snort — pink 900 Hz + a 2.4 kHz nostril edge
//   sshPaw           attack: the front hooves paw the air on the rear-up (air + two clicks)
//   sshTakeoff       attack: each take-off — hoof tick + grass "shhk" (3 → 2 kHz) + the breeze of the bound
//   sshApexFlute     attack: a soft flute fragment at each apex; played at pitch 1 / 1.1227 / 1.3352 → 880 / 988 / 1175
//   sshHoofTick      a landing on the hoof tips (two ticks)
//   sshDrop          attack release: the head drops into the pike (a short falling air)
//   sshHornCrack     attack contact: the keratin crack of the horn toss + its knock
//   sshSeedBurst     attack contact: the feather-grass seeds spray (fine 5 kHz riffle over 0.5 s + a release fwoosh)
//   sshHeadShake     attack follow-through: he shakes his head (ear flaps, a horn rattle, a small snort)
//   sshLockClack     blocked: the horns lock against the guard (a double keratin clack, a grind)
//   sshSlide         blocked: shoved back, sliding on the hooves (a short hoof scrape)
//   sshStruck        the struck body (hide + horn): a pink thump (lp 1 kHz) + a 900 Hz keratin tick
//   sshStruckHeavy   … a heavy / lethal blow: more body, the keratin rings, a hoof skitter
//   sshGuardClack    the guard (the pike fence) takes a blow: two cracks, hp 1.2 kHz and bp 2 kHz, 20 ms apart
//   sshExhale        death f1: two falling pink exhales
//   sshFold          death: a soft hide thud (the forelegs fold, then the hind legs: played twice)
//   sshGrassTurn     death 'dissolve': the coat turns to grass — a rising rustle
//   sshWindTakes     death: the wind takes the mound (pink sweep 500 → 2200 → 700 Hz, 0.9 s, panned leeward)
//   sshLastFlute     death: the last flute — D6 gliding down to A5 over 1.2 s, with vibrato and an echo
//   sshPlumeLift     death burst: the horns lift away as two seed plumes (a breathy rising air)
//   sshReviveGather  revive: the wind gathers the seeds back (sustained; stopped on 'land')

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

// ================================================================ the card's own blocks

const A5 = 880;
const D6 = 1174.66;

/**
 * The spiral-horn flute: a breathy sine. `f` is the pitch envelope (Hz), `g` the peak, `d` the length (s). The vibrato
 * (6 Hz, ±`vib` cents) only starts `vibAt` seconds in (delayed vibrato: the breath settles first); a band-passed breath
 * (Q 12) rides the pitch, an octave below sounds at a quarter, a faint 2nd harmonic gives the tube.
 */
function flute(v: Voice, t: number, f: readonly Pt[], g: number, d: number, o: { vib?: number; vibAt?: number; att?: number; breath?: number; to?: AudioNode } = {}): void {
  const att = o.att ?? 0.05;
  const env: Pt[] = [[0, 0], [att, g], [Math.max(att + 0.01, d * 0.45), g * 0.72], [d, 0.0001, 'e']];
  const vibAt = o.vibAt ?? 0.12;
  const vib: Pt[] = [[0, 0], [Math.min(d, vibAt), 0], [Math.min(d, vibAt + 0.12), o.vib ?? 18], [d, (o.vib ?? 18) * 0.8]];
  const main = v.tone('sine', f, { t, g: env, to: o.to });
  v.lfo(main.osc.detune, 6, vib, { t, d });
  const oct = v.tone('sine', f.map(([x, y, c]) => [x, y * 0.5, c] as Pt), { t, g: env.map(([x, y, c]) => [x, y * 0.25, c] as Pt), to: o.to });
  v.lfo(oct.osc.detune, 6, vib, { t, d });
  v.tone('sine', f.map(([x, y, c]) => [x, y * 2, c] as Pt), { t, g: env.map(([x, y, c]) => [x, y * 0.06, c] as Pt), to: o.to });
  // the breath: noise band-passed on the note, strongest in the attack
  const br = o.breath ?? 0.5;
  const bp = v.filt('bandpass', f, 12, { t, to: o.to });
  v.noise('white', { t, g: [[0, 0], [att * 0.6, g * br * 2.2], [att * 2, g * br * 0.9], [d, 0.0001, 'e']], to: bp });
}

/** The 3 kHz grass hiss: white noise band-passed at `f` (Q 1.2), a wandering level, swelling over `d`. */
function grass(v: Voice, t: number, d: number, g: number, o: { f?: number; q?: number; peakAt?: number; to?: AudioNode } = {}): void {
  const pk = o.peakAt ?? 0.4;
  const amp = v.amp(1, { t, to: o.to });
  v.wander(amp.gain, 9, 0.35, { t, d });
  const bp = v.filt('bandpass', o.f ?? 3000, o.q ?? 1.2, { t, to: amp });
  v.noise('white', { t, g: [[0, 0], [d * pk, g], [d, 0.0001, 'e']], to: bp });
}

/** One hoof tick: a dry 2.2 kHz crack (5 ms) over a short 220 → 160 Hz knock. */
function hoof(v: Voice, t: number, g: number, o: { to?: AudioNode; f?: number } = {}): void {
  const f = o.f ?? 2200;
  crack(v, t, g, { hp: f * 0.72, lp: f * 1.35, dec: 0.005, to: o.to });
  thump(v, t, 220, 160, g * 0.55, 0.03, { to: o.to });
}

/** The grass "shhk": white band-passed 3 → 2 kHz over ~80 ms. */
function shhk(v: Voice, t: number, g: number, d = 0.08, to?: AudioNode): void {
  const bp = v.filt('bandpass', [[0, 3000], [d, 2000, 'e']], 1.4, { t, to });
  v.noise('white', { t, g: [[0, 0], [0.006, g], [d, 0.0001, 'e']], to: bp });
}

/** The keratin tick of a horn (900 Hz-ish band, Q 6, short). */
function keratin(v: Voice, t: number, g: number, f = 900, dec = 0.025, to?: AudioNode): void {
  v.noise('white', { t, g: perc(g, dec, 0.0004), to: v.filt('bandpass', f, 6, { to }) });
  v.tone('triangle', f, { t, g: perc(g * 0.18, dec * 1.4, 0.0006), to });
}

/** A hollow keratin knock (r4): a short pitched triangle drop (`f` → 0.85 f) through a resonant band, its 2.7× partial
 *  — the horn's own hollow tone, never a low thump. */
function hollowKnock(v: Voice, t: number, g: number, f = 900): void {
  const bp = v.filt('bandpass', f, 4);
  v.tone('triangle', [[0, f], [0.035, f * 0.85, 'e']], { t, g: perc(g, 0.04, 0.0005), to: bp });
  v.tone('sine', [[0, f * 2.7], [0.02, f * 2.5, 'e']], { t, g: perc(g * 0.25, 0.018, 0.0004) });
  v.noise('white', { t, g: perc(g * 0.5, 0.012, 0.0003), to: v.filt('bandpass', f * 1.1, 6) });
}

/**
 * The saiga's nasal honk (r4, no breath layer): five detuned saws on `f` [a, b, c, e, z] through a grit drive (3) and a
 * HARD nasal formant bank — 450 / 1300 / 2400 Hz at Q 5 / 8 / 9 with the upper two pushed — over `d` s.
 */
function nasalHonk(v: Voice, t: number, d: number, f: readonly number[], g: number): void {
  const out = v.amp(1.3, { t });
  const bands = ([[450, 5, 0.8], [1300, 8, 1.25], [2400, 9, 0.9]] as const).map(([F, q, k]) =>
    v.filt('bandpass', [[0, F * 0.8], [0.2, F, 'e'], [d, F * 0.85, 'e']], q, { t, to: v.amp(k, { t, to: out }) }),
  );
  // the bank feeds the three formants only (never the output directly)
  const bank = v.amp(1, { t, to: bands[0] });
  bank.connect(bands[1]);
  bank.connect(bands[2]);
  const grit = v.drive(3, { to: bank, trim: 0.9 });
  const env: Pt[] = [[0, 0], [0.03, 0.7], [0.22, 0.9], [d * 0.6, 0.6], [d, 0.0001, 'e']];
  const [a, b, c, e, z] = f;
  for (const [mul, det, gg] of [[1, 0, 0.5], [1, 15, 0.42], [1.01, -21, 0.3], [0.5, -6, 0.22]] as const) {
    const fe: Pt[] = [[0, a * mul], [0.16, b * mul, 'e'], [0.32, c * mul, 'e'], [d * 0.75, e * mul, 'e'], [d, z * mul, 'e']];
    const o = v.tone('sawtooth', fe, { t, g: env.map(([x, y, cc]) => [x, y * gg * g, cc] as Pt), to: grit, detune: det });
    v.wander(o.osc.detune, 18, 50, { t, d });
  }
}

/**
 * Level trim of a whole recipe: every layer of `fn` plays through one gain stage of `k` (matched by the offline probe
 * against the v3 sets: impacts / lands ≈ −9 … −15 dB loudest 50 ms, small beats ≈ −18 … −22 dB).
 */
function trim(k: number, fn: (v: Voice) => void): (v: Voice) => void {
  return (v: Voice) => {
    const w = v as unknown as { out: AudioNode };
    const o = w.out;
    w.out = v.amp(k);
    try {
      fn(v);
    } finally {
      w.out = o;
    }
  };
}

// ================================================================ recipes

const SPIRALHORN_RECIPES = {
  sshIdleFlute: {
    cap: 1,
    gap: 1,
    verb: 0.4,
    play(v) {
      grass(v, 0, 0.42, 0.05);
      flute(v, 0.06, [[0, 1046.5], [0.08, D6, 'e'], [0.7, D6]], 0.07, 0.7, { vibAt: 0.12, vib: 14, breath: 0.6 });
      // the sniff: two pink bursts bp 1.2 kHz, 40 ms
      v.bursts([0.0, 0.07], [0.09, 0.07], { dec: 0.035, f: 1200, q: 1.6, kind: 'pink' });
    },
  },
  sshGrassGrow: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: trim(3, (v) => {
      // the blades rise behind the wave front: a rising rustle + a soft riffle
      const out = v.panner([[0, -0.3], [0.4, 0.3]]);
      sweep(v, 0, 0.42, [1800, 3200, 2600], 0.09, { q: 1.3, peakAt: 0.7, to: out });
      v.crackle({ d: 0.38, n: 16, g: 0.06, f: 3000, q: 1.3, dec: 0.008, curve: 0.8, to: out });
      grass(v, 0.04, 0.4, 0.05, { peakAt: 0.75 });
    }),
  },
  sshGustR: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.2,
    play: trim(4, (v) => {
      sweep(v, 0, 0.38, [600, 2600, 900], 0.2, { kind: 'pink', q: 1.3, pan: [-0.7, 0.5] });
      grass(v, 0.1, 0.34, 0.06, { peakAt: 0.3 });
    }),
  },
  sshGustL: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.2,
    play: trim(4, (v) => {
      sweep(v, 0, 0.38, [600, 2600, 900], 0.2, { kind: 'pink', q: 1.3, pan: [0.7, -0.5] });
      grass(v, 0.1, 0.34, 0.06, { peakAt: 0.3 });
    }),
  },
  sshLeap: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: trim(2, (v) => {
      hoof(v, 0, 0.22);
      shhk(v, 0.004, 0.08, 0.09);
      sweep(v, 0.02, 0.5, [300, 900, 400], 0.24, { kind: 'pink', q: 1.1, peakAt: 0.42 });
    }),
  },
  sshFluteRise: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // A5 held, then a short legato step up to D6: two notes, never a slide across the whole fifth
      flute(v, 0, [[0, A5 * 0.985], [0.05, A5, 'e'], [0.17, A5], [0.22, D6, 'e'], [0.5, D6]], 0.15, 0.56, { vibAt: 0.26, vib: 16, breath: 0.55 });
    },
  },
  sshTiptoe: {
    cap: 2,
    gap: 0.08,
    verb: 0.25,
    duck: 0.15,
    play: trim(3.3, (v) => {
      // four dry hoof-TIP ticks rolling front-to-back (a little roll, no body: the tiptoe lands light), each its own
      // pitch, without the knock under them
      for (let i = 0; i < 4; i++) {
        crack(v, i * 0.03, [0.42, 0.3, 0.36, 0.26][i], { hp: [3600, 4300, 3300, 4000][i], lp: [6200, 7000, 5800, 6600][i], dec: 0.003 });
        // each tip a small hollow knock of its own (a hoof, not a twig)
        v.tone('triangle', [[0, [520, 610, 480, 570][i]], [0.02, [380, 430, 350, 410][i], 'e']], { t: i * 0.03, g: perc(0.07, 0.022, 0.0005) });
      }
      // the grass flattening outward, under it (no pink puff)
      shhk(v, 0.02, 0.035, 0.09);
    }),
  },
  sshHonk: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      // r4: a short "k" onset (the glottal catch of a saiga's honk), then the nasal honk itself — no breath under it
      crack(v, 0, 0.32, { hp: 1400, lp: 4200, dec: 0.006 });
      v.tone('triangle', [[0, 1900], [0.016, 950, 'e']], { g: perc(0.12, 0.018, 0.0004) });
      nasalHonk(v, 0.014, 0.55, [210, 240, 220, 180, 160], 0.42);
      // the nose: a nasal buzz band on top
      const bp = v.filt('bandpass', [[0, 1100], [0.25, 1350, 'e'], [0.55, 1000, 'e']], 6);
      v.tone('sawtooth', [[0, 215], [0.2, 240, 'e'], [0.55, 165, 'e']], { t: 0.014, g: [[0, 0], [0.04, 0.06], [0.4, 0.04], [0.55, 0.0001, 'e']], to: bp });
      // the flute answers the honk from the horns
      flute(v, 0.47, [[0, D6 * 0.99], [0.05, D6, 'e'], [0.45, D6]], 0.1, 0.45, { vibAt: 0.12, vib: 14 });
    },
  },
  sshSeedLift: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play: trim(4, (v) => {
      v.crackle({ d: 0.45, n: 12, g: 0.035, f: 5000, q: 1.4, dec: 0.004, curve: 0.9 });
      sweep(v, 0, 0.4, [2200, 3600, 3000], 0.04, { q: 1.2, peakAt: 0.5 });
    }),
  },
  sshSnort: {
    cap: 1,
    gap: 0.15,
    verb: 0.2,
    play: trim(3.2, (v) => {
      // the snort: pink band-passed at 900 Hz (dec 0.12) + the nostril edge at 2.4 kHz
      v.noise('pink', { g: [[0, 0], [0.012, 0.32], [0.13, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1000], [0.12, 800, 'e']], 1.6) });
      v.noise('white', { g: [[0, 0], [0.008, 0.07], [0.09, 0.0001, 'e']], to: v.filt('bandpass', 2400, 3) });
      // a second, smaller pull of air
      v.noise('pink', { t: 0.17, g: [[0, 0], [0.01, 0.12], [0.08, 0.0001, 'e']], to: v.filt('bandpass', 950, 1.8) });
    }),
  },
  sshPaw: {
    cap: 2,
    gap: 0.06,
    verb: 0.2,
    play: trim(12, (v) => {
      // the forehooves paw the air: two quick air flicks with a hoof-to-hoof click
      sweep(v, 0, 0.09, [900, 1900, 1100], 0.05, { kind: 'pink', q: 1.4 });
      crack(v, 0.03, 0.12, { hp: 1700, lp: 3000, dec: 0.004, n: 2, gap: 0.022 });
    }),
  },
  sshTakeoff: {
    cap: 3,
    gap: 0.05,
    verb: 0.25,
    play: trim(3, (v) => {
      // the grass "shhk" leads (the blades thrown back by the push-off), the hoof under it
      crack(v, 0.012, 0.3, { hp: 1900, lp: 2600, dec: 0.004 });
      shhk(v, 0, 0.3, 0.12);
      grass(v, 0.02, 0.12, 0.08, { f: 3400, peakAt: 0.15 });
      // the breeze of the bound, kept above 1 kHz (no low pink body)
      const hp = v.filt('highpass', 1100, 0.9);
      sweep(v, 0.01, 0.26, [1500, 2600, 1700], 0.05, { kind: 'pink', q: 1.5, peakAt: 0.4, to: hp });
    }),
  },
  sshApexFlute: {
    cap: 3,
    gap: 0.05,
    verb: 0.45,
    play(v) {
      flute(v, 0, [[0, A5 * 0.99], [0.04, A5, 'e'], [0.24, A5]], 0.075, 0.26, { vibAt: 0.1, vib: 12, att: 0.03, breath: 0.65 });
    },
  },
  sshHoofTick: {
    cap: 3,
    gap: 0.05,
    verb: 0.2,
    play: trim(2.5, (v) => {
      hoof(v, 0, 0.22);
      hoof(v, 0.025, 0.16, { f: 2350 });
      shhk(v, 0.008, 0.05, 0.05);
    }),
  },
  sshDrop: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play: trim(5, (v) => {
      // the head drops into the pike: a short falling air past the horns
      sweep(v, 0, 0.11, [2600, 1900, 1200], 0.1, { q: 1.6, peakAt: 0.3 });
      keratin(v, 0.05, 0.05, 1300, 0.02);
    }),
  },
  sshHornScrape: {
    cap: 1,
    gap: 0.06,
    verb: 0.2,
    play: trim(2.2, (v) => {
      // the drive: keratin dragged UP the target — a 45-ms rising scrape, 1.2 → 3 kHz, grained, swelling into the crack
      const fl = v.flutter(140, 0.6, { d: 0.05, base: 0.4 });
      const bp = v.filt('bandpass', [[0, 1200], [0.045, 3000, 'e']], 3, { to: fl });
      v.noise('white', { g: [[0, 0], [0.035, 0.32], [0.05, 0.0001, 'e']], to: bp });
      // the drag of the horn base on the hide under it (low-mid grain)
      v.noise('pink', { g: [[0, 0], [0.035, 0.22], [0.055, 0.0001, 'e']], to: v.filt('bandpass', 700, 2, { to: fl }) });
      v.tone('triangle', [[0, 1250], [0.045, 2900, 'e']], { g: [[0, 0], [0.035, 0.03], [0.05, 0.0001, 'e']] });
    }),
  },
  sshHornCrack: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.5,
    play: trim(2.2, (v) => {
      // r4: the identity is ON TOP — the keratin double crack band-passed 1.5 → 3.5 kHz (+3 dB), 10 ms, two strikes
      // 8 ms apart, a brighter splinter, and the card's material signature after it: a 60-ms 3 kHz grass "shhk"
      crack(v, 0, 2.25, { hp: 1500, lp: 3500, dec: 0.012, n: 2, gap: 0.008 });
      crack(v, 0.017, 0.78, { hp: 2200, lp: 3600, dec: 0.008 });
      keratin(v, 0.01, 0.7, 2100, 0.06);
      keratin(v, 0.022, 0.35, 2600, 0.04);
      v.noise('white', { t: 0.026, g: [[0, 0], [0.005, 0.34], [0.07, 0.0001, 'e']], to: v.filt('bandpass', 3000, 2.6) });
      // the WEIGHT stays UNDER it, shorter: a 0.08-s knock 4 dB down, and the upward drive's whump as a sub-only sine
      // below 70 Hz (it is felt, it never colours the crack)
      thump(v, 0, 170, 100, 0.1, 0.08, { drive: 1.5 });
      v.tone('sine', [[0, 66], [0.18, 42, 'e']], { g: [[0, 0], [0.016, 0.18], [0.07, 0.09], [0.2, 0.0001, 'e']] });
      // the hide giving under the horns: a short low-mid body (lighter)
      v.noise('pink', { g: [[0, 0], [0.004, 0.06], [0.06, 0.0001, 'e']], to: v.filt('bandpass', 620, 1.4) });
      // the horn's woody ring, short (no bell, no glass: two inharmonic triangle partials)
      // the horn RINGS after the crack (a dry keratin tone, ~150 ms): the tok of a wet harpoon never rings
      v.tone('triangle', [[0, 2310], [0.2, 2240, 'e']], { t: 0.003, g: perc(0.13, 0.2, 0.0008) });
      v.tone('triangle', 3120, { t: 0.003, g: perc(0.025, 0.05, 0.0008) });
    }),
  },
  sshSeedBurst: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    play: trim(6, (v) => {
      // the seeds: a dense 5 kHz riffle spread over half a second, front-loaded — the main layer
      v.crackle({ d: 0.5, n: 56, g: 0.11, f: 5200, q: 1.8, dec: 0.003, curve: 1.6 });
      v.crackle({ d: 0.35, n: 22, g: 0.06, f: 7000, q: 2, dec: 0.002, curve: 1.2 });
      // the release "fwoosh" of the burst, high: nothing under 1.8 kHz
      const hp = v.filt('highpass', 1800, 0.8);
      sweep(v, 0.01, 0.38, [5200, 3400, 2200], 0.07, { q: 1.4, peakAt: 0.16, to: hp });
      grass(v, 0.05, 0.45, 0.03, { f: 3800, q: 1.6, peakAt: 0.25 });
    }),
  },
  sshHeadShake: {
    cap: 1,
    gap: 0.15,
    verb: 0.2,
    play: trim(15, (v) => {
      // ear flaps, left-right, and the horns rattling once
      v.bursts([0, 0.06, 0.12], [0.1, 0.08, 0.06], { dec: 0.03, f: 1200, q: 1.4, kind: 'pink' });
      keratin(v, 0.03, 0.05, 1500, 0.015);
      keratin(v, 0.09, 0.04, 1400, 0.015);
      v.noise('pink', { t: 0.15, g: [[0, 0], [0.01, 0.1], [0.08, 0.0001, 'e']], to: v.filt('bandpass', 900, 1.8) });
    }),
  },
  sshLockClack: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play: trim(1.5, (v) => {
      // both horns lock against the guard: a double keratin clack (hp 1.8 kHz) over two hollow knocks (~880 / 760 Hz,
      // the two horns), then a short high grind — no low body (r4)
      crack(v, 0, 0.66, { hp: 1800, lp: 3600, dec: 0.008 });
      crack(v, 0.018, 0.5, { hp: 2000, lp: 2900, dec: 0.01 });
      hollowKnock(v, 0.002, 0.26, 880);
      hollowKnock(v, 0.02, 0.18, 760);
      const fl = v.flutter(45, 0.5, { t: 0.04, d: 0.16, base: 0.4 });
      v.noise('white', { t: 0.04, g: [[0, 0], [0.03, 0.09], [0.16, 0.0001, 'e']], to: v.filt('bandpass', 2300, 3, { to: fl }) });
    }),
  },
  sshSlide: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play: trim(6, (v) => {
      // sliding back on the hooves: a scrape with grit
      const fl = v.flutter(60, 0.5, { d: 0.22, base: 0.5 });
      v.noise('white', { g: [[0, 0], [0.02, 0.12], [0.2, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.2, 1400, 'e']], 1.8, { to: fl }) });
      v.crackle({ d: 0.18, n: 7, g: 0.08, f: 2200, q: 1.5, dec: 0.004 });
    }),
  },
  sshStruck: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play: trim(2.2, (v) => {
      // hide + horn: a dull hide puff (lp 700) under two narrow keratin ticks (900 Hz Q 6, 1.4 kHz Q 8) — a notch at
      // ~1.1 kHz and two peaks, never C7's low fur thump
      puff(v, 0, 0.18, 0.05, 700, { kind: 'pink', att: 0.002 });
      keratin(v, 0.002, 0.42, 900, 0.032);
      v.noise('white', { t: 0.012, g: perc(0.3, 0.022, 0.0004), to: v.filt('bandpass', 1400, 8) });
      v.tone('triangle', 1400, { t: 0.012, g: perc(0.05, 0.03, 0.0006) });
      v.noise('white', { t: 0.004, g: perc(0.05, 0.006, 0.0002), to: v.filt('bandpass', 3200, 3) });
    }),
  },
  sshStruckHeavy: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play: trim(2, (v) => {
      puff(v, 0, 0.32, 0.08, 700, { kind: 'pink', att: 0.002 });
      keratin(v, 0.003, 0.4, 900, 0.04);
      v.noise('white', { t: 0.018, g: perc(0.28, 0.03, 0.0004), to: v.filt('bandpass', 1400, 8) });
      v.tone('triangle', 1400, { t: 0.018, g: perc(0.06, 0.05, 0.0006) });
      // the hind legs buckle: a hoof skitter, high and dry
      for (let i = 0; i < 3; i++) crack(v, 0.09 + i * 0.045, 0.2 - i * 0.04, { hp: 2000 + i * 150, lp: 3000 + i * 150, dec: 0.004 });
    }),
  },
  sshGuardClack: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play: trim(2, (v) => {
      // the pike fence: two cracks (hp 1.8 kHz, then bp 2–3 kHz) 20 ms apart over a HOLLOW keratin knock at ~900 Hz —
      // no low body (r4: the 140–150 Hz thump made it a twin of the wet tok and the axeman's blows)
      crack(v, 0, 0.55, { hp: 1800, lp: 6000, dec: 0.008 });
      crack(v, 0.02, 0.45, { hp: 2000, lp: 3000, dec: 0.009 });
      hollowKnock(v, 0.002, 0.2, 920);
      keratin(v, 0.003, 0.12, 1900, 0.03);
    }),
  },
  sshExhale: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: trim(4, (v) => {
      // two falling exhales (the second weaker)
      v.noise('pink', { g: [[0, 0], [0.03, 0.22], [0.2, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1000], [0.2, 420, 'e']], 1.4) });
      v.noise('pink', { t: 0.24, g: [[0, 0], [0.04, 0.14], [0.28, 0.0001, 'e']], to: v.filt('bandpass', [[0, 850], [0.28, 340, 'e']], 1.4) });
      v.noise('white', { t: 0.01, g: [[0, 0], [0.02, 0.025], [0.15, 0.0001, 'e']], to: v.filt('bandpass', 2400, 3) });
    }),
  },
  sshFold: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play: trim(2, (v) => {
      puff(v, 0, 0.32, 0.09, 650, { kind: 'pink', att: 0.006 });
      thump(v, 0, 115, 70, 0.32, 0.08);
      shhk(v, 0.01, 0.04, 0.07);
    }),
  },
  sshGrassTurn: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play: trim(3, (v) => {
      // the coat becomes grass from the hooves up: a rising rustle, the 3 kHz hiss blooming
      sweep(v, 0, 0.42, [1500, 3200, 3000], 0.08, { q: 1.2, peakAt: 0.85 });
      v.crackle({ d: 0.4, n: 14, g: 0.05, f: 3000, q: 1.3, dec: 0.007, curve: 0.7 });
      grass(v, 0.06, 0.44, 0.06, { peakAt: 0.8 });
    }),
  },
  sshWindTakes: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play: trim(3, (v) => {
      sweep(v, 0, 0.9, [500, 2200, 700], 0.2, { kind: 'pink', q: 1.1, peakAt: 0.4 });
      grass(v, 0.05, 0.8, 0.05, { f: 3000, peakAt: 0.35 });
      v.crackle({ d: 0.7, n: 18, g: 0.035, f: 5000, q: 1.4, dec: 0.003, curve: 1.3 });
    }),
  },
  sshLastFlute: {
    cap: 1,
    gap: 0.5,
    verb: 0.55,
    play(v) {
      // D6 gliding down to A5 over 1.2 s, the vibrato widening, decaying; an echo across the steppe
      const echo = v.echo(0.25, 0.35, { wet: 0.4, tone: 3200 });
      echo.connect(v.out);
      flute(v, 0, [[0, D6], [0.25, D6], [1.2, A5, 'e'], [1.35, A5]], 0.12, 1.35, { vibAt: 0.2, vib: 22, breath: 0.6, to: echo });
    },
  },
  sshPlumeLift: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play: trim(4, (v) => {
      // the horns go as two plumes: a breathy rising air, two soft seed ticks
      sweep(v, 0, 0.36, [2000, 4200, 3200], 0.06, { q: 1.4, peakAt: 0.5 });
      sweep(v, 0.06, 0.32, [1400, 2600, 2200], 0.04, { kind: 'pink', q: 1.2, peakAt: 0.6 });
      v.crackle({ d: 0.3, n: 6, g: 0.03, f: 5200, q: 1.4, dec: 0.003 });
    }),
  },
  sshReviveGather: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    play: trim(2, (v) => {
      // the wind runs backwards: the seeds gather, the grass rises, the flute swells up from below
      sweep(v, 0, 0.8, [700, 2200, 500], 0.14, { kind: 'pink', q: 1.1, peakAt: 0.75 });
      grass(v, 0.1, 0.7, 0.05, { peakAt: 0.85 });
      flute(v, 0.25, [[0, A5 * 0.667], [0.3, A5 * 0.667], [0.42, A5, 'e'], [0.6, A5]], 0.06, 0.6, { vibAt: 0.4, vib: 10 });
    }),
  },
} satisfies Record<string, Recipe>;

export const V3_SPIRALHORN_RECIPES = SPIRALHORN_RECIPES;
export type SpiralhornSfxName = keyof typeof SPIRALHORN_RECIPES;

/** The apex flute pitches of the three bounds (880 / 988 / 1175 Hz from the 880 Hz recipe). */
export const APEX_PITCH = [1, 987.77 / 880, D6 / 880] as const;

export const SPIRALHORN_VOICE = {
  roar: 'sshHonk',
  arrive: 'sshGrassGrow',
  land: 'sshTiptoe',
  charge: 'sshSnort',
  release: 'sshDrop',
  impact: 'sshHornCrack',
  // deathStart is scored by the card's own death watcher on the first death frame it sees (the pose often joins at f2,
  // which skips the kit's f1 beat): src/cinematics/kartc/steppe_spiralhorn.ts
  dissolve: 'sshGrassTurn',
  afterDissolve: [
    [2, 'sshWindTakes', 0.95],
    [5, 'sshLastFlute', 0.85],
  ],
  burst: 'sshPlumeLift',
  reviveGather: 'sshReviveGather',
  reviveLand: 'sshTiptoe',
} satisfies CharacterSounds;
