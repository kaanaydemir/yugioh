// Hortlak Muhafız (grim_warden) — "Fener Bekçisi", its v3 cinematics (?look=v3 only; YENI_KARTLAR §8 R2).
// Every registration below is gated on LOOK_V3: the v1 look keeps today's paths byte for byte (KK-9).
//
// Summon (ace, tribute 1) — "the grave opens":
//   0     a grave mound swells on the tile (soil bands, lit top-left); a headstone pushes up out of it;
//         the earth cracks (gwRise: cracking clods, a grinding stone, the soul hum creeping in)
//   ~150  the soul light seeps through the cracks (leaf3 lines, a hot crown, a green light pool flickering)
//   ~330  the warden rises out of the mound on its own `summon` pose, lantern first; on its 2nd frame
//         it shoves the headstone over (gwStone) — it topples and falls flat behind it; clods fly
//   land  the mound breaks apart into a scatter of soil, dust ring, the lantern catches (gwLand)
//   peak  the cut-in (cage helm, the eye ignites: gwRoar on the eye flare); the finale (a leaf-green
//         shock ring, the stepped light) lands as the band leaves
// Effect — "Ruh ışığı emme", on the engine's activate (monsterEffect) event only (after the trap
// window, before the battle; a negated attack never gets here):
//   0     the declaration's charge pose goes: the warden's `special` — the fist draws back, the lantern
//         is thrust out at eye level, the flame dips (inhale)
//   rel   (special 'release') the thread of soul light is drawn out of the target's core in the target's
//         own attribute ramp and runs to the lantern (gwSiphon: the descending glassReverse siphon;
//         gwThread: a sine falling from the target's pitch)
//   +150  the drain beat: the target's plate rolls −400 (showBattlePlates; gwDebuff low bell), the
//         target fades ≈30 % (a bayer share of its pixels one tone darker), the lantern's glass and flame
//         pour full of the stolen colour; the warden drinks on its held frame
//   ~960  the thread thins and snaps into the glass; the warden returns to its charge pose — the
//         strike follows from there (the AttackHold is kept again)
//   after the battle: the target lives → the light flows back (beads run home, gwGiveBack, the fade and
//         the lantern colour step out); the target died → the lantern keeps the colour until the turn
//         ends (gwKeep; an aura on the unit, cleared by an observer on turnStart)
// Strike — "Fener Tırpanı":
//   the attack continues from the declaration's charge pose; the lantern whirls a full circle round the
//   helm (a soul-fire trail follows its live point: green, or the stolen colour), the warden GLIDES
//   toward the target on the whirl (the shroud streaming, soul wisps shed along a faint floor trail,
//   no footfalls), the lantern smashes on the contact frame (the number; heavy hit-stop from the
//   art's weight) — a green soul burst, glass shards bouncing on the target's floor (gwImpact) — the
//   spade-halberd sweeps through on f8 (an iron crescent, gwChop), and it glides home while the chain
//   rewinds into the pendulum. Direct: the burst throws a soul bolt the last stretch to the duelist.
// Death — "boş kefen çöker" (§5.2, no material shatter):
//   the death pose continues the blow; the lantern slips off its chain and shatters on the floor
//   (gwShatter; shards, a green flash), the soul fire escapes as a skull-shaped mist that wails and
//   comes apart as it rises (gwWail), the shroud collapses EMPTY (gwCollapse), the cage helm drops and
//   rocks (gwHelm), and the heap goes out in the last 150 ms in four bayer steps with a little soul ash
//   (gwFade) — the card is born on the tile on that frame and flies to the graveyard.
// No camera moves of its own (EF-8): the summon keeps the base's single tribute lean.

import type Phaser from 'phaser';
import { ATTRIBUTE_RAMP, PAL, RAMPS, type Ramp } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { onDuelStart } from '../../duel/seeds';
import { registerCardHook, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, dropCharge, fade as fadeSnd, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { declarePoseFrame, strikeStartFrame } from '../_v3/clash';
import { showBattlePlates } from '../battle/plates';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { contactFlash } from '../_v3/flash';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { TAU, graveMound, gravestone, knockOut, lanternTint, skullMist, soulFade, soulThread, type LanternTint, type SoulFade } from './grim_warden-fx';

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<Ev<T>>;

const ID = 'grim_warden';
const LEAF: Ramp = RAMPS.leaf;
const IRON = [PAL.stone1, PAL.stone2, PAL.stone3, PAL.stone4, PAL.mist] as const;
const GLASS = [PAL.white, PAL.mist, PAL.leaf1, PAL.stone4] as const;

// ================================================================ random (per uid, reset per duel)

let rs = 0x6a7e;
onDuelStart(() => (rs = 0x6a7e));
function seed(n: number): void {
  rs = (Math.imul(n | 0, 2654435761) ^ 0x6a7e) >>> 0;
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

/** A frame point of `anim` frame `f` in world space, wherever the sprite stands now. */
function pointOf(u: MonsterUnit, anim: Parameters<MonsterUnit['frameCount']>[0], f: number, name: 'muzzle' | 'head' | 'core' | 'staff' | 'hand'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** The live point of the frame the sprite shows now. */
function livePoint(u: MonsterUnit, name: 'muzzle' | 'head' | 'core' | 'staff'): XY {
  const fi = u.frameInfo();
  return fi.anim ? pointOf(u, fi.anim, fi.frame, name) : u.muzzle();
}

/** Put the sprite's FEET on a floor point (whole pixels; depth sorted). */
function placeFeet(u: MonsterUnit, feet: XY): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover));
  s.setDepth(unitDepth(feet.y));
}

// ================================================================ the drain state (effect → battle → turn end)

interface Drain {
  targetUid: number;
  target: MonsterUnit;
  ramp: Ramp;
  fade: SoulFade;
  tint: LanternTint;
  /** The lantern's light on the floor (in the stolen colour). */
  light: LightHandle;
  off: () => void;
}
const drains = new Map<number, Drain>();
/** Wardens whose lantern keeps a stolen colour until the turn ends (uid → that colour's ramp). */
const kept = new Map<number, Ramp>();

function endDrain(d: Drain): void {
  d.off();
  d.fade.destroy();
  void d.light.fadeOut(200);
}

/** A soft follow light at the lantern (the stepped light layer; v3 only). */
function lanternLight(sc: Phaser.Scene, u: MonsterUnit, color: number, k: number): LightHandle {
  const h = lightPool(sc, u.home.x, u.home.y, { color, radius: 18, floorY: u.home.y, air: 0.8, intensity: k, anim: 'flicker', fadeIn: 60 });
  h.follow(() => (live(u) && u.sprite.visible ? livePoint(u, 'muzzle') : null), { floorY: () => u.worldPoint('feet').y });
  return h;
}

/** Pitch factor of a soul's tone (gwThread) by its attribute: fire / light high, earth / water low. */
const SOUL_PITCH: Record<string, number> = { FIRE: 1.19, LIGHT: 1.26, WIND: 1.12, DARK: 0.84, WATER: 0.94, EARTH: 0.79 };

// ================================================================ summon

async function graveRiseV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home, unit } = S;
  const dir = S.dir;
  // the base's one tribute lean (the camera gate keeps it; no new move: EF-8)
  if (S.big) void S.ctx.focus({ x: home.x, y: home.y - 30 }, { zoom: 1.05, ms: 420, pan: 0.3 });
  fadeSnd(['summonCharge'], 160);
  const pan = panAt(home.x);
  const rise = start('gwRise', { volume: 0.9, pan });
  const rx = S.big ? 17 : 14;
  const mound = S.own(graveMound(sc, home, rx, S.depth + 0.4, S.ev.uid * 7 + 3, DEPTH.SHADOW + 0.5));
  const stoneAt = { x: home.x - dir * 9, y: home.y - 6 };
  const stone = S.own(gravestone(sc, stoneAt, (-dir as 1 | -1), S.depth - 0.6));
  const pool = S.glow({ color: PAL.leaf3, radius: rx + 10, intensity: 0, anim: 'flicker', fadeIn: 0 });
  const motes = new Sparks(sc, S.depth + 0.5);
  S.own({ destroy: () => motes.release() });
  let seeping = true;
  const stopMotes = onFrame(sc, (dt) => {
    if (!seeping) return false;
    if (mound.seep > 0.3 && dt > 0 && R() < dt / 40) {
      const a = RR(0, TAU);
      motes.add({ x: Math.round(home.x + Math.cos(a) * rx * 0.6), y: Math.round(home.y + Math.sin(a) * rx * 0.25 - 2), vx: RR(-6, 6), vy: RR(-46, -26), drag: 1, life: RR(260, 420), colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: 'px', fadeAt: 1, flicker: true });
    }
    return true;
  });
  S.own({ destroy: () => ((seeping = false), stopMotes()) });
  // ---- the mound swells, the headstone pushes up, the earth cracks
  void shake(sc, 260, 1);
  await animate(sc, 150, (t) => {
    mound.swell = t;
    stone.rise = Math.min(1, t * 1.3);
    mound.crack = Math.max(0, t * 1.4 - 0.3);
  });
  // ---- the soul light seeps through the cracks
  pool.setIntensity(0.9, 160);
  await animate(sc, 180, (t) => {
    mound.crack = Math.min(1, 0.75 + t);
    mound.seep = t;
  });
  // ---- the warden rises out of the mound, lantern first
  let landed = false;
  let finaled = false;
  const finale = () => {
    if (finaled) return;
    finaled = true;
    void lightFlash(sc, S.coreRest.x, S.coreRest.y, PAL.leaf3, S.big ? 52 : 40, 520, { floorY: home.y, ring: true, intensity: 0.9 });
    S.finale({ ring: S.big ? 88 : 56, ramp: LEAF, freezeMs: S.big ? 50 : 0, sfx: null });
    play('summonBurst', { volume: S.big ? 0.4 : 0.28 });
  };
  const pose = S.pose({
    ramp: LEAF,
    hologram: false,
    onLand: () => {
      landed = true;
      rise.stop(90);
      seeping = false;
      mound.burst = 0.01;
      void animate(sc, 220, (t) => (mound.burst = Math.max(0.01, t))).then(() => sleep(sc, 420)).then(() => mound.destroy());
      pool.setIntensity(1.2, 50);
      void sleep(sc, 90).then(() => pool.fadeOut(360));
      landDust(sc, home, S.big);
      if (!S.cutIn) finale();
    },
  });
  if (!pose) {
    rise.stop(60);
    return;
  }
  // the land mark's own beat (boots on soil, the chain settles, the lantern catches)
  atFrame(unit, 'summon', unit.markFrame('summon', 'land', 6), () => play('gwLand', { volume: 0.9, pan }), { late: false });
  // frame 2: the rising shoulder shoves the headstone over; it falls flat behind
  atFrame(unit, 'summon', 2, () => {
    stone.pose = 1;
    play('gwStone', { volume: 0.75, pan });
    clods(sc, home, rx, 7);
    void sleep(sc, 90).then(() => {
      stone.pose = 2;
      dust(sc, { x: stoneAt.x - dir * 4, y: stoneAt.y + 1 }, 5);
    });
  });
  // the mound sinks as the body climbs out of it
  void animate(sc, Math.max(60, pose.ms.land - 40), (t) => {
    if (!landed) mound.swell = 1 - 0.6 * t;
  });
  if (S.cutIn) {
    await pose.peak;
    await S.climax();
    finale();
    await S.wait(110);
  } else {
    await pose.done;
    finale();
  }
  // the fallen headstone and the soil stay a beat, then go out (stepped)
  void sleep(sc, 260).then(() => {
    stone.destroy();
    mound.destroy();
  });
}

/** Floor dust ring at the landing (soil tones, whole pixels). */
function landDust(sc: Phaser.Scene, at: XY, big: boolean): void {
  const sp = new Sparks(sc, DEPTH.FX);
  const n = big ? 14 : 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    sp.add({ x: at.x + Math.cos(a) * 7, y: at.y + Math.sin(a) * 3, vx: Math.cos(a) * 64, vy: Math.sin(a) * 26 - 8, drag: 5, life: 300, colors: [PAL.earth3, PAL.earth2, PAL.earth1], shape: 'puff', size: 1.5, fadeAt: 1 });
  }
  sp.release();
}

function dust(sc: Phaser.Scene, at: XY, n: number): void {
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < n; i++) sp.add({ x: at.x + RR(-4, 4), y: at.y + RR(-1, 1), vx: RR(-30, 30), vy: RR(-18, -4), drag: 4, life: RR(220, 320), colors: [PAL.stone3, PAL.stone2, PAL.earth1], shape: 'puff', size: 1, fadeAt: 1 });
  sp.release();
}

/** Clods of soil thrown off the mound (bounce on the floor). */
function clods(sc: Phaser.Scene, at: XY, rx: number, n: number): void {
  const sp = new Sparks(sc, DEPTH.FX);
  for (let i = 0; i < n; i++) {
    const a = RR(-Math.PI, 0);
    sp.add({ x: at.x + Math.cos(a) * rx * 0.5, y: at.y - 3, vx: Math.cos(a) * RR(30, 70), vy: RR(-90, -50), ay: 320, floor: at.y + RR(-3, 4), bounce: 0.3, life: RR(380, 520), colors: [PAL.earth2, PAL.earth1, PAL.earth0], shape: 'sq', size: R() < 0.4 ? 2 : 1, fadeAt: 1 });
  }
  sp.release();
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from !== 'hand') return ctx.base();
      await runSummon(ctx, async () => undefined, graveRiseV3);
    },
    { priority: 20, name: 'kart-b:grim_warden:summon' },
  );

// ================================================================ effect: the soul-light drain

/** Ms (scene) the warden drinks on its held frame after the thread reached the lantern. */
const DRINK_MS = 280;

async function drainV3(ctx: Ctx<'activate'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const bi = ctx.findType('battle', (e) => e.attackerUid === ev.uid);
  const bEv = bi >= 0 ? (ctx.events[bi] as Ev<'battle'>) : null;
  const u = live(ctx.unit(ev.uid));
  const tUid = bEv?.targetUid ?? null;
  const t = tUid !== null ? live(ctx.unit(tUid)) : null;
  if (!u || !t || tUid === null || !u.has('special')) return ctx.base();
  seed(ev.uid * 41 + tUid * 7);
  // the declaration's hold: its marks go (the thread is the link now), its charge sound fades — the
  // pose is ours until the hold is kept again for the strike
  const hold = ctx.take('attack');
  (hold as { dropMarks?: () => void } | null)?.dropMarks?.();
  dropCharge(u, 120);
  u.posed = true;
  const ramp = ATTRIBUTE_RAMP[t.attribute];
  const pan = panAt(u.home.x);
  // the drain object lives on into the battle (the strike burns in its colour; the battle hook ends it)
  drains.get(u.uid) && endDrain(drains.get(u.uid)!);
  const fadeT = soulFade(sc, t);
  const tint = lanternTint(sc, u, ramp);
  const light = lanternLight(sc, u, PAL.leaf3, 0.5);
  const onDying = (x: MonsterUnit) => {
    if (x === t) fadeT.destroy();
    if (x === u) {
      tint.destroy();
      void light.fadeOut(120);
    }
  };
  sc.events.on('v3:dying', onDying);
  const d: Drain = { targetUid: tUid, target: t, ramp, fade: fadeT, tint, light, off: () => sc.events.off('v3:dying', onDying) };
  drains.set(u.uid, d);
  // ---- the special: draw back, thrust the lantern out, inhale; play up to the held drinking frame
  const REL = u.markFrame('special', 'release', 5);
  const HOLD = Math.min(u.frameCount('special') - 2, REL + 2);
  const toRel = u.rangeMs('special', 0, REL);
  const posed = u.playRange('special', 0, HOLD);
  // the target notices: it is marked by three soul dots turning round its core (the thread's anchor)
  await sleep(sc, toRel);
  // ---- release: the thread is drawn out of the target and runs to the lantern
  const soulAt = () => (live(t) && t.sprite.visible ? rint(t.core()) : rint(t.home));
  const lantern = () => rint(livePoint(u, 'muzzle'));
  const thread = soulThread(sc, soulAt, lantern, ramp, DEPTH.FX + 1);
  const siphon = start('gwSiphon', { volume: 0.95, pan });
  play('gwThread', { volume: 0.7, pan: panAt(t.home.x), pitch: SOUL_PITCH[t.attribute] ?? 1 });
  const beam = lightBeam(sc, soulAt(), lantern(), ramp[3], 0, { width: 6, intensity: 0, shimmer: 0.5 });
  void lightFlash(sc, lantern().x, lantern().y, PAL.leaf4, 18, 200, { floorY: u.home.y, air: 0.9, intensity: 0.8 });
  const stopBeam = onFrame(sc, () => {
    if (!beam.alive) return false;
    beam.setEnds(soulAt(), lantern());
    return true;
  });
  const REACH_MS = 150;
  beam.setIntensity(0.8, REACH_MS);
  await animate(sc, REACH_MS, (k) => {
    thread.reach = k * k * (3 - 2 * k);
    fadeT.set(0.1 * k);
  });
  thread.reach = 1;
  // ---- the drain beat: −400 on the target's plate, it fades, the lantern pours full of its colour
  showBattlePlates({ state: ctx.state, ev: { attackerUid: ev.uid, targetUid: tUid } }, u, t);
  play('gwDebuff', { volume: 0.8, pan: panAt(t.home.x) });
  void lightFlash(sc, lantern().x, lantern().y, ramp[3], 26, 300, { floorY: u.home.y, air: 0.9, intensity: 1 });
  light.setColor(ramp[3]).setIntensity(1, 160);
  drainSpark(sc, t);
  await posed;
  holdFrameTremble(sc, u, HOLD, DRINK_MS);
  await animate(sc, DRINK_MS, (k) => {
    fadeT.set(0.1 + 0.2 * Math.min(1, k * 1.6));
    tint.set(Math.min(1, k * 1.4));
  });
  tint.set(1);
  // ---- the thread thins in steps and snaps into the glass
  siphon.stop(110);
  await animate(sc, 100, (k) => (thread.width = 1 - k));
  thread.destroy();
  stopBeam();
  void beam.fadeOut(120);
  void lightFlash(sc, lantern().x, lantern().y, ramp[4], 16, 180, { floorY: u.home.y, air: 1, intensity: 0.9 });
  // ---- back to the strike's charge pose (the recovery a little brisker: the strike follows)
  await u.playRange('special', HOLD + 1, u.frameCount('special') - 1, { timeScale: 1.35 });
  const f = declarePoseFrame(u);
  await u.playRange('attack', 0, f);
  if (hold) ctx.keep('attack', hold);
  else u.posed = false;
}

/** The held drinking frame: the lantern trembles a whole pixel on uneven beats (never static). */
function holdFrameTremble(sc: Phaser.Scene, u: MonsterUnit, f: number, ms: number): void {
  const s = u.sprite;
  const x0 = s.x;
  let k = 0;
  void animate(sc, ms, (_t, el) => {
    if (!s.active || u.frameInfo().anim !== 'special') return;
    const step = Math.floor(el / 70);
    if (step !== k) {
      k = step;
      if (step % 3 === 1) u.pose('special', f - 1);
      else u.pose('special', f);
    }
  }).then(() => {
    if (s.active) s.x = x0;
  });
}

/** A crisp flare of the target's ramp at its plate as the −400 lands (whole pixels, 3 frames). */
function drainSpark(sc: Phaser.Scene, t: MonsterUnit): void {
  const b = t.badge.image;
  if (!b || !b.active || !b.visible) return;
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  const r = Raster.around(sc, x, y, 40, 20, DEPTH.FX_TOP);
  void animate(sc, 150, (k) =>
    r.draw((g) => {
      const n = Math.round(4 + 10 * k);
      g.line(x - n, y, x - n + 3, y, k < 0.5 ? PAL.white : PAL.crim3);
      g.line(x + n - 3, y, x + n, y, k < 0.5 ? PAL.white : PAL.crim3);
    }),
  ).then(() => r.destroy());
}

/** After the battle: the target lives → the light flows back; it died → the lantern keeps the colour. */
async function afterBattle(ctx: Ctx<'battle'>, u: MonsterUnit | null, d: Drain): Promise<void> {
  const sc = ctx.scene;
  const alive = ctx.locate(d.targetUid, 'next') !== null && live(d.target) !== null && d.target.sprite.visible;
  if (!u || !live(u)) {
    endDrain(d);
    d.tint.destroy();
    return;
  }
  if (alive) {
    // the borrowed light flows home: the thread runs back for a beat, the fade and the colour step out
    const t = d.target;
    const thread = soulThread(sc, () => rint(t.core()), () => rint(livePoint(u, 'muzzle')), d.ramp, DEPTH.FX + 1);
    thread.flow = -1;
    thread.reach = 1;
    thread.width = 0.5;
    play('gwGiveBack', { volume: 0.8, pan: panAt(t.home.x) });
    await animate(sc, 260, (k) => {
      d.fade.set(0.3 * (1 - k));
      d.tint.set(1 - k);
      thread.width = k < 0.7 ? 0.5 : 0.2;
    });
    thread.destroy();
    endDrain(d);
    d.tint.destroy();
    void lightFlash(sc, t.core().x, t.core().y, d.ramp[3], 22, 220, { floorY: t.home.y, intensity: 0.6 });
    return;
  }
  // the target died: the lantern keeps its colour until the turn ends
  endDrain(d);
  play('gwKeep', { volume: 0.7, pan: panAt(u.home.x) });
  const light = lanternLight(sc, u, d.ramp[3], 0.6);
  kept.set(u.uid, d.ramp);
  u.setAura('grimLantern', {
    destroy: () => {
      d.tint.destroy();
      void light.fadeOut(160);
    },
  });
}

if (LOOK_V3) {
  registerCardHook(ID, 'effect', (ctx) => drainV3(ctx), { priority: 20, name: 'kart-b:grim_warden:effect' });
  // the battle the drain belongs to: after it, the light flows back or the lantern keeps it
  registerCardHook(
    ID,
    'attack',
    async (ctx) => {
      await ctx.base();
      const d = drains.get(ctx.ev.attackerUid);
      if (!d) return;
      drains.delete(ctx.ev.attackerUid);
      await afterBattle(ctx, live(ctx.unit(ctx.ev.attackerUid)), d);
    },
    { priority: 20, name: 'kart-b:grim_warden:attack' },
  );
  // the kept lantern colour ends with the turn (and never outlives a duel / a lost unit)
  registerObserver((ev, ctx) => {
    if (ev.type !== 'turnStart' && ev.type !== 'gameOver') return;
    for (const uid of [...kept.keys()]) {
      ctx.unit(uid)?.setAura('grimLantern', null);
      kept.delete(uid);
    }
    for (const [uid, d] of [...drains]) {
      endDrain(d);
      d.tint.destroy();
      drains.delete(uid);
    }
  });
}

// ================================================================ strike: "Fener Tırpanı"

/** The whirl's soul-fire trail: the lantern's live point traced on the frames it whirls, stepped out. */
function whirlTrail(sc: Phaser.Scene, u: MonsterUnit, ramp: Ramp, untilF: number): () => void {
  const r = new Raster(sc, 0, 0, 640, 360, u.sprite.depth + 0.3);
  const pts: { p: XY; age: number }[] = [];
  let alive = true;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    const fi = u.frameInfo();
    const whirling = fi.anim === 'attack' && fi.frame >= 1 && fi.frame <= untilF;
    if (whirling && u.sprite.visible) {
      const p = rint(livePoint(u, 'muzzle'));
      const last = pts[pts.length - 1];
      if (!last || last.p.x !== p.x || last.p.y !== p.y) pts.push({ p, age: 0 });
    }
    for (const q of pts) q.age += dt;
    while (pts.length && pts[0].age > 200) pts.shift();
    r.img.setDepth(u.sprite.depth + 0.3);
    r.draw((g) => {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const age = b.age;
        const c = age < 50 ? PAL.white : age < 100 ? ramp[4] : age < 150 ? ramp[3] : ramp[2];
        g.line(a.p.x, a.p.y, b.p.x, b.p.y, c, 1, age < 100 ? 2 : 1);
      }
    });
    return alive && (whirling || pts.length > 0);
  }, () => r.destroy());
  return () => {
    alive = false;
    stop();
  };
}

/** The glide's floor trail: faint soul marks under the hem and wisps shed off the shroud. */
function glideTrail(sc: Phaser.Scene, u: MonsterUnit, ramp: Ramp): () => void {
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.SHADOW + 0.5);
  const wisps = new Sparks(sc, u.sprite.depth - 0.2);
  const marks: { x: number; y: number; age: number }[] = [];
  let alive = true;
  let acc = 0;
  let lastX = u.sprite.x;
  let lastY = u.sprite.y;
  const stop = onFrame(sc, (dt) => {
    if (!alive && !marks.length) return false;
    const s = u.sprite;
    if (alive && s.active) {
      const moved = Math.hypot(s.x - lastX, s.y - lastY);
      acc += moved;
      if (acc >= 3) {
        acc = 0;
        const f = u.worldPoint('feet');
        marks.push({ x: Math.round(f.x + RR(-3, 3)), y: Math.round(f.y + RR(-1, 1)), age: 0 });
        wisps.add({ x: Math.round(f.x - Math.sign(s.x - lastX || 1) * RR(4, 10)), y: Math.round(f.y - RR(6, 22)), vx: -(s.x - lastX) * 8, vy: RR(-30, -10), drag: 3, life: RR(220, 320), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'px', fadeAt: 1, flicker: true });
      }
      lastX = s.x;
      lastY = s.y;
    }
    for (const m of marks) m.age += dt;
    while (marks.length && marks[0].age > 360) marks.shift();
    floor.draw((g) => {
      for (const m of marks) {
        const c = m.age < 120 ? ramp[3] : m.age < 240 ? ramp[2] : ramp[1];
        g.px(m.x, m.y, c);
        g.px(m.x + 1, m.y, c);
      }
    });
    return true;
  }, () => {
    floor.destroy();
    wisps.release();
  });
  return () => {
    alive = false;
    void stop;
  };
}

/** The lantern's soul burst at the contact point (a stepped ring, rays, glass shards bouncing). */
function soulBurst(sc: Phaser.Scene, at: XY, floorY: number, ramp: Ramp, small: boolean, depth: number): void {
  const r = Raster.around(sc, at.x, at.y, 90, 70, depth);
  const R0 = small ? 9 : 14;
  void animate(sc, 200, (k, el) => {
    r.draw((g) => {
      const step = Math.min(3, Math.floor(el / 50));
      const rad = Math.round(R0 * (0.4 + 0.25 * step));
      // the core (2 frames) then the ring stepping out and thinning
      if (step === 0) {
        g.disc(at.x, at.y, 3, ramp[4]);
        g.disc(at.x, at.y, 1, PAL.white);
      }
      g.ring(at.x, at.y, rad, Math.round(rad * 0.8), step < 2 ? ramp[4] : ramp[3], 1);
      if (step < 2) g.ring(at.x, at.y, rad - 1, Math.round(rad * 0.8) - 1, ramp[3], 1);
      // eight short rays, flickering
      for (let i = 0; i < 8; i++) {
        if ((i + step) % 2 === 1 && step > 0) continue;
        const a = (i / 8) * TAU + 0.2;
        const r0 = rad + 1;
        const r1 = rad + (small ? 3 : 5) - step;
        g.line(at.x + Math.cos(a) * r0, at.y + Math.sin(a) * r0 * 0.8, at.x + Math.cos(a) * r1, at.y + Math.sin(a) * r1 * 0.8, step === 0 ? PAL.white : ramp[4]);
      }
      void k;
    });
  }).then(() => r.destroy());
  // glass shards: whole pixels, bouncing on the struck body's floor, blinking out
  const sp = new Sparks(sc, depth + 0.1);
  const n = small ? 8 : 14;
  for (let i = 0; i < n; i++) {
    const a = RR(0, TAU);
    const v = RR(50, 120);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 40, ay: 360, floor: floorY + RR(-3, 3), bounce: 0.35, life: RR(380, 560), colors: [GLASS[i % GLASS.length], PAL.stone4, PAL.stone3], shape: 'px', fadeAt: 1, flicker: i % 3 === 0 });
  }
  for (let i = 0; i < (small ? 5 : 9); i++) {
    const a = RR(0, TAU);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(20, 50), vy: RR(-60, -25), drag: 2, life: RR(260, 420), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/** The halberd's iron crescent through the low line (f8): 3 px arc, white → mist → steel, 2 frames. */
function chopCrescent(sc: Phaser.Scene, at: XY, dir: 1 | -1, small: boolean): void {
  const r = Raster.around(sc, at.x, at.y, 70, 50, DEPTH.FX + 2);
  const R0 = small ? 12 : 17;
  void animate(sc, 110, (_k, el) => {
    const step = el < 55 ? 0 : 1;
    r.draw((g) => {
      // from up-behind the target down through its front (screen angles), facing-aware
      const a0 = -2.3;
      const a1 = 0.5 + step * 0.3;
      const n = 22;
      for (let i = 0; i <= n; i++) {
        const a = lerp(a0, a1, i / n);
        const ax = Math.cos(a) * dir;
        const ay = Math.sin(a) * 0.75;
        const tip = i > n * (step === 0 ? 0.25 : 0.55);
        if (!tip) continue;
        const cols = step === 0 ? [PAL.white, PAL.mist, IRON[3]] : [PAL.mist, IRON[3], IRON[2]];
        for (let k = 0; k < 3; k++) g.px(Math.round(at.x + ax * (R0 - k)), Math.round(at.y + ay * (R0 - k)), cols[k]);
      }
    });
  }).then(() => r.destroy());
}

/** Direct attack: the burst throws a soul bolt the last stretch to the duelist (≈100 ms). */
async function soulBolt(sc: Phaser.Scene, from: XY, to: XY, ramp: Ramp): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.FX_TOP - 1);
  const ms = clamp(Math.round(Math.hypot(to.x - from.x, to.y - from.y) * 0.9), 80, 160);
  const trail: XY[] = [];
  await animate(sc, ms, (k) => {
    const e = k * k;
    const p = rint({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) - Math.sin(Math.PI * k) * 8 });
    trail.unshift(p);
    if (trail.length > 6) trail.pop();
    r.draw((g) => {
      for (let i = trail.length - 1; i >= 1; i--) g.line(trail[i].x, trail[i].y, trail[i - 1].x, trail[i - 1].y, i < 2 ? ramp[4] : i < 4 ? ramp[3] : ramp[2], 1, i < 3 ? 3 : 1);
      g.disc(p.x, p.y, 2, PAL.white);
    });
  });
  r.destroy();
}

async function scytheV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  seed(u.uid * 53 + (s.target?.uid ?? 3));
  const res = (s.ctx.ev as Ev<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  const drain = drains.get(u.uid);
  const ramp: Ramp = drain && drain.tint ? drain.ramp : LEAF;
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 5);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const REC = u.markFrame('attack', 'recover', CON + 3);
  const pan = panAt(u.home.x);
  // the gathering voice (the declaration's when the strike follows it at once), the whirl, the throw
  const charge = takeCharge(u, 'gwCharge', { volume: 0.85, pan });
  let relSounded = false;
  const rel = () => {
    if (relSounded) return;
    relSounded = true;
    charge.stop(40);
    play('gwRelease', { volume: 0.85, pan });
  };
  if (REL - 1 > f0) atFrame(u, 'attack', REL - 1, () => u.frameInfo().frame === REL - 1 && play('gwSwing', { volume: 0.8, pan }), { late: false });
  atFrame(u, 'attack', REL, rel, { late: false });
  atFrame(u, 'attack', CON + 2, () => play('gwChop', { volume: loses ? 0.5 : 0.8, pan: panAt(u.sprite.x) }), { late: false });
  // ---- geometry: where the warden must stand for the contact frame's lantern to land on the target
  const home = { ...u.home };
  const m = u.art.points ? u.art.points('attack', CON).muzzle : undefined;
  const mz = m ?? u.art.muzzle;
  const off = { x: (u.flipX ? -1 : 1) * (mz.x - u.art.anchorX), y: mz.y - u.art.anchorY };
  const aim: XY = s.direct ? s.to : s.to;
  const dirv = { x: aim.x - home.x, y: aim.y - home.y };
  const dl = Math.hypot(dirv.x, dirv.y) || 1;
  const nd = { x: dirv.x / dl, y: dirv.y / dl };
  const inset = s.blocked ? 14 : 11;
  let feet: XY = { x: aim.x - nd.x * inset - off.x, y: aim.y - nd.y * inset - off.y };
  if (s.direct) {
    // a direct attack glides a stride toward the duelist; the soul bolt covers the rest
    const go = clamp(Math.hypot(feet.x - home.x, feet.y - home.y), 0, 40);
    const fd = Math.hypot(feet.x - home.x, feet.y - home.y) || 1;
    feet = { x: home.x + ((feet.x - home.x) / fd) * go, y: home.y + ((feet.y - home.y) / fd) * go };
  }
  // never glide backwards (a target standing very close): the warden stays on its tile
  if ((feet.x - home.x) * nd.x + (feet.y - home.y) * nd.y < 0) feet = home;
  feet = rint(feet);
  const trail = whirlTrail(sc, u, ramp, REL);
  const light = lanternLight(sc, u, ramp[3], 0.4);
  light.setIntensity(1, u.rangeMs('attack', f0, REL));
  // ---- play to the contact frame and hold it; glide on the whirl (from frame 2 to the contact)
  const toCon = u.rangeMs('attack', f0, CON);
  const glide0 = u.rangeMs('attack', f0, Math.max(f0, 2));
  void u.playRange('attack', f0, CON);
  const stopGlideTrail = glideTrail(sc, u, ramp);
  await sleep(sc, glide0);
  const gms = Math.max(60, toCon - glide0);
  await animate(sc, gms, (k) => {
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    placeFeet(u, { x: lerp(home.x, feet.x, e), y: lerp(home.y, feet.y, e) });
  });
  placeFeet(u, feet);
  rel();
  // ---- contact: the lantern smashes (the battle stages the hit-stop, the number, the reactions)
  const at = rint(livePoint(u, 'muzzle'));
  const floorY = s.target ? s.target.home.y : s.toGround.y;
  if (s.direct) {
    soulBurst(sc, at, u.home.y, ramp, true, DEPTH.FX + 2);
    play('gwImpact', { volume: 0.55, pan: panAt(at.x) });
    await soulBolt(sc, at, s.to, ramp);
    s.impact(s.to);
    void lightFlash(sc, s.to.x, s.to.y, ramp[3], 30, 320, { floorY: s.toGround.y, intensity: 0.9 });
  } else {
    s.impact(at);
    play('gwImpact', { volume: s.blocked ? 0.6 : 0.85, pan: panAt(at.x) });
    const victim = s.target && s.target.sprite.active && s.target.sprite.visible ? s.target.sprite : null;
    soulBurst(sc, at, floorY, ramp, s.blocked, victim ? victim.depth + 0.4 : DEPTH.FX + 2);
    void lightFlash(sc, at.x, at.y, ramp[3], s.blocked ? 28 : 40, 360, { floorY, air: 0.8, intensity: 1 });
  }
  stopGlideTrail();
  trail();
  if (loses) {
    void light.fadeOut(120);
    return;
  }
  // ---- the spade-halberd sweeps through (f8), then the warden glides home on the recovery
  atFrame(u, 'attack', CON + 2, () => {
    const c = s.target && live(s.target) ? s.target.core() : s.to;
    chopCrescent(sc, rint({ x: c.x, y: c.y + 4 }), u.flipX ? -1 : 1, s.blocked);
  }, { late: false });
  const rest = u.playRange('attack', CON + 1, undefined, { hold: false });
  await sleep(sc, u.rangeMs('attack', CON + 1, REC));
  void light.fadeOut(200);
  const back = Math.max(80, u.rangeMs('attack', REC, n) - 40);
  if (feet.x !== home.x || feet.y !== home.y) {
    const stopBack = glideTrail(sc, u, ramp);
    await animate(sc, back, (k) => {
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      placeFeet(u, { x: lerp(feet.x, home.x, e), y: lerp(feet.y, home.y, e) });
    });
    stopBack();
  }
  placeFeet(u, home);
  await rest;
  const r0 = u.rest0;
  if (u.sprite.active) u.sprite.setPosition(r0.x, r0.y).setDepth(unitDepth(home.y));
}

if (LOOK_V3) registerStrike(ID, (s) => scytheV3(s), { priority: 20, name: 'kart-b:grim_warden:strike' });

// ================================================================ death: the empty shroud collapses

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

async function emptyShroudV3(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const u = field.unit(ev.uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible || !u.has('death')) return ctx.base();
  seed(ev.uid * 29 + 11);
  // bookkeeping (as _v3/death.ts deathV3): claim the card's graveyard move, release the unit from the field
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as Ev<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  u.badge.setVisible(false);
  u.posed = true;
  // a kept lantern colour dies with it (the skull mist leaves in that colour)
  const keptAura = kept.has(u.uid);
  const d = drains.get(u.uid);
  const ramp: Ramp = d ? d.ramp : (kept.get(u.uid) ?? LEAF);
  kept.delete(u.uid);
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[grim death] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[grim death] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => void (tile.active && tile.destroy())).catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  const pan = panAt(home.x);
  try {
    const n = u.frameCount('death');
    if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, (ctx.hints.push as XY | undefined) ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
    const inDeath = () => u.frameInfo().anim === 'death';
    let planned = takePlannedEntry(u);
    if (!planned && !inDeath() && showsGuard(u)) {
      const g = planGuardBreak(u);
      if (g) {
        runGuardBreak(u, g);
        planned = takePlannedEntry(u);
      }
    }
    if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
    if (!inDeath() && u.sprite.active) {
      const start0 = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
      u.asClaimant(() => void u.playRange('death', start0, undefined, { hold: true }));
    }
    const lanternFloor = (): XY => rint(pointOf(u, 'death', 4, 'muzzle'));
    // f3: the lantern slips off the chain (its glass shatters on the floor a beat later)
    atFrame(u, 'death', 3, () => play('gwShatter', { volume: 0.85, pan }), { late: false });
    // f4: the shards, the green flash — and the soul fire leaves as a skull-shaped mist
    atFrame(u, 'death', 4, () => {
      const at = lanternFloor();
      shatterGlass(sc, at, home.y);
      void lightFlash(sc, at.x, at.y, ramp[3], 30, 300, { floorY: home.y, air: 0.8, intensity: 0.9 });
      void skullLeaves(sc, { x: at.x, y: at.y - 6 }, ramp, u.sprite.depth + 0.6);
      play('gwWail', { volume: 0.8, pan });
    }, { late: false });
    // dissolve: the shroud collapses empty
    const dissolveF = u.markFrame('death', 'dissolve', 5);
    atFrame(u, 'death', dissolveF, () => play('gwCollapse', { volume: 0.85, pan }), { late: false });
    // the helm hits the floor and rocks
    atFrame(u, 'death', Math.min(n - 1, dissolveF + 1), () => {
      play('gwHelm', { volume: 0.8, pan });
      dust(sc, rint(pointOf(u, 'death', Math.min(n - 1, dissolveF + 1), 'head')), 4);
    }, { late: false });
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= n - 1), u.animMs('death') + 300);
    if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1));
    if (keptAura) u.setAura('grimLantern', null);
    // the last 150 ms: the empty heap goes out in four bayer steps (the card is born on that frame)
    play('gwFade', { volume: 0.8, pan });
    burst();
    if (u.sprite.active) await knockOut(sc, u, ramp, 150, 4);
  } catch (e) {
    console.error('[grim death] failed', e);
  } finally {
    burst();
    if (d) {
      endDrain(d);
      d.tint.destroy();
      drains.delete(u.uid);
    }
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', u);
  }
  await leave;
}

/** The lantern's glass on the floor: shards skitter out and blink away; a few soul sparks hop up. */
function shatterGlass(sc: Phaser.Scene, at: XY, floorY: number): void {
  const sp = new Sparks(sc, DEPTH.FX);
  for (let i = 0; i < 12; i++) {
    const a = RR(-Math.PI, 0.3);
    const v = RR(30, 80);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 20, ay: 300, floor: floorY + RR(-2, 3), bounce: 0.3, life: RR(320, 520), colors: [GLASS[i % GLASS.length], PAL.stone3], shape: 'px', fadeAt: 1, flicker: i % 4 === 0 });
  }
  sp.release();
}

/** The skull-shaped mist rises ~26 px swaying, then comes apart (≈640 ms; runs on its own). */
async function skullLeaves(sc: Phaser.Scene, at: XY, ramp: Ramp, depth: number): Promise<void> {
  const sk = skullMist(sc, at, ramp, depth);
  await animate(sc, 640, (k, el) => {
    sk.pos = { x: at.x + Math.round(Math.sin(el * 0.011) * 3), y: at.y - Math.round(26 * (1 - (1 - k) * (1 - k))) };
    sk.gone = k < 0.45 ? 0 : (k - 0.45) / 0.55;
  });
  sk.destroy();
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return emptyShroudV3(ctx);
    },
    { priority: 20, name: 'kart-b:grim_warden:death' },
  );
