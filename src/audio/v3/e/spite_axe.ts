// Lane E sounds — spite_axe (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S10 Balta): the main colour is a LOW BEATING DRONE (two saws 41 / 42.6 Hz → a 1.6 Hz throb, its
// lowpass opening with each beat: the haft's living veins); the material is BLACK IRON + CHAIN (dark FM clanks at
// ~150 Hz, never a bright bell; chain links are dark FM knocks at 600–1100 Hz over a 150 Hz body (ironLinks), never the generic 1.7–3.4 kHz links or Kafes' gilded chime or Tasma's soft leash links);
// the separating layer is the BITE INTO THE FLOOR and the WRENCH out of it (an earth-metal groan: a slow, rising
// pulse train through iron resonances over brown-noise grit). No glass (crystal / Boşluk Gözü), no 50 Hz double
// heartbeat (Kül Ejderi), no "VUF" ignition (Kül Ejderi's): the axe's ignition is a dark iron "hum-snap".
//   e_axeOmen     the card's ember spark leaves for the sky: a dark iron shiver + a chain rattle + the drone's first throb
//   e_axeFall     the axe dives: a falling whistle (air through the blade, 2.4 kHz → 500 Hz) + chains streaming behind
//   e_axeBite     IMPACT: a deep floor thump + a heavy crack + the iron head's dark ring + dirt + the haft's quiver twang
//   e_axeChain    the chains drop and coil on the floor: a run of iron links settling (decelerating, panned)
//   e_axePulse    one vein beat: the low beating drone swells and falls (×3, the scene raises it a little each time)
//   e_axeGrip     the hand closes on the haft: a dull knock on dark wood + a leather creak + the vein's hiss starting
//   e_axeWrench   the wrench (0.92 s, three tugs): the long iron-earth groan (rising creak train, iron resonances,
//                 grit, a dull knock per tug), chains whining taut
//   e_axeSnap     the EARTH TEARS and the iron GROANS as it gives (a saw bent upward + brown-noise rip), two dark
//                 iron cracks where the chains break, the flung black links skitter (600–1050 Hz), clods
//   e_axeIgnite   the oath: eyes take the ember — a dark iron hum swelling into a dry snap, embers crackling off
//   e_axeCard     the equip's card crumbles to embers on its tile (the axe leaves the field)
//   e_axeSlip     return: the axe slips out of the grip by itself — an iron scrape down the haft + a tick
//   e_axeFly      the axe flies home spinning over the iron drone's throb: low whirring turns + black links knocking
//   e_axeDeck     it slams onto the deck pile: "GÜM" — a 60–80 Hz body, a dull iron knock, the card stack's slap + riffle
//   e_axeLash     a chain whips the owner's LP panel: a rising swish → a whip CRACK landing as a hit (100 Hz body)

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { clank, crack, puff, sweep, thump } from '../kit';

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
function iron(v: Voice, t: number, f: number, g: number, dec: number, index = 4.2): void {
  clank(v, f, t, g, dec, { ratio: 1.37, index, click: 1.2 });
  v.tone('triangle', [[0, f * 0.5], [0.08, f * 0.47, 'e']], { t, g: perc(g * 0.5, dec * 0.6, 0.001) });
}


/**
 * BLACK-IRON chain links (the axe's own register, never the generic 1.7–3.4 kHz link() colour of Tasma / Zincir):
 * each link is a dark FM knock at 600–1100 Hz with a ~150 Hz clank body and a dull, low click (brown noise).
 */
function ironLinks(v: Voice, t: number, d: number, n: number, g: number, o: { f0?: number; f1?: number; curve?: number; pan?: number; body?: number; index?: number } = {}): void {
  const f0 = o.f0 ?? 600;
  const f1 = o.f1 ?? 1100;
  const pans = [v.panner(-(o.pan ?? 0.4)), v.panner(0), v.panner(o.pan ?? 0.4)];
  for (let i = 0; i < n; i++) {
    const k = Math.pow(i / Math.max(1, n - 1), o.curve ?? 1);
    const tt = t + k * d + v.r(-0.004, 0.004);
    const gg = g * (1 - k * 0.5) * v.r(0.7, 1);
    const to = pans[i % 3];
    const f = v.r(f0, f1);
    v.bell(f, { t: tt, g: gg, dec: v.r(0.05, 0.1), ratio: 1.37, index: o.index ?? 2.2, idxDec: 0.02, to });
    v.tone('triangle', [[0, v.r(140, 165)], [0.05, 120, 'e']], { t: tt, g: perc(gg * (o.body ?? 0.9), 0.06, 0.0008), to });
    v.noise('brown', { t: tt, g: perc(gg * 1.4, 0.012, 0.0003), to: v.filt('lowpass', 1400, 1, { to }) });
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
      ironLinks(v, 0.04, 0.22, 6, 0.06, { f0: 420, f1: 700, curve: 1.3 });
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
      v.tone('sine', [[0, 1800], [0.3, 380, 'e']], { g: [[0, 0], [0.12, 0.05], [0.28, 0.1], [0.31, 0.0001, 'e']] });
      v.tone('sine', [[0, 2700], [0.3, 570, 'e']], { g: [[0, 0], [0.15, 0.012], [0.28, 0.025], [0.31, 0.0001, 'e']] });
      sweep(v, 0, 0.31, [1800, 900, 320], 0.26, { q: 1.8, peakAt: 0.85, kind: 'pink' });
      // the heavy head drags the air down with it: the card's drone throbbing under the dive
      ironDrone(v, 0, 0.36, 0.16, { lp: 500 });
      v.noise('brown', { g: [[0, 0], [0.28, 0.3], [0.31, 0.0001, 'e']], to: v.filt('lowpass', 400, 1) });
      // the edge splitting the air: a thin high hiss rising in density as it dives
      v.noise('white', { g: [[0, 0], [0.26, 0.55], [0.31, 0.0001, 'e']], to: v.filt('bandpass', [[0, 5200], [0.3, 7400, 'e']], 2.4) });
      // the chains stream behind it, rattling
      ironLinks(v, 0.02, 0.26, 8, 0.07, { f0: 560, f1: 950, curve: 0.8, pan: 0.5 });
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
      // the black chains fall slack and coil on the floor: heavy iron links settling (600–1000 Hz knocks over a
      // 150 Hz clank body), slowing down into two little heaps; the drone's throb under them
      ironLinks(v, 0, 0.42, 14, 0.2, { f0: 580, f1: 1000, curve: 1.6, pan: 0.6 });
      iron(v, 0.0, 150, 0.16, 0.4);
      iron(v, 0.27, 140, 0.12, 0.35);
      puff(v, 0.05, 0.14, 0.12, 600, { kind: 'brown' });
      puff(v, 0.27, 0.12, 0.1, 550, { kind: 'brown' });
      ironDrone(v, 0, 0.6, 0.1, { lp: 360 });
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
  e_axeGrip: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the hand closes on the haft: a dull knock of flesh on dark wood, a leather creak, the vein's hiss starting
      v.tone('triangle', [[0, 260], [0.06, 190, 'e']], { g: perc(0.34, 0.09, 0.001) });
      v.noise('pink', { g: perc(0.22, 0.05, 0.001), to: v.filt('bandpass', 420, 1.6) });
      const cr = v.filt('bandpass', [[0, 600], [0.18, 880, 'e']], 8);
      v.bursts([0.03, 0.055, 0.075, 0.092, 0.106, 0.118], [0.1, 0.12, 0.13, 0.12, 0.1, 0.08], { dec: 0.01, f: 700, q: 1.2, to: cr, kind: 'pink' });
      // the vein starts up the arm: a hiss climbing through a narrow band, the drone throbbing under it
      sweep(v, 0.05, 0.36, [500, 1400, 2600], 0.05, { q: 6, peakAt: 0.8 });
      ironDrone(v, 0, 0.5, 0.14, { lp: 480 });
    },
  },
  e_axeWrench: {
    cap: 1,
    gap: 0.3,
    verb: 0.36,
    play(v) {
      const D = 0.92;
      // the earth-metal groan: a creak train speeding up and RISING through two iron resonances, three tug accents
      const res = v.amp(1);
      res.connect(v.filt('bandpass', [[0, 300], [D, 560, 'e']], 6));
      res.connect(v.filt('bandpass', [[0, 820], [D, 1350, 'e']], 8));
      const times: number[] = [];
      const gains: number[] = [];
      let tt = 0;
      let gap = 0.05;
      while (tt < D) {
        times.push(tt);
        // each tug (every ~0.31 s) starts loud and slow, then the creak speeds up
        const ph = (tt % 0.31) / 0.31;
        gains.push((0.1 + (tt / D) * 0.2) * (ph < 0.15 ? 1.5 : 1));
        tt += gap;
        gap = ph > 0.85 ? 0.05 : Math.max(0.01, gap * 0.88);
      }
      v.bursts(times, gains, { dec: 0.012, f: 700, q: 1.4, to: res, kind: 'pink' });
      // the iron itself groaning: a saw bending upward in three steps (one per tug), gritty
      v.tone('sawtooth', [[0, 66], [0.3, 78, 'e'], [0.32, 74], [0.62, 90, 'e'], [0.64, 86], [D, 110, 'e']], { g: [[0, 0], [0.08, 0.08], [D, 0.13], [D + 0.04, 0.0001, 'e']], to: v.filt('lowpass', 760, 2) });
      // earth grit under it, a dull knock on each tug
      v.noise('brown', { g: [[0, 0], [D * 0.8, 0.24], [D + 0.05, 0.0001, 'e']], to: v.filt('lowpass', 520, 0.9) });
      for (const t0 of [0, 0.31, 0.62]) thump(v, t0, 90, 60, 0.22, 0.12);
      // the chains pulled taut: a thin whine climbing
      v.tone('sine', [[0, 2600], [D, 3300, 'e']], { g: [[0, 0], [D * 0.7, 0.012], [D, 0.024], [D + 0.02, 0.0001, 'e']] });
      ironDrone(v, 0, D + 0.1, 0.12, { lp: 600 });
    },
  },
  e_axeSnap: {
    cap: 1,
    gap: 0.2,
    verb: 0.4,
    duck: 0.4,
    play(v) {
      // the EARTH TEARS and the iron GROANS as it gives: a saw groan bent sharply upward through two iron
      // resonances, cut off where the chains break; a ripping brown-noise lead with a falling lowpass
      const gr = v.amp(1);
      gr.connect(v.filt('bandpass', [[0, 340], [0.12, 520, 'e']], 4));
      gr.connect(v.filt('lowpass', 700, 1.5));
      v.tone('sawtooth', [[0, 72], [0.08, 128, 'e'], [0.14, 96, 'e']], { g: [[0, 0], [0.012, 0.7], [0.12, 0.45], [0.2, 0.0001, 'e']], to: gr });
      v.tone('sawtooth', [[0, 108], [0.08, 190, 'e'], [0.14, 140, 'e']], { g: [[0, 0], [0.012, 0.35], [0.12, 0.2], [0.18, 0.0001, 'e']], to: gr });
      // torn soil fizzing high (well above every chain's band)
      v.noise('white', { t: 0.01, g: [[0, 0], [0.012, 2.2], [0.24, 0.0001, 'e']], to: v.filt('bandpass', [[0, 7800], [0.2, 5600, 'e']], 1.2, { t: 0.01 }) });
      v.noise('brown', { t: 0, g: [[0, 0], [0.02, 1.1], [0.34, 0.0001, 'e']], to: v.filt('lowpass', [[0, 900], [0.34, 200, 'e']], 1.1) });
      thump(v, 0.01, 110, 46, 0.6, 0.22, { drive: 1.6 });
      // the chains break: two heavy iron cracks (dark FM, ~300 / 230 Hz with a 150 Hz body), not bright pings
      iron(v, 0.004, 196, 0.42, 0.35, 1.6);
      iron(v, 0.02, 158, 0.36, 0.4, 1.6);
      // the flung links land and skitter, black iron
      ironLinks(v, 0.12, 0.42, 9, 0.1, { f0: 440, f1: 700, curve: 1.6, pan: 0.8, index: 1.3 });
      // clods
      v.crackle({ t: 0.02, d: 0.34, n: 14, g: 0.12, f: 5200, q: 1, dec: 0.01, curve: 1.6 });
      v.bursts([0.05, 0.11, 0.17, 0.22], [0.26, 0.2, 0.16, 0.12], { dec: 0.03, f: 420, q: 1, kind: 'brown' });
      // the axe flies free: a short low swish
      sweep(v, 0.03, 0.22, [260, 600, 380], 0.14, { q: 1.4, peakAt: 0.3, kind: 'pink' });
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
      iron(v, 0.16, 210, 0.18, 0.5, 1.6);
      v.crackle({ t: 0.2, d: 0.55, n: 16, g: 0.14, f: 6400, q: 1, dec: 0.006, curve: 1.2 });
    },
  },
  e_axeCard: {
    cap: 2,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      // the card crumbles into embers on its tile: a low crack, a crackling burn-through, a soft fall
      crack(v, 0, 0.22, { hp: 1200, lp: 6000, n: 2, gap: 0.012, dec: 0.012 });
      v.crackle({ t: 0.02, d: 0.35, n: 20, g: 0.14, f: 6000, q: 1, dec: 0.007, curve: 1.3 });
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
      sweep(v, 0, 0.22, [6400, 4600, 2600], 0.16, { q: 5, peakAt: 0.3 });
      v.tone('sine', [[0, 2900], [0.2, 1950, 'e']], { g: [[0, 0], [0.02, 0.025], [0.22, 0.0001, 'e']] });
      iron(v, 0.2, 196, 0.14, 0.3, 1.6);
      ironLinks(v, 0.02, 0.18, 4, 0.05, { f0: 420, f1: 700, index: 1.3 });
      ironDrone(v, 0, 0.4, 0.08, { lp: 360 });
    },
  },
  e_axeFly: {
    cap: 1,
    gap: 0.2,
    verb: 0.28,
    play(v) {
      // spinning home on the card's own colour: the iron drone throbs under the flight (41 / 42.6 Hz beat),
      // six low whirring turns (the heavy head cutting round, slightly faster as it closes on the pile),
      // the black chain knocking behind it
      ironDrone(v, 0, 0.7, 0.2, { lp: 560 });
      let at = 0;
      for (let i = 0; i < 6; i++) {
        const up = 1 + i * 0.06;
        sweep(v, at, 0.095, [260 * up, 1000 * up, 380 * up], 0.36 + i * 0.02, { q: 2.2, peakAt: 0.5, kind: 'pink' });
        thump(v, at + 0.045, 150 + i * 6, 105, 0.12, 0.05);
        // the blade's edge hissing through the air once per turn (high, thin: the spin reads as a cutting edge)
        v.noise('white', { t: at + 0.04, g: [[0, 0], [0.02, 0.5 + i * 0.05], [0.06, 0.0001, 'e']], to: v.filt('bandpass', 6400 + i * 300, 3) });
        at += 0.105 - i * 0.006;
      }
      ironLinks(v, 0.02, 0.52, 12, 0.1, { f0: 440, f1: 760, curve: 0.9, pan: 0.6, index: 1.3 });
    },
  },

  e_axeDeck: {
    cap: 1,
    gap: 0.2,
    verb: 0.38,
    duck: 0.4,
    play(v) {
      // "GÜM": the heavy axe lands ON a stack of cards — a 60–80 Hz body under it all, a dull iron knock (30 ms),
      // the stack's boxy 200–400 Hz thud, the papery slap of the top cards, the cards riffling as they settle
      thump(v, 0, 80, 52, 0.85, 0.2, { drive: 1.6 });
      v.tone('triangle', [[0, 170], [0.03, 140, 'e']], { g: perc(0.5, 0.03, 0.0008) });
      v.bell(420, { g: 0.12, dec: 0.08, ratio: 1.37, index: 1.6, idxDec: 0.02 });
      v.noise('pink', { g: perc(1.6, 0.08, 0.001), to: v.filt('bandpass', [[0, 420], [0.08, 280, 'e']], 1.6) });
      v.tone('triangle', [[0, 300], [0.07, 210, 'e']], { g: perc(0.6, 0.1, 0.001) });
      v.noise('white', { g: perc(1.0, 0.02, 0.0003), to: v.filt('bandpass', 2200, 1.0) });
      v.noise('white', { t: 0.002, g: perc(0.5, 0.03, 0.0003), to: v.filt('bandpass', 5200, 1.2) });
      v.bursts([0.03, 0.045, 0.058, 0.07, 0.081, 0.09, 0.098, 0.105], [0.34, 0.3, 0.26, 0.22, 0.18, 0.15, 0.12, 0.08], { dec: 0.008, f: 3600, q: 1.1, kind: 'white' });
      // a last knock of the black chain sliding in after it
      ironLinks(v, 0.08, 0.18, 3, 0.06, { curve: 1.4 });
    },
  },

  e_axeLash: {
    cap: 1,
    gap: 0.2,
    verb: 0.36,
    duck: 0.35,
    play(v) {
      // the whip: a rising swish as the chain unrolls (links rattling dark along it), then the CRACK (a hard
      // broadband transient with a fast falling chirp — the tip breaking the air) landing as a HIT (a 100 Hz body)
      sweep(v, 0, 0.2, [260, 700, 8000], 0.6, { q: 1.6, peakAt: 0.92, pan: [-0.3, 0.3] });
      ironLinks(v, 0.02, 0.17, 7, 0.1, { f0: 420, f1: 720, curve: 0.8, pan: 0.5, index: 1.3 });
      const T0 = 0.2;
      v.noise('white', { t: T0, g: perc(2.8, 0.01, 0.0001), to: v.filt('highpass', 2500, 0.7) });
      // the air the tip tore: a bright hiss tail (well above the bind's range)
      v.noise('white', { t: T0 + 0.006, g: [[0, 1.8], [0.14, 0.0001, 'e']], to: v.filt('bandpass', [[0, 10500], [0.14, 7000, 'e']], 0.9, { t: T0 + 0.006 }) });
      v.tone('square', [[0, 6200], [0.012, 900, 'e']], { t: T0, g: perc(0.22, 0.018, 0.0002), to: v.filt('lowpass', 9000) });
      crack(v, T0 + 0.004, 1.9, { hp: 3000, lp: 12000, n: 3, gap: 0.006, dec: 0.014 });
      thump(v, T0, 96, 62, 1.3, 0.16, { drive: 2 });
      // the links jangle down the chain after the hit, dark
      ironLinks(v, T0 + 0.03, 0.26, 7, 0.14, { f0: 420, f1: 720, curve: 1.3, pan: 0.5, index: 1.3 });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
