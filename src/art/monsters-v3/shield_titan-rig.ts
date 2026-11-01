// Kalkan Devi v3 — the rig: Pose → pixels (docs/v3/oturum-f/shield_titan.md §1–§3, §12).
//
// "Sur": an old, bald, white-bearded giant in leather and bare skin behind a red-copper TOWER SHIELD that stands a
// head taller than he is. His far hand hooks four fingers over the shield's top rim, his near fist clamps its back
// edge, his head and the white beard show past the back (left) edge. The shield's one feature is the round SUNSTONE
// boss (gold light): the brightest point and the source of the ward. Three horizontal bronze COURSES with rivets cross
// the copper face like masonry; they light course by course (never a vertical seam: §12.3).
//
//   - the shield is ONE texture tex(u, v) (u = length 0…56 from the foot, v = width 0…22 from the back edge) drawn
//     through an affine map O + u·U + v·V plus a thickness sweep T: upright / tilted / lying-away (summon) /
//     lying-back (death) are the same authored face; upright it is the identity map, whole px (IŞ-12);
//   - the giant is posed parts (legs, kilt, torso, arms, head, beard) shaded with flat bands toward the key light;
//   - ONE key light: 'left' (P1) or 'right' (P2 relight). Planes are chosen per light; the silhouette never depends on it;
//   - light (sunstone, iris rings, lit courses, rim crackle, glint) is painted after the outline and never outlined.
// Frame 84×82; the anchor (AX, GY) is the ground point of the stance.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import { BEARD, Comp, IRON, LEATHER, SKIN, SKIN_FAR, bands, hash2, type Tones } from './shield_titan-kit';

export const W = 84;
export const H = 82;
export const AX = 34;
export const GY = 77;
/** Shield face size (texels): length (u) and width (v). */
export const SL = 56;
export const SW = 22;
/** The shield's upright back-bottom corner (continuous coords: the face covers x 36…57, rows 22…77). */
const SX0 = 36;
const SY0 = GY + 1;

type Pt = readonly [number, number];
const rnd = Math.round;
const rad = (d: number) => (d * Math.PI) / 180;

const enum Part {
  none = 0,
  legF,
  armF,
  legN,
  torso,
  kilt,
  head,
  beard,
  strap,
  shield,
  fingers,
  armN,
  fist,
  fx,
}

// ---------------------------------------------------------------- pose

export interface Pose {
  /** giant: pelvis offset (px, + down) */
  gx: number;
  gy: number;
  /** chest offset relative to the pelvis (lean, breath) and head offset relative to the chest */
  cx: number;
  cy: number;
  hx: number;
  hy: number;
  /** face features: nod (+1 chin down / −1 chin up), lid 0 open · 1 half · 2 shut, mouth 0 shut · 1 open shout */
  nod: number;
  lid: number;
  mouth: number;
  /** beard tip offset (sway / swing) and bristle 0…1 (static charge) */
  bx: number;
  by: number;
  bristle: number;
  /** near hand: mode 0 clamps the shield's back edge at texel u = nu; mode 1 a free fist at (nhx, nhy) */
  nu: number;
  nhx: number;
  nhy: number;
  nmode: number;
  /** far hand: 0 fingers over the rim (v position fv along the top edge), 1 free fist at (fhx, fhy) */
  fmode: number;
  fv: number;
  fhx: number;
  fhy: number;
  /** finger lifts (px) back → front */
  f0: number;
  f1: number;
  f2: number;
  f3: number;
  /** feet: x shifts / lifts (near, far) */
  nfx: number;
  nfl: number;
  ffx: number;
  ffl: number;
  /** 1 giant drawn, 0 hidden (the lid covers him); peek 1 = beard tip + fingers out from under the lid's near edge */
  show: number;
  peek: number;
  /** summon haul: two straps from the fists to the slab's far edge */
  haul: number;
  /** the hanging strap end's swing (px) */
  swing: number;
  // --- shield
  /** offset of the shield (px), lift off the floor (px), sink into it (px, bottom clipped at the ground line) */
  sx: number;
  sy: number;
  lift: number;
  sink: number;
  /** forward tilt (deg, + = top toward the foe, pivot on the front-bottom corner; − back, pivot on the back corner) */
  rot: number;
  /** summon rise: the slab lying face-up INTO the screen (0°) → upright (90°) */
  aw: number;
  /** death fall: upright (0°) → lying face-up BACKWARD along screen x (90°); the foot skids out */
  fall: number;
  /** a 1-px dirt lip at the shield's foot (planted) */
  lip: number;
  // --- light / fx
  /** sunstone: 0 dead · 1 core · 2 core + white-hot centre · 3 flare (the dome too) */
  boss: number;
  /** iris rings around the boss 0…3 (light) */
  iris: number;
  /** the sleeping ward's ripple: one dim bronze ring stepping outward from the boss (0 none, 1…3 ring) */
  ripple: number;
  /** copper sheen drift (texels): the glance of the light slides as the slab rocks */
  sheen: number;
  /** bronze courses lit bottom → top 0…3; hot = the top lit course white-hot */
  courses: number;
  hot: number;
  /** rim crackle (hitMagic) 0 none, else its phase */
  zap: number;
  /** copper tarnish 0…2 (two tone steps, the front runs far → near) */
  tarn: number;
  /** the anim's one copper glint (1 = on) */
  glint: number;
  /** 1 = the giant alone, no shield (cinematic-only frames: the direct attack's sledge leaves his hands) */
  bare: number;
  /** air smear trailing the top edge on the swing (0 none, else its length px) */
  smear: number;
  /** a loose dust speck sliding off the foot (0 none, else its phase 1…3); dust puff at the feet (0 none, else size) */
  speck: number;
  puff: number;
}

export const NEUTRAL: Pose = {
  gx: 0, gy: 0, cx: 0, cy: 0, hx: 0, hy: 0, nod: 0, lid: 0, mouth: 0, bx: 0, by: 0, bristle: 0,
  nu: 26, nhx: 35, nhy: 52, nmode: 0, fmode: 0, fv: 4, fhx: 40, fhy: 30, f0: 0, f1: 0, f2: 0, f3: 0,
  nfx: 0, nfl: 0, ffx: 0, ffl: 0, show: 1, peek: 0, haul: 0, swing: 0,
  sx: 0, sy: 0, lift: 0, sink: 0, rot: 0, aw: 90, fall: 0, lip: 0,
  boss: 1, iris: 0, ripple: 0, sheen: 0, courses: 0, hot: 0, zap: 0, tarn: 0, glint: 0, smear: 0, speck: 0, puff: 0, bare: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- shield geometry

export interface Slab {
  O: Pt;
  U: Pt;
  V: Pt;
  T: Pt;
}

/** The affine frame of the shield face for a pose. */
export function slab(o: Pose): Slab {
  const lift = o.lift - o.sink;
  if (o.fall > 0) {
    const s = Math.sin(rad(o.fall));
    const c = Math.cos(rad(o.fall));
    // a rigid rotation of the side view (top → left) whose width axis turns into the iso depth (half scale): the
    // front edge ends FAR (up), the back edge near; det = cos² + ½ sin² > 0, so the face never mirrors mid-fall
    return {
      O: [SX0 + o.sx + 28 * s, SY0 + o.sy - lift - 3 * s],
      U: [-s, -c],
      V: [c, -0.5 * s],
      T: [-2 * (1 - s), -1 * (1 - s) + 3 * s],
    };
  }
  if (o.aw < 90) {
    const th = rad(o.aw);
    const k = o.aw / 90;
    return {
      O: [SX0 + o.sx, SY0 + o.sy - lift - rnd(2 * (1 - k))],
      U: [0, -(0.5 * Math.cos(th) + Math.sin(th))],
      V: [1, 0],
      T: [-2 * k, 2 * (1 - k) - k],
    };
  }
  const a = rad(o.rot);
  const U: Pt = [Math.sin(a), -Math.cos(a)];
  const V: Pt = [Math.cos(a), Math.sin(a)];
  let O: Pt = [SX0 + o.sx, SY0 + o.sy - lift];
  if (o.rot > 0) {
    const F: Pt = [SX0 + SW + o.sx, SY0 + o.sy - lift];
    O = [F[0] - SW * V[0], F[1] - SW * V[1]];
  }
  return { O, U, V, T: [-2, -1] };
}

/** A face point (u, v) on screen. */
export function slabAt(s: Slab, u: number, v: number): Pt {
  return [s.O[0] + u * s.U[0] + v * s.V[0], s.O[1] + u * s.U[1] + v * s.V[1]];
}

/** Inverse map: screen point → (u, v), or null when degenerate. */
function inv(s: Slab, x: number, y: number): [number, number] {
  const det = s.U[0] * s.V[1] - s.U[1] * s.V[0];
  const dx = x - s.O[0];
  const dy = y - s.O[1];
  return [(dx * s.V[1] - dy * s.V[0]) / det, (s.U[0] * dy - s.U[1] * dx) / det];
}

const BOSS_U = 37.5;
const BOSS_V = 11;
/** The courses' rows (texel u): [upper, lower] per course, bottom → top. */
const COURSES: readonly (readonly [number, number])[] = [[13, 12], [38, 37], [49, 48]];

const enum Reg {
  none = 0,
  core,
  dome,
  bossRim,
  plate,
  rim,
  rimOuter,
  edge,
  courseHi, // + course index 0..2
  courseHi1,
  courseHi2,
  courseLo,
  courseLo1,
  courseLo2,
}

/** Tarnish: one tone step down per level. */
const TARN: Readonly<Record<number, number>> = {
  [PAL.fire3]: PAL.fire2,
  [PAL.fire2]: PAL.fire1,
  [PAL.fire1]: PAL.fire0,
  [PAL.fire0]: PAL.earth0,
  [PAL.gold2]: PAL.gold1,
  [PAL.gold1]: PAL.gold0,
  [PAL.gold0]: PAL.earth0,
  [PAL.earth0]: PAL.earth0,
};

/** The arched top: texel rows the face loses toward its corners (a tower shield, not a door). */
function topOf(iv: number): number {
  const e = Math.abs(iv + 0.5 - SW / 2) / (SW / 2);
  return SL - Math.floor(3.2 * e * e);
}
/** Is texel (u, v) on the face (arched top, 1-texel chamfered foot corners)? */
function inShape(u: number, v: number): boolean {
  if (!(u >= 0 && v >= 0 && v < SW)) return false;
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  if (iu >= topOf(iv)) return false;
  if (iu === 0 && (iv === 0 || iv === SW - 1)) return false;
  return true;
}

/** The authored face: tone + region of texel (u, v) under the light. */
function tex(u: number, v: number, light: Light, tarn: number, sheen = 0): [number, Reg] {
  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const vl = light.side < 0 ? iv : SW - 1 - iv; // texels from the lit long edge
  const vs = SW - 1 - vl; // texels from the shade long edge
  const top = topOf(iv);
  const fromTop = Math.min(top - 1 - iu, top - 1 - Math.floor(u + 1) + 1, topOf(Math.max(0, iv - 1)) - 1 - iu, topOf(Math.min(SW - 1, iv + 1)) - 1 - iu);
  let c: number;
  let r: Reg;
  const d = Math.hypot(u - BOSS_U, v - BOSS_V);
  if (iu < 2 || fromTop < 2 || iv < 2 || iv >= SW - 2) {
    const outer = iu === 0 || fromTop < 1 || iv === 0 || iv === SW - 1;
    const lit = fromTop < 2 || (vl < 2 && iu >= 2);
    c = outer ? (lit ? PAL.gold1 : PAL.gold0) : lit ? PAL.gold2 : PAL.gold1;
    // studs down the side rims every 5 texels
    if (!outer && (iv < 2 || iv >= SW - 2) && iu > 3 && iu % 5 === 2 && fromTop >= 3) c = lit ? PAL.fire4 : PAL.gold2;
    r = outer ? Reg.rimOuter : Reg.rim;
  } else if (d < 2.3) {
    c = PAL.gold1;
    r = Reg.core;
  } else if (d < 3.7) {
    const lit = (v - BOSS_V) * light.side * 0.8 + (u - BOSS_U) > 0;
    c = lit ? PAL.gold2 : PAL.gold1;
    r = Reg.dome;
  } else if (d < 4.7) {
    c = PAL.gold0;
    r = Reg.bossRim;
  } else {
    r = Reg.plate;
    let course = -1;
    let hi = false;
    for (let k = 0; k < COURSES.length; k++)
      if (iu === COURSES[k][0] || iu === COURSES[k][1]) {
        course = k;
        hi = iu === COURSES[k][0];
      }
    if (course >= 0) {
      const stud = (iv - 3) % 4 === 0;
      c = hi ? (stud ? PAL.fire4 : vs < 3 ? PAL.gold1 : PAL.gold2) : stud ? PAL.gold1 : PAL.gold0;
      r = ((hi ? Reg.courseHi : Reg.courseLo) + course) as Reg;
    } else {
      // a convex face: the sheen a third in from the lit edge, falling off into the shade edge
      c = PAL.fire1;
      const sv = vl - sheen;
      if (vl <= 3 && sv <= 3) c = PAL.fire2;
      else if (sv <= 5) c = iu > 6 && sv >= 4 ? PAL.fire3 : PAL.fire2;
      else if (sv <= 8) c = PAL.fire2;
      else if (vs <= 3) c = PAL.fire0;
      const underBand = COURSES.some(([, lo]) => iu === lo - 1) || fromTop === 2;
      if (underBand) c = c === PAL.fire3 ? PAL.fire2 : c === PAL.fire2 ? PAL.fire1 : PAL.fire0;
      // the boss casts a crescent of shade below it, away from the light
      if (d < 5.8 && u < BOSS_U && (v - BOSS_V) * light.side < 1) c = c === PAL.fire3 ? PAL.fire2 : PAL.fire0;
    }
  }
  // tarnish: the front runs far → near (texel v from the front edge, which is the far edge when the lid lies)
  if (tarn > 0) {
    const steps = (tarn >= 1 ? 1 : 0) + (tarn >= 2 ? 1 : 0);
    const frac = tarn - Math.floor(tarn);
    let n = steps;
    if (frac > 0 && SW - 1 - iv < frac * (SW + 1)) n++;
    for (let i = 0; i < n; i++) c = TARN[c] ?? c;
  }
  return [c, r];
}

interface ShieldBuf {
  reg: Uint8Array;
  u: Float32Array;
  v: Float32Array;
}

/** The shield as a part: the face through the affine map, the thickness sweep behind it, clipped at the ground line. */
function drawShield(o: Pose, light: Light, buf: ShieldBuf): PixelCanvas {
  const q = new PixelCanvas(W, H);
  const s = slab(o);
  const corners = [slabAt(s, 0, 0), slabAt(s, SL, 0), slabAt(s, 0, SW), slabAt(s, SL, SW)];
  const xs = corners.flatMap((p) => [p[0], p[0] + s.T[0]]);
  const ys = corners.flatMap((p) => [p[1], p[1] + s.T[1]]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const x1 = Math.min(W - 1, Math.ceil(Math.max(...xs)) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const y1 = Math.min(GY, Math.ceil(Math.max(...ys)) + 1);
  const tl = Math.max(Math.abs(s.T[0]), Math.abs(s.T[1]));
  const n = Math.max(1, Math.ceil(tl - 1e-6));
  const inside = inShape;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const [u, v] = inv(s, px, py);
      const i = y * W + x;
      if (inside(u, v)) {
        const [c, r] = tex(u, v, light, o.tarn, o.sheen);
        q.set(x, y, c);
        buf.reg[i] = r;
        buf.u[i] = u;
        buf.v[i] = v;
        continue;
      }
      if (tl < 0.5) continue;
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        const [eu, ev] = inv(s, px - s.T[0] * f, py - s.T[1] * f);
        if (!inside(eu, ev)) continue;
        let c: number;
        if (s.T[1] > 0.5 && Math.abs(s.T[0]) < 1) c = k === n ? PAL.gold0 : PAL.gold1; // the near (front) edge of a lying slab
        else if (eu >= topOf(Math.floor(ev)) - 1.5 && s.T[1] < 0) c = PAL.gold2; // the top edge faces up: lit
        else c = (s.T[0] < 0) === (light.side < 0) ? PAL.gold1 : PAL.gold0; // the side edge: lit toward the light
        if (o.tarn >= 1) c = TARN[c] ?? c;
        q.set(x, y, c);
        buf.reg[i] = Reg.edge;
        break;
      }
    }
  // a planted foot's dirt lip: lumps over the face's bottom row
  if (o.lip && o.fall === 0 && o.aw >= 90) {
    const a = slabAt(s, 0, 0);
    const b = slabAt(s, 0, SW);
    const yb = Math.min(GY, Math.floor(Math.max(a[1], b[1]) - 0.5));
    for (let x = Math.ceil(a[0]); x < Math.floor(b[0]); x++) {
      if (!q.isOpaque(x, yb)) continue;
      const h = hash2(x, 7, 3);
      q.set(x, yb, h < 0.5 ? PAL.earth2 : PAL.earth1);
      if (h < 0.3 && q.isOpaque(x, yb - 1)) q.set(x, yb - 1, PAL.earth1);
    }
  }
  return q;
}

// ---------------------------------------------------------------- giant skeleton

export interface Skel {
  P: Pt;
  C: Pt;
  Hc: Pt;
  Sn: Pt;
  Sf: Pt;
  hipN: Pt;
  hipF: Pt;
  anN: Pt;
  anF: Pt;
  knN: Pt;
  knF: Pt;
  wN: Pt;
  elN: Pt;
  wF: Pt;
  elF: Pt;
  tip: Pt;
}

/** Far-hand rim point: where the fingers hook over the top edge (frame px). */
function rimPoint(o: Pose, s: Slab): Pt {
  return slabAt(s, SL - 1, o.fv + 4);
}

export function skeleton(o: Pose): Skel {
  const P: Pt = [22 + o.gx, 58 + o.gy];
  const C: Pt = [P[0] + o.cx, P[1] - 16 + o.cy];
  const Hc: Pt = [C[0] + 1 + o.hx, C[1] - 9 + o.hy];
  const Sn: Pt = [C[0] - 8, C[1] + 1];
  const Sf: Pt = [C[0] + 7, C[1] - 2];
  const hipN: Pt = [P[0] - 4, P[1] + 1];
  const hipF: Pt = [P[0] + 5, P[1] + 1];
  const anN: Pt = [AX - 15 + o.nfx, GY - 4 - o.nfl];
  const anF: Pt = [AX - 3 + o.ffx, GY - 4 - o.ffl];
  const knN = ik2(hipN, anN, 9, 9, -1) as Pt;
  const knF = ik2(hipF, anF, 9, 9, -1) as Pt;
  const reach = (a: Pt, b: Pt, len: number): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const d = Math.hypot(dx, dy);
    return d <= len ? b : [a[0] + (dx / d) * len, a[1] + (dy / d) * len];
  };
  const s = slab(o);
  const fT: Pt = o.fmode === 0 ? (() => { const r = rimPoint(o, s); return [r[0], r[1] + 3] as Pt; })() : [o.fhx, o.fhy];
  const wF = reach(Sf, fT, 21);
  const elF = ik2(Sf, wF, 11, 11, -1) as Pt;
  const nT: Pt = o.nmode === 0 ? (() => { const r = slabAt(s, o.nu, -1); return [r[0], r[1]] as Pt; })() : [o.nhx, o.nhy];
  const wN = reach(Sn, nT, 22);
  const elN = ik2(Sn, wN, 11, 12, 1) as Pt;
  const tip: Pt = [Hc[0] + 2 + o.bx, Hc[1] + 20 + o.by];
  return { P, C, Hc, Sn, Sf, hipN, hipF, anN, anF, knN, knF, wN, elN, wF, elF, tip };
}

// ---------------------------------------------------------------- parts

const layer = () => new PixelCanvas(W, H);

function tube(q: PixelCanvas, a: Pt, b: Pt, w: number, c: number): void {
  q.thickLine(a[0], a[1], b[0], b[1], w, c);
}

function drawLeg(cp: Comp, sk: Skel, o: Pose, light: Light, near: boolean): void {
  const hip = near ? sk.hipN : sk.hipF;
  const kn = near ? sk.knN : sk.knF;
  const an = near ? sk.anN : sk.anF;
  const t: Tones = near ? SKIN : SKIN_FAR;
  const q = layer();
  tube(q, hip, kn, 8, t.M);
  tube(q, kn, an, 7, t.M);
  bands(q, t, light, 2, 2);
  cp.add(q, near ? Part.legN : Part.legF, { out: PAL.skin0 });
  // leather shin wraps: diagonal stripes over the shin
  const wr = layer();
  tube(wr, [kn[0] + (an[0] - kn[0]) * 0.35, kn[1] + (an[1] - kn[1]) * 0.35], [an[0], an[1] + 1], 7, LEATHER.M);
  bands(wr, near ? LEATHER : { L: LEATHER.M, M: LEATHER.M, S: LEATHER.S, D: LEATHER.S }, light, 2, 2);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) if (wr.isOpaque(x, y) && y % 3 === 0) wr.set(x, y, LEATHER.S);
  cp.add(wr, near ? Part.legN : Part.legF, {});
  // iron knee guard
  const k = layer();
  k.disc(kn[0] + 0.5, kn[1], 2.7, IRON.M);
  bands(k, IRON, light, 2, 1);
  cp.add(k, near ? Part.legN : Part.legF, { out: PAL.stone1 });
  // the big bare foot, toes forward
  const fy = GY - 4 - (near ? o.nfl : o.ffl);
  const fx = an[0];
  const foot = layer();
  foot.poly([[fx - 4, fy + 5], [fx - 4, fy + 1], [fx + 2, fy], [fx + 6, fy + 2], [fx + 8, fy + 3], [fx + 8, fy + 5]], t.M);
  bands(foot, t, light, 2, 1);
  for (let i = 0; i < 3; i++) foot.set(fx + 4 + i * 2 - 1, fy + 4, t.S); // toe creases
  cp.add(foot, near ? Part.legN : Part.legF, { out: PAL.skin0 });
}

function drawKilt(cp: Comp, sk: Skel, light: Light): void {
  const [px, py] = sk.P;
  const q = layer();
  q.poly([[px - 10, py - 3], [px + 9, py - 3], [px + 11, py + 7], [px - 11, py + 7]], LEATHER.M);
  bands(q, LEATHER, light, 2, 2);
  // strips: 1-px slits every 4 px, open toward the hem
  for (let y = py; y <= py + 7; y++)
    for (let x = px - 11; x <= px + 11; x++) if (q.isOpaque(x, y) && ((x - px + 40) % 4 === 0)) q.set(x, y, LEATHER.S);
  // belt + bronze buckle
  for (let x = px - 10; x <= px + 9; x++) {
    if (q.isOpaque(x, py - 3)) q.set(x, py - 3, LEATHER.L);
    if (q.isOpaque(x, py - 2)) q.set(x, py - 2, LEATHER.S);
  }
  q.rect(px + 2, py - 3, 2, 2, PAL.gold2).set(px + 3, py - 2, PAL.gold1);
  cp.add(q, Part.kilt, { out: PAL.earth0 });
}

function drawTorso(cp: Comp, sk: Skel, light: Light): void {
  const { P, C, Sn, Sf } = sk;
  const q = layer();
  q.poly([
    [Sn[0] - 3, Sn[1] - 3], [C[0], C[1] - 4], [Sf[0] + 3, Sf[1] - 2], [Sf[0] + 5, Sf[1] + 5],
    [P[0] + 8, P[1] - 6], [P[0] + 8, P[1] - 1], [P[0] - 9, P[1] - 1], [P[0] - 10, P[1] - 7], [Sn[0] - 5, Sn[1] + 5],
  ], SKIN.M);
  q.disc(Sn[0] - 1, Sn[1] + 1, 4.6, SKIN.M);
  q.disc(Sf[0] + 1, Sf[1] + 1, 4.2, SKIN.M);
  bands(q, SKIN, light, 3, 3);
  // belly crease + navel
  for (let x = P[0] - 6; x <= P[0] + 5; x++) if (q.isOpaque(x, P[1] - 7) && x % 2 === 0) q.set(x, P[1] - 7, SKIN.S);
  // leather bandolier, near shoulder → far hip
  const b = layer();
  b.thickLine(Sn[0] + 1, Sn[1] - 3, P[0] + 8, P[1] - 4, 2.6, LEATHER.M);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b.isOpaque(x, y) && !q.isOpaque(x, y)) b.erase(x, y);
  bands(b, LEATHER, light, 1, 1);
  cp.add(q, Part.torso, { out: PAL.skin0 });
  cp.add(b, Part.torso, {});
}

function drawArm(cp: Comp, sk: Skel, o: Pose, light: Light, near: boolean): void {
  const S = near ? sk.Sn : sk.Sf;
  const el = near ? sk.elN : sk.elF;
  const w = near ? sk.wN : sk.wF;
  const t = near ? SKIN : SKIN_FAR;
  const q = layer();
  tube(q, S, el, 7, t.M);
  tube(q, el, w, 6, t.M);
  q.disc(S[0], S[1], 3.6, t.M);
  bands(q, t, light, 2, 2);
  cp.add(q, near ? Part.armN : Part.armF, { out: PAL.skin0 });
  // leather bracer near the wrist
  const br = layer();
  const k = 0.55;
  tube(br, [el[0] + (w[0] - el[0]) * k, el[1] + (w[1] - el[1]) * k], [w[0], w[1]], 6.4, LEATHER.M);
  bands(br, LEATHER, light, 1, 1);
  cp.add(br, near ? Part.armN : Part.armF, {});
  const showFist = near ? true : o.fmode === 1;
  if (showFist) {
    const dx = w[0] - el[0];
    const dy = w[1] - el[1];
    const l = Math.hypot(dx, dy) || 1;
    const f = layer();
    f.disc(w[0] + (dx / l) * 2.5, w[1] + (dy / l) * 2.5, 3.7, t.M);
    bands(f, t, light, 2, 1);
    // knuckle creases
    const kx = rnd(w[0] + (dx / l) * 4);
    const ky = rnd(w[1] + (dy / l) * 4);
    f.set(kx, ky - 1, t.S).set(kx, ky + 1, t.S);
    cp.add(f, near ? Part.fist : Part.armF, { out: PAL.skin0 });
  }
}

function drawHead(cp: Comp, sk: Skel, o: Pose, light: Light): void {
  const [hx, hy] = [rnd(sk.Hc[0]), rnd(sk.Hc[1])];
  const n = o.nod;
  const q = layer();
  q.disc(hx + 0.5, hy + 0.5, 6.2, SKIN.M);
  q.poly([[hx + 2, hy - 3], [hx + 8, hy - 1 + n], [hx + 8, hy + 4 + n], [hx + 4, hy + 7 + n], [hx - 3, hy + 6]], SKIN.M);
  q.rect(hx + 8, hy + n, 2, 3, SKIN.M); // the big nose
  bands(q, SKIN, light, 3, 2);
  q.set(hx + 9, hy + n, SKIN.L);
  // ear
  q.rect(hx - 2, hy, 2, 3, SKIN.S).set(hx - 2, hy + 1, PAL.skin0);
  // eye under the brow
  const ex = hx + 5;
  const ey = hy + n;
  if (o.lid >= 2) q.hline(ex - 1, ex + 1, ey, SKIN.S);
  else {
    q.set(ex, ey, PAL.ink).set(ex + 1, ey, o.lid === 1 ? SKIN.S : PAL.stone4);
    if (o.lid === 1) q.set(ex, ey - 1, SKIN.S);
  }
  // scalp wrinkle
  q.hline(hx - 2, hx + 2, hy - 3, SKIN.S);
  cp.add(q, Part.head, { out: PAL.skin0 });
  // white bushy brow, overhanging forward
  const b = layer();
  b.hline(hx + 2, hx + 7, ey - 2, BEARD.M).hline(hx + 3, hx + 8, ey - 3, BEARD.L);
  b.set(hx + 9, ey - 3, BEARD.M);
  cp.add(b, Part.head, {});
}

function drawBeard(cp: Comp, sk: Skel, o: Pose, light: Light): void {
  const [hx, hy] = [rnd(sk.Hc[0]), rnd(sk.Hc[1]) + o.nod];
  const tip: Pt = [rnd(sk.tip[0]), rnd(sk.tip[1])];
  const k = o.bristle;
  const sp = rnd(k * 3);
  const q = layer();
  q.poly([
    [hx - 4, hy + 3], [hx + 8, hy + 3], [hx + 9 + sp, hy + 8], [hx + 6 + sp, hy + 14],
    [tip[0] + 2, tip[1] - 3], [tip[0], tip[1]], [tip[0] - 2, tip[1] - 4], [hx - 4 - sp, hy + 12], [hx - 5 - sp, hy + 7],
  ], BEARD.M);
  if (k > 0) {
    // bristling: spikes stand out of the mass
    for (let i = 0; i < 5; i++) {
      const a = -0.6 + i * 0.55;
      const cx = hx + 2;
      const cy = hy + 9;
      const r = 9 + sp;
      q.thickLine(cx, cy, cx + Math.cos(a + Math.PI / 2) * r * (i % 2 ? 1 : 0.8), cy + Math.sin(a + Math.PI / 2) * r, 1.6, BEARD.M);
    }
  }
  bands(q, BEARD, light, 2, 2);
  // strands: shade lines combed downward
  for (let y = hy + 7; y <= tip[1]; y++)
    for (let x = hx - 6; x <= hx + 12; x++)
      if (q.isOpaque(x, y) && q.isOpaque(x, y - 1) && (x - hx + 30 + ((y - hy) >> 2)) % 3 === 0) q.set(x, y, BEARD.S);
  // braid tie + braided end under the tip
  const br = layer();
  br.rect(tip[0] - 1, tip[1] + 1, 3, 1, LEATHER.M);
  br.rect(tip[0] - 1, tip[1] + 2, 2, 3, BEARD.M).set(tip[0], tip[1] + 3, BEARD.S).set(tip[0] - 1, tip[1] + 4, BEARD.S);
  cp.add(q, Part.beard, { out: PAL.stone2 });
  cp.add(br, Part.beard, {});
  // moustache over the mouth, mouth open below it on a shout
  const m = layer();
  m.hline(hx + 3, hx + 8, hy + 3, BEARD.L).hline(hx + 2, hx + 9, hy + 4, BEARD.M);
  if (o.mouth) m.rect(hx + 5, hy + 5, 3, 2, PAL.ink).set(hx + 7, hy + 5, PAL.skin0);
  cp.add(m, Part.beard, {});
}

/** The hanging strap end on the shield's back edge (swings). */
function drawStrap(cp: Comp, o: Pose, s: Slab, light: Light): void {
  if (o.fall > 0 || o.aw < 90) return;
  const top = slabAt(s, 40, -1);
  const q = layer();
  const x = rnd(top[0]) - 3;
  const y = rnd(top[1]);
  q.rect(x, y, 2, 2, PAL.gold1);
  q.thickLine(x + 0.5, y + 2, x + 0.5 + o.swing, y + 9, 2, LEATHER.M);
  bands(q, LEATHER, light, 1, 1);
  q.set(x, y, PAL.gold2);
  cp.add(q, Part.strap, { out: PAL.earth0 });
}

/** Four fingers hooked over the top rim (drawn in the slab's own frame, so they ride its tilt): the knuckle hump of
 *  the hand behind the rim, four fingertips curled down over the front of the rim with dark gaps between them. */
function drawFingers(cp: Comp, o: Pose, s: Slab, light: Light): void {
  const q = layer();
  const lifts = [o.f0, o.f1, o.f2, o.f3];
  const tt = topOf(Math.floor(o.fv + 5));
  // the back of the hand behind the rim, a low rounded hump
  q.poly([slabAt(s, tt - 0.5, o.fv - 0.6), slabAt(s, tt + 2.6, o.fv + 0.4), slabAt(s, tt + 3.4, o.fv + 3), slabAt(s, tt + 3.4, o.fv + 7.5), slabAt(s, tt + 2.4, o.fv + 10.2), slabAt(s, tt - 0.5, o.fv + 10.4)], SKIN.M);
  for (let i = 0; i < 4; i++) {
    const v0 = o.fv + i * 2.5;
    const lo = tt - 4.2 + lifts[i] * 2;
    q.poly([slabAt(s, lo, v0 + 0.3), slabAt(s, tt + 0.5, v0), slabAt(s, tt + 0.5, v0 + 2.4), slabAt(s, lo, v0 + 2.1)], SKIN.M);
  }
  bands(q, SKIN, light, 2, 1, { top: 1, bottom: 1 });
  // the gaps between the fingertips and the knuckle line where they bend over the rim
  for (let i = 1; i < 4; i++)
    for (let u = tt - 3.6; u <= tt - 0.4; u += 0.5) {
      const a = slabAt(s, u, o.fv + i * 2.5 + 0.1);
      const x = Math.floor(a[0]);
      const y = Math.floor(a[1]);
      if (q.isOpaque(x, y)) q.set(x, y, SKIN.D);
    }
  for (let v = o.fv; v < o.fv + 10; v += 0.5) {
    const a = slabAt(s, tt + 0.6, v);
    const x = Math.floor(a[0]);
    const y = Math.floor(a[1]);
    if (q.isOpaque(x, y)) q.set(x, y, SKIN.S);
  }
  cp.add(q, Part.fingers, { out: PAL.skin0 });
}

// ---------------------------------------------------------------- frame

export function drawTitan(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  const light = lightOf(lightFrom);
  const cp = new Comp(p);
  const sk = skeleton(o);
  const s = slab(o);
  const buf: ShieldBuf = { reg: new Uint8Array(W * H), u: new Float32Array(W * H), v: new Float32Array(W * H) };

  if (o.show) {
    drawLeg(cp, sk, o, light, false);
    drawArm(cp, sk, o, light, false);
    drawTorso(cp, sk, light);
    drawLeg(cp, sk, o, light, true);
    drawKilt(cp, sk, light);
    drawHead(cp, sk, o, light);
    drawBeard(cp, sk, o, light);
    if (!o.bare) drawStrap(cp, o, s, light);
  }
  if (!o.bare) {
    const shield = drawShield(o, light, buf);
    cp.add(shield, Part.shield, { out: PAL.skin0, outSkip: [Part.none] });
  }
  if (o.show && o.fmode === 0 && !o.bare) drawFingers(cp, o, s, light);
  if (o.show) {
    drawArm(cp, sk, o, light, true);
    if (o.haul) drawHaul(cp, o, s, sk);
  }
  if (o.peek) drawPeek(cp, s, light);
  // clip everything at the ground line (a sunk foot)
  for (let y = GY + 1; y < H; y++) for (let x = 0; x < W; x++) p.erase(x, y);

  p.outline(PAL.ink);

  // ---------------- light pass (never outlined)
  lightPass(p, o, buf, light);
  if (o.glint && !o.bare) {
    const g = slabAt(s, SL - 4, light.side < 0 ? 3 : SW - 3);
    const gx = rnd(g[0] - 0.5);
    const gy = rnd(g[1] - 0.5);
    if (p.isOpaque(gx, gy) && p.get(gx, gy) !== PAL.ink) p.set(gx, gy, PAL.fire4);
  }
  if (o.smear) {
    const a = slabAt(s, SL + 1.5, 0);
    const b = slabAt(s, SL + 1.5, SW);
    for (let i = 1; i <= o.smear; i++) {
      const x = rnd(a[0] + (b[0] - a[0]) * (i / (o.smear + 1)) - 2);
      const y = rnd(a[1] + (b[1] - a[1]) * (i / (o.smear + 1)) - 2);
      if (!p.isOpaque(x, y) && x > 1 && y > 1) p.set(x, y, PAL.stone3);
    }
  }
  if (o.speck) {
    const x = SX0 + SW + 1 + o.speck;
    const y = GY - 3 + o.speck;
    if (x < W - 2 && y <= GY && !p.isOpaque(x, y)) p.set(x, y, PAL.earth2);
  }
  if (o.puff) {
    const n = o.puff;
    for (let i = 0; i < 2 + n * 2; i++) {
      const x = AX - 18 - i * 2 + (i % 2);
      const y = GY - (i % 3 === 0 ? 1 : 0) - (n > 1 && i % 2 ? 1 : 0);
      if (x > 2 && !p.isOpaque(x, y)) p.set(x, y, i % 2 ? PAL.earth2 : PAL.earth3);
    }
  }
}

/** Summon: two taut straps from his fists to the slab's far edge. */
function drawHaul(cp: Comp, o: Pose, s: Slab, sk: Skel): void {
  const q = layer();
  const a = slabAt(s, SL - 1, 3);
  const b = slabAt(s, SL - 1, 12);
  q.thickLine(sk.wN[0] + 1, sk.wN[1], a[0], a[1], 1.6, LEATHER.L);
  q.thickLine(sk.wF[0] + 1, sk.wF[1], b[0], b[1], 1.6, LEATHER.M);
  cp.add(q, Part.strap, {});
  void o;
}

/** Death final: the white beard tip and three fingers out from under the lid's near edge. */
function drawPeek(cp: Comp, s: Slab, light: Light): void {
  const q = layer();
  const near = slabAt(s, 38, 0); // the near edge (the back edge, lying), left part
  const x = rnd(near[0]);
  q.poly([[x - 2, GY - 1], [x + 4, GY - 2], [x + 6, GY], [x - 3, GY]], BEARD.M);
  bands(q, BEARD, light, 2, 1);
  const h = slabAt(s, 14, 0);
  const hx = rnd(h[0]);
  for (let i = 0; i < 3; i++) q.rect(hx + i * 2, GY - 1, 1, 2, i === 0 ? SKIN.L : SKIN.M);
  cp.add(q, Part.fx, {});
}

function lightPass(p: PixelCanvas, o: Pose, buf: ShieldBuf, light: Light): void {
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = buf.reg[i] as Reg;
      if (r === Reg.none || !p.isOpaque(x, y) || p.get(x, y) === PAL.ink) continue;
      const u = buf.u[i];
      const v = buf.v[i];
      const d = Math.hypot(u - BOSS_U, v - BOSS_V);
      if (r === Reg.core && o.boss >= 1) p.set(x, y, o.boss >= 2 && d < 1.3 ? PAL.gold4 : o.boss >= 3 ? PAL.gold4 : PAL.gold3);
      else if (r === Reg.dome && o.boss >= 3) p.set(x, y, PAL.gold3);
      else if ((r === Reg.plate || (r >= Reg.courseHi && r <= Reg.courseLo2 && r - (r >= Reg.courseLo ? Reg.courseLo : Reg.courseHi) >= o.courses)) && o.iris === 0 && o.ripple > 0) {
        if (Math.abs(d - (6.4 + (o.ripple - 1) * 2.2)) < 0.95) p.set(x, y, p.get(x, y) === PAL.fire0 ? PAL.gold0 : PAL.gold1);
      } else if (r === Reg.plate && o.iris > 0) {
        for (let k = 0; k < Math.min(3, Math.floor(o.iris)); k++)
          if (Math.abs(d - (6 + k * 2.2)) < 0.55) p.set(x, y, k === 0 && o.iris >= 3 ? PAL.gold4 : PAL.gold3);
      } else if (r >= Reg.courseHi && r <= Reg.courseHi2) {
        const k = r - Reg.courseHi;
        if (k < o.courses) p.set(x, y, o.hot && k === o.courses - 1 ? PAL.gold4 : PAL.gold3);
      } else if ((r === Reg.rimOuter || r === Reg.rim) && o.zap) {
        const t = Math.floor(u) + Math.floor(v) + o.zap * 2;
        const m = ((t % 5) + 5) % 5;
        if (r === Reg.rimOuter ? m === 0 : m === 2) p.set(x, y, m === 0 ? PAL.gold4 : PAL.gold3);
      }
      void light;
    }
}

/** Points for the anims: the shield's top-front rim corner, the boss, the eye, the hands. */
export function slabPoints(o: Pose): { rim: Pt; boss: Pt; face: Pt } {
  const s = slab(o);
  return { rim: slabAt(s, SL, SW), boss: slabAt(s, BOSS_U, BOSS_V), face: slabAt(s, 28, 11) };
}
