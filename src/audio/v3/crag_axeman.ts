// Kaya Baltacı (crag_axeman) sounds — the mountain barbarian whose single stone-axe blow leaves a glowing seam.
// docs/v3/oturum-c-tasarim.md §2.3 SOUND (YENI_KARTLAR §5.1): a 90 Hz GRAVEL CRUNCH (a short thump + grainy noise),
// stone + fur, the crack "crackle run" panned along the seam, and the lane's only human baritone shout (the nara).
// Percussive and DRY with silences between blows: no brown-noise bed under everything (that is the sentinel's
// `rumble`), no glass, no chains, no drone, none of the v1 shared recipes.
//
//   caxGrip       declaration (charge role): both hands take the haft — a leather creak, the fur shifts, a breath in
//   caxSpin       the 360° spin: a pink air band with a panner making ONE circle, accelerating, two loudness peaks
//                 as the axe head passes the front; the boots scuff
//   caxCock       the axe swung up behind the head: a short exertion breath + the haft creaks in the grip
//   caxStep       one heavy step (×3; the cinematic raises volume and pitch: the run-up 90 → 95 → 100 Hz)
//   caxChop       release: a short downward air cut (not the v1 whoosh)
//   caxBite       contact: the edge bites the floor — a deep 40 Hz thud, a stone crack, a brown dust puff
//   caxRunR/L     the Yarık "crackle run" from the attacker to the target (screen L→R / R→L)
//   caxClimb      the seam climbs the target: a rising "tsss"
//   caxWrench     follow-through: the axe torn out (a stone grind + a clod)
//   caxShoulder   the axe back on the shoulder: a soft fur thud
//   caxSeamTick   the persisting seam's breathing (four faint ticks; `dry` last one by pitch)
//   caxRoll       summon: the boulder rolls in (gravel + an AM rumble slowing 6 → 3 Hz)
//   caxBounce     summon: one boulder bounce (×2, the second louder)
//   caxPunch      summon: the blade punches out through the boulder
//   caxSplit      summon: the light seam runs up the boulder and it splits clean
//   caxHalves     summon: the two halves land left and right
//   caxStepOut    summon 'land': he steps out of the split boulder (gravel crunch, heavier)
//   caxNara       roar: the human "HAA" shout
//   caxGuard      guard: the haft slaps across the chest (a wood knock)
//   caxGrunt      a short baritone grunt (kept; the heavy struck body carries its own)
//   caxStruckLight / Heavy / Magic   the struck body (fur / hide: no material recipe exists) — the voice's `struck` set
//   caxSeamTik    the seam's last dry tick as it fades
//   caxFork / caxRing   blocked: the seam forks on the guard ("tik"); the axe rings and bounces in the floor
//   caxAxeSlip    death f1: the axe slips from the hands (leather slide + a breath out)
//   caxAxeBite    death: the dropped axe bites the floor head-first
//   caxSeamRise   death: the seam climbs his centre line (a rising tsss)
//   caxTear       death 'dissolve': ONE long tearing crack, descending
//   caxFall       death: one half falls (×2, panned apart, 140 ms between)
//   caxAxeTok     death: the planted axe tips flat — a dry stone "tok"
//   caxBurn       death: the seam-burn eats the last of the halves (a thin hiss going out)
//   caxReviveGather / caxReviveSeal   revive: the tear run backwards, the seam sealing shut
//   caxTap        idle accent (no ambient-idle hook in the codebase yet: dev preview only)

import type { Recipe } from '../sounds';
import type { CharacterSounds } from '../../cinematics/_v3/sound';
import { perc, type Pt, type Voice } from '../synth';
import { crack, puff, sweep, thump } from './kit';

/** The gravel crunch at the heart of the card: a short ~90 Hz knock with a grainy 2.8 kHz crunch over it. */
function gravel(v: Voice, t: number, g: number, o: { f?: number; dec?: number; n?: number } = {}): void {
  const f = o.f ?? 92;
  thump(v, t, f * 1.2, f * 0.85, g, o.dec ?? 0.09, { drive: 1.6 });
  v.crackle({ t, d: 0.05, n: o.n ?? 10, g: g * 0.55, f: 2800, q: 0.7, dec: 0.004, curve: 1.6 });
  v.noise('pink', { t, g: perc(g * 0.25, 0.04, 0.001), to: v.filt('bandpass', 1400, 0.9) });
}

/** A soft fur thud: a muffled low knock with a pink brush on top (the mantle, the cloak). */
function fur(v: Voice, t: number, g: number): void {
  thump(v, t, 110, 60, g * 0.7, 0.07);
  v.noise('pink', { t, g: perc(g * 0.45, 0.08, 0.004), to: v.filt('lowpass', 900, 0.8) });
  v.noise('white', { t: t + 0.004, g: perc(g * 0.18, 0.02, 0.001), to: v.filt('bandpass', 1200, 1.4) });
}

/** The light pouring out of a seam: white noise high-passed, rising (`d` s). */
function tsss(v: Voice, t: number, d: number, g: number, hp: number, o: { pan?: readonly [number, number] } = {}): void {
  const out = o.pan ? v.panner([[0, o.pan[0]], [d, o.pan[1]]], { t }) : undefined;
  const f = v.filt('highpass', [[0, hp], [d, hp * 1.5, 'e']], 0.9, { t, to: out });
  v.noise('white', { t, g: [[0, 0], [d * 0.8, g], [d, 0.0001, 'e']], to: v.filt('lowpass', 11000, 0.7, { to: f }) });
}

/** The crackle run along the floor seam: dense clicks 3.5 → 5 kHz, panned `from` → `to`. */
function crackleRun(v: Voice, from: number, to: number, g: number): void {
  const d = 0.26;
  const pan = v.panner([[0, from], [d, to]]);
  const bp = v.filt('bandpass', [[0, 3500], [d, 5000, 'e']], 1.1, { to: pan });
  v.crackle({ d, n: 26, g, f: 4200, q: 0.6, dec: 0.005, curve: 0.9, to: bp });
  // the gravel under the light: a few low grains along the run (the floor itself splits)
  v.crackle({ d: d * 0.9, n: 9, g: g * 0.6, f: 900, q: 0.8, dec: 0.008, to: pan });
  v.noise('white', { g: [[0, 0], [0.03, g * 0.18], [d, g * 0.1], [d + 0.06, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3000], [d, 5200, 'e']], 3, { to: pan }) });
}

/**
 * The baritone voice (a human chest voice, NOT a creature growl): two slightly detuned saws on the pitch contour
 * `f` ([t, Hz] points) through a parallel formant bank (narrow bands at the vowel's F1 / F2 / F3), a breath noise
 * through the same bank, a little throat drive and a late vibrato. A thin low-passed copy keeps the chest.
 */
function vox(v: Voice, t: number, d: number, f: Pt[], g: number, o: { formants: readonly [number, number, number]; breath?: number; grit?: number; vib?: number; att?: number; chest?: number; ring?: number } = { formants: [700, 1150, 2600] }): void {
  const amp: Pt[] = [[0, 0], [o.att ?? 0.04, g], [d * 0.6, g * 0.8], [d, 0.0001, 'e']];
  const out = v.drive(o.grit ?? 1.6, { trim: 0.85 });
  const bank = v.amp(1);
  const [F1, F2, F3] = o.formants;
  bank.connect(v.filt('bandpass', F1, 6, { to: v.amp(2.4, { to: out }) }));
  bank.connect(v.filt('bandpass', F2, 8, { to: v.amp(1.8, { to: out }) }));
  bank.connect(v.filt('bandpass', F3, 10, { to: v.amp(1.1, { to: out }) }));
  // the shouter's ring (~3.2 kHz): what carries a bellow over a battlefield
  bank.connect(v.filt('bandpass', 3200, 7, { to: v.amp(o.ring ?? 0, { to: out }) }));
  const chest = v.filt('lowpass', 300, 0.7, { to: v.amp(o.chest ?? 0.15, { to: out }) });
  for (const det of [0, 9]) {
    const s = v.tone('sawtooth', f, { t, g: amp.map(([a, b, c]) => [a, b * (det ? 0.6 : 1), c] as Pt), to: bank, detune: det });
    s.osc.connect(chest);
    if (o.vib) v.lfo(s.osc.detune, 5.4, [[0, 0], [d * 0.45, 0], [d * 0.7, o.vib]], { t, d });
    v.wander(s.osc.detune, 9, 12, { t, d });
  }
  v.noise('white', { t, g: amp.map(([a, b, c]) => [a, b * (o.breath ?? 0.25), c] as Pt), to: bank });
}

const env = (pts: Pt[]): Pt[] => pts;

export const V3_AXEMAN_RECIPES = {
  /** Declaration: both hands take the haft — leather creak, the fur shifts, a short breath in through the nose. */
  caxGrip: {
    cap: 1,
    gap: 0.1,
    verb: 0.15,
    play(v) {
      // the leather of the grip twisting: a rough band of noise, fluttered
      const cr = v.flutter(31, 0.7, { d: 0.22, base: 0.3, to: v.filt('bandpass', [[0, 620], [0.2, 820, 'e']], 3) });
      v.noise('white', { g: env([[0, 0], [0.05, 0.13], [0.18, 0.08], [0.24, 0.0001, 'e']]), to: cr });
      // the fur cloak shifting on the shoulders
      v.noise('pink', { t: 0.02, g: perc(0.08, 0.16, 0.03), to: v.filt('bandpass', 2400, 0.8) });
      // a breath in (nasal, low)
      v.noise('pink', { t: 0.06, g: env([[0, 0], [0.16, 0.05], [0.24, 0.0001, 'e']]), to: v.filt('bandpass', 900, 2) });
      // the weight drops into the crouch: a soft boot scuff
      gravel(v, 0.09, 0.12, { f: 84, n: 5, dec: 0.06 });
    },
  },
  /**
   * The spin (≈ 0.47 s scene): a pink air band whose panner makes ONE circle, accelerating ([0, −.7] [.2, .7]
   * [.36, −.7] [.47, .7]); the band swells twice (the axe head passing the front); the stone head hums low; boots
   * scuff on the floor under it.
   */
  caxSpin: {
    cap: 1,
    gap: 0.2,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      const D = 0.5;
      const pan = v.panner([[0, 0], [0.12, -0.7], [0.24, 0.7], [0.37, -0.7], [D, 0.7]]);
      const bp = v.filt('bandpass', [[0, 180], [0.22, 420, 'e'], [D, 260, 'e']], 1.4, { to: pan });
      // two passes of the head in front of him: two swells, the second faster and louder
      v.noise('pink', { g: env([[0, 0], [0.12, 0.08], [0.2, 0.32], [0.27, 0.1], [0.38, 0.44], [0.44, 0.16], [D, 0.0001, 'e']]), to: bp });
      // the air cut by the crescent edge: a thin high band on the same passes
      const hi = v.filt('bandpass', [[0, 1500], [D, 2600, 'e']], 4, { to: pan });
      v.noise('white', { g: env([[0, 0], [0.19, 0.06], [0.25, 0.01], [0.37, 0.09], [0.43, 0.015], [D, 0.0001, 'e']]), to: hi });
      // the heavy stone head: a low whirr, its rate quickening
      const o = v.tone('triangle', [[0, 72], [D, 118, 'e']], { g: env([[0, 0], [0.1, 0.1], [0.4, 0.16], [D, 0.0001, 'e']]), to: pan });
      v.lfo(o.amp.gain, [[0, 5], [D, 11, 'e']], 0.06, { d: D });
      // the boots pivot on the floor
      v.crackle({ t: 0.02, d: 0.42, n: 12, g: 0.1, f: 3000, q: 0.7, dec: 0.006 });
    },
  },
  /** The axe swung up behind the head (the longest frame): a short exertion breath, the haft creaks. */
  caxCock: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      v.noise('pink', { g: env([[0, 0], [0.03, 0.3], [0.12, 0.1], [0.2, 0.0001, 'e']]), to: v.filt('bandpass', [[0, 700], [0.18, 1050, 'e']], 2.4) });
      const cr = v.flutter(46, 0.6, { t: 0.04, d: 0.12, base: 0.35, to: v.filt('bandpass', 760, 4) });
      v.noise('white', { t: 0.04, g: perc(0.09, 0.1, 0.01), to: cr });
      fur(v, 0.02, 0.08);
    },
  },
  /** One heavy step: the gravel crunch (~90 Hz; the cinematic passes pitch 1 / 1.055 / 1.11 and rising volume). */
  caxStep: {
    cap: 3,
    gap: 0.05,
    verb: 0.18,
    play(v) {
      // f 77: the dominants land at ~90 / 95 / 100 Hz with the run-up's pitches 1 / 1.055 / 1.11 (probe: f 77 → 86 Hz, f 83 → 97 Hz)
      gravel(v, 0, 0.7, { f: 80, dec: 0.09, n: 10 });
      // a pebble hops off the boot
      v.noise('white', { t: 0.05, g: perc(0.06, 0.006, 0.0002), to: v.filt('bandpass', 3600, 2) });
      fur(v, 0.006, 0.1);
    },
  },
  /** Release: the chop comes down — a short downward air cut, a low push under it. */
  caxChop: {
    cap: 1,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      sweep(v, 0, 0.075, [800, 2200, 600], 0.75, { kind: 'white', q: 1.3, peakAt: 0.35 });
      sweep(v, 0, 0.09, [260, 340, 140], 0.45, { kind: 'pink', q: 1, peakAt: 0.4 });
    },
  },
  /**
   * Contact (the lane's loudest blow): the edge bites the floor — a 40 → 28 Hz thud (driven), a two-step stone crack,
   * a brown dust puff, chips skittering back toward the attacker.
   */
  caxBite: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.7,
    play(v) {
      thump(v, 0, 40, 28, 0.62, 0.35, { drive: 2.2 });
      thump(v, 0, 120, 60, 0.24, 0.08, { drive: 1.4 });
      crack(v, 0, 0.5, { hp: 1800, lp: 9000, n: 2, gap: 0.01, dec: 0.014 });
      puff(v, 0.004, 0.3, 0.4, 700, { kind: 'brown' });
      // the stone edge buried in stone: a short gritty grind
      v.noise('brown', { t: 0.01, g: perc(0.22, 0.12, 0.004), to: v.filt('bandpass', 260, 3) });
      // chips skittering
      v.crackle({ t: 0.02, d: 0.28, n: 14, g: 0.2, f: 3200, q: 0.8, dec: 0.006, curve: 1.8 });
    },
  },
  /** The crackle run (screen left → right: a P1 attacker). */
  caxRunR: { cap: 2, gap: 0.05, verb: 0.3, play: (v) => crackleRun(v, -0.6, 0.6, 1.4) },
  /** The crackle run (screen right → left: a P2 attacker). */
  caxRunL: { cap: 2, gap: 0.05, verb: 0.3, play: (v) => crackleRun(v, 0.6, -0.6, 1.4) },
  /** The seam climbs through the target: a rising "tsss" (light pouring), with a thin high tick at the crown. */
  caxClimb: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    play(v) {
      tsss(v, 0, 0.11, 0.2, 5000);
      v.noise('white', { t: 0.1, g: perc(0.1, 0.01, 0.0003), to: v.filt('bandpass', 6400, 3) });
    },
  },
  /** Follow-through: the axe wrenched out of the floor — a stone grind (bp 220), a clod tossed, a grunt of effort. */
  caxWrench: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      v.noise('brown', { g: env([[0, 0], [0.03, 0.42], [0.25, 0.0001, 'e']]), to: v.filt('bandpass', [[0, 260], [0.22, 190, 'e']], 4) });
      v.crackle({ t: 0.01, d: 0.18, n: 9, g: 0.18, f: 1800, q: 0.8, dec: 0.006 });
      puff(v, 0.09, 0.16, 0.18, 900, { kind: 'brown' });
      vox(v, 0, 0.2, [[0, 128], [0.06, 134, 'e'], [0.2, 100, 'e']], 0.2, { formants: [520, 1000, 2400], breath: 0.4, grit: 2 });
    },
  },
  /**
   * The seam ARRIVES (the contact frame: the number, the flash): a dry stone "tak" (two cracks 6 ms apart, hp 2.2 kHz),
   * a short driven 70 → 45 Hz thump under it and a 30 ms white snap — a second hit after the bite, never a hiss.
   */
  caxArrive: {
    cap: 1,
    gap: 0.08,
    verb: 0.3,
    duck: 0.6,
    play(v) {
      crack(v, 0, 0.75, { hp: 2200, lp: 10000, n: 2, gap: 0.006, dec: 0.01 });
      thump(v, 0, 70, 45, 0.7, 0.12, { drive: 1.8 });
      v.noise('white', { g: perc(0.4, 0.03, 0.0004), to: v.filt('highpass', 3000, 0.7) });
      // the stone ringing where the seam stopped: a short 600 Hz "klak"
      v.noise('white', { t: 0.002, g: perc(0.28, 0.04, 0.0005), to: v.filt('bandpass', 640, 8) });
    },
  },
  /** A plain step on the walk home (no weight thrown: the boot scuffs the grit, the fur sways). */
  caxScuff: {
    cap: 2,
    gap: 0.05,
    verb: 0.15,
    play(v) {
      v.crackle({ d: 0.05, n: 7, g: 0.3, f: 3000, q: 0.8, dec: 0.004, curve: 1.4 });
      thump(v, 0, 140, 95, 0.18, 0.04);
      v.noise('pink', { t: 0.005, g: perc(0.08, 0.06, 0.004), to: v.filt('bandpass', 2200, 0.9) });
    },
  },
  /** The axe lands back on the shoulder: a soft fur thud with the stone's weight under it. */
  caxShoulder: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      fur(v, 0, 0.32);
      thump(v, 0.004, 150, 80, 0.15, 0.05);
    },
  },
  /** The persisting seam's tick (faint; −30 dB class): one crackle click and a breath of light. */
  caxSeamTick: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    play(v) {
      v.crackle({ d: 0.03, n: 3, g: 0.18, f: 4400, q: 0.9, dec: 0.004 });
      v.noise('white', { g: perc(0.03, 0.06, 0.01), to: v.filt('highpass', 6000, 0.8) });
    },
  },
  /** The seam's last breath: a drier, shorter "tik" (no air), as it starts to fade. */
  caxSeamTik: {
    cap: 1,
    gap: 0.05,
    verb: 0.1,
    play(v) {
      v.noise('white', { g: perc(0.22, 0.004, 0.0001), to: v.filt('bandpass', 5200, 3) });
      v.crackle({ t: 0.004, d: 0.012, n: 1, g: 0.12, f: 3600, q: 1, dec: 0.003 });
    },
  },
  /** Blocked: the seam forks on the guard's front edge — a tiny bright "tik" splitting in two (L / R, 12 ms apart). */
  caxFork: {
    cap: 1,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      v.noise('white', { g: perc(0.3, 0.006, 0.0002), to: v.filt('bandpass', 4800, 4, { to: v.panner(-0.25) }) });
      v.noise('white', { t: 0.012, g: perc(0.26, 0.006, 0.0002), to: v.filt('bandpass', 5600, 4, { to: v.panner(0.25) }) });
      v.crackle({ t: 0.01, d: 0.09, n: 5, g: 0.12, f: 5000, q: 0.9, dec: 0.003 });
    },
  },
  /**
   * Blocked: the axe rings in the stone floor and bounces — a stone "tonk" (a short inharmonic ring at 410 / 1130 Hz,
   * the haft's wood knock under it), then a smaller second knock as it hops (70 ms).
   */
  caxRing: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.5,
    play(v) {
      thump(v, 0, 140, 70, 0.45, 0.1, { drive: 1.4 });
      for (const [f, g, d] of [[410, 0.14, 0.32], [1130, 0.07, 0.2], [1790, 0.035, 0.12]] as const) v.tone('triangle', [[0, f], [d, f * 0.97, 'e']], { g: perc(g, d, 0.002) });
      v.noise('white', { g: perc(0.22, 0.03, 0.0005), to: v.filt('bandpass', 700, 3.5) });
      thump(v, 0.07, 160, 90, 0.22, 0.06);
      v.tone('triangle', [[0.07, 400], [0.2, 390, 'e']], { g: perc(0.05, 0.13, 0.002), t: 0.07 });
      v.crackle({ t: 0.01, d: 0.14, n: 6, g: 0.1, f: 3000, q: 0.8, dec: 0.004 });
    },
  },
  /**
   * The struck body (fur / hide over skin — no material recipe exists for it): a pink fur thump (lp 900), a body knock
   * 110 → 60 and a LEATHER SLAP (bp 1.2 kHz, 20 ms). Light: just that. Never the v1 impacts.
   */
  caxStruckLight: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      // (kept ≥ 9 dB LSD from C11's hide + horn: the weight is in the chest knock and the fur brush, no keratin tick)
      v.noise('pink', { g: perc(0.34, 0.08, 0.002), to: v.filt('lowpass', 900, 0.8) });
      thump(v, 0, 110, 58, 0.72, 0.09, { drive: 1.4 });
      // the leather slap: the jerkin struck flat (a sharp 1.2 kHz smack with a 2nd crack of the hide 15 ms on)
      v.noise('white', { t: 0.002, g: perc(0.55, 0.02, 0.0004), to: v.filt('bandpass', 1200, 2.2) });
      v.noise('white', { t: 0.017, g: perc(0.2, 0.012, 0.0003), to: v.filt('bandpass', 1700, 2.6) });
      // the fur of the mantle brushed flat by the blow (a soft high hiss, 60 ms)
      v.noise('pink', { t: 0.006, g: perc(0.14, 0.06, 0.006), to: v.filt('bandpass', 2600, 0.9) });
      // the beads clack on the chest
      for (const t of [0.03, 0.055]) v.noise('white', { t, g: perc(0.09, 0.006, 0.0002), to: v.filt('bandpass', 3300, 3) });
    },
  },
  /** Heavy: the same body blow, deeper and longer, the cloak flopping, and the baritone grunt (breath knocked out). */
  caxStruckHeavy: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.4,
    play(v) {
      v.noise('pink', { g: perc(0.55, 0.12, 0.002), to: v.filt('lowpass', 800, 0.8) });
      thump(v, 0, 100, 52, 0.7, 0.11, { drive: 1.5 });
      v.noise('white', { t: 0.002, g: perc(0.45, 0.024, 0.0004), to: v.filt('bandpass', 1150, 2.2) });
      fur(v, 0.03, 0.2);
      vox(v, 0.02, 0.25, [[0, 130], [0.05, 124, 'e'], [0.25, 100, 'e']], 0.32, { formants: [480, 900, 2300], breath: 0.45, grit: 2.2, att: 0.008 });
    },
  },
  /** Magic: the body locks rigid (the war paint flashes) — a tight sinew snap and a short sizzle of light on the skin over the fur thump. */
  caxStruckMagic: {
    cap: 2,
    gap: 0.05,
    verb: 0.35,
    play(v) {
      v.noise('pink', { g: perc(0.3, 0.06, 0.002), to: v.filt('lowpass', 900, 0.8) });
      thump(v, 0, 120, 70, 0.35, 0.06);
      v.noise('white', { g: [[0, 0], [0.01, 0.12], [0.14, 0.0001, 'e']], to: v.filt('highpass', [[0, 3500], [0.14, 6500, 'e']], 1.2) });
      // the sinews lock: a fast flutter of a muscle held rigid (a closed hum through the teeth)
      vox(v, 0.01, 0.16, [[0, 150], [0.16, 140]], 0.16, { formants: [300, 2200, 2900], breath: 0.6, grit: 1.4, att: 0.01 });
    },
  },
  /** Summon: the boulder rolls in from the back-left (gravel + an AM rumble slowing 6 → 3 Hz), ~0.42 s. */
  caxRoll: {
    cap: 1,
    gap: 0.2,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      const D = 0.44;
      const am = v.amp(0.5, { to: v.panner([[0, -0.45], [D, 0]]) });
      v.lfo(am.gain, [[0, 6], [D, 3, 'e']], 0.45, { d: D, w: 'sine' });
      v.noise('brown', { g: env([[0, 0], [0.06, 0.55], [0.34, 0.5], [D, 0.0001, 'e']]), to: v.filt('lowpass', 300, 0.9, { to: am }) });
      v.crackle({ d: D * 0.92, n: 30, g: 0.16, f: 3000, q: 0.8, dec: 0.006, to: am });
    },
  },
  /** Summon: one bounce of the boulder (the cinematic plays it twice, the second louder). */
  caxBounce: {
    cap: 2,
    gap: 0.06,
    verb: 0.2,
    play(v) {
      thump(v, 0, 70, 45, 0.7, 0.12, { drive: 1.6 });
      v.crackle({ d: 0.05, n: 6, g: 0.14, f: 2600, q: 0.8, dec: 0.005 });
    },
  },
  /** Summon: the blade punches out through the boulder's face — a sharp stone crack and a knock, chips. */
  caxPunch: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.4,
    play(v) {
      crack(v, 0, 0.55, { hp: 1500, lp: 9000, n: 3, gap: 0.009, dec: 0.012 });
      thump(v, 0, 120, 60, 0.6, 0.12, { drive: 1.8 });
      v.crackle({ t: 0.01, d: 0.22, n: 12, g: 0.18, f: 3400, q: 0.8, dec: 0.005, curve: 1.6 });
    },
  },
  /** Summon: the light seam runs up the boulder (crackle 4 → 6 kHz, rising) and the light pours out ("tsss"). */
  caxSplit: {
    cap: 1,
    gap: 0.1,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      const bp = v.filt('bandpass', [[0, 4000], [0.23, 6000, 'e']], 1.1);
      v.crackle({ d: 0.23, n: 20, g: 0.3, f: 5000, q: 0.6, dec: 0.004, curve: 0.8, to: bp });
      tsss(v, 0.08, 0.15, 0.18, 6000);
      // the rock giving way along the line: a dry split
      crack(v, 0.21, 0.4, { hp: 900, lp: 6000, n: 2, gap: 0.014, dec: 0.02 });
    },
  },
  /** Summon: the two halves land left and right (60 ms apart) with a brown dust breath each. */
  caxHalves: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      const L = v.panner(-0.5);
      const R = v.panner(0.5);
      thump(v, 0, 90, 55, 0.6, 0.14, { drive: 1.5, to: L });
      puff(v, 0.004, 0.22, 0.2, 600, { kind: 'brown', to: L });
      thump(v, 0.06, 85, 52, 0.55, 0.14, { drive: 1.5, to: R });
      puff(v, 0.064, 0.2, 0.2, 600, { kind: 'brown', to: R });
    },
  },
  /** Summon 'land': he steps out of the split boulder onto the floor (a heavier gravel crunch + the fur). */
  caxStepOut: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      // the boots grind into the rubble of the split boulder: the gravel crunch with its grains up front
      thump(v, 0, 100, 74, 0.7, 0.13, { drive: 1.3 });
      thump(v, 0.004, 62, 44, 0.45, 0.16);
      v.crackle({ d: 0.12, n: 22, g: 0.75, f: 3300, q: 1.3, dec: 0.006, curve: 1.4 });
      v.noise('white', { g: perc(0.3, 0.05, 0.001), to: v.filt('bandpass', 4200, 1.6) });
      v.crackle({ t: 0.03, d: 0.14, n: 10, g: 0.55, f: 5600, q: 0.9, dec: 0.004 });
    },
  },
  /** The nara: a human baritone "HAA" shout (formants 700 / 1150 / 2600), chest voice, grit, a rasp at the top. */
  caxNara: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      // "H": a burst of breath, then the open "AA" from the chest, pitch rising to the top and falling off
      v.noise('white', { g: env([[0, 0], [0.03, 0.12], [0.07, 0.0001, 'e']]), to: v.filt('bandpass', 1300, 1.2) });
      vox(v, 0.04, 0.74, [[0, 140], [0.16, 165, 'e'], [0.44, 150, 'e'], [0.64, 120, 'e'], [0.74, 100, 'e']], 0.5, { formants: [700, 1150, 2600], breath: 0.12, grit: 1.3, vib: 18, att: 0.05, ring: 1.4, chest: 0.08 });
      // the breath at the end (it closes with the mouth: the picture's f6)
      v.noise('pink', { t: 0.56, g: env([[0, 0], [0.06, 0.05], [0.22, 0.0001, 'e']]), to: v.filt('bandpass', 1100, 1.5) });
    },
  },
  /** Guard: the haft slaps across the chest — a short knock (160 → 110) and a dry wood "tok" (bp 700). */
  caxGuard: {
    cap: 2,
    gap: 0.06,
    verb: 0.2,
    play(v) {
      thump(v, 0, 160, 110, 0.55, 0.05, { drive: 1.3 });
      v.noise('white', { g: perc(0.35, 0.03, 0.0005), to: v.filt('bandpass', 700, 3.5) });
      v.tone('triangle', [[0, 520], [0.06, 470, 'e']], { g: perc(0.12, 0.06, 0.0005) });
      fur(v, 0.008, 0.14);
    },
  },
  /** Struck: a short baritone grunt (low, closed vowel) — the human under the material. */
  caxGrunt: {
    cap: 1,
    gap: 0.15,
    verb: 0.2,
    play(v) {
      // a closed "HN!": breath knocked out of the chest, the vowel cut short
      vox(v, 0, 0.24, [[0, 132], [0.05, 126, 'e'], [0.24, 96, 'e']], 0.36, { formants: [480, 900, 2300], breath: 0.45, grit: 2.2, att: 0.008 });
    },
  },
  /** Death f1: he staggers, the axe slips out of the grip — leather sliding on the haft, a breath out. */
  caxAxeSlip: {
    cap: 1,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      sweep(v, 0, 0.14, [600, 1200, 500], 0.3, { kind: 'white', q: 3 });
      v.noise('pink', { t: 0.02, g: env([[0, 0], [0.03, 0.3], [0.2, 0.0001, 'e']]), to: v.filt('bandpass', [[0, 800], [0.2, 500, 'e']], 1.8) });
    },
  },
  /** Death: the dropped axe bites the floor head-first (60 Hz knock + a stone crack). */
  caxAxeBite: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.45,
    play(v) {
      thump(v, 0, 60, 38, 0.75, 0.22, { drive: 2 });
      crack(v, 0, 0.55, { hp: 1700, lp: 9000, n: 2, gap: 0.012, dec: 0.012 });
      v.crackle({ t: 0.01, d: 0.16, n: 8, g: 0.14, f: 3000, q: 0.8, dec: 0.005 });
    },
  },
  /** Death: the seam climbs his centre line (a rising "tsss", 300 ms). */
  caxSeamRise: {
    cap: 1,
    gap: 0.1,
    verb: 0.45,
    play(v) {
      tsss(v, 0, 0.3, 0.22, 4000);
      v.crackle({ d: 0.28, n: 10, g: 0.1, f: 4800, q: 0.8, dec: 0.004, curve: 0.7 });
    },
  },
  /** Death 'dissolve': ONE long tearing crack — dense crackle descending 2.5 → 1.2 kHz over 0.45 s + six cracks 30 ms apart. */
  caxTear: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.6,
    play(v) {
      const D = 0.45;
      const bp = v.filt('bandpass', [[0, 2500], [D, 1200, 'e']], 1.2);
      v.crackle({ d: D, n: 40, g: 0.9, f: 1800, q: 0.7, dec: 0.007, curve: 1.2, drive: 1.6, to: bp });
      crack(v, 0, 0.8, { hp: 1100, lp: 7000, n: 6, gap: 0.03, dec: 0.016 });
      // the fibre of the body giving way: a low tearing noise band under the cracks
      v.noise('brown', { g: env([[0, 0], [0.04, 0.35], [D, 0.08], [D + 0.1, 0.0001, 'e']]), to: v.filt('bandpass', [[0, 420], [D, 180, 'e']], 2.5) });
    },
  },
  /** Death: one half falls (×2: the cinematic pans them apart, 140 ms between) — a body thud with a fur flop. */
  caxFall: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      thump(v, 0, 85, 50, 0.65, 0.2, { drive: 1.5 });
      fur(v, 0.012, 0.28);
    },
  },
  /** Death: the planted axe tips flat — a dry stone "tok" (wood haft + stone head). */
  caxAxeTok: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      thump(v, 0, 300, 180, 0.4, 0.05);
      crack(v, 0, 0.3, { hp: 2000, lp: 8000, n: 1, dec: 0.008 });
      v.noise('white', { t: 0.003, g: perc(0.2, 0.025, 0.0004), to: v.filt('bandpass', 760, 3.5) });
      for (const t of [0.05, 0.09]) v.noise('white', { t, g: perc(0.05, 0.005, 0.0002), to: v.filt('bandpass', 3400, 2) });
    },
  },
  /** Death: the seam-burn takes the last of the halves (a thin hiss going out, a final dry tick). */
  caxBurn: {
    cap: 1,
    gap: 0.1,
    verb: 0.5,
    play(v) {
      v.noise('white', { g: env([[0, 0.08], [0.18, 0.03], [0.3, 0.0001, 'e']]), to: v.filt('highpass', [[0, 5200], [0.3, 7600, 'e']], 0.9) });
      v.crackle({ d: 0.22, n: 7, g: 0.08, f: 4200, q: 0.8, dec: 0.004 });
    },
  },
  /** Revive: the tear run backwards — crackle rising 1.2 → 2.5 kHz with a swelling "tsss" (sustained; stopped on 'land'). */
  caxReviveGather: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      const D = 0.7;
      const bp = v.filt('bandpass', [[0, 1200], [D, 2600, 'e']], 1.2);
      v.crackle({ d: D, n: 34, g: 0.26, f: 1800, q: 0.7, dec: 0.006, curve: 0.6, to: bp });
      tsss(v, 0.15, 0.55, 0.12, 3600);
    },
  },
  /** Revive 'land': the seam seals shut — a short sucking close and the gravel step. */
  caxReviveSeal: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.09, [6000, 3000, 1400], 0.12, { kind: 'white', q: 2 });
      gravel(v, 0.07, 0.7, { f: 90, dec: 0.1 });
    },
  },
  /** Idle accent: the axe head tapped on the floor between the boots (stone on stone "tok", two pebble clicks). */
  caxTap: {
    cap: 1,
    gap: 0.3,
    verb: 0.25,
    play(v) {
      thump(v, 0, 300, 180, 0.22, 0.05);
      crack(v, 0, 0.18, { hp: 2000, n: 1, dec: 0.008 });
      for (const t of [0.03, 0.07]) v.noise('white', { t, g: perc(0.05, 0.005, 0.0002), to: v.filt('bandpass', 3600, 2) });
    },
  },
} satisfies Record<string, Recipe>;

export type AxemanSfxName = keyof typeof V3_AXEMAN_RECIPES;

/** The character voice (src/cinematics/_v3/sound.ts CHARACTER_SOUNDS): the kits' roles in this card's sounds. */
export const AXEMAN_VOICE = {
  roar: 'caxNara',
  arrive: 'caxRoll',
  land: 'caxStepOut',
  charge: 'caxGrip',
  release: 'caxChop',
  impact: 'caxBite',
  deathStart: 'caxAxeSlip',
  dissolve: 'caxTear',
  burst: 'caxBurn',
  reviveGather: 'caxReviveGather',
  reviveLand: 'caxReviveSeal',
  struck: { light: 'caxStruckLight', heavy: 'caxStruckHeavy', magic: 'caxStruckMagic', guard: 'caxGuard' },
} satisfies CharacterSounds;
