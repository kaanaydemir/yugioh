// Ruh Tasması (soul_leash) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// "A glowing collar; a beast whose shadow has come away from its body walks ahead" (YENI_KARTLAR §7 S8). Two
// hounds on the floor: behind (left) the BODY, grey stone tones, head hung low, its eye dull; ahead (right) its
// SHADOW, standing and striding, flat void planes with a void3 rim — round its neck the purple-gold COLLAR, the
// brightest point (gold buckle, white heart), held by a chain that sags in from the top-left corner. On the floor
// a dark ribbon ties the body's feet to the shadow's feet (the body has no shadow of its own).
//   backdrop  the SPELL recipe (teal portal well) centred behind the collar; floor band from y 50.
//   subject   the body hound (stone1/2/3 planes, ink outline, teal3 rim), the shadow hound (void0/1/2 planes,
//             ink outline, void3 rim), drawn from one parametric hound (torso, neck, head, ears, legs, tail).
//   light     never outlined: the chain (void4 links, a gold3 link every 4th), the collar band (void4 over
//             void3, gold3 studs), the buckle (gold3 / gold4, white heart), the shadow's eye (void4).
// Small (44×34): the same parametric hounds drawn again at 1× density from their own numbers (not a reduction):
// 1-px chain, a 3-px collar band, the buckle a 2×2; hand-placed eye and studs.
// Living art: 4 frames × 160 ms — the shadow strides (its legs swap), a bead of light runs down the chain, the
// collar's glint steps round the band.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ink, litEdge, paintBackdrop, rim } from './_kit';
import type { ArtLayers, CardArtV3 } from './_types';

type Size = 'big' | 'small';
type P = readonly [number, number];

/** The picture's focus (the collar's buckle) in BIG px. */
const FOCUS = [66, 37] as const;

interface Tones {
  base: number;
  far: number;
}

// One hound, facing right, as a polygon in a 47×33 box (BIG px at k = 1; feet on row 29; the head up or hung low).
const TORSO_UP: readonly P[] = [
  [6, 9], [10, 8], [18, 9], [26, 8], [30, 6], [33, 2], [36, 0], [37, -4], [39, 0], [41, 1], [46, 4], [47, 5], [46, 7],
  [40, 8], [36, 10], [34, 14], [31, 17], [24, 16], [16, 14], [9, 16], [6, 13],
];
const TORSO_LOW: readonly P[] = [
  [6, 10], [10, 9], [18, 10], [26, 9], [30, 8], [34, 9], [38, 10], [39, 7], [41, 10], [43, 11], [47, 16], [47, 17], [45, 18],
  [40, 17], [35, 16], [33, 17], [31, 18], [24, 17], [16, 15], [9, 17], [6, 14],
];

/** Draw a hound; returns its collar point and eye (world px). */
function paintHound(p: PixelCanvas, ox: number, oy: number, k: number, low: boolean, stride: number, t: Tones): { neck: P; eye: P } {
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
  limb(low ? [[7, 10], [3, 15], [2, 19]] : [[7, 9], [3, 4], [1, 1]], t.base);
  // the body
  p.poly((low ? TORSO_LOW : TORSO_UP).map(([x, y]) => [X(x), Y(y)] as P), t.base);
  // near legs
  limb([[10, 14], [7, 22], [9 + sw, 29]], t.base);
  limb([[32, 15], [32 - sw, 29]], t.base);
  const neck: P = low ? [X(35), Y(12)] : [X(34), Y(7)];
  const eye: P = low ? [X(42), Y(13)] : [X(41), Y(3)];
  return { neck, eye };
}

/** The body stands farther back (smaller, higher, cut by the back edge); the shadow strides in front. */
const CFG: Readonly<Record<Size, { k: number; kb: number; body: P; shadow: P; anchor: P; horizon: number }>> = {
  big: { k: 1.15, kb: 0.85, body: [-9, 27], shadow: [27, 28], anchor: [3, 6], horizon: 48 },
  small: { k: 0.56, kb: 0.42, body: [-4, 14], shadow: [14, 14], anchor: [1, 3], horizon: 24 },
};

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const k = C.k;
  // 1. backdrop: the spell's portal behind the collar, the floor
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 2], horizon: C.horizon * (big ? 1 : 2), radius: 28 });
  // 2. subject: the floor ribbon, the body (behind, left), then the shadow (ahead)
  const bf: P = [C.body[0] + Math.round(20 * C.kb), C.body[1] + Math.round(29 * C.kb)];
  const sf: P = [C.shadow[0] + Math.round(20 * k), C.shadow[1] + Math.round(29 * k)];
  const floor = new PixelCanvas(l.subject.w, l.subject.h);
  floor.thickLine(bf[0], bf[1], sf[0], sf[1], big ? 3 : 1, PAL.ink);
  floor.ellipse(sf[0], sf[1], big ? 13 : 6, big ? 2 : 1, PAL.ink);
  const body = new PixelCanvas(l.subject.w, l.subject.h);
  const bp = paintHound(body, C.body[0], C.body[1], C.kb, true, -1, { base: PAL.stone2, far: PAL.stone1 });
  litEdge(body, 1, { only: (c) => c === PAL.stone2 || c === PAL.stone1 });
  ink(body);
  if (big) rim(body, PAL.teal3);
  body.set(bp.eye[0], bp.eye[1], PAL.stone0);
  const shadow = new PixelCanvas(l.subject.w, l.subject.h);
  const sp = paintHound(shadow, C.shadow[0], C.shadow[1], k, false, f % 2, { base: PAL.void1, far: PAL.void0 });
  litEdge(shadow, 1, { only: (c) => c === PAL.void1 });
  ink(shadow);
  rim(shadow, PAL.teal3);
  l.subject.blit(floor, 0, 0);
  l.subject.blit(body, 0, 0);
  l.subject.blit(shadow, 0, 0);
  // 3. light: the chain from the corner to the collar, the collar, the buckle, the shadow's eye
  const L = l.light;
  const [nx, ny] = sp.neck;
  const ring: P = [nx + (big ? 1 : 0), ny + (big ? 4 : 2)];
  const a = C.anchor;
  const mid: P = [Math.round((a[0] + ring[0]) / 2), Math.round((a[1] + ring[1]) / 2 + (big ? 12 : 6))];
  const pts: P[] = [];
  const n = big ? 160 : 80;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round((1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mid[0] + t * t * ring[0]);
    const y = Math.round((1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * mid[1] + t * t * ring[1]);
    const last = pts[pts.length - 1];
    if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
  }
  const bead = Math.floor(((f % 4) / 4) * pts.length);
  pts.forEach(([x, y], i) => {
    if (i >= pts.length - 2) return;
    const c = Math.abs(i - bead) <= (big ? 1 : 0) ? PAL.white : i % 4 === 3 ? PAL.gold3 : i > pts.length * 0.6 || i % 2 ? PAL.void4 : PAL.void3;
    L.set(x, y, c);
  });
  // the collar: a band round the neck (front arc), studs, glint
  const crx = big ? 5 : 2;
  const cry = big ? 2 : 1;
  for (let i = 0; i <= 24; i++) {
    const ang = (i / 24) * Math.PI;
    const x = Math.round(nx + Math.cos(ang) * crx);
    const y = Math.round(ny + Math.sin(ang) * cry);
    L.set(x, y - 1, PAL.void4);
    if (big) L.set(x, y, PAL.void3);
  }
  if (big) {
    const glint = [-4, -2, 2, 4][f % 4];
    L.set(nx + glint, ny - 1 + (Math.abs(glint) > 3 ? 1 : 0), PAL.white);
    L.set(nx - 3, ny, PAL.gold3);
    L.set(nx + 3, ny, PAL.gold3);
    // buckle 3×3 (the brightest point: the white heart)
    const bx = nx - 1;
    const by = ny + 1;
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) L.set(bx + xx, by + yy, yy === 0 || xx === 0 ? PAL.gold4 : PAL.gold3);
    L.set(bx + 1, by + 1, PAL.white);
  } else {
    L.set(nx, ny + 1, PAL.white);
    L.set(nx + 1, ny + 1, PAL.gold4);
    L.set(nx, ny + 2, PAL.gold3);
  }
  // the shadow's eye
  L.set(sp.eye[0], sp.eye[1], PAL.void4);
  // two stars in the sky
  const stars: readonly P[] = big
    ? [
        [40, 8],
        [80, 12],
      ]
    : [
        [20, 4],
        [40, 6],
      ];
  stars.forEach(([x, y], i) => (i !== f % 2 || f < 2) && l.backdrop.set(x, y, PAL.mist));
}

const art: CardArtV3 = {
  id: 'soul_leash',
  focus: FOCUS,
  focusSmall: [33, 19],
  frames: 4,
  holdMs: 160,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
