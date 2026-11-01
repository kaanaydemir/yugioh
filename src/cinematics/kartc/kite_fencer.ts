// Uçurtma Eskrimci (kite_fencer, C9) — the card's own v3 presentation (docs/v3/oturum-c-tasarim.md §2.4,
// YENI_KARTLAR C9, §5.2). v3 look only: every handler starts with `if (!LOOK_V3) …base()`, so v1 is untouched.
//
//   strike, 1st attack  "Pike": the shortest charge of the lane (the declaration's held charge pose + 140 ms of full
//                       wind-up), ONE perfectly straight fleche home → target (linear, full speed, ≤ 95 ms: it hits at
//                       its fastest) with a 1-px needle line at blade height streaming out behind him (white → mist →
//                       steel → gone on real frames, whatever the hit-stop), the tip's white cross star on contact,
//                       hit-stop 60, two small back-hops home — on landing the indicator panel LIGHTS (the plucked
//                       string "one attack left"). Blocked: the blade bows (two drawn frames) and springs back, he skids.
//                       Direct: the same fleche at the duelist (direct is only ever the first attack).
//   strike, 2nd attack  "Uçurtma Süzülüşü" (monster only; the slot's attacksThisTurn === 2): the panel flares, the cloak
//                       spreads and billows, the string goes taut to a pin on the home tile, he LIFTS OFF (up and back,
//                       hanging under the kite, shadow left on the floor) to the arc's start — built in SCREEN space
//                       above the higher of his home and the target, so player 2's mirrored swing rises too — hangs a
//                       beat and swings down a PENDULUM arc whose bottom is beside the target at body height (the blade's
//                       trail drawn from the analytic swing: one smooth arc) — a lateral curved cut
//                       across the body (a curved 1-px white slit, linen fibres), hit-stop 80 — the arc carries on up,
//                       the wind spills, a braking glide home with a knee dip; the panel goes OUT (gold4 → gold3 → off).
//                       The two attacks share nothing but the rapier: path, rhythm, trail and sound all differ.
//   summon              the EMPTY kite drifts down from above the screen like a leaf (3 slowing sways, 3 tilt maps,
//                       the string trailing above — never a dive, never a vertical drop), lands flat on the tile (a cloth
//                       flop; each panel throws a 1-frame coloured pool), a bump rises under it, he stands up under the
//                       kite, the cloth slides onto his shoulders, the salute (a tip glint), snapped down: idle.
//   death               owned end to end (no shared burst, reticle or floor ring): the art's death pose (string taut →
//                       SNAP → rapier drops → the cloak tears off → the body thins, sways, buckles → a linen scrap, the
//                       rapier bouncing 2 px / 1 px with its clatter ticks at 0 / 90 / 150 ms + a rest tick), the snapped
//                       ends whipping back above every unit, the CLOAK FLYING OFF SCREEN (600 ms, swaying, 4 tilt maps;
//                       top-right for player 1, top-left for player 2), then the scrap frays into threads that drift
//                       after the cloak — the card is born on the last thread frame and flies to the graveyard.
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
import { AX, GY, PANEL_STEP, insidePanel } from '../../art/monsters-v3/kite_fencer-rig';
import { attackPose, bodyFront, framePoints, panelPoint, panelTri, tailPoint } from '../../art/monsters-v3/kite_fencer-anims';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { Disposable } from '../../duel/types';
import { onDuelStart } from '../../duel/seeds';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightFlash, lightPool, type LightHandle } from '../../view/light';
import { Px, animate, onFrame, setCombatSfx, sleep, stopTime } from '../../vfx/combat';
import { registerCardHook, registerEvent, registerObserver, registerStrike, type CinematicContext, type StrikeArgs } from '../api';
import { strikeStartFrame } from '../_v3/clash';
import { cardLeaves, behindBodies } from '../_v3/card';
import { contactFlash } from '../_v3/flash';
import { deathStartFrom, takePlannedEntry } from '../_v3/posematch';
import { planGuardBreak, runGuardBreak, showsGuard } from '../_v3/guardbreak';
import { warmPoses } from '../_v3/warm';
import { atFrame, dropCharge, fade, panAt, play, start, takeCharge } from '../_v3/sound';
import { setKiteCharge } from '../../audio/v3/kite_fencer';
import { sfx, type SfxOpts } from '../../audio/sfx';
import { sourceOwnsDeath } from '../strikes-b/_kit';
import { runSummon, type Stage, type SummonCtx } from '../summon-a/_kit';
import { anchoredImage, cutSlit, glanceSparks, kiteImage, kiteTexture, layer, needleLine, poseTexture, pendulumTrail, scrapFray, snapWhips, tautString, threadMote, type Light } from './kite_fencer-fx';

const ID: MonsterId = 'kite_fencer';
const R = Math.round;
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
const cubicOut = (t: number) => 1 - Math.pow(1 - t, 3);
const sineOut = (t: number) => Math.sin((t * Math.PI) / 2);
/** The downswing: a short hang at the top, then accelerating into the bottom (contact at full speed). */
const swingEase = (t: number) => 0.4 * t + 0.6 * t * t;
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

/** Does the attacker die in this battle (it then stays at the contact point: the battle takes the unit over)? */
function attackerLoses(s: StrikeArgs): boolean {
  const r = s.ctx.ev.result;
  return r === 'attackerDestroyed' || r === 'bothDestroyed';
}

/** A losing attacker: hold the contact pose until the battle claims the unit for its death (never hop home dead). */
async function yieldToDeath(sc: Phaser.Scene, u: MonsterUnit, foe?: MonsterUnit | null): Promise<void> {
  if (foe) deathFoe.set(u, foe);
  watchDeath(sc, u);
  let g = 0;
  while (!u.claimed && !u.retired && g++ < 16) await sleep(sc, 30);
}

/** Hold one sheet frame (MonsterUnit.pose; ignored while another cinematic claims the unit). */
function show(u: MonsterUnit, anim: AnyMonsterAnim, f: number): void {
  if (u.sprite.active && !u.locked) u.pose(anim, f);
}

function place(u: MonsterUnit, p: XY): void {
  const s = u.sprite;
  if (s.active) s.setPosition(R(p.x), R(p.y));
}

/** The struck body's contact bed: its material hit (hitStone* / hitCloth* / hitCrystal* …) or the generic body blow. */
const contactBed = (name: string): boolean => /^hit[A-Z]/.test(name) || name === 'impactHeavy' || name === 'impactLight';

/**
 * Call s.impact() with the struck body's contact bed `k` × quieter: the card's own contact sound ("tsst", the curved
 * cut) leads the frame and the target's material sits under it (crystal_wyrm's breath sits 6.6 dB over its stone hit;
 * the kite's light blade otherwise vanished under a stone clunk). Only the sounds the battle plays synchronously inside
 * this one call are touched; sfx.play is restored before it returns.
 */
function impactUnder(s: StrikeArgs, at: XY, k: number): void {
  const orig = sfx.play;
  sfx.play = function (name, opts?: SfxOpts) {
    return orig.call(sfx, name, contactBed(name) ? { ...opts, volume: (opts?.volume ?? 1) * k } : opts);
  };
  try {
    s.impact(at);
  } finally {
    sfx.play = orig;
  }
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
    if (pt && fi.anim && step === 0) {
      // the whole leading panel one tone step brighter (gold3 → gold4, fire2 → fire3 …): a lit cloth panel, not a dot
      for (const q of litPanel(scene, u, fi.anim, fi.frame)) {
        const w = u.framePoint(q.x + 0.5, q.y + 0.5);
        px.dot(Math.floor(w.x), Math.floor(w.y), q.c);
      }
    }
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

/** The lit panel's pixels for a sheet frame (frame px + the stepped-up tone), read once from the unit's texture. */
const litCache = new Map<string, { x: number; y: number; c: number }[]>();
function litPanel(scene: Phaser.Scene, u: MonsterUnit, anim: AnyMonsterAnim, f: number): { x: number; y: number; c: number }[] {
  const s = u.sprite;
  const tex = s.texture.key;
  const fr = s.frame.name;
  const key = `${tex}|${fr}`;
  let out = litCache.get(key);
  if (out) return out;
  out = [];
  const tri = panelTri(anim, f);
  if (tri) {
    const xs = [tri.T[0], tri.R[0], tri.X[0]];
    const ys = [tri.T[1], tri.R[1], tri.X[1]];
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++)
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        if (!insidePanel(tri.T, tri.R, tri.X, x, y)) continue;
        const col = scene.textures.getPixel(x, y, tex, fr);
        if (!col || col.alpha < 128) continue;
        const up = PANEL_STEP.get((col.red << 16) | (col.green << 8) | col.blue);
        if (up !== undefined) out.push({ x, y, c: up });
      }
  }
  litCache.set(key, out);
  return out;
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
    if (ev.type !== 'phaseChange' && ev.type !== 'turnStart') idleBusy = true;
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

// ================================================================ the idle accent (cloth flutter + string hum)

/**
 * The idle's sound (oturum-c-tasarim §2.4 "Idle", §0.5): the cloth flutter and the faint string hum on the cloak's
 * billow (idle f3), as an ambient tick — at most one per 4.5 s across every kite on the board, never within 2.5 s
 * of any board action (a declaration, a battle, a summon, a card played), only while the unit stands in its idle
 * loop. The codebase has no shared ambient-idle hook, so each kite unit carries its own watcher (started when it is
 * summoned, attacks, defends or declares; it ends with the unit). Sound only: no pixels change, films stay identical.
 */
const idleWatched = new WeakSet<MonsterUnit>();
/** Set by the observer on every board action; the idle watchers turn it into a scene-clock 'contact' time. */
let idleBusy = false;
/** Per scene: the last idle tick and the last battle contact (scene clock, ms). */
const idleClock = new WeakMap<Phaser.Scene, { last: number; contact: number }>();
function idleSound(sc: Phaser.Scene, u: MonsterUnit): void {
  if (!LOOK_V3 || idleWatched.has(u)) return;
  idleWatched.add(u);
  let st = idleClock.get(sc);
  if (!st) {
    const s0 = { last: -1e9, contact: -1e9 };
    st = s0;
    idleClock.set(sc, s0);
    sc.events.on('v3:contact', () => {
      s0.contact = sc.time.now;
    });
  }
  const clock = st;
  let prevFrame = -1;
  onFrame(sc, () => {
    if (u.retired || !u.sprite.active) return false;
    const fi = u.frameInfo();
    const f = fi.anim === 'idle' ? fi.frame : -1;
    const now = sc.time.now;
    // any action on the board (a declaration, a battle, a summon, a card played …) counts as a contact: the idle
    // stays quiet through another card's cinematic
    if (idleBusy) {
      idleBusy = false;
      clock.contact = now;
    }
    if (f === 3 && prevFrame !== 3 && u.sprite.visible && !u.claimed && now - clock.last > 4500 && now - clock.contact > 2500) {
      clock.last = now;
      play('kfnIdleFlutter', { pan: panAt(u.home.x), volume: 0.8 });
    }
    prevFrame = f;
    return true;
  });
}

/**
 * A kite already on the board (placed by a scenario, or summoned before this module watched it) gets its idle watcher
 * the first time the board turns a phase or a turn: a cheap scan of the field's units, the event itself untouched.
 */
if (LOOK_V3) {
  const scan = async (ctx: CinematicContext<Extract<GameEvent, { type: 'phaseChange' | 'turnStart' }>>) => {
    try {
      for (const u of ctx.views.field.units()) if (u.cardId === ID && !u.retired) idleSound(ctx.scene, u);
    } catch {
      /* never break the event */
    }
    return ctx.base();
  };
  registerEvent('phaseChange', scan, { priority: -50, name: 'kartc:kite_fencer:idle-scan' });
  registerEvent('turnStart', scan, { priority: -50, name: 'kartc:kite_fencer:idle-scan' });
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
  // ---- release: the fleche — one perfectly straight dash at full speed, no ease-out creep
  const tip5 = tipOffset(u, 'attack', 5);
  // contact where the tip meets the core (the target's, or the duelist's chest); then 2–3 px of push-through
  const aim = s.to;
  const stop: XY = { x: R(aim.x - tip5.x), y: R(aim.y - tip5.y) };
  const depth0 = u.sprite.depth;
  const tDepth = s.target ? s.target.sprite.depth : depth0;
  show(u, 'attack', 4);
  ch.stop(50);
  play('kfnFleche', { pan, volume: 0.95 });
  const dist = Math.hypot(stop.x - home.x, stop.y - home.y);
  const dirn: XY = dist > 0 ? { x: (stop.x - home.x) / dist, y: (stop.y - home.y) / dist } : { x: sgn, y: 0 };
  // linear at full speed (a fleche hits at its fastest; no ease-out creep before the tip lands): ~6 real frames
  const travel = Math.round(Math.min(95, 66 + dist * 0.1));
  // the needle line trails the body at blade height: along the dash line through the hand, from the hand now back
  // past where it started (the dash is short — the rapier reaches most of the way — so the line is projected back by
  // about the dash length, or the body would hide all of it), drawn just UNDER the dashing body: it streams out from
  // behind him like the wake of the fleche
  const hand4 = offsetOf(u, framePoints('attack', 4).hand ?? tipOf('attack', 4));
  const back = Math.min(34, Math.max(18, dist * 0.9));
  const lineFrom: XY = { x: home.x + hand4.x - dirn.x * back, y: home.y + hand4.y - dirn.y * back };
  const flyD = !s.direct && s.target ? Math.max(depth0, tDepth + 0.5) : depth0;
  const nl = needleLine(
    sc,
    lineFrom,
    () => {
      const e = { x: u.sprite.x + hand4.x, y: u.sprite.y + hand4.y };
      return (e.x - lineFrom.x) * dirn.x + (e.y - lineFrom.y) * dirn.y > 3 ? e : null;
    },
    flyD - 0.05,
  );
  if (!s.direct && s.target) u.sprite.setDepth(Math.max(depth0, tDepth + 0.5));
  await animate(sc, travel, (t) => place(u, lerpXY(home, stop, t)));
  place(u, stop);
  nl.land();
  // ---- contact: the tip's white cross star (f5), the needle "tsst-çın", hit-stop 60 — on the frame it arrives
  show(u, 'attack', 5);
  const at: XY = { x: R(stop.x + tip5.x), y: R(stop.y + tip5.y) };
  if (s.blocked && !s.direct) {
    await blockedPike(s, at, stop, home, depth0, pan);
    return;
  }
  impactUnder(s, at, 0.5);
  play('kfnTsst', { pan: panAt(at.x), volume: 1 });
  void lightFlash(sc, at.x, at.y, PAL.white, 10, 120, { floorY: s.toGround.y, intensity: 0.7 });
  void stopTime(sc, 60);
  // the last 2–3 px of the lunge settle through the target inside the stop
  const push: XY = { x: R(stop.x + dirn.x * 2.5), y: R(stop.y + dirn.y * 2.5) };
  void animate(sc, 40, (t) => {
    if (!u.claimed && !u.retired) place(u, lerpXY(stop, push, quadOut(t)));
  });
  if (attackerLoses(s)) {
    await yieldToDeath(sc, u, s.target);
    return;
  }
  await sleep(sc, Math.max(40, Math.round(u.frameMs('attack', 5) * 0.5)));
  if (u.claimed || u.retired) return; // a loser is taken over on the contact frame (battle.ts)
  await backHops(s, push, home, depth0, nth, pan);
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
  // a stronger foe: the bowed blade was his last move — he dies where he stands
  if (attackerLoses(s)) {
    await yieldToDeath(sc, u, s.target);
    return;
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
  // the battle's recoil pose plays on him at the skid point (the cloak flipped forward); the moment it has played he
  // hops home — no dead hold while the battle lets go of the sprite (it unclaims on the frame the recoil ends)
  // (its last frames are the body already back in stance — he starts the hops there, taking the sprite back)
  const recoilDone = () => {
    const fi = u.frameInfo();
    return u.retired || !u.claimed || !u.sprite.anims.isPlaying || (fi.anim !== null && fi.anim !== 'attack' && fi.frame >= 4);
  };
  await until(sc, recoilDone, 1200);
  if (u.retired) return;
  if (u.claimed) u.unclaim();
  await backHops(s, skid, home, depth0, attackCount(s), pan);
}

// ================================================================ attack 2: "Uçurtma Süzülüşü"

/**
 * Attack 2's beat lengths (scene ms; the cinematic plays the frames on its own clock so the flight, the sounds and
 * the frames stay locked): charge 220 (f1–f4), rise 170 (f5–f6), the downswing 260 (f7 → f8 → f9, accelerating), the
 * carry-through 210 (f10: the cloak snatches him UP beside the foe and over its head to the far side, leaving the
 * bottom at the downswing's own speed and slowing to the apex), the glide 250 (f11: the wind spills at the apex, he
 * glides back over the foe's head and home), the landing 90 + 50 (f12, f13) — ≈ 1.27 s + the 0.3 s declaration
 * (spec 2.2 s ÷ 1.25 = 1.75 s scene, trimmed to fit the 3.19 s gate with a slow-dying target).
 */
const KT = { c1: 50, c2: 55, c3: 55, c4: 60, r5: 85, r6: 85, down: 260, exit: 210, glide: 250, land: 90, settle: 50 };
/** The pendulum: the start angle, how far behind his home tile the swing starts (px). */
const TH0 = (85 * Math.PI) / 180;
const BACK = 12;
/** The gap (px) between his body's leading edge and the target's near edge at the bottom of the swing. */
const CUT_GAP = 4;
/** Clearances of the carry-through / glide over the target (px): feet over its top row, past its far edge. */
const OVER_TOP = 5;
const PAST_FAR = 8;
/** Half the body's width around the anchor while it flies (px), for the clearance checks. */
const FLY_HALF_W = 8;
/** The blade's sweep in the FLOOR plane (deg, facing right: 180 = drawn back behind the hip, 0 = level forward). */
const SWEEP_FROM = 178;
/** The iso flattening of that floor-plane circle on screen (a horizontal sweep reads as a flat ellipse). */
const SWEEP_SQ = 0.3;

type Box = { x0: number; x1: number; y0: number; y1: number };
const boundsCache = new Map<string, { x0: number; y0: number; x1: number; y1: number } | null>();
/**
 * The target's live silhouette box (screen px), read from the pixels of the frame its sprite shows now (frame px →
 * world through MonsterUnit.framePoint: flip, trim and position aware); a face-down card: a box round its core.
 */
function targetBox(t: MonsterUnit | null | undefined, core: XY, floor: number): Box {
  const spr = t?.sprite;
  if (t && spr && spr.active && spr.visible) {
    const fr = spr.frame;
    const key = `${spr.texture.key}|${fr.name}`;
    let b = boundsCache.get(key);
    if (b === undefined) {
      b = null;
      const tm = spr.scene.textures;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -1;
      let y1 = -1;
      // (TextureManager.getPixel takes the art's full-frame px and handles a trimmed / cropped frame itself)
      for (let y = 0; y < fr.realHeight; y++)
        for (let x = 0; x < fr.realWidth; x++) {
          const c = tm.getPixel(x, y, spr.texture.key, fr.name);
          if (!c || c.alpha < 128) continue;
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      if (x1 >= 0) b = { x0, y0, x1: x1 + 1, y1: y1 + 1 };
      boundsCache.set(key, b);
    }
    if (b) {
      const p = t.framePoint(b.x0, b.y0);
      const q = t.framePoint(b.x1, b.y1);
      return { x0: Math.min(p.x, q.x), x1: Math.max(p.x, q.x), y0: Math.min(p.y, q.y), y1: Math.max(p.y, q.y) };
    }
  }
  return { x0: core.x - 12, x1: core.x + 12, y0: core.y - 14, y1: floor };
}

/** Does a flying body (feet at p) overlap the box? (its feet under the top row while its width meets the box) */
function overlaps(p: XY, box: Box, clear: number): boolean {
  return p.x + FLY_HALF_W > box.x0 && p.x - FLY_HALF_W < box.x1 && p.y > box.y0 - clear;
}

/** A sampled path with arc-length lookup: at(d) for d 0…1 of its length. */
function arcPath(pts: XY[]): { at(d: number): XY; len: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const len = cum[cum.length - 1] || 1;
  return {
    len,
    at(d: number): XY {
      const s = clamp01(d) * len;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const k = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
      return lerpXY(pts[i - 1], pts[i], k);
    },
  };
}
const cubic = (a: XY, b: XY, c: XY, d: XY, t: number): XY => {
  const u = 1 - t;
  return { x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x, y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y };
};
const quad = (a: XY, b: XY, c: XY, t: number): XY => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y };
};

async function kiteFlight(s: StrikeArgs): Promise<void> {
  const u = s.attacker;
  const sc = s.scene;
  const spr = u.sprite;
  const sgn = sgnOf(u);
  const home: XY = { ...u.rest0 };
  const pan = panAt(home.x);
  const rnd = rng(u.uid * 53 + (s.target?.uid ?? 3));
  dimPanel(u, true);
  const depth0 = spr.depth;
  const tDepth = s.target ? s.target.sprite.depth : depth0;
  // ---- geometry: a WORLD pendulum seen in iso. The swing hangs in the vertical plane through his home and the target:
  // its horizontal reach runs along the floor line home → the floor beside the target, its height is measured up from
  // that floor (screen y = the floor under him − his height). Both players get the same swing in the world, so the
  // mirrored films read alike: he is carried up and back behind his tile (θ0 = 85°), and the arc falls fastest into its
  // lowest point BESIDE the target (his leading edge CUT_GAP px outside its near edge) with his rapier hand at the
  // target's mid-height: the blade sweeps LEVEL across its body — a lateral cut, at right angles to attack 1's needle.
  const T: XY = { x: s.to.x, y: s.to.y }; // the target core
  const floorT = s.toGround.y;
  const box = targetBox(s.target, T, floorT);
  const near = sgn > 0 ? box.x0 : box.x1;
  const far = sgn > 0 ? box.x1 : box.x0;
  const midY = (box.y0 + box.y1) / 2;
  const hand9 = offsetOf(u, framePoints('special', 9).hand ?? tipOf('special', 9));
  const front9 = bodyFront('special', 9) - AX;
  const Bc: XY = { x: near - sgn * (front9 + CUT_GAP), y: Math.min(midY - hand9.y, floorT - 1) };
  const hB = floorT - Bc.y; // his height above the floor at the cut
  const span = Math.abs(Bc.x - home.x) || 1;
  /** The floor (screen y) under a body at screen x: home → the floor beside the target, flat beyond it. */
  const floorY = (x: number): number => lerp(home.y, floorT, Math.max(-0.7, Math.min(1, (x - home.x) / (Bc.x - home.x || sgn))));
  const th0 = TH0;
  const RP = Math.max(46, span + BACK) / Math.sin(th0);
  const height = (th: number): number => hB + RP * (1 - Math.cos(th));
  const body = (th: number): XY => {
    const x = Bc.x + sgn * RP * Math.sin(th);
    return { x, y: floorY(x) - height(th) };
  };
  // the blade's analytic sweep: from the downswing frame (f8, shown from 42 % of the swing time: k8 of the way down
  // the arc) the hand travels from its f8 spot (hip, blade drawn back) to its f9 spot (hip, arm out) and the blade
  // turns through a HORIZONTAL half circle — back → round the near side (toward the camera: lower on screen) → level
  // forward at the contact: on screen a flat ellipse at hip height, never a chop; before f8 nothing is cutting yet
  const hand8 = offsetOf(u, framePoints('special', 8).hand ?? tipOf('special', 8));
  const k8 = swingEase(0.42);
  const sweep = (th: number): number => (th >= 0 ? 1 : clamp01((1 + th / th0 - k8) / (1 - k8)));
  // the trail is the blade's sweep ROUND HIS HAND, drawn on the body where it is now (curTh): a flat crescent at hip
  // height riding with him — the horizontal cut reads as one swipe, never as a long streak of the flight path
  let curTh = -th0;
  const tipAt = (th: number): XY => {
    const b = body(Math.min(0, curTh));
    const k = sweep(th);
    const a = (SWEEP_FROM * (1 - Math.pow(k, 1.3)) * Math.PI) / 180;
    const h = lerpXY(hand8, hand9, k);
    return { x: b.x + h.x + sgn * Math.cos(a) * 20, y: b.y + h.y + Math.sin(a) * 20 * SWEEP_SQ };
  };
  const A = body(-th0);
  const C = body(0);
  // ---- the carry-through (screen space, from the live silhouette): the cloak catches the updraft and SNATCHES him
  // up beside the target's near edge (the swing's level tangent turning up at once), then over its head to the apex
  // past its far edge — his feet OVER_TOP px above its top row whenever his body is over it: he never touches it
  // two cubic segments: the J (the level tangent turning straight up within 3 px, rising beside the near edge until
  // his feet are over the top row) and the hop over the head to the apex P — the highest point, past the far edge
  const S: XY = { x: C.x + sgn * 3, y: box.y0 - OVER_TOP };
  const P: XY = { x: far + sgn * PAST_FAR, y: box.y0 - OVER_TOP - 4 };
  const seg1 = Array.from({ length: 25 }, (_, i) => cubic(C, { x: C.x + sgn * 3, y: C.y }, { x: S.x, y: S.y + 12 }, S, i / 24));
  let arch = 8;
  let exitPts: XY[] = seg1;
  for (let tries = 0; tries < 12; tries++) {
    const seg2 = Array.from({ length: 25 }, (_, i) => cubic(S, { x: S.x, y: S.y - arch }, { x: P.x - sgn * 12, y: P.y - 2 }, P, i / 24));
    exitPts = [...seg1, ...seg2.slice(1)];
    if (!seg2.some((p) => overlaps(p, box, OVER_TOP))) break;
    arch += 4;
  }
  const exitPath = arcPath(exitPts);
  // the glide home goes back OVER the target's head (apex → above its near edge → home): never into its box
  let hq = 10;
  let glidePts: XY[] = [];
  for (let tries = 0; tries < 12; tries++) {
    const q: XY = { x: near - sgn * 6, y: box.y0 - OVER_TOP - hq };
    glidePts = Array.from({ length: 49 }, (_, i) => quad(P, q, home, i / 48));
    if (!glidePts.some((p) => overlaps(p, box, OVER_TOP) && Math.abs(p.x - home.x) > 10)) break;
    hq += 6;
  }
  const glidePath = arcPath(glidePts);
  // the carry-through leaves the bottom at the downswing's own speed (swingEase'(1) = 1.6: θ0·1.6 / down per ms, ×RP
  // in px), then slows into the apex: a power ease-out whose start slope matches that speed
  const v0 = (1.6 * th0 * RP) / KT.down; // px / scene ms at the bottom
  const exN = Math.max(1.6, Math.min(3, (v0 * KT.exit) / exitPath.len));
  const exEase = (t: number): number => 1 - Math.pow(1 - t, exN);
  /** Put the body at screen point p (the shadow stays on the floor under it: MonsterUnit.lift). */
  const at = (p: XY) => {
    u.lift = Math.max(0, R(floorY(p.x) - p.y));
    place(u, p);
  };
  const pinW = u.framePoint(AX - 14, GY);
  const pin: XY = { x: R(pinW.x), y: R(pinW.y) };
  const tailW = (): XY | null => {
    const fi = u.frameInfo();
    if (!fi.anim) return null;
    const t = tailPoint(fi.anim, fi.frame);
    return t ? u.framePoint(t.x, t.y) : null;
  };
  // ---- charge (f1–f4): the panel flares, the rear arm FLUNG up, the cloak opens and BILLOWS ("vump"), the string
  // goes taut to its pin; the declaration's string onset gives way to the rising string tension
  show(u, 'special', 1);
  await sleep(sc, KT.c1);
  show(u, 'special', 2);
  dropCharge(u, 90);
  const rise = start('kfnStringRise', { pan, volume: 0.95 });
  await sleep(sc, KT.c2);
  show(u, 'special', 3);
  play('kfnVump', { pan, volume: 1 });
  await sleep(sc, KT.c3);
  show(u, 'special', 4);
  await sleep(sc, KT.c4);
  // ---- rise (f5–f6): he lifts off and is carried up to the top of the arc — climbing all the way, never sinking
  // (in front of the target for the whole flight: the path never enters its box, so the draw order never flips)
  const flyDepth = Math.max(depth0, tDepth + 0.5);
  spr.setDepth(flyDepth);
  const tailInFlight = () => (u.frameInfo().anim === 'special' && u.frameInfo().frame >= 5 && u.frameInfo().frame <= 10 ? tailW() : null);
  let str = tautString(sc, tailInFlight, pin, flyDepth - 0.2, () => (u.frameInfo().frame >= 10 ? 5 : 0));
  const riseMs = KT.r5 + KT.r6;
  show(u, 'special', 5);
  play('kfnSqueak', { pan, volume: 0.55, pitch: 1.1 });
  await animate(sc, riseMs, (t) => {
    if (t >= KT.r5 / riseMs) show(u, 'special', 6);
    // pulled up (eased in and out: no hover at the top), across with it, a 4-px drift back as he leaves the floor
    const x = lerp(home.x, A.x, quadInOut(t)) - sgn * 4 * Math.sin(Math.PI * clamp01(t / 0.6));
    const y = lerp(home.y, A.y, 0.5 * quadInOut(t) + 0.5 * (1 - Math.pow(1 - t, 1.5)));
    at({ x, y });
  });
  at(A);
  // ---- the pendulum (f7 → f8 → f9): θ −θ0 → 0, accelerating into the bottom; the blade's analytic trail
  const trail = pendulumTrail(sc, tipAt, flyDepth + 0.3, 24, 0.45);
  show(u, 'special', 7);
  play('kfnSwing', { pan: panAt(A.x), volume: 1 });
  await animate(sc, KT.down, (t) => {
    show(u, 'special', t < 0.42 ? 7 : t < 0.8 ? 8 : 9);
    const th = -th0 * (1 - swingEase(t));
    at(body(th));
    curTh = th;
    if (t >= 0.42) trail.push(th);
  });
  // ---- contact at the lowest point: the blade level across the body — the lateral cut, hit-stop 80
  show(u, 'special', 9);
  at(C);
  curTh = 0;
  trail.push(0);
  rise.stop(40);
  // the cut runs along the blade at hip height (the target's mid-height), from the hand across the near half of the
  // body: the slit lies on that line, the contact point is its middle
  const handW: XY = { x: C.x + hand9.x, y: C.y + hand9.y };
  const cutAt: XY = { x: R(handW.x + sgn * 11), y: R(handW.y + 1) };
  // the curved cut leads the frame: the target's material hit plays under it (≈ −5 dB: the struck body still sounds)
  impactUnder(s, cutAt, 0.55);
  play('kfnCut', { pan: panAt(cutAt.x), volume: 1 });
  void stopTime(sc, 80);
  const slitDepth = Math.max(flyDepth, tDepth) + 0.7;
  if (s.blocked) void glanceSparks(sc, cutAt, sgn, slitDepth);
  void cutSlit(sc, cutAt, sgn, slitDepth, { fibres: !s.blocked, rnd, len: 15 });
  void lightFlash(sc, cutAt.x, cutAt.y, PAL.white, 12, 140, { floorY: floorT, intensity: 0.6 });
  if (attackerLoses(s)) {
    // the cut fails and kills him at the bottom of the swing (a few px over the floor): the wind dies, the string
    // goes slack — his death pose takes over right there
    trail.stop();
    str.destroy();
    watchDeath(sc, u);
    await yieldToDeath(sc, u, s.target);
    return;
  }
  // (no hold at the bottom: the scene clock is frozen by the hit-stop, and the frame it lets go the swing carries on)
  await sleep(sc, 1);
  if (u.claimed || u.retired) {
    trail.stop();
    str.destroy();
    return;
  }
  // ---- exit (f10): the cloak, still OPEN, catches the updraft and snatches him up beside the foe and over its head
  // (the blade flourished up before his body); the string slackens behind the target (it runs from his home pin)
  trail.stop();
  str.destroy();
  str = tautString(sc, tailInFlight, pin, Math.min(flyDepth, tDepth) - 0.3, () => 5);
  show(u, 'special', 10);
  play('kfnLiftOff', { pan: panAt(C.x), volume: 0.9 });
  await animate(sc, KT.exit, (t) => at(exitPath.at(exEase(t))));
  at(P);
  // ---- the apex: the WIND SPILLS (f11: the cloak half-collapses), the panel goes out; the braking glide back over
  // the foe's head and home, a knee dip on landing (f12)
  show(u, 'special', 11);
  str.destroy();
  play('kfnSpill', { pan: panAt(P.x), volume: 0.9 });
  play('kfnPanelOff', { pan, volume: 0.9 });
  const pp = panelPoint('special', 11) ?? panelPoint('special', 10);
  if (pp) void threadMote(sc, u.framePoint(pp.x, pp.y), -sgn, flyDepth + 0.2);
  await animate(sc, KT.glide, (t) => {
    // off the apex from rest, fastest over the foe, braking onto the tile; a last 2-px float before the touch-down
    const e = t * t * (3 - 2 * t) * 0.35 + quadOut(t) * 0.65;
    const p = glidePath.at(e);
    at({ x: p.x, y: p.y - Math.sin(Math.PI * t) * 2 * t });
  });
  at(home);
  show(u, 'special', 12);
  play('kfnLand', { pan, volume: 0.9 });
  spr.setDepth(unitDepth(u.home.y));
  await sleep(sc, KT.land);
  show(u, 'special', 13);
  await sleep(sc, KT.settle);
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
    idleSound(s.scene, u);
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
    if (!LOOK_V3) return ctx.base();
    const ev = ctx.ev;
    warmPoses(ID, ev.player as PlayerId, ['special', 'death']);
    // the 2nd attack shares nothing with the 1st, not even the declaration's breath: the shared declaration holds
    // the card's charge voice on its charge frame — for the 2nd attack that voice is the string tensing in the wind
    // (handed to the strike, let go as the cloak fills)
    const slot = ctx.stateNext.players[ev.player]?.monsters[ev.attackerZone];
    const u = ctx.unit(ev.attackerUid);
    if (u) idleSound(ctx.scene, u);
    setKiteCharge((slot?.attacksThisTurn ?? 1) >= 2 ? 'kfnKiteCharge' : 'kfnPikeCharge');
    try {
      return await ctx.base();
    } finally {
      setKiteCharge('kfnPikeCharge');
    }
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
    idleSound(sc, u);
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
      // the death pose starts with the recoil, before the destroy event: follow it from the contact frame
      if (lethal) watchDeath(sc, u);
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
  // where the falling kite hands over to the summon pose: its first tipping frame (summon f0: the spar crossing at
  // AX − 1, GY − 17); then it tips (f1) and lies flat on the tile (f2: AX − 1, GY − 7)
  const land: XY = { x: rest.x + sgn * -1, y: rest.y - 17 };
  const flat: XY = { x: rest.x + sgn * -1, y: rest.y - 7 };
  const cam = sc.cameras.main;
  const top = cam.worldView.y - 40;
  // three tilt maps (leaning left, level, leaning right), the string trailing above
  const tex = { l: kiteTexture(sc, -22, light, 'up'), m: kiteTexture(sc, 0, light, 'up'), r: kiteTexture(sc, 22, light, 'up') };
  const depth = unitDepth(home.y) + 2;
  const kite = S.own(kiteImage(sc, tex.m, land.x, top, flip, depth));
  const fallMs = 410;
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
    kite.setTexture(t > 0.92 ? tex.r : vx > 0.38 ? tex.r : vx < -0.38 ? tex.l : tex.m);
    kite.setPosition(R(x), R(y));
    const si = Math.min(sways - 1, Math.floor(t * sways));
    if (si !== swayIdx) {
      swayIdx = si;
      play('kfnKiteDrift', { pan: Math.max(-0.4, Math.min(0.4, pan + (si % 2 ? 0.22 : -0.22))), volume: 0.75 + si * 0.08 });
    }
  });
  kite.destroy();
  // ---- it tips over and flops (f0 tilt, f1 half flat), then lies FLAT (f2): the cloth slap on the flat frame;
  // each panel throws a 1-frame coloured pool
  u.showSprite();
  place(u, rest);
  show(u, 'summon', 0);
  await sleep(sc, 45);
  show(u, 'summon', 1);
  await sleep(sc, 45);
  show(u, 'summon', 2);
  play('kfnKiteFlop', { pan });
  const pools: [number, number, number][] = [
    [-7, -2, PAL.gold3],
    [6, -2, PAL.fire3],
    [-5, 3, PAL.fire3],
    [5, 3, PAL.gold3],
  ];
  for (const [dx, dy, c] of pools) void lightFlash(sc, R(flat.x + sgn * dx), R(home.y + dy), c, 9, 90, { floorY: R(home.y + dy), intensity: 0.75, rise: 10 });
  // (the flat frame holds: the cloth settles on the tile)
  await sleep(sc, 80);
  // ---- a bump rises under the cloth, it tents (the spar crossing lifted: the ridge is the highest point)
  show(u, 'summon', 3);
  play('kfnClothRustle', { pan, volume: 0.9 });
  await sleep(sc, 60);
  show(u, 'summon', 4);
  await sleep(sc, 60);
  // ---- he stands up under the kite: his head lifts the cloth (f5), the cloth slides back over his head — its hem at
  // his shoulders, in front above them and behind below (f6) — the shoulders come out as it slides back (f7), it
  // slides onto his shoulders and the spars settle (f8–f10); the string uncoils
  for (const [f, ms] of [
    [5, 55],
    [6, 45],
    [7, 60],
    [8, 60],
    [9, 60],
    [10, 60],
  ] as const) {
    show(u, 'summon', f);
    await sleep(sc, ms);
  }
  show(u, 'summon', 11);
  play('kfnCloakSettle', { pan });
  await sleep(sc, 70);
  // ---- the salute: the rapier up before the mask (a 1-frame tip glint), then snapped down — idle
  show(u, 'roar', 2);
  await sleep(sc, 50);
  show(u, 'roar', 3);
  play('kfnSaluteTsing', { pan });
  const tp = tipOf('roar', 3);
  const tipW = u.framePoint(tp.x, tp.y);
  void lightFlash(sc, R(tipW.x), R(tipW.y), PAL.white, 8, 120, { floorY: home.y, intensity: 0.6 });
  await sleep(sc, 100);
  show(u, 'roar', 4);
  await sleep(sc, 55);
  show(u, 'roar', 5);
  void u.badge.pop();
  await sleep(sc, 60);
  show(u, 'roar', 6);
  await sleep(sc, 60);
  show(u, 'roar', 7);
  await sleep(sc, 40);
  if (!u.retired) u.rest();
  idleSound(sc, u);
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
const deathWatched = new WeakSet<MonsterUnit>();
function watchDeath(scene: Phaser.Scene, u: MonsterUnit): void {
  if (deathWatched.has(u)) return;
  deathWatched.add(u);
  const sgn = sgnOf(u);
  const flip = u.flipX;
  const light = lightOf(u);
  const pan = panAt(u.home.x);
  let taut = false;
  let tautAt = 0;
  let lineDrawn = false;
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
      // the string pulls taut as the death begins (the pose may join at f2 straight from the recoil: the tension
      // still sounds before the snap)
      if (!taut && fi.frame >= 1) {
        taut = true;
        tautAt = el;
        play('kfnDeathTaut', { pan });
      }
      if (!lineDrawn && fi.frame === 1) {
        // the taut line drawn ABOVE every unit and every effect layer (DEPTH.FX_TOP + 5: a biting / burning killer in
        // melee range must not hide it), gold4 after a 2-frame white twang, out to its floor pin 22 px behind him; it
        // lives while the pose holds f1 (kiteDeathPose holds it until the attacker's contact overlay has cleared)
        lineDrawn = true;
        const tp = tailPoint('death', 1);
        const pinW = u.framePoint(AX - 22, GY);
        if (tp) {
          const line = tautString(scene, () => (u.sprite.active && u.frameInfo().anim === 'death' && u.frameInfo().frame === 1 ? u.framePoint(tp.x, tp.y) : null), { x: R(pinW.x), y: R(pinW.y) }, DEPTH.FX_TOP + 5, () => 0, { color: PAL.gold4, flashFrames: 2, ink: true });
          onFrame(scene, () => {
            if (u.sprite.active && u.frameInfo().anim === 'death' && u.frameInfo().frame <= 1) return true;
            line.destroy();
            return false;
          });
        }
      }
      if (taut && !snapped && fi.frame >= 2 && el - tautAt >= 60) {
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
          // in front of the units (an attacker standing on the tile must not hide the break), with a 1-frame spark of light
          void snapWhips(scene, m, { x: up.x / nu, y: up.y / nu }, { x: dn.x / nd, y: dn.y / nd }, DEPTH.FX_TOP + 5);
          void lightFlash(scene, m.x, m.y, PAL.white, 7, 90, { floorY: u.home.y, intensity: 0.55 });
        }
      }
      if (!flown && fi.frame >= 5) {
        flown = true;
        // the cloak leaves where the pose let go of it (death f4: the loose kite at AX + 14, 15, tilted 24°)
        flyAway(scene, u.framePoint(AX + 14, 15), sgn, flip, tex, u.sprite.depth + 1, deathFoe.get(u) ?? null);
        play('kfnCloakAway', { pan: sgn * 0.3, volume: 0.95 });
      }
      if (!folded && fi.frame >= 8) {
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

/** The unit that killed each dying kite (its box steers the flying cloak clear of it). */
const deathFoe = new WeakMap<MonsterUnit, MonsterUnit>();

/**
 * The cloak flies up and off screen (600 ms), swaying through 4 tilt maps, the snapped stub hanging under it. The wind
 * SNATCHES it straight up first (the first 180 ms ≈ 82° from the horizontal, a hair away from the attacker: never into
 * it), then it drifts and is carried off toward the top corner on the far side — the whole path keeps the cloth at
 * least 6 px over the attacker's live silhouette.
 */
function flyAway(scene: Phaser.Scene, from: XY, sgn: 1 | -1, flip: boolean, tex: string[], depth: number, foe: MonsterUnit | null): void {
  const img = kiteImage(scene, tex[2], from.x, from.y, flip, Math.max(depth, DEPTH.FX - 1));
  const cam = scene.cameras.main;
  const toY = cam.worldView.y - 50;
  const to: XY = { x: from.x + sgn * 150, y: toY };
  // the cloth's extent round its spar crossing (the stub string hangs under it)
  const HALF_W = 14;
  const BELOW = 24;
  const fb = foe && foe.sprite.active && foe.sprite.visible ? targetBox(foe, foe.core(), foe.home.y) : null;
  const clearOf = (p: XY): boolean => !fb || p.x + HALF_W < fb.x0 - 6 || p.x - HALF_W > fb.x1 + 6 || p.y + BELOW < fb.y0 - 6;
  let rise = 38;
  let seg1: XY[] = [];
  let seg2: XY[] = [];
  for (let tries = 0; tries < 10; tries++) {
    const L: XY = { x: from.x - sgn * 5, y: from.y - rise };
    seg1 = Array.from({ length: 13 }, (_, i) => lerpXY(from, L, i / 12));
    const c: XY = { x: L.x + sgn * 10, y: L.y - 26 };
    seg2 = Array.from({ length: 25 }, (_, i) => quad(L, c, to, i / 24));
    // (the snatch itself starts where the pose let go of the cloak: only its upper half and the drift are checked)
    if ([...seg1.slice(6), ...seg2].every(clearOf)) break;
    rise += 8;
  }
  const p1 = arcPath(seg1);
  const p2 = arcPath(seg2);
  const SNATCH = 0.3;
  void animate(scene, 600, (t) => {
    const p = t < SNATCH ? p1.at(quadOut(t / SNATCH)) : p2.at(Math.pow((t - SNATCH) / (1 - SNATCH), 1.35));
    const x = p.x + Math.sin(t * Math.PI * 3) * 4 * (1 - t);
    const sway = Math.sin(t * Math.PI * 3 + 0.6);
    const i = sway > 0.5 ? 3 : sway > 0 ? 2 : sway > -0.5 ? 1 : 0;
    img.setTexture(tex[sgn > 0 ? i : 3 - i]);
    img.setPosition(R(x), R(p.y));
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
    if (!u || u.retired || !u.has('death') || !u.sprite.active || !u.sprite.visible) return ctx.base();
    // the card's own death from start to finish: the recipe's deathV3 would end in the shared material burst and
    // its accent (the light burst's reticle and floor ring), which belong to other cards — never here
    await kiteDeath(c, u);
  },
  { priority: 20, name: 'kartc:kite_fencer:death' },
);


// ================================================================ the death, owned end to end

type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
type ToGraveyardEv = Extract<GameEvent, { type: 'toGraveyard' }>;

/** Resolve once `cond` holds, or after `ms` of scene time. */
function until(sc: Phaser.Scene, cond: () => boolean, ms: number): Promise<void> {
  if (cond()) return Promise.resolve();
  return new Promise<void>((resolve) => {
    onFrame(sc, (_dt, el) => {
      if (cond() || el >= ms) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/**
 * The kite's death (§5.2) with the death kit's bookkeeping (_v3/death.ts deathV3: the toGraveyard it consumes, the
 * tile released, the planned entry from the lethal recoil, the guard break, the 'v3:dying' / 'v3:dead' beacons) but
 * NO shared ending: the pose plays (string taut → SNAP → rapier drops → the cloak tears off and flies off screen →
 * the body thins, swaying, buckles, folds → the linen scrap, the rapier clattering at 0 / 90 / 150 ms + a rest tick),
 * then the scrap twitches toward the wind and frays into threads that drift after the cloak; the card is born on the
 * last thread frame and flies to the graveyard.
 */
async function kiteDeath(ctx: DestroyCtx, unit: MonsterUnit): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, {
    until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'fieldSpell' && e.type !== 'statChange',
  });
  const gEv = gi >= 0 ? (ctx.events[gi] as ToGraveyardEv) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  const owner = gEv ? gEv.owner : ctx.owner(ev.uid);
  const { tile } = field.release(ev.uid);
  const home: XY = tile ? { x: tile.home.x, y: tile.home.y } : zoneXY(ev.player, 'monster', ev.zone);
  unit.badge.setVisible(false);
  unit.posed = true;
  dimPanel(unit, true);
  let leave: Promise<void> | null = null;
  const onBorn = typeof ctx.hints.onBorn === 'function' ? (ctx.hints.onBorn as () => void) : null;
  const born = () => {
    if (leave) return;
    try {
      onBorn?.();
    } catch (e) {
      console.error('[kite_fencer] onBorn', e);
    }
    if (gEv) leave = cardLeaves(ctx, { owner, cardId: ev.cardId, from: home, tile, depthAt: behindBodies(ctx, unit) }).catch((e) => console.error('[kite_fencer] card', e));
    else if (tile && tile.active)
      leave = tile
        .dissolve(420)
        .then(() => {
          if (tile.active) tile.destroy();
        })
        .catch(() => undefined);
    else leave = Promise.resolve();
  };
  sc.events.emit('v3:dying', unit);
  try {
    await kiteDeathPose(ctx, unit, home, born);
  } catch (e) {
    console.error('[kite_fencer] death', e);
  } finally {
    born();
    unit.posed = false;
    if (!unit.retired) unit.retire(0);
    field.forget(ev.uid);
    sc.events.emit('v3:dead', unit);
  }
  await leave;
}

/** The death's taut beat: held until TAUT_AFTER ms after the contact, and at least TAUT_MIN ms. */
const TAUT_AFTER = 190;
const TAUT_MIN = 110;

async function kiteDeathPose(ctx: DestroyCtx, u: MonsterUnit, home: XY, born: () => void): Promise<void> {
  const sc = ctx.scene;
  const t0 = sc.time.now;
  // the killer (the battle just before this destroy): the flying cloak steers clear of it
  for (let i = ctx.index - 1; i >= 0; i--) {
    const e = ctx.events[i];
    if (e.type !== 'battle') continue;
    const other = e.attackerUid === ctx.ev.uid ? e.targetUid : e.attackerUid;
    const f = other !== null ? ctx.views.field.unit(other) : null;
    if (f && f !== u) deathFoe.set(u, f);
    break;
  }
  const n = u.frameCount('death');
  const push = ctx.hints.push as XY | undefined;
  if (ctx.hints.hit !== false) contactFlash(sc, u.sprite, push ?? { x: u.player === 0 ? -1 : 1, y: 0 }, { frames: 2, coverage: 0.4 });
  watchDeath(sc, u);
  const inDeath = () => u.frameInfo().anim === 'death';
  // a lethal recoil hands over to the pose by itself (react.ts): join it where it is
  let planned = takePlannedEntry(u);
  if (!planned && !inDeath() && u.sprite.active && showsGuard(u)) {
    const g = planGuardBreak(u);
    if (g) {
      runGuardBreak(u, g);
      planned = takePlannedEntry(u);
    }
  }
  if (planned && !inDeath()) await until(sc, inDeath, Math.min(700, (planned.leadMs ?? u.rangeMs(planned.anim, 0, planned.hold)) + 40));
  // the TAUT beat owns its moment: the pose holds f1 (the string pulled tight, drawn above every effect) until the
  // attacker's contact overlay has cleared — at least TAUT_AFTER ms after the contact, at least TAUT_MIN ms on screen —
  // then the snap (f2) and the rest of the pose play on. (A pose already past the snap is left alone.)
  if (u.sprite.active && !(inDeath() && u.frameInfo().frame > 2)) {
    u.asClaimant(() => u.pose('death', 1));
    await sleep(sc, Math.max(TAUT_MIN, TAUT_AFTER - (sc.time.now - t0)));
    if (u.sprite.active) u.asClaimant(() => void u.playRange('death', 2, undefined, { hold: true }));
  }
  if (!inDeath() && u.sprite.active) {
    const from = Math.max(0, Math.min(n - 2, planned ? planned.start : deathStartFrom(u)));
    u.asClaimant(() => void u.playRange('death', from, undefined, { hold: true }));
  }
  // the rapier on the tile: lands on f4, bounces up 2 px (f5), lands (f6), up 1 px (f7), lands (f8), rests (f9)
  const pan = panAt(home.x);
  atFrame(u, 'death', 4, () => play('kfnClatter', { pan }), { late: false });
  atFrame(u, 'death', 6, () => play('kfnClatterTick', { pan, volume: 0.8 }), { late: false });
  atFrame(u, 'death', 8, () => play('kfnClatterTick', { pan, volume: 0.55 }), { late: false });
  atFrame(u, 'death', 9, () => play('kfnClatterTick', { pan, volume: 0.3, pitch: 0.9 }), { late: false });
  await until(sc, () => !u.sprite.active || !inDeath() || u.frameInfo().frame >= n - 1 || !u.sprite.anims.isPlaying, 1600);
  if (!u.sprite.active) return;
  await sleep(sc, u.frameMs('death', n - 1));
  if (!u.sprite.active) return;
  // the scrap lets go: the sprite (scrap + rapier) hands over to the fray, which ends on the card's birth
  const sgn = sgnOf(u);
  const at = u.framePoint(AX + 1, GY - 1);
  const depth = u.sprite.depth + 0.2;
  u.sprite.setVisible(false);
  play('kfnScrapFade', { pan, volume: 0.9 });
  await scrapFray(sc, { x: R(at.x), y: R(at.y) }, sgn, depth, rng(u.uid * 71 + 9), born);
}
