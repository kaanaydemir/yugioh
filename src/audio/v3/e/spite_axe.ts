// Lane E sounds — spite_axe (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S10 Balta): the main colour is a LOW BEATING DRONE (two saws 41 / 42.6 Hz → a 1.6 Hz throb, its
// lowpass opening with each beat: the haft's living veins); the material is BLACK IRON + CHAIN (dark FM clanks at
// ~150 Hz, never a bright bell; chain links 1.7–3.4 kHz, never Kafes' gilded chime or Tasma's soft leash links);
// the separating layer is the BITE INTO THE FLOOR and the WRENCH out of it (an earth-metal groan: a slow, rising
// pulse train through iron resonances over brown-noise grit). No glass (crystal / Boşluk Gözü), no 50 Hz double
// heartbeat (Kül Ejderi), no "VUF" ignition (Kül Ejderi's): the axe's ignition is a dark iron "hum-snap".
//   e_axeOmen     the card's ember spark leaves for the sky: a dark iron shiver + a chain rattle + the drone's first throb
//   e_axeFall     the axe dives: a falling whistle (air through the blade, 2.4 kHz → 500 Hz) + chains streaming behind
//   e_axeBite     IMPACT: a deep floor thump + a heavy crack + the iron head's dark ring + dirt + the haft's quiver twang
//   e_axeChain    the chains drop and coil on the floor: a run of iron links settling (decelerating, panned)
//   e_axePulse    one vein beat: the low beating drone swells and falls (×3, the scene raises it a little each time)
//   e_axeWrench   the wrench: the long iron-earth groan (rising creak train, iron resonances, grit), chains whining taut
//   e_axeSnap     chains SNAP and the axe tears out: hard link bursts, a whip crack, earth torn, an iron clank
//   e_axeIgnite   the oath: eyes take the ember — a dark iron hum swelling into a dry snap, embers crackling off
//   e_axeCard     the equip's card crumbles to embers on its tile (the axe leaves the field)
//   e_axeSlip     return: the axe slips out of the grip by itself — an iron scrape down the haft + a tick
//   e_axeFly      the axe flies home spinning: whirring air (4 turns) + chains rattling behind
//   e_axeDeck     it slams onto the deck pile: "güm" (deep thump, card slap, short iron clank)
//   e_axeLash     a chain whips the owner's LP panel: a fast rising swish → a whip CRACK + link jingle

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { clank, crack, link, puff, sweep, thump } from '../kit';

/** The card's drone: two detuned saws ~41 Hz (beating) through a lowpass that throbs with them. */
function ironDrone(v: Voice, t: number, d: number, g: number, o: { lp?: number; f?: number } = {}): void {
  const f = o.f ?? 41;
  const lpTop = o.lp ?? 420;
  const lp = v.filt('lowpass', [[0, 90], [d * 0.35, lpTop, 'e'], [d, 110, 'e']], 2.2, { t });
  const env: [number, number, ('e' | 's')?][] = [[0, 0], [d * 0.3, g], [d * 0.65, g * 0.6], [d, 0.0001, 'e']];
  v.tone('sawtooth', f, { t, g: env, to: lp });
  v.tone('sawtooth', f + 1.6, { t, g: env.map(([a, b, c]) => [a, b * 0.85, c] as [number, number, ('e' | 's')?]), to: lp });
  v.tone('sawtooth', f * 2.01, { t, g: env.map(([a, b, c]) => [a, b * 0.3, c] as [number, number, ('e' | 's')?]), to: lp });
  v.tone('sine', f, { t, g: env.map(([a, b, c]) => [a, b * 0.9, c] as [number, number, ('e' | 's')?]) });
}

/** A dark iron strike (black iron, not a bell): low FM clank + a dull body. */
function iron(v: Voice, t: number, f: number, g: number, dec: number): void {
  clank(v, f, t, g, dec, { ratio: 1.37, index: 4.2, click: 1.2 });
  v.tone('triangle', [[0, f * 0.5], [0.08, f * 0.47, 'e']], { t, g: perc(g * 0.5, dec * 0.6, 0.001) });
}

/** A chain link run: n links from t over d (decelerating with `curve` > 1), pitches in [f0, f1], panned. */
function links(v: Voice, t: number, d: number, n: number, g: number, f0: number, f1: number, o: { curve?: number; pan?: number } = {}): void {
  const pans = [v.panner(-(o.pan ?? 0.4)), v.panner(0), v.panner(o.pan ?? 0.4)];
  for (let i = 0; i < n; i++) {
    const k = Math.pow(i / Math.max(1, n - 1), o.curve ?? 1);
    const tt = t + k * d + v.r(-0.004, 0.004);
    link(v, v.r(f0, f1), tt, g * (1 - k * 0.5) * v.r(0.7, 1), v.r(0.03, 0.07), pans[i % 3]);
  }
}

export const RECIPES = {
  e_axeOmen: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // a dark iron shiver (the card wakes), the chain rattles, the first slow throb under it
      ironDrone(v, 0, 0.7, 0.12, { lp: 300 });
      v.tone('sine', [[0, 150], [0.4, 132, 'e']], { g: [[0, 0], [0.03, 0.05], [0.4, 0.0001, 'e']] });
      links(v, 0.04, 0.22, 7, 0.05, 1700, 2600, { curve: 1.3 });
      // the spark leaving upward: a thin rising hiss
      sweep(v, 0.02, 0.26, [1500, 4200, 6000], 0.035, { q: 4 });
    },
  },
  e_axeFall: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // air through the blade: a whistle that falls as it dives (accelerating), its noise band with it
      v.tone('sine', [[0, 2400], [0.3, 500, 'e']], { g: [[0, 0], [0.12, 0.05], [0.28, 0.09], [0.31, 0.0001, 'e']] });
      v.tone('sine', [[0, 3610], [0.3, 760, 'e']], { g: [[0, 0], [0.15, 0.015], [0.28, 0.03], [0.31, 0.0001, 'e']] });
      sweep(v, 0, 0.31, [3000, 1600, 700], 0.22, { q: 2.2, peakAt: 0.85 });
      // the chains stream behind it, rattling
      links(v, 0.02, 0.26, 10, 0.08, 1900, 3400, { curve: 0.8, pan: 0.5 });
    },
  },
  e_axeBite: {
    cap: 2,
    gap: 0.1,
    verb: 0.42,
    duck: 0.5,
    play(v) {
      // the floor takes it: a deep thump, a heavy crack, the head's dark ring
      thump(v, 0, 96, 34, 0.95, 0.42, { drive: 2.2 });
      crack(v, 0, 0.55, { hp: 900, lp: 7000, n: 3, gap: 0.009, dec: 0.02 });
      iron(v, 0.004, 152, 0.4, 0.9);
      // dirt and stone chips
      puff(v, 0.01, 0.32, 0.3, 900, { kind: 'brown' });
      v.crackle({ t: 0.03, d: 0.35, n: 16, g: 0.12, f: 2600, q: 1.2, dec: 0.008, curve: 1.8 });
      // the haft quivers: a low twang with a fast decaying vibrato
      const tw = v.tone('triangle', 118, { t: 0.02, g: perc(0.16, 0.5, 0.003) });
      v.lfo(tw.osc.detune, 21, [[0, 60], [0.5, 4, 'e']], { t: 0.02, d: 0.55 });
    },
  },
  e_axeChain: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the chains fall slack and coil on the floor: links settling, slowing down, two little heaps
      links(v, 0, 0.42, 16, 0.16, 1700, 3200, { curve: 1.6, pan: 0.6 });
      puff(v, 0.05, 0.12, 0.12, 700, { kind: 'brown' });
      puff(v, 0.26, 0.1, 0.1, 650, { kind: 'brown' });
    },
  },
  e_axePulse: {
    cap: 3,
    gap: 0.12,
    verb: 0.3,
    play(v) {
      // one vein beat: the beating drone swells and falls; a soft dull knock opens it
      ironDrone(v, 0, 0.5, 0.2, { lp: 520 });
      thump(v, 0, 62, 44, 0.32, 0.16);
      v.tone('sine', [[0, 88], [0.25, 82, 'e']], { g: [[0, 0], [0.06, 0.06], [0.3, 0.0001, 'e']] });
    },
  },
  e_axeWrench: {
    cap: 1,
    gap: 0.3,
    verb: 0.36,
    play(v) {
      const D = 0.5;
      // the earth-metal groan: a pulse train speeding up (creak) through two iron resonances
      const res = v.amp(1);
      res.connect(v.filt('bandpass', [[0, 340], [D, 520, 'e']], 6));
      res.connect(v.filt('bandpass', [[0, 910], [D, 1280, 'e']], 8));
      const times: number[] = [];
      const gains: number[] = [];
      let tt = 0;
      let gap = 0.042;
      while (tt < D) {
        times.push(tt);
        gains.push(0.12 + (tt / D) * 0.18);
        tt += gap;
        gap = Math.max(0.011, gap * 0.9);
      }
      v.bursts(times, gains, { dec: 0.012, f: 700, q: 1.4, to: res, kind: 'pink' });
      // the iron itself groaning: a saw bending upward, gritty
      v.tone('sawtooth', [[0, 72], [D, 104, 'e']], { g: [[0, 0], [0.1, 0.07], [D, 0.11], [D + 0.04, 0.0001, 'e']], to: v.filt('lowpass', 700, 2) });
      // earth grit under it
      v.noise('brown', { g: [[0, 0], [D * 0.8, 0.22], [D + 0.05, 0.0001, 'e']], to: v.filt('lowpass', 520, 0.9) });
      // the chains pulled taut: a thin whine climbing
      v.tone('sine', [[0, 2900], [D, 3500, 'e']], { g: [[0, 0], [D * 0.7, 0.012], [D, 0.022], [D + 0.02, 0.0001, 'e']] });
      ironDrone(v, 0, D + 0.1, 0.12, { lp: 600 });
    },
  },
  e_axeSnap: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      // chains snap: hard link bursts, a whip crack, the head's clank, torn earth
      crack(v, 0, 0.7, { hp: 1800, lp: 11000, n: 2, gap: 0.014, dec: 0.014 });
      links(v, 0, 0.09, 6, 0.16, 2200, 3800, { pan: 0.7 });
      links(v, 0.05, 0.3, 8, 0.07, 1600, 2600, { curve: 1.5, pan: 0.8 });
      iron(v, 0.01, 176, 0.32, 0.6);
      thump(v, 0, 80, 48, 0.5, 0.2, { drive: 1.6 });
      puff(v, 0.005, 0.28, 0.24, 1400, { kind: 'brown' });
      v.crackle({ t: 0.02, d: 0.3, n: 12, g: 0.09, f: 2200, q: 1.1, dec: 0.008, curve: 1.6 });
      sweep(v, 0, 0.22, [600, 2200, 1200], 0.14, { q: 1.4, peakAt: 0.25 });
    },
  },
  e_axeIgnite: {
    cap: 1,
    gap: 0.3,
    verb: 0.38,
    play(v) {
      // the oath: a dark iron hum swelling (the drone a fifth up its tritone) into a dry snap; embers
      ironDrone(v, 0, 0.75, 0.24, { lp: 900, f: 41 });
      v.tone('sawtooth', [[0, 58], [0.18, 61, 'e']], { g: [[0, 0], [0.16, 0.08], [0.5, 0.0001, 'e']], to: v.filt('lowpass', 800, 3) });
      crack(v, 0.16, 0.32, { hp: 2200, lp: 9000, n: 2, gap: 0.01, dec: 0.01 });
      thump(v, 0.16, 120, 60, 0.4, 0.18);
      iron(v, 0.16, 210, 0.18, 0.5);
      v.crackle({ t: 0.2, d: 0.55, n: 14, g: 0.06, f: 3200, q: 1, dec: 0.006, curve: 1.2 });
    },
  },
  e_axeCard: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      // the card crumbles into embers on its tile: a low crack, a crackling burn-through, a soft fall
      crack(v, 0, 0.22, { hp: 1200, lp: 6000, n: 2, gap: 0.012, dec: 0.012 });
      v.crackle({ t: 0.02, d: 0.35, n: 18, g: 0.08, f: 2800, q: 1, dec: 0.007, curve: 1.3 });
      puff(v, 0.05, 0.08, 0.2, 1100, { kind: 'pink' });
      ironDrone(v, 0, 0.4, 0.08, { lp: 300 });
    },
  },
  e_axeSlip: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the axe slides out of the grip by itself: an iron scrape falling down the haft, a tick, a chain jingle
      sweep(v, 0, 0.22, [5200, 3600, 1800], 0.1, { q: 5, peakAt: 0.3 });
      v.tone('sine', [[0, 1240], [0.2, 820, 'e']], { g: [[0, 0], [0.02, 0.025], [0.22, 0.0001, 'e']] });
      iron(v, 0.2, 196, 0.14, 0.3);
      links(v, 0.02, 0.18, 5, 0.04, 1900, 2800);
      ironDrone(v, 0, 0.4, 0.08, { lp: 360 });
    },
  },
  e_axeFly: {
    cap: 1,
    gap: 0.2,
    verb: 0.28,
    play(v) {
      // spinning home: four whirring air pulses (the blade cutting round), chains rattling behind
      for (let i = 0; i < 4; i++) {
        sweep(v, i * 0.085, 0.09, [700, 2300, 900], 0.3 - i * 0.03, { q: 2.4, peakAt: 0.5 });
        thump(v, i * 0.085 + 0.04, 180, 120, 0.06, 0.05);
      }
      links(v, 0.02, 0.34, 12, 0.11, 1800, 3200, { curve: 0.9, pan: 0.6 });
    },
  },
  e_axeDeck: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      // "güm": it slams onto the deck pile — deep thump, the pile's card slap, a short dark iron clank
      thump(v, 0, 84, 36, 0.85, 0.34, { drive: 1.8 });
      v.noise('white', { g: perc(0.3, 0.02, 0.0004), to: v.filt('bandpass', 1500, 0.9) });
      iron(v, 0.004, 140, 0.3, 0.5);
      puff(v, 0.01, 0.12, 0.16, 1000, { kind: 'pink' });
      links(v, 0.03, 0.2, 6, 0.05, 1800, 2700, { curve: 1.4 });
    },
  },
  e_axeLash: {
    cap: 1,
    gap: 0.2,
    verb: 0.36,
    play(v) {
      // the whip: a fast rising swish, then the CRACK (the tip breaking the air) + links jingling down the chain
      sweep(v, 0, 0.13, [500, 3000, 4800], 0.32, { q: 1.6, peakAt: 0.9, pan: [-0.3, 0.3] });
      crack(v, 0.12, 0.85, { hp: 2400, lp: 12000, n: 2, gap: 0.006, dec: 0.009 });
      thump(v, 0.12, 140, 70, 0.3, 0.1);
      links(v, 0.13, 0.22, 7, 0.06, 2000, 3400, { curve: 1.3, pan: 0.5 });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
