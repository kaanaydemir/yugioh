// Sol Kol Mührü — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted at the cut-in's
// own density (about 3.2× the sprite's): the palm slab, the five fingers' plates, the bronze cuff and the glyph disc are drawn
// again at this size from the rig's skeleton (seal_arm_l-hand.ts handGeom: positions only), never the 1× sprite enlarged.
//
// A poster close-up of the hand: the palm disc fills the middle of the frame (the glyph and its socket in 3-px strokes), the
// five long fingers fan to the upper right and right, the forearm leaves the frame at the lower left under the bronze cuff.
// One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink outline, no dither, no gradient. P2
// sees a RELIT set (p2: 'relight'): every band follows `lightFrom`; geometry and light (glyph, halo) are the same.
//
// Rhythm (holds, played once, the last frame held) — a fist that opens one finger group at a time, then the seal blazes:
//   f0 a closed fist, the glyph a dim ember behind the knuckles
//   f1 the thumb uncurls
//   f2 index and middle unfold
//   f3 ring and pinky unfold: the whole hand is open, the glyph wakes
//   f4 the palm seal blazes, the first rings leave it
//   f5 held: the glyph at full flare, the five-ring halo stepped round the palm
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) lands on the glyph's hot core in the LAST frame
// (a mag4 pixel of the seal).

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { HAND_REST, NF, THUMB, handGeom, axisBands, type HandPose } from '../monsters-v3/seal_arm_l-hand';
import { BRONZE, GLYPH_ARM_L, MAG, OBS, bands, bar, fill, stoneCrumbs, type Pt } from '../monsters-v3/seal_arm_l-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
/** Cut-in density relative to the sprite, and where the wrist sits. */
const S = 3.4;
const WRIST: Pt = [68, 96];
const HAND_A = -38;

interface P {
  /** per finger curl 0 (open) … 1 (closed): pinky, ring, middle, index, thumb */
  k: readonly number[];
  glow: number;
  rings: number;
}
const POSES: readonly P[] = [
  { k: [1, 1, 1, 1, 1], glow: 0, rings: 0 },
  { k: [1, 1, 1, 1, 0], glow: 0, rings: 0 },
  { k: [1, 1, 0, 0, 0], glow: 1, rings: 0 },
  { k: [0, 0, 0, 0, 0], glow: 2, rings: 0 },
  { k: [0, 0, 0, 0, 0], glow: 3, rings: 2 },
  { k: [0, 0, 0, 0, 0], glow: 4, rings: 5 },
];
const HOLDS: readonly number[] = [280, 100, 100, 100, 150, 620];

const REST_FAN = [-39, -20, -3, 15, 67];
function handPose(k: readonly number[]): HandPose {
  const sgn = (i: number) => (i === THUMB ? -1 : 1);
  const closeK = k.reduce((a, b) => a + b, 0) / NF;
  return {
    ...HAND_REST,
    sp: REST_FAN.map((v, i) => (i === THUMB ? (-26 - v) * k[i] * 0.9 : -v * 0.9 * k[i]) + (i === THUMB ? 0 : 0)),
    b1: HAND_REST.b1.map((v, i) => v + sgn(i) * (i === THUMB ? 42 : 48) * k[i]),
    b2: HAND_REST.b2.map((v, i) => v + sgn(i) * (i === THUMB ? 52 : 62) * k[i]),
    b3: HAND_REST.b3.map((v, i) => v + sgn(i) * (i === THUMB ? 45 : 50) * k[i]),
    len: HAND_REST.len.map((_, i) => 1 - 0.1 * k[i] * (closeK > 0 ? 1 : 0)),
  };
}

const T = (p: Pt, ox: number, oy: number): Pt => [WRIST[0] + (p[0] - ox) * S, WRIST[1] + (p[1] - oy) * S];

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const light = lightOf(o?.lightFrom ?? 'left');
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const g = handGeom([0, 0], HAND_A, handPose(P_.k));
    const tr = (q: Pt): Pt => T(q, 0, 0);
    const closed = P_.k.every((v) => v >= 1);

    const slab = (pts: Pt[], t: typeof OBS, litW: number, shW: number, crumbs = true): void => {
      const q = new PixelCanvas(W, H);
      fill(q, pts, t.M);
      bands(q, t, light, litW, shW, { top: litW, bottom: shW });
      if (crumbs) stoneCrumbs(q);
      p.blit(q, 0, 0);
    };
    const finger = (i: number): void => {
      const pts = g.f[i].map(tr);
      const W0 = [3.5, 4.0, 4.3, 4.1, 5.2][i] * S;
      for (let j = 0; j < 3; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        const wa = W0 * (1 - j * 0.09);
        const wb = W0 * (1 - (j + 1) * 0.09 - (j === 2 ? 0.12 : 0));
        const q = new PixelCanvas(W, H);
        bar(q, a, b, wa, wb, OBS.M);
        axisBands(q, a, b, wa, wb, OBS, light);
        // the plate's own parting line (a crease on its shadow side)
        const edge = new PixelCanvas(W, H);
        edge.blit(q, 0, 0);
        // crease ring over what is behind
        const rim = new PixelCanvas(W, H);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!q.isOpaque(x, y) && p.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) rim.set(x, y, OBS.D);
        p.blit(rim, 0, 0);
        p.blit(q, 0, 0);
      }
      // the fingertip bead
      const e = pts[3];
      const d = pts[2];
      const l = Math.hypot(e[0] - d[0], e[1] - d[1]) || 1;
      const bx = Math.round(e[0] - ((e[0] - d[0]) / l) * 5);
      const by = Math.round(e[1] - ((e[1] - d[1]) / l) * 5);
      const c = P_.glow >= 3 ? PAL.mag3 : P_.glow >= 2 ? PAL.mag2 : PAL.mag1;
      p.rect(bx - 1, by - 1, 3, 3, c);
    };

    // forearm leaving at the lower left: two slabs, the far one a value darker
    const fa = tr([-32, 12.5]);
    const fb = tr([-1, 0.4]);
    const half = 5.6 * S;
    const dx = fb[0] - fa[0];
    const dy = fb[1] - fa[1];
    const L = Math.hypot(dx, dy);
    const nx = -dy / L;
    const ny = dx / L;
    const at = (t: number, v: number): Pt => [fa[0] + dx * t + nx * v * half, fa[1] + dy * t + ny * v * half];
    const arm = (t0: number, t1: number, w: number): void => {
      const a = at(t0, 0);
      const b = at(t1, 0);
      const q = new PixelCanvas(W, H);
      bar(q, a, b, w * 2 * half, w * 2 * half, OBS.M);
      axisBands(q, a, b, w * 2 * half, w * 2 * half, OBS, light);
      const rim = new PixelCanvas(W, H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!q.isOpaque(x, y) && p.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) rim.set(x, y, OBS.D);
      p.blit(rim, 0, 0);
      p.blit(q, 0, 0);
    };
    arm(0, 0.38, 1.02);
    arm(0.36, 0.7, 1);
    arm(0.68, 1, 0.94);

    // far fingers first (pinky, ring), then the palm slab, then middle / index, the cuff, the thumb
    if (!closed) {
      finger(0);
      finger(1);
    }
    slab(g.palm.map(tr), OBS, 9, 8);
    // the wrist cuff: a bronze band across the wrist
    {
      const ang = -32 * (Math.PI / 180);
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      const vx = -cy;
      const vy = cx;
      const w = tr([0, 0]);
      const pt = (a: number, b: number): Pt => [w[0] + cx * a + vx * b, w[1] + cy * a + vy * b];
      const q = new PixelCanvas(W, H);
      fill(q, [pt(-9, -21), pt(5, -19), pt(5, 20), pt(-9, 22)], BRONZE.M);
      bands(q, BRONZE, light, 4, 4, { top: 3, bottom: 3 });
      p.blit(q, 0, 0);
    }
    if (!closed) {
      finger(2);
      finger(3);
    }
    // thenar pad
    {
      const q = new PixelCanvas(W, H);
      const at2 = (a: number, b: number): Pt => tr([g.u[0] * a + g.v[0] * b, g.u[1] * a + g.v[1] * b]);
      fill(q, [at2(1.2, 4.6), at2(5.4, 4.4), at2(7.6, 7.6), at2(6.4, 10.4), at2(2.4, 10.8), at2(0.8, 8.0)], OBS.M);
      bands(q, OBS, light, 6, 6, { top: 4, bottom: 4 });
      stoneCrumbs(q);
      const rim = new PixelCanvas(W, H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!q.isOpaque(x, y) && p.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) rim.set(x, y, OBS.D);
      p.blit(rim, 0, 0);
      p.blit(q, 0, 0);
    }
    if (closed) for (let i = 3; i >= 0; i--) finger(i);
    finger(THUMB);

    // the glyph disc: bronze ring, dark socket
    const dc = tr(g.disc);
    const R = 4.6 * S;
    const ring = new PixelCanvas(W, H);
    ring.disc(dc[0], dc[1], R, BRONZE.M);
    bands(ring, BRONZE, light, 4, 4, { top: 3, bottom: 3 });
    p.blit(ring, 0, 0);
    p.disc(dc[0], dc[1], R - 4.5, PAL.mag0);

    p.outline(PAL.ink);

    // ---- light layer: the glyph (3-px strokes), the inner cool ring, the hot core, the halo rings, the tip beads
    const lv = P_.glow;
    const stroke = [PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3, PAL.mag4][lv];
    if (lv >= 2) {
      const cool = new PixelCanvas(W, H);
      cool.disc(dc[0], dc[1], R - 4.5, PAL.void2);
      cool.disc(dc[0], dc[1], R - 8.5, PAL.mag0);
      p.blit(cool, 0, 0);
    }
    const cell = 3.4;
    const gx = dc[0] - 2.5 * cell;
    const gy = dc[1] - 2.5 * cell;
    for (let j = 0; j < 5; j++)
      for (let i = 0; i < 5; i++) {
        if (GLYPH_ARM_L[j][i] !== '#') continue;
        const x0 = Math.round(gx + i * cell);
        const y0 = Math.round(gy + j * cell);
        const edge = lv >= 1 && lv <= 3 && j >= 2 && (i === 0 || i === 4);
        p.rect(x0, y0, 3, 3, edge ? MAG[Math.max(1, lv)] : stroke);
      }
    if (lv >= 3) p.rect(Math.round(dc[0]) - 1, Math.round(dc[1]) - 1, 3, 3, PAL.mag4);
    if (lv >= 4) {
      p.rect(Math.round(dc[0]) - 4, Math.round(dc[1]), 3, 2, PAL.mag4);
      p.rect(Math.round(dc[0]) + 2, Math.round(dc[1]), 3, 2, PAL.mag4);
    }
    // halo rings, the youngest brightest
    for (let r = 0; r < P_.rings; r++) {
      const rad = R + 7 + r * 8;
      const tone = r === P_.rings - 1 ? PAL.mag3 : r >= P_.rings - 3 ? PAL.mag2 : PAL.mag1;
      for (let a = 0; a < 360; a += 1) {
        const x = Math.round(dc[0] + Math.cos((a * Math.PI) / 180) * rad);
        const y = Math.round(dc[1] + Math.sin((a * Math.PI) / 180) * rad);
        if (x >= 0 && y >= 0 && x < W && y < H && !p.isOpaque(x, y)) p.set(x, y, tone);
      }
    }
  }
  return { id: 'seal_arm_l', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.mag3, accentDark: PAL.mag1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
