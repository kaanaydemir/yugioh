// Kalkan Devi (shield_titan) — its v3 cinematics (?look=v3 only; docs/v3/oturum-f/shield_titan.md §4, §12).
// Every registration below is gated on LOOK_V3: the v1 look keeps today's paths byte for byte (KK-9).
//
// Summon — "Kalkan Kapısı Kalkar" (the drawbridge rises): the copper slab lies face-up on the tile, the giant
//   crouched beside it hauling two leather straps (kdDrawbridgeCreak, sustained to f4); it rises 25/55/80/90°
//   shedding dust off its face, he steps into the grip (kdHeave f7), and on the land frame he PLANTS it (kdPlant):
//   a sideways whole-pixel dust spray, a 2 px shake, the courses lighting bottom → top, the sunstone flaring gold.
// Effect — "Sur Kalkanı" (defenseAtkDebuff500, engine activate right before the battle event): the attacker is held
//   in its declaration charge pose; the titan's `special`: the sunstone opens (kdWardWake), a RAMPART of light rises
//   in four whole-pixel steps on his tile's front edge (masonry courses, staggered joints, crenellations: kdWardWall),
//   and on each of his five shoves a crenellation profile slides down the lane into the attacker (kdSapStep, a
//   descending copper gong ladder G2 F2 D2 C2 A♭1): it is shoved 1 px back, pixels of its own colour peel off its
//   struck face, its plate rolls −100 a pulse (1900 → 1400); the last pulse drains it (kdSapDrain) and a "-500" tag
//   pops; the wall settles into a 1-px rampart line on the tile edge that stays until the blow lands.
//   (The declaration no longer pre-shows the −500 — nor leaks a face-down titan: the attackDeclare layer below
//   puts the attacker's plate back to its real ATK; the ward rolls it down.)
// Defend layer — "Geri Tepme": on the contact frame the rampart flashes back up (blocked: one ring shock from the
//   boss, a last crenellation slams the attacker 2 px, kdRepel, the bricks spall and blink out) or cracks diagonally
//   and bursts (broken: kdWallBreak). Any other blow on the titan rings his plate (kdPlateHit).
// Strike — "Kale Kapısı Düşer" (the gate falls): from the declaration's charge pose (hunched under the lifted slab,
//   kdHeave held) ONE heavy stride (kdStep, a foot-thud puff), the slab tips over the target and swings down
//   edge-first (kdSlabSwing), SLAMS on the contact frame (kdSlabSlam: a stepped 2-row dust wall along the rim, a
//   6 px floor crack under it, the boss flare); blocked: the plate shiver (kdPlateShiver, ±1 px) and a 3 px
//   heel-dust slide back before he walks home; the re-plant (kdPlant ×0.5) on f10.
//   Direct — "Kalkan Kızağı" (the shield sledge): he heaves the slab and drops it flat, kicks it: it skids down the
//   lane boss-up throwing a whole-pixel dust wake (kdSledScrape) and slams into the duelist (contact = arrival);
//   he hauls it home by its strap (a stepped leather line, kdStrapHaul) and heaves it upright.
// Death — "Kapak Kapanır" (the gate closes over him): the sprite's death (he folds, the shield teeters alone, falls
//   back over him like a tomb lid); the cinematic adds the rectangular dust ring + shake on the slam, the copper
//   cooling (kdTarnish), the boss's last gold pulse, and the ward's light rising out of the dead copper on the burst.
// Position — toGuard's "DUNK" (kdPlant on f3); back to attack: the shield drum (kdFistBang on roar f3 / f5).
// No camera moves of its own (EF-8).

import type Phaser from 'phaser';
import { ATTRIBUTE_RAMP, PAL, type Ramp } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import type { AnyMonsterAnim } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent } from '../../engine/types';
import { battleNumbers, currentAtk, currentDef } from '../../engine';
import { DEPTH, LOOK_V3, TILE_H, TILE_W, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, setCombatSfx, sleep } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { pixelText } from '../../ui/text';
import { onDuelStart } from '../../duel/seeds';
import { SAP_PITCH } from '../../audio/v3/shield_titan';
import { registerCardHook, registerEvent, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, dropCharge, fade, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { declarePoseFrame, strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { behindBodies, cardLeaves } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { sourceOwnsDeath } from '../strikes-b/_kit';

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<Ev<T>>;

const ID = 'shield_titan';
const N = (name: string) => `kart-f:${ID}:${name}`;
/** The ward's light (emissive tones: the sunstone's). */
const WARD = { hot: PAL.gold4, lit: PAL.gold3, dim: PAL.gold2, dark: PAL.gold1 } as const;
const DUST = [PAL.earth3, PAL.earth2, PAL.earth1] as const;
const TAU = Math.PI * 2;

// ================================================================ random (per uid, reset per duel)

let rs = 0x5a17;
onDuelStart(() => (rs = 0x5a17));
function seed(n: number): void {
  rs = (Math.imul(n | 0, 2654435761) ^ 0x5a17) >>> 0;
}
function R(): number {
  rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0;
  return rs / 4294967296;
}
const RR = (a: number, b: number): number => a + (b - a) * R();
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const live = (u: MonsterUnit | null | undefined): MonsterUnit | null => (u && !u.retired && u.sprite.active ? u : null);
const norm = (v: XY): XY => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};

/** A frame point of `anim` frame `f` in world space, wherever the sprite stands now. */
function pointOf(u: MonsterUnit, anim: AnyMonsterAnim, f: number, name: 'muzzle' | 'head' | 'core' | 'hand' | 'grip' | 'claw'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** Put the sprite's FEET on a floor point (whole pixels; depth sorted). */
function placeFeet(u: MonsterUnit, feet: XY): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover));
  s.setDepth(unitDepth(feet.y));
}

/** Resolve once `cond` holds, or after `ms`. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((res) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        res();
        return false;
      }
      return true;
    });
  });
}

/** +1 when the titan's player faces right (player 1), −1 for player 2. */
const dirOf = (u: MonsterUnit): 1 | -1 => (u.flipX ? -1 : 1);

// ================================================================ the rampart (wall geometry + painter)

/** The floor line of the titan's tile edge facing the opponent (2 px short at both ends), its mid point. */
interface WallLine {
  a: XY;
  b: XY;
  mid: XY;
  len: number;
  /** unit vector a → b */
  d: XY;
  /** one px of wall THICKNESS, back toward the titan (whole-px screen offset; the wall's top face) */
  n: XY;
}

function wallLine(home: XY, player: 0 | 1): WallLine {
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  // P1 (bottom half): the upper-right edge (top vertex → right vertex); P2: the lower-left edge
  const a0 = player === 0 ? { x: home.x, y: home.y - hh } : { x: home.x - hw, y: home.y };
  const b0 = player === 0 ? { x: home.x + hw, y: home.y } : { x: home.x, y: home.y + hh };
  const d = norm({ x: b0.x - a0.x, y: b0.y - a0.y });
  // 4 px out past the tile edge, toward the opponent: the rampart stands clear of the shield's foot (round 1 #8)
  const m0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const out = norm({ x: m0.x - home.x, y: (m0.y - home.y) * 2 });
  // round 2 #7: 9 px out (was 4) — the rampart stands in the open lane in front of him, its whole face on camera
  const ox = out.x * 9;
  const oy = out.y * 4.5;
  // … and 2 px longer than the tile edge at both ends (round 2 #7: a rampart, not a strip)
  const a = rint({ x: a0.x - d.x * 2 + ox, y: a0.y - d.y * 1 + oy });
  const b = rint({ x: b0.x + d.x * 2 + ox, y: b0.y + d.y * 1 + oy });
  const n = { x: -Math.sign(Math.round(out.x * 10)), y: -Math.sign(Math.round(out.y * 10)) };
  return { a, b, mid: rint({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }), len: Math.hypot(b.x - a.x, b.y - a.y), d, n };
}

/** A point on the wall plane: `s` px along the floor line, `z` px up. Whole pixels. */
function onWall(w: WallLine, s: number, z: number): XY {
  return { x: Math.round(w.a.x + w.d.x * s), y: Math.round(w.a.y + w.d.y * s - z) };
}

interface WallLook {
  /** height in px (0 = the settled rampart line) */
  h: number;
  top: number;
  mortar: number;
  joint: number;
  /** 0 whole · 1 cracked diagonally */
  crack?: number;
  /** skip every other brick row (a fading wall) */
  sparse?: boolean;
  /** fill the bricks (a solid masonry face, round 2 #7); every other brick a step lighter */
  fill?: readonly [number, number];
}

/**
 * The rampart: a vertical plane of light along the tile edge — brick courses (1-px mortar lines every 6 px),
 * staggered vertical joints, a top edge and crenellations (3-px merlons every 6 px). Empty interior (the body
 * stays visible). Never a hex: the generic guard glint is hex, ours is masonry.
 */
function paintWall(g: Raster, w: WallLine, o: WallLook): void {
  const L = Math.floor(w.len);
  const h = Math.round(o.h);
  if (h <= 0) {
    // the settled rampart: the merlon line flat on the edge (1 px), its merlons 1 px up
    for (let s = 0; s <= L; s++) {
      const p = onWall(w, s, 0);
      g.px(p.x, p.y, o.mortar);
      if (s % 6 < 3) {
        const q = onWall(w, s, 1);
        g.px(q.x, q.y, o.top);
      }
    }
    return;
  }
  // solid bricks (a FACE the camera sees, never a ladder of rungs): alternate bricks one tone apart
  if (o.fill) {
    for (let z = 1; z < h; z++) {
      const row = Math.floor(z / 6);
      const off = row % 2 ? 3 : 0;
      for (let s = 1; s < L; s++) {
        const p = onWall(w, s, z);
        g.px(p.x, p.y, o.fill[(Math.floor((s + off) / 6) + row) % 2]);
      }
    }
  }
  // brick courses: 2-px mortar lines (the dominant read: masonry, not a lattice) …
  for (let z = 6; z < h; z += 6) {
    if (o.sparse && (z / 6) % 2 === 0) continue;
    for (let s = 0; s <= L; s++) {
      const p = onWall(w, s, z);
      g.px(p.x, p.y, o.mortar);
      if (z + 1 < h) {
        const q = onWall(w, s, z + 1);
        g.px(q.x, q.y, o.joint);
      }
    }
  }
  // … and short staggered head joints (2 px, every 6 px, offset 3 on alternate courses); the bricks stay empty
  for (let z = 0; z < h; z += 6) {
    const row = z / 6;
    const off = row % 2 ? 3 : 0;
    for (let s = off + 3; s < L - 1; s += 6) {
      for (let k = 3; k <= 4 && z + k < h; k++) {
        const p = onWall(w, s, z + k);
        g.px(p.x, p.y, o.joint);
      }
    }
  }
  // the floor line and the two end posts
  for (let s = 0; s <= L; s++) {
    const p = onWall(w, s, 0);
    g.px(p.x, p.y, o.mortar);
  }
  for (let z = 0; z <= h; z++) {
    const p = onWall(w, 0, z);
    const q = onWall(w, L, z);
    g.px(p.x, p.y, o.joint);
    g.px(q.x, q.y, o.joint);
  }
  // the crest has THICKNESS (round 2 #7): its top face and the merlons' tops are drawn 1–2 px back toward the
  // titan in the shaded tone first, so the rampart reads as a 3-px-deep masonry wall, not a 1-px ladder
  for (let t = 2; t >= 1; t--) {
    const dx = w.n.x * t;
    const dy = Math.round(w.n.y * t * 0.5);
    for (let s = 0; s <= L; s++) {
      const merlon = s % 6 < 3;
      const p = onWall(w, s, h + (merlon ? 3 : 0));
      g.px(p.x + dx, p.y + dy, t === 2 ? o.mortar : o.joint);
      if (s === 0 || s === L) for (let z = 0; z <= h; z += 2) {
        const q = onWall(w, s, z);
        g.px(q.x + dx, q.y + dy, o.joint);
      }
    }
  }
  // the top edge + crenellations (solid merlon blocks 3 × 3 every 6: lit top row, shaded body)
  for (let s = 0; s <= L; s++) {
    const merlon = s % 6 < 3;
    const p = onWall(w, s, h);
    g.px(p.x, p.y, o.top);
    if (merlon) {
      for (let k = 1; k < 3; k++) {
        const q = onWall(w, s, h + k);
        g.px(q.x, q.y, s % 6 === 1 ? o.joint : o.top);
      }
      const q = onWall(w, s, h + 3);
      g.px(q.x, q.y, o.top);
    }
  }
  // cracked: two stepped diagonal fissures through the courses (the wall gives)
  if (o.crack) {
    for (const [s0, dir] of [
      [Math.round(L * 0.3), 1],
      [Math.round(L * 0.7), -1],
    ] as const) {
      for (let z = 1; z < h; z++) {
        const s = s0 + dir * Math.floor(z / 2);
        if (s < 1 || s > L - 1) continue;
        const p = onWall(w, s, z);
        g.px(p.x, p.y, PAL.white);
        g.px(p.x + 1, p.y, o.joint);
      }
    }
  }
}

/** One MERLON BLOCK (round 2 #7: 6 × 6 px, parallel to the wall) whose floor anchor is `at`, `z` px up, flexing 1 px:
 *  a solid face in `c`, its lit top row and leading edge in `lead`, and a 2-px top face back toward the titan. */
function paintPulse(g: Raster, w: WallLine, at: XY, z: number, flex: number, c: number, lead: number): void {
  const H = 6 - flex;
  for (let t = 2; t >= 1; t--) {
    const dx = w.n.x * t;
    const dy = Math.round(w.n.y * t * 0.5);
    for (let i = -3; i <= 2; i++) g.px(Math.round(at.x + w.d.x * i) + dx, Math.round(at.y + w.d.y * i - z - H) + dy, t === 1 ? lead : c);
  }
  for (let i = -3; i <= 2; i++) {
    const x = Math.round(at.x + w.d.x * i);
    const y0 = Math.round(at.y + w.d.y * i - z);
    for (let k = 0; k <= H; k++) g.px(x, y0 - k, k === H || i === -3 ? lead : k === 0 ? WARD.dark : c);
  }
}

// ================================================================ ward state (effect → battle)

interface Ward {
  titan: MonsterUnit;
  attackerUid: number;
  line: WallLine;
  /** the settled rampart line on the edge (until the blow lands) */
  rest: Raster;
  light: LightHandle;
  done: boolean;
}
const wards = new Map<number, Ward>();

function endWard(w: Ward, ms = 160): void {
  if (w.done) return;
  w.done = true;
  wards.delete(w.titan.uid);
  w.rest.destroy();
  void w.light.fadeOut(ms);
  if (!w.titan.retired && w.titan.sprite.active) w.titan.setAura('kdWard', null);
}

// ================================================================ the attack declaration: no early −500

/**
 * battle/declare.ts rolls the attacker's plate to this battle's numbers at the declaration, which shows the −500
 * before the trap window (and, for a face-down titan, tells the attacker what it is). Our layer runs the declaration
 * and puts the attacker's plate straight back to its real ATK in the same tick (the plate is still "tinted", so the
 * battle's own roll-back stays correct); the ward rolls it down pulse by pulse.
 */
function declareLayer(ctx: Ctx<'attackDeclare'>): Promise<void> {
  const ev = ctx.ev;
  if (ev.targetUid === null || ctx.cardId(ev.targetUid) !== ID) return ctx.base();
  let by: number | null = null;
  try {
    by = battleNumbers(ctx.state, ev.attackerUid, ev.targetUid).attackerDebuffBy;
  } catch {
    by = null;
  }
  const p = ctx.base();
  if (by !== ev.targetUid) return p;
  const a = live(ctx.unit(ev.attackerUid));
  if (a) {
    void a.setStats(currentAtk(ctx.state, ev.attackerUid), currentDef(ctx.state, ev.attackerUid), false);
    const img = a.badge.image;
    if (img && img.active) {
      ctx.scene.tweens.killTweensOf(img);
      img.setScale(1);
    }
  }
  return p;
}

// ================================================================ effect: "Sur Kalkanı"

/** The wall's rise: 4 whole-pixel steps (scene ms each). */
const RISE_STEP_MS = 30;
const WALL_H = 42;

async function wardV3(ctx: Ctx<'activate'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const bi = ctx.findType('battle', (e) => e.targetUid === ev.uid);
  const bEv = bi >= 0 ? (ctx.events[bi] as Ev<'battle'>) : null;
  const u = live(ctx.unit(ev.uid));
  const a = bEv ? live(ctx.unit(bEv.attackerUid)) : null;
  if (!u || !a || !bEv || !u.has('special') || !u.sprite.visible || !a.sprite.visible) return ctx.base();
  const pre = currentAtk(ctx.state, bEv.attackerUid);
  const post = bEv.attackerAtk;
  const drop = pre - post;
  if (drop <= 0) return ctx.base();
  seed(ev.uid * 41 + bEv.attackerUid * 7);
  const def = currentDef(ctx.state, bEv.attackerUid);
  // the declaration's hold: its marks go (the rampart is the link now), its charge sound fades — the attacker stays
  // coiled; the hold is kept again for the strike at the end
  const hold = ctx.take('attack');
  (hold as { dropMarks?: () => void } | null)?.dropMarks?.();
  dropCharge(a, 120);
  u.posed = true;
  const player = (u.player === 1 ? 1 : 0) as 0 | 1;
  const line = wallLine(u.home, player);
  const lane = norm({ x: a.home.x - line.mid.x, y: a.home.y - line.mid.y });
  const panU = panAt(u.home.x);
  const panA = panAt(a.home.x);
  const pulses = clamp(Math.ceil(drop / 100), 1, 5);
  const values = Array.from({ length: pulses }, (_, i) => (i === pulses - 1 ? post : pre - 100 * (i + 1)));
  // the wall is drawn UNDER his sprite (P1: the far tile edge, behind him in iso depth; P2: masked by his body where
  // they overlap), so the shield face, the boss and the copper always stay readable (EF-2, round 1 #8)
  const depth = u.sprite.depth - 0.5;
  // ---- f0–f1: weight into the shield, heels dig in; the sunstone wakes (sustained)
  const wake = start('kdWardWake', { volume: 0.9, pan: panU });
  heelDust(sc, u);
  const REL = u.markFrame('special', 'release', 3);
  const REC = u.markFrame('special', 'recover', 10);
  const posed = u.playRange('special', 0, REC);
  // the floor light in front of the shield (stepped up with the iris)
  const pool = lightPool(sc, line.mid.x, line.mid.y, { color: WARD.lit, radius: 16, floorY: line.mid.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  atFrame(u, 'special', 2, () => void pool.setIntensity(0.7, 120), { late: false });
  // ---- f3 release: the rampart rises
  const wall = new Raster(sc, 0, 0, 640, 360, depth);
  let wallH = 0;
  const BRICK = [PAL.gold1, PAL.earth3] as const;
  let wallLook: WallLook = { h: 0, top: WARD.hot, mortar: WARD.lit, joint: WARD.dim, fill: BRICK };
  let wallGone = false;
  const drawWall = () => wall.draw((g) => !wallGone && paintWall(g, line, { ...wallLook, h: wallH }));
  await until(sc, () => !u.sprite.active || (u.frameInfo().anim === 'special' && u.frameInfo().frame >= REL), u.rangeMs('special', 0, REL) + 200);
  wake.stop(60);
  play('kdWardWall', { volume: 0.95, pan: panU });
  void lightFlash(sc, line.mid.x, line.mid.y - 18, WARD.lit, 30, 260, { floorY: line.mid.y, air: 0.6, intensity: 0.9 });
  pool.setIntensity(1, 80);
  for (let k = 1; k <= 4; k++) {
    wallH = Math.round((WALL_H * k) / 4);
    drawWall();
    await sleep(sc, RISE_STEP_MS);
  }
  wallLook = { h: WALL_H, top: WARD.lit, mortar: WARD.lit, joint: WARD.dim, fill: BRICK };
  drawWall();
  // ---- f5–f9: one crenellation pulse per shove
  const fx = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 1);
  const live0 = { x: a.sprite.x, y: a.sprite.y };
  const tx0 = Math.round(u.sprite.x);
  let shoved = 0;
  const flights: Promise<void>[] = [];
  const front = (): XY => {
    const c = a.core();
    return rint({ x: c.x - lane.x * 8, y: c.y - lane.y * 4 + 6 });
  };
  const SHOVE0 = Math.min(u.frameCount('special') - 2, REL + 2);
  const arrived: Promise<void>[] = [];
  for (let i = 0; i < pulses; i++) {
    let done!: () => void;
    arrived.push(new Promise<void>((r) => (done = r)));
    const fi = Math.min(REC - 1, SHOVE0 + i);
    const launch = () => {
      // his shove: the whole sprite drives 1 px toward the attacker on each launch and settles back
      if (live(u)) {
        u.sprite.setX(Math.round(tx0 + dirOf(u)));
        void sleep(sc, 70).then(() => {
          if (live(u)) u.sprite.setX(tx0);
        });
      }
      flights.push(
        pulseFlight(sc, fx, line, lane, front, i).then(() => {
          // arrival: the gong step, the shove, the peel, the plate's −100
          // the steps GROW toward the last one (round 2 #1): the −500 lands on the loudest gong
          play('kdSapStep', { volume: 0.74 + i * 0.06, pan: panA, pitch: SAP_PITCH[Math.min(SAP_PITCH.length - 1, i + (5 - pulses))] });
          if (live(a)) {
            struckFlash(sc, a);
            shoved = Math.min(3, shoved + 1);
            a.sprite.setPosition(Math.round(live0.x + lane.x * shoved * 1.4), Math.round(live0.y + lane.y * shoved));
            peel(sc, a, lane, i);
            // the plate STEPS −100 on the gong (no roll): five equal blows you can count
            void a.setStats(values[i], def, false);
            void a.badge.pop();
          }
          if (i === pulses - 1) play('kdSapDrain', { volume: 0.8, pan: panA });
          done();
        }),
      );
    };
    atFrame(u, 'special', fi, launch, { maxMs: 3000 });
    // a safety: never waits on a frame that does not come
    void sleep(sc, u.rangeMs('special', 0, fi) + 400).then(() => done());
  }
  await Promise.all(arrived);
  await Promise.all(flights);
  // the last pulse: the attacker springs home; the "-500" tag over its plate
  void sleep(sc, 90).then(() => {
    if (live(a) && a.sprite.active) a.sprite.setPosition(Math.round(live0.x), Math.round(live0.y));
  });
  minusTag(sc, a, drop);
  // ---- f9–f10: the wall settles into a 1-px rampart line on the edge (kept until the blow lands)
  for (const h of [24, 12, 4]) {
    wallLook = { h, top: WARD.lit, mortar: WARD.dim, joint: WARD.dark, sparse: h < 20 };
    wallH = h;
    drawWall();
    await sleep(sc, 40);
  }
  wallGone = true;
  wall.destroy();
  fx.destroy();
  const rest = new Raster(sc, 0, 0, 640, 360, DEPTH.SHADOW + 0.5);
  rest.draw((g) => paintWall(g, line, { h: 0, top: WARD.lit, mortar: WARD.dim, joint: WARD.dim }));
  pool.setIntensity(0.45, 160);
  const w: Ward = { titan: u, attackerUid: bEv.attackerUid, line, rest, light: pool, done: false };
  const old = wards.get(u.uid);
  if (old) endWard(old, 0);
  wards.set(u.uid, w);
  u.setAura('kdWard', { destroy: () => endWard(w, 120) });
  await posed;
  u.posed = false;
  u.rest();
  // the attacker goes into the strike from its charge pose (the strike continues from there)
  if (live(a)) a.pose('attack', declarePoseFrame(a));
  if (hold) ctx.keep('attack', hold);
}

/** Heels dig in: two whole-pixel dust puffs behind his feet. */
function heelDust(sc: Phaser.Scene, u: MonsterUnit): void {
  const f = u.worldPoint('feet');
  const back = -dirOf(u);
  const sp = new Sparks(sc, unitDepth(f.y) + 0.2);
  for (let i = 0; i < 6; i++) sp.add({ x: Math.round(f.x + back * RR(6, 14)), y: Math.round(f.y + RR(-1, 1)), vx: back * RR(10, 30), vy: RR(-16, -4), drag: 4, life: RR(200, 300), colors: DUST, shape: 'px', fadeAt: 1 });
  sp.release();
}

/** One crenellation pulse from the wall down the lane into the attacker's front (≈1.3 px/ms, ≤ 8 px a frame). */
async function pulseFlight(sc: Phaser.Scene, fx: Raster, w: WallLine, lane: XY, front: () => XY, i: number): Promise<void> {
  const from = { x: w.mid.x, y: w.mid.y };
  const to0 = front();
  const dist = Math.hypot(to0.x - from.x, to0.y - from.y);
  const ms = clamp(Math.round(dist / 1.3), 90, 200);
  const z0 = 18;
  const trail: { at: XY; z: number }[] = [];
  await animate(sc, ms, (k) => {
    const to = front();
    const at = rint({ x: lerp(from.x, to.x, k), y: lerp(from.y + 0, to.y + 0, k) });
    const z = Math.round(lerp(z0, 0, k));
    trail.unshift({ at, z });
    if (trail.length > 3) trail.pop();
    fx.draw((g) => {
      for (let t = trail.length - 1; t >= 0; t--) {
        const c = t === 0 ? WARD.lit : t === 1 ? WARD.dim : WARD.dark;
        paintPulse(g, w, trail[t].at, trail[t].z, (Math.floor(k * 6) + i) % 2, c, t === 0 ? WARD.hot : c);
      }
    });
  });
  fx.draw(() => undefined);
  void lane;
}

/** The block hits: the attacker's silhouette flashes white, then gold, one frame each (round 2 #7). */
function struckFlash(sc: Phaser.Scene, a: MonsterUnit): void {
  const s = a.sprite;
  s.setTintFill(PAL.white);
  void sleep(sc, 34).then(() => {
    if (s.active) s.setTintFill(WARD.lit);
    return sleep(sc, 34);
  }).then(() => {
    if (s.active) s.clearTint();
  });
}

/** 4–6 CLUMPS (2 × 2) of the attacker's own colour peel off its struck face and blow back (2 palette steps). */
function peel(sc: Phaser.Scene, a: MonsterUnit, lane: XY, i: number): void {
  const ramp: Ramp = ATTRIBUTE_RAMP[a.attribute];
  const c = a.core();
  const sp = new Sparks(sc, a.sprite.depth + 0.3);
  const n = 4 + (i % 3);
  for (let k = 0; k < n; k++)
    sp.add({ x: Math.round(c.x - lane.x * RR(4, 10)), y: Math.round(c.y + RR(-10, 8)), vx: lane.x * RR(40, 80), vy: lane.y * RR(20, 50) + RR(-30, -8), drag: 3, life: RR(220, 320), colors: [ramp[3], ramp[2], ramp[1]], shape: 'sq', size: 2, fadeAt: 1 });
  sp.release();
  void lightFlash(sc, c.x - lane.x * 6, c.y, WARD.lit, 14, 140, { floorY: a.home.y, air: 0.5, intensity: 0.5 });
}

/** The "-500" tag over the attacker's plate (battle-debuff crimson, Turkish UI font), 600 ms, two-step rise. */
function minusTag(sc: Phaser.Scene, a: MonsterUnit, drop: number): void {
  const b = a.badge.image;
  const x = b && b.active ? Math.round(b.x) : Math.round(a.core().x);
  const y = b && b.active ? Math.round(b.y - 10) : Math.round(a.worldPoint('top').y - 6);
  const t = pixelText(sc, x, y, `-${drop}`, { size: 'sm', color: PAL.crim3, align: 'center', originX: 0.5, originY: 1 });
  t.setDepth(DEPTH.FX_TOP + 2);
  void (async () => {
    await sleep(sc, 160);
    if (t.active) t.setY(y - 2);
    await sleep(sc, 160);
    if (t.active) t.setY(y - 4);
    await sleep(sc, 220);
    if (t.active) t.setVisible(false);
    await sleep(sc, 40);
    if (t.active) t.setVisible(true);
    await sleep(sc, 40);
    t.destroy();
  })();
}

// ================================================================ defend layer: "Geri Tepme" (+ the plate's ring)

async function defendV3(ctx: Ctx<'battle'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const tUid = ev.targetUid;
  const u = tUid !== null ? live(ctx.unit(tUid)) : null;
  if (!u || tUid === null) return ctx.base();
  const w = wards.get(tUid) ?? null;
  const defense = ev.targetPosition === 'defense';
  const blocked = ev.result === 'attackerDestroyed' || (ev.result === 'noDestroy' && defense && (ev.targetValue ?? 0) > ev.attackerAtk);
  const tie = ev.result === 'noDestroy' && defense && (ev.targetValue ?? 0) === ev.attackerAtk;
  let fired = false;
  const onContact = (uid: number) => {
    if (fired || uid !== ev.attackerUid) return;
    fired = true;
    sc.events.off('v3:contact', onContact);
    try {
      if (w && !w.done) {
        // the titan's copper OWNS this beat (round 2 #2): the battle's generic block clang / impact sounds, played
        // synchronously right after this event (vfx/combat blockClang, combatImpact), stay off for this call and
        // anything already ringing fades; the hex glint and the water-blue clang graphics are hidden — the masonry
        // rampart is the only shield on screen (precedents: kite_fencer, steppe_spiralhorn, wing_lady, reed_heron)
        setCombatSfx(false);
        queueMicrotask(() => {
          setCombatSfx(true);
          fade(['shieldBlock', 'impactLight', 'impactHeavy'], 12);
        });
        hideGenericGuard(sc, u);
        repel(sc, w, live(ctx.unit(ev.attackerUid)), blocked || tie);
      } else play('kdPlateHit', { volume: 0.6, pan: panAt(u.home.x) });
    } catch (e) {
      console.error('[shield_titan] defend layer', e);
    }
  };
  sc.events.on('v3:contact', onContact);
  try {
    await ctx.base();
  } finally {
    sc.events.off('v3:contact', onContact);
    if (w) endWard(w);
  }
}

/** Hide the generic guard presentation made after this tick (≤ 420 ms): the hex glint (MonsterUnit guardGlint, an ADD
 *  raster at the body's depth + 0.5) and the battle's hex-plate clang (vfx blockClang graphics at DEPTH.FX + 0.1 / 0.2). */
function hideGenericGuard(sc: Phaser.Scene, u: MonsterUnit): void {
  const before = new Set(sc.children.list);
  onFrame(sc, (_dt, el) => {
    const want = u.sprite.depth + 0.5;
    for (const o of sc.children.list) {
      if (before.has(o)) continue;
      if (o.type === 'Image') {
        const im = o as Phaser.GameObjects.Image;
        if (im.blendMode === 1 && Math.abs(im.depth - want) < 0.01 && im.texture.key.startsWith('fx:set:')) im.setVisible(false);
      } else if (o.type === 'Graphics') {
        const g = o as Phaser.GameObjects.Graphics;
        if (Math.abs(g.depth - (DEPTH.FX + 0.1)) < 1e-6 || Math.abs(g.depth - (DEPTH.FX + 0.2)) < 1e-6) g.setVisible(false);
      }
    }
    return el < 420;
  });
}

/** The blow lands on the warded titan: the rampart flashes up and repels it — or is broken. */
function repel(sc: Phaser.Scene, w: Ward, a: MonsterUnit | null, holds: boolean): void {
  w.rest.destroy();
  // the masonry flashes up between the blow and the giant: an attacker that struck from BEHIND him (it teleported to
  // his bare back) meets the rampart on the tile's back edge, not on the shield side
  const aFeet = a && a.sprite.active ? a.worldPoint('feet') : null;
  const behind = !!aFeet && (aFeet.x - w.titan.home.x) * dirOf(w.titan) < -4;
  const line = behind ? wallLine(w.titan.home, (w.titan.player === 1 ? 0 : 1) as 0 | 1) : w.line;
  const r = new Raster(sc, 0, 0, 640, 360, w.titan.sprite.depth + (behind ? 0.5 : -0.5));
  const boss = rint(pointOf(w.titan, 'guard', 0, 'muzzle'));
  const aAt = a && a.sprite.active ? a.worldPoint('feet') : null;
  const lane = aAt ? norm({ x: aAt.x - line.mid.x, y: aAt.y - line.mid.y }) : { x: dirOf(w.titan), y: -0.5 };
  const pan = panAt(line.mid.x);
  if (holds) {
    // panned between the wall and the attacker: the push whoosh carries the shove toward it
    play('kdRepel', { volume: 0.95, pan: aAt ? panAt((line.mid.x + aAt.x) / 2) : pan });
    void lightFlash(sc, line.mid.x, line.mid.y - 16, WARD.hot, 34, 260, { floorY: line.mid.y, air: 0.7, intensity: 1 });
    void animate(sc, 260, (_k, el) => {
      const step = Math.floor(el / 35);
      r.draw((g) => {
        // 2 frames full wall (white top edge, gold bricks), then the spall frames
        if (step < 2) paintWall(g, line, { h: WALL_H, top: PAL.white, mortar: WARD.lit, joint: WARD.dim, fill: [PAL.gold2, PAL.gold1] });
        // one stepped 1-px ring shock out of the boss (EF-7: one ring)
        if (step < 4) g.ring(boss.x, boss.y, 6 + step * 5, Math.round((6 + step * 5) * 0.55), step < 2 ? WARD.hot : WARD.lit);
        // the last crenellation slams the attacker
        if (a && step >= 1 && step < 4) {
          const at = rint({ x: line.mid.x + lane.x * (10 + step * 12), y: line.mid.y + lane.y * (10 + step * 12) });
          paintPulse(g, line, at, 14, step % 2, step < 3 ? WARD.lit : WARD.dim, WARD.hot);
        }
      });
    }).then(() => r.destroy());
    if (a && a.sprite.active) {
      const s = a.sprite;
      void sleep(sc, 70).then(() => {
        if (s.active) s.setPosition(Math.round(s.x + lane.x * 2), Math.round(s.y + lane.y * 1));
      });
    }
    // the wall spalls: its bricks drop as gold / earth pixels that fall 4 px and blink out
    const sp = new Sparks(sc, w.titan.sprite.depth + 0.6);
    for (let i = 0; i < 9; i++) {
      const p = onWall(line, RR(2, line.len - 2), RR(4, WALL_H - 2));
      sp.add({ x: p.x, y: p.y, vy: RR(14, 26), drag: 0.5, delay: 70, life: RR(180, 220), colors: i % 3 ? [WARD.dim, WARD.dark] : [PAL.earth3, PAL.earth2], shape: 'px', fadeAt: 1, flicker: i % 2 === 0 });
    }
    sp.release();
  } else {
    // broken: the bricks crack diagonally and burst out with the blow
    play('kdWallBreak', { volume: 0.9, pan });
    void animate(sc, 110, (_k, el) => {
      r.draw((g) => paintWall(g, line, { h: WALL_H, top: WARD.lit, mortar: WARD.lit, joint: WARD.dim, crack: 1, sparse: el > 55 }));
    }).then(() => r.destroy());
    const sp = new Sparks(sc, DEPTH.FX + 2);
    for (let i = 0; i < 16; i++) {
      const p = onWall(line, RR(0, line.len), RR(2, WALL_H));
      sp.add({ x: p.x, y: p.y, vx: -lane.x * RR(40, 110) + RR(-20, 20), vy: -lane.y * RR(20, 60) - RR(30, 70), ay: 300, floor: line.mid.y + RR(2, 10), bounce: 0.25, delay: 50, life: RR(320, 480), colors: i % 3 ? [WARD.lit, WARD.dim, WARD.dark] : [PAL.earth3, PAL.earth2, PAL.earth1], shape: i % 4 ? 'px' : 'sq', size: 1, fadeAt: 1 });
    }
    sp.release();
  }
  endWard(w, 200);
}

// ================================================================ summon: "Kalkan Kapısı Kalkar"

async function drawbridgeV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home, unit } = S;
  const dir = S.dir;
  const pan = panAt(home.x);
  const creak = start('kdDrawbridgeCreak', { volume: 0.9, pan });
  let heave = null as { stop(ms?: number): void } | null;
  // the slab's one gold step of light under the boss, stepping up as it rises
  const pool = S.glow({ color: WARD.lit, radius: 14, intensity: 0.25, anim: 'breathe', fadeIn: 60, at: { x: home.x + dir * 14, y: home.y } });
  let landed = false;
  const pose = S.pose({
    hologram: false,
    onLand: () => {
      landed = true;
      heave?.stop(60);
      play('kdPlant', { volume: 1, pan });
      // the summon's own climax over the DUNK (round 2 #5): the gate SHUTS — a deep boom with a long wub tail
      play('kdGateBoom', { volume: 0.95, pan });
      plantBurst(sc, unit, home, dir);
      void shake(sc, 170, 2);
      const boss = rint(pointOf(unit, 'summon', unit.markFrame('summon', 'land', 8), 'muzzle'));
      void lightFlash(sc, boss.x, boss.y, WARD.lit, 30, 420, { floorY: home.y, air: 0.8, intensity: 1, ring: true });
      pool.setIntensity(1, 40);
      void sleep(sc, 120).then(() => pool.fadeOut(420));
      void unit.badge.pop();
      // the plant wakes the rampart line on the tile's front edge for a beat (the ward's promise)
      edgeFlash(sc, unit);
    },
  });
  if (!pose) {
    creak.stop(60);
    return;
  }
  // f1–f3: dust slides off the rising face
  // the hinge groans up a notch on each step (25° → 55° → 80°: the pitch steps with the angle, round 2 #5)
  for (const f of [1, 2, 3])
    atFrame(unit, 'summon', f, () => {
      faceDust(sc, unit, f);
      play('kdHinge', { volume: 0.85 + f * 0.05, pan, pitch: [1, 1.12, 1.26][f - 1] });
    }, { late: false });
  atFrame(unit, 'summon', 2, () => pool.setIntensity(0.5, 80), { late: false });
  // f4: upright, rocking: the creak stops; the plate's ring BLOOMS in; the fingers curl over the rim
  atFrame(unit, 'summon', 4, () => {
    creak.stop(80);
    play('kdPlateBloom', { volume: 0.9, pan });
  }, { late: false });
  // f7: he lifts it 2 px — the chest "hup"
  atFrame(unit, 'summon', 7, () => {
    if (!landed) heave = start('kdHeave', { volume: 0.95, pan });
  }, { late: false });
  await pose.done;
  creak.stop(40);
  heave?.stop(40);
}

/** Dust and grit slide off the slab's face as it rises (whole pixels, falling to the tile). */
function faceDust(sc: Phaser.Scene, u: MonsterUnit, f: number): void {
  const rim = pointOf(u, 'summon', f, 'claw');
  const boss = pointOf(u, 'summon', f, 'muzzle');
  const sp = new Sparks(sc, u.sprite.depth + 0.2);
  for (let i = 0; i < 3; i++) {
    const t = R();
    sp.add({ x: Math.round(lerp(boss.x, rim.x, t) + RR(-6, 6)), y: Math.round(lerp(boss.y, rim.y, t)), vx: RR(-6, 6), vy: RR(10, 30), ay: 260, floor: u.home.y + RR(-2, 3), bounce: 0.1, life: RR(320, 460), colors: [PAL.earth3, PAL.earth2], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/** The settled rampart line flashing on the tile's front edge: white → gold → dim, stepped (≈360 ms). */
function edgeFlash(sc: Phaser.Scene, u: MonsterUnit): void {
  const line = wallLine(u.home, (u.player === 1 ? 1 : 0) as 0 | 1);
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.SHADOW + 0.5);
  void animate(sc, 360, (_k, el) => {
    const step = Math.floor(el / 90);
    const look = [
      { top: PAL.white, mortar: WARD.hot },
      { top: WARD.hot, mortar: WARD.lit },
      { top: WARD.lit, mortar: WARD.dim },
      { top: WARD.dim, mortar: WARD.dark },
    ][Math.min(3, step)];
    r.draw((g) => paintWall(g, line, { h: 0, joint: WARD.dim, ...look }));
  }).then(() => r.destroy());
}

/** The plant: a sideways whole-pixel dust spray from the shield's foot — two stepped low clouds rolling out both ways
 *  along the floor (earth3 core, earth2 rim, thinning in 5 steps) plus a few chips kicked up. */
function plantBurst(sc: Phaser.Scene, u: MonsterUnit, home: XY, dir: number): void {
  const foot = rint({ x: home.x + dir * 16, y: home.y });
  const r = new Raster(sc, 0, 0, 640, 360, unitDepth(home.y) + 0.4);
  void animate(sc, 320, (_k, el) => {
    const step = Math.min(4, Math.floor(el / 64));
    r.draw((g) => {
      for (const side of [-1, 1]) {
        const cx = foot.x + side * (8 + step * 7);
        const half = 4 + step * 2;
        const rows = step < 2 ? 4 : step < 4 ? 3 : 2;
        for (let row = 0; row < rows; row++) {
          const w = half - row * 2;
          for (let x = -w; x <= w; x++) {
            if (step >= 3 && (x + row) % 2) continue;
            const edge = Math.abs(x) >= w - 1 || row === rows - 1;
            // it rolls just above the floor line (the plate badge sits on the feet)
            g.px(cx + x, foot.y - 3 - row - (step >> 1), step >= 3 ? PAL.earth3 : edge ? PAL.earth3 : PAL.earth4);
          }
        }
      }
    });
  }).then(() => r.destroy());
  const sp = new Sparks(sc, unitDepth(home.y) + 0.45);
  for (let i = 0; i < 8; i++) {
    const side = i % 2 ? 1 : -1;
    sp.add({ x: Math.round(foot.x + side * RR(2, 6)), y: foot.y - 1, vx: side * RR(50, 90), vy: RR(-50, -24), ay: 300, floor: foot.y + 1, bounce: 0.2, life: RR(260, 360), colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: 'px', fadeAt: 1 });
  }
  sp.release();
  void u;
}

// ================================================================ strike: "Kale Kapısı Düşer" / "Kalkan Kızağı"

async function gateFallV3(s: StrikeArgs): Promise<void> {
  if (s.direct) return sledgeV3(s);
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 53 + (s.target?.uid ?? 3));
  const res = (s.ctx.ev as Ev<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 6);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const REC = u.markFrame('attack', 'recover', CON + 2);
  const STEP = Math.max(f0 + 1, REL - 2);
  const pan = panAt(u.home.x);
  const charge = takeCharge(u, 'kdHeave', { volume: 0.8, pan });
  let released = false;
  const rel = () => {
    if (released) return;
    released = true;
    charge.stop(40);
    play('kdSlabSwing', { volume: 0.85, pan });
  };
  atFrame(u, 'attack', STEP, () => {
    play('kdStep', { volume: 0.8, pan });
    stepPuff(sc, u);
  }, { late: false });
  atFrame(u, 'attack', REL, rel, { late: false });
  // ---- geometry: where he must stand for the contact frame's rim corner to land on the target
  const home = { ...u.home };
  const m = u.art.points ? u.art.points('attack', CON).muzzle : undefined;
  const mz = m ?? u.art.muzzle;
  const off = { x: (u.flipX ? -1 : 1) * (mz.x - u.art.anchorX), y: mz.y - u.art.anchorY };
  const aim = s.to;
  const nd = norm({ x: aim.x - home.x, y: aim.y - home.y });
  const inset = s.blocked ? 9 : 6;
  let feet: XY = { x: aim.x - nd.x * inset - off.x, y: aim.y - nd.y * inset - off.y + 10 };
  // the feet stay on the lane line (no vertical drift off it): project onto home → target floor
  const tg = s.toGround;
  const ld = norm({ x: tg.x - home.x, y: tg.y - home.y });
  const along = (feet.x - home.x) * ld.x + (feet.y - home.y) * ld.y;
  feet = rint({ x: home.x + ld.x * Math.max(0, along), y: home.y + ld.y * Math.max(0, along) });
  // ---- play to the contact frame; ONE heavy stride over the stride frames
  const toStep = u.rangeMs('attack', f0, STEP);
  const strideMs = Math.max(80, u.rangeMs('attack', STEP, CON));
  void u.playRange('attack', f0, CON);
  await sleep(sc, toStep);
  await animate(sc, strideMs, (k) => {
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    placeFeet(u, { x: lerp(home.x, feet.x, e), y: lerp(home.y, feet.y, e) });
  });
  placeFeet(u, feet);
  rel();
  // ---- contact: SLAM
  await until(sc, () => !u.sprite.active || (u.frameInfo().anim === 'attack' && u.frameInfo().frame >= CON), 160);
  // the impact point sits just past the rim corner, on the target's face: the generic contact flash lands on the
  // target, never over the sunstone and the copper at the strongest beat (round 1 #12)
  const rimAt = pointOf(u, 'attack', CON, 'muzzle');
  const at = rint({ x: rimAt.x + nd.x * 6, y: rimAt.y + 4 });
  const floorY = s.target ? s.target.home.y : s.toGround.y;
  // the slab's copper owns the contact (round 2 #2): the generic block clang and impact thuds that the battle plays
  // synchronously inside impact() are skipped (the struck body's own material sound stays)
  hush(['shieldBlock', 'impactLight', 'impactHeavy'], () => s.impact(at));
  play('kdSlabSlam', { volume: s.blocked ? 0.9 : 1, pan: panAt(at.x) });
  slamDust(sc, u, CON, floorY);
  void lightFlash(sc, at.x, at.y, WARD.lit, s.blocked ? 26 : 36, 320, { floorY, air: 0.7, intensity: 0.9 });
  const boss = rint(pointOf(u, 'attack', CON, 'grip'));
  void boss;
  if (loses) return; // the counter claims him on this frame; the gate closes over him (death hook)
  // the re-plant on f(REC+1) (round 2 #4): registered before any await (blocked: in the tick the haul-back claimant
  // starts, below — the claim restarts the anim, which would cancel an earlier mark)
  const replant = () => atFrame(u, 'attack', Math.min(n - 2, REC + 1), () => play('kdPlant', { volume: 0.55, pan }), { late: false, maxMs: 2000 });
  if (!s.blocked) replant();
  // a blocked melee survivor is claimed by battleV3 on this frame and handed a generic recoil once the hit-stop ends
  // (its f0 is upright idle: a one-frame pop from the slam). The haul-back is his recoil: on the first frame time runs
  // again we play attack f(CON+1)… as the claimant, in the same tick, so the slam flows into the re-lifted slab.
  let haul: Promise<void> | null = null;
  if (s.blocked) {
    let took = false;
    haul = new Promise<void>((done) => {
      onFrame(sc, (dt, el) => {
        if (!u.sprite.active || el > 600) {
          done();
          return false;
        }
        if (dt <= 0) return true; // the hit-stop: the contact frame holds
        if (!took) {
          took = true;
          // the rebound is its own beat (round 2 #4): the plate shivers on the first frame after the hit-stop
          play('kdPlateShiver', { volume: 0.9, pan: panAt(at.x) });
          const run = () => u.playRange('attack', CON + 1, undefined, { hold: false });
          const p = u.claimed ? u.asClaimant(run) : run();
          replant();
          void p.then(() => {
            if (u.claimed) u.unclaim();
            done();
          });
        }
        return false;
      });
    });
  }
  if (s.blocked) {
    // the rebound: a 1-px jolt, then the plate shiver (±1 px on 3 frames), a 3 px heel-dust slide back
    const sp = u.sprite;
    const x0 = sp.x;
    const y0 = sp.y;
    const back = { x: -ld.x, y: -ld.y };
    await animate(sc, 150, (_k, el) => {
      if (!sp.active) return;
      const step = Math.floor(el / 30);
      const jit = step === 0 ? 0 : step % 2 ? 1 : -1;
      sp.setPosition(Math.round(x0 + jit), Math.round(y0 + (step === 0 ? -1 : 0)));
    });
    const slideFrom = { x: feet.x, y: feet.y };
    const slideTo = rint({ x: feet.x + back.x * 3, y: feet.y + back.y * 3 });
    heelDust(sc, u);
    await animate(sc, 110, (k) => placeFeet(u, { x: lerp(slideFrom.x, slideTo.x, k), y: lerp(slideFrom.y, slideTo.y, k) }));
    feet = slideTo;
  }
  // ---- recover: haul the shield back up, step home, re-plant
  const rest = haul ?? u.playRange('attack', CON + 1, undefined, { hold: false });
  await sleep(sc, u.rangeMs('attack', CON + 1, REC));
  const backMs = Math.max(120, Math.min(300, u.rangeMs('attack', REC, n) - 60));
  const from = { ...feet };
  if (from.x !== home.x || from.y !== home.y) {
    // two heavy bare-foot steps on the walk home, the straps creaking with them (round 2 #4)
    play('kdStep', { volume: 0.5, pan });
    void sleep(sc, Math.round(backMs * 0.55)).then(() => play('kdStep', { volume: 0.42, pan, pitch: 0.94 }));
    await animate(sc, backMs, (k) => {
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      placeFeet(u, { x: lerp(from.x, home.x, e), y: lerp(from.y, home.y, e) });
    });
  }
  placeFeet(u, home);
  await Promise.race([rest, sleep(sc, 700)]);
  const r0 = u.rest0;
  if (u.sprite.active) u.sprite.setPosition(r0.x, r0.y).setDepth(unitDepth(home.y));
}

/** The stride's foot-thud puff (whole pixels). */
function stepPuff(sc: Phaser.Scene, u: MonsterUnit): void {
  const f = u.worldPoint('feet');
  const sp = new Sparks(sc, unitDepth(f.y) + 0.2);
  for (let i = 0; i < 6; i++) sp.add({ x: Math.round(f.x + RR(-8, 6)), y: Math.round(f.y + RR(-1, 1)), vx: RR(-30, 30), vy: RR(-14, -4), drag: 4, life: RR(200, 280), colors: DUST, shape: 'px', fadeAt: 1 });
  sp.release();
}

/** The slam: a stepped 2-row dust wall along the rim's edge line and a 6 px floor crack under it. */
function slamDust(sc: Phaser.Scene, u: MonsterUnit, f: number, floorY: number): void {
  const rim = pointOf(u, 'attack', f, 'claw');
  const d = dirOf(u);
  const y = Math.round(Math.min(floorY, rim.y + 18));
  const r = new Raster(sc, 0, 0, 640, 360, unitDepth(floorY) + 0.6);
  const cx = Math.round(rim.x);
  void animate(sc, 240, (_k, el) => {
    const step = Math.min(3, Math.floor(el / 60));
    r.draw((g) => {
      // the crack: 6 px stepped under the rim
      for (let i = 0; i < 6; i++) g.px(cx - d * 3 + d * i, y + (i % 3 === 2 ? 1 : 0), i < 3 ? PAL.earth0 : PAL.stone1);
      // the dust wall: two rows rising and thinning
      if (step < 3) {
        const h = 2 + step * 2;
        for (let i = -10; i <= 10; i += 2) {
          const x = cx + i;
          if (step < 2 || (i / 2) % 2 === 0) g.px(x, y - h + ((i / 2) % 2 ? 1 : 0), step < 1 ? PAL.earth4 : PAL.earth3);
          if (step < 2) g.px(x + 1, y - h + 2, PAL.earth2);
        }
      }
    });
  }).then(() => r.destroy());
  const sp = new Sparks(sc, unitDepth(floorY) + 0.7);
  for (let i = 0; i < 8; i++) sp.add({ x: cx + RR(-10, 10), y: y - 1, vx: RR(-40, 40), vy: RR(-60, -30), ay: 300, floor: y + 2, bounce: 0.2, life: RR(260, 380), colors: [PAL.earth3, PAL.earth2, PAL.stone2], shape: 'px', fadeAt: 1 });
  sp.release();
}

/** The cinematic frames the art exposes for the sledge (src/art/monsters-v3/shield_titan.ts `titanSled`). */
type SledKind = 'drop' | 'windup' | 'kick' | 'follow' | 'reach' | 'haul' | 'heave' | 'tip30' | 'tip40' | 'tip60' | 'tip70' | 'slap' | 'sled' | 'sledHot';
type SledPts = { foot: XY; top: XY; hand?: XY };
type SledArt = { titanSled?: (p: PixelCanvas, kind: SledKind, lightFrom?: 'left' | 'right', k?: number) => SledPts };

/** One cinematic frame as an image with the sprite's origin / flip; frame points map to the world like the sprite's. */
class SledFrame {
  readonly r: Raster;
  pts: SledPts | null = null;
  constructor(sc: Phaser.Scene, private readonly u: MonsterUnit, private readonly art: Required<SledArt>, depth: number, private readonly k: number) {
    this.r = new Raster(sc, 0, 0, u.art.w, u.art.h, depth);
    this.r.img.setOrigin(u.sprite.originX, u.sprite.originY).setFlipX(u.flipX);
  }
  show(kind: SledKind): SledPts {
    this.r.begin();
    this.pts = this.art.titanSled(this.r.pc, kind, this.u.player === 1 ? 'right' : 'left', this.k);
    this.r.end();
    return this.pts;
  }
  /** World offset of frame point `c` from the image position (the sprite's own mapping, flip included). */
  off(c: XY): XY {
    const sp = this.u.sprite;
    const p = this.u.framePoint(c.x, c.y);
    return { x: p.x - sp.x, y: p.y - sp.y };
  }
  at(x: number, y: number, depth?: number): void {
    this.r.img.setPosition(Math.round(x), Math.round(y));
    if (depth !== undefined) this.r.img.setDepth(depth);
  }
  /** Place the image so that frame point `c` lands on world point `w`. */
  pin(c: XY, w: XY, depth?: number): void {
    const o = this.off(c);
    this.at(w.x - o.x, w.y - o.y, depth);
  }
  /** World position of frame point `c` as placed now. */
  world(c: XY): XY {
    const o = this.off(c);
    return { x: this.r.img.x + o.x, y: this.r.img.y + o.y };
  }
  destroy(): void {
    this.r.destroy();
  }
}

/**
 * "Kalkan Kızağı": he heaves the slab and lets it FALL forward (40°, 70°: cinematic in-betweens pivoting on its foot),
 * it SLAPS flat on the lane (1-px squash, a dust puff, a 1 px shake), he winds up and KICKS it; it skids head-on down
 * the lane (lying with its long axis along the lane) throwing a whole-pixel dust wake, the open hand trailing the strap;
 * it slams into the duelist (contact = arrival); he hauls it home by the strap and HEAVES it up again (60°, 30°) into
 * the sprite's haul-back frame.
 */
async function sledgeV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const art = u.art as unknown as SledArt;
  seed(u.uid * 59 + 17);
  if (!art.titanSled) return s.base ? s.base() : Promise.resolve();
  const sled: Required<SledArt> = { titanSled: art.titanSled };
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 6);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const n = u.frameCount('attack');
  const pan = panAt(u.home.x);
  const dir = dirOf(u);
  const to = s.toGround;
  const lane = norm({ x: to.x - u.home.x, y: to.y - u.home.y });
  // the lane's slope in the sprite's own (unflipped) frame: the sledge is drawn lying along it
  const k = clamp(lane.y / Math.max(0.2, Math.abs(lane.x)), -0.9, 0.9);
  const charge = takeCharge(u, 'kdHeave', { volume: 0.8, pan });
  atFrame(u, 'attack', Math.max(f0 + 1, REL - 2), () => play('kdStep', { volume: 0.6, pan }), { late: false });
  atFrame(u, 'attack', REL, () => {
    charge.stop(40);
    play('kdSlabSwing', { volume: 0.8, pan });
  }, { late: false });
  // ---- he heaves the slab overhead in place and lets it go (attack f…REL)
  await u.playRange('attack', f0, REL);
  charge.stop(40);
  const sp0 = u.sprite;
  const depth = sp0.depth;
  const giant = new SledFrame(sc, u, sled, depth, k);
  const slab = new SledFrame(sc, u, sled, depth + 0.2, k);
  const wake = new Sparks(sc, depth - 0.1);
  const strap = new Raster(sc, 0, 0, 640, 360, depth + 0.1);
  // the slab's foot stays on this floor point while it falls (just in front of him, on the lane)
  const foot0 = rint({ x: u.home.x + dir * 16, y: u.home.y });
  const showSlab = (kind: SledKind, footAt: XY, d?: number) => {
    const p = slab.show(kind);
    slab.pin(p.foot, footAt, d);
    return p;
  };
  try {
    giant.show('drop');
    giant.at(sp0.x, sp0.y);
    sp0.setVisible(false);
    // ---- the fall: two in-betweens on its foot, then the SLAP
    showSlab('tip40', foot0, depth + 0.2);
    await sleep(sc, 45);
    showSlab('tip70', foot0);
    await sleep(sc, 40);
    showSlab('slap', foot0, unitDepth(foot0.y) + 0.2);
    play('kdPlant', { volume: 0.6, pan });
    void shake(sc, 90, 1);
    slapPuff(sc, slab.world(slab.pts!.foot), slab.world(slab.pts!.top));
    await sleep(sc, 50);
    showSlab('sledHot', foot0);
    // ---- the kick: wind-up, kick (the sledge leaves), follow-through, the open hand on the strap
    giant.show('windup');
    await sleep(sc, 70);
    giant.show('kick');
    play('kdStep', { volume: 0.75, pan });
    const pts = slab.pts!;
    const len = { x: slab.off(pts.top).x - slab.off(pts.foot).x, y: slab.off(pts.top).y - slab.off(pts.foot).y };
    // the slab's FRONT (its top end) arrives at the duelist
    const endFoot = rint({ x: to.x - len.x, y: to.y - len.y });
    const dist = Math.hypot(endFoot.x - foot0.x, endFoot.y - foot0.y);
    const ms = clamp(Math.round(dist / 1.3), 140, 230);
    const scrape = start('kdSledScrape', { volume: 0.9, pan });
    let hand: XY = giant.world(giant.pts!.hand ?? giant.pts!.foot);
    const strapTo = (): XY => slab.world(pts.foot);
    let acc = 0;
    let last = { ...foot0 };
    let pose = 0;
    await animate(sc, ms, (kk, el) => {
      // follow-through, then the open reach (whole poses, no in-place hold)
      const want = el < 60 ? 0 : el < 130 ? 1 : 2;
      if (want !== pose) {
        pose = want;
        giant.show(want === 1 ? 'follow' : 'reach');
        hand = giant.world(giant.pts!.hand ?? giant.pts!.foot);
      }
      const e = kk * (2 - kk) * 0.6 + kk * 0.4;
      const p = rint({ x: lerp(foot0.x, endFoot.x, e), y: lerp(foot0.y, endFoot.y, e) });
      slab.pin(pts.foot, p, unitDepth(p.y) + 0.2);
      acc += Math.hypot(p.x - last.x, p.y - last.y);
      last = p;
      while (acc >= 8) {
        acc -= 8;
        for (let i = 0; i < 2; i++) wake.add({ x: p.x + RR(-3, 3), y: p.y + RR(-2, 1), vx: -lane.x * RR(10, 40) + RR(-14, 14), vy: RR(-26, -8), drag: 3, life: RR(220, 340), colors: DUST, shape: 'px', fadeAt: 1 });
      }
      strapLine(strap, hand, strapTo());
    });
    scrape.stop(60);
    if (pose !== 2) {
      giant.show('reach');
      hand = giant.world(giant.pts!.hand ?? giant.pts!.foot);
    }
    // ---- arrival = contact: the slab slams into the duelist
    hush(['impactHeavy', 'impactLight'], () => s.impact(s.to));
    play('kdSlabSlam', { volume: 0.85, pan: panAt(s.to.x) });
    void lightFlash(sc, s.to.x, s.to.y, WARD.lit, 30, 320, { floorY: s.toGround.y, intensity: 0.9, air: 0.6 });
    // a little bounce back off the duelist
    const bounce = rint({ x: endFoot.x - lane.x * 5, y: endFoot.y - lane.y * 5 });
    slab.show('sled');
    await animate(sc, 90, (kk) => {
      const p = rint({ x: lerp(endFoot.x, bounce.x, kk), y: lerp(endFoot.y, bounce.y, kk) - Math.round(Math.sin(Math.PI * kk) * 2) });
      slab.pin(pts.foot, p);
      strapLine(strap, hand, strapTo());
    });
    // ---- he hauls it home by its strap
    giant.show('haul');
    hand = giant.world(giant.pts!.hand ?? giant.pts!.foot);
    play('kdStrapHaul', { volume: 0.85, pan });
    const hms = clamp(Math.round(dist / 1.2), 150, 230);
    await animate(sc, hms, (kk) => {
      const e = kk * kk * (3 - 2 * kk);
      const p = rint({ x: lerp(bounce.x, foot0.x, e), y: lerp(bounce.y, foot0.y, e) });
      slab.pin(pts.foot, p, unitDepth(p.y) + 0.2);
      if (R() < 0.35) wake.add({ x: p.x + RR(-4, 4), y: p.y + RR(-1, 1), vx: lane.x * RR(10, 30), vy: RR(-14, -4), drag: 4, life: RR(180, 260), colors: DUST, shape: 'px', fadeAt: 1 });
      strapLine(strap, hand, strapTo());
    });
    strap.draw(() => undefined);
    // ---- he heaves it up again on its foot (60°, 30°) into the sprite's haul-back frame
    giant.show('heave');
    showSlab('tip60', foot0, depth + 0.2);
    await sleep(sc, 50);
    showSlab('tip30', foot0);
    await sleep(sc, 45);
  } finally {
    giant.destroy();
    slab.destroy();
    strap.destroy();
    wake.release();
    if (sp0.active) sp0.setVisible(true);
  }
  // ---- the sprite takes over on the haul-back frame (CON+1) and re-plants
  atFrame(u, 'attack', Math.min(n - 2, CON + 3), () => play('kdPlant', { volume: 0.5, pan }), { late: false });
  if (u.sprite.active) {
    plantBurst(sc, u, u.home, dir);
    await Promise.race([u.playRange('attack', CON + 1, undefined, { hold: false }), sleep(sc, 800)]);
  }
}

/** The slap: a whole-pixel dust puff squirting out from under both long sides of the slab. */
function slapPuff(sc: Phaser.Scene, a: XY, b: XY): void {
  const sp = new Sparks(sc, unitDepth(Math.max(a.y, b.y)) + 0.4);
  for (let i = 0; i < 14; i++) {
    const t = (i + 0.5) / 14;
    const side = i % 2 ? 1 : -1;
    sp.add({ x: Math.round(lerp(a.x, b.x, t)), y: Math.round(lerp(a.y, b.y, t)) + (side > 0 ? 2 : -4), vx: RR(-10, 10), vy: side * RR(6, 16) - 10, drag: 4, life: RR(200, 300), colors: DUST, shape: i % 4 ? 'px' : 'sq', size: 1, fadeAt: 1 });
  }
  sp.release();
}

/** The strap: a stepped 1-px leather line from his hand to the sledge (two tones alternating). */
function strapLine(r: Raster, a: XY, b: XY): void {
  r.draw((g) => {
    const n = Math.max(1, Math.round(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y))));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const sag = Math.sin(Math.PI * t) * 3;
      g.px(Math.round(lerp(a.x, b.x, t)), Math.round(lerp(a.y, b.y, t) + sag), Math.floor(i / 2) % 2 ? PAL.earth1 : PAL.earth2);
    }
  });
}

// ================================================================ death: "Kapak Kapanır"

function deathLayers(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const u = live(ctx.views.field.unit(ev.uid));
  if (u && u.has('death')) {
    seed(ev.uid * 29 + 11);
    const n = u.frameCount('death');
    const dis = u.markFrame('death', 'dissolve', 6);
    const slam = Math.min(n - 1, dis + 2);
    const pan = panAt(u.home.x);
    // he kneels (fired late too: a lethal recoil often hands over past f1, where a voice deathStart would miss)
    atFrame(u, 'death', 2, () => {
      const f = u.frameInfo().frame;
      if (f < dis) play('kdKneel', { volume: 0.85, pan });
    }, { maxMs: 4000 });
    // the lid SLAMS flat: dust clumps puffing out along the floor from its long edges, a 1-px thud, a 2 px shake
    atFrame(u, 'death', slam, () => {
      lidDust(sc, u, slam);
      void shake(sc, 160, 2);
    }, { late: false, maxMs: 4000 });
    // the copper cools dark (far → near: the sprite's tarnish), a low sinking ring
    atFrame(u, 'death', Math.min(n - 1, slam + 1), () => play('kdTarnish', { volume: 0.7, pan }), { late: false, maxMs: 4000 });
    // the boss's last gold pulse
    atFrame(u, 'death', n - 1, () => {
      const b = rint(pointOf(u, 'death', n - 1, 'muzzle'));
      void lightFlash(sc, b.x, b.y, WARD.lit, 18, 260, { floorY: u.home.y, air: 0.8, intensity: 0.8 });
    }, { late: false, maxMs: 4000 });
  }
  return lidDeathV3(ctx);
}

/**
 * The death's own ending (deathV3's bookkeeping, without its material shatter and accent sparkles, round 1 #7): the
 * pose plays to the tarnished lid; on its last hold the ward's light LEAVES the dead copper (a short rise of gold motes
 * out of the boss only) and the lid darkens to a silhouette in two steps and is gone; the card is born on that beat.
 */
async function lidDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const u = field.unit(ev.uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible || !u.has('death')) return deathV3(ctx, { fallback: () => ctx.base() });
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as Ev<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : { ...u.home };
  u.badge.setVisible(false);
  u.posed = true;
  let leave: Promise<void> | null = null;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  const born = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[shield_titan] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[shield_titan] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => void (tile.active && tile.destroy())).catch(() => undefined);
    else leave = Promise.resolve();
  };
  sc.events.emit('v3:dying', u);
  const n = u.frameCount('death');
  const pan = panAt(home.x);
  try {
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    const inDeath = () => u.frameInfo().anim === 'death';
    let planned = takePlannedEntry(u);
    if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
      const g = planGuardBreak(u);
      if (g) {
        runGuardBreak(u, g);
        planned = takePlannedEntry(u);
      }
    }
    if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
    if (!inDeath() && u.sprite.active) {
      const st = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', st, undefined, { hold: true }));
    }
    const dis = u.markFrame('death', 'dissolve', Math.max(0, n - 3));
    // the topple GROAN is 420 ms long and peaks on the slam (round 2 #8): it starts on the frame ≈ 420 ms before the
    // slam frame (a late entry: at once, shorter — the slam cuts it)
    const slamF = Math.min(n - 1, dis + 2);
    const TOPPLE = 420;
    // every frame start re-measures the time left to the slam (the pose's real pace, whatever frame it joined on)
    let toppled = false;
    for (let f = 0; f < slamF; f++)
      atFrame(u, 'death', f, () => {
        if (toppled) return;
        const rem = u.rangeMs('death', f, slamF);
        if (rem - TOPPLE >= u.frameMs('death', f) && f < slamF - 1) return;
        toppled = true;
        void sleep(sc, Math.max(0, rem - TOPPLE)).then(() => play('kdTopple', { volume: 1, pan }));
      }, { late: false, maxMs: 4000 });
    atFrame(u, 'death', slamF, () => play('kdLidSlam', { volume: 1, pan }), { late: false });
    await until(sc, () => !u.sprite.active || !inDeath() || u.frameInfo().frame >= n - 1 || !u.sprite.anims.isPlaying, 2400);
    if (u.sprite.active && inDeath()) await sleep(sc, u.frameMs('death', n - 1));
    // ---- the ward's light leaves the dead copper; the lid goes dark and is gone
    if (u.sprite.active) {
      play('kdWardRise', { pan });
      wardLeaves(sc, u);
      born();
      u.sprite.setTint(PAL.earth2);
      await sleep(sc, 50);
      if (u.sprite.active) u.sprite.setTint(PAL.earth0);
      await sleep(sc, 50);
      if (u.sprite.active) u.sprite.setVisible(false).clearTint();
    }
  } catch (e) {
    console.error('[shield_titan] death', e);
  } finally {
    born();
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    sc.events.emit('v3:dead', u);
  }
  await leave;
}

/** The lid's slam dust (round 2 #3: never a closed outline): whole-pixel dust clumps (2–3 px, earth3 / earth2 with an
 *  earth1 shadow row on the floor) puff out from the lid's two LONG edges along the iso floor axes (±0.5 slopes), rise
 *  2–4 px and fall back over ≈ 380 ms — densest at the near edge's middle, thin at the ends; the far edge's clumps
 *  sit behind the lid. The lid itself thuds 1 px into the floor for two frames, and a few chips fly. */
function lidDust(sc: Phaser.Scene, u: MonsterUnit, f: number): void {
  // the lying lid spans x 8–63, rows 60–77 of the frame (the face + its 4-px front edge)
  const c0 = u.framePoint(8, 60);
  const c1 = u.framePoint(63, 77);
  const x0 = Math.round(Math.min(c0.x, c1.x));
  const x1 = Math.round(Math.max(c0.x, c1.x));
  const y0 = Math.round(c0.y) + 4;
  const y1 = Math.round(c1.y);
  const cx = (x0 + x1) / 2;
  const half = (x1 - x0) / 2;
  interface Clump {
    x: number;
    y: number;
    vx: number;
    vy: number;
    w: number;
    rise: number;
    near: boolean;
  }
  const clumps: Clump[] = [];
  const edge = (y: number, near: boolean, count: number) => {
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const x = x0 + 2 + (x1 - x0 - 4) * t + RR(-1.5, 1.5);
      const side = x < cx ? -1 : 1;
      const mid = 1 - Math.abs(x - cx) / half; // 1 in the middle, 0 at the ends
      const dist = RR(7, 11) + mid * 6;
      // out along the iso floor axis away from the lid: (±1, ±0.5)
      clumps.push({ x, y: y + Math.round(RR(-1.5, 1.5)), vx: side * dist * (0.4 + 0.6 * (1 - mid)), vy: (near ? 1 : -1) * dist * RR(0.35, 0.65), w: mid > 0.5 ? 4 : mid > 0.2 ? 3 : 2, rise: Math.round(2 + mid * 2), near });
    }
  };
  edge(y1 + 1, true, 12);
  edge(y0, false, 5);
  const rNear = new Raster(sc, 0, 0, 640, 360, Math.max(u.sprite.depth, unitDepth(u.home.y)) + 0.5);
  const rFar = new Raster(sc, 0, 0, 640, 360, u.sprite.depth - 0.1);
  const MS = 380;
  void animate(sc, MS, (_k, el) => {
    const step = Math.min(9, Math.floor(el / 38));
    const k = step / 9;
    const e = 1 - (1 - k) * (1 - k);
    const z = (c: Clump) => Math.round(Math.sin(Math.PI * Math.min(1, k * 1.3)) * c.rise);
    for (const [r, near] of [
      [rNear, true],
      [rFar, false],
    ] as const) {
      r.draw((g) => {
        for (const c of clumps) {
          if (c.near !== near) continue;
          const w = step >= 7 ? c.w - 1 : c.w;
          if (w <= 0 || (step >= 8 && (Math.round(c.x) & 1))) continue;
          const bx = Math.round(c.x + c.vx * e - w / 2);
          const by = Math.round(c.y + c.vy * e);
          const h = z(c);
          // the shadow row on the floor (only while the clump is up)
          if (h > 0) for (let x = 0; x < w; x++) g.px(bx + x, by, PAL.earth1);
          // the clump: a lit top row, a body row (2 rows while dense, 1 once thinning)
          for (let x = 0; x < w; x++) {
            const lip = x === 0 || x === w - 1;
            if (step < 4 && !lip) g.px(bx + x, by - h - 2, PAL.earth3);
            g.px(bx + x, by - h - 1, step < 5 ? (lip ? PAL.earth3 : PAL.earth4) : PAL.earth3);
            if (step < 7) g.px(bx + x, by - h, PAL.earth2);
          }
        }
      });
    }
  }).then(() => {
    rNear.destroy();
    rFar.destroy();
  });
  // the lid THUDS 1 px into the floor for two frames (a heavy door, not a bar)
  const sp0 = u.sprite;
  const ly = sp0.y;
  sp0.setY(ly + 1);
  void sleep(sc, 60).then(() => {
    if (sp0.active && sp0.y === ly + 1) sp0.setY(ly);
  });
  // edge chips off the near edge
  const sp = new Sparks(sc, Math.max(u.sprite.depth, unitDepth(u.home.y)) + 0.6);
  for (let i = 0; i < 6; i++) sp.add({ x: Math.round(lerp(x0 + 6, x1 - 6, R())), y: y1 - 1, vx: RR(-30, 30), vy: RR(-50, -24), ay: 300, floor: y1 + 2, bounce: 0.2, life: RR(240, 340), colors: DUST, shape: 'px', fadeAt: 1 });
  sp.release();
  void f;
}

/** The ward's light leaves the dead copper: a short, sparse rise of gold motes out of the boss only (≤ 16, whole px,
 *  gone within ~150 ms). */
function wardLeaves(sc: Phaser.Scene, u: MonsterUnit): void {
  const b = rint(pointOf(u, 'death', u.frameCount('death') - 1, 'muzzle'));
  const sp = new Sparks(sc, DEPTH.FX);
  for (let i = 0; i < 16; i++) sp.add({ x: b.x + Math.round(RR(-3, 3)), y: b.y + Math.round(RR(-1, 1)), vx: RR(-14, 14), vy: RR(-110, -60), drag: 1, life: RR(110, 150), delay: (i % 4) * 10, colors: [WARD.hot, WARD.lit, WARD.dim], shape: 'px', fadeAt: 1 });
  sp.release();
  void lightFlash(sc, b.x, b.y, WARD.lit, 16, 160, { floorY: u.home.y, air: 0.8, intensity: 0.7 });
}

// ================================================================ position change: the "DUNK" / the shield drum

function positionLayer(ctx: Ctx<'positionChange'>): Promise<void> {
  const ev = ctx.ev;
  if (ctx.cardId(ev.uid) !== ID) return ctx.base();
  const u = live(ctx.unit(ev.uid));
  if (u) {
    const pan = panAt(u.home.x);
    if (ev.position === 'defense' && u.has('toGuard')) {
      atFrame(u, 'toGuard', 3, () => play('kdPlant', { volume: 0.85, pan }), { late: false, maxMs: 2500 });
      // the DUNK is the guard's only sound (round 2 #2): the shared position change's generic shield bell
      // (summon-b/position.ts, played through this context ~170 ms after the DUNK) is skipped for this event
      const sfx0 = ctx.sfx;
      ctx.sfx = (name, opts) => {
        if (name !== 'shieldBlock') sfx0(name, opts);
      };
      return ctx.base().finally(() => {
        ctx.sfx = sfx0;
      });
    }
    if (ev.position === 'attack') for (const f of [3, 5]) atFrame(u, 'roar', f, () => play('kdFistBang', { volume: f === 3 ? 0.8 : 0.9, pan }), { late: false, maxMs: 2500 });
  }
  return ctx.base();
}

// ================================================================ registrations (v3 only)

if (LOOK_V3) {
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from !== 'hand') return ctx.base();
      await runSummon(ctx, async () => undefined, drawbridgeV3);
    },
    { priority: 20, name: N('summon') },
  );
  registerEvent('attackDeclare', declareLayer, { priority: 20, name: N('declare') });
  registerCardHook(ID, 'effect', (ctx) => wardV3(ctx), { priority: 20, name: N('effect') });
  registerCardHook(ID, 'defend', (ctx) => defendV3(ctx), { priority: 20, name: N('defend') });
  registerStrike(ID, (s) => gateFallV3(s), { priority: 20, name: N('strike') });
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return deathLayers(ctx);
    },
    { priority: 20, name: N('death') },
  );
  registerEvent('positionChange', positionLayer, { priority: 20, name: N('position') });
  // the ward never outlives its battle (a negated attack, the phase / turn moving on, the titan gone, the duel over)
  registerObserver((ev) => {
    if (ev.type !== 'attackNegated' && ev.type !== 'phaseChange' && ev.type !== 'turnStart' && ev.type !== 'gameOver' && ev.type !== 'destroy') return;
    for (const w of [...wards.values()]) if (ev.type !== 'destroy' || ev.uid === w.titan.uid) endWard(w, 120);
  });
}
