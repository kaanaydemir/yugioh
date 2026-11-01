// Kaya Baltacı v3 — effect painters of the rig: the summon BOULDER (matter, a drawn roll cycle, the blade punching out,
// the clean light seam and the two halves), the Yarık light (the body seam, the floor seam from the axe head, the seam
// burn of the death and its reverse for the revive), the axe-head arc smear, sparks, stone chips, earth clods and dust.
// The Yarık palette is fixed: a 1-px white core, earth4 lips, gold4 only at a running head — never fire, never rune gold.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import { AX, FUR, GY, H, W, axeUV, bands, clamp, hash2, layer as kitLayer, lerp, planes, xf, xfInv, type Pt, type Xf } from './crag_axeman-kit';
import type { Frame } from './crag_axeman-rig';

const rnd = Math.round;
const TAU = Math.PI * 2;
const layer = () => kitLayer(W, H);

// ---------------------------------------------------------------- the boulder (summon)

const BR = 16;
const BCX = AX + 1;
const BCY = GY - 16;
/** A lumpy boulder outline (a 14-gon) turned by the roll frame; slightly flattened (it rests on the floor). */
function boulderPts(cx: number, cy: number, roll: number, sq = 0.95): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + roll * (TAU / 14 / 2);
    const r = BR * (0.9 + 0.12 * hash2(i, 7, 3));
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]);
  }
  return pts;
}

/**
 * Flat carved facets of the boulder (Voronoi cells around seeds that turn with the roll): each facet one tone by its
 * facing (the lit top-left facets stone3/4, the under-belly stone1), 1-px creases one step darker between facets.
 */
function stoneFacets(q: PixelCanvas, f: Frame, cx: number, cy: number, roll: number, step: number): void {
  const T = [PAL.stone4, PAL.stone3, PAL.stone2, PAL.stone1, PAL.stone0];
  const s = clamp(step, 0, 2);
  const ls = f.light.side;
  // big irregular facets: jittered seeds (no hub), turned with the roll
  const seeds: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + roll * 0.52 + (hash2(i, 4, 1) - 0.5) * 0.9;
    const r = BR * (0.3 + 0.5 * hash2(i, 2, 9));
    seeds.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  planes(q, (x, y, src) => {
    const dx = x - cx;
    const dy = y - cy;
    let b0 = 1e9;
    let b1 = 1e9;
    let bi = 0;
    for (let i = 0; i < seeds.length; i++) {
      const d = Math.hypot(dx - seeds[i][0], dy - seeds[i][1]);
      if (d < b0) {
        b1 = b0;
        b0 = d;
        bi = i;
      } else if (d < b1) b1 = d;
    }
    const [sx, sy] = seeds[bi];
    const lit = (-sx * ls * 0.6 - sy * 0.8) / BR + (-dx * ls * 0.3 - dy * 0.4) / BR;
    let tone = lit > 0.35 ? 0 : lit > 0.05 ? 1 : lit > -0.3 ? 2 : 3;
    // rim: the outer edge row of a facet facing the light is lit, the under edge dark
    if (!src.isOpaque(x, y + 1) || !src.isOpaque(x + ls * -1, y + 1)) tone = Math.max(tone, 3);
    if (b1 - b0 < 0.8) tone = Math.min(4, tone + 1);
    return T[Math.min(4, tone + s)];
  });
}


/** One half of the boulder (s = −1 left, +1 right) in boulder-local points, the flat cut face on x = BCX. */
function halfPts(s: number, roll: number): Pt[] {
  const pts = boulderPts(BCX, BCY, roll).filter(([x]) => (s < 0 ? x <= BCX : x >= BCX));
  pts.push([BCX, BCY + BR * 0.95], [BCX, BCY - BR * 0.95]);
  pts.sort((a, b) => Math.atan2(a[1] - BCY, a[0] - BCX) - Math.atan2(b[1] - BCY, b[0] - BCX));
  return pts;
}

/** The cut face's light band: within 2 px of the cut line (white at the face's very edge, earth4 behind it). */
function cutFaceLight(h: PixelCanvas, toLocal: (x: number, y: number) => Pt, s: number, k: number): void {
  const LIT = [PAL.white, PAL.earth4, PAL.stone3, PAL.stone2];
  planes(h, (x, y) => {
    const [lx] = toLocal(x, y);
    const d = (lx - BCX) * s; // 0 at the cut, growing into the half
    if (d < 1) return LIT[Math.min(3, k)];
    if (d < 2.6) return LIT[Math.min(3, k + 1)];
    return null;
  });
}

function halvesFalling(f: Frame, deg: number, roll: number): void {
  for (const s of [-1, 1]) {
    const h = layer();
    // pivot: the half's bottom outer corner; the top swings out (left half counter-clockwise, right clockwise)
    const px = BCX + s * (BR - 2);
    const py = GY - 1;
    const a = s * deg * (Math.PI / 180);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const rot = ([x, y]: Pt): Pt => [px + (x - px) * c - (y - py) * sn, py + (x - px) * sn + (y - py) * c];
    const inv = (x: number, y: number): Pt => [px + (x - px) * c + (y - py) * sn, py - (x - px) * sn + (y - py) * c];
    const shown = halfPts(s, roll).map(rot);
    h.poly(shown, PAL.stone2);
    stoneFacets(h, f, BCX + s * 8, GY - 8, roll + (s > 0 ? 1 : 2), 0);
    cutFaceLight(h, inv, s, 0);
    f.comp.add(h, 14, { out: PAL.stone0 });
  }
}

function halvesLying(f: Frame, sink: number, roll: number): void {
  for (const s of [-1, 1]) {
    const h = layer();
    const cx = BCX + s * 22;
    const hh = Math.max(2, 8 - sink * 2);
    const cy = GY;
    const w = 10;
    // a low dome on its round back, the cut face up (its top 2 rows)
    h.poly([[cx - w, cy - hh], [cx + w, cy - hh], [cx + w + 1, cy - hh + 3], [cx + w - 3, cy], [cx - w + 3, cy], [cx - w - 1, cy - hh + 3]], PAL.stone2);
    stoneFacets(h, f, cx, GY - 4, roll + (s > 0 ? 1 : 2), Math.min(2, sink));
    const top = cy - hh;
    planes(h, (_x, y) => (y <= top + 1 ? [PAL.earth4, PAL.stone3, PAL.stone2, PAL.stone1][Math.min(3, sink)] : y === top + 2 && sink === 0 ? PAL.stone4 : null));
    f.comp.add(h, 14, { out: PAL.stone0 });
  }
}

export function boulderFx(f: Frame, matter: boolean): void {
  const { o, p } = f;
  const st = o.bould;
  if (matter) {
    const q = layer();
    if (st <= 3) {
      const cx = BCX + o.rock;
      const cy = BCY - Math.abs(o.rock) * 0.5;
      q.poly(boulderPts(cx, cy, o.roll), PAL.stone2);
      stoneFacets(q, f, cx, cy, o.roll, 0);
      f.comp.add(q, 14, { out: PAL.stone0 });
      if (st >= 2) {
        // the blade punched out through the front face (the axe head pokes out, chips fly — chipFx)
        const a = layer();
        const ox = cx + BR - 7 + (st === 3 ? 1 : 0);
        const oy = cy - 2;
        // the crescent edge out of the boulder's right face (it punched through from inside)
        const pts: Pt[] = [];
        for (let a = -100; a <= 100; a += 20) pts.push([ox + 9.5 * Math.cos((a * Math.PI) / 180), oy + 9.5 * Math.sin((a * Math.PI) / 180)]);
        pts.push([ox + 1, oy + 5], [ox + 3, oy + 2], [ox + 3, oy - 2], [ox + 1, oy - 5]);
        a.poly(pts, PAL.stone3);
        bands(a, { L: PAL.stone4, M: PAL.stone3, S: PAL.stone2, D: PAL.stone1 }, f.light, 1, 1);
        f.comp.add(a, 14, { out: PAL.stone0 });
      }
    } else if (st === 4) {
      // the halves FALL APART: each half turns out about its own bottom outer corner (bk = the tilt in degrees: 30, 60),
      // re-rasterised as a polygon (never a sprite rotation); the flat cut face turns up toward the light
      halvesFalling(f, o.bk, o.roll);
    } else {
      // landed: two half-domes lying BESIDE his boots (left and right, drawn before the body: behind the boots), the
      // flat cut face up — lit while the light is in it, then sinking in palette steps (bk 0…3)
      halvesLying(f, o.bk, o.roll);
    }
    return;
  }
  // light: the clean vertical seam up the boulder face (3), the cut faces glowing as the halves part (4)
  if (st === 3) {
    const top = rnd(BCY + BR - 2 - o.bk * (2 * BR - 3));
    const x = BCX + o.rock;
    for (let y = BCY + BR - 1; y >= top; y--) {
      if (!p.isOpaque(x, y)) continue;
      p.set(x, y, PAL.white);
      if (p.isOpaque(x - 1, y)) p.set(x - 1, y, PAL.earth4);
      if (p.isOpaque(x + 1, y)) p.set(x + 1, y, PAL.earth4);
    }
    if (p.isOpaque(x, top)) p.set(x, top, PAL.gold4);
  }
}

// ---------------------------------------------------------------- the Yarık on the body (death: the seam climbs the centre line)

export function seamFx(f: Frame): void {
  const { o, p } = f;
  const x = AX + 2;
  const top = rnd(GY - o.seam * 63);
  // light pours out: the white core on the body column, earth4 lips either side (over the outline too: it cuts through)
  for (let y = GY; y >= top; y--) {
    if (!p.isOpaque(x, y) && !p.isOpaque(x - 1, y) && !p.isOpaque(x + 1, y)) continue;
    if (p.isOpaque(x, y)) p.set(x, y, PAL.white);
    if (p.isOpaque(x - 1, y)) p.set(x - 1, y, PAL.earth4);
    if (p.isOpaque(x + 1, y)) p.set(x + 1, y, PAL.earth4);
  }
  // the running head of the seam
  if (o.seam < 1) {
    p.set(x, top - 1, PAL.gold4);
    p.set(x, top, PAL.white);
  }
}

/**
 * The seam-burn (death, last frames): starting at the cut, the light eats into each half in ≥ 2-px clusters
 * (white → earth4 → gone). `gather` runs it backwards (revive: clusters light up and become matter again).
 */
export function burnPass(q: PixelCanvas, T: Xf, burn: number, gather: boolean): void {
  const seam = AX + 1.5;
  const reach = 30;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!q.isOpaque(x, y)) continue;
      const [bx, by] = xfInv(T, x, y);
      const cx = Math.floor(bx / 3);
      const cy = Math.floor(by / 3);
      const d = Math.abs(bx - seam) / reach;
      const thr = 0.9 * d + 0.1 * hash2(cx, cy, 5);
      if (thr < burn - 0.14) q.erase(x, y);
      else if (thr < burn - 0.06) q.set(x, y, gather ? PAL.white : PAL.earth4);
      else if (thr < burn) q.set(x, y, gather ? PAL.earth4 : PAL.white);
    }
}

/** Revive: the motes that will become the body hang in the seam's column. */
export function gatherFx(f: Frame): void {
  const { o, p } = f;
  if (o.burn <= 0.2) return;
  for (let i = 0; i < 10; i++) {
    const u = (o.t * 3 + i / 10) % 1;
    const x = AX + 2 + rnd((hash2(i, 3, 1) - 0.5) * 30 * o.burn);
    const y = rnd(GY - 4 - hash2(i, 5, 2) * 56 + u * 3);
    if (y < 2 || y > GY) continue;
    p.set(x, y, i % 3 === 0 ? PAL.white : PAL.earth4);
  }
}

// ---------------------------------------------------------------- the Yarık on the floor

/** The floor seam: from the axe head forward along the attack axis (crack), or the summon's split seam (fseam). */
export function floorSeamFx(f: Frame): void {
  const { o, p, sk } = f;
  const seg = (x0: number, len: number, k: number, dir: 1 | -1) => {
    // a 2:1 iso line on the floor (one row per two px), white core with earth4 lips; k = brightness step
    const core = k >= 1 ? PAL.white : k >= 0.5 ? PAL.earth4 : PAL.earth3;
    const lip = k >= 1 ? PAL.earth4 : k >= 0.5 ? PAL.earth3 : PAL.earth2;
    let y = GY;
    for (let i = 0; i <= len; i++) {
      const x = x0 + i * dir;
      if (x < 1 || x > W - 2) break;
      if (y > H - 2) break;
      p.set(x, y, core);
      if (!p.isOpaque(x, y - 1) || p.get(x, y - 1) === PAL.ink) p.set(x, y - 1, lip);
      p.set(x, y + 1, lip);
    }
    const hx = x0 + len * dir;
    if (k >= 1 && hx > 0 && hx < W - 1) p.set(hx, y, PAL.gold4);
  };
  if (o.crack !== 0) {
    // from the bite: the lowest point of the axe head on the floor; + runs forward (toward the target), − back to the feet
    const ex = o.crack > 0 ? rnd(sk.edge[0]) : rnd(sk.axe[0]) - 2;
    seg(ex, rnd(Math.abs(o.crack)), o.crackK, o.crack > 0 ? 1 : -1);
  }
  if (o.fseam > 0) {
    const n = rnd(o.fseam / 2);
    seg(AX + 1, n, o.fseamK, 1);
    seg(AX + 1, n, o.fseamK, -1);
  }
}

// ---------------------------------------------------------------- motion marks

/** The 2-px arc smear behind the axe head on the fastest frames (stone4 / white, light, not outlined). */
export function smearFx(f: Frame): void {
  const { o, p, sk } = f;
  if (o.smear === 0) return;
  if (o.spx !== 0 || o.spy !== 0) {
    arcSmear(f);
    return;
  }
  // the arc the head just swept (around the grip): two 1-px arcs trailing the edge, the outer white, the inner stone4;
  // smear > 0 = the axe turns clockwise (the chop), < 0 = counter-clockwise (the spin's last quarter)
  const sgn = o.smear > 0 ? -1 : 1;
  const [gx, gy] = sk.G;
  // the head's own angular extent around the grip is behind the poll: the smear starts beyond it
  const base = Math.atan2(sk.axe[1] - gy, sk.axe[0] - gx);
  const R = Math.hypot(sk.axe[0] - gx, sk.axe[1] - gy) + (o.fore < 1 ? 13 : 7);
  for (let k = 0; k < 2; k++) {
    const r = R - k * 4;
    for (let d = 12; d <= 40; d += 1.2) {
      const a = base + sgn * (d * Math.PI) / 180;
      const X = rnd(gx + Math.cos(a) * r);
      const Y = rnd(gy + Math.sin(a) * r);
      if (X < 1 || Y < 1 || X > W - 2 || Y > GY) continue;
      if (p.isOpaque(X, Y) && p.get(X, Y) !== PAL.ink) continue;
      if (k === 1 && d > 30) continue;
      p.set(X, Y, k === 0 && d < 24 ? PAL.white : PAL.stone4);
    }
  }
}

/**
 * The arc the axe head swept since the last frame, on its own path: from (smx, smy) round the pivot (spx, spy) to the
 * head now (all anchor-relative), the radius easing between the two ends. A 3-px curved band — a white core with a
 * stone4 edge either side, thinning to 1 px at the tail — stopping short of the head's own outline. Light: not
 * outlined, never over the body's own colours.
 */
function arcSmear(f: Frame): void {
  const { o, p, sk } = f;
  const px0 = AX + o.spx;
  const py0 = GY + o.spy;
  const a0 = Math.atan2(GY + o.smy - py0, AX + o.smx - px0);
  const r0 = Math.hypot(AX + o.smx - px0, GY + o.smy - py0);
  const a1 = Math.atan2(sk.axe[1] - py0, sk.axe[0] - px0);
  const r1 = Math.hypot(sk.axe[0] - px0, sk.axe[1] - py0);
  let da = a1 - a0;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  // the band rides just outside the head centre's path (the crescent's rim), a solid 3-px stroke (white core, stone4
  // edges) that thins to 1 px at its tail
  const steps = Math.max(16, Math.ceil(Math.abs(da) * Math.max(r0, r1) * 2.5));
  const free = (x: number, y: number) => x >= 1 && y >= 1 && x <= W - 2 && y <= GY && (!p.isOpaque(x, y) || p.get(x, y) === PAL.ink);
  const put = new Map<number, number>();
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (t > 0.84) break; // stop short of the head
    const a = a0 + da * t;
    const r = lerp(r0, r1, t) + 3;
    const half = t < 0.25 ? 0 : t < 0.5 ? 0.6 : 1.2;
    for (let d = -half; d <= half + 0.01; d += 0.5) {
      const X = rnd(px0 + Math.cos(a) * (r + d));
      const Y = rnd(py0 + Math.sin(a) * (r + d));
      if (!free(X, Y)) continue;
      const k = Y * W + X;
      const c = Math.abs(d) < 0.4 && t > 0.25 ? PAL.white : PAL.stone4;
      if (put.get(k) !== PAL.white) put.set(k, c);
    }
  }
  for (const [k, c] of put) p.set(k % W, Math.floor(k / W), c);
  void o;
}

/** Sparks off the stone bite (white → gold3 / earth4), or the idle tap's single spark. */
export function sparkFx(f: Frame): void {
  const { o, p, sk } = f;
  if (o.tap > 0) {
    const [x, y] = axeUV(sk, 0, 12.5);
    const X = rnd(x);
    const Y = Math.min(GY, rnd(y));
    p.set(X, Y, PAL.white);
    if (o.tap > 1) p.set(X + 1, Y - 1, PAL.earth4);
  }
  if (o.spark <= 0) return;
  const ph = o.spark;
  const [cx, cy] = axeUV(sk, 0, 12);
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.15 + 0.7 * hash2(i, 3, 5));
    const d = 2 + ph * (5 + hash2(i, 9, 2) * 9);
    const x = rnd(cx + Math.cos(a) * d);
    const y = rnd(cy + Math.sin(a) * d + ph * ph * 7);
    if (y > GY || y < 1 || x < 1 || x > W - 2) continue;
    p.set(x, y, ph < 0.45 ? PAL.white : i % 2 ? PAL.gold4 : PAL.earth4);
  }
}

/** Stone chips (2 px, matter-coloured with an ink-free light edge) bursting back from the bite / the boulder face. */
export function chipFx(f: Frame): void {
  const { o, p, sk } = f;
  if (o.chips <= 0) return;
  const ph = o.chips;
  const boulder = o.bould >= 2 && o.bould <= 3;
  const [cx, cy] = boulder ? [AX + 20, GY - 20] : axeUV(sk, 0, 10);
  const away = boulder ? 1 : -1;
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.1 + 0.6 * hash2(i, 11, 1));
    const sp = 4 + hash2(i, 13, 2) * 10;
    const x = rnd(cx + away * Math.cos(a) * sp * ph * 1.4);
    const y = rnd(cy + Math.sin(a) * sp * ph + ph * ph * 10);
    if (y > GY - 1 || y < 1 || x < 1 || x > W - 3) continue;
    p.set(x, y, PAL.stone3).set(x + 1, y, PAL.stone2).set(x, y + 1, PAL.stone2).set(x + 1, y + 1, PAL.stone1);
  }
}

/** Earth clods spiralling up off the boots in the spin (2×2 earth, no outline). */
export function clodFx(f: Frame): void {
  const { o, p } = f;
  if (o.clods <= 0) return;
  const ph = o.clods;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + ph * 4.2;
    const r = 13 + ph * 8 + i;
    const x = rnd(AX + Math.cos(a) * r);
    const y = rnd(GY - 3 - ph * 10 - i * 1.5 + Math.sin(a) * 3);
    if (y > GY - 1 || y < 1 || x < 1 || x > W - 3) continue;
    if (p.isOpaque(x, y) && Math.sin(a) < 0) continue;
    p.set(x, y, PAL.earth3).set(x + 1, y, PAL.earth2).set(x, y + 1, PAL.earth2).set(x + 1, y + 1, PAL.earth1);
  }
}

/** Dust puffs at the boots (steps, the land) or at the axe's bite: 2-px earth / stone blobs drifting out. */
export function dustFx(f: Frame): void {
  const { o, p, sk } = f;
  if (o.dust <= 0) return;
  const ph = o.dust;
  const atAxe = o.bury > 0 || o.tap > 0;
  const cx = atAxe ? rnd(sk.axe[0] + sk.nrm[0] * 9) : AX;
  const n = atAxe ? 4 : 6;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const spread = atAxe ? 3 + ph * 7 : 12 + ph * 8;
    const x = rnd(cx + side * (spread + (i >> 1) * 2));
    const y = GY - 1 - rnd(ph * 3 + (i % 3));
    if (x < 1 || x > W - 4) continue;
    if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) continue;
    const c = ph < 0.5 ? PAL.earth3 : PAL.earth2;
    p.set(x, y, c).set(x + 1, y, c);
    if (ph < 0.5) p.set(x, y - 1, PAL.earth2);
  }
  void FUR;
  void xf;
}
