// Taş Muhafız v3 (A3 pilot, Y8) — the PART PAINTERS (biped v1 slots, A3_MIMARI §3.3 PartPainter).
//
// Rigid stone parts are the hand maps of ./stone_sentinel-maps.ts moved by WHOLE pixels: each map
// follows one rig point of the plan's skeleton (helm → head, pauldrons → shoulders, chest plate →
// chest, courses → waist, belt / tassets → pelvis, sabatons → feet, shield → the far hand's prop)
// by round(point − its rest place), so the rest pose composes the approved still exactly and no
// hard part ever turns by a fraction of a pixel (REHBER IŞ-12). The near arm is the one part that
// swings through large angles (the dig, the heave, the throw): it is drawn as flat stone blocks
// along the rig's bones — upper arm, bracer, fist — with the still's three value planes per block
// (lit / turn / shadow by pixel counts, never a gradient), a lighter top face, a darker underside
// row and one stone4 edge on the bracer's flare.
//
// Creases (IŞ-5): a part lays its contact crease on what is behind it ("fringe"): the map's fringe
// letters, or the arm's cast shadow on the torso; at least one ramp step darker than the surface,
// and a pixel already creased this frame is only ever darkened to the explicit tone, never twice.
// Light (IŞ-9): the eye slit, the chest ᛉ and the shield Ψ are drawn after the outline in the 'glow'
// slot, only where their own carving is still in view (the part-id buffer).

import { PAL } from '../palette';
import { PixelCanvas } from '../pixel';
import type { BipedPart, BipedPose, BipedRig } from '../bodyplans/biped/v1';
import { BIPED_ORDER, bipedNeutral, bipedRig, bipedSlotOf } from '../bodyplans/biped/v1';
import type { PartCtx, PlanPose } from '../bodyplans/types';
import type { V } from '../rigkit/geom';
import type { Light } from '../rigkit/light';
import { BUILD, OX, OY, type SentinelFx } from './stone_sentinel-build';
import { FX_PARTS, setRockId } from './stone_sentinel-fx';
import { CRUMBLE_STONE, crumblePass, drawDebris, reassemblePass, type Debris } from '../rigkit/passes';
import { ABDOMEN, BELT, CHEST, FIST_HANG, FRINGE, HELM, KEY, LEG_F, LEG_N, PAULDRON_F, PAULDRON_N, RUNE, SHIELD, SLIT, SRUNE, TASSETS, type MapPair, type PartMap } from './stone_sentinel-maps';

export type Pose = PlanPose<BipedPose, SentinelFx>;
export type Ctx = PartCtx<Pose, BipedRig>;
export type Part = BipedPart<SentinelFx>;

// ------------------------------------------------------------------ rest skeleton, displacement

/** The rig of the rest pose: every part's displacement is measured from it. */
export const REST_RIG: BipedRig = bipedRig(BUILD, bipedNeutral(BUILD));

const disp = (p: V, rest: V): V => [Math.round(p[0] - rest[0]), Math.round(p[1] - rest[1])];

/** The whole-pixel displacement of each rigid part this frame (frame px). */
export interface Places {
  helm: V;
  pauldronN: V;
  pauldronF: V;
  chest: V;
  abdomen: V;
  belt: V;
  tassets: V;
  legN: V;
  legF: V;
  shield: V;
}

/**
 * The block of the assembly stack each rigid part belongs to, bottom-up (summon / revive: the column
 * of blocks rises loose and its joints close from the bottom up); the shield stands apart.
 */
const STACK: Readonly<Record<keyof Places, number>> = Object.freeze({ legN: 0, legF: 0, tassets: 1, belt: 1, abdomen: 2, chest: 3, pauldronN: 4, pauldronF: 4, helm: 5, shield: -1 });
/** The stack block the arms hang from (they come up with the chest). */
const ARM_BLOCK = 3;

/**
 * The open joint under each block of the loose column (px at gap 1): uneven like stones settling — 1 px
 * under the sabatons, the belt and the courses, 2 under the chest, the pauldrons and the helm — so the
 * whole column stands at most 9 px over its height (never a stretched, taller sentinel).
 */
const JOINT_GAP: readonly number[] = [1, 1, 1, 2, 2, 2];
/** px block `i` of the stack sits under its place this frame (− above it): the column's rise + its open joints from the lock up. */
export function stackDY(i: number, fx?: Readonly<SentinelFx>): number {
  if (!fx || i < 0) return 0;
  const lock = fx.lock ?? 6;
  let open = 0;
  for (let j = Math.max(0, lock); j <= i && j < JOINT_GAP.length; j++) open += JOINT_GAP[j];
  return Math.round((fx.rise ?? 0) - (fx.gap ?? 0) * open);
}
/** A loose block's sideways stagger (the column is not stacked true until it locks): the courses and the pauldrons. */
const WOBBLE: readonly number[] = [0, 0, 1, 0, -1, 0];
/** px block `i` of the stack sits off its column (x) while it is loose. */
export function stackDX(i: number, fx?: Readonly<SentinelFx>): number {
  if (!fx || i < 0 || i < (fx.lock ?? 6)) return 0;
  return Math.round((fx.wobble ?? 0) * WOBBLE[i]);
}
/** Is block `i` of the stack loose this frame (summon / revive)? */
export const looseBlock = (i: number, fx?: Readonly<SentinelFx>): boolean => !!fx && i >= 0 && i >= (fx.lock ?? 6) && (fx.gap ?? 0) > 0;

/** The arms' whole-pixel shift off the rig: the upper body's slide (x) and the chest block's place in the stack. */
export function armShift(fx?: Readonly<SentinelFx>): V {
  return [Math.round(fx?.upperX ?? 0) + stackDX(ARM_BLOCK, fx), stackDY(ARM_BLOCK, fx)];
}

export function placesOf(rig: BipedRig, fx?: Readonly<SentinelFx>): Places {
  const r = REST_RIG;
  const pelvis = disp(rig.pelvis, r.pelvis);
  const pn = disp(rig.shoulderN, r.shoulderN);
  const pf = disp(rig.shoulderF, r.shoulderF);
  const ux = Math.round(fx?.upperX ?? 0);
  const hd = disp(rig.head, r.head);
  const ch = disp(rig.chest, r.chest);
  const ab = disp(rig.waist, r.waist);
  const sd = (k: keyof Places) => stackDY(STACK[k], fx);
  const sx = (k: keyof Places) => stackDX(STACK[k], fx);
  return {
    helm: [hd[0] + ux + sx('helm'), hd[1] + sd('helm')],
    pauldronN: [pn[0] + ux + Math.round(fx?.padNX ?? 0) + sx('pauldronN'), pn[1] + Math.round(fx?.padN ?? 0) + sd('pauldronN')],
    pauldronF: [pf[0] + ux + Math.round(fx?.padFX ?? 0) + sx('pauldronF'), pf[1] + Math.round(fx?.padF ?? 0) + sd('pauldronF')],
    chest: [ch[0] + ux + sx('chest'), ch[1] + sd('chest')],
    abdomen: [ab[0] + sx('abdomen'), ab[1] + Math.round(fx?.courseY ?? 0) + sd('abdomen')],
    belt: [pelvis[0] + sx('belt'), pelvis[1] + sd('belt')],
    tassets: [pelvis[0] + sx('tassets'), pelvis[1] + sd('tassets')],
    legN: ((d) => [d[0] + sx('legN'), d[1] + sd('legN')] as V)(disp(rig.footN, r.footN)),
    legF: ((d) => [d[0] + sx('legF'), d[1] + sd('legF')] as V)(disp(rig.footF, r.footF)),
    shield: rig.props.shield ? disp(rig.props.shield.at, r.props.shield!.at) : [0, 0],
  };
}

// ------------------------------------------------------------------ tones

const STONE = [PAL.stone0, PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4] as const;
const LEAF = [PAL.leaf0, PAL.leaf1, PAL.leaf2, PAL.leaf3, PAL.leaf4] as const;
const EARTH = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3, PAL.earth4] as const;
const RAMPS: readonly (readonly number[])[] = [STONE, LEAF, EARTH];

function rampOf(c: number): { ramp: readonly number[]; i: number } | null {
  for (const ramp of RAMPS) {
    const i = ramp.indexOf(c);
    if (i >= 0) return { ramp, i };
  }
  return null;
}
/** One step down its own ramp (unknown colours stay). */
export function stepDown(c: number, k = 1): number {
  const r = rampOf(c);
  return r ? r.ramp[Math.max(0, r.i - k)] : c;
}
/** k steps up its own ramp. */
export function stepUp(c: number, k = 1): number {
  const r = rampOf(c);
  return r ? r.ramp[Math.min(r.ramp.length - 1, r.i + k)] : c;
}

// ------------------------------------------------------------------ fringes (creases on what is behind)

const SHADED = new WeakMap<PixelCanvas, Uint8Array>();

/** A map's crease pixel (IŞ-5): the explicit tone, only where it darkens what is already there (same ramp). */
export function fringe(dst: PixelCanvas, x: number, y: number, tone: number): void {
  if (!dst.isOpaque(x, y)) return;
  const under = dst.get(x, y)!;
  const ru = rampOf(under);
  const re = rampOf(tone);
  if (ru && re && ru.ramp === re.ramp && re.i < ru.i) dst.set(x, y, tone);
  else if (ru && re && ru.ramp !== re.ramp && ru.i > 0) dst.set(x, y, ru.ramp[ru.i - 1]); // moss under a stone crease: one step down
}

/**
 * A cast shadow pixel (IŞ-6): `k` ramp steps down, once per frame per pixel (two shadows never stack).
 * Stone only: a moss cap keeps its own shading (a shadow clipped to a cap's ragged edge leaves lone
 * leaf0 pixels).
 */
export function shade(dst: PixelCanvas, x: number, y: number, k: number): void {
  if (!dst.isOpaque(x, y)) return;
  const under = dst.get(x, y)!;
  if (under === PAL.ink || LEAF.includes(under as (typeof LEAF)[number])) return;
  let mask = SHADED.get(dst);
  if (!mask) {
    mask = new Uint8Array(dst.w * dst.h);
    SHADED.set(dst, mask);
  }
  const i = y * dst.w + x;
  if (mask[i]) return;
  mask[i] = 1;
  dst.set(x, y, stepDown(under, k));
}

// ------------------------------------------------------------------ maps

export const mapOf = (m: MapPair, light: Light): PartMap => (light.from === 'right' ? m.right : m.left);

/**
 * Stamp a rigid map displaced by d (frame px): its fringe letters crease the frame under it, its own
 * pixels go to the returned layer. `clipY`: rows below it are not drawn (a shield driven into the floor).
 */
const MOSS = new Set(['e', 'f', 'g', 'h']);

export function stampMap(ctx: Ctx, m: MapPair, d: V, clipY = Infinity, mossY = 0, shear?: (row: number) => number): PixelCanvas {
  const map = mapOf(m, ctx.light);
  const layer = ctx.canvas();
  const X0 = map.x + OX + d[0];
  const y0 = map.y + OY + d[1];
  const moss: number[] = [];
  for (let j = 0; j < map.rows.length; j++) {
    const row = map.rows[j];
    const y = y0 + j;
    if (y > clipY) break;
    const x0 = X0 + (shear ? shear(j) : 0);
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.') continue;
      const f = FRINGE[ch];
      if (f !== undefined) fringe(ctx.dst, x0 + i, y, f);
      else {
        const c = KEY[ch];
        if (c === undefined) continue;
        if (mossY !== 0 && MOSS.has(ch)) {
          moss.push(x0 + i, y + mossY, c);
          // a cap lifted off its block bares the stone under its foot (the block's top tone below it)
          const below = map.rows[j + 1]?.[i];
          if (mossY < 0 && below !== undefined && !MOSS.has(below) && KEY[below] !== undefined) layer.set(x0 + i, y, KEY[below]);
        } else layer.set(x0 + i, y, c);
      }
    }
  }
  for (let k = 0; k < moss.length; k += 3) if (moss[k + 1] <= clipY) layer.set(moss[k], moss[k + 1], moss[k + 2]);
  return layer;
}

/**
 * A block that has broken off the stack (the death's helm tumbling off in front, a pauldron slid off
 * its shoulder) lies over parts of the same stone value: it gets the ink separation IŞ-9 allows for
 * exactly that (two parts of one value that would merge) — on what is behind it, never on itself.
 */
function detached(key: keyof Places, pose: Pose): boolean {
  if (key === 'helm') return pose.slots?.helm === 'head.front';
  if (key === 'pauldronN') return (pose.fx.padN ?? 0) >= 6;
  if (key === 'pauldronF') return (pose.fx.padF ?? 0) >= 6;
  return false;
}

function separate(dst: PixelCanvas, q: PixelCanvas): void {
  const hits: number[] = [];
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = x + dx;
        const ty = y + dy;
        if (!q.isOpaque(tx, ty) && dst.isOpaque(tx, ty)) hits.push(tx, ty);
      }
    }
  for (let i = 0; i < hits.length; i += 2) dst.set(hits[i], hits[i + 1], PAL.ink);
}

/** Erase what a limb drew under the ground line (the summon's column comes up out of the floor). */
function clipBelow(q: PixelCanvas, ground: number): void {
  for (let y = ground + 1; y < q.h; y++) for (let x = 0; x < q.w; x++) if (q.isOpaque(x, y)) q.erase(x, y);
}

/**
 * The shield's lean (fx.tilt, the throw's counterweight): px row `j` of the slab's map (0 = its top rim)
 * steps out past the foot — whole-pixel row offsets, never a fractional turn (IŞ-12).
 */
export function shieldShear(tilt: number): ((row: number) => number) | undefined {
  const t = Math.round(tilt ?? 0);
  if (!t) return undefined;
  const H = SHIELD.left.rows.length;
  return (j) => Math.round((t * (H - 1 - j)) / (H - 1));
}

// every rigid part is clipped at the ground line: the shield stands planted in the floor, and the
// summon's blocks come up out of it
const rigid = (layer: string, map: MapPair, key: keyof Places): Part => ({
  layer,
  seam: 'none',
  paint: (ctx) => {
    const q = stampMap(ctx, map, placesOf(ctx.rig, ctx.pose.fx)[key], ctx.rig.ground, Math.round(ctx.pose.fx.mossY ?? 0), key === 'shield' ? shieldShear(ctx.pose.fx.tilt) : undefined);
    if (detached(key, ctx.pose)) separate(ctx.dst, q);
    return q;
  },
});

// ------------------------------------------------------------------ stone blocks (the arm)

export interface BlockOpts {
  /** width (px) across the bone at a and at b (linear), unless `profile` is given */
  readonly w: readonly [number, number];
  /** widths along the bone (sampled at t = 0…1 from a): a shape profile (a bulge, a flared cuff) */
  readonly profile?: readonly number[];
  /** screen-space offset of the block's axis from the bone (px; light-independent: P1 and P2 share the silhouette) */
  readonly off?: V;
  /** extend past a / b along the bone (px; negative = start inside) */
  readonly cap?: readonly [number, number];
  /** a bone within this many degrees of vertical / horizontal is drawn as an upright / level block (no 1-px staircase) */
  readonly snap?: number;
  /** steep blocks: the left edge stays one straight line and only the right edge follows the width (a taper on one side) */
  readonly keepLeft?: boolean;
  /** with keepLeft: px the left edge is pushed in along the bone (sampled like `profile`) */
  readonly inset?: readonly number[];
  /** shares of the width banded lit / shadow (the turn takes the rest); default 0.4 / 0.28 */
  readonly bands?: readonly [lit: number, shadow: number];
  /** rows of a lighter top face at the block's upper end (steep blocks) */
  readonly top?: number;
  /** rows of a darker underside at the block's lower end (steep blocks) */
  readonly under?: number;
  /** the lit edge pixel turns stone4 between these fractions of the block's length (0 = a) */
  readonly edge4?: readonly [number, number];
  /** plane tone shift: −1 = one value darker (the far arm) */
  readonly shift?: number;
  /**
   * 2: a bone outside the `snap` window is drawn as a 45° block whose long edges step 2 px every 2
   * rows (stacked courses), banded per row from the face that looks at the light — never the 1-px
   * per-row drift of an arbitrary angle (it reads as a smooth tube). Absent: the drifting block (the
   * far arm, the fingers).
   */
  readonly stairs?: 2;
}

const DEG = Math.PI / 180;

/**
 * A stone block along the bone a→b as flat value planes (IŞ-3): rows (steep bone) or columns (flat
 * bone) are filled across the block and banded by pixel counts from the lit side (lit / turn /
 * shadow), never a gradient. Steep: the lit side is the light's (P1 left, P2 right); flat: the top.
 * The geometry never depends on the light (P1 and P2 share the silhouette); only the bands do.
 */
export function block(q: PixelCanvas, a: V, b: V, light: Light, o: BlockOpts): void {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const steep = Math.abs(dy) >= Math.abs(dx);
  const [c0, c1] = o.cap ?? [0, 0];
  const shift = o.shift ?? 0;
  const [fl, fs] = o.bands ?? [0.4, 0.28];
  const tone = (k: number) => STONE[Math.max(0, Math.min(4, k + shift))];
  const off = o.off ?? [0, 0];
  const A: V = [a[0] - ux * c0 + off[0], a[1] - uy * c0 + off[1]];
  const B: V = [b[0] + ux * c1 + off[0], b[1] + uy * c1 + off[1]];
  const snap = (o.snap ?? 0) * DEG;
  const lean = steep ? Math.atan2(Math.abs(dx), Math.abs(dy)) : Math.atan2(Math.abs(dy), Math.abs(dx));
  const snapped = lean <= snap;
  const widthAt = (t: number) => {
    if (o.profile) return o.profile[Math.max(0, Math.min(o.profile.length - 1, Math.floor(t * o.profile.length)))];
    return o.w[0] + (o.w[1] - o.w[0]) * t;
  };
  const bandsOf = (n: number) => ({ nl: Math.round(fl * n), ns: Math.max(1, Math.round(fs * n)) });
  if (!snapped && o.stairs === 2) {
    diagBlock(q, A, B, light, o, widthAt, tone);
    return;
  }
  if (steep) {
    const yTop = Math.min(A[1], B[1]);
    const yBot = Math.max(A[1], B[1]);
    const y0 = Math.round(yTop);
    const y1 = Math.round(yBot) - 1;
    const cosA = snapped ? 1 : Math.abs(B[1] - A[1]) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1);
    const midX = (A[0] + B[0]) / 2;
    const left0 = (snapped ? midX : A[0]) - widthAt(0) / cosA / 2;
    for (let y = y0; y <= y1; y++) {
      const ta = Math.max(0, Math.min(1, (y + 0.5 - A[1]) / (B[1] - A[1] || 1))); // 0 at a
      const cx = snapped ? midX : A[0] + (B[0] - A[0]) * ta;
      const w = widthAt(ta) / Math.max(0.5, cosA);
      const ins = o.inset ? o.inset[Math.max(0, Math.min(o.inset.length - 1, Math.floor(ta * o.inset.length)))] : 0;
      const xl = o.keepLeft ? Math.round(left0 + (cx - (snapped ? midX : A[0]))) + ins : Math.round(cx - w / 2);
      const xr = o.keepLeft ? xl + Math.round(w) - 1 : Math.round(cx + w / 2) - 1;
      const n = xr - xl + 1;
      if (n <= 0) continue;
      const { nl, ns } = bandsOf(n);
      const fromTop = y - y0;
      const fromBot = y1 - y;
      for (let x = xl; x <= xr; x++) {
        const k = light.side < 0 ? x - xl : xr - x; // px from the lit side
        let band = k < nl ? 3 : k >= n - ns ? 1 : 2;
        const isTop = o.top !== undefined && fromTop < o.top;
        if (isTop) band += 1;
        else if (o.under && fromBot < o.under) band = band === 3 ? 2 : 1;
        if (o.edge4 && k === 0 && ta >= o.edge4[0] && ta <= o.edge4[1] && !isTop) band = 4;
        q.set(x, y, tone(band));
      }
    }
  } else {
    const xLeft = Math.min(A[0], B[0]);
    const xRight = Math.max(A[0], B[0]);
    const x0 = Math.round(xLeft);
    const x1 = Math.round(xRight) - 1;
    const cosA = snapped ? 1 : Math.abs(B[0] - A[0]) / (Math.hypot(B[0] - A[0], B[1] - A[1]) || 1);
    const midY = (A[1] + B[1]) / 2;
    for (let x = x0; x <= x1; x++) {
      const ta = Math.max(0, Math.min(1, (x + 0.5 - A[0]) / (B[0] - A[0] || 1)));
      const cy = snapped ? midY : A[1] + (B[1] - A[1]) * ta;
      const w = widthAt(ta) / Math.max(0.5, cosA);
      const yt = Math.round(cy - w / 2);
      const yb = Math.round(cy + w / 2) - 1;
      const n = yb - yt + 1;
      if (n <= 0) continue;
      const { nl, ns } = bandsOf(n);
      for (let y = yt; y <= yb; y++) {
        const k = y - yt;
        let band = k < nl ? 3 : k >= n - ns ? 1 : 2;
        if (o.edge4 && k === 0 && ta >= o.edge4[0] && ta <= o.edge4[1]) band = 4;
        q.set(x, y, tone(band));
      }
    }
  }
}

/**
 * A 45° stone block A → B (the bone snapped to the nearest diagonal): rows in pairs, each pair 2 px on
 * from the last, so the long edges are 2-px stairs; every row is banded from the face that looks at
 * the light (the normal of the diagonal closer to the light's screen direction): lit ≥ 2 px, turn,
 * shadow. The upper end's row is the lighter top face (`top`), the lower end's the darker underside
 * (`under`); `edge4` puts stone4 on the lit edge.
 */
function diagBlock(q: PixelCanvas, A: V, B: V, light: Light, o: BlockOpts, widthAt: (t: number) => number, tone: (k: number) => number): void {
  const sx = B[0] >= A[0] ? 1 : -1;
  const sy = B[1] >= A[1] ? 1 : -1;
  const rows = Math.max(2, Math.round(Math.hypot(B[0] - A[0], B[1] - A[1]) / Math.SQRT2));
  const n: V = [-sy, sx];
  const litRight = (n[0] * light.v2[0] + n[1] * light.v2[1] >= 0 ? n[0] : -n[0]) > 0;
  const [fl, fs] = o.bands ?? [0.4, 0.28];
  const x0 = Math.round(A[0]);
  const y0 = Math.round(A[1]);
  for (let k = 0; k < rows; k++) {
    const t = (k + 0.5) / rows;
    const span = Math.max(3, Math.round(widthAt(t) * Math.SQRT2));
    const cx = x0 + sx * 2 * Math.floor(k / 2);
    const y = y0 + sy * k;
    const xl = Math.round(cx - span / 2);
    const xr = xl + span - 1;
    const nl = Math.max(2, Math.round(fl * span));
    const ns = Math.max(1, Math.round(fs * span));
    const upperEnd = sy < 0 ? k === rows - 1 : k === 0;
    const lowerEnd = sy < 0 ? k === 0 : k === rows - 1;
    for (let x = xl; x <= xr; x++) {
      const kk = litRight ? xr - x : x - xl; // px from the lit face
      let band = kk < nl ? 3 : kk >= span - ns ? 1 : 2;
      if (o.top !== undefined && upperEnd) band = Math.min(4, band + 1);
      else if (o.under && lowerEnd) band = band >= 2 ? band - 1 : 1;
      if (o.edge4 && kk === 0 && t >= o.edge4[0] && t <= o.edge4[1] && !(o.top !== undefined && upperEnd)) band = 4;
      q.set(x, y, tone(band));
    }
  }
}

/**
 * Lay `top` over `under` with the crease IŞ-5 asks for where a block overlaps the one behind it: the
 * pixels of `under` right next to `top` (4-neighbours) two ramp steps down on a lit plane, one on the
 * turn and the shadow (stone0 at the bottom); `under` keeps the result (`top` is blitted onto it).
 */
function overWithCrease(under: PixelCanvas, top: PixelCanvas): void {
  const hits: number[] = [];
  for (let y = 0; y < top.h; y++)
    for (let x = 0; x < top.w; x++) {
      if (!top.isOpaque(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = x + dx;
        const ty = y + dy;
        if (!top.isOpaque(tx, ty) && under.isOpaque(tx, ty)) hits.push(tx, ty);
      }
    }
  const done = new Set<number>();
  for (let i = 0; i < hits.length; i += 2) {
    const k = hits[i + 1] * under.w + hits[i];
    if (done.has(k)) continue;
    done.add(k);
    const c = under.get(hits[i], hits[i + 1])!;
    const s = STONE.indexOf(c as (typeof STONE)[number]);
    if (s >= 0) under.set(hits[i], hits[i + 1], STONE[Math.max(0, s >= 3 ? s - 2 : s - 1)]);
  }
  under.blit(top, 0, 0);
}

/**
 * The arm's cast shadow (IŞ-6) on the body right behind it: up to `px` pixels away from the light in
 * the same row, over pixels already there and only across a continuous surface (a gap ends it).
 */
function castOnBody(ctx: Ctx, layer: PixelCanvas, px: number, k: number): void {
  const dst = ctx.dst;
  const dir = -ctx.light.side; // away from the light
  const hits: number[] = [];
  for (let y = 0; y < layer.h; y++)
    for (let x = 0; x < layer.w; x++) {
      if (!layer.isOpaque(x, y)) continue;
      for (let k = 1; k <= px; k++) {
        const tx = x + dir * k;
        if (layer.isOpaque(tx, y) || !dst.isOpaque(tx, y)) break;
        hits.push(tx, y);
      }
    }
  for (let i = 0; i < hits.length; i += 2) shade(dst, hits[i], hits[i + 1], k);
}

// ------------------------------------------------------------------ the near arm

const v1 = (x: number, y: number): V => [x + OX, y + OY];
/** The hanging fist's map is placed by floor(hand) + this (v1: hand (13, 47.5) → origin (9, 44)). */
const FIST_AT: V = [9 - 13, 44 - 47];
/** Width profiles along the bones (the still's arm): the upper arm bulges under the pauldron, the bracer flares. */
const UPPER_ARM: readonly number[] = [7, 6, 7, 8, 7, 6, 6, 6];
const UPPER_INSET: readonly number[] = [0, 1, 1, 0, 0, 0, 0, 0];
const BRACER: readonly number[] = [8, 8, 10, 10, 10];

const DEG90 = Math.PI / 2;
/**
 * The fist thrust up (7 × 7, stone ramp digits; P1 lit from the top-left): three knuckles notched
 * into the silhouette, the creases between the curled fingers running down from the notches, the
 * thumb's lit edge across them, the wrist in shadow.
 * The mask is symmetric, so P2 is the tones mirrored.
 */
const FIST_UP: readonly string[] = ['.4.4.3.', '4414132', '3313121', '3313121', '2444321', '2333211', '.21111.'];
const FIST_UP_P2: readonly string[] = FIST_UP.map((r) => [...r].reverse().join(''));
/** Angle (rad) of a bone from straight down (0 = hanging, π = raised overhead). */
const fromDown = (a: V, b: V) => Math.abs(Math.atan2(b[0] - a[0], b[1] - a[1]));

/** The fist / open hand at the end of the forearm (el → hand), drawn into q. */
function handPart(q: PixelCanvas, ctx: Ctx, el: V, hand: V): void {
  const light = ctx.light;
  const grip = ctx.pose.armN.grip;
  const dx = hand[0] - el[0];
  const dy = hand[1] - el[1];
  const L = Math.hypot(dx, dy) || 1;
  const u: V = [dx / L, dy / L];
  if (grip === 'fist' && fromDown(el, hand) <= (AXIS_SNAP * Math.PI) / 180) {
    // hanging under the bracer: the still's fist
    const fist = mapOf(FIST_HANG, light);
    const fx = Math.floor(hand[0]) + FIST_AT[0];
    const fy = Math.floor(hand[1]) + FIST_AT[1] + Math.round(ctx.pose.fx.fistY);
    for (let j = 0; j < fist.rows.length; j++)
      for (let i = 0; i < fist.rows[j].length; i++) {
        const c = KEY[fist.rows[j][i]];
        if (c !== undefined) q.set(fx + i, fy + j, c);
      }
    return;
  }
  if (grip === 'fist' && Math.PI - fromDown(el, hand) <= 25 * (Math.PI / 180)) {
    // a fist thrust up (roar): the knuckles on top, three finger creases, the thumb across the front
    const rows = light.from === 'right' ? FIST_UP_P2 : FIST_UP;
    const fx = Math.round(hand[0]) - 3;
    const fy = Math.round(hand[1]) - 5;
    for (let j = 0; j < rows.length; j++)
      for (let i = 0; i < rows[j].length; i++) {
        const c = KEY[rows[j][i]];
        if (c !== undefined) q.set(fx + i, fy + j, c);
      }
    return;
  }
  if (grip === 'open') {
    // the palm, then three stone fingers splayed along the throw and the thumb on the upper side
    block(q, [hand[0] - u[0] * 2, hand[1] - u[1] * 2], [hand[0] + u[0] * 2, hand[1] + u[1] * 2], light, { w: [6, 6], snap: 15 });
    const n: V = [-u[1], u[0]];
    const up = n[1] < 0 ? n : ([-n[0], -n[1]] as V); // the normal pointing up
    for (const k of [-1, 0, 1]) {
      const spread = 0.42 * k;
      const d: V = [u[0] * Math.cos(spread) - u[1] * Math.sin(spread), u[0] * Math.sin(spread) + u[1] * Math.cos(spread)];
      const base: V = [hand[0] + u[0] * 1.5 + up[0] * k * 1.2, hand[1] + u[1] * 1.5 + up[1] * k * 1.2];
      block(q, base, [base[0] + d[0] * 4.5, base[1] + d[1] * 4.5], light, { w: [2.4, 2], snap: 10 });
    }
    const tb: V = [hand[0] + up[0] * 2.5, hand[1] + up[1] * 2.5];
    block(q, tb, [tb[0] + up[0] * 1.5 + u[0] * 2, tb[1] + up[1] * 1.5 + u[1] * 2], light, { w: [2.4, 2], snap: 10 });
    return;
  }
  // a stone fist at the end of the forearm (forward, raised or gripping): the forearm's block continued
  const steepDown = Math.abs(dy) >= Math.abs(dx) && dy > 0;
  const steepUp = Math.abs(dy) >= Math.abs(dx) && dy < 0;
  block(q, [hand[0] - u[0] * 3, hand[1] - u[1] * 3], [hand[0] + u[0] * 3.5, hand[1] + u[1] * 3.5], light, {
    w: [7, 7],
    snap: 15,
    ...(steepDown ? { under: 1 } : {}),
    ...(steepUp ? { top: 1 } : {}),
  });
}

/** Bones within this angle of hanging are the still's arm exactly (the idle and every near-rest pose). */
const STILL_HANG = 15 * (Math.PI / 180);
/** Bones within this angle of an axis are upright / level whole-pixel blocks (the masonry swings by block offsets). */
const AXIS_SNAP = 30;

function nearArm(ctx: Ctx): PixelCanvas {
  const rig = ctx.rig;
  const light = ctx.light;
  const [ux, uy] = armShift(ctx.pose.fx);
  const sh: V = [rig.armN.root[0] + ux, rig.armN.root[1] + uy];
  const el: V = [rig.armN.mid[0] + ux, rig.armN.mid[1] + uy];
  const hand: V = [rig.armN.end[0] + ux, rig.armN.end[1] + uy];
  const aU = fromDown(sh, el);
  const aF = fromDown(el, hand);
  const fa: V = [el[0] + (hand[0] - el[0]) * 0.08, el[1] + (hand[1] - el[1]) * 0.08];
  const fb: V = [el[0] + (hand[0] - el[0]) * 0.68, el[1] + (hand[1] - el[1]) * 0.68];
  let q: PixelCanvas;
  if (aU <= STILL_HANG && aF <= STILL_HANG) {
    // the still's arm: upper arm from under the pauldron (a straight lit side, a bulge, the elbow turning
    // under one value darker), the fist, the bracer over its top (stone4 top face and flared lit edge)
    q = ctx.canvas();
    block(q, sh, el, light, { w: [7, 6], profile: UPPER_ARM, inset: UPPER_INSET, off: [0.77, 0], cap: [0, 0.65], snap: 15, keepLeft: true, under: 1 });
    handPart(q, ctx, el, hand);
    block(q, fa, fb, light, { w: [8, 10], profile: BRACER, off: [1.2, 0], snap: 15, bands: [0.5, 0.28], top: 1, edge4: [0.4, 1] });
  } else {
    // a moved arm: three stone blocks placed by whole pixels — the upper arm, the fist, the bracer — each
    // upright, level (within 30° of an axis) or a 45° block in 2-px stairs; the forearm laid over the
    // upper arm with a crease at the elbow (IŞ-5), never one bent tube
    q = ctx.canvas();
    const qf = ctx.canvas();
    const downU = aU <= (AXIS_SNAP * Math.PI) / 180;
    const upU = Math.PI - aU <= (AXIS_SNAP * Math.PI) / 180;
    block(q, sh, el, light, downU
      ? { w: [7, 6], profile: UPPER_ARM, inset: UPPER_INSET, off: [0.77, 0], cap: [0, 0.65], snap: AXIS_SNAP, keepLeft: true, under: 1 }
      : { w: [7, 6.5], cap: [0.5, 2], snap: AXIS_SNAP, stairs: 2, ...(upU ? { top: 1 } : el[1] > sh[1] ? { under: 1 } : {}) });
    handPart(qf, ctx, el, hand);
    const downF = aF <= (AXIS_SNAP * Math.PI) / 180;
    const steepUp = Math.abs(hand[1] - el[1]) >= Math.abs(hand[0] - el[0]) && el[1] > hand[1];
    block(qf, fa, fb, light, downF
      ? { w: [8, 10], profile: BRACER, off: [1.2, 0], snap: AXIS_SNAP, bands: [0.5, 0.28], top: 1, edge4: [0.4, 1] }
      : { w: [8, 10], profile: BRACER, snap: AXIS_SNAP, stairs: 2, bands: [0.5, 0.28], ...(steepUp ? {} : { top: 1 }), edge4: [0.4, 1] });
    overWithCrease(q, qf);
  }
  clipBelow(q, rig.ground);
  castOnBody(ctx, q, 2, 2);
  // a raised or swung arm crosses the body: a 1-px crease all round it on the stone behind
  if (aU > STILL_HANG) creaseAround(ctx, q);
  return q;
}
void DEG90;

/**
 * IŞ-5 for a limb in front of the body: the stone right next to it one ramp step darker (once). Moss is
 * left alone (a crease on a soft cap reads as lone dark-green pixels).
 */
function creaseAround(ctx: Ctx, q: PixelCanvas): void {
  const dst = ctx.dst;
  const hits: number[] = [];
  for (let y = 0; y < q.h; y++)
    for (let x = 0; x < q.w; x++) {
      if (!q.isOpaque(x, y)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const tx = x + dx;
        const ty = y + dy;
        if (!q.isOpaque(tx, ty) && dst.isOpaque(tx, ty) && STONE.includes(dst.get(tx, ty) as (typeof STONE)[number])) hits.push(tx, ty);
      }
    }
  for (let i = 0; i < hits.length; i += 2) shade(dst, hits[i], hits[i + 1], 1);
}

// ------------------------------------------------------------------ the far arm (behind everything)

function farArm(ctx: Ctx): PixelCanvas {
  const rig = ctx.rig;
  const q = ctx.canvas();
  const [ux, uy] = armShift(ctx.pose.fx);
  const at = (v: V): V => [v[0] + ux, v[1] + uy];
  // the far hand is not carried by the upper body's slide: it holds on at the planted shield
  block(q, at(rig.armF.root), at(rig.armF.mid), ctx.light, { w: [6, 5], off: [-3, 0], cap: [-2, 0.5], snap: 12, shift: -1 });
  block(q, at(rig.armF.mid), [rig.armF.end[0], rig.armF.end[1] + uy], ctx.light, { w: [6, 6], off: [-1, 0], cap: [0.5, 1], snap: 12, shift: -1 });
  clipBelow(q, rig.ground);
  return q;
}

// ------------------------------------------------------------------ light (after the outline)

/** The spell's flare (hitMagic): the hottest cells of the eye slit, the ᛉ and the Ψ burn white. */
const flared = (tone: number | null, flare: number, hot: boolean): number | null => (tone !== null && flare > 0 && (hot || flare >= 0.6) ? (hot && flare >= 0.35 ? PAL.white : PAL.gold4) : tone);

function glowTone(v: number): number | null {
  if (v >= 1.75) return PAL.gold4;
  if (v >= 0.9) return PAL.gold3;
  if (v >= 0.45) return PAL.gold2;
  if (v >= 0.2) return PAL.gold1;
  return null;
}

/** Part index of a part name in the member's parts (1-based, as planArt marks the part-id buffer). */
let PART_INDEX: Readonly<Record<string, number>> = {};
export function setPartIndex(names: readonly string[]): void {
  PART_INDEX = Object.freeze(Object.fromEntries(names.map((n, i) => [n, i + 1])));
}

function glow(ctx: Ctx): PixelCanvas | null {
  const p = ctx.dst;
  const fx = ctx.pose.fx;
  const pl = placesOf(ctx.rig, fx);
  const own = (x: number, y: number, part: string) => ctx.comp.owner(x, y) === PART_INDEX[part];
  // eye slit
  for (const [x, y, w] of SLIT) {
    const t = flared(glowTone(fx.slit * w), fx.flare, w >= 2);
    const X = x + OX + pl.helm[0];
    const Y = y + OY + pl.helm[1];
    if (t !== null && own(X, Y, 'helm')) p.set(X, Y, t);
  }
  // the eye's glint (≤ 1 per anim, IŞ-8): at the slit's hot front end
  if (fx.glint > 0) {
    const X = 35 + OX + pl.helm[0] + (ctx.light.side < 0 ? 2 : 2);
    const Y = 20 + OY + pl.helm[1];
    p.set(X, Y, PAL.gold4);
    // a blazing slit's front cell steps down a tone under the glint, so the 1-px glint reads apart from
    // the slit as the cross's centre does (that cell is the cross's left arm: 1 px → cross → 1 px on one pixel)
    if (p.get(X - 1, Y) === PAL.gold4) p.set(X - 1, Y, PAL.gold3);
    if (fx.glint >= 2) {
      p.set(X - 1, Y, PAL.gold3).set(X + 1, Y, PAL.gold3).set(X, Y - 1, PAL.gold3).set(X, Y + 1, PAL.gold3);
    }
  }
  // a dead ᛉ (its light out: death, the summon / revive before it kindles) is a flat dark recess — the
  // 1-px grooves alternating with the floor would read as a checker
  if (glowTone(fx.rune) === null && !(fx.flare > 0))
    for (let y = 28; y <= 32; y++)
      for (let x = 31; x <= 35; x++) {
        const X = x + OX + pl.chest[0];
        const Y = y + OY + pl.chest[1];
        if (own(X, Y, 'chest')) p.set(X, Y, PAL.stone0);
      }
  // chest ᛉ: the stem one step hotter than the arms; a pulse (1.45 ≤ rune < 1.75) lifts the arms to the
  // stem's gold3 without a gold4 stem (the eye stays the loop's only gold4); 2 blazes the stem gold4
  for (const [x, y, stem] of RUNE) {
    const v = stem ? fx.rune : fx.rune >= 1.45 ? Math.max(0.9, fx.rune * 0.5) : fx.rune * 0.5;
    const t = flared(glowTone(v), fx.flare, stem === 1);
    const X = x + OX + pl.chest[0];
    const Y = y + OY + pl.chest[1];
    if (t !== null && own(X, Y, 'chest')) p.set(X, Y, t);
  }
  // shield Ψ (leaning with the slab)
  const lean = shieldShear(fx.tilt);
  for (const [x, y, stem] of SRUNE) {
    const t = flared(glowTone(fx.srune * (stem ? 1 : 0.5)), fx.flare, stem === 1);
    const X = x + OX + pl.shield[0] + (lean ? lean(y - SHIELD.left.y) : 0);
    const Y = y + OY + pl.shield[1];
    if (t !== null && own(X, Y, 'shield')) p.set(X, Y, t);
  }
  veins(ctx, pl);
  return null;
}

// ------------------------------------------------------------------ the spell's veins (hitMagic)
//
// The spell's light runs OUT OF the ᛉ along the masonry the still already has: down out of the recess
// into the chest plate's bottom crease and along it to the lit flank, down the mid-plane joint to the
// course line, and right along the chest's shadow edge — continuous 1-px veins (4-connected), never
// scattered dashes. `vein` (0…1) is how far they have run (the head travels outward), `crackle` how
// bright they burn: a gold2 body behind a gold3 / gold4 head, fading to gold1. Light: drawn after the
// outline, only on the pixels their own block still owns (the arm in front hides them).

/** The veins: [part, path (v1 px, 4-connected, from the recess outward)]. */
const VEINS: readonly (readonly [part: 'chest' | 'abdomen', path: readonly V[]])[] = [
  ['abdomen', [[31, 34], [31, 35], [31, 36], [30, 36], [29, 36], [28, 36], [27, 36], [26, 36], [25, 36], [24, 36], [23, 36], [22, 36]]],
  ['abdomen', [[33, 34], [33, 35], [33, 36], [32, 36], [32, 37], [32, 38], [32, 39], [32, 40], [32, 41], [31, 41], [30, 41], [29, 41], [28, 41]]],
  ['chest', [[37, 30], [38, 30], [38, 31], [38, 32], [38, 33], [39, 33], [39, 34], [39, 35]]],
];

function veins(ctx: Ctx, pl: Places): void {
  const fx = ctx.pose.fx;
  const k = Math.min(1, fx.vein ?? 0);
  if (!(k > 0)) return;
  const heat = fx.crackle ?? 0;
  const body = heat >= 0.45 ? PAL.gold2 : PAL.gold1;
  const head = heat >= 0.85 ? PAL.gold4 : heat >= 0.45 ? PAL.gold3 : PAL.gold2;
  for (const [part, path] of VEINS) {
    const n = Math.max(1, Math.round(path.length * k));
    const d = pl[part];
    for (let i = 0; i < n; i++) {
      const X = path[i][0] + OX + d[0];
      const Y = path[i][1] + OY + d[1];
      if (ctx.comp.owner(X, Y) !== PART_INDEX[part]) continue;
      ctx.dst.set(X, Y, i === n - 1 ? head : i === n - 2 && heat >= 0.45 ? PAL.gold3 : body);
    }
  }
}

// ------------------------------------------------------------------ crumble / reassemble (rigkit passes)
//
// The stone death and revive (A3_MIMARI §5: stone death.pass 'crumble', revive 'reassemble'): the
// passes work in part space — each part's pixels mapped back to its rest place by the part's own
// whole-pixel displacement, so a crack stays on its block — on the frame BEFORE the outline (the
// outline then runs round the broken edge); the broken-off chunks are drawn AFTER it (debris, never
// outlined). hitMagic borrows the crack field for the spell's light running out from the ᛉ.

/** Where the binding fails first: the chest ᛉ at rest (frame px). */
const CRUMBLE_ORIGIN: V = [33 + OX, 30 + OY];
const DEBRIS = new WeakMap<PixelCanvas, Debris>();

function restOfParts(ctx: Ctx): (part: number, x: number, y: number) => V | null {
  const pl = placesOf(ctx.rig, ctx.pose.fx) as unknown as Record<string, V>;
  const [ax, ay] = armShift(ctx.pose.fx);
  const shN = disp(ctx.rig.shoulderN, REST_RIG.shoulderN);
  const shF = disp(ctx.rig.shoulderF, REST_RIG.shoulderF);
  const byPart: (V | null)[] = [];
  // the shield never crumbles: the slab stands whole while its guardian falls apart behind it (the
  // death kit's shatter breaks it with the rest after the last frame)
  for (const [name, i] of Object.entries(PART_INDEX))
    byPart[i] = name === 'shield' ? null : (pl[name] ?? (name === 'armN' ? [shN[0] + ax, shN[1] + ay] : name === 'armF' ? [shF[0] + ax, shF[1] + ay] : null));
  return (part, x, y) => {
    const d = byPart[part];
    return d ? [x - d[0], y - d[1]] : null;
  };
}

/** The limbs' part ids (no masonry joint opens on them). */
let ARMS: ReadonlySet<number> = new Set();

/** The stack block of each part id (arms with the chest; -1 = not in the stack). */
function blockOfPart(): (part: number) => number {
  const by: number[] = [];
  for (const [name, i] of Object.entries(PART_INDEX)) by[i] = name in STACK ? STACK[name as keyof Places] : name === 'armN' || name === 'armF' ? ARM_BLOCK : -1;
  return (part) => by[part] ?? -1;
}

/** Draw order of the parts this frame (their slots, as planArt lays them; a pose's station moves one). */
function orderOf(ctx: Ctx): (part: number) => number {
  const by: number[] = [];
  for (const [name, i] of Object.entries(PART_INDEX)) {
    const pp = PARTS[name];
    by[i] = BIPED_ORDER.indexOf(bipedSlotOf(ctx.pose, name, pp?.layer ?? '')) * 100 + i;
  }
  return (part) => by[part] ?? part;
}

/** The crack network of the stone (sparser than the pass default: a few long fissures, not a mosaic). */
const STONE_CRACKS = { cell: 9, density: 0.22, crackWidth: 0.8 } as const;
/** The revive's binding light in the closing cracks: the rune gold, never hotter than gold2 (the eye stays the hottest light). */
const BINDING = { ...CRUMBLE_STONE, glow: [PAL.gold1, PAL.gold2] } as const;

function crumblePart(ctx: Ctx): null {
  const pass = ctx.pose.pass ?? {};
  const fx = ctx.pose.fx;
  const loose = (fx.gap ?? 0) > 0 && (fx.lock ?? 6) < 6;
  if (!((pass.crumble ?? 0) > 0) && !(pass.reassemble !== undefined && pass.reassemble < 1) && !loose) {
    DEBRIS.delete(ctx.dst);
    return null;
  }
  const common = { restOf: restOfParts(ctx), light: ctx.light, style: CRUMBLE_STONE, floorY: ctx.rig.ground, centreX: Math.round(ctx.rig.pelvis[0]), origin: CRUMBLE_ORIGIN, order: orderOf(ctx), minChunk: 2, ...STONE_CRACKS };
  // the masonry's joints: between two blocks of the stack (not the limbs, not the shield)
  const block = blockOfPart();
  const masonry = (a: number, b: number) => block(a) >= 0 && block(b) >= 0 && block(a) !== block(b) && !ARMS.has(a) && !ARMS.has(b);
  let debris: Debris | null = null;
  if ((pass.crumble ?? 0) > 0) debris = crumblePass(ctx.comp, { ...common, t: pass.crumble, joint: masonry, jointFrom: 0.08 });
  else if (pass.reassemble !== undefined && pass.reassemble < 1) debris = reassemblePass(ctx.comp, { ...common, style: BINDING, t: pass.reassemble, joint: masonry, jointFrom: 0.08 });
  else if (loose) {
    // the summon's loose column: the joint under every loose block is open (no crack, no chunk)
    crumblePass(ctx.comp, { ...common, t: 1, cracks: false, fallFrom: 2, joint: (a, b) => masonry(a, b) && Math.max(block(a), block(b)) >= fx.lock });
  }
  if (debris) DEBRIS.set(ctx.dst, debris);
  else DEBRIS.delete(ctx.dst);
  return null;
}

/**
 * IŞ-4's last pass, for the moss: a moss pixel with no moss 4-neighbour and at least two stone ones
 * (a cap's edge peeking past a limb, a clipped drip) takes its most common stone neighbour — a lone
 * dark-green pixel inside the stone reads as speckle. Before the outline, after every body part.
 */
function tidyMoss(ctx: Ctx): null {
  const p = ctx.dst;
  const fixes: number[] = [];
  for (let y = 1; y < p.h - 1; y++)
    for (let x = 1; x < p.w - 1; x++) {
      const c = p.get(x, y);
      if (c === null || !LEAF.includes(c as (typeof LEAF)[number])) continue;
      const counts = new Map<number, number>();
      let moss = false;
      let stone = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = p.get(x + dx, y + dy);
        if (n === null) continue;
        if (LEAF.includes(n as (typeof LEAF)[number])) moss = true;
        else if (STONE.includes(n as (typeof STONE)[number])) {
          stone++;
          counts.set(n, (counts.get(n) ?? 0) + 1);
        }
      }
      if (moss || stone < 2) continue;
      let best = -1;
      let bestN = 0;
      for (const [k, v] of counts) if (v > bestN || (v === bestN && k < best)) [best, bestN] = [k, v];
      fixes.push(x, y, best);
    }
  for (let i = 0; i < fixes.length; i += 3) p.set(fixes[i], fixes[i + 1], fixes[i + 2]);
  return null;
}

function debrisPart(ctx: Ctx): null {
  const d = DEBRIS.get(ctx.dst);
  if (d) drawDebris(ctx.dst, d, { floorY: ctx.rig.ground, comp: ctx.comp, order: orderOf(ctx) });
  DEBRIS.delete(ctx.dst);
  return null;
}

// ------------------------------------------------------------------ the parts table

/** The member's parts, in the order they are painted within a slot. */
export const PARTS: Readonly<Record<string, Part>> = Object.freeze({
  armF: { layer: 'armF', seam: 'none', paint: farArm },
  pauldronF: rigid('shoulderF', PAULDRON_F, 'pauldronF'),
  legF: rigid('legF', LEG_F, 'legF'),
  legN: rigid('legN', LEG_N, 'legN'),
  tassets: rigid('torso', TASSETS, 'tassets'),
  abdomen: rigid('torso', ABDOMEN, 'abdomen'),
  belt: rigid('torso', BELT, 'belt'),
  chest: rigid('torso', CHEST, 'chest'),
  helm: rigid('head', HELM, 'helm'),
  shield: rigid('propF', SHIELD, 'shield'),
  armN: { layer: 'armN', seam: 'none', paint: nearArm },
  pauldronN: rigid('shoulderN', PAULDRON_N, 'pauldronN'),
  rock: FX_PARTS.rock,
  spikes: FX_PARTS.spikes,
  glow: { layer: 'glow', seam: 'none', paint: glow },
  floor: FX_PARTS.floor,
  crumble: { layer: 'front', seam: 'none', paint: crumblePart },
  tidy: { layer: 'front', seam: 'none', paint: tidyMoss },
  debris: { layer: 'fx', seam: 'none', paint: debrisPart },
});
setPartIndex(Object.keys(PARTS));
setRockId(PART_INDEX.rock);
ARMS = new Set([PART_INDEX.armN, PART_INDEX.armF]);

export { v1 };
