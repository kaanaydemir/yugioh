// Zehir Ejderi (venom_drake) v3 — THE BODY PAINTER on the 'serpent' type (./coral_serpent-plan.ts, imported,
// not edited): the tube's value planes (tail, near arc, far arc, neck) from the plan's tube field, rule
// planes only (no still): the key light's side of every tube is the lit plane (green-black scales on the
// leaf ramp: night0 underside, leaf0 shadow, leaf1 mid, leaf2 lit, a leaf3 1-px edge on light-facing
// contours), 2-px scale-row teeth on the mid / shadow boundary only, the bone-yellow ventral plates down
// the front of the neck and a VENOM VEIN: a 1-px leaf3 / teal3 line that snakes along the tube in tube
// space (it rides the body through every pose). Cleanup (despeckle, 1-px lateral runs, teeth) after
// ./coral_serpent-body.ts. Functions below the header are that file's (copied: shared files stay
// untouched); the still tables are gone.
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import { despeckle } from '../rigkit/raster';
import { cleanCrumbs } from '../rigkit/composite';
import { edgeNormal } from '../rigkit/edges';
import { SECTIONS, tubeField, type SectionId, type SerpentRig, type TubeField, type TubeOpts } from './coral_serpent-plan';
import { TONES } from './venom_drake-build';

const [W0, W1, W2, W3, W4] = TONES.scale;
const [Q, S, M, WH] = TONES.belly;
export interface Bands { readonly ramp: readonly number[]; readonly th: readonly number[] }
const NEAR: Bands = { ramp: [W0, W1, W2, W3], th: [-0.2, 0.4, 0.86] };
const FAR: Bands = { ramp: [W0, W0, W1, W2], th: [-0.3, 0.2, 0.6] };
const BELLY: Bands = { ramp: [Q, S, M, WH], th: [-0.3, 0.1, 0.62] };
const SECTION_BIAS: Readonly<Record<SectionId, number>> = { tail: 0, front: 0, back: 0, neck: -0.06 };
const EDGE = { near: W4, far: W3, lit: 0.35 };
const TEETH = { period: 5, len: 2, phase: 0, reach: 0.22 };
const SEAM = { period: 3, phase: 0, bias: -0.4 };
export function toneIndex(b: Bands, I: number): number { let k = 0; while (k < b.th.length && I >= b.th[k]) k++; return k; }
export interface BodyOpts { readonly tube?: TubeOpts; readonly belly?: { readonly from: number; readonly ramp: number }; readonly vein?: number }
/** The throat's swell (fx.swell 1): px of the neck's radius around arc length `at` (px from the neck's root), over ± `half`. */
export const THROAT = { at: 40, half: 6, px: 1.8 };
const bellyWidth = (w: number) => Math.max(0, Math.round(0.4 * w - 0.5));
const isFar = (k: number) => SECTIONS[k] === 'back';
const SECTION_DEPTH: readonly number[] = SECTIONS.map((id) => ({ back: 0, neck: 1, front: 2, tail: 3 })[id]);
const SCALE_SET = [W0, W1, W2, W3, W4] as const;
const SCALE_IDX: ReadonlyMap<number, number> = new Map(SCALE_SET.map((c, i) => [c, i] as const));

// ------------------------------------------------------------------ pooled buffers (one frame at a time)

const pools = new Map<string, Int16Array | Uint8Array | Float32Array>();
function pooled<T extends Int16Array | Uint8Array | Float32Array>(name: string, n: number, make: (n: number) => T): T {
  const k = `${name}:${n}`;
  let b = pools.get(k) as T | undefined;
  if (!b) pools.set(k, (b = make(n)));
  return b;
}

/** 4-connected distance (px) of every tube pixel from its own section's contour (0 = on it). */
function sectionDist(f: TubeField, into: Int16Array): Int16Array {
  const W = f.w;
  into.fill(-1);
  const q: number[] = [];
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const other = (xx: number, yy: number) => xx < 0 || yy < 0 || xx >= W || yy >= f.h || f.sec[yy * W + xx] !== k;
      if (other(x - 1, y) || other(x + 1, y) || other(x, y - 1) || other(x, y + 1)) {
        into[i] = 0;
        q.push(i);
      }
    }
  for (let h = 0; h < q.length; h++) {
    const i = q[h];
    const x = i % W;
    const k = f.sec[i];
    for (const j of [i - 1, i + 1, i - W, i + W]) {
      if (j < 0 || j >= into.length) continue;
      if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
      if (f.sec[j] !== k || into[j] >= 0) continue;
      into[j] = into[i] + 1;
      q.push(j);
    }
  }
  return into;
}

// ------------------------------------------------------------------ smoothed normals

const NORMAL_SMOOTH = { r: 2, ds: 3 };
function smoothNormals(f: TubeField): void {
  const W = f.w;
  const t = pooled('nrm', W * f.h * 3, (n) => new Float32Array(n));
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      if (f.sec[i] < 0) continue;
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let dy = -NORMAL_SMOOTH.r; dy <= NORMAL_SMOOTH.r; dy++)
        for (let dx = -NORMAL_SMOOTH.r; dx <= NORMAL_SMOOTH.r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= f.h) continue;
          const j = yy * W + xx;
          if (f.sec[j] < 0 || Math.abs(f.s[j] - f.s[i]) > NORMAL_SMOOTH.ds) continue;
          const w = Math.abs(dx) <= 1 && Math.abs(dy) <= 1 ? 1 : 0.5;
          sx += f.nx[j] * w;
          sy += f.ny[j] * w;
          sz += f.nz[j] * w;
        }
      const l = Math.hypot(sx, sy, sz) || 1;
      t[i * 3] = sx / l;
      t[i * 3 + 1] = sy / l;
      t[i * 3 + 2] = sz / l;
    }
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      if (f.sec[i] < 0) continue;
      f.nx[i] = t[i * 3];
      f.ny[i] = t[i * 3 + 1];
      f.nz[i] = t[i * 3 + 2];
    }
}
function lateralStep(f: TubeField, x: number, y: number): [number, number] | null {
  const W = f.w;
  const k = f.sec[y * W + x];
  const v = (xx: number, yy: number) => (xx < 0 || yy < 0 || xx >= W || yy >= f.h || f.sec[yy * W + xx] !== k ? NaN : f.v[yy * W + xx]);
  const c0 = f.v[y * W + x];
  const dxp = v(x + 1, y);
  const dxm = v(x - 1, y);
  const dyp = v(x, y + 1);
  const dym = v(x, y - 1);
  const gx = !Number.isNaN(dxp) && !Number.isNaN(dxm) ? (dxp - dxm) / 2 : !Number.isNaN(dxp) ? dxp - c0 : !Number.isNaN(dxm) ? c0 - dxm : 0;
  const gy = !Number.isNaN(dyp) && !Number.isNaN(dym) ? (dyp - dym) / 2 : !Number.isNaN(dyp) ? dyp - c0 : !Number.isNaN(dym) ? c0 - dym : 0;
  if (Math.hypot(gx, gy) < 1e-3) return null;
  return Math.abs(gx) >= Math.abs(gy) ? [Math.sign(gx), 0] : [0, Math.sign(gy)];
}

function lateralMerge(c: PixelCanvas, f: TubeField, dist: Int16Array, fixed: (i: number) => boolean): boolean {
  const W = f.w;
  const fix: number[] = [];
  const hide = (x: number, y: number, k: number) => {
    if (x < 0 || y < 0 || x >= W || y >= f.h) return null;
    const j = y * W + x;
    if (f.sec[j] !== k) return null;
    const col = c.get(x, y);
    return col !== null && SCALE_IDX.has(col) ? col : null;
  };
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0 || fixed(i) || dist[i] === 0) continue;
      const col = c.get(x, y);
      const ti = col === null ? undefined : SCALE_IDX.get(col);
      if (ti === undefined) continue;
      const st = lateralStep(f, x, y);
      if (!st) continue;
      const a = hide(x + st[0], y + st[1], k);
      const b = hide(x - st[0], y - st[1], k);
      if (a === null || b === null || a === col || b === col) continue;
      const ia = SCALE_IDX.get(a) as number;
      const ib = SCALE_IDX.get(b) as number;
      const da = Math.abs(ia - ti);
      const db = Math.abs(ib - ti);
      // ties: the darker band (a 1-px lit sliver goes back into the plane under it)
      fix.push(x, y, da < db ? a : db < da ? b : ia <= ib ? a : b);
    }
  for (let q = 0; q < fix.length; q += 3) c.set(fix[q], fix[q + 1], fix[q + 2]);
  return fix.length > 0;
}

/**
 * Scale-row teeth: a darker-band pixel reaching 1 px into the next lighter band (one lateral neighbour its
 * own band, the other one tone lighter) whose run along the boundary is 1 px grows into the neighbouring
 * boundary pixel along the band (so the tooth is 2 px), or, if neither can take it, goes back to the band.
 */
function teeth(c: PixelCanvas, f: TubeField, dist: Int16Array, fixed: (i: number) => boolean): void {
  const W = f.w;
  const at = (x: number, y: number, k: number): number | null => {
    if (x < 0 || y < 0 || x >= W || y >= f.h) return null;
    const j = y * W + x;
    if (f.sec[j] !== k || dist[j] === 0) return null;
    const col = c.get(x, y);
    return col !== null && SCALE_IDX.has(col) ? col : null;
  };
  const free = (x: number, y: number) => !fixed(y * W + x);
  const fix: number[] = [];
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0 || fixed(i)) continue;
      const col = at(x, y, k);
      if (col === null) continue;
      const st = lateralStep(f, x, y);
      if (!st) continue;
      const ti = SCALE_IDX.get(col) as number;
      const a = at(x + st[0], y + st[1], k);
      const b = at(x - st[0], y - st[1], k);
      // the tooth tip: one lateral side its own band, the other the next lighter tone
      const bandSide = b === col && a !== null && SCALE_IDX.get(a) === ti + 1 ? -1 : a === col && b !== null && SCALE_IDX.get(b) === ti + 1 ? 1 : 0;
      if (!bandSide) continue;
      const lighter = (bandSide === -1 ? a : b) as number;
      const along: [number, number] = [-st[1], st[0]];
      const p = at(x + along[0], y + along[1], k);
      const m = at(x - along[0], y - along[1], k);
      if (p === col || m === col) continue; // already ≥ 2 px along the boundary
      // a tooth reaches OUT of a band that runs on under both its along-neighbours
      const under1 = at(x + along[0] + st[0] * bandSide, y + along[1] + st[1] * bandSide, k);
      const under2 = at(x - along[0] + st[0] * bandSide, y - along[1] + st[1] * bandSide, k);
      if (under1 !== col || under2 !== col) continue;
      if (p === lighter && free(x + along[0], y + along[1])) fix.push(x + along[0], y + along[1], col);
      else if (m === lighter && free(x - along[0], y - along[1])) fix.push(x - along[0], y - along[1], col);
      else fix.push(x, y, lighter);
    }
  for (let q = 0; q < fix.length; q += 3) c.set(fix[q], fix[q + 1], fix[q + 2]);
}

/** (rule planes) The 1-px edge on light-facing contours of the tube (IŞ-8). */
function edges(c: PixelCanvas, f: TubeField, light: Light): void {
  const W = f.w;
  const H = f.h;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : f.sec[y * W + x]);
  const depth = (k: number) => (k < 0 ? -Infinity : SECTION_DEPTH[k]);
  const hits: number[] = [];
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const k = at(x, y);
      if (k < 0) continue;
      // open: no tube there, or a section further back
      const open = (xx: number, yy: number) => {
        const q = at(xx, yy);
        return q < 0 || depth(q) < depth(k) - 1e-6;
      };
      if (!(open(x - 1, y) || open(x + 1, y) || open(x, y - 1) || open(x, y + 1))) continue;
      const nn = edgeNormal(c, x, y, open);
      const l = Math.hypot(nn[0], nn[1]) || 1;
      const facing = (nn[0] / l) * light.v2[0] + (nn[1] / l) * light.v2[1];
      if (facing >= EDGE.lit) hits.push(x, y, isFar(k) ? EDGE.far : EDGE.near);
    }
  for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
}
// ------------------------------------------------------------------ painting

/** The vein: lateral centre (fraction of the radius) along s, its period (px), the branch ticks' period. */
const VEIN = { amp: 0.34, period: 21, tick: 8, phase: 0.6 };

export function paintBody(c: PixelCanvas, rig: SerpentRig, light: Light, o: BodyOpts = {}): TubeField {
  const f = tubeField(rig, c.w, c.h, o.tube);
  smoothNormals(f);
  const n = f.w * f.h;
  const dist = sectionDist(f, pooled('dist', n, (k) => new Int16Array(k)));
  const L = light.v;
  const W = f.w;
  const neckS0 = rig.s0.neck;
  const neckK = SECTIONS.indexOf('neck');
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const id = SECTIONS[k];
      const s = f.s[i];
      const I = f.nx[i] * L[0] + f.ny[i] * L[1] + f.nz[i] * L[2] + light.lift + SECTION_BIAS[id];
      if (k === neckK && o.belly) {
        const sl = s - neckS0;
        const grow = Math.max(0, Math.min(1, (sl - o.belly.from) / Math.max(1, o.belly.ramp)));
        const r = f.r[i];
        const bw = Math.round(bellyWidth(2 * r) * grow);
        const dv = Math.floor(r - f.v[i]);
        if (bw > 0 && dv < bw) {
          const seam = (((Math.floor(sl - SEAM.phase) % SEAM.period) + SEAM.period) % SEAM.period) === 0 && dv > 0 && dv < bw - 1;
          c.set(x, y, BELLY.ramp[Math.min(2, toneIndex(BELLY, I + (seam ? SEAM.bias : 0)))]);
          continue;
        }
      }
      const B = isFar(k) ? FAR : NEAR;
      let t = toneIndex(B, I);
      if (t === 2 && toneIndex(B, I - TEETH.reach) === 1) {
        const ph = (((s - TEETH.phase) % TEETH.period) + TEETH.period) % TEETH.period;
        if (ph < TEETH.len) t = 1;
      }
      c.set(x, y, B.ramp[t]);
    }
  despeckle(c, 2, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });
  for (let pass = 0; pass < 2; pass++) if (!lateralMerge(c, f, dist, () => false)) break;
  teeth(c, f, dist, () => false);
  despeckle(c, 2, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });
  cleanCrumbs(c);
  edges(c, f, light);
  if (o.vein !== undefined) paintVein(c, f, o.vein, dist);
  return f;
}

/** The venom vein (a 1-px line snaking in tube space + short branch ticks): 0 dead, 1 lit, 2 hot. */
function paintVein(c: PixelCanvas, f: TubeField, glow: number, dist: Int16Array): void {
  const col = glow <= 0.01 ? W1 : glow < 1.5 ? TONES.vein[0] : TONES.vein[1];
  const W = f.w;
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      if (f.sec[i] < 0 || dist[i] < 2) continue;
      const have = c.get(x, y);
      if (have === null || !SCALE_IDX.has(have)) continue; // never over the plates
      const r = Math.max(1.5, f.r[i]);
      const vc = VEIN.amp * r * Math.sin((2 * Math.PI * f.s[i]) / VEIN.period + VEIN.phase);
      const d = Math.abs(f.v[i] - vc);
      const sm = ((f.s[i] % VEIN.tick) + VEIN.tick) % VEIN.tick;
      if (d < 0.5 || (d >= 0.5 && d < 2.2 && sm < 0.9 && Math.sin((2 * Math.PI * f.s[i]) / VEIN.period + VEIN.phase) * (f.v[i] - vc) > 0)) c.set(x, y, col);
    }
}
