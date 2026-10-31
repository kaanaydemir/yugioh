// Süpürge Rüzgarı (sweeping_gale) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Geniş yaylı rüzgar süpürmesi, uçuşan kartlar, platform kenarı" (YENI_KARTLAR §7 S4) — the image of the scene
// (src/cinematics/spells/sweeping_gale.ts): the same green-white crescent BLADE of wind with its broom-bristle
// streaks sweeps up off the corner of the duel platform; three cards tumble in it — one tearing off the slab, one
// high in the air turning (a set card showing its trap face), one dropping past the platform's edge into the void.
//   backdrop  the kit's SPELL recipe (night0 / night1 sky, the teal portal framing the blade's front: the spell cue);
//             no floor band (the platform is matter).
//   subject   matter, ink outlined, ONE key light from the top left: the platform corner (night3 top with one
//             night2 tile seam, a night1 side face, a teal2 neon lip on the edge), the cards (mist / white frames,
//             their faces flat: a teal spell, a magenta trap, a crimson card back, the falling one in shade).
//   light     the wind: the blade (white leading edge, leaf4 band, leaf3 body), its bristle streaks (leaf3 / leaf2
//             arcs), leaves. The single brightest point is the blade's white front at its crest = the focus.
// The small picture (44×34) is the same composition painted again at 1× by the same code (sampled at pixel
// centres, not reduced), then corrected by hand: the blade's front kept as one unbroken white line, the cards
// re-cut as 1×-legible parallelograms with a single face tone each.
// Living art: 4 frames × 150 ms — the leaves turn, the airborne cards bob 1 px, the bristle dashes step along.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { geomOf, ink, paintBackdrop, patch, shape } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type P = readonly [number, number];
const FRAMES = 4;
const FOCUS: P = [52, 11];

/** Paint `p` per pixel from a function of BIG coordinates (the small canvas is sampled at its pixel centres). */
function paintFn(p: PixelCanvas, fn: (x: number, y: number) => number | null): void {
  const k = geomOf(p).k;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const bx = k === 2 ? x : x * 2 + 0.5;
      const by = k === 2 ? y : y * 2 + 0.5;
      const c = fn(bx, by);
      if (c !== null) p.set(x, y, c);
    }
}

// ---------------------------------------------------------------- the blade (a crescent of wind)

/** Outer circle of the crescent (its front) and the inner one (its back). */
const C1: P = [42, 64];
const R1 = 55;
const C2: P = [35, 73];
const R2 = 55;
/** angle window of the blade (screen radians, y down): from its lower-left root to its upper-right tip */
const A0 = -2.62;
const A1 = -0.3;

function bladeTone(x: number, y: number, f: number, k: 1 | 2 = 2): number | null {
  const d1 = Math.hypot(x - C1[0], y - C1[1]);
  const d2 = Math.hypot(x - C2[0], y - C2[1]);
  const a = Math.atan2(y - C1[1], x - C1[0]);
  if (a < A0 || a > A1) {
    return null;
  }
  // the blade tapers at both ends: its inner circle grows toward the tips
  const u = (a - A0) / (A1 - A0);
  const taper = Math.pow(Math.abs(u - 0.6) / 0.6, 2) * 7;
  if (d1 > R1 || d2 < R2 + taper) {
    // bristle streaks: arcs concentric with the inner circle, broken (dashes step with the frame)
    const rr = d2;
    if (d1 > R1) return null;
    const arcs =
      k === 2
        ? ([
            [R2 - 3, -2.45, -0.62, PAL.leaf3],
            [R2 - 7, -2.35, -0.85, PAL.leaf3],
            [R2 - 11, -2.25, -1.05, PAL.leaf2],
            [R2 - 15, -2.1, -1.25, PAL.leaf2],
          ] as const)
        : ([
            [R2 - 4, -2.4, -0.7, PAL.leaf3],
            [R2 - 11, -2.2, -1.1, PAL.leaf2],
          ] as const);
    for (const [r, from, to, tone] of arcs) {
      const a2 = Math.atan2(y - C2[1], x - C2[0]);
      if (Math.abs(rr - r) < (k === 2 ? 0.75 : 1) && a2 > from && a2 < to) {
        const dash = Math.floor(((a2 - from) * r) / (k === 2 ? 5 : 9) + f) % 3;
        if (dash !== 2) return tone;
      }
    }
    return null;
  }
  const e = R1 - d1; // depth behind the front
  if (e < 1.6) return PAL.white;
  if (e < 4.5) return PAL.leaf4;
  if (e < 8.5) return PAL.leaf3;
  return PAL.leaf2;
}

// ---------------------------------------------------------------- cards (flat parallelograms)

interface CardShape {
  pts: readonly P[];
  frame: number;
  face: number;
  /** an emblem in the middle of the face (a diamond) */
  emblem: number | null;
  /** bobs with the living art */
  bob: boolean;
}

/** shrink a convex quad toward its centre by `k` BIG px (the face inside the frame) */
function inset(pts: readonly P[], k: number): P[] {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, y]) => {
    const dx = cx - x;
    const dy = cy - y;
    const l = Math.hypot(dx, dy) || 1;
    return [x + (dx / l) * k, y + (dy / l) * k] as P;
  });
}

/** A card's quad: centre, size (BIG px), turn (deg) and a vertical squash (a card seen tilted toward the floor). */
function cardQuad(cx: number, cy: number, w: number, h: number, deg: number, squash = 1): P[] {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const sn = Math.sin(a);
  return ([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]] as const).map(([x, y]) => [cx + x * c - y * sn, cy + (x * sn + y * c) * squash] as P);
}

const CARDS: readonly CardShape[] = [
  // tearing off the platform (a card back, tilted up off its slot, foreshortened)
  { pts: cardQuad(15, 52, 12, 17, -62, 0.62), frame: PAL.mist, face: PAL.crim1, emblem: PAL.crim3, bob: false },
  // high in the wind, turning: a set trap showing its face
  { pts: cardQuad(65, 18, 12, 17, 28), frame: PAL.white, face: PAL.mag2, emblem: PAL.mag4, bob: true },
  // dropping past the edge into the void (in shade, edge-on-ish)
  { pts: cardQuad(71, 53, 9, 15, -24, 0.9), frame: PAL.steel, face: PAL.night2, emblem: PAL.teal2, bob: true },
];

function paintCard(p: PixelCanvas, c: CardShape, dy: number): void {
  const pts = c.pts.map(([x, y]) => [x, y + dy] as P);
  shape(p, pts, c.frame);
  shape(p, inset(pts, 2.2), c.face);
  if (c.emblem !== null) {
    const cx = pts.reduce((s, q) => s + q[0], 0) / 4;
    const cy = pts.reduce((s, q) => s + q[1], 0) / 4;
    shape(p, [[cx, cy - 2.2], [cx + 2.2, cy], [cx, cy + 2.2], [cx - 2.2, cy]], c.emblem);
  }
}

// ---------------------------------------------------------------- the platform corner

function paintPlatform(p: PixelCanvas): void {
  // top face: a wedge whose right corner is the platform's corner; the void beyond
  shape(p, [[0, 36], [44, 58], [0, 80]], PAL.night3);
  // one tile seam (night2) parallel to the back edge
  shape(p, [[0, 47], [26, 60], [24, 61], [0, 49]], PAL.night2);
  // the side face under the front-right edge, with the arena's teal neon lip
  shape(p, [[44, 58], [44, 64], [0, 86], [0, 80]], PAL.night1);
  shape(p, [[44, 58], [44, 59.6], [0, 81.6], [0, 80]], PAL.teal2);
}

// ---------------------------------------------------------------- leaves (light layer, turning with the frame)

const LEAVES: readonly P[] = [
  [26, 26],
  [78, 32],
  [40, 34],
  [84, 10],
  [14, 34],
];
// leaf frames ('#' leaf4, 'a' leaf3) — big; the small uses one pixel pair
const LEAF_BIG: readonly (readonly string[])[] = [
  ['.##', '#aa', 'a..'],
  ['###', '.aa'],
  ['#..', 'a#.', '.aa'],
  ['.#', '#a', 'a.'],
];

/** the hand-made 1× card patches of the current paint: [x, y, w, h] */
let smallCards: readonly (readonly [number, number, number, number])[] = [];

function paint(l: ArtLayers, f: number): void {
  const k = geomOf(l.subject).k;
  paintBackdrop(l.backdrop, 'SPELL', { focus: FOCUS, radius: 24, horizon: 999, shape: false });
  paintPlatform(l.subject);
  const bob = f === 1 || f === 2 ? 1 : 0;
  if (k === 2) CARDS.forEach((c, i) => paintCard(l.subject, c, c.bob ? (i % 2 ? -bob : bob) : 0));
  ink(l.subject);
  if (k === 1) {
    // hand-made at 1×: the three cards as legible little parallelograms, one face tone each (+ an emblem pixel)
    const key = { k: PAL.ink, m: PAL.mist, r: PAL.crim1, e: PAL.crim3, w: PAL.white, p: PAL.mag2, q: PAL.mag4, s: PAL.steel, n: PAL.night2, t: PAL.teal2 };
    patch(l.subject, ['..kkkkk.', '.kmmmmmk', 'kmrrermk', 'kmmmmmk.', '.kkkkk..'], key, 3, 24);
    patch(l.subject, ['kkkkk...', 'kwwwwk..', 'kwppwk..', '.kwppwk.', '.kwqpwk.', '.kwppwk.', '..kwwwwk', '..kkkkk.'], key, 29, 4 - bob);
    patch(l.subject, ['kkkk.', 'ksssk', 'ksnsk', 'kstsk', 'ksnsk', 'kssk.', '.kkk.'], key, 33, 22 + bob);
    smallCards = [
      [3, 24, 8, 5],
      [29, 4 - bob, 8, 8],
      [33, 22 + bob, 5, 7],
    ];
  }
  // the wind (light layer: never outlined)
  paintFn(l.light, (x, y) => bladeTone(x, y, f, k));
  // the cards in the wind stay in front of the blade's body (it passes behind the high card)
  if (k === 2) {
    LEAVES.forEach(([x, y], i) => {
      const fr = LEAF_BIG[(i + f) % 4];
      fr.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && l.light.set(x + rx, y + ry, ch === '#' ? PAL.leaf4 : PAL.leaf3)));
    });
  } else {
    // hand-made at 1×: leaves as 2-px flecks that turn (horizontal ↔ diagonal)
    LEAVES.slice(0, 4).forEach(([x, y], i) => {
      const sx = Math.round(x / 2);
      const sy = Math.round(y / 2);
      const turn = (i + f) % 2;
      l.light.set(sx, sy, PAL.leaf4);
      l.light.set(sx + 1, sy + turn, PAL.leaf3);
    });
  }
  // keep the cards over the wind: the blade passes behind them (their outline included)
  const dys = CARDS.map((c, i) => (c.bob ? (i % 2 ? -bob : bob) * (k === 2 ? 1 : 2) : 0));
  for (let y = 0; y < l.light.h; y++)
    for (let x = 0; x < l.light.w; x++) {
      if (!l.light.isOpaque(x, y)) continue;
      const bx = k === 2 ? x : x * 2 + 0.5;
      const by = k === 2 ? y : y * 2 + 0.5;
      if (k === 1) {
        if (smallCards.some(([cx, cy, w, h]) => x >= cx && x < cx + w && y >= cy && y < cy + h && l.subject.isOpaque(x, y) && l.subject.get(x, y) !== PAL.night3)) l.light.erase(x, y);
        continue;
      }
      if (CARDS.some((c, i) => inQuad(c.pts.map(([px, py]) => [px, py + dys[i]] as P), bx, by, k === 2 ? 1.2 : 2.2))) l.light.erase(x, y);
    }
}

/** Inside a convex quad grown by `pad` px (signed edge distances). */
function inQuad(pts: readonly P[], x: number, y: number, pad: number): boolean {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % pts.length];
    const ex = bx - ax;
    const ey = by - ay;
    const cr = (ex * (y - ay) - ey * (x - ax)) / (Math.hypot(ex, ey) || 1);
    if (sign === 0) sign = Math.sign(cr) || 1;
    if (cr * sign < -pad) return false;
  }
  return true;
}

const art: CardArtV3 = {
  id: 'sweeping_gale',
  focus: FOCUS,
  frames: FRAMES,
  holdMs: 150,
  big: (l, f) => paint(l, f),
  small: (l, f) => paint(l, f),
};

export default art;
