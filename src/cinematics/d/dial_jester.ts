// Kadran Soytarısı (dial_jester, lane D, C2) — its own v3 summon, strike and death (?look=v3 only; v1 falls through
// to the chain below every hook, byte-identical). The effect, the coin toss and the rewind wipe: ./dial_jester-coin.ts.
// Pieces: ./_dial_jester-fx.ts; sounds: src/audio/v3/jester.ts.
//
// Summon (≈ 2.0 s at tempo): a giant dial is reflected on the tile and its hands race BACKWARDS to midnight
// (jesterDialRewind); the art's f1 is midnight — the bell (jesterMidnight: glassBell 880 + 1320 over a brass dong),
// the dial flashes white, a gold floor flash; 'land' (f2) the jester pops out of the dial's centre on its coil
// spring like a cuckoo (jesterPop, a fountain of gold ticks), three damped bounces on f4 / f6 / f8 (jesterBounce,
// softer and higher each time, floor puffs and floor-light blinks), the badge on the last one, and the bow on f10
// (jesterBow, a glint on the coin).
// Strike "Kurmalı Takla" (melee): the key is wound three turns (f1–f3: jesterCrank + a ratchet spit of brass ticks
// each turn) while the watch ticks faster and faster (jesterCharge, from the declaration); f4 locked, trembling;
// f5 the spring lets go (jesterSpring) and the jester somersaults over the board in a high arc (f5 / f6 pixel
// frames, gold afterimages, a dotted gold trail; jesterFlip on the release frame); f7 contact — the coin's EDGE
// strikes (jesterCoinEdge): the ticking stops dead, a little clock face with both hands frozen at 12 pops on the
// struck point and holds through the hit-stop (medium class), then it ticks apart; it springs back home in a
// lower arc and lands (jesterLandBack). Blocked: the coin glances off (jesterBlocked), a cracked clock face, a
// bigger kick back. Direct: the somersault crosses the field to the duelist, a bigger clock face.
// Death: the art's pose (glass cracks f1 — jesterCrack; springs burst f4 — jesterSprings; a cog drops f5 and the
// last tick f6 — jesterGear / jesterLastTick, a 1-px ring pulse on the dial); on the burst frame the final
// material (§5.2 C2): cogs roll off over the marble and fall flat, two coil springs bounce away, glass glints.
// Camera never moves (EF-8).

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import type { GameEvent } from '../../engine/types';
import { DEPTH, LOOK_V3, unitDepth, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { Sparks, animate, sleep } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath, worldBox } from '../strikes-b/_kit';
import { afterimage, runSummon, type Stage } from '../summon-a/_kit';
import { FLOOR_DEPTH, bounceDust, clockStamp, crankSparks, flipTrail, gearsAndSprings, jesterOffset, jesterPoint, popBurst, seedFx, tileDial } from './_dial_jester-fx';

const ID = 'dial_jester';
/** The hologram onset's tones: brass. */
const BRASS: Ramp = [PAL.night2, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const norm = (p: XY): XY => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 29 + 11);
  const dial = S.own(tileDial(sc, S.home, FLOOR_DEPTH, 1.2));
  const pool = S.glow({ color: PAL.gold3, radius: 24, intensity: 0.45, anim: 'breathe', fadeIn: 140 });
  // the dial is reflected on the tile; its hands race BACKWARDS to midnight (accelerating, they slam on 12)
  play('jesterDialRewind', { volume: 0.85, pan });
  const H0 = 305 + 720;
  const M0 = 60 + 360 * 4;
  await animate(sc, 360, (t) => {
    const e = Math.pow(t, 1.6);
    dial.set({ k: Math.min(1, t * 3), hour: H0 * (1 - e), min: M0 * (1 - e) });
  });
  dial.set({ k: 1, hour: 0, min: 0 });
  const p = summonPose(sc, u, { ramp: BRASS, holoMs: 90 });
  if (!p) {
    dial.destroy();
    return;
  }
  // f1 midnight: the bell
  atFrame(
    u,
    'summon',
    1,
    () => {
      play('jesterMidnight', { volume: 0.95, pan });
      dial.set({ k: 1, hour: 0, min: 0, hot: 1 });
      pool.setIntensity(1.1, 40);
      void lightFlash(sc, S.home.x, S.home.y - 2, PAL.white, 30, 220, { floorY: S.home.y, intensity: 0.8 });
    },
    { late: false },
  );
  // 'land' (f2): the cuckoo pops out of the dial's centre
  atMark(u, 'summon', 'land', () => {
    play('jesterPop', { volume: 0.95, pan });
    dial.set({ k: 0.85, hour: 0, min: 0 });
    popBurst(sc, { x: S.home.x, y: S.home.y - 6 }, S.home.y, S.depth + 0.5);
    pool.setIntensity(0.8, 120);
    void shake(sc, 60, 1);
  });
  atFrame(u, 'summon', 3, () => dial.set({ k: 0.55, hour: 0, min: 0 }), { late: false });
  // three damped bounces
  const bounces: [number, number, number][] = [
    [4, 0.85, 1],
    [6, 0.6, 1.12],
    [8, 0.42, 1.25],
  ];
  for (const [f, vol, pitch] of bounces) {
    atFrame(
      u,
      'summon',
      f,
      () => {
        play('jesterBounce', { volume: vol, pitch, pan });
        bounceDust(sc, S.home, vol, S.depth + 0.4);
        if (f === 4) dial.set({ k: 0.3, hour: 0, min: 0 });
        if (f === 6) dial.destroy();
        if (f === 8) S.finale({ ring: 44, ramp: RAMPS.gold, shake: 0, sfx: null, playerRing: false });
      },
      { late: false },
    );
  }
  // the bow (f10): the coin catches the light
  atFrame(
    u,
    'summon',
    10,
    () => {
      play('jesterBow', { volume: 0.8, pan });
      const c = jesterPoint(u, 'coin');
      if (c) {
        const sp = new Sparks(sc, S.depth + 0.6);
        sp.add({ x: c.x - 1, y: c.y - 2, life: 260, colors: [PAL.white, PAL.gold4], shape: 'star', size: 3, fadeAt: 0.7 });
        sp.release();
      }
    },
    { late: false },
  );
  await p.done;
  dial.destroy();
  void pool.fadeOut(260);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx, entranceV3, entranceV3);
  },
  { priority: 20, name: 'd:dial_jester:summon' },
);

// ================================================================ strike "Kurmalı Takla"

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
    const LAUNCH = 5;
    const REL = u.markFrame('attack', 'release', 6);
    const CON = u.markFrame('attack', 'contact', 7);
    const home: XY = { ...u.rest0 };
    // ---- the wind-up: three turns of the key, the watch ticking faster (the declaration's tick goes on)
    const charge = takeCharge(u, 'jesterCharge', { volume: 0.8, pan });
    const crank = () => {
      play('jesterCrank', { volume: 0.85, pan });
      const k = jesterPoint(u, 'key');
      if (k) crankSparks(sc, k, -sgn, spr.depth + 0.3);
    };
    if (f0 >= 1 && f0 <= 3) crank();
    for (const f of [1, 2, 3]) if (f > f0) atFrame(u, 'attack', f, crank, { late: false });
    if (f0 < LAUNCH) await u.playRange('attack', f0, LAUNCH - 1, { hold: true });
    if (!spr.active || u.retired) {
      charge.stop(40);
      return;
    }
    // ---- where the feet go so the coin's edge (contact frame) meets the near side of the target
    const off = jesterOffset(u, 'coin', 'attack', CON);
    const box = s.target && s.target.sprite.active ? worldBox(s.target) : null;
    const dir = norm({ x: s.toGround.x - u.home.x, y: s.toGround.y - u.home.y });
    let aim: XY;
    if (s.direct || !box) aim = { x: Math.round(s.to.x - dir.x * 6), y: Math.round(s.to.y) };
    else {
      const edge = Math.round(box.w / 2) - 3 + (s.blocked ? 5 : 0);
      aim = { x: Math.round(box.cx - sgn * edge), y: Math.round(clamp(s.to.y, box.y + 6, box.y + box.h - 4)) };
    }
    const feetHome: XY = { x: home.x, y: home.y + u.hover };
    const feet: XY = { x: Math.round(aim.x - off.x), y: Math.round(aim.y - off.y) };
    // the feet stay on the floor line between the tiles (the arc carries the body)
    const dist = Math.hypot(feet.x - feetHome.x, feet.y - feetHome.y);
    const flyMs = Math.round(clamp(dist * 1.25, 230, s.direct ? 420 : 360));
    const H = Math.round(clamp(22 + dist * 0.12, 26, 44));
    const tDepth = s.target && s.target.sprite.active ? s.target.sprite.depth + 0.5 : 0;
    const place = (p: XY, lift = 0) => {
      if (!spr.active || u.retired) return;
      spr.setPosition(Math.round(p.x), Math.round(p.y - u.hover - lift));
      spr.setDepth(Math.max(unitDepth(p.y), tDepth));
    };
    // ---- the spring lets go: a somersault in a high arc
    play('jesterSpring', { volume: 0.9, pan });
    u.pose('attack', LAUNCH);
    flipTrail(sc, () => jesterPoint(u, 'coin'), flyMs, DEPTH.FX - 3);
    let released = false;
    let lastEcho = -99;
    await animate(sc, flyMs, (t, el) => {
      const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
      const lift = Math.sin(Math.PI * Math.min(1, t * 1.05)) * H;
      place({ x: feetHome.x + (feet.x - feetHome.x) * e, y: feetHome.y + (feet.y - feetHome.y) * e }, lift);
      if (!released && t >= 0.4) {
        released = true;
        if (!u.claimed) u.pose('attack', REL);
        play('jesterFlip', { volume: 0.85, pan: panAt(spr.x) });
      }
      if (el - lastEcho >= 45 && t > 0.08 && t < 0.92) {
        lastEcho = el;
        afterimage(sc, spr, PAL.gold2, { alpha: 0.5, ms: 160, depth: spr.depth - 0.3 });
      }
    });
    place(feet);
    // ---- contact: the coin's edge — the ticking stops dead, the hands freeze at 12
    if (spr.active && !u.claimed) u.pose('attack', CON);
    charge.stop(0);
    const coinAt = jesterPoint(u, 'coin') ?? aim;
    const hitAt: XY = s.direct ? { x: Math.round(s.to.x), y: Math.round(s.to.y) } : coinAt;
    s.impact(hitAt);
    play(s.blocked ? 'jesterBlocked' : 'jesterCoinEdge', { volume: 0.95, pan: panAt(hitAt.x) });
    clockStamp(sc, hitAt, { depth: DEPTH.FX + 2, big: s.direct, cracked: s.blocked });
    void lightFlash(sc, hitAt.x, hitAt.y, s.blocked ? PAL.water3 : PAL.gold4, s.direct ? 30 : 22, 220, { floorY: s.toGround.y, intensity: 0.75 });
    if (loses || !spr.active || u.retired) return;
    await sleep(sc, u.frameMs('attack', CON));
    if (!spr.active || u.retired) return;
    if (!u.claimed) u.pose('attack', CON + 1);
    await sleep(sc, u.frameMs('attack', CON + 1));
    if (!spr.active || u.retired) return;
    // ---- it springs back home: a lower arc (bigger kick off a guard)
    const backMs = Math.round(clamp(dist * 1.05, 220, 340)) + (s.blocked ? 40 : 0);
    const bh = s.blocked ? 30 : 20;
    if (!u.claimed) u.pose('attack', CON + 2);
    await animate(sc, backMs, (t) => {
      const e = t * (2 - t);
      place({ x: feet.x + (feetHome.x - feet.x) * e, y: feet.y + (feetHome.y - feet.y) * e }, Math.sin(Math.PI * t) * bh);
    });
    place(feetHome);
    if (spr.active) spr.setDepth(unitDepth(u.home.y));
    play('jesterLandBack', { volume: 0.8, pan });
    bounceDust(sc, u.home, 0.6, spr.depth + 0.4);
    if (!u.claimed) await u.playRange('attack', CON + 3);
  },
  { priority: 20, name: 'd:dial_jester:strike' },
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
    const home = { ...u.home };
    const dir: 1 | -1 = u.flipX ? -1 : 1;
    // f2: the glass splits — a white glint on the dial
    atFrame(
      u,
      'death',
      2,
      () => {
        const h = jesterPoint(u, 'head');
        if (h) void lightFlash(sc, h.x, h.y, PAL.white, 14, 160, { floorY: home.y, intensity: 0.6 });
      },
      { maxMs: 3000 },
    );
    // dissolve (f4): the springs burst out of the dial
    atFrame(
      u,
      'death',
      u.markFrame('death', 'dissolve', 4),
      () => {
        const h = jesterPoint(u, 'head') ?? u.core();
        const sp = new Sparks(sc, u.sprite.depth + 0.4);
        for (let i = 0; i < 8; i++) sp.add({ x: h.x, y: h.y, vx: (i % 2 ? 1 : -1) * (30 + i * 9), vy: -60 - i * 6, ay: 280, life: 360, colors: [PAL.mist, PAL.stone4, PAL.gold3], shape: 'px', fadeAt: 0.8 });
        sp.release();
        void shake(sc, 80, 1);
      },
      { maxMs: 3000 },
    );
    // f6: the last tick — one 1-px ring pulse round the dial
    atFrame(
      u,
      'death',
      6,
      () => {
        const h = jesterPoint(u, 'head');
        if (!h) return;
        const sp = new Sparks(sc, u.sprite.depth + 0.4);
        sp.add({ x: h.x, y: h.y, size: 6, grow: 40, life: 200, colors: [PAL.white, PAL.gold3], shape: 'ring', fadeAt: 0.5 });
        sp.release();
      },
      { maxMs: 3000 },
    );
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: () => gearsAndSprings(sc, home, dir, DEPTH.FX - 1),
    });
  },
  { priority: 20, name: 'd:dial_jester:death' },
);
