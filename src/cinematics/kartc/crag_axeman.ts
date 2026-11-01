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

/** Earth clods spiralling up off the boots during the spin: 3–4 per facing, 2 px, rising 8–12 px on a spiral. */
function spinClods(sc: Phaser.Scene, feet: XY, k: number, sgn: number): void {
  const sp = new Sparks(sc, unitDepth(feet.y) + 0.2);
  const n = 3 + (k > 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = RR(0, TAU);
    const r = RR(8, 14);
    // tangential (the turn's direction) + up: v² / 2g ≈ 8–12 px of rise
    const up = RR(76, 92);
    sp.add({ x: feet.x + Math.cos(a) * r, y: feet.y + Math.sin(a) * r * 0.45, vx: -Math.sin(a) * RR(40, 70) * sgn, vy: -up, ay: 340, life: RR(420, 520), colors: CLODS, shape: 'sq', size: 2, floor: feet.y + RR(0, 2), bounce: 0.25, fadeAt: 1 });
  }
  sp.release();
}

/** Screen x of the front of a unit's FOOTPRINT (its lowest rows, the frame it shows) facing the attacker (`sgn`). */
function floorFront(t: MonsterUnit | null, aim: XY, sgn: number): number {
  if (!t || !t.sprite.active) return aim.x - sgn * 12;
  try {
    const fi = t.frameInfo();
    const pc = monsterFrame(t.cardId, fi.anim ?? 'idle', fi.frame);
    const b = pc.bounds();
    if (!b) return aim.x - sgn * 12;
    let lo = Infinity;
    let hi = -Infinity;
    for (let y = b.y + b.h - 8; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (pc.isOpaque(x, y)) {
          lo = Math.min(lo, x);
          hi = Math.max(hi, x);
        }
    if (lo > hi) return aim.x - sgn * 12;
    const a = t.framePoint(lo, 0).x;
    const c = t.framePoint(hi + 1, 0).x;
    const edge = sgn > 0 ? Math.min(a, c) : Math.max(a, c);
    return sgn > 0 ? Math.max(edge, aim.x - 26) : Math.min(edge, aim.x + 26);
  } catch {
    return aim.x - sgn * 12;
  }
}

/** How far he backs off during the spin (px along the attack axis: the run-up starts behind home). */
export const SPIN_BACK = 7;
/** The three steps' share of the run-up (long, then shorter and quicker: 9 / 7 / 6). */
export const STEP_SPLIT = [0, 9 / 22, 16 / 22, 1] as const;

/**
 * The strike's floor plan (pure; tested): where the axe bites (`gap` px in front of the target's footprint), where he
 * plants for it (the bite less the contact frame's reach), the spin's back-step point, and the four step points.
 */
export function cutPlan(home: XY, aim: XY, front: number, sgn: number, reachX: number, o: { blocked?: boolean } = {}): { bite: XY; land: XY; start: XY; steps: XY[]; dir: XY } {
  const dir = norm(sub(aim, home));
  const along = (x: number): XY => {
    const t = Math.abs(dir.x) > 0.05 ? (x - home.x) / dir.x : 0;
    return { x: home.x + dir.x * t, y: home.y + dir.y * t };
  };
  const gap = o.blocked ? 16 : 5;
  const b = along(front - sgn * gap);
  const bite = { x: Math.round(b.x), y: Math.round(b.y) };
  const land = along(bite.x - reachX);
  const start = { x: home.x - dir.x * SPIN_BACK, y: home.y - dir.y * SPIN_BACK };
  const steps = STEP_SPLIT.map((k) => ({ x: lerp(start.x, land.x, k), y: lerp(start.y, land.y, k) }));
  return { bite, land, start, steps, dir };
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

  // ---- geometry: where the axe bites, where he plants for it, the back-step of the spin, the three step points
  const homeFeet: XY = { ...u.home };
  const bo = biteOffset(u, conF);
  let bite: XY;
  let seamTo: XY;
  let land: XY;
  let SP: XY[];
  if (s.direct) {
    land = { ...homeFeet };
    bite = { x: Math.round(land.x + bo.x), y: Math.round(land.y) };
    seamTo = { x: s.toGround.x, y: s.toGround.y };
    SP = [land, land, land, land];
  } else {
    const aim = s.toGround;
    // the bite lands just in front of the target's FOOTPRINT (blocked: a stride short of the guard, so the seam has
    // room to run up to its front edge and die there)
    const front = floorFront(s.target, aim, sgn);
    const plan = cutPlan(homeFeet, aim, front, sgn, bo.x, { blocked: s.blocked });
    bite = plan.bite;
    land = plan.land;
    SP = plan.steps;
    const dir = plan.dir;
    seamTo = s.blocked ? { x: Math.round(front - sgn * 1), y: Math.round(homeFeet.y + dir.y * ((front - sgn - homeFeet.x) / (Math.abs(dir.x) > 0.05 ? dir.x : 1))) } : { x: aim.x + dir.x * 12, y: aim.y + dir.y * 12 };
  }
  const back = norm(sub(homeFeet, land.x === homeFeet.x && land.y === homeFeet.y ? { x: homeFeet.x + sgn, y: homeFeet.y } : land));

  // ---- sound on the marks: the declaration's grip goes on until the spin takes over
  const grip = takeCharge(u, 'caxGrip', { volume: 0.8, pan });
  atFrame(u, 'attack', spinF0, () => {
    grip.stop(60);
    play('caxSpin', { volume: 0.95, pan });
  });
  atFrame(u, 'attack', cockF, () => play('caxCock', { volume: 0.9, pan }));
  atFrame(u, 'attack', relF, () => play('caxChop', { volume: 0.9, pan: panAt(land.x) }));

  // ---- the body's path, on one clock that reads the frame on screen:
  //   spin    he drifts back SPIN_BACK px (centrifugal), so the run-up starts behind home
  //   cock    held, then in its last 45 % he lunges into step 1
  //   f9–f11  each step frame opens on a PLANT (shake 1 / 1 / 2, dust, pebble, the gravel crunch rising) — the boot
  //           the art shows planted — holds the weight, then slides into the next step in its last half; the third
  //           (the STOMP) holds its whole frame, so the chop starts a full frame (~150 ms) after it
  let lastF = -1;
  let fStart = 0;
  let driving = true;
  let at: XY = { ...homeFeet };
  const glide = (a: XY, b: XY, t: number, from: number): { p: XY; lift: number } => {
    if (t <= from) return { p: a, lift: 0 };
    const k = (t - from) / (1 - from);
    const e = E.inOutQ(k);
    return { p: { x: lerp(a.x, b.x, e), y: lerp(a.y, b.y, e) }, lift: Math.round(Math.sin(Math.PI * k) * 2) };
  };
  onFrame(sc, (_dt, el) => {
    if (!driving || !u.sprite.active) return false;
    const fi = u.frameInfo();
    if (fi.anim !== 'attack') return true;
    const f = fi.frame;
    if (f !== lastF) {
      lastF = f;
      fStart = el;
      // spin: clods spiral up off the boots
      if (f > spinF0 && f <= cockF) spinClods(sc, at, (f - spinF0) / (cockF - spinF0), sgn);
      // the plants: on entering each step frame
      const k = s.direct ? -1 : stepF.indexOf(f);
      if (k >= 0) {
        const foot = SP[k + 1];
        void shake(sc, 90, k === 2 ? 2 : 1);
        plantDust(sc, { x: Math.round(foot.x + sgn * (k % 2 ? -4 : 5)), y: Math.round(foot.y) }, k, back);
        play('caxStep', { volume: [0.5, 0.7, 1][k], pitch: [1, 1.055, 1.11][k], pan: panAt(foot.x) });
      }
    }
    const t = Math.min(1, (el - fStart) / Math.max(1, u.frameMs('attack', f)));
    let lift = 0;
    if (f >= spinF0 && f < cockF) {
      const k = E.outQ(Math.min(1, (f - spinF0 + t) / (cockF - spinF0)));
      at = { x: lerp(homeFeet.x, SP[0].x, k), y: lerp(homeFeet.y, SP[0].y, k) };
    } else if (f === cockF) {
      const g = glide(SP[0], SP[1], t, 0.55);
      at = g.p;
      lift = g.lift;
    } else if (f === stepF[0] || f === stepF[1]) {
      const i = f === stepF[0] ? 1 : 2;
      const g = glide(SP[i], SP[i + 1], t, 0.5);
      at = g.p;
      lift = g.lift;
    } else if (f >= stepF[2]) at = SP[3];
    else at = homeFeet;
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
      const c = climbBody(sc, target, { stepMs: 20, holdMs: 60 });
      await c.top;
      // the blow lands ON the climb column (the kit's contact flash centres on it: an upright oval on the seam, not a
      // blob on the body's front edge)
      const core = target.core();
      hitAt = { x: Math.round(target.home.x), y: Math.round(core.y) };
    } else if (s.direct) {
      play('caxClimb', { volume: 0.9, pan: panAt(seamTo.x) });
      const h = Math.max(20, Math.round(seamTo.y - (s.to.y - 12)));
      void climbLine(sc, seamTo, h, { stepMs: 17, holdMs: 120, depth: DEPTH.FX + 2 });
      await sleep(sc, 34);
    } else {
      // blocked: the seam dies on the guard's front edge (it forks: a tiny "tik"); the blow is the axe ringing in the floor
      play('caxFork', { volume: 0.8, pan: panAt(seamTo.x) });
      play('caxRing', { volume: 0.9, pan: panAt(bite.x) });
      hitAt = { x: Math.round(seamTo.x), y: Math.round(s.to.y) };
    }
    s.impact(hitAt);
    // the seam's own light on the struck body: white (the kit's contact light is the attribute's earth tone)
    if (!s.blocked) void lightFlash(sc, hitAt.x, hitAt.y, PAL.white, 20, 260, { floorY: s.direct ? seamTo.y : s.toGround.y, intensity: 0.8 });
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

// ---- the haft coming across the chest on a position change (the struck body's own sounds — fur / hide, the haft
// slap on a guarded blow, the grunt on a heavy one — are the voice's `struck` set: src/audio/v3/crag_axeman.ts)
if (LOOK_V3) {
  registerObserver((ev, ctx) => {
    if (ev.type === 'positionChange' && ev.position === 'defense') {
      const u = ctx.unit(ev.uid);
      if (!u || u.cardId !== ID) return;
      // the haft comes across the chest as a bar on the guard's last in-between frame
      atFrame(u, 'toGuard', 3, () => play('caxGuard', { volume: 0.7, pan: panAt(u.home.x) }), { maxMs: 2000 });
    }
  });
}

export { SEAM_DEPTH };
