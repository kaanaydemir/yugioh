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
const FOCUS = [63, 33] as const;

interface Hound {
  /** torso centre, half sizes */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** floor row under the feet */
  floor: number;
  /** head hung low (the body) or up (the shadow) */
  low: boolean;
  /** stride phase: 0 / 1 swap the leg pairs (the shadow walks), -1 = standing square */
  stride: number;
}

interface Tones {
  base: number;
  lit: number;
  dark: number;
  rim: number;
}

/** One hound, facing right, on its own canvas (k = 1 big, 0.5 small). Returns its neck (collar) point. */
function paintHound(p: PixelCanvas, h: Hound, t: Tones, k: number): { neck: P; eye: P } {
  const s = (v: number) => Math.round(v * k);
  const lw = Math.max(1, s(3.4));
  const { cx, cy, rx, ry, floor } = h;
  // legs: back pair darker (behind), front pair base; stride swings them
  const sw = h.stride < 0 ? 0 : h.stride === 0 ? s(4) : -s(4);
  const leg = (x0: number, dx: number, tone: number) => p.thickLine(x0, cy + s(2), x0 + dx, floor, lw, tone);
  leg(cx - s(7), -sw, t.dark);
  leg(cx + s(6), sw, t.dark);
  // tail
  p.thickLine(cx - rx + s(1), cy - s(2), cx - rx - s(6), cy - s(h.low ? 2 : 8), Math.max(1, s(2.4)), t.base);
  // torso
  p.ellipse(cx, cy, rx, ry, t.base);
  // neck + head
  const head: P = h.low ? [cx + rx + s(5), cy + s(2)] : [cx + rx + s(4), cy - s(10)];
  const shoulder: P = [cx + rx - s(4), cy - s(2)];
  p.thickLine(shoulder[0], shoulder[1], head[0], head[1], Math.max(2, s(7)), t.base);
  p.disc(head[0], head[1], s(4.5), t.base);
  // snout (a wedge forward), ears (two short points up / back)
  const sn = h.low ? 1 : -1;
  p.poly(
    [
      [head[0] + s(2), head[1] - s(3)],
      [head[0] + s(10), head[1] + s(h.low ? 4 : -1)],
      [head[0] + s(9), head[1] + s(h.low ? 6 : 2)],
      [head[0] + s(1), head[1] + s(3)],
    ],
    t.base,
  );
  p.tri(head[0] - s(3), head[1] - s(3), head[0] - s(1), head[1] - s(9) + (h.low ? s(4) : 0), head[0] + s(1), head[1] - s(3), t.base);
  if (k === 1) p.tri(head[0] - s(5), head[1] - s(2), head[0] - s(5), head[1] - s(7) + (h.low ? s(4) : 0), head[0] - s(2), head[1] - s(3), t.dark);
  // front legs over the torso
  leg(cx - s(3), sw, t.base);
  leg(cx + s(9), -sw, t.base);
  // planes: a belly shadow band
  for (let x = cx - rx + s(2); x <= cx + rx - s(2); x++) {
    const y = cy + ry - Math.max(1, s(2));
    if (p.get(x, y) === t.base) p.set(x, y, t.dark);
    if (k === 1 && p.get(x, y + 1) === t.base) p.set(x, y + 1, t.dark);
  }
  const neck: P = [Math.round((shoulder[0] + head[0]) / 2) + s(1), Math.round((shoulder[1] + head[1]) / 2) + (h.low ? 0 : s(1))];
  const eye: P = [head[0] + s(2), head[1] - s(1) + (sn > 0 ? s(1) : 0)];
  return { neck, eye };
}

const CFG: Readonly<Record<Size, { k: number; body: Hound; shadow: Hound; anchor: P; horizon: number }>> = {
  big: {
    k: 1,
    body: { cx: 22, cy: 47, rx: 11, ry: 6, floor: 61, low: true, stride: -1 },
    shadow: { cx: 54, cy: 44, rx: 11, ry: 6, floor: 57, low: false, stride: 0 },
    anchor: [3, 7],
    horizon: 50,
  },
  small: {
    k: 0.5,
    body: { cx: 11, cy: 24, rx: 6, ry: 3, floor: 31, low: true, stride: -1 },
    shadow: { cx: 27, cy: 22, rx: 6, ry: 3, floor: 29, low: false, stride: 0 },
    anchor: [1, 3],
    horizon: 25,
  },
};

function paint(size: Size, l: ArtLayers, f: number): void {
  const C = CFG[size];
  const big = size === 'big';
  const k = C.k;
  const sh: Hound = { ...C.shadow, stride: f % 2 };
  // 1. backdrop: the spell's portal behind the collar, the floor
  paintBackdrop(l.backdrop, 'SPELL', { focus: [FOCUS[0], FOCUS[1] + 2], horizon: C.horizon * (big ? 1 : 2), radius: 28 });
  // 2. subject: the body (behind, left), then the shadow (ahead)
  const body = new PixelCanvas(l.subject.w, l.subject.h);
  const bp = paintHound(body, C.body, { base: PAL.stone2, lit: PAL.stone3, dark: PAL.stone1, rim: PAL.teal3 }, k);
  litEdge(body, 1, { only: (c) => c === PAL.stone2 || c === PAL.stone1 });
  ink(body);
  if (big) rim(body, PAL.teal3);
  // the body's dull eye (no light)
  body.set(bp.eye[0], bp.eye[1], PAL.stone0);
  const shadow = new PixelCanvas(l.subject.w, l.subject.h);
  const sp = paintHound(shadow, sh, { base: PAL.void1, lit: PAL.void2, dark: PAL.void0, rim: PAL.void3 }, k);
  litEdge(shadow, 1, { only: (c) => c === PAL.void1 || c === PAL.void0 });
  ink(shadow);
  rim(shadow, PAL.void3);
  // the floor ribbon between the feet (on the backdrop: it lies on the floor)
  const bf: P = [C.body.cx, C.body.floor];
  const sf: P = [sh.cx, sh.floor];
  l.backdrop.thickLine(bf[0], bf[1], sf[0], sf[1], big ? 3 : 1, PAL.ink);
  l.backdrop.ellipse(sf[0], sf[1], big ? 12 : 6, big ? 2 : 1, PAL.ink);
  l.subject.blit(body, 0, 0);
  l.subject.blit(shadow, 0, 0);
  // 3. light: the chain from the corner to the collar, the collar, the buckle, the shadow's eye
  const L = l.light;
  const [nx, ny] = sp.neck;
  const ring: P = [nx + (big ? 1 : 0), ny + (big ? 4 : 2)];
  const a = C.anchor;
  const mid: P = [Math.round((a[0] + ring[0]) / 2), Math.round((a[1] + ring[1]) / 2 + (big ? 12 : 6))];
  const pts: P[] = [];
  const n = big ? 120 : 60;
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
    const c = Math.abs(i - bead) <= (big ? 1 : 0) ? PAL.white : i % 4 === 3 ? PAL.gold3 : PAL.void4;
    L.set(x, y, c);
  });
  // the collar: a band round the neck (front arc), studs, glint
  const crx = big ? 5 : 3;
  const cry = big ? 2 : 1;
  for (let i = 0; i <= 24; i++) {
    const ang = (i / 24) * Math.PI;
    const x = Math.round(nx + Math.cos(ang) * crx);
    const y = Math.round(ny + Math.sin(ang) * cry);
    L.set(x, y - 1, PAL.void4);
    if (big) L.set(x, y, PAL.void3);
  }
  const glint = [-crx + 1, -1, 1, crx - 1][f % 4];
  L.set(nx + glint, ny - 1 + (Math.abs(glint) > 2 ? 1 : 0), PAL.white);
  if (big) {
    L.set(nx - 3, ny, PAL.gold3);
    L.set(nx + 3, ny, PAL.gold3);
    // buckle 3×3 + the ring under it (the brightest point: the white heart)
    const bx = nx;
    const by = ny + 1;
    for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) L.set(bx + xx, by + yy, yy === 0 || xx === 0 ? PAL.gold4 : PAL.gold3);
    L.set(bx + 1, by + 1, PAL.white);
  } else {
    L.set(nx, ny + 1, PAL.gold4);
    L.set(nx + 1, ny + 1, PAL.white);
    L.set(nx, ny + 2, PAL.gold3);
    L.set(nx + 1, ny + 2, PAL.gold3);
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
  frames: 4,
  holdMs: 160,
  big: (l, f) => paint('big', l, f),
  small: (l, f) => paint('small', l, f),
};

export default art;
