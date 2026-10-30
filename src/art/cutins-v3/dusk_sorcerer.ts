// Akşam Büyücüsü — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted
// at the cut-in's own pixel density (3× the sprite's: every band, brim and lapel is drawn at this density, never the
// 1× sprite enlarged).
//
// The bust is the "comet coat" master's close-up: the wide violet brim and the leaning cone fill the top (its tip
// curls out of the frame to the left, the gold buckle and the star at its end), two violet eyes burn in the
// shadow under the brim above the silver beard, the winged collar flares behind the head, the midnight coat and
// its violet vest with a silver lapel line close the bottom — and at the right the casting hand's VIOLET FLAME and
// the CRESCENT-MOON STAFF (the sprite's own geometry, big) that hangs beside it. One key light from the frame's
// top-left, flat value planes by pixel counts, 1-px ink outline, no dither, no gradient. P2 sees a RELIT set
// (p2: 'relight'): every band follows `lightFrom`; geometry and light (eyes, flame, moon glints) are the same.
//
// Rhythm (holds, played once, the last frame held), on the default cut-in beats — a patient menace:
//   f0 the stare: eyes dim violet, flame low
//   f1 the eyes ignite, the crescent drifts up
//   f2 the flame swells, the eyes go white-hot, the crescent's horns glint
//   f3 the flame leaps (the spell is cast), the beard and the hat tip stream back
//   f4 held at full: eyes white, flame at its tallest
//   f5 held
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) is the near eye's white core.

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf, run } from '../rigkit';
import { planes } from '../monsters-v3/dusk_sorcerer-kit';
import { drawFlame } from '../monsters-v3/dusk_sorcerer-fx';
import { paintMoon, type MoonGeom } from '../monsters-v3/dusk_sorcerer-moon';
import { pose } from '../monsters-v3/dusk_sorcerer-rig';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
type Pt = readonly [number, number];

interface P {
  eye: number;
  flame: number;
  moonUp: number;
  glint: number;
  stream: number;
}
const POSES: readonly P[] = [
  { eye: 0.5, flame: 1.7, moonUp: 0, glint: 0, stream: 0 },
  { eye: 1, flame: 2.1, moonUp: -2, glint: 0, stream: 0 },
  { eye: 1.5, flame: 2.5, moonUp: -4, glint: 1, stream: 1 },
  { eye: 1.5, flame: 3.1, moonUp: -6, glint: 1, stream: 3 },
  { eye: 1.5, flame: 3.3, moonUp: -7, glint: 1, stream: 4 },
  { eye: 1.5, flame: 3.3, moonUp: -7, glint: 0, stream: 4 },
];
const HOLDS: readonly number[] = [240, 110, 100, 90, 150, 600];

const C = {
  coat: [PAL.night1, PAL.night2, PAL.night3, PAL.night4] as const,
  hat: [PAL.void0, PAL.void1, PAL.void2, PAL.void3] as const,
  beard: [PAL.night3, PAL.night4, PAL.steel, PAL.mist] as const,
};

/** Flat bands for a layer: [shade, mid, lit, rim] tones, runs toward the key (widths in cut-in px). */
function shade(q: PixelCanvas, t: readonly number[], left: boolean, litW: number, shW: number): void {
  const ls = left ? -1 : 1;
  planes(q, (x, y, s) => {
    const toL = Math.min(run(s, x, y, ls, -1, litW + 1), run(s, x, y, ls, 0, litW + 1) + 1);
    if (run(s, x, y, 0, -1, 3) < 2 || toL < litW) return t[2];
    const aw = Math.min(run(s, x, y, -ls, 1, shW + 1), run(s, x, y, -ls, 0, shW + 1) + 1);
    if (run(s, x, y, 0, 1, 3) < 2 || aw < shW) return t[0];
    return t[1];
  });
}

function poly(p: PixelCanvas, pts: readonly Pt[], c: number, t: readonly number[], left: boolean, litW = 6, shW = 7): void {
  const q = new PixelCanvas(W, H);
  q.poly(pts as Pt[], c);
  shade(q, t, left, litW, shW);
  p.blit(q, 0, 0);
}

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const left = (o?.lightFrom ?? 'left') === 'left';
    const light = lightOf(left ? 'left' : 'right');
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const s = P_.stream;

    // collar wings behind the head
    poly(p, [[30, 144], [20, 96], [34, 62], [64, 88], [74, 144]], C.coat[2], C.coat, left, 6, 8);
    poly(p, [[132, 144], [150, 98], [176, 78], [180, 112], [172, 144]], C.coat[2], C.coat, left, 6, 8);
    // violet lining inside the near wing
    poly(p, [[132, 144], [140, 104], [158, 92], [162, 144]], PAL.void2, C.hat, left, 4, 6);

    // coat shoulders + vest with the silver lapel line
    poly(p, [[18, 144], [34, 112], [74, 98], [128, 98], [168, 112], [186, 144]], C.coat[2], C.coat, left, 7, 9);
    poly(p, [[96, 100], [118, 100], [128, 144], [92, 144]], PAL.void2, C.hat, left, 4, 6);
    const lap = new PixelCanvas(W, H);
    lap.line(96, 100, 92, 144, PAL.mist).line(118, 100, 128, 144, PAL.steel);
    p.blit(lap, 0, 0);
    // belt-gold clasp at the vest's top
    p.rect(104, 114, 10, 8, PAL.gold2);
    p.rect(106, 116, 6, 4, PAL.gold4);
    p.set(108, 118, PAL.void3).set(109, 118, PAL.void3);

    // beard, streaming back with the cast
    poly(p, [[90, 82], [134, 82], [126 - s, 112], [114 - s * 2, 134], [104 - s * 2, 112], [94, 96]], C.beard[2], C.beard, left, 6, 7);

    // face under the brim (skin in shade up top), nose to the right
    const face = new PixelCanvas(W, H);
    face.poly([[84, 60], [130, 60], [138, 78], [130, 92], [90, 90], [82, 74]], PAL.skin1);
    shade(face, [PAL.skin0, PAL.skin1, PAL.skin2, PAL.skin3], left, 8, 10);
    face.rect(80, 58, 58, 9, PAL.void0); // the brim's shadow over the eyes
    p.blit(face, 0, 0);

    // hat: cone first (leaning, tip curling out to the left), then the brim over it
    const cone = new PixelCanvas(W, H);
    cone.poly([[84, 54], [130, 54], [122, 32], [102, 16], [72, 8], [38, 12], [20, 22], [56, 22], [78, 36]], PAL.void2);
    shade(cone, C.hat, left, 6, 9);
    cone.rect(84, 42, 46, 7, PAL.night2); // the hat band
    p.blit(cone, 0, 0);
    // gold crescent buckle
    for (const [x, y] of [[110, 41], [113, 39], [117, 39], [121, 41], [121, 45], [118, 47]] as const) p.rect(x, y, 3, 3, PAL.gold3);
    // star at the tip
    p.rect(14, 8, 3, 3, PAL.gold3).rect(11, 9, 3, 1, PAL.gold3).rect(18, 9, 3, 1, PAL.gold3).rect(15, 5, 1, 3, PAL.gold3).rect(15, 12, 1, 3, PAL.gold3).set(15, 9, PAL.gold4);
    const brim = new PixelCanvas(W, H);
    const bp: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = -1 + i / 10;
      bp.push([108 + t * 74, 46 - 12 * Math.sqrt(Math.max(0.12, 1 - t * t)) - (t < -0.5 ? (-0.5 - t) * 26 : 0)]);
    }
    for (let i = 20; i >= 0; i--) {
      const t = -1 + i / 10;
      bp.push([108 + t * 74, 50 + 6 * Math.sqrt(Math.max(0.12, 1 - t * t)) - (t < -0.5 ? (-0.5 - t) * 20 : 0)]);
    }
    brim.poly(bp, PAL.void2);
    shade(brim, C.hat, left, 6, 8);
    p.blit(brim, 0, 0);

    // moon: the sprite's own crescent geometry, big, hanging at the upper right
    const mg: MoonGeom = { cx: 170, cy: 62 + P_.moonUp, R: 26, r: 22, d: 13, ux: Math.cos(Math.PI * 0.95), uy: Math.sin(Math.PI * 0.95) };
    const moon = new PixelCanvas(W, H);
    paintMoon(moon, mg, light, pose({ ms: 1 }), 5);
    p.blit(moon, 0, 0);

    p.outline(PAL.ink);

    // light: eyes, flame, glints (never outlined)
    const ec = P_.eye > 1.2 ? PAL.white : P_.eye > 0.8 ? PAL.void4 : PAL.void3;
    const er = P_.eye > 0.8 ? PAL.void3 : PAL.void2;
    p.rect(98, 69, 7, 3, er).rect(100, 69, 5, 2, ec);
    p.rect(116, 68, 16, 4, er).rect(118, 68, 12, 3, ec);
    if (P_.eye > 1.2) p.rect(122, 68, 3, 2, PAL.white);
    drawFlame(p, 160, 132, P_.flame * 0.9, (frame * 0.37) % 1, light, P_.flame > 3 ? 0.6 : 0);
  }
  return { id: 'dusk_sorcerer', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.void3, accentDark: PAL.void1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
