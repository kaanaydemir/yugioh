// Art Lab B — "Uçurum Büyücüsü": a tall, serious hooded sorcerer (variant B, warm but majestic).
//
// Drawn facing RIGHT (the lab mirrors it), 1 art px = 1 game px. Adult proportions: the hooded head
// is ~1/6.5 of the standing height (A's chibi witch is ~1/2). A frame is a POSE (numbers) rendered
// back to front by the rig (wizard-rig.ts): the outer cloak (behind the body, a warp of the unit
// square between curves hung from the shoulders and pooled on the floor, its tube folds and gold hem
// attached to the cloth) → the far arm (violet sleeve, 2-bone IK, bell cuff) and its glove → the
// inner robe below the belt (draped over the forward knee: contrapposto, the weight on the back
// leg) → the bodice → the long wine front panel from the throat to the hem → the belt and buckle →
// [the cloak wrapped in front, summon only] → the high standing collar → the far pauldron → the far
// horn, the hood with the shadowed face and the glowing slanted eyes, the near horn (one rigid
// stamp, tilted by whole-pixel shears) → the near arm → the near pauldron → boot tip → staff → the
// gloved fist round the shaft → the gold claw and the orb. The outline is selective: plum ink below
// and on the shadow side, the colour's own lit line on top / in front, and where the low sun behind
// the wizard rims the cloak, hood, collar and pauldrons (its back, the drawn left) a warm purple.
// Key light: from the upper front (the drawn right), like A's wizard.
//
// Every animation frame is an explicitly keyed pose with its own hold; leaning, kneeling and the
// collapse move the skeleton (hip, neck, knee, hands) and the cloth is re-laid over it — the sprite
// is never scaled, rotated or shaken. The hem stays on the ground row; a planted staff pivots on its
// foot pixel; the front boot is keyed on its own (planted while knee and hem move over it; a step
// lifts it, moves it and plants it) — feet never slide.
//
// Frame 160×166, anchor (46, 131). The standing idle pose is only 67×102 (3660 px; A's chibi is
// 63×84, 3569 px — B is taller and narrower), but: the attack thrusts the staff forward and down at
// the dragon with the arm straight (steeply, so in the scene the shaft crosses the arena's back rail
// instead of lying along it; orb + burst ~90 px in front of the anchor), the summon lifts the staff
// overhead (orb + sparkles ~124 px above the ground), the hit whips the cloak ~42 px behind the
// anchor, and the dropped staff topples WHOLE and comes to lie on the floor in front of the hem,
// toward the dragon and a little toward the camera (89 → 85 → 79 → 78 px: only the foreshortening
// of a staff tipping toward the viewer; orb ~93 px ahead and ~23 px down: clear of the dragon in
// the scene and inside the 2× inspection view). Every frame keeps ≥4 px of margin (measured: hit f1 left,
// summon f8 top 4 px; death f5 bottom 5 px, death f4 right 6 px). A bigger
// DRAWING SURFACE, not a higher resolution — 1 art pixel is still 1 game pixel.

import { PixelCanvas } from '../../art/pixel';
import type { LabAnim, LabFramePoints, LabMonsterArt, WizardAnim } from '../types';
import { BOOT, BOOT_SOLE, BUCKLE, COLLAR, EYES, HANDS, HOOD, HORN_FAR, HORN_NEAR, KEY, ORBS, PAULDRON_BACK, PAULDRON_FRONT, SIGIL, type EyeKind, type HandKind } from './wizard-maps';
import {
  CL,
  Cloth,
  FS,
  GO,
  LE,
  MG,
  VI,
  WI,
  bez2,
  bez3,
  clamp,
  composite,
  coons,
  drapeTone,
  scallopHem,
  type Crease,
  foldTone,
  drawClaw,
  drawClawFront,
  drawStaff,
  hash2,
  lerp,
  notchHem,
  paintFolds,
  poly,
  seg,
  selectiveOutline,
  shear,
  spline,
  stamp,
  staffDir,
  widthAt,
  type Curve,
  type Valley,
  type V2,
} from './wizard-rig';

const W = 160;
const H = 166;
const GX = 46; // body centre column (the anchor)
const GY = 129; // ground row (front of the hem)

type Hand = HandKind | 'none';

interface Pose {
  /** Pelvis offset from rest (+x forward, +y down): crouch / kneel. */
  hip: V2;
  /** Neck offset relative to where the hip carries it (lean). */
  chest: V2;
  /** Face offset from its place on the neck; hood tilt (px at the hood top, + forward bow). */
  head: V2;
  tilt: number;
  /** Chest / shoulders rise (breath) and the near shoulder's extra lift (arm raised). */
  breath: number;
  lift: number;
  /** The forward knee under the robe (offset from rest) and the hem's front / back ends. */
  knee: V2;
  hemF: number;
  hemB: number;
  /**
   * The front boot: its toe (px in front of its rest place) and its lift off the floor. It is
   * keyed on its own — knee and hem move over a PLANTED boot; a step lifts it, moves it, plants it.
   */
  bootX: number;
  step: number;
  /** Kneeling: the back foot's boot sole shows behind the hem (toes on the floor, heel up). */
  sole: boolean;
  /** Near hand: the grip (offset from the rest grip) and its glove; far hand likewise. */
  hand: V2;
  handKind: Hand;
  bhand: V2;
  bhandKind: Hand;
  /** The far arm crosses in front of the body (gathering magic before the chest). */
  bfront: boolean;
  /**
   * Staff angle (deg, 0 up, + top forward) when held: hold = grip → top (cup). hold 0: PLANTED at
   * `foot` (px in front of the anchor) — it pivots there toward the hand and `staff` is ignored.
   */
  staff: number;
  hold: number;
  foot: number;
  /** Dropped staff: its foot (relative to the ground centre) and the length it shows (foreshortened). */
  free: V2 | null;
  freeLen: number;
  /** Staff depth: 0 in front; 1 all behind the body; 2 behind above the shoulders, in front below. */
  behind: 0 | 1 | 2;
  /** Cloth: robe hem lag, cloak back flare, cloak hem lag, back corner curl, billow, panel lag, wrap. */
  sway: number;
  cloak: number;
  cloakLag: number;
  curl: number;
  billow: number;
  tab: number;
  wrap: number;
  /** Magic: eyes, orb step, orb sparkles, release burst, wisps round the free hand, summon ghost. */
  eyes: EyeKind | 'none';
  orb: number;
  spark: number;
  flash: number;
  wisp: number;
  ghost: number;
  /** Bowed far forward (collapse): the chest faces the floor, the cloak drapes over the back. */
  bowed: boolean;
  /** Death: erosion progress 0..1. */
  erode: number;
}

const REST: Pose = {
  hip: [0, 0],
  chest: [0, 0],
  head: [0, 0],
  tilt: 0,
  breath: 0,
  lift: 0,
  knee: [0, 0],
  hemF: 0,
  hemB: 0,
  bootX: 0,
  step: 0,
  sole: false,
  hand: [0, 0],
  handKind: 'gripV',
  bhand: [0, 0],
  bhandKind: 'rest',
  bfront: false,
  staff: 0,
  hold: 0,
  foot: 24,
  free: null,
  freeLen: 89,
  behind: 0,
  sway: 0,
  cloak: 0,
  cloakLag: 0,
  curl: 2,
  billow: 0,
  tab: 0,
  wrap: 0,
  eyes: 'open',
  orb: 0,
  spark: 0,
  flash: 0,
  wisp: 0,
  ghost: 0,
  bowed: false,
  erode: 0,
};

const HIP0: V2 = [GX + 1, GY - 46];
const NECK0: V2 = [GX + 1, GY - 71];
const GRIP0: V2 = [GX + 24, GY - 52];
const BHAND0: V2 = [GX - 15, GY - 41];
const KNEE0: V2 = [GX + 14, GY - 25];
/** The far shoulder at rest. */
const SB0: V2 = [NECK0[0] - 10, NECK0[1] + 4];
const STAFF_LEN = 89;
const ORB_R = 4;
/** Arm bones (shoulder → elbow → wrist). */
const UPPER = 13;
const FORE = 12;

const add = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
const rot = (v: V2, c: number, s: number): V2 => [v[0] * c - v[1] * s, v[0] * s + v[1] * c];

/** Where the wrist sits relative to the glove's anchor (the sleeve's cuff meets it there). */
const WRIST: Record<HandKind, V2> = {
  gripV: [-3, 0],
  gripLoose: [-3, 0],
  gripD: [-3, 0],
  gripH: [-3, -1],
  rest: [0, -1],
  open: [0, -1],
  gather: [-1, 1],
  splay: [-1, 2],
  brace: [0, -1],
};

interface Geo {
  hip: V2;
  neck: V2;
  /** Unit spine direction (hip → neck) and its rotation (cos, sin) from upright. */
  spine: V2;
  rc: number;
  rs: number;
  face: V2;
  sB: V2;
  sF: V2;
  grip: V2;
  bhand: V2;
  knee: V2;
  foot: V2;
  top: V2;
  dir: V2;
  orb: V2;
  len: number;
}

function geometry(ps: Pose): Geo {
  const hip = add(HIP0, ps.hip);
  const n0 = add(add(NECK0, ps.hip), ps.chest);
  const neck: V2 = [n0[0], n0[1] - ps.breath];
  const sl = Math.hypot(neck[0] - hip[0], neck[1] - hip[1]) || 1;
  const spine: V2 = [(neck[0] - hip[0]) / sl, (neck[1] - hip[1]) / sl];
  // rotation of the upper body from upright (spine (0, -1)): clockwise = leaning forward
  const rs = spine[0];
  const rc = -spine[1];
  const face = add(add(neck, rot([3, -8], rc, rs)), ps.head);
  const sB = add(neck, rot([-10, 4], rc, rs));
  const sF = add(add(neck, rot([11, 4], rc, rs)), [0, -ps.lift]);
  const grip = add(GRIP0, ps.hand);
  // the free hand hangs from its shoulder: it follows the far shoulder's displacement from rest
  const bhand = add(add(BHAND0, ps.bhand), [sB[0] - SB0[0], sB[1] - SB0[1]]);
  const knee = add(KNEE0, ps.knee);
  let dir = staffDir(ps.staff);
  let foot: V2;
  let top: V2;
  let len = STAFF_LEN;
  if (ps.free) {
    len = ps.freeLen;
    foot = [GX + ps.free[0], GY + ps.free[1]];
    top = [foot[0] + dir[0] * len, foot[1] + dir[1] * len];
  } else if (ps.hold > 0) {
    top = [grip[0] + dir[0] * ps.hold, grip[1] + dir[1] * ps.hold];
    foot = [grip[0] - dir[0] * (STAFF_LEN - ps.hold), grip[1] - dir[1] * (STAFF_LEN - ps.hold)];
  } else {
    foot = [GX + ps.foot, GY];
    const l = Math.hypot(grip[0] - foot[0], grip[1] - foot[1]) || 1;
    dir = [(grip[0] - foot[0]) / l, (grip[1] - foot[1]) / l];
    top = [foot[0] + dir[0] * STAFF_LEN, foot[1] + dir[1] * STAFF_LEN];
  }
  const orb: V2 = [Math.round(top[0] + dir[0] * (ORB_R + 2)), Math.round(top[1] + dir[1] * (ORB_R + 2))];
  return { hip, neck, spine, rc, rs, face, sB, sF, grip, bhand, knee, foot, top, dir, orb, len };
}

/** 2-bone IK: the elbow for a shoulder → wrist reach, bending toward `side` (a direction hint). */
function elbow(S: V2, Wr: V2, side: V2): V2 {
  const dx = Wr[0] - S[0];
  const dy = Wr[1] - S[1];
  const d = Math.min(UPPER + FORE - 0.05, Math.max(0.5, Math.hypot(dx, dy)));
  const ux = dx / (Math.hypot(dx, dy) || 1);
  const uy = dy / (Math.hypot(dx, dy) || 1);
  const a = (UPPER * UPPER - FORE * FORE + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  let px = -uy;
  let py = ux;
  if (px * side[0] + py * side[1] < 0) {
    px = -px;
    py = -py;
  }
  return [S[0] + ux * a + px * h, S[1] + uy * a + py * h];
}

// ------------------------------------------------------------------ cloth parts

function lam(u: number, peak: number, k = 2.6): number {
  return Math.max(0, Math.cos((u - peak) * k));
}
const mid2 = (a: V2, b: V2): V2 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Hem of a cloth on the floor: the front half of an ellipse from xl to xr, its sides `arc` px higher. */
function floorHem(xl: number, xr: number, arc: number, uc: number, lift?: (u: number) => number): Curve {
  return (u) => {
    const x = xl + (xr - xl) * u;
    const e = clamp((u - uc) / (u < uc ? uc : 1 - uc), -1, 1);
    return [x, GY - arc * (1 - Math.sqrt(Math.max(0, 1 - e * e))) - (lift ? lift(u) : 0)];
  };
}

/** The outer cloak, behind the body: wide at the back, its open front tucked behind the robe. */
function drawCloak(ps: Pose, g: Geo): PixelCanvas {
  const n = g.neck;
  const lag = ps.cloakLag;
  const up = ps.billow;
  const tl = add(n, rot([-11, 2], g.rc, g.rs));
  const tr = add(n, rot([12, 2], g.rc, g.rs));
  const sy = tl[1] + 6;
  const yk = (k: number) => lerp(sy, GY, k);
  const curl = ps.curl;
  // the floor flare (a bell, not a straight stair) is pulled in as the cloak is whipped off the floor
  const flare = 4 * clamp(1 - ps.cloak / 8, 0, 1);
  const hem = floorHem(GX - 29 - flare - ps.cloak + lag + ps.hemB, GX + 12 + lag * 0.5 + ps.hemF * 0.6, 4, 0.62, (u) => (u < 0.12 ? curl * Math.pow((0.12 - u) / 0.12, 1.5) : 0));
  const top: Curve = bez2(tl, [n[0], n[1] - 2], tr);
  // the back edge: out over the far pauldron, falling nearly straight, then flaring to the hem
  const bx = Math.min(tl[0], n[0] - 11);
  const back: Curve = spline([
    tl,
    [bx - 5 - up * 0.4, tl[1] + 6 - up * 0.3],
    [bx - 7 - up + lag * 0.1, yk(0.35)],
    [GX - 20 - ps.cloak * 0.3 - up * 1.4 + lag * 0.4 + ps.hemB * 0.5, yk(0.68)],
    [GX - 26 - flare * 0.4 - ps.cloak * 0.7 - up + lag * 0.8 + ps.hemB, yk(0.88) - curl * 0.5],
    hem(0),
  ]);
  const front: Curve = spline([tr, [tr[0] + 3, tr[1] + 10], [GX + 14 + lag * 0.3 + ps.hemF * 0.5, yk(0.55)], hem(1)]);
  const cl = new Cloth(W, H, coons(top, hem, back, front), CL, 20, 26);
  // the back drapes over the far shoulder and arm (a lit shoulder of cloth), then hangs in tubes: a
  // deep fold born under the far arm, a second one opening at mid-height and a third low in the
  // flare — they fan out toward the floor and end in scallops
  const CR: Crease[] = [
    { u0: 0.21, u1: 0.3, v0: 0.26 },
    { u0: 0.14, u1: 0.195, v0: 0.42 },
    { u0: 0.08, u1: 0.09, v0: 0.6 },
  ];
  cl.shade((u, v) => {
    const sh = v < 0.32 && u < 0.24 ? 1.1 * (1 - v / 0.32) : 0;
    return drapeTone(u, v, CR, (uu, vv) => (vv < 0.3 ? 1.3 + sh : vv > 0.62 && uu < 0.2 ? 2 : 1), widthAt(cl, v));
  });
  scallopHem(cl, CR, 0, 0.5);
  const p = cl.toCanvas();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.has(x, y)) continue;
      const u = cl.u(x, y);
      const v = cl.v(x, y);
      // the open front shows the dark lining, a thin gold edge on the turned-back border
      if (u > 0.82) p.set(x, y, cl.edge(x, y, 'right') ? (v < 0.3 ? GO[1] : GO[2]) : u > 0.9 && v > 0.2 ? CL[1] : CL[0]);
      // gold along the hem; the curled back corner shows the lining
      if (cl.edge(x, y, 'down')) p.set(x, y, u < 0.35 ? GO[1] : GO[2]);
      else if (u < 0.1 && v > 0.86 && (cl.edge(x, y + 1, 'down') || cl.edge(x, y + 2, 'down'))) p.set(x, y, CL[0]);
    }
  return p;
}

/**
 * One fold of the cloak comes round the back hip OVER the inner robe: from the hip down, the cloak
 * laps over the robe's back edge by up to 2 px — the cloak's own tube carried on, a lit turning
 * edge in front and the robe in a contact shadow just in front of it; its foot keeps the gold hem.
 */
function drawCloakLap(cloak: PixelCanvas, skirt: PixelCanvas, g: Geo): PixelCanvas {
  const lap = new PixelCanvas(W, H);
  const y0 = Math.round(g.hip[1]) + 3;
  for (let y = y0; y <= GY + 1; y++) {
    let xs = -1;
    for (let x = 0; x < W; x++)
      if (skirt.isOpaque(x, y)) {
        xs = x;
        break;
      }
    if (xs < 0) continue;
    const k = clamp((y - y0) / 14, 0, 1);
    const ov = Math.round(2 * k * k * (3 - 2 * k));
    for (let i = 0; i < ov; i++) {
      const x = xs + i;
      const c = cloak.get(x, y);
      if (c === null) continue;
      const hem = c === GO[1] || c === GO[2];
      lap.set(x, y, hem || i < ov - 1 ? c : CL[3]);
    }
    const xe = xs + ov;
    if (ov > 0 && lap.isOpaque(xe - 1, y) && skirt.isOpaque(xe, y)) {
      const c = skirt.get(xe, y)!;
      if (c !== GO[1] && c !== GO[2]) lap.set(xe, y, c === VI[0] ? VI[0] : VI[1]);
    }
  }
  return lap;
}

/**
 * The cloak wrapped round the body (summon): a heavy front drape from the shoulders to the floor,
 * closed down the front by a gold-edged overlap; `wrap` < 1 parts it (the overlap opens from the
 * hem up) until it is gone behind the body. Kneeling, it drapes over the forward thigh: the lap is a
 * lit plane, the knee the front-most point of the silhouette, and from the knee the cloth falls
 * straight to the floor (its underside in shadow) — the back foot's sole shows behind the hem.
 */
function drawWrap(ps: Pose, g: Geo): PixelCanvas | null {
  if (ps.wrap <= 0) return null;
  const n = g.neck;
  const k = g.knee;
  const kb = clamp(ps.knee[0] / 10, 0, 1); // how far the knee is pushed out (kneeling = 1)
  const tl = add(n, rot([-9, 3], g.rc, g.rs));
  const tr = add(n, rot([13, 3], g.rc, g.rs));
  const hem = floorHem(GX - 16 + ps.hemB, GX + 18 + ps.hemF, 3, 0.55);
  const back = bez3(tl, [tl[0] - 5, tl[1] + 14], [GX - 17 + ps.hemB, GY - 16], hem(0));
  // shoulder → over the forearm → down onto the lap → the knee (front-most) → straight down
  const lap: V2 = [lerp(tr[0] + 4, k[0] - 3, kb), lerp(tr[1] + 9, k[1] - 6, kb)];
  const front = spline([tr, lap, [k[0] + 3, k[1] - 1 * kb], [k[0] + 4 - 3 * kb, lerp(k[1], GY, 0.55)], hem(1)]);
  const cl = new Cloth(W, H, coons(bez2(tl, [n[0] + 2, n[1] + 1], tr), hem, back, front), CL, 16, 22);
  const VAL: Valley[] = [
    { u0: 0.22, v0: 0.28, u1: 0.15, plane: 3 },
    { u0: 0.76, v0: 0.52, u1: 0.74, plane: 2 }, // hangs from the knee
  ];
  // the cloth stretched over the knee catches the light (an oval plane round the knee's top), just
  // under the knee it turns away into shadow
  const kx = k[0] + 1;
  const ky = k[1] - 1;
  cl.shade((u, v, x, y) => {
    const base = (uu: number) => 1.4 + 1.6 * lam(uu, 0.86, 2.4) + (v < 0.14 ? 0.4 : 0);
    let t = foldTone(u, v, VAL, base, widthAt(cl, v));
    if (kb > 0.3) {
      const e = ((x - kx) / 6) ** 2 + ((y - ky) / 2.6) ** 2;
      if (e < 1 && y <= ky + 1) t += e < 0.35 && x > kx - 2 ? 2 : 1;
      else if (y >= ky + 3 && y <= ky + 4 && x > kx - 6) t -= 1;
    }
    return t;
  });
  notchHem(cl, VAL, 1);
  // the overlap line: a gold edge from the collar down the front; it parts from the hem up
  const open = (1 - ps.wrap) * 0.9;
  const lineU = (v: number) => lerp(0.46, 0.5, v);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.has(x, y)) continue;
      const u = cl.u(x, y);
      const v = cl.v(x, y);
      const gap = open * Math.pow(v, 0.7) * 0.5;
      if (Math.abs(u - lineU(v)) < gap) cl.tone[y * W + x] = -1;
    }
  const p = cl.toCanvas();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.has(x, y)) continue;
      const u = cl.u(x, y);
      if (cl.edge(x, y, 'down')) p.set(x, y, u < 0.4 ? GO[1] : GO[2]);
      // the overlapping edge (its right side over its left): gold, with a shadow under it
      else {
        const L = lineU(cl.v(x, y)) + 0.02;
        if (u < L && cl.has(x + 1, y) && cl.u(x + 1, y) >= L) p.set(x, y, CL[0]);
        else if (u >= L && cl.has(x - 1, y) && cl.u(x - 1, y) < L) p.set(x, y, GO[2]);
        // where the wrap has parted, its two edges show the dark lining
        else if ((cl.edge(x, y, 'left') && u > 0.3) || (cl.edge(x, y, 'right') && u < 0.7)) p.set(x, y, CL[0]);
      }
    }
  if (ps.sole) {
    // the back foot: toes on the floor, heel up, its sole turned back (behind the hem's back corner)
    const sole = new PixelCanvas(W, H);
    stamp(sole, BOOT_SOLE, Math.round(hem(0)[0]) + 2, GY, KEY);
    composite(sole, p, 0);
    return sole;
  }
  return p;
}
/**
 * The inner robe below the belt (violet): narrow at the waist, draped over the forward front knee
 * (contrapposto: the weight on the back leg), long folds to a gold hem lifted over the boot.
 */
function drawSkirt(ps: Pose, g: Geo): { canvas: PixelCanvas; belt: Curve } {
  const h = g.hip;
  const BL: V2 = [h[0] - 7, h[1] - 2];
  const BR: V2 = [h[0] + 8, h[1] - 2];
  const belt = bez2(BL, [h[0] + 1, h[1] + 1], BR);
  const sw = ps.sway;
  const k = g.knee;
  // the hem lifts over the boot tip (and with the boot when it steps)
  const hem = floorHem(GX - 17 + sw * 0.5 + ps.hemB, GX + 16 + sw + ps.hemF, 3, 0.5, (u) => (u > 0.74 && u < 0.97 ? 1.6 * Math.sin(((u - 0.74) / 0.23) * Math.PI) : 0) + ps.step * clamp((u - 0.62) / 0.26, 0, 1));
  const H0 = hem(0);
  const back = bez3(BL, [BL[0] - 2, BL[1] + 12], [H0[0] + 1, GY - 16], H0);
  const thigh: V2 = [lerp(BR[0], k[0], 0.5) + 1.5, lerp(BR[1], k[1], 0.4)];
  const front = spline([BR, thigh, k, [k[0] + 1 + sw * 0.5, lerp(k[1], GY, 0.55)], hem(1)]);
  const cl = new Cloth(W, H, coons(belt, hem, back, front), VI, 16, 26);
  // the drape: creases gathered under the belt at the back hip fan out toward the floor (tubes of
  // different widths behind the panel) and one fold hangs from the forward knee. Low down the
  // creases trail the body's sway by a pixel, so the hem scallops lag behind it.
  const lag = sw / Math.max(8, Math.abs(hem(1)[0] - hem(0)[0]));
  const CR: Crease[] = [
    { u0: 0.11, u1: 0.16 + lag, v0: 0.03 },
    { u0: 0.22, u1: 0.34 + lag, v0: 0.02 },
    { u0: 0.4, u1: 0.55 + lag, v0: 0.12 },
    { u0: 0.72, u1: 0.8, v0: 0.06 }, // under the panel: it bounds the lit forward thigh
    { u0: 0.93, u1: 0.9, v0: 0.5 },
  ];
  cl.shade((u, v) => {
    // banded light: the rearmost tube in the cloak's shadow, the middle mid-tone, the forward thigh
    // lit above the knee; just under the belt the gathered cloth is a tone darker
    const base = (uu: number, vv: number) => (uu < 0.16 ? 2 : uu < 0.8 ? 3 : vv < 0.5 ? 4 : 3) - (vv < 0.04 ? 1 : 0);
    return drapeTone(u, v, CR, base, widthAt(cl, v));
  });
  scallopHem(cl, CR);
  const p = cl.toCanvas();
  // hem: a gold band (lit on the front half) that follows the scallops, a dark turn-back above it
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.edge(x, y, 'down')) continue;
      const u = cl.u(x, y);
      p.set(x, y, u > 0.45 ? GO[2] : GO[1]);
      if (cl.has(x, y - 1) && !cl.edge(x, y - 1, 'down')) p.set(x, y - 1, u > 0.45 ? VI[1] : VI[0]);
    }
  return { canvas: p, belt };
}

/** The bodice: violet chest between the pauldrons, down to the belt. */
function drawTorso(g: Geo, belt: Curve): PixelCanvas {
  const n = g.neck;
  const tl = add(n, rot([-9, 1], g.rc, g.rs));
  const tr = add(n, rot([10, 1], g.rc, g.rs));
  const top = bez2(tl, add(n, rot([0, -3], g.rc, g.rs)), tr);
  const b0 = belt(0);
  const b1 = belt(1);
  const back = bez3(tl, add(tl, rot([-1, 8], g.rc, g.rs)), [b0[0] - 1, b0[1] - 8 * g.rc], b0);
  const front = bez3(tr, add(tr, rot([2, 6], g.rc, g.rs)), [b1[0] + 1, b1[1] - 8 * g.rc], b1);
  const cl = new Cloth(W, H, coons(top, belt, back, front), VI, 12, 14);
  cl.shade((u, v) => 1.2 + 2.0 * lam(u, 0.78, 2.4) - (v > 0.8 ? 0.4 : 0));
  cl.despeckle();
  paintFolds(cl, [
    { u0: 0.2, v0: 0.45, u1: 0.3, v1: 1, w: 1, ridge: 1 },
    { u0: 0.92, v0: 0.4, u1: 0.86, v1: 1, w: 1, ridge: 1 },
  ]);
  return cl.toCanvas();
}

/**
 * The long front panel: from the throat (narrow, between the pauldrons) down under the belt to just
 * above the hem — deep wine between gold edges, a sigil near its foot. Its lower half lags (tab).
 */
function drawPanel(ps: Pose, g: Geo, belt: Curve): PixelCanvas {
  const n = g.neck;
  const tL = add(n, rot([2, 3], g.rc, g.rs));
  const tR = add(n, rot([6, 3], g.rc, g.rs));
  const mL = belt(0.48);
  const mR = belt(0.9);
  const hL: V2 = [Math.max(mL[0] - 2, GX + 1 + ps.hemF * 0.4) + ps.tab, GY - 4];
  const hR: V2 = [hL[0] + 9, GY - 4];
  const lagL: V2 = [mid2(mL, hL)[0] - ps.tab * 0.4, mid2(mL, hL)[1]];
  const lagR: V2 = [mid2(mR, hR)[0] - ps.tab * 0.4, mid2(mR, hR)[1]];
  const left = poly([tL, [mL[0], mL[1] - 1], lagL, hL]);
  const right = poly([tR, [mR[0], mR[1] - 1], lagR, hR]);
  const bottom = bez2(hL, [(hL[0] + hR[0]) / 2, GY - 2], hR);
  const cl = new Cloth(W, H, coons(seg(tL, tR), bottom, left, right), WI, 8, 30);
  cl.shade((u) => 1.5 + 1.5 * lam(u, 0.8, 2.6));
  cl.despeckle();
  paintFolds(cl, [{ u0: 0.45, v0: 0.45, u1: 0.42, v1: 1, w: 1, ridge: 1 }]);
  const p = cl.toCanvas();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.has(x, y)) continue;
      if (cl.edge(x, y, 'left')) p.set(x, y, GO[1]);
      else if (cl.edge(x, y, 'right')) p.set(x, y, GO[3]);
      if (cl.edge(x, y, 'down')) p.set(x, y, GO[2]);
    }
  const m = cl.f(0.5, 0.88);
  stamp(p, SIGIL, Math.round(m[0]), Math.round(m[1]), KEY, { mask: p });
  return p;
}

/**
 * A sleeve of the inner robe: a violet tube along shoulder → elbow → wrist that flares into a bell
 * cuff. The cuff is a narrow gold band at the very end (`cuffPx` along the arm; lit gold on top,
 * dark gold underneath); the lit edge of the tube carries a light violet line so the arm reads in
 * front of the violet bodice, its underside the darkest tone.
 */
function drawSleeve(pts: V2[], r: number[], cuffPx = 2.5): PixelCanvas {
  const L = pts.length;
  const off = (sign: number): V2[] =>
    pts.map((q, i) => {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(L - 1, i + 1)];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy) || 1;
      return [q[0] + (sign * -dy * r[i]) / l, q[1] + (sign * dx * r[i]) / l];
    });
  const A = off(1);
  const B = off(-1);
  const f = coons(seg(A[0], B[0]), seg(A[L - 1], B[L - 1]), poly(A), poly(B));
  const cl = new Cloth(W, H, f, VI, 6, 18);
  const mid = Math.floor(L / 2);
  const litB = B[mid][0] - A[mid][0] - (B[mid][1] - A[mid][1]) > 0;
  let len = 0;
  for (let i = 1; i < L; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  const vCuff = 1 - cuffPx / Math.max(1, len);
  const vElbow = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / Math.max(1, len);
  cl.shade((u) => {
    const s = litB ? u : 1 - u;
    return 1.1 + 2.2 * Math.max(0, Math.cos((s - 0.72) * 2.6));
  });
  cl.despeckle();
  const p = cl.toCanvas();
  const outside = (x: number, y: number) => !cl.has(x, y);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!cl.has(x, y)) continue;
      const v = cl.v(x, y);
      const s = litB ? cl.u(x, y) : 1 - cl.u(x, y);
      if (v > vCuff) p.set(x, y, s > 0.5 ? GO[3] : GO[1]);
      else if (v > vCuff - 0.06 && s > 0.5) p.set(x, y, VI[4]); // the sleeve's lip over the cuff
      else if (s > 0.8 && (outside(x, y - 1) || outside(x + 1, y)) && v > vElbow * 0.55) p.set(x, y, VI[4]);
      else if (s < 0.25 && (outside(x, y + 1) || outside(x - 1, y))) p.set(x, y, VI[0]);
    }
  return p;
}

/** An arm (sleeve + glove) from a shoulder to a hand, the elbow bending toward `side`. */
function drawArm(S: V2, hand: V2, kind: Hand, side: V2): { sleeve: PixelCanvas; glove: PixelCanvas } {
  const wr = kind === 'none' ? hand : add(hand, WRIST[kind]);
  const E = elbow(S, wr, side);
  const fl = Math.hypot(wr[0] - E[0], wr[1] - E[1]) || 1;
  const cuff: V2 = [wr[0] - ((wr[0] - E[0]) / fl) * 2.5, wr[1] - ((wr[1] - E[1]) / fl) * 2.5];
  const sleeve = drawSleeve([S, E, cuff, wr], [3.6, 3.1, 2.8, 4]);
  const glove = new PixelCanvas(W, H);
  if (kind !== 'none') stamp(glove, HANDS[kind], hand[0], hand[1], KEY);
  return { sleeve, glove };
}

// ------------------------------------------------------------------ magic

const FACE_TONES = new Set<number>(FS);
const M = MG;

function paintEyes(face: PixelCanvas, kind: EyeKind, x: number, y: number): void {
  const eyes = new PixelCanvas(W, H);
  stamp(eyes, EYES[kind], x, y, KEY);
  for (let yy = 0; yy < H; yy++)
    for (let xx = 0; xx < W; xx++) {
      const c = eyes.get(xx, yy);
      if (c === null) continue;
      if (c === M[0] || c === M[1]) {
        const f = face.get(xx, yy);
        if (f === null || !FACE_TONES.has(f)) continue;
      }
      face.set(xx, yy, c);
    }
}

/** Drawn sparkles around the charging orb (hand-placed offsets per level). */
const SPARKS: V2[][] = [
  [],
  [
    [-8, -3],
    [7, -7],
    [2, 9],
  ],
  [
    [-9, -5],
    [8, -8],
    [-6, 8],
    [10, 3],
    [0, -11],
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
function burst(p: PixelCanvas, cx: number, cy: number, level: number): void {
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
  for (const [dx, dy] of rays) {
    const diag = dx !== 0 && dy !== 0;
    const from = ORB_R + (level === 1 ? 2 : 3);
    const to = from + (diag ? 1 : 3) - (level === 2 ? 1 : 0);
    for (let k = from; k <= to; k++) {
      const x = cx + Math.round((dx * k) / (diag ? 1.4 : 1));
      const y = cy + Math.round((dy * k) / (diag ? 1.4 : 1));
      p.set(x, y, level === 1 ? (k === from ? M[5] : M[4]) : k === from ? M[3] : M[2]);
    }
  }
}

/** Magic gathering above the free hand's palm (levels 1–3), hand-drawn. Anchor: the palm. */
const WISPS: { rows: string[]; ax: number; ay: number }[] = [
  { rows: [], ax: 0, ay: 0 },
  { rows: ['.j.', 'i.k', '.h.'], ax: 1, ay: 4 },
  { rows: ['..j..', '.i.k.', 'h.k.i', '.jkj.', '..i..'], ax: 2, ay: 6 },
  { rows: ['...j...', '.i...k.', 'h.jkj.i', '..kkk..', 'i.jkj.h', '.j...i.', '...h...'], ax: 3, ay: 8 },
];
function drawWisps(p: PixelCanvas, hand: V2, level: number): void {
  stamp(p, WISPS[level], hand[0], hand[1], KEY);
}

function drawOrb(p: PixelCanvas, ps: Pose, g: Geo): void {
  drawClaw(p, g.orb[0], g.orb[1], ORB_R, g.dir);
  stamp(p, ORBS[ps.orb], g.orb[0], g.orb[1], KEY);
  drawClawFront(p, g.orb[0], g.orb[1], ORB_R, g.dir);
  for (const [dx, dy] of SPARKS[ps.spark]) sparkle(p, g.orb[0] + dx, g.orb[1] + dy, Math.abs(dx) > 7);
  if (ps.flash) burst(p, g.orb[0], g.orb[1], ps.flash);
}

// ------------------------------------------------------------------ erosion / materialization

const LUM = (c: number) => 0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255);
const M_LUM = M.map(LUM);
function magicIndex(c: number): number {
  const l = LUM(c);
  let best = 0;
  for (let i = 1; i < M.length; i++) if (Math.abs(M_LUM[i] - l) < Math.abs(M_LUM[best] - l)) best = i;
  return best;
}
const GOLD = new Set<number>(GO);
const MAGIC = new Set<number>(M);

function distanceFromOutside(src: PixelCanvas): Float32Array {
  const dist = new Float32Array(W * H).fill(99);
  const q: number[] = [];
  for (let i = 0; i < W * H; i++)
    if (!src.isOpaque(i % W, (i / W) | 0)) {
      dist[i] = 0;
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
      if (dist[j] > dist[i] + 1) {
        dist[j] = dist[i] + 1;
        q.push(j);
      }
    }
  }
  return dist;
}

/**
 * Death erosion, drawn into the frame: from the cloak's edges and the hem UPWARD the body flares into
 * magic colours and vanishes; some vanished pixels drift up as purple motes; the eyes go last. What
 * is left turns to magic gradually from the eroded edge inward (the gold dims first). A dropped staff
 * (foot → orb) erodes the same way but ALONG its length, from its foot by the body out to the orb,
 * a quarter of the shaft per frame over the first four dissolve frames; the orb goes last of it.
 */
function erode(p: PixelCanvas, e: number, eyes: { x0: number; y0: number; x1: number; y1: number }, staff?: { foot: V2; orb: V2 }): void {
  if (e <= 0) return;
  const src = p.clone();
  const dist = distanceFromOutside(src);
  // the staff's own erosion times (shaft + its outline within 2 px of the line; the orb and its claw)
  const ST = new Float32Array(W * H).fill(-1);
  if (staff) {
    const [fx, fy] = staff.foot;
    const dx = staff.orb[0] - fx;
    const dy = staff.orb[1] - fy;
    const L2 = dx * dx + dy * dy || 1;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        if (!src.isOpaque(x, y)) continue;
        const i = y * W + x;
        if (Math.hypot(x - staff.orb[0], y - staff.orb[1]) <= ORB_R + 3.5) {
          ST[i] = 0.56 + 0.05 * hash2(x, y, 24);
          continue;
        }
        const k = clamp(((x - fx) * dx + (y - fy) * dy) / L2, 0, 1);
        if (Math.hypot(x - (fx + dx * k), y - (fy + dy * k)) <= 2.2) ST[i] = 0.22 + 0.3 * k + 0.03 * hash2(x, y, 23);
      }
  }
  let top = H;
  let bot = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (src.isOpaque(x, y) && ST[y * W + x] < 0) {
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
      const d = Math.min(1, dist[i] / 9);
      const high = 1 - (y - top) / span; // 0 at the bottom, 1 at the top
      T[i] = ST[i] >= 0 ? ST[i] : inEyes ? 0.985 : 0.03 + 0.42 * d + 0.36 * high + 0.13 * hash2(x >> 1, y >> 1, 21) + 0.03 * hash2(x, y, 22);
      if (T[i] >= e) keep[i] = inEyes ? 2 : 1;
    }
  // distance of every surviving pixel from the ERODED edge
  const fromGone = new Float32Array(W * H).fill(99);
  {
    const q: number[] = [];
    for (let i = 0; i < W * H; i++)
      if (T[i] >= 0 && !keep[i]) {
        fromGone[i] = 0;
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
        if (fromGone[j] > fromGone[i] + 1) {
          fromGone[j] = fromGone[i] + 1;
          q.push(j);
        }
      }
    }
  }
  const tint = (c: number, rim: number): number => {
    if (e < 0.3) return rim <= 1 ? M[clamp(magicIndex(c) + 2, 1, 4)] : c;
    const mi = magicIndex(c);
    if (e < 0.6) {
      if (rim <= 1) return M[clamp(mi + 2, 1, 4)];
      if (rim <= 3) return GOLD.has(c) ? M[2] : M[clamp(mi + 1, 1, 3)];
      return GOLD.has(c) ? (e < 0.45 ? GO[1] : GO[0]) : c;
    }
    if (e < 0.75) return rim <= 2 ? M[clamp(mi + 2, 2, 4)] : M[clamp(mi + 1, 1, 3)];
    if (e < 0.86) return rim <= 2 ? M[clamp(mi + 3, 3, 4)] : M[clamp(mi + 2, 2, 4)];
    return rim <= 2 ? M[5] : M[clamp(mi + 3, 3, 4)];
  };
  p.clear();
  const cx = GX + 10;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const c = src.get(x, y);
      if (c === null) continue;
      const t = T[i];
      if (keep[i] === 2) p.set(x, y, c);
      else if (keep[i]) p.set(x, y, tint(c, fromGone[i]));
      else if (t >= e - 0.07) p.set(x, y, (e - t) / 0.07 < 0.5 ? M[4] : M[3]);
      else if (t >= e - 0.3 && hash2(x, y, 5) < 0.15) {
        // a mote: drifts up and away from the body, fading through the magic ramp
        const age = (e - 0.07 - t) / 0.23;
        const dx = Math.round(Math.sign(x - cx) * age * (1 + 3 * hash2(x, y, 3)));
        const dy = -Math.round(age * (4 + 10 * hash2(x, y, 4)));
        p.set(x + dx, y + dy, age < 0.45 ? M[3] : age < 0.75 ? M[2] : M[1]);
      }
    }
}

/**
 * Summon materialization: the figure forms out of purple light. Level 2: a dashed outline of light
 * with sparse single-pixel motes inside — densest just within the outline, thinning toward the
 * middle — each drifting up a few pixels with a dim trail under it (the light is gathering upward);
 * level 1: nearly whole, the body still in deep magic tones under a bright magic rim.
 */
function ghostify(p: PixelCanvas, level: number): void {
  const src = p.clone();
  const dist = distanceFromOutside(src);
  p.clear();
  const motes: [number, number, number][] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = src.get(x, y);
      if (c === null) continue;
      const d = dist[y * W + x];
      const mi = magicIndex(c);
      if (level >= 2) {
        if (d <= 1) {
          if (hash2(x, y, 31) < 0.75) p.set(x, y, M[4]);
          continue;
        }
        const density = 0.03 + 0.2 * Math.exp(-(d - 2) / 2.2);
        if (hash2(x, y, 32) >= density) continue;
        const h = hash2(x, y, 34);
        const rise = Math.floor(h * 4); // 0..3 px up
        motes.push([x, y - rise, h < 0.2 ? 5 : h < 0.6 ? 4 : 3]);
        if (rise >= 2 && src.isOpaque(x, y - rise + 1)) motes.push([x, y - rise + 1, 2]);
      } else {
        if (d <= 1) p.set(x, y, M[clamp(mi + 3, 3, 5)]);
        else if (hash2(x, y, 33) < 0.93) p.set(x, y, MAGIC.has(c) ? c : M[clamp(mi, 0, 2)]);
      }
    }
  // trails first, then the motes over them; never over the outline
  motes.sort((a, b) => a[2] - b[2]);
  for (const [x, y, t] of motes) if (!p.isOpaque(x, y) || t > 2) if (p.get(x, y) !== M[4] || t === 5) p.set(x, y, M[t]);
}

// ------------------------------------------------------------------ pose → pixels

function drawPose(p: PixelCanvas, ps: Pose): void {
  const g = geometry(ps);
  const n = g.neck;

  const staffL = new PixelCanvas(W, H);
  drawStaff(staffL, g.foot, g.top);
  const orbL = new PixelCanvas(W, H);
  drawOrb(orbL, ps, g);
  if (ps.behind) {
    // behind the body: all of it (1) or only the part above the shoulder line (2)
    const back = staffL.clone();
    const ob = orbL.clone();
    if (ps.behind === 2) {
      const cut = Math.round(n[1] + 1);
      for (let y = cut; y < H; y++)
        for (let x = 0; x < W; x++) {
          back.erase(x, y);
          ob.erase(x, y);
        }
    }
    composite(p, back, 0);
    composite(p, ob, 0);
  }

  const cloak = drawCloak(ps, g);
  if (!ps.bowed) composite(p, cloak, 0);

  // far arm (beside the body, in front of the cloak)
  const far = drawArm(add(g.sB, rot([-1, 1], g.rc, g.rs)), g.bhand, ps.bhandKind, ps.bfront ? [0, 1] : [-1, 0.3]);
  if (!ps.bfront && ps.wrap < 0.6) {
    composite(p, far.sleeve, 1);
    composite(p, far.glove, 1);
  }

  const skirt = drawSkirt(ps, g);
  composite(p, skirt.canvas, 1);
  if (!ps.bowed && ps.wrap <= 0) composite(p, drawCloakLap(cloak, skirt.canvas, g), 0);
  if (!ps.bowed) composite(p, drawTorso(g, skirt.belt), 1);
  const panel = drawPanel(ps, g, skirt.belt);
  if (ps.bowed) {
    // only the part hanging below the belt shows; the chest faces the floor
    const by = Math.round(Math.min(skirt.belt(0)[1], skirt.belt(1)[1]));
    for (let y = 0; y < by; y++) for (let x = 0; x < W; x++) panel.erase(x, y);
  }
  composite(p, panel, 1);

  // belt: dark leather, lit top edge, small gold studs; the buckle on the front panel
  const beltL = new PixelCanvas(W, H);
  for (let i = 0; i <= 48; i++) {
    const [bx, by] = skirt.belt(i / 48);
    const x = Math.round(bx);
    const y = Math.round(by);
    beltL.set(x, y - 2, i > 26 ? LE[3] : LE[2]);
    beltL.set(x, y - 1, LE[1]);
    beltL.set(x, y, LE[0]);
  }
  for (const u of [0.12, 0.3]) {
    const [bx, by] = skirt.belt(u);
    beltL.set(Math.round(bx), Math.round(by) - 1, GO[1]);
  }
  const bk = skirt.belt(0.68);
  stamp(beltL, BUCKLE, Math.round(bk[0]), Math.round(bk[1]) - 1, KEY);
  if (!ps.bowed) composite(p, beltL, 1);
  else composite(p, cloak, 1);
  if (ps.bfront) {
    composite(p, far.sleeve, 1);
    composite(p, far.glove, 1);
  }

  // the near arm goes under the wrapped cloak (summon) — draw it before the wrap
  const near = drawArm(add(g.sF, [0, 1]), g.grip, ps.handKind, [-0.3, 1]);
  const wrap = drawWrap(ps, g);
  if (wrap) {
    composite(p, near.sleeve, 1);
    composite(p, wrap, 1);
  }

  // collar, far pauldron, horns + hood (+ eyes), one rigid head stamp tilted by a drawn shear
  const col = new PixelCanvas(W, H);
  stamp(col, COLLAR, n[0], n[1], KEY);
  composite(p, col, 1);
  const pb = new PixelCanvas(W, H);
  stamp(pb, PAULDRON_BACK, g.sB[0], g.sB[1], KEY);
  composite(p, pb, 1);
  let head = new PixelCanvas(W, H);
  const [fx, fy] = [Math.round(g.face[0]), Math.round(g.face[1])];
  stamp(head, HORN_FAR, fx + 2, fy - 9, KEY);
  stamp(head, HOOD, fx, fy, KEY);
  if (ps.eyes !== 'none') paintEyes(head, ps.eyes, fx, fy);
  stamp(head, HORN_NEAR, fx - 3, fy - 5, KEY);
  if (ps.tilt) head = shear(head, fx, fy + 5, ps.tilt / 14, 0);
  composite(p, head, 1);

  // near arm + pauldron
  if (!wrap) composite(p, near.sleeve, 1);
  const pf = new PixelCanvas(W, H);
  stamp(pf, PAULDRON_FRONT, g.sF[0], g.sF[1], KEY);
  composite(p, pf, 1);

  // boot tip under the hem (hidden by the wrap): planted unless a key steps it
  if (!wrap) {
    const boots = new PixelCanvas(W, H);
    stamp(boots, BOOT, GX + 16 + ps.bootX, GY - ps.step, KEY);
    composite(p, boots, 0);
  }

  // staff, glove, claw + orb (in front)
  if (ps.behind !== 1) {
    const front = staffL.clone();
    const of = orbL.clone();
    if (ps.behind === 2) {
      const cut = Math.round(n[1] + 1);
      for (let y = 0; y < cut; y++)
        for (let x = 0; x < W; x++) {
          front.erase(x, y);
          of.erase(x, y);
        }
    }
    composite(p, front, 1);
    composite(p, near.glove, 1);
    composite(p, of, 0);
  } else composite(p, near.glove, 1);

  // magic round the free hand
  if (ps.wisp) {
    const wl = new PixelCanvas(W, H);
    drawWisps(wl, g.bhand, ps.wisp);
    composite(p, wl, 0);
  }

  // outline: ink below / behind; the low sun behind the wizard rims cloak, hood, collar, pauldrons
  selectiveOutline(p, GY + 1, (_x, _y, side, nb) => {
    if (nb === CL[1] || nb === CL[2] || nb === CL[3] || nb === CL[4]) return side === 'top' ? CL[4] : CL[3];
    return null;
  });
  if (ps.ghost) ghostify(p, ps.ghost);
  if (ps.erode > 0) erode(p, ps.erode, { x0: fx - 5, y0: fy - 3, x1: fx + 6, y1: fy + 3 }, ps.free ? { foot: g.foot, orb: g.orb } : undefined);
}

// ------------------------------------------------------------------ animations

type Key = Partial<Pose>;
interface AnimDef {
  keys: Key[];
  durations: number[];
  loop: boolean;
  marks?: Record<string, number>;
}

// idle: the breath lifts the chest, shoulders, collar and hood a pixel (the head rides on it); the
// cloak's hem, the curled back corner and the front panel answer it a beat later; the hand rocks the
// planted staff (it pivots on its foot, so only the orb end travels) and, once per cycle, eases its
// fingers off the shaft and takes a fresh grip a pixel lower, then slides back up; the orb pulses
// with the breath and the eyes narrow once. No two neighbouring frames are the same.
const IDLE = {
  breath: [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  handX: [0, 0, 0, 0, 1, 1, 1, 0, 0, -1, -1, 0],
  handY: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
  grip: ['gripV', 'gripV', 'gripV', 'gripV', 'gripV', 'gripV', 'gripV', 'gripLoose', 'gripV', 'gripV', 'gripV', 'gripV'] as HandKind[],
  // the hem's overshoot from the end of the loop settles on f1
  lag: [-1, 0, 0, 0, 1, 1, 1, 1, 0, 0, -1, -1],
  curl: [2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 1, 1],
  billow: [0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
  tab: [0, 0, 0, 0, 0, 1, 1, 1, 0, -1, -1, 0],
  sway: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, -1, -1],
  orb: [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 1],
  bhandY: [0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 0, 0],
  // the hood lags the breath by a frame both ways (it stays down as the chest rises, up as it sinks)
  headY: [0, 0, 1, 0, 0, 0, -1, 0, 0, 0, 0, 0],
  eyes: ['open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'open', 'half', 'open'] as EyeKind[],
};

/**
 * Kneeling on the back knee, the forward knee pushed out under the wrapped cloak, the torso bent
 * forward and the hood bowed low over the hand on the planted staff; the back boot's sole shows
 * behind the hem (summon start). The hand grips the staff at the height it keeps while rising.
 */
const KNEEL: Key = {
  hip: [1, 17],
  chest: [6, 3],
  head: [4, 6],
  tilt: 6,
  knee: [13, -2],
  hemF: 11,
  hemB: -3,
  hand: [10, 4],
  foot: 35,
  bhand: [3, 15],
  bhandKind: 'none',
  curl: 0,
  wrap: 1,
  eyes: 'none',
  sole: true,
};

/** The collapsed pose the body dissolves from: bowed over the knee, a hand on the floor. */
const DEAD: Key = {
  hip: [2, 20],
  chest: [19, 15],
  head: [1, 2],
  tilt: 4,
  knee: [6, 2],
  hemF: 8,
  hemB: -1,
  hand: [8, 47],
  handKind: 'brace',
  bhand: [10, 15],
  bhandKind: 'brace',
  bootX: 8,
  // the staff lies on the floor just in front of the hem and the planted boot, its foot by the knee,
  // pointing toward the dragon and a little toward the camera (so a little foreshortened: 78 of its
  // 89 px) — the orb stops clear of the dragon and inside the 2× inspection view
  free: [12, 3],
  staff: 105,
  freeLen: 78,
  orb: 4,
  cloak: 3,
  curl: 1,
  bowed: true,
  eyes: 'dim',
};

const DEFS: Record<WizardAnim, AnimDef> = {
  idle: {
    loop: true,
    durations: [160, 130, 120, 130, 150, 160, 140, 120, 120, 130, 70, 150],
    keys: IDLE.breath.map((b, f) => ({
      breath: b,
      head: [0, IDLE.headY[f]],
      hand: [IDLE.handX[f], IDLE.handY[f]],
      handKind: IDLE.grip[f],
      cloakLag: IDLE.lag[f],
      curl: IDLE.curl[f],
      billow: IDLE.billow[f],
      tab: IDLE.tab[f],
      sway: IDLE.sway[f],
      orb: IDLE.orb[f],
      bhand: [0, IDLE.bhandY[f]],
      eyes: IDLE.eyes[f],
    })),
  },

  // summon: it appears kneeling on one knee, wrapped in its cloak, head bowed over the planted
  // staff — first as a sparse figure of purple light, then whole; it rises in two steps (the knee
  // straightens, the head lifts), the wrapped cloak parts from the hem up and is flung open, the eyes
  // ignite; the staff is lifted overhead (the orb flares), then driven down and planted (land); the
  // cloak and panel settle a beat behind.
  summon: {
    loop: false,
    marks: { land: 11 },
    durations: [90, 90, 100, 90, 90, 90, 80, 90, 110, 70, 50, 120, 100, 150],
    keys: [
      { ...KNEEL, ghost: 2 },
      { ...KNEEL, ghost: 1 },
      { ...KNEEL },
      // the hips come up first, the head still bowed: the back knee leaves the floor, the cloak
      // front falls straight from the forward knee
      { ...KNEEL, hip: [1, 10], chest: [5, 2], head: [4, 5], tilt: 5, knee: [12, -4], hemF: 10, hemB: -2, hand: [9, 4], sole: false },
      // the forward knee straightens (the bump flattens), the head lifts
      { ...KNEEL, hip: [0, 4], chest: [2, 0], head: [1, 1], tilt: 1, knee: [4, -1], hemF: 4, hemB: -1, hand: [10, 4], bhand: [2, 4], sole: false },
      { wrap: 1, breath: 1, eyes: 'closed', bhandKind: 'none', curl: 1, hand: [7, 3], foot: 35 },
      { wrap: 0.45, breath: 1, eyes: 'half', cloak: 4, curl: 4, billow: 2, cloakLag: -1, hand: [1, -5], hold: 40, lift: 1, bhand: [-2, -2], bhandKind: 'open', tab: -1 },
      { breath: 1, eyes: 'flare', cloak: 8, curl: 6, billow: 3, cloakLag: -2, hand: [-3, -16], hold: 34, staff: -4, lift: 3, orb: 2, spark: 1, bhand: [-4, -5], bhandKind: 'splay', tab: -2, sway: -1 },
      { breath: 1, eyes: 'flare', cloak: 6, curl: 5, billow: 2, cloakLag: -1, hand: [-4, -25], hold: 30, staff: -2, lift: 4, orb: 3, spark: 2, bhand: [-4, -6], bhandKind: 'splay', tab: -1, sway: -1, chest: [0, -1] },
      { breath: 1, eyes: 'flare', cloak: 4, curl: 4, billow: 1, hand: [-4, -26], hold: 30, staff: 0, lift: 4, orb: 3, spark: 1, bhand: [-3, -4], bhandKind: 'open', tab: 0, chest: [0, -1] },
      // the slam's in-between: hand and staff halfway down, the cloak and panel still lagging up
      { breath: 1, eyes: 'flare', cloak: 5, curl: 5, billow: 2, cloakLag: -1, hand: [-2, -12], hold: 37, staff: 2, lift: 2, orb: 3, bhand: [-2, -3], bhandKind: 'open', tab: -2, sway: -1, chest: [1, 0] },
      // land: the staff is driven down and planted (a small dip of the whole body behind it)
      { hip: [0, 1], chest: [1, 1], eyes: 'open', cloak: 2, curl: 2, cloakLag: 1, hand: [0, 3], orb: 1, flash: 2, tab: 1, sway: 1, bhand: [0, 1] },
      { breath: 1, eyes: 'open', cloak: 1, curl: 3, cloakLag: -1, hand: [0, -1], tab: -1, sway: -1 },
      {},
    ],
  },

  // attack: gather — weight back, the staff lifts off the floor and is drawn back across the body
  // (its head behind the shoulders), the free hand cups the gathering magic, the orb charges in drawn
  // steps, the eyes flare, the energy lifts the cloak → the swing → the thrust: the arm extends and
  // the staff points forward and down at the dragon (release) → follow-through with the cloak flared
  // back → the staff swings up and is planted again.
  attack: {
    loop: false,
    marks: { charge: 2, release: 6 },
    durations: [100, 110, 140, 140, 210, 60, 90, 100, 120, 100, 100, 110, 140],
    keys: [
      { hip: [-1, 1], chest: [-1, 1], eyes: 'half', hand: [0, -3], hold: 37, cloakLag: 1 },
      { hip: [-2, 1], chest: [-3, 1], knee: [-2, 0], hemF: -1, eyes: 'half', hand: [-11, -8], hold: 40, staff: -28, behind: 2, bhand: [14, -13], bhandKind: 'gather', bfront: true, wisp: 1, cloakLag: 1, tab: 1 },
      { hip: [-2, 1], chest: [-4, 1], knee: [-2, 0], hemF: -1, eyes: 'flare', hand: [-13, -11], hold: 44, staff: -42, behind: 2, lift: 1, bhand: [15, -16], bhandKind: 'gather', bfront: true, wisp: 2, orb: 2, spark: 1, billow: 1, curl: 3, tab: 1 },
      { hip: [-2, 1], chest: [-4, 1], knee: [-2, 0], hemF: -1, eyes: 'flare', hand: [-13, -12], hold: 44, staff: -44, behind: 2, lift: 1, bhand: [15, -17], bhandKind: 'gather', bfront: true, wisp: 3, orb: 3, spark: 2, billow: 2, curl: 4, cloakLag: -1 },
      { hip: [-3, 1], chest: [-5, 1], knee: [-2, 0], hemF: -1, eyes: 'flare', hand: [-14, -12], hold: 44, staff: -46, behind: 2, lift: 1, bhand: [14, -17], bhandKind: 'gather', bfront: true, wisp: 3, orb: 3, spark: 1, billow: 2, curl: 4, cloakLag: -1 },
      // the swing: the front boot lifts into a step
      { hip: [0, 1], chest: [1, 0], hemF: 1, bootX: 2, step: 2, eyes: 'flare', hand: [6, -13], handKind: 'gripD', hold: 44, staff: 72, behind: 2, lift: 2, bhand: [-4, -4], bhandKind: 'open', orb: 3, billow: 1, curl: 3, cloakLag: -2, tab: -1 },
      // the thrust (release): the front boot plants a step forward, the arm straight, the staff an extension of it, pointing down at the dragon
      { hip: [2, 1], chest: [4, 1], knee: [3, 0], hemF: 4, bootX: 4, eyes: 'wide', hand: [17, -2], handKind: 'gripH', hold: 50, staff: 130, behind: 2, lift: 1, bhand: [-7, -6], bhandKind: 'splay', orb: 3, flash: 1, cloak: 5, curl: 4, cloakLag: -2, tab: -2, sway: -2 },
      { hip: [2, 1], chest: [5, 2], knee: [3, 0], hemF: 4, bootX: 4, eyes: 'flare', hand: [18, -1], handKind: 'gripH', hold: 50, staff: 132, behind: 2, lift: 1, bhand: [-7, -4], bhandKind: 'open', orb: 1, flash: 2, cloak: 7, curl: 5, cloakLag: -3, tab: -3, sway: -2 },
      { hip: [2, 1], chest: [4, 2], knee: [2, 0], hemF: 3, bootX: 4, eyes: 'open', hand: [17, -2], handKind: 'gripH', hold: 48, staff: 127, behind: 2, bhand: [-4, -2], bhandKind: 'open', orb: 0, cloak: 5, curl: 4, cloakLag: -1, tab: -1, sway: -1 },
      // recover: the boot steps back (lifted), the staff swings back up and is planted, a hair past
      // upright, then settles
      { hip: [1, 0], chest: [2, 1], hemF: 1, bootX: 2, step: 2, eyes: 'open', hand: [2, -6], handKind: 'gripD', hold: 40, staff: 40, bhand: [-1, 0], cloak: 3, curl: 3, cloakLag: 1, tab: 1 },
      { chest: [1, 0], hand: [1, 0], cloak: 1, curl: 2, cloakLag: 1, tab: 1, sway: 1 },
      { hand: [0, 0], cloakLag: -1, tab: 0, sway: -1 },
      {},
    ],
  },

  // hit: the breath slams into the front — the torso bends back, the hood is knocked back, the staff
  // arm is flung out (the staff torn off the floor), the free arm thrown back, the cloak whipped back
  // and up; the staff comes down again and the knees buckle; posture broken (death continues).
  hit: {
    loop: false,
    marks: { impact: 1 },
    durations: [40, 150, 110, 90, 90, 130],
    keys: [
      { eyes: 'wide' },
      { hip: [-1, 1], chest: [-8, 3], head: [-2, 0], tilt: -5, eyes: 'squeeze', hand: [6, -8], hold: 37, staff: 22, lift: 3, bhand: [-6, -17], bhandKind: 'splay', cloak: 9, curl: 7, billow: 3, cloakLag: -3, tab: -3, sway: -2 },
      { hip: [-1, 2], chest: [-9, 4], head: [-2, 0], tilt: -5, eyes: 'squeeze', hand: [5, -7], hold: 37, staff: 26, lift: 3, bhand: [-6, -14], bhandKind: 'splay', cloak: 10, curl: 7, billow: 2, cloakLag: -2, tab: -2, sway: -2 },
      { hip: [-1, 3], chest: [-6, 5], head: [-1, 0], tilt: -4, eyes: 'squeeze', hand: [2, 0], bhand: [-4, -7], bhandKind: 'open', cloak: 6, curl: 5, billow: 1, cloakLag: -1, tab: -1, sway: -1 },
      { hip: [0, 3], chest: [-4, 5], tilt: -2, eyes: 'half', hand: [1, 1], bhand: [-2, -2], bhandKind: 'open', cloak: 4, curl: 3, cloakLag: 1, tab: 1, sway: 1 },
      { hip: [0, 4], chest: [-2, 6], head: [0, 1], tilt: 1, eyes: 'half', hand: [0, 2], bhand: [0, 1], bhandKind: 'open', cloak: 2, curl: 2, tab: 0 },
    ],
  },

  // death: a stagger back, then the knees give: down on one knee, leaning on the planted staff, head
  // bowed; the staff's foot slips forward, the hand loses it and it topples; the body pitches forward
  // over the knee and catches itself on one hand; the staff lands in front (the spent orb dark). Then
  // (dissolve) the body erodes into purple pixels from the cloak's edges and the hem upward, the eyes
  // last; the last frame is empty.
  death: {
    loop: false,
    marks: { dissolve: 6 },
    durations: [120, 160, 100, 100, 130, 200, 90, 90, 90, 90, 90, 90, 90, 110, 140, 120],
    keys: [
      // the stagger: the front boot is LIFTED and carried halfway forward (from where the hit left it) …
      { hip: [-1, 4], chest: [-4, 6], tilt: -2, bootX: 4, step: 3, eyes: 'dim', hand: [-1, 3], bhand: [1, 2], bhandKind: 'open', cloak: 3, curl: 2 },
      // … and planted as the body drops onto one knee; it stays planted to the end
      { hip: [1, 16], chest: [3, 3], head: [1, 2], tilt: 3, knee: [5, -1], hemF: 6, hemB: -1, bootX: 8, eyes: 'dim', hand: [2, 12], foot: 28, bhand: [5, 14], bhandKind: 'open', cloak: 2, curl: 1 },
      // the staff's foot slips forward once, then the staff topples whole (all 89 px): as its head
      // falls its foot kicks back toward the knee, it strikes the floor, then settles
      { hip: [1, 17], chest: [5, 5], head: [1, 3], tilt: 4, knee: [5, -1], hemF: 6, hemB: -1, bootX: 8, eyes: 'half', hand: [5, 15], handKind: 'open', free: [31, 0], staff: 18, bhand: [7, 16], bhandKind: 'open', cloak: 2, curl: 1 },
      { hip: [2, 18], chest: [8, 10], head: [2, 3], tilt: 4, knee: [6, 0], hemF: 7, hemB: -1, bootX: 8, eyes: 'dim', hand: [6, 26], handKind: 'open', free: [27, 0], staff: 50, freeLen: 85, bhand: [17, 12], bhandKind: 'open', cloak: 3, curl: 1 },
      { ...DEAD, chest: [16, 13], eyes: 'half', free: [13, 2], staff: 103, freeLen: 79, orb: 1, cloakLag: -1 },
      { ...DEAD, curl: 2 },
      ...[0.3, 0.38, 0.46, 0.54, 0.62, 0.71, 0.8, 0.88, 0.95].map((e) => ({ ...DEAD, erode: e, eyes: e < 0.45 ? ('dim' as const) : e < 0.75 ? ('half' as const) : ('open' as const) })),
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
  id: 'b_wizard',
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
      core: { x: Math.round((g.hip[0] + g.neck[0]) / 2), y: Math.round(Math.min(GY - 8, (g.hip[1] + g.neck[1]) / 2 + 4)) },
      muzzle: { x: g.orb[0], y: g.orb[1] },
      orb: { x: g.orb[0], y: g.orb[1] },
      head: { x: Math.round(g.face[0]), y: Math.round(g.face[1]) },
      eyes: { x: Math.round(g.face[0]) + 1, y: Math.round(g.face[1]) },
    };
  },
};

export default wizard;
