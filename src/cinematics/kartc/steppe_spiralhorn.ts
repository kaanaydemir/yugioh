// Bozkır Boynuzlusu (steppe_spiralhorn, C11) — the card's own v3 presentation (docs/v3/oturum-c-tasarim.md §2.5,
// YENI_KARTLAR C11, §5.2). v3 look only: every handler starts with `if (!LOOK_V3) …base()`, so v1 is untouched.
// Rhythm word: *rear – bound, bound, BOUND – toss*.
//
//   strike "Bozkır Sıçrayışı"
//     rear     the declaration's held charge (attack f1, the snort) → f2–f3: he rears on the hind legs, the forehooves
//              paw the air twice (sshPaw), the horn-tip curls peel off (the art)
//     bounds   THREE airborne bounds, each higher and longer (220 / 260 / 300 ms; ≈ 11 / 17 / 26 px above the floor):
//              drawn take-off / tuck / reach frames; at each take-off a grass-wake fan springs out of the floor behind
//              the hooves (world space: it stays on the floor), at each apex a two-turn spiral curl peels off the horn
//              tips and trails back, and the flute fragment rises 880 / 988 / 1175 Hz; bounds 1–2 land on the hoof tips
//              (a 2-px dust tick, two hoof ticks). No rings, no afterimages.
//     toss     bound 3 comes down head-low with the horns levelled (f9, release, the falling air) and drives them UP
//              and through at contact (f10): the keratin crack, s.impact() (the kit's flash / number / reaction),
//              hit-stop 80, a small stepped white floor light, and the SEED BURST: 14 feather-grass seeds spray up and
//              out of the contact point and glide down slowly, drifting away from him (≥ 900 ms), landing and blinking
//              out in steps; a few catch a gold4 glint
//     rebound  one high back-bound off the target (f11), a low bound home (hoof ticks + grass), the head shake (f13)
//     blocked  the horns lock against the guard (a double clack), he is shoved back 4 px sliding on his hooves, three
//              blades spring up at the slide — no seeds — and he bounds home
//     direct   the three bounds across the field and the toss at the duelist plate (seed burst there)
//   summon     a gust sweeps across the tile from his entry side and the grass GROWS in a travelling wave (three heights,
//              white seedheads); he enters from OFF SCREEN (P1 from the left edge, P2 from the right) in ONE long high
//              bound (apex ≈ 40 px over the tile, drawn tucked jump frames, 2–3 seeds trailing; the flute rises A5 → D6
//              at the apex); he lands on the hoof tips (four ticks), the grass flattens outward in a crescent and
//              springs back, 1 px shake; a light rear with the horns to the sky — the honk and the flute — seeds lift
//              off the grass; the tile grass recedes in three steps
//   death      (decoration of the recipe's deathV3 on the art's pose: kneel → grass → wind → plumes) the two fold thuds
//              (forelegs, then hind legs), the seed stream carried on leeward (backward, away from the killer) past the frame edge, climbing, and the
//              horns lifting off as two long seed plumes when the body goes
//   struck     hide + horn: sshStruck / sshStruckHeavy on the contact frame instead of the generic body blow; the guard
//              (pike fence) answers with the horn clack (also when he lowers the horns into the guard)
// Camera: never touched (EF-8). No setScale / setAngle. Sounds fire on the frames they belong to (the scene clock).

import type Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import { monsterFrame } from '../../art/textures';
import { AX, GY, skeleton } from '../../art/monsters-v3/steppe_spiralhorn-rig';
import { AF, framePoints, framePose } from '../../art/monsters-v3/steppe_spiralhorn-anims';
import { APEX_PITCH } from '../../audio/v3/steppe_spiralhorn';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, unitDepth, type XY } from '../../view/layout';
import { lightFlash } from '../../view/light';
import { shake } from '../../vfx/core';
import { animate, onFrame, setCombatSfx, sleep, stopTime } from '../../vfx/combat';
import { registerCardHook, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { warmPoses } from '../_v3/warm';
import { atFrame, fade, hush, panAt, play, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage, type SummonCtx } from '../summon-a/_kit';
import { GrassPatch, SeedStream, dustTick, hornCurl, plumes, rng, seedBurst, wakeFan } from './steppe_spiralhorn-fx';

const ID: MonsterId = 'steppe_spiralhorn';
const R = Math.round;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

/** +1: faces right (player 1), −1: faces left (player 2). */
const sgnOf = (u: MonsterUnit): 1 | -1 => (u.flipX ? -1 : 1);

/** A frame point of `anim` f as an offset from the feet in WORLD orientation (flip aware). */
function offsetOf(u: MonsterUnit, p: { x: number; y: number }): XY {
  return { x: sgnOf(u) * (p.x - AX), y: p.y - GY };
}
function tipOffset(u: MonsterUnit, anim: AnyMonsterAnim, f: number): XY {
  return offsetOf(u, framePoints(anim, f).muzzle ?? { x: AX + 20, y: GY - 50 });
}

/** Hold one sheet frame (ignored while another cinematic claims the unit). */
function show(u: MonsterUnit, anim: AnyMonsterAnim, f: number): void {
  if (u.sprite.active && !u.locked) u.pose(anim, f);
}

/** Feet at `feet`, `lift` px off the floor (the shadow stays on the floor), depth by the feet (never below `minDepth`). */
function place(u: MonsterUnit, feet: XY, lift = 0, minDepth = -Infinity): void {
  const s = u.sprite;
  // a claim without a pin (the battle's recoil on a blocked attacker) takes the animation, not the position: the strike
  // still carries him; a pinned claim overrides this every frame anyway
  if (!s.active || u.retired) return;
  u.lift = Math.max(0, R(lift));
  s.setPosition(R(feet.x), R(feet.y - u.hover - lift));
  s.setDepth(Math.max(unitDepth(feet.y), minDepth));
}

/** The side of the target's body facing the attacker (`sgn` = the attacker's facing), else a step short of the aim. */
function frontOf(t: MonsterUnit | null, aim: XY, sgn: number): number {
  if (!t || !t.sprite.active) return aim.x - sgn * 8;
  try {
    const b = monsterFrame(t.cardId, 'idle', 0).bounds();
    if (!b) return aim.x - sgn * 8;
    const a = t.framePoint(b.x, 0).x;
    const c = t.framePoint(b.x + b.w, 0).x;
    const edge = sgn > 0 ? Math.min(a, c) : Math.max(a, c);
    return sgn > 0 ? Math.max(edge, aim.x - 24) : Math.min(edge, aim.x + 24);
  } catch {
    return aim.x - sgn * 8;
  }
}

function attackerLoses(s: StrikeArgs): boolean {
  const r = s.ctx.ev.result;
  return r === 'attackerDestroyed' || r === 'bothDestroyed';
}

/** World point of the near horn tip of `anim` f with the feet at `feet` (lifted `lift`). */
function tipAt(u: MonsterUnit, anim: AnyMonsterAnim, f: number, feet: XY, lift = 0): XY {
  const o = tipOffset(u, anim, f);
  return { x: R(feet.x + o.x), y: R(feet.y - lift + o.y) };
}

// ================================================================ the strike

interface Bound {
  /** the floor path of this bound, t 0 → 1 */
  path: (t: number) => XY;
  ms: number;
  /** sprite lift at the apex (the drawn tuck adds its own). */
  h: number;
  /** frames: take-off, apex, the descent. */
  up: number;
  apex: number;
  down: number;
  /** fraction of the bound shown as take-off / apex. */
  a: number;
  b: number;
}

/** One airborne bound on the scene clock; `onApex` fires once at the apex frame, `onDown` at the descent frame. */
async function bound(u: MonsterUnit, B: Bound, minDepth: (t: number) => number, onApex?: (at: XY, lift: number) => void, onDown?: () => void): Promise<XY> {
  const sc = u.scene;
  let apexDone = false;
  let downDone = false;
  let shown = -1;
  await animate(sc, B.ms, (t) => {
    if (!u.sprite.active) return;
    const f = t < B.a ? B.up : t < B.b ? B.apex : B.down;
    if (f !== shown) {
      shown = f;
      show(u, 'attack', f);
    }
    const p = B.path(t);
    const lift = B.h * 4 * t * (1 - t);
    place(u, p, lift, minDepth(t));
    if (!apexDone && t >= B.a) {
      apexDone = true;
      onApex?.(p, lift);
    }
    if (!downDone && t >= B.b) {
      downDone = true;
      onDown?.();
    }
  });
  const end = B.path(1);
  place(u, end, 0, minDepth(1));
  return end;
}

/** Hand the unit back to FieldView once nothing claims it any more (the battle's recoil / death own it until then). */
function releasePosed(u: MonsterUnit): void {
  if (!u.claimed) {
    u.posed = false;
    return;
  }
  // claimed (the recoil of a blocked attack, the death of a lost one): the death kit owns `posed` from here; anything
  // else hands him back as soon as the claim ends
  onFrame(u.scene, (_dt, el) => {
    if (u.retired || !u.sprite.active) return false;
    if (u.claimed && el < 4000) return true;
    if (u.frameInfo().anim !== 'death') {
      u.posed = false;
      u.settle();
    }
    return false;
  });
}

async function sicrayis(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const sgn = sgnOf(u);
  const home: XY = { ...u.home };
  const pan = panAt(home.x);
  const R0 = rng(u.uid * 53 + (s.target?.uid ?? 7) * 11 + (s.direct ? 3 : 0));
  const seedN = () => Math.floor(R0() * 1e6);
  const loses = attackerLoses(s);
  const target = s.direct ? null : s.target;
  const tDepth = target && target.sprite.active ? target.sprite.depth : -Infinity;
  const depth0 = u.sprite.depth;
  // the battle commits its state while he is in the air (the target dies, the LP move): FieldView.sync must not settle
  // him back onto his tile mid-strike (MonsterUnit.posed)
  u.posed = true;

  // ---- geometry: he lands BESIDE the target, on its own floor row (a step behind it in depth), with the levelled horn
  // tips of the scoop (f14) a few px short of the target's facing side — the toss then drives them up and through it
  const aim: XY = { x: s.toGround.x, y: s.toGround.y };
  const tip14 = tipOffset(u, 'attack', AF.scoop);
  const gap = s.blocked ? -1 : 3;
  const front = s.direct ? aim.x : frontOf(target, aim, sgn);
  let fx = front - sgn * gap - tip14.x;
  // never past the target's own feet (a very narrow body): at least a body-length back
  if (!s.direct) fx = sgn > 0 ? Math.min(fx, aim.x - 22) : Math.max(fx, aim.x + 22);
  const stop: XY = { x: R(fx), y: R(s.direct ? aim.y : aim.y - 3) };
  // the run-in: a straight charge with a slight bow toward the target's side (never a loop away from it)
  const dist = Math.hypot(stop.x - home.x, stop.y - home.y);
  let nrm: XY = dist > 0 ? { x: -(stop.y - home.y) / dist, y: (stop.x - home.x) / dist } : { x: 0, y: 1 };
  if (nrm.x * sgn < 0 || (nrm.x === 0 && nrm.y < 0)) nrm = { x: -nrm.x, y: -nrm.y };
  const sag = Math.min(8, dist * 0.12);
  const run = (t: number): XY => {
    const b = sag * 4 * t * (1 - t);
    return { x: lerp(home.x, stop.x, t) + nrm.x * b, y: lerp(home.y, stop.y, t) + nrm.y * b };
  };
  // the bounds lengthen: 26 % / 32 % / 42 % of the run
  const K = [0, 0.26, 0.58, 1];
  const P = K.map((k) => {
    const p = run(k);
    return { x: R(p.x), y: R(p.y) };
  });
  const seg = (i: number) => (t: number) => run(lerp(K[i], K[i + 1], t));
  const line = (a: XY, b: XY) => (t: number) => lerpXY(a, b, t);
  const curlDepth = Math.max(depth0, tDepth) + 0.6;
  const feetDepth = () => -Infinity;

  // ---- the rear: from the declaration's held charge (f1) through the full rear (f3); the snort goes on
  const ch = takeCharge(u, 'sshSnort', { volume: 0.85, pan });
  const held = strikeStartFrame(u);
  const gather = s.direct ? 30 : 40;
  try {
    // the rear: f2 (rising, the forehooves leave the floor) and f3 (the full rear, the paw)
    if (held < AF.rise && !s.direct) {
      show(u, 'attack', AF.rise);
      ch.stop(60);
      play('sshPaw', { volume: 0.8, pan });
      await sleep(sc, 100);
    }
    show(u, 'attack', AF.rear);
    ch.stop(60);
    play('sshPaw', { volume: 0.9, pan, pitch: 1.06 });
    await sleep(sc, s.direct ? 120 : 150);
    if (u.locked || !u.sprite.active) return;

    // ---- three bounds, each higher and longer, each with its own drawn take-off, apex and descent
    const takeoff = (at: XY, k: number, i: number) => {
      play('sshTakeoff', { volume: [0.7, 0.8, 0.95][i], pan: panAt(at.x), pitch: [1, 0.96, 0.92][i] });
      wakeFan(sc, { x: R(at.x - sgn * 8), y: R(at.y) }, sgn, k, seedN());
    };
    const apexAt = (i: number) => (p: XY, lift: number) => {
      play('sshApexFlute', { volume: [0.75, 0.8, 0.9][i], pan: panAt(p.x), pitch: APEX_PITCH[i] });
      // a curl off each horn tip, left behind in the air
      const f = [AF.apex1, AF.apex2, AF.apex3][i];
      const pts = framePoints('attack', f);
      const sk = skeleton(framePose('attack', f));
      const tips = [pts.muzzle ?? { x: AX, y: GY - 50 }, { x: R(sk.hornF.tip[0]), y: R(sk.hornF.tip[1]) }];
      tips.forEach((tp, j) => {
        const o = offsetOf(u, tp);
        const at = { x: R(p.x + o.x), y: R(p.y - lift + o.y) };
        if (j === 0) hornCurl(sc, at, sgn, curlDepth);
        else void sleep(sc, 60).then(() => hornCurl(sc, { x: at.x - sgn, y: at.y + 1 }, sgn, curlDepth));
      });
    };
    const land = (at: XY) => {
      play('sshHoofTick', { volume: 0.8, pan: panAt(at.x) });
      dustTick(sc, { x: R(at.x + sgn * 6), y: at.y }, sgn);
      dustTick(sc, { x: R(at.x - sgn * 9), y: at.y + 1 }, sgn);
    };
    // bound 1: 220 ms, low
    takeoff(P[0], 0, 0);
    await bound(u, { path: seg(0), ms: 220, h: 8, up: AF.up1, apex: AF.apex1, down: AF.down1, a: 0.26, b: 0.7 }, feetDepth, apexAt(0));
    land(P[1]);
    show(u, 'attack', AF.gather);
    await sleep(sc, gather);
    // bound 2: 260 ms, higher
    takeoff(P[1], 0.5, 1);
    await bound(u, { path: seg(1), ms: 260, h: 13, up: AF.up2, apex: AF.apex2, down: AF.down2, a: 0.24, b: 0.72 }, feetDepth, apexAt(1));
    land(P[2]);
    show(u, 'attack', AF.gather);
    await sleep(sc, gather + 10);
    // bound 3: 300 ms, the highest — the tightest tuck through the apex, the head drops only on the way down
    takeoff(P[2], 1, 2);
    await bound(u, { path: seg(2), ms: 300, h: 22, up: AF.up3, apex: AF.apex3, down: AF.down3, a: 0.22, b: 0.78 }, feetDepth, apexAt(2), () => play('sshDrop', { volume: 0.85, pan: panAt(stop.x) }));
    if (u.locked || !u.sprite.active) return;
    // the landing scoop: the horns levelled a few px short of the target — the beat before the toss
    show(u, 'attack', AF.scoop);
    place(u, stop, 0);
    play('sshHoofTick', { volume: 0.7, pan: panAt(stop.x), pitch: 0.94 });
    dustTick(sc, { x: R(stop.x - sgn * 9), y: stop.y + 1 }, sgn);
    if (s.blocked && !s.direct) {
      await blocked(s, stop, home, depth0, pan);
      return;
    }
    await sleep(sc, 70);
    if (u.locked || !u.sprite.active) return;
    // the drive begins: horns sweeping up through 60°
    show(u, 'attack', AF.toss0);
    await sleep(sc, 40);
    if (u.locked || !u.sprite.active) return;

    // ---- CONTACT: the horn toss, a 2-px lunge forward
    const lunge: XY = { x: stop.x + sgn * 2, y: stop.y };
    show(u, 'attack', AF.contact);
    place(u, lunge, 0);
    const tip = tipAt(u, 'attack', AF.toss0, lunge);
    const hitAt: XY = target && target.sprite.active ? { x: R(lerp(tip.x, target.core().x, 0.3)), y: R(Math.max(tip.y, target.core().y - 8)) } : s.to;
    // his own hide-on-horn scores the contact: the shared body blow never sounds under it (§0.2)
    const SHARED = ['impactHeavy', 'impactLight', 'shieldBlock'] as const;
    hush([...SHARED], () => s.impact(hitAt));
    fade([...SHARED], 0);
    queueMicrotask(() => fade([...SHARED], 0));
    void sleep(sc, 1).then(() => fade([...SHARED], 0));
    play('sshHornCrack', { volume: 1, pan: panAt(hitAt.x) });
    play('sshSeedBurst', { volume: 0.9, pan: panAt(hitAt.x) });
    void stopTime(sc, 80);
    void lightFlash(sc, hitAt.x, hitAt.y, PAL.white, 10, 140, { floorY: aim.y, intensity: 0.6 });
    // the seed burst blooms one frame after the flash (never hidden under it)
    const burstAt = { x: R(hitAt.x), y: R(hitAt.y - 2) };
    const burstSeed = seedN();
    void sleep(sc, 34).then(() => seedBurst(sc, burstAt, R(aim.y + 2), sgn, { n: 16, depth: Math.max(curlDepth, DEPTH.FX - 2), seed: burstSeed, glideMs: 1100 }));
    if (loses) {
      // the stronger side answers on this frame: the battle owns him now (he dies where he tossed)
      let g = 0;
      while (!u.claimed && !u.retired && g++ < 16) await sleep(sc, 30);
      return;
    }
    // the follow-through under the hit-stop: the head flings on, the mane and the tail catch up
    await sleep(sc, 40);
    show(u, 'attack', AF.follow);
    await sleep(sc, 70);
    if (u.locked || !u.sprite.active) return;

    if (s.direct) {
      // the direct run is long: one high back-bound carries him the whole way home
      const far = Math.hypot(stop.x - home.x, stop.y - home.y);
      play('sshTakeoff', { volume: 0.6, pan: panAt(stop.x), pitch: 1.08 });
      await bound(u, { path: line(lunge, home), ms: R(260 + far * 0.35), h: R(14 + far * 0.05), up: AF.back, apex: AF.back, down: AF.down1, a: 0, b: 0.8 }, feetDepth);
      land(home);
      show(u, 'attack', AF.land);
      await sleep(sc, 60);
      show(u, 'attack', AF.shake);
      play('sshHeadShake', { volume: 0.7, pan });
      await sleep(sc, 100);
      return;
    }
    // ---- the rebound: one high back-bound off the target, then a low bound home
    const mid = lerpXY(lunge, home, 0.55);
    play('sshTakeoff', { volume: 0.6, pan: panAt(stop.x), pitch: 1.08 });
    const back = Math.hypot(stop.x - home.x, stop.y - home.y);
    await bound(u, { path: line(lunge, { x: R(mid.x), y: R(mid.y) }), ms: R(220 + back * 0.25), h: R(12 + back * 0.03), up: AF.back, apex: AF.back, down: AF.back, a: 0, b: 1 }, feetDepth);
    land(mid);
    show(u, 'attack', AF.land);
    await sleep(sc, 50);
    play('sshTakeoff', { volume: 0.45, pan: panAt(mid.x), pitch: 1.12 });
    await bound(u, { path: line({ x: R(mid.x), y: R(mid.y) }, home), ms: R(180 + back * 0.3), h: R(5 + back * 0.04), up: AF.back, apex: AF.apex1, down: AF.land, a: 0.25, b: 0.75 }, feetDepth);
    land(home);
    show(u, 'attack', AF.land);
    await sleep(sc, 70);
    show(u, 'attack', AF.shake);
    play('sshHeadShake', { volume: 0.8, pan });
    await sleep(sc, u.frameMs('attack', AF.shake));
    show(u, 'attack', AF.end);
    await sleep(sc, 60);
  } finally {
    if (!u.retired && u.sprite.active && !u.claimed) {
      u.posed = false;
      u.lift = 0;
      u.sprite.setVisible(true);
      place(u, home);
      u.sprite.setDepth(unitDepth(home.y));
      u.rest();
    } else if (!u.retired) releasePosed(u);
  }
}

/** Blocked: the horns lock against the guard (a clack), he is shoved back 4 px sliding on his hooves, then bounds home. */
async function blocked(s: StrikeArgs, stop: XY, home: XY, depth0: number, pan: number): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const sgn = sgnOf(u);
  // the levelled horns meet the guard (the scoop frame held), no toss, no seeds
  show(u, 'attack', AF.scoop);
  place(u, stop, 0);
  const tip = tipAt(u, 'attack', AF.scoop, stop);
  const SHARED = ['impactHeavy', 'impactLight', 'shieldBlock'] as const;
  hush([...SHARED], () => s.impact(tip));
  fade([...SHARED], 0);
  queueMicrotask(() => fade([...SHARED], 0));
  play('sshLockClack', { volume: 1, pan: panAt(tip.x) });
  void lightFlash(sc, tip.x, tip.y, PAL.white, 8, 110, { floorY: stop.y, intensity: 0.5 });
  if (attackerLoses(s)) {
    let g = 0;
    while (!u.claimed && !u.retired && g++ < 16) await sleep(sc, 30);
    return;
  }
  await sleep(sc, 90);
  // shoved back 4 px, sliding on the hooves; three blades spring up at the slide
  const back: XY = { x: stop.x - sgn * 4, y: stop.y };
  show(u, 'attack', AF.land);
  play('sshSlide', { volume: 0.85, pan: panAt(stop.x) });
  wakeFan(sc, { x: R(stop.x + sgn * 4), y: stop.y }, (-sgn) as 1 | -1, 0, u.uid * 7 + 1);
  await animate(sc, 180, (t) => place(u, lerpXY(stop, back, 1 - (1 - t) * (1 - t)), 0));
  // the battle's recoil plays on him (a claim on the animation): the bound home waits for it to hand him back
  let g = 0;
  while (u.claimed && !u.retired && g++ < 24) await sleep(sc, 30);
  await sleep(sc, 40);
  // one low bound home
  play('sshTakeoff', { volume: 0.5, pan: panAt(back.x), pitch: 1.1 });
  await bound(u, { path: (t) => lerpXY(back, home, t), ms: 280, h: 9, up: AF.back, apex: AF.apex1, down: AF.land, a: 0.25, b: 0.75 }, () => -Infinity);
  play('sshHoofTick', { volume: 0.7, pan });
  dustTick(sc, { x: R(home.x + sgn * 6), y: home.y }, sgn);
  show(u, 'attack', AF.shake);
  play('sshHeadShake', { volume: 0.7, pan });
  await sleep(sc, u.frameMs('attack', AF.shake));
  void depth0;
}

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    if (!u.has('attack') || !u.has('summon')) return s.base?.();
    await sicrayis(s);
  },
  { name: 'kartc:steppe_spiralhorn' },
);

/** The P2 relit death pose is painted before it is needed (no first-use hitch). */
registerCardHook(
  ID,
  'attackDeclare',
  async (ctx) => {
    if (LOOK_V3) warmPoses(ID, ctx.ev.player as PlayerId, ['death', 'hitHeavy']);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:steppe_spiralhorn:warm' },
);

// ================================================================ the struck body (hide + horn)

registerCardHook(
  ID,
  'defend',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    const sc = ctx.scene;
    const u = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    if (!u || !u.has('summon')) return ctx.base();
    const guard = ev.targetPosition === 'defense';
    const lethal = ctx.events.some((e, i) => i > ctx.index && e.type === 'destroy' && e.uid === ev.targetUid && e.reason === 'battle');
    const onContact = (uid: unknown) => {
      if (uid !== ev.attackerUid) return;
      sc.events.off('v3:contact', onContact);
      if (!u.sprite.active) return;
      // the hide + horn scores this contact frame: the shared body blow stays silent for its call
      setCombatSfx(false);
      queueMicrotask(() => {
        setCombatSfx(true);
        fade(['impactHeavy', 'impactLight', 'shieldBlock'], 12);
      });
      const pan = panAt(u.home.x);
      if (lethal) watchDeath(sc, u);
      if (guard) play('sshGuardClack', { pan, volume: lethal ? 1 : 0.9 });
      else play(lethal ? 'sshStruckHeavy' : 'sshStruck', { pan, volume: lethal ? 1 : 0.9 });
    };
    sc.events.on('v3:contact', onContact);
    try {
      return await ctx.base();
    } finally {
      sc.events.off('v3:contact', onContact);
    }
  },
  { priority: 20, name: 'kartc:steppe_spiralhorn:struck' },
);

// the horns come down into the pike fence: the clack on the last in-between frame of the guard
if (LOOK_V3) {
  registerObserver((ev: GameEvent, ctx) => {
    if (ev.type !== 'positionChange' || ev.position !== 'defense') return;
    const u = ctx.unit(ev.uid);
    if (!u || u.cardId !== ID) return;
    atFrame(u, 'toGuard', 3, () => play('sshGuardClack', { volume: 0.55, pan: panAt(u.home.x), pitch: 1.08 }), { maxMs: 2000 });
  });
}

// ================================================================ summon: the gust, the grass wave, the long bound

/** Lift curve of a bound that starts `h0` up and lands at 0 with its apex `hMax` up: returns lift(t). */
function arc(h0: number, hMax: number): (t: number) => number {
  // lift = a t² + b t + h0, lift(1) = 0, max = hMax
  const d = hMax - h0;
  const b = 2 * d + 2 * Math.sqrt(d * d + d * h0);
  const a = -h0 - b;
  return (t: number) => a * t * t + b * t + h0;
}

async function steppeEntrance(S: Stage): Promise<void> {
  const u = S.unit;
  const sc = S.scene;
  const sgn = S.dir;
  const home = S.home;
  const pan = panAt(home.x);
  const r = rng(u.uid * 31 + 5);
  fade(['summonCharge'], 140);
  // ---- the gust sweeps across the tile from his entry side; the grass grows behind a travelling wave front
  const grass = new GrassPatch(sc, home, sgn, u.uid * 17 + 3);
  let grassOwned = true;
  try {
    play(sgn > 0 ? 'sshGustR' : 'sshGustL', { volume: 0.9 });
    play('sshGrassGrow', { volume: 0.85, pan });
    // the wave runs on while he is already in the air (the leap leaves the edge at 260 ms)
    const growing = animate(sc, 400, (t) => {
      grass.grow = t;
      grass.gust = Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.4);
    }).then(() => {
      grass.grow = 1;
      grass.gust = 0;
    });
    await sleep(sc, 260);

    // ---- one long high bound in from off screen (P1 from the left edge, P2 from the right)
    const cam = sc.cameras.main;
    const startX = sgn > 0 ? cam.worldView.x - 28 : cam.worldView.x + cam.worldView.width + 28;
    const from: XY = { x: startX, y: home.y - 8 };
    const leapMs = 560;
    const lift = arc(16, 30);
    u.showSprite();
    show(u, 'summon', 0);
    place(u, from, lift(0));
    play('sshLeap', { volume: 0.9, pan: panAt(lerp(from.x, home.x, 0.4)) });
    const seeds = [0.28, 0.5, 0.7];
    let si = 0;
    let fluted = false;
    let shown = -1;
    await animate(sc, leapMs, (t) => {
      const f = t < 0.3 ? 0 : t < 0.55 ? 1 : t < 0.76 ? 2 : t < 0.9 ? 3 : 4;
      if (f !== shown) {
        shown = f;
        show(u, 'summon', f);
      }
      const p = lerpXY(from, home, t);
      const h = lift(t);
      place(u, p, h);
      if (!fluted && t >= 0.36) {
        fluted = true;
        play('sshFluteRise', { volume: 0.9, pan: panAt(p.x) });
      }
      // two or three seeds shaken loose from the mane, trailing behind
      while (si < seeds.length && t >= seeds[si]) {
        si++;
        const c = u.framePoint(AX - 8, GY - 34);
        seedBurst(sc, { x: R(c.x), y: R(c.y) }, R(home.y + 2 + si * 2), (-sgn) as 1 | -1, { n: 1, depth: DEPTH.FX - 2, seed: Math.floor(r() * 1e6), glideMs: 700, spread: 0.3 });
      }
    });
    place(u, home, 0);
    await growing;

    // ---- the tiptoe landing: four ticks, the grass flattens outward in a crescent and springs back, 1 px shake
    show(u, 'summon', u.markFrame('summon', 'land', 5));
    play('sshTiptoe', { volume: 0.95, pan });
    void shake(sc, 70, 1);
    dustTick(sc, { x: R(home.x + sgn * 7), y: home.y }, sgn);
    dustTick(sc, { x: R(home.x - sgn * 9), y: home.y + 1 }, sgn);
    grass.pressAt = { ...home };
    void animate(sc, 320, (t) => {
      grass.press = t < 0.18 ? t / 0.18 : t < 0.6 ? 1 - ((t - 0.18) / 0.42) * 1.4 : -0.4 * (1 - (t - 0.6) / 0.4);
    }).then(() => {
      grass.press = 0;
    });
    await sleep(sc, 80);
    show(u, 'summon', 6);
    await sleep(sc, 90);
    // ---- the light rear: the horns to the sky, the honk and the flute; seeds lift off the grass
    show(u, 'summon', 7);
    play('sshHonk', { volume: 0.95, pan });
    await sleep(sc, 90);
    show(u, 'summon', 8);
    play('sshSeedLift', { volume: 0.8, pan });
    const heads = grass.seedheads();
    for (let i = 0; i < Math.min(5, heads.length); i++) {
      const h = heads[Math.floor(r() * heads.length)];
      seedBurst(sc, h, R(h.y + 1), sgn, { n: 1, depth: unitDepth(home.y) + 1, seed: Math.floor(r() * 1e6), glideMs: 800, spread: 0.25 });
    }
    grass.fadeOut(1000);
    grassOwned = false;
    await sleep(sc, 170);
    show(u, 'summon', 9);
    void u.badge.pop();
    await sleep(sc, 90);
    show(u, 'summon', 10);
    await sleep(sc, 80);
    if (!u.retired) {
      place(u, home, 0);
      u.rest();
    }
  } finally {
    if (grassOwned) grass.destroy();
    if (!u.retired && u.sprite.active) {
      u.lift = 0;
      u.sprite.setVisible(true);
    }
  }
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx as SummonCtx, async () => undefined, steppeEntrance);
  },
  { name: 'kartc:steppe_spiralhorn:summon' },
);

// ================================================================ death: the fold thuds, the seed stream, the plumes

const deathWatched = new WeakSet<MonsterUnit>();
function watchDeath(sc: Phaser.Scene, u: MonsterUnit): void {
  if (deathWatched.has(u)) return;
  deathWatched.add(u);
  const sgn = sgnOf(u);
  const pan = panAt(u.home.x);
  let started = false;
  let fold1 = false;
  let fold1At = 0;
  let fold2 = false;
  let seenEnd = false;
  let gone = false;
  let acc = 0;
  let stream: SeedStream | null = null;
  // the horns where they lie at the end (death f11), as world bases for the plumes
  const sk11 = skeleton(framePose('death', 11));
  const k11 = 0.55; // the art's plume phase on f11
  const bases = [sk11.hornN, sk11.hornF].map((h, j) => ({ x: h.base[0] - k11 * (12 + j * 8), y: h.base[1] - k11 * (16 + j * 4) }));
  // the wind comes from the front (the killer's side): the stream and the plumes leave BACKWARD, away from him
  const lee = (-sgn) as 1 | -1;
  const len = sk11.hornN.len + 2;
  onFrame(sc, (dt, el) => {
    if (el > 3200) {
      stream?.release();
      return false;
    }
    const active = u.sprite.active && u.sprite.visible && !u.retired;
    const fi = u.frameInfo();
    if (active && fi.anim === 'death') {
      const f = fi.frame;
      // the two falling exhales on the first death frame (the pose often joins at f2 straight from the recoil, so the
      // kit's f1 beat would be skipped: the voice leaves deathStart to this watcher)
      if (!started) {
        started = true;
        play('sshExhale', { volume: 0.9, pan });
      }
      if (!fold1 && f >= 2) {
        fold1 = true;
        fold1At = el;
        play('sshFold', { volume: 0.85, pan });
      }
      // the hind legs follow the forelegs: a separate, lower thud (never on top of the first)
      if (fold1 && !fold2 && f >= 3 && el - fold1At >= 130) {
        fold2 = true;
        play('sshFold', { volume: 0.7, pan, pitch: 0.86 });
      }
      // the wind takes the mound: the stream carries on leeward past the frame's edge, climbing
      if (f >= 6 && f <= 10) {
        stream ??= new SeedStream(sc, lee, u.sprite.depth + 0.7, u.uid * 13 + 9);
        acc += dt;
        while (acc >= 22) {
          acc -= 22;
          const k = (f - 6) / 4;
          const p = u.framePoint(8, GY - 16 - Math.round(k * 10));
          stream.emit({ x: R(p.x), y: R(p.y) }, 1, 6, 8);
        }
      }
      if (f >= 10) seenEnd = true;
    }
    if ((!active || (fi.anim !== 'death' && seenEnd)) && !gone) {
      gone = true;
      stream?.release();
      if (seenEnd) {
        // the horns go last: two long seed plumes lift away from where they lay
        const w = bases.map((b) => u.framePoint(R(b.x), R(b.y)));
        plumes(sc, w, lee, Math.max(u.sprite.depth, unitDepth(u.home.y)) + 0.8, len);
      }
      return false;
    }
    return true;
  });
}

registerCardHook(
  ID,
  'destroyed',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const c = ctx as CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
    if (c.ev.location !== 'monster' || sourceOwnsDeath(c as never)) return ctx.base();
    const u = ctx.views.field.unit(c.ev.uid);
    if (u && u.has('death') && u.sprite.active && u.sprite.visible) watchDeath(ctx.scene, u);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:steppe_spiralhorn:death' },
);
