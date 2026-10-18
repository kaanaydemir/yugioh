// v3 GUARD BREAK (A2 motion review r2 #4, r3 #3; plan §4 "Bekleme ↔ saldırı ↔ darbe ↔ bekleme
// geçişlerinde poz sıçraması olmaz", "Hasar tepkisi … savunma pozisyonunu yansıtır"). A monster in
// DEFENSE position that dies never jumps from its crouched, wrapped guard straight into the death,
// and never rises out of its guard first either (r3 #3: climbing fromGuard to its last, idle-like
// frame read as the lethal blow FREEING the body). The blow breaks the guard:
//
//   contact ─ fromGuard f0          the ward / shield wing is thrown open, the body still low —
//             (held through the     shown on the impact frame and frozen by the hit-stop
//              hit-stop)
//           ─ [fromGuard f1]        only when it fits the window: one more beat of the opening
//           ─ the blow's recoil     hitMagic (a spell, a beam) / hitHeavy (a body blow) / hit,
//             f0 … f[hold]          from its first, struck frame
//           ─ death f[start] …      the death pose, from the frame that continues the recoil
//
// The whole break — the hit-stop INCLUDED — reaches the death within BREAK_WINDOW_MS of the
// contact (the death of a recoil with frames before its hand-over: ≤ RECOIL_LEAD_MS more). The
// bridge is never chosen by its likeness to the death's first frame (the death starts upright on
// some arts: that is what made the old planner climb to the idle-like last bridge frame).
//
// planGuardBreak picks the recoil and the death start (the same pixel measure as posematch.ts:
// Δ of the unit's own sheet frames / idleΔ, SKIP_COST per skipped death frame); runGuardBreak plays
// it on a per-frame clock that counts the frozen hit-stop in real time, and leaves the planned
// entry for the death kit (death.ts joins the death pose where the break hands over). The unit is
// marked guardBroken (MonsterUnit): from here on hits are not answered from the guard pose.
//
//   const g = planGuardBreak(u, { recoil: 'hitMagic' });   // null: no fromGuard / death pose
//   if (g) runGuardBreak(u, g);

import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { peekShowClock } from '../../duel/showclock';
import { MAX_SKIP, SKIP_COST, chooseEntry, frameDelta, idleDelta, setPlannedEntry } from './posematch';

/** Contact → the recoil's hand-over to the death pose (ms, the hit-stop included). */
export const BREAK_WINDOW_MS = 150;
/** The bridge never goes past this fromGuard frame (the ward thrown open, the body still low). */
export const BRIDGE_MAX_FRAME = 1;
/** Shortest a bridge frame is shown once time runs (two game frames). */
const MIN_FRAME_MS = 34;
/** The recoil's frames before its hand-over frame may take at most this (ms). */
const RECOIL_LEAD_MS = 70;
/**
 * The hand-over is called this much before the window closes: the frame it poses shows on the
 * next render (one game frame later), so the death's first frame lands inside the window.
 */
const SHOW_LAG_MS = 20;
/** A plan whose cost could not be measured (lazily painted frames still blank). */
const UNKNOWN_COST = 99;
/** A recoil f0 this close to the death's start frame (idleΔ) IS that frame: the death shows it. */
const SAME_FRAME = 0.5;

export interface GuardBreak {
  /** The last bridge frame shown at most (fromGuard f0 … f[bridge]; f1 only when it fits). */
  bridge: number;
  /** Then this recoil plays f0 … f[hold] (null: straight into the death). */
  recoil: AnyMonsterAnim | null;
  hold: number;
  /**
   * hold 0: the recoil's struck f0 shows for its own beat before the death joins (false: the
   * death's start frame looks the same — it shows it itself).
   */
  struck: boolean;
  /** The death pose starts on this frame. */
  start: number;
  /** The worst pose change on the way (idleΔ): the bridge into the recoil, the recoil into the death. */
  cost: number;
  /** Upper bound (ms) from the contact to the death's first frame (the death kit waits that long). */
  leadMs: number;
}

/** Does the unit show its guard (or the way into it)? */
export function showsGuard(u: MonsterUnit): boolean {
  const a = u.frameInfo().anim;
  return a === 'guard' || a === 'toGuard';
}

/**
 * The guard break of a unit with a death pose and a fromGuard transition (see the header).
 * `recoil`: the blow's own recoil (hitMagic / hitHeavy / hit — the art's fallback when it lacks
 * it); omitted (a death with no blow): the bridge goes straight into the death pose.
 */
export function planGuardBreak(u: MonsterUnit, o: { recoil?: AnyMonsterAnim | null } = {}): GuardBreak | null {
  if (!u.has('death') || !u.has('fromGuard') || !u.sprite.active) return null;
  const bridge = Math.min(BRIDGE_MAX_FRAME, u.frameCount('fromGuard') - 1);
  const nD = u.frameCount('death');
  let R: AnyMonsterAnim | null = null;
  if (o.recoil) {
    for (const a of [o.recoil, 'hitHeavy', 'hit'] as const)
      if (u.has(a)) {
        R = a;
        break;
      }
  }
  const idle = idleDelta(u);
  const from = `fromGuard:${bridge}`;
  if (!R) {
    // no blow: the death from the frame that continues the opened guard best
    const e = idle === null ? null : chooseEntry('death', 1, nD, (_r, j) => {
      const d = frameDelta(u, from, `death:${j}`);
      return d === null ? null : d / idle;
    });
    return { bridge, recoil: null, hold: 0, struck: false, start: e ? e.start : 0, cost: e ? e.cost : UNKNOWN_COST, leadMs: BREAK_WINDOW_MS + MIN_FRAME_MS };
  }
  // the recoil frames reachable before the hand-over, and the death frame that continues them
  const n = u.frameCount(R);
  let reach = 1;
  while (reach < n && u.rangeMs(R, 0, reach) <= RECOIL_LEAD_MS) reach++;
  const rec = R;
  const e =
    idle === null
      ? null
      : chooseEntry(rec, reach, nD, (r, j) => {
          const d = frameDelta(u, `${rec}:${r}`, `death:${j}`);
          return d === null ? null : d / idle;
        });
  const hold = e ? e.hold : 0;
  const start = e ? Math.min(e.start, MAX_SKIP) : 0;
  // the death's own frame skips are in e.cost already; the struck frame shows unless it is the same
  const struck = hold === 0 && (!e || e.cost - SKIP_COST * start > SAME_FRAME);
  const into = idle === null ? null : frameDelta(u, from, `${rec}:0`);
  const cost = e && into !== null && idle !== null ? Math.max(into / idle, e.cost) : UNKNOWN_COST;
  const g: GuardBreak = { bridge, recoil: rec, hold, struck, start, cost, leadMs: 0 };
  g.leadMs = BREAK_WINDOW_MS + MIN_FRAME_MS + recoilLead(u, g);
  return g;
}

/** ms from the recoil's first frame to the death's first frame. */
function recoilLead(u: MonsterUnit, g: GuardBreak): number {
  if (!g.recoil) return 0;
  if (g.hold > 0) return u.rangeMs(g.recoil, 0, g.hold);
  return g.struck ? Math.max(MIN_FRAME_MS, u.frameMs(g.recoil, 0)) : 0;
}

/**
 * Play a guard break (see the header) and leave the planned entry for the death kit. Marks the unit
 * guardBroken. The bridge is timed on a per-frame clock that counts the hit-stop (frozen show
 * time) in REAL ms — the window is the viewer's, from the contact frame — and scene ms otherwise.
 * Anything else that takes the sprite over (a frame the break did not pose) ends the break there.
 */
export function runGuardBreak(u: MonsterUnit, g: GuardBreak): void {
  u.guardBroken = true;
  setPlannedEntry(u, { anim: g.recoil ?? 'fromGuard', hold: g.recoil ? g.hold : g.bridge, start: g.start, cost: g.cost, leadMs: g.leadMs });
  const sc = u.scene;
  const alive = () => !u.retired && u.sprite.active;
  /** Only while the break still owns the sprite (a death that already took over is left alone). */
  const showing = (anim: AnyMonsterAnim, f: number) => {
    const fi = u.frameInfo();
    return fi.anim === anim && fi.frame === f;
  };
  const toDeath = () => {
    if (!alive() || u.frameInfo().anim === 'death') return;
    u.asClaimant(() => void u.playRange('death', g.start, undefined, { hold: true }));
  };
  const intoRecoil = () => {
    const R = g.recoil;
    if (R && g.hold > 0) void u.asClaimant(() => u.playRange(R, 0, g.hold)).then(() => alive() && u.frameInfo().anim === R && toDeath());
    else if (R && g.struck) {
      // the recoil's struck frame shows its own beat, then the death joins on its planned frame
      u.asClaimant(() => u.pose(R, 0));
      sc.time.delayedCall(recoilLead(u, g), () => alive() && showing(R, 0) && toDeath());
    } else toDeath();
  };
  if (!u.asClaimant(() => u.pose('fromGuard', 0))) return intoRecoil();
  const lead = recoilLead(u, g);
  let stage = 0; // 0: fromGuard f0 · 1: f1 · 2: handed over
  let el = 0; // ms since the contact: real while frozen, show time otherwise
  let run = 0; // show ms since time last ran again (the frame's own visible beat after a freeze)
  const tick = (_t: number, delta: number) => {
    const clock = peekShowClock(sc);
    if (clock?.paused) return;
    if (!alive()) return off();
    const frozen = !!clock?.frozen;
    const dt = Math.min(50, delta);
    el += frozen ? dt : dt * (clock ? clock.speed : 1);
    run = frozen ? 0 : run + dt * (clock ? clock.speed : 1);
    if (frozen) return;
    if (stage === 0) {
      if (!showing('fromGuard', 0)) return off();
      // f0 has shown through the hit-stop: hand on once it has had its own beat of running time
      // (none needed after a hit-stop that already held it ≥ two frames)
      if (el < MIN_FRAME_MS && run < MIN_FRAME_MS) return;
      if (g.bridge >= 1 && el + MIN_FRAME_MS + lead <= BREAK_WINDOW_MS - SHOW_LAG_MS) {
        stage = 1;
        run = 0;
        u.asClaimant(() => u.pose('fromGuard', 1));
        return;
      }
      stage = 2;
      off();
      intoRecoil();
      return;
    }
    if (!showing('fromGuard', 1)) return off();
    if (run < MIN_FRAME_MS || el + lead < BREAK_WINDOW_MS - SHOW_LAG_MS) return;
    stage = 2;
    off();
    intoRecoil();
  };
  // (Phaser.Scenes.Events.UPDATE / SHUTDOWN: this module stays importable without Phaser)
  const off = () => {
    sc.events.off('update', tick);
    sc.events.off('shutdown', off);
  };
  sc.events.on('update', tick);
  sc.events.once('shutdown', off);
}
