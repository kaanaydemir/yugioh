// Hınç Baltası (spite_axe) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Kor çatlaklı, zincirli kara balta, sapında atan damarlar, yere saplı, çevresinde kıvılcımlar." (YENI_KARTLAR §7 S10)
// The image of the scene (src/cinematics/spells/spite_axe.ts): the SAME axe drawing (_spite_axe_motif.ts, its one
// geometry rasterised at the card's scale) planted toe-first in the floor, its blade fanning up-left, the haft
// rising to the upper right; a chain hangs from the pommel down to the floor; ember cracks run out over the floor
// from the bite; ember sparks hang in the air.
//   backdrop  the kit's SPELL recipe (night sky bands, night0 floor, teal1 horizon), its portal light centred behind
//             the head — the spell's light frames the black iron
//   subject   the axe (black iron stone0–stone4 under one top-left light, ink outline; earth haft; stone chain
//             bands), the hanging chain (stone3 / stone2 links on ink), a few floor chips
//   light     never outlined: the floor cracks (fire1 → fire4 near the bite), the sparks; the cracks inside the
//             blade and the rivet glow are the axe's own (the hottest point, the focus, is the rivet)
// Small (44×34): the same geometry painted again at 1× density (the motif at its own small scale: two long cracks,
// one-pixel bands), the chain and cracks redrawn natively — never a reduction.
// Living art: 4 frames × 150 ms: a hot wave runs down the haft's veins (the motif's pulse), the blade's cracks
// flare on the beat, two sparks rise a pixel per frame, the floor cracks' heads blink.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { axeMotif, axeOffset } from '../../cinematics/spells/_spite_axe_motif';
import { paintBackdrop } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

const FRAMES = 4;
/** The planted pose of the card (P1's planted drawing). */
const ANGLE = 120;
/** The axe's scale per density (big, small). */
const SCALE: Readonly<Record<1 | 2, number>> = { 2: 1.42, 1: 0.74 };
/** Where the blade's toe bites the floor, BIG px. */
const TOE = [27, 58] as const;

const q = (v: number, k: number): number => Math.floor((v * k) / 2);

function head(k: 1 | 2): { ox: number; oy: number } {
  const toe = axeOffset({ size: 'lg', angle: ANGLE, scale: SCALE[k] }, 9, 11);
  return { ox: q(TOE[0], k) - toe.x, oy: q(TOE[1], k) - toe.y + (k === 2 ? 3 : 1) };
}

/** The focus: the blade's hottest crack (BIG px). */
function rivet(k: 1 | 2): { x: number; y: number } {
  const h = head(k);
  const r = axeOffset({ size: 'lg', angle: ANGLE, scale: SCALE[k] }, -2, 8);
  return { x: h.ox + r.x, y: h.oy + r.y };
}

const F_BIG = { x: Math.min(75, rivet(2).x), y: Math.min(53, rivet(2).y) };
const F_SMALL = rivet(1);

function link(p: PixelCanvas, x: number, y: number, i: number, k: 1 | 2): void {
  if (k === 1) {
    p.set(x, y, i % 2 ? PAL.stone3 : PAL.stone2);
    return;
  }
  if (i % 2 === 0) {
    p.set(x - 1, y, PAL.stone3);
    p.set(x + 1, y, PAL.stone2);
    p.set(x, y - 1, PAL.stone4);
    p.set(x, y + 1, PAL.stone2);
  } else {
    p.set(x, y, PAL.stone3);
    p.set(x, y + 1, PAL.stone2);
  }
}

function paint(l: ArtLayers, f: number, k: 1 | 2): void {
  const H = l.backdrop.h;
  const W = l.backdrop.w;
  const horizon = q(48, k);
  paintBackdrop(l.backdrop, 'SPELL', { focus: [Math.round((F_BIG.x + 6) ), Math.round(F_BIG.y - 14)], radius: 24 });
  const s = l.subject;
  const lt = l.light;
  // ---- the axe (the scene's drawing at the card's scale)
  const pulse = f % FRAMES;
  const m = axeMotif({ size: 'lg', angle: ANGLE, scale: SCALE[k], pulse, heat: pulse === 0 ? 3 : 2 });
  const h = head(k);
  const cut = q(TOE[1], k) - 1 - h.oy;
  for (let y = 0; y < m.px.h; y++)
    for (let x = 0; x < m.px.w; x++) {
      const c = m.px.get(x, y);
      if (c === null || !m.px.isOpaque(x, y)) continue;
      const wy = h.oy - m.ay + y;
      if (wy - h.oy > cut) continue;
      s.set(h.ox - m.ax + x, wy, c);
    }
  // the floor line where the toe enters: one ink row under the cut
  // ---- the chain from the pommel down to the floor (a sagging line of links)
  const pom = axeOffset({ size: 'lg', angle: ANGLE, scale: SCALE[k] }, -33, 0);
  const p0 = { x: h.ox + pom.x, y: h.oy + pom.y + (k === 2 ? 2 : 1) };
  const p2 = { x: q(76, k), y: q(60, k) };
  const p1 = { x: p0.x + q(14, k), y: p0.y + q(6, k) };
  const step = k === 2 ? 3 : 2;
  let i = 0;
  let last = { x: -99, y: -99 };
  for (let t = 0; t <= 1.0001; t += 0.004) {
    const x = Math.round((1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x);
    const y = Math.round((1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y);
    if (Math.abs(x - last.x) + Math.abs(y - last.y) < step) continue;
    last = { x, y };
    if (y >= H - k) break;
    link(s, x, y, i++, k);
  }
  // the coil where it lies on the floor
  for (let j = 0; j < (k === 2 ? 4 : 2); j++) link(s, p2.x + (j % 2 ? step : -step) + j, p2.y + (j > 1 ? 1 : 0), j, k);
  // floor chips thrown by the bite
  for (const [cx, cy] of [
    [10, 59],
    [36, 61],
    [15, 54],
  ] as const) {
    const x = q(cx, k);
    const y = q(cy, k);
    s.set(x, y, PAL.stone2);
    if (k === 2) s.set(x + 1, y, PAL.stone1);
  }
  s.outline(PAL.ink);
  // the floor line where the toe enters the floor (the subject's contact)
  for (let x = 0; x < W; x++) {
    const y = q(TOE[1], k);
    if (s.isOpaque(x, y - 1) && !s.isOpaque(x, y + 1) && Math.abs(x - q(TOE[0], k)) < q(10, k)) s.set(x, y, PAL.ink);
  }
  // ---- light: the floor cracks out of the bite, the sparks
  const toe = { x: q(TOE[0], k), y: q(TOE[1], k) };
  const cracks: (readonly [number, number])[][] = [
    [
      [0, 0],
      [-5, 2],
      [-9, 2],
      [-14, 5],
      [-19, 6],
    ],
    [
      [0, 0],
      [5, 2],
      [9, 2],
      [13, 5],
      [17, 5],
    ],
    [
      [0, 0],
      [-3, 4],
      [-2, 7],
    ],
  ];
  for (const c of cracks) {
    const pts = c.map(([dx, dy]) => ({ x: toe.x + q(dx * 2, k), y: toe.y + q(dy * 2, k) }));
    let n = 0;
    for (let j = 0; j + 1 < pts.length; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      const len = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      for (let st = 0; st <= len; st++) {
        const x = Math.round(a.x + ((b.x - a.x) * st) / Math.max(1, len));
        const y = Math.round(a.y + ((b.y - a.y) * st) / Math.max(1, len));
        if (y >= H - 1 || x < 1 || x >= W - 1 || s.isOpaque(x, y)) continue;
        n++;
        const hot = n < (k === 2 ? 8 : 4) ? PAL.fire3 : PAL.fire2;
        lt.set(x, y, hot);
      }
    }
    // the crack's head blinks
    const e = pts[pts.length - 1];
    if (f % 2 === 0 && e.y < H - 1 && !s.isOpaque(e.x, e.y)) lt.set(e.x, e.y, PAL.fire4);
  }
  // sparks rising off the blade (a pixel per frame)
  for (const [sx, sy, ph] of [
    [14, 30, 0],
    [36, 20, 2],
    [8, 44, 1],
  ] as const) {
    const y = q(sy, k) - ((f + ph) % FRAMES) * (k === 2 ? 1 : 0) - (k === 1 && (f + ph) % FRAMES >= 2 ? 1 : 0);
    const x = q(sx, k);
    if (s.isOpaque(x, y)) continue;
    lt.set(x, y, (f + ph) % FRAMES === 3 ? PAL.fire3 : PAL.fire4);
    if (k === 2 && !s.isOpaque(x, y + 1)) lt.set(x, y + 1, PAL.fire2);
  }
  void horizon;
}

const art: CardArtV3 = {
  id: 'spite_axe',
  focus: [F_BIG.x, F_BIG.y],
  focusSmall: [F_SMALL.x, F_SMALL.y],
  frames: FRAMES,
  holdMs: 150,
  big(l, f) {
    paint(l, f, 2);
  },
  small(l, f) {
    paint(l, f, 1);
  },
};

export default art;
