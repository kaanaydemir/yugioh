// Mercan Yılanı v3 (A4.1) — THE BODY PAINTER: the tube's value planes (tail, near arc, far arc, neck).
// No default export (the registry imports this file at boot and gets nothing; nothing heavy at load:
// every table is built lazily on the first frame).
//
// One painting for the whole tube (./coral_serpent-parts.ts splits it by section into two slots, the far
// arc in 'back' behind the dorsal fin, the rest in 'body'). It turns the plan's tube field (rigkit
// raster.tube per section, one record per pixel: section, arc length s, signed lateral offset, radius,
// cylinder normal) into the approved still's value planes — never a gradient, never a texture that slides:
//   the LIT side is the side of the tube whose normal faces the key light (P1: the screen's top-left;
//   the P2 relight: the frame's top-right, shown flipped), so the planes follow the light in every pose
//   and both views. From the lit contour: a 1-px EDGE (water4 where that contour faces the light
//   squarely, water3 where it only grazes it, water2 where it turns away — the neck's lower S), the LIT
//   plane (water3, the widest, calm), the MID plane (water2); from the shadow contour: the UNDERSIDE
//   (water0) and the SHADOW plane (water1). The far arc is one value darker (edge water3, lit water2,
//   mid water1, a 3-px water0 crease band over the hole).
//   SCALE ROWS (A4.1 still decision, src/art/materials/defs/scale.ts): 2-px teeth of the darker band about
//   every 5 px along s, only on the mid / shadow boundary; the lit plane stays calm.
//   The VENTRAL PLATES (the front of the rising neck): from the ventral contour night3 (the far side),
//   steel (the plate; a night3 seam across it every 3 px along the contour), mist (the plate edge facing
//   forward); under the P2 relight the strip faces the light and is read from the other side.
//
// HOW (all of it measured on the still, so a change of the still propagates to every frame):
//   1. THE STILL IN TUBE SPACE. Every tube pixel of the still is recorded once, at rest, under its tube
//      place (section, s in half-px, the lateral offset in r/8 bins). A frame looks its pixels up under
//      the same key and RE-LIGHTS the still's tone by the change of n·L since rest (a pixel that turned
//      toward the light steps up its ramp, away from it steps down; P2 the same against its own light).
//      The rest pose is the still pixel for pixel.
//   2. SMOOTHED NORMALS. raster.tube gives each section its own normals; where two sections join (tail /
//      near arc, near / far arc, far arc / neck) they jump — under the P2 light (whose change from P1 is
//      the normal's x) the planes broke into segments there. The normals are averaged over the 5 × 5
//      pixels ON THE SAME STRETCH OF TUBE (|Δs| ≤ 3: a joint, never two surfaces that overlap) — the
//      rest table and every frame alike, so the rest pose is unchanged and a joint shades as one tube.
//   3. THE VENTRAL STRIP is keyed by the CONTOUR's arc length (half-px bins) and the pixel depth from
//      the ventral contour (a 4-connected count, the way the still was painted), not by the spine's s
//      and a lateral bin: on the inner side of a fold the spine's s is compressed and the still's 3-px
//      seams crowded into 1-px crumbs there. At rest it is the still's strip; in a fold its rows keep
//      their 3-px spacing along the contour and its bands their pixel widths.
//   4. THE STILL'S CRAFT, KEPT; ITS ARTIFACTS, CLEANED. After the planes are painted: a 1-px run across
//      the tube (its two neighbours along the nearer axis of the lateral direction both differ) joins
//      the neighbouring band nearer its value (IŞ-3: bands ≥ 2 px, 1 px only for edges and seams); a
//      1-px tooth of the darker band grows to 2 px along the boundary or goes (the scale-row rule); then
//      despeckle × 2 and the IŞ-4 crumb pass. Whatever those passes would change ON THE STILL ITSELF is
//      the still's own deliberate pixel (a 1-px band above a tooth, a diagonal edge line): its tube
//      place is marked once (a dry run at rest) and never cleaned in any frame — so the still's craft
//      survives every pose and only the deformation's crumbs go.

import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import { lightOf } from '../rigkit/light';
import { despeckle } from '../rigkit/raster';
import { cleanCrumbs } from '../rigkit/composite';
import { edgeNormal } from '../rigkit/edges';
import { SECTIONS, serpentRest, tubeField, type SectionId, type SerpentRig, type TubeField, type TubeOpts } from './coral_serpent-plan';
import { BUILD, FRAME, OX, OY, TONES } from './coral_serpent-build';
import { ownerAt, stillAt } from './coral_serpent-maps';

const [W0, W1, W2, W3, W4] = TONES.scale;
const [Q, S, M, WH] = TONES.belly;

/** A band table: tones dark → light over ascending thresholds on n·L + lift + bias (IŞ-3). */
export interface Bands {
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
/** (rule planes) scale rows: every `period` px of s a `len`-px tooth of the darker band crosses the mid / shadow boundary */
const TEETH = { period: 5, len: 2, phase: 0, reach: 0.22 };
/** (rule planes) seams across the ventral plates every 3 px of s along the neck (one step darker) */
const SEAM = { period: 3, phase: 0, bias: -0.4 };

export function toneIndex(b: Bands, I: number): number {
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

/** The throat's swell (fx.swell 1): px of the neck's radius around arc length `at` (px from the neck's root), over ± `half`. */
export const THROAT = { at: 27, half: 5, px: 2.2 };

/** (rule planes) the ventral plates' width (px) on a neck of width `w`. */
const bellyWidth = (w: number) => Math.max(0, Math.round(0.4 * w - 0.5));

const isFar = (k: number) => SECTIONS[k] === 'back';
/** Section index → its depth order (back < neck < front < tail). */
const SECTION_DEPTH: readonly number[] = SECTIONS.map((id) => ({ back: 0, neck: 1, front: 2, tail: 3 })[id]);

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

// ------------------------------------------------------------------ the still in tube space

interface Sample {
  readonly col: number;
  /** n·L of the rest pose under the P1 light (+ the section's bias) */
  readonly I: number;
  /** a still px of that colour under this key (the foam pass's pattern space: it rides the tube) */
  readonly x: number;
  readonly y: number;
  /** the still's own deliberate pixel here (a 1-px band, a diagonal edge line): the cleanup leaves it */
  keep: boolean;
}

const DEAD = 0.12;
const SCALE_SET = [W0, W1, W2, W3, W4] as const;
const BELLY_SET = [Q, S, M, WH] as const;
const SCALE_IDX: ReadonlyMap<number, number> = new Map(SCALE_SET.map((c, i) => [c, i] as const));
const BELLY_COLS: ReadonlySet<number> = new Set([Q, S, M]);

/** s in half-px bins (a bend's outer side spreads its pixels along s: whole px would merge neighbours) */
const S_BIN = 2;
/** the lateral offset in bins of r / 8 (normalised: a swollen or thinned tube keeps its contour rows) */
const V_BIN = 8;
const sBin = (s: number) => Math.round(s * S_BIN);
const vBin = (v: number, r: number) => Math.max(-V_BIN, Math.min(V_BIN, Math.round((v / Math.max(0.5, r)) * V_BIN)));
const tubeKey = (sec: number, sb: number, vb: number) => (sec * 4096 + Math.max(0, Math.min(4095, sb + 512))) * 32 + (vb + 16);

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
  // the plates step up to mist at most: a relit white would read as a slab on the throat (white is foam / glint only)
  if (bl >= 0) return BELLY_SET[Math.max(0, Math.min(2, bl + dk))];
  const top = far ? (d === 0 ? 3 : 2) : d === 0 ? 4 : 3;
  // a tone already above the cap (the still's own water4 edge) never steps up past itself
  return SCALE_SET[Math.max(0, Math.min(Math.max(top, sc), sc + dk))];
}

// ------------------------------------------------------------------ the ventral strip

/** The neck's tangent angle (rad, unwrapped, screen) at arc length `s` from its root (linear between segment middles). */
function neckAngleAt(rig: SerpentRig, s: number): number {
  const pts = rig.neck;
  const n = pts.length - 1;
  let acc = 0;
  let prev = 0;
  let prevMid = 0;
  for (let k = 0; k < n; k++) {
    const dx = pts[k + 1][0] - pts[k][0];
    const dy = pts[k + 1][1] - pts[k][1];
    const l = Math.hypot(dx, dy) || 1e-6;
    let a = Math.atan2(dy, dx);
    if (k) while (a - prev > Math.PI) a -= 2 * Math.PI;
    if (k) while (a - prev < -Math.PI) a += 2 * Math.PI;
    const mid = acc + l / 2;
    if (s <= mid) return k === 0 ? a : prev + ((a - prev) * (s - prevMid)) / Math.max(1e-6, mid - prevMid);
    prev = a;
    prevMid = mid;
    acc += l;
  }
  return prev;
}

/** Arc length along the neck's VENTRAL contour (the spine's s corrected by r · Δangle: a fold's inner side is shorter). */
function contourS(rig: SerpentRig, sl: number, r: number): number {
  return sl - r * (neckAngleAt(rig, sl) - neckAngleAt(rig, 0));
}

/** the strip's cells: contour arc length in half-px bins × the depth from the ventral contour */
const SC_BIN = 2;
const STRIP_D = 8;
const stripKey = (sb: number, d: number) => (sb + 512) * 16 + d;
interface Strip {
  readonly cells: ReadonlyMap<number, number>;
  /** per contour bin: the plates' run [first, last] depth (for the P2 reading) */
  readonly span: ReadonlyMap<number, readonly [number, number]>;
}
let STRIP: Strip | null = null;

/** The still's ventral strip by (contour arc length, depth from the ventral contour), built once at rest. */
function restStrip(): Strip {
  if (STRIP) return STRIP;
  const rig = serpentRest(BUILD);
  const f = tubeField(rig, FRAME.w, FRAME.h);
  const dist = sectionDist(f, pooled('dist', f.w * f.h, (n) => new Int16Array(n)));
  const neckK = SECTIONS.indexOf('neck');
  const votes = new Map<number, Map<number, number>>();
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      if (f.sec[i] !== neckK || f.v[i] <= 0 || dist[i] > STRIP_D) continue;
      const col = stillAt(x - OX, y - OY);
      if (col === null || ownerAt(x - OX, y - OY) !== 't') continue;
      const key = stripKey(Math.round(contourS(rig, f.s[i] - rig.s0.neck, f.r[i]) * SC_BIN), dist[i]);
      let m = votes.get(key);
      if (!m) votes.set(key, (m = new Map()));
      m.set(col, (m.get(col) ?? 0) + 1);
    }
  const cells = new Map<number, number>();
  const span = new Map<number, [number, number]>();
  for (const [key, m] of votes) {
    let best = -1;
    let bn = 0;
    for (const [col, k] of m) if (k > bn) [best, bn] = [col, k];
    cells.set(key, best);
    if (!BELLY_COLS.has(best)) continue;
    const sb = Math.floor(key / 16) - 512;
    const d = key % 16;
    const sp = span.get(sb);
    if (!sp) span.set(sb, [d, d]);
    else {
      sp[0] = Math.min(sp[0], d);
      sp[1] = Math.max(sp[1], d);
    }
  }
  STRIP = { cells, span };
  return STRIP;
}

/** The strip's colour at (contour arc length, depth) from the nearest recorded bin (± 2 half-px), and its bin. */
function stripAt(t: Strip, sc: number, d: number): { col: number; sb: number } | null {
  const sb = Math.round(sc * SC_BIN);
  for (const ds of [0, -1, 1, -2, 2]) {
    const col = t.cells.get(stripKey(sb + ds, d));
    if (col !== undefined) return { col, sb: sb + ds };
  }
  return null;
}

// ------------------------------------------------------------------ the rest table (+ the dry run)

let REST_TUBE: Map<number, Sample> | null = null;

/** The rest table: the still's tube pixels under their tube-space keys, the still's own 1-px craft marked (built once, lazily). */
function restTube(): Map<number, Sample> {
  if (REST_TUBE) return REST_TUBE;
  const rig = serpentRest(BUILD);
  const strip = restStrip();
  const f = tubeField(rig, FRAME.w, FRAME.h);
  smoothNormals(f);
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
    if (best) t.set(key, { col: best.col, I: best.I, x: best.x, y: best.y, keep: false });
  }
  // the dry run: paint the rest pose from the table and mark every place the cleanup would change
  const c = new PixelCanvas(FRAME.w, FRAME.h);
  const n = f.w * f.h;
  const dist = sectionDist(f, pooled('dist', n, (k) => new Int16Array(k)));
  const locked = pooled('locked', n, (k) => new Uint8Array(k));
  const used: (Sample | null)[] = new Array(n).fill(null);
  paintPlanes(c, rig, f, dist, lightOf('left'), { belly: BUILD.belly }, t, strip, locked, used);
  const raw = new PixelCanvas(FRAME.w, FRAME.h);
  raw.blit(c, 0, 0);
  cleanPlanes(c, f, dist, locked, null);
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * f.w + x;
      if (used[i] && c.get(x, y) !== raw.get(x, y)) used[i]!.keep = true;
    }
  REST_TUBE = t;
  return t;
}

// ------------------------------------------------------------------ painting

/**
 * Paint the tube into `c` (frame size): the still's tones carried in tube space and re-lit (above),
 * else the rule planes from the cylinder normals and the key light — scale-row teeth, the ventral
 * plates — and the 1-px edge on light-facing contours (IŞ-8). Returns the field it painted from.
 */
export function paintBody(c: PixelCanvas, rig: SerpentRig, light: Light, o: BodyOpts = {}): TubeField {
  // (the rest tables first: they render the rest field into the same pooled buffers)
  const rest = o.rules ? null : restTube();
  const strip = o.rules || !o.belly ? null : restStrip();
  const f = tubeField(rig, c.w, c.h, o.tube);
  smoothNormals(f);
  const n = f.w * f.h;
  const dist = sectionDist(f, pooled('dist', n, (k) => new Int16Array(k)));
  const locked = pooled('locked', n, (k) => new Uint8Array(k));
  const used: (Sample | null)[] = rest ? new Array(n).fill(null) : [];
  paintPlanes(c, rig, f, dist, light, o, rest, strip, locked, rest ? used : null);
  if (!rest) {
    despeckle(c, 2, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });
    edges(c, f, light);
  } else {
    const keep = pooled('keep', n, (k) => new Uint8Array(k));
    keep.fill(0);
    for (let i = 0; i < n; i++) if (used[i]?.keep) keep[i] = 1;
    cleanPlanes(c, f, dist, locked, keep);
  }
  return f;
}

function paintPlanes(
  c: PixelCanvas,
  rig: SerpentRig,
  f: TubeField,
  dist: Int16Array,
  light: Light,
  o: BodyOpts,
  rest: Map<number, Sample> | null,
  strip: Strip | null,
  locked: Uint8Array,
  used: (Sample | null)[] | null,
): void {
  const L = light.v;
  const W = f.w;
  const neckS0 = rig.s0.neck;
  const neckK = SECTIONS.indexOf('neck');
  locked.fill(0);
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      const k = f.sec[i];
      if (k < 0) continue;
      const id = SECTIONS[k];
      const s = f.s[i];
      const I = f.nx[i] * L[0] + f.ny[i] * L[1] + f.nz[i] * L[2] + light.lift + SECTION_BIAS[id];
      // ---- the ventral strip (the plates): the still's, by contour arc length and depth
      if (strip && k === neckK && f.v[i] > 0 && dist[i] <= STRIP_D) {
        const sl = s - neckS0;
        const sc = contourS(rig, sl, f.r[i]);
        const e = stripAt(strip, sc, dist[i]);
        if (e && BELLY_COLS.has(e.col)) {
          let col = e.col;
          // P2: the strip faces the light — read from the other side (the lit contour mist, the far side night3)
          const sp = strip.span.get(e.sb);
          if (light.from === 'right' && sp) col = strip.cells.get(stripKey(e.sb, sp[0] + sp[1] - dist[i])) ?? col;
          c.set(x, y, col);
          locked[i] = 1;
          if (o.still) {
            o.still.x[i] = STILL_TUBE + Math.round(s);
            o.still.y[i] = Math.round(f.v[i]);
          }
          continue;
        }
      }
      if (rest) {
        const e = lookup(rest, k, s, f.v[i], f.r[i]);
        if (e) {
          // a plate tone the lookup carries off the strip is hide (the strip owns the plates)
          const col = strip && k === neckK && BELLY_COLS.has(e.col) ? W2 : e.col;
          c.set(x, y, relight(col, I, e.I, isFar(k), dist[i]));
          if (used) used[i] = e;
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
          // (white is never a plate tone in a frame: it would read as a slab — and seed despeckle — on the throat)
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
}

// ------------------------------------------------------------------ the planes' craft under deformation

/** Clean the deformation's crumbs (see the header, 4); `keep` = the still's own pixels (null: the dry run). */
function cleanPlanes(c: PixelCanvas, f: TubeField, dist: Int16Array, locked: Uint8Array, keep: Uint8Array | null): void {
  const W = f.w;
  const held: number[] = [];
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const i = y * W + x;
      if (f.sec[i] < 0 || !(locked[i] || keep?.[i])) continue;
      held.push(x, y, c.get(x, y) as number);
    }
  const fixed = (i: number) => locked[i] === 1 || keep?.[i] === 1;
  for (let pass = 0; pass < 2; pass++) if (!lateralMerge(c, f, dist, fixed)) break;
  teeth(c, f, dist, fixed);
  despeckle(c, 2, { x0: f.x0, y0: f.y0, x1: f.x1, y1: f.y1 });
  cleanCrumbs(c);
  for (let k = 0; k < held.length; k += 3) c.set(held[k], held[k + 1], held[k + 2]);
}

/** The lateral step at pixel (x, y): the nearer AXIS of the gradient of the lateral offset within its section (a band 2 px wide along an axis is a band). */
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
