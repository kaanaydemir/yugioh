// Art Lab A — "Kristal Ejder": a cute, compact white crystal dragon (variant A, warm & cute).
//
// Drawn facing RIGHT, 1 art px = 1 game px. A frame is a POSE (numbers) rendered through the
// small layer rig in dragon-rig.ts; the head and face are hand-authored pixel maps
// (dragon-face.ts). Every animation frame is an explicitly keyed pose with its own hold time, so
// anticipation / strike / impact / recovery are different drawings, and squash & stretch is
// DRAWN (body radii, haunch squash, neck curve, lifted paws) — the sprite is never scaled or rotated.
//
// Design (after the reference): a compact chibi build sitting up like a pup — a big round haunch
// on the floor, the chest raised and turned toward the viewer on TWO thick foreleg pillars (the
// far one a tone darker, its paw 2 px higher), a short thick S-neck and a big domed head (~38 % of
// the height) with two gold horns, a brow ridge and a squared muzzle. The wings are real wings: a
// thin crystal bone (lit outer side, lavender underside) runs from the shoulder up and BACK along
// the leading edge to a gold knuckle, and cut-crystal panels hang below it (light facet, one
// diagonal facet line, mid facet, shaded trailing facet); the far wing only shows its tips above.
// Irregular hand-drawn crystal chips in clusters (spine, haunch, upper tail, foreleg, neck,
// forehead); big paws with three chunky navy-wrapped claws.
//
// Frame 130×118 (the game's dragon is 96×96). Measured over every frame of every anim the drawing
// occupies x 1..122, y 3..114: the idle pose alone is ~104×93 (wing tips level with the horns),
// the breath pose reaches the open jaws forward to x 122, the swept-back wing poses (breath,
// victory squash) reach x 1, the victory hop lifts the body 9 px with the wings raised. So this is
// about the smallest frame in which no pose is clipped; it is a bigger DRAWING SURFACE, not a
// higher resolution — 1 art pixel is still 1 game pixel.

import { PixelCanvas } from '../../art/pixel';
import type { DragonAnim, LabAnim, LabFramePoints, LabMonsterArt } from '../types';
import { A_INK, A_RAMPS } from './palette';
import { Layer, type Mat, type V2, addV, clamp, composite, lerp, lerpV, polar, registerColor, registerRamp, selectiveOutline, stampMap } from './dragon-rig';
import { EYES, EYE_BOX, FACE_KEY, HEAD_SIDE, HEAD_UP, MOUTHS, THROAT_GLOW, type HeadMaps, type Span } from './dragon-face';

const W = 130;
const H = 118;
const GY = 113; // last solid row of the planted soles (the claws)
const OY = GY - 105; // anatomy below is written for a ground row of 105
const OX = 6; // ... and 6 px of extra room on the left for the swept-back wing poses

const HIDE: readonly number[] = A_RAMPS.dragonHide;
const GLASS = A_RAMPS.crystal;
const LAV = A_RAMPS.lavender;
const GOLD = A_RAMPS.gold;
const SPOT = A_RAMPS.dragonSpot;
const EYE = A_RAMPS.dragonEye;
const BONE = A_RAMPS.bone;
const NAVY = A_INK.navy;

// selective outline colours: soft tinted line on lit edges, deep ink on the shadow side
registerRamp(HIDE, HIDE[1], NAVY);
registerRamp(GLASS, GLASS[3], GLASS[0]);
registerRamp(LAV, LAV[1], LAV[0]);
registerRamp(GOLD, GOLD[1], A_INK.warm);
registerRamp(SPOT, SPOT[0], NAVY);
registerRamp(EYE, NAVY, NAVY);
registerRamp(BONE, NAVY, NAVY);
registerRamp(A_RAMPS.mouth, NAVY, NAVY);
registerColor(NAVY, NAVY, NAVY);

const M = { HIDE: 0, HIDE_FAR: 1, GLASS: 2, LAV: 3, GLASS_FAR: 4, LAV_FAR: 5 } as const;
/** Hide bands: cream on the top planes, the lower part of every mass in lavender shadow. */
const HIDE_TH = [-2, -0.05, 0.32, 0.64, 0.95] as const;
const MATS: Mat[] = [];
MATS[M.HIDE] = { ramp: HIDE, th: HIDE_TH };
MATS[M.HIDE_FAR] = { ramp: HIDE, th: HIDE_TH, shift: -1 };
MATS[M.GLASS] = { ramp: GLASS };
MATS[M.LAV] = { ramp: LAV };
MATS[M.GLASS_FAR] = { ramp: GLASS, shift: -1 };
MATS[M.LAV_FAR] = { ramp: LAV, shift: -1 };

const newLayer = () => new Layer(W, H, MATS);

// ------------------------------------------------------------------ small hand stamps

const GEM_KEY: Record<string, number> = {
  '1': GLASS[1], '2': GLASS[2], '3': GLASS[3], '4': GLASS[4], '5': GLASS[5], l: LAV[2], L: LAV[3],
  e: GOLD[4], d: GOLD[3], c: GOLD[2], b: GOLD[1], N: NAVY,
};
/** Tail-tip crystal, pointing up (facets: light left, dark right, lavender core). */
const GEM_UP = [
  '....5....',
  '...545...',
  '...4432..',
  '..54432..',
  '..44L32..',
  '.544L322.',
  '.44LL322.',
  '.44Ll322.',
  '..4Ll22..',
  '..44l22..',
  '...432...',
  '...432...',
  '....2....',
];
/** Gold knuckle (with a small thumb claw) where the wing panels converge at the wrist. */
const KNUCKLE = ['..e.', '.ed.', 'eddb', 'dccb', '.bb.'];
const KNUCKLE_FAR = ['.c.', 'cbb', '.b.'];

const SPOT_KEY: Record<string, number> = { S: SPOT[0], T: SPOT[1], U: SPOT[2], V: SPOT[3] };
const SPOT_GLOW_KEY: Record<string, number> = { S: SPOT[2], T: SPOT[3], U: GLASS[5], V: GLASS[5] };
/**
 * Hand-drawn crystal patches, every one a different asymmetric chip: a SPOT[1] body (T), a lit
 * facet on the top-left (V, with U as its mid step) and a 1-px SPOT[0] lower edge (S). They are
 * set in small clusters (spine, haunch, upper tail, outer foreleg, neck), shrinking toward the
 * tail, and no two neighbours share a shape.
 */
const PATCHES = {
  /** 7×5 broad chip */
  a: ['.VV....', 'VVUTT..', '.UTTTT.', '..TTTSS', '...SS..'],
  /** 6×6 slanted shard */
  b: ['...VU.', '..VUT.', '.VUTTS', 'VUTTS.', '.TTS..', '..S...'],
  /** 5×4 */
  c: ['.VU..', 'VUTT.', '.TTTS', '..SS.'],
  /** 4×4 */
  d: ['..V.', '.VUT', 'VTTS', '.SS.'],
  /** 3×3 */
  e: ['VU.', 'UTS', '.S.'],
  /** 3×2 */
  g: ['VUT', '.TS'],
  /** 2×2 fleck */
  f: ['VT', 'TS'],
};

/** Claw key: t lit edge, c body, C shaded tip side. */
const CLAW_KEY: Record<string, number> = { t: BONE[4], c: BONE[3], C: BONE[2] };
const CLAW_FAR_KEY: Record<string, number> = { t: BONE[3], c: BONE[2], C: BONE[1] };

// ------------------------------------------------------------------ pose

type EyeKind = keyof typeof EYES;
type MouthKind = keyof typeof MOUTHS;

interface Pose {
  /** whole-sprite offset (hops / floating); the feet move with it */
  lift: V2;
  /** rear body and chest offsets (planted feet stay where they are) */
  hip: V2;
  chest: V2;
  /** drawn squash of the torso: + flatter & wider, − taller & narrower */
  sq: number;
  /** extra squash of the haunch alone (anticipation: weight sinks onto the hind legs) */
  haunch: number;
  /** head socket offset from rest, head angle and face */
  head: V2;
  headKind: 'side' | 'up';
  eyes: EyeKind;
  mouth: MouthKind;
  /** throat glow while breathing crystal (-1 none, else THROAT_GLOW index) */
  throat: number;
  /** S-curve of the neck: + coiled (lower neck forward, upper neck back), − straightened */
  neckBend: number;
  /** near wing: arm angle (deg, screen; −90 = up), elbow bend, panel droop, panel fan, length */
  wing: number;
  elbow: number;
  drape: number;
  fan: number;
  span: number;
  farWing: number;
  farElbow: number;
  farDrape: number;
  farFan: number;
  farSpan: number;
  /** idle wing breath as whole-pixel panel offsets (+ raised, − lowered); no re-rotation */
  nudge: number;
  farNudge: number;
  /** near shoulder (and wing root) raised by this many px (hit recoil) */
  shoulderUp: number;
  /** the near wing is drawn in front of the head (cocoon) */
  wingFront: boolean;
  /** tail sway (+ tip up) and tuck (0..1, tail wrapped close to the body) */
  tail: number;
  tailTuck: number;
  /** legs pulled up under the body (0 planted .. 1 tucked) — only while airborne */
  legTuck: number;
  /** near front paw offset (lifted / stepped); [0, 0] = planted */
  paw: V2;
  /** crystal spots light up */
  glow: boolean;
  /** summon build-up before the cocoon exists: 1 converging shards, 2 half-formed pod */
  seed: 0 | 1 | 2;
}

const REST: Pose = {
  lift: [0, 0],
  hip: [0, 0],
  chest: [0, 0],
  sq: 0,
  haunch: 0,
  head: [0, 0],
  headKind: 'side',
  eyes: 'open',
  mouth: 'smile',
  throat: -1,
  neckBend: 2.6,
  wing: -100,
  elbow: -34,
  drape: 0,
  fan: 1,
  span: 1,
  farWing: -92,
  farElbow: -34,
  farDrape: 0,
  farFan: 0.7,
  farSpan: 0.9,
  nudge: 0,
  farNudge: 0,
  shoulderUp: 0,
  wingFront: false,
  tail: 0,
  tailTuck: 0,
  legTuck: 0,
  paw: [0, 0],
  glow: false,
  seed: 0,
};

// rest anatomy (frame px)
const HIP0: V2 = [52 + OX, 90 + OY];
const CHEST0: V2 = [72 + OX, 79 + OY];
const SOCKET0: V2 = [79 + OX, 58 + OY];
const PAW_NEAR: V2 = [76 + OX, GY];
const PAW_FAR: V2 = [87 + OX, GY - 2];
const FOOT_NEAR: V2 = [59 + OX, GY];
const FOOT_FAR: V2 = [44 + OX, GY - 2];

// ------------------------------------------------------------------ helpers

function spans(p: PixelCanvas, s: readonly Span[], ox: number, oy: number): void {
  for (const [y, x, t] of s) stampMap(p, [t], FACE_KEY, x + ox, y + oy);
}

/** Stamp rows centred on `at`, only over pixels already opaque in `p` (mask). */
function patch(p: PixelCanvas, rows: readonly string[], key: Record<string, number>, at: V2, mask = true): void {
  stampMap(p, rows, key, Math.round(at[0] - rows[0].length / 2), Math.round(at[1] - rows.length / 2), mask ? p : undefined);
}

function spot(p: PixelCanvas, kind: keyof typeof PATCHES, at: V2, glow: boolean): void {
  patch(p, PATCHES[kind], glow ? SPOT_GLOW_KEY : SPOT_KEY, at);
}

/** 1-px line (Bresenham) in one colour, optionally only over opaque pixels. */
function line(p: PixelCanvas, a: V2, b: V2, c: number, mask = true): void {
  let x0 = Math.round(a[0]);
  let y0 = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (!mask || p.isOpaque(x0, y0)) p.set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** Darken (one step down its ramp) every pixel of `p` inside the given runs [row, x0, x1]. */
function shadeRuns(p: PixelCanvas, runs: readonly (readonly [number, number, number])[], to: number): void {
  for (const [y, x0, x1] of runs)
    for (let x = x0; x <= x1; x++) {
      const c = p.get(x, y);
      if (c === null) continue;
      const i = HIDE.indexOf(c);
      if (i > to) p.set(x, y, HIDE[to]);
    }
}

/** 4-connected line (every diagonal step gets an extra pixel), so a deliberate 1-px line never
 *  breaks into diagonal single pixels; optionally only over opaque pixels. */
function line4(p: PixelCanvas, a: V2, b: V2, c: number, mask = true): void {
  let x = Math.round(a[0]);
  let y = Math.round(a[1]);
  const x1 = Math.round(b[0]);
  const y1 = Math.round(b[1]);
  const dx = Math.abs(x1 - x);
  const dy = Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx - dy;
  const put = () => {
    if (!mask || p.isOpaque(x, y)) p.set(x, y, c);
  };
  put();
  while (x !== x1 || y !== y1) {
    if (2 * err > -dy && (dx >= dy || 2 * err >= dx)) {
      err -= dy;
      x += sx;
    } else {
      err += dx;
      y += sy;
    }
    put();
  }
}

/** A copy of `c` moved by a whole-pixel offset (panels are translated, never re-rotated). */
function shifted(c: PixelCanvas, dx: number, dy: number): PixelCanvas {
  if (!dx && !dy) return c;
  const o = new PixelCanvas(c.w, c.h);
  o.blit(c, dx, dy);
  return o;
}

/**
 * Wing-layer clean-up (never used on the face, eyes or claws): any same-colour fragment of one or
 * two pixels (8-connected) is absorbed into its most common neighbouring colour. Deliberate lines
 * (facet lines, seams, the bone) are longer than that and survive.
 */
function denoise(p: PixelCanvas): void {
  const { w, h } = p;
  const seen = new Uint8Array(w * h);
  const changes: [number, number, number][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i0 = y * w + x;
      if (seen[i0]) continue;
      const c = p.get(x, y);
      if (c === null) continue;
      // flood the 8-connected component of this colour (stop counting past 3)
      const comp: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[i0] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        comp.push([cx, cy]);
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (seen[j] || p.get(nx, ny) !== c) continue;
            seen[j] = 1;
            stack.push([nx, ny]);
          }
      }
      if (comp.length > 2) continue;
      for (const [cx, cy] of comp) {
        const counts = new Map<number, number>();
        let n = 0;
        for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const v = p.get(cx + ox, cy + oy);
          if (v === null) continue;
          n++;
          if (v !== c) counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        if (n < 4) continue; // edge pixels stay (the outline needs them)
        let best = c;
        let bc = 0;
        for (const [v, k] of counts) if (k > bc) [best, bc] = [v, k];
        changes.push([cx, cy, best]);
      }
    }
  for (const [x, y, c] of changes) p.set(x, y, c);
}

/** Paint a thin bone (capsule chain) with a lit outer side and a darker inner side. */
function bone(p: PixelCanvas, pts: readonly V2[], r0: number, r1: number, outer: V2, lit: number, under: number): void {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  let acc = 0;
  const xs = pts.map((q) => q[0]);
  const ys = pts.map((q) => q[1]);
  const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(...ys) - R); y <= Math.ceil(Math.max(...ys) + R); y++)
    for (let x = Math.floor(Math.min(...xs) - R); x <= Math.ceil(Math.max(...xs) + R); x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let best = Infinity;
      let side = 0;
      let rr = r0;
      acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const vx = bx - ax;
        const vy = by - ay;
        const L2 = vx * vx + vy * vy || 1;
        const t = clamp(((cx - ax) * vx + (cy - ay) * vy) / L2, 0, 1);
        const px = ax + vx * t - cx;
        const py = ay + vy * t - cy;
        const d = Math.hypot(px, py);
        const segLen = Math.sqrt(L2);
        if (d < best) {
          best = d;
          side = -(px * outer[0] + py * outer[1]);
          rr = lerp(r0, r1, (acc + segLen * t) / (total || 1));
        }
        acc += segLen;
      }
      if (best > rr) continue;
      p.set(x, y, side > 0.2 ? lit : under);
    }
}

// ------------------------------------------------------------------ wings

interface WingSpec {
  sh: V2;
  /** idle nudge: whole-pixel panel offsets (+1 raised, −1 lowered) instead of a re-rotation */
  nudge?: number;
  /** draw the shoulder mass over the panel roots (not while the wing is wrapped in front) */
  root?: boolean;
  wing: number;
  elbow: number;
  drape: number;
  fan: number;
  span: number;
  far: boolean;
}

interface WingGeo {
  elbow: V2;
  wrist: V2;
}

/** Crystal panels, rooted along the whole arm (0 = shoulder, 1 = wrist), nearly parallel: the
 *  top one continues past the wrist, each lower one is shorter and turns 14° (× fan) further back,
 *  so the cut panels stack like layered feathers. */
const PANELS = [
  { at: 1.0, len: 44, wid: 16 },
  { at: 0.78, len: 38, wid: 17 },
  { at: 0.56, len: 32, wid: 16 },
  { at: 0.36, len: 26, wid: 14 },
  { at: 0.18, len: 19, wid: 12 },
] as const;

/**
 * The arm: the humerus rises up and BACK from the shoulder (wing − 20°, i.e. −120° at rest), the
 * forearm carries on at wing + 3° + elbow (−131° at rest) to the wrist, so the bone runs along
 * the top (leading) edge of the wing instead of standing up like a raised leg.
 */
function wingGeo(w: WingSpec): WingGeo & { fore: number; at: (t: number) => V2 } {
  const a1 = w.wing - 20;
  const elbow = addV(w.sh, polar(a1, 13));
  const fore = w.wing + 3 + w.elbow;
  const wrist = addV(elbow, polar(fore, 17));
  const at = (t: number): V2 => (t * 30 <= 13 ? lerpV(w.sh, elbow, (t * 30) / 13) : lerpV(elbow, wrist, (t * 30 - 13) / 17));
  return { elbow, wrist, fore, at };
}

/** Whole-pixel offset of a panel rooted at `t` along the arm for an idle nudge (+1 raised). */
function nudgeOff(nudge: number, t: number): V2 {
  const k = clamp(t + 0.2, 0, 1);
  return [Math.round(nudge * k), Math.round(-2 * nudge * k)];
}

/**
 * One wing, painted onto `p`: five cut-crystal panels hanging from the arm (each split by one
 * diagonal facet line into a light facet and a mid facet, a deeper root, a 1-px glint at the tip;
 * lower panels overlap the ones above), then the thin crystal bone along the leading edge with a
 * gold knuckle at the apex, and — near wing only — the shoulder mass over all the panel roots.
 * The idle `nudge` moves panels by whole pixels (stable facets, no re-rasterised veins).
 */
function paintWing(p: PixelCanvas, w: WingSpec, seamCast = false): void {
  const glass = w.far ? M.GLASS_FAR : M.GLASS;
  const lav = w.far ? M.LAV_FAR : M.LAV;
  const { elbow, wrist, fore, at } = wingGeo(w);
  const nudge = w.nudge ?? 0;
  const facetCol = w.far ? GLASS[0] : GLASS[1];
  const wc = new PixelCanvas(W, H);
  PANELS.forEach((pn, i) => {
    const L = newLayer();
    const deg = fore - 4 + w.drape - i * 14 * w.fan;
    const u = polar(deg, 1);
    // the leading edge: the side continuing the arm (up for a panel pointing left); a reversed fan
    // (panels swept the other way, as in the cocoon) mirrors it
    const n: V2 = w.fan >= 0 ? [-u[1], u[0]] : [u[1], -u[0]];
    const len = pn.len * w.span;
    const hw = pn.wid / 2;
    // the panel hangs BELOW the arm: its leading edge runs just under the bone
    const b = addV(at(pn.at), [-n[0] * hw * 0.72, -n[1] * hw * 0.72]);
    const P = (along: number, side: number): V2 => [b[0] + u[0] * along + n[0] * side, b[1] + u[1] * along + n[1] * side];
    // cut outline: rounded shoulders, widest at ~40 %, a pointed tip
    const lead = [P(-1, hw * 0.35), P(len * 0.16, hw * 0.82), P(len * 0.4, hw), P(len * 0.68, hw * 0.74), P(len * 0.88, hw * 0.34)];
    const trail = [P(len * 0.86, -hw * 0.3), P(len * 0.66, -hw * 0.7), P(len * 0.42, -hw * 0.92), P(len * 0.18, -hw * 0.78), P(-1, -hw * 0.3)];
    const tip = P(len, 0);
    // each panel shows mostly its leading half (the next panel covers the rest), so the cuts sit
    // there: a light facet along the leading edge, one diagonal facet line, the mid facet, and a
    // shaded facet along the trailing edge (lavender on the lower panels)
    const d0 = P(len * 0.04, hw * 0.05);
    const d1 = P(len * 0.95, hw * 0.12);
    L.poly([...lead, tip, ...trail], glass, 2, 1);
    L.poly([P(len * 0.1, -hw * 0.3), P(len * 0.5, -hw * 0.35), P(len * 0.86, -hw * 0.3), P(len * 0.66, -hw * 0.7), P(len * 0.42, -hw * 0.92), P(len * 0.18, -hw * 0.78)], i >= 2 ? lav : glass, 2, 1.1);
    L.poly([...lead, tip, d1, P(len * 0.5, hw * 0.42), d0], glass, 4, 1.2);
    // deeper root: crystal shade, a lavender core
    L.poly([P(-1, hw * 0.35), P(len * 0.12, hw * 0.75), P(len * 0.18, -hw * 0.8), P(-1, -hw * 0.3)], glass, 2, 1.5);
    L.poly([P(-1, hw * 0.25), P(len * 0.07, hw * 0.35), P(len * 0.09, -hw * 0.55), P(-1, -hw * 0.25)], lav, 2, 1.6);
    const c = L.render();
    line4(c, P(len * 0.14, hw * 0.12), P(len * 0.5, hw * 0.38), facetCol);
    line4(c, P(len * 0.5, hw * 0.38), d1, facetCol);
    // a 1-2 px glint at the tip
    const g1 = P(len - 2.5, hw * 0.1);
    if (c.isOpaque(Math.round(g1[0]), Math.round(g1[1]))) c.set(Math.round(g1[0]), Math.round(g1[1]), GLASS[5]);
    const off = nudgeOff(nudge, pn.at);
    composite(wc, shifted(c, off[0], off[1]), 1, 2);
  });
  denoise(wc);
  // the bone along the leading edge: lit crystal on the outer side, lavender underside
  const wOff = nudgeOff(nudge, 1);
  const eOff = nudgeOff(nudge, 0.45);
  const elb = addV(elbow, eOff);
  const wri = addV(wrist, wOff);
  const u0 = polar(fore, 1);
  const outer: V2 = w.fan >= 0 ? [-u0[1], u0[0]] : [u0[1], -u0[0]];
  if (!w.far) bone(wc, [w.sh, elb, wri], 1.5, 1.05, outer, GLASS[4], LAV[2]);
  patch(wc, w.far ? KNUCKLE_FAR : KNUCKLE, GEM_KEY, addV(wri, polar(fore, 1)), false);
  composite(p, wc, 1, 0, seamCast ? { dx: 1, dy: 2 } : undefined);
  if (!w.far && w.root !== false) {
    // the shoulder: one hide mass over every panel root; it melts into the back (no seam on hide),
    // only the crystal around it gets a contact line
    const S = newLayer();
    S.ellipsoid(w.sh[0] + 0.5, w.sh[1] + 2.5, 5.5, 3.2, M.HIDE, 0, 0.1);
    composite(p, S.render(), 1, 1, undefined, (c) => !HIDE.includes(c));
  }
}

// ------------------------------------------------------------------ summon seed (before the cocoon)

/** Crystal shards converging over the summon circle (seed 1) or a half-formed pod (seed 2). */
function paintSeed(p: PixelCanvas, kind: 1 | 2, glow: boolean): void {
  const c: V2 = [62 + OX, 72 + OY];
  const L = newLayer();
  let z = 0;
  /** A leaf shard from `at` along `deg`: lit half (tone + 1) on the left of its direction (later shards in front). */
  const shard = (at: V2, deg: number, len: number, wid: number, tone: number, lav = false) => {
    const u = polar(deg, 1);
    const n: V2 = [u[1], -u[0]];
    const P = (a: number, sd: number): V2 => [at[0] + u[0] * a + n[0] * sd, at[1] + u[1] * a + n[1] * sd];
    L.poly([P(0, 0), P(len * 0.4, wid / 2), P(len, 0), P(len * 0.45, -wid / 2)], lav ? M.LAV : M.GLASS, tone, 20 + z);
    L.poly([P(0, 0), P(len * 0.4, wid / 2), P(len, 0)], M.GLASS, tone + 1, 20.2 + z);
    z += 1;
  };
  if (kind === 1) {
    // five shards falling in toward one point (a ~14×16 cluster)
    shard([c[0] - 7, c[1] - 7], 45, 8, 4, 3);
    shard([c[0] + 7, c[1] - 8], 125, 8, 4, 3);
    shard([c[0] - 8, c[1] + 4], -20, 7, 4, 2);
    shard([c[0], c[1] - 9], 90, 7, 4, 3);
    shard([c[0] + 7, c[1] + 4], 200, 6, 3, 2);
  } else {
    // a half-formed pod: a lavender core and shards closing over it from the top (~32×30)
    L.ellipsoid(c[0], c[1] + 4, 7, 6, M.LAV, 0, 0.6);
    const top: V2 = [c[0], c[1] - 12];
    shard([c[0] - 3, c[1] - 9], 150, 13, 8, 2, true);
    shard([c[0] + 3, c[1] - 9], 30, 13, 8, 2, true);
    shard(top, 55, 24, 10, 3);
    shard(top, 125, 24, 10, 3);
    shard([top[0] - 1, top[1] + 1], 78, 27, 11, 3);
    shard([top[0] + 1, top[1] + 1], 102, 26, 11, 2);
  }
  const g = L.render();
  if (glow) for (const [x, y] of [[c[0], c[1] - 1], [c[0] + 1, c[1]], [c[0] - 1, c[1]], [c[0], c[1]]] as const) if (g.isOpaque(x, y)) g.set(x, y, GLASS[5]);
  composite(p, g);
}

// ------------------------------------------------------------------ the body

interface Geo {
  hip: V2;
  chest: V2;
  socket: V2;
  headOrigin: V2;
  headMap: HeadMaps;
  shoulder: V2;
}

function geometry(ps: Pose): Geo {
  const L0 = ps.lift;
  const at = (v: V2, d: V2 = [0, 0]): V2 => [Math.round(v[0] + d[0] + L0[0]), Math.round(v[1] + d[1] + L0[1])];
  const socket = at(SOCKET0, addV(ps.head, ps.chest));
  const headMap = ps.headKind === 'up' ? HEAD_UP : HEAD_SIDE;
  const chest = at(CHEST0, ps.chest);
  return {
    hip: at(HIP0, ps.hip),
    chest,
    socket,
    headMap,
    headOrigin: [socket[0] - headMap.socket[0], socket[1] - headMap.socket[1]],
    shoulder: [chest[0] - 14, chest[1] - 6],
  };
}

/**
 * Toes of a paw whose sole (the claws' bottom row) is paw.y: `n` chunky claws, each 2 px wide and
 * 3 px tall (lit BONE edge, ivory body, a shaded tip), hanging off the front of the toe mass with a
 * 1-px gap between them. The gaps are opened down to the sole so the outline wraps every claw in
 * navy; a short hide crease runs up between the toes.
 */
function toes(p: PixelCanvas, paw: V2, n: number, far: boolean): void {
  const y = Math.round(paw[1]);
  const front = Math.round(paw[0]) + (n === 3 ? 4 : 3);
  const key = far ? CLAW_FAR_KEY : CLAW_KEY;
  const crease = far ? HIDE[1] : HIDE[2];
  for (let i = 0; i < n; i++) {
    const x = front - i * 3;
    stampMap(p, ['tc', 'tc', 'cC'], key, x, y - 2);
    if (i < n - 1) {
      p.erase(x - 1, y);
      p.erase(x - 1, y - 1);
      for (const yy of [y - 2, y - 3]) if (p.isOpaque(x - 1, yy)) p.set(x - 1, yy, crease);
    }
  }
}

function drawPose(p: PixelCanvas, ps: Pose): void {
  if (ps.seed) {
    paintSeed(p, ps.seed, ps.glow);
    selectiveOutline(p, GY + 1, NAVY);
    return;
  }
  const L0 = ps.lift;
  const g = geometry(ps);
  const { hip, chest, socket, shoulder } = g;
  const at = (v: V2): V2 => [Math.round(v[0] + L0[0]), Math.round(v[1] + L0[1])];
  const sq = ps.sq;
  const tuck = (planted: V2, body: V2): V2 => {
    const a = at(planted);
    return [Math.round(a[0] + (body[0] - a[0]) * ps.legTuck * 0.35), Math.round(a[1] + (body[1] - a[1]) * ps.legTuck * 0.6)];
  };
  const ground = GY + L0[1];

  // far wing (behind everything): rooted just behind the near shoulder and a little steeper, so
  // only its tips rise above the near wing — its arm stays hidden (at most its knuckle shows)
  paintWing(p, { sh: addV(shoulder, [-4, -1]), nudge: ps.farNudge, wing: ps.farWing + 4, elbow: ps.farElbow, drape: ps.farDrape, fan: ps.farFan, span: ps.farSpan, far: true });

  // tail: from the hip, back along the ground, curling up into a crystal tip
  const tb: V2 = [hip[0] - 13, hip[1] + 3];
  const s = ps.tail;
  const k = 1 - ps.tailTuck * 0.45;
  const rel: V2[] = [[0, 0], [-9, 6], [-18, 7 - s], [-25, 3 - s * 2], [-28, -3 - s * 3]];
  const tailPath: V2[] = rel.map(([x, y]) => [tb[0] + x * k + ps.tailTuck * 3, tb[1] + y * k - ps.tailTuck * 2 * (x / -28)]);
  const tail = newLayer();
  tail.tube(tailPath, 7.5, 3, M.HIDE);
  const tailC = tail.render();
  // crystal chips along the top of the tail, shrinking toward the tip
  spot(tailC, 'd', addV(lerpV(tailPath[0], tailPath[1], 0.2), [0, -4]), ps.glow);
  spot(tailC, 'g', addV(lerpV(tailPath[1], tailPath[2], 0.25), [0, -3]), ps.glow);
  spot(tailC, 'f', addV(lerpV(tailPath[2], tailPath[3], 0.45), [1, -2]), ps.glow);
  const tip = tailPath[4];
  stampMap(tailC, GEM_UP, GEM_KEY, Math.round(tip[0]) - 4, Math.round(tip[1]) - 11);
  composite(p, tailC);

  // far legs (one tone darker; the far forefoot stands 2 px higher = further away)
  const far = newLayer();
  const pawF = tuck(PAW_FAR, [chest[0] + 6, chest[1] + 8]);
  far.tube([[chest[0] + 7, chest[1] + 2], [chest[0] + 9, chest[1] + 10], [pawF[0] - 2, pawF[1] - 5]], 5, 4.5, M.HIDE_FAR);
  far.ellipsoid(pawF[0], pawF[1] - 2.5, 5.5, 3, M.HIDE_FAR, 2);
  const footF = tuck(FOOT_FAR, [hip[0] - 8, hip[1] + 8]);
  far.ellipsoid(footF[0], footF[1] - 2.5, 6, 3, M.HIDE_FAR, 2);
  const farC = far.render();
  toes(farC, pawF, 2, true);
  toes(farC, footF, 2, true);
  composite(p, farC);

  // body: rump (hip), belly (anchored to the hip so a breathing chest never re-samples it), and a
  // broad chest turned toward the viewer (flatter bulge = a wide lit front)
  const body = newLayer();
  body.ellipsoid(hip[0], hip[1], 15.5 + sq, 12.5 - sq * 0.6, M.HIDE);
  body.ellipsoid(hip[0] + 10.5, hip[1] - 3.5, 11.5, 11, M.HIDE, 0.5);
  body.ellipsoid(chest[0], chest[1], 13 + sq * 0.5, 13 - sq * 0.6, M.HIDE, 1, 0.06, 0.8);
  const bodyC = body.render();
  // occlusion: under the chest, where the belly meets the haunch
  shadeRuns(bodyC, [
    [chest[1] + 9, chest[0] - 12, chest[0] - 4],
    [chest[1] + 10, chest[0] - 13, chest[0] - 5],
    [chest[1] + 11, chest[0] - 13, chest[0] - 6],
  ], 1);
  // spine cluster above the haunch
  spot(bodyC, 'a', [hip[0] + 6, hip[1] - 10], ps.glow);
  spot(bodyC, 'e', [hip[0] - 2, hip[1] - 9], ps.glow);
  spot(bodyC, 'f', [hip[0] + 12, hip[1] - 13], ps.glow);
  composite(p, bodyC);

  // near hind leg: big round haunch with its foot
  const legs = newLayer();
  const hq = ps.haunch;
  const haunch: V2 = [hip[0] - 3, hip[1] + 5 + hq * 0.5];
  legs.ellipsoid(haunch[0], haunch[1], 10.5 + hq * 0.6, 9.5 - sq * 0.3 - hq * 0.5, M.HIDE, 4, 0.05);
  const footN = tuck(FOOT_NEAR, [haunch[0] + 4, haunch[1] + 4]);
  legs.ellipsoid(footN[0], footN[1] - 2.5, 7.5, 3, M.HIDE, 3);
  const legsC = legs.render();
  // occlusion where the haunch meets the belly (a lavender crescent at its front edge)
  shadeRuns(legsC, [
    [haunch[1] - 6, haunch[0] + 8, haunch[0] + 9],
    [haunch[1] - 5, haunch[0] + 9, haunch[0] + 10],
    [haunch[1] - 4, haunch[0] + 9, haunch[0] + 10],
    [haunch[1] - 3, haunch[0] + 9, haunch[0] + 10],
  ], 2);
  spot(legsC, 'b', [haunch[0] - 2, haunch[1] - 5], ps.glow);
  spot(legsC, 'c', [haunch[0] - 8, haunch[1] + 1], ps.glow);
  spot(legsC, 'f', [haunch[0] + 3, haunch[1] + 1], ps.glow);
  toes(legsC, footN, 3, false);
  composite(p, legsC, 1, 2, { dx: 1, dy: 1 });

  // near foreleg: a thick pillar (10 px) dropping from the chest with an elbow bulge at the back,
  // its own layer so a contact line separates it from the chest and the far leg
  const fore = newLayer();
  const pawN0 = tuck(PAW_NEAR, [chest[0] - 1, chest[1] + 10]);
  const pawN: V2 = [pawN0[0] + ps.paw[0], pawN0[1] + ps.paw[1]];
  const elbowN: V2 = [chest[0] - 5 + ps.paw[0] * 0.3, chest[1] + 8 + ps.paw[1] * 0.4];
  fore.tube([[chest[0] - 1, chest[1] + 1], [chest[0] - 2, chest[1] + 9], [pawN[0] - 2, pawN[1] - 7], [pawN[0] - 1, pawN[1] - 3]], 5.3, 4.7, M.HIDE, 4, 0.05);
  fore.ellipsoid(elbowN[0], elbowN[1], 4.2, 4.6, M.HIDE, 3.5, 0.02);
  fore.ellipsoid(pawN[0], pawN[1] - 2.5, 6.2, 3.2, M.HIDE, 5);
  const foreC = fore.render();
  spot(foreC, 'g', [elbowN[0] - 1, elbowN[1] - 1], ps.glow);
  spot(foreC, 'f', [pawN[0] - 4, pawN[1] - 9], ps.glow);
  toes(foreC, pawN, 3, false);
  composite(p, foreC, 1, 2, { dx: 1, dy: 1 });

  // neck: base on the chest, top in the head socket; a SHORT, thick S-curve (lower neck bulges
  // forward, the throat bows back) of constant thickness — reach comes from straightening it,
  // never from thinning it
  const neck = newLayer();
  const nb: V2 = [chest[0] + 2, chest[1] - 7];
  const top: V2 = [socket[0] - 1, socket[1] + 1];
  const d: V2 = [top[0] - nb[0], top[1] - nb[1]];
  const len = Math.hypot(d[0], d[1]) || 1;
  const perp: V2 = [-d[1] / len, d[0] / len]; // points forward (right) for an upward neck
  const b = ps.neckBend;
  const m1: V2 = [lerp(nb[0], top[0], 0.33) + perp[0] * b * 0.8, lerp(nb[1], top[1], 0.33) + perp[1] * b * 0.8];
  const m2: V2 = [lerp(nb[0], top[0], 0.7) - perp[0] * b * 0.7, lerp(nb[1], top[1], 0.7) - perp[1] * b * 0.7];
  neck.tube([nb, m1, m2, top], 9.5, 8.5, M.HIDE);
  const neckC = neck.render();
  spot(neckC, 'e', [m1[0] - 7, m1[1] - 2], ps.glow);
  spot(neckC, 'f', [m1[0] - 5, m1[1] + 3], ps.glow);
  // occlusion where the neck meets the chest (front)
  shadeRuns(neckC, [
    [nb[1] + 2, nb[0] + 4, nb[0] + 8],
    [nb[1] + 3, nb[0] + 3, nb[0] + 8],
  ], 2);
  composite(p, neckC, 0, 1, { dx: 0, dy: 2 });

  const nearWing = () => paintWing(p, { sh: addV(shoulder, [0, -ps.shoulderUp]), nudge: ps.nudge, root: !ps.wingFront, wing: ps.wing, elbow: ps.elbow, drape: ps.drape, fan: ps.fan, span: ps.span, far: false }, true);
  if (!ps.wingFront) nearWing();
  drawHead(p, g.headMap, g.headOrigin[0], g.headOrigin[1], ps);
  if (ps.wingFront) nearWing();

  // flat ground contact: nothing reaches below the sole row
  for (let y = ground + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  selectiveOutline(p, ground + 1, NAVY);
}

function drawHead(p: PixelCanvas, h: HeadMaps, ox: number, oy: number, ps: Pose): void {
  const back = new PixelCanvas(W, H);
  spans(back, h.back, ox, oy);
  composite(p, back);
  const skull = new PixelCanvas(W, H);
  spans(skull, h.skull, ox, oy);
  if (h === HEAD_SIDE) spans(skull, MOUTHS[ps.mouth], ox, oy);
  else if (ps.throat >= 0) spans(skull, THROAT_GLOW[ps.throat % THROAT_GLOW.length], ox, oy);
  stampMap(skull, EYES[ps.eyes], FACE_KEY, EYE_BOX[0] + ox, EYE_BOX[1] + oy);
  composite(p, skull, 1, 2, { dx: 1, dy: 2 });
  const front = new PixelCanvas(W, H);
  spans(front, h.front, ox, oy);
  composite(p, front);
}

// ------------------------------------------------------------------ animation keys

type Key = Partial<Pose>;

interface AnimDef {
  keys: Key[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

// idle: breathing (chest), head following a beat later, wings lagging the breath, a slow tail
// sway on its own period and one blink. Frame 0 is the neutral pose every other anim returns to.
const IDLE_CHEST = [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0, 0, 0];
const IDLE_HEAD = [0, 0, 0, -1, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0];
// wings: a whole-pixel breath (the panels are translated, never re-rotated, so their facets stay
// put): raised over the in-breath, lowered after it, lagging the chest by two frames; the far
// wing follows one frame later
const IDLE_NUDGE = [0, 0, 0, 0, 1, 1, 2, 2, 1, 1, 0, -1, -1, 0];
const IDLE_TAIL = [0, 0.4, 0.4, 0.6, 1, 1, 1, 0.5, 0, 0, -0.5, -1, -1, -0.5];
const IDLE_EYES: EyeKind[] = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'closed', 'half', 'open'];

const DEFS: Record<DragonAnim, AnimDef> = {
  idle: {
    loop: true,
    durations: [150, 120, 120, 130, 140, 170, 140, 120, 120, 120, 60, 80, 60, 150],
    keys: IDLE_CHEST.map((c, f) => ({
      chest: [0, c],
      head: [0, IDLE_HEAD[f] - c],
      nudge: IDLE_NUDGE[f],
      farNudge: IDLE_NUDGE[(f + 13) % 14],
      tail: IDLE_TAIL[f],
      eyes: IDLE_EYES[f],
    })),
  },

  // hit: the wizard's bolt lands on frame 1 — the whole torso recoils (chest 5 px back onto the
  // squashed haunch, near shoulder up 1 px), the head snaps back with eyes squeezed and the near
  // front paw comes off the floor; the wings already flare on f1 and peak on f2 (tail too), a
  // stagger, the wings overshoot down on f5, head shake. The feet that stay down never move.
  hit: {
    loop: false,
    marks: { impact: 1, recover: 3 },
    durations: [50, 170, 110, 90, 90, 110, 70, 70, 140],
    keys: [
      { eyes: 'open' },
      { head: [-3, -3], headKind: 'up', eyes: 'squeeze', chest: [-5, 1], hip: [-2, 0], shoulderUp: 1, sq: 1, haunch: 1, neckBend: 3.6, paw: [-3, -4], wing: -94, fan: 1.1, farWing: -86, farFan: 0.8, tail: 0.3 },
      { head: [-3, 0], eyes: 'squeeze', mouth: 'grit', chest: [-4, 2], hip: [-2, 1], shoulderUp: 1, sq: 1, haunch: 1.5, neckBend: 3.2, paw: [-2, -3], wing: -86, fan: 1.22, farWing: -80, farFan: 0.9, tail: 1.6 },
      { head: [-2, 1], eyes: 'half', chest: [-1, 1], sq: 0.5, haunch: 0.5, neckBend: 3, paw: [-1, -1], wing: -93, fan: 1.1, farWing: -86, tail: 1.4 },
      { head: [1, 0], eyes: 'open', chest: [1, 0], wing: -102, fan: 1.0, farWing: -93, tail: 0.4 },
      { head: [0, 0], wing: -107, fan: 0.96, farWing: -98, tail: -0.6 },
      { head: [1, 0], eyes: 'closed', wing: -104, farWing: -95, tail: -0.3 },
      { head: [-1, 0], eyes: 'closed', wing: -101, tail: 0.1 },
      {},
    ],
  },

  // attack (crystal breath): the weight sinks back onto the squashed haunch, chest down and back,
  // head pulled in while the spots light up; snap — the near forepaw lifts and stamps back down on
  // the same spot (paws never slide), the chest drives forward and up (the reach comes from the
  // body), the S-neck only straightens (same thickness as idle), jaws wide, the throat glows
  // (fire..fireEnd). During the breath the body HOLDS (only the throat glow and a 1 px head recoil
  // alternate); the wings, a frame behind the neck, sweep back, overshoot once and stay; then it
  // closes and settles.
  attack: {
    loop: false,
    marks: { fire: 5, fireEnd: 8 },
    durations: [110, 120, 250, 60, 70, 130, 130, 130, 120, 90, 100, 110, 160],
    keys: [
      { chest: [-2, 1], hip: [-1, 0], haunch: 0.8, head: [-2, 2], neckBend: 3, eyes: 'fierce', wing: -98, fan: 1.03, tail: 0.5 },
      { chest: [-3, 2], hip: [-2, 1], sq: 1, haunch: 1.8, head: [-4, 4], neckBend: 3.6, eyes: 'fierce', glow: true, wing: -95, fan: 1.08, farWing: -88, tail: 1 },
      { chest: [-4, 3], hip: [-2, 1], sq: 1.5, haunch: 2.4, head: [-5, 5], neckBend: 4, eyes: 'fierce', glow: true, wing: -93, fan: 1.12, farWing: -86, tail: 1.5, paw: [0, -1] },
      // snap: the near forepaw comes up as the weight drives forward ...
      { chest: [2, -2], hip: [1, 0], haunch: 0.5, head: [2, -1], neckBend: 1.8, eyes: 'open', mouth: 'open', glow: true, paw: [1, -2], wing: -95, fan: 1.06, farWing: -88, tail: 1 },
      // ... and stamps down where it was (no sliding); the reach comes from the chest leaning in,
      // the S-neck only straightens (it never thins)
      { chest: [3, -3], hip: [1, 0], haunch: -0.5, head: [3, -1], neckBend: 1.3, headKind: 'up', eyes: 'fierce', throat: 0, glow: true, wing: -103, fan: 0.96, farWing: -95, tail: 0 },
      { chest: [3, -3], hip: [1, 0], haunch: -0.5, head: [4, -2], neckBend: 1, headKind: 'up', eyes: 'fierce', throat: 1, glow: true, wing: -109, fan: 0.9, farWing: -100, tail: -0.8 },
      { chest: [3, -3], hip: [1, 0], haunch: -0.5, head: [3, -1], neckBend: 1, headKind: 'up', eyes: 'fierce', throat: 0, glow: true, wing: -112, fan: 0.88, farWing: -103, tail: -1.2 },
      { chest: [3, -3], hip: [1, 0], haunch: -0.5, head: [4, -2], neckBend: 1, headKind: 'up', eyes: 'fierce', throat: 1, glow: true, wing: -112, fan: 0.88, farWing: -103, tail: -1.2 },
      { chest: [3, -3], hip: [1, 0], haunch: -0.5, head: [3, -1], neckBend: 1, headKind: 'up', eyes: 'fierce', throat: 0, glow: true, wing: -112, fan: 0.88, farWing: -103, tail: -1.2 },
      { chest: [2, -2], hip: [1, 0], head: [3, -1], neckBend: 1.6, mouth: 'open', eyes: 'open', wing: -106, fan: 0.95, farWing: -98, tail: -0.5 },
      { chest: [1, -1], head: [1, -1], neckBend: 2, paw: [0, -1], wing: -101, tail: 0 },
      { chest: [-1, 0], head: [-1, 1], neckBend: 2.8, wing: -98, fan: 1.02, tail: 0.5 },
      {},
    ],
  },

  // summon: shards converge over the circle → a half-formed crystal pod → the cocoon (curled up,
  // the near wing folded over the head and flank, the far wing wrapped behind) → the wings crack
  // open and unfurl → it drops with wings up → lands (drawn squash) → rebounds → shakes out
  // (head swings ±4 px with a tilt, the wings flutter against it a frame later) → blinks.
  summon: {
    loop: false,
    marks: { land: 10 },
    durations: [70, 70, 130, 70, 85, 80, 70, 60, 60, 60, 120, 100, 90, 80, 80, 80, 80, 160],
    keys: [
      { seed: 1, glow: true },
      { seed: 2, glow: true },
      ...COCOON(),
      ...CRACK(),
      { lift: [0, -10], chest: [-3, 4], hip: [1, 2], sq: 1.5, haunch: 1, head: [-7, 20], neckBend: 4, eyes: 'closed', wing: -96, elbow: 12, drape: 42, fan: -0.35, span: 0.95, farWing: -86, farElbow: -20, farDrape: -40, farFan: 0.1, farSpan: 0.85, tail: -0.5, tailTuck: 0.8, legTuck: 0.9, glow: true },
      { lift: [0, -11], chest: [-2, 3], hip: [0, 1], sq: 0.5, head: [-3, 4], neckBend: 3, eyes: 'half', wing: -92, fan: 0.8, farWing: -84, farFan: 0.6, tail: 0.5, tailTuck: 0.4, legTuck: 0.6 },
      { lift: [0, -10], sq: -1, head: [-1, 0], eyes: 'open', mouth: 'open', wing: -86, fan: 1.15, farWing: -76, farFan: 1.0, tail: 1.5, legTuck: 0.3 },
      { lift: [0, -4], sq: -1, head: [0, -1], eyes: 'open', mouth: 'open', wing: -82, fan: 1.2, farWing: -72, farFan: 1.05, tail: 2, legTuck: 0.1 },
      { sq: 2, chest: [0, 3], hip: [0, 2], haunch: 1.5, head: [0, 2], neckBend: 3.4, eyes: 'closed', wing: -110, fan: 0.92, farWing: -101, tail: -1 },
      { sq: -0.5, chest: [0, -1], head: [0, -1], eyes: 'open', wing: -94, fan: 1.05, farWing: -88, tail: 1 },
      { head: [0, 0], wing: -102, tail: 0 },
      { head: [4, -1], headKind: 'up', chest: [1, 0], eyes: 'closed', wing: -102, tail: 1.5 },
      { head: [-4, 1], chest: [-1, 0], eyes: 'closed', mouth: 'open', wing: -108, fan: 0.95, farWing: -98, tail: -1 },
      { head: [3, 0], headKind: 'up', eyes: 'half', wing: -92, fan: 1.08, farWing: -86, tail: 0.6 },
      { eyes: 'closed', head: [0, 0], wing: -104, farWing: -94, tail: 0 },
      {},
    ],
  },

  // victory: crouch → happy hop with the wings flared, eyes closed in a smile → land (squash) →
  // rebound → proud chest-up pose with a little wing flap, held → settles back into idle f0.
  victory: {
    loop: false,
    durations: [100, 80, 100, 80, 110, 100, 140, 110, 110, 520, 120, 110, 140],
    keys: [
      { sq: 1.5, chest: [0, 2], hip: [0, 1], haunch: 1.5, head: [0, 2], neckBend: 3.4, eyes: 'happy', wing: -108, fan: 0.95, tail: 0.5 },
      { lift: [0, -5], sq: -1, chest: [0, -1], head: [1, -1], neckBend: 2, eyes: 'happy', mouth: 'open', wing: -84, fan: 1.2, farWing: -74, farFan: 1.0, tail: 1.5, legTuck: 0.4 },
      { lift: [0, -9], sq: -0.5, head: [1, -2], headKind: 'up', eyes: 'happy', wing: -78, fan: 1.25, farWing: -68, farFan: 1.05, tail: 2, legTuck: 0.6 },
      { lift: [0, -5], head: [0, -1], eyes: 'happy', mouth: 'open', wing: -84, fan: 1.15, farWing: -80, tail: 1, legTuck: 0.2 },
      { sq: 2, chest: [0, 3], hip: [0, 1], haunch: 1.5, head: [0, 1], neckBend: 3.6, eyes: 'happy', wing: -112, fan: 0.95, farWing: -102, tail: -1 },
      { sq: -0.5, chest: [0, -1], head: [1, -1], eyes: 'happy', wing: -92, fan: 1.08, farWing: -86, tail: 0.5 },
      { chest: [2, -2], head: [1, -3], neckBend: 1.6, headKind: 'up', eyes: 'happy', mouth: 'open', wing: -84, fan: 1.2, farWing: -74, farFan: 1.0, tail: 1.5 },
      { chest: [2, -2], head: [1, -3], neckBend: 1.6, headKind: 'up', eyes: 'happy', wing: -78, fan: 1.25, farWing: -68, farFan: 1.05, tail: 1 },
      { chest: [2, -2], head: [1, -3], neckBend: 1.6, headKind: 'up', eyes: 'happy', wing: -86, fan: 1.18, farWing: -76, farFan: 0.95, tail: 1.5 },
      { chest: [2, -2], head: [0, -2], neckBend: 1.6, eyes: 'happy', mouth: 'open', wing: -84, fan: 1.2, farWing: -74, farFan: 0.95, tail: 1.5 },
      // settle back to the idle pose (no pop when idle takes over)
      { chest: [1, -1], head: [0, -1], neckBend: 2, eyes: 'happy', wing: -92, fan: 1.1, farWing: -84, tail: 1 },
      { head: [0, -1], eyes: 'half', wing: -98, fan: 1.02, farWing: -90, tail: 0.5 },
      {},
    ],
  },
};

/** The cocoon: curled up and floating, head tucked low; the near wing folded over the head and
 *  flank (the arm arches up and forward over it, the panels point down and forward over the face
 *  and chest), the far wing wrapped behind (panels down and back) — a rounded crystal pod. Two
 *  frames (a slow breath inside). */
function COCOON(): Key[] {
  const base: Key = {
    chest: [-4, 4], hip: [2, 2], sq: 2, haunch: 1, head: [-15, 40], neckBend: 4, eyes: 'closed',
    wing: -98, elbow: 100, drape: 59, fan: -1.3, span: 1, wingFront: true,
    farWing: -83, farElbow: -94, farDrape: -36, farFan: 1, farSpan: 0.8,
    tail: -1, tailTuck: 1, legTuck: 1, glow: true,
  };
  return [
    { ...base, lift: [0, -8] },
    { ...base, lift: [0, -9], drape: 56, farDrape: -33 },
  ];
}

/** The pod cracks: the folded arm lifts off the head (still in front), the panels swing up and
 *  out, the far wing starts to open behind, the head rises with its eyes still closed. */
function CRACK(): Key[] {
  const base: Key = {
    chest: [-4, 4], hip: [2, 2], sq: 2, haunch: 1, neckBend: 4, eyes: 'closed', wingFront: true,
    span: 1, farSpan: 0.82, tail: -1, tailTuck: 1, legTuck: 1, glow: true,
  };
  return [
    { ...base, lift: [0, -9], head: [-12, 32], wing: -94, elbow: 57, drape: 30, fan: -0.6, farWing: -84, farElbow: -70, farDrape: -60, farFan: 0.5 },
    { ...base, lift: [0, -10], chest: [-3, 4], head: [-10, 26], tailTuck: 0.9, legTuck: 0.95, wing: -90, elbow: 25, drape: 18, fan: -0.2, farWing: -85, farElbow: -45, farDrape: -50, farFan: 0.3 },
  ];
}

const ORDER: DragonAnim[] = ['summon', 'idle', 'hit', 'attack', 'victory'];
const ANIMS = Object.fromEntries(
  ORDER.map((a) => [a, { durations: DEFS[a].durations, loop: DEFS[a].loop, ...(DEFS[a].marks ? { marks: DEFS[a].marks } : {}) }]),
) as Record<DragonAnim, LabAnim>;

function poseOf(anim: DragonAnim, f: number): Pose {
  const keys = DEFS[anim].keys;
  const k = keys[clamp(Math.floor(f), 0, keys.length - 1)];
  return { ...REST, ...k };
}

const dragon: LabMonsterArt<DragonAnim> = {
  id: 'a_dragon',
  name: 'Kristal Ejder',
  w: W,
  h: H,
  anchorX: 64 + OX,
  anchorY: GY + 2,
  hover: 0,
  anims: ANIMS,
  draw(p: PixelCanvas, anim: DragonAnim, f: number) {
    drawPose(p, poseOf(anim, f));
  },
  points(anim: DragonAnim, f: number): LabFramePoints {
    const ps = poseOf(anim, f);
    if (ps.seed) return { core: { x: 62 + OX, y: 72 + OY } };
    const g = geometry(ps);
    const [ox, oy] = g.headOrigin;
    const m = g.headMap.mouth;
    return {
      core: { x: Math.round((g.hip[0] + g.chest[0]) / 2), y: Math.round((g.hip[1] + g.chest[1]) / 2) - 4 },
      muzzle: { x: ox + m[0], y: oy + m[1] },
      eye: { x: ox + g.headMap.eye[0], y: oy + g.headMap.eye[1] },
      head: { x: ox + 29, y: oy + 30 },
      chest: { x: g.chest[0], y: g.chest[1] },
    };
  },
};

export default dragon;
