// Test fixture of the rigkit core (A3 Y2): a small sand beast with a teal crystal crest and a
// violet cloth mantle, drawn ONLY with src/art/rigkit (no slice code). It exercises the whole core:
//   Raster ell / tube / facet / shard (lit + hand-toned "direct" materials) + render / despeckle;
//   composite with material-derived seams / creases (stepDown, seamFrom) and folds (IŞ-5);
//   edgePaint (IŞ-8), rimLight (IŞ-7), castShadow with shadeOf() (IŞ-6), cleanCrumbs + keep (IŞ-4);
//   stamp() of a MapPair (eye, lit per light: IŞ-2) and a ToneMap (collar plate, roles resolved
//   from a stone material); cloth planes / edgeRim / widenTeeth (the mantle); PartComp add / mark;
//   chain() (the tail), ik2 (legs); one glint (twinkle + glintSize);
//   passes: cracks + drain + split (crystal death), gather (revive) + gatherMotes, dissolve with
//   rising motes (the cloth mantle's death).
// The beast faces right (P2: drawn with the light from the frame's right; flipX mirrors it).
// Lives under src/dev/fixtures (A3 core review F5: game source — the ?dev=recipe preview — imports it,
// so it is dev source, not a test file); the rigkit tests import it from here.

import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { PartComp, castShadow, cleanCrumbs, composite, seamFrom, shadeOf, stepDown, type Fold, type StepTable } from '../../art/rigkit/composite';
import { edgePaint, glintSize, rimLight, twinkle } from '../../art/rigkit/edges';
import { add, chain, ik2, mul, norm, rnd, rotV, type V } from '../../art/rigkit/geom';
import type { Light } from '../../art/rigkit/light';
import { stamp, type MapPair, type ToneMap } from '../../art/rigkit/maps';
import { edgeRim, planes, run, widenTeeth } from '../../art/rigkit/cloth';
import { Raster, Workspace, materialTable, type RasterMat } from '../../art/rigkit/raster';
import { CellPartition, cracksOn, dissolvePass, drainLight, drainedAt, gatherBody, gatherMotes, splitBody, splitLine, type Crack, type CrackStyle } from '../../art/rigkit/passes';

export const FX_W = 64;
export const FX_H = 56;
/** ground contact (between the planted paws) */
export const FX_ANCHOR: readonly [number, number] = [31, 50];

export interface FxPose {
  /** body float, whole px (the torso, mantle, crest, neck and head ride it; the paws stay planted) */
  bob: number;
  /** torso tilt (rad; − = rears back) */
  lean: number;
  /** head offset from its rest place (px) and tilt (rad) */
  headX: number;
  headY: number;
  headA: number;
  /** 0 shut … 1 open (jaw), 0 shut … 1 open (eye) */
  jaw: number;
  eye: number;
  /** near fore paw offset (a step / a raised paw) */
  paw: readonly [number, number];
  /** tail wave phase (0…1, one cycle per loop) and amplitude (deg) */
  tail: number;
  tailAmp: number;
  /** the mantle: ripple phase (0…1) and hem lag (px) — nested on purpose (pose algebra fixture) */
  cape: { readonly t: number; readonly lag: number };
  /** crest glow 0…1 (≥ 0.75 lifts the shards one tone) */
  crest: number;
  /** glint size this frame: 0 none, 1 or 2 (IŞ-8: one glint per anim) */
  glint: number;
  /** passes: crack growth, light drained, split, gather (1 = whole), mantle erosion */
  cracks: number;
  drain: number;
  split: number;
  gather: number;
  diss: number;
  /** discrete: tucked in the guard (paws drawn in, crest folded) */
  guard: boolean;
}

export const FX_NEUTRAL: FxPose = Object.freeze({
  bob: 0,
  lean: 0,
  headX: 0,
  headY: 0,
  headA: 0,
  jaw: 0,
  eye: 1,
  paw: [0, 0] as const,
  tail: 0,
  tailAmp: 6,
  cape: { t: 0, lag: 0 },
  crest: 0.3,
  glint: 0,
  cracks: 0,
  drain: 0,
  split: 0,
  gather: 1,
  diss: 0,
  guard: false,
});

// ------------------------------------------------------------------ materials (fixture data)

const EARTH = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
const TEAL = [PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3, PAL.teal4, PAL.white] as const;
const VOID = [PAL.void0, PAL.void1, PAL.void2, PAL.void3, PAL.void4] as const;
const STONE = [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] as const;

/** A MaterialDef-shaped source (the core reads draw.ramp / th / seam / crease / rim structurally). */
const SAND = { draw: { ramp: EARTH, th: [-0.62, -0.28, 0.14, 0.56], seam: 'stepDown', crease: 'stepDown2', rim: PAL.cyan2 } } as const;
const STONE_DEF = { draw: { ramp: STONE, th: [], seam: 'stepDown', crease: 'stepDown2', rim: null } } as const;
const M = { HIDE: 0, FAR: 1, GLASS: 2, MOUTH: 3 } as const;
const TABLE = materialTable([
  SAND,
  { ramp: [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3], th: [-0.5, -0.05, 0.45] } satisfies RasterMat,
  { ramp: TEAL, th: [], direct: true } satisfies RasterMat,
  { ramp: [PAL.night0, PAL.night1, PAL.crim1], th: [0.3, 0.8] } satisfies RasterMat,
]);

// seams one step down, creases two (the darkest sand tone stays: no ink inside the body)
const SEAM = seamFrom({ ...stepDown(EARTH, 1, PAL.earth0), ...stepDown(TEAL.slice(0, 5), 1), ...stepDown(VOID, 1), ...stepDown(STONE, 1) });
const CREASE = seamFrom({ ...stepDown(EARTH, 2, PAL.earth0), ...stepDown(TEAL.slice(0, 5), 2), ...stepDown(VOID, 1) });
const FOLD_LEG: Fold = { top: 1, side: 2, bottom: 3 };
const FOLD_NECK: Fold = { top: 1, side: 1, bottom: 2 };

/** one value down every ramp: the drained light (the darkest sand stays) */
const DRAIN: StepTable = Object.freeze({ ...stepDown(EARTH, 1, PAL.earth0), ...stepDown(TEAL, 1, PAL.teal0), ...stepDown(VOID, 1, PAL.void0), ...stepDown(STONE, 1, PAL.stone1), [PAL.cyan2]: PAL.teal1 });
/** one value up: the lit lip of a crack */
const LIP: StepTable = Object.freeze(Object.fromEntries(EARTH.slice(0, 4).map((c, i) => [c, EARTH[i + 1]])));
const CRACK_SAND: CrackStyle = Object.freeze({ surface: new Set<number>([...EARTH, PAL.cyan2]), lit: PAL.teal3, dark: PAL.earth0, lip: LIP });
const SHARDS = Object.freeze({ lit: PAL.teal3, shadow: PAL.teal1, edge: PAL.white });

// ------------------------------------------------------------------ hand-painted maps

const EYE_KEY = Object.freeze({ k: PAL.ink, w: PAL.white, t: PAL.teal3, d: PAL.teal1 });
/** IŞ-2: the eye's glint sits on the side of the light, painted per light (not mirrored) */
const EYE_OPEN: MapPair = { left: { rows: ['kwt', 'ktd'], ox: -1, oy: -1 }, right: { rows: ['ktw', 'kdt'], ox: -1, oy: -1 } };
const EYE_SHUT: MapPair = { left: { rows: ['kkk'], ox: -1, oy: 0 }, right: { rows: ['kkk'], ox: -1, oy: 0 } };
/** the collar plate: roles resolved from the stone material (L lit, M mid, S shadow, K ink) */
const COLLAR: ToneMap = { rows: ['.LLM.', 'LMMSS', '.MSS.'], ox: -2, oy: -1, roles: { L: 'L', M: 'M', S: 'S', K: 'K' } };

// ------------------------------------------------------------------ parts

const PART = { far: 1, tail: 2, torso: 3, hind: 4, cape: 5, crest: 6, neck: 7, head: 8, fore: 9 } as const;
const CELLS = new CellPartition(FX_W, FX_H, 7);

/** A two-bone leg (ik2) with a paw; returns the knee. */
function leg(r: Raster, hip: V, foot: V, l1: number, l2: number, bend: number, mat: number, z: number): V {
  const knee = ik2(hip, foot, l1, l2, bend);
  r.tube([hip, knee], 6.4, 4.6, mat, { z });
  r.tube([knee, foot], 4.6, 3.6, mat, { z: z + 1 });
  r.ell(add(foot, [1, -0.4]), 3, 1.9, 0, mat, { z: z + 1, flat: 1.5 });
  return knee;
}

/** One frame of the beast. `ws` is the caller's workspace of FX_W × FX_H with TABLE (fixtureWorkspace()). */
export function drawFixture(p: PixelCanvas, P: FxPose, light: Light, ws: Workspace): void {
  ws.begin(light);
  const f = new PartComp(p);
  const keep = new Uint8Array(FX_W * FX_H);
  const bob = Math.round(P.bob);
  const C: V = [30, 32 + bob];
  const att = (o: V): V => add(C, rotV(o, P.lean));
  const core = att([8, 0]);
  const tuck = P.guard ? 1 : 0;

  // ---- far legs (one value darker), the tail
  {
    const r = ws.raster();
    leg(r, att([-8, 3]), [19, 48], 7.5, 7.5, -1, M.FAR, 0);
    leg(r, att([8, 3]), [37 - tuck, 48], 7, 7, 1, M.FAR, 0);
    const c = ws.render(r);
    composite(p, c);
    f.mark(c, PART.far);
  }
  {
    const r = ws.raster();
    const wave = (i: number) => P.tailAmp * Math.sin((P.tail + i * 0.16) * Math.PI * 2);
    const pts = chain(att([-11, -1]), [196 + wave(0), 212 + wave(1), 232 + wave(2), 252 + wave(3)], 4, { mid: bob * 0.5, tip: bob });
    r.tube(pts, 4.8, 1.8, M.HIDE, { z: -2 });
    const c = ws.render(r);
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    composite(p, c, SEAM);
    f.mark(c, PART.tail);
  }

  // ---- torso: haunch, barrel, chest; dark underside edge, cool rim
  // (the cracks live in the space of the visible parts: neck, head, near fore leg)
  const drained = (x: number, y: number) => drainedAt(core, P.drain, x, y);
  {
    const r = ws.raster();
    r.ell(C, 12, 7.6, P.lean, M.HIDE, { flat: 1.25 });
    r.ell(att([-7, 0]), 7, 6.8, P.lean, M.HIDE, { z: 0.6, flat: 1.25 });
    r.ell(att([7, -1]), 6.6, 6.8, P.lean, M.HIDE, { z: 0.6, flat: 1.25 });
    const c = ws.render(r);
    edgePaint(c, light, PAL.earth4, PAL.earth1, { lit: 0.6, only: (cur) => cur === PAL.earth3 || cur === PAL.earth2 });
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    composite(p, c, SEAM);
    f.mark(c, PART.torso);
  }

  // ---- near hind leg over the belly: the crease opens 1 / 2 / 3 px (IŞ-5)
  {
    const r = ws.raster();
    leg(r, att([-9, 4]), [23, 50], 7.5, 7.5, -1, M.HIDE, 0);
    const c = ws.render(r);
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    composite(p, c, CREASE, FOLD_LEG);
    f.mark(c, PART.hind);
  }

  // ---- the mantle: cloth bands measured from its edges, teeth ≥ 2 px, a turned edge
  {
    const q = ws.canvas();
    const lag = P.cape.lag;
    const rip = (k: number) => Math.round(Math.sin((P.cape.t + k * 0.25) * Math.PI * 2) * 0.9);
    const top0 = att([-10, -6]);
    const top1 = att([6, -7.5]);
    const hemY = 38 + bob;
    const poly: V[] = [top0, att([-2, -8.4]), top1, att([8, -4]), [32 + lag * 0.3, hemY - 3 + rip(0)], [28 + lag * 0.5, hemY + rip(1)], [25 + lag * 0.7, hemY - 2], [21 + lag, hemY + 1 + rip(2)], [17 + lag, hemY - 1], [15 + lag * 0.8, hemY - 6]];
    q.poly(poly, PAL.void2);
    widenTeeth(q, hemY - 4);
    const ls = light.side;
    const src = planes(q, (x, y, s) => {
      // the lit band: within 2 px of the edge facing up or toward the light; the hem's underside
      // turns away (one step down, in runs of 2+)
      const up = run(s, x, y, 0, -1, 2);
      const side = run(s, x, y, ls, 0, 3);
      const under = (xx: number) => s.isOpaque(xx, y) && !s.isOpaque(xx, y + 1);
      if (under(x) && (under(x - 1) || under(x + 1)) && y > hemY - 4) return PAL.void1;
      return up < 2 || side < 2 ? PAL.void3 : PAL.void2;
    });
    edgeRim(q, src, 'left', Math.ceil(top0[1]), hemY - 2, () => (light.from === 'left' ? PAL.void4 : PAL.void1));
    f.add(q, PART.cape, { out: PAL.earth1 });
  }

  // ---- the crest: two-tone crystal shards along the back (direct glass), the one glint
  const crestTips: [V, V, number, number][] = [
    [att([-6, -7.5]), norm(rotV([-0.45, -1], P.lean)), 6 - tuck, 2.1],
    [att([-1, -8.6]), norm(rotV([-0.25, -1], P.lean)), 8.5 - tuck * 2, 2.6],
    [att([4, -8]), norm(rotV([-0.05, -1], P.lean)), 6.5 - tuck, 2.2],
  ];
  {
    const r = ws.raster();
    for (const [b, d, len, hw] of crestTips) r.shard(b, d, len, hw, M.GLASS, 0, P.crest);
    const c = ws.render(r);
    composite(p, c, SEAM);
    f.mark(c, PART.crest);
  }

  // ---- neck with the collar plate (ToneMap: roles from the stone material, swapped for P2)
  const H0: V = [44 + P.headX, 21 + P.headY + bob];
  {
    const r = ws.raster();
    const n0 = att([8, -3]);
    const n1 = add(H0, [-1, 2]);
    r.tube([n0, add(lerpPt(n0, H0, 0.5), [0.5, 0.5]), n1], 8, 5.6, M.HIDE, { flat: 1.2 });
    const c = ws.render(r);
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    // the main fracture runs up the neck from the collar (it opens first)
    const neckCracks: Crack[] = [
      { from: 0, pts: [add(lerpPt(n0, n1, 0.25), [1, 1]), lerpPt(n0, n1, 0.55), add(lerpPt(n0, n1, 0.8), [-1, 0])] },
      { from: 0.2, pts: [lerpPt(n0, n1, 0.55), add(lerpPt(n0, n1, 0.62), [2.5, 0.5])] },
    ];
    if (P.cracks > 0) cracksOn(c, light, P.cracks, neckCracks, { style: CRACK_SAND, drained });
    stamp(c, COLLAR, rnd(att([10, -3])), light, STONE_DEF);
    composite(p, c, CREASE, FOLD_NECK);
    f.mark(c, PART.neck);
  }

  // ---- head: skull, muzzle, a glass ear, the jaw; the eye map (kept by the crumb pass)
  {
    const r = ws.raster();
    const hr = (o: V): V => add(H0, rotV(o, P.headA));
    r.ell(H0, 5.8, 4.5, P.headA - 0.12, M.HIDE, { flat: 1.3 });
    r.ell(hr([6, 1.4]), 4, 2.7, P.headA, M.HIDE, { z: 1, flat: 1.4 });
    r.shard(hr([-2.5, -3]), norm(rotV([-0.7, -1], P.headA)), 5, 1.7, M.GLASS, -1, P.crest);
    if (P.jaw > 0.05) {
      const j = P.jaw;
      r.facet([hr([1, 2.5]), hr([9.5, 2.5 + j * 1.5]), hr([8, 3.4 + j * 3]), hr([1, 4])], M.MOUTH, [0, 0.4, 1], 2);
      r.ell(hr([5, 4 + j * 2.6]), 4.4, 1.4, P.headA + 0.15 * j, M.HIDE, { z: 2.2, flat: 1.6 });
    }
    const c = ws.render(r);
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    if (P.cracks > 0) cracksOn(c, light, P.cracks, [{ from: 0.45, pts: [hr([-3, 0.5]), hr([0.5, 2.5]), hr([4, 1.5])] }], { style: CRACK_SAND, drained });
    const eyeAt = rnd(hr([1.5, -1.5]));
    const eye = P.eye >= 0.5 ? EYE_OPEN : EYE_SHUT;
    stamp(c, eye, eyeAt, light, undefined, { key: EYE_KEY });
    for (let y = -1; y <= 0; y++) for (let x = -1; x <= 1; x++) keep[(eyeAt[1] + y) * FX_W + eyeAt[0] + x] = 1;
    composite(p, c, SEAM);
    f.mark(c, PART.head);
  }

  // ---- near fore leg: casts its shadow on the chest behind it (IŞ-6), then the crease
  {
    const r = ws.raster();
    const hip = att([7, 4]);
    const knee = leg(r, hip, [41 + P.paw[0] - tuck * 2, 50 + P.paw[1]], 7, 7.2, 1, M.HIDE, 0);
    const c = ws.render(r);
    rimLight(c, p, light, { cols: [PAL.earth1, PAL.earth2] });
    if (P.cracks > 0) cracksOn(c, light, P.cracks, [{ from: 0.35, pts: [lerpPt(hip, knee, 0.3), lerpPt(hip, knee, 0.95)] }], { style: CRACK_SAND, drained });
    castShadow(p, c, light, { shade: shadeOf(SAND), off: [2, 1] });
    composite(p, c, CREASE, FOLD_LEG);
    f.mark(c, PART.fore);
  }

  // ---- finish: crumbs, the glint, the passes, the outline, the cloth's erosion, the revive motes
  cleanCrumbs(p, keep);
  if (P.glint > 0) {
    const [b, d, len] = crestTips[1];
    twinkle(p, rnd(add(b, mul(d, len * 0.42))), P.glint);
  }
  if (P.drain > 0) drainLight(p, core, P.drain, { table: DRAIN });
  if (P.split > 0) splitBody(p, splitLine(att([10, -4]), att([10, 2]), att([8, 6]), 60), P.split, ws.canvas());
  if (P.gather < 1) gatherBody(p, CELLS, core, P.gather, light, ws.canvas(), SHARDS);
  p.outline(PAL.ink);
  // the shadow erosion (part space: every part but the crystal crest, which stays whole)
  if (P.diss > 0) dissolvePass(f, { diss: P.diss, restOf: (part, x, y) => (part === PART.crest ? null : [x, y - bob]), top: 14, span: 38 });
  gatherMotes(p, add(core, [0, 4]), P.gather, { head: PAL.teal3, headBright: PAL.teal4, tail: PAL.teal1 });
}

function lerpPt(a: V, b: V, t: number): V {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/** The fixture's workspace (one per caller; the core holds no state). */
export function fixtureWorkspace(light: Light): Workspace {
  return new Workspace(FX_W, FX_H, light, TABLE);
}

/** The named poses the Y2 golden digests and the ×3 sheet use. */
export const FX_POSES: Readonly<Record<string, Partial<FxPose>>> = Object.freeze({
  idle0: {},
  breath: { bob: 1, lean: 0.03, tail: 0.25, cape: { t: 0.25, lag: 1 }, crest: 0.5, glint: 1 },
  reach: { lean: 0.07, headX: 3, headY: 2, headA: 0.1, jaw: 1, paw: [2, -3], tail: 0.5, tailAmp: 9, cape: { t: 0.5, lag: -2 }, crest: 1, glint: 2 },
  struck: { lean: -0.06, headX: -3, headY: -1, headA: -0.18, jaw: 0.3, eye: 0 },
  guard: { bob: 1, lean: 0.04, headX: -2, headY: 4, headA: 0.15, guard: true, crest: 0.2 },
  cracks: { lean: -0.04, headX: -2, headY: 1, eye: 0, cracks: 0.6, drain: 0.3, crest: 0.8 },
  drained: { bob: 2, lean: 0.05, headX: -1, headY: 5, headA: 0.25, eye: 0, cracks: 1, drain: 0.7, split: 0.5 },
  split: { bob: 3, lean: 0.08, headX: 0, headY: 7, headA: 0.35, eye: 0, cracks: 1, drain: 1, split: 1 },
  dissolve: { bob: 1, lean: 0.03, headY: 3, headA: 0.2, eye: 0, diss: 0.55 },
  gather: { bob: 2, headY: 4, eye: 0, gather: 0.55, crest: 0.6 },
});

export function fxPose(d: Partial<FxPose>): FxPose {
  return { ...FX_NEUTRAL, ...d, cape: { ...FX_NEUTRAL.cape, ...(d.cape ?? {}) } };
}
