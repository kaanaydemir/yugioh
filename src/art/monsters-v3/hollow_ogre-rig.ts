// Kovuk Devi v3 — the "hollow-log giant" rig: Pose → pixels.
//
// A hunched giant that IS a lightning-struck hollow log (a tree trunk, not a primate):
//   - the TRUNK: one thick log bent forward at the top (the hunch), shaded as a cylinder per row (lit band toward the
//     key light, shade band away from it), bark grain seams that follow the log, a few ring cracks; the broken crown
//     is a row of splintered teeth with charred tips; a pale lightning SCAR zigzags from the crown into the hollow;
//   - the HOLLOW in its chest is its face: a bark lip, a charred rim, darkness, two ember eyes (light, never
//     outlined) and the violet knot lights of the seeds it has planted;
//   - a MANE of three broken branches raking up and back off the upper back;
//   - two long ROOT-BUNDLE arms (three twisted strands: diagonal twist seams), root fingers: the near hand wraps a
//     knotted log CLUB (ink-separated from the bark it overlaps), the far hand's fingers dangle and probe;
//   - two short ROOT LEGS splitting from the log base into flat root toes (the "feet": fixed in idle / guard);
//   - MOSS (dark leaf) draped over both shoulders, pale MUSHROOMS growing out of it;
//   - ONE key light from the screen top-left: `light` = the frame edge it comes from ('left' P1, 'right' the P2
//     relight sheet; mirrored by flipX it is lit from the top-left again). Every plane is chosen from the light;
//   - light (eyes, knots, scar glow, seeds, firefly, sprout bud, glint) is painted after the outline.
// Frame 88×80; 1 art px = 1 game px; the root (AX, GY) is the ground point between the root feet.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { despeckle, ik2, lightOf, type Light } from '../rigkit';
import { Comp, DARKER, DEG, bands, bez, cylBands, hash2, limb, polar, twistSeams, type Pt, type Tones } from './hollow_ogre-kit';

export const W = 88;
export const H = 80;
export const AX = 38;
export const GY = 74;

export const enum Part {
  none = 0,
  farArm,
  farLeg,
  mane,
  farMoss,
  trunk,
  nearLeg,
  door,
  club,
  nearArm,
  nearMoss,
  sprout,
  fx,
}

const rnd = Math.round;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** hips down (px, knees take it); trunk base x shift; trunk top forward (+) / back (−); trunk top down (creak) */
  crouch: number;
  bx: number;
  lean: number;
  bob: number;
  /** tremor 0 / 1 / 2 (the log jumps a px alternately) */
  shake: number;
  /** the whole giant below the ground line (px): the summon stake, the death sink */
  sink: number;
  /** 0…1 the trunk caves inward and shortens (death / revive) */
  collapse: number;
  /** root legs grown 0…1 (0 = the log stands on its base: the sealed summon log) */
  legs: number;
  /** arms grown out of the shoulders 0…1 (summon / revive) */
  unfurl: number;
  /** bark door over the hollow: 0 shut (sealed log) … 1 swung open; doorFall 0…1 the open plates drop off; door −1 = none */
  door: number;
  doorFall: number;
  /** ember eyes 0 dark · 1 ember · 2 blazing; lid 0 open · 1 narrow · 2 shut; look −1…1 */
  eye: number;
  lid: number;
  look: number;
  /** knot lights in the hollow (0…2) and their flare 0…1 */
  knots: number;
  knotHot: number;
  /** the old lightning scar re-ignites: 0 none · 1 violet · 2 white */
  scar: number;
  /** near arm: hand (club grip) target relative to the root, elbow side (+1 down / −1 up) */
  nx: number;
  ny: number;
  nb: number;
  /** club direction (deg, grip → head) */
  ca: number;
  /** 1 = the club lies free (dropped): grip at (cfx, cfy) relative to the root */
  clubFree: number;
  cfx: number;
  cfy: number;
  /** sprout grown on the club 0…1 (special) */
  sprout: number;
  /** far arm: hand target, elbow side; root finger curl 0…1, spread (deg); reach 0…1 (the lead root tip stretches) */
  fx: number;
  fy: number;
  fb: number;
  fc: number;
  fs: number;
  reach: number;
  /** finger probe phase 0…1 (−1 still) */
  probe: number;
  /** seed held at the planting tendril's tip 0 none · 1 lit · 2 blazing */
  seed: number;
  /**
   * the planting tendril (special): a thin root that grows out of the near shoulder along a curve toward the target
   * (tx, ty) relative to the root; tl = grown 0…1, tc = how high the curve arcs (px), topen = its tip forked open
   */
  tl: number;
  tx: number;
  ty: number;
  tc: number;
  topen: number;
  /** feet offsets (hitHeavy step): near foot dx / dy (lift −), far foot dx */
  nfx: number;
  nfy: number;
  ffx: number;
  /** mane branches bristle 0…1 (rise), sway (deg) */
  mane: number;
  maneSway: number;
  /** moss drip sway (px) */
  moss: number;
  /** mushroom spore puff phase 0…1 (0 none) */
  puff: number;
  /** 0…1 the root arms split into strands and slump toward the tile */
  unravel: number;
  /** 0…1 root tendrils from the base snake down into the tile (death) / up out of it (revive) */
  roots: number;
  /** the lone ground sprout: 0 none · 1 upright · 2 wilted (values between droop) */
  sproutG: number;
  /** splinter burst phase (0 none) at (sx, sy) relative to the root; falling leaves phase; dust puff phase at the feet */
  splinter: number;
  sx: number;
  sy: number;
  leaves: number;
  dust: number;
  /** hit chips off the chest phase (0 none) */
  spray: number;
  /** firefly phase 0…1 (−1 none) */
  fly: number;
  /** the anim's one glint (a wet mushroom cap): 0 / 1 px / 2 cross */
  glint: number;
  /** global phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  crouch: 0,
  bx: 0,
  lean: 0,
  bob: 0,
  shake: 0,
  sink: 0,
  collapse: 0,
  legs: 1,
  unfurl: 1,
  door: -1,
  doorFall: 0,
  eye: 1,
  lid: 0,
  look: 0,
  knots: 0,
  knotHot: 0,
  scar: 0,
  nx: 17,
  ny: -22,
  nb: 1,
  ca: 55,
  clubFree: 0,
  cfx: 0,
  cfy: 0,
  sprout: 0,
  fx: -15,
  fy: -16,
  fb: 1,
  fc: 0.3,
  fs: 18,
  reach: 0,
  probe: -1,
  seed: 0,
  tl: 0,
  tx: 14,
  ty: -66,
  tc: 10,
  topen: 0,
  nfx: 0,
  nfy: 0,
  ffx: 0,
  mane: 0,
  maneSway: 0,
  moss: 0,
  puff: 0,
  unravel: 0,
  roots: 0,
  sproutG: 0,
  splinter: 0,
  sx: 40,
  sy: -2,
  leaves: 0,
  dust: 0,
  spray: 0,
  fly: -1,
  glint: 0,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- tones

const BARK: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1 };
const FAR: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
const ROOT: Tones = { L: PAL.earth3, M: PAL.earth2, S: PAL.earth1 };
const CLUB: Tones = { L: PAL.earth2, M: PAL.earth1, S: PAL.earth0 };
const MOSS: Tones = { L: PAL.leaf2, M: PAL.leaf1, S: PAL.leaf0 };
const MOSS_FAR: Tones = { L: PAL.leaf1, M: PAL.leaf0, S: PAL.leaf0 };
const CREASE = PAL.earth0;
const HEART = PAL.earth4;

export const CLUB_LEN = 23;
/** crown shards: position across the top (−1…1), height, forward slant */
const SHARDS: readonly (readonly [number, number, number])[] = [[-0.9, 6, -2], [-0.5, 11, -1], [-0.05, 7, 0.5], [0.38, 13, 2.5], [0.82, 6, 2.5]];

// ---------------------------------------------------------------- skeleton

export interface Skel {
  base: Pt;
  top: Pt;
  height: number;
  sp: (t: number) => Pt;
  rad: (t: number) => number;
  hollow: Pt;
  hrx: number;
  hry: number;
  shN: Pt;
  elN: Pt;
  wN: Pt;
  shF: Pt;
  elF: Pt;
  wF: Pt;
  grip: Pt;
  clubHead: Pt;
  clubButt: Pt;
  hipN: Pt;
  kneeN: Pt;
  footN: Pt;
  hipF: Pt;
  kneeF: Pt;
  footF: Pt;
  tip: Pt;
  tendril: Pt[];
  eyeN: Pt;
}

/** the far hand's lead root tip (where seeds land) */
function fingerTips(o: Pose, w: Pt, el: Pt): Pt[] {
  const dir = Math.atan2(w[1] - el[1], w[0] - el[0]) / DEG;
  const tips: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const off = i - 1.5;
    const probe = o.probe < 0 ? 0 : Math.sin((o.probe + i * 0.27) * Math.PI * 2) * 0.35;
    const a1 = dir + off * o.fs * 0.5;
    const l1 = 4 + (i === 2 ? o.reach * 8 : 0);
    const k1 = polar(w, a1, l1);
    const a2 = a1 + (o.fc + probe) * 55 * (off < 0 ? -1 : 1) * 0.6 + o.fc * 25;
    const l2 = 4 - Math.abs(off) * 0.5 + (i === 2 ? o.reach * 7 : 0);
    tips.push(k1, polar(k1, a2, l2));
  }
  return tips;
}

export function skeleton(o: Pose): Skel {
  const sh = o.shake === 1 ? 1 : o.shake === 2 ? -1 : 0;
  const col = clamp(o.collapse, 0, 1);
  const legs = clamp(o.legs, 0, 1);
  const baseY = GY - 1 - 13 * legs + o.crouch + o.sink;
  const base: Pt = [AX + o.bx, baseY];
  const height = 42 * (1 - 0.74 * col) + (1 - legs) * 4;
  const top: Pt = [base[0] + 15 + o.lean + sh, base[1] - height * 0.9 + o.bob];
  const ctrl: Pt = [base[0] - 3 + o.lean * 0.1, base[1] - height * 0.86];
  const sp = (t: number): Pt => bez(base, ctrl, top, t);
  const rad = (t: number) => (9.5 + 3 * Math.max(0, 1 - ((t - 0.72) / 0.72) ** 2)) * (1 - 0.18 * col) + col * 3 * (1 - t);
  const hc = sp(0.64);
  const hollow: Pt = [rnd(hc[0] + 1), rnd(hc[1])];
  // shoulders sit on the hunch, at the log's front and back edges (the hollow stays clear between them)
  const s8 = sp(0.74);
  const shN: Pt = [s8[0] + rad(0.74) - 3, s8[1] + 4];
  const s84 = sp(0.84);
  const shF: Pt = [s84[0] - rad(0.84) + 3, s84[1] + 1];
  const unf = clamp(o.unfurl, 0, 1);
  const wN0: Pt = [AX + o.nx, GY + o.ny];
  const wN: Pt = [lerp(shN[0], wN0[0], unf), lerp(shN[1], wN0[1], unf)];
  const elN = ik2(shN, wN, 12.5 * Math.max(0.3, unf), 13.5 * Math.max(0.3, unf), o.nb) as Pt;
  const wF0: Pt = [AX + o.fx, GY + o.fy];
  const wF: Pt = [lerp(shF[0], wF0[0], unf), lerp(shF[1], wF0[1], unf)];
  const elF = ik2(shF, wF, 14 * Math.max(0.3, unf), 15 * Math.max(0.3, unf), o.fb) as Pt;
  const grip: Pt = o.clubFree > 0 ? [AX + o.cfx, GY + o.cfy] : wN;
  const clubHead = polar(grip, o.ca, CLUB_LEN);
  const clubButt = polar(grip, o.ca, -4);
  const hipN: Pt = [base[0] + 5, base[1] - 1];
  const hipF: Pt = [base[0] - 5, base[1] - 2];
  const footN: Pt = [AX + 8 + o.nfx, GY - 2 + o.nfy];
  const footF: Pt = [AX - 8 + o.ffx, GY - 2];
  const kneeN = ik2(hipN, footN, 6.5, 6.5, -1) as Pt;
  const kneeF = ik2(hipF, footF, 6.5, 6.5, -1) as Pt;
  const tips = fingerTips(o, wF, elF);
  // the planting tendril: root on the near shoulder, a quadratic arc to the target, grown to tl
  const tendril: Pt[] = [];
  if (o.tl > 0.02) {
    const r0: Pt = [shN[0] - 1, shN[1] - 3];
    const tgt: Pt = [AX + o.tx, GY + o.ty];
    const c: Pt = [(r0[0] + tgt[0]) / 2 + 4, Math.min(r0[1], tgt[1]) - o.tc];
    const n = 8;
    for (let i = 0; i <= n; i++) tendril.push(bez(r0, c, tgt, (i / n) * clamp(o.tl, 0, 1)));
  }
  return {
    base, top, height, sp, rad, hollow, hrx: 4, hry: 6,
    shN, elN, wN, shF, elF, wF, grip, clubHead, clubButt,
    hipN, kneeN, footN, hipF, kneeF, footF,
    tip: tendril.length ? tendril[tendril.length - 1] : tips[5],
    tendril,
    eyeN: [hollow[0] + 1, hollow[1] - 2],
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

/** deterministic, frame-stable jag: a per-index pseudo-random in [0, 1) */
const jag = (i: number, s: number) => hash2(i, s, 101);

// ---------------------------------------------------------------- parts

function rootFingers(q: PixelCanvas, f: Frame, w: Pt, el: Pt, c: number): void {
  const { o } = f;
  const tips = fingerTips(o, w, el);
  for (let i = 0; i < 4; i++) {
    const k1 = tips[i * 2];
    const k2 = tips[i * 2 + 1];
    limb(q, [w, k1, k2], 2.6, 2, c);
  }
}

function drawFarArm(f: Frame): void {
  const { sk, o, light } = f;
  if (o.unfurl < 0.05 || o.unravel > 0.02) return;
  const q = layer();
  const pts: Pt[] = [sk.shF, sk.elF, sk.wF];
  limb(q, pts, 7, 6, FAR.M);
  rootFingers(q, f, sk.wF, sk.elF, FAR.M);
  bands(q, FAR, light, 2, 2);
  twistSeams(q, pts, 6, FAR, 4, 1);
  f.comp.add(q, Part.farArm, { out: CREASE });
}

function leg(f: Frame, hip: Pt, knee: Pt, foot: Pt, t: Tones, part: Part, toeDir: number): void {
  const { o, light } = f;
  if (o.legs < 0.12) return;
  const q = layer();
  const k = clamp(o.legs, 0, 1);
  limb(q, [hip, knee, foot], 7 * k + 1, 8 * k, t.M);
  // root toes: flat roots spreading on the ground (front long, middle, back short)
  const fy = rnd(foot[1]);
  const toes: [number, number][] = [[toeDir * 7, 0], [toeDir * 3, 1], [-toeDir * 5, 0]];
  for (const [dx, dy] of toes) {
    const a: Pt = [foot[0], fy];
    const b: Pt = [foot[0] + dx * k, Math.min(GY - 0.5, fy + 1.5 + dy)];
    limb(q, [a, b], 3, 2, t.M);
  }
  bands(q, t, light, 2, 2);
  twistSeams(q, [hip, knee, foot], 7, t, 4, 2);
  f.comp.add(q, part, { out: CREASE });
}

function drawMane(f: Frame): void {
  const { sk, o, light } = f;
  if (o.collapse > 0.6) return;
  const q = layer();
  const fold = clamp(o.collapse * 1.6, 0, 1);
  // three broken branches off the upper back: root (spine t, offset back), angle, length
  const br: [number, number, number, number][] = [
    [0.96, -3, -122, 12],
    [0.82, -9, -148, 13],
    [0.66, -11, -168, 9],
  ];
  br.forEach(([t, off, a0, len], i) => {
    const r = sk.sp(t);
    const root: Pt = [r[0] + off * (1 - fold * 0.3), r[1] - 1];
    const ang = a0 + o.mane * (i === 2 ? 22 : 16) + o.maneSway * (1 + i * 0.4) + fold * 40;
    const l = len * (1 - fold * 0.5) * clamp(o.legs * 0.5 + 0.5, 0.5, 1);
    const mid = polar(root, ang, l * 0.55);
    const end = polar(mid, ang + (i === 1 ? -14 : 12), l * 0.45);
    limb(q, [root, mid, end], 5, 3, FAR.M);
    // a broken twig fork
    const tw = polar(mid, ang + (i === 1 ? 42 : -48), 4);
    limb(q, [mid, tw], 3, 2, FAR.M);
    // the snapped tip: a short crosswise stub
    const stub = polar(end, ang + 90, 1.5);
    q.rect(rnd(stub[0]), rnd(stub[1]), 2, 2, FAR.M);
  });
  bands(q, FAR, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.mane, { out: CREASE });
}

function mossClump(f: Frame, at: Pt, rx: number, t: Tones, part: Part, drips: number, far: boolean): void {
  const { o, light } = f;
  const q = layer();
  const x0 = rnd(at[0]);
  const y0 = rnd(at[1]);
  q.ellipse(x0, y0, rx, 3, t.M);
  // scalloped drips hanging down (2-px teeth)
  for (let i = 0; i < drips; i++) {
    const dx = rnd(-rx + 1 + (i * (2 * rx - 2)) / Math.max(1, drips - 1));
    const len = 2 + rnd(jag(i, far ? 7 : 3) * 3) + (i % 2 ? rnd(o.moss) : 0);
    q.rect(x0 + dx + (i % 2 ? rnd(o.moss * 0.5) : 0), y0 + 1, 2, len, t.M);
  }
  // flat moss planes: a lit lip on top (toward the light), the body, a dark underside and drips
  const src = q.clone();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!src.isOpaque(x, y)) continue;
      const up = !src.isOpaque(x, y - 1) || (!src.isOpaque(x + light.side * -1, y) && !src.isOpaque(x, y - 2));
      const dn = !src.isOpaque(x, y + 1) || !src.isOpaque(x, y + 2) && y > y0;
      q.set(x, y, up && !dn ? t.L : dn || y > y0 + 1 ? t.S : t.M);
    }
  f.comp.add(q, part, { out: far ? undefined : PAL.leaf0 });
}

function mushroom(q: PixelCanvas, at: Pt, w: number, light: Light): void {
  const x = rnd(at[0]);
  const y = rnd(at[1]);
  // stem
  q.rect(x, y - 2, 2, 3, PAL.earth3);
  // cap: a dome, lit top rows, the rim / gill row one step down; the dome's crown sits toward the light
  const hw = Math.floor(w / 2);
  for (let i = -hw; i <= hw + 1; i++) q.set(x + i, y - 3, PAL.earth3);
  for (let i = -hw + 1; i <= hw; i++) q.set(x + i, y - 4, PAL.earth4);
  if (w >= 5) for (let i = -hw + 2; i <= hw - 1; i++) q.set(x + i + light.lx(-1) * 0, y - 5, PAL.earth4);
}

function drawFarMoss(f: Frame): void {
  const { sk, o } = f;
  if (o.collapse > 0.45 || o.door >= 0 && o.door < 0.2) return;
  mossClump(f, [sk.shF[0] + 1, sk.shF[1] - 3], 4, MOSS_FAR, Part.farMoss, 3, true);
  const q = layer();
  mushroom(q, [sk.shF[0] - 1, sk.shF[1] - 4], 5, f.light);
  // the mushroom is matter of the far side: one value down
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = q.get(x, y); if (c !== null) q.set(x, y, c === PAL.earth4 ? PAL.earth3 : PAL.earth2); }
  f.comp.add(q, Part.farMoss, {});
}

function drawTrunk(f: Frame): void {
  const { sk, o, light } = f;
  const q = layer();
  const col = clamp(o.collapse, 0, 1);
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * 0.9;
    const c = sk.sp(t);
    const r = sk.rad(t);
    // the log: a flat elliptical cross section (the ends never dome)
    q.ellipse(rnd(c[0]), rnd(c[1]), Math.max(2, rnd(r)), Math.max(2, rnd(r * 0.5)), BARK.M);
  }
  // the caved-in waist (death): bites out of both sides
  if (col > 0.05) {
    const m = sk.sp(0.5);
    const bite = rnd(col * 6);
    for (let y = rnd(m[1]) - 6; y <= rnd(m[1]) + 6; y++) {
      const k = 1 - Math.abs(y - m[1]) / 7;
      const d = rnd(bite * k);
      let l = -1;
      let r = -1;
      for (let x = 0; x < W; x++) if (q.isOpaque(x, y)) { if (l < 0) l = x; r = x; }
      if (l < 0) continue;
      for (let x = l; x < l + d; x++) q.erase(x, y);
      for (let x = r; x > r - d; x--) q.erase(x, y);
    }
  }
  // the broken crown: splintered shards on the top end, raking forward along the log's top tangent
  const top = sk.sp(0.9);
  const rt = sk.rad(0.9);
  const tg = sk.sp(0.99);
  const tdx = (tg[0] - top[0]) * 0.8;
  const lift = 1 - col;
  for (const [u, h0, sl] of SHARDS) {
    const bx = top[0] + u * (rt - 1);
    const by = top[1] - rt * 0.5 * Math.sqrt(1 - u * u) + 2;
    const h = h0 * lift + 1;
    q.poly([[bx - 2.8, by + 2], [bx + 2.8, by + 2], [bx + sl + tdx * h * 0.25, by - h]], BARK.M);
  }
  cylBands(q, BARK, light, 0.2, 0.56, 2);
  // bark grain: seams that follow the log (dashes), mid / shade planes only; ring cracks
  const b0 = rnd(sk.top[1]) - 8;
  const b1 = rnd(sk.base[1]) + 4;
  const src = q.clone();
  for (let y = b0; y <= b1; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < W; x++) if (src.isOpaque(x, y)) { if (l < 0) l = x; r = x; }
    if (l < 0 || r - l < 8) continue;
    for (const [k, u] of [0.42, 0.57, 0.83, 0.93].entries()) {
      if (jag(rnd((y + k * 7) / 4), k + 3) < 0.28) continue;
      const uu = light.side < 0 ? u : 1 - u;
      const x = rnd(l + uu * (r - l));
      const c = q.get(x, y);
      if (c === BARK.M || c === BARK.S) q.set(x, y, DARKER[c]);
    }
  }
  // two knot holes on the mid plane (a dark eye, a lit lower lip)
  for (const [t, du] of [[0.24, 0.52], [0.42, 0.7]] as const) {
    const c = sk.sp(t);
    const r = sk.rad(t);
    const x0 = rnd(c[0] - r + (light.side < 0 ? du : 1 - du) * 2 * r);
    const y0 = rnd(c[1]);
    if (q.get(x0, y0) === BARK.M && q.get(x0 + 1, y0) === BARK.M) {
      q.set(x0, y0, PAL.earth0);
      q.set(x0 + 1, y0, PAL.earth0);
      q.set(x0, y0 + 1, BARK.L);
      q.set(x0 + 1, y0 + 1, BARK.L);
    }
  }
  // crown shards: charred tips, a pale heartwood split on the lit face of the tall ones
  for (const [u, h0, sl] of SHARDS) {
    const bx = top[0] + u * (rt - 1);
    const by = top[1] - rt * 0.5 * Math.sqrt(1 - u * u) + 2;
    const h = h0 * lift + 1;
    const tip: Pt = [bx + sl + tdx * h * 0.25, by - h];
    for (let k = 0; k < 3; k++) {
      const x = rnd(tip[0] + (bx - tip[0]) * (k / h));
      const y = rnd(tip[1]) + k;
      for (const dx of [-1, 0, 1]) if (q.isOpaque(x + dx, y) && k < 2) q.set(x + dx, y, PAL.earth1);
    }
    if (h > 5) for (let k = 2; k < h - 1; k++) {
      const x = rnd(tip[0] + (bx - tip[0]) * (k / h)) + light.lx(-1);
      const y = rnd(tip[1]) + k;
      if (q.isOpaque(x, y)) q.set(x, y, HEART);
    }
  }
  // the lightning scar: a pale zigzag from the crown down into the hollow, a charred pixel beside it
  if (col < 0.5) {
    const h0 = sk.hollow;
    const path: Pt[] = [[top[0] + 1, top[1] - 1], [top[0] + 3, top[1] + 4], [top[0] + 0, top[1] + 8], [h0[0] - 1, h0[1] - sk.hry - 1]];
    for (let i = 0; i + 1 < path.length; i++) {
      const [a, b] = [path[i], path[i + 1]];
      const n = Math.max(1, rnd(Math.hypot(b[0] - a[0], b[1] - a[1])));
      for (let k = 0; k <= n; k++) {
        const x = rnd(a[0] + ((b[0] - a[0]) * k) / n);
        const y = rnd(a[1] + ((b[1] - a[1]) * k) / n);
        if (!q.isOpaque(x, y)) continue;
        q.set(x, y, HEART);
        const xc = x - light.side;
        if (q.isOpaque(xc, y) && q.get(xc, y) !== HEART) q.set(xc, y, CREASE);
      }
    }
  }
  despeckle(q, 1);
  // the open top of the hollow log: an end-grain ring (seen from above on the 2:1 board) around a dark hole
  if (col < 0.55) {
    const [cx, cy] = [rnd(top[0]), rnd(top[1] - rt * 0.5 + 2)];
    const rx = Math.max(3, rnd(rt - 1.5));
    const ry = Math.max(2, rnd(rt * 0.36));
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const e = ((x - cx) / (rx + 0.4)) ** 2 + ((y - cy) / (ry + 0.4)) ** 2;
        if (e > 1) continue;
        const ei = ((x - cx) / (rx - 2.2)) ** 2 + ((y - cy + 0.5) / Math.max(1, ry - 1.2)) ** 2;
        // end grain lit toward the light, a growth-ring step, the dark hole (its near lip catches no light)
        q.set(x, y, ei <= 1 ? (y > cy + ry - 2 ? PAL.void1 : PAL.void0) : (x - cx) * -light.side > rx * 0.25 ? HEART : PAL.earth3);
      }
  }
  // the hollow: a bark lip (lit top-left, shade low-right), a charred rim, darkness, the lit inner far wall
  const shut = o.door >= 0 && o.door < 0.05;
  if (col < 0.75 && !shut) {
    const [hx, hy] = sk.hollow;
    const rx = sk.hrx * (1 - col * 0.6);
    const ry = sk.hry * (1 - col * 0.6);
    const lip = (x: number, y: number) => ((x - hx) / (rx + 2.2)) ** 2 + ((y - hy) / (ry + 2.2)) ** 2 <= 1;
    const rim = (x: number, y: number) => ((x - hx) / (rx + 1)) ** 2 + ((y - hy) / (ry + 1)) ** 2 <= 1;
    const hole = (x: number, y: number) => ((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 <= 1;
    const [lx, ly] = light.v2;
    for (let y = rnd(hy - ry - 3); y <= rnd(hy + ry + 3); y++)
      for (let x = rnd(hx - rx - 3); x <= rnd(hx + rx + 3); x++) {
        if (!q.isOpaque(x, y)) continue;
        if (hole(x, y)) {
          // light falls in from the top-left and catches the far-lower inner wall
          const nx = (x - hx) / rx;
          const ny = (y - hy) / ry;
          const inner = -(nx * lx + ny * ly);
          q.set(x, y, inner > 0.62 && nx * nx + ny * ny > 0.45 ? PAL.void1 : PAL.void0);
        } else if (rim(x, y)) q.set(x, y, CREASE);
        else if (lip(x, y)) {
          const nx = x - hx;
          const ny = y - hy;
          const d = (nx * lx + ny * ly) / Math.hypot(nx, ny);
          q.set(x, y, d > 0.25 ? BARK.L : d < -0.35 ? BARK.S : BARK.M);
        }
      }
  }
  f.comp.add(q, Part.trunk, { out: CREASE });
}

function drawDoor(f: Frame): void {
  const { sk, o, light, p } = f;
  if (o.door < 0 || o.doorFall >= 1) return;
  const [hx, hy] = sk.hollow;
  const k = clamp(o.door, 0, 1);
  if (k < 0.05) {
    // shut: the bark is whole over the hollow, a jagged split runs down where the doors will open
    for (let y = hy - sk.hry - 1; y <= hy + sk.hry + 1; y++) {
      const x = hx + ((y >> 1) % 2 ? 1 : 0);
      if (p.isOpaque(x, y)) p.set(x, y, CREASE);
    }
    return;
  }
  const q = layer();
  const fall = clamp(o.doorFall, 0, 1);
  const ph = sk.hry * 2 + 3;
  // two bark slabs swung out on the hollow's sides like shutters (sheared outward), then shaken loose and dropping
  for (const s of [-1, 1]) {
    const x0 = hx + s * (sk.hrx + 2 + rnd(k * 2 + fall * 5)) - (s < 0 ? 2 : 0);
    const dy = rnd(fall * fall * 28);
    for (let j = 0; j < ph; j++) {
      const y = rnd(hy - ph / 2) + j + dy;
      if (y > GY) continue;
      const sh = rnd(s * k * 2 * (j / ph - 0.5));
      q.rect(x0 + sh, y, 3, 1, BARK.M);
    }
  }
  bands(q, BARK, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.door, { out: PAL.ink });
}

function drawClub(f: Frame): void {
  const { sk, o, light } = f;
  if (o.unfurl < 0.35 && o.clubFree <= 0) return;
  const q = layer();
  const a = sk.clubButt;
  const g = sk.grip;
  const h = sk.clubHead;
  const m = polar(g, o.ca, CLUB_LEN * 0.55);
  limb(q, [a, g, m, h], 3.4, 8, CLUB.M);
  q.disc(rnd(h[0]), rnd(h[1]), 4.5, CLUB.M);
  // knots: big burls on the head end
  const kn: Pt[] = [polar(m, o.ca - 90, 3.2), polar(polar(g, o.ca, CLUB_LEN * 0.72), o.ca + 90, 4)];
  for (const k of kn) q.disc(rnd(k[0]), rnd(k[1]), 1.5, CLUB.M);
  // a broken branch stub near the head
  const st = polar(g, o.ca, CLUB_LEN * 0.68);
  limb(q, [st, polar(st, o.ca - 58, 4)], 2.4, 2, CLUB.M);
  bands(q, CLUB, light, 2, 2);
  // knot holes (dark eyes in the wood) on the mid plane; the sawn end shows pale rings
  for (const [t, off] of [[0.5, 0], [0.82, -1]] as const) {
    const c = polar(polar(g, o.ca, CLUB_LEN * t), o.ca + 90, off);
    const x = rnd(c[0]);
    const y = rnd(c[1]);
    if (q.isOpaque(x, y)) q.set(x, y, PAL.earth0);
    if (q.isOpaque(x, y + 1)) q.set(x, y + 1, PAL.earth2);
  }
  // the sawn butt of the head: pale end grain (a 2-px face toward the swing)
  const end = polar(h, o.ca, 3);
  for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [-1, -1]] as const) {
    const x = rnd(end[0]) + dx;
    const y = rnd(end[1]) + dy;
    if (q.isOpaque(x, y) && q.isOpaque(x + 1, y) && q.isOpaque(x, y + 1)) q.set(x, y, dx === 0 && dy === 0 ? HEART : PAL.earth3);
  }
  f.comp.add(q, Part.club, { out: PAL.ink });
}

function drawNearArm(f: Frame): void {
  const { sk, o, light } = f;
  if (o.unfurl < 0.05 || o.unravel > 0.02) return;
  const q = layer();
  const pts: Pt[] = [sk.shN, sk.elN, sk.wN];
  limb(q, pts, 7, 6, ROOT.M);
  // root fingers wrapped over the club grip (or splayed when the club is gone)
  if (o.clubFree <= 0 && o.unfurl > 0.35) {
    const d = o.ca;
    for (let i = 0; i < 3; i++) {
      const b = polar(sk.wN, d, -1 + i * 2);
      const a1 = polar(b, d - 90, 3.2);
      const a2 = polar(a1, d - 160, 2.2);
      limb(q, [b, a1, a2], 2.6, 2, ROOT.M);
    }
  } else {
    const dir = Math.atan2(sk.wN[1] - sk.elN[1], sk.wN[0] - sk.elN[0]) / DEG;
    for (let i = 0; i < 3; i++) {
      const a = dir + (i - 1) * 22;
      const k1 = polar(sk.wN, a, 4);
      limb(q, [sk.wN, k1, polar(k1, a + 30, 3)], 2.6, 2, ROOT.M);
    }
  }
  bands(q, ROOT, light, 2, 2);
  twistSeams(q, pts, 7, ROOT, 4, 0);
  f.comp.add(q, Part.nearArm, { out: CREASE });
}

function drawNearMoss(f: Frame): void {
  const { sk, o, light } = f;
  if (o.collapse > 0.45 || (o.door >= 0 && o.door < 0.2)) return;
  mossClump(f, [sk.shN[0], sk.shN[1] - 2], 5, MOSS, Part.nearMoss, 4, false);
  const q = layer();
  mushroom(q, [sk.shN[0] + 3, sk.shN[1] - 3], 5, light);
  mushroom(q, [sk.shN[0] - 1, sk.shN[1] - 3], 3, light);
  f.comp.add(q, Part.nearMoss, { out: PAL.earth1 });
}

/** the planting tendril: a thin root (3 → 2 px) with twist seams; an open tip forks into two prongs */
function drawTendril(f: Frame): void {
  const { sk, o, light } = f;
  if (sk.tendril.length < 2) return;
  const q = layer();
  limb(q, sk.tendril, 3.4, 2.2, ROOT.M);
  const tip = sk.tendril[sk.tendril.length - 1];
  const prev = sk.tendril[sk.tendril.length - 2];
  const dir = Math.atan2(tip[1] - prev[1], tip[0] - prev[0]) / DEG;
  if (o.topen > 0.5) for (const s of [-1, 1]) limb(q, [tip, polar(tip, dir + s * 50, 3)], 2.2, 2, ROOT.M);
  bands(q, ROOT, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.nearMoss, { out: CREASE });
}

/** the sprout on the club (special): a stem with two leaves; the bud is light (lightSprout) */
function drawClubSprout(f: Frame): { bud: Pt } | null {
  const { sk, o, light } = f;
  if (o.sprout <= 0.05 || o.unfurl < 0.35) return null;
  const q = layer();
  const base = polar(sk.grip, o.ca, CLUB_LEN * 0.74);
  const b0 = polar(base, o.ca - 90, 3);
  const h = 2 + rnd(o.sprout * 4);
  const tip: Pt = [b0[0] + 1, b0[1] - h];
  q.line(rnd(b0[0]), rnd(b0[1]), rnd(tip[0]), rnd(tip[1]), PAL.leaf2);
  if (o.sprout > 0.4) {
    q.rect(rnd(tip[0]) - 2, rnd(tip[1]) + 1, 2, 1, PAL.leaf2);
    q.rect(rnd(tip[0]) + 1, rnd(tip[1]) + 1, 2, 1, light.side < 0 ? PAL.leaf1 : PAL.leaf2);
  }
  f.comp.add(q, Part.sprout, {});
  return { bud: [rnd(tip[0]), rnd(tip[1]) - 1] };
}

/** the root arms unravelled: three loose strands each, slumping down and snaking into the tile */
function drawStrands(f: Frame): void {
  const { sk, o, light } = f;
  if (o.unravel <= 0.02) return;
  const u = clamp(o.unravel, 0, 1);
  for (const [sh, w0, tones, part, seed] of [[sk.shF, sk.wF, FAR, Part.farArm, 1], [sk.shN, sk.wN, ROOT, Part.nearArm, 2]] as const) {
    const q = layer();
    for (let s = 0; s < 3; s++) {
      const off = (s - 1) * (1.5 + u * 3);
      const end: Pt = [w0[0] + off * 1.4 + (s - 1) * u * 4, lerp(w0[1], GY + 6, u)];
      const mid: Pt = [lerp(sh[0], end[0], 0.5) + off + Math.sin((u * 3 + s) * 2) * 2 * u, lerp(sh[1], end[1], 0.45) + u * 6];
      const pts: Pt[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const c = bez([sh[0] + off * 0.4, sh[1]], mid, end, t);
        const wig = Math.sin(t * 9 + s * 2 + u * 6 + seed) * u * 1.6;
        pts.push([c[0] + wig, c[1]]);
      }
      limb(q, pts, 3, 2, tones.M);
    }
    bands(q, tones, light, 1, 1, { top: 1, bottom: 1 });
    f.comp.add(q, part, { out: CREASE });
  }
}

/** root tendrils from the trunk base snaking down into the tile (death / revive) */
function drawBaseRoots(f: Frame): void {
  const { sk, o, light } = f;
  if (o.roots <= 0.02) return;
  const q = layer();
  const r = clamp(o.roots, 0, 1);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const u = -1 + (2 * i) / (n - 1);
    const a: Pt = [sk.base[0] + u * 9, Math.min(GY - 2, sk.base[1] + 1)];
    const end: Pt = [AX + 1 + u * (12 + 8 * r), GY + 4];
    const pts: Pt[] = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      pts.push([lerp(a[0], end[0], t) + Math.sin(t * 7 + i * 1.7) * 1.5 * r, lerp(a[1], end[1], t)]);
    }
    limb(q, pts, 3, 2, ROOT.M);
  }
  bands(q, ROOT, light, 1, 1, { top: 1, bottom: 1 });
  f.comp.add(q, Part.nearLeg, { out: CREASE });
}

/** the lone ground sprout (death remnant / revive seed) */
function drawGroundSprout(f: Frame): Pt | null {
  const { o } = f;
  if (o.sproutG <= 0) return null;
  const q = layer();
  const x = AX + 1;
  const wilt = clamp(o.sproutG - 1, 0, 1);
  const h = rnd(6 - wilt * 2);
  const tipX = x + rnd(wilt * 2);
  // stem (2 px) bending over as it wilts
  for (let i = 0; i < h; i++) {
    const t = i / Math.max(1, h - 1);
    q.set(x + rnd(wilt * 2 * t * t), GY - i, wilt > 0.5 ? PAL.earth2 : PAL.leaf2);
  }
  const ty = GY - h + 1;
  const lc = wilt > 0.6 ? PAL.earth2 : PAL.leaf2;
  const dc = wilt > 0.6 ? PAL.earth1 : PAL.leaf1;
  if (wilt < 0.5) {
    q.rect(tipX - 3, ty - 1, 3, 2, lc);
    q.rect(tipX + 1, ty - 2, 3, 2, dc);
  } else {
    q.rect(tipX - 1, ty + 1, 2, 3, lc);
    q.rect(tipX + 2, ty, 2, 3, dc);
  }
  // a little mound of turned soil
  q.rect(x - 3, GY, 7, 1, PAL.earth1);
  f.comp.add(q, Part.fx, {});
  return wilt < 0.4 ? [tipX, ty - 2] : null;
}

/** splinters, leaves, dust, chips, spores: matter, outlined with the body */
function drawFx(f: Frame): void {
  const { sk, o } = f;
  const q = layer();
  const put2 = (x: number, y: number, c: number, w = 2, h = 2) => { if (y < GY) q.rect(rnd(x), rnd(y), w, h, c); };
  if (o.splinter > 0) {
    const s = o.splinter;
    for (let i = 0; i < 9; i++) {
      const a = (20 + i * 17 + jag(i, 4) * 12) * DEG;
      const v = 8 + jag(i, 7) * 12;
      const x = Math.min(W - 7, AX + o.sx + Math.cos(a) * v * s * (i % 2 ? 0.6 : -1.2));
      const y = GY + o.sy - Math.sin(a) * v * s * 1.5 + s * s * 18;
      put2(x, y, i % 3 ? PAL.earth3 : HEART, i % 3 === 0 ? 3 : 2, i % 3 === 1 ? 1 : 2);
    }
  }
  if (o.leaves > 0) {
    const s = o.leaves;
    for (let i = 0; i < 5; i++) {
      const x0 = Math.min(W - 8, AX + o.sx - 14 + jag(i, 9) * 18);
      const x = x0 + Math.sin(s * 6 + i * 2) * 3;
      const y = GY + o.sy - 18 - jag(i, 5) * 10 + s * 20;
      put2(x, y, i % 2 ? PAL.leaf2 : PAL.leaf1, 2, 1);
    }
  }
  if (o.dust > 0) {
    const s = o.dust;
    for (const fx of [sk.footN[0] + 4, sk.footF[0] - 3]) {
      for (let i = 0; i < 3; i++) {
        const x = fx + (i - 1) * (3 + s * 6) * (fx > AX ? 1 : -1);
        const y = GY - 1 - s * (2 + i * 2);
        if (s < 0.95) put2(x, y, s < 0.5 ? PAL.earth3 : PAL.earth2, 2, 1);
      }
    }
  }
  if (o.spray > 0) {
    const s = o.spray;
    const c = sk.hollow;
    for (let i = 0; i < 6; i++) {
      const a = (195 - i * 22 + jag(i, 2) * 10) * DEG;
      const v = 5 + jag(i, 6) * 9;
      put2(c[0] + Math.cos(a) * v * s - 3, c[1] - 4 + Math.sin(a) * v * s + s * s * 10, i % 2 ? PAL.earth3 : HEART, 2, 1);
    }
  }
  if (o.puff > 0) {
    const s = o.puff;
    for (const [base, n] of [[[sk.shN[0] - 3, sk.shN[1] - 9] as Pt, 4], [[sk.shF[0] - 1, sk.shF[1] - 9] as Pt, 3]] as const) {
      for (let i = 0; i < n; i++) {
        const x = base[0] + (i - n / 2) * (2 + s * 3) + Math.sin(s * 5 + i) * 1.5;
        const y = base[1] - s * (5 + i * 3);
        if (s < 0.92) put2(x, y, s < 0.5 ? PAL.earth4 : PAL.earth3, 2, 2);
      }
    }
  }
  f.comp.add(q, Part.fx, {});
}

// ---------------------------------------------------------------- light layer

function eyeLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.eye <= 0.05 || o.collapse > 0.7) return;
  const inHollow = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const c = p.get(x, y);
    return comp.id[y * W + x] === Part.trunk && (c === PAL.void0 || c === PAL.void1);
  };
  const put = (x: number, y: number, c: number) => { if (inHollow(x, y)) p.set(x, y, c); };
  const hot = o.eye > 1.4;
  const lit = hot ? PAL.gold4 : o.eye > 0.6 ? PAL.gold3 : PAL.gold2;
  const core = hot ? PAL.white : o.eye > 0.6 ? PAL.gold4 : PAL.gold3;
  const look = clamp(rnd(o.look), -1, 1);
  const [hx, hy] = sk.hollow;
  const yN = hy - 2;
  // near eye (2×2, the front) and far eye (1×2, foreshortened), set in the upper hollow
  const nX = hx + 1 + look;
  const fX = hx - 2 + look;
  if (o.lid >= 2) {
    put(nX, yN + 1, PAL.gold1);
    put(nX + 1, yN + 1, PAL.gold1);
    put(fX, yN + 1, PAL.gold1);
    return;
  }
  if (o.lid === 0) {
    put(nX, yN, core);
    put(nX + 1, yN, lit);
    put(fX, yN, lit);
  }
  put(nX, yN + 1, lit);
  put(nX + 1, yN + 1, o.lid === 0 ? lit : core);
  put(fX, yN + 1, o.eye > 0.6 ? PAL.gold2 : PAL.gold1);
  if (hot) {
    // blazing: the embers flare taller (no spill row: a lit line under the eyes would read as a mouth)
    put(nX, yN + 2, PAL.gold2);
    put(nX + 1, yN + 2, PAL.gold2);
  }
}

function knotLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.knots <= 0.05 || o.collapse > 0.7) return;
  const [hx, hy] = sk.hollow;
  const ok = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && comp.id[y * W + x] === Part.trunk;
  const spots: Pt[] = [[hx - 2, hy + 2], [hx + 1, hy + 3]];
  const n = Math.min(2, Math.ceil(o.knots - 0.05));
  for (let i = 0; i < n; i++) {
    const [x, y] = spots[i];
    const hot = o.knotHot > 0.5 && i === n - 1;
    // a 2×2 knot light, a 1-px ring in the hollow's dark (white heart on the flare)
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) if (ok(x + dx, y + dy)) p.set(x + dx, y + dy, hot && dx === 0 && dy === 0 ? PAL.white : PAL.void4);
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [-1, 1], [2, 1], [0, 2], [1, 2]] as const) if (ok(x + dx, y + dy) && (hot || (dx + dy) % 2 === 0)) p.set(x + dx, y + dy, hot ? PAL.void3 : PAL.void2);
  }
}

function scarLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.scar <= 0) return;
  const top = sk.sp(0.9);
  const h0 = sk.hollow;
  const path: Pt[] = [[top[0] + 1, top[1] - 1], [top[0] + 3, top[1] + 4], [top[0] + 0, top[1] + 8], [h0[0] - 1, h0[1] - sk.hry - 1]];
  const hot = o.scar > 1.4;
  for (let i = 0; i + 1 < path.length; i++) {
    const [a, b] = [path[i], path[i + 1]];
    const n = Math.max(1, rnd(Math.hypot(b[0] - a[0], b[1] - a[1])));
    for (let k = 0; k <= n; k++) {
      const x = rnd(a[0] + ((b[0] - a[0]) * k) / n);
      const y = rnd(a[1] + ((b[1] - a[1]) * k) / n);
      if (x < 0 || y < 0 || x >= W || y >= H || comp.id[y * W + x] !== Part.trunk || p.get(x, y) === PAL.ink) continue;
      p.set(x, y, hot ? PAL.white : PAL.void4);
      const xc = x - f.light.side;
      if (p.isOpaque(xc, y) && p.get(xc, y) !== PAL.ink) p.set(xc, y, hot ? PAL.void4 : PAL.void3);
    }
  }
}

function seedLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.seed <= 0) return;
  const [x, y] = [rnd(sk.tip[0]), rnd(sk.tip[1]) - 1];
  // a violet seed of light: a 3×4 drop (void3 rim, void4 heart, a white core when it blazes), a dim halo pixel row
  for (const [dx, dy] of [[0, -2], [-1, -1], [1, -1], [-1, 0], [1, 0], [0, 1]] as const) p.set(x + dx, y + dy, PAL.void3);
  p.set(x, y - 1, PAL.void4);
  p.set(x, y, o.seed > 1.4 ? PAL.white : PAL.void4);
  for (const [dx, dy] of [[-2, -1], [2, -1], [0, -3], [0, 2]] as const) if (!p.isOpaque(x + dx, y + dy)) p.set(x + dx, y + dy, PAL.void2);
}

function flyLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.fly < 0) return;
  // out of the hollow, a lazy loop in front of the chest, back in
  const u = o.fly;
  if (u < 0.08 || u > 0.92) return;
  const a = (u - 0.08) / 0.84;
  const [hx, hy] = sk.hollow;
  const x = rnd(hx + 2 + Math.sin(a * Math.PI) * 10 + Math.sin(a * Math.PI * 3) * 2);
  const y = rnd(hy - Math.sin(a * Math.PI) * 9 + Math.cos(a * Math.PI * 2) * 2);
  if (x >= 2 && y >= 2 && x < W - 2) {
    p.set(x, y, PAL.gold4);
    if (!p.isOpaque(x - 1, y)) p.set(x - 1, y, PAL.gold2);
  }
}

function budLight(f: Frame, bud: Pt | null, groundBud: Pt | null): void {
  const { p, o } = f;
  if (bud && o.sprout > 0.6) {
    p.set(bud[0], bud[1], o.sprout > 0.95 ? PAL.void4 : PAL.void3);
    p.set(bud[0], bud[1] + 1, PAL.void3);
  }
  if (groundBud) p.set(groundBud[0], groundBud[1], PAL.leaf3);
}

function seamLight(f: Frame): void {
  const { p, o, sk } = f;
  if (o.door < 0 || o.door > 0.05 || o.eye <= 0.3) return;
  const [hx, hy] = sk.hollow;
  for (let y = hy - 4; y <= hy + 1; y++) {
    const x = hx + (y % 3 === 0 ? 1 : 0);
    if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) p.set(x, y, y === hy - 2 ? PAL.gold4 : PAL.gold2);
  }
}

function glintLight(f: Frame): void {
  const { p, o, sk, comp } = f;
  if (o.glint <= 0 || o.collapse > 0.4) return;
  const x = rnd(sk.shN[0] - 3) + f.light.lx(-1);
  const y = rnd(sk.shN[1] - 8);
  const put = (xx: number, yy: number) => { if (comp.id[yy * W + xx] === Part.nearMoss && p.get(xx, yy) !== PAL.ink) p.set(xx, yy, PAL.white); };
  put(x, y);
  if (o.glint > 1.5) { put(x - 1, y); put(x + 1, y); put(x, y + 1); }
}

// ---------------------------------------------------------------- draw

export function drawOgre(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const comp = new Comp(p);
  const f: Frame = { p, comp, light, o, sk };

  drawFarArm(f);
  leg(f, sk.hipF, sk.kneeF, sk.footF, FAR, Part.farLeg, -1);
  drawMane(f);
  drawFarMoss(f);
  drawTrunk(f);
  drawBaseRoots(f);
  leg(f, sk.hipN, sk.kneeN, sk.footN, ROOT, Part.nearLeg, 1);
  drawDoor(f);
  drawClub(f);
  drawNearArm(f);
  drawStrands(f);
  drawNearMoss(f);
  drawTendril(f);
  const sprout = drawClubSprout(f);
  const gb = drawGroundSprout(f);
  drawFx(f);

  // nothing exists below the ground line
  for (let y = GY + 1; y < H; y++)
    for (let x = 0; x < W; x++)
      if (p.isOpaque(x, y)) {
        p.erase(x, y);
        comp.id[y * W + x] = Part.none;
      }

  p.outline(PAL.ink);

  // light layer (never outlined)
  scarLight(f);
  seamLight(f);
  knotLight(f);
  eyeLight(f);
  seedLight(f);
  flyLight(f);
  budLight(f, sprout?.bud ?? null, gb);
  glintLight(f);
}
