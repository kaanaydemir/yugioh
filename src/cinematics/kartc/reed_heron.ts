// Sazlık Balıkçılı (reed_heron) — the card's own v3 cinematics (lane C, C8; docs/v3/oturum-c-tasarim.md §2.2).
// ?look=v3 only: every handler starts with the LOOK_V3 gate, so the old look stays byte-identical.
//
//   summon   "the mist brings him": the frogs croak from the card slam on → marsh WISPS (3–6 px stepped lenses,
//            reed_heron-mist.ts) step in from both tile edges, clipped to the tile, and the tile drops one light step
//            (the only entrance in the game that LOWERS light); he is NOT drawn (no ghost, no alpha) → ONE gold glint
//            in a dark hole of the fog: the frogs and the mist stop dead, ~270 ms of silence → the wisps part and he
//            is simply there, WHITE (a value event: no hologram, no build, no rising) → the straw cloak fans open
//            once (fuff fuff), the downdraft pushes the wisps out → settle; the marsh aura takes the tile over.
//   board    the marsh aura on his tile: the negative pool, three drifting low mist bands, the idle soundscape.
//   strike   "Gaga Hamlesi": the neck begins to coil (declare) → snaps into a double S → a 200 ms DEAD freeze,
//            silent (the marsh's bands freeze too) → strides matched to the distance (bob-less, a ripple dot per
//            planted foot (one slip each), mist trailing; a 300-ms scene glide; the pond and the reeds stay home)
//            → the neck uncoils in one smeared frame as he stops → ta-ta…TAK as a PISTON: out (stop 40) · back ·
//            out (stop 40) · back longer · OUT (stop 80) on three points of a 6-px triangle, each with a ONE-frame
//            needle light, droplets, a nick left on the target and a 1-px give; on the third the nicks flash as one
//            white triangle and a small stepped pool lights the floor (the shared contact flash and burst are hidden:
//            the pinpoint IS the contact), the struck body's material blow ~7 dB under the TAK → a glide home. Blocked: tak-tak-TING — the third glances UP
//            off the guard (the deflect frame is the contact, one cold spark; the counter's warm burst is kept off
//            him), he hops back a stride. Direct: the glide ends at the duelist plate.
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
import { DEPTH, LOOK_V3, TILE_W, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { hitStop, shake } from '../../vfx/core';
import { E, Px, Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { registerCardHook, registerObserver, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import type { GameEvent } from '../../engine/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, fade, hitSoundFor, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import type { SfxHandle, SfxName } from '../../audio/sfx';
import { runSummon, type Stage } from '../summon-a/_kit';
import { placeFeet } from '../strikes-a/_kit';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { GlideTrail, Ground, Pinpoint, hash, needleFlash } from './reed_heron-fx';
import { paintBank, paintWisp, type BankState } from '../../art/monsters-v3/reed_heron-mist';
import { ensureMarsh, marshOf, MARSH } from './reed_heron-marsh';

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

/**
 * The summon's fog BANK (reed_heron-mist.ts paintBank): ten overlapping marsh lenses standing from the water line up
 * past his crown, a little wider than the bird at every height, drawn IN FRONT of the body — an occluder, not a
 * decoration. They step in from both tile edges in 3-px steps (clipped to the tile diamond + 8 px), breathe 1 px
 * every 400 ms, keep a small dark hole at the eye for the glint; he stands in it hidden (≥ 95 % of his pixels under
 * mist on the frame he is first drawn), then the bank tears down his centre line in three stepped moves (3, 3, 4 px a
 * half, head first, the water lenses last) and the wing fan's downdraft blows the halves out in 3-px steps.
 */
function summonFog(S: Stage): { set(k: Partial<BankState & { hole: readonly [number, number, number, number] | null }>): void; destroy(): void } {
  const sc = S.scene;
  const home = S.home;
  const sgn = sgnOf(S.unit);
  const front = new Px(sc.add.graphics().setDepth(S.depth + 0.4));
  const maxHalf = Math.round(TILE_W / 2 + 8);
  const clip: [number, number] = [home.x - maxHalf, home.x + maxHalf];
  let st: BankState & { hole: readonly [number, number, number, number] | null } = { inK: 0, steps: 0, push: 0, thin: 0, hole: null };
  const run = (y: number, x0: number, x1: number, c: number) => void front.run(y, x0, x1, c);
  let alive = true;
  onFrame(sc, (_dt, el) => {
    if (!alive) return false;
    front.clear();
    // 1 px every 400 ms, 0 → 1 → 0 (frozen while the show is stopped)
    const drift = [0, 1, 1, 0][Math.floor(el / 400) % 4];
    paintBank(run, rnd(home.x), rnd(home.y), sgn, { ...st, drift: st.steps > 0 ? 0 : drift }, { clip, hole: st.hole });
    return true;
  }, () => front.g.destroy());
  return {
    set(k) {
      st = { ...st, ...k };
    },
    destroy() {
      alive = false;
    },
  };
}

/** The frog bed, started on the card slam (the marsh is there before he is) and handed to the entrance. */
let pendingBed: SfxHandle | null = null;

async function heronEntrance(S: Stage): Promise<void> {
  const u = S.unit;
  const sc = S.scene;
  const pan = panAt(S.home.x);
  const n = u.frameCount('summon');
  // the marsh is there before he is: the frogs have croaked since the card slam; the fog steps in from both sides
  const bed = pendingBed ?? start('heronFrogBed', { volume: 0.9, pan });
  pendingBed = null;
  const mistIn = start('heronMistIn', { volume: 0.95, pan });
  const eye = u.art.points?.('summon', 3).head;
  const eyeW = eye ? u.framePoint(eye.x, eye.y) : null;
  const fog = S.own(summonFog(S));
  // the tile drops one light step (the still dark water): a cool multiply pool under the tile (the marsh aura
  // takes it over, at full strength, when he has landed)
  const dark = lightPool(sc, S.home.x, S.home.y, { color: PAL.night2, radius: 30, intensity: 0.0, blend: 'multiply', fadeIn: 0, spill: null });
  dark.setIntensity(1, 360);
  let handed = false;
  S.own({ destroy: () => void (handed ? dark.destroy() : dark.fadeOut(200)) });
  // the sprite shows only the water and the reeds until f5 (the art does not draw him in the fog: no ghost, no
  // alpha, no build — MA-4); the eye glint is the one sign of him
  u.showSprite();
  u.badge.setVisible(false);
  const played = u.playRange('summon', 0, undefined, { hold: false });
  void animate(sc, u.rangeMs('summon', 0, 2), (t) => fog.set({ inK: t }));
  // the eye glint (f2–f4): the frogs AND the mist stop dead — silence, one cold gold point in a dark hole of the bank
  atFrame(u, 'summon', 2, () => {
    bed.stop(8);
    mistIn.stop(12);
    if (eyeW) {
      fog.set({ hole: [rnd(eyeW.x) - 3, rnd(eyeW.x) + 3, rnd(eyeW.y) - 1, rnd(eyeW.y) + 1] });
      void lightFlash(sc, eyeW.x, eyeW.y, PAL.gold4, 7, u.rangeMs('summon', 2, 5), { floorY: S.home.y, intensity: 0.5, air: 0.6 });
    }
  });
  // f5: the glint goes out and he is drawn — standing IN the bank, hidden; the bank tears down his centre line in
  // three stepped moves (head first, the water last): the white plumage is uncovered band by band
  atFrame(u, 'summon', 5, () => {
    fog.set({ hole: null });
    void (async () => {
      await sleep(sc, 50);
      play('heronMistPart', { volume: 0.9, pan });
      for (let k = 1; k <= 3; k++) {
        fog.set({ steps: k, thin: k === 3 ? 0.15 : 0 });
        if (k < 3) await sleep(sc, 70);
      }
    })();
  });
  // the straw cloak fans open once: fuff fuff; the downdraft blows the torn halves out (3-px steps) and thins them
  atFrame(u, 'summon', 6, () => play('heronWingFuff', { volume: 0.95, pan }));
  atFrame(u, 'summon', 7, () => {
    fog.set({ steps: 3 });
    void animate(sc, 200, (t) => fog.set({ push: 3 * Math.min(5, Math.floor(t * 6)), thin: 0.2 + 0.6 * t }));
    void lightFlash(sc, S.home.x, S.home.y - 2, PAL.steel, 26, 260, { floorY: S.home.y, intensity: 0.35 });
  });
  // 'land': the cloak closes, the reeds stand back up; the badge comes in quietly (no ring, no thump)
  const landF = u.markFrame('summon', 'land', Math.max(0, n - 2));
  atFrame(u, 'summon', landF, () => {
    play('heronSettle', { volume: 0.9, pan });
    fog.set({ steps: 3, push: 18, thin: 0.9 });
    void u.badge.pop();
  });
  atFrame(u, 'summon', landF + 1, () => fog.set({ thin: 1 }));
  await played;
  bed.stop(40);
  mistIn.stop(40);
  fog.destroy();
  // the marsh stays on the tile: its negative pool replaces the entrance's at full strength (no flicker)
  ensureMarsh(sc, u, { instant: true });
  handed = true;
  dark.destroy();
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
    // the frogs start with the card slam: by the eye glint the marsh has croaked 4–5 times across three pans
    pendingBed?.stop(0);
    pendingBed = start('heronFrogBed', { volume: 0.9, pan: panAt(zoneXY(ctx.ev.player, 'monster', ctx.ev.zone).x) });
    try {
      await runSummon(ctx, async () => undefined, heronEntrance);
    } finally {
      pendingBed?.stop(30);
      pendingBed = null;
    }
  },
  { name: 'kartc:reed_heron:summon' },
);

// a heron already on the board (a staged duel, a loaded game, a flip, a revive) gets its marsh on the first event
// that sees it face-up; a retired unit drops its auras by itself (MonsterUnit.retire)
registerObserver((_ev, ctx) => {
  if (!LOOK_V3) return;
  for (const st of [ctx.state, ctx.after]) {
    for (const pl of st.players) {
      for (const slot of pl.monsters) {
        if (!slot || !slot.faceUp) continue;
        if (st.cards[slot.uid]?.cardId !== ID) continue;
        const u = ctx.unit(slot.uid);
        // (not during its own entrance: the summon hands the marsh over itself)
        if (u && u.visible && u.sprite.visible && u.frameInfo().anim !== 'summon') ensureMarsh(ctx.scene, u);
      }
    }
  }
});

// ================================================================ threatened: the heron goes still

/**
 * A heron that is attacked FREEZES: from the declaration on, its idle loop walks the shortest way (one frame per
 * ~2 game frames, forward or back) to idle f0 and holds it — the statue-still wader — until the blow (its struck
 * f0 is drawn from idle f0: the contact frame stays local whatever phase the loop was in, KK-4 / HA-21) or, when
 * no blow comes, ~4.5 s later, when the loop simply resumes from f0. The marsh around him keeps living.
 */
function stillOnThreat(sc: Phaser.Scene, u: MonsterUnit): void {
  if (DBG) console.error(`[rhr] still? locked ${u.locked} pos ${u.position} guarding ${u.guarding} anim ${u.frameInfo().anim}:${u.frameInfo().frame}`);
  if (!u.sprite.active || u.retired || u.locked || u.position !== 'attack' || u.guarding) return;
  const fi = u.frameInfo();
  if (fi.anim !== 'idle') return;
  const n = u.frameCount('idle');
  let k = fi.frame;
  const dir = k <= n / 2 ? -1 : 1;
  let acc = 0;
  let held = k === 0;
  // (stop the loop on the frame it shows now; the walk to f0 starts on the next step)
  u.pose('idle', k);
  // a loop restarted later in the same step is pulled back before the frame is drawn
  const guard = () => {
    const f = u.frameInfo();
    if (u.sprite.active && !u.retired && !u.locked && f.anim === 'idle' && (f.frame !== k || u.sprite.anims.isPlaying)) u.pose('idle', k);
  };
  sc.events.on('prerender', guard);
  onFrame(sc, (dt, el) => {
    if (!u.sprite.active || u.retired || u.locked) return false;
    // something else took the sprite over (the struck pose, a strike of his own, a flip): it owns him now; a
    // restarted idle loop (the battle's settle of the rest pose) is pulled back to where the walk is
    const f = u.frameInfo();
    if (f.anim !== 'idle') {
      if (DBG) console.error(`[rhr] still: taken over at ${f.anim}:${f.frame} (k ${k}, el ${Math.round(el)})`);
      return false;
    }
    if (f.frame !== k || u.sprite.anims.isPlaying) u.pose('idle', k);
    if (!held) {
      acc += dt;
      if (acc < 30 && k !== 0) return true;
      acc = 0;
      if (k !== 0) k = (k + dir + n) % n;
      u.pose('idle', k);
      if (k === 0) held = true;
      return true;
    }
    if (el > 4500) {
      u.rest();
      return false;
    }
    return true;
  }, () => sc.events.off('prerender', guard));
}

registerObserver((ev, ctx) => {
  if (!LOOK_V3 || ev.type !== 'attackDeclare' || ev.targetUid === null) return;
  if (ctx.state.cards[ev.targetUid]?.cardId !== ID) return;
  const u = ctx.unit(ev.targetUid);
  if (u) stillOnThreat(ctx.scene, u);
});

// ================================================================ strike: Gaga Hamlesi

/**
 * Play attack frames from → to and hold `to` (the strike drives the frames itself: the piston needs exact frames,
 * and the micro hit-stops sit between them).
 */
function seg(u: MonsterUnit, from: number, to: number): Promise<void> {
  if (u.locked || !u.sprite.active) return Promise.resolve();
  if (to <= from) {
    u.pose('attack', to);
    return Promise.resolve();
  }
  return u.playRange('attack', from, to);
}

async function beakTriple(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const sgn = sgnOf(u);
  const home: XY = { ...u.rest0 };
  const pan = panAt(home.x);
  const relF = u.markFrame('attack', 'release', 7);
  const conF = u.markFrame('attack', 'contact', relF + 5);
  const recF = u.markFrame('attack', 'recover', conF + 2);
  const n = u.frameCount('attack');
  const freezeF = relF - 3; // f4: the 200 ms dead freeze
  const glideF = relF - 2; // f5, f6: the stride pair
  const [t1, r1, t2, r2] = [relF + 1, relF + 2, relF + 3, relF + 4];
  const deflF = conF + 1;
  const loses = s.ctx.ev.result === 'attackerDestroyed' || s.ctx.ev.result === 'bothDestroyed';
  // the aim: the target's face toward him at core height (the duelist's chest for a direct attack); a guard
  // stops the beak a little earlier (its shield plane)
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
  // (from the held coil f1 the neck SNAPS: straight to f3, the f2 in-between is the sheet's, not the strike's)
  const f0 = held > 0 ? Math.min(held + 2, freezeF) : 0;
  const charge = takeCharge(u, 'heronCoil', { volume: 0.85, pan });
  // the home badge would sit on his neck when he glides toward the camera (P2): it steps out for the strike
  u.badge.setVisible(false);
  // layers: the glide trail (air streaks just behind the body, ripple dots on the floor) and the thrust droplets
  const trail = new GlideTrail(sc, new Px(sc.add.graphics().setDepth(unitDepth(Math.max(home.y, feet.y)) - 0.6)), new Px(sc.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 3)), sgn);
  // the heron's own contact mark: a nick per thrust, the triangle on the third, a small floor pool
  const pin = new Pinpoint(sc, DEPTH.FX - 0.5, DEPTH.CARD_ON_TILE + 3, sgn);
  let ground: Ground | null = null;
  let groundF = -1;
  const keepGround = onFrame(sc, (_dt, el) => {
    // the pond and the reeds stay home while the sprite is away (attack frames f5 … f15 do not draw them)
    const fi = u.frameInfo();
    const on = spr.active && fi.anim === 'attack';
    if (!on) return el < 100 || !!ground;
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
    pin.close();
  };
  const alive = () => spr.active && !u.retired && u.frameInfo().anim === 'attack';

  try {
    // ---- the coil (declare → f4): the tension rises… and is cut at the freeze — the hold is SILENT, the marsh's
    // mist bands and the idle sounds stop with him
    await seg(u, f0, freezeF);
    // the cut: the coil (at its crest) and the shared declaration's tail stop together — the freeze is SILENT
    charge.stop(20);
    fade(['attackDeclare', 'lockOn'], 30);
    if (DBG) console.warn(`[rhr] freeze @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
    marshOf(u)?.freeze(u.frameMs('attack', freezeF));
    if (!alive()) return done();
    await sleep(sc, u.frameMs('attack', freezeF));
    if (!alive()) return done();
    // ---- the glide: strides that match the distance (12–13 px each, the feet planted: f5 / f6 alternate), no
    // vertical bob; a ripple dot under each planted foot; mist bands trail behind
    const glideMs = u.rangeMs('attack', glideF, relF);
    if (DBG) console.warn(`[rhr] glide @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
    const dist = Math.hypot(feet.x - home.x, feet.y - home.y);
    const strides = clamp(2 * Math.round(dist / 25), 2, 6);
    play('heronTrail', { volume: 0.85, pan: panAt(lerp(home.x, feet.x, 0.5)) });
    let stride = -1;
    // the release rides the glide's braking tail: the neck uncoils in one smeared frame as the body comes to rest
    // (the last `relMs` of the glide), so the first thrust leaves straight from the stop
    const relMs = u.frameMs('attack', relF);
    const relAt = 1 - relMs / Math.max(1, glideMs + relMs);
    let released = false;
    await animate(sc, glideMs + relMs, (t) => {
      const k = glide(Math.min(1, t / relAt));
      const p = { x: lerp(home.x, feet.x, k), y: lerp(home.y, feet.y, k) };
      if (t >= relAt && !released) {
        released = true;
        if (spr.active && !u.locked) u.pose('attack', relF);
        play('heronFwip', { volume: 0.9, pan: panAt(feet.x) });
        trail.close();
      }
      const si = Math.min(strides - 1, Math.floor((t / relAt) * strides));
      if (!released && si !== stride && spr.active && !u.locked) {
        stride = si;
        u.pose('attack', glideF + (si % 2));
        trail.dot({ x: rnd(p.x + sgn * (si % 2 ? -5 : 5)), y: rnd(p.y) });
        // one slip per planted stride: the two feet alternate pitch, the second ~2 dB down
        play('heronSlip', { volume: si % 2 ? 0.72 : 0.9, pan: panAt(p.x), pitch: si % 2 ? 0.94 : 1 });
      }
      placeFeet(u, p);
      trail.at(p);
    });
    placeFeet(u, feet);
    trail.at(feet);
    trail.close();
    if (!spr.active || u.retired) return done();
    // ---- ta-ta-TAK: a piston — out (stop), back, out (stop), back, OUT
    const tx0 = tgt ? tgt.sprite.x : 0;
    const flick = (f: number, k: number) => {
      if (DBG) console.warn(`[rhr] thrust f${f} shows ${u.frameInfo().frame} @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
      const m = u.art.points?.('attack', f).muzzle;
      const at = m ? u.framePoint(m.x, m.y) : u.muzzle();
      // the needle light for exactly one frame (drawn here, not in the art) and droplets flicked back off the tip
      needleFlash(sc, DEPTH.FX - 0.4, at, sgn);
      void lightFlash(sc, at.x, at.y, PAL.white, 9 + k * 3, 70, { floorY: s.toGround.y, intensity: 0.5 + 0.2 * k, air: 0.5, rise: 0 });
      const sp = new Sparks(sc, DEPTH.FX - 1);
      for (let i = 0; i < 2 + (k > 1 ? 1 : 0); i++) {
        const a = hash(f, i, 31);
        sp.add({ x: rnd(at.x - sgn * 1), y: rnd(at.y + i), vx: -sgn * (30 + a * 40), vy: -(40 + a * 50), ay: 520, life: 240 + a * 120, colors: i % 2 ? [PAL.white, PAL.water4] : [PAL.water4, PAL.water3], shape: 'px', fadeAt: 1, floor: s.toGround.y + 2 });
      }
      sp.release();
      return at;
    };
    /** Thrusts 1 and 2 register on the target too: a 1-px give away from the beak for the micro stop. */
    const give = (on: boolean) => {
      if (!tgt || !tgt.sprite.active || tgt.retired || tgt.locked) return;
      tgt.sprite.x = on ? tx0 + sgn : tx0;
    };
    // (the out-hold IS the 40 ms micro-stop — snapped, not held; the time goes to the retract and the re-aim:
    // retract 1 is short and retract 2 longer, so the rhythm reads ta-ta…TAK)
    const jab = async (f: number, snd: 'heronTak1' | 'heronTak2', back: number) => {
      u.pose('attack', f);
      pin.nick(flick(f, 0));
      give(true);
      play(snd, { volume: 0.95, pan: panAt(aim.x) });
      void shake(sc, 60, 1);
      await hitStop(sc, 40);
      give(false);
      if (!alive()) return;
      u.pose('attack', back);
      if (DBG) console.warn(`[rhr] retract f${back} @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
      await sleep(sc, u.frameMs('attack', back));
    };
    await jab(t1, 'heronTak1', r1);
    if (!alive()) return done();
    await jab(t2, 'heronTak2', r2);
    if (!alive()) return done();
    // the third: on a monster or a duelist the TAK lands level; on a guard that holds, the beak glances UP off it
    // (the deflect frame is the contact: TING, one cold spark — the battle's own counter burst is kept off him)
    const lastF = s.blocked ? deflF : conF;
    if (s.blocked) {
      u.pose('attack', conF);
      await sleep(sc, 17);
    }
    u.pose('attack', lastF);
    const at = flick(conF, 1);
    if (s.blocked) pin.close();
    else {
      pin.nick(at);
      // (the pool lights the floor at the target's near edge, between the two: under its body it would be hidden)
      pin.land(tgt ? { x: s.toGround.x - sgn * 13, y: s.toGround.y + 3 } : null);
    }
    const mat = tgt ? [hitSoundFor(tgt, { kind: 'physical', heavy: true }), hitSoundFor(tgt, { kind: 'physical', heavy: false })] : [];
    // (blocked: the guard's shared shield bell is skipped in the contact call and re-played far under the TING)
    const generic: SfxName[] = ['impactHeavy', 'impactLight', ...(s.blocked ? (['shieldBlock'] as SfxName[]) : []), ...(mat.filter(Boolean) as SfxName[])];
    play(s.blocked ? 'heronTing' : 'heronTak3', { volume: 1, pan: panAt(aim.x) });
    // the heron's tak is the event: the struck body's material blow plays ~7 dB under it, never on top of it
    const before = sc.children.list.length;
    hush(generic, () => s.impact(s.direct ? s.to : at));
    const struckSnd = mat[0];
    if (struckSnd) play(struckSnd, { volume: s.blocked ? 0.5 : 0.42, pan: panAt(aim.x) });
    // the target's shared contact flash (_v3/flash.ts: a white banded disc on the struck body) is the most
    // generic frame of any strike: the heron's pinpoint (three nicks → the triangle, the floor pool) IS its contact
    hideContactFlash(sc, before, tgt ? tgt.sprite.depth : null);
    if (s.blocked) {
      play('shieldBlock', { volume: 0.3, pitch: 1.25, pan: panAt(aim.x) });
      coolGlance(sc, u, before, at, sgn);
    } else if (loses) {
      noBacklash(sc, before);
    }
    if (DBG) console.warn(`[rhr] impact @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
    void hitStop(sc, 80);
    await sleep(sc, u.frameMs('attack', lastF));
    if (loses) {
      // the stronger side answers on this frame: the battle owns him now
      done();
      await sleep(sc, 17);
      return;
    }
    // ---- recover: a single backward glide home (blocked: the third glanced off — he hops back one stride first,
    // while the battle's recoil plays the spring of his neck)
    let from: XY = { ...feet };
    if (s.blocked) {
      const hop: XY = { x: feet.x - sgn * 9, y: feet.y + 4 };
      await animate(sc, 110, (t) => {
        const e = E.outQ(t);
        if (spr.active) placeFeet(u, { x: lerp(feet.x, hop.x, e), y: lerp(feet.y, hop.y, e) }, Math.sin(Math.PI * t) * 3);
      });
      from = hop;
    }
    const backHome = seg(u, recF, n - 1);
    atFrame(u, 'attack', Math.min(recF + 1, n - 1), () => play('heronMistClose', { volume: 0.9, pan }));
    const backMs = Math.max(140, u.rangeMs('attack', recF, n - 1));
    await animate(sc, backMs, (t) => {
      const e = E.inOutQ(t);
      if (spr.active) placeFeet(u, { x: lerp(from.x, home.x, e), y: lerp(from.y, home.y, e) });
    });
    if (spr.active) placeFeet(u, home);
    await Promise.race([backHome, sleep(sc, u.frameMs('attack', n - 1) + 30)]);
  } finally {
    done();
    if (spr.active && !u.retired) {
      if (!loses) {
        placeFeet(u, home);
        void u.badge.pop();
      }
      if (!loses && u.frameInfo().anim === 'attack' && !u.locked) u.rest();
    }
  }
}

/**
 * Blocked: the counter-blow's generic burst (star, rings, sparks in the DEFENDER's ramp — warm tones on the quietest
 * water card) that the battle drew behind the heron on the contact is kept hidden; the heron's own glance replaces
 * it: one cold white / stone4 spark (the art's deflect frame) and three steel splinters flicking up off the tip.
 * Only objects created by that one synchronous contact call, at the counter burst's depth band behind his body, are
 * touched.
 */
/**
 * The beak is a melee weapon, but its tip stands a long neck away from his body, so the battle reads the clash as a
 * RANGED one and sends the generic backlash bolt (a jagged line in the stronger side's warm ramp) up his neck. That
 * one additive image (`_v3/clash.ts backlash`: an ADD-blended Raster at DEPTH.FX + 3) created by the contact call is
 * kept hidden: the answer lands on him through his own recoil and the cold spark, never as a beam.
 */
function noBacklash(sc: Phaser.Scene, before: number): void {
  const list = sc.children.list;
  for (let i = before; i < list.length; i++) {
    const o = list[i] as Phaser.GameObjects.GameObject & { depth?: number; blendMode?: number | string; setVisible?: (v: boolean) => unknown };
    // (blend mode 1 = Phaser.BlendModes.ADD; Phaser is a type-only import here)
    if (o.type === 'Image' && o.depth === DEPTH.FX + 3 && o.blendMode === 1 && o.setVisible) o.setVisible(false);
  }
}

/** Hide the shared contact flash image(s) the contact call made on the struck body (fx:cflash:*) and its burst. */
function hideContactFlash(sc: Phaser.Scene, before: number, bodyDepth: number | null): void {
  const list = sc.children.list;
  for (let i = before; i < list.length; i++) {
    // (the flash re-applies the body's visibility every frame, so it is cropped to nothing instead of hidden)
    const o = list[i] as Phaser.GameObjects.GameObject & { texture?: { key: string }; setCrop?: (x: number, y: number, w: number, h: number) => unknown };
    if (o.type === 'Image' && o.texture?.key.startsWith('fx:cflash:') && o.setCrop) o.setCrop(0, 0, 0, 0);
    // and the shared impact burst behind the struck body (_v3/react.ts behindBody: star, air rings, grit at the
    // body's depth − 0.4 … − 0.1 — the white crescent ray over the head, the grey ring that opens round it): hidden
    const g = o as Phaser.GameObjects.GameObject & { depth?: number; setVisible?: (v: boolean) => unknown };
    if (bodyDepth !== null && o.type === 'Graphics' && typeof g.depth === 'number' && g.depth >= bodyDepth - 0.45 && g.depth < bodyDepth - 0.05 && g.setVisible) g.setVisible(false);
    // a guard's ward flash (an ADD-blended white / gold star disc over the body, just in front of it): hidden — the
    // glance is told by his own cold spark at the tip; the hex ward that follows stays the defender's
    const a = o as Phaser.GameObjects.GameObject & { depth?: number; blendMode?: number | string; setVisible?: (v: boolean) => unknown };
    if (bodyDepth !== null && o.type === 'Image' && a.blendMode === 1 && typeof a.depth === 'number' && a.depth > bodyDepth && a.depth < bodyDepth + 1 && a.setVisible) a.setVisible(false);
  }
}

function coolGlance(sc: Phaser.Scene, u: MonsterUnit, before: number, at: XY, sgn: 1 | -1): void {
  const d0 = u.sprite.depth - 0.45;
  const d1 = u.sprite.depth - 0.05;
  const list = sc.children.list;
  for (let i = before; i < list.length; i++) {
    const o = list[i] as Phaser.GameObjects.GameObject & { depth?: number; setVisible?: (v: boolean) => unknown };
    if (typeof o.depth !== 'number' || !o.setVisible) continue;
    if (o.depth >= d0 && o.depth <= d1) o.setVisible(false);
    // the guard's clang (vfx/combat blockClang: a gold / white clang star drawn with the hex plate at DEPTH.FX + 0.1,
    // white / gold / fire streaks + metal grit at DEPTH.FX + 0.2) is warm tones on the coldest card's glance: hidden
    // — the glance is his own cold spark and splinters; the guard's BLOK badge and its recoil still say "blocked"
    else if (o.type === 'Graphics' && (Math.abs(o.depth - (DEPTH.FX + 0.2)) < 1e-6 || Math.abs(o.depth - (DEPTH.FX + 0.1)) < 1e-6)) o.setVisible(false);
  }
  noBacklash(sc, before);
  void lightFlash(sc, at.x, at.y, PAL.white, 10, 120, { floorY: u.home.y, intensity: 0.55, air: 0.6, rise: 0 });
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 6; i++) {
    const a = hash(i, 9, 41);
    // three splinters flick up off the tip, three cold grains spray back off the ward toward him
    const up = i < 3;
    sp.add({ x: at.x, y: at.y - 1, vx: (up ? sgn : -sgn) * (20 + a * 50), vy: up ? -(70 + a * 60) : -(20 + a * 30), ay: 420, life: 200 + a * 140, colors: up ? [PAL.white, PAL.stone4, PAL.stone3] : [PAL.mist, PAL.steel], shape: 'px', fadeAt: 1, floor: u.home.y });
  }
  sp.release();
}

registerStrike(ID, (s) => (LOOK_V3 ? beakTriple(s) : (s.base?.() ?? Promise.resolve())), { name: 'kartc:reed_heron:strike' });

// ================================================================ the pond never slides: no kit shove

/**
 * The heron's recoils and its death DRAW the give (knock 'pose': the body rocks back, the death steps back); the
 * shared kit still shoves the whole sprite on a blow from behind and on a lethal blow — and the sprite carries the
 * still pond and the reeds, so the floor would slide under him. While `ms` run, after every update (the shove's
 * tween runs in the update, the frame is drawn after), a sprite pushed 1–4 px off its rest spot is put back and
 * the shove's tween stopped. A unit standing far from home (his own strike) is never touched.
 */
function pinHome(sc: Phaser.Scene, u: MonsterUnit, ms: number): () => void {
  const spr = u.sprite;
  const home = { ...u.rest0 };
  const t0 = sc.time.now;
  let on = true;
  const off = () => {
    if (!on) return;
    on = false;
    sc.events.off('postupdate', hold);
  };
  function hold(): void {
    if (!spr.active || u.retired || sc.time.now - t0 > ms) return off();
    const a = u.frameInfo().anim;
    if (a === 'attack' || a === 'summon') return;
    const dx = spr.x - home.x;
    const dy = spr.y - home.y;
    if ((dx === 0 && dy === 0) || Math.abs(dx) > 4 || Math.abs(dy) > 4) return;
    for (const tw of sc.tweens.getTweensOf(spr)) if (tw.data.some((d) => { const k = (d as { key?: string }).key; return k === 'x' || k === 'y'; })) tw.stop();
    spr.setPosition(home.x, home.y);
  }
  sc.events.on('postupdate', hold);
  return off;
}

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
  // the drawn give replaces the kit's shove for the whole battle (pinHome)
  pinHome(sc, u, 6000);
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
  // the killing blow does not shove him: the death's own drawn back-step is the give (pinHome)
  const unpin = pinHome(sc, u, 4000);
  const keep = onFrame(sc, (_dt, el) => {
    if (done || el > 4000) return false;
    const fi = u.frameInfo();
    const onDeath = u.sprite.active && u.sprite.visible && fi.anim === 'death';
    if (!onDeath) return !seen ? true : false;
    seen = true;
    wisps.clear();
    if (fi.frame >= dissolveF) {
      // two world wisps flank the art's cover stack (the bank is wider than the bird): they climb with the cover
      // line in 2-px steps, one each side, leaning outward, and thin to the far tone as he goes
      const k = clamp((fi.frame - dissolveF + 1) / (n - dissolveF), 0, 1);
      const feet = { x: u.sprite.x, y: u.sprite.y + u.art.hover };
      const top = feet.y - 6 - 2 * rnd(k * 22);
      const run = (y: number, x0: number, x1: number, c: number) => void wisps.run(y, x0, x1, c);
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1;
        const y = top + 6 + i * 9;
        if (y > feet.y - 4) continue;
        paintWisp(run, { cx: rnd(feet.x - 4 + side * (24 + k * 6) + side * (Math.floor(el / 300) % 2)), y, h: i ? 4 : 5, hw: rnd(11 - 3 * k), lean: side, seed: 50 + i * 9, tone: k > 0.6 ? 2 : 1 });
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
  }, () => {
    wisps.g.destroy();
    unpin();
  });
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
      // the marsh's own pool and bands go with the ground
      if (!u.retired) u.setAura(MARSH, null);
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
