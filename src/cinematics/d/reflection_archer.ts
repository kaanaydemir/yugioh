// Yansıyan Okçu (reflection_archer, lane D, C4) — its own v3 summon, strike and death (?look=v3 only; v1 falls
// through to the chain below every hook, byte-identical). Pieces: ./_reflection_archer-fx.ts; sounds:
// src/audio/v3/archer.ts. "Yansıma her zaman bir adım önde": every beat is double, and the reflection's half comes
// a step early or a step late — never at the same time.
//
// Summon (≈ 2.2 s at tempo): one drop of light falls out of the dark (archerDrop) — its dark twin rises under the
// floor line to meet it — and hits the tile (f2, "tıp" + the glass surface spreading: archerTip): a gold ring runs
// out over the marble and 80 ms later its dark-blue echo. The puddle lies flat as a mirror; the REFLECTION wakes in
// it first (f5, its 330 alone: archerReflect) while the floor light turns cold blue and the mirror line opens out
// of the puddle to both sides. The archer unfolds up "over" it, its exact mirror image at f7 (archerRise, the
// inverted-rise whine, held to the land); on 'land' (f10) the mirror line flares and collapses into its feet,
// the mirror note rings and is answered an octave down (archerLand), the echo rings run out, the badge pops.
// Strike "Ayna Atışı" (ranged): the long draw (the declaration's archerCharge goes on): light motes gather on the
// arrow's point, dark ones on its mirror under the floor; release (f6) — the twang (archerRelease) — and the two
// arrows leave (archerFlight, held to the contact): the arrow of light straight through the air, the reflection's
// arrow UNDER the floor as its mirror image, a hair ahead, the marble rippling over it. Contact: they meet on the
// target top and bottom — a vertical line of light + the horizontal mirror flash, glass glints along the mirror
// plane, echo rings on the floor (archerImpact; the hit-stop is the mediumHeavy class's, 80–110 ms by power).
// Blocked: a smaller, colder meeting, the arrow of light splinters back (archerDeflect); the battle's backlash
// runs up the line and the archer is jolted (hitMagic). Direct: the widest flash at the duelist.
// Death: the puddle cracks (f1; cracks of light run out over the marble: the voice's archerCrack), the reflection
// breaks (f2: dark-blue shards slide over the floor), the archer stands FLAT without a reflection for a beat (the
// dissolve mark: archerFlat, one dry 660 and no echo answers), then shatters into glass: on the burst its shards
// fall and their dark reflections rise to meet them at the floor line; the puddle drains to nothing.
// The camera never moves (EF-8).

import { PAL, type Ramp } from '../../art/palette';
import type { GameEvent } from '../../engine/types';
import { LOOK_V3, type XY } from '../../view/layout';
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
import {
  FLOOR_DEPTH, archerPoint, drawMotes, echoRings, glassFall, lightDrop, mirrorMeet, mirrorPlane, puddleCracks, reflectionShards, seedFx, splinters, twinArrows,
} from './_reflection_archer-fx';

const ID = 'reflection_archer';
/** The hologram tones (unused: the drop is the reveal) — the moon gold. */
const MOON: Ramp = [PAL.night2, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 37 + 11);
  const pool = S.glow({ color: PAL.gold4, radius: 22, intensity: 0.25, anim: 'breathe', fadeIn: 120 });
  // one drop of light falls out of the dark; the pose's own f0 carries the last of it
  play('archerDrop', { volume: 0.8, pan });
  await lightDrop(sc, S.home, 170, S.depth + 0.5);
  const p = summonPose(sc, u, { ramp: MOON, hologram: false });
  if (!p) return;
  const snd: { rise: ReturnType<typeof start> | null } = { rise: null };
  // f2: the drop hits — "tıp", the glass surface spreads (f3–f4)
  atFrame(u, 'summon', 2, () => {
    play('archerTip', { volume: 0.9, pan });
    void echoRings(sc, S.home, { r: 30, ms: 340 });
    void lightFlash(sc, S.home.x, S.home.y, PAL.white, 16, 180, { floorY: S.home.y, intensity: 0.7 });
    pool.setIntensity(0.7, 60);
  }, { late: false });
  // f5: the reflection wakes in the puddle first — the floor light turns cold, the mirror line opens
  let plane: ReturnType<typeof mirrorPlane> | null = null;
  atFrame(u, 'summon', 5, () => {
    play('archerReflect', { volume: 0.9, pan });
    pool.setColor(PAL.water3);
    pool.setIntensity(0.9, 120);
    plane = S.own(mirrorPlane(sc, S.home, S.depth + 0.4));
  }, { late: false });
  // f7: the archer unfolds up over it (the inverted rise, held to the land)
  atFrame(u, 'summon', 7, () => {
    snd.rise = start('archerRise', { volume: 0.85, pan });
    pool.setColor(PAL.gold4);
  }, { late: false });
  atMark(u, 'summon', 'land', () => {
    snd.rise?.stop(30);
    snd.rise = null;
    play('archerLand', { volume: 0.95, pan });
    void (plane as ReturnType<typeof mirrorPlane> | null)?.collapse(180);
    void echoRings(sc, S.home, { r: 38, ms: 420, bright: true });
    pool.setIntensity(1.2, 30);
    const tip = archerPoint(u, 'gem');
    void lightFlash(sc, S.home.x, (tip?.y ?? S.home.y - 30), PAL.gold4, 22, 260, { floorY: S.home.y, intensity: 0.9 });
    void shake(sc, 70, 1);
    void u.badge.pop();
  }, { late: false });
  await p.done;
  snd.rise?.stop(40);
  (plane as ReturnType<typeof mirrorPlane> | null)?.destroy();
  void pool.fadeOut(300);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx, entranceV3, entranceV3);
  },
  { priority: 20, name: 'd:reflection_archer:summon' },
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
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const pan = panAt(u.home.x);
    const f0 = strikeStartFrame(u);
    const REL = u.markFrame('attack', 'release', 6);
    // the frame after the release where the reflection's arrow has left the puddle: held through the flight
    const HOLD = Math.min(u.frameCount('attack') - 2, REL + 2);
    const ground = Math.round(u.home.y);
    // ---- the draw: the declaration's gathering goes on; motes on the arrow and on its mirror
    const charge = takeCharge(u, 'archerCharge', { volume: 0.85, pan });
    const full = archerPoint(u, 'tip', 'attack', Math.max(0, REL - 1)) ?? u.muzzle();
    const toRel = u.rangeMs('attack', f0, REL);
    drawMotes(sc, u, toRel, full, ground);
    let relDone = false;
    const release = () => {
      if (relDone) return;
      relDone = true;
      charge.stop(30);
      play('archerRelease', { volume: 0.9, pan });
    };
    atFrame(u, 'attack', REL, release, { late: false });
    await u.playRange('attack', f0, REL);
    release();
    const flight = start('archerFlight', { volume: 0.85, pan });
    void u.playRange('attack', REL, HOLD);
    // ---- the meeting point: the target's core (blocked: in front of its guard), or the duelist
    const back = s.blocked && s.target ? 9 : 0;
    const to: XY = { x: Math.round(s.to.x - dir * back), y: Math.round(s.to.y) };
    const toGround: XY = { x: Math.round(s.toGround.x - dir * back), y: Math.round(s.toGround.y) };
    // the arrow flies on from the head of the release streak the art draws (no second arrow beside it)
    const from = archerPoint(u, 'streak', 'attack', REL) ?? full;
    const fromUnder = archerPoint(u, 'puddle') ?? { x: u.home.x + dir * 24, y: ground + 5 };
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const ms = Math.round(clamp(dist * 1.1, 150, s.direct ? 300 : 260));
    await twinArrows(sc, { from, fromUnder, ground, to, toGround, ms, dir });
    flight.stop(30);
    // ---- contact: top and bottom meet
    s.impact(to);
    play(s.blocked ? 'archerDeflect' : 'archerImpact', { volume: 0.95, pan: panAt(to.x) });
    void mirrorMeet(sc, { at: to, ground: toGround, dir, blocked: s.blocked, direct: s.direct });
    void echoRings(sc, toGround, { r: s.blocked ? 22 : 32, ms: 360, depth: FLOOR_DEPTH });
    if (s.blocked) splinters(sc, to, dir);
    void lightFlash(sc, to.x, to.y, s.blocked ? PAL.water4 : PAL.gold4, s.blocked ? 20 : 30, 300, { floorY: toGround.y, air: 0.6, intensity: 0.9 });
    // the attacker loses: the battle kit answers on this frame (backlash) and owns the body from here
    if (loses || !u.sprite.active || u.retired) return;
    await sleep(sc, 60);
    if (!u.sprite.active || u.retired) return;
    if (s.blocked) {
      // the guard holds and the backlash runs up the attack's line: the archer is jolted
      await u.play(u.has('hitMagic') ? 'hitMagic' : 'hit');
      return;
    }
    // the follow-through: the reflection lowers its bow first (the art), the archer after it
    await u.playRange('attack', HOLD + 1);
  },
  { priority: 20, name: 'd:reflection_archer:strike' },
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
    seedFx(u.uid * 59 + 3);
    const feet = u.worldPoint('feet');
    const ground: XY = { x: Math.round(feet.x), y: Math.round(feet.y) };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    let cracks: ReturnType<typeof puddleCracks> | null = null;
    // f1: the puddle cracks — cracks of light run out over the marble (the voice's deathStart scores it)
    atFrame(u, 'death', 1, () => {
      cracks = puddleCracks(sc, ground, dir);
      void lightFlash(sc, ground.x, ground.y + 4, PAL.water4, 18, 200, { floorY: ground.y, intensity: 0.7 });
    }, { maxMs: 3000 });
    // f2: the reflection breaks — its shards slide out over the floor
    atFrame(u, 'death', 2, () => {
      reflectionShards(sc, ground, dir, u.sprite.depth + 0.2);
      void shake(sc, 70, 1);
    }, { maxMs: 3000 });
    return deathV3(ctx, {
      fallback: () => {
        (cracks as ReturnType<typeof puddleCracks> | null)?.destroy();
        return ctx.base();
      },
      onBurst: () => {
        void glassFall(sc, u, ground, dir);
        void (cracks as ReturnType<typeof puddleCracks> | null)?.fade(360);
      },
    });
  },
  { priority: 20, name: 'd:reflection_archer:death' },
);
