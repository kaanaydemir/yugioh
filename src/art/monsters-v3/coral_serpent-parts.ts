// Mercan Yılanı v3 (A4.1) — the PART PAINTERS on the 'serpent' type (A3_MIMARI §3.3 PartPainter). No
// default export (the registry imports this file at boot and gets nothing; nothing heavy at load).
//
// THE BODY (one painting for the whole tube: tail, near arc, far arc, neck — split by section into two
// slots, the far arc in 'back' behind the dorsal fin, the rest in 'body' in front of it) turns the plan's tube field
// (rigkit raster.tube per section, one record per pixel: section, arc length s, signed lateral offset,
// radius) into the approved still's value planes, measured in pixels from the tube's own contours the
// way the still was painted — never a gradient, never a texture that slides:
//   the LIT side is the side of the tube whose normal faces the key light (P1: the screen's top-left;
//   the P2 relight: the frame's top-right, shown flipped), so the planes follow the light in every pose
//   and both views. From the lit contour: a 1-px EDGE (water4 where that contour faces the light
//   squarely, water3 where it only grazes it, water2 where it turns away — the neck's lower S), the LIT
//   plane (water3, the widest, calm), the MID plane (water2); from the shadow contour: the UNDERSIDE
//   (water0) and the SHADOW plane (water1). The far arc is one value darker (edge water3, lit water2,
//   mid water1, a 3-px water0 crease band over the hole).
//   SCALE ROWS (A4.1 still decision): 2-px teeth of the darker band about every 5 px along s, only on
//   the mid / shadow boundary; the lit plane stays calm.
//   The VENTRAL PLATES run along the neck's ventral side (the front of the rising neck): from the
//   ventral contour night3 (the far side), steel (the plate; night3 on the seam every 3 px of s), mist
//   (the plate edge facing forward); under the P2 relight the plates face the light and step up once.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { Light } from '../rigkit/light';
import { despeckle } from '../rigkit/raster';
import { hash2 } from '../rigkit/passes/types';
import { edgeNormal } from '../rigkit/edges';
import { lightOf } from '../rigkit/light';
import { SECTIONS, serpentRest, tubeField, type SectionId, type SerpentPose, type SerpentRig, type SerpentPart, type TubeField, type TubeOpts } from './coral_serpent-plan';
import { BUILD, FRAME, OX, OY, TONES, type SerpentFx } from './coral_serpent-build';
import { ownerAt, partPixels, stillAt } from './coral_serpent-maps';
import type { V } from '../rigkit/geom';

export type Pose = PlanPose<SerpentPose, SerpentFx>;
export type Ctx = PartCtx<Pose, SerpentRig>;
export type Part = SerpentPart<SerpentFx>;

// ------------------------------------------------------------------ body planes

const [W0, W1, W2, W3, W4] = TONES.scale;
const [Q, S, M, WH] = TONES.belly;

/** A band table: tones dark → light over ascending thresholds on n·L + lift + bias (IŞ-3). */
interface Bands {
  readonly ramp: readonly number[];
  readonly th: readonly number[];
}
/** the near hide: underside, shadow, mid, lit (the water4 edge comes from the edge pass) */
const NEAR: Bands = { ramp: [W0, W1, W2, W3], th: [-0.3, 0.18, 0.54] };
/** the far arc, one value darker: the shadow and the underside merge into a water0 crease band over the hole */
const FAR: Bands = { ramp: [W0, W0, W1, W2], th: [-0.3, 0.12, 0.46] };
/** the ventral plates (P1: in shadow — night3 far side, steel plate, mist edge facing forward; lit: white) */
const BELLY: Bands = { ramp: [Q, S, M, WH], th: [-0.3, 0.1, 0.62] };
/** a section's whole-band shift (the neck leans a little away from the light) */
const SECTION_BIAS: Readonly<Record<SectionId, number>> = { tail: 0, front: 0, back: 0, neck: -0.06 };
/** the edge pass: near / far edge tone, the facing at or above which a contour is lit (IŞ-8) */
const EDGE = { near: W4, far: W3, lit: 0.35 };
/** scale rows: every `period` px of s a `len`-px tooth of the darker band crosses the mid / shadow boundary */
const TEETH = { period: 5, len: 2, phase: 0, reach: 0.22 };
/** seams across the ventral plates every 3 px of s along the neck (one step darker) */
const SEAM = { period: 3, phase: 0, bias: -0.4 };

function toneIndex(b: Bands, I: number): number {
  let k = 0;
  while (k < b.th.length && I >= b.th[k]) k++;
  return k;
}

export interface BodyOpts {
  readonly tube?: TubeOpts;
  /** belly plates: px along the neck where they start (from the neck's root) and their ramp */
  readonly belly?: { readonly from: number; readonly ramp: number };
  /** paint the rule planes only (no still tones): the fallback, for tools */
  readonly rules?: boolean;
  /**
   * (part 2) out: per frame pixel the still px its tone came from (the foam pass's pattern space); a
   * rule-plane pixel gets its tube place instead, (STILL_TUBE + s, v) — distinct from every still px
   */
  readonly still?: { readonly x: Int16Array; readonly y: Int16Array };
}

/** Pattern-space x offset of a tube place that has no still sample (a stretched neck's rule planes). */
export const STILL_TUBE = 1000;

/** The ventral plates' width (px) on a neck of width `w` (the still: 3 px on the 9-px upper neck, 4 on the wider lower neck). */
const bellyWidth = (w: number) => Math.max(0, Math.round(0.4 * w - 0.5));

const isFar = (k: number) => SECTIONS[k] === 'back';

// ------------------------------------------------------------------ the still's tones in tube space
//
// Every tube pixel of the approved still is recorded once, at rest, under its place on the tube: the
// section, the arc length s (whole px), the side (dorsal / ventral) and its distance in px from the
// section's contour (a 4-connected count, the way the still's planes are measured). A frame looks its
// pixels up under the same key and RE-LIGHTS the still's tone by the change of n·L since rest
// (thresholds of the band tables: a pixel that turned toward the light steps up its ramp, away from it
// steps down; P2 the same against its own light). So the rest pose is the still pixel for pixel, the
// planes, teeth and plates travel with the body, and the light stays right in every pose and both views.

interface Sample {
  readonly col: number;
  /** n·L of the rest pose under the P1 light (+ the section's bias) */
  readonly I: number;
  /** a still px of that colour under this key (the foam pass's pattern space: it rides the tube) */
  readonly x: number;
  readonly y: number;
}

const DEAD = 0.06;
const SCALE_SET = [W0, W1, W2, W3, W4] as const;
const BELLY_SET = [Q, S, M, WH] as const;

/** s in half-px bins (a bend's outer side spreads its pixels along s: whole px would merge neighbours) */
const S_BIN = 2;
/** the lateral offset in bins of r / 8 (normalised: a swollen or thinned tube keeps its contour rows) */
const V_BIN = 8;
const sBin = (s: number) => Math.round(s * S_BIN);
const vBin = (v: number, r: number) => Math.max(-V_BIN, Math.min(V_BIN, Math.round((v / Math.max(0.5, r)) * V_BIN)));
const tubeKey = (sec: number, sb: number, vb: number) => (sec * 4096 + Math.max(0, Math.min(4095, sb + 512))) * 32 + (vb + 16);

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
    const y = (i - x) / W;
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

let REST_TUBE: Map<number, Sample> | null = null;
const distPool = new Map<number, Int16Array>();
function distBuf(n: number): Int16Array {
  let d = distPool.get(n);
  if (!d) distPool.set(n, (d = new Int16Array(n)));
  return d;
}

/** The rest table: the still's tube pixels under their tube-space keys (built once, lazily). */
function restTube(): Map<number, Sample> {
  if (REST_TUBE) return REST_TUBE;
  const rig = serpentRest(BUILD);
  const f = tubeField(rig, FRAME.w, FRAME.h);
  const dist = sectionDist(f, distBuf(f.w * f.h));
  const L = lightOf('left').v;
  const votes = new Map<number, Map<number, { n: number; I: number; x: number; y: number }>>();
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const vx = x - OX;
      const vy = y - OY;
      if (ownerAt(vx, vy) !== 't') continue;
      const col = stillAt(vx, vy);
      if (col === null) continue;
      const key = tubeKey(k, sBin(f.s[i]), vBin(f.v[i], f.r[i]));
      const I = f.nx[i] * L[0] + f.ny[i] * L[1] + f.nz[i] * L[2] + SECTION_BIAS[SECTIONS[k]];
      let m = votes.get(key);
      if (!m) votes.set(key, (m = new Map()));
      const e = m.get(col);
      if (e) e.n++;
      else m.set(col, { n: 1, I, x: vx, y: vy });
    }
  const t = new Map<number, Sample>();
  for (const [key, m] of votes) {
    let best: { col: number; n: number; I: number; x: number; y: number } | null = null;
    for (const [col, e] of m) if (!best || e.n > best.n) best = { col, n: e.n, I: e.I, x: e.x, y: e.y };
    if (best) t.set(key, { col: best.col, I: best.I, x: best.x, y: best.y });
  }
  REST_TUBE = t;
  return t;
}

/** Search order of a lookup: the same lateral bin along s first (± 2 px), then a bin in or out. */
const SEARCH: readonly (readonly [ds: number, dv: number])[] = (() => {
  const out: [number, number][] = [];
  for (const dv of [0, -1, 1]) for (const ds of [0, -1, 1, -2, 2, -3, 3, -4, 4]) out.push([ds, dv]);
  return out;
})();

/** The still's sample nearest to a tube place, or null (a lateral step never crosses the spine). */
function lookup(t: Map<number, Sample>, k: number, s: number, v: number, r: number): Sample | null {
  const sb = sBin(s);
  const vb = vBin(v, r);
  for (const [ds, dv] of SEARCH) {
    const vv = vb + dv;
    if (vv < -V_BIN || vv > V_BIN || (vb !== 0 && Math.sign(vv) === -Math.sign(vb))) continue;
    const e = t.get(tubeKey(k, sb + ds, vv));
    if (e) return e;
  }
  return null;
}

/** Re-light a still tone by the change of n·L since rest: k steps up / down its ramp (water4 / white only on a contour). */
function relight(col: number, Inow: number, Irest: number, far: boolean, d: number): number {
  const sc = SCALE_SET.indexOf(col as (typeof SCALE_SET)[number]);
  const bl = sc < 0 ? BELLY_SET.indexOf(col as (typeof BELLY_SET)[number]) : -1;
  if (sc < 0 && bl < 0) return col;
  const B = bl >= 0 ? BELLY : far ? FAR : NEAR;
  const I = Inow - Math.max(-DEAD, Math.min(DEAD, Inow - Irest));
  const dk = toneIndex(B, I) - toneIndex(B, Irest);
  if (!dk) return col;
  if (bl >= 0) return BELLY_SET[Math.max(0, Math.min(d === 0 ? 3 : 2, bl + dk))];
  const top = far ? (d === 0 ? 3 : 2) : d === 0 ? 4 : 3;
  // a tone already above the cap (the still's own water4 edge) never steps up past itself
  return SCALE_SET[Math.max(0, Math.min(Math.max(top, sc), sc + dk))];
}

/**
 * Paint the tube into `c` (frame size): the still's tones carried in tube space and re-lit (above),
 * else the rule planes from the cylinder normals and the key light — scale-row teeth, the ventral
 * plates — and the 1-px edge on light-facing contours (IŞ-8). Returns the field it painted from.
 */
export function paintBody(c: PixelCanvas, rig: SerpentRig, light: Light, o: BodyOpts = {}): TubeField {
  // (the rest table first: it renders the rest field into the same pooled buffers)
  const rest = o.rules ? null : restTube();
  const f = tubeField(rig, c.w, c.h, o.tube);
  const L = light.v;
  const W = f.w;
  const neckS0 = rig.s0.neck;
  const neckK = SECTIONS.indexOf('neck');
  const dist = sectionDist(f, distBuf(f.w * f.h));
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const id = SECTIONS[k];
      const s = f.s[i];
      const I = f.nx[i] * L[0] + f.ny[i] * L[1] + f.nz[i] * L[2] + light.lift + SECTION_BIAS[id];
      if (rest) {
        const e = lookup(rest, k, s, f.v[i], f.r[i]);
        if (e) {
          c.set(x, y, relight(e.col, I, e.I, isFar(k), dist[i]));
          if (o.still) {
            o.still.x[i] = e.x;
            o.still.y[i] = e.y;
          }
          continue;
        }
      }
      if (o.still) {
        o.still.x[i] = STILL_TUBE + Math.round(s);
        o.still.y[i] = Math.round(f.v[i]);
      }
      // ---- the rule planes (no still tone here)
      if (k === neckK && o.belly) {
        const sl = s - neckS0;
        const grow = Math.max(0, Math.min(1, (sl - o.belly.from) / Math.max(1, o.belly.ramp)));
        const r = f.r[i];
        const bw = Math.round(bellyWidth(2 * r) * grow);
        const dv = Math.floor(r - f.v[i]);
        if (bw > 0 && dv < bw) {
          const seam = (((Math.floor(sl - SEAM.phase) % SEAM.period) + SEAM.period) % SEAM.period) === 0 && dv > 0 && dv < bw - 1;
          c.set(x, y, BELLY.ramp[toneIndex(BELLY, I + (seam ? SEAM.bias : 0))]);
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
  if (!rest) {
    despeckle(c, 2, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });
    edges(c, f, light);
  }
  return f;
}

/** The 1-px edge on light-facing contours of the tube (IŞ-8). */
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
      const n = edgeNormal(c, x, y, open);
      const l = Math.hypot(n[0], n[1]) || 1;
      const facing = (n[0] / l) * light.v2[0] + (n[1] / l) * light.v2[1];
      if (facing >= EDGE.lit) hits.push(x, y, isFar(k) ? EDGE.far : EDGE.near);
    }
  for (let i = 0; i < hits.length; i += 3) c.set(hits[i], hits[i + 1], hits[i + 2]);
}

/** Section index → its depth order (back < neck < front < tail). */
const SECTION_DEPTH: readonly number[] = SECTIONS.map((id) => ({ back: 0, neck: 1, front: 2, tail: 3 })[id]);

/** The throat's swell (fx.swell 1): px of the neck's radius around arc length `at` (px from the neck's root), over ± `half`. */
const THROAT = { at: 27, half: 5, px: 2.2 };

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
  if (u > fx.form + 1e-6) return 'none';
  return fx.skin > 0 && u + lead >= 1 - fx.skin - 1e-6 ? 'hide' : 'water';
}
/** the stream's foaming head: px of arc behind the formation front */
const FORM_CAP = 3;
/** the water body's planes on n·L (near; the far arc one value darker) */
const WATER_NEAR: Bands = { ramp: [W1, W2, W3, W4], th: [-0.32, 0.08, 0.52] };
const WATER_FAR: Bands = { ramp: [W0, W1, W2, W3], th: [-0.32, 0.08, 0.52] };
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
      if ((form - u) * span < FORM_CAP && form < 1) {
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
  stillP2Cache = out;
  return out;
}

/** A still pixel's colour under `light` (null = empty). */
function rigidAt(x: number, y: number, light: Light): number | null {
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

// ---- the eye (still px): iris, hot core, the white glint toward the snout; the socket around them

const EYE = { iris: [[52, 26], [51, 27]] as const, core: [52, 27] as const, glint: [53, 27] as const, lid: [[53, 26], [50, 27]] as const };

function paintEye(c: PixelCanvas, ctx: Ctx): void {
  const { eye, squint, glint } = ctx.pose.fx;
  const [sx, sy] = ctx.rig.shift;
  const put = (x: number, y: number, col: number) => c.set(x + OX + sx, y + OY + sy, col);
  const [SOCKET, IRIS, CORE, WHITE] = TONES.eye;
  if (eye <= 0.5) {
    for (const [x, y] of EYE.iris) put(x, y, SOCKET);
    put(EYE.core[0], EYE.core[1], IRIS);
    put(EYE.glint[0], EYE.glint[1], SOCKET);
  } else if (eye >= 1.5) {
    for (const [x, y] of EYE.iris) put(x, y, CORE);
    put(EYE.core[0], EYE.core[1], WHITE);
    put(EYE.lid[0][0], EYE.lid[0][1], IRIS); // the iris widens a pixel toward the snout
  }
  if (squint >= 0.5) {
    // the upper lid comes down: the top row of the eye goes to the socket, the slit keeps its light
    put(EYE.iris[0][0], EYE.iris[0][1], SOCKET);
    put(EYE.lid[0][0], EYE.lid[0][1], SOCKET);
    if (squint >= 1) put(EYE.glint[0], EYE.glint[1], CORE);
  }
  if (glint >= 1) {
    const [gx, gy] = EYE.glint;
    put(gx, gy, WHITE);
    if (glint >= 2) {
      put(gx, gy - 1, WHITE);
      put(gx + 1, gy, WHITE);
      put(gx - 1, gy, CORE);
      put(gx, gy + 1, CORE);
    }
  }
}

/** The skull: cranium, snout, eye socket, upper fang — rigid, whole px with the head joint. */
export const HEAD: Part = {
  layer: 'head',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.head.u, RIGID_AT.head.lead);
    if (st === 'none') return null;
    const c = ctx.canvas();
    stampPart(c, 'h', ctx.light, ctx.rig.shift, { water: st === 'water', mark: 'still' });
    if (st === 'hide') paintEye(c, ctx);
    return c;
  },
};

/** The coral crown: horn crescent, staghorn spines, webs — stone: rigid, carried by the skull; flare stands it up a pixel. */
export const CROWN: Part = {
  layer: 'crown',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.crown.u, RIGID_AT.crown.lead);
    if (st === 'none') return null;
    const c = ctx.canvas();
    const [sx, sy] = ctx.rig.shift;
    const k = Math.max(0, Math.round(ctx.pose.crown));
    // coral is stone: it never foams (no pattern), and where the body foams away under it, it sinks (fx.sink)
    stampPart(c, 'c', ctx.light, [sx - k, sy - k + Math.round(ctx.pose.fx.sink)], { water: st === 'water', mark: 'none' });
    return c;
  },
};

// ---- the jaw: the lower jaw and the lower lip line drop by the column shear; the upper lip line (each
// column's topmost mouth pixel) stays with the skull; the gape between them is the mouth.

interface JawCol {
  /** still px of the parts that move (lower jaw + lower lip) */
  readonly mx: Int16Array;
  readonly my: Int16Array;
  /** the upper lip line (stays) */
  readonly ux: Int16Array;
  readonly uy: Int16Array;
  /** per column x: the skull's lowest row (−1 = none) and the moving part's top row below it (−1 = none) */
  readonly upperBottom: Int16Array;
  readonly lowerTop: Int16Array;
}
let jawCols: JawCol | null = null;
function jawColumns(): JawCol {
  if (jawCols) return jawCols;
  const top = new Int16Array(SW).fill(-1);
  for (let x = 0; x < SW; x++)
    for (let y = 0; y < SH; y++)
      if (ownerAt(x, y) === 'm') {
        top[x] = y;
        break;
      }
  const mx: number[] = [];
  const my: number[] = [];
  const ux: number[] = [];
  const uy: number[] = [];
  const upperBottom = new Int16Array(SW).fill(-1);
  const lowerTop = new Int16Array(SW).fill(-1);
  for (let x = 0; x < SW; x++)
    for (let y = 0; y < SH; y++) {
      const o = ownerAt(x, y);
      if (o === 'h' || (o === 'm' && y === top[x])) {
        if (o === 'm') {
          ux.push(x);
          uy.push(y);
        }
        upperBottom[x] = Math.max(upperBottom[x], y);
      } else if (o === 'j' || o === 'm') {
        mx.push(x);
        my.push(y);
      }
    }
  for (let x = 0; x < SW; x++) {
    if (upperBottom[x] < 0) continue;
    for (let i = 0; i < mx.length; i++) if (mx[i] === x && my[i] > upperBottom[x] && (lowerTop[x] < 0 || my[i] < lowerTop[x])) lowerTop[x] = my[i];
  }
  jawCols = { mx: Int16Array.from(mx), my: Int16Array.from(my), ux: Int16Array.from(ux), uy: Int16Array.from(uy), upperBottom, lowerTop };
  return jawCols;
}

const HINGE_X = BUILD.head.hinge[0] - OX;
/** The mouth: deep in the gape ink, the gum mag0; the water's light comes after the outline (WATER). */
const MOUTH = { deep: 3, ink: PAL.ink, gum: PAL.mag0 };

/** Whole px a still column x drops at the jaw's shear (rig.jawA). */
export function jawDrop(x: number, jawA: number): number {
  return jawA > 0 ? Math.max(0, Math.round((x + 0.5 - HINGE_X) * Math.tan(jawA))) : 0;
}

/** The lower jaw, the lips and the open mouth. */
export const JAW: Part = {
  layer: 'jaw',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.jaw.u, RIGID_AT.jaw.lead);
    if (st === 'none') return null;
    const water = st === 'water';
    const c = ctx.canvas();
    const { rig, light } = ctx;
    const J = jawColumns();
    const ox = OX + rig.shift[0];
    const oy = OY + rig.shift[1];
    const put = (x: number, y: number, col: number, sxp: number, syp: number) => {
      c.set(x, y, water ? waterize(col) : col);
      markPattern(x, y, sxp, syp);
    };
    // the gape first (the jaw's own pixels go over it)
    for (let x = 0; x < SW; x++) {
      const d = jawDrop(x, rig.jawA);
      if (!d || J.upperBottom[x] < 0 || J.lowerTop[x] < 0) continue;
      for (let y = J.upperBottom[x] + 1; y < J.lowerTop[x] + d; y++) put(x + ox, y + oy, x - HINGE_X < MOUTH.deep ? MOUTH.ink : MOUTH.gum, x, Math.min(y, J.lowerTop[x]));
    }
    for (let i = 0; i < J.ux.length; i++) {
      const col = rigidAt(J.ux[i], J.uy[i], light);
      if (col !== null) put(J.ux[i] + ox, J.uy[i] + oy, col, J.ux[i], J.uy[i]);
    }
    for (let i = 0; i < J.mx.length; i++) {
      const col = rigidAt(J.mx[i], J.my[i], light);
      if (col !== null) put(J.mx[i] + ox, J.my[i] + oy + jawDrop(J.mx[i], rig.jawA), col, J.mx[i], J.my[i]);
    }
    return c;
  },
};

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

/** A drop of spray / splash, along its flight: a white head and a water4 tail while fresh, a water4 bead late. */
function droplet(c: PixelCanvas, x: number, y: number, late: boolean, vx: number, vy: number): void {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (late) {
    c.set(xi, yi, W4);
    return;
  }
  const l = Math.hypot(vx, vy) || 1;
  c.set(xi - Math.round(vx / l), yi - Math.round(vy / l), W4);
  c.set(xi, yi, PAL.white);
}

/** Spray (roar): flung off the crown's spines up and back, and off the open jaws up and forward. */
const SPRAY: readonly { readonly at: 'crown' | 'mouth'; readonly from: V; readonly v: V }[] = [
  { at: 'crown', from: [-6, -10], v: [-12, -16] },
  { at: 'crown', from: [2, -9], v: [-4, -20] },
  { at: 'mouth', from: [0, -3], v: [10, -14] },
  { at: 'mouth', from: [1, 3], v: [14, -4] },
];
/** Splash (hit): water bursting off the struck skull — back over the crown and up off the snout. */
const SPLASH: readonly { readonly from: V; readonly v: V }[] = [
  { from: [-8, -6], v: [-12, -14] },
  { from: [-3, -8], v: [-5, -18] },
  { from: [4, -4], v: [6, -16] },
  { from: [-10, 0], v: [-15, -5] },
];
const GRAVITY = 22;

export const MATTER: Part = {
  layer: 'front',
  seam: 'none',
  paint(ctx) {
    const { drip, spray, splash } = ctx.pose.fx;
    if (!(drip > 0) && !(spray > 0) && !(splash > 0)) return null;
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
    return c;
  },
};

// ---- light after the outline: the water gathering in the mouth, the jet's root

/** The orb in the mouth (fx.water) and the jet's root (fx.spout), light: never outlined. */
export const WATER: Part = {
  layer: 'glow',
  seam: 'none',
  paint(ctx) {
    const { water, spout } = ctx.pose.fx;
    if (!(water > 0) && !(spout > 0)) return null;
    const c = ctx.canvas();
    const [mx, my] = ctx.rig.mouth;
    const cx = Math.round(mx);
    const cy = Math.round(my);
    if (water > 0) {
      const r = 0.8 + 1.7 * water;
      for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const d = Math.hypot(x - cx, y - cy);
          if (d > r) continue;
          c.set(x, y, d <= r - 1.2 ? PAL.white : d <= r - 0.6 ? PAL.cyan4 : W4);
        }
      // drops drawn in toward the mouth from a ring that closes as the water gathers
      const ring = 2 + 8 * (1 - water);
      for (const a of [-2.3, -1.2, 0.5, 1.9]) c.set(Math.round(cx + Math.cos(a) * ring), Math.round(cy + Math.sin(a) * ring * 0.8), W4);
    }
    if (spout > 0) {
      const len = Math.round(3 + 5 * spout);
      for (let i = 0; i <= len; i++) {
        const x = cx + i;
        const half = i >= len - 1 ? 0 : 1;
        for (let dy = -half; dy <= half; dy++) c.set(x, cy + dy, dy === 0 ? PAL.white : PAL.cyan4);
        if (half && i < len - 2) {
          c.set(x, cy - 2, W4);
          c.set(x, cy + 2, W3);
        }
      }
    }
    return c;
  },
};

// the member's parts table (+ the extras' painters) is ./coral_serpent-fx.ts PARTS
