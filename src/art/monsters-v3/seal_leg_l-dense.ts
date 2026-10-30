// Sol Bacak Mührü v3 — the DENSE painter of the "Dragger": the same kneeling leg drawn again at the card picture's / the cut-in's
// own density (sprite coordinates × S, S = 2 for the big card, ≈ 4 for the cut-in), never the 1× sprite enlarged: every plate is a
// fresh polygon shaded from its own edges with the pixel counts of the target size, the glyph is drawn as strokes of the right
// thickness, the chain links and the weight block are re-built from their shapes. Geometry comes from the rig (joints, JAG, SEAM,
// RIM, PAD, the foot's skeleton) so the leg is recognisably the sprite's leg.
//
// paintLegDense(p, light, S, at, d, glow): `at` = where the knee plate's centre lands on `p`; `glow` (optional) receives the seal
// light (glyph, seam, sparks, motes) so a card can keep it on its light layer; without it everything goes on `p`.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit';
import { ANKLE0, FOOT_BODY, HIP0, JAG, KNEE0, NAILS, PAD, PLATE0, RIM, SEAM, SOLE_PADS, TOES, loc, segGeom } from './seal_leg_l-rig';
import { BRONZE, Comp, GLYPH_LEG_L, GOLD_TONES, MAG, OBS, STONE_TONES, bands, crumbs, fill, layer, rnd, type Pt, type Tones } from './seal_leg_l-kit';

export interface Dense {
  /** glyph level 0 dark … 3 lit … 4 hot */
  lv: number;
  spill: number;
  /** hip seam 0..3 */
  seam: number;
  /** chain: sag of the free links (sprite px, 0 = straight and taut), links, and an extra lift of the whole chain (sprite px) */
  sag: number;
  links: number;
  lift: number;
  /** draw the foot (the cut-in's far left) */
  foot: boolean;
  /** hot sparks / seal motes in CANVAS px */
  sparks: readonly Pt[];
  motes: readonly (readonly [number, number, number])[];
  /** stepped floor rings round the plate: [radius in sprite px, tone 1..3] */
  rings: readonly (readonly [number, number])[];
  /** skip the hip end (the thigh leaves the window) */
  noHip: boolean;
}
export const DENSE0: Dense = { lv: 3, spill: 2, seam: 1, sag: 2, links: 6, lift: 0, foot: false, sparks: [], motes: [], rings: [], noHip: false };

const IRON: Tones = { E: PAL.stone2, L: PAL.stone2, M: PAL.stone1, S: PAL.stone0, D: PAL.void0 };
const PX0 = PLATE0[0] + 0.5;
const PY0 = PLATE0[1] + 0.5;

export function paintLegDense(p: PixelCanvas, light: Light, S: number, at: Pt, d: Dense, glow?: PixelCanvas): void {
  const g = glow ?? p;
  const T = (x: number, y: number): Pt => [at[0] + (x - PX0) * S, at[1] + (y - PY0) * S];
  const Tp = (pts: readonly Pt[], dx = 0, dy = 0): Pt[] => pts.map(([x, y]) => T(x + dx, y + dy));
  const lw = Math.max(1, Math.round(S / 2));
  const c = new Comp(p);
  const W = p.w;
  const H = p.h;
  const k = Math.round(S * 1.5);
  let id = 1;

  const part = (pts: readonly Pt[], t: Tones, litW: number, shW: number, opt: { top?: number; bottom?: number; edge?: number } = {}, crease = true, post?: (q: PixelCanvas) => void): void => {
    const q = layer(W, H);
    fill(q, pts, t.M);
    bands(q, t, light, litW, shW, opt);
    crumbs(q, t === BRONZE ? GOLD_TONES : STONE_TONES);
    post?.(q);
    c.add(q, id++, crease ? (t === BRONZE ? BRONZE.D : OBS.D) : undefined);
  };
  /** a crease line (thickness lw) on the pixels of q only */
  const crease = (q: PixelCanvas, a: Pt, b: Pt, tone: number = OBS.D): void => {
    const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let i = 0; i <= n; i++) {
      const x = rnd(a[0] + ((b[0] - a[0]) * i) / n);
      const y = rnd(a[1] + ((b[1] - a[1]) * i) / n);
      for (let j = 0; j < lw; j++) if (q.isOpaque(x, y + j) && q.isOpaque(x, y + j - 1) !== false) q.set(x, y + j, tone);
    }
  };

  // ---- geometry in sprite space
  const th = segGeom(HIP0, KNEE0);
  const gnd = 57;
  const TL = (g2: typeof th, t: number, s: number): Pt => {
    const q = loc(g2, t, s);
    return T(q[0], q[1]);
  };

  // ---- chain + weight block (far left, on the floor)
  {
    const ring: Pt = [ANKLE0[0] - 2, gnd - 1];
    const blockX = 10 - (d.links - 5) * 3.3;
    const n = d.links;
    const pts: Pt[] = [];
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 0.5);
      pts.push([ring[0] + (blockX - ring[0]) * t, ring[1] + (55 - ring[1]) * t - d.lift * Math.sin(Math.PI * t) + d.sag * Math.sin(t * Math.PI * 2.4) * 0.5]);
    }
    // block: a cast iron weight with a bronze ring on top
    const bx = blockX;
    const by = 54;
    part(Tp([[bx - 5.5, by - 4], [bx + 3.5, by - 4], [bx + 6.5, by - 1.5], [bx + 6.5, by + 3.5], [bx - 6.5, by + 3.5], [bx - 6.5, by - 1.5]]), IRON, k, k, { top: lw, bottom: lw, edge: 0 }, true, (q) => {
      const a = T(bx - 3, by + 0.5);
      const b = T(bx + 3, by + 0.5);
      for (let y = 0; y < lw; y++) q.hline(rnd(a[0]), rnd(b[0]), rnd(a[1]) + y, PAL.void0);
    });
    {
      const q = layer(W, H);
      const o = T(bx, by - 4);
      const rr = Math.round(S * 1.6);
      q.ellipse(o[0], o[1] - rr * 0.4, rr, rr * 0.8, BRONZE.M);
      q.ellipse(o[0], o[1] - rr * 0.4, rr * 0.5, rr * 0.4, PAL.ink);
      bands(q, BRONZE, light, 1, 1, { top: 1, bottom: 1 });
      c.add(q, id++, OBS.D);
    }
    // links (alternating face-on / edge-on), root ring first
    const all: Pt[] = [ring, ...pts.slice(0, -1)];
    all.forEach(([x, y], i) => {
      const q = layer(W, H);
      const o = T(x, y);
      const face = i % 2 === 0;
      const lwid = Math.round(S * (face ? 2.6 : 1.8));
      const lh = Math.round(S * 1.8);
      if (face) {
        q.ellipse(o[0], o[1], lwid, lh, BRONZE.M);
        q.ellipse(o[0], o[1], Math.max(1, lwid * 0.45), Math.max(1, lh * 0.4), PAL.ink);
      } else {
        q.rect(rnd(o[0] - lwid), rnd(o[1] - lh * 0.5), lwid * 2, Math.max(2, lh), BRONZE.M);
      }
      bands(q, BRONZE, light, 1, 1, { top: 1, bottom: 1 });
      c.add(q, id++, BRONZE.D);
    });
  }

  // ---- the shin: a long slab along the floor
  {
    const top = [
      [KNEE0[0] + 2, KNEE0[1] - 3.5],
      [KNEE0[0] - 7, KNEE0[1] - 4.2],
      [(KNEE0[0] + ANKLE0[0]) / 2 + 2, (KNEE0[1] + ANKLE0[1]) / 2 - 4.6],
      [ANKLE0[0] + 6, ANKLE0[1] - 5],
      [ANKLE0[0] - 1, ANKLE0[1] - 3.6],
      [ANKLE0[0] - 3, gnd - 3],
      [ANKLE0[0] - 2, gnd],
      [(KNEE0[0] + ANKLE0[0]) / 2, gnd],
      [KNEE0[0] + 2, gnd],
    ] as Pt[];
    part(Tp(top), OBS, k, Math.round(S * 1.3), { top: lw + 1, bottom: lw * 2, edge: Math.round(S * 2.5) }, true, (q) => {
      for (const f of [0.34, 0.68]) {
        const x = ANKLE0[0] + (KNEE0[0] - ANKLE0[0]) * f;
        const a = T(x, 43);
        const b = T(x, gnd);
        crease(q, [a[0], a[1]], [b[0], b[1]]);
      }
    });
  }

  // ---- the foot (only when it is in the picture)
  if (d.foot) {
    const F = (x: number, y: number): Pt => T(ANKLE0[0] + y * 0.9 - 1, ANKLE0[1] + (x + 8.5) * 0.6 - 4);
    part(FOOT_BODY.map(([x, y]) => F(x, y)), OBS, k, Math.round(S * 1.2), { top: lw, bottom: lw, edge: Math.round(S * 2) }, true, (q) => {
      for (const { x0, x1, y0, y1 } of SOLE_PADS)
        for (let y = y0; y <= y1; y++) {
          const a = F(x0, y);
          const b = F(x1, y);
          const tone = (y - y0) % 3 === 1 ? OBS.D : (y - y0) % 3 === 2 ? OBS.S : OBS.M;
          for (let j = 0; j < Math.max(1, lw); j++) q.line(rnd(a[0]), rnd(a[1]) + j, rnd(b[0]), rnd(b[1]) + j, tone);
        }
      for (const [nx, ny] of NAILS) {
        const a = F(nx, ny);
        q.rect(rnd(a[0]), rnd(a[1]), lw + 1, lw + 1, PAL.gold1);
      }
    });
    for (const [tx, ty, tw, tth] of TOES) {
      const a = F(tx + tw / 2, ty + tth / 2 - 1);
      const q = layer(W, H);
      const rw = Math.max(2, Math.round(tth * S * 0.9));
      const rh = Math.max(2, Math.round(tw * S * 0.55));
      q.rect(rnd(a[0] - rw / 2), rnd(a[1] - rh / 2), rw, rh, OBS.M);
      bands(q, OBS, light, lw, lw, { top: lw, bottom: lw });
      c.add(q, id++, OBS.D);
    }
  }

  // ---- ankle shackle band
  {
    const x0 = ANKLE0[0] + 1;
    part(Tp([[x0, ANKLE0[1] - 4], [x0 + 4, ANKLE0[1] - 4], [x0 + 4, gnd], [x0, gnd]]), BRONZE, lw, lw, { top: lw, bottom: lw }, true, (q) => {
      const a = T(x0 + 1.5, ANKLE0[1] - 1);
      q.rect(rnd(a[0]), rnd(a[1]), lw + 1, lw + 1, BRONZE.D);
      const b = T(x0 + 1.5, gnd - 3);
      q.rect(rnd(b[0]), rnd(b[1]), lw + 1, lw + 1, BRONZE.D);
    });
  }

  // ---- thigh: the lower slab, then the upper slab with the snapped hip
  const len = th.len;
  const aEnd = len * 0.5;
  const station = (t0: number, t1: number, lo: readonly number[], ro: readonly number[]): Pt[] => {
    const n = lo.length;
    const L: Pt[] = [];
    const R: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const t = t0 + ((t1 - t0) * i) / (n - 1);
      L.push(TL(th, t, -lo[i]));
      R.push(TL(th, t, ro[i]));
    }
    return [...L, ...R.reverse()];
  };
  const groove = (q: PixelCanvas, t0: number, t1: number, s: number): void => crease(q, TL(th, t0, s), TL(th, t1, s));
  const across = (q: PixelCanvas, t: number, s0: number, s1: number): void => crease(q, TL(th, t, s0), TL(th, t, s1));
  part(station(aEnd, len + 2, [6.8, 7.8, 6.0, 8.2, 7.6], [7.0, 6.2, 7.6, 6.4, 8.0]), OBS, k, Math.round(S * 1.3), { top: lw + 1, bottom: lw * 2, edge: Math.round(S * 2.5) }, true, (q) => {
    groove(q, aEnd + 1.5, len - 1, -3.4);
    across(q, aEnd + (len - aEnd) * 0.55, -7, 2.2);
  });
  if (!d.noHip) {
    const pts: Pt[] = [TL(th, aEnd, -7.0), TL(th, aEnd * 0.55, -6.2)];
    for (const [t, s] of JAG) pts.push(TL(th, t, s));
    pts.push(TL(th, aEnd * 0.5, 7.4), TL(th, aEnd, 7.0));
    part(pts, OBS, k, Math.round(S * 1.3), { top: lw + 1, bottom: lw * 2, edge: Math.round(S * 2.5) }, true, (q) => {
      groove(q, 3, aEnd - 0.5, -3.4);
      across(q, aEnd * 0.66, -7, 2.4);
    });
  } else {
    // the thigh simply continues up and out of the picture
    part(station(-40, aEnd + 1, [7, 7.4, 7, 7.2, 7, 7.4], [7.4, 6.6, 7.2, 6.4, 7, 7]), OBS, k, Math.round(S * 1.3), { top: lw + 1, bottom: lw * 2, edge: Math.round(S * 2.5) }, true, (q) => {
      groove(q, -36, aEnd - 0.5, -3.4);
      across(q, aEnd * 0.5, -7, 2.4);
      across(q, -14, -7, 2.4);
    });
  }

  // ---- the knee plate: bronze rim, obsidian pad
  const rimPts = RIM.map(([x, y]): Pt => [at[0] + x * S, at[1] + y * S]);
  part(rimPts, BRONZE, Math.round(S * 1.2), Math.round(S * 1.2), { top: lw, bottom: lw, edge: Math.round(S * 1.6) });
  // four rivets on the bronze rim
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const rx = Math.round(at[0] + sx * 3.9 * S);
    const ry = Math.round(at[1] + sy * 3.9 * S);
    p.rect(rx - Math.floor(lw / 2), ry - Math.floor(lw / 2), lw + 1, lw + 1, BRONZE.D);
  }
  const padPts = PAD.map(([x, y]): Pt => [at[0] + x * S, at[1] + y * S]);
  part(padPts, OBS, Math.round(S * 1.4), Math.round(S * 1.2), { top: lw, bottom: lw, edge: Math.round(S * 1.5) }, true);

  p.outline(PAL.ink);

  // ---- light: floor rings, spill, glyph, seam, sparks, motes
  const free = (x: number, y: number) => x >= 1 && y >= 1 && x < W - 1 && y < H - 1 && !p.isOpaque(x, y);
  /** light pixel: on a separate glow canvas anywhere; on `p` itself only on free pixels unless `over` (the glyph on its pad) */
  const gset = (x: number, y: number, col: number, over = false) => {
    if (g === p) {
      if (over ? x >= 0 && y >= 0 && x < W && y < H : free(x, y)) p.set(x, y, col);
    } else if (x >= 0 && y >= 0 && x < W && y < H) g.set(x, y, col);
  };
  for (const [r, tone] of d.rings) {
    const cx = at[0];
    const cy = T(0, gnd)[1] - S * 0.5;
    const rx = r * S;
    const ry = rx / 3;
    const inside = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++)
      for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++)
        if (inside(x, y) && (!inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1))) if (free(x, y)) gset(x, y, MAG[tone]);
  }
  const lv = Math.max(0, Math.min(4, d.lv));
  const cell = S >= 3 ? Math.round(S * 1.25) : S;
  const gx0 = Math.round(at[0] - (5 * cell) / 2);
  const gy0 = Math.round(at[1] - (5 * cell) / 2);
  if (lv >= 2 && d.spill > 0) {
    const rad = Math.round(PAD[2][1] * S * -1) - 0;
    void rad;
    const R0 = Math.round(2.9 * cell);
    for (let y = gy0 - 3 * cell; y <= gy0 + 8 * cell; y++)
      for (let x = gx0 - 3 * cell; x <= gx0 + 8 * cell; x++) {
        const dx = x - at[0];
        const dy = y - at[1];
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (dist < R0 || dist >= R0 + Math.max(1, lw)) continue;
        if (!p.isOpaque(x, y)) continue;
        const cur = p.get(x, y);
        if (cur !== OBS.M && cur !== OBS.S && cur !== OBS.L && cur !== OBS.E) continue;
        // only on the pad: inside the pad polygon
        if (Math.hypot(dx / (4.4 * S), dy / (4.4 * S)) > 1) continue;
        const away = dx * light.side < 0 || dy > 0;
        p.set(x, y, away ? PAL.void1 : PAL.void2);
      }
  }
  const stroke = [PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag3, PAL.mag3][lv];
  const shade = [PAL.mag0, PAL.mag0, PAL.mag1, PAL.mag2, PAL.mag2][lv];
  GLYPH_LEG_L.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      if (ch !== '#' || lv === 0) return;
      const sh = lv >= 1 && lv <= 3 && i * light.side > 0 && j >= 1;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) gset(gx0 + i * cell + x, gy0 + j * cell + y, sh && (x * light.side > 0 || y >= cell - 1) && cell > 2 ? shade : sh && cell <= 2 ? shade : stroke, true);
    }),
  );
  if (lv >= 4) {
    const cx = gx0 + 2 * cell;
    const cy = gy0 + 2 * cell;
    for (let y = 0; y < Math.min(2, cell); y++) for (let x = 0; x < Math.min(3, cell + 1); x++) gset(cx + x, cy + y, PAL.mag4, true);
  }
  if (d.seam > 0 && !d.noHip) {
    const tone = [PAL.mag1, PAL.mag1, PAL.mag2, PAL.mag3][Math.min(3, d.seam)];
    for (let i = 0; i + 1 < SEAM.length; i++) {
      const a = TL(th, SEAM[i][0], SEAM[i][1]);
      const b = TL(th, SEAM[i + 1][0], SEAM[i + 1][1]);
      const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let q = 0; q <= n; q++) {
        const x = rnd(a[0] + ((b[0] - a[0]) * q) / n);
        const y = rnd(a[1] + ((b[1] - a[1]) * q) / n);
        for (let j = 0; j < lw; j++) if (p.isOpaque(x, y + j)) gset(x, y + j, tone, true);
      }
    }
  }
  for (const s of d.sparks) gset(rnd(s[0]), rnd(s[1]), PAL.void4);
  for (const m of d.motes) gset(rnd(m[0]), rnd(m[1]), MAG[m[2]]);
}
