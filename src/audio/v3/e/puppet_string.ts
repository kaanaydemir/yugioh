// Lane E sounds — puppet_string (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S2 Kukla): five taut strings "tsing" (a stiff plucked string: slightly inharmonic partials, a
// bright pick and a 3 % downward settle of the pitch — it sounds STRUNG, not struck like glass or chain), wood
// (the cross: a hollow two-mode "tok"; the puppet's limbs: knocks and joint clicks) and rope (creak: stick-slip
// friction through a wooden body). The five strings sit on an E-minor pentatonic (E5 G5 A5 B5 D6): the scene
// passes `pitch` per string. The return is the same strings breaking: a high "ping" with a release glide down.
//   e_puppetCross    the puppeteer's cross appears: an air draw-in + a hollow wooden "tok" with a low knock
//   e_puppetTsing    one string drops and goes taut ("tsing", ×5, the scene pans and pitches it)
//   e_puppetHook     a star hook bites a limb: a tiny metal tick + a star sparkle
//   e_puppetGlint    the spiral glint in the eyes: two wobbling sines winding up (hypnotic), a soft bell
//   e_puppetStep     a jerky puppet step lands: wooden foot knock + knee-joint click + dust
//   e_puppetCreak    the rope / joints creak (stick-slip friction), played on the yank of each hop
//   e_puppetTurn     it turns round: a ratchet of joint clicks over a creak
//   e_puppetSettle   the strings draw back up (a rising strum), one string stays: a thin held shimmer
//   e_puppetPing     one string snaps at the End Phase ("ping", ×5 descending): pluck + break crack + glide down
//   e_puppetStagger  the freed monster staggers: uneven knocks and a scrape
//   e_puppetFree     it shakes the spell off: a wooden rattle slowing down, a breath, a falling chime

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { crack, link, puff, sweep, thump } from '../kit';

/** E minor pentatonic E5 G5 A5 B5 D6 (the five strings, left → right on the cross). */
export const PUPPET_STRING_MIDI = [76, 79, 81, 83, 86] as const;

/** A stiff plucked string at f: inharmonic partials (B = stiffness), pick click, a short downward settle. */
function pluck(v: Voice, f: number, t: number, g: number, dec: number, o: { bright?: number; settle?: number; to?: AudioNode } = {}): void {
  const B = 0.0009;
  const settle = o.settle ?? 0.03;
  const n = 7;
  for (let k = 1; k <= n; k++) {
    const fk = f * k * Math.sqrt(1 + B * k * k);
    if (fk > 14000) break;
    const gk = (g * (k === 1 ? 1 : (o.bright ?? 0.7) / k)) * (k === 2 ? 1.1 : 1);
    v.tone(k % 2 ? 'sine' : 'triangle', [[0, fk * (1 + settle)], [0.05, fk, 'e']], { t, g: perc(gk, dec / Math.sqrt(k), 0.0008), to: o.to });
  }
  // the pick: a 4 ms bright noise click
  crack(v, t, g * 0.7, { hp: 3500, lp: 11000, dec: 0.004, to: o.to });
}

/** Hollow wood: two body modes (1 : 1.58) + a band-passed knock. */
function wood(v: Voice, f: number, t: number, g: number, dec: number, to?: AudioNode): void {
  v.tone('sine', [[0, f * 1.06], [0.02, f, 'e']], { t, g: perc(g, dec, 0.0008), to });
  v.tone('sine', f * 1.58, { t, g: perc(g * 0.45, dec * 0.6, 0.0008), to });
  v.tone('sine', f * 2.71, { t, g: perc(g * 0.18, dec * 0.3, 0.0008), to });
  v.noise('white', { t, g: perc(g * 1.6, 0.012, 0.0003), to: v.filt('bandpass', f * 3.2, 2.2, { to }) });
}

/** Rope / joint creak: a stick-slip buzz through a wooden formant, pitch bending. */
function creak(v: Voice, t: number, d: number, f0: number, f1: number, g: number, to?: AudioNode): void {
  const body = v.filt('bandpass', [[0, 950], [d, 720, 'e']], 4, { t, to });
  const body2 = v.filt('bandpass', 2100, 6, { t, to });
  const fl = v.flutter(34, 0.8, { t, d, base: 0.35, to: body });
  fl.connect(body2);
  v.tone('sawtooth', [[0, f0], [d * 0.5, (f0 + f1) * 0.55, 'e'], [d, f1, 'e']], { t, g: [[0, 0], [d * 0.15, g], [d * 0.7, g * 0.8], [d, 0.0001, 'e']], to: fl });
}

export const RECIPES = {
  e_puppetCross: {
    cap: 2,
    gap: 0.08,
    verb: 0.35,
    duck: 0.15,
    play(v) {
      // the cross draws in from the air, lands with a hollow "tok" (the bar) and a lower knock (the cross-piece)
      sweep(v, 0, 0.16, [1800, 3600, 2200], 0.05, { kind: 'pink', q: 2.2, peakAt: 0.85 });
      wood(v, 610, 0.15, 0.34, 0.16);
      wood(v, 415, 0.215, 0.24, 0.2);
      thump(v, 0.15, 150, 82, 0.2, 0.12);
      // a gold hum under it (the spell's light in the wood)
      v.tone('sine', midiHz(64), { t: 0.15, g: [[0, 0], [0.04, 0.026], [0.5, 0.0001, 'e']] });
      v.tone('sine', midiHz(76), { t: 0.17, g: [[0, 0], [0.03, 0.014], [0.4, 0.0001, 'e']] });
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
      link(v, 3100, 0, 0.13, 0.05);
      v.noise('white', { t: 0, g: perc(0.22, 0.006, 0.0002), to: v.filt('bandpass', 5200, 3) });
      v.bell(midiHz(100), { t: 0.012, g: 0.035, dec: 0.16, ratio: 2, index: 0.4 });
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
      // the foot (a hollow wooden knock, no stone), the knee joint a beat later (a dry high click), the strings
      // catching the weight (a quiet low twang), a breath of dust
      wood(v, 430, 0, 0.3, 0.08);
      wood(v, 260, 0.008, 0.16, 0.07);
      wood(v, 1850, 0.05, 0.11, 0.025);
      pluck(v, midiHz(64), 0.02, 0.035, 0.22, { bright: 0.5, settle: 0.05 });
      puff(v, 0.005, 0.035, 0.1, 2200, { kind: 'pink' });
    },
  },
  e_puppetCreak: {
    cap: 3,
    gap: 0.06,
    verb: 0.25,
    vary: 0.06,
    play(v) {
      creak(v, 0, 0.22, 165, 210, 0.24);
      // the strings strain (a faint high harmonic under tension)
      v.tone('sine', [[0, midiHz(88)], [0.2, midiHz(88) * 1.02, 'e']], { g: [[0, 0], [0.05, 0.012], [0.22, 0.0001, 'e']] });
    },
  },
  e_puppetTurn: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      creak(v, 0, 0.3, 230, 150, 0.09);
      // the ratchet: four joint clicks, quickening
      [0, 0.07, 0.125, 0.17].forEach((t, i) => wood(v, 1500 + i * 120, t, 0.09, 0.025));
      wood(v, 380, 0.22, 0.2, 0.1);
    },
  },
  e_puppetSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    play(v) {
      // the strings draw up: a rising strum through the five notes, then one thin held string
      [76, 79, 81, 83, 86].forEach((m, i) => pluck(v, midiHz(m), i * 0.045, 0.045, 0.35, { bright: 0.6, settle: -0.02 }));
      sweep(v, 0, 0.3, [2400, 6000, 8000], 0.03, { kind: 'white', q: 4, peakAt: 0.7 });
      v.tone('sine', midiHz(88), { t: 0.25, g: [[0, 0], [0.12, 0.016], [0.6, 0.008], [0.95, 0.0001, 'e']] });
      v.tone('sine', midiHz(88) * 1.004, { t: 0.25, g: [[0, 0], [0.12, 0.01], [0.6, 0.005], [0.95, 0.0001, 'e']] });
    },
  },
  e_puppetPing: {
    cap: 6,
    gap: 0.02,
    verb: 0.45,
    play(v) {
      // the snap: a hard high pluck (B5 at pitch 1) whose tension lets go (glide down), a dry break crack
      const f = midiHz(83);
      crack(v, 0, 0.16, { hp: 2800, lp: 10000, n: 2, gap: 0.006, dec: 0.006 });
      for (let k = 1; k <= 4; k++) {
        const fk = f * k * Math.sqrt(1 + 0.0009 * k * k);
        v.tone('sine', [[0, fk * 1.01], [0.02, fk, 'e'], [0.3, fk * 0.82, 'e']], { g: perc(0.1 / k, 0.32 / Math.sqrt(k), 0.0005) });
      }
      // the loose end whips away
      sweep(v, 0.01, 0.12, [6000, 3800, 1600], 0.03, { kind: 'white', q: 3, peakAt: 0.2 });
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
      ts.forEach((t, i) => wood(v, 1100 - i * 60 + (i % 2) * 180, t, 0.08 * (1 - i * 0.08), 0.03));
      puff(v, 0.05, 0.07, 0.35, 900, { kind: 'brown', att: 0.06 });
      [86, 83, 79].forEach((m, i) => v.bell(midiHz(m), { t: 0.22 + i * 0.09, g: 0.026, dec: 0.4, ratio: 2, index: 0.35 }));
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
