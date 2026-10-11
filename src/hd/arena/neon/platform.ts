// HD Neon arena — the floating obsidian platform: slab top border + podiums, the two visible slab faces, the
// stepped hull tiers with energy vents, the keel spike with the energy crystal. One lit raster (colour + normal
// map) plus three additive glow rasters (P1 cyan / P2 crimson / neutral neon) so each side's trim can brighten
// on its own (active player) and bloom.

import { PAL, RAMPS, type Ramp } from '../../../art/palette';
import type { PlayerId } from '../../../engine/types';
import {
  CORE_XY,
  G0,
  G1,
  OUTLINE,
  SLAB_RECT,
  TH,
  TIERS,
  type TrimClass,
  insideOutline,
  iso,
  outlineDist,
  podiumXY,
  rowClass,
  screenToGrid,
} from './geo';
import { FACE_N_LL, FACE_N_LR, Raster, bayer, dpick, floorToView, hash2, lerp, voronoi } from './raster';

export interface PlatformArt {
  slab: Raster;
  /** glow per trim class (only the glw buffer is used) */
  glow: [Raster, Raster, Raster];
}

/** Trim colours per class: level 0..4. */
export function trimRamp(cls: TrimClass): Ramp {
  if (cls === 0) return RAMPS.cyan;
  if (cls === 1) return RAMPS.crim;
  return [PAL.night2, PAL.night3, PAL.steel, PAL.mist, PAL.white];
}

/** Bands of the slab face from its top edge down (art px each), per env pixel. */
function faceBands(P: number): string[] {
  const spec: [string, number][] =
    P === 1
      ? [
          ['hl', 1],
          ['hl2', 1],
          ['up', 6],
          ['groove', 1],
          ['neon', 2],
          ['groove2', 1],
          ['low', 7],
          ['dark', 1],
          ['ink', 2],
        ]
      : [
          ['hl', 1],
          ['up', 3],
          ['groove', 1],
          ['neon', 1],
          ['low', 3],
          ['dark', 1],
          ['ink', 1],
        ];
  const out: string[] = [];
  for (const [n, c] of spec) for (let k = 0; k < c; k++) out.push(n);
  return out;
}

/** Bands of the slab top border from its outer edge inward (art px each). */
function borderBands(P: number): string[] {
  const spec: [string, number][] =
    P === 1
      ? [
          ['edge', 1],
          ['bevel', 2],
          ['obs', 3],
          ['groove', 1],
          ['neon', 1],
          ['groove', 1],
          ['plate', 1],
        ]
      : [
          ['edge', 1],
          ['bevel', 1],
          ['obs', 1],
          ['neon', 1],
          ['groove', 1],
          ['plate', 1],
        ];
  const out: string[] = [];
  for (const [n, c] of spec) for (let k = 0; k < c; k++) out.push(n);
  return out;
}

export function drawPlatform(P: number): PlatformArt {
  const R = SLAB_RECT;
  const slab = new Raster(R, P, { normal: true });
  const glow: [Raster, Raster, Raster] = [new Raster(R, P, { glow: true }), new Raster(R, P, { glow: true }), new Raster(R, P, { glow: true })];
  /** Neon at (i, j): albedo in the class ramp + glow level. */
  const neon = (i: number, j: number, cls: TrimClass, lvl: number, albedo = true) => {
    const ramp = trimRamp(cls);
    if (albedo) slab.put(i, j, ramp[Math.min(4, Math.max(0, lvl))]);
    const a = [60, 120, 190, 245, 255][Math.min(4, Math.max(0, lvl))];
    glow[cls].glow(i, j, ramp[Math.min(4, lvl + 1)], a);
  };
  const glowOnly = (i: number, j: number, cls: TrimClass, lvl: number, a: number) => {
    const ramp = trimRamp(cls);
    glow[cls].glow(i, j, ramp[Math.min(4, lvl)], a);
  };

  // ================================================================ hull + keel (back to front)
  const last = TIERS[TIERS.length - 1];
  const a0 = G0 + last.inset;
  const a1 = G1 - last.inset;
  const spikeTop = last.top + last.t;
  const gp = (c: number, r: number, depth = 0): [number, number] => {
    const s = iso(c, r);
    return [s.x, s.y + depth];
  };
  {
    const lft = gp(a0, a1, spikeTop);
    const bot = gp(a1, a1, spikeTop);
    const rgt = gp(a1, a0, spikeTop);
    const apex: [number, number] = [CORE_XY.x, CORE_XY.y];
    const midL = gp(lerp(a0, a1, 0.55), a1, spikeTop);
    const midR = gp(a1, lerp(a1, a0, 0.55), spikeTop);
    // four facets: two per side, split by a secondary ridge
    const facets: { pts: [number, number][]; base: number[]; n: [number, number, number] }[] = [
      { pts: [lft, midL, apex], base: [PAL.ink, PAL.night0, PAL.night1, PAL.night2], n: [-0.62, -0.5, 0.6] },
      { pts: [midL, bot, apex], base: [PAL.night0, PAL.night1, PAL.night2, PAL.night3], n: [-0.3, -0.62, 0.72] },
      { pts: [bot, midR, apex], base: [PAL.ink, PAL.night0, PAL.night1, PAL.night2], n: [0.3, -0.62, 0.72] },
      { pts: [midR, rgt, apex], base: [PAL.ink, PAL.ink, PAL.night0, PAL.night1], n: [0.62, -0.5, 0.6] },
    ];
    const spikeH = apex[1] - bot[1];
    for (const f of facets) {
      slab.poly(f.pts, (i, j, x, y) => {
        // lit from below near the core (the crystal's own light)
        const dc = Math.hypot(x - apex[0], (y - apex[1]) * 1.3);
        const v = 0.9 + Math.max(0, 1 - dc / 90) * 1.4;
        // armour bands: iso grooves parallel to the tier edge, every 14 px of depth
        const depth = y - (bot[1] - Math.abs(x - bot[0]) * 0.5);
        const fb = depth / 14 - Math.floor(depth / 14);
        const k = depth / spikeH;
        let c = dpick(f.base, v, i, j);
        if (k < 0.8 && fb < P / 14) c = PAL.ink;
        else if (k < 0.8 && fb < (2 * P) / 14) c = f.base[2];
        slab.put(i, j, c);
        slab.setN(i, j, f.n);
      });
    }
    // ridges
    slab.line(bot[0], bot[1], apex[0], apex[1], (i, j, t) => slab.put(i, j, t > 0.6 ? PAL.night4 : t > 0.25 ? PAL.night3 : PAL.night2));
    slab.line(midL[0], midL[1], apex[0], apex[1] - 8, (i, j) => slab.put(i, j, PAL.night2));
    slab.line(midR[0], midR[1], apex[0], apex[1] - 8, (i, j) => slab.put(i, j, PAL.night0));
    // energy veins flowing down the facet splits into the crystal
    slab.line(midL[0], midL[1], apex[0], apex[1] - 8, (i, j, t) => (t > 0.15 && (t > 0.55 || bayer(i, j) < 8) ? neon(i, j, 0, t > 0.75 ? 2 : 1, t > 0.4) : undefined));
    slab.line(midR[0], midR[1], apex[0], apex[1] - 8, (i, j, t) => (t > 0.15 && (t > 0.55 || bayer(i, j) < 8) ? neon(i, j, 1, t > 0.75 ? 2 : 1, t > 0.4) : undefined));
    // under-lit rims near the core
    slab.line(lft[0], lft[1], apex[0], apex[1], (i, j, t) => t > 0.45 && neon(i, j, 0, t > 0.8 ? 2 : 1, bayer(i, j) < 10));
    slab.line(rgt[0], rgt[1], apex[0], apex[1], (i, j, t) => t > 0.45 && neon(i, j, 1, t > 0.8 ? 2 : 1, bayer(i, j) < 10));
    // the energy crystal the platform floats on
    const cw = 6;
    const ch = 13;
    slab.each(
      (i, j, x, y) => {
        const dx = x - apex[0];
        const dy = y - (apex[1] - 2);
        const m = Math.abs(dx) / cw + Math.abs(dy) / ch;
        if (m > 1) return;
        const edge = m > 1 - (P * 1.1) / cw;
        const lvl = edge ? 2 : dx < 0 && dy < 0 ? 4 : dx >= 0 && dy >= 0 ? 2 : 3;
        neon(i, j, 2, lvl);
        if (!edge && Math.abs(dx) < P && dy < 0) neon(i, j, 2, 4);
        slab.setN(i, j, [dx < 0 ? -0.5 : 0.5, dy < 0 ? 0.35 : -0.35, 0.79]);
      },
      { x: apex[0] - cw - 2, y: apex[1] - ch - 4, w: 2 * cw + 4, h: 2 * ch + 4 },
    );
  }
  for (let k = TIERS.length - 1; k >= 0; k--) {
    const { inset, top, t } = TIERS[k];
    const c0 = G0 + inset;
    const c1 = G1 - inset;
    const lft = gp(c0, c1, top);
    const bot = gp(c1, c1, top);
    const rgt = gp(c1, c0, top);
    const dark: number[] = k === 0 ? [PAL.night1, PAL.night0] : [PAL.night0, PAL.ink];
    for (const face of [0, 1]) {
      const A = face === 0 ? lft : bot;
      const B = face === 0 ? bot : rgt;
      slab.poly(
        [A, B, [B[0], B[1] + t], [A[0], A[1] + t]],
        (i, j, x, y) => {
          const yt = A[1] + ((B[1] - A[1]) * (x - A[0])) / (B[0] - A[0]);
          const kk = Math.floor((y - yt) / P); // art px below the tier's top edge
          const nk = Math.round(t / P);
          let c: number = dark[face];
          if (kk === 0) c = face === 0 ? PAL.night2 : PAL.night1;
          if (kk >= nk - 1) c = PAL.ink;
          // panel seams
          const along = x - A[0];
          if (Math.abs(((along % 30) + 30) % 30) < P && kk > 0 && kk < nk - 1) c = face === 0 ? PAL.night0 : PAL.ink;
          slab.put(i, j, c);
          slab.setN(i, j, face === 0 ? FACE_N_LL : FACE_N_LR);
          // vents: dark slots with a glowing core
          const step = k === 0 ? 24 : 36;
          const u = (((along + step / 2) % step) + step) % step;
          const mid = Math.round(nk / 2);
          if (Math.abs(u - step / 2) < (P === 1 ? 4 : 4) && kk === mid) {
            const g = screenToGrid(x, y - top);
            const cls: TrimClass = face === 0 ? 0 : rowClass(g.row);
            if (Math.abs(u - step / 2) < 2) neon(i, j, cls, k === 0 ? 2 : 1);
            else slab.put(i, j, PAL.ink);
          }
        },
      );
    }
    // vertical corner edge
    slab.line(bot[0], bot[1], bot[0], bot[1] + t - 1, (i, j) => slab.put(i, j, k === 0 ? PAL.night3 : PAL.night1));
    // the energy seam right under the slab
    if (k === 0) {
      slab.line(lft[0], lft[1], bot[0], bot[1], (i, j) => neon(i, j, 0, 2));
      slab.line(bot[0], bot[1], rgt[0], rgt[1], (i, j, tt) => neon(i, j, rowClass(lerp(c1, c0, tt)), 2));
    }
  }

  // ================================================================ slab + podium faces (front-facing outline edges)
  const FB = faceBands(P);
  const n = OUTLINE.length;
  const faces: { a: [number, number]; b: [number, number]; ll: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const a = OUTLINE[i];
    const b = OUTLINE[(i + 1) % n];
    const nx = Math.sign(b[1] - a[1]);
    const ny = -Math.sign(b[0] - a[0]);
    if (nx > 0 || ny > 0) faces.push({ a: [a[0], a[1]], b: [b[0], b[1]], ll: ny > 0 });
  }
  faces.sort((f, g) => f.a[0] + f.a[1] + f.b[0] + f.b[1] - (g.a[0] + g.a[1] + g.b[0] + g.b[1]));
  const T = FB.length * P;
  for (const f of faces) {
    const A = gp(f.a[0], f.a[1]);
    const B = gp(f.b[0], f.b[1]);
    slab.poly([A, B, [B[0], B[1] + T], [A[0], A[1] + T]], (i, j, x, y) => {
      const t = (x - A[0]) / (B[0] - A[0]);
      const yt = A[1] + (B[1] - A[1]) * t;
      const kk = Math.max(0, Math.min(FB.length - 1, Math.floor((y - yt) / P)));
      const band = FB[kk];
      const gc = lerp(f.a[0], f.b[0], t);
      const gr = lerp(f.a[1], f.b[1], t);
      const cls = rowClass(gr);
      const along = (gc + gr) * 24; // ≈ px along the edge
      const seam = Math.abs(((along % 36) + 36) % 36) < P;
      const seamL = Math.abs((((along - P) % 36) + 36) % 36) < P;
      let c: number;
      let nn: [number, number, number] = f.ll ? FACE_N_LL : FACE_N_LR;
      switch (band) {
        case 'hl':
          c = f.ll ? PAL.steel : PAL.night4;
          nn = [nn[0] * 0.4, 0.55, 0.75];
          break;
        case 'hl2':
          c = f.ll ? PAL.night4 : PAL.night3;
          nn = [nn[0] * 0.7, 0.2, 0.75];
          break;
        case 'up':
          c = f.ll ? PAL.night2 : PAL.night1;
          if (kk <= (P === 1 ? 3 : 1) && bayer(i, j) < 5) c = f.ll ? PAL.night3 : PAL.night2;
          if (seam) c = f.ll ? PAL.night0 : PAL.ink;
          else if (seamL) c = f.ll ? PAL.night3 : PAL.night2;
          break;
        case 'groove':
        case 'groove2':
          c = PAL.ink;
          nn = [nn[0], band === 'groove' ? -0.5 : 0.4, 0.7];
          break;
        case 'neon':
          c = trimRamp(cls)[2];
          neon(i, j, cls, P === 1 && FB[kk - 1] === 'groove' ? 3 : 2);
          break;
        case 'low': {
          c = f.ll ? PAL.night1 : PAL.night0;
          if (seam) c = PAL.ink;
          else if (seamL) c = f.ll ? PAL.night2 : PAL.night1;
          // vents between seams + indicator lights
          const u = (((along + 18) % 36) + 36) % 36;
          const lk = kk - FB.indexOf('low');
          const lowN = FB.filter((b) => b === 'low').length;
          if (Math.abs(u - 18) < 7 && lk >= 1 && lk < lowN - 1) {
            c = PAL.ink;
            if (lk === Math.floor(lowN / 2) && Math.abs(u - 18) < 5) neon(i, j, cls, 1);
            else if (bayer(i, j) < 6 && lk > 1) glowOnly(i, j, cls, 1, 50);
          }
          if (Math.abs(u - 4) < P && lk === 1) neon(i, j, cls, 4);
          if (Math.abs(u - 4 - P) < P && lk === 1 && P === 1) neon(i, j, cls, 3);
          break;
        }
        case 'dark':
          c = PAL.night0;
          break;
        default:
          c = PAL.ink;
      }
      if (band !== 'neon') slab.put(i, j, c);
      slab.setN(i, j, nn);
    });
  }

  // ================================================================ top surface (border + podium tops)
  const BB = borderBands(P);
  const corners = OUTLINE.map(([c, r]) => gp(c, r));
  const minX = Math.min(...corners.map((q) => q[0]));
  const maxX = Math.max(...corners.map((q) => q[0]));
  const minY = Math.min(...corners.map((q) => q[1]));
  const maxY = Math.max(...corners.map((q) => q[1]));
  slab.each(
    (i, j, x, y) => {
      const g = screenToGrid(x, y);
      if (!insideOutline(g.col, g.row)) return;
      const inGrid = g.col >= -0.5 && g.col <= 4.5 && g.row >= -0.5 && g.row <= 4.5;
      if (inGrid) {
        slab.put(i, j, PAL.ink);
        slab.setN(i, j, floorToView(0, 0, 1));
        return;
      }
      const { d, nx, ny } = outlineDist(g.col, g.row);
      const k = Math.min(BB.length - 1, Math.floor((d * TH) / P)); // art px from the outer edge (plate beyond)
      // distance to the tile grid (vertical px) and the direction toward it: the inner bevel and rail hug the grid
      const gcl = Math.max(-0.5, Math.min(4.5, g.col)) - g.col;
      const grl = Math.max(-0.5, Math.min(4.5, g.row)) - g.row;
      const dGrid = Math.max(Math.abs(gcl), Math.abs(grl)) * TH;
      const innerW = 2 * P;
      let band = BB[k];
      if (band === 'plate' || band === 'obs') {
        if (dGrid < innerW) band = 'inner';
        else if (P === 1 && dGrid >= innerW && dGrid < innerW + 1) band = 'rail';
      }
      const tgx = (Math.sign(gcl) - Math.sign(grl)) * 0.894;
      const tgy = -(Math.sign(gcl) + Math.sign(grl)) * 0.447;
      const cls = rowClass(g.row);
      const back = nx < 0 || ny < 0;
      const litSide = nx < 0 || ny > 0;
      // outward screen direction of the nearest edge (y up)
      const ox = (nx - ny) * 0.894 * (nx !== 0 && ny !== 0 ? 0.707 : 1);
      const oy = -(nx + ny) * 0.447 * (nx !== 0 && ny !== 0 ? 0.707 : 1);
      let c: number;
      let nn: [number, number, number] = [0, 0, 1];
      // obsidian: conchoidal facets with faint glassy specks
      const vo = voronoi(x / 11, (y * 2) / 11, 404);
      const fa = vo.id * Math.PI * 2;
      const ft = 0.06 + 0.12 * hash2(Math.floor(vo.cx * 31), Math.floor(vo.cy * 37), 8);
      const obsidian = (): number => {
        const v = 1.05 + (vo.id - 0.5) * 0.5 + (y < 200 ? 0.15 : 0);
        let cc = dpick([PAL.ink, PAL.night0, PAL.night1, PAL.night2], v, i, j);
        if (vo.d2 - vo.d1 < 0.05 && Math.cos(fa) < 0) cc = PAL.night2;
        nn = [Math.cos(fa) * ft, Math.sin(fa) * ft, 1];
        return cc;
      };
      switch (band) {
        case 'edge':
          c = back ? (nx < 0 ? PAL.mist : PAL.night4) : ny > 0 ? PAL.steel : PAL.night4;
          nn = [ox * 0.7, oy * 0.7, 0.7];
          break;
        case 'bevel':
          c = litSide ? PAL.night3 : PAL.night2;
          if (k === 2 && P === 1) c = litSide ? PAL.night2 : PAL.night1;
          nn = [ox * 0.45, oy * 0.45, 0.89];
          break;
        case 'obs':
        case 'plate':
          c = obsidian();
          break;
        case 'groove':
          c = PAL.ink;
          break;
        case 'neon':
          c = trimRamp(cls)[3];
          neon(i, j, cls, 3);
          break;
        case 'rail':
          c = (i & 1) === 0 ? PAL.night2 : obsidian();
          break;
        default: {
          // inner bevel down to the tiles
          c = dGrid < P ? PAL.ink : PAL.night0;
          const l = Math.hypot(tgx, tgy) || 1;
          nn = [(tgx / l) * 0.5, (tgy / l) * 0.5, 0.86];
        }
      }
      // ruler ticks continuing the tile seams across the border
      const fc = g.col + 0.5;
      const fr = g.row + 0.5;
      const onSeam = (v: number) => Math.abs(v - Math.round(v)) * TH < P * 0.5;
      const inMain = g.col >= G0 && g.col <= G1 && g.row >= G0 && g.row <= G1;
      if (inMain && band === 'plate' && dGrid < 13 && ((onSeam(fc) && (g.row < -0.5 || g.row > 4.5)) || (onSeam(fr) && (g.col < -0.5 || g.col > 4.5)))) {
        c = PAL.night3;
        nn = [0, 0, 1];
      }
      if (band !== 'neon') slab.put(i, j, c);
      slab.setN(i, j, floorToView(nn[0], nn[1], nn[2]));
      // a soft glint on the lit outer edge picks up the trim colour
      if (band === 'edge' && litSide && !back) glowOnly(i, j, cls, 2, 70);
      if (band === 'bevel' && P === 1 && k === 1) glowOnly(i, j, cls, 1, 26);
    },
    { x: minX - 2, y: minY - 2, w: maxX - minX + 4, h: maxY - minY + 4 },
  );

  // ================================================================ corner jewels where the trim lines meet
  for (const [c, r] of [
    [G0 + 0.14, G0 + 0.14],
    [G1 - 0.14, G0 + 0.14],
    [G1 - 0.14, G1 - 0.14],
    [G0 + 0.14, G1 - 0.14],
  ] as const) {
    const s = iso(c, r);
    const cls = rowClass(r);
    slab.each(
      (i, j, x, y) => {
        const dx = x - s.x;
        const dy = y - s.y;
        const socket = Math.hypot(dx / 7, dy / 4);
        if (socket > 1) return;
        const m = Math.abs(dx) / 4.5 + Math.abs(dy) / 3;
        if (m > 1) {
          slab.put(i, j, socket > 0.8 ? PAL.night2 : PAL.ink);
          return;
        }
        neon(i, j, cls, m > 0.65 ? 2 : dx <= 0 && dy <= 0 ? 4 : 3);
        slab.setN(i, j, floorToView(dx < 0 ? -0.4 : 0.4, dy < 0 ? 0.4 : -0.4, 0.82));
      },
      { x: s.x - 9, y: s.y - 6, w: 18, h: 12 },
    );
  }

  // ================================================================ podium pads (hologram pedestals where the duelists stand)
  for (const pl of [0, 1] as PlayerId[]) {
    const s = podiumXY(pl);
    slab.each(
      (i, j, x, y) => {
        const dx = x - s.x;
        const dy = (y - s.y) * 2;
        const r = Math.hypot(dx, dy);
        if (r > 23) return;
        // stepped metal pedestal
        let c: number = r > 21 ? PAL.night3 : r > 19 ? PAL.night0 : r > 9 ? dpick([PAL.night0, PAL.night1, PAL.night2], 1.2 - dy / 40, i, j) : PAL.ink;
        if (r > 21 && dy > 0) c = PAL.night1;
        slab.put(i, j, c);
        slab.setN(i, j, floorToView(r > 19 ? (dx / r) * 0.5 : 0, r > 19 ? (-dy / r) * 0.5 : 0, 0.86));
        // rings + emitter
        const ring = (R: number) => Math.abs(r - R) < P * 0.75;
        if (ring(20)) neon(i, j, pl, 3);
        else if (ring(14)) neon(i, j, pl, 1);
        else if (r < 9 && r > 6.5) neon(i, j, pl, 2);
        else if (r <= 4) neon(i, j, pl, r < 2 ? 4 : 3);
        // radial ticks between the rings
        const ang = Math.atan2(dy, dx);
        if (r > 15 && r < 19 && Math.abs(((ang / (Math.PI * 2)) * 16 + 16) % 1 - 0.5) < 0.08) neon(i, j, pl, 2, true);
      },
      { x: s.x - 25, y: s.y - 13, w: 50, h: 26 },
    );
  }
  return { slab, glow };
}
