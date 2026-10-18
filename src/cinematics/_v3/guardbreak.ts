// v3 GUARD BREAK (A2 motion review r2 #4; plan §4 "Bekleme ↔ saldırı ↔ darbe ↔ bekleme geçişlerinde
// poz sıçraması olmaz"). A monster in DEFENSE position that dies never jumps from its crouched,
// wrapped guard straight into the upright first death frame (4.7–5.4 × idleΔ in one frame). The
// lethal blow BREAKS the guard instead:
//
//   guard ──(the blow)──▶ fromGuard f0 … f[bridge]   the ward / shield wing is thrown open, the body
//                                                     comes up out of the crouch (drawn frames)
//         ──▶ [recoil f0 … f[hold]]                   optional: the hit / hitHeavy / hitMagic recoil
//                                                     whose frames lead into the death pose
//         ──▶ death f[start] …                        the death pose, from its best-matching frame
//
// planGuardBreak picks the bridge frame, the recoil (or none) and the death start with the same
// measure as posematch.ts (pixel Δ of the unit's own sheet frames / idleΔ, SKIP_COST per skipped
// death frame), within BREAK_WINDOW_MS of bridge; runGuardBreak plays it and leaves the planned
// entry for the death kit (death.ts joins the death pose where the break hands over). The unit is
// marked guardBroken (MonsterUnit): from here on hits are not answered from the guard pose.
//
//   const g = planGuardBreak(u);   // null: no fromGuard / death pose, or nothing measurable yet
//   if (g) runGuardBreak(u, g);

import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { wait } from '../../vfx/core';
import { MAX_SKIP, SKIP_COST, chooseEntry, frameDelta, idleDelta, setPlannedEntry } from './posematch';

/** The bridge (fromGuard) may run this long before the hand-over (ms). */
export const BREAK_WINDOW_MS = 240;
/** The recoil a break may pass through reaches its hand-over frame within this (ms). */
const RECOIL_WINDOW_MS = 140;
/** Cost of passing through a recoil (one more pose change), in idleΔ. */
const VIA_PENALTY = 0.3;
/** Cost of each bridge frame (a later hand-over), in idleΔ: ties go to the quicker break. */
const FRAME_PENALTY = 0.08;
/**
 * The bridge plays faster than the calm guard → idle transition it is drawn for: the blow throws
 * the guard open (1.5×: a 50–80 ms hold becomes 33–53 ms, every drawn frame still ≥ 2 game frames).
 */
export const BRIDGE_SPEED = 1.5;

export interface GuardBreak {
  /** fromGuard plays f0 … f[bridge]. */
  bridge: number;
  /** Then this recoil plays f0 … f[hold] (null: straight into the death). */
  recoil: AnyMonsterAnim | null;
  hold: number;
  /** The death pose starts on this frame. */
  start: number;
  /** The worst pose change on the way (idleΔ) + penalties. */
  cost: number;
  /** ms from the break's start to the death's first frame. */
  leadMs: number;
}

/** Does the unit show its guard (or the way into it)? */
export function showsGuard(u: MonsterUnit): boolean {
  const a = u.frameInfo().anim;
  return a === 'guard' || a === 'toGuard';
}

/** The guard break of a unit with a death pose and a fromGuard transition (see the header). */
export function planGuardBreak(u: MonsterUnit): GuardBreak | null {
  if (!u.has('death') || !u.has('fromGuard') || !u.sprite.active) return null;
  const idle = idleDelta(u);
  if (idle === null) return null;
  const nB = u.frameCount('fromGuard');
  const nD = u.frameCount('death');
  const jMax = Math.max(0, Math.min(MAX_SKIP, nD - 2));
  // the recoils that lead into the death pose (from their frame 0)
  const via: { anim: AnyMonsterAnim; hold: number; start: number; cost: number }[] = [];
  for (const R of ['hitMagic', 'hitHeavy', 'hit'] as const) {
    const n = u.frameCount(R);
    if (!n) continue;
    let reach = 0;
    while (reach < n && u.rangeMs(R, 0, reach) <= RECOIL_WINDOW_MS) reach++;
    const e = chooseEntry(R, reach, nD, (r, j) => {
      const d = frameDelta(u, `${R}:${r}`, `death:${j}`);
      return d === null ? null : d / idle;
    });
    if (e) via.push({ anim: R, hold: e.hold, start: e.start, cost: e.cost });
  }
  let best: Omit<GuardBreak, 'leadMs'> | null = null;
  const consider = (c: Omit<GuardBreak, 'leadMs'>) => {
    if (!best || c.cost < best.cost - 1e-9) best = c;
  };
  for (let k = 0; k < nB && u.rangeMs('fromGuard', 0, k) / BRIDGE_SPEED <= BREAK_WINDOW_MS; k++) {
    const bk = `fromGuard:${k}`;
    const pen = FRAME_PENALTY * k;
    for (let j = 0; j <= jMax; j++) {
      const d = frameDelta(u, bk, `death:${j}`);
      if (d !== null) consider({ bridge: k, recoil: null, hold: 0, start: j, cost: d / idle + SKIP_COST * j + pen });
    }
    for (const v of via) {
      const d = frameDelta(u, bk, `${v.anim}:0`);
      if (d !== null) consider({ bridge: k, recoil: v.anim, hold: v.hold, start: v.start, cost: Math.max(d / idle, v.cost) + VIA_PENALTY + pen });
    }
  }
  if (!best) return null;
  const b: Omit<GuardBreak, 'leadMs'> = best;
  const leadMs = Math.round(u.rangeMs('fromGuard', 0, b.bridge + 1) / BRIDGE_SPEED) + (b.recoil ? u.rangeMs(b.recoil, 0, b.hold) : 0);
  return { ...b, leadMs };
}

/**
 * Play a guard break (the bridge, the recoil, then the death pose from its planned frame, held on
 * its last frame) and leave the planned entry for the death kit. Marks the unit guardBroken.
 */
export function runGuardBreak(u: MonsterUnit, g: GuardBreak): void {
  u.guardBroken = true;
  setPlannedEntry(u, { anim: g.recoil ?? 'fromGuard', hold: g.recoil ? g.hold : g.bridge, start: g.start, cost: g.cost, leadMs: g.leadMs });
  const alive = () => !u.retired && u.sprite.active;
  /** Only while the break still owns the sprite (a death that already took over is left alone). */
  const shows = (anim: AnyMonsterAnim) => u.frameInfo().anim === anim;
  const toDeath = () => {
    if (!alive() || shows('death')) return;
    u.asClaimant(() => void u.playRange('death', g.start, undefined, { hold: true }));
  };
  const recoil = () => {
    if (!alive() || !shows('fromGuard')) return;
    const R = g.recoil;
    if (R && g.hold > 0) void u.asClaimant(() => u.playRange(R, 0, g.hold)).then(() => shows(R) && toDeath());
    else toDeath();
  };
  void u
    .asClaimant(() => u.playRange('fromGuard', 0, g.bridge, { timeScale: BRIDGE_SPEED }))
    // the hand-over frame of the bridge keeps its own hold
    .then(() => (alive() && shows('fromGuard') ? wait(u.scene, Math.round(u.frameMs('fromGuard', g.bridge) / BRIDGE_SPEED)) : undefined))
    .then(recoil);
}
