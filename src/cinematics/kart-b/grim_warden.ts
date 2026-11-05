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
import { Raster } from '../../vfx/setpieces';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { shake } from '../../vfx/core';
import { onDuelStart } from '../../duel/seeds';
import { fx, registerCardHook, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, dropCharge, fade as fadeSnd, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { declarePoseFrame, strikeStartFrame } from '../_v3/clash';
import { showBattlePlates } from '../battle/plates';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { contactFlash } from '../_v3/flash';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { STONE_FLIGHT_MS, TAU, floorFlash, floorGlow, graveMound, gravestone, knockOut, lanternTint, skullMist, soulFade, soulThread, statDrop, type FloorGlow, type LanternTint, type SoulFade } from './grim_warden-fx';

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
function pointOf(u: MonsterUnit, anim: Parameters<MonsterUnit['frameCount']>[0], f: number, name: 'muzzle' | 'head' | 'core' | 'staff' | 'hand' | 'grip'): XY {
  const p = u.art.points ? u.art.points(anim, f)[name] : undefined;
  const q = p ?? (name === 'core' ? u.art.core : u.art.muzzle);
  return u.framePoint(q.x, q.y);
}

/** The live point of the frame the sprite shows now. */
function livePoint(u: MonsterUnit, name: 'muzzle' | 'head' | 'core' | 'staff' | 'hand'): XY {
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
  light: FloorGlow;
  /** gwKeep already sounded (the target died with its light in the lantern). */
  keptSounded: boolean;
  off: () => void;
}
const drains = new Map<number, Drain>();
/** Wardens whose lantern keeps a stolen colour until the turn ends (uid → that colour's ramp). */
const kept = new Map<number, Ramp>();
/** Give-backs waiting for a guardian_charm's activation to be shown (keyed by the event that follows it). */
const pendingGiveBacks = new Map<GameEvent, () => void>();

function endDrain(d: Drain, keepFade = false): void {
  if (!keepFade) {
    d.off();
    d.fade.destroy();
  } else {
    // the fade rides the target's death until its sprite retires (soulFade ends itself then; the v3:dying listener
    // stays to mark it dying if the death plays after the battle); a safety net after 4 s
    const f = d.fade;
    const off = d.off;
    d.target.sprite.scene?.time.delayedCall(4000, () => {
      off();
      f.destroy();
    });
  }
  void d.light.fadeOut(200);
}

/**
 * The lantern's light on the floor under its live point (critic r2 blocker: the shared stepped light turned leaf light on
 * the Neon Tower's graphite slots into an opaque leaf0 stain over the grid lines — this one only ever ADDS bright pixels).
 */
function lanternLight(sc: Phaser.Scene, u: MonsterUnit, ramp: Ramp, k: number, radius = 16): FloorGlow {
  const h = floorGlow(sc, { x: u.home.x, floorY: u.home.y, ramp, radius, intensity: k });
  return h.follow(() => (live(u) && u.sprite.visible ? livePoint(u, 'muzzle') : null), () => u.worldPoint('feet').y);
}

/** A floor flash under an air point (lighten-only dither; replaces the stepped lightFlash for the same reason). */
function flash(sc: Phaser.Scene, x: number, floorY: number, ramp: Ramp, radius: number, ms: number, k = 1.2): void {
  floorFlash(sc, Math.round(x), Math.round(floorY), ramp, radius, ms, k);
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
  const ry = Math.max(2, Math.round(rx * 0.45));
  // the headstone stands at the mound's back rim (its foot hidden by the dome), on the far side of the fall
  const stoneAt = { x: home.x - dir * 4, y: home.y - ry + 1 };
  const stone = S.own(gravestone(sc, stoneAt, (-dir as 1 | -1), S.depth - 0.6));
  const pool = S.own(floorGlow(sc, { x: home.x, floorY: home.y, ramp: LEAF, radius: rx + 12, intensity: 0 }));
  const motes = new Sparks(sc, S.depth + 0.5);
  S.own({ destroy: () => motes.release() });
  let seeping = true;
  const stopMotes = onFrame(sc, (dt) => {
    if (!seeping) return false;
    if (mound.seep > 0.3 && dt > 0 && R() < dt / 32) {
      const a = RR(0, TAU);
      motes.add({ x: Math.round(home.x + Math.cos(a) * rx * 0.5), y: Math.round(home.y + Math.sin(a) * rx * 0.2 - 6), vx: RR(-6, 6), vy: RR(-52, -28), drag: 1, life: RR(280, 460), colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: R() < 0.3 ? 'sq' : 'px', size: 1, fadeAt: 1, flicker: true });
    }
    return true;
  });
  S.own({ destroy: () => ((seeping = false), stopMotes()) });
  // ---- the mound swells, the headstone pushes up out of it, the earth cracks
  void shake(sc, 260, 1);
  await animate(sc, 170, (t) => {
    mound.swell = t * t * (3 - 2 * t);
    stone.rise = Math.min(1, t * 1.2);
    mound.crack = Math.max(0, t * 1.4 - 0.3);
  });
  // ---- the soul light seeps through the cracks (the pool under it pulses, leaking upward); the headstone is
  // flung up out of the soil by the first heave and drops back (a 2-frame jolt) with a puff of dust
  pool.setIntensity(0.9, 120);
  play('gwStone', { volume: 0.45, pan, pitch: 1.12 });
  await animate(sc, 200, (t, el) => {
    mound.crack = Math.min(1, 0.75 + t);
    mound.seep = t;
    stone.rise = el < 50 ? 1.7 : el < 100 ? 1.35 : 1;
    pool.setIntensity(0.7 + 0.5 * (Math.floor(el / 60) % 2), 0);
  });
  dust(sc, { x: stoneAt.x, y: stoneAt.y + 1 }, 4);
  // ---- the warden rises out of the mound, lantern first
  let landed = false;
  let finaled = false;
  const finale = () => {
    if (finaled) return;
    finaled = true;
    // critic pass-3 r1: no expanding rings (the shared summonBurst language). The finale is the LANTERN: its flame
    // flares (the summon pose's raised-lantern frame), a stepped green light floods the tile from under it and decays
    // in flat steps (2 → 1 → checker → off), and a handful of soul motes stream up off the glass.
    const lp = livePoint(unit, 'muzzle');
    const flare = floorGlow(sc, { x: Math.round(lp.x), floorY: home.y, ramp: LEAF, radius: S.big ? 46 : 36, intensity: 1.5, flicker: false });
    void sleep(sc, 140).then(() => flare.fadeOut(480));
    const sp = new Sparks(sc, S.depth + 0.6);
    for (let i = 0; i < (S.big ? 12 : 8); i++)
      sp.add({ x: Math.round(lp.x + RR(-4, 4)), y: Math.round(lp.y + RR(-3, 3)), vx: RR(-18, 18), vy: RR(-70, -34), drag: 1.5, life: RR(380, 620), colors: [PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1], shape: R() < 0.35 ? 'sq' : 'px', size: 1, fadeAt: 1, flicker: true });
    sp.release();
    void shake(sc, S.big ? 220 : 150, S.big ? 3 : 2);
    void unit.badge.pop();
    // critic r2: the finale's own sound (the shared cut-in exit fires a generic summonBurst on the same tick: faded out)
    fadeSnd(['summonBurst'], 40);
    play('gwFinale', { volume: S.big ? 0.95 : 0.7, pan });
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
  // frame 3 (the second heave): the rising shoulder shoves the headstone over — it flies tipped for two frames,
  // lands flat with a thud and a dust burst
  atFrame(unit, 'summon', 3, () => {
    stone.pose = 1;
    stone.front();
    play('gwStone', { volume: 0.8, pan });
    clods(sc, home, rx, 9);
    void sleep(sc, STONE_FLIGHT_MS).then(() => {
      stone.pose = 2;
      void shake(sc, 90, 1);
      // it cracks in two on landing: a dry stone split under the thud
      play('gwStone', { volume: 0.55, pan, pitch: 0.82 });
      dust(sc, { x: stoneAt.x - dir * 24, y: stoneAt.y + 6 }, 10);
      clods(sc, { x: stoneAt.x - dir * 24, y: stoneAt.y + 6 }, 6, 5);
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
      // critic pass-3 r1: the shared card slam's impact (tile flash ring + attribute sparkles) made the first read the
      // generic summon. The card is slammed here with `impact: false` (same flight, same sound), the tile only thumps
      // a ring of grave soil, and runSummon is told the card is already down (noCard).
      const ev = ctx.ev;
      const hints = ctx.hints as { noCard?: boolean };
      if (!hints.noCard && ev.type === 'summon') {
        const card = fx.takeHandCard(ctx, ev.player, ev.uid, ev.cardId);
        for (const o of card.inner.list) ctx.scene.tweens.killTweensOf(o);
        ctx.scene.tweens.killTweensOf(card.inner);
        void ctx.views.duelists?.get(ev.player).play('command');
        ctx.sfx('cardSlam', { volume: 0.8 });
        await fx.slamToZone(ctx, card, { player: ev.player, spot: 'monster', index: ev.zone, uid: ev.uid, cardId: ev.cardId, faceUp: true, ms: 340, shake: 2, impact: false });
        const at = zoneXY(ev.player, 'monster', ev.zone);
        clods(ctx.scene, at, 12, 7);
        dust(ctx.scene, at, 6);
        const c2 = Object.create(ctx, { hints: { value: { ...ctx.hints, noCard: true } } }) as typeof ctx;
        await runSummon(c2, async () => undefined, graveRiseV3);
        return;
      }
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
  const tPan = panAt(t.home.x);
  // the drain object lives on into the battle (the strike burns in its colour; the battle hook / the death end it)
  drains.get(u.uid) && endDrain(drains.get(u.uid)!);
  const fadeT = soulFade(sc, t, ramp);
  const tint = lanternTint(sc, u, ramp);
  const light = lanternLight(sc, u, LEAF, 0.6);
  const d: Drain = { targetUid: tUid, target: t, ramp, fade: fadeT, tint, light, keptSounded: false, off: () => undefined };
  const onDying = (x: MonsterUnit) => {
    if (x !== t) return;
    // critic pass-3 r2: the fade is NOT dropped here (the drained target lit back up the frame it started dying) —
    // it rides the death pose until the sprite retires (soulFade ends itself then)
    fadeT.dying();
    // the target dies with its light in the lantern: the lantern locks the colour on that beat (critic r2: gwKeep landed
    // a second late with the card's graveyard thud)
    if (drains.get(u.uid) === d && live(u) && !d.keptSounded) {
      d.keptSounded = true;
      play('gwKeep', { volume: 0.85, pan });
      flash(sc, livePoint(u, 'muzzle').x, u.home.y, ramp, 20, 260, 1);
    }
  };
  sc.events.on('v3:dying', onDying);
  d.off = () => sc.events.off('v3:dying', onDying);
  drains.set(u.uid, d);
  // ---- the special: crouch and gather the chain (gwReach: the pendulum creaks, the thrust), RAISE the lantern high
  // over the hood, inhale (gwInhale), then play up to the held drinking frame
  const REL = u.markFrame('special', 'release', 5);
  const HOLD = Math.min(u.frameCount('special') - 2, REL + 2);
  const toRel = u.rangeMs('special', 0, REL);
  atFrame(u, 'special', 1, () => play('gwReach', { volume: 0.95, pan }), { late: false });
  atFrame(u, 'special', Math.max(2, REL - 1), () => play('gwInhale', { volume: 0.9, pan }), { late: false });
  // critic r3 blocker: the pair stands nearly touching, so the held lantern hung INSIDE the target's sprite and the
  // stream had nowhere to run — the special opens with a shuffle BACK (two dragging steps along the line away from
  // the target) until the drinking frame's glass is ≥ GAP px clear of the target's core; the recovery steps home
  const shuffle = drainShuffle(u, t, HOLD);
  const posed = u.playRange('special', 0, HOLD);
  if (shuffle.x || shuffle.y) {
    const home = { ...u.home };
    const ms = Math.max(120, Math.min(260, Math.round(toRel * 0.6)));
    void animate(sc, ms, (k) => {
      // two scuffs: 0 → 60 % on the first half, a catch, 60 → 100 % on the second (the boots drag, the hem lags)
      const e = k < 0.5 ? 0.6 * Math.sin((k / 0.5) * Math.PI * 0.5) : 0.6 + 0.4 * Math.sin(((k - 0.5) / 0.5) * Math.PI * 0.5);
      placeFeet(u, { x: home.x + shuffle.x * e, y: home.y + shuffle.y * e });
    });
    atFrame(u, 'special', 1, () => dust(sc, u.worldPoint('feet'), 4), { late: false });
  }
  // the target feels it coming: its outline starts to glow in its own colour before the thread
  void animate(sc, toRel, (k) => fadeT.rim(0.25 * k));
  await sleep(sc, toRel);
  // ---- release: the thread is drawn straight up out of the target, crosses over the warden's raised lantern and
  // dives into it from above
  const soulAt = () => (live(t) && t.sprite.visible ? rint(t.core()) : rint(t.home));
  const lantern = () => rint(livePoint(u, 'muzzle'));
  const thread = soulThread(sc, soulAt, lantern, ramp, DEPTH.FX + 1, 12);
  const siphon = start('gwSiphon', { volume: 1, pan });
  play('gwThread', { volume: 1, pan: tPan, pitch: SOUL_PITCH[t.attribute] ?? 1 });
  // the light layer (lighten-only): a pool under the arc's apex and a glow under the target, both in the stolen colour
  const apex = floorGlow(sc, { x: u.home.x, floorY: u.home.y, ramp, radius: 22, intensity: 0 });
  apex.follow(() => (thread ? thread.at(0.5) : null), () => Math.max(u.home.y, t.home.y));
  const tgtGlow = floorGlow(sc, { x: t.home.x, floorY: t.home.y, ramp, radius: 22, intensity: 0 });
  tgtGlow.follow(() => (live(t) && t.sprite.visible ? t.core() : null), () => t.home.y);
  flash(sc, lantern().x, u.home.y, LEAF, 22, 220, 1.1);
  const REACH_MS = 170;
  apex.setIntensity(0.9, REACH_MS);
  tgtGlow.setIntensity(1, REACH_MS);
  await animate(sc, REACH_MS, (k) => {
    thread.reach = k * k * (3 - 2 * k);
    fadeT.set(0.08 * k);
    fadeT.rim(0.25 + 0.35 * k);
  });
  thread.reach = 1;
  // ---- the drain beat: the plate rolls −400 with a small STAT mark over it (never a damage number: critic r2), the
  // target darkens from its outline in, the lantern pours full
  showBattlePlates({ state: ctx.state, ev: { attackerUid: ev.uid, targetUid: tUid } }, u, t);
  play('gwDebuff', { volume: 0.85, pan: tPan });
  const b = t.badge.image;
  const mark = b && b.active && b.visible ? { x: Math.round(b.x), y: Math.round(b.y) - 8 } : { x: Math.round(t.home.x), y: Math.round(t.home.y) - 6 };
  void statDrop(sc, mark, ramp, 460, DEPTH.FX_TOP + 2);
  flash(sc, lantern().x, u.home.y, ramp, 30, 320, 1.3);
  light.setRamp(ramp).setIntensity(1.2, 200);
  drainSpark(sc, t);
  await posed;
  holdFrameTremble(sc, u, HOLD, DRINK_MS);
  await animate(sc, DRINK_MS, (k) => {
    const kk = Math.min(1, k * 1.6);
    fadeT.set(0.08 + 0.22 * kk);
    fadeT.rim(0.6 - 0.35 * k);
    tint.set(Math.min(1, k * 1.4));
    thread.fill = Math.min(1, k * 1.2);
  });
  tint.set(1);
  thread.fill = 1;
  // ---- the thread thins in steps and snaps into the glass (gwSnap: the click, the swell cut dead, the chain creaks
  // as the lantern swings back down — no silent hole before the strike's charge)
  siphon.stop(90);
  play('gwSnap', { volume: 0.95, pan });
  apex.setIntensity(0, 120);
  tgtGlow.setIntensity(0.3, 160);
  await animate(sc, 110, (k) => {
    thread.width = 1 - k;
    fadeT.rim(0.25 * (1 - k));
  });
  thread.destroy();
  void apex.fadeOut(80);
  void tgtGlow.fadeOut(260);
  flash(sc, lantern().x, u.home.y, ramp, 18, 200, 1.2);
  light.setIntensity(0.9, 200);
  // ---- back to the strike's charge pose (the recovery a little brisker: the strike follows)
  const recov = u.playRange('special', HOLD + 1, u.frameCount('special') - 1, { timeScale: 1.6 });
  if (shuffle.x || shuffle.y) {
    const home = { ...u.home };
    const ms = Math.max(100, u.rangeMs('special', HOLD + 1, u.frameCount('special') - 1) / 1.6);
    await animate(sc, ms, (k) => {
      const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
      placeFeet(u, { x: home.x + shuffle.x * (1 - e), y: home.y + shuffle.y * (1 - e) });
    });
    placeFeet(u, home);
  }
  await recov;
  const f = declarePoseFrame(u);
  await u.playRange('attack', 0, f);
  if (hold) ctx.keep('attack', hold);
  else u.posed = false;
}

/** Min px between the drinking frame's glass and the target's core (horizontal), and the most the warden steps back. */
const DRAIN_GAP = 30;
const DRAIN_STEP_MAX = 18;
/** The shuffle-back offset (whole px) that clears the held lantern off the target, along the line away from it. */
function drainShuffle(u: MonsterUnit, t: MonsterUnit, holdF: number): XY {
  const lan = pointOf(u, 'special', holdF, 'muzzle');
  const core = t.core();
  const need = DRAIN_GAP - Math.abs(lan.x - core.x);
  if (need <= 0) return { x: 0, y: 0 };
  const ax = u.home.x - t.home.x;
  const ay = u.home.y - t.home.y;
  const al = Math.hypot(ax, ay) || 1;
  const nx = ax / al;
  const ny = ay / al;
  const len = Math.min(DRAIN_STEP_MAX, need / Math.max(0.5, Math.abs(nx)));
  return { x: Math.round(nx * len), y: Math.round(ny * len) };
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
  // critic pass-3 r2: the dashes ran THROUGH the digits ('1-000') — they now flare along the plate's lower edge
  // (the stat mark rises above it), never over the numbers
  const y = Math.round(b.y + (1 - b.originY) * b.displayHeight) + 2;
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
    thread.width = 0.9;
    play('gwGiveBack', { volume: 1, pan: panAt(t.home.x) });
    await animate(sc, 420, (k) => {
      thread.reach = Math.min(1, k * 2.5);
      d.fade.set(0.3 * (1 - k));
      d.tint.set(1 - k);
      thread.width = k < 0.6 ? 0.9 : k < 0.85 ? 0.5 : 0.2;
    });
    thread.destroy();
    endDrain(d);
    d.tint.destroy();
    flash(sc, t.core().x, t.home.y, d.ramp, 22, 240, 1.1);
    return;
  }
  // the target died: the lantern keeps its colour until the turn ends
  endDrain(d, true);
  if (!d.keptSounded) play('gwKeep', { volume: 0.8, pan: panAt(u.home.x) });
  d.keptSounded = true;
  const light = lanternLight(sc, u, d.ramp, 0.8);
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
      // critic pass-3 r2: a guardian_charm that saves the drained target must be SEEN first (its activation explains
      // why the target lives) — the give-back waits for the charm's activate event and starts once it has flared
      const ai = ctx.findType('activate', (e) => e.cardId === 'guardian_charm', { until: (e) => e.type === 'battle' || e.type === 'turnStart' });
      // (the charm's activation zooms its card over the board for ≈ 2 s — a give-back under it would be hidden — so the
      // light starts home on the next event's start, right as the charm's card has been shown and leaves)
      const next = ai >= 0 ? ctx.events[ai + 1] : undefined;
      if (next) {
        const uid = ctx.ev.attackerUid;
        pendingGiveBacks.set(next, () => void afterBattle(ctx, live(ctx.unit(uid)), d).catch((e) => console.error('[grim give-back]', e)));
        return;
      }
      await afterBattle(ctx, live(ctx.unit(ctx.ev.attackerUid)), d);
    },
    { priority: 20, name: 'kart-b:grim_warden:attack' },
  );
  // the kept lantern colour ends with the turn (and never outlives a duel / a lost unit)
  registerObserver((ev, ctx) => {
    const gb = pendingGiveBacks.get(ev);
    if (gb) {
      pendingGiveBacks.delete(ev);
      gb();
    }
    if (ev.type !== 'turnStart' && ev.type !== 'gameOver') return;
    for (const run of [...pendingGiveBacks.values()]) run();
    pendingGiveBacks.clear();
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

// ================================================================ idle: the lantern's swinging floor light

/**
 * The soul fire casts a green pool that swings across the floor with the lantern (spec idle line; critic r1: the
 * light layer's unit pool is the DARK attribute's violet, centred on the body, so no green pool read at 1×). One
 * watcher per scene (started by the first event it sees, v3 only) keeps a pool glued to every warden's live lantern
 * point; it takes the stolen colour while the lantern holds one and leaves with the unit.
 */
const idlePools = new Map<number, { u: MonsterUnit; h: FloorGlow; ramp: Ramp }>();
/** Per warden: the last anim seen (hit / guard sounds on the transition), the idle creak's swing counter. */
const unitState = new WeakMap<MonsterUnit, { anim: string | null; frame: number; swings: number; lastCreak: number }>();
const HIT_ANIMS = new Set(['hit', 'hitHeavy', 'hitMagic']);
let poolScene: Phaser.Scene | null = null;

/**
 * The warden's own voice when it is STRUCK or GUARDS (critic r2: only shared sounds played — the lantern flying wild on
 * its chain is the hit anims' readable signature, so it sounds): gwJangle on the first frame of hit / hitHeavy /
 * hitMagic and on the guard's struck beat (the unit's guardHit), quieter as it braces into the guard.
 */
const lastJangle = new WeakMap<MonsterUnit, number>();
function jangle(u: MonsterUnit, volume: number): void {
  // one jangle per blow (the guard's struck beat and its recoil anim arrive on neighbouring ticks)
  const now = u.scene.time.now;
  if (now - (lastJangle.get(u) ?? -1e9) < 260) return;
  lastJangle.set(u, now);
  play('gwJangle', { volume, pan: panAt(u.sprite.x) });
}
const guarded = new WeakSet<MonsterUnit>();
function hookGuard(u: MonsterUnit): void {
  if (guarded.has(u)) return;
  guarded.add(u);
  const orig = u.guardHit.bind(u);
  (u as { guardHit: MonsterUnit['guardHit'] }).guardHit = ((o: Parameters<MonsterUnit['guardHit']>[0]) => {
    jangle(u, 0.6);
    return orig(o);
  }) as MonsterUnit['guardHit'];
}

function watchLanterns(ctx: CinematicContext): void {
  const sc = ctx.scene;
  if (poolScene === sc) return;
  poolScene = sc;
  for (const p of idlePools.values()) p.h.destroy();
  idlePools.clear();
  let acc = 250;
  let clock = 0;
  onFrame(sc, (dt) => {
    if (poolScene !== sc || !sc.sys.isActive()) return false;
    clock += dt;
    const field = ctx.views.field;
    // ---- every tick: the struck / guard sounds and the sparse idle creak (anim transitions)
    for (const u of field.units()) {
      if (u.cardId !== ID || u.retired || !u.sprite.active) continue;
      hookGuard(u);
      const fi = u.frameInfo();
      let st = unitState.get(u);
      if (!st) {
        st = { anim: fi.anim, frame: fi.frame, swings: 0, lastCreak: clock };
        unitState.set(u, st);
        continue;
      }
      if (fi.anim !== st.anim) {
        if (fi.anim && HIT_ANIMS.has(fi.anim)) jangle(u, fi.anim === 'hit' ? 0.6 : 0.75);
        else if (fi.anim === 'toGuard') jangle(u, 0.35);
      } else if (fi.anim === 'idle' && fi.frame !== st.frame && (fi.frame === 5 || fi.frame === 15)) {
        // decision 3: a very quiet pendulum creak at the end of every second swing, never closer than 3.6 s
        st.swings++;
        if (st.swings % 2 === 0 && clock - st.lastCreak > 3600) {
          st.lastCreak = clock;
          play('gwIdle', { volume: 0.16, pan: panAt(u.sprite.x) });
        }
      }
      st.anim = fi.anim;
      st.frame = fi.frame;
    }
    acc += dt;
    if (acc < 120) return true;
    acc = 0;
    const seen = new Set<number>();
    for (const u of field.units()) {
      if (u.cardId !== ID || u.retired || !u.sprite.active || u.frameInfo().anim === 'death') continue;
      seen.add(u.uid);
      const want = drains.get(u.uid)?.ramp ?? kept.get(u.uid) ?? LEAF;
      let p = idlePools.get(u.uid);
      if (!p || p.u !== u) {
        p?.h.destroy();
        const h = floorGlow(sc, { x: u.home.x, floorY: u.home.y, ramp: want, radius: 16, intensity: 0 }).setIntensity(0.5, 300);
        h.follow(() => (live(u) && u.sprite.visible ? livePoint(u, 'muzzle') : null), () => u.worldPoint('feet').y);
        p = { u, h, ramp: want };
        idlePools.set(u.uid, p);
      } else if (p.ramp !== want) {
        p.h.setRamp(want);
        p.ramp = want;
      }
    }
    for (const [uid, p] of [...idlePools]) {
      if (seen.has(uid) && !p.u.retired) continue;
      void p.h.fadeOut(200);
      idlePools.delete(uid);
    }
    return true;
  });
}
onDuelStart(() => {
  for (const p of idlePools.values()) p.h.destroy();
  idlePools.clear();
  poolScene = null;
});
if (LOOK_V3) registerObserver((_ev, ctx) => watchLanterns(ctx));

// ================================================================ strike: "Fener Tırpanı"

/**
 * The whirl's soul-fire smear (critic r1: the old polyline read as a debug line): the lantern's live point is
 * tracked as an ANGLE + RADIUS round the warden's fist, and the smear is drawn as a curved band along that circle
 * — 5 px at the head (ramp[4] core, ramp[3], ramp[2] edges), stepping down to 3 px and a dotted 1 px tail as it
 * ages — with afterimage lanterns (ink-cased, ramp glass) left on the circle and a few shed embers. Painted in the
 * lantern's current colour (the stolen ramp after a drain, else leaf).
 */
/** Ms a key of the whirl smear lives (critic r2: long enough that a full turn closes into a readable ring at 1×). */
const TRAIL_MS = 340;
/** The smear's longest arc behind its head (rad): an open crescent, never a closed loop (critic r3). */
const ARC_MAX = Math.PI * 1.05;
function whirlTrail(sc: Phaser.Scene, u: MonsterUnit, ramp: Ramp, untilF: number): () => void {
  const r = new Raster(sc, 0, 0, 640, 360, u.sprite.depth + 0.3);
  const embers = new Sparks(sc, u.sprite.depth + 0.35);
  const pts: { a: number; rad: number; age: number }[] = [];
  const ghosts: { a: number; rad: number; age: number }[] = [];
  let lastFrame = -1;
  let alive = true;
  const spinDir = u.flipX ? -1 : 1;
  const stop = onFrame(sc, (dt) => {
    if (!alive && !pts.length && !ghosts.length) return false;
    const fi = u.frameInfo();
    const whirling = alive && fi.anim === 'attack' && fi.frame <= untilF && (fi.frame >= 1 || pts.length > 0) && u.sprite.visible;
    const c = livePoint(u, 'hand');
    if (whirling) {
      const m = livePoint(u, 'muzzle');
      let a = Math.atan2(m.y - c.y, m.x - c.x);
      const rad = Math.hypot(m.x - c.x, m.y - c.y);
      const last = pts[pts.length - 1];
      if (last) {
        // the whirl only ever turns ONE way (P1 clockwise on screen: back → up → front → down → back), so a frame jump
        // across the low side (f4 → f0 → f1 of the spin-up turn) is drawn round the bottom and the ring closes
        // (critic r2: the nearest-way unwrap folded that jump back over the top — a half arc, never a circle)
        let dl = a - last.a;
        while (dl > Math.PI) dl -= TAU;
        while (dl <= -Math.PI) dl += TAU;
        if (dl * spinDir < -0.6) dl += spinDir * TAU;
        a = last.a + dl;
      }
      if (fi.frame !== lastFrame) {
        lastFrame = fi.frame;
        if (last) ghosts.push({ a: last.a, rad: last.rad, age: 0 });
        pts.push({ a, rad, age: 0 });
        // shed embers off the swing
        for (let i = 0; i < 3; i++) {
          const ea = a - 0.25 * i * (last ? Math.sign(a - last.a) : 1);
          // critic r3: flung off TANGENTIALLY (along the swing), not puffed up
          const tv = RR(60, 110);
          embers.add({ x: Math.round(c.x + Math.cos(ea) * rad), y: Math.round(c.y + Math.sin(ea) * rad), vx: -Math.sin(ea) * spinDir * tv + RR(-10, 10), vy: Math.cos(ea) * spinDir * tv * 0.8 - 15, drag: 3, life: RR(220, 340), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'px', fadeAt: 1, flicker: true });
        }
      } else if (last) {
        last.a = a;
        last.rad = rad;
      }
    }
    for (const q of pts) q.age += dt;
    for (const q of ghosts) q.age += dt;
    while (pts.length > 1 && pts[0].age > TRAIL_MS && pts[1].age > TRAIL_MS) pts.shift();
    if (pts.length === 1 && pts[0].age > TRAIL_MS) pts.shift();
    while (ghosts.length && ghosts[0].age > 130) ghosts.shift();
    r.img.setDepth(u.sprite.depth + 0.3);
    r.draw((g) => {
      // critic r3: an OPEN tapered smear crescent, never a closed ring (it read as a halo / targeting ring round the
      // helm): the band is cut ARC_MAX behind the head; its width tapers by the angular distance from the head (5 px
      // white-cored head → 3 px → a BROKEN 1-px tail), not by age alone
      const head = pts.length ? pts[pts.length - 1] : null;
      for (let i = 1; i < pts.length && head; i++) {
        const p0 = pts[i - 1];
        const p1 = pts[i];
        const steps = Math.max(4, Math.ceil(Math.abs(p1.a - p0.a) * Math.max(p0.rad, p1.rad)));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const a = lerp(p0.a, p1.a, t);
          const rad = lerp(p0.rad, p1.rad, t);
          // age along the band: the head (newest end) young, the tail old
          const age = lerp(p0.age, p1.age, t);
          if (age > TRAIL_MS) continue;
          const behind = (head.a - a) * spinDir;
          if (behind > ARC_MAX || behind < -0.05) continue;
          const q = behind / ARC_MAX;
          const half = q < 0.22 && age < 120 ? 2 : q < 0.55 && age < 230 ? 1 : 0;
          // the broken tail: gaps that open wider toward its end
          if (half === 0 && (k % (q > 0.8 ? 4 : 2)) !== 0) continue;
          for (let d = -half; d <= half; d++) {
            const x = Math.round(c.x + Math.cos(a) * (rad + d));
            const y = Math.round(c.y + Math.sin(a) * (rad + d));
            const core = d === 0;
            const col = half === 2 ? (core ? (q < 0.08 ? PAL.white : ramp[4]) : Math.abs(d) === 1 ? ramp[3] : ramp[2]) : half === 1 ? (core ? ramp[3] : ramp[2]) : q > 0.8 ? ramp[1] : ramp[2];
            g.px(x, y, col);
          }
        }
      }
      // the afterimage lanterns on the circle (5×7: ink case, ramp glass, a hot heart while young)
      for (const q of ghosts) {
        const x = Math.round(c.x + Math.cos(q.a) * q.rad);
        const y = Math.round(c.y + Math.sin(q.a) * q.rad);
        if (q.age < 65) {
          g.rect(x - 2, y - 3, 5, 7, PAL.ink);
          g.rect(x - 1, y - 2, 3, 5, ramp[3]);
          g.px(x, y, ramp[4]);
        } else {
          g.rect(x - 1, y - 2, 3, 5, ramp[2]);
          g.px(x, y, ramp[3]);
        }
      }
    });
    return true;
  }, () => {
    r.destroy();
    embers.release();
  });
  return () => {
    alive = false;
    void stop;
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

/**
 * The lantern's soul burst at the contact point, ONE colour family (the lantern's ramp + white): a solid irregular
 * star (uneven rays, a ramp[4] heart, a white core) for two frames, then its rays break into shards while ONE clean
 * ring steps out once; glass shards spray in the same ramp and bounce on the struck body's floor (critic r1: the old
 * overlapping dotted rings with "+" ticks read as a targeting reticle).
 */
function soulBurst(sc: Phaser.Scene, at: XY, floorY: number, ramp: Ramp, small: boolean, depth: number): void {
  const r = Raster.around(sc, at.x, at.y, 110, 90, depth);
  // critic r3: the card's own burst must beat the shared contact ring — R 22 (13 blocked), held 3 frames
  const R0 = small ? 13 : 22;
  const N = 11;
  const spikes = Array.from({ length: N }, (_, i) => ({ a: (i / N) * TAU + RR(-0.18, 0.18), l: RR(0.65, 1.15) }));
  const star = (k: number): XY[] => {
    const out: XY[] = [];
    for (let i = 0; i < N; i++) {
      const s0 = spikes[i];
      const s1 = spikes[(i + 1) % N];
      const mid = s0.a + ((((s1.a - s0.a) % TAU) + TAU) % TAU) / 2;
      out.push({ x: at.x + Math.cos(s0.a) * R0 * s0.l * k, y: at.y + Math.sin(s0.a) * R0 * s0.l * k * 0.8 });
      out.push({ x: at.x + Math.cos(mid) * R0 * 0.38 * k, y: at.y + Math.sin(mid) * R0 * 0.38 * k * 0.8 });
    }
    return out;
  };
  // painted once at once: the battle's hit-stop freezes the show clock on this very tick, so the frozen beat must
  // already show the solid soul star (not the bare white silhouette with the burst arriving after the freeze)
  const paint = (el: number): void => {
    r.draw((g) => {
      const step0 = Math.min(5, Math.floor(el / 46));
      if (step0 <= 2) {
        // the solid star, 3 frames: an ink rim (it separates from the shared white chop / violet ring), outer ramp[3],
        // inner ramp[4], a white heart that shrinks
        const sz = [1.0, 1.12, 1.18][step0];
        g.poly(star(sz * 1.1), PAL.ink);
        g.poly(star(sz), ramp[3]);
        g.poly(star(sz * 0.62), ramp[4]);
        g.disc(at.x, at.y, [5, 4, 2][step0], PAL.white);
      } else {
        const step = step0 - 1;
        // the rays break apart into flying shards along their own lines
        for (const sp of spikes) {
          const d0 = R0 * sp.l * (0.7 + 0.35 * step);
          const d1 = d0 + (step < 4 ? 3 : 1);
          g.line(at.x + Math.cos(sp.a) * d0, at.y + Math.sin(sp.a) * d0 * 0.8, at.x + Math.cos(sp.a) * d1, at.y + Math.sin(sp.a) * d1 * 0.8, step < 3 ? ramp[3] : ramp[2]);
        }
        if (step === 2) g.disc(at.x, at.y, 2, ramp[4]);
      }
      // critic pass-3 r1: NO ring of our own — the shared contact staging already rings the blow (REHBER: one hard
      // ring on screen); the star and its flying shards carry the burst
    });
  };
  paint(0);
  void animate(sc, 290, (_k, el) => paint(el)).then(() => r.destroy());
  // glass shards in the lantern's colour: whole pixels, bouncing on the struck body's floor, blinking out
  const sp = new Sparks(sc, depth + 0.1);
  const n = small ? 12 : 22;
  for (let i = 0; i < n; i++) {
    const a = RR(0, TAU);
    const v = RR(50, 130);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 40, ay: 360, floor: floorY + RR(-3, 3), bounce: 0.35, life: RR(380, 560), colors: i % 4 === 0 ? [PAL.white, ramp[4], ramp[3]] : [ramp[4], ramp[3], ramp[2]], shape: i % 3 === 0 ? 'sq' : 'px', size: 1, fadeAt: 1, flicker: i % 3 === 0 });
  }
  for (let i = 0; i < (small ? 5 : 9); i++) {
    const a = RR(0, TAU);
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * RR(20, 50), vy: RR(-60, -25), drag: 2, life: RR(260, 420), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'px', fadeAt: 1 });
  }
  sp.release();
}

/**
 * The halberd's SWEEP SMEAR (critic pass-3 r1: the chop read as a straight stick lying across the body): a crescent band
 * pivoting on the warden's far hand, from the spade's raised point (f7) round to its chopped point (f8) — 2 frames: a
 * fat band (white edge, mist / iron body, a soul-leaf trailing rim in the lantern's colour), then a thinning tail that
 * peels off the leading end. Whole pixels, no alpha.
 */
function chopCrescent(sc: Phaser.Scene, u: MonsterUnit, fUp: number, fDown: number, ramp: Ramp, small: boolean): void {
  const c = pointOf(u, 'attack', fDown, 'grip');
  const p0 = pointOf(u, 'attack', fUp, 'staff');
  const p1 = pointOf(u, 'attack', fDown, 'staff');
  const R1 = Math.max(16, Math.round(Math.hypot(p1.x - c.x, p1.y - c.y)));
  let a0 = Math.atan2(p0.y - c.y, p0.x - c.x);
  let a1 = Math.atan2(p1.y - c.y, p1.x - c.x);
  const dir = u.flipX ? -1 : 1;
  // sweep the short way in the facing direction (P1 clockwise on screen, P2 mirrored)
  if (dir > 0) while (a1 < a0) a1 += TAU;
  else while (a1 > a0) a1 -= TAU;
  if (Math.abs(a1 - a0) > Math.PI * 1.3) a1 = a0 + dir * Math.PI * 0.9;
  const r = Raster.around(sc, c.x, c.y, R1 * 2 + 16, R1 * 2 + 16, DEPTH.FX + 2);
  const W = small ? 4 : 6;
  void animate(sc, 120, (_k, el) => {
    const step = el < 60 ? 0 : 1;
    r.draw((g) => {
      const from = step === 0 ? 0.1 : 0.55;
      const n = Math.ceil(Math.abs(a1 - a0) * R1);
      for (let i = 0; i <= n; i++) {
        const t = from + (1 - from) * (i / n);
        const a = lerp(a0, a1, t);
        // the band swells toward the leading end (the spade), the trailing end a 1-px wisp
        const w = Math.max(1, Math.round(W * (step === 0 ? t : t * 0.6)));
        for (let k = 0; k < w; k++) {
          const rr = R1 + 1 - k;
          const col = k === 0 ? (step === 0 ? PAL.white : PAL.mist) : k === w - 1 ? ramp[3] : k === 1 ? PAL.mist : IRON[2];
          g.px(Math.round(c.x + Math.cos(a) * rr), Math.round(c.y + Math.sin(a) * rr), col);
        }
      }
    });
  }).then(() => r.destroy());
}

/** Direct attack: the burst throws a soul bolt the last stretch to the duelist (≈100 ms). */
/** A tiny soul-fire skull (7×6; 4 = ramp[4], 3 = ramp[3], 2 = ramp[2], o = socket, t = tooth gap, # = ink). */
/** The wisp skull (critic pass-3 r2: 7×6 read as a speck at 1× → 11×8 skull + a 2-frame flame crown = 11×10). */
const WISP = ['..#######..', '.#4444443#.', '#444444433#', '#4oo44oo32#', '#4oo44oo32#', '.#3343332#.', '..#3t3t3#..', '...#####...'];
/** Its flame crown, two frames (flickers on whole frames; light from the top-left). */
const WISP_CROWN = [
  ['...4...3...', '..434.343..'],
  ['.....4.....', '.3.434.4.3.'],
] as const;

/**
 * The direct attack's SOUL-FIRE WISP (critic pass-3 r1: a 1-px green laser line + star): the lantern spits a small
 * skull of soul fire that flies in a wobbling arc over 150–250 ms, a curling smoke-and-flame trail behind it (puffs on its
 * past positions stepping ramp[3] → ramp[2] → ramp[1] → stone1, shrinking), its flame tongue flickering behind the skull.
 */
async function soulBolt(sc: Phaser.Scene, from: XY, to: XY, ramp: Ramp): Promise<void> {
  const r = new Raster(sc, 0, 0, 640, 360, DEPTH.FX_TOP - 1);
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const ms = clamp(Math.round(dist * 1.3), 150, 250);
  const nx = -(to.y - from.y) / (dist || 1);
  const ny = (to.x - from.x) / (dist || 1);
  const trail: { p: XY; age: number }[] = [];
  let last = -1;
  // critic pass-3 r2: the flight has its own voice (was a −45 dB hole between gwRelease and gwBoltHit), panned at
  // the flight's middle
  play('gwBolt', { volume: 1, pan: panAt((from.x + to.x) / 2) });
  await animate(sc, ms, (k, el) => {
    const e = k < 0.15 ? k * 0.6 : 0.09 + (k - 0.15) * (0.91 / 0.85);
    const wob = Math.sin(k * Math.PI * 3) * 4 * (1 - k);
    const p = rint({ x: lerp(from.x, to.x, e) + nx * wob, y: lerp(from.y, to.y, e) + ny * wob - Math.sin(Math.PI * k) * 14 });
    const fr = Math.floor(el / 17);
    if (fr !== last) {
      last = fr;
      for (const t of trail) t.age++;
      trail.unshift({ p, age: 0 });
      if (trail.length > 10) trail.pop();
    }
    r.draw((g) => {
      // the smoke curls: older puffs drift up and sideways, shrink, and step down the ramp to cold stone
      for (let i = trail.length - 1; i >= 1; i--) {
        const t = trail[i];
        const curl = Math.sin(t.age * 1.3 + i) * 1.5;
        const x = Math.round(t.p.x + curl);
        const y = Math.round(t.p.y - t.age * 0.8);
        const rad = Math.max(0, 4 - Math.floor(t.age / 3));
        const col = t.age < 2 ? ramp[3] : t.age < 4 ? ramp[2] : t.age < 6 ? ramp[1] : PAL.stone1;
        if (rad > 0) g.disc(x, y, rad, col);
        else g.px(x, y, col);
      }
      // the flame tongue behind the skull (flickers on whole frames)
      const back = trail[1]?.p ?? from;
      // a short tongue (≤ 5 px) pointing back along the flight — never a long streak
      const bl = Math.hypot(back.x - p.x, back.y - p.y) || 1;
      const tl = Math.min(5, bl);
      const tx = Math.round(p.x + ((back.x - p.x) / bl) * tl);
      const ty = Math.round(p.y + ((back.y - p.y) / bl) * tl) + (fr % 2);
      g.line(p.x, p.y, tx, ty, ramp[4], 1, 3);
      g.line(p.x, p.y + 1, tx, ty + 1, ramp[3], 1, 3);
      // the skull itself, under its flickering flame crown
      const x0 = p.x - 5;
      const y0 = p.y - 4;
      WISP_CROWN[fr % 2].forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          if (ch === '4') g.px(x0 + x, y0 - 2 + y, fr % 3 === 0 ? PAL.white : ramp[4]);
          else if (ch === '3') g.px(x0 + x, y0 - 2 + y, ramp[3]);
        }
      });
      WISP.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          const c = ch === '#' ? PAL.ink : ch === '4' ? (fr % 3 === 0 ? PAL.white : ramp[4]) : ch === '3' ? ramp[3] : ch === '2' ? ramp[2] : ch === 'o' || ch === 't' ? PAL.ink : null;
          if (c !== null) g.px(x0 + x, y0 + y, c);
        }
      });
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
    play('gwRelease', { volume: 1, pan });
  };
  atFrame(u, 'attack', REL, rel, { late: false });
  if (!s.direct) atFrame(u, 'attack', CON + 2, () => play('gwChop', { volume: loses ? 0.5 : 0.8, pan: panAt(u.sprite.x) }), { late: false });
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
  const light = lanternLight(sc, u, ramp, 0.5);
  // ---- critic r2 "tam daire": the lantern goes round TWICE — a quick spin-up turn (f1 → f4, back through the low f0)
  // and the big final turn with its apex hold — every turn creaks the pendulum chain and whooshes (gwSwing), the
  // warden gliding toward the target over both
  const SPIN = 2;
  const spinFrom = Math.max(1, f0);
  const spinMs = f0 <= 4 ? Math.round(u.rangeMs('attack', spinFrom, 4) / SPIN) + Math.round(u.frameMs('attack', 0) / SPIN) : 0;
  const finalMs = u.rangeMs('attack', 1, CON);
  light.setIntensity(1.1, spinMs + u.rangeMs('attack', 1, REL));
  const glide0 = Math.round(spinMs * 0.35);
  const toCon = spinMs + finalMs;
  const stopGlideTrail = glideTrail(sc, u, ramp);
  const playing = (async () => {
    if (spinMs > 0) {
      play('gwSwing', { volume: 0.6, pan, pitch: 1.12 });
      await u.playRange('attack', spinFrom, 4, { timeScale: SPIN });
      await u.playRange('attack', 0, 0, { timeScale: SPIN });
    }
    if (REL - 1 > 1) atFrame(u, 'attack', REL - 1, () => play('gwSwing', { volume: 0.85, pan }), { late: false });
    await u.playRange('attack', spinMs > 0 ? 1 : f0, CON);
  })();
  await sleep(sc, glide0);
  const gms = Math.max(60, toCon - glide0);
  await animate(sc, gms, (k) => {
    const e = 0.5 - 0.5 * Math.cos(Math.PI * k);
    placeFeet(u, { x: lerp(home.x, feet.x, e), y: lerp(home.y, feet.y, e) });
  });
  await Promise.race([playing, sleep(sc, 120)]);
  placeFeet(u, feet);
  rel();
  // ---- contact: the lantern smashes (the battle stages the hit-stop, the number, the reactions)
  const at = rint(livePoint(u, 'muzzle'));
  const floorY = s.target ? s.target.home.y : s.toGround.y;
  if (s.direct) {
    // the lantern bursts at the chain's end and throws a soul bolt; the bolt's OWN hit lands on the duelist with the
    // number (critic r2: the impact sound played 117 ms early at the lantern, the duelist got only shared sounds)
    soulBurst(sc, at, u.home.y, ramp, true, DEPTH.FX + 2);
    await soulBolt(sc, at, s.to, ramp);
    s.impact(s.to);
    play('gwBoltHit', { volume: 1, pan: panAt(s.to.x) });
    soulBurst(sc, rint(s.to), s.toGround.y, ramp, false, DEPTH.FX_TOP - 1);
    flash(sc, s.to.x, s.toGround.y, ramp, 30, 320, 1.3);
  } else {
    s.impact(at);
    play('gwImpact', { volume: s.blocked ? 0.75 : 1, pan: panAt(at.x) });
    const victim = s.target && s.target.sprite.active && s.target.sprite.visible ? s.target.sprite : null;
    soulBurst(sc, at, floorY, ramp, s.blocked, victim ? victim.depth + 0.4 : DEPTH.FX + 2);
    flash(sc, at.x, floorY, ramp, s.blocked ? 28 : 40, 360, 1.3);
  }
  stopGlideTrail();
  trail();
  if (loses) {
    void light.fadeOut(120);
    return;
  }
  // ---- the spade-halberd sweeps through (f8), then the warden glides home on the recovery
  // the halberd sweep (melee only: after a direct hit it would chop empty air — critic pass-3 r1 — so the direct
  // attack's f7–f8 play as a flourish, without the smear or the chop sound)
  // critic r3: the smear spans the chop's in-between (f8) to the chopped-through frame (f9)
  if (!s.direct) atFrame(u, 'attack', CON + 2, () => chopCrescent(sc, u, CON + 1, CON + 3, ramp, s.blocked), { late: false });
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
  // a kept lantern colour dies with it (the skull mist leaves in that colour). Critic r2 "the light returns": when the
  // warden dies in a drain whose target LIVES, the lantern keeps the stolen colour until it shatters, the stolen light
  // then flows back into the target, and the skull mist leaves GREEN (the warden's own soul)
  const keptAura = kept.has(u.uid);
  const d = drains.get(u.uid);
  const giveBack = !!d && live(d.target) !== null && d.target.sprite.visible && d.target.frameInfo().anim !== 'death';
  const ramp: Ramp = d ? d.ramp : (kept.get(u.uid) ?? LEAF);
  const soulRamp: Ramp = giveBack ? LEAF : ramp;
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
      flash(sc, at.x, home.y, ramp, 30, 300, 1.3);
      if (giveBack && d) {
        // the borrowed light leaves the broken glass and runs home into the surviving target; the lantern goes green
        d.tint.destroy();
        // critic pass-3 r2: gwGiveBack was masked by gwWail on the same tick — the light leaves after the wail's peak
        const depth = u.sprite.depth + 0.7;
        void sleep(sc, 220).then(() => returnLight(sc, at, d, depth));
      }
      void skullLeaves(sc, { x: at.x, y: at.y - 2 }, soulRamp, u.sprite.depth + 0.6, home.y);
      play('gwWail', { volume: 0.9, pan });
    }, { late: false });
    // dissolve: the shroud collapses empty
    const dissolveF = u.markFrame('death', 'dissolve', 5);
    atFrame(u, 'death', dissolveF, () => play('gwCollapse', { volume: 0.85, pan }), { late: false });
    // the helm hits the floor and rocks
    atFrame(u, 'death', Math.min(n - 1, dissolveF + 1), () => {
      play('gwHelm', { volume: 0.8, pan });
      dust(sc, rint(pointOf(u, 'death', Math.min(n - 1, dissolveF + 1), 'head')), 4);
    }, { late: false });
    // the heap is never static while it waits (critic r2): soul embers drift off it, the dust settles in puffs
    const heapLife = onFrame(sc, (dt, el) => {
      if (!u.sprite.active || !inDeath() || u.frameInfo().frame < dissolveF + 1) return u.sprite.active && el < 3000;
      if (R() < dt / 70) {
        const c = rint(pointOf(u, 'death', n - 1, 'core'));
        embersUp(sc, { x: c.x + Math.round(RR(-9, 9)), y: home.y - Math.round(RR(2, 9)) }, soulRamp, u.sprite.depth + 0.5);
      }
      if (R() < dt / 260) dust(sc, { x: Math.round(home.x + RR(-12, 12)), y: home.y }, 2);
      return true;
    });
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= n - 1), u.animMs('death') + 300);
    if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1));
    heapLife();
    if (keptAura) u.setAura('grimLantern', null);
    // the last 150 ms: the empty heap goes out in four bayer steps (the card is born on that frame)
    play('gwFade', { volume: 0.8, pan });
    burst();
    if (u.sprite.active) await knockOut(sc, u, soulRamp, 150, 4);
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

/** A soul ember or two drifting up off the empty heap (whole pixels, flickering out). */
function embersUp(sc: Phaser.Scene, at: XY, ramp: Ramp, depth: number): void {
  const sp = new Sparks(sc, depth);
  sp.add({ x: at.x, y: at.y, vx: RR(-6, 6), vy: RR(-26, -14), drag: 1, life: RR(320, 480), colors: [ramp[4], ramp[3], ramp[2], ramp[1]], shape: 'px', fadeAt: 1, flicker: true });
  sp.release();
}

/**
 * The target survives the warden's death: the stolen light leaves the broken lantern as a run of soul beads arcing back
 * into the target's core (a reverse thread, gwGiveBack), its fade steps out and a flash of its own colour lands on it.
 */
async function returnLight(sc: Phaser.Scene, from: XY, d: Drain, depth: number): Promise<void> {
  const t = d.target;
  if (!live(t)) return;
  play('gwGiveBack', { volume: 1, pan: panAt(t.home.x) });
  const thread = soulThread(sc, () => (live(t) ? rint(t.core()) : rint(t.home)), () => from, d.ramp, depth, 16);
  thread.flow = -1;
  thread.width = 0.9;
  // critic r3: the rivulet pours from the glass to the target (180 ms) and the plate rolls +400 on the frame its
  // first drop lands (it used to wait for the end of the flow, ≈ 0.6 s after the light arrived); 130 ms pour
  await animate(sc, 130, (k) => {
    thread.reach = k * (2 - k);
    d.fade.set(0.3 * (1 - 0.3 * k));
  });
  thread.reach = 1;
  if (live(t)) {
    const st = t.shownStats;
    if (t.battleTint) {
      t.battleTint = false;
      void t.setStats(st.atk + 400, st.def, true);
      play('gwDebuff', { volume: 0.6, pan: panAt(t.home.x), pitch: 1.5 });
    }
    flash(sc, t.core().x, t.home.y, d.ramp, 18, 200, 1.1);
  }
  await animate(sc, 260, (k) => {
    d.fade.set(0.21 * (1 - k));
    thread.width = k < 0.5 ? 0.9 : k < 0.8 ? 0.5 : 0.2;
  });
  thread.destroy();
  d.fade.destroy();
  if (live(t)) {
    flash(sc, t.core().x, t.home.y, d.ramp, 24, 260, 1.3);
    embersUp(sc, rint(t.core()), d.ramp, t.sprite.depth + 0.4);
  }
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

/**
 * The skull-shaped mist puffs out of the broken lantern and rises AT ONCE (never stands on the floor): ~38 px in
 * ≈600 ms, swaying, its tail streaming from the lantern; it stretches upward and tears apart from k 0.35, a soft
 * light-layer glow riding with it. gwWail is fired by the caller on the same frame.
 */
async function skullLeaves(sc: Phaser.Scene, at: XY, ramp: Ramp, depth: number, floorY: number): Promise<void> {
  const sk = skullMist(sc, { x: at.x, y: at.y - 4 }, ramp, depth);
  sk.root = { x: at.x, y: at.y };
  const glow = floorGlow(sc, { x: at.x, floorY, ramp, radius: 20, intensity: 0.9 });
  glow.follow(() => sk.pos, () => floorY);
  // critic r3: the mist read as a 14-px green speck that dithered out ≈ 10 px up — it now RISES 34 px over 760 ms, holds
  // whole until halfway, wails (jaw drops wide) on the way up, then STRETCHES and tears apart; its light rides with it
  await animate(sc, 760, (k, el) => {
    const e = 1 - (1 - k) * (1 - k);
    sk.pos = { x: at.x + Math.round(Math.sin(el * 0.011) * 3 * k), y: at.y - 6 - Math.round(34 * e) };
    sk.root = { x: at.x + Math.round(Math.sin(el * 0.01) * 2), y: at.y - Math.round(14 * Math.max(0, k - 0.3)) };
    // a puff (squashed) that springs into the skull, then is torn upward and apart
    sk.stretch = k < 0.12 ? 0.55 + 3.75 * k : 1 + Math.max(0, k - 0.5) * 2.2;
    sk.gone = k < 0.55 ? 0 : Math.min(1, (k - 0.55) / 0.42);
    // the jaw drops wide on the wail's peak, then hangs
    sk.open = k < 0.1 ? 0 : k < 0.16 ? 0.6 : k < 0.5 ? 1 : 0.5;
    glow.setIntensity(k < 0.55 ? 0.9 : 0.9 * Math.max(0, 1 - (k - 0.55) / 0.45), 0);
  });
  void glow.fadeOut(100);
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
