// Saman Korkuluklar (straw_decoys, S9, QUICK spell, strawTokens) — v3 look only (?look=v3); the old look keeps the
// default activation (ctx.base()). Storyboard: docs/v3/YENI_KARTLAR.md §7 S9 — "Boş alanlara yukarıdan ahşap
// kazıklar saplanır (tok) → saman demetleri rüzgarla kazığa sarılır, eski bir ceket ve çuval kafa takılır, kollar
// yana açılır → korkulukların düğme gözleri bir kez yanar; uzaktan bir karga gaklar." (signature 2.6 s)
// Sound identity (§5.1 S9): the long straw rustle, straw + a wooden stake, the stake's "tok" in three pitches and a
// distant crow (src/audio/v3/e/straw_decoys.ts). No "pof" anywhere (R3 owns it).
//
// The decoys are BUILT here: the activation batch carries one `summon {from:'token'}` per decoy (first free zones);
// the scene consumes them, pins each token's card on its tile when the stake stabs it, builds the scarecrow on a
// whole-pixel raster on that zone and, on the frame its button eyes go out, hands over to the field's own token unit
// (FieldView.addUnit → unit.show(): whatever sprite the token has — lane D's rig or the placeholder). The token's
// idle and its tokenVanish are not ours.
//
// Paths
//   hand / own set card (own Main Phase): the common v3 spell opening (spells/_kit spellOpening, keepCard,
//        releaseFrom 'top': the orb leaves the card's top edge for the dusk sky over the empty zones).
//   QUICK ANSWER (a set card in the opponent's attackDeclared / summoned window): the quick-spell reveal
//        (spells/_quick_e.ts: the turquoise zig-zag snap, "HIZLI BÜYÜ!"), then the orb leaves the standing card's
//        top for the sky and the card lies straight back down (standing, it would hide the decoys behind it on the
//        near side); the same signature plays; the spent card leaves from its tile at the end.
//        Answering a DIRECT attack the attacker's controller then picks a decoy (a later batch): the `target` hook
//        plays the LURE — the picked scarecrow shivers and beckons (its own roar pose), a straw tuft flies at the
//        attacker along a dotted gold line, e_strawLure — and the battle carries on into it.
//
// BEAT LIST (scene ms; × 1.35 in game time with the v3 tempo; signature ≈ 2.35 s, storyboard 2.6 s)
//   opening  hand ≈ 230 + hold 150 / set ≈ 180 + hold 150 / quick reveal ≈ 360 — the common v3 opening (≤ 0.7 s)
//   R+0      RELEASE: the orb flies from the card's top to the BURST point over the decoys' row (170 ms, line)
//   S+0      BURST: a gold star in the dusk sky, e_strawGust starts (the wind that will carry the straw); the orb
//            splits into one thin teal streak per empty zone, fanning out (110 ms)
//   S+100 + i·110   STAKE i appears in the sky over its zone as a white silhouette (2 frames) and FALLS point-first
//            (130 ms, ease-in) — e_strawDrop; its speed streaks trail above it
//   S+230 + i·110   STAB (contact): "tok" (e_strawTok1/2/3: three pitches, C6 / E6 / G6 woodblock, cycling), the stake sinks
//            3 px (anticipation → impact → settle), 1-frame white flash, its top WOBBLES ±1 px (3 steps), ink cracks
//            run out on the tile, dirt chips fly, 1 px shake; the token's card appears pinned on the tile (face up,
//            sideways = defense) with a gold tile flash; a warm gold light pool comes on under it; the last stab
//            freezes 40 ms
//   W = after the last stab + 110:
//   W+0      THE WIND: a gust crosses the row left → right — straw strands streak in it and CURL into each stake;
//            e_strawWrap (the long rustle) — each stake (left → right, 70 ms apart) is WOUND with straw from the
//            ground up (300 ms): the bundle grows row by row with a fresh gold4 edge, the twine bites at the waist,
//            loose ends flick; a skirt flares at the foot
//   W+380 + r·80    THE COAT drops on (110 ms from 12 px above), its hem FLAPS twice, then SNAPS tight —
//            e_strawCoat on the snap; the sleeves hang down
//   W+640 + r·80    THE SACK HEAD drops on the stake top (90 ms) with a 1-px squash; the HAT follows 40 ms later
//            and bounces once — e_strawHead
//   W+980    ARMS SPREAD: every scarecrow throws its sleeves out together — four stepped angles (hanging → 45° →
//            15° → 8° over → level), the straw hands fan open at the cuffs — e_strawArms
//   W+1180 + r·90   BUTTON EYES light ONCE: white (2 frames) → gold3 → gold2 → dark again (260 ms), a gold glint
//            of light at the head — e_strawEye (two tiny ticks)
//   W+980    A CROW glides in from the far side of the screen, high over the decoys' row (1100 ms, 20×13 px: wings
//            beating up / mid / down, 70 ms a pose), levels its wings over the middle and caws: e_strawCrow at W+1400
//            ("gaak … gak", far away, its beak opening on both calls); the scarecrows' straw shivers at the caw;
//            it flies on out of the picture after the handoff (nothing waits for it)
//   W+1480   HANDOFF: the built scarecrows flash white for one frame, the token units take their place under a
//            white → gold4 silhouette (two frames; FieldView.addUnit → unit.show(), whatever sprite the token has),
//            a few straws drop off them, their badges pop, the gold pool fades into the token's own light; the spent
//            card has left for the graveyard meanwhile
//   ≈ W+1580 done (the crow flies on in the background; nothing waits for it)
// EDGES — one decoy (one free zone): the same beats, one stake; summoned in answer to a SUMMON: no lure follows;
//   a zone without a tile on screen still gets its decoy (the raster stands on zoneXY).
// P2: everything mirrors with the zones; the scarecrows face left (their raster is flipped about the stake).
// No camera move (tools/measure.mjs --camera-gate), every crisp thing on whole pixels, palette only, seeded rng.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL } from '../../art/palette';
import type { TileCard } from '../../view/TileCard';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import type { LightHandle } from '../../view/light';
import { shake, wait } from '../../vfx/core';
import { Sparks as PxSparks, stopTime } from '../../vfx/combat';
import { E, Raster, floorRing, onFrame, run, seg } from '../../vfx/setpieces';
import { cardLeaves } from '../_v3/card';
import { panAt, play as playV3 } from '../_v3/sound';
import { fxRng } from '../_v3/spellfx';
import { registerCardHook, type CinematicContext } from '../api';
import { GOLD_FX, bg, energyStreak, lightFlash, lightPool, relax, spellOpening, starFlare, type ActCtx } from './_kit';
import { quickReveal } from './_quick_e';
import type { SfxName } from '../../audio/sfx';

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
  /** after the last stab, the wind */
  windAfter: 110,
  wrapGap: 70,
  wrapMs: 300,
  coat: 380,
  coatGap: 80,
  coatDrop: 110,
  head: 640,
  headGap: 80,
  headDrop: 90,
  arms: 980,
  armStep: 45,
  eyes: 1180,
  eyesGap: 90,
  eyeMs: 260,
  crow: 980,
  crowMs: 1100,
  caw: 420,
  handoff: 1480,
});

// ================================================================ the scarecrow (local raster geometry)

/** Raster size and the floor point (the zone's centre) inside it. */
const RW = 64;
const RH = 150;
const FX = 32;
const FY = 140;
/** The stake's top above the floor when planted; how far it falls from. */
const STAKE_TOP = 26;
const SKY = 100;

const TOK: readonly SfxName[] = ['e_strawTok1', 'e_strawTok2', 'e_strawTok3'];

interface Build {
  /** the stake: visible, its offset above the planted pose (≤ 0 = in the air), sink (px into the floor), wobble */
  stake: boolean;
  stakeY: number;
  sink: number;
  wob: number;
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
  /** the button eyes: 0 dark, 1 white, 2 gold3, 3 gold2 */
  eyes: number;
  /** a shiver of the straw (the crow's caw, the lure): px */
  shiver: number;
}

function freshBuild(): Build {
  return { stake: false, stakeY: -SKY, sink: 0, wob: 0, white: false, cracks: 0, streak: 0, wrap: 0, coatY: null, flap: 0, headY: null, hatY: null, squash: 0, arm: 0, eyes: 0, shiver: 0 };
}

/** Sleeve angles (radians, + = down) per arm step: hanging, 45°, 15°, 8° over the level, level (a hair of droop). */
const ARM_ANGLE = [1.25, 0.78, 0.26, -0.14, 0.06];

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
    for (let y = top; y <= bot; y++) {
      // the upper half leans with the wobble
      const dx = y < top + 12 ? b.wob : 0;
      // the point: tapering in the last three rows while it flies
      const fromBot = bot - y;
      const w = !planted && fromBot < 3 ? fromBot + 1 : 3;
      const x0 = FX - 1 + dx + (3 - w > 1 ? 1 : 0);
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
      // the bundle's edge is ragged (a straw sticks out every few rows) and its body runs in vertical strands
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
    // ragged ends below the skirt, flicking with the wind
    if (b.wrap >= 0.2)
      for (const [x, len] of [
        [FX - 5, 2],
        [FX - 2, 3],
        [FX + 1, 2],
        [FX + 4, 3],
      ] as const)
        for (let k = 1; k <= len; k++) p.set(x + (k === len ? sway : 0), yBot + k - 1, C(x < FX ? PAL.gold3 : PAL.gold2));
    // loose straws sticking out of the wound edge while it climbs (both sides)
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
    // a patch on the right chest
    p.set(FX + 2, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 3, FY - 16 + oy, C(PAL.earth2));
    p.set(FX + 2, FY - 15 + oy, C(PAL.earth1));
    p.set(FX + 3, FY - 15 + oy, C(PAL.earth2));
    // sleeves from the shoulders, at the arm step's angle; the straw hands at the cuffs
    const a = ARM_ANGLE[Math.max(0, Math.min(4, b.arm))];
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const L = 8;
    for (const dir of [-1, 1]) {
      const sx = FX + dir * 4;
      const sy = sh + 1;
      for (let d = 0; d <= L; d++) {
        const cx = sx + dir * ca * d;
        const cy = sy + sa * d;
        for (let i = 0; i < 3; i++) {
          // thickness across the sleeve (perpendicular, rounded to whole pixels)
          const px = R(cx - dir * sa * (i - 1) * 0.9);
          const py = R(cy + ca * (i - 1));
          p.set(px, py, C(i === 0 ? (dir < 0 ? PAL.leaf3 : PAL.leaf2) : i === 2 ? PAL.leaf0 : d === L ? PAL.leaf0 : PAL.leaf1));
        }
      }
      // the straw hand: three strands fanning out of the cuff, opening wider as the arm rises
      const hx = sx + dir * ca * (L + 1);
      const hy = sy + sa * (L + 1);
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
        drawLine(p, R(hx), R(hy), R(ex), R(ey), C(tone));
      }
    }
  }
  // ---- the sack head + the hat
  if (b.headY !== null) {
    const oy = R(b.headY);
    const cx = FX + 1;
    const cy = FY - 25 + oy + b.squash;
    const rx = 4 + (b.squash > 0 ? 1 : 0);
    const ry = 4 - b.squash;
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        const dx = (x + 0.5 - cx - 0.5) / (rx + 0.5);
        const dy = (y + 0.5 - cy - 0.5) / (ry + 0.5);
        if (dx * dx + dy * dy > 1) continue;
        const l = dx + dy;
        p.set(x, y, C(l < -0.7 ? PAL.earth4 : l > 0.6 ? PAL.earth2 : PAL.earth3));
      }
    // the neck tie and a straw tuft under it
    p.hline(cx - 2, cx + 1, cy + ry + 1, C(PAL.earth1));
    p.set(cx - 3, cy + ry + 2, C(PAL.gold3));
    p.set(cx + 2, cy + ry + 2, C(PAL.gold2));
    // the stitched mouth (facing right) and the button eyes (dark until they light)
    p.set(cx + 1, cy + 2, C(PAL.earth1));
    p.set(cx + 3, cy + 2, C(PAL.earth1));
    p.set(cx + 2, cy + 2, C(PAL.earth2));
    if (b.eyes === 0) {
      p.set(cx + 1, cy - 1, C(PAL.ink));
      p.set(cx + 3, cy - 1, C(PAL.ink));
    }
  }
  if (b.hatY !== null) {
    const oy = R(b.hatY);
    const cx = FX + 1;
    const brim = FY - 29 + oy;
    for (let x = cx - 6; x <= cx + 6; x++) {
      const drop = x >= cx + 5 ? 1 : 0;
      p.set(x, brim + drop, C(x < cx - 2 ? PAL.earth2 : PAL.earth1));
    }
    for (let y = brim - 4; y < brim; y++) {
      const hw = y === brim - 4 ? 2 : 3;
      for (let x = cx - hw; x <= cx + hw - (y === brim - 4 ? 1 : 0); x++) p.set(x, y, C(x < cx - 1 ? PAL.earth2 : y === brim - 1 ? PAL.earth0 : PAL.earth1));
    }
    // a straw sticking out of the hat band
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
      const len = 2 + (i % 3);
      for (let k = 1; k <= len; k++) p.set(FX + dx * k + (dx > 0 ? 1 : -1), FY + 1 + Math.round(dy * k * 0.5), tone);
    });
  }
  if (b.headY !== null && b.eyes > 0) {
    const cx = FX + 1;
    const cy = FY - 25 + R(b.headY) + b.squash;
    const c = b.eyes === 1 ? PAL.white : b.eyes === 2 ? PAL.gold3 : PAL.gold2;
    p.set(cx + 1, cy - 1, c);
    p.set(cx + 3, cy - 1, c);
    if (b.eyes === 1) {
      // the flash: a tiny cross of light on each button
      for (const ex of [cx + 1, cx + 3]) {
        p.set(ex, cy - 2, PAL.gold4);
        p.set(ex, cy, PAL.gold4);
      }
    }
  }
  r.end();
}

function drawLine(p: Raster['pc'], x0: number, y0: number, x1: number, y1: number, c: number): void {
  p.line(x0, y0, x1, y1, c);
}

// ================================================================ one decoy on the field

interface Decoy {
  ev: SummonEv;
  idx: number;
  floor: XY;
  /** left → right on screen */
  rank: number;
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
  return { ev, idx, floor, rank: 0, ras, b: freshBuild(), pool: null, tile: null };
}

// ================================================================ the crow (high over the far side of the board)

function crowFlight(sc: Phaser.Scene, player: PlayerId, row: XY, seed: number): Promise<void> {
  // it glides over the decoys' row from the far side of the screen toward the other (P1: right → left), high above
  // them, caws over the middle and flies on out
  const dir = player === 0 ? -1 : 1;
  const x0 = row.x - dir * 300;
  const x1 = row.x + dir * 300;
  const rnd = fxRng(seed);
  const ras = new Raster(sc, 0, 0, 20, 13, DEPTH.FX - 6);
  ras.img.setFlipX(dir > 0);
  const T = STRAW_T;
  return run(sc, T.crowMs, (t, el) => {
    const x = R(x0 + (x1 - x0) * t);
    const y = R(row.y - 10 * Math.sin(t * Math.PI) + Math.sin(el / 90) * 1.5 + rnd() * 0.3);
    ras.moveTo(x - 10, y - 6);
    // wing beat: up, mid, down, mid (70 ms a pose); a glide (wings level) through the caw
    const caw = el > T.caw && el < T.caw + 140;
    const pose = caw ? 1 : [0, 1, 2, 1][Math.floor(el / 70) % 4];
    const beak = caw || (el > T.caw + 330 && el < T.caw + 420);
    ras.draw((g) => {
      const p = g.pc;
      // the far wing (behind the body, darker)
      const far: [number, number] = pose === 0 ? [12, 0] : pose === 1 ? [16, 4] : [13, 12];
      p.thickLine(10, 6, far[0], far[1], 2, PAL.ink);
      // body (facing left), head, tail fan
      p.ellipse(10, 7, 4, 2, PAL.ink);
      p.disc(5, 6, 2, PAL.ink);
      p.hline(8, 12, 5, PAL.night2); // the light on its back
      p.tri(13, 7, 18, 5, 18, 9, PAL.ink);
      p.set(18, 6, PAL.night3);
      // beak (opens on the caw) and an eye glint
      if (beak) {
        p.set(3, 5, PAL.stone2);
        p.set(2, 4, PAL.stone2);
        p.set(3, 7, PAL.stone2);
        p.set(2, 7, PAL.stone1);
      } else {
        p.set(3, 6, PAL.stone2);
        p.set(2, 6, PAL.stone2);
        p.set(1, 7, PAL.stone1);
      }
      p.set(4, 5, PAL.mist);
      // the near wing (over the body), its leading edge catching the light
      const near: [number, number] = pose === 0 ? [7, 0] : pose === 1 ? [4, 3] : [7, 12];
      p.thickLine(9, 6, near[0], near[1], 2, PAL.ink);
      p.line(9, 5, near[0], near[1] - (pose === 2 ? 0 : 1), PAL.night3);
    });
  }).then(() => ras.destroy());
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
  const rnd = fxRng(9191 + s.uid * 13);
  // ---- the build ticker: every raster repaints each frame from its state
  let ticking = true;
  const stopTick = onFrame(sc, (_dt, el) => {
    if (!ticking) return false;
    for (const d of ds) if (d.ras.alive) paintDecoy(d.ras, d.b, el);
    return true;
  });
  const chips = new PxSparks(sc, DEPTH.FX - 2);
  const straws = new PxSparks(sc, DEPTH.FX - 1);

  // ---- release → burst
  await s.release(s.burst);
  playV3('e_strawGust', { volume: 0.8, pan: panAt(s.burst.x) });
  bg(starFlare(sc, s.burst, 200, GOLD_FX, 18));
  void lightFlash(sc, s.burst.x, s.burst.y, PAL.gold3, 30, 300, { floorY: Math.max(...ds.map((d) => d.floor.y)), air: 0.7, intensity: 0.7 });

  // ---- the stakes
  const stakes = ds.map(async (d, i) => {
    const sky: XY = { x: d.floor.x, y: d.floor.y - STAKE_TOP - SKY };
    bg(energyStreak(sc, s.burst, sky, { path: 'line', ms: T.fan, size: 1, light: false }));
    await wait(sc, T.stake0 + i * T.stakeGap);
    const b = d.b;
    const pan = panAt(d.floor.x);
    // materialise in the sky: a white silhouette for two frames, then wood
    b.stake = true;
    b.stakeY = -SKY;
    b.white = true;
    void wait(sc, 34).then(() => (b.white = false));
    playV3('e_strawDrop', { volume: 0.6, pan });
    await run(sc, T.fall, (t) => {
      const e = E.inQuad(t);
      b.stakeY = -SKY * (1 - e);
      b.streak = Math.round(4 + 12 * e);
    });
    // STAB
    b.stakeY = 0;
    b.streak = 0;
    b.sink = 1;
    b.white = true;
    b.cracks = 1;
    playV3(TOK[i % 3], { volume: 0.9, pan });
    void shake(sc, 90, 1);
    // the token's card is pinned on the tile by the stake
    if (!field.tileOf(d.ev.uid)) {
      d.tile = field.placeCard(d.ev.player, 'monster', d.ev.zone, d.ev.uid, TOKEN, true, 'side');
      d.tile.tileFlash(PAL.gold3, 280);
    }
    void lightFlash(sc, d.floor.x, d.floor.y, PAL.gold3, 22, 240, { floorY: d.floor.y, intensity: 0.8 });
    d.pool = lightPool(sc, d.floor.x, d.floor.y - 10, { color: PAL.gold2, radius: 18, floorY: d.floor.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
    d.pool.setIntensity(0.5, 200);
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + (k / 8) * Math.PI + (rnd() - 0.5) * 0.3;
      chips.add({ x: d.floor.x + R(Math.cos(a) * 2), y: d.floor.y, vx: Math.cos(a) * (30 + rnd() * 50), vy: -40 - rnd() * 70, ay: 420, floor: d.floor.y + 3, bounce: 0.3, life: 300 + rnd() * 200, colors: k % 3 ? [PAL.earth2, PAL.earth1] : [PAL.earth3, PAL.earth2], shape: 'px', fadeAt: 0.8 });
    }
    if (i === ds.length - 1) await stopTime(sc, 40);
    await wait(sc, 34);
    b.white = false;
    b.sink = 2;
    // follow-through: the stake's top quivers and settles; the cracks darken out
    for (const w of [1, -1, 1, 0]) {
      b.wob = w;
      await wait(sc, 34);
    }
    b.sink = 0;
    b.cracks = 2;
    void wait(sc, 260).then(() => (b.cracks = 0));
  });
  await Promise.all(stakes);
  await wait(sc, T.windAfter);

  // ---- W: the wind winds the straw on
  const W0 = sc.time.now;
  const order = [...ds].sort((a, b) => a.floor.x - b.floor.x);
  order.forEach((d, r) => (d.rank = r));
  const xs = order.map((d) => d.floor.x);
  const left = Math.min(...xs) - 60;
  const right = Math.max(...xs) + 60;
  playV3('e_strawWrap', { volume: 0.85, pan: 0 });
  // the gust: straw strands streaking left → right; some curl into a stake
  let gusting = true;
  const gust = onFrame(sc, (dt) => {
    if (!gusting) return false;
    const n = dt / 9;
    for (let k = 0; k < n; k++) {
      const d = order[Math.floor(rnd() * order.length)];
      const y = d.floor.y - 4 - rnd() * 22;
      if (rnd() < 0.45) {
        straws.add({ x: left + rnd() * 30, y, tx: d.floor.x + (rnd() - 0.5) * 6, ty: d.floor.y - 6 - rnd() * 14, curl: 1.1 + rnd() * 0.6, life: 260 + rnd() * 140, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.02, fadeAt: 0.9 });
      } else {
        straws.add({ x: left + rnd() * 40, y: y - 6, vx: 280 + rnd() * 160, vy: (rnd() - 0.5) * 20, life: (right - left) / 380 * 1000, colors: rnd() < 0.3 ? [PAL.earth4, PAL.gold3] : [PAL.gold3, PAL.gold2, PAL.gold1], shape: rnd() < 0.5 ? 'streak' : 'px', len: 0.03, fadeAt: 0.8 });
      }
    }
    return true;
  });
  const wraps = order.map(async (d, r) => {
    await wait(sc, r * T.wrapGap);
    await run(sc, T.wrapMs, (t) => {
      d.b.wrap = Math.ceil(E.outQuad(t) * 9) / 9;
    });
    d.b.wrap = 1;
  });
  bg(Promise.all(wraps).then(() => wait(sc, 80)).then(() => (gusting = false)));
  void gust;

  // ---- the coats (drop, flap, SNAP)
  const coats = order.map(async (d, r) => {
    await waitUntil(sc, W0 + T.coat + r * T.coatGap);
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
  });
  // ---- the heads + hats
  const heads = order.map(async (d, r) => {
    await waitUntil(sc, W0 + T.head + r * T.headGap);
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
  });
  await Promise.all([...coats, ...heads]);
  // ---- the crow sets off (it arrives over the row by the time the eyes light)
  const rowTop = Math.min(...ds.map((d) => d.floor.y));
  const crow = waitUntil(sc, W0 + T.crow).then(() => crowFlight(sc, s.player, { x: R(xs.reduce((a, b) => a + b, 0) / xs.length), y: rowTop - 62 }, 77 + s.uid));
  // ---- ARMS SPREAD (all together)
  await waitUntil(sc, W0 + T.arms);
  playV3('e_strawArms', { volume: 0.85, pan: 0 });
  for (const step of [1, 2, 3, 4]) {
    for (const d of ds) d.b.arm = step;
    await wait(sc, T.armStep);
  }
  // ---- the eyes light once; the crow caws
  bg(waitUntil(sc, W0 + T.crow + T.caw).then(() => {
    playV3('e_strawCrow', { volume: 0.7, pan: s.player === 0 ? 0.25 : -0.25 });
    for (const d of ds) d.b.shiver = 1;
    return wait(sc, 160).then(() => {
      for (const d of ds) d.b.shiver = 0;
    });
  }));
  const eyes = order.map(async (d, r) => {
    await waitUntil(sc, W0 + T.eyes + r * T.eyesGap);
    const b = d.b;
    const head = { x: d.floor.x + (d.ev.player === 1 ? -2 : 2), y: d.floor.y - 26 };
    playV3('e_strawEye', { volume: 0.7, pan: panAt(d.floor.x) });
    void lightFlash(sc, head.x, head.y, PAL.gold3, 14, 260, { floorY: d.floor.y, air: 0.8, intensity: 0.8 });
    for (const [e, ms] of [
      [1, 34],
      [2, 80],
      [3, 80],
    ] as const) {
      b.eyes = e;
      await wait(sc, ms);
    }
    b.eyes = 0;
  });
  await Promise.all(eyes);
  // the spent card leaves while the scarecrows take their stand
  const gone = s.leave();
  await waitUntil(sc, W0 + T.handoff);

  // ---- HANDOFF to the field's token units: the built scarecrow flashes white for a frame, the token unit takes its
  // place under a white → gold4 silhouette (two frames), a few straws drop off it — the decoy has come alive
  ticking = false;
  stopTick();
  for (const d of ds) {
    d.b.white = true;
    paintDecoy(d.ras, d.b, 0);
  }
  await wait(sc, 34);
  const overlays: Phaser.GameObjects.Image[] = [];
  for (const d of ds) {
    ctx.consumeAt(d.idx);
    if (!field.tileOf(d.ev.uid)) field.placeCard(d.ev.player, 'monster', d.ev.zone, d.ev.uid, TOKEN, true, 'side');
    const unit = field.addUnit(d.ev.uid, { hidden: true, atk: 0, def: 0, position: 'defense' });
    d.ras.destroy();
    if (unit) {
      unit.show();
      unit.rest();
      const sp = unit.sprite;
      overlays.push(sc.add.image(sp.x, sp.y, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setFlipX(sp.flipX).setDepth(sp.depth + 0.1).setTintFill(PAL.white));
      bg(unit.badge.pop());
      const c = unit.core();
      for (let k = 0; k < 6; k++)
        chips.add({ x: R(c.x + (rnd() - 0.5) * 10), y: R(c.y + (rnd() - 0.5) * 8), vx: (rnd() - 0.5) * 40, vy: -20 - rnd() * 30, ay: 260, floor: d.floor.y + 2, bounce: 0.2, life: 380 + rnd() * 200, colors: [PAL.gold3, PAL.gold2, PAL.gold1], shape: 'px', fadeAt: 0.8 });
    }
    void lightFlash(sc, d.floor.x, d.floor.y - 12, PAL.gold3, 20, 260, { floorY: d.floor.y, air: 0.6, intensity: 0.7 });
    void d.pool?.fadeOut(300);
  }
  await wait(sc, 34);
  for (const o of overlays) o.setTintFill(PAL.gold4);
  await wait(sc, 34);
  for (const o of overlays) o.destroy();
  chips.release();
  straws.release();
  relax(ctx, 300);
  await gone;
  void crow;
}

/** Wait until the scene clock reaches `at` (ms, scene time). */
function waitUntil(sc: Phaser.Scene, at: number): Promise<void> {
  const ms = at - sc.time.now;
  return ms > 0 ? wait(sc, ms) : Promise.resolve();
}

/** The sky point the orb bursts at: over the decoys' row. */
function burstOver(ds: Decoy[]): XY {
  const xs = ds.map((d) => d.floor.x);
  const ys = ds.map((d) => d.floor.y);
  return { x: R((Math.min(...xs) + Math.max(...xs)) / 2), y: R(Math.min(...ys) - STAKE_TOP - SKY - 26) };
}

// ================================================================ hooks

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  // this activation's decoys (summon from:'token') and the card's own trip to the graveyard
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
    // the quick answer: the reveal, then the orb leaves the standing card's top
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
        // spent, the card lies back down on its tile at once (standing, it would hide the decoys behind it)
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

/** The attacker's pick (answering a direct attack): the chosen scarecrow beckons; the battle then plays into it. */
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
  playV3('e_strawLure', { volume: 0.85, pan });
  // the decoy beckons: its own taunt pose (roar), a gold tile flash, a warm glint
  bg(unit.tryPlay('roar') || Promise.resolve());
  tile?.tileFlash(PAL.gold3, 260);
  bg(floorRing(sc, R(at.x), R(at.y), { r0: 4, r1: 30, ms: 320, ramp: [...GOLD_FX], depth: DEPTH.SHADOW - 1 }));
  void lightFlash(sc, at.x, head.y + 4, PAL.gold3, 18, 320, { floorY: at.y, air: 0.8, intensity: 0.8 });
  // a straw tuft flies off it at the attacker along a dotted gold line (the attention pulled over)
  const from = { x: R(head.x), y: R(head.y + 8) };
  const to = attacker ? attacker.core() : { x: from.x, y: from.y + (ref.player === 0 ? -60 : 60) };
  const dots = Raster.around(sc, (from.x + to.x) / 2, (from.y + to.y) / 2, Math.abs(to.x - from.x) + 20, Math.abs(to.y - from.y) + 20, DEPTH.FX + 2);
  const tuft = new PxSparks(sc, DEPTH.FX + 3);
  for (let k = 0; k < 6; k++) tuft.add({ x: from.x, y: from.y, tx: R(to.x + (rnd() - 0.5) * 8), ty: R(to.y + (rnd() - 0.5) * 6), curl: (rnd() - 0.5) * 0.8, life: 260 + k * 30, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'streak', len: 0.02, fadeAt: 0.85 });
  tuft.release();
  await run(sc, 360, (t) => {
    const grow = seg(t, 0, 0.5);
    const fade = seg(t, 0.6, 1);
    dots.draw((g) => {
      const n = Math.floor(Math.hypot(to.x - from.x, to.y - from.y) / 5);
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        if (u > grow || u < fade) continue;
        const x = from.x + (to.x - from.x) * u;
        const y = from.y + (to.y - from.y) * u;
        g.px(x, y, k % 2 ? PAL.gold3 : PAL.gold2);
      }
    });
  });
  dots.destroy();
  unit.rest();
});
