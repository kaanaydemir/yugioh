// Arena v4 step 4 — the reactive arena's sounds (src/view/board-nt/react.ts, holograms.ts). All quiet, all UNDER the cards'
// own sounds: the arena answers the duel, it never speaks over it. Spread into the game's table by src/audio/sounds.ts.
//
//   arenaSweepP1 / P2  the turn-change light sweep: an airy band of filtered noise crossing the stereo field in the sweep's
//                      direction (P1 left → right, P2 right → left, an octave lower) with a faint glass fifth at its crest
//   arenaShockS / L    the floor shockwave: a stone thump under the impact and a run of soft tile ticks receding outward
//                      (L: deeper, wider, five ticks; S: two)
//   arenaHeart         the low-LP heartbeat: a muffled lub-dub (sub thumps, no click) with a breath of room hiss
//   arenaGlitch        a hologram / screen glitch: a stepped digital chirp through a narrow band, a ring-mod buzz tail
//   arenaHoloSurge     a hologram surging up as its owner summons: a soft rising glass shimmer

import type { Recipe } from '../sounds';
import { midiHz, perc, type Pt, type Voice } from '../synth';

function sweep(v: Voice, dir: 1 | -1, base: number): void {
  const pan = v.panner([
    [0, -0.7 * dir],
    [0.75, 0.7 * dir],
  ]);
  // the band of light: pink noise through a band that opens and closes as it passes
  const bp = v.filt('bandpass', [[0, base * 0.6], [0.32, base * 3.2, 'e'], [0.8, base * 1.1, 'e']], 1.1, { to: pan });
  v.noise('pink', { g: [[0, 0], [0.3, 0.13], [0.82, 0.0001, 'e']], to: bp });
  // a high air layer that shimmers a little (a slow flutter)
  const hp = v.filt('highpass', base * 4, 0.7, { to: pan });
  v.noise('white', { g: [[0, 0], [0.34, 0.025], [0.7, 0.0001, 'e']], to: hp });
  // the crest: a faint glass fifth
  const f = base === 400 ? 76 : 64;
  v.bell(midiHz(f), { t: 0.26, g: 0.022, dec: 0.9, ratio: 2.01, index: 0.8, to: pan });
  v.bell(midiHz(f + 7), { t: 0.3, g: 0.016, dec: 0.8, ratio: 2.01, index: 0.6, to: pan });
  // the stage under it hums once
  v.tone('sine', [[0, base === 400 ? 82 : 62], [0.6, base === 400 ? 70 : 52, 'e']], { g: [[0, 0], [0.22, 0.07], [0.75, 0.0001, 'e']] });
}

function shock(v: Voice, big: boolean): void {
  // the stone thump right under the impact (sub, no click: the card's own sound carries the hit)
  v.tone('sine', [[0, big ? 64 : 82], [0.25, big ? 34 : 46, 'e']], { g: perc(big ? 0.5 : 0.28, big ? 0.42 : 0.24, 0.006), to: v.filt('lowpass', 260) });
  v.noise('brown', { g: perc(big ? 0.22 : 0.12, big ? 0.3 : 0.16, 0.004), to: v.filt('lowpass', [[0, 520], [0.3, 160, 'e']], 0.8) });
  // the tile borders answering one after another, receding (softer, duller, further out in the stereo field)
  const n = big ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const t = 0.07 + i * (big ? 0.075 : 0.07);
    const side = i % 2 === 0 ? -1 : 1;
    const pan = v.panner(side * Math.min(0.75, 0.15 + i * 0.15), { t });
    const g = (big ? 0.07 : 0.05) * Math.pow(0.7, i);
    v.noise('white', { t, g: perc(g, 0.035, 0.001), to: v.filt('bandpass', 2600 - i * 300, 5, { to: pan }) });
    v.tone('triangle', midiHz(91 - i * 2), { t, g: perc(g * 0.25, 0.05, 0.001), to: pan });
  }
}

export const ARENA_RECIPES = {
  arenaSweepP1: { cap: 1, gap: 0.4, verb: 0.4, play: (v) => sweep(v, 1, 400) },
  arenaSweepP2: { cap: 1, gap: 0.4, verb: 0.4, play: (v) => sweep(v, -1, 200) },
  arenaShockS: { cap: 2, gap: 0.1, verb: 0.18, vary: 0.05, play: (v) => shock(v, false) },
  arenaShockL: { cap: 2, gap: 0.15, verb: 0.3, vary: 0.04, play: (v) => shock(v, true) },
  arenaHeart: {
    cap: 1,
    gap: 0.5,
    verb: 0.1,
    play(v) {
      const lp = v.filt('lowpass', 180, 0.6);
      // lub … dub
      v.tone('sine', [[0, 58], [0.16, 38, 'e']], { g: perc(0.34, 0.2, 0.012), to: lp });
      v.tone('sine', [[0.17, 52], [0.32, 36, 'e']], { t: 0, g: [[0, 0], [0.17, 0], [0.182, 0.22], [0.36, 0.0001, 'e']], to: lp });
      // a body under each beat (felt more than heard)
      v.tone('triangle', [[0, 46], [0.2, 32, 'e']], { g: perc(0.07, 0.18, 0.01), to: lp });
      // a breath of low room hiss across the beat
      v.noise('pink', { g: [[0, 0], [0.12, 0.012], [0.42, 0.0001, 'e']], to: v.filt('bandpass', 420, 0.8) });
    },
  },
  arenaGlitch: {
    cap: 2,
    gap: 0.12,
    verb: 0.12,
    vary: 0.12,
    play(v) {
      const bp = v.filt('bandpass', 1800, 3);
      const steps: Pt[] = [
        [0, 1240],
        [0.016, 420, 's'],
        [0.03, 2210, 's'],
        [0.046, 760, 's'],
        [0.06, 1530, 's'],
        [0.074, 330, 's'],
      ];
      v.tone('square', steps, { g: [[0, 0.05], [0.09, 0.05], [0.11, 0.0001, 'e']], to: bp });
      const ring = v.ring(97, { t: 0.06, d: 0.14, mix: 1 });
      v.tone('sawtooth', 210, { t: 0.06, g: perc(0.03, 0.12, 0.002), to: v.filt('lowpass', 1600, 0.7, { to: ring }) });
      v.noise('white', { g: perc(0.025, 0.03, 0.0005), to: v.filt('highpass', 5000) });
    },
  },
  arenaHoloSurge: {
    cap: 2,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      const hp = v.filt('highpass', 700, 0.7);
      for (const [i, m] of [72, 79, 84].entries())
        v.tone('sine', [[0, midiHz(m - 5)], [0.28, midiHz(m), 'e']], { t: i * 0.03, g: [[0, 0], [0.18, 0.018], [0.6, 0.0001, 'e']], to: hp });
      v.noise('white', { g: [[0, 0], [0.22, 0.02], [0.45, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2000], [0.3, 7000, 'e']], 2) });
    },
  },
} satisfies Record<string, Recipe>;

export type ArenaSfxName = keyof typeof ARENA_RECIPES;
