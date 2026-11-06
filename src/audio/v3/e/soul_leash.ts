// Lane E sounds — soul_leash (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S8 Tasma): CHAIN LINKS (small inharmonic metal pings 2.2–3.6 kHz, never a string, never glass)
// + LEATHER (a slow stick-slip groan through a LOW formant, 420–520 Hz / 1.4 kHz, 19 Hz grain — the puppet's rope
// creak sits at 950 / 2100 Hz, 34 Hz) + the SHADOW's steps (soft, boggy "pat"s: low-passed puffs, no wood, no
// stone) answered one beat later by the BODY's heavy dull steps (a sub thump under a muffled brown-noise scuff).
// Harmony: G minor (the lock's chord G3 B♭3 D4, the bond's thin D6) — the Draw Phase pulse is the only soft bell.
//   e_leashLand       the leash card lies down on its zone: a leather slap + three links + a low void hum
//   e_leashThrow      the strap whips out to the victim: an air sweep, a thin high link run, the strap's crack
//   e_leashWeave      the collar wraps round the neck: a leather groan, four stud ticks, the buckle's click
//   e_leashTear       the shadow tears off its body: a soft crackling rip falling in pitch + a low "hoo" drawn in
//   e_leashShadowStep a shadow step: no sub, a breathy white puff banded at 900–1400 Hz (6–8 dB under the body)
//   e_leashBodyStep   a body step, one beat behind: a dull sub thump + a 250–500 Hz scuff + a leather creak
//   e_leashTurn       the shadow turns round on its new side: a dark swish and a low murmur
//   e_leashMerge      the body walks into its shadow: a swelling suck that stops dead into a soft thud
//   e_leashLock       the collar LOCKS: leather first (a strap thwack), then a small brass two-tone latch
//                     "kla-k" (2.6 / 3.3 kHz), two links settling, the G-minor chord under it — no big metal
//   e_leashBond       the chain becomes the thin light bond: a light running down it (a thin D6 with a slow
//                     vibrato) over three descending links
//   e_leashPulse      the opponent's Draw Phase: the bond's heartbeat (two soft sub beats) + the soft bell
//   e_leashGift       the green light flows to the LP panel: a rising airy sweep + three leaf chimes
//   e_leashSnap       the leash is gone: the bond snaps (a link crack), the buckle springs open, the collar falls
//   e_leashHome       the freed shadow runs home: a quick dark swish over two light pats
//   e_leashBounce     no room at home: the shadow hits the full row — a dull void knock thrown back

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { midiHz, perc } from '../../synth';
import { clank, crack, link, puff, sweep, thump } from '../kit';

/** Leather under strain: a stick-slip saw through a low leather formant (see the header). */
function leather(v: Voice, t: number, d: number, f0: number, f1: number, g: number, to?: AudioNode): void {
  const body = v.filt('bandpass', [[0, 520], [d, 420, 'e']], 3, { t, to });
  const hi = v.filt('bandpass', 1400, 5, { t, to });
  const fl = v.flutter(19, 0.9, { t, d, base: 0.2, to: body });
  fl.connect(hi);
  v.tone('sawtooth', [[0, f0], [d * 0.6, (f0 + f1) / 2, 'e'], [d, f1, 'e']], { t, g: [[0, 0], [d * 0.2, g], [d * 0.75, g * 0.7], [d, 0.0001, 'e']], to: fl });
}

/** A run of `n` chain links from t over `d` s, pitch f0 → f1 (a little jitter, alternating weight). */
function chainRun(v: Voice, t: number, d: number, n: number, f0: number, f1: number, g: number): void {
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1);
    const f = (f0 + (f1 - f0) * k) * v.r(0.985, 1.015);
    link(v, f, t + k * d, g * (i % 2 ? 0.7 : 1), 0.045 + 0.02 * (i % 3));
  }
}

/** A leather strap's thwack: a short white burst through the 1.4 kHz leather formant (40 ms). */
function leatherSlap(v: Voice, t: number, g: number): void {
  v.noise('white', { t, g: perc(g, 0.04, 0.001), to: v.filt('bandpass', 1400, 3, { t }) });
  v.noise('pink', { t, g: perc(g * 0.5, 0.03, 0.001), to: v.filt('bandpass', 480, 2, { t }) });
}

/** A small brass latch tick: a short inharmonic pair, no ring. */
function latch(v: Voice, f: number, t: number, g: number): void {
  v.tone('triangle', f, { t, g: perc(g, 0.035, 0.0004) });
  v.tone('sine', f * 1.53, { t, g: perc(g * 0.5, 0.02, 0.0004) });
}

/** A soft boggy pat (the freed shadow's light foot on its way home). */
function pat(v: Voice, t: number, g: number): void {
  puff(v, t, g, 0.07, 520, { kind: 'pink', att: 0.006 });
  v.tone('sine', [[0, 95], [0.06, 70, 'e']], { t, g: perc(g * 0.55, 0.06, 0.004) });
}

export const RECIPES = {
  e_leashLand: {
    cap: 2,
    gap: 0.08,
    verb: 0.3,
    play(v) {
      // the card's leather slaps the zone, the chain coiled on it jingles, the void hums under it
      puff(v, 0, 0.32, 0.05, 1800, { kind: 'pink', att: 0.001 });
      thump(v, 0, 160, 88, 0.26, 0.09);
      chainRun(v, 0.012, 0.075, 3, 2600, 2350, 0.07);
      v.tone('sine', midiHz(43), { t: 0.01, g: [[0, 0], [0.03, 0.06], [0.4, 0.0001, 'e']] });
    },
  },
  e_leashThrow: {
    cap: 1,
    gap: 0.15,
    verb: 0.3,
    play(v) {
      // a leather strap whipping out: an air sweep, a thin high link run riding it, the strap's crack at the end
      sweep(v, 0, 0.2, [700, 1900, 1100], 0.08, { kind: 'pink', q: 1.3, peakAt: 0.6 });
      chainRun(v, 0.02, 0.15, 5, 3600, 4400, 0.035);
      leather(v, 0.02, 0.2, 150, 210, 0.1);
      leatherSlap(v, 0.19, 0.4);
      crack(v, 0.195, 0.08, { hp: 3500, lp: 9000, dec: 0.004 });
    },
  },
  e_leashWeave: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the band wraps (a long leather groan), four studs set into it, the buckle clicks shut
      leather(v, 0, 0.34, 118, 92, 0.22);
      [0, 0.075, 0.15, 0.225].forEach((t, i) => {
        link(v, 3000 + i * 140, t, 0.075, 0.035);
        crack(v, t, 0.06, { hp: 4500, lp: 9000, dec: 0.003 });
      });
      clank(v, 1700, 0.3, 0.08, 0.09, { ratio: 1.41, index: 2, click: 1.4 });
    },
  },
  e_leashTear: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    duck: 0.15,
    play(v) {
      // the rip: crackling noise (a fast stutter) through a band falling 3.2 kHz → 800 Hz, soft at the edges
      const bp = v.filt('bandpass', [[0, 3200], [0.3, 800, 'e']], 1.8);
      const fl = v.flutter(62, 1, { d: 0.32, base: 0.1, to: bp });
      v.noise('white', { g: [[0, 0], [0.04, 0.2], [0.2, 0.14], [0.32, 0.0001, 'e']], to: fl });
      // the shadow drawn out of the body: a low "hoo" swelling in, cut short
      v.tone('sine', [[0, 150], [0.26, 92, 'e']], { g: [[0, 0], [0.22, 0.12, 'e'], [0.27, 0.0001, 'e']] });
      v.tone('triangle', [[0, 300], [0.26, 184, 'e']], { g: [[0, 0], [0.22, 0.025, 'e'], [0.27, 0.0001, 'e']] });
      puff(v, 0.02, 0.06, 0.25, 600, { kind: 'brown', att: 0.08 });
    },
  },
  e_leashShadowStep: {
    cap: 4,
    gap: 0.05,
    verb: 0.4,
    vary: 0.05,
    play(v) {
      // airy and weightless: no sub at all — a breathy white puff banded at 900–1400 Hz, a soft pink "fff" over
      // it and a tiny high brush; it sits 6–8 dB under the body's THUD and an octave and more above it
      const band = v.filt('bandpass', [[0, 1400], [0.07, 950, 'e']], 1.6);
      v.noise('white', { g: [[0, 0], [0.008, 1.1], [0.09, 0.0001, 'e']], to: band });
      v.noise('pink', { t: 0.002, g: perc(0.7, 0.06, 0.006), to: v.filt('bandpass', 1150, 2.2) });
      v.noise('white', { t: 0.004, g: perc(0.05, 0.035, 0.003), to: v.filt('highpass', 3200, 0.8) });
    },
  },
  e_leashBodyStep: {
    cap: 4,
    gap: 0.05,
    verb: 0.22,
    vary: 0.04,
    play(v) {
      // heavy and dull: a sub thump, a muffled scuff, a short leather creak — no ring, no wood
      thump(v, 0, 92, 46, 0.26, 0.17, { drive: 1.6 });
      puff(v, 0.004, 0.2, 0.09, 320, { kind: 'brown', att: 0.003 });
      // the dull scuff body (250–500 Hz): it carries the step on small speakers
      v.noise('pink', { t: 0.003, g: perc(0.9, 0.08, 0.003), to: v.filt('bandpass', 380, 1.1) });
      sweep(v, 0.03, 0.1, [380, 700, 420], 0.12, { kind: 'pink', q: 1.2, peakAt: 0.3 });
      leather(v, 0.05, 0.12, 104, 96, 0.3);
    },
  },
  e_leashTurn: {
    cap: 1,
    gap: 0.15,
    verb: 0.4,
    play(v) {
      sweep(v, 0, 0.22, [380, 1100, 480], 0.16, { kind: 'pink', q: 1.5, peakAt: 0.45 });
      const m = v.tone('sine', midiHz(43) * 2, { g: [[0, 0], [0.06, 0.1], [0.3, 0.0001, 'e']] });
      v.lfo(m.osc.detune, 6, 30, { d: 0.3 });
    },
  },
  e_leashMerge: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play(v) {
      // the suck: noise opening up and a sine rising, both stopping dead — then a soft body thud
      v.noise('pink', { g: [[0, 0], [0.18, 0.2, 'e'], [0.195, 0.0001, 'e']], to: v.filt('lowpass', [[0, 300], [0.18, 2600, 'e']], 1.2) });
      v.tone('sine', [[0, 110], [0.18, 230, 'e']], { g: [[0, 0], [0.17, 0.09, 'e'], [0.19, 0.0001, 'e']] });
      thump(v, 0.19, 120, 60, 0.3, 0.12);
      puff(v, 0.19, 0.1, 0.1, 900, { kind: 'pink' });
    },
  },
  e_leashLock: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    duck: 0.3,
    play(v) {
      // leather first: the strap pulled tight with a thwack (the 1.4 kHz leather formant, 40 ms) and a body
      // under it (a short drop thump: the soul pulled up short) …
      leatherSlap(v, 0, 1.5);
      leather(v, 0, 0.07, 140, 120, 0.12);
      thump(v, 0, 140, 62, 0.7, 0.12, { drive: 1.5 });
      // … then the small brass buckle: a two-tone latch, "kla-k" (2.6 kHz tongue, 3.3 kHz frame, 14 ms apart),
      // with a short low brass clank (~760 Hz, 70 ms) giving the latch a body — still small, not big metal
      clank(v, 760, 0.035, 0.28, 0.08, { ratio: 1.5, index: 1.8, click: 1.2 });
      latch(v, 2600, 0.035, 1.0);
      latch(v, 3300, 0.049, 0.7);
      crack(v, 0.035, 0.26, { hp: 4000, lp: 11000, dec: 0.004 });
      // two small links settle under it
      link(v, 3900, 0.12, 0.03, 0.04);
      link(v, 3500, 0.17, 0.022, 0.04);
      // G minor under it: G3 B♭3 D4, slow in, long out
      [55, 58, 62].forEach((m, i) =>
        v.tone('sine', midiHz(m), { t: 0.02 + i * 0.012, g: [[0, 0], [0.04, 0.05 - i * 0.008], [0.4, 0.03], [1.1, 0.0001, 'e']], detune: (i - 1) * 4 }),
      );
    },
  },
  e_leashBond: {
    cap: 1,
    gap: 0.2,
    verb: 0.55,
    play(v) {
      const f = midiHz(86);
      const a = v.tone('sine', f, { g: [[0, 0], [0.08, 0.03], [0.3, 0.02], [0.7, 0.0001, 'e']] });
      v.lfo(a.osc.detune, 5, 18, { d: 0.7 });
      v.tone('sine', f * 2.01, { g: [[0, 0], [0.1, 0.008], [0.4, 0.0001, 'e']] });
      chainRun(v, 0, 0.2, 3, 3300, 2600, 0.035);
    },
  },
  e_leashPulse: {
    cap: 1,
    gap: 0.3,
    verb: 0.55,
    play(v) {
      // the heartbeat (two soft sub beats) …
      thump(v, 0, 70, 44, 0.3, 0.12);
      thump(v, 0.13, 66, 42, 0.22, 0.12);
      // … and the soft bell (D5, a fifth and an octave over it, slow attack: never struck metal)
      const f = midiHz(74);
      for (const [r, g, d] of [
        [1, 0.12, 1.2],
        [2, 0.04, 0.75],
        [3.01, 0.018, 0.45],
      ] as const)
        v.tone('sine', f * r, { t: 0.2, g: [[0, 0], [0.018, g], [d, 0.0001, 'e']] });
    },
  },
  e_leashGift: {
    cap: 1,
    gap: 0.3,
    verb: 0.5,
    play(v) {
      sweep(v, 0, 0.36, [600, 2400, 4200], 0.045, { kind: 'white', q: 2.2, peakAt: 0.7 });
      // three leaf chimes rising (E5 G♯5 B5)
      [76, 80, 83].forEach((m, i) => v.tone('sine', midiHz(m), { t: 0.08 + i * 0.1, g: [[0, 0], [0.01, 0.045], [0.45, 0.0001, 'e']] }));
      v.tone('sine', midiHz(88), { t: 0.36, g: [[0, 0], [0.01, 0.02], [0.5, 0.0001, 'e']] });
    },
  },
  e_leashSnap: {
    cap: 1,
    gap: 0.3,
    verb: 0.45,
    play(v) {
      // the bond breaks (a link cracks), the buckle springs open, the collar falls in pieces
      crack(v, 0, 0.2, { hp: 2500, lp: 10000, n: 2, gap: 0.007, dec: 0.006 });
      link(v, 3600, 0, 0.12, 0.08);
      clank(v, 2100, 0.05, 0.14, 0.07, { ratio: 1.41, index: 1.6, click: 1 });
      puff(v, 0.08, 0.12, 0.08, 1200, { kind: 'pink' });
      chainRun(v, 0.12, 0.22, 4, 2800, 1900, 0.05);
      v.tone('sine', [[0, midiHz(62)], [0.4, midiHz(55), 'e']], { t: 0.05, g: [[0, 0], [0.02, 0.03], [0.45, 0.0001, 'e']] });
    },
  },
  e_leashHome: {
    cap: 1,
    gap: 0.15,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.2, [500, 1500, 700], 0.15, { kind: 'pink', q: 1.4, peakAt: 0.35 });
      pat(v, 0.05, 0.24);
      pat(v, 0.16, 0.2);
    },
  },
  e_leashBounce: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    play(v) {
      thump(v, 0, 130, 58, 0.4, 0.14, { drive: 1.4 });
      puff(v, 0, 0.14, 0.12, 700, { kind: 'brown' });
      v.tone('sine', [[0, 180], [0.25, 90, 'e']], { t: 0.03, g: [[0, 0], [0.02, 0.06], [0.3, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
