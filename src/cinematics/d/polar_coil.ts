// Kutup Bobini (polar_coil, lane D, C14) — its own v3 summon, strike and death (?look=v3 only; v1 falls through
// to the chain below every hook, byte-identical). Pieces: ./_polar_coil-fx.ts; sounds: src/audio/v3/polar_coil.ts.
//
// Summon (≈ 2.0 s at tempo): the empty spindle stands on its pin — "tok" (polarCoilPin), a dashed spool track
// prints on the floor under it; f1–f6 the copper wire flies in from the top-left and winds bottom → top
// (the art), the track turns faster and warms stone → copper → gold, copper glints fly off the climbing winding
// point and the two-colour core light (N orange behind, S blue in front) rises on the marble in steps
// (polarCoilWind: the buzz climbs D3 → D4, the turn ticks accelerate; held to 'land'); f8 'land' — the coil
// snaps taut, legs and whips open: copper twang + whip crack (polarCoilSnap), sparks off the two lugs, the track
// flashes gold and closes in, the finale ring, hit-stop 40 ms, shake 2; f10 the shoulder spools spin up and run
// down (polarCoilSpools).
// Strike "Tel Yörüngesi" (ranged; the coil never leaves its tile): the art's charge — iron dust gathers into
// three spikes orbiting the coil, the whips circle overhead (polarCoilCharge: a circling, rising whirr, from the
// declaration); f5 'release' the whips crack forward and fling the spikes (polarCoilFling); f6 they leave the
// front star as a fan, each on its own arc, swing into an orbit round the target — the back half behind its body,
// shadows and a dashed track on the floor, the floor light warming each lap — circle it faster
// (polarCoilOrbit, a three-voice whirr panning round), then plunge in together: the contact (hit-stop of the
// mediumHeavy class, the struck body's material) with a three-rayed star in the spikes' colours (N / S / gold)
// shooting back out where they came from, one ring, iron dust (polarCoilTshak: "tşak-tşak-tşak"). Blocked: the
// spikes stop on the guard and splinter into tumbling grains (polarCoilDeflect), the coil jolts. Direct: a wider
// orbit round the duelist.
// Death: the art's pose — the wire unwinds from the top, the spools spin backwards, the body thins like a ball
// of yarn, the empty spindle wobbles and topples. Copper flicks fly off the unwinding top and the two-colour core
// light on the floor steps down to dark (polarCoilUnwind); 'dissolve' the bare spindle wobbles
// (polarCoilWobble); it hits the marble — "tok", a dust puff (polarCoilTok); on the burst frame loose copper
// curls spring out and an EMPTY SPOOL rolls away spinning free and runs down (polarCoilBurst). Camera never
// moves (EF-8).

import { PAL, PLAYER_COLOR, RAMPS, type Ramp } from '../../art/palette';
import type { SfxHandle } from '../../audio/sfx';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { sleep } from '../../vfx/combat';
import { registerCardHook, registerEvent, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type Phaser from 'phaser';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { coilPoint, coilRemains, convergeStar, coreSpill, emptySpool, seedFx, spikeVolley, spindleDust, splinter, spoolTrack, unwindGlints, whipSparks, type Remains } from './_polar_coil-fx';

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
  atFrame(u, 'summon', 3, () => spill.level(0.3), { late: false });
  atFrame(u, 'summon', 5, () => spill.level(0.6), { late: false });
  atFrame(u, 'summon', 7, () => spill.level(0.85), { late: false });
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
  atFrame(u, 'summon', 10, () => {
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
      atFrame(u, 'summon', 6, () => spill.level(0.8), { maxMs: 1500 });
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
      // f2 → f8 at 1.4× (the bare spindle takes its wind fast, then the snap), f9 / f10 settle into idle
      await u.playRange('summon', 2, 10, { timeScale: 1.4 });
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
    const charge = takeCharge(u, 'polarCoilCharge', { volume: 0.85, pan });
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      charge.stop(30);
      play('polarCoilFling', { volume: 0.9, pan });
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
      onOrbit: () => (orbit = start('polarCoilOrbit', { volume: 0.8, pan: panAt(at.x) })),
      onConverge: (dirs) => {
        orbit?.stop(25);
        s.impact(at);
        if (s.blocked) {
          play('polarCoilDeflect', { volume: 0.85, pan: panAt(at.x) });
          splinter(sc, at, ground, { dirs, depth: DEPTH.FX + 1 });
        } else {
          play('polarCoilTshak', { volume: 0.9, pan: panAt(at.x) });
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
 * The unwinding beat (death f1 → f5): polarCoilUnwind, copper flicks off the top, the two-colour core light on the
 * floor stepping down to dark, and the spindle's head hitting the marble. Bound to the death POSE's frames and
 * armed as early as possible — before the blow lands (attack / defend hooks below), because the blow's reaction
 * starts the death pose at the contact, ~130 ms before the destroy event reaches the 'destroyed' hook. Armed once
 * per unit; arming again is a no-op, and an arm that never sees the death pose expires on its own.
 */
const armed = new WeakMap<MonsterUnit, { fired: boolean }>();
function armUnwind(sc: Phaser.Scene, u: MonsterUnit, maxMs: number): void {
  if (armed.has(u)) return;
  const st = { fired: false };
  armed.set(u, st);
  const cancel = atFrame(
    u,
    'death',
    1,
    () => {
      st.fired = true;
      const home = { ...u.home };
      const dir: 1 | -1 = u.flipX ? -1 : 1;
      const dissolveF = u.markFrame('death', 'dissolve', 7);
      const n = u.frameCount('death');
      play('polarCoilUnwind', { volume: 0.9, pan: panAt(home.x) });
      unwindGlints(sc, u, Math.max(120, u.rangeMs('death', 1, 6)));
      // the core light dies with the winding: 4 steps down to dark (it starts lit, the pose's f1 core)
      const spill = coreSpill(sc, home, dir, 0.9);
      atFrame(u, 'death', 2, () => spill.level(0.65, 30), { maxMs: 3000 });
      atFrame(u, 'death', 3, () => spill.level(0.4, 30), { maxMs: 3000 });
      atFrame(u, 'death', 4, () => spill.level(0.2, 30), { maxMs: 3000 });
      atFrame(u, 'death', 5, () => spill.fadeOut(80), { maxMs: 3000 });
      void sleep(sc, 1600).then(() => spill.fadeOut(60));
      // the spindle's head hits the marble on the last tilt frame (dissolve + 2: polarCoilTok via the voice)
      atFrame(u, 'death', Math.min(n - 1, dissolveF + 2), () => {
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

registerCardHook(
  ID,
  'destroyed',
  (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.location !== 'monster' || sourceOwnsDeath(ctx)) return ctx.base();
    const sc = ctx.scene;
    const u = ctx.views.field.unit(ctx.ev.uid);
    if (!u || u.retired || !u.sprite.active || !u.sprite.visible) return ctx.base();
    seedFx(u.uid * 59 + 11);
    const home = { ...u.home };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    // a death with no blow (an effect destroy): arm the unwinding now (it fires on the pose's f1)
    armUnwind(sc, u, 3000);
    // the last frame (the bare spindle lying clean on its own tile) becomes the remains as soon as it shows: the
    // sprite hides, so deathV3 holds on the remains and no generic material break follows — the final material is
    // the coil's own (the empty spool rolling off, copper curls, a 150-ms break of the spindle at the very end)
    const lastF = u.frameCount('death') - 1;
    let remains: Remains | null = null;
    atFrame(
      u,
      'death',
      lastF,
      () => {
        if (remains || !u.sprite.active || !u.sprite.visible || u.retired) return;
        remains = coilRemains(sc, u);
        u.sprite.setVisible(false);
      },
      { maxMs: 3000 },
    );
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: () => {
        const r = remains as Remains | null;
        emptySpool(sc, home, dir, DEPTH.FX - 1, r?.spoolAt);
        // the shatter (and its burst cue) was skipped: the coil's own burst sound (the spool spinning free)
        if (r) {
          play('polarCoilBurst', { pan: panAt(home.x) });
          r.burst(380);
        }
      },
    });
  },
  { priority: 20, name: 'd:polar_coil:death' },
);
