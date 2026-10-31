// Kül Ejderi (ashen_drake) — v3 art (?look=v3 only; src/art/monsters/index.ts). Revision 3 of the
// design (docs/v3/kart-a/ashen_drake.md): a VULTURE made of compressed ash and coal, perched hunched on
// its talons with both wing wrists pulled up over its shoulders into a hooded ash cloak (an inverted U
// with a bony claw spur on each wrist), the long S-neck hanging the skull out forward and DOWN from
// under the hood, a tail curling up into a small brazier, and ONE real light: the ember heart inside
// the rib cage (it beats twice every two seconds: lub … DUB).
//   ashen_drake-gbuf.ts   frame constants, the material table (the 'ash' ramp), the cloak's light tones
//   ashen_drake-rig.ts    AshenPose → skeleton → pixels (tail, legs, rib cage, neck, skull, crest, spurs;
//                         the summon's bone line, the revive heap, the attack's chips, the death crumble)
//   ashen_drake-cloak.ts  the two plate fields (22 shingled plates per wing) and the accretion order
//   ashen_drake-ember.ts  the light pass after the outline (heart, rib leaks, hem lip, eyes, brazier, spill)
//   ashen_drake-anims.ts  every anim as hand-keyed poses compiled by the rigkit (holds, marks, points)
// Frame 120×104, 1 art px = 1 game px, anchor (52, 99) between the gripping talons (they never move
// in idle / guard / the transitions: HA-9). P2 is a relit sheet with the standard key light.

import type { DistinctionCard } from '../bodyplans/types';
import type { AnyMonsterAnim, MonsterArt } from '../types';
import { toMonsterArt, type ArtShell } from '../rigkit';
import { AX, GY, H, W } from './ashen_drake-gbuf';
import { cloakPose, drawAshen, type AshenPose } from './ashen_drake-rig';
import { rig } from './ashen_drake-rig';
import { COMPILED, SUMMON_BONE, SUMMON_SEATED, framePose, posePoints, ribsPoint } from './ashen_drake-anims';
import { ASHEN_ORDER, PLATES, cloakShape, plateCenter, plateRank } from './ashen_drake-cloak';

export { framePose };

export const ASHEN_DISTINCTION: DistinctionCard = {
  silhouette:
    'a hunched vulture perch: both wing wrists pulled up above and behind the head into a hooded ash cloak (an inverted U) with a bony claw spur on each wrist, a long S-neck hanging the skull out forward and DOWN from under the hood, two gripping talons, a tail curling up into a small brazier flame; taller than wide, nothing upright',
  rhythm:
    'slow and patient: a double heartbeat, a 490 ms wind-up that strips its own cloak, a breath that rolls rather than fires, a silence holding one heartbeat, then everything at once on the second beat; recoveries re-grow the cloak plate by plate',
  idle: '20 f / 2.0 s: the ember heart beats twice (lub … DUB, a 130 ms relax between) once per loop, so its floor pool double-pulses; a plate ripple travels hem → wrist with a 2-frame dwell per row; a 3-step breath; the S-neck undulates; the tail sweeps; flakes peel off the hem and re-join; the brazier flickers',
  guard: 'the cocoon: the cloak closes fully round the body, the head tucked under the hood edge, only one eye and a slit of heart-glow showing; the hem embers dim to fire1 and breathe plate by plate',
  signaturePart: 'the ember heart seen through the rib cage (the only real light) and the ember-eaten hem of the ash-plate cloak',
  material: 'compressed ash and coal on the stone ramp with compression strata, a violet void2 rim, ember light only inside the ribs / hem / eyes / brazier; dies as a soft ash heap that cools and is blown away',
  signatureMove:
    'Kül Fırtınası Nefesi: the hood plates tear off into the ribs until the drake is bare bones round a white heart; the head drops to the floor and exhales them as a pyroclastic bank of ash that hugs the floor and swallows the target; a silence holding one heartbeat (LUB); every buried ember ignites at once on the second beat (the delayed VUF); the soot trail burns back like a fuse, embers spill between the ribs and the cloak re-grows plate by plate',
};

const pt = (v: { x: number; y: number }) => ({ x: v.x, y: v.y });

/** The mouth (the breath's origin) of a frame: the attack's muzzle on every frame (HA-25). */
export function ASHEN_MOUTH(anim: AnyMonsterAnim, frame: number): { x: number; y: number } {
  return pt(posePoints(framePose(anim, frame)).muzzle!);
}

/** The spill's origin (the lowest rib gaps) of a frame. */
export function ASHEN_RIBS(anim: AnyMonsterAnim, frame: number): { x: number; y: number } {
  return ribsPoint(framePose(anim, frame));
}

/** One summon frame of the build: the bone line and the plates that seat on it (frame px, P1 frame space). */
export interface AshenBuildFrame {
  readonly frame: number;
  /** the bone line (frame row; 0 = the whole body) — the tornado band rides it */
  readonly boneY: number;
  /** plates seated after this frame */
  readonly seated: number;
  /** the plates newly seated on this frame: their centres (the cinematic flies chips onto them) */
  readonly seats: readonly { x: number; y: number }[];
}

/**
 * The accretion table (§4.7, §5.1): per summon frame, the bone line and the plates seated on it.
 * The attack's tear-off / regrowth use the same order (ASHEN_ORDER: torn in reverse, regrown in it).
 */
export const ASHEN_BUILD: readonly AshenBuildFrame[] = Object.freeze(
  SUMMON_BONE.map((boneY, f) => {
    const seated = SUMMON_SEATED[f];
    const prev = f ? SUMMON_SEATED[f - 1] : 0;
    const P = framePose('summon', f);
    const cN = cloakPose(P, 'N');
    const cF = cloakPose(P, 'F');
    const shapes = { N: cloakShape('N', cN.w, cN.off), F: cloakShape('F', cF.w, cF.off) };
    const seats = ASHEN_ORDER.slice(prev, seated).map((id) => {
      const c = plateCenter(shapes[PLATES[id].wing], PLATES[id]);
      return { x: Math.round(c[0]), y: Math.round(c[1]) };
    });
    return Object.freeze({ frame: f, boneY, seated, seats: Object.freeze(seats) });
  }),
);
export { ASHEN_ORDER, plateRank };

const shell: ArtShell<AshenPose> = {
  id: 'ashen_drake',
  w: W,
  h: H,
  anchorX: AX,
  anchorY: GY,
  hover: 0,
  core: { x: 55, y: 60 },
  weight: 'heavy',
  p2: 'relight',
  draw(p, pose, light) {
    drawAshen(p, pose, light);
  },
  points(pose) {
    return posePoints(pose);
  },
};

const ashenDrakeV3: MonsterArt = {
  ...toMonsterArt(COMPILED, shell),
  knock: 'pose',
  poseKnockPx: [1, 2, 2],
  joints(anim, frame) {
    const R = rig(framePose(anim, frame));
    const v = (q: readonly [number, number]) => ({ x: Math.round(q[0] * 10) / 10, y: Math.round(q[1] * 10) / 10 });
    return { hip: v(R.hip), neck: v(R.neck[0]), skull: v(R.skull), heart: v(R.heart), ankleN: v(R.ankleN), ankleF: v(R.ankleF), tail: v(R.tail[R.tail.length - 1]) };
  },
};

export default ashenDrakeV3;
