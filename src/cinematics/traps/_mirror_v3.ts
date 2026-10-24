// Ayna Kalkanı — the v3 look (lane A5-A step A-4; docs/v3/A5_PLAN.md §3.3 "çok hedef, okunur sıra").
// Behind V3_A5_A only: mirror_barrier.ts hands over on its first line; v1 and the plain v3 look keep
// the dome (./_mirror.ts) unchanged. No registrations here.
//
// Instead of the soft dome over the whole row: a small, crisp honeycomb panel in the attack lane,
// and the reflections one by one — every victim dies its own death, in a readable order.
//   0        the trap opening (trapOpeningV3: the card springs up, burst, "TUZAK!", Ayna's glint);
//            its lean stays as it is. The attacker waits in its declaration's charge hold.
//   LAUNCH   the attacker lets its own attack go (the hold is handed over: no snap to idle) — timed so
//            that it meets the panel just after the panel is complete
//   250      PANEL — `raise`: 7 cells (2-3-2, ≈ 9×10 px each) build in the attack lane, in the
//            defender's third (a direct attack: in front of the defending duelist), from the middle
//            out in 4 steps 50 ms apart (frame first, the face one frame later); a magenta light pool
//            on the floor under it; magenta motes rise off its foot while it stands. 25×24 px — it
//            never covers more than half of the defender (EF-2). Today's dome lean
//            (mirror_barrier.ts:57) is called here, at the matching beat, with the same target and
//            options (user decision: the camera does not change). mirrorRaise (4 glass ticks, 50 ms)
//   ≈ 480    CATCH — `catch`: the attack meets the panel on its contact frame — a ranged strike's
//            bolt (attribute colours, white core) leaves the muzzle on the attack's own release frame;
//            a melee body lunges in on whole pixels and its impact frame touches the panel. 60 ms
//            hit-stop, the struck cell white for 2 frames, its rings one tone up / down (the wave),
//            pixel sparks, a magenta floor flash. The body is thrown back home. mirrorCatch (duck 0.45)
//   +60…     REFLECTION, one by one — `beam:<i>`, right after the hit-stop: for every attack-position
//            monster of the attacking side, nearest to the panel first, a beam leaves the struck cell
//            (3 px mag3 body, 1 px white core, a hard white head) and reaches the monster's core in
//            120 ms; its contact is that monster's own death (the v3 death kit: the v3 art's death
//            pose, the old art's reaction + material break), a 1-px white / magenta rim on its
//            silhouette, a 2-frame white star, a short floor strip of light. The next beam leaves
//            220 ms after the previous contact (later when two graveyard landings would come closer
//            than 150 ms). mirrorBeam on each contact, one step up per victim
//   last+120 BREAK — `break`: every cell splits into 2–3 whole-pixel shards that slide 8–14 px outward
//            and fade by palette steps; the light pool goes out. mirrorBreak (duck 0.4)
//   then     EXIT — `exit`: the trap card lies down on its tile and leaves for the graveyard from there
//            (card continuity), landing ≥ 150 ms after the last victim's card; the camera relaxes
//            (ctx.unfocus(320), as today).
// Nothing here adds a full-screen flash, a dim, a whole-sprite tint or a camera move (A5 §0 K1–K2).
// Under REDUCED_MOTION the particles are halved (fxCount); there is no local tremble here.

import type Phaser from 'phaser';
import { ATTRIBUTE_RAMP, PAL, RAMPS } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BOARD_MID_COL, DEPTH, type XY, isoToScreen, monsterRow, unitDepth, zoneXY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type LightHandle } from '../../view/light';
import { wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { fx, type CinematicContext } from '../api';
import { TK, type EvOf, all, lerpXY, live, norm, other, sub, takeAttack } from '../battle/_kit';
import { canHandOver, strikeStartFrame } from '../_v3/clash';
import { cardLeaves, flightMs } from '../_v3/card';
import { fxCount, fxRng, honeycombPanel, rimFlash, silhouetteOf, type HoneyPanel } from '../_v3/spellfx';
import { atFrame, panAt, play as playV3, soundsOf, takeCharge } from '../_v3/sound';
import type { SfxHandle } from '../../audio/sfx';
import { isRanged } from './chains_of_light';
import { trapOpening, type Opening } from './_opening';

type ActCtx = CinematicContext<EvOf<'activate'>>;

// ================================================================ timing (ms, scene clock, t = 0 at activate)

/** The panel starts to build: the trap card is standing (trapOpeningV3: standUp 220 ms + its 40 ms hit-stop). */
export const PANEL_AT = 250;
/** The build: 4 steps (middle → out), this far apart. */
const BUILD_GAP = 50;
/** The earliest contact: the panel is complete (4 steps + the last faces' frame). */
export const CATCH_AT = PANEL_AT + 4 * BUILD_GAP + 34;
/**
 * The attacker may let go from the trap's first frame on: its attack was declared and is already
 * coming (the slow wind-ups of the v3 art — Kristal Ejder's 460 ms from its charge pose to the
 * breath — still meet the panel only after it is complete).
 */
const LAUNCH_MIN = 0;
/** A ranged strike's bolt: muzzle → panel (4 frames). */
const PROJ_MS = 66;
/** A melee lunge never takes less than this (whole-pixel steps you can read). */
const LUNGE_MIN = 160;
/** The contact hit-stop (A5 §3.3 YAKALAMA). */
const CATCH_STOP = 60;
/** The melee body thrown back home after the catch. */
const BOUNCE_MS = 150;
/** After the hit-stop the first reflection leaves at once (the frame after the stop). */
const FIRST_BEAM_AFTER = 0;
/** A reflection: the head's travel, and the gap from one contact to the next beam (A5 §3.3). */
export const BEAM_MS = 120;
export const BEAM_GAP = 220;
/** The panel breaks this long after the last contact. */
const BREAK_AFTER = 120;
/** Two graveyard landings are at least this far apart (A5 §3.0 EF-12). */
export const LAND_GAP = 150;
/**
 * How long a victim's death takes from the beam's contact to its card landing on the graveyard
 * (the v3 death kit, measured in shots/v3/a56/baseline/measure-v3-a56-0.json: v3 art with a death
 * pose ≈ 1.05–1.12 s, the old art ≈ 0.52 s). Only used to keep two landings apart; the real landing
 * times decide the trap card's own exit.
 */
const DEATH_EST = { pose: 1220, legacy: 520 } as const;

// ================================================================ placement

/** The panel's place in the lane, from the attacker toward the defender: the defender's third. */
const LANE_T = 0.68;
/** A direct attack: nearer the defending duelist ("düellocunun önünde"). */
const LANE_T_DIRECT = 0.74;
/** Height of the panel's centre over the floor: its foot floats ≈ 6 px above it. */
const PANEL_LIFT = 18;

/** The cell a strike from `from` meets: the attacker's side of the middle row, or the top / bottom row by height. */
export function struckCell(panelAt: XY, from: XY): number {
  const dx = from.x - panelAt.x;
  const dy = from.y - panelAt.y;
  const side = Math.abs(dx) < 4 ? 0 : dx < 0 ? -1 : 1;
  if (dy < -7) return side > 0 ? 1 : 0;
  if (dy > 7) return side > 0 ? 6 : 5;
  return side === 0 ? 3 : side < 0 ? 2 : 4;
}

/** Victims in reflection order: nearest to the struck cell first (A5 §3.3); ties keep the event order. */
export function reflectionOrder(cell: XY, cores: readonly XY[]): number[] {
  return cores
    .map((p, i) => ({ i, d: Math.hypot(p.x - cell.x, p.y - cell.y) }))
    .sort((a, b) => a.d - b.d || a.i - b.i)
    .map((o) => o.i);
}

/**
 * When each beam leaves (ms after the first one leaves): 220 ms after the previous contact, pushed later
 * when this victim's card would land within LAND_GAP (+ a little margin) of an earlier one's.
 */
export function beamSchedule(deathMs: readonly number[], o: { beamMs?: number; gap?: number; landGap?: number } = {}): number[] {
  const beamMs = o.beamMs ?? BEAM_MS;
  const gap = o.gap ?? BEAM_GAP;
  const landGap = (o.landGap ?? LAND_GAP) + 20;
  const out: number[] = [];
  const lands: number[] = [];
  let at = 0;
  deathMs.forEach((d, k) => {
    if (k > 0) at = out[k - 1] + beamMs + gap;
    // push this beam later until its landing keeps clear of every earlier landing
    for (let guard = 0; guard < 8; guard++) {
      const land = at + beamMs + d;
      const clash = lands.find((l) => Math.abs(land - l) < landGap);
      if (clash === undefined) break;
      at += clash + landGap - land;
    }
    out.push(at);
    lands.push(at + beamMs + d);
  });
  return out;
}

// ================================================================ small pieces

/** Elapsed show time (speed / hit-stop aware, the clock the cards fly on) since the call. */
function showTimer(scene: Phaser.Scene): { now(): number; stop(): void } {
  let t = 0;
  const stop = onFrame(scene, (dt) => {
    t += dt;
    return true;
  });
  return { now: () => t, stop };
}

/** Whole-pixel line (Bresenham), endpoints included. */
function bres(x0: number, y0: number, x1: number, y1: number, put: (x: number, y: number) => void): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 2000; n++) {
    put(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

/** A 3-px stroke: body tone on the two neighbours across the line's main axis, core tone on the line. */
function stroke3(r: Raster, a: XY, b: XY, body: number | null, core: number): void {
  const flat = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
  if (body !== null)
    bres(a.x, a.y, b.x, b.y, (x, y) => {
      if (flat) {
        r.px(x, y - 1, body);
        r.px(x, y + 1, body);
      } else {
        r.px(x - 1, y, body);
        r.px(x + 1, y, body);
      }
    });
  bres(a.x, a.y, b.x, b.y, (x, y) => r.px(x, y, core));
}

/** A small hard star (contact / head): a white plus with tone tips. */
function star(r: Raster, p: XY, arm: number, tip: number): void {
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  for (let k = -arm; k <= arm; k++) {
    const c = Math.abs(k) === arm ? tip : PAL.white;
    r.px(x + k, y, c);
    r.px(x, y + k, c);
  }
}

/** Magenta motes rising off the panel's foot while it stands (living detail; whole pixels, palette steps). */
function panelMotes(scene: Phaser.Scene, foot: XY, w: number, depth: number, seed: number): () => void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, depth);
  let acc = 0;
  let stopped = false;
  const every = 70 * (fxCount(2) === 2 ? 1 : 2);
  const stop = onFrame(scene, (dt) => {
    if (stopped) return false;
    acc += dt;
    if (acc >= every) {
      acc = 0;
      sp.add({ x: Math.round(foot.x - w / 2 + rnd() * w), y: Math.round(foot.y), vy: -(18 + rnd() * 14), vx: (rnd() - 0.5) * 6, life: 280 + Math.floor(rnd() * 160), colors: [PAL.mag4, PAL.mag3, PAL.mag2, PAL.mag1], shape: rnd() < 0.2 ? 'plus' : 'px', fadeAt: 1 });
    }
    return true;
  });
  return () => {
    if (stopped) return;
    stopped = true;
    stop();
    sp.release();
  };
}

/**
 * A ranged strike's bolt from the muzzle into the panel (attribute colours, white core, whole pixels).
 * Resolves on its contact frame.
 */
function strikeBolt(scene: Phaser.Scene, from: XY, to: XY, ramp: readonly number[], depth: number): Promise<void> {
  const a = { x: Math.round(from.x), y: Math.round(from.y) };
  const b = { x: Math.round(to.x), y: Math.round(to.y) };
  const r = new Raster(scene, Math.min(a.x, b.x) - 6, Math.min(a.y, b.y) - 6, Math.abs(a.x - b.x) + 13, Math.abs(a.y - b.y) + 13, depth);
  const L = Math.max(1, Math.hypot(b.x - a.x, b.y - a.y));
  return run(scene, PROJ_MS, (t) => {
    const k = Math.min(1, t);
    const head = { x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) };
    // a short tail: ramp[2] → ramp[3] → white core near the head
    const tail = (d: number) => ({ x: Math.round(head.x - ((b.x - a.x) / L) * d), y: Math.round(head.y - ((b.y - a.y) / L) * d) });
    r.begin();
    const t3 = tail(Math.min(14, L * k));
    const t2 = tail(Math.min(8, L * k));
    const t1 = tail(Math.min(4, L * k));
    stroke3(r, t3, t2, null, ramp[2]);
    stroke3(r, t2, t1, ramp[2], ramp[3]);
    stroke3(r, t1, head, ramp[3], PAL.white);
    star(r, head, 1, ramp[4]);
    r.end();
  }).then(() => r.destroy());
}

/**
 * One reflected beam (A5 §3.3): from the struck cell to a victim's core in BEAM_MS — 3 px mag3 body,
 * 1 px white core, a hard head; on contact a 2-frame white star, then the beam steps down its ramp
 * (mag3/white → mag2/mag4 → mag3 core → gone). `onContact` runs on the contact frame.
 */
function reflectBeam(scene: Phaser.Scene, from: XY, to: XY, onContact: () => void): Promise<void> {
  const a = { x: Math.round(from.x), y: Math.round(from.y) };
  const b = { x: Math.round(to.x), y: Math.round(to.y) };
  const r = new Raster(scene, Math.min(a.x, b.x) - 8, Math.min(a.y, b.y) - 8, Math.abs(a.x - b.x) + 17, Math.abs(a.y - b.y) + 17, DEPTH.FX + 5);
  let hitFrame = -1;
  let frame = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt, el) => {
      if (dt > 0) frame++;
      // the head lands on the frame its 120 ms are up (7 frames at 60 fps; no extra frame of waiting)
      const k = Math.min(1, el / (BEAM_MS - 8));
      if (k >= 1 && hitFrame < 0) {
        hitFrame = frame;
        try {
          onContact();
        } catch (e) {
          console.error('[mirror] contact', e);
        }
      }
      const head = hitFrame < 0 ? { x: Math.round(a.x + (b.x - a.x) * k), y: Math.round(a.y + (b.y - a.y) * k) } : b;
      const after = hitFrame < 0 ? -1 : frame - hitFrame;
      r.begin();
      if (after < 0) {
        stroke3(r, a, head, PAL.mag3, PAL.white);
        star(r, head, 1, PAL.mag4);
      } else if (after < 2) {
        stroke3(r, a, b, PAL.mag3, PAL.white);
        star(r, b, 3, PAL.mag4);
      } else if (after < 4) stroke3(r, a, b, PAL.mag2, PAL.mag4);
      else if (after < 6) stroke3(r, a, b, null, PAL.mag3);
      r.end();
      // done after the steps (6 rendered frames past contact; a hit-stop holds them)
      if (after >= 6) {
        r.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** The catch on the struck cell: white star, pixel sparks, the magenta floor flash. */
function catchBurst(scene: Phaser.Scene, at: XY, floorY: number, seed: number): void {
  const r = Raster.around(scene, at.x, at.y, 24, 24, DEPTH.FX + 6);
  let f = 0;
  onFrame(scene, (dt) => {
    if (dt > 0) f++;
    r.begin();
    if (f < 2) star(r, at, 3, PAL.mag4);
    else if (f < 4) star(r, at, 2, PAL.mag3);
    r.end();
    if (f >= 4) {
      r.destroy();
      return false;
    }
    return true;
  });
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, DEPTH.FX + 7);
  const n = fxCount(10);
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd() * 0.4;
    const v = 50 + rnd() * 70;
    sp.add({ x: Math.round(at.x), y: Math.round(at.y), vx: Math.cos(ang) * v, vy: Math.sin(ang) * v * 0.7 - 10, drag: 3, ay: 60, life: 200 + Math.floor(rnd() * 160), colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sp.release();
  void lightFlash(scene, at.x, floorY, PAL.mag4, 30, 320, { floorY, ring: true, intensity: 1, air: 0 });
}

// ================================================================ the strike into the panel

interface StrikePlan {
  u: MonsterUnit;
  ranged: boolean;
  /** Attack frame it starts from (the declaration's held pose) and the contact / release frame. */
  f0: number;
  hit: number;
  /** From its launch to its contact with the panel. */
  lead: number;
}

/** A ranged strike's colours (dark → light): the v3 slice monsters' own (as their charge glow), else the attribute's. */
const STRIKE_RAMP: Readonly<Record<string, readonly number[]>> = {
  crystal_wyrm: RAMPS.cyan,
  abyss_magus: RAMPS.void,
};

function strikeRamp(u: MonsterUnit): readonly number[] {
  return STRIKE_RAMP[u.cardId] ?? ATTRIBUTE_RAMP[u.attribute];
}

function planStrike(u: MonsterUnit | null): StrikePlan | null {
  if (!u || !u.sprite.active || !u.has('attack')) return null;
  const ranged = isRanged(u.cardId);
  const f0 = strikeStartFrame(u);
  const hit = Math.max(f0, ranged ? u.markFrame('attack', 'release', u.impactFrame) : u.impactFrame);
  const toHit = u.rangeMs('attack', f0, hit);
  return { u, ranged, f0, hit, lead: ranged ? toHit + PROJ_MS : Math.max(LUNGE_MIN, toHit) };
}

// ================================================================ the exit

/**
 * The spent trap leaves (trapExitV3's beats with a landing time): it lies down on its tile, then is born
 * from there into its graveyard flight, landing no earlier than `landAt()` (elapsed show ms of `clock`).
 */
async function exitAfter(ctx: ActCtx, op: Opening, clock: { now(): number }, landAt: () => Promise<number | null>): Promise<void> {
  const ev = ctx.ev;
  op.stopAura();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  if (gi < 0) return;
  const gEv = ctx.events[gi] as EvOf<'toGraveyard'>;
  ctx.consumeAt(gi);
  const { tile } = ctx.views.field.release(ev.uid);
  const from = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : { x: Math.round(op.at.x), y: Math.round(op.at.y) };
  if (tile && tile.active && tile.standing) await tile.layDown(180);
  const target = await landAt();
  const top = ctx.views.field.pile(gEv.owner, 'graveyard').topXY();
  // cardLeaves: a 47 ms birth flash, a 50 ms lift, then the arc (flightMs by distance)
  const fly = 97 + flightMs(Math.hypot(top.x - from.x, top.y - from.y));
  const delay = target === null ? 0 : Math.max(0, Math.ceil(target - (clock.now() + fly)));
  return cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from, tile: tile && tile.active ? tile : null, delay });
}

// ================================================================ the scene

/** Ayna Kalkanı's activate hook, the v3 look (see the header). */
export async function mirrorV3(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const clock = showTimer(sc);
  const runIdx = fx.resolutionRun(ctx);
  const kills = runIdx.filter((i) => {
    const e = ctx.events[i];
    return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
  });
  const killEvs = kills.map((i) => ctx.events[i] as EvOf<'destroy'>);
  const pend = ctx.before.pending;
  const trig = pend && pend.kind === 'trapResponse' && pend.trigger.kind === 'attackDeclared' ? pend.trigger : null;
  const attackerUid = trig?.attackerUid ?? killEvs[0]?.uid ?? null;
  const attacker = attackerUid !== null ? live(ctx.unit(attackerUid)) : null;
  const attackerSide = attacker?.player ?? killEvs[0]?.player ?? other(ev.player);
  const { hold, other: kept } = takeAttack(ctx);
  kept?.destroy();
  const targetUid = hold?.targetUid ?? trig?.targetUid ?? null;
  const defender = targetUid !== null ? live(ctx.unit(targetUid)) : null;

  // ---- today's two camera calls, kept (user decision): the trap opening's lean (its own target) and
  // the dome lean of mirror_barrier.ts:57 — same targets and options, computed before anything moves
  const dome = isoToScreen(BOARD_MID_COL, monsterRow(ev.player));
  const domeTop = { x: dome.x, y: dome.y - 40 * TK };
  const trapPt = ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
  const aCore0 = attacker?.core() ?? domeTop;
  const leanAt = { x: (domeTop.x * 2 + aCore0.x) / 3, y: (domeTop.y * 2 + aCore0.y) / 3 };

  // ---- the lane and the panel's place in it
  const laneFrom = attacker ? { x: attacker.home.x, y: attacker.home.y } : zoneXY(attackerSide, 'monster', 1);
  const direct = !defender;
  const laneTo = defender ? { x: defender.home.x, y: defender.home.y } : (ctx.views.duelists?.get(ev.player)?.home ?? zoneXY(ev.player, 'spellTrap', 1));
  const foot0 = lerpXY(laneFrom, laneTo, direct ? LANE_T_DIRECT : LANE_T);
  const foot = { x: Math.round(foot0.x), y: Math.round(foot0.y) };
  const panelAt = { x: foot.x, y: foot.y - PANEL_LIFT };
  const panelDepth = unitDepth(foot.y) + 0.5;
  const plan = planStrike(attacker);
  const muzzle0 = attacker ? attacker.worldPoint('muzzle') : laneFrom;
  const cellIdx = struckCell(panelAt, muzzle0);
  // the panel exists from the start but shows nothing until it builds
  const panel = honeycombPanel(sc, { at: panelAt, depth: panelDepth, seed: ev.uid * 7 + 1 });
  const cell = panel.cellPoint(cellIdx);

  // ---- victims, in reflection order
  const victims = kills.map((i, k) => {
    const e = killEvs[k];
    const u = live(ctx.unit(e.uid));
    const z = zoneXY(e.player, 'monster', e.zone);
    return { i, e, u, core: u ? u.core() : { x: z.x, y: z.y - 14 } };
  });
  const order = reflectionOrder(cell, victims.map((v) => v.core)).map((k) => victims[k]);
  const departs = beamSchedule(order.map((v) => (v.u && v.u.has('death') ? DEATH_EST.pose : DEATH_EST.legacy)));

  // ---- PANEL (parallel with the opening): raise at PANEL_AT, built before CATCH_AT
  const lights: { pool: LightHandle | null; stopMotes: () => void } = { pool: null, stopMotes: () => undefined };
  const built = (async () => {
    await wait(sc, PANEL_AT);
    void ctx.focus(leanAt, { zoom: 1.04, ms: 420, pan: 0.3 });
    playV3('mirrorRaise', { volume: 0.9, pan: panAt(panelAt.x) }); // mark `raise`
    lights.pool = lightPool(sc, foot.x, foot.y, { color: PAL.mag3, spill: PAL.mag2, radius: 20, floorY: foot.y, intensity: 0.75, anim: 'breathe', fadeIn: 120 });
    lights.stopMotes = panelMotes(sc, { x: foot.x, y: foot.y - 6 }, 20, panelDepth + 0.1, ev.uid * 13 + 5);
    await panel.build(BUILD_GAP);
  })();

  // ---- the attacker lets its attack go so that it meets the panel just after the panel is complete;
  // `caught` resolves on the contact frame with what the body does after the hit-stop
  const launchAt = plan ? Math.max(LAUNCH_MIN, CATCH_AT - plan.lead) : CATCH_AT;
  const caught = (async (): Promise<() => Promise<void>> => {
    const none = () => Promise.resolve();
    await wait(sc, launchAt);
    if (!plan || !plan.u.sprite.active || plan.u.retired) {
      hold?.destroy();
      return none;
    }
    const u = plan.u;
    const s = u.sprite;
    // the strike continues from the pose the declaration holds now (its charge tremble stopped first)
    if (canHandOver(hold)) hold.handOver();
    else if (hold) await hold.release(60);
    const f0 = strikeStartFrame(u);
    hold?.dropMarks();
    sc.tweens.killTweensOf(s);
    u.posed = true;
    const voice = soundsOf(u.cardId);
    let charge: SfxHandle | null = null;
    if (voice) charge = takeCharge(u, voice.charge, { volume: 0.8, pan: panAt(u.home.x) });
    else ctx.sfx('whoosh', { volume: 0.5, pitch: plan.ranged ? 0.8 : 1.1 });
    if (plan.ranged) {
      // its own attack plays through; the bolt leaves the muzzle on the release frame
      let released!: () => void;
      const rel = new Promise<void>((r) => (released = r));
      atFrame(u, 'attack', plan.hit, () => released(), { maxMs: plan.lead + 400 });
      void u.playRange('attack', Math.min(f0, plan.hit));
      await Promise.race([rel, wait(sc, plan.lead - PROJ_MS + 120)]);
      charge?.stop(60);
      if (voice) playV3(voice.release, { volume: 0.85, pan: panAt(u.home.x) }); // mark `release`
      await strikeBolt(sc, u.worldPoint('muzzle'), cell, strikeRamp(u), DEPTH.FX + 4);
      return async () => {
        u.posed = false;
      };
    }
    // melee: the body lunges into the panel; its front edge meets the panel on the impact frame
    void u.playRange('attack', Math.min(f0, plan.hit), plan.hit);
    const r0 = { x: u.rest0.x, y: u.rest0.y };
    const sil = silhouetteOf(s);
    const halfW = sil ? Math.round((sil.right - sil.left) / 2) : 14;
    const dash = Math.max(0, Math.min(90, Math.hypot(foot.x - u.home.x, foot.y - u.home.y) - (halfW + 10)));
    const dir = norm(sub(foot, u.home));
    await run(sc, plan.lead, (t) => {
      if (!s.active) return;
      const e = t * t;
      s.setPosition(Math.round(r0.x + dir.x * dash * e), Math.round(r0.y + dir.y * dash * e));
    });
    charge?.stop(60);
    // after the hit-stop the panel throws it back home while its attack finishes
    return async () => {
      if (!s.active || u.retired) return;
      void u.playRange('attack', plan.hit);
      const p0 = { x: s.x, y: s.y };
      await run(sc, BOUNCE_MS, (t) => {
        if (!s.active || u.retired) return;
        const e = 1 - (1 - t) * (1 - t);
        s.setPosition(Math.round(p0.x + (r0.x - p0.x) * e), Math.round(p0.y + (r0.y - p0.y) * e));
      });
      if (!u.retired) u.posed = false;
    };
  })();

  const op = await trapOpening(ctx, { focus: lerpXY({ x: trapPt.x, y: trapPt.y - 30 }, domeTop, 0.5) });
  const after = await caught;
  await built;

  // ---- CATCH — `catch`
  panel.wave(cellIdx);
  catchBurst(sc, cell, foot.y, ev.uid * 31 + 3);
  playV3('mirrorCatch', { volume: 1, pan: panAt(cell.x) }); // mark `catch`
  sc.events.emit('v3:contact', attackerUid);
  lights.pool?.setIntensity(1.3, 40);
  await stopTime(sc, CATCH_STOP);
  void wait(sc, 120).then(() => lights.pool?.setIntensity(0.75, 200));
  const bounced = after();

  // ---- REFLECTION, one by one — `beam:<i>`
  const deaths: Promise<unknown>[] = [];
  const landings: Promise<number | null>[] = [];
  if (FIRST_BEAM_AFTER > 0) await wait(sc, FIRST_BEAM_AFTER);
  const t0 = clock.now();
  for (let k = 0; k < order.length; k++) {
    const v = order[k];
    const lag = departs[k] - (clock.now() - t0);
    if (lag > 0) await wait(sc, lag);
    const to = v.u && !v.u.retired && v.u.sprite.active ? v.u.core() : v.core;
    const dir = norm(sub(to, cell));
    const home = v.u ? { x: v.u.home.x, y: v.u.home.y } : zoneXY(v.e.player, 'monster', v.e.zone);
    panel.wave(cellIdx);
    // the beam's light falls on the floor in a short strip under its lane (no air glow)
    void lightBeam(sc, cell, to, PAL.mag3, 260, { air: false, floor: { from: { x: cell.x, y: foot.y }, to: home }, floorWidth: 8, intensity: 0.8 });
    let born!: (t: number | null) => void;
    landings.push(new Promise<number | null>((r) => (born = r)));
    await reflectBeam(sc, cell, to, () => {
      playV3('mirrorBeam', { volume: 0.9, pitch: Math.pow(2, (2 * k) / 12), pan: panAt(to.x) }); // mark `beam:<k>`
      // the victim's card is born on its burst frame: its landing = birth + flash + lift + arc
      const onBorn = () => {
        const top = ctx.views.field.pile(ctx.owner(v.e.uid), 'graveyard').topXY();
        // (+20 ms: the flash, lift and arc each end on a whole frame)
        born(clock.now() + 117 + flightMs(Math.hypot(top.x - home.x, top.y - home.y)));
      };
      // the beam's light rims the struck body (an edge light, never a tint: A5 §3.0); the old art
      // shows its own hit frame — the death kit then breaks it (its contact flash is not played)
      if (v.u && !v.u.retired && v.u.sprite.active) {
        void rimFlash(sc, v.u.sprite, { ramp: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], hold: 2 });
        if (!v.u.has('death')) void v.u.play(v.u.has('hitHeavy') ? 'hitHeavy' : 'hit', { hold: true });
      }
      const p = ctx.isConsumed(v.i) ? Promise.resolve() : ctx.play(v.i, { hit: false, push: dir, onBorn });
      deaths.push(p.then(() => born(null)));
    });
  }

  // ---- BREAK — `break`
  await wait(sc, BREAK_AFTER);
  playV3('mirrorBreak', { volume: 0.9, pan: panAt(panelAt.x) }); // mark `break`
  lights.stopMotes();
  void lights.pool?.fadeOut(220);
  const broken = panel.break();

  // ---- EXIT — `exit`: the trap card lands ≥ LAND_GAP after the last victim's card
  void ctx.unfocus(320);
  const landAt = async (): Promise<number | null> => {
    const ts = await Promise.all(landings);
    const known = ts.filter((t): t is number => t !== null);
    return known.length ? Math.max(...known) + LAND_GAP : null;
  };
  const exit = exitAfter(ctx, op, clock, landAt);
  // every kill the reflections did not reach (should not happen) still plays
  for (const i of kills) if (!ctx.isConsumed(i)) deaths.push(ctx.play(i, { hit: true }));
  await all([...deaths, exit, broken, bounced, op.banner]);
  clock.stop();
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}
