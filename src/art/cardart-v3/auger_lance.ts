// Burgu Mızrağı (auger_lance) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Bir kartı delen sarmal oluklu burgu, talaş kıvrımları" (docs/v3/YENI_KARTLAR.md §7 S7), the image of the scene
// (src/cinematics/spells/auger_lance.ts): a steel auger lance, TILTED ~25°, drives down-right THROUGH a trap card:
// its shaft goes in at a bore in the card's face and its bit comes OUT past the card's lower edge in a burst of
// card shards; steel shavings curl away. The piercing reads at a glance: shaft in front, tip out the back.
// ONE key light from the top left on the matter; the drilling points are the only other light.
//   backdrop  the kit's SPELL recipe (mandatory colours): night0 / night1 sky bands, night0 floor; the recipe's
//             light shape laid flat on the floor as a sigil under the exit (kit `as: 'sigil'`).
//   lance     matter, ink outlined, bleeding off the top edge, painted in its own rotated frame: a shaft with a
//             DEEP two-tone helical flute (the groove follows the cylinder — offset ∝ asin(u) — a 2-row night
//             groove with its own shade, a white / mist lit lip above it, mist | steel | night4 body bands), a dark
//             collar (big: one teal band — the spell driving it), a tapering bit; behind the card it is hidden.
//   card      matter: a card rolled ~20°, a thick night frame, a magenta trap face; cracks (night0) out of the bore.
//   shards    matter: four ink-outlined card fragments (magenta / night) flung out of the exit.
//   light     the bore's glowing lip (teal), the exit star (white / teal4), the shavings: SOLID 1-px spiral strokes
//             (white curled-in end → mist → steel tail; never dotted rings).
// The small picture (44×34) is the same composition painted again at 1× density by the same code (shaft 7 px,
// the card's frame 2 px), then corrected by hand: the bit's tip and the exit star patched so the "out the back"
// reads at 1×, two hook-shaped curls.
// Living art: 4 frames × 110 ms — the flute scrolls (the lance turns), the shavings turn, the stars pulse.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type XY = readonly [number, number];

const FRAMES = 4;
/** The exit point (BIG px): where the bit comes out of the card — the focus. */
const EXIT: XY = [61, 46];

interface Geo {
  k: 1 | 2;
  /** the bit's tip; the axis direction (unit, pointing down the lance toward the tip) */
  tip: XY;
  dir: XY;
  /** half widths (shaft / collar), bit length, collar span (distance from the tip), flute lead */
  hw: number;
  chw: number;
  bit: number;
  collar: readonly [number, number];
  per: number;
  /** distance from the tip of the bore (where the shaft enters the card's face) */
  bore: number;
  /** card centre, half sizes, roll, frame width (px) */
  cc: XY;
  chx: number;
  chy: number;
  roll: number;
  frame: number;
  /** shards: centre, size (half), roll */
  shards: readonly { at: XY; s: number; r: number; mag: boolean }[];
  curls: readonly { at: XY; size: number; ph: number }[];
}

const A = (25 * Math.PI) / 180;
const DIR: XY = [Math.sin(A), Math.cos(A)];

const BIG: Geo = {
  k: 2,
  tip: [68, 60],
  dir: DIR,
  hw: 6,
  chw: 8,
  bit: 15,
  collar: [62, 68],
  per: 7,
  bore: 40,
  cc: [42, 32],
  chx: 15,
  chy: 19,
  roll: -0.34,
  frame: 4,
  shards: [
    { at: [76, 46], s: 3, r: 0.5, mag: true },
    { at: [80, 56], s: 2, r: 1.1, mag: false },
    { at: [54, 63], s: 2, r: 0.2, mag: true },
    { at: [70, 64], s: 2, r: 0.9, mag: false },
  ],
  curls: [
    { at: [20, 18], size: 5, ph: 0 },
    { at: [72, 18], size: 5, ph: 2.1 },
    { at: [80, 33], size: 4, ph: 4.0 },
    { at: [18, 44], size: 4, ph: 1.2 },
  ],
};

const SMALL: Geo = {
  k: 1,
  tip: [34, 30],
  dir: DIR,
  hw: 3,
  chw: 4,
  bit: 8,
  collar: [31, 34],
  per: 4,
  bore: 20,
  cc: [21, 16],
  chx: 8,
  chy: 10,
  roll: -0.34,
  frame: 2,
  shards: [
    { at: [39, 24], s: 1, r: 0.5, mag: true },
    { at: [38, 30], s: 1, r: 0.2, mag: false },
  ],
  curls: [
    { at: [9, 12], size: 3, ph: 0 },
    { at: [37, 10], size: 3, ph: 2.1 },
  ],
};

/** A rolled rectangle's corners. */
function rect(c: XY, hx: number, hy: number, roll: number): [number, number][] {
  const co = Math.cos(roll);
  const si = Math.sin(roll);
  return (
    [
      [-hx, -hy],
      [hx, -hy],
      [hx, hy],
      [-hx, hy],
    ] as const
  ).map(([x, y]) => [Math.round(c[0] + x * co - y * si), Math.round(c[1] + x * si + y * co)]);
}

/** Card-local coordinates (u along its width, v along its height, −1..1) of a canvas pixel. */
function cardUV(g: Geo, x: number, y: number): [number, number] {
  const dx = x + 0.5 - g.cc[0];
  const dy = y + 0.5 - g.cc[1];
  const c = Math.cos(g.roll);
  const s = Math.sin(g.roll);
  return [(dx * c + dy * s) / g.chx, (-dx * s + dy * c) / g.chy];
}

/** The axis point at distance `a` from the tip. */
function axisAt(g: Geo, a: number): XY {
  return [g.tip[0] - g.dir[0] * a, g.tip[1] - g.dir[1] * a];
}

function paintCard(p: PixelCanvas, g: Geo): void {
  const one = new PixelCanvas(p.w, p.h);
  one.poly(rect(g.cc, g.chx, g.chy, g.roll), PAL.night3);
  const fu = g.frame / g.chx;
  const fv = g.frame / g.chy;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      if (!one.isOpaque(x, y)) continue;
      const [u, v] = cardUV(g, x, y);
      let c: number = PAL.night3;
      // a thick frame: lit (top-left) night4, shaded night2, one night3 inner line
      if (Math.abs(u) > 1 - fu || Math.abs(v) > 1 - fv) c = u - v < -0.4 || (v < 0 && u < 0.6) ? PAL.night4 : PAL.night2;
      else if (Math.abs(u) > 1 - fu * 1.6 || Math.abs(v) > 1 - fv * 1.6) c = PAL.night3;
      // the art window: a magenta trap face (mag1 field, mag0 lower band, a mag3 / mag2 diamond emblem)
      else if (v < 0.3) {
        c = v < -0.25 ? PAL.mag1 : PAL.mag0;
        const dd = Math.abs(u + 0.15) + Math.abs(v + 0.32) * 1.3;
        if (dd < 0.42) c = dd < 0.2 ? PAL.mag3 : PAL.mag2;
      } else if (g.k === 2 && Math.round((v - 0.4) * g.chy) % 3 === 0 && u > -0.7 && u < 0.4) c = PAL.night4; // text lines
      one.set(x, y, c);
    }
  p.blit(one, 0, 0);
}

/** Lance pixel colour at local (a from the tip, c across: − = lit left side), or null outside it. */
function lanceAt(g: Geo, a: number, c: number, phase: number): number | null {
  if (a < -0.5) return null;
  const inCollar = a >= g.collar[0] && a <= g.collar[1];
  const hw = a < g.bit ? ((a + 0.5) * (g.hw + 0.5)) / g.bit : inCollar ? g.chw : g.hw;
  if (Math.abs(c) > hw + 0.5) return null;
  const u = Math.max(-1, Math.min(1, c / (hw + 0.5)));
  const body = u < -0.4 ? PAL.mist : u < 0.35 ? PAL.steel : PAL.night4;
  if (inCollar) {
    const ca = Math.floor(a - g.collar[0]);
    if (g.k === 2 && (ca === 2 || ca === 3)) return u < 0.2 ? PAL.teal3 : PAL.teal2;
    return ca === 0 ? PAL.night2 : u < -0.4 ? PAL.steel : PAL.night3;
  }
  // the helical flute (the groove bends round the cylinder: offset ∝ asin(u))
  const off = ((g.per * Math.asin(u)) / Math.PI) * 0.9;
  const k = (((Math.floor(a + off + phase) % g.per) + g.per) % g.per) as number;
  const gw = g.k === 2 ? 2 : 1;
  if (k < gw) return k === 0 ? (u > 0.3 ? PAL.night1 : PAL.night2) : u < -0.3 ? PAL.night3 : PAL.night2;
  if (k === gw) return u < -0.1 ? PAL.white : u < 0.45 ? PAL.mist : PAL.steel;
  return body;
}

/** The lance in its rotated frame; behind the card (below the bore) it is hidden where the card is. */
function paintLance(p: PixelCanvas, g: Geo, phase: number, card: PixelCanvas): void {
  const nx = g.dir[1];
  const ny = -g.dir[0];
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - g.tip[0];
      const dy = y + 0.5 - g.tip[1];
      const a = -(dx * g.dir[0] + dy * g.dir[1]);
      const c = -(dx * nx + dy * ny);
      const col = lanceAt(g, a, c, phase);
      if (col === null) continue;
      if (a < g.bore && card.isOpaque(x, y)) continue; // inside the card / behind it
      p.set(x, y, col);
    }
}

/** A card shard: a small rolled triangle-ish chip (magenta face or night frame). */
function shard(p: PixelCanvas, at: XY, s: number, r: number, mag: boolean): void {
  const pts = rect(at, s + 1, s, r).slice(0, 3);
  p.poly(pts, mag ? PAL.mag2 : PAL.night4);
  if (s > 1) p.set(Math.round(at[0]), Math.round(at[1]), mag ? PAL.mag1 : PAL.night2);
}

/** A shaving: a solid 1-px spiral stroke (4-connected), white at its curled-in end, steel at its tail. */
function curl(p: PixelCanvas, at: XY, size: number, rot: number): void {
  const n = size * 3;
  const turn = 7 / n;
  let px = NaN;
  let py = NaN;
  for (let j = 0; j <= n; j++) {
    const a = rot + j * turn;
    const r = 0.6 + (j * size) / n;
    const x = Math.round(at[0] + Math.cos(a) * r);
    const y = Math.round(at[1] + Math.sin(a) * r * 0.8);
    if (x === px && y === py) continue;
    const c = j < n * 0.25 ? PAL.white : j < n * 0.65 ? PAL.mist : PAL.steel;
    // walk from the last sample with 4-connected steps (x first, then y): one solid stroke, no gaps
    if (!Number.isNaN(px)) {
      let wx = px;
      let wy = py;
      while (wx !== x || wy !== y) {
        if (wx !== x && (Math.abs(x - wx) >= Math.abs(y - wy) || wy === y)) wx += Math.sign(x - wx);
        else wy += Math.sign(y - wy);
        p.set(wx, wy, c);
      }
    }
    p.set(x, y, c);
    px = x;
    py = y;
  }
}

const L_KEY: Readonly<Record<string, number>> = { w: PAL.white, t: PAL.teal4, s: PAL.teal3, d: PAL.teal2 };
// prettier-ignore
const EXIT_BIG: readonly (readonly string[])[] = [
  ['....s....', '....t....', '.d..t..d.', '..ttwtt..', 'sttwwwtts', '..ttwtt..', '.d..t..d.', '....t....', '....s....'],
  ['.........', '....s....', '....t....', '...twt...', '.stwwwts.', '...twt...', '....t....', '....s....', '.........'],
];
// prettier-ignore
const EXIT_SMALL: readonly (readonly string[])[] = [
  ['..s..', '..t..', 'stwts', '..t..', '..s..'],
  ['.....', '..t..', '.twt.', '..t..', '.....'],
];
const C_KEY: Readonly<Record<string, number>> = { w: PAL.white, m: PAL.mist, s: PAL.steel };
// prettier-ignore
const HOOKS: readonly (readonly string[])[] = [
  ['.mm.', 'm..s', 'mw.s', '.ss.'],
  ['.ss.', 's.wm', 's..m', '.mm.'],
];

function paint(l: ArtLayers, f: number, g: Geo): void {
  const k = g.k;
  const exit: XY = k === 2 ? EXIT : [EXIT[0] >> 1, EXIT[1] >> 1];
  paintBackdrop(l.backdrop, 'SPELL', { focus: [EXIT[0], 58], radius: 20, horizon: 52, as: 'sigil' });
  const card = new PixelCanvas(l.subject.w, l.subject.h);
  paintCard(card, g);
  // cracks from the bore (night0), short jagged lines
  const bore = axisAt(g, g.bore);
  const bx = Math.round(bore[0]);
  const by = Math.round(bore[1]);
  for (const [dx, dy, n] of (k === 2
    ? [
        [-1, -1, 8],
        [1, -1, 6],
        [-1, 1, 9],
        [1, 1, 5],
      ]
    : [
        [-1, -1, 3],
        [-1, 1, 4],
      ]) as [number, number, number][]) {
    let x = bx + dx * (g.hw - 1);
    let y = by;
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) x += dx;
      else y += dy;
      if (card.isOpaque(x, y)) card.set(x, y, PAL.night0);
    }
  }
  l.subject.blit(card, 0, 0);
  paintLance(l.subject, g, f % g.per, card);
  // the bore: a dark crescent round the shaft where it goes in (the hole's far wall), on the card only
  const nx = g.dir[1];
  const ny = -g.dir[0];
  for (let c = -g.hw - 2; c <= g.hw + 2; c++) {
    for (let d = 0; d <= (k === 2 ? 2 : 1); d++) {
      const x = Math.round(bore[0] + nx * c + g.dir[0] * d);
      const y = Math.round(bore[1] + ny * c + g.dir[1] * d);
      if (Math.abs(c) <= g.hw && d === 0) continue;
      if (card.isOpaque(x, y)) l.subject.set(x, y, PAL.night0);
    }
  }
  for (const s of g.shards) shard(l.subject, s.at, s.s, s.r + f * 0.1, s.mag);
  ink(l.subject);
  // light: the bore's glowing lip (teal, just outside the dark wall, below the shaft)
  for (let c = -g.hw - 1; c <= g.hw + 1; c++) {
    const d = k === 2 ? 3 : 2;
    const x = Math.round(bore[0] + nx * c + g.dir[0] * d);
    const y = Math.round(bore[1] + ny * c + g.dir[1] * d);
    if (card.isOpaque(x, y)) l.light.set(x, y, Math.abs(c) < 3 ? (f % 2 ? PAL.teal4 : PAL.white) : PAL.teal3);
  }
  // the exit star where the bit bursts out of the card's lower edge + the bit's hot tip
  const st = (k === 2 ? EXIT_BIG : EXIT_SMALL)[f % 2];
  patch(l.light, st as string[], L_KEY, exit[0] - (st[0].length >> 1), exit[1] - (st.length >> 1));
  l.light.set(g.tip[0], g.tip[1], PAL.white);
  if (k === 2) {
    l.light.set(g.tip[0] - 1, g.tip[1] - 1, PAL.teal4);
    // the burst's rays: four short teal lines flung down-right out of the exit
    for (const [dx, dy, n] of [
      [1, 0, 5],
      [1, 1, 4],
      [0, 1, 3],
      [2, -1, 3],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const x = exit[0] + 6 + i * dx + (dx === 2 ? i : 0);
        const y = exit[1] + 2 + i * dy;
        if (!l.subject.isOpaque(x, y)) l.light.set(x, y, i < 2 ? PAL.teal4 : PAL.teal2);
      }
    }
    g.curls.forEach((c, i) => curl(l.light, c.at, c.size, c.ph + f * 0.8 * (i % 2 ? -1 : 1)));
  } else {
    // small (hand-made): two 4×4 hook curls turning, and the tip patched to read out the back of the card
    g.curls.forEach((c, i) => patch(l.light, HOOKS[(f + i) % 2] as string[], C_KEY, c.at[0] - 2, c.at[1] - 2));
  }
}

const art: CardArtV3 = {
  id: 'auger_lance',
  focus: EXIT,
  frames: FRAMES,
  holdMs: 110,
  big: (l, f) => paint(l, f, BIG),
  small: (l, f) => paint(l, f, SMALL),
};

export default art;
