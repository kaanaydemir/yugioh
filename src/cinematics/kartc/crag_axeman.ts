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
//   BITE      f13: the blade's front horn bites the floor a stride (8 px) in front of the target's toes (caxBite): stone
//             chips burst back toward him; the target's ATK/DEF plate steps aside (back at contact + 300 ms); the Yarık
//             RUNS in three visible steps (a gold4 head flaring white on the floor, ~75 ms, caxRunR/L panned from the
//             attacker to the target) while his lunge settles a px, and CLIMBS the target's own body the frame it reaches
//             the toes (caxClimb); s.impact() lands when it reaches the crown, with the dry stone "tak" (caxArrive)
//   heave     f14–f15: the axe wrenched out (chips, a clod; caxWrench), onto the shoulder (caxShoulder); he walks home
//             in three plain drawn steps (no shake; caxScuff). The seam stays ~1.5 s: breathing, one gold4 spark run, faint ticks, a
//             three-step fade (crag_axeman-yarik.ts)
//   blocked   the seam runs to where the line meets the guard and forks 7 px short of it into a "Y" (a white flash at
//             the split, two ±35° prongs over the guard's shadow; no climb), held ~80 ms before the guard answers; the
//             bite pose kicks up in the floor (3 px up, back), he staggers back a step (hitHeavy frames, the haft
//             dragging) and walks home
//   contact   the kit's contact flash and burst are hidden: the seam's own bloom on the climb column is the blow (white
//             band 5 px → 3 px over three frames, the body's pixels beside it a tone lighter, breathing while it holds)
//   loses     no recover / idle frame: struck IN the bite crouch (head snapped back, grip loosening) until his own death
//             reaches the planted-axe frame
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
import { registerEvent, registerObserver, registerStrike, type CinematicContext } from '../api';
import type { GameEvent } from '../../engine/types';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, panAt, play, takeCharge } from '../_v3/sound';
import { E, RR, Sparks, TAU, lerp, norm, onFrame, overlay, seed, sleep, sub } from '../strikes-a/_kit';
import { Seam, SEAM_DEPTH, climbBody, climbLine, linePts } from './crag_axeman-yarik';
import { PixelCanvas } from '../../art/pixel';
import { H, W, drawAxeman, type Pose } from '../../art/monsters-v3/crag_axeman-rig';
import { WALK_POSES, framePose } from '../../art/monsters-v3/crag_axeman-anims';

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

/** How far the spin's centrifugal pull drifts him back (px along the attack axis): the turn is IN PLACE (r3), only the
 * weight swinging round sways him a few px off his mark, so the three steps then carry him forward past home. */
export const SPIN_BACK = 5;
/** The three steps' share of the run-up (long, then shorter and quicker: 9 / 7 / 6). */
export const STEP_SPLIT = [0, 9 / 22, 16 / 22, 1] as const;
/** How far in front of the target's footprint the blade's front horn bites (px along the attack axis): the seam's visible floor run. */
export const BITE_GAP = 8;
/** The buried crescent's front horn lies this far ahead of its edge point (the muzzle): the seam is hidden under it. */
export const BLADE_FRONT = 6;

/**
 * The strike's floor plan (pure; tested): where the axe bites (`BITE_GAP` px in front of the target's footprint), where
 * he plants for it (on the attack line, a contact-frame reach short; the bite is then his feet plus the frame's edge
 * offset), the spin's small centrifugal sway point, and the four step points.
 */
export function cutPlan(home: XY, aim: XY, front: number, sgn: number, reachX: number, o: { blocked?: boolean; reachY?: number } = {}): { bite: XY; land: XY; start: XY; steps: XY[]; dir: XY } {
  const dir = norm(sub(aim, home));
  const along = (x: number): XY => {
    const t = Math.abs(dir.x) > 0.05 ? (x - home.x) / dir.x : 0;
    return { x: home.x + dir.x * t, y: home.y + dir.y * t };
  };
  // the head bites a clear stride of floor short of the footprint, so the seam is SEEN running on the floor before it
  // reaches the toes (the r2 critic: a 3-px run reads as nothing); blocked, a longer stride short (the seam then runs on
  // to the guard's front edge and dies there in its "Y")
  const gap = o.blocked ? 18 : BITE_GAP + BLADE_FRONT;
  const b = along(front - sgn * gap);
  // he plants ON the attack line, a reach short of that point; the bite is then where the contact frame's buried edge
  // ACTUALLY lands (his feet plus the frame's own edge offset, both axes). r3 blocker: the bite used to stay on the line
  // while the blade was drawn a slope × reach (~7–11 px) off it — for P2 the seam started on bare floor below the
  // blade. The seam runs from this bite toward the target (its end and the toes are re-derived from it).
  const land = along(Math.round(b.x) - reachX);
  const bite = { x: Math.round(land.x + reachX), y: Math.round(land.y + (o.reachY ?? 0)) };
  const start = { x: home.x - dir.x * SPIN_BACK, y: home.y - dir.y * SPIN_BACK };
  const steps = STEP_SPLIT.map((k) => ({ x: lerp(start.x, land.x, k), y: lerp(start.y, land.y, k) }));
  return { bite, land, start, steps, dir };
}

/** The buried edge's point at the contact frame relative to the feet (art px → world, flip aware; both axes). */
function biteOffset(u: MonsterUnit, conF: number): XY {
  const pts = u.art.points?.('attack', conF);
  const m = pts?.muzzle ?? u.art.muzzle;
  const sgn = u.flipX ? -1 : 1;
  return { x: sgn * (m.x - u.art.anchorX), y: m.y - u.art.anchorY };
}

/**
 * How many points of a floor line from the bite lie under the attacker's own drawn blade (the frame it shows now): the
 * seam is open there already, hidden under the buried head, and its first VISIBLE pixel touches the blade's edge.
 */
function bladeCover(u: MonsterUnit, a: XY, b: XY): number {
  try {
    const fi = u.frameInfo();
    const pc = monsterFrame(u.cardId, fi.anim ?? 'idle', fi.frame);
    const w0 = u.framePoint(0, 0);
    const w1 = u.framePoint(1, 1);
    const sx = w1.x - w0.x || 1;
    const pts = linePts(a, b);
    let n = 0;
    for (const p of pts) {
      const fx = Math.floor((p.x + 0.5 - w0.x) / sx);
      const fy = Math.floor(p.y + 0.5 - w0.y);
      if (!pc.isOpaque(fx, fy)) break;
      n++;
    }
    return n;
  } catch {
    return 0;
  }
}

/** The point of a line a → b closest to its x = `x` (the screen column of the target's toes). */
function onLineAtX(a: XY, b: XY, x: number): XY {
  const dx = b.x - a.x;
  const t = Math.abs(dx) > 0.5 ? Math.max(0, Math.min(1, (x - a.x) / dx)) : 1;
  return { x: Math.round(a.x + dx * t), y: Math.round(a.y + (b.y - a.y) * t) };
}

/**
 * Where a floor line a → b first meets a unit's drawn body (whole px on the line; the frame it shows): the toes the
 * seam reaches, or the guard's front edge it dies on. null when it never does (no frame, an empty one).
 */
function entryOnLine(t: MonsterUnit | null, a: XY, b: XY): XY | null {
  if (!t || !t.sprite.active) return null;
  try {
    const fi = t.frameInfo();
    const pc = monsterFrame(t.cardId, fi.anim ?? 'idle', fi.frame);
    const w0 = t.framePoint(0, 0);
    const w1 = t.framePoint(1, 1);
    const sx = w1.x - w0.x || 1;
    for (const p of linePts(a, b)) {
      const fx = Math.floor((p.x + 0.5 - w0.x) / sx);
      const fy = Math.floor(p.y + 0.5 - w0.y);
      if (pc.isOpaque(fx, fy) || pc.isOpaque(fx, fy - 1)) return p;
    }
  } catch {
    return null;
  }
  return null;
}

/** The point `d` px back along a line from `p` toward `a`. */
function backOff(p: XY, a: XY, d: number): XY {
  const L = Math.max(1, Math.hypot(p.x - a.x, p.y - a.y));
  return { x: Math.round(p.x + ((a.x - p.x) / L) * d), y: Math.round(p.y + ((a.y - p.y) / L) * d) };
}

/** Rig-drawn canvases for the walk home (step frames that are not sprite frames; cached per light side). */
const WALK = new Map<string, PixelCanvas>();
function walkCanvas(i: number, light: 'left' | 'right'): PixelCanvas {
  const k = `${i}:${light}`;
  let pc = WALK.get(k);
  if (!pc) {
    pc = new PixelCanvas(W, H);
    drawAxeman(pc, WALK_POSES[i], light);
    WALK.set(k, pc);
  }
  return pc;
}

/**
 * Walk the unit from `from` to `to` in `n` plain steps (no shake): a drawn step frame per step on an overlay over the
 * (transparent, still shadow-casting) sprite, 1 px of lift mid-stride, a soft scuff on each plant.
 */
async function walkSteps(sc: Phaser.Scene, u: MonsterUnit, from: XY, to: XY, n: number, stepMs: number, o: { dust?: boolean } = {}): Promise<void> {
  if (!u.sprite.active || Math.hypot(from.x - to.x, from.y - to.y) < 1) return;
  const light: 'left' | 'right' = u.flipX ? 'right' : 'left';
  const ov = overlay(u, walkCanvas(0, light), { depth: u.sprite.depth });
  u.sprite.setAlpha(0);
  try {
    for (let k = 0; k < n; k++) {
      const a = { x: lerp(from.x, to.x, k / n), y: lerp(from.y, to.y, k / n) };
      const b = { x: lerp(from.x, to.x, (k + 1) / n), y: lerp(from.y, to.y, (k + 1) / n) };
      ov.redraw(walkCanvas(k % 2, light));
      await sleepAnimate(sc, stepMs, (t) => {
        placeAt(u, { x: lerp(a.x, b.x, E.inOutQ(t)), y: lerp(a.y, b.y, E.inOutQ(t)) }, Math.round(Math.sin(Math.PI * t)));
        ov.img.setDepth(u.sprite.depth);
      });
      if (o.dust !== false && k < n - 1) plantDust(sc, { x: Math.round(b.x), y: Math.round(b.y) }, 0, norm(sub(a, b)));
      play('caxScuff', { volume: 0.55, pitch: 1 + (k % 2) * 0.05, pan: panAt(b.x) });
    }
    ov.redraw(walkCanvas(2, light));
    placeAt(u, to);
    await sleep(sc, 60);
  } finally {
    ov.destroy();
    if (u.sprite.active) u.sprite.setAlpha(1);
  }
}

/** Hide a unit's ATK/DEF plate while the seam runs over its floor; give it back later (unless the unit is gone). */
function platesOff(units: (MonsterUnit | null)[]): (keep: (u: MonsterUnit) => boolean) => void {
  const hidden = units.filter((u): u is MonsterUnit => !!u && u.sprite.active && u.badge.visible);
  for (const u of hidden) u.badge.setVisible(false);
  let done = false;
  return (keep) => {
    if (done) return;
    done = true;
    for (const u of hidden) if (keep(u) && !u.retired && u.sprite.active && u.sprite.visible) u.badge.setVisible(true);
  };
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
  const result = s.ctx.ev.result;
  const loses = result === 'attackerDestroyed' || result === 'bothDestroyed';
  const targetDies = result === 'targetDestroyed' || result === 'bothDestroyed';
  const target = s.direct || s.blocked ? null : s.target;

  // ---- geometry: where the axe bites, where he plants for it, the spin's sway point, the three step points
  const homeFeet: XY = { ...u.home };
  const bo = biteOffset(u, conF);
  let bite: XY;
  let seamTo: XY;
  let feet: XY | undefined;
  let land: XY;
  let SP: XY[];
  if (s.direct) {
    land = { ...homeFeet };
    bite = { x: Math.round(land.x + bo.x), y: Math.round(land.y + bo.y) };
    seamTo = { x: s.toGround.x, y: s.toGround.y };
    SP = [land, land, land, land];
  } else {
    const aim = s.toGround;
    // the bite lands a stride in front of the target's FOOTPRINT (blocked: further short of the guard, so the seam
    // has room to run up to its front edge and die there)
    const front = floorFront(s.target, aim, sgn);
    const plan = cutPlan(homeFeet, aim, front, sgn, bo.x, { blocked: s.blocked, reachY: bo.y });
    bite = plan.bite;
    land = plan.land;
    SP = plan.steps;
    const dir = plan.dir;
    if (s.blocked) {
      // it dies 7 px in front of the guard's front edge (where the line first meets the drawn guard): the fork (its prongs
      // reach ~4 px on) lies on
      // open floor, never under the guard
      const aimG = { x: aim.x, y: aim.y };
      const hit = entryOnLine(s.target, bite, aimG);
      seamTo = hit ? backOff(hit, bite, 7) : onLineAtX(bite, aimG, front - sgn * 7);
    } else {
      seamTo = { x: Math.round(aim.x + dir.x * 12), y: Math.round(aim.y + dir.y * 12) };
      // the toes: the climb starts the frame the running head reaches them (where the line meets the drawn body)
      feet = entryOnLine(s.target, bite, seamTo) ?? onLineAtX(bite, seamTo, front);
    }
  }
  const back = norm(sub(homeFeet, land.x === homeFeet.x && land.y === homeFeet.y ? { x: homeFeet.x + sgn, y: homeFeet.y } : land));

  // ---- sound on the marks: the declaration's grip goes on until the spin takes over
  const grip = takeCharge(u, 'caxGrip', { volume: 0.8, pan });
  // the plates step aside for the run: the ATK/DEF plates (the target's, and the attacker's own — for P2 it lies in
  // front of him, on the seam's path) sit on the very floor the seam runs over (back at contact + 300 ms, unless that
  // unit dies)
  const plates: { back: ((keep: (x: MonsterUnit) => boolean) => void) | null } = { back: null };
  atFrame(u, 'attack', spinF0, () => {
    grip.stop(60);
    play('caxSpin', { volume: 0.6, pan });
    if (!s.direct) plates.back = platesOff([s.target ?? null, u]);
  });
  atFrame(u, 'attack', cockF, () => play('caxCock', { volume: 0.9, pan }));
  atFrame(u, 'attack', relF, () => play('caxChop', { volume: 0.9, pan: panAt(land.x) }));

  // ---- the body's path, on one clock that reads the frame on screen:
  //   spin    in place: the centrifugal pull sways him SPIN_BACK px off his mark, the steps then carry him past home
  //   cock    held, then in its last 45 % he lunges into step 1
  //   f9–f11  each step frame opens on a PLANT (shake 1 / 1 / 2, dust, pebble, the gravel crunch rising) — the boot
  //           the art shows planted — holds the weight, then slides into the next step in its last half; the third
  //           (the STOMP) holds its whole frame, so the chop starts a full frame (~150 ms) after it
  let lastF = -1;
  let fStart = 0;
  let driving = true;
  /** the bite's settle: the whole weight driven into the floor (px down), then a 1-px lean on along the axis */
  let squash = 0;
  let creep = 0;
  let at: XY = { ...homeFeet };
  /** set when the attacker loses: where it stands for its death */
  let lostAt: XY | null = null;
  const fwd = norm(sub(land, homeFeet.x === land.x && homeFeet.y === land.y ? { x: homeFeet.x - sgn, y: homeFeet.y } : homeFeet));
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
    if (!u.locked) placeAt(u, { x: at.x + fwd.x * creep, y: at.y + fwd.y * creep }, lift - squash);
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
      plates.back?.(() => true);
      return;
    }
    // ---- the BITE
    // (r3 mix: the bite is the onset, the ARRIVAL ~100 ms later is the blow's peak — the number and the flash land on it)
    play('caxBite', { volume: 0.72, pan: panAt(bite.x) });
    // the lunge stays alive while the seam runs and climbs (never a dead frame): pressed 1 px into the floor, back up,
    // then the weight leans on 1 px along the axis as the seam reaches the toes, and settles
    squash = 1;
    void (async () => {
      await sleep(sc, 50);
      squash = 0;
      await sleep(sc, 40);
      creep = 1;
      await sleep(sc, 70);
      squash = 1;
      await sleep(sc, 40);
      squash = 0;
    })();
    void shake(sc, 110, 2);
    void lightFlash(sc, bite.x, bite.y - 2, PAL.white, 16, 240, { floorY: bite.y, intensity: 0.85 });
    biteChips(sc, bite, back, 9);
    // the run: a gold4 head flaring white on the floor, three visible steps from the bite to the toes (~75 ms), then on
    // under the body; blocked, the same three steps up to the guard's front edge
    const runMs = s.direct ? 150 : 75;
    // (the points under the buried blade are open already: the first visible chunk starts AT the blade's edge, P1 and P2)
    const lead = Math.min(BLADE_FRONT + 4, bladeCover(u, bite, seamTo));
    const seam = new Seam(sc, { from: bite, to: seamTo, feet, runMs, tailMs: 50, chunks: s.direct ? 6 : 3, lead, persistMs: s.blocked ? 760 : 1500, fork: s.blocked, spark: !s.blocked });
    const screenR = seamTo.x >= bite.x;
    play(screenR ? 'caxRunR' : 'caxRunL', { volume: s.blocked ? 0.75 : 1 });
    await seam.reached;
    // ---- the climb (the blow lands when the seam reaches the crown)
    let hitAt: XY = s.to;
    if (target && target.sprite.active && target.sprite.visible) {
      play('caxClimb', { volume: 0.9, pan: panAt(target.home.x) });
      const c = climbBody(sc, target, { stepMs: 20, holdMs: 200, bloom: true });
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
      // the Y is SEEN before the guard answers: its split flash and white prongs hold ~80 ms, then the guard's recoil
      await sleep(sc, 80);
    }
    // the kit's contact flash (a white banded oval beside the line) and its shared burst are hidden: the contact IS the
    // seam's own bloom on the climb column (climbBody: white → earth4 in palette steps, symmetric, on the body only)
    const before = sc.children.list.length;
    s.impact(hitAt);
    if (!s.blocked) hideKitContact(sc, before, target && target.sprite.active ? target.sprite.depth : null);
    // the seam ARRIVES: a dry stone "tak" with a low thump under it (the number and the flash land on it)
    if (!s.blocked) play('caxArrive', { volume: 1, pan: panAt(hitAt.x) });
    void sleep(sc, 300).then(() => plates.back?.((x) => !((x === s.target && targetDies) || (x === u && loses))));
    // the seam's own light on the struck body: white (the kit's contact light is the attribute's earth tone)
    if (!s.blocked) void lightFlash(sc, hitAt.x, hitAt.y, PAL.white, 20, 260, { floorY: s.direct ? seamTo.y : s.toGround.y, intensity: 0.8 });
    if (loses) {
      // the stronger side answers on this frame: the battle owns the attacker now (it dies where it stands). r3: no
      // recover / idle frame in between — the bite holds through the stop, then straight into the death's reaction
      // frame where he stands (the death picks it up from there)
      driving = false;
      lostAt = { ...at };
      struckInBite(sc, u, conF);
      return;
    }
    // ---- hold the bite through the stop, then the heave
    await sleep(sc, 60);
    if (s.blocked) {
      // the axe BOUNCES in the stone floor (the haft kicks up out of the bite: 3 px up, falling back 1), then he
      // staggers back a step, the haft dragging, and walks home
      driving = false;
      const bounceUp = u.has('hitHeavy');
      // (the bite pose itself kicks up: the same frame, lifted — never a different axe pose between bite and stagger)
      if (u.pose('attack', conF)) {
        placeAt(u, at, 3);
        biteChips(sc, bite, back, 5);
        await sleep(sc, 50);
        placeAt(u, at, 2);
        await sleep(sc, 50);
        placeAt(u, at, 0);
      }
      const from = { ...at };
      const to = { x: from.x + back.x * 6, y: from.y + back.y * 6 };
      if (bounceUp) {
        const fr = [1, 2, 3];
        for (let i = 0; i < fr.length; i++) {
          u.pose('hitHeavy', fr[i]);
          const a = { x: lerp(from.x, to.x, i / 3), y: lerp(from.y, to.y, i / 3) };
          const b = { x: lerp(from.x, to.x, (i + 1) / 3), y: lerp(from.y, to.y, (i + 1) / 3) };
          await sleepAnimate(sc, 75, (t) => placeAt(u, { x: lerp(a.x, b.x, E.outQ(t)), y: lerp(a.y, b.y, E.outQ(t)) }, i === 0 ? Math.round(Math.sin(Math.PI * t)) : 0));
          if (i === 1) plantDust(sc, { x: Math.round(b.x - sgn * 5), y: Math.round(b.y) }, 0, back);
        }
        u.pose('hitHeavy', 4);
        await sleep(sc, 90);
        u.pose('hitHeavy', 5);
        await sleep(sc, 80);
      } else await sleepAnimate(sc, 200, (t) => placeAt(u, { x: lerp(from.x, to.x, E.outQ(t)), y: lerp(from.y, to.y, E.outQ(t)) }));
      at = to;
    } else {
      driving = false;
      atFrame(u, 'attack', recF, () => {
        play('caxWrench', { volume: 0.62, pan: panAt(bite.x) });
        biteChips(sc, bite, back, 7);
        const sp = new Sparks(sc, unitDepth(bite.y) + 0.4);
        sp.add({ x: bite.x, y: bite.y - 2, vx: back.x * RR(30, 50), vy: -110, ay: 420, life: 460, colors: CLODS, shape: 'sq', size: 3, floor: bite.y + 2, bounce: 0.2, fadeAt: 1 });
        sp.release();
      });
      atFrame(u, 'attack', Math.min(n - 1, recF + 1), () => play('caxShoulder', { volume: 0.8, pan: panAt(at.x) }));
      // the heave and the axe back onto the shoulder, standing where he bit
      placeAt(u, at);
      await u.playRange('attack', recF, Math.min(n - 2, recF + 1));
      await sleep(sc, u.frameMs('attack', Math.min(n - 2, recF + 1)));
    }
    // ---- home in three plain steps (no shake), drawn step frames; a direct blow never left the tile
    if (Math.hypot(at.x - homeFeet.x, at.y - homeFeet.y) < 1) {
      if (!s.blocked) await u.playRange('attack', Math.min(n - 1, recF + 2));
    } else await walkSteps(sc, u, at, homeFeet, 3, s.blocked ? 120 : 110);
    placeAt(u, homeFeet);
  } finally {
    driving = false;
    plates.back?.((x) => !((x === s.target && targetDies) || (x === u && loses)));
    if (u.sprite.active) u.sprite.setAlpha(1);
    if (lostAt && u.sprite.active && !u.retired) {
      // he lost: he stays where he bit, in the reaction frame (never walked or snapped home before he dies)
    } else if (u.sprite.active && !u.retired && !u.claimed) {
      placeAt(u, homeFeet);
      const settle = () => {
        if (!u.retired && !u.claimed && u.sprite.active) u.rest();
      };
      if (u.frameInfo().anim === 'attack' && u.sprite.anims.isPlaying) void sleep(sc, 160).then(settle);
      else settle();
    }
  }
}

/**
 * Hide the shared contact flash the contact call put on the struck body (`fx:cflash:*` images, cropped to nothing: the
 * flash re-applies its visibility every frame) and the shared impact burst just behind the body (_v3/react.ts: the star,
 * the air rings, the grit at the body's depth − 0.45 … − 0.05). Called right after s.impact(), which makes them.
 */
function hideKitContact(sc: Phaser.Scene, before: number, bodyDepth: number | null): void {
  const list = sc.children.list;
  for (let i = before; i < list.length; i++) {
    const o = list[i] as Phaser.GameObjects.GameObject & { texture?: { key: string }; depth?: number; setCrop?: (x: number, y: number, w: number, h: number) => unknown; setVisible?: (v: boolean) => unknown };
    if (o.type === 'Image' && o.texture?.key.startsWith('fx:cflash:') && o.setCrop) o.setCrop(0, 0, 0, 0);
    if (bodyDepth !== null && o.type === 'Graphics' && typeof o.depth === 'number' && o.depth >= bodyDepth - 0.45 && o.depth < bodyDepth - 0.05 && o.setVisible) o.setVisible(false);
  }
}

/** Rig-drawn "struck in the bite" frames (the bite crouch, the head snapped back; then the hands loosening on the haft). */
const STRUCK = new Map<string, PixelCanvas>();
function struckCanvas(conF: number, i: number, light: 'left' | 'right'): PixelCanvas {
  const k = `${conF}:${i}:${light}`;
  let pc = STRUCK.get(k);
  if (!pc) {
    const b = framePose('attack', conF);
    const d: Partial<Pose>[] = [
      { hx: b.hx - 3, hy: b.hy - 1, tilt: -1, eye: 0, bead: -2, cape: 5, mant: 3, chips: 0, spark: 0, crackK: 0.7 },
      { hx: b.hx - 3, hy: b.hy - 2, tilt: -1, eye: 0, sink: b.sink - 2, lean: b.lean - 2, bead: 2, cape: 3, mant: 1, chips: 0, spark: 0, crackK: 0.5 },
      { chips: 0, spark: 0 },
    ];
    pc = new PixelCanvas(W, H);
    drawAxeman(pc, { ...b, ...d[i] }, light);
    STRUCK.set(k, pc);
  }
  return pc;
}

/**
 * He LOST the exchange while his axe is buried in the floor (r3: no standing recoil or idle frame between the bite and
 * his death): the bite holds through the stop, then the counter-blow snaps his head back IN the crouch, his grip
 * loosens — drawn on an overlay over the (transparent, still shadow-casting) sprite whatever recoil the kit plays under
 * it — until his own death reaches the planted-axe frame (death f2: he lets go and rears up behind the axe still buried
 * where he bit). The sprite comes back the frame the death shows it (or after 1.6 s as a safety).
 */
function struckInBite(sc: Phaser.Scene, u: MonsterUnit, conF: number): void {
  const light: 'left' | 'right' = u.flipX ? 'right' : 'left';
  if (!u.sprite.active || u.retired) return;
  const f0 = u.frameInfo();
  if (f0.anim === 'death' && f0.frame >= 2) return;
  // from this very frame: the bite itself (2), then — the frame the counter-blow changes his frame (the kit's recoil or
  // his death starting) — the head snapped back (0), then the grip loosening (1)
  const ov = overlay(u, struckCanvas(conF, 2, light), { depth: u.sprite.depth });
  u.sprite.setAlpha(0);
  // (the death's own start shows the sprite again within the same tick: keep it transparent after every update)
  const hide = () => {
    if (u.sprite.active && u.sprite.alpha !== 0) u.sprite.setAlpha(0);
  };
  sc.events.on('postupdate', hide);
  let k = 2;
  let struckAt = -1;
  onFrame(
    sc,
    (_dt, el) => {
      if (!u.sprite.active || u.retired || el > 1800) return false;
      const fi = u.frameInfo();
      if (fi.anim === 'death' && fi.frame >= 2) return false;
      ov.img.setDepth(u.sprite.depth);
      if (struckAt < 0 && !(fi.anim === 'attack' && fi.frame === conF)) {
        struckAt = el;
        k = 0;
        ov.redraw(struckCanvas(conF, 0, light));
      }
      if (k === 0 && struckAt >= 0 && el - struckAt > 100) {
        k = 1;
        ov.redraw(struckCanvas(conF, 1, light));
      }
      return true;
    },
    () => {
      sc.events.off('postupdate', hide);
      ov.destroy();
      if (u.sprite.active) u.sprite.setAlpha(1);
    },
  );
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

// ================================================================ the idle accent: the axe tapped on the floor (idle f11)

/**
 * The idle's sound (oturum-c-tasarim §2.3 "Idle", §0.5): the stone "tok" of the axe head tapped on the floor between
 * his boots on idle f11 — an ambient tick at most once per 4.5 s across every axeman on the board, never within 2.5 s
 * of a board action, only while the unit stands in its idle loop. No shared ambient-idle hook exists, so each unit
 * carries its own watcher (started on its summon, its strike, a position change, or the first phase / turn change).
 * Sound only: no pixels change.
 */
const idleWatched = new WeakSet<MonsterUnit>();
let idleBusy = false;
const idleClock = new WeakMap<Phaser.Scene, { last: number; contact: number }>();
export function idleTap(sc: Phaser.Scene, u: MonsterUnit): void {
  if (!LOOK_V3 || idleWatched.has(u)) return;
  idleWatched.add(u);
  let st = idleClock.get(sc);
  if (!st) {
    st = { last: -1e9, contact: -1e9 };
    idleClock.set(sc, st);
  }
  const clock = st;
  let prev = -1;
  onFrame(sc, () => {
    if (u.retired || !u.sprite.active) return false;
    const fi = u.frameInfo();
    const f = fi.anim === 'idle' ? fi.frame : -1;
    const now = sc.time.now;
    if (idleBusy) {
      idleBusy = false;
      clock.contact = now;
    }
    if (f === 11 && prev !== 11 && u.sprite.visible && !u.claimed && now - clock.last > 4500 && now - clock.contact > 2500) {
      clock.last = now;
      play('caxTap', { pan: panAt(u.home.x), volume: 0.6 });
    }
    prev = f;
    return true;
  });
}

if (LOOK_V3) {
  registerObserver((ev) => {
    if (ev.type !== 'phaseChange' && ev.type !== 'turnStart') idleBusy = true;
  });
  const scan = async (ctx: CinematicContext<Extract<GameEvent, { type: 'phaseChange' | 'turnStart' }>>) => {
    try {
      for (const u of ctx.views.field.units()) if (u.cardId === ID && !u.retired) idleTap(ctx.scene, u);
    } catch {
      /* never break the event */
    }
    return ctx.base();
  };
  registerEvent('phaseChange', scan, { priority: -50, name: 'kartc:crag_axeman:idle-scan' });
  registerEvent('turnStart', scan, { priority: -50, name: 'kartc:crag_axeman:idle-scan' });
}

if (LOOK_V3)
  registerStrike(ID, async (s) => {
    if (!LOOK_V3) return s.base?.();
    idleTap(s.scene, s.attacker);
    return dagYaran(s);
  });

// ---- the haft coming across the chest on a position change (the struck body's own sounds — fur / hide, the haft
// slap on a guarded blow, the grunt on a heavy one — are the voice's `struck` set: src/audio/v3/crag_axeman.ts)
if (LOOK_V3) {
  registerObserver((ev, ctx) => {
    if (ev.type === 'positionChange' && ev.position === 'defense') {
      const u = ctx.unit(ev.uid);
      if (!u || u.cardId !== ID) return;
      idleTap(ctx.scene, u);
      // the haft comes across the chest as a bar on the guard's last in-between frame
      atFrame(u, 'toGuard', 3, () => play('caxGuard', { volume: 0.7, pan: panAt(u.home.x) }), { maxMs: 2000 });
    }
  });
}

export { SEAM_DEPTH };
