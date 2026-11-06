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
//   e_quickPrime    the revealed quick card lies back down COCKED: a two-stage cocking click + a low teal hum tick
//   e_quickFire     the cocked card fires (a cock-and-release: it dips, then leans up, one spark tick): a dry click,
//                   a snap and one short teal chirp — a release, never the reveal again (no zap, no arpeggio)
//   e_augerDrill    the drilling (start / stop, D = the 480 ms drill beat × 1.35 = 0.65 s): the rotor saw climbing
//                   120 → 165 Hz exactly up to the pierce frame, a grinding band of noise with a screech partial
//   e_augerCurls    the steel shavings curling out of the grooves: bright metallic PINGS (3.5 → 9 kHz, inharmonic
//                   sine pairs) over the whole drill window, one per thrown spiral, above the grind (talaş)
//   e_augerPierce   the card is drilled through: the rotor SURGES and cuts off hard (a pitch jump, an abrupt
//                   stop), a burr rip (2 → 6 kHz noise up-sweep, 60 ms), a high inharmonic steel TING ringing
//                   0.4 s, over a short punch — a drill breaking through, not a hammer
//   e_augerRetract  the lance pulls back up: "vuuş" — an air swish that dips then rises, a low body, the rotor down
//   e_augerSlap     the broken card slaps flat on its tile: a dry card slap + a little steel rattle of curls
//   e_augerRift     (field spell drilled) cracks run along the floor: a dry crackle running away + a low rumble

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
  /** The revealed quick card lies back down COCKED: a two-stage cocking click and a low teal hum tick. */
  e_quickPrime: {
    cap: 2,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      // ka-chik: two dry clicks (a lower one, then a higher, tighter one), like a mechanism catching
      v.noise('white', { t: 0, g: perc(0.3, 0.006, 0.0002), to: v.filt('bandpass', 1900, 3) });
      thump(v, 0, 420, 200, 0.12, 0.025);
      v.noise('white', { t: 0.045, g: perc(0.36, 0.005, 0.0002), to: v.filt('bandpass', 3600, 4) });
      link(v, 2650, 0.045, 0.03, 0.05);
      // the hum tick: a low square on the turquoise pulse, one short swell
      v.tone('square', 110, { t: 0.06, g: [[0, 0], [0.03, 0.04], [0.16, 0.0001, 'e']], to: v.filt('lowpass', 700, 1.2) });
      v.tone('sine', 220, { t: 0.06, g: [[0, 0], [0.03, 0.05], [0.2, 0.0001, 'e']] });
    },
  },
  /** The cocked card fires — a RELEASE, not a re-reveal: one dry snap + one click + a 1-stroke teal tick (no arpeggio). */
  e_quickFire: {
    cap: 2,
    gap: 0.08,
    verb: 0.08,
    duck: 0.2,
    play(v) {
      // the cock: a tight low click as the card dips into its tile
      v.noise('white', { t: 0, g: perc(0.28, 0.004, 0.0002), to: v.filt('bandpass', 1500, 3) });
      thump(v, 0, 360, 160, 0.16, 0.02);
      // the release snap (card stock springing) and its click
      crack(v, 0.03, 0.34, { hp: 2600, n: 1, dec: 0.012 });
      thump(v, 0.032, 280, 120, 0.2, 0.035, { drive: 1.5 });
      // the one teal tick: a single short square chirp up (the spark off the top edge)
      v.tone('square', [[0, 2200], [0.03, 4200, 'e']], { t: 0.05, g: [[0, 0], [0.002, 0.05], [0.035, 0.0001, 'e']], to: v.filt('bandpass', 3400, 2) });
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
  /** The drilling (start / stop): rotor saw 120 → 165 Hz over the drill beat, a grinding band, a screech partial. */
  e_augerDrill: {
    cap: 1,
    gap: 0.1,
    verb: 0.2,
    play(v) {
      // D = DRILL_MS 480 × tempo 1.35: the climb and the noise swell complete on the pierce frame
      const D = 0.65;
      rotor(v, 0, D + 0.04, [[0, 120], [D, 165, 'e']], 0.11, [[0, 900], [D, 2600, 'e']]);
      // grinding: band noise that climbs with the rotor, a flutter at the rotor's own rate (no 40 Hz AM);
      // kept ~4 dB under the old level so the curl pings (3.5 kHz +) sit on top of it
      const gbp = v.filt('bandpass', [[0, 1500], [D, 3000, 'e']], 2.4);
      const fl = v.flutter(120, 0.35, { d: D + 0.04, base: 0.65, to: gbp });
      v.noise('white', { g: [[0, 0], [0.05, 0.1], [D * 0.95, 0.15], [D + 0.04, 0.0001, 'e']], to: fl });
      // the steel screech: a thin partial bending up
      v.tone('triangle', [[0, 2400], [D, 3400, 'e']], { g: [[0, 0], [0.08, 0.012], [D * 0.9, 0.024], [D + 0.04, 0.0001, 'e']], to: v.filt('bandpass', 2900, 4) });
    },
  },
  /** Shavings curl out of the grooves: bright metallic pings rising 3.5 → 9 kHz over the whole drill window. */
  e_augerCurls: {
    cap: 2,
    gap: 0.05,
    verb: 0.22,
    play(v) {
      const n = 16;
      const W = 0.62;
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const t = Math.max(0, W * Math.pow(k, 0.9) + v.r(-0.01, 0.01));
        const f = 3500 * Math.pow(9000 / 3500, k) * v.r(0.94, 1.06);
        const g = 0.09 + 0.04 * Math.sin(k * Math.PI);
        // an inharmonic sine pair (a thin steel ribbon ringing) + a needle of high noise for the tick
        v.tone('sine', f, { t, g: perc(g, 0.045, 0.0004) });
        v.tone('sine', f * 1.47, { t, g: perc(g * 0.5, 0.03, 0.0004) });
        v.noise('white', { t, g: perc(0.1, 0.003, 0.0002), to: v.filt('highpass', Math.min(9000, f), 1.2) });
      }
    },
  },
  /** The pierce: the rotor surges and cuts off, a burr rip, a high steel ting, over a short punch. */
  e_augerPierce: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    duck: 0.4,
    play(v) {
      // the rotor SURGES (165 → 240 Hz in 50 ms), jumps up a fifth and stops dead at 75 ms
      const rl = v.filt('lowpass', [[0, 2600], [0.07, 5200, 'e']], 1.6);
      const rotG: Pt[] = [[0, 0], [0.004, 0.22], [0.05, 0.28], [0.072, 0.28], [0.076, 0.0001]];
      v.tone('sawtooth', [[0, 165], [0.05, 240, 'e'], [0.051, 360], [0.075, 400, 'e']], { g: rotG, to: rl });
      v.tone('sawtooth', [[0, 330], [0.05, 480, 'e'], [0.051, 720], [0.075, 800, 'e']], { g: rotG.map(([t, g]) => [t, g * 0.4] as Pt), to: rl, detune: 8 });
      // the burr rip: band noise sweeping 2 → 6 kHz in 60 ms (the bit tearing out of the back of the card)
      v.noise('white', { t: 0.045, g: [[0, 0], [0.008, 1.0], [0.05, 0.7], [0.065, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.06, 6000, 'e']], 2.2, { t: 0.045 }) });
      // the burr's tear transient: a hard 1–3 kHz rip right on the break (the card stock giving way)
      v.noise('white', { t: 0.068, g: [[0, 0], [0.002, 1.3], [0.03, 0.4], [0.055, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2800], [0.05, 1200, 'e']], 1.4, { t: 0.068 }) });
      // the punch through (short, lower than a hammer's) + one dry crack at the break
      thump(v, 0.07, 120, 60, 0.5, 0.12, { drive: 1.8 });
      crack(v, 0.07, 0.55, { hp: 1600, n: 2, gap: 0.012 });
      // the steel TING: inharmonic partials 2.5 – 4 kHz ringing 0.4 s (the lance's own steel)
      v.bell(2870, { t: 0.075, g: 0.22, dec: 0.45, ratio: 1.53, index: 1.1, idxDec: 0.1 });
      link(v, 3540, 0.078, 0.13, 0.38);
      link(v, 2510, 0.08, 0.12, 0.42);
      v.tone('sine', [[0, 3980], [0.4, 3940]], { t: 0.075, g: perc(0.06, 0.3, 0.0005) });
      // the whistle's last breath: the descent's 8 kHz edge flicks once more as the bit clears the card
      v.tone('sine', [[0, 5200], [0.12, 8200, 'e']], { t: 0.07, g: [[0, 0], [0.01, 0.04], [0.14, 0.0001, 'e']] });
    },
  },
  /** The retract: "vuuş" — a swish that dips, then rises as the lance leaves; a body under it; the rotor spins down. */
  e_augerRetract: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v) {
      // the air: a pink band that first dips (the pull) then climbs past 4 kHz (gone up into the sky)
      v.noise('white', { g: [[0, 0], [0.06, 0.22], [0.27, 0.42], [0.37, 0.0001, 'e']], to: v.filt('bandpass', [[0, 1300], [0.1, 450, 'e'], [0.35, 4800, 'e']], 3) });
      sweep(v, 0.02, 0.3, [900, 320, 2400], 0.22, { kind: 'white', q: 2, peakAt: 0.45 });
      // the body: a low sine swell that bends down then up with the swish (the lance's mass moving)
      v.tone('sine', [[0, 140], [0.12, 85, 'e'], [0.34, 190, 'e']], { g: [[0, 0], [0.05, 0.06], [0.24, 0.045], [0.36, 0.0001, 'e']] });
      rotor(v, 0, 0.34, [[0, 150], [0.34, 70, 'e']], 0.05, [[0, 1500], [0.34, 400, 'e']]);
      v.tone('sine', [[0, 3000], [0.3, 6000, 'e']], { g: [[0, 0], [0.04, 0.02], [0.3, 0.0001, 'e']] });
    },
  },
  /** The broken card slaps flat on its tile: a dry slap + a little steel rattle of falling curls. */
  e_augerSlap: {
    cap: 2,
    gap: 0.08,
    verb: 0.2,
    play(v) {
      // the slap: a short flat body + a papery crack (card stock, not stone)
      thump(v, 0, 260, 120, 0.24, 0.04, { drive: 1.2 });
      crack(v, 0, 0.22, { hp: 1100, lp: 6000, n: 1, dec: 0.02 });
      puff(v, 0.004, 0.12, 0.09, 1800, { kind: 'pink' });
      // the rattle: shavings landing round it, small steel pings thinning out
      const ts = [0.03, 0.055, 0.085, 0.11, 0.15, 0.2, 0.26];
      ts.forEach((t, i) => {
        const f = [4400, 5600, 3900, 6300, 4800, 5200, 4100][i];
        link(v, f, t + v.r(-0.004, 0.004), 0.08 * (1 - i * 0.1), 0.06);
      });
    },
  },
  /** Field spell drilled: a dry crackle running away along the floor + a low rumble under it. */
  e_augerRift: {
    cap: 1,
    gap: 0.1,
    verb: 0.35,
    play(v) {
      v.crackle({ t: 0, d: 0.32, n: 18, g: 0.22, f: 3000, q: 1.2, dec: 0.008, curve: 0.7 });
      v.tone('sawtooth', [[0, 70], [0.35, 52, 'e']], { g: [[0, 0], [0.03, 0.09], [0.3, 0.05], [0.42, 0.0001, 'e']], to: v.filt('lowpass', 260, 1) });
      sweep(v, 0, 0.3, [2400, 1400, 600], 0.12, { kind: 'pink', q: 1.4, peakAt: 0.2 });
      v.tone('sine', [[0, 1800], [0.25, 900, 'e']], { g: [[0, 0], [0.01, 0.02], [0.25, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
