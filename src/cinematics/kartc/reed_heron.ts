// Sazlık Balıkçılı (reed_heron) — the card's own v3 cinematics (lane C, C8; docs/v3/oturum-c-tasarim.md §2.2).
// ?look=v3 only: every handler starts with the LOOK_V3 gate, so the old look stays byte-identical.
//
//   summon   "the mist brings him": the card slams (kit) → low, wide fog bands step in from both sides close to the
//            water (2×2 Bayer edges, steel over night4) and the tile drops one light step (the only entrance in the
//            game that LOWERS light) while the frogs croak; inside the fog he is only a dark shape → ONE gold glint in
//            a dark hole of the fog (the frogs stop dead) → the bands part and he is simply there, WHITE (a value
//            event: no hologram, no build, no rising) → the straw cloak fans open once (fuff fuff), the downdraft
//            pushes the bands out → settle; the marsh aura (./reed_heron-marsh.ts) takes the tile over.
//   board    the marsh aura on his tile: the negative pool, three drifting low mist bands, the idle soundscape.
//   strike   "Gaga Hamlesi": the neck begins to coil (declare) → snaps into a double S → a 200 ms DEAD freeze,
//            silent (the marsh's bands freeze too) → strides matched to the distance (bob-less, a ripple dot per
//            planted foot, two-row mist bands trailing; the pond and the reeds stay home; his badge steps out) →
//            the neck uncoils in one smeared frame → ta-ta-TAK as a PISTON: out (stop 40) · back · out (stop 40) ·
//            back · OUT (stop 80) on three points of a 6-px triangle, each with a needle light, droplets and a 1-px
//            give of the target; the number, the flash and the reaction on the third, the struck body's material
//            blow ~7 dB under the TAK → a single backward glide home. Blocked: tak-tak-TING — the third glances UP
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
import { DEPTH, LOOK_V3, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool } from '../../view/light';
import { hitStop, shake } from '../../vfx/core';
import { E, Px, Sparks, animate, onFrame, sleep } from '../../vfx/combat';
import { registerCardHook, registerObserver, registerStrike } from '../api';
import type { CinematicContext, StrikeArgs } from '../_core/types';
import type { GameEvent } from '../../engine/types';
import { strikeStartFrame } from '../_v3/clash';
import { atFrame, fade, hitSoundFor, hush, panAt, play, start, takeCharge } from '../_v3/sound';
import type { SfxName } from '../../audio/sfx';
import { runSummon, type Stage } from '../summon-a/_kit';
import { placeFeet } from '../strikes-a/_kit';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { GlideTrail, Ground, hash, paintBand, paintFog } from './reed_heron-fx';
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
 * The summon's world fog: low, wide horizontal bands (2–4 rows each, 2×2 Bayer edges, steel over night4) that step
 * in from both sides close to the water, a back and a front layer, covering the dark shape of the heron only in
 * part; a dark hole is kept round the eye for the glint; they part down his centre line, the wing fan pushes them
 * out, and they thin away.
 */
function summonFog(S: Stage): { set(k: Partial<{ inK: number; part: number; push: number; thin: number; hole: XY | null }>): void; destroy(): void } {
  const sc = S.scene;
  const home = S.home;
  const back = new Px(sc.add.graphics().setDepth(S.depth - 0.4));
  const front = new Px(sc.add.graphics().setDepth(S.depth + 0.4));
  // [dy above the floor, half width, layer 0 back / 1 front, rows, seed, start delay 0…1] — ≥ 1.5 tiles wide low down
  const rows: [number, number, 0 | 1, number, number, number][] = [
    [-54, 30, 0, 3, 3, 0.35],
    [-46, 42, 1, 4, 5, 0.25],
    [-38, 50, 0, 4, 7, 0.15],
    [-30, 56, 1, 4, 9, 0.08],
    [-22, 60, 0, 4, 11, 0.03],
    [-14, 62, 1, 4, 13, 0],
    [-6, 58, 1, 3, 15, 0],
  ];
  let st: { inK: number; part: number; push: number; thin: number; hole: XY | null } = { inK: 0, part: 0, push: 0, thin: 0, hole: null };
  const draw = (el: number) => {
    back.clear();
    front.clear();
    rows.forEach(([dy, hw, layer, h, seed, delay], i) => {
      if (st.thin > 0 && hash(i, 77) < st.thin) return;
      const L = layer ? front : back;
      const k = clamp((st.inK - delay) / (1 - delay), 0, 1);
      // left rows step in from the left, right rows from the right, in 3-px steps (never a smooth slide)
      const side = i % 2 ? 1 : -1;
      const from = side * 3 * Math.round((70 * (1 - E.outQ(k))) / 3);
      const drift = (Math.floor(el / 400) % 4) * side; // 1 px every 400 ms (frozen while the show is stopped)
      const half = hw + st.push;
      const y = home.y + dy;
      const holes = st.hole && Math.abs(y + 1 - st.hole.y) <= 4 ? [[st.hole.x - 5, st.hole.x + 5] as const] : undefined;
      if (k <= 0) return;
      const cx = home.x + from;
      if (st.part <= 0) paintFog(L, { x0: cx - half, x1: cx + half, y, h, off: drift, seed, holes });
      else {
        // the two halves slide apart from his centre line
        const gap = st.part;
        paintFog(L, { x0: cx - half - gap, x1: cx - gap, y, h, off: drift, seed, holes });
        paintFog(L, { x0: cx + gap, x1: cx + half + gap, y, h, off: -drift, seed: seed + 1, holes });
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
  // the marsh is there before he is: frogs + reeds, the fog stepping in from both sides
  const bed = start('heronFrogBed', { volume: 0.9, pan });
  play('heronMistIn', { volume: 0.95, pan });
  const fog = S.own(summonFog(S));
  // the tile drops one light step (the still dark water): a cool multiply pool under the tile (the marsh aura
  // takes it over, at full strength, when he has landed)
  const dark = lightPool(sc, S.home.x, S.home.y, { color: PAL.night2, radius: 30, intensity: 0.0, blend: 'multiply', fadeIn: 0, spill: null });
  dark.setIntensity(1, 360);
  let handed = false;
  S.own({ destroy: () => void (handed ? dark.destroy() : dark.fadeOut(200)) });
  u.showSprite();
  u.badge.setVisible(false);
  const played = u.playRange('summon', 0, undefined, { hold: false });
  // the bands step in over the first two frames (the heron is only a dark shape in them)
  void animate(sc, u.rangeMs('summon', 0, 2), (t) => fog.set({ inK: t }));
  // the eye glint (f2–f4): the frogs stop DEAD; one cold gold point in a dark hole of the fog
  const eye = u.art.points?.('summon', 3).head;
  const eyeW = eye ? u.framePoint(eye.x, eye.y) : null;
  atFrame(u, 'summon', 2, () => {
    bed.stop(8);
    if (eyeW) {
      fog.set({ hole: eyeW });
      void lightFlash(sc, eyeW.x, eyeW.y, PAL.gold4, 7, u.rangeMs('summon', 2, 5), { floorY: S.home.y, intensity: 0.5, air: 0.6 });
    }
  });
  // the fog parts (the bands slide 10 px apart): he is simply there, white — the value event
  atFrame(u, 'summon', 5, () => {
    play('heronMistPart', { volume: 0.9, pan });
    fog.set({ hole: null });
    void animate(sc, u.rangeMs('summon', 5, 6), (t) => fog.set({ part: rnd(10 * E.outQ(t)), thin: 0.15 * t }));
  });
  // the straw cloak fans open once: fuff fuff; the downdraft pushes the bands out 4 px and thins them
  atFrame(u, 'summon', 6, () => play('heronWingFuff', { volume: 0.95, pan }));
  atFrame(u, 'summon', 7, () => {
    fog.set({ push: 4, thin: 0.45 });
    void lightFlash(sc, S.home.x, S.home.y - 2, PAL.steel, 26, 260, { floorY: S.home.y, intensity: 0.35 });
  });
  // 'land': the cloak closes, the reeds stand back up; the badge comes in quietly (no ring, no thump)
  const landF = u.markFrame('summon', 'land', Math.max(0, n - 2));
  atFrame(u, 'summon', landF, () => {
    play('heronSettle', { volume: 0.9, pan });
    fog.set({ thin: 0.8 });
    void u.badge.pop();
  });
  atFrame(u, 'summon', landF + 1, () => fog.set({ thin: 1 }));
  await played;
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
    await runSummon(ctx, async () => undefined, heronEntrance);
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
  const f0 = held > 0 ? Math.min(held + 1, freezeF) : 0;
  const charge = takeCharge(u, 'heronCoil', { volume: 0.85, pan });
  // the home badge would sit on his neck when he glides toward the camera (P2): it steps out for the strike
  u.badge.setVisible(false);
  // layers: the glide trail (air streaks just behind the body, ripple dots on the floor) and the thrust droplets
  const trail = new GlideTrail(sc, new Px(sc.add.graphics().setDepth(unitDepth(Math.max(home.y, feet.y)) - 0.6)), new Px(sc.add.graphics().setDepth(DEPTH.CARD_ON_TILE + 3)), sgn);
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
  };
  const alive = () => spr.active && !u.retired && u.frameInfo().anim === 'attack';

  try {
    // ---- the coil (declare → f4): the tension rises… and is cut at the freeze — the hold is SILENT, the marsh's
    // mist bands and the idle sounds stop with him
    await seg(u, f0, freezeF);
    charge.stop(20);
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
    await animate(sc, glideMs, (t) => {
      const k = glide(t);
      const p = { x: lerp(home.x, feet.x, k), y: lerp(home.y, feet.y, k) };
      const si = Math.min(strides - 1, Math.floor(t * strides));
      if (si !== stride && spr.active && !u.locked) {
        stride = si;
        u.pose('attack', glideF + (si % 2));
        trail.dot({ x: rnd(p.x + sgn * (si % 2 ? -5 : 5)), y: rnd(p.y) });
        if (si % 2 === 0) play('heronSlip', { volume: si ? 0.8 : 0.9, pan: panAt(p.x), pitch: si ? 0.94 : 1 });
      }
      placeFeet(u, p);
      trail.at(p);
    });
    placeFeet(u, feet);
    trail.at(feet);
    trail.close();
    if (!spr.active || u.retired) return done();
    // ---- release (f7): the neck uncoils in one smeared frame
    u.pose('attack', relF);
    play('heronFwip', { volume: 0.9, pan: panAt(feet.x) });
    await sleep(sc, u.frameMs('attack', relF));
    // ---- ta-ta-TAK: a piston — out (stop), back, out (stop), back, OUT
    const tx0 = tgt ? tgt.sprite.x : 0;
    const flick = (f: number, k: number) => {
      if (DBG) console.warn(`[rhr] thrust f${f} shows ${u.frameInfo().frame} @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
      const m = u.art.points?.('attack', f).muzzle;
      const at = m ? u.framePoint(m.x, m.y) : u.muzzle();
      // the 1-frame needle light (the art draws the white line) and droplets flicked back off the tip
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
    const jab = async (f: number, snd: 'heronTak1' | 'heronTak2', back: number) => {
      u.pose('attack', f);
      flick(f, 0);
      give(true);
      play(snd, { volume: 0.95, pan: panAt(aim.x) });
      void shake(sc, 60, 1);
      await sleep(sc, u.frameMs('attack', f));
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
    const mat = tgt ? [hitSoundFor(tgt, { kind: 'physical', heavy: true }), hitSoundFor(tgt, { kind: 'physical', heavy: false })] : [];
    const generic: SfxName[] = ['impactHeavy', 'impactLight', ...(mat.filter(Boolean) as SfxName[])];
    play(s.blocked ? 'heronTing' : 'heronTak3', { volume: 1, pan: panAt(aim.x) });
    // the heron's tak is the event: the struck body's material blow plays ~7 dB under it, never on top of it
    const before = sc.children.list.length;
    hush(generic, () => s.impact(s.direct ? s.to : at));
    const struckSnd = mat[0];
    if (struckSnd) play(struckSnd, { volume: s.blocked ? 0.5 : 0.42, pan: panAt(aim.x) });
    if (s.blocked) {
      coolGlance(sc, u, before, at, sgn);
    }
    if (DBG) console.warn(`[rhr] impact @${Math.round(sc.time.now)} loop ${Math.round(sc.game.loop.time)}`);
    void hitStop(sc, 80);
    await sleep(sc, u.frameMs('attack', lastF));
    if (loses) {
      // the stronger side answers on this frame: the battle owns him now
      done();
      await sleep(sc, 34);
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
    const backMs = Math.max(160, u.rangeMs('attack', recF, n - 1));
    await animate(sc, backMs, (t) => {
      const e = E.inOutQ(t);
      if (spr.active) placeFeet(u, { x: lerp(from.x, home.x, e), y: lerp(from.y, home.y, e) });
    });
    if (spr.active) placeFeet(u, home);
    await Promise.race([backHome, sleep(sc, u.frameMs('attack', n - 1) + 60)]);
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
function coolGlance(sc: Phaser.Scene, u: MonsterUnit, before: number, at: XY, sgn: 1 | -1): void {
  const d0 = u.sprite.depth - 0.45;
  const d1 = u.sprite.depth - 0.05;
  const list = sc.children.list;
  for (let i = before; i < list.length; i++) {
    const o = list[i] as Phaser.GameObjects.GameObject & { depth?: number; setVisible?: (v: boolean) => unknown };
    if (typeof o.depth === 'number' && o.depth >= d0 && o.depth <= d1 && o.setVisible) o.setVisible(false);
  }
  void lightFlash(sc, at.x, at.y, PAL.white, 10, 120, { floorY: u.home.y, intensity: 0.55, air: 0.6, rise: 0 });
  const sp = new Sparks(sc, DEPTH.FX - 1);
  for (let i = 0; i < 3; i++) {
    const a = hash(i, 9, 41);
    sp.add({ x: at.x, y: at.y - 1, vx: sgn * (20 + a * 50), vy: -(70 + a * 60), ay: 420, life: 200 + a * 140, colors: [PAL.white, PAL.stone4, PAL.stone3], shape: 'px', fadeAt: 1, floor: u.home.y });
  }
  sp.release();
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
        paintBand(wisps, { x0: x - w, x1: x + w, y, off: rnd(el / 120) * side, seed: 50 + i, tone: k > 0.5 ? 2 : 1 });
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
