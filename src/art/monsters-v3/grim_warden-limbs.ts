// Hortlak Muhafız v3 — the POSED LIMBS and the CLOAK, drawn along the plan's solved bones so every frame
// keeps the idle f0's craft without a hand-painted pose:
//   - a bone / vambrace is a BLOCK: a tapered strip whose direction is snapped to a clean pixel slope (0, 1:2,
//     1:1, 2:1, upright: the long edges are straight pixel lines, never a 1-px jitter), three planes across it by
//     facing (IŞ-3) — of its two long faces the one that looks more toward the key light is lit, the other shade,
//     the front between them mid — by pixel counts, never a gradient; P2's light re-decides the faces (relit, not
//     mirrored);
//   - the BLADE is a block that grows into a cleaver: a straight back (spine) and a cutting edge that carries
//     the teeth (2-px notches every 5 px, ≥ 2 px deep: MA-2), the edge line `mist` where it faces the light;
//   - the CLOAK is cloth planes measured from the part's own edge (lit band, body, fold valleys) ending in
//     ragged teeth ≥ 2 px wide (MA-2 widenTeeth), sway by whole pixels.
// Everything here is pure geometry on a PixelCanvas; the part painters (./grim_warden-parts.ts) choose
// where and when.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { V } from '../rigkit/geom';
import type { Light } from '../rigkit/light';

export type Tones = readonly [shade: number, mid: number, lit: number];

export const BONE: Tones = [PAL.earth3, PAL.earth4, PAL.skin4];
export const BONE_FAR: Tones = [PAL.skin1, PAL.earth3, PAL.earth4];
export const IRON: Tones = [PAL.night1, PAL.night2, PAL.night3];
export const IRON_FAR: Tones = [PAL.night0, PAL.night1, PAL.night2];
export const CLOTH: Tones = [PAL.void0, PAL.void1, PAL.void2];
export const CLOTH_FAR: Tones = [PAL.ink, PAL.void0, PAL.void1];

/** The 16 clean pixel directions (slopes 0, 1:2, 1:1, 2:1, upright), as unit vectors. */
const CLEAN: readonly V[] = (() => {
  const out: V[] = [];
  for (const [x, y] of [[1, 0], [2, 1], [1, 1], [1, 2], [0, 1], [-1, 2], [-1, 1], [-2, 1], [-1, 0], [-2, -1], [-1, -1], [-1, -2], [0, -1], [1, -2], [1, -1], [2, -1]] as const) {
    const l = Math.hypot(x, y);
    out.push([x / l, y / l]);
  }
  return out;
})();

/** The clean direction closest to d. */
export function snapDir(d: V): V {
  const l = Math.hypot(d[0], d[1]) || 1;
  const u: V = [d[0] / l, d[1] / l];
  let best = CLEAN[0];
  let bd = -2;
  for (const c of CLEAN) {
    const dot = c[0] * u[0] + c[1] * u[1];
    if (dot > bd) {
      bd = dot;
      best = c;
    }
  }
  return best;
}

/** The screen direction of the key light (toward the light): P1 the frame's top-left, P2 its top-right. */
export const lightDir = (light: Light): V => (light.from === 'right' ? [0.5, -0.74] : [-0.5, -0.74]);

export interface BlockOpts {
  /** width across the bone at a and at b (px) */
  w: readonly [number, number];
  tones: Tones;
  /** extend past a / b along the bone (px) */
  cap?: readonly [number, number];
  /** lit / shade band shares of the width (the front takes the rest) */
  bands?: readonly [number, number];
  /** px cut off the four end corners: [at a, at b] */
  chamfer?: readonly [number, number];
}

export interface BlockOut {
  /** pixels of the block (frame px index y·w + x) → plane: 0 shade, 1 mid, 2 lit */
  mask: Map<number, number>;
  /** the snapped unit direction a → b and the normal toward the light */
  u: V;
  n: V;
}

/** A tapered strip from a toward b, painted into q. */
export function block(q: PixelCanvas, a: V, b: V, light: Light, o: BlockOpts): BlockOut {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u = snapDir([b[0] - a[0], b[1] - a[1]]);
  let n: V = [-u[1], u[0]];
  const ld = lightDir(light);
  if (n[0] * ld[0] + n[1] * ld[1] < 0) n = [-n[0], -n[1]];
  const [c0, c1] = o.cap ?? [0, 0];
  const [bl, bs] = o.bands ?? [0.34, 0.3];
  const wAt = (t: number) => o.w[0] + (o.w[1] - o.w[0]) * Math.max(0, Math.min(1, t / L));
  const wMax = Math.max(o.w[0], o.w[1]);
  const ex: V = [a[0] + u[0] * (L + c1), a[1] + u[1] * (L + c1)];
  const x0 = Math.floor(Math.min(a[0], ex[0]) - wMax - 2);
  const x1 = Math.ceil(Math.max(a[0], ex[0]) + wMax + 2);
  const y0 = Math.floor(Math.min(a[1], ex[1]) - wMax - 2);
  const y1 = Math.ceil(Math.max(a[1], ex[1]) + wMax + 2);
  const mask = new Map<number, number>();
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5 - a[0];
      const cy = y + 0.5 - a[1];
      const t = cx * u[0] + cy * u[1];
      if (t < -c0 || t > L + c1) continue;
      const s = cx * n[0] + cy * n[1];
      const w = wAt(t);
      if (Math.abs(s) > w / 2) continue;
      if (o.chamfer) {
        const ca = o.chamfer[0] - (t + c0);
        const cb = o.chamfer[1] - (L + c1 - t);
        const cut = Math.max(ca, cb, 0);
        if (cut > 0 && Math.abs(s) > w / 2 - cut) continue;
      }
      const nl = Math.max(1, Math.round(bl * w));
      const ns = Math.max(1, Math.round(bs * w));
      const plane = s > w / 2 - nl ? 2 : s < -w / 2 + ns ? 0 : 1;
      q.set(x, y, o.tones[plane]);
      mask.set(y * q.w + x, plane);
    }
  return { mask, u, n };
}

/** A disc of one plane-shaded knob (elbow, knee): lit top-left quarter, shade bottom-right. */
export function knob(q: PixelCanvas, c: V, r: number, light: Light, tones: Tones): Map<number, number> {
  const mask = new Map<number, number>();
  const ld = lightDir(light);
  for (let y = Math.floor(c[1] - r - 1); y <= Math.ceil(c[1] + r + 1); y++)
    for (let x = Math.floor(c[0] - r - 1); x <= Math.ceil(c[0] + r + 1); x++) {
      const dx = x + 0.5 - c[0];
      const dy = y + 0.5 - c[1];
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const f = (dx * ld[0] + dy * ld[1]) / (Math.hypot(ld[0], ld[1]) * Math.max(d, 0.5));
      const plane = d > 0.6 * r ? (f > 0.35 ? 2 : f < -0.35 ? 0 : 1) : f > 0.1 ? 2 : 1;
      q.set(x, y, tones[plane]);
      mask.set(y * q.w + x, plane);
    }
  return mask;
}

// ------------------------------------------------------------------ creases (IŞ-5)

/** One step down each tone family (unknown colours stay). */
const DARKER: Readonly<Record<number, number>> = (() => {
  const t: Record<number, number> = {};
  const chain = (...c: number[]) => c.slice(1).forEach((v, i) => (t[v] = c[i]));
  chain(PAL.skin0, PAL.skin1, PAL.earth3, PAL.earth4, PAL.skin4);
  chain(PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white);
  chain(PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4);
  t[PAL.skin0] = PAL.skin0;
  t[PAL.night0] = PAL.night0;
  t[PAL.void0] = PAL.void0;
  return t;
})();
export const darker = (c: number): number => DARKER[c] ?? c;

/** The one-step-darker band round a limb laid on what is behind it (1 px above / beside, 2 below), darken-only. */
export function creaseBand(dst: PixelCanvas, mask: ReadonlyMap<number, number>, w: number, below = 2): void {
  const hits = new Set<number>();
  for (const i of mask.keys()) {
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [0, 2]] as const) {
      if (dy === 2 && (below < 2 || mask.has((y + 1) * w + x))) continue;
      const j = (y + dy) * w + (x + dx);
      if (!mask.has(j)) hits.add(j);
    }
  }
  for (const j of hits) {
    const x = j % w;
    const y = Math.floor(j / w);
    const c = dst.get(x, y);
    if (c !== null) dst.set(x, y, darker(c));
  }
}

// ------------------------------------------------------------------ the blade

export interface BladeOpts {
  /** root (the wrist) and the direction (snapped) */
  root: V;
  dir: V;
  /** length from the root to the tip (px) */
  len: number;
  /** the blade's widest width (px), at ~0.45 of its length */
  width: number;
  /** teeth on the cutting edge: count and depth (px) */
  teeth?: number;
  /** a longer reach for the tip: px the tip is drawn out past `len` (the swing's smear) */
  stretch?: number;
}

export interface BladeOut {
  mask: Map<number, number>;
  /** the cutting-edge pixels in order root → tip (frame px index) */
  edge: number[];
  /** the tip, frame px */
  tip: V;
  /** the snapped direction and the cutting-edge normal */
  u: V;
  e: V;
}

/**
 * The cleaver: from the wrist along `dir`; the cutting edge on the side (−u.y, u.x) — the side that leads when
 * the arm swings clockwise (the chop) — with teeth; the spine on the other side. Planes: the face looking
 * toward the light is lit iron (night3), the other shade (night1), the ridge between mid (night2); the
 * cutting edge's line is `mist` where it faces the light, `steel` elsewhere; the teeth are lit on their
 * leading face.
 */
export function blade(q: PixelCanvas, light: Light, o: BladeOpts): BladeOut {
  const u = snapDir(o.dir);
  const e: V = [-u[1], u[0]];
  const L = o.len + (o.stretch ?? 0);
  const ld = lightDir(light);
  const eLit = e[0] * ld[0] + e[1] * ld[1] > 0; // does the cutting edge's side look toward the light
  const mask = new Map<number, number>();
  const edge: number[] = [];
  const teeth = o.teeth ?? 4;
  // half-width profile along t: grows to the belly, then tapers to the point
  const half = (t: number): number => {
    const k = t / L;
    if (k < 0.12) return o.width * 0.28 + k * 3;
    if (k < 0.5) return o.width * (0.32 + 0.68 * Math.sin(((k - 0.12) / 0.38) * (Math.PI / 2)) ** 0.8) * 0.5 + 0.4;
    return Math.max(0, o.width * 0.5 * (1 - (k - 0.5) / 0.5) ** 0.9) + 0.2;
  };
  const x0 = Math.floor(Math.min(o.root[0], o.root[0] + u[0] * L) - o.width - 3);
  const x1 = Math.ceil(Math.max(o.root[0], o.root[0] + u[0] * L) + o.width + 3);
  const y0 = Math.floor(Math.min(o.root[1], o.root[1] + u[1] * L) - o.width - 3);
  const y1 = Math.ceil(Math.max(o.root[1], o.root[1] + u[1] * L) + o.width + 3);
  const pitch = (L - 6) / Math.max(1, teeth);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5 - o.root[0];
      const cy = y + 0.5 - o.root[1];
      const t = cx * u[0] + cy * u[1];
      if (t < 0 || t > L) continue;
      const s = cx * e[0] + cy * e[1]; // + toward the cutting edge
      const h = half(t);
      // the spine is straight; the cutting edge is cut with teeth (a saw: a long slope, a short drop)
      let eh = h;
      if (t > 5 && t < L - 3) {
        const ph = ((t - 5) % pitch) / pitch;
        eh = h - (1 - ph) * 2.4;
      }
      if (s > eh || s < -h * 0.9) continue;
      // planes across the blade: lit face toward the light, shade away, a mid ridge between
      const across = (s + h * 0.9) / (h * 0.9 + eh); // 0 spine … 1 edge
      const flat = eLit ? across : 1 - across; // 1 = the lit side
      const plane = flat > 0.62 ? 2 : flat < 0.3 ? 0 : 1;
      const tone = plane === 2 ? PAL.night3 : plane === 1 ? PAL.night2 : PAL.night1;
      q.set(x, y, tone);
      mask.set(y * q.w + x, plane);
    }
  // the edge line: the outermost pixel of each row of the blade on the cutting side
  for (let t = 1; t < L; t += 0.5) {
    const k = t / L;
    const h = half(t);
    let eh = h;
    if (t > 5 && t < L - 3) {
      const ph = ((t - 5) % pitch) / pitch;
      eh = h - (1 - ph) * 2.4;
    }
    const sx = o.root[0] + u[0] * t + e[0] * (eh - 0.5);
    const sy = o.root[1] + u[1] * t + e[1] * (eh - 0.5);
    const px = Math.floor(sx);
    const py = Math.floor(sy);
    const i = py * q.w + px;
    if (!mask.has(i)) continue;
    if (edge[edge.length - 1] !== i) edge.push(i);
    // the line itself: bright only where the edge faces the light or on a tooth's tip
    q.set(px, py, eLit ? (k > 0.85 ? PAL.white : PAL.mist) : PAL.night4);
  }
  const tip: V = [o.root[0] + u[0] * L, o.root[1] + u[1] * L];
  return { mask, edge, tip, u, e };
}

// ------------------------------------------------------------------ the cloak

export interface CloakOpts {
  /** the top edge: the left end (near shoulder) and the right end (behind the head), frame px */
  top: readonly [V, V];
  /** the hem line's rest y and the strips' ragged lengths (px) */
  hemY: number;
  /** x offset the trailing tips sit off their rest, by depth (whole px) */
  sway: number;
  /** px the hem lifts (negative) or drops */
  lift: number;
  /** a flow phase 0…1 running the ripple along the folds */
  phase: number;
  far?: boolean;
}

/** The ragged tail lengths of the cloak's strips (hash-free, hand-set, so the silhouette is a design). */
const TAILS: readonly number[] = [4, 9, 2, 8, 5, 10, 3, 7];

/**
 * The cloak: a sheet hanging behind the shoulders and trailing back to the left, in strips whose hems are
 * ragged teeth ≥ 2 px wide. Returns its mask.
 */
export function cloak(q: PixelCanvas, light: Light, o: CloakOpts): Map<number, number> {
  const mask = new Map<number, number>();
  const tones = o.far ? CLOTH_FAR : CLOTH;
  const [a, b] = o.top;
  const p2 = light.from === 'right';
  const rows = Math.round(o.hemY - a[1]);
  // each row y: the sheet runs from xl(y) to xr(y); the left edge flows back with depth + the sway
  const STRIP = 5;
  for (let r = 0; r <= rows + 12; r++) {
    const y = Math.round(a[1] + r);
    const depth = r / Math.max(1, rows);
    const wave = Math.round(Math.sin((o.phase + depth * 0.9) * Math.PI * 2) * (0.3 + 0.7 * depth) + o.sway * depth * depth);
    const xl = Math.round(a[0] - 1 - 9 * depth * depth - 3 * depth) + wave;
    const xr = Math.round(b[0] - 4 + 2 * depth);
    for (let x = xl; x <= xr; x++) {
      // the hem: strips of STRIP px, each ending at its own ragged length (teeth ≥ 2 px wide)
      const si = Math.floor((x - xl + 1000) / STRIP);
      const tail = TAILS[((si % TAILS.length) + TAILS.length) % TAILS.length];
      const hemHere = rows - 6 + tail + o.lift;
      if (r > hemHere) continue;
      // planes measured from the lit edge of the strip (the edge facing the key light)
      const fromEdge = p2 ? xr - x : x - xl;
      const within = (x - xl + 1000) % STRIP;
      const inStrip = p2 ? STRIP - 1 - within : within;
      const plane = fromEdge < 2 ? 2 : inStrip === 0 ? 2 : inStrip >= STRIP - 1 ? 0 : 1;
      q.set(x, y, tones[plane]);
      mask.set(y * q.w + x, plane);
    }
  }
  return mask;
}
