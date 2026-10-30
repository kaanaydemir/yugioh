import type { AnimSpec, AnyMonsterAnim, MonsterAnim, MonsterAnimExtra, MonsterPoints } from '../types';
import { GY, pose, skeleton, type Pose } from './grim_warden-rig';
const TAU = Math.PI * 2;
export function idlePose(f: number): Pose {
  const t = f / 12;
  return pose({ crawl: t, zs: f, capeT: t, ragT: t, chy: Math.round(Math.sin(t * TAU)) });
}
export function framePose(anim: AnyMonsterAnim, f: number): Pose { void anim; return idlePose(f); }
const spec = (frames: number, fps: number, loop: boolean, holds: number[], marks?: AnimSpec['marks']): AnimSpec => ({ frames, fps, loop, holds, ...(marks ? { marks } : {}) });
const H12 = Array(12).fill(140);
export const IMPACT = 4;
export const ANIMS: Record<MonsterAnim, AnimSpec> = {
  idle: spec(12, 8, true, H12), guard: spec(6, 6, true, Array(6).fill(150)), roar: spec(6, 10, false, Array(6).fill(100), { charge: 1, release: 3, impact: 3, recover: 4 }),
  attack: spec(8, 10, false, Array(8).fill(100), { charge: 1, release: 4, impact: 4, contact: 5, recover: 6 }), hit: spec(5, 12, false, Array(5).fill(60), { impact: 0, contact: 0, recover: 3 }),
};
export const EXTRA_ANIMS: Partial<Record<MonsterAnimExtra, AnimSpec>> = {};
export const MUZZLE = { x: 114, y: 105 };
export function framePoints(anim: AnyMonsterAnim, f: number): MonsterPoints {
  const sk = skeleton(framePose(anim, f));
  return { muzzle: { x: Math.round(sk.tip[0]), y: Math.round(sk.tip[1]) }, core: { x: Math.round(sk.C[0]), y: Math.round(sk.C[1]) }, head: { x: Math.round(sk.S[0]), y: Math.round(sk.S[1]) }, feet: { x: 59, y: GY } };
}
