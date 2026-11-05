// Kovuk Devi (hollow_ogre) — its v3 cinematics (?look=v3 only; YENI_KARTLAR §6 C6). Painters: ./hollow_ogre-fx.ts.
// Every registration below is gated on LOOK_V3: the v1 look keeps today's paths byte for byte (KK-9).
//
// Summon — "the log falls":
//   0     a shadow grows on the tile; a giant sealed log drops vertically from above the screen (hoLogFall: air
//         roaring past it, a whistle through the open log top; bark streaks trail above it)
//   ~300  it STAKES into the tile (the sprite's `summon` f1 = land): hoStake, a crack star in the floor, a loam ring,
//         splinters, a 3-px shake
//   f2    the door seam glows from inside (ember light);  f3 the bark splits open like a door (hoBarkSplit, chips fly)
//   f5–7  shoulders and roots unfurl, the giant steps out on a root foot (hoStep, loam)
//   f9    the club SLAMS the ground (hoClubSlam: slam + the trunk's groan) — crack, ring, splinters, leaves off the crown,
//         the badge pops (the finale), the door plates fall away
// Strike — "Kütük Ezmesi":
//   the roots heave the club up behind the shoulder (hoCharge, from the declaration's pose) while the giant comes on in
//   TWO HEAVY STEPS (each a hop that lands with hoStep, loam and root-grip marks stamped round its foot), the club
//   comes over (hoSwing) and down (hoRelease) and SMASHES on the contact frame (the number; heavy hit-stop from the
//   art's weight): hoImpact, a crack star at the club head, splinters, leaves, a loam ring. Boosted (the effect this
//   turn): glowing sprouts ride the club and burst into violet pollen on contact (hoPollen). The club is thrown onto
//   the shoulder (hoShoulder) and the giant steps home. Direct: the smash ruptures the floor — a crack runs along the
//   ground to the duelist, loam spurting up behind its head, and hits there.
// Effect — "Kovuğa ekim", on the engine's events (HANDBOOK §6.4):
//   activate   the giant heaves its club up and STABS it head-first into the floor before its foot (special f0–3;
//              hoStab); a root bursts out of the club head and runs ALONG THE FLOOR toward its own graveyard, rises
//              and opens a three-pronged cup (graveRoot; hoRootRun, hoCupOpen); the pile answers (banded arcs, motes).
//              With ≥ 2 monsters the chooseCount prompt waits here.
//   banish ×k  (this file's 'banish' handler, priority 1 over the placeholder b2:banish): per seed — the REAL graveyard
//              card's monster rises over the pile as a violet ghost of its own pixels, stands, collapses into a light
//              seed (hoShrink); the seed arcs onto the cup (hoSeed; the first in a local slow-motion), the cup snaps
//              shut (hoCatch), the giant HAULS (f4) and the root carries the seed home inside it (hoCarry), it climbs
//              the club into the hollow (f5, hoClimb), burns as a KNOT LIGHT — ember cracks burst out of the bark
//              (f6, hoKnot, +400) — and a sprout springs on the club (f7, hoSprout). The next seed launches as soon as
//              the cup is free. FINALE: the hollow blazes (f8 held, hoGlow), the root sinks back, the club comes out.
//   statChange is consumed: the badge rolls +400 per seed, on the seed's knot beat.
//   rest of the turn: the knot lights stay in the hollow and the sprouts on the club (an aura; a violet light pool on
//              the hollow), cleared on turnStart; the strike reads them (pollen).
// Death — "kökler çözülüp karoya çekilir, tek filiz solar" (§5.2, no material shatter):
//   the death pose continues the blow; the root arms unravel (hoUnravel), strands of root slither out along the floor
//   and dig into the tile and are pulled in after them (hoRootsRetract, sustained), the trunk caves in (hoCollapse, dust
//   drawn inward), it sinks, one sprout remains and wilts (hoWilt, a last leaf drifting down) — the sprout goes out in
//   the last 150 ms in four bayer steps, the card is born on the tile on that frame and flies to the graveyard.
// No camera moves of its own (EF-8): no ctx.focus anywhere in this file.

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import type { MonsterId } from '../../data/cards';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, Uid } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import { hitStop, shake } from '../../vfx/core';
import { registerCardHook, registerEvent, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, fade as fadeSnd, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { strikeStartFrame } from '../_v3/clash';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { contactFlash } from '../_v3/flash';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import {
  TAU,
  boostAura,
  caveIn,
  dustWall,
  emberCrack,
  fallShadow,
  guardChips,
  climbSeed,
  graveRoot,
  knotBurst,
  logColumn,
  type GraveRoot,
  rootStar,
  seedNumber,
  sproutRing,
  fallStreaks,
  floorCrack,
  floorRing,
  knockOut,
  lastLeaf,
  leaves,
  livePoint,
  loam,
  pileStir,
  pointOf,
  pollen,
  rng,
  rootsIntoTile,
  rupture,
  seedFlight,
  shrinkToSeed,
  splinters,
  drawSeed,
  type Boost,
  type Rng,
} from './hollow_ogre-fx';

type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
type Ctx<T extends GameEvent['type']> = CinematicContext<Ev<T>>;

const ID = 'hollow_ogre';
const EARTH = RAMPS.earth;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const rint = (p: XY): XY => ({ x: Math.round(p.x), y: Math.round(p.y) });
const live = (u: MonsterUnit | null | undefined): MonsterUnit | null => (u && !u.retired && u.sprite.active ? u : null);
const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Put the sprite's FEET on a floor point (whole pixels; depth sorted), lifted by `hop` px. */
function placeFeet(u: MonsterUnit, feet: XY, hop = 0): void {
  const s = u.sprite;
  if (!s.active) return;
  s.setPosition(Math.round(feet.x), Math.round(feet.y - u.hover - hop));
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

// ================================================================ the boosted state (effect → rest of the turn)

interface BoostState {
  aura: Boost;
}
const boosts = new Map<Uid, BoostState>();

function boostOf(u: MonsterUnit): BoostState {
  let b = boosts.get(u.uid);
  if (!b) {
    const aura = boostAura(u.scene, u, 0);
    // (no violet floor pool: on the merged arena a violet floor stamp reads as a dark stain — the aura carries the glow)
    const state: BoostState = { aura };
    boosts.set(u.uid, state);
    u.setAura('ogreBoost', {
      destroy: () => {
        aura.destroy();
        if (boosts.get(u.uid) === state) boosts.delete(u.uid);
      },
    });
    b = state;
  }
  return b;
}

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (ev.type !== 'turnStart' && ev.type !== 'gameOver') return;
    for (const uid of [...boosts.keys()]) {
      const u = ctx.unit(uid);
      if (u) u.setAura('ogreBoost', null);
      else {
        const b = boosts.get(uid);
        b?.aura.destroy();
      }
      boosts.delete(uid);
    }
  });

// ================================================================ idle voice (v3 only, very quiet, sparse)

const idleVoiced = new WeakSet<MonsterUnit>();
/** The giant's idle, heard: every third loop the log's settle creak (idle f3), every fourth the firefly's tick (f4). */
function idleVoice(u: MonsterUnit): void {
  if (idleVoiced.has(u)) return;
  idleVoiced.add(u);
  let loops = 0;
  let last = -1;
  onFrame(u.scene, () => {
    if (u.retired || !u.sprite.active) return false;
    const fi = u.frameInfo();
    if (fi.anim !== 'idle' || !u.sprite.visible) {
      last = -1;
      return true;
    }
    if (fi.frame !== last) {
      if (fi.frame === 0) loops++;
      const pan = panAt(u.sprite.x);
      if (fi.frame === 3 && loops % 3 === 1) play('hoIdleCreak', { volume: 0.32, pan });
      if (fi.frame === 4 && loops % 4 === 2) play('hoFirefly', { volume: 0.28, pan });
      last = fi.frame;
    }
    return true;
  });
}

// ================================================================ summon: the log falls, stakes, opens, SLAM

/** Ms (scene) of the log's fall from above the screen to the tile, and of the stake driving it in. */
const FALL_MS = 250;
const DRIVE_MS = 130;
/** Px of log below the sprite's own base: the falling log is this much taller than the giant (driven into the tile). */
const LOG_EXT = 46;

async function logFallV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home, unit: u } = S;
  const s = u.sprite;
  const R = rng(S.ev.uid * 13 + 5);
  const pan = panAt(home.x);
  fadeSnd(['summonCharge'], 160);
  if (!u.has('summon')) return;
  // ---- the shadow grows on the tile, a log far taller than the giant drops from above the screen
  const rest = u.rest0;
  const y0 = -12;
  u.pose('summon', 0);
  u.showSprite();
  s.setPosition(rest.x, y0);
  const fall = start('hoLogFall', { volume: 0.9, pan });
  const shadow = S.own(fallShadow(sc, home, 20, DEPTH.SHADOW + 0.5));
  const col = S.own(logColumn(sc, u, LOG_EXT, s.depth + 0.05));
  const art = u.art;
  const topOf = (): XY => ({ x: s.x, y: s.y - art.anchorY + 26 });
  const streaks = fallStreaks(sc, () => ({ x: s.x, y: topOf().y }), 28, s.depth - 0.2);
  S.own({ destroy: () => streaks.stop() });
  await animate(sc, FALL_MS, (k, el) => {
    const e = k * k;
    // the giant log wobbles as it drops (whole-px sideways jolts, no rotation)
    const wob = [0, 1, 0, -1][Math.floor(el / 60) % 4];
    s.setPosition(rest.x + wob, Math.round(lerp(y0 - LOG_EXT, rest.y - LOG_EXT, e)));
    col.set(home.y);
    shadow.set(Math.min(1, k * 1.15));
  });
  streaks.stop();
  // ---- STAKE: the log's foot hits the tile and the whole length is DRIVEN in (the column telescopes away under
  // the floor line), a dust wall bursts up round it
  fall.stop(30);
  play('hoStake', { volume: 1, pan });
  void shake(sc, 300, 4);
  dustWall(sc, home, 26, R);
  floorCrack(sc, { x: home.x, y: home.y + 1 }, 28, S.ev.uid * 3 + 1, 700);
  floorRing(sc, home, 34, 340, [PAL.earth4, PAL.earth3, PAL.earth2]);
  // (critic r2: an earth3 floor light is darker than the lit floor and stamped mud stains: a warm gold flash brightens)
  void lightFlash(sc, home.x, home.y - 6, PAL.gold3, 44, 300, { floorY: home.y, intensity: 0.7 });
  await animate(sc, DRIVE_MS, (k) => {
    const e = 1 - (1 - k) * (1 - k);
    s.setPosition(rest.x, Math.round(lerp(rest.y - LOG_EXT, rest.y, e)));
    col.set(home.y);
  });
  s.setPosition(rest.x, rest.y);
  col.destroy();
  shadow.destroy();
  // (summon f1 = land): the pose plays on from the landing frame
  const done = u.playRange('summon', 1, undefined, { hold: false });
  loam(sc, home, 16, 80, R);
  splinters(sc, { x: home.x, y: home.y - 4 }, home.y, 14, R, { up: 0.9 });
  // f2: the door seam glows from inside — ember light spills out of the crack onto the floor (2 frames) before it bursts
  const ember = S.glow({ color: PAL.gold3, spill: PAL.gold2, radius: 16, intensity: 0, anim: 'flicker', fadeIn: 0, at: rint(pointOf(u, 'summon', 2, 'core')) });
  atFrame(u, 'summon', 2, () => {
    ember.setIntensity(1, 50);
    play('hoEmber', { volume: 0.8, pan });
    emberCrack(sc, () => rint(livePoint(u, 'core')), s.depth + 0.3, u.frameMs('summon', 2) + 40);
    const spill = lightPool(sc, home.x + (u.flipX ? -10 : 10), home.y + 4, { color: PAL.gold3, spill: PAL.gold2, radius: 22, floorY: home.y + 4, intensity: 0.9, anim: 'flicker', fadeIn: 40 });
    void sleep(sc, 420).then(() => spill.fadeOut(260));
  }, { late: false });
  // f3: the bark splits open like a door — chips burst off both hinge edges, the eyes ignite in the dark
  atFrame(u, 'summon', 3, () => {
    play('hoBarkSplit', { volume: 0.95, pan });
    const c = rint(pointOf(u, 'summon', 3, 'core'));
    splinters(sc, { x: c.x - 7, y: c.y }, home.y, 10, R, { dir: -1, up: 0.7 });
    splinters(sc, { x: c.x + 7, y: c.y }, home.y, 10, R, { dir: 1, up: 0.7 });
    void lightFlash(sc, c.x, c.y, PAL.gold3, 34, 300, { floorY: home.y, air: 0.9, intensity: 1 });
    ember.setIntensity(1.2, 40);
    void shake(sc, 90, 1);
  }, { late: false });
  // f4: the eyes ignite in the dark seam (a gold flare in the hollow), bark crumbs trickle off the opened doors
  atFrame(u, 'summon', 4, () => {
    const c = rint(pointOf(u, 'summon', 4, 'head'));
    play('hoEyes', { volume: 0.85, pan });
    void lightFlash(sc, c.x, c.y, PAL.gold4, 16, 220, { floorY: home.y, air: 1, intensity: 1 });
    splinters(sc, { x: c.x - 6, y: c.y + 6 }, home.y, 5, R, { up: 0.3, dir: -1 });
    splinters(sc, { x: c.x + 6, y: c.y + 6 }, home.y, 5, R, { up: 0.3, dir: 1 });
  }, { late: false });
  // f5: the shoulders shrug free of the log (bark dust off both shoulders), the mane unfolds shedding leaves
  atFrame(u, 'summon', 5, () => {
    ember.fadeOut(260);
    play('hoShrug', { volume: 0.8, pan });
    const hd = rint(pointOf(u, 'summon', 5, 'head'));
    leaves(sc, hd, home.y, 7, R, s.depth + 0.3);
    splinters(sc, { x: hd.x - 8, y: hd.y + 2 }, home.y, 4, R, { up: 0.5, dir: -1 });
    splinters(sc, { x: hd.x + 8, y: hd.y + 4 }, home.y, 4, R, { up: 0.5, dir: 1 });
    void shake(sc, 80, 1);
  }, { late: false });
  // f7: the near root foot comes down out of the hole
  atFrame(u, 'summon', 7, () => {
    play('hoStep', { volume: 0.8, pan });
    loam(sc, { x: home.x + (u.flipX ? -6 : 6), y: home.y }, 8, 44, R);
    rootGrip(sc, { x: home.x + (u.flipX ? -8 : 8), y: home.y }, R);
  }, { late: false });
  // f9: SLAM — the club pounds the ground: a root-crack star runs across the tile, a ring of moss and sprouts pops up
  // round the blow (and withers), leaves rain off the crown, the door plates are shaken loose, the badge pops
  // f8: the wind-up — the crown creaks back, the eyes flare (anticipation)
  atFrame(u, 'summon', 8, () => {
    const c = rint(pointOf(u, 'summon', 8, 'head'));
    void lightFlash(sc, c.x, c.y, PAL.gold4, 14, 200, { floorY: home.y, air: 1, intensity: 0.9 });
  }, { late: false });
  // f11: the fallen door slabs break into chips on the tile
  atFrame(u, 'summon', 11, () => {
    const c = rint(pointOf(u, 'summon', 11, 'core'));
    play('hoCrumble', { volume: 0.75, pan });
    for (const dx of [-8, 8]) splinters(sc, { x: c.x + dx, y: home.y - 2 }, home.y, 9, R, { up: 0.6, dir: Math.sign(dx) });
  }, { late: false });
  atFrame(u, 'summon', 9, () => {
    // the blow lands: a real hit-stop holds the world 100 ms on the contact frame
    void hitStop(sc, 100);
    play('hoClubSlam', { volume: 1, pan });
    const at = rint(pointOf(u, 'summon', 9, 'muzzle'));
    const g = { x: at.x, y: Math.min(home.y + 4, at.y + 1) };
    // (critic r2: the debris spilled over the neighbour's badge — kept inside about one tile, its centre pulled back
    // toward the giant's own tile)
    const gd = { x: Math.round(lerp(at.x, home.x, 0.4)), y: g.y };
    rootStar(sc, g, 32, S.ev.uid * 5 + 2, 820);
    sproutRing(sc, gd, 16, 11, R, 950);
    floorRing(sc, g, 24, 320);
    loam(sc, gd, 10, 50, R);
    splinters(sc, gd, home.y + 2, 9, R, { up: 1.1 });
    const hd = rint(pointOf(u, 'summon', 9, 'head'));
    leaves(sc, { x: hd.x, y: hd.y - 8 }, home.y, 9, R, s.depth + 0.3);
    void sleep(sc, 90).then(() => leaves(sc, { x: hd.x - 6, y: hd.y - 24 }, home.y, 7, R, s.depth + 0.3));
    void lightFlash(sc, g.x, g.y, PAL.gold3, 40, 420, { floorY: home.y, ring: true, intensity: 0.9 });
    void lightFlash(sc, g.x, g.y - 4, PAL.gold4, 26, 200, { floorY: home.y, intensity: 1.2 });
    dustWall(sc, gd, 11, R);
    // a leaf burst off the crown: the whole canopy shakes loose
    const cr = rint(pointOf(u, 'summon', 9, 'head'));
    leaves(sc, { x: cr.x - 4, y: cr.y - 14 }, home.y, 8, R, s.depth + 0.3);
    const moss = lightPool(sc, g.x, g.y, { color: PAL.leaf3, spill: PAL.leaf2, radius: 20, floorY: g.y, intensity: 0.6, anim: 'breathe', fadeIn: 60 });
    void sleep(sc, 500).then(() => moss.fadeOut(300));
    void shake(sc, 260, 3);
    void u.badge.pop();
  }, { late: false });
  await done;
  idleVoice(u);
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from === 'field') return ctx.base();
      // under the card's slam into the zone: the hole opens (a hollow "oom") and a whistle starts high above
      const zx = zoneXY(ctx.ev.player, 'monster', ctx.ev.zone).x;
      void sleep(ctx.scene, 170).then(() => play('hoLogCall', { volume: 0.85, pan: panAt(zx) }));
      await runSummon(ctx, async () => undefined, logFallV3);
    },
    { priority: 20, name: 'kart-b:hollow_ogre:summon' },
  );

// ================================================================ effect: "Kovuğa ekim" (activate → banish × k → statChange)

/** The reach pose kept from the activation (batch 1) for the banish handler (batch 1 or 2). */
interface Reach {
  uid: Uid;
  stir: { destroy(): void };
  root: GraveRoot;
  /** True once the banish handler owns the pose. */
  taken: boolean;
  destroy(): void;
}

/** The special's receiving frame (the club stabbed into the floor, both hands on it; the root's cup open). */
const RECEIVE_F = 3;

/** Where the planted club's head meets the floor (frame `f` of the special). */
function clubFloor(u: MonsterUnit, f: number): XY {
  const m = rint(pointOf(u, 'special', f, 'muzzle'));
  return { x: m.x, y: Math.min(u.home.y + 3, m.y + 1) };
}

async function reachV3(ctx: Ctx<'activate'>, u: MonsterUnit): Promise<Reach> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const R = rng(ev.uid * 17 + 3);
  u.posed = true;
  const pile = ctx.views.field.pile(ev.player, 'graveyard');
  const pAt = rint(pile.topXY());
  const pan = panAt(u.home.x);
  play('hoReach', { volume: 0.85, pan });
  const stir = pileStir(sc, { x: pAt.x, y: pAt.y - 1 }, DEPTH.FX - 2, R);
  // f2: the club is STABBED head-first into the floor in front of the near foot
  atFrame(u, 'special', 2, () => {
    play('hoStab', { volume: 0.95, pan });
    const g = clubFloor(u, 2);
    floorCrack(sc, g, 12, ev.uid * 5 + 9, 900);
    loam(sc, g, 10, 50, R);
    splinters(sc, { x: g.x, y: g.y - 2 }, g.y, 8, R, { up: 0.8 });
    void lightFlash(sc, g.x, g.y - 3, PAL.gold3, 22, 260, { floorY: g.y, intensity: 0.7 });
    void shake(sc, 140, 2);
  }, { late: false });
  await u.playRange('special', 0, RECEIVE_F);
  u.pose('special', RECEIVE_F);
  // the root bursts out of the club head and runs ALONG THE FLOOR toward the graveyard, rises and opens its cup
  const base = clubFloor(u, RECEIVE_F);
  const toward = { x: pAt.x, y: pAt.y + 2 };
  // the root lies ON the floor (under every body: on P2 it used to be drawn over the opponent's heron)
  const root = graveRoot(sc, base, toward, 0.6, DEPTH.SHADOW + 0.7, R);
  play('hoRootRun', { volume: 0.9, pan: panAt(lerp(base.x, toward.x, 0.3)) });
  await root.grow(400);
  play('hoCupOpen', { volume: 0.7, pan: panAt(root.cup().x) });
  const r: Reach = {
    uid: u.uid,
    stir,
    root,
    taken: false,
    destroy() {
      stir.destroy();
      if (!r.taken) {
        void root.retract(260).then(() => root.destroy());
        if (live(u)) {
          u.posed = false;
          u.rest();
        }
      }
    },
  };
  return r;
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'effect',
    async (ctx) => {
      const u = live(ctx.unit(ctx.ev.uid));
      if (!u || !u.sprite.visible || !u.has('special')) return ctx.base();
      idleVoice(u);
      const reach = await reachV3(ctx, u);
      // the banish handler takes it (in this batch, or in the next one after the chooseCount prompt)
      ctx.keep('ogre:reach', reach);
    },
    { priority: 20, name: 'kart-b:hollow_ogre:effect' },
  );

/**
 * Planting timeline (scene ms; owner decision 2026-11-05: no fixed budget — this is the card's signature, it breathes):
 * the real monster's ghost rises (RISE) and stands over the pile (HOLD), collapses into a seed (SHRINK), the seed arcs
 * onto the root's cup (FLIGHT; the first one in a local slow-motion round its apex and the catch), the root carries it
 * home along the floor (CARRY), it climbs the club into the hollow (CLIMB), knot, sprout; FINALE holds the glow.
 */
const RISE_MS = 150;
const HOLD_MS = 210;
const SHRINK_MS = 260;
const FLIGHT_MS = 480;
const SLOW_FIRST = 1.4;
const CARRY_MS = 290;
const CLIMB_MS = 250;
const FINALE_MS = 560;

async function plantV3(ctx: Ctx<'banish'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const src = ev.sourceUid as Uid;
  // every banish of this activation (they come in a row), and the boost
  const group: Ev<'banish'>[] = [ev];
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'banish' && e.sourceUid === src && !ctx.isConsumed(i)) {
      group.push(e);
      ctx.consumeAt(i);
    } else break;
  }
  const si = ctx.findType('statChange', (e) => e.uid === src);
  const sEv = si >= 0 ? (ctx.events[si] as Ev<'statChange'>) : null;
  if (si >= 0) ctx.consumeAt(si);
  let reach = ctx.take('ogre:reach') as Reach | null;
  const u = live(ctx.unit(src));
  if (!u || !u.sprite.visible || !u.has('special')) {
    reach?.destroy();
    if (u && sEv) await u.setStats(sEv.atk, sEv.def, true);
    return;
  }
  if (!reach || reach.uid !== u.uid) {
    reach?.destroy();
    reach = await reachV3(ctx as unknown as Ctx<'activate'>, u);
  }
  reach.taken = true;
  const root = reach.root;
  u.posed = true;
  const R: Rng = rng(src * 23 + group.length);
  const owner = ev.owner;
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const pileFloor = rint(pile.topXY());
  const pan = panAt(u.home.x);
  const pPan = panAt(pileFloor.x);
  const back = u.flipX ? 1 : -1;
  // the graveyard as the cards leave it (oldest monsters first; the top card stays unless it goes)
  const grave = [...ctx.state.players[owner].graveyard];
  const setPile = () => {
    const top = grave.length ? ctx.state.cards[grave[grave.length - 1]].cardId : null;
    pile.set(grave.length, top);
    pile.bump();
  };
  const atk0 = sEv ? sEv.prevAtk : u.shownStats.atk;
  const def = sEv ? sEv.def : u.shownStats.def;
  const boost = boostOf(u);
  const seedAt = (): XY => ({ x: pileFloor.x, y: pileFloor.y - 14 });
  const depth = DEPTH.FX + 2;
  const k = group.length;
  // the receiving loop (critic r2: an almost static f2/f3 for 2.4 s): a real STRAIN CYCLE on the planted lever — the
  // giant hauls back (f4, the trunk leans a px away), settles (f3), presses forward onto the club (f2, a px in), with
  // the hollow's warm light breathing and the root's sap pulse running home (graveRoot) between the seeds
  const baseX = u.rest0.x;
  const lean = u.flipX ? 1 : -1;
  const CYCLE: readonly (readonly [number, number, number])[] = [
    [RECEIVE_F, 150, 0],
    [RECEIVE_F + 1, 120, 1],
    [RECEIVE_F + 1, 90, 1],
    [RECEIVE_F, 130, 0],
    [RECEIVE_F - 1, 120, -1],
    [RECEIVE_F, 110, 0],
  ];
  let receiving = true;
  const c0 = rint(livePoint(u, 'core'));
  const breath = lightPool(sc, c0.x, c0.y, { color: PAL.gold3, spill: PAL.gold2, radius: 12, floorY: u.home.y + 2, intensity: 0.5, anim: 'breathe', fadeIn: 200 });
  breath.follow(() => (live(u) ? livePoint(u, 'core') : null), { floorY: u.home.y + 2 });
  void (async () => {
    let n = 0;
    while (receiving && live(u)) {
      const [f, ms, dx] = CYCLE[n % CYCLE.length];
      if (receiving && u.frameInfo().anim === 'special' && !u.sprite.anims.isPlaying) {
        u.pose('special', f);
        u.sprite.x = baseX + lean * dx;
      }
      n++;
      await sleep(sc, ms);
    }
    if (live(u)) u.sprite.x = baseX;
  })();
  // the giant notices each ghost: its ember eyes flick toward the pile (a gold glint on the pile side of the eye), a creak
  const eyeFlick = () => {
    if (!live(u)) return;
    play('hoIdleCreak', { volume: 0.55, pan });
    const side = Math.sign(pileFloor.x - u.home.x) || 1;
    const r = Raster.around(sc, u.home.x, u.home.y - 40, 60, 60, u.sprite.depth + 0.6);
    void animate(sc, 300, (kk) => {
      r.draw((g) => {
        if (!live(u) || kk > 0.92) return;
        const e = rint(livePoint(u, 'head'));
        g.px(e.x + side, e.y, PAL.white);
        g.px(e.x + side * 2, e.y, kk < 0.5 ? PAL.gold4 : PAL.gold3);
        if (kk < 0.4) g.px(e.x + side, e.y - 1, PAL.gold4);
      });
    }).then(() => r.destroy());
    const e = livePoint(u, 'head');
    void lightFlash(sc, e.x, e.y, PAL.gold4, 12, 200, { floorY: u.home.y, air: 1, intensity: 0.8 });
  };
  // one seed's ghost: it rises over the pile, stands, collapses into a light seed
  const form = async (i: number): Promise<void> => {
    const b = group[i];
    grave.splice(grave.indexOf(b.uid), 1);
    setPile();
    // the hollow CALLS as the ghost rises; the giant's eyes flick toward it and the log creaks
    play('hoGhost', { volume: 0.85, pan: pPan });
    eyeFlick();
    // the inhale starts as the ghost collapses: its tik lands on the frame the seed appears
    void sleep(sc, RISE_MS + HOLD_MS).then(() => play('hoShrink', { volume: 0.85, pan: pPan }));
    await shrinkToSeed(sc, b.cardId as MonsterId, pileFloor, owner === 1, seedAt(), depth, { riseMs: RISE_MS, holdMs: HOLD_MS, shrinkMs: SHRINK_MS });
  };
  let lastNum: { destroy(): void } | null = null;
  // seed i: catch on the cup → carried home along the root → climbs the club into the hollow → knot → sprout
  let climbed: () => void = () => undefined;
  const plant = async (i: number): Promise<void> => {
    receiving = false;
    if (live(u)) u.sprite.x = baseX;
    root.snap();
    root.open = 0;
    play('hoCatch', { volume: 0.9, pan: panAt(root.cup().x) });
    const cup = rint(root.cup());
    const sp = new Sparks(sc, depth + 0.2);
    for (let q = 0; q < 10; q++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.6;
      sp.add({ x: cup.x, y: cup.y, vx: Math.cos(a) * (30 + R() * 40), vy: Math.sin(a) * (30 + R() * 40), drag: 3, life: 260 + R() * 160, colors: q % 3 ? [PAL.void4, PAL.void3, PAL.void2] : [PAL.white, PAL.gold4, PAL.void4], shape: q % 4 ? 'px' : 'plus', fadeAt: 1 });
    }
    sp.release();
    // f4: the giant hauls on the club; the seed runs home inside the root
    u.pose('special', 4);
    await sleep(sc, 60);
    play('hoCarry', { volume: 0.8, pan: panAt(root.base.x) });
    await root.carry(CARRY_MS, () => {
      root.open = 1;
    });
    // the cup is free: the next seed may launch (it lands as this one's sprout pops)
    climbed();
    // f5: up the club, up the arm, into the hollow
    u.pose('special', 5);
    play('hoClimb', { volume: 0.8, pan, pitch: 1 + i * 0.08 });
    await climbSeed(sc, () => (live(u) ? [livePoint(u, 'muzzle'), livePoint(u, 'grip'), livePoint(u, 'core')] : null), CLIMB_MS, u.sprite.depth + 0.6, R);
    // f6: the seed burns as a KNOT LIGHT — ember cracks burst out of the bark round the hollow, the giant jolts
    u.pose('special', 6);
    const c = rint(livePoint(u, 'core'));
    play('hoKnot', { volume: 0.95, pan, pitch: i === 0 ? 1 : 1.19 });
    knotBurst(sc, c, u.sprite.depth + 0.5, R, i === k - 1);
    void shake(sc, 120, i === k - 1 ? 2 : 1);
    const s0 = u.sprite;
    const bx = s0.x;
    void animate(sc, 150, (_kk, el) => {
      if (s0.active) s0.x = bx + [2, -2, 1, -1, 0, 0][Math.min(5, Math.floor(el / 30))] * (u.flipX ? -1 : 1);
    }).then(() => {
      if (s0.active) s0.x = bx;
    });
    boost.aura.n = i + 1;
    boost.aura.flare();
    // the +400 rises over the hollow on the giant's OWN side (short-lived: gone before the next action)
    lastNum?.destroy();
    lastNum = seedNumber(sc, () => {
      const cc = live(u) ? livePoint(u, 'core') : c;
      return { x: cc.x + back * 10, y: cc.y - 24 };
    }, 400, i === k - 1 ? 760 : 620);
    void u.setStats(atk0 + 400 * (i + 1), def, true);
    await sleep(sc, u.frameMs('special', 6) + 30);
    // f7: the sprout springs on the club (its bud pops, leaves)
    u.pose('special', 7);
    play('hoSprout', { volume: 0.85, pan, pitch: 1 + i * 0.12 });
    boost.aura.pulse();
    const bd = boost.aura.bud(i);
    if (bd) leaves(sc, bd, u.home.y, 4, R, u.sprite.depth + 0.4);
    await sleep(sc, u.frameMs('special', 7));
  };
  try {
    let formed = form(0);
    let planted: Promise<void> = Promise.resolve();
    // the next seed may launch once the previous one is up in the hollow (it lands as the sprout pops)
    let upInHollow: Promise<void> = Promise.resolve();
    for (let i = 0; i < k; i++) {
      await formed;
      await upInHollow;
      if (i === k - 1) reach.stir.destroy();
      const first = i === 0;
      // sustained: the whistle lives exactly as long as the flight (the first one over its slow-motion apex)
      const whistle = start(first ? 'hoSeedSlow' : 'hoSeed', { volume: 1, pan: pPan });
      // the next ghost starts rising while this seed flies
      const flight = seedFlight(sc, seedAt(), () => root.cup(), FLIGHT_MS + (first ? 100 : 0), 28 + i * 6, depth + 0.5, R, { floorFrom: pileFloor.y, floorTo: root.base.y, slow: first ? SLOW_FIRST : 0 });
      if (i + 1 < k) formed = sleep(sc, 200).then(() => form(i + 1));
      await flight;
      whistle.stop(45);
      await planted;
      upInHollow = new Promise<void>((res) => (climbed = res));
      planted = plant(i).then(() => {
        if (i < k - 1) {
          u.pose('special', RECEIVE_F);
          receiving = true;
        }
      });
    }
    await planted;
    receiving = false;
    breath.fadeOut(500);
    // FINALE: the hollow blazes with its knot lights, the buds pulse, one deep hollow "tok"; the root sinks back
    reach.destroy();
    u.pose('special', 8);
    play('hoGlow', { volume: 0.95, pan });
    const c = rint(livePoint(u, 'core'));
    const motes = new Sparks(sc, u.sprite.depth + 0.5);
    for (let q = 0; q < 12; q++) motes.add({ x: c.x + (R() - 0.5) * 6, y: c.y + (R() - 0.5) * 8, vx: (R() - 0.5) * 12, vy: -14 - R() * 16, drag: 0.8, life: 600 + R() * 400, delay: q * 35, colors: [PAL.white, PAL.void4, PAL.void3, PAL.void2], shape: q % 3 ? 'px' : 'sq', size: 2, fadeAt: 1, flicker: q % 2 === 0 });
    motes.release();
    void root.retract(FINALE_MS - 120).then(() => root.destroy());
    void lightFlash(sc, c.x, c.y, PAL.gold4, 18, 300, { floorY: u.home.y, air: 1, intensity: 0.6 });
    for (let t = 0; t < FINALE_MS; t += 180) {
      boost.aura.flare();
      await sleep(sc, Math.min(180, FINALE_MS - t));
      if (t === 180) boost.aura.pulse();
    }
    if (sEv) void u.setStats(sEv.atk, sEv.def, true);
    // the club is wrenched out of the floor and comes back to the hang (not awaited: the next action may start)
    atFrame(u, 'special', 9, () => {
      play('hoStep', { volume: 0.6, pan });
      loam(sc, root.base, 8, 40, R);
    }, { late: false });
    const rest = u.playRange('special', 9, undefined, { hold: false });
    await sleep(sc, 120);
    void rest.then(() => {
      if (live(u)) u.posed = false;
    });
  } catch (e) {
    console.error('[hollow_ogre plant] failed', e);
    receiving = false;
    breath.destroy();
    reach.taken = false;
    reach.destroy();
    u.posed = false;
    if (sEv) void u.setStats(sEv.atk, sEv.def, true);
  }
}

if (LOOK_V3)
  registerEvent(
    'banish',
    (ctx) => {
      const src = ctx.ev.sourceUid;
      if (src === null || ctx.cardId(src) !== ID) return ctx.base();
      return plantV3(ctx);
    },
    { priority: 1, name: 'kart-b:hollow_ogre:banish' },
  );

// ================================================================ strike: "Kütük Ezmesi"

/** Root-grip marks stamped round a foot that lands (short dark root lines, stepped out). */
function rootGrip(sc: Phaser.Scene, at: XY, R: Rng): void {
  const r = Raster.around(sc, at.x, at.y, 30, 14, DEPTH.SHADOW + 0.6);
  const arms: number[] = [];
  for (let i = 0; i < 5; i++) arms.push((i / 5) * TAU + R() * 0.5);
  void animate(sc, 360, (k) => {
    const L = Math.round(3 + 5 * Math.min(1, k * 4));
    r.draw((g) => {
      for (const a of arms) {
        const x1 = at.x + Math.cos(a) * L;
        const y1 = at.y + Math.sin(a) * L * 0.4;
        g.line(at.x + Math.cos(a) * 2, at.y + Math.sin(a), x1, y1, k < 0.6 ? PAL.earth1 : PAL.earth0, k < 0.8 ? 1 : 0.5);
      }
    });
  }).then(() => r.destroy());
}

async function smashV3(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const R = rng(u.uid * 53 + (s.target?.uid ?? 3));
  const res = (s.ctx.ev as Ev<'battle'>).result;
  const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
  idleVoice(u);
  const boost = boosts.get(u.uid) ?? null;
  const boosted = !!boost && boost.aura.n > 0;
  const n = u.frameCount('attack');
  const f0 = strikeStartFrame(u);
  const REL = u.markFrame('attack', 'release', 5);
  const CON = u.markFrame('attack', 'contact', REL + 1);
  const REC = u.markFrame('attack', 'recover', CON + 2);
  const pan = panAt(u.home.x);
  const charge = takeCharge(u, 'hoCharge', { volume: 0.85, pan });
  let relSounded = false;
  const rel = () => {
    if (relSounded) return;
    relSounded = true;
    charge.stop(40);
    play('hoRelease', { volume: 0.85, pan });
  };
  if (REL - 1 > f0) atFrame(u, 'attack', REL - 1, () => u.frameInfo().frame === REL - 1 && play('hoSwing', { volume: 0.8, pan }), { late: false });
  atFrame(u, 'attack', REL, rel, { late: false });
  // ---- geometry: where the giant stands so the contact frame's club head comes down on the target's front
  const home = { ...u.home };
  const m = (u.art.points ? u.art.points('attack', CON).muzzle : undefined) ?? u.art.muzzle;
  const off = { x: (u.flipX ? -1 : 1) * (m.x - u.art.anchorX), y: m.y - u.art.anchorY };
  const ground = s.direct ? s.toGround : s.target ? s.target.home : s.toGround;
  const dirv = { x: ground.x - home.x, y: ground.y - home.y };
  const dl = Math.hypot(dirv.x, dirv.y) || 1;
  const nd = { x: dirv.x / dl, y: dirv.y / dl };
  // the contact frame's club head comes down on the target's UPPER BODY (its core), from in front of it: the giant
  // stands a few px nearer the camera than the target, so the club is drawn over the body for the hit-stop
  // (critic r2: stop short — daylight between the bodies, the club head visible ON the target's core)
  const inset = s.blocked ? 8 : 7;
  // critic r3: the club comes DOWN (contact f6, ≈45°) onto the target's head / shoulder line, not into its belly
  const tc = s.target && !s.direct ? (() => {
    const c = s.target!.core();
    const h = s.target!.worldPoint('top');
    return { x: c.x, y: Math.round(lerp(c.y, h.y, 0.4)) };
  })() : null;
  const aim: XY = tc ? { x: tc.x - nd.x * inset, y: Math.min(tc.y, ground.y - 10) } : { x: ground.x - nd.x * 8, y: ground.y - 2 };
  let feet: XY = { x: aim.x - off.x, y: aim.y - off.y };
  if (s.target && !s.direct) feet.y = Math.max(feet.y, s.target.home.y + 3);
  if (s.direct) {
    // a direct attack comes on a stride or two; the rupture covers the rest
    const go = clamp(Math.hypot(feet.x - home.x, feet.y - home.y), 0, 34);
    feet = { x: home.x + nd.x * go, y: home.y + nd.y * go };
  }
  if ((feet.x - home.x) * nd.x + (feet.y - home.y) * nd.y < 0) feet = home;
  feet = rint(feet);
  const travel = Math.hypot(feet.x - home.x, feet.y - home.y);
  // ---- two heavy steps, then the swing's last lean; play to the contact frame and hold it
  const toCon = Math.max(120, u.rangeMs('attack', f0, CON));
  void u.playRange('attack', f0, CON);
  const footAt = (p: XY): XY => ({ x: p.x + (u.flipX ? -5 : 5), y: p.y });
  let stepped = 0;
  const onStep = (p: XY) => {
    stepped++;
    play('hoStep', { volume: 0.75 + stepped * 0.08, pan: panAt(p.x) });
    loam(sc, footAt(p), 6, 40, R);
    rootGrip(sc, footAt(p), R);
    if (boosted && boost) boost.aura.pulse();
    void shake(sc, 90, 1);
  };
  if (travel >= 6) {
    let s1 = false;
    let s2 = false;
    await animate(sc, toCon, (t) => {
      let p: number;
      let hop = 0;
      if (t < 0.3) {
        p = smooth(t / 0.3) * 0.42;
        hop = Math.sin((Math.PI * t) / 0.3) * 3;
      } else if (t < 0.42) p = 0.42;
      else if (t < 0.72) {
        p = 0.42 + smooth((t - 0.42) / 0.3) * 0.42;
        hop = Math.sin((Math.PI * (t - 0.42)) / 0.3) * 3;
      } else if (t < 0.8) p = 0.84;
      else p = 0.84 + smooth((t - 0.8) / 0.2) * 0.16;
      const at = { x: lerp(home.x, feet.x, p), y: lerp(home.y, feet.y, p) };
      placeFeet(u, at, Math.round(hop));
      if (!s1 && t >= 0.3) {
        s1 = true;
        onStep(at);
      }
      if (!s2 && t >= 0.72) {
        s2 = true;
        onStep(at);
      }
    });
  } else await sleep(sc, toCon);
  placeFeet(u, feet);
  rel();
  // ---- contact: the club smashes (the battle stages the hit-stop, the number, the reactions)
  const at = rint(livePoint(u, 'muzzle'));
  const floorY = s.target ? s.target.home.y : s.direct ? feet.y : s.toGround.y;
  // the floor half of the blow: on the next frame the club falls through to the ground and the floor cracks
  const floorFx = (p: XY, fy: number, big: boolean) => {
    floorCrack(sc, p, big ? 18 : 13, u.uid * 7 + stepped, 520);
    floorRing(sc, p, big ? 26 : 18, 280);
    splinters(sc, { x: p.x, y: p.y - 3 }, fy, big ? 12 : 8, R, { up: 1 });
    loam(sc, p, big ? 10 : 7, 60, R);
    void lightFlash(sc, p.x, p.y - 4, PAL.gold3, big ? 32 : 26, 300, { floorY: fy, intensity: 0.7 });
  };
  // the body half: heartwood chips and bark (never green leaves: the target may be green) burst off the crushed body
  const bodyFx = (p: XY, fy: number, big: boolean) => {
    const sp = new Sparks(sc, DEPTH.FX + 1);
    for (let i = 0; i < (big ? 26 : 12); i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.8;
      const v = 60 + R() * 100;
      // chunky bark slabs (3 px) among the 2-px chips: the club's own wood shattering on the body
      const chunk = big && i % 4 === 0;
      // spawned already OUT on a ring (critic r3: during the hit-stop a burst born on one point is one dot — the frozen
      // frame shows the first ring of splinters)
      const r0 = 4 + R() * (big ? 9 : 6);
      sp.add({ x: p.x + Math.cos(a) * r0, y: p.y + Math.sin(a) * r0, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, ay: 420, floor: fy + (R() - 0.5) * 6, bounce: 0.3, life: 420 + R() * 260, colors: i % 2 ? [PAL.earth4, PAL.earth3, PAL.earth2] : [PAL.earth2, PAL.earth1, PAL.earth0], shape: i % 3 === 0 || chunk ? 'sq' : 'px', size: chunk ? 3 : 2, fadeAt: 1, flicker: i % 5 === 0 });
    }
    sp.release();
    // the wood-flash at the club head (critic r3: the payoff lives ON the frozen contact frame): a big white-hot star
    // of heartwood light, gold4 tips, a jagged split-wood corona — drawn on the first tick, held through the hit-stop
    // (game time frozen: el stays 0), then two shrinking steps once the world moves again
    frozenStar(p, big);
    void lightFlash(sc, p.x, p.y, PAL.gold4, big ? 30 : 22, 240, { floorY: fy, air: 1, intensity: 1 });
    if (boosted && boost) {
      // the POLLEN fountain bursts up off the club's glowing sprouts
      boost.aura.flare();
      const b0 = boost.aura.bud(0) ?? livePoint(u, 'staff');
      const b1 = boost.aura.bud(1);
      frozenPollen(b0);
      if (b1) frozenPollen(b1);
      pollen(sc, { x: b0.x, y: b0.y - 1 }, 44, R, DEPTH.FX + 2, fy);
      if (b1) pollen(sc, { x: b1.x, y: b1.y - 1 }, 30, R, DEPTH.FX + 2, fy);
      play('hoPollen', { volume: 0.95, pan: panAt(b0.x) });
    }
  };
  function frozenStar(p: XY, big: boolean): void {
    const star = Raster.around(sc, p.x, p.y, 64, 56, DEPTH.FX + 1.5);
    const rays: [number, number, number][] = [];
    for (let i = 0; i < 10; i++) rays.push([(i / 10) * TAU + R() * 0.3, (big ? 9 : 6) + R() * (big ? 7 : 4), R()]);
    void animate(sc, 120, (_k, el) => {
      const st = el < 25 ? 0 : el < 70 ? 1 : 2;
      star.draw((g) => {
        const s0 = [1, 0.62, 0.32][st];
        for (const [a, L0, j] of rays) {
          const L = Math.round(L0 * s0);
          for (let q = 1; q <= L; q++) {
            const x = Math.round(p.x + Math.cos(a) * q);
            const y = Math.round(p.y + Math.sin(a) * q * 0.8);
            const c = q === L ? PAL.gold4 : st === 0 && q < L * 0.55 ? PAL.white : PAL.earth4;
            g.px(x, y, c);
            if (q < L * 0.4 && st === 0) g.px(x + 1, y, c);
          }
          // split-wood shards flung off the tips (2 px, heartwood / bark)
          if (st < 2) {
            const d = L + 2 + Math.round(j * 3);
            const x = Math.round(p.x + Math.cos(a) * d);
            const y = Math.round(p.y + Math.sin(a) * d * 0.8);
            g.rect(x, y, 2, j > 0.5 ? 2 : 1, j > 0.5 ? PAL.earth4 : PAL.earth3);
          }
        }
        const cr = st === 0 ? (big ? 3 : 2) : 1;
        g.disc(p.x, p.y, cr + 1, PAL.gold4);
        g.disc(p.x, p.y, cr, PAL.white);
      });
    }).then(() => star.destroy());
  }
  // boosted: the buds' first violet bloom, on the frozen frame (the pollen fountain flies once the world moves)
  function frozenPollen(b: XY): void {
    const r = Raster.around(sc, b.x, b.y - 8, 44, 40, DEPTH.FX + 2.2);
    const pts: [number, number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const a = -Math.PI / 2 + (R() - 0.5) * 2.2;
      const d = 3 + R() * 11;
      pts.push([Math.round(b.x + Math.cos(a) * d), Math.round(b.y + Math.sin(a) * d), i]);
    }
    void animate(sc, 110, (_k, el) => {
      const st = el < 25 ? 0 : el < 70 ? 1 : 2;
      r.draw((g) => {
        for (const [x, y, i] of pts) {
          const yy = y - st * 2;
          if (st === 2 && i % 2) continue;
          if (i % 3 === 0) g.rect(x, yy, 2, 2, st === 0 ? PAL.void4 : PAL.void3);
          else g.px(x, yy, i % 5 === 0 ? PAL.white : PAL.void4);
        }
        if (st === 0) {
          for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]] as const) g.px(b.x + dx, b.y + dy, PAL.white);
          for (const [dx, dy] of [[0, -3], [0, 3], [-3, 0], [3, 0], [0, -2], [0, 2], [-2, 0], [2, 0]] as const) g.px(b.x + dx, b.y + dy, PAL.void4);
        }
      });
    }).then(() => r.destroy());
  }
  if (s.direct) {
    // the club comes all the way down in front, then the floor ruptures to the duelist
    const fall = u.frameMs('attack', CON);
    await sleep(sc, fall);
    const gp = rint(livePoint(u, 'muzzle'));
    const gAt = { x: gp.x, y: Math.min(feet.y + 2, gp.y + 2) };
    play('hoImpact', { volume: 0.7, pan: panAt(gAt.x) });
    floorFx(gAt, feet.y, false);
    bodyFx({ x: gAt.x, y: gAt.y - 6 }, feet.y, false);
    const ms = clamp(Math.round(Math.hypot(s.toGround.x - gAt.x, s.toGround.y - gAt.y) * 1.1), 110, 220);
    // the crack is HEARD running to the duelist (sustained), and the roots burst up under them on arrival
    const run = start('hoRupture', { volume: 0.85, pan: panAt(gAt.x) });
    await rupture(sc, gAt, s.toGround, ms, R);
    run.stop(50);
    play('hoRootBurst', { volume: 0.9, pan: panAt(s.toGround.x) });
    s.impact(s.to);
    loam(sc, s.toGround, 10, 70, R);
    splinters(sc, s.toGround, s.toGround.y, 10, R, { up: 1.2 });
    void lightFlash(sc, s.to.x, s.to.y, PAL.gold3, 30, 320, { floorY: s.toGround.y, intensity: 0.8 });
  } else {
    // contact ON the contact frame (club head at the target's core): the number, the hit-stop, the burst — and the
    // frame is HELD through the hit-stop (critic r2: the fall-through frame used to replace it on the same tick)
    s.impact(at);
    play('hoImpact', { volume: s.blocked ? 0.7 : 0.95, pan: panAt(at.x) });
    bodyFx(at, floorY, !s.blocked);
    if (loses) return;
    await sleep(sc, u.frameMs('attack', CON));
  }
  if (loses) return;
  // ---- the bounce, the club thrown onto the shoulder (f9), then the giant steps home on the recovery
  atFrame(u, 'attack', CON + 3, () => play('hoShoulder', { volume: 0.75, pan: panAt(u.sprite.x) }), { late: false });
  const rest = u.playRange('attack', CON + 1, undefined, { hold: false });
  if (!s.direct) {
    // the fall-through: the club goes on down to the floor after the hit-stop, the floor cracks
    const gp = rint(livePoint(u, 'muzzle'));
    floorFx({ x: gp.x, y: Math.min(feet.y + 2, gp.y + 2) }, feet.y, !s.blocked);
    if (!s.blocked) leaves(sc, { x: gp.x, y: gp.y - 14 }, feet.y, 3, R, DEPTH.FX + 1);
  }
  await sleep(sc, u.rangeMs('attack', CON + 1, REC + 1));
  const back = Math.max(120, u.rangeMs('attack', REC + 1, n) - 30);
  if (feet.x !== home.x || feet.y !== home.y) {
    let landed = false;
    await animate(sc, back, (t) => {
      const e = smooth(t);
      const hop = Math.sin(Math.PI * t) * 2;
      const p = { x: lerp(feet.x, home.x, e), y: lerp(feet.y, home.y, e) };
      placeFeet(u, p, Math.round(hop));
      if (!landed && t >= 0.98) {
        landed = true;
        play('hoStep', { volume: 0.55, pan: panAt(p.x) });
      }
    });
  }
  placeFeet(u, home);
  await rest;
  const r0 = u.rest0;
  if (u.sprite.active) u.sprite.setPosition(r0.x, r0.y).setDepth(unitDepth(home.y));
}

if (LOOK_V3) registerStrike(ID, (s) => smashV3(s), { priority: 20, name: 'kart-b:hollow_ogre:strike' });

// ================================================================ guard: its own beat on a blocked blow

if (LOOK_V3)
  registerObserver((ev, ctx) => {
    if (ev.type !== 'battle' || ev.targetUid === null || ev.targetUid === undefined) return;
    if (ctx.cardId(ev.targetUid) !== ID) return;
    if (ev.result === 'targetDestroyed' || ev.result === 'bothDestroyed') return;
    const u = live(ctx.unit(ev.targetUid));
    const tu = ev.targetUid;
    const pos = ctx.state.players.flatMap((p) => p.monsters).find((m) => m && m.uid === tu)?.position;
    if (!u || (pos !== 'defense' && !showsGuard(u))) return;
    const sc = ctx.scene;
    const attacker = ev.attackerUid;
    let off: (() => void) | null = null;
    const onContact = (uid: Uid) => {
      if (uid !== attacker) return;
      off?.();
      // the knock is heard ON the contact (the card's identity at the block); the chips fly a beat later, out to the
      // side away from the shared shield
      const v = live(u);
      play('hoBlock', { volume: 0.9, pan: panAt(v ? v.sprite.x : 320) });
      void sleep(sc, 60).then(() => guardBeat());
    };
    const guardBeat = () => {
      const v = live(u);
      if (!v) return;
      const R = rng(v.uid * 61 + 7);
      // the club recoils a px into the body and back
      const s0 = v.sprite;
      const bx = s0.x;
      const dir = v.flipX ? 1 : -1;
      void animate(sc, 140, (_k, el) => {
        if (s0.active) s0.x = bx + (el < 70 ? dir : 0);
      }).then(() => {
        if (s0.active) s0.x = bx;
      });
      const g = livePoint(v, 'grip');
      const h = livePoint(v, 'staff');
      const feet = rint(v.worldPoint('feet'));
      // away from the attacker (the shared hex shield sits on the struck face): the chips spray off the club's far end
      const av = live(ctx.unit(attacker));
      const away = av ? Math.sign(v.sprite.x - av.sprite.x) || (v.flipX ? -1 : 1) : v.flipX ? -1 : 1;
      // from the TOP of the barred club, above the shield, flung up and away (brown chips on the brown trunk vanished)
      const club = rint({ x: (g.x + h.x) / 2 + away * 4, y: Math.min(g.y, h.y) - 8 });
      guardChips(sc, club, feet, -away, R);
      rootGrip(sc, { x: feet.x - 7, y: feet.y }, R);
      rootGrip(sc, { x: feet.x + 7, y: feet.y }, R);
      const eye = livePoint(v, 'head');
      void lightFlash(sc, eye.x, eye.y, PAL.gold4, 18, 220, { floorY: feet.y, air: 1, intensity: 1 });
    };
    sc.events.on('v3:contact', onContact);
    const timer = sc.time.delayedCall(6000, () => off?.());
    off = () => {
      sc.events.off('v3:contact', onContact);
      timer.remove(false);
      off = null;
    };
  });

// ================================================================ death: the roots into the tile, one sprout wilts

/**
 * The death's last beat, drawn (ink-edged, flat bands): a 6-px sprout with a violet bud on a turned-soil mound and a
 * gold3 light pool; it stands (the bud breathes), the stem bends, the bud droops and greys, a leaf falls (onWilt), the
 * pool steps down, and it sinks into the soil in two steps (onSink: the card is born). ≈ 620 ms.
 */
function sproutEnd(sc: Phaser.Scene, at: XY, dir: 1 | -1, onWilt: () => void, onSink: () => void): Promise<void> {
  const r = Raster.around(sc, at.x, at.y - 6, 30, 24, unitDepth(at.y) + 0.1);
  const pool = lightPool(sc, at.x, at.y - 4, { color: PAL.gold3, spill: PAL.gold2, radius: 14, floorY: at.y, intensity: 0.9, anim: 'flicker', fadeIn: 0 });
  // [ms, step]: 0 upright · 1 upright (bud glint) · 2 bends · 3 droops · 4 leaf gone · 5/6 sinking
  const T = [90, 90, 100, 110, 110, 60, 60];
  const draw = (st: number) =>
    r.draw((g) => {
      const x = at.x;
      const y = at.y;
      const sink = st >= 5 ? (st - 4) * 2 : 0;
      // the mound of turned soil (lit top row)
      g.rect(x - 4, y, 9, 1, PAL.earth1);
      g.rect(x - 3, y - 1, 7, 1, PAL.earth2);
      g.px(x - 2, y - 1, PAL.earth3);
      if (st >= 6) return;
      const wilt = st <= 1 ? 0 : st - 1; // 0 … 3
      const green = wilt < 2;
      const stemL = green ? PAL.leaf2 : PAL.earth2;
      const stemD = green ? PAL.leaf1 : PAL.earth1;
      const H = 6 - sink;
      // stem, 2 px wide (lit / shade), its top bending over by wilt
      const bendAt = (i: number) => Math.round(dir * (wilt >= 1 ? (i / H) ** 2 * [0, 1, 2, 3][wilt] : 0));
      let top = { x, y: y - 1 };
      for (let i = 0; i < H; i++) {
        const xx = x + bendAt(i);
        const yy = y - 2 - i + (wilt >= 3 && i > H - 3 ? i - (H - 3) : 0);
        g.px(xx - 1, yy, PAL.ink);
        g.px(xx + 2, yy, PAL.ink);
        g.px(xx, yy, stemL);
        g.px(xx + 1, yy, stemD);
        top = { x: xx, y: yy };
      }
      // two leaves off the lower stem (the far one gone once it fell)
      const ly = y - 4;
      const droop = wilt >= 2 ? 1 : 0;
      g.rect(x - 3, ly + droop, 3, 2, PAL.ink);
      g.rect(x - 3, ly + droop, 2, 1, green ? PAL.leaf2 : PAL.earth2);
      g.px(x - 1, ly + droop + 1, green ? PAL.leaf1 : PAL.earth1);
      if (st < 4) {
        g.rect(x + 2, ly - 1 + droop, 3, 2, PAL.ink);
        g.rect(x + 3, ly - 1 + droop, 2, 1, green ? PAL.leaf1 : PAL.earth1);
      }
      // the bud: 3×3 ink-edged, a violet heart (a gold4 glint while it stands), drooping to the side and greying
      const bx = top.x + (wilt >= 2 ? dir : 0);
      const by = top.y - 2 + (wilt >= 2 ? wilt : 0);
      g.rect(bx - 1, by - 1, 4, 4, PAL.ink);
      const live = wilt < 2;
      g.rect(bx, by, 2, 2, live ? PAL.void3 : PAL.void1);
      g.px(bx, by, live ? (st === 1 ? PAL.white : PAL.void4) : PAL.void2);
      if (st === 1) g.px(bx + 1, by - 2, PAL.gold4);
    });
  return new Promise<void>((resolve) => {
    let st = -1;
    let acc = 0;
    let i = 0;
    onFrame(sc, (_dt, el) => {
      while (i < T.length && el >= acc + T[i]) {
        acc += T[i];
        i++;
      }
      if (i !== st) {
        st = i;
        if (st === 3) {
          onWilt();
          lastLeaf(sc, { x: at.x + 4 * dir, y: at.y - 5 }, at.y, dir);
          pool.setIntensity(0.5, 0);
        }
        if (st === 4) pool.setIntensity(0.25, 0);
        if (st === 5) {
          pool.fadeOut(120);
          onSink();
        }
        if (st < T.length) draw(st);
      }
      return i < T.length;
    }, () => {
      r.destroy();
      pool.destroy();
      resolve();
    });
  });
}

async function rootsDeathV3(ctx: Ctx<'destroy'>): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const u = field.unit(ev.uid);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible || !u.has('death')) return ctx.base();
  const R = rng(ev.uid * 29 + 11);
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
  const boost = boosts.get(u.uid) ?? null;
  const knots = boost ? boost.aura.n : 0;
  if (boost) boost.aura.hidden = true;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  let leave: Promise<void> | null = null;
  const burst = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[ogre death] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, u) }).catch((e) => console.error('[ogre death] card', e));
    else if (tile && tile.active) leave = tile.dissolve(420).then(() => void (tile.active && tile.destroy())).catch(() => undefined);
    else leave = Promise.resolve();
  };
  ctx.scene.events.emit('v3:dying', u);
  // critic r3 (blocker): every floor beat of the death happens where the BODY stands — after its own losing strike the
  // sprite is in front of the enemy, two tiles from its card tile (only the card leaves from the home tile)
  const foot = (): XY => (u.sprite.active ? rint({ x: u.sprite.x, y: u.sprite.y + u.hover }) : home);
  const pan = panAt(foot().x);
  let roots: ReturnType<typeof rootsIntoTile> | null = null;
  let retract: ReturnType<typeof start> | null = null;
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
    const dissolveF = u.markFrame('death', 'dissolve', 4);
    // f1: the root arms unravel (the club drops); the planted seeds leave the hollow as two violet motes. The shared
    // posematch may already have started the death on the contact (critic r2: with late:false this beat was dropped
    // in every battle death) — it fires as soon as the death shows f1 or later, once
    atFrame(u, 'death', 1, () => {
      play('hoUnravel', { volume: 0.85, pan });
      if (knots > 0) {
        // the planted knot lights leave the hollow as small SEEDS: they rise, dim, and fall back into the tile beside
        // the spot where the lone sprout will stand
        const c = rint(livePoint(u, 'core'));
        const ft = foot();
        const sx = ft.x + (u.flipX ? -1 : 1);
        const r = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 1);
        void animate(sc, 760, (k) => {
          r.draw((g) => {
            for (let i = 0; i < knots; i++) {
              const tx = sx + (i ? 5 : -5);
              const up = k < 0.35 ? k / 0.35 : 1;
              const dn = k < 0.35 ? 0 : (k - 0.35) / 0.65;
              const x = Math.round(lerp(c.x + (i ? 2 : -2), tx, dn));
              const y = Math.round(c.y - 10 * up * (1 - dn) + dn * dn * (ft.y - 1 - c.y));
              // a short falling trail behind it, then the seed itself (big while it rises, smaller as it dims)
              if (dn > 0.05) for (let q = 1; q <= 3; q++) g.px(x, y - q * 2, q === 1 ? PAL.void3 : PAL.void2);
              drawSeed(g, { x, y }, k < 0.45 ? 3 : k < 0.8 ? 2 : 1);
              if (k > 0.75) g.px(x, y, k > 0.9 ? PAL.void2 : PAL.void3);
            }
          });
        }).then(() => r.destroy());
      }
    });
    // f2 …: root strands slither out along the floor and dig into the tile
    atFrame(u, 'death', 2, () => {
      roots = rootsIntoTile(sc, foot(), 9, R, DEPTH.SHADOW + 0.6);
      const span = Math.max(240, u.rangeMs('death', Math.max(2, u.frameInfo().frame), n - 2));
      void animate(sc, span, (k) => roots?.set(k)).then(() => {
        roots?.destroy();
        roots = null;
      });
    });
    // dissolve: the roots are pulled into the tile (sustained, ends with the sprout)
    atFrame(u, 'death', dissolveF, () => {
      retract = start('hoRootsRetract', { volume: 0.85, pan });
      loam(sc, foot(), 8, 40, R);
    });
    // dissolve + 1: the trunk caves in (dust drawn inward)
    atFrame(u, 'death', Math.min(n - 1, dissolveF + 1), () => {
      play('hoCollapse', { volume: 0.85, pan });
      const ft = foot();
      caveIn(sc, { x: ft.x, y: ft.y - 8 }, R);
      void shake(sc, 120, 1);
    });
    // the lone sprout (critic r3: a 3-px sprout and a colour-change wilt read as dead air): the sprite's sprout frame
    // hands over to a drawn sprout — 6 px, a violet bud, a gold3 pool under it — that WILTS over three steps (the stem
    // bends, the bud droops, a leaf falls), then sinks into the soil; the card is born as it sinks
    const sproutF = Math.max(0, n - 2);
    let ending: Promise<void> | null = null;
    atFrame(u, 'death', sproutF, () => {
      if (!u.sprite.active) return;
      u.sprite.anims.pause();
      const ft = foot();
      const dir: 1 | -1 = u.flipX ? -1 : 1;
      ending = sproutEnd(sc, { x: ft.x + dir, y: ft.y }, dir, () => {
        retract?.stop(120);
        play('hoWilt', { volume: 0.8, pan });
      }, burst);
      u.sprite.setVisible(false);
    }, { late: false });
    await until(sc, () => !u.sprite.active || ending !== null || (inDeath() && u.frameInfo().frame >= n - 1), u.animMs('death') + 400);
    // (the ending may have started this frame)
    if (boost) u.setAura('ogreBoost', null);
    const end = ending as Promise<void> | null;
    if (end) await end;
    else {
      burst();
      if (u.sprite.active) await knockOut(sc, u, 150, 4);
    }
  } catch (e) {
    console.error('[ogre death] failed', e);
  } finally {
    burst();
    (retract as ReturnType<typeof start> | null)?.stop(60);
    (roots as ReturnType<typeof rootsIntoTile> | null)?.destroy();
    if (boost) u.setAura('ogreBoost', null);
    u.posed = false;
    if (!u.retired) u.retire(0);
    field.forget(ev.uid);
    ctx.scene.events.emit('v3:dead', u);
  }
  await leave;
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'destroyed',
    (ctx) => {
      if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
      return rootsDeathV3(ctx);
    },
    { priority: 20, name: 'kart-b:hollow_ogre:death' },
  );
