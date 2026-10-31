// Uçurtma Eskrimci v3 — the kite-fencer rig: Pose → skeleton → pixels.
//
// A SLIM FENCER WEARING A KITE AS A CLOAK ("a diamond with a needle"): a small upright figure in fencing stance,
// side-on (front knee bent over the front foot, the rapier arm forward, the rear arm raised behind the head), in an
// unbleached linen suit and a cloth mask with a 2-px ink eye slit and two fire ribbons tied at the back. On his back a
// DIAMOND KITE, bigger than the torso, top point above the head: four cloth panels (top-left / bottom-right gold, top-
// right / bottom-left fire) on two crossed bamboo spars whose tips poke out of the cloth. A long kite string trails from
// the tail point to the floor and lies there as an S. The rapier is the thinnest and brightest line of the sprite.
//
//   - every part is a polygon / ribbon shaded with flat value planes measured from its own edges (lit band toward the
//     key light, shade band away from it): no gradients, no dither; ONE key light from the screen's top-left (`light`
//     'left' for P1, 'right' for the P2 relight sheet; flipped by flipX it is lit from the top-left again). Light only
//     changes tones, never the silhouette;
//   - the kite cloth is "thin": the spar shadow shows through the panel as a darker band beside each spar (MA-4);
//   - the feet are planted (the legs reach them by two-bone IK); in idle only the heels lift, the toes and the floor
//     string's ends never move (HA-9);
//   - light (rapier glint, the indicator panel, the contact star, the cut trail) is painted after the outline and is
//     never outlined (IŞ-9).
// Frame 72×64 (size class 48 + margins: the small class sheet budget); 1 art px = 1 game px. The big world moves of
// both attacks (the fleche, the kite flight and pendulum) are the cinematic's: the poses here draw the body.

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import { ik2, lightOf, type Light } from '../rigkit';
import {
  BELL,
  BELL_RIM,
  BLADE,
  BLADE_UNDER,
  BOW_A,
  BOW_B,
  Comp,
  LINEN,
  LINEN_FAR,
  PANEL_FIRE,
  PANEL_FIRE_HOT,
  PANEL_GOLD,
  PANEL_GOLD_HOT,
  RIBBON,
  SHOE,
  SPAR,
  SPAR_LIT,
  STRING,
  bands,
  layer as kitLayer,
  lerp,
  lerpP,
  path1,
  planes,
  ribbon,
  spline,
  type Pt,
  type Tones,
} from './kite_fencer-kit';

export const W = 72;
export const H = 64;
/** Floor line: the lowest row of the shoes. */
export const GY = 60;
/** Anchor x (between the feet). */
export const AX = 28;
/** Rapier length from the hand to the tip. */
export const BLADE_LEN = 20;
/** The fixed far end of the floor string (it never moves in idle / guard: the feet band stays fixed, HA-9). */
export const STRING_END: Pt = [6, GY];

const DEG = Math.PI / 180;
const rnd = Math.round;
const sin = Math.sin;
const cos = Math.cos;

// ---------------------------------------------------------------- pose

export interface Pose {
  /** pelvis drop (px, + = down: the knees bend, the feet stay), pelvis x shift, whole-body lift off the floor (flight) */
  sink: number;
  rx: number;
  lift: number;
  /** chest offset from the pelvis (px): forward lean, + = down (bend at the waist) */
  lean: number;
  chy: number;
  /** head offset (px) */
  hdx: number;
  hdy: number;
  /** ankles relative to their stance spots (px; negative y = lifted) and heel lift (px, toes stay planted) */
  f1x: number;
  f1y: number;
  f2x: number;
  f2y: number;
  heel1: number;
  heel2: number;
  /** near (rapier) hand relative to the chest (px); rapier angle (deg, 0 = right, − = tip up); blade bow (px, blocked) */
  hx: number;
  hy: number;
  ba: number;
  bow: number;
  /** far hand relative to the chest (px) */
  fx: number;
  fy: number;
  /** kite: spar crossing relative to the chest (or absolute when `kfree`), rotation (deg), open 0…1.2 (folded → billowed width), height scale, billow (px; − = sagging) */
  kx: number;
  ky: number;
  ka: number;
  ko: number;
  kh: number;
  kbl: number;
  /** 0 = on his back, 1 = wrapped in front (guard), 2 = loose (absolute position: summon fall / death flight), 3 = none */
  kmode: number;
  /** lying flat on the floor 0…1 (summon landing): the diamond squashed into an iso diamond */
  kflat: number;
  /** a bump under the lying cloth (px) */
  kbump: number;
  /** string: 0 = slack (S on the floor), 1 = taut to the pin, 2 = snapped, 3 = none, 4 = coiled flat (summon) */
  smode: number;
  /** S phase −1…1 (the floor S flips), vibration (px), taut pin point (frame px) */
  sph: number;
  svib: number;
  pinX: number;
  pinY: number;
  /** mask ribbons: flutter phase 0…1, wind lift (px, + = streams up / back) */
  rph: number;
  rlift: number;
  /** the indicator panel: 0 off, 1 gold3 (dying), 2 lit (gold4 core + fire4 rim), 3 flare */
  lamp: number;
  /** contact star at the rapier tip 0…2, the fleche smear (HA-12: release frame only) */
  star: number;
  smear: number;
  /** curved cut trail (attack 2): sweep length 0…1 and its pivot height above the tip (px) */
  arc: number;
  arcR: number;
  /** hitMagic: panels flash 0…1; 1-px tremble */
  flash: number;
  shiver: number;
  /** body visible 0 = hidden (summon: only the kite), thinning 0…1 (death), sliver stage 0 none / 1 sliver / 2 folding / 3 scrap */
  body: number;
  thin: number;
  sliver: number;
  /** rapier: 0 in hand, 1 loose (at swx, swy, angle swa: falling, or lying on the floor), 3 none */
  sword: number;
  swx: number;
  swy: number;
  swa: number;
  /** tip glint on the blade */
  glint: number;
  /** one-shot phase 0…1 */
  t: number;
}

export const NEUTRAL: Pose = {
  sink: 1,
  rx: 0,
  lift: 0,
  lean: 0,
  chy: 0,
  hdx: 0,
  hdy: 0,
  f1x: 0,
  f1y: 0,
  f2x: 0,
  f2y: 0,
  heel1: 0,
  heel2: 0,
  hx: 10,
  hy: 1,
  ba: -14,
  bow: 0,
  fx: -13,
  fy: -8,
  kx: -10,
  ky: -9,
  ka: -4,
  ko: 1,
  kh: 1,
  kbl: 0,
  kmode: 0,
  kflat: 0,
  kbump: 0,
  smode: 0,
  sph: 0,
  svib: 0,
  pinX: 12,
  pinY: GY,
  rph: 0,
  rlift: 0,
  lamp: 0,
  star: 0,
  smear: 0,
  arc: 0,
  arcR: 10,
  flash: 0,
  shiver: 0,
  body: 1,
  thin: 0,
  sliver: 0,
  sword: 0,
  swx: 0,
  swy: 0,
  swa: 0,
  glint: 1,
  t: 0,
};
export const pose = (o: Partial<Pose>): Pose => ({ ...NEUTRAL, ...o });

// ---------------------------------------------------------------- skeleton

export interface Skel {
  R: Pt;
  H1: Pt;
  H2: Pt;
  K1: Pt;
  K2: Pt;
  A1: Pt;
  A2: Pt;
  C: Pt;
  N: Pt;
  Hd: Pt;
  Sn: Pt;
  Sf: Pt;
  En: Pt;
  Ef: Pt;
  Hn: Pt;
  Hf: Pt;
  dir: Pt;
  tip: Pt;
  /** the kite's corners (top, left, right, bottom) and spar crossing; null when there is no kite */
  kite: KiteGeom | null;
}

export interface KiteGeom {
  T: Pt;
  L: Pt;
  R: Pt;
  B: Pt;
  X: Pt;
  /** panel edge bow (px, outward) */
  bl: number;
}

const P = (v: Pt): Pt => [rnd(v[0]), rnd(v[1])];

/** The one of the two IK solutions whose joint is farther toward (px, py). */
function pick(a: Pt, b: Pt, l1: number, l2: number, px: number, py: number): Pt {
  const j1 = ik2(a, b, l1, l2, 1);
  const j2 = ik2(a, b, l1, l2, -1);
  return j1[0] * px + j1[1] * py >= j2[0] * px + j2[1] * py ? j1 : j2;
}

/** Kite corners for a crossing point X, rotation, open / height scale (unrotated: top 13 up, sides 10, tail 19 down). */
export function kiteGeom(X: Pt, ka: number, ko: number, kh: number, kbl: number, flat = 0): KiteGeom {
  const c = cos(ka * DEG);
  const s = sin(ka * DEG);
  const sq = 1 - flat * 0.5;
  const tf = (x: number, y: number): Pt => {
    // lying flat: the spine turns toward the screen's x (an iso diamond on the tile), the height squashes
    const a = flat > 0 ? lerp(ka, -90, flat) * DEG : ka * DEG;
    const cc = flat > 0 ? cos(a) : c;
    const ss = flat > 0 ? sin(a) : s;
    const rx = x * cc - y * ss;
    const ry = (x * ss + y * cc) * sq;
    return P([X[0] + rx, X[1] + ry]);
  };
  return { T: tf(0, -13 * kh), L: tf(-11 * ko, 0), R: tf(11 * ko, 0), B: tf(0, 19 * kh), X: P(X), bl: kbl };
}

export function skeleton(o: Pose): Skel {
  const sy = o.shiver ? (o.shiver > 0 ? 1 : -1) : 0;
  const R: Pt = [AX + o.rx + (o.shiver ? o.shiver : 0), GY - 18 + o.sink - o.lift];
  const H1: Pt = [R[0] + 2, R[1] + 1];
  const H2: Pt = [R[0] - 2, R[1] + 1];
  const A1: Pt = [AX + 8 + o.f1x, GY - 2 + o.f1y - o.lift - o.heel1];
  const A2: Pt = [AX - 9 + o.f2x, GY - 2 + o.f2y - o.lift - o.heel2];
  const k1 = pick(H1, A1, 9, 9, 1, -0.2);
  const k2 = pick(H2, A2, 9, 9, 1, -0.1);
  const K1: Pt = [k1[0], Math.min(k1[1], GY - 5)];
  const K2: Pt = [k2[0], Math.min(k2[1], GY - 5)];
  const C: Pt = [R[0] + 1 + o.lean, R[1] - 11 + o.chy];
  const N: Pt = [C[0] + 1, C[1] - 6];
  const Hd: Pt = [N[0] + 1 + o.hdx, N[1] - 4 + o.hdy];
  const Sn: Pt = [C[0] + 1, C[1] - 4];
  const Sf: Pt = [C[0] - 2, C[1] - 5];
  const Hn: Pt = [C[0] + o.hx, C[1] + o.hy];
  const Hf: Pt = [C[0] + o.fx, C[1] + o.fy];
  const En = pick(Sn, Hn, 5.5, 5.5, 0.2, 1);
  const Ef = pick(Sf, Hf, 5.5, 5.5, -1, 0.4);
  const dir: Pt = [cos(o.ba * DEG), sin(o.ba * DEG)];
  const tip: Pt = [Hn[0] + dir[0] * BLADE_LEN, Hn[1] + dir[1] * BLADE_LEN];
  let kite: KiteGeom | null = null;
  if (o.kmode !== 3) {
    const X: Pt = o.kmode === 2 ? [o.kx, o.ky] : [C[0] + o.kx, C[1] + o.ky];
    kite = kiteGeom(X, o.ka, o.ko, o.kh, o.kbl, o.kflat);
  }
  void sy;
  const r = P;
  return { R: r(R), H1: r(H1), H2: r(H2), K1: r(K1), K2: r(K2), A1: r(A1), A2: r(A2), C: r(C), N: r(N), Hd: r(Hd), Sn: r(Sn), Sf: r(Sf), En: r(En), Ef: r(Ef), Hn: r(Hn), Hf: r(Hf), dir, tip: r(tip), kite };
}

/** Centre of the indicator panel (the upper LEADING panel: top-right in P1's sprite). */
export function panelCentre(k: KiteGeom): Pt {
  const bx = (k.T[0] + k.R[0] + k.X[0]) / 3;
  const by = (k.T[1] + k.R[1] + k.X[1]) / 3;
  return [rnd(bx), rnd(by)];
}

// ---------------------------------------------------------------- frame helpers

const enum Part {
  none = 0,
  string,
  kite,
  armF,
  ribbons,
  legF,
  legN,
  torso,
  head,
  armN,
  sword,
  scrap,
}

interface Frame {
  p: PixelCanvas;
  comp: Comp;
  light: Light;
  o: Pose;
  sk: Skel;
}

const layer = () => kitLayer(W, H);

/** A tapered limb segment a → b with flat planes. */
function limb(f: Frame, a: Pt, b: Pt, w0: number, w1: number, t: Tones, part: Part, sep?: number): void {
  const q = layer();
  q.poly(ribbon([a, b], (k) => lerp(w0, w1, k)), t.M);
  q.disc(a[0], a[1], w0 / 2 - 0.1, t.M);
  q.disc(b[0], b[1], w1 / 2 - 0.1, t.M);
  bands(q, t, f.light, 1, 1);
  f.comp.add(q, part, { out: sep });
}

// ---------------------------------------------------------------- string

function paintString(f: Frame): void {
  const { o, sk } = f;
  const k = sk.kite;
  if (o.smode === 3 || !k || o.kmode === 2) {
    if (o.smode === 4) coiled(f);
    return;
  }
  const B = k.B;
  const q = layer();
  if (o.smode === 0) {
    // slack: hangs from the tail, touches the floor behind the rear heel, lies as an S to its fixed far end
    const Fx = Math.min(B[0] - 3, AX - 9);
    const E = STRING_END;
    const a = o.sph;
    const pts: Pt[] = spline(
      [
        B,
        [B[0] - 1 + a * 0.6, lerp(B[1], GY, 0.45)],
        [Fx, GY - 1],
        [lerp(Fx, E[0], 0.3), GY - 1 - a],
        [lerp(Fx, E[0], 0.62), GY - 1 + a],
        [E[0] + 1, GY - 1],
        E,
      ],
      5,
    ).map(([x, y]) => [x, Math.min(GY, y)] as Pt);
    path1(q, pts, STRING);
    // two tail bows on the hanging part
    const b1 = pts[Math.round(pts.length * 0.1)];
    const b2 = pts[Math.round(pts.length * 0.2)];
    bowTie(q, b1, BOW_A);
    bowTie(q, b2, BOW_B);
  } else if (o.smode === 1) {
    // taut: one straight bright line to the pin, vibrating 1 px at its middle
    const M: Pt = [rnd((B[0] + o.pinX) / 2), rnd((B[1] + o.pinY) / 2 + o.svib)];
    path1(q, [B, M, [o.pinX, o.pinY]], STRING);
    bowTie(q, lerpP(B, M, 0.45), BOW_A);
  } else if (o.smode === 2) {
    // snapped at the middle: both ends whip back as curling 1-px lines
    const M: Pt = [(B[0] + o.pinX) / 2, (B[1] + o.pinY) / 2];
    const u = o.svib || 1;
    const up = spline([B, lerpP(B, M, 0.4), [lerp(B[0], M[0], 0.55) - 2 * u, lerp(B[1], M[1], 0.55) - 3 * u], [lerp(B[0], M[0], 0.4) - 3 * u, lerp(B[1], M[1], 0.4) - 4 * u]], 4);
    const dn = spline([[o.pinX, o.pinY], lerpP([o.pinX, o.pinY], M, 0.45), [lerp(o.pinX, M[0], 0.6) + 2 * u, lerp(o.pinY, M[1], 0.6) - 3 * u], [lerp(o.pinX, M[0], 0.45) + 3 * u, lerp(o.pinY, M[1], 0.45) - 5 * u]], 4);
    path1(q, up, STRING);
    path1(q, dn, STRING);
  }
  f.comp.add(q, Part.string);
}

function coiled(f: Frame): void {
  // summon: the string lies coiled beside the flat kite (a small loop + a tail)
  const q = layer();
  const c: Pt = [AX - 13, GY - 2];
  path1(q, spline([[c[0] + 6, GY - 3], [c[0] + 2, GY - 4], [c[0] - 2, GY - 3], [c[0] - 2, GY - 1], [c[0] + 2, GY], [c[0] + 4, GY - 1], [c[0] + 1, GY - 2], STRING_END], 4), STRING);
  f.comp.add(q, Part.string);
}

function bowTie(q: PixelCanvas, at: Pt, c: number): void {
  const x = rnd(at[0]);
  const y = rnd(at[1]);
  q.set(x - 1, y, c);
  q.set(x + 1, y, c);
  q.set(x, y, c);
}

// ---------------------------------------------------------------- kite cloak

/** Paint the kite (cloth panels, spars, spar shadows) on a frame-sized layer. Used by the rig and the loose-kite maps. */
export function paintKite(q: PixelCanvas, k: KiteGeom, light: Light, o: { flash?: number; lowShade?: boolean; bump?: number } = {}): void {
  const { T, L, R, B, X, bl } = k;
  const hot = (o.flash ?? 0) > 0.5;
  // The gold pair always sits toward the key light: on the P2 relight sheet (lit from the frame's right, then
  // flipped) the pairs swap, so on screen both players' kites read gold top-left / fire top-right (IŞ-1, IŞ-2).
  const g0 = hot ? PANEL_GOLD_HOT : PANEL_GOLD;
  const f0 = hot ? PANEL_FIRE_HOT : PANEL_FIRE;
  const gold = light.side < 0 ? g0 : f0;
  const fire = light.side < 0 ? f0 : g0;
  const bowOut = (a: Pt, b: Pt): Pt => {
    // outward = away from the crossing
    const m: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = m[0] - X[0];
    const dy = m[1] - X[1];
    const l = Math.hypot(dx, dy) || 1;
    return [m[0] + (dx / l) * bl, m[1] + (dy / l) * bl];
  };
  const panel = (pts: Pt[], t: Tones, low: boolean) => {
    const s = kitLayer(q.w, q.h);
    s.poly(pts, t.M);
    // upper panels: mostly the main tone with a shade band away from the light; lower panels hang in more shadow
    const tt: Tones = low ? { L: t.M, M: t.S, S: t.D, D: t.D } : t;
    bands(s, tt, light, low ? 1 : 2, low ? 2 : 3, { top: low ? 0 : 1, bottom: 1 });
    q.blit(s, 0, 0);
    s.clear();
  };
  panel([X, L, bowOut(L, T), T], gold, false);
  panel([X, T, bowOut(T, R), R], fire, false);
  panel([X, R, bowOut(R, B), B], gold, true);
  panel([X, B, bowOut(B, L), L], fire, true);
  // the spar shadow seen through the thin cloth: a deep band beside the spine and under the cross spar (MA-4)
  const ls = light.side;
  const deep = (x: number, y: number) => {
    const c = q.get(x, y);
    if (c === null) return;
    const d = c === gold.M || c === gold.S || c === gold.L ? gold.D : c === fire.M || c === fire.S || c === fire.L ? fire.D : null;
    if (d !== null) q.set(x, y, d);
  };
  const along = (a: Pt, b: Pt, fn: (x: number, y: number) => void) => {
    const n = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
    for (let i = 0; i <= n; i++) fn(rnd(lerp(a[0], b[0], i / n)), rnd(lerp(a[1], b[1], i / n)));
  };
  along(T, B, (x, y) => deep(x - ls, y));
  along(L, R, (x, y) => deep(x, y + 1));
  // spars: bamboo, the spine lit toward the light; tips poke 1 px out of the cloth
  const ext = (a: Pt, b: Pt): Pt => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    return [rnd(b[0] + dx / l), rnd(b[1] + dy / l)];
  };
  const T2 = ext(X, T);
  const L2 = ext(X, L);
  const R2 = ext(X, R);
  along(T2, B, (x, y) => q.set(x, y, SPAR_LIT));
  // the cross spar bows backward with the wind (1 px at its middle when the cloth is billowed)
  const bowY = bl > 1 ? 1 : 0;
  const mL: Pt = [rnd((L2[0] + X[0]) / 2), rnd((L2[1] + X[1]) / 2) - bowY];
  const mR: Pt = [rnd((R2[0] + X[0]) / 2), rnd((R2[1] + X[1]) / 2) - bowY];
  along(L2, mL, (x, y) => q.set(x, y, SPAR));
  along(mL, X, (x, y) => q.set(x, y, SPAR));
  along(X, mR, (x, y) => q.set(x, y, SPAR));
  along(mR, R2, (x, y) => q.set(x, y, SPAR));
  q.set(X[0], X[1], SPAR_LIT);
  if (o.bump) {
    // something rising under the lying cloth: a lit dome in the middle
    const s = kitLayer(q.w, q.h);
    s.ellipse(X[0] + 1, X[1] - o.bump / 2, 5, Math.max(1, o.bump / 2 + 1), gold.M);
    bands(s, gold, light, 2, 2);
    q.blit(s, 0, 0);
    s.clear();
  }
}

function paintKitePart(f: Frame): void {
  const { o, sk } = f;
  const k = sk.kite;
  if (!k) return;
  const q = layer();
  paintKite(q, k, f.light, { flash: o.flash, bump: o.kbump });
  // the tie at the neck (the kite sits on his shoulders): a fire knot under the head
  if (o.kmode === 0 && o.body) {
    const n = sk.N;
    q.rect(n[0] - 2, n[1], 2, 2, RIBBON.S);
  }
  f.comp.add(q, Part.kite);
}

// ---------------------------------------------------------------- body

function paintRibbons(f: Frame): void {
  const { o, sk } = f;
  // two short fire tails from the knot at the nape, hanging back over the shoulder; they flutter (period 4)
  const knot: Pt = [sk.Hd[0] - 3, sk.Hd[1] - 1];
  const strand = (len: number, ph: number, ang: number, c: number) => {
    const pts: Pt[] = [];
    for (let i = 0; i <= 3; i++) {
      const u = i / 3;
      const w = sin((o.rph + ph - u * 0.5) * Math.PI * 2) * 1.2 * u;
      const a = (ang - o.rlift * 9) * DEG;
      pts.push([knot[0] - cos(a) * len * u + w * sin(a), knot[1] + sin(a) * len * u + w * cos(a)]);
    }
    const q = layer();
    q.poly(ribbon(spline(pts, 3), (u) => lerp(2.2, 1.6, u)), c);
    f.comp.add(q, Part.ribbons, { out: PAL.fire1 });
  };
  strand(6, 0.35, 62, RIBBON.S);
  strand(6, 0, 38, RIBBON.M);
}

function paintArmF(f: Frame): void {
  const { sk } = f;
  limb(f, sk.Sf, sk.Ef, 3, 2.6, LINEN_FAR, Part.armF, PAL.earth1);
  limb(f, sk.Ef, sk.Hf, 2.6, 2.2, LINEN_FAR, Part.armF, PAL.earth1);
  const q = layer();
  q.disc(sk.Hf[0], sk.Hf[1], 1.2, SHOE.L);
  f.comp.add(q, Part.armF, { out: PAL.earth1 });
}

function shoe(f: Frame, A: Pt, heel: number, far: boolean): void {
  const t = far ? { L: SHOE.M, M: SHOE.M, S: SHOE.S, D: SHOE.D } : SHOE;
  const q = layer();
  const x = A[0];
  const y = A[1] + heel; // the toe row stays on the floor; the heel lifts with the ankle
  const toeY = y + 2 - heel;
  const floorY = Math.min(GY, A[1] + 2 + heel);
  // a soft fencing shoe pointing right: heel (back), instep, toe
  q.poly(
    [
      [x - 2, A[1] - 1],
      [x + 1, A[1] - 1],
      [x + 4, floorY - 1],
      [x + 4, floorY],
      [x, floorY],
      [x - 2, Math.min(floorY, toeY - 0 + (heel ? -heel + 1 : 0))],
    ],
    t.M,
  );
  bands(q, t, f.light, 1, 1);
  f.comp.add(q, far ? Part.legF : Part.legN, { out: far ? undefined : LINEN_FAR.S });
}

function paintLegs(f: Frame): void {
  const { sk, o } = f;
  const leg = (H: Pt, K: Pt, A: Pt, heel: number, far: boolean) => {
    const t = far ? LINEN_FAR : LINEN;
    const part = far ? Part.legF : Part.legN;
    limb(f, H, K, 4, 3.2, t, part, far ? undefined : LINEN.D);
    limb(f, K, A, 3.2, 2.4, far ? STOCK_FAR : STOCK, part, far ? undefined : LINEN.S);
    shoe(f, A, heel, far);
  };
  leg(sk.H2, sk.K2, sk.A2, o.heel2, true);
  leg(sk.H1, sk.K1, sk.A1, o.heel1, false);
}

/** The long fencing stockings below the breeches: a lighter linen. */
const STOCK: Tones = { L: PAL.earth4, M: PAL.earth4, S: PAL.earth3, D: PAL.earth2 };
const STOCK_FAR: Tones = { L: PAL.earth3, M: PAL.earth3, S: PAL.earth2, D: PAL.earth1 };

function torsoPoly(sk: Skel): Pt[] {
  const { R, C, N, Sn, Sf } = sk;
  return [
    [R[0] - 4, R[1] + 2],
    [R[0] + 3, R[1] + 2],
    [lerp(R[0], C[0], 0.5) + 3, lerp(R[1], C[1], 0.5)],
    [C[0] + 4, C[1] - 1],
    [Sn[0] + 2, Sn[1]],
    [N[0] + 1, N[1] + 1],
    [N[0] - 1, N[1] + 1],
    [Sf[0] - 1, Sf[1] + 1],
    [C[0] - 4, C[1] + 1],
    [lerp(R[0], C[0], 0.5) - 3, lerp(R[1], C[1], 0.5)],
  ];
}

function paintTorso(f: Frame): void {
  const { sk, o } = f;
  if (o.smear) {
    // HA-12: a 2-px smear behind the dashing body, matter (outlined with the body)
    const s = layer();
    s.poly(torsoPoly(sk).map(([x, y]) => [x - 2, y] as Pt), LINEN.S);
    f.comp.add(s, Part.torso);
  }
  const q = layer();
  q.poly(torsoPoly(sk), LINEN.M);
  bands(q, LINEN, f.light, 2, 2, { top: 1, bottom: 1 });
  // the fencing jacket's diagonal closure (front, from the collar to the hip) and the belt crease
  const { R, C, N } = sk;
  const a: Pt = [N[0] + 1, N[1] + 2];
  const b: Pt = [C[0] + 3, C[1] + 3];
  const n = Math.max(1, Math.abs(b[1] - a[1]));
  for (let i = 0; i <= n; i++) {
    const x = rnd(lerp(a[0], b[0], i / n));
    const y = rnd(lerp(a[1], b[1], i / n));
    if (q.isOpaque(x, y) && q.isOpaque(x + 1, y)) q.set(x, y, LINEN.S);
  }
  // a fire sash at the waist (the kite's colour on the body), knotted at the back with two short tails
  const by = R[1] - 2;
  for (let x = R[0] - 5; x <= R[0] + 5; x++)
    for (const dy of [0, 1])
      if (q.isOpaque(x, by + dy) && (q.isOpaque(x, by + dy - 1) || q.isOpaque(x, by + dy + 1))) q.set(x, by + dy, dy === 0 ? RIBBON.M : RIBBON.S);
  f.comp.add(q, Part.torso, { out: LINEN_FAR.S });
  const tail = layer();
  const kx = R[0] - 5;
  const sw = rnd(sin(o.rph * Math.PI * 2) * 0.8);
  tail.rect(kx - 1, by, 2, 2, RIBBON.S);
  tail.line(kx - 1, by + 2, kx - 2 + sw, by + 4, RIBBON.D);
  tail.line(kx, by + 2, kx - 1 - o.rlift, by + 5, RIBBON.S);
  f.comp.add(tail, Part.torso);
}

function paintHead(f: Frame): void {
  const { sk } = f;
  const [x, y] = sk.Hd;
  const q = layer();
  // cloth mask: a rounded hood, a little longer at the chin (front), tied at the back
  q.ellipse(x, y, 3.6, 4, LINEN.M);
  q.poly([[x + 1, y + 1], [x + 4, y], [x + 4, y + 3], [x + 2, y + 5], [x - 1, y + 5]], LINEN.M);
  q.rect(x - 1, y + 4, 3, 3, LINEN.M); // neck under the mask
  bands(q, LINEN, f.light, 2, 2, { top: 1, bottom: 1 });
  // the mask's tie: a fire band round the head at the brow, knotted at the back (the ribbons hang from the knot)
  for (let dx = -4; dx <= 4; dx++) if (q.isOpaque(x + dx, y - 2)) q.set(x + dx, y - 2, dx < 0 ? RIBBON.S : RIBBON.M);
  // the eye slit: 2 px ink at the front, under the band (the mask's only dark)
  q.set(x + 1, y, PAL.ink);
  q.set(x + 2, y, PAL.ink);
  // a seam down the face (the mask's front panel)
  q.set(x + 3, y + 2, LINEN.S);
  q.set(x + 2, y + 3, LINEN.S);
  f.comp.add(q, Part.head, { out: LINEN_FAR.S });
}

function paintArmN(f: Frame): void {
  const { sk } = f;
  limb(f, sk.Sn, sk.En, 3, 2.6, LINEN, Part.armN, LINEN.S);
  limb(f, sk.En, sk.Hn, 2.6, 2.2, LINEN, Part.armN);
  // the fencing glove's flared cuff
  limb(f, lerpP(sk.En, sk.Hn, 0.55), lerpP(sk.En, sk.Hn, 0.85), 3.4, 2.6, SHOE, Part.armN, LINEN.S);
}

/** The rapier from the hand (or loose): grip, bell guard, blade (stone4 + mist underside, tapering to 1 px). */
function rapier(q: PixelCanvas, hand: Pt, dir: Pt, bow: number): Pt {
  const nrm: Pt = [-dir[1], dir[0]];
  const at = (d: number, b = 0): Pt => [rnd(hand[0] + dir[0] * d + nrm[0] * b), rnd(hand[1] + dir[1] * d + nrm[1] * b)];
  const s0 = at(2);
  const tip = at(BLADE_LEN);
  const mid = at(BLADE_LEN * 0.55, bow);
  // the underside: a mist line one px under (or beside, when the blade stands near vertical) the first 13 px
  const vert = Math.abs(dir[1]) > 0.7;
  const ox = vert ? 1 : 0;
  const oy = vert ? 0 : 1;
  const u1 = bow ? lerpP(s0, mid, 0.9) : at(14);
  q.line(s0[0] + ox, s0[1] + oy, rnd(u1[0]) + ox, rnd(u1[1]) + oy, BLADE_UNDER);
  // the blade: straight 1-px stone4 lines (bowed through the middle point when blocked)
  if (bow) {
    q.line(s0[0], s0[1], mid[0], mid[1], BLADE);
    q.line(mid[0], mid[1], tip[0], tip[1], BLADE);
  } else q.line(s0[0], s0[1], tip[0], tip[1], BLADE);
  // bell guard (a cup) + gold rim, the pommel behind the hand
  const g: Pt = at(1.5);
  q.rect(g[0] - 1, g[1] - 1, 2, 3, BELL);
  const rx = dir[0] >= 0 ? 1 : -1;
  q.set(g[0] + rx, g[1] - 1, BELL_RIM);
  q.set(g[0] + rx, g[1], BELL_RIM);
  q.set(g[0] + rx, g[1] + 1, BELL_RIM);
  const pm = at(-2);
  q.set(pm[0], pm[1], BELL_RIM);
  return tip;
}

function paintSword(f: Frame): void {
  const { o, sk } = f;
  if (o.sword === 0) {
    const q = layer();
    rapier(q, sk.Hn, sk.dir, o.bow);
    // the glove over the grip
    q.disc(sk.Hn[0], sk.Hn[1], 1.2, SHOE.L);
    q.set(sk.Hn[0], sk.Hn[1], SHOE.M);
    f.comp.add(q, Part.sword);
  } else {
    const q = layer();
    const d: Pt = [cos(o.swa * DEG), sin(o.swa * DEG)];
    rapier(q, [o.swx, o.swy], d, 0);
    f.comp.add(q, Part.sword);
  }
}

// ---------------------------------------------------------------- death: thinning, sliver, scrap

/** Squash the body layer toward its centre column (the cloth that lost its frame). */
function squash(src: PixelCanvas, dst: PixelCanvas, cx: number, s: number): void {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++) {
      const sx = rnd(cx + (x - cx) / s);
      if (sx < 0 || sx >= src.w) continue;
      const c = src.get(sx, y);
      if (c !== null) dst.set(x, y, c);
    }
}

function paintSliver(f: Frame): void {
  const { o } = f;
  const q = layer();
  const x = AX + o.rx;
  const rib = layer();
  if (o.sliver === 1) {
    // cloth that lost its frame: a narrow wavy linen strip standing on the floor, the mask a limp knob on top
    q.poly([[x - 1, 33], [x + 2, 34], [x + 1, 40], [x + 2, 46], [x + 3, 52], [x + 2, GY], [x - 2, GY], [x - 1, 52], [x - 2, 46], [x - 1, 40]], LINEN.M);
    q.ellipse(x, 31, 2.2, 2.6, LINEN.M);
    rib.rect(x - 3, 31, 2, 5, RIBBON.S);
  } else if (o.sliver === 2) {
    // folding at the middle: the top half droops forward over itself
    q.poly([[x - 2, 47], [x, 44], [x + 4, 43], [x + 7, 46], [x + 8, 51], [x + 6, 52], [x + 5, 48], [x + 2, 47], [x + 2, GY], [x - 2, GY]], LINEN.M);
    q.ellipse(x + 7, 52, 2, 2, LINEN.M);
    rib.rect(x + 9, 52, 1, 4, RIBBON.S);
  } else if (o.sliver === 3) {
    // the limp linen scrap on the floor (about 6×4) with a fold, one ribbon tail
    q.poly([[x - 3, GY - 2], [x, GY - 4], [x + 3, GY - 3], [x + 4, GY], [x - 3, GY]], LINEN.M);
    rib.rect(x + 4, GY - 1, 3, 1, RIBBON.S);
  }
  bands(q, LINEN, f.light, 1, 1);
  if (o.sliver === 3) q.set(x, GY - 2, LINEN.S);
  f.comp.add(q, Part.scrap);
  f.comp.add(rib, Part.scrap);
}

// ---------------------------------------------------------------- light

function paintLight(f: Frame): void {
  const { p, o, sk } = f;
  const k = sk.kite;
  if (o.lamp > 0 && k && o.kmode !== 2) {
    const [cx, cy] = panelCentre(k);
    if (o.lamp === 1) {
      p.rect(cx - 1, cy - 1, 3, 3, PAL.gold3);
    } else {
      // emissive gold4 core 3×3 with a 1-px fire4 rim (corners left out: a soft diamond)
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const a = Math.abs(dx) + Math.abs(dy);
          if (Math.abs(dx) === 2 && Math.abs(dy) === 2) continue;
          if (a > 3) continue;
          const core = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
          p.set(cx + dx, cy + dy, core ? PAL.gold4 : PAL.fire4);
        }
      if (o.lamp >= 3) {
        p.set(cx, cy, PAL.white);
        p.set(cx, cy - 3, PAL.gold4);
        p.set(cx + 3, cy, PAL.gold4);
        p.set(cx - 3, cy, PAL.gold4);
        p.set(cx, cy + 3, PAL.gold4);
      }
    }
  }
  if (o.body && o.sword === 0 && o.glint) {
    // the one white glint: on the blade's lit top edge, 4 px from the tip
    const g: Pt = [rnd(sk.tip[0] - sk.dir[0] * 4), rnd(sk.tip[1] - sk.dir[1] * 4)];
    if (p.isOpaque(g[0], g[1])) p.set(g[0], g[1], PAL.white);
  }
  if (o.smode === 2 && sk.kite && o.kmode === 0) {
    // the snap: a 1-frame bright spark where the string broke
    const B = sk.kite.B;
    const mx = rnd((B[0] + o.pinX) / 2);
    const my = rnd((B[1] + o.pinY) / 2);
    p.set(mx, my, PAL.white);
    p.set(mx - 1, my - 1, PAL.gold4);
    p.set(mx + 1, my + 1, PAL.gold4);
    p.set(mx + 1, my - 1, PAL.gold4);
    p.set(mx - 1, my + 1, PAL.gold4);
  }
  if (o.star > 0) {
    const [x, y] = sk.tip;
    p.set(x, y, PAL.white);
    p.set(x - 1, y, PAL.white);
    p.set(x + 1, y, PAL.white);
    p.set(x, y - 1, PAL.white);
    p.set(x, y + 1, PAL.white);
    if (o.star >= 1) {
      p.set(x + 2, y - 2, PAL.gold4);
      p.set(x + 3, y - 3, PAL.gold4);
      p.set(x + 2, y + 2, PAL.mist);
    }
    if (o.star >= 2) {
      p.set(x + 2, y, PAL.white);
      p.set(x, y - 2, PAL.white);
    }
  }
  if (o.arc > 0) {
    // the curved cut trail: a thin "smile" under the blade (the pendulum's sweep) from the tip back toward the hand,
    // white on the inner edge near the tip, mist / steel farther back; it grows with the swing (arc 0…1)
    const T0: Pt = [sk.tip[0] + 1, sk.tip[1] + 1];
    const H0: Pt = [sk.Hn[0] - 3, sk.Hn[1] - 2];
    const sag = 5 + o.arcR * 0.1;
    const n = 24;
    const seen = new Set<string>();
    for (let i = 0; i <= n * o.arc; i++) {
      const u = i / n;
      const x0 = lerp(T0[0], H0[0], u);
      const y0 = lerp(T0[1], H0[1], u) + sin(u * Math.PI) * sag;
      const thick = u > 0.15 && u < 0.7 ? 2 : 1;
      for (let r = 0; r < thick; r++) {
        const x = rnd(x0);
        const y = rnd(y0) + r;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
        if (p.isOpaque(x, y) && p.get(x, y) !== PAL.ink) continue;
        p.set(x, y, r === 0 ? (u < 0.45 ? PAL.white : u < 0.75 ? PAL.mist : PAL.steel) : u < 0.4 ? PAL.mist : PAL.steel);
      }
    }
  }
}

// ---------------------------------------------------------------- frame

export function drawFencer(p: PixelCanvas, o: Pose, lightFrom: 'left' | 'right' = 'left'): void {
  const light = lightOf(lightFrom);
  const sk = skeleton(o);
  const f: Frame = { p, comp: new Comp(p), light, o, sk };
  paintString(f);
  if (o.kmode === 0 || o.kmode === 2) paintKitePart(f);
  if (o.body) {
    if (o.thin > 0) {
      // the whole body painted aside, then squashed toward its centre column and laid over the frame
      const tmp = new PixelCanvas(W, H);
      const g: Frame = { p: tmp, comp: new Comp(tmp), light, o, sk };
      paintArmF(g);
      paintRibbons(g);
      paintLegs(g);
      paintTorso(g);
      paintHead(g);
      paintArmN(g);
      const q = layer();
      squash(tmp, q, sk.R[0], 1 - o.thin);
      f.comp.add(q, Part.torso, { out: LINEN_FAR.S });
    } else {
      paintArmF(f);
      paintRibbons(f);
      paintLegs(f);
      paintTorso(f);
      paintHead(f);
      paintArmN(f);
    }
  }
  if (o.sliver) paintSliver(f);
  if (o.sword === 1 || (o.sword === 0 && o.body && o.thin === 0)) paintSword(f);
  if (o.kmode === 1) paintKitePart(f);
  p.outline(PAL.ink);
  paintLight(f);
}

// ---------------------------------------------------------------- the loose kite (for the cinematics)

/**
 * The empty kite as a free object (summon: the leaf-drift fall; death: the cloak flying off screen): drawn centred
 * on (cx, cy) of a canvas, tilted by `tilt` deg, `open` 0…1.2, billow px; outlined. The cinematic builds its tilt maps
 * from this (whole-pixel rotation of the polygon, re-rasterised, never a rotated sprite).
 */
export function drawLooseKite(p: PixelCanvas, cx: number, cy: number, tilt: number, open = 1, billow = 1, lightFrom: 'left' | 'right' = 'left', withString = true): void {
  const light = lightOf(lightFrom);
  const k = kiteGeom([cx, cy], tilt, open, 1, billow);
  const q = new PixelCanvas(p.w, p.h);
  if (withString) {
    // the trailing string: a short curl hanging from the tail
    const B = k.B;
    path1(q, spline([B, [B[0] - 1, B[1] + 4], [B[0] + 1, B[1] + 8], [B[0] - 1, B[1] + 11]], 4), STRING);
  }
  paintKite(q, k, light);
  p.blit(q, 0, 0);
  p.outline(PAL.ink);
}

void planes;
