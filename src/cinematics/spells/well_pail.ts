// Kuyu Kovası (well_pail) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S1; lane E). The v1 look keeps the generic
// spell activation and the plain draws: the hook steps aside without ?look=v3.
//
// "Oyuncunun tarafında (zemin açılmadan, karonun üstüne) taştan küçük bir kuyu bileziği ve ahşap çıkrık belirir →
//  çıkrık kolu kendiliğinden döner, ip sarılır (cırcır) → ağzına kadar ışıklı su dolu bir kova yükselir, kenarından su
//  taşar → kova eğilir, sudan iki kart balık gibi sıçrayıp ele uçar (ikincisi suyu silkeler) → kova geri iner, çıkrık
//  son bir tur atar, kuyu turkuaz zerrelere çözülür. Yüz, testi, çömlek yok."
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Signature ≈ 2.5 s after the opening.
//   0      common v3 spell opening (spells/_kit): a hand card flies beside its owner (a set card stands up on its own
//          tile), "KUYU KOVASI" plate, short hover (hold 240 → 156)
//   ~400   RELEASE: the card pours into an orb at its bottom edge that hops onto the well's tile — the caster's free
//          spell/trap tile nearest to the cast spot (a set card: its own tile) — the floor is never opened
//   W+0    LAND: a teal ring runs out on the tile, a rune ellipse flashes for two frames, the light pool comes on
//   W+30   THE STONE RING builds itself in three courses (3 → 6 → 9 px), each course popping a stone grit — e_wellStone ×3
//          (pitched up per course); the shaft inside is black with a faint teal glimmer of water far below
//   W+170  THE WINDLASS: two wooden posts shoot up (two stepped heights), the axle with its rope drum drops into the
//          forks from 6 px above (W+250) — e_wellFrame (its three clacks land on these frames)
//   W+280  THE CRANK turns by itself: 2 turns in 16 stepped angles, slow → fast (46 → 19 ms a step); the rope coils
//          scroll round the drum, the rope shortens, the bucket climbs the shaft — e_wellClick on EVERY step (the 330 Hz
//          ratchet, its pitch rising with the speed), e_wellRope (fibres take the weight) at the first steps
//   ~W+560 the bucket BREAKS THE SURFACE inside the mouth: the shaft's water flares, e_wellSlosh; the light swells
//   W+720  the crank stops: the pawl catches — e_wellCatch; the bucket hangs under the drum, swinging one step each way,
//          BRIMMING with glowing water (a teal dome over the lip, glints running), water RUNS OVER BOTH LIPS in 1-px
//          streams and drips back into the well — ripples in the shaft — e_wellSpill (the card's separating layer)
//   W+870  the bucket TIPS toward the caster's hand (three stepped angles); the low lip pours a 2-px stream
//   W+960  LEAP 1: a card bursts out of the water like a fish — a splash crown, the card growing in five native sizes
//          (6×8 → 24×34, never scaled) on a rising, wriggling arc (stepped π/16 angles), droplets streaming off its
//          tail, the deck pile bumps — e_wellLeap ("şlap-fwip"); at its apex (250 ms) the hand takes it over
//          (HandView.addCard: the reveal flip and the landing in the fan are the hand's own)
//   W+1180 LEAP 2: the second card leaps the same way; at its apex it SHAKES THE WATER OFF — five hard side-to-side
//          jerks, three radial bursts of droplets — e_wellShake; then the hand takes it
//   W+1330 the bucket tips back; W+1620 it DROPS: the ratchet freewheels (the crank whirls backward 10 steps), the
//          bucket falls into the shaft and PLOPS — a splash jumps out of the mouth, the glimmer flares — e_wellDown
//   W+1840 the crank's LAST TURN (8 slow steps, soft clicks) ending on one bright tooth — e_wellLast
//          (the spent card is born on the tile at the plop and leaves for the graveyard: cardLeaves)
//   W+2060 THE WELL DISSOLVES from the top down into rising teal motes (300 ms) — e_wellFade; the light fades
// EDGE — the first draw completes the five seals: the duel is won on the spot, there is no second draw: the second
// leap is skipped, the bucket drops at once and the well dissolves before the game-over presentation plays.
// P2: the well stands on P2's tile (upper right); the cards leap toward whichever hand shows the draws.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { PlayerId, Uid } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { cardBackCanvas } from '../../art/cards';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, LOOK_V3, type XY, unitDepth, zoneXY } from '../../view/layout';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { wait } from '../../vfx/core';
import { fxRng } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
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
  leap1: 1080,
  leapMs: 250,
  leapGap: 220,
  shakeMs: 190,
  tipBackAfter: 150,
  dropMs: 220,
  lastStepMs: 18,
  fadeMs: 300,
});

// ================================================================ geometry (well-local pixels)

/** The well's raster: W × H, the floor centre (tile centre) at (CX, CY). */
const W = 64;
const H = 78;
const CX = 32;
const CY = 66;
/** Ring: outer / inner half axes, the wall's full height (three 3-px courses). */
const RX = 15;
const RY = 7;
const RXI = 11;
const RYI = 5;
const WALL = 9;
/** The axle's middle row, the posts' columns (left post's first column, right post's first column). */
const AY = CY - 35;
const POST_L = CX - 19;
const POST_R = CX + 17;
/** The bucket's bail top (pivot) when it hangs under the drum; deep in the shaft (hidden). */
const HANG = AY + 6;
const DEEP = CY + 8;
const CRANK_HUB: XY = { x: CX + 22, y: AY };
const CRANK_LEN = 7;

const ellY = (x: number, rx: number, ry: number): number => ry * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx)));

// ================================================================ the well's state (drawn every frame)

interface WellState {
  /** wall height 0..WALL */
  wall: number;
  /** post height 0..1 (stepped) */
  posts: number;
  /** axle shown, its drop offset (px above its rest) */
  axle: boolean;
  axleDy: number;
  /** crank angle (radians, stepped by π/4) and the drum's coil phase */
  crank: number;
  drum: number;
  /** bucket pivot (bail top) y in local px; null = not yet hooked */
  bucketY: number;
  /** bucket tilt (radians, stepped), its facing (+1 right / −1 left) */
  tilt: number;
  /** the bucket brims (dome + glints) and spills */
  brim: boolean;
  spill: boolean;
  /** shaft glimmer level 0..3, ripples (birth ms) */
  glow: number;
  ripples: number[];
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
      const outer = inEll(x, y, CX, ty, RX, RY);
      if (!outer) continue;
      const inner = inEll(x, y, CX, ty, RXI, RYI);
      if (!inner) {
        if (y + 0.5 > ty) continue; // the front half of the rim is the front layer's
        // the far rim: lit on its top-left, stone3 elsewhere
        const edge = !inEll(x, y - 1, CX, ty, RX, RY);
        p.set(x, y, edge && x < CX + 4 ? PAL.stone4 : PAL.stone3);
        continue;
      }
      // inside the mouth: the far inner wall (two rows of shadowed stone), then the dark shaft
      const fromBack = y - (ty - RYI);
      if (fromBack < 2 && h >= 6) p.set(x, y, (x + (fromBack === 0 ? 0 : 3)) % 6 === 0 ? PAL.stone0 : PAL.stone1);
      else p.set(x, y, PAL.night0);
    }
  // the water far below: a small ellipse of teal, brighter with `glow`, glints walking over it
  if (s.glow > 0) {
    const wy = ty + 2;
    const base = [PAL.teal0, PAL.teal0, PAL.teal1, PAL.teal2][Math.min(3, R(s.glow))];
    for (let y = wy - 2; y <= wy + 2; y++)
      for (let x = CX - 7; x <= CX + 7; x++) if (inEll(x, y, CX, wy, 7, 2) && inEll(x, y, CX, ty, RXI, RYI)) p.set(x, y, base);
    const ph = Math.floor(s.el / 90);
    const glints = [-4, -1, 3, 5];
    glints.forEach((gx, i) => {
      if ((ph + i) % 3 === 0 || s.glow < 1) return;
      p.set(CX + gx, wy + ((i + ph) % 2 === 0 ? 0 : 1) - 1 + (i % 2), s.glow >= 2 ? PAL.teal4 : PAL.teal3);
    });
    // ripples: rings running out from the middle when drops fall back in
    for (const born of s.ripples) {
      const age = s.el - born;
      if (age < 0 || age > 260) continue;
      const r = 1 + Math.floor(age / 50);
      const tone = age < 120 ? PAL.teal4 : PAL.teal3;
      for (let a = 0; a < TAU; a += 0.35) {
        const x = R(CX + Math.cos(a) * r * 1.8);
        const y = R(wy + Math.sin(a) * r * 0.5);
        if (inEll(x, y, CX, ty, RXI, RYI) && y >= ty - RYI + 2) p.set(x, y, tone);
      }
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
    // the near rim surface (between the mouth's front edge and the outer edge)
    for (let y = Math.abs(dx) < RXI ? yIn + 1 : Math.floor(ty); y <= yTop; y++) {
      if (y === yTop && dx < 4) p.set(x, y, PAL.stone4);
      else p.set(x, y, y === yTop ? PAL.stone3 : PAL.stone3);
    }
    // the wall: 3-px courses (two rows of face, one of mortar), staggered joints, lit on the left
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
  // moss in the lower course's joints (a small living detail) once the wall is up
  if (h >= WALL) {
    for (const [mx, my] of [
      [-11, -1],
      [-10, -1],
      [-6, 0],
      [8, 0],
    ] as const) {
      const x = CX + mx;
      const y = Math.floor(CY + ellY(mx + 0.5, RX, RY)) + my - 1;
      p.set(x, y, mx < 0 ? PAL.leaf2 : PAL.leaf1);
    }
  }
}

/** The windlass: two posts (forked tops), the axle with its rope drum, the crank on the right end. */
function paintFrame(p: PixelCanvas, s: WellState): void {
  if (s.posts <= 0) return;
  const top = CY - 1 - R((CY - 1 - (AY - 1)) * s.posts);
  for (const px0 of [POST_L, POST_R]) {
    for (let y = top; y <= CY - 1; y++) {
      const notch = y === top && s.posts >= 1;
      for (let c = 0; c < 3; c++) {
        if (notch && c === 1) continue;
        let col = [PAL.earth3, PAL.earth2, PAL.earth1][c];
        // wood grain: a knot and a split line
        if (c === 1 && (y === top + 9 || y === top + 21)) col = PAL.earth1;
        p.set(px0 + c, y, col);
      }
    }
  }
  if (!s.axle) return;
  const ay = AY - R(s.axleDy);
  for (let x = POST_L - 1; x <= CRANK_HUB.x; x++) {
    p.set(x, ay - 1, PAL.earth3);
    p.set(x, ay, PAL.earth2);
    p.set(x, ay + 1, PAL.earth1);
  }
  // the drum: rope coils (diagonal hemp strands) that scroll as it winds
  for (let y = ay - 3; y <= ay + 3; y++)
    for (let x = CX - 7; x <= CX + 7; x++) {
      if ((x === CX - 7 || x === CX + 7) && Math.abs(y - ay) === 3) continue;
      const k = (((x - CX + y + Math.floor(s.drum)) % 3) + 3) % 3;
      p.set(x, y, k === 0 ? PAL.earth4 : k === 1 ? PAL.earth3 : PAL.earth2);
    }
  // the drum's iron hoops at its two ends
  for (let y = ay - 3; y <= ay + 3; y++) {
    p.set(CX - 8, y, PAL.stone2);
    p.set(CX + 8, y, PAL.stone2);
  }
  // the crank: an arm from the hub turning in the axle's plane (seen almost edge-on: mostly up / down), a grip
  const a = s.crank;
  const ex = CRANK_HUB.x + R(Math.sin(a) * 3);
  const ey = ay - R(Math.cos(a) * CRANK_LEN);
  p.thickLine(CRANK_HUB.x, ay, ex, ey, 2, PAL.earth2);
  p.rect(CRANK_HUB.x - 1, ay - 1, 3, 3, PAL.stone2);
  p.set(CRANK_HUB.x - 1, ay - 1, PAL.stone3);
  // the grip sticks out toward the viewer's right
  p.rect(ex + 1, ey - 1, 3, 2, PAL.earth3);
  p.set(ex + 3, ey - 1, PAL.earth4);
}

/** Tilted-bucket shape test: local (u, v) from the pivot (bail top), v down. Returns a colour or null. */
function bucketPx(u: number, v: number, full: boolean): number | null {
  if (v < 4 || v >= 14) return null;
  const hw = 6.5 - (v - 5) * 0.16;
  if (Math.abs(u) > hw) return null;
  if (v < 5) {
    // the lip row: wooden edges, the water's top inside
    if (Math.abs(u) > hw - 1.5) return PAL.earth3;
    return full ? PAL.water3 : PAL.night0;
  }
  // iron bands
  if ((v >= 6 && v < 7) || (v >= 11 && v < 12)) return u < -2.5 ? PAL.stone3 : u > 3 ? PAL.stone1 : PAL.stone2;
  // staves: lit left, shadowed right, stave seams
  if (u < -4) return PAL.earth3;
  if (u > 4) return PAL.earth1;
  if (Math.abs(u + 1.2) < 0.5 || Math.abs(u - 2.2) < 0.5) return PAL.earth1;
  return PAL.earth2;
}

/** Screen (local) point of a bucket-local (u, v) at the current pivot / tilt. */
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
  for (let y = by - 2; y <= by + 17; y++)
    for (let x = CX - 13; x <= CX + 13; x++) {
      const dx = x + 0.5 - CX;
      const dy = y + 0.5 - by;
      const u = dx * c + dy * n;
      const v = -dx * n + dy * c;
      const col = bucketPx(u, v, true);
      if (col === null) continue;
      // hidden below the mouth's front edge (the near rim and the wall cover it; below them: inside the ground)
      if (Math.abs(dx) <= RX && y + 0.5 > ty + ellY(dx, RXI, RYI)) continue;
      p.set(x, y, col);
    }
}

/** The light that is never outlined: rope, bail, the water's brimming dome and glints, the spilling streams. */
function paintBucketLight(p: PixelCanvas, s: WellState): void {
  const ty = CY - R(s.wall);
  const hidden = (x: number, y: number) => Math.abs(x + 0.5 - CX) <= RX && y + 0.5 > ty + ellY(x + 0.5 - CX, RXI, RYI);
  const put = (x: number, y: number, col: number) => {
    const xx = R(x);
    const yy = R(y);
    if (!hidden(xx, yy)) p.set(xx, yy, col);
  };
  // the rope from the drum down to the bail (twisted hemp: two tones that scroll as it moves)
  const ay = AY - R(s.axleDy);
  for (let y = ay + 4; y <= s.bucketY; y++) put(CX, y, (y + Math.floor(s.drum)) % 2 === 0 ? PAL.earth4 : PAL.earth3);
  // the bail: an iron hoop from the lip's ends up to the rope
  for (let k = 0; k <= 12; k++) {
    const a = (k / 12) * Math.PI;
    const q = bucketAt(s, -Math.cos(a) * 6.2, 5 - Math.sin(a) * 4.6);
    put(q.x - 0.5, q.y - 0.5, k > 3 && k < 9 ? PAL.stone3 : PAL.stone2);
  }
  if (!s.brim) return;
  // the brimming dome over the lip and its running glints
  const ph = Math.floor(s.el / 70);
  for (let u = -4; u <= 4; u++) {
    const q = bucketAt(s, u, 3.5);
    put(q.x - 0.5, q.y - 0.5, Math.abs(u) <= 2 ? PAL.teal3 : PAL.teal2);
    const g = (u + 9 + ph) % 6 === 0;
    const q2 = bucketAt(s, u, 4.5);
    if (g) put(q2.x - 0.5, q2.y - 0.5, PAL.teal4);
  }
  const top = bucketAt(s, (ph % 5) - 2, 2.6);
  if (Math.abs(s.tilt) < 0.05) put(top.x - 0.5, top.y - 0.5, PAL.white);
  if (!s.spill) return;
  // streams over the lips: down the outside of the staves, flowing (alternating tones scroll down)
  const tilted = Math.abs(s.tilt) > 0.05;
  const lips: number[] = tilted ? [Math.sign(s.tilt)] : [-1, 1];
  for (const side of lips) {
    const lip = bucketAt(s, side * 7, 4.4);
    const len = tilted ? 16 : 11;
    for (let k = 0; k < len; k++) {
      const flow = (k + Math.floor(s.el / 40)) % 3;
      const x = lip.x + side * (k < 3 ? k * 0.4 : 1.2);
      const col = flow === 0 ? PAL.water4 : PAL.teal3;
      put(x - 0.5, lip.y - 0.5 + k, col);
      if (tilted && k > 1) put(x - 0.5 + side, lip.y - 0.5 + k, flow === 1 ? PAL.water4 : PAL.teal2);
    }
  }
}

// ================================================================ the well runtime

interface Well {
  s: WellState;
  /** World point of the bucket's mouth (where the cards leap from). */
  mouth(): XY;
  /** World point of a local one. */
  world(p: XY): XY;
  ras: Raster;
  stop(): void;
}

function makeWell(sc: Phaser.Scene, at: XY, seed: number): Well {
  const ox = R(at.x) - CX;
  const oy = R(at.y) - CY;
  const ras = new Raster(sc, ox, oy, W, H, unitDepth(R(at.y)) + 0.6);
  const layer = new PixelCanvas(W, H);
  const motes = new PxSparks(sc, DEPTH.FX + 3);
  const drips = new PxSparks(sc, unitDepth(R(at.y)) + 0.7);
  const rnd = fxRng(seed);
  const s: WellState = { wall: 0, posts: 0, axle: false, axleDy: 0, crank: 0, drum: 0, bucketY: DEEP, tilt: 0, brim: false, spill: false, glow: 1, ripples: [], cut: -1, el: 0 };
  let lastDrip = 0;
  const pass = (fn: (p: PixelCanvas) => void, outline: boolean) => {
    layer.clear();
    fn(layer);
    if (outline) layer.outline(PAL.ink);
    ras.pc.blit(layer, 0, 0);
  };
  const stop = onFrame(sc, (dt, el) => {
    if (!ras.alive) return false;
    s.el = el;
    ras.begin();
    pass((p) => paintBack(p, s), true);
    if (s.bucketY < DEEP) {
      pass((p) => paintBucket(p, s), true);
      pass((p) => paintBucketLight(p, s), false);
    }
    pass((p) => paintFront(p, s), true);
    pass((p) => paintFrame(p, s), true);
    // spilling: drops fall from the lips back into the well (ripples where they land)
    if (s.spill && dt > 0 && el - lastDrip > 60) {
      lastDrip = el;
      const tilted = Math.abs(s.tilt) > 0.05;
      const side = tilted ? Math.sign(s.tilt) : rnd() < 0.5 ? -1 : 1;
      const lip = bucketAt(s, side * 7, 4.4);
      const fall = tilted ? 16 : 11;
      drips.add({ x: ox + R(lip.x + side), y: oy + R(lip.y + fall), vx: side * (4 + rnd() * 8), vy: 20, ay: 520, life: 150 + rnd() * 60, colors: [PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
      s.ripples.push(el + 160);
      if (s.ripples.length > 6) s.ripples.shift();
    }
    // the dissolve: rows above the cut are gone, the cut line burns teal and sheds motes
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
    world: (p) => ({ x: ox + p.x, y: oy + p.y }),
    mouth() {
      const q = bucketAt(s, 0, 3.5);
      return { x: ox + R(q.x), y: oy + R(q.y) };
    },
    stop() {
      stop();
      ras.destroy();
      motes.release();
      drips.release();
    },
  };
}

/** The floor under the well: the landing ring and rune, the plop's ring (TILE_FX). */
function floorFx(sc: Phaser.Scene, at: XY, kind: 'land' | 'plop'): Promise<void> {
  const fx0 = R(at.x);
  const fy0 = R(at.y);
  const ras = new Raster(sc, fx0 - 40, fy0 - 20, 81, 41, DEPTH.TILE_FX + 4);
  const R0 = kind === 'land' ? 6 : RX + 2;
  const R1 = kind === 'land' ? 34 : 30;
  const ramp = [PAL.white, PAL.teal4, PAL.teal3, PAL.teal2, PAL.teal1];
  let f = 0;
  return run(sc, kind === 'land' ? 300 : 240, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.draw((g) => {
      const r = R0 + (R1 - R0) * (1 - (1 - t) * (1 - t));
      const tone = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
      g.ring(fx0 + 0.5, fy0 + 0.5, r, r / 2, tone);
      // the rune: an ellipse with four ticks, two frames, under the landing orb
      if (kind === 'land' && f < 3) {
        g.ring(fx0 + 0.5, fy0 + 0.5, 17, 8.5, f < 2 ? PAL.teal4 : PAL.teal2);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + Math.PI / 4;
          g.px(fx0 + R(Math.cos(a) * 20), fy0 + R(Math.sin(a) * 10), PAL.white);
        }
      }
    });
  }).then(() => ras.destroy());
}

// ================================================================ the leaping card (a native pixel drawing)

/** Native sizes of the card as it comes out of the water (never a scaled sprite). */
const LEAP_SIZES: readonly (readonly [number, number])[] = [
  [6, 8],
  [10, 14],
  [14, 20],
  [18, 26],
  [24, 34],
];
const ANG = Math.PI / 16;

/**
 * Paint the player's face-down card (the real v3 back, sampled whole-pixel at the native size w × h), turned by `a`,
 * centred in `p`, with a band of water light sliding over it (it is wet) and an ink outline.
 */
function paintCard(p: PixelCanvas, back: PixelCanvas, rim: number, w: number, h: number, a: number, sheen: number): void {
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
      // small sizes: the player's light frame keeps the tiny card readable against the dark floor
      if (w < 18 && Math.min(hw - Math.abs(u), hh - Math.abs(v)) < 1) col = rim;
      const k = u * 0.8 + v * 0.5 - sheen;
      if (k > 0 && k < 1.2 && w >= 10 && Math.min(hw - Math.abs(u), hh - Math.abs(v)) > 1.5) col = PAL.water4;
      p.set(x, y, col);
    }
  p.outline(PAL.ink);
}

interface Leap {
  /** Resolves at the apex with the card's world point (the caller hands it to the hand). */
  apex: Promise<XY>;
  /** Shake the water off at the apex (the second card); resolves when done. */
  shake(ms: number): Promise<void>;
  destroy(): void;
}

function leapCard(sc: Phaser.Scene, from: XY, to: XY, player: PlayerId, ms: number, seed: number): Leap {
  const BOX = 44;
  const ras = new Raster(sc, from.x - BOX / 2, from.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 12);
  const pc = new PixelCanvas(BOX, BOX);
  const drops = new PxSparks(sc, DEPTH.FX_TOP + 11);
  const rnd = fxRng(seed);
  const back = cardBackCanvas(player);
  const dir = to.x >= from.x ? 1 : -1;
  // the apex: up and a little toward the hand (the hand's flight continues down from there)
  const apex: XY = { x: R(from.x + dir * 26), y: R(from.y - 44) };
  let pos: XY = { ...from };
  let ang = 0;
  let size = 0;
  let sheen = 0;
  let dead = false;
  const draw = () => {
    if (dead) return;
    pc.clear();
    const [w, h] = LEAP_SIZES[size];
    paintCard(pc, back, PLAYER_RAMP[player][3], w, h, ang, sheen);
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
  };
  // the splash crown where it breaks out of the water
  for (let k = 0; k < 12; k++) {
    const side = k % 2 === 0 ? -1 : 1;
    drops.add({ x: from.x + side * R(rnd() * 4), y: from.y, vx: side * (14 + rnd() * 46), vy: -(50 + rnd() * 80), ay: 620, life: 320 + rnd() * 160, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
  }
  const apexP = run(sc, ms, (t, el, dt) => {
    if (dead) return;
    const k = 1 - (1 - t) * (1 - t) * (1 - t);
    pos = { x: from.x + (apex.x - from.x) * Math.sin((t * Math.PI) / 2), y: from.y + (apex.y - from.y) * k };
    size = Math.min(LEAP_SIZES.length - 1, Math.floor(Math.pow(t, 0.8) * LEAP_SIZES.length * 1.15));
    // the fish's wriggle: a lean into the leap that straightens, a tail flick on top (stepped angles)
    const wr = dir * 0.5 * (1 - t) + Math.sin(t * Math.PI * 3.2) * 0.32 * (1 - t * 0.7);
    ang = Math.round(wr / ANG) * ANG;
    sheen = (el / 22) % 30 - 8;
    // water streaming off the card's tail
    if (dt > 0 && rnd() < 0.85) {
      const [, h] = LEAP_SIZES[size];
      drops.add({ x: R(pos.x + (rnd() - 0.5) * 6), y: R(pos.y + h / 2), vx: (rnd() - 0.5) * 20, vy: 10 + rnd() * 30, ay: 560, life: 260 + rnd() * 200, colors: [PAL.water4, PAL.teal3, PAL.water3], shape: 'px', fadeAt: 1 });
    }
    draw();
  }).then(() => {
    ang = 0;
    size = LEAP_SIZES.length - 1;
    pos = { ...apex };
    draw();
    return { ...apex };
  });
  return {
    apex: apexP,
    shake(sms) {
      const jerks = [2, -2, 2, -2, 1, -1, 0];
      let last = -1;
      return run(sc, sms, (t, el) => {
        if (dead) return;
        const i = Math.min(jerks.length - 1, Math.floor(t * jerks.length));
        pos = { x: apex.x + jerks[i], y: apex.y };
        ang = (i % 2 === 0 ? 1 : -1) * (i < 4 ? ANG : 0);
        sheen = (el / 22) % 30 - 8;
        if (i !== last) {
          last = i;
          // a burst of droplets thrown off at each reversal (radial, mostly sideways)
          if (i < 5) {
            const side = jerks[i] > 0 ? 1 : -1;
            for (let k = 0; k < 6; k++) {
              const a = (rnd() - 0.5) * 1.6 + (side > 0 ? 0 : Math.PI);
              const sp = 60 + rnd() * 70;
              drops.add({ x: apex.x + side * 12, y: apex.y + R((rnd() - 0.5) * 26), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, ay: 520, life: 300 + rnd() * 160, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: rnd() < 0.2 ? 'plus' : 'px', fadeAt: 1 });
            }
          }
        }
        draw();
      }).then(() => {
        pos = { ...apex };
        ang = 0;
        draw();
      });
    },
    destroy() {
      if (dead) return;
      dead = true;
      ras.destroy();
      drops.release();
    },
  };
}

// ================================================================ where the well stands

/** The caster's free spell/trap tile nearest to its cast spot (a set card: its own tile); none free: the cast floor. */
function wellSpot(ctx: ActCtx, player: PlayerId, setHome: XY | null): XY {
  if (setHome) return { x: R(setHome.x), y: R(setHome.y) };
  const c = castSpot(player);
  const sts = ctx.state.players[player].spellTraps;
  let best: XY | null = null;
  let bd = Infinity;
  sts.forEach((slot, i) => {
    if (slot) return;
    const z = zoneXY(player, 'spellTrap', i);
    const d = Math.hypot(z.x - c.x, z.y - c.y);
    if (d < bd) {
      bd = d;
      best = { x: R(z.x), y: R(z.y) };
    }
  });
  return best ?? { x: c.x, y: castFloor(c) };
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
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'draw' && e.player === player && !e.initial && !ctx.isConsumed(i)) draws.push(i);
    else if (e.type === 'toGraveyard' && e.uid === ev.uid && e.from === 'resolved') {
      gi = i;
      break;
    } else if (e.type === 'activate' || e.type === 'turnStart' || e.type === 'phaseChange') break;
    if (draws.length >= 2) {
      // the spell's own graveyard trip follows right after
      const n = ctx.events[i + 1];
      if (n && n.type === 'toGraveyard' && n.uid === ev.uid) gi = i + 1;
      break;
    }
  }
  const set = setTileOf(ctx);
  const spot = wellSpot(ctx, player, set ? ip(set.home) : null);
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

  // ---- LAND + BUILD
  const well = makeWell(sc, spot, spot.x * 7 + spot.y * 13 + player);
  const S = well.s;
  bg(floorFx(sc, spot, 'land'));
  void lightFlash(sc, spot.x, spot.y - 8, PAL.teal4, 30, 300, { floorY: spot.y, intensity: 0.9 });
  const pool = lightPool(sc, spot.x, spot.y - 6, { color: PAL.teal3, radius: 26, floorY: spot.y, intensity: 0, anim: 'caustic', fadeIn: 0 });
  pool.setIntensity(0.45, 200);
  const sfx = (name: SfxName, o: { volume?: number; pitch?: number } = {}) => playV3(name, { volume: o.volume ?? 0.9, pitch: o.pitch, pan });
  let el = 0;
  const at = async (ms: number) => {
    if (ms > el) await wait(sc, ms - el);
    el = Math.max(el, ms);
  };
  for (let k = 0; k < 3; k++) {
    await at(T.courses[k]);
    S.wall = (k + 1) * 3;
    sfx('e_wellStone', { pitch: 1 + k * 0.12, volume: 0.85 });
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
  void lightFlash(sc, spot.x, spot.y - 34, PAL.earth3, 16, 160, { floorY: spot.y, intensity: 0.4 });
  // the bucket hangs on the rope deep in the shaft
  S.bucketY = DEEP - 1;

  // ---- CRANK: 2 turns, every step a ratchet tooth; the bucket climbs
  await at(T.crank);
  sfx('e_wellRope', { volume: 0.75 });
  const steps = T.crankSteps;
  const total = steps.length;
  let breached = false;
  for (let i = 0; i < total; i++) {
    const from = S.bucketY;
    const to = R(DEEP - 1 - ((DEEP - 1 - HANG) * (i + 1)) / total);
    S.crank = ((i + 1) * TAU) / 8;
    sfx('e_wellClick', { pitch: 1 + (i / total) * 0.22, volume: 0.6 + (i / total) * 0.3 });
    await run(sc, steps[i], (t) => {
      S.bucketY = R(from + (to - from) * t);
      S.drum = i * 1.5 + t * 1.5;
    });
    el += steps[i];
    if (!breached && S.bucketY + 6 < CY - WALL) {
      // the full bucket breaks the surface of the mouth: the shaft's water flares, the light swells
      breached = true;
      sfx('e_wellSlosh');
      S.glow = 3;
      S.brim = true;
      pool.setIntensity(0.9, 160);
      void lightFlash(sc, spot.x, spot.y - 14, PAL.teal4, 26, 260, { floorY: spot.y, intensity: 0.8 });
    }
  }
  S.bucketY = HANG;
  S.brim = true;
  S.glow = 2;
  // ---- CATCH + SPILL: the pawl holds, the bucket swings once, water runs over the lips
  sfx('e_wellCatch');
  S.spill = true;
  sfx('e_wellSpill', { volume: 0.95 });
  const swing = run(sc, T.swingMs, (t) => {
    const k = Math.floor(t * 4);
    S.tilt = [ANG / 2, -ANG / 2, ANG / 4, 0][Math.min(3, k)];
  }).then(() => (S.tilt = 0));
  await swing;
  el += T.swingMs;

  // ---- TIP toward the hand
  const hand = ctx.views.hand;
  const cam = sc.cameras.main;
  const scroll = (p: XY): XY => ({ x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)) });
  const worldOf = (p: XY): XY => ({ x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)) });
  const handTarget = worldOf(hand.owner === player ? hand.nextSlotXY() : hand.miniXY(player));
  const dir = handTarget.x >= spot.x ? 1 : -1;
  for (let k = 1; k <= 3; k++) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
    el += T.tipStepMs;
  }

  // ---- LEAPS: each card bursts out of the bucket like a fish; the hand takes it at the apex
  const pile = ctx.views.field.pile(player, 'deck');
  const flights: Promise<void>[] = [];
  const leapOne = async (k: number, shake: boolean) => {
    const di = draws[k];
    const d = evAt(ctx, di, 'draw');
    if (!d) return;
    ctx.consumeAt(di);
    const m = well.mouth();
    sfx('e_wellLeap', { pitch: k === 0 ? 1 : 1.08 });
    // the deck gives the card up: its pile drops by one with a teal blink
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const top = pile.topXY();
    void lightFlash(sc, top.x, top.y - 6, PAL.teal3, 18, 240, { floorY: top.y, intensity: 0.5 });
    void lightFlash(sc, m.x, m.y - 10, PAL.teal4, 24, 240, { floorY: spot.y, intensity: 0.8 });
    S.ripples.push(S.el, S.el + 70);
    const target = worldOf(hand.owner === player ? hand.nextSlotXY() : hand.miniXY(player));
    const lp = leapCard(sc, m, target, player, T.leapMs, d.uid * 31 + k);
    const apex = await lp.apex;
    if (shake) {
      sfx('e_wellShake');
      await lp.shake(T.shakeMs);
    }
    lp.destroy();
    flights.push(hand.addCard(d.uid as Uid, d.cardId, scroll(apex), player).catch(() => undefined));
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
  // the bucket tips back (the water is spent: no more dome)
  S.spill = false;
  for (let k = 2; k >= 0; k--) {
    S.tilt = dir * k * ANG * 0.7;
    await wait(sc, T.tipStepMs);
    el += T.tipStepMs;
  }
  S.brim = false;
  await leap1;
  await leap2;

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
  bg(floorFx(sc, spot, 'plop'));
  // the spent card is born on the tile beside the well as the bucket plops, and leaves for the graveyard
  let send: Promise<void> = Promise.resolve();
  const g = evAt(ctx, gi, 'toGraveyard');
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x, y: spot.y + 4 }, delay: 60 });
  }
  void lightFlash(sc, spot.x, spot.y - 10, PAL.teal4, 28, 260, { floorY: spot.y, intensity: 0.9 });
  {
    const rnd = fxRng(spot.x + 5);
    const sp = new PxSparks(sc, unitDepth(spot.y) + 0.8);
    const mouth = well.world({ x: CX, y: CY - WALL });
    for (let k = 0; k < 14; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      sp.add({ x: mouth.x + side * R(rnd() * 5), y: mouth.y, vx: side * (8 + rnd() * 30), vy: -(70 + rnd() * 70), ay: 640, life: 330 + rnd() * 120, colors: [PAL.white, PAL.water4, PAL.teal3, PAL.teal2], shape: 'px', fadeAt: 1 });
    }
    sp.release();
  }
  // ---- LAST TURN: one slow turn, soft teeth, one bright last tooth
  for (let i = 0; i < 8; i++) {
    S.crank += TAU / 8;
    if (i < 7) sfx('e_wellClick', { pitch: 1.02 - i * 0.02, volume: 0.35 });
    await wait(sc, T.lastStepMs + i * 2);
  }
  sfx('e_wellLast');
  S.glow = 1;
  await wait(sc, 40);

  // ---- DISSOLVE into teal motes (top down); the light fades
  sfx('e_wellFade');
  void pool.fadeOut(360);
  const dissolve = new Promise<void>((done) => {
    let row = 0;
    let t = 0;
    S.cut = 0;
    onFrame(sc, (dt) => {
      t += dt;
      row = Math.floor((Math.min(1, t / T.fadeMs) * H) / 2) * 2;
      S.cut = row;
      if (row >= H) {
        done();
        return false;
      }
      return true;
    });
  });
  await dissolve;
  well.stop();
  // the hand flights resolve on landing; like flow:draw, do not wait for the landing punch
  await Promise.race([Promise.all(flights), wait(sc, 200)]);
  await send;
});
