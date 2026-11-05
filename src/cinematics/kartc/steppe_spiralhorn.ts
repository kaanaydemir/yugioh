// Bozkır Boynuzlusu (steppe_spiralhorn, C11) — the card's own v3 presentation (docs/v3/oturum-c-tasarim.md §2.5,
// YENI_KARTLAR C11, §5.2). v3 look only: every handler starts with `if (!LOOK_V3) …base()`, so v1 is untouched.
// Rhythm word: *rear – bound, bound, BOUND – toss*.
//
//   strike "Bozkır Sıçrayışı"
//     rear     the declaration's held charge (attack f1, the snort) → f2–f3: he rears on the hind legs, the forehooves
//              paw the air twice (sshPaw), the horn-tip curls peel off (the art)
//     run-up   a low gathering back-hop AGAINST his facing (16 px) before the rear: the charge has a run-up
//     bounds   THREE airborne bounds, each higher and longer (230 / 270 / 310 ms; sprite lift 4 / 7 / 12 px over the drawn
//              lifts 5 / 8 / 12), each with its own drawn take-off / apex / descent frames. The ground path follows his
//              facing: x moves monotonically toward the target in every bound (30 / 33 / 37 % of the run), the row change
//              rides the later bounds (20 / 30 / 50 %) — he travels into the target's lane, never strafes up his column.
//              He is `posed` for the whole strike (FieldView.sync never settles him onto his tile while the battle commits
//              its state). At each take-off a grass-wake fan springs out of the floor behind the hooves, at each apex a
//              whistle curl peels off each horn tip and rides with it (≤ 10 px, 3 drawn steps), and the flute fragment
//              rises 880 / 988 / 1175 Hz. No rings, no afterimages.
//     toss     he lands in front of the target with the levelled scoop horns over its near half at its core height
//              (strikeStopInto), holds the scoop a beat, the haunches fire (f15, the rising keratin scrape), then the
//              toss (f16: hind legs straight and driving, barrel pitched nose-up, neck fully extended, chin tucked so the
//              horn tips lead): the HORN-SWEEP SMEAR (a stepped earth4 / gold arc the two tips cut from the scoop up
//              through the target, 2 steps), gold tip glints, the keratin crack with its knock and whump, s.impact()
//              (the shared body blow hushed under it), hit-stop 80, a small white floor light, and one frame later the
//              SEED BURST — 16 feather-grass seeds open into a crown over the contact, then glide down leeward (away from
//              him) with spinning plumes, land and blink out; the follow-through frame plays under the stop
//     rebound  one high back-bound off the target (f11), a low bound home (hoof ticks + grass), the head shake (f13)
//     blocked  the horns lock against the guard (a double clack), he is shoved back 6 px sliding on his hooves with the
//              scoop held (the card keeps its frames on him through the battle's recoil claim), three blades spring up at
//              the hooves, two dust ticks, a head shake — no seeds — and he bounds home
//     direct   the three bounds across the field and the toss at the duelist plate (seed burst there)
//   summon     a gust sweeps across the tile from his entry side and the grass GROWS in a travelling wave (three heights,
//              white seedheads); he enters from OFF SCREEN (P1 from the left edge, P2 from the right) in ONE long high
//              bound (apex ≈ 40 px over the tile, drawn tucked jump frames, 2–3 seeds trailing; the flute rises A5 → D6
//              at the apex); he lands on the hoof tips (four ticks), the grass flattens outward in a crescent and
//              springs back, 1 px shake; a light rear with the horns to the sky — the honk and the flute — seeds lift
//              off the grass; the tile grass recedes in three steps
//   death      (decoration of the recipe's deathV3 on the art's pose: kneel → the coat turns to grass in three bands from the
//              hooves up → the wind takes the mound → only the horns lie on the floor) the two fold thuds, the grass turn,
//              the seed stream carried on leeward (away from the killer), and on the last frame the two lying horns lift
//              off as two separate seed plumes while the sprite is hidden — the kit's material break never runs (no burst,
//              no ring: the finale is the plumes)
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
import { warmPoses } from '../_v3/warm';
import { atFrame, fade, hush, panAt, play, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage, type SummonCtx } from '../summon-a/_kit';
import { GrassPatch, SeedStream, dustTick, hornCurl, hornSweep, plumes, rng, seedBurst, strikeStop, strikeStopInto, tipGlints, wakeFan } from './steppe_spiralhorn-fx';

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
async function bound(u: MonsterUnit, B: Bound, minDepth: (t: number) => number, onApex?: (at: XY, lift: number) => void, onDown?: () => void, onLift?: (at: XY) => void): Promise<XY> {
  const sc = u.scene;
  let lifted = !onLift;
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
    // the take-off sound on the first step the hooves are off the floor (SE-1)
    if (!lifted && u.lift >= 1) {
      lifted = true;
      onLift?.(p);
    }
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

  // ---- geometry (r3): he TRAVELS into the target's lane. A gathering back-hop against his facing first (the run-up),
  // then three bounds whose ground path follows his facing toward the target: x moves monotonically toward it in
  // every bound, the row change rides mostly on the later bounds (a curve, not a strafe up his own column). He lands
  // in front of the target with the levelled scoop horns over its near half at its core height (strikeStopInto),
  // so the toss rips them UP through it.
  const aim: XY = { x: s.toGround.x, y: s.toGround.y };
  const tip14 = tipOffset(u, 'attack', AF.scoop);
  const core: XY | null = target && target.sprite.active ? target.core() : null;
  const stop = s.direct || !core ? strikeStop(aim, s.direct ? aim.x : frontOf(target, aim, sgn), tip14.x, sgn, { blocked: s.blocked, direct: s.direct }) : strikeStopInto(aim, core, tip14, sgn, { blocked: s.blocked });
  const runUp: XY = { x: home.x - sgn * 16, y: home.y + (stop.y < home.y ? 3 : stop.y > home.y ? -3 : 0) };
  // x by the bound's share of the run (30 / 33 / 37 %), y on a later curve (20 / 30 / 50 %)
  const KX = [0, 0.3, 0.63, 1];
  const KY = [0, 0.2, 0.5, 1];
  const ptAt = (kx: number, ky: number): XY => ({ x: lerp(runUp.x, stop.x, kx), y: lerp(runUp.y, stop.y, ky) });
  const P = KX.map((k, i) => {
    const p = ptAt(k, KY[i]);
    return { x: R(p.x), y: R(p.y) };
  });
  const seg = (i: number) => (t: number) => ptAt(lerp(KX[i], KX[i + 1], t), lerp(KY[i], KY[i + 1], t));
  const line = (a: XY, b: XY) => (t: number) => lerpXY(a, b, t);
  const curlDepth = Math.max(depth0, tDepth) + 0.6;
  const feetDepth = () => -Infinity;

  // ---- the rear: from the declaration's held charge (f1) through the full rear (f3); the snort goes on
  const ch = takeCharge(u, 'sshSnort', { volume: 0.55, pan });
  const gather = s.direct ? 30 : 40;
  try {
    // the run-up: a low gathering back-hop against his facing (the crouch, the hop, the landing gathered)
    show(u, 'attack', AF.gather);
    await sleep(sc, 50);
    if (u.locked || !u.sprite.active) return;
    await bound(u, { path: line(home, runUp), ms: 170, h: 4, up: AF.back, apex: AF.back, down: AF.land, a: 0.1, b: 0.7 }, feetDepth, undefined, undefined, (at) =>
      play('sshTakeoff', { volume: 0.45, pan: panAt(at.x), pitch: 1.15 }),
    );
    play('sshHoofTick', { volume: 0.6, pan: panAt(runUp.x), pitch: 1.05 });
    dustTick(sc, { x: R(runUp.x + sgn * 6), y: runUp.y }, sgn);
    show(u, 'attack', AF.gather);
    await sleep(sc, 60);
    if (u.locked || !u.sprite.active) return;
    // the rear: f2 (rising, the forehooves leave the floor) and f3 (the full rear, the paw)
    if (!s.direct) {
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
    const apexAt = (i: number) => () => {
      play('sshApexFlute', { volume: [0.75, 0.8, 0.9][i], pan: panAt(u.sprite.x), pitch: APEX_PITCH[i] });
      // a curl off each horn tip, riding with the tip (whatever frame he shows now)
      const tipNow = (far: boolean) => (): XY | null => {
        if (!u.sprite.active) return null;
        const fi = u.frameInfo();
        if (fi.anim !== 'attack') return null;
        const pt = far ? (() => {
          const sk = skeleton(framePose('attack', fi.frame));
          return { x: R(sk.hornF.tip[0]), y: R(sk.hornF.tip[1]) };
        })() : (framePoints('attack', fi.frame).muzzle ?? { x: AX, y: GY - 50 });
        const o = offsetOf(u, pt);
        return { x: R(u.sprite.x + o.x), y: R(u.sprite.y + o.y) };
      };
      hornCurl(sc, tipNow(false), sgn, curlDepth);
      void sleep(sc, 50).then(() => hornCurl(sc, tipNow(true), sgn, curlDepth));
    };
    const land = (at: XY) => {
      play('sshHoofTick', { volume: 0.8, pan: panAt(at.x) });
      dustTick(sc, { x: R(at.x + sgn * 6), y: at.y }, sgn);
      dustTick(sc, { x: R(at.x - sgn * 9), y: at.y + 1 }, sgn);
    };
    // bound 1: 220 ms, low
    takeoff(P[0], 0, 0);
    await bound(u, { path: seg(0), ms: 230, h: 4, up: AF.up1, apex: AF.apex1, down: AF.down1, a: 0.26, b: 0.7 }, feetDepth, apexAt(0));
    land(P[1]);
    show(u, 'attack', AF.gather);
    await sleep(sc, gather);
    // bound 2: 260 ms, higher
    takeoff(P[1], 0.5, 1);
    await bound(u, { path: seg(1), ms: 270, h: 7, up: AF.up2, apex: AF.apex2, down: AF.down2, a: 0.24, b: 0.72 }, feetDepth, apexAt(1));
    land(P[2]);
    show(u, 'attack', AF.gather);
    await sleep(sc, gather + 10);
    // bound 3: 300 ms, the highest — the tightest tuck through the apex, the head drops only on the way down
    takeoff(P[2], 1, 2);
    await bound(u, { path: seg(2), ms: 310, h: 12, up: AF.up3, apex: AF.apex3, down: AF.down3, a: 0.22, b: 0.78 }, feetDepth, apexAt(2), () => play('sshDrop', { volume: 0.85, pan: panAt(stop.x) }));
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
    // the drive: the haunches fire, the horns swing up through 70° — the rising keratin scrape leads the crack
    show(u, 'attack', AF.toss0);
    play('sshHornScrape', { volume: 0.9, pan: panAt(stop.x + sgn * 30) });
    await sleep(sc, 50);
    if (u.locked || !u.sprite.active) return;

    // ---- CONTACT: the horn toss, a 2-px lunge forward
    const lunge: XY = { x: stop.x + sgn * 2, y: stop.y };
    show(u, 'attack', AF.contact);
    place(u, lunge, 0);
    const tip = tipAt(u, 'attack', AF.toss0, lunge);
    const hitAt: XY = target && target.sprite.active ? { x: R(lerp(tip.x, target.core().x, 0.3)), y: R(Math.max(tip.y, target.core().y - 8)) } : s.to;
    // the card's own contact mark: the arc the horn tips cut from the levelled scoop up to the toss (both horns), and
    // gold glints where they rip out
    const farTip = (anim: 'attack', f: number, feet: XY): XY => {
      const sk = skeleton(framePose(anim, f));
      const o = offsetOf(u, { x: sk.hornF.tip[0], y: sk.hornF.tip[1] });
      return { x: R(feet.x + o.x), y: R(feet.y + o.y) };
    };
    const tipUp = tipAt(u, 'attack', AF.contact, lunge);
    const farUp = farTip('attack', AF.contact, lunge);
    const fxDepth = Math.max(u.sprite.depth, tDepth) + 0.7;
    hornSweep(sc, { from: tipAt(u, 'attack', AF.scoop, stop), to: tipUp }, { from: farTip('attack', AF.scoop, stop), to: farUp }, sgn, fxDepth);
    tipGlints(sc, [tipUp, farUp, { x: R((tipUp.x + farUp.x) / 2 + sgn * 3), y: R((tipUp.y + farUp.y) / 2 + 6) }], fxDepth + 0.1);
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
      show(u, 'attack', AF.gather);
      await sleep(sc, 40);
      await bound(u, { path: line(lunge, home), ms: R(260 + far * 0.35), h: R(14 + far * 0.05), up: AF.back, apex: AF.back, down: AF.down1, a: 0, b: 0.8 }, feetDepth, undefined, undefined, (at) =>
        play('sshTakeoff', { volume: 0.6, pan: panAt(at.x), pitch: 1.08 }),
      );
      land(home);
      show(u, 'attack', AF.land);
      await sleep(sc, 60);
      show(u, 'attack', AF.shake);
      play('sshHeadShake', { volume: 0.7, pan });
      await sleep(sc, 100);
      return;
    }
    // ---- the rebound: one high back-bound off the target, then a low bound home
    // (each rebound bound starts from a 40-ms crouch; its take-off sounds on the first lifted step)
    const mid = lerpXY(lunge, home, 0.55);
    const back = Math.hypot(stop.x - home.x, stop.y - home.y);
    show(u, 'attack', AF.gather);
    await sleep(sc, 40);
    if (u.locked || !u.sprite.active) return;
    await bound(u, { path: line(lunge, { x: R(mid.x), y: R(mid.y) }), ms: R(240 + back * 0.25), h: R(14 + back * 0.05), up: AF.back, apex: AF.back, down: AF.back, a: 0, b: 1 }, feetDepth, undefined, undefined, (at) =>
      play('sshTakeoff', { volume: 0.6, pan: panAt(at.x), pitch: 1.08 }),
    );
    land(mid);
    show(u, 'attack', AF.land);
    await sleep(sc, 50);
    show(u, 'attack', AF.gather);
    await sleep(sc, 40);
    if (u.locked || !u.sprite.active) return;
    await bound(u, { path: line({ x: R(mid.x), y: R(mid.y) }, home), ms: R(190 + back * 0.3), h: R(6 + back * 0.04), up: AF.back, apex: AF.apex1, down: AF.land, a: 0.25, b: 0.75 }, feetDepth, undefined, undefined, (at) =>
      play('sshTakeoff', { volume: 0.45, pan: panAt(at.x), pitch: 1.12 }),
    );
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

/** Blocked: the horns lock against the guard (a clack), he is shoved back 6 px sliding on his hooves with the scoop
 *  held, a head shake, then a bound home. The battle's recoil claims his animation: the card keeps its own frames on it
 *  (as the claimant) for the whole beat, so he never drops into an idle stance mid-recoil. */
async function blocked(s: StrikeArgs, stop: XY, home: XY, depth0: number, pan: number): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const sgn = sgnOf(u);
  // the frame the card wants on him (null: hands-off); enforced every frame, through the claim when there is one
  let want: number | null = AF.scoop;
  let holding = true;
  onFrame(sc, () => {
    if (!holding || u.retired || !u.sprite.active) return false;
    if (want === null) return true;
    const fi = u.frameInfo();
    if (fi.anim !== 'attack' || fi.frame !== want) {
      const f = want;
      u.asClaimant(() => u.pose('attack', f));
    }
    return true;
  });
  const hold = (f: number) => {
    want = f;
    u.asClaimant(() => u.pose('attack', f));
  };
  try {
    // the levelled horns meet the guard (the scoop frame held), no toss, no seeds
    hold(AF.scoop);
    place(u, stop, 0);
    const tip = tipAt(u, 'attack', AF.scoop, stop);
    const SHARED = ['impactHeavy', 'impactLight', 'shieldBlock'] as const;
    hush([...SHARED], () => s.impact(tip));
    fade([...SHARED], 0);
    queueMicrotask(() => fade([...SHARED], 0));
    play('sshLockClack', { volume: 1, pan: panAt(tip.x) });
    void lightFlash(sc, tip.x, tip.y, PAL.white, 8, 110, { floorY: stop.y, intensity: 0.5 });
    if (attackerLoses(s)) {
      holding = false;
      let g = 0;
      while (!u.claimed && !u.retired && g++ < 16) await sleep(sc, 30);
      return;
    }
    await sleep(sc, 90);
    // shoved back 6 px over 120 ms, sliding on the hooves with the scoop held: three blades spring up at the hooves on
    // the first slide frame, two dust ticks
    const back: XY = { x: stop.x - sgn * 6, y: stop.y };
    play('sshSlide', { volume: 0.85, pan: panAt(stop.x) });
    wakeFan(sc, { x: R(stop.x + sgn * 3), y: stop.y }, (-sgn) as 1 | -1, 0, u.uid * 7 + 1, 3);
    dustTick(sc, { x: R(stop.x + sgn * 8), y: stop.y }, (-sgn) as 1 | -1);
    void sleep(sc, 60).then(() => dustTick(sc, { x: R(stop.x - sgn * 8), y: stop.y + 1 }, (-sgn) as 1 | -1));
    await animate(sc, 120, (t) => place(u, lerpXY(stop, back, 1 - (1 - t) * (1 - t)), 0));
    await sleep(sc, 60);
    // the head shake (one frame), then the gather
    hold(AF.shake);
    play('sshHeadShake', { volume: 0.7, pan });
    await sleep(sc, 110);
    hold(AF.gather);
    await sleep(sc, 50);
    // one low bound home (the card's frames ride the claim if the recoil still holds his animation)
    want = null;
    holding = false;
    const flat = (f: number) => u.asClaimant(() => u.pose('attack', f));
    let shown = -1;
    let lifted = false;
    await animate(sc, 300, (t) => {
      const f = t < 0.25 ? AF.back : t < 0.75 ? AF.apex1 : AF.land;
      if (f !== shown) {
        shown = f;
        flat(f);
      }
      place(u, lerpXY(back, home, t), 9 * 4 * t * (1 - t));
      if (!lifted && u.lift >= 1) {
        lifted = true;
        play('sshTakeoff', { volume: 0.5, pan: panAt(u.sprite.x), pitch: 1.1 });
      }
    });
    place(u, home, 0);
    play('sshHoofTick', { volume: 0.7, pan });
    dustTick(sc, { x: R(home.x + sgn * 6), y: home.y }, sgn);
    flat(AF.land);
    await sleep(sc, 90);
    flat(AF.end);
    void depth0;
  } finally {
    holding = false;
  }
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
  // he flies in from off screen: FieldView.sync must not settle him onto the tile mid-bound
  const wasPosed = u.posed;
  u.posed = true;
  try {
    play(sgn > 0 ? 'sshGustR' : 'sshGustL', { volume: 0.9 });
    play('sshGrassGrow', { volume: 0.85, pan });
    // the gust band crosses the patch (the blades it reaches lie flat, the grass rises behind it in three heights); the
    // wave runs on while he is already in the air (the leap leaves the edge at 150 ms), the grown grass sways
    const growing = animate(sc, 320, (t) => {
      grass.grow = t;
    }).then(() => {
      grass.grow = 1;
    });
    await sleep(sc, 150);

    // ---- one long high bound in from off screen (P1 from the left edge, P2 from the right)
    const cam = sc.cameras.main;
    const startX = sgn > 0 ? cam.worldView.x - 28 : cam.worldView.x + cam.worldView.width + 28;
    // P2 enters from the right edge on a far floor line BEHIND the duelist's podium (his feet stay up-screen of the
    // duelist's until he has cleared its x, then the line curves down onto his tile): the duelist figure and its
    // podium are never covered by the bound — they stand in front of it
    const from: XY = { x: startX, y: sgn > 0 ? home.y - 8 : home.y - 74 };
    const leapMs = 540;
    const lift = sgn > 0 ? arc(16, 30) : arc(10, 26);
    const pathAt = (t: number): XY => (sgn > 0 ? lerpXY(from, home, t) : { x: lerp(from.x, home.x, t), y: lerp(from.y, home.y, t * t * t) });
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
      const p = pathAt(t);
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
        seedBurst(sc, { x: R(c.x), y: R(c.y) }, R(home.y + 2 + si * 2), (-sgn) as 1 | -1, { n: 1, depth: DEPTH.FX - 2, seed: Math.floor(r() * 1e6), glideMs: 700, spread: 0, power: 0.25 });
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
    // two drawn states over three frames: flattened outward, flattened, sprung back past upright
    grass.press = 1;
    void sleep(sc, 90).then(() => (grass.press = 2));
    void sleep(sc, 160).then(() => (grass.press = 0));
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
      seedBurst(sc, h, R(h.y + 1), sgn, { n: 1, depth: unitDepth(home.y) + 1, seed: Math.floor(r() * 1e6), glideMs: 800, spread: 0, power: 0.3 });
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
    u.posed = wasPosed;
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
  const last = u.frameCount('death') - 1;
  let started = false;
  let fold1 = false;
  let fold1At = 0;
  let fold2 = false;
  let turned = false;
  let gone = false;
  let acc = 0;
  let stream: SeedStream | null = null;
  // the horns as they lie on the floor at the end (the last death frame): world bases + angles for the plumes
  const skL = skeleton(framePose('death', last));
  // the wind comes from the front (the killer's side): the stream and the plumes leave BACKWARD, away from him
  const lee = (-sgn) as 1 | -1;
  const len = skL.hornN.len + 3;
  const lifted = () => {
    // the horns go last: two long seed plumes lift away from where they lay, and the body is gone with them — the
    // death kit's material break never runs on an empty frame (no burst, no ring: the finale is the plumes)
    const horns = [skL.hornN, skL.hornF].map((h) => {
      const b = u.framePoint(R(h.base[0]), R(h.base[1]));
      const a = (h.ang * Math.PI) / 180;
      const ang = sgn > 0 ? a : Math.PI - a;
      return { base: { x: R(b.x), y: R(b.y) }, ang };
    });
    // a little apart (≥ 6 px) so they read as two from the first frame
    horns[1].base = { x: horns[1].base.x - lee * 3, y: horns[1].base.y - 3 };
    plumes(sc, horns, lee, Math.max(u.sprite.depth, unitDepth(u.home.y)) + 0.8, len);
    play('sshPlumeLift', { volume: 0.8, pan });
    u.sprite.setVisible(false);
  };
  onFrame(sc, (dt, el) => {
    if (el > 3600) {
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
      // the coat starts turning to grass (the kit's dissolve beat misses it when the pose joins on that frame; a
      // second call inside the recipe's gap is dropped)
      if (!turned && f >= 3) {
        turned = true;
        play('sshGrassTurn', { volume: 0.9, pan });
      }
      // the wind takes the mound (f7 → the last frame): it is peeled column by column from the windward (front) side,
      // and every peeled column leaves as members of ONE curving ribbon of blades and plumed seeds that drifts leeward
      // and climbs (spawned over the whole ~640 ms, never all at once)
      if (f >= 7 && f < last) {
        stream ??= new SeedStream(sc, lee, Math.max(u.sprite.depth, unitDepth(u.home.y)) + 0.7, u.uid * 13 + 9);
        acc += dt;
        while (acc >= 16) {
          acc -= 16;
          const k = Math.min(1, (f - 7 + (acc / Math.max(1, u.frameMs('death', f)))) / (last - 7));
          // the erosion front runs from the head end (+x in the frame) to the rump; it leaves from the mound's top half
          const p = u.framePoint(AX + 16 - Math.round(k * 32), GY - 6 - Math.round(4 * Math.sin(k * Math.PI)));
          stream.emit({ x: R(p.x), y: R(p.y) }, 1, 4, 6);
        }
      }
      if (f >= last && !gone) {
        gone = true;
        stream?.release();
        lifted();
        return false;
      }
    }
    if (!active && !gone) {
      gone = true;
      stream?.release();
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
