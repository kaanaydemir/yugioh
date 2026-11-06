// Ruh Tasması (soul_leash) — v3 card art (style sheet docs/v3/KART_RESIMLERI.md, contract ./_types.ts).
//
// "A glowing collar; a beast whose shadow has come away from its body walks ahead" (YENI_KARTLAR §7 S8).
// Ahead (right) strides the SHADOW: a flat void0 / void1 hound with a thin void3 rim — the darkest thing in the
// picture — and round its neck the COLLAR, the one bright thing: a 3-px gold and purple band with studs and a
// gold buckle with a white heart, its light spilling on the shadow's chest in two stepped void tones. A short,
// thick chain comes in from the right-hand frame edge (whoever holds it is out of the picture) to the ring
// under the buckle. Behind (left), one beat back, the BODY: the same hound in lit, dull stone tones, frozen
// mid-step, head up, eyes empty; it has no floor shadow of its own — a dark ribbon on the floor ties its feet to
// the shadow's feet.
//   backdrop  the SPELL recipe (teal portal well) centred behind the collar; floor band from y 48.
//   subject   the body hound (stone3 / stone2 planes, stone4 lit edge, ink outline, void3 rim), the shadow hound
//             (void1 / void0 planes, ink outline, void3 rim), both from one parametric hound; the floor ribbon.
//   light     never outlined: the collar (gold3 rim, void4 band with gold4 studs, void3 underside), the buckle
//             (gold4 frame, white heart), its stepped spill on the shadow (void2, void3), the chain (void4 /
//             gold3 links over void2), the shadow's eye (void4).
// Small (44×34): the same parametric hounds drawn again at 1× density from their own numbers (not a reduction),
// with a hand-placed 2-row collar, a 2×2 buckle (white + gold4) and a 1-px chain: the collar is the brightest spot.
// Living art: 4 frames × 160 ms — the shadow strides (its legs swap), a bead of light runs up the chain, the
// collar's glint steps round the band.

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

/**
 * The body stands one step back — the SAME hound at the same size, up and to the left (farther), its head and
 * hind quarters clear of the shadow; the shadow strides in front (right, lower: nearer).
 */
const CFG: Readonly<Record<Size, { k: number; kb: number; body: P; shadow: P; horizon: number }>> = {
  big: { k: 1.12, kb: 1.12, body: [1, 11], shadow: [21, 17], horizon: 46 },
  small: { k: 0.56, kb: 0.56, body: [0, 5], shadow: [10, 8], horizon: 23 },
};

/** The picture's focus (the collar's buckle) in BIG px — derived from the shadow's neck. */
const FOCUS = [CFG.big.shadow[0] + Math.round(35 * CFG.big.k), CFG.big.shadow[1] + Math.round(7 * CFG.big.k) + 2] as const;
const FOCUS_SMALL = [CFG.small.shadow[0] + Math.round(35 * CFG.small.k), CFG.small.shadow[1] + Math.round(7 * CFG.small.k) + 1] as const;
/** A small moon: the SPELL recipe's tones as a stepped disc small in the upper right over the chain's way in (no portal well). */
const MOON = [77, 11] as const;

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const k = C.k;
  // 1. backdrop: the spell's portal behind the collar, the floor
  paintBackdrop(l.backdrop, 'SPELL', { focus: MOON, horizon: C.horizon * (big ? 1 : 2), radius: 12, as: 'sun' });
  // 2. subject: the floor ribbon, the body (behind, left), then the shadow (ahead)
  const bf: P = [C.body[0] + Math.round(20 * C.kb), C.body[1] + Math.round(29 * C.kb)];
  const sf: P = [C.shadow[0] + Math.round(20 * k), C.shadow[1] + Math.round(29 * k)];
  const floor = new PixelCanvas(l.subject.w, l.subject.h);
  floor.thickLine(bf[0], bf[1], sf[0], sf[1], big ? 3 : 1, PAL.ink);
  floor.ellipse(sf[0] + 0.5, sf[1] + 0.5, big ? 14 : 7, big ? 2 : 1, PAL.ink);
  const body = new PixelCanvas(l.subject.w, l.subject.h);
  const bp = paintHound(body, C.body[0], C.body[1], C.kb, -1, false, { base: PAL.stone2, far: PAL.stone1 });
  litEdge(body, 1, { only: (c) => c === PAL.stone2 });
  ink(body);
  if (big) rim(body, PAL.void3);
  // empty eyes: a dark socket, no light in it
  body.set(bp.eye[0], bp.eye[1], PAL.stone0);
  if (big) body.set(bp.eye[0] - 1, bp.eye[1], PAL.stone1);
  const shadow = new PixelCanvas(l.subject.w, l.subject.h);
  const sp = paintHound(shadow, C.shadow[0], C.shadow[1], k, f % 2, true, { base: PAL.void0, far: PAL.void0 });
  if (big) {
    litEdge(shadow, 1, { only: (c) => c === PAL.void0 });
    ink(shadow);
    rim(shadow, PAL.void3);
  } else {
    // small, by hand: the legs are 2-px void1 bars with the ink outline OUTSIDE and one void3 highlight at the
    // top of the near legs (no purple rim round them: it read as furniture); the back keeps a void3 rim
    for (let y = 0; y < shadow.h; y++) for (let x = 0; x < shadow.w; x++) if (shadow.get(x, y) === PAL.void0 && y >= sp.neck[1] + 4) shadow.set(x, y, PAL.void1);
    ink(shadow);
    for (let x = 0; x < shadow.w; x++)
      for (let y = 0; y < sp.neck[1] + 3; y++) {
        const c = shadow.get(x, y);
        if (c === PAL.void0 || c === PAL.void1) {
          shadow.set(x, y, PAL.void3);
          break;
        }
      }
  }
  l.subject.blit(floor, 0, 0);
  l.subject.blit(body, 0, 0);
  l.subject.blit(shadow, 0, 0);

  // 3. light
  const L = l.light;
  const [nx, ny] = sp.neck;
  const onShadow = (x: number, y: number) => {
    const c = shadow.get(x, y);
    return c === PAL.void0 || c === PAL.void1 || c === PAL.void2;
  };
  if (big) {
    // the collar's light spilling on the shadow's chest and neck: two stepped rings, void2 then void3
    for (let y = ny - 7; y <= ny + 8; y++)
      for (let x = nx - 10; x <= nx + 10; x++) {
        if (!onShadow(x, y)) continue;
        const d = Math.hypot((x - nx) / 1.4, y - ny - 1);
        if (d <= 4.5) L.set(x, y, PAL.void3);
        else if (d <= 7) L.set(x, y, PAL.void2);
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
    const glint = [-5, -2, 2, 5][f % 4];
    L.set(nx + glint, ny - 1 + (Math.abs(glint) > 4 ? 1 : 0), PAL.white);
    // the buckle: a 3×3 gold4 frame with the white heart (the brightest point), the ring under it
    const bx = nx - 1;
    const by = ny + 2;
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) L.set(bx + xx, by + yy, PAL.gold4);
    L.set(bx + 1, by + 1, PAL.white);
    L.set(bx + 1, by, PAL.white);
    L.set(bx + 1, by + 3, PAL.gold3);
    const ring: P = [nx, ny + 5];
    // the chain: short and thick, in from the right-hand frame edge
    const a: P = [87, ring[1] - 9];
    const mid: P = [Math.round((a[0] + ring[0]) / 2), Math.round((a[1] + ring[1]) / 2) + 4];
    const pts: P[] = [];
    for (let i = 0; i <= 120; i++) {
      const t = i / 120;
      const x = Math.round((1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * mid[0] + t * t * ring[0]);
      const y = Math.round((1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * mid[1] + t * t * ring[1]);
      const last = pts[pts.length - 1];
      if (!last || last[0] !== x || last[1] !== y) pts.push([x, y]);
    }
    const bead = pts.length - 1 - Math.floor(((f % 4) / 4) * pts.length);
    pts.forEach(([x, y], i) => {
      if (i >= pts.length - 1) return;
      const g = i % 5 === 3 || i % 5 === 4;
      const hot = Math.abs(i - bead) <= 1;
      L.set(x, y, hot ? PAL.white : g ? PAL.gold3 : PAL.void4);
      L.set(x, y + 1, hot ? PAL.gold4 : g ? PAL.gold2 : PAL.void2);
    });
  } else {
    // small, by hand: a soft spill, a 2-row band, a 2×2 buckle, a 1-px chain from the right edge
    for (let y = ny - 3; y <= ny + 4; y++)
      for (let x = nx - 5; x <= nx + 5; x++) if (onShadow(x, y) && Math.hypot((x - nx) / 1.4, y - ny - 1) <= 3.2) L.set(x, y, PAL.void2);
    for (let x = nx - 3; x <= nx + 3; x++) {
      const y = ny + (Math.abs(x - nx) <= 1 ? 1 : 0);
      L.set(x, y - 1, PAL.gold3);
      L.set(x, y, x === nx - 2 || x === nx + 2 ? PAL.gold4 : PAL.void4);
    }
    L.set(nx, ny + 1, PAL.white);
    L.set(nx + 1, ny + 1, PAL.gold4);
    L.set(nx, ny + 2, PAL.gold4);
    L.set(nx + 1, ny + 2, PAL.gold3);
    const glint = [-3, -1, 1, 3][f % 4];
    L.set(nx + glint, ny - 1 + (Math.abs(glint) > 2 ? 0 : 1), PAL.white);
    const chain: readonly P[] = [
      [43, ny - 3], [42, ny - 2], [41, ny - 2], [40, ny - 1], [39, ny - 1], [38, ny], [37, ny], [36, ny + 1], [35, ny + 2], [34, ny + 2],
      [33, ny + 3], [32, ny + 3],
    ].filter(([x]) => x > nx + 1) as unknown as P[];
    const bead = (3 - (f % 4)) * 3;
    chain.forEach(([x, y], i) => L.set(x, y, i === bead ? PAL.white : i % 3 === 2 ? PAL.gold3 : PAL.void4));
  }
  // the shadow's eye
  L.set(sp.eye[0], sp.eye[1], PAL.void4);
  // two stars in the sky
  const stars: readonly P[] = big
    ? [
        [24, 10],
        [52, 6],
      ]
    : [
        [12, 5],
        [26, 3],
      ];
  stars.forEach(([x, y], i) => (i !== f % 2 || f < 2) && l.backdrop.set(x, y, PAL.mist));
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
