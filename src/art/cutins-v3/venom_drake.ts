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
  { ...BUST_REST, jaw: 1, sac: 3, sacHot: true, acid: true, eye: 1, hot: 2, bead: 0, drop: 0.06, dropTo: 28.4, hx: 1.25, hy: 1.2 },
  { ...BUST_REST, jaw: 0.92, sac: 3, eye: 1, hot: 1, bead: 0, hx: 1.25, hy: 1.3 },
  { ...BUST_REST, jaw: 0.5, sac: 2, eye: 0, hot: 1, bead: 1, hx: 1.25, hy: 2.2 },
];
const HOLDS: readonly number[] = [200, 80, 80, 160, 200, 120];

/** the acid pits (f5) along the snout's top plane: x offset from the landing column, pit size (1 = 2×2, 2 = 3×2) */
const PITS: readonly (readonly [number, number])[] = [
  [-1, 2],
  [-8, 1],
  [6, 1],
];

function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
  const f = Math.max(0, Math.min(POSES.length - 1, frame));
  const P = POSES[f];
  const lightFrom = o?.lightFrom ?? 'left';
  const b = paintVenomBust(P, { S, w: W, h: H, ox: OX, oy: OY, lightFrom, rim: PAL.leaf2, cape: true, cutin: true });
  const pic = new PixelCanvas(W, H);
  pic.blit(b.matter, 0, 0);
  // the bust's slanted lower edge (an ink line along the cut where matter is cut)
  for (let x = 0; x < W; x++) {
    const yc = cutY(x);
    for (let y = yc; y < H; y++) pic.erase(x, y);
    if (pic.isOpaque(x, yc - 1)) pic.set(x, yc - 1, PAL.ink);
  }
  // light over the matter (venom, eye) — never outlined; cut by the same edge
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = b.light.get(x, y);
    if (c === null || y >= cutY(x)) continue;
    pic.set(x, y, c);
  }
  // (critic r5) the chitin's stone4 lit edge steps down to stone3 where it meets a dark pixel in the upper
  // right (the tail's chitin, the hook): the bulb's gold4 core stays the one isolated bright point there
  const dark = (x: number, y: number) => {
    const c = pic.get(x, y);
    return c === null || c === PAL.ink || c === PAL.stone1 || c === PAL.stone2 || c === PAL.stone0;
  };
  const dim: [number, number][] = [];
  for (let y = 0; y < 72; y++)
    for (let x = 72; x < W; x++) if (pic.get(x, y) === PAL.stone4 && (dark(x - 1, y) || dark(x + 1, y) || dark(x, y - 1) || dark(x, y + 1))) dim.push([x, y]);
  for (const [x, y] of dim) pic.set(x, y, PAL.stone3);
  // the drop's landing: the snout's top under the stinger (the first matter pixel below the bead)
  const lx = b.sting[0];
  const topAt = (x: number): number => {
    for (let y = b.sting[1] + 5; y < H; y++) if (b.matter.isOpaque(x, y)) return y;
    return cutY(x);
  };
  const ly = topAt(lx);
  // f4: the drop lands — a 2×3 leaf3 bead on the snout, its two 3-px splash arms and a leaf2 film spreading
  // on the top plane (exactly where the f5 pits will be eaten)
  if (f === 4) {
    pic.set(lx, ly - 3, PAL.leaf3).set(lx + 1, ly - 3, PAL.leaf2).set(lx, ly - 2, PAL.leaf3).set(lx + 1, ly - 2, PAL.leaf3).set(lx, ly - 1, PAL.gold3).set(lx + 1, ly - 1, PAL.leaf3);
    pic.set(lx - 1, ly - 1, PAL.leaf3).set(lx - 2, ly - 2, PAL.leaf3).set(lx - 3, ly - 3, PAL.leaf2);
    pic.set(lx + 2, ly - 1, PAL.leaf3).set(lx + 3, ly - 2, PAL.leaf3).set(lx + 4, ly - 3, PAL.leaf2);
    for (let x = lx - 4; x <= lx + 5; x++) pic.set(x, topAt(x) + 1, Math.abs(x - lx - 0.5) < 3 ? PAL.leaf3 : PAL.leaf2);
  }
  // f5: the acid has eaten the snout — separate pits, each an ink hole with a leaf3 lip on its lower side
  if (f === 5) {
    PITS.forEach(([dx, size], i) => {
      const x = lx + dx;
      const y = topAt(x) + 2;
      const wpx = size + 1;
      for (let k = 0; k < wpx; k++) pic.set(x + k, y, PAL.ink).set(x + k, y + 1, PAL.ink).set(x + k, y + 2, PAL.leaf3);
      pic.set(x - 1, y + 1, PAL.leaf2).set(x + wpx, y + 1, PAL.leaf2);
      if (i === 0) {
        pic.set(x + 1, y + 2, PAL.gold3);
        // a 1-px stepped steam wisp over the largest pit (stone3 low, stone2 high)
        pic.set(x + 1, y - 2, PAL.stone3).set(x + 1, y - 3, PAL.stone3).set(x + 2, y - 4, PAL.stone3).set(x + 2, y - 5, PAL.stone2).set(x + 1, y - 6, PAL.stone2).set(x + 1, y - 7, PAL.stone2);
      }
    });
  }
  p.blit(pic, 0, 0);
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
