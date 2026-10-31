// Kaya Baltacı (crag_axeman) — "Dağ Yaran", the strike (v3 look only; docs/v3/oturum-c-tasarim.md §2.3).
//
//   declare   both hands take the haft (the declaration holds attack f1; caxGrip — the charge voice — starts there)
//   spin      f2–f7: ONE full 360° turn in place in six drawn facings, accelerating (100 → 60 ms; the art smears the two
//             fastest frames), earth clods spiral up off the boots; caxSpin (one panned circle, two swells)
//   cock      f8 (the longest frame, 170 ms): the axe swung up behind the head, one edge glint (art); caxCock
//   steps     f9–f11: THREE heavy steps toward the target with an accelerating cadence (160 / 135 / 110 ms, the art's
//             holds); each plant a shake (1 / 1 / 2 px), a dust puff, a pebble hop and the gravel crunch rising in
//             level and pitch (caxStep ×3) — the upper body stays locked in the cocked pose
//   chop      f12 (60 ms, smeared): the vertical chop comes down (caxChop)
//   BITE      f13: the edge bites the floor just in front of the target (caxBite): stone chips burst back toward him, a
//             small white floor flash; the Yarık RUNS from the bite under the target (60 ms, caxRunR/L panned from the
//             attacker to the target), then CLIMBS the target's own body as a vertical light seam in 2 frames (caxClimb);
//             s.impact() lands when it reaches the crown: the kit's hit-stop (heavy class), shake, flash and number
//   heave     f14–f16: the axe wrenched out (chips, a clod; caxWrench), onto the shoulder (caxShoulder); he walks home
//             in three plain steps (no shake). The seam stays ~1.5 s: breathing, one gold4 spark run, faint ticks, a
//             three-step fade (crag_axeman-yarik.ts)
//   blocked   the seam reaches the guard's front edge and forks into a tiny "Y" (no climb); the axe bounces in the floor
//             and he staggers back a step
//   direct    no steps (the direct budget is ~1.6 s): the spin, the cock, the chop from his own tile's front edge; the
//             seam runs the whole way off the board to the duelist's plate and a vertical light seam flashes over the
//             duelist
// Killed targets keep their own death (only Kaya Baltacı ever splits). No camera change, no setScale / setAngle, palette
// steps only. Without ?look=v3 this file registers nothing that plays (v1 byte-identical).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { monsterFrame } from '../../art/textures';
import { DEPTH, LOOK_V3, unitDepth, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { registerObserver, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, panAt, play, takeCharge } from '../_v3/sound';
import { E, RR, Sparks, TAU, lerp, norm, onFrame, seed, sleep, sub } from '../strikes-a/_kit';
import { Seam, SEAM_DEPTH, climbBody, climbLine } from './crag_axeman-yarik';

const ID = 'crag_axeman';
const CHIPS = [PAL.stone4, PAL.stone3, PAL.stone2] as const;
const CLODS = [PAL.earth3, PAL.earth2, PAL.earth1] as const;
const DUST = [PAL.earth3, PAL.earth2] as const;

/** Whole-pixel feet placement of the unit's sprite (depth sorted by the feet). */
function placeAt(u: MonsterUnit, feet: XY, lift = 0): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover - lift));
  s.setDepth(unitDepth(feet.y));
}

/** A dust puff where a boot plants (palette steps, popping out: no alpha) + a pebble hopping off. */
export function plantDust(sc: Phaser.Scene, at: XY, k: number, back: XY): void {
  const sp = new Sparks(sc, unitDepth(at.y) - 0.3);
  const n = 2 + k;
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: at.x + side * RR(2, 5), y: at.y - RR(0, 1), vx: side * RR(10, 22) + back.x * 8, vy: RR(-10, -3), drag: 4, life: RR(180, 260), colors: DUST, shape: 'puff', size: RR(1.5, 2.5), grow: 5, fadeAt: 1 });
  }
  sp.add({ x: at.x + RR(-3, 3), y: at.y - 1, vx: RR(-14, 14) + back.x * 10, vy: RR(-46, -30), ay: 300, life: RR(260, 340), colors: [PAL.stone3, PAL.stone2], shape: 'px', floor: at.y + 1, bounce: 0.3, fadeAt: 1 });
  sp.release();
}

/** Stone chips burst from the bite back toward the attacker (`back`), 1–2 px, bouncing on the floor. */
export function biteChips(sc: Phaser.Scene, at: XY, back: XY, n: number): void {
  const sp = new Sparks(sc, unitDepth(at.y) + 0.4);
  for (let i = 0; i < n; i++) {
    const a = Math.atan2(back.y, back.x) + RR(-0.9, 0.9);
    const v = RR(40, 95);
    sp.add({ x: at.x + RR(-2, 2), y: at.y - RR(0, 2), vx: Math.cos(a) * v, vy: RR(-95, -40), ay: 420, life: RR(320, 520), colors: CHIPS, shape: i % 3 ? 'px' : 'sq', size: 2, floor: at.y + RR(0, 3), bounce: 0.3, fadeAt: 1 });
  }
  sp.release();
}

/** Earth clods spiralling up off the boots during the spin (one or two per facing). */
function spinClods(sc: Phaser.Scene, feet: XY, k: number, sgn: number): void {
  const sp = new Sparks(sc, unitDepth(feet.y) + 0.2);
  for (let i = 0; i < 1 + (k > 0.5 ? 1 : 0); i++) {
    const a = RR(0, TAU);
    const r = RR(6, 12);
    sp.add({ x: feet.x + Math.cos(a) * r, y: feet.y + Math.sin(a) * r * 0.45, vx: -Math.sin(a) * RR(30, 60) * sgn, vy: RR(-70, -40) * (0.6 + k * 0.6), ay: 360, life: RR(300, 420), colors: CLODS, shape: 'sq', size: i ? 1 : 2, floor: feet.y + RR(0, 2), bounce: 0.25, fadeAt: 1 });
  }
  sp.release();
}

/** Screen x of the side of the target's body facing the attacker (`sgn` = the attacker's facing), else the aim. */
function frontOf(t: MonsterUnit | null, aim: XY, sgn: number): number {
  if (!t || !t.sprite.active) return aim.x - sgn * 12;
  try {
    const b = monsterFrame(t.cardId, 'idle', 0).bounds();
    if (!b) return aim.x - sgn * 12;
    const a = t.framePoint(b.x, 0).x;
    const c = t.framePoint(b.x + b.w, 0).x;
    // the body's edge toward him, but never past half a tile in front of its feet
    const edge = sgn > 0 ? Math.min(a, c) : Math.max(a, c);
    return sgn > 0 ? Math.max(edge, aim.x - 26) : Math.min(edge, aim.x + 26);
  } catch {
    return aim.x - sgn * 12;
  }
}

/** The bite's floor point at the contact frame relative to the feet (art px → world, flip aware). */
function biteOffset(u: MonsterUnit, conF: number): XY {
  const pts = u.art.points?.('attack', conF);
  const m = pts?.muzzle ?? u.art.muzzle;
  const sgn = u.flipX ? -1 : 1;
  return { x: sgn * (m.x - u.art.anchorX), y: 0 };
}

async function dagYaran(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 53 + (s.target?.uid ?? 11));
  const sgn = u.flipX ? -1 : 1;
  const pan = panAt(u.home.x);
  const n = u.frameCount('attack');
  const relF = u.markFrame('attack', 'release', 12);
  const conF = Math.max(relF + 1, u.markFrame('attack', 'contact', relF + 1));
  const recF = Math.min(n - 1, Math.max(conF + 1, u.markFrame('attack', 'recover', conF + 1)));
  const spinF0 = 2;
  const cockF = Math.max(spinF0, relF - 4);
  const stepF = [cockF + 1, cockF + 2, cockF + 3];
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  const target = s.direct || s.blocked ? null : s.target;

  // ---- geometry: where the axe bites, where he plants for it
  const homeFeet: XY = { ...u.home };
  const bo = biteOffset(u, conF);
  let bite: XY;
  let seamTo: XY;
  let land: XY;
  if (s.direct) {
    land = { ...homeFeet };
    bite = { x: land.x + bo.x, y: land.y };
    seamTo = { x: s.toGround.x, y: s.toGround.y };
  } else {
    const aim = s.toGround;
    const dir = norm(sub(aim, homeFeet));
    // the target's front (the side of its body facing him, at its feet's height): the bite lands a stride short of it
    const front = frontOf(s.target, aim, sgn);
    const gap = s.blocked ? 18 : 16;
    const along = (x: number): XY => {
      const t = Math.abs(dir.x) > 0.05 ? (x - homeFeet.x) / dir.x : 0;
      return { x: homeFeet.x + dir.x * t, y: homeFeet.y + dir.y * t };
    };
    bite = along(front - sgn * gap);
    land = { x: bite.x - bo.x, y: bite.y - bo.y };
    // the seam runs under the target past its feet (blocked: it stops on the guard's front edge and forks)
    seamTo = s.blocked ? along(front - sgn * 2) : { x: aim.x + dir.x * 12, y: aim.y + dir.y * 12 };
  }
  bite = { x: Math.round(bite.x), y: Math.round(bite.y) };
  const P = [0, 0.3, 0.62, 0.93, 1].map((k) => ({ x: lerp(homeFeet.x, land.x, k), y: lerp(homeFeet.y, land.y, k) }));
  const back = norm(sub(homeFeet, land));

  // ---- sound on the marks: the declaration's grip goes on until the spin takes over
  const grip = takeCharge(u, 'caxGrip', { volume: 0.8, pan });
  atFrame(u, 'attack', spinF0, () => {
    grip.stop(60);
    play('caxSpin', { volume: 0.95, pan });
  });
  atFrame(u, 'attack', cockF, () => play('caxCock', { volume: 0.9, pan }));
  atFrame(u, 'attack', relF, () => play('caxChop', { volume: 0.9, pan: panAt(land.x) }));

  // ---- the body's path: one clock reads the frame on screen (the steps move during their frames, plant on the next)
  let lastF = -1;
  let fStart = 0;
  let driving = true;
  let at: XY = { ...homeFeet };
  onFrame(sc, (_dt, el) => {
    if (!driving || !u.sprite.active) return false;
    const fi = u.frameInfo();
    if (fi.anim !== 'attack') return true;
    const f = fi.frame;
    if (f !== lastF) {
      lastF = f;
      fStart = el;
      // spin: clods spiral up off the boots
      if (f > spinF0 && f < cockF) spinClods(sc, at, (f - spinF0) / (cockF - spinF0), sgn);
      // plants on entering the frame after each step frame
      const k = stepF.indexOf(f - 1);
      if (k >= 0) {
        const foot = P[k + 1];
        void shake(sc, 90, k === 2 ? 2 : 1);
        plantDust(sc, { x: Math.round(foot.x + sgn * (k % 2 ? -4 : 5)), y: Math.round(foot.y) }, k, back);
        play('caxStep', { volume: [0.5, 0.7, 1][k], pitch: [1, 1.055, 1.11][k], pan: panAt(foot.x) });
      }
    }
    const t = Math.min(1, (el - fStart) / Math.max(1, u.frameMs('attack', f)));
    let lift = 0;
    const si = stepF.indexOf(f);
    if (si >= 0) {
      const e = E.inOutQ(t);
      at = { x: lerp(P[si].x, P[si + 1].x, e), y: lerp(P[si].y, P[si + 1].y, e) };
      lift = Math.round(Math.sin(Math.PI * t) * 2);
    } else if (f === relF) {
      const e = E.inQ(t);
      at = { x: lerp(P[3].x, P[4].x, e), y: lerp(P[3].y, P[4].y, e) };
    } else if (f > relF) at = P[4];
    else at = P[0];
    if (!u.locked) placeAt(u, at, lift);
    return f < conF || driving;
  });

  try {
    // ---- wind-up, spin, cock, steps, chop: the art's own frames, stopped ON the bite frame
    if (s.direct) {
      // no travel: the spin and the cock, then straight into the chop
      await u.playRange('attack', f0, cockF);
      if (u.sprite.active && u.frameInfo().anim === 'attack') await sleep(sc, Math.round(u.frameMs('attack', cockF) * 0.65));
      await u.playRange('attack', relF, conF);
    } else await u.playRange('attack', f0, conF);
    if (!u.sprite.active || u.frameInfo().anim !== 'attack') {
      driving = false;
      return;
    }
    // ---- the BITE
    play('caxBite', { volume: 1, pan: panAt(bite.x) });
    void shake(sc, 110, 2);
    void lightFlash(sc, bite.x, bite.y - 2, PAL.white, 16, 240, { floorY: bite.y, intensity: 0.85 });
    biteChips(sc, bite, back, 9);
    const runMs = s.direct ? 80 : 60;
    const seam = new Seam(sc, { from: bite, to: seamTo, runMs, persistMs: s.blocked ? 640 : s.direct ? 1500 : 1500, fork: s.blocked, spark: !s.blocked });
    const screenR = seamTo.x >= bite.x;
    play(screenR ? 'caxRunR' : 'caxRunL', { volume: s.blocked ? 0.7 : 0.95 });
    await seam.arrived;
    // ---- the climb (the blow lands when the seam reaches the crown)
    let hitAt: XY = s.to;
    if (target && target.sprite.active && target.sprite.visible) {
      play('caxClimb', { volume: 0.9, pan: panAt(target.home.x) });
      const c = climbBody(sc, target, { stepMs: 17, holdMs: 40 });
      await c.top;
      const core = target.core();
      hitAt = { x: Math.round(target.home.x), y: Math.round(core.y) };
    } else if (s.direct) {
      play('caxClimb', { volume: 0.9, pan: panAt(seamTo.x) });
      const h = Math.max(20, Math.round(seamTo.y - (s.to.y - 12)));
      void climbLine(sc, seamTo, h, { stepMs: 17, holdMs: 120, depth: DEPTH.FX + 2 });
      await sleep(sc, 34);
    } else {
      // blocked: the seam dies on the guard's front edge; the blow is the axe ringing in the floor
      hitAt = { x: Math.round(seamTo.x), y: Math.round(s.to.y) };
    }
    s.impact(hitAt);
    if (loses) {
      // the stronger side answers on this frame: the battle owns the attacker now (it dies where it stands)
      driving = false;
      return;
    }
    // ---- hold the bite through the stop, then the heave
    await sleep(sc, 60);
    if (s.blocked) {
      // the axe bounces in the floor; he staggers back one step (the battle plays his recoil pose)
      biteChips(sc, bite, back, 5);
      driving = false;
      const from = { ...at };
      const to = { x: from.x + back.x * 9, y: from.y + back.y * 9 };
      await sleepAnimate(sc, 170, (t) => placeAt(u, { x: lerp(from.x, to.x, E.outQ(t)), y: lerp(from.y, to.y, E.outQ(t)) }, Math.round(Math.sin(Math.PI * t) * 2)));
      at = to;
      await sleep(sc, 120);
    } else {
      driving = false;
      atFrame(u, 'attack', recF, () => {
        play('caxWrench', { volume: 0.85, pan: panAt(bite.x) });
        biteChips(sc, bite, back, 7);
        const sp = new Sparks(sc, unitDepth(bite.y) + 0.4);
        sp.add({ x: bite.x, y: bite.y - 2, vx: back.x * RR(30, 50), vy: -110, ay: 420, life: 460, colors: CLODS, shape: 'sq', size: 3, floor: bite.y + 2, bounce: 0.2, fadeAt: 1 });
        sp.release();
      });
      atFrame(u, 'attack', Math.min(n - 1, recF + 1), () => play('caxShoulder', { volume: 0.8, pan: panAt(at.x) }));
      void u.playRange('attack', recF);
      await sleep(sc, u.frameMs('attack', recF));
    }
    // ---- home in three plain steps (no shake); a direct blow never left the tile
    const from = { ...at };
    if (Math.hypot(from.x - homeFeet.x, from.y - homeFeet.y) < 1) await sleep(sc, u.frameMs('attack', Math.min(n - 1, recF + 1)));
    const stepMs = 105;
    for (let k = 0; k < 3 && Math.hypot(from.x - homeFeet.x, from.y - homeFeet.y) >= 1; k++) {
      const a = { x: lerp(from.x, homeFeet.x, k / 3), y: lerp(from.y, homeFeet.y, k / 3) };
      const b = { x: lerp(from.x, homeFeet.x, (k + 1) / 3), y: lerp(from.y, homeFeet.y, (k + 1) / 3) };
      await sleepAnimate(sc, stepMs, (t) => placeAt(u, { x: lerp(a.x, b.x, E.inOutQ(t)), y: lerp(a.y, b.y, E.inOutQ(t)) }, Math.round(Math.sin(Math.PI * t))));
    }
    placeAt(u, homeFeet);
  } finally {
    driving = false;
    if (u.sprite.active && !u.retired && !u.claimed) {
      placeAt(u, homeFeet);
      const settle = () => {
        if (!u.retired && !u.claimed && u.sprite.active) u.rest();
      };
      if (u.frameInfo().anim === 'attack' && u.sprite.anims.isPlaying) void sleep(sc, 160).then(settle);
      else settle();
    }
  }
}

/** animate(), awaited (a local alias keeps the call sites short). */
function sleepAnimate(sc: Phaser.Scene, ms: number, fn: (t: number) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    onFrame(
      sc,
      (_dt, el) => {
        const t = Math.min(1, el / Math.max(1, ms));
        fn(t);
        return t < 1;
      },
      resolve,
    );
  });
}

if (LOOK_V3) registerStrike(ID, async (s) => (LOOK_V3 ? dagYaran(s) : s.base?.()));

// ---- the struck body's human answer (v3 only): a grunt on a blow, the haft slap on a guarded one. The material sound
// of the body (recipe `body`) plays under it from the reaction kit; this adds the baritone on the very contact frame.
if (LOOK_V3) {
  registerObserver((ev, ctx) => {
    if (ev.type === 'battle') {
      if (ev.targetUid === null || ev.result === 'direct') return;
      const t = ctx.unit(ev.targetUid);
      if (!t || t.cardId !== ID) return;
      const sc = ctx.scene;
      const guard = ev.targetPosition === 'defense';
      const pan = panAt(t.home.x);
      const on = (uid: unknown) => {
        if (uid !== ev.attackerUid) return;
        sc.events.off('v3:contact', on);
        play(guard ? 'caxGuard' : 'caxGrunt', { volume: guard ? 0.9 : 0.75, pan });
      };
      sc.events.on('v3:contact', on);
      void sleep(sc, 5000).then(() => sc.events.off('v3:contact', on));
    } else if (ev.type === 'positionChange' && ev.position === 'defense') {
      const u = ctx.unit(ev.uid);
      if (!u || u.cardId !== ID) return;
      // the haft comes across the chest as a bar on the guard's last in-between frame
      atFrame(u, 'toGuard', 3, () => play('caxGuard', { volume: 0.7, pan: panAt(u.home.x) }), { maxMs: 2000 });
    }
  });
}

export { SEAM_DEPTH };
