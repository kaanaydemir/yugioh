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
//        (spells/_quick_e.ts: the turquoise zig-zag snap, "HIZLI BÜYÜ!" with a shorter hold; the burst waits until the
//        plate has wiped out and is placed off the kept attack arc), then the orb leaves the standing card's
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
//   S+100 + i·100   STAKE i appears in the sky over its zone (its fall height fits the frame: ≤ 100 px, top ≥ 44 px)
//            and FALLS point-first (130 ms; its lit side rimmed earth4, a gold4 tip, so it reads on the back wall) — e_strawDrop
//   contact  STAB: "tok" (e_strawTok1/2/3, into earth), the stake SQUASHES (2 frames: 1 px shorter + 1 px wider, then
//            back), a white frame, a dirt ring on the floor (earth ramp), ink cracks, dirt chips, the token's card
//            pinned on the tile with a gold tile flash, a warm pool; the last stab: 2 px shake + a 40 ms hit-stop
//   W0 = the last stab (after its hit-stop)
//   W+20     THE WIND crosses the row (P1 left → right, P2 right → left: from the field's edge outward): bent 3-px
//            straw stems tumble across (their bend flips frame by frame) with a few slow tufts; ~45 % of them end ON a
//            stake and curl round its front; e_strawWrap / e_strawWrapR travels with it. Straw WINDS on each stake in
//            visible turns (r·70 apart, 300 ms): a slanted turn edge in gold4, 2–3 diagonal twine bands climbing one row
//            per frame, the strand being wound coming in on the wind across the front, tufts popping on with a 1-px
//            overshoot, stray ends breaking the silhouette
//   W+320 + r·80    THE COAT drops on, flaps, SNAPS — e_strawCoat
//   W+570 + r·80    THE SACK HEAD + HAT — e_strawHead
//   A = W + max(860, last head + 110)  ARMS SPREAD together (4 stepped angles) — e_strawArms; a dusk light sweeps
//            the row and each pair of straw hands flicks open (e_strawHand per decoy, 25 ms apart)
//   C0       THE CROW (hero beat): light-rimmed (stone3 / mist on top, a stone1 bounce light under), a moving shadow on
//            the floor; enters from the left edge and glides DOWN the row over the scarecrows' hats AND over every real
//            unit it crosses (≥ 6 px clear of its top); each scarecrow's 2×2 button eyes light as it passes (white core
//            + gold4 cross → gold4 → gold3 → gold2) — e_strawEye per decoy; it flares (solid spread wings, notched
//            primaries) and LANDS on the last scarecrow's outer arm — e_strawPerch; 80 ms later it CAWS — e_strawCrow,
//            and 250 ms after that again — e_strawCrow2 (each call its own recipe on its beak mark); the spent card
//            has already left (from the first eye)
//   H = caw + 285   COMES ALIVE: the crow is startled off mid second call; each scarecrow sheds its COAT (it flaps away
//            downwind, whole, sleeves flailing) and its HAT (it tumbles once and lands on the ground, then fades); the
//            straw bristles up from the foot (8 frames, a ragged gold4/gold3 edge with a gold RIM LIGHT on the token's
//            outline just under it) re-winding it into the token unit's own pixels — e_strawWake; badges pop
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
  stakeGap: 100,
  fall: 130,
  /** after the last stab (W0): the wind */
  wind: 20,
  wrapGap: 70,
  wrapMs: 300,
  coat: 320,
  coatGap: 80,
  coatDrop: 110,
  head: 570,
  headGap: 80,
  headDrop: 90,
  /** arms: at least this, and ≥ last head landed + armsAfterHead */
  arms: 860,
  armsAfterHead: 110,
  armStep: 45,
  /** the first eye lights no sooner than arms + eyesAfterArms */
  eyesAfterArms: 160,
  eyeStage: 120,
  /** the crow's glide (scaled by distance within these) */
  crowMin: 650,
  crowMax: 860,
  flare: 130,
  /** the caw: ≥ landing + cawAfterLand and ≥ last eye + cawAfterEye */
  cawAfterLand: 80,
  cawAfterEye: 200,
  /** the second call: 0.36 s of real time after the first ≈ 270 scene ms at the 1.35 tempo — its own recipe and mark */
  caw2: 250,
  /** handoff: caw + handoff (the crow is startled off mid second call) */
  handoff: 285,
  morphFrame: 30,
  morphSteps: 8,
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
  /** the twine turns' phase (rows climbed while winding) */
  twine: number;
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
  return { stake: false, stakeY: -SKY, sink: 0, wob: 0, squash1: 0, white: false, cracks: 0, streak: 0, wrap: 0, twine: 0, coatY: null, flap: 0, headY: null, hatY: null, squash: 0, arm: 0, dipDir: 1, dip: 0, eyes: 0, shiver: 0 };
}

/** Sleeve angles (radians, + = down) per arm step: hanging, 45°, 15°, 8° over the level, level (a hair of droop). */
const ARM_ANGLE = [1.25, 0.78, 0.26, -0.14, 0.06];
const ARM_L = 8;
/** The head's centre (local) and the eyes. */
const HEAD_CX = FX + 1;
const HEAD_CY = FY - 25;
/** The straw bundle's half-width per row, from the foot (FY − 4) up (hand-tuned: a flared skirt, a waist, a chest). */
const WRAP_HW = [6, 6, 5, 5, 4, 4, 3, 4, 4, 4, 3, 4, 4, 4, 3, 3, 3, 3] as const;
/** Tufts [row, side, length] that pop on as the wind reaches them. */
const WRAP_TUFTS: readonly (readonly [number, number, number])[] = [
  [3, -1, 3],
  [7, 1, 3],
  [11, -1, 2],
  [14, 1, 2],
];
/** Stray single ends [row, side] poking out of the bundle. */
const WRAP_STRAYS: readonly (readonly [number, number])[] = [
  [1, 1],
  [5, -1],
  [9, 1],
  [12, -1],
  [16, 1],
];

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
        // falling, the lit side catches the dusk (a 1-px earth4 rim, a gold4 tip) so it reads over the back wall
        const tone = y === top ? (planted ? PAL.earth4 : PAL.gold4) : i === 0 ? (planted ? PAL.earth3 : PAL.earth4) : i === w - 1 && w > 1 ? PAL.earth1 : PAL.earth2;
        p.set(x0 + i, y, C(tone));
      }
      // bark notches
      if ((y - top) % 7 === 4) p.set(x0 + 1, y, C(PAL.earth1));
    }
  }
  // ---- the straw bundle WOUND round the stake in turns (from the ground up): the wound edge is a slanted turn (higher
  // on the far side), 2–3 diagonal twine bands climb one row per frame while it winds (b.twine), the strand being
  // wound comes in on the wind (local left) and crosses the front, tufts pop on with a 1-px overshoot, stray ends
  // break the silhouette
  if (b.wrap > 0) {
    const yBot = FY - 4;
    const rows = WRAP_HW.length;
    const wound = b.wrap * rows;
    const winding = b.wrap < 1;
    for (let i = 0; i < rows; i++) {
      const y = yBot - i;
      const hw = WRAP_HW[i];
      for (let x = FX - hw; x <= FX + hw; x++) {
        const u = x - FX;
        // the turn's slant: the far (right) side is wound a row or two ahead of the near side
        const lim = wound + (winding ? Math.floor((u + 6) / 3) - 2 : 0);
        if (i >= lim) continue;
        let tone: number;
        if (u <= -hw + 1) tone = PAL.gold3;
        else if (u >= hw - 1) tone = PAL.gold1;
        else if (u < 0) tone = (u & 1) === 0 ? PAL.gold3 : PAL.gold2;
        else tone = (u & 1) === 0 ? PAL.gold2 : PAL.gold1;
        // the twine turns: diagonal bands (rising to the right), a lit edge over each
        if (i >= 3 && i <= rows - 2) {
          const m = (((i - b.twine + Math.floor((u + 8) / 2)) % 7) + 7) % 7;
          if (m === 0) tone = PAL.earth1;
          else if (m === 1 && u < 2) tone = PAL.gold4;
        }
        // the fresh straw just wound on (the edge of the turn)
        if (winding && i >= lim - 1) tone = PAL.gold4;
        p.set(x, y, C(tone));
      }
    }
    // the straws hanging at the foot
    if (b.wrap >= 0.2)
      for (const [x, len] of [
        [FX - 5, 2],
        [FX - 2, 3],
        [FX + 1, 2],
        [FX + 4, 3],
      ] as const)
        for (let k = 1; k <= len; k++) p.set(x + (k === len ? sway : 0), yBot + k, C(x < FX ? PAL.gold3 : PAL.gold2));
    // tufts: pop on as the wind reaches their row (one frame 1 px long), then sway
    for (const [ti, side, len] of WRAP_TUFTS) {
      if (wound < ti + 1) continue;
      const pop = winding && wound - (ti + 1) < 2.2 ? 1 : 0;
      const y = yBot - ti;
      const x0 = FX + side * (WRAP_HW[ti] + 1);
      const n = len + pop;
      for (let k = 0; k < n; k++) p.set(x0 + side * k + (k === n - 1 && side < 0 ? sway : 0), y - Math.floor((k + 1) / 2), C(side < 0 ? PAL.gold3 : PAL.gold2));
    }
    // stray ends (1 px, swaying) once the bundle is there
    for (const [ti, side] of WRAP_STRAYS)
      if (wound >= ti + 1) p.set(FX + side * (WRAP_HW[ti] + 1) + (side < 0 ? Math.min(0, sway) : Math.max(0, sway)), yBot - ti, C(side < 0 ? PAL.gold3 : PAL.gold2));
    // the strand being wound: in on the wind from the near side, across the front to the far side, just over the edge
    if (winding && wound > 1) {
      const ei = Math.min(rows - 1, Math.floor(wound));
      const ey = yBot - ei;
      const wv = (Math.floor(el / 36) & 1) as number;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 9; k++) pts.push([FX - 11 + k, ey + 3 - Math.floor(k / 3) + (k < 3 ? wv : 0)]);
      for (let k = 1; k <= 4; k++) pts.push([FX - 2 + k, ey - Math.floor(k / 2)]);
      pts.forEach(([x, y], k) => p.set(x, y, C(k < 3 ? PAL.gold2 : k < 9 ? PAL.gold3 : PAL.gold4)));
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
      p.set(FX - 2, top - k, k < 6 ? PAL.gold4 : PAL.earth4);
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
    if (pose === 'flare') {
      // braking: both wings thrown up and forward as SOLID spread sails, the primaries notched at the tips
      p.poly(
        [
          [13, 8],
          [16, 7],
          [22, 1],
          [19, 0],
          [14, 2],
        ],
        PAL.stone0,
      );
    } else p.thickLine(14, 8, far.x, far.y, 2, PAL.stone0);
    p.ellipse(13, 9, 6, 2, ink);
    head = { x: 20, y: pose === 'flare' ? 6 : 8 };
    p.disc(head.x, head.y, 2, ink);
    if (pose === 'flare') {
      p.tri(8, 10, 2, 12, 5, 15, ink); // the tail fans down to brake
      p.vline(12, 11, 15, PAL.stone1);
      p.vline(15, 11, 15, PAL.stone1);
      p.poly(
        [
          [10, 9],
          [14, 8],
          [17, 1],
          [15, 0],
          [11, 0],
          [7, 1],
          [5, 3],
          [7, 6],
        ],
        ink,
      );
      // three feather notches on the trailing edge (the sky shows between the primaries)
      for (const [x, y] of [
        [8, 1],
        [11, 0],
        [6, 3],
      ] as const)
        p.erase(x, y);
    } else {
      p.tri(8, 9, 2, 7, 2, 11, ink);
      const near: XY = pose === 'up' ? { x: 10, y: 0 } : pose === 'mid' ? { x: 5, y: 6 } : { x: 10, y: 17 };
      p.thickLine(12, 8, near.x, near.y, 2, ink);
    }
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
  // … and a cooler bounce light from the floor on every lower edge, so the ink reads on the dark floor and wall too
  const under: XY[] = [];
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) if (p.get(x, y) === ink && p.get(x, y + 1) === null && p.get(x, y - 1) !== null) under.push({ x, y });
  for (const q of rim) p.set(q.x, q.y, Math.abs(q.x - head.x) <= 2 && q.y <= head.y ? PAL.mist : PAL.stone3);
  for (const q of under) p.set(q.x, q.y, PAL.stone1);
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
  /** the floor of the row it flies over (its shadow) */
  floorY: number;
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
  // its shadow on the floor of the row: a flat dark ellipse that shrinks the higher it flies
  const shadow = new Raster(sc, -20, 0, 13, 3, DEPTH.SHADOW);
  shadow.img.setAlpha(0.45);
  let shadowR = -1;
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
          shadow.destroy();
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
      const h = pl.floorY - foot.y;
      const sr = h > 90 ? 0 : h > 55 ? 3 : h > 25 ? 4 : 5;
      if (sr !== shadowR) {
        shadowR = sr;
        shadow.begin();
        if (sr > 0) shadow.pc.ellipse(6, 1, sr, 1, PAL.night0);
        shadow.end();
      }
      shadow.moveTo(foot.x - 6 - 2, pl.floorY - 1);
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
 * edge a bristle of straw (gold4 / gold3, ragged like a bundle's end); the token's silhouette just under the edge
 * catches a gold RIM LIGHT (gold4 for 2 rows, gold3 for 2 more) on its outer pixels.
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
        if (t === null) continue;
        const d = y - (e + 1);
        const rimmed = d <= 4 && t !== PAL.ink && (to.get(x - 1, y) === null || to.get(x + 1, y) === null || to.get(x - 1, y) === PAL.ink || to.get(x + 1, y) === PAL.ink);
        p.set(x, y, rimmed ? (d <= 2 ? PAL.gold4 : PAL.gold3) : t);
      } else if (y < e) {
        if (f !== null) p.set(x, y, f);
      } else if (t !== null || f !== null) p.set(x, y, t !== null ? (y === e ? PAL.gold4 : PAL.gold3) : PAL.gold2);
    }
  }
  r.end();
}

/** A raster over the decoy (same place, same flip) holding one of its pieces, painted from a build state. */
function pieceRaster(sc: Phaser.Scene, d: Decoy, b: Partial<Build>): Raster {
  const r = new Raster(sc, d.ras.x, d.ras.y, RW, RH, d.ras.img.depth + 0.01);
  r.img.setFlipX(d.flip);
  paintDecoy(r, { ...freshBuild(), stake: false, ...b }, 0);
  return r;
}

/**
 * The coat comes off WHOLE: it lifts off the shoulders and flaps away on the wind (screen direction `wdir`), its
 * sleeves flailing (repainted between arm angles and hem flaps every other frame), and fades out far downwind.
 */
async function shedCoat(sc: Phaser.Scene, d: Decoy, wdir: number): Promise<void> {
  const pose = (k: number): Partial<Build> => ({ coatY: 0, flap: [2, 0, 1, 2][k % 4], arm: [4, 3, 2, 3][k % 4], headY: null, hatY: null });
  const r = pieceRaster(sc, d, pose(0));
  const x0 = r.x;
  const y0 = r.y;
  let last = -1;
  await run(sc, 460, (t, el) => {
    const k = Math.floor(el / 50);
    if (k !== last) {
      last = k;
      paintDecoy(r, { ...freshBuild(), stake: false, ...pose(k) }, 0);
    }
    r.moveTo(R(x0 + wdir * (10 * t + 80 * E.inQuad(t))), R(y0 - 3 - 26 * E.outQuad(t) + Math.sin(el / 45) * 2));
    r.img.setAlpha(t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3);
  });
  r.destroy();
}

/** The hat tipped on its side (17 × 9): 1 = earth1 (crown, shade), 2 = earth2 (brim, lit). */
const HAT_TILT = [
  '..........11.....',
  '.........1111....',
  '........21111....',
  '.......221111....',
  '......22.111.....',
  '....222..........',
  '...22............',
  '.222.............',
  '.................',
];

/** The hat's three tumble poses, drawn on its own small raster (17 × 9; the brim's centre at (8, 6)). */
function paintHat(r: Raster, pose: number): void {
  const p = r.pc;
  r.begin();
  if (pose === 0 || pose === 2) {
    // upright (0) or upside-down (2): brim + crown
    const up = pose === 0 ? -1 : 1;
    p.hline(1, 15, 6, PAL.earth2);
    p.set(15, 6 - up, PAL.earth1);
    for (let k = 1; k <= 4; k++) {
      const hw = k === 4 ? 2 : 3;
      for (let x = 8 - hw; x <= 8 + hw - (k === 4 ? 1 : 0); x++) p.set(x, 6 + up * k, x < 7 ? PAL.earth2 : PAL.earth1);
    }
    if (pose === 0) p.set(12, 3, PAL.gold3);
  } else {
    // tipped on its side: the brim a stepped diagonal (2-px steps), the crown off to the upper right
    p.stamp(HAT_TILT, { '1': PAL.earth1, '2': PAL.earth2 }, 0, 0);
  }
  p.outline(PAL.ink);
  r.end();
}

/** The hat pops off, tumbles once and lands on the ground downwind (a 1-px bounce), sits a moment, then fades. */
async function shedHat(sc: Phaser.Scene, d: Decoy, wdir: number, rnd: () => number): Promise<void> {
  const brim = toWorld(d, HEAD_CX, FY - 30);
  const r = new Raster(sc, brim.x - 8, brim.y - 6, 17, 9, unitDepth(d.floor.y) + 0.6);
  let pose = -1;
  const land = { x: R(brim.x + wdir * (14 + Math.floor(rnd() * 5))), y: d.floor.y + 3 };
  await run(sc, 420, (t) => {
    // up 8 px, then down to the floor (a parabola), drifting downwind
    const x = brim.x + (land.x - brim.x) * t;
    const y = t < 0.3 ? brim.y - 8 * E.outQuad(t / 0.3) : brim.y - 8 + (land.y - (brim.y - 8)) * E.inQuad((t - 0.3) / 0.7);
    const ps = t < 0.25 ? 0 : t < 0.5 ? 1 : t < 0.75 ? 2 : t < 0.92 ? 1 : 0;
    if (ps !== pose) {
      pose = ps;
      paintHat(r, ps);
    }
    r.moveTo(R(x) - 8, R(y) - 6);
  });
  // the bounce
  r.moveTo(land.x - 8, land.y - 7);
  await wait(sc, 50);
  r.moveTo(land.x - 8, land.y - 6);
  await wait(sc, 260);
  await run(sc, 200, (t) => r.img.setAlpha(1 - t));
  r.destroy();
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

  // ---- the wind (straight into the last stake's quiver): straws lift off the ground, then the gust carries bent
  // straw stems (tumbling: their bend flips frame by frame) and slow tufts across the row; a share of the stems ends ON
  // a stake and curls round it (the straw being wound on)
  const left = Math.min(...xs) - 70;
  const right = Math.max(...xs) + 70;
  const up = wdir > 0 ? left : right;
  const rowY = Math.min(...ds.map((d) => d.floor.y));
  const stems = new Stems(sc, left - 10, rowY - 70, right - left + 20, Math.max(...ds.map((d) => d.floor.y)) - rowY + 84, DEPTH.FX - 1);
  for (const d of order)
    for (let k = 0; k < 3; k++) stems.add({ x: d.floor.x + (rnd() - 0.5) * 16, y: d.floor.y, vx: wdir * (20 + rnd() * 30), vy: -30 - rnd() * 30, life: 300 + rnd() * 160, kind: 'stem', ph: k });
  bg(
    at(T.wind).then(() => {
      playV3(wdir > 0 ? 'e_strawWrap' : 'e_strawWrapR', { volume: 0.85, pan: 0 });
      let gusting = true;
      let acc = 0;
      onFrame(sc, (dt) => {
        if (!gusting) return false;
        acc += dt;
        while (acc > 14) {
          acc -= 14;
          const d = order[Math.floor(rnd() * n)];
          const y = d.floor.y - 4 - rnd() * 20;
          const r0 = rnd();
          if (r0 < 0.45) {
            // lands on the stake and winds round it
            stems.add({ x: up - wdir * rnd() * 20, y: y - 8 - rnd() * 10, life: 280 + rnd() * 120, kind: 'stem', ph: Math.floor(rnd() * 4), to: { x: d.floor.x, y: R(d.floor.y - 8 - rnd() * 12) }, curlR: 5 + Math.floor(rnd() * 3), dir: wdir });
          } else if (r0 < 0.85) {
            stems.add({ x: up - wdir * rnd() * 40, y: y - 10, vx: wdir * (200 + rnd() * 120), vy: (rnd() - 0.6) * 30, life: ((right - left) / 260) * 1000, kind: 'stem', ph: Math.floor(rnd() * 4) });
          } else {
            stems.add({ x: up - wdir * rnd() * 30, y: y - 14 - rnd() * 16, vx: wdir * (90 + rnd() * 50), vy: -6 + rnd() * 12, life: 900, kind: 'tuft', ph: Math.floor(rnd() * 4) });
          }
        }
        return true;
      });
      // the gust passes the row in its own direction: the wrap starts at the upwind decoy
      const up2 = wdir > 0 ? order : [...order].reverse();
      return Promise.all(
        up2.map(async (d, r) => {
          await at(T.wind + r * T.wrapGap);
          await run(sc, T.wrapMs, (t, el) => {
            d.b.wrap = E.outQuad(t);
            d.b.twine = Math.floor(el / 36);
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
  // every REAL unit on the field the glide would cross: lift the path over its top with ≥ 6 px clearance (the crow
  // must never fly through a monster's body)
  const decoyUids = new Set(ds.map((d) => d.ev.uid));
  for (const pl of ctx.state.players)
    for (const m of pl.monsters) {
      if (!m || decoyUids.has(m.uid)) continue;
      const u = ctx.unit(m.uid);
      if (!u) continue;
      const top = u.worldPoint('top');
      const foot = u.home;
      const hw = Math.max(10, Math.round(u.art.w * 0.35));
      if (foot.x + hw < xs0 || foot.x - hw > perch.x - 10) continue;
      const clear = top.y - CH + 2 - 6;
      const py = (x: number) => profileY({ profile } as unknown as CrowPlan, x);
      // only when the path at that x would be inside its body (between its top and its feet)
      if (Math.min(py(foot.x - hw), py(foot.x), py(foot.x + hw)) > clear && Math.min(py(foot.x - hw), py(foot.x), py(foot.x + hw)) < foot.y) {
        for (const x of [foot.x - hw, foot.x, foot.x + hw]) profile.push({ x: R(x), y: Math.max(SKY_MIN_Y, R(clear)) });
        profile.sort((a, b) => a.x - b.x);
      }
    }
  const dur = Math.max(T.crowMin, Math.min(T.crowMax, (perch.x - xs0) / 0.5));
  const plan: CrowPlan = { t0: 0, dur, xs: xs0, xp: perch.x, profile, perch, floorY: perchD.floor.y + 2, caw: 0, takeoff: 0 };
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
  // the caws (two recipes, each on its beak mark): the straw shivers on each call
  for (const [k, t] of [
    [0, caw],
    [1, caw + T.caw2],
  ] as const)
    bg(
      at(t).then(() => {
        playV3(k === 0 ? 'e_strawCrow' : 'e_strawCrow2', { volume: 0.9, pan: panAt(perch.x) });
        for (const d of ds) d.b.shiver = 1;
        return wait(sc, k === 0 ? 160 : 110).then(() => {
          for (const d of ds) d.b.shiver = 0;
        });
      }),
    );
  // the spent card leaves during the eyes (gone before the scarecrows wake)
  await at(Math.min(eyeAt[0], caw));
  const gone = s.leave();
  await at(H);

  // ---- COMES ALIVE: the coat flaps off on the wind and the hat tumbles to the ground (whole pieces), then the straw
  // bristles up each scarecrow and re-winds it into the token unit, a gold rim light riding the edge
  ticking = false;
  stopTick();
  playV3('e_strawWake', { volume: 0.9, pan: panAt((Math.min(...xs) + Math.max(...xs)) / 2) });
  const morphs: { d: Decoy; from: PixelCanvas; to: PixelCanvas | null; unit: MonsterUnit | null; top: number; bot: number }[] = [];
  for (const d of ds) {
    // the pieces it sheds
    bg(shedCoat(sc, d, wdir));
    bg(shedHat(sc, d, wdir, rnd));
    // the frame it re-winds from: the straw body and the sack head (eyes dark, arms level, the crow's weight gone)
    d.b.dip = 0;
    d.b.shiver = 0;
    d.b.coatY = null;
    d.b.hatY = null;
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
  const steps = T.morphSteps;
  for (let k = 0; k <= steps; k++) {
    for (const m of morphs) {
      const edge = R(m.bot - ((m.bot - m.top) * E.inOutSine(k / steps)));
      const to = m.to ?? new PixelCanvas(RW, RH);
      paintMorph(m.d.ras, m.from, to, edge);
      // a few straws bristle off the edge on the wind
      if (k > 0 && k < steps)
        for (const side of [-1, 1]) {
          const w = toWorld(m.d, FX + side * (5 + Math.floor(rnd() * 3)), edge);
          stems.add({ x: w.x, y: w.y, vx: wdir * (40 + rnd() * 50) + side * 10, vy: -30 - rnd() * 30, life: 220 + rnd() * 120, kind: 'stem', ph: k + side });
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
  void wait(sc, 420).then(() => stems.destroy());
  chips.release();
  straws.release();
  relax(ctx, 300);
  await gone;
  await Promise.all(stakes);
  // the crow flies on out of the picture on its own; the clock lives until it is gone
  void crow.then(() => clk.dispose());
}

// ================================================================ the wind's straw (bent stems, tumbling)

interface Stem {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life: number;
  kind: 'stem' | 'tuft';
  /** the tumble phase */
  ph: number;
  /** fly to this point (on a stake), then curl round it (radius curlR, the wind's direction dir) */
  to?: XY;
  curlR?: number;
  dir?: number;
  /** internal */
  age?: number;
  x0?: number;
  y0?: number;
}

/** The four bends of a 3-px straw stem (it tumbles through them). */
const STEM_BENDS: readonly (readonly [number, number][])[] = [
  [[0, 0], [1, 0], [2, -1]],
  [[0, 0], [0, -1], [1, -2]],
  [[0, 0], [1, 0], [2, 1]],
  [[0, 0], [1, 1], [1, 2]],
];

/** Straw carried by the wind, drawn on whole pixels on one raster over the row. */
class Stems {
  private readonly ras: Raster;
  private items: Stem[] = [];
  private readonly stop: () => void;
  constructor(sc: Phaser.Scene, x: number, y: number, w: number, h: number, depth: number) {
    this.ras = new Raster(sc, x, y, w, h, depth);
    this.stop = onFrame(sc, (dt) => {
      if (!this.ras.alive) return false;
      this.step(dt);
      return true;
    });
  }
  add(s: Stem): void {
    s.age = 0;
    s.x0 = s.x;
    s.y0 = s.y;
    this.items.push(s);
  }
  get count(): number {
    return this.items.length;
  }
  private step(dt: number): void {
    const p = this.ras.pc;
    this.ras.begin();
    const ox = this.ras.x;
    const oy = this.ras.y;
    this.items = this.items.filter((s) => (s.age = (s.age ?? 0) + dt) < s.life);
    for (const s of this.items) {
      const a = s.age ?? 0;
      const u = a / s.life;
      let x: number;
      let y: number;
      let bend = (s.ph + Math.floor(a / 50)) % 4;
      if (s.to) {
        // fly in (ease-in) for 60 %, then curl round the stake: the front half of a flat ellipse, then gone into it
        const fly = 0.6;
        const dir = s.dir ?? 1;
        const r = s.curlR ?? 5;
        const sx = s.to.x - dir * r;
        if (u < fly) {
          const e = E.inQuad(u / fly);
          x = (s.x0 ?? s.x) + (sx - (s.x0 ?? s.x)) * e;
          y = (s.y0 ?? s.y) + (s.to.y - (s.y0 ?? s.y)) * e + Math.sin(e * Math.PI) * -6;
        } else {
          const k = (u - fly) / (1 - fly);
          x = s.to.x - dir * Math.cos(k * Math.PI * 1.2) * r;
          y = s.to.y + Math.sin(k * Math.PI * 1.2) * 2;
          bend = k < 0.5 ? (dir > 0 ? 2 : 0) : 1;
        }
      } else {
        x = (s.x0 ?? s.x) + (s.vx ?? 0) * (a / 1000);
        y = (s.y0 ?? s.y) + (s.vy ?? 0) * (a / 1000) + Math.sin(a / 90 + s.ph) * (s.kind === 'tuft' ? 2 : 1);
      }
      const px = Math.round(x) - ox;
      const py = Math.round(y) - oy;
      const fade = u > 0.85;
      if (s.kind === 'tuft') {
        p.set(px, py, fade ? PAL.gold2 : PAL.gold4);
        p.set(px + 1, py, PAL.gold3);
        p.set(px, py - 1 + (Math.floor(a / 80) & 1), PAL.gold3);
        if (!fade) p.set(px - 1, py + 1, PAL.gold2);
      } else {
        const b = STEM_BENDS[bend];
        const flip = (s.vx ?? s.dir ?? 1) < 0 ? -1 : 1;
        b.forEach(([dx, dy], i) => {
          if (fade && i === 2) return;
          p.set(px + dx * flip, py + dy, i === 0 ? PAL.gold4 : i === 1 ? PAL.gold3 : PAL.gold2);
        });
      }
    }
    this.ras.end();
  }
  destroy(): void {
    this.stop();
    this.ras.destroy();
  }
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

/**
 * Answering an attack, the kept attack arc is on screen: keep the burst off it (the arc must not cut through the
 * star). Tries the row's centre and steps sideways; picks the candidate farthest from the arc (sampled as the arrow's
 * curve: a quadratic bulging up between its ends).
 */
function clearOfArc(ctx: AnyCtx, burst: XY, ds: Decoy[]): XY {
  const h = ctx.take('attack');
  if (!h) return burst;
  ctx.keep('attack', h);
  if (!isHold(h)) return burst;
  const a = h.from;
  const b = h.to;
  // (vfx/combat attackArrow: control = the midpoint lifted by 2 × clamp(dist × 0.32, 14, 46))
  const hh = Math.max(14, Math.min(46, Math.hypot(b.x - a.x, b.y - a.y) * 0.32));
  const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - hh * 2 };
  const arc: XY[] = [];
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const u = 1 - t;
    arc.push({ x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  const dist = (q: XY) => Math.min(...arc.map((r) => Math.hypot(r.x - q.x, r.y - q.y)));
  if (dist(burst) >= 34) return burst;
  const xs = ds.map((d) => d.floor.x);
  const lo = Math.min(...xs) - 20;
  const hi = Math.max(...xs) + 20;
  let best = burst;
  for (const dx of [-40, 40, -70, 70, -100, 100]) {
    const q = { x: Math.max(lo, Math.min(hi, burst.x + dx)), y: burst.y };
    if (dist(q) > dist(best)) best = q;
  }
  return { x: R(best.x), y: best.y };
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
    // a shorter hold on the word: the orb leaves as the plate wipes out and bursts once it is gone
    const q = await quickReveal(ctx, { hold: -60 });
    const top = { x: q.face.x, y: q.face.y - 28 };
    await signature(any, {
      burst: clearOfArc(any, burst, ds),
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
        await Promise.all([fly, q.word]);
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
