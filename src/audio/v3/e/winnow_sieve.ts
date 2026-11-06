// Lane E sounds — winnow_sieve (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S5 Harman Eleği): the main colour is the 6 Hz RHYTHMIC SHAKE — one cycle = a grain wash slapping the
// LEFT side of the hoop, then the RIGHT (hard-panned strokes), each stroke a sandy 2–4 kHz slap ON a 240 Hz bent-wood
// hoop tap with a little low body — the material is a woven straw sieve + dry wheat grain (a dense, bright, sandy
// patter, never glassy, never wet), the separating layer is the CHAFF / WINNOWING: a short, narrow, high puff of air
// (a winnowing fan's breath, 2.5–5 kHz, ≤ 0.35 s) carrying a run of chaff ticks across the stereo field.
// Kept apart from: S9 Saman Korkuluklar (a long straw rustle + a wide 300–1600 Hz pink wind swell + a stake "tok" + a
// crow: we use none of those — no pink swell, no long rustle), S1 Kova (wet flutters, droplets, a 330 Hz ratchet),
// C6 (180 Hz hollow log), the gale (a wide full-band stroke).
//   e_sieveWeave   the sieve weaves itself: a run of tiny straw ticks rising + the bent-wood hoop closing (a creak)
//   e_sievePour    golden grain pours into the sieve: a dense sandy hiss that thins, a few grains ticking last
//   e_sieveShake   ONE shake cycle (played on every cycle, 6 per second): grain slap hard left, then hard right
//   e_sieveToss    a card is flicked out of the grain: hoop knock + low body, a paper tick, a sandy spray
//   e_sieveTossBig the third (last) toss, the climax: a heavier knock, a double hoop ring, a big spray
//   e_sieveFall    the tossed grains rain back into the sieve: a soft, thinning patter
//   e_sieveSettle  the sieve sinks low to wait: a soft hoop bump and a grain hush
//   e_sieveIdle    while the choice waits: a very quiet grain slide (the grains roll across the mesh)
//   e_sieveCatch   a tossed card reaches its hand slot: a soft paper tick (card on card) and one stray grain
//   e_sieveDrop    a chosen card drops into the sieve: a short paper "fwip" and a soft landing on grain
//   e_sieveStraw   the cards turn to straw: a short, crisp, dry crunch above 3 kHz (≤ 0.3 s)
//   e_sieveGustR   the winnowing breath carries the straw to the RIGHT: a narrow high air puff + chaff ticks panned L → R
//   e_sieveGustL   the same, R → L (the scene picks the side the graveyard lies on)
//   e_sieveGust    (kept for compatibility) = e_sieveGustR
//   e_sieveGrave   the straw lands on the graveyard: a light paper settle and a soft tick
//   e_sieveEnd     the sieve unravels: straw plucks running down + a last bent-wood creak and a puff

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** Run `play` through a gain stage of `db` decibels (the voice's destination is swapped while it plays). */
function lift(db: number, play: (v: Voice) => void): (v: Voice) => void {
  return (v) => {
    const bus = v.amp(Math.pow(10, db / 20));
    const o = v as unknown as { out: AudioNode };
    const prev = o.out;
    Object.defineProperty(v, 'out', { value: bus, configurable: true, writable: true });
    try {
      play(v);
    } finally {
      Object.defineProperty(v, 'out', { value: prev, configurable: true, writable: true });
    }
  };
}

/** The hoop: a light bent-wood band — a short 240 Hz body with a reed-like edge (no hollow-log ring). */
function hoop(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode; body?: number } = {}): void {
  const f = o.f ?? 240;
  v.tone('triangle', [[0, f * 1.08], [0.025, f, 'e']], { t, g: perc(g * 0.6, 0.05, 0.0008), to: o.to });
  v.tone('sine', f * 3.3, { t, g: perc(g * 0.18, 0.02, 0.0005), to: o.to });
  v.noise('white', { t, g: perc(g * 0.5, 0.006, 0.0002), to: v.filt('bandpass', 2600, 2.4, { to: o.to }) });
  // the weight of the woven bowl behind the knock (low body)
  if (o.body) thump(v, t, f * 0.46, f * 0.36, g * o.body, 0.06, { to: o.to });
}

/** A grain wash: a dense handful of tiny sandy clicks + a short hiss, in a band (dry wheat on straw). */
function wash(v: Voice, t: number, g: number, d: number, o: { f?: number; n?: number; q?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 3400;
  v.crackle({ t, d, n: o.n ?? 16, g: g * 0.55, f, q: 1.3, dec: 0.004, curve: 1.6, to: o.to });
  v.noise('pink', { t, g: [[0, 0], [0.008, g * 0.5], [d, 0.0001, 'e']], to: v.filt('bandpass', f * 0.85, o.q ?? 1.1, { to: o.to }) });
}

/** One shake stroke: the grain slaps a side of the hoop — a sandy 2–4 kHz slap, the 240 Hz tap, a low body. */
function stroke(v: Voice, t: number, g: number, f: number, to: AudioNode): void {
  // the slap: a hard sandy burst (fast attack, short), then grains trickling back
  // (round 2: the slap leads — the hoop tap is half what it was, the grain band sits higher, so the stroke's centroid
  //  lands near 2 kHz and the 6 Hz sandy patter is the identity, not the 240 Hz knock)
  const hp = v.filt('highpass', 1500, 0.7, { to });
  v.noise('white', { t, g: perc(g * 0.62, 0.03, 0.0005), to: v.filt('bandpass', f * 0.8, 1.1, { to: hp }) });
  v.noise('pink', { t: t + 0.006, g: perc(g * 0.3, 0.05, 0.001), to: v.filt('bandpass', f * 0.75, 1.4, { to }) });
  v.crackle({ t, d: 0.06, n: 18, g: g * 0.36, f: f * 0.95, q: 1.2, dec: 0.003, curve: 2, to });
  hoop(v, t + 0.002, g * 0.2, { f: 240, to, body: 0.12 });
}

/** The winnowing breath: a narrow, high, fast puff of air carrying chaff ticks across `pan` (≤ 0.35 s). */
function winnow(v: Voice, pan: readonly [number, number]): void {
  const d = 0.32;
  const out = v.panner([[0, pan[0]], [d, pan[1]]]);
  // the breath: a fast attack, narrow band climbing 2.8 → 4.6 kHz, gone in a third of a second
  const bp = v.filt('bandpass', [[0, 2800], [0.08, 4200, 'e'], [d, 4600, 'e']], 2.6, { to: out });
  v.noise('white', { g: [[0, 0], [0.012, 0.3], [0.07, 0.16], [d, 0.0001, 'e']], to: bp });
  // a second, higher edge of the fan's air (a hiss on its lip)
  v.noise('white', { t: 0.01, g: [[0, 0], [0.01, 0.12], [0.12, 0.0001, 'e']], to: v.filt('bandpass', 7000, 3, { to: out }) });
  // the chaff riding it: the main element — a dense run of dry ticks thinning along the flight
  v.crackle({ t: 0.01, d: 0.3, n: 34, g: 0.3, f: 4400, q: 2.2, dec: 0.003, curve: 1.5, to: out });
  v.crackle({ t: 0.04, d: 0.26, n: 22, g: 0.32, f: 7600, q: 2.5, dec: 0.002, curve: 1.2, to: out });
}

export const RECIPES = {
  e_sieveWeave: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(3, (v) => {
      // straw strands snapping into the weave: 9 tiny ticks, rising in pitch and closing in
      const times = [0, 0.03, 0.058, 0.084, 0.108, 0.13, 0.15, 0.168, 0.184];
      times.forEach((tt, i) => v.noise('white', { t: tt, g: perc(0.14 + i * 0.012, 0.007, 0.0003), to: v.filt('bandpass', 2800 + i * 260, 3) }));
      // the bent-wood hoop closes round them: a short creak (a rough pulse train), then its knock
      const d = 0.16;
      const bp = v.filt('bandpass', [[0, 520], [d, 760, 'e']], 4);
      const fl = v.flutter(55, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { t: 0.05, g: [[0, 0], [0.04, 0.22], [d, 0.0001, 'e']], to: fl });
      hoop(v, 0.205, 0.32, { body: 0.6 });
      // a warm golden breath under it (the light coming on)
      v.tone('sine', [[0, 392], [0.3, 440, 'e']], { t: 0.18, g: [[0, 0], [0.04, 0.03], [0.26, 0.0001, 'e']] });
      v.tone('sine', 587, { t: 0.2, g: [[0, 0], [0.05, 0.025], [0.3, 0.0001, 'e']] });
    }),
  },
  e_sievePour: {
    cap: 1,
    gap: 0.2,
    verb: 0.32,
    play: lift(3, (v) => {
      // a stream of wheat into the woven bowl: dense at first, thinning; the band falls a little as it piles
      const d = 0.42;
      const bp = v.filt('bandpass', [[0, 4200], [d, 2900, 'e']], 1.2);
      v.noise('pink', { g: [[0, 0], [0.03, 0.2], [0.18, 0.15], [d, 0.0001, 'e']], to: bp });
      v.crackle({ d, n: 46, g: 0.14, f: 3600, q: 1.4, dec: 0.004, curve: 1.8 });
      // the heap taking weight under the stream
      thump(v, 0.02, 160, 110, 0.08, 0.2);
      // the last few grains bouncing on the heap
      v.bursts([0.38, 0.42, 0.47, 0.53], [0.08, 0.06, 0.045, 0.03], { dec: 0.006, f: 4400, q: 2 });
    }),
  },
  e_sieveShake: {
    cap: 2,
    gap: 0.06,
    verb: 0.14,
    play: lift(-0.5, (v) => {
      // one shake cycle (1/6 s): the grain slaps the hoop HARD LEFT, then HARD RIGHT
      stroke(v, 0, 1.1, 2900, v.panner(-0.9));
      stroke(v, 0.083, 1.05, 3300, v.panner(0.9));
    }),
  },
  e_sieveToss: {
    cap: 3,
    gap: 0.05,
    verb: 0.3,
    vary: 0.02,
    play: lift(2, (v) => {
      // the flick leads with the hoop's knock: bent wood + the bowl's weight ("tok") …
      hoop(v, 0, 0.6, { f: 240, body: 0.4 });
      thump(v, 0, 112, 84, 0.12, 0.06);
      // … the card snaps off the grain: one crisp, very high paper tick …
      v.noise('white', { t: 0.018, g: perc(0.3, 0.012, 0.0003), to: v.filt('highpass', 6500, 0.8) });
      // the dry husks glinting high in the spray (the grain is dry: no water, no glass)
      v.crackle({ t: 0.025, d: 0.16, n: 14, g: 0.16, f: 8800, q: 2, dec: 0.002, curve: 1.5 });
      // … and the grains it throws up spray out sandy (2–3 kHz) and patter back
      wash(v, 0.02, 1.0, 0.22, { f: 3300, n: 32, q: 2 });
      wash(v, 0.15, 0.3, 0.22, { f: 2800, n: 12, q: 1.8 });
      v.crackle({ t: 0.03, d: 0.2, n: 22, g: 0.26, f: 5200, q: 1.8, dec: 0.003, curve: 1.4 });
    }),
  },
  e_sieveTossBig: {
    cap: 2,
    gap: 0.05,
    verb: 0.4,
    play: lift(8, (v) => {
      // the last, biggest flick (played at pitch 0.92: heavier, not lighter): a sub thump under everything …
      thump(v, 0, 78, 52, 0.42, 0.24);
      v.tone('sine', [[0, 70], [0.3, 55, 'e']], { g: [[0, 0], [0.006, 0.3], [0.32, 0.0001, 'e']] });
      // … a heavier knock with a double ring of the hoop …
      hoop(v, 0, 0.75, { f: 240, body: 0.7 });
      thump(v, 0, 104, 72, 0.2, 0.12);
      hoop(v, 0.05, 0.36, { f: 352 });
      v.noise('white', { t: 0.02, g: perc(0.3, 0.012, 0.0003), to: v.filt('highpass', 6000, 0.8) });
      v.crackle({ t: 0.025, d: 0.22, n: 20, g: 0.16, f: 8800, q: 2, dec: 0.002, curve: 1.5 });
      // … a big golden spray, wide, and a long patter back into the bowl
      wash(v, 0.015, 0.95, 0.3, { f: 3300, n: 44, q: 1.8, to: v.panner(-0.35) });
      wash(v, 0.03, 0.8, 0.28, { f: 2900, n: 36, q: 1.8, to: v.panner(0.35) });
      v.crackle({ t: 0.03, d: 0.24, n: 26, g: 0.26, f: 5200, q: 1.8, dec: 0.003, curve: 1.4 });
      // the fountain raining back: a long grain shower tail, thinning over most of a second
      v.crackle({ t: 0.2, d: 0.75, n: 54, g: 0.14, f: 2600, q: 1.3, dec: 0.004, curve: 0.6, to: v.panner(-0.25) });
      v.crackle({ t: 0.26, d: 0.7, n: 40, g: 0.11, f: 3400, q: 1.4, dec: 0.003, curve: 0.6, to: v.panner(0.25) });
      v.noise('pink', { t: 0.18, g: [[0, 0], [0.08, 0.06], [0.75, 0.0001, 'e']], to: v.filt('bandpass', 2700, 1) });
      // a warm swell of light under it (the climax) — a soft fifth, no bell
      v.tone('sine', [[0, 294], [0.4, 330, 'e']], { t: 0.02, g: [[0, 0], [0.03, 0.05], [0.45, 0.0001, 'e']] });
      v.tone('sine', 440, { t: 0.04, g: [[0, 0], [0.04, 0.035], [0.4, 0.0001, 'e']] });
    }),
  },
  e_sieveFall: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(9, (v) => {
      // the thrown grains rain back into the bowl: a soft patter thinning out over half a second
      v.crackle({ d: 0.55, n: 30, g: 0.24, f: 2300, q: 1.2, dec: 0.004, curve: 0.7 });
      v.noise('pink', { g: [[0, 0], [0.05, 0.07], [0.5, 0.0001, 'e']], to: v.filt('bandpass', 2600, 1) });
      thump(v, 0.03, 150, 110, 0.05, 0.15);
    }),
  },
  e_sieveSettle: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(3, (v) => {
      // the sieve sinks low: the hoop meets the air cushion (a soft low bump), the grain hushes once
      thump(v, 0, 120, 80, 0.2, 0.12);
      hoop(v, 0.01, 0.16, { f: 220 });
      const bp = v.filt('bandpass', [[0, 3200], [0.3, 2200, 'e']], 1.1);
      v.noise('pink', { t: 0.02, g: [[0, 0], [0.04, 0.12], [0.34, 0.0001, 'e']], to: bp });
    }),
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
  e_sieveCatch: {
    cap: 3,
    gap: 0.04,
    verb: 0.18,
    play: lift(9, (v) => {
      // a tossed card lands in its hand slot: a soft paper tick (card on card) with one stray grain after it
      v.noise('white', { g: perc(0.2, 0.014, 0.0003), to: v.filt('bandpass', 5200, 1.6) });
      v.noise('pink', { t: 0.004, g: perc(0.1, 0.03, 0.0006), to: v.filt('bandpass', 2400, 1.2) });
      thump(v, 0.002, 340, 260, 0.035, 0.025);
      v.noise('white', { t: 0.07, g: perc(0.05, 0.006, 0.0002), to: v.filt('bandpass', 6800, 3) });
    }),
  },
  e_sieveDrop: {
    cap: 3,
    gap: 0.05,
    verb: 0.28,
    play: lift(4, (v) => {
      // a card falling in: a short paper "fwip" (falling band), then landing flat on grain: a soft "tsk" + a puff
      sweep(v, 0, 0.12, [5200, 3600, 1800], 0.16, { q: 1.3 });
      wash(v, 0.12, 0.26, 0.08, { f: 3000, n: 10 });
      puff(v, 0.12, 0.12, 0.06, 900);
      thump(v, 0.12, 170, 120, 0.07, 0.05);
    }),
  },
  e_sieveStraw: {
    cap: 2,
    gap: 0.05,
    verb: 0.08,
    play: lift(3, (v) => {
      // the card dries into straw: a short, dry CRUNCH above 3 kHz — dense brittle snaps, light and quick (≤ 0.3 s)
      const d = 0.17;
      const hp = v.filt('highpass', 3200, 0.8);
      v.noise('white', { g: [[0, 0], [0.008, 0.2], [0.06, 0.12], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, 4200], [d, 7000, 'e']], 1.1, { to: hp }) });
      v.crackle({ d, n: 34, g: 0.22, f: 4800, q: 1.6, dec: 0.003, curve: 0.8, to: hp });
      v.crackle({ t: 0.01, d: 0.1, n: 14, g: 0.2, f: 3600, q: 1.4, dec: 0.004, curve: 1.2, to: hp });
      // two dry snaps (a stalk breaking)
      v.noise('white', { t: 0.04, g: perc(0.26, 0.008, 0.0002), to: v.filt('bandpass', 4200, 2) });
      v.noise('white', { t: 0.11, g: perc(0.18, 0.007, 0.0002), to: v.filt('bandpass', 5600, 2.2) });
    }),
  },
  e_sieveGustR: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(5, (v) => winnow(v, [-0.6, 0.6])),
  },
  e_sieveGustL: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(5, (v) => winnow(v, [0.6, -0.6])),
  },
  e_sieveGust: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play: lift(5, (v) => winnow(v, [-0.6, 0.6])),
  },
  e_sieveGrave: {
    cap: 2,
    gap: 0.05,
    verb: 0.3,
    play: lift(10, (v) => {
      // straw landing on the pile: a light paper settle and one soft tick
      puff(v, 0, 0.12, 0.05, 2400);
      v.crackle({ d: 0.1, n: 8, g: 0.1, f: 4600, q: 2, dec: 0.003 });
      v.noise('white', { t: 0.02, g: perc(0.12, 0.01, 0.0003), to: v.filt('bandpass', 3800, 3) });
      thump(v, 0, 210, 150, 0.06, 0.04);
    }),
  },
  e_sieveEnd: {
    cap: 1,
    gap: 0.3,
    verb: 0.36,
    play: lift(5, (v) => {
      // the weave unravels: strands plucked out one after another, the pitch running down
      const times = [0, 0.035, 0.068, 0.098, 0.126, 0.152, 0.176, 0.198];
      times.forEach((tt, i) => v.noise('white', { t: tt, g: perc(0.13 - i * 0.008, 0.008, 0.0003), to: v.filt('bandpass', 5000 - i * 330, 3.2) }));
      // the hoop lets go: a last bent-wood creak and a little puff of chaff
      const d = 0.14;
      const bp = v.filt('bandpass', [[0, 700], [d, 460, 'e']], 4);
      const fl = v.flutter(42, 0.9, { d, base: 0.1, to: bp });
      v.noise('white', { t: 0.2, g: [[0, 0], [0.03, 0.2], [d, 0.0001, 'e']], to: fl });
      hoop(v, 0.2, 0.14, { f: 210, body: 0.5 });
      puff(v, 0.26, 0.1, 0.18, 2600, { kind: 'pink' });
      v.tone('sine', [[0, 440], [0.3, 392, 'e']], { t: 0.24, g: [[0, 0], [0.03, 0.018], [0.26, 0.0001, 'e']] });
    }),
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
