// Uçurum Büyücüsü v3 — the restyled rig: Pose → pixels.
//
// Started as a copy of the v1 rig (src/art/monsters/abyss_magus.ts: same skeleton, proportions,
// silhouette, staff / sleeve IK, cape and hem curves) and restyled to the approved still
// (src/still/magus-map.ts):
//   - rigid parts (helm + horns, bust, pauldrons, gauntlets) are hand-placed maps
//     (abyss_magus-maps.ts) moved by whole pixels only, so they never swim or crawl;
//   - cloth (cape, skirt panels, hem flaps, tabard, sleeves) is shaded by flat value planes measured
//     from the part's own edges (a lit band along the edge facing the key light, a fold valley that
//     opens downward, 1-px separations where it laps over another part) instead of per-row
//     gradients, so the clusters stay flat and calm in every frame;
//   - metal, cloth and magic stay apart: slate plates with crisp breaks and one glint, violet cloth
//     in broad bands without chrome, a small saturated orb / gem / sigil / eyes;
//   - ONE key light, from the screen's top-left. `light` = the frame edge it comes from: 'left' for
//     player 1, 'right' for the P2 relight sheet (mirrored by flipX it is lit from the screen's
//     top-left again). Every lit / shaded plane is chosen per light, not mirrored afterwards.
// The frame is the v1 80×80 frame plus a margin (OX, OY) so no pose touches the edge; 1 art px =
// 1 game px.

import { PAL } from '../palette';
import { PixelCanvas, bezier, type Pt } from '../pixel';
import { BUST, EYE, FIST_B, FIST_F, HELM, MAP_KEY, PAUL_B, PAUL_F, type PartMap } from './abyss_magus-maps';

export type Light = 'left' | 'right';

/** Frame (v1 80×80 + margin). OX / OY = where the v1 frame's (0, 0) sits in this frame. */
export const W = 112;
export const H = 98;
export const OX = 10;
export const OY = 14;

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** Whole-body offset (px) and hover bob (px, + = down). */
  dx: number;
  bob: number;
  /** Upper-body lean (+ = forward): the bust and pauldrons shift 0.4×, the head 0.8× (whole px). */
  lean: number;
  /** Extra head offset (px); visor squint (0 open … 1 shut). */
  hx: number;
  hy: number;
  squint: number;
  /** Staff grip (v1 frame px, before dx / bob) and staff angle (rad from vertical, + = top forward). */
  gx: number;
  gy: number;
  sa: number;
  /** Orb size (1 = the still's), glow 0..1, extra vertical drift off the staff head (px). */
  orb: number;
  glow: number;
  orbLift: number;
  /** Free (far) hand (v1 frame px, before dx / bob); bFront = that hand holds the staff, in front. */
  bx: number;
  by: number;
  bFront: number;
  /** Cape: hem lag (px), flare 0..1, ripple amplitude, wrap 0..1 (pulled around the front). */
  cx: number;
  cy: number;
  flare: number;
  ripple: number;
  wrap: number;
  /** Robe hem sway (px at the hem, + = forward). */
  sway: number;
  /** Eye glow 0..2.5, rune / sigil 0..2, aura ring 0..1, charge 0..1, release flash 0..1, ward 0..1. */
  eye: number;
  rune: number;
  aura: number;
  charge: number;
  flash: number;
  ward: number;
  /** Smear: the orb's path this frame, from (sfx, sfy) bending through (scx, scy) (v1 px; NaN = none). */
  sfx: number;
  sfy: number;
  scx: number;
  scy: number;
  /** Wind-up: the upper staff + orb are drawn behind the shoulders and helm. */
  orbBack: number;
  /** Roar: void flame in the raised free hand 0..1, star burst on the orb 0..1. */
  flame: number;
  star: number;
  /** Phases (0..1 per loop): orb swirl / motes, cape edge ripple, hem wave. */
  t: number;
  capeT: number;
  hemT: number;
  /** Sleeve bell lag (px, + = the bell trails toward the back): front, back. */
  lagF: number;
  lagB: number;
  /** Near pauldron lift (px, + = up) when the staff arm rises. */
  paulY: number;

  // ---- part 2 (extra anims); all 0 in the base anims, which they leave pixel-identical ----

  /**
   * Collapse: the upper body (helm, bust, pauldrons, arms, the cape's top) sinks this many px into
   * the robe while the hem stays on the floor (the skirt shortens: an emptying cloak); ≤ 22.
   */
  sink: number;
  /** The lower robe and the cape pool outward on the floor 0..1 (a heap is wider). */
  pool: number;
  /** The pauldrons fold in toward the chest (px): the shoulders cave in. */
  hunch: number;
  /**
   * The staff is out of the hand (1): it stands / falls on its own, pivoting on the ferrule's end
   * at (fpx, fpy) (v1 frame px, not carried by dx / bob) at angle sa; the empty front fist is at
   * (fx, fy) (v1 px, before dx / bob / sink).
   */
  free: number;
  fpx: number;
  fpy: number;
  fx: number;
  fy: number;
  /**
   * Dark dissolve 0..1: the body erodes in 2-px clusters from the horns down (a void0 front, then
   * gone, dark motes rising off it); the staff never dissolves. Revive runs it backwards.
   */
  diss: number;
  /** Revive: dark motes spiralling in from far out (0) onto the body (1); 0 = none. */
  gather: number;
  /** Summon: the rift on the floor under the body, open 0..1; while open the body is cut at its lip. */
  rift: number;
  /** Special: the tendril's first span leaving the orb along the staff 0..1 (the cinematic draws the rest). */
  tendril: number;
  /** hitMagic: magenta crackle over the plates 0..1 (its phase is t). */
  zap: number;
}

export const NEUTRAL: Pose = {
  dx: 0,
  bob: 0,
  lean: 0,
  hx: 0,
  hy: 0,
  squint: 0,
  gx: 55,
  gy: 44,
  sa: 0,
  orb: 1,
  glow: 0.5,
  orbLift: 0,
  bx: 30,
  by: 46,
  bFront: 0,
  cx: 0,
  cy: 0,
  flare: 0,
  ripple: 1,
  wrap: 0,
  sway: 0,
  eye: 1,
  rune: 0.6,
  aura: 0,
  charge: 0,
  flash: 0,
  ward: 0,
  sfx: NaN,
  sfy: NaN,
  scx: NaN,
  scy: NaN,
  orbBack: 0,
  flame: 0,
  star: 0,
  t: 0,
  capeT: 0,
  hemT: 0,
  lagF: 0,
  lagB: 0,
  paulY: 0,
  sink: 0,
  pool: 0,
  hunch: 0,
  free: 0,
  fpx: 55,
  fpy: 73,
  fx: 55,
  fy: 44,
  diss: 0,
  gather: 0,
  rift: 0,
  tendril: 0,
  zap: 0,
};

export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- parts / compositing

const enum Part {
  none = 0,
  under = 1,
  cape = 2,
  backArm = 3,
  skirt = 4,
  flap = 5,
  tabard = 6,
  wrap = 7,
  bust = 8,
  paulB = 9,
  helm = 10,
  shaft = 11,
  sleeve = 12,
  paulF = 13,
  fist = 14,
  head = 15,
  orb = 16,
}

/** The frame being drawn plus a part-id buffer (which part owns each pixel). */
interface Frame {
  p: PixelCanvas;
  id: Uint8Array;
}

interface SepOpts {
  /** Colour painted on already-drawn pixels touching the new part (a separation line under it). */
  out?: number;
  /** Parts that never get the `out` line (the new part carries its own dark edge there). */
  outSkip?: readonly Part[];
  /** Colour painted on the new part's own pixels that touch already-drawn pixels. */
  in?: number;
  /** Neighbour directions checked for `in` (default all four). */
  inDirs?: readonly (readonly [number, number])[];
}

const DIR4: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const DIRH: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
];

function comp(f: Frame, q: PixelCanvas, part: Part, o: SepOpts = {}): void {
  const { p, id } = f;
  const outs: number[] = [];
  const ins: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const qo = q.isOpaque(x, y);
      if (!qo) {
        if (o.out === undefined || !p.isOpaque(x, y)) continue;
        if (o.outSkip && o.outSkip.includes(id[y * W + x] as Part)) continue;
        if (q.isOpaque(x - 1, y) || q.isOpaque(x + 1, y) || q.isOpaque(x, y - 1) || q.isOpaque(x, y + 1)) outs.push(x, y);
        continue;
      }
      if (o.in === undefined) continue;
      for (const [dx, dy] of o.inDirs ?? DIR4)
        if (!q.isOpaque(x + dx, y + dy) && p.isOpaque(x + dx, y + dy)) {
          ins.push(x, y);
          break;
        }
    }
  for (let i = 0; i < outs.length; i += 2) p.set(outs[i], outs[i + 1], o.out!);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = q.get(x, y);
      if (c === null) continue;
      p.set(x, y, c);
      id[y * W + x] = part;
    }
  for (let i = 0; i < ins.length; i += 2) p.set(ins[i], ins[i + 1], o.in!);
}

/** Draw a part map at (x, y) (map origin = anchor + its offset). Returns the cast-shadow pixels ('x'). */
function stampMap(q: PixelCanvas, m: PartMap, ax: number, ay: number): number[] {
  const cast: number[] = [];
  const x0 = ax + m.ox;
  const y0 = ay + m.oy;
  for (let j = 0; j < m.rows.length; j++) {
    const row = m.rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      if (ch === 'x') {
        cast.push(x0 + i, y0 + j);
        continue;
      }
      const c = MAP_KEY[ch];
      if (c !== undefined) q.set(x0 + i, y0 + j, c);
    }
  }
  return cast;
}

function castShadow(f: Frame, cast: number[], c: number): void {
  for (let i = 0; i < cast.length; i += 2) if (f.p.isOpaque(cast[i], cast[i + 1])) f.p.set(cast[i], cast[i + 1], c);
}

// ---------------------------------------------------------------- small geometry helpers

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function ik(sx: number, sy: number, hx: number, hy: number, l1: number, l2: number, bend: 1 | -1): Pt {
  const dx = hx - sx;
  const dy = hy - sy;
  const d = Math.max(0.01, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
  const a = Math.atan2(dy, dx);
  const ca = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = a + bend * Math.acos(Math.max(-1, Math.min(1, ca)));
  return [sx + Math.cos(ang) * l1, sy + Math.sin(ang) * l1];
}

/** Outline polygon of a bell sleeve along shoulder→elbow→cuff, widening, with a drooping underside (v1). */
function sleevePoly(s: Pt, e: Pt, c: Pt, w0: number, w1: number, w2: number, droop: number, lag: number): Pt[] {
  const pts = [s, e, c];
  const ws = [w0, w1, w2];
  const up: Pt[] = [];
  const dn: Pt[] = [];
  for (let i = 0; i < 3; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(2, i + 1)];
    let ux = b[0] - a[0];
    let uy = b[1] - a[1];
    const l = Math.hypot(ux, uy) || 1;
    ux /= l;
    uy /= l;
    let nx = -uy;
    let ny = ux;
    if (ny < 0 || (ny === 0 && nx < 0)) {
      nx = -nx;
      ny = -ny;
    }
    const h = ws[i] / 2;
    up.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
    dn.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
  }
  const hang: Pt = [dn[2][0] - 1.5 + lag, dn[2][1] + droop];
  const hang2: Pt = [lerp(dn[1][0], dn[2][0], 0.45) + lag * 0.5, lerp(dn[1][1], dn[2][1], 0.45) + droop * 0.55];
  return [up[0], up[1], up[2], dn[2], hang, hang2, dn[1], dn[0]];
}

/** Steps from (x, y) along (sx, sy) that stay inside the opaque mask of q (0 = the next pixel is out). */
function run(q: PixelCanvas, x: number, y: number, sx: number, sy: number, cap: number): number {
  let d = 0;
  while (d < cap && q.isOpaque(x + sx * (d + 1), y + sy * (d + 1))) d++;
  return d;
}

/** Leftmost / rightmost opaque x of each row of q (−1 when the row is empty). */
function spans(q: PixelCanvas): { l: Int16Array; r: Int16Array } {
  const l = new Int16Array(H).fill(-1);
  const r = new Int16Array(H).fill(-1);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (q.isOpaque(x, y)) {
        if (l[y] < 0) l[y] = x;
        r[y] = x;
      }
  return { l, r };
}

/** Distance from a point to a polyline. */
function distPoly(x: number, y: number, pts: readonly Pt[]): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[i + 1];
    const vx = bx - ax;
    const vy = by - ay;
    const l2 = vx * vx + vy * vy || 1;
    const t = clamp(((x - ax) * vx + (y - ay) * vy) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - (ax + vx * t), y - (ay + vy * t)));
  }
  return best;
}

// ---------------------------------------------------------------- the orb (hand-drawn sizes)
// Drawn for a key light at the frame's top-right (the still); flipped for 'left'. 'h' = highlight
// (void4, white when the orb blazes), d = void3 body, c = void2 crescent away from the light,
// b = void1 underside.

// prettier-ignore
const ORB_MAPS: readonly (readonly string[])[] = [
  // 0: spent (r ~1.5)
  ['.dh', 'cdd', '.b.'],
  // 1: small (r ~2.6)
  ['.ddd.', 'cddhd', 'cdddd', '.bcc.'],
  // 2: the still's orb (7×8)
  ['..ddd..', 'cdddddd', 'cdddhhd', 'ccddddd', 'ccddddd', 'cccdddd', '.bbccc.', '..bbb..'],
  // 3: swelling (9×9)
  ['...ddd...', '.cdddddd.', 'cdddddhhd', 'cdddddddd', 'ccddddddd', 'ccddddddd', 'cccdddddd', '.bbccccd.', '..bbbbb..'],
  // 4: full charge (11×11)
  ['....ddd....', '..cdddddd..', '.cdddddhhd.', 'cddddddhhdd', 'cdddddddddd', 'ccddddddddd', 'ccddddddddd', 'cccdddddddd', '.cccccdddd.', '..bbbcccc..', '...bbbbb...'],
];

/** Which orb map a size multiplier uses. */
export function orbIndex(k: number): number {
  return k < 0.45 ? 0 : k < 0.8 ? 1 : k < 1.1 ? 2 : k < 1.3 ? 3 : 4;
}

/** The orb map for a size multiplier. */
function orbMap(k: number): readonly string[] {
  return ORB_MAPS[orbIndex(k)];
}

function drawOrbMap(q: PixelCanvas, cx: number, cy: number, k: number, light: Light, glow: number): void {
  const m = orbMap(k);
  const h = m.length;
  const w = m[0].length;
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - h / 2);
  const hot = glow > 0.85;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const ch = m[j][light === 'right' ? i : w - 1 - i];
      if (ch === '.') continue;
      let c: number = ch === 'd' ? PAL.void3 : ch === 'c' ? PAL.void2 : ch === 'b' ? PAL.void1 : PAL.void4;
      if (ch === 'h' && hot) {
        // the blazing orb: the highlight's outer pixel turns white
        const outer = light === 'right' ? i === w - 1 || m[j][i + 1] !== 'h' : i === 0 || m[j][w - i] !== 'h';
        if (outer) c = PAL.white;
      }
      q.set(x0 + i, y0 + j, c);
    }
}

// ---------------------------------------------------------------- the rig

const WAIST_Y = 42.5;
const STAFF_UP = 18;
const STAFF_DOWN = 26;
const BUST_K = 0.4;
const PAUL_K = 0.4;
const HEAD_K = 0.8;

/** Distance from the grip to the orb centre for an orb size. */
export function orbReach(k: number): number {
  return STAFF_UP + 3.2 + 3.9 * k;
}

/** Ferrule end to grip along the shaft (px): STAFF_DOWN + the iron ferrule. */
const FERRULE = STAFF_DOWN + 3;

/**
 * Staff grip in frame px — whole pixels: the staff, cradle and orb hang on it. In the hand it is
 * the front fist; a free staff (o.free) hangs on its ferrule's end instead.
 */
export function gripPoint(o: Pose): Pt {
  if (o.free) return [Math.round(o.fpx + OX + Math.sin(o.sa) * FERRULE), Math.round(o.fpy + OY - Math.cos(o.sa) * FERRULE)];
  return [Math.round(o.gx + OX + o.dx), Math.round(o.gy + OY + o.bob + o.sink)];
}

/** The front fist in frame px (on the grip, or empty beside a free staff). */
export function handPoint(o: Pose): Pt {
  if (o.free) return [Math.round(o.fx + OX + o.dx), Math.round(o.fy + OY + o.bob + o.sink)];
  return gripPoint(o);
}

/** Centre of the staff orb (frame px) for a pose. */
export function orbCenter(o: Pose): Pt {
  const g = gripPoint(o);
  const d = orbReach(o.orb);
  return [g[0] + Math.sin(o.sa) * d, g[1] - Math.cos(o.sa) * d + o.orbLift];
}

/** Head anchor (frame px, integer): the v1 head stamp origin. */
export function headAnchor(o: Pose): Pt {
  return [32 + OX + Math.round(o.dx + o.lean * HEAD_K + o.hx), 10 + OY + Math.round(o.bob + o.hy + o.sink)];
}

/** Eye point (frame px): the near eye slit. */
export function eyePoint(o: Pose): Pt {
  const [hx, hy] = headAnchor(o);
  return [hx + EYE.near[1], hy + EYE.y];
}

/** Integer offsets of the rigid upper-body parts. */
function rigid(o: Pose) {
  const dx = Math.round(o.dx);
  const bob = Math.round(o.bob);
  const sk = Math.round(o.sink);
  const hu = Math.round(o.hunch);
  return {
    bust: [OX + Math.round(o.dx + o.lean * BUST_K), OY + bob + sk] as Pt,
    paul: [OX + Math.round(o.dx + o.lean * PAUL_K), OY + bob + sk] as Pt,
    /** Pauldron fold-in: the near one moves back and down, the far one forward. */
    paulF: [OX + Math.round(o.dx + o.lean * PAUL_K) - hu, OY + bob + sk + Math.round(o.hunch * 0.5)] as Pt,
    paulB: [OX + Math.round(o.dx + o.lean * PAUL_K) + Math.round(o.hunch * 0.6), OY + bob + sk + Math.round(o.hunch * 0.3)] as Pt,
    head: headAnchor(o),
    dx,
    bob,
  };
}

export function drawMagus(p: PixelCanvas, o: Pose, light: Light): void {
  const f: Frame = { p, id: new Uint8Array(W * H) };
  const R = light === 'right';
  /** +1 when the key light is at the frame's right. */
  const ls = R ? 1 : -1;
  const rg = rigid(o);
  const [bustX, bustY] = rg.bust;
  /** Upper body (rigid with the bust). */
  const T = (x: number, y: number): Pt => [x + bustX, y + bustY];
  const topShift = bustX - OX - o.dx;
  const hemShift = o.sway - o.lean * 0.3;
  /**
   * Lower robe: the top rides with the bust, the hem sways and lags. A collapse (sink) lowers the
   * top while the hem stays on the floor; pooling spreads the lower robe outward.
   */
  const sinkI = Math.round(o.sink);
  const poolX = 40 + OX + o.dx;
  const L = (x: number, y: number): Pt => {
    const s = clamp((y - WAIST_Y) / 26, 0, 1.3);
    const px = x + OX + o.dx + lerp(topShift, hemShift, s);
    const py = y + OY + o.bob;
    if (!sinkI && !o.pool) return [px, py];
    const s1 = Math.min(1, s);
    return [poolX + (px - poolX) * (1 + o.pool * 0.45 * s1), py + sinkI * (1 - s1)];
  };
  /** Rest-frame y of a frame row (for plane rules measured on the still). */
  const restY = (y: number) => {
    const yy = y - OY - o.bob;
    if (!sinkI) return yy;
    // undo the collapse (L above): the band rules keep their place on the shortened robe
    if (yy <= WAIST_Y + sinkI) return yy - sinkI;
    if (yy >= WAIST_Y + 26) return yy;
    return (yy - sinkI * (1 + WAIST_Y / 26)) / (1 - sinkI / 26);
  };

  // staff geometry
  const gripI = gripPoint(o);
  const handI = handPoint(o);
  const dir: Pt = [Math.sin(o.sa), -Math.cos(o.sa)];
  const nrm: Pt = [-dir[1], dir[0]];
  const top: Pt = [gripI[0] + dir[0] * STAFF_UP, gripI[1] + dir[1] * STAFF_UP];
  const bot: Pt = [gripI[0] - dir[0] * STAFF_DOWN, gripI[1] - dir[1] * STAFF_DOWN];
  const orbC = orbCenter(o);

  const drawShaft = (part: 'upper' | 'lower' | 'all') => {
    const q = new PixelCanvas(W, H);
    const a = part === 'upper' ? gripI : bot;
    const b = part === 'lower' ? gripI : top;
    // two pixels wide: the second line sits beside the first along the shaft's dominant normal
    // axis (a solid 2-px band, never a diagonal pair of touching corners); the side toward the
    // key light is void3, the other void2
    const ox = Math.abs(nrm[0]) >= Math.abs(nrm[1]) ? Math.sign(nrm[0]) : 0;
    const oy = ox === 0 ? Math.sign(nrm[1]) : 0;
    const secondLit = ox !== 0 ? ox * ls > 0 : oy < 0;
    q.line(a[0], a[1], b[0], b[1], secondLit ? PAL.void2 : PAL.void3);
    q.line(a[0] + ox, a[1] + oy, b[0] + ox, b[1] + oy, secondLit ? PAL.void3 : PAL.void2);
    if (part !== 'upper') {
      // iron ferrule: the last 4 px below the shaft, one mist glint
      for (let i = 0; i < 4; i++) {
        const x = Math.round(bot[0] - dir[0] * i);
        const y = Math.round(bot[1] - dir[1] * i);
        q.set(x, y, i === 2 ? PAL.mist : PAL.night4);
        if (i === 0) q.set(x + ox, y + oy, PAL.void3);
      }
    }
    comp(f, q, Part.shaft, { out: PAL.ink, outSkip: [Part.fist] });
  };

  const drawHead = () => {
    // the cradle: two prongs cupping the orb, closing into a collar on the shaft (flat night3,
    // night4 tips; the collar's lit pixel faces the key)
    const q = new PixelCanvas(W, H);
    const k = clamp(o.orb, 0.6, 1.6);
    const sp = 5 * Math.max(1, k * 0.95);
    const L0: Pt[] = [
      [3.5 * k, -sp],
      [-1.5, -sp],
      [-5.5, -1],
    ];
    const toS = ([u, v]: Pt): Pt => [orbC[0] + dir[0] * u + nrm[0] * v, orbC[1] + dir[1] * u + nrm[1] * v];
    for (const side of [-1, 1]) {
      const pts = L0.map(([u, v]) => toS([u, v * side]));
      const px = pts.map(([x, y]) => [Math.round(x - 0.5), Math.round(y - 0.5)] as Pt);
      q.line(px[0][0], px[0][1], px[1][0], px[1][1], PAL.night3);
      // the converging part is two pixels thick (a firm diagonal, not a dotted one)
      const ix = Math.round(side * nrm[0]);
      const iy = Math.round(side * nrm[1]);
      q.line(px[1][0], px[1][1] + 1, px[2][0], px[2][1], PAL.night3);
      q.line(px[1][0] + ix, px[1][1] + 1 + iy, px[2][0] + ix, px[2][1] + iy, PAL.night3);
      q.set(px[0][0], px[0][1], PAL.night4);
    }
    // collar: three pixels across the shaft top, then one row of the shaft below it
    const c0 = toS([-6.5, 0]);
    for (let v = -1; v <= 1; v++) {
      const x = Math.round(c0[0] - 0.5 + nrm[0] * v);
      const y = Math.round(c0[1] - 0.5 + nrm[1] * v);
      q.set(x, y, v * ls > 0 ? PAL.night3 : PAL.night2);
    }
    const c1 = toS([-5.5, 0]);
    q.set(Math.round(c1[0] - 0.5), Math.round(c1[1] - 0.5), PAL.night3);
    comp(f, q, Part.head, { out: PAL.ink });
  };

  const drawOrb = () => {
    const q = new PixelCanvas(W, H);
    drawOrbMap(q, orbC[0], orbC[1], o.orb, light, o.glow);
    comp(f, q, Part.orb, { out: PAL.ink, outSkip: [Part.orb] });
  };

  // ------------------------------------------------ cape (back layer): underside, then the outer cloth
  {
    const fl = o.flare;
    const rip = o.ripple;
    const A = T(31, 27);
    const spread = 18 + fl * 2;
    const tip: Pt = [A[0] - spread - 2 + o.cx, 71 + OY + o.bob + o.cy - fl * 8];
    const curve = bezier(A, [A[0] - 2, A[1] + 11 - fl * 4], [A[0] - spread * 0.75, A[1] + 26 - fl * 8], tip, 16);
    // the outer edge ripples: a wave travelling down the cloth (capeT), growing toward the hem
    const edgePts: Pt[] = curve.map(([x, y], i) => {
      const s = i / 16;
      return [x + Math.sin((s * 1.5 - o.capeT) * TAU) * rip * 1.3 * s, y + Math.cos((s * 1.5 - o.capeT) * TAU) * rip * 0.5 * s];
    });
    const Rc: Pt = [42 + OX + o.dx + o.cx * 0.3, 68 + OY + o.bob + o.cy * 0.4];
    const hem: Pt[] = [];
    const M = 7;
    for (let i = 1; i < M; i++) {
      const s = i / M;
      const x = lerp(tip[0], Rc[0], s);
      const y = lerp(tip[1], Rc[1], s);
      const notch = i % 2 === 1 ? -4 - Math.sin((o.hemT * 1.3 + s) * TAU) * rip : 0.5;
      hem.push([x + (i % 2 === 1 ? 0.5 : 0), y + notch]);
    }
    const shape: Pt[] = [T(37, 26), ...edgePts, ...hem, Rc, T(42, 40), T(42, 28)];
    // underside (lining) peeking out under the hem: violet, darker toward the back
    {
      const q = new PixelCanvas(W, H);
      q.poly(
        shape.map(([x, y]) => [x + 2 + fl * 1.5, y + 1.5 + fl * 2] as Pt),
        PAL.void1,
      );
      // the lining's turned edge shows in the notches of the hem
      q.poly(
        shape.map(([x, y]) => [x - 0.5, y + 1.2] as Pt),
        PAL.void2,
      );
      // the lining's own lit fold where the hem turns up (one band, no gradient)
      const qq = q.clone();
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (qq.isOpaque(x, y) && run(qq, x, y, ls, -1, 3) < 2) q.set(x, y, PAL.void2);
      comp(f, q, Part.under);
    }
    {
      const q = new PixelCanvas(W, H);
      q.poly(shape, PAL.night3);
      const src = q.clone();
      // flat bands measured from the outer edge, then a 1-px rim just outside it (the cloth's
      // turned edge). P2 (cape on the shadow side): violet rim | night3 | night4 where it leaves the
      // body; P1 (cape facing the key): steel rim (mist at the shoulder) | night4 | night3.
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          if (!src.isOpaque(x, y)) continue;
          const e = distPoly(x + 0.5, y + 0.5, edgePts);
          const ry = restY(y);
          const w3 = clamp((ry - 40) * 0.9, 0, 4.6);
          let c: number = w3 > 0 && e < w3 + 0.4 ? (R ? PAL.night3 : PAL.night4) : R ? PAL.night4 : PAL.night3;
          // the underside of each tatter below the hem line turns away: one step down
          if (!src.isOpaque(x, y + 1) && ry > 64.5) c = R ? PAL.night2 : PAL.night3;
          q.set(x, y, c);
        }
      const sp = spans(src);
      const yTop = Math.ceil(A[1]);
      const yTip = Math.floor(tip[1]);
      for (let y = yTop; y <= yTip; y++) {
        if (sp.l[y] < 0) continue;
        const ry = restY(y);
        q.set(sp.l[y] - 1, y, R ? PAL.void3 : ry < 40 ? PAL.mist : PAL.steel);
      }
      comp(f, q, Part.cape);
    }
  }

  // ------------------------------------------------ wind-up: staff head + orb hang behind the shoulder
  if (o.orbBack) {
    drawShaft('upper');
    drawHead();
    drawOrb();
  }

  // ------------------------------------------------ back arm (far sleeve + gauntlet)
  const huB = Math.round(o.hunch * 0.6);
  const bShoulder = T(32 + huB, 31 + Math.round(o.hunch * 0.3));
  const bHand: Pt = [Math.round(o.bx + OX + o.dx), Math.round(o.by + OY + o.bob + o.sink)];
  const drawBackArm = () => {
    const q = new PixelCanvas(W, H);
    const el = ik(bShoulder[0], bShoulder[1], bHand[0], bHand[1], 8, 8, -1);
    const cd: Pt = [bHand[0] - el[0], bHand[1] - el[1]];
    const cl = Math.hypot(cd[0], cd[1]) || 1;
    const ux = cd[0] / cl;
    const uy = cd[1] / cl;
    const cuff: Pt = [bHand[0] + 0.5 - ux * 2, bHand[1] + 0.5 - uy * 2];
    q.poly(sleevePoly([bShoulder[0] + 0.5, bShoulder[1] + 0.5], [el[0] + 0.5, el[1] + 0.5], cuff, 4.5, 5, 7, 3, o.lagB), PAL.void1);
    // cloth: void2 band along the edges facing the key, void1 elsewhere
    const src = q.clone();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        // P2: the far sleeve's back edge is in shade (void1), the rest void2; P1: a void2 band
        // along the back edge facing the key, void1 inside
        const back = run(src, x, y, -1, 0, 4);
        q.set(x, y, R ? (back < 1 ? PAL.void1 : PAL.void2) : back < 2 ? PAL.void2 : PAL.void1);
      }
    q.disc(cuff[0] + ux * 0.5, cuff[1] + uy * 0.5, 1.6, PAL.void0); // sleeve mouth
    stampMap(q, FIST_B[light], bHand[0], bHand[1]);
    comp(f, q, Part.backArm, { out: PAL.void0 });
  };
  if (!o.bFront) drawBackArm();

  // ------------------------------------------------ tabard mask first (the skirt panels are measured from it)
  const tabShape: Pt[] = [T(36.5, 42.5), T(42.5, 42.5), L(43.5, 56), L(43, 64), L(40, 70.5), L(37, 64), L(36, 56)];
  const tabMask = new PixelCanvas(W, H);
  tabMask.poly(tabShape, PAL.night3);
  const tab = spans(tabMask);

  // ------------------------------------------------ robe skirt: far panel | (tabard) | near panel, hem band
  const HEM_Y = 64.6;
  {
    const q = new PixelCanvas(W, H);
    const skirt: Pt[] = [T(34, 42.5), T(45, 42.5), L(48.5, 51), L(52.5, 60), L(54.3, HEM_Y + 0.4), L(25.2, HEM_Y + 0.4), L(27, 59), L(30.5, 50.5)];
    q.poly(skirt, PAL.void2);
    const src = q.clone();
    const sp = spans(src);
    for (let y = 0; y < H; y++) {
      if (sp.l[y] < 0) continue;
      const ry = restY(y);
      const xl = sp.l[y];
      const xr = sp.r[y];
      const tl = tab.l[y] >= 0 ? tab.l[y] : Math.round((xl + xr) / 2);
      const tr = tab.r[y] >= 0 ? tab.r[y] : tl;
      const wl = ry < 49 ? 2 : ry < 54 ? 3 : ry < 62 ? 4 : 5;
      const fw = ry >= 57 ? 2 : 1;
      const folds = ry >= 53.5;
      for (let x = xl; x <= xr; x++) {
        if (!src.isOpaque(x, y)) continue;
        let c: number = PAL.void2;
        const far = x < tl;
        const litPanel = R ? !far : far;
        const dOut = far ? x - xl : xr - x;
        if (litPanel) {
          // a flat void3 plane along the outer edge, a fold valley opening downward inside it
          if (far && dOut === 0) c = PAL.void0;
          else if (dOut < wl + (far ? 1 : 0)) c = PAL.void3;
          else if (folds && dOut < wl + fw + (far ? 1 : 0)) c = PAL.void1;
        } else {
          // the panel turned away: void2 with a void1 fold wedge two px in from the outer edge and
          // a 1-px void3 turn where it meets the tabard
          if (dOut === 0) c = far ? PAL.void0 : PAL.void3;
          else if (folds && dOut >= 2 && dOut < 2 + fw) c = PAL.void1;
          else if ((far && x === tl - 2) || (!far && x === tr + 2)) c = PAL.void3;
        }
        q.set(x, y, c);
      }
    }
    // hem band: the lowest pixel of every column
    for (let x = 0; x < W; x++)
      for (let y = H - 1; y >= 0; y--)
        if (src.isOpaque(x, y)) {
          q.set(x, y, PAL.void0);
          break;
        }
    comp(f, q, Part.skirt, { in: PAL.void0, inDirs: [[-1, 0]] });

    // hem flaps hanging from the band (they wave: hemT), one lit plane each
    const tips = [25.5, 29, 32.5, 36, 39.5, 43, 46.5, 50, 54];
    const hp: Pt[] = tips.map((tx, i) => {
      const tipI = i % 2 === 0;
      const ph = Math.sin((o.hemT + i * 0.14) * TAU);
      const y = tipI ? 71.5 - Math.abs(i - 4) * 0.7 : 66.5 - Math.abs(i - 4) * 0.4;
      return L(tx + (tipI ? ph * 0.8 : 0), y + (tipI ? ph * 0.7 : 0));
    });
    const left = L(25.2, HEM_Y);
    const right = L(54.3, HEM_Y);
    const fq = new PixelCanvas(W, H);
    const who = new Int8Array(W * H).fill(-1);
    const bandY = L(0, HEM_Y)[1];
    for (let i = 0; i < tips.length; i += 2) {
      const a = i === 0 ? left : hp[i - 1];
      const b = i === tips.length - 1 ? right : hp[i + 1];
      const t = hp[i];
      const one = new PixelCanvas(W, H);
      one.poly(
        [
          [a[0], bandY],
          [a[0], a[1]],
          t,
          [b[0], b[1]],
          [b[0], bandY],
        ],
        PAL.void2,
      );
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) if (one.isOpaque(x, y) && who[y * W + x] < 0) who[y * W + x] = i;
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = who[y * W + x];
        if (i < 0) continue;
        const t = hp[i];
        // each flap: a lit plane on the side of its tip facing the key, a void1 fold where it
        // meets its neighbour on the other side
        const nb = R ? who[y * W + x - 1] : who[y * W + x + 1];
        // the outermost flap on the shadow side stays in shade
        const shadowOuter = R ? i === 0 : i === tips.length - 1;
        const lit = !shadowOuter && (R ? x + 0.5 > t[0] + 0.5 : x + 0.5 < t[0] - 0.5);
        fq.set(x, y, nb >= 0 && nb !== i ? PAL.void1 : lit ? PAL.void3 : PAL.void2);
      }
    comp(f, fq, Part.flap, { in: PAL.void0, inDirs: [[-1, 0]] });
  }

  // ------------------------------------------------ tabard (front panel, cloth) with the sigil
  {
    const q = new PixelCanvas(W, H);
    q.poly(tabShape, PAL.night3);
    const src = q.clone();
    for (let y = 0; y < H; y++) {
      if (tab.l[y] < 0) continue;
      const ry = restY(y);
      const wt = ry < 51.5 ? 3 : ry < 61.5 ? 4 : ry < 64.5 ? 3 : ry < 65.5 ? 2 : ry < 67.5 ? 1 : 0;
      const band = Math.abs(ry - 64) < 0.5;
      for (let x = tab.l[y]; x <= tab.r[y]; x++) {
        if (!src.isOpaque(x, y)) continue;
        const dl = x - tab.l[y];
        const dr = tab.r[y] - x;
        const dLit = R ? dr : dl;
        const dDark = R ? dl : dr;
        let c: number;
        if (band) c = PAL.night2;
        else if (dDark === 0) c = PAL.night2;
        else if (dLit < wt) c = PAL.night4;
        else c = PAL.night3;
        q.set(x, y, c);
      }
    }
    // the abyss sigil: a small cross, void4 heart (brighter with the runes)
    const [sx, sy] = L(39.5, 50.5);
    const ix = Math.floor(sx);
    const iy = Math.floor(sy);
    const arm = o.rune > 1.2 ? PAL.void4 : o.rune > 0.45 ? PAL.void3 : PAL.void2;
    const core = o.rune > 1.2 ? PAL.white : o.rune > 0.45 ? PAL.void4 : PAL.void3;
    q.set(ix, iy - 1, arm).set(ix - 1, iy, arm).set(ix + 1, iy, arm).set(ix, iy + 1, arm).set(ix, iy, core);
    comp(f, q, Part.tabard, { out: PAL.void0 });
  }

  // ------------------------------------------------ guard: the cape pulled around the lower front,
  // gathered at the belly by the free hand (its turned edge shows the violet lining)
  if (o.wrap > 0) {
    const q = new PixelCanvas(W, H);
    // a partial wrap (toGuard / fromGuard / summon): the panel swings round from the back, its
    // points sliding from a sliver along the body's back edge (x 26) to their closed place
    const wk = clamp(o.wrap, 0, 1);
    const WR = (fn: (x: number, y: number) => Pt, x: number, y: number): Pt => {
      const c = fn(x, y);
      if (wk >= 1) return c;
      const t = fn(26 + (x - 26) * 0.12, y);
      return [lerp(t[0], c[0], wk), lerp(t[1], c[1], wk)];
    };
    const e0 = WR(T, 28.5, 40);
    const e1 = WR(L, 41.5, 45);
    const e2 = WR(L, 54.5, 55);
    const shape: Pt[] = [e0, e1, e2, ...([[55.2, 62], [53.5, 66], [51.5, 71], [48, 67.5], [44, 72], [40, 68], [36, 72], [32, 67.5], [28, 71], [25, 66.5], [25.5, 56], [27, 47]] as const).map(([x, y]) => WR(L, x, y))];
    q.poly(shape, PAL.night3);
    const src = q.clone();
    const foldA = e1;
    const foldB = WR(L, 36.5, 69);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        const toLight = run(src, x, y, ls, 0, 6);
        let c: number = toLight < 4 ? PAL.night4 : PAL.night3;
        // one fold valley running from the gathering hand down to the hem, opening downward
        const along = clamp(((x + 0.5 - foldA[0]) * (foldB[0] - foldA[0]) + (y + 0.5 - foldA[1]) * (foldB[1] - foldA[1])) / ((foldB[0] - foldA[0]) ** 2 + (foldB[1] - foldA[1]) ** 2), 0, 1);
        const fd = distPoly(x + 0.5, y + 0.5, [foldA, foldB]);
        if (along > 0.15 && fd < 0.75 + along * 1.0) c = PAL.night2;
        const up = run(src, x, y, 0, -1, 2);
        if (up === 0) c = PAL.void3;
        else if (up === 1) c = PAL.void2;
        else if (!src.isOpaque(x, y + 1)) c = PAL.night2;
        // still swinging: its leading edge turns and shows the violet lining
        if (wk < 1 && up > 1 && !src.isOpaque(x + 1, y)) c = PAL.void2;
        q.set(x, y, c);
      }
    comp(f, q, Part.wrap, { out: PAL.void0 });
  }

  // ------------------------------------------------ bust: breastplate + sash + cowl + gem (rigid)
  {
    const q = new PixelCanvas(W, H);
    stampMap(q, BUST[light], bustX, bustY);
    // the gem glows with the orb
    const gx = bustX + 39;
    const gy = bustY + 29;
    if (o.glow > 0.85) q.set(gx + 1, gy, PAL.white);
    comp(f, q, Part.bust, { out: PAL.void0 });
  }

  // ------------------------------------------------ far pauldron (rigid)
  {
    const q = new PixelCanvas(W, H);
    stampMap(q, PAUL_B[light], rg.paulB[0], rg.paulB[1]);
    comp(f, q, Part.paulB, { out: PAL.night0 });
  }

  // ------------------------------------------------ helm + horns (rigid) and the eyes
  {
    const q = new PixelCanvas(W, H);
    const [hx, hy] = rg.head;
    stampMap(q, HELM[light], hx, hy);
    paintEyes(q, hx, hy, o);
    comp(f, q, Part.helm, { out: PAL.night0, outSkip: [Part.bust, Part.paulB] });
  }

  // ------------------------------------------------ staff shaft (lower half only while the head is swung back)
  if (!o.free) drawShaft(o.orbBack ? 'lower' : 'all');

  // ------------------------------------------------ front arm: bell sleeve (cloth)
  const huF = Math.round(o.hunch);
  const huFy = Math.round(o.hunch * 0.5);
  /** The near shoulder (folds in with the pauldron). */
  const TF = (x: number, y: number): Pt => T(x - huF, y + huFy);
  const fShoulder = TF(47.5, 31.5);
  {
    const q = new PixelCanvas(W, H);
    const hand: Pt = [handI[0], handI[1]];
    const el = ik(fShoulder[0], fShoulder[1], hand[0], hand[1], 7.5, 8, 1);
    const cd: Pt = [hand[0] - el[0], hand[1] - el[1]];
    const cl = Math.hypot(cd[0], cd[1]) || 1;
    const ux = cd[0] / cl;
    const uy = cd[1] / cl;
    const cuff: Pt = [hand[0] - ux * 2.2, hand[1] - uy * 2.2];
    const lag = o.lagF + o.sway * 0.5 - o.lean * 0.3;
    // the bell hangs from a lowered forearm; on a raised one the cloth slides back toward the
    // elbow, so the cuff narrows and the drape shortens (idle: the forearm points down, k = 1)
    const kb = clamp(0.5 + 0.75 * uy, 0.55, 1);
    q.poly(sleevePoly(fShoulder, el, cuff, 5, 5.5, 8 * (0.75 + 0.25 * kb), 4 * kb, lag), PAL.void2);
    // the sleeve's crown under the near plate (rides with the shoulder)
    q.poly([TF(44, 31), TF(53, 31), TF(53, 33.5), TF(51.6, 35), TF(51.4, 38), TF(45.5, 38), TF(45.5, 34), TF(44, 33)], PAL.void2);
    const src = q.clone();
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        // lit: a 3-px band along the side facing the key, and the forearm's top edge (the
        // crown under the plate stays in the plate's shadow); the edge turned away is void1
        const side = run(src, x, y, ls, 0, 4);
        const up = run(src, x, y, 0, -1, 2);
        const away = run(src, x, y, -ls, 0, 4);
        let c: number = PAL.void2;
        if (side < 3 || (up === 0 && y > fShoulder[1] + 6)) c = PAL.void3;
        else if (away === 0 && y > fShoulder[1] + 6) c = PAL.void1;
        q.set(x, y, c);
      }
    // the sleeve mouth: dark opening around the wrist
    q.disc(cuff[0] + ux * 0.6, cuff[1] + uy * 0.6, 1.8, PAL.void0);
    comp(f, q, Part.sleeve, { out: PAL.void0, in: PAL.void0, inDirs: [[-1, 0]] });
  }

  // ------------------------------------------------ near pauldron (rigid) over the sleeve, its shadow on it
  {
    const q = new PixelCanvas(W, H);
    const cast = stampMap(q, PAUL_F[light], rg.paulF[0], rg.paulF[1] - Math.round(o.paulY));
    comp(f, q, Part.paulF, { out: PAL.night0, outSkip: [Part.sleeve, Part.bust] });
    castShadow(f, cast, PAL.void0);
  }

  // ------------------------------------------------ front gauntlet on the grip
  {
    const q = new PixelCanvas(W, H);
    stampMap(q, FIST_F[light], handI[0], handI[1]);
    comp(f, q, Part.fist);
  }

  // back hand on the staff (guard)
  if (o.bFront) drawBackArm();

  // ------------------------------------------------ staff head (cradle) + orb
  // (a free staff — slipping, falling, lying, rising — is drawn last: it is on the near side)
  if (o.free) drawShaft('all');
  if (!o.orbBack) {
    drawHead();
    drawOrb();
  }

  // ------------------------------------------------ summon: the body is cut at the rift's lip
  const riftY = 77 + OY;
  if (o.rift > 0)
    for (let y = riftY; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!p.isOpaque(x, y)) continue;
        p.erase(x, y);
        f.id[y * W + x] = Part.none;
      }

  // ------------------------------------------------ outline
  p.outline(PAL.ink);

  // ------------------------------------------------ dark dissolve (death / revive)
  if (o.diss > 0) dissolvePass(f, o, rg, restY);

  // ------------------------------------------------ the rift (summon)
  if (o.rift > 0) riftPass(p, o, riftY);

  // ------------------------------------------------ glow pass (unoutlined light on empty pixels)
  glowPass(p, o, orbC);
  if (o.zap > 0) zapPass(f, o, rg);
}

// ---------------------------------------------------------------- part 2 passes

/** Deterministic 0..1 hash of an integer cell. */
function hash2(x: number, y: number, s = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Rest (v1 frame) coordinates of a pixel through the part that owns it (parts move by whole px). */
function restOf(id: Part, x: number, y: number, o: Pose, rg: ReturnType<typeof rigid>, restY: (y: number) => number): Pt | null {
  switch (id) {
    case Part.shaft:
    case Part.head:
    case Part.orb:
      return null;
    case Part.helm:
      return [x - (rg.head[0] - 32), y - (rg.head[1] - 10)];
    case Part.bust:
    case Part.sleeve:
    case Part.backArm:
    case Part.fist:
      return [x - rg.bust[0], y - rg.bust[1]];
    case Part.paulF:
      return [x - rg.paulF[0], y - rg.paulF[1]];
    case Part.paulB:
      return [x - rg.paulB[0], y - rg.paulB[1]];
    default:
      return [x - OX - Math.round(o.dx), restY(y)];
  }
}

/**
 * Dark dissolve: the body erodes in 2×2 clusters (in its own part space, so the pattern rides the
 * parts and never crawls) from the horns down — a void0 front, then gone — and dark motes rise
 * off what is gone. The staff stays whole. Revive runs `diss` backwards (and gathers instead).
 */
function dissolvePass(f: Frame, o: Pose, rg: ReturnType<typeof rigid>, restY: (y: number) => number): void {
  const { p, id } = f;
  const gone: number[] = [];
  const dark: number[] = [];
  const motes: number[] = [];
  const front = 0.1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!p.isOpaque(x, y)) continue;
      let part = id[y * W + x] as Part;
      if (part === Part.none) {
        // an outline pixel: it belongs to the part it hugs
        for (const [ddx, ddy] of DIR4) {
          const n = id[(y + ddy) * W + x + ddx];
          if (x + ddx >= 0 && x + ddx < W && y + ddy >= 0 && y + ddy < H && n !== Part.none) {
            part = n as Part;
            break;
          }
        }
      }
      const r = restOf(part, x, y, o, rg, restY);
      if (!r) continue;
      const cx = Math.floor(r[0] / 2);
      const cy = Math.floor(r[1] / 2);
      const u = clamp((r[1] - 4) / 70, 0, 1);
      const thr = 0.9 * u + 0.1 * hash2(cx, cy, 7);
      if (thr < o.diss - front) {
        gone.push(x, y);
        // one mote per cluster (its top-left pixel), rising off it as the front moves on
        if (!o.gather && (r[0] & 1) === 0 && (r[1] & 1) === 0 && hash2(cx, cy, 11) < 0.14) {
          const rise = 2 + (o.diss - front - thr) * 80;
          if (rise < 18) motes.push(x + Math.round(Math.sin(cy * 1.7 + rise * 0.3)), y - Math.round(rise), rise < 8 ? PAL.void2 : PAL.void1);
        }
      } else if (thr < o.diss && p.get(x, y) !== PAL.ink) dark.push(x, y);
    }
  for (let i = 0; i < gone.length; i += 2) {
    p.erase(gone[i], gone[i + 1]);
    id[gone[i + 1] * W + gone[i]] = Part.none;
  }
  for (let i = 0; i < dark.length; i += 2) p.set(dark[i], dark[i + 1], PAL.void0);
  for (let i = 0; i < motes.length; i += 3) if (!p.isOpaque(motes[i], motes[i + 1])) p.set(motes[i], motes[i + 1], motes[i + 2]);
}

/**
 * The rift on the floor (summon): a dark lens under the body, its back wall lit by the abyss, a
 * void4 hot spot when it is wide open; the body (cut at the lip) rises out of it — the back half
 * only fills empty pixels, the front lip covers the body's cut.
 */
function riftPass(p: PixelCanvas, o: Pose, riftY: number): void {
  const cx = 39.5 + OX;
  const a = 4 + 15 * o.rift;
  const b = 1 + 3 * o.rift;
  const inside = (x: number, y: number, ka: number, kb: number) => {
    const u = (x + 0.5 - cx) / ka;
    const v = (y + 0.5 - riftY) / kb;
    return u * u + v * v < 1;
  };
  for (let y = Math.floor(riftY - b - 1); y <= riftY + b + 1; y++)
    for (let x = Math.floor(cx - a - 1); x <= cx + a + 1; x++) {
      if (!inside(x, y, a, b)) continue;
      const rim = !inside(x, y, a - 1.4, b - 1);
      const back = y + 0.5 < riftY;
      let c: number;
      if (rim) c = back ? (o.rift > 0.7 && Math.abs(x + 0.5 - cx) < a * 0.35 ? PAL.void4 : PAL.void3) : PAL.void2;
      // the back wall just under the lit lip, then the dark: void0 around an ink throat
      else if (back && !inside(x, y - 1, a - 1.4, b - 1)) c = PAL.void2;
      else c = inside(x, y, a * 0.7, b * 0.45) ? PAL.ink : PAL.void0;
      if (back) {
        if (!p.isOpaque(x, y)) p.set(x, y, c);
      } else p.set(x, y, c);
    }
  // dark motes welling up out of it
  if (o.rift > 0.25) {
    const n = 4;
    for (let i = 0; i < n; i++) {
      const k = (o.t * 1.6 + i / n + hash2(i, 3)) % 1;
      const x = Math.round(cx - a * 0.6 + (i / (n - 1)) * a * 1.2 + Math.sin((k + i) * 5) * 1);
      const y = Math.round(riftY - 2 - k * 20 * o.rift);
      if (!p.isOpaque(x, y)) p.set(x, y, k < 0.45 ? PAL.void3 : PAL.void2);
    }
  }
}

/** hitMagic: short magenta crackles over the plates (helm, near pauldron, breastplate). */
function zapPass(f: Frame, o: Pose, rg: ReturnType<typeof rigid>): void {
  const { p, id } = f;
  const starts: [Pt, number, number][] = [
    [[rg.paulF[0] + 49, rg.paulF[1] + 26], 0.6 * Math.PI, 0],
    [[rg.head[0] + 9, rg.head[1] + 3], 0.35 * Math.PI, 1],
    [[rg.bust[0] + 36, rg.bust[1] + 34], 0.15 * Math.PI, 2],
  ];
  const ph = Math.floor(o.t * 16);
  for (const [[x0, y0], a0, k] of starts) {
    const len = Math.round(2 + 5 * o.zap);
    let x = x0;
    let y = y0;
    for (let i = 0; i < len; i++) {
      const j = hash2(i, ph, k * 13 + 5);
      const a = a0 + (j - 0.5) * 1.6;
      x += Math.round(Math.cos(a) * 1.4);
      y += Math.round(Math.sin(a) * 1.4);
      const part = id[y * W + x] as Part;
      if (!p.isOpaque(x, y) || part === Part.orb || part === Part.head) continue;
      p.set(x, y, i === 0 || (i === len - 1 && o.zap > 0.6) ? PAL.white : i % 2 ? PAL.mag4 : PAL.mag3);
    }
  }
}

/** Eye slits under the visor: brightness from o.eye, squint, flare. */
function paintEyes(q: PixelCanvas, hx: number, hy: number, o: Pose): void {
  const y = hy + EYE.y;
  const n = EYE.near.map((i) => hx + i);
  const fr = EYE.far.map((i) => hx + i);
  const e = o.eye;
  let near: number[];
  let far: number[];
  if (o.squint >= 1) {
    near = [PAL.mag1, PAL.mag2, PAL.mag1];
    far = [PAL.mag1, PAL.mag1];
  } else if (o.squint >= 0.5) {
    near = [PAL.mag2, PAL.mag3, PAL.mag2];
    far = [PAL.mag2, PAL.mag1];
  } else if (e > 2.2) {
    near = [PAL.white, PAL.white, PAL.white];
    far = [PAL.mag4, PAL.mag4];
  } else if (e > 1.35) {
    near = [PAL.white, PAL.white, PAL.mag4];
    far = [PAL.mag4, PAL.mag4];
  } else if (e > 0.8) {
    near = [PAL.white, PAL.white, PAL.mag4];
    far = [PAL.mag4, PAL.mag3];
  } else if (e > 0.5) {
    near = [PAL.mag4, PAL.white, PAL.mag4];
    far = [PAL.mag3, PAL.mag3];
  } else {
    near = [PAL.mag3, PAL.mag4, PAL.mag3];
    far = [PAL.mag2, PAL.mag2];
  }
  n.forEach((x, i) => q.set(x, y, near[i]));
  fr.forEach((x, i) => q.set(x, y, far[i]));
  // the eye's glow spills on the brow's underside
  q.set(hx + EYE.brow[0], hy + EYE.brow[1] + 1 - 1, e > 1.35 || o.squint >= 1 ? PAL.mag2 : PAL.mag1);
}

function glowPass(p: PixelCanvas, o: Pose, orbC: Pt): void {
  const put = (x: number, y: number, c: number) => {
    if (!p.isOpaque(x, y)) p.set(x, y, c);
  };
  const [ox, oy] = orbC;
  const r = 3.9 * o.orb;

  if (!Number.isNaN(o.sfx)) {
    // smear: the orb's path as one curved band (void2 → void3 → void4 core), tapered, behind the body
    const P0: Pt = [o.sfx + OX, o.sfy + OY];
    const C: Pt = [o.scx + OX, o.scy + OY];
    const P1: Pt = [ox, oy];
    const N = 90;
    const band = new PixelCanvas(W, H);
    const rank = (v: number | null) => (v === PAL.void4 ? 3 : v === PAL.void3 ? 2 : v === PAL.void2 ? 1 : 0);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const u = 1 - t;
      const cx = u * u * P0[0] + 2 * u * t * C[0] + t * t * P1[0];
      const cy = u * u * P0[1] + 2 * u * t * C[1] + t * t * P1[1];
      const w = 2.3 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15)), 0.7) * (0.45 + 0.55 * t);
      if (w < 0.35) continue;
      for (let yy = Math.floor(cy - w - 1); yy <= cy + w + 1; yy++)
        for (let xx = Math.floor(cx - w - 1); xx <= cx + w + 1; xx++) {
          const d = Math.hypot(xx + 0.5 - cx, yy + 0.5 - cy);
          if (d > w) continue;
          const k = d / w;
          const c = k < 0.35 && t > 0.3 ? PAL.void4 : k < 0.7 ? PAL.void3 : PAL.void2;
          if (rank(c) > rank(band.get(xx, yy))) band.set(xx, yy, c);
        }
    }
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const c = band.get(x, y);
        if (c === null) continue;
        if (Math.hypot(x + 0.5 - ox, y + 0.5 - oy) < r + 1) continue;
        put(x, y, c);
      }
  }

  if (o.aura > 0) {
    // aura ring rolling out around the robe (lower half in front, upper half behind), dithers away
    const ax = 40 + OX + o.dx;
    const ay = 58 + OY + o.bob;
    const rad = 14 + 18 * Math.min(1, Math.max(0, (o.aura - 0.05) / 0.95));
    const sy = 0.55;
    const fade = o.aura > 0.95;
    for (let y = Math.floor(ay - rad * sy - 3); y <= ay + rad * sy + 3; y++)
      for (let x = Math.floor(ax - rad - 3); x <= ax + rad + 3; x++) {
        const dx = x + 0.5 - ax;
        const dy = (y + 0.5 - ay) / sy;
        const e = Math.hypot(dx, dy);
        const th = Math.atan2(dy, dx);
        const g = Math.hypot(Math.cos(th), Math.sin(th) / sy);
        const pd = (e - rad) / g;
        if (pd > 0 || pd <= -2) continue;
        if (fade && !PixelCanvas.ditherAt(x, y, 8)) continue;
        const c = pd > -1 ? PAL.void3 : PAL.void4;
        if (dy > 0) p.set(x, y, c);
        else put(x, y, c);
      }
  }

  // motes orbiting the orb (two; four when it glows hot)
  const nS = o.glow > 0.8 ? 4 : 2;
  for (let i = 0; i < nS; i++) {
    const a = o.t * TAU + (i / nS) * TAU;
    const rr = r + 3.2 + Math.sin(o.t * TAU * 2 + i) * 0.5;
    put(Math.round(ox + Math.cos(a) * rr - 0.5), Math.round(oy + Math.sin(a) * rr * 0.75 - 0.5), i % 2 ? PAL.void3 : PAL.void4);
  }
  if (o.charge > 0) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + o.t * 4;
      const rr = r + 3 + (1 - o.charge) * 7 + (i % 3) * 1.6;
      put(ox + Math.cos(a) * rr, oy + Math.sin(a) * rr, i % 3 === 0 ? PAL.mag3 : PAL.void4);
      put(ox + Math.cos(a - 0.25) * (rr + 1.4), oy + Math.sin(a - 0.25) * (rr + 1.4), PAL.void2);
    }
  }
  if (o.flash > 0) {
    // release flash: a tight ring hugging the orb plus a star of short rays
    for (let a = 0; a < 48; a++) {
      const ang = (a / 48) * TAU;
      put(ox + Math.cos(ang) * (r + 1.6), oy + Math.sin(ang) * (r + 1.6), a % 3 === 0 ? PAL.white : PAL.void4);
    }
    const R0 = r + 2.5;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const len = i % 2 ? R0 + 1 : R0 + 2.5;
      for (let d = R0; d <= len; d++) put(ox + Math.cos(a) * d, oy + Math.sin(a) * d, d > len - 1 ? PAL.void3 : d < R0 + 1 ? PAL.white : PAL.void4);
    }
  }
  if (o.star > 0) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const long = i % 2 === 0;
      const len = r + 1.5 + (long ? 7 : 3) * o.star;
      for (let d = r + 1.2; d <= len; d += 0.5) {
        const k = (d - r) / (len - r);
        put(ox + Math.cos(a) * d, oy + Math.sin(a) * d, k < 0.4 ? PAL.white : k < 0.75 ? PAL.void4 : PAL.void3);
      }
    }
  }
  if (o.flame > 0) {
    // a void flame licking up from the raised free hand
    const hx = o.bx + OX + o.dx;
    const hy = o.by + OY + o.bob - 2;
    const h = 3 + 6 * o.flame;
    const sway = Math.sin(o.t * TAU * 3) * 1.2;
    for (let y = Math.floor(hy - h); y <= hy; y++) {
      const v = (hy - y) / h;
      const cx = hx + sway * v * v;
      const hw = 2.3 * Math.sin(Math.PI * Math.min(1, 0.25 + v * 0.85)) * (1 - v * 0.55);
      for (let x = Math.floor(cx - hw); x <= cx + hw; x++) {
        const k = Math.abs(x + 0.5 - cx) / Math.max(0.5, hw);
        p.set(x, y, k < 0.4 && v < 0.55 ? PAL.white : k < 0.75 ? PAL.void4 : PAL.void3);
      }
    }
    put(hx + sway - 1, hy - h - 1.5, PAL.void3);
  }
  if (o.tendril > 0) {
    // special: the tendril's first span leaving the orb along the staff — a writhing void cord,
    // white-hot where it leaves, thinning to a void2 tail (the cinematic carries it to the target)
    const ux = Math.sin(o.sa);
    const uy = -Math.cos(o.sa);
    const len = 5 + 9 * o.tendril;
    const s0 = r + 0.5;
    for (let d = 0; d <= len; d += 0.5) {
      const k = d / len;
      const wob = Math.sin(d * 0.75 - o.t * TAU * 2) * 1.6 * k;
      const x = ox + ux * (s0 + d) - uy * wob;
      const y = oy + uy * (s0 + d) + ux * wob;
      const c = d < 2.5 ? PAL.white : k < 0.5 ? PAL.void4 : k < 0.82 ? PAL.void3 : PAL.void2;
      put(x, y, c);
      // a 2-px cord for most of its length (a dark void2 underside), thinning to 1 px at the tip
      if (k < 0.75) put(x - uy * 1, y + ux * 1, k < 0.25 ? PAL.void4 : PAL.void2);
    }
    if (o.tendril > 0.5) put(ox + ux * (s0 + len * 0.55) + uy * 2.5, oy + uy * (s0 + len * 0.55) - ux * 2.5, PAL.mag3);
  }
  if (o.gather > 0 && o.gather < 1) {
    // revive: dark motes spiralling in onto the body (a 2-px streak: void3 head, void1 tail)
    const gx = 40 + OX + o.dx;
    const gy = 56 + OY + o.bob + o.sink * 0.4;
    const N = 16;
    const at = (i: number, g: number): Pt => {
      const a = i * 2.39996 + (1 - g) * 2.4;
      const rr = (18 + (i % 4) * 5) * Math.pow(1 - g, 1.15) + 2;
      // a squashed spiral (the floor plane), kept off the frame edges
      return [clamp(gx + Math.cos(a) * rr * 1.25, 3, W - 4), clamp(gy + Math.sin(a) * rr * 0.6, 3, H - 4)];
    };
    for (let i = 0; i < N; i++) {
      const g = clamp(o.gather - (i % 3) * 0.05, 0, 1);
      if (g >= 0.97) continue;
      const [hx, hy] = at(i, g);
      const [tx, ty] = at(i, Math.max(0, g - 0.07));
      put(tx, ty, PAL.void1);
      put(hx, hy, i % 4 === 0 ? PAL.void4 : PAL.void3);
    }
  }
  if (o.ward > 0) {
    // ward: a 1-px shell of abyssal light in front of the body; a bright crest slides along it
    const cx = 40 + OX + o.dx + o.lean * BUST_K;
    const cy = 44 + OY + o.bob;
    const N = 150;
    const crestAt = ((o.t % 1) + 1) % 1;
    // a short shell in front of the chest and the staff (not a full arc: with the diagonal staff
    // a long one would read as a bow), dotted away from the crest, solid around it
    for (let i = 0; i <= N; i++) {
      const fr = i / N;
      const a = -0.55 + fr * 1.1;
      const x = cx + Math.cos(a) * 25;
      const y = cy - 2 + Math.sin(a) * 22;
      const dc = Math.abs(fr - crestAt) * 30;
      put(x, y, dc < 0.8 ? PAL.white : dc < 2.5 ? PAL.void4 : PAL.void3);
    }
  }
  if (o.eye > 1.5 && o.squint < 0.5) {
    // visor flare streaming forward (longer and whiter at a full roar)
    const [hx, hy] = headAnchor(o);
    const ey = hy + EYE.y;
    const n = o.eye > 2.2 ? 6 : 3;
    for (let i = 0; i < n; i++) {
      const x = hx + 18 + i;
      put(x, ey, i === 0 ? (n > 3 ? PAL.white : PAL.mag4) : i < n - 2 ? PAL.mag3 : PAL.mag2);
      if (n > 3 && i < 2) put(x, ey - 1, PAL.mag2);
    }
  }
}
