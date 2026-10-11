// Kristal Ejder HD — the dragon, built from volumes on the render library (src/hd/render).
//
// 192×192, faces right, anchor = ground under the claws. Same creature and composition as the
// shipped 96×96 sprite (upright dragon, near wing raised to the upper left, far wing above the
// back, S-neck to the head on the upper right, tail curling down-left to a crystal blade), at
// ~1.8× its scale, built from real volumes:
//
//   hide      cut-crystal body: tubes with flat longitudinal facets (+ a little smooth shading)
//             and crystal edge light, low-poly Voronoi plates on haunch / thighs / shoulders,
//             pale ventral plates with exact 1-tone seams (plates.ts), ice-cyan refraction along
//             the shadow-side silhouette, white glints on facets that turn into the light
//   head      a low-poly faceted skull + lower jaw (facet3 planes in head space), glowing almond
//             eye with a light trail, faceted gold horns, fangs, a mouth (throat → crimson gums)
//             that fills with prism light during the attack
//   wings     translucent crystal panes (each panel pleated into lit / shaded facets) between hide
//             finger bones, leaded-glass veins (white rib + dark edge, emissive), a bright
//             trailing-edge rim, crystal spurs; the body reads through the glass
//   crystal   spikes along spine, neck and tail (cores glow with energy), crystal claws, blade
//   light     overlays after the outline: wing twinkles, charge motes, mouth light leak,
//             muzzle flare, impact smear (never outlined, tagged emissive for bloom)

import { PAL } from '../../../art/palette';
import {
  DEG,
  HDRenderer,
  KEY_LIGHT as KEY,
  type HDRenderResult,
  type OverlayCtx,
  type Part,
  TAU,
  type V2,
  type V3,
  add,
  bezier,
  catmull,
  clamp,
  hash3,
  ik2,
  lerp,
  lerpV,
  madd,
  mul,
  norm,
  norm3,
  pathLengths,
  perp,
  polar,
  rotV,
  samplePath,
  sub,
  type DetailCtx,
  fillPoly,
} from '../../render';
import { BELLY, CRYS, HIDE_EDGE, HIDE_EDGE_FAR, CRYS_FAR, ENERGY, GLASS, GLASS_FAR, GOLD, GOLD_FAR, HIDE, HIDE_FAR, MOUTH } from './materials';
import { applyMarks, newMarks, plateEllipsoid, plateTube, type PlateTubeOpts } from './plates';
import { IMPACT, type WyrmPose, framePose } from './pose';

export const W = 192;
export const H = 192;
/** Ground contact under the claws, centered under the body mass. */
export const ANCHOR: V2 = [100, 184];

const r = new HDRenderer(W, H);

// ------------------------------------------------------------------ rig

export interface BodyRig {
  hip: V2;
  chest: V2;
  /** Unit torso axis hip → chest, and its dorsal (up-back) normal. */
  axis: V2;
  dorsal: V2;
  /** Point in the chest frame (rotates with the lean). */
  att: (o: V2) => V2;
  /** Head pivot (back of the skull). */
  head: V2;
}

export function bodyRig(P: WyrmPose): BodyRig {
  const hip: V2 = [86 + P.hx, 137 + P.hy];
  const axis = polar(-56 + P.lean, 1);
  const chest = madd(hip, axis, 33);
  const L = P.lean * DEG;
  const att = (o: V2): V2 => add(chest, rotV(o, L));
  return { hip, chest, axis, dorsal: [axis[1], -axis[0]], att, head: add(chest, [25 + P.headX, -50 + P.headY]) };
}

/** Head space: x forward along the snout, y down, z toward the viewer; HSC px per unit. */
const HSC = 1.12;
const HINGE: V2 = [-9, 3.5];
const JAW_OPEN = 36 * DEG;

export interface HeadFrame {
  T: (x: number, y: number) => V2;
  T3: (p: V3) => V3;
  J: (x: number, y: number) => V2;
  J3: (p: V3) => V3;
  /** Screen → head space (inverse of T). */
  inv: (p: V2) => V2;
  a: number;
  jawA: number;
}

export function headFrame(P: WyrmPose, rig: BodyRig = bodyRig(P)): HeadFrame {
  const hp = rig.head;
  const a = P.ha * DEG;
  const jawA = P.jaw * JAW_OPEN;
  const T = (x: number, y: number): V2 => add(hp, rotV([x * HSC, y * HSC], a));
  const J = (x: number, y: number): V2 => {
    const q = add(HINGE, rotV(sub([x, y], HINGE), jawA));
    return T(q[0], q[1]);
  };
  return {
    T,
    J,
    T3: (p) => {
      const q = T(p[0], p[1]);
      return [q[0], q[1], p[2] * HSC];
    },
    J3: (p) => {
      const q = J(p[0], p[1]);
      return [q[0], q[1], p[2] * HSC];
    },
    inv: (p) => {
      const q = rotV(sub(p, hp), -a);
      return [q[0] / HSC, q[1] / HSC];
    },
    a,
    jawA,
  };
}

/** Center of the open mouth (beam origin). */
export function mouthPoint(P: WyrmPose): V2 {
  const { T, J } = headFrame(P);
  return lerpV(T(38, 1.6), J(36, 3.2), 0.5);
}

export function eyePoint(P: WyrmPose): V2 {
  return headFrame(P).T(EYE_C[0], EYE_C[1]);
}

// ------------------------------------------------------------------ helpers

/** Plated tube on a part: smooth-ish volume, exact 1-tone scale seams and lips (marks). */
function plates(p: Part, mat: typeof HIDE, path: readonly V2[], radius: number | number[] | ((t: number) => number), o: Partial<PlateTubeOpts> & { bellyMat?: typeof HIDE }): void {
  const marks = newMarks();
  plateTube(p.g, p.brush({ mat }), path, radius, {
    facets: 4,
    lean: 0,
    jitter: 0,
    smooth: 0.3,
    seam: 1,
    ...o,
    seg: o.seg ?? 1000,
    marks,
    belly: o.belly ? { ...o.belly, brush: o.bellyMat ? p.brush({ mat: o.bellyMat, bias: o.belly.bias ?? 0 }) : o.belly.brush } : undefined,
  });
  applyMarks(p, marks);
}

/** Plated ellipsoid on a part (Voronoi crystal plates, exact seams). */
function ellPlates(p: Part, mat: typeof HIDE, c: V2, rx: number, ry: number, o: Parameters<typeof plateEllipsoid>[5]): void {
  const marks = newMarks();
  plateEllipsoid(p.g, p.brush({ mat }), c, rx, ry, { smooth: 0.25, tilt: 0.12, ...o, marks });
  applyMarks(p, marks);
}

/** Keep a reach from `from` inside the frame by shortening it (soft safety for wind-ups). */
function keepIn(from: V2, to: V2, m = 7): V2 {
  let k = 1;
  const d = sub(to, from);
  if (to[0] < m && d[0] < 0) k = Math.min(k, (from[0] - m) / -d[0]);
  if (to[1] < m && d[1] < 0) k = Math.min(k, (from[1] - m) / -d[1]);
  if (to[0] > W - 1 - m && d[0] > 0) k = Math.min(k, (W - 1 - m - from[0]) / d[0]);
  return madd(from, d, clamp(k, 0, 1));
}

/** Point at fraction s along a polyline. */
const along = (pts: readonly V2[], s: number): V2 => samplePath(pts, s).p;

/** Bresenham over integer pixels. */
function bres(a: V2, b: V2, fn: (x: number, y: number) => void): void {
  let x0 = Math.floor(a[0]);
  let y0 = Math.floor(a[1]);
  const x1 = Math.floor(b[0]);
  const y1 = Math.floor(b[1]);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 400; guard++) {
    fn(x0, y0);
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

// ------------------------------------------------------------------ ground contacts

const NEAR_FOOT = { hock: [89, 166] as V2, ball: [100, 176.5] as V2 };
const FAR_FOOT = { hock: [108, 160] as V2, ball: [118.5, 171] as V2 };

// ------------------------------------------------------------------ legs & arms

function leg(p: Part, J: V2, foot: { hock: V2; ball: V2 }, far: boolean, seed: number): void {
  const hide = far ? HIDE_EDGE_FAR : HIDE_EDGE;
  const crys = far ? CRYS_FAR : CRYS;
  const k = ik2(J, foot.hock, 21, 18.5, -1);
  const knee = k.joint;
  const td = norm(sub(knee, J));
  // the haunch: a big plated muscle mass, then thigh → shin → metatarsus (digitigrade)
  ellPlates(p, hide, madd(lerpV(J, knee, 0.42), perp(td), -1), 13, far ? 8 : 9.5, { angle: Math.atan2(td[1], td[0]), cell: 13, seed, idBase: 600, z: 3, rz: 9 });
  plates(p, hide, [J, knee], [8.6, 5.8], { facets: 4, seed: seed + 1, idBase: 700 });
  plates(p, hide, [knee, foot.hock], [6.4, 4.2], { facets: 3, seed: seed + 2, idBase: 900, z: 1 });
  plates(p, hide, [foot.hock, foot.ball], [4.4, 3.9], { facets: 3, seed: seed + 3, idBase: 1100, z: 2 });
  p.sphere(knee, 6.6, { mat: hide, z: 2 });
  // crystal spur growing off the knee
  p.shard(madd(knee, td, -1), add(knee, polar(Math.atan2(td[1], td[0]) / DEG - 70, 8)), 2, { mat: crys, z: 7 });
  p.ellipsoid(foot.ball, 5.2, 4, { mat: hide, z: 4 });
  // hock spur (crystal, points back)
  p.shard(foot.hock, add(foot.hock, polar(196, 8)), 2, { mat: crys, z: 6 });
  // toes + crystal claws
  const toes: [number, number][] = [
    [-16, 8],
    [4, 10],
    [24, 7.5],
  ];
  for (const [a, l] of toes) {
    const tip = add(foot.ball, polar(a, l));
    p.tube([foot.ball, tip], [3.3, 2], { mat: hide, z: 5 + (a > 0 ? 1 : 0) });
    p.shard(madd(tip, polar(a, 1), -1), add(tip, polar(a + 62, 5.5)), 1.6, { mat: crys, z: 8 });
  }
}

function arm(p: Part, Sa: V2, P: WyrmPose, far: boolean, seed: number): void {
  const hide = far ? HIDE_FAR : HIDE;
  const crys = far ? CRYS_FAR : CRYS;
  const el = add(Sa, polar(68 - P.arm, 13));
  const wa = -30 - P.arm * 1.4;
  const wr = add(el, polar(wa, 14));
  ellPlates(p, hide, Sa, 7.2, 6.2, { cell: 6, seed, idBase: 1300, z: 1 });
  plates(p, hide, [Sa, el, wr], [5.6, 4.3, 3.5], { facets: 3, seed: seed + 1, idBase: 1400 });
  p.ellipsoid(add(wr, polar(wa, 2)), 3.8, 2.9, { angle: wa * DEG, mat: hide, z: 3 });
  for (const [da, l] of [
    [12, 6],
    [48, 5.5],
    [84, 4.5],
  ] as const) {
    const root = add(wr, polar(wa + da * 0.4, 3));
    p.shard(root, add(root, polar(wa + da, l)), 1.4, { mat: crys, z: 5 });
  }
}

// ------------------------------------------------------------------ wings

interface WingRig {
  S: V2;
  E: V2;
  Wr: V2;
  tips: V2[];
  attach: V2;
}

const NEAR_LEN = { l1: 23.5, l2: 28, fingers: [42, 50, 45, 36] };
const FAR_LEN = { l1: 20, l2: 23.5, fingers: [31.5, 29, 22.5] };

function wingRig(S: V2, a1: number, a2: number, a3: number, fan: number, span: number, L: typeof NEAR_LEN, attach: V2): WingRig {
  const E = keepIn(S, add(S, polar(a1, L.l1 * span)));
  const Wr = keepIn(E, add(E, polar(a2, L.l2 * span)));
  // `fan` is the step of a 3-finger hand: more fingers split the same total spread
  const step = (fan * 2) / Math.max(1, L.fingers.length - 1);
  const tips = L.fingers.map((fl, i) => keepIn(Wr, add(Wr, polar(a3 + step * i, fl * span))));
  return { S, E, Wr, tips, attach };
}

export function wings(P: WyrmPose, rig: BodyRig = bodyRig(P)): { near: WingRig; far: WingRig } {
  const { hip, chest, att } = rig;
  const backAttach = add(lerpV(hip, chest, 0.5), rotV([-13, -9], P.lean * DEG));
  const far = wingRig(att([2, -14]), P.f1, P.f2, P.f3, P.ffan, P.fspan, FAR_LEN, att(lerpV([-11, -7], [13, 5], P.fat)));
  const near = wingRig(att([-11, -11]), P.n1, P.n2, P.n3, P.nfan, P.nspan, NEAR_LEN, backAttach);
  if (P.guard > 0.5) {
    near.attach = add(hip, [-6, 8]);
    far.attach = att([22, 18]);
  }
  return { near, far };
}

interface Panel {
  edge: (s: number) => V2;
  root: (s: number) => V2;
  at: (s: number, t: number) => V2;
  curve: V2[];
}

function panelsOf(w: WingRig, shield = false): Panel[] {
  const { S, E, Wr, tips, attach } = w;
  const n = tips.length;
  const out: Panel[] = [];
  for (let i = 0; i < n; i++) {
    const a = tips[i];
    const inner = i === n - 1;
    const b = inner ? attach : tips[i + 1];
    const hub = inner ? lerpV(Wr, E, 0.5) : Wr;
    // scallop depth: deep between spread fingers, shallow when folded into a shield
    const ctrl = lerpV(lerpV(a, b, 0.5), hub, shield ? (inner ? 0.12 : 0.2) : inner ? 0.4 : 0.58);
    const edge = (s: number): V2 => {
      const u = 1 - s;
      return [u * u * a[0] + 2 * u * s * ctrl[0] + s * s * b[0], u * u * a[1] + 2 * u * s * ctrl[1] + s * s * b[1]];
    };
    // the inner membrane is rooted along the whole arm; folded into a shield only along the forearm
    const arm = shield ? [Wr, lerpV(Wr, E, 0.7)] : [Wr, E, S];
    const root = inner ? (s: number) => along(arm, Math.min(1, s * 1.05)) : () => Wr;
    const at = (s: number, t: number) => lerpV(root(s), edge(s), t);
    const curve: V2[] = [];
    for (let k = 0; k <= 16; k++) curve.push(edge(k / 16));
    out.push({ edge, root, at, curve });
  }
  return out;
}

function drawWing(p: Part, w: WingRig, far: boolean, P: WyrmPose): void {
  const glass = far ? GLASS_FAR : GLASS;
  const hide = far ? HIDE_FAR : HIDE;
  const crys = far ? CRYS_FAR : CRYS;
  const shield = P.guard > 0.5;
  const { S, E, Wr, tips } = w;
  const panels = panelsOf(w, shield);
  const sB = 2;
  const tB = far ? [0, 1] : [0, 0.58, 1];
  const n0: V3 = shield ? [0.18, 0.05, 1] : [0, 0, 1];
  // crystal panes: each panel is pleated along its middle vein into a leading facet that turns
  // toward the key light and a trailing facet that turns away; the outer part of each facet
  // tilts a little further (a second, subtler crease). Normals only — the light picks the tones.
  const toL = norm([KEY[0], KEY[1]]);
  panels.forEach((pn, i) => {
    const outer = i === 0 ? 0.1 : i === panels.length - 1 ? -0.12 : 0;
    for (let si = 0; si < sB; si++)
      for (let ti = 0; ti < tB.length - 1; ti++) {
        const s0 = si / sB;
        const s1 = (si + 1) / sB;
        const t0 = tB[ti];
        const t1 = tB[ti + 1];
        const poly: V2[] = [pn.at(s0, t0), pn.at(s1, t0)];
        if (t1 >= 1) for (let k = 0; k <= 8; k++) poly.push(pn.edge(s1 + ((s0 - s1) * k) / 8));
        else poly.push(pn.at(s1, t1), pn.at(s0, t1));
        const lead = si === 0 ? 0.12 : -0.18;
        const radial = norm(sub(pn.edge((s0 + s1) / 2), pn.root((s0 + s1) / 2)));
        const crease = ti === 1 ? 0.12 : 0;
        const j1 = (hash3(i, si, ti, 3) - 0.5) * 0.1;
        const j2 = (hash3(i, si, ti, 4) - 0.5) * 0.1;
        const k = lead + outer;
        const nn: V3 = [n0[0] + toL[0] * k + radial[0] * crease + j1, n0[1] + toL[1] * k + radial[1] * crease + j2, n0[2]];
        p.facet(poly, { mat: glass, normal: norm3(nn), id: 1 + i * 20 + si * 5 + ti, z: 0 });
      }
  });
  // hide bones: arm (leading edge), joints, finger spars
  const boneR = far ? [4.2, 3.5, 2.9] : [5.4, 4.4, 3.6];
  plates(p, hide, [S, E, Wr], boneR, { facets: 3, z: 6, seed: far ? 31 : 21, idBase: 800 });
  p.sphere(E, boneR[1] + 0.8, { mat: hide, z: 9 });
  p.sphere(Wr, boneR[2] + 0.6, { mat: hide, z: 9 });
  tips.forEach((t, i) => {
    const d = norm(sub(t, Wr));
    const mid = madd(lerpV(Wr, t, 0.5), perp(d), far ? -1 : -1.6);
    p.tube(bezier(Wr, mid, t, undefined, 8), (u) => lerp(far ? 2.5 : 3.3, 1, u), { mat: hide, z: 7 - i * 0.2 });
    // tiny crystal claw at each finger tip
    p.shard(madd(t, d, -1), madd(t, d, far ? 3.5 : 4.5), 1.1, { mat: crys, z: 8 });
  });
  // crystal spur off the elbow, thumb claw at the wrist
  const out = norm(add(norm(sub(E, S)), norm(sub(E, Wr))));
  p.shard(madd(E, out, -1), madd(E, out, far ? 8 : 12), far ? 2 : 2.8, { mat: crys, z: 10 });
  const fwd = norm(sub(Wr, E));
  p.shard(madd(Wr, fwd, -1), madd(Wr, rotV(fwd, -0.6), far ? 6 : 8.5), far ? 1.5 : 2, { mat: crys, z: 10 });

  // veins and the rim are light, not glass: re-stamp them opaque after compositing (where still visible)
  const lit: number[] = [];
  p.detail((d) => wingDetail(d, panels, glass, far, P, sB, tB, lit));
  r.overlay((ov) => {
    for (let k = 0; k < lit.length; k += 4) if (ov.get(lit[k], lit[k + 1]) === lit[k + 2]) ov.set(lit[k], lit[k + 1], lit[k + 2], { emissive: lit[k + 3] });
  });
}

/** Glint sweep, glowing veins and the bright trailing-edge rim on the wing glass. */
function wingDetail(d: DetailCtx, panels: Panel[], glass: typeof GLASS, far: boolean, P: WyrmPose, sB: number, tB: number[], lit: number[]): void {
  const isGlass = (x: number, y: number) => d.material(x, y) === glass;
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const pn of panels)
    for (const q of [...pn.curve, pn.root(0), pn.root(1)]) {
      x0 = Math.min(x0, q[0]);
      y0 = Math.min(y0, q[1]);
      x1 = Math.max(x1, q[0]);
      y1 = Math.max(y1, q[1]);
    }
  const X0 = Math.max(0, Math.floor(x0) - 2);
  const Y0 = Math.max(0, Math.floor(y0) - 2);
  const X1 = Math.min(W - 1, Math.ceil(x1) + 2);
  const Y1 = Math.min(H - 1, Math.ceil(y1) + 2);
  // glint: a diagonal band of light sweeping across the glass
  if (P.glint >= 0 && P.glint <= 1) {
    const g = lerp(X0 + Y0 - 6, X1 + Y1 + 6, P.glint);
    for (let y = Y0; y <= Y1; y++)
      for (let x = X0; x <= X1; x++) {
        const k = x + y - g;
        if (k >= 0 && k < 4 && isGlass(x, y)) d.shift(x, y, k < 1 || k >= 3 ? 1 : 2);
      }
  }
  // veins: main ribs from the wrist into each pane boundary, cross veins, forks at the edge
  const glow = P.glow;
  const vMain = far ? (glow > 0.6 ? PAL.cyan4 : PAL.cyan3) : PAL.white;
  const vCross = far ? (glow > 0.6 ? PAL.cyan3 : PAL.cyan2) : glow > 0.8 ? PAL.white : PAL.cyan4;
  // veins are inset like leaded glass: a glowing core with a dark edge on its shadow side
  const veinPx = new Set<number>();
  const lead: number[] = [];
  const paint = (a: V2, b: V2, col: number) =>
    bres(a, b, (x, y) => {
      if (!isGlass(x, y)) return;
      d.set(x, y, col, { emissive: true });
      lit.push(x, y, col, 255);
      veinPx.add(y * W + x);
      lead.push(x + 1, y + 1);
    });
  for (const pn of panels) {
    // the pleat vein (bright), two side veins, a cross vein, forks at the trailing edge
    paint(pn.at(0.5, 0.1), pn.at(0.5, 0.96), vMain);
    for (const s of [0.25, 0.75]) {
      paint(pn.at(s, far ? 0.4 : 0.3), pn.at(s, 0.94), vCross);
      paint(pn.at(s, 0.82), pn.at(s + 0.06, 0.97), vCross);
    }
    paint(pn.at(0.5, 0.8), pn.at(0.44, 0.97), vMain);
    paint(pn.at(0.5, 0.8), pn.at(0.56, 0.97), vMain);
  }
  const leadCol = far ? PAL.cyan0 : PAL.cyan1;
  for (let k = 0; k < lead.length; k += 2) {
    const x = lead[k];
    const y = lead[k + 1];
    if (!veinPx.has(y * W + x) && isGlass(x, y) && d.tone(x, y) >= 2) d.set(x, y, leadCol);
  }
  // trailing-edge rim: glass pixels on the silhouette along a scallop catch the light
  const rim = far ? PAL.cyan3 : PAL.cyan4;
  for (let y = Y0; y <= Y1; y++)
    for (let x = X0; x <= X1; x++) {
      if (!isGlass(x, y)) continue;
      if (d.has(x - 1, y) && d.has(x + 1, y) && d.has(x, y - 1) && d.has(x, y + 1)) continue;
      const q: V2 = [x + 0.5, y + 0.5];
      let near = false;
      for (const pn of panels) {
        for (let k = 1; k < pn.curve.length && !near; k++) if (distSeg(q, pn.curve[k - 1], pn.curve[k]) < 1.5) near = true;
        if (near) break;
      }
      if (near) {
        d.set(x, y, rim);
        lit.push(x, y, rim, 0);
      }
    }
}

function distSeg(p: V2, a: V2, b: V2): number {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const t = clamp(((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p[0] - a[0] - abx * t, p[1] - a[1] - aby * t);
}

// ------------------------------------------------------------------ tail

export function tailPath(P: WyrmPose, rig: BodyRig = bodyRig(P)): V2[] {
  const base = [142, 138, 143, 153, 166, 180, 196, 216, 238, 256];
  const pts: V2[] = [add(rig.hip, rotV([-13, 6], P.lean * 0.4 * DEG))];
  for (let i = 0; i < base.length; i++) {
    const k = i / (base.length - 1);
    const a = base[i] - P.tailLift * k * k + Math.sin((P.tail - i * 0.07) * TAU) * P.tailAmp * (0.3 + k);
    pts.push(add(pts[i], polar(a, 6.3)));
  }
  return catmull(pts, 3);
}

// ------------------------------------------------------------------ head mesh (head space)

// upper skull: midline ridge (z 0), brow / side edge, mouth line, cheekbone, nose
const M: V3[] = [
  [-13, -5, 0],
  [-5, -13, 0],
  [8, -14, 0],
  [22, -9.5, 0],
  [35, -6, 0],
  [40, -3, 0],
];
const S_: V3[] = [
  [-13, -1, 7],
  [-4, -9, 10],
  [9, -10, 11.5],
  [22, -6, 8],
  [34, -3, 6],
  [40, -0.5, 3],
];
const L_: V3[] = [
  [-10, 4, 8],
  [4, 3, 10],
  [20, 2.5, 8],
  [33, 2, 5],
  [40, 1.5, 2],
];
const CK: V3 = [1, -1.5, 13];
const NOSE: V3 = [42, 0, 0];
// lower jaw: top edge (meets the mouth line), side bottom edge, under-chamfer
const JT: V3[] = [
  [-10, 4, 8],
  [4, 3.5, 9.5],
  [20, 3, 8],
  [33, 2.5, 5],
  [39, 2, 2],
];
const JB: V3[] = [
  [-12, 9, 7],
  [2, 11, 9],
  [19, 9, 7.5],
  [31, 6.5, 5],
  [37, 4.5, 2],
];
const JU: V3[] = [
  [-11, 11.5, 2],
  [2, 13.5, 3],
  [18, 11.5, 2],
  [30, 8.5, 1],
  [36, 5.5, 0],
];
/** Eye center and axis in head space (the outer corner sits higher: a fierce slant). */
const EYE_C: V2 = [4.6, -6.1];
const EYE_AX: V2 = norm([1, 0.24]);

function drawHead(P: WyrmPose, rig: BodyRig, f: number): void {
  const HF = headFrame(P, rig);
  const { T, T3, J, J3 } = HF;
  const open = P.jaw > 0.06;

  // far horn (behind everything of the head)
  {
    // the far horn: same sweep, rooted a little higher and turned up so the pair splays
    const root = T(-4, -12);
    const path = bezier(T(-4, -12), T(-15, -17), T(-26, -20), T(-34, -29), 12).map((q) => add(root, rotV(sub(q, root), -0.22)));
    r.part('hornFar').tube(path, (t) => lerp(3.2, 0.6, Math.pow(t, 0.85)), { mat: GOLD_FAR, facets: 3 });
  }

  // crystal crest at the back of the skull (between the horns), behind the head
  {
    const cp = r.part('crest');
    for (const [x, y, a, l, w] of [
      [-10, -7, 200, 10, 2.4],
      [-12, -2, 185, 8, 2],
    ] as const) {
      const b = T(x, y);
      cp.shard(b, add(b, polar(a + P.ha, l)), w, { mat: CRYS });
    }
  }

  // mouth cavity (+ prism light gathering inside it)
  if (open) {
    const p = r.part('mouth');
    const top = L_.map((q) => T(q[0], q[1]));
    const bot = JT.map((q) => J(q[0], q[1])).reverse();
    p.facet([...top, ...bot], { mat: MOUTH, normal: [0, -0.3, 1], tone: 1 });
    p.detail((d) => mouthDetail(d, P, HF, [...top, ...bot]));
    // tongue (hidden by the light once the mouth is full of it)
    if (P.mouth < 0.6) r.part('tongue', { shadow: false }).tube([J(-2, 5), J(10, 4.8), J(22, 4.2), J(27, 3.8)], [2.2, 2, 1.6, 1.1], { mat: MOUTH, bias: 0.25 });
    // teeth: upper fangs hang into the gape, lower teeth stand on the jaw
    const tp = r.part('teeth', { shadow: false });
    const down = rotV([0, 1], HF.a);
    for (const [x, l] of [
      [9, 3],
      [15, 3.6],
      [21, 4],
      [27, 5.2],
      [33, 4.2],
    ] as const) {
      const b = T(x, 1.4 + (x > 30 ? 0.3 : 0));
      tp.shard(b, madd(b, down, l + 1.5), 1.25, { mat: BELLY });
    }
    const up = rotV([0, -1], HF.a + HF.jawA);
    for (const [x, l] of [
      [13, 3],
      [21, 3.4],
      [29, 3.6],
    ] as const) {
      const b = J(x, 4.4);
      tp.shard(b, madd(b, up, l + 1.5), 1.2, { mat: BELLY });
    }
    // prism light gathered in the jaws (never outlined: it is light)
    if (P.mouth > 0.45) {
      const m = mouthPoint(P);
      const k = P.mouth;
      const a = (P.ha + P.jaw * 18) * DEG;
      r.part('mouthGlow', { lines: false, shadow: false, outline: false }).ellipsoid(madd(m, rotV([1, 0], a), -1.5), 3.5 + 4 * k, 2 + 3 * k * P.jaw, { mat: ENERGY, heat: 'radial', angle: a });
    }
  }

  // lower jaw
  {
    const p = r.part('jaw');
    for (let i = 0; i < JT.length - 1; i++) {
      p.facet3([J3(JT[i]), J3(JT[i + 1]), J3(JB[i + 1]), J3(JB[i])], { mat: HIDE_EDGE, id: 40 + i });
      p.facet3([J3(JB[i]), J3(JB[i + 1]), J3(JU[i + 1]), J3(JU[i])], { mat: BELLY, id: 50 + i, z: -0.5 });
    }
  }

  // skull: faceted planes
  const p = r.part('skull');
  for (let i = 0; i < M.length - 1; i++) p.facet3([T3(M[i]), T3(M[i + 1]), T3(S_[i + 1]), T3(S_[i])], { mat: HIDE_EDGE, id: 1 + i });
  const side: V3[][] = [
    [S_[0], S_[1], CK],
    [S_[1], S_[2], CK],
    [S_[0], CK, L_[1], L_[0]],
    [CK, S_[2], S_[3], L_[2], L_[1]],
    [S_[3], S_[4], L_[3], L_[2]],
    [S_[4], S_[5], L_[4], L_[3]],
    [M[5], NOSE, L_[4], S_[5]],
  ];
  side.forEach((f3, i) => p.facet3(f3.map(T3), { mat: HIDE_EDGE, id: 10 + i }));
  // brow ridge: a raised crystal plate over the eye
  p.facet3([T3([-3, -9.6, 11]), T3([10, -10.6, 12.5]), T3([14, -8, 11]), T3([1, -7.6, 12])], { mat: HIDE_EDGE, id: 30, z: 0.5 });
  // closed-mouth fang over the lower jaw
  if (!open) {
    const b = T(29, 1.6);
    p.shard(b, madd(b, rotV([0, 1], HF.a), 4.8), 1.3, { mat: BELLY, z: 14 });
  }
  p.detail((d) => headDetail(d, P, HF));

  // near horns (gold): the main sweep off the crown and a cheek horn
  {
    const hp = r.part('horns');
    hp.tube(bezier(T(-6, -10), T(-17, -12), T(-30, -12.5), T(-40, -21), 14), (t) => lerp(4.4, 0.6, Math.pow(t, 0.75)), {
      mat: GOLD,
      facets: 3,
    });
    hp.tube(bezier(T(-8, -1.5), T(-15, -0.5), T(-21, 2.5), T(-27, 7.5), 10), (t) => lerp(2.5, 0.55, Math.pow(t, 0.8)), { mat: GOLD, z: 2, facets: 3 });
  }
  void f;
}

const GLOW_RAMP = [PAL.night0, PAL.cyan0, PAL.cyan1, PAL.cyan2, PAL.cyan3, PAL.cyan4, PAL.white];

/**
 * Mouth interior: a dark throat at the back warming to crimson gums at the front; once light
 * gathers (P.mouth) the cavity fills with a cyan → white gradient centred on the beam origin.
 */
function mouthDetail(d: DetailCtx, P: WyrmPose, HF: HeadFrame, poly: V2[]): void {
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const q of poly) {
    x0 = Math.min(x0, q[0]);
    y0 = Math.min(y0, q[1]);
    x1 = Math.max(x1, q[0]);
    y1 = Math.max(y1, q[1]);
  }
  const m = mouthPoint(P);
  const gumA = HF.T(-6, 2.2);
  const gumB = HF.T(39, 1.8);
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (!d.has(x, y)) continue;
      const q = HF.inv([x + 0.5, y + 0.5]);
      const along = clamp((q[0] + 10) / 50, 0, 1);
      if (P.mouth > 0.3) {
        const dm = Math.hypot(x + 0.5 - m[0], y + 0.5 - m[1]);
        const I = P.mouth * (1.15 - dm / 16) + along * 0.35 - 0.15;
        const k = clamp(Math.floor(I * 7), 0, 6);
        d.set(x, y, GLOW_RAMP[k], { emissive: k >= 2 });
        continue;
      }
      let col: number = along < 0.3 ? PAL.night0 : along < 0.62 ? PAL.void0 : PAL.crim0;
      if (along > 0.22 && distSeg([x + 0.5, y + 0.5], gumA, gumB) < 1.3) col = PAL.crim1;
      d.set(x, y, col);
    }
}

/** Eye (glowing almond + light trail in a dark socket) and the nostril, in head space. */
function headDetail(d: DetailCtx, P: WyrmPose, HF: HeadFrame): void {
  const c = HF.T(EYE_C[0], EYE_C[1]);
  const R = 9;
  const ax = EYE_AX;
  const ay: V2 = [-ax[1], ax[0]];
  const flare = P.glow > 0.85;
  for (let y = Math.floor(c[1] - R); y <= Math.ceil(c[1] + R); y++)
    for (let x = Math.floor(c[0] - R); x <= Math.ceil(c[0] + R); x++) {
      if (!d.has(x, y)) continue;
      const q = HF.inv([x + 0.5, y + 0.5]);
      const dx = q[0] - EYE_C[0];
      const dy = q[1] - EYE_C[1];
      const u = dx * ax[0] + dy * ax[1];
      const v = dx * ay[0] + dy * ay[1];
      const half = 5.2;
      if (P.eye > 0.5) {
        const hv = 2.3 * Math.max(0, 1 - (u / half) * (u / half));
        if (Math.abs(u) <= half && Math.abs(v) <= hv) {
          const core = Math.abs(u + 0.6) < 1.8 && Math.abs(v) < 1;
          d.set(x, y, core ? PAL.white : Math.abs(v) > hv - 0.7 || u > half - 1 ? PAL.cyan3 : PAL.cyan4, { emissive: true });
          continue;
        }
        // light trail streaming back from the outer corner
        const tl = flare ? 9 : 5.5;
        if (u < -half + 0.5 && u > -half - tl && Math.abs(v + (u + half) * 0.12) < 0.75) {
          d.set(x, y, u > -half - 2.5 ? PAL.cyan3 : PAL.cyan2, { emissive: true });
          continue;
        }
        // dark socket rim
        if (Math.abs(u) <= half + 1.4 && Math.abs(v) <= hv + 1.4) d.set(x, y, Math.abs(v) <= hv + 0.8 ? PAL.night1 : PAL.night2);
      } else {
        // squeezed shut: a dark crease with a faint glow line
        if (Math.abs(u) <= half && Math.abs(v - 0.3) < 0.6) d.set(x, y, PAL.cyan2, { emissive: true });
        else if (Math.abs(u) <= half + 1 && Math.abs(v - 0.3) < 1.6) d.set(x, y, PAL.night1);
      }
    }
  // nostril
  const n0 = HF.T(35.5, -3.2);
  const n1 = HF.T(37.5, -2.6);
  bres(n0, n1, (x, y) => {
    if (d.has(x, y)) d.set(x, y, P.mouth > 0.5 ? PAL.cyan3 : PAL.night0, { emissive: P.mouth > 0.5 });
  });
  // cheek scale lines: two shallow creases under the eye
  d.shiftLine(HF.T(-6, 0.5), HF.T(4, -0.8), -1);
  d.shiftLine(HF.T(14, -1), HF.T(26, -2.5), -1);
}

// ------------------------------------------------------------------ spikes

function spikeRow(p: Part, pts: { base: V2; dir: V2; len: number; hw: number }[], mat: typeof CRYS, glow: number): void {
  for (const s of pts) p.shard(s.base, madd(s.base, s.dir, s.len), s.hw, { mat, height: s.hw * 1.2 });
  if (glow > 0.15) p.biasWhere(() => glow * 0.14);
  if (glow > 0.55)
    p.detail((d) => {
      for (const s of pts) {
        const a = madd(s.base, s.dir, s.len * 0.15);
        const b = madd(s.base, s.dir, s.len * (0.45 + 0.3 * glow));
        bres(a, b, (x, y) => d.has(x, y) && d.set(x, y, glow > 0.85 ? PAL.white : PAL.cyan4, { emissive: true }));
      }
    });
}

// ------------------------------------------------------------------ the dragon

export interface DrawOpts {
  anim: string;
  frame: number;
  stages?: boolean;
}

export function drawWyrm(P: WyrmPose, o: DrawOpts): HDRenderResult {
  const rig = bodyRig(P);
  const { hip, chest, axis, dorsal, att } = rig;
  const { near, far } = wings(P, rig);
  const guard = P.guard > 0.5;
  r.begin();

  // ---------------- far wing
  drawWing(r.part('farWing'), far, true, P);

  // ---------------- far arm, far leg
  arm(r.part('farArm'), att([13, 3]), P, true, 51);
  leg(r.part('farLeg'), add(hip, rotV([17, -1], P.lean * 0.3 * DEG)), FAR_FOOT, true, 61);

  // ---------------- tail: dorsal crystals, plated tube, crystal blade
  const tail = tailPath(P, rig);
  const tLens = pathLengths(tail);
  const tailR = (t: number) => lerp(10, 2.4, Math.pow(t, 0.85));
  {
    const pts: { base: V2; dir: V2; len: number; hw: number }[] = [];
    for (const t of [0.13, 0.27, 0.41, 0.55, 0.68, 0.8]) {
      const s = samplePath(tail, t, tLens);
      const dn = perp(s.tan);
      pts.push({ base: madd(s.p, dn, tailR(t) - 1.5), dir: norm(add(dn, mul(s.tan, 0.75))), len: lerp(11, 5.5, t), hw: lerp(3.2, 1.8, t) });
    }
    spikeRow(r.part('tailSpikes'), pts, CRYS, P.glow);
  }
  {
    const p = r.part('tail');
    plates(p, HIDE_EDGE, tail, tailR, { facets: 4, seed: 9, idBase: 2000, belly: { from: 0.3, side: -1, seg: 4.2, bias: 0.04 }, bellyMat: BELLY });
    const tip = tail[tail.length - 1];
    const tdir = norm(sub(tip, tail[tail.length - 4]));
    // the blade: a long crystal leaf + two short guard shards
    p.shard(madd(tip, tdir, -3), madd(tip, tdir, 17), 5.2, { mat: CRYS, z: 8, height: 6, shoulder: 0.32 });
    p.shard(madd(tip, tdir, -1), add(tip, polar(Math.atan2(tdir[1], tdir[0]) / DEG + 62, 7)), 1.8, { mat: CRYS, z: 7 });
    p.shard(madd(tip, tdir, -1), add(tip, polar(Math.atan2(tdir[1], tdir[0]) / DEG - 62, 6)), 1.6, { mat: CRYS, z: 7 });
    if (P.glow > 0.5)
      p.detail((d) => bres(madd(tip, tdir, 1), madd(tip, tdir, 6 + 8 * P.glow), (x, y) => d.has(x, y) && d.set(x, y, P.glow > 0.85 ? PAL.white : PAL.cyan4, { emissive: true })));
  }

  // ---------------- back crystals (behind the torso)
  {
    const pts: { base: V2; dir: V2; len: number; hw: number }[] = [];
    // one row along the ridge, fanning: the shoulder spikes stand up, the hip spikes lie back
    const spikes: [number, number, number, number][] = [
      [0.96, 11, 13, -0.3],
      [0.62, 13, 18, -0.62],
      [0.28, 13.5, 16, -0.95],
      [-0.04, 12, 10, -1.3],
    ];
    for (const [t, off, len, back] of spikes) pts.push({ base: madd(lerpV(hip, chest, t), dorsal, off), dir: norm(add(dorsal, mul(axis, back))), len, hw: len * 0.32 });
    spikeRow(r.part('backSpikes'), pts, CRYS, P.glow);
  }

  // ---------------- torso: plated tube from the tail root into the neck base + haunch
  {
    const p = r.part('torso');
    const T0 = madd(hip, axis, -12);
    const N0 = att([6, -15]);
    const br = 1 + 0.045 * (P.breath - 0.5);
    const spine = catmull([T0, hip, madd(hip, axis, 17), chest, N0], 4);
    const prof = [11, 16.5, 17.5 * br, 15.5 * br, 8];
    const rad = (t: number) => {
      const f = t * (prof.length - 1);
      const i = Math.min(prof.length - 2, Math.floor(f));
      const k = f - i;
      const s = k * k * (3 - 2 * k);
      return lerp(prof[i], prof[i + 1], s);
    };
    plates(p, HIDE_EDGE, spine, rad, { facets: 5, seed: 5, idBase: 1, belly: { from: 0.3, side: 1, seg: 5.5, bias: 0 }, bellyMat: BELLY, flat: 1.1 });
    ellPlates(p, HIDE_EDGE, madd(add(hip, [-3, 3]), dorsal, 1), 17, 14, { angle: (-56 + P.lean) * 0.3 * DEG, cell: 15, seed: 7, idBase: 500, z: -2 });
  }

  // crystal planes across the chest: two cut lines (cyan), lit by the inner energy
  r.getPart('torso')!.detail((d) => {
    const col = P.glow > 0.8 ? PAL.cyan4 : P.glow > 0.5 ? PAL.cyan3 : PAL.cyan2;
    const em = P.glow > 0.5;
    const ln = (a: V2, b: V2) => bres(a, b, (x, y) => d.has(x, y) && d.tone(x, y) >= 3 && d.set(x, y, col, { emissive: em }));
    ln(att([-13, -2]), att([-6, 13]));
    ln(att([-6, 13]), att([2, 17]));
    ln(att([-17, 12]), att([-11, 24]));
  });

  // ---------------- near hind leg
  leg(r.part('nearLeg'), add(hip, rotV([6, 7], P.lean * 0.3 * DEG)), NEAR_FOOT, false, 71);

  // ---------------- neck: crest crystals + plated tube
  const HF = headFrame(P, rig);
  const N0 = att([5, -14]);
  const neck = bezier(N0, add(N0, rotV([-7, -21], P.lean * 0.6 * DEG)), HF.T(-21, 9), HF.T(-5, 1.5), 20);
  const nLens = pathLengths(neck);
  const neckR = (t: number) => lerp(9, 5.4, Math.pow(t, 0.8));
  {
    const pts: { base: V2; dir: V2; len: number; hw: number }[] = [];
    for (const t of [0.12, 0.27, 0.42, 0.57, 0.71, 0.84]) {
      const s = samplePath(neck, t, nLens);
      const dn: V2 = [-perp(s.tan)[0], -perp(s.tan)[1]];
      pts.push({ base: madd(s.p, dn, neckR(t) - 1.8), dir: norm(add(dn, mul(s.tan, -0.6))), len: lerp(13, 7, t), hw: lerp(3.5, 2.2, t) });
    }
    spikeRow(r.part('neckSpikes'), pts, CRYS, P.glow);
    const p = r.part('neck');
    plates(p, HIDE_EDGE, neck, neckR, { facets: 4, seed: 13, idBase: 3000, belly: { from: 0.22, side: 1, seg: 4.4, bias: 0 }, bellyMat: BELLY });
  }

  // ---------------- near arm
  arm(r.part('nearArm'), att([3, 6]), P, false, 81);

  // ---------------- near wing (in front of the body; behind the head)
  drawWing(r.part('nearWing', { order: guard ? 10.5 : 7.5 }), near, false, P);

  // ---------------- head
  drawHead(P, rig, o.frame);

  // ---------------- light (after the outline)
  r.overlay((ov) => lightFx(ov, P, o, rig, near, far));
  void guard;
  return r.finish({ stages: o.stages });
}

// ------------------------------------------------------------------ light overlays

function twinkle(ov: OverlayCtx, at: V2, size: number): void {
  const x = Math.round(at[0]);
  const y = Math.round(at[1]);
  ov.set(x, y, PAL.white, { emissive: true, onlyOver: true });
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ov.set(x + dx, y + dy, size >= 2 ? PAL.white : PAL.cyan4, { emissive: 220, onlyOver: true });
    if (size >= 2) ov.set(x + dx * 2, y + dy * 2, PAL.cyan4, { emissive: 180, onlyOver: true });
    if (size >= 3) ov.set(x + dx * 3, y + dy * 3, PAL.cyan3, { emissive: 140, onlyOver: true });
  }
}

/** Twinkle schedule for the idle loop: [anchor, size] per frame. */
const IDLE_SPARKS: [number, number][][] = [[], [[0, 1]], [[0, 2]], [[0, 3]], [[0, 1]], [], [], [[1, 1]], [[1, 2]], [[1, 2]], [[1, 1]], []];
const ROAR_SPARKS: [number, number][][] = [[], [], [], [], [[0, 3], [2, 2]], [[0, 1], [1, 2]], [[1, 1], [3, 3]], [[3, 1], [2, 2]], [[2, 1], [0, 2]], [[0, 1]], [], [], [], []];

const RIM_FROM = new Map<number, number>([
  [PAL.night2, PAL.cyan1],
  [PAL.night3, PAL.cyan2],
  [PAL.night4, PAL.cyan2],
  [PAL.steel, PAL.cyan3],
]);

/**
 * Crystal refraction: light caught inside the white crystal exits along the shadow-side
 * silhouette (bottom / right edges) as a thin ice-cyan line — a material trait, so it stays
 * under the owner's dynamic rim light for both players.
 */
function crystalRim(ov: OverlayCtx): void {
  const hits: number[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const c = ov.get(x, y);
      if (c === null || ov.isOutline(x, y)) continue;
      const to = RIM_FROM.get(c);
      if (to === undefined) continue;
      if (!(ov.isOutline(x + 1, y) || ov.isOutline(x, y + 1) || ov.isOutline(x + 1, y + 1))) continue;
      if (ov.isOutline(x - 1, y) && ov.isOutline(x, y - 1)) continue;
      hits.push(x, y, to);
    }
  for (let i = 0; i < hits.length; i += 3) ov.set(hits[i], hits[i + 1], hits[i + 2]);
}

function lightFx(ov: OverlayCtx, P: WyrmPose, o: DrawOpts, rig: BodyRig, near: WingRig, far: WingRig): void {
  const f = o.frame;
  crystalRim(ov);
  const anchors: V2[] = [lerpV(near.Wr, near.tips[0], 0.6), lerpV(near.E, near.attach, 0.45), lerpV(far.Wr, far.tips[1], 0.6), lerpV(near.Wr, near.tips[1], 0.5), madd(rig.hip, [-1, 0], 26)];
  const sparks = o.anim === 'idle' ? IDLE_SPARKS[f % 12] : o.anim === 'roar' ? (ROAR_SPARKS[f] ?? []) : o.anim === 'attack' && f >= 3 && f <= 6 ? [[f % 2 ? 0 : 3, f >= 5 ? 2 : 1] as [number, number]] : [];
  for (const [ai, size] of sparks) twinkle(ov, anchors[ai], size);

  const m = mouthPoint(P);
  const HF = headFrame(P, rig);
  // charge: motes of light spiral into the jaws
  if (o.anim === 'attack' && f >= 1 && f <= 6) {
    const k = (f - 1) / 5;
    for (let i = 0; i < 7; i++) {
      const a0 = hash3(i, 1, 0, 5) * 360;
      const r0 = 18 + hash3(i, 2, 0, 5) * 16;
      const rr = r0 * (1 - k * 0.85) + 2;
      const q = add(m, polar(a0 + k * 140 + i * 8, rr));
      const col = i % 3 === 0 ? PAL.white : i % 3 === 1 ? PAL.cyan4 : PAL.cyan3;
      ov.set(q[0], q[1], col, { emissive: true });
      if (i % 2 === 0 && k > 0.3) ov.set(q[0] + 1, q[1], col, { emissive: 200 });
    }
  }
  // light leaking between the closed jaws while charging
  if (P.mouth > 0.18 && P.jaw < 0.3) {
    const col = P.mouth > 0.75 ? PAL.white : P.mouth > 0.45 ? PAL.cyan4 : PAL.cyan3;
    const a = HF.T(10, 2.6);
    const b = HF.T(39.5, 1.9);
    bres(a, b, (x, y) => ov.has(x, y) && ov.set(x, y, col, { emissive: true }));
    if (P.mouth > 0.6) bres(HF.T(24, 3.2), b, (x, y) => ov.has(x, y) && ov.set(x, y, PAL.cyan4, { emissive: 220 }));
  }
  // impact: muzzle flare (a prism star) — then the beam origin stays lit while the beam pours out
  if (o.anim === 'attack' && f >= IMPACT && f <= IMPACT + 4) {
    const big = [1, 0.7, 0.45, 0.4, 0.3][f - IMPACT];
    const mx = Math.round(m[0]) + 1;
    const my = Math.round(m[1]);
    const ray = (dx: number, dy: number, n0: number) => {
      // keep the star inside the frame (shorten, never clip)
      let n = n0;
      if (dx > 0) n = Math.min(n, W - 4 - mx);
      if (dx < 0) n = Math.min(n, mx - 1);
      if (dy > 0) n = Math.min(n, H - 2 - my);
      if (dy < 0) n = Math.min(n, my - 1);
      for (let k = 1; k <= n; k++) ov.set(mx + dx * k, my + dy * k, k <= n * 0.35 ? PAL.white : k <= n * 0.7 ? PAL.cyan4 : PAL.cyan3, { emissive: true });
    };
    const core = f === IMPACT ? 2 : 1;
    for (let y = -core; y <= core; y++) for (let x = -core; x <= core; x++) if (Math.abs(x) + Math.abs(y) <= core + 1) ov.set(mx + x, my + y, PAL.white, { emissive: true });
    ray(1, 0, Math.round(18 * big));
    ray(-1, 0, Math.round(5 * big));
    ray(0, -1, Math.round(10 * big));
    ray(0, 1, Math.round(10 * big));
    if (f <= IMPACT + 1) for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) ray(dx, dy, Math.round(5 * big));
    if (f === IMPACT) {
      // a thin ring of light around the flare
      for (let a = 0; a < 360; a += 12) {
        const q = add([mx, my], polar(a, 9));
        ov.set(q[0], q[1], PAL.cyan3, { emissive: 160, onlyEmpty: true, alpha: 0.8 });
      }
    }
  }
  if (o.anim === 'attack' && f === IMPACT) smear(ov, framePose('attack', IMPACT - 1), P);
}

/** Motion smear: the band swept by the head between two poses, translucent light on empty pixels. */
function smear(ov: OverlayCtx, from: WyrmPose, to: WyrmPose): void {
  const N = 16;
  const pts = (t: number) => {
    const P = { ...to } as WyrmPose;
    for (const k of ['hx', 'hy', 'lean', 'headX', 'headY', 'ha', 'jaw'] as const) P[k] = lerp(from[k], to[k], t);
    const HF = headFrame(P);
    return { top: HF.T(8, -14), chin: HF.J(30, 9) };
  };
  let prev = pts(0.15);
  for (let i = 1; i <= N; i++) {
    const t = 0.15 + (0.85 * i) / N;
    const cur = pts(t);
    const col = t > 0.7 ? PAL.cyan4 : PAL.cyan3;
    const alpha = 0.18 + 0.5 * t * t;
    fillPoly([prev.top, cur.top, cur.chin, prev.chin], (x, y) => ov.set(x, y, col, { alpha, emissive: Math.round(30 + 60 * t), onlyEmpty: true }));
    prev = cur;
  }
}
