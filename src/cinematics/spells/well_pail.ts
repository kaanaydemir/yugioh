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
//   ~400   RELEASE: the card pours into an orb at its bottom edge that hops onto the well's tile — the caster's free
//          spell/trap tile nearest to the cast spot that no unit covers (a set card: its own tile unless a unit stands
//          in front of it or its plate would cross the windlass) — the floor is never opened
//   W+0    LAND: a teal ring runs out on the tile, a rune ellipse flashes for two frames, the light pool comes on
//   W+30   THE STONE RING builds itself in three courses, each course popping a stone grit — e_wellStone ×3
//   W+170  THE WINDLASS: two wooden posts shoot up, the axle with its rope drum drops into the forks — e_wellFrame.
//          The crank always sits on the side that faces the board's centre (P2's well is mirrored)
//   W+280  THE CRANK turns by itself: 2 turns in 16 stepped angles, slow → fast; the rope coils scroll round the
//          drum, the bucket climbs the shaft; the light pool swells and widens with the speed — e_wellClick on EVERY
//          step, e_wellRope at the first steps
//   ~W+560 the bucket BREAKS THE SURFACE: a crown of water flares out of the mouth, caustic light runs out over the
//          neighbouring tiles — e_wellSlosh
//   W+720  the crank stops: the pawl catches — e_wellCatch; the bucket hangs under the drum, swinging, BRIMMING with
//          glowing water (a domed teal surface, glints), 2-px streams run over both lips; drops splash in the shaft,
//          on the ring stones and on the floor — e_wellSpill (the card's separating layer)
//   W+870  the bucket TIPS toward the caster's hand (three stepped angles)
//   W+960  LEAP 1: a card bursts out of the water like a fish — a splash crown, the card growing through nine native
//          sizes (6×8 → 48×68, never scaled) along ONE low ballistic arc (rise ≈ 24 px) that ends in the hand's next
//          slot; a wet rim, a teal under-glow light, droplets all along the path — e_wellLeap ("şlap-gloop-fwip").
//          At the slot the card IS the hand's card (same 48×68 back, same pixel): the hand only turns it face-up
//          (its own sharp turn frames) — e_wellTap (a wet paper tap + one drip). No generic draw flight, no
//          cardDraw / cardPlace.
//   W+1180 LEAP 2: the second card leaps the same way; at the top of its arc it SHAKES THE WATER OFF — seven hard
//          side-to-side jerks (±4 px, stepped π/16), a ring of droplets thrown at each reversal — e_wellShake; then it
//          falls on into the hand — e_wellTap
//   after  the bucket tips back; it DROPS: the ratchet freewheels, the bucket PLOPS — e_wellDown; the spent card is
//          born beside the well (toward the graveyard) and leaves; the crank's LAST TURN — e_wellLast; THE WELL
//          DISSOLVES from the top down into rising teal motes — e_wellFade
// EDGE — the first draw completes the five seals: no second draw; as soon as the seal lands the bucket drops and the
// well dissolves at once (≈ 300 ms, no last turn) so the win follows the seal card's arrival.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { PlayerId, Uid } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { cardBackCanvas } from '../../art/cards';
import { PixelCanvas } from '../../art/pixel';
import { BOARD_CENTER, DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { tween, wait } from '../../vfx/core';
import { fxRng } from '../_v3/spellfx';
import { hush, panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves } from '../_v3/card';
import { registerCardHook } from '../api';
import { bg, castFloor, castSpot, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx } from './_kit';
import type { SfxName } from '../../audio/sfx';

const ID: CardId = 'well_pail';
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
  shakeStepMs: 34,
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
  // streams over the lips: two columns wide, flowing (the tones scroll down), bending out from the staves
  const tilted = Math.abs(s.tilt) > 0.05;
  const lips: number[] = tilted ? [Math.sign(s.tilt)] : [-1, 1];
  for (const side of lips) {
    const lip = bucketAt(s, side * 9, 4.4);
    const len = tilted ? 20 : 14;
    for (let k = 0; k < len; k++) {
      const flow = (k + Math.floor(s.el / 40)) % 3;
      const x = lip.x + side * (k < 4 ? k * 0.45 : 1.8);
      put(x - 0.5, lip.y - 0.5 + k, flow === 0 ? PAL.white : PAL.water4);
      put(x - 0.5 + side, lip.y - 0.5 + k, flow === 1 ? PAL.water4 : PAL.teal3);
      if (tilted && k > 2) put(x - 0.5 + side * 2, lip.y - 0.5 + k, flow === 2 ? PAL.teal4 : PAL.teal2);
    }
  }
}

/** The breach: a crown of water jumps out of the mouth (columns of light, tallest in the middle), 180 ms. */
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
            motes.add({ x: ox + x, y: oy + y, vx: (rnd() - 0.5) * 16, vy: -(26 + rnd() * 40), drag: 1.2, life: 280 + rnd() * 260, colors: [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2], shape: rnd() < 0.15 ? 'plus' : 'px', fadeAt: 1 });
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
const APEX_SIZE = 4;
const LAST = LEAP_SIZES.length - 1;
const ANG = Math.PI / 16;

/**
 * Paint the player's face-down card (the real v3 back sampled whole-pixel at w × h), turned by `a`, centred in `p`.
 * Airborne it is WET: a bright 1-px rim on its lit top / left edges, a band of water light sliding over it, an ink
 * outline. `plain`: the hand's own picture (the last frame — no rim, no sheen, no extra outline, angle 0).
 */
function paintCard(p: PixelCanvas, back: PixelCanvas, rim: number, w: number, h: number, a: number, sheen: number, plain: boolean): void {
  const cx = p.w / 2;
  const cy = p.h / 2;
  const c = Math.cos(a);
  const n = Math.sin(a);
  const hw = w / 2;
  const hh = h / 2;
  for (let y = 0; y < p.h; y++)
    for (let x = 0; x < p.w; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const u = dx * c + dy * n;
      const v = -dx * n + dy * c;
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

interface Leap {
  /** The card's world point now. */
  pos(): XY;
  /** Resolves when the card reaches the end of its arc (the hand's slot). */
  landed: Promise<void>;
  destroy(): void;
}

interface LeapOpts {
  ms: number;
  rise: number;
  /** The second card: shake the water off at the top of the arc (ms of the shake, 0: none). */
  shakeSteps: number;
  shakeStepMs: number;
  /** Called once, `lead` ms (scene time) before the landing. */
  lead: number;
  onLead: () => void;
  /** Called at each shake reversal (the sound plays on the first). */
  onShake?: (i: number) => void;
}

/** One ballistic arc from `from` to `to` that rises `rise` px first (a fish leaping up, then falling into the hand). */
function arcAt(from: XY, to: XY, rise: number, t: number): XY {
  const dy = to.y - from.y;
  const a = 2 * rise + Math.sqrt(4 * rise * rise + 4 * rise * Math.max(-rise * 0.9, dy));
  const b = dy + a;
  return { x: from.x + (to.x - from.x) * t, y: from.y - a * t + b * t * t };
}

function apexT(from: XY, to: XY, rise: number): number {
  const dy = to.y - from.y;
  const a = 2 * rise + Math.sqrt(4 * rise * rise + 4 * rise * Math.max(-rise * 0.9, dy));
  return Math.min(0.6, a / (2 * (dy + a)));
}

function leapCard(sc: Phaser.Scene, from: XY, to: XY, player: PlayerId, seed: number, o: LeapOpts): Leap {
  const BOX = 84;
  const ras = new Raster(sc, from.x - BOX / 2, from.y - BOX / 2, BOX, BOX, DEPTH.HAND + 30);
  const pc = new PixelCanvas(BOX, BOX);
  const drops = new PxSparks(sc, DEPTH.HAND + 29);
  const rnd = fxRng(seed);
  const back = cardBackCanvas(player);
  const rim = PLAYER_RAMP[player][3];
  const dir = to.x >= from.x ? 1 : -1;
  const ta = apexT(from, to, o.rise);
  let pos: XY = { ...from };
  let ang = 0;
  let size = 0;
  let sheen = 0;
  let plain = false;
  let dead = false;
  // the teal light the wet card carries (it lights the floor and the cards under it)
  const glow = lightPool(sc, from.x, from.y, { color: PAL.teal3, radius: 18, intensity: 0, floorY: from.y + 10 });
  glow.setIntensity(0.85, 80);
  glow.follow(() => (dead ? null : { x: pos.x, y: pos.y }));
  const draw = () => {
    if (dead) return;
    pc.clear();
    const [w, h] = LEAP_SIZES[size];
    paintCard(pc, back, rim, w, h, plain ? 0 : ang, sheen, plain);
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  };
  const trail = (dt: number) => {
    if (dt <= 0) return;
    const [w, h] = LEAP_SIZES[size];
    const n = size >= 5 ? 2 : 1;
    for (let k = 0; k < n; k++)
      drops.add({ x: R(pos.x - dir * (w / 2) * rnd()), y: R(pos.y + h / 2 - 1), vx: (rnd() - 0.5) * 18 - dir * 10, vy: 8 + rnd() * 26, ay: 560, life: 260 + rnd() * 220, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
  };
  // the splash crown where it breaks out of the water
  for (let k = 0; k < 18; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    drops.add({ x: from.x + side * R(rnd() * 5), y: from.y, vx: side * (14 + rnd() * 56), vy: -(60 + rnd() * 90), ay: 620, life: 320 + rnd() * 180, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: rnd() < 0.15 ? 'plus' : 'px', fadeAt: 1 });
  }
  const sizeAt = (t: number) => {
    if (t <= ta) return Math.min(APEX_SIZE, Math.floor(Math.pow(t / ta, 0.7) * (APEX_SIZE + 0.999)));
    const f = (t - ta) / (1 - ta);
    return Math.min(LAST - 1, APEX_SIZE + Math.floor(Math.pow(f, 1.25) * (LAST - APEX_SIZE)));
  };
  const wriggle = (t: number) => {
    const fade = t > 0.8 ? 0 : 1 - t / 0.8;
    const wr = dir * 0.45 * (t < ta ? 1 - t / ta : 0) + Math.sin(t * Math.PI * 4) * 0.34 * fade - dir * 0.22 * Math.sin(Math.min(1, Math.max(0, (t - ta) / (1 - ta))) * Math.PI) * fade;
    const s = sizeAt(t);
    const lim = s >= 7 ? 0 : s >= 6 ? ANG : 2 * ANG;
    return Math.max(-lim, Math.min(lim, Math.round(wr / ANG) * ANG));
  };
  let leadDone = false;
  const lead = () => {
    if (leadDone) return;
    leadDone = true;
    o.onLead();
  };
  const fly = async (t0: number, t1: number, ms: number, totalLeft: number) => {
    await run(sc, ms, (k, el, dt) => {
      if (dead) return;
      const t = t0 + (t1 - t0) * k;
      pos = arcAt(from, to, o.rise, t);
      size = sizeAt(t);
      ang = wriggle(t);
      sheen = (el / 20) % 40 - 10;
      trail(dt);
      if (totalLeft - ms * k <= o.lead) lead();
      draw();
    });
  };
  const landed = (async () => {
    if (o.shakeSteps > 0) {
      // the shake happens just past the top of the arc (clear of the duelist and the portrait behind the well)
      const ts = Math.min(0.45, ta + 0.1);
      const up = o.ms * ts;
      await fly(0, ts, up, o.ms + o.shakeSteps * o.shakeStepMs);
      // the shake: hard side-to-side jerks, stepped π/16, a ring of droplets thrown at each reversal
      const apex = arcAt(from, to, o.rise, ts);
      const jerks = [4, -4, 4, -3, 3, -2, 1, 0];
      for (let i = 0; i < Math.min(o.shakeSteps, jerks.length); i++) {
        if (dead) break;
        pos = { x: apex.x + jerks[i], y: apex.y + (i % 2 === 0 ? -1 : 0) };
        ang = jerks[i] === 0 ? 0 : Math.sign(jerks[i]) * ANG;
        size = sizeAt(ts);
        sheen = (i * 9) % 40 - 10;
        o.onShake?.(i);
        if (i < 6) {
          const [w, h] = LEAP_SIZES[size];
          const n = 12 - i;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU + rnd() * 0.3;
            const sp = 70 + rnd() * 60 + (i < 2 ? 30 : 0);
            drops.add({ x: R(pos.x + Math.cos(a) * (w / 2 + 1)), y: R(pos.y + Math.sin(a) * (h / 2 + 1)), vx: Math.cos(a) * sp + Math.sign(jerks[i]) * 30, vy: Math.sin(a) * sp - 20, ay: 480, life: 300 + rnd() * 200, colors: [PAL.white, PAL.water4, PAL.teal4, PAL.teal3], shape: k % 4 === 0 ? 'plus' : 'px', fadeAt: 1 });
          }
        }
        draw();
        await wait(sc, o.shakeStepMs);
      }
      await fly(ts, 1, o.ms - up, o.ms - up);
    } else await fly(0, 1, o.ms, o.ms);
    if (dead) return;
    lead();
    // the last frame: the hand's own card — 48×68, upright, its plain back, exactly on the slot
    pos = { x: R(to.x), y: R(to.y) };
    size = LAST;
    plain = true;
    draw();
  })();
  return {
    pos: () => ({ ...pos }),
    landed,
    destroy() {
      if (dead) return;
      dead = true;
      ras.destroy();
      drops.release();
      void glow.fadeOut(160);
    },
  };
}

// ================================================================ where the well stands

/** Units whose sprite / plate the well would collide with at `c`: 'front' hides the ring, 'behind' crosses the windlass. */
function unitsNear(ctx: ActCtx, c: XY): { front: number; behind: Uid[] } {
  let front = 0;
  const behind: Uid[] = [];
  for (const p of [0, 1] as PlayerId[])
    ctx.state.players[p].monsters.forEach((m, i) => {
      if (!m) return;
      const u = zoneXY(p, 'monster', i);
      if (Math.abs(u.x - c.x) > 40) return;
      if (u.y >= c.y - 2 && u.y < c.y + 60) front++;
      else if (u.y < c.y - 2 && u.y > c.y - 74) behind.push(m.uid);
    });
  return { front, behind };
}

/**
 * The tile the well stands on: the set card's own tile, or the caster's free spell/trap tile nearest the cast spot —
 * whichever no unit stands in front of (it would hide the ring) and, second, whose windlass no plate crosses.
 */
function wellSpot(ctx: ActCtx, player: PlayerId, setHome: XY | null): XY {
  const pref = setHome ?? castSpot(player);
  const cands: XY[] = [];
  if (setHome) cands.push({ x: R(setHome.x), y: R(setHome.y) });
  ctx.state.players[player].spellTraps.forEach((slot, i) => {
    if (slot) return;
    const z = zoneXY(player, 'spellTrap', i);
    cands.push({ x: R(z.x), y: R(z.y) });
  });
  let best: XY | null = null;
  let bd = Infinity;
  for (const c of cands) {
    const n = unitsNear(ctx, c);
    const d = n.front * 10000 + n.behind.length * 1000 + Math.hypot(c.x - pref.x, c.y - pref.y);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (best) return best;
  const cs = castSpot(player);
  return { x: cs.x, y: castFloor(cs) };
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
  const set = setTileOf(ctx);
  const spot = wellSpot(ctx, player, set ? ip(set.home) : null);
  const side: 1 | -1 = BOARD_CENTER.x >= spot.x ? 1 : -1;
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
  const dimmed = unitsNear(ctx, spot)
    .behind.map((u) => ctx.unit(u)?.badge.image ?? null)
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
    sfx('e_wellClick', { pitch: 1 + f * 0.22, volume: 0.8 + f * 0.2 });
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

  // ---- TIP toward the hand
  const hand = ctx.views.hand;
  const cam = sc.cameras.main;
  const scroll = (p: XY): XY => ({ x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)) });
  const worldOf = (p: XY): XY => ({ x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)) });
  const owner = hand.owner === player;
  const handTarget = worldOf(owner ? hand.nextSlotXY() : hand.miniXY(player));
  const dir = handTarget.x >= spot.x ? 1 : -1;
  for (let k = 1; k <= 3; k++) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
    el += T.tipStepMs;
  }

  // ---- LEAPS: each card bursts out of the bucket like a fish along one arc into the hand
  const pile = ctx.views.field.pile(player, 'deck');
  const flights: Promise<unknown>[] = [];
  /** Cards registered in the hand (hidden) but still in the air: their hand sprites stay invisible. */
  const airborne = new Set<Uid>();
  let prevLanded: Promise<void> = Promise.resolve();
  const register = (uid: Uid, cardId: CardId, from: XY) => {
    // the hand makes room now (its re-fan); its own flight is hidden and never completes (no cardDraw / cardPlace)
    flights.push(hush(['cardDraw'], () => hand.addCard(uid, cardId, scroll(from), player)).catch(() => undefined));
    if (!owner) return;
    airborne.add(uid);
    const spr = hand.sprite(uid);
    spr?.setTrail(false);
    spr?.setVisible(false);
  };
  const settle = (uid: Uid) => {
    airborne.delete(uid);
    if (!owner) return;
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
  const leapOne = (k: number, shake: boolean): Promise<void> => {
    const di = draws[k];
    const d = evAt(ctx, di, 'draw');
    if (!d) return Promise.resolve();
    ctx.consumeAt(di);
    const m = well.mouth();
    const target = worldOf(owner ? hand.nextSlotXY() : hand.miniXY(player));
    const dist = Math.hypot(target.x - m.x, target.y - m.y);
    const ms = Math.max(T.leapMin, Math.min(T.leapMax, T.leapBase + dist * T.leapPerPx));
    sfx('e_wellLeap', { pitch: k === 0 ? 1 : 1.07 });
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const top = pile.topXY();
    void lightFlash(sc, top.x, top.y - 6, PAL.teal3, 18, 240, { floorY: top.y, intensity: 0.5 });
    void lightFlash(sc, m.x, m.y - 10, PAL.teal4, 34, 280, { floorY: spot.y, intensity: 1 });
    S.ripples.push(S.el, S.el + 70);
    for (let q = 0; q < 4; q++) well.drip(q % 2 === 0 ? -1 : 1, true);
    const waitPrev = prevLanded;
    let registered: Promise<void> | null = null;
    const lp = leapCard(sc, m, target, player, d.uid * 31 + k, {
      ms,
      rise: shake ? 22 : 18,
      shakeSteps: shake ? 8 : 0,
      shakeStepMs: T.shakeStepMs,
      lead: owner ? T.handLead : 0,
      onLead: () => {
        // never before the previous card is settled in the fan (its slot would move under it)
        registered = waitPrev.then(() => register(d.uid as Uid, d.cardId, lp.pos()));
      },
      onShake: (i) => {
        if (i === 0) sfx('e_wellShake', { pan: panAt(target.x * 0.3 + m.x * 0.7) });
      },
    });
    const done = (async () => {
      await lp.landed;
      await (registered ?? Promise.resolve());
      if (owner) settle(d.uid as Uid);
      sfx('e_wellTap', { pitch: k === 0 ? 1 : 1.06, pan: panAt(target.x) });
      // the wet card lands: a few drops fall off its bottom edge, a soft teal blink on the slot
      const sp = new PxSparks(sc, DEPTH.HAND + 31);
      const rnd = fxRng(d.uid * 7 + 3);
      for (let q = 0; q < 7; q++) sp.add({ x: R(target.x - 20 + rnd() * 40), y: R(target.y - 30 + rnd() * 8), vx: (rnd() - 0.5) * 50, vy: -(30 + rnd() * 50), ay: 520, life: 260 + rnd() * 140, colors: [PAL.white, PAL.water4, PAL.teal3], shape: 'px', fadeAt: 1 });
      sp.release();
      void lightFlash(sc, target.x, target.y - 20, PAL.teal4, 30, 220, { intensity: 0.6 });
      lp.destroy();
    })();
    prevLanded = done;
    return done;
  };
  const leap1 = leapOne(0, false);
  let leap2: Promise<void> = Promise.resolve();
  if (draws.length > 1) {
    await wait(sc, T.leapGap);
    el += T.leapGap;
    leap2 = leapOne(1, true);
    await wait(sc, T.tipBackAfter);
    el += T.tipBackAfter;
  } else await leap1;

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
    await run(sc, T.sealTearMs, (t) => (S.cut = Math.floor((t * H) / 2) * 2));
    well.stop();
    undim();
    const g = evAt(ctx, gi, 'toGraveyard');
    if (g && !ctx.isConsumed(gi)) {
      ctx.consumeAt(gi);
      void cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: besideWell(spot, player) });
    }
    await Promise.race([Promise.all(flights), wait(sc, 120)]);
    return;
  }

  // the bucket tips back (the water is spent: no more dome)
  S.spill = false;
  for (let k = 2; k >= 0; k--) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
    el += T.tipStepMs;
  }
  S.brim = false;
  pool.setIntensity(0.5, 300);
  await leap1;
  await leap2;
  await wait(sc, 60);

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
  let send: Promise<void> = Promise.resolve();
  const g = evAt(ctx, gi, 'toGraveyard');
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: besideWell(spot, player), delay: 120 });
  }
  void lightFlash(sc, spot.x, spot.y - 10, PAL.teal4, 34, 280, { floorY: spot.y, intensity: 1 });
  for (let k = 0; k < 10; k++) well.drip(k % 2 === 0 ? -1 : 1, true);
  // ---- LAST TURN
  for (let i = 0; i < 8; i++) {
    S.crank += TAU / 8;
    if (i < 7) sfx('e_wellClick', { pitch: 1.02 - i * 0.02, volume: 0.5 });
    await wait(sc, T.lastStepMs + i * 2);
  }
  sfx('e_wellLast');
  S.glow = 1;
  await wait(sc, 40);

  // ---- DISSOLVE into teal motes (top down); the light fades
  sfx('e_wellFade');
  void pool.fadeOut(360);
  await run(sc, T.fadeMs, (t) => (S.cut = Math.floor((t * H) / 2) * 2));
  well.stop();
  undim();
  await Promise.race([Promise.all(flights), wait(sc, 200)]);
  await send;
});

/** The spent card's birth point: beside the well, on the graveyard's side (never on the ring). */
function besideWell(spot: XY, player: PlayerId): XY {
  const gy = zoneXY(player, 'graveyard');
  const sx = Math.sign(gy.x - spot.x) || 1;
  return { x: spot.x + sx * (RX + 12), y: spot.y + 4 };
}
