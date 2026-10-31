// Lane E sounds — winnow_sieve (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S5 Harman Eleği): the main colour is the 6 Hz RHYTHMIC SHAKE — one cycle = a grain wash slapping the
// LEFT side of the hoop, then the RIGHT (a hard pan per stroke) — the material is a woven straw sieve + dry wheat
// grain (a dense, bright, sandy patter, never glassy), the separating layer is the CHAFF / STRAW WINNOWING: a short,
// light, high-passed rustle carried off by a small gust. Kept apart from: S9 Saman Korkuluklar (a long straw rustle +
// a wooden stake "tok" + a crow: our straw is ≤ 0.3 s, above 4 kHz, no stake, no bird), S1 Kova (330 Hz ratchet), C6
// (180 Hz hollow log): the hoop's knock here is a light bent-wood band at 240 Hz with a reed-like 2.6 kHz edge.
//   e_sieveWeave   the sieve weaves itself: a run of tiny straw ticks rising + the bent-wood hoop closing (a creak)
//   e_sievePour    golden grain pours into the sieve: a dense sandy hiss that thins, a few grains ticking last
//   e_sieveShake   ONE shake cycle (played on every cycle, 6 per second): grain wash left, then right, hoop taps
//   e_sieveToss    a card is flicked out of the grain: hoop "tok" + a paper flick + a spray of grains (pitch per card)
//   e_sieveFall    the tossed grains rain back into the sieve: a soft, thinning patter
//   e_sieveSettle  the sieve sinks low to wait: a soft hoop bump and a grain hush
//   e_sieveIdle    while the choice waits: a very quiet grain slide (the grains roll across the mesh)
//   e_sieveDrop    a chosen card drops into the sieve: a short paper "fwip" and a soft landing on grain
//   e_sieveStraw   the cards turn to straw: a short, crisp, high rustle with a dry snap (≤ 0.3 s)
//   e_sieveGust    a small gust carries the straw away: a short wind breath panned toward the graveyard + chaff tail
//   e_sieveGrave   the straw lands on the graveyard: a light paper settle and a soft tick
//   e_sieveEnd     the sieve unravels: straw plucks running down + a last bent-wood creak and a puff

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** The hoop: a light bent-wood band — a short 240 Hz body with a reed-like edge (no hollow-log ring). */
function hoop(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 240;
  v.tone('triangle', [[0, f * 1.08], [0.025, f, 'e']], { t, g: perc(g * 0.6, 0.05, 0.0008), to: o.to });
  v.tone('sine', f * 3.3, { t, g: perc(g * 0.18, 0.02, 0.0005), to: o.to });
  v.noise('white', { t, g: perc(g * 0.5, 0.006, 0.0002), to: v.filt('bandpass', 2600, 2.4, { to: o.to }) });
}

/** A grain wash: a dense handful of tiny sandy clicks + a short hiss, in a band (dry wheat on straw). */
function wash(v: Voice, t: number, g: number, d: number, o: { f?: number; n?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 3400;
  v.crackle({ t, d, n: o.n ?? 16, g: g * 0.55, f, q: 1.3, dec: 0.004, curve: 1.6, to: o.to });
  v.noise('pink', { t, g: [[0, 0], [0.008, g * 0.5], [d, 0.0001, 'e']], to: v.filt('bandpass', f * 0.85, 1.1, { to: o.to }) });
}

export const RECIPES = {
  e_sieveWeave: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // straw strands snapping into the weave: 9 tiny ticks, rising in pitch and closing in
      const times = [0, 0.03, 0.058, 0.084, 0.108, 0.13, 0.15, 0.168, 0.184];
      times.forEach((tt, i) => v.noise('white', { t: tt, g: perc(0.14 + i * 0.012, 0.007, 0.0003), to: v.filt('bandpass', 2800 + i * 260, 3) }));
      // the bent-wood hoop closes round them: a short creak (a rough pulse train), then its knock
      const d = 0.16;
      const bp = v.filt('bandpass', [[0, 520], [d, 760, 'e']], 4);
      const fl = v.flutter(55, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { t: 0.05, g: [[0, 0], [0.04, 0.22], [d, 0.0001, 'e']], to: fl });
      hoop(v, 0.205, 0.32);
      // a warm golden breath under it (the light coming on)
      v.tone('sine', [[0, 392], [0.3, 440, 'e']], { t: 0.18, g: [[0, 0], [0.04, 0.03], [0.26, 0.0001, 'e']] });
      v.tone('sine', 587, { t: 0.2, g: [[0, 0], [0.05, 0.025], [0.3, 0.0001, 'e']] });
    },
  },
  e_sievePour: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play(v) {
      // a stream of wheat into the woven bowl: dense at first, thinning; the band falls a little as it piles
      const d = 0.42;
      const bp = v.filt('bandpass', [[0, 4200], [d, 2900, 'e']], 1.2);
      v.noise('pink', { g: [[0, 0], [0.03, 0.2], [0.18, 0.15], [d, 0.0001, 'e']], to: bp });
      v.crackle({ d, n: 46, g: 0.14, f: 3600, q: 1.4, dec: 0.004, curve: 1.8 });
      // the last few grains bouncing on the heap
      v.bursts([0.38, 0.42, 0.47, 0.53], [0.08, 0.06, 0.045, 0.03], { dec: 0.006, f: 4400, q: 2 });
    },
  },
  e_sieveShake: {
    cap: 3,
    gap: 0.06,
    verb: 0.22,
    play(v) {
      // one shake cycle (1/6 s): the grain slaps the LEFT side of the hoop, then the RIGHT
      const L = v.panner(-0.65);
      const Rr = v.panner(0.65);
      wash(v, 0, 0.85, 0.06, { f: 3300, n: 16, to: L });
      hoop(v, 0.004, 0.18, { f: 236, to: L });
      wash(v, 0.083, 0.8, 0.06, { f: 3600, n: 16, to: Rr });
      hoop(v, 0.087, 0.16, { f: 252, to: Rr });
    },
  },
  e_sieveToss: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    vary: 0.02,
    play(v) {
      // the flick: the hoop knocks up into the card ("tok") …
      hoop(v, 0, 0.42, { f: 290 });
      // … the card snaps off the grain: one crisp, very high paper tick (no swept flick: that is the well's) …
      v.noise('white', { t: 0.018, g: perc(0.2, 0.01, 0.0003), to: v.filt('highpass', 6500, 0.8) });
      // … and the grains it throws up spray out and patter
      wash(v, 0.02, 0.5, 0.26, { f: 5200, n: 36 });
      wash(v, 0.16, 0.18, 0.2, { f: 3200, n: 12 });
    },
  },
  e_sieveFall: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the thrown grains rain back into the bowl: a soft patter thinning out over half a second
      v.crackle({ d: 0.55, n: 26, g: 0.22, f: 2300, q: 1.2, dec: 0.004, curve: 0.7 });
      v.noise('pink', { g: [[0, 0], [0.05, 0.06], [0.5, 0.0001, 'e']], to: v.filt('bandpass', 2600, 1) });
    },
  },
  e_sieveSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the sieve sinks low: the hoop meets the air cushion (a soft low bump), the grain hushes once
      thump(v, 0, 120, 80, 0.2, 0.12);
      hoop(v, 0.01, 0.16, { f: 220 });
      const bp = v.filt('bandpass', [[0, 3200], [0.3, 2200, 'e']], 1.1);
      v.noise('pink', { t: 0.02, g: [[0, 0], [0.04, 0.12], [0.34, 0.0001, 'e']], to: bp });
    },
  },
  e_sieveIdle: {
    cap: 2,
    gap: 0.3,
    verb: 0.35,
    play(v) {
      // the grains roll slowly across the mesh: a hushed sandy swell with a few soft ticks
      const d = 0.7;
      const bp = v.filt('bandpass', [[0, 1900], [d, 2700, 'e']], 1.4);
      v.noise('pink', { g: [[0, 0], [0.3, 0.07], [d, 0.0001, 'e']], to: bp });
      v.crackle({ t: 0.15, d: 0.45, n: 7, g: 0.05, f: 3200, q: 1.5, dec: 0.004 });
    },
  },
  e_sieveDrop: {
    cap: 3,
    gap: 0.05,
    verb: 0.28,
    play(v) {
      // a card falling in: a short paper "fwip" (falling band), then landing flat on grain: a soft "tsk" + a puff
      sweep(v, 0, 0.12, [5200, 3600, 1800], 0.16, { q: 1.3 });
      wash(v, 0.12, 0.22, 0.08, { f: 3000, n: 9 });
      puff(v, 0.12, 0.12, 0.06, 900);
    },
  },
  e_sieveStraw: {
    cap: 2,
    gap: 0.05,
    verb: 0.22,
    play(v) {
      // the card dries into straw: a short, crisp, HIGH rustle (above 4 kHz) and one dry snap — light and quick
      const d = 0.24;
      const hp = v.filt('highpass', 4300, 0.8);
      v.noise('white', { g: [[0, 0], [0.015, 0.16], [0.08, 0.1], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, 6500], [d, 8200, 'e']], 1.5, { to: hp }) });
      v.crackle({ d, n: 18, g: 0.16, f: 6200, q: 2, dec: 0.003, curve: 0.8, to: hp });
      v.noise('white', { t: 0.05, g: perc(0.22, 0.008, 0.0002), to: v.filt('bandpass', 5200, 2.5) });
    },
  },
  e_sieveGust: {
    cap: 1,
    gap: 0.2,
    verb: 0.36,
    play(v) {
      // a short breath of wind sweeping the straw away (the scene pans it toward the graveyard) …
      sweep(v, 0, 0.5, [500, 1600, 700], 0.3, { q: 0.9, kind: 'pink', peakAt: 0.35 });
      sweep(v, 0.04, 0.4, [1200, 3200, 1500], 0.12, { q: 2.2, peakAt: 0.4 });
      // … with the straw rustling high in it, thinning (chaff: never a long rustle)
      v.crackle({ t: 0.06, d: 0.34, n: 16, g: 0.08, f: 6400, q: 2, dec: 0.003, curve: 1.3 });
    },
  },
  e_sieveGrave: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play(v) {
      // straw landing on the pile: a light paper settle and one soft tick
      puff(v, 0, 0.1, 0.05, 2400);
      v.crackle({ d: 0.1, n: 6, g: 0.08, f: 5200, q: 2, dec: 0.003 });
      v.noise('white', { t: 0.02, g: perc(0.1, 0.01, 0.0003), to: v.filt('bandpass', 3800, 3) });
    },
  },
  e_sieveEnd: {
    cap: 1,
    gap: 0.3,
    verb: 0.36,
    play(v) {
      // the weave unravels: strands plucked out one after another, the pitch running down
      const times = [0, 0.035, 0.068, 0.098, 0.126, 0.152, 0.176, 0.198];
      times.forEach((tt, i) => v.noise('white', { t: tt, g: perc(0.13 - i * 0.008, 0.008, 0.0003), to: v.filt('bandpass', 5000 - i * 330, 3.2) }));
      // the hoop lets go: a last bent-wood creak and a little puff of chaff
      const d = 0.14;
      const bp = v.filt('bandpass', [[0, 700], [d, 460, 'e']], 4);
      const fl = v.flutter(42, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { t: 0.2, g: [[0, 0], [0.03, 0.2], [d, 0.0001, 'e']], to: fl });
      puff(v, 0.26, 0.1, 0.18, 2600, { kind: 'pink' });
      v.tone('sine', [[0, 440], [0.3, 392, 'e']], { t: 0.24, g: [[0, 0], [0.03, 0.018], [0.26, 0.0001, 'e']] });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
