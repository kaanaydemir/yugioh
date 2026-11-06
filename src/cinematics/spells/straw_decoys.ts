// Saman Korkuluklar (straw_decoys, S9, QUICK spell, strawTokens) — v3 look only (?look=v3); the old look keeps the
// default activation (ctx.base()). Storyboard: docs/v3/YENI_KARTLAR.md §7 S9 — "Boş alanlara yukarıdan ahşap
// kazıklar saplanır (tok) → saman demetleri rüzgarla kazığa sarılır, eski bir ceket ve çuval kafa takılır, kollar
// yana açılır → korkulukların düğme gözleri bir kez yanar; uzaktan bir karga gaklar." (signature 2.6 s)
// Sound identity (§5.1 S9): the long straw rustle, straw + a wooden stake, the stake's "tok" in three pitches and the
// crow (src/audio/v3/e/straw_decoys.ts). No "pof" anywhere (R3 owns it).
//
// The decoys are BUILT here: the activation batch carries one `summon {from:'token'}` per decoy (first free zones);
// the scene consumes them, pins each token's card on its tile when the stake stabs it, builds the scarecrow on a
// whole-pixel raster on that zone and, at the end, the built scarecrow COMES ALIVE: a straw bristle climbs it from the
// foot up and, row by row, re-winds it into the field's own token unit (FieldView.addUnit → whatever sprite the token
// has — lane D's rig or the placeholder; its pose-0 pixels are read from the art, so the morph lands on exactly the
// pixels the unit then shows). The token's idle and its tokenVanish are not ours.
//
// Paths
//   hand / own set card (own Main Phase): the common v3 spell opening (spells/_kit spellOpening, keepCard,
//        releaseFrom 'top': the orb leaves the card's top edge for the dusk sky over the empty zones).
//   QUICK ANSWER (a set card in the opponent's attackDeclared / summoned window): the quick-spell reveal
//        (spells/_quick_e.ts: the turquoise zig-zag snap, "HIZLI BÜYÜ!"), then the orb leaves the standing card's
//        top for the sky and the card lies straight back down; the same signature plays; the spent card leaves.
//        Answering a DIRECT attack the attacker's controller then picks a decoy (a later batch): the `target` hook
//        plays the LURE — the picked scarecrow waves (roar pose), a straw tuft lashes out along a 2-px gold line and
//        HOOKS the attacker (it jerks its head round), the old direct-attack arc snaps away and a new one arcs onto
//        the decoy with its own lock-on (the kept AttackHold is re-kept with the new marks) — e_strawLure, e_strawHook.
//
// TIMELINE (scene ms; × 1.35 game time). Every mark after the stakes is computed from ONE origin W0 (the last stab)
// — nothing is chained behind the previous beat's promises.
//   opening  hand ≈ 230 + hold 150 / set ≈ 180 + hold 150 / quick reveal ≈ 360 — the common v3 opening (≤ 0.7 s)
//   R+0      RELEASE: the orb flies to the BURST point over the decoys' row (clamped under the HUD band, y ≥ 40)
//   S+0      BURST: a gold star in the dusk sky, e_strawGust (a low, wide dusk field wind swelling in); the orb splits
//            into one thin streak per empty zone
//   S+100 + i·110   STAKE i appears in the sky over its zone (its fall height fits the frame: ≤ 100 px, top ≥ 44 px)
//            and FALLS point-first (130 ms) — e_strawDrop
//   contact  STAB: "tok" (e_strawTok1/2/3, into earth), the stake SQUASHES (2 frames: 1 px shorter + 1 px wider, then
//            back), a white frame, a dirt ring on the floor (earth ramp), ink cracks, dirt chips, the token's card
//            pinned on the tile with a gold tile flash, a warm pool; the last stab: 2 px shake + a 40 ms hit-stop
//   W0 = the last stab (after its hit-stop)
//   W+20     THE WIND crosses the row (P1 left → right, P2 right → left: from the field's edge outward), straws streak
//            and curl into the stakes, e_strawWrap / e_strawWrapR travels with it; straw winds on each stake
//            (r·70 apart, 300 ms) — it overlaps the last stake's quiver (no dead air)
//   W+340 + r·80    THE COAT drops on, flaps, SNAPS — e_strawCoat
//   W+600 + r·80    THE SACK HEAD + HAT — e_strawHead
//   A = W + max(900, last head + 200)  ARMS SPREAD together (4 stepped angles) — e_strawArms; a dusk light sweeps the
//            row and each pair of straw hands flicks open (e_strawHand per decoy, 25 ms apart)
//   C0       THE CROW (hero beat): 30×18 px, light-rimmed, enters from the left edge and glides DOWN the row over the
//            scarecrows' hats; each scarecrow's 2×2 button eyes light as it passes (white core + gold4 cross → gold4 →
//            gold3 → gold2, 120 ms a stage, a face light) — e_strawEye per decoy; it flares and LANDS on the last
//            scarecrow's outer arm (the arm dips under it) — e_strawPerch; ≥ 150 ms after the last eye it CAWS twice,
//            beak wide, head up, bobbing after each call — e_strawCrow; the straw shivers at the caw
//   H = caw + 520   COMES ALIVE: the crow beats off the arm (startled) and away; the straw bristles up each scarecrow
//            from the foot (a gold4/gold3 edge, 6 frames) re-winding it into the token unit's own pixels; what the
//            token does not wear is shed as chips on the wind — e_strawWake; badges pop, pools fade
// EDGES — one decoy: the same beats, one stake (the crow lands on it); summoned in answer to a SUMMON: no lure.
// P2: everything mirrors with the zones; the scarecrows face left (their raster is flipped about the stake); the crow
// works in screen space (left → right down the row) for both players.
// No camera move (tools/measure.mjs --camera-gate), every crisp thing on whole pixels, palette only, seeded rng.

import type Phaser from 'phaser';
import type { CardId, MonsterId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { monsterFrame, relightsP2 } from '../../art/textures';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { LightHandle } from '../../view/light';
import { shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, attackArrow, lockOn, stopTime } from '../../vfx/combat';
import { E, Raster, floorRing, onFrame, run, seg } from '../../vfx/setpieces';
import { cardLeaves } from '../_v3/card';
import { panAt, play as playV3, quietCombat } from '../_v3/sound';
import { fxRng } from '../_v3/spellfx';
import { isHold, type AttackHold } from '../battle/_kit';
import { registerCardHook, type CinematicContext } from '../api';
import { GOLD_FX, bg, energyStreak, lightFlash, lightPool, relax, spellOpening, starFlare, type ActCtx } from './_kit';
import { quickReveal } from './_quick_e';
import type { SfxName } from '../../audio/sfx';
import type { MonsterUnit } from '../../duel/MonsterUnit';

type AnyCtx = CinematicContext<GameEvent>;
type SummonEv = Extract<GameEvent, { type: 'summon' }>;

const ID: CardId = 'straw_decoys';
const TOKEN: CardId = 'straw_decoy_token';
const R = Math.round;

// ================================================================ timings (scene ms)

export const STRAW_T = Object.freeze({
  release: 170,
  fan: 110,
  stake0: 100,
  stakeGap: 110,
  fall: 130,
  /** after the last stab (W0): the wind */
  wind: 20,
  wrapGap: 70,
  wrapMs: 300,
  coat: 340,
  coatGap: 80,
  coatDrop: 110,
  head: 600,
  headGap: 80,
  headDrop: 90,
  /** arms: at least this, and ≥ last head landed + armsAfterHead */
  arms: 900,
  armsAfterHead: 110,
  armStep: 45,
  /** the first eye lights no sooner than arms + eyesAfterArms */
  eyesAfterArms: 220,
  eyeStage: 120,
  /** the crow's glide (scaled by distance within these) */
  crowMin: 650,
  crowMax: 1000,
  flare: 130,
  /** the caw: ≥ landing + cawAfterLand and ≥ last eye + cawAfterEye */
  cawAfterLand: 150,
  cawAfterEye: 200,
  caw2: 360,
  /** handoff: caw + handoff */
  handoff: 460,
  morphFrame: 36,
});

// ================================================================ the scarecrow (local raster geometry)

/** Raster size and the floor point (the zone's centre) inside it. */
const RW = 64;
const RH = 150;
const FX = 32;
const FY = 140;
/** The stake's top above the floor when planted; the longest fall. */
const STAKE_TOP = 26;
const SKY = 100;
/** Nothing of the scene above this screen y (the HUD band). */
const SKY_MIN_Y = 44;

const TOK: readonly SfxName[] = ['e_strawTok1', 'e_strawTok2', 'e_strawTok3'];

interface Build {
  /** the stake: visible, its offset above the planted pose (≤ 0 = in the air), sink (px into the floor), wobble */
  stake: boolean;
  stakeY: number;
  sink: number;
  wob: number;
  /** the stab squash: 1 = 1 px wider for a frame */
  squash1: number;
  /** white silhouette frames (materialise / stab) */
  white: boolean;
  /** stab cracks on the tile (0 none, 1 fresh, 2 fading) */
  cracks: number;
  /** the falling streaks' length (px) */
  streak: number;
  /** straw wound on (0..1) */
  wrap: number;
  /** the coat: null = not yet, else its offset above (px); its hem flap (px) */
  coatY: number | null;
  flap: number;
  /** the sack head / the hat: null = not yet, else offset above (px); the head's squash (px) */
  headY: number | null;
  hatY: number | null;
  squash: number;
  /** the sleeves' angle step: 0 hanging … 3 over, 4 level */
  arm: number;
  /** the perched crow's weight on one sleeve: which local side (±1) and how far its tip dips (px) */
  dipDir: number;
  dip: number;
  /** the button eyes: 0 dark, 1 white core + gold4 cross, 2 gold4 + gold3 cross, 3 gold3, 4 gold2 */
  eyes: number;
  /** a shiver of the straw (the crow's caw, the lure): px */
  shiver: number;
}

function freshBuild(): Build {
  return { stake: false, stakeY: -SKY, sink: 0, wob: 0, squash1: 0, white: false, cracks: 0, streak: 0, wrap: 0, coatY: null, flap: 0, headY: null, hatY: null, squash: 0, arm: 0, dipDir: 1, dip: 0, eyes: 0, shiver: 0 };
}

/** Sleeve angles (radians, + = down) per arm step: hanging, 45°, 15°, 8° over the level, level (a hair of droop). */
const ARM_ANGLE = [1.25, 0.78, 0.26, -0.14, 0.06];
const ARM_L = 8;
/** The head's centre (local) and the eyes. */
const HEAD_CX = FX + 1;
const HEAD_CY = FY - 25;

/** Paint one scarecrow in its build state on the raster (local pixels; the raster is flipped for P2). */
function paintDecoy(r: Raster, b: Build, el: number): void {
  const p = r.pc;
  r.begin();
  const fr = Math.floor(el / 160) % 4;
  const sway = [0, 1, 0, -1][fr] + (b.shiver ? (Math.floor(el / 40) % 2 ? b.shiver : -b.shiver) : 0);
  const white = b.white;
  const C = (c: number) => (white ? PAL.white : c);
  // ---- the stake (behind everything else)
  if (b.stake) {
    const top = FY - STAKE_TOP + R(b.stakeY) + b.sink;
    const planted = b.stakeY >= 0;
    const bot = planted ? FY : FY + 3 + R(b.stakeY);
    const W = 3 + b.squash1;
    for (let y = top; y <= bot; y++) {
      // the upper half leans with the wobble
      const dx = y < top + 12 ? b.wob : 0;
      // the point: tapering in the last three rows while it flies
      const fromBot = bot - y;
      const w = !planted && fromBot < 3 ? fromBot + 1 : W;
      const x0 = FX - 1 + dx + (W - w > 1 ? 1 : 0) - (W > 3 && planted ? 0 : 0);
      for (let i = 0; i < w; i++) {
        const tone = y === top ? PAL.earth4 : i === 0 ? PAL.earth3 : i === w - 1 && w > 1 ? PAL.earth1 : PAL.earth2;
        p.set(x0 + i, y, C(tone));
      }
      // bark notches
      if ((y - top) % 7 === 4) p.set(x0 + 1, y, C(PAL.earth1));
    }
  }
  // ---- the straw bundle wound round the stake (from the ground up)
  if (b.wrap > 0) {
    const yBot = FY - 4;
    const yTop = FY - 21;
    const yEdge = Math.floor(yBot - (yBot - yTop + 1) * b.wrap);
    for (let y = yBot; y > yEdge && y >= yTop; y--) {
      const skirt = y > FY - 11;
      const rag = (y * 7) % 5 === 0 ? 1 : 0;
      const hw = (skirt ? 3 + Math.min(3, Math.floor((y - (FY - 11)) * 0.6)) : y < FY - 19 ? 3 : 4) + rag;
      for (let x = FX - hw; x <= FX + hw; x++) {
        const u = x - FX;
        let tone: number;
        if (u <= -hw + 1) tone = PAL.gold3;
        else if (u >= hw - 1) tone = PAL.gold1;
        else if (u < 0) tone = (u & 1) === 0 ? PAL.gold3 : PAL.gold2;
        else tone = (u & 1) === 0 ? PAL.gold2 : PAL.gold1;
        if (y === FY - 15 && b.wrap > 0.65) tone = Math.abs(u) <= 3 ? PAL.earth1 : tone; // the twine at the waist
        if (y === yEdge + 1 && b.wrap < 1) tone = PAL.gold4; // the fresh straw just wound on
        p.set(x, y, C(tone));
      }
    }
    if (b.wrap >= 0.2)
      for (const [x, len] of [
        [FX - 5, 2],
        [FX - 2, 3],
        [FX + 1, 2],
        [FX + 4, 3],
      ] as const)
        for (let k = 1; k <= len; k++) p.set(x + (k === len ? sway : 0), yBot + k - 1, C(x < FX ? PAL.gold3 : PAL.gold2));
    if (b.wrap < 1 && yEdge > yTop) {
      p.set(FX - 5 - (fr & 1), yEdge + 2, C(PAL.gold3));
      p.set(FX + 5 + (fr & 1), yEdge + 3, C(PAL.gold2));
    }
  }
  // ---- the coat (torso + sleeves + straw hands)
  if (b.coatY !== null) {
    const oy = R(b.coatY);
    const sh = FY - 21 + oy;
    const hem = FY - 11 + oy;
    for (let y = sh; y <= hem; y++) {
      const t = (y - sh) / (hem - sh);
      const hw = 5 + Math.round(t * (1 + b.flap));
      for (let x = FX - hw; x <= FX + hw; x++) {
        const u = x - FX;
        if (y === hem && (x & 1)) continue; // ragged hem
        let tone: number = u < -hw * 0.45 ? PAL.leaf2 : u > hw * 0.4 ? PAL.leaf0 : PAL.leaf1;
        const row = y - sh;
        const v = Math.round((4 - row) * 0.5);
        if (row < 4 && Math.abs(u) <= v) tone = PAL.gold2; // the straw in the open collar
        else if (row < 4 && u === -v - 1) tone = PAL.leaf3; // the lit lapel
        p.set(x, y, C(tone));
      }
    }
    p.set(FX + 2, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 3, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 2, FY - 15 + oy, C(PAL.earth1));
    p.set(FX + 3, FY - 15 + oy, C(PAL.earth2));
    const a = ARM_ANGLE[Math.max(0, Math.min(4, b.arm))];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    for (const dir of [-1, 1]) {
      const sx = FX + dir * 4;
      const sy = sh + 1;
      const dip = dir === b.dipDir ? b.dip : 0;
      for (let d = 0; d <= ARM_L; d++) {
        const cx = sx + dir * ca * d;
        const cy = sy + sa * d + (dip * d) / ARM_L;
        for (let i = 0; i < 3; i++) {
          const px = R(cx - dir * sa * (i - 1) * 0.9);
          const py = R(cy + ca * (i - 1));
          p.set(px, py, C(i === 0 ? (dir < 0 ? PAL.leaf3 : PAL.leaf2) : i === 2 ? PAL.leaf0 : d === ARM_L ? PAL.leaf0 : PAL.leaf1));
        }
      }
      const hx = sx + dir * ca * (ARM_L + 1);
      const hy = sy + sa * (ARM_L + 1) + dip;
      const open = b.arm >= 2 ? 1 : 0;
      const fan: [number, number, number][] = [
        [-1 - open, PAL.gold3, 3],
        [0, PAL.gold3, 4],
        [1 + open, PAL.gold2, 3],
      ];
      for (const [k, tone, len] of fan) {
        const ang = a + k * 0.62;
        const ex = hx + dir * Math.cos(ang) * len;
        const ey = hy + Math.sin(ang) * len + (k === 0 ? sway * 0.5 : k < 0 && dir > 0 ? sway : 0);
        p.line(R(hx), R(hy), R(ex), R(ey), C(tone));
      }
    }
  }
  // ---- the sack head + the hat
  if (b.headY !== null) {
    const oy = R(b.headY);
    const cx = HEAD_CX;
    const cy = HEAD_CY + oy + b.squash;
    const rx = 5 + (b.squash > 0 ? 1 : 0);
    const ry = 4 - b.squash;
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy > 1) continue;
        const l = dx + dy;
        p.set(x, y, C(l < -0.7 ? PAL.earth4 : l > 0.6 ? PAL.earth2 : PAL.earth3));
      }
    // the neck tie and a straw tuft under it
    p.hline(cx - 2, cx + 1, cy + ry + 1, C(PAL.earth1));
    p.set(cx - 3, cy + ry + 2, C(PAL.gold3));
    p.set(cx + 2, cy + ry + 2, C(PAL.gold2));
    // the stitched mouth (facing right)
    p.set(cx + 1, cy + 2, C(PAL.earth1));
    p.set(cx + 2, cy + 2, C(PAL.earth2));
    p.set(cx + 3, cy + 2, C(PAL.earth1));
    p.set(cx + 4, cy + 2, C(PAL.earth1));
    // the BUTTON EYES: 2×2 dark buttons with a 1-px sheen (lit later, over the outline)
    if (b.eyes === 0)
      for (const ex of [cx, cx + 3]) {
        p.set(ex, cy - 1, C(PAL.night3));
        p.set(ex + 1, cy - 1, C(PAL.ink));
        p.set(ex, cy, C(PAL.ink));
        p.set(ex + 1, cy, C(PAL.ink));
      }
  }
  if (b.hatY !== null) {
    const oy = R(b.hatY);
    const cx = HEAD_CX;
    const brim = FY - 30 + oy;
    for (let x = cx - 7; x <= cx + 7; x++) {
      const drop = x >= cx + 6 ? 1 : 0;
      p.set(x, brim + drop, C(x < cx - 2 ? PAL.earth2 : PAL.earth1));
    }
    for (let y = brim - 4; y < brim; y++) {
      const hw = y === brim - 4 ? 2 : 3;
      for (let x = cx - hw; x <= cx + hw - (y === brim - 4 ? 1 : 0); x++) p.set(x, y, C(x < cx - 1 ? PAL.earth2 : y === brim - 1 ? PAL.earth0 : PAL.earth1));
    }
    p.set(cx + 4, brim - 2 + (fr === 1 ? -1 : 0), C(PAL.gold3));
  }
  p.outline(PAL.ink);
  // ---- unlit overlays (never outlined): the fall streaks, the cracks, the lit eyes
  if (b.streak > 0 && b.stake) {
    const top = FY - STAKE_TOP + R(b.stakeY);
    for (let k = 1; k <= b.streak; k++) {
      if (k % 3 === 0) continue;
      p.set(FX - 2, top - k, k < 4 ? PAL.gold4 : PAL.earth4);
      if (k % 2) p.set(FX + 2, top - k - 2, PAL.earth3);
    }
  }
  if (b.cracks > 0) {
    const tone = b.cracks === 1 ? PAL.ink : PAL.night1;
    const rays: [number, number][] = [
      [-2, 1],
      [2, 1],
      [-2, -1],
      [2, -1],
      [0, 1],
    ];
    rays.forEach(([dx, dy], i) => {
      const len = 3 + (i % 3);
      for (let k = 1; k <= len; k++) p.set(FX + dx * k + (dx > 0 ? 1 : -1), FY + 1 + Math.round(dy * k * 0.5), tone);
    });
  }
  if (b.headY !== null && b.eyes > 0) {
    const cx = HEAD_CX;
    const cy = HEAD_CY + R(b.headY) + b.squash;
    const core = b.eyes === 1 ? PAL.white : b.eyes === 2 ? PAL.gold4 : b.eyes === 3 ? PAL.gold3 : PAL.gold2;
    for (const ex of [cx, cx + 3]) {
      p.set(ex, cy - 1, core);
      p.set(ex + 1, cy - 1, core);
      p.set(ex, cy, core);
      p.set(ex + 1, cy, core);
      // the glint: a cross of light off each button (2 px at the flash, then 1 px)
      const arm = b.eyes === 1 ? 2 : b.eyes === 2 ? 1 : 0;
      const ct = b.eyes === 1 ? PAL.gold4 : PAL.gold3;
      for (let k = 1; k <= arm; k++) {
        p.set(ex, cy - 1 - k, ct);
        p.set(ex + 1, cy + k, ct);
        if (ex === cx) p.set(ex - k, cy, ct);
        else p.set(ex + 1 + k, cy - 1, ct);
      }
    }
  }
  r.end();
}

// ================================================================ one decoy on the field

interface Decoy {
  ev: SummonEv;
  idx: number;
  floor: XY;
  /** the stake's fall height for this zone (fits under the HUD band) */
  sky: number;
  /** left → right on screen */
  rank: number;
  flip: boolean;
  ras: Raster;
  b: Build;
  pool: LightHandle | null;
  tile: TileCard | null;
}

function newDecoy(sc: Phaser.Scene, ev: SummonEv, idx: number): Decoy {
  const z = zoneXY(ev.player, 'monster', ev.zone);
  const floor = { x: R(z.x), y: R(z.y) };
  const flip = ev.player === 1;
  // the raster's floor column is FX; flipped (P2) it mirrors about the texture's centre, so it sits one px right
  const ras = new Raster(sc, floor.x - FX + (flip ? 1 : 0), floor.y - FY, RW, RH, unitDepth(floor.y) + 0.5);
  ras.img.setFlipX(flip);
  const sky = Math.max(30, Math.min(SKY, floor.y - STAKE_TOP - SKY_MIN_Y));
  const b = freshBuild();
  b.stakeY = -sky;
  return { ev, idx, floor, sky, rank: 0, flip, ras, b, pool: null, tile: null };
}

/** A decoy's local raster pixel → world (flip aware). */
function toWorld(d: Decoy, c: number, y: number): XY {
  return { x: d.flip ? d.ras.x + RW - 1 - c : d.ras.x + c, y: d.ras.y + y };
}

/** World → the decoy's local raster pixel. */
function toLocal(d: Decoy, wx: number, wy: number): XY {
  return { x: d.flip ? d.ras.x + RW - 1 - wx : wx - d.ras.x, y: wy - d.ras.y };
}

/** The local side (±1) of the sleeve that points to the screen's right. */
const outerRight = (d: Decoy) => (d.flip ? -1 : 1);

/** Where a crow perches on the decoy's screen-right sleeve (world, its feet), arms level. */
function perchPoint(d: Decoy): XY {
  const dir = outerRight(d);
  const a = ARM_ANGLE[4];
  const sh = FY - 21;
  // out at the cuff, so its tail clears the sack head
  const c = R(FX + dir * 4 + dir * Math.cos(a) * ARM_L) + dir;
  // its claws round the sleeve's top edge (the sleeve dips 1 px under its weight)
  const y = R(sh + 1 + Math.sin(a) * ARM_L);
  return toWorld(d, c, y);
}

// ================================================================ the crow (the hero beat)

type CrowPose = 'up' | 'mid' | 'down' | 'flare' | 'perch' | 'caw' | 'bob';
const CW = 30;
const CH = 18;
/** The crow's feet inside its raster. */
const CFX = 14;
const CFY = 17;

/** Paint the crow (facing right) in a pose: ink body, a stone3 / mist rim of evening light on every upper edge. */
function paintCrow(r: Raster, pose: CrowPose): void {
  const p = r.pc;
  r.begin();
  const ink = PAL.ink;
  const flying = pose === 'up' || pose === 'mid' || pose === 'down' || pose === 'flare';
  let head: XY;
  let beakOpen = false;
  if (flying) {
    const far: XY = pose === 'up' ? { x: 17, y: 1 } : pose === 'mid' ? { x: 21, y: 7 } : pose === 'down' ? { x: 17, y: 16 } : { x: 20, y: 0 };
    p.thickLine(14, 8, far.x, far.y, 2, PAL.stone0);
    p.ellipse(13, 9, 6, 2, ink);
    head = { x: 20, y: pose === 'flare' ? 6 : 8 };
    p.disc(head.x, head.y, 2, ink);
    if (pose === 'flare') {
      p.tri(8, 10, 2, 12, 5, 15, ink); // the tail fans down to brake
      p.vline(12, 11, 15, PAL.stone1);
      p.vline(15, 11, 15, PAL.stone1);
    } else p.tri(8, 9, 2, 7, 2, 11, ink);
    const near: XY = pose === 'up' ? { x: 10, y: 0 } : pose === 'mid' ? { x: 5, y: 6 } : pose === 'down' ? { x: 10, y: 17 } : { x: 15, y: 0 };
    p.thickLine(12, 8, near.x, near.y, 2, ink);
  } else {
    // perched, upright on the sleeve: body, folded wing, tail down behind, legs gripping
    const hy = pose === 'caw' ? 5 : pose === 'bob' ? 8 : 6;
    p.ellipse(12, 11, 5, 3, ink);
    p.tri(8, 12, 3, 16, 6, 17, ink);
    head = { x: 17, y: hy };
    p.thickLine(14, 9, head.x, head.y + 1, 2, ink);
    p.disc(head.x, head.y, 2, ink);
    p.vline(12, 14, 17, PAL.stone1);
    p.vline(15, 14, 17, PAL.stone1);
    p.set(16, 17, PAL.stone1);
    p.set(13, 17, PAL.stone1);
    beakOpen = pose === 'caw';
  }
  // the evening rim light on every upper edge (what makes it read on the dark wall and on the floor)
  const rim: XY[] = [];
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const c = p.get(x, y);
      if (c === null || c === PAL.stone1) continue;
      if (p.get(x, y - 1) === null) rim.push({ x, y });
    }
  for (const q of rim) p.set(q.x, q.y, Math.abs(q.x - head.x) <= 2 && q.y <= head.y ? PAL.mist : PAL.stone3);
  // the beak (open on the caw) and the eye's gold glint
  const bx = head.x + 2;
  const by = head.y;
  if (beakOpen) {
    // wide open: the upper mandible tips up, the lower drops, the dark gape between
    p.hline(bx, bx + 3, by - 1, PAL.stone3);
    p.set(bx + 4, by - 2, PAL.stone3);
    p.hline(bx, bx + 1, by, PAL.crim0);
    p.hline(bx, bx + 2, by + 1, PAL.stone2);
    p.set(bx + 3, by + 2, PAL.stone2);
  } else {
    p.hline(bx, bx + 3, by, PAL.stone3);
    p.set(bx + 4, by + 1, PAL.stone2);
    p.hline(bx, bx + 2, by + 1, PAL.stone2);
  }
  p.set(head.x + 1, head.y - 1, PAL.gold4);
  r.end();
}

interface CrowPlan {
  /** flight start / landing (scene ms, absolute) */
  t0: number;
  dur: number;
  /** the glide's x run and its height profile (piecewise over x) */
  xs: number;
  xp: number;
  profile: XY[];
  perch: XY;
  /** the calls (absolute) and the take-off */
  caw: number;
  takeoff: number;
}

/** x along the glide at u ∈ [0, 1] (fast in, braking to the perch). */
const glideX = (pl: CrowPlan, u: number) => pl.xs + (pl.xp - pl.xs) * E.outQuad(u);
/** The u at which the glide passes x. */
function glideU(pl: CrowPlan, x: number): number {
  const e = Math.max(0, Math.min(1, (x - pl.xs) / (pl.xp - pl.xs)));
  return 1 - Math.sqrt(1 - e);
}
function profileY(pl: CrowPlan, x: number): number {
  const q = pl.profile;
  if (x <= q[0].x) return q[0].y;
  for (let i = 1; i < q.length; i++)
    if (x <= q[i].x) {
      const t = (x - q[i - 1].x) / Math.max(1, q[i].x - q[i - 1].x);
      return q[i - 1].y + (q[i].y - q[i - 1].y) * E.inOutSine(t);
    }
  return q[q.length - 1].y;
}

/** Fly the crow through its plan (glide → flare → perch → caws → take off and away); resolves when it is gone. */
function crowRun(sc: Phaser.Scene, clk: { readonly t: number }, pl: CrowPlan, onLand: () => void): Promise<void> {
  const ras = new Raster(sc, -CW, 0, CW, CH, DEPTH.FX - 6);
  let landed = false;
  let lastPose: CrowPose | null = null;
  let away: XY = { x: 0, y: 0 };
  return new Promise<void>((resolve) => {
    onFrame(sc, () => {
      const now = clk.t;
      const el = now - pl.t0;
      if (el < 0) return true;
      let pose: CrowPose;
      let foot: XY;
      if (el < pl.dur) {
        const u = el / pl.dur;
        const x = glideX(pl, u);
        const flare = el > pl.dur - STRAW_T.flare;
        pose = flare ? 'flare' : u > 0.45 && u < 0.7 ? 'mid' : (['up', 'mid', 'down', 'mid'] as const)[Math.floor(el / 60) % 4];
        foot = { x: R(x), y: R(profileY(pl, x) + (flare ? 0 : [0, 0, 1, 0][Math.floor(el / 60) % 4])) };
      } else if (now < pl.takeoff) {
        if (!landed) {
          landed = true;
          onLand();
        }
        const c = now - pl.caw;
        const c2 = now - (pl.caw + STRAW_T.caw2);
        pose = (c >= 0 && c < 240) || (c2 >= 0 && c2 < 160) ? 'caw' : (c >= 240 && c < 330) || (c2 >= 160 && c2 < 250) ? 'bob' : 'perch';
        foot = pl.perch;
      } else {
        const k = now - pl.takeoff;
        if (k > 700) {
          ras.destroy();
          resolve();
          return false;
        }
        // startled: up and away to the right, beating hard
        const t = k / 700;
        away = { x: R(pl.perch.x + 260 * E.inQuad(t) + 30 * t), y: R(pl.perch.y - 150 * E.outQuad(t)) };
        pose = (['up', 'mid', 'down', 'mid'] as const)[Math.floor(k / 45) % 4];
        foot = away;
      }
      ras.moveTo(foot.x - CFX, foot.y - CFY);
      if (pose !== lastPose) {
        paintCrow(ras, pose);
        lastPose = pose;
      }
      return true;
    });
  });
}

// ================================================================ the hand-over (the decoy comes alive)

/** The token unit's resting pixels, laid into the decoy's raster coordinates (null when unknown). */
function tokenPixels(d: Decoy, unit: MonsterUnit): PixelCanvas | null {
  const fi = unit.frameInfo();
  const art = unit.art;
  let fr: PixelCanvas;
  try {
    fr = monsterFrame(art.id as MonsterId, fi.anim ?? 'idle', fi.frame, d.ev.player === 1 && relightsP2(art) ? { lightFrom: 'right' } : undefined);
  } catch {
    return null;
  }
  const out = new PixelCanvas(RW, RH);
  const sp = unit.sprite;
  if (Math.abs(sp.scaleX) !== 1 || Math.abs(sp.scaleY) !== 1) return null;
  for (let fy = 0; fy < fr.h; fy++)
    for (let fx = 0; fx < fr.w; fx++) {
      const c = fr.get(fx, fy);
      if (c === null) continue;
      const w = unit.framePoint(fx + 0.5, fy + 0.5);
      const l = toLocal(d, Math.floor(w.x), Math.floor(w.y));
      if (l.x >= 0 && l.y >= 0 && l.x < RW && l.y < RH) out.set(l.x, l.y, c);
    }
  return out;
}

/**
 * One frame of the re-wind: rows under `edge` are the token, rows over it the built scarecrow, the two rows at the
 * edge a bristle of straw (both silhouettes, gold4 / gold3, with a whisker each side).
 */
function paintMorph(r: Raster, from: PixelCanvas, to: PixelCanvas, edge: number): void {
  const p = r.pc;
  r.begin();
  /** the edge is ragged like the end of a straw bundle: each column a little higher or lower */
  const JAG = [0, 2, 1, 3, 0, 1, 2];
  for (let x = 0; x < RW; x++) {
    const e = edge - JAG[x % JAG.length];
    for (let y = 0; y < RH; y++) {
      const t = to.get(x, y);
      const f = from.get(x, y);
      if (y > e + 1) {
        if (t !== null) p.set(x, y, t);
      } else if (y < e) {
        if (f !== null) p.set(x, y, f);
      } else if (t !== null || f !== null) p.set(x, y, t !== null ? (y === e ? PAL.gold4 : PAL.gold3) : PAL.gold2);
    }
  }
  r.end();
}

// ================================================================ the signature

interface SigArgs {
  /** where the orb arrives (the burst in the sky) */
  burst: XY;
  /** the orb's flight to the burst (the opening's release or the quick card's own streak) */
  release: (to: XY) => Promise<void>;
  /** the spent card leaves (resolves when it is on its way) */
  leave: () => Promise<void>;
  decoys: Decoy[];
  player: PlayerId;
  uid: Uid;
}

async function signature(ctx: AnyCtx, s: SigArgs): Promise<void> {
  const sc = ctx.scene;
  const T = STRAW_T;
  const field = ctx.views.field;
  const ds = s.decoys;
  const n = ds.length;
  const rnd = fxRng(9191 + s.uid * 13);
  const clk = new SceneClock(sc);
  // ---- the build ticker: every raster repaints each frame from its state
  let ticking = true;
  const stopTick = onFrame(sc, (_dt, el) => {
    if (!ticking) return false;
    for (const d of ds) if (d.ras.alive) paintDecoy(d.ras, d.b, el);
    return true;
  });
  const chips = new PxSparks(sc, DEPTH.FX - 2);
  const straws = new PxSparks(sc, DEPTH.FX - 1);
  const order = [...ds].sort((a, b) => a.floor.x - b.floor.x);
  order.forEach((d, r) => (d.rank = r));
  const xs = order.map((d) => d.floor.x);
  /** the wind blows from this player's field edge outward: P1 left → right, P2 right → left */
  const wdir = s.player === 0 ? 1 : -1;

  // ---- release → burst
  await s.release(s.burst);
  playV3('e_strawGust', { volume: 0.9, pan: panAt(s.burst.x) });
  bg(starFlare(sc, s.burst, 220, GOLD_FX, 20));
  void lightFlash(sc, s.burst.x, s.burst.y, PAL.gold3, 30, 300, { air: 0.9, intensity: 0.5 });

  // ---- the stakes (absolute marks from S0)
  const S0 = clk.t;
  let lastStab!: () => void;
  const lastStabbed = new Promise<void>((r) => (lastStab = r));
  const stakes = ds.map(async (d, i) => {
    const sky: XY = { x: d.floor.x, y: d.floor.y - STAKE_TOP - d.sky };
    bg(energyStreak(sc, s.burst, sky, { path: 'line', ms: T.fan, size: 1, light: false }));
    await clk.until(S0 + T.stake0 + i * T.stakeGap);
    const b = d.b;
    const pan = panAt(d.floor.x);
    const last = i === n - 1;
    // materialise in the sky: a white silhouette for a frame, then wood
    b.stake = true;
    b.stakeY = -d.sky;
    b.white = true;
    void wait(sc, 34).then(() => (b.white = false));
    playV3('e_strawDrop', { volume: 0.6, pan });
    await run(sc, T.fall, (t) => {
      const e = E.inQuad(t);
      b.stakeY = -d.sky * (1 - e);
      b.streak = Math.round(4 + 12 * e);
    });
    // STAB: squash (1 px shorter, 1 px wider), white frame, dirt ring, cracks, chips
    b.stakeY = 0;
    b.streak = 0;
    b.sink = 2;
    b.squash1 = 1;
    b.white = true;
    b.cracks = 1;
    playV3(TOK[i % 3], { volume: 0.95, pan });
    void shake(sc, last ? 140 : 90, last ? 2 : 1);
    bg(floorRing(sc, d.floor.x, d.floor.y, { r0: 3, r1: last ? 24 : 18, ms: 300, ramp: [PAL.earth4, PAL.earth3, PAL.earth2, PAL.earth1], depth: DEPTH.SHADOW - 1 }));
    if (!field.tileOf(d.ev.uid)) {
      d.tile = field.placeCard(d.ev.player, 'monster', d.ev.zone, d.ev.uid, TOKEN, true, 'side');
      d.tile.tileFlash(PAL.gold3, 280);
    }
    void lightFlash(sc, d.floor.x, d.floor.y, PAL.gold3, 22, 240, { floorY: d.floor.y, intensity: 0.8 });
    d.pool = lightPool(sc, d.floor.x, d.floor.y - 10, { color: PAL.gold2, radius: 18, floorY: d.floor.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
    d.pool.setIntensity(0.5, 200);
    for (let k = 0; k < 11; k++) {
      const a = Math.PI + (k / 10) * Math.PI + (rnd() - 0.5) * 0.3;
      chips.add({ x: d.floor.x + R(Math.cos(a) * 2), y: d.floor.y, vx: Math.cos(a) * (30 + rnd() * 60), vy: -50 - rnd() * 80, ay: 420, floor: d.floor.y + 3, bounce: 0.3, life: 320 + rnd() * 220, colors: k % 3 ? [PAL.earth2, PAL.earth1] : [PAL.earth3, PAL.earth2], shape: 'px', fadeAt: 0.8 });
    }
    if (last) {
      await stopTime(sc, 40);
      lastStab();
    }
    await wait(sc, 34);
    b.white = false;
    b.squash1 = 0;
    b.sink = 1;
    // follow-through: the stake's top quivers and settles; the cracks darken out
    for (const w of [1, -1, 1, 0]) {
      b.wob = w;
      await wait(sc, 34);
    }
    b.sink = 0;
    b.cracks = 2;
    void wait(sc, 260).then(() => (b.cracks = 0));
  });
  await lastStabbed;

  // ================= W0: one origin for everything that follows
  const W0 = clk.t;
  const at = (ms: number) => clk.until(W0 + ms);
  const headLand = (r: number) => T.head + r * T.headGap + T.headDrop;
  const A = Math.max(T.arms, headLand(n - 1) + T.armsAfterHead);

  // ---- the wind (straight into the last stake's quiver): straws lift off the ground, then the gust
  for (const d of order)
    for (let k = 0; k < 3; k++)
      straws.add({ x: d.floor.x + R((rnd() - 0.5) * 16), y: d.floor.y + 1, vx: wdir * (20 + rnd() * 30), vy: -30 - rnd() * 30, ay: -10, life: 260 + rnd() * 160, colors: [PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 0.7 });
  const left = Math.min(...xs) - 60;
  const right = Math.max(...xs) + 60;
  const up = wdir > 0 ? left : right;
  bg(
    at(T.wind).then(() => {
      playV3(wdir > 0 ? 'e_strawWrap' : 'e_strawWrapR', { volume: 0.85, pan: 0 });
      let gusting = true;
      onFrame(sc, (dt) => {
        if (!gusting) return false;
        const m = dt / 9;
        for (let k = 0; k < m; k++) {
          const d = order[Math.floor(rnd() * n)];
          const y = d.floor.y - 4 - rnd() * 22;
          if (rnd() < 0.45) {
            straws.add({ x: up - wdir * rnd() * 30, y, tx: d.floor.x + (rnd() - 0.5) * 6, ty: d.floor.y - 6 - rnd() * 14, curl: (1.1 + rnd() * 0.6) * wdir, life: 260 + rnd() * 140, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.02, fadeAt: 0.9 });
          } else {
            straws.add({ x: up - wdir * rnd() * 40, y: y - 6, vx: wdir * (280 + rnd() * 160), vy: (rnd() - 0.5) * 20, life: ((right - left) / 380) * 1000, colors: rnd() < 0.3 ? [PAL.earth4, PAL.gold3] : [PAL.gold3, PAL.gold2, PAL.gold1], shape: rnd() < 0.5 ? 'streak' : 'px', len: 0.03, fadeAt: 0.8 });
          }
        }
        return true;
      });
      // the gust passes the row in its own direction: the wrap starts at the upwind decoy
      const up2 = wdir > 0 ? order : [...order].reverse();
      return Promise.all(
        up2.map(async (d, r) => {
          await at(T.wind + r * T.wrapGap);
          await run(sc, T.wrapMs, (t) => {
            d.b.wrap = Math.ceil(E.outQuad(t) * 9) / 9;
          });
          d.b.wrap = 1;
        }),
      ).then(() => wait(sc, 80).then(() => (gusting = false)));
    }),
  );

  // ---- the coats (drop, flap, SNAP)
  for (const d of order)
    bg(
      (async () => {
        await at(T.coat + d.rank * T.coatGap);
        const b = d.b;
        await run(sc, T.coatDrop, (t) => {
          b.coatY = -12 * (1 - E.inQuad(t));
          b.flap = t < 0.5 ? 2 : 1;
        });
        b.coatY = 0;
        for (const f of [2, 0, 1]) {
          b.flap = f;
          await wait(sc, 30);
        }
        b.flap = 0;
        playV3('e_strawCoat', { volume: 0.75, pan: panAt(d.floor.x) });
      })(),
    );
  // ---- the heads + hats
  for (const d of order)
    bg(
      (async () => {
        await at(T.head + d.rank * T.headGap);
        const b = d.b;
        await run(sc, T.headDrop, (t) => {
          b.headY = -16 * (1 - E.inQuad(t));
          b.hatY = -26 * (1 - E.inQuad(Math.min(1, t * 0.8)));
        });
        b.headY = 0;
        b.squash = 1;
        playV3('e_strawHead', { volume: 0.75, pan: panAt(d.floor.x) });
        await wait(sc, 40);
        b.squash = 0;
        b.hatY = 0;
        await wait(sc, 30);
        b.hatY = -2;
        await wait(sc, 34);
        b.hatY = 0;
      })(),
    );

  // ---- ARMS SPREAD (all together) at A; a dusk light sweeps the row; each pair of hands flicks open
  bg(
    at(A).then(async () => {
      playV3('e_strawArms', { volume: 0.85, pan: 0 });
      for (const d of order) {
        bg(
          at(A + 90 + d.rank * 25).then(() => {
            playV3('e_strawHand', { volume: 0.7, pan: panAt(d.floor.x) });
            for (const side of [-1, 1]) {
              const h = toWorld(d, FX + side * 13, FY - 20);
              for (let k = 0; k < 4; k++) straws.add({ x: h.x, y: h.y, vx: (h.x > d.floor.x ? 1 : -1) * (30 + rnd() * 50), vy: -20 - rnd() * 40, ay: 120, life: 240 + rnd() * 160, colors: [PAL.gold4, PAL.gold3], shape: 'px', fadeAt: 0.7 });
            }
          }),
        );
        bg(at(A + d.rank * 45).then(() => lightFlash(sc, d.floor.x, d.floor.y - 14, PAL.gold2, 30, 320, { floorY: d.floor.y, air: 0.5, intensity: 0.55 })));
      }
      for (const step of [1, 2, 3, 4]) {
        for (const d of ds) d.b.arm = step;
        await wait(sc, T.armStep);
      }
    }),
  );

  // ---- THE CROW: glides down the row, lights each scarecrow's eyes as it passes, lands on the last one's arm, caws
  const perchD = order[n - 1];
  const perch = perchPoint(perchD);
  const hatTop = (d: Decoy) => d.floor.y - 36;
  const xs0 = -20;
  const profile: XY[] = [{ x: xs0, y: Math.max(SKY_MIN_Y + 6, hatTop(order[0]) - 46) }, ...order.slice(0, -1).map((d) => ({ x: d.floor.x, y: hatTop(d) - 6 })), { x: perchD.floor.x, y: Math.min(hatTop(perchD) - 6, perch.y - 8) }, perch];
  const dur = Math.max(T.crowMin, Math.min(T.crowMax, (perch.x - xs0) / 0.42));
  const plan: CrowPlan = { t0: 0, dur, xs: xs0, xp: perch.x, profile, perch, caw: 0, takeoff: 0 };
  const eyeU = order.map((d) => glideU(plan, d.floor.x - 2));
  // the first eye no sooner than the arms are out
  const C0 = Math.max(A - 400, A + T.eyesAfterArms - eyeU[0] * dur);
  plan.t0 = W0 + C0;
  const eyeAt = eyeU.map((u) => C0 + u * dur);
  const land = C0 + dur;
  const caw = Math.max(land + T.cawAfterLand, eyeAt[n - 1] + T.cawAfterEye);
  const H = caw + T.handoff;
  plan.caw = W0 + caw;
  plan.takeoff = W0 + H;
  const crow = crowRun(sc, clk, plan, () => {
    playV3('e_strawPerch', { volume: 0.85, pan: panAt(perch.x) });
    const b = perchD.b;
    b.dipDir = outerRight(perchD);
    b.dip = 2;
    void wait(sc, 60).then(() => (b.dip = 1));
  });
  // the eyes: one decoy at a time, as the crow passes over it
  for (const d of order)
    bg(
      at(eyeAt[d.rank]).then(async () => {
        const b = d.b;
        const head = toWorld(d, HEAD_CX + 2, HEAD_CY);
        playV3('e_strawEye', { volume: 0.75, pan: panAt(d.floor.x) });
        void lightFlash(sc, head.x, head.y, PAL.gold3, 16, 420, { floorY: d.floor.y, air: 1, intensity: 1.2 });
        for (const e of [1, 2, 3, 4]) {
          b.eyes = e;
          await wait(sc, e === 4 ? 80 : T.eyeStage);
        }
        b.eyes = 0;
      }),
    );
  // the caws: the straw shivers on each call
  for (const [k, t] of [
    [0, caw],
    [1, caw + T.caw2],
  ] as const)
    bg(
      at(t).then(() => {
        if (k === 0) playV3('e_strawCrow', { volume: 0.85, pan: panAt(perch.x) });
        for (const d of ds) d.b.shiver = 1;
        return wait(sc, k === 0 ? 160 : 110).then(() => {
          for (const d of ds) d.b.shiver = 0;
        });
      }),
    );
  // the spent card leaves while the crow sits
  await at(caw);
  const gone = s.leave();
  await at(H);

  // ---- COMES ALIVE: the straw bristles up each scarecrow and re-winds it into the token unit
  ticking = false;
  stopTick();
  playV3('e_strawWake', { volume: 0.9, pan: panAt((Math.min(...xs) + Math.max(...xs)) / 2) });
  const morphs: { d: Decoy; from: PixelCanvas; to: PixelCanvas | null; unit: MonsterUnit | null; top: number; bot: number }[] = [];
  for (const d of ds) {
    // the final built frame (eyes dark, arms level, the crow's weight gone)
    d.b.dip = 0;
    d.b.shiver = 0;
    paintDecoy(d.ras, d.b, 0);
    const from = d.ras.pc.clone();
    ctx.consumeAt(d.idx);
    if (!field.tileOf(d.ev.uid)) field.placeCard(d.ev.player, 'monster', d.ev.zone, d.ev.uid, TOKEN, true, 'side');
    const unit = field.addUnit(d.ev.uid, { hidden: true, atk: 0, def: 0, position: 'defense' });
    let to: PixelCanvas | null = null;
    if (unit) {
      unit.show();
      unit.badge.setVisible(false);
      unit.rest();
      unit.sprite.setAlpha(0);
      to = tokenPixels(d, unit);
    }
    const bf = from.bounds();
    const bt = to?.bounds();
    const top = Math.min(bf ? bf.y : FY - 40, bt ? bt.y : FY - 40) - 1;
    const bot = Math.max(bf ? bf.y + bf.h : FY + 2, bt ? bt.y + bt.h : FY + 2);
    morphs.push({ d, from, to, unit, top, bot });
  }
  const steps = 6;
  for (let k = 0; k <= steps; k++) {
    for (const m of morphs) {
      const edge = R(m.bot - ((m.bot - m.top) * k) / steps);
      const to = m.to ?? new PixelCanvas(RW, RH);
      paintMorph(m.d.ras, m.from, to, edge);
      // what the token does not wear is shed on the wind as the edge passes it
      const lo = R(m.bot - ((m.bot - m.top) * (k - 1)) / steps);
      for (let y = edge; y < lo; y++)
        for (let x = 0; x < RW; x += 2) {
          const c = m.from.get(x, y);
          if (c === null || c === PAL.ink || (m.to && m.to.get(x, y) !== null) || rnd() > 0.45) continue;
          const w = toWorld(m.d, x, y);
          chips.add({ x: w.x, y: w.y, vx: wdir * (40 + rnd() * 70), vy: -20 - rnd() * 40, ay: 200, floor: m.d.floor.y + 2, bounce: 0.2, life: 300 + rnd() * 220, colors: [c], shape: 'px', fadeAt: 0.7 });
        }
    }
    if (k === 1)
      for (const m of morphs) void lightFlash(sc, m.d.floor.x, m.d.floor.y - 14, PAL.gold3, 22, 300, { floorY: m.d.floor.y, air: 0.6, intensity: 0.7 });
    await wait(sc, T.morphFrame);
  }
  for (const m of morphs) {
    m.d.ras.destroy();
    if (m.unit) {
      m.unit.sprite.setAlpha(1);
      m.unit.badge.setVisible(true);
      bg(m.unit.badge.pop());
    }
    void m.d.pool?.fadeOut(300);
  }
  chips.release();
  straws.release();
  relax(ctx, 300);
  await gone;
  await Promise.all(stakes);
  // the crow flies on out of the picture on its own; the clock lives until it is gone
  void crow.then(() => clk.dispose());
}

/**
 * The scene's own clock: scaled time (the v3 tempo, hit-stops) accumulated frame by frame — the same clock as
 * wait / run / onFrame. (Phaser's scene.time.now is UNSCALED game time: mixing it with scaled waits is what made
 * every absolute mark drift ×1.35.)
 */
class SceneClock {
  t = 0;
  private waiters: { at: number; res: () => void }[] = [];
  private readonly stop: () => void;
  constructor(sc: Phaser.Scene) {
    this.stop = onFrame(sc, (dt) => {
      this.t += dt;
      if (this.waiters.length) {
        const due = this.waiters.filter((w) => w.at <= this.t);
        this.waiters = this.waiters.filter((w) => w.at > this.t);
        for (const w of due) w.res();
      }
      return true;
    });
  }
  /** Resolves when the clock reaches `at` (ms). */
  until(at: number): Promise<void> {
    if (at <= this.t) return Promise.resolve();
    return new Promise((res) => this.waiters.push({ at, res }));
  }
  dispose(): void {
    this.stop();
    for (const w of this.waiters) w.res();
    this.waiters = [];
  }
}

/** The sky point the orb bursts at: over the decoys' row, never under the HUD band. */
function burstOver(ds: Decoy[]): XY {
  const xs = ds.map((d) => d.floor.x);
  const tops = ds.map((d) => d.floor.y - STAKE_TOP - d.sky);
  return { x: R((Math.min(...xs) + Math.max(...xs)) / 2), y: Math.max(40, R(Math.min(...tops) - 26)) };
}

// ================================================================ hooks

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const ds: Decoy[] = [];
  let gi = -1;
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (ctx.isConsumed(i)) continue;
    if (e.type === 'summon' && e.from === 'token' && e.sourceUid === ev.uid) ds.push(newDecoy(sc, e, i));
    else if (e.type === 'toGraveyard' && e.uid === ev.uid) {
      gi = i;
      break;
    } else if (e.type !== 'summon') break;
  }
  if (!ds.length) return ctx.base();
  const any = ctx as unknown as AnyCtx;
  const burst = burstOver(ds);
  const response = ev.from === 'spellTrap' && ctx.state.activePlayer !== ev.player;
  if (response) {
    const q = await quickReveal(ctx);
    const top = { x: q.face.x, y: q.face.y - 28 };
    await signature(any, {
      burst,
      player: ev.player,
      uid: ev.uid,
      decoys: ds,
      release: async (to) => {
        q.tile?.tileFlash(PAL.gold3, 160);
        const fly = energyStreak(sc, top, to, { path: 'line', ms: STRAW_T.release, size: 2 });
        await wait(sc, 40);
        q.stopAura();
        const t = q.tile;
        if (t && t.active && t.standing) bg(t.layDown(150).then(() => t.active && t.tileFlash(PAL.teal2, 200)));
        await fly;
      },
      leave: async () => {
        const g = gi >= 0 ? ctx.events[gi] : null;
        if (gi >= 0) ctx.consumeAt(gi);
        const { tile } = ctx.views.field.release(ev.uid);
        const t = tile ?? q.tile;
        if (t && t.active && t.standing) await t.layDown(140);
        const from = t ? { x: R(t.home.x), y: R(t.home.y) } : q.at;
        if (g && g.type === 'toGraveyard') bg(cardLeaves(any, { owner: g.owner, cardId: g.cardId, from, tile: t }));
        else if (t && t.active) t.destroy();
      },
    });
    return;
  }
  const set = ev.from === 'spellTrap' && ev.zone !== null && !!ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone);
  const op = await spellOpening(any, { uid: ev.uid, cardId: ev.cardId, player: ev.player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 150, keepCard: true, releaseFrom: 'top' });
  await signature(any, {
    burst,
    player: ev.player,
    uid: ev.uid,
    decoys: ds,
    release: (to) => op.release(to, { path: 'line', ms: STRAW_T.release, size: 2 }),
    leave: async () => {
      bg(op.leave ? op.leave(gi) : Promise.resolve());
    },
  });
});

/**
 * The attacker's pick (answering a direct attack): the chosen scarecrow waves, a straw tuft lashes out along a gold
 * line and hooks the attacker (its head jerks round), the old arc to the duelist snaps away and a new one arcs onto
 * the decoy; the battle then plays into it (it takes the re-kept hold, with the new marks).
 */
registerCardHook(ID, 'target', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const ref = ev.targets[0];
  if (!ref || ref.zone !== 'monster') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const tile = field.tileAt(ref.player, 'monster', ref.index);
  const uid = ctx.state.players[ref.player].monsters[ref.index]?.uid ?? null;
  const unit = uid !== null ? ctx.unit(uid) : null;
  if (!unit) return ctx.base();
  const bi = ctx.find((e) => e.type === 'battle' || e.type === 'attackDeclare');
  const bEv = bi >= 0 ? ctx.events[bi] : null;
  const attacker = bEv && (bEv.type === 'battle' || bEv.type === 'attackDeclare') ? ctx.unit(bEv.attackerUid) : null;
  const at = unit.home;
  const head = unit.worldPoint('top');
  const pan = panAt(at.x);
  const rnd = fxRng(4040 + (uid ?? 0));
  playV3('e_strawLure', { volume: 0.9, pan });
  // the decoy waves its arms (its own taunt pose), a gold tile flash, a warm glint
  bg(unit.tryPlay('roar') || Promise.resolve());
  tile?.tileFlash(PAL.gold3, 300);
  bg(floorRing(sc, R(at.x), R(at.y), { r0: 4, r1: 34, ms: 340, ramp: [...GOLD_FX], depth: DEPTH.SHADOW - 1 }));
  void lightFlash(sc, at.x, head.y + 4, PAL.gold3, 22, 420, { floorY: at.y, air: 0.9, intensity: 1 });
  // a straw tuft lashes out at the attacker along a 2-px gold line
  const from = { x: R(head.x), y: R(head.y + 8) };
  const to = attacker ? attacker.core() : { x: from.x, y: from.y + (ref.player === 0 ? -60 : 60) };
  const line = Raster.around(sc, (from.x + to.x) / 2, (from.y + to.y) / 2, Math.abs(to.x - from.x) + 24, Math.abs(to.y - from.y) + 24, DEPTH.FX + 2);
  const tuft = new PxSparks(sc, DEPTH.FX + 3);
  for (let k = 0; k < 10; k++) tuft.add({ x: from.x, y: from.y, tx: R(to.x + (rnd() - 0.5) * 8), ty: R(to.y + (rnd() - 0.5) * 6), curl: (rnd() - 0.5) * 0.8, life: 220 + k * 18, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.03, fadeAt: 0.85 });
  tuft.release();
  const L = Math.hypot(to.x - from.x, to.y - from.y);
  const nx = -(to.y - from.y) / Math.max(1, L);
  const ny = (to.x - from.x) / Math.max(1, L);
  let hooked = false;
  await run(sc, 420, (t, el) => {
    const grow = seg(t, 0, 0.45);
    const tug = seg(t, 0.45, 0.75);
    const fade = seg(t, 0.75, 1);
    line.draw((g) => {
      const m = Math.floor(L / 2);
      for (let k = 0; k <= m; k++) {
        const u = k / m;
        if (u > grow || u < fade) continue;
        // the line sags while it flies, snaps taut on the hook, then reels toward the decoy
        const sag = Math.sin(u * Math.PI) * (1 - tug) * 6 * (Math.floor(el / 40) % 2 ? 1 : 0.8);
        const x = R(from.x + (to.x - from.x) * u + nx * sag);
        const y = R(from.y + (to.y - from.y) * u + ny * sag);
        const c = (k >> 1) % 2 ? PAL.gold3 : PAL.gold4;
        g.px(x, y, c);
        g.px(x, y + 1, PAL.gold2);
      }
    });
    if (!hooked && t >= 0.45) {
      hooked = true;
      // HOOKED: the attacker's head jerks round to the decoy, the old aim snaps away and a new arc lands on the decoy
      playV3('e_strawHook', { volume: 0.9, pan: panAt(to.x) });
      if (attacker) {
        const sp = attacker.sprite;
        const x0 = sp.x;
        const tx = Math.sign(at.x - x0) || 1;
        sp.setX(x0 + tx);
        void wait(sc, 70).then(() => sp.active && sp.setX(x0 + tx * 2));
        void wait(sc, 160).then(() => sp.active && sp.setX(x0));
      }
      retarget(ctx as unknown as AnyCtx, unit, attacker);
    }
  });
  line.destroy();
  unit.rest();
});

/** Swap the kept attack hold's marks: the old arc + lock-on go, a new arc + lock-on land on the decoy. */
function retarget(ctx: AnyCtx, decoy: MonsterUnit, attacker: MonsterUnit | null): void {
  const sc = ctx.scene;
  const taken = ctx.take('attack');
  if (!taken) return;
  if (!isHold(taken)) {
    ctx.keep('attack', taken);
    return;
  }
  const hold: AttackHold = taken;
  hold.dropMarks();
  const from = attacker ? attacker.core() : hold.from;
  const to = decoy.core();
  void lightFlash(sc, hold.to.x, hold.to.y, PAL.gold3, 20, 200, { intensity: 0.5 });
  const arrow = quietCombat(() => attackArrow(sc, from, to, hold.player));
  const lock = lockOn(sc, to.x, to.y, { color: PAL.gold3, size: Math.max(24, Math.round(decoy.art.w * 0.42)) });
  let gone = false;
  const drop = () => {
    if (gone) return;
    gone = true;
    arrow.destroy();
    lock.destroy();
  };
  const next: AttackHold = Object.assign(Object.create(null) as object, hold, {
    targetUid: decoy.uid,
    to,
    dropMarks() {
      hold.dropMarks();
      drop();
    },
    shatterMarks() {
      hold.shatterMarks();
      drop();
    },
    destroy() {
      hold.destroy();
      drop();
    },
  }) as AttackHold;
  ctx.keep('attack', next);
}
