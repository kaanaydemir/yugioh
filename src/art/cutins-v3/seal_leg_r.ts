// Sağ Bacak Mührü — v3 cut-in portrait (200×144, faces right; ?look=v3 only, see src/art/cutins/index.ts), painted at the cut-in's
// own density (3.9× the sprite's): the foot slab, its three toe blocks, the shin plate, the ankle band, the rune column and the
// broken chain are drawn again at this size from the rig's foot skeleton (seal_leg_r-rig.ts FOOT_BODY / TOES: positions only),
// never the 1× sprite enlarged.
//
// A low-angle poster: the foot and the shin fill the lower two thirds, the shin leaves the frame at the top (the knee is out of
// shot). One key light from the frame's top-left, flat value planes by pixel counts, 1-px ink outline, no dither, no gradient.
// P2 sees a RELIT set (p2: 'relight'): every band follows `lightFrom`; geometry and the seal light are the same.
//
// Rhythm (holds, played once, the last frame held) — the stomp, then the seal wakes bottom to top:
//   f0 the foot hangs off the top edge, the runes dark
//   f1 it descends fast
//   f2 the slam: the floor ring bursts, dust, rubble, the foot sunk 4 px
//   f3 the dust settles, the crack web crawls
//   f4 the runes light bottom to top
//   f5 held: all three runes at full flare, a stepped ring on the floor
// The lens glint (cutin.ts: the brightest isolated pixel of f0's head region) lands on the top rune's hot core in the LAST frame
// (a mag4 pixel of the seal).

import type { CutinFactory } from '../cutins/index';
import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { lightOf } from '../rigkit';
import { FOOT_BODY, TOES } from '../monsters-v3/seal_leg_r-rig';
import { BRONZE, GLYPH_LEG_R, MAG, OBS, OBS_FOOT, bands, crumbs, fill, STONE_TONES, GOLD_TONES, type Pt, type Tones } from '../monsters-v3/seal_leg_r-kit';
import type { DrawOpts } from '../types';

const W = 200;
const H = 144;
/** Cut-in density relative to the sprite. */
const S = 3.9;
/** Ankle resting position of the cut-in and the shin's axis (pointing from the ankle up and slightly back). */
const ANKLE: Pt = [88, 84];
const AX_ = [-0.32, -0.95] as const;
const HOLDS: readonly number[] = [200, 110, 100, 120, 150, 620];

interface P {
  /** ankle y offset (the fall) and the sink of the slam */
  dy: number;
  /** rune levels top → bottom */
  runes: readonly [number, number, number];
  ring: number;
  dust: number;
  web: number;
}
const POSES: readonly P[] = [
  { dy: -112, runes: [0, 0, 0], ring: 0, dust: 0, web: 0 },
  { dy: -44, runes: [0, 0, 0], ring: 0, dust: 0, web: 0 },
  { dy: 4, runes: [1, 1, 2], ring: 1, dust: 2, web: 1 },
  { dy: 0, runes: [1, 1, 1], ring: 2, dust: 1, web: 3 },
  { dy: 0, runes: [2, 3, 4], ring: 2, dust: 0, web: 3 },
  { dy: 0, runes: [4, 4, 4], ring: 3, dust: 0, web: 3 },
];

const factory: CutinFactory = () => {
  function draw(p: PixelCanvas, frame: number, o?: DrawOpts): void {
    const light = lightOf(o?.lightFrom ?? 'left');
    const P_ = POSES[Math.min(frame, POSES.length - 1)];
    const ax = ANKLE[0];
    const ay = ANKLE[1] + P_.dy;
    const at = (x: number, y: number): Pt => [ax + x * S, ay + y * S];

    const part = (pts: Pt[], t: Tones, litW: number, shW: number, opt: { top?: number; bottom?: number; edge?: number } = {}, crease = true): void => {
      const q = new PixelCanvas(W, H);
      fill(q, pts, t.M);
      bands(q, t, light, litW, shW, opt);
      crumbs(q, t === BRONZE ? GOLD_TONES : STONE_TONES);
      if (crease) {
        const rim = new PixelCanvas(W, H);
        for (let y = 1; y < H - 1; y++)
          for (let x = 1; x < W - 1; x++) if (!q.isOpaque(x, y) && p.isOpaque(x, y) && (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1))) rim.set(x, y, t === BRONZE ? BRONZE.D : OBS.D);
        p.blit(rim, 0, 0);
      }
      p.blit(q, 0, 0);
    };

    // ---- the shin: a long plate leaving the top of the frame, with its dark rune socket
    const ux = AX_[0];
    const uy = AX_[1];
    const vx = -uy; // right-hand side
    const vy = ux;
    const along = (t: number, s: number): Pt => [ax + ux * t + vx * s, ay + 0 + uy * t + vy * s - 4 * S * 0];
    const half = 7.2 * S;
    const topT = 150;
    part([along(0, -half), along(topT, -half * 1.04), along(topT, half * 1.04), along(0, half)], OBS, 9, 7, { top: 4, bottom: 4, edge: 6 });
    // two plate seams across the shin
    for (const k of [34, 78]) {
      const a = along(k, -half);
      const b = along(k, half);
      p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), OBS.D);
      p.line(Math.round(a[0]), Math.round(a[1]) + 1, Math.round(b[0]), Math.round(b[1]) + 1, OBS.D);
    }
    // the rune socket: a recessed dark bed along the axis
    const sock = 3.5 * S;
    fill(p, [along(10, -sock), along(topT, -sock), along(topT, sock), along(10, sock)], PAL.void0);

    // ---- the foot slab and its three toe blocks (far toe first)
    part(FOOT_BODY.map(([x, y]) => at(x, y)), OBS_FOOT, 8, 6, { top: 4, bottom: 6, edge: 12 });
    // two plate seams across the foot
    for (const lx of [-8, 3.5]) {
      const a = at(lx, 6.5);
      const b = at(lx, 11.5);
      p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), OBS.D);
      p.line(Math.round(a[0]) + 1, Math.round(a[1]), Math.round(b[0]) + 1, Math.round(b[1]), OBS.D);
    }
    for (const t of TOES) {
      const pts: Pt[] = [
        [t.x, t.y0 + 1],
        [t.x + 1, t.y0],
        [t.x + t.w - 2, t.y0],
        [t.x + t.w, t.y0 + 2],
        [t.x + t.w, t.y1],
        [t.x, t.y1],
      ].map(([x, y]) => at(x, y));
      part(pts, OBS, 6, 6, { top: 3, bottom: 4, edge: 8 });
    }

    // ---- the ankle band over the shin's foot, with two rivets
    {
      const a = along(-10, -half * 1.12);
      const b = along(-10, half * 1.12);
      const c = along(14, half * 1.1);
      const d = along(14, -half * 1.1);
      part([a, b, c, d], BRONZE, 5, 4, { top: 3, bottom: 3 });
      for (const s of [-0.7, 0.7]) {
        const r = along(2, half * s);
        p.rect(Math.round(r[0]) - 1, Math.round(r[1]) - 1, 3, 3, BRONZE.D);
      }
    }
    // ---- the broken chain: three big links hanging at the heel
    {
      const hx = ax - 17 * S;
      const hy = ay + 3 * S;
      for (let i = 0; i < 3; i++) {
        const lx = hx + (i % 2 ? 2 : -1);
        const ly = hy + i * 12;
        const q = new PixelCanvas(W, H);
        if (i % 2 === 0) {
          q.rect(lx - 4, ly - 6, 9, 12, BRONZE.M);
          q.rect(lx - 2, ly - 4, 5, 8, PAL.ink);
          q.hline(lx - 4, lx + 4, ly - 6, BRONZE.L);
          q.hline(lx - 4, lx + 4, ly + 5, BRONZE.S);
        } else {
          q.rect(lx - 1, ly - 5, 3, 11, BRONZE.S);
          q.vline(lx - 1, ly - 5, ly + 5, BRONZE.M);
        }
        p.blit(q, 0, 0);
      }
    }

    p.outline(PAL.ink);

    // ---- light layer: the runes (3-px strokes), the cool ring, hot cores, floor ring and web, dust, rubble
    const cell = 4;
    for (let j = 0; j < 3; j++) {
      const t = 36 + j * 26;
      const [cx, cy] = along(t, 0);
      const lv = P_.runes[2 - j];
      const x0 = Math.round(cx - 2.5 * cell);
      const y0 = Math.round(cy - 2.5 * cell);
      const stroke = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3][lv];
      if (lv >= 3) p.rect(Math.round(cx) - 11, Math.round(cy) - 11, 22, 22, PAL.mag0);
      for (let b = 0; b < 5; b++)
        for (let a = 0; a < 5; a++) {
          if (GLYPH_LEG_R[b][a] !== '#') continue;
          const dim = lv >= 1 && lv <= 3 && b >= 1 && a * light.side > 0 ? MAG[Math.max(0, lv - 1)] : stroke;
          p.rect(x0 + a * cell, y0 + b * cell, 3, 3, dim);
        }
      if (lv >= 4) p.rect(Math.round(cx) - 1, Math.round(cy) - 1, 3, 3, PAL.mag4);
    }
    const free = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && !p.isOpaque(x, y);
    const put = (x: number, y: number, c: number) => {
      if (free(x, y)) p.set(x, y, c);
    };
    const fy = ay + 13 * S - P_.dy * 0 + 2;
    const fx = ax + 2 * S;
    // the floor ring: stepped 2:1 ellipses
    for (let r = 0; r < P_.ring; r++) {
      const rx = 56 + r * 20;
      const ry = rx / 3;
      const tone = r === P_.ring - 1 ? PAL.mag3 : r === P_.ring - 2 ? PAL.mag2 : PAL.mag1;
      for (let a = 0; a < 720; a++) {
        const th = (a * Math.PI) / 360;
        put(Math.round(fx + Math.cos(th) * rx), Math.round(fy - 3 + Math.sin(th) * ry), tone);
      }
    }
    // the crack web along the floor
    if (P_.web > 0)
      for (const [dx, dy, len] of [[30, 2, 28], [-40, 3, 26], [44, 8, 18], [-30, 9, 18]] as const) {
        const n = Math.round((len * Math.min(3, P_.web)) / 3);
        let y = fy - 2 + dy;
        for (let i = 0; i < n; i++) {
          y += i % 5 === 3 ? 1 : 0;
          put(Math.round(fx + dx + (dx > 0 ? i : -i)), y, P_.web >= 3 ? PAL.mag2 : PAL.mag1);
        }
      }
    // dust and rubble
    for (let i = 0; i < P_.dust * 6; i++) {
      const dir = i % 2 ? 1 : -1;
      const k = Math.floor(i / 2);
      put(Math.round(fx + dir * (46 + k * 7)), Math.round(fy - 4 - k * 3), P_.dust >= 2 ? PAL.void3 : PAL.void2);
      put(Math.round(fx + dir * (46 + k * 7)) + dir, Math.round(fy - 4 - k * 3) + 1, PAL.void2);
      put(Math.round(fx + dir * (46 + k * 7)), Math.round(fy - 3 - k * 3), PAL.void1);
    }
    if (frame === 2) for (const [dx, dy] of [[-70, -12], [74, -20], [-58, -30], [80, -4]] as const) p.rect(Math.round(fx + dx), Math.round(fy + dy), 3, 2, OBS.M);
  }
  return { id: 'seal_leg_r', w: W, h: H, frames: POSES.length, fps: 8, accent: PAL.mag3, accentDark: PAL.mag1, holds: HOLDS, p2: 'relight', draw };
};

export default factory;
