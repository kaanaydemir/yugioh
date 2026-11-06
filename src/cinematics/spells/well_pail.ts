// Kuyu Kovası (well_pail) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S1; lane E). The v1 look keeps the generic
// spell activation and the plain draws: the hook steps aside without ?look=v3.
//
// "Oyuncunun tarafında (zemin açılmadan, karonun üstüne) taştan küçük bir kuyu bileziği ve ahşap çıkrık belirir →
//  çıkrık kolu kendiliğinden döner, ip sarılır (cırcır) → ağzına kadar ışıklı su dolu bir kova yükselir, kenarından su
//  taşar → kova eğilir, sudan iki kart balık gibi sıçrayıp ele uçar (ikincisi suyu silkeler) → kova geri iner, çıkrık
//  son bir tur atar, kuyu turkuaz zerrelere çözülür. Yüz, testi, çömlek yok."
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo).
//   0      common v3 spell opening (spells/_kit): a hand card flies beside its owner (a set card stands up on its own
//          tile), "KUYU KOVASI" plate, short hover
//   ~400   RELEASE: the card pours into an orb at its bottom edge that hops onto the well's tile, chosen by CLEAR AIR
//          (wellSpot): the set card's own tile unless a unit stands in front of it or its windlass would really cover a
//          sprite; else the caster's free spell/trap tile that scores best on distance + the room its two leaps have
//          (units' opaque sprite boxes, duelists, portrait screens and HUD panels are measured, not guessed)
//   W+0    LAND: a teal ring runs out on the tile, a rune ellipse flashes for two frames, the light pool comes on
//   W+30   THE STONE RING builds itself in three courses, each course popping a stone grit — e_wellStone ×3
//   W+170  THE WINDLASS: two wooden posts shoot up, the axle with its rope drum drops into the forks — e_wellFrame.
//          The crank always sits on the side that faces the board's centre (P2's well is mirrored)
//   W+280  THE CRANK turns by itself: 2 turns in 16 stepped angles, slow → fast; the rope coils scroll round the
//          drum, the bucket climbs the shaft; the light pool swells and widens with the speed — e_wellClick on EVERY
//          step (the first and last teeth ring out), e_wellRope at the first steps
//   ~W+560 the bucket BREAKS THE SURFACE: a crown of water flares out of the mouth, caustic light runs out over the
//          neighbouring tiles — e_wellSlosh
//   W+720  the crank stops: the pawl catches — e_wellCatch; the bucket hangs under the drum, swinging, BRIMMING with
//          glowing water; the overflow POURS over the lips: sheets that leave the lip sideways, thin out and break into
//          falling segments and drops (the gaps run down), a sliding highlight, a splash on the rim; the low lip pours,
//          the high lip stops — e_wellSpill (the card's separating layer: a trickle with drips knocking the staves)
//   W+870  the bucket TIPS toward the caster's hand (three stepped angles) — e_wellTip (the bail creaks)
//   W+960  LEAP 1: a card BURSTS STRAIGHT UP out of the water (100 ms, a splash column), flicks its tail (a 1-px body
//          bend, stepped ±π/16 roll) up to its apex, bends into a C there, then falls into the hand rolling ±π/16 for
//          85 % of the way, growing through native sizes (6×8 → 48×68, never scaled), and FLOPS into the slot (2 px
//          low, then settles) — e_wellLeap ("şlap-gloop-fwip"). At the slot the card IS the hand's card (same 48×68
//          back): the hand only turns it face-up — e_wellTap. No generic draw flight, no cardDraw / cardPlace.
//   W+1160 LEAP 2: the second fish leaps higher and to the other side; its apex is planned in CLEAR SPACE (planLeap:
//          a grid of apexes scored against every obstacle box, padded for the idle animations) and there it SHAKES
//          THE WATER OFF — eight hard jerks (±7 px, ±2·π/16 roll, the tail lagging), a wide sheet of droplets thrown
//          sideways on the first two reversals, rings after — e_wellShake (a wet paper rattle); then it falls into the
//          hand — e_wellTap. A unit a path still crosses is dimmed while the cards fly.
//   after  the bucket tips back — e_wellTip (soft); as soon as leap 2 has shaken itself dry the bucket DROPS: the
//          ratchet freewheels, the bucket PLOPS — e_wellDown; the spent card rises out of the well's mouth and goes to
//          the graveyard; the crank's LAST TURN (e_wellClick × 7, e_wellLast) — the well DISSOLVES from the top down into
//          rising teal motes from its 5th tooth on — e_wellFade
// THE OTHER PLAYER'S HAND on screen (vsBot, the bot casts): the cards grow only to 14×20 and shrink into the 9×13 mini
// hand, which counts them in (no second flight).
// EDGE — the first draw completes the five seals: no second draw; as soon as the seal lands the bucket drops and the
// well dissolves at once (≈ 300 ms, no last turn) so the win follows the seal card's arrival.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { PlayerId, Uid } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { cardBackCanvas } from '../../art/cards';
import { PixelCanvas } from '../../art/pixel';
import { BOARD_CENTER, BOARD_COLS, BOARD_ROWS, DEPTH, LOOK_V3, UI, type XY, duelistXY, screenToIso, sideOfRow, unitDepth, zoneXY } from '../../view/layout';
import { HOLOS, SCREENS } from '../../view/board-nt/layout-nt';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { tween, wait } from '../../vfx/core';
import { fxRng } from '../_v3/spellfx';
import { hush, panAt, play as playV3, start as startV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { registerCardHook } from '../api';
import { bg, castFloor, castSpot, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx } from './_kit';
import type { SfxName } from '../../audio/sfx';

const ID: CardId = 'well_pail';
const WELL_DEBUG = typeof location !== 'undefined' && location.search.includes('welldbg');
const R = Math.round;
const TAU = Math.PI * 2;

// ================================================================ timings (scene ms from the orb's landing)

export const WELL_T = Object.freeze({
  courses: [30, 80, 130] as readonly number[],
  posts: [170, 195] as readonly number[],
  axleFall: 225,
  axleLand: 250,
  crank: 280,
  /** The crank's step gaps (ms): 16 steps = 2 turns, slow → fast. */
  crankSteps: [46, 42, 38, 35, 32, 29, 27, 25, 23, 22, 21, 20, 20, 19, 19, 19] as readonly number[],
  swingMs: 150,
  tipStepMs: 30,
  /** Leap flight (ms) = clamp(base + distance × perPx, min, max). */
  leapBase: 260,
  leapPerPx: 0.95,
  leapMin: 420,
  leapMax: 640,
  leapGap: 220,
  /** The shake at the top of the second card's arc: one jerk per step. */
  shakeStepMs: 30,
  /** The hand registers the card this long before the leap lands (its hidden flight never completes). */
  handLead: 240,
  tipBackAfter: 150,
  dropMs: 220,
  lastStepMs: 18,
  fadeMs: 300,
  /** Seal edge: the bucket drop and the dissolve run together. */
  sealTearMs: 300,
});

// ================================================================ geometry (well-local pixels)

/** The well's raster: W × H, the floor centre (tile centre) at (CX, CY). */
const W = 96;
const H = 100;
const CX = 48;
const CY = 84;
/** Ring: outer / inner half axes, the wall's full height (three 3-px courses). */
const RX = 17;
const RY = 8;
const RXI = 13;
const RYI = 6;
const WALL = 9;
/** The axle's middle row, the posts' first columns. */
const AY = CY - 40;
const POST_L = CX - 22;
const POST_R = CX + 20;
/** The bucket's bail top (pivot) when it hangs under the drum; deep in the shaft (hidden). */
const HANG = AY + 6;
const DEEP = CY + 10;
const CRANK_OFF = 25;
const CRANK_LEN = 10;

const ellY = (x: number, rx: number, ry: number): number => ry * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx)));

// ================================================================ the well's state (drawn every frame)

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Splash {
  x: number;
  y: number;
  born: number;
  /** 0: in the shaft's water, 1: on the stones, 2: on the floor */
  on: 0 | 1 | 2;
}

interface WellState {
  /** wall height 0..WALL */
  wall: number;
  /** post height 0..1 (stepped) */
  posts: number;
  axle: boolean;
  axleDy: number;
  /** crank angle (radians, stepped) and the drum's coil phase */
  crank: number;
  drum: number;
  /** +1: the crank on the right end of the axle, −1: on the left (faces the board's centre) */
  side: 1 | -1;
  /** bucket pivot (bail top) y in local px */
  bucketY: number;
  /** bucket tilt (radians, stepped) */
  tilt: number;
  brim: boolean;
  spill: boolean;
  /** shaft glimmer level 0..3, ripples (birth ms) */
  glow: number;
  ripples: number[];
  /** the breach flare's birth (ms), −1: none */
  flare: number;
  drops: Drop[];
  splashes: Splash[];
  /** dissolve cut row (local; rows above are gone), −1: whole */
  cut: number;
  /** the dissolve's end (well clock, ms): no mote outlives it by more than a frame or two */
  fadeEnd: number;
  el: number;
}

// ---------------------------------------------------------------- painting helpers (local px, PixelCanvas)

function inEll(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** The ring's back half: the far rim surface, the shaft's inner wall band and its dark mouth with the water glimmer. */
function paintBack(p: PixelCanvas, s: WellState): void {
  const h = R(s.wall);
  if (h <= 0) return;
  const ty = CY - h;
  for (let y = ty - RY - 1; y <= ty + RY + 1; y++)
    for (let x = CX - RX - 1; x <= CX + RX + 1; x++) {
      if (!inEll(x, y, CX, ty, RX, RY)) continue;
      if (!inEll(x, y, CX, ty, RXI, RYI)) {
        if (y + 0.5 > ty) continue; // the front half of the rim is the front layer's
        const edge = !inEll(x, y - 1, CX, ty, RX, RY);
        // stone joints on the far rim (every 5th column), the lit top-left edge
        const joint = (x - CX + 40) % 5 === 0 && !edge;
        p.set(x, y, edge && x < CX + 5 ? PAL.stone4 : joint ? PAL.stone2 : PAL.stone3);
        continue;
      }
      const fromBack = y - (ty - RYI);
      if (fromBack < 2 && h >= 6) p.set(x, y, (x + (fromBack === 0 ? 0 : 3)) % 6 === 0 ? PAL.stone0 : PAL.stone1);
      else p.set(x, y, PAL.night0);
    }
  if (s.glow <= 0) return;
  // the water far below: an ellipse of teal, brighter with `glow`, glints walking over it
  const wy = ty + 2;
  const base = [PAL.teal0, PAL.teal0, PAL.teal1, PAL.teal2][Math.min(3, R(s.glow))];
  const mid = [PAL.teal0, PAL.teal1, PAL.teal2, PAL.teal3][Math.min(3, R(s.glow))];
  for (let y = wy - 3; y <= wy + 3; y++)
    for (let x = CX - 9; x <= CX + 9; x++) {
      if (!inEll(x, y, CX, wy, 9, 2.6) || !inEll(x, y, CX, ty, RXI, RYI)) continue;
      p.set(x, y, inEll(x, y, CX, wy, 5, 1.4) ? mid : base);
    }
  const ph = Math.floor(s.el / 90);
  [-6, -2, 3, 6].forEach((gx, i) => {
    if ((ph + i) % 3 === 0 || s.glow < 1) return;
    p.set(CX + gx, wy - 1 + ((i + ph) % 2), s.glow >= 2 ? PAL.teal4 : PAL.teal3);
  });
  // ripples where drops fall back in
  for (const born of s.ripples) {
    const age = s.el - born;
    if (age < 0 || age > 280) continue;
    const r = 1 + Math.floor(age / 50);
    const tone = age < 120 ? PAL.teal4 : PAL.teal3;
    for (let a = 0; a < TAU; a += 0.3) {
      const x = R(CX + Math.cos(a) * r * 1.9);
      const y = R(wy + Math.sin(a) * r * 0.5);
      if (inEll(x, y, CX, ty, RXI, RYI) && y >= ty - RYI + 2) p.set(x, y, tone);
    }
  }
}

/** The ring's front half: the near rim surface (lit lip) and the coursed stone wall under it. */
function paintFront(p: PixelCanvas, s: WellState): void {
  const h = R(s.wall);
  if (h <= 0) return;
  const ty = CY - h;
  for (let x = CX - RX; x <= CX + RX; x++) {
    const dx = x + 0.5 - CX;
    const yTop = Math.floor(ty + ellY(dx, RX, RY));
    const yIn = Math.floor(ty + ellY(dx, RXI, RYI));
    const yBot = Math.floor(CY + ellY(dx, RX, RY));
    for (let y = Math.abs(dx) < RXI ? yIn + 1 : Math.floor(ty); y <= yTop; y++) {
      // the cap stones: a joint every 6 columns, the lit lip on the left
      const joint = (x - CX + 42) % 6 === 0 && y < yTop;
      p.set(x, y, y === yTop && dx < 5 ? PAL.stone4 : joint ? PAL.stone2 : PAL.stone3);
    }
    const side = dx < -RX * 0.35 ? 0 : dx > RX * 0.45 ? 2 : 1;
    const face = [PAL.stone3, PAL.stone2, PAL.stone1][side];
    const mortar = [PAL.stone2, PAL.stone1, PAL.stone0][side];
    for (let y = yTop + 1; y <= yBot; y++) {
      const r = yBot - y;
      const k = Math.floor(r / 3);
      const joint = (x - CX + RX + (k % 2) * 3) % 6 === 0;
      p.set(x, y, r % 3 === 2 || joint ? mortar : face);
    }
  }
  if (h >= WALL) {
    for (const [mx, my] of [
      [-13, -1],
      [-12, -1],
      [-7, 0],
      [9, 0],
      [10, -1],
    ] as const) {
      const x = CX + mx;
      const y = Math.floor(CY + ellY(mx + 0.5, RX, RY)) + my - 1;
      p.set(x, y, mx < 0 ? PAL.leaf2 : PAL.leaf1);
    }
  }
}

/** The windlass: two posts (forked tops), the axle with its rope drum, the crank on `s.side`'s end. */
function paintFrame(p: PixelCanvas, s: WellState): void {
  if (s.posts <= 0) return;
  const top = CY - 1 - R((CY - 1 - (AY - 1)) * s.posts);
  for (const px0 of [POST_L, POST_R]) {
    for (let y = top; y <= CY - 1; y++) {
      const notch = y === top && s.posts >= 1;
      for (let c = 0; c < 3; c++) {
        if (notch && c === 1) continue;
        let col = [PAL.earth3, PAL.earth2, PAL.earth1][c];
        if (c === 1 && (y === top + 9 || y === top + 23)) col = PAL.earth1;
        p.set(px0 + c, y, col);
      }
    }
  }
  if (!s.axle) return;
  const ay = AY - R(s.axleDy);
  const hub = CX + s.side * CRANK_OFF;
  const x0 = Math.min(POST_L - 1, hub);
  const x1 = Math.max(POST_R + 3, hub);
  for (let x = x0; x <= x1; x++) {
    p.set(x, ay - 1, PAL.earth3);
    p.set(x, ay, PAL.earth2);
    p.set(x, ay + 1, PAL.earth1);
  }
  // the drum: rope coils (diagonal hemp strands) that scroll as it winds
  for (let y = ay - 4; y <= ay + 4; y++)
    for (let x = CX - 8; x <= CX + 8; x++) {
      if ((x === CX - 8 || x === CX + 8) && Math.abs(y - ay) === 4) continue;
      const k = (((x - CX + y + Math.floor(s.drum)) % 3) + 3) % 3;
      p.set(x, y, k === 0 ? PAL.earth4 : k === 1 ? PAL.earth3 : PAL.earth2);
    }
  for (let y = ay - 4; y <= ay + 4; y++) {
    p.set(CX - 9, y, y === ay - 4 ? PAL.stone4 : PAL.stone2);
    p.set(CX + 9, y, PAL.stone1);
  }
  // the crank: a 10-px arm from the hub turning in the axle's plane (seen almost edge-on), a handle knob at its end
  const a = s.crank;
  const ex = hub + s.side * R(Math.sin(a) * 4);
  const ey = ay - R(Math.cos(a) * CRANK_LEN);
  p.thickLine(hub, ay, ex, ey, 2, PAL.earth2);
  p.rect(hub - 1, ay - 1, 3, 3, PAL.stone2);
  p.set(hub - 1, ay - 1, PAL.stone4);
  // the handle sticks out toward the viewer on the crank's side: a 4-px peg with a round lit knob
  const hx = s.side > 0 ? ex + 1 : ex - 4;
  p.rect(hx, ey - 1, 4, 2, PAL.earth3);
  const kx = s.side > 0 ? ex + 4 : ex - 5;
  p.rect(kx, ey - 2, 2, 4, PAL.earth4);
  p.set(kx, ey - 2, PAL.white);
}

/** Tilted-bucket shape test: local (u, v) from the pivot (bail top), v down. Returns a colour or null. */
function bucketPx(u: number, v: number): number | null {
  if (v < 4 || v >= 17) return null;
  const hw = 8.5 - (v - 5) * 0.17;
  if (Math.abs(u) > hw) return null;
  if (v < 5) {
    if (Math.abs(u) > hw - 1.5) return PAL.earth3;
    return PAL.water3;
  }
  if ((v >= 6 && v < 7) || (v >= 14 && v < 15)) return u < -3 ? PAL.stone3 : u > 4 ? PAL.stone1 : PAL.stone2;
  if (u < -5.5) return PAL.earth3;
  if (u > 5.5) return PAL.earth1;
  if (Math.abs(u + 1.8) < 0.5 || Math.abs(u - 2.6) < 0.5) return PAL.earth1;
  if (u < -2.5 && v > 8 && v < 12) return PAL.earth3;
  return PAL.earth2;
}

function bucketAt(s: WellState, u: number, v: number): XY {
  const c = Math.cos(s.tilt);
  const n = Math.sin(s.tilt);
  return { x: CX + u * c - v * n, y: s.bucketY + u * n + v * c };
}

/** Bucket body (clipped at the mouth's front edge), outlined by the caller. */
function paintBucket(p: PixelCanvas, s: WellState): void {
  const ty = CY - R(s.wall);
  const c = Math.cos(s.tilt);
  const n = Math.sin(s.tilt);
  const by = s.bucketY;
  for (let y = by - 2; y <= by + 20; y++)
    for (let x = CX - 15; x <= CX + 15; x++) {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - by;
      const u = dx * c + dy * n;
      const v = -dx * n + dy * c;
      const col = bucketPx(u, v);
      if (col === null) continue;
      if (Math.abs(dx) <= RX && y + 0.5 > ty + ellY(dx, RXI, RYI)) continue;
      p.set(x, y, col);
    }
}

/** The light that is never outlined: rope, bail, the brimming dome and glints, the 2-px spilling streams. */
function paintBucketLight(p: PixelCanvas, s: WellState): void {
  const ty = CY - R(s.wall);
  const hidden = (x: number, y: number) => Math.abs(x + 0.5 - CX) <= RX && y + 0.5 > ty + ellY(x + 0.5 - CX, RXI, RYI);
  const put = (x: number, y: number, col: number) => {
    const xx = R(x);
    const yy = R(y);
    if (!hidden(xx, yy)) p.set(xx, yy, col);
  };
  const ay = AY - R(s.axleDy);
  for (let y = ay + 5; y <= s.bucketY; y++) put(CX, y, (y + Math.floor(s.drum)) % 2 === 0 ? PAL.earth4 : PAL.earth3);
  for (let k = 0; k <= 14; k++) {
    const a = (k / 14) * Math.PI;
    const q = bucketAt(s, -Math.cos(a) * 8.2, 5 - Math.sin(a) * 5);
    put(q.x - 0.5, q.y - 0.5, k > 3 && k < 11 ? PAL.stone3 : PAL.stone2);
  }
  if (!s.brim) return;
  // the brimming dome: three rising bands of lit water over the lip, glints running along it
  const ph = Math.floor(s.el / 70);
  for (let u = -7; u <= 7; u++) {
    const q = bucketAt(s, u, 4);
    put(q.x - 0.5, q.y - 0.5, Math.abs(u) <= 4 ? PAL.water4 : PAL.teal3);
    if (Math.abs(u) <= 5) {
      const q1 = bucketAt(s, u, 3);
      put(q1.x - 0.5, q1.y - 0.5, Math.abs(u) <= 2 ? PAL.water4 : PAL.teal3);
    }
    if (Math.abs(u) <= 3) {
      const q2 = bucketAt(s, u, 2);
      put(q2.x - 0.5, q2.y - 0.5, PAL.teal4);
    }
    if ((u + 14 + ph) % 6 === 0) {
      const g = bucketAt(s, u, 3);
      put(g.x - 0.5, g.y - 0.5, PAL.white);
    }
  }
  if (Math.abs(s.tilt) < 0.05) {
    const top = bucketAt(s, (ph % 5) - 2, 1.2);
    put(top.x - 0.5, top.y - 0.5, PAL.white);
  }
  if (!s.spill) return;
  // the overflow POURS over the lip: a sheet that leaves the lip sideways (2 px thick, white-lit) and falls on a
  // parabola, thinning to 1 px, breaking into falling segments whose gaps run DOWN a step every 30 ms, then into single
  // drops; a 1-px white highlight slides down it; where it meets the water in the mouth (or the ring's stones) it
  // splashes. Its throw follows the bucket: the lip that tips down pours long and far, the high lip only dribbles.
  const fp = Math.floor(s.el / 30);
  for (const side of [-1, 1] as const) {
    const down = Math.sin(s.tilt) * side; // > 0: this lip is the low one
    if (down < -0.05) continue; // the raised lip stops pouring
    const lip = bucketAt(s, side * 9, 4.4);
    // level: a short curtain hugging the stave; tipped: the low lip throws a long arc out
    const throwX = Math.abs(s.tilt) < 0.05 ? 0.32 : 0.55 + down * 6;
    const len = Math.max(6, R(ty - 0.5 - lip.y + 3));
    const hiAt = (fp * 2) % (len + 6);
    let last: XY | null = null;
    for (let k = 0; k <= len; k++) {
      // x leaves the lip faster than y at first, then the fall takes over (a parabola in k)
      let x = lip.x + side * (0.6 + Math.sqrt(k) * throwX * 1.6);
      const y = lip.y + k;
      const cyc = (((k - fp) % 5) + 5) % 5;
      // solid at the lip, then dashes, then lone drops that wobble off the line
      if (k >= 5 && (k < 10 ? cyc >= 3 : cyc !== 0)) continue;
      if (k >= 10) x += side * ((k + fp + (side > 0 ? 1 : 0)) % 3 === 0 ? 1 : 0);
      const col = Math.abs(k - hiAt) < 1 ? PAL.white : k < 2 ? PAL.water4 : k < 8 ? PAL.teal4 : PAL.teal3;
      put(x - 0.5, y - 0.5, col);
      if (k < 3) put(x - 0.5 - side, y - 0.5, PAL.water4);
      last = { x, y };
    }
    // the splash where it lands: two droplets hopping, alternating each step
    if (last) {
      const sx = R(lip.x + side * (0.6 + Math.sqrt(len) * throwX * 1.6));
      const sy = R(ty + ellY(sx + 0.5 - CX, RXI, RYI)) - 1;
      const hop = fp % 2;
      p.set(sx - 1, sy - 1 - hop, PAL.water4);
      p.set(sx + 1, sy - 2 + hop, PAL.white);
      p.set(sx, sy, PAL.teal3);
    }
  }
}

/** Whether local pixel (x, y) is on the bucket's body or its 1-px outline (the crown's water runs round it). */
function onBucket(s: WellState, x: number, y: number): boolean {
  if (s.bucketY >= DEEP) return false;
  const c = Math.cos(s.tilt);
  const n = Math.sin(s.tilt);
  for (const [ox, oy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const dx = x + ox + 0.5 - CX;
    const dy = y + oy + 0.5 - s.bucketY;
    if (bucketPx(dx * c + dy * n, -dx * n + dy * c) !== null) return true;
  }
  return false;
}

/**
 * The breach: a crown of water jumps out of the mouth (columns of light, tallest in the middle), 180 ms. The columns
 * run AROUND the rising bucket (never over its staves: drawn over it they read as the bars of a cage).
 */
function paintFlare(p: PixelCanvas, s: WellState): void {
  if (s.flare < 0) return;
  const age = s.el - s.flare;
  if (age < 0 || age > 200) return;
  const ty = CY - R(s.wall);
  const k = age / 200;
  const rise = Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
  const fall = 1 - Math.max(0, (k - 0.5) * 2);
  const cols = [-10, -7, -4, -1, 1, 4, 7, 10];
  cols.forEach((cx, i) => {
    const hgt = R((18 - Math.abs(cx) * 1.1) * rise * fall);
    const lean = Math.sign(cx) * R(k * 4);
    for (let y = 0; y < hgt; y++) {
      const x = CX + cx + R((lean * y) / Math.max(1, hgt));
      const col = y >= hgt - 1 ? PAL.white : y > hgt - 4 ? PAL.water4 : (y + i) % 3 === 0 ? PAL.teal4 : PAL.teal3;
      if (onBucket(s, x, ty - y)) continue;
      p.set(x, ty - y, col);
    }
  });
}

/** Drops (2×1 / 1×2 teal pixels) and their splashes: in the shaft (ripples), on the stones, on the floor. */
function paintDrops(p: PixelCanvas, s: WellState): void {
  for (const d of s.drops) {
    const x = R(d.x);
    const y = R(d.y);
    p.set(x, y, PAL.water4);
    p.set(x, y - 1, PAL.teal3);
  }
  for (const sp of s.splashes) {
    const age = s.el - sp.born;
    if (age < 0 || age > 220) continue;
    const f = Math.floor(age / 55);
    const x = R(sp.x);
    const y = R(sp.y);
    if (sp.on === 0) continue; // the shaft draws its own ripples
    // a tiny crown: two droplets jumping apart, then a wet glint on the stone / floor
    if (f === 0) {
      p.set(x - 1, y - 1, PAL.white).set(x + 1, y - 1, PAL.water4).set(x, y, PAL.teal3);
    } else if (f === 1) {
      p.set(x - 2, y - 2, PAL.water4).set(x + 2, y - 2, PAL.teal4).set(x - 1, y, PAL.teal3).set(x + 1, y, PAL.teal3);
    } else {
      p.set(x - 1, y, PAL.teal2).set(x, y, sp.on === 2 ? PAL.teal3 : PAL.teal2).set(x + 1, y, PAL.teal2);
    }
  }
}

// ================================================================ the well runtime

interface Well {
  s: WellState;
  mouth(): XY;
  world(p: XY): XY;
  ras: Raster;
  /** Spill one drop off a lip (local). */
  drip(side: number, strong: boolean): void;
  stop(): void;
}

function makeWell(sc: Phaser.Scene, at: XY, seed: number, side: 1 | -1): Well {
  const ox = R(at.x) - CX;
  const oy = R(at.y) - CY;
  const ras = new Raster(sc, ox, oy, W, H, unitDepth(R(at.y)) + 0.6);
  const layer = new PixelCanvas(W, H);
  const motes = new PxSparks(sc, DEPTH.FX + 3);
  const rnd = fxRng(seed);
  const s: WellState = {
    wall: 0,
    posts: 0,
    axle: false,
    axleDy: 0,
    crank: 0,
    drum: 0,
    side,
    bucketY: DEEP,
    tilt: 0,
    brim: false,
    spill: false,
    glow: 1,
    ripples: [],
    flare: -1,
    drops: [],
    splashes: [],
    cut: -1,
    fadeEnd: Infinity,
    el: 0,
  };
  let lastDrip = 0;
  const pass = (fn: (p: PixelCanvas) => void, outline: boolean) => {
    layer.clear();
    fn(layer);
    if (outline) layer.outline(PAL.ink);
    ras.pc.blit(layer, 0, 0);
  };
  const drip = (sd: number, strong: boolean) => {
    const lip = bucketAt(s, sd * 9, 4.4);
    const fall = Math.abs(s.tilt) > 0.05 ? 20 : 14;
    // most drops fall back into the shaft; strong ones are flung out onto the ring stones or the floor
    const vx = sd * (strong ? 18 + rnd() * 34 : 2 + rnd() * 8);
    s.drops.push({ x: lip.x + sd * 2, y: lip.y + fall, vx, vy: 10 + rnd() * 20 });
  };
  const stop = onFrame(sc, (dt, el) => {
    if (!ras.alive) return false;
    s.el = el;
    // drops: fall, land on the water / the stones / the floor
    const ty = CY - R(s.wall);
    const k = dt / 1000;
    for (let i = s.drops.length - 1; i >= 0; i--) {
      const d = s.drops[i];
      d.vy += 520 * k;
      d.x += d.vx * k;
      d.y += d.vy * k;
      const dx = d.x - CX;
      const onWater = Math.abs(dx) < RXI - 1;
      const onStone = !onWater && Math.abs(dx) <= RX + 1;
      const land = onWater ? ty + 2 : onStone ? ty + R(ellY(dx, RX, RY) * 0.6) : CY + R(ellY(Math.min(Math.abs(dx), RX), RX + 6, RY + 3)) - 1;
      if (d.y >= land) {
        s.drops.splice(i, 1);
        if (onWater) {
          s.ripples.push(el);
          if (s.ripples.length > 8) s.ripples.shift();
        } else s.splashes.push({ x: d.x, y: land, born: el, on: onStone ? 1 : 2 });
      }
    }
    if (s.splashes.length > 24) s.splashes.splice(0, s.splashes.length - 24);
    if (s.spill && dt > 0 && el - lastDrip > 45) {
      lastDrip = el;
      const tilted = Math.abs(s.tilt) > 0.05;
      const sd = tilted ? Math.sign(s.tilt) : rnd() < 0.5 ? -1 : 1;
      drip(sd, rnd() < 0.45);
    }
    ras.begin();
    pass((p) => paintBack(p, s), true);
    if (s.bucketY < DEEP) {
      pass((p) => paintBucket(p, s), true);
      pass((p) => paintBucketLight(p, s), false);
    }
    pass((p) => paintFront(p, s), true);
    pass((p) => paintFrame(p, s), true);
    pass((p) => {
      paintFlare(p, s);
      paintDrops(p, s);
    }, false);
    if (s.cut >= 0) {
      const pc = ras.pc;
      for (let y = 0; y < Math.min(H, s.cut); y++) for (let x = 0; x < W; x++) pc.erase(x, y);
      for (let y = s.cut; y < Math.min(H, s.cut + 2); y++)
        for (let x = 0; x < W; x++) {
          if (pc.get(x, y) === null) continue;
          pc.set(x, y, y === s.cut ? PAL.teal4 : PAL.teal3);
          if (dt > 0 && (x + y) % 3 === 0 && rnd() < 0.55)
            motes.add({ x: ox + x, y: oy + y, vx: (rnd() - 0.5) * 16, vy: -(26 + rnd() * 40), drag: 1.2, life: Math.max(40, Math.min(150 + rnd() * 110, s.fadeEnd - el + 30)), colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2], shape: rnd() < 0.15 ? 'plus' : 'px', fadeAt: 1 });
        }
    }
    ras.end();
    return true;
  });
  return {
    s,
    ras,
    drip,
    world: (p) => ({ x: ox + p.x, y: oy + p.y }),
    mouth() {
      const q = bucketAt(s, 0, 3);
      return { x: ox + R(q.x), y: oy + R(q.y) };
    },
    stop() {
      stop();
      ras.destroy();
      motes.release();
    },
  };
}

/** The floor under the well: the landing ring and rune, the breach's caustic spill, the plop's ring (TILE_FX). */
function floorFx(sc: Phaser.Scene, at: XY, kind: 'land' | 'plop' | 'flare'): Promise<void> {
  const fx0 = R(at.x);
  const fy0 = R(at.y);
  const ras = new Raster(sc, fx0 - 64, fy0 - 32, 129, 65, DEPTH.TILE_FX + 4);
  const R0 = kind === 'land' ? 6 : RX + 2;
  const R1 = kind === 'land' ? 34 : kind === 'flare' ? 60 : 30;
  const ramp = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];
  let f = 0;
  const ms = kind === 'land' ? 300 : kind === 'flare' ? 420 : 240;
  return run(sc, ms, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.draw((g) => {
      const r = R0 + (R1 - R0) * (1 - (1 - t) * (1 - t));
      const tone = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
      if (kind === 'flare') {
        // caustic light: two broken rings of short dashes running out over the neighbouring tiles
        for (const [rr, off] of [
          [r, 0],
          [r * 0.66, 0.2],
        ] as const) {
          for (let a = 0; a < TAU; a += 0.16) {
            if (Math.floor((a + off + t * 1.4) / 0.16) % 3 === 0) continue;
            g.px(fx0 + R(Math.cos(a) * rr), fy0 + R(Math.sin(a) * rr * 0.5), rr === r ? tone : ramp[Math.min(4, Math.floor(t * 5) + 1)]);
          }
        }
        return;
      }
      g.ring(fx0 + 0.5, fy0 + 0.5, r, r / 2, tone);
      if (kind === 'land' && f < 3) {
        g.ring(fx0 + 0.5, fy0 + 0.5, 19, 9.5, f < 2 ? PAL.teal4 : PAL.teal2);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + Math.PI / 4;
          g.px(fx0 + R(Math.cos(a) * 22), fy0 + R(Math.sin(a) * 11), PAL.white);
        }
      }
    });
  }).then(() => ras.destroy());
}

// ================================================================ the leaping card (a native pixel drawing)

/** Native sizes of the card on its way from the water to the hand (never a scaled sprite); the last is the hand's. */
const LEAP_SIZES: readonly (readonly [number, number])[] = [
  [6, 8],
  [10, 14],
  [14, 20],
  [18, 26],
  [24, 34],
  [30, 42],
  [36, 51],
  [42, 60],
  [48, 68],
];
/** The caster's hand is the other player's mini-hand: the card grows a little and shrinks into a 9 × 13 mini card. */
const MINI_SIZES: readonly (readonly [number, number])[] = [
  [6, 8],
  [10, 14],
  [14, 20],
  [12, 17],
  [9, 13],
];
const ANG = Math.PI / 16;

/**
 * Paint the player's face-down card (the real v3 back sampled whole-pixel at w × h), turned by `a`, centred in `p`.
 * Airborne it is WET: a bright 1-px rim on its lit top / left edges, a band of water light sliding over it, an ink
 * outline. `plain`: the hand's own picture (the last frame — no rim, no sheen, no extra outline, angle 0).
 * `flex` bends the body by one whole pixel like a fish: 'c' shifts the top and bottom thirds (a C-curve at the apex),
 * 'tail' only the bottom third (a tail flick); the sign is the side.
 */
function paintCard(p: PixelCanvas, back: PixelCanvas, rim: number, w: number, h: number, a: number, sheen: number, plain: boolean, flex = 0, kind: 'c' | 'tail' = 'c'): void {
  const cx = p.w / 2;
  const cy = p.h / 2;
  const c = Math.cos(a);
  const n = Math.sin(a);
  const hw = w / 2;
  const hh = h / 2;
  const bend = w >= 18 ? flex : 0;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      let u = dx * c + dy * n;
      const v = -dx * n + dy * c;
      if (bend !== 0) {
        const f = kind === 'c' ? (Math.abs(v) > hh * 0.36 ? 1 : 0) : v > hh * 0.3 ? 1 : 0;
        u -= bend * f;
      }
      if (Math.abs(u) > hw || Math.abs(v) > hh) continue;
      const sx = Math.min(back.w - 1, Math.max(0, Math.floor(((u + hw) / w) * back.w)));
      const sy = Math.min(back.h - 1, Math.max(0, Math.floor(((v + hh) / h) * back.h)));
      let col = back.get(sx, sy) ?? PAL.night1;
      if (!plain) {
        const eu = hw - Math.abs(u);
        const ev = hh - Math.abs(v);
        if (w < 18 && Math.min(eu, ev) < 1) col = rim;
        // the wet rim: the lit top and left edges shine, the top-left corner is white
        if (v < -hh + 1 || u < -hw + 1) col = u < -hw + 2 && v < -hh + 2 ? PAL.white : PAL.water4;
        const k = u * 0.8 + v * 0.5 - sheen;
        if (k > 0 && k < 1.4 && w >= 10 && Math.min(eu, ev) > 1.5) col = PAL.water4;
        else if (k >= 1.4 && k < 2.4 && w >= 24 && Math.min(eu, ev) > 1.5) col = PAL.teal3;
      }
      p.set(x, y, col);
    }
  if (!plain) p.outline(PAL.ink);
}

// ---------------------------------------------------------------- clear space: what a flying card must not cover

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** cost weight per covered px: a unit / a duelist is hard, a screen or a panel soft */
  w: number;
  /** a monster unit (dimmed when a path still crosses it) */
  uid?: Uid;
}

const boxCache = new Map<string, { x0: number; y0: number; x1: number; y1: number } | null>();

/** The opaque bounding box of a sprite's current frame, in world px (cached per frame; null: unreadable). */
function spriteBox(spr: Phaser.GameObjects.Sprite): { x0: number; y0: number; x1: number; y1: number } | null {
  const f = spr.frame;
  const key = `${spr.texture.key}|${String(f.name)}`;
  let b = boxCache.get(key);
  if (b === undefined) {
    b = null;
    try {
      const w = f.cutWidth;
      const h = f.cutHeight;
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d', { willReadFrequently: true });
      if (g) {
        g.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
        const d = g.getImageData(0, 0, w, h).data;
        let x0 = w;
        let y0 = h;
        let x1 = -1;
        let y1 = -1;
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            if (d[(y * w + x) * 4 + 3] < 24) continue;
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        if (x1 >= 0) b = { x0, y0, x1, y1 };
      }
    } catch {
      b = null;
    }
    boxCache.set(key, b);
  }
  if (!b) return null;
  const left = spr.x - spr.displayOriginX;
  const top = spr.y - spr.displayOriginY;
  const fw = f.cutWidth;
  return spr.flipX ? { x0: left + fw - 1 - b.x1, y0: top + b.y0, x1: left + fw - 1 - b.x0, y1: top + b.y1 } : { x0: left + b.x0, y0: top + b.y0, x1: left + b.x1, y1: top + b.y1 };
}

/** Every unit (opaque sprite box + its plate), both duelists and piles, the portrait screens and the HUD panels. */
function obstacles(ctx: ActCtx): Box[] {
  const out: Box[] = [];
  for (const p of [0, 1] as PlayerId[]) {
    ctx.state.players[p].monsters.forEach((m, i) => {
      if (!m) return;
      const home = zoneXY(p, 'monster', i);
      const u = ctx.unit(m.uid);
      const sb = u && u.sprite.active && u.sprite.visible ? spriteBox(u.sprite) : null;
      const b = sb ?? { x0: home.x - 20, y0: home.y - 56, x1: home.x + 20, y1: home.y + 2 };
      out.push({ x0: b.x0, y0: b.y0, x1: b.x1, y1: Math.max(b.y1, home.y + 10), w: 10, uid: m.uid });
    });
    const d = duelistXY(p);
    out.push({ x0: d.x - 11, y0: d.y - 36, x1: d.x + 11, y1: d.y + 3, w: 10 });
    // the piles (soft: a card may pass over them, but should not hang over one)
    for (const z of ['deck', 'graveyard'] as const) {
      const q = zoneXY(p, z);
      out.push({ x0: q.x - 16, y0: q.y - 20, x1: q.x + 16, y1: q.y + 8, w: 2 });
    }
  }
  for (const r of SCREENS) out.push({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1, w: 4 });
  // the arena's two holograms (a card shaking over one reads as leaving the board)
  for (const h of HOLOS) out.push({ x0: h.box.x, y0: h.box.y, x1: h.box.x + h.box.w - 1, y1: h.box.y + h.box.h - 1, w: 4 });
  for (const r of [UI.p1Panel, UI.p2Panel, UI.phaseBar]) out.push({ x0: r.x, y0: r.y, x1: r.x + r.w - 1, y1: r.y + r.h - 1, w: 6 });
  return out;
}

function overlap(a: { x0: number; y0: number; x1: number; y1: number }, b: { x0: number; y0: number; x1: number; y1: number }): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

const rectAt = (c: XY, w: number, h: number, mx = 1, my = 1) => ({ x0: c.x - w / 2 - mx, y0: c.y - h / 2 - my, x1: c.x + w / 2 + mx, y1: c.y + h / 2 + my });

// ---------------------------------------------------------------- the leap's path: burst up, hop to a clear apex, fall

/** Well-local → world offsets of the mouth (the bucket's water, hanging under the drum) from the tile centre. */
const MOUTH_DY = HANG + 3 - CY;
const LEAP_T = Object.freeze({ burst: 100, flex: 50, still: 50, flop: 40 });

interface LeapPlan {
  /** mouth (start), burst top, apex, the hand's slot */
  M: XY;
  B: XY;
  P: XY;
  T: XY;
  /** index into the size list at the apex */
  apex: number;
  cost: number;
}

interface PlanOpts {
  burst: number;
  apex: number;
  /** horizontal clearance kept round the card at the apex (the shake's swing + its spray) */
  margin: number;
  pref: { dx: number; h: number };
  avoid?: XY | null;
  /** the well's own windlass (a soft obstacle for the apex) */
  well: XY;
  /** the caster: an apex over the opponent's half (or off the platform) reads as a card going to the opponent */
  caster: PlayerId;
}

/** Highest apex above the burst top (px): a fish hop, not a throw across the board. */
const APEX_MAX_H = 56;

const easeOut = (k: number) => 1 - (1 - k) * (1 - k);

/** The point and native size of a planned leap at phase time: 'rise' k 0..1 (B → P), 'fall' k 0..1 (P → T). */
function riseAt(pl: LeapPlan, k: number): XY {
  return { x: pl.B.x + (pl.P.x - pl.B.x) * k, y: pl.B.y + (pl.P.y - pl.B.y) * easeOut(k) };
}
function fallAt(pl: LeapPlan, k: number): XY {
  // a mini-hand above the apex (the other player's corner): a smooth glide up into it instead of a fall; else a
  // fall that leaves the apex at once (a linear-ish start, gravity after) — never a hang at the top
  const e = pl.T.y < pl.P.y ? k * k * (3 - 2 * k) : k * (0.6 + 0.4 * k);
  return { x: pl.P.x + (pl.T.x - pl.P.x) * k, y: pl.P.y + (pl.T.y - pl.P.y) * e };
}

/**
 * Choose the leap's apex: on a grid round the mouth, the point whose card (at its apex size + `margin`) covers the
 * least of the units, duelists, screens and panels, whose rise and fall cross the fewest unit sprites, close to the
 * preferred offset (and away from `avoid`, the other leap's apex). The apex is always above the burst top, so the
 * card really peaks there.
 */
function planLeap(obst: Box[], M: XY, T: XY, sizes: readonly (readonly [number, number])[], o: PlanOpts): LeapPlan {
  const B = { x: M.x, y: M.y - o.burst };
  const [aw, ah] = sizes[o.apex];
  const wellBox = { x0: o.well.x - 24, y0: o.well.y - 50, x1: o.well.x + 24, y1: o.well.y + 6 };
  let best: LeapPlan = { M, B, P: { x: B.x + o.pref.dx, y: B.y - o.pref.h }, T, apex: o.apex, cost: Infinity };
  // the apex stays a fish hop over the caster's own side: at most APEX_MAX_H over the burst top, on the caster's
  // half of the platform, between the well and the hand
  const lo = Math.min(B.x, T.x) - 24;
  const hi = Math.max(B.x, T.x) + 24;
  for (let dx = -96; dx <= 96; dx += 4)
    for (let h = 6; h <= APEX_MAX_H; h += 2) {
      const P = { x: R(B.x + dx), y: R(B.y - h) };
      const r = rectAt(P, aw, ah, o.margin, 3);
      let cost = 0;
      if (r.x0 < 6 || r.x1 > 634 || r.y0 < 22 || r.y1 > 300) cost += 4000;
      // over the opponent's half / off the platform (read on the floor under the card): a trip to the opponent
      // (read where the eye reads it: the tile right behind the card's centre)
      const g = screenToIso(P.x, P.y);
      const half = sideOfRow(g.row);
      if (half === 1 - o.caster) cost += 3000;
      else if (half === null) cost += 400;
      if (g.col < -0.5 || g.col > BOARD_COLS - 0.5 || g.row < -0.5 || g.row > BOARD_ROWS - 0.5) cost += 1500;
      // between the well and the hand (x), a soft pull
      cost += (Math.max(0, lo - P.x) + Math.max(0, P.x - hi)) * 4;
      // hard things (units: their idle frames swing an axe or a tail; duelists) keep 8 px of air beside them, 4 above and below
      for (const b of obst) cost += overlap(r, b.w >= 10 ? { x0: b.x0 - 8, y0: b.y0 - 4, x1: b.x1 + 8, y1: b.y1 + 4 } : b) * b.w;
      cost += overlap(r, wellBox) * 3;
      const pl: LeapPlan = { M, B, P, T, apex: o.apex, cost: 0 };
      // the path: a few samples of the rise and the fall (only the hard obstacles; a crossed unit is dimmed)
      for (let i = 1; i <= 10; i++) {
        const k = i / 10;
        const q = k <= 0.3 ? riseAt(pl, k / 0.3) : fallAt(pl, (k - 0.3) / 0.7);
        if (q.y > T.y - 30) break; // the hand's own corner
        const si = k <= 0.3 ? o.apex : Math.min(sizes.length - 2, o.apex + Math.floor(((k - 0.3) / 0.7) * (sizes.length - 1 - o.apex)));
        const [w, hh] = sizes[si];
        const rr = rectAt(q, w * 0.7, hh * 0.7, 0, 0);
        for (const b of obst) if (b.w >= 10) cost += overlap(rr, b) * 0.12;
      }
      // a higher leap than wished is cheap past 16 px (a fish clearing the units' heads is the point)
      const over = Math.max(0, h - o.pref.h);
      cost += Math.abs(dx - o.pref.dx) * 0.8 + Math.max(0, o.pref.h - h) * 1.2 + Math.min(16, over) * 1.2 + Math.max(0, over - 16) * 0.3;
      if (o.avoid) {
        const dd = Math.hypot(P.x - o.avoid.x, P.y - o.avoid.y);
        if (dd < 44) cost += (44 - dd) * 20; // two fish, two places: never the same apex twice
      }
      if (cost < best.cost) best = { M, B, P, T, apex: o.apex, cost };
    }
  return best;
}

/** The two leaps' plan options: two fish, different rise and side — the second one leaps higher, on the far side. */
function leapOpts(k: number, dir: number, well: XY, avoid: XY | null, mini: boolean, caster: PlayerId): PlanOpts {
  const apex = mini ? 2 : k === 0 ? 4 : 5;
  return k === 0
    ? { burst: 12, apex, margin: 5, pref: { dx: dir * 22, h: 8 }, avoid, well, caster }
    : // the shake swings ±9 px and rolls ±3·π/16 (a 30 × 42 card turned 3π/16 is ~46 px wide): 9 + 7 px each side.
      // It leaps higher than the first, still on the hand's side of the well
      { burst: 20, apex, margin: 16, pref: { dx: dir * 4, h: 34 }, avoid, well, caster };
}

interface Leap {
  /** The card's world point now. */
  pos(): XY;
  /** Resolves when the shake (the second card) has ended, or at the apex (the first). */
  apexDone: Promise<void>;
  /** Resolves when the card has settled in the hand's slot. */
  landed: Promise<void>;
  destroy(): void;
}

interface LeapOpts {
  plan: LeapPlan;
  sizes: readonly (readonly [number, number])[];
  rise: number;
  fall: number;
  shake: boolean;
  shakeStepMs: number;
  /** Called once, `lead` ms (scene time) before the landing. */
  lead: number;
  onLead: () => void;
  /** Called at each shake reversal (the sound plays on the first). */
  onShake?: (i: number) => void;
  /** Called when the fall starts / on the landing's first frame (the flop, or the mini-hand taking over). */
  onFall?: () => void;
  onFlop?: () => void;
  /** Called once, `ms` (scene time) before the landing. */
  preLand?: { ms: number; fn: () => void };
  /** The last frame is the hand's own card (owner) or nothing (a mini-hand takes over). */
  plainEnd: boolean;
}

/**
 * Shake: one jerk per entry — x offset, roll (× π/16), lift, held steps. The first two jerks are the big ones (held
 * two steps each, so they read as hard throws), the rest die down; before and after it the card hangs perfectly
 * still and upright (LEAP_T.still) so the shake stands apart from the flight's wobble.
 */
const SHAKE: readonly (readonly [number, number, number, number])[] = [
  [9, 3, -1, 2],
  [-9, -3, 0, 2],
  [7, 2, -1, 1],
  [-6, -2, 0, 1],
  [5, 1, -1, 1],
  [-4, -1, 0, 1],
  [2, 1, 0, 1],
  [0, 0, 0, 1],
];
/** The shake's scene length at `stepMs` per step (the still holds included). */
const shakeMs = (stepMs: number): number => 2 * LEAP_T.still + SHAKE.reduce((a, j) => a + j[3], 0) * stepMs;

function leapCard(sc: Phaser.Scene, player: PlayerId, seed: number, o: LeapOpts): Leap {
  const pl = o.plan;
  const BOX = 92;
  const ras = new Raster(sc, pl.M.x - BOX / 2, pl.M.y - BOX / 2, BOX, BOX, DEPTH.HAND + 30);
  const pc = new PixelCanvas(BOX, BOX);
  const drops = new PxSparks(sc, DEPTH.HAND + 29);
  const rnd = fxRng(seed);
  const back = cardBackCanvas(player);
  const rim = PLAYER_RAMP[player][3];
  const dir = pl.T.x >= pl.P.x ? 1 : -1;
  const sizes = o.sizes;
  const last = sizes.length - 1;
  let pos: XY = { ...pl.M };
  let ang = 0;
  let size = 0;
  let sheen = 0;
  let plain = false;
  let flex = 0;
  let flexKind: 'c' | 'tail' = 'tail';
  /** a 1-frame body squash at a shake reversal (wider and shorter for one frame) */
  let squash = 0;
  let dead = false;
  let hidden = false;
  // the teal light the wet card carries (it lights the floor and the cards under it)
  const glow = lightPool(sc, pl.M.x, pl.M.y, { color: PAL.teal3, radius: 18, intensity: 0, floorY: pl.M.y + 10 });
  glow.setIntensity(0.85, 80);
  glow.follow(() => (dead ? null : { x: pos.x, y: pos.y }));
  const draw = () => {
    if (dead) return;
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    if (!hidden) {
      pc.clear();
      const [w, h] = sizes[size];
      paintCard(pc, back, rim, w + squash * 4, h - squash * 4, plain ? 0 : ang, sheen, plain, plain ? 0 : flex, flexKind);
      ras.pc.blit(pc, 0, 0);
    }
    ras.end();
  };
  const trail = (dt: number) => {
    if (dt <= 0) return;
    const [w, h] = sizes[size];
    const n = w >= 30 ? 2 : 1;
    for (let k = 0; k < n; k++)
      drops.add({ x: R(pos.x - dir * (w / 2) * rnd()), y: R(pos.y + h / 2 - 1), vx: (rnd() - 0.5) * 18 - dir * 10, vy: 8 + rnd() * 26, ay: 560, life: 260 + rnd() * 220, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
  };
  // the splash COLUMN where it bursts straight up out of the water, and a low crown round it
  for (let k = 0; k < 16; k++) {
    const sx = (rnd() - 0.5) * 6;
    drops.add({ x: R(pl.M.x + sx), y: pl.M.y - R(rnd() * 4), vx: sx * 3, vy: -(150 + rnd() * 140), ay: 640, life: 340 + rnd() * 180, colors: [PAL.white, PAL.water4, PAL.teal4, PAL.teal3], shape: k % 5 === 0 ? 'plus' : 'px', fadeAt: 1 });
  }
  for (let k = 0; k < 12; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    drops.add({ x: pl.M.x + side * R(2 + rnd() * 5), y: pl.M.y, vx: side * (30 + rnd() * 50), vy: -(50 + rnd() * 60), ay: 620, life: 280 + rnd() * 160, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
  }
  // the lead (the hand makes room) fires `lead` ms before the end of the fall
  let leadDone = false;
  const lead = () => {
    if (leadDone) return;
    leadDone = true;
    o.onLead();
  };
  const total = LEAP_T.burst + o.rise + (o.shake ? shakeMs(o.shakeStepMs) : LEAP_T.flex) + o.fall;
  let preDone = !o.preLand;
  let spent = 0;
  const phase = async (ms: number, fn: (k: number, el: number, dt: number) => void) => {
    const t0 = spent;
    await run(sc, ms, (k, el, dt) => {
      if (dead) return;
      fn(k, el, dt);
      sheen = (el / 20) % 40 - 10;
      const left = total - (t0 + ms * k);
      if (left <= o.lead) lead();
      if (!preDone && o.preLand && left <= o.preLand.ms) {
        preDone = true;
        o.preLand.fn();
      }
      draw();
    });
    spent += ms;
  };
  let apexResolve: () => void = () => undefined;
  const apexDone = new Promise<void>((r) => (apexResolve = r));
  const landed = (async () => {
    // 1. BURST: straight up out of the water, growing through the first three sizes
    await phase(LEAP_T.burst, (k, _el, dt) => {
      pos = { x: pl.M.x, y: pl.M.y + (pl.B.y - pl.M.y) * easeOut(k) };
      size = Math.min(2, Math.floor(k * 3));
      ang = 0;
      flex = 0;
      if (k > 0.5) trail(dt);
    });
    // 2. RISE to the apex: the body flicks its tail left / right, a stepped roll
    await phase(o.rise, (k, el, dt) => {
      pos = riseAt(pl, k);
      size = Math.min(pl.apex, 2 + Math.floor(k * (pl.apex - 2 + 0.999)));
      const beat = Math.floor(el / 45) % 2 === 0 ? 1 : -1;
      ang = -dir * ANG * (k < 0.5 ? 1 : 0) + (k >= 0.5 ? beat * ANG : 0);
      flexKind = 'tail';
      flex = beat;
      trail(dt);
    });
    // 3. APEX: the whole body bends (a C) for a beat — the second card shakes the water off instead
    pos = { ...pl.P };
    size = pl.apex;
    if (!o.shake) {
      await phase(LEAP_T.flex, () => {
        flexKind = 'c';
        flex = dir;
        ang = dir * ANG;
      });
    } else {
      // the card hangs perfectly still and upright: the shake is a different motion from the flight
      await phase(LEAP_T.still, () => {
        ang = 0;
        flex = 0;
      });
      for (let i = 0; i < SHAKE.length; i++) {
        if (dead) break;
        const [jx, roll, lift, hold] = SHAKE[i];
        o.onShake?.(i);
        const sx = Math.sign(jx) || dir;
        const [w, h] = sizes[size];
        if (i < 2) {
          // a wide SHEET of water thrown SIDEWAYS off the card's trailing edge: flat 2–3 px streaks flying far out
          // (water4 / teal3), a couple of white heads, almost no pluses — a throw, not a sparkle
          for (let k = 0; k < 30; k++) {
            const ey = (rnd() - 0.5) * h * 0.9;
            const sp = 150 + rnd() * 170;
            drops.add({ x: R(pl.P.x + jx + sx * (w / 2 + 1)), y: R(pl.P.y + ey), vx: sx * sp, vy: -(rnd() * 40) + ey * 0.8, ay: 300, drag: 1.1, life: 300 + rnd() * 200, colors: k % 7 === 0 ? [PAL.white, PAL.water4, PAL.teal3] : [PAL.water4, PAL.water4, PAL.teal3], shape: k === 0 ? 'plus' : 'streak', len: 0.012, fadeAt: 1 });
          }
          void lightFlash(sc, R(pl.P.x + sx * (w / 2 + 10)), pl.P.y, PAL.teal4, 28, 200, { intensity: 0.7 });
        } else if (i < 6) {
          // the smaller jerks still fling water sideways, fewer and shorter
          const n = 12 - i * 2;
          for (let k = 0; k < n; k++) {
            const ey = (rnd() - 0.5) * h * 0.8;
            drops.add({ x: R(pl.P.x + jx + sx * (w / 2 + 1)), y: R(pl.P.y + ey), vx: sx * (90 + rnd() * 90), vy: -(rnd() * 30) + ey, ay: 380, drag: 1, life: 220 + rnd() * 160, colors: [PAL.water4, PAL.teal3, PAL.teal2], shape: 'streak', len: 0.012, fadeAt: 1 });
          }
        }
        await phase(o.shakeStepMs * hold, (k) => {
          pos = { x: pl.P.x + jx, y: pl.P.y + lift };
          ang = roll * ANG;
          flexKind = 'tail';
          flex = jx === 0 ? 0 : -sx; // the tail lags behind the jerk
          // the reversal's first frame squashes the body (the water's weight swings through it)
          squash = jx !== 0 && k * o.shakeStepMs * hold < 17 ? 1 : 0;
        });
        squash = 0;
      }
      await phase(LEAP_T.still, () => {
        pos = { ...pl.P };
        ang = 0;
        flex = 0;
        squash = 0;
      });
    }
    apexResolve();
    o.onFall?.();
    // 4. FALL into the hand: rolling ±π/16 with tail flicks through 85 % of the way, then straight
    await phase(o.fall, (k, el, dt) => {
      pos = fallAt(pl, k);
      size = Math.min(last - 1, pl.apex + Math.floor(Math.pow(k, 1.2) * (last - pl.apex)));
      const beat = Math.floor(el / 60) % 2 === 0 ? 1 : -1;
      if (k < 0.85) {
        ang = beat * ANG;
        flexKind = 'tail';
        flex = Math.floor(el / 30) % 3 === 0 ? -beat : 0;
      } else {
        ang = 0;
        flex = 0;
      }
      trail(dt);
    });
    lead();
    if (dead) return;
    if (o.preLand && !preDone) {
      preDone = true;
      o.preLand.fn();
    }
    if (!o.plainEnd) {
      hidden = true;
      draw();
      o.onFlop?.();
      return;
    }
    // 5. FLOP: the hand's own card (48 × 68, upright, its plain back) lands 2 px low, then settles on the slot
    size = last;
    plain = true;
    pos = { x: R(pl.T.x), y: R(pl.T.y) + 2 };
    draw();
    o.onFlop?.();
    await wait(sc, LEAP_T.flop);
    pos = { x: R(pl.T.x), y: R(pl.T.y) };
    draw();
  })();
  return {
    pos: () => ({ ...pos }),
    apexDone,
    landed,
    destroy() {
      if (dead) return;
      dead = true;
      apexResolve();
      ras.destroy();
      drops.release();
      void glow.fadeOut(160);
    },
  };
}

// ================================================================ where the well stands

/** The ring (a unit standing in front of it hides it) and the windlass (a unit behind it is crossed by it). */
const ringBox = (c: XY) => ({ x0: c.x - RX - 2, y0: c.y - 14, x1: c.x + RX + 2, y1: c.y + 10 });
const frameBox = (c: XY) => ({ x0: c.x - 24, y0: c.y - 48, x1: c.x + 24, y1: c.y - 10 });
/** The crank's sweep (arm, peg and knob) on `side`, and the two posts (world px). */
const crankBox = (c: XY, side: 1 | -1) => {
  const hub = c.x + side * CRANK_OFF;
  return { x0: side > 0 ? hub - 6 : hub - 12, y0: c.y + (AY - CY) - 14, x1: side > 0 ? hub + 12 : hub + 6, y1: c.y + (AY - CY) + 14 };
};
const postBoxes = (c: XY) => [
  { x0: c.x + POST_L - CX - 1, y0: c.y + (AY - CY) - 3, x1: c.x + POST_L - CX + 4, y1: c.y - 12 },
  { x0: c.x + POST_R - CX - 1, y0: c.y + (AY - CY) - 3, x1: c.x + POST_R - CX + 4, y1: c.y - 12 },
];

/**
 * How much of the windlass the units standing IN FRONT of the well (feet lower on screen: drawn over it) would hide:
 * the crank's sweep counts most (the ratchet crank is the card's signature), then the posts.
 */
function frontCover(obst: Box[], c: XY, side: 1 | -1): number {
  let cost = 0;
  const cb = crankBox(c, side);
  for (const b of obst) {
    if (b.uid === undefined || b.y1 - 10 < c.y - 2) continue;
    cost += overlap(cb, b) * 40;
    for (const pb of postBoxes(c)) cost += overlap(pb, b) * 12;
  }
  return cost;
}

/** The crank's side at `c`: toward the board's centre unless a unit in front would hide it there. */
function crankSide(obst: Box[], c: XY): { side: 1 | -1; cover: number } {
  const centre: 1 | -1 = BOARD_CENTER.x >= c.x ? 1 : -1;
  const a = frontCover(obst, c, centre);
  const b = frontCover(obst, c, (-centre) as 1 | -1) + 80;
  return a <= b ? { side: centre, cover: a } : { side: (-centre) as 1 | -1, cover: b - 80 };
}

/** Units whose plates the windlass crosses at `c` (they step back for the scene). */
function unitsBehind(ctx: ActCtx, obst: Box[], c: XY): Uid[] {
  const fb = frameBox(c);
  return obst.filter((b) => b.uid !== undefined && b.y1 - 10 < c.y && overlap(fb, { ...b, y0: b.y1 - 16 }) > 0).map((b) => b.uid as Uid);
}

/**
 * The tile the well stands on. The set card's own tile wins unless a unit stands in front of it (it would hide the
 * ring) or the windlass would really cover a sprite; otherwise the caster's free spell/trap tile nearest the cast
 * spot. Every candidate is also scored by the clear air for its two leaps: a tile whose leaps would have to shake the
 * water off over a unit, a duelist or a screen loses to one with open space.
 */
function wellSpot(ctx: ActCtx, player: PlayerId, setHome: XY | null, target: XY, obst: Box[], mini: boolean): { c: XY; side: 1 | -1 } {
  const pref = setHome ?? castSpot(player);
  const cands: { c: XY; set: boolean }[] = [];
  if (setHome) cands.push({ c: { x: R(setHome.x), y: R(setHome.y) }, set: true });
  ctx.state.players[player].spellTraps.forEach((slot, i) => {
    if (slot) return;
    const z = zoneXY(player, 'spellTrap', i);
    cands.push({ c: { x: R(z.x), y: R(z.y) }, set: false });
  });
  const sizes = mini ? MINI_SIZES : LEAP_SIZES;
  let best: { c: XY; side: 1 | -1 } | null = null;
  let bd = Infinity;
  for (const { c, set } of cands) {
    let cost = Math.hypot(c.x - pref.x, c.y - pref.y);
    // a unit in front hiding the crank / the posts: try the crank on the other end first, else another tile
    const cs = crankSide(obst, c);
    cost += cs.cover;
    const rb = ringBox(c);
    const fb = frameBox(c);
    for (const b of obst) {
      if (b.uid === undefined) continue;
      if (b.y1 - 10 >= c.y - 2 && overlap(rb, b) > 0) cost += 10000; // in front: hides the ring
      else {
        // the set tile only moves when the windlass would really cover the unit's body (its plate steps back anyway)
        const body = { ...b, y1: b.y1 - 12 };
        const area = overlap(fb, body);
        if (area > 0) cost += 600 + area;
      }
    }
    const M = { x: c.x, y: c.y + MOUTH_DY };
    const dir = target.x >= c.x ? 1 : -1;
    // the shaking card needs the most air: its apex is chosen first, the quick first hop takes what is left
    const p2 = planLeap(obst, M, target, sizes, leapOpts(1, dir, c, null, mini, player));
    const p1 = planLeap(obst, M, target, sizes, leapOpts(0, dir, c, p2.P, mini, player));
    cost += p2.cost * 1.5 + p1.cost * 0.5;
    // a leap path through a unit would dim it: a free tile beside the set card is better than a ghosted monster
    cost += (unitsCrossed(obst, p1, sizes) + unitsCrossed(obst, p2, sizes)) * 500;
    // the fish fly TO the hand: a detour away from it (out to a board edge and all the way back) costs its length
    const trip = (pl: LeapPlan) => Math.hypot(pl.P.x - M.x, pl.P.y - M.y) + Math.hypot(target.x - pl.P.x, target.y - pl.P.y);
    cost += trip(p1) + trip(p2);
    if (set) cost -= 500; // "karonun üstüne": the set card BECOMES the well (unless it would hide or ghost a unit)
    if (WELL_DEBUG) console.error('[well] tile', JSON.stringify({ c, cost: Math.round(cost), p1: [p1.P, Math.round(p1.cost)], p2: [p2.P, Math.round(p2.cost)] }));
    if (cost < bd) {
      bd = cost;
      best = { c, side: cs.side };
    }
  }
  if (best) return best;
  const cs = castSpot(player);
  const c = { x: cs.x, y: castFloor(cs) };
  return { c, side: crankSide(obst, c).side };
}

/** The units a planned leap's card would cross (its body over their sprite by more than a sliver). */
function unitsCrossed(obst: Box[], pl: LeapPlan, sizes: readonly (readonly [number, number])[]): number {
  let n = 0;
  for (const b of obst) {
    if (b.uid === undefined) continue;
    for (let i = 1; i <= 12; i++) {
      const k = i / 12;
      const q = k <= 0.35 ? riseAt(pl, k / 0.35) : fallAt(pl, (k - 0.35) / 0.65);
      if (q.y > pl.T.y - 30) break;
      const si = k <= 0.35 ? pl.apex : Math.min(sizes.length - 2, pl.apex + Math.floor(((k - 0.35) / 0.65) * (sizes.length - 1 - pl.apex)));
      const [w, h] = sizes[si];
      if (overlap(rectAt(q, w * 0.8, h * 0.8, 0, 0), b) > 40) {
        n++;
        break;
      }
    }
  }
  return n;
}

// ================================================================ the activation

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const T = WELL_T;
  const player = ev.player;
  // the draws this spell makes (two, or one when the first completes the seals) and its trip to the graveyard
  const draws: number[] = [];
  let gi = -1;
  let wins = false;
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'gameOver') {
      wins = true;
      break;
    }
    if (e.type === 'draw' && e.player === player && !e.initial && !ctx.isConsumed(i)) draws.push(i);
    else if (e.type === 'toGraveyard' && e.uid === ev.uid && e.from === 'resolved') {
      gi = i;
      break;
    } else if (e.type === 'activate' || e.type === 'turnStart' || e.type === 'phaseChange') break;
    if (draws.length >= 2) {
      const n = ctx.events[i + 1];
      if (n && n.type === 'toGraveyard' && n.uid === ev.uid) gi = i + 1;
      break;
    }
  }
  const hand = ctx.views.hand;
  const owner = hand.owner === player;
  const mini = !owner;
  const sizes = mini ? MINI_SIZES : LEAP_SIZES;
  const handTarget = (): XY => {
    const q = owner ? hand.nextSlotXY() : hand.miniXY(player);
    return { x: R(q.x), y: R(q.y) };
  };
  const obst = obstacles(ctx);
  const set = setTileOf(ctx);
  const where = wellSpot(ctx, player, set ? ip(set.home) : null, handTarget(), obst, mini);
  const spot = where.c;
  const side = where.side;
  const pan = panAt(spot.x);
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player,
    from: set ? 'set' : 'hand',
    zone: ev.zone,
    hold: 240,
    releaseFrom: 'bottom',
    setRelease: 'flow',
  });
  relax(ctx, 300);
  if (draws.length === 0) {
    await op.close();
    return;
  }
  await op.release({ x: spot.x, y: spot.y - 1 }, { path: 'arc', lift: 18, ms: 170, size: 2 });

  // the plates of units behind the well would cross its windlass: they step back for the scene
  const dimmed = unitsBehind(ctx, obst, spot)
    .map((u) => ctx.unit(u)?.badge.image ?? null)
    .filter((im): im is Phaser.GameObjects.Image => !!im && im.active);
  for (const im of dimmed) void tween(sc, { targets: im, alpha: 0.15, duration: 120 });
  const undim = () => {
    for (const im of dimmed) if (im.active) void tween(sc, { targets: im, alpha: 1, duration: 160 });
  };

  // ---- LAND + BUILD
  const well = makeWell(sc, spot, spot.x * 7 + spot.y * 13 + player, side);
  const S = well.s;
  bg(floorFx(sc, spot, 'land'));
  void lightFlash(sc, spot.x, spot.y - 8, PAL.teal4, 30, 300, { floorY: spot.y, intensity: 0.9 });
  const pool = lightPool(sc, spot.x, spot.y - 8, { color: PAL.teal3, radius: 26, floorY: spot.y, intensity: 0, anim: 'caustic', fadeIn: 0 });
  pool.setIntensity(0.4, 200);
  const sfx = (name: SfxName, o: { volume?: number; pitch?: number; pan?: number } = {}) => playV3(name, { volume: o.volume ?? 1, pitch: o.pitch, pan: o.pan ?? pan });
  let el = 0;
  const at = async (ms: number) => {
    if (ms > el) await wait(sc, ms - el);
    el = Math.max(el, ms);
  };
  for (let k = 0; k < 3; k++) {
    await at(T.courses[k]);
    S.wall = (k + 1) * 3;
    sfx('e_wellStone', { pitch: 1 + k * 0.12 });
  }
  await at(T.posts[0]);
  sfx('e_wellFrame');
  S.posts = 0.55;
  await at(T.posts[1]);
  S.posts = 1;
  await at(T.axleFall);
  S.axle = true;
  S.axleDy = 6;
  bg(run(sc, T.axleLand - T.axleFall, (t) => (S.axleDy = Math.round(6 * (1 - t * t)))).then(() => (S.axleDy = 0)));
  await at(T.axleLand);
  S.axleDy = 0;
  void lightFlash(sc, spot.x, spot.y - 38, PAL.earth3, 18, 160, { floorY: spot.y, intensity: 0.45 });
  S.bucketY = DEEP - 1;

  // ---- CRANK: 2 turns, every step a ratchet tooth; the bucket climbs; the light swells with the speed
  await at(T.crank);
  sfx('e_wellRope');
  const steps = T.crankSteps;
  const total = steps.length;
  let breached = false;
  for (let i = 0; i < total; i++) {
    const from = S.bucketY;
    const to = R(DEEP - 1 - ((DEEP - 1 - HANG) * (i + 1)) / total);
    S.crank = ((i + 1) * TAU) / 8;
    const f = (i + 1) / total;
    // the first and the last tooth ring out (the ratchet is the card's signature)
    sfx('e_wellClick', { pitch: 1 + f * 0.22, volume: i === 0 || i === total - 1 ? 1.3 : 0.8 + f * 0.2 });
    pool.setIntensity(0.4 + f * 0.55, steps[i]);
    pool.setRadius(26 + R(f * 14), undefined, steps[i]);
    // the pool pulses on each tooth (a soft beat of light)
    if (i % 2 === 1) void lightFlash(sc, spot.x, spot.y - 6, PAL.teal3, 16 + R(f * 12), 120, { floorY: spot.y, intensity: 0.25 + f * 0.35 });
    await run(sc, steps[i], (t) => {
      S.bucketY = R(from + (to - from) * t);
      S.drum = i * 1.5 + t * 1.5;
    });
    el += steps[i];
    if (!breached && S.bucketY + 8 < CY - WALL) {
      // the full bucket breaks the surface: a crown of water flares out of the mouth, caustic light runs out
      breached = true;
      sfx('e_wellSlosh');
      S.glow = 3;
      S.brim = true;
      S.flare = S.el;
      bg(floorFx(sc, spot, 'flare'));
      void lightFlash(sc, spot.x, spot.y - 16, PAL.teal4, 52, 380, { floorY: spot.y, intensity: 1.1 });
      for (let k = 0; k < 6; k++) well.drip(k % 2 === 0 ? -1 : 1, true);
    }
  }
  S.bucketY = HANG;
  S.brim = true;
  S.glow = 2;
  // ---- CATCH + SPILL
  sfx('e_wellCatch');
  S.spill = true;
  sfx('e_wellSpill');
  pool.setIntensity(0.8, 200);
  await run(sc, T.swingMs, (t) => {
    const k = Math.floor(t * 4);
    S.tilt = [ANG / 2, -ANG / 2, ANG / 4, 0][Math.min(3, k)];
  });
  S.tilt = 0;
  el += T.swingMs;

  // ---- TIP toward the hand: the bail creaks
  const dir = handTarget().x >= spot.x ? 1 : -1;
  sfx('e_wellTip');
  for (let k = 1; k <= 3; k++) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
    el += T.tipStepMs;
  }

  // ---- LEAPS: each card bursts straight up out of the bucket like a fish, flicks to its apex, falls into the hand
  const pile = ctx.views.field.pile(player, 'deck');
  const flights: Promise<unknown>[] = [];
  /** Cards registered in the hand (hidden) but still in the air: their hand sprites stay invisible. */
  const airborne = new Set<Uid>();
  let prevLanded: Promise<void> = Promise.resolve();
  let prevApex: XY | null = null;
  /** the shaking (second) card's apex is reserved first: the first hop keeps out of its air */
  const reserved = draws.length > 1 ? planLeap(obst, well.mouth(), handTarget(), sizes, leapOpts(1, handTarget().x >= spot.x ? 1 : -1, spot, null, mini, player)).P : null;
  /** units a planned path still crosses: dimmed while the cards fly */
  const crossed = new Set<Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject>();
  const dimUnder = (pl: LeapPlan) => {
    for (const b of obst) {
      if (b.uid === undefined) continue;
      let hit = false;
      for (let i = 1; i <= 12 && !hit; i++) {
        const k = i / 12;
        const q = k <= 0.35 ? riseAt(pl, k / 0.35) : fallAt(pl, (k - 0.35) / 0.65);
        const si = k <= 0.35 ? pl.apex : Math.min(sizes.length - 2, pl.apex + Math.floor(((k - 0.35) / 0.65) * (sizes.length - 1 - pl.apex)));
        const [w, h] = sizes[si];
        if (overlap(rectAt(q, w * 0.8, h * 0.8, 0, 0), b) > 40) hit = true;
      }
      const u = hit ? ctx.unit(b.uid) : null;
      if (!u) continue;
      // the monster stays solid (0.85: never a ghost); only its HP plate steps well back
      ([[u.sprite, 0.85], [u.badge.image, 0.45]] as [Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.GameObject, number][]).forEach(([g, a]) => {
        if (!g || !g.active || crossed.has(g)) return;
        crossed.add(g);
        void tween(sc, { targets: g, alpha: a, duration: 100 });
      });
    }
  };
  const undimCrossed = () => {
    for (const g of crossed) if (g.active) void tween(sc, { targets: g, alpha: 1, duration: 160 });
    crossed.clear();
  };
  const miniCount = (): number => (hand as unknown as { miniCount?: number[] }).miniCount?.[player] ?? 0;
  const register = (uid: Uid, cardId: CardId, from: XY) => {
    if (!owner) return;
    // the hand makes room now (its re-fan); its own flight is hidden and never completes (no cardDraw / cardPlace)
    flights.push(hush(['cardDraw'], () => hand.addCard(uid, cardId, from, player)).catch(() => undefined));
    airborne.add(uid);
    const spr = hand.sprite(uid);
    spr?.setTrail(false);
    spr?.setVisible(false);
  };
  const settle = (uid: Uid) => {
    airborne.delete(uid);
    if (!owner) {
      // the other player's mini-hand: the card has shrunk into it — one more mini card, no second flight
      hand.setOpponentCount(player, miniCount() + 1, true);
      return;
    }
    // rebuild the hand with the card at rest (the hidden flight ends without its landing sound)
    const list = hand.uids.map((u) => ({ uid: u, cardId: hand.sprite(u)?.cardId ?? null })).filter((c): c is { uid: Uid; cardId: CardId } => c.cardId !== null);
    hand.setCards(list, player);
    for (const u of airborne) hand.sprite(u)?.setVisible(false);
    const spr = hand.sprite(uid);
    if (spr && !hand.isFaceDown) {
      spr.setFaceUp(false);
      void spr.flip(true, 150);
    }
  };
  /** The well's clock (scene ms) at the last landing tap: the last-turn clicks duck under it. */
  let tapAt = -1e9;
  const leapOne = (k: number): { apex: Promise<void>; pre: Promise<void>; tapped: Promise<void>; done: Promise<void> } => {
    const di = draws[k];
    const d = evAt(ctx, di, 'draw');
    if (!d) return { apex: Promise.resolve(), pre: Promise.resolve(), tapped: Promise.resolve(), done: Promise.resolve() };
    ctx.consumeAt(di);
    const m = well.mouth();
    const target = handTarget();
    const plan = planLeap(obst, m, target, sizes, leapOpts(k, dir, spot, k === 0 ? reserved : prevApex, mini, player));
    prevApex = plan.P;
    if (WELL_DEBUG) console.error('[well] plan', k, JSON.stringify({ spot, plan, obst: obst.map((b) => [b.x0, b.y0, b.x1, b.y1, b.w, b.uid ?? -1].map((v) => Math.round(v))) }));
    dimUnder(plan);
    const rise = R(Math.max(120, Math.min(200, 70 + Math.hypot(plan.P.x - plan.B.x, plan.P.y - plan.B.y) * 2.2)));
    const fall = R(Math.max(T.leapMin - 120, Math.min(T.leapMax - 160, 150 + Math.hypot(target.x - plan.P.x, target.y - plan.P.y) * 0.95)));
    sfx('e_wellLeap', { pitch: k === 0 ? 1 : 1.07 });
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const top = pile.topXY();
    void lightFlash(sc, top.x, top.y - 6, PAL.teal3, 18, 240, { floorY: top.y, intensity: 0.5 });
    void lightFlash(sc, m.x, m.y - 10, PAL.teal4, 34, 280, { floorY: spot.y, intensity: 1 });
    S.flare = S.el - 40; // a small crown: the water jumps with the card
    S.ripples.push(S.el, S.el + 70);
    for (let q = 0; q < 4; q++) well.drip(q % 2 === 0 ? -1 : 1, true);
    const waitPrev = prevLanded;
    let registered: Promise<void> | null = null;
    let preResolve: () => void = () => undefined;
    const pre = new Promise<void>((r) => (preResolve = r));
    let tapResolve: () => void = () => undefined;
    const tapped = new Promise<void>((r) => (tapResolve = r));
    let flutter: { stop(ms?: number): void } | null = null;
    const lp = leapCard(sc, player, d.uid * 31 + k, {
      plan,
      sizes,
      rise,
      fall,
      shake: k === 1,
      shakeStepMs: T.shakeStepMs,
      lead: owner ? T.handLead : 0,
      plainEnd: owner,
      onLead: () => {
        // never before the previous card is settled in the fan (its slot would move under it)
        registered = waitPrev.then(() => register(d.uid as Uid, d.cardId, lp.pos()));
      },
      onShake: (i) => {
        if (i === 0) sfx('e_wellShake', { pan: panAt(plan.P.x) });
      },
      // the paper flutter carries the whole fall down to the hand, and stops on the flop
      onFall: () => {
        flutter = startV3('e_wellFall', { volume: owner ? 1 : 0.6, pitch: k === 0 ? 1 : 1.05, pan: panAt((plan.P.x + target.x) / 2) });
      },
      onFlop: () => {
        flutter?.stop(30);
        flutter = null;
        tapAt = S.el;
        sfx('e_wellTap', { pitch: k === 0 ? 1 : 1.06, pan: panAt(target.x), volume: owner ? 1 : 0.6 });
        tapResolve();
      },
      // the bucket lets go a beat before the last card lands (the drop's freewheel runs under its landing)
      preLand: { ms: 150, fn: () => preResolve() },
    });
    const done = (async () => {
      await lp.landed;
      await (registered ?? Promise.resolve());
      await waitPrev;
      settle(d.uid as Uid);
      // the wet card lands: a few drops fall off its bottom edge, a soft teal blink on the slot
      const sp = new PxSparks(sc, DEPTH.HAND + 31);
      const rnd = fxRng(d.uid * 7 + 3);
      const [tw, th] = sizes[sizes.length - 1];
      for (let q = 0; q < (owner ? 7 : 3); q++) sp.add({ x: R(target.x - tw / 2 + rnd() * tw), y: R(target.y - th / 2 + 4 + rnd() * 8), vx: (rnd() - 0.5) * 50, vy: -(30 + rnd() * 50), ay: 520, life: 260 + rnd() * 140, colors: [PAL.white, PAL.water4, PAL.teal3], shape: 'px', fadeAt: 1 });
      sp.release();
      void lightFlash(sc, target.x, target.y - th / 4, PAL.teal4, owner ? 30 : 14, 220, { intensity: 0.6 });
      lp.destroy();
    })();
    prevLanded = done;
    void done.then(() => {
      preResolve();
      tapResolve();
      flutter?.stop(30);
    });
    return { apex: lp.apexDone, pre, tapped, done };
  };
  const leap1 = leapOne(0);
  let leap2: ReturnType<typeof leapOne> | null = null;
  if (draws.length > 1) {
    await wait(sc, T.leapGap);
    leap2 = leapOne(1);
    await wait(sc, T.tipBackAfter);
  } else await leap1.done;
  const landedAll = async () => {
    await leap1.done;
    if (leap2) await leap2.done;
    undimCrossed();
  };

  // ---- SEAL EDGE: the duel is won — the bucket drops and the well dissolves at once (no last turn)
  if (wins) {
    S.spill = false;
    S.brim = false;
    sfx('e_wellDown', { volume: 0.8 });
    sfx('e_wellFade');
    void pool.fadeOut(T.sealTearMs);
    const y0 = S.bucketY;
    const t0 = S.tilt;
    bg(run(sc, T.sealTearMs * 0.6, (t) => {
      S.bucketY = R(y0 + (DEEP - y0) * t * t);
      S.tilt = t0 * (1 - t);
    }));
    S.fadeEnd = S.el + T.sealTearMs;
    await run(sc, T.sealTearMs, (t) => (S.cut = Math.floor((t * H) / 2) * 2));
    well.stop();
    undim();
    undimCrossed();
    const g = evAt(ctx, gi, 'toGraveyard');
    if (g && !ctx.isConsumed(gi)) {
      ctx.consumeAt(gi);
      void cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x, y: spot.y - 6 }, lift: 26 });
    }
    await Promise.race([Promise.all(flights), wait(sc, 120)]);
    return;
  }

  // the bucket tips back (the water is spent: no more dome) — a softer creak
  S.spill = false;
  sfx('e_wellTip', { volume: 0.55, pitch: 0.9 });
  for (let k = 2; k >= 0; k--) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
  }
  S.brim = false;
  pool.setIntensity(0.5, 300);
  // the cards land first: the bucket lets go a beat (150 ms) before the last one reaches the hand
  await (leap2 ? leap2.pre : leap1.pre);

  // ---- DROP: the ratchet freewheels, the bucket falls back into the shaft and plops
  sfx('e_wellDown');
  const c0 = S.crank;
  const y0 = S.bucketY;
  await run(sc, T.dropMs, (t) => {
    const k = t * t;
    S.bucketY = R(y0 + (DEEP - y0) * k);
    S.crank = c0 - Math.floor(t * 10) * (TAU / 8);
    S.drum = 24 - t * 24;
  });
  S.bucketY = DEEP;
  S.glow = 3;
  S.ripples.push(S.el, S.el + 60, S.el + 130);
  S.flare = S.el - 60;
  bg(floorFx(sc, spot, 'plop'));
  // the spent card rises out of the well's mouth with the plop and goes to the graveyard
  let send: Promise<void> = Promise.resolve();
  const g = evAt(ctx, gi, 'toGraveyard');
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x, y: spot.y - 6 }, lift: 26 });
  }
  void lightFlash(sc, spot.x, spot.y - 10, PAL.teal4, 34, 280, { floorY: spot.y, intensity: 1 });
  for (let k = 0; k < 10; k++) well.drip(k % 2 === 0 ? -1 : 1, true);
  // ---- LAST TURN (the dissolve starts on its 5th tooth and eats it from the top while it finishes)
  let fade: Promise<void> = Promise.resolve();
  for (let i = 0; i < 8; i++) {
    S.crank += TAU / 8;
    // (ducked under a landing tap so the second card's landing is heard)
    if (i < 7) sfx('e_wellClick', { pitch: 1.02 - i * 0.02, volume: S.el - tapAt < 260 ? 0.35 : 0.5 });
    if (i === 4) {
      // ---- DISSOLVE into teal motes (top down); the light fades
      sfx('e_wellFade');
      void pool.fadeOut(360);
      S.fadeEnd = S.el + T.fadeMs;
      fade = run(sc, T.fadeMs, (t) => (S.cut = Math.floor((t * H) / 2) * 2));
    }
    await wait(sc, T.lastStepMs + i * 2);
  }
  // the last tooth never masks the last landing: at least 120 ms after its tap
  await (leap2 ? leap2.tapped : leap1.tapped);
  if (S.el - tapAt < 120) await wait(sc, 120 - (S.el - tapAt));
  sfx('e_wellLast');
  S.glow = 1;
  await fade;
  well.stop();
  undim();
  await landedAll();
  await Promise.race([Promise.all(flights), wait(sc, 60)]);
  await send;
});
