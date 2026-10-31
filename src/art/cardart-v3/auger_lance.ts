// Burgu Mızrağı (auger_lance) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Bir kartı delen sarmal oluklu burgu, talaş kıvrımları" (docs/v3/YENI_KARTLAR.md §7 S7), the image of the scene
// (src/cinematics/spells/auger_lance.ts): a steel auger lance screws straight down out of the top of the window
// and drills through a trap card that spins on one corner; steel shavings curl away from the bit.
// ONE key light from the top left on the matter; the drilling point is the only other light.
//   backdrop  the kit's SPELL recipe (mandatory colours): night0 / night1 sky bands, night0 floor; the recipe's
//             light shape laid flat on the floor as a sigil under the card's spinning corner (kit `as: 'sigil'`).
//   lance     matter, ink outlined, bleeding off the top edge: a grooved shaft (mist lit band | steel | night4
//             shade, a SPIRAL groove of night2 with a white lit lip above it, slope ≈ 0.7 px / column), a dark
//             collar with a teal band (the spell driving it), a tapering bit whose tip comes out THROUGH the card.
//   card      matter: a card rolled ~35° standing on its bottom corner, a magenta trap face (mag tones on a night
//             frame), cracks (night0) radiating from the drilled hole; the strike lights its edge teal3 (rim).
//   light     the hot drilling point (a small white / teal4 star where the bit enters), the teal collar band,
//             the shavings: little Archimedean spirals (white curled-in end → mist → steel tail) flung away.
// The small picture (44×34) is the same composition painted again at 1× density by the same code (the lance
// 7 px wide with a 1-px groove every 3 rows, the card 12×17, three curls of 4 px) — not a reduction — then
// corrected by hand (the bit's tip and the hole patched so they read at 1×).
// Living art: 4 frames × 110 ms — the groove scrolls down (the lance turns), the shavings turn, the star pulses.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type XY = readonly [number, number];

/** The drilling point (BIG px): where the bit goes through the card. */
const HIT: XY = [44, 42];
const FRAMES = 4;

interface Geo {
  k: 1 | 2;
  /** lance axis x, tip y (the tip comes out under the hole) */
  ax: number;
  tip: number;
  /** half width of the shaft / the collar; bit length; collar rows */
  hw: number;
  chw: number;
  bit: number;
  collar: readonly [number, number];
  /** groove period (rows) */
  per: number;
  /** card centre, half sizes, roll (rad) */
  cc: XY;
  chx: number;
  chy: number;
  roll: number;
  /** hole radius */
  hole: number;
  curls: readonly { at: XY; size: number; ph: number }[];
}

const BIG: Geo = {
  k: 2,
  ax: 44,
  tip: 50,
  hw: 6,
  chw: 8,
  bit: 16,
  collar: [5, 11],
  per: 6,
  cc: [44, 46],
  chx: 14,
  chy: 19,
  roll: 0.62,
  hole: 3,
  curls: [
    { at: [20, 28], size: 7, ph: 0 },
    { at: [68, 24], size: 7, ph: 2.1 },
    { at: [75, 42], size: 5, ph: 4.0 },
    { at: [11, 45], size: 5, ph: 1.2 },
    { at: [64, 60], size: 4, ph: 3.3 },
    { at: [33, 18], size: 4, ph: 5.1 },
  ],
};

const SMALL: Geo = {
  k: 1,
  ax: 22,
  tip: 25,
  hw: 3,
  chw: 4,
  bit: 8,
  collar: [2, 5],
  per: 4,
  cc: [22, 23],
  chx: 7,
  chy: 10,
  roll: 0.62,
  hole: 1,
  curls: [
    { at: [10, 13], size: 4, ph: 0 },
    { at: [34, 12], size: 4, ph: 2.1 },
    { at: [37, 22], size: 3, ph: 4.0 },
  ],
};

/** The card's corners (rolled rectangle) in canvas px. */
function cardCorners(g: Geo): XY[] {
  const c = Math.cos(g.roll);
  const s = Math.sin(g.roll);
  return (
    [
      [-g.chx, -g.chy],
      [g.chx, -g.chy],
      [g.chx, g.chy],
      [-g.chx, g.chy],
    ] as const
  ).map(([x, y]) => [Math.round(g.cc[0] + x * c - y * s), Math.round(g.cc[1] + x * s + y * c)] as XY);
}

/** Card-local coordinates (u along its width, v along its height, −1..1) of a canvas pixel. */
function cardUV(g: Geo, x: number, y: number): [number, number] {
  const dx = x + 0.5 - g.cc[0];
  const dy = y + 0.5 - g.cc[1];
  const c = Math.cos(g.roll);
  const s = Math.sin(g.roll);
  return [(dx * c + dy * s) / g.chx, (-dx * s + dy * c) / g.chy];
}

function paintCard(p: PixelCanvas, g: Geo): void {
  const one = new PixelCanvas(p.w, p.h);
  one.poly(cardCorners(g).map(([x, y]) => [x, y] as [number, number]), PAL.night3);
  const fr = g.k === 2 ? 0.16 : 0.24;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!one.isOpaque(x, y)) continue;
      const [u, v] = cardUV(g, x, y);
      let c: number = PAL.night3;
      // frame: lit (top-left) night4, shaded night2
      if (Math.abs(u) > 1 - fr || Math.abs(v) > 1 - fr * 0.7) c = u + v < 0 ? PAL.night4 : PAL.night2;
      // the art window: a magenta trap face (mag1 field, mag2 band, a mag3 diamond emblem)
      else if (v < 0.25) {
        c = v < -0.3 ? PAL.mag1 : PAL.mag0;
        if (Math.abs(u) + Math.abs(v + 0.3) * 1.3 < 0.42) c = Math.abs(u) + Math.abs(v + 0.3) * 1.3 < 0.2 ? PAL.mag3 : PAL.mag2;
      } else if (g.k === 2 && (Math.round((v - 0.35) * g.chy) % 3 === 0) && Math.abs(u) < 0.6) c = PAL.night4; // text lines
      one.set(x, y, c);
    }
  // cracks from the hole (night0), 4-connected short lines
  const [hx, hy] = HIT.map((q) => (g.k === 2 ? q : Math.round(q / 2))) as unknown as XY;
  if (g.k === 2) {
    for (const [dx, dy, n] of [
      [-1, -1, 7],
      [1, -2, 6],
      [2, 1, 6],
      [-2, 1, 5],
    ] as const) {
      let x = hx;
      let y = hy;
      for (let i = 0; i < n; i++) {
        if (i % 2 === 0) x += Math.sign(dx);
        else y += Math.sign(dy);
        if (Math.abs(dx) > 1 && i % 3 === 1) x += Math.sign(dx);
        if (one.isOpaque(x, y)) one.set(x, y, PAL.night0);
      }
    }
  }
  p.blit(one, 0, 0);
}

/** The lance: shaft + collar + bit, bleeding off the top edge. `phase` scrolls the spiral groove. */
function paintLance(p: PixelCanvas, g: Geo, phase: number): void {
  const bitTop = g.tip - g.bit;
  for (let y = 0; y <= g.tip; y++) {
    const inCollar = y >= g.collar[0] && y <= g.collar[1];
    const hw = y > bitTop ? Math.floor(((g.tip - y) * (g.hw + 0.6)) / g.bit) : inCollar ? g.chw : g.hw;
    for (let c = -hw; c <= hw; c++) {
      const f = (c + hw) / Math.max(1, 2 * hw);
      let col: number = f < 0.3 ? PAL.mist : f < 0.7 ? PAL.steel : PAL.night4;
      if (inCollar) {
        const cy = y - g.collar[0];
        col = cy === 0 || y === g.collar[1] ? PAL.night2 : f < 0.3 ? PAL.steel : PAL.night3;
      } else {
        const kk = (((y + Math.floor((c + hw) * 0.5) - phase) % g.per) + g.per) % g.per;
        if (kk === 0 || (kk === 1 && g.k === 2)) col = f > 0.75 ? PAL.night1 : PAL.night2;
        else if (kk === 2 && f < 0.75 && g.k === 2) col = f < 0.45 ? PAL.white : PAL.mist;
      }
      p.set(g.ax + c, y, col);
    }
  }
}

const L_KEY: Readonly<Record<string, number>> = { w: PAL.white, t: PAL.teal4, s: PAL.teal3, d: PAL.teal2 };
// prettier-ignore
const STAR_BIG: readonly (readonly string[])[] = [
  ['...s...', '...t...', 'sttwtts', '...t...', '...s...'],
  ['.......', '...t...', '.ttwtt.', '...t...', '.......'],
];
// prettier-ignore
const STAR_SMALL: readonly (readonly string[])[] = [
  ['.t.', 'twt', '.t.'],
  ['...', '.w.', '...'],
];

const C_KEY: Readonly<Record<string, number>> = { w: PAL.white, m: PAL.mist, s: PAL.steel };
// prettier-ignore
const HOOKS: readonly (readonly (readonly string[])[])[] = [
  [['mw.', 's.w', '.mm'], ['.wm', 'w.s', 'mm.']],
  [['.mw', 'm.w', 'sm.'], ['wm.', 'w.m', '.ms']],
];

/** A shaving: an Archimedean spiral of whole pixels, white at its curled-in end, steel at its tail. */
function curl(p: PixelCanvas, at: XY, size: number, rot: number): void {
  // a connected ribbon (4-connected steps between the spiral's samples: no corner-only pixels)
  const n = size * 3;
  let px = NaN;
  let py = NaN;
  for (let j = 0; j <= n; j++) {
    const a = rot + j * 0.42;
    const r = 0.3 + (j * size) / n;
    const x = Math.round(at[0] + Math.cos(a) * r);
    const y = Math.round(at[1] + Math.sin(a) * r * 0.8);
    const c = j < n * 0.25 ? PAL.white : j < n * 0.65 ? PAL.mist : PAL.steel;
    if (!Number.isNaN(px) && Math.abs(x - px) === 1 && Math.abs(y - py) === 1) p.set(x, py, c);
    p.set(x, y, c);
    px = x;
    py = y;
  }
}

function paint(l: ArtLayers, f: number, g: Geo): void {
  const k = g.k;
  const hit: XY = k === 2 ? HIT : [HIT[0] >> 1, HIT[1] >> 1];
  paintBackdrop(l.backdrop, 'SPELL', { focus: [HIT[0], 56], radius: 22, horizon: 52, as: 'sigil' });
  // the card first, the lance over it (it goes in front of the card's upper half and out under the hole)
  paintCard(l.subject, g);
  rim(l.subject, PAL.teal3, { skip: [PAL.mag3, PAL.mag2] });
  paintLance(l.subject, g, f % g.per);
  // the drilled hole: punched through the card round the bit (night0 lip under the shaft)
  for (let y = -g.hole; y <= g.hole; y++)
    for (let x = -g.hole - 1; x <= g.hole + 1; x++) {
      const X = hit[0] + x;
      const Y = hit[1] + y;
      const inShaft = Math.abs(x) <= Math.floor(((g.tip - Y) * (g.hw + 0.6)) / g.bit);
      if (!inShaft && (x * x) / ((g.hole + 1) * (g.hole + 1)) + (y * y) / (g.hole * g.hole) <= 1) l.subject.set(X, Y, PAL.night0);
    }
  ink(l.subject);
  // light: the collar's teal band, the hot point, the shavings
  for (let x = -g.chw + 1; x <= g.chw - 1; x++) l.light.set(g.ax + x, g.collar[0] + (k === 2 ? 2 : 1), f % 2 ? PAL.teal4 : PAL.teal3);
  if (k === 2) for (let x = -g.chw + 1; x <= g.chw - 1; x++) l.light.set(g.ax + x, g.collar[0] + 3, PAL.teal2);
  const stars = k === 2 ? STAR_BIG : STAR_SMALL;
  const st = stars[f % 2];
  patch(l.light, st as string[], L_KEY, hit[0] - (st[0].length >> 1), hit[1] - (st.length >> 1));
  // the bit's cutting edge glows teal4 just above the hole
  l.light.set(g.ax - 1, hit[1] - 2, PAL.teal4);
  l.light.set(g.ax + 1, hit[1] - 2, PAL.teal3);
  if (k === 2) g.curls.forEach((c, i) => curl(l.light, c.at, c.size, c.ph + f * 0.8 * (i % 2 ? -1 : 1)));
  // small (hand-made): a curl at 1× is a 3×3 hook, two poses alternating as it turns
  else g.curls.forEach((c, i) => patch(l.light, HOOKS[(f + i) % 2][i % 2] as string[], C_KEY, c.at[0] - 1, c.at[1] - 1));
}

const art: CardArtV3 = {
  id: 'auger_lance',
  focus: HIT,
  frames: FRAMES,
  holdMs: 110,
  big: (l, f) => paint(l, f, BIG),
  small: (l, f) => paint(l, f, SMALL),
};

export default art;
