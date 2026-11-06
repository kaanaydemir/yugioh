// Kutup Bobini (polar_coil, lane D, C14) — its own v3 summon, strike and death (?look=v3 only; v1 falls through
// to the chain below every hook, byte-identical). Pieces: ./_polar_coil-fx.ts; sounds: src/audio/v3/polar_coil.ts.
//
// Summon (≈ 2.0 s at tempo): the empty spindle stands on its pin — "tok" (polarCoilPin), a dashed spool track
// prints on the floor under it; f1–f6 the copper wire flies in from the top-left and winds bottom → top
// (the art), the track turns faster and warms stone → copper → gold, copper glints fly off the climbing winding
// point and the two-colour core light (N orange behind, S blue in front) rises on the marble in steps
// (polarCoilWind: the buzz climbs D3 → D4, the turn ticks accelerate; held to 'land'); f7 two bare strands drop
// from the bottom winding and lift the drum; f10 'land' — the coil
// snaps taut, legs and whips open: copper twang + whip crack (polarCoilSnap), sparks off the two lugs, the track
// flashes gold and closes in, the finale ring, hit-stop 40 ms, shake 2; f12 the shoulder spools spin up and run
// down (polarCoilSpools).
// Strike "Tel Yörüngesi" (ranged; the coil never leaves its tile): the art's charge — iron dust gathers into
// three spikes orbiting the coil, the whips circle overhead (polarCoilCharge: a circling, rising whirr, from the
// declaration); f5 'release' the whips crack forward and fling the spikes (polarCoilFling); f6 they leave the
// front star as a fan, each on its own arc, swing into an orbit round the target — the back half behind its body,
// shadows and a dashed track on the floor, the floor light warming each lap — circle it faster
// (polarCoilOrbit, a three-voice whirr panning round), then plunge in together: the contact (hit-stop of the
// mediumHeavy class, the struck body's material) with a three-rayed star in the spikes' colours (N / S / gold)
// shooting back out where they came from, one ring, iron dust (polarCoilTicks: "tşak-tşak-tşak" leads in over the
// last lap, polarCoilTshak lands the crack + thump ON the convergence; no generic body blow under it). Blocked: the
// spikes stop on the guard and splinter into tumbling grains (polarCoilDeflect), the coil jolts. Direct: a wider
// orbit round the duelist.
// Death: the art's pose — the wire unwinds from the top a few rows per frame (≈ 0.4 s), the body thins like a ball of
// yarn, the legs fold into the wire, the spools spin backwards; copper flicks fly off and the two-colour core light
// on the floor steps down (polarCoilUnwind, then polarCoilSlack: the empty spools rattling free); the bare spindle
// wobbles (polarCoilWobble) and topples faster and faster onto the marble — "tok" (polarCoilTok), a dust puff. That
// frame becomes the remains: the EMPTY SPOOL comes off at its shoulder size, turns side-on, rolls down the tile's
// diagonal spinning free (polarCoilBurst) and runs down; remains and spool break as copper curls and steel grit
// (polarCoilBreak) — and only then is the card born from the empty tile and flown to the graveyard. Camera never
// moves (EF-8).

import { PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import type { SfxHandle } from '../../audio/sfx';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { onFrame, sleep } from '../../vfx/combat';
import { registerCardHook, registerEvent, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type Phaser from 'phaser';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { SPOOL_MS, coilPoint, coilRemains, convergeStar, coreSpill, emptySpool, seedFx, spikeVolley, spindleDust, splinter, spoolTrack, unwindGlints, whipSparks, type Remains } from './_polar_coil-fx';
import { DEATH_UNWIND } from '../../art/monsters-v3/polar_coil-anims';
import { contactFlash } from '../_v3/flash';
import type { SfxName } from '../../audio/sfx';

const ID = 'polar_coil';
/** The hologram onset's tones: copper. */
const COPPER_RAMP: Ramp = [PAL.night2, PAL.fire0, PAL.fire1, PAL.fire2, PAL.fire3];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 31 + 5);
  const track = S.own(spoolTrack(sc, u, S.home, S.depth));
  const spill = coreSpill(sc, S.home, S.dir, 0);
  // a short onset (150 ms): the bare spindle is seen standing on its pin, not a long scan
  const p = summonPose(sc, u, { ramp: COPPER_RAMP, holoMs: 150 });
  if (!p) {
    track.destroy();
    spill.fadeOut(60);
    return;
  }
  play('polarCoilPin', { volume: 0.85, pan });
  let wind = null as SfxHandle | null;
  atFrame(u, 'summon', 1, () => (wind = start('polarCoilWind', { volume: 0.85, pan })), { late: false });
  // the core light steps up with the turns (stepped light, EF-6)
  // each step also blinks the winding's warm light onto the marble (a stepped flash at the core, warmer and wider
  // with every step: the board reads "faster and brighter" at 1×)
  const stepUp = (k: number, c: number, r: number, it: number) => {
    spill.level(k);
    const core = coilPoint(u, 'core');
    if (core) void lightFlash(sc, core.x, core.y, c, r, 200, { floorY: S.home.y, intensity: it, air: 0.3 });
  };
  atFrame(u, 'summon', 3, () => stepUp(0.5, PAL.fire3, 20, 0.45), { late: false });
  atFrame(u, 'summon', 5, () => stepUp(0.85, PAL.gold3, 24, 0.6), { late: false });
  atFrame(u, 'summon', 7, () => stepUp(1.15, PAL.gold4, 28, 0.75), { late: false });
  atMark(u, 'summon', 'land', () => {
    wind?.stop(25);
    play('polarCoilSnap', { volume: 0.95, pan });
    track.snap();
    whipSparks(sc, u, S.home.y);
    spill.level(1.3, 30);
    const core = coilPoint(u, 'core');
    if (core) void lightFlash(sc, core.x, core.y, PAL.gold4, 34, 380, { floorY: S.home.y, intensity: 0.9, air: 0.6 });
    S.finale({ ring: 54, ramp: RAMPS.fire, shake: 2, sfx: null, freezeMs: 40, playerRing: false });
  });
  atFrame(u, 'summon', 12, () => {
    play('polarCoilSpools', { volume: 0.8, pan });
    spill.level(0.5, 200);
  }, { late: false });
  await p.done;
  wind?.stop(40);
  spill.fadeOut(320);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.from === 'field') return ctx.base();
    // the sovereign's split lands its pieces itself (lane D polar_sovereign)
    if (ev.from === 'graveyard' && ev.sourceUid !== null && ctx.cardId(ev.sourceUid) === 'polar_sovereign') return ctx.base();
    await runSummon(ctx, entranceV3, entranceV3);
  },
  { priority: 20, name: 'd:polar_coil:summon' },
);

// ================================================================ flip summon (≤ 0.7 s)

/**
 * Flip summon: the card turns and the bare spindle stands on it, takes a fast wind of copper (summon f2 → f8 at 1.4×,
 * the art's own winding) — polarCoilFlipWind, the track turning under it, copper glints — and snaps taut on 'land'
 * (polarCoilSnap, whip sparks, the core light). No hologram, no generic chime. A flip from an attack (face-down
 * guard turned over in battle) keeps the shared quick reveal (ctx.base()).
 */
registerCardHook(
  ID,
  'flip',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ev.cause !== 'flipSummon') return ctx.base();
    const field = ctx.views.field;
    const tile0 = field.tileOf(ev.uid);
    if (!tile0) return ctx.base();
    const sc = ctx.scene;
    const si = ctx.findType('summon', (e) => e.uid === ev.uid && e.method === 'flip');
    if (si >= 0) ctx.consumeAt(si);
    void ctx.views.duelists?.get(ev.player).play('command');
    const tile = tile0;
    tile.setCard(ev.cardId);
    const home = { x: tile.home.x, y: tile.home.y };
    const pan = panAt(home.x);
    seedFx(ev.uid * 29 + 3);
    void tile.pulse(PLAYER_COLOR[ev.player], 220);
    const FLIP = 220;
    const flipP = tile.flipUp(FLIP);
    void ctx.wait(Math.round(FLIP * 0.7)).then(() => (tile.active && tile.orientation !== 'up' ? tile.rotateTo('up', 160) : undefined));
    play('polarCoilFlipWind', { volume: 0.85, pan });
    await ctx.wait(Math.round(FLIP * 0.45));
    const unit = field.addUnit(ev.uid, { hidden: true, atk: ctx.atk(ev.uid, 'after'), def: ctx.def(ev.uid, 'after'), position: 'attack' });
    if (!unit) {
      await flipP;
      return;
    }
    const u = unit;
    u.position = 'attack';
    u.badge.setPosition('attack');
    u.posed = true;
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const track = spoolTrack(sc, u, home, u.sprite.depth);
    const spill = coreSpill(sc, home, dir, 0.3);
    try {
      u.sprite.setPosition(u.rest0.x, u.rest0.y);
      u.pose('summon', 2);
      u.showSprite();
      atFrame(u, 'summon', 4, () => spill.level(0.5), { maxMs: 1500 });
      atFrame(u, 'summon', 6, () => spill.level(1.0), { maxMs: 1500 });
      atMark(u, 'summon', 'land', () => {
        play('polarCoilSnap', { volume: 0.8, pan });
        track.snap();
        whipSparks(sc, u, home.y);
        spill.level(1.2, 30);
        const core = coilPoint(u, 'core');
        if (core) void lightFlash(sc, core.x, core.y, PAL.gold4, 30, 320, { floorY: home.y, intensity: 0.8, air: 0.5 });
        void shake(sc, 70, 1);
        u.badge.setVisible(true);
        void u.badge.pop();
      });
      // f2 → f10 at 1.4× (the bare spindle takes its wind fast, the strands drop, then the snap), f11 / f12 settle into idle
      await u.playRange('summon', 2, 12, { timeScale: 1.4 });
      spill.fadeOut(240);
    } finally {
      track.destroy();
      u.posed = false;
      if (u.sprite.active && !u.retired) {
        u.sprite.setPosition(u.rest0.x, u.rest0.y);
        u.show();
        u.badge.setVisible(true);
        u.rest();
      }
    }
    await flipP;
  },
  { priority: 20, name: 'd:polar_coil:flip' },
);

// ================================================================ position change (toGuard: the whips wrap the drum)

registerEvent(
  'positionChange',
  async (ctx) => {
    if (!LOOK_V3 || ctx.cardId(ctx.ev.uid) !== ID || ctx.ev.position !== 'defense') return ctx.base();
    const u = ctx.views.field.unit(ctx.ev.uid);
    const tile = ctx.views.field.tileOf(ctx.ev.uid);
    if (!u || u.retired || !u.sprite.visible || !u.has('toGuard')) return ctx.base();
    const sc = ctx.scene;
    const pan = panAt(u.home.x);
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    u.posed = true;
    try {
      ctx.sfx('cardSlide', { volume: 0.5 });
      const jobs: Promise<unknown>[] = [];
      if (tile && tile.orientation !== 'side') jobs.push(tile.rotateTo('side', 240));
      u.position = 'defense';
      u.badge.setPosition('defense');
      // the whips swing up and wrap the drum (the wrap bands appear f2 / f3): twang + the lugs ticking on
      atFrame(u, 'toGuard', 1, () => play('polarCoilWrap', { volume: 0.85, pan }), { maxMs: 1500 });
      const n = u.frameCount('toGuard');
      jobs.push(u.playRange('toGuard', 0, undefined, { hold: true }).then(() => u.rest()));
      jobs.push(
        u.playToFrame('toGuard', n - 1).then(() => {
          // wrapped: the field closes round the drum — a two-pole light step at the core (N behind, S in front)
          const c = coilPoint(u, 'core') ?? u.core();
          void lightFlash(sc, c.x - dir * 6, c.y, PAL.fire3, 14, 200, { floorY: u.home.y, intensity: 0.55 });
          void lightFlash(sc, c.x + dir * 6, c.y, PAL.water3, 14, 200, { floorY: u.home.y, intensity: 0.55 });
          whipSparks(sc, u, u.home.y);
        }),
      );
      await Promise.race([Promise.all(jobs), sleep(sc, 400)]);
    } finally {
      u.posed = false;
      if (u.sprite.active && !u.retired) {
        u.sprite.setPosition(u.rest0.x, u.rest0.y);
        if (u.frameInfo().anim !== 'guard' || !u.sprite.anims.isPlaying) u.rest();
      }
    }
  },
  { priority: 20, name: 'd:polar_coil:position' },
);

// ================================================================ strike

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    const sc = s.scene;
    seedFx(u.uid * 43 + (s.target?.uid ?? 7));
    const res = (s.ctx.ev as BattleEv).result;
    const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
    const pan = panAt(u.home.x);
    const f0 = strikeStartFrame(u);
    const REL = u.markFrame('attack', 'release', 5);
    const CON = u.markFrame('attack', 'contact', REL + 1);
    // ---- charge: the spikes gather and orbit the coil (the declaration's whirr goes on)
    const charge = takeCharge(u, 'polarCoilCharge', { volume: 0.7, pan });
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      charge.stop(30);
      play('polarCoilFling', { volume: 0.5, pan });
    };
    atFrame(u, 'attack', REL, release, { late: false });
    const anim = u.playRange('attack', f0);
    await sleep(sc, u.rangeMs('attack', f0, CON));
    release();
    // ---- f6: the spikes leave the front star as a fan and swing into an orbit round the target
    const from = coilPoint(u, 'star', { anim: 'attack', frame: CON }) ?? u.muzzle();
    const at: XY = { x: Math.round(s.to.x), y: Math.round(s.to.y) };
    const ground = s.target ? s.target.home : s.toGround;
    const dist = Math.hypot(at.x - from.x, at.y - from.y);
    const depth = s.target && s.target.sprite.active ? s.target.sprite.depth : DEPTH.FX - 1;
    let orbit = null as SfxHandle | null;
    let hit!: () => void;
    const contact = new Promise<void>((r) => (hit = r));
    void spikeVolley(sc, {
      from,
      at,
      ground,
      R: s.direct ? 32 : 26,
      flyMs: Math.round(Math.max(150, Math.min(s.direct ? 300 : 260, dist * 1.25))),
      orbitMs: s.direct ? 380 : 330,
      plungeMs: 70,
      bodyDepth: depth,
      stopR: s.blocked ? 8 : 0,
      onOrbit: () => (orbit = start('polarCoilOrbit', { volume: 0.5, pan: panAt(at.x) })),
      // the last lap: the whirr hushes and the three "tşak" ticks lead in, so the thump + magnetic crack land ON
      // the convergence frame (polarCoilTshak at onConverge)
      preMs: s.blocked ? 40 : 110,
      onPreHit: () => {
        orbit?.stop(s.blocked ? 25 : 60);
        orbit = null;
        if (!s.blocked) play('polarCoilTicks', { volume: 1, pan: panAt(at.x) });
      },
      onConverge: (dirs) => {
        orbit?.stop(25);
        // the coil's "tşak" IS the contact: no generic body blow under it (a struck body with its own material
        // keeps its material hit — hitSoundFor names are not hushed)
        if (s.blocked) s.impact(at);
        else hush(['impactHeavy', 'impactLight'], () => s.impact(at));
        if (s.blocked) {
          play('polarCoilDeflect', { volume: 0.85, pan: panAt(at.x) });
          splinter(sc, at, ground, { dirs, depth: DEPTH.FX + 1 });
        } else {
          play('polarCoilTshak', { volume: 1, pan: panAt(at.x) });
          convergeStar(sc, at, ground, { dirs, depth: DEPTH.FX + 1, big: s.direct });
          void shake(sc, 110, s.power >= 3 ? 3 : 2);
        }
        hit();
      },
    });
    await contact;
    if (loses || !u.sprite.active || u.retired) return;
    await anim;
    if (!u.sprite.active || u.retired) return;
    // blocked: the field snaps back through the wire — the coil jolts on its boots
    if (s.blocked) await u.play('hit');
  },
  { priority: 20, name: 'd:polar_coil:strike' },
);

// ================================================================ death

/**
 * The unwinding beat (death f1 → f6): polarCoilUnwind, copper flicks off the top, the two-colour core light on the
 * floor stepping down to dark, the spindle hitting the marble on the impact frame. Bound to the death POSE's frames
 * and armed as early as possible — before the blow lands (attack / defend hooks below), because the blow's reaction
 * starts the death pose at the contact, ~130 ms before the destroy event reaches the 'destroyed' hook. Armed once
 * per unit; arming again is a no-op, and an arm that never sees the death pose expires on its own.
 * `own`: the 'destroyed' hook took the death over (the delayed path below): the character's dissolve / after-
 * dissolve sounds (slack, wobble, tok — CHARACTER_SOUNDS) are played here on their frames, since deathV3 joins
 * only after the pose is over and would not play them.
 */
interface Arm {
  fired: boolean;
  own: boolean;
}
const armed = new WeakMap<MonsterUnit, Arm>();
function armUnwind(sc: Phaser.Scene, u: MonsterUnit, maxMs: number): Arm {
  const had = armed.get(u);
  if (had) return had;
  const st: Arm = { fired: false, own: false };
  armed.set(u, st);
  const cancel = atFrame(
    u,
    'death',
    1,
    () => {
      st.fired = true;
      const home = { ...u.home };
      const dir: 1 | -1 = u.flipX ? -1 : 1;
      const pan = panAt(home.x);
      const [, unwindEnd] = DEATH_UNWIND;
      const dissolveF = u.markFrame('death', 'dissolve', 5);
      const n = u.frameCount('death');
      play('polarCoilUnwind', { volume: 0.9, pan });
      unwindGlints(sc, u, Math.max(120, u.rangeMs('death', 1, unwindEnd + 1)));
      // the core light dies with the winding: steps down to dark across the unwind (it starts lit, the pose's f1 core)
      const spill = coreSpill(sc, home, dir, 0.9);
      const steps = [0.7, 0.5, 0.32, 0.18];
      for (let i = 0; i < steps.length; i++) atFrame(u, 'death', 2 + i, () => spill.level(steps[i], 30), { maxMs: 3000 });
      atFrame(u, 'death', unwindEnd, () => spill.fadeOut(80), { maxMs: 3000 });
      void sleep(sc, 1600).then(() => spill.fadeOut(60));
      // the delayed path: the character's sounds on their frames (the same frames CHARACTER_SOUNDS names)
      const C: [number, SfxName, number][] = [
        [dissolveF, 'polarCoilSlack', 1],
        [dissolveF + 2, 'polarCoilWobble', 1],
        [n - 1, 'polarCoilTok', 0.9],
      ];
      for (const [f, name, volume] of C) atFrame(u, 'death', Math.min(n - 1, f), () => st.own && play(name, { volume, pan }), { maxMs: 3000 });
      // the spindle's head hits the marble on the impact frame (the last)
      atFrame(u, 'death', n - 1, () => {
        spindleDust(sc, { x: home.x - dir * 18, y: home.y }, home.y);
        void shake(sc, 80, 1);
      }, { maxMs: 3000 });
    },
    { maxMs },
  );
  // the arm expires (no death came): a later destroy may arm it again
  void sleep(sc, maxMs + 20).then(() => {
    if (!st.fired && armed.get(u) === st) {
      cancel();
      armed.delete(u);
    }
  });
  return st;
}

/** A battle the coil is in (attacking or attacked): arm the unwinding before the blow lands. */
function armForBattle(ctx: CinematicContext<BattleEv>, uid: number | null): Promise<void> {
  if (LOOK_V3 && uid !== null) {
    const u = ctx.views.field.unit(uid);
    if (u && !u.retired && u.sprite.active && u.cardId === ID) armUnwind(ctx.scene, u, 6000);
  }
  return ctx.base();
}
registerCardHook(ID, 'attack', (ctx) => armForBattle(ctx as CinematicContext<BattleEv>, (ctx.ev as BattleEv).attackerUid), { priority: 30, name: 'd:polar_coil:arm-attack' });
registerCardHook(ID, 'defend', (ctx) => armForBattle(ctx as CinematicContext<BattleEv>, (ctx.ev as BattleEv).targetUid), { priority: 30, name: 'd:polar_coil:arm-defend' });

/** Resolve once `cond` holds, or after `ms` of scene time. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/**
 * Death. The coil's final material (§5.2 "tel çözülür, makara boş döner") must be READ before the card leaves, so
 * the coil owns the order: the pose plays (unwind → topple); its last frame (the bare spindle hitting the marble) is
 * taken over as remains (the sprite hides); the empty spool comes off the shoulder at its own size, rolls down the
 * tile's diagonal spinning free and runs down; the remains and the spool break as copper curls and steel grit —
 * and only then deathV3 joins (its burst = the card born from the now-empty tile and flown to the graveyard). The
 * pose is already running when the battle's destroy arrives (the blow's reaction hands over to it); an effect
 * destroy (no blow) starts it here. A coil dying from its guard keeps the shared guard break (deathV3 at once; the
 * remains then break under the card's flight).
 */
registerCardHook(
  ID,
  'destroyed',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    const sc = ctx.scene;
    const u = ctx.views.field.unit(ctx.ev.uid);
    if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return ctx.base();
    seedFx(u.uid * 59 + 11);
    const home = { ...u.home };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const inDeath = () => u.frameInfo().anim === 'death';
    const guarded = () => {
      const a = u.frameInfo().anim;
      return a === 'guard' || a === 'toGuard' || a === 'fromGuard';
    };
    // a battle death: the reaction may still be on its way to the death pose — give it its time
    const battle = armed.has(u);
    if (battle && !inDeath() && !guarded()) await until(sc, inDeath, 500);
    if (!u.sprite.active || u.retired) return ctx.base();
    // a death with no blow (an effect destroy): arm the unwinding now (it fires on the pose's f1)
    const arm = armUnwind(sc, u, 3000);
    const lastF = u.frameCount('death') - 1;
    let remains: Remains | null = null;
    const takeRemains = () => {
      if (remains || !u.sprite.active || !u.sprite.visible || u.retired) return;
      remains = coilRemains(sc, u);
      u.sprite.setVisible(false);
    };
    const own = inDeath() || !guarded();
    if (!own) {
      // the guard break path: deathV3 at once (its own C sounds), the remains under the card's flight
      atFrame(u, 'death', lastF, takeRemains, { maxMs: 3000 });
      return deathV3(ctx, {
        fallback: () => ctx.base(),
        onBurst: () => {
          const r = remains as Remains | null;
          void emptySpool(sc, home, dir, DEPTH.FX - 1, r?.spoolAt);
          if (r) {
            play('polarCoilBurst', { pan: panAt(home.x) });
            r.burst(SPOOL_MS);
          }
        },
      });
    }
    // ---- the coil owns the death until its final material is over
    arm.own = true;
    u.posed = true;
    u.badge.setVisible(false);
    if (!inDeath()) {
      // an effect destroy: the blow is the effect's; the pose starts here, from the recoil frame
      if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, ctx.hints.push as XY | undefined ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
      u.asClaimant(() => void u.playRange('death', 0, undefined, { hold: true }));
    }
    await until(sc, () => !u.sprite.active || (inDeath() && u.frameInfo().frame >= lastF), u.animMs('death') * 1.6 + 300);
    if (!u.sprite.active || u.retired) return ctx.base();
    takeRemains();
    const r = remains as Remains | null;
    if (r) {
      play('polarCoilBurst', { pan: panAt(home.x) });
      r.burst(SPOOL_MS);
      await emptySpool(sc, home, dir, Math.max(DEPTH.FX - 1, u.sprite.depth + 0.6), r.spoolAt, () => play('polarCoilBreak', { volume: 1, pan: panAt(home.x) }));
    }
    // the final material is over: the card is born from the empty tile. deathV3 needs a live unit — the sprite is
    // made visible for its synchronous check only (alpha 0, its last frame), then hidden again; the blow's flash
    // and the accent were the coil's own (hit: false)
    if (!u.sprite.active || u.retired) return ctx.base();
    u.sprite.setAlpha(0).setVisible(true);
    const c2 = Object.create(ctx, { hints: { value: { ...ctx.hints, hit: false } } }) as typeof ctx;
    const done = deathV3(c2, { fallback: () => ctx.base() });
    if (u.sprite.active) u.sprite.setVisible(false).setAlpha(1);
    await done;
  },
  { priority: 20, name: 'd:polar_coil:death' },
);
