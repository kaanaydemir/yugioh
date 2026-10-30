// Hortlak Muhafız — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted at the
// cut-in's own density (about 4× the sprite's): the skull, the horns, the pauldrons and the gorget are drawn again at this
// size, never the 1× sprite enlarged.
//
// The bust is the grave knight's close-up: a horned skull filling the middle (two lyre horns sweeping up and out past the
// frame's top, a jaw that opens), the rib-cage's top and a spiked iron collar below it, the two huge charcoal pauldrons
// with their spikes at both sides, the black-violet cloak with its dull crimson lining behind the far shoulder. The eye
// sockets crackle with violet-white lightning — the portrait's only light besides the rib gaps. One key light from the
// frame's top-left, flat value planes by pixel counts, 1-px ink outline, no dither, no gradient. P2 sees a RELIT set
// (p2: 'relight'): every band follows `lightFrom`; geometry and light (eyes, bolts) are the same.
//
// Rhythm (holds, played once, the last frame held), on the default cut-in beats — a slow menace, then the scream:
//   f0 the stare: eye sockets dark violet embers, jaw shut
//   f1 the eyes ignite, a first spark
//   f2 the lightning leaps out of the sockets, the jaw drops a little
//   f3 the jaw opens (the silent scream), bolts climb off the skull
//   f4 held at full: eyes white, jaw wide, the rib gaps blazing
//   f5 held
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) is the near eye's core.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { BONE, CLOAK, IRON, IRON_FAR, LINING, bands, type Pt, type Tones } from '../monsters-v3/grim_warden-kit';
import { bolt, fork } from '../monsters-v3/grim_warden-fx';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;

interface P {
  eye: number;
  jaw: number;
  bolts: number;
  rib: number;
}
const POSES: readonly P[] = [
  { eye: 0.4, jaw: 0, bolts: 0, rib: 0 },
  { eye: 1, jaw: 0, bolts: 1, rib: 0 },
  { eye: 1.3, jaw: 8, bolts: 2, rib: 1 },
  { eye: 1.5, jaw: 22, bolts: 3, rib: 2 },
  { eye: 1.5, jaw: 28, bolts: 3, rib: 3 },
  { eye: 1.5, jaw: 28, bolts: 3, rib: 3 },
];
const HOLDS: readonly number[] = [260, 120, 100, 100, 160, 620];

// skull-local geometry (the sprite's skull, drawn again here)
const CRAN: Pt[] = [[-7, 0], [-7, -5], [-4, -9], [1, -11], [6, -10], [9, -6], [10, -2], [10, 2], [8, 5], [4, 6], [-3, 6], [-6, 4]];
const JAW: Pt[] = [[-4, 5], [8, 5], [8, 7], [6, 10], [0, 11], [-3, 9]];
const HORN_N: Pt[] = [[2, -7], [7, -9], [12, -11], [15, -15], [16, -21]];
const HORN_F: Pt[] = [[-3, -7], [-8, -9], [-13, -11], [-16, -15], [-17, -21]];
const K = 4.4;
const CX = 108;
const CY = 82;
const sk = ([x, y]: Pt): Pt => [CX + x * K, CY + y * K];

function spline(pts: readonly Pt[], n = 8): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const lf = o?.lightFrom ?? 'left';
    const light = lightOf(lf);
    const P_ = POSES[Math.min(frame, POSES.length - 1)];

    /** a flat-banded part laid on the portrait */
    const part = (pts: readonly Pt[], t: Tones, litW = 5, shW = 6, extra?: (q: PixelCanvas) => void): void => {
      const q = new PixelCanvas(W, H);
      q.poly(pts as Pt[], t.M);
      bands(q, t, light, litW, shW);
      extra?.(q);
      p.blit(q, 0, 0);
    };

    // cloak behind the far shoulder, its crimson lining along the lit edge
    part([[0, 144], [0, 58], [26, 46], [58, 72], [70, 144]], CLOAK, 4, 6);
    part([[0, 144], [0, 118], [34, 122], [60, 144]], LINING, 3, 4);

    // far pauldron (left) with its three spikes
    part([[4, 144], [8, 100], [36, 82], [80, 92], [90, 144]], IRON_FAR, 6, 8);
    for (const [bx, by, tx, ty] of [[18, 100, 12, 62], [40, 88, 40, 46], [64, 90, 72, 56]] as const) part([[bx - 9, by + 4], [bx + 9, by + 4], [tx, ty]], IRON_FAR, 3, 4);
    // lames of the far pauldron: darker grooves
    const g = new PixelCanvas(W, H);
    g.line(14, 112, 74, 106, IRON_FAR.S).line(10, 126, 84, 120, IRON_FAR.S);
    p.blit(g, 0, 0);

    // near pauldron (right)
    for (const [bx, by, tx, ty] of [[150, 90, 156, 44], [172, 92, 184, 50], [192, 104, 200, 76]] as const) part([[bx - 10, by + 6], [bx + 10, by + 6], [tx, ty]], IRON, 3, 5);
    part([[118, 144], [126, 104], [156, 84], [196, 96], [200, 144]], IRON, 7, 9);
    const g2 = new PixelCanvas(W, H);
    g2.line(132, 108, 192, 108, IRON.S).line(128, 124, 198, 122, IRON.S);
    p.blit(g2, 0, 0);

    // rib cage's top and the spine's vertebrae under the skull
    part([[84, 144], [90, 118], [128, 114], [134, 144]], BONE, 3, 4);
    const rb = new PixelCanvas(W, H);
    for (const y of [124, 134]) rb.rect(92, y, 38, 2, PAL.void0);
    rb.rect(98, 108, 18, 10, BONE.S);
    p.blit(rb, 0, 0);
    // gorget: a plated iron collar
    part([[78, 118], [92, 104], [128, 104], [142, 118], [134, 130], [86, 130]], IRON, 4, 5);

    // far horn, mandible, skull, near horn
    const horn = (path: readonly Pt[], t: Tones): void => {
      const q = new PixelCanvas(W, H);
      q.stroke(spline(path.map(sk), 8), 26, 3, t.M);
      bands(q, t, light, 4, 5);
      p.blit(q, 0, 0);
    };
    horn(HORN_F, BONE);
    const ja = (P_.jaw * Math.PI) / 180;
    const jt: Pt[] = JAW.map(([x, y]) => {
      const dx = x + 5;
      const dy = y - 5;
      return sk([-5 + dx * Math.cos(ja) - dy * Math.sin(ja), 5 + dx * Math.sin(ja) + dy * Math.cos(ja)]);
    });
    if (P_.jaw > 4) {
      const m = new PixelCanvas(W, H);
      m.poly([sk([-4, 5]), sk([9, 5]), jt[1], jt[0]], PAL.ink);
      p.blit(m, 0, 0);
    }
    part(jt, BONE, 4, 5);
    part(CRAN.map(sk), BONE, 7, 8, (q) => {
      // sockets, nose, teeth: the skull's own dark and its teeth
      q.poly([sk([0, -5.5]), sk([5, -5.5]), sk([4.6, -1.6]), sk([0.4, -2.6])], PAL.void0);
      q.poly([sk([6.4, -5.5]), sk([9.6, -5.5]), sk([9, -2.4]), sk([7, -1.8])], PAL.void0);
      q.poly([sk([5, 0]), sk([6.8, 0]), sk([5.9, 2.8])], PAL.void0);
      // brow ridge (lit) over the sockets and a cheek crease below them
      q.poly([sk([-0.4, -6.4]), sk([5.2, -6.4]), sk([5, -5.4]), sk([-0.2, -5.2])], BONE.L);
      q.poly([sk([-4, 1.5]), sk([-0.5, 1.2]), sk([-0.5, 2.2]), sk([-4, 2.5])], BONE.D);
      for (const x of [-1, 2, 5, 8]) q.rect(Math.round(CX + x * K), Math.round(CY + 3.6 * K), Math.round(1.7 * K), Math.round(1.6 * K), PAL.skin4);
      for (const x of [1, 4, 7]) q.rect(Math.round(CX + x * K), Math.round(CY + 3.6 * K), Math.round(0.9 * K), Math.round(1.6 * K), PAL.void0);
      q.rect(Math.round(CX - 2 * K), Math.round(CY + 5.4 * K), Math.round(11 * K), 2, P_.jaw > 4 ? PAL.ink : BONE.D);
    });
    horn(HORN_N, BONE);

    p.outline(PAL.ink);

    // light: the eye sockets, the lightning, the rib gaps (never outlined)
    const ec = P_.eye > 1.2 ? PAL.white : P_.eye > 0.8 ? PAL.void4 : PAL.void3;
    const er = P_.eye > 0.8 ? PAL.void3 : PAL.void2;
    const eyeQuad = (pts: Pt[], x0: number, y0: number, w: number, h: number): void => {
      if (P_.eye > 0.3) p.poly(pts, er);
      p.rect(x0, y0, w, h, ec);
    };
    const n1 = sk([2, -4.6]);
    const f1 = sk([7.2, -4.4]);
    eyeQuad([sk([0.4, -5]), sk([4.6, -5]), sk([4.2, -2.2]), sk([0.8, -3])], Math.round(n1[0]), Math.round(n1[1]), 11, 8);
    eyeQuad([sk([6.8, -5]), sk([9.2, -5]), sk([8.8, -2.8]), sk([7.2, -2.4])], Math.round(f1[0]), Math.round(f1[1]), 8, 7);
    if (P_.eye >= 1.2) p.set(Math.round(n1[0]) + 4, Math.round(n1[1]) + 3, PAL.white).set(Math.round(n1[0]) + 5, Math.round(n1[1]) + 3, PAL.white);
    for (let i = 0; i < P_.bolts; i++) {
      const a: Pt = [Math.round(n1[0]) + 4 + i * 3, Math.round(n1[1])];
      const b: Pt = [a[0] - 10 + i * 14, a[1] - 26 - i * 6];
      const pts = bolt(p, a, b, frame * 11 + i * 3 + 2, 4, P_.eye >= 1.3);
      if (pts.length > 8) fork(p, pts[Math.floor(pts.length * 0.55)], [i % 2 ? 1 : -1, -1], 5, frame * 3 + i);
    }
    if (P_.bolts >= 3) {
      const a: Pt = [Math.round(f1[0]) + 5, Math.round(f1[1])];
      bolt(p, a, [a[0] + 22, a[1] - 18], frame * 5 + 1, 3, true);
    }
    // rib gaps blazing at the bottom
    for (const [y, x0] of [[124, 96], [134, 100]] as const) {
      const c = P_.rib >= 3 ? PAL.void4 : P_.rib >= 1 ? PAL.void3 : PAL.void1;
      p.rect(x0, y, 26, 2, c);
      if (P_.rib >= 2) p.rect(x0 + 6 + (frame % 3) * 4, y, 7, 2, PAL.white);
    }
  }
  return { id: 'grim_warden', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.void3, accentDark: PAL.void1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
