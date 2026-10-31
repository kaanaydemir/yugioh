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

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { SfxHandle } from '../../audio/sfx';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { sleep } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { coilPoint, convergeStar, coreSpill, emptySpool, seedFx, spikeVolley, spindleDust, splinter, spoolTrack, unwindGlints, whipSparks } from './_polar_coil-fx';

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
      orbitMs: s.direct ? 420 : 380,
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
    const dissolveF = u.markFrame('death', 'dissolve', 7);
    const n = u.frameCount('death');
    // the core light dies with the winding: 4 steps down to dark
    const spill = coreSpill(sc, home, dir, 0.9);
    // the unwinding (its own beat, not the voice's deathStart: the blow's reaction often has already started
    // the death pose when this handler runs, and the kit skips a frame that has passed)
    atFrame(u, 'death', 1, () => {
      play('polarCoilUnwind', { volume: 0.9, pan: panAt(home.x) });
      unwindGlints(sc, u, Math.max(120, u.rangeMs('death', 1, 6)));
    }, { maxMs: 3000 });
    atFrame(u, 'death', 2, () => spill.level(0.65, 30), { maxMs: 3000 });
    atFrame(u, 'death', 3, () => spill.level(0.4, 30), { maxMs: 3000 });
    atFrame(u, 'death', 4, () => spill.level(0.2, 30), { maxMs: 3000 });
    atFrame(u, 'death', 5, () => spill.fadeOut(80), { maxMs: 3000 });
    // the spindle's head hits the marble on the last tilt frame (dissolve + 2: polarCoilTok via the voice)
    atFrame(u, 'death', Math.min(n - 1, dissolveF + 2), () => {
      spindleDust(sc, { x: home.x - dir * 16, y: home.y }, home.y);
      void shake(sc, 80, 1);
    }, { maxMs: 3000 });
    return deathV3(ctx, {
      fallback: () => {
        spill.fadeOut(60);
        return ctx.base();
      },
      onBurst: () => emptySpool(sc, home, dir, DEPTH.FX - 1),
    });
  },
  { priority: 20, name: 'd:polar_coil:death' },
);
