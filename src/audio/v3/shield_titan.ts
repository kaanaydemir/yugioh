// Kalkan Devi (shield_titan) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/shield_titan.md §7 (checked against docs/v3/YENI_KARTLAR.md §5.1). Built from ./kit.ts blocks and the Voice primitives only.
//
// Palette (one parameter set):
//   plate     the copper tower plate: an FM ring on G2 (98 Hz, inharmonic ratio 2.76) with its 196 Hz partial and a
//             low body sine — every plate ring carries the "thunder-sheet" wobble: amplitude + ±12 cent pitch flutter
//             at 6–9 Hz that dies WITH the ring ("wub-wub-wub"; never a steady beat: C12–C15 own the beating hum)
//   leather   strap creak: band-passed brown noise 120–400 Hz with a slow wander (never a tonal wood creak: C6)
//   feet      bare-foot thuds: low `thump` with drive and a low puff
//   giant     a short chest "HUP": brown puff + a 150 → 320 Hz formant sweep (no `growl`: C10 owns it)
//   ward      the five sap steps: a copper gong ladder descending G2 F2 D2 C2 A♭1 (pitch per call), each choked by the next
//
//   kdDrawbridgeCreak  summon f0 → f4 (sustained): the straps creak as he hauls the slab up off the tile
//   kdHeave            strike charge (sustained) / summon f7: the chest "hup" and the straps pulled taut
//   kdStep             strike f4: one heavy bare-foot stride
//   kdSlabSwing        strike 'release': the big surface pushing air as it comes down edge-first
//   kdSlabSlam         strike 'contact': the flat copper slap, the plate ring and its wobble, gravel
//   kdPlateShiver      blocked strike: the plate rebounds and shivers (fast 9 Hz wobble, alone)
//   kdSledScrape       direct: the face-down slab skids along the lane (copper scrape riding the ring)
//   kdStrapHaul        direct: he hauls it back by its strap (creak + a soft drag)
//   kdPlant            summon 'land', toGuard f3, strike re-plant: the "DUNK" of the shield's foot in the floor (sub + dirt)
//   kdHinge            summon f1 / f2 / f3 (pitch per step): the drawbridge hinge groans up a notch
//   kdPlateBloom       summon f4: the upright slab's ring blooms in
//   kdGateBoom         summon land only (over kdPlant): the gate shuts — a deep boom with a long wub tail
//   kdFistBang         roar f3 / f5: the fist on the copper (the shield drum)
//   kdWardWake         effect t0 (sustained): the sunstone opens — the ring swelling in, the flutter rising 3 → 9 Hz
//   kdWardWall         effect release: the rampart rises ("ZHUNG": a G2 strike + a rising pink sweep)
//   kdSapStep          effect, ×5: one gong step of the ladder + a soft push "thup" (pitch per call)
//   kdSapDrain         effect, last pulse (attacker pan): the stripped strength falls away ("fwoomp" 900 → 120 Hz)
//   kdRepel            defend layer, blocked: the wall flashes up — a copper strike, the wobble, a push toward the attacker
//   kdWallBreak        defend layer, the wall is broken: gravel cracks and a damped (choked) ring
//   kdPlateHit         defend layer, any blow on the titan: the plate takes it (under the generic stone material)
//   kdKneel            death f2 (fired by the death layer, whatever frame the death joins on): knee thumps + strap creak
//   kdTopple           death 'dissolve': the slab tips back — a rising creak, the air sweeping down
//   kdLidSlam          death dissolve + 2: the lid slams flat over him (the biggest slap, the long wub-wub)
//   kdTarnish          death f9: the copper cools dark (a low ring sinking, a dry hiss)
//   kdWardRise         death 'burst': the ward's light leaves the dead copper (three warm partials on G rising)
//   kdWardReturn       revive 'reviveGather' (sustained): the same partials gathering downward, the flutter rising
//   kdReviveHeave      revive 'reviveLand': the "hup" and the plant in one

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

// ================================================================ palette

/** G2: the plate's fundamental. */
const G2 = 98;
/** The plate's FM ratio (inharmonic copper; never the magus' 1.41, nor 2.76 — the wyrm's glass bars and
 *  windmane_knight's plate clank own that one: round 2 #10). */
const RATIO = 3.11;

/**
 * One ring of the copper plate: FM 2.76 on `f` + its octave partial + a low body sine, all through one gain that
 * wobbles at `rate` Hz (depth decaying with the ring), the carrier's pitch fluttering ±`cents` with it.
 */
function plate(v: Voice, t: number, g: number, dec: number, o: { f?: number; rate?: number; depth?: number; cents?: number; index?: number; partial?: number; body?: number; to?: AudioNode; choke?: number } = {}): void {
  const f = o.f ?? G2;
  const rate = o.rate ?? 7;
  const d = o.choke ?? dec;
  const out = o.to ?? v.out;
  const wob = v.amp(1, { t, to: out });
  v.lfo(wob.gain, [[0, rate * 0.85], [d, rate * 1.1]], [[0, o.depth ?? 0.5], [d, 0]], { t, d: d + 0.02 });
  const env = (peak: number, dd: number): Pt[] => (o.choke !== undefined ? [[0, 0.0001], [0.002, peak, 'e'], [Math.min(dd, o.choke) * 0.7, peak * 0.25, 'e'], [Math.min(dd, o.choke), 0.0001, 'e']] : perc(peak, dd, 0.002));
  const car = v.tone('sine', f, { t, g: env(g, dec), to: wob });
  const mod = modDepth(v, perc((o.index ?? 2.5) * f, dec * 0.32, 0.001), t);
  v.tone('sine', f * RATIO, { t, d: dec + 0.01, to: mod });
  mod.connect(car.osc.frequency);
  v.lfo(car.osc.detune, rate, [[0, o.cents ?? 12], [d, 0]], { t, d: d + 0.02 });
  // the 196 Hz partial (where the plate's colour lives) and its own inharmonic shimmer
  const p2 = v.tone('sine', f * 2, { t, g: env(g * 0.55 * (o.partial ?? 1), dec * 0.7), to: wob });
  const mod2 = modDepth(v, perc(1.3 * f * 2, dec * 0.25, 0.001), t);
  v.tone('sine', f * 2 * RATIO, { t, d: dec + 0.01, to: mod2 });
  mod2.connect(p2.osc.frequency);
  // the plate's mass
  v.tone('sine', f * 0.5, { t, g: env(g * 0.5 * (o.body ?? 1), dec * 0.5), to: wob });
}

/** A modulator depth stage (FM): a bare gain node (never routed to the output), Hz scaled by the voice's pitch. */
function modDepth(v: Voice, e: Pt[] | number, t = 0): GainNode {
  const g = v.ctx.createGain();
  v.set(g.gain, e, t, v.pm);
  return g;
}

/** The leather straps creak: band-passed brown friction (120–400 Hz) with a slow wander, `d` seconds. */
function creak(v: Voice, t: number, d: number, g: number, o: { f?: readonly [number, number]; to?: AudioNode; rate?: number } = {}): void {
  const f = o.f ?? [160, 360];
  const bp = v.filt('bandpass', [[0, f[0]], [d * 0.6, f[1], 'e'], [d, f[0] * 1.2, 'e']], 3.2, { t, to: o.to });
  v.wander(bp.frequency, 3, 60, { t, d });
  const fr = v.flutter(o.rate ?? 22, 0.6, { t, d: d + 0.02, base: 0.45, to: bp });
  v.noise('brown', { t, g: [[0, 0], [d * 0.2, g], [d * 0.8, g * 0.8], [d, 0.0001, 'e']], to: fr });
}

/** The giant's chest "HUP": a brown puff and a 150 → 320 Hz formant sweep over a short saw grunt. */
function hup(v: Voice, t: number, g: number, o: { to?: AudioNode } = {}): void {
  puff(v, t, g * 0.8, 0.16, 700, { kind: 'brown', att: 0.01, to: o.to });
  const fm = v.filt('bandpass', [[0, 150], [0.09, 320, 'e'], [0.18, 220, 'e']], 4, { t, to: o.to });
  v.tone('sawtooth', [[0, 92], [0.06, 104, 'e'], [0.18, 80, 'e']], { t, g: [[0, 0], [0.025, g * 0.9], [0.12, g * 0.5], [0.2, 0.0001, 'e']], to: fm });
  v.noise('pink', { t, g: [[0, 0], [0.02, g * 0.35], [0.16, 0.0001, 'e']], to: fm });
}

/** A bare-foot thud on the floor (the giant's weight). */
function foot(v: Voice, t: number, g: number): void {
  thump(v, t, 72, 44, g, 0.22, { drive: 1.6 });
  puff(v, t + 0.004, g * 0.5, 0.14, 500, { kind: 'brown' });
}

/** The ward ladder (pitch factors for kdSapStep): G2 F2 D2 C2 A♭1. */
export const SAP_PITCH = [1, 0.891, 0.749, 0.667, 0.561] as const;

// ================================================================ recipes

export const SHIELD_TITAN_RECIPES = {
  kdDrawbridgeCreak: {
    cap: 1,
    gap: 0.3,
    verb: 0.35,
    duck: 0.25,
    play(v) {
      const D = 1.25;
      // three hauls: each a long strap creak that rises in pitch as the slab climbs
      [0, 0.34, 0.66].forEach((t, i) => creak(v, t + 0.02, 0.36, 0.95 + i * 0.15, { f: [150 + i * 25, 330 + i * 40] }));
      // the slab's hinge edge grinding on the tile, low and soft
      v.noise('brown', { t: 0.05, g: [[0, 0], [0.2, 0.24], [D - 0.2, 0.2], [D, 0.0001, 'e']], to: v.filt('lowpass', [[0, 180], [D, 260]], 1.2) });
      // grit trickling off the face as it rises
      v.crackle({ t: 0.3, d: 0.8, n: 12, g: 0.07, f: 2200, q: 1.2, curve: 0.8, dec: 0.006 });
      // the plate starts to sing as it comes upright (a faint swell of its ring)
      v.tone('sine', G2 * 2, { t: 0.5, g: [[0, 0], [0.6, 0.06], [D - 0.45, 0.0001, 'e']] });
    },
  },
  kdHinge: {
    cap: 3,
    gap: 0.05,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      // summon f1 / f2 / f3 (pitch 1 · 1.12 · 1.26 per call, 25° → 55° → 80°): the drawbridge hinge GROANS up a notch —
      // a stick-slip saw through a rising band, the straps with it, and the slab knocking up one notch
      const D = 0.3;
      const bp = v.filt('bandpass', [[0, 260], [D, 430, 'e']], 4);
      const fr = v.flutter(19, 0.8, { d: D + 0.02, base: 0.3, to: bp });
      v.tone('sawtooth', [[0, 58], [D * 0.7, 66, 'e'], [D, 61]], { g: [[0, 0], [0.03, 0.55], [D * 0.75, 0.45], [D, 0.0001, 'e']], to: fr });
      creak(v, 0, D, 0.55, { f: [190, 400], rate: 24 });
      thump(v, 0, 74, 50, 0.22, 0.08);
    },
  },
  kdPlateBloom: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      // summon f4: the slab comes upright — its ring BLOOMS in (no strike: the copper settling into its own voice),
      // the wobble waking 4 → 7 Hz, two soft rocking knocks as it settles on its foot
      const D = 0.75;
      const wob = v.amp(1);
      v.lfo(wob.gain, [[0, 4], [D, 7]], [[0, 0.15], [D, 0.55]], { d: D + 0.1 });
      v.tone('sine', G2 * 2, { g: [[0, 0.0001], [0.3, 0.18, 'e'], [D, 0.0001, 'e']], to: wob });
      v.tone('sine', G2, { g: [[0, 0.0001], [0.3, 0.14, 'e'], [D, 0.0001, 'e']], to: wob });
      v.bell(G2 * 4, { t: 0.26, g: 0.08, dec: 0.5, ratio: RATIO, index: 0.8, to: wob });
      [0.32, 0.5].forEach((t, i) => thump(v, t, 92, 60, 0.24 - i * 0.09, 0.1));
    },
  },
  kdGateBoom: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.7,
    play(v) {
      // summon land only (over kdPlant): the GATE SHUTS — a deep boom, a slow wub tail that rolls on for two seconds,
      // a G4 / D5 bloom of the sunstone, and the arena throwing the boom back once
      thump(v, 0, 50, 24, 0.62, 0.7, { drive: 2.6 });
      puff(v, 0, 0.45, 0.45, 380, { kind: 'brown' });
      plate(v, 0.006, 0.2, 2.0, { rate: 4.5, depth: 0.75, cents: 10, index: 2.2, partial: 1.1, body: 1.2 });
      v.bell(G2 * 4, { t: 0.02, g: 0.09, dec: 1.4, ratio: RATIO, index: 0.9 });
      v.bell(G2 * 6, { t: 0.05, g: 0.06, dec: 1.2, ratio: RATIO, index: 0.7 });
      thump(v, 0.3, 46, 30, 0.16, 0.4);
    },
  },
  kdHeave: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      const D = 1.6;
      hup(v, 0, 0.45);
      // the straps pulled taut and held: creak loops that tighten
      for (let t = 0.12, i = 0; t < D - 0.2; i++) {
        creak(v, t, 0.26, 0.4 + 0.06 * Math.min(4, i), { f: [170 + i * 12, 340 + i * 16], rate: 18 + i * 3 });
        t += 0.3 - Math.min(0.1, i * 0.02);
      }
      // the plate hums under the strain (a faint 196 Hz with a slowly quickening tremble)
      const hum = v.amp(1);
      v.lfo(hum.gain, [[0, 3], [D, 7]], 0.4, { d: D });
      v.tone('sine', G2 * 2, { g: [[0, 0], [0.5, 0.035], [D - 0.2, 0.04], [D, 0.0001, 'e']], to: hum });
    },
  },
  kdStep: {
    cap: 3,
    gap: 0.04,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      foot(v, 0, 0.6);
      creak(v, 0.02, 0.14, 0.25, { f: [200, 300] });
    },
  },
  kdSlabSwing: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      // a big flat surface pushing air down: a pink sweep 200 → 900 → 150 Hz
      sweep(v, 0, 0.3, [200, 900, 150], 1.6, { q: 1.1, kind: 'pink', peakAt: 0.55, pan: [-0.15, 0.2] });
      sweep(v, 0.02, 0.24, [400, 1600, 300], 0.45, { q: 1.6, kind: 'white', peakAt: 0.6 });
      // the giant grunts with it
      hup(v, 0, 0.3);
    },
  },
  kdSlabSlam: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    duck: 0.6,
    play(v) {
      // the flat SLAP first (round 2 #6): a shaped broadband pink burst, 2–6 kHz, with a low-mid body under it …
      v.noise('pink', { g: [[0, 0], [0.002, 0.95], [0.028, 0.0001, 'e']], to: v.filt('bandpass', 3800, 0.6) });
      v.noise('pink', { g: [[0, 0], [0.003, 0.55], [0.05, 0.0001, 'e']], to: v.filt('bandpass', 650, 0.9) });
      // … then the weight and the ring
      puff(v, 0.004, 0.55, 0.2, 900, { kind: 'brown' });
      thump(v, 0.006, 82, 40, 0.6, 0.32, { drive: 2.4 });
      plate(v, 0.012, 0.26, 1.0, { rate: 7, depth: 0.55, index: 2.8 });
      v.crackle({ t: 0.03, d: 0.35, n: 12, g: 0.1, f: 2400, q: 1.1, curve: 1.6, dec: 0.007 });
    },
  },
  kdPlateShiver: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      plate(v, 0, 0.2, 0.5, { rate: 9, depth: 0.75, cents: 20, index: 1.8, body: 0.4 });
      // the rim rattles against the shield's foot (three copper ticks, slowing)
      [0.03, 0.1, 0.2].forEach((t, i) => v.bell(G2 * 6.1, { t, g: 0.08 - i * 0.015, dec: 0.08, ratio: RATIO, index: 1 }));
    },
  },
  kdSledScrape: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      const D = 0.5;
      // the copper face skidding on stone: band-passed noise with a scraping flutter, panned along the lane
      const out = v.panner([[0, -0.4], [D, 0.5]]);
      const fr = v.flutter(55, 0.7, { d: D + 0.02, base: 0.5, to: v.filt('bandpass', [[0, 900], [D, 600, 'e']], 2.4, { to: out }) });
      v.noise('white', { g: [[0, 0], [0.03, 0.4], [D * 0.75, 0.32], [D, 0.0001, 'e']], to: fr });
      v.noise('brown', { g: [[0, 0], [0.04, 0.3], [D, 0.0001, 'e']], to: v.filt('lowpass', 220, 1, { to: out }) });
      // the plate rings under it, wobbling with the bumps
      plate(v, 0, 0.12, D + 0.1, { rate: 11, depth: 0.6, index: 1.6, to: out, body: 0.5 });
    },
  },
  kdStrapHaul: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      creak(v, 0, 0.45, 0.6, { f: [180, 380], rate: 26 });
      // the slab dragged back home (soft, low)
      v.noise('brown', { t: 0.05, g: [[0, 0], [0.08, 0.14], [0.42, 0.0001, 'e']], to: v.filt('bandpass', 420, 1.5) });
      hup(v, 0.02, 0.16);
    },
  },
  kdPlant: {
    cap: 3,
    gap: 0.04,
    verb: 0.35,
    duck: 0.55,
    play(v) {
      // "DUNK": the foot of the shield driven into the floor — mostly sub and dirt; the ring only a trace (−10 dB)
      thump(v, 0, 54, 28, 0.75, 0.34, { drive: 2.6 });
      puff(v, 0.004, 0.45, 0.22, 450, { kind: 'brown' });
      v.crackle({ t: 0.008, d: 0.18, n: 10, g: 0.12, f: 900, q: 0.9, curve: 1.8, dec: 0.006 });
      v.noise('brown', { t: 0.01, g: [[0, 0], [0.01, 0.22], [0.2, 0.0001, 'e']], to: v.filt('bandpass', 1100, 0.8) });
      plate(v, 0.006, 0.045, 0.45, { rate: 7.5, depth: 0.4, index: 2 });
    },
  },
  kdFistBang: {
    cap: 4,
    gap: 0.02,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      // the knuckles: a hollow mid KNOCK (wood-on-metal, 600–900 Hz), then a DRY, choked ring (no long wub: round 2 #6)
      v.tone('sine', [[0, 880], [0.03, 740, 'e']], { g: perc(0.32, 0.05, 0.001) });
      v.noise('pink', { g: perc(0.5, 0.03, 0.0005), to: v.filt('bandpass', 760, 2.2) });
      v.bell(640, { g: 0.12, dec: 0.12, ratio: 2.32, index: 1.4 });
      thump(v, 0, 110, 60, 0.36, 0.1, { drive: 1.4 });
      plate(v, 0.003, 0.22, 0.6, { rate: 8, depth: 0.5, cents: 10, index: 2, partial: 1.3, choke: 0.32 });
    },
  },
  kdWardWake: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.4,
    play(v) {
      const D = 0.9;
      // the ring swelling in (reverse-ish attack) on G2 + its octave, the flutter rising 3 → 9 Hz
      const wob = v.amp(1);
      v.lfo(wob.gain, [[0, 3], [D, 9, 'e']], [[0, 0.2], [D, 0.6]], { d: D + 0.1 });
      const c = v.tone('sine', G2 * 2, { g: [[0, 0.0001], [D * 0.85, 0.11, 'e'], [D + 0.1, 0.0001, 'e']], to: wob });
      v.lfo(c.osc.detune, [[0, 3], [D, 9, 'e']], 10, { d: D + 0.1 });
      const mod = modDepth(v, [[0, 0], [D, G2 * 2 * 1.6]]);
      v.tone('sine', G2 * 2 * RATIO, { d: D + 0.1, to: mod });
      mod.connect(c.osc.frequency);
      v.tone('sine', G2, { g: [[0, 0.0001], [D * 0.9, 0.08, 'e'], [D + 0.1, 0.0001, 'e']], to: wob });
      // the straps tighten as he digs in
      creak(v, 0.02, 0.4, 0.35, { f: [160, 300] });
      // heels in the floor
      puff(v, 0.0, 0.2, 0.12, 500, { kind: 'brown' });
    },
  },
  kdWardWall: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    duck: 0.6,
    play(v) {
      // "ZHUNG": a G2 copper strike and a pink sweep rising 300 → 2500 Hz as the rampart stands up
      plate(v, 0, 0.2, 1.1, { rate: 6, depth: 0.5, index: 3, partial: 1.2 });
      sweep(v, 0, 0.3, [300, 2500, 1800], 0.5, { q: 1.4, kind: 'pink', peakAt: 0.8 });
      thump(v, 0, 70, 40, 0.34, 0.25, { drive: 1.5 });
      // the masonry courses LOCKING, one per rise step (four stone knocks climbing: this is a wall, not a gong)
      [0.0, 0.03, 0.06, 0.09].forEach((t, i) => {
        thump(v, t, 230 + i * 50, 150, 0.26, 0.05);
        v.noise('pink', { t, g: perc(0.28, 0.025, 0.0005), to: v.filt('bandpass', 1300 + i * 250, 1.6) });
      });
      // the sunstone's bloom over it: G4 + D5, bright
      v.bell(G2 * 4, { t: 0.1, g: 0.12, dec: 0.9, ratio: RATIO, index: 1.6 });
      v.bell(G2 * 6, { t: 0.12, g: 0.08, dec: 0.8, ratio: RATIO, index: 1.2 });
    },
  },
  kdSapStep: {
    cap: 6,
    gap: 0.008,
    verb: 0.45,
    duck: 0.3,
    play(v) {
      // one gong step. The ladder's PITCH is carried by a struck copper bell at G5 with G4 under it (784 / 392 Hz at
      // pitch 1 → 440 / 220 Hz on the A♭ step): the descent reads at 400–800 Hz on phone speakers (round 2 #1); the
      // 98 Hz plate stays under it as the weight
      v.bell(G2 * 8, { g: 0.2, dec: 0.38, ratio: RATIO, index: 1.6 });
      v.bell(G2 * 4, { g: 0.14, dec: 0.45, ratio: RATIO, index: 1.2 });
      plate(v, 0, 0.18, 0.5, { rate: 8.5, depth: 0.5, index: 2.2, partial: 1.4, body: 0.5 });
      // the soft push "thup" of the masonry shove
      thump(v, 0, 140, 70, 0.2, 0.06);
      puff(v, 0, 0.16, 0.07, 900, { kind: 'pink' });
    },
  },
  kdSapDrain: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      // the stripped strength falls away: low-passed noise "fwoomp" 900 → 120 Hz
      v.noise('pink', { g: [[0, 0], [0.04, 0.5], [0.5, 0.0001, 'e']], to: v.filt('lowpass', [[0, 900], [0.5, 120, 'e']], 2) });
      v.tone('sine', [[0, 180], [0.45, 70, 'e']], { g: perc(0.18, 0.45, 0.01) });
      // the strength hits the floor: the ladder ends on a low THUD (the steps grow to this, never fade)
      thump(v, 0.03, 60, 30, 0.55, 0.38, { drive: 2 });
    },
  },
  kdRepel: {
    cap: 2,
    gap: 0.05,
    verb: 0.45,
    duck: 0.55,
    play(v) {
      // the wall takes the blow (a low push), then GATHERS itself: a reversed pink swell opening 500 → 2600 Hz …
      thump(v, 0, 90, 46, 0.4, 0.16, { drive: 1.8 });
      v.noise('pink', { g: [[0, 0.0001], [0.066, 0.45, 'e'], [0.072, 0.0001, 'e']], to: v.filt('bandpass', [[0, 500], [0.07, 2600, 'e']], 1.4) });
      // … into a BRIGHT G3 strike on 70 ms (the last crenellation slams the attacker on that frame)
      v.bell(G2 * 2, { t: 0.07, g: 0.22, dec: 0.7, ratio: RATIO, index: 4.5 });
      v.bell(G2 * 4, { t: 0.07, g: 0.12, dec: 0.5, ratio: RATIO, index: 2.5 });
      plate(v, 0.07, 0.13, 0.7, { rate: 7, depth: 0.55, index: 3.2, partial: 1.2, body: 0.6 });
      // the push WHOOSH that carries the shove into the attacker (played panned between the wall and it)
      v.noise('pink', { t: 0.075, g: [[0, 0], [0.04, 0.5], [0.26, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1800], [0.26, 500, 'e']], 1.1) });
    },
  },
  kdWallBreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      crack(v, 0, 0.5, { hp: 1200, lp: 6000, n: 6, gap: 0.016, dec: 0.014 });
      plate(v, 0, 0.22, 0.9, { rate: 8, depth: 0.5, index: 2.8, choke: 0.18 });
      thump(v, 0, 70, 35, 0.4, 0.22, { drive: 2 });
      v.crackle({ t: 0.04, d: 0.45, n: 14, g: 0.1, f: 1800, q: 1.1, curve: 1.4, dec: 0.008 });
    },
  },
  kdPlateHit: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      plate(v, 0, 0.17, 0.3, { rate: 8, depth: 0.5, index: 2.2, partial: 1 });
    },
  },
  kdKneel: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      thump(v, 0.02, 90, 50, 0.32, 0.14, { drive: 1.3 });
      thump(v, 0.14, 84, 46, 0.36, 0.16, { drive: 1.3 });
      puff(v, 0.15, 0.2, 0.12, 500, { kind: 'brown' });
      creak(v, 0, 0.32, 0.4, { f: [140, 260], rate: 14 });
      // a breath out of the old giant (soft, falling)
      v.noise('pink', { t: 0.05, g: [[0, 0], [0.05, 0.08], [0.35, 0.0001, 'e']], to: v.filt('bandpass', [[0, 700], [0.35, 300, 'e']], 2) });
    },
  },
  kdTopple: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      // played ≈ 420 ms before the slam (deathLayers): a long creaking GROAN as the slab goes over, the plate's ring
      // swelling as it falls, and the air SUCKED under the lid — all of it peaking right before the slam, cut by it
      const D = 0.42;
      creak(v, 0, D, 0.9, { f: [160, 460], rate: 26 });
      const bp = v.filt('bandpass', [[0, 240], [D, 520, 'e']], 4);
      v.tone('sawtooth', [[0, 55], [D, 82, 'e']], { g: [[0, 0], [0.1, 0.25], [D - 0.05, 0.5], [D, 0.0001, 'e']], to: v.flutter(16, 0.7, { d: D + 0.02, base: 0.35, to: bp }) });
      const wob = v.amp(1);
      v.lfo(wob.gain, [[0, 4], [D, 9]], 0.4, { d: D + 0.02 });
      v.tone('sine', G2 * 2, { g: [[0, 0.0001], [D - 0.04, 0.14, 'e'], [D, 0.0001, 'e']], to: wob });
      v.noise('pink', { t: 0.1, g: [[0, 0.0001], [D - 0.13, 0.5, 'e'], [D - 0.1, 0.0001, 'e']], to: v.filt('bandpass', [[0, 300], [D - 0.1, 1500, 'e']], 1.2) });
    },
  },
  kdLidSlam: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.7,
    play(v) {
      // the huge flat SLAP: low puff + thump 60 → 32 Hz driven + the ring's long decaying wub-wub
      puff(v, 0, 0.7, 0.3, 700, { kind: 'brown' });
      thump(v, 0, 62, 32, 0.6, 0.42, { drive: 2.8 });
      plate(v, 0.003, 0.22, 1.4, { rate: 6, depth: 0.7, cents: 14, index: 3 });
      // the slap stays LOW-MID (no bright paper-like 1–3 kHz PAT: S11's book-close owns that, round 2 #10)
      v.noise('pink', { t: 0.002, g: [[0, 0], [0.003, 0.6], [0.06, 0.0001, 'e']], to: v.filt('bandpass', 480, 0.8) });
      // the dust ring blowing out along the edges
      sweep(v, 0.02, 0.4, [500, 1100, 300], 0.25, { q: 0.9, kind: 'pink', peakAt: 0.25 });
    },
  },
  kdTarnish: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.2,
    play(v) {
      // the copper cools dark: a dry hiss, the ring FALLING audibly (G3 → E3, with its bell partial), and the
      // contracting copper ticking — tick … tick … tick, spreading apart as it cools
      v.noise('white', { g: [[0, 0], [0.05, 0.12], [0.5, 0.0001, 'e']], to: v.filt('highpass', 3500, 0.8) });
      v.tone('sine', [[0, G2 * 2], [0.7, G2 * 2 * 0.84, 'e']], { g: perc(0.24, 0.8, 0.01) });
      v.tone('sine', [[0, G2 * 4], [0.7, G2 * 4 * 0.84, 'e']], { g: perc(0.1, 0.6, 0.01) });
      [0.12, 0.25, 0.4, 0.58, 0.8].forEach((t, i) => v.bell(2600 + (i % 2) * 500, { t, g: 0.12 - i * 0.015, dec: 0.03, ratio: 1.47, index: 0.8 }));
    },
  },
  kdWardRise: {
    cap: 1,
    gap: 0.2,
    verb: 0.65,
    duck: 0.4,
    play(v) {
      // the end-of-life motif: a clear rising G–D–G arpeggio (392 · 587 · 784 Hz) of warm copper bells, a fading
      // wobble on them — the ward's light leaving
      const wob = v.amp(1);
      v.lfo(wob.gain, 6, [[0, 0.35], [1.1, 0]], { d: 1.15 });
      [392, 587, 784].forEach((f, i) => {
        v.bell(f, { t: i * 0.11, g: 0.2 - i * 0.02, dec: 0.95, ratio: 2, index: 0.9, to: wob });
        v.tone('sine', [[0, f], [0.9, f * 1.02, 'e']], { t: i * 0.11, g: perc(0.06, 0.8, 0.02), to: wob });
      });
      sweep(v, 0, 0.6, [800, 2600, 4000], 0.12, { q: 2, kind: 'pink', peakAt: 0.6 });
    },
  },
  kdWardReturn: {
    cap: 1,
    gap: 0.3,
    verb: 0.6,
    duck: 0.35,
    play(v) {
      const D = 0.8;
      // the ward light gathering back down into the boss (the partials falling in), the flutter rising
      const wob = v.amp(1);
      v.lfo(wob.gain, [[0, 3], [D, 9, 'e']], [[0, 0.1], [D, 0.5]], { d: D + 0.2 });
      [392, 294, 196].forEach((f, i) => v.tone('sine', [[0, f * 1.06], [D, f, 'e']], { t: i * 0.08, g: [[0, 0], [D * 0.6, 0.05], [D + 0.15 - i * 0.08, 0.0001, 'e']], to: wob }));
      v.tone('sine', G2, { g: [[0, 0.0001], [D, 0.07, 'e'], [D + 0.2, 0.0001, 'e']], to: wob });
      // the dead copper creaking as it warms
      creak(v, 0.3, 0.4, 0.25, { f: [140, 240] });
    },
  },
  kdReviveHeave: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.55,
    play(v) {
      // the lid LIFTED off him: the hup, the copper scraping up off the floor (a rising grit band) and the ring rising
      // a semitone into tune as it comes upright — then the plant (sub only)
      hup(v, 0, 0.4);
      v.noise('white', { g: [[0, 0], [0.03, 0.2], [0.2, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1200], [0.2, 3200, 'e']], 1.6) });
      v.tone('sine', [[0, G2 * 2 * 0.94], [0.25, G2 * 2, 'e']], { g: [[0, 0.0001], [0.12, 0.16, 'e'], [0.7, 0.0001, 'e']] });
      thump(v, 0.06, 54, 30, 0.62, 0.3, { drive: 2.2 });
      plate(v, 0.065, 0.12, 0.8, { rate: 7, depth: 0.5, index: 2.4, partial: 1.2 });
    },
  },
} satisfies Record<string, Recipe>;

export type ShieldTitanSfxName = keyof typeof SHIELD_TITAN_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry): shipped with its strike + death cinematics (src/cinematics/kart-f/shield_titan.ts). */
export const SHIELD_TITAN_VOICE: CharacterSounds | null = {
  roar: 'kdFistBang',
  arrive: 'kdDrawbridgeCreak',
  land: 'kdPlant',
  charge: 'kdHeave',
  release: 'kdSlabSwing',
  impact: 'kdSlabSlam',
  dissolve: 'kdTopple',
  afterDissolve: [[2, 'kdLidSlam', 1.0]],
  burst: 'kdWardRise',
  reviveGather: 'kdWardReturn',
  reviveLand: 'kdReviveHeave',
};
