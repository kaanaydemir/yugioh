// Ejder Kılıcı (dragon_blade) — the v3 look. Lane A5-A step A-2 (docs/v3/A5_PLAN.md §3.1: "kart
// kılıca dönüşür, kılıç canavara bağlanır"). Behind V3_A5_A only: dragon_blade.ts hands its
// 'activate' / 'equip' / 'destroyed' hooks over on their first line, flow/stats.ts hands a blade's
// loss over to bladeBreakBeat; v1 and the plain v3 look run the old code unchanged.
//
// Times are scene ms from activate at 1× (hand; a set card stands up on its tile instead of flying):
//   0–200    the A2 opening (spellOpeningV3): the card beside its owner, the duelist's 'command'
//   200–320  hold: the card breathes a pixel, motes gather in it
//   320–500  LAND (landV3): whole pixels, no rotation — the card flies onto its spell zone, appears
//            standing on its tile and lies down; the tile burns one gold tone — cardPlace, mark `land`
//   +0       FORGE (the 'equip' hook): out of the lying card's art the sword draws itself upward in
//            three steps (a 1-px gold line → + hilt and guard → the finished sword: gold planes, the
//            white edge on the lit side, 1-px ink outline; spellmotifs-v3 swordMotif); the card's art
//            window drops to dark night tones for two frames (its light left it), 6–8 rune pixels
//            pour into the blade, a gold pool on the tile. Today's camera lean at this beat is KEPT
//            (the user's decision: the same ctx.focus call, target and timing as dragon_blade.ts:260).
//            bladeForge, mark `forge`
//   +120     FLIGHT: the sword arcs up to its monster, its drawing picked each frame from the three
//            pre-drawn angles (up, 45°, flat × 2 facings: spellfx.swordFor) closest to its travel —
//            never a fractional rotation; a 2-px gold trail on whole pixels. bladeFly
//   +320     BOND: the sword stops at the monster's equip anchor (auras-v3 equipAnchor: the body box's
//            top left behind the back for P1, the mirror for P2) — the persistent aura takes it over on
//            this frame (equipAuraV3 { bond }): one frame of a white rim on the SWORD only, the waist
//            ring closing clockwise in three steps. The same frame: the single "+700" (EF-9), the badge
//            rolls, 4–6 gold sparks, a gold flash at the feet that settles to the aura's one tone.
//            v3 art in attack position plays `victory` forward to its peak, holds it 160 ms and steps
//            back to f0 (no new frames); the old art and a guarding monster are never posed.
//            bladeBond (duck 0.45), mark `bond`
//   ≤ 1500   the input comes back (the settle: the sword starts its 1-px bob)
// BREAK (bladeBreakBeat: the blade's loss reaches the monster — flow/stats.ts's v3 statChange, or this
// file's 'destroyed' hook): the aura's destroy (a two-frame white crack across the blade, 6–8 gold
// shards fall and fade by palette steps, the ring snaps) and on the crack's first frame the single
// "−700", the badge rolls back — bladeBreak, mark `break`. The card leaves its tile with cardLeaves.
// Nothing here adds a camera move, a full-screen flash, a dim, or a whole-sprite tint.

import type Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, poseAxes, restQuat } from '../../art/cards';
import { hasMonsterArtV3 } from '../../art/monsters';
import { monsterSheetKey, warmMonsterSheet } from '../../art/textures';
import { crackPath, type MotifFacing, type SwordAngle } from '../../art/spellmotifs-v3';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { wait } from '../../vfx/core';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { AURA_SWORD_LEN, BREAK_CRACK_FRAMES, equipAnchor, equipAuraV3, equipSwordAt } from '../../duel/auras-v3';
import { fx, type CinematicContext } from '../api';
import { motifImage, setMotif, swordFor, swordKey, fxCount, fxRng } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { bg, evAt, fs, idxOf, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';

type EquipCtx = CinematicContext<Extract<GameEvent, { type: 'equip' }>>;
type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
export type StatEv = Extract<GameEvent, { type: 'statChange' }>;

// ================================================================ timing (scene ms, 1×)

/** The opening's hold (spellOpeningV3 halves it: 120 ms, A5 §3.1 "Tutuş"). */
const OPEN_HOLD = 240;
/** LAND: the flight onto the zone and the lie-down (a set card only lies back down). */
const LAND_MS = 90;
const LIE_MS = 90;
const LIE_SET_MS = 120;
/** FORGE: one step of the sword drawing itself (3 steps). */
export const FORGE_STEP = 40;
/** FLIGHT to the anchor. */
export const FLIGHT_MS = 200;
/** After the bond: the settle the input waits for (old art / a guarding monster; the badge's roll ≤ 400). */
const SETTLE_MS = 420;
/** The bond pose (v3 art): the peak's hold, the step back, the cap on a forward frame. */
export const PEAK_HOLD = 160;
const BACK_STEP = 50;
const FORWARD_CAP = 90;
/** The victory frame each v3 monster peaks on (wings spread / orb star / the fist at the chest). */
const VICTORY_PEAK: Readonly<Record<string, number>> = { crystal_wyrm: 3, abyss_magus: 3, stone_sentinel: 3 };

const GOLD_TRAIL = [PAL.gold4, PAL.gold3, PAL.gold2] as const;
const RUNE_FX = [PAL.gold2, PAL.gold3, PAL.gold4] as const;
const BOND_FX = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2] as const;

// ================================================================ small helpers

/** Resolve after `n` rendered frames (never fewer, at any speed). */
function frames(scene: Phaser.Scene, n: number): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    onFrame(scene, (dt) => {
      if (dt > 0) k++;
      if (k >= n) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** Wait `ms` of scene time, but at least one rendered frame (a stepped beat never skips a step at 3×). */
function step(scene: Phaser.Scene, ms: number): Promise<void> {
  return Promise.all([wait(scene, ms), frames(scene, 1)]).then(() => undefined);
}

/** The direction and size of a stat change. */
function statDelta(e: StatEv): { up: boolean; delta: number } {
  const up = e.atk > e.prevAtk || (e.atk === e.prevAtk && e.def > e.prevDef);
  return { up, delta: Math.abs(e.atk - e.prevAtk) || Math.abs(e.def - e.prevDef) };
}

/**
 * The bond pose plan (A5 §3.1 BAĞ, pure — the tests read it): `victory` forward from f0 to `peak`
 * at its own holds (each ≤ FORWARD_CAP), the peak held PEAK_HOLD, then back down to f0 a step of
 * BACK_STEP each. No frame outside the anim; the last shown frame is f0 (the rest pose follows).
 */
export function bondPosePlan(holds: readonly number[], peak: number): { f: number; ms: number }[] {
  const p = Math.max(0, Math.min(holds.length - 1, peak));
  const out: { f: number; ms: number }[] = [];
  for (let f = 0; f < p; f++) out.push({ f, ms: Math.min(FORWARD_CAP, Math.max(34, holds[f] ?? 60)) });
  out.push({ f: p, ms: PEAK_HOLD });
  for (let f = p - 1; f >= 0; f--) out.push({ f, ms: BACK_STEP });
  return out;
}

/** The bond pose on v3 art in attack position (see bondPosePlan); resolves when the unit rests again. */
async function bondPose(u: MonsterUnit): Promise<void> {
  if (!hasMonsterArtV3(u.cardId) || u.position !== 'attack' || !u.has('victory')) return;
  const sc = u.scene;
  const n = u.frameCount('victory');
  const holds = Array.from({ length: n }, (_, f) => u.rangeMs('victory', f, f + 1));
  const plan = bondPosePlan(holds, VICTORY_PEAK[u.cardId] ?? Math.floor(n * 0.4));
  u.posed = true;
  for (const s of plan) {
    if (u.retired || !u.sprite.active) return;
    if (!u.pose('victory', s.f)) break;
    await step(sc, s.ms);
  }
  if (u.retired || !u.sprite.active) return;
  u.posed = false;
  u.settle();
}

/** The victory frames are painted in the background ahead of the bond (never on the bond frame). */
function warmBond(u: MonsterUnit | null): void {
  if (!u || !hasMonsterArtV3(u.cardId)) return;
  try {
    warmMonsterSheet(monsterSheetKey(u.cardId, u.player), ['victory']);
  } catch {
    /* warming is an optimisation only */
  }
}

// ================================================================ the card

/** Normalised art window of the lying card's mini face (18×26: the 16×12 art at (1, 4); cards.ts drawMiniFace). */
const ART_U0 = 1 / FLAT_W;
const ART_U1 = 17 / FLAT_W;
const ART_V0 = 4 / FLAT_H;
const ART_V1 = 16 / FLAT_H;

/**
 * Whether iso pixel (x, y) of a card lying flat (its static iso texture, ISO_TEX_W × ISO_TEX_H) shows
 * its art window — the inverse of cards.ts renderCard's mapping for the rest pose (pure; tested).
 */
export function inArtWindow(x: number, y: number, player: PlayerId, orientation: 'up' | 'side'): boolean {
  const { ex, ey } = poseAxes(restQuat(player, orientation, true), FLAT_W, FLAT_H);
  const det = ex[0] * ey[1] - ey[0] * ex[1];
  if (Math.abs(det) < 1e-6) return false;
  const rx = x + 0.5 - ISO_CX;
  const ry = y + 0.5 - ISO_CY;
  let u = (ey[1] * rx - ey[0] * ry) / det + 0.5;
  const v = (-ex[1] * rx + ex[0] * ry) / det + 0.5;
  if (det < 0) u = 1 - u;
  return u >= ART_U0 && u < ART_U1 && v >= ART_V0 && v < ART_V1;
}

/** Two rendered frames of the lying card's art window in dark night tones (its light leaves it). */
function dimArt(scene: Phaser.Scene, tile: TileCard | null): void {
  if (!tile || !tile.active) return;
  const cp = tile.currentPixels();
  if (cp.px.w !== ISO_TEX_W || cp.px.h !== ISO_TEX_H) return;
  const o = tile.orientation === 'side' ? 'side' : 'up';
  const ras = new Raster(scene, cp.x, cp.y, cp.px.w, cp.px.h, tile.depth + 0.5);
  ras.begin();
  for (let y = 0; y < cp.px.h; y++)
    for (let x = 0; x < cp.px.w; x++) {
      if (cp.px.alpha(x, y) === 0 || !inArtWindow(x, y, tile.player, o)) continue;
      const c = cp.px.get(x, y) ?? PAL.night1;
      const lum = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
      ras.px(cp.x + x, cp.y + y, lum > 150 ? PAL.night3 : lum > 70 ? PAL.night2 : PAL.night1);
    }
  ras.end();
  bg(frames(scene, 2).then(() => ras.destroy()));
}

/** Two frames of a white crack across a lying card (the blade's card breaking), as Volkan's replace. */
function crackCard(scene: Phaser.Scene, tile: TileCard, home: XY, seed: number): Promise<void> {
  const crack = Raster.around(scene, home.x, home.y, 48, 28, tile.depth + 0.5);
  const path = crackPath({ x: home.x - 15, y: home.y + 2 }, { x: home.x + 15, y: home.y - 3 }, seed * 7 + 5, 2);
  crack.begin();
  for (const q of path) crack.px(q.x, q.y, PAL.white);
  const mid = path[Math.floor(path.length / 2)];
  for (const q of crackPath(mid, { x: mid.x - 2, y: mid.y + 6 }, seed * 7 + 11, 1)) crack.px(q.x, q.y, PAL.white);
  crack.end();
  return frames(scene, 2).then(() => crack.destroy());
}

// ================================================================ activate

/** activate, the v3 look (see the header). */
export async function bladeActivateV3(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const run0 = fx.resolutionRun(ctx);
  const ti = idxOf(ctx, run0, (e) => e.type === 'target');
  const ei = idxOf(ctx, run0, (e) => e.type === 'equip' && e.spellUid === ev.uid);
  const eq = evAt(ctx, ei, 'equip');
  warmBond(eq ? ctx.unit(eq.targetUid) : null);
  const set = setTileOf(ctx);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: OPEN_HOLD });
  if (ev.zone === null) {
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, run0);
    return;
  }
  const zone = ev.zone;
  const at = zoneXY(ev.player, 'spellTrap', zone);
  const land = () => {
    // the tile burns one gold tone under the card lying down (mark `land`)
    playV3('cardPlace', { volume: 0.8, pan: panAt(at.x) });
    bg(ctx.views.board.flashTile(ev.player, 'spellTrap', zone, PAL.gold3, 150));
    void lightFlash(sc, at.x, at.y, PAL.gold3, fs(20), 220, { floorY: at.y, intensity: 0.55 });
  };
  const tile = op.landV3 ? await op.landV3({ spot: 'spellTrap', index: zone, ms: LAND_MS, lieMs: set ? LIE_SET_MS : LIE_MS, onLand: land }) : await op.land({ spot: 'spellTrap', index: zone });
  if (ti >= 0) ctx.consumeAt(ti);
  if (ei >= 0) await ctx.play(ei, { from: { x: tile.home.x, y: tile.home.y } });
  await fx.playRun(ctx, fx.resolutionRun(ctx));
  relax(ctx, 360);
}

// ================================================================ equip: forge → flight → bond

/** The sword's guard while it forms on the lying card: its pommel on the card's middle. */
function forgeGuard(home: XY, stage: 1 | 2 | 3): XY {
  return { x: Math.round(home.x), y: Math.round(home.y) - 8 - (stage === 1 ? 0 : stage === 2 ? 1 : 3) };
}

/** Cubic Bézier point / tangent. */
function bez(p0: XY, p1: XY, p2: XY, p3: XY, t: number): { p: XY; d: XY } {
  const u = 1 - t;
  const p = {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
  const d = {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
  return { p, d };
}

/**
 * The flight's path (pure; tested): up off the card, round the body's back side, up into the anchor
 * from below (so the last drawing is the upright one the aura keeps).
 */
export function flightPath(from: XY, to: XY, side: -1 | 1): [XY, XY, XY, XY] {
  const rise = Math.max(18, Math.round((from.y - to.y) * 0.6));
  return [from, { x: from.x + side * 4, y: from.y - rise }, { x: to.x + side * 3, y: to.y + 22 }, to];
}

/** The drawing for a travel direction: the closest pre-drawn angle; 'up' when it barely moves. */
export function flightDrawing(d: XY): { angle: SwordAngle; facing: MotifFacing } {
  if (Math.hypot(d.x, d.y) < 1e-3) return { angle: 'up', facing: 1 };
  return swordFor(d.x, d.y);
}

/** The forge, the v3 look (see the header). */
export async function bladeEquipV3(ctx: EquipCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const u = ctx.unit(ev.targetUid);
  const ci = ctx.findType('statChange', (e) => e.uid === ev.targetUid, { until: (e) => e.type !== 'statChange' });
  const st = evAt(ctx, ci, 'statChange');
  if (ci >= 0) ctx.consumeAt(ci);
  if (!u || u.retired || !u.sprite.active || !u.sprite.visible) {
    if (u && st) await u.setStats(st.atk, st.def, false);
    return;
  }
  warmBond(u);
  const tile = ctx.views.field.tileAt(ev.player, 'spellTrap', ev.spellZone);
  const home = tile ? ip(tile.home) : ip((ctx.hints.from as XY | undefined) ?? zoneXY(ev.player, 'spellTrap', ev.spellZone));
  // today's lean at this beat (kept by the user's decision: same call, same target, same timing)
  const c = u.core();
  bg(ctx.focus({ x: c.x, y: c.y - 20 }, { zoom: 1.06, ms: 420, pan: 0.3 }));

  // ---- FORGE (mark `forge`): the sword draws itself up out of the card's art in three steps
  const standDepth = unitDepth(home.y) + 0.5;
  const g1 = forgeGuard(home, 1);
  const sword = motifImage(sc, ...swordKey({ len: AURA_SWORD_LEN, stage: 1 }), g1.x, g1.y, standDepth);
  playV3('bladeForge', { volume: 0.9, pan: panAt(home.x) });
  dimArt(sc, tile);
  const pool = lightPool(sc, home.x, home.y, { color: PAL.gold3, spill: PAL.gold1, radius: fs(18), floorY: home.y, intensity: 0.9, fadeIn: 0 });
  // 6–8 rune pixels from round the card pour into the blade
  const rnd = fxRng(ev.spellUid * 13 + 7);
  const runes = new PxSparks(sc, standDepth + 0.2);
  const nRunes = fxCount(7);
  for (let i = 0; i < nRunes; i++) {
    const a = (i / nRunes) * Math.PI * 2 + rnd() * 0.5;
    const rr = 15 + rnd() * 6;
    runes.add({
      x: Math.round(home.x + Math.cos(a) * rr),
      y: Math.round(home.y + Math.sin(a) * rr * 0.5),
      tx: g1.x + (i % 2 === 0 ? -1 : 1),
      ty: g1.y - 2 - Math.round(rnd() * 8),
      curl: (rnd() * 2 - 1) * 8,
      life: 90 + Math.round(rnd() * 30),
      delay: i * 6,
      colors: RUNE_FX,
      shape: i % 3 === 0 ? 'plus' : 'px',
      fadeAt: 1,
    });
  }
  runes.release();
  await step(sc, FORGE_STEP);
  const g2 = forgeGuard(home, 2);
  setMotif(sword, ...swordKey({ len: AURA_SWORD_LEN, stage: 2 }));
  sword.setPosition(g2.x, g2.y);
  await step(sc, FORGE_STEP);
  const g3 = forgeGuard(home, 3);
  setMotif(sword, ...swordKey({ len: AURA_SWORD_LEN, stage: 3 }));
  sword.setPosition(g3.x, g3.y);
  await step(sc, FORGE_STEP);

  // ---- FLIGHT: the closest pre-drawn angle each frame, a 2-px gold trail
  playV3('bladeFly', { volume: 0.8, pan: panAt(home.x) });
  void pool.fadeOut(200);
  const an = equipAnchor(u);
  const trail = new PxSparks(sc, DEPTH.FX + 2);
  let last = { x: g3.x, y: g3.y };
  let drawingKey = '';
  await run(sc, FLIGHT_MS, (t) => {
    if (!sword.active) return;
    const to = equipSwordAt(u);
    const path = flightPath(g3, to, an.side);
    const k = t < 1 ? 1 - (1 - t) * (1 - t) : 1;
    const { p, d } = bez(path[0], path[1], path[2], path[3], k);
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const dr = t >= 1 ? { angle: 'up' as const, facing: 1 as const } : flightDrawing(d);
    const key = `${dr.angle}${dr.facing}`;
    if (key !== drawingKey) {
      drawingKey = key;
      setMotif(sword, ...swordKey({ len: AURA_SWORD_LEN, angle: dr.angle, facing: dr.facing }));
    }
    sword.setPosition(x, y);
    // P1: in front while it rises off its (nearer) card, behind the body for the last third (it settles
    // behind the back); P2: its card lies behind the monster's row — behind the body all the way
    const behind = u.sprite.depth - 0.4;
    sword.setDepth(u.player === 1 ? Math.min(standDepth, behind) : t > 0.66 ? behind : standDepth);
    if (x !== last.x || y !== last.y) {
      for (let j = 0; j < 2; j++) trail.add({ x: last.x + j, y: last.y - 5, life: 110, colors: GOLD_TRAIL, shape: 'px', fadeAt: 1 });
      last = { x, y };
    }
  });
  trail.release();

  // ---- BOND (mark `bond`): the aura takes the sword over on this frame
  sword.destroy();
  if (u.retired || !u.sprite.active) {
    if (st) void u.setStats(st.atk, st.def, false);
    return;
  }
  u.setAura('equip', equipAuraV3(sc, u, { bond: true }));
  const at = equipSwordAt(u);
  playV3('bladeBond', { volume: 1, pan: panAt(at.x) });
  if (st) {
    const { up, delta } = statDelta(st);
    const top = u.worldPoint('top');
    if (delta > 0) bg(impactNumber(sc, Math.round(top.x), Math.round(top.y) - 4, delta, { kind: up ? 'heal' : 'damage' }));
    void u.setStats(st.atk, st.def, true);
  }
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const nSp = fxCount(5);
  for (let i = 0; i < nSp; i++) {
    const a = -Math.PI / 2 + (i / Math.max(1, nSp - 1) - 0.5) * 2.4;
    const v = 34 + rnd() * 26;
    sparks.add({ x: at.x, y: at.y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 120, drag: 2, life: 160 + Math.round(rnd() * 80), colors: BOND_FX, shape: i % 2 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sparks.release();
  // the feet: a gold flash two frames bright (the aura's own one tone stays)
  void lightFlash(sc, u.home.x, u.home.y, PAL.gold4, fs(26), 120, { floorY: u.home.y, intensity: 1.1 });
  const pose = bondPose(u);
  await Promise.all([pose, wait(sc, hasMonsterArtV3(u.cardId) && u.position === 'attack' ? 0 : SETTLE_MS)]);
}

// ================================================================ the break

/**
 * A statChange that takes the blade's bonus away from a monster still wearing its aura (the card left
 * the field before it: Uçurum Büyücüsü's effect, a rule destroy …). `state` is the state after the
 * statChange (the event's own stateNext, or the batch's end for a grouped one).
 */
export function bladeLost(state: { players: readonly { spellTraps: readonly ({ equippedTo: number | null } | null)[] }[] }, e: StatEv, u: MonsterUnit): boolean {
  if (u.retired || !u.hasAura('equip')) return false;
  if (e.atk >= e.prevAtk) return false;
  return !state.players.some((p) => p.spellTraps.some((s) => !!s && s.equippedTo === e.uid));
}

/**
 * The break beat (see the header): the aura's destroy draws the white crack on this very frame, the
 * single number shares it, the badge rolls back; resolves after the crack's frames (the shards, the
 * ring's snap and the badge go on by themselves).
 */
export async function bladeBreakBeat(ctx: AnyCtx, e: StatEv, u: MonsterUnit): Promise<void> {
  const sc = ctx.scene;
  const at = equipSwordAt(u);
  playV3('bladeBreak', { volume: 0.9, pan: panAt(at.x) }); // mark `break`
  u.setAura('equip', null);
  const { up, delta } = statDelta(e);
  const top = u.worldPoint('top');
  if (delta > 0) bg(impactNumber(sc, Math.round(top.x), Math.round(top.y) - 4, delta, { kind: up ? 'heal' : 'damage' }));
  void u.setStats(e.atk, e.def, true);
  void lightFlash(sc, at.x, at.y + 6, PAL.gold3, fs(16), 160, { floorY: u.home.y, intensity: 0.7 });
  await frames(sc, BREAK_CRACK_FRAMES + 1);
}

/** The equip leaves the field, the v3 look: its card cracks and leaves; a standing holder's blade breaks. */
export async function bladeDestroyedV3(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'spellTrap') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid, { until: (e) => e.type !== 'toGraveyard' && e.type !== 'destroy' && e.type !== 'statChange' });
  const g = evAt(ctx, gi, 'toGraveyard');
  if (gi >= 0) ctx.consumeAt(gi);
  const slot = ctx.state.players[ev.player].spellTraps[ev.zone];
  const holder = slot?.equippedTo ?? (ev.reason === 'rule' ? ev.sourceUid : null);
  const u = holder !== null && holder !== undefined ? ctx.unit(holder) : null;
  const jobs: Promise<unknown>[] = [];
  let broke = false;
  if (u && !u.retired && u.hasAura('equip')) {
    // a holder still standing: its ATK roll-back is this beat (the sword breaks, one number)
    const ci = ctx.findType('statChange', (e) => e.uid === holder, { until: (e) => e.type !== 'statChange' && e.type !== 'toGraveyard' && e.type !== 'destroy' });
    const se = evAt(ctx, ci, 'statChange');
    if (se && ci >= 0) {
      ctx.consumeAt(ci);
      jobs.push(bladeBreakBeat(ctx, se, u));
      broke = true;
    } else u.setAura('equip', null);
  }
  const { tile } = field.release(ev.uid);
  const home = tile ? ip(tile.home) : zoneXY(ev.player, 'spellTrap', ev.zone);
  if (tile && tile.active) {
    if (!tile.faceUp) {
      tile.setCard(ev.cardId);
      await tile.flipUp(160);
    }
    if (!broke) playV3('bladeBreak', { volume: 0.6, pan: panAt(home.x) });
    await crackCard(sc, tile, home, ev.uid);
  }
  if (g) jobs.push(cardLeaves(ctx, { owner: g.owner, cardId: ev.cardId, from: home, tile }));
  else if (tile && tile.active) jobs.push(tile.dissolve(300).then(() => tile.active && tile.destroy()));
  field.forget(ev.uid);
  await fx.all(jobs);
}
