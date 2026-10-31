// Çamur Pençe Ruhu v3 — the "half-buried mud spirit" rig: Pose → pixels.
//
// A NEW body plan (no legs, no walker, no floater): a hunched clay spirit sunk to the waist in its own mud puddle.
//   - a flat wet PUDDLE on the tile (the "feet": its bottom rows never move in idle / guard) with a lumpy MOUND where
//     the body grows out of it;
//   - a hunched mud TORSO built as a chain of blobs along a curved spine (base → hump → neck): breath swells it,
//     bubbles swell and pop on the hump, sag creases roll down its shade side, the lit side stays calm and wet;
//   - a cracked pale CLAY MASK (hand map, rigid: it moves by whole pixels, never rotates) on a mud head, two violet
//     eyes behind it (light, never outlined); a mouth of void opens under the mask (the moan);
//   - MANY LONG MUD ARMS: two main arms reaching forward along the ground (near + far, palms planted, fingers that
//     drum), two "crown" arms rising off the hump (one curls back, one looms forward over the mask, hands dangling)
//     and a short rear arm gripping the puddle behind. Arms are tapering tubes through IK / angle chains;
//   - ONE key light from the screen top-left: `light` = the frame edge it comes from ('left' P1, 'right' the P2
//     relight sheet; mirrored by flipX it is lit from the top-left again). The mask planes are chosen per light;
//   - light (eyes, violet veins, the vortex core, bubble pops) is painted after the outline and never outlined.
// Frame 92×76; 1 art px = 1 game px; the root (AX, GY) is the ground point under the mound.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { despeckle, ik2, lightOf, type Light } from '../rigkit';
import { Comp, DEG, bands, blobShade, hash2, limb, polar, type Blob, type Pt, type Tones } from './mudgrasp_spirit-kit';

export const W = 92;
export const H = 76;
export const AX = 40;
export const GY = 69;

export const enum Part {
  none = 0,
  puddle,
  rear,
  crownA,
  farArm,
  torso,
  crownB,
  head,
  mask,
  nearArm,
  fx,
}

const rnd = Math.round;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** whole spirit sunk below the puddle surface (px, + down): summon / death / revive / guard hunker */
  sink: number;
  /** torso base x shift, neck lean forward (px), hump height (+ up), breath swell of the blobs (px) */
  bx: number;
  lean: number;
  hump: number;
  swell: number;
  /** liquefaction 0…1 (death): the blobs sag and spread into the puddle */
  melt: number;
  /** mound size 0…1 (forms in the summon) */
  mound: number;
  /** head offset from the neck (px); mask offset from the head (px); mask shown 0 / 1 */
  hx: number;
  hy: number;
  mx: number;
  my: number;
  mask: number;
  /** eyes 0 dark · 1 violet · 2 blazing; lid 0 open · 1 narrow · 2 shut; look = px the glints sit off centre */
  eye: number;
  lid: number;
  look: number;
  /** mouth under the mask 0 shut … 3 wide (rows of void) */
  mouth: number;
  /** near main arm: hand target (relative to the root), finger curl 0…1, drum (finger index 0…3, −1 none), drum height */
  nx: number;
  ny: number;
  nc: number;
  nd: number;
  ndh: number;
  /** far main arm: hand target, curl */
  fx: number;
  fy: number;
  fc: number;
  /** crown arm A (curls back): base angle (deg), bend per segment (deg), length scale, hand curl */
  aa: number;
  ab: number;
  al: number;
  ac: number;
  /** crown arm B (looms forward over the mask) */
  ba: number;
  bb: number;
  bl: number;
  bc: number;
  /** rear arm: hand target, curl */
  rx: number;
  ry: number;
  rc: number;
  /** mud ball held in the near palm 0 none … 3 big */
  ball: number;
  /** back bubbles: loop phase 0…1, activity 0 none · 1 calm · 2 boiling */
  bub: number;
  bubK: number;
  /** drips (chin, near forearm): loop phase 0…1 (−1 none) */
  drip: number;
  /** puddle: ripple ring phase (0 none), vortex phase (0 none) and its turn (+1 in / −1 out), width scale */
  ripple: number;
  swirl: number;
  swirlDir: number;
  puddle: number;
  /** splash burst phase (0 none) at (sx, sy) relative to the root; hit spray off the chest phase (0 none) */
  splash: number;
  sx: number;
  sy: number;
  spray: number;
  /** violet veins through the mud 0 none · 1 lit · 2 blazing */
  vein: number;
  /** tremor 0 / 1 / 2 (the blobs jump a px alternately) */
  shake: number;
  /** the anim's one wet glint on the mask brow: 0 none, 1 = 1 px, 2 = 3-px cross */
  glint: number;
  /** summon climb 0…1: the arms rise straight out of the mud under their hands */
  climb: number;
  /** near elbow side: −1 arched up (planted), +1 dropped low (raised arm, keeps the mask clear) */
  nb: number;
  /** 1 = the mask has slipped off the head: (mx, my) place it relative to the root and it sinks below the puddle surface */
  maskFree: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  sink: 0,
  bx: 0,
  lean: 0,
  hump: 0,
  swell: 0,
  melt: 0,
  mound: 1,
  hx: 0,
  hy: 0,
  mx: 0,
  my: 0,
  mask: 1,
  eye: 1,
  lid: 0,
  look: 0,
  mouth: 0,
  nx: 23,
  ny: -2,
  nc: 0,
  nd: -1,
  ndh: 0,
  fx: 33,
  fy: -3,
  fc: 0.2,
  aa: -100,
  ab: -9,
  al: 1,
  ac: 0,
  ba: -70,
  bb: 34,
  bl: 0,
  bc: 0.4,
  rx: -28,
  ry: -2,
  rc: 0.5,
  ball: 0,
  bub: 0,
  bubK: 1,
  drip: -1,
  ripple: 0,
  swirl: 0,
  swirlDir: 1,
  puddle: 1,
  splash: 0,
  sx: 26,
  sy: -2,
  spray: 0,
  vein: 0,
  shake: 0,
  glint: 0,
  climb: 0,
  nb: -1,
  maskFree: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

// Value ladder (owner feedback round 2: "no blurry brown mass at 1x"): the body mound is the DARK mass (big lit
// plane earth2, mid earth1, shade earth0, wet glints earth3); the near arms are one value LIGHTER (earth3 / earth2 /
// earth1) so they read as separate limbs over it, split by earth0 creases; far arms sit back a value (earth2 / earth1
// / earth0); the mud hood behind the mask is the darkest (earth1 / earth0) so the pale clay mask (stone4 / stone3,
// ink-separated) is the lightest big value, and the violet eyes are the brightest accent of all.
const MUD: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
const ARM: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1 };
const FAR: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
const HOOD: Tones = { L: PAL.earth1, M: PAL.earth0, S: PAL.earth0 };
const GLOSS = PAL.earth3;
const CREASE = PAL.earth0;

// ---------------------------------------------------------------- skeleton

export interface Skel {
  base: Pt;
  /** spine sample (t 0…1) and blob radius */
  sp: (t: number) => Pt;
  rad: (t: number) => number;
  neck: Pt;
  head: Pt;
  maskO: Pt;
  shN: Pt;
  elN: Pt;
  wN: Pt;
  shF: Pt;
  elF: Pt;
  wF: Pt;
  crownA: Pt[];
  crownB: Pt[];
  rearRoot: Pt;
  elR: Pt;
  wR: Pt;
  /** the second (far) rear arm, a value darker, arching behind the near rear arm */
  rear2Root: Pt;
  elR2: Pt;
  wR2: Pt;
  core: Pt;
  eyeN: Pt;
}

function bez(a: Pt, b: Pt, c: Pt, t: number): Pt {
  const u = 1 - t;
  return [u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], u * u * a[1] + 2 * u * t * b[1] + t * t * c[1]];
}

function chainPts(root: Pt, a0: number, bend: number, lens: number[]): Pt[] {
  const pts: Pt[] = [root];
  let a = a0;
  let p = root;
  for (const l of lens) {
    p = polar(p, a, l);
    pts.push(p);
    a += bend;
  }
  return pts;
}

export function skeleton(o: Pose): Skel {
  const sh = o.shake === 1 ? 1 : o.shake === 2 ? -1 : 0;
  const m = clamp(o.melt, 0, 1);
  const bxx = AX + o.bx + sh;
  const base: Pt = [bxx - 2, GY - 6 + o.sink];
  const P1: Pt = [bxx - 11, GY - 42 + o.sink - o.hump];
  const P2: Pt = [AX + 9 + o.lean + sh, GY - 30 + o.sink - o.hump * 0.5];
  const sp = (t: number): Pt => {
    const q = bez(base, P1, P2, t);
    return [q[0] + (base[0] - q[0]) * m * 0.35, base[1] + (q[1] - base[1]) * (1 - 0.72 * m)];
  };
  const rad = (t: number) => (t < 0.5 ? 10.5 - 4 * t : 11 - 5 * t) * (1 - 0.3 * m) + o.swell + m * 4 * (1 - t);
  const neck = sp(1);
  const head: Pt = [neck[0] + 6 + o.hx, neck[1] - 2 + o.hy];
  const maskO: Pt = o.maskFree > 0 ? [AX + o.mx, GY + o.my] : [rnd(head[0]) - 5 + o.mx, rnd(head[1]) - 10 + o.my];
  // climb (summon): the arms come straight up out of the mud under their hands; melt (death): the elbows sag
  const cl = clamp(o.climb, 0, 1);
  const under = (sh: Pt, w: Pt): Pt => [sh[0] + (w[0] - 3 - sh[0]) * cl, sh[1] + (GY + 10 - sh[1]) * cl];
  const sag = (el: Pt): Pt => [el[0], el[1] + (GY - 2 - el[1]) * m];
  const straight = (el: Pt, sh: Pt, w: Pt): Pt => [el[0] + ((sh[0] + w[0]) / 2 - el[0]) * cl, el[1] + ((sh[1] + w[1]) / 2 - el[1]) * cl];
  const s85 = sp(0.82);
  const wN: Pt = [AX + o.nx, GY + o.ny];
  const shN = under([s85[0] + 1, s85[1] + 9], wN);
  const elN = straight(sag(ik2(shN, wN, 14, 17, o.nb) as Pt), shN, wN);
  // far front arm: a second spider-leg arch ahead of the near arm (shoulder hidden behind the chest)
  const wF: Pt = [AX + o.fx, GY + o.fy];
  const s70 = sp(0.7);
  const shF = under([s70[0] + 3, s70[1] + 1], wF);
  const elF = straight(sag(ik2(shF, wF, 21, 24, -1) as Pt), shF, wF);
  const s45 = sp(0.45);
  const rootA: Pt = [s45[0] - 4, s45[1] - rad(0.45) + 4];
  const crownA = chainPts(rootA, o.aa, o.ab, [8 * o.al, 7 * o.al, 7 * o.al]);
  const s58 = sp(0.58);
  const rootB: Pt = [s58[0] + 1, s58[1] - rad(0.58) + 3];
  const crownB = chainPts(rootB, o.ba, o.bb, [9 * o.bl, 8 * o.bl, 6 * o.bl]);
  // rear arms: long arches to the back (elbow up), palms gripping the puddle behind
  const wR: Pt = [AX + o.rx, GY + o.ry];
  const s40 = sp(0.4);
  const rearRoot = under([s40[0] - 7, s40[1] + 2], wR);
  const elR = straight(sag(ik2(rearRoot, wR, 12, 15, 1) as Pt), rearRoot, wR);
  const wR2: Pt = [AX + o.rx + 9, GY + o.ry - 4 + (o.ry > 2 ? 0 : 0)];
  const s52 = sp(0.52);
  const rear2Root = under([s52[0] - 4, s52[1] - 3], wR2);
  const elR2 = straight(sag(ik2(rear2Root, wR2, 13, 15, 1) as Pt), rear2Root, wR2);
  const sc = sp(0.4);
  return {
    base, sp, rad, neck, head, maskO, shN, elN, wN, shF, elF, wF, crownA, crownB, rearRoot, elR, wR, rear2Root, elR2, wR2,
    core: [rnd(sc[0] + 3), rnd(sc[1] + 2)],
    eyeN: [maskO[0] + 4, maskO[1] + 7],
  };
}

// ---------------------------------------------------------------- frame

export interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
}

const layer = () => new PixelCanvas(W, H);

// ---------------------------------------------------------------- the clay mask (hand map; rigid)

// A haniwa-like clay mask in 3/4 view (facing right): x shape, r the brow ridge (always the lit lip), e the hollow
// eye sockets (near eye wide, far eye foreshortened), o the round moaning mouth, k the crack. Its tones are NOT a
// hand-picked map but the normal of a clay ellipsoid (bulging toward the foe) · the key light → stone4 / stone3 /
// stone2, so P1 and P2 are each lit from their own top-left (IŞ-2); it is rigid (whole-px moves, never rotates) and
// ink-separated from the dark mud hood so it pops as the lightest big value. 15 × 18.
const MASK = [
  '....xxxxxx.....',
  '..xxxxxxxxxx...',
  '.xxxxxxxxxkxx..',
  '.xxxxxxxxkxxxx.',
  'xxxxxxxxxkxxxxx',
  'xxrrrrrxxkxrrrx',
  'xxeeeeexxxkeeex',
  'xxeeeeexxxkeeex',
  'xxxeeexxxxxkexx',
  'xxxxxxxxxxxkxxx',
  'xxxxxxxxxxxxkxx',
  '.xxxxxoooxxkxx.',
  '.xxxxoooooxkxx.',
  '.xxxxoooooxxkx.',
  '..xxxxoooxxkx..',
  '..xxxxxxxxxkx..',
  '...xxxxxxxxx...',
  '.....xxxxx.....',
];
export const MASK_W = 15;
export const MASK_H = 18;
/** eye sockets (map coords): near eye x 2..6 rows 6..8, far eye x 11..13 rows 6..8 */
const EYE_N = { x0: 2, x1: 6, y: 6 };
const EYE_F = { x0: 11, x1: 13, y: 6 };
const MOUTH = { x: 7, y: 12 };

function maskTone(ch: string, x: number, y: number, light: Light): number {
  if (ch === 'e' || ch === 'o') return PAL.void0;
  if (ch === 'k') return PAL.stone1;
  if (ch === 'r') return PAL.stone4;
  const nx = (x + 0.5 - 8.3) / 8.2;
  const ny = (y + 0.5 - 8.2) / 9.6;
  const nz = Math.sqrt(Math.max(0, 1 - Math.min(1, nx * nx + ny * ny)));
  const [lx, ly, lz] = light.v;
  const d = nx * lx + ny * ly + nz * lz;
  // under the brow ridge and under the chin the clay turns away
  if (y === 16 || y === 17) return d > 0.55 ? PAL.stone3 : PAL.stone2;
  return d > 0.42 ? PAL.stone4 : d > 0.05 ? PAL.stone3 : PAL.stone2;
}

// ---------------------------------------------------------------- hands

/** A hand at wrist w: palm along `dir` (deg), four 2-px fingers fanned around it; curl bends them toward the palm. */
function hand(q: PixelCanvas, w: Pt, dir: number, curl: number, c: number, lifts: readonly number[] = [0, 0, 0, 0], scale = 1, palm = 3, spreadDeg?: number): void {
  const pc = polar(w, dir, 2);
  q.disc(rnd(pc[0]), rnd(pc[1]), palm - 1 + (scale > 0.9 ? 1 : 0), c);
  const spread = spreadDeg ?? 20 - 12 * curl;
  for (let i = 0; i < 4; i++) {
    const off = i - 1.5;
    const b = polar(polar(pc, dir + 90, off * 1.3), dir, palm - 1);
    const a1 = dir + off * spread;
    const k1 = polar(b, a1, (3.6 - curl) * scale);
    const a2 = a1 + curl * 75 - lifts[i] * 28;
    const k2 = polar(k1, a2, (3.4 - curl * 1.2) * scale);
    limb(q, [b, k1, k2], 2.4, 2, c);
  }
}

/** finger lifts of a drumming hand */
function drum(o: Pose): number[] {
  return [0, 1, 2, 3].map((i) => (o.nd < 0 ? 0 : rnd(o.ndh * Math.max(0, 1 - Math.abs(o.nd - i)))));
}

// ---------------------------------------------------------------- parts

function drawPuddle(f: Frame): PixelCanvas {
  const { o, light } = f;
  const q = layer();
  const rx = Math.max(4, rnd(36 * o.puddle));
  const cx = AX + 2;
  const cy = GY - 2;
  q.ellipse(cx, cy, rx, 3, PAL.earth1);
  for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y);
  // the back rim shadow (top row) and the wet front lip (bottom row)
  for (let x = cx - rx; x <= cx + rx; x++) {
    let top = -1;
    let bot = -1;
    for (let y = cy - 4; y <= cy + 4; y++) if (q.isOpaque(x, y)) { if (top < 0) top = y; bot = y; }
    if (top >= 0) q.set(x, top, PAL.earth0);
    if (bot >= 0 && bot !== top) q.set(x, bot, PAL.earth0);
  }
  // gloss streaks on the wet surface (toward the light)
  const gx = cx + light.lx(-14);
  for (const [dx, dy, n] of [[0, 0, 4], [7, 1, 3], [30, 0, 3]] as const) for (let i = 0; i < n; i++) { const x = gx + light.lx(dx) + i; if (q.get(x, cy + dy) === PAL.earth1) q.set(x, cy + dy, PAL.earth2); }
  // ripple ring
  if (o.ripple > 0) {
    const r = 6 + o.ripple * 26;
    for (let i = 0; i < 64; i++) {
      if (i % 8 === 7) continue;
      const a = (i / 64) * TAU;
      const x = rnd(cx + Math.cos(a) * r);
      const y = rnd(cy + Math.sin(a) * r * 0.16);
      if (q.isOpaque(x, y)) q.set(x, y, o.ripple < 0.5 ? PAL.earth2 : PAL.earth2);
    }
  }
  // vortex: three spiral arms winding into a dark core
  if (o.swirl > 0) {
    const turn = o.swirl * 360 * o.swirlDir;
    for (let k = 0; k < 3; k++)
      for (let r = 2; r < rx - 1; r += 0.5) {
        const a = (k * 120 + turn + r * 11) * DEG;
        const x = rnd(cx + Math.cos(a) * r);
        const y = rnd(cy + Math.sin(a) * r * 0.2);
        if (!q.isOpaque(x, y)) continue;
        q.set(x, y, PAL.earth2);
        const x2 = rnd(cx + Math.cos(a - 0.25) * r);
        if (q.isOpaque(x2, y)) q.set(x2, y, PAL.earth0);
      }
    q.ellipse(cx, cy, 4, 1, PAL.void0);
  }
  f.comp.add(q, Part.puddle, {});
  return q;
}

function drawRearArms(f: Frame): void {
  const { sk, o, light } = f;
  const k = 1 - 0.35 * o.melt;
  // the far rear arm first (a value darker), then the near rear arm over it
  const q2 = layer();
  limb(q2, [sk.rear2Root, sk.elR2, sk.wR2], 4.5 * k, 3.2 * k, FAR.M);
  hand(q2, sk.wR2, 180 + 30, Math.min(1, o.rc + 0.2), FAR.M, undefined, 0.8, 2);
  bands(q2, FAR, light, 1, 2);
  f.comp.add(q2, Part.rear, { out: CREASE });
  const q = layer();
  limb(q, [sk.rearRoot, sk.elR, sk.wR], 5.5 * k, 3.6 * k, ARM.M);
  hand(q, sk.wR, 180 + 12, o.rc, ARM.M, undefined, 0.9);
  bands(q, ARM, light, 2, 2);
  f.comp.add(q, Part.rear, { out: CREASE });
}

function drawCrown(f: Frame, pts: Pt[], curl: number, part: Part, t: Tones, handDir: number | null, scale = 1): void {
  if (scale < 0.1) return;
  const q = layer();
  limb(q, pts, 5, 3.4, t.M);
  const tip = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dir = handDir ?? Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) / DEG;
  hand(q, tip, dir, curl, t.M, undefined, 1.05, 3, 30 - 18 * curl);
  bands(q, t, f.light, 2, 2);
  f.comp.add(q, part, { out: CREASE });
}

function drawFarArm(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  limb(q, [sk.shF, sk.elF, sk.wF], 5.5 * (1 - 0.35 * o.melt), 3.6 * (1 - 0.3 * o.melt), FAR.M);
  const flat = sk.wF[1] > GY - 9;
  hand(q, sk.wF, flat ? 8 : Math.atan2(sk.wF[1] - sk.elF[1], sk.wF[0] - sk.elF[0]) / DEG, o.fc, FAR.M);
  bands(q, FAR, light, 2, 2);
  f.comp.add(q, Part.farArm, { out: CREASE });
}

function drawTorso(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  const m = clamp(o.melt, 0, 1);
  const blobs: Blob[] = [];
  // mound
  if (o.mound > 0.05) {
    const mw = rnd(15 * o.mound + m * 12);
    const mh = Math.max(2, rnd(5 * o.mound - m * 2));
    const b = { x: rnd(sk.base[0]) + 2.5, y: GY - 2.5, rx: mw + 0.5, ry: mh + 0.5 };
    q.ellipse(rnd(b.x - 0.5), GY - 3, mw, mh, MUD.M);
    blobs.push(b);
  }
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const c = sk.sp(t);
    const r = Math.max(2, rnd(sk.rad(t)));
    q.disc(rnd(c[0]), rnd(c[1]), r, MUD.M);
    // the shading reads three big masses (base, hump, shoulders), not every disc: lumps, not rings
    if (i % 5 === 2) blobs.push({ x: rnd(c[0]) + 0.5, y: rnd(c[1]) + 0.5, rx: r + 2.5, ry: r + 2.5 });
  }
  // back bubbles (swell, then pop into droplets): matter, outlined with the body
  const pops: Pt[] = [];
  const drops: Pt[] = [];
  if (o.bubK > 0) {
    const sites: [number, number][] = o.bubK > 1
      ? [[0.28, -150], [0.4, -125], [0.5, -100], [0.6, -80], [0.34, -175], [0.68, -60]]
      : [[0.3, -150], [0.47, -112], [0.64, -82]];
    sites.forEach(([t, a], i) => {
      const u = (o.bub * (o.bubK > 1 ? 2 : 1) + i / sites.length) % 1;
      const c = sk.sp(t);
      const r0 = sk.rad(t);
      if (u < 0.7) {
        const br = 1 + rnd((u / 0.7) * 2);
        const bc = polar(c, a, r0 - 1 + br * 0.7);
        q.disc(rnd(bc[0]), rnd(bc[1]), br, MUD.M);
        blobs.push({ x: rnd(bc[0]) + 0.5, y: rnd(bc[1]) + 0.5, rx: br + 0.5, ry: br + 0.5 });
      } else if (u < 0.86) {
        const bc = polar(c, a, r0 + 1);
        pops.push(bc);
        const k = (u - 0.7) / 0.16;
        for (const s of [-1, 1]) drops.push(polar(bc, a + s * 38, 2 + k * 5));
      }
    });
  }
  blobShade(q, blobs, MUD, light, { hi: GLOSS, hiAt: 0.9, lit: 0.6, shade: 0.22 });
  despeckle(q, 2);
  for (const [x, y] of drops) q.rect(rnd(x), rnd(y), 2, 2, MUD.L);
  // runnels: short wet streaks slumping down the mid / shade planes (MA-2: the lit plane stays calm)
  for (const [t, a, n] of [[0.24, 25, 5], [0.42, 55, 4], [0.12, 70, 4], [0.6, 40, 3]] as const) {
    const c = sk.sp(t);
    const s0 = polar(c, light.side < 0 ? a : 180 - a, sk.rad(t) * 0.55);
    const x = rnd(s0[0]);
    const y0 = rnd(s0[1]);
    for (let k = 0; k < n * (1 + m); k++) if (q.get(x, y0 + k) === MUD.M || q.get(x, y0 + k) === MUD.S) q.set(x, y0 + k, CREASE);
  }
  f.comp.add(q, Part.torso, { out: CREASE });
  (f as Frame & { pops?: Pt[] }).pops = pops;
}

function drawHead(f: Frame): void {
  const { sk, light } = f;
  const q = layer();
  const [hx, hy] = [rnd(sk.head[0]), rnd(sk.head[1])];
  // the mud COWL the mask peers out of: a lit lip of mud arching over and behind the mask (one value lighter than the
  // mound, it frames the face) around a deep violet-black cavity open toward the foe — pale clay in a dark hole reads
  // at 1x as the face of the creature
  const cw = { x: hx - 0.5, y: hy - 3.5, rx: 10, ry: 11 };
  q.ellipse(rnd(cw.x), rnd(cw.y), cw.rx, cw.ry, MUD.M);
  q.ellipse(hx + 3, hy + 6, 5, 3, MUD.M);
  // the cowl's drooping tip, sagging back over the hump
  q.poly([[hx - 3, hy - 13.5], [hx - 9, hy - 15.5], [hx - 13, hy - 12], [hx - 8, hy - 9]], MUD.M);
  blobShade(q, [{ x: cw.x + 0.5, y: cw.y + 0.5, rx: cw.rx + 0.5, ry: cw.ry + 0.5 }, { x: hx + 3.5, y: hy + 6.5, rx: 5.5, ry: 3.5 }], MUD, light, { lit: 0.55, shade: 0.15 });
  despeckle(q, 2);
  // the cavity: void-black, a 2-px ring of it shows around the mask's top and back
  const cav = { x: hx + 2.5, y: hy - 1.5, rx: 8.5, ry: 10.5 };
  for (let y = rnd(cav.y - cav.ry); y <= rnd(cav.y + cav.ry); y++)
    for (let x = rnd(cav.x - cav.rx); x <= rnd(cav.x + cav.rx); x++) {
      const dx = (x + 0.5 - cav.x) / cav.rx;
      const dy = (y + 0.5 - cav.y) / cav.ry;
      if (dx * dx + dy * dy <= 1 && q.isOpaque(x, y)) q.set(x, y, dx * dx + dy * dy > 0.8 ? PAL.void1 : PAL.void0);
    }
  f.comp.add(q, Part.head, { out: CREASE });
}

function drawMask(f: Frame): void {
  const { sk, o, light } = f;
  if (o.mask <= 0) return;
  const q = layer();
  const [ox, oy] = sk.maskO;
  for (let y = 0; y < MASK_H; y++)
    for (let x = 0; x < MASK_W; x++) {
      const ch = MASK[y][x];
      if (ch !== '.') q.set(ox + x, oy + y, maskTone(ch, x, y, light));
    }
  // slipped off: it lies in the puddle and sinks below its surface
  if (o.maskFree > 0) for (let y = GY - 2; y < H; y++) for (let x = 0; x < W; x++) q.erase(x, y);
  f.comp.add(q, Part.mask, { out: PAL.ink });
}

function drawNearArm(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  limb(q, [sk.shN, sk.elN, sk.wN], 6 * (1 - 0.35 * o.melt), 3.8 * (1 - 0.3 * o.melt), ARM.M);
  const flat = sk.wN[1] > GY - 8;
  const dir = flat ? 6 : Math.atan2(sk.wN[1] - sk.elN[1], sk.wN[0] - sk.elN[0]) / DEG;
  hand(q, sk.wN, dir, o.nc, ARM.M, drum(o));
  bands(q, ARM, light, 2, 2);
  // a gloss run on the forearm's lit top
  const mid: Pt = [(sk.elN[0] + sk.wN[0]) / 2, (sk.elN[1] + sk.wN[1]) / 2];
  for (let i = 0; i < 2; i++) {
    const x = rnd(mid[0]) + i - 1;
    for (let y = rnd(mid[1]) - 4; y <= rnd(mid[1]); y++) if (q.get(x, y) === ARM.L) { q.set(x, y, PAL.earth4); break; }
  }
  f.comp.add(q, Part.nearArm, { out: CREASE });
  if (o.ball > 0) {
    // the fistful of mud: its own round lump in the palm (a crease separates it from the fingers)
    const pc = polar(sk.wN, dir, 3);
    const r = 1 + rnd(o.ball);
    const bx = rnd(pc[0]);
    const by = rnd(pc[1]) - 2;
    const b = layer();
    b.disc(bx, by, r, MUD.M);
    blobShade(b, [{ x: bx + 0.5, y: by + 0.5, rx: r + 0.5, ry: r + 0.5 }], MUD, light, { hi: GLOSS, hiAt: 0.9, lit: 0.45 });
    f.comp.add(b, Part.nearArm, { out: CREASE });
  }

}

/** drips (chin + forearm) and splash / spray droplets: mud matter, outlined with the body */
function drawDrops(f: Frame): void {
  const { sk, o } = f;
  const q = layer();
  const drop = (x0: number, y0: number, u: number) => {
    if (u < 0.65) {
      const n = 1 + rnd(u * 5);
      q.rect(rnd(x0), rnd(y0), 2, n, MUD.M);
    } else {
      const y = y0 + 3 + (u - 0.65) * 40;
      if (y < GY - 3) q.rect(rnd(x0), rnd(y), 2, 2, MUD.M);
    }
  };
  if (o.drip >= 0 && o.mask > 0) {
    drop(sk.maskO[0] + 6, sk.maskO[1] + MASK_H - 1, o.drip);
    const mid: Pt = [(sk.elN[0] * 2 + sk.wN[0]) / 3, (sk.elN[1] * 2 + sk.wN[1]) / 3 + 3];
    drop(mid[0], mid[1], (o.drip + 0.45) % 1);
  }
  if (o.splash > 0) {
    const s = o.splash;
    for (let i = 0; i < 9; i++) {
      const a = (20 + i * 17 + hash2(i, 4, 1) * 10) * DEG;
      const v = 9 + hash2(i, 7, 3) * 10;
      const x = AX + o.sx + Math.cos(a) * v * s * (i % 2 ? 1 : -1) * 1.2;
      const y = GY + o.sy - Math.sin(a) * v * s * 1.4 + s * s * 16;
      if (y < GY - 1) q.rect(rnd(x), rnd(y), i % 3 ? 2 : 3, 2, MUD.M);
    }
  }
  if (o.spray > 0) {
    const s = o.spray;
    const c = sk.sp(0.7);
    for (let i = 0; i < 6; i++) {
      const a = (180 + 30 - i * 14 + hash2(i, 2, 9) * 8) * DEG;
      const v = 6 + hash2(i, 5, 2) * 9;
      const x = c[0] + Math.cos(a) * v * s - 2;
      const y = c[1] + Math.sin(a) * v * s - 4 + s * s * 10;
      if (y < GY - 2) q.rect(rnd(x), rnd(y), 2, 2, MUD.M);
    }
  }
  bands(q, MUD, f.light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.fx, {});
}

// ---------------------------------------------------------------- light layer

function eyeLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.mask <= 0 || o.eye <= 0.05) return;
  const [ox, oy] = sk.maskO;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && comp.id[y * W + x] === Part.mask;
  const put = (x: number, y: number, c: number) => { if (ok(x, y)) p.set(x, y, c); };
  const hot = o.eye > 1.4;
  const lit = hot ? PAL.void4 : o.eye > 0.6 ? PAL.void3 : PAL.void2;
  const core = hot ? PAL.white : o.eye > 0.6 ? PAL.void4 : PAL.void3;
  const look = clamp(rnd(o.look), -1, 1);
  // near eye: a 3×2 glowing iris in the wide socket (the hollow rim stays void0), far eye 2×2 (foreshortened)
  const nx0 = EYE_N.x0 + 1;
  const fx0 = EYE_F.x0 + 1;
  const ey = EYE_N.y;
  if (o.lid < 2) {
    for (let x = nx0; x < nx0 + 3; x++) {
      if (o.lid === 0) put(ox + x, oy + ey, lit);
      put(ox + x, oy + ey + 1, lit);
    }
    put(ox + nx0 + 1 + look, oy + ey + 1, core);
    if (o.lid === 0) put(ox + nx0 + 1 + look, oy + ey, core);
    for (let x = fx0; x < fx0 + 2; x++) {
      if (o.lid === 0) put(ox + x, oy + ey, lit);
      put(ox + x, oy + ey + 1, o.eye > 0.6 ? PAL.void2 : PAL.void1);
    }
    if (o.lid === 0) put(ox + fx0 + Math.max(0, look), oy + ey, core);
  } else {
    for (let x = nx0; x < nx0 + 3; x++) put(ox + x, oy + ey + 1, PAL.void2);
    for (let x = fx0; x < fx0 + 2; x++) put(ox + x, oy + ey + 1, PAL.void1);
  }
  // blazing: the whole sockets fill with violet, a spill under them
  if (hot) {
    for (let x = EYE_N.x0; x <= EYE_N.x1; x++) { put(ox + x, oy + ey, x === EYE_N.x0 || x === EYE_N.x1 ? PAL.void2 : PAL.void3); put(ox + x, oy + ey + 1, x === EYE_N.x0 || x === EYE_N.x1 ? PAL.void2 : PAL.void3); }
    put(ox + nx0 + 1 + look, oy + ey, PAL.white);
    put(ox + nx0 + 1 + look, oy + ey + 1, PAL.white);
    for (let x = EYE_N.x0 + 1; x < EYE_N.x1; x++) put(ox + x, oy + ey + 2, PAL.void2);
  }
  // the round mouth: a violet glow deep in the hole while it moans (mouth 1…3)
  if (o.mouth > 0.5) {
    const ring = o.mouth > 2.5 ? PAL.void2 : PAL.void1;
    const mc = o.mouth > 2.5 ? PAL.void4 : o.mouth > 1.5 ? PAL.void3 : PAL.void2;
    const { x: mx, y: my } = MOUTH;
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(ox + mx - 1 + x, oy + my + y, mc);
    if (o.mouth > 1.5) for (const [x, y] of [[-2, 0], [1, 0], [-2, 1], [1, 1], [-1, -1], [0, -1], [-1, 2], [0, 2]] as const) put(ox + mx + x, oy + my + y, ring);
  }
}

function veinLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.vein <= 0) return;
  const body = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const id = comp.id[y * W + x];
    return (id === Part.torso || id === Part.nearArm || id === Part.head) && p.get(x, y) !== PAL.ink;
  };
  const hot = o.vein > 1.4;
  const paths: Pt[][] = [
    [sk.sp(0.08), [sk.sp(0.25)[0] + 4, sk.sp(0.25)[1]], [sk.sp(0.42)[0] - 1, sk.sp(0.42)[1] + 1], [sk.sp(0.6)[0] + 3, sk.sp(0.6)[1] - 2], [sk.sp(0.8)[0] + 1, sk.sp(0.8)[1] + 2]],
    [[sk.sp(0.2)[0] - 7, sk.sp(0.2)[1] + 2], [sk.sp(0.33)[0] - 8, sk.sp(0.33)[1] - 2], [sk.sp(0.47)[0] - 5, sk.sp(0.47)[1] - 6]],
    [sk.shN, sk.elN, [(sk.elN[0] + sk.wN[0]) / 2, (sk.elN[1] + sk.wN[1]) / 2 - 1]],
  ];
  for (const path of paths)
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const n = Math.max(1, rnd(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let k = 0; k <= n; k++) {
        const x = rnd(a[0] + ((b[0] - a[0]) * k) / n);
        const y = rnd(a[1] + ((b[1] - a[1]) * k) / n);
        if (body(x, y)) p.set(x, y, hot && k % 3 !== 0 ? PAL.void4 : PAL.void3);
        if (hot && body(x, y + 1) && k % 2 === 0) p.set(x, y + 1, PAL.void2);
      }
    }
}

/** two violet cracks through the mound (the spirit's light inside the mud); they breathe with the swell */
function crackLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.melt > 0.6 || o.sink > 20) return;
  const body = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && comp.id[y * W + x] === Part.torso && p.get(x, y) !== PAL.ink;
  const c1 = sk.sp(0.3);
  const c2 = sk.sp(0.62);
  const r1 = sk.rad(0.3);
  const s = f.light.side < 0 ? 1 : -1;
  const hot = o.swell > 0.5 || o.vein > 0 ? PAL.void3 : PAL.void2;
  const cracks: [number, number, number][][] = [
    // [dx, dy, hot?] relative to a spine sample: a zig-zag with a fork
    [[0, 0, 0], [1, 1, 0], [1, 2, 1], [2, 3, 0], [2, 4, 0], [1, 5, 0], [3, 4, 0], [4, 5, 0]],
    [[0, 0, 0], [0, 1, 1], [1, 2, 0], [1, 3, 0], [0, 4, 0]],
  ];
  const roots: Pt[] = [[c1[0] + s * (r1 * 0.35), c1[1] - 2], [c2[0] - s * 3, c2[1] + 3]];
  cracks.forEach((cr, i) => {
    const [rx, ry] = roots[i];
    for (const [dx, dy, h] of cr) {
      const x = rnd(rx) + dx * s;
      const y = rnd(ry) + dy;
      if (body(x, y)) p.set(x, y, h ? hot : PAL.void1);
    }
  });
}

/** violet bounce light from the puddle core on the shade-side lower rim of the mound (separates it from the ink) */
function rimLight(f: Frame): void {
  const { p, o, comp, light } = f;
  if (o.melt > 0.5) return;
  const d = -light.side;
  for (let y = GY - 26; y < GY - 2; y++)
    for (let x = 1; x < W - 1; x++) {
      const id = comp.id[y * W + x];
      if (id !== Part.torso || p.get(x, y) === PAL.ink || p.get(x, y) === null) continue;
      if (p.get(x + d, y) === PAL.ink && p.get(x + 2 * d, y) === null) p.set(x, y, PAL.void1);
    }
}

function popLight(f: Frame, pops: readonly Pt[]): void {
  for (const [x, y] of pops) {
    const xx = rnd(x);
    const yy = rnd(y);
    if (f.p.get(xx, yy) !== PAL.ink) f.p.set(xx, yy, PAL.void3);
  }
}

function swirlLight(f: Frame): void {
  const { p, o } = f;
  if (o.swirl <= 0) return;
  const cx = AX + 2;
  const cy = GY - 2;
  for (let x = cx - 2; x <= cx + 2; x++) if (f.comp.id[cy * W + x] === Part.puddle) p.set(x, cy, Math.abs(x - cx) < 2 ? PAL.void3 : PAL.void2);
}

function glintLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.glint <= 0 || o.mask <= 0) return;
  const x = sk.maskO[0] + (f.light.side < 0 ? 3 : 10);
  const y = sk.maskO[1] + 3;
  const put = (xx: number, yy: number) => { if (comp.id[yy * W + xx] === Part.mask && p.get(xx, yy) !== PAL.ink) p.set(xx, yy, PAL.white); };
  put(x, y);
  if (o.glint > 1.5) { put(x - 1, y); put(x + 1, y); put(x, y - 1); put(x, y + 1); }
}

// ---------------------------------------------------------------- draw

export function drawMudgrasp(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame & { pops?: Pt[] } = { p, comp, light, o, sk };

  const pud = drawPuddle(f);
  drawRearArms(f);
  drawCrown(f, sk.crownA, o.ac, Part.crownA, ARM, null, o.al);
  drawFarArm(f);
  drawTorso(f);
  drawCrown(f, sk.crownB, o.bc, Part.crownB, FAR, 90, o.bl);
  drawHead(f);
  drawMask(f);
  drawNearArm(f);
  drawDrops(f);

  // the wet front lip of the puddle covers what stands in it; nothing exists below the ground line
  for (let y = GY - 1; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = y <= GY ? pud.get(x, y) : null;
      if (c !== null) {
        p.set(x, y, c);
        comp.id[y * W + x] = Part.puddle;
      } else if (comp.id[y * W + x] !== Part.puddle && p.isOpaque(x, y)) {
        p.erase(x, y);
        comp.id[y * W + x] = Part.none;
      }
    }

  p.outline(PAL.ink);

  // light layer (never outlined)
  swirlLight(f);
  rimLight(f);
  crackLight(f);
  veinLight(f);
  popLight(f, f.pops ?? []);
  eyeLight(f);
  glintLight(f);
}
