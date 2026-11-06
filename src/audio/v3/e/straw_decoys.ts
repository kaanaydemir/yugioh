// Lane E sounds — straw_decoys (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S9 Saman Korkuluk): the main colour is a LONG DRY STRAW RUSTLE, the material straw + a wooden stake,
// the separating layers the stake's "tok" (three pitches, driven into earth) and the crow "gak" (FM + formants). Kept
// apart from: S5 Harman Eleği (a short high straw toss / chaff crackle — our wind is low and wide, 150–500 Hz, and our
// rustle is long), S12 Talih Zarı (the free-ringing wooden "tak-tak" — our stakes are choked by the earth: a damped
// 540–800 Hz knock on a long 120 Hz thud), C6 Kovuk Devi (the 180 Hz hollow-log knock), C8 Balıkçıl (the slow wing
// "fuff" — the crow's beats are short and crisp), S2 / C9 (string "tsing" / wire — no strings here), R3 Tüy Hayalet
// (the only "pof": no lowpassed soft puff anywhere here — the storyboard says so).
//   e_strawGust    the card's energy bursts over the empty zones: a LOW, WIDE dusk field wind swelling in (150–500 Hz,
//                  a slow 0.8 s swell, wide stereo) with one distant stake creak — no high chaff (S5 owns that)
//   e_strawDrop    one stake drops out of the sky: a short falling "fsst" (played on each stake's fall)
//   e_strawTok1/2/3  the stake stabs INTO EARTH: a pointed "thk", a damped stake body (540 / 660 / 800 Hz: three
//                  pitches, no free woodblock ring — S12 owns the "tak-tak"), a long 120→75 Hz earth thud, soil scatter
//   e_strawWrap / e_strawWrapR  straw bundles wind round the stakes on the visible gust: the long straw rustle (the
//                  card's main colour), crossing L → R (P1) or R → L (P2) with the gust on screen
//   e_strawCoat    an old coat drops on and snaps tight: "fwup-ŞAK" (cloth flap + snap)
//   e_strawHead    the sack head and hat drop onto the stake: a burlap crunch + a dry wooden seat
//   e_strawArms    the crossbar arms spread: a wooden creak rising + two straw flicks at the hands
//   e_strawHand    one scarecrow's straw hands flick open (played per decoy, staggered, panned on it)
//   e_strawEye     one scarecrow's button eyes light: two tiny bright "tik"s (played per decoy as the crow passes)
//   e_strawPerch   the crow lands on the last scarecrow's arm: two short wingbeats, claws grip the wood, the arm creaks
//   e_strawCrow / e_strawCrow2  the crow caws: "GAAK" … "gak" (a nasal saw falling 560 → 400 Hz through two narrow
//                  crow formants, a light rasp; distance is reverb, not level) — two recipes, each on its beak mark
//   e_strawWake    the decoys come alive (hand-over to the token): a straw bristle rising, the stakes settle into the
//                  earth (creak + low settle), the startled crow beats off (three quick flaps)
//   e_strawLure    the attacker's pick: the chosen decoy's straw shivers, its stake creaks, an eye ticks
//   e_strawHook    the attack is pulled over: a straw tuft lashes out at the attacker (a dry whip of straw) and the
//                  stake creaks round as the aim swings onto the decoy

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { sweep, thump } from '../kit';

/**
 * The stake's voice: a pointed DRY WOODEN stake driven into earth, its body at `f` (Hz). The wood is the voice (a
 * clear, damped triangle knock + a 2–3 kHz dry "tk" on the attack); the earth is only a short, low support under it
 * (no free ring — S12 owns the "tak-tak").
 */
function tok(v: Voice, t: number, f: number, g: number): void {
  // the dry "tk": the point and the grain of the wood biting — a very short bright click
  v.noise('white', { t, g: perc(g * 0.75, 0.005, 0.0002), to: v.filt('bandpass', 2600, 1.6) });
  v.tone('square', [[0, f * 4.1], [0.006, f * 3.6, 'e']], { t, g: perc(g * 0.09, 0.008, 0.0002), to: v.filt('bandpass', 2400, 2) });
  // the stake's body: a damped, slightly falling wooden knock (fundamental, a weak twelfth), choked by the earth
  v.tone('triangle', [[0, f * 1.1], [0.025, f * 0.96, 'e']], { t, g: perc(g * 1.15, 0.055, 0.0005) });
  v.tone('triangle', [[0, f * 3.02], [0.02, f * 2.9, 'e']], { t, g: perc(g * 0.22, 0.022, 0.0004) });
  v.noise('white', { t, g: perc(g * 0.3, 0.03, 0.0004), to: v.filt('bandpass', f * 1.6, 3.5) });
  // the earth takes it: a short low support (6 dB under the old thud), then a little soil settles round the stake
  thump(v, t + 0.002, 110, 80, g * 0.36, 0.06);
  v.noise('brown', { t: t + 0.004, g: perc(g * 0.22, 0.035, 0.002), to: v.filt('lowpass', 380, 0.8) });
  v.crackle({ t: t + 0.03, d: 0.08, n: 6, g: g * 0.1, f: 1700, q: 1.1, dec: 0.006, curve: 1.4, kind: 'pink' });
}

/** The dusk field wind: low pink noise in a wide 150–500 Hz band, gusting (slow wander), over `d` s. */
function fieldWind(v: Voice, t: number, d: number, g: number, pan: readonly [number, number], o: { f?: number; peak?: number } = {}): void {
  const out = v.panner([[0, pan[0]], [d, pan[1]]], { t });
  const lp = v.filt('lowpass', [[0, 260], [d * (o.peak ?? 0.55), 520, 'e'], [d, 220, 'e']], 0.6, { t, to: out });
  const bp = v.filt('bandpass', o.f ?? 280, 0.55, { t, to: lp });
  v.wander(bp.frequency, 0.9, 70, { t, d });
  const pk = d * (o.peak ?? 0.55);
  v.noise('pink', { t, g: [[0, 0.0001], [pk, g, 'e'], [d * 0.8, g * 0.55], [d, 0.0001, 'e']], to: bp });
}

/** A slow wooden friction creak (a stake leaning in the earth / a crossbar turning) at `f`, `d` s. */
function creak(v: Voice, t: number, d: number, f: readonly [number, number], g: number, rate = 22): void {
  const bp = v.filt('bandpass', [[0, f[0]], [d, f[1], 'e']], 5, { t });
  const fl = v.flutter(rate, 0.9, { t, d, base: 0.06, to: bp });
  v.noise('white', { t, g: [[0, 0], [d * 0.25, g], [d * 0.8, g * 0.6], [d, 0.0001, 'e']], to: fl });
}

/** Wing beats of a crow (quick, crisp, mid band): one short feathered burst per beat. */
function wings(v: Voice, t: number, times: readonly number[], g: number): void {
  v.bursts(times.map((x) => t + x), times.map((_, i) => g * (1 - i * 0.12)), { dec: 0.035, f: 1100, q: 0.9, kind: 'pink', att: 0.012 });
  v.bursts(times.map((x) => t + x + 0.012), times.map(() => g * 0.25), { dec: 0.012, f: 2600, q: 1.4 });
}

/** A run of dry straw: band-passed white noise fluttering at `rate` (fibres rubbing), `d` seconds. */
function rustle(v: Voice, t: number, d: number, g: number, o: { f0?: number; f1?: number; rate?: number; q?: number; to?: AudioNode } = {}): void {
  const bp = v.filt('bandpass', [[0, o.f0 ?? 2200], [d, o.f1 ?? 3400, 'e']], o.q ?? 1.3, { t, to: o.to });
  const fl = v.flutter(o.rate ?? 22, 0.75, { t, d, base: 0.25, to: bp });
  v.noise('white', { t, d, g: [[0, 0], [d * 0.18, g], [d * 0.7, g * 0.75], [d, 0.0001, 'e']], to: fl });
}

/**
 * The card's main colour: a LONG, dry straw rustle — bundles wound tight round the stakes (a swell, a second wind,
 * then the last strands tucked in), fibres crackling all through it — travelling with the gust (`dir` 1 = L → R).
 */
function wrap(v: Voice, dir: 1 | -1): void {
  const d = 1.0;
  const pan = v.panner([[0, -0.6 * dir], [d, 0.6 * dir]]);
  rustle(v, 0, d, 0.2, { f0: 1700, f1: 3000, rate: 22, to: pan });
  rustle(v, 0.28, 0.55, 0.12, { f0: 3200, f1: 2400, rate: 30, q: 1.8, to: pan });
  v.crackle({ t: 0.02, d: d - 0.1, n: 30, g: 0.05, f: 2600, q: 2, dec: 0.008, curve: 0.9, to: pan });
  // the gust under it, low and travelling the same way
  fieldWind(v, 0, 0.9, 0.12, [-0.7 * dir, 0.7 * dir], { f: 300, peak: 0.3 });
  // the twine pulled tight at the end: two short, rising squeaks of fibre
  v.tone('sawtooth', [[0, 820], [0.06, 1150, 'e']], { t: 0.84, g: perc(0.025, 0.06, 0.004), to: v.filt('bandpass', 1300, 3) });
  v.tone('sawtooth', [[0, 900], [0.05, 1280, 'e']], { t: 0.93, g: perc(0.022, 0.05, 0.004), to: v.filt('bandpass', 1400, 3) });
}

/**
 * A crow's call far over the field: a nasal saw falling clearly f0 → f1 (the "aa" of "gaak"), a pinched attack
 * (the formants open from closed), a light rasp (a gentle flutter, FM ≈ 0.05·f — grit, not static), through two narrow
 * crow formants (1.1 / 1.9 kHz). Far away: little low end, a soft top — the distance is the reverb, not the level.
 */
function caw(v: Voice, t: number, d: number, f0: number, f1: number, g: number): void {
  const far = v.filt('lowpass', 4200, 0.7, { t });
  const hp = v.filt('highpass', 380, 0.7, { t, to: far });
  const f1n = v.filt('bandpass', [[0, 800], [0.03, 1100, 'e'], [d, 1000]], 8, { t, to: hp });
  const f2n = v.filt('bandpass', [[0, 1500], [0.03, 1900, 'e'], [d, 1750]], 9, { t, to: hp });
  const rasp = v.flutter(62, 0.16, { t, d, base: 0.5, to: f1n });
  rasp.connect(f2n);
  const o = v.tone('sawtooth', [[0, f0 * 1.06], [0.025, f0], [d, f1, 'e']], { t, g: [[0, 0], [0.01, g], [d * 0.55, g * 0.8], [d, 0.0001, 'e']], to: rasp });
  v.tone('sine', f0 * 0.5, { t, d: d + 0.02, g: [[0, f0 * 0.06], [d, f0 * 0.04]], to: o.osc.frequency });
  // the nasal "g" of the attack: a short pinched burst high in the beak
  v.noise('white', { t, g: perc(g * 0.35, 0.012, 0.0003), to: v.filt('bandpass', 2400, 3, { t, to: hp }) });
}

export const RECIPES = {
  e_strawGust: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.2,
    play(v) {
      // a low, wide dusk wind rises over the field (two gusting layers spread left and right) …
      fieldWind(v, 0, 1.25, 0.34, [-0.75, -0.35], { f: 240, peak: 0.6 });
      fieldWind(v, 0.08, 1.15, 0.3, [0.4, 0.75], { f: 330, peak: 0.55 });
      // … a deep body under it (the open field's breath)
      v.noise('brown', { g: [[0, 0.0001], [0.7, 0.16, 'e'], [1.25, 0.0001, 'e']], to: v.filt('lowpass', 180, 0.7) });
      // … and somewhere far off an old stake leans in it: one slow creak
      creak(v, 0.55, 0.38, [330, 410], 0.07, 17);
    },
  },
  e_strawDrop: {
    cap: 5,
    gap: 0.04,
    verb: 0.25,
    play(v) {
      // a stake falling point-first: a short, falling air streak ("fsst")
      sweep(v, 0, 0.13, [3200, 2200, 900], 0.28, { q: 2.5, peakAt: 0.6 });
    },
  },
  e_strawTok1: {
    cap: 3,
    gap: 0.03,
    verb: 0.28,
    play(v) {
      tok(v, 0, 480, 0.6);
    },
  },
  e_strawTok2: {
    cap: 3,
    gap: 0.03,
    verb: 0.28,
    play(v) {
      tok(v, 0, 640, 0.58);
    },
  },
  e_strawTok3: {
    cap: 3,
    gap: 0.03,
    verb: 0.28,
    play(v) {
      tok(v, 0, 860, 0.56);
    },
  },
  e_strawWrap: {
    cap: 1,
    gap: 0.4,
    verb: 0.36,
    play(v) {
      wrap(v, 1);
    },
  },
  e_strawWrapR: {
    cap: 1,
    gap: 0.4,
    verb: 0.36,
    play(v) {
      wrap(v, -1);
    },
  },
  e_strawCoat: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    play(v) {
      // the old coat drops on: a low cloth "fwup" (air caught in heavy fabric, 300–600 Hz) and a second flap …
      v.noise('pink', { g: [[0, 0], [0.035, 0.62, 'e'], [0.1, 0.0001, 'e']], to: v.filt('bandpass', [[0, 300], [0.08, 600, 'e']], 1.1) });
      v.bursts([0.075], [0.36], { dec: 0.04, f: 520, q: 1, kind: 'pink' });
      // … and SNAPS tight on the shoulders: "ŞAK" — a hard, crisp cloth crack with a body under it
      v.noise('white', { t: 0.12, g: perc(1.25, 0.018, 0.0002), to: v.filt('bandpass', 2300, 1.3) });
      v.noise('white', { t: 0.122, g: perc(0.5, 0.04, 0.0004), to: v.filt('bandpass', 900, 1.2) });
      v.noise('white', { t: 0.126, g: perc(0.22, 0.03, 0.0005), to: v.filt('highpass', 4200, 0.8) });
    },
  },
  e_strawHead: {
    cap: 2,
    gap: 0.08,
    verb: 0.24,
    play(v) {
      // the burlap sack lands on the stake's top: a DULL stuffed thud (low, soft, no crack) with a few coarse fibres,
      // then the hat seats on it with a dry little wooden tap
      v.noise('brown', { g: perc(0.75, 0.07, 0.003), to: v.filt('lowpass', [[0, 700], [0.06, 260, 'e']], 0.9) });
      thump(v, 0.002, 190, 120, 0.34, 0.07);
      v.crackle({ t: 0.01, d: 0.06, n: 5, g: 0.1, f: 1500, q: 1.2, dec: 0.006, curve: 1.6, kind: 'pink' });
      v.tone('triangle', [[0, 470], [0.02, 430, 'e']], { t: 0.075, g: perc(0.24, 0.028, 0.0005) });
    },
  },
  e_strawArms: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // the crossbar swings out: a wooden creak (a slowing pulse train of friction in a rising woody band)
      const d = 0.24;
      const bp = v.filt('bandpass', [[0, 620], [d, 980, 'e']], 4);
      const fl = v.flutter(46, 0.9, { d, base: 0.08, to: bp });
      v.noise('white', { g: [[0, 0], [0.03, 0.34], [d * 0.8, 0.22], [d, 0.0001, 'e']], to: fl });
      // the straw hands flick open at both ends (left, right)
      rustle(v, 0.2, 0.12, 0.1, { f0: 3000, f1: 4200, rate: 34, q: 1.6 });
      v.bursts([0.22, 0.26], [0.08, 0.07], { dec: 0.01, f: 3800, q: 1.4 });
    },
  },
  e_strawEye: {
    cap: 4,
    gap: 0.03,
    verb: 0.35,
    play(v) {
      // two button eyes catch the light: tiny bright ticks with a glassless ping (a sewn button, not a bell)
      for (const [t, f] of [[0, 1760], [0.045, 2093]] as const) {
        v.noise('white', { t, g: perc(0.18, 0.004, 0.0002), to: v.filt('highpass', 3500, 0.8) });
        v.tone('sine', f, { t, g: perc(0.1, 0.06, 0.001) });
        v.tone('sine', f * 2.01, { t, g: perc(0.025, 0.02, 0.001) });
      }
    },
  },
  e_strawCrow: {
    cap: 2,
    gap: 0.12,
    verb: 0.62,
    play(v) {
      // the first call: "GAAK" (see caw())
      caw(v, 0, 0.27, 560, 400, 0.62);
    },
  },
  e_strawCrow2: {
    cap: 2,
    gap: 0.12,
    verb: 0.62,
    play(v) {
      // the second, shorter call: "gak"
      caw(v, 0, 0.17, 530, 410, 0.5);
    },
  },
  e_strawHand: {
    cap: 5,
    gap: 0.015,
    verb: 0.28,
    play(v) {
      // one scarecrow's straw hands fan open: a quick dry flick of straw and a tiny crisp tick of a stem
      rustle(v, 0, 0.09, 0.2, { f0: 2600, f1: 3600, rate: 40, q: 1.5 });
      v.bursts([0.012, 0.04], [0.16, 0.12], { dec: 0.008, f: 3200, q: 1.5 });
    },
  },
  e_strawPerch: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // the crow brakes (two short beats), its claws grip the wooden arm, the arm gives a little under it
      wings(v, 0, [0, 0.085], 0.6);
      v.bursts([0.17, 0.19], [0.3, 0.22], { dec: 0.006, f: 1900, q: 2 });
      creak(v, 0.18, 0.16, [520, 440], 0.26, 30);
    },
  },
  e_strawWake: {
    cap: 1,
    gap: 0.3,
    verb: 0.38,
    play(v) {
      // the decoys come alive: the straw bristles all over (a rising rustle) …
      rustle(v, 0, 0.3, 0.17, { f0: 1500, f1: 2900, rate: 32, q: 1.4 });
      // … the stakes settle into the earth (a low creak and a soft settle of soil) …
      creak(v, 0.02, 0.22, [260, 340], 0.16, 20);
      thump(v, 0.05, 95, 62, 0.28, 0.16);
      // … and the crow, startled, beats off the arm (three quick flaps)
      wings(v, 0.06, [0, 0.095, 0.19], 0.24);
    },
  },
  e_strawHook: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // a straw tuft lashes out at the attacker: a dry whip of straw through the air …
      sweep(v, 0, 0.2, [1400, 3600, 1800], 0.24, { q: 1.3, peakAt: 0.55 });
      v.crackle({ t: 0.04, d: 0.16, n: 9, g: 0.08, f: 2800, q: 1.8, dec: 0.006 });
      // … hooks it (a knot of straw pulled taut) and the stake creaks round as the aim swings onto the decoy
      v.bursts([0.2], [0.24], { dec: 0.02, f: 1200, q: 1.2 });
      creak(v, 0.2, 0.26, [380, 560], 0.2, 26);
      thump(v, 0.21, 140, 90, 0.18, 0.08);
    },
  },
  e_strawLure: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // the chosen decoy beckons: its straw shivers, the stake creaks once, a button eye ticks
      rustle(v, 0, 0.32, 0.14, { f0: 2000, f1: 3200, rate: 28 });
      const bp = v.filt('bandpass', [[0, 560], [0.18, 760, 'e']], 4);
      const fl = v.flutter(40, 0.9, { t: 0.06, d: 0.18, base: 0.08, to: bp });
      v.noise('white', { t: 0.06, g: [[0, 0], [0.03, 0.22], [0.18, 0.0001, 'e']], to: fl });
      v.noise('white', { t: 0.24, g: perc(0.12, 0.004, 0.0002), to: v.filt('highpass', 3500, 0.8) });
      v.tone('sine', 2093, { t: 0.24, g: perc(0.07, 0.05, 0.001) });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
