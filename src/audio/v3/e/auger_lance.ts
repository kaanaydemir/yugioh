// Lane E sounds — auger_lance (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Burgu Mızrağı's sound identity (§5.1 S7): a 1 → 8 kHz WHISTLE, a steel auger, a 120 Hz SAW-TOOTH rotor buzz
// (no 40 Hz AM: the buzz is steady, it only climbs in pitch as the bit bites). Every beat of the scene
// (src/cinematics/spells/auger_lance.ts) has its own recipe, played on the frame of its visual mark:
//   e_quickReveal   the QUICK-SPELL reveal (src/cinematics/spells/_quick_e.ts, shared with Saman Korkuluklar):
//                   a turquoise zig-zag spark (an FM zap that zig-zags up / down / up), a dry snap and a bright
//                   three-step square arpeggio "ready!" — clearly apart from the trap's snap + stab (trapOpen)
//   e_augerLock     the target is marked: two dry steel ticks and a short rising glint
//   e_augerDescend  the lance screws down out of the sky: the 1 → 8 kHz whistle over the 120 Hz rotor saw
//   e_augerBite     the tip bites the card's corner: a hard steel clank + a dry crack
//   e_augerDrill    the drilling (start / stop): the rotor saw climbing 120 → 165 Hz, a grinding band of noise
//                   with a screech partial, the card spinning under it (stopped on the pierce frame)
//   e_augerCurls    the steel shavings curling out of the grooves: dry ticks RISING in pitch (talaş)
//   e_augerPierce   the card is drilled through: a crack, a deep punch, a ringing steel partial
//   e_augerRetract  the lance pulls back up: "vuuş" — a rising air swish with the rotor spinning down

import type { Recipe } from '../../sounds';
import { midiHz, perc, type Pt } from '../../synth';
import { clank, crack, link, puff, sweep, thump } from '../kit';

/** The rotor: a 120 Hz saw (+ its octave, detuned) through a lowpass; `f` an envelope of the fundamental. */
function rotor(v: Parameters<Recipe['play']>[0], t: number, d: number, f: readonly Pt[], g: number, lp: readonly Pt[]): void {
  const env: Pt[] = [[0, 0], [Math.min(0.06, d * 0.2), g], [d * 0.8, g * 0.85], [d, 0.0001, 'e']];
  const filt = v.filt('lowpass', lp, 1.2, { t });
  v.tone('sawtooth', f, { t, g: env, to: filt });
  v.tone('sawtooth', f.map(([tt, ff, c]) => [tt, ff * 2, c] as Pt), { t, g: env.map(([tt, gg, c]) => [tt, gg * 0.35, c] as Pt), to: filt, detune: 9 });
}

export const RECIPES = {
  /** The quick-spell reveal (shared skeleton): an FM zig-zag zap, a snap, and a fast square "ready!" arpeggio. */
  e_quickReveal: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    duck: 0.3,
    play(v) {
      // the zig-zag: a square zap whose pitch jumps up / down / up in 3 strokes (the turquoise bolt shape)
      const zz: Pt[] = [
        [0, 700],
        [0.035, 2600, 'e'],
        [0.06, 1100, 'e'],
        [0.1, 3600, 'e'],
        [0.13, 1500, 'e'],
      ];
      const bp = v.filt('bandpass', [[0, 1200], [0.1, 4200, 'e']], 1.4);
      v.tone('square', zz, { g: [[0, 0], [0.004, 0.09], [0.11, 0.07], [0.15, 0.0001, 'e']], to: bp });
      v.tone('sine', zz.map(([t, f, c]) => [t, f * 2, c] as Pt), { g: [[0, 0], [0.004, 0.035], [0.14, 0.0001, 'e']] });
      crack(v, 0, 0.3, { hp: 3200, n: 2, gap: 0.03 });
      // the snap of the card springing upright
      thump(v, 0.005, 240, 90, 0.22, 0.07, { drive: 1.4 });
      // "ready!": three quick square notes up a fourth-stacked figure (E6, A6, D7) + a glass ping on the top
      [88, 93, 98].forEach((m, i) => {
        const t = 0.12 + i * 0.045;
        v.tone('square', midiHz(m), { t, g: [[0, 0], [0.003, 0.05], [0.04, 0.03], [0.09, 0.0001, 'e']], to: v.filt('lowpass', 6000, 0.8) });
      });
      v.bell(midiHz(98), { t: 0.21, g: 0.05, dec: 0.32, ratio: 3.5, index: 0.8 });
      sweep(v, 0.1, 0.22, [1800, 6200, 3600], 0.06, { kind: 'white', q: 2.5, peakAt: 0.3 });
    },
  },
  /** The target is marked: two steel ticks and a short rising glint. */
  e_augerLock: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    play(v) {
      link(v, 2900, 0, 0.16, 0.05);
      link(v, 3400, 0.06, 0.14, 0.06);
      v.tone('sine', [[0, 1800], [0.12, 3200, 'e']], { t: 0.06, g: [[0, 0], [0.01, 0.03], [0.12, 0.0001, 'e']] });
    },
  },
  /** The descent: the 1 → 8 kHz whistle (a sine + a narrow noise band) over the 120 Hz rotor saw. */
  e_augerDescend: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    duck: 0.25,
    play(v) {
      const D = 0.42;
      v.tone('sine', [[0, 1000], [D * 0.6, 3000, 'e'], [D, 8000, 'e']], { g: [[0, 0], [0.05, 0.035], [D * 0.85, 0.06], [D, 0.0001, 'e']] });
      v.tone('sine', [[0, 1006], [D * 0.6, 3010, 'e'], [D, 8040, 'e']], { g: [[0, 0], [0.05, 0.012], [D * 0.85, 0.02], [D, 0.0001, 'e']] });
      const bp = v.filt('bandpass', [[0, 1000], [D * 0.6, 3000, 'e'], [D, 8000, 'e']], 9);
      v.noise('white', { g: [[0, 0], [D * 0.9, 0.18], [D, 0.0001, 'e']], to: bp });
      rotor(v, 0, D, [[0, 112], [D, 124, 'e']], 0.07, [[0, 500], [D, 1500, 'e']]);
    },
  },
  /** The bite: a hard steel clank + a dry crack (the tip meets the card's corner). */
  e_augerBite: {
    cap: 2,
    gap: 0.05,
    verb: 0.25,
    duck: 0.3,
    play(v) {
      clank(v, 1480, 0, 0.16, 0.22, { ratio: 1.41, index: 3.5, click: 1.8 });
      crack(v, 0, 0.32, { hp: 2400, n: 2, gap: 0.009 });
      thump(v, 0, 190, 70, 0.3, 0.08, { drive: 1.6 });
    },
  },
  /** The drilling (start / stop): rotor saw 120 → 165 Hz, a grinding noise band and a thin screech partial. */
  e_augerDrill: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      const D = 0.9;
      rotor(v, 0, D, [[0, 120], [D, 165, 'e']], 0.11, [[0, 900], [D, 2400, 'e']]);
      // grinding: band noise that climbs with the rotor, a flutter at the rotor's own rate (no 40 Hz AM)
      const gbp = v.filt('bandpass', [[0, 1600], [D, 3200, 'e']], 2.2);
      const fl = v.flutter(120, 0.35, { d: D, base: 0.65, to: gbp });
      v.noise('white', { g: [[0, 0], [0.05, 0.16], [D * 0.85, 0.2], [D, 0.0001, 'e']], to: fl });
      // the steel screech: a thin partial bending up
      v.tone('triangle', [[0, 2400], [D, 3300, 'e']], { g: [[0, 0], [0.08, 0.012], [D * 0.8, 0.02], [D, 0.0001, 'e']], to: v.filt('bandpass', 2800, 4) });
    },
  },
  /** Shavings curl out of the grooves: dry ticks rising in pitch (each one a short metal-wood tick). */
  e_augerCurls: {
    cap: 2,
    gap: 0.05,
    verb: 0.2,
    play(v) {
      const n = 11;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const t = 0.4 * Math.pow(k, 0.85) + v.r(-0.008, 0.008);
        const f = 1900 * Math.pow(3.4, k);
        v.noise('white', { t: Math.max(0, t), g: perc(0.36 * (1 - k * 0.35), 0.007, 0.0002), to: v.filt('bandpass', f, 6) });
        v.tone('sine', f * 1.02, { t: Math.max(0, t), g: perc(0.035, 0.03, 0.0004) });
      }
    },
  },
  /** The pierce: a crack, a deep punch through, a ringing steel partial and a puff of card dust. */
  e_augerPierce: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      crack(v, 0, 0.7, { hp: 1800, n: 3, gap: 0.01, dec: 0.016 });
      thump(v, 0, 150, 42, 0.95, 0.24, { drive: 2.4 });
      clank(v, 990, 0.004, 0.1, 0.5, { ratio: 1.41, index: 2.2, click: 0 });
      puff(v, 0.01, 0.12, 0.2, 2600, { kind: 'pink' });
    },
  },
  /** The retract: "vuuş" — a rising swish as the lance leaves, the rotor spinning down under it. */
  e_augerRetract: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v) {
      sweep(v, 0, 0.32, [500, 1700, 3800], 0.32, { kind: 'pink', q: 1.3, peakAt: 0.35 });
      rotor(v, 0, 0.34, [[0, 150], [0.34, 70, 'e']], 0.05, [[0, 1500], [0.34, 400, 'e']]);
      v.tone('sine', [[0, 3000], [0.3, 6000, 'e']], { g: [[0, 0], [0.04, 0.015], [0.3, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
