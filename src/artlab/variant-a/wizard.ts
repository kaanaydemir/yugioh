// Art Lab A — "Uçurum Büyücüsü": a short, chibi cloaked wizard (variant A, warm & cute).
//
// Drawn facing RIGHT (the lab mirrors it), 1 art px = 1 game px. A frame is a POSE (numbers)
// rendered back to front: robe (cloth with hand-placed folds / trims / stars) → hood with the
// shadowed face (2-px hood rim, glowing slanted eyes whose light spills onto the cheeks) → hat
// (hand-authored brim, crown, horns, gem; tilts and tip sway are drawn whole-pixel shears) →
// sleeve (cloth: a lit top plane, a lagging bell with a lined, gold-rimmed mouth) → the hooded
// capelet over the shoulders (gold hem, clasp; it hides the sleeve's root) → staff → glove (a fist
// with knuckle rolls round the staff / a pointing finger) → 3-prong cradle + orb. The robe's folds
// fan out from under the capelet in V pinches; its hem is the front half of a floor ellipse,
// scalloped where the folds land, trailing a little further at the back. The outline is selective
// and coloured: plum at the bottom and on the shadow side; where the low sun behind the wizard (its
// back, the drawn left) rims the hat, hood and shoulder, a purple line (lighter on the brim's top).
// Every animation frame is an explicitly keyed pose with its own hold time; squash, lean and the
// collapse are DRAWN (the neck drops, the hem flares) — the sprite is never scaled or rotated. The
// hem stays on the ground row, and a planted staff pivots on its foot (the foot pixel never slides;
// only the orb end moves).
//
// Frame 120×114 (the old game wizard was 80×80). The standing idle pose is only ~63×84, but the
// attack thrusts the staff forward and down toward the dragon (orb + its drawn release burst reach
// 77 px in front of the anchor), the charge lifts the orb up and back into the sky above the hat
// (12 rows of sky on top), the knocked-back / collapsed hat lies ≈37 px behind the anchor, the
// dropped staff lies on the floor IN FRONT of the robe (below the hem's ground row, hence the 6
// extra rows under the anchor) and the death motes drift out; every frame keeps a ≥2 px margin
// (measured with tools/artlab-sheet.ts: tightest are attack f3 on the left and death f3 on the
// right, 2 px each). A bigger DRAWING SURFACE, not a higher resolution — 1 art pixel is still 1
// game pixel.

import { PixelCanvas } from '../../art/pixel';
import type { LabAnim, LabFramePoints, LabMonsterArt, WizardAnim } from '../types';
import { A_RAMPS } from './palette';
import {
  BRIM,
  BRIM_DROOP,
  BRIM_HALF,
  CROWN,
  DOT,
  DOT_LIT,
  EYES,
  GEM,
  GLOVES,
  HOOD,
  HORN_BACK,
  HORN_FRONT,
  ORBS,
  STAR_BIG,
  STAR_DIM,
  STAR_SMALL,
  type GloveKind,
} from './wizard-maps';
import {
  clamp,
  composite,
  drawCape,
  drawCradle,
  drawCradleFront,
  drawRobe,
  drawSleeve,
  drawStaff,
  hash2,
  selectiveOutline,
  shear,
  shiftRows,
  stamp,
  staffDir,
  type Fold,
  type Star,
  type V2,
} from './wizard-rig';

const W = 120;
const H = 114;
const GX = 40; // body centre column (the anchor)
const GY = 105; // ground row (front of the hem)

const M = A_RAMPS.magic;
const RB = A_RAMPS.robe;
const MAGIC = new Set<number>(M);
type EyeKind = keyof typeof EYES;

interface Pose {
  /** Summon: px the whole wizard is still below the floor (clipped at the ground row). */
  sink: number;
  /** Neck offset from rest (+x forward, +y down): lean / crouch; the hem stays planted. */
  neck: V2;
  /** Cloth: hem lag (px, + forward), corner curls, extra hem width, side belly, front opening. */
  sway: number;
  curlL: number;
  curlR: number;
  flare: number;
  belly: number;
  open: number;
  /** Head offset from the neck; hat offset from the head. */
  head: V2;
  hat: V2;
  /** Hat: crown tip sway (px at the tip, + forward); tilt (px at the crown top, + forward). */
  tip: number;
  tilt: number;
  /** Floppy brim: its ends bob (px at the ends, + down). */
  flap: number;
  brim: 'flat' | 'half' | 'droop';
  eyes: EyeKind | 'none';
  /** Grip relative to the neck, the glove, and the sleeve bell (droop below the cuff, lag). */
  hand: V2;
  glove: GloveKind | 'none';
  droop: number;
  lag: number;
  /**
   * Staff angle (deg, 0 up, + top forward) for a held staff; hold = grip → top. hold 0: the foot is
   * PLANTED at `foot` (px in front of the anchor) and the staff pivots there toward the hand — the
   * angle then follows the hand and `staff` is ignored.
   */
  staff: number;
  hold: number;
  foot: number;
  /** Dropped staff: its foot (relative to the ground centre), no hand on it. */
  free: V2 | null;
  /** The spent orb rolled out of its cradle (px, dropped staff only). */
  roll: V2;
  staffBehind: boolean;
  /** The orb passes behind the body too (twirl). */
  orbBehind: boolean;
  /** Orb step (ORBS index), drawn sparkles around it, release burst. */
  orb: number;
  spark: number;
  flash: number;
  /** Death: erosion progress 0..1. */
  erode: number;
  /** Capelet: its lower rows lag (px, + forward); its back corner lifts (px). */
  capeSway: number;
  capeLift: number;
  /** A 1-px ripple travelling along the robe hem (u, 0 back .. 1 front), or none. */
  ripple: number | null;
}

const REST: Pose = {
  sink: 0,
  neck: [0, 0],
  sway: 0,
  curlL: 3,
  curlR: 3,
  flare: 0,
  belly: 2,
  open: 9,
  head: [0, 0],
  hat: [0, 0],
  tip: 0,
  tilt: 0,
  flap: 0,
  brim: 'flat',
  eyes: 'open',
  hand: [24, 6],
  glove: 'grip',
  droop: 8,
  lag: 0,
  staff: 0,
  hold: 0,
  foot: 25,
  free: null,
  roll: [0, 0],
  staffBehind: false,
  orbBehind: false,
  orb: 0,
  spark: 0,
  flash: 0,
  erode: 0,
  capeSway: 0,
  capeLift: 1,
  ripple: null,
};

const NECK0: V2 = [GX + 1, GY - 37];
const STAFF_LEN = 62;

// Folds fan out from the collar: two V pinches (a pair of creases sharing one apex) on the back
// panel and one on the front panel, plus a short hem fold; each crease notches the hem.
const FOLDS: Fold[] = [
  { ax: -7, ay: 3, u: 0.09, w: 3, ridge: 2, lift: 2, hi: 2, deep: true },
  { ax: -7, ay: 3, u: 0.33, w: 4, ridge: 2, lift: 2, hi: 2, deep: true },
  { ax: -16, ay: 21, u: 0.22, w: 2, ridge: 1, lift: 1 },
  { ax: -3, ay: 9, u: 0.45, w: 2, ridge: 2, lift: 1, hi: 2 },
  { ax: 14, ay: 10, u: 0.81, w: 2, ridge: 2, lift: 1, deep: true },
  { ax: 14, ay: 10, u: 0.93, w: 2, ridge: 1, lift: 1 },
];
const CAPE_FOLDS = [
  { x0: -9, x1: -13, y0: 3 },
  { x0: -3, x1: -5, y0: 4 },
  { x0: 10, x1: 12, y0: 3 },
];
const STARS: Star[] = [
  { u: 0.8, v: 0.8, rows: STAR_BIG },
  { u: 0.22, v: 0.68, rows: STAR_SMALL },
  { u: 0.4, v: 0.42, rows: STAR_DIM },
  { u: 0.09, v: 0.56, rows: STAR_DIM },
  { u: 0.55, v: 0.86, rows: DOT_LIT },
  { u: 0.3, v: 0.88, rows: DOT },
  { u: 0.17, v: 0.36, rows: DOT },
  { u: 0.93, v: 0.6, rows: DOT_LIT },
  { u: 0.46, v: 0.66, rows: DOT },
];

// ------------------------------------------------------------------ geometry

interface Geo {
  neck: V2;
  head: V2;
  hatO: V2;
  grip: V2;
  top: V2;
  foot: V2;
  dir: V2;
  orb: V2;
  orbR: number;
  face: V2;
}

function geometry(ps: Pose): Geo {
  const s = ps.sink;
  const neck: V2 = [NECK0[0] + ps.neck[0], NECK0[1] + ps.neck[1] + s];
  const head: V2 = [neck[0] + ps.head[0], neck[1] - 17 + ps.head[1]];
  const hatO: V2 = [head[0] + ps.hat[0], head[1] + ps.hat[1]];
  const grip: V2 = [neck[0] + ps.hand[0], neck[1] + ps.hand[1]];
  let dir = staffDir(ps.staff);
  let top: V2;
  let foot: V2;
  if (ps.free) {
    foot = [GX + ps.free[0], GY + ps.free[1] + s];
    top = [foot[0] + dir[0] * STAFF_LEN, foot[1] + dir[1] * STAFF_LEN];
  } else if (ps.hold > 0) {
    top = [grip[0] + dir[0] * ps.hold, grip[1] + dir[1] * ps.hold];
    foot = [grip[0] - dir[0] * (STAFF_LEN - ps.hold), grip[1] - dir[1] * (STAFF_LEN - ps.hold)];
  } else {
    // planted: the foot stays on its floor pixel, the staff leans toward the hand
    foot = [GX + ps.foot, GY + s];
    const l = Math.hypot(grip[0] - foot[0], grip[1] - foot[1]) || 1;
    dir = [(grip[0] - foot[0]) / l, (grip[1] - foot[1]) / l];
    top = [foot[0] + dir[0] * STAFF_LEN, foot[1] + dir[1] * STAFF_LEN];
  }
  const orbR = ORBS[ps.orb].ax;
  const orb: V2 = [Math.round(top[0] + dir[0] * (orbR + 1)), Math.round(top[1] + dir[1] * (orbR + 1))];
  return { neck, head, hatO, grip, top, foot, dir, orb, orbR, face: [head[0] + 2, head[1] + 13] };
}

// ------------------------------------------------------------------ parts

const FACE_TONES = new Set<number>(A_RAMPS.faceShadow);

/**
 * The eyes on the shadowed face: the glowing pixels go on as drawn; the spill pixels (the two
 * darkest magic tones) only land on face shadow, so the glow never paints over the hood rim.
 */
function paintEyes(face: PixelCanvas, eyes: PixelCanvas): void {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = eyes.get(x, y);
      if (c === null) continue;
      if (c === M[0] || c === M[1]) {
        const f = face.get(x, y);
        if (f === null || !FACE_TONES.has(f)) continue;
      }
      face.set(x, y, c);
    }
}

function drawHat(ps: Pose, g: Geo): { hat: PixelCanvas; brim: PixelCanvas } {
  const [ox, oy] = g.hatO;
  const hat = new PixelCanvas(W, H);
  const brimMap = ps.brim === 'droop' ? BRIM_DROOP : ps.brim === 'half' ? BRIM_HALF : BRIM;
  const flap = ps.flap;
  stamp(hat, brimMap, ox, oy, flap ? { colShift: (c) => flap * Math.pow((c - brimMap.ax) / 24, 2) } : {});
  const brim = hat.clone();
  let crown = new PixelCanvas(W, H);
  stamp(crown, HORN_FRONT, ox + 10, oy - 5);
  stamp(crown, CROWN, ox, oy + 2);
  stamp(crown, GEM, ox + 4, oy - 2);
  if (ps.tip) {
    const base = oy - 4;
    crown = shiftRows(crown, (y) => (y < base ? ps.tip * Math.pow((base - y) / 26, 1.6) : 0));
  }
  composite(hat, crown, 1);
  const horn = new PixelCanvas(W, H);
  stamp(horn, HORN_BACK, ox - 9, oy - 3);
  composite(hat, horn, 1);
  const k = ps.tilt / 30;
  return { hat: shear(hat, ox, oy + 2, k, k * 0.8), brim: shear(brim, ox, oy + 2, k, k * 0.8) };
}

/** Bone tones (the horns keep their warm ink; the sun rims them in dark bone). */
const BONE = new Set<number>(A_RAMPS.bone);

/** Drawn sparkles around the charging orb (fixed, hand-placed offsets per level). */
const SPARKS: V2[][] = [
  [],
  [
    [-9, -4],
    [8, -8],
  ],
  [
    [-10, -6],
    [9, -9],
    [-7, 8],
    [11, 4],
    [1, -12],
  ],
];

function sparkle(p: PixelCanvas, x: number, y: number, big: boolean): void {
  p.set(x, y, M[5]);
  if (!big) return;
  p.set(x - 1, y, M[3]);
  p.set(x + 1, y, M[3]);
  p.set(x, y - 1, M[4]);
  p.set(x, y + 1, M[3]);
}

/** Release burst: crisp rays out of the orb (1 = full, 2 = fading). */
function burst(p: PixelCanvas, cx: number, cy: number, r: number, level: number): void {
  const rays: V2[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ];
  rays.forEach(([dx, dy], i) => {
    const diag = dx !== 0 && dy !== 0;
    const from = r + (level === 1 ? 2 : 3);
    const to = from + (diag ? 1 : 3) - (level === 2 ? 1 : 0);
    for (let k = from; k <= to; k++) {
      const x = cx + Math.round((dx * k) / (diag ? 1.4 : 1));
      const y = cy + Math.round((dy * k) / (diag ? 1.4 : 1));
      p.set(x, y, level === 1 ? (k === from ? M[5] : M[4]) : k === from ? M[3] : M[2]);
    }
    void i;
  });
}

function drawStaffLayer(p: PixelCanvas, g: Geo): void {
  const up = Math.hypot(g.top[0] - g.grip[0], g.top[1] - g.grip[1]);
  const down = Math.hypot(g.foot[0] - g.grip[0], g.foot[1] - g.grip[1]);
  const ang = (Math.atan2(g.dir[0], -g.dir[1]) * 180) / Math.PI;
  // grip may lie outside the staff for a dropped staff: draw from the foot then
  const along = (g.grip[0] - g.foot[0]) * g.dir[0] + (g.grip[1] - g.foot[1]) * g.dir[1];
  if (along < 0 || along > STAFF_LEN) drawStaff(p, { gx: g.foot[0], gy: g.foot[1], deg: ang, up: STAFF_LEN, down: 0 });
  else drawStaff(p, { gx: g.grip[0], gy: g.grip[1], deg: ang, up, down });
}

/** Magic tone (index) whose brightness is nearest to a colour's: the body's own light, in magic. */
const LUM = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const M_LUM = M.map(LUM);
function magicIndex(c: number): number {
  const l = LUM(c);
  let best = 0;
  for (let i = 1; i < M.length; i++) if (Math.abs(M_LUM[i] - l) < Math.abs(M_LUM[best] - l)) best = i;
  return best;
}
const GOLD = new Set<number>(A_RAMPS.gold);

/**
 * Death erosion, drawn into the frame: from the top and the silhouette edges inward the body
 * flares into magic colours and vanishes; some vanished pixels drift up and out as purple motes;
 * the eyes go last. What is left of the body turns to magic GRADUALLY, from the eroded edge
 * inward: first a 1–3 px rim along the eroded edge lifts one or two steps up the magic ramp and
 * the gold trim dims (e ≈ 0.5–0.65); then the whole remainder takes the mid magic tones (≈ 0.73);
 * only the last scraps (≥ 0.8) reach the light tones.
 */
function erode(p: PixelCanvas, e: number, eyes: { x0: number; y0: number; x1: number; y1: number }): void {
  if (e <= 0) return;
  const src = p.clone();
  // distance (in px) from the outside, capped — edges dissolve first
  const dist = new Float32Array(W * H).fill(99);
  const bfs = (seed: (i: number) => boolean, out: Float32Array) => {
    const q: number[] = [];
    for (let i = 0; i < W * H; i++)
      if (seed(i)) {
        out[i] = 0;
        q.push(i);
      }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      const x = i % W;
      const y = (i / W) | 0;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx;
        if (out[j] > out[i] + 1) {
          out[j] = out[i] + 1;
          q.push(j);
        }
      }
    }
  };
  bfs((i) => !src.isOpaque(i % W, (i / W) | 0), dist);
  p.clear();
  // vertical extent of the body: the top dissolves first, the base last
  let top = H;
  let bot = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (src.isOpaque(x, y)) {
        top = Math.min(top, y);
        bot = Math.max(bot, y);
      }
  const span = Math.max(1, bot - top);
  const T = new Float32Array(W * H).fill(-1);
  const keep = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const i = y * W + x;
      const inEyes = x >= eyes.x0 && x <= eyes.x1 && y >= eyes.y0 && y <= eyes.y1 && c !== M[0] && MAGIC.has(c);
      const d = Math.min(1, dist[i] / 11);
      const low = (y - top) / span;
      T[i] = inEyes ? 0.985 : 0.02 + 0.66 * d + 0.1 * low + 0.12 * hash2(x >> 1, y >> 1, 11) + 0.02 * hash2(x, y, 12);
      if (T[i] >= e) keep[i] = inEyes ? 2 : 1;
    }
  // distance of every surviving pixel from the ERODED edge (pixels of the body already gone)
  const fromGone = new Float32Array(W * H).fill(99);
  bfs((i) => T[i] >= 0 && !keep[i], fromGone);
  const tint = (c: number, rim: number): number => {
    if (e < 0.45) return c;
    const mi = magicIndex(c);
    if (e < 0.68) {
      // a rim along the eroded edge lifts up the magic ramp; the gold trim dims
      if (rim <= 1) return M[clamp(mi + 2, 1, 4)];
      if (rim <= 3) return GOLD.has(c) ? M[2] : M[clamp(mi + 1, 1, 3)];
      return GOLD.has(c) ? (e < 0.58 ? A_RAMPS.gold[1] : A_RAMPS.gold[0]) : c;
    }
    if (e < 0.78) return rim <= 2 ? M[clamp(mi + 2, 2, 4)] : M[clamp(mi + 1, 1, 3)];
    if (e < 0.86) return rim <= 2 ? M[clamp(mi + 3, 3, 4)] : M[clamp(mi + 2, 2, 4)];
    return rim <= 2 ? M[5] : M[clamp(mi + 3, 3, 4)];
  };
  const cx = GX;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = src.get(x, y);
      if (c === null) continue;
      const t = T[i];
      if (keep[i] === 2) p.set(x, y, c);
      else if (keep[i]) p.set(x, y, tint(c, fromGone[i]));
      else if (t >= e - 0.08) {
        // the eroding rim flares through the magic ramp
        const k = (e - t) / 0.08;
        p.set(x, y, k < 0.5 ? M[4] : M[3]);
      } else if (t >= e - 0.3 && hash2(x, y, 5) < 0.16) {
        // a mote: drifts up and away from the body, fading through the magic ramp
        const age = (e - 0.08 - t) / 0.22;
        const dx = Math.round(Math.sign(x - cx) * age * (1 + 3 * hash2(x, y, 3)));
        const dy = -Math.round(age * (3 + 9 * hash2(x, y, 4)));
        p.set(x + dx, y + dy, age < 0.45 ? M[3] : age < 0.75 ? M[2] : M[1]);
      }
    }
}

function drawOrb(p: PixelCanvas, ps: Pose, g: Geo): void {
  const deg = (Math.atan2(g.dir[0], -g.dir[1]) * 180) / Math.PI;
  drawCradle(p, g.orb[0], g.orb[1], g.orbR, deg);
  stamp(p, ORBS[ps.orb], g.orb[0] + ps.roll[0], g.orb[1] + ps.roll[1]);
  if (!ps.roll[0] && !ps.roll[1]) drawCradleFront(p, g.orb[0], g.orb[1], g.orbR, deg);
  for (const [dx, dy] of SPARKS[ps.spark]) sparkle(p, g.orb[0] + dx, g.orb[1] + dy, Math.abs(dx) > 8);
  if (ps.flash) burst(p, g.orb[0], g.orb[1], g.orbR, ps.flash);
}

function drawPose(p: PixelCanvas, ps: Pose): void {
  const g = geometry(ps);
  const [nx, ny] = g.neck;
  const s = ps.sink;

  if (ps.staffBehind) drawStaffLayer(p, g);
  if (ps.orbBehind) drawOrb(p, ps, g);

  // robe
  const robe = drawRobe(W, H, {
    nx,
    ny,
    sw: 11,
    span0: GY - NECK0[1],
    hl: GX - 29 - ps.flare,
    hr: GX + 28 + ps.flare,
    belly: ps.belly,
    flickL: 5,
    flickR: 2,
    gy: GY + s,
    arc: 5,
    sway: ps.sway,
    curlL: ps.curlL,
    curlR: ps.curlR,
    front: 0.64,
    open: ps.open,
    folds: FOLDS,
    stars: STARS,
    shadowV: 0.14,
    ...(ps.ripple !== null ? { ripple: ps.ripple } : {}),
  });
  composite(p, robe.canvas, 1);

  // hood + face + eyes
  const face = new PixelCanvas(W, H);
  stamp(face, HOOD, g.face[0], g.face[1]);
  if (ps.eyes !== 'none') {
    const eyes = new PixelCanvas(W, H);
    stamp(eyes, EYES[ps.eyes], g.face[0], g.face[1] - 2);
    paintEyes(face, eyes);
  }
  composite(p, face, 1);

  // hat
  const hat = drawHat(ps, g);
  composite(p, hat.hat, 2);

  // sleeve (cloth), staff, glove, cradle + orb
  const S: V2 = [nx + 9, ny + 2];
  const gl = ps.glove;
  const wrist: V2 = gl === 'hang' ? g.grip : (() => {
    const dx = g.grip[0] - S[0];
    const dy = g.grip[1] - S[1];
    const l = Math.hypot(dx, dy) || 1;
    return [g.grip[0] - (dx / l) * 3.5, g.grip[1] - (dy / l) * 3.5] as V2;
  })();
  composite(p, drawSleeve(W, H, { sx: S[0], sy: S[1], cx: wrist[0], cy: wrist[1], r0: 5, r1: 4.5, droop: ps.droop, lag: ps.lag }), 2);
  // the hooded capelet over the shoulders (it covers the hood's base and the sleeve's root)
  const cape = drawCape(W, H, { nx, ny, topL: 9, topR: 11, hemL: 18, hemR: 15, len: 10, arc: 3, clasp: 3, sway: ps.capeSway, lift: ps.capeLift, folds: CAPE_FOLDS });
  composite(p, cape, 1);
  const front = new PixelCanvas(W, H);
  if (!ps.staffBehind) drawStaffLayer(front, g);
  if (gl !== 'none') stamp(front, GLOVES[gl], g.grip[0], g.grip[1]);
  if (!ps.orbBehind) drawOrb(front, ps, g);
  composite(p, front, 1);

  // the floor: while the summon rises out of it nothing shows below the ground row
  if (s > 0) for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);
  // the outline: plum on the bottom and the shadow side; where the low sun behind the wizard
  // (its back, the drawn left) rims the silhouette — the hat crown, the hood, the capelet's
  // shoulder — a coloured R2 line, R3 along the brim's top edge, dark bone along the horns
  const shoulderY = ny + 8;
  const robeTone = (c: number | null) => c !== null && (c === RB[0] || c === RB[1] || c === RB[2] || c === RB[3] || c === RB[4] || c === RB[5]);
  selectiveOutline(p, GY + 1, (x, y, side) => {
    const nb = side === 'top' ? p.get(x, y + 1) : p.get(x + 1, y);
    const nxp = side === 'top' ? x : x + 1;
    const nyp = side === 'top' ? y + 1 : y;
    if (nb !== null && BONE.has(nb)) return A_RAMPS.bone[1];
    if (side === 'top' && hat.brim.isOpaque(nxp, nyp) && robeTone(nb)) return RB[3];
    if (hat.hat.isOpaque(nxp, nyp)) return RB[2];
    if ((face.isOpaque(nxp, nyp) || cape.isOpaque(nxp, nyp)) && (side === 'top' || y <= shoulderY)) return RB[2];
    return null;
  });
  if (ps.erode > 0) erode(p, ps.erode, { x0: g.face[0] - 7, y0: g.face[1] - 4, x1: g.face[0] + 7, y1: g.face[1] + 3 });
}

// ------------------------------------------------------------------ animations

type Key = Partial<Pose>;
interface AnimDef {
  keys: Key[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

// idle: the breath lifts the neck (the hat rides on it), the hand and sleeve bell follow a beat
// later, the hat tip sways on its own slower rhythm (±3 at the tip), the hand rocks the planted
// staff a pixel (it pivots on its foot, so only the orb end moves), the sleeve bell swings 2 px
// dragging behind the hand, the capelet's hem lags the breath, a 1-px ripple runs along the robe
// hem (back → front over three frames, then front → back half a cycle later) while the hem's ends
// stay planted, the orb pulses with the breath and the eyes flicker once. No two neighbouring
// frames are the same — the loop seam (f11 → f0 → f1) keeps moving.
const IDLE_NECK = [0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0, 0];
const IDLE_HAND = [0, 0, 0, -1, -1, -1, -1, 0, 0, 0, 0, 0];
const IDLE_HANDX = [0, 0, 0, 0, 1, 1, 1, 0, 0, -1, -1, 0];
const IDLE_SWAY = [0, 0, 0, 0, 1, 1, 1, 0, 0, -1, -1, 0];
const IDLE_TIP = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1];
const IDLE_ORB = [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1];
const IDLE_DROOP = [8, 7, 7, 7, 7, 7, 8, 8, 9, 9, 9, 8];
const IDLE_LAG = [0, 0, 1, 0, -1, -2, -2, -1, 1, 2, 2, 1];
const IDLE_FLAP = [0, 0, 0, 0, 1, 1, 1, 0, 0, -1, -1, -1];
const IDLE_CAPE = [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, -1, -1];
const IDLE_LIFT = [1, 1, 2, 2, 2, 1, 1, 0, 0, 1, 1, 1];
const IDLE_RIPPLE: (number | null)[] = [null, 0.3, 0.46, 0.62, null, null, null, 0.7, 0.54, 0.38, null, null];
const IDLE_EYES: EyeKind[] = ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'open'];

/** The collapsed pose the body dissolves from. */
const DEAD: Key = {
  neck: [1, 20],
  hat: [-11, 5],
  tilt: -11,
  eyes: 'dim',
  hand: [18, 12],
  glove: 'hang',
  free: [0, 5],
  staff: 72,
  roll: [2, 2],
  orb: 4,
  belly: 5,
  flare: 6,
  curlL: 5,
  curlR: 5,
  droop: 2,
};

const DEFS: Record<WizardAnim, AnimDef> = {
  idle: {
    loop: true,
    durations: [160, 130, 120, 130, 150, 160, 140, 120, 120, 130, 70, 150],
    keys: IDLE_NECK.map((n, f) => ({
      neck: [0, n],
      hand: [24 + IDLE_HANDX[f], 6 + IDLE_HAND[f]],
      sway: IDLE_SWAY[f],
      tip: IDLE_TIP[f],
      flap: IDLE_FLAP[f],
      orb: IDLE_ORB[f],
      droop: IDLE_DROOP[f],
      lag: IDLE_LAG[f],
      eyes: IDLE_EYES[f],
      capeSway: IDLE_CAPE[f],
      capeLift: IDLE_LIFT[f],
      ripple: IDLE_RIPPLE[f],
    })),
  },

  // summon: the hat tip pokes out of the portal, the wizard rises with the brim folded and the
  // robe wrapped tight; on the floor the robe unfolds in two steps (half open, brim half lifted,
  // eyes waking → full flare, brim flicked up, eyes ignite); a staff twirl drawn every 45° (the
  // staff passes behind the hat and capelet while it points back); the staff is planted with a
  // thump (land); a small rebound.
  summon: {
    loop: false,
    marks: { land: 16 },
    durations: [90, 80, 80, 80, 80, 90, 70, 80, 40, 35, 35, 40, 35, 35, 40, 40, 120, 100, 150],
    keys: [
      { sink: 70, brim: 'droop', eyes: 'none', flare: -9, open: 0, belly: 0, curlL: 0, curlR: 0, hand: [15, 12], hold: 28, tip: -3, droop: 5 },
      { sink: 54, brim: 'droop', eyes: 'none', flare: -9, open: 0, belly: 0, curlL: 0, curlR: 0, hand: [15, 12], hold: 28, tip: -2, droop: 5 },
      { sink: 38, brim: 'droop', eyes: 'none', flare: -9, open: 0, belly: 0, curlL: 0, curlR: 0, hand: [15, 10], hold: 28, tip: -1, droop: 5 },
      { sink: 24, brim: 'droop', eyes: 'none', flare: -8, open: 0, belly: 0, curlL: 0, curlR: 0, hand: [15, 6], hold: 28, tip: 0, droop: 5 },
      { sink: 11, brim: 'droop', eyes: 'none', flare: -8, open: 1, belly: 0, curlL: 0, curlR: 0, hand: [15, 6], hold: 28, tip: 1, droop: 6 },
      { sink: 2, brim: 'droop', eyes: 'closed', flare: -7, open: 2, belly: 1, curlL: 1, curlR: 1, hand: [15, 5], hold: 28, tip: 2, droop: 6, capeLift: 0 },
      // the in-between: the robe half unfolded, the brim half lifted (ends still hanging), eyes waking
      { brim: 'half', flap: 2, neck: [0, -1], eyes: 'half', flare: -2, open: 5, belly: 1, curlL: 2, curlR: 2, hand: [16, 2], hold: 29, staff: 15, tip: 3, droop: 5, lag: -1, orb: 1, capeSway: -1, capeLift: 2 },
      { flap: -2, neck: [0, -2], eyes: 'flare', flare: 2, open: 10, belly: 3, curlL: 5, curlR: 5, hand: [17, -2], hold: 31, staff: 30, tip: 3, droop: 4, lag: -2, orb: 1, capeSway: -1, capeLift: 3 },
      // the twirl: every 45° (the hand circles a pixel with it)
      { flap: 1, neck: [0, -1], eyes: 'flare', flare: 1, curlL: 4, curlR: 4, hand: [18, -6], hold: 31, staff: 75, tip: 1, droop: 5, lag: 0, orb: 1, spark: 1, capeLift: 2 },
      { flap: 1, neck: [0, -1], eyes: 'flare', flare: 1, curlL: 4, curlR: 4, hand: [18, -8], hold: 31, staff: 120, tip: -1, droop: 6, lag: 1, orb: 1, capeSway: 1 },
      { neck: [0, -1], eyes: 'open', hand: [18, -8], hold: 31, staff: 165, tip: -2, droop: 7, lag: 1, orb: 1, capeSway: 1 },
      { neck: [0, -1], eyes: 'open', hand: [17, -8], hold: 31, staff: 210, tip: -2, droop: 7, lag: 1, orb: 1, spark: 1 },
      { neck: [0, -1], eyes: 'open', hand: [17, -8], hold: 31, staff: 255, staffBehind: true, orbBehind: true, tip: -1, droop: 7, orb: 1 },
      { neck: [0, -1], eyes: 'open', hand: [18, -8], hold: 31, staff: 300, staffBehind: true, orbBehind: true, tip: 0, droop: 7, orb: 1, spark: 1 },
      { neck: [0, -1], eyes: 'open', hand: [18, -7], hold: 31, staff: 335, tip: 1, droop: 7, orb: 1 },
      { neck: [0, -1], eyes: 'open', hand: [19, -6], hold: 31, staff: 355, tip: 1, droop: 7, orb: 1, capeSway: -1 },
      { flap: 2, neck: [0, 2], eyes: 'half', flare: 2, belly: 3, curlL: 4, curlR: 4, tip: 3, droop: 9, lag: -1, orb: 1, spark: 1, capeSway: 1, capeLift: 0 },
      { flap: -1, neck: [0, -1], eyes: 'open', tip: -2, droop: 7, lag: 1, capeLift: 2 },
      {},
    ],
  },

  // attack: gather (lean back, staff pulled up and back, the orb charges in drawn steps, eyes
  // flare) → lunge: the staff swings forward and points down at the dragon (release) → follow-
  // through → recover with the hat tip and hem lagging.
  attack: {
    loop: false,
    marks: { charge: 2, release: 6 },
    durations: [100, 110, 140, 140, 210, 60, 90, 100, 120, 100, 100, 110, 140],
    keys: [
      { neck: [0, 1], eyes: 'half', hand: [24, 5], tip: 1 },
      // the staff comes off the floor (f1) and swings up and back behind the hat (f2-f4: the shaft
      // passes behind the brim and crown, the orb hangs in the sky up-behind the hat, clear of the
      // hat tip; the glove sits on the brim's front edge, off the face)
      { flap: -1, neck: [-3, 2], eyes: 'half', hand: [20, -6], hold: 32, staff: -10, orb: 1, tip: 2, tilt: -1, sway: 1, belly: 3, droop: 7, lag: 1 },
      { flap: -1, neck: [-5, 3], eyes: 'flare', hand: [12, -16], hold: 43, staff: -40, staffBehind: true, orb: 2, spark: 1, tip: 4, tilt: -2, sway: 2, belly: 3, droop: 6, lag: 2 },
      { flap: -1, neck: [-6, 3], eyes: 'flare', hand: [12, -17], hold: 43, staff: -41, staffBehind: true, orb: 3, spark: 2, tip: 4, tilt: -2, sway: 2, belly: 3, droop: 6, lag: 2 },
      { neck: [-6, 3], eyes: 'flare', hand: [12, -17], hold: 43, staff: -41, staffBehind: true, orb: 3, spark: 1, tip: 3, tilt: -2, sway: 2, belly: 3, droop: 6, lag: 1 },
      { flap: -2, neck: [2, 1], eyes: 'flare', hand: [23, -6], hold: 28, staff: 60, orb: 3, tip: -2, sway: -1, droop: 6, lag: -2 },
      { flap: -1, neck: [5, 2], eyes: 'wide', hand: [26, 2], glove: 'point', hold: 27, staff: 117, staffBehind: true, orb: 3, flash: 1, tip: -4, tilt: 2, sway: -2, curlL: 5, droop: 7, lag: -3 },
      { flap: 1, neck: [6, 3], eyes: 'flare', hand: [27, 4], glove: 'point', hold: 27, staff: 122, staffBehind: true, orb: 1, flash: 2, tip: -4, tilt: 2, sway: -2, curlL: 4, droop: 8, lag: -1 },
      { neck: [5, 3], eyes: 'open', hand: [26, 4], glove: 'point', hold: 27, staff: 120, staffBehind: true, orb: 0, tip: -2, tilt: 1, sway: -1, droop: 9, lag: 1 },
      { flap: 1, neck: [2, 1], eyes: 'open', hand: [26, 1], hold: 30, staff: 40, tip: 1, droop: 8, lag: 1 },
      // planted again: the hand leans the staff past upright, then settles it
      { flap: -1, neck: [0, 0], eyes: 'open', hand: [27, 4], tip: 2, sway: 1, droop: 8 },
      { neck: [-1, 0], tip: 1, droop: 8, lag: -1 },
      {},
    ],
  },

  // hit: the breath knocks the wizard back — recoil with the hat knocked askew and the eyes
  // squeezed, then ONE continuous loss of balance: the lean, the hat and the squeezed eyes hold
  // while only the hat tip, the hem flap and the planted staff (pivoting on its foot) wobble; the
  // arm stays out, clutching the staff for support, so the orb stays clear of the hat. It ends
  // broken (death continues from here).
  hit: {
    loop: false,
    marks: { impact: 1 },
    durations: [40, 150, 110, 90, 90, 130],
    keys: [
      { eyes: 'wide', neck: [0, 0] },
      { flap: -2, neck: [-6, 2], head: [-1, 0], hat: [-3, -3], tilt: -7, tip: 5, eyes: 'squeeze', hand: [23, 1], sway: 3, curlR: 5, droop: 5, lag: 3 },
      { flap: 1, neck: [-7, 3], head: [-1, 0], hat: [-4, -2], tilt: -9, tip: 3, eyes: 'squeeze', hand: [26, 4], sway: 3, curlR: 4, droop: 6, lag: 3 },
      { flap: -1, neck: [-6, 3], head: [-1, 0], hat: [-3, -1], tilt: -8, tip: 0, eyes: 'squeeze', hand: [24, 4], sway: 2, curlR: 4, droop: 6, lag: 2 },
      { flap: 1, neck: [-5, 3], hat: [-3, -1], tilt: -7, tip: 2, eyes: 'squeeze', hand: [26, 5], sway: 2, droop: 7, lag: 1 },
      { neck: [-5, 4], hat: [-3, 0], tilt: -6, tip: 0, eyes: 'half', hand: [25, 6], sway: 1, droop: 8 },
    ],
  },

  // death: stagger back, the knees give and the limp hand lets the staff go; the body collapses onto
  // its robe while the staff topples FORWARD and lands on the floor in front of the robe (the spent
  // orb rolls out of its cradle); then (dissolve) the body erodes into purple pixels, eyes last.
  death: {
    loop: false,
    marks: { dissolve: 6 },
    durations: [120, 160, 100, 100, 130, 200, 90, 90, 90, 90, 90, 90, 90, 110, 140, 120],
    keys: [
      // stagger back (continues the hit), eyes dimming
      { neck: [-6, 5], hat: [-4, 0], tilt: -8, tip: 2, eyes: 'dim', hand: [25, 7], sway: 2, droop: 7 },
      // the knees give: the body drops and pitches forward, the hat slips back, the hand opens
      { flap: -1, neck: [-2, 9], hat: [-5, -1], tilt: -10, tip: 4, eyes: 'dim', hand: [23, 8], glove: 'hang', free: [25, 0], staff: 4, belly: 3, flare: 1, sway: 1, droop: 6 },
      // sinking: the robe spreads, the hat tumbles back, the staff topples forward
      { flap: 2, neck: [0, 13], hat: [-8, 1], tilt: -12, tip: 3, eyes: 'half', hand: [19, 12], glove: 'hang', free: [22, 1], staff: 30, belly: 4, flare: 3, droop: 4 },
      // collapsed onto the robe; the hat lands behind, the face still glows; the staff falls
      { flap: 2, neck: [1, 18], hat: [-11, 4], tilt: -12, tip: -2, eyes: 'dim', hand: [18, 12], glove: 'hang', free: [13, 3], staff: 58, orb: 4, belly: 5, flare: 5, curlL: 4, curlR: 4, droop: 3 },
      // the staff hits the floor (a hair past its resting angle)
      { flap: 1, neck: [1, 20], hat: [-11, 5], tilt: -11, tip: 1, eyes: 'dim', hand: [18, 12], glove: 'hang', free: [1, 5], staff: 75, orb: 4, belly: 5, flare: 6, curlL: 5, curlR: 5, droop: 2 },
      { ...DEAD, eyes: 'half', roll: [1, 1] },
      ...[0.14, 0.27, 0.4, 0.52, 0.63, 0.73, 0.82, 0.9, 0.96].map((e) => ({ ...DEAD, erode: e, eyes: e < 0.5 ? ('dim' as const) : e < 0.75 ? ('half' as const) : ('open' as const) })),
      { erode: 2 },
    ],
  },
};

const ORDER: WizardAnim[] = ['summon', 'idle', 'attack', 'hit', 'death'];
const ANIMS = Object.fromEntries(
  ORDER.map((a) => [a, { durations: DEFS[a].durations, loop: DEFS[a].loop, ...(DEFS[a].marks ? { marks: DEFS[a].marks } : {}) }]),
) as Record<WizardAnim, LabAnim>;

function poseOf(anim: WizardAnim, f: number): Pose {
  const keys = DEFS[anim].keys;
  return { ...REST, ...keys[clamp(Math.floor(f), 0, keys.length - 1)] };
}

const wizard: LabMonsterArt<WizardAnim> = {
  id: 'a_wizard',
  name: 'Uçurum Büyücüsü',
  w: W,
  h: H,
  anchorX: GX,
  anchorY: GY + 2,
  hover: 0,
  anims: ANIMS,
  draw(p: PixelCanvas, anim: WizardAnim, f: number) {
    const ps = poseOf(anim, f);
    if (ps.erode >= 1) return; // the last death frame is empty
    drawPose(p, ps);
  },
  points(anim: WizardAnim, f: number): LabFramePoints {
    const ps = poseOf(anim, f);
    const g = geometry(ps);
    return {
      core: { x: g.neck[0] - 1, y: Math.min(GY - 8, g.neck[1] + 16) },
      muzzle: { x: g.orb[0], y: g.orb[1] },
      orb: { x: g.orb[0], y: g.orb[1] },
      head: { x: g.face[0], y: g.face[1] },
      eyes: { x: g.face[0], y: g.face[1] - 2 },
    };
  },
};

export default wizard;
