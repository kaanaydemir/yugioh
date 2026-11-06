// Lane E sounds — puppet_string (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S2 Kukla): five taut strings "tsing" (a stiff plucked string: slightly inharmonic partials, a
// bright pick and a 3 % downward settle of the pitch — it sounds STRUNG, not struck like glass or chain), wood
// (the cross: SMALL, DRY, HIGH marionette wood — body modes above 900 Hz, short, with a string ringing on after
// the tok; the puppet's limbs: knocks and joint clicks) and string-on-wood (creak: a thin, narrow stick-slip squeak
// — not a rope: Kuyu Kovası owns the hollow wood frame and the rope creak, §5.1). The five strings sit on an E-minor pentatonic (E5 G5 A5 B5 D6): the scene
// passes `pitch` per string. The return is the same strings breaking: a high "ping" with a release glide down.
//   e_puppetCross    the puppeteer's cross appears: an air draw-in + a small dry "tik-tok", the strings ring on
//   e_puppetTsing    one string drops and goes taut ("tsing", ×5, the scene pans and pitches it)
//   e_puppetHook     a star hook bites a limb: a tiny metal tick + a star sparkle
//   e_puppetGlint    the spiral glint in the eyes: two wobbling sines winding up (hypnotic), a soft bell
//   e_puppetStep     a jerky puppet step lands: wooden foot knock + knee-joint click + dust
//   e_puppetCreak    the rope / joints creak (stick-slip friction), played on the yank of each hop
//   e_puppetTurn     it turns round: a ratchet of joint clicks over a creak
//   e_puppetSettle   the strings draw back up (a rising strum), one string stays: a thin held shimmer
//   e_puppetPing     one string snaps at the End Phase ("ping", ×5 descending): pluck + break crack + glide down
//   e_puppetStagger  the freed monster staggers: uneven knocks and a scrape
//   e_puppetHopString  the strings yank the puppet up for a hop (a short taut pluck + the whip of the line)
//   e_puppetCrossBreak the cross breaks after the last snap: a dry wood crack, splinters, a falling gold tinkle
//   e_puppetDenied   no room at home: it hits an invisible wall — a dry "tok" + a two-pulse denied buzz
//   e_puppetFree     it shakes the spell off: a wooden rattle slowing down, a breath, a falling chime

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { crack, link, puff, sweep, thump } from '../kit';

/** E minor pentatonic E5 G5 A5 B5 D6 (the five strings, left → right on the cross). */
export const PUPPET_STRING_MIDI = [76, 79, 81, 83, 86] as const;

/** Clamp a frequency so that ×pitch stays under 18 kHz (WebAudio's nominal range ends at Nyquist). */
const hz = (v: Voice, f: number) => Math.min(f, 18000 / v.pm);

/** A stiff plucked string at f: inharmonic partials (B = stiffness), pick click, a short downward settle. */
function pluck(v: Voice, f: number, t: number, g: number, dec: number, o: { bright?: number; settle?: number; to?: AudioNode } = {}): void {
  const B = 0.0009;
  const settle = o.settle ?? 0.03;
  const n = 7;
  for (let k = 1; k <= n; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk * v.pm > 14000) break;
    const gk = (g * (k === 1 ? 1 : (o.bright ?? 0.7) / k)) * (k === 2 ? 1.1 : 1);
    v.tone(k % 2 ? 'sine' : 'triangle', [[0, fk * (1 + settle)], [0.05, fk, 'e']], { t, g: perc(gk, dec / Math.sqrt(k), 0.0008), to: o.to });
  }
  // the pick: a 4 ms bright noise click
  crack(v, t, g * 0.7, { hp: hz(v, 3500), lp: hz(v, 11000), dec: 0.004, to: o.to });
}

/** Small dry marionette wood (a little lath, not a hollow frame): modes f, 1.71 f, 2.93 f, very short, a click. */
function woodSmall(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', [[0, f * 1.04], [0.008, f, 'e']], { t, g: perc(g, dec, 0.0004), to });
  v.tone('sine', hz(v, f * 1.71), { t, g: perc(g * 0.6, dec * 0.6, 0.0004), to });
  v.tone('triangle', hz(v, f * 2.93), { t, g: perc(g * 0.3, dec * 0.35, 0.0004), to });
  v.noise('white', { t, g: perc(g * 1.3, 0.004, 0.0002), to: v.filt('bandpass', hz(v, f * 3.6), 3.5, { to }) });
}

/** Hollow wood: two body modes (1 : 1.58) + a band-passed knock. */
function wood(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', [[0, f * 1.06], [0.02, f, 'e']], { t, g: perc(g, dec, 0.0008), to });
  v.tone('sine', f * 1.58, { t, g: perc(g * 0.45, dec * 0.6, 0.0008), to });
  v.tone('sine', f * 2.71, { t, g: perc(g * 0.18, dec * 0.3, 0.0008), to });
  v.noise('white', { t, g: perc(g * 1.6, 0.012, 0.0003), to: v.filt('bandpass', hz(v, f * 3.2), 2.2, { to }) });
}

/** A thin string drawn over wood (stick-slip): a squeak through two narrow high formants, pitch bending. */
function creak(v: Voice, t: number, d: number, f0: number, f1: number, g: number, to?: AudioNode): void {
  const body = v.filt('bandpass', [[0, hz(v, 2600)], [d, hz(v, 2050), 'e']], 9, { t, to });
  const body2 = v.filt('bandpass', hz(v, 4300), 12, { t, to });
  const fl = v.flutter(34, 0.8, { t, d, base: 0.35, to: body });
  fl.connect(body2);
  v.tone('sawtooth', [[0, f0], [d * 0.5, (f0 + f1) * 0.55, 'e'], [d, f1, 'e']], { t, g: [[0, 0], [d * 0.15, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']], to: fl });
}

/** r5 mix: the steps +1.6 dB in the recipe (the scene adds the rest: volume 1). */
const STEP_G = 1.2;

export const RECIPES = {
  e_puppetCross: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    duck: 0.15,
    play(v) {
      // the cross pops in from the air (a bright draw-in + a sparkle), lands on its strings with a small dry
      // double "tik-tok" of a marionette control, its five strings ring on after it (a sympathetic shimmer)
      sweep(v, 0, 0.12, [3200, 7400, 5200], 0.06, { kind: 'white', q: 3, peakAt: 0.85 });
      v.bell(midiHz(100), { t: 0.1, g: 0.05, dec: 0.25, ratio: 2.4, index: 0.6 });
      // "tik-tok": two tiny laths knock (modes > 1.9 kHz, 30-40 ms), no hollow body
      woodSmall(v, 2350, 0.12, 0.3, 0.03);
      woodSmall(v, 1920, 0.158, 0.26, 0.034);
      // the strings ring on after the tok (one taut string, E6 + its 5th up, a slow sympathetic decay)
      pluck(v, midiHz(88), 0.165, 0.2, 1.1, { bright: 0.8, settle: 0.008 });
      pluck(v, midiHz(95), 0.17, 0.09, 0.9, { bright: 0.55, settle: 0.006 });
      v.tone('sine', midiHz(100), { t: 0.19, g: [[0, 0], [0.02, 0.014], [0.7, 0.0001, 'e']], detune: 4 });
    },
  },
  e_puppetTsing: {
    cap: 6,
    gap: 0.02,
    verb: 0.4,
    play(v) {
      // the fall: a thin whistle down the string's length, then the pluck going taut (E5 at pitch 1)
      sweep(v, 0, 0.07, [7000, 5200, 3600], 0.03, { kind: 'white', q: 5, peakAt: 0.6 });
      pluck(v, midiHz(76), 0.06, 0.11, 0.55, { bright: 0.85, settle: 0.035 });
      // the sympathetic shimmer (the other strings answer an octave up, very quietly)
      v.tone('sine', midiHz(88), { t: 0.07, g: [[0, 0], [0.01, 0.01], [0.45, 0.0001, 'e']], detune: 6 });
    },
  },
  e_puppetHook: {
    cap: 6,
    gap: 0.02,
    verb: 0.3,
    play(v) {
      link(v, 3100, 0, 0.24, 0.06);
      v.noise('white', { t: 0, g: perc(0.36, 0.006, 0.0002), to: v.filt('bandpass', 5200, 3) });
      thump(v, 0, 320, 200, 0.1, 0.03);
      v.bell(midiHz(100), { t: 0.012, g: 0.06, dec: 0.18, ratio: 2, index: 0.4 });
    },
  },
  e_puppetGlint: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      // two sines wind round each other (a 7 Hz wobble in opposite phase) as they climb: the hypnotic spiral
      const a = v.tone('sine', [[0, 620], [0.42, 980, 'e']], { g: [[0, 0], [0.08, 0.08], [0.32, 0.06], [0.5, 0.0001, 'e']] });
      v.lfo(a.osc.detune, 7, 45, { d: 0.5 });
      const b = v.tone('sine', [[0, 930], [0.42, 1470, 'e']], { g: [[0, 0], [0.1, 0.03], [0.3, 0.025], [0.48, 0.0001, 'e']] });
      v.lfo(b.osc.detune, 7.5, -45, { d: 0.5 });
      v.bell(midiHz(95), { t: 0.34, g: 0.022, dec: 0.3, ratio: 2, index: 0.5 });
    },
  },
  e_puppetStep: {
    cap: 4,
    gap: 0.04,
    verb: 0.22,
    vary: 0.04,
    play(v) {
      // r4: the JOINTS lead (§5.1 "eklem tıkırtısı"): a tight triplet of tiny high clicks — ankle, knee, hip —
      // 2.4–3.2 kHz, 14 / 22 ms apart, each a pin-sized lath mode with its own pinched noise tick; under them only a
      // very small toe tap (no mid knock: that is the well's ratchet), the strings catching the weight (a quiet taut
      // twang) and a breath of dust
      [
        [0, 3200, 0.42],
        [0.016, 2600, 0.38],
        [0.04, 3000, 0.3],
      ].forEach(([t, f, g]) => {
        woodSmall(v, f, t, g * 0.7 * STEP_G, 0.01);
        v.noise('white', { t, g: perc(g * 1.4 * STEP_G, 0.004, 0.0002), to: v.filt('bandpass', hz(v, f * 1.5), 4) });
      });
      // r5: the toe knock a little fuller (+3 dB with the scene's volume: the steps carry the identity)
      woodSmall(v, 2100, 0.002, 0.11 * STEP_G, 0.018);
      pluck(v, midiHz(88), 0.02, 0.03 * STEP_G, 0.22, { bright: 0.6, settle: 0.05 });
      pluck(v, midiHz(76), 0.024, 0.018 * STEP_G, 0.2, { bright: 0.5, settle: 0.05 });
      sweep(v, 0.004, 0.05, [5200, 7400, 6000], 0.02 * STEP_G, { kind: 'white', q: 3, peakAt: 0.3 });
    },
  },
  e_puppetCreak: {
    cap: 3,
    gap: 0.06,
    verb: 0.25,
    vary: 0.06,
    play(v) {
      creak(v, 0, 0.2, 290, 360, 0.3);
      // the strings strain (a faint high harmonic under tension)
      v.tone('sine', [[0, midiHz(88)], [0.2, midiHz(88) * 1.02, 'e']], { g: [[0, 0], [0.05, 0.012], [0.22, 0.0001, 'e']] });
    },
  },
  e_puppetTurn: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      creak(v, 0, 0.3, 380, 260, 0.14);
      // the ratchet: four joint clicks, quickening
      [0, 0.05, 0.09, 0.12].forEach((t, i) => woodSmall(v, 1500 + i * 140, t, 0.13, 0.025));
      // the whirl on the strings (a quick rising whip) and the landing knock
      sweep(v, 0.04, 0.14, [1800, 5200, 3000], 0.05, { kind: 'white', q: 4, peakAt: 0.7 });
      v.bell(midiHz(91), { t: 0.12, g: 0.03, dec: 0.25, ratio: 2, index: 0.4 });
      wood(v, 380, 0.2, 0.26, 0.1);
    },
  },
  e_puppetSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    play(v) {
      // the strings draw up: a rising strum through the five notes, then one thin held string
      [76, 79, 81, 83, 86].forEach((m, i) => pluck(v, midiHz(m), i * 0.045, 0.075, 0.38, { bright: 0.6, settle: -0.02 }));
      sweep(v, 0, 0.3, [2400, 6000, 8000], 0.03, { kind: 'white', q: 4, peakAt: 0.7 });
      v.bell(midiHz(100), { t: 0.24, g: 0.04, dec: 0.3, ratio: 2, index: 0.5 });
      v.tone('sine', midiHz(88), { t: 0.25, g: [[0, 0], [0.12, 0.026], [0.6, 0.012], [0.95, 0.0001, 'e']] });
      v.tone('sine', midiHz(88) * 1.004, { t: 0.25, g: [[0, 0], [0.12, 0.016], [0.6, 0.008], [0.95, 0.0001, 'e']] });
    },
  },
  e_puppetPing: {
    cap: 6,
    gap: 0.02,
    verb: 0.45,
    play(v) {
      // r4: a STRING, not glass — one short narrow tick (1 ms, band-limited), the released tension's low "thwack",
      // then the high pluck (B5 at pitch 1) holding its note a beat before the tension lets go: a long tonal glide
      // down (−45 % over 0.5 s) with a slow vibrato as the loose string wobbles; the loose end whips away
      const f = midiHz(83);
      crack(v, 0, 0.22, { hp: hz(v, 2400), lp: hz(v, 6500), n: 1, dec: 0.0012 });
      thump(v, 0, 210, 118, 0.3, 0.045);
      for (let k = 1; k <= 4; k++) {
        const fk = hz(v, f * k * Math.sqrt(1 + 0.0009 * k * k));
        const o = v.tone(k === 1 ? 'triangle' : 'sine', [[0, fk * 1.02], [0.012, fk, 'e'], [0.07, fk, 'e'], [0.55, fk * 0.55, 'e']], {
          t: 0.002,
          g: [[0, 0], [0.003, 0.17 / k], [0.12, 0.11 / k], [0.62 / Math.sqrt(k), 0.0001, 'e']],
        });
        v.lfo(o.osc.detune, 9, 18, { d: 0.6 });
      }
      sweep(v, 0.01, 0.12, [4200, 2600, 1200], 0.03, { kind: 'pink', q: 2.5, peakAt: 0.2 });
    },
  },
  e_puppetStagger: {
    cap: 2,
    gap: 0.08,
    verb: 0.25,
    vary: 0.05,
    play(v) {
      // off-beat: a heavy foot, a dragged scrape, a light catch
      wood(v, 270, 0, 0.28, 0.1);
      thump(v, 0, 110, 62, 0.22, 0.1);
      sweep(v, 0.06, 0.16, [700, 1500, 900], 0.06, { kind: 'pink', q: 1.4, peakAt: 0.4 });
      wood(v, 360, 0.2, 0.16, 0.07);
      wood(v, 1250, 0.235, 0.06, 0.025);
    },
  },
  e_puppetFree: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // it shakes the spell off: a wooden rattle slowing down, a breath out, the last gold falls (D6 B5 G5)
      const ts = [0, 0.035, 0.068, 0.104, 0.145, 0.195, 0.255];
      ts.forEach((t, i) => woodSmall(v, 1300 - i * 60 + (i % 2) * 220, t, 0.16 * (1 - i * 0.08), 0.03));
      puff(v, 0.05, 0.12, 0.35, 900, { kind: 'brown', att: 0.06 });
      [86, 83, 79].forEach((m, i) => v.bell(midiHz(m), { t: 0.22 + i * 0.09, g: 0.05, dec: 0.45, ratio: 2, index: 0.35 }));
    },
  },
  e_puppetHopString: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      // the strings yank (r4: +6 dB, the hop's UP sound): the whip of five lines going taut at once (a short bright
      // swish) and the taut string pulled UP in pitch as the weight comes on (B4 → E5 in 60 ms, held, a quick decay)
      sweep(v, 0, 0.08, [2400, 5600, 3400], 0.08, { kind: 'white', q: 4, peakAt: 0.5 });
      pluck(v, midiHz(71), 0.03, 0.12, 0.24, { bright: 0.55, settle: 0.04 });
      pluck(v, midiHz(78), 0.036, 0.06, 0.18, { bright: 0.5, settle: 0.04 });
      v.tone('triangle', [[0, midiHz(71)], [0.06, midiHz(76), 'e'], [0.2, midiHz(76) * 1.01]], { t: 0.02, g: [[0, 0], [0.012, 0.13], [0.09, 0.09], [0.24, 0.0001, 'e']] });
      v.tone('sine', [[0, midiHz(83)], [0.06, midiHz(88), 'e']], { t: 0.02, g: [[0, 0], [0.012, 0.05], [0.18, 0.0001, 'e']] });
    },
  },
  e_puppetCrossBreak: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    duck: 0.12,
    play(v) {
      // the cross breaks: a dry splitting crack of small wood, the splinters clatter, the gold falls tinkling
      crack(v, 0, 0.36, { hp: 1100, lp: 7000, n: 3, gap: 0.007, dec: 0.006 });
      woodSmall(v, 1450, 0.002, 0.34, 0.05);
      woodSmall(v, 980, 0.012, 0.3, 0.06);
      thump(v, 0, 190, 110, 0.2, 0.06);
      [0.09, 0.13, 0.2, 0.24].forEach((t, i) => woodSmall(v, 1700 - i * 150 + (i % 2) * 300, t, 0.12 - i * 0.015, 0.025));
      [98, 95, 91, 88, 86].forEach((m, i) => v.bell(midiHz(m), { t: 0.08 + i * 0.065, g: 0.05 - i * 0.006, dec: 0.32, ratio: 2.7, index: 0.5 }));
      sweep(v, 0.06, 0.42, [7000, 5200, 2600], 0.025, { kind: 'white', q: 2.4, peakAt: 0.2 });
    },
  },
  e_puppetDenied: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    duck: 0.12,
    play(v) {
      // it hits an invisible wall: a dry tok and the body's knock, then a two-pulse low denied buzz
      woodSmall(v, 1050, 0, 0.4, 0.05);
      thump(v, 0, 150, 70, 0.32, 0.1);
      const lp = v.filt('lowpass', 1400, 1.2);
      for (const t0 of [0.06, 0.2]) {
        v.tone('square', 98, { t: t0, g: [[0, 0], [0.006, 0.07], [0.09, 0.06], [0.11, 0.0001, 'e']], to: lp });
        v.tone('sawtooth', 104, { t: t0, g: [[0, 0], [0.006, 0.05], [0.09, 0.04], [0.11, 0.0001, 'e']], to: lp });
      }
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
