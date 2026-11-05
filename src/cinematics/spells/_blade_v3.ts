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
//            round in three steps, then runs as a continuous line whose lit dashes creep over dim joints,
//            twelve 1 × 3 rune marks riding it (fix round 2: it read thin at phone size); a gold pool
//            lies under the monster — bladeFly
//   +270     the runes orbit a beat, then converge into a vertical spine over the ring
//   +383     the SWORD draws itself top → bottom white-hot in four steps (_blade_sword.ts: 'big' 33×96
//            over a medium+ monster with head room, 'mid' 17×49 otherwise — the old forge's own size
//            choice, never smaller than its 30×92 / 15×46), cools through gold4 to its planes, the
//            runes in its fuller glowing — bladeForge, mark `forge`
//   +483     it SPINS 1.5 turns while it rises 8 px — pre-drawn turn drawings, no fractional scale; a
//            light streak runs down the blade (fix round 1, A5A-C1-06: spin 150 + hang 50 ≤ 200 ms)
//   +633     it HANGS (5 px higher, a beat), a star on its point; the ring steps down the gold ramp
//            through the hang and the plunge (gone at the stab, as the old ring faded)
//   +683     it PLUNGES (inQuad, a one-frame trail of light lines over it) — bladeFly
//   ≈ +760   IMPACT (mark `bond`): its point in the body's middle; hit-stop 70 ms. The old forge flashed
//            the WHOLE body white then gold; v3 keeps EF-3 (the body lights only where struck) and
//            carries the flash with the effect (fix round 2): the blade itself goes WHITE-HOT through
//            the hit-stop, gold4 for two frames after; a crisp star bursts round the blade's entry
//            just behind the body; the struck part flashes white with a gold band (contact flash, the
//            heavy 3 frames, 45 %) and the body's 1-px edge lights white, then gold runs down it from
//            the stab (≈ the old 520 ms glow); the single "+700" (EF-9) beside the sword, off the
//            guard's edge where its slam would reach the guard (numberSpot), the badge rolls; the floor
//            rings (≥ the old 62 px) and 26 gold sparks; v3 art in attack position plays `victory` to
//            its peak and back (no new frames) — bladeBond (duck 0.45)
//   +stab    the blade SINKS 20 / 10 px into the body (cut at the stab line), its planes, then down the
//            gold ramp to light, in a stepped column of light that never stands above the sword's top
//            row (fix round 2: on a tall body it stood over the pommel like a pole); the persistent aura
//            (auras-v3 equipAuraV3 { bond }) is made at the stab and shows itself once the sink is done
//            (revealIn): the small sword at the monster's back with one frame of a white rim, the waist
//            ring closing round it. None of this is waited for (fix round 1, A5A-C1-06):
//   stab+130 the input comes back (FORGE.tail; measured at 1×: spBlade / Def / P2 / Ace 1450 ms, the set
//            card 1383 ms — were 1.72–1.85 s)
// BREAK (bladeBreakBeat: the blade's loss reaches the monster — fix round 1, A5A-C1-03: as soon as the
// equip card's tile cracks under the tendril (auras-v3 EQUIP_HOOKS.onCardCrack, the aura sees its tile
// jolt), the −700 on the crack frame and the card's flight in parallel; flow/stats.ts's v3 statChange then
// only settles the badge (bladeBrokeEarly) — else from the statChange or this file's 'destroyed' hook;
// fix round 2: the old break turned the whole holder gold for ~300 ms, v3 answers with the big blade
// itself, never a tint), +ms from the beat:
//   +0       the forged blade the forge sank into the body TEARS OUT of it white-hot (cut at the body's
//            middle: it slides out of the wound, sparks spraying off it) and rises to the forge's hover
//            over the head (83 ms, white → gold4 → its planes) — bladeForge, lower ("shiing")
//   +83      it hangs three frames, trembling a whole pixel side to side, a star on its point
//   +133     CRACK (mark `break`): white crack lines across the blade and the guard, the aura's small
//            sword cracks too while its ring flares out to the bond's size (≥ 68 px) white then gold4;
//            the single "−700" beside the sword, the badge rolls back, the holder's 1-px edge white —
//            bladeBreak
//   +167     SHATTER: the blade bursts into its chips (3–8 px pieces of its own pixels, white on the
//            burst frame), they fly out along the cut, fall to the floor, bounce once, lie and fade by
//            palette steps; the aura bursts (its shards, the big ring snapped into 24 pieces, star
//            sparks); the gold drains down the holder's edge from the head
// The card leaves its tile with cardLeaves.
// Nothing here adds a camera move, a full-screen flash, a dim, or a whole-sprite tint.

import type Phaser from 'phaser';
import type { GameEvent, PlayerId } from '../../engine/types';
import { PAL } from '../../art/palette';
import { FLAT_H, FLAT_W, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, poseAxes, restQuat } from '../../art/cards';
import { hasMonsterArtV3 } from '../../art/monsters';
import { warmMonsterSheet } from '../../art/textures';
import { unitSheetKey } from '../../duel/unit-variant';
import { crackPath } from '../../art/spellmotifs-v3';
import { DEPTH, type XY, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { wait } from '../../vfx/core';
import { E, Raster, freeze, lerp, onFrame, qbez, run, spriteBox } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { BREAK_CRACK_FRAMES, EQUIP_HOOKS, equipAuraV3, ringPixels } from '../../duel/auras-v3';
import { fx, type CinematicContext } from '../api';
import { fxCount, fxRng, motifImage, numberUnderBar, rimClimb, rimFlash, setMotif, silhouetteOf } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { impactNumber } from '../_v3/number';
import { cardLeaves } from '../_v3/card';
import { REDUCED_MOTION } from '../../view/v3/motion';
import { type ForgeLook, type ForgeSize, forgeSizeFor, forgeSwordChunks, forgeSwordGeom, forgeSwordKey, turnAt } from './_blade_sword';
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
  /** fix round 1 (C1-06): the blade's spin and hang over the target together ≤ 200 ms (were 210 + 60) */
  spin: 150,
  hang: 50,
  plunge: 70,
  /** the hit-stop of the stab (EF-5: a spell 60–100 ms) */
  stop: 70,
  sink: 230,
  /** after the sink: the aura's bond ring closes before the input comes back (not waited for: C1-06) */
  settle: 100,
  /**
   * fix round 1 (C1-06): the input comes back this long after the stab (its hit-stop included); the sink,
   * the column of light, the aura's bond and a v3 body's victory pose play on by themselves
   */
  tail: 130,
} as const;
export const DRAW_STEPS = 4;
const RISE_PX = 8;
const HANG_PX = 5;
/** How far the blade sinks into the body after the stab (the old 10·SS). */
const SINK_PX: Readonly<Record<ForgeSize, number>> = { big: 20, mid: 10 };
/**
 * The impact number's centre, in px off the sword's edge: "+700" is 31 px of glyphs (+1 px ink a
 * side) and slams at 2× for its first two frames (_v3/number.ts), so 32–34 px reach each way from
 * its centre then; 36 keeps even the slam clear of the sword's ink (~17 px of air once it settles).
 * The edge is the guard's when the slam's rows reach the guard's (numberSpot), else the blade's.
 */
const NUMBER_CLEAR = 36;
/** P2's break number stands this many px higher than the head so its slam clears the deck / graveyard tiles. */
const BREAK_LIFT_P2 = 40;
/**
 * The slammed number's ink is not centred on its x: every glyph cell carries its outline / shadow on the
 * right (_v3/number.ts), so the 2× slam reaches 31 px left of x but 33 px right (measured in game,
 * fix round 2). A number LEFT of the sword (P2) stands this much further off, so both sides keep the
 * same 3 px of air from the guard's ink at the slam.
 */
const NUMBER_SHADOW = 2;
/** Half the slammed number's height (2× glyphs: 28 px) — the rows it may touch. */
const SLAM_HALF_H = 14;
/** The forge ring's fade: one step down the ramp every this many ms from the hang (gone at the stab). */
const RING_FADE_STEP = 66;
/** Rune marks round the forge ring (the old ring's 12 lit dots, as 1 × 3 marks through the one ring). */
const RING_RUNES = 12;
/** One rendered frame at 1× (the hit-stop runs on real time: the show clock's freeze counts real ms). */
const FRAME_MS = 1000 / 60;
/**
 * The break (fix round 2, the user's rule: the break is never duller than the old whole-wolf gold
 * flash): the forged blade tears out of the body (`eject` ms, white-hot → gold4 → its planes), hangs
 * `hangFrames` rendered frames, cracks for BREAK_CRACK_FRAMES with the aura's sword, then shatters.
 */
export const BREAK = { eject: 83, hangFrames: 3 } as const;
/** The broken blade's pieces: gravity (px/s²), rest on the floor before fading, one fade step, air cap. */
const SHARD_G = 900;
/** How much a piece's offset across the blade counts against its offset along it (the burst's spread). */
const SHARD_SPREAD = 4;
const SHARD_REST = 150;
const SHARD_STEP = 60;
const SHARD_AIR_CAP = 1400;
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

/**
 * The struck body lit as a SEE-THROUGH 2×2 checker (fix round 3, the user's rule "a signature effect is never
 * dimmer than the old one": the old forge held the whole monster white then gold ~520 ms; EF-3 forbids the
 * wash, so the body lights as a checker of 2×2 blocks over ≤ `cap` of its opaque pixels, the phase swapping
 * every frame so the whole body reads lit over the beat). One colour per frame (`ramp`: white → down the gold
 * ramp), palette colours, whole pixels, no alpha, no tint; the body's own pixels show between the blocks.
 * Blocks with the fewest body pixels (the edge) drop first, so the lit part stays solid blocks.
 */
function bodyChecker(scene: Phaser.Scene, s: Phaser.GameObjects.Sprite, ramp: readonly number[], cap = 0.44, halo = true): Promise<void> {
  let ras: Raster | null = null;
  let k = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt <= 0) return true;
      const sil = k < ramp.length && s.active ? silhouetteOf(s) : null;
      if (!sil) {
        ras?.destroy();
        resolve();
        return false;
      }
      const W = sil.right - sil.left + 4;
      const H = sil.bottom - sil.top + 4;
      if (!ras || ras.w < W || ras.h < H) {
        ras?.destroy();
        ras = new Raster(scene, sil.left - 5, sil.top - 5, W + 14, H + 14, s.depth + 0.5);
      }
      ras.moveTo(sil.left - 5, sil.top - 5);
      const blocks = new Map<number, { bx: number; by: number; n: number }>();
      let total = 0;
      for (let y = sil.top; y < sil.bottom; y++)
        for (let x = sil.left; x < sil.right; x++) {
          if (!sil.has(x, y)) continue;
          total++;
          const bx = Math.floor(x / 2);
          const by = Math.floor(y / 2);
          if (((bx + by) & 1) !== (k & 1)) continue;
          const id = by * 4096 + bx;
          const b = blocks.get(id);
          if (b) b.n++;
          else blocks.set(id, { bx, by, n: 1 });
        }
      const list = [...blocks.values()].sort((a, b) => a.n - b.n || ((a.bx * 7 + a.by * 13) % 5) - ((b.bx * 7 + b.by * 13) % 5));
      let lit = list.reduce((a, b) => a + b.n, 0);
      let drop = 0;
      while (lit > total * cap && drop < list.length) lit -= list[drop++].n;
      ras.begin();
      for (let i = drop; i < list.length; i++) {
        const b = list[i];
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const x = b.bx * 2 + dx;
            const y = b.by * 2 + dy;
            if (sil.has(x, y)) ras.px(x, y, ramp[k]);
          }
      }
      // the glow spilling past the body: a band four pixels deep outside its edge, 7 of 8 pixels lit, the
      // dark one moving every frame (the body itself stays within `cap`)
      if (halo)
        for (let y = sil.top - 4; y < sil.bottom + 4; y++)
          for (let x = sil.left - 4; x < sil.right + 4; x++) {
            if (((x + y * 2 + k * 3) & 7) === 0 || sil.has(x, y)) continue;
            let near = false;
            for (let d = 1; d <= 4 && !near; d++) near = sil.has(x - d, y) || sil.has(x + d, y) || sil.has(x, y - d) || sil.has(x, y + d);
            if (near) ras.px(x, y, ramp[k] === PAL.white ? PAL.gold4 : ramp[k]); // (the white stays on the body: EF-4)
          }
      ras.end();
      k++;
      return true;
    });
  });
}

/** The stab's body light after the hit-stop: white, then down the gold ramp (the old white → gold glow). */
const STAB_CHECKER = [
  ...Array<number>(10).fill(PAL.white),
  ...Array<number>(32).fill(PAL.gold4),
  ...Array<number>(4).fill(PAL.gold3),
  ...Array<number>(3).fill(PAL.gold2),
] as const;

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

/**
 * Call `fn(k)` on this frame (k = 0) and on each of the next rendered frames of REAL time (they tick
 * through a hit-stop too) until it returns false or the scene shuts down.
 */
function eachTick(scene: Phaser.Scene, fn: (k: number) => boolean): void {
  let k = 0;
  const end = (): void => {
    scene.events.off('postupdate', tick);
    scene.events.off('shutdown', end);
  };
  const tick = (): void => {
    if (!fn(++k)) end();
  };
  if (!fn(0)) return;
  scene.events.on('postupdate', tick);
  scene.events.once('shutdown', end);
}

/**
 * Where the single number stands beside the sword (pure; tested): over the head (`headY` − 4), toward
 * the field's middle (`side`), its centre NUMBER_CLEAR px off the sword's edge at the number's rows —
 * the guard's when the slam's rows (± SLAM_HALF_H) reach the guard's band (its wing tips lift 3 rows;
 * `travel`: the rows the sword still sinks), else the blade's — NUMBER_SHADOW further on the left side
 * (its ink reaches further right), kept on screen.
 */
export function numberSpot(o: { x: number; swordTop: number; headY: number; side: 1 | -1; travel?: number; lift?: number; geo: { guardRow: number; guardH: number; guardHw: number; bladeHw: number } }): XY {
  const y = Math.round(o.headY) - 4 - (o.lift ?? 0);
  const g0 = o.swordTop + o.geo.guardRow - 3;
  const g1 = o.swordTop + o.geo.guardRow + o.geo.guardH + 1 + (o.travel ?? 0);
  const onGuard = y + SLAM_HALF_H >= g0 && y - SLAM_HALF_H <= g1;
  const x = o.x + o.side * ((onGuard ? o.geo.guardHw : o.geo.bladeHw) + NUMBER_CLEAR + (o.side < 0 ? NUMBER_SHADOW : 0));
  return { x: Math.max(36, Math.min(604, Math.round(x))), y };
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
    warmMonsterSheet(unitSheetKey(u), ['victory']);
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
 * head while it draws), then a CONTINUOUS line whose lit dashes creep by `creep` over dim gold1 joints
 * (fix round 2: the old dashed ring with gaps read thin at phone size), with RING_RUNES rune marks
 * (1 × 3 through the line, the old ring's 12 lit dots) creeping with it; `fade` steps it all down the
 * ramp (0 bright … 3 gone). The back arc (above the centre) behind the body, a tone darker; the front
 * arc in front.
 */
function drawHalo(back: Raster, front: Raster, L: ForgeLayout, shown: number, creep: number, fade: number): void {
  back.begin();
  front.begin();
  if (fade < 3) {
    const pts = ringPixels(L.x, L.ringY, L.rx, L.ry, Math.PI / 2);
    const n = Math.ceil((pts.length * Math.min(3, shown)) / 3);
    const tone = (lv: number, behind: boolean): number => G[Math.max(1, Math.min(4, lv - fade - (behind ? 1 : 0)))];
    for (let i = 0; i < n; i++) {
      const q = pts[i];
      const behind = q.y < L.ringY;
      const d = (i + creep) % 6;
      const c = shown < 3 ? (i === n - 1 ? PAL.white : tone(4, false)) : tone(d === 0 ? 4 : d <= 3 ? 3 : 1, behind);
      (behind ? back : front).px(q.x, q.y, c);
    }
    if (shown >= 3)
      for (let r = 0; r < RING_RUNES; r++) {
        const q = pts[(Math.floor((r * pts.length) / RING_RUNES) + creep) % pts.length];
        const behind = q.y < L.ringY;
        const ras = behind ? back : front;
        ras.px(q.x, q.y - 1, tone(4, behind));
        ras.px(q.x, q.y, fade === 0 && !behind ? PAL.white : tone(4, behind));
        ras.px(q.x, q.y + 1, tone(2, behind));
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

/**
 * The sink's look by its progress (the old alpha 1 → 0.6 → 0.25 as palette steps), null = gone. Its
 * first SINK_COOL_FRAMES frames are gold4 ('cool': the stab's white-hot flash cooling, bladeEquipV3).
 */
export function sinkLook(t: number): ForgeLook | null {
  return t < 0.45 ? 'full' : t < 0.7 ? 'ember' : t < 0.9 ? 'ghost' : null;
}
/** Frames of gold4 after the white-hot stab (the old white → gold silhouette's two gold frames). */
export const SINK_COOL_FRAMES = 2;

/**
 * The stab's star where the blade enters the body (fix round 2, the rule-compliant answer to the old
 * whole-body white flash — EF-3 lets the body itself light only where it is struck): a crisp 4-point
 * star drawn just BEHIND the body (it blooms round the struck edge, A2 motion review r2 #9), its long
 * arms along the shoulders, short ones up and down, diagonal sparks on its first frames, stepping out
 * through the hit-stop and back down the gold ramp — STAR_STEPS real frames, whole pixels, no alpha.
 */
const STAR_STEPS: readonly { r: number; t: number }[] = [
  { r: 0.7, t: 0 },
  { r: 1.1, t: 0 },
  { r: 1.4, t: 0 },
  { r: 1.6, t: 1 },
  { r: 1.6, t: 2 },
  { r: 1.3, t: 3 },
  { r: 0.9, t: 4 },
];
function entryStar(scene: Phaser.Scene, at: XY, size: ForgeSize, depth: number): void {
  const R = size === 'big' ? 15 : 10;
  const ras = Raster.around(scene, at.x, at.y, Math.ceil(R * 1.6) * 2 + 6, Math.ceil(R * 1.6) + 8, depth);
  // tones along an arm (inner → tip) per step down the ramp
  const ARM: readonly (readonly (number | null)[])[] = [
    [PAL.white, PAL.gold4, PAL.gold3],
    [PAL.white, PAL.gold4, PAL.gold3],
    [PAL.gold4, PAL.gold3, PAL.gold2],
    [PAL.gold3, PAL.gold2, PAL.gold1],
    [PAL.gold2, PAL.gold1, null],
  ];
  const arm = (dx: number, dy: number, len: number, t: number, thick: boolean): void => {
    for (let i = 1; i <= len; i++) {
      const c = ARM[t][Math.min(2, Math.floor((i * 3) / (len + 1)))];
      if (c === null) continue;
      const x = at.x + dx * i;
      const y = at.y + dy * i;
      ras.px(x, y, c);
      // the inner half of the long arms is 3 px thick (a pixel star's waist)
      if (thick && i <= len / 2) {
        ras.px(x - dy, y - dx, c);
        ras.px(x + dy, y + dx, c);
      }
    }
  };
  eachTick(scene, (k) => {
    const s = STAR_STEPS[k];
    if (!s || !ras.alive) {
      ras.destroy();
      return false;
    }
    ras.begin();
    const L = Math.round(R * s.r);
    arm(1, 0, L, s.t, s.t <= 1);
    arm(-1, 0, L, s.t, s.t <= 1);
    arm(0, -1, Math.round(L * 0.55), s.t, false);
    arm(0, 1, Math.round(L * 0.45), s.t, false);
    if (s.t <= 1) for (const [dx, dy] of [[1, -1], [-1, -1], [1, 1], [-1, 1]] as const) arm(dx, dy, Math.round(L * 0.3), s.t + 1, false);
    if (s.t <= 2) ras.px(at.x, at.y, PAL.white);
    ras.end();
    return true;
  });
}

/** The tone `k` steps down its ramp (white → gold, the crimson grip), null when it has gone out; ink holds. */
const SHARD_RAMPS: readonly (readonly number[])[] = [
  [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1, PAL.gold0],
  [PAL.crim4, PAL.crim3, PAL.crim2, PAL.crim1, PAL.crim0],
];
export function shardTone(c: number, k: number): number | null {
  if (k <= 0) return c;
  if (k >= 4) return null;
  for (const r of SHARD_RAMPS) {
    const i = r.indexOf(c);
    if (i >= 0) return r[Math.min(r.length - 1, i + k)];
  }
  return c;
}

/**
 * The forged blade shatters (the break, fix round 2): its pieces (forgeSwordChunks: the cracked drawing
 * cut into 3–8 px chips that tile it) burst from where it hangs — all white on the burst frame, their
 * own tones after — thrown up and out from the blade's line, fall to `floor`, bounce once and lie
 * there, then step down their ramps (shardTone) and blink out: whole pixels, never rotated (EF-7), no
 * alpha. `at`: the drawing's top-left (world). Resolves when the last piece is gone.
 */
function bladeShatter(scene: Phaser.Scene, size: ForgeSize, at: XY, o: { cx: number; floor: number; depth: number; seed: number }): Promise<void> {
  const chunks = forgeSwordChunks(size, o.seed, REDUCED_MOTION ? 3 : 0);
  const geo = forgeSwordGeom(size);
  const rnd = fxRng(o.seed * 11 + 5);
  const big = size === 'big';
  // a burst from the crack's middle: the pieces fly out along the cut (sideways first — the blade is
  // narrow, so its across-offset counts SHARD_SPREAD times), a little up, and drop fast
  const midY = geo.h * 0.45;
  const parts = chunks.map((ch, i) => {
    let dx = (at.x + ch.cx - o.cx) * SHARD_SPREAD;
    if (Math.abs(dx) < 2) dx = (i % 2 === 0 ? -1 : 1) * (2 + rnd() * 4);
    const a = Math.atan2(ch.cy - midY, dx) + (rnd() - 0.5) * 0.6;
    const v = (big ? 80 : 62) + rnd() * (big ? 90 : 60);
    return { ch, x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - (40 + rnd() * 40), floor: o.floor - (i % 4), bounced: false, restAt: -1 };
  });
  const SPAN = big ? 120 : 80;
  const y0 = Math.min(at.y - 30, o.floor - geo.h - 30);
  const ras = new Raster(scene, at.x - SPAN, y0, geo.w + SPAN * 2, o.floor - y0 + 6, o.depth);
  let el = 0;
  let frame = -1;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      frame++;
      el += dt;
      const s = Math.min(0.05, dt / 1000);
      ras.begin();
      let live = false;
      for (const p of parts) {
        if (frame > 0 && p.restAt < 0) {
          p.vy += SHARD_G * s;
          p.x += p.vx * s;
          p.y += p.vy * s;
          if (at.y + p.ch.bottom + p.y >= p.floor && p.vy > 0) {
            p.y = p.floor - at.y - p.ch.bottom;
            if (!p.bounced) {
              p.bounced = true;
              p.vy = -p.vy * 0.28;
              p.vx *= 0.55;
            } else p.restAt = el;
          } else if (el >= SHARD_AIR_CAP) p.restAt = el;
        }
        const k = p.restAt < 0 ? 0 : Math.floor(Math.max(0, el - p.restAt - SHARD_REST) / SHARD_STEP) + (el - p.restAt >= SHARD_REST ? 1 : 0);
        if (k >= 4) continue;
        live = true;
        // the last step blinks (stepped, never an alpha ramp)
        if (k === 3 && Math.floor(el / 50) % 2 === 1) continue;
        const ox = Math.round(p.x);
        const oy = Math.round(p.y);
        for (const q of p.ch.px) {
          const c = frame === 0 ? PAL.white : shardTone(q.c, k);
          if (c !== null) ras.px(at.x + q.x + ox, at.y + q.y + oy, c);
        }
      }
      ras.end();
      if (!live || !ras.alive) {
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
  // the ring stays bright through the spin and steps down the ramp from the hang (gone at the stab: the
  // old ring faded over the hang and the plunge — fix round 2)
  let haloEl = 0;
  let ringFadeAt = -1;
  const haloGone = (): void => {
    haloBack.destroy();
    haloFront.destroy();
  };
  const stopHalo = onFrame(sc, (dt, el) => {
    haloEl = el;
    if (el >= FORGE.ringAt) ringShown = Math.min(3, Math.floor((el - FORGE.ringAt) / FORGE.ringStep) + 1, ringShown + 1);
    if (dt > 0 && ringShown >= 3) creep++;
    if (ringFadeAt >= 0) ringFade = Math.min(3, Math.floor((el - ringFadeAt) / RING_FADE_STEP) + 1, ringFade + 1);
    drawHalo(haloBack, haloFront, L, ringShown, creep, ringFade);
    if (ringFade < 3) return true;
    haloGone();
    return false;
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
    if (Math.floor(el / 34) % 2 === 0 && rnd() < 0.5)
      sparks.add({ x: L.x + Math.round((rnd() - 0.5) * 12), y: top + Math.round(L.h * (0.3 + rnd() * 0.5)), vy: 10 + rnd() * 20, life: 300, colors: RUNE_TRAIL, shape: 'px', fadeAt: 1 });
  });
  ringFadeAt = haloEl;
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

  // ---- IMPACT (mark `bond`): the stab frame. The old forge flashed the WHOLE body white, then gold;
  // v3 lights the body only where it is struck (EF-3) and carries the flash with the effect itself
  // (fix round 2): the blade discharges WHITE-HOT through the hit-stop (gold4 for the two frames after:
  // the old white → gold), a star bursts round the blade's entry behind the body, the struck part
  // flashes (contact flash, the heavy 45 %), the body's 1-px edge lights white, then gold runs down it
  const alive = !u.retired && target.active;
  const tip: XY = { x: L.x, y: top + L.tipRow };
  playV3('bladeBond', { volume: 1, pan: panAt(L.x) });
  show({ size: L.size, look: 'hot' });
  if (alive) {
    // the body's checker flash (below) replaces the contact flash's localized band: it covers the whole body
    bg(bodyChecker(sc, target, STAB_CHECKER, 0.45));
    const entry = silhouetteOf(target)?.topAt(L.x) ?? Math.round(b.top);
    entryStar(sc, { x: L.x, y: entry - 3 }, L.size, target.depth - 0.4);
    bg(rimFlash(sc, target, { ramp: STAB_RIM, hold: 2 }).then(() => (target.active && !u.retired ? rimClimb(sc, target, { ramp: [PAL.gold2, PAL.gold3, PAL.gold4], stepMs: 50, holdMs: 240, fadeMs: 180, from: 'head' }) : undefined)));
    if (st) {
      // the single number (EF-9) over the head beside the sword, toward the field's middle (the old
      // count's glyphs). It never covers the sword, not even in its two slam frames at 2× (numberSpot:
      // off the guard's edge where the slam reaches the guard's rows, else off the blade's)
      const { up, delta } = statDelta(st);
      const n = numberSpot({ x: L.x, swordTop: top, headY: u.worldPoint('top').y, side: u.player === 0 ? 1 : -1, travel: SINK_PX[L.size], geo });
      // (never up into the phase bar: P2's back-row Kristal Ejder's head is near the screen's top — fix round 2)
      const nb = numberUnderBar(n.y);
      if (delta > 0) bg(impactNumber(sc, n.x, nb.y, delta, { kind: up ? 'heal' : 'damage', rise: nb.rise }));
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

  // ---- the persistent aura exists from the stab on (the field's state has it: a sync, a break or an attack
  // right after the input comes back all find it) but shows nothing until the blade has sunk (revealIn)
  if (!u.retired && target.active) u.setAura('equip', equipAuraV3(sc, u, { bond: true, revealIn: FORGE.sink, cardUid: ev.spellUid }));
  // ---- the blade sinks into the body (cut at the stab line) and turns to light in a stepped column:
  // gold4 for SINK_COOL_FRAMES (the white-hot flash cooling), its planes, then down the ramp to light.
  // Fix round 1 (C1-06): it plays on by itself — the input comes back FORGE.tail after the stab
  const cutRow = tip.y;
  const sinkPx = SINK_PX[L.size];
  const column = new Raster(sc, L.x - 4, Math.round(b.top) - 30, 9, Math.max(8, Math.round(u.home.y - b.top) + 28), target.depth + 0.6);
  bg(lightBeam(sc, { x: L.x, y: b.top - 30 }, { x: L.x, y: u.home.y - 2 }, PAL.gold4, 260, { width: 12, depth: target.depth - 0.5, intensity: 0.8 }).done);
  let sunk = 0;
  const sinking = run(sc, FORGE.sink, (t, _el, dt) => {
    if (dt > 0) sunk++;
    top = stabTop + Math.round(t * sinkPx);
    const look = sunk < SINK_COOL_FRAMES ? 'cool' : sinkLook(t);
    if (look) {
      show({ size: L.size, look });
      sword.setPosition(L.x, top).setCrop(0, 0, geo.w, Math.max(0, Math.min(geo.h, cutRow - top + 1))).setVisible(true);
    } else sword.setVisible(false);
    // the column: 7 → 5 → 3 → 1 px, white core first, down the ramp — never above the sword's top row
    // (behind the sword, it is the blade's light running down into the floor; fix round 2: on a tall
    // body it stood 20–35 px over the pommel like a pole)
    const k = Math.min(3, Math.floor(t * 4));
    const hw = 3 - k;
    column.begin();
    for (let y = Math.max(column.y, top); y < column.y + column.h; y++)
      for (let x = -hw; x <= hw; x++) column.px(L.x + x, y, Math.abs(x) === hw && hw > 0 ? PAL.gold2 : k === 0 && Math.abs(x) <= 1 ? PAL.white : k <= 1 ? PAL.gold4 : PAL.gold3);
    column.end();
  }).then(() => {
    column.destroy();
    sword.destroy();
    sparks.release();
    stopHalo();
    haloGone();
  });
  bg(sinking);
  bg(pose);
  await wait(sc, Math.max(0, FORGE.tail - FORGE.stop));
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
 * The break beat (see the header; fix round 2 — the old break turned the whole holder gold for ~300 ms:
 * v3 answers with the big forged blade itself, never a tint): the blade the forge sank into the body
 * TEARS OUT of it white-hot (the forge's draw "shiing", lower; cut at the body's middle so it slides out
 * of the wound, sparks spraying off it) and rises to the forge's hover over the head (BREAK.eject),
 * hangs, then CRACKS white together with the aura's small sword (mark `break`: `bladeBreak`, the single
 * "−700" beside it, the badge rolls back, the body's 1-px edge white) and SHATTERS — its pieces burst
 * white, fall to the floor and fade (bladeShatter), with the aura's own burst and star sparks; the gold
 * then drains down the body's edge. Resolves on the shatter's frame (the rest goes on by itself).
 */
export async function bladeBreakBeat(ctx: AnyCtx, e: StatEv, u: MonsterUnit): Promise<void> {
  return breakBeat(ctx.scene, e, u);
}

/** The holders whose blade is breaking right now (one break per blade: the card's crack or the statChange). */
const breaking = new WeakSet<MonsterUnit>();
/** The holders whose blade broke on its card's crack, with the stats the beat rolled to (C1-03). */
const brokeOnCrack = new WeakMap<MonsterUnit, { atk: number; def: number }>();
/** Ejder Kılıcı's bonus (cards.ts 'equipAtk700'; engine/query.ts): what the break takes back. */
export const BLADE_BONUS = 700;

/**
 * Fix round 1 (C1-03): the blade's card cracks on its tile (the aura saw its first frame, auras-v3
 * EQUIP_HOOKS) while its holder still stands — the break beat starts NOW, the "−700" on its crack frame,
 * while the card's own flight runs in parallel; the holder's statChange (played after the card's flight
 * by the destroying effect) then only settles the badge (bladeBrokeEarly).
 */
EQUIP_HOOKS.onCardCrack = (scene: Phaser.Scene, u: MonsterUnit): void => {
  if (breaking.has(u) || u.retired || !u.sprite.active || !u.sprite.visible || !u.hasAura('equip')) return;
  const s = u.shownStats;
  const e: StatEv = { type: 'statChange', uid: u.uid, prevAtk: s.atk, prevDef: s.def, atk: Math.max(0, s.atk - BLADE_BONUS), def: s.def };
  brokeOnCrack.set(u, { atk: e.atk, def: e.def });
  void breakBeat(scene, e, u).catch((err) => console.error('[blade] early break', err));
};

/**
 * Whether this holder's blade already broke on its card's crack (C1-03) — then its statChange shows no
 * second number: the badge only settles on the event's values (no roll when the beat already rolled there).
 * Consumes the mark.
 */
export function bladeBrokeEarly(u: MonsterUnit): boolean {
  if (!brokeOnCrack.has(u)) return false;
  brokeOnCrack.delete(u);
  return true;
}

async function breakBeat(sc: Phaser.Scene, e: StatEv, u: MonsterUnit): Promise<void> {
  if (breaking.has(u)) return;
  breaking.add(u);
  const target = u.sprite;
  const L = forgeLayout(spriteBox(sc, target));
  const geo = forgeSwordGeom(L.size);
  const cut = L.stabTop + L.tipRow;
  const from = L.stabTop + SINK_PX[L.size];
  const rnd = fxRng(u.uid * 19 + 3);
  const sparks = new PxSparks(sc, DEPTH.FX + 3);
  // ---- the blade tears out of the body and rises over the head
  playV3('bladeForge', { volume: 0.75, pitch: 0.85, pan: panAt(L.x) });
  const sword = motifImage(sc, ...forgeSwordKey({ size: L.size, look: 'hot' }), L.x, from, DEPTH.FX + 2);
  const place = (y: number): void => void sword.setPosition(L.x, y).setCrop(0, 0, geo.w, Math.max(0, Math.min(geo.h, cut - y + 1)));
  place(from);
  let top = from;
  let f = 0;
  const perFrame = fxCount(2);
  await run(sc, BREAK.eject, (t, _el, dt) => {
    if (dt > 0) f++;
    top = Math.round(lerp(from, L.top, E.outCubic(t)));
    // white-hot for two rendered frames (the first tick is not drawn yet; one white frame was lost at 30 fps),
    // gold4 for the last one; its planes come back at the hang
    setMotif(sword, ...forgeSwordKey({ size: L.size, look: f < 3 ? 'hot' : 'cool' }));
    place(top);
    if (dt > 0 && cut - top > 2)
      for (let i = 0; i < perFrame; i++)
        sparks.add({ x: L.x + Math.round((rnd() - 0.5) * (geo.bladeHw * 2 + 2)), y: cut - 1, vx: (rnd() - 0.5) * 100, vy: -50 - rnd() * 90, ay: 320, life: 200 + Math.round(rnd() * 140), colors: SPARK_FX, shape: i === 0 ? 'plus' : 'px', fadeAt: 1 });
  });
  setMotif(sword, ...forgeSwordKey({ size: L.size }));
  place(top);
  // ---- it hangs a beat, a star on its point, trembling a whole pixel side to side (a local tremble, K1:
  // no screen shake) before it cracks
  sparks.add({ x: L.x, y: top + L.tipRow, life: 140, colors: [PAL.white, PAL.gold4], shape: 'plus', fadeAt: 1 });
  for (let h = 0; h < BREAK.hangFrames; h++) {
    if (!REDUCED_MOTION) sword.setX(L.x + (h % 2 === 0 ? 1 : -1));
    await frames(sc, 1);
  }
  sword.setX(L.x);
  // ---- the CRACK: both swords crack white for BREAK_CRACK_FRAMES (the aura's destroy draws its own crack
  // now and bursts with this one); the gold leaves the body: its 1-px edge white through the crack, down the
  // gold ramp as the blade bursts, then the gold drains down it from the head
  setMotif(sword, ...forgeSwordKey({ size: L.size, crack: true }));
  u.setAura('equip', null);
  bg(rimFlash(sc, target, { ramp: BREAK_RIM, hold: BREAK_CRACK_FRAMES }).then(() => (target.active && !u.retired ? rimClimb(sc, target, { ramp: [PAL.gold2, PAL.gold3, PAL.gold4], stepMs: 60, holdMs: 160, fadeMs: 180, from: 'head' }) : undefined)));
  await frames(sc, BREAK_CRACK_FRAMES);
  // ---- the SHATTER (mark `break`; fix round 2, A5A-C2-07: the sound and the single number come on the frame
  // the sword visibly bursts, not on its crack 2–4 frames before): the pieces burst white and fall; star
  // sparks leave the blade's middle; the burst's light on the floor; the badge rolls back
  playV3('bladeBreak', { volume: 0.9, pan: panAt(L.x) });
  const { up, delta } = statDelta(e);
  if (delta > 0) {
    // (fix round 3: P2's number beside the sword used to slam on its own deck pile; it stands one number's height
    // higher, above the pile's tile, still off the sword's edge)
    const n = numberSpot({ x: L.x, swordTop: top, headY: u.worldPoint('top').y, side: u.player === 0 ? 1 : -1, lift: u.player === 1 ? BREAK_LIFT_P2 : 0, geo });
    const nb = numberUnderBar(n.y);
    bg(impactNumber(sc, n.x, nb.y, delta, { kind: up ? 'heal' : 'damage', rise: nb.rise }));
  }
  void u.setStats(e.atk, e.def, true);
  void lightFlash(sc, L.x, top + L.tipRow, PAL.gold4, fs(40), 420, { floorY: u.home.y, intensity: 0.9 });
  sword.destroy();
  bg(bladeShatter(sc, L.size, { x: L.x - geo.cx, y: top }, { cx: L.x, floor: Math.round(u.home.y) + 2, depth: DEPTH.FX + 2, seed: u.uid }));
  const mid = top + Math.round(geo.h * 0.55);
  const ns = fxCount(14);
  for (let i = 0; i < ns; i++) {
    const a = (i / ns) * Math.PI * 2 + rnd() * 0.5;
    const v = 70 + rnd() * 90;
    sparks.add({ x: L.x, y: mid, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7 - 30, ay: 220, drag: 1.5, life: 240 + Math.round(rnd() * 200), colors: SPARK_FX, shape: i % 2 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  sparks.release();
  await frames(sc, 1);
  breaking.delete(u);
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
  if (u && !u.retired && (brokeOnCrack.has(u) || breaking.has(u))) {
    // its blade broke on the card's crack already (C1-03): its statChange only settles the badge
    const ci = ctx.findType('statChange', (e) => e.uid === holder, { until: (e) => e.type !== 'statChange' && e.type !== 'toGraveyard' && e.type !== 'destroy' });
    const se = evAt(ctx, ci, 'statChange');
    if (se && ci >= 0) {
      ctx.consumeAt(ci);
      brokeOnCrack.delete(u);
      // (the beat's roll is still running toward these values: a second set would restart it)
      const t = u.shownStats;
      if (t.atk !== se.atk || t.def !== se.def) jobs.push(u.setStats(se.atk, se.def, true));
    }
    broke = true;
  } else if (u && !u.retired && u.hasAura('equip')) {
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
