// biped v1 — the SKELETON solve (docs/v3/A3_MIMARI.md §3.3 rig / points / joints / poseKnockPx).
//
// rig(build, pose) → frame px of every joint, deterministic and NaN-free:
//   feet     the rest place + the whole-figure offset (dx, −lift) + step, raised by the foot's lift.
//            A foot that is neither stepped nor lifted is EXACTLY its rest place (HA-9).
//   pelvis   rest + figure offset + hip; if a PLANTED foot is out of its leg's reach the pelvis
//            yields (moves the least distance that brings the hip back into reach): the feet never
//            slide and the legs never tear (rig.yield reports how far it moved; 0 in a sound pose)
//   legs     two-bone IK hip → knee → ankle, knees forward (build.knee +1: back); limb lengths exact
//   spine    pelvis → waist (lean) → chest (lean + chestLean) + breath; shoulders and the head
//            ride the chest, rotated by the bend from rest; twist rolls the near shoulder
//   head     carried by the chest, `lag` × the spine's bend held back, + head.x / y
//   arms     two-bone IK shoulder → elbow → wrist; the target is the rest hand carried by the
//            shoulder (not rotated: arms hang) + armN.hand; out of reach → clamped, lengths exact;
//            dir = the fist's screen angle: the forearm's, turned toward armN.aim.a by aim.w
//   spout    (lower 'spout') a column from the ground between the feet to the pelvis
//   props    resolved to frame px (at a wrist, on the floor, or an offset from the ground point)
// joints() is what the sameness gate tracks (§9.1 MOT): head, hip, handN, handF, footN, footF, prop*.

import type { MonsterPoints, WeightClass } from '../../../types';
import { ik2, type V } from '../../../rigkit/geom';
import { restOf, type BipedBuild, type BipedRest } from './build';
import type { BipedPose } from './pose';

export interface BipedLimb {
  readonly root: V;
  readonly mid: V;
  readonly end: V;
  /** the IK target was out of reach (the limb is straight toward it) */
  readonly clamped: boolean;
  /**
   * (additive, R2) the screen angle (rad, atan2 in frame px) the end of the limb points: the end bone's
   * direction, turned toward the pose's aim by its weight (arms; legs: the shin's direction)
   */
  readonly dir: number;
}

export interface BipedPropAt {
  readonly at: V;
  readonly a: number;
  readonly show: number;
  readonly hand: 'N' | 'F' | null;
}

export interface BipedRig {
  readonly build: BipedBuild;
  readonly rest: BipedRest;
  /** the figure's ground point: root + (dx, −lift) */
  readonly root: V;
  /** the ground line (never moves) */
  readonly ground: number;
  readonly pelvis: V;
  readonly hipN: V;
  readonly hipF: V;
  readonly waist: V;
  /** the shoulder centre */
  readonly chest: V;
  readonly neck: V;
  /** spine angles (rad, 0 upright, + forward): lower half, upper half */
  readonly spine: readonly [number, number];
  readonly shoulderN: V;
  readonly shoulderF: V;
  /** shoulder → elbow → wrist */
  readonly armN: BipedLimb;
  readonly armF: BipedLimb;
  /** hip → knee → ankle */
  readonly legN: BipedLimb;
  readonly legF: BipedLimb;
  /** sole points (ground contact) */
  readonly footN: V;
  readonly footF: V;
  readonly planted: { readonly N: boolean; readonly F: boolean };
  readonly head: V;
  /** head tilt (rad, + = nod) */
  readonly headA: number;
  readonly headH: number;
  readonly twist: number;
  readonly spout: { readonly base: V; readonly mid: V; readonly top: V } | null;
  readonly props: Readonly<Record<string, BipedPropAt>>;
  /** how far the pelvis yielded to keep the planted feet reachable (px) */
  readonly yield: V;
}

const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1]];
const rot = (a: V, r: number): V => [a[0] * Math.cos(r) - a[1] * Math.sin(r), a[0] * Math.sin(r) + a[1] * Math.cos(r)];
const lerpV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** a finite number (a NaN / ∞ from a broken key never reaches the rig) */
const fin = (v: number | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const finV = (v: V | undefined): V => [fin(v?.[0]), fin(v?.[1])];

/** Two-bone limb toward `target`: lengths exact; an unreachable target clamps 0.01 px short of straight. */
function limb(root: V, target: V, l1: number, l2: number, bend: number, aim?: { a: number; w: number }): BipedLimb {
  const d = sub(target, root);
  const len = Math.hypot(d[0], d[1]);
  const max = l1 + l2 - 0.01;
  const clamped = len > max;
  const end: V = clamped ? add(root, [(d[0] * max) / len, (d[1] * max) / len]) : target;
  const mid = ik2(root, end, l1, l2, bend);
  return { root, mid, end, clamped, dir: aimed(Math.atan2(end[1] - mid[1], end[0] - mid[0]), aim) };
}

/** A bone's angle turned toward aim.a by aim.w (the shorter way round; w clamped to 0…1). */
function aimed(along: number, aim?: { a: number; w: number }): number {
  const w = clamp(fin(aim?.w), 0, 1);
  if (w === 0) return along;
  let d = fin(aim?.a) - along;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return along + d * w;
}

/** Solve the skeleton of one pose. */
export function bipedRig(b: BipedBuild, pose: BipedPose): BipedRig {
  const r = restOf(b);
  const fig: V = [fin(pose.dx), -fin(pose.lift)];
  const root = add(r.root, fig);
  const liftN = Math.max(0, fin(pose.footN?.lift));
  const liftF = Math.max(0, fin(pose.footF?.lift));
  let footN = add(add(r.footN, fig), add(finV(pose.footN?.step), [0, -liftN]));
  let footF = add(add(r.footF, fig), add(finV(pose.footF?.step), [0, -liftF]));
  const planted = { N: liftN === 0 && fig[1] === 0, F: liftF === 0 && fig[1] === 0 };
  const tilt = fin(pose.hip?.tilt);
  const hipOff = { N: add(r.hipN, [0, -tilt / 2]), F: add(r.hipF, [0, tilt / 2]) };
  const ankleOf = (f: V): V => [f[0], f[1] - r.ankle];
  const legs = b.lower !== 'spout';

  // ---- the pelvis yields to planted feet
  const want = add(add(r.pelvis, fig), [fin(pose.hip?.x), fin(pose.hip?.y)]);
  let pelvis = want;
  if (legs) {
    const reach = r.legReach - 0.05;
    for (let it = 0; it < 6; it++) {
      let moved = false;
      for (const s of ['N', 'F'] as const) {
        if (!planted[s]) continue;
        const hip = add(pelvis, hipOff[s]);
        const ank = ankleOf(s === 'N' ? footN : footF);
        const d = sub(hip, ank);
        const len = Math.hypot(d[0], d[1]);
        if (len <= reach) continue;
        pelvis = add(pelvis, sub(add(ank, [(d[0] * reach) / len, (d[1] * reach) / len]), hip));
        moved = true;
      }
      if (!moved) break;
    }
  }
  const hipN = add(pelvis, hipOff.N);
  const hipF = add(pelvis, hipOff.F);

  // ---- legs (a LIFTED foot out of reach is pulled up under its leg; a planted one never moves)
  const leg = (hip: V, foot: V, down: boolean): [BipedLimb, V] => {
    const l = limb(hip, ankleOf(foot), b.leg[0], b.leg[1], b.knee === 1 ? 1 : -1);
    return [l, l.clamped && !down ? [l.end[0], l.end[1] + r.ankle] : foot];
  };
  const [legN, fN] = leg(hipN, footN, planted.N);
  const [legF, fF] = leg(hipF, footF, planted.F);
  if (legs) {
    footN = fN;
    footF = fF;
  }

  // ---- spine, shoulders, head
  const a0 = r.spine + fin(pose.lean);
  const a1 = a0 + fin(pose.chestLean);
  const bendA = a1 - r.spine;
  const half = r.torso / 2;
  const waist = add(pelvis, [Math.sin(a0) * half, -Math.cos(a0) * half]);
  const chest = add(waist, [Math.sin(a1) * half, -Math.cos(a1) * half - fin(pose.breath)]);
  const tw = clamp(fin(pose.twist), -1, 1);
  const span = Math.max(b.shoulder, 8);
  const shoulderN = add(add(chest, rot(r.shoulderN, bendA)), [tw * 0.25 * span, -Math.max(0, tw) * 0.12 * span]);
  const shoulderF = add(add(chest, rot(r.shoulderF, bendA)), [-tw * 0.08 * span, 0]);
  const lag = clamp(fin(pose.head?.lag), 0, 1);
  const carried = add(chest, rot(r.headOff, bendA));
  const still = add(add(sub(r.chest, r.pelvis), pelvis), r.headOff);
  const head = add(lerpV(carried, still, lag), [fin(pose.head?.x), fin(pose.head?.y)]);
  const headA = fin(pose.head?.a) + bendA * (1 - lag);
  const neck = lerpV(chest, head, 0.45);

  // ---- arms
  const arm = (sh: V, rest: V, a: BipedPose['armN'] | undefined) => limb(sh, add(add(sh, rest), finV(a?.hand)), b.arm[0], b.arm[1], a?.bend === -1 ? -1 : 1, a?.aim);
  const armN = arm(shoulderN, r.handN, pose.armN);
  const armF = arm(shoulderF, r.handF, pose.armF);

  // ---- spout, props
  const spout = legs
    ? null
    : (() => {
        const base: V = [(footN[0] + footF[0]) / 2, (footN[1] + footF[1]) / 2];
        return { base, top: pelvis, mid: add(lerpV(base, pelvis, 0.5), [fin(pose.hip?.x) * 0.5, 0]) };
      })();
  const props: Record<string, BipedPropAt> = {};
  for (const [name, p] of Object.entries(pose.props ?? {})) {
    if (!p) continue;
    const off = finV(p.off);
    const at = p.at === 'handN' ? armN.end : p.at === 'handF' ? armF.end : p.at === 'floor' ? ([root[0], r.root[1]] as V) : add(root, finV(p.at as V));
    props[name] = { at: add(at, off), a: fin(p.a), show: clamp(fin(p.show), 0, 1), hand: p.at === 'handN' ? 'N' : p.at === 'handF' ? 'F' : null };
  }

  return {
    build: b,
    rest: r,
    root,
    ground: r.root[1],
    pelvis,
    hipN,
    hipF,
    waist,
    chest,
    neck,
    spine: [a0, a1],
    shoulderN,
    shoulderF,
    armN,
    armF,
    legN,
    legF,
    footN,
    footF,
    planted,
    head,
    headA,
    headH: r.headH,
    twist: tw,
    spout,
    props,
    yield: sub(pelvis, want),
  };
}

/** The joint tracks of one frame (§9.1 MOT): head, hip, handN, handF (unless hidden), footN, footF, prop*. */
export function bipedJoints(b: BipedBuild, rig: BipedRig, _pose: BipedPose): Readonly<Record<string, V>> {
  const j: Record<string, V> = { head: rig.head, hip: rig.pelvis, handN: rig.armN.end, footN: rig.footN, footF: rig.footF };
  if (b.farArm !== 'hidden') j.handF = rig.armF.end;
  for (const name of Object.keys(rig.props).sort()) {
    const p = rig.props[name];
    if (p.show <= 0) continue;
    const key = p.hand === 'N' ? 'propN' : p.hand === 'F' && b.farArm !== 'hidden' ? 'propF' : `prop.${name}`;
    j[key in j ? `${key}.${name}` : key] = p.at;
  }
  return j;
}

/** More named rig points a member's `points` strings may name (besides the joints). */
export function bipedNamed(_b: BipedBuild, rig: BipedRig, _pose: BipedPose): Readonly<Record<string, V>> {
  return {
    pelvis: rig.pelvis,
    waist: rig.waist,
    chest: rig.chest,
    neck: rig.neck,
    shoulderN: rig.shoulderN,
    shoulderF: rig.shoulderF,
    elbowN: rig.armN.mid,
    elbowF: rig.armF.mid,
    kneeN: rig.legN.mid,
    kneeF: rig.legF.mid,
    root: [rig.root[0], rig.ground],
    ...Object.fromEntries(Object.entries(rig.props).map(([n, p]) => [`prop:${n}`, p.at])),
  };
}

/** Default anatomy points (HA-25): head, core (chest, drops with the body), hand, grip, feet, muzzle = head. */
export function bipedPoints(b: BipedBuild, rig: BipedRig, _pose: BipedPose): MonsterPoints {
  const pt = (v: V) => ({ x: v[0], y: v[1] });
  const out: MonsterPoints = {
    head: pt(rig.head),
    muzzle: pt(rig.head),
    core: pt(lerpV(rig.pelvis, rig.chest, 0.55)),
    hand: pt(rig.armN.end),
    feet: { x: rig.root[0], y: rig.ground },
  };
  if (b.farArm !== 'hidden') out.grip = pt(rig.armF.end);
  return out;
}

/**
 * Whole px of body travel the recoil words draw (helpers.recoilPush: the pelvis by f2), power 1 / 2 / 3
 * (§10.2). The reaction kit adds max(0, knockPx − this): heavy keeps 0 / 0 / 1 for the kit, the
 * lighter classes 1–3 px. Never above the kit's front knockPx (guardPushPx + 1) of the class.
 */
export function bipedPoseKnockPx(_b: BipedBuild, weight: WeightClass): readonly [number, number, number] {
  switch (weight) {
    case 'heavy':
    case 'mediumHeavy':
      return [1, 1, 1];
    case 'medium':
    case 'caster':
      return [1, 1, 2];
    default:
      return [1, 2, 2];
  }
}
