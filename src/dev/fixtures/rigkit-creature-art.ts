// The rigkit fixture creature as a full MonsterArt (A3 Y3): hand-keyed anim tables compiled by
// src/art/rigkit/anim.ts (normal tier: every mandatory anim, the draft guard transitions), drawn by
// the Y2 fixture painter. Used by tests/art/rigkit-anim.test.ts (compiler + validateArt on a clean
// art), by the ×3 review strips and by the ?dev=recipe preview's &fixture=1 stand-in (src/dev/fixtures:
// dev source, A3 core review F5).

import type { MonsterId } from '../../data/cards';
import { compileAnims, draftGuardTransitions, toMonsterArt, type AnimDefs, type Beat } from '../../art/rigkit/anim';
import { glintSize } from '../../art/rigkit/edges';
import { lightOf } from '../../art/rigkit/light';
import { definePose, type PoseDelta, type PoseKit } from '../../art/rigkit/pose';
import type { MonsterArt } from '../../art/types';
import { FX_ANCHOR, FX_H, FX_NEUTRAL, FX_W, drawFixture, fixtureWorkspace, type FxPose } from './rigkit-creature';

export const FX_KIT: PoseKit<FxPose> = definePose<FxPose>(
  FX_NEUTRAL,
  // lag groups (mix): the head rides the body, the tail and the cloth trail it
  { head: ['headX', 'headY', 'headA'], tail: ['tail', 'tailAmp'], cloth: ['cape'] },
  // the struck filter (HA-21)
  { head: ['headX', 'headY', 'headA', 'jaw', 'eye'], chest: ['lean', 'cracks'], hips: ['bob'], armN: ['paw'], tail: ['tail', 'tailAmp'], extra: ['cape', 'crest'] },
);

const TAU = Math.PI * 2;
const IDLE_N = 12;
const GUARD_N = 6;

/** idle: the body floats 1 px, the head rides it a frame late, the tail and the mantle lag, one glint, one blink. */
function idleAt(f: number): PoseDelta<FxPose> {
  const t = f / IDLE_N;
  const bob = Math.round(-0.9 * Math.sin(t * TAU));
  const headAbs = Math.round(-0.9 * Math.sin((t - 1 / IDLE_N) * TAU));
  return {
    bob,
    headY: headAbs - bob,
    headA: 0.04 * Math.sin((t - 0.15) * TAU),
    tail: t,
    cape: { t: (2 * t) % 1, lag: Math.round(1.6 * Math.sin((t - 0.25) * TAU) + 1.6) / 2 },
    crest: 0.3 + 0.2 * (0.5 - 0.5 * Math.cos(t * TAU)),
    glint: glintSize(f, 5),
    eye: f === 9 ? 0 : 1,
  };
}

function guardAt(f: number): PoseDelta<FxPose> {
  const t = f / GUARD_N;
  return {
    guard: true,
    bob: 1,
    lean: 0.04,
    headX: -2,
    headY: 4 + Math.round(0.6 * Math.sin((t - 0.2) * TAU)),
    headA: 0.15,
    crest: 0.2 + 0.15 * (0.5 - 0.5 * Math.cos(t * TAU)),
    tail: t,
    tailAmp: 4,
    cape: { t, lag: 0.5 },
  };
}

const IDLE0 = FX_KIT.pose(idleAt(0));
const GUARD0 = FX_KIT.pose(guardAt(0));
const DEATH_END: Partial<FxPose> = { bob: 3, lean: 0.08, headY: 7, headA: 0.35, eye: 0, cracks: 1, drain: 1, split: 1, tailAmp: 2 };

/** HA-22: the hit's f1 is the in-between of the compressed key and the reel. */
function recoilBeats(struck: PoseDelta<FxPose>, keys: PoseDelta<FxPose>[], holds: number[], recoverAt: number): Beat<FxPose>[] {
  const ps = FX_KIT.recoil(FX_KIT.over(IDLE0, struck), keys.map((k) => FX_KIT.over(IDLE0, k)));
  return ps.map((p, i) => ({ name: i === 0 ? 'struck' : i === recoverAt ? 'recover' : undefined, key: () => p, ms: holds[i] }));
}

const transitions = draftGuardTransitions(FX_KIT, IDLE0, GUARD0);

export const FX_ANIMS: AnimDefs<FxPose> = {
  idle: { n: IDLE_N, at: idleAt, holds: [150, 130, 130, 140, 160, 150, 130, 130, 140, 160, 130, 130] },
  guard: { n: GUARD_N, at: guardAt, holds: [160, 150, 140, 170, 150, 140] },
  attack: {
    base: 'idle0',
    beats: [
      { ms: 70, key: { lean: -0.02, headX: -1 } },
      { name: 'charge', ms: 90, key: { lean: -0.05, headX: -3, headY: -1, headA: -0.1, crest: 0.6, paw: [-1, 0] } },
      { name: 'coil', ms: 110, key: { lean: -0.08, headX: -5, headY: -2, headA: -0.2, jaw: 0.2, crest: 0.8, paw: [-1, 0] } },
      { name: 'coil', ms: 160, key: { lean: -0.1, headX: -6, headY: -2, headA: -0.25, jaw: 0.3, crest: 1, paw: [-2, 0] } },
      { name: 'swing', ms: 60, key: { lean: -0.02, headX: -2, headY: 0, headA: -0.1, jaw: 0.6, crest: 1 } },
      { name: 'release', ms: 70, smear: true, key: { lean: 0.08, headX: 4, headY: 2, headA: 0.12, jaw: 1, paw: [3, -2], crest: 1 } },
      { name: 'contact', ms: 80, key: { lean: 0.07, headX: 4, headY: 2, headA: 0.1, jaw: 0.8, paw: [3, 0], crest: 0.9 } },
      { name: 'follow', ms: 90, key: { lean: 0.05, headX: 3, headY: 1, jaw: 0.5, paw: [2, 0], crest: 0.7 } },
      { name: 'recover', ms: 100, key: { lean: 0.02, headX: 1, jaw: 0.2, paw: [1, 0], crest: 0.5 } },
      { name: 'settle', ms: 110, key: { lean: 0.01, jaw: 0.05, crest: 0.4 } },
    ],
    end: 'idle0',
    endMs: 130,
    follow: [{ field: 'headA', of: 'lean', lag: 1 }],
    phase: ['tail'],
  },
  roar: {
    base: 'idle0',
    beats: [
      { ms: 80, key: { lean: -0.02, headY: 1 } },
      { name: 'charge', ms: 120, key: { lean: -0.06, headX: -3, headY: 2, headA: 0.2, crest: 0.6 } },
      { name: 'coil', ms: 150, key: { lean: -0.09, headX: -4, headY: 3, headA: 0.3, crest: 0.8, cape: { lag: 1 } } },
      { name: 'release', ms: 90, key: { bob: -1, lean: -0.1, headX: -1, headY: -4, headA: -0.4, jaw: 1, crest: 1, cape: { lag: -1 } } },
      { name: 'peak', ms: 110, key: { bob: -1, lean: -0.1, headY: -4, headA: -0.42, jaw: 1, crest: 1, cape: { lag: -2 } } },
      { ms: 100, key: { lean: -0.06, headY: -2, headA: -0.25, jaw: 0.7, crest: 0.9 } },
      { name: 'recover', ms: 100, key: { lean: -0.03, headY: -1, headA: -0.1, jaw: 0.3, crest: 0.7 } },
      { ms: 110, key: { lean: -0.01, headA: -0.03, jaw: 0.1, crest: 0.5 } },
      { name: 'settle', ms: 120, key: { crest: 0.4 } },
    ],
    end: 'idle0',
    endMs: 130,
    phase: ['tail'],
  },
  hit: {
    base: 'idle0',
    struck: { regions: ['head', 'chest'] },
    beats: recoilBeats(
      { headX: -3, headY: -1, headA: -0.2, jaw: 0.3, eye: 0, lean: -0.05, tailAmp: 12 },
      [
        { headX: -3, headY: -1, headA: -0.2, jaw: 0.3, eye: 0, lean: -0.06, bob: 1, cape: { lag: 2 } },
        { headX: -2, headY: 1, headA: -0.1, jaw: 0.2, eye: 0, lean: -0.04, bob: 1, cape: { lag: 2 }, tailAmp: 10 },
        { headX: -1, headA: 0.04, jaw: 0.05, eye: 1, lean: -0.01, cape: { lag: 1 } },
        { headA: 0.02, cape: { lag: 0.5 } },
      ],
      [50, 60, 130, 110, 120],
      3,
    ),
    end: 'idle0',
    endMs: 130,
  },
  hitHeavy: {
    base: 'idle0',
    struck: { regions: ['head', 'chest'] },
    beats: recoilBeats(
      { headX: -5, headY: -2, headA: -0.3, jaw: 0.5, eye: 0, lean: -0.08 },
      [
        { headX: -5, headY: -1, headA: -0.3, jaw: 0.5, eye: 0, lean: -0.1, bob: 1, paw: [-2, 0], cape: { lag: 3 } },
        { headX: -4, headY: 2, headA: -0.15, jaw: 0.3, eye: 0, lean: -0.08, bob: 2, paw: [-2, -2], cape: { lag: 3 } },
        { headX: -2, headY: 2, headA: 0, jaw: 0.1, eye: 0, lean: -0.04, bob: 1, paw: [-1, 0], cape: { lag: 2 } },
        { headX: -1, headY: 1, headA: 0.05, eye: 1, lean: -0.02, cape: { lag: 1 } },
        { headA: 0.03, cape: { lag: 0.5 } },
        { headA: 0.01 },
      ],
      [50, 60, 110, 120, 100, 110, 120],
      4,
    ),
    end: 'idle0',
    endMs: 130,
  },
  hitMagic: {
    base: 'idle0',
    struck: { regions: ['head', 'chest', 'extra'] },
    beats: recoilBeats(
      { headX: -2, headY: 1, headA: 0.1, jaw: 0.2, eye: 0, lean: 0.03, crest: 1 },
      [
        { headX: -2, headY: 1, headA: 0.1, jaw: 0.2, eye: 0, lean: 0.03, crest: 1, cape: { lag: 1 } },
        { headX: -2, headY: 2, headA: 0.12, jaw: 0.25, eye: 0, lean: 0.04, crest: 1, cape: { lag: 1 } },
        { headX: -1, headY: 1, headA: 0.1, jaw: 0.2, eye: 0, lean: 0.03, crest: 1, cape: { lag: 1 } },
        { headX: -1, headY: 1, headA: 0.05, jaw: 0.1, eye: 0, lean: 0.01, crest: 0.8 },
        { headA: 0.02, eye: 1, crest: 0.5 },
        { crest: 0.4 },
      ],
      [40, 60, 50, 50, 80, 110, 120],
      5,
    ),
    end: 'idle0',
    endMs: 130,
  },
  summon: {
    base: 'idle0',
    beats: [
      { ms: 100, key: { guard: true, bob: 3, headX: -2, headY: 6, headA: 0.3, eye: 0, crest: 0, cape: { lag: 2 } } },
      { ms: 90, key: { guard: true, bob: 2, headX: -2, headY: 5, headA: 0.28, eye: 0, crest: 0.2, cape: { lag: 2 } } },
      { name: 'land', ms: 90, key: { guard: true, bob: 2, headX: -1, headY: 4, headA: 0.2, eye: 0, crest: 0.4, cape: { lag: 1 } } },
      { ms: 80, key: { bob: 1, headX: -1, headY: 2, headA: 0.05, eye: 1, crest: 0.6 } },
      { name: 'peak', ms: 120, key: { bob: -1, lean: -0.08, headY: -3, headA: -0.35, jaw: 1, crest: 1, cape: { lag: -2 } } },
      { ms: 100, key: { bob: -1, lean: -0.06, headY: -2, headA: -0.25, jaw: 0.6, crest: 1, cape: { lag: -1 } } },
      { ms: 90, key: { lean: -0.03, headY: -1, headA: -0.1, jaw: 0.2, crest: 0.8 } },
      { ms: 100, key: { lean: 0.02, headY: 1, headA: 0.05, crest: 0.6, cape: { lag: 1 } } },
      { ms: 110, key: { crest: 0.45, cape: { lag: 0.5 } } },
    ],
    end: 'idle0',
    endMs: 130,
    phase: ['tail'],
  },
  death: {
    base: 'idle0',
    struck: { regions: ['head', 'chest'] },
    beats: [
      { name: 'struck', ms: 60, key: { headX: -3, headY: 1, headA: -0.15, eye: 0, lean: -0.06, cracks: 0.15 } },
      { ms: 90, key: { headX: -2, headY: 2, headA: 0, eye: 0, lean: -0.05, bob: 1, cracks: 0.4, crest: 0.6 } },
      { ms: 80, key: { headX: -1, headY: 4, headA: 0.15, eye: 0, lean: 0, bob: 2, cracks: 0.65, drain: 0.2, crest: 0.5 } },
      { ms: 80, key: { headY: 5, headA: 0.25, eye: 0, lean: 0.04, bob: 2, cracks: 0.9, drain: 0.45, crest: 0.4 } },
      { name: 'dissolve', ms: 80, key: { ...DEATH_END, drain: 0.7, split: 0.5 } },
      { ms: 70, key: { ...DEATH_END, drain: 0.85, split: 0.5 } },
      { ms: 70, key: DEATH_END },
      { ms: 90, key: { ...DEATH_END, tailAmp: 0 } },
    ],
    end: 'hold',
  },
  revive: {
    base: FX_KIT.pose({ ...DEATH_END, tailAmp: 0 }),
    beats: [
      { ms: 90, key: { gather: 0.1 } },
      { ms: 90, key: { gather: 0.25 } },
      { ms: 90, key: { gather: 0.45 } },
      { ms: 90, key: { gather: 0.65, drain: 0.8 } },
      { name: 'land', ms: 110, key: { gather: 0.85, drain: 0.5, split: 0, bob: 2, headY: 5 } },
      { ms: 90, key: { gather: 1, drain: 0.2, cracks: 0.5, split: 0, bob: 1, headY: 3, headA: 0.15, tailAmp: 3 } },
      { ms: 90, key: { gather: 1, drain: 0, cracks: 0, split: 0, bob: 1, headY: 1, headA: 0.05, eye: 1, tailAmp: 5 } },
      { ms: 100, key: { gather: 1, drain: 0, cracks: 0, split: 0, bob: 0, headY: -1, headA: -0.05, lean: -0.02, eye: 1, tailAmp: 6, crest: 0.6 } },
      { ms: 110, key: { gather: 1, drain: 0, cracks: 0, split: 0, bob: 0, headY: 0, eye: 1, tailAmp: 6, crest: 0.45 } },
    ],
    end: 'idle0',
    endMs: 120,
  },
  toGuard: transitions.toGuard,
  fromGuard: transitions.fromGuard,
};

export const FX_COMPILED = compileAnims(FX_KIT, FX_ANIMS);

/** The fixture as a MonsterArt (never registered: the id is a stand-in). */
export function fixtureArt(): MonsterArt {
  const ws = fixtureWorkspace(lightOf('left'));
  return toMonsterArt(FX_COMPILED, {
    id: 'rigkit_fixture' as unknown as MonsterId,
    w: FX_W,
    h: FX_H,
    anchorX: FX_ANCHOR[0],
    anchorY: FX_ANCHOR[1],
    core: { x: 38, y: 32 },
    weight: 'medium',
    draw: (p, pose, light) => drawFixture(p, pose, light, ws),
    points: (pose) => ({
      muzzle: { x: Math.round(52 + pose.headX), y: Math.round(23 + pose.headY + pose.bob) },
      head: { x: Math.round(45 + pose.headX), y: Math.round(20 + pose.headY + pose.bob) },
      core: { x: 38, y: 32 + Math.round(pose.bob) },
      feet: { x: FX_ANCHOR[0], y: FX_ANCHOR[1] },
    }),
  });
}
