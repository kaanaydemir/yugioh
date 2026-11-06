// Ruh Tasması (soul_leash) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// "A glowing collar; a beast whose shadow has come away from its body walks ahead" (YENI_KARTLAR §7 S8).
// Round 4 repaint (critic: the old picture read as "a purple dog leads a grey ghost"): the BODY is now the solid
// thing — a warm earth-brown hound, inked, lit from the top left, a darker belly band, a gold eye, the teal rim
// of the spell's light on its shadow side — and the COLLAR sits on ITS neck: a 3-row gold and purple band with
// studs and a gold buckle with a white heart, the brightest point of the picture, its light spilling on the
// chest in two stepped earth tones. AHEAD (right, a little farther), the SHADOW has come away and strides on:
// the same hound as a flat void1 silhouette with a void2 lit edge and a thin void4 top line — no eye, no detail.
// A dark ribbon on the floor ties the body's feet to the shadow's feet. From the ring under the buckle the thin
// light BOND hangs down and runs along the floor out of the bottom-left of the frame (to the leash card); a small
// leaf-green bead of LP light runs up it toward the collar (the Draw Phase gift) — far from the frame's icons.
//   backdrop  the SPELL recipe: the teal portal well behind the body's head, a teal light pool on the floor
//             under the collar, two night1 tile seams crossing the floor band (an arena floor, not a void).
//   subject   the body hound (earth2 / earth1 planes, earth3 lit edge, ink outline, teal3 rim), the shadow
//             hound (void1, void2 lit edge, void4 top line, ink outline), the floor ribbon.
//   light     never outlined: the collar, its spill, the bond, the leaf bead, the body's eye.
// Small (44×34): the same parametric hounds at 1× density from their own numbers (not a reduction), with a
// hand-placed 2-row collar, a 2×2 buckle and a 1-px bond.
// Living art: 4 frames × 160 ms — the shadow strides (its legs swap), the leaf bead runs up the bond, the collar's
// glint steps round the band.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, litEdge, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';
type P = readonly [number, number];

interface Tones {
  base: number;
  far: number;
}

// One hound, facing right, as a polygon in a 47×33 box (BIG px at k = 1; feet on row 29).
const TORSO: readonly P[] = [
  [6, 9], [10, 8], [18, 9], [26, 8], [30, 6], [33, 2], [36, 0], [37, -4], [39, 0], [41, 1], [46, 4], [47, 5], [46, 7],
  [40, 8], [36, 10], [34, 14], [31, 17], [24, 16], [16, 14], [9, 16], [6, 13],
];

/** Draw a hound; returns its collar point and eye (world px). */
function paintHound(p: PixelCanvas, ox: number, oy: number, k: number, stride: number, tailLow: boolean, t: Tones): { neck: P; eye: P } {
  const X = (x: number) => ox + Math.round(x * k);
  const Y = (y: number) => oy + Math.round(y * k);
  const w = Math.max(2, Math.round(3 * k + 0.4));
  const limb = (pts: readonly P[], tone: number) => {
    for (let i = 1; i < pts.length; i++) p.thickLine(X(pts[i - 1][0]), Y(pts[i - 1][1]), X(pts[i][0]), Y(pts[i][1]), w, tone);
  };
  const sw = stride < 0 ? 0 : stride === 0 ? 3 : -3;
  // far legs (darker), tail
  limb([[14, 14], [11, 22], [13 - sw, 29]], t.far);
  limb([[28, 15], [28 + sw, 29]], t.far);
  limb(tailLow ? [[7, 10], [3, 15], [2, 20]] : [[7, 9], [3, 4], [1, 1]], t.base);
  p.poly(TORSO.map(([x, y]) => [X(x), Y(y)] as P), t.base);
  // near legs
  limb([[10, 14], [7, 22], [9 + sw, 29]], t.base);
  limb([[32, 15], [32 - sw, 29]], t.base);
  return { neck: [X(35), Y(7)], eye: [X(41), Y(3)] };
}

/** The body stands in front (left); its shadow strides ahead (right) and a little farther (up). */
const CFG: Readonly<Record<Size, { k: number; body: P; shadow: P; horizon: number }>> = {
  big: { k: 1.04, body: [1, 25], shadow: [36, 21], horizon: 48 },
  small: { k: 0.52, body: [0, 12], shadow: [18, 10], horizon: 24 },
};

/** The picture's focus (the collar's buckle) in BIG px — derived from the body's neck. */
const FOCUS = [CFG.big.body[0] + Math.round(35 * CFG.big.k), CFG.big.body[1] + Math.round(7 * CFG.big.k) + 2] as const;
const FOCUS_SMALL = [CFG.small.body[0] + Math.round(35 * CFG.small.k), CFG.small.body[1] + Math.round(7 * CFG.small.k) + 1] as const;

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const k = C.k;
  // 1. backdrop: the spell's portal well behind the body's head, a pool under the collar, two tile seams
  paintBackdrop(l.backdrop, 'SPELL', { focus: [66, 30], horizon: 48, radius: 22, pool: false });
  const bd = l.backdrop;
  const hz = C.horizon;
  // the floor seams: two 2:1 lines in night1 (the recipe's own sky tone) crossing under the pair; each row's run
  // is 3 px so it overlaps the next row's by one (2-px runs touch only at corners: a 2×2 checker on every step)
  const seam = (x0: number, dir: 1 | -1) => {
    for (let y = hz + 1; y < bd.h; y++) {
      const x = x0 + dir * (y - hz) * 2;
      for (const dx of [0, dir, 2 * dir]) if (x + dx >= 0 && x + dx < bd.w) bd.set(x + dx, y, PAL.night1);
    }
  };
  seam(big ? 6 : 3, 1);
  seam(big ? 70 : 35, -1);
  seam(big ? 92 : 46, -1);
  // the collar's light pool on the floor under the body's chest: two flat stepped rings (teal1 / teal2)
  const pcx = (C.body[0] + Math.round(30 * k)) + 0.5;
  const pcy = C.body[1] + Math.round(29 * k) + (big ? 2 : 1) + 0.5;
  bd.ellipse(pcx, pcy, big ? 15 : 8, big ? 3 : 1.5, PAL.teal1);
  bd.ellipse(pcx, pcy, big ? 9 : 4, big ? 1.5 : 1, PAL.teal2);

  // 2. subject: the floor ribbon, the shadow (ahead, farther), then the body (in front)
  const bf: P = [C.body[0] + Math.round(20 * k), C.body[1] + Math.round(29 * k)];
  const sf: P = [C.shadow[0] + Math.round(20 * k), C.shadow[1] + Math.round(29 * k)];
  const floor = new PixelCanvas(l.subject.w, l.subject.h);
  floor.thickLine(bf[0], bf[1], sf[0], sf[1], big ? 2 : 1, PAL.ink);
  floor.ellipse(sf[0] + 0.5, sf[1] + 0.5, big ? 13 : 6, big ? 2 : 1, PAL.ink);

  const shadow = new PixelCanvas(l.subject.w, l.subject.h);
  paintHound(shadow, C.shadow[0], C.shadow[1], k, f % 2, true, { base: PAL.void1, far: PAL.void1 });
  if (big) litEdge(shadow, 1, { only: (c) => c === PAL.void1 });
  // the thin void4 top line: the top pixel of every column of the back and head
  for (let x = 0; x < shadow.w; x++)
    for (let y = 0; y < shadow.h; y++) {
      const c = shadow.get(x, y);
      if (c === null) continue;
      if (y < C.shadow[1] + Math.round(12 * k)) shadow.set(x, y, PAL.void4);
      break;
    }
  ink(shadow);

  const body = new PixelCanvas(l.subject.w, l.subject.h);
  const bp = paintHound(body, C.body[0], C.body[1], k, -1, false, { base: PAL.earth2, far: PAL.earth1 });
  // a belly band: the torso's lower third one tone darker
  const bellyY = C.body[1] + Math.round(12 * k);
  if (big)
    for (let y = bellyY; y < C.body[1] + Math.round(18 * k); y++)
    for (let x = 0; x < body.w; x++) if (body.get(x, y) === PAL.earth2 && x > C.body[0] + Math.round(8 * k) && x < C.body[0] + Math.round(34 * k)) body.set(x, y, PAL.earth1);
  litEdge(body, 1, { only: (c) => c === PAL.earth2 });
  ink(body);
  // the teal rim only on the back, neck and head (on the legs it drew a second outline)
  rim(body, PAL.teal3, { only: (_x, y) => y < C.body[1] + Math.round((big ? 13 : 9) * k) });

  l.subject.blit(floor, 0, 0);
  l.subject.blit(shadow, 0, 0);
  l.subject.blit(body, 0, 0);

  // 3. light
  const L = l.light;
  const [nx, ny] = bp.neck;
  const onBody = (x: number, y: number) => {
    const c = body.get(x, y);
    return c === PAL.earth1 || c === PAL.earth2;
  };
  // the body's eye: alive, held — a gold pixel (a white glint in big)
  L.set(bp.eye[0], bp.eye[1], PAL.gold4);
  if (big) {
    L.set(bp.eye[0] - 1, bp.eye[1], PAL.gold3);
    L.set(bp.eye[0], bp.eye[1] - 1, PAL.ink);
    L.set(bp.eye[0] - 1, bp.eye[1] - 1, PAL.ink);
  }
  // the bond: from the ring under the buckle down in front of the chest, then along the floor out of the bottom left
  const ring: P = big ? [nx, ny + 5] : [nx, ny + 3];
  const drop: P = [ring[0] + (big ? 2 : 1), (big ? 58 : 29)];
  const out: P = [-2, big ? 66 : 33];
  const pts: P[] = [];
  const push = (x: number, y: number) => {
    const last = pts[pts.length - 1];
    if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
  };
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    push(Math.round(ring[0] + (drop[0] - ring[0]) * t * t), Math.round(ring[1] + (drop[1] - ring[1]) * t));
  }
  const mid: P = [Math.round((drop[0] + out[0]) / 2), drop[1] + (big ? 5 : 3)];
  for (let i = 1; i <= 120; i++) {
    const t = i / 120;
    push(Math.round((1 - t) * (1 - t) * drop[0] + 2 * (1 - t) * t * mid[0] + t * t * out[0]), Math.round((1 - t) * (1 - t) * drop[1] + 2 * (1 - t) * t * mid[1] + t * t * out[1]));
  }
  // the leaf bead runs from the frame edge up toward the collar (4 frames)
  const visible = pts.filter(([x, y]) => x >= 1 && y <= l.light.h - 2);
  const beadAt = Math.round(((3 - (f % 4)) / 4) * (visible.length - 1) * 0.85 + visible.length * 0.1);
  visible.forEach(([x, y], i) => {
    if (i < 2) return;
    const d = Math.abs(i - beadAt);
    const core = big ? (i % 6 === 0 ? PAL.gold3 : PAL.void4) : i < 6 ? PAL.void4 : PAL.void3;
    if (d <= (big ? 1 : 0)) {
      L.set(x, y, d === 0 ? PAL.leaf4 : PAL.leaf3);
      return;
    }
    L.set(x, y, core);
    if (big && i > 6) L.set(x, y + 1, PAL.void2);
  });
  if (big) {
    // the collar's light spilling on the chest and neck: two stepped rings in the body's own lit tones
    for (let y = ny - 6; y <= ny + 8; y++)
      for (let x = nx - 9; x <= nx + 9; x++) {
        if (!onBody(x, y)) continue;
        const d = Math.hypot((x - nx) / 1.4, y - ny - 1);
        if (y > ny + 2 && d <= 5 && d > 3) L.set(x, y, PAL.earth3);
      }
    // the band: a front arc 3 rows tall — gold3 rim, void4 leather with gold4 studs every 3 px, void3 underside
    const rx = 6;
    const ry = 2;
    const seen = new Set<number>();
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI;
      const x = Math.round(nx + Math.cos(a) * rx);
      const y = Math.round(ny + Math.sin(a) * ry);
      if (seen.has(x * 100 + y)) continue;
      seen.add(x * 100 + y);
      const stud = (((x - nx) % 3) + 3) % 3 === 0 && x !== nx;
      L.set(x, y - 1, PAL.gold3);
      L.set(x, y, stud ? PAL.gold4 : PAL.void4);
      L.set(x, y + 1, PAL.void3);
    }
    const glint = [-4, -1, 2, 4][f % 4];
    L.set(nx + glint, ny - 1 + (Math.abs(glint) > 3 ? 1 : 0), PAL.white);
    // the buckle: a 3×3 gold4 frame with the white heart (the brightest point), the ring under it
    const bx = nx - 1;
    const by = ny + 2;
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) L.set(bx + xx, by + yy, PAL.gold4);
    L.set(bx + 1, by + 1, PAL.white);
    L.set(bx + 1, by, PAL.white);
    L.set(bx + 1, by + 3, PAL.gold3);
  } else {
    // small, by hand: a soft spill, a 2-row band, a 2×2 buckle
    for (let x = nx - 2; x <= nx + 2; x++) {
      const y = ny + (Math.abs(x - nx) <= 1 ? 1 : 0);
      L.set(x, y - 1, PAL.gold3);
      L.set(x, y, x === nx - 2 || x === nx + 2 ? PAL.gold4 : PAL.void3);
    }
    L.set(nx, ny + 1, PAL.white);
    L.set(nx + 1, ny + 1, PAL.gold4);
    L.set(nx, ny + 2, PAL.gold4);
    L.set(nx + 1, ny + 2, PAL.gold3);
    const glint = [-2, -1, 1, 2][f % 4];
    L.set(nx + glint, ny - 1 + (Math.abs(glint) > 1 ? 0 : 1), PAL.white);
  }
}

const art: CardArtV3 = {
  id: 'soul_leash',
  focus: FOCUS,
  focusSmall: FOCUS_SMALL,
  frames: 4,
  holdMs: 160,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
