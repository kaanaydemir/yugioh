// Kabuk Zıpkıncı (tide_harpooner) — the card's own v3 cinematics (lane C, C1; docs/v3/oturum-c-tasarim.md §2.1).
// ?look=v3 only: every handler starts with the LOOK_V3 gate, so the old look stays byte-identical.
//
//   strike   "Zıpkın Atışı" — *twirl – throw – haul*. The crab NEVER leaves its tile. The declaration holds the coil
//            lifted; the rope twirls the harpoon 1.5 turns overhead (one swish per pass, the pitch climbing, the pan
//            swinging in front of / behind the shell; foam beads fly off the front pass and land as wet dots), the aim
//            hold, the 60-ms throw. The harpoon flies the lane on its own (2-px rope paying out behind it, slack →
//            taut, a 3-px gravity sag, a floor shadow), PIERCES the target (the head out of its far side, a narrow
//            exit spray of 3–4 streaks, three droplets land) — then the PULL, the game's only one: haul 1 (the rope
//            snaps straight and a step brighter, the target is dragged 3 px TOWARD the crab), haul 2 (the rip-out,
//            the slack wobble), the harpoon reeled back head-first along the wet line and re-planted ("tok").
//            Blocked / the guard holds: the head bites the guard and does NOT go in (tang), haul 1 moves the guard
//            1 px, it pops free and is reeled in — "the pull failed". Direct: the harpoon flies over the field,
//            past the duelist (the blow lands there) and STAKES into the opponent's LP panel (drawn on the HUD,
//            whole pixels); one haul jolts the panel, then it is ripped out and reeled back across the board.
//   summon   the tide uncovers the conch: a flat water sheet slides over the tile from the back-left (white leading
//            edge), draws back and leaves wet sand and the half-buried apex; the cut-in (tribute) passes under the
//            tile while the shell heaves out in two jerks, tips onto its side, legs / claws / eye stalks come out and
//            it heaves itself upright; the roar (vapour from the apex, the harpoon spun once) ends in the PLANT —
//            sand spray, a wet ring and a white flash pool at the harpoon's foot. Never climbing out of the ground
//            (that is R2 / C10's): it is UNCOVERED.
//   struck   its own seashell "tok" on the frame it is struck (hit / heavy / magic) and the guard's shuck + clack.
//   death    (decorates the recipe's v3 death kit, priority 20) drawn into the shell; the harpoon is LEFT STANDING
//            at the tile front from death f3; the tide washes the tile again while the shell sinks into the sand;
//            the planted harpoon stays 0.5 s after the body has gone, then splinters into six driftwood bits and the
//            stone head (they fall flat and blink out in palette steps).
// The Körfez kalkanı (the shroud ring, the deflection, KORUNUYOR) lives in ./tide_harpooner-shroud.ts.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { DART_LEN, exitSpray, ropeLine, splinters } from '../../art/monsters-v3/tide_harpooner-fx';
import type { MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, PlayerId } from '../../engine/types';
import { DEPTH, LOOK_V3, TILE_W, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { shake } from '../../vfx/core';
import { E, animate, onFrame, sleep } from '../../vfx/combat';
import { registerCardHook, registerObserver, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import { lpPoint } from '../_core/helpers';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, fade, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { worldToScreen } from '../strikes-a/_kit';
import { groundRing, sourceOwnsDeath } from '../strikes-b/_kit';
import { HarpoonImg, Surface, add, angleOf, clamp, flingBeads, hash, haul, lerp, lerpXY, norm, ownContact, paintTide, pt, rnd, snapXY, sub, type TideState } from './tide_harpooner-fx';
import { A_REL } from '../../art/monsters-v3/tide_harpooner-anims';
import { HARP_L } from '../../art/monsters-v3/tide_harpooner-rig';
import { ensureShroud, syncShroud } from './tide_harpooner-shroud';
import { shrouded } from '../../engine/query';

const ID = 'tide_harpooner';

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type BattleCtx = CinematicContext<Extract<GameEvent, { type: 'battle' }>>;

/** World point of an art point of `anim` frame `f` (follows the sprite's current position / flip). */
function artPt(u: MonsterUnit, anim: 'attack' | 'idle' | 'roar' | 'summon' | 'death', f: number, name: MonsterPointName): XY {
  const p = u.art.points?.(anim, f)[name] ?? u.art.muzzle;
  return u.framePoint(p.x, p.y);
}

/** Does this battle destroy `uid` (its own destroy event follows in the batch)? */
function dies(ctx: BattleCtx, uid: number): boolean {
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'battle' || e.type === 'phaseChange' || e.type === 'turnStart') break;
    if (e.type === 'destroy' && e.uid === uid) return true;
  }
  return false;
}

/** The rope's look for this frame of the strike. */
interface RopeLook {
  on: boolean;
  sag: number;
  taut: boolean;
  wobble: number;
  wet: number;
}

// ================================================================ strike: Zıpkın Atışı

async function zipkinAtisi(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const ev = s.ctx.ev;
  const sgn: 1 | -1 = u.flipX ? -1 : 1;
  const pan = panAt(u.home.x);
  const n = u.frameCount('attack');
  const relF = u.markFrame('attack', 'release', A_REL);
  const payF = Math.min(n - 1, relF + 1); // the line pays out (held through the flight)
  const haulF = relF + 2;
  const ripF = relF + 3;
  const catchF = relF + 4; // the head is home: seated in the socket, the harpoon held short
  const plantF = relF + 6;
  const twF = Math.max(1, relF - 9); // first twirl frame
  const loses = ev.result === 'attackerDestroyed' || ev.result === 'bothDestroyed';
  const tgt = !s.direct && s.target && s.target.sprite.active ? s.target : null;
  const tDies = !!tgt && dies(s.ctx, tgt.uid);
  /** the head bites the guard / the stronger body and does not go in */
  const bite = !s.direct && !tDies;
  const defender: PlayerId = ev.player === 0 ? 1 : 0;
  const seedN = u.uid * 31 + (tgt?.uid ?? 7);
  const alive = () => spr.active && !u.retired && u.frameInfo().anim === 'attack';

  // ---- direct attacks are staged on the HUD plane (the LP panel does not lean with the camera): every point is
  // mapped world → screen at the frame it is drawn
  const screen = s.direct;
  const M = (p: XY): XY => (screen ? worldToScreen(sc, p) : p);
  const fxDepth = screen ? DEPTH.HUD + 6 : DEPTH.FX + 1;
  const rope = new Surface(sc, fxDepth - 0.5, { screen });
  const shadow = new Surface(sc, DEPTH.CARD_ON_TILE + 4);
  const spray = new Surface(sc, fxDepth + 0.2, { screen });
  // the TOGGLE HEAD flies (stone head + foreshaft + the lashing the line is tied to); the shaft stays in the claw
  const harp = new HarpoonImg(sc, fxDepth, { screen, dart: true });
  const look: RopeLook = { on: false, sag: 6, taut: false, wobble: 0, wet: 0 };
  /** the line's source: the socket of the shaft in the big claw, on the frame the sprite shows */
  const socket = (): XY | null => {
    if (!spr.active) return null;
    const fi = u.frameInfo();
    const fr = fi.anim === 'attack' && fi.frame >= relF && fi.frame <= ripF ? fi.frame : fi.anim === 'attack' && fi.frame > ripF ? ripF : relF;
    return M(artPt(u, 'attack', fr, 'muzzle'));
  };
  let ropeFrom: XY | null = null;
  let shadowAt: { p: XY; d: XY } | null = null;
  let phase = 0;
  let closed = false;
  // the line (and the flight's floor shadow) redrawn every frame from the state the beats set: ALWAYS socket → the
  // head's tail lashing, in world space (one object: the line ends where the head begins)
  const stopRope = onFrame(sc, (dt) => {
    if (closed) return false;
    rope.clear();
    shadow.clear();
    phase += dt / 260;
    if (look.on && harp.visible) {
      const src = socket();
      if (src) ropeFrom = src;
      if (ropeFrom) ropeLine(rope.canvas, pt(snapXY(ropeFrom)), pt(harp.butt()), { sag: look.sag, taut: look.taut, wobble: look.wobble, phase, wet: look.wet });
    }
    if (shadowAt) {
      // the head's shadow on the floor: a short night1 dash under it (reads its height over the lane)
      const { p, d } = shadowAt;
      for (let k = -3; k <= 3; k++) shadow.set(p.x + d.x * k, p.y + d.y * k, k > -2 && k < 2 ? PAL.night1 : PAL.night2);
    }
    return true;
  });
  /** the lost throw keeps the head (it drops and lies a beat) after the strike has let go */
  let keepHarp = false;
  const cleanup = () => {
    if (closed) return;
    closed = true;
    stopRope();
    rope.destroy();
    shadow.destroy();
    if (!keepHarp) harp.destroy();
  };

  // ---- the twirl: the declaration's held coil continues; the charge voice is the declaration's own
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const charge = takeCharge(u, 'harpTwirl', { volume: 0.85, pan });
  // one swish per half turn (four over the 1.5 turns), pitch +8 % a pass, the pan swinging in front of / behind the shell
  for (let k = 0; k < 4; k++) {
    const f = twF + 1 + k * 2;
    if (f < Math.max(twF, f0)) continue;
    atFrame(u, 'attack', f, () => play('harpSwish', { volume: 0.7 + 0.05 * k, pitch: 1 + 0.08 * k, pan: clamp(pan + (k % 2 ? 0.18 : -0.18) * sgn, -0.5, 0.5) }), { late: false });
  }
  // the front pass flings foam beads (they land as wet dots in front of the shell)
  atFrame(u, 'attack', twF + 4, () => {
    play('harpBeads', { volume: 0.8, pan });
    flingBeads(sc, artPt(u, 'attack', twF + 4, 'muzzle'), sgn, u.home.y + 6, unitDepth(u.home.y) + 0.6, seedN, 4);
  }, { late: false });
  atFrame(u, 'attack', twF + 5, () => flingBeads(sc, artPt(u, 'attack', twF + 5, 'muzzle'), sgn, u.home.y + 3, unitDepth(u.home.y) + 0.6, seedN + 5, 3), { late: false });

  try {
    void u.playRange('attack', f0, payF);
    await u.playToFrame('attack', relF);
    if (!alive()) return;
    // ---- RELEASE: the claw thrusts the shaft; the toggle head leaves the socket ON this frame
    charge.stop(40);
    play('harpLoose', { volume: 0.95, pan });
    const sock0 = socket() ?? M(u.core());
    // aim a little above the core (the throw comes from shoulder height: the head goes through the body, not the floor)
    const tCore = tgt ? add(tgt.core(), { x: 0, y: -4 }) : s.to;
    let dir: XY;
    let tipEnd: XY;
    let hitAt: XY;
    let passT = -1; // direct: where the head passes the duelist (the blow lands there)
    if (s.direct) {
      // over the field, past the duelist, staked into the LP readout: the digits' edge that faces the crab
      const lp = lpPoint(s.ctx, defender);
      dir = norm(sub(lp, sock0));
      tipEnd = add(add(lp, dir, -9), { x: 0, y: -3 });
      hitAt = s.to;
    } else {
      dir = norm(sub(tCore, sock0));
      const r = tgt ? clamp(rnd(tgt.art.w * 0.12), 5, 12) : 6;
      // pierce: the head comes out of the far side; bite: it stops on the near face
      tipEnd = bite ? add(tCore, dir, -r) : add(tCore, dir, 9);
      hitAt = bite ? tipEnd : tCore;
    }
    const tip0 = snapXY(add(sock0, dir, DART_LEN));
    tipEnd = snapXY(tipEnd);
    const travel = Math.max(10, (tipEnd.x - tip0.x) * dir.x + (tipEnd.y - tip0.y) * dir.y);
    if (travel < 14) tipEnd = snapXY(add(tip0, dir, 14));
    if (s.direct) {
      const chest = M(s.to);
      const d = sub(tipEnd, tip0);
      passT = clamp(((chest.x - tip0.x) * d.x + (chest.y - tip0.y) * d.y) / (d.x * d.x + d.y * d.y || 1), 0.3, 0.92);
    }
    void lightFlash(sc, sock0.x, sock0.y, PAL.white, 10, 120, { floorY: u.home.y, intensity: 0.45, air: 0.5 });
    const ang = angleOf(dir);
    const dist = Math.hypot(tipEnd.x - tip0.x, tipEnd.y - tip0.y);
    // a short gap is lobbed higher so the travel reads; the shaft never turns more than ~15° in the air
    const lob = s.direct ? 4 : clamp(rnd(dist * 0.16), 5, 8);
    const flyMs = s.direct ? clamp(rnd(dist * 0.6), 180, 210) : clamp(rnd(dist * 3.4), 150, 230);
    const floorA = u.home;
    const floorB = tgt ? tgt.home : { x: s.toGround.x, y: s.toGround.y };
    const floorDir = norm(sub(floorB, floorA));
    look.on = true;
    look.sag = 7;
    let impacted = false;
    const doImpact = () => {
      if (impacted) return;
      impacted = true;
      // the contact is the card's: no generic body blow / shield clang, no lightning backlash or hex clang (its own
      // bite, tang and failed pull answer instead); struck by the counter, the shell answers with its own tok
      ownContact(sc, { motifs: true }, () => {
        if (loses && spr.active) play('harpStruckHeavy', { volume: 0.9, pan });
      });
      s.impact(hitAt);
    };
    harp.set(tip0, ang, { smear: 2 });
    await animate(sc, flyMs, (t) => {
      // direct: the pass over the duelist sits at 3/4 of the flight time, so the stake lands ≈ 100 ms after the
      // number (the head keeps its speed: the panel is closer to the duelist than the duelist is to the crab)
      const e = passT >= 0 ? (t < 0.75 ? passT * (t / 0.75) : passT + (1 - passT) * ((t - 0.75) / 0.25)) : E.outQ(t) * 0.35 + t * 0.65;
      // straight with a gravity sag (the angle follows the curve, clamped)
      const sag = lob * 4 * e * (1 - e);
      const p = lerpXY(tip0, tipEnd, e);
      const slope = (lob * 4 * (1 - 2 * e)) / Math.max(1, dist);
      const tilt = clamp((Math.atan(slope) * 180) / Math.PI, -15, 15) * (dir.x >= 0 ? 1 : -1);
      harp.set({ x: p.x, y: p.y + sag }, ang + tilt, { smear: t < 0.3 ? 2 : 0 });
      look.sag = lerp(7, 1, e);
      if (!screen) shadowAt = { p: snapXY(lerpXY(floorA, floorB, e * 0.85 + 0.1)), d: floorDir };
      if (passT >= 0 && e >= passT && !impacted) {
        doImpact();
        play('harpWetTok', { volume: 0.85, pan: panAt(s.to.x) });
      }
    });
    shadowAt = null;
    harp.set(tipEnd, ang);
    look.sag = 1;

    // ---- CONTACT
    if (s.direct) {
      doImpact();
      // the stake: the head buried in the LP digits, a dry thock, a few splinters of the panel trim
      harp.set(add(tipEnd, dir, 4), ang, { bury: 7 });
      play('harpStake', { volume: 0.95, pan: dir.x > 0 ? 0.35 : -0.35 });
      stakeChips(sc, tipEnd, dir, seedN);
    } else {
      doImpact();
      play(bite ? 'harpTang' : 'harpWetTok', { volume: 1, pan: panAt(hitAt.x) });
      if (!bite && tgt) {
        // the head now runs THROUGH the body: drawn behind it, the line going into the near side, the head out of the far one
        harp.setDepth(tgt.sprite.depth - 0.3);
        rope.setDepth(tgt.sprite.depth - 0.35);
        sprayOut(sc, spray, add(tCore, dir, 9), dir, floorB.y + 2, seedN);
      } else biteChips(sc, spray, tipEnd, dir, seedN);
    }
    if (loses) {
      // the stronger side answers on this frame (the handler owns the attacker now): the line goes slack, the
      // head drops off the guard and lies on the floor a beat, then blinks out
      look.on = false;
      keepHarp = true;
      void dropHarpoon(sc, harp, rope, tipEnd, ang, (tgt?.home.y ?? tipEnd.y + 20) + 3).then(() => harp.destroy());
      return;
    }
    // the head rides the struck body (the kit's knock, then the pull)
    const tPos0 = tgt ? { x: tgt.sprite.x, y: tgt.sprite.y } : null;
    let stuck = true;
    let panelJolt: XY = { x: 0, y: 0 };
    const ride = onFrame(sc, () => {
      if (!stuck || closed) return false;
      if (tgt && tPos0 && tgt.sprite.active) harp.set(add(tipEnd, sub({ x: tgt.sprite.x, y: tgt.sprite.y }, tPos0)), ang);
      else if (s.direct) harp.set(add(add(tipEnd, dir, 4), panelJolt), ang, { bury: 7 });
      return true;
    });
    await sleep(sc, s.direct ? 40 : 110);
    if (!spr.active || u.retired) return;

    // ---- HAUL 1: rear legs plant, the line snaps straight and a step brighter; the target comes TOWARD the crab
    const toHaul = u.playRange('attack', haulF, ripF);
    look.taut = true;
    look.sag = 0;
    play('harpHaul', { volume: 1, pan });
    void shake(sc, 90, 1);
    if (tgt && tgt.sprite.active) haul(tgt, u.home, bite ? 1 : 3, { hold: tDies });
    if (bite) {
      // the failed pull: the head only scrapes the guard, wet spray flicks off its face, the line whips back slack
      void sleep(sc, 70).then(() => play('harpWhip', { volume: 0.9, pan: panAt(lerp(u.home.x, tipEnd.x, 0.5)) }));
      sprayOut(sc, spray, tipEnd, { x: -dir.x, y: -dir.y }, floorB.y + 2, seedN + 11, 0.5);
    }
    if (s.direct) {
      shakePanel(s.ctx, defender);
      // the stake yanks the panel toward the crab: 2 px, 2 frames, back
      const toward = { x: -Math.sign(dir.x) * 2, y: -Math.sign(dir.y) * 1 };
      panelJolt = toward;
      void sleep(sc, 34).then(() => (panelJolt = { x: toward.x / 2, y: 0 })).then(() => sleep(sc, 34)).then(() => (panelJolt = { x: 0, y: 0 }));
    }
    await toHaul;
    if (!alive()) return;

    // ---- HAUL 2: the rip-out (a small spray), the slack wobble; the head reeled back TAIL-FIRST along the wet line
    stuck = false;
    ride();
    look.taut = false;
    look.sag = 3;
    look.wobble = bite ? 3 : 2;
    look.wet = 1;
    const tail0 = harp.butt();
    if (!bite && !s.direct) {
      play('harpRip', { volume: 0.95, pan: panAt(tail0.x) });
      sprayOut(sc, spray, tCore, { x: -dir.x, y: -dir.y }, floorB.y + 2, seedN + 3, 0.6);
    } else play('harpRip', { volume: 0.7, pan: panAt(tail0.x), pitch: 1.12 });
    harp.setDepth(fxDepth);
    rope.setDepth(fxDepth - 0.5);
    // where it seats: the catch frame's socket (the art draws the harpoon whole from there), at the catch angle
    const cTip = M(artPt(u, 'attack', catchF, 'muzzle'));
    const cButt = M(artPt(u, 'attack', catchF, 'staff'));
    const catchAng = angleOf(sub(cTip, cButt));
    const cSock = lerpXY(cButt, cTip, (HARP_L - DART_LEN) / HARP_L);
    const reelDist = Math.hypot(cSock.x - tail0.x, cSock.y - tail0.y);
    const reelMs = clamp(rnd(reelDist * 2.6), 150, s.direct ? 260 : 220);
    const turn = ((((catchAng - ang) % 360) + 540) % 360) - 180; // shortest way round
    void sleep(sc, 30).then(() => play('harpReel', { volume: 0.9, pan: panAt(lerp(tail0.x, u.home.x, 0.5)) }));
    await animate(sc, reelMs, (t) => {
      const e = E.inQ(t) * 0.55 + t * 0.45;
      // tail first along the line (the head trails, still pointing where it flew); on the last third it swings round
      // to the shaft's angle in two 1-frame steps and seats
      const a = t < 0.62 ? ang : t < 0.84 ? ang + turn * 0.5 : catchAng;
      const p = lerpXY(tail0, cSock, e);
      harp.setTail(snapXY(p), a);
      look.sag = lerp(3, 1, t);
      look.wobble = lerp(look.wobble, 0, 0.1);
    });
    // ---- seated: the art draws the whole harpoon (and the coiled line) from here
    look.on = false;
    harp.hide();
    play('harpSeat', { volume: 0.85, pan });
    // the battle has its blow: hand it back now — the lift and the re-plant play on by themselves
    // (the crab never left its tile: nothing to bring home)
    const rest = u.playRange('attack', catchF);
    atFrame(u, 'attack', plantF, () => {
      play('harpReplant', { volume: 0.9, pan });
      const foot = artPt(u, 'attack', plantF, 'staff');
      void lightFlash(sc, foot.x, u.home.y, PAL.white, 12, 220, { floorY: u.home.y, intensity: 0.5 });
    });
    void rest.then(() => {
      if (spr.active && !u.retired && u.frameInfo().anim === 'attack' && !u.sprite.anims.isPlaying) u.rest();
    });
  } finally {
    cleanup();
    if (spr.active && !u.retired && !loses && u.frameInfo().anim !== 'attack') u.rest();
  }
}

/** The LP panel jolts on haul 1 (2 px, the HUD's own panel shake). */
function shakePanel(ctx: AnyBattle, p: PlayerId): void {
  try {
    (ctx.views.hud as unknown as { shake?: (p: PlayerId, px: number, ms: number) => void }).shake?.(p, 2, 120);
  } catch {
    /* the HUD may not shake */
  }
}
type AnyBattle = BattleCtx;

/** The exit spray (art painter) out of `at` along `dir`, phase 0 → `upTo` over ~380 ms. */
function sprayOut(sc: Phaser.Scene, s: Surface, at: XY, dir: XY, floorY: number, seed: number, upTo = 1): void {
  const own = new Surface(sc, (s.px.g.depth as number) + 0.01, { screen: s.px.g.scrollFactorX === 0 });
  void animate(sc, rnd(380 * upTo), (t) => {
    own.clear();
    exitSpray(own.canvas, pt(snapXY(at)), [dir.x, dir.y], t * upTo, floorY, seed);
  }).then(() => sleep(sc, 220)).then(() => own.destroy());
}

/** The bite on a guard: three stone / wood chips flicked back off the face, two drops. */
function biteChips(sc: Phaser.Scene, s: Surface, at: XY, dir: XY, seed: number): void {
  const own = new Surface(sc, (s.px.g.depth as number) + 0.01);
  const chips = [0, 1, 2, 3, 4].map((i) => ({ vx: -dir.x * (40 + hash(seed, i, 2) * 50) + (hash(seed, i, 4) - 0.5) * 40, vy: -40 - hash(seed, i, 6) * 60, c: i < 2 ? PAL.water4 : i < 4 ? PAL.stone3 : PAL.white }));
  void animate(sc, 300, (t, el) => {
    own.clear();
    const k = el / 1000;
    for (const c of chips) {
      const x = at.x + c.vx * k;
      const y = at.y + c.vy * k + 300 * k * k;
      if (t > 0.75 && (rnd(el / 34) & 1)) continue;
      own.set(x, y, c.c);
    }
  }).then(() => own.destroy());
}

/** The panel trim splinters where the head goes in (screen plane). */
function stakeChips(sc: Phaser.Scene, at: XY, dir: XY, seed: number): void {
  const own = new Surface(sc, DEPTH.HUD + 7, { screen: true });
  void animate(sc, 260, (t, el) => {
    own.clear();
    const k = el / 1000;
    for (let i = 0; i < 4; i++) {
      const vx = -dir.x * (30 + hash(seed, i, 12) * 40) + (hash(seed, i, 13) - 0.5) * 50;
      const vy = -30 - hash(seed, i, 14) * 50;
      if (t > 0.7 && (rnd(el / 34) & 1)) continue;
      own.set(at.x + vx * k, at.y + vy * k + 260 * k * k, i % 2 ? PAL.white : PAL.earth3);
    }
  }).then(() => own.destroy());
}

/** The lost throw: the harpoon falls flat to the floor, lies a beat, blinks out (the rope with it). */
async function dropHarpoon(sc: Phaser.Scene, harp: HarpoonImg, _rope: Surface, tip: XY, ang: number, floorY: number): Promise<void> {
  const flat = Math.cos((ang * Math.PI) / 180) >= 0 ? 4 : 176;
  await animate(sc, 220, (t) => {
    const y = lerp(tip.y, floorY, t * t);
    harp.set({ x: tip.x, y }, lerp(ang, flat, t));
  });
  harp.set({ x: tip.x, y: floorY }, flat);
  await sleep(sc, 260);
  for (let i = 0; i < 4; i++) {
    if (harp.img.active) harp.img.setVisible(i % 2 === 1);
    await sleep(sc, 50);
  }
}

registerStrike(ID, (s) => (LOOK_V3 ? zipkinAtisi(s) : (s.base?.() ?? Promise.resolve())), { name: 'kartc:tide_harpooner:strike' });

// ================================================================ summon: the tide uncovers the conch

/** A held tide sheet over the tile (state set by the caller, redrawn every frame). */
function tideSheet(sc: Phaser.Scene, home: XY, depth: number, seed: number): { st: TideState; destroy(): void } {
  const s = new Surface(sc, depth);
  const st: TideState = { inK: 0, outK: 0, dry: 0 };
  let alive = true;
  let last = '';
  onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    st.t = el;
    const key = `${st.inK.toFixed(3)}|${st.outK.toFixed(3)}|${st.dry.toFixed(2)}|${Math.floor(el / 110)}`;
    if (key !== last) {
      last = key;
      s.clear();
      paintTide(s, home, st, seed);
    }
    return true;
  }, () => s.destroy());
  return {
    st,
    destroy() {
      alive = false;
    },
  };
}

async function tideEntrance(S: Stage): Promise<void> {
  const u = S.unit;
  const sc = S.scene;
  const home = S.home;
  const pan = panAt(home.x);
  const n = u.frameCount('summon');
  const landF = u.markFrame('summon', 'land', 3);
  const uprightF = Math.max(landF + 1, n - 3); // the shell is upright; the roar takes the plant over
  const tide = S.own(tideSheet(sc, home, DEPTH.CARD_ON_TILE + 3, u.uid));
  const wet = lightPool(sc, home.x, home.y, { color: PAL.water4, radius: 30, intensity: 0, anim: 'shimmer', fadeIn: 0 });
  S.own({ destroy: () => void wet.fadeOut(200) });
  wet.setIntensity(0.7, 260);
  const arrive = start('harpTideIn', { volume: 0.9, pan });
  // 0–180: tide in — a flat sheet slides over the tile from the back-left, its white leading edge moving every frame
  // (a near-linear ease: the edge never parks)
  await animate(sc, 180, (t) => (tide.st.inK = t * 0.7 + E.outQ(t) * 0.3));
  // 180–480: tide out — the sheet draws back toward the front-right, its foam line on the receding edge, and the
  // half-buried shell is UNCOVERED behind it (revealed column by column through that edge: the apex first, then the
  // length of the shell); sand clods slide off the apex once it is clear
  const spr = u.sprite;
  // (crop works in the untrimmed frame's pixels)
  const fw = spr.frame.realWidth;
  const fh = spr.frame.realHeight;
  const left = spr.x - spr.originX * fw * Math.abs(spr.scaleX);
  const hw = Math.floor(TILE_W / 2) - 2;
  u.pose('summon', 0);
  spr.setCrop(0, 0, 0, fh);
  u.showSprite();
  u.badge.setVisible(false);
  let clodsOut = false;
  await animate(sc, 300, (t) => {
    const k = t * 0.5 + E.inOutQ(t) * 0.5;
    tide.st.outK = k;
    // the receding edge on the floor row (paintTide: u = x / 2hw + 0.5 there, the edge at u = outK · 1.08)
    const ex = home.x + (Math.min(1.04, k * 1.08) - 0.5) * 2 * hw;
    const vis = clamp(rnd(ex - left), 0, fw);
    // P2 (flipX): the screen's left is the frame's right
    if (u.flipX) spr.setCrop(fw - vis, 0, vis, fh);
    else spr.setCrop(0, 0, vis, fh);
    if (!clodsOut && k > 0.45) {
      clodsOut = true;
      clods(sc, home, unitDepth(home.y) + 0.4, u.uid + 3, 3);
      play('harpShellTok', { volume: 0.55, pan, pitch: 1.15 });
    }
  });
  spr.setCrop();
  const run = u.playRange('summon', 0, uprightF);
  let cut: Promise<void> = Promise.resolve();
  atFrame(u, 'summon', landF, () => {
    arrive.stop(220);
    cut = S.climax(); // the band passes under the tile while the shell heaves out
    play('harpHeave', { volume: 0.95, pan });
    void shake(sc, 120, 1);
    clods(sc, home, unitDepth(home.y) + 0.4, u.uid);
  });
  atFrame(u, 'summon', landF + 1, () => play('harpHeave', { volume: 0.85, pan, pitch: 1.08 }));
  atFrame(u, 'summon', landF + 2, () => play('harpShellTok', { volume: 0.8, pan }));
  atFrame(u, 'summon', landF + 5, () => play('harpBubble', { volume: 1, pan, pitch: 1.2 })); // the eye stalks pop
  atFrame(u, 'summon', Math.max(landF + 6, uprightF - 1), () => play('harpShellTok', { volume: 0.9, pan, pitch: 0.92 }));
  await run;
  // the roar: rears, vapour from the apex, the harpoon spun once in the claw — and PLANTED
  const roarFrom = 3;
  if (!S.cutIn) play('harpConch', { volume: 0.9, pan });
  const roar = u.playRange('roar', roarFrom);
  atFrame(u, 'roar', 5, () => play('harpSwish', { volume: 0.75, pan, pitch: 1.1 }));
  atFrame(u, 'roar', 7, () => {
    play('harpPlant', { volume: 1, pan });
    void shake(sc, 140, 2);
    const foot = artPt(u, 'roar', 7, 'staff');
    void lightFlash(sc, foot.x, home.y, PAL.white, 18, 300, { floorY: home.y, intensity: 0.8 });
    void groundRing(sc, foot.x, home.y, { r0: 3, r1: 16, ms: 340, colors: [PAL.white, PAL.water4, PAL.water3, PAL.water2], depth: DEPTH.CARD_ON_TILE + 4, th: 1 });
    void u.badge.pop();
  });
  await roar;
  await Promise.race([cut, sleep(sc, 900)]);
  // the wet sand dries back in two palette steps (after the entrance has handed the turn back)
  void animate(sc, 300, (t) => (tide.st.dry = t < 0.5 ? 0.5 : 1)).then(() => tide.destroy());
  void wet.fadeOut(300);
  // summoned while the Bay is already up: the short (600 ms) wall rises as the turn is handed back
  void syncShroud(S.ctx, u, { short: true });
}

/** Sand clods sliding off the uncovered shell (earth3, 2 px) — they fall and lie, then blink out. */
function clods(sc: Phaser.Scene, home: XY, depth: number, seed: number, count = 5): void {
  const s = new Surface(sc, depth);
  const cl = Array.from({ length: count }, (_, i) => i).map((i) => ({ x: home.x - 14 + hash(seed, i, 1) * 26, y: home.y - 10 - hash(seed, i, 2) * 10, vx: (hash(seed, i, 3) - 0.5) * 60, floor: home.y + rnd(hash(seed, i, 4) * 6) - 2 }));
  void animate(sc, 520, (t, el) => {
    s.clear();
    const k = el / 1000;
    for (const c of cl) {
      const y = Math.min(c.floor, c.y + 340 * k * k);
      const x = c.x + c.vx * Math.min(k, 0.18);
      if (t > 0.8 && (rnd(el / 40) & 1)) continue;
      s.set(x, y, PAL.earth3).set(x + 1, y, PAL.earth2);
    }
  }).then(() => s.destroy());
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx, async () => undefined, tideEntrance);
  },
  { name: 'kartc:tide_harpooner:summon' },
);

// ================================================================ struck: the seashell tok

/**
 * The harpooner is the battle's target. On the contact frame ('v3:contact', emitted right before the kit stages it) the
 * card takes the contact over: the shared generic body blow / shield clang never start (ownContact drops them at the
 * source), the foreign motifs (the ranged counter's lightning bolt, the hex clang) are hidden on their first frame, and
 * ON that same frame its own struck sound plays for the reaction the kit chose (hit / hitHeavy / hitMagic, the death's
 * recoil) or the guard's shuck + clack. When the crab OUTCLASSES its attacker (the blow is turned), it owns the clang:
 * the claw-door clack, a nacre flick off the lip, the shell tok.
 */
function watchStruck(ctx: BattleCtx): void {
  const ev = ctx.ev;
  if (ev.targetUid === null) return;
  const u = ctx.unit(ev.targetUid);
  if (!u || !u.sprite.active) return;
  const sc = ctx.scene;
  const attacker = ctx.unit(ev.attackerUid);
  const defense = u.guarding;
  const turned = ev.result === 'attackerDestroyed' || (ev.result === 'noDestroy' && defense && (ev.targetValue ?? 0) > ev.attackerAtk) || (ev.result === 'noDestroy' && !defense);
  let fired = false;
  const onContact = () => {
    if (fired) return;
    fired = true;
    sc.events.off('v3:contact', onContact);
    ownContact(sc, { motifs: true }, () => {
      if (!u.sprite.active) return;
      const a = u.frameInfo().anim;
      const p = panAt(u.home.x);
      if (a === 'guard' || a === 'toGuard' || u.guarding) play('harpGuard', { volume: 0.95, pan: p });
      else if (turned && ev.result !== 'targetDestroyed' && ev.result !== 'bothDestroyed') {
        play('harpClack', { volume: 0.95, pan: p });
        shellClang(sc, u, attacker);
      } else {
        const name = a === 'hitMagic' ? 'harpStruckMagic' : a === 'hitHeavy' || a === 'death' ? 'harpStruckHeavy' : 'harpStruckLight';
        play(name, { volume: 0.95, pan: p });
      }
    });
  };
  sc.events.on('v3:contact', onContact);
  void sleep(sc, 6000).then(() => sc.events.off('v3:contact', onContact));
}

/**
 * The crab turns the blow: the big claw slams the aperture shut for a beat (a door-clack flash on the claw), the nacre
 * lip flicks three wet streaks back at the attacker, two drops land. Palette only, whole pixels, ~260 ms.
 */
function shellClang(sc: Phaser.Scene, u: MonsterUnit, by: MonsterUnit | null): void {
  const claw = u.framePoint(...xyOf(u.art.points?.('idle', 0).claw ?? u.art.muzzle));
  const lip = u.core();
  const toward = by && by.sprite.active ? norm(sub(by.core(), lip)) : { x: u.flipX ? -1 : 1, y: -0.3 };
  const s = new Surface(sc, u.sprite.depth + 0.3);
  const streaks = [0, 1, 2].map((i) => ({ a: Math.atan2(toward.y, toward.x) + (i - 1) * 0.32, v: 70 + i * 18 }));
  void animate(sc, 260, (t, el) => {
    s.clear();
    const k = el / 1000;
    // the clack: a 2-frame white star on the claw door (a cross, 1 px), then water4
    if (el < 70) {
      const c = el < 34 ? PAL.white : PAL.water4;
      const r = el < 34 ? 3 : 2;
      for (let d = -r; d <= r; d++) s.set(claw.x + d, claw.y, c).set(claw.x, claw.y + d, c);
    }
    // the nacre flick: three streaks off the lip, white heads, water4 tails, breaking into drops
    for (const st of streaks) {
      const len = Math.min(6, 2 + el / 20);
      const d0 = st.v * k;
      for (let d = Math.max(0, d0 - len); d <= d0; d += 0.7) {
        if (t > 0.6 && (rnd(d) & 1)) continue;
        const x = lip.x + Math.cos(st.a) * d;
        const y = lip.y + Math.sin(st.a) * d + 140 * k * k;
        s.set(x, y, d > d0 - 1.5 ? PAL.white : PAL.water4);
      }
    }
  }).then(() => s.destroy());
}
const xyOf = (p: { x: number; y: number }): [number, number] => [p.x, p.y];

registerCardHook(
  ID,
  'defend',
  (ctx) => {
    if (LOOK_V3) watchStruck(ctx);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:tide_harpooner:struck' },
);

// ================================================================ death: drawn in, buried, the harpoon stays

function burial(ctx: DestroyCtx): void {
  const u = ctx.unit(ctx.ev.uid);
  if (!u || u.retired || !u.has('death') || !u.sprite.active || !u.sprite.visible) return;
  const sc = ctx.scene;
  const n = u.frameCount('death');
  const pan = panAt(u.home.x);
  const harpF = 3;
  const dissF = u.markFrame('death', 'dissolve', 4);
  // the standing harpoon: where the idle pose plants it (relative to the sprite as it stands when it is let go)
  const harp = new HarpoonImg(sc, unitDepth(u.home.y) + 0.3);
  let tide: ReturnType<typeof tideSheet> | null = null;
  let seen = false;
  let left = false;
  let gone = false;
  let lastF = -1;
  let lastAt = -1;
  let sank = false;
  let poolHidden = false;
  const before = new Set(sc.children.list);
  const stop = onFrame(sc, (_dt, el) => {
    if (el > 5000) return false;
    const fi = u.frameInfo();
    const on = u.sprite.active && u.sprite.visible && fi.anim === 'death';
    if (on && !seen && fi.frame < dissF) {
      // the retract voice ON the first death frame shown (the kit's f1 beat is skipped when the recoil hands over past it)
      play('harpRetract', { volume: 0.95, pan });
    }
    if (on) seen = true;
    if (!on) {
      if (!seen) return el < 1200; // not on its death frames yet
      gone = true;
      return false;
    }
    if (!poolHidden && fi.frame >= dissF) {
      // the shared water accent's floor pool (a puddle is tide_golem's motif): the wet sand of the card's own tide is
      // the floor here — the pool graphics the kit opened on the dissolve frame stay hidden
      for (const c of sc.children.list) {
        if (before.has(c) || c.type !== 'Graphics') continue;
        const g = c as Phaser.GameObjects.Graphics;
        if (g.depth === DEPTH.TILE_FX + 6) {
          g.setVisible(false);
          poolHidden = true;
        }
      }
    }
    if (fi.frame === n - 1 && !sank) {
      if (lastAt < 0) lastAt = el;
      // the last frame (only the apex left): before the kit would break it as matter, the apex SINKS into the wet sand
      // (no burst, no splash, no ring) — the kit then sees no body to break and only hands the card over
      if (el - lastAt >= 50) {
        sank = true;
        sinkApex(sc, u, u.home, pan);
        u.sprite.setVisible(false);
        gone = true;
        return false;
      }
    }
    if (fi.frame !== lastF) {
      lastF = fi.frame;
      if (!left && fi.frame >= harpF) {
        left = true;
        const tip = artPt(u, 'idle', 0, 'muzzle');
        const butt = artPt(u, 'idle', 0, 'staff');
        harp.set(tip, angleOf(sub(tip, butt)));
      }
      if (!tide && fi.frame >= dissF) {
        // the tile goes wet again: the summon's wash comes in under the sinking shell and recedes
        tide = tideSheet(sc, u.home, DEPTH.CARD_ON_TILE + 3, u.uid + 9);
        const t0 = tide;
        const inMs = u.rangeMs('death', dissF, dissF + 1);
        void animate(sc, inMs, (t) => (t0.st.inK = E.outQ(t))).then(() => animate(sc, u.rangeMs('death', dissF + 1, n - 1), (t) => (t0.st.outK = t)));
      }
    }
    return true;
  }, () => {
    void (async () => {
      try {
        if (!gone && !left) return;
        if (!left) {
          // joined late: the harpoon was never let go on screen — nothing to leave standing
          return;
        }
        // the body has gone: the wet sand dries back (two palette steps) while the planted harpoon stays 0.5 s
        // (beside the card's flight), then it splinters on the dry floor
        dryTide();
        await sleep(sc, 500);
        const butt = harp.butt();
        harp.hide();
        play('harpSplinter', { volume: 0.9, pan });
        const s = new Surface(sc, unitDepth(u.home.y) + 0.3);
        await animate(sc, 620, (t) => {
          s.clear();
          splinters(s.canvas, pt(butt), t, 'left');
        });
        s.destroy();
      } finally {
        harp.destroy();
        dryTide();
      }
    })();
  });
  let dried = false;
  const dryTide = () => {
    if (dried || !tide) return;
    dried = true;
    const t0 = tide;
    void animate(sc, 300, (t) => (t0.st.dry = t < 0.5 ? 0.5 : 1)).then(() => t0.destroy());
  };
  void stop;
}

/**
 * The burial's last beat: a copy of the apex frame sinks a pixel a step below the floor line (clipped there), sand
 * grains (earth1 / earth2, 2 px) close over it from both edges, one wet sheen (water4) runs across the sand, then the
 * sand flattens back into the tile. ~380 ms, whole pixels, palette only.
 */
function sinkApex(sc: Phaser.Scene, u: MonsterUnit, home: XY, pan: number): void {
  const spr = u.sprite;
  const img = sc.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setFlipX(spr.flipX).setScale(spr.scaleX, spr.scaleY).setDepth(spr.depth);
  const fw = spr.frame.realWidth;
  const fh = spr.frame.realHeight;
  const floorRow = Math.round(spr.originY * fh); // the frame row on the floor line
  const sandS = new Surface(sc, spr.depth + 0.05);
  const y0 = spr.y;
  // the apex's columns at the floor (where the sand piles): the frame's opaque span on its floor row … a few rows up
  const half = 9;
  play('harpBury', { volume: 0.9, pan });
  void animate(sc, 380, (t, el) => {
    const k = Math.min(14, Math.floor(el / 22)); // px sunk
    img.setCrop(0, 0, fw, Math.max(0, floorRow - k + 1));
    img.setY(rnd(y0 + k));
    if (floorRow - k <= 0) img.setVisible(false);
    sandS.clear();
    const close = Math.min(1, t * 1.6);
    const w = rnd(half * (1 - close * 0.7)) + 3;
    for (let x = -half - 3; x <= half + 3; x++) {
      const edge = Math.abs(x) > w - 3;
      const hgt = edge ? (t < 0.75 ? 2 : 1) : t > 0.5 ? 1 : 0;
      for (let y = 0; y < hgt; y++) sandS.set(home.x + x, home.y - y, y === hgt - 1 ? PAL.earth2 : PAL.earth1);
      // grains rolling in over the sinking apex
      if (edge && ((x + rnd(el / 40)) & 3) === 0 && t < 0.8) sandS.set(home.x + x - Math.sign(x) * rnd(close * 3), home.y - 2, PAL.earth3);
    }
    // the single wet sheen across the closed sand
    if (t > 0.45 && t < 0.9) {
      const sx = rnd(lerp(-half, half, (t - 0.45) / 0.45));
      for (let d = 0; d < 4; d++) sandS.set(home.x + sx - d, home.y - 1, d === 0 ? PAL.white : PAL.water4);
    }
  }).then(() => {
    img.destroy();
    sandS.destroy();
  });
}

registerCardHook(
  ID,
  'destroyed',
  (ctx) => {
    if (LOOK_V3 && ctx.ev.location === 'monster' && !sourceOwnsDeath(ctx)) burial(ctx);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:tide_harpooner:death' },
);

// ================================================================ Körfez kalkanı (./tide_harpooner-shroud.ts)

// the Bay turns face-up (or leaves): every face-up harpooner's stats change by ±400
registerCardHook(
  ID,
  'statChange',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    // the plant and the wall FIRST (the cause), then the +400 outline and number (the effect): never under each other
    const u = ctx.unit(ctx.ev.uid);
    if (u) await syncShroud(ctx, u);
    await ctx.base();
  },
  { priority: 20, name: 'kartc:tide_harpooner:shroud' },
);

// flipped face-up while the Bay is already up (no statChange): the short wall after the flip
registerCardHook(
  ID,
  'flip',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    await ctx.base();
    const u = ctx.unit(ctx.ev.uid);
    if (u) await syncShroud(ctx, u, { short: true });
  },
  { priority: 20, name: 'kartc:tide_harpooner:shroud-flip' },
);


// a harpooner found shrouded without its wall (a staged duel: no event raised it) gets the resting wall at once — only on
// neutral events: the events that RAISE it (the Bay's statChange, a summon / flip while the Bay is up) are staged by their
// own hooks (the plant and the running wall), never pre-empted by a wall at rest
const NEUTRAL_EVENTS = new Set<string>(['phaseChange', 'turnStart', 'attackDeclare', 'battle', 'draw']);
registerObserver((ev, ctx) => {
  if (!LOOK_V3 || !NEUTRAL_EVENTS.has(ev.type)) return;
  try {
    const st = ctx.state;
    for (const p of [0, 1] as const)
      st.players[p].monsters.forEach((m) => {
        if (!m || !shrouded(st, m.uid)) return;
        const u = ctx.unit(m.uid);
        if (u && !u.hasAura('bayShroud')) ensureShroud(u);
      });
  } catch {
    /* bookkeeping only */
  }
});
