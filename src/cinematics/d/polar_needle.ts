// Kutup İğnesi (polar_needle, lane D, C12) — its own v3 summon, strike and death (?look=v3 only; v1 falls through
// to the chain below every hook, byte-identical). Pieces: ./_polar_needle-fx.ts; sounds: src/audio/v3/polar_needle.ts.
//
// Summon (≈ 2.1 s at tempo): iron dust streams into a compass dial etched round the tile while the needle falls
// point-first out of the sky (polarNeedleDrop); on 'land' its point strikes the marble — "tink" (polarNeedleTip)
// — and it spins TWICE on the tip like a compass (the art's yaw frames): the needle-shadow on the dial follows the
// spear, the tick under it lights, the pivot ratchet slows down (polarNeedleSpin, held to the lock); it wobbles
// past the foe and back and LOCKS (f11): "TIK" (polarNeedleLock), the dial's foe tick flashes, a stepped bearing
// line shoots out along the floor toward the opponent, hit-stop 40 ms, the badge pops; f12 the limbs open and the
// rose crown fans out (polarNeedleUnfold) while the dial's dust lets go.
// Strike "Kıskaç Hamlesi" (melee lunge): the spear is drawn back level and the long locked aim begins (the
// declaration's polarNeedleCharge goes on) while a dotted bearing marches over the floor to the target; f2 the
// two field brackets — orange "(" on the near side, blue ")" on the far side — appear wide round the target
// (polarNeedleBracket) and step in; f4 they SLAM shut on the body: it is locked, iron dust flows ( → ) through it
// (polarNeedleClamp; no pull). f6 the lunge: the needle crosses the floor in one straight dash, its two-colour
// track behind it (polarNeedleLunge); f7 contact — the spear runs through between the brackets: a line of light
// through the target, a star at the point, the brackets shatter (polarNeedlePierce; hit-stop of the mediumHeavy
// class), then it draws back home through the recovery frames. Blocked: the point skids off the guard
// (polarNeedleDeflect), the brackets spring back out and flicker away, the needle is thrown back to its tile.
// Direct: the brackets close round the duelist and the dash crosses the field.
// Death: an invisible force seizes the needle (f1: iron dust sucked up to a point above the head, the field lines
// bend up to it; polarNeedleSeize), RIPS it out of the shell (f2: steel / gold shards, "şvuup" polarNeedleRip),
// it spins madly away and off the top of the screen (polarNeedleWhirl; own pixel frames after the art's f5),
// the helm and pauldrons drop (polarNeedlePlate ×2) and on the burst frame the magnetite plates clack down on the
// marble (polarNeedleBurst). Camera never moves (EF-8).

import { PAL, type Ramp } from '../../art/palette';
import type { GameEvent } from '../../engine/types';
import { framePose } from '../../art/monsters-v3/polar_needle-anims';
import { skeleton } from '../../art/monsters-v3/polar_needle-rig';
import { DEPTH, LOOK_V3, unitDepth, zoneXY, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { animate, sleep } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath, worldBox } from '../strikes-b/_kit';
import { freeze, runSummon, type Stage } from '../summon-a/_kit';
import { bearingLine, brackets, compassDial, dropStreak, flyingNeedle, forceGrip, lockBeam, lungeTrail, needleOffset, needlePoint, pierceFlash, ripBurst, seedFx, shellPlates } from './_polar_needle-fx';

const ID = 'polar_needle';
/** The hologram onset's tones: the orange N field. */
const FIELD: Ramp = [PAL.night2, PAL.fire1, PAL.fire2, PAL.fire3, PAL.fire4];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const norm = (p: XY): XY => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 29 + 5);
  const foe = zoneXY(S.player === 0 ? 1 : 0, 'monster', u.zone);
  const dial = S.own(compassDial(sc, u, S.home, S.dir, foe));
  const pool = S.glow({ color: PAL.fire3, radius: 24, intensity: 0.45, anim: 'flicker', fadeIn: 120 });
  play('polarNeedleDrop', { volume: 0.8, pan });
  // the needle falls out of the sky before the pose takes over (its f0 carries the last of the streak)
  await dropStreak(sc, S.home, 150, S.depth + 0.5);
  const p = summonPose(sc, u, { ramp: FIELD, holoMs: 140 });
  if (!p) {
    dial.destroy();
    return;
  }
  const snd: { spin: ReturnType<typeof start> | null } = { spin: null };
  atMark(u, 'summon', 'land', () => {
    play('polarNeedleTip', { volume: 0.9, pan });
    snd.spin = start('polarNeedleSpin', { volume: 0.85, pan });
    pool.setIntensity(0.85, 40);
    void lightFlash(sc, S.home.x, S.home.y - 2, PAL.white, 14, 160, { floorY: S.home.y, intensity: 0.8 });
    void shake(sc, 60, 1);
  });
  const LOCK = 11;
  atFrame(
    u,
    'summon',
    LOCK,
    () => {
      snd.spin?.stop(25);
      snd.spin = null;
      play('polarNeedleLock', { volume: 0.95, pan });
      dial.lock();
      void lockBeam(sc, S.home, foe);
      pool.setColor(PAL.fire4);
      pool.setIntensity(1.15, 30);
      const tip = needlePoint(u, 'spear');
      if (tip) void lightFlash(sc, tip.x, tip.y, PAL.fire4, 20, 260, { floorY: S.home.y, intensity: 0.9 });
      // no generic shock ring: the dial's own gold pulse and the bearing line are the lock's rings
      void freeze(sc, 40);
      void shake(sc, 90, 1);
      void u.badge.pop();
    },
    { late: false },
  );
  atFrame(
    u,
    'summon',
    LOCK + 1,
    () => {
      play('polarNeedleUnfold', { volume: 0.8, pan });
      void dial.fade(360);
    },
    { late: false },
  );
  await p.done;
  snd.spin?.stop(40);
  void pool.fadeOut(260);
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
  { priority: 20, name: 'd:polar_needle:summon' },
);

// ================================================================ strike

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    const sc = s.scene;
    const spr = u.sprite;
    seedFx(u.uid * 41 + (s.target?.uid ?? 3));
    const res = (s.ctx.ev as BattleEv).result;
    const loses = res === 'attackerDestroyed' || res === 'bothDestroyed';
    const sgn: 1 | -1 = u.flipX ? -1 : 1;
    const pan = panAt(u.home.x);
    const f0 = strikeStartFrame(u);
    const REL = u.markFrame('attack', 'release', 6);
    const CON = u.markFrame('attack', 'contact', REL + 1);
    const home: XY = { ...u.rest0 };
    // ---- the target's box: where the brackets close
    const box = s.target && s.target.sprite.active ? worldBox(s.target) : null;
    const at: XY = box ? { x: Math.round(box.cx), y: Math.round(s.to.y) } : { x: Math.round(s.to.x), y: Math.round(s.to.y) };
    const half = box ? clamp(Math.round(box.w / 2) - 3, 8, 18) : 12;
    const hh = box ? clamp(Math.round(box.h / 2) - 2, 12, 22) : 18;
    const bdepth = DEPTH.FX - 2;
    const clampB = brackets(sc, { at, half, h: hh, side: (sgn as 1 | -1), depth: bdepth });
    // ---- the aim: the declaration's gathering goes on, the bearing marches to the target
    const charge = takeCharge(u, 'polarNeedleCharge', { volume: 0.85, pan });
    const bearing = bearingLine(sc, u.home, s.toGround);
    atFrame(u, 'attack', Math.max(f0 + 1, 2), () => {
      clampB.appear();
      play('polarNeedleBracket', { volume: 0.8, pan: panAt(at.x) });
    }, { late: true });
    atFrame(u, 'attack', 4, () => {
      clampB.clamp();
      play('polarNeedleClamp', { volume: 0.9, pan: panAt(at.x) });
      void lightFlash(sc, at.x, at.y, PAL.fire3, 24, 220, { floorY: s.toGround.y, intensity: 0.6 });
    }, { late: true });
    await u.playRange('attack', f0, REL);
    // ---- release: the lunge
    charge.stop(30);
    bearing.stop();
    play('polarNeedleLunge', { volume: 0.9, pan });
    // where the feet go so the spear point (contact frame) reaches the aim point
    const off = needleOffset(u, 'spear', 'attack', CON);
    const dir = norm({ x: s.toGround.x - u.home.x, y: s.toGround.y - u.home.y });
    const inset = s.blocked ? 9 : s.direct ? 2 : -2;
    const aim: XY = s.blocked || !s.target ? { x: at.x - dir.x * (half + 2), y: at.y } : at;
    const feet: XY = { x: Math.round(aim.x - dir.x * inset - off.x), y: Math.round(aim.y - dir.y * inset - off.y) };
    const feetHome: XY = { x: home.x, y: home.y + u.hover };
    const dist = Math.hypot(feet.x - feetHome.x, feet.y - feetHome.y);
    const dashMs = Math.round(clamp(dist * 1.05, 90, s.direct ? 240 : 200));
    const tDepth = s.target && s.target.sprite.active ? s.target.sprite.depth + 0.5 : 0;
    const place = (p: XY) => {
      if (!spr.active || u.retired) return;
      spr.setPosition(Math.round(p.x), Math.round(p.y - u.hover));
      spr.setDepth(Math.max(unitDepth(p.y), tDepth));
    };
    const tipNow = (): XY => needlePoint(u, 'spear') ?? { x: spr.x, y: spr.y };
    const trailFrom = tipNow();
    void lungeTrail(sc, trailFrom, tipNow, DEPTH.FX - 3, dashMs);
    await animate(sc, dashMs, (t) => {
      const e = 0.55 * t + 0.45 * t * t;
      place({ x: feetHome.x + (feet.x - feetHome.x) * e, y: feetHome.y + (feet.y - feetHome.y) * e });
    });
    place(feet);
    // ---- contact: through the brackets
    if (spr.active && !u.claimed) u.pose('attack', CON);
    const tip = tipNow();
    const hitAt: XY = s.blocked ? tip : s.direct ? { x: Math.round(s.to.x), y: Math.round(s.to.y) } : at;
    s.impact(hitAt);
    if (s.blocked) {
      play('polarNeedleDeflect', { volume: 0.9, pan: panAt(tip.x) });
      clampB.bounce();
      void lightFlash(sc, tip.x, tip.y, PAL.water4, 20, 240, { floorY: s.toGround.y, intensity: 0.7 });
    } else {
      play('polarNeedlePierce', { volume: 0.95, pan: panAt(hitAt.x) });
      clampB.shatter(s.toGround.y);
      pierceFlash(sc, hitAt, { x: sgn, y: 0 }, DEPTH.FX + 1, s.toGround.y, s.direct);
    }
    void sleep(sc, 400).then(() => clampB.destroy());
    // a melee loser is claimed on the contact frame and dies right there (battle.ts); a blocked survivor's
    // recoil only takes the animation (pin: false) — we still carry it home
    if (loses || !spr.active || u.retired) return;
    await sleep(sc, u.frameMs('attack', CON));
    if (!spr.active || u.retired) return;
    if (s.blocked) {
      // thrown back off the guard: the battle's recoil plays the hit pose; we carry it home
      const kick: XY = { x: feet.x - dir.x * 10, y: feet.y - dir.y * 10 };
      await animate(sc, 90, (t) => place({ x: feet.x + (kick.x - feet.x) * t, y: feet.y + (kick.y - feet.y) * t }));
      await animate(sc, 260, (t) => {
        const e = t * (2 - t);
        place({ x: kick.x + (feetHome.x - kick.x) * e, y: kick.y + (feetHome.y - kick.y) * e });
      });
    } else {
      // the recovery frames draw the spear back while the needle steps home
      if (!u.claimed) u.pose('attack', CON + 1);
      await sleep(sc, u.frameMs('attack', CON + 1));
      const back = u.rangeMs('attack', CON + 2, u.frameCount('attack'));
      void u.playRange('attack', CON + 2);
      await animate(sc, Math.max(220, Math.round(back * 0.8)), (t) => {
        const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
        place({ x: feet.x + (feetHome.x - feet.x) * e, y: feet.y + (feetHome.y - feet.y) * e });
      });
    }
    place(feetHome);
    if (spr.active) spr.setDepth(unitDepth(u.home.y));
  },
  { priority: 20, name: 'd:polar_needle:strike' },
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
    seedFx(u.uid * 53 + 7);
    const feet = u.worldPoint('feet');
    const ground: XY = { x: Math.round(feet.x), y: Math.round(feet.y) };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    const pan = panAt(ground.x);
    // the seize is scored here (not as the voice's deathStart): a lethal recoil often joins the pose past f1, and
    // the grip must still be heard before the rip
    atFrame(
      u,
      'death',
      1,
      () => {
        play('polarNeedleSeize', { volume: 0.9, pan });
        forceGrip(sc, u, ground, Math.max(120, u.rangeMs('death', 1, 3)), dir);
      },
      { maxMs: 3000 },
    );
    atFrame(
      u,
      'death',
      2,
      () => {
        play('polarNeedleRip', { volume: 0.95, pan });
        const c = needlePoint(u, 'pivot', 'death', 1) ?? u.core();
        ripBurst(sc, c, ground.y, u.sprite.depth + 0.3);
        void shake(sc, 110, 2);
      },
      { maxMs: 3000 },
    );
    // the art lets the needle leave its frame after f5: from there it is our own spinning sprite
    const P5 = framePose('death', 5);
    const sk5 = skeleton(P5);
    atFrame(
      u,
      'death',
      6,
      () => {
        if (!u.sprite.active) return;
        const from = u.framePoint(sk5.nc[0], sk5.nc[1]);
        void flyingNeedle(sc, { from: { x: from.x - dir * 6, y: from.y - 12 }, deg: P5.ra, back: (-dir as 1 | -1), depth: DEPTH.FX + 2, flip: dir < 0 });
      },
      { maxMs: 3000 },
    );
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: () => shellPlates(sc, ground, dir, DEPTH.FX - 1),
    });
  },
  { priority: 20, name: 'd:polar_needle:death' },
);
