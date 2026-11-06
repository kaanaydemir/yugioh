// Burgu Mızrağı (auger_lance) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
// "Bir kartı delen sarmal oluklu burgu, talaş kıvrımları" (docs/v3/YENI_KARTLAR.md §7 S7), the image of the scene
// (src/cinematics/spells/auger_lance.ts): a steel auger lance, tilted ~32°, has gone THROUGH a trap card.
//   the card   in FRONT, facing us: a thick night frame, a magenta trap face (its emblem dimmed to mag1 / mag2);
//              a BORE punched through its face, three radial cracks running from it to the frame, a ring of torn
//              card-stock BURR flaps bent out toward us round the hole.
//   the lance  comes in from the sky BEHIND the card (its collar and upper flute seen above the card's top edge),
//              passes through the bore, and its fluted shaft + tapering bit come out IN FRONT of the face, the
//              tip punching past the card's lower-right corner. The flute: a deep two-tone helical groove that
//              follows the cylinder (offset ∝ asin(u)) — a night groove, a white / mist lit lip, mist | steel |
//              night4 body bands; one teal band on the dark collar (the spell driving it).
//   the curls  two steel RIBBONS peel off the flute's edges (one off the front shaft, one off the upper shaft):
//              each is attached to the groove's lip and rolls up into a spiral away from the lance.
//   the light  ONLY the drilling points glow: the bit's tip (white star, teal4 rays), the contact point where the
//              shaft leaves the bore (a white glint on its lit side) and the bore's lip (teal3 / teal4).
//   backdrop   the kit's SPELL recipe (night0 / night1 sky bands, night0 floor), its light shape laid flat on the
//              floor as a sigil under the tip.
// The small picture (44×34) is painted again at 1× by the same composition code, with its own hand-placed pieces:
// a 3-band diagonal helix (ink groove / mist lip / steel) with a clean stair period, two big hook curls, a
// 3-flap burr and a 5-px tip star.
// Living art: 4 frames × 110 ms — the flute scrolls (the lance turns), the curls roll, the tip star pulses.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, paintBackdrop, patch } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type XY = readonly [number, number];

const FRAMES = 4;

interface Geo {
  k: 1 | 2;
  /** the bore (where the axis crosses the card's face) */
  hole: XY;
  /** the axis direction, unit, pointing down the lance toward the tip */
  dir: XY;
  /** distance hole → tip (the part in front of the card) */
  front: number;
  /** half widths (shaft / collar), bit length, collar span (distance from the TIP), flute lead */
  hw: number;
  chw: number;
  bit: number;
  collar: readonly [number, number];
  per: number;
  /** card centre, half sizes, roll, frame width (px) */
  cc: XY;
  chx: number;
  chy: number;
  roll: number;
  frame: number;
  /** the bore's radius across the axis */
  holeR: number;
  /** cracks: screen angle (rad) and length */
  cracks: readonly (readonly [number, number])[];
  /** burr flaps: screen angle round the bore */
  burr: readonly number[];
  /** curls: where they peel off (distance from the tip along the axis, side ±1), roll radius */
  curls: readonly { a: number; side: 1 | -1; r: number; len: number }[];
}

const A = (32 * Math.PI) / 180;
const DIR: XY = [Math.sin(A), Math.cos(A)];

const BIG: Geo = {
  k: 2,
  hole: [39, 27],
  dir: DIR,
  front: 28,
  hw: 5,
  chw: 7,
  bit: 14,
  collar: [58, 64],
  per: 7,
  cc: [36, 33],
  chx: 19,
  chy: 24,
  roll: -0.14,
  frame: 4,
  holeR: 10,
  cracks: [
    [-2.4, 18],
    [-0.8, 18],
    [2.75, 14],
  ],
  burr: [-2.75, -1.75, 2.45],
  curls: [
    { a: 19, side: 1, r: 7, len: 5 },
    { a: 7, side: 1, r: 5, len: 3 },
  ],
};

const SMALL: Geo = {
  k: 1,
  hole: [18, 13],
  dir: DIR,
  front: 14,
  hw: 3,
  chw: 4,
  bit: 7,
  collar: [27, 30],
  per: 4,
  cc: [17, 15],
  chx: 8,
  chy: 10,
  roll: -0.16,
  frame: 2,
  holeR: 4,
  cracks: [
    [-2.2, 7],
    [2.45, 7],
  ],
  burr: [-2.6, -1.3, 2.6],
  curls: [],
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

function tipOf(g: Geo): XY {
  return [g.hole[0] + g.dir[0] * g.front, g.hole[1] + g.dir[1] * g.front];
}

/** Axis frame of a pixel: a = distance from the tip back up the lance, c = across (− = the lit left side). */
function axisFrame(g: Geo, x: number, y: number): [number, number] {
  const tip = tipOf(g);
  const dx = x + 0.5 - tip[0];
  const dy = y + 0.5 - tip[1];
  const a = -(dx * g.dir[0] + dy * g.dir[1]);
  const c = -(dx * g.dir[1] - dy * g.dir[0]);
  return [a, c];
}

/** Is the pixel inside the bore (an ellipse across the axis, squashed along it: the hole seen at a slant)? */
function inHole(g: Geo, x: number, y: number, grow = 0): boolean {
  const dx = x + 0.5 - g.hole[0];
  const dy = y + 0.5 - g.hole[1];
  const along = dx * g.dir[0] + dy * g.dir[1];
  const across = dx * g.dir[1] - dy * g.dir[0];
  const ra = (g.holeR + grow) * 0.78;
  const rc = g.holeR + grow;
  return (along * along) / (ra * ra) + (across * across) / (rc * rc) <= 1;
}

function paintCard(card: PixelCanvas, g: Geo): void {
  card.poly(rect(g.cc, g.chx, g.chy, g.roll), PAL.night3);
  const fu = g.frame / g.chx;
  const fv = g.frame / g.chy;
  for (let y = 0; y < card.h; y++)
    for (let x = 0; x < card.w; x++) {
      if (!card.isOpaque(x, y)) continue;
      const [u, v] = cardUV(g, x, y);
      let c: number = PAL.night3;
      // a thick frame: lit (top-left) night4, shaded night2, one night3 inner line
      if (Math.abs(u) > 1 - fu || Math.abs(v) > 1 - fv) c = u - v < -0.4 || (v < 0 && u < 0.6) ? PAL.night4 : PAL.night2;
      else if (Math.abs(u) > 1 - fu * 1.6 || Math.abs(v) > 1 - fv * 1.6) c = PAL.night3;
      // the art window: a magenta trap face (mag1 field, mag0 lower band), the emblem dimmed (mag2 ring)
      else if (v < 0.3) {
        c = v < -0.25 ? PAL.mag1 : PAL.mag0;
      } else if (g.k === 2 && Math.round((v - 0.4) * g.chy) % 3 === 0 && u > -0.7 && u < 0.4) c = PAL.night4; // text lines
      card.set(x, y, c);
    }
  // cracks out of the bore: jagged night0 lines (1 px; a lit night4 edge on their upper side at 2×)
  for (const [ang, len] of g.cracks) {
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    for (let d = g.holeR - 1; d <= g.holeR + len; d++) {
      const j = Math.floor(d / (g.k === 2 ? 3 : 2)) % 2 ? 1 : 0;
      const X = Math.round(g.hole[0] + ca * d - sa * j);
      const Y = Math.round(g.hole[1] + sa * d + ca * j);
      if (!card.isOpaque(X, Y)) break;
      // the crack: an ink line with a lit lower lip (the broken stock catching the key light)
      const under = card.get(X, Y + 1);
      card.set(X, Y, PAL.ink);
      if (g.k === 2 && d < g.holeR + len - 3 && card.isOpaque(X, Y + 1) && under !== PAL.ink)
        card.set(X, Y + 1, under === PAL.mag1 || under === PAL.mag0 ? PAL.mag2 : PAL.night4);
    }
  }
}

/** One / two steps darker (the part of the lance behind the card: off it, and deep in the bore). */
const SHADE: readonly Readonly<Record<number, number>>[] = [
  {},
  { [PAL.white]: PAL.mist },
  { [PAL.white]: PAL.steel, [PAL.mist]: PAL.night4, [PAL.steel]: PAL.night3, [PAL.night4]: PAL.night2, [PAL.night3]: PAL.night1, [PAL.night2]: PAL.night1 },
];

/** Lance pixel colour at (a, c) (axis frame), or null outside it. The flute scrolls with `phase`. */
function lanceAt(g: Geo, a: number, c: number, phase: number, x: number, y: number): number | null {
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
  if (g.k === 1) {
    // small, hand-placed helix: three 1–2 px diagonal bands on a clean stair (x + 2y), period 9 → ~4 px along
    // the axis: ink groove | mist lip | steel; the shade side steps steel → night4
    const k = (((x + 2 * y + phase * 2) % 9) + 9) % 9;
    if (k < 3) return u > 0.5 ? PAL.ink : PAL.night2;
    if (k < 5) return u > 0.5 ? PAL.steel : PAL.mist;
    return u > 0.4 ? PAL.night4 : PAL.steel;
  }
  // the helical flute (the groove bends round the cylinder: offset ∝ asin(u))
  const off = ((g.per * Math.asin(u)) / Math.PI) * 0.9;
  const k = (((Math.floor(a + off + phase) % g.per) + g.per) % g.per) as number;
  if (k < 2) return k === 0 ? (u > 0.3 ? PAL.night1 : PAL.night2) : u < -0.3 ? PAL.night3 : PAL.night2;
  if (k === 2) return u < -0.1 ? (a < 18 ? PAL.white : PAL.mist) : u < 0.45 ? PAL.mist : PAL.steel;
  return body;
}

/**
 * The lance: behind the card above the bore (seen only off the card or inside the hole), in front of the
 * card from the bore down to the tip. Returns the lance mask (for the curls' attachment).
 */
function paintLance(p: PixelCanvas, g: Geo, phase: number, card: PixelCanvas): void {
  const aHole = g.front;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const [a, c] = axisFrame(g, x, y);
      const col = lanceAt(g, a, c, phase, x, y);
      if (col === null) continue;
      const behind = a > aHole - (g.k === 2 ? 2 : 1);
      const hole = inHole(g, x, y);
      if (behind && card.isOpaque(x, y) && !hole) continue;
      // seen through the bore the shaft sinks into its shadow (two steps darker); off the card, one step
      p.set(x, y, behind ? SHADE[hole ? 2 : 1][col] ?? col : col);
    }
}

/** A burr flap: a card-stock tooth torn out of the bore's rim and bent toward us (a mag2 face, a night4 tip). */
function burrFlap(p: PixelCanvas, g: Geo, ang: number): void {
  const ca = Math.cos(ang);
  const sa = Math.sin(ang);
  const along = Math.cos(ang - Math.atan2(g.dir[1], g.dir[0]));
  const r0 = g.holeR * Math.sqrt(1 / (along * along / 0.49 + (1 - along * along))) - 1;
  const L = g.k === 2 ? 5 : 2;
  const W = g.k === 2 ? 2 : 0;
  const pts: [number, number][] = [
    [g.hole[0] + ca * r0 - sa * W, g.hole[1] + sa * r0 + ca * W],
    [g.hole[0] + ca * r0 + sa * W, g.hole[1] + sa * r0 - ca * W],
    [g.hole[0] + ca * (r0 + L), g.hole[1] + sa * (r0 + L)],
  ];
  if (W > 0) p.poly(pts.map(([x, y]) => [Math.round(x), Math.round(y)] as [number, number]), PAL.mag2);
  for (let d = 0; d <= L; d++) p.set(Math.round(g.hole[0] + ca * (r0 + d)), Math.round(g.hole[1] + sa * (r0 + d)), d >= L - 1 ? PAL.night4 : PAL.mag2);
}

/**
 * A curl: a steel RIBBON peeling off the flute's edge — attached at the lance's side (distance `a` from the tip),
 * it leaves the shaft along the groove, then rolls up into a spiral away from it: steel at the root, mist, a
 * white curled-in end; a second steel line under the root (the ribbon's width).
 */
function ribbon(p: PixelCanvas, g: Geo, a: number, side: 1 | -1, r: number, len: number, rot: number): void {
  const tip = tipOf(g);
  const nx = g.dir[1] * side;
  const ny = -g.dir[0] * side;
  // the root on the lance's edge, the leaving direction: out along the normal, tilted back up the lance
  const rx = tip[0] - g.dir[0] * a + nx * (g.hw + 1);
  const ry = tip[1] - g.dir[1] * a + ny * (g.hw + 1);
  const ox = nx * 0.8 - g.dir[0] * 0.6;
  const oy = ny * 0.8 - g.dir[1] * 0.6;
  const cx = rx + ox * (len + r);
  const cy = ry + oy * (len + r);
  const pts: [number, number][] = [];
  for (let d = 0; d <= len; d++) pts.push([rx + ox * d, ry + oy * d]);
  // the spiral: from the outer radius (continuing the straight run) inwards, 1.6 turns
  const a0 = Math.atan2(-oy, -ox) + rot;
  const N = 30;
  for (let j = 0; j <= N; j++) {
    const t = j / N;
    const ang = a0 + side * t * Math.PI * 3.2;
    const rr = r * (1 - t * 0.85);
    pts.push([cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]);
  }
  let lx = NaN;
  let ly = NaN;
  pts.forEach(([fx, fy], i) => {
    const x = Math.round(fx);
    const y = Math.round(fy);
    const k = i / (pts.length - 1);
    const col = k > 0.94 ? PAL.white : k > 0.3 ? PAL.mist : PAL.steel;
    if (!Number.isNaN(lx)) {
      let wx = lx;
      let wy = ly;
      while (wx !== x || wy !== y) {
        if (wx !== x && (Math.abs(x - wx) >= Math.abs(y - wy) || wy === y)) wx += Math.sign(x - wx);
        else wy += Math.sign(y - wy);
        p.set(wx, wy, col);
      }
    }
    p.set(x, y, col);
    if (i > 0 && i <= len) p.set(x, y + 1, PAL.steel);
    lx = x;
    ly = y;
  });
}

const L_KEY: Readonly<Record<string, number>> = { w: PAL.white, t: PAL.teal4, s: PAL.teal3, d: PAL.teal2 };
// prettier-ignore
const TIP_BIG: readonly (readonly string[])[] = [
  ['....s....', '....t....', '.d..t..d.', '..ttwtt..', 'sttwwwtts', '..ttwtt..', '.d..t..d.', '....t....', '....s....'],
  ['.........', '....s....', '....t....', '...twt...', '.stwwwts.', '...twt...', '....t....', '....s....', '.........'],
];
// prettier-ignore
const TIP_SMALL: readonly (readonly string[])[] = [
  ['..s..', '..t..', 'stwts', '..t..', '..s..'],
  ['.....', '..t..', '.twt.', '..t..', '.....'],
];
const C_KEY: Readonly<Record<string, number>> = { w: PAL.white, m: PAL.mist, s: PAL.steel };
// prettier-ignore  — the small's two big curls: hooks rolling off the shaft (root at the left / right edge)
const HOOK_R: readonly (readonly string[])[] = [
  ['.mmm.', 'm...m', 'm.w.s', 'ss.s.', 's....'],
  ['.smm.', 's...m', 'm.w.m', 'mm.s.', 's....'],
];
// prettier-ignore
const HOOK_L: readonly (readonly string[])[] = [
  ['.mmm.', 'm...m', 's.w.m', '.s.ss', '....s'],
  ['.mms.', 'm...s', 'm.w.m', '.s.mm', '....s'],
];

function paint(l: ArtLayers, f: number, g: Geo): void {
  const k = g.k;
  const tip = tipOf(g);
  const tx = Math.round(tip[0]);
  const ty = Math.round(tip[1]);
  paintBackdrop(l.backdrop, 'SPELL', { focus: [Math.round(tip[0] * (2 / k)), 58], radius: 20, horizon: 52, as: 'sigil' });
  const card = new PixelCanvas(l.subject.w, l.subject.h);
  paintCard(card, g);
  // the bore: punched through the face (night0 where the lance does not fill it), the far wall night1
  for (let y = 0; y < card.h; y++)
    for (let x = 0; x < card.w; x++) if (card.isOpaque(x, y) && inHole(g, x, y)) card.set(x, y, PAL.night0);
  l.subject.blit(card, 0, 0);
  paintLance(l.subject, g, f % g.per, card);
  for (const b of g.burr) burrFlap(l.subject, g, b);
  // card chips flung out of the bore with the bit (big: three, ink outlined; they tumble with the frames)
  if (k === 2)
    for (const [x, y, r, mag] of [
      [62, 40, 0.4, true],
      [70, 50, 1.1, false],
      [60, 58, 0.2, true],
    ] as const) {
      const pts = rect([x, y], 2, 1.5, r + f * 0.4).slice(0, 3);
      l.subject.poly(pts, mag ? PAL.mag2 : PAL.night4);
    }
  ink(l.subject);
  // ---- light: only the drilling points
  // the bore's lip: a glowing teal rim on the card just outside the hole (the lower / front half brighter)
  for (let y = 0; y < card.h; y++)
    for (let x = 0; x < card.w; x++) {
      if (!card.isOpaque(x, y) || inHole(g, x, y) || !inHole(g, x, y, 1.2)) continue;
      const own = l.subject.get(x, y);
      if (own === PAL.ink || own === PAL.steel || own === PAL.mist || own === PAL.night4 || own === PAL.white) continue;
      const below = y + 0.5 > g.hole[1];
      l.light.set(x, y, below ? ((x + f) % 3 === 0 ? PAL.teal4 : PAL.teal3) : PAL.teal2);
    }
  // the contact point: a white / teal4 glint on the shaft's lit side right where it leaves the bore
  const nx = g.dir[1];
  const ny = -g.dir[0];
  const cpx = g.hole[0] + g.dir[0] * (g.holeR * 0.62 + 1) - nx * (g.hw - 1);
  const cpy = g.hole[1] + g.dir[1] * (g.holeR * 0.62 + 1) - ny * (g.hw - 1);
  l.light.set(Math.round(cpx), Math.round(cpy), PAL.white);
  if (k === 2) {
    l.light.set(Math.round(cpx + g.dir[0] * 1), Math.round(cpy + g.dir[1] * 1), PAL.white);
    l.light.set(Math.round(cpx - nx), Math.round(cpy - ny), PAL.teal4);
    l.light.set(Math.round(cpx + g.dir[0] * 2), Math.round(cpy + g.dir[1] * 2), PAL.teal4);
  }
  // the tip: a pulsing white / teal star, and (big) the burst's rays flung down-right
  const st = (k === 2 ? TIP_BIG : TIP_SMALL)[f % 2];
  patch(l.light, st as string[], L_KEY, tx - (st[0].length >> 1), ty - (st.length >> 1));
  if (k === 2) {
    for (const [dx, dy, n] of [
      [1, 0, 4],
      [1, 1, 4],
      [0, 1, 3],
      [2, -1, 3],
    ] as const) {
      for (let i = 0; i < n; i++) {
        const x = tx + 5 + i * dx + (dx === 2 ? i : 0);
        const y = ty + 2 + i * dy;
        if (!l.subject.isOpaque(x, y)) l.light.set(x, y, i < 2 ? PAL.teal4 : PAL.teal2);
      }
    }
    // the ribbons peel off the flute edges, rolling as the lance turns
    g.curls.forEach((c, i) => ribbon(l.light, g, c.a + (f % 2), c.side, c.r, c.len, f * 0.5 * (i % 2 ? -1 : 1)));
  } else {
    // small (hand-made): two big hook curls rolling off the shaft's two sides
    const nxS = g.dir[1];
    const nyS = -g.dir[0];
    const r1: XY = [Math.round(tip[0] - g.dir[0] * 7 + nxS * (g.hw + 3)), Math.round(tip[1] - g.dir[1] * 7 + nyS * (g.hw + 3))];
    const r2: XY = [Math.round(tip[0] - g.dir[0] * 5 - nxS * (g.hw + 3)), Math.round(tip[1] - g.dir[1] * 5 - nyS * (g.hw + 3))];
    patch(l.light, HOOK_R[f % 2] as string[], C_KEY, r1[0] - 1, r1[1] - 2);
    patch(l.light, HOOK_L[(f + 1) % 2] as string[], C_KEY, r2[0] - 3, r2[1] - 2);
  }
}

const art: CardArtV3 = {
  id: 'auger_lance',
  focus: [45, 38],
  frames: FRAMES,
  holdMs: 110,
  big: (l, f) => paint(l, f, BIG),
  small: (l, f) => paint(l, f, SMALL),
};

export default art;
