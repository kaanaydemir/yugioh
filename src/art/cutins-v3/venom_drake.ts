// Zehir Ejderi (venom_drake) — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see
// src/art/cutins/index.ts). Blueprint docs/v3/kart-a/venom_drake.md §7 "Cut-in".
// Painted at the cut-in's own density (S = 4.4 px per unit) from the native bust shared with the card art
// (./_venom_drake-bust.ts): a low 3/4 close-up of the head entering from the bottom-left on its neck, the long
// jaw pointing to the right third with the throat sac under it; the segmented scorpion tail curls into the
// frame from the top-left over the head and the venom bulb with its hooked stinger hangs in the upper right
// third, dripping; the holed membrane cape at the left border. The forms and tones are the final sprite's
// (venomscale mag1 / void2 / void1 with the leaf2 toxic rim, stone chitin, leaf venom with the leaf3 + gold3
// hot band and ONE gold4 core: the lens glint lands on it — the brightest point of the last frame's head
// region is the bulb's core).
// P2: `p2: 'relight'` — the second set is drawn with `lightFrom: 'right'` (the planes' lit edges and the rim
// swap sides; the venom, the eye and the holes are self-lit and identical).
//
// Rhythm (holds, played once, the last frame held; the recipe's cut-in rhythm is flare 280 / slam 360 /
// exit 720, close 120 = 840 ms ≤ CUTIN_V3_MAX_MS 900):
//   f0 200  the cold stare: the slit eye, a drop swelling on the stinger, the band wipes in
//   f1  80  the sac inflates, the head draws back 1 px
//   f2  80  [flare 280] the pupil snaps thin, the BULB IGNITES (one gold4 pixel in the leaf3 / gold3 hot band)
//   f3 160  [slam 360] the jaws gape in the HISS, the sac flashes gold3, the tail drawn tight (motion lines on
//           the arch — no two-frame tremble); the drop lets go
//   f4 200  the hiss holds; the drop falls in front of the face and lands on the bust's lower edge
//   f5 120  [exit 720] held: the jaws half-closed, a new bead forming on the stinger; THE LOWER EDGE IS
//           CORRODED — 3 acid craters eaten through the portrait's bottom edge where the splash landed (each a
//           notch 3–5 px wide, a 1-px leaf3 rim, a leaf2 inner step, one gold3 lip pixel), a 2-px stone3 steam
//           wisp over the largest. The band itself is drawn by the shared cutin.ts under the portrait, so the
//           notches show the band behind them (real holes through the band would need a per-card band-mask
//           hook in cutin.ts: not asked).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { CutinArt, DrawOpts } from '../types';
import { BUST_REST, paintVenomBust, type BustPose } from './_venom_drake-bust';

const W = 200;
const H = 144;
const S = 4.4;
const OX = 4;
const OY = -4;

/** the lower edge of the bust: cut parallel to the band's lower border (slope −0.13 in P1) */
const cutY = (x: number): number => Math.floor(143 - 0.13 * x);

const POSES: readonly BustPose[] = [
  { ...BUST_REST, jaw: 0.12, sac: 1, eye: 0, hot: 0, bead: 2, hy: 3, hx: 1 },
  { ...BUST_REST, jaw: 0.12, sac: 2, eye: 0, hot: 0, bead: 3, hx: 0.75, hy: 3 },
  { ...BUST_REST, jaw: 0.22, sac: 2, eye: 1, hot: 2, bead: 3, hx: 0.75, hy: 3 },
  { ...BUST_REST, jaw: 1, sac: 3, sacHot: true, eye: 1, hot: 2, bead: 0, tight: 1, drop: 0.06, dropTo: 28.4, hx: 1.25, hy: 2.8 },
  { ...BUST_REST, jaw: 0.92, sac: 3, eye: 1, hot: 1, bead: 0, drop: 1, dropTo: 28.4, hx: 1.25, hy: 2.8 },
  { ...BUST_REST, jaw: 0.5, sac: 2, eye: 0, hot: 1, bead: 1, hy: 2.9, hx: 1 },
];
const HOLDS: readonly number[] = [200, 80, 80, 160, 200, 120];

/** the craters (f5): x centre on the cut edge, half width, depth (px) */
const CRATERS: readonly (readonly [number, number, number])[] = [
  [158, 2.5, 5],
  [149, 1.5, 3],
  [140, 2, 4],
];

function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
  const f = Math.max(0, Math.min(POSES.length - 1, frame));
  const P = POSES[f];
  const lightFrom = o?.lightFrom ?? 'left';
  const b = paintVenomBust(P, { S, w: W, h: H, ox: OX, oy: OY, lightFrom, rim: PAL.leaf2, cape: true });
  const pic = new PixelCanvas(W, H);
  pic.blit(b.matter, 0, 0);
  // the bust's slanted lower edge (an ink line along the cut where matter is cut)
  for (let x = 0; x < W; x++) {
    const yc = cutY(x);
    for (let y = yc; y < H; y++) pic.erase(x, y);
    if (pic.isOpaque(x, yc - 1)) pic.set(x, yc - 1, PAL.ink);
  }
  // light over the matter (venom, eye) — never outlined; cut by the same edge, except the falling drop
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = b.light.get(x, y);
    if (c === null || y >= cutY(x)) continue;
    pic.set(x, y, c);
  }
  // f4: the splash where the drop meets the edge (a 5-px crown, leaf3 / leaf2, one gold3)
  if (f === 4) {
    const x = b.sting[0];
    const y = cutY(x) - 2;
    pic.set(x, y, PAL.gold3).set(x - 1, y, PAL.leaf3).set(x + 1, y, PAL.leaf3).set(x - 2, y - 1, PAL.leaf3).set(x + 2, y - 1, PAL.leaf2).set(x - 3, y - 2, PAL.leaf2).set(x + 3, y - 3, PAL.leaf3).set(x, y - 2, PAL.leaf2);
    // the first splash pit already eats the nearest edge
    crater(pic, CRATERS[0][0], 1.5, 2, false);
  }
  // f5: the corroded edge
  if (f === 5) {
    CRATERS.forEach(([cx, hw, d], i) => crater(pic, cx, hw, d, i === 0));
  }
  p.blit(pic, 0, 0);
}

/**
 * An acid crater eaten into the bust's lower edge at x = cx: a notch hw px half-wide and d px deep (the
 * portrait is transparent inside), its wall a 1-px leaf3 rim with a leaf2 inner step, one gold3 lip pixel;
 * `steam`: a 2-px stone3 wisp rising over it.
 */
function crater(p: PixelCanvas, cx: number, hw: number, d: number, steam: boolean): void {
  // the bust's lower contour at column x (the lowest matter pixel + 1 in the jaw's band of rows)
  const baseOf = (x: number) => {
    for (let y = Math.min(H - 1, cutY(x) - 1); y >= 80; y--) if (p.isOpaque(x, y)) return y + 1;
    return cutY(x);
  };
  const bases = new Map<number, number>();
  const base = (x: number) => {
    let v = bases.get(x);
    if (v === undefined) bases.set(x, (v = baseOf(x)));
    return v;
  };
  for (let x = Math.floor(cx - hw - 3); x <= Math.ceil(cx + hw + 3); x++) base(x);
  const inside = (x: number, y: number) => {
    const dx = (x + 0.5 - cx) / (hw + 0.5);
    const dy = (base(x) - y - 0.5) / d;
    return dy >= -0.2 && dx * dx + dy * dy <= 1;
  };
  const x0 = Math.floor(cx - hw - 2);
  const x1 = Math.ceil(cx + hw + 2);
  const y0 = base(x1) - d - 3;
  const y1 = base(x0);
  const hole: [number, number][] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inside(x, y)) hole.push([x, y]);
  for (const [x, y] of hole) p.erase(x, y);
  // the rim (leaf3) on matter touching the hole, the inner step (leaf2) one further in
  const rim: [number, number][] = [];
  for (let y = y0 - 1; y <= y1; y++)
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      if (!p.isOpaque(x, y) || inside(x, y)) continue;
      if (inside(x - 1, y) || inside(x + 1, y) || inside(x, y + 1) || inside(x, y - 1)) rim.push([x, y]);
    }
  const rimSet = new Set(rim.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of rim) p.set(x, y, PAL.leaf3);
  for (const [x, y] of rim)
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0]] as const) {
      const q = `${x + dx},${y + dy}`;
      if (!rimSet.has(q) && p.isOpaque(x + dx, y + dy) && !inside(x + dx, y + dy) && p.get(x + dx, y + dy) !== PAL.ink) p.set(x + dx, y + dy, PAL.leaf2);
    }
  // one gold3 lip pixel at the crater's top
  const top = rim.reduce((a, q) => (q[1] < a[1] ? q : a), rim[0] ?? [cx, base(cx)]);
  if (rim.length) p.set(top[0], top[1], PAL.gold3);
  if (steam) {
    const sx = Math.round(cx);
    const sy = top[1] - 3;
    p.set(sx, sy, PAL.stone3).set(sx, sy - 1, PAL.stone3).set(sx + 1, sy - 3, PAL.stone2).set(sx + 1, sy - 4, PAL.stone2);
  }
}

const venomDrakeCutin: CutinArt = {
  id: 'venom_drake',
  w: W,
  h: H,
  frames: POSES.length,
  fps: 8,
  accent: PAL.leaf3,
  accentDark: PAL.void1, // = the DARK band's wedge tone (cutin.ts BAND_TONES), so ?dev=cutin shows the real contrast
  holds: HOLDS,
  p2: 'relight',
  draw,
};

export default venomDrakeCutin;
