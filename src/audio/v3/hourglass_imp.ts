// Kum Saati Cücesi (hourglass_imp) — v3 sounds (lane F). Spread into the game through ./kart-f.ts.
// Identity: docs/v3/oturum-f/hourglass_imp.md §7 (checked against docs/v3/YENI_KARTLAR.md §5.1). Built from ./kit.ts blocks and the Voice primitives only.
//
// Palette (one parameter set):
//   bulb    the glass bulb's hum: B♭4 (466 Hz) sine + a weak 2nd partial + a little breath noise through the same
//           pitch (blowing across a bottle), a slow 0.3 Hz pitch wobble; the fifth F5 (698 Hz) for the big beats
//   grains  fine sand INSIDE glass: an aperiodic train of tiny noise clicks (random gaps, never a pulse) through the
//           bulb's two narrow cavity resonances (1.4 kHz q 6, 2.8 kHz q 4) over a 1.2 kHz high-pass — grains in
//           glass, never an outdoor hiss or a broadband "şşş"
//   brass   the caps' brass rims: a HARMONIC FM tink (1180 Hz, ratio 2.0 — never the 2.76 plate / 1.41 clank ratios)
//   base    the glass foot on the tile: a dull sine thud ≤ 150 Hz (never a hollow wood "tok")
//   imp     a tiny nasal giggle: square blips through 700 / 1100 Hz formants gliding up
//   the time seal (signature): the trickle cuts DEAD, 60 ms of silence, one dry 4 kHz "tık", then a flat B♭4 + F5
//           glass tone held 380 ms that stops without decay — "time stopped" heard as sound stopping
//
//   hgiPour          summon `arrive` (sustained): the hanging glass pours a glowing stream onto the tile
//   hgiShed          summon f6 / f7: sand slides off him in two soft bands
//   hgiCatch         summon `land`: he catches the falling glass (brass tink) and plants it (soft thud)
//   hgiGiggle        `roar` / summon f12: the giggle
//   hgiFlip          strike `charge` (the declaration) / effect flip: brass tink-tink, sand sliding inside, the "turn"
//   hgiCork          strike f5: the stopper flicked off ("pop")
//   hgiJet           strike `release` (sustained): the sand jet's hiss
//   hgiScour         strike `impact` on a body: the sand-blast "fssh-t" + a bulb blip
//   hgiSplash        blocked contact: the jet cut by the guard, a dull "fff"
//   hgiJetLp         direct contact: the soft dune "fff" against the LP panel + an F5 hum
//   hgiDune          direct: the dune slides off the panel (a short dry trickle)
//   hgiRight         strike / effect recover: re-corked, the glass turned upright and thunked down, trickle restarts
//   hgiThread        effect release (sustained): the thin glowing sand thread arcing over the field, hum rising
//   hgiCage          effect: the glass builds round the target (three stepped glass tings B♭5 D6 F6)
//   hgiFill          effect: sand fills the cage's lower bulb (short trickle swell)
//   hgiSeal          effect THE STOP (signature, see above)
//   hgiCondense      effect: the giant cage collapses into the emblem (a glass "zip" up + a brass clink)
//   hgiInvert        effect opener (Round 2 #1): the glass turned over overhead — a slow wooden turn, sand sloshing
//                    from bulb to bulb (falling then rising), a low B♭3 bulb swell (hgiFlip is the attack's only)
//   hgiLitTick       effect: one grain of the still time line lights
//   hgiHush          effect: silent; pulls the music down before THE STOP
//   hgiCreak         death f8: the full glass rocks, the cap creaks on its rim
//   hgiBounce        death: the lying glass's 1-px bounce re-thud
//   hgiEep           death f2: the imp's descending "eep" as he clutches the glass
//   hgiBite          the frozen turn starts: a muffled tick + a refused 80 ms trickle (cap 6, gap 8 ms)
//   hgiStrain        the frozen monster's battle phase: grains clamp ×3 rising, a choked hum (cap 6)
//   hgiThaw          the frozen turn is spent: a trickle that runs out + an F6 glass ting
//   hgiEmblemDrop    the sealed monster leaves the field: the emblem falls and its grains scatter
//   hgiDrain         death `dissolve` (sustained): he pours into his own glass, hum gliding down B♭4 → F4
//   hgiTopple        death f8: the glass tips over (dull thud + a glass crack)
//   hgiBleed         death cinematic: the sand bleeds from the crack, the trickle slowing to nothing
//   hgiLastGrain     death `burst`: one dry tick + a tiny B♭6 ping, then nothing
//   hgiReviveGather  revive `reviveGather` (sustained): the drain reversed, rising F4 → B♭4
//   hgiReviveLand    revive `reviveLand`: the sandal plant + the sand sneeze "pff"

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { midiHz, perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

// ================================================================ palette

/** B♭4, the bulb's hum. */
const BB4 = 466.16;
/** F5, its fifth (big beats). */
const F5 = 698.46;
/** The brass tink. */
const TINK = 1180;

/**
 * The bulb hum: a sine on `f` (+ a weak 2nd partial) and breath noise through a narrow band at `f`, a slow 0.3 Hz
 * pitch wobble. `env` shapes the level; `f` may be an envelope (a glide).
 */
function hum(v: Voice, t: number, f: number | readonly Pt[], env: readonly Pt[], o: { breath?: number; partial?: number; to?: AudioNode } = {}): void {
  const d = env[env.length - 1][0];
  const a = v.tone('sine', f, { t, g: env, to: o.to });
  v.lfo(a.osc.detune, 0.3, 9, { t, d: d + 0.02 });
  const p2 = v.tone('sine', typeof f === 'number' ? f * 2 : f.map(([x, y, c]) => [x, y * 2, c] as Pt), { t, g: env.map(([x, y, c]) => [x, y * (o.partial ?? 0.14), c] as Pt), to: o.to });
  v.lfo(p2.osc.detune, 0.3, 9, { t, d: d + 0.02 });
  const br = o.breath ?? 0.35;
  if (br > 0) {
    const bp = v.filt('bandpass', f, 18, { t, to: o.to });
    v.noise('white', { t, g: env.map(([x, y, c]) => [x, y * br * 2.2, c] as Pt), to: bp });
  }
}

/** The bulb's cavity: two narrow resonances over a 1.2 kHz high-pass. Returns the input node. */
function bulb(v: Voice, o: { to?: AudioNode; lo?: number; hi?: number; tilt?: number } = {}): AudioNode {
  const top = v.filt('lowpass', 9000, 0.7, { to: o.to });
  const hp = v.filt('highpass', 1200, 0.7, { to: top });
  const inp = v.amp(1);
  const a = v.filt('bandpass', o.lo ?? 1400, 6, { to: hp });
  const b = v.filt('bandpass', o.hi ?? 2800, 4, { to: hp });
  const ga = v.amp(1.0);
  const gb = v.amp(o.tilt ?? 0.8);
  inp.connect(ga).connect(a);
  inp.connect(gb).connect(b);
  // a little of the raw grain too, so it is never just a whistle
  inp.connect(v.amp(0.08, { to: hp }));
  return inp;
}

/**
 * Grains inside the glass: `rate` grains / s over `d` seconds (rate may glide `rate1`), aperiodic (random gaps),
 * each a 2–8 ms click; level `g` shaped by `shape` (0…1 over the length). Deterministic for a seeded voice.
 */
function grains(v: Voice, t: number, d: number, rate: number, g: number, o: { rate1?: number; to?: AudioNode; shape?: (k: number) => number; dec?: number; lo?: number; hi?: number } = {}): void {
  const times: number[] = [];
  const gains: number[] = [];
  const decs: number[] = [];
  const r1 = o.rate1 ?? rate;
  let x = 0;
  while (x < d) {
    const k = x / d;
    const r = rate + (r1 - rate) * k;
    times.push(x);
    const s = o.shape ? o.shape(k) : 1;
    gains.push(g * s * (0.4 + 0.6 * v.rnd()));
    decs.push((o.dec ?? 0.004) * (0.5 + v.rnd()));
    // exponential gaps: random, never periodic
    x += (-Math.log(1 - v.rnd() * 0.98) / Math.max(1, r));
  }
  if (!times.length) return;
  v.bursts(times, gains, { t, dec: decs, f: 2000, q: 0.45, to: bulb(v, { to: o.to, lo: o.lo, hi: o.hi }) });
}

/** The brass tink: a harmonic FM ping (ratio 2.0) + a tiny click. */
function tink(v: Voice, t: number, g: number, o: { f?: number; dec?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? TINK;
  v.bell(f, { t, g, dec: o.dec ?? 0.18, ratio: 2, index: 1.6, idxDec: 0.04, to: o.to });
  v.tone('sine', f * 2, { t, g: perc(g * 0.25, (o.dec ?? 0.18) * 0.5, 0.0005), to: o.to });
  v.noise('white', { t, g: perc(g * 1.2, 0.004, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 3.2), 1.6, { to: o.to }) });
}

/** One dry "tık": a 1–2 ms filtered click at 4 kHz. */
function tick(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode } = {}): void {
  v.noise('white', { t, g: perc(g, 0.0018, 0.0002), to: v.filt('bandpass', o.f ?? 4000, 2.4, { to: o.to }) });
}

/** A pure glass ting (sine + its octave, short decay — never bar modes: those are the wyrm's). */
function ting(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', f, { t, g: perc(g, dec, 0.0008), to });
  v.tone('sine', f * 2, { t, g: perc(g * 0.22, dec * 0.45, 0.0008), to });
}

/** The glass foot on the tile: a dull sine thud (≤ 150 Hz) + a soft low puff. */
function base(v: Voice, t: number, g: number, o: { f0?: number; f1?: number } = {}): void {
  thump(v, t, o.f0 ?? 140, o.f1 ?? 78, g, 0.12, { drive: 1.1 });
  puff(v, t + 0.004, g * 0.22, 0.09, 900, { kind: 'pink' });
}

/** One nasal imp blip: a square at f through the 700 / 1100 Hz formants. */
function blip(v: Voice, t: number, f0: number, f1: number, g: number, d = 0.055): void {
  const sum = v.amp(1);
  const f1n = v.filt('bandpass', 700, 5, { to: sum });
  const f2n = v.filt('bandpass', 1100, 6, { to: sum });
  const src = v.amp(1);
  src.connect(f1n);
  src.connect(f2n);
  v.tone('square', [[0, f0], [d, f1, 'e']], { t, g: [[0, 0], [0.006, g], [d * 0.7, g * 0.7], [d, 0.0001, 'e']], to: src });
}

const SEAL_MS = 0.38;

export const HOURGLASS_IMP_RECIPES = {
  // ---------------------------------------------------------------- summon
  /**
   * The hanging glass pours (≈ 1.6 s, stopped at the catch). Round 2 #4: its own layer is the FALLING COLUMN — a hollow
   * pink "thrum" through a 500 → 900 Hz band that rises as the cone grows — plus a low patter of landing grains
   * (soft 180–260 Hz knocks); the grains in glass are the shared material, quieter under it.
   */
  hgiPour: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    duck: 0.3,
    play(v) {
      const d = 1.6;
      grains(v, 0, d, 60, 0.3, { rate1: 100, shape: (k) => Math.min(1, k * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1) });
      // the falling column: a hollow thrum, rising with the cone
      const col = v.filt('bandpass', [[0, 500], [d, 900, 'e']], 3.2);
      v.noise('pink', { g: [[0, 0], [0.12, 0.22], [d - 0.25, 0.3], [d, 0.0001, 'e']], to: col });
      v.lfo(col.frequency, 7, 40, { d });
      // the landing patter: soft low knocks of grains on the pile (aperiodic)
      const times: number[] = [];
      const gs: number[] = [];
      for (let x = 0.1; x < d - 0.1; x += 0.035 + v.rnd() * 0.06) {
        times.push(x);
        gs.push(0.12 + v.rnd() * 0.1);
      }
      v.bursts(times, gs, { dec: 0.012, f: 220, q: 2.2, kind: 'pink' });
      hum(v, 0, BB4, [[0, 0], [0.35, 0.04], [d - 0.3, 0.05], [d, 0.0001, 'e']], { breath: 0.35 });
    },
  },
  /** The sculpt: sand slides off him in two soft bands (2.4 → 1.2 kHz). */
  hgiShed: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      for (const [t, g] of [[0, 0.16], [0.11, 0.12]] as const) {
        sweep(v, t, 0.12, [2400, 1900, 1200], g, { q: 3, kind: 'white', peakAt: 0.3 });
        grains(v, t, 0.12, 160, 0.22, { shape: (k) => 1 - k });
      }
    },
  },
  /** The catch + plant: a brass tink, a beat later the soft thud of the foot, a puff, the trickle restarting. */
  hgiCatch: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.45,
    play(v) {
      tink(v, 0, 0.13);
      tink(v, 0.07, 0.07, { f: TINK * 1.122 });
      base(v, 0.09, 0.55);
      grains(v, 0.16, 0.5, 40, 0.18, { shape: (k) => 1 - k * 0.7 });
    },
  },
  /** The giggle: three nasal blips gliding up 760 → 1020 Hz. */
  hgiGiggle: {
    cap: 2,
    gap: 0.15,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      blip(v, 0, 760, 820, 0.15);
      blip(v, 0.075, 840, 920, 0.13);
      blip(v, 0.15, 930, 1020, 0.14, 0.075);
      v.noise('white', { t: 0.02, g: [[0, 0], [0.04, 0.012], [0.2, 0.0001, 'e']], to: v.filt('bandpass', 2400, 2) });
    },
  },
  // ---------------------------------------------------------------- strike
  /** The flip / heave: two brass tinks, the sand sliding inside the glass, a low "turn" thump (≈ 0.5 s). */
  hgiFlip: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.35,
    play(v) {
      tink(v, 0, 0.1);
      tink(v, 0.09, 0.08, { f: 1324 });
      grains(v, 0.03, 0.18, 260, 0.34, { shape: (k) => Math.sin(Math.PI * k) });
      thump(v, 0.12, 110, 70, 0.32, 0.16);
      hum(v, 0.05, [[0, BB4 * 0.98], [0.4, BB4, 'e']], [[0, 0], [0.08, 0.025], [0.4, 0.0001, 'e']], { breath: 0.2 });
    },
  },
  /**
   * Round 2 #1: the EFFECT's own opener (hgiFlip stays the attack's). The glass turned over overhead: a slow wooden
   * "turn" (no ratchet, no brass tinks: a soft friction swell), the sand SLOSHING from one bulb to the other (grains
   * in the bulb bands whose band falls, then rises as the sand lands in the other bulb) and a low B♭3 bulb swell.
   */
  hgiInvert: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      const d = 0.5;
      const turn = v.filt('bandpass', [[0, 260], [d * 0.6, 420, 'e'], [d, 300, 'e']], 3);
      v.noise('brown', { g: [[0, 0], [0.12, 0.3], [0.3, 0.34], [d, 0.0001, 'e']], to: turn });
      grains(v, 0.04, 0.2, 240, 0.36, { lo: 1800, hi: 3200, shape: (k) => Math.sin(Math.PI * k) });
      grains(v, 0.22, 0.24, 280, 0.4, { lo: 1100, hi: 2400, shape: (k) => Math.sin(Math.PI * k) });
      grains(v, 0.36, 0.2, 160, 0.3, { lo: 1500, hi: 3000, shape: (k) => 1 - k });
      hum(v, 0, [[0, BB4 / 2], [d, BB4 / 2, 'e']], [[0, 0], [0.25, 0.09], [d, 0.0001, 'e']], { breath: 0.3, partial: 0.3 });
      thump(v, 0.3, 90, 60, 0.18, 0.14);
    },
  },
  /** The stopper flicked off: a tiny pop. */
  hgiCork: {
    cap: 2,
    gap: 0.04,
    verb: 0.2,
    duck: 0.15,
    play(v) {
      v.tone('sine', [[0, 900], [0.025, 300, 'e']], { g: perc(0.22, 0.028, 0.0005) });
      crack(v, 0.002, 0.1, { hp: 3000, lp: 9000, n: 1, dec: 0.006 });
    },
  },
  /** The jet (sustained ≈ 0.7 s; stopped after contact): dense grains at the upper resonance + a thin hiss rising. */
  hgiJet: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.4,
    play(v) {
      const d = 0.75;
      grains(v, 0, d, 230, 0.42, { rate1: 300, hi: 3000, shape: (k) => Math.min(1, k * 10) });
      const hp = v.filt('highpass', [[0, 1500], [d, 2100, 'e']], 0.8);
      const bp = v.filt('bandpass', [[0, 2600], [d, 3300, 'e']], 1.6, { to: hp });
      v.noise('white', { g: [[0, 0], [0.03, 0.06], [d - 0.1, 0.07], [d, 0.0001, 'e']], to: bp });
      hum(v, 0, [[0, BB4], [d, BB4 * 1.06, 'e']], [[0, 0], [0.05, 0.022], [d, 0.0001, 'e']], { breath: 0.3 });
    },
  },
  /** The scour (our impact on a body): grain bursts + a falling sand-blast sweep + a bulb blip. */
  hgiScour: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    duck: 0.5,
    play(v) {
      v.bursts([0, 0.012, 0.03, 0.052], [0.8, 0.55, 0.42, 0.3], { dec: 0.014, f: 2800, q: 1.2 });
      sweep(v, 0, 0.17, [3000, 2600, 1500], 0.24, { q: 1.4, kind: 'white', peakAt: 0.15 });
      thump(v, 0, 150, 90, 0.24, 0.07);
      hum(v, 0.02, F5, [[0, 0], [0.01, 0.06], [0.16, 0.0001, 'e']], { breath: 0.25 });
      grains(v, 0.06, 0.3, 120, 0.25, { shape: (k) => 1 - k });
    },
  },
  /** Blocked: the jet cut short on the guard — a dull "fff", grains bouncing off. */
  hgiSplash: {
    cap: 3,
    gap: 0.03,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      v.bursts([0, 0.01, 0.024], [0.42, 0.3, 0.2], { dec: 0.01, f: 2400, q: 1.1 });
      puff(v, 0, 0.36, 0.12, 600, { kind: 'pink' });
      grains(v, 0.02, 0.22, 180, 0.24, { shape: (k) => (1 - k) * (1 - k) });
    },
  },
  /** Direct contact: the soft dune "fff" against the LP panel + an F5 bulb hum. */
  hgiJetLp: {
    cap: 2,
    gap: 0.04,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      puff(v, 0, 0.36, 0.2, 1400, { kind: 'pink' });
      hum(v, 0.01, F5, [[0, 0], [0.02, 0.06], [0.2, 0.0001, 'e']], { breath: 0.3 });
      grains(v, 0, 0.35, 140, 0.3, { shape: (k) => 1 - k });
      thump(v, 0, 130, 80, 0.2, 0.08);
    },
  },
  /** Direct: the little dune slides off the panel (Round 2 #6: +8 dB). */
  hgiDune: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      sweep(v, 0, 0.22, [1600, 1400, 900], 0.21, { q: 2, kind: 'pink', peakAt: 0.3 });
      grains(v, 0, 0.26, 90, 0.68, { rate1: 30, shape: (k) => 1 - k });
    },
  },
  /** Re-cork + right: a thumb press, the glass turned upright and thunked, two jumps of sand, the trickle back. */
  hgiRight: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      tick(v, 0, 0.12, { f: 2600 });
      grains(v, 0.06, 0.07, 260, 0.26);
      grains(v, 0.17, 0.07, 260, 0.22);
      tink(v, 0.21, 0.06);
      base(v, 0.22, 0.4, { f0: 125, f1: 80 });
      grains(v, 0.33, 0.4, 40, 0.14, { shape: (k) => 1 - k * 0.8 });
    },
  },
  // ---------------------------------------------------------------- effect: "Kum Mührü"
  /**
   * The time line (sustained; cut DEAD at the seal). Round 2 #4: no flowing grains — the line hangs still. A thin
   * BOWED-GLASS whistle: a narrow noise band at F5 (q 30) with a slow swell, a sine under it, still loud at the cut.
   * The grains lighting "one by one" are hgiLitTick (fired per grain).
   */
  hgiThread: {
    cap: 2,
    gap: 0.05,
    verb: 0,
    duck: 0.35,
    play(v) {
      const d = 1.4;
      const env: Pt[] = [[0, 0], [0.18, 0.05], [0.5, 0.075], [d, 0.09]];
      const bp = v.filt('bandpass', F5, 30);
      v.noise('white', { g: env.map(([x, y]) => [x, y * 3.2] as Pt), to: bp });
      const a = v.tone('sine', F5, { g: env.map(([x, y]) => [x, y * 0.5] as Pt) });
      v.lfo(a.osc.detune, 5.2, 6, { d });
      v.tone('sine', F5 * 2, { g: env.map(([x, y]) => [x, y * 0.08] as Pt) });
    },
  },
  /** One grain of the time line lighting: a tiny bright glass tick (cap 8, gap 8 ms). */
  hgiLitTick: {
    cap: 8,
    gap: 0.008,
    verb: 0,
    duck: 0,
    vary: 0.06,
    play(v) {
      tick(v, 0, 1, { f: 5200 });
      v.tone('sine', F5 * 4, { g: perc(0.09, 0.03, 0.0005) });
    },
  },
  /** The glass builds round the target: three stepped glass tings B♭5 D6 F6 (dry: no tail may fill the seal's gap). */
  hgiCage: {
    cap: 6,
    gap: 0.008,
    verb: 0,
    duck: 0.4,
    play(v) {
      ting(v, midiHz(82), 0, 0.11, 0.07);
      ting(v, midiHz(86), 0.075, 0.1, 0.07);
      ting(v, midiHz(89), 0.15, 0.1, 0.07);
    },
  },
  /**
   * Sand fills the cage's lower bulb (sustained, at its PEAK rate right up to the cut — Round 2 #2: the seal stops it
   * dead, so the stop is heard as a stop, not a fade). Dry (verb 0).
   */
  hgiFill: {
    cap: 3,
    gap: 0.02,
    verb: 0,
    duck: 0.3,
    play(v) {
      const d = 1.0;
      grains(v, 0, d, 300, 0.42, { lo: 1400, hi: 2200, shape: (k) => Math.min(1, k * 12) });
      v.noise('pink', { g: [[0, 0], [0.04, 0.08], [d, 0.09]], to: v.filt('bandpass', 700, 1.6) });
    },
  },
  /** Round 2 #2: a silent recipe whose only job is to pull the music down ~150 ms before THE STOP (deepest duck). */
  hgiHush: {
    cap: 1,
    gap: 0.1,
    verb: 0,
    duck: 1,
    play(v) {
      v.tone('sine', 40, { g: [[0, 0], [0.01, 0.00001], [0.02, 0.0000001, 'e']] });
    },
  },
  /**
   * THE STOP: (the caller cuts every trickle dead first) 80 ms of silence, one dry 4 kHz "tık", then FROZEN GLASS held
   * 380 ms that stops with a 2 ms cut — no decay, no reverb. Round 2 #2: not a sine beep any more — the trickle itself
   * "frozen" as a static noise band through the SAME two bulb resonances (1.4 / 2.8 kHz, q 12, no modulation), a
   * B♭4 under it and a faint 3rd partial; ≈ 5 dB lower so the silence and the click carry the moment.
   */
  hgiSeal: {
    cap: 1,
    gap: 0.2,
    verb: 0,
    duck: 0.75,
    play(v) {
      const t0 = 0.08;
      tick(v, t0, 0.7);
      const t1 = t0 + 0.004;
      const flat = (g: number): Pt[] => [[0, 0], [0.004, g], [SEAL_MS, g], [SEAL_MS + 0.002, 0.0001, 'l']];
      v.tone('sine', BB4, { t: t1, g: flat(0.06) });
      v.tone('sine', BB4 * 3, { t: t1, g: flat(0.008) });
      v.noise('white', { t: t1, g: flat(0.5), to: v.filt('bandpass', 1400, 12, { t: t1 }) });
      v.noise('white', { t: t1, g: flat(0.34), to: v.filt('bandpass', 2800, 12, { t: t1 }) });
    },
  },
  /** Condense: the cage collapses into the emblem — a glass "zip" up, the hum gliding up, a brass CLINK as it snaps shut (Round 2 #6: +10 dB). */
  hgiCondense: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.35,
    play(v) {
      sweep(v, 0, 0.2, [1200, 2600, 4200], 0.24, { q: 5, kind: 'white', peakAt: 0.7 });
      v.tone('sine', [[0, BB4], [0.19, BB4 * 3, 'e']], { g: [[0, 0], [0.12, 0.07], [0.2, 0.0001, 'e']] });
      grains(v, 0, 0.2, 200, 0.3, { rate1: 60, shape: (k) => 1 - k * 0.6 });
      tink(v, 0.2, 0.16, { f: 2360, dec: 0.12 });
      tink(v, 0.215, 0.09, { f: 1180, dec: 0.16 });
    },
  },
  // ---------------------------------------------------------------- the seal across turns
  /** The frozen turn starts: a 3 kHz identity click + a muffled tick + an 80 ms trickle that is refused (Round 2 #6: +6 dB, played after the turn's card slide). */
  hgiBite: {
    cap: 6,
    gap: 0.008,
    verb: 0.15,
    duck: 0.25,
    play(v) {
      tick(v, 0, 0.8, { f: 3000 });
      tick(v, 0.012, 0.6, { f: 1800 });
      grains(v, 0.03, 0.08, 240, 0.5);
      v.tone('sine', BB4, { t: 0.03, g: [[0, 0], [0.01, 0.06], [0.08, 0.06], [0.082, 0.0001, 'l']] });
      tink(v, 0.11, 0.06, { f: 1580, dec: 0.08 });
    },
  },
  /** The strain: grains clamping ×3 rising, a choked hum cut at 150 ms. */
  hgiStrain: {
    cap: 6,
    gap: 0.008,
    verb: 0.2,
    duck: 0.2,
    play(v) {
      v.bursts([0, 0.06, 0.12], [0.18, 0.24, 0.32], { dec: 0.03, f: 1800, q: 2.4 });
      grains(v, 0, 0.16, 200, 0.18, { lo: 1400, hi: 2400 });
      v.tone('sine', [[0, BB4 * 0.94], [0.15, BB4, 'e']], { g: [[0, 0], [0.03, 0.04], [0.15, 0.05], [0.152, 0.0001, 'l']] });
    },
  },
  /** The thaw: a quick trickle that thins and runs out + a light F6 glass ting. */
  hgiThaw: {
    cap: 3,
    gap: 0.05,
    verb: 0.4,
    duck: 0.25,
    play(v) {
      grains(v, 0, 0.26, 180, 0.32, { rate1: 30, shape: (k) => 1 - k * 0.7 });
      ting(v, midiHz(89), 0.27, 0.07, 0.22);
      v.tone('sine', [[0, F5], [0.25, BB4, 'e']], { g: [[0, 0], [0.03, 0.025], [0.26, 0.0001, 'e']] });
    },
  },
  /** The sealed monster leaves the field: the emblem falls — a falling glass blip + a short grain scatter (Round 2 #6: +8 dB). */
  hgiEmblemDrop: {
    cap: 3,
    gap: 0.02,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      v.tone('sine', [[0, F5], [0.12, BB4 * 0.75, 'e']], { g: perc(0.13, 0.13, 0.003) });
      tick(v, 0.12, 0.6, { f: 3200 });
      grains(v, 0.12, 0.16, 160, 0.62, { shape: (k) => 1 - k });
    },
  },
  // ---------------------------------------------------------------- death: "Kendi kum saatine akar"
  /**
   * The drain (sustained ≈ 0.6 s). Round 2 #4: its own layer is a SUCKING INWARD swell — a crackle with a reversed
   * envelope (grows, then cuts) through a closing band — and a short descending imp "eep" (1000 → 600 Hz): he is heard
   * going into the glass. The hum glides down B♭4 → F4.
   */
  hgiDrain: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      const d = 0.6;
      grains(v, 0, d, 120, 0.26, { rate1: 200, shape: (k) => Math.min(1, k * 8) });
      const suck = v.filt('bandpass', [[0, 3200], [d * 0.9, 900, 'e']], 2.2);
      v.crackle({ d: d * 0.92, n: 90, g: 0.5, f: 2400, q: 1, dec: 0.004, to: suck, curve: 3 });
      v.noise('pink', { g: [[0, 0], [d * 0.88, 0.16, 'e'], [d * 0.9, 0.0001, 'l']], to: suck });
      blip(v, 0.03, 1000, 600, 0.2, 0.11);
      hum(v, 0, [[0, BB4], [d, BB4 * 0.749, 'e']], [[0, 0], [0.05, 0.05], [d, 0.03]], { breath: 0.4 });
    },
  },
  /**
   * The topple (Round 2 #5): a pre-tip creak of the wood cap rocking on its rim (60 ms), the main thud + the glass
   * crack, the sand SLOSHING inside (a grain burst with a falling contour), and the crack ringing 150 ms on harmonic
   * partials only. The 1-px bounce re-thud is hgiBounce, fired on the sprite's bounce frame.
   */
  hgiTopple: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    duck: 0.6,
    play(v) {
      const t = 0;
      base(v, t, 0.75, { f0: 130, f1: 62 });
      crack(v, t + 0.02, 0.26, { hp: 4000, lp: 11000, n: 3, gap: 0.006, dec: 0.01 });
      // the crack rings: harmonic partials of B♭5 only, 150 ms
      for (const [k, g] of [[1, 0.06], [2, 0.035], [3, 0.02]] as const) v.tone('sine', BB4 * 2 * k, { t: t + 0.02, g: perc(g, 0.15, 0.001) });
      // the slosh inside: a grain burst whose rate and band fall
      grains(v, t + 0.03, 0.32, 280, 0.42, { rate1: 40, lo: 1400, hi: 2000, shape: (k) => (1 - k) * (1 - k) });
    },
  },
  /** Death f8: the full glass rocks top-heavy on its foot — a 60 ms creak of the wood cap on its rim (pre-tip). */
  hgiCreak: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.2,
    play(v) {
      const cr = v.filt('bandpass', [[0, 420], [0.09, 300, 'e']], 6);
      v.tone('sawtooth', [[0, 92], [0.09, 70, 'e']], { g: [[0, 0], [0.012, 0.9], [0.05, 0.6], [0.09, 0.0001, 'e']], to: cr });
      v.bursts([0.01, 0.034, 0.05], [0.7, 0.55, 0.45], { dec: 0.008, f: 600, q: 3, kind: 'pink' });
    },
  },
  /** The 1-px bounce of the lying glass: a small re-thud ≈ −9 dB under the topple + a tiny grain shiver. */
  hgiBounce: {
    cap: 2,
    gap: 0.04,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      base(v, 0, 0.27, { f0: 120, f1: 70 });
      grains(v, 0.01, 0.1, 200, 0.2, { shape: (k) => 1 - k });
    },
  },
  /** Death f2–f3, the clutch: a small descending imp "eep" (Round 2 #5: the character is heard as he dries). */
  hgiEep: {
    cap: 2,
    gap: 0.08,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      blip(v, 0, 1000, 600, 0.12, 0.12);
      blip(v, 0.13, 760, 520, 0.06, 0.08);
    },
  },
  /** The bleed: the trickle thinning from 80 grains / s to 4 and stopping (≈ 0.4 s). */
  hgiBleed: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.2,
    play(v) {
      grains(v, 0, 0.42, 80, 0.3, { rate1: 4, lo: 1400, hi: 2600, shape: (k) => 1 - k * 0.5 });
      hum(v, 0, [[0, BB4 * 0.749], [0.4, BB4 * 0.7, 'e']], [[0, 0], [0.04, 0.016], [0.42, 0.0001, 'e']], { breath: 0.5 });
    },
  },
  /** The last grain: one dry tick + a tiny B♭6 ping with a 120 ms decay — "the clock stops" (Round 2 #5: +4 dB). */
  hgiLastGrain: {
    cap: 2,
    gap: 0.1,
    verb: 0.45,
    duck: 0.35,
    play(v) {
      tick(v, 0, 1, { f: 3500 });
      ting(v, midiHz(94), 0.004, 0.32, 0.12);
    },
  },
  // ---------------------------------------------------------------- revive
  /** The sand runs back up (sustained ≈ 1.1 s). Round 2 #4: the drain REVERSED (the suck played backwards: a swell that opens) + the giggle voice rising at the end; the hum rising F4 → B♭4. */
  hgiReviveGather: {
    cap: 2,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      const d = 1.1;
      grains(v, 0, d, 20, 0.26, { rate1: 160, shape: (k) => 0.3 + 0.7 * k });
      const un = v.filt('bandpass', [[0, 900], [d, 3200, 'e']], 2.2);
      v.noise('pink', { g: [[0, 0.0001], [0.02, 0.14], [d * 0.7, 0.04, 'e'], [d, 0.0001, 'e']], to: un });
      hum(v, 0, [[0, BB4 * 0.749], [d, BB4, 'e']], [[0, 0], [0.2, 0.03], [d, 0.06]], { breath: 0.45 });
      blip(v, d - 0.24, 600, 760, 0.1);
      blip(v, d - 0.16, 760, 900, 0.12);
      blip(v, d - 0.08, 880, 1060, 0.14, 0.07);
    },
  },
  /** Revive land: the sandal plant + the sand sneeze "pff". */
  hgiReviveLand: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      thump(v, 0, 160, 90, 0.5, 0.1, { drive: 1.1 });
      puff(v, 0.16, 0.2, 0.06, 3000, { kind: 'white', att: 0.01 });
      blip(v, 0.15, 980, 700, 0.06, 0.05);
      grains(v, 0.17, 0.14, 160, 0.18, { shape: (k) => 1 - k });
    },
  },
} satisfies Record<string, Recipe>;

export type HourglassImpSfxName = keyof typeof HOURGLASS_IMP_RECIPES;

/** The card's character voice (CHARACTER_SOUNDS entry), shipped with its strike / death cinematics. */
export const HOURGLASS_IMP_VOICE: CharacterSounds | null = {
  roar: 'hgiGiggle',
  arrive: 'hgiPour',
  land: 'hgiCatch',
  charge: 'hgiFlip',
  release: 'hgiJet',
  impact: 'hgiScour',
  dissolve: 'hgiDrain',
  burst: 'hgiLastGrain',
  reviveGather: 'hgiReviveGather',
  reviveLand: 'hgiReviveLand',
};
