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
//   +0       FORGE (the 'equip' hook): out of the lying card's art the SIGNATURE great sword draws itself
//            upward in three steps (a 1-px gold line → + hilt and guard → the finished ≈ 17×47 blade:
//            gold planes, the white edge on the lit side, runes in the fuller, 1-px ink outline;
//            spellmotifs-v3 greatSwordMotif — never smaller than the old forge's 15×46 sword, the
//            user's rule of 24 Oct), a dashed rune ring opens on the floor round it; the card's art
//            window drops to dark night tones for two frames (its light left it), 6–8 rune pixels
//            pour into the blade, a gold pool on the tile. Today's camera lean at this beat is KEPT
//            (the user's decision: the same ctx.focus call, target and timing as dragon_blade.ts:260).
//            bladeForge, mark `forge`
//   +120     FLIGHT: the sword arcs up to its monster, its drawing taken from the three pre-drawn
//            angles (up, 45°, flat × 2 facings: spellfx.swordFor) closest to its travel — never a
//            fractional rotation. The drawings are planned once (flightPlan): no angle shows for under
//            ≈ 2 frames, and the blade never points into its holder (it rights itself before its tip
//            would reach the body). P1's sword goes behind the body from its first lean (it swings round
//            behind the back; P2's card lies behind the row: behind all the way). A 2-px gold trail on
//            whole pixels, at the sword's depth. bladeFly
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
// file's 'destroyed' hook): the aura's destroy (a two-frame white crack across the blade with the ring
// drawn tight and bright, then the burst — the blade's shards, the ring snapped into pieces and star
// sparks thrown up and out, falling and fading by palette steps: at least the old aura burst), the
// holder's 1-px edge white through the crack then down the gold ramp, and on the crack's first frame the single
// "−700", the badge rolls back — bladeBreak, mark `break`. The card leaves its tile with cardLeaves.
// Nothing here adds a camera move, a full-screen flash, a dim, or a whole-sprite tint.

import type Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, poseAxes, restQuat } from '../../art/cards';
import { hasMonsterArtV3 } from '../../art/monsters';
import { monsterSheetKey, warmMonsterSheet } from '../../art/textures';
import { GREAT_BLADE, crackPath, type MotifFacing, type SwordAngle } from '../../art/spellmotifs-v3';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { wait } from '../../vfx/core';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BREAK_CRACK_FRAMES, equipAnchor, equipAuraV3, equipSwordAt, ringPixels } from '../../duel/auras-v3';
import { fx, type CinematicContext } from '../api';
import { fxCount, fxRng, greatSwordKey, motifImage, rimFlash, setMotif, swordFor } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { bg, evAt, fs, idxOf, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';

type EquipCtx = CinematicContext<Extract<GameEvent, { type: 'equip' }>>;
type DestroyCtx = CinematicContext<Extract<GameEvent, { type: 'destroy' }>>;
export type StatEv = Extract<GameEvent, { type: 'statChange' }>;

// ================================================================ timing (scene ms, 1×)

/** The opening's hold (spellOpeningV3 halves it: 90 ms, A5 §3.1 "Tutuş"). */
const OPEN_HOLD = 180;
/** LAND: the flight onto the zone and the lie-down (a set card only lies back down). */
const LAND_MS = 80;
const LIE_MS = 70;
const LIE_SET_MS = 110;
/** FORGE: one step of the sword drawing itself (3 steps). */
export const FORGE_STEP = 36;
/** FLIGHT to the anchor. */
export const FLIGHT_MS = 180;
/** After the bond: the settle the input waits for (the great sword condenses at CONDENSE_AT; the badge's roll ≤ 400). */
const SETTLE_MS = 460;
/** The bond pose (v3 art): the peak's hold, the step back, the cap on a forward frame. */
export const PEAK_HOLD = 160;
const BACK_STEP = 40;
const FORWARD_CAP = 70;
/** The victory frame each v3 monster peaks on (wings spread / orb star / the fist at the chest). */
const VICTORY_PEAK: Readonly<Record<string, number>> = { crystal_wyrm: 3, abyss_magus: 3, stone_sentinel: 3 };

const GOLD_TRAIL = [PAL.gold4, PAL.gold3, PAL.gold2] as const;
const RUNE_FX = [PAL.gold2, PAL.gold3, PAL.gold4] as const;
const BOND_FX = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2] as const;
/** The break's edge light on the body: white through the crack frames, then a frame each down the gold ramp. */
const BREAK_RIM = [PAL.white, PAL.gold4, PAL.gold4, PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2] as const;

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

/** The great sword's guard while it forms on the lying card: its pommel on the card's middle, rising a pixel or two per stage. */
function forgeGuard(home: XY, stage: 1 | 2 | 3): XY {
  return { x: Math.round(home.x), y: Math.round(home.y) - 15 - (stage === 1 ? 0 : stage === 2 ? 1 : 3) };
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
 * The flight's path (pure; tested): straight up off the card, over toward the body's back side, then
 * down into the anchor from above — the blade is set onto the monster's back point up.
 */
export function flightPath(from: XY, to: XY, side: -1 | 1): [XY, XY, XY, XY] {
  // up (the upright drawing), across on a diagonal (the 45° one), a short drop into place (upright)
  return [from, { x: from.x, y: from.y - 10 }, { x: to.x + side * 4, y: Math.min(from.y, to.y) - 16 }, to];
}

/**
 * The drawing for a travel direction (pure; tested): the closest pre-drawn angle while it rises or
 * crosses; going down it keeps the upright drawing (the blade is lowered into place point up — there is
 * no point-down drawing); 'up' when it barely moves.
 */
export function flightDrawing(d: XY): FlightDrawing {
  if (Math.hypot(d.x, d.y) < 1e-3 || d.y > Math.abs(d.x) * 0.35) return { angle: 'up', facing: 1 };
  return swordFor(d.x, d.y);
}

/** One drawing of the flying sword. */
export interface FlightDrawing {
  angle: SwordAngle;
  facing: MotifFacing;
}

/** The flight's ease (the path parameter at flight time t ∈ [0, 1]): fast off the card, settling into place. */
export function flightEase(t: number): number {
  return t >= 1 ? 1 : 1 - (1 - t) * (1 - t);
}

/** The drawing plan's flight-time samples (every 5 ms of FLIGHT_MS) and its shortest held run (≈ 2 frames at 1×). */
export const PLAN_SAMPLES = 37;
export const PLAN_MIN_RUN = 7;

/** How far the great sword's tip reaches sideways from its guard in the leaning drawings. */
const BLADE_REACH: Readonly<Record<SwordAngle, number>> = { up: 0, diag: Math.round(GREAT_BLADE * 0.72), flat: GREAT_BLADE };

/**
 * The flight's drawing at each of `n` evenly spaced flight-time samples (pure; tested): flightDrawing of
 * the path's tangent at the eased parameter, the upright drawing on the last sample (the bond). The
 * blade never points into its holder: a drawing leaning toward the body (the side away from `side`, the
 * anchor's side) rights itself once its tip would pass the body's back edge (the anchor sits 4 px
 * outside it) — it arrives upright instead of skewering the body. A drawing that would hold for fewer
 * than `minRun` samples — the one-frame flat flick as the path tops out over the anchor — is absorbed by
 * the drawing before it, so each angle the sword shows lasts ≥ 2 frames.
 */
export function flightPlan(path: readonly [XY, XY, XY, XY], side: -1 | 1, n = PLAN_SAMPLES, minRun = PLAN_MIN_RUN): FlightDrawing[] {
  const same = (a: FlightDrawing, b: FlightDrawing): boolean => a.angle === b.angle && (a.angle === 'up' || a.facing === b.facing);
  const edge = path[3].x - side * 4;
  const runs: { d: FlightDrawing; n: number }[] = [];
  for (let i = 0; i < n; i++) {
    let d: FlightDrawing = { angle: 'up', facing: 1 };
    if (i < n - 1) {
      const { p, d: tan } = bez(path[0], path[1], path[2], path[3], flightEase(i / (n - 1)));
      d = flightDrawing(tan);
      if (d.angle !== 'up' && d.facing === -side && (p.x + d.facing * BLADE_REACH[d.angle] - edge) * -side > 0) d = { angle: 'up', facing: 1 };
    }
    const last = runs[runs.length - 1];
    if (last && same(last.d, d)) last.n++;
    else runs.push({ d, n: 1 });
  }
  // a short run between two others joins the one before it (then equal neighbours merge)
  for (let i = 1; i < runs.length - 1; ) {
    if (runs[i].n >= minRun) {
      i++;
      continue;
    }
    runs[i - 1].n += runs[i].n;
    runs.splice(i, 1);
    if (i < runs.length && same(runs[i - 1].d, runs[i].d)) {
      runs[i - 1].n += runs[i].n;
      runs.splice(i, 1);
    }
  }
  const out: FlightDrawing[] = [];
  for (const r of runs) for (let j = 0; j < r.n; j++) out.push(r.d);
  return out;
}

/** The plan's drawing at flight time t ∈ [0, 1]. */
export function planAt(plan: readonly FlightDrawing[], t: number): FlightDrawing {
  return plan[Math.max(0, Math.min(plan.length - 1, Math.round(t * (plan.length - 1))))];
}

/** The middle of the great sword's blade from its guard, for a drawing (the trail runs there). */
function bladeMid(angle: SwordAngle, facing: MotifFacing): XY {
  return angle === 'up' ? { x: 0, y: -14 } : angle === 'flat' ? { x: facing * 14, y: 0 } : { x: facing * 10, y: -10 };
}

/**
 * A rune circle on the floor round the forming sword (≥ the old forge ring: 52 px across): dashes and six
 * rune pixels, drawn in `step` thirds (1…3), then stepped down the gold ramp by `fade` (0…3; 3 = gone).
 */
function drawForgeRing(ras: Raster, c: XY, step: number, fade: number): void {
  ras.begin();
  if (fade < 3) {
    const pts = ringPixels(c.x, c.y, 26, 13, Math.PI / 2);
    const n = Math.ceil((pts.length * Math.min(3, step)) / 3);
    const tone = [PAL.gold3, PAL.gold2, PAL.gold1][fade];
    const rune = [PAL.gold4, PAL.gold3, PAL.gold2][fade];
    for (let i = 0; i < n; i++) {
      const d = i % 6;
      if (d === 4 || d === 5) continue;
      ras.px(pts[i].x, pts[i].y, i % Math.max(1, Math.floor(pts.length / 6)) === 0 ? rune : tone);
    }
    if (step < 3 && n > 0 && fade === 0) ras.px(pts[n - 1].x, pts[n - 1].y, PAL.white);
  }
  ras.end();
}

/**
 * The bond's floor burst (≥ the old forge's 62-px floor ring): two 1-px gold rings stepping out from the
 * feet across the floor and down the ramp, one step per two rendered frames. Resolves when gone.
 */
function floorBurst(scene: Phaser.Scene, at: XY, depth: number): Promise<void> {
  const ras = Raster.around(scene, at.x, at.y, 136, 72, depth);
  const rings = [
    { start: 0, rx: [8, 18, 30, 42, 52, 62], tone: [PAL.white, PAL.gold4, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1] },
    { start: 3, rx: [6, 14, 24, 34, 44], tone: [PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2, PAL.gold1] },
  ];
  let frame = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt > 0) frame++;
      ras.begin();
      let live = false;
      for (const r of rings) {
        const k = Math.floor((frame - r.start) / 2);
        if (k < 0) {
          live = true;
          continue;
        }
        if (k >= r.rx.length) continue;
        live = true;
        for (const q of ringPixels(at.x, at.y, r.rx[k], Math.max(3, Math.round(r.rx[k] / 2)))) ras.px(q.x, q.y, r.tone[k]);
      }
      ras.end();
      if (!live) {
        ras.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
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

  // ---- FORGE (mark `forge`): the great sword draws itself up out of the card's art in three steps
  const standDepth = unitDepth(home.y) + 0.5;
  const g1 = forgeGuard(home, 1);
  const sword = motifImage(sc, ...greatSwordKey({ stage: 1 }), g1.x, g1.y, standDepth);
  playV3('bladeForge', { volume: 0.9, pan: panAt(home.x) });
  dimArt(sc, tile);
  const pool = lightPool(sc, home.x, home.y, { color: PAL.gold3, spill: PAL.gold1, radius: fs(22), floorY: home.y, intensity: 0.9, fadeIn: 0 });
  const ring = Raster.around(sc, home.x, home.y, 60, 32, DEPTH.TILE_FX + 2);
  drawForgeRing(ring, home, 1, 0);
  // 6–8 rune pixels from round the card pour into the blade
  const rnd = fxRng(ev.spellUid * 13 + 7);
  const runes = new PxSparks(sc, standDepth + 0.2);
  const nRunes = fxCount(8);
  for (let i = 0; i < nRunes; i++) {
    const a = (i / nRunes) * Math.PI * 2 + rnd() * 0.5;
    runes.add({
      x: Math.round(home.x + Math.cos(a) * 26),
      y: Math.round(home.y + Math.sin(a) * 13),
      tx: g1.x + (i % 2 === 0 ? -1 : 1),
      ty: g1.y - 4 - Math.round(rnd() * 22),
      curl: (rnd() * 2 - 1) * 10,
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
  setMotif(sword, ...greatSwordKey({ stage: 2 }));
  sword.setPosition(g2.x, g2.y);
  drawForgeRing(ring, home, 2, 0);
  await step(sc, FORGE_STEP);
  const g3 = forgeGuard(home, 3);
  setMotif(sword, ...greatSwordKey({ runesLit: true }));
  sword.setPosition(g3.x, g3.y);
  drawForgeRing(ring, home, 3, 0);
  await step(sc, FORGE_STEP);

  // ---- FLIGHT: the closest pre-drawn angle each frame, a 2-px gold trail; the forge ring steps down
  playV3('bladeFly', { volume: 0.8, pan: panAt(home.x) });
  void lightFlash(sc, home.x, home.y, PAL.gold4, fs(18), 140, { floorY: home.y, intensity: 0.8 }); // the push-off
  void pool.fadeOut(200);
  const an = equipAnchor(u);
  const trail = new PxSparks(sc, DEPTH.FX + 2);
  // the drawings are planned once (no one-frame flicks); P1's sword goes behind the body when it first
  // tilts toward its anchor (it swings round behind the monster's back — never across the body in front)
  const plan = flightPlan(flightPath(g3, equipSwordAt(u), an.side), an.side);
  const tiltAt = plan.findIndex((d) => d.angle !== 'up');
  const behindFrom = tiltAt > 0 ? tiltAt / (plan.length - 1) : 0.66;
  let last: XY | null = null;
  let drawingKey = '';
  let ringFade = 0;
  await run(sc, FLIGHT_MS, (t) => {
    if (!sword.active) return;
    const fade = Math.min(3, Math.floor((t * FLIGHT_MS) / 60) + 1);
    if (fade > ringFade) {
      ringFade = Math.min(fade, ringFade + 1);
      drawForgeRing(ring, home, 3, ringFade);
    }
    const to = equipSwordAt(u);
    const path = flightPath(g3, to, an.side);
    const { p } = bez(path[0], path[1], path[2], path[3], flightEase(t));
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    const dr = t >= 1 ? { angle: 'up' as const, facing: 1 as const } : planAt(plan, t);
    const key = `${dr.angle}${dr.facing}`;
    if (key !== drawingKey) {
      drawingKey = key;
      setMotif(sword, ...greatSwordKey({ angle: dr.angle, facing: dr.facing }));
    }
    sword.setPosition(x, y);
    // P1: in front while it rises off its (nearer) card, behind the body from its first tilt (it settles
    // behind the back); P2: its card lies behind the monster's row — behind the body all the way. The
    // trail rides at the sword's depth (it is never drawn over a body the sword is behind)
    const behind = u.sprite.depth - 0.4;
    const depth = u.player === 1 ? Math.min(standDepth, behind) : t >= behindFrom ? behind : standDepth;
    sword.setDepth(depth);
    trail.px.g.setDepth(depth - 0.01);
    const m = bladeMid(dr.angle, dr.facing);
    const here = { x: x + m.x, y: y + m.y };
    if (last && (here.x !== last.x || here.y !== last.y)) for (let j = 0; j < 2; j++) trail.add({ x: last.x + j, y: last.y, life: 110, colors: GOLD_TRAIL, shape: 'px', fadeAt: 1 });
    last = here;
  });
  trail.release();
  ring.destroy();

  // ---- BOND (mark `bond`): the aura takes the great sword over on this frame
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
  const nSp = fxCount(6);
  for (let i = 0; i < nSp; i++) {
    const a = -Math.PI / 2 + (i / Math.max(1, nSp - 1) - 0.5) * 2.6;
    const v = 40 + rnd() * 30;
    sparks.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 120, drag: 2, life: 180 + Math.round(rnd() * 80), colors: BOND_FX, shape: i % 2 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sparks.release();
  // the feet: the floor burst and a gold flash two frames bright (the aura's own one tone stays)
  bg(floorBurst(sc, ip(u.home), DEPTH.TILE_FX + 3));
  void lightFlash(sc, u.home.x, u.home.y, PAL.gold4, fs(30), 120, { floorY: u.home.y, intensity: 1.1 });
  const pose = bondPose(u);
  await Promise.all([pose, wait(sc, SETTLE_MS)]);
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
 * single number shares it, the badge rolls back, the body's edge lights; resolves after the crack's
 * frames (the burst, the edge light and the badge go on by themselves).
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
  // the gold leaves the body: its 1-px edge white through the crack, then down the gold ramp as the blade
  // bursts (the old burst's white → gold glow, crisp), and the old burst's light flash on the body
  bg(rimFlash(sc, u.sprite, { ramp: BREAK_RIM, hold: BREAK_CRACK_FRAMES }));
  const c = u.core();
  void lightFlash(sc, c.x, c.y, PAL.gold4, fs(30), 320, { floorY: u.home.y, intensity: 0.75 });
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
