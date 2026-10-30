// Sihirli Şapka (magic_hat) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// A bare stage: three violet top hats with gold bands in a row on dark boards, ONE spotlight cone falling on
// them from above, a tiny gold star hovering over the middle hat, curtain folds at both sides. No characters.
// The picture of the trap that hides the attacked monster among decoys: three identical hats, the foe must guess.
//   backdrop  the kit's TRAP sky bands (night0 / night1) and mag1 horizon line, the light shape being the cone
//             itself (kit `shape: false`): a two-step stepped cone (night2 outer, night3 inner) falling from a
//             narrow lamp to the boards, its flat floor pool in the same two steps (ellipses), the boards'
//             plank lines in night1 and the hats' contact shadows in night0. Backdrop <= 6 tones.
//   subject   curtain drapes at both edges (mag0 / mag1 / mag2 fold bands, a diagonal swag at the top, ink
//             outlined; the right drape one step darker) and three hats, back to front (middle one further back),
//             each ink outlined: brim ellipse and crown in three flat planes under the top-left key light
//             (void3 lit / void2 / void1 shadow), a lit crown top (void3 + void4 glint), a gold band that follows
//             the curved base (gold3 / gold2 / gold1) and one shadow-side rim in night4 (the cone's bounce).
//   light     never outlined: the star (gold4 core, gold3 arms, gold2 tips) and dust motes drifting up the cone.
// Small (44x34): the same picture drawn again at 1x density (KART_RESIMLERI §1 (2)) with its own measures.
// Living art: 4 frames x 150 ms, palette only, <= 1 px motion: the star bobs and twinkles, the motes climb.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, rampStep, rim, shape } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';

/** The picture's focus (the star over the middle hat) in BIG px. */
const FOCUS = [44, 26] as const;

interface HatDims {
  /** brim half width / half height */
  readonly brx: number;
  readonly bry: number;
  /** crown width at the base / at the top, and its height above the brim centre */
  readonly bw: number;
  readonly tw: number;
  readonly ch: number;
  /** gold band height */
  readonly band: number;
}

interface Cfg {
  readonly hz: number;
  readonly hat: HatDims;
  /** hats back to front: centre x, brim centre y */
  readonly hats: readonly (readonly [number, number])[];
  /** floor pool: centre, half widths of its two steps, half height of the outer */
  readonly pool: readonly [number, number, number, number, number];
  /** cone: apex y, lamp half width (outer / inner), footing y, footing half width (outer / inner) */
  readonly cone: readonly [number, number, number, number, number, number];
  readonly plank: readonly number[];
  readonly curtain: number;
  readonly star: readonly [number, number];
  readonly motes: readonly (readonly [number, number])[];
}

const CFG: Readonly<Record<Size, Cfg>> = {
  big: {
    hz: 44,
    hat: { brx: 12, bry: 4, bw: 16, tw: 14, ch: 19, band: 5 },
    hats: [
      [44, 52],
      [19, 57],
      [69, 57],
    ],
    pool: [44, 53, 34, 22, 8],
    cone: [0, 4, 2, 44, 32, 20],
    plank: [49, 55, 61],
    curtain: 9,
    star: [44, 21],
    motes: [
      [31, 24],
      [58, 30],
      [38, 36],
      [52, 18],
    ],
  },
  small: {
    hz: 22,
    hat: { brx: 6, bry: 2, bw: 8, tw: 7, ch: 9, band: 2 },
    hats: [
      [22, 26],
      [9, 29],
      [35, 29],
    ],
    pool: [22, 26, 17, 11, 4],
    cone: [0, 2, 1, 22, 16, 10],
    plank: [25, 29],
    curtain: 5,
    star: [22, 9],
    motes: [
      [16, 12],
      [29, 15],
      [19, 18],
    ],
  },
};

// ---------------------------------------------------------------- hats

/** One hat on its own canvas, ink outlined: brim, crown in three planes, lit top, curved gold band. */
function hat(size: Size, cx: number, by: number, d: HatDims): PixelCanvas {
  const big = size === 'big';
  const p = new PixelCanvas(big ? 88 : 44, big ? 68 : 34);
  const hw = d.bw / 2;
  // 1. the brim: a flat ellipse, lit on the left, in shadow on the right
  for (let y = by - d.bry; y <= by + d.bry; y++)
    for (let x = cx - d.brx; x <= cx + d.brx; x++) {
      const nx = (x + 0.5 - cx - 0.5) / (d.brx + 0.5);
      const ny = (y + 0.5 - by - 0.5) / (d.bry + 0.5);
      if (nx * nx + ny * ny > 1) continue;
      p.set(x, y, nx < -0.45 ? PAL.void2 : nx > 0.5 ? PAL.void0 : PAL.void1);
    }
  // 2. the crown: tapering rows, bounded below by the curved base (a half ellipse in front of the brim)
  const baseRy = big ? 2 : 1;
  const ybot = (x: number): number => {
    const nx = (x + 0.5 - cx - 0.5) / hw;
    return by + Math.round(baseRy * Math.sqrt(Math.max(0, 1 - nx * nx)));
  };
  const topY = by - d.ch;
  // the crown's shadow on the brim: one void0 row under the curved base
  for (let x = cx - hw; x < cx + hw; x++) if (p.get(x, ybot(x) + 1) !== null) p.set(x, ybot(x) + 1, PAL.void0);
  const col = (i: number, w: number, lit: number, mid: number, dark: number): number =>
    i < Math.max(1, Math.round(w * 0.28)) ? lit : i >= Math.round(w * 0.7) ? dark : mid;
  for (let y = topY; y <= by + baseRy; y++) {
    const t = y >= by ? 1 : (y - topY) / (by - topY);
    const w = Math.round(d.tw + (d.bw - d.tw) * t);
    const x0 = cx - Math.floor(w / 2);
    for (let i = 0; i < w; i++) {
      const x = x0 + i;
      const yb = ybot(x);
      if (y > yb) continue;
      const inBand = y > yb - d.band;
      p.set(x, y, inBand ? col(i, w, PAL.gold3, PAL.gold2, PAL.gold1) : col(i, w, PAL.void3, PAL.void2, PAL.void1));
    }
  }
  // the band's lit top edge and its buckle (a gold4 glint on the lit side)
  const gx = cx - Math.floor(d.tw / 2) + (big ? 2 : 1);
  p.set(gx, ybot(gx) - d.band + 1, PAL.gold4);
  if (big) p.set(gx, ybot(gx) - d.band + 2, PAL.gold4);
  // 3. the crown top: a lit ellipse with a void4 glint
  const trx = d.tw / 2;
  const tr = big ? 2 : 1;
  for (let y = topY - tr; y <= topY + tr; y++)
    for (let x = cx - Math.floor(d.tw / 2); x < cx - Math.floor(d.tw / 2) + d.tw; x++) {
      const nx = (x + 0.5 - cx - 0.5) / (trx + 0.25);
      const ny = (y + 0.5 - topY - 0.5) / (tr + 0.5);
      if (nx * nx + ny * ny <= 1) p.set(x, y, nx > 0.55 ? PAL.void2 : PAL.void3);
    }
  p.set(cx - Math.floor(d.tw / 4) - 1, topY, PAL.void4);
  if (big) p.set(cx - Math.floor(d.tw / 4), topY, PAL.void4);
  ink(p);
  // 4. the shadow-side rim (the cone's bounce), never over the gold
  rim(p, PAL.night4, { skip: [PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] });
  return p;
}

// ---------------------------------------------------------------- curtains

/** The left drape on its own canvas (mirrored and darkened for the right): fold bands and a diagonal swag. */
function drape(size: Size): PixelCanvas {
  const big = size === 'big';
  const C = CFG[size];
  const p = new PixelCanvas(big ? 88 : 44, big ? 68 : 34);
  const w = C.curtain;
  // fold columns, outer edge -> inner: shadow, mid, lit crest, mid, shadow, mid
  const folds = big
    ? [PAL.mag1, PAL.mag1, PAL.mag2, PAL.mag2, PAL.mag1, PAL.mag1, PAL.mag0, PAL.mag0, PAL.mag1, PAL.mag0]
    : [PAL.mag1, PAL.mag2, PAL.mag1, PAL.mag0, PAL.mag1];
  for (let x = 0; x < w; x++) p.vline(x, 0, p.h - 1, folds[x]);
  // the swag: a gathered drape across the top corner, diagonal bands
  const sw: readonly (readonly [number, number])[] = big
    ? [
        [0, 0],
        [30, 0],
        [22, 6],
        [14, 12],
        [w - 1, 22],
        [0, 22],
      ]
    : [
        [0, 0],
        [15, 0],
        [11, 3],
        [7, 6],
        [w - 1, 11],
        [0, 11],
      ];
  shape(p, sw.map(([x, y]) => (big ? [x, y] : [x * 2, y * 2]) as readonly [number, number]), PAL.mag1);
  const per = big ? 6 : 3;
  const swagTones = [PAL.mag1, PAL.mag2, PAL.mag1, PAL.mag0];
  for (let y = 0; y < (big ? 23 : 12); y++)
    for (let x = 0; x < (big ? 31 : 16); x++) {
      if (p.get(x, y) === null) continue;
      if (x < w && y > (big ? 20 : 10)) continue;
      // only inside the swag polygon: pixels that the folds did not already own are repainted by the shape
      if (!inSwag(x, y, sw)) continue;
      p.set(x, y, swagTones[Math.floor((x + 2 * y) / per) % 4]);
    }
  return ink(p);
}

function inSwag(x: number, y: number, pts: readonly (readonly [number, number])[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// ---------------------------------------------------------------- painters

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const B = l.backdrop;
  const W = B.w;
  const H = B.h;
  // 1. backdrop: the TRAP bands, the cone is the one light shape
  paintBackdrop(B, 'TRAP', { focus: FOCUS, horizon: big ? C.hz : C.hz * 2, shape: false });
  const [apex, lampO, lampI, footY, footO, footI] = C.cone;
  const cx = W / 2;
  const cone = (lamp: number, foot: number, tone: number): void => {
    const poly: [number, number][] = [
      [cx - lamp, apex],
      [cx + lamp, apex],
      [cx + foot, footY],
      [cx - foot, footY],
    ];
    B.poly(poly, tone);
  };
  cone(lampO, footO, PAL.night2);
  cone(lampI, footI, PAL.night3);
  // boards: the floor below the horizon, plank lines, the lit pool in two steps
  B.rect(0, C.hz, W, H - C.hz, PAL.night0);
  B.hline(0, W - 1, C.hz, PAL.mag1);
  for (const y of C.plank) B.hline(0, W - 1, y, PAL.night1);
  const [px0, py0, prO, prI, pry] = C.pool;
  B.ellipse(px0 + 0.5, py0 + 0.5, prO, pry, PAL.night2);
  B.ellipse(px0 + 0.5, py0 + 0.5, prI, Math.max(1, Math.round(pry * 0.65)), PAL.night3);
  for (const y of C.plank) {
    // plank lines read through the pool as one step darker
    for (let x = 0; x < W; x++) {
      const c = B.get(x, y);
      if (c === PAL.night2) B.set(x, y, PAL.night1);
      else if (c === PAL.night3) B.set(x, y, PAL.night2);
    }
  }
  // contact shadows under the hats
  for (const [hx, hy] of C.hats) B.ellipse(hx + 0.5, hy + (big ? 3 : 1) + 0.5, C.hat.brx + 1, big ? 3 : 1, PAL.night0);
  // 2. subject: drapes, then the hats back to front
  const left = drape(size);
  l.subject.blit(left, 0, 0);
  l.subject.blit(left.flippedX().map((c) => rampStep(c, -1)), 0, 0);
  for (const [hx, hy] of C.hats) l.subject.blit(hat(size, hx, hy, C.hat), 0, 0);
  // 3. light: the star and the motes
  const bob = [0, -1, 0, 0][f % 4];
  const [sx, sy0] = C.star;
  const sy = sy0 + bob;
  const L = l.light;
  if (big) {
    L.vline(sx, sy - 3, sy + 3, PAL.gold3);
    L.hline(sx - 3, sx + 3, sy, PAL.gold3);
    L.set(sx, sy - 3, PAL.gold2).set(sx, sy + 3, PAL.gold2).set(sx - 3, sy, PAL.gold2).set(sx + 3, sy, PAL.gold2);
    L.vline(sx, sy - 1, sy + 1, PAL.gold4).hline(sx - 1, sx + 1, sy, PAL.gold4);
    if (f % 4 === 2) {
      // twinkle: the diagonal arms
      for (const [dx, dy] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) L.set(sx + dx, sy + dy, PAL.gold2);
    }
  } else {
    L.vline(sx, sy - 1, sy + 1, PAL.gold3).hline(sx - 1, sx + 1, sy, PAL.gold3);
    L.set(sx, sy, PAL.gold4);
    if (f % 4 === 2) L.set(sx, sy - 2, PAL.gold2).set(sx, sy + 2, PAL.gold2);
  }
  // motes drifting up the cone (only over empty backdrop)
  C.motes.forEach(([mx, my], i) => {
    const up = ((f + i) % 4) * (big ? 2 : 1);
    if (l.subject.get(mx, my - up) === null) L.set(mx, my - up, i % 2 ? PAL.night4 : PAL.mist);
  });
}

const art: CardArtV3 = {
  id: 'magic_hat',
  focus: FOCUS,
  frames: 4,
  holdMs: 150,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
