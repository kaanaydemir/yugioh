// Magma Titanı v3 (A4.1) — the POSED LIMBS: an arm swung away from its hang (the cocked fist, the punch,
// the guard's crossed forearms, the roar's flung arms) is drawn along the plan's solved bones with the
// still's plane rules, so every frame keeps the still's craft without a hand-painted frame:
//   - a bone is a basalt BLOCK (upper arm, forearm), its direction snapped to a clean pixel slope
//     (0, 1:2, 1:1, 2:1, upright: the long edges are straight pixel lines, never a 1-px jitter);
//   - three planes across it by facing (IŞ-3): of its two long faces the one that looks more toward the
//     key light is lit, the other shadow, the front between them mid — the basalt ramp (stone2 / stone1
//     / stone0; the far arm one value darker: stone1 / stone0 / stone0); bands by pixel counts, never a
//     gradient; P2's light (the frame's top-right) re-decides the faces, so P2 is relit, not mirrored;
//   - the still's glass: a ≤ 3-px stone3 run on the lit long edge's upper end of a near block (basalt
//     edge.hi) — never a long contour line;
//   - a 1-px lava crack along the forearm's front face (2-px jogs, no lone pixels), lit by fx.heatN /
//     heatF as light after the outline (the heat runs down the arm into the fist);
//   - the forearm laid over the upper arm with a crease on it (IŞ-5), the whole arm laying its crease
//     band on the body behind it (1 px above, 1 beside, 2 below; one ramp step down, never ink);
//   - the FIST is a box at the end of the forearm, a little wider than it: its back (the face toward
//     the light) lit, the curled fingers on the front face mid with two lava finger gaps along the
//     punch, the knuckle face (the box's end) shadow — LIGHT when heated: fire3 → fire4 → white-hot on
//     contact (fx.heatN ≥ 1.8), never at rest.

import { PAL } from '../palette';
import type { PixelCanvas } from '../pixel';
import type { BipedRig } from '../bodyplans/biped/v1';
import type { V } from '../rigkit/geom';
import type { Light } from '../rigkit/light';
import type { LavaKind } from './magma_titan-maps';

export interface LimbLava {
  x: number;
  y: number;
  t: number;
  kind: LavaKind;
  d: number;
}

const NEAR = [PAL.stone0, PAL.stone1, PAL.stone2] as const; // shadow, mid, lit
const FAR = [PAL.stone0, PAL.stone0, PAL.stone1] as const;

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
const lightDir = (light: Light): V => (light.from === 'right' ? [0.5, -0.74] : [-0.5, -0.74]);

export interface BlockOpts {
  /** width across the bone at a and at b (px) */
  w: readonly [number, number];
  far?: boolean;
  /** extend past a / b along the bone (px) */
  cap?: readonly [number, number];
  /** lit / shadow band shares of the width (the front takes the rest) */
  bands?: readonly [number, number];
  /** a short stone3 run on the lit edge near a (near blocks only) */
  glass?: boolean;
  /** a lava crack along the front face: its still tone step (2 fire2 …) and kind */
  crack?: { t: number; kind: LavaKind; from: number; to: number; off: number; jog?: boolean };
  /** an end face at b this many px thick (the fist's knuckles): its own plane (normal along the bone) */
  endFace?: number;
  /** px cut off the four end corners (a rock chunk, not a beam): [at a, at b] */
  chamfer?: readonly [number, number];
}

export interface BlockOut {
  /** pixels of the block (frame px) → their plane: 0 shadow, 1 mid, 2 lit, 3 end face */
  mask: Map<number, number>;
  lava: LimbLava[];
}

/**
 * A basalt block from a toward b (the direction snapped to a clean slope; the length kept), painted
 * into q. Returns its pixels (for creases) and its lava pixels (light, re-toned after the outline).
 */
export function block(q: PixelCanvas, a: V, b: V, light: Light, o: BlockOpts): BlockOut {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u = snapDir([b[0] - a[0], b[1] - a[1]]);
  let n: V = [-u[1], u[0]];
  // the long face that looks more toward the light is the lit one (its normal is +n)
  const ld = lightDir(light);
  if (n[0] * ld[0] + n[1] * ld[1] < 0) n = [-n[0], -n[1]];
  const [c0, c1] = o.cap ?? [0, 0];
  const [bl, bs] = o.bands ?? [0.3, 0.3];
  const ramp = o.far ? FAR : NEAR;
  const wAt = (t: number) => o.w[0] + (o.w[1] - o.w[0]) * Math.max(0, Math.min(1, t / L));
  const wMax = Math.max(o.w[0], o.w[1]);
  const x0 = Math.floor(Math.min(a[0], a[0] + u[0] * (L + c1)) - wMax - 2);
  const x1 = Math.ceil(Math.max(a[0], a[0] + u[0] * (L + c1)) + wMax + 2);
  const y0 = Math.floor(Math.min(a[1], a[1] + u[1] * (L + c1)) - wMax - 2);
  const y1 = Math.ceil(Math.max(a[1], a[1] + u[1] * (L + c1)) + wMax + 2);
  const mask = new Map<number, number>();
  const lava: LimbLava[] = [];
  const endT = L + c1 - (o.endFace ?? 0);
  // the end face's tone: it looks along the bone
  const endLit = u[0] * ld[0] + u[1] * ld[1] > 0.35 ? 2 : u[0] * ld[0] + u[1] * ld[1] < -0.35 ? 0 : 1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const cx = x + 0.5 - a[0];
      const cy = y + 0.5 - a[1];
      const t = cx * u[0] + cy * u[1];
      if (t < -c0 || t > L + c1) continue;
      const s = cx * n[0] + cy * n[1];
      const w = wAt(t);
      if (Math.abs(s) > w / 2) continue;
      // the chamfered corners: near either end the block narrows by up to `chamfer` px
      if (o.chamfer) {
        const da = t + c0;
        const db = L + c1 - t;
        const ca = o.chamfer[0] - da;
        const cb = o.chamfer[1] - db;
        const cut = Math.max(ca, cb, 0);
        if (cut > 0 && Math.abs(s) > w / 2 - cut) continue;
      }
      const nl = Math.max(1, Math.round(bl * w));
      const ns = Math.max(1, Math.round(bs * w));
      let plane = s > w / 2 - nl ? 2 : s < -w / 2 + ns ? 0 : 1;
      if (o.endFace && t > endT) plane = 3;
      const tone = plane === 3 ? ramp[endLit] : ramp[plane];
      q.set(x, y, tone);
      mask.set(y * q.w + x, plane);
    }
  // the glass: a short stone3 run on the lit long edge, near a (the block's light-facing upper corner)
  if (o.glass && !o.far) {
    let run = 0;
    for (let k = 0; k <= L && run < 3; k++) {
      // walk along the lit edge
      const w = wAt(k);
      const px = Math.floor(a[0] + u[0] * (k + 0.5) + n[0] * (w / 2 - 0.5));
      const py = Math.floor(a[1] + u[1] * (k + 0.5) + n[1] * (w / 2 - 0.5));
      if (mask.get(py * q.w + px) === 2) {
        q.set(px, py, PAL.stone3);
        run++;
      }
    }
  }
  // the lava crack on the front face: a 1-px line along the bone with one 1-px jog across it
  if (o.crack) {
    const k0 = Math.round(o.crack.from * L);
    const k1 = Math.round(o.crack.to * L);
    const jog = o.crack.jog === false ? Infinity : Math.round((k0 + k1) / 2);
    for (let k = k0; k <= k1; k++) {
      const off = o.crack.off + (k >= jog ? 1 : 0);
      const px = Math.floor(a[0] + u[0] * (k + 0.5) + n[0] * off);
      const py = Math.floor(a[1] + u[1] * (k + 0.5) + n[1] * off);
      const i = py * q.w + px;
      if (mask.get(i) !== 1) continue;
      lava.push({ x: px, y: py, t: o.crack.t, kind: o.crack.kind, d: 0 });
      q.set(px, py, PAL.fire2);
      // the jog: both pixels of the step, so the crack stays 4-connected
      if (k === jog) {
        const qx = Math.floor(a[0] + u[0] * (k - 0.5) + n[0] * off);
        const qy = Math.floor(a[1] + u[1] * (k - 0.5) + n[1] * off);
        if (mask.get(qy * q.w + qx) === 1) {
          lava.push({ x: qx, y: qy, t: o.crack.t, kind: o.crack.kind, d: 0 });
          q.set(qx, qy, PAL.fire2);
        }
      }
    }
  }
  return { mask, lava };
}

/**
 * The fist at the end of the forearm (wrist → along dir), in the still's fist language (the hanging
 * fist of src/still/titan-map.ts): a box `len` × `wid` whose planes are split by DIAGONAL boundaries,
 * not bands — the back of the hand (the corner toward the light and the wrist) lit, the curled
 * fingers mid, the knuckle end and the underside shadow; two diagonal lava finger gaps run through
 * the fingers toward the knuckles; a ≤ 3-px glass run on the lit corner. The knuckle face (the last
 * 2 px) is recorded as light: basalt at rest, fire3 → fire4 → white-hot with the arm's heat.
 */
export function fist(q: PixelCanvas, wrist: V, dir: V, light: Light, o: { len: number; wid: number; far?: boolean; kind: LavaKind }): BlockOut {
  const u = snapDir(dir);
  let n: V = [-u[1], u[0]];
  const ld = lightDir(light);
  if (n[0] * ld[0] + n[1] * ld[1] < 0) n = [-n[0], -n[1]];
  const ramp = o.far ? FAR : NEAR;
  const L = o.len;
  const w = o.wid;
  const mask = new Map<number, number>();
  const lava: LimbLava[] = [];
  const R = Math.ceil(Math.max(L, w)) + 2;
  // does the knuckle end face the light (P2 punching right: the end lit)
  const endDot = u[0] * ld[0] + u[1] * ld[1];
  const endPlane = endDot > 0.35 ? 2 : endDot < -0.35 ? 0 : 1;
  for (let y = Math.floor(wrist[1] - R); y <= Math.ceil(wrist[1] + R); y++)
    for (let x = Math.floor(wrist[0] - R); x <= Math.ceil(wrist[0] + R); x++) {
      const cx = x + 0.5 - wrist[0];
      const cy = y + 0.5 - wrist[1];
      const t = cx * u[0] + cy * u[1]; // 0 at the wrist … L at the knuckles
      const s = cx * n[0] + cy * n[1]; // + toward the lit side
      if (t < 0 || t > L || Math.abs(s) > w / 2) continue;
      // rounded corners: 2 px off the knuckle corners, 1 px off the wrist corners
      const cut = Math.max(2 - (L - t), 1 - t, 0);
      if (cut > 0 && Math.abs(s) > w / 2 - cut) continue;
      // the diagonal plane split: lit toward the light AND the wrist, shadow toward the knuckles AND away
      const k = s / (w / 2) - (t / L) * 0.9; // +1.0 lit-wrist corner … −1.9 knuckle-shadow corner
      let plane = k > 0.15 ? 2 : k < -0.95 ? 0 : 1;
      if (t > L - 2) plane = 3;
      const tone = plane === 3 ? ramp[endPlane] : ramp[plane];
      q.set(x, y, tone);
      mask.set(y * q.w + x, plane);
    }
  // the still's two finger gaps: straight runs along the fist through its mid plane, stopping a pixel
  // short of the knuckle face (fire3 on a near fist, fire2 on a far one)
  const gapTone = o.far ? 2 : 3;
  // symmetric about the fist's axis, so the gaps and the knuckle notches (geometry) sit on the same
  // pixels in both lights — only the planes follow the light (P2's silhouette is P1's)
  const GAPS = [[-0.24, 0.5, 0.86, gapTone], [0.24, 0.56, 0.86, gapTone]] as const;
  // the knuckles notched into the silhouette (the pilot's FIST_UP language): where a finger gap meets
  // the striking face, the face's outer pixel is cut away, so the end reads as three knuckle bumps
  for (const [s0] of GAPS) {
    const ss = s0 * (w / 2);
    for (let tt = L - 0.5; tt > L - 1.5; tt -= 0.5) {
      const x = Math.floor(wrist[0] + u[0] * tt + n[0] * ss);
      const y = Math.floor(wrist[1] + u[1] * tt + n[1] * ss);
      const i = y * q.w + x;
      if (!mask.has(i)) continue;
      // only an outer pixel (one with a transparent 4-neighbour past the face) is notched
      const ox = Math.floor(wrist[0] + u[0] * (tt + 1) + n[0] * ss);
      const oy = Math.floor(wrist[1] + u[1] * (tt + 1) + n[1] * ss);
      if (mask.has(oy * q.w + ox)) continue;
      mask.delete(i);
      q.erase(x, y);
      break;
    }
  }
  for (const [s0, t0, t1, tone] of GAPS) {
    for (let tt = t0 * L; tt <= t1 * L; tt += 0.5) {
      const ss = s0 * (w / 2);
      const x = Math.floor(wrist[0] + u[0] * tt + n[0] * ss);
      const y = Math.floor(wrist[1] + u[1] * tt + n[1] * ss);
      const i = y * q.w + x;
      if (mask.get(i) !== 1) continue;
      if (lava.some((l) => l.x === x && l.y === y)) continue;
      lava.push({ x, y, t: tone, kind: o.kind, d: 0 });
      q.set(x, y, tone >= 3 ? PAL.fire3 : PAL.fire2);
    }
  }
  // the glass: ≤ 3 px on the lit edge from the wrist corner (near fists only)
  if (!o.far) {
    let run = 0;
    for (let tt = 1.5; tt < L - 2 && run < 3; tt += 1) {
      const x = Math.floor(wrist[0] + u[0] * tt + n[0] * (w / 2 - 0.5));
      const y = Math.floor(wrist[1] + u[1] * tt + n[1] * (w / 2 - 0.5));
      if (mask.get(y * q.w + x) === 2) {
        q.set(x, y, PAL.stone3);
        run++;
      }
    }
  }
  // the heat: the knuckle face is light, and every other fist pixel records how far behind the face it
  // sits (t = −1 − px) and its plane (d), so the glow pass melts the fist from the striking face back —
  // white-hot only at full heat, the lit back of the hand keeping its basalt crust longest
  const gaps = new Set(lava.map((l) => l.y * q.w + l.x));
  for (const [i, plane] of mask) {
    if (gaps.has(i)) continue;
    const x = i % q.w;
    const y = Math.floor(i / q.w);
    if (plane === 3) {
      lava.push({ x, y, t: 0, kind: o.far ? 'knuckleF' : 'knuckle', d: 3 });
      continue;
    }
    const t = (x + 0.5 - wrist[0]) * u[0] + (y + 0.5 - wrist[1]) * u[1];
    lava.push({ x, y, t: -1 - Math.max(0, Math.round(L - 2 - t)), kind: o.far ? 'meltF' : 'melt', d: plane });
  }
  return { mask, lava };
}

/** IŞ-5 for a limb in front of the body: the basalt right around it one ramp step darker (1 px above / beside, 2 below). */
export function creaseBand(dst: PixelCanvas, mask: ReadonlyMap<number, number>, w: number): void {
  const STEP: Readonly<Record<number, number>> = { [PAL.stone2]: PAL.stone1, [PAL.stone3]: PAL.stone1, [PAL.stone4]: PAL.stone2, [PAL.stone1]: PAL.stone0, [PAL.stone0]: PAL.night0 };
  const hits = new Set<number>();
  for (const i of mask.keys()) {
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1], [0, 1], [0, 2]] as const) {
      const j = (y + dy) * w + (x + dx);
      if (mask.has(j)) continue;
      if (dy === 2 && !mask.has(i) ) continue;
      if (dy === 2 && mask.has((y + 1) * w + x)) continue;
      hits.add(j);
    }
  }
  for (const j of hits) {
    const x = j % w;
    const y = Math.floor(j / w);
    const c = dst.get(x, y);
    if (c === null) continue;
    const s = STEP[c];
    if (s !== undefined) dst.set(x, y, s);
  }
}

/**
 * A near part over a far one (the still's rule): a night0 cut on what is behind, right around the limb —
 * 1 px beside and above, `below` px under its bottom edge (the overhang) —, painted into the limb's own
 * layer q wherever dst is opaque there, so the cut belongs to the limb and the lava under it stays dark.
 */
export function cutBand(q: PixelCanvas, dst: PixelCanvas, mask: ReadonlyMap<number, number>, below = 2): void {
  const w = q.w;
  const steps: readonly (readonly [number, number])[] = below >= 2 ? [[1, 0], [-1, 0], [0, -1], [0, 1], [0, 2]] : [[1, 0], [-1, 0], [0, -1], [0, 1]];
  for (const i of mask.keys()) {
    const x = i % w;
    const y = Math.floor(i / w);
    for (const [dx, dy] of steps) {
      if (dy === 2 && mask.has((y + 1) * w + x)) continue;
      const j = (y + dy) * w + (x + dx);
      if (mask.has(j) || q.isOpaque(x + dx, y + dy) || !dst.isOpaque(x + dx, y + dy)) continue;
      q.set(x + dx, y + dy, PAL.night0);
    }
  }
}

/** An arm is "posed" (drawn here) once a bone has turned this far from its rest hang (rad). */
export const POSED_TURN = 0.26;

const ang = (a: V, b: V) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const turn = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
};

/** Has the near (N) / far (F) arm turned away from its hang (the rigid still arm can only slide)? */
export function armTurned(rig: BipedRig, rest: BipedRig, side: 'N' | 'F'): boolean {
  const a = side === 'N' ? rig.armN : rig.armF;
  const r = side === 'N' ? rest.armN : rest.armF;
  return turn(ang(a.root, a.mid), ang(r.root, r.mid)) > POSED_TURN || turn(ang(a.mid, a.end), ang(r.mid, r.end)) > POSED_TURN;
}
