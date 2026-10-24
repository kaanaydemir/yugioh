// Ejder Kılıcı (dragon_blade) — the v3 look. Lane A5-A step A-2 (docs/v3/A5_PLAN.md §3.1), the forge
// rebuilt by the bigsword step on the user's rule of 24 Oct (A5_PLAN top note, REHBER EF-2: a signature
// effect is never smaller or duller than the old one; v3 differs by crisp pixels, detail, frames, light
// and sound — never by shrinking). Behind V3_A5_A only: dragon_blade.ts hands its 'activate' / 'equip' /
// 'destroyed' hooks over on their first line, flow/stats.ts hands a blade's loss over to bladeBreakBeat;
// v1 and the plain v3 look run the old code unchanged.
//
// The forge is the OLD path (dragon_blade.ts forge, v1: its sizes, beats and timing) drawn in v3 pixels.
// Times are scene ms from activate at 1× (hand; a set card stands up on its tile instead of flying):
//   0–200    the A2 opening (spellOpeningV3): the card beside its owner, the duelist's 'command'
//   200–320  hold: the card breathes a pixel, motes gather in it
//   320–500  LAND (landV3): whole pixels, no rotation — the card flies onto its spell zone, appears
//            standing on its tile and lies down; the tile burns one gold tone — cardPlace, mark `land`
// FORGE (the 'equip' hook, +ms; today's camera lean at this beat is KEPT: the same ctx.focus call,
// target and timing as dragon_blade.ts:265, the user's decision):
//   +0       eight gold runes leave the lying card's art (its art window drops to night tones for two
//            frames: its light left it) and arc up over the monster; the forge ring — one 1-px ring as
//            wide as the old one's outer ring (88 / 72 px), its back arc behind the head — draws itself
//            round in three steps and its dashes creep; a gold pool lies under the monster — bladeFly
//   +270     the runes orbit a beat, then converge into a vertical spine over the ring
//   +383     the SWORD draws itself top → bottom white-hot in four steps (_blade_sword.ts: 'big' 33×96
//            over a medium+ monster with head room, 'mid' 17×49 otherwise — the old forge's own size
//            choice, never smaller than its 30×92 / 15×46), cools through gold4 to its planes, the
//            runes in its fuller glowing — bladeForge, mark `forge`
//   +483     it SPINS 1.5 turns while it rises 8 px — pre-drawn turn drawings, no fractional scale; the
//            ring steps down the gold ramp and goes out; a light streak runs down the blade
//   +700     it HANGS (5 px higher, a beat), a star on its point
//   +766     it PLUNGES (inQuad, a one-frame trail of light lines over it) — bladeFly
//   +850     IMPACT (mark `bond`): its point in the body's middle; hit-stop 70 ms; the struck part
//            flashes white with a gold band (EF-3 contact flash, the heavy 3 frames) and the body's
//            1-px edge lights white, then gold runs down it from the stab; the single "+700" (EF-9),
//            the badge rolls; the floor rings (≥ the old 62 px) and 26 gold sparks; v3 art in attack
//            position plays `victory` to its peak and back (no new frames) — bladeBond (duck 0.45)
//   +920     the blade SINKS 20 / 10 px into the body (cut at the stab line), down the gold ramp to
//            light, in a stepped column of light
//   +1150    the persistent aura takes over (auras-v3 equipAuraV3 { bond }): the small sword at the
//            monster's back with one frame of a white rim, the waist ring closing round it
//   +1283    the input comes back (measured at 1×, equip at 517: ready 1800 ms in spBlade / Def / P2,
//            1733 for the set card, 1850–1867 where the v3 pose plays — +450…+483 over the old v3)
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
import { crackPath } from '../../art/spellmotifs-v3';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { wait } from '../../vfx/core';
import { E, Raster, freeze, lerp, onFrame, qbez, run, spriteBox } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BREAK_CRACK_FRAMES, equipAuraV3, equipSwordAt, ringPixels } from '../../duel/auras-v3';
import { fx, type CinematicContext } from '../api';
import { fxCount, fxRng, motifImage, rimClimb, rimFlash, setMotif } from '../_v3/spellfx';
import { contactFlash } from '../_v3/flash';
import { panAt, play as playV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { type ForgeLook, type ForgeSize, forgeSizeFor, forgeSwordGeom, forgeSwordKey, turnAt } from './_blade_sword';
import { bg, evAt, fs, idxOf, ip, lightBeam, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type AnyCtx } from './_kit';

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
/** The forge's beats — the old forge's (dragon_blade.ts forge, v1). */
export const FORGE = {
  /** the runes fly out of the card into the ring (each rune `runeEach`, one every `runeStagger`) */
  runes: 230,
  runeEach: 150,
  runeStagger: 11,
  /** the ring starts to draw itself (three steps) */
  ringAt: 70,
  ringStep: 57,
  orbit: 40,
  converge: 90,
  /** the white-hot draw-in: DRAW_STEPS steps of one frame (the old 70 ms crop) */
  drawStep: 16,
  /** the cooling frames (gold4) before the planes show (two frames, the old 34 ms) */
  cool: 33,
  spin: 210,
  hang: 60,
  plunge: 70,
  /** the hit-stop of the stab (EF-5: a spell 60–100 ms) */
  stop: 70,
  sink: 230,
  /** after the sink: the aura's bond ring closes before the input comes back */
  settle: 100,
} as const;
export const DRAW_STEPS = 4;
const RISE_PX = 8;
const HANG_PX = 5;
/** How far the blade sinks into the body after the stab (the old 10·SS). */
const SINK_PX: Readonly<Record<ForgeSize, number>> = { big: 20, mid: 10 };
/**
 * The impact number's centre, in px off the blade's edge: "+700" is 31 px of glyphs (+1 px ink a
 * side) and slams at 2× for its first two frames (_v3/number.ts), so 32–34 px reach each way from
 * its centre then; 36 keeps even the slam clear of the blade's ink (~17 px of air once it settles).
 */
const NUMBER_CLEAR = 36;
/** The bond pose (v3 art): the peak's hold, the step back, the cap on a forward frame. */
export const PEAK_HOLD = 160;
const BACK_STEP = 40;
const FORWARD_CAP = 70;
/** The victory frame each v3 monster peaks on (wings spread / orb star / the fist at the chest). */
const VICTORY_PEAK: Readonly<Record<string, number>> = { crystal_wyrm: 3, abyss_magus: 3, stone_sentinel: 3 };

const G = [PAL.gold0, PAL.gold1, PAL.gold2, PAL.gold3, PAL.gold4] as const;
const RUNE_TRAIL = [PAL.gold4, PAL.gold3, PAL.gold2] as const;
const SPARK_FX = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1] as const;
/** The stab on the body's edge: white two frames, then a frame each down the gold ramp. */
const STAB_RIM = [PAL.white, PAL.white, PAL.gold4, PAL.gold4] as const;
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

// ================================================================ equip: the forge (the old path, v3 pixels)

/** Where the forge happens over a body box (pure; tested). */
export interface ForgeLayout {
  size: ForgeSize;
  /** The sword's centre column (world x). */
  x: number;
  /** The forge ring: over the head like a halo (the old circleY), as wide as the old outer ring. */
  ringY: number;
  rx: number;
  ry: number;
  /** The sword's top row while it forms (the old hover: its point just over the ring). */
  top: number;
  /** The sword's top row on the stab frame (its point in the body's middle, the old stabY). */
  stabTop: number;
  /** The point's row inside the drawing and the drawing's height. */
  tipRow: number;
  h: number;
}

/** The old forge's layout (dragon_blade.ts forge) for the v3 drawings (see ForgeLayout). */
export function forgeLayout(box: { cx: number; top: number; h: number }): ForgeLayout {
  const size = forgeSizeFor(box);
  const geo = forgeSwordGeom(size);
  const ringY = Math.max(22, Math.round(box.top - 8));
  const half = Math.round(geo.h / 2);
  const hoverY = Math.max(half + 16, ringY - half - 4);
  // the old rings: CR = 22 + 8·SS, the outer one at CR + 6, 0.32 high
  const rx = 22 + (size === 'big' ? 16 : 8) + 6;
  const middle = Math.round(box.top + box.h * 0.5);
  return { size, x: Math.round(box.cx), ringY, rx, ry: Math.round(rx * 0.32), top: hoverY - half, stabTop: middle - geo.tipRow, tipRow: geo.tipRow, h: geo.h };
}

/**
 * The forge ring (one 1-px ring, EF-7): `shown` thirds drawn clockwise from the front (1…3, a white
 * head while it draws), its dashes creeping by `creep`; `fade` steps it down the ramp (0 bright … 3 gone).
 * The back arc (above the centre) behind the body, the front arc in front.
 */
function drawHalo(back: Raster, front: Raster, L: ForgeLayout, shown: number, creep: number, fade: number): void {
  back.begin();
  front.begin();
  if (fade < 3) {
    const pts = ringPixels(L.x, L.ringY, L.rx, L.ry, Math.PI / 2);
    const n = Math.ceil((pts.length * Math.min(3, shown)) / 3);
    for (let i = 0; i < n; i++) {
      const q = pts[i];
      const behind = q.y < L.ringY;
      const d = (i + creep) % 6;
      let c: number | null;
      if (shown < 3) c = i === n - 1 ? PAL.white : G[4 - fade];
      else c = d >= 4 ? null : d === 0 ? G[Math.max(1, 4 - fade)] : behind ? G[Math.max(1, 2 - fade)] : G[Math.max(1, 3 - fade)];
      if (c !== null) (behind ? back : front).px(q.x, q.y, c);
    }
  }
  back.end();
  front.end();
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

/** The sink's look by its progress (the old alpha 1 → 0.6 → 0.25 as palette steps), null = gone. */
export function sinkLook(t: number): ForgeLook | null {
  return t < 0.3 ? 'full' : t < 0.5 ? 'cool' : t < 0.7 ? 'ember' : t < 0.9 ? 'ghost' : null;
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

  const target = u.sprite;
  const L = forgeLayout(spriteBox(sc, target));
  const geo = forgeSwordGeom(L.size);
  const rnd = fxRng(ev.spellUid * 13 + 7);
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  const NR = 8;
  const swordDepth = DEPTH.FX + 2;

  // ---- 0–250: the runes leave the card's art and arc up into the forge ring over the head
  playV3('bladeFly', { volume: 0.6, pan: panAt(home.x) });
  dimArt(sc, tile);
  const cardPool = lightPool(sc, home.x, home.y, { color: PAL.gold3, spill: PAL.gold1, radius: fs(22), floorY: home.y, intensity: 0.9, fadeIn: 0 });
  void cardPool.fadeOut(260);
  const ringLight = lightPool(sc, L.x, u.home.y, { color: PAL.gold3, spill: PAL.gold1, radius: fs(30), floorY: u.home.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  ringLight.setIntensity(0.7, 300);
  const RW = L.rx * 2 + 6;
  const RH = L.ry * 2 + 6;
  const haloBack = Raster.around(sc, L.x, L.ringY, RW, RH, target.depth - 0.5);
  const haloFront = Raster.around(sc, L.x, L.ringY, RW, RH, DEPTH.FX + 1);
  let ringShown = 0;
  let ringFade = 0;
  let creep = 0;
  const stopHalo = onFrame(sc, (dt, el) => {
    if (el >= FORGE.ringAt) ringShown = Math.min(3, Math.floor((el - FORGE.ringAt) / FORGE.ringStep) + 1, ringShown + 1);
    if (dt > 0 && ringShown >= 3) creep++;
    drawHalo(haloBack, haloFront, L, ringShown, creep, ringFade);
  });
  const nb = fxCount(10);
  for (let i = 0; i < nb; i++)
    sparks.add({ x: home.x + Math.round((rnd() - 0.5) * 12), y: home.y, vx: (rnd() - 0.5) * 80, vy: -30 - rnd() * 60, ay: 200, life: 200 + Math.round(rnd() * 160), colors: SPARK_FX, shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  const slot = (i: number, el: number): XY => {
    const a = el * 0.0034 + (i / NR) * Math.PI * 2;
    return { x: L.x + Math.cos(a) * L.rx, y: L.ringY + Math.sin(a) * L.ry };
  };
  const runes: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < NR; i++) runes.push(sc.add.image(home.x, home.y, 'set:rune', `r${i}`).setDepth(DEPTH.FX + 2).setVisible(false));
  let el0 = 0;
  await run(sc, FORGE.runes, (_t, el) => {
    el0 = el;
    runes.forEach((r, i) => {
      const k = Math.max(0, Math.min(1, (el - i * FORGE.runeStagger) / FORGE.runeEach));
      if (k <= 0) return;
      const end = slot(i, el);
      const ctrl = { x: lerp(home.x, end.x, 0.3) + (i % 2 ? -18 : 18), y: Math.min(home.y, end.y) - 26 };
      const p = qbez(home, ctrl, end, E.outCubic(k));
      if (!r.visible) r.setVisible(true).setTintFill(PAL.white);
      else if (k > 0.3) r.clearTint();
      r.setPosition(Math.round(p.x), Math.round(p.y));
      if (k < 1 && rnd() < 0.6) sparks.add({ x: Math.round(p.x), y: Math.round(p.y), life: 120 + Math.round(rnd() * 100), colors: RUNE_TRAIL, shape: 'px', fadeAt: 1 });
    });
  });
  // one beat in the ring: they orbit, the back ones behind the head
  await run(sc, FORGE.orbit, (_t, el) => {
    runes.forEach((r, i) => {
      const p = slot(i, el0 + el);
      r.setPosition(Math.round(p.x), Math.round(p.y));
      r.setDepth(Math.sin((el0 + el) * 0.0034 + (i / NR) * Math.PI * 2) > 0 ? DEPTH.FX + 2 : target.depth - 0.4);
    });
  });
  // ---- converge into the blade's spine
  const ss = L.size === 'big' ? 2 : 1;
  const spine = (i: number): XY => ({ x: L.x, y: L.top + 4 * ss + (i / (NR - 1)) * (L.h - 10 * ss) });
  const starts = runes.map((r) => ({ x: r.x, y: r.y }));
  await run(sc, FORGE.converge, (t) => {
    const k = E.inCubic(t);
    runes.forEach((r, i) => {
      const p = spine(i);
      r.setDepth(DEPTH.FX + 2).setPosition(Math.round(lerp(starts[i].x, p.x, k)), Math.round(lerp(starts[i].y, p.y, k)));
    });
  });
  runes.forEach((r) => r.destroy());

  // ---- the sword draws itself top → bottom white-hot (mark `forge`), cools, its runes glowing
  playV3('bladeForge', { volume: 0.9, pan: panAt(L.x) });
  const sword = motifImage(sc, ...forgeSwordKey({ size: L.size, look: 'hot' }), L.x, L.top, swordDepth);
  for (let s = 1; s <= DRAW_STEPS; s++) {
    sword.setCrop(0, 0, geo.w, Math.ceil((geo.h * s) / DRAW_STEPS));
    await step(sc, FORGE.drawStep);
  }
  sword.setCrop();
  const ns = fxCount(16);
  for (let i = 0; i < ns; i++) {
    const yy = L.top + 6 + Math.round(rnd() * (L.h - 12));
    sparks.add({ x: L.x + Math.round((rnd() - 0.5) * 6), y: yy, vx: (rnd() - 0.5) * 140, vy: -40 + rnd() * 60, drag: 4, life: 240 + Math.round(rnd() * 180), colors: SPARK_FX, shape: i % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  setMotif(sword, ...forgeSwordKey({ size: L.size, look: 'cool' }));
  await step(sc, FORGE.cool);

  // ---- it spins 1.5 turns while it rises (pre-drawn turns: never a fractional scale); the ring goes
  // out down the ramp; a light streak runs down the blade once it faces us again
  let drawingKey = '';
  const show = (o: Parameters<typeof forgeSwordKey>[0]): void => {
    const [k, make] = forgeSwordKey(o);
    if (k === drawingKey) return;
    drawingKey = k;
    setMotif(sword, k, make);
  };
  const glintAt = (t: number): number | undefined => (t < 0 || t > 1 ? undefined : Math.round(t * 6) / 6);
  let top = L.top;
  const GLINT_SPAN = FORGE.spin * 0.45 + FORGE.hang;
  await run(sc, FORGE.spin, (t, el) => {
    const d = turnAt(E.outCubic(t) * Math.PI * 3 + Math.PI);
    const g = glintAt((el - FORGE.spin * 0.55) / GLINT_SPAN);
    show({ size: L.size, turn: d.turn, back: d.back, runesLit: true, glint: d.turn === 0 && !d.back ? g : undefined });
    top = L.top - Math.round(E.outQuad(t) * RISE_PX);
    sword.setPosition(L.x, top);
    ringFade = Math.min(3, Math.floor(t * 4));
    if (Math.floor(el / 34) % 2 === 0 && rnd() < 0.5)
      sparks.add({ x: L.x + Math.round((rnd() - 0.5) * 12), y: top + Math.round(L.h * (0.3 + rnd() * 0.5)), vy: 10 + rnd() * 20, life: 300, colors: RUNE_TRAIL, shape: 'px', fadeAt: 1 });
  });
  ringFade = 3;
  stopHalo();
  haloBack.destroy();
  haloFront.destroy();
  void ringLight.fadeOut(220);

  // ---- anticipation: it hangs a beat higher, a star on its point. v3 art in attack position rises to
  // its victory peak as the blade comes down (the peak lands on the stab, held through the hit-stop)
  const pose: Promise<void> = !u.retired && target.active ? bondPose(u) : Promise.resolve();
  const riseTop = top;
  await run(sc, FORGE.hang, (t, el) => {
    top = riseTop - Math.round(E.outQuad(t) * HANG_PX);
    sword.setPosition(L.x, top);
    show({ size: L.size, glint: glintAt((el + FORGE.spin * 0.45) / GLINT_SPAN) });
  });
  show({ size: L.size });
  sparks.add({ x: L.x, y: top + L.tipRow, life: 140, colors: [PAL.white, PAL.gold4], shape: 'plus', fadeAt: 1 });

  // ---- the plunge: inQuad, a one-frame trail of light lines over it
  const b = spriteBox(sc, target);
  const stabTop = Math.round(b.top + b.h * 0.5) - L.tipRow;
  const fromTop = top;
  const trail = new Raster(sc, L.x - geo.guardHw - 2, 0, geo.guardHw * 2 + 5, Math.max(8, stabTop + geo.guardRow + 4), swordDepth - 0.1);
  playV3('bladeFly', { volume: 0.85, pitch: 1.25, pan: panAt(L.x) });
  let last = fromTop;
  await run(sc, FORGE.plunge, (t) => {
    top = Math.round(lerp(fromTop, stabTop, E.inQuad(t)));
    sword.setPosition(L.x, top);
    // where the pommel and the guard's wing tips were a frame ago (behind the sword)
    trail.begin();
    if (top - last > 2)
      for (const [dx, row, cc] of [
        [0, 0, PAL.gold4],
        [-Math.round(geo.guardHw * 0.7), geo.guardRow, PAL.gold3],
        [Math.round(geo.guardHw * 0.7), geo.guardRow, PAL.gold2],
      ] as const)
        for (let y = last + row; y < top + row; y++) trail.px(L.x + dx, y, cc);
    trail.end();
    last = top;
  });
  trail.destroy();

  // ---- IMPACT (mark `bond`): the stab frame
  const alive = !u.retired && target.active;
  const tip: XY = { x: L.x, y: top + L.tipRow };
  playV3('bladeBond', { volume: 1, pan: panAt(L.x) });
  if (alive) {
    contactFlash(sc, target, { x: 0, y: 1 }, { frames: 3, coverage: 0.45, tint: PAL.gold4, at: tip });
    bg(rimFlash(sc, target, { ramp: STAB_RIM, hold: 2 }).then(() => (target.active && !u.retired ? rimClimb(sc, target, { ramp: [PAL.gold2, PAL.gold3, PAL.gold4], stepMs: 50, holdMs: 140, fadeMs: 150, from: 'head' }) : undefined)));
    if (st) {
      // the single number (EF-9) over the head beside the blade, toward the field's middle (the old
      // count's glyphs). It never covers the blade, not even in its two slam frames at 2×: its centre
      // stands NUMBER_CLEAR px off the blade's edge (half the slammed "+700" plus the ink and air)
      const { up, delta } = statDelta(st);
      const head = u.worldPoint('top');
      const side = u.player === 0 ? 1 : -1;
      if (delta > 0) bg(impactNumber(sc, L.x + side * (geo.bladeHw + NUMBER_CLEAR), Math.round(head.y) - 4, delta, { kind: up ? 'heal' : 'damage' }));
      void u.setStats(st.atk, st.def, true);
    }
  } else if (st) void u.setStats(st.atk, st.def, false);
  bg(floorBurst(sc, ip(u.home), DEPTH.TILE_FX + 3));
  void lightFlash(sc, L.x, tip.y, PAL.gold4, fs(48), 620, { floorY: u.home.y, ring: true, intensity: 1.2 });
  const ni = fxCount(26);
  for (let i = 0; i < ni; i++) {
    const a = (i / ni) * Math.PI * 2 + rnd() * 0.4;
    const v = 60 + rnd() * 110;
    sparks.add({ x: tip.x, y: tip.y - 4, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 40, ay: 260, drag: 1.5, life: 300 + Math.round(rnd() * 300), colors: SPARK_FX, shape: i % 3 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  await freeze(sc, FORGE.stop);

  // ---- the blade sinks into the body (cut at the stab line) and turns to light in a stepped column
  const cutRow = tip.y;
  const sinkPx = SINK_PX[L.size];
  const column = new Raster(sc, L.x - 4, Math.round(b.top) - 30, 9, Math.max(8, Math.round(u.home.y - b.top) + 28), target.depth + 0.6);
  bg(lightBeam(sc, { x: L.x, y: b.top - 30 }, { x: L.x, y: u.home.y - 2 }, PAL.gold4, 260, { width: 12, depth: target.depth - 0.5, intensity: 0.8 }).done);
  await run(sc, FORGE.sink, (t) => {
    top = stabTop + Math.round(t * sinkPx);
    const look = sinkLook(t);
    if (look) {
      show({ size: L.size, look });
      sword.setPosition(L.x, top).setCrop(0, 0, geo.w, Math.max(0, Math.min(geo.h, cutRow - top + 1))).setVisible(true);
    } else sword.setVisible(false);
    // the column: 7 → 5 → 3 → 1 px, white core first, down the ramp
    const k = Math.min(3, Math.floor(t * 4));
    const hw = 3 - k;
    column.begin();
    for (let y = column.y; y < column.y + column.h; y++)
      for (let x = -hw; x <= hw; x++) column.px(L.x + x, y, Math.abs(x) === hw && hw > 0 ? PAL.gold2 : k === 0 && Math.abs(x) <= 1 ? PAL.white : k <= 1 ? PAL.gold4 : PAL.gold3);
    column.end();
  });
  column.destroy();
  sword.destroy();
  sparks.release();

  // ---- the persistent aura takes over: the small sword at the back, the waist ring closing
  if (u.retired || !target.active) return;
  u.setAura('equip', equipAuraV3(sc, u, { bond: true }));
  await Promise.all([pose, wait(sc, FORGE.settle)]);
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
