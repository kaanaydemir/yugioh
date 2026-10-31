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
import { exitSpray, ropeLine, splinters } from '../../art/monsters-v3/tide_harpooner-fx';
import type { MonsterPointName } from '../../art/types';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { GameEvent, PlayerId } from '../../engine/types';
import { DEPTH, LOOK_V3, type XY, unitDepth } from '../../view/layout';
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
import { HarpoonImg, Surface, add, angleOf, clamp, flingBeads, hash, haul, lerp, lerpXY, norm, paintTide, pt, rnd, snapXY, sub, type TideState } from './tide_harpooner-fx';
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
  const relF = u.markFrame('attack', 'release', 8);
  const payF = Math.min(n - 1, u.markFrame('attack', 'contact', relF + 1)); // the line pays out (held through the flight)
  const haulF = payF + 1;
  const ripF = payF + 2;
  const reelF = payF + 3;
  const plantF = reelF + 2;
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
  const harp = new HarpoonImg(sc, fxDepth, { screen });
  const look: RopeLook = { on: false, sag: 6, taut: false, wobble: 0, wet: 0 };
  let ropeFrom: XY | null = null;
  let shadowAt: { p: XY; d: XY } | null = null;
  let phase = 0;
  let closed = false;
  // the rope (and the flight's floor shadow) redrawn every frame from the state the beats set
  const stopRope = onFrame(sc, (dt) => {
    if (closed) return false;
    rope.clear();
    shadow.clear();
    phase += dt / 260;
    if (look.on && harp.visible) {
      const fi = u.frameInfo();
      const fr = fi.anim === 'attack' && fi.frame >= payF && fi.frame <= ripF ? fi.frame : payF;
      const src = spr.active ? M(artPt(u, 'attack', fr, 'muzzle')) : ropeFrom;
      if (src) ropeFrom = src;
      if (ropeFrom) ropeLine(rope.canvas, pt(snapXY(ropeFrom)), pt(harp.ring()), { sag: look.sag, taut: look.taut, wobble: look.wobble, phase, wet: look.wet });
    }
    if (shadowAt) {
      // the harpoon's shadow on the floor: a short night1 dash under it (reads its height over the lane)
      const { p, d } = shadowAt;
      for (let k = -5; k <= 5; k++) shadow.set(p.x + d.x * k, p.y + d.y * k, k > -3 && k < 3 ? PAL.night1 : PAL.night2);
    }
    return true;
  });
  const cleanup = () => {
    if (closed) return;
    closed = true;
    stopRope();
    rope.destroy();
    shadow.destroy();
    harp.destroy();
    // the spray finishes on its own clock (its Surface is destroyed by its animation)
  };

  // ---- the twirl: the declaration's held coil continues; the charge voice is the declaration's own
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, relF) : 0;
  const charge = takeCharge(u, 'harpTwirl', { volume: 0.85, pan });
  // one swish per twirl pass (back, top, front, back, top), pitch +8 % a pass, the pan swinging in front / behind
  for (let f = Math.max(2, f0); f <= relF - 2; f++) {
    const k = f - 2;
    atFrame(u, 'attack', f, () => play('harpSwish', { volume: 0.7 + 0.05 * k, pitch: 1 + 0.08 * k, pan: clamp(pan + (k % 2 ? 0.18 : -0.18) * sgn, -0.5, 0.5) }), { late: false });
  }
  // the front pass flings foam beads (they land as wet dots in front of the shell)
  atFrame(u, 'attack', 4, () => {
    play('harpBeads', { volume: 0.8, pan });
    flingBeads(sc, artPt(u, 'attack', 4, 'muzzle'), sgn, u.home.y + 6, unitDepth(u.home.y) + 0.6, seedN, 4);
  }, { late: false });
  atFrame(u, 'attack', 5, () => flingBeads(sc, artPt(u, 'attack', 5, 'muzzle'), sgn, u.home.y + 3, unitDepth(u.home.y) + 0.6, seedN + 5, 3), { late: false });

  try {
    void u.playRange('attack', f0, payF);
    await u.playToFrame('attack', relF);
    if (!alive()) return;
    // ---- RELEASE (60 ms, the 2-px smear is the art's)
    charge.stop(40);
    play('harpLoose', { volume: 0.95, pan });
    const tip0w = artPt(u, 'attack', relF, 'muzzle');
    void lightFlash(sc, tip0w.x, tip0w.y, PAL.white, 10, 120, { floorY: u.home.y, intensity: 0.45, air: 0.5 });
    await u.playToFrame('attack', payF);
    if (!alive()) return;

    // ---- the flight: the harpoon alone, the line paying out behind it. It leaves the claw along the line butt → aim
    // (the release pose holds it level at full reach; on the facing tile that reach is already over the target, so
    // the throw is re-aimed about the butt and always travels at least 16 px)
    const butt0 = M(artPt(u, 'attack', relF, 'staff'));
    const tipR = M(tip0w);
    const L0 = Math.max(20, Math.hypot(tipR.x - butt0.x, tipR.y - butt0.y));
    let tip0: XY;
    let tipEnd: XY;
    let hitAt: XY;
    let passT = -1; // direct: where the harpoon passes the duelist (the blow lands there)
    // aim a little above the core (the throw comes from shoulder height: the head goes through the body, not the floor)
    const tCore = tgt ? add(tgt.core(), { x: 0, y: -4 }) : s.to;
    if (s.direct) {
      // over the field, past the duelist, into the LP panel: the panel edge on the line crab → LP readout
      const lp = lpPoint(s.ctx, defender);
      tipEnd = panelEntry(tipR, lp, defender);
      tip0 = add(butt0, norm(sub(tipEnd, butt0)), L0);
      hitAt = s.to;
      const chest = M(s.to);
      const d = sub(tipEnd, tip0);
      passT = clamp(((chest.x - tip0.x) * d.x + (chest.y - tip0.y) * d.y) / (d.x * d.x + d.y * d.y || 1), 0.3, 0.92);
    } else {
      const dir0 = norm(sub(tCore, butt0));
      tip0 = add(butt0, dir0, L0);
      const proj = (tCore.x - tip0.x) * dir0.x + (tCore.y - tip0.y) * dir0.y;
      const r = tgt ? clamp(rnd(tgt.art.w * 0.12), 5, 12) : 6;
      // pierce: the head comes out of the far side (a third of the shaft through); bite: it stops on the near face
      tipEnd = bite ? add(tCore, dir0, -r) : add(tCore, dir0, Math.max(9, 18 - proj));
      if ((tipEnd.x - tip0.x) * dir0.x + (tipEnd.y - tip0.y) * dir0.y < 16) tip0 = add(tipEnd, dir0, -16);
      hitAt = bite ? tipEnd : tCore;
    }
    tip0 = snapXY(tip0);
    tipEnd = snapXY(tipEnd);
    const dir = norm(sub(tipEnd, tip0));
    const ang = angleOf(dir);
    const dist = Math.hypot(tipEnd.x - tip0.x, tipEnd.y - tip0.y);
    const flyMs = s.direct ? clamp(rnd(dist * 1.15), 280, 380) : clamp(rnd(dist * 2.4), 110, 290);
    const floorA = u.home;
    const floorB = tgt ? tgt.home : { x: s.toGround.x, y: s.toGround.y };
    const floorDir = norm(sub(floorB, floorA));
    look.on = true;
    let impacted = false;
    const doImpact = () => {
      if (impacted) return;
      impacted = true;
      s.impact(hitAt);
    };
    harp.set(tip0, ang, { smear: 2 });
    await animate(sc, flyMs, (t) => {
      const e = E.outQ(t) * 0.35 + t * 0.65;
      // straight with a 3-px gravity sag (the angle follows the curve)
      const sag = 3 * 4 * e * (1 - e);
      const p = lerpXY(tip0, tipEnd, e);
      const slope = 3 * 4 * (1 - 2 * e) / Math.max(1, dist);
      const a = ang + (Math.atan(slope) * 180) / Math.PI * (dir.x >= 0 ? 1 : -1);
      harp.set({ x: p.x, y: p.y + sag }, a, { smear: t < 0.15 ? 2 : 0 });
      look.sag = lerp(7, 1, e);
      if (!screen) shadowAt = { p: snapXY(lerpXY(floorA, floorB, e)), d: floorDir };
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
      // the stake: the head buried in the panel, a dry thock, a few splinters of the panel trim
      harp.set(add(tipEnd, dir, 4), ang, { bury: 7 });
      play('harpStake', { volume: 0.95, pan: dir.x > 0 ? 0.35 : -0.35 });
      stakeChips(sc, tipEnd, dir, seedN);
    } else {
      doImpact();
      play(bite ? 'harpTang' : 'harpWetTok', { volume: 1, pan: panAt(hitAt.x) });
      if (!bite && tgt) {
        // the harpoon now runs THROUGH the body: drawn behind it, the shaft out of the near side, the head out of the far one
        harp.setDepth(tgt.sprite.depth - 0.3);
        sprayOut(sc, spray, add(tCore, dir, 9), dir, floorB.y + 2, seedN);
      } else biteChips(sc, spray, tipEnd, dir, seedN);
    }
    if (loses) {
      // the stronger side answers on this frame (the handler owns the attacker now): the line goes slack, the
      // harpoon drops out of the guard and lies on the floor a beat, then blinks out
      look.on = false;
      void dropHarpoon(sc, harp, rope, tipEnd, ang, (tgt?.home.y ?? tipEnd.y + 20) + 3).then(cleanup);
      await sleep(sc, 34);
      return;
    }
    // the harpoon rides the struck body (the kit's knock, then the pull)
    const tPos0 = tgt ? { x: tgt.sprite.x, y: tgt.sprite.y } : null;
    let stuck = true;
    const ride = onFrame(sc, () => {
      if (!stuck || closed) return false;
      if (tgt && tPos0 && tgt.sprite.active) harp.set(add(tipEnd, sub({ x: tgt.sprite.x, y: tgt.sprite.y }, tPos0)), ang, s.direct ? { bury: 7 } : {});
      return true;
    });
    await sleep(sc, 120);
    if (!spr.active || u.retired) return;

    // ---- HAUL 1: rear legs plant, the rope snaps straight and a step brighter; the target comes TOWARD the crab
    const toHaul = u.playRange('attack', haulF, ripF);
    look.taut = true;
    look.sag = 0;
    play('harpHaul', { volume: 1, pan });
    void shake(sc, 90, 1);
    if (tgt && tgt.sprite.active) haul(tgt, u.home, bite ? 1 : 3, { hold: tDies });
    if (s.direct) shakePanel(s.ctx, defender);
    await toHaul;
    if (!alive()) return;

    // ---- HAUL 2: the rip-out, the slack wobble; the harpoon reeled back head-first along the wet line
    stuck = false;
    ride();
    look.taut = false;
    look.sag = 4;
    look.wobble = 2;
    look.wet = 1;
    // the shaft turns round its middle (point first → head first) and comes back along the line
    const tipNow = harp.tip();
    const buttNow = harp.butt();
    const mid = lerpXY(tipNow, buttNow, 0.5);
    const half = Math.hypot(tipNow.x - buttNow.x, tipNow.y - buttNow.y) / 2;
    const from = snapXY(add(mid, dir, -half));
    if (!bite && !s.direct) {
      play('harpRip', { volume: 0.95, pan: panAt(tipNow.x) });
      sprayOut(sc, spray, tCore, { x: -dir.x, y: -dir.y }, floorB.y + 2, seedN + 3, 0.6);
    } else play('harpRip', { volume: 0.7, pan: panAt(tipNow.x), pitch: 1.12 });
    harp.setDepth(fxDepth);
    const endTip = M(artPt(u, 'attack', reelF, 'muzzle'));
    const endButt = M(artPt(u, 'attack', reelF, 'staff'));
    const endAng = angleOf(sub(endTip, endButt));
    const reelDist = Math.hypot(endTip.x - from.x, endTip.y - from.y);
    const reelMs = clamp(rnd(reelDist * 0.75), u.frameMs('attack', ripF), 280);
    void sleep(sc, 40).then(() => play('harpReel', { volume: 0.9, pan: panAt(lerp(from.x, u.home.x, 0.5)) }));
    await animate(sc, reelMs, (t, el) => {
      const e = E.inQ(t) * 0.5 + t * 0.5;
      // it tumbles round on the first frames (point first → head first), then flies head-first
      if (el < 34) {
        // one tumbling frame across the line, centred where it was
        const ra = ((ang + 90) * Math.PI) / 180;
        harp.set(snapXY({ x: mid.x + Math.cos(ra) * half, y: mid.y + Math.sin(ra) * half }), ang + 90);
      } else harp.set(lerpXY(from, endTip, e), endAng);
      look.sag = lerp(4, 7, t);
    });
    // ---- caught: the art draws the harpoon (and the coiled line) from here
    look.on = false;
    harp.hide();
    const rest = u.playRange('attack', reelF);
    atFrame(u, 'attack', plantF, () => {
      play('harpReplant', { volume: 0.9, pan });
      const foot = artPt(u, 'attack', plantF, 'staff');
      void lightFlash(sc, foot.x, u.home.y, PAL.white, 12, 220, { floorY: u.home.y, intensity: 0.5 });
    });
    await rest;
  } finally {
    cleanup();
    if (spr.active && !u.retired && !loses && u.frameInfo().anim !== 'attack') u.rest();
  }
}

/** Where the line crab → LP readout enters the panel (screen), the head 6 px inside its trim. */
function panelEntry(from: XY, lp: XY, p: PlayerId): XY {
  // the panels as drawn (P2's v3 plate is ~46 px tall, P1's the full 64)
  const r = p === 0 ? { x: 4, y: 292, w: 148, h: 64 } : { x: 488, y: 4, w: 148, h: 46 };
  const d = sub(lp, from);
  let best = 1;
  const test = (t: number, ok: boolean) => {
    if (ok && t > 0 && t < best) best = t;
  };
  if (d.x !== 0) {
    for (const x of [r.x, r.x + r.w]) {
      const t = (x - from.x) / d.x;
      const y = from.y + d.y * t;
      test(t, y >= r.y && y <= r.y + r.h);
    }
  }
  if (d.y !== 0) {
    for (const y of [r.y, r.y + r.h]) {
      const t = (y - from.y) / d.y;
      const x = from.x + d.x * t;
      test(t, x >= r.x && x <= r.x + r.w);
    }
  }
  const e = lerpXY(from, lp, best);
  const n = norm(d);
  return snapXY(add(e, n, 6));
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
async function dropHarpoon(sc: Phaser.Scene, harp: HarpoonImg, rope: Surface, tip: XY, ang: number, floorY: number): Promise<void> {
  rope.clear();
  const flat = Math.cos((ang * Math.PI) / 180) >= 0 ? 4 : 176;
  await animate(sc, 220, (t) => {
    const y = lerp(tip.y, floorY, t * t);
    harp.set({ x: tip.x, y }, lerp(ang, flat, t));
  });
  harp.set({ x: tip.x, y: floorY }, flat);
  await sleep(sc, 260);
  for (let i = 0; i < 4; i++) {
    harp.img.setVisible(i % 2 === 1);
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
  // 0–260: tide in (a flat sheet from the back-left, white leading edge)
  await animate(sc, 260, (t) => (tide.st.inK = E.outQ(t)));
  // 260–: tide out — the sheet draws back and UNCOVERS the half-buried apex
  u.showSprite();
  u.badge.setVisible(false);
  const run = u.playRange('summon', 0, uprightF);
  void animate(sc, u.rangeMs('summon', 0, landF), (t) => (tide.st.outK = E.inOutQ(t)));
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
  const roarFrom = 2;
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
  // the wet sand dries back in two palette steps
  await animate(sc, 260, (t) => (tide.st.dry = t < 0.5 ? 0.5 : 1));
  tide.destroy();
  void wet.fadeOut(260);
  // summoned while the Bay is already up: the short (600 ms) wall
  await syncShroud(S.ctx, u, { short: true });
}

/** Sand clods sliding off the uncovered shell (earth3, 2 px) — they fall and lie, then blink out. */
function clods(sc: Phaser.Scene, home: XY, depth: number, seed: number): void {
  const s = new Surface(sc, depth);
  const cl = [0, 1, 2, 3, 4].map((i) => ({ x: home.x - 14 + hash(seed, i, 1) * 26, y: home.y - 10 - hash(seed, i, 2) * 10, vx: (hash(seed, i, 3) - 0.5) * 60, floor: home.y + rnd(hash(seed, i, 4) * 6) - 2 }));
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
 * The harpooner is the battle's target: on the contact frame ('v3:contact') its own struck sound plays on the reaction it
 * shows (hit / hitHeavy / hitMagic, the death's recoil) or its guard's shuck + clack; the generic body blow fades under it.
 */
function watchStruck(ctx: BattleCtx): void {
  const ev = ctx.ev;
  if (ev.targetUid === null) return;
  const u = ctx.unit(ev.targetUid);
  if (!u || !u.sprite.active) return;
  const sc = ctx.scene;
  let fired = false;
  const onContact = () => {
    if (fired) return;
    fired = true;
    sc.events.off('v3:contact', onContact);
    let calls = 0;
    onFrame(sc, () => {
      if (calls++ < 1) return true;
      if (!u.sprite.active) return false;
      const a = u.frameInfo().anim;
      const p = panAt(u.home.x);
      const name = a === 'guard' || a === 'toGuard' ? 'harpGuard' : a === 'hitMagic' ? 'harpStruckMagic' : a === 'hitHeavy' || a === 'death' ? 'harpStruckHeavy' : 'harpStruckLight';
      fade(['impactHeavy', 'impactLight'], 30);
      play(name, { volume: 0.95, pan: p });
      return false;
    });
  };
  sc.events.on('v3:contact', onContact);
  void sleep(sc, 6000).then(() => sc.events.off('v3:contact', onContact));
}

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
  const stop = onFrame(sc, (_dt, el) => {
    if (el > 5000) return false;
    const fi = u.frameInfo();
    const on = u.sprite.active && u.sprite.visible && fi.anim === 'death';
    if (on) seen = true;
    if (!on) {
      if (!seen) return el < 1200; // not on its death frames yet
      gone = true;
      return false;
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
    const u = ctx.unit(ctx.ev.uid);
    const base = ctx.base();
    if (u) await syncShroud(ctx, u);
    await base;
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


// a harpooner found shrouded without its wall (a staged duel: no event raised it) gets the resting wall at once
registerObserver((_ev, ctx) => {
  if (!LOOK_V3) return;
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
