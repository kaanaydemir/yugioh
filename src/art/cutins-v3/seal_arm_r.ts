// Sağ Kol Mührü — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted at the cut-in's
// own density (about 3.3× the sprite's): the four knuckle plates, the finger plates, the thumb slab, the forearm's creases, the
// bronze wrist band, the glyph stud and the cracked floor's lips are laid out again at this size from the rig's design (a
// clenched fist on a column, a band with the seal between them) — never the 1× sprite enlarged.
//
// A poster close-up: the fist fills the middle of the frame, the forearm leaves it through the crack in the floor at the bottom,
// rubble on the lips. One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink outline, no dither,
// no gradient. P2 sees a RELIT set (p2: 'relight'): every band follows `lightFrom`; geometry and light are the same.
//
// Rhythm (holds, played once, the last frame held) — a fist breaking out of the floor, then the seal blazes:
//   f0 the floor alone: a light seam crawls along the crack, the hole is dark
//   f1 the knuckles breach the lip (only the top of the fist shows), rubble leaps
//   f2 the fist is half out, the band still under the lip
//   f3 the fist is fully clenched: the knuckle plates tighten, the stud wakes
//   f4 the stud blazes, the first ring leaves it
//   f5 held: the glyph at full flare, the five-ring halo stepped round the stud
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) lands on the stud's hot core in the LAST frame
// (a mag4 pixel of the seal).

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { BRONZE, GLYPH_ARM_R, MAG, OBS, OBS_FAR, bands, chamfer, fillPoly, layer, release, type Pt } from '../monsters-v3/seal_arm_r-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
/** The floor's lip row; the arm is swallowed below it. */
const LIP = 116;
const HOLE: readonly [number, number] = [62, 138];
const HOLDS: readonly number[] = [240, 100, 110, 100, 150, 600];
/** The arm's rise: how far below its final place it still is. */
const DROP = [70, 58, 38, 0, 0, 0];
const GLOW = [0, 1, 1, 2, 4, 4];
const RINGS = [0, 0, 0, 0, 2, 5];
const SEAM = [3, 2, 2, 2, 3, 3];

type Light = ReturnType<typeof lightOf>;

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const light = lightOf(o?.lightFrom ?? 'left');
    const f = Math.min(frame, DROP.length - 1);
    const drop = DROP[f];
    const lv = GLOW[f];

    // ---- the arm: drawn on its own canvas, then swallowed below the lip
    const arm = new PixelCanvas(W, H);
    const part = (pts: readonly Pt[], t: typeof OBS, litW: number, shW: number, top = 1, bottom = 1): void => {
      const q = layer(W, H);
      fillPoly(q, pts, t.M);
      bands(q, t, light, litW, shW, { top, bottom });
      arm.blit(q, 0, 0);
      release(q);
    };
    const dy = drop;
    const Y = (v: number): number => v + dy;
    const tight = f >= 3 ? 1 : 0;

    // forearm column with its three creases
    part([[72, Y(66)], [128, Y(66)], [133, Y(120)], [67, Y(120)]], OBS, 8, 7, 3, 3);
    for (const [cy, a, b] of [[92, 70, 130], [106, 68, 132]] as const) arm.rect(a, Y(cy), b - a, 2, OBS.D);
    // the band
    part(chamfer(60, Y(70), 140, Y(94), [3, 3, 3, 3]), BRONZE, 5, 5, 3, 3);
    // fist body (fills the gaps between the plates), thumb slab, finger plates, knuckle plates
    part(chamfer(52, Y(16), 148, Y(72), [10, 10, 6, 6]), OBS_FAR, 5, 5, 2, 2);
    for (let i = 0; i < 4; i++) {
      const x0 = 56 + i * 24 + (i < 2 ? tight : -tight);
      part(chamfer(x0, Y(40 + tight), x0 + 21, Y(64), [3, 3, 2, 2]), OBS, 4, 4, 2, 2);
    }
    part([[50, Y(60)], [102, Y(56)], [114, Y(68)], [104, Y(78)], [56, Y(78)]], OBS, 7, 6, 3, 3);
    for (let i = 0; i < 4; i++) {
      const x0 = 52 + i * 25 + (i < 2 ? tight : -tight);
      part(chamfer(x0, Y(12 + tight * 2), x0 + 22, Y(40 + tight), [7, 7, 2, 2]), OBS, 5, 5, 3, 3);
    }
    // the plates' scars: two cracks glowing with the seal light
    const scar = MAG[Math.max(1, Math.min(3, lv + 1))];
    for (const [sx, sy, len] of [[84, 22, 9], [128, 30, 7]] as const) for (let j = 0; j < len; j++) arm.set(sx + (j % 3 === 2 ? 1 : 0), Y(sy + j), scar);

    // the glyph stud: bronze ring, dark socket
    const sx = 100;
    const sy = Y(82);
    {
      const q = layer(W, H);
      fillPoly(q, chamfer(sx - 11, sy - 11, sx + 11, sy + 11, [3, 3, 3, 3]), BRONZE.M);
      bands(q, BRONZE, light, 3, 3, { top: 2, bottom: 2 });
      arm.blit(q, 0, 0);
      release(q);
      arm.rect(sx - 7, sy - 7, 14, 14, PAL.mag0);
    }
    // swallowed by the hole: nothing of the arm below the lip
    for (let y = LIP + 1; y < H; y++) for (let x = 0; x < W; x++) arm.erase(x, y);
    p.blit(arm, 0, 0);

    // ---- the floor: two lips of slabs, the dark hole between them, rubble in front
    const floor = (x0: number, x1: number, d: boolean): void => {
      const q = layer(W, H);
      fillPoly(q, chamfer(x0, LIP, x1, H, d ? [0, 6, 0, 0] : [6, 0, 0, 0]), OBS.M);
      bands(q, OBS, light, 3, 3, { top: 3, bottom: 2 });
      // slab joints
      for (let y = LIP + 10; y < H; y += 11) for (let x = x0; x < x1; x++) if (q.isOpaque(x, y)) q.set(x, y, OBS.D);
      p.blit(q, 0, 0);
      release(q);
    };
    {
      // the hole's dark interior first (behind the lips), seam light on its rim
      const q = layer(W, H);
      fillPoly(q, chamfer(HOLE[0], LIP - 2, HOLE[1], H, [4, 4, 0, 0]), PAL.void0);
      p.blit(q, 0, 0);
      release(q);
      p.rect(HOLE[0] + 3, LIP - 1, HOLE[1] - HOLE[0] - 6, 1, MAG[SEAM[f]]);
    }
    floor(0, HOLE[0] + 2, false);
    floor(HOLE[1] - 2, W, true);
    // seam lines along the floor, lit by the seal (stepped, whole pixels)
    const seamTone = MAG[SEAM[f]];
    const seam = (pts: readonly Pt[]): void => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[i + 1];
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let j = 0; j <= n; j++) p.set(Math.round(ax + ((bx - ax) * j) / n), Math.round(ay + ((by - ay) * j) / n), seamTone);
      }
    };
    seam([[64, 124], [50, 128], [38, 127], [24, 134], [8, 133]]);
    seam([[136, 124], [150, 129], [164, 128], [178, 135], [196, 134]]);
    if (f >= 3) seam([[100, 138], [96, 142]]);
    // the hole's side walls catch the seal's light, the slabs are split by hairline cracks
    for (let y = LIP + 1; y < H; y++) {
      p.set(HOLE[0] + 2, y, MAG[Math.max(1, SEAM[f] - 1)]);
      p.set(HOLE[1] - 3, y, MAG[Math.max(1, SEAM[f] - 1)]);
    }
    for (const [cx0, cy0, cl] of [[30, LIP + 2, 9], [14, LIP + 12, 7], [176, LIP + 3, 8], [190, LIP + 14, 6]] as const) for (let j = 0; j < cl; j++) p.set(cx0 + (j % 4 === 3 ? 1 : 0), cy0 + j, OBS.D);
    // rubble slabs on the lips, leaping on f1-2
    const hop = [0, 6, 9, 3, 1, 0][f];
    for (const [rx, ry, rw, rh] of [[44, LIP - 8, 22, 11], [132, LIP - 9, 24, 12], [26, LIP - 2, 12, 7], [168, LIP - 2, 14, 8], [112, LIP + 14, 16, 8]] as const) {
      const q = layer(W, H);
      fillPoly(q, chamfer(rx, ry - hop, rx + rw, ry + rh - hop, [2, 2, 1, 1]), OBS.M);
      bands(q, OBS, light, 3, 3, { top: 2, bottom: 2 });
      p.blit(q, 0, 0);
      release(q);
    }
    if (f >= 1 && f <= 3) for (const [px, py] of [[34, 92], [158, 88], [64, 82], [140, 78]] as const) p.rect(px, py - hop * (f === 1 ? 2 : 1), 3, 3, OBS.L);

    p.outline(PAL.ink);

    // ---- light layer: the stud's glyph (3-px strokes), its cool ring, the hot core, the halo rings
    if (f >= 3) {
      const stroke = [PAL.mag1, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag4][lv];
      if (lv >= 2) p.rect(sx - 7, sy - 7, 14, 14, PAL.mag1);
      const cell = 2.8;
      const gx = sx - 2.5 * cell;
      const gy = sy - 2.5 * cell;
      for (let j = 0; j < 5; j++)
        for (let i = 0; i < 5; i++) {
          if (GLYPH_ARM_R[j][i] !== '#') continue;
          p.rect(Math.round(gx + i * cell), Math.round(gy + j * cell), 3, 3, stroke);
        }
      if (lv >= 3) p.rect(sx - 1, sy - 1, 3, 3, PAL.mag4);
      if (lv >= 4) {
        p.rect(sx - 5, sy, 3, 2, PAL.mag4);
        p.rect(sx + 3, sy, 3, 2, PAL.mag4);
      }
      for (let r = 0; r < RINGS[f]; r++) {
        const rad = 17 + 8 + r * 8;
        const tone = r === RINGS[f] - 1 ? PAL.mag3 : r >= RINGS[f] - 3 ? PAL.mag2 : PAL.mag1;
        for (let a = 0; a < 360; a++) {
          const x = Math.round(sx + Math.cos((a * Math.PI) / 180) * rad);
          const y = Math.round(sy + Math.sin((a * Math.PI) / 180) * rad);
          if (x >= 0 && y >= 0 && x < W && y < H && !p.isOpaque(x, y)) p.set(x, y, tone);
        }
      }
    }
    void (null as unknown as Light);
  }
  return { id: 'seal_arm_r', w: W, h: H, frames: HOLDS.length, fps: 8, accent: PAL.mag3, accentDark: PAL.mag1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
