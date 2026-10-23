// Mercan Yılanı v3 (A4.1) — the PART PAINTERS on the 'serpent' type (A3_MIMARI §3.3 PartPainter). No
// default export (the registry imports this file at boot and gets nothing; nothing heavy at load).
//
// What lives here: the slots' part list for the tube (BACK: the far arc; BODY: tail, near arc, neck —
// both painted by ./coral_serpent-body.ts, the value planes, scale rows and ventral plates measured on
// the still), the FIN / FAN membranes, the P2 relight of the still's rigid parts (stillP2: the coral
// caps its lit plane at mag3, mag4 only on edges and tips), the MATTER effects (the drip, spray and
// splash as ≥ 2-px clusters, the summon's whirl, the death's foam heap) and the WATER in the mouth and
// the jet's root (water bands, moving current dashes, ≥ 2-px white foam; never cyan, never a laser —
// src/art/materials/defs/water.ts). The head assembly (skull, jaw and mouth, crown) is
// ./coral_serpent-head.ts.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { Light } from '../rigkit/light';
import { hash2 } from '../rigkit/passes/types';
import { edgeNormal } from '../rigkit/edges';
import { lightOf } from '../rigkit/light';
import { SECTIONS, serpentRest, type SerpentPose, type SerpentRig, type SerpentPart, type TubeField } from './coral_serpent-plan';
import { paintBody, THROAT, toneIndex, type Bands } from './coral_serpent-body';
import { BUILD, FRAME, OX, OY, TONES, type SerpentFx } from './coral_serpent-build';
import { ownerAt, partPixels, stillAt } from './coral_serpent-maps';
import type { V } from '../rigkit/geom';

export type Pose = PlanPose<SerpentPose, SerpentFx>;
export type Ctx = PartCtx<Pose, SerpentRig>;
export type Part = SerpentPart<SerpentFx>;

// ------------------------------------------------------------------ body planes (./coral_serpent-body.ts)

const [W0, W1, W2, W3, W4] = TONES.scale;
const [Q, S, M] = TONES.belly;

// ------------------------------------------------------------------ the frame's pattern space (part 2)
//
// Every painter records, for each pixel it paints, the still px that pixel came from (a rigid part's own
// px, the tube's sample, the fin's sample): the foam pass (death / revive) erodes in that space, so the
// foam rides the body and never crawls. One frame is drawn at a time; BACK — the first part of every
// frame — resets the record. NO_PATTERN = painted by nothing that foams.

export const NO_PATTERN = -32768;
export const PATTERN = { x: new Int16Array(FRAME.w * FRAME.h).fill(NO_PATTERN), y: new Int16Array(FRAME.w * FRAME.h).fill(NO_PATTERN) };
function resetPattern(): void {
  PATTERN.x.fill(NO_PATTERN);
  PATTERN.y.fill(NO_PATTERN);
}
export function markPattern(x: number, y: number, sx: number, sy: number): void {
  if (x < 0 || y < 0 || x >= FRAME.w || y >= FRAME.h) return;
  PATTERN.x[y * FRAME.w + x] = sx;
  PATTERN.y[y * FRAME.w + x] = sy;
}

// ------------------------------------------------------------------ the summon's water body (part 2)
//
// fx.form / fx.skin (./coral_serpent-build.ts): a place u along the body (0 the tail tip … 1 the head)
// exists once the stream has reached it (u ≤ form) and wears its hide once the skin, sweeping down from
// the head, has reached it (u ≥ 1 − skin; a part's `lead` takes it earlier: the coral crown breaks the
// surface first). Before that it is WATER: the same silhouette in the water material's own planes —
// lighter, glassy, no scale rows, no plates, no eye (REHBER §2.3 Su: three bands, the inner depth a
// darker band, MA-4 no alpha) — with a 1-px current running up it (fx.flow moves it ≥ 1 px a frame)
// and the stream's head foaming at the front.

export type Formed = 'none' | 'water' | 'hide';
export function formedAt(fx: SerpentFx, u: number, lead = 0): Formed {
  if (fx.form <= 0 || u > fx.form + 1e-6) return 'none';
  return fx.skin > 0 && u + lead >= 1 - fx.skin - 1e-6 ? 'hide' : 'water';
}
/** the stream's foaming head: px of arc behind the formation front; the front bulges forward by `bulge` · r at the spine */
const FORM_CAP = 2.6;
const FORM_BULGE = 0.9;
/**
 * the water body's planes on n·L: one value lighter than the hide everywhere (water3 the body, water4
 * the lit band, water2 the turned side, water1 only the underside's inner depth); the far arc one value
 * darker; the contour that faces the key light is a 1-px white rim (the wet, glassy edge)
 */
const WATER_NEAR: Bands = { ramp: [W1, W2, W3, W4], th: [-0.45, -0.05, 0.42] };
const WATER_FAR: Bands = { ramp: [W0, W1, W2, W3], th: [-0.45, -0.05, 0.42] };
const WATER_RIM = 0.55;
/** the current: a 1-px line at this lateral share of the radius (dorsal −), dashed along s, moving with fx.flow */
const CURRENT = { at: -0.42, dash: 4, gap: 3, speed: 9 };

/** A rigid still colour as water (by value: the head's planes keep their light, lose their hide). */
export function waterize(col: number): number {
  const r = (col >> 16) & 255;
  const g = (col >> 8) & 255;
  const b = col & 255;
  const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  return lum < 0.13 ? W1 : lum < 0.3 ? W2 : lum < 0.6 ? W3 : W4;
}

/** The whole tube of a frame painted once (both slots read it): the canvas, which pixels are the far arc, the pattern space. */
interface BodyPaint {
  readonly c: PixelCanvas;
  readonly far: Uint8Array;
  readonly sx: Int16Array;
  readonly sy: Int16Array;
}
const bodyPaints = new WeakMap<SerpentRig, Map<string, BodyPaint>>();
const FAR_SECTION = SECTIONS.indexOf('back');
function bodyOf(ctx: Ctx): BodyPaint {
  const { swell, form, skin, flow } = ctx.pose.fx;
  const key = `${ctx.light.from}:${swell}:${form}:${skin}:${flow}`;
  let per = bodyPaints.get(ctx.rig);
  const hit = per?.get(key);
  if (hit) return hit;
  const c = new PixelCanvas(ctx.w, ctx.h);
  const sx = new Int16Array(c.w * c.h).fill(NO_PATTERN);
  const sy = new Int16Array(c.w * c.h).fill(NO_PATTERN);
  const f = paintBody(c, ctx.rig, ctx.light, {
    belly: BUILD.belly,
    tube: swell > 0 ? { swell: { at: THROAT.at, half: THROAT.half, px: THROAT.px * swell } } : undefined,
    still: { x: sx, y: sy },
  });
  const far = new Uint8Array(c.w * c.h);
  for (let i = 0; i < far.length; i++) if (f.sec[i] === FAR_SECTION) far[i] = 1;
  if (form < 1 || skin < 1) waterBody(c, f, ctx, far, sx, sy);
  const out = { c, far, sx, sy };
  if (!per) bodyPaints.set(ctx.rig, (per = new Map()));
  per.set(key, out);
  return out;
}

/** The summon's water body over the painted tube (see above): unformed places erased, unskinned ones water. */
function waterBody(c: PixelCanvas, f: TubeField, ctx: Ctx, far: Uint8Array, sx: Int16Array, sy: Int16Array): void {
  const { rig, light } = ctx;
  const { form, flow } = ctx.pose.fx;
  const s0 = rig.s0.tail;
  const span = rig.s0.neck + rig.len.neck - s0 || 1;
  const L = light.v;
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const s = f.s[i];
      const u = (s - s0) / span;
      const st = formedAt(ctx.pose.fx, u);
      if (st === 'hide') continue;
      if (st === 'none') {
        c.erase(x, y);
        far[i] = 0;
        sx[i] = NO_PATTERN;
        sy[i] = NO_PATTERN;
        continue;
      }
      const isF = far[i] === 1;
      const v = f.v[i];
      const r = Math.max(0.5, f.r[i]);
      // the stream's head is round, not cut: its middle leads, its flanks trail
      const lag = form < 1 ? FORM_BULGE * r * (v / r) * (v / r) : 0;
      if (form < 1 && (form - u) * span < lag) {
        c.erase(x, y);
        far[i] = 0;
        sx[i] = NO_PATTERN;
        sy[i] = NO_PATTERN;
        continue;
      }
      if (form < 1 && (form - u) * span < lag + FORM_CAP) {
        // the stream's head: foam in 2-px clusters of its own (s, v) place
        const cl = hash2(Math.floor(s / 2), Math.floor(v / 2), 5);
        c.set(x, y, cl < 0.45 ? PAL.white : W4);
        continue;
      }
      const I = f.nx[i] * L[0] + f.ny[i] * L[1] + f.nz[i] * L[2] + light.lift;
      const B = isF ? WATER_FAR : WATER_NEAR;
      let t = toneIndex(B, I);
      const per = CURRENT.dash + CURRENT.gap;
      const ph = (((s - flow * CURRENT.speed) % per) + per) % per;
      if (!isF && Math.abs(v / r - CURRENT.at) * r < 0.55 && ph < CURRENT.dash) t = Math.min(B.ramp.length - 1, t + 1);
      c.set(x, y, B.ramp[t]);
    }
  // the wet rim: water px on the contour whose open side faces the key light (P2: the frame's right)
  const rim: number[] = [];
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      if (f.sec[i] < 0 || !c.isOpaque(x, y) || far[i] === 1) continue;
      if (formedAt(ctx.pose.fx, (f.s[i] - s0) / span) !== 'water') continue;
      if (c.isOpaque(x - 1, y) && c.isOpaque(x + 1, y) && c.isOpaque(x, y - 1) && c.isOpaque(x, y + 1)) continue;
      const n = edgeNormal(c, x, y);
      const l = Math.hypot(n[0], n[1]) || 1;
      if ((n[0] / l) * light.v2[0] + (n[1] / l) * light.v2[1] >= WATER_RIM) rim.push(x, y);
    }
  for (let k = 0; k < rim.length; k += 2) c.set(rim[k], rim[k + 1], PAL.white);
}

function bodyPart(layer: 'back' | 'body', far: 0 | 1): Part {
  return {
    layer,
    seam: 'none',
    paint(ctx) {
      // the far arc is the first part of every frame: a new frame's pattern record starts here
      if (far) resetPattern();
      const b = bodyOf(ctx);
      const c = ctx.canvas();
      for (let y = 0; y < c.h; y++)
        for (let x = 0; x < c.w; x++) {
          const i = y * c.w + x;
          if (b.far[i] !== far) continue;
          const v = b.c.get(x, y);
          if (v === null) continue;
          c.set(x, y, v);
          markPattern(x, y, b.sx[i], b.sy[i]);
        }
      return c;
    },
  };
}
/** The coil's far arc (behind the fin) and the rest of the tube: one painting, split by section. */
export const BACK = bodyPart('back', 1);
export const BODY = bodyPart('body', 0);

// ------------------------------------------------------------------ rigid parts (cut from the still)
//
// The skull, the coral crown, the lower jaw, the dorsal fin, the tail fan and the drop are the still's
// own pixels (./coral_serpent-maps OWNER), moved by whole pixels (IŞ-12): the crown never bends (coral
// is stone), the jaw opens by a column shear about its hinge (rig.jawA: no rotation resampling), the fin
// is carried in its own space along the neck. Their P2 view is a PLATE RELIGHT of the still (IŞ-2
// without a second painting): every form (skull + jaw, crown, fin, fan, drop) gets a pillow normal from
// its own silhouette (the gradient of its twice-blurred mask: the interior faces the viewer, the rim
// turns out) and every ramp tone steps along its ramp by the change of n·L between the two lights — rims
// facing the frame's left step down, rims facing its right step up; ink, the eye, the teeth, the gum stay.

const SW = 80; // the still's size (./coral_serpent-maps)
const SH = 80;
const TAU = Math.PI * 2;
/**
 * The forms the relight re-lights (OWNER codes), the mask their pillow normal comes from (a form grown
 * into what it joins — skull into neck, fin and fan into the tube, crown into the skull — so a junction
 * is no rim) and their ramp step (n·L per tone).
 */
const FORMS: readonly { readonly codes: string; readonly mask: string; readonly step: number }[] = [
  { codes: 'hjm', mask: 'hjmt', step: 0.3 },
  { codes: 'c', mask: 'chjm', step: 0.24 },
  { codes: 'f', mask: 'ft', step: 0.3 },
  { codes: 'a', mask: 'at', step: 0.24 },
  { codes: 'd', mask: 'd', step: 0.24 },
];
/** The ramps a rigid tone steps along (white, ink, the eye's cyan never move). */
const RIGID_RAMPS: readonly (readonly number[])[] = [TONES.scale, TONES.coral, [Q, S, M]];
const PILLOW_GAIN = 3;
const RELIT_DEAD = 0.08;

function blur3(m: Float32Array): Float32Array {
  const o = new Float32Array(m.length);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      let t = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < SW && yy < SH) t += m[yy * SW + xx];
        }
      o[y * SW + x] = t / 9;
    }
  return o;
}

let stillP2Cache: Int32Array | null = null;
/** The still's colours under the P2 light (the rigid forms re-lit, the body as painted; −1 = empty). */
function stillP2(): Int32Array {
  if (stillP2Cache) return stillP2Cache;
  const out = new Int32Array(SW * SH).fill(-1);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const c = stillAt(x, y);
      if (c !== null) out[y * SW + x] = c;
    }
  const L1 = lightOf('left');
  const L2 = lightOf('right');
  const lit = (L: Light, nx: number, ny: number, nz: number) => nx * L.v[0] + ny * L.v[1] + nz * L.v[2] + L.lift;
  for (const f of FORMS) {
    const m = new Float32Array(SW * SH);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (f.mask.includes(ownerAt(x, y))) m[y * SW + x] = 1;
    const b = blur3(blur3(m));
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= SW || y >= SH ? 0 : b[y * SW + x]);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const i = y * SW + x;
        if (!f.codes.includes(ownerAt(x, y)) || out[i] < 0) continue;
        let nx = -(at(x + 1, y) - at(x - 1, y)) * 0.5 * PILLOW_GAIN;
        let ny = -(at(x, y + 1) - at(x, y - 1)) * 0.5 * PILLOW_GAIN;
        const l = Math.hypot(nx, ny);
        if (l > 0.95) {
          nx *= 0.95 / l;
          ny *= 0.95 / l;
        }
        const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
        const dI = lit(L2, nx, ny, nz) - lit(L1, nx, ny, nz);
        if (Math.abs(dI) < RELIT_DEAD) continue;
        const k = Math.round(dI / f.step);
        if (!k) continue;
        for (const r of RIGID_RAMPS) {
          const j = r.indexOf(out[i]);
          if (j >= 0) {
            out[i] = r[Math.max(0, Math.min(r.length - 1, j + k))];
            break;
          }
        }
      }
  }
  // CORAL (A4.1 fix): a plane never steps up to mag4 — mag4 is the lit edge / tip of a branch, never a
  // plane; it comes only from the edge pass: a coral pixel whose open side faces the P2 light (the frame's
  // upper right) or a spine tip (≤ 1 coral 4-neighbour) the still lit with mag4
  const [, , , MAG3, MAG4] = TONES.coral;
  const coralAt = (x: number, y: number) => x >= 0 && y >= 0 && x < SW && y < SH && ownerAt(x, y) === 'c' && out[y * SW + x] >= 0;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      if (ownerAt(x, y) !== 'c' || out[i] < 0) continue;
      const was = stillAt(x, y);
      const n4 = (coralAt(x - 1, y) ? 1 : 0) + (coralAt(x + 1, y) ? 1 : 0) + (coralAt(x, y - 1) ? 1 : 0) + (coralAt(x, y + 1) ? 1 : 0);
      const lit = !coralAt(x, y - 1) || !coralAt(x + 1, y);
      if (was === MAG4 && (n4 <= 1 || lit)) out[i] = MAG4;
      else if (out[i] === MAG4) out[i] = MAG3;
    }
  // the relight's crumbs: a re-lit pixel left with no 4-neighbour of its own tone inside its form takes the
  // tone its form's 4-neighbours share most (a crumb the still has itself — an eye, a tooth — stays)
  const fix: number[] = [];
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const i = y * SW + x;
      const o = ownerAt(x, y);
      if (!'hjmcfa'.includes(o) || out[i] < 0 || out[i] === stillAt(x, y)) continue;
      const nb: number[] = [];
      let same = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SW || yy >= SH || ownerAt(xx, yy) !== o) continue;
        const q = out[yy * SW + xx];
        if (q < 0) continue;
        if (q === out[i]) same = true;
        nb.push(q);
      }
      if (same || nb.length < 2) continue;
      let best = nb[0];
      let bn = 0;
      for (const q of nb) {
        const c = nb.filter((v) => v === q).length;
        if (c > bn) [best, bn] = [q, c];
      }
      fix.push(i, best);
    }
  for (let k = 0; k < fix.length; k += 2) out[fix[k]] = fix[k + 1];
  stillP2Cache = out;
  return out;
}

/** A still pixel's colour under `light` (null = empty). */
export function rigidAt(x: number, y: number, light: Light): number | null {
  if (light.from === 'left') return stillAt(x, y);
  if (x < 0 || y < 0 || x >= SW || y >= SH) return null;
  const c = stillP2()[y * SW + x];
  return c < 0 ? null : c;
}

/** Stamp the still's pixels of `codes` (OWNER) under `light`, `d` whole px off their rest place. */
export function stampPart(c: PixelCanvas, codes: string, light: Light, d: V = [0, 0], o: { water?: boolean; mark?: 'still' | 'none' } = {}): void {
  const p = partPixels(codes);
  const dx = OX + Math.round(d[0]);
  const dy = OY + Math.round(d[1]);
  const relit = light.from === 'right' ? stillP2() : null;
  for (let i = 0; i < p.n; i++) {
    const col = relit ? relit[p.ys[i] * SW + p.xs[i]] : p.cols[i];
    const x = p.xs[i] + dx;
    const y = p.ys[i] + dy;
    c.set(x, y, o.water ? waterize(col) : col);
    if (o.mark === 'still') markPattern(x, y, p.xs[i], p.ys[i]);
    else if (o.mark === 'none') markPattern(x, y, NO_PATTERN, NO_PATTERN);
  }
}

/**
 * The summon's places of the rigid parts along the body (formedAt): the head assembly forms with the
 * stream's last px; the coral crown takes its hide first (it breaks the surface), the skull and the jaw
 * a little later; the tail fan forms first and takes its hide last.
 */
export const RIGID_AT = Object.freeze({
  head: { u: 0.985, lead: -0.075 },
  jaw: { u: 0.985, lead: -0.095 },
  crown: { u: 0.985, lead: 0.015 },
  fan: { u: 0.015, lead: 0.02 },
});

// ---- the head assembly (skull, jaw and mouth, crown): ./coral_serpent-head.ts

// ---- the dorsal fin, carried in FIN SPACE: (s, d) = arc length along the neck and px along the neck's
// smooth normal field (vertex normals bisect the segments and blend along each segment, so the frame
// is continuous and its inverse exact). Every still fin pixel is sampled 3 × 3 at rest, solved into fin
// space once, and placed each frame on the posed neck — its height over the contour scaled by pose.fin.h
// (flattened < 1 < flared) and by the ripple running up the fin on its own period (pose.fin.ph); a frame
// pixel takes the sample nearest its centre (nearest-neighbour: the still's pixels, never blended, no
// tears where the neck opens a bend). At rest it is the still's fin exactly.

const RIPPLE = { amp: 0.14, len: 11 };
const FIN_SUB = [-1 / 3, 0, 1 / 3];

interface NeckFrame {
  readonly ax: Float64Array;
  readonly ay: Float64Array;
  readonly ex: Float64Array;
  readonly ey: Float64Array;
  readonly len: Float64Array;
  readonly s0: Float64Array;
  /** vertex normals (the bisectors), n + 1 of them */
  readonly nx: Float64Array;
  readonly ny: Float64Array;
  readonly total: number;
}

function neckFrame(pts: readonly V[]): NeckFrame {
  const n = pts.length - 1;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const ex = new Float64Array(n);
  const ey = new Float64Array(n);
  const len = new Float64Array(n);
  const s0 = new Float64Array(n);
  const sx = new Float64Array(n);
  const sy = new Float64Array(n);
  let acc = 0;
  for (let k = 0; k < n; k++) {
    ax[k] = pts[k][0];
    ay[k] = pts[k][1];
    ex[k] = pts[k + 1][0] - pts[k][0];
    ey[k] = pts[k + 1][1] - pts[k][1];
    len[k] = Math.hypot(ex[k], ey[k]) || 1e-6;
    s0[k] = acc;
    acc += len[k];
    // the segment's normal: the travel direction turned a quarter (screen: + = to the right of travel)
    sx[k] = -ey[k] / len[k];
    sy[k] = ex[k] / len[k];
  }
  const nx = new Float64Array(n + 1);
  const ny = new Float64Array(n + 1);
  for (let v = 0; v <= n; v++) {
    const a = Math.max(0, v - 1);
    const b = Math.min(n - 1, v);
    const x = sx[a] + sx[b];
    const y = sy[a] + sy[b];
    const l = Math.hypot(x, y) || 1;
    nx[v] = x / l;
    ny[v] = y / l;
  }
  return { ax, ay, ex, ey, len, s0, nx, ny, total: acc };
}

/** Fin space → frame px. */
function finPlace(F: NeckFrame, s: number, d: number, out: [number, number]): void {
  const n = F.len.length;
  let k = 0;
  while (k < n - 1 && s > F.s0[k] + F.len[k]) k++;
  const t = Math.max(0, Math.min(1, (s - F.s0[k]) / F.len[k]));
  const x = F.nx[k] + t * (F.nx[k + 1] - F.nx[k]);
  const y = F.ny[k] + t * (F.ny[k + 1] - F.ny[k]);
  const l = Math.hypot(x, y) || 1;
  out[0] = F.ax[k] + t * F.ex[k] + (d * x) / l;
  out[1] = F.ay[k] + t * F.ey[k] + (d * y) / l;
}

/** Frame px → fin space (the root of (P − C(t)) × N(t) = 0 per segment with the least |d|). */
function finSolve(F: NeckFrame, px: number, py: number): [number, number] {
  let best = Infinity;
  let bs = 0;
  let bd = 0;
  const n = F.len.length;
  const cross = (ax: number, ay: number, bx: number, by: number) => ax * by - ay * bx;
  for (let k = 0; k < n; k++) {
    const qx = px - F.ax[k];
    const qy = py - F.ay[k];
    const dnx = F.nx[k + 1] - F.nx[k];
    const dny = F.ny[k + 1] - F.ny[k];
    // (q − t·e) × (n0 + t·dn) = 0  →  a t² + b t + c = 0
    const a = -cross(F.ex[k], F.ey[k], dnx, dny);
    const b = cross(qx, qy, dnx, dny) - cross(F.ex[k], F.ey[k], F.nx[k], F.ny[k]);
    const c = cross(qx, qy, F.nx[k], F.ny[k]);
    const roots: number[] = [];
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) > 1e-12) roots.push(-c / b);
    } else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) {
        const r = Math.sqrt(disc);
        roots.push((-b + r) / (2 * a), (-b - r) / (2 * a));
      }
    }
    for (const t of roots) {
      if (t < -1e-6 || t > 1 + 1e-6) continue;
      const nxx = F.nx[k] + t * dnx;
      const nyy = F.ny[k] + t * dny;
      const l = Math.hypot(nxx, nyy) || 1;
      const d = ((qx - t * F.ex[k]) * nxx + (qy - t * F.ey[k]) * nyy) / l;
      if (Math.abs(d) < best) {
        best = Math.abs(d);
        bs = F.s0[k] + t * F.len[k];
        bd = d;
      }
    }
  }
  return [bs, bd];
}

const neckRadius = (rig: SerpentRig, s: number) => {
  const [r0, r1] = rig.radius.neck;
  return r0 + (r1 - r0) * Math.pow(Math.max(0, Math.min(1, s / rig.len.neck)), BUILD.neck.taper);
};

interface FinSamples {
  readonly n: number;
  readonly s: Float64Array;
  /** px over the neck's rest contour (signed d − radius on the fin's side) */
  readonly e: Float64Array;
  /** still px of the sample */
  readonly x: Int16Array;
  readonly y: Int16Array;
  readonly side: number;
}
let finSamples: FinSamples | null = null;
function restFin(): FinSamples {
  if (finSamples) return finSamples;
  const rig = serpentRest(BUILD);
  const F = neckFrame(rig.neck);
  const p = partPixels('f');
  const S: number[] = [];
  const E: number[] = [];
  const X: number[] = [];
  const Y: number[] = [];
  let side = 0;
  for (let i = 0; i < p.n; i++)
    for (const oy of FIN_SUB)
      for (const ox of FIN_SUB) {
        const [s, d] = finSolve(F, p.xs[i] + OX + 0.5 + ox, p.ys[i] + OY + 0.5 + oy);
        side += Math.sign(d);
        S.push(s);
        E.push(d);
        X.push(p.xs[i]);
        Y.push(p.ys[i]);
      }
  side = Math.sign(side) || 1;
  for (let i = 0; i < S.length; i++) E[i] = side * E[i] - neckRadius(rig, S[i]);
  finSamples = { n: S.length, s: Float64Array.from(S), e: Float64Array.from(E), x: Int16Array.from(X), y: Int16Array.from(Y), side };
  return finSamples;
}

export const FIN: Part = {
  layer: 'fin',
  seam: 'none',
  paint(ctx) {
    const { rig, pose, light } = ctx;
    const h0 = pose.fin.h;
    if (!(h0 > 0.05)) return null;
    const c = ctx.canvas();
    const T = restFin();
    const F = neckFrame(rig.neck);
    const relit = light.from === 'right' ? stillP2() : null;
    // the summon's water body: the fin's place along the body is its sample's place on the neck
    const s0 = rig.s0.tail;
    const span = rig.s0.neck + rig.len.neck - s0 || 1;
    const summon = pose.fx.form < 1 || pose.fx.skin < 1;
    // per frame pixel: the nearest sample's distance² (the sample wins the pixel)
    const best = new Float32Array(c.w * c.h).fill(Infinity);
    const won = new Int32Array(c.w * c.h).fill(-1);
    const q: [number, number] = [0, 0];
    for (let i = 0; i < T.n; i++) {
      const s = T.s[i];
      const e = T.e[i];
      const st = summon ? formedAt(pose.fx, (rig.s0.neck + s - s0) / span) : 'hide';
      if (st === 'none') continue;
      // the height over the contour: h and the ripple (measured from the still's fin: phase 0 is the still)
      const hf = h0 * (1 + RIPPLE.amp * (Math.sin(TAU * (pose.fin.ph + s / RIPPLE.len)) - Math.sin((TAU * s) / RIPPLE.len)));
      const r = neckRadius(rig, s);
      finPlace(F, s, T.side * (r + (e > 0 ? e * hf : e)), q);
      const x = Math.floor(q[0]);
      const y = Math.floor(q[1]);
      if (x < 0 || y < 0 || x >= c.w || y >= c.h) continue;
      const dd = (q[0] - x - 0.5) ** 2 + (q[1] - y - 0.5) ** 2;
      const k = y * c.w + x;
      if (dd >= best[k]) continue;
      best[k] = dd;
      won[k] = i;
      const col = relit ? relit[T.y[i] * SW + T.x[i]] : (stillAt(T.x[i], T.y[i]) as number);
      c.set(x, y, st === 'water' ? waterize(col) : col);
    }
    dropSpecks(c, FIN_SPECK);
    for (let k = 0; k < won.length; k++) if (won[k] >= 0 && c.isOpaque(k % c.w, Math.floor(k / c.w))) markPattern(k % c.w, Math.floor(k / c.w), T.x[won[k]], T.y[won[k]]);
    return c;
  },
};

/** px below which a fin piece the stretch tore off is dropped (a flared fin over an opened bend) */
const FIN_SPECK = 8;
/** Clear the 8-connected opaque pieces of `c` smaller than `min` px. */
function dropSpecks(c: PixelCanvas, min: number): void {
  const seen = new Uint8Array(c.w * c.h);
  const stack: number[] = [];
  const piece: number[] = [];
  for (let i0 = 0; i0 < seen.length; i0++) {
    if (seen[i0] || !c.isOpaque(i0 % c.w, Math.floor(i0 / c.w))) continue;
    piece.length = 0;
    stack.push(i0);
    seen[i0] = 1;
    while (stack.length) {
      const i = stack.pop() as number;
      piece.push(i);
      const x = i % c.w;
      const y = Math.floor(i / c.w);
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= c.w || yy >= c.h) continue;
          const j = yy * c.w + xx;
          if (seen[j] || !c.isOpaque(xx, yy)) continue;
          seen[j] = 1;
          stack.push(j);
        }
    }
    if (piece.length < min) for (const i of piece) c.erase(i % c.w, Math.floor(i / c.w));
  }
}

/** The tail fan, whole px with the tail tip (+ pose.fan px of flick). */
export const FAN: Part = {
  layer: 'fan',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.fan.u, RIGID_AT.fan.lead);
    if (st === 'none') return null;
    const c = ctx.canvas();
    const rest = serpentRest(BUILD).tailTip;
    const tip = ctx.rig.tailTip;
    stampPart(c, 'a', ctx.light, [tip[0] - rest[0], tip[1] - rest[1] + ctx.pose.fan], { water: st === 'water', mark: 'still' });
    return c;
  },
};

// ---- matter in front (outlined with the body): the drop, the roar's spray, the hit's splash

/** The drop's cycle (fx.drip phase): a bead swells under the fin's lowest ray tip, stretches, falls
 * (the still's drop at 0.34), lands short of the coil in two beads, and is gone. */
const DRIP = { src: [25, 42] as const, fall: 6, still: 0.34 };

function paintDrip(c: PixelCanvas, p: number, light: Light): void {
  if (!(p > 0)) return;
  const [sx, sy] = DRIP.src;
  const put = (x: number, y: number, col: number) => c.set(x + OX, y + OY, col);
  if (p < 0.14) put(sx, sy, W3);
  else if (p < 0.26) {
    put(sx, sy, W4);
    put(sx, sy + 1, W3);
  } else if (p < DRIP.still - 0.02) {
    put(sx, sy, W4);
    put(sx, sy + 1, W4);
    put(sx, sy + 2, W3);
  } else if (p < 0.72) {
    const t = Math.max(0, (p - DRIP.still) / (0.72 - DRIP.still));
    const dy = Math.round(DRIP.fall * t * t);
    const d = partPixels('d');
    for (let i = 0; i < d.n; i++) {
      const col = rigidAt(d.xs[i], d.ys[i], light);
      if (col !== null) put(d.xs[i], d.ys[i] + dy, col);
    }
  } else if (p < 0.82) {
    const y = sy + 4 + DRIP.fall;
    put(sx - 2, y, W4);
    put(sx + 2, y, W3);
  }
}

/**
 * A drop of spray / splash, along its flight — always a cluster of ≥ 2 px (REHBER §2.3 Su: foam and
 * drops ≥ 2 px, never a lone speck): fresh, a white head with a water4 tail behind it along the flight;
 * late (slowed, falling), a water4 bead over a water3 underside.
 */
function droplet(c: PixelCanvas, x: number, y: number, late: boolean, vx: number, vy: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (late) {
    c.set(xi, yi, W4);
    c.set(xi, yi + 1, W3);
    return;
  }
  const l = Math.hypot(vx, vy) || 1;
  c.set(xi - Math.round(vx / l), yi - Math.round(vy / l), W4);
  c.set(xi, yi, PAL.white);
}

/** Spray (roar): flung off the crown's spines up and back, and off the open jaws up and forward — three drops. */
const SPRAY: readonly { readonly at: 'crown' | 'mouth'; readonly from: V; readonly v: V }[] = [
  { at: 'crown', from: [-6, -10], v: [-12, -16] },
  { at: 'mouth', from: [0, -3], v: [10, -14] },
  { at: 'mouth', from: [1, 3], v: [14, -4] },
];
/** Splash (hit): water bursting off the struck skull — back over the crown and up off the snout; three drops. */
const SPLASH: readonly { readonly from: V; readonly v: V }[] = [
  { from: [-8, -6], v: [-12, -14] },
  { from: [-3, -8], v: [-5, -18] },
  { from: [-10, 0], v: [-15, -5] },
];
const GRAVITY = 22;
/** The landing splash (summon land, fx.ring): drops thrown up and out off the coil's foot, beyond the coil (frame px from its floor centre). */
const RING_DROPS: readonly { readonly from: V; readonly v: V }[] = [
  { from: [-22, 2], v: [-9, -15] },
  { from: [-17, 6], v: [-6, -10] },
  { from: [21, 1], v: [9, -14] },
  { from: [14, 7], v: [7, -9] },
  { from: [-5, 8], v: [-2, -12] },
];
const RING_AT: V = [33, 80];

export const MATTER: Part = {
  layer: 'front',
  seam: 'none',
  paint(ctx) {
    const { drip, spray, splash, ring } = ctx.pose.fx;
    if (!(drip > 0) && !(spray > 0) && !(splash > 0) && !(ring > 0)) return null;
    const c = ctx.canvas();
    paintDrip(c, drip, ctx.light);
    const { rig } = ctx;
    if (spray > 0)
      for (const d of SPRAY) {
        const o = d.at === 'crown' ? rig.crownRoot : rig.mouth;
        droplet(c, o[0] + d.from[0] + d.v[0] * spray, o[1] + d.from[1] + d.v[1] * spray + GRAVITY * spray * spray, spray > 0.7, d.v[0], d.v[1] + 2 * GRAVITY * spray);
      }
    if (splash > 0)
      for (const d of SPLASH) {
        const o = rig.eye;
        droplet(c, o[0] + d.from[0] + d.v[0] * splash, o[1] + d.from[1] + d.v[1] * splash + GRAVITY * splash * splash, splash > 0.7, d.v[0], d.v[1] + 2 * GRAVITY * splash);
      }
    if (ring > 0 && ring < 0.95)
      for (const d of RING_DROPS) {
        const y = RING_AT[1] + d.from[1] + d.v[1] * ring + GRAVITY * 1.4 * ring * ring;
        // a drop that has fallen back to the floor is gone (the ring carries its water)
        if (y > RING_AT[1] + d.from[1]) continue;
        droplet(c, RING_AT[0] + d.from[0] + d.v[0] * ring, y, ring > 0.6, d.v[0], d.v[1] + 2 * GRAVITY * 1.4 * ring);
      }
    return c;
  },
};

// ---- the water gathering in the mouth and the jet's root (after the outline: the water's own planes
// stand against the open mouth and the floor; the beam beyond is the cinematic's, from points().muzzle)
//
// WATER, not light (REHBER §2.3 Su): three bands — water4 the lit top, water3 the body, water2 the
// underside (the depth band); 1-px water4 CURRENT dashes 2–3 px long that advance 2 px a frame along
// the jet (fx.flow: the frame's phase); white ONLY as foam clusters of ≥ 2 px (the lips, the tip, the
// orb's lit cap); the jet's top and bottom edges wobble a pixel, alternating with the phase (a
// pressurised stream, never a laser). No cyan: cyan is the eye's.

/** The jet's root: px long at full spout, its half-width at the lips and at the tip, the dash period. */
const JET = { len: 9, half: 2, dash: 3, period: 5, speed: 2 };

/** The mouth's axis (rad, screen): the head's turn plus half the gape — the line the jet leaves on. */
function mouthAxis(rig: SerpentRig): number {
  return rig.turn + Math.max(0, rig.jawA) / 2;
}

export const WATER: Part = {
  layer: 'glow',
  seam: 'none',
  paint(ctx) {
    const { water, spout, flow } = ctx.pose.fx;
    if (!(water > 0) && !(spout > 0)) return null;
    const c = ctx.canvas();
    const { rig } = ctx;
    const [mx, my] = rig.mouth;
    const a = mouthAxis(rig);
    const ax = Math.cos(a);
    const ay = Math.sin(a);
    const phase = Math.round(flow);
    if (water > 0) {
      // the orb: a sphere of water gathering between the jaws — water3 body, water2 lower band, a water4
      // upper rim and, once it is full, a 2-px white cap (the lit foam) at its top-left
      const r = 0.8 + 1.7 * water;
      const cx = mx + ax * 0.5;
      const cy = my + ay * 0.5;
      for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++)
        for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
          const dx = x + 0.5 - cx;
          const dy = y + 0.5 - cy;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const up = (dx * -0.5 + dy * -0.74) / Math.max(0.5, d); // facing the key light
          c.set(x, y, d > r - 1 && up > 0.35 ? W4 : dy > r * 0.35 ? W2 : W3);
        }
      if (water >= 0.9) {
        const hx = Math.round(cx - r * 0.45);
        const hy = Math.round(cy - r * 0.55);
        c.set(hx, hy, PAL.white);
        c.set(hx + 1, hy, PAL.white);
      }
      // the drops it draws in: 2-px streaks aimed at the mouth, on a ring closing as the water gathers
      const ring = 3 + 7 * (1 - water);
      if (water < 0.95)
        for (const ang of [-2.3, -1.1, 0.6, 1.9]) {
          const px = cx + Math.cos(ang) * ring;
          const py = cy + Math.sin(ang) * ring * 0.8;
          const tx = cx - px;
          const ty = cy - py;
          const tl = Math.hypot(tx, ty) || 1;
          c.set(Math.round(px), Math.round(py), W4);
          c.set(Math.round(px - tx / tl), Math.round(py - ty / tl), W3);
        }
    }
    if (spout > 0) {
      // the jet's root: a tapering stream along the mouth's axis
      const L = Math.max(3, Math.round(JET.len * spout));
      const pxv = -ay; // across the jet (+ = below it for a rightward jet)
      const pyv = ax;
      const seen = new Set<number>();
      for (let u = 0; u <= L; u++) {
        const half = u >= L - 1 ? 1 : u >= L - 3 ? JET.half - 1 : JET.half;
        // the edges wobble a pixel, alternating along the jet and with the phase
        const wob = ((u + phase) & 1) === 0 ? 0 : 1;
        const top = -half - (u < L - 1 ? wob : 0);
        const bot = half - (u < L - 1 ? 1 - wob : 0);
        for (let v = top; v <= bot; v++) {
          const x = Math.round(mx + ax * u + pxv * v);
          const y = Math.round(my + ay * u + pyv * v);
          const key = y * 256 + x;
          if (seen.has(key)) continue;
          seen.add(key);
          let col: number = v <= top ? W4 : v >= bot ? W2 : W3;
          // the current: 1-px water4 dashes on the stream's core, advancing JET.speed px a frame
          const ph = (((u - phase * JET.speed) % JET.period) + JET.period) % JET.period;
          if (v === 0 && ph < JET.dash && u > 1 && u < L - 1) col = W4;
          // foam: 2-px white clusters at the lips (the stream's first two px, top and bottom) and the tip
          if ((u <= 1 && (v === top || v === bot)) || u >= L - 1) col = PAL.white;
          c.set(x, y, col);
        }
      }
    }
    return c;
  },
};

// the member's parts table (+ the extras' painters) is ./coral_serpent-fx.ts PARTS
