// Lane E sounds — lucky_die (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S12 Talih Zarı): the main colour is the WOODEN "TAK-TAK" of a hard little die (a dry, bright knock
// whose body sits high — 700 Hz–1.1 kHz with stiff-wood partials — never the windlass' 330 Hz tick of Kuyu Kovası nor
// the 180 Hz hollow-log "tok" of Kovuk Devi), the material is a wooden die on a hard floor, and the separating layer is
// the PENTATONIC PIP NOTES: every pip that lifts off the face rings one marimba-like note (wooden bar, 1 : 3.93 : 9.2
// partials) of a major pentatonic run, so the roll is literally counted in notes. No brass coin (Kadran Soytarısı), no
// glass partials as a lead (Boşluk Gözü / crystal), no "pof" (Tüy Hayalet).
//   e_dieForm      the card condenses into the die: a gold glint (three quick pentatonic sparkles) + the die's first click
//   e_dieRattle    the die rattles in the caster's cupped light: an irregular run of small wooden clicks, swelling
//   e_dieThrow     the throw: a wrist flick (a short low swish) and a rising air whoosh as it flies
//   e_dieTak       one bounce on the floor: the card's "tak" — a hard bright knock + a short wood body + a floor thud
//                  (the scene plays it ×3, each softer and higher: the bounces shrink)
//   e_dieRoll      the roll: two edge-over-edge knocks on the floor with a dry scraping tumble, slowing down
//   e_dieStop      the die settles: a teeter (one light tick), the last clack and a tiny wooden ring-out
//   e_diePip       one pip lifts off: a marimba note (the scene picks the step of the pentatonic run with `pitch`)
//   e_dieTick      a pip's spark reaches a monster: a small bright wooden tick with a gold shimmer (+100)
//   e_dieBoost     every spark has landed: a quick rising pentatonic marimba flourish under the +N00 numbers
//   e_dieJackpot   a SIX: a bright struck chord (marimba + bells, the pentatonic chord) with a sparkling tail
//   e_dieFirework  one firework: a short whistle up, a pop, a crackle of glitter (×3 on a six)
//   e_dieDud       a ONE: a single dull "tok" on felt (muffled 240 Hz body, no ring) and a falling sigh of air
//   e_dieFade      the die dissolves into gold motes: soft high wooden ticks drifting up into air

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** The die's wooden knock at body frequency `f`: a dry snap + the stiff-wood partials (short) — the card's "tak". */
function dieKnock(v: Voice, t: number, f: number, g: number, o: { snap?: number; body?: number; dec?: number } = {}): void {
  const dec = o.dec ?? 0.04;
  // the corner hitting the floor: a hard, very short high snap
  v.noise('white', { t, g: perc(g * (o.snap ?? 1), 0.005, 0.0002), to: v.filt('bandpass', Math.min(9000, f * 4.2), 1.8) });
  // the hard-wood body: fundamental + stiff partials (2.57 ×, 4.9 ×), all short and dry
  v.tone('triangle', [[0, f * 1.04], [0.015, f, 'e']], { t, g: perc(g * 0.6 * (o.body ?? 1), dec, 0.0006) });
  v.tone('sine', f * 2.57, { t, g: perc(g * 0.3 * (o.body ?? 1), dec * 0.6, 0.0005) });
  v.tone('sine', f * 4.9, { t, g: perc(g * 0.12, dec * 0.35, 0.0004) });
}

/** A marimba-like wooden bar note (Hz): fundamental, its 3.93 × and 9.2 × overtones, a soft mallet click. */
function marimba(v: Voice, t: number, f: number, g: number, dec = 0.32, to?: AudioNode): void {
  v.tone('sine', f, { t, g: perc(g, dec, 0.002), to });
  v.tone('sine', f * 3.93, { t, g: perc(g * 0.32, dec * 0.28, 0.001), to });
  if (f * 9.2 < 14000) v.tone('sine', f * 9.2, { t, g: perc(g * 0.08, dec * 0.1, 0.0008), to });
  v.noise('white', { t, g: perc(g * 0.18, 0.004, 0.0002), to: v.filt('bandpass', Math.min(8000, f * 2.2), 2, { to }) });
}

/** A small struck bell (FM, bright) for the chord's top. */
function bellNote(v: Voice, t: number, f: number, g: number, dec: number): void {
  v.bell(f, { t, g, dec, ratio: 3.5, index: 1.3, idxDec: dec * 0.3 });
}

/** Major pentatonic steps (semitones over the root). */
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
/** Root of the pip run: C6. */
const ROOT = 84;

export const RECIPES = {
  e_dieForm: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // the card's light condenses: three quick pentatonic sparkles going up, then the die's first little click
      [0, 4, 7].forEach((s, i) => v.tone('sine', midiHz(ROOT + 12 + s), { t: i * 0.035, g: perc(0.12, 0.12, 0.001) }));
      sweep(v, 0, 0.12, [3000, 6500, 9000], 0.05, { q: 2.5 });
      dieKnock(v, 0.11, 980, 0.34, { snap: 0.6, body: 0.7, dec: 0.03 });
    },
  },
  e_dieRattle: {
    cap: 1,
    gap: 0.3,
    verb: 0.3,
    play(v) {
      // the die rattling in a cupped hand of light: an irregular run of small knocks (faces hitting), swelling
      const n = 13;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const t = k * 0.34 + v.r(-0.008, 0.008);
        dieKnock(v, t, v.r(880, 1250), 0.16 + 0.18 * Math.sin(k * Math.PI * 0.85), { snap: 0.9, body: 0.55, dec: 0.022 });
      }
      // the airy shake round it
      const bp = v.filt('bandpass', 2600, 1.4);
      const fl = v.flutter(11, 0.8, { d: 0.38, base: 0.2, to: bp });
      v.noise('pink', { g: [[0, 0], [0.08, 0.1], [0.32, 0.14], [0.4, 0.0001, 'e']], to: fl });
    },
  },
  e_dieThrow: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // the wrist flick (low, short), the die's last knock in the hand leaving it, the air rising as it flies
      sweep(v, 0, 0.12, [500, 1400, 900], 0.2, { q: 1.2, kind: 'pink' });
      dieKnock(v, 0.02, 1150, 0.22, { snap: 0.7, body: 0.5, dec: 0.025 });
      sweep(v, 0.05, 0.36, [900, 3800, 2200], 0.26, { q: 1.8, peakAt: 0.55, pan: [-0.2, 0.25] });
      // a faint spinning whirr (the tumble): amplitude flutter at the spin rate
      const bp = v.filt('bandpass', 1700, 3);
      const fl = v.flutter(24, 0.9, { t: 0.08, d: 0.3, base: 0.1, to: bp });
      v.noise('white', { t: 0.08, g: [[0, 0], [0.1, 0.07], [0.3, 0.0001, 'e']], to: fl });
    },
  },
  e_dieTak: {
    cap: 3,
    gap: 0.05,
    verb: 0.36,
    play(v) {
      // one bounce: "TA—K" — the die's CORNER strikes (a tiny, very bright tick), then 30 ms later its FACE slaps flat
      // (the main clack): a small hard cube, so the body is short and HIGH (2.1 / 1.75 kHz) and the slap rings a
      // glassy-dry cube resonance at 3.7 kHz — brighter and shorter than any lane-E knock (a straw "tok", a windlass
      // click); two tiny chatter re-hits as it leaves, a light floor tap under it
      dieKnock(v, 0, 3000, 0.24, { snap: 1.8, body: 0.6, dec: 0.016 });
      dieKnock(v, 0.03, 2150, 0.44, { snap: 1.2, body: 0.9, dec: 0.03 });
      v.noise('white', { t: 0.03, g: perc(0.4, 0.004, 0.0002), to: v.filt('bandpass', 7200, 1.6) });
      dieKnock(v, 0.058, 2600, 0.06, { snap: 0.6, body: 0.35, dec: 0.01 });
      dieKnock(v, 0.08, 2900, 0.035, { snap: 0.5, body: 0.3, dec: 0.008 });
      // (no floor thump: the die is light — the low end belongs to the logs and the straw)
      // the cube's own ring on the slap (Q 11: a pitched, glassy-dry "k")
      const ring = v.filt('bandpass', 4700, 12);
      v.noise('white', { t: 0.03, g: perc(3.4, 0.03, 0.0003), to: ring });
      v.tone('sine', 4700, { t: 0.03, g: perc(0.09, 0.05, 0.0004) });
      v.tone('sine', 4700 * 1.47, { t: 0.03, g: perc(0.025, 0.025, 0.0004) });
    },
  },
  e_dieRoll: {
    cap: 1,
    gap: 0.3,
    verb: 0.32,
    play(v) {
      // edge over edge: two knocks (the second slower and softer) with a dry scraping tumble between, slowing down
      const bp = v.filt('bandpass', [[0, 1600], [0.5, 900, 'e']], 1.3);
      const fl = v.flutter(18, 0.7, { d: 0.5, base: 0.25, to: bp });
      v.noise('pink', { g: [[0, 0], [0.03, 0.12], [0.3, 0.07], [0.5, 0.0001, 'e']], to: fl });
      dieKnock(v, 0.17, 700, 0.26, { snap: 0.9, body: 1.1, dec: 0.045 });
      thump(v, 0.17, 170, 90, 0.1, 0.06);
      dieKnock(v, 0.39, 660, 0.2, { snap: 0.7, body: 1.1, dec: 0.05 });
      thump(v, 0.39, 160, 85, 0.08, 0.06);
    },
  },
  e_dieStop: {
    cap: 1,
    gap: 0.3,
    verb: 0.42,
    play(v) {
      // the teeter (it rocks up on an edge: a light tick) and falls back flat: the last clack, a tiny ring-out
      dieKnock(v, 0, 1240, 0.1, { snap: 0.6, body: 0.6, dec: 0.025 });
      dieKnock(v, 0.11, 720, 0.34, { snap: 1, body: 1.3, dec: 0.07 });
      thump(v, 0.11, 150, 80, 0.12, 0.08);
      // the hard wood rings on for a moment (the result is IN)
      v.tone('sine', 720 * 2.57, { t: 0.11, g: perc(0.04, 0.22, 0.001) });
    },
  },
  e_diePip: {
    cap: 6,
    gap: 0.03,
    verb: 0.5,
    play(v) {
      // one pip lifts off: a marimba note (the scene sets the pentatonic step with pitch), a little air under it
      marimba(v, 0, midiHz(ROOT), 0.26, 0.42);
      sweep(v, 0, 0.1, [2500, 5200, 7000], 0.025, { q: 3 });
    },
  },
  e_dieTick: {
    cap: 5,
    gap: 0.025,
    verb: 0.3,
    play(v) {
      // a spark lands on a monster: a short bright wooden tick + a tiny gold shimmer (one +100)
      dieKnock(v, 0, 1500, 0.22, { snap: 0.5, body: 0.6, dec: 0.02 });
      v.tone('sine', midiHz(ROOT + 12), { t: 0.004, g: perc(0.07, 0.1, 0.001) });
      v.tone('sine', midiHz(ROOT + 19), { t: 0.02, g: perc(0.045, 0.08, 0.001) });
    },
  },
  e_dieBoost: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      // every spark is in: a quick rising pentatonic marimba run under the +N00 numbers, landing on the octave
      const steps = [0, 2, 4, 7, 9, 12];
      steps.forEach((s, i) => marimba(v, i * 0.04, midiHz(ROOT - 12 + s), 0.14 + i * 0.015, 0.3));
      marimba(v, 0.26, midiHz(ROOT + 12), 0.2, 0.5);
      marimba(v, 0.26, midiHz(ROOT), 0.12, 0.5);
    },
  },
  e_dieJackpot: {
    cap: 1,
    gap: 0.5,
    verb: 0.6,
    duck: 0.3,
    play(v) {
      // a SIX: the pentatonic chord struck at once — marimba body, bells on top — and a sparkle running up
      const chord = [ROOT - 24, ROOT - 12, ROOT - 8, ROOT - 5, ROOT - 3, ROOT];
      chord.forEach((m, i) => marimba(v, i * 0.006, midiHz(m), 0.13, 0.9));
      [ROOT, ROOT + 4, ROOT + 7, ROOT + 12].forEach((m, i) => bellNote(v, 0.01 + i * 0.012, midiHz(m), 0.06, 1.2));
      // the roll of the pentatonic up an octave (the crowd of pips)
      PENTA.forEach((s, i) => v.tone('sine', midiHz(ROOT + 12 + s), { t: 0.18 + i * 0.045, g: perc(0.04, 0.2, 0.001) }));
      thump(v, 0, 110, 60, 0.18, 0.2);
    },
  },
  e_dieFirework: {
    cap: 3,
    gap: 0.06,
    verb: 0.55,
    play(v) {
      // the rocket's whistle up (clear, rising), the POP (bright, little body), then the glitter crackling out wide —
      // the crackle is the point: dense, bright, spread over half a second (the scene pitches each of the three)
      v.tone('sine', [[0, 1600], [0.17, 3900, 'e']], { g: [[0, 0], [0.03, 0.07], [0.15, 0.05], [0.17, 0.0001, 'e']] });
      v.tone('sine', [[0, 3200], [0.17, 7800, 'e']], { g: [[0, 0], [0.04, 0.012], [0.17, 0.0001, 'e']] });
      v.noise('white', { t: 0.17, g: perc(0.34, 0.025, 0.0004), to: v.filt('bandpass', 2400, 0.9) });
      v.noise('white', { t: 0.17, g: perc(0.16, 0.012, 0.0003), to: v.filt('highpass', 5000, 0.7) });
      thump(v, 0.17, 150, 90, 0.05, 0.06);
      v.crackle({ t: 0.2, d: 0.6, n: 40, g: 0.16, f: 5600, q: 2.2, dec: 0.009, curve: 1.5 });
      v.crackle({ t: 0.24, d: 0.5, n: 22, g: 0.09, f: 8200, q: 3, dec: 0.006, curve: 1.8 });
      // the glitter's shimmer: a few high pentatonic sparks
      [24, 28, 31].forEach((st, i) => v.tone('sine', midiHz(ROOT + st), { t: 0.22 + i * 0.07, g: perc(0.02, 0.12, 0.001) }));
    },
  },
  e_dieDud: {
    cap: 1,
    gap: 0.3,
    verb: 0.15,
    play(v) {
      // a ONE: a single dull "tok" — the die lands on felt: a muffled 240 Hz wood body (low-passed, no ring, no snap
      // brightness), a soft felt thud of filtered noise, and a falling sigh. (Its body sits above Kovuk Devi's 180 Hz
      // hollow log.)
      v.tone('triangle', [[0, 300], [0.025, 245, 'e']], { g: perc(0.34, 0.055, 0.0012), to: v.filt('lowpass', 620, 0.7) });
      v.tone('sine', 490, { g: perc(0.06, 0.03, 0.001) });
      v.noise('pink', { g: perc(0.12, 0.03, 0.001), to: v.filt('lowpass', 520, 0.8) });
      v.noise('pink', { g: perc(0.05, 0.015, 0.001), to: v.filt('bandpass', 1100, 1.5) });
      sweep(v, 0.06, 0.4, [900, 700, 300], 0.04, { q: 1.2, kind: 'pink', peakAt: 0.2 });
    },
  },
  e_dieFade: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    play(v) {
      // the die dissolves into rising gold motes: a few soft high ticks drifting up, an airy lift
      sweep(v, 0, 0.42, [1500, 5000, 8000], 0.05, { q: 1.6, peakAt: 0.4 });
      for (let i = 0; i < 6; i++) v.tone('sine', midiHz(ROOT + 12 + PENTA[i]), { t: 0.03 + i * 0.05, g: perc(0.03 * (1 - i * 0.1), 0.09, 0.001) });
      puff(v, 0, 0.04, 0.2, 2500);
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
