// Hurda Akıncıları (scrap_raiders, lane D, C5) — its own v3 summon, strike, death and its attack-then-defense
// position change (?look=v3 only; v1 falls through to the chain below every hook, byte-identical).
// Pieces: ./_scrap_raiders-fx.ts; sounds: src/audio/v3/raiders.ts.
//
// Summon "Hurda Yağmuru" (≈ 2.4 s at tempo): junk rains out of the sky onto the tile over a growing shadow
// (raidersScrapRain); the art's pile drops — 'land' (f1) CRASH: a tin avalanche, dust rolls out, shake 2
// (raidersHeapCrash); f2 the three goblins pop out of the heap "hey! hop! ya!" (raidersPop); three hammer blows
// (f4 / f6 / f8, raidersHammer pitched up each time, hot sparks off the wrench) build the tub, the wheels and the
// ram; f9 the stove catches — VUF: a fire burst out of the pipe, a black smoke ring, the fire light, the engine
// coughs to life (raidersVuf, the finale ring); f11 the war cheer (raidersCheer), two nuts tossed up in joy.
// Strike "Hurda Hücumu" (melee): the back-pedal f1–f3 — the engine revs (raidersRev, from the declaration),
// tyre sparks spat backwards, scorched skid marks, black exhaust; f4 off it goes (raidersLaunch: the slinger is
// thrown off the back with a falling "waaa!" and runs behind); a BOUNCING charge across the board (2–3 hops,
// raidersBounce + floor dust each landing, raidersRumble under it); contact f6 — the ram: hit-stop of the heavy
// class (≈ 110 ms), iron clank + 70 Hz thud (raidersRam), bolts, nuts and a gear fly and bounce on the marble;
// follow-through f7 — the front wheel works loose and spits a bolt (raidersLoose); it rolls home while the
// slinger jumps back in (raidersHop). Blocked: a dull bonk (raidersBonk), the debris flies back, a higher kick
// home. Direct: the charge crosses the field to the duelist.
// Position (the attack-then-defense rule, End Phase): the tired guard — the loose wheel wobbles, drops flat
// (raidersWheelOff, floor dust, black smoke), the wrench goblin hops out and kneels at the bare axle, sweat
// flies off three heads, the stove steams, three mouths pant (raidersPant), the padlock shows on the plate and
// the first repair taps ring (raidersTink). The guard loop IS the visible lock (the goblin hammering the axle).
// Lock end (the turn after the locked one starts): the last blow puts the wheel back on — BANG (raidersWheelOn),
// hot sparks, the padlock goes, a short cheer — then, still in defense, the crew drops the wheel again and goes
// back on watch (the art has one guard pose: the tired one). Back to attack (a later turn): the same BANG.
// Death: the art's pose (the tub shudders f1 — raidersCreak; it caves in f2; the goblins bail out three ways f3 —
// raidersFlee + dust at their feet; it sinks into its scrap f4 — raidersCollapse); on the burst frame the final
// material (§5.2 C5): rust plates slide out, gears roll and fall flat, a wheel rolls away and settles, the
// stove's last embers die. Camera never moves (EF-8).

import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { plateLock } from '../../engine';
import type { GameEvent, GameState, Uid } from '../../engine/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, unitDepth, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { animate, sleep } from '../../vfx/combat';
import { registerCardHook, registerEvent, registerStrike } from '../api';
import type { StrikeArgs } from '../_core/types';
import { strikeStartFrame } from '../_v3/clash';
import { deathV3 } from '../_v3/death';
import { summonPose } from '../_v3/summon';
import { atFrame, atMark, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath, worldBox } from '../strikes-b/_kit';
import { runSummon, type Stage } from '../summon-a/_kit';
import { capped } from '../summon-b/_kit';
import {
  FLOOR_DEPTH,
  Junk,
  fleeDust,
  hammerSparks,
  heapDust,
  looseBolt,
  raidersOffset,
  raidersPoint,
  ramDebris,
  scrapRain,
  scrapScatter,
  seedFx,
  skidMarks,
  smokePuffs,
  stoveBurst,
  sweatAndSteam,
  tyreSparks,
} from './_scrap_raiders-fx';

const ID = 'scrap_raiders';
/** The hologram onset's tones: rust iron. */
const SCRAP: Ramp = [PAL.night2, PAL.earth1, PAL.earth2, PAL.earth3, PAL.fire3];
type BattleEv = Extract<GameEvent, { type: 'battle' }>;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const norm = (p: XY): XY => {
  const l = Math.hypot(p.x, p.y) || 1;
  return { x: p.x / l, y: p.y / l };
};
const live = (u: MonsterUnit): boolean => u.sprite.active && !u.retired;

// ================================================================ summon

async function entranceV3(S: Stage): Promise<void> {
  const sc = S.scene;
  const u = S.unit;
  const pan = panAt(S.home.x);
  seedFx(u.uid * 29 + 5);
  // the scrap shower: junk falls out of the sky onto the tile, a shadow grows under it
  play('raidersScrapRain', { volume: 0.85, pan });
  await scrapRain(sc, S.home, S.depth + 0.5, 260);
  // a short onset (90 ms): the pile is seen falling, not a long scan
  const p = summonPose(sc, u, { ramp: SCRAP, holoMs: 90 });
  if (!p) return;
  const fire = S.glow({ color: PAL.fire3, radius: 22, intensity: 0.0, anim: 'flicker', fadeIn: 60 });
  // 'land' (f1): the pile crashes onto the tile
  atMark(u, 'summon', 'land', () => {
    play('raidersHeapCrash', { volume: 0.95, pan });
    heapDust(sc, S.home, 1.25, S.depth + 0.4);
    void shake(sc, 140, 2);
    void lightFlash(sc, S.home.x, S.home.y - 4, PAL.fire2, 26, 220, { floorY: S.home.y, intensity: 0.45 });
  });
  // f2: three goblins pop out of the heap
  atFrame(
    u,
    'summon',
    2,
    () => {
      play('raidersPop', { volume: 0.9, pan });
      heapDust(sc, { x: S.home.x, y: S.home.y }, 0.5, S.depth + 0.4);
    },
    { late: false },
  );
  // three hammer blows: the tub, the wheels, the ram + stove
  [4, 6, 8].forEach((f, i) => {
    atFrame(
      u,
      'summon',
      f,
      () => {
        play('raidersHammer', { volume: 0.85 + i * 0.05, pitch: 1 + i * 0.12, pan });
        const h = raidersPoint(u, 'hammer');
        if (h) hammerSparks(sc, h, 0.6 + i * 0.3, S.depth + 0.5, S.home.y);
        if (i === 2) void shake(sc, 60, 1);
      },
      { late: false },
    );
  });
  // f9: the stove catches — VUF
  atFrame(
    u,
    'summon',
    9,
    () => {
      play('raidersVuf', { volume: 0.95, pan });
      const top = raidersPoint(u, 'pipe') ?? { x: S.home.x - S.dir * 26, y: S.home.y - 46 };
      stoveBurst(sc, top, S.home.y, S.depth + 0.5, 1.1);
      fire.setIntensity(0.9, 40);
      S.finale({ ring: 50, ramp: RAMPS.fire, shake: 1, sfx: null, playerRing: false });
    },
    { late: false },
  );
  // f11: the war cheer, two nuts tossed up and caught again
  atFrame(
    u,
    'summon',
    11,
    () => {
      play('raidersCheer', { volume: 0.9, pan });
      fire.setIntensity(0.5, 200);
      const hs = [raidersPoint(u, 'sHead'), raidersPoint(u, 'wHead')];
      const pieces = hs.filter((h): h is XY => !!h).map((h, i) => ({ kind: 'nut' as const, x: h.x, y: h.y - 4, vx: (i ? 1 : -1) * 6, vy: -95, floor: h.y - 2, bounce: 0, spin: 14 }));
      if (pieces.length) void new Junk(sc, pieces, { cx: S.home.x, cy: S.home.y - 50, w: 90, h: 60 }, S.depth + 0.5, 520).done;
    },
    { late: false },
  );
  await p.done;
  void fire.fadeOut(300);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    if (ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx, entranceV3, entranceV3);
  },
  { priority: 20, name: 'd:scrap_raiders:summon' },
);

// ================================================================ strike "Hurda Hücumu"

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
    const SWING = 4;
    const REL = u.markFrame('attack', 'release', 5);
    const CON = u.markFrame('attack', 'contact', 6);
    const home: XY = { ...u.rest0 };
    const floorY = u.home.y;
    // ---- the back-pedal: the engine revs, the tyres spit sparks, black smoke (the declaration's rev goes on)
    const rev = takeCharge(u, 'raidersRev', { volume: 0.85, pan });
    const spit = (f: number) => {
      const r = raidersPoint(u, 'rear');
      if (r) tyreSparks(sc, { x: r.x - sgn * 3, y: floorY }, (-sgn) as 1 | -1, spr.depth + 0.3, 3 + f * 2);
      const pipe = raidersPoint(u, 'pipe');
      if (pipe) smokePuffs(sc, pipe, f === 3 ? 3 : 1, spr.depth + 0.2, (-sgn) as 1 | -1);
      if (f === 1 && r) skidMarks(sc, { x: r.x, y: floorY + 1 }, (-sgn) as 1 | -1, 9, 1600);
    };
    if (f0 >= 1 && f0 <= 3) spit(f0);
    for (const f of [1, 2, 3]) if (f > f0) atFrame(u, 'attack', f, () => spit(f), { late: false });
    if (f0 < SWING) await u.playRange('attack', f0, SWING - 1, { hold: true });
    if (!live(u)) {
      rev.stop(40);
      return;
    }
    // ---- where the sprite goes so the ram's tip (contact frame) meets the near side of the target
    const off = raidersOffset('ram', 'attack', CON, sgn);
    const box = s.target && s.target.sprite.active ? worldBox(s.target) : null;
    const dir = norm({ x: s.toGround.x - u.home.x, y: s.toGround.y - u.home.y });
    let aim: XY;
    if (s.direct || !box) aim = { x: Math.round(s.to.x - dir.x * 8), y: Math.round(s.to.y) };
    else {
      const edge = Math.round(box.w / 2) - 4 + (s.blocked ? 4 : 0);
      aim = { x: Math.round(box.cx - sgn * edge), y: Math.round(clamp(s.to.y, box.y + 6, box.y + box.h - 4)) };
    }
    const feet: XY = { x: Math.round(aim.x - off.x), y: Math.round(aim.y - off.y) };
    // the wheels stay on the floor: never lift the cart's ground line above the target's (the ram aims, not the cart)
    if (box && feet.y < floorY && feet.y < s.toGround.y - 6) feet.y = Math.round(Math.min(floorY, s.toGround.y) - 4);
    const dist = Math.hypot(feet.x - home.x, feet.y - home.y);
    const travelMs = Math.round(clamp(dist * 1.55, 280, s.direct ? 440 : 420));
    const hops = dist > 110 ? 3 : 2;
    const tDepth = s.target && s.target.sprite.active ? s.target.sprite.depth + 0.5 : 0;
    const place = (p: XY, lift = 0) => {
      if (!live(u)) return;
      spr.setPosition(Math.round(p.x), Math.round(p.y - lift));
      spr.setDepth(Math.max(unitDepth(p.y), tDepth));
    };
    // ---- off it goes: the slinger is thrown off the back and runs behind
    rev.stop(40);
    play('raidersLaunch', { volume: 0.75, pan });
    if (!u.claimed) u.pose('attack', SWING);
    const rumble = start('raidersRumble', { volume: 0.6, pan });
    let hop = 0;
    let rel = false;
    await animate(sc, travelMs, (t) => {
      // the cart accelerates (pedal + engine), bouncing on the uneven marble, each hop lower
      const e = t * t * 0.45 + t * 0.55;
      const ph = t * hops;
      const k = Math.floor(ph);
      const lift = Math.abs(Math.sin(Math.PI * ph)) * (6 - k * 1.5);
      place({ x: home.x + (feet.x - home.x) * e, y: home.y + (feet.y - home.y) * e }, lift);
      if (!rel && t >= 0.25) {
        rel = true;
        if (!u.claimed) u.pose('attack', REL);
      }
      if (k > hop && k < hops) {
        hop = k;
        play('raidersBounce', { volume: 0.75, pitch: 1 + k * 0.06, pan: panAt(spr.x) });
        heapDust(sc, { x: Math.round(spr.x), y: Math.round(spr.y) }, 0.45, spr.depth - 0.2);
        const pipe = raidersPoint(u, 'pipe');
        if (pipe) smokePuffs(sc, pipe, 1, spr.depth + 0.2, (-sgn) as 1 | -1);
      }
    });
    place(feet);
    if (!live(u)) {
      rumble.stop(30);
      return;
    }
    // ---- contact: the ram
    rumble.stop(20);
    if (!u.claimed) u.pose('attack', CON);
    const ram = raidersPoint(u, 'ram') ?? aim;
    const hitAt: XY = s.direct ? { x: Math.round(s.to.x), y: Math.round(s.to.y) } : ram;
    s.impact(hitAt);
    play(s.blocked ? 'raidersBonk' : 'raidersRam', { volume: 0.95, pan: panAt(hitAt.x) });
    ramDebris(sc, hitAt, sgn, { floorY: s.direct ? Math.round(s.toGround.y) : Math.round(Math.max(floorY, feet.y)), depth: DEPTH.FX - 1, big: s.direct, blocked: s.blocked });
    void lightFlash(sc, hitAt.x, hitAt.y, s.blocked ? PAL.gold3 : PAL.fire4, s.direct ? 34 : 26, 240, { floorY: Math.round(s.toGround.y), intensity: 0.85 });
    void shake(sc, 120, s.blocked ? 1 : 2);
    if (loses || !live(u)) return;
    await sleep(sc, u.frameMs('attack', CON));
    if (!live(u)) return;
    // ---- follow-through (the signature): the front wheel works loose and spits a bolt
    if (!u.claimed) u.pose('attack', CON + 1);
    play('raidersLoose', { volume: 0.85, pan: panAt(spr.x) });
    const fw = raidersPoint(u, 'front');
    if (fw) looseBolt(sc, fw, (s.blocked ? -sgn : sgn) as 1 | -1, Math.round(spr.y), spr.depth + 0.3);
    await sleep(sc, u.frameMs('attack', CON + 1));
    if (!live(u)) return;
    // ---- it rolls home (a higher kick off a guard), the slinger jumps back in on the way
    if (!u.claimed) u.pose('attack', CON + 2);
    const backMs = Math.round(clamp(dist * 1.1, 240, 380)) + (s.blocked ? 60 : 0);
    const bh = s.blocked ? 9 : 3;
    let hopped = false;
    await animate(sc, backMs, (t) => {
      const e = t * (2 - t);
      place({ x: feet.x + (home.x - feet.x) * e, y: feet.y + (home.y - feet.y) * e }, Math.abs(Math.sin(Math.PI * t)) * bh);
      if (!hopped && t >= 0.55) {
        hopped = true;
        if (!u.claimed) u.pose('attack', CON + 3);
        play('raidersHop', { volume: 0.8, pan: panAt(spr.x) });
      }
    });
    place(home);
    if (live(u)) spr.setDepth(unitDepth(u.home.y));
    play('raidersBounce', { volume: 0.55, pitch: 0.92, pan });
    heapDust(sc, u.home, 0.5, spr.depth - 0.2);
    if (!u.claimed) await u.playRange('attack', CON + 4);
  },
  { priority: 20, name: 'd:scrap_raiders:strike' },
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
    const pan = panAt(home.x);
    const dissolveF = u.markFrame('death', 'dissolve', 4);
    // f2: the tub caves in — a puff of black smoke out of the stove
    atFrame(
      u,
      'death',
      2,
      () => {
        const pipe = raidersPoint(u, 'pipe');
        if (pipe) smokePuffs(sc, pipe, 2, u.sprite.depth + 0.3, (-dir) as 1 | -1);
      },
      { maxMs: 3000 },
    );
    // f3: the goblins bail out three ways
    atFrame(
      u,
      'death',
      3,
      () => {
        play('raidersFlee', { volume: 0.9, pan });
        fleeDust(sc, u, home.y, u.sprite.depth + 0.3);
      },
      { maxMs: 3000 },
    );
    // dissolve (f4): the tub sinks into its own scrap
    atFrame(
      u,
      'death',
      dissolveF,
      () => {
        heapDust(sc, home, 1, u.sprite.depth + 0.3);
        void shake(sc, 100, 2);
      },
      { maxMs: 3000 },
    );
    return deathV3(ctx, {
      fallback: () => ctx.base(),
      onBurst: () => scrapScatter(sc, home, dir, DEPTH.FX - 1),
    });
  },
  { priority: 20, name: 'd:scrap_raiders:death' },
);

// ================================================================ position: the tired guard, the wheel back on

/** v3: the card's quarter turn (ms, as summon-b/position.ts). */
const TURN_V3 = 240;

function slotOf(s: GameState, uid: Uid) {
  for (const pl of s.players) for (const m of pl.monsters) if (m && m.uid === uid) return m;
  return null;
}

/** The repair taps on the first guard cycle (the visible lock starts to sound). */
function firstTaps(u: MonsterUnit): void {
  const pan = panAt(u.home.x);
  for (const f of [3, 7]) atFrame(u, 'guard', f, () => play('raidersTink', { volume: 0.7, pan }), { late: false, maxMs: 2500 });
}

/** The wheel drops off: toGuard with its beats (the loop after it is the tired guard). Resolves on guard f0. */
async function wheelOff(u: MonsterUnit, o: { soft?: boolean; lock?: () => void } = {}): Promise<void> {
  const sc = u.scene;
  const pan = panAt(u.home.x);
  const dir: 1 | -1 = u.flipX ? -1 : 1;
  atFrame(u, 'toGuard', 0, () => play('raidersLoose', { volume: o.soft ? 0.55 : 0.7, pan }), { maxMs: 2000 });
  atFrame(u, 'toGuard', 1, () => play('raidersWheelOff', { volume: o.soft ? 0.7 : 0.9, pan }), { late: false, maxMs: 2000 });
  atFrame(
    u,
    'toGuard',
    2,
    () => {
      const fw = raidersPoint(u, 'front');
      heapDust(sc, { x: fw ? fw.x : u.home.x + dir * 14, y: u.home.y }, 0.55, u.sprite.depth + 0.2);
      const pipe = raidersPoint(u, 'pipe');
      if (pipe) smokePuffs(sc, pipe, o.soft ? 1 : 3, u.sprite.depth + 0.2, (-dir) as 1 | -1);
    },
    { late: false, maxMs: 2000 },
  );
  atFrame(
    u,
    'toGuard',
    4,
    () => {
      o.lock?.();
      if (o.soft) return;
      play('raidersPant', { volume: 0.85, pan });
      const heads = (['sHead', 'pHead', 'wHead'] as const).map((w) => raidersPoint(u, w)).filter((h): h is XY => !!h);
      sweatAndSteam(sc, heads, raidersPoint(u, 'stove'), u.sprite.depth + 0.3, u.home.y);
    },
    { late: false, maxMs: 2000 },
  );
  if (!o.soft) firstTaps(u);
  await u.playRange('toGuard', 0, undefined, { hold: true });
  if (live(u)) u.rest();
}

/** The last blow puts the wheel back on: fromGuard with its beats. Resolves on idle f0 (held). */
async function wheelOn(u: MonsterUnit, o: { unlock?: () => void } = {}): Promise<void> {
  const sc = u.scene;
  const pan = panAt(u.home.x);
  atFrame(
    u,
    'fromGuard',
    0,
    () => {
      play('raidersHammer', { volume: 0.8, pitch: 0.9, pan });
      const h = raidersPoint(u, 'hammer');
      if (h) hammerSparks(sc, h, 0.7, u.sprite.depth + 0.3, u.home.y);
    },
    { maxMs: 2000 },
  );
  atFrame(
    u,
    'fromGuard',
    2,
    () => {
      play('raidersWheelOn', { volume: 0.95, pan });
      o.unlock?.();
      const fw = raidersPoint(u, 'front');
      if (fw) hammerSparks(sc, fw, 1.2, u.sprite.depth + 0.3, u.home.y);
      heapDust(sc, { x: fw ? fw.x : u.home.x, y: u.home.y }, 0.5, u.sprite.depth + 0.2);
      const pipe = raidersPoint(u, 'pipe');
      if (pipe) smokePuffs(sc, pipe, 2, u.sprite.depth + 0.2);
      void lightFlash(sc, u.home.x, u.home.y - 10, PAL.fire3, 26, 260, { floorY: u.home.y, intensity: 0.55 });
    },
    { late: false, maxMs: 2000 },
  );
  await u.playRange('fromGuard', 0, undefined, { hold: true });
}

registerEvent(
  'positionChange',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    if (ctx.cardId(ev.uid) !== ID) return ctx.base();
    const u = ctx.unit(ev.uid);
    if (!u || u.retired || !u.sprite.visible || !u.has('toGuard') || !u.has('fromGuard')) return ctx.base();
    const tile = ctx.tile(ev.uid);
    const toDef = ev.position === 'defense';
    const o = toDef ? 'side' : 'up';
    seedFx(u.uid * 61 + ctx.state.turn);
    const s = u.sprite;
    u.posed = true;
    try {
      ctx.sfx('cardSlide', { volume: 0.55 });
      const jobs: Promise<unknown>[] = [];
      if (tile && tile.orientation !== o) jobs.push(tile.rotateTo(o, TURN_V3));
      u.position = ev.position;
      u.badge.setPosition(ev.position);
      if (toDef) {
        // the padlock shows when the crew has slumped (the rules lock it with this very change)
        const slot = slotOf(ctx.after, ev.uid);
        const lock = slot ? plateLock(ctx.after, slot) : null;
        jobs.push(wheelOff(u, { lock: () => u.setLock(lock) }));
      } else {
        jobs.push(
          wheelOn(u, { unlock: () => void u.badge.pop() }).then(() => {
            if (live(u)) u.rest();
          }),
        );
      }
      await capped(ctx.scene, Promise.all(jobs), 900);
    } finally {
      u.posed = false;
      if (s.active && !u.retired) {
        s.setScale(1).setPosition(u.rest0.x, u.rest0.y);
        const want = u.position === 'defense' ? 'guard' : 'idle';
        const cur = u.frameInfo().anim;
        if (cur !== want || !s.anims.isPlaying) u.rest();
      }
    }
  },
  { priority: 20, name: 'd:scrap_raiders:position' },
);

// The lock ends when the turn after the locked one starts (engine plateLock: turn > lockPositionTurn): the
// repairing goblin's last blow puts the wheel back on, the padlock goes. Played before the turn banner.
registerEvent(
  'turnStart',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const st = ctx.state;
    const due: MonsterUnit[] = [];
    for (const pl of st.players)
      for (const m of pl.monsters) {
        if (!m || !m.faceUp || m.position !== 'defense' || m.lockPositionTurn === undefined) continue;
        if (m.lockPositionTurn !== st.turn || ctx.ev.turn <= m.lockPositionTurn) continue;
        if (ctx.cardId(m.uid) !== ID) continue;
        const u = ctx.unit(m.uid);
        if (u && live(u) && u.sprite.visible && u.has('fromGuard') && u.has('toGuard')) due.push(u);
      }
    if (!due.length) return ctx.base();
    await capped(
      ctx.scene,
      Promise.all(
        due.map(async (u) => {
          seedFx(u.uid * 71 + st.turn);
          u.posed = true;
          try {
            await wheelOn(u, {
              unlock: () => {
                u.setLock(null);
                play('raidersCheer', { volume: 0.7, pan: panAt(u.home.x) });
              },
            });
            if (!live(u)) return;
            // a beat on its wheels, then — still in defense — the crew drops the wheel again and goes back on watch
            await u.playRange('idle', 0, 2, { hold: true });
            if (!live(u)) return;
            await wheelOff(u, { soft: true });
          } finally {
            u.posed = false;
            if (live(u)) u.rest();
          }
        }),
      ),
      2200,
    );
    return ctx.base();
  },
  { priority: 20, name: 'd:scrap_raiders:lockEnd' },
);
