// Lane E sounds — page_turner (docs/v3/YENI_KARTLAR.md §5.1, §7). Owned by this card's builder: add recipes here only.
// Names are prefixed 'e_' + a short card key (e.g. e_wellCrank) so no name collides with another lane.
// Built from ./../kit.ts blocks and the Voice primitives (src/audio/synth.ts). Aggregated by ../lane-e.ts.
//
// Identity (§5.1 S11 Sayfa Çeviren): the main colour is the PAPER FLUTTER — single page flaps, each a sharp 1.5-ms
// paper edge tick near 6.5 kHz, a fast downward "thwip" glide (5 → 1.8 kHz in 20 ms) and a tiny 90–120 Hz air
// pocket; the riffle is a TRAIN of these fired by the scene one per turning page (so it stays in sync with the
// pictures at every speed), over a narrow, quiet gust bed. The material is a LEATHER-BOUND BOOK + INK (a low leather
// creak, the dull board of the cover, quill scratches); the separating layer is the shutting "PAT": a hard, dry
// book clap of two boards: a 250–600 Hz board body, a low air burst out of the page edges and a short, dark, boxy
// slap-back (30 ms) — nothing tonal, no bright slap band (that is glass / wood / hand-clap territory).
// Kept apart from: S4 Süpürge Rüzgarı (a wide L→R broadband wind with paper and leaves: our gust is a narrow, quiet
// band only under the riffle and the colour is the flap's edge + glide), S5 Elek (6 Hz grain: none here), S9 (long
// straw rustle), S12 (wooden tak-tak: our knocks are dull leather boards, never a ringing wood), and every glass sound
// (no bar modes: the runes are soft sine breaths).
//   e_pageBirth    the closed book forms in the air: a gathered breath and the dull drop of a heavy leather tome
//   e_pageOpen     the cover swings open: a leather creak (slow rough pulse train) + a page rustle
//   e_pageBoard    the swung board lands flat (fired on the frame it reaches the table)
//   e_pageSlip     a hand card leaves the hand as a page: a quick, light paper "fwip" (pitch per card)
//   e_pageBind     a page is bound into the book: a paper slap "şap" with a small board knock (pitch per card)
//   e_pageInhale   the book draws breath before shutting: both boards lift, air rushes in (a rising swell)
//   e_pagePat      THE SHUT: "PAT" — a heavy book clapping shut: low board body, air burst, a boxy slap-back
//   e_pageStrain   the shut tome strains against itself: one dull leather knock per rattle step (pitch rising)
//   e_pageFlap     one turning page of the riffle (the main colour); e_pageFlapStiff: every third, a heavier leaf
//   e_pageGust     the narrow gust bed under the riffle (start / stop on the riffle's first and last page)
//   e_pageLand     the riffle's last page lands flat
//   e_pageLeaf     a pressed page settles on a graveyard: a soft dry "tss" and a feather-light tick
//   e_pageInk      ink stars bloom on the fresh spread: three quill scratches and a soft ink-breath chord
//   e_pageFold     a fresh page peels up off the spread; e_pageCrease per crease step, e_pagePress on the press
//   e_pageTuck     a fresh card tucks into its hand (pitch per card)
//   e_pageFizzle   short deck: a starved page crumples and flops back; the empty deck puffs
//   e_pageDust     both hands empty: dust lifts from the bare gutter
//   e_pageShut     the book closes softly at the end: a muffled leather bump (no clap, no room)
//   e_pageInkline  the birth: the cover's outline inks itself (two quill strokes down both sides, runes ticking on)
//   e_pageTear     one band of the cover peels off at the end (a leather creak-tear, fired per band)
//   e_pageGlint    the clasp's last gold glint as its band peels (a tiny dry buckle tink)
//   e_pageRunes    the book comes apart into runes: an ink "pfft", four leather creak-tears, a breathy vowel glide up

import type { Recipe } from '../../sounds';
import type { Pt, Voice } from '../../synth';
import { perc } from '../../synth';
import { puff, sweep, thump } from '../kit';

/** One page flap (used inside other recipes): a short band of noise (dry paper) with a little low air pocket. */
function flap(v: Voice, t: number, g: number, o: { f?: number; d?: number; to?: AudioNode } = {}): void {
  const f = o.f ?? 2600;
  const d = o.d ?? 0.028;
  v.noise('white', { t, g: [[0, 0], [0.003, g], [d, 0.0001, 'e']], to: v.filt('bandpass', [[0, f * 0.8], [d, f * 1.25, 'e']], 1.6, { t, to: o.to }) });
  v.noise('pink', { t, g: perc(g * 0.5, d * 1.4, 0.004), to: v.filt('lowpass', 700, 0.8, { t, to: o.to }) });
}

/**
 * THE PAGE FLAP — the card's main colour (one turning page). Not wind: a sharp 1.5-ms paper EDGE tick (a narrow band
 * near 6.5 kHz), a fast downward "thwip" (a resonant band gliding 5 kHz → 1.8 kHz in 20 ms: the sheet cutting the
 * air), and a tiny 90–120 Hz air pocket under it (the page slapping the air flat). `stiff`: a heavier leaf — a double
 * edge tick, a shorter, higher glide and a firmer pocket.
 */
function pageFlap(v: Voice, t: number, g: number, stiff = false): void {
  const tick = stiff ? 7400 : 6500;
  v.noise('white', { t, g: perc(g * 0.9, 0.0016, 0.0002), to: v.filt('bandpass', tick, 3.2, { t }) });
  if (stiff) v.noise('white', { t: t + 0.004, g: perc(g * 0.6, 0.0014, 0.0002), to: v.filt('bandpass', tick * 0.86, 3.2, { t }) });
  const [f0, f1, d] = stiff ? [6000, 2400, 0.015] : [5000, 1800, 0.02];
  v.noise('white', { t: t + 0.001, g: [[0, 0], [0.0015, g * 0.75], [d, g * 0.18, 'e'], [d + 0.012, 0.0001, 'e']], to: v.filt('bandpass', [[0, f0], [d, f1, 'e']], 4.5, { t: t + 0.001 }) });
  v.tone('sine', [[0, stiff ? 125 : 115], [0.03, stiff ? 95 : 88, 'e']], { t: t + 0.003, g: perc(g * (stiff ? 0.32 : 0.22), 0.03, 0.002) });
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
 * The riffle's page schedule (SCENE ms from its start): 14 pages, 46 ms apart at the ends, 20 ms in the blur of the
 * middle. The scene turns its pages on it and fires one e_pageFlap / e_pageFlapStiff as each page leaves the block,
 * so the flaps follow the scene clock (the v3 tempo and 2× / 3×) instead of a baked schedule.
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
      // (the board landing is e_pageBoard, fired by the scene on the frame the board reaches the table)
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
      sweep(v, 0, 0.16, [500, 1600, 3400], 0.36, { q: 1.1, kind: 'pink', peakAt: 0.95 });
      creak(v, 0.02, 0.12, 0.24, 520, 760, 50);
    },
  },
  e_pagePat: {
    cap: 1,
    gap: 0.15,
    verb: 0.2,
    duck: 0.35,
    play(v) {
      // PAT — a heavy BOOK clapping shut, not a hand clap: the energy sits LOW and DRY. The room answer is a short,
      // dark, boxy slap-back (30 ms, low-passed) — no bright glass / wood ring.
      const room = v.echo(0.03, 0.16, { wet: 0.3, tone: 1100 });
      // everything runs through a dark lowpass: a leather board has no bright slap band
      const dark = v.filt('lowpass', 1500, 0.7);
      const dark2 = v.filt('lowpass', 1500, 0.7, { to: dark });
      dark.connect(room);
      // the two boards meeting: a dense 250–600 Hz board body (two layers, the far board 4 ms late) …
      v.noise('white', { g: perc(4.2, 0.09, 0.0005), to: v.filt('bandpass', 520, 1.4, { to: dark2 }) });
      v.noise('white', { t: 0.004, g: perc(2.0, 0.06, 0.0005), to: v.filt('bandpass', 380, 1.6, { to: dark2 }) });
      v.noise('pink', { t: 0.001, g: perc(1.6, 0.05, 0.0005), to: v.filt('bandpass', 640, 1.8, { to: dark2 }) });
      // … the sheets' air squeezed out of the fore-edge: a short, high, papery "ffft" (above 5 kHz only, ~40 ms) …
      v.noise('white', { t: 0.002, g: [[0, 0], [0.004, 0.32], [0.045, 0.0001, 'e']], to: v.filt('bandpass', [[0, 7200], [0.045, 5200, 'e']], 2.2) });
      // … the trapped air bursting out of the page edges: a low, wide air puff …
      puff(v, 0.003, 1.3, 0.13, 800, { kind: 'pink', att: 0.002, to: dark });
      // … and the weight of the closed tome: a quick, dull low drop, slightly driven (no ring)
      thump(v, 0, 330, 200, 0.55, 0.08, { drive: 2.2, to: dark });
      thump(v, 0.002, 520, 380, 0.4, 0.04, { to: dark });
      // the paper inside settles a beat later (a soft low riffle, under 2 kHz)
      flap(v, 0.08, 0.08, { f: 900, d: 0.06, to: dark });
    },
  },
  e_pageFlap: {
    cap: 8,
    gap: 0.008,
    verb: 0.18,
    vary: 0.05,
    play(v) {
      // one page of the riffle turns (fired by the scene as each page leaves the block: synced at every speed)
      pageFlap(v, 0, 0.46);
    },
  },
  e_pageFlapStiff: {
    cap: 8,
    gap: 0.008,
    verb: 0.18,
    vary: 0.04,
    play(v) {
      // every third page is a heavier leaf: a double edge tick, a stiffer, shorter glide
      pageFlap(v, 0, 0.52, true);
    },
  },
  e_pageGust: {
    cap: 1,
    gap: 0.2,
    verb: 0.2,
    play(v) {
      // the gust under the riffle (started on the riffle's first page, stopped on its last): a NARROW band of air
      // (never a broadband sweep: that is S4's wind) whose flutter follows RIFFLE_TIMES — slow at the ends, fastest in
      // the blur of the middle — and swells with it
      const n = RIFFLE_TIMES.length;
      const span = (RIFFLE_TIMES[n - 1] + 130) / 1000;
      const mid = span * 0.5;
      const bp = v.filt('bandpass', [[0, 1100], [mid, 1750, 'e'], [span + 0.2, 1150, 'e']], 3);
      const fl = v.filt('lowpass', 5000, 0.7, { to: bp });
      // the flutter: one gain swell per page turn, on the page schedule itself
      const gEnv: Pt[] = [[0, 0]];
      RIFFLE_TIMES.forEach((ms, i) => {
        const t = ms / 1000;
        const pk = 0.16 + 0.14 * Math.sin((i / (n - 1)) * Math.PI);
        gEnv.push([t + 0.004, pk]);
        gEnv.push([t + 0.016, pk * 0.45, 'e']);
      });
      gEnv.push([span, 0.12]);
      gEnv.push([span + 0.3, 0.0001, 'e']);
      v.noise('pink', { g: gEnv, to: fl });
      // a steady narrow whistle of air through the gutter under it (very soft)
      v.noise('white', { g: [[0, 0], [mid, 0.05], [span + 0.25, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2300], [mid, 2700, 'e'], [span, 2200, 'e']], 9) });
    },
  },
  e_pageLand: {
    cap: 1,
    gap: 0.1,
    verb: 0.3,
    play(v) {
      // the riffle's very last page lands flat: a long thwip and a soft paper slap on the stack
      pageFlap(v, 0, 0.6);
      flap(v, 0.012, 0.3, { f: 1900, d: 0.06 });
      board(v, 0.016, 0.14, { f: 190 });
    },
  },
  e_pageBoard: {
    cap: 2,
    gap: 0.06,
    verb: 0.3,
    play(v) {
      // the swung cover board lands flat (fired when the board reaches the table: synced at every speed)
      board(v, 0, 0.42, { f: 135 });
      flap(v, 0.004, 0.14, { f: 2400, d: 0.04 });
    },
  },
  e_pageStrain: {
    cap: 4,
    gap: 0.01,
    verb: 0.22,
    play(v) {
      // the shut tome strains: one dull leather knock of the board against its clasp (pitch rises per knock)
      board(v, 0, 0.36, { f: 160 });
      v.noise('white', { t: 0.002, g: perc(0.06, 0.012, 0.0005), to: v.filt('bandpass', 1800, 2) });
    },
  },
  e_pageCrease: {
    cap: 8,
    gap: 0.006,
    verb: 0.2,
    vary: 0.04,
    play(v) {
      // one origami crease snapping in (fired on fold steps 1 and 2)
      v.noise('white', { g: perc(0.9, 0.006, 0.0002), to: v.filt('bandpass', 5600, 2.4) });
      v.noise('white', { t: 0.003, g: perc(0.3, 0.012, 0.0005), to: v.filt('bandpass', [[0, 4200], [0.012, 2600, 'e']], 3) });
    },
  },
  e_pagePress: {
    cap: 8,
    gap: 0.006,
    verb: 0.22,
    vary: 0.03,
    play(v) {
      // the folded page is pressed into a card (fold step 3, the white press): a firm paper snap and a small glint
      v.noise('white', { g: perc(0.5, 0.005, 0.0002), to: v.filt('bandpass', 6400, 2.4) });
      flap(v, 0.004, 0.22, { f: 3000, d: 0.02 });
      v.tone('sine', [[0, 1320], [0.05, 1180, 'e']], { t: 0.008, g: perc(0.05, 0.06, 0.002) });
    },
  },
  e_pageTuck: {
    cap: 8,
    gap: 0.01,
    verb: 0.15,
    vary: 0.03,
    play(v) {
      // a fresh card tucks into its hand: a soft, short paper slide and a muted tap (pitch per card)
      v.noise('white', { g: [[0, 0], [0.012, 0.26], [0.05, 0.0001, 'e']], to: v.filt('bandpass', [[0, 2600], [0.05, 4200, 'e']], 1.8) });
      v.noise('pink', { t: 0.04, g: perc(0.5, 0.02, 0.001), to: v.filt('bandpass', 900, 1.2) });
      thump(v, 0.04, 260, 180, 0.08, 0.03);
    },
  },
  e_pageFizzle: {
    cap: 2,
    gap: 0.1,
    verb: 0.25,
    play(v) {
      // a starved page: it crumples (a short dry crackle), flops back down and the empty deck puffs a little dust
      v.crackle({ d: 0.12, n: 14, g: 0.22, f: 3200, q: 1.8, dec: 0.004 });
      flap(v, 0.13, 0.32, { f: 1400, d: 0.07 });
      thump(v, 0.15, 170, 100, 0.12, 0.05);
      puff(v, 0.2, 0.12, 0.12, 700);
    },
  },
  e_pageDust: {
    cap: 2,
    gap: 0.1,
    verb: 0.35,
    play(v) {
      // dust lifts out of an empty gutter: a dry, soft breath, a few motes ticking
      puff(v, 0, 0.2, 0.22, 1500);
      v.crackle({ t: 0.03, d: 0.2, n: 6, g: 0.05, f: 5200, q: 2.5, dec: 0.003 });
    },
  },
  e_pageLeaf: {
    cap: 6,
    gap: 0.03,
    verb: 0.3,
    vary: 0.05,
    play(v) {
      // a pressed, dry page settles on the pile: soft air "tss" and a feather tick
      v.noise('pink', { g: [[0, 0], [0.02, 0.34], [0.16, 0.0001, 'e']], to: v.filt('bandpass', [[0, 3800], [0.16, 2400, 'e']], 1.3) });
      v.noise('white', { t: 0.012, g: perc(0.16, 0.01, 0.0005), to: v.filt('bandpass', 5200, 2) });
      puff(v, 0.01, 0.14, 0.05, 600);
    },
  },
  e_pageInk: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // three quill strokes write the fresh pages …
      quill(v, 0, 0.07, 0.28, 3400, 4600);
      quill(v, 0.08, 0.06, 0.24, 4200, 3300);
      quill(v, 0.15, 0.08, 0.22, 3600, 5000);
      // … and the ink blooms into stars: a soft, breathy triad on triangles (no glass, no bell)
      [523, 659, 784].forEach((f, i) => v.tone('triangle', f, { t: 0.04 + i * 0.05, g: [[0, 0], [0.04, 0.06], [0.32, 0.0001, 'e']] }));
      v.noise('pink', { t: 0.04, g: [[0, 0], [0.08, 0.04], [0.36, 0.0001, 'e']], to: v.filt('bandpass', 5200, 2) });
    },
  },
  e_pageFold: {
    cap: 6,
    gap: 0.03,
    verb: 0.22,
    vary: 0.04,
    play(v) {
      // a fresh page peels up off the spread (the creases and the press are e_pageCrease / e_pagePress, fired on
      // the fold's own steps): a quick rising paper peel and a soft lift of air
      sweep(v, 0, 0.07, [2200, 4800, 5600], 0.3, { q: 1.6, peakAt: 0.55 });
      v.noise('white', { t: 0.002, g: perc(0.2, 0.004, 0.0002), to: v.filt('bandpass', 6000, 2.4) });
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
  e_pageInkline: {
    cap: 1,
    gap: 0.2,
    verb: 0.3,
    play(v) {
      // the birth: the cover's outline is INKED in the air — two quill strokes racing down both sides (a fine gritty
      // scratch gliding down), the runes ticking onto the line, a short breath of the spell under it
      quill(v, 0, 0.13, 0.26, 5200, 3400);
      quill(v, 0.012, 0.12, 0.2, 4600, 3000);
      [0.03, 0.06, 0.085, 0.11].forEach((t, i) => v.noise('white', { t, g: perc(0.12 - i * 0.015, 0.004, 0.0002), to: v.filt('bandpass', 6800 - i * 300, 3) }));
      sweep(v, 0, 0.18, [900, 2000, 1500], 0.07, { q: 1.4, kind: 'pink', peakAt: 0.6 });
    },
  },
  e_pageTear: {
    cap: 4,
    gap: 0.02,
    verb: 0.25,
    vary: 0.03,
    play(v) {
      // one band of the leather cover peels off: a short leather creak-tear and a dry ink tick (pitch per band)
      creak(v, 0, 0.055, 0.24, 300, 540, 90);
      v.noise('white', { t: 0.004, g: perc(0.1, 0.006, 0.0003), to: v.filt('bandpass', 4600, 2) });
      puff(v, 0.01, 0.08, 0.05, 900);
    },
  },
  e_pageGlint: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // the clasp's last gold glint: a tiny dry metal "tink" of the buckle (very short, inharmonic) and a breath
      v.tone('triangle', [[0, 3150], [0.08, 3080, 'e']], { g: perc(0.07, 0.09, 0.001) });
      v.tone('sine', 4710, { t: 0.002, g: perc(0.035, 0.06, 0.001) });
      v.noise('white', { g: perc(0.08, 0.004, 0.0002), to: v.filt('highpass', 7000, 0.8) });
      sweep(v, 0.01, 0.22, [3000, 5200, 4400], 0.04, { q: 2, kind: 'pink', peakAt: 0.3 });
    },
  },
  e_pageRunes: {
    cap: 1,
    gap: 0.2,
    verb: 0.45,
    play(v) {
      // the leather lets go: an ink "pfft" …
      puff(v, 0, 0.2, 0.09, 2400, { kind: 'white' });
      // (the four bands' leather tears are e_pageTear, fired by the scene on each band)
      // … and the runes rise as BREATH, not notes: a breathy upward formant glide (vowel "oo" → "ee" in noise),
      // with no pitch steps and no scale (pip notes belong to S12)
      const f1 = v.filt('bandpass', [[0, 340], [0.55, 470, 'e']], 14);
      const f2 = v.filt('bandpass', [[0, 1400], [0.55, 2900, 'e']], 16);
      const breath: Pt[] = [[0, 0], [0.12, 0.9], [0.36, 0.5], [0.66, 0.0001, 'e']];
      v.noise('pink', { t: 0.05, g: breath, to: f1 });
      v.noise('pink', { t: 0.05, g: breath, to: f2 });
      // quill-scribble motes: tiny dry ticks drifting up and away
      v.crackle({ t: 0.12, d: 0.34, n: 9, g: 0.05, f: 6400, q: 3, dec: 0.002 });
    },
  },
} satisfies Record<string, Recipe>;
export type Sfx = keyof typeof RECIPES;
