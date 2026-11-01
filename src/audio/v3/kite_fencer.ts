// Uçurtma Eskrimci (kite_fencer, C9) sounds — docs/v3/oturum-c-tasarim.md §2.4 "SOUND", YENI_KARTLAR §5.1.
// Spread into src/audio/sounds.ts RECIPES (V3_KITE_RECIPES); SfxName gains KiteSfxName; the voice object
// KITE_VOICE is the card's CHARACTER_SOUNDS entry (src/cinematics/_v3/sound.ts). Only the v3 look plays these.
//
// Identity (owned by C9 in lane C, §3.6): a THIN 4 kHz "tsst" (a steel needle: a soft tick + a hiss band + sine 4000 with its
// 4720 Hz "çın" partial), KITE CLOTH (stretched fabric: a drum-like snap band-passed at 1.8 kHz, a 3 kHz bamboo
// click), the STRING BUZZ (a taut wire in the wind: a sawtooth 660 → 1760 Hz through a band-pass tracking its
// second harmonic, fluttered at ~80 Hz), the fencing SHOE SQUEAK (a 2.2 → 2.8 kHz sine chirp) and the PLUCKED
// STRING of the indicator panel (a triangle 1320 Hz "one attack left"; muted 880 Hz when it goes out).
// Bans honoured (§0.2): no v1 shared recipe, no glassBell / glassRain / glassReverse, no pillow "pof", no
// tritone drone, no chain links, no pentatonic runs. Everything is built from ./kit.ts blocks and Voice primitives.
//
//   kfnIdleFlutter   idle accent (cloak billow): cloth flutter + a faint string hum (no ambient hook yet)
//   kfnKiteDrift     summon: one leaf sway of the falling empty kite (×3, alternating pans)
//   kfnKiteFlop      summon 'land': the kite lands flat — a cloth flop + a two-tick bamboo click
//   kfnClothRustle   summon: a bump rises under the cloth, it tents
//   kfnCloakSettle   summon: the cloth snaps onto his shoulders (taut-cloth snap); also the revive's land
//   kfnSaluteTsing   the salute's tip glint (roar): sine 4000 + 6900, a hissing edge
//   kfnPikeCharge    attack 1 charge: a short rising breath + the shoe squeak (the declaration's held charge)
//   kfnFleche        attack 1 release: "fsst", white band 6 → 4 kHz
//   kfnTsst          attack 1 contact: "tsst-çın"
//   kfnSqueak        a back-hop / landing shoe squeak
//   kfnPanelOn       the indicator lights: a soft "fwump" + one plucked string (1320 Hz)
//   kfnKiteCharge    attack 2 declaration: the slack string tensing in the wind (replaces the pike's charge voice)
//   kfnVump          attack 2 charge: the wind fills the cloak (pink bloom + the 1.8 kHz panel snap), on the billow frame
//   kfnStringRise    attack 2: the string tension rising through the lift-off (sustained; stopped on the cut)
//   kfnSwing         attack 2: the pendulum swing — air + the string peaking at the low point
//   kfnCut           attack 2 contact: the curved lateral cut "sşhk"
//   kfnLiftOff       attack 2 carry-through: the open cloak catches the updraft and snatches him up over the foe
//   kfnSpill         attack 2 apex: the wind spills out of the cloak
//   kfnPanelOff      the indicator goes out: the pluck muted and lower (880 Hz)
//   kfnLand          attack 2 landing: a soft thud + a squeak
//   kfnStruck        the struck body (kite cloth): a stretched-fabric snap, a bamboo click, rapier rattle ticks
//   kfnStruckHeavy   … a heavy / lethal blow: the same with more body and a longer rattle
//   kfnGuardWrap     the guard (the closed diamond shield) takes a blow: a wrap snap
//   kfnBlockBow      attack 1 blocked: the blade bows and springs back (a short steel "boing")
//   kfnDeathTaut     death f1: the string pulls taut (saw 880 → 1760 in 150 ms)
//   kfnSnap          death f2: SNAP "tın" + two whip swishes
//   kfnCloakAway     death: the cloak flies off screen — a receding flutter, the low-pass closing (distance)
//   kfnClothFold     death: the body folds to a linen scrap (a soft cloth flop)
//   kfnClatter       death: the rapier hits the tile (FM steel, 3 partials)
//   kfnClatterTick   death: the rapier's bounces and the final rest tick
//   kfnScrapFade     death ending: the scrap twitches and frays into threads (fibre ticks + a receding breath)
//   kfnReviveGather  revive: the string hum gathers (sustained; stopped on 'land')

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { Voice, perc, type Pt } from '../synth';
import { puff, sweep, thump } from './kit';

// ================================================================ the card's own blocks

/** The fencing shoe squeak: a short sine chirp f0 → f1 (Hz) with a rubbery 2nd harmonic. */
function squeak(v: Voice, t: number, g: number, f0 = 2200, f1 = 2800, d = 0.03): void {
  v.tone('sine', [[0, f0], [d, f1, 'e']], { t, g: [[0, 0], [0.004, g], [d * 0.7, g * 0.8], [d + 0.012, 0.0001, 'e']] });
  v.tone('sine', [[0, f0 * 2], [d, f1 * 2, 'e']], { t, g: [[0, 0], [0.004, g * 0.18], [d + 0.008, 0.0001, 'e']] });
}

/**
 * A soft-edged noise tick (band hp → lp, a 1–2 ms attack): the card's clicks. A 0.2 ms click spends the headroom on
 * a spike nobody hears as level; this one keeps the "t" but lets the body carry the loudness.
 */
function tick(v: Voice, t: number, g: number, o: { hp?: number; lp?: number; dec?: number; att?: number; to?: AudioNode } = {}): void {
  const lp = v.filt('lowpass', o.lp ?? 10000, 0.7, { t, to: o.to });
  const hp = v.filt('highpass', o.hp ?? 3000, 0.8, { t, to: lp });
  v.noise('white', { t, g: perc(g, o.dec ?? 0.008, o.att ?? 0.0012), to: hp });
}

/**
 * The steel needle "tsst-çın": the point's tick ("t"), a 45 ms hiss band at 4–7 kHz ("sst") and the ringing 4000 Hz
 * line with its 4720 Hz partial ("çın") — the sustained parts carry the level, the tick only marks the onset.
 */
function needle(v: Voice, t: number, g: number, dec = 0.18): void {
  tick(v, t, g * 0.35, { hp: 5000, lp: 11000, dec: 0.006 });
  // "sst": a short, bright hiss band centred on the needle's pitch, swelling for 6 ms and gone by 50 ms
  v.noise('white', { t, g: [[0, 0], [0.006, g * 0.5], [0.022, g * 0.32], [0.05, 0.0001, 'e']], to: v.filt('bandpass', [[0, 6200], [0.05, 4600, 'e']], 2.2, { t }) });
  v.tone('sine', 4000, { t, g: [[0, 0], [0.002, g * 0.62], [0.03, g * 0.5], [dec, 0.0001, 'e']] });
  v.tone('sine', 4720, { t, g: [[0, 0], [0.002, g * 0.3], [dec * 0.7, 0.0001, 'e']] });
}

/** Stretched kite cloth struck: a drum-like snap band-passed at `f` (Hz), 15 ms. */
function clothSnap(v: Voice, t: number, g: number, f = 1800, dec = 0.015, q = 3, body = 0.16, bodyG = 0.35): void {
  v.noise('white', { t, g: perc(g, dec, 0.0012), to: v.filt('bandpass', f, q) });
  // the membrane's short pitched body (a drum, not a puff)
  v.tone('triangle', [[0, f * body], [dec * 3, f * body * 0.69, 'e']], { t, g: perc(g * bodyG, dec * 3, 0.001) });
}

/** The bamboo spar click (soft ticks band-passed at 3 kHz, two ticks 6 ms apart). */
function bamboo(v: Voice, t: number, g: number, n = 2): void {
  for (let i = 0; i < n; i++) tick(v, t + i * 0.006, g * 0.7 * (1 - i * 0.25), { hp: 2400, lp: 3800, dec: 0.005, att: 0.001 });
  // the hollow spar's knock (tonal: bamboo rings a little)
  v.tone('sine', 3050, { t, g: perc(g * 0.22, 0.035, 0.001) });
}

/** The fabric's sustained body after a snap: band noise 30–60 ms (the cloth's "whap", so a blow has weight, not just a click). */
function clothBody(v: Voice, t: number, g: number, f = 1500, d = 0.05, q = 1.4): void {
  v.noise('white', { t, g: [[0, 0], [0.003, g], [d * 0.45, g * 0.55], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f * 1.15], [d, f * 0.85, 'e']], q, { t }) });
}

/**
 * The taut string's buzz: a sawtooth through a band-pass that tracks its 2nd harmonic, amplitude fluttered
 * (the wind on a wire). `f` is the pitch envelope; `g` the level envelope.
 */
function stringBuzz(v: Voice, t: number, f: readonly Pt[], g: readonly Pt[], o: { flutter?: number; q?: number; pan?: number } = {}): void {
  const d = g[g.length - 1][0];
  const out = o.pan !== undefined ? v.panner(o.pan, { t }) : undefined;
  const fl = v.flutter(o.flutter ?? 80, 0.4, { t, d: d + 0.02, base: 0.7, to: out });
  const bp = v.filt('bandpass', f.map(([x, y, c]) => [x, y * 2, c] as Pt), o.q ?? 6, { t, to: fl });
  v.tone('sawtooth', f, { t, g, to: bp });
  // the fundamental, quiet (the wire's own note under the buzz)
  v.tone('triangle', f, { t, g: g.map(([x, y, c]) => [x, y * 0.25, c] as Pt), to: out });
}

/** A plucked string: a triangle with a fast attack, the pick's tick and a slightly sharp start. */
function pluck(v: Voice, t: number, f: number, g: number, dec: number): void {
  v.tone('triangle', [[0, f * 1.012], [0.03, f, 'e']], { t, g: perc(g, dec, 0.0015) });
  v.tone('sine', f * 2, { t, g: perc(g * 0.25, dec * 0.4, 0.001) });
  v.noise('white', { t, g: perc(g * 0.2, 0.005, 0.0015), to: v.filt('bandpass', f * 3, 2) });
}

// ================================================================ recipes

const KITE_RECIPES = {
  kfnIdleFlutter: {
    cap: 1,
    gap: 0.5,
    verb: 0.25,
    play(v) {
      const fl = v.flutter(70, 0.35, { d: 0.19, base: 0.6 });
      v.noise('white', { g: [[0, 0], [0.04, 0.07], [0.17, 0.0001, 'e']], to: v.filt('bandpass', 1650, 1.4, { to: fl }) });
      stringBuzz(v, 0.02, [[0, 880], [0.2, 880]], [[0, 0], [0.06, 0.012], [0.2, 0.0001, 'e']], { flutter: 90, q: 6 });
    },
  },
  kfnKiteDrift: {
    cap: 3,
    gap: 0.05,
    verb: 0.4,
    play(v) {
      // one leaf sway of the EMPTY kite falling (×3, alternating pans): only air — an airy pink whoosh rising and
      // falling 1.2 → 2.2 → 1.4 kHz over 240 ms, high-passed (no cloth body, no flap transient: nothing strikes it)
      const hp = v.filt('highpass', 700, 0.7);
      sweep(v, 0, 0.24, [1200, 2200, 1400], 0.2, { kind: 'pink', q: 1.4, peakAt: 0.5 });
      v.noise('pink', { g: [[0, 0], [0.12, 0.03], [0.24, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2600], [0.12, 3400], [0.24, 2800, 'e']], 2.2, { to: hp }) });
    },
  },
  kfnKiteFlop: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      // the flat cloth slapping the tile: a mid band (no low body: kite cloth is light), the spars' click on top
      v.noise('pink', { g: [[0, 0], [0.003, 0.3], [0.03, 0.12], [0.09, 0.0001, 'e']], to: v.filt('bandpass', 1100, 0.9) });
      clothBody(v, 0, 0.12, 1700, 0.06);
      thump(v, 0, 160, 110, 0.03, 0.05);
      bamboo(v, 0.004, 0.26);
    },
  },
  kfnClothRustle: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      v.crackle({ d: 0.28, n: 10, g: 0.06, f: 2600, q: 1.2, dec: 0.014, kind: 'white' });
      sweep(v, 0, 0.32, [900, 1800, 1300], 0.09, { kind: 'pink', q: 1.2, peakAt: 0.6 });
      const fl = v.flutter(48, 0.4, { t: 0.1, d: 0.22, base: 0.45 });
      v.noise('white', { t: 0.1, g: [[0, 0], [0.08, 0.04], [0.22, 0.0001, 'e']], to: v.filt('bandpass', 2100, 1.5, { to: fl }) });
    },
  },
  kfnCloakSettle: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      clothSnap(v, 0, 0.26, 1800, 0.018, 3, 0.4, 0.1);
      clothBody(v, 0.002, 0.22, 1800, 0.06, 2);
      bamboo(v, 0.006, 0.05, 1);
      stringBuzz(v, 0.01, [[0, 880], [0.14, 860, 'e']], [[0, 0], [0.01, 0.02], [0.14, 0.0001, 'e']]);
    },
  },
  kfnSaluteTsing: {
    cap: 1,
    gap: 0.15,
    verb: 0.45,
    duck: 0.25,
    play(v) {
      v.tone('sine', 4000, { g: perc(0.085, 0.3, 0.0015) });
      v.tone('sine', 6900, { g: perc(0.032, 0.18, 0.0015) });
      v.noise('white', { g: perc(0.04, 0.014, 0.0012), to: v.filt('highpass', 6000, 0.8) });
      // the blade's slide up before the glint (a thin rising whisper)
      sweep(v, 0, 0.09, [3000, 5200, 6000], 0.03, { kind: 'white', q: 4, peakAt: 0.8 });
    },
  },
  kfnPikeCharge: {
    cap: 2,
    gap: 0.06,
    verb: 0.2,
    play(v) {
      // the weight drops onto the back leg: a short rising breath (80 ms) …
      v.noise('pink', { g: [[0, 0], [0.07, 0.09], [0.1, 0.0001, 'e']], to: v.filt('bandpass', [[0, 700], [0.08, 1500, 'e']], 1.3) });
      // … and the shoe squeaks on the floor
      squeak(v, 0.03, 0.05);
      // the rapier drawn back: a faint steel slide
      sweep(v, 0.02, 0.12, [3800, 5200, 4400], 0.022, { kind: 'white', q: 6, peakAt: 0.6 });
    },
  },
  kfnFleche: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      sweep(v, 0, 0.12, [6000, 5200, 4000], 0.2, { kind: 'white', q: 4, peakAt: 0.18, pan: [-0.1, 0.1] });
      squeak(v, 0, 0.04, 2400, 3000, 0.022);
    },
  },
  kfnTsst: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      needle(v, 0, 0.32, 0.2);
      // a tiny body knock under the needle (the point stops in the target): felt, under the needle
      thump(v, 0, 300, 180, 0.03, 0.03);
    },
  },
  kfnSqueak: {
    cap: 3,
    gap: 0.04,
    verb: 0.15,
    vary: 0.05,
    play(v) {
      squeak(v, 0, 0.055, 2300, 2750, 0.028);
      v.noise('pink', { g: perc(0.04, 0.03, 0.002), to: v.filt('lowpass', 1200, 0.7) });
    },
  },
  kfnPanelOn: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // fwump: the cloth panel catches a breath of wind
      v.noise('pink', { g: [[0, 0], [0.04, 0.15], [0.18, 0.0001, 'e']], to: v.filt('lowpass', 900, 0.8, { to: v.filt('highpass', 160, 0.7) }) });
      // one plucked string: "one attack left"
      pluck(v, 0.04, 1320, 0.06, 0.4);
    },
  },
  kfnVump: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      // the cloth BLOOMS with wind (a pink swell low-passed at 700 Hz, its rustle a step higher), the stretched panels
      // catch it with a drum-like snap at 1.8 kHz, the spars creak; the cloth drum's low body is only a felt hint
      v.noise('pink', { g: [[0, 0], [0.06, 0.4], [0.34, 0.0001, 'e']], to: v.filt('bandpass', [[0, 560], [0.06, 820], [0.34, 520, 'e']], 1.1) });
      // the panels' edges flapping as they fill (a short dry crackle, high)
      v.crackle({ t: 0.04, d: 0.2, n: 6, g: 0.05, f: 3000, q: 1.4, dec: 0.008, kind: 'white' });
      const fl = v.flutter(46, 0.5, { t: 0.03, d: 0.3, base: 0.45 });
      v.noise('white', { t: 0.03, g: [[0, 0], [0.05, 0.25], [0.3, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1150], [0.3, 1450, 'e']], 1.6, { to: fl }) });
      clothSnap(v, 0.055, 0.5, 1800, 0.018, 2.5, 0.3, 0.25);
      bamboo(v, 0.07, 0.1, 1);
      thump(v, 0.05, 150, 110, 0.02, 0.08, { att: 0.012 }); // the cloth drum: felt, not heard
    },
  },
  kfnKiteCharge: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      // the 2nd attack's declaration (nothing of the pike's breath or squeak): the slack string tensing in the wind —
      // a low wire 440 → 660 Hz swelling, the cloth ruffling once as the wind finds it
      stringBuzz(v, 0, [[0, 440], [0.32, 660, 'e'], [0.45, 680]], [[0, 0], [0.12, 0.02], [0.34, 0.035], [0.46, 0.0001, 'e']], { flutter: 70, q: 5 });
      const fl = v.flutter(52, 0.5, { t: 0.08, d: 0.26, base: 0.4 });
      v.noise('white', { t: 0.08, g: [[0, 0], [0.08, 0.035], [0.26, 0.0001, 'e']], to: v.filt('bandpass', 1500, 1.5, { to: fl }) });
    },
  },
  kfnStringRise: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      // the string from slack to taut and up through the lift-off: a crescendo 660 → 1320 Hz (held there, so a
      // late cut is still covered; the cinematic stops it on the cut)
      stringBuzz(v, 0, [[0, 660], [0.75, 1320, 'e'], [1.6, 1360]], [[0, 0], [0.12, 0.018], [0.75, 0.06], [1.4, 0.07], [1.7, 0.0001, 'e']], { flutter: 80, q: 6 });
    },
  },
  kfnSwing: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      // the downswing is ~0.37 s of game time from its first frame to the cut: the air and the string both peak there
      sweep(v, 0, 0.44, [400, 1600, 500], 0.2, { kind: 'pink', q: 1.3, peakAt: 0.84, pan: [-0.25, 0.25] });
      // the string peaks at the low point of the arc
      stringBuzz(v, 0, [[0, 1320], [0.36, 1480, 'e'], [0.46, 1400]], [[0, 0], [0.22, 0.03], [0.36, 0.05], [0.46, 0.0001, 'e']], { flutter: 95, q: 7 });
    },
  },
  kfnCut: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // the lateral cut "sşhk" — a CLOTH-AND-EDGE cut, never a steel whoosh: everything sits under 5 kHz (the generic
      // slash lives up there) and moves DOWN. "sş": a narrow white band sliding 3.2 → 1.8 kHz in 90 ms (Q 4) panned
      // across with the sweep, low-passed at 4.6 kHz so no airy edge rides above it …
      const D = 0.09;
      const across = v.panner([[0, -0.2], [D + 0.04, 0.2]]);
      const lp = v.filt('lowpass', 4600, 0.7, { to: across });
      v.noise('white', { g: [[0, 0], [0.004, 0.55], [0.028, 0.95], [D * 0.8, 0.5], [D + 0.03, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3200], [D, 1800, 'e'], [D + 0.03, 1700]], 4, { to: lp }) });
      // … "h": the cloth DRAG behind the edge (pink, low-passed at 2 kHz, 60 ms: fabric pulled across, not air) …
      v.noise('pink', { t: 0.018, g: [[0, 0], [0.012, 0.42], [0.06, 0.0001, 'e']], to: v.filt('lowpass', 2000, 0.8, { to: v.filt('highpass', 380, 0.7, { to: across }) }) });
      // … one short 4 kHz glint where the edge bites (25 ms: the needle's pitch, not its ring) …
      v.tone('sine', 4000, { t: 0.004, g: perc(0.035, 0.025, 0.001) });
      // … the kite string answering the bottom of the swing (its peak note, quiet, falling with the tension) …
      v.tone('triangle', [[0, 1480], [0.09, 1380, 'e']], { t: 0.006, g: perc(0.03, 0.11, 0.003) });
      // … "k": one fibre tick as the blade leaves (band-limited: a thread parting, not a click) + a felt body hint
      tick(v, D + 0.012, 0.075, { hp: 2200, lp: 4600, dec: 0.005, att: 0.001 });
      thump(v, 0, 220, 120, 0.02, 0.05);
    },
  },
  kfnLiftOff: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      // the open cloak catches the updraft and snatches him up over the foe: a rising pink "fwoom" (the air filling
      // the panels from below, high-passed: no low body), the cloth edges rippling faster as it climbs, and the
      // slack string twanging taut again for a beat (an upward flick, never the swing's held buzz)
      const hp = v.filt('highpass', 260, 0.7);
      v.noise('pink', { g: [[0, 0], [0.05, 0.3], [0.13, 0.22], [0.26, 0.0001, 'e']], to: v.filt('bandpass', [[0, 520], [0.14, 1250, 'e'], [0.26, 1050]], 1.3, { to: hp }) });
      const fl = v.flutter(56, 0.5, { t: 0.02, d: 0.24, base: 0.4 });
      v.noise('white', { t: 0.02, g: [[0, 0], [0.06, 0.07], [0.22, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1100], [0.22, 1700, 'e']], 1.6, { to: fl }) });
      stringBuzz(v, 0.03, [[0, 990], [0.08, 1240, 'e'], [0.16, 1180]], [[0, 0], [0.012, 0.028], [0.17, 0.0001, 'e']], { flutter: 100, q: 6 });
    },
  },
  kfnSpill: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      // (high-passed at 200 Hz: kite cloth spilling wind has no low body)
      const hp = v.filt('highpass', 220, 0.7);
      v.noise('pink', { g: [[0, 0], [0.03, 0.16], [0.32, 0.0001, 'e']], to: v.filt('lowpass', [[0, 2600], [0.32, 700, 'e']], 0.9, { to: hp }) });
      const fl = v.flutter(60, 0.5, { d: 0.26, base: 0.4 });
      v.noise('white', { g: [[0, 0], [0.02, 0.04], [0.24, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [0.24, 900, 'e']], 1.5, { to: fl }) });
    },
  },
  kfnPanelOff: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the same pluck, muted (a palm on the string) and lower
      v.tone('triangle', [[0, 885], [0.02, 880, 'e']], { g: perc(0.06, 0.15, 0.0015), to: v.filt('lowpass', 1500, 0.7) });
      v.noise('white', { g: perc(0.02, 0.005, 0.0012), to: v.filt('bandpass', 2600, 2) });
    },
  },
  kfnLand: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      thump(v, 0, 160, 80, 0.2, 0.08);
      puff(v, 0, 0.1, 0.06, 900, { kind: 'pink' });
      squeak(v, 0.03, 0.05, 2250, 2700, 0.03);
    },
  },
  kfnStruck: {
    cap: 2,
    gap: 0.03,
    verb: 0.25,
    play(v) {
      // the stretched panel's snap leads (1.8 kHz, its drum body a tight 900 Hz knock — never a low thud), the bamboo
      // click at 3 kHz, the rapier's rattle ticks at 4 kHz
      clothSnap(v, 0, 0.26, 1800, 0.015, 3, 0.5, 0.1);
      clothBody(v, 0.001, 0.36, 1150, 0.055);
      bamboo(v, 0.003, 0.18, 2);
      for (let i = 0; i < 3; i++) v.tone('sine', 4000 + i * 130, { t: 0.02 + i * 0.024, g: perc(0.045 * (1 - i * 0.25), 0.02, 0.001) });
    },
  },
  kfnStruckHeavy: {
    cap: 2,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      clothSnap(v, 0, 0.18, 1600, 0.02, 2.5, 0.45, 0.14);
      clothBody(v, 0.001, 0.5, 1050, 0.085);
      bamboo(v, 0.004, 0.14, 2);
      for (let i = 0; i < 5; i++) v.tone('sine', 4000 + (i % 2) * 260 - i * 40, { t: 0.02 + i * 0.03, g: perc(0.05 * (1 - i * 0.16), 0.024, 0.001) });
      // the heavier blow: a second, looser fabric snap (the cloth slapping back) rather than more low end
      clothSnap(v, 0.045, 0.14, 2100, 0.016, 3);
      clothBody(v, 0.046, 0.2, 1300, 0.06);
      // … and the torn panels flapping on for a beat after it (a 58 Hz flutter on a falling band)
      const fl = v.flutter(58, 0.55, { t: 0.03, d: 0.17, base: 0.45 });
      v.noise('white', { t: 0.03, g: [[0, 0], [0.02, 0.55], [0.1, 0.38], [0.17, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1300], [0.15, 900, 'e']], 1.5, { to: fl }) });
      // the spars knock together under the blow (a second, lower bamboo click), no low thud: that is the robe's
      bamboo(v, 0.05, 0.16, 1);
    },
  },
  kfnGuardWrap: {
    cap: 2,
    gap: 0.04,
    verb: 0.3,
    play(v) {
      // the wrapped cloak (a closed diamond) takes it: a tighter, higher taut-cloth snap + the spars
      clothSnap(v, 0, 0.24, 1500, 0.012, 4, 0.5, 0.2);
      // the wrap's two taut layers ringing on after the snap (70 ms), and the string under them humming 160 ms
      clothBody(v, 0.001, 0.38, 1250, 0.075, 2);
      bamboo(v, 0.002, 0.05, 1);
      stringBuzz(v, 0.005, [[0, 740], [0.14, 710, 'e']], [[0, 0], [0.006, 0.08], [0.06, 0.06], [0.16, 0.0001, 'e']], { flutter: 110, q: 5 });
      // the two layers of the wrap meeting (a tight knock, not a low thud)
      thump(v, 0, 440, 320, 0.09, 0.04);
    },
  },
  kfnBlockBow: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      // the tip meets the guard (needle, smaller) and the blade bows: a short pitch dip and spring back
      needle(v, 0, 0.18, 0.1);
      v.tone('sine', [[0, 3200], [0.05, 2500, 'e'], [0.12, 3400, 'e'], [0.2, 3000]], { t: 0.01, g: perc(0.06, 0.2, 0.002) });
      v.tone('triangle', [[0, 1100], [0.05, 900, 'e'], [0.16, 1150, 'e']], { t: 0.01, g: perc(0.03, 0.18, 0.002) });
    },
  },
  kfnDeathTaut: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // (it snaps tight at once and keeps tightening: the level is there from the first 15 ms)
      stringBuzz(v, 0, [[0, 880], [0.15, 1760, 'e'], [0.2, 1760]], [[0, 0], [0.015, 0.07], [0.15, 0.09], [0.21, 0.0001, 'e']], { flutter: 110, q: 7 });
    },
  },
  kfnSnap: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.3,
    play(v) {
      // "tın": the string breaks
      // the string's last note rings out (a triangle that drops a hair as the tension goes) …
      v.tone('triangle', [[0, 1780], [0.1, 1700, 'e']], { g: perc(0.17, 0.12, 0.0012) });
      v.tone('sine', 3520, { g: perc(0.05, 0.05, 0.0012) });
      tick(v, 0, 0.05, { hp: 3000, lp: 10000, dec: 0.006 });
      // … and the two ends whip back
      sweep(v, 0.02, 0.1, [2600, 4200, 3000], 0.09, { kind: 'white', q: 3, peakAt: 0.4, pan: [-0.3, -0.4] });
      sweep(v, 0.04, 0.11, [2400, 3800, 2600], 0.08, { kind: 'white', q: 3, peakAt: 0.4, pan: [0.3, 0.4] });
    },
  },
  kfnCloakAway: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // a receding flutter: 60 Hz cloth flutter on a band falling 1.6 kHz → 900 Hz, the level fading and the
      // low-pass closing over 0.6 s (distance); the cinematic pans it toward the screen edge it flies to
      const lp = v.filt('lowpass', [[0, 6000], [0.6, 1300, 'e']], 0.7);
      const fl = v.flutter(60, 0.55, { d: 0.66, base: 0.45, to: lp });
      v.noise('white', { g: [[0, 0], [0.05, 0.17], [0.62, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1600], [0.6, 900, 'e']], 1.6, { to: fl }) });
      sweep(v, 0, 0.5, [700, 1300, 600], 0.06, { kind: 'pink', q: 1.2, peakAt: 0.2 });
    },
  },
  kfnClothFold: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      // (light linen folding: a soft mid band, only a felt hint of weight)
      puff(v, 0, 0.12, 0.09, 1100, { kind: 'pink' });
      clothBody(v, 0.004, 0.08, 1300, 0.08, 1.2);
      thump(v, 0.01, 150, 110, 0.025, 0.05);
    },
  },
  kfnClatter: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    play(v) {
      v.bell(3600, { g: 0.07, dec: 0.08, ratio: 2.4, index: 0.8 });
      v.bell(3300, { t: 0.004, g: 0.045, dec: 0.07, ratio: 2.4, index: 0.8 });
      v.noise('white', { g: perc(0.09, 0.006, 0.001), to: v.filt('bandpass', 5200, 1.5) });
      thump(v, 0, 420, 260, 0.05, 0.02);
    },
  },
  kfnClatterTick: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    play(v) {
      v.bell(3100, { g: 0.05, dec: 0.06, ratio: 2.4, index: 0.8 });
      v.noise('white', { g: perc(0.05, 0.005, 0.001), to: v.filt('bandpass', 4800, 1.5) });
    },
  },
  kfnScrapFade: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play(v) {
      // the scrap twitches (a small cloth flick), then frays: four fibre ticks pulling apart, a thin breath carrying
      // the threads off after the cloak (band falling = going away), the string's memory a last faint harmonic
      clothSnap(v, 0, 0.03, 2200, 0.012, 3);
      clothBody(v, 0.001, 0.06, 2100, 0.05, 2);
      for (let i = 0; i < 4; i++) v.noise('white', { t: 0.07 + i * 0.045 + (i % 2) * 0.008, g: perc(0.018 * (1 - i * 0.18), 0.01, 0.002), to: v.filt('bandpass', 5200 - i * 500, 2.5) });
      v.noise('pink', { t: 0.04, g: [[0, 0], [0.06, 0.22], [0.34, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.34, 900, 'e']], 1.3) });
      v.tone('triangle', [[0, 2640], [0.28, 2400, 'e']], { t: 0.08, g: perc(0.01, 0.26, 0.01) });
    },
  },
  kfnReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      stringBuzz(v, 0, [[0, 440], [0.7, 880, 'e'], [1.3, 900]], [[0, 0], [0.5, 0.04], [1.2, 0.05], [1.35, 0.0001, 'e']], { flutter: 70, q: 5 });
      const fl = v.flutter(60, 0.45, { d: 1.3, base: 0.4 });
      v.noise('white', { g: [[0, 0], [0.6, 0.05], [1.25, 0.0001, 'e']], to: v.filt('bandpass', [[0, 900], [1.2, 1700, 'e']], 1.4, { to: fl }) });
    },
  },
} satisfies Record<string, Recipe>;

/**
 * Level trims (dB) measured with the offline probe against the v3 sets (shots/tools/sfx-probe.mjs: the slice's
 * contacts sit at a loudest-50 ms of −7…−14 dB): this card is the lightest body of the lane, so its contacts land
 * ~6 dB under the aces (≈ −14…−16 dB), its small beats (squeaks, plucks, drifts) at −20…−28 dB.
 */
const TRIM_DB: Partial<Record<keyof typeof KITE_RECIPES, number>> = {
  kfnIdleFlutter: 9,
  kfnKiteDrift: 20,
  kfnKiteFlop: 7,
  kfnClothRustle: 20,
  kfnCloakSettle: 9,
  kfnSaluteTsing: 6,
  kfnPikeCharge: 8,
  kfnFleche: 10,
  kfnTsst: 5,
  kfnSqueak: 8,
  kfnPanelOn: 5,
  kfnVump: 0,
  kfnKiteCharge: 6,
  kfnStringRise: 7,
  kfnSwing: 9,
  kfnCut: 15,
  kfnLiftOff: 8,
  kfnSpill: 8,
  kfnPanelOff: 6,
  kfnLand: 7,
  kfnStruck: 14,
  kfnStruckHeavy: 19,
  kfnGuardWrap: 13,
  kfnBlockBow: 8,
  kfnDeathTaut: 21,
  kfnSnap: 8,
  kfnCloakAway: 8,
  kfnClothFold: 7,
  kfnClatter: 7,
  kfnClatterTick: 7,
  kfnScrapFade: 12,
  kfnReviveGather: 6,
};

/** Play a recipe into a gain stage of `db` (a child Voice on the same clock; its sources / end go to the parent). */
function trimmed(r: Recipe, db: number): Recipe {
  if (!db) return r;
  const k = Math.pow(10, db / 20);
  return {
    ...r,
    play(v) {
      const g = v.ctx.createGain();
      g.gain.value = k;
      g.connect(v.out);
      const c = new Voice(v.ctx, g, v.t0, v.pm, v.rnd);
      r.play(c);
      v.end = Math.max(v.end, c.end);
      v.sources.push(...c.sources);
      if (c.stereo) v.stereo = true;
    },
  };
}

export const V3_KITE_RECIPES = Object.fromEntries(
  Object.entries(KITE_RECIPES).map(([n, r]) => [n, trimmed(r, TRIM_DB[n as keyof typeof KITE_RECIPES] ?? 0)]),
) as Record<keyof typeof KITE_RECIPES, Recipe>;

export type KiteSfxName = keyof typeof KITE_RECIPES;

/**
 * The declaration's charge voice: the pike's breath + squeak for the 1st attack, the string tensing in the wind for
 * the 2nd (the two attacks share no sound). The cinematic's attackDeclare hook sets it for the declaration it wraps.
 */
let declareCharge: 'kfnPikeCharge' | 'kfnKiteCharge' = 'kfnPikeCharge';
export function setKiteCharge(name: 'kfnPikeCharge' | 'kfnKiteCharge'): void {
  declareCharge = name;
}

/** The card's voice (CHARACTER_SOUNDS.kite_fencer): the death kit and the declaration play these on their marks. */
export const KITE_VOICE = {
  roar: 'kfnSaluteTsing',
  arrive: 'kfnKiteDrift',
  land: 'kfnKiteFlop',
  get charge(): 'kfnPikeCharge' | 'kfnKiteCharge' {
    return declareCharge;
  },
  release: 'kfnFleche',
  impact: 'kfnTsst',
  // (deathStart is the cinematic's: the death pose may join at f1 or later — kfnDeathTaut is scored on the first
  // death frame it shows before the snap, src/cinematics/kartc/kite_fencer.ts watchDeath)
  dissolve: 'kfnClatter',
  // death frames after 'dissolve' (f4: the rapier hits the tile): the bounces and the rest tick
  afterDissolve: [
    [2, 'kfnClatterTick', 0.8],
    [4, 'kfnClatterTick', 0.5],
  ],
  burst: 'kfnScrapFade',
  reviveGather: 'kfnReviveGather',
  reviveLand: 'kfnCloakSettle',
} satisfies CharacterSounds;
