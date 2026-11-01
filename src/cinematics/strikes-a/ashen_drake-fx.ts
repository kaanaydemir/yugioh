// Kül Ejderi (ashen_drake) — the pixel pieces of "Kül Fırtınası Nefesi" (docs/v3/kart-a/ashen_drake.md §5.2.1):
// the billow (a stepped round puff with a rim, an underside, a body and a lit cap that TUMBLES backwards),
// the bank's veil layout over a target (a soft mound of billows with gaps between them, EF-2), the
// flame tongues of the ignition and the per-billow burn-off. No registration here; ./ashen_drake.ts
// drives them. Whole pixels and palette tones only, no alpha.

import { PAL } from '../../art/palette';
import type { Px } from '../../vfx/combat';

/** A billow's four tones: rim (lower / far edge), underside, body, lit cap. */
export type Tones = readonly [number, number, number, number];

export const ASH_T: Tones = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3];
/** frame +1 of the ignition: the inner billows first (inside-out) */
export const WHITE_T: Tones = [PAL.fire2, PAL.fire3, PAL.fire4, PAL.white];
export const HOT_T: Tones = [PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4];
export const BURN_T: Tones = [PAL.fire1, PAL.fire1, PAL.fire2, PAL.fire3];
export const COOL_T: Tones = [PAL.stone0, PAL.fire1, PAL.fire1, PAL.fire2];
export const CHAR_T: Tones = [PAL.stone0, PAL.stone0, PAL.stone1, PAL.fire1];
/** the cooled ash after a fizzle */
export const DEAD_T: Tones = [PAL.stone0, PAL.stone0, PAL.stone1, PAL.stone2];

/**
 * One billow: a stepped round puff (ry = r × squash) centred at (cx, cy). The cap is the lit crescent on
 * the side `capA` points to (radians, screen space: −π/2 = straight up); turning capA toward the attacker
 * frame by frame makes the puff tumble backwards over itself. `core` paints a small hot centre.
 */
export function drawPuff(px: Px, cx: number, cy: number, r: number, t: Tones, capA: number, squash = 0.8, core = -1): void {
  const R = Math.max(1, r);
  const ry = Math.max(1, R * squash);
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const lx = Math.cos(capA);
  const ly = Math.sin(capA);
  const rx2 = Math.ceil(R);
  const ry2 = Math.ceil(ry);
  for (let y = -ry2; y <= ry2; y++) {
    const ny = (y + 0.5) / ry - 0.5 / ry;
    for (let x = -rx2; x <= rx2; x++) {
      const nx = x / R;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const d = Math.sqrt(d2);
      const l = nx * lx + ny * ly;
      let c: number;
      // the rim: the outer ring on the side away from the cap (separates puff from puff)
      if (d > 1 - 1.2 / R && l < 0.15) c = t[0];
      else if (core >= 0 && d < 0.38) c = core;
      else if (l > 0.42 && d > 0.3) c = t[3];
      else if (l > -0.3) c = t[2];
      else c = t[1];
      px.dot(x0 + x, y0 + y, c);
    }
  }
}

const clamp3 = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A cheap deterministic hash in [0, 1). */
export function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export interface VeilSlot {
  /** offset from the target's ground point (x across, h height of the puff's base over the floor) */
  x: number;
  h: number;
  r: number;
  /** draw order: lower first; the front row is drawn last */
  z: number;
  /** 0 = top row … 2 = base row (the burn-off cools the top first) */
  row: number;
}

/**
 * The veil: a soft mound of billows over the target's feet and legs, ≤ 70 % of its height, with gaps
 * between the upper puffs so the silhouette reads through (EF-2). `wall` = the blocked pile-up: wide,
 * low and flat-fronted, splaying sideways along the guard plane.
 */
export function veilSlots(W: number, H: number, wall = false): VeilSlot[] {
  const out: VeilSlot[] = [];
  const base = wall ? 5 : 4;
  const rb = Math.max(4, Math.round(W * (wall ? 0.2 : 0.24)));
  for (let i = 0; i < base; i++) {
    const k = i / (base - 1) - 0.5;
    out.push({ x: Math.round(k * W * (wall ? 1.25 : 0.95)), h: 0, r: Math.round(rb * (1 - Math.abs(k) * 0.45)), z: 3, row: 2 });
  }
  // the back row (half hidden behind the base)
  for (let i = 0; i < 3; i++) out.push({ x: Math.round((i - 1) * W * 0.34), h: 2, r: Math.round(rb * 0.8), z: 0, row: 2 });
  const r2 = Math.max(3, Math.round(rb * 0.78));
  const mid = wall ? 3 : 2;
  for (let i = 0; i < mid; i++) {
    const k = i / (mid - 1) - 0.5;
    out.push({ x: Math.round(k * W * (wall ? 0.8 : 0.5)), h: Math.round(H * 0.38), r: r2, z: 1, row: 1 });
  }
  if (!wall) out.push({ x: Math.round(W * 0.06), h: Math.round(H * 0.68), r: Math.max(3, Math.round(rb * 0.55)), z: 0.5, row: 0 });
  return out.sort((a, b) => a.z - b.z || b.h - a.h);
}

/**
 * The swallowing veil over a monster (critic r1 #2): a LATTICE of ash cells climbing the body to `H`
 * (60–70 % of its bounding box), `VW` wide at the base and narrowing up. Each cell is a billow with a 1-px
 * ink seam round it (the caller draws it), so grey ash reads against grey stone targets; the lower rows are
 * packed (seams only), the top two rows leave open gaps the body shows through (EF-2). Rows step in brick
 * order; `row` 0 = the top third (it burns off first) … 2 = the base third.
 */
export function latticeSlots(VW: number, H: number): VeilSlot[] {
  const out: VeilSlot[] = [];
  const rows = Math.max(3, Math.round(H / 7));
  for (let j = 0; j < rows; j++) {
    const k = rows === 1 ? 0 : j / (rows - 1);
    const r = Math.max(3, Math.round(6 - 2.5 * k));
    const span = VW * (1 - 0.5 * k);
    const gap = j >= rows - 2 ? 3 : 0;
    const n = Math.max(1, Math.round(span / (2 * r + gap)));
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5;
      const x = u * (span - 2 * r) + (j % 2 ? 2 : -1);
      // critic r3 #1: radii vary per cell (3–9), so the rows never read as identical stacked balls
      const rv = clamp3(r + Math.round((hash(j * 7 + i, 9) - 0.4) * 4), 3, 9);
      out.push({ x: Math.round(x + (hash(i, j + 3) - 0.5) * 3), h: Math.round(k * (H - r * 1.6) + (hash(j, i + 5) - 0.5) * 3), r: rv, z: 3 - k + hash(i, j) * 0.1, row: k > 0.62 ? 0 : k > 0.3 ? 1 : 2 });
    }
  }
  return out.sort((a, b) => a.z - b.z || b.h - a.h);
}

/**
 * Flame tongues on a burning puff's top: 2-px columns of fire2 / fire3 with a fire4 tip, jagged heights
 * re-rolled every 2 frames (stepped, never boiling every frame). `heat` 0..1 scales them.
 */
export function tongues(px: Px, cx: number, topY: number, r: number, heat: number, frame: number, seedN: number): void {
  if (heat <= 0) return;
  const step = Math.floor(frame / 2);
  const n = Math.max(1, Math.round(r / 2.5));
  for (let i = 0; i < n; i++) {
    const u = n === 1 ? 0 : i / (n - 1) - 0.5;
    const x = Math.round(cx + u * r * 1.3);
    const yTop = Math.round(topY + Math.abs(u) * r * 0.6);
    const h = Math.round((2 + hash(seedN + i, step) * 6) * heat);
    if (h < 1) continue;
    for (let j = 0; j < h; j++) {
      const y = yTop - j;
      const tip = j >= h - 1;
      const c = tip ? PAL.fire4 : j < h * 0.45 ? PAL.fire2 : PAL.fire3;
      px.dot(x, y, c);
      if (j < h * 0.55) px.dot(x + 1, y, j < h * 0.3 ? PAL.fire2 : PAL.fire3);
    }
    // a lick that leans with the step
    if (h >= 4 && hash(seedN + i * 3, step) > 0.5) px.dot(x + (step % 2 ? 1 : -1), yTop - h, PAL.fire3);
  }
}

/**
 * One LUMP of ash (critic r3 #1: the round `drawPuff` discs stacked into "cannonballs"): an irregular puff
 * whose outline is bent by three low-frequency waves seeded per lump (so no two lumps share a shape), with
 * a 1-px ink outline, stepped dark-to-light bands toward `capA` (rim → underside → body → lit cap), one or
 * two secondary bulges with their own small lit crescent (the boil), and buried ember specks in the dark
 * bands (`embers` = share of dark-band pixels, re-rolled every 3 frames by `tick`). Whole pixels only.
 */
export function drawLump(
  px: Px,
  cx: number,
  cy: number,
  r: number,
  t: Tones,
  capA: number,
  sd: number,
  o: { squash?: number; ink?: number | null; embers?: number; tick?: number; core?: number; emberC?: readonly number[] } = {},
): void {
  const R = Math.max(1.5, r);
  const sq = o.squash ?? 0.78;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const p1 = hash(sd, 1) * 6.283;
  const p2 = hash(sd, 2) * 6.283;
  const p3 = hash(sd, 3) * 6.283;
  const a1 = 0.1 + hash(sd, 4) * 0.12;
  const a2 = 0.06 + hash(sd, 5) * 0.1;
  const lx = Math.cos(capA + (hash(sd, 6) - 0.5) * 0.7);
  const ly = Math.sin(capA + (hash(sd, 6) - 0.5) * 0.7);
  // a secondary bulge on the lit side: its own small crescent breaks the single big highlight
  const ba = capA + (hash(sd, 7) < 0.5 ? -1 : 1) * (0.9 + hash(sd, 8) * 0.6);
  const bx = Math.cos(ba) * 0.55;
  const by = Math.sin(ba) * 0.55;
  const ext = Math.ceil(R * 1.25) + 1;
  const extY = Math.ceil(R * sq * 1.25) + 1;
  const W = ext * 2 + 1;
  const H = extY * 2 + 1;
  const inside = new Uint8Array(W * H);
  const m = (x: number, y: number): boolean => {
    const nx = x / R;
    const ny = y / (R * sq);
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d < 0.35) return true;
    const th = Math.atan2(ny, nx);
    const lim = 1 + a1 * Math.sin(3 * th + p1) + a2 * Math.sin(5 * th + p2) + 0.05 * Math.sin(8 * th + p3);
    // flat bottom: the lump sits on what is under it
    if (ny > 0.75) return false;
    return d <= lim;
  };
  for (let y = -extY; y <= extY; y++) for (let x = -ext; x <= ext; x++) if (m(x, y)) inside[(y + extY) * W + (x + ext)] = 1;
  const isIn = (x: number, y: number) => x >= -ext && x <= ext && y >= -extY && y <= extY && inside[(y + extY) * W + (x + ext)] === 1;
  const tick = o.tick ?? 0;
  const ec = o.emberC ?? [];
  for (let y = -extY; y <= extY; y++)
    for (let x = -ext; x <= ext; x++) {
      if (!isIn(x, y)) {
        if (o.ink != null && (isIn(x - 1, y) || isIn(x + 1, y) || isIn(x, y - 1) || isIn(x, y + 1))) px.dot(x0 + x, y0 + y, o.ink);
        continue;
      }
      const nx = x / R;
      const ny = y / (R * sq);
      const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      const l = d > 0.01 ? (nx * lx + ny * ly) / Math.max(0.35, d) : 0;
      const edge = !isIn(x - 1, y) || !isIn(x + 1, y) || !isIn(x, y - 1) || !isIn(x, y + 1);
      // the bulge's own lit crescent
      const bdx = nx - bx;
      const bdy = ny - by;
      const bd = Math.sqrt(bdx * bdx + bdy * bdy);
      const bl = bd > 0.01 ? (bdx * lx + bdy * ly) / bd : 0;
      let c: number;
      let band: number;
      if (o.core != null && o.core >= 0 && d < 0.4) (c = o.core), (band = 4);
      else if (edge && l < 0.1) (c = t[0]), (band = 0);
      else if (bd < 0.42 && bd > 0.22 && bl > 0.35) (c = t[3]), (band = 3);
      else if (l > 0.55 && d > 0.45) (c = t[3]), (band = 3);
      else if (l > -0.25 + (hash(sd + x, y) - 0.5) * 0.25) (c = t[2]), (band = 2);
      else (c = t[1]), (band = 1);
      // a crease: a dark fold line where the bulge meets the body
      if (band >= 2 && bd > 0.42 && bd < 0.52 && bl < 0) c = t[1];
      if (band <= 1 && ec.length && o.embers && hash(x0 + x * 13, y0 + y * 7 + Math.floor(tick / 3) * 31 + sd) < o.embers) c = ec[(x + y + tick) & 1 ? 0 : Math.min(1, ec.length - 1)];
      px.dot(x0 + x, y0 + y, c);
    }
}

/** The 2×3 cloak plate chip (stone2 face, stone1 crease, stone3 lit corner, ink under-edge). */
export function plateChip(px: Px, x: number, y: number, flip: boolean): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  if (flip) px.rect(X, Y, 3, 2, PAL.stone2).rect(X, Y + 1, 3, 1, PAL.stone1).dot(X, Y, PAL.stone3).run(Y + 2, X, X + 2, PAL.ink);
  else px.rect(X, Y, 2, 3, PAL.stone2).rect(X, Y + 2, 2, 1, PAL.stone1).dot(X, Y, PAL.stone3).run(Y + 3, X, X + 1, PAL.ink);
}

/**
 * A solid flame COLUMN (critic r3 #4: the direct ignition read as a puff under the number): `w` px wide at
 * the base (≥ 16 at 1×), `h` tall, a ragged top re-rolled every 2 frames, banded outside-in fire1 → fire2 →
 * fire3 → fire4 (white at the root on the first frame), narrowing to tongues. Whole pixels, no alpha.
 */
export function flameColumn(px: Px, cx: number, baseY: number, w: number, h: number, frame: number, sd: number, hot: boolean): void {
  const half = w / 2;
  const step = Math.floor(frame / 2);
  for (let x = -Math.floor(half); x <= Math.ceil(half) - 1; x++) {
    const u = (x + 0.5) / half; // -1..1
    const prof = Math.max(0, 1 - u * u * 0.85);
    const rag = 0.65 + 0.35 * hash(sd + x * 3, step) + (x % 3 === 0 ? 0.12 : 0);
    const colH = Math.round(h * prof * rag);
    for (let j = 0; j < colH; j++) {
      const y = baseY - j;
      const v = j / Math.max(1, colH);
      const edge = Math.abs(u) > 0.78 || v > 0.86;
      const c = edge ? PAL.fire1 : Math.abs(u) > 0.5 || v > 0.62 ? PAL.fire2 : Math.abs(u) > 0.22 || v > 0.35 ? PAL.fire3 : hot && v < 0.18 ? PAL.white : PAL.fire4;
      px.dot(Math.round(cx + x), y, c);
    }
    // a detached flame lick above some columns
    if (colH > 4 && hash(sd + x * 7, step) > 0.78) px.dot(Math.round(cx + x), baseY - colH - 2, PAL.fire3).dot(Math.round(cx + x), baseY - colH - 3, PAL.fire4);
  }
}

// ---------------------------------------------------------------------------------------------------
// adversarial round (adv #1 / #2): the bank as GAS, the ignition as a flame sheet grown out of the bank.

/** Anything that takes whole-pixel dots (a Px layer, or an AshMass collecting a bank before it is inked). */
export interface Dotter {
  dot(x: number, y: number, c: number): unknown;
}

/**
 * The bank as ONE mass (adv #1: every lump carried its own ink outline, so the bank read as a heap of grey
 * rocks): billows are drawn into this collector back-to-front with no outline, then `flush` inks only the
 * OUTER silhouette of the whole mass and breaks its upper rim into a 1-px dithered, ragged stone2 / stone3
 * fringe (re-rolled every 2 frames), so the bank reads as rolling ash, not as stacked stones.
 */
export class AshMass implements Dotter {
  private m = new Map<number, number>();
  private static key(x: number, y: number): number {
    return (y + 1024) * 4096 + (x + 1024);
  }
  dot(x: number, y: number, c: number): this {
    this.m.set(AshMass.key(Math.round(x), Math.round(y)), c);
    return this;
  }
  has(x: number, y: number): boolean {
    return this.m.has(AshMass.key(x, y));
  }
  clear(): this {
    this.m.clear();
    return this;
  }
  get size(): number {
    return this.m.size;
  }
  flush(px: Px, frame: number, ink: number | null = PAL.ink): void {
    const step = Math.floor(frame / 2);
    const pts: [number, number, number][] = [];
    for (const [k, c] of this.m) {
      const y = Math.floor(k / 4096) - 1024;
      const x = (k % 4096) - 1024;
      pts.push([x, y, c]);
    }
    // 1) the ink: every empty 4-neighbour of the mass (the outer silhouette only, never between billows)
    if (ink != null)
      for (const [x, y] of pts) {
        if (!this.has(x - 1, y)) px.dot(x - 1, y, ink);
        if (!this.has(x + 1, y)) px.dot(x + 1, y, ink);
        if (!this.has(x, y + 1)) px.dot(x, y + 1, ink);
        if (!this.has(x, y - 1)) px.dot(x, y - 1, ink);
      }
    // 2) the body
    for (const [x, y, c] of pts) px.dot(x, y, c);
    // 3) the ragged upper rim: on the top edge every other pixel of the ink line becomes a lit ash grain
    // (a 1-px dither), and a few columns throw a loose grain one more pixel up (stepped, every 2 frames)
    for (const [x, y, c] of pts) {
      if (this.has(x, y - 1)) continue;
      const lit = c === PAL.stone2 || c === PAL.stone3;
      if (((x + step) & 1) === 0) px.dot(x, y - 1, lit ? PAL.stone2 : PAL.stone1);
      else if (lit && hash(x * 3 + 1, step) < 0.35) px.dot(x, y, PAL.stone1);
      if (hash(x * 7 + y, step) < 0.12) px.dot(x + (step & 1 ? 1 : 0), y - 3, PAL.stone2);
    }
  }
}

/**
 * One soft ash BILLOW (adv #1, replaces the outlined `drawLump` in the bank): a wobbly puff with no outline;
 * a stone1 body, a dithered stone1 / stone2 transition into a stone2 top with a dithered stone3 lit cap toward
 * `capA`, a broken stone0 under-rim, and a stone0 CURL (a 1-px crease arc) at `capA + 2.3`: as the caller
 * steps capA every 1–2 frames the cap and the curl travel round the billow, so it visibly rolls. Hot ash:
 * fire2 embers (with a fire1 halo pixel) glow in the body, re-rolled every 3 frames (`embers` = share).
 */
export function drawBillow(
  px: Dotter,
  cx: number,
  cy: number,
  r: number,
  capA: number,
  sd: number,
  o: { squash?: number; embers?: number; tick?: number; emberC?: number } = {},
): void {
  const R = Math.max(1.5, r);
  const sq = o.squash ?? 0.8;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const p1 = hash(sd, 1) * 6.283;
  const p2 = hash(sd, 2) * 6.283;
  const a1 = 0.1 + hash(sd, 4) * 0.1;
  const a2 = 0.05 + hash(sd, 5) * 0.08;
  const lx = Math.cos(capA);
  const ly = Math.sin(capA);
  const cxl = Math.cos(capA + 2.3);
  const cyl = Math.sin(capA + 2.3);
  const ext = Math.ceil(R * 1.2) + 1;
  const extY = Math.ceil(R * sq * 1.2) + 1;
  const tick = o.tick ?? 0;
  const ec = o.emberC ?? PAL.fire2;
  const inside = (x: number, y: number): boolean => {
    const nx = x / R;
    const ny = y / (R * sq);
    const d = Math.sqrt(nx * nx + ny * ny);
    if (d < 0.35) return true;
    if (ny > 0.8) return false;
    const th = Math.atan2(ny, nx);
    return d <= 1 + a1 * Math.sin(3 * th + p1) + a2 * Math.sin(5 * th + p2);
  };
  for (let y = -extY; y <= extY; y++)
    for (let x = -ext; x <= ext; x++) {
      if (!inside(x, y)) continue;
      const nx = x / R;
      const ny = y / (R * sq);
      const d = Math.min(1, Math.sqrt(nx * nx + ny * ny));
      const l = d > 0.01 ? (nx * lx + ny * ly) / Math.max(0.4, d) : 0;
      const chk = ((x0 + x + y0 + y) & 1) === 0;
      const under = !inside(x, y + 1);
      let c: number;
      if (under && ny > 0.2) c = chk ? PAL.stone0 : PAL.stone1;
      else if (l > 0.62 && d > 0.4) c = chk ? PAL.stone3 : PAL.stone2;
      else if (l > 0.25) c = PAL.stone2;
      else if (l > 0.1) c = chk ? PAL.stone2 : PAL.stone1;
      else c = PAL.stone1;
      // the curl: a crease arc on the far side of the cap, travelling round with it
      const cl = d > 0.01 ? (nx * cxl + ny * cyl) / d : 0;
      if (R >= 4 && d > 0.5 && d < 0.66 && cl > 0.72) c = PAL.stone0;
      if (o.embers && d < 0.85 && l < 0.4) {
        const h = hash(x0 + x * 13 + sd, y0 + y * 7 + Math.floor(tick / 3) * 31);
        if (h < o.embers) c = ec;
        else if (h < o.embers * 1.6) c = PAL.fire1;
      }
      px.dot(x0 + x, y0 + y, c);
    }
}

/**
 * The IGNITION as a flame SHEET grown out of the bank (adv #2: the old ignition read as a black box with a
 * battlement top): `bank(x)` gives the bank's own top height per column (px over `baseY`); from there each
 * column climbs 2–4 px a frame from its own start frame (0–3, the edges later), into uneven tongues whose
 * peaks reach `peak(u)` (above the target's top: they break out over it). Valleys between the tongues let
 * the black silhouette show through. Banded outside-in fire1 → fire2 → fire3 → fire4 (white at the root on
 * k ≤ 1), outlined in fire0 on the OUTER flame edge only; from `fallAt` the tongues sink 3–4 px a frame (unevenly).
 * Whole pixels, no straight outer edge (every column has its own height, re-rolled every 2 frames).
 */
export function flameSheet(
  px: Px,
  cx: number,
  baseY: number,
  half: number,
  k: number,
  sd: number,
  bank: (x: number) => number,
  peak: number,
  fallAt = 12,
): boolean {
  if (k < 1) return false;
  const step = Math.floor(k / 2);
  const hs: number[] = [];
  const x0 = -half;
  let any = false;
  // tongues: a triangle wave of per-tongue width 3–6 px and per-tongue amplitude, so peaks and valleys alternate
  let tx = x0;
  let ti = 0;
  const tongueOf: { a: number; w: number; s: number }[] = [];
  while (tx <= half) {
    const w = 3 + Math.floor(hash(sd + ti * 5, 11) * 4);
    tongueOf.push({ a: 0.55 + 0.45 * hash(sd + ti * 3, 12), w, s: tx });
    tx += w;
    ti++;
  }
  let t = 0;
  for (let x = x0; x <= half; x++) {
    while (t < tongueOf.length - 1 && x >= tongueOf[t].s + tongueOf[t].w) t++;
    const T = tongueOf[t];
    const q = (x - T.s + 0.5) / T.w; // 0..1 across the tongue
    const tri = 1 - Math.abs(q * 2 - 1); // 0 at the valleys, 1 at the tip
    const u = x / Math.max(1, half);
    const env = 1 - u * u * 0.7;
    const b = bank(x);
    const jitter = Math.round((hash(sd + x * 3, step) - 0.5) * 4);
    const top = Math.max(b, Math.round(b + (peak - b) * env * (0.15 + 0.85 * tri * T.a)) + jitter);
    const s0 = Math.floor(hash(sd + x, 21) * 3) + Math.round(Math.abs(u) * 2);
    const v = 2 + Math.floor(hash(sd + x * 5, 22) * 3);
    let h = Math.min(top, b + Math.max(0, k - s0) * v);
    if (k >= fallAt) h = Math.min(h, top - (k - fallAt) * (3 + Math.floor(hash(sd + t, 24) * 2)) - Math.floor(hash(sd + t, 23) * 4));
    if (k - s0 < 0) h = Math.min(h, b);
    hs.push(Math.max(0, h));
  }
  const H = (x: number): number => (x < x0 || x > half ? 0 : hs[x - x0]);
  for (let x = x0; x <= half; x++) {
    const h = H(x);
    if (h <= 0) continue;
    any = true;
    const u = Math.abs(x) / Math.max(1, half);
    const X = Math.round(cx + x);
    for (let j = 0; j < h; j++) {
      const y = baseY - j;
      const fromTop = h - 1 - j;
      // the outer edge only: the column's top, or a side whose neighbour column is lower here
      const exposed = j >= H(x - 1) || j >= H(x + 1);
      let c: number;
      if (fromTop === 0 || exposed) c = PAL.fire0;
      else if (fromTop === 1) c = PAL.fire1;
      else {
        const v = j / Math.max(1, h);
        c = fromTop <= 2 ? PAL.fire2 : u < 0.3 && v < 0.4 ? (k <= 1 && v < 0.15 ? PAL.white : PAL.fire4) : u < 0.65 && v < 0.7 ? PAL.fire3 : PAL.fire2;
      }
      px.dot(X, y, c);
    }
    // the tip of a tall tongue: a lick of fire4 / fire3 one pixel inside the fire0 rim
    if (h > 6 && hash(sd + x * 7, step) > 0.7) px.dot(X, baseY - h + 2, PAL.fire4);
  }
  return any;
}
