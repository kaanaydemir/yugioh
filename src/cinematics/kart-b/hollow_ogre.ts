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
//   activate   the giant holds the club out toward its graveyard, a tendril root rises from the shoulder with its tip
//              forked open (special f0–3, held); the graveyard pile answers (a violet ring breathing over it, motes)
//              (hoReach). With ≥ 2 monsters the chooseCount prompt waits here; the pose and the pile keep living.
//   banish ×k  (this file's 'banish' handler, priority 1 over the placeholder b2:banish): per seed — the REAL graveyard
//              card's monster rises over the pile as a half-size violet silhouette of its own pixels (hoShrink), every
//              pixel is pulled into one point: a light seed; the seed arcs through the air onto the root tip (hoSeed),
//              the fork snaps shut (special f4, hoCatch), the tendril curls down into the hollow (f5), the seed burns
//              there as a KNOT LIGHT (f6: hoKnot, a violet flare, +400 on the badge) and a new sprout springs on the
//              club (f7: hoSprout). A second seed is already shrinking while the first flies (pipelined), the giant
//              returns to the receiving pose (special f3) for it. At the end the hollow glows with its knot lights
//              (special f8, hoGlow).
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
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { Raster } from '../../vfx/setpieces';
import { shake } from '../../vfx/core';
import { registerCardHook, registerEvent, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { atFrame, fade as fadeSnd, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { strikeStartFrame } from '../_v3/clash';
import { behindBodies, cardLeaves } from '../_v3/card';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { contactFlash } from '../_v3/flash';
import { impactNumber } from '../_v3/number';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import {
  TAU,
  boostAura,
  caveIn,
  fallShadow,
  fallStreaks,
  floorCrack,
  floorRing,
  knockOut,
  knotFlare,
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
  light: LightHandle;
}
const boosts = new Map<Uid, BoostState>();

function boostOf(u: MonsterUnit): BoostState {
  let b = boosts.get(u.uid);
  if (!b) {
    const aura = boostAura(u.scene, u, 0);
    const light = lightPool(u.scene, u.home.x, u.home.y, { color: PAL.void3, spill: PAL.void2, radius: 12, floorY: u.home.y, air: 0.7, intensity: 0, anim: 'breathe', fadeIn: 80 });
    light.follow(() => (live(u) && u.sprite.visible && !aura.hidden ? livePoint(u, 'core') : null), { floorY: () => u.worldPoint('feet').y });
    const state: BoostState = { aura, light };
    boosts.set(u.uid, state);
    u.setAura('ogreBoost', {
      destroy: () => {
        aura.destroy();
        void light.fadeOut(160);
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
        void b?.light.fadeOut(120);
      }
      boosts.delete(uid);
    }
  });

// ================================================================ summon: the log falls, stakes, opens, SLAM

/** Ms (scene) of the log's fall from above the screen to the tile. */
const FALL_MS = 300;

async function logFallV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const { home, unit: u } = S;
  const s = u.sprite;
  const R = rng(S.ev.uid * 13 + 5);
  const pan = panAt(home.x);
  fadeSnd(['summonCharge'], 160);
  if (!u.has('summon')) return;
  // ---- the shadow grows on the tile, the sealed log drops from above the screen
  const rest = u.rest0;
  const y0 = -12;
  u.pose('summon', 0);
  u.showSprite();
  s.setPosition(rest.x, y0);
  const fall = start('hoLogFall', { volume: 0.9, pan });
  const shadow = S.own(fallShadow(sc, home, 16, DEPTH.SHADOW + 0.5));
  const art = u.art;
  const topOf = (): XY => ({ x: s.x + (u.flipX ? -1 : 1) * 0, y: s.y - art.anchorY + 26 });
  const streaks = fallStreaks(sc, () => ({ x: s.x, y: topOf().y }), 24, s.depth - 0.2);
  S.own({ destroy: () => streaks.stop() });
  await animate(sc, FALL_MS, (k) => {
    const e = k * k;
    s.setPosition(rest.x, Math.round(lerp(y0, rest.y, e)));
    shadow.set(Math.min(1, k * 1.15));
  });
  s.setPosition(rest.x, rest.y);
  streaks.stop();
  shadow.destroy();
  // ---- STAKE (summon f1 = land): the pose plays on from the landing frame
  fall.stop(30);
  play('hoStake', { volume: 1, pan });
  const done = u.playRange('summon', 1, undefined, { hold: false });
  void shake(sc, 220, 3);
  floorCrack(sc, { x: home.x, y: home.y + 1 }, 22, S.ev.uid * 3 + 1, 620);
  floorRing(sc, home, 30, 320);
  loam(sc, home, 14, 70, R);
  splinters(sc, { x: home.x, y: home.y - 4 }, home.y, 12, R, { up: 0.9 });
  void lightFlash(sc, home.x, home.y - 6, PAL.earth3, 44, 300, { floorY: home.y, ring: true, intensity: 0.7 });
  // f2: the door seam glows from inside (ember light from the hollow)
  const ember = S.glow({ color: PAL.gold3, spill: PAL.gold2, radius: 14, intensity: 0, anim: 'flicker', fadeIn: 0, at: rint(pointOf(u, 'summon', 2, 'core')) });
  atFrame(u, 'summon', 2, () => ember.setIntensity(0.8, 60), { late: false });
  // f3: the bark splits open like a door — chips fly to both sides, the eyes ignite in the dark
  atFrame(u, 'summon', 3, () => {
    play('hoBarkSplit', { volume: 0.9, pan });
    const c = rint(pointOf(u, 'summon', 3, 'core'));
    splinters(sc, c, home.y, 8, R, { dir: -1, up: 0.6 });
    splinters(sc, c, home.y, 8, R, { dir: 1, up: 0.6 });
    void lightFlash(sc, c.x, c.y, PAL.gold3, 26, 260, { floorY: home.y, air: 0.9, intensity: 0.9 });
    ember.setIntensity(1.1, 40);
  }, { late: false });
  atFrame(u, 'summon', 5, () => {
    ember.fadeOut(260);
    leaves(sc, rint(pointOf(u, 'summon', 5, 'head')), home.y, 4, R, s.depth + 0.3);
  }, { late: false });
  // f7: the near root foot comes down out of the hole
  atFrame(u, 'summon', 7, () => {
    play('hoStep', { volume: 0.8, pan });
    loam(sc, { x: home.x + (u.flipX ? -6 : 6), y: home.y }, 6, 40, R);
  }, { late: false });
  // f9: SLAM — the club pounds the ground in front, the door plates are shaken loose, the badge pops
  atFrame(u, 'summon', 9, () => {
    play('hoClubSlam', { volume: 1, pan });
    const at = rint(pointOf(u, 'summon', 9, 'muzzle'));
    const g = { x: at.x, y: Math.min(home.y + 4, at.y + 1) };
    floorCrack(sc, g, 16, S.ev.uid * 5 + 2, 520);
    splinters(sc, g, home.y + 2, 10, R, { up: 1 });
    leaves(sc, rint(pointOf(u, 'summon', 9, 'head')), home.y, 7, R, s.depth + 0.3);
    void lightFlash(sc, g.x, g.y, PAL.earth4, 34, 320, { floorY: home.y, ring: true, intensity: 0.8 });
    S.finale({ ring: 48, ramp: EARTH, shake: 2, sfx: null });
  }, { late: false });
  await done;
}

if (LOOK_V3)
  registerCardHook(
    ID,
    'summon',
    async (ctx) => {
      if (ctx.ev.from === 'field') return ctx.base();
      await runSummon(ctx, async () => undefined, logFallV3);
    },
    { priority: 20, name: 'kart-b:hollow_ogre:summon' },
  );

// ================================================================ effect: "Kovuğa ekim" (activate → banish × k → statChange)

/** The reach pose kept from the activation (batch 1) for the banish handler (batch 1 or 2). */
interface Reach {
  uid: Uid;
  stir: { destroy(): void };
  /** True once the banish handler owns the pose. */
  taken: boolean;
  destroy(): void;
}

/** The special's receiving frame (club held out, tendril up with its tip forked open). */
const RECEIVE_F = 3;

async function reachV3(ctx: Ctx<'activate'>, u: MonsterUnit): Promise<Reach> {
  const sc = ctx.scene;
  const ev = ctx.ev;
  const R = rng(ev.uid * 17 + 3);
  u.posed = true;
  const pile = ctx.views.field.pile(ev.player, 'graveyard');
  const pAt = rint(pile.topXY());
  play('hoReach', { volume: 0.85, pan: panAt(u.home.x) });
  const stir = pileStir(sc, { x: pAt.x, y: pAt.y - 1 }, DEPTH.FX - 2, R);
  const pool = lightPool(sc, pAt.x, pAt.y, { color: PAL.void3, spill: PAL.void2, radius: 18, floorY: pAt.y, intensity: 0.7, anim: 'breathe', fadeIn: 120 });
  await u.playRange('special', 0, RECEIVE_F);
  u.pose('special', RECEIVE_F);
  const r: Reach = {
    uid: u.uid,
    stir,
    taken: false,
    destroy() {
      stir.destroy();
      void pool.fadeOut(200);
      if (!r.taken && live(u)) {
        u.posed = false;
        u.rest();
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
      const reach = await reachV3(ctx, u);
      // the banish handler takes it (in this batch, or in the next one after the chooseCount prompt)
      ctx.keep('ogre:reach', reach);
    },
    { priority: 20, name: 'kart-b:hollow_ogre:effect' },
  );

/** Planting timeline (scene ms): a seed rises + shrinks, flies, is caught; the next one starts SEED_GAP later. */
const RISE_MS = 110;
const SHRINK_MS = 240;
const FLIGHT_MS = 320;

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
  u.posed = true;
  const R: Rng = rng(src * 23 + group.length);
  const owner = ev.owner;
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const pileFloor = rint(pile.topXY());
  const pan = panAt(u.home.x);
  const pPan = panAt(pileFloor.x);
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
  const tip = (): XY => rint(pointOf(u, 'special', 4, 'hand'));
  const depth = DEPTH.FX + 2;
  // the receiving pose: alive between seeds (the tendril tip trembles: f2/f3 on uneven beats)
  let receiving = true;
  void (async () => {
    let k = 0;
    while (receiving && live(u)) {
      await sleep(sc, k % 3 === 2 ? 90 : 150);
      if (!receiving || u.frameInfo().anim !== 'special' || u.sprite.anims.isPlaying) {
        k++;
        continue;
      }
      u.pose('special', k % 3 === 2 ? RECEIVE_F - 1 : RECEIVE_F);
      k++;
    }
  })();
  // one seed: rise + shrink at the pile, fly onto the root tip
  const seedRun = async (i: number): Promise<void> => {
    const b = group[i];
    grave.splice(grave.indexOf(b.uid), 1);
    setPile();
    play('hoShrink', { volume: 0.8, pan: pPan });
    void lightFlash(sc, pileFloor.x, pileFloor.y - 8, PAL.void3, 22, 260, { floorY: pileFloor.y, air: 0.8, intensity: 0.8 });
    await shrinkToSeed(sc, b.cardId as MonsterId, pileFloor, owner === 1, seedAt(), depth, { riseMs: RISE_MS, shrinkMs: SHRINK_MS });
    play('hoSeed', { volume: 0.75, pan: pPan });
    await seedFlight(sc, seedAt(), tip, FLIGHT_MS, 46 + i * 8, depth + 0.5, R);
  };
  // the catch → plant → knot → sprout beats of seed i (special f4 … f7 on the giant)
  const plant = async (i: number): Promise<void> => {
    receiving = false;
    const posed = u.playRange('special', 4, 7);
    play('hoCatch', { volume: 0.8, pan });
    await sleep(sc, u.rangeMs('special', 4, 6));
    // f6: the seed burns in the hollow as a knot light, +400
    const c = rint(livePoint(u, 'core'));
    play('hoKnot', { volume: 0.9, pan, pitch: i === 0 ? 1 : 1.19 });
    knotFlare(sc, c, u.sprite.depth + 0.5, R);
    void lightFlash(sc, c.x, c.y, PAL.void3, 30, 320, { floorY: u.home.y, air: 0.9, intensity: 1 });
    boost.aura.n = i + 1;
    boost.light.setIntensity(0.45 + 0.25 * i, 120);
    const top = u.worldPoint('top');
    void impactNumber(sc, top.x + (u.flipX ? 10 : -10) * i, top.y - 6, 400, { kind: 'heal' });
    void u.setStats(atk0 + 400 * (i + 1), def, true);
    await sleep(sc, u.frameMs('special', 6));
    // f7: a sprout springs on the club
    play('hoSprout', { volume: 0.8, pan, pitch: 1 + i * 0.12 });
    await posed;
  };
  try {
    const k = group.length;
    // seed 2 starts shrinking while seed 1 flies, and arrives as the giant is ready for it again
    const catchMs = u.rangeMs('special', 4, 7) + u.frameMs('special', 7);
    const runs: Promise<void>[] = [];
    for (let i = 0; i < k; i++) {
      runs.push(
        (async () => {
          await sleep(sc, i * catchMs);
          await seedRun(i);
        })(),
      );
    }
    for (let i = 0; i < k; i++) {
      await runs[i];
      await plant(i);
      if (i < k - 1) {
        u.pose('special', RECEIVE_F);
        receiving = true;
      }
    }
    receiving = false;
    // the end: the hollow glows with its knot lights (f8 hold), then the club comes back down (not awaited)
    reach.destroy();
    play('hoGlow', { volume: 0.8, pan });
    const c = rint(livePoint(u, 'core'));
    void lightFlash(sc, c.x, c.y, PAL.void4, 22, 300, { floorY: u.home.y, air: 1, intensity: 0.8 });
    if (sEv) void u.setStats(sEv.atk, sEv.def, true);
    const rest = u.playRange('special', 8, undefined, { hold: false });
    await sleep(sc, u.frameMs('special', 8));
    void rest.then(() => {
      if (live(u)) u.posed = false;
    });
  } catch (e) {
    console.error('[hollow_ogre plant] failed', e);
    receiving = false;
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
  const inset = s.blocked ? 12 : 8;
  const aim: XY = { x: ground.x - nd.x * inset, y: ground.y - 2 };
  let feet: XY = { x: aim.x - off.x, y: aim.y - off.y };
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
  const floorY = s.target ? s.target.home.y : s.direct ? u.home.y : s.toGround.y;
  const gAt = { x: at.x, y: Math.min(floorY + 2, at.y + 2) };
  const smashFx = (p: XY, fy: number, big: boolean) => {
    floorCrack(sc, p, big ? 18 : 13, u.uid * 7 + stepped, 520);
    floorRing(sc, p, big ? 26 : 18, 280);
    splinters(sc, { x: p.x, y: p.y - 3 }, fy, big ? 14 : 9, R, { up: 1 });
    leaves(sc, { x: p.x, y: p.y - 12 }, fy, big ? 6 : 4, R, DEPTH.FX + 1);
    loam(sc, p, big ? 10 : 7, 60, R);
    void lightFlash(sc, p.x, p.y - 4, PAL.earth4, big ? 36 : 28, 300, { floorY: fy, ring: true, intensity: 0.8 });
    if (boosted && boost) {
      boost.aura.flare();
      const sp = rint(livePoint(u, 'staff'));
      pollen(sc, { x: sp.x, y: sp.y - 4 }, 26, R, DEPTH.FX + 2);
      play('hoPollen', { volume: 0.8, pan: panAt(sp.x) });
      void lightFlash(sc, sp.x, sp.y, PAL.void3, 34, 380, { floorY: fy, air: 0.9, intensity: 0.9 });
    }
  };
  if (s.direct) {
    play('hoImpact', { volume: 0.7, pan: panAt(gAt.x) });
    smashFx(gAt, u.home.y, false);
    const ms = clamp(Math.round(Math.hypot(s.toGround.x - gAt.x, s.toGround.y - gAt.y) * 1.1), 110, 220);
    await rupture(sc, gAt, s.toGround, ms, R);
    s.impact(s.to);
    loam(sc, s.toGround, 10, 70, R);
    splinters(sc, s.toGround, s.toGround.y, 10, R, { up: 1.2 });
    void lightFlash(sc, s.to.x, s.to.y, PAL.earth4, 30, 320, { floorY: s.toGround.y, intensity: 0.9 });
  } else {
    s.impact(at);
    play('hoImpact', { volume: s.blocked ? 0.7 : 0.95, pan: panAt(at.x) });
    smashFx(gAt, floorY, !s.blocked);
  }
  if (loses) return;
  // ---- the bounce, the club thrown onto the shoulder (f9), then the giant steps home on the recovery
  atFrame(u, 'attack', CON + 3, () => play('hoShoulder', { volume: 0.75, pan: panAt(u.sprite.x) }), { late: false });
  const rest = u.playRange('attack', CON + 1, undefined, { hold: false });
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

// ================================================================ death: the roots into the tile, one sprout wilts

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
  const pan = panAt(home.x);
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
    // f1: the root arms unravel (the club drops); the planted seeds leave the hollow as two violet motes
    atFrame(u, 'death', 1, () => {
      play('hoUnravel', { volume: 0.85, pan });
      if (knots > 0) {
        const c = rint(pointOf(u, 'death', 1, 'core'));
        const sp = new Sparks(sc, DEPTH.FX + 1);
        for (let i = 0; i < knots; i++) sp.add({ x: c.x + i * 2 - 1, y: c.y, vx: (i ? 10 : -10), vy: -40, drag: 1.2, life: 520, colors: [PAL.void4, PAL.void3, PAL.void2, PAL.void1], shape: 'plus', fadeAt: 1, flicker: true });
        sp.release();
        void lightFlash(sc, c.x, c.y, PAL.void3, 20, 260, { floorY: home.y, air: 0.9, intensity: 0.7 });
      }
    }, { late: false });
    // f2 …: root strands slither out along the floor and dig into the tile
    atFrame(u, 'death', 2, () => {
      roots = rootsIntoTile(sc, { x: home.x, y: home.y }, 7, R, DEPTH.SHADOW + 0.6);
      const span = Math.max(200, u.rangeMs('death', 2, n));
      void animate(sc, span, (k) => roots?.set(k)).then(() => {
        roots?.destroy();
        roots = null;
      });
    }, { late: false });
    // dissolve: the roots are pulled into the tile (sustained, ends with the sprout)
    atFrame(u, 'death', dissolveF, () => {
      retract = start('hoRootsRetract', { volume: 0.85, pan });
      loam(sc, home, 8, 40, R);
    }, { late: false });
    // dissolve + 1: the trunk caves in (dust drawn inward)
    atFrame(u, 'death', Math.min(n - 1, dissolveF + 1), () => {
      play('hoCollapse', { volume: 0.85, pan });
      caveIn(sc, { x: home.x, y: home.y - 8 }, R);
      void shake(sc, 120, 1);
    }, { late: false });
    // the last frame: the lone sprout wilts, one leaf drops
    atFrame(u, 'death', n - 1, () => {
      retract?.stop(120);
      play('hoWilt', { volume: 0.8, pan });
      lastLeaf(sc, { x: home.x + (u.flipX ? -1 : 1), y: home.y - 5 }, home.y, u.flipX ? -1 : 1);
    }, { late: false });
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= n - 1), u.animMs('death') + 300);
    if (u.sprite.active) await sleep(sc, u.frameMs('death', n - 1) + 60);
    if (boost) u.setAura('ogreBoost', null);
    // the last 150 ms: the wilted sprout goes out in four bayer steps (the card is born on that frame)
    burst();
    if (u.sprite.active) await knockOut(sc, u, 150, 4);
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
