// Uçurtma Eskrimci (kite_fencer, C9) — the card's own v3 presentation (docs/v3/oturum-c-tasarim.md §2.4,
// YENI_KARTLAR C9, §5.2). v3 look only: every handler starts with `if (!LOOK_V3) …base()`, so v1 is untouched.
//
//   strike, 1st attack  "Pike": the shortest charge of the lane (the declaration's held charge pose + 140 ms of full
//                       wind-up), ONE perfectly straight fleche home → target (Expo.Out, 150 ms) behind a 1-px needle
//                       line at blade height (white → mist → steel → gone), the tip's white cross star on contact,
//                       hit-stop 60, two small back-hops home — on landing the indicator panel LIGHTS (the plucked
//                       string "one attack left"). Blocked: the blade bows (two drawn frames) and springs back, he skids.
//                       Direct: the same fleche at the duelist (direct is only ever the first attack).
//   strike, 2nd attack  "Uçurtma Süzülüşü" (monster only; the slot's attacksThisTurn === 2): the panel flares, the cloak
//                       spreads and billows, the string goes taut to a pin on the home tile, he LIFTS OFF (18 px up and
//                       back, hanging under the kite, shadow left on the floor), the kite carries him over and he swings
//                       down a PENDULUM arc whose bottom is beside the target at body height — a lateral curved cut
//                       across the body (a curved 1-px white slit, linen fibres), hit-stop 80 — the arc carries on up,
//                       the wind spills, a braking glide home with a knee dip; the panel goes OUT (gold4 → gold3 → off).
//                       The two attacks share nothing but the rapier: path, rhythm, trail and sound all differ.
//   summon              the EMPTY kite drifts down from above the screen like a leaf (3 slowing sways, 3 tilt maps,
//                       the string trailing above — never a dive, never a vertical drop), lands flat on the tile (a cloth
//                       flop; each panel throws a 1-frame coloured pool), a bump rises under it, he stands up under the
//                       kite, the cloth slides onto his shoulders, the salute (a tip glint), snapped down: idle.
//   death (decoration)  the recipe's deathV3 plays the art's death pose (string taut → SNAP → rapier drops → the cloak
//                       tears off → the body thins to a sliver → a linen scrap, the rapier clattering twice); this file
//                       adds the snapped ends whipping back, and the CLOAK FLYING OFF SCREEN (600 ms, swaying, 4 tilt
//                       maps; top-right for player 1, top-left for player 2) with its receding flutter.
//   indicator panel     the upper leading kite panel glows gold (gold4 core, fire4 rim, a 2-step pulse on 1.2 s, a small
//                       gold pool under that side) while: face-up, attack position, attacksThisTurn === 1, battle phase.
//                       It dims out in 2 steps on the phase change / turn start; the 2nd attack's own flare takes over.
//   struck body         the kite cloth: a stretched-fabric snap + bamboo click + rapier rattle ticks (kfnStruck), a
//                       wrap snap on the guard (kfnGuardWrap), scored on the contact frame instead of the generic blow.
// Camera: never touched (EF-8). Sounds fire on the animation's own frames (the scene clock: atFrame / the timeline).

import type Phaser from 'phaser';
import type { MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { AnyMonsterAnim } from '../../art/types';
import { AX, GY } from '../../art/monsters-v3/kite_fencer-rig';
import { attackPose, framePoints, panelPoint, tailPoint } from '../../art/monsters-v3/kite_fencer-anims';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable } from '../../duel/types';
import { onDuelStart } from '../../duel/seeds';
import { DEPTH, LOOK_V3, type XY, unitDepth } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Px, animate, onFrame, setCombatSfx, sleep, stopTime } from '../../vfx/combat';
import { registerCardHook, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { warmPoses } from '../_v3/warm';
import { fade, panAt, play, start, takeCharge } from '../_v3/sound';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage, type SummonCtx } from '../summon-a/_kit';
import { anchoredImage, cutSlit, glanceSparks, kiteImage, kiteTexture, layer, needleLine, poseTexture, snapWhips, tautString, threadMote, tipTrail, type Light } from './kite_fencer-fx';

const ID: MonsterId = 'kite_fencer';
const R = Math.round;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
const sineIn = (t: number) => 1 - Math.cos((t * Math.PI) / 2);
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);
const quadOut = (t: number) => 1 - (1 - t) * (1 - t);
const quadInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Deterministic per-moment random (films and measures stay repeatable). */
function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x6b17e) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const lightOf = (u: MonsterUnit): Light => (u.flipX ? 'right' : 'left');
/** +1: faces right (player 1), −1: faces left (player 2). */
const sgnOf = (u: MonsterUnit): 1 | -1 => (u.flipX ? -1 : 1);

/** A frame point of `anim` f as an offset from the art anchor in WORLD orientation (flip aware). */
function offsetOf(u: MonsterUnit, p: { x: number; y: number }): XY {
  return { x: sgnOf(u) * (p.x - AX), y: p.y - GY };
}
/** The rapier tip of the art's frame (frame px). */
function tipOf(anim: AnyMonsterAnim, f: number): { x: number; y: number } {
  return framePoints(anim, f).muzzle ?? { x: AX + 20, y: GY - 20 };
}
function tipOffset(u: MonsterUnit, anim: AnyMonsterAnim, f: number): XY {
  return offsetOf(u, tipOf(anim, f));
}

/** The battle event's slot count: 1 = the first attack, 2 = the second (rules.ts declareAttack, replayed). */
function attackCount(s: StrikeArgs): number {
  const ev = s.ctx.ev;
  const slot = s.ctx.state.players[ev.player]?.monsters[ev.attackerZone];
  return slot?.attacksThisTurn ?? 1;
}

/** Hold one sheet frame (MonsterUnit.pose; ignored while another cinematic claims the unit). */
function show(u: MonsterUnit, anim: AnyMonsterAnim, f: number): void {
  if (u.sprite.active && !u.locked) u.pose(anim, f);
}

function place(u: MonsterUnit, p: XY): void {
  const s = u.sprite;
  if (s.active) s.setPosition(R(p.x), R(p.y));
}

// ================================================================ the indicator panel (one attack left)

const PANEL_KEY = 'kitePanel';
/** Units whose panel is lit now (so the phase change / turn start can dim them). */
const lit = new Map<number, MonsterUnit>();
onDuelStart(() => lit.clear());

/** The 5-px panel diamond: gold4 core 3×3, a 1-px rim (corners left out). */
function paintPanel(px: Px, x: number, y: number, rim: number, core: number, step: 0 | 1 | 2): void {
  if (step === 2) {
    px.dot(x, y, PAL.gold3);
    return;
  }
  if (step === 1) {
    px.rect(x - 1, y - 1, 3, 3, PAL.gold3);
    return;
  }
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const ax = Math.abs(dx);
      const ay = Math.abs(dy);
      if ((ax === 2 && ay === 2) || ax + ay > 3) continue;
      px.dot(x + dx, y + dy, ax <= 1 && ay <= 1 ? core : rim);
    }
}

/**
 * The lit panel as an aura riding the unit: drawn on the current frame's panel point (panelPoint of the art: only
 * while the kite is on his back), a 2-step pulse on a 1.2 s period, and a small gold pool under that side of the
 * body. destroy() dims it out in 2 steps (quiet: false skips the steps — the 2nd attack's flare takes over).
 */
function panelAura(scene: Phaser.Scene, u: MonsterUnit): Disposable & { quiet(): void } {
  const s = u.sprite;
  const px = new Px(scene.add.graphics().setDepth(s.depth + 0.4));
  let pool: LightHandle | null = null;
  let dimAt = -1;
  let now = 0;
  let alive = true;
  const kill = () => {
    if (!alive) return;
    alive = false;
    halt();
    px.g.destroy();
    const p = pool;
    pool = null;
    if (p && p.alive) void p.fadeOut(160);
  };
  const halt = onFrame(scene, (_dt, el) => {
    now = el;
    if (!s.active || u.retired) {
      kill();
      return false;
    }
    px.g.setDepth(s.depth + 0.4);
    px.clear();
    const step: 0 | 1 | 2 | 3 = dimAt < 0 ? 0 : (Math.min(3, 1 + Math.floor((el - dimAt) / 90)) as 1 | 2 | 3);
    if (step === 3) {
      kill();
      return false;
    }
    const fi = u.frameInfo();
    const pt = s.visible && s.alpha > 0.5 && fi.anim ? panelPoint(fi.anim, fi.frame) : null;
    if (pt) {
      const w = u.framePoint(pt.x, pt.y);
      const pulse = Math.floor(el / 600) % 2 === 0;
      paintPanel(px, R(w.x), R(w.y), pulse ? PAL.fire4 : PAL.fire3, PAL.gold4, step as 0 | 1 | 2);
    }
    if (!pool && dimAt < 0) {
      const h = u.home;
      const side = u.framePoint(AX - 8, GY);
      pool = lightPool(scene, R(side.x), h.y, { color: PAL.gold4, spill: PAL.gold2, radius: 10, floorY: h.y, intensity: 0.3, anim: 'breathe', fadeIn: 120 });
    }
    return true;
  });
  return {
    destroy() {
      if (!alive || dimAt >= 0) return;
      dimAt = now;
      const p = pool;
      pool = null;
      if (p && p.alive) void p.fadeOut(180);
    },
    quiet() {
      kill();
    },
  };
}

function lightPanel(scene: Phaser.Scene, u: MonsterUnit): void {
  if (u.retired || !u.sprite.active || u.position !== 'attack') return;
  u.setAura(PANEL_KEY, panelAura(scene, u));
  lit.set(u.uid, u);
}

/** Dim the panel: in 2 steps (the phase ends), or at once (quiet: the 2nd attack's flare replaces it). */
function dimPanel(u: MonsterUnit | null | undefined, quiet = false): void {
  if (!u) return;
  lit.delete(u.uid);
  const a = u.aura(PANEL_KEY) as (Disposable & { quiet?: () => void }) | null;
  if (!a) return;
  if (quiet) a.quiet?.();
  // MonsterUnit.setAura(null) destroys it: a dying panel keeps running its own 2 steps
  u.setAura(PANEL_KEY, null);
}

if (LOOK_V3) {
  registerObserver((ev: GameEvent) => {
    if (!lit.size) return;
    if (ev.type === 'phaseChange' || ev.type === 'turnStart') {
      for (const u of [...lit.values()]) dimPanel(u);
    } else if ((ev.type === 'destroy' || ev.type === 'positionChange') && lit.has(ev.uid)) {
      dimPanel(lit.get(ev.uid));
    } else if (ev.type === 'attackDeclare' && lit.has(ev.attackerUid)) {
      // the 2nd attack: its own flare (special f1) takes over on the declared frame
      dimPanel(lit.get(ev.attackerUid), true);
    } else if (ev.type === 'controlChange') {
      for (const u of [...lit.values()]) dimPanel(u);
    }
  });
}

// ================================================================ attack 1: "Pike"

async function pike(s: StrikeArgs, nth: number): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const sgn = sgnOf(u);
  const home: XY = { ...u.rest0 };
  const pan = panAt(home.x);
  // the declaration's held charge voice goes on (the same breath + squeak), else a fresh one
  const ch = takeCharge(u, 'kfnPikeCharge', { volume: 0.9, pan });
  // ---- charge: from the declaration's held frame to the full wind-up (f3, the longest hold)
  const f0 = strikeStartFrame(u);
  if (f0 < 3) await u.playRange('attack', Math.max(1, f0), 3, { exclusive: true });
  show(u, 'attack', 3);
  await sleep(sc, u.frameMs('attack', 3));
  // ---- release: the fleche — one perfectly straight dash (Expo.Out)
  const tip4 = tipOffset(u, 'attack', 4);
  const tip5 = tipOffset(u, 'attack', 5);
  // stop where the tip meets the core (the target's, or the duelist's chest); never past the target's tile
  const aim = s.to;
  const stop: XY = { x: R(aim.x - tip5.x), y: R(aim.y - tip5.y) };
  const depth0 = u.sprite.depth;
  const tDepth = s.target ? s.target.sprite.depth : depth0;
  show(u, 'attack', 4);
  ch.stop(50);
  play('kfnFleche', { pan, volume: 0.95 });
  const dist = Math.hypot(stop.x - home.x, stop.y - home.y);
  const travel = Math.round(Math.min(190, 120 + dist * 0.15));
  const tipStart: XY = { x: home.x + tip4.x, y: home.y + tip4.y };
  const nl = needleLine(sc, tipStart, () => ({ x: u.sprite.x + tip4.x, y: u.sprite.y + tip4.y }), Math.max(depth0, tDepth) + 0.6);
  if (!s.direct && s.target) u.sprite.setDepth(Math.max(depth0, tDepth + 0.5));
  await animate(sc, travel, (t) => place(u, lerpXY(home, stop, cubicOut(t))));
  place(u, stop);
  nl.land();
  // ---- contact: the tip's white cross star (f5), the needle "tsst-çın", hit-stop 60
  show(u, 'attack', 5);
  const at: XY = { x: R(stop.x + tip5.x), y: R(stop.y + tip5.y) };
  if (s.blocked && !s.direct) {
    await blockedPike(s, at, stop, home, depth0, pan);
    return;
  }
  s.impact(at);
  play('kfnTsst', { pan: panAt(at.x), volume: 1 });
  void lightFlash(sc, at.x, at.y, PAL.white, 10, 120, { floorY: s.toGround.y, intensity: 0.7 });
  void stopTime(sc, 60);
  await sleep(sc, Math.round(u.frameMs('attack', 5) * 0.5));
  if (u.claimed || u.retired) return; // a loser is taken over on the contact frame (battle.ts)
  await backHops(s, stop, home, depth0, nth, pan);
}

/** Two small back-hops home (f6–f9); the panel lights on the landing when a second attack is left. */
async function backHops(s: StrikeArgs, from: XY, home: XY, depth0: number, nth: number, pan: number): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const mid = lerpXY(from, home, 0.56);
  const k = Math.min(1.6, Math.max(1, Math.hypot(from.x - home.x, from.y - home.y) / 70));
  const hop = async (a: XY, b: XY, fUp: number, fDown: number, h: number) => {
    const upMs = Math.round(u.frameMs('attack', fUp) * k);
    const dnMs = Math.round(u.frameMs('attack', fDown) * k * 0.6);
    show(u, 'attack', fUp);
    await animate(sc, upMs + dnMs, (t) => {
      if (t > upMs / (upMs + dnMs)) show(u, 'attack', fDown);
      const e = quadInOut(t);
      const p = lerpXY(a, b, e);
      place(u, { x: p.x, y: p.y - Math.sin(Math.PI * t) * h });
    });
    place(u, b);
    show(u, 'attack', fDown);
    play('kfnSqueak', { pan: panAt(b.x), volume: 0.8 });
  };
  await hop(from, mid, 6, 7, 5);
  u.sprite.setDepth(depth0);
  await hop(mid, home, 8, 9, 4);
  const lights = nth === 1 && !u.retired && u.position === 'attack';
  if (lights) {
    play('kfnPanelOn', { pan, volume: 0.9 });
    lightPanel(sc, u);
  }
  await sleep(sc, Math.round(u.frameMs('attack', 9) * 0.5));
  place(u, home);
  if (!u.retired && !u.locked) u.rest();
}

/** Blocked: the blade bows on the guard (two drawn frames) and springs back; he skids back off it. */
async function blockedPike(s: StrikeArgs, at: XY, stop: XY, home: XY, depth0: number, pan: number): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const light = lightOf(u);
  const flip = u.flipX;
  const bowIn = poseTexture(sc, 'bowIn', { ...attackPose(5), star: 0, bow: 3, smear: 0 }, light);
  const bowOut = poseTexture(sc, 'bowOut', { ...attackPose(6), bow: -2, lean: 1, sink: 2 }, light);
  // the contact (the sprite is visible for the battle's reading of it), then the bowing frame over it
  s.impact(at);
  play('kfnBlockBow', { pan: panAt(at.x) });
  const img = anchoredImage(sc, bowIn, spr.x, spr.y, flip, spr.depth);
  spr.setVisible(false);
  try {
    // the hit-stop (scene time frozen) holds the bow; one frame after it the blade springs back
    await sleep(sc, 50);
    img.setTexture(bowOut);
    const back: XY = { x: stop.x - (stop.x - home.x) * 0.12, y: stop.y - (stop.y - home.y) * 0.12 };
    await animate(sc, 70, (t) => {
      const p = lerpXY(stop, back, quadOut(t));
      img.setPosition(R(p.x), R(p.y));
      place(u, p);
    });
  } finally {
    img.destroy();
    if (spr.active) spr.setVisible(true);
  }
  // he skids back (the recoil pose belongs to the battle's counter while it plays) — 2 floor scuffs
  const from: XY = { x: spr.x, y: spr.y };
  const skid: XY = lerpXY(from, home, 0.22);
  const scuff = layer(sc, DEPTH.CARD_ON_TILE + 2);
  await animate(sc, 120, (t) => {
    const p = lerpXY(from, skid, quadOut(t));
    place(u, p);
    scuff.clear();
    const n = Math.round(t * 5);
    for (let i = 0; i < n; i++) scuff.dot(R(lerp(from.x, p.x, i / 5)) - sgnOf(u) * 2, R(lerp(from.y, p.y, i / 5)), PAL.stone2);
  });
  void sleep(sc, 160).then(() => scuff.g.destroy());
  play('kfnSqueak', { pan, volume: 0.7, pitch: 0.9 });
  if (u.retired) return;
  // wait out the battle's recoil pose (it hands the sprite back), then hop home
  let guard = 0;
  while (u.claimed && !u.retired && guard++ < 8) await sleep(sc, 30);
  if (u.retired) return;
  await backHops(s, skid, home, depth0, attackCount(s), pan);
}

// ================================================================ attack 2: "Uçurtma Süzülüşü"

/**
 * Attack 2's beat lengths (scene ms; the art's holds are the sheet's — the cinematic plays the frames on its own
 * clock so the flight, the sounds and the frames stay locked): charge 260, rise 200, swing 284 to the cut, exit 100,
 * glide 220 (≈ 1.45 s with the declaration's 0.3 s; spec 2.2 s ÷ 1.25 = 1.75 s scene, trimmed to the 3.19 s gate
 * with a slow-dying target).
 */
const KT: Record<number, number> = { 1: 50, 2: 65, 3: 65, 4: 80, 5: 100, 6: 100, 7: 130, 8: 130, 9: 60, 10: 100, 11: 110, 12: 110, 13: 100 };

async function kiteFlight(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const sgn = sgnOf(u);
  const home: XY = { ...u.rest0 };
  const pan = panAt(home.x);
  const rnd = rng(u.uid * 53 + (s.target?.uid ?? 3));
  dimPanel(u, true);
  // the declaration's pike breath gives way to the cloak filling with wind ("vump")
  const vump = takeCharge(u, 'kfnVump', { pan, volume: 1 });
  void vump;
  const depth0 = spr.depth;
  const tDepth = s.target ? s.target.sprite.depth : depth0;
  // ---- geometry: the cut point, the pendulum, the pin
  const T = s.to; // the target core
  const tip9 = tipOffset(u, 'special', 9);
  const hLow = 4; // body height of the cut (the blade crosses the core)
  const Lg: XY = { x: R(T.x - tip9.x), y: R(T.y - tip9.y + hLow) }; // ground (feet) under the cut
  const Rp = 30; // the pendulum's radius (pivot above the target's side)
  const th0 = (70 * Math.PI) / 180;
  const th1 = (55 * Math.PI) / 180;
  const pend = (th: number): { g: XY; h: number } => ({ g: { x: Lg.x + sgn * Rp * Math.sin(th), y: Lg.y }, h: hLow + Rp * (1 - Math.cos(th)) });
  const A = pend(-th0); // the swing's start: up and behind
  const lane = { x: Math.sign(T.x - home.x) || sgn, y: 0 };
  const B = { g: { x: home.x - lane.x * 4, y: home.y }, h: 18 }; // lift-off: 18 px up, slightly back
  const pinW = u.framePoint(AX - 14, GY);
  const pin: XY = { x: R(pinW.x), y: R(pinW.y) };
  /** Put the body at ground g, height h (the shadow stays on the floor: MonsterUnit.lift). */
  const at = (g: XY, h: number) => {
    u.lift = Math.max(0, h);
    place(u, { x: g.x, y: g.y - h });
  };
  const tailW = (): XY | null => {
    const fi = u.frameInfo();
    if (!fi.anim) return null;
    const t = tailPoint(fi.anim, fi.frame);
    return t ? u.framePoint(t.x, t.y) : null;
  };
  // ---- charge (f1–f4): the panel flares, the arm flung up, the cloak opens and billows, the string goes taut
  const f0 = 1;
  show(u, 'special', f0);
  await sleep(sc, KT[1]);
  show(u, 'special', 2);
  const rise = start('kfnStringRise', { pan, volume: 0.95 });
  await sleep(sc, KT[2]);
  show(u, 'special', 3);
  await sleep(sc, KT[3]);
  show(u, 'special', 4);
  await sleep(sc, KT[4]);
  // ---- rise (f5–f6): lifts off, the kite carries him over to the top of the swing
  const flyDepth = Math.max(depth0, tDepth + 0.5);
  spr.setDepth(flyDepth);
  const str = tautString(sc, () => (u.frameInfo().anim === 'special' && u.frameInfo().frame >= 5 && u.frameInfo().frame <= 10 ? tailW() : null), pin, flyDepth - 0.2, () => (u.frameInfo().frame >= 10 ? 5 : 0));
  const riseMs = KT[5] + KT[6];
  show(u, 'special', 5);
  play('kfnSqueak', { pan, volume: 0.55, pitch: 1.1 });
  await animate(sc, riseMs, (t) => {
    if (t >= KT[5] / riseMs) show(u, 'special', 6);
    // first straight up and back (the lift-off), then over to the swing's start
    const a = clamp01(t / 0.45);
    const b = clamp01((t - 0.35) / 0.65);
    const g0 = lerpXY(home, B.g, quadOut(a));
    const g = lerpXY(g0, A.g, quadInOut(b));
    const h = lerp(lerp(0, B.h, quadOut(a)), A.h, quadInOut(b));
    at(g, h);
  });
  // ---- the pendulum swing (f7–f9): θ −70° → 0 (accelerating into the bottom), the blade's curved trail
  const swingMs = KT[7] + KT[8] + Math.round(KT[9] * 0.4);
  const tipW = (): XY | null => {
    const fi = u.frameInfo();
    if (fi.anim !== 'special' || fi.frame < 7 || fi.frame > 10) return null;
    const m = tipOf('special', fi.frame);
    return u.framePoint(m.x, m.y);
  };
  const trail = tipTrail(sc, tipW, flyDepth + 0.3, 150);
  show(u, 'special', 7);
  play('kfnSwing', { pan: panAt(A.g.x), volume: 1 });
  const f7end = KT[7] / swingMs;
  const f8end = (KT[7] + KT[8]) / swingMs;
  await animate(sc, swingMs, (t) => {
    show(u, 'special', t < f7end ? 7 : t < f8end ? 8 : 9);
    const th = -th0 * (1 - sineIn(t));
    const p = pend(th);
    at(p.g, p.h);
  });
  // ---- contact at the lowest point: the lateral cut, hit-stop 80
  show(u, 'special', 9);
  const bottom = pend(0);
  at(bottom.g, bottom.h);
  rise.stop(40);
  const cutAt: XY = { x: R(T.x), y: R(T.y) };
  s.impact(cutAt);
  play('kfnCut', { pan: panAt(cutAt.x), volume: 1 });
  void stopTime(sc, 80);
  const slitDepth = Math.max(flyDepth, tDepth) + 0.7;
  if (s.blocked) void glanceSparks(sc, cutAt, sgn, slitDepth);
  void cutSlit(sc, cutAt, sgn, slitDepth, { fibres: !s.blocked, rnd });
  void lightFlash(sc, cutAt.x, cutAt.y, PAL.white, 12, 140, { floorY: s.toGround.y, intensity: 0.6 });
  await sleep(sc, Math.round(KT[9] * 0.6));
  if (u.claimed || u.retired) {
    trail.stop();
    str.destroy();
    return;
  }
  // ---- exit (f10): the arc carries on up past the target, the wind spills, the cloak collapses
  show(u, 'special', 10);
  play('kfnSpill', { pan: panAt(Lg.x), volume: 0.9 });
  const exitMs = KT[10];
  await animate(sc, exitMs, (t) => {
    const p = pend(th1 * sineOut(t));
    at(p.g, p.h);
  });
  trail.stop();
  // ---- the braking glide home (f11–f12), the panel goes out, a knee dip on landing
  const E = pend(th1);
  const glideMs = KT[11] + KT[12];
  show(u, 'special', 11);
  str.destroy();
  play('kfnPanelOff', { pan, volume: 0.9 });
  const pp = panelPoint('special', 10);
  if (pp) void threadMote(sc, u.framePoint(pp.x, pp.y), -sgn, flyDepth + 0.2);
  await animate(sc, glideMs, (t) => {
    if (t > KT[11] / glideMs) show(u, 'special', 12);
    // braking: fast off the swing, slow onto the tile; the height bleeds off
    const e = quadOut(t);
    const g = lerpXY(E.g, home, e);
    const h = lerp(E.h, 0, quadInOut(t)) + Math.sin(Math.PI * t) * 3 * (1 - t);
    at(g, h);
  });
  at(home, 0);
  show(u, 'special', 12);
  play('kfnLand', { pan, volume: 0.9 });
  spr.setDepth(unitDepth(u.home.y));
  await sleep(sc, KT[12]);
  show(u, 'special', 13);
  await sleep(sc, Math.round(KT[13] * 0.6));
  u.lift = 0;
  place(u, home);
  if (!u.retired && !u.locked) u.rest();

}

registerStrike(
  ID,
  async (s: StrikeArgs) => {
    if (!LOOK_V3) return s.base?.();
    const u = s.attacker;
    if (!u.has('special') || !u.has('attack')) return s.base?.();
    const nth = attackCount(s);
    try {
      if (nth >= 2 && !s.direct && s.target) await kiteFlight(s);
      else await pike(s, nth);
    } finally {
      // never leave the unit lifted, displaced or hidden
      if (!u.retired && u.sprite.active && !u.claimed) {
        u.lift = 0;
        u.sprite.setVisible(true);
      }
    }
  },
  { name: 'kartc:kite_fencer' },
);

/** The P2 relit special / death poses are painted before they are needed (no first-use hitch). */
registerCardHook(
  ID,
  'attackDeclare',
  async (ctx) => {
    if (LOOK_V3) warmPoses(ID, ctx.ev.player as PlayerId, ['special', 'death']);
    return ctx.base();
  },
  { priority: 20, name: 'kartc:kite_fencer:warm' },
);

// ================================================================ the struck body (kite cloth)

registerCardHook(
  ID,
  'defend',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    const sc = ctx.scene;
    const u = ev.targetUid !== null ? ctx.unit(ev.targetUid) : null;
    if (!u || !u.has('special')) return ctx.base();
    const guard = ev.targetPosition === 'defense';
    const lethal = ctx.events.some((e, i) => i > ctx.index && e.type === 'destroy' && e.uid === ev.targetUid && e.reason === 'battle');
    const onContact = (uid: unknown) => {
      if (uid !== ev.attackerUid) return;
      sc.events.off('v3:contact', onContact);
      if (!u.sprite.active) return;
      // our cloth scores this contact frame: the shared body blow (combat impact) stays silent for its call
      setCombatSfx(false);
      queueMicrotask(() => {
        setCombatSfx(true);
        fade(['impactHeavy', 'impactLight', 'shieldBlock'], 12);
      });
      const pan = panAt(u.home.x);
      if (guard) play('kfnGuardWrap', { pan, volume: lethal ? 1 : 0.9 });
      else play(lethal ? 'kfnStruckHeavy' : 'kfnStruck', { pan, volume: lethal ? 1 : 0.9 });
    };
    sc.events.on('v3:contact', onContact);
    try {
      return await ctx.base();
    } finally {
      sc.events.off('v3:contact', onContact);
    }
  },
  { priority: 20, name: 'kartc:kite_fencer:struck' },
);

// ================================================================ summon: the falling leaf kite

async function leafKite(S: Stage): Promise<void> {
  const u = S.unit;
  const sc = S.scene;
  const spr = u.sprite;
  const flip = u.flipX;
  const light = lightOf(u);
  const sgn = sgnOf(u);
  const home = S.home;
  const pan = panAt(home.x);
  const rest = u.rest0;
  // where the flat kite lies in the summon pose's landing frame (summon f2: the spar crossing at AX − 1, GY − 7)
  const land: XY = { x: rest.x + sgn * -1, y: rest.y - 7 };
  const cam = sc.cameras.main;
  const top = cam.worldView.y - 40;
  // three tilt maps (leaning left, level, leaning right), the string trailing above
  const tex = { l: kiteTexture(sc, -22, light, 'up'), m: kiteTexture(sc, 0, light, 'up'), r: kiteTexture(sc, 22, light, 'up') };
  const depth = unitDepth(home.y) + 2;
  const kite = S.own(kiteImage(sc, tex.m, land.x, top, flip, depth));
  const fallMs = 480;
  const sways = 3;
  let swayIdx = -1;
  await animate(sc, fallMs, (t) => {
    const ph = sways * Math.PI * t;
    const amp = 12 * (1 - 0.5 * t);
    const x = land.x + amp * Math.sin(ph) * (1 - Math.pow(t, 6));
    // a leaf: it sinks fastest in the middle of each sway and almost hangs at the turns, a slowing descent
    const base = lerp(top, land.y, 1 - Math.pow(1 - t, 1.6));
    const y = base - 4 * Math.abs(Math.cos(ph)) * (1 - t);
    const vx = Math.cos(ph);
    kite.setTexture(t > 0.92 ? tex.m : vx > 0.38 ? tex.r : vx < -0.38 ? tex.l : tex.m);
    kite.setPosition(R(x), R(y));
    const si = Math.min(sways - 1, Math.floor(t * sways));
    if (si !== swayIdx) {
      swayIdx = si;
      play('kfnKiteDrift', { pan: Math.max(-0.4, Math.min(0.4, pan + (si % 2 ? 0.22 : -0.22))), volume: 0.75 + si * 0.08 });
    }
  });
  kite.destroy();
  // ---- land: flat on the tile (summon f2), a cloth flop; each panel throws a 1-frame coloured pool
  u.showSprite();
  place(u, rest);
  show(u, 'summon', 2);
  play('kfnKiteFlop', { pan });
  const pools: [number, number, number][] = [
    [-7, -2, PAL.gold3],
    [6, -2, PAL.fire3],
    [-5, 3, PAL.fire3],
    [5, 3, PAL.gold3],
  ];
  for (const [dx, dy, c] of pools) void lightFlash(sc, R(land.x + sgn * dx), R(home.y + dy), c, 9, 90, { floorY: R(home.y + dy), intensity: 0.75, rise: 10 });
  await sleep(sc, 60);
  show(u, 'summon', 3);
  await sleep(sc, 60);
  // ---- a bump rises under the cloth, it tents
  show(u, 'summon', 4);
  play('kfnClothRustle', { pan, volume: 0.9 });
  await sleep(sc, 70);
  show(u, 'summon', 5);
  await sleep(sc, 70);
  // ---- he stands up under the kite; the cloth slides onto his shoulders (4 frames), the string uncoils
  for (const [f, ms] of [
    [6, 70],
    [7, 70],
    [8, 75],
  ] as const) {
    show(u, 'summon', f);
    await sleep(sc, ms);
  }
  show(u, 'summon', 9);
  play('kfnCloakSettle', { pan });
  await sleep(sc, 80);
  // ---- the salute: the rapier up before the mask (a 1-frame tip glint), then snapped down — idle
  show(u, 'roar', 2);
  await sleep(sc, 60);
  show(u, 'roar', 3);
  play('kfnSaluteTsing', { pan });
  const tp = tipOf('roar', 3);
  const tipW = u.framePoint(tp.x, tp.y);
  void lightFlash(sc, R(tipW.x), R(tipW.y), PAL.white, 8, 120, { floorY: home.y, intensity: 0.6 });
  await sleep(sc, 120);
  show(u, 'roar', 4);
  await sleep(sc, 70);
  show(u, 'roar', 5);
  void u.badge.pop();
  await sleep(sc, 60);
  show(u, 'roar', 6);
  await sleep(sc, 60);
  show(u, 'roar', 7);
  await sleep(sc, 50);
  if (!u.retired) u.rest();
}

registerCardHook(
  ID,
  'summon',
  async (ctx) => {
    if (!LOOK_V3 || ctx.ev.from === 'field') return ctx.base();
    await runSummon(ctx as SummonCtx, async () => undefined, leafKite);
  },
  { name: 'kartc:kite_fencer:summon' },
);

// ================================================================ death: the string snaps, the cloak flies off screen

/** Follow the recipe's death pose (deathV3) frame by frame and add the card's own beats. */
function watchDeath(scene: Phaser.Scene, u: MonsterUnit): void {
  const sgn = sgnOf(u);
  const flip = u.flipX;
  const light = lightOf(u);
  const pan = panAt(u.home.x);
  let snapped = false;
  let flown = false;
  let folded = false;
  let gone = false;
  const tex = [-30, -10, 10, 30].map((t) => kiteTexture(scene, t, light, 'down', 0.85, 2));
  onFrame(scene, (_dt, el) => {
    if (el > 2600) return false;
    const fi = u.frameInfo();
    const active = u.sprite.active;
    if (active && fi.anim === 'death') {
      if (!snapped && fi.frame >= 2) {
        snapped = true;
        play('kfnSnap', { pan });
        // the break point: halfway between the kite's tail and the pin (death f2: pin at AX − 22, GY)
        const t = tailPoint('death', 2);
        if (t) {
          const a = u.framePoint(t.x, t.y);
          const b = u.framePoint(AX - 22, GY);
          const m = { x: R((a.x + b.x) / 2), y: R((a.y + b.y) / 2) };
          const up = { x: a.x - m.x, y: a.y - m.y };
          const dn = { x: b.x - m.x, y: b.y - m.y };
          const nu = Math.hypot(up.x, up.y) || 1;
          const nd = Math.hypot(dn.x, dn.y) || 1;
          void snapWhips(scene, m, { x: up.x / nu, y: up.y / nu }, { x: dn.x / nd, y: dn.y / nd }, u.sprite.depth + 0.3);
        }
      }
      if (!flown && fi.frame >= 5) {
        flown = true;
        // the cloak leaves where the pose let go of it (death f4: the loose kite at AX + 14, 15, tilted 24°)
        flyAway(scene, u.framePoint(AX + 14, 15), sgn, flip, tex, u.sprite.depth + 1);
        play('kfnCloakAway', { pan: sgn * 0.3, volume: 0.95 });
      }
      if (!folded && fi.frame >= 7) {
        folded = true;
        play('kfnClothFold', { pan, volume: 0.8 });
      }
    }
    if (!active || u.retired) {
      if (!gone) gone = true;
      return false;
    }
    return true;
  });
}

/** The cloak flies up and off screen (600 ms), swaying through 4 tilt maps, the snapped stub hanging under it. */
function flyAway(scene: Phaser.Scene, from: XY, sgn: 1 | -1, flip: boolean, tex: string[], depth: number): void {
  const img = kiteImage(scene, tex[2], from.x, from.y, flip, Math.max(depth, DEPTH.FX - 1));
  const cam = scene.cameras.main;
  const toY = cam.worldView.y - 50;
  const toX = from.x + sgn * 150;
  void animate(scene, 600, (t) => {
    // a gust: it rises slowly at first, then is snatched away; it sways (4 maps) as it goes
    const e = t * t * (1.6 - 0.6 * t);
    const x = lerp(from.x, toX, e) + Math.sin(t * Math.PI * 3) * 6 * (1 - t);
    const y = lerp(from.y, toY, e);
    const sway = Math.sin(t * Math.PI * 3 + 0.6);
    const i = sway > 0.5 ? 3 : sway > 0 ? 2 : sway > -0.5 ? 1 : 0;
    img.setTexture(tex[sgn > 0 ? i : 3 - i]);
    img.setPosition(R(x), R(y));
  }).then(() => img.destroy());
}

registerCardHook(
  ID,
  'destroyed',
  async (ctx) => {
    if (!LOOK_V3) return ctx.base();
    const c = ctx as CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
    if (c.ev.location !== 'monster' || sourceOwnsDeath(c as never)) return ctx.base();
    const u = ctx.views.field.unit(c.ev.uid);
    if (u && u.has('death') && u.sprite.active && u.sprite.visible) {
      dimPanel(u, true);
      watchDeath(ctx.scene, u);
    }
    return ctx.base();
  },
  { priority: 20, name: 'kartc:kite_fencer:death' },
);

