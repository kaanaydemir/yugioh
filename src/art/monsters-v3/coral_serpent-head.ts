// Mercan Yılanı v3 (A4.1) — THE HEAD ASSEMBLY's painters: the skull, the lower jaw with the open mouth,
// the coral crown. No default export (the registry imports this file at boot and gets nothing; every
// table is built lazily on the first frame).
//
// All three are the approved still's own pixels (./coral_serpent-maps OWNER: h skull, j jaw, m mouth,
// c crown), never repainted by hand per frame, so a change of the still propagates:
//   AT REST (tilt 0, jaw 0) they are stamped exactly (whole px with the head joint: IŞ-12).
//   TILTED (pose.tilt: the head turns about the head joint, + = snout up — the roar's rear, the strike's
//   aim, the blow that throws the head back) they are RE-SAMPLED the pixel-art way (RotSprite): the
//   part's still pixels are scaled up 8× by three Scale2x passes (which keep its diagonals and its 1-px
//   lines as lines) and each frame pixel takes the up-scaled pixel under its centre, mapped back
//   through the turn — so every frame keeps the still's planes (the water4 top plane, the water3 side,
//   the water2 cheek, the crease under the horn), its palette and its line weights, turned. Never a
//   blend, never a new tone. The eye is then re-stamped UNTURNED at its turned place (a 2 × 5 block:
//   socket, iris, hot core, glint — a crisp eye at any angle), like the ace's eye stamps.
//   THE JAW turns down about the hinge (pose.jaw · build.head.open, in head space) the same way: a
//   real rotation of the still's jaw (the old column shear stretched it into a beak at full gape).
//   THE OPEN MOUTH is painted between the lips, in head space, as planes inside the coral's magenta
//   ramp (never crimson: that is player 2's colour): the upper lip keeps the still's ink gape line; under
//   it the PALATE (mag1, the mouth's shadowed roof), on the lower jaw the TONGUE (mag2: the floor faces
//   the key light), mag0 only as the 2-px THROAT crease at the hinge; white TEETH, 3 per jaw at 3-px
//   spacing, hang from the upper lip and stand on the lower one wherever the gape is ≥ 3 px (the still's
//   two fangs ride their jaws). The water's light in the mouth comes after the outline (./parts WATER).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { Light } from '../rigkit/light';
import { lightOf } from '../rigkit/light';
import type { V } from '../rigkit/geom';
import { BUILD, OX, OY, TONES } from './coral_serpent-build';
import { ownerAt } from './coral_serpent-maps';
import { formedAt, markPattern, NO_PATTERN, RIGID_AT, rigidAt, stampPart, waterize, type Ctx, type Part } from './coral_serpent-parts';

const SW = 80; // the still's size (./coral_serpent-maps)
const SH = 80;

// ------------------------------------------------------------------ RotSprite: the still's pixels, turned

/**
 * A part's still pixels scaled up 8× (Scale2x × 3): each up-scaled pixel holds the INDEX of the still
 * pixel it shows (y · SW + x; −1 = empty). The Scale2x decisions are taken once, on the P1 still's
 * colours, and the colour is looked up per light afterwards — so the P2 relight turns exactly the same
 * silhouette (its own colours deciding would grow or drop a corner pixel here and there: a P2 frame
 * must keep the P1 frame's outline, A1.10).
 */
interface Up {
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly idx: Int32Array;
}
const K = 8;
const ups = new Map<string, Up>();
/** the light whose colours decide the up-scaling (P1's: the still as painted) */
const P1_LIGHT = lightOf('left');

/** One Scale2x pass deciding on `col` (−1 empty) and carrying `idx` along the same choices. */
function scale2x(col: Int32Array, idx: Int32Array, w: number, h: number): { col: Int32Array; idx: Int32Array } {
  // (Int32Array<ArrayBufferLike> in, fresh buffers out)
  const oc = new Int32Array(w * 2 * h * 2);
  const oi = new Int32Array(w * 2 * h * 2);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -2 : col[y * w + x]);
  const ix = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? -1 : idx[y * w + x]);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const P = col[y * w + x];
      const A = at(x, y - 1);
      const B = at(x + 1, y);
      const C = at(x - 1, y);
      const D = at(x, y + 1);
      const pi = idx[y * w + x];
      // each quarter: [colour, index]
      let e0 = P, i0 = pi;
      let e1 = P, i1 = pi;
      let e2 = P, i2 = pi;
      let e3 = P, i3 = pi;
      if (C === A && C !== D && A !== B) (e0 = A), (i0 = ix(x, y - 1));
      if (A === B && A !== C && B !== D) (e1 = B), (i1 = ix(x + 1, y));
      if (D === C && D !== B && C !== A) (e2 = C), (i2 = ix(x - 1, y));
      if (B === D && B !== A && D !== C) (e3 = D), (i3 = ix(x, y + 1));
      const o = y * 2 * (w * 2) + x * 2;
      const put = (k: number, e: number, i: number) => {
        oc[k] = e === -2 ? -1 : e;
        oi[k] = e < 0 ? -1 : i;
      };
      put(o, e0, i0);
      put(o + 1, e1, i1);
      put(o + w * 2, e2, i2);
      put(o + w * 2 + 1, e3, i3);
    }
  return { col: oc, idx: oi };
}

/** The up-scaled still pixels of the part `pick` keeps (decided on the P1 still, see Up). */
function upOf(key: string, pick: (x: number, y: number) => boolean): Up {
  let u = ups.get(key);
  if (u) return u;
  let x0 = SW;
  let y0 = SH;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++)
      if (pick(x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  // one empty pixel round the part, so its silhouette's diagonals scale too
  x0 -= 1;
  y0 -= 1;
  x1 += 1;
  y1 += 1;
  let w = x1 - x0 + 1;
  let h = y1 - y0 + 1;
  let col: Int32Array = new Int32Array(w * h).fill(-1);
  let idx: Int32Array = new Int32Array(w * h).fill(-1);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!pick(x, y)) continue;
      const c = rigidAt(x, y, P1_LIGHT);
      if (c === null) continue;
      col[(y - y0) * w + (x - x0)] = c;
      idx[(y - y0) * w + (x - x0)] = y * SW + x;
    }
  for (let p = 0; p < 3; p++) {
    ({ col, idx } = scale2x(col, idx, w, h));
    w *= 2;
    h *= 2;
  }
  u = { x0, y0, w, h, idx };
  ups.set(key, u);
  return u;
}

/** The up-scaled pixel at still coordinates (sx, sy) (continuous) in `light`'s colours, or −1. */
function sampleUp(u: Up, sx: number, sy: number, light: Light): number {
  const bx = Math.floor((sx - u.x0) * K);
  const by = Math.floor((sy - u.y0) * K);
  if (bx < 0 || by < 0 || bx >= u.w || by >= u.h) return -1;
  const i = u.idx[by * u.w + bx];
  if (i < 0) return -1;
  return rigidAt(i % SW, Math.floor(i / SW), light) ?? -1;
}

// ------------------------------------------------------------------ the head transform

/** Frame px → the head's still coordinates (undo the shift and the turn). */
interface HeadMap {
  readonly turned: boolean;
  /** frame centre → head space (still coords) */
  toHead(x: number, y: number): V;
  /** head space (still coords) → frame */
  toFrame(x: number, y: number): V;
}
function headMap(ctx: Ctx): HeadMap {
  const { rig } = ctx;
  const [px, py] = rig.pivot;
  const [sx, sy] = rig.shift;
  const c = Math.cos(rig.turn);
  const s = Math.sin(rig.turn);
  return {
    turned: Math.abs(rig.turn) > 1e-6,
    toHead(x, y) {
      const dx = x - px - sx;
      const dy = y - py - sy;
      return [px + dx * c + dy * s - OX, py - dx * s + dy * c - OY];
    },
    toFrame(x, y) {
      const dx = x + OX - px;
      const dy = y + OY - py;
      return [px + dx * c - dy * s + sx, py + dx * s + dy * c + sy];
    },
  };
}

/** The frame box a head-space box lands in (+ margin). */
function frameBox(m: HeadMap, x0: number, y0: number, x1: number, y1: number, w: number, h: number, pad = 2): [number, number, number, number] {
  let a = Infinity;
  let b = Infinity;
  let cc = -Infinity;
  let d = -Infinity;
  for (const [x, y] of [[x0, y0], [x1 + 1, y0], [x0, y1 + 1], [x1 + 1, y1 + 1]] as const) {
    const [fx, fy] = m.toFrame(x, y);
    a = Math.min(a, fx);
    b = Math.min(b, fy);
    cc = Math.max(cc, fx);
    d = Math.max(d, fy);
  }
  return [Math.max(0, Math.floor(a) - pad), Math.max(0, Math.floor(b) - pad), Math.min(w - 1, Math.ceil(cc) + pad), Math.min(h - 1, Math.ceil(d) + pad)];
}

// ------------------------------------------------------------------ the parts' still pixels

/** per column: the topmost mouth px (the upper lip's ink gape line: it stays with the skull) */
let lipTop: Int16Array | null = null;
function lipRow(): Int16Array {
  if (lipTop) return lipTop;
  const t = new Int16Array(SW).fill(-1);
  for (let x = 0; x < SW; x++)
    for (let y = 0; y < SH; y++)
      if (ownerAt(x, y) === 'm') {
        t[x] = y;
        break;
      }
  lipTop = t;
  return t;
}
/** the skull: cranium, snout, eye, upper fang + the upper lip's ink line */
const isSkull = (x: number, y: number) => ownerAt(x, y) === 'h' || (ownerAt(x, y) === 'm' && lipRow()[x] === y);
/** the jaw: lower jaw, lower fang, the rest of the mouth's still pixels (the lower lip's ink) */
const isJaw = (x: number, y: number) => ownerAt(x, y) === 'j' || (ownerAt(x, y) === 'm' && lipRow()[x] !== y);
const isCrown = (x: number, y: number) => ownerAt(x, y) === 'c';

/** per column, in head space: the upper jaw's lowest row and the jaw's top row (the gape between them) */
interface Gape {
  readonly upper: Int16Array;
  readonly lower: Int16Array;
}
let GAPE: Gape | null = null;
function gape(): Gape {
  if (GAPE) return GAPE;
  const upper = new Int16Array(SW).fill(-1);
  const lower = new Int16Array(SW).fill(-1);
  for (let x = 0; x < SW; x++)
    for (let y = 0; y < SH; y++) {
      if (isSkull(x, y)) upper[x] = Math.max(upper[x], y);
      else if (isJaw(x, y) && upper[x] >= 0 && y > upper[x] && lower[x] < 0) lower[x] = y;
    }
  GAPE = { upper, lower };
  return GAPE;
}

const HINGE: V = [BUILD.head.hinge[0] - OX, BUILD.head.hinge[1] - OY];
/** the mouth: the throat crease's px from the hinge, the tongue's rows over the lower lip, the teeth (head-space columns) */
const MOUTH = { throat: 2, tongue: 2, upperTeeth: [51, 54, 57], lowerTeeth: [50, 53, 56], minGape: 5, tooth: 2 };
const [, MAG1, MAG2] = TONES.coral;
const MAG0 = TONES.coral[0];

/** The eye block (still px, x0..x1 × y0..y1): socket, iris, hot core, glint — re-stamped unturned. */
const EYE_BOX = { x0: 49, y0: 26, x1: 53, y1: 27 };

// ------------------------------------------------------------------ the eye's states (fx.eye / squint / glint)

const EYE = { iris: [[52, 26], [51, 27]] as const, core: [52, 27] as const, glint: [53, 27] as const, lid: [[53, 26], [50, 27]] as const };

/** The eye's channels over the stamped eye; `at` maps an eye still px to the frame. */
function paintEye(c: PixelCanvas, ctx: Ctx, at: (x: number, y: number) => V): void {
  const { eye, squint, glint } = ctx.pose.fx;
  const put = (x: number, y: number, col: number) => {
    const [fx, fy] = at(x, y);
    c.set(fx, fy, col);
  };
  const [SOCKET, IRIS, CORE, WHITE] = TONES.eye;
  if (eye <= 0.5) {
    for (const [x, y] of EYE.iris) put(x, y, SOCKET);
    // dim: the core's last ember; out (≤ 0.25: dead, not yet lit): dark
    put(EYE.core[0], EYE.core[1], eye <= 0.25 ? SOCKET : IRIS);
    put(EYE.glint[0], EYE.glint[1], SOCKET);
  } else if (eye >= 1.5) {
    for (const [x, y] of EYE.iris) put(x, y, CORE);
    put(EYE.core[0], EYE.core[1], WHITE);
    put(EYE.lid[0][0], EYE.lid[0][1], IRIS); // the iris widens a pixel toward the snout
  }
  if (squint >= 1) {
    // shut: the lid (the skull's own side plane, the row over the eye) comes down over the upper row and
    // the eye is a 3-px dark lash line — no light
    for (let x = EYE_BOX.x0 + 1; x <= EYE_BOX.x1; x++) {
      // the lid takes the skull's own tone just over it in THIS frame (a turned skull re-samples its planes)
      const [fx, fy] = at(x, EYE_BOX.y0 - 1);
      put(x, EYE_BOX.y0, c.get(fx, fy) ?? rigidAt(x, EYE_BOX.y0 - 1, ctx.light) ?? SOCKET);
    }
    for (let x = EYE_BOX.x0 + 1; x <= EYE_BOX.x1 - 1; x++) put(x, EYE_BOX.y1, SOCKET);
  } else if (squint >= 0.5) {
    // the upper lid comes down: the top row of the eye goes to the socket, the slit keeps its light
    put(EYE.iris[0][0], EYE.iris[0][1], SOCKET);
    put(EYE.lid[0][0], EYE.lid[0][1], SOCKET);
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

// ------------------------------------------------------------------ the painters

/** The skull: cranium, snout, eye socket, upper fang, the upper lip's line. */
export const HEAD: Part = {
  layer: 'head',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.head.u, RIGID_AT.head.lead);
    if (st === 'none') return null;
    const water = st === 'water';
    const c = ctx.canvas();
    const m = headMap(ctx);
    const [sx, sy] = ctx.rig.shift;
    if (!m.turned) {
      stampPart(c, 'h', ctx.light, ctx.rig.shift, { water, mark: 'still' });
      // the upper lip's ink line rides the skull (the jaw paints the rest of the mouth)
      const lip = lipRow();
      for (let x = 0; x < SW; x++) {
        if (lip[x] < 0) continue;
        const col = rigidAt(x, lip[x], ctx.light);
        if (col === null) continue;
        c.set(x + OX + sx, lip[x] + OY + sy, water ? waterize(col) : col);
        markPattern(x + OX + sx, lip[x] + OY + sy, x, lip[x]);
      }
      if (!water) paintEye(c, ctx, (x, y) => [x + OX + sx, y + OY + sy]);
      return c;
    }
    const u = upOf('skull', isSkull);
    const [bx0, by0, bx1, by1] = frameBox(m, u.x0, u.y0, u.x0 + u.w / K - 1, u.y0 + u.h / K - 1, c.w, c.h);
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const [hx, hy] = m.toHead(x + 0.5, y + 0.5);
        const col = sampleUp(u, hx, hy, ctx.light);
        if (col < 0) continue;
        c.set(x, y, water ? waterize(col) : col);
        markPattern(x, y, Math.floor(hx), Math.floor(hy));
      }
    if (water) return c;
    // the eye, unturned at its turned place
    const [ecx, ecy] = m.toFrame((EYE_BOX.x0 + EYE_BOX.x1 + 1) / 2, (EYE_BOX.y0 + EYE_BOX.y1 + 1) / 2);
    const ex0 = Math.round(ecx - (EYE_BOX.x1 - EYE_BOX.x0 + 1) / 2);
    const ey0 = Math.round(ecy - (EYE_BOX.y1 - EYE_BOX.y0 + 1) / 2);
    const at = (x: number, y: number): V => [ex0 + x - EYE_BOX.x0, ey0 + y - EYE_BOX.y0];
    for (let y = EYE_BOX.y0; y <= EYE_BOX.y1; y++)
      for (let x = EYE_BOX.x0; x <= EYE_BOX.x1; x++) {
        const col = rigidAt(x, y, ctx.light);
        if (col === null || ownerAt(x, y) !== 'h') continue;
        const [fx, fy] = at(x, y);
        if (c.isOpaque(fx, fy)) c.set(fx, fy, col);
      }
    paintEye(c, ctx, at);
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
    const water = st === 'water';
    const c = ctx.canvas();
    const m = headMap(ctx);
    const [sx, sy] = ctx.rig.shift;
    const k = Math.max(0, Math.round(ctx.pose.crown));
    const sink = Math.round(ctx.pose.fx.sink);
    // coral is stone: it never foams (no pattern), and where the body foams away under it, it sinks (fx.sink)
    const fall = ctx.pose.fx.fall;
    if (fall > 0) {
      fallenCrown(c, ctx, m, fall, sink, water);
      return c;
    }
    if (!m.turned) {
      stampPart(c, 'c', ctx.light, [sx - k, sy - k + sink], { water, mark: 'none' });
      return c;
    }
    const u = upOf('crown', isCrown);
    const [bx0, by0, bx1, by1] = frameBox(m, u.x0 - k, u.y0 - k, u.x0 + u.w / K - 1, u.y0 + u.h / K - 1, c.w, c.h, 3);
    for (let y = by0; y <= by1 + sink; y++)
      for (let x = bx0; x <= bx1; x++) {
        const [hx, hy] = m.toHead(x + 0.5, y + 0.5 - sink);
        const col = sampleUp(u, hx + k, hy + k, ctx.light);
        if (col < 0) continue;
        c.set(x, y, water ? waterize(col) : col);
        markPattern(x, y, NO_PATTERN, NO_PATTERN);
      }
    return c;
  },
};

/**
 * The crown fallen onto the heap (fx.fall): the stone crown tipped over about its own middle (FALL.deg at
 * fall 1: the crescent's front rolls down onto the water, the spines lie back and left) and carried
 * from its seat on the skull down onto the heap's water (FALL.lap, the frame row of the heap's top at
 * the end of the death); its lower part is sunk under a 1-px water4 lap line across its base, the rest
 * stands clear of the water — a fallen coral, never an upright twig.
 */
const FALL = { deg: 30, sunk: 0.4, lap: 76 };
let crownMid: V | null = null;
function fallenCrown(c: PixelCanvas, ctx: Ctx, m: HeadMap, fall: number, sink: number, water: boolean): void {
  const u = upOf('crown', isCrown);
  if (!crownMid) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++)
        if (isCrown(x, y)) {
          sx += x + 0.5;
          sy += y + 0.5;
          n++;
        }
    crownMid = [sx / Math.max(1, n), sy / Math.max(1, n)];
  }
  const f = Math.min(1, fall);
  const [mx, my] = crownMid;
  const [fx, fy] = m.toFrame(mx, my);
  const a = (FALL.deg * f * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const R = 16;
  // the turned crown round its middle (offsets), then its rows decide where the water line cuts it
  const pts: number[] = [];
  let lo = -Infinity;
  let hi = Infinity;
  for (let dy = -R; dy <= R; dy++)
    for (let dx = -R; dx <= R; dx++) {
      const col = sampleUp(u, mx + (dx + 0.5) * ca + (dy + 0.5) * sa, my - (dx + 0.5) * sa + (dy + 0.5) * ca, ctx.light);
      if (col < 0) continue;
      pts.push(dx, dy, col);
      lo = Math.max(lo, dy);
      hi = Math.min(hi, dy);
    }
  const lineOff = lo - Math.round((lo - hi) * FALL.sunk * f);
  const cx = Math.round(fx);
  const cy = Math.round(fy + sink + (FALL.lap - lineOff - (fy + sink)) * f);
  for (let k = 0; k < pts.length; k += 3) {
    const [dx, dy, col] = [pts[k], pts[k + 1], pts[k + 2]];
    if (dy > lineOff) continue;
    c.set(cx + dx, cy + dy, dy === lineOff && f >= 0.5 ? TONES.scale[4] : water ? waterize(col) : col);
    markPattern(cx + dx, cy + dy, NO_PATTERN, NO_PATTERN);
  }
}

/** The lower jaw (turned down about the hinge), the open mouth between the lips, the teeth. */
export const JAW: Part = {
  layer: 'jaw',
  seam: 'none',
  paint(ctx) {
    const st = formedAt(ctx.pose.fx, RIGID_AT.jaw.u, RIGID_AT.jaw.lead);
    if (st === 'none') return null;
    const water = st === 'water';
    const c = ctx.canvas();
    const { rig, light } = ctx;
    const m = headMap(ctx);
    const ja = Math.max(0, rig.jawA);
    const [sx, sy] = rig.shift;
    const put = (x: number, y: number, col: number, px: number, py: number) => {
      c.set(x, y, water ? waterize(col) : col);
      markPattern(x, y, px, py);
    };
    if (!m.turned && ja < 1e-6) {
      // at rest: the still's own jaw and gape
      for (let y = 0; y < SH; y++)
        for (let x = 0; x < SW; x++) {
          if (!isJaw(x, y)) continue;
          const col = rigidAt(x, y, light);
          if (col !== null) put(x + OX + sx, y + OY + sy, col, x, y);
        }
      return c;
    }
    const cj = Math.cos(ja);
    const sj = Math.sin(ja);
    // head space → the jaw's own (still) space: undo the jaw's turn about the hinge
    const toJaw = (hx: number, hy: number): V => {
      const dx = hx - HINGE[0];
      const dy = hy - HINGE[1];
      return [HINGE[0] + dx * cj + dy * sj, HINGE[1] - dx * sj + dy * cj];
    };
    const u = upOf('jaw', isJaw);
    const G = gape();
    // the box: the jaw's still box turned by the jaw, then by the head (generous)
    const [bx0, by0, bx1, by1] = frameBox(m, u.x0, u.y0 - 2, u.x0 + u.w / K, u.y0 + u.h / K + 14, c.w, c.h, 3);
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const [hx, hy] = m.toHead(x + 0.5, y + 0.5);
        const [jx, jy] = toJaw(hx, hy);
        const col = sampleUp(u, jx, jy, light);
        if (col >= 0) {
          put(x, y, col, Math.floor(jx), Math.floor(jy));
          continue;
        }
        // ---- the mouth: under the upper lip (head space), over the lower lip (jaw space)
        const cx = Math.floor(hx);
        const jcx = Math.floor(jx);
        if (cx < 0 || cx >= SW || jcx < 0 || jcx >= SW) continue;
        const up = G.upper[cx];
        const lo = G.lower[jcx];
        if (up < 0 || lo < 0 || hy < up + 1 || jy >= lo) continue;
        if (hx < HINGE[0] - 0.5) continue;
        const dUp = hy - (up + 1); // px below the upper lip
        const dLo = lo - jy; // px above the lower lip
        const gapePx = dUp + dLo;
        let tone: number = MAG1;
        if (hx - HINGE[0] < MOUTH.throat + 0.5) tone = MAG0;
        else if (dLo <= MOUTH.tongue && dLo < dUp) tone = MAG2;
        // teeth: 1-px white hanging from the upper lip / standing on the lower lip where the gape is open enough
        if (gapePx >= MOUTH.minGape) {
          if (dUp < MOUTH.tooth && MOUTH.upperTeeth.includes(cx)) tone = PAL.white;
          if (dLo <= MOUTH.tooth && MOUTH.lowerTeeth.includes(jcx)) tone = PAL.white;
        }
        put(x, y, tone, cx, Math.floor(hy));
      }
    return c;
  },
};
