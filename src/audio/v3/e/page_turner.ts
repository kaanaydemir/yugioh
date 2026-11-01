// Lane E sounds — page_turner (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S11 Sayfa Çeviren): the main colour is the PAPER FLUTTER (a riffle: a train of dry page flaps, each
// one a short band of noise with its own little air pocket); the material is a LEATHER-BOUND BOOK + INK (a low leather
// creak, the dull board of the cover, quill scratches); the separating layer is the shutting "PAT": a hard, dry,
// broadband clap of two boards with a short ROOM answer (an early reflection at 45 ms + a small hall), nothing tonal.
// Kept apart from: S4 Süpürge Rüzgarı (a wide L→R wind with paper and leaves: our wind is a short gust inside the
// riffle only, our paper is single flaps), S5 Elek (6 Hz grain: no grain here), S9 (long straw rustle), S12 (wooden
// tak-tak: our knocks are dull leather boards, never a ringing wood), and every glass sound (no bar modes at all: the
// runes are soft sine breaths).
//   e_pageBirth   the closed book forms in the air: a gathered breath and the dull drop of a heavy leather tome
//   e_pageOpen    the cover swings open: a leather creak (slow rough pulse train) + a page rustle + the board landing
//   e_pageSlip    a hand card leaves the hand as a page: a quick, light paper "fwip" (pitch per card)
//   e_pageBind    a page is bound into the book: a paper slap "şap" with a small board knock (pitch per card)
//   e_pageInhale  the book draws breath before shutting: both boards lift, air rushes in (a rising swell)
//   e_pagePat     THE SHUT: "PAT" — two boards clapping, dry and hard, with a room answer
//   e_pageRiffle  the book riffles its own pages in a gust: a train of flaps accelerating then slowing, wind under it
//   e_pageLeaf    a pressed page settles on a graveyard: a soft dry "tss" and a feather-light tick
//   e_pageInk     ink stars bloom on the fresh spread: three quill scratches and a soft ink-breath chord
//   e_pageFold    a new page folds into a card: crisp origami crease ticks (two creases, a press)
//   e_pageShut    the book closes softly at the end: a muffled leather bump (no clap, no room)
//   e_pageRunes   the book comes apart into runes: an ink "pfft", rising soft sine motes, an airy release

import type { Recipe } from '../../sounds';
import type { Voice } from '../../synth';
import { perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** One page flap: a short band of noise (dry paper) with a little low air pocket under it. */
function flap(v: Voice, t: number, g: number, o: { f?: number; d?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 2600;
  const d = o.d ?? 0.028;
  v.noise('white', { t, g: [[0, 0], [0.003, g], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f * 0.8], [d, f * 1.25, 'e']], 1.6, { t, to: o.to }) });
  v.noise('pink', { t, g: perc(g * 0.5, d * 1.4, 0.004), to: v.filt('lowpass', 700, 0.8, { t, to: o.to }) });
}

/** The dull board of a leather cover meeting something: a low, short, non-ringing knock. */
function board(v: Voice, t: number, g: number, o: { f?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 150;
  thump(v, t, f * 1.4, f * 0.7, g, 0.07, { to: o.to });
  v.noise('pink', { t, g: perc(g * 0.7, 0.03, 0.001), to: v.filt('bandpass', 420, 1.1, { t, to: o.to }) });
}

/** Leather creak: noise through a slow rough pulse train in a narrow mid band (gliding up). */
function creak(v: Voice, t: number, d: number, g: number, f0: number, f1: number, rate = 38): void {
  const bp = v.filt('bandpass', [[0, f0], [d, f1, 'e']], 5, { t });
  const fl = v.flutter(rate, 0.95, { t, d, base: 0.05, to: bp });
  v.noise('white', { t, g: [[0, 0], [d * 0.25, g], [d * 0.8, g * 0.7], [d, 0.0001, 'e']], to: fl });
  v.tone('sawtooth', [[0, f0 * 0.25], [d, f1 * 0.25, 'e']], { t, g: [[0, 0], [d * 0.3, g * 0.05], [d, 0.0001, 'e']], to: v.filt('bandpass', f0, 3, { t }) });
}

/** A quill scratch: a fine, gritty, high stroke (rising or falling). */
function quill(v: Voice, t: number, d: number, g: number, f0: number, f1: number): void {
  v.crackle({ t, d, n: Math.max(4, Math.round(d * 160)), g: g * 0.7, f: (f0 + f1) / 2, q: 2.2, dec: 0.003 });
  v.noise('white', { t, g: [[0, 0], [d * 0.2, g * 0.4], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f0], [d, f1, 'e']], 4, { t }) });
}

/**
 * The riffle's page schedule (ms from its start; shared with the scene so every turning page has its flap): 14 pages,
 * 46 ms apart at the ends, 20 ms in the blur of the middle.
 */
export const RIFFLE_TIMES: readonly number[] = (() => {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < 14; i++) {
    out.push(Math.round(t));
    t += 46 - 26 * Math.sin((i / 13) * Math.PI);
  }
  return out;
})();

export const RECIPES = {
  e_pageBirth: {
    cap: 1,
    gap: 0.2,
    verb: 0.35,
    play(v) {
      // the book gathers out of the orb: a short breath in (rising air) …
      sweep(v, 0, 0.16, [700, 1800, 2600], 0.16, { q: 1.2, kind: 'pink', peakAt: 0.85 });
      // … and the heavy tome takes its weight: a dull board drop, a leather settle
      board(v, 0.15, 0.5, { f: 120 });
      puff(v, 0.16, 0.18, 0.12, 900);
      // a warm low hum of the spell under it (two sines a fifth apart, soft)
      v.tone('sine', 196, { t: 0.12, g: [[0, 0], [0.05, 0.05], [0.4, 0.0001, 'e']] });
      v.tone('sine', 294, { t: 0.14, g: [[0, 0], [0.06, 0.03], [0.36, 0.0001, 'e']] });
    },
  },
  e_pageOpen: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the leather spine creaks as the board swings (a slow rough train gliding up) …
      creak(v, 0, 0.2, 0.32, 380, 640, 34);
      // … the pages riffle once as they fall open …
      flap(v, 0.1, 0.22, { f: 3000, d: 0.05 });
      flap(v, 0.135, 0.16, { f: 3600, d: 0.04 });
      // … and the cover board lands flat
      board(v, 0.19, 0.34, { f: 135 });
    },
  },
  e_pageSlip: {
    cap: 6,
    gap: 0.03,
    verb: 0.2,
    vary: 0.04,
    play(v) {
      // a card peels out of the hand and flattens into a page: a light upward paper swish
      sweep(v, 0, 0.11, [1800, 4200, 5200], 0.24, { q: 1.4, peakAt: 0.35 });
      v.noise('white', { t: 0.004, g: perc(0.08, 0.008, 0.0003), to: v.filt('highpass', 6000, 0.8) });
    },
  },
  e_pageBind: {
    cap: 6,
    gap: 0.025,
    verb: 0.25,
    vary: 0.03,
    play(v) {
      // "şap": the page slaps onto the stack (flat, papery, a hint of the board under it)
      flap(v, 0, 0.42, { f: 2100, d: 0.035 });
      v.noise('white', { t: 0.001, g: perc(0.2, 0.006, 0.0002), to: v.filt('bandpass', 4800, 1.4) });
      board(v, 0.002, 0.16, { f: 170 });
    },
  },
  e_pageInhale: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // both boards lift: air pulled in between the pages, rising and tightening to the clap
      sweep(v, 0, 0.16, [500, 1600, 3400], 0.22, { q: 1.1, kind: 'pink', peakAt: 0.95 });
      creak(v, 0.02, 0.12, 0.14, 520, 760, 50);
    },
  },
  e_pagePat: {
    cap: 1,
    gap: 0.15,
    verb: 0.55,
    duck: 0.35,
    play(v) {
      // PAT — two boards clapping: a very hard broadband transient (two micro-strikes 2 ms apart) …
      const room = v.echo(0.045, 0.22, { wet: 0.32, tone: 2600 });
      const hit = v.filt('bandpass', 1500, 0.55);
      hit.connect(room);
      v.noise('white', { g: perc(1.7, 0.03, 0.0002), to: hit });
      v.noise('white', { t: 0.002, g: perc(0.95, 0.018, 0.0002), to: v.filt('highpass', 2600, 0.7) });
      // … the trapped air bursting out of the pages (a short low puff) …
      puff(v, 0, 0.5, 0.06, 1100, { kind: 'white', att: 0.0005 });
      // … and the body of the closed tome (dull, dry: a quick low drop, no ring)
      thump(v, 0, 140, 52, 0.48, 0.08, { drive: 1.6 });
      // the paper inside settles a beat later
      flap(v, 0.07, 0.07, { f: 3200, d: 0.05 });
    },
  },
  e_pageRiffle: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the book flips through itself: one flap per page the scene turns (RIFFLE_TIMES), accelerating to a blur and
      // slowing to the last page
      const times = RIFFLE_TIMES.map((ms) => ms / 1000);
      const t = times[times.length - 1] + 0.04;
      const N = times.length - 1;
      const L = v.panner(-0.35);
      const R = v.panner(0.35);
      times.forEach((tt, i) => flap(v, tt, 0.26 * (0.75 + 0.25 * Math.sin((i / N) * Math.PI)), { f: 2300 + (i % 4) * 420, d: 0.022, to: i % 2 ? R : L }));
      // the gust that turns them (a short wind breath, inside the riffle, not a wide sweep)
      sweep(v, 0, t + 0.06, [600, 1500, 900], 0.12, { q: 0.9, kind: 'pink', peakAt: 0.4 });
      // the very last page lands
      flap(v, t + 0.01, 0.2, { f: 1900, d: 0.06 });
    },
  },
  e_pageLeaf: {
    cap: 6,
    gap: 0.03,
    verb: 0.3,
    vary: 0.05,
    play(v) {
      // a pressed, dry page settles on the pile: soft air "tss" and a feather tick
      v.noise('pink', { g: [[0, 0], [0.02, 0.17], [0.16, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3800], [0.16, 2400, 'e']], 1.3) });
      v.noise('white', { t: 0.012, g: perc(0.07, 0.01, 0.0005), to: v.filt('bandpass', 5200, 2) });
      puff(v, 0.01, 0.06, 0.05, 600);
    },
  },
  e_pageInk: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // three quill strokes write the fresh pages …
      quill(v, 0, 0.07, 0.16, 3400, 4600);
      quill(v, 0.08, 0.06, 0.13, 4200, 3300);
      quill(v, 0.15, 0.08, 0.12, 3600, 5000);
      // … and the ink blooms into stars: a soft, breathy triad on triangles (no glass, no bell)
      [523, 659, 784].forEach((f, i) => v.tone('triangle', f, { t: 0.04 + i * 0.05, g: [[0, 0], [0.04, 0.035], [0.32, 0.0001, 'e']] }));
      v.noise('pink', { t: 0.04, g: [[0, 0], [0.08, 0.04], [0.36, 0.0001, 'e']], to: v.filt('bandpass', 5200, 2) });
    },
  },
  e_pageFold: {
    cap: 6,
    gap: 0.03,
    verb: 0.22,
    vary: 0.04,
    play(v) {
      // origami: two crisp creases and the press of the finished card
      v.noise('white', { g: perc(0.4, 0.006, 0.0002), to: v.filt('bandpass', 5600, 2.4) });
      v.noise('white', { t: 0.045, g: perc(0.34, 0.006, 0.0002), to: v.filt('bandpass', 6400, 2.4) });
      flap(v, 0.085, 0.12, { f: 3000, d: 0.02 });
      v.tone('sine', [[0, 1320], [0.05, 1180, 'e']], { t: 0.09, g: perc(0.03, 0.05, 0.002) });
    },
  },
  e_pageShut: {
    cap: 1,
    gap: 0.2,
    verb: 0.2,
    play(v) {
      // the quiet close: a short swing of air and a muffled leather bump (no clap, no room)
      sweep(v, 0, 0.1, [700, 1400, 900], 0.08, { q: 1.1, kind: 'pink', peakAt: 0.8 });
      thump(v, 0.09, 110, 60, 0.24, 0.08);
      puff(v, 0.09, 0.22, 0.08, 700);
    },
  },
  e_pageRunes: {
    cap: 1,
    gap: 0.2,
    verb: 0.5,
    play(v) {
      // the leather lets go: an ink "pfft" …
      puff(v, 0, 0.2, 0.09, 2400, { kind: 'white' });
      // … rune motes rise as soft sine breaths, a pentatonic run upward …
      [587, 659, 784, 880, 1047, 1175].forEach((f, i) => v.tone('sine', f, { t: 0.04 + i * 0.045, g: [[0, 0], [0.03, 0.03], [0.22, 0.0001, 'e']] }));
      // … carried off by an airy release
      sweep(v, 0.02, 0.5, [1200, 3600, 6000], 0.07, { q: 1, kind: 'pink', peakAt: 0.3 });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
