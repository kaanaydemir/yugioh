// Şafak Kılıçları (dawn_swords) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// Lane E repaint (round 3): the picture now previews the new signature — THE GILDED DAWN CAGE. Front view of the
// cage: a row of bars where every other bar is a silver DAWN SWORD planted point-down (steel blade, gilded guard
// under the top rail, a pommel above it) between plain gilded rods; over the middle a birdcage DOME with a small
// dawn-sun finial, a low vault over the sides; the DOOR in the middle (two heavy stiles, a middle rail) and on it
// the hero, the glowing PADLOCK with its three lit tongue bolts. Behind the bars a horned beast stands COLD (water
// tones, a pale rim, breath mist) — the caged foe. The dawn sun of the spell backdrop rises behind the dome.
// (The previous picture — a ring of blades — is frozen for the old look in src/art/cardart/dawn_swords.ts.)
//   backdrop  the spell recipe in dawn colours (shape 'sun', ≤ 6 tones): night1 / night2 sky, a stepped gold sun
//             behind the dome, a night2 floor with a gold2 horizon line.
//   subject   the cold beast (water1 / water2, water3 lit edge), then the cage over it (one ink outline each).
//   light     never outlined: the beast's eyes and breath, the padlock's glow rays, the blade glints, the sun
//             finial's rays, motes and stars.
// Small (44×34): the same composition drawn again at 1× by hand (1-px bars, a 7 × 5 lock with three 1-px bolts).
// Living art: 4 frames × 150 ms: a glint runs down the swords, the bolts' glow steps, the breath puffs, the
// finial's rays swap, motes climb.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, shape, type BackdropRecipe } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';

/** The picture's focus (the padlock) in BIG px. */
const FOCUS = [44, 42] as const;

const DAWN: BackdropRecipe = {
  kind: 'SPELL',
  shape: 'sun',
  tones: [PAL.gold1, PAL.gold2, PAL.gold3],
  sky: [PAL.night1, PAL.night2],
  split: 22,
  floor: PAL.night2,
  horizonLine: PAL.gold2,
  rim: PAL.gold2,
};

/** Plot an arc of the ellipse (cx, cy, rx, ry) from a0 to a1 (rad, 0 = right, π/2 = up) in tone c. */
function arc(p: PixelCanvas, cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, c: number): void {
  const n = Math.max(24, Math.round((rx + ry) * 4));
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.set(Math.round(cx + Math.cos(a) * rx), Math.round(cy - Math.sin(a) * ry), c);
  }
}

// ---------------------------------------------------------------- the cold beast behind the bars

/** The caged beast's silhouette (small px): broad shoulders, a horned head. */
const BEAST: readonly (readonly [number, number])[] = [
  [10, 31], [11, 25], [14, 22], [18, 20], [18, 16], [17, 12], [16, 7], [19, 10], [21, 9], [23, 9], [25, 10], [28, 7], [27, 12], [26, 16], [26, 20], [30, 22], [33, 25], [34, 31],
];

function beast(size: Size): PixelCanvas {
  const k = size === 'big' ? 2 : 1;
  const p = new PixelCanvas(44 * k, 34 * k);
  // (kit shape() takes BIG coordinates for both sizes)
  shape(p, BEAST.map(([x, y]) => [x * 2, y * 2] as const), PAL.water1);
  // the lit edge (top-left): water3, then a water2 band inside it on the big one
  const lit = (x: number, y: number) => p.get(x, y) !== null && (p.get(x - 1, y) === null || p.get(x, y - 1) === null);
  const edge: [number, number][] = [];
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (lit(x, y)) edge.push([x, y]);
  for (const [x, y] of edge) p.set(x, y, PAL.water3);
  if (k === 2) for (const [x, y] of edge) if (p.get(x + 1, y + 1) === PAL.water1) p.set(x + 1, y + 1, PAL.water2);
  // the frost band on the lower body
  for (let x = 0; x < p.w; x++) if (p.get(x, 28 * k) === PAL.water1) p.set(x, 28 * k, PAL.water2);
  return ink(p);
}

// ---------------------------------------------------------------- the cage

interface Geo {
  k: number;
  top: number;
  foot: number;
  x0: number;
  x1: number;
  swords: number[];
  rods: number[];
  doorL: number;
  doorR: number;
  mid: number;
  dome: { cx: number; cy: number; rx: number; ry: number };
}

function geo(size: Size): Geo {
  const k = size === 'big' ? 2 : 1;
  return {
    k,
    top: 12 * k,
    foot: 30 * k,
    x0: 4 * k,
    x1: 40 * k - (k - 1),
    swords: [6, 14, 30, 38].map((x) => x * k),
    rods: [10, 34].map((x) => x * k),
    doorL: 17 * k,
    doorR: 27 * k,
    mid: 22 * k,
    dome: { cx: 22 * k, cy: 12 * k, rx: 7 * k, ry: 9 * k },
  };
}

/** A silver sword point-down from the top rail to the foot: steel blade, gilded guard, grip and pommel above. */
function sword(p: PixelCanvas, G: Geo, x: number, tip: number, guard: number): void {
  if (G.k === 2) {
    for (let y = guard + 1; y <= tip; y++) {
      const d = tip - y;
      if (d < 2) p.set(x, y, PAL.white);
      else if (d < 4) p.set(x - 1, y, PAL.white).set(x, y, PAL.mist);
      else p.set(x - 1, y, PAL.white).set(x, y, d > 6 && d < 22 ? PAL.steel : PAL.mist).set(x + 1, y, PAL.steel);
    }
    p.hline(x - 4, x + 4, guard, PAL.gold3).set(x - 4, guard, PAL.gold4).set(x + 4, guard, PAL.gold2);
    p.hline(x - 3, x + 3, guard - 1, PAL.gold2);
    for (let y = guard - 2; y > guard - 6; y--) p.set(x, y, y % 2 ? PAL.gold1 : PAL.gold2);
    p.hline(x - 1, x + 1, guard - 6, PAL.gold3).set(x - 1, guard - 6, PAL.gold4);
    p.hline(x - 1, x + 1, guard - 7, PAL.gold2);
  } else {
    for (let y = guard + 1; y <= tip; y++) p.set(x, y, tip - y < 2 ? PAL.white : PAL.mist);
    p.hline(x - 1, x + 1, guard, PAL.gold3).set(x - 1, guard, PAL.gold4);
    p.set(x, guard - 1, PAL.gold1);
    p.set(x, guard - 2, PAL.gold3);
  }
}

function cage(size: Size): PixelCanvas {
  const G = geo(size);
  const k = G.k;
  const p = new PixelCanvas(44 * k, 34 * k);
  const { cx, cy, rx, ry } = G.dome;
  // the low side vaults and the dome (behind the top rail): the dome's outer arc, two ribs, the centre rib
  const sideRy = 2 * k;
  arc(p, (G.x0 + G.doorL - 2 * k) / 2, G.top, (G.doorL - 2 * k - G.x0) / 2, sideRy, 0, Math.PI, PAL.gold2);
  arc(p, (G.doorR + 2 * k + G.x1) / 2, G.top, (G.x1 - G.doorR - 2 * k) / 2, sideRy, 0, Math.PI, PAL.gold2);
  arc(p, cx, cy, rx, ry, 0, Math.PI, PAL.gold3);
  if (k === 2) arc(p, cx, cy, rx - 1, ry - 1, 0.15, Math.PI - 0.15, PAL.gold4);
  arc(p, cx, cy, Math.round(rx / 2), ry, 0, Math.PI, PAL.gold2);
  p.vline(cx, cy - ry, cy, PAL.gold3);
  // the dome's base band
  p.hline(cx - rx, cx + rx, cy - k, PAL.gold3);
  // the finial: a small sun disc on the crown
  const fy = cy - ry - 2 * k;
  if (k === 2) {
    p.disc(cx, fy, 3, PAL.gold3);
    p.set(cx - 1, fy - 1, PAL.gold4).set(cx - 2, fy, PAL.gold4).set(cx - 1, fy, PAL.white);
    p.set(cx + 2, fy + 1, PAL.gold2).set(cx + 1, fy + 2, PAL.gold2);
  } else {
    p.hline(cx - 1, cx + 1, fy, PAL.gold3).set(cx, fy - 1, PAL.gold4).set(cx - 1, fy, PAL.gold4);
  }
  // the rods
  for (const x of G.rods) {
    p.vline(x, G.top, G.foot, PAL.gold3);
    if (k === 2) p.vline(x + 1, G.top, G.foot, PAL.gold1);
  }
  // the swords: their pommels stand above the top rail
  for (const x of G.swords) sword(p, G, x, G.foot - 1, G.top + 2 * k);
  // the door: two heavy stiles, a middle rail, its own sword
  for (const x of [G.doorL, G.doorR]) {
    p.vline(x, G.top, G.foot, PAL.gold4);
    if (k === 2) p.vline(x + 1, G.top, G.foot, PAL.gold3).vline(x - 1, G.top, G.foot, PAL.white);
  }
  sword(p, G, G.mid, G.foot - 1, G.top + 2 * k);
  // corner posts (with a ball on top)
  for (const x of [G.x0, G.x1]) {
    p.vline(x, G.top - k, G.foot + k - 1, PAL.gold4);
    if (k === 2) p.vline(x + 1, G.top - 2, G.foot + 1, PAL.gold2);
    if (k === 2) p.rect(x - 1, G.top - 5, 4, 3, PAL.gold3).set(x - 1, G.top - 5, PAL.gold4);
    else p.set(x, G.top - 2, PAL.gold3);
  }
  // the rails (over the bars)
  for (const [y, lit, shade] of [
    [G.top, PAL.gold4, PAL.gold2],
    [G.foot, PAL.gold3, PAL.gold1],
  ] as const) {
    p.hline(G.x0, G.x1 + k - 1, y, lit);
    if (k === 2) p.hline(G.x0, G.x1 + 1, y + 1, shade);
  }
  // the door's middle rail
  const my = 21 * k;
  p.hline(G.doorL, G.doorR + k - 1, my, PAL.gold3);
  if (k === 2) p.hline(G.doorL, G.doorR + 1, my + 1, PAL.gold1);
  return ink(p);
}

/** The PADLOCK on the door (its own subject piece, outlined over the cage): shackle, body, three lit tongue bolts. */
function padlock(size: Size, f: number): PixelCanvas {
  const big = size === 'big';
  const p = new PixelCanvas(big ? 88 : 44, big ? 68 : 34);
  if (big) {
    const bx = 37;
    const by = 38;
    // the shackle
    p.hline(41, 46, 31, PAL.gold4);
    p.vline(39, 33, 37, PAL.gold4).vline(40, 32, 37, PAL.gold3).set(40, 32, PAL.gold4);
    p.vline(47, 32, 37, PAL.gold3).vline(48, 33, 37, PAL.gold2);
    // the body 14 × 11
    p.rect(bx, by, 14, 11, PAL.gold3);
    p.hline(bx, bx + 13, by, PAL.gold4);
    p.vline(bx, by, by + 10, PAL.gold4);
    p.hline(bx + 1, bx + 13, by + 10, PAL.gold1);
    p.vline(bx + 13, by + 1, by + 10, PAL.gold2);
    p.set(bx + 1, by + 1, PAL.white);
    // three bolts in dark slots, lit
    for (const x of [39, 43, 47]) {
      p.rect(x - 1, by + 2, 4, 7, PAL.gold0);
      p.vline(x, by + 2, by + 7, PAL.white);
      p.vline(x + 1, by + 2, by + 7, f % 2 ? PAL.gold4 : PAL.gold3);
    }
  } else {
    p.hline(21, 23, 16, PAL.gold4);
    p.vline(20, 17, 18, PAL.gold3).vline(24, 17, 18, PAL.gold2);
    p.rect(19, 19, 7, 5, PAL.gold3);
    p.hline(19, 25, 19, PAL.gold4);
    p.hline(19, 25, 23, PAL.gold1);
    for (const x of [20, 22, 24]) p.vline(x, 20, 22, PAL.gold0).vline(x, 20, 21, f % 2 ? PAL.white : PAL.gold4);
  }
  return ink(p);
}

// ---------------------------------------------------------------- painters

function paint(size: Size, l: ArtLayers, f: number): void {
  const big = size === 'big';
  const k = big ? 2 : 1;
  const G = geo(size);
  // 1. backdrop: the dawn sun rising behind the dome
  const recipe: BackdropRecipe = f % 4 >= 2 ? { ...DAWN, tones: [PAL.gold1, PAL.gold2, PAL.gold4] } : DAWN;
  paintBackdrop(l.backdrop, recipe, { focus: [44, 20], horizon: 46, radius: 34 });
  // 2. subject: the cold beast, the cage over it, the padlock over the door
  l.subject.blit(beast(size), 0, 0);
  l.subject.blit(cage(size), 0, 0);
  l.subject.blit(padlock(size, f), 0, 0);
  // 3. light
  const L = l.light;
  // the beast's cold eyes and breath (seen between the bars)
  const free = (x: number, y: number) => {
    const c = l.subject.get(x, y);
    return c !== null && c !== PAL.ink && (c === PAL.water1 || c === PAL.water2 || c === PAL.water3);
  };
  for (const [x, y] of [[20, 13], [24, 13]] as const) {
    for (let dx = 0; dx < k; dx++) if (free(x * k + dx, y * k)) L.set(x * k + dx, y * k, PAL.water4);
  }
  const puff = [0, 1, 2, 1][f % 4];
  if (puff) {
    const bx = 22 * k;
    const by = (17 - puff) * k;
    for (const [dx, dy] of big ? [[0, 0], [1, 0], [-1, -1], [2, -1], [0, -2]] : [[0, 0], [1, -1]]) if (free(bx + dx, by + dy)) L.set(bx + dx, by + dy, PAL.water4);
  }
  // the padlock's glow: short rays off its corners (the hero)
  const rays = big
    ? [[35, 36], [34, 35], [52, 36], [53, 35], [35, 50], [52, 50], [44, 52]]
    : [[17, 18], [27, 18], [17, 24], [27, 24]];
  rays.forEach(([x, y], i) => {
    if (l.subject.get(x, y) === null || l.subject.get(x, y) === PAL.ink) return;
    L.set(x, y, (i + f) % 3 === 0 ? PAL.white : PAL.gold4);
  });
  // a glint running down the swords
  for (const [i, x] of [...G.swords, G.mid].entries()) {
    const span = G.foot - G.top - 4 * k;
    const y = G.top + 3 * k + ((f * 4 * k + i * 5 * k) % Math.max(1, span));
    const gx = big ? x - 1 : x;
    if (l.subject.get(gx, y) === PAL.white || l.subject.get(gx, y) === PAL.mist) L.set(gx, y, big ? PAL.gold4 : PAL.white);
  }
  // the finial's rays (they swap long / short)
  const fy = G.dome.cy - G.dome.ry - 2 * k;
  const fx = G.dome.cx;
  const long = f % 2 === 0;
  const rr = big ? (long ? 6 : 5) : long ? 3 : 2;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [-0.7, -0.7], [0.7, -0.7]] as const) {
    const r0 = big ? 4 : 2;
    for (let r = r0; r <= rr; r++) {
      const x = Math.round(fx + dx * r);
      const y = Math.round(fy + dy * r);
      if (y >= 1 && l.subject.get(x, y) === null) L.set(x, y, r === rr ? PAL.gold4 : PAL.gold3);
    }
  }
  // motes climbing in front of the sun
  const motes: readonly (readonly [number, number])[] = big ? [[24, 22], [64, 20], [56, 14], [30, 12]] : [[12, 11], [32, 10]];
  motes.forEach(([x, y], i) => {
    const yy = y - ((f + i) % 4) * k;
    if (l.subject.get(x, yy) === null) L.set(x, yy, i % 2 ? PAL.gold4 : PAL.gold3);
  });
  // stars (hand placed, one twinkles)
  const stars: readonly (readonly [number, number])[] = big ? [[8, 6], [76, 8], [64, 4], [18, 10]] : [[4, 3], [38, 4], [32, 2]];
  stars.forEach(([x, y], i) => {
    if (i === 1 + (f % 2) && f >= 2) return;
    if (l.subject.get(x, y) === null) L.set(x, y, i % 2 ? PAL.mist : PAL.white);
  });
}

const art: CardArtV3 = {
  id: 'dawn_swords',
  focus: FOCUS,
  frames: 4,
  holdMs: 150,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
