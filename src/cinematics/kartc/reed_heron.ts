// Sazlık Balıkçılı (reed_heron) — the card's own v3 cinematics (lane C, C8; docs/v3/oturum-c-tasarim.md §2.2).
// ?look=v3 only: every handler starts with the LOOK_V3 gate, so the old look stays byte-identical.
//
//   summon   "the mist brings him": the card slams (kit) → a fog wall rolls in from both sides and the tile drops
//            one light step (the only entrance in the game that LOWERS light) while the frogs croak → ONE eye glint
//            in the mist (the frogs stop dead) → the mist parts and he is simply there, still, in full colour (no
//            hologram, no build, no rising) → the straw cloak fans open once (fuff fuff), the downdraft pushes the
//            bands out → settle. The pose is the art's `summon` anim; this file adds the world mist, the light and
//            the sound on its frames.
//   strike   "Gaga Hamlesi": the neck coils (declare) → a 200 ms DEAD freeze, silent → two bob-less gliding
//            strides (mist streaks behind, a ripple dot per stride; the pond and the reeds stay home) → the neck
//            uncoils in one smeared frame → ta-ta-TAK: three thrusts on three points of a 6-px triangle (top,
//            bottom, centre) with micro hit-stops 40 / 40 / 80 ms, a 1-frame needle light and two droplets each; the
//            number, the EF-3 flash and the reaction on the third → a single backward glide home. Blocked: tak-tak-
//            TING, the third glances off and he hops back a stride. Direct: the glide ends at the duelist plate.
//   struck   the heron's own body sound (feather + still water) on the frame it is struck (hit / heavy / magic),
//            its guard's fuff + reed rustle (the 'defend' hook watches the battle's contact frame).
//   death    (decorates the recipe's v3 death kit, priority 20): wings close, the back-step slips on the water, the
//            mist swells over him bottom-up (the art's death pose) — and the body NEVER shatters: on the last frame
//            the mist has taken him, the kit's material break is skipped, and only the ground stays: the reeds sway
//            600 ms beside one ripple ring (its 520 → 390 Hz glide), the frogs come back, the patch fades in
//            palette steps.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { framePose } from '../../art/monsters-v3/reed_heron-anims';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, LOOK_V3, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { hitStop, shake } from '../../vfx/core';
import { E, Px, Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { registerCardHook, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import type { GameEvent } from '../../engine/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, fade, panAt, play, start, takeCharge } from '../_v3/sound';
import { runSummon, type Stage } from '../summon-a/_kit';
import { placeFeet } from '../strikes-a/_kit';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { GlideTrail, Ground, hash, paintBand, type Band } from './reed_heron-fx';

const ID = 'reed_heron';
const DBG = typeof location !== 'undefined' && location.search.includes('rhrdbg');
const rnd = Math.round;
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type BattleCtx = CinematicContext<Extract<GameEvent, { type: 'battle' }>>;

/** Facing sign (+1 P1 faces right). */
const sgnOf = (u: MonsterUnit): 1 | -1 => (u.flipX ? -1 : 1);

/** World offset of an art point from the sprite's anchor (facing aware). */
function artOffset(u: MonsterUnit, x: number, y: number): XY {
  return { x: sgnOf(u) * (x - u.art.anchorX), y: y - u.art.anchorY };
}

/**
 * The glide's distance curve: the speed ramps up over the first 20 %, holds, and brakes over the last 12 % into
 * the release — no vertical bob, a crisp stop (normalised 0 … 1).
 */
function glide(t: number): number {
  const a = 0.2;
  const b = 0.12;
  const D = a / 2 + (1 - a - b) + b / 2;
  const x = clamp(t, 0, 1);
  const d = x < a ? (x * x) / (2 * a) : x < 1 - b ? a / 2 + (x - a) : D - ((1 - x) * (1 - x)) / (2 * b);
  return d / D;
}

/** The beak tip's offset from the feet at an attack frame. */
function tipOffset(u: MonsterUnit, f: number): XY {
  const m = u.art.points?.('attack', f).muzzle ?? u.art.muzzle;
  return artOffset(u, m.x, m.y);
}

/** The ground's phases at an anim frame of the heron (so the pond the cinematic keeps matches the sprite's). */
function groundOf(anim: 'attack' | 'death', f: number): { reed: number; rip: number; mist: number; t: number } {
  const o = framePose(anim, f);
  return { reed: o.reed, rip: o.rip, mist: o.mist, t: o.t };
}

// ================================================================ summon: the mist brings him

/** The summon's world mist: a back and a front bank of bands converging on the tile, then parting. */
function summonMist(S: Stage): { set(k: Partial<{ inK: number; part: number; push: number; thin: number }>): void; destroy(): void } {
  const sc = S.scene;
  const home = S.home;
  const back = new Px(sc.add.graphics().setDepth(S.depth - 0.4));
  const front = new Px(sc.add.graphics().setDepth(S.depth + 0.4));
  // rows relative to the floor: [dy, half width, layer 0 back / 1 front, seed]
  const rows: [number, number, 0 | 1, number][] = [
    [-50, 18, 0, 3],
    [-42, 26, 0, 5],
    [-34, 30, 1, 7],
    [-26, 34, 0, 9],
    [-18, 36, 1, 11],
    [-10, 38, 0, 13],
    [-4, 40, 1, 15],
  ];
  let st = { inK: 0, part: 0, push: 0, thin: 0 };
  const draw = (el: number) => {
    back.clear();
    front.clear();
    rows.forEach(([dy, hw, layer, seed], i) => {
      if (st.thin > 0 && hash(i, 77) < st.thin) return;
      const L = layer ? front : back;
      const drift = rnd(el / 400) % 24; // 1 px every 400 ms (frozen while the show is stopped)
      const from = (i % 2 ? 1 : -1) * 46 * (1 - st.inK); // left rows come from the left, right rows from the right
      const half = hw + st.push;
      const gap = st.part / 2 + (st.part > 0 ? 1 : 0);
      const cx = home.x + rnd(from);
      const y = home.y + dy - (i < 2 ? rnd((1 - st.inK) * 6) : 0);
      if (gap <= 0) paintBand(L, { x0: cx - half, x1: cx + half, y, off: drift * (i % 2 ? 1 : -1), seed, tone: i < 2 ? 1 : 0 });
      else {
        // the two halves slide apart from the heron's centre line
        paintBand(L, { x0: cx - half - gap, x1: cx - gap, y, off: drift, seed, tone: 0 });
        paintBand(L, { x0: cx + gap, x1: cx + half + gap, y, off: -drift, seed: seed + 1, tone: 0 });
      }
    });
  };
  let alive = true;
  onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    draw(el);
    return true;
  }, () => {
    back.g.destroy();
    front.g.destroy();
  });
  return {
    set(k) {
      st = { ...st, ...k };
    },
    destroy() {
      alive = false;
    },
  };
}

async function heronEntrance(S: Stage): Promise<void> {
  const u = S.unit;
  const sc = S.scene;
  const pan = panAt(S.home.x);
  const n = u.frameCount('summon');
  // the marsh is there before he is: frogs + reeds, the mist rolling in from both sides
  const bed = start('heronFrogBed', { volume: 0.9, pan });
  play('heronMistIn', { volume: 0.95, pan });
  const mist = S.own(summonMist(S));
  // the tile drops one light step (the still dark water): a cool multiply pool under the tile
  const dark = lightPool(sc, S.home.x, S.home.y, { color: PAL.night2, radius: 30, intensity: 0.0, blend: 'multiply', fadeIn: 0, spill: null });
  dark.setIntensity(1, 360);
  S.own({ destroy: () => void dark.fadeOut(200) });
  u.showSprite();
  u.badge.setVisible(false);
  const played = u.playRange('summon', 0, undefined, { hold: false });
  // the bands roll in over the first two frames
  void animate(sc, u.rangeMs('summon', 0, 2), (t) => mist.set({ inK: E.outQ(t) }));
  // the eye glint (f2–f4): the frogs stop DEAD; one cold point of gold in the fog
  atFrame(u, 'summon', 2, () => {
    bed.stop(8);
    const eye = u.art.points?.('summon', 3).head;
    if (eye) {
      const e = u.framePoint(eye.x, eye.y);
      void lightFlash(sc, e.x, e.y, PAL.gold4, 8, u.rangeMs('summon', 2, 5), { floorY: S.home.y, intensity: 0.55, air: 0.6 });
    }
  });
  // the mist parts: the bands slide 10 px apart — he is simply there
  atFrame(u, 'summon', 5, () => {
    play('heronMistPart', { volume: 0.9, pan });
    void animate(sc, u.rangeMs('summon', 5, 7), (t) => mist.set({ part: rnd(10 * E.outQ(t)), thin: 0.25 * t }));
  });
  // the straw cloak fans open once: fuff fuff; the downdraft pushes the bands out 4 px and thins them
  atFrame(u, 'summon', 7, () => play('heronWingFuff', { volume: 0.95, pan }));
  atFrame(u, 'summon', 8, () => {
    mist.set({ push: 4, thin: 0.5 });
    void lightFlash(sc, S.home.x, S.home.y - 2, PAL.steel, 26, 260, { floorY: S.home.y, intensity: 0.35 });
  });
  // 'land': the cloak closes, the reeds stand back up; the badge comes in quietly (no ring, no thump)
  const landF = u.markFrame('summon', 'land', Math.max(0, n - 3));
  atFrame(u, 'summon', landF, () => {
    play('heronSettle', { volume: 0.9, pan });
    mist.set({ thin: 0.8 });
    void u.badge.pop();
  });
  atFrame(u, 'summon', landF + 1, () => mist.set({ thin: 1 }));
  await played;
  mist.destroy();
  void dark.fadeOut(260);
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx, async () => undefined, heronEntrance);
  },
  { name: 'kartc:reed_heron:summon' },
);

// ================================================================ strike: Gaga Hamlesi

async function beakTriple(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const sgn = sgnOf(u);
  const home: XY = { ...u.rest0 };
  const pan = panAt(home.x);
  const relF = u.markFrame('attack', 'release', 7);
  const conF = u.markFrame('attack', 'contact', relF + 3);
  const recF = u.markFrame('attack', 'recover', conF + 1);
  const n = u.frameCount('attack');
  const freezeF = relF - 3; // f4: the 200 ms dead freeze
  const glideF = relF - 2; // f5, f6: the strides
  const t1 = relF + 1;
  const t2 = relF + 2;
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  // the aim: the target's face toward him at core height (the duelist's chest for a direct attack); a guard
  // stops the beak a little earlier (its shield plane)
  // (on a monster: the upper chest, a third of the way from the core to the top — the beak strikes level and the
  // heron gets to glide up the lane to reach it; the adjacent lanes are barely a beak's length apart)
  const tgt = s.target && s.target.sprite.active ? s.target : null;
  const core = tgt ? tgt.core() : s.to;
  const top = tgt ? tgt.worldPoint('top') : core;
  const inset = s.direct ? 2 : s.blocked ? 7 : 4;
  const aim: XY = { x: rnd(core.x - sgn * inset), y: rnd(tgt ? Math.min(core.y, lerp(core.y, top.y, 0.32)) : core.y) };
  // the feet that put the centre thrust's beak tip on the aim point (the body stays a beak's length short)
  const tip = tipOffset(u, conF);
  const feet: XY = { x: rnd(aim.x - tip.x), y: rnd(aim.y - tip.y) };
  // continue from the declaration's held charge pose
  const held = strikeStartFrame(u);
  const f0 = held > 0 ? Math.min(held + 1, freezeF) : 0;
  const charge = takeCharge(u, 'heronCoil', { volume: 0.85, pan });
  const play0 = u.playRange('attack', f0);
  // layers: the glide trail (air streaks just behind the body, ripple dots on the floor) and the thrust droplets
  const trail = new GlideTrail(sc, new Px(sc.add.graphics().setDepth(unitDepth(Math.max(home.y, feet.y)) - 0.6)), new Px(sc.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 3)), sgn);
  let ground: Ground | null = null;
  let groundF = -1;
  const keepGround = onFrame(sc, (_dt, el) => {
    // the pond and the reeds stay home while the sprite is away (attack frames f5 … f12 do not draw them)
    const fi = u.frameInfo();
    const on = spr.active && fi.anim === 'attack';
    if (!on) return el < 100;
    if (fi.frame >= glideF && fi.frame < n - 1) {
      if (!ground) ground = new Ground(sc, u, home, unitDepth(home.y) - 0.2, { ...groundOf('attack', freezeF), mistK: 1 });
      if (fi.frame !== groundF) {
        groundF = fi.frame;
        ground.set({ ...groundOf('attack', fi.frame), mistK: 1 });
      }
    } else if (ground && fi.frame >= n - 1) {
      ground.destroy();
      ground = null;
    }
    return true;
  }, () => {
    ground?.destroy();
    ground = null;
  });
  const done = () => {
    keepGround();
    trail.close();
  };

  try {
    // ---- the coil (declare → f4): the tension rises… and is cut at the freeze — the hold is SILENT
    await u.playToFrame('attack', freezeF);
    charge.stop(20);
    if (!spr.active || u.frameInfo().anim !== 'attack') return done();
    // ---- the glide (f5, f6): two bob-less strides, one ripple dot each; mist streaks trail behind
    await u.playToFrame('attack', glideF);
    if (!spr.active || u.frameInfo().anim !== 'attack') return done();
    const glideMs = u.rangeMs('attack', glideF, relF);
    play('heronSlip', { volume: 0.9, pan });
    play('heronTrail', { volume: 0.85, pan: panAt(lerp(home.x, feet.x, 0.5)) });
    atFrame(u, 'attack', glideF + 1, () => {
      play('heronSlip', { volume: 0.8, pan: panAt(lerp(home.x, feet.x, 0.5)), pitch: 0.94 });
      trail.dot({ x: spr.x - sgn * 5, y: spr.y + u.art.hover });
    });
    trail.dot({ x: home.x + sgn * 5, y: home.y });
    await animate(sc, glideMs, (t) => {
      const k = glide(t);
      const p = { x: lerp(home.x, feet.x, k), y: lerp(home.y, feet.y, k) };
      placeFeet(u, p);
      trail.at(p);
    });
    placeFeet(u, feet);
    trail.at(feet);
    trail.close();
    // ---- release (f7): the neck uncoils in one smeared frame
    await u.playToFrame('attack', relF);
    play('heronFwip', { volume: 0.9, pan: panAt(feet.x) });
    // ---- ta-ta-TAK
    const thrust = (f: number, k: number) => {
      if (DBG) console.warn(`[rhr] thrust f${f} shows ${u.frameInfo().frame} @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
      const tp = u.muzzle();
      const m = u.art.points?.('attack', f).muzzle;
      const at = m ? u.framePoint(m.x, m.y) : tp;
      // the 1-frame needle light (the art draws the white line) and two droplets flicked back off the tip
      void lightFlash(sc, at.x, at.y, PAL.white, 9 + k * 3, 70, { floorY: s.toGround.y, intensity: 0.5 + 0.2 * k, air: 0.5, rise: 0 });
      const sp = new Sparks(sc, DEPTH.FX - 1);
      for (let i = 0; i < 2 + (k > 1 ? 1 : 0); i++) {
        const a = hash(f, i, 31);
        sp.add({ x: rnd(at.x - sgn * 1), y: rnd(at.y + i), vx: -sgn * (30 + a * 40), vy: -(40 + a * 50), ay: 520, life: 240 + a * 120, colors: i % 2 ? [PAL.white, PAL.water4] : [PAL.water4, PAL.water3], shape: 'px', fadeAt: 1, floor: s.toGround.y + 2 });
      }
      sp.release();
      return at;
    };
    await u.playToFrame('attack', t1);
    thrust(t1, 0);
    play('heronTak1', { volume: 0.95, pan: panAt(aim.x) });
    void shake(sc, 60, 1);
    await hitStop(sc, 40);
    await u.playToFrame('attack', t2);
    thrust(t2, 0);
    play('heronTak2', { volume: 0.95, pan: panAt(aim.x) });
    void shake(sc, 60, 1);
    await hitStop(sc, 40);
    await u.playToFrame('attack', conF);
    const at = thrust(conF, 1);
    s.impact(s.direct ? s.to : at);
    if (DBG) console.warn(`[rhr] impact @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
    void hitStop(sc, 80);
    play(s.blocked ? 'heronTing' : 'heronTak3', { volume: 1, pan: panAt(aim.x) });
    if (loses) {
      // the stronger side answers on this frame: the battle owns him now
      done();
      await sleep(sc, 34);
      return;
    }
    // ---- recover: a single backward glide home (blocked: the third glanced off — he hops back one stride first)
    let from: XY = { ...feet };
    if (s.blocked) {
      const hop: XY = { x: feet.x - sgn * 9, y: feet.y + 4 };
      await animate(sc, 110, (t) => {
        const e = E.outQ(t);
        if (spr.active) placeFeet(u, { x: lerp(feet.x, hop.x, e), y: lerp(feet.y, hop.y, e) }, Math.sin(Math.PI * t) * 3);
      });
      from = hop;
    }
    if (u.frameInfo().anim === 'attack') await u.playToFrame('attack', Math.min(recF, n - 1));
    atFrame(u, 'attack', Math.min(recF + 1, n - 1), () => play('heronMistClose', { volume: 0.9, pan }));
    const backMs = Math.max(160, u.rangeMs('attack', recF, n - 1));
    await animate(sc, backMs, (t) => {
      const e = E.inOutQ(t);
      if (spr.active) placeFeet(u, { x: lerp(from.x, home.x, e), y: lerp(from.y, home.y, e) });
    });
    if (spr.active) placeFeet(u, home);
    await Promise.race([play0, sleep(sc, u.frameMs('attack', n - 1) + 60)]);
  } finally {
    done();
    if (spr.active && !u.retired) {
      if (!loses) placeFeet(u, home);
      if (!loses && u.frameInfo().anim !== 'attack') u.rest();
    }
  }
}

registerStrike(ID, (s) => (LOOK_V3 ? beakTriple(s) : (s.base?.() ?? Promise.resolve())), { name: 'kartc:reed_heron:strike' });

// ================================================================ struck: feather + still water

/**
 * The heron is the battle's target: on the contact frame (the battle's 'v3:contact') its own struck sound plays on
 * the reaction it shows (hit / hitHeavy / hitMagic, the death's recoil) or its guard's fuff, and the generic body
 * blow is faded under it.
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
    // the reaction is set on this same tick by the battle (react.ts): read it on the next frame
    // (counted in updates, not in scene time: the contact's hit-stop freezes the clock, the sound must not wait)
    let calls = 0;
    onFrame(sc, () => {
      if (calls++ < 1) return true;
      if (!u.sprite.active) return false;
      const a = u.frameInfo().anim;
      const pan = panAt(u.home.x);
      const name = a === 'guard' || a === 'toGuard' ? 'heronGuard' : a === 'hitMagic' ? 'heronStruckMagic' : a === 'hitHeavy' || a === 'death' ? 'heronStruckHeavy' : 'heronStruck';
      fade(['impactHeavy', 'impactLight'], 30);
      play(name, { volume: 0.95, pan });
      return false;
    });
  };
  sc.events.on('v3:contact', onContact);
  // never outlive the battle
  void sleep(sc, 6000).then(() => sc.events.off('v3:contact', onContact));
}

registerCardHook(
  ID,
  'defend',
  (ctx) => {
    if (LOOK_V3) watchStruck(ctx);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:reed_heron:struck' },
);

// ================================================================ death: back into the mist — only the reeds remain

function mistDeath(ctx: DestroyCtx): void {
  const u = ctx.unit(ctx.ev.uid);
  if (!u || u.retired || !u.has('death') || !u.sprite.active || !u.sprite.visible) return;
  const sc = ctx.scene;
  const n = u.frameCount('death');
  const dissolveF = u.markFrame('death', 'dissolve', 4);
  const pan = panAt(u.home.x);
  let seen = false;
  let lastF = -1;
  let seenBefore = false;
  let done = false;
  // the back-step slips on the still water; the single ring opens as the mist reaches the head
  // the wings close (f1) and the back-step slips on the still water (f2) — scored here, on whichever frame the
  // death pose actually starts from (posematch may join it past f1 from the recoil)
  let closed = false;
  let slipped = false;
  // the bank's own world bands: two thin wisps either side, widening the art's cover bands past the body
  const wisps = new Px(sc.add.graphics().setDepth(unitDepth(u.home.y) + 0.4));
  const keep = onFrame(sc, (_dt, el) => {
    if (done || el > 4000) return false;
    const fi = u.frameInfo();
    const onDeath = u.sprite.active && u.sprite.visible && fi.anim === 'death';
    if (!onDeath) return !seen ? true : false;
    seen = true;
    wisps.clear();
    if (fi.frame >= dissolveF) {
      const k = clamp((fi.frame - dissolveF + 1) / (n - dissolveF), 0, 1);
      const feet = { x: u.sprite.x, y: u.sprite.y + u.art.hover };
      const top = rnd(feet.y - 6 - k * 50);
      for (let i = 0; i < 3; i++) {
        const y = top + i * 7;
        if (y > feet.y - 3) break;
        const side = i % 2 ? 1 : -1;
        const w = rnd(10 + 8 * (1 - k));
        const x = rnd(feet.x - 4 + side * (22 + k * 8));
        paintBand(wisps, { x0: x - w, x1: x + w, y, off: rnd(el / 120) * side, seed: 50 + i, tone: k > 0.7 ? 2 : 1 });
      }
    }
    if (fi.frame !== lastF) {
      lastF = fi.frame;
      if (!closed && fi.frame >= 1) {
        closed = true;
        play('heronWingClose', { volume: 0.9, pan });
      }
      if (!slipped && fi.frame >= 2) {
        slipped = true;
        const late = !seenBefore; // joined past f1: the slip follows the wing close by a beat
        void (late ? sleep(sc, 90) : Promise.resolve()).then(() => play('heronBackSlip', { volume: 0.9, pan }));
      }
      seenBefore = true;
      if (fi.frame === n - 1) {
        // the mist has him: the sprite goes, the ground stays (the kit finds no body to break)
        remains(u, sc, pan);
        u.sprite.setVisible(false);
        done = true;
        return false;
      }
    }
    return true;
  }, () => wisps.g.destroy());
  void keep;
}

/** What the marsh keeps: the reeds sway 600 ms by one widening ripple ring; the frogs come back; it fades in steps. */
function remains(u: MonsterUnit, sc: Phaser.Scene, pan: number): void {
  const last = framePose('death', u.frameCount('death') - 1);
  const at = { x: u.sprite.x, y: u.sprite.y };
  const g = new Ground(sc, u, at, u.sprite.depth - 0.05, { reed: last.reed, rip: last.rip, mist: last.mist, t: last.t, ring: last.ring, mistK: last.mistK, cover: last.cover, motes: last.motes });
  void (async () => {
    try {
      const SWAY = 600;
      // the ONE ripple ring: it leaves the spot he stood on and runs out past the pond's rim (its glide is the sound)
      play('heronRing', { volume: 0.9, pan });
      void sleep(sc, 420).then(() => play('heronFrogsReturn', { volume: 0.85, pan }));
      const ring = new Px(sc.add.graphics().setDepth(g.img.depth + 0.02));
      const c0 = { x: rnd(at.x + sgnOf(u) * 4), y: rnd(at.y + u.art.hover) };
      void animate(sc, SWAY + 120, (t) => {
        ring.clear();
        const rx = rnd(7 + 21 * E.outQ(t));
        const ry = Math.max(2, rnd(rx / 3.4));
        const tone = t < 0.08 ? PAL.white : t < 0.3 ? PAL.water4 : t < 0.62 ? PAL.water3 : t < 0.9 ? PAL.water1 : PAL.night2;
        ring.ellipseRing(c0.x, c0.y, rx, ry, 1, tone);
      }).then(() => ring.g.destroy());
      await animate(sc, SWAY, (t, el) => {
        // the reeds keep swaying (a slow loop); the ring widens to the pond's rim and thins to its last tone
        g.set({ reed: (last.reed + el / 2400) % 1, rip: (last.rip + el / 2400) % 1, ring: Math.min(1, last.ring + t * 0.2), mistK: t < 0.4 ? last.mistK : t < 0.75 ? 0.5 : 0, cover: el < 100 ? last.cover : 0, motes: el < 100 ? last.motes : 0 });
      });
      g.set({ ring: 0 });
      // the patch fades in palette steps toward the board, closing toward its middle
      const steps: [number, number][] = [[1, 1], [2, 0.8], [3, 0.55], [4, 0.3]];
      for (const [d, k] of steps) {
        g.step(d, k);
        await sleep(sc, 90);
      }
    } finally {
      g.destroy();
    }
  })();
}

registerCardHook(
  ID,
  'destroyed',
  (ctx) => {
    if (LOOK_V3 && ctx.ev.location === 'monster' && !sourceOwnsDeath(ctx)) mistDeath(ctx);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:reed_heron:death' },
);
