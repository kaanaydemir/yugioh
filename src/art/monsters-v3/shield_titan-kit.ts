// Kalkan Devi v3 — the painting KIT: the tone vocabulary (iron, bronze, gold, crimson), map stamping with
// the P2 relight, one-ramp-step creases and a flat three-band limb block. Local copies of the ideas the
// Taş Muhafız file proved (the shared rigkit stays untouched).
//
// Tone roles (each material's ramp, dark → light): D deep rim · S shadow plane · M mid plane · L lit plane
// · H lit rim · T top-face highlight. IRON = night1…mist, BRONZE = earth0…earth4 (maps write iron as
// UPPER-case letters and bronze as lower-case). A P2 sheet is lit from the frame's right: L↔S and H↔D swap
// (the same plates, carvings and cuts, the lit and the shaded planes exchanged — IŞ-2).
//
// Map key: . empty · k ink · D S M L H T iron · d s m l h t bronze · 1 2 3 4 5 gold0…gold4 ·
//          a b c e crimson0…3 · f g j leaf1…3 · v night0 · x y z amber (fire2 / fire3 / fire4) · w white

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';

export type V = readonly [number, number];

export const IRON = [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist] as const; // D S M L H T
export const BRONZE = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4, PAL.earth4] as const;
export const GOLD = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
export const CRIM = [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4] as const;
export const LEAF = [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4] as const;
export const AMBER = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4] as const;

export const KEY: Readonly<Record<string, number>> = Object.freeze({
  k: PAL.ink,
  D: IRON[0], S: IRON[1], M: IRON[2], L: IRON[3], H: IRON[4], T: IRON[5],
  d: BRONZE[0], s: BRONZE[1], m: BRONZE[2], l: BRONZE[3], h: BRONZE[4], t: BRONZE[5],
  '1': GOLD[0], '2': GOLD[1], '3': GOLD[2], '4': GOLD[3], '5': GOLD[4],
  a: CRIM[0], b: CRIM[1], c: CRIM[2], e: CRIM[3],
  f: LEAF[1], g: LEAF[2], j: LEAF[3],
  v: PAL.night0,
  x: PAL.fire2, y: PAL.fire3, z: PAL.fire4, w: PAL.white,
});

/** The P2 relight: the lit and the shaded tone of a plane exchange (a map is authored for the P1 light). */
const SWAP: Readonly<Record<string, string>> = Object.freeze({ L: 'S', S: 'L', H: 'D', D: 'H', l: 's', s: 'l', h: 'd', d: 'h', e: 'b', b: 'e', '4': '2', '2': '4', '5': '1', '1': '5' });
export const relitChar = (ch: string, light: Light): string => (light.side > 0 ? (SWAP[ch] ?? ch) : ch);

/** All the ramps, for stepping a tone down / up (creases and cast shadows). */
const RAMP_LIST: readonly (readonly number[])[] = [
  [PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist],
  [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4],
  [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4],
  [PAL.crim0, PAL.crim1, PAL.crim2, PAL.crim3, PAL.crim4],
  [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4],
];
function rampOf(c: number): { ramp: readonly number[]; i: number } | null {
  for (const ramp of RAMP_LIST) {
    const i = ramp.indexOf(c);
    if (i >= 0) return { ramp, i };
  }
  return null;
}
/** k steps down its own ramp (unknown colours stay). */
export function stepDown(c: number, k = 1): number {
  const r = rampOf(c);
  return r ? r.ramp[Math.max(0, r.i - k)] : c;
}
export function stepUp(c: number, k = 1): number {
  const r = rampOf(c);
  return r ? r.ramp[Math.min(r.ramp.length - 1, r.i + k)] : c;
}

/** Stamp a character map at (x0, y0) into q for the given light; `clipY`: rows below it are not drawn; `shear(row)`: px the row is moved. */
export function stampRows(q: PixelCanvas, rows: readonly string[], x0: number, y0: number, light: Light, clipY = Infinity, shear?: (row: number) => number): void {
  for (let j = 0; j < rows.length; j++) {
    const y = y0 + j;
    if (y > clipY) break;
    const row = rows[j];
    const sx = shear ? shear(j) : 0;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const c = KEY[relitChar(ch, light)];
      if (c !== undefined) q.set(x0 + sx + i, y, c);
    }
  }
}

/** The pixels of `q` that touch (4-neighbour) an opaque pixel of `dst` but are empty in q: the crease ring around a part. */
export function creaseAround(dst: PixelCanvas, q: PixelCanvas, k = 1, only?: (c: number) => boolean): void {
  const hits: number[] = [];
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = x + dx;
        const ty = y + dy;
        if (!q.isOpaque(tx, ty) && dst.isOpaque(tx, ty)) hits.push(tx, ty);
      }
    }
  const done = new Set<number>();
  for (let i = 0; i < hits.length; i += 2) {
    const key = hits[i + 1] * dst.w + hits[i];
    if (done.has(key)) continue;
    done.add(key);
    const c = dst.get(hits[i], hits[i + 1])!;
    if (only && !only(c)) continue;
    dst.set(hits[i], hits[i + 1], stepDown(c, k));
  }
}

export interface LimbOpts {
  /** the material's six tones (dark → light): IRON or BRONZE */
  readonly tones: readonly number[];
  /** half width at a and at b (px) */
  readonly w: readonly [number, number]
  /** extend past a / b along the bone (px) */
  readonly cap?: readonly [number, number];
}

/**
 * A flat three-band limb along a → b (frame px): the lit third, the mid, the shaded third by pixel counts
 * across the bone, never a gradient; a lit rim pixel on the lit edge and a deep rim on the dark one. The
 * geometry never depends on the light (P1 and P2 share the silhouette); only the bands swap.
 */
export function limb(q: PixelCanvas, a: V, b: V, light: Light, o: LimbOpts): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const [c0, c1] = o.cap ?? [0, 0];
  const t = o.tones;
  const x0 = Math.floor(Math.min(a[0], b[0]) - o.w[0] - o.w[1] - 2);
  const x1 = Math.ceil(Math.max(a[0], b[0]) + o.w[0] + o.w[1] + 2);
  const y0 = Math.floor(Math.min(a[1], b[1]) - o.w[0] - o.w[1] - 2);
  const y1 = Math.ceil(Math.max(a[1], b[1]) + o.w[0] + o.w[1] + 2);
  // the lit side of the bone: the perpendicular that faces the light's screen direction
  const nx = -uy;
  const ny = ux;
  const litSign = nx * light.v2[0] + ny * light.v2[1] >= 0 ? 1 : -1;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5 - a[0];
      const py = y + 0.5 - a[1];
      const along = px * ux + py * uy;
      if (along < -c0 || along > L + c1) continue;
      const across = (px * nx + py * ny) * litSign; // + toward the light
      const tt = Math.max(0, Math.min(1, along / L));
      const hw = o.w[0] + (o.w[1] - o.w[0]) * tt;
      if (Math.abs(across) > hw) continue;
      const u = across / hw; // −1 shadow edge … +1 lit edge
      let k: number;
      if (u > 0.78) k = 4;
      else if (u > 0.15) k = 3;
      else if (u > -0.45) k = 2;
      else if (u > -0.85) k = 1;
      else k = 0;
      q.set(x, y, t[k]);
    }
}

/** The giant's armour is a darker alloy than the shield's frame: every IRON tone one step down (bronze, gold and the rest stay). */
const IRON_DOWN = new Map<number, number>([
  [IRON[5], IRON[4]], [IRON[4], IRON[3]], [IRON[3], IRON[2]], [IRON[2], IRON[1]], [IRON[1], IRON[0]], [IRON[0], PAL.night0],
]);
export function darkIron(q: PixelCanvas): void {
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      const c = q.get(x, y);
      if (c === null || !q.isOpaque(x, y)) continue;
      const d = IRON_DOWN.get(c);
      if (d !== undefined) q.set(x, y, d);
    }
}
