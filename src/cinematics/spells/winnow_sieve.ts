// Harman Eleği (winnow_sieve) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S5; lane E). The v1 look keeps the
// generic spell activation, the plain draws and the end-phase style discard: everything here steps aside without
// ?look=v3 (the activate hook calls ctx.base(), the discard handler never claims).
//
// "Oyuncunun tarafında hasırdan dev, yuvarlak bir harman eleği belirir, yatay ritimle sallanır (tane hışırtısı) →
//  elekten üç kart altın buğday taneleri arasında yukarı zıplar ve ele düşer → seçim sırasında elek alçakta bekler,
//  taneler hafifçe kayar → seçilen 2 kart elekte samana dönüşür ve bir rüzgar onları sap saman hâlinde mezarlığa
//  savurur."
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Activation signature ≈ 1.5 s after the opening,
// the discard ≈ 1.15 s after the choice (§7: 3.0 s + the choice). Measured (game ms): activation 3.22 s, discard 1.58 s.
//   0      common v3 spell opening (spells/_kit): the hand card flies beside its owner (a set card stands up on its
//          own tile), "HARMAN ELEĞİ" plate, short hover (hold 220)
//   ~380   RELEASE: the card pours into a golden orb at its bottom edge that drops to the sieve's floor point (the
//          free spell/trap tile nearest the cast spot, a set card: its own tile) — the hand is never covered
//   S+0    LAND: a gold ring runs out on the floor, the warm light pool comes on — e_sieveWeave
//   S+0    THE HOOP bends itself round from the front in 8 stepped arcs (both ways at once), straw lashings pop on
//   S+90   THE MESH weaves itself in from the back rim to the front, row by row (a basket weave of straw strands)
//   S+150  THE POUR: a golden column of wheat falls into the bowl, the heap swells in 4 steps — e_sievePour; the sieve
//          rises to its working height (24 px over its shadow) with a 1-px overshoot
//   S+320  THE SHAKE: 3 cycles at 6 Hz (8 stepped offsets each: 0 2 3 2 0 −2 −3 −2 px); the grain heap lags the hoop
//          a step (it sloshes), chaff sifts through the mesh as a fine golden curtain lit by the pool, and three
//          card backs WORK THEIR WAY UP out of the grain — e_sieveShake on EVERY cycle (left/right strokes)
//   S+830  TOSS 1 / S+990 TOSS 2 / S+1150 TOSS 3: the sieve dips 3 px (anticipation) and flicks up 4 px; a card
//          leaves the grain tumbling end over end (stepped heights, native sizes 8×11 → 24×34, never scaled) inside
//          a fountain of grains that rain back into the bowl; at the apex the hand takes it — e_sieveToss ×3 (the
//          third pitched up, the biggest spray); the deck pile gives a card up each time
//   ~S+1240 the grains rain back — e_sieveFall; the spent spell card is born on the floor beside the sieve and
//          leaves for the graveyard (cardLeaves)
//   S+1300 SETTLE: the sieve sinks to its waiting height (7 px), the heap flattens — e_sieveSettle
//   WAIT   (the choice, unbounded): the sieve hangs low and still; its grains slide slowly side to side, a glint
//          wanders over them, motes float up in the pool; e_sieveIdle at each turn of the slide (very quiet)
// THE DISCARD (registerEvent 'discard', only while this sieve waits for that player):
//   D+0    the chosen cards leave the hand (their faces: discards are public) and fall into the sieve on arcs,
//          shrinking through native sizes; the sieve rises to meet them — e_sieveDrop each
//   D+340  one hard shake cycle (e_sieveShake) …
//   D+540  STRAW: each card dries (its face recoloured to straw tones), splits into stalks (every third column
//          drops out), then breaks into 1-px straw stalks — e_sieveStraw
//   D+640  THE GUST: wind curls sweep from the sieve to the graveyard; the stalks lift, tumble (stepped angles) and
//          ride it into the pile; the pile takes each card when its last stalk lands — e_sieveGust, e_sieveGrave
//   D+940  UNRAVEL: the mesh rows pull out from the front back, the hoop opens into loose strands blown after the
//          gust; the light fades — e_sieveEnd
// EDGES — the first draw completes the five seals (or a draw is missing): no choice follows, the remaining tosses
// are skipped and the sieve unravels at once. A choice that never comes (surrender, a new duel): any other event
// dismisses the waiting sieve.
// P2: the sieve stands on P2's side (upper right); cards fly to whichever hand shows the draws.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only.

import type Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, PLAYER_RAMP } from '../../art/palette';
import { cardBackCanvas, cardFaceCanvas } from '../../art/cards';
import { PixelCanvas } from '../../art/pixel';
import { DEPTH, LOOK_V3, type XY, zoneXY } from '../../view/layout';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { Sparks as PxSparks } from '../../vfx/combat';
import { hitStop, wait } from '../../vfx/core';
import { fxRng } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves, landingCount } from '../_v3/card';
import { registerCardHook, registerEvent, registerObserver, type CinematicContext } from '../api';
import { bg, castFloor, castSpot, evAt, ip, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type LightHandle } from './_kit';
import type { SfxName } from '../../audio/sfx';

const ID: CardId = 'winnow_sieve';
const R = Math.round;
const TAU = Math.PI * 2;

// ================================================================ timings (scene ms)

export const SIEVE_T = Object.freeze({
  hoopSteps: 8,
  hoopStepMs: 12,
  mesh: 90,
  meshRows: 6,
  meshStepMs: 12,
  pour: 150,
  pourMs: 180,
  shake: 320,
  /** One shake cycle (6 Hz) and the number of cycles. */
  cycleMs: 167,
  cycles: 4,
  /** The tosses: the third (the climax) waits a beat longer and dips deeper. */
  toss: [1040, 1220, 1440] as readonly number[],
  dipMs: 45,
  bigDipMs: 80,
  flickMs: 40,
  /** A tossed card's flight: base + per px of path (it carries the card almost all the way to the hand). */
  flightBase: 220,
  flightPerPx: 0.62,
  /** Hit-stop on the third toss (scene ms). */
  bigStop: 70,
  settle: 1700,
  settleMs: 160,
  // the discard (from the first discard event)
  dropMs: 300,
  dropGap: 80,
  /** after the jolt: the pause before the cards dry, each drying step */
  strawWait: 30,
  strawStepMs: 60,
  gustMs: 560,
  /** the unravel starts this long after the gust */
  unravelAfter: 360,
  unravelMs: 240,
});

/** Hover heights of the sieve over its shadow (px). */
const H_BORN = 12;
const H_WORK = 24;
const H_WAIT = 7;
const H_CATCH = 14;

// ================================================================ the sieve's geometry (raster-local px)

/** A giant winnowing sieve: ~100 px across (1.5 tiles), on the caster's side near the board's middle. */
const RX = 48;
const RY = 20;
const RXI = 44;
const RYI = 17;
/** The hoop's depth: the mesh lies this far under the rim. */
const HOOP = 8;
/** Room for the shake (±6), the squash stretch (2) and the outline. */
const W = 2 * (RX + 11);
const CX = RX + 11;
/** Centre of the rim's top ellipse. */
const CY = RY + 4;
const H = CY + RY + HOOP + 4;
/** The mesh centre (the point that sits over the floor point). */
const MY = CY + HOOP;
/** Shake offsets of one cycle (12 steps ≈ one rendered frame each at 6 Hz), ±6 px. */
const SHAKE = [0, 3, 5, 6, 5, 3, 0, -3, -5, -6, -5, -3] as const;
/** The three cards standing in the grain: x off the heap centre, y off the mesh centre, lean. */
const CARD_SPOTS: readonly (readonly [number, number, number])[] = [
  [-18, 1, -1],
  [1, -3, 0],
  [19, 1, 1],
];

const ellY = (x: number, rx: number, ry: number): number => ry * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx)));
function inEll(x: number, y: number, cx: number, cy: number, rx: number, ry: number): boolean {
  const dx = (x + 0.5 - cx) / rx;
  const dy = (y + 0.5 - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

/** A discarded card resting in the grain (its own pixel canvas, already outlined), half sunk. */
interface Resting {
  pc: PixelCanvas;
  /** x of its centre off the mesh centre, y of its foot (layer px) */
  dx: number;
  foot: number;
  /** rows of its foot buried in the grain */
  sink: number;
}

interface SieveState {
  /** hoop built 0..1 (both ways from the front), mesh rows 0..1 (back → front) */
  hoop: number;
  mesh: number;
  /** grain heap 0..1, its slosh (px, lags the shake), how high the three cards stand out of it 0..1 (each) */
  heap: number;
  slosh: number;
  cards: [number, number, number];
  /** shake offset (px, x) and the dip / flick offset (px, y) */
  sx: number;
  dy: number;
  /** a 1-frame squash on a stroke (px) */
  squash: number;
  /** the rim's flash (frames left; > 2 = white) */
  rimFlash: number;
  /** hover height over the shadow */
  hgt: number;
  /** unravel: rows from the front gone 0..1, hoop opened 0..1 */
  undo: number;
  /** the waiting glint's phase */
  el: number;
  /** the player's card-back tones for the cards in the grain */
  backTone: number;
  rimTone: number;
  /** discarded cards resting in the grain */
  rest: Resting[];
}

/** The mesh: a basket weave of straw strands (4×2 cells, alternating horizontal / vertical), a dark gap per cell. */
function meshTone(x: number, y: number): number {
  const u = Math.floor((x + 400) / 4);
  const v = Math.floor((y + 400) / 2);
  const cx = (x + 400) % 4;
  const cy = (y + 400) % 2;
  if ((u + v) % 2 === 0) {
    // horizontal strand: lit top row, body row, a seam at the cell's end
    if (cx === 3 && cy === 1) return PAL.earth1;
    return cy === 0 ? PAL.earth4 : PAL.earth3;
  }
  // vertical strand: two lit columns between two shaded ones
  if (cx === 0) return PAL.earth2;
  return cx === 3 ? PAL.earth2 : PAL.earth3;
}

/** Heap pixel tone: wheat grains as staggered 2×1 dashes, a lit crest, a shaded foot. */
function grainTone(x: number, y: number, top: boolean, foot: boolean, phase: number): number {
  if (top) return (x + phase) % 5 === 0 ? PAL.white : PAL.gold4;
  if (foot) return (x + y) % 3 === 0 ? PAL.gold1 : PAL.gold2;
  return (x + (y % 2) * 2 + phase) % 3 === 0 ? PAL.gold2 : PAL.gold3;
}

/** Paint the whole sieve (subject pass; the caller outlines it). */
function paintSieve(p: PixelCanvas, s: SieveState): void {
  const ox = R(s.sx);
  const cx = CX + ox;
  const flash = s.rimFlash > 0;
  const rimHi = s.rimFlash > 2 ? PAL.white : PAL.gold4;
  // the hoop's built part: angle measured from the front-centre (θ = 0 front, ±π back), visible while |θ| ≤ hoop·π
  const hoopOk = (dx: number, dy: number): boolean => {
    if (s.hoop >= 1 && s.undo <= 0) return true;
    const a = Math.abs(Math.atan2(dx / RX, dy / RY));
    if (a > s.hoop * Math.PI + 1e-6) return false;
    // unravelling: the hoop opens at the back first
    if (s.undo > 0 && a > Math.PI * (1 - s.undo)) return false;
    return true;
  };
  // ---- the far rim and the inner back wall
  for (let y = CY - RY - 1; y <= MY + RY + 1; y++)
    for (let x = cx - RX - 1; x <= cx + RX + 1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - CY;
      const outerTop = inEll(x, y, cx, CY, RX, RY);
      const innerTop = inEll(x, y, cx, CY, RXI, RYI);
      if (outerTop && !innerTop) {
        if (!hoopOk(dx, dy)) continue;
        // the rim's top surface: lit along its outer edge on the left / back, bound with straw lashings
        const edge = !inEll(x, y - 1, cx, CY, RX, RY);
        const ang = Math.atan2(dy / RY, dx / RX);
        const lash = Math.abs(Math.round(ang / (TAU / 18)) * (TAU / 18) - ang) < 0.05;
        if (flash) p.set(x, y, edge ? rimHi : PAL.gold3);
        else p.set(x, y, lash ? PAL.gold3 : edge && dx < 10 ? PAL.earth4 : PAL.earth3);
        continue;
      }
      if (!innerTop) continue;
      const onMesh = inEll(x, y, cx, MY, RXI, RYI);
      if (!onMesh) {
        // the inner back wall (in shade): two tones with vertical bindings
        if (!hoopOk(dx, dy)) continue;
        p.set(x, y, (x - cx + 40) % 7 === 0 ? PAL.earth2 : PAL.earth1);
        continue;
      }
      // the mesh, woven in from the back row by row (unravelled from the front)
      const row = (y - (MY - RYI)) / (2 * RYI);
      if (row > s.mesh) continue;
      if (s.undo > 0 && 1 - row < s.undo * 1.4) continue;
      p.set(x, y, meshTone(x - ox, y));
    }
  // ---- the grain heap (a mound on the mesh, sloshing: it piles up on the side it is thrown to) and the cards
  //      working their way up out of it
  const hx = cx + R(s.slosh);
  const ph = Math.floor(s.el / 90) % 5;
  if (s.heap > 0 && s.mesh > 0.6) {
    const grx = Math.max(2, R(34 * s.heap));
    const gry = Math.max(1, R(13 * s.heap));
    const hh = Math.max(1, R(8 * s.heap));
    const tilt = Math.max(-1, Math.min(1, s.slosh / 6));
    const liftAt = (x: number): number => {
      const dx = (x + 0.5 - hx) / grx;
      return R(hh * Math.max(0, 1 - dx * dx) * (1 + tilt * dx * 0.7) + Math.max(0, tilt * dx) * hh * 0.5);
    };
    for (let y = MY - gry - hh - 4; y <= MY + gry; y++)
      for (let x = hx - grx; x <= hx + grx; x++) {
        const lift = liftAt(x);
        if (!inEll(x, y + lift, hx, MY, grx, gry)) continue;
        if (!inEll(x, y, cx, MY, RXI - 1, RYI - 1) && !inEll(x, y + lift, cx, MY, RXI - 1, RYI - 1)) continue;
        if (s.undo > 0 && (y - (MY - RYI)) / (2 * RYI) > 1 - s.undo * 1.4) continue;
        const top = !inEll(x, y - 1 + lift, hx, MY, grx, gry);
        const foot = y > MY + gry - 2;
        p.set(x, y, grainTone(x, y, top && y < MY, foot, ph));
      }
    // the three cards: backs standing out of the grain, staggered (left leaning, middle straight, right leaning)
    s.cards.forEach((up, i) => {
      if (up <= 0) return;
      const [dx, dy, lean] = CARD_SPOTS[i];
      const base = MY + dy;
      const tall = R(up * 14);
      for (let k = 0; k < tall; k++) {
        const y = base - k;
        const shift = lean === 0 ? 0 : Math.floor(k / 5) * lean;
        for (let c = 0; c < 10; c++) {
          const x = hx + dx - 5 + c + shift;
          const rim = c === 0 || c === 9 || k === tall - 1;
          p.set(x, y, rim ? s.rimTone : (c + k) % 5 === 0 ? PAL.night4 : s.backTone);
        }
      }
      // grain heaped round its foot (the card is IN the grain)
      for (let c = -1; c < 11; c++) p.set(hx + dx - 5 + c, base, grainTone(hx + dx + c, base, (c & 1) === 0, false, ph));
    });
  }
  // ---- the discarded cards resting half sunk in the grain (their buried rows painted as grain)
  for (const r of s.rest) {
    const x0 = hx + r.dx - Math.floor(r.pc.w / 2);
    const y0 = r.foot - r.pc.h;
    for (let y = 0; y < r.pc.h; y++)
      for (let x = 0; x < r.pc.w; x++) {
        const c = r.pc.get(x, y);
        if (c === null) continue;
        const buried = y >= r.pc.h - r.sink;
        const gy = y0 + y;
        const crest = y === r.pc.h - r.sink;
        p.set(x0 + x, gy, buried ? grainTone(x0 + x, gy, crest, false, ph) : c);
      }
  }
  // ---- the front wall of the hoop (covers the mesh's front edge, the heap's foot and the resting cards' feet)
  for (let x = cx - RX; x <= cx + RX; x++) {
    const dx = x + 0.5 - cx;
    const top = Math.floor(CY + ellY(dx, RX, RY));
    const lipIn = Math.floor(CY + ellY(dx, RXI, RYI));
    if (!hoopOk(dx, ellY(dx, RX, RY))) continue;
    // the near rim's top surface
    for (let y = Math.abs(dx) < RXI ? lipIn + 1 : Math.floor(CY); y <= top; y++) p.set(x, y, flash ? (y === top ? rimHi : PAL.gold3) : y === top ? PAL.earth4 : PAL.earth3);
    // the bent-wood band: lit left, mid, shaded right; straw lashings every 11 px
    const side = dx < -RX * 0.4 ? 0 : dx > RX * 0.45 ? 2 : 1;
    const band = [PAL.earth3, PAL.earth2, PAL.earth1][side];
    const lash = (x - cx + 66) % 11 < 2;
    for (let y = top + 1; y <= top + HOOP; y++) {
      const r = y - top;
      let c: number = band;
      if (lash) c = r === 1 ? PAL.gold4 : PAL.gold3;
      else if (r === HOOP) c = side === 2 ? PAL.earth0 : PAL.earth1;
      else if (r === 1) c = flash ? PAL.gold4 : side === 0 ? PAL.earth4 : PAL.earth3;
      else if (r === 4 && (x + 1) % 4 === 0) c = side === 2 ? PAL.earth0 : PAL.earth1;
      p.set(x, y, c);
    }
  }
}

// ================================================================ the sieve runtime

interface Sieve {
  s: SieveState;
  /** World point of the heap's crest (where the cards leave from). */
  crest(): XY;
  /** World point of the mesh centre. */
  mesh(): XY;
  floor: XY;
  /** Chaff: a golden curtain sifting through the mesh while > 0 (per frame chance). */
  sift: number;
  /** Floating motes in the pool while waiting. */
  motes: boolean;
  /** Throw a handful of grains over the rim on the side `dir` (a hard stroke). */
  spill(dir: number, n: number): void;
  alive(): boolean;
  stop(): void;
}

/** Sieve depth: above the units' stat plates (it hangs over the board for its whole life), under the hand / HUD. */
const D_SIEVE = DEPTH.FX_TOP + 2;

function makeSieve(sc: Phaser.Scene, floor: XY, player: PlayerId, seed: number): Sieve {
  const fx = R(floor.x);
  const fy = R(floor.y);
  const ras = new Raster(sc, fx - CX, fy - H_BORN - MY, W, H, D_SIEVE);
  // the shadow: a flat, opaque palette ellipse on the floor (no alpha blending over the tiles)
  const shadow = new Raster(sc, fx - RX - 4, fy - RY - 2, 2 * RX + 9, 2 * RY + 5, DEPTH.TILE_FX + 3);
  const layer = new PixelCanvas(W, H);
  const chaff = new PxSparks(sc, D_SIEVE - 1);
  const air = new PxSparks(sc, D_SIEVE + 1);
  const spillSp = new PxSparks(sc, D_SIEVE + 0.5);
  const rnd = fxRng(seed);
  const ramp = PLAYER_RAMP[player];
  const s: SieveState = { hoop: 0, mesh: 0, heap: 0, slosh: 0, cards: [0, 0, 0], sx: 0, dy: 0, squash: 0, rimFlash: 0, hgt: H_BORN, undo: 0, el: 0, backTone: PAL.night3, rimTone: ramp[2], rest: [] };
  const rig: Sieve = {
    s,
    floor: { x: fx, y: fy },
    sift: 0,
    motes: false,
    crest: () => ({ x: fx + R(s.sx + s.slosh), y: fy - R(s.hgt + s.dy) - R(8 * s.heap) - 2 }),
    mesh: () => ({ x: fx + R(s.sx), y: fy - R(s.hgt + s.dy) }),
    spill(dir, n) {
      const y = fy - R(s.hgt + s.dy) - HOOP + 2;
      for (let i = 0; i < n; i++) {
        const x = fx + R(s.sx) + dir * (RX - 6 - R(rnd() * 8));
        spillSp.add({ x, y: y - R(rnd() * 3), vx: dir * (30 + rnd() * 50), vy: -(40 + rnd() * 50), ay: 520, life: 260 + rnd() * 160, colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], shape: rnd() < 0.35 ? 'sq' : 'px', size: 2, fadeAt: 1 });
      }
    },
    alive: () => ras.alive,
    stop() {
      stopFrame();
      ras.destroy();
      shadow.destroy();
      chaff.release();
      air.release();
      spillSp.release();
    },
  };
  let lastMote = 0;
  const stopFrame = onFrame(sc, (dt, el) => {
    if (!ras.alive) return false;
    s.el = el;
    // the sieve
    layer.clear();
    paintSieve(layer, s);
    layer.outline(PAL.ink);
    ras.moveTo(fx - CX, fy - R(s.hgt + s.dy) - MY);
    ras.begin();
    const k = s.squash;
    if (k > 0) {
      // a stroke's squash: bottom anchored, k rows shorter and k px wider each side (nearest neighbour, whole px)
      for (let y = k; y < H; y++) {
        const sy = Math.min(H - 1, Math.floor(((y - k) * H) / (H - k)));
        for (let x = 0; x < W; x++) {
          const sxp = CX + R(((x - CX) * RX) / (RX + k));
          if (sxp < 0 || sxp >= W) continue;
          const c = layer.get(sxp, sy);
          if (c !== null) ras.pc.set(x, y, c);
        }
      }
    } else ras.pc.blit(layer, 0, 0);
    ras.end();
    if (dt > 0 && s.rimFlash > 0) s.rimFlash--;
    // its shadow on the floor: a flat night ellipse with an ink core, smaller the higher it hangs
    shadow.begin();
    if (s.hoop > 0) {
      const kk = Math.max(0.5, 1 - s.hgt / 80);
      const g = Math.min(1, s.hoop * 1.5) * (1 - s.undo * 0.6);
      const rx = R(RX * kk * g);
      const ry = Math.max(1, R(RY * kk * g));
      const sx = RX + 4 + R(s.sx * 0.5);
      if (rx > 0) {
        shadow.pc.ellipse(sx, RY + 2, rx, ry, PAL.night0);
        if (rx > 6) shadow.pc.ellipse(sx, RY + 2, rx - 5, Math.max(1, ry - 3), PAL.ink);
      }
    }
    shadow.end();
    // chaff sifting through the mesh: a fine golden curtain down to the floor
    if (dt > 0 && rig.sift > 0) {
      const n = rig.sift * (dt / 16.7);
      for (let i = 0; i < 5; i++) {
        if (rnd() > n / 3) continue;
        const x = fx + R(s.sx) + R((rnd() - 0.5) * 2 * (RXI - 6));
        const y0 = fy - R(s.hgt + s.dy) + RY - 2 + HOOP;
        const fall = Math.max(4, y0 < fy ? fy - y0 : 4);
        chaff.add({ x, y: y0, vx: (rnd() - 0.5) * 6, vy: 14 + rnd() * 10, ay: 160, life: Math.min(420, 120 + fall * 9), colors: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.earth2], shape: 'px', fadeAt: 1 });
      }
    }
    // motes rising slowly in the warm pool while it waits
    if (dt > 0 && rig.motes && el - lastMote > 120) {
      lastMote = el;
      air.add({ x: fx + R((rnd() - 0.5) * 2 * RX), y: fy - R(rnd() * 6), vx: (rnd() - 0.5) * 4, vy: -(7 + rnd() * 8), life: 700 + rnd() * 500, colors: [PAL.gold3, PAL.gold2, PAL.gold1], shape: 'px', fadeAt: 1 });
    }
    return true;
  });
  return rig;
}

// ================================================================ the floor (landing ring), the pour column

function floorRing(sc: Phaser.Scene, at: XY, ms = 320, r0 = 8, r1 = 58): Promise<void> {
  const fx0 = R(at.x);
  const fy0 = R(at.y);
  const ras = new Raster(sc, fx0 - 62, fy0 - 32, 125, 65, DEPTH.TILE_FX + 4);
  const ramp = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1];
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.draw((g) => {
      const r = r0 + (r1 - r0) * (1 - (1 - t) * (1 - t));
      g.ring(fx0 + 0.5, fy0 + 0.5, r, r / 2, ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))]);
      // a wheat-ear rune: four short ticks round the ring, for the first frames
      if (f < 4) {
        g.ring(fx0 + 0.5, fy0 + 0.5, 30, 15, f < 2 ? PAL.gold4 : PAL.gold2);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          g.px(fx0 + R(Math.cos(a) * 34), fy0 + R(Math.sin(a) * 17), PAL.white);
          g.px(fx0 + R(Math.cos(a) * 37), fy0 + R(Math.sin(a) * 18.5), PAL.gold3);
        }
      }
    });
  }).then(() => ras.destroy());
}

/** A column of wheat falling into the bowl from above (2–3 px wide, stepped, grains streaming). */
function pourColumn(sc: Phaser.Scene, sv: Sieve, ms: number, seed: number): Promise<void> {
  const rnd = fxRng(seed);
  const TOP = 56;
  const ras = new Raster(sc, 0, 0, 9, TOP + 8, D_SIEVE + 0.5);
  const grains = new PxSparks(sc, D_SIEVE + 0.6);
  return run(sc, ms, (t, el, dt) => {
    const m = sv.crest();
    ras.moveTo(m.x - 4, m.y - TOP);
    // the column grows down (0–30 %), streams, then its tail falls in (80–100 %)
    const head = Math.min(1, t / 0.3);
    const tail = t < 0.8 ? 0 : (t - 0.8) / 0.2;
    const y0 = R(TOP * tail);
    const y1 = R(TOP * head);
    ras.draw((g) => {
      for (let y = y0; y < y1; y++) {
        const w = y < 6 ? 1 : 2;
        const k = (y + Math.floor(el / 30)) % 4;
        for (let c = 0; c < w + 1; c++) {
          const x = 4 - (w === 1 ? 0 : 1) + c;
          const tone = c === 0 ? PAL.gold4 : k === 0 ? PAL.gold2 : PAL.gold3;
          if (c <= w) g.px(ras.x + x, ras.y + y, tone);
        }
      }
    });
    if (dt > 0 && t > 0.2 && t < 0.95 && rnd() < 0.7) {
      const side = rnd() < 0.5 ? -1 : 1;
      grains.add({ x: m.x + side, y: m.y, vx: side * (10 + rnd() * 30), vy: -(20 + rnd() * 40), ay: 480, life: 140 + rnd() * 90, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
    }
  }).then(() => {
    ras.destroy();
    grains.release();
  });
}

// ================================================================ a tumbling card (a native pixel drawing)

/** Native sizes of a card as it flies (never a scaled sprite); the last is the hand card itself (48 × 68). */
const SIZES: readonly (readonly [number, number])[] = [
  [8, 11],
  [12, 17],
  [16, 23],
  [20, 28],
  [24, 34],
  [32, 45],
  [40, 57],
  [48, 68],
];
/** The size the hand's own draw sprite starts at (scale 0.5): a tossed card is handed over at exactly this size. */
const HANDOFF_SIZE = 4;
/** Height factors of a card tumbling end over end (stepped quarter turns). */
const TUMBLE = [1, 0.66, 0.3, 0.08, 0.3, 0.66] as const;

/** Paint a card canvas `src` sampled whole-pixel into w × h (height squashed by `fh`), centred in `p`, ink outlined. */
function paintCardAt(p: PixelCanvas, src: PixelCanvas, w: number, h: number, fh: number, rim: number | null, recolor?: (c: number, x: number, y: number) => number | null): void {
  const hh = Math.max(2, R(h * fh));
  const x0 = Math.floor((p.w - w) / 2);
  const y0 = Math.floor((p.h - hh) / 2);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) / w) * src.w));
      const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) / hh) * src.h));
      let c = src.get(sx, sy) ?? PAL.night1;
      if (rim !== null && w < 16 && (x === 0 || y === 0 || x === w - 1 || y === hh - 1)) c = rim;
      if (recolor) {
        const r = recolor(c, x, y);
        if (r === null) continue;
        c = r;
      }
      p.set(x0 + x, y0 + y, c);
    }
  p.outline(PAL.ink);
}

/**
 * A card flicked out of the grain: it hops `up` px over its start, then tumbles DOWN along one parabola toward the
 * hand, growing through native sizes, two grains riding behind it; it is handed over to the hand's own sprite only
 * at `handoff` (a few dozen px from its slot), at the hand sprite's starting size. Resolves there.
 */
function tossCard(sc: Phaser.Scene, from: XY, handoff: XY, player: PlayerId, up: number, ms: number, seed: number): Promise<XY> {
  const BOX = 40;
  const ras = new Raster(sc, from.x - BOX / 2, from.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 12);
  const pc = new PixelCanvas(BOX, BOX);
  const back = cardBackCanvas(player);
  const rim = PLAYER_RAMP[player][3];
  const trail = new PxSparks(sc, DEPTH.FX_TOP + 11);
  const rnd = fxRng(seed);
  // y(t) = y0 + d·t − 4h·t(1 − t): h is chosen so the path's highest point is `up` px over the higher end
  const d = handoff.y - from.y;
  const U = up + Math.max(0, -d);
  const B = 8 * d + 16 * U;
  const h = (B + Math.sqrt(Math.max(0, B * B - 64 * d * d))) / 32;
  const at = (t: number): XY => ({ x: from.x + (handoff.x - from.x) * t, y: from.y + d * t - 4 * h * t * (1 - t) });
  let last = from;
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    // a little ease-out on the way up, then it drops (the parabola does the rest)
    const u = t < 0.3 ? 0.3 * Math.sin(((t / 0.3) * Math.PI) / 2) : t;
    const pos = at(u);
    const size = Math.min(HANDOFF_SIZE, Math.floor(Math.sqrt(t) * 6));
    const turn = Math.floor(Math.pow(t, 0.75) * TUMBLE.length * 1.5);
    const fh = t > 0.86 ? 1 : TUMBLE[turn % TUMBLE.length];
    pc.clear();
    const [w, hh] = SIZES[size];
    paintCardAt(pc, back, w, hh, fh, rim);
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
    // two grains ride behind it, a third shaken off every few frames
    if (dt > 0) {
      f++;
      const vx = pos.x - last.x;
      const vy = pos.y - last.y;
      const vl = Math.max(0.5, Math.hypot(vx, vy));
      const bx = -vx / vl;
      const by = -vy / vl;
      const rr = Math.round(hh * fh * 0.5) + 2;
      trail.add({ x: R(pos.x + bx * rr), y: R(pos.y + by * rr), life: 50, colors: [PAL.gold4], shape: 'px', fadeAt: 1 });
      trail.add({ x: R(pos.x + bx * (rr + 3) + by * 2), y: R(pos.y + by * (rr + 3) - bx * 2), life: 50, colors: [PAL.gold3], shape: 'px', fadeAt: 1 });
      if (f % 3 === 0) trail.add({ x: R(pos.x + bx * rr), y: R(pos.y + by * rr), vx: (rnd() - 0.5) * 20, vy: 10 + rnd() * 20, ay: 300, life: 220 + rnd() * 120, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
    }
    last = pos;
  }).then(() => {
    ras.destroy();
    trail.release();
    return { x: R(handoff.x), y: R(handoff.y) };
  });
}

// ================================================================ straw (the discard)

interface Stalk {
  x: number;
  y: number;
  /** body length (px) */
  len: number;
  /** start direction (0..7, 45° steps) and how many eighth turns it tumbles over the flight */
  dir: number;
  spin: number;
  /** its kink: the last third bends one step left or right */
  bend: 1 | -1;
  delay: number;
  wob: number;
}

/** The eight 45° directions (x right, y down). */
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const STALK_BOX = 30;
const STALKS = new Map<string, PixelCanvas>();

/**
 * One straw stalk as a hand-placed pixel drawing: a 2-px bent straw (a gold4 lit edge over a gold2 body, ink
 * outline) with a wheat ear at its tip (alternating grains on both sides), along direction `dir`, kinked one step.
 */
function stalkSprite(dir: number, bend: 1 | -1, len: number): PixelCanvas {
  const key = `${dir}:${bend}:${len}`;
  const hit = STALKS.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(STALK_BOX, STALK_BOX);
  const d0 = DIRS[dir];
  const d1 = DIRS[(dir + 8 + bend) % 8];
  // the second row of the 2-px straw: below a flat / diagonal stroke, right of a vertical one
  const thick = (d: readonly [number, number]): readonly [number, number] => (d[0] === 0 ? [1, 0] : [0, 1]);
  const total = len + 4;
  let x = Math.floor(STALK_BOX / 2) - Math.round((d0[0] * len * 2) / 3 + (d1[0] * total) / 6);
  let y = Math.floor(STALK_BOX / 2) - Math.round((d0[1] * len * 2) / 3 + (d1[1] * total) / 6);
  const knee = Math.round(len * 0.66);
  let d = d0;
  for (let i = 0; i < len; i++) {
    if (i === knee) d = d1;
    const t = thick(d);
    p.set(x + t[0], y + t[1], i === knee ? PAL.gold1 : PAL.gold2);
    p.set(x, y, i % 4 === 3 ? PAL.gold3 : PAL.gold4);
    x += d[0];
    y += d[1];
  }
  // the ear: a spine of grains with grains on both sides, alternating
  const n: readonly [number, number] = [-d[1], d[0]];
  for (let i = 0; i < 4; i++) {
    const ex = x + d[0] * i;
    const ey = y + d[1] * i;
    p.set(ex, ey, i === 3 ? PAL.gold4 : PAL.gold3);
    if (i < 3) {
      const side = i % 2 === 0 ? 1 : -1;
      p.set(ex + n[0] * side, ey + n[1] * side, PAL.gold4);
      p.set(ex - n[0] * side, ey - n[1] * side, PAL.gold2);
    }
  }
  p.outline(PAL.ink);
  STALKS.set(key, p);
  return p;
}

/**
 * The winnowing gust: three flat ribbon swooshes (tapered 3 → 1 px mist / white bands, staggered) run from the sieve
 * to `to`; the stalks lift, tumble in 45° steps and ride it into the pile, shedding a chaff cloud that thins along
 * the way. Resolves as the last stalk lands.
 */
function gustStraw(sc: Phaser.Scene, stalks: Stalk[], to: XY, ms: number, onLand: (k: number) => void, seed: number): Promise<void> {
  const rnd = fxRng(seed);
  const xs = [...stalks.map((s) => s.x), to.x];
  const ys = [...stalks.map((s) => s.y), to.y];
  const bx0 = Math.floor(Math.min(...xs)) - 50;
  const by0 = Math.floor(Math.min(...ys)) - 70;
  const bx1 = Math.ceil(Math.max(...xs)) + 50;
  const by1 = Math.ceil(Math.max(...ys)) + 24;
  const ras = new Raster(sc, bx0, by0, bx1 - bx0, by1 - by0, DEPTH.FX_TOP + 6);
  const cloud = new PxSparks(sc, DEPTH.FX_TOP + 5);
  const from: XY = { x: stalks.reduce((a, s) => a + s.x, 0) / stalks.length, y: stalks.reduce((a, s) => a + s.y, 0) / stalks.length };
  const lift = 30 + Math.min(34, Math.abs(to.x - from.x) * 0.14);
  const ctrl: XY = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - lift };
  const bez = (a: XY, t: number): XY => ({
    x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * ctrl.x + t * t * to.x,
    y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * ctrl.y + t * t * to.y,
  });
  // the path's length (for 1-px sampling of the ribbons)
  let plen = 0;
  for (let i = 1; i <= 20; i++) {
    const a = bez(from, (i - 1) / 20);
    const b = bez(from, i / 20);
    plen += Math.hypot(b.x - a.x, b.y - a.y);
  }
  const landed = new Array(stalks.length).fill(false) as boolean[];
  // three ribbons: offset across the path, staggered in time, the middle one the longest and thickest
  const ribbons = [
    { d: 0, off: -7, len: 46, w: 3 },
    { d: 0.07, off: 0, len: 60, w: 3 },
    { d: 0.15, off: 7, len: 40, w: 2 },
  ];
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.begin();
    // ---- the ribbons: flat tapered bands along the curve (white lit edge, mist body, steel underside)
    for (const rb of ribbons) {
      const u = (t - rb.d) / 0.62;
      if (u <= 0 || u >= 1 + rb.len / plen) continue;
      const head = Math.min(1, u);
      for (let k = 0; k < rb.len; k++) {
        const tt = head - k / plen;
        if (tt < 0) break;
        // the tail draws in after the head arrives
        if (u > 1 && k < (u - 1) * plen) continue;
        const p = bez({ x: from.x, y: from.y + rb.off }, tt);
        const x = R(p.x);
        const y = R(p.y) + rb.off;
        const w = k < rb.len * 0.3 ? rb.w : k < rb.len * 0.7 ? Math.max(1, rb.w - 1) : 1;
        for (let r = 0; r < w; r++) {
          const c = r === 0 ? (k < rb.len * 0.5 ? PAL.white : PAL.mist) : r === w - 1 && w > 2 ? PAL.steel : PAL.mist;
          ras.px(x, y + r, c);
        }
      }
    }
    // ---- the stalks: hand-drawn straw sprites at 45° steps, riding the curve with a wobble
    stalks.forEach((s, i) => {
      const u = Math.max(0, Math.min(1, (t - s.delay) / (1 - s.delay)));
      const e = u * u * (3 - 2 * u);
      const p0 = bez({ x: s.x, y: s.y }, e);
      const wob = Math.sin(u * Math.PI * 2 + s.wob) * 6 * (1 - u);
      const x = R(p0.x + wob);
      const y = R(p0.y);
      if (u >= 1) {
        if (!landed[i]) {
          landed[i] = true;
          onLand(i);
        }
        return;
      }
      const dir = (((s.dir + Math.floor(u * s.spin)) % 8) + 8) % 8;
      ras.pc.blit(stalkSprite(dir, s.bend, s.len), x - ras.x - STALK_BOX / 2, y - ras.y - STALK_BOX / 2);
      // chaff shed from it, thinning along the path
      if (dt > 0 && u > 0 && f % 2 === i % 2 && rnd() < 0.55 * (1 - u)) cloud.add({ x, y, vx: (rnd() - 0.5) * 16, vy: (rnd() - 0.5) * 10 + 4, drag: 2, life: 240 + rnd() * 200, colors: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.earth3], shape: rnd() < 0.25 ? 'sq' : 'px', size: 2, fadeAt: 1 });
    });
    ras.end();
  }).then(() => {
    stalks.forEach((_, i) => {
      if (!landed[i]) onLand(i);
    });
    ras.destroy();
    cloud.release();
  });
}

// ================================================================ where the sieve stands

/**
 * The sieve's floor point: near the middle of the caster's side — P1 over its middle spell/trap tile, P2 between its
 * middle spell/trap and monster tiles (so the rim stays under the top HUD band). A set card is only the origin: its
 * orb flows here, so the sieve never sits under a monster's stat plate on the set tile's row.
 */
function sieveSpot(player: PlayerId): XY {
  const st = zoneXY(player, 'spellTrap', 2);
  if (player === 0) return { x: R(st.x), y: R(st.y) };
  const mo = zoneXY(player, 'monster', 2);
  return { x: R((st.x + mo.x) / 2), y: R((st.y + mo.y) / 2) };
}

// ================================================================ the waiting sieve (across the choice)

interface Waiting {
  player: PlayerId;
  rig: Sieve;
  pool: LightHandle;
  pan: number;
  stopIdle: () => void;
  /** set when the discard (or a dismissal) has taken over */
  taken: boolean;
}

const WAITING = new Map<PlayerId, Waiting>();

function sfxAt(pan: number) {
  return (name: SfxName, o: { volume?: number; pitch?: number; pan?: number } = {}) => playV3(name, { volume: o.volume ?? 0.9, pitch: o.pitch, pan: o.pan ?? pan });
}

/** The waiting pose: the grains slide slowly side to side, a glint wanders, motes float; a hush at each turn. */
function idle(sc: Phaser.Scene, w: Waiting): () => void {
  const S = w.rig.s;
  const sfx = sfxAt(w.pan);
  let lastSide = 0;
  let t0 = -1;
  return onFrame(sc, (_dt, el) => {
    if (!w.rig.alive() || w.taken) return false;
    if (t0 < 0) t0 = el;
    const ph = (el - t0) / 1300;
    const v = Math.sin(ph * TAU);
    S.slosh = R(v * 4);
    const side = v > 0.95 ? 1 : v < -0.95 ? -1 : 0;
    if (side !== 0 && side !== lastSide) {
      lastSide = side;
      sfx('e_sieveIdle', { volume: 0.32, pan: w.pan + side * 0.15 });
    }
    return true;
  });
}

/** Unravel the sieve and clear the light (end of the discard, or a dismissal). */
async function unravel(sc: Phaser.Scene, rig: Sieve, pool: LightHandle, pan: number, ms: number, windDir: number): Promise<void> {
  const S = rig.s;
  sfxAt(pan)('e_sieveEnd', { volume: 0.85 });
  rig.motes = false;
  void pool.fadeOut(ms + 120);
  const rnd = fxRng(rig.floor.x * 3 + rig.floor.y);
  const sp = new PxSparks(sc, D_SIEVE + 1);
  let last = -1;
  await run(sc, ms, (t) => {
    const k = Math.floor(t * 8) / 8;
    S.undo = k;
    S.heap = Math.max(0, S.heap - 0.05);
    if (k !== last) {
      last = k;
      // loose strands blown off the unravelling edge, downwind
      const m = rig.mesh();
      for (let i = 0; i < 4; i++)
        sp.add({ x: m.x + R((rnd() - 0.5) * 2 * RX), y: m.y + R((rnd() - 0.5) * 2 * RY), vx: windDir * (30 + rnd() * 50), vy: -(10 + rnd() * 30), ay: 40, drag: 1.2, life: 300 + rnd() * 260, colors: [PAL.gold4, PAL.gold3, PAL.earth3, PAL.earth2], shape: rnd() < 0.3 ? 'streak' : 'px', fadeAt: 0.7 });
    }
  });
  sp.release();
  rig.stop();
}

// ================================================================ the activation

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const T = SIEVE_T;
  const player = ev.player;
  // a sieve left over from an earlier duel / an abandoned choice
  const old = WAITING.get(player);
  if (old) {
    WAITING.delete(player);
    old.taken = true;
    old.stopIdle();
    if (old.rig.alive()) old.rig.stop();
    void old.pool.fadeOut(100);
  }
  // the draws this spell makes (three, fewer when one completes the seals), its graveyard trip, the choice
  const draws: number[] = [];
  let gi = -1;
  let choice = false;
  for (let i = ctx.index + 1; i < ctx.events.length; i++) {
    const e = ctx.events[i];
    if (e.type === 'draw' && e.player === player && !e.initial && !ctx.isConsumed(i) && draws.length < 3) draws.push(i);
    else if (e.type === 'toGraveyard' && e.uid === ev.uid && e.from === 'resolved') gi = i;
    else if (e.type === 'decision' && e.pending.kind === 'discard' && e.pending.player === player) {
      choice = true;
      break;
    } else if (e.type === 'activate' || e.type === 'turnStart' || e.type === 'phaseChange' || e.type === 'gameOver') break;
  }
  const set = setTileOf(ctx);
  const spot = sieveSpot(player);
  const pan = panAt(spot.x);
  const sfx = sfxAt(pan);
  const op = await spellOpening(ctx, { uid: ev.uid, cardId: ev.cardId, player, from: set ? 'set' : 'hand', zone: ev.zone, hold: 220, releaseFrom: 'bottom', setRelease: 'flow' });
  relax(ctx, 300);
  if (draws.length === 0) {
    await op.close();
    return;
  }
  await op.release({ x: spot.x, y: spot.y - H_BORN }, { path: 'arc', lift: 14, ms: 160, size: 2 });

  // ---- LAND + WEAVE
  const rig = makeSieve(sc, spot, player, spot.x * 7 + spot.y * 13 + player);
  const S = rig.s;
  bg(floorRing(sc, spot));
  void lightFlash(sc, spot.x, spot.y - 10, PAL.gold4, 44, 300, { floorY: spot.y, intensity: 0.9 });
  const pool = lightPool(sc, spot.x, spot.y - 8, { color: PAL.gold3, radius: 58, floorY: spot.y, intensity: 0, anim: 'breathe', fadeIn: 0 });
  pool.setIntensity(0.55, 220);
  sfx('e_sieveWeave');
  let el = 0;
  const at = async (ms: number) => {
    if (ms > el) await wait(sc, ms - el);
    el = Math.max(el, ms);
  };
  for (let k = 1; k <= T.hoopSteps; k++) {
    S.hoop = k / T.hoopSteps;
    await at(k * T.hoopStepMs);
  }
  await at(T.mesh);
  for (let k = 1; k <= T.meshRows; k++) {
    S.mesh = k / T.meshRows;
    await at(T.mesh + k * T.meshStepMs);
  }
  // ---- POUR + RISE
  await at(T.pour);
  sfx('e_sievePour');
  bg(pourColumn(sc, rig, T.pourMs, spot.x + 11));
  bg(
    run(sc, T.pourMs, (t) => {
      S.heap = Math.min(1, Math.ceil(t * 4) / 4);
      // rise to the working height with a 1-px overshoot
      const u = Math.min(1, t / 0.8);
      S.hgt = R(H_BORN + (H_WORK + 1 - H_BORN) * (1 - (1 - u) * (1 - u))) - (t > 0.9 ? 1 : 0);
    }).then(() => {
      S.heap = 1;
      S.hgt = H_WORK;
    }),
  );
  pool.setIntensity(0.75, 200);

  // ---- SHAKE: 6 Hz, ±6 px, a squash on each stroke; the grain lags and piles against the rim (some of it flies
  //      over), chaff sifts, the three cards work their way up
  await at(T.shake);
  rig.sift = 1.4;
  for (let c = 0; c < T.cycles; c++) {
    sfx('e_sieveShake', { volume: 1, pitch: 1 + c * 0.015 });
    let lastI = -1;
    await run(sc, T.cycleMs, (t) => {
      const i = Math.min(SHAKE.length - 1, Math.floor(t * SHAKE.length));
      S.sx = SHAKE[i];
      // the heap lags two steps behind the hoop and overshoots it
      S.slosh = -R(SHAKE[(i + SHAKE.length - 3) % SHAKE.length] * 0.9);
      if (i !== lastI) {
        lastI = i;
        // a stroke's end: a 1-frame squash and grain thrown over that side of the rim
        if (Math.abs(SHAKE[i]) === 6) {
          S.squash = 2;
          rig.spill(Math.sign(SHAKE[i]), 3 + c);
        } else S.squash = 0;
      }
      const g = (c + t) / T.cycles;
      // only as many cards work their way up as will be drawn (the middle one first, then left, right)
      const up = (j: number) => Math.min(1, Math.max(0, g * 1.25 - j * 0.12));
      S.cards = [draws.length > 1 ? up(1) : 0, up(0), draws.length > 2 ? up(2) : 0];
    });
    el += T.cycleMs;
  }
  S.sx = 0;
  S.slosh = 0;
  S.squash = 0;
  rig.sift = 0.3;
  S.cards = [draws.length > 1 ? 1 : 0, 1, draws.length > 2 ? 1 : 0];

  // ---- TOSSES: dip, flick, a golden burst; the card tumbles up a little and down toward the hand, handed over
  //      to the hand only near its slot. The third is the climax: a deeper dip, a hit-stop, a white rim flash.
  const hand = ctx.views.hand;
  const cam = sc.cameras.main;
  const scroll = (p: XY): XY => ({ x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)) });
  const worldOf = (p: XY): XY => ({ x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)) });
  const pile = ctx.views.field.pile(player, 'deck');
  const spray = new PxSparks(sc, D_SIEVE + 0.8);
  const rnd = fxRng(spot.y * 17 + 5);
  const flights: Promise<void>[] = [];
  const handOffs: Promise<void>[] = [];
  const order = [1, 0, 2]; // the middle card first, then the left, then the right
  for (let k = 0; k < draws.length; k++) {
    await at(T.toss[k]);
    const d = evAt(ctx, draws[k], 'draw');
    if (!d) continue;
    ctx.consumeAt(draws[k]);
    const big = k === 2;
    // anticipation: the sieve dips …
    const dip = big ? 5 : 3;
    const dms = big ? T.bigDipMs : T.dipMs;
    await run(sc, dms, (t) => {
      S.dy = -R(dip * Math.sin((t * Math.PI) / 2));
      S.squash = big && t > 0.5 ? 1 : 0;
    });
    el += dms;
    // … and flicks up: the card leaves
    S.dy = big ? 6 : 4;
    S.squash = 0;
    S.rimFlash = big ? 6 : 2;
    const slot = order[k];
    S.cards[slot] = 0;
    sfx(big ? 'e_sieveTossBig' : 'e_sieveToss', { pitch: 1 + k * 0.05, volume: 1 });
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const c = rig.crest();
    const from = { x: c.x + CARD_SPOTS[slot][0], y: c.y - 4 };
    void lightFlash(sc, from.x, from.y, PAL.gold4, big ? 48 : 30, big ? 320 : 220, { floorY: spot.y, intensity: big ? 1 : 0.75 });
    // the golden burst out of the grain (falls back into the bowl): 2-px crest grains among 1-px ones
    const n = big ? 70 : 40 + k * 8;
    for (let i = 0; i < n; i++) {
      const vy = -(90 + rnd() * (100 + k * 50));
      const life = Math.min(760, (-2 * vy * 1000) / 520 + 30);
      const two = rnd() < 0.3;
      spray.add({ x: from.x + R((rnd() - 0.5) * 14), y: from.y + 2, vx: (rnd() - 0.5) * (60 + k * 30), vy, ay: 520, life, colors: two ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2], shape: two ? 'sq' : 'px', size: 2, fadeAt: 1 });
    }
    rig.spill(-1, big ? 5 : 2);
    rig.spill(1, big ? 5 : 2);
    if (big) await hitStop(sc, T.bigStop);
    const slotXY = worldOf(hand.owner === player ? hand.nextSlotXY() : hand.miniXY(player));
    // the hand-over point: just over the slot (a short, last glide into the fan is the hand's own)
    const handoff: XY = hand.owner === player ? { x: slotXY.x + (player === 0 ? -14 : 14), y: slotXY.y - 40 } : { x: slotXY.x, y: slotXY.y + (slotXY.y < 180 ? 30 : -30) };
    const up = Math.max(6, Math.min(22, from.y - 70));
    const dist = Math.hypot(handoff.x - from.x, handoff.y - from.y);
    const fms = R(T.flightBase + dist * T.flightPerPx);
    bg(run(sc, T.flickMs + (big ? 30 : 0), (t) => (S.dy = R((big ? 6 : 4) * (1 - t)))).then(() => (S.dy = 0)));
    handOffs.push(
      tossCard(sc, from, handoff, player, up, fms, d.uid * 3 + k).then((p) => {
        flights.push(hand.addCard(d.uid as Uid, d.cardId, scroll(p), player).catch(() => undefined));
      }),
    );
  }
  sfx('e_sieveFall', { volume: 0.9 });
  spray.release();
  rig.sift = 0;
  // the spent spell card: born on the floor beside the sieve as the last card leaves, off to the graveyard
  const g = evAt(ctx, gi, 'toGraveyard');
  let send: Promise<void> = Promise.resolve();
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x + (player === 0 ? -RX + 8 : RX - 8), y: spot.y + 8 }, delay: 60 });
  }

  // ---- SETTLE LOW (or, with no choice to wait for, unravel at once)
  await at(T.settle);
  await Promise.all(handOffs);
  if (!choice) {
    await unravel(sc, rig, pool, pan, T.unravelMs, player === 0 ? -1 : 1);
    await Promise.race([Promise.all(flights), wait(sc, 200)]);
    await send;
    return;
  }
  sfx('e_sieveSettle', { volume: 0.8 });
  const h0 = S.hgt;
  await run(sc, T.settleMs, (t) => {
    const e = t * t * (3 - 2 * t);
    S.hgt = R(h0 + (H_WAIT - 1 - h0) * e) + (t > 0.85 ? 1 : 0);
    S.heap = 1 - Math.floor(e * 2) * 0.1;
  });
  S.hgt = H_WAIT;
  pool.setIntensity(0.45, 240);
  rig.motes = true;
  const w: Waiting = { player, rig, pool, pan, stopIdle: () => undefined, taken: false };
  w.stopIdle = idle(sc, w);
  WAITING.set(player, w);
  await Promise.race([Promise.all(flights), wait(sc, 200)]);
  await send;
});

// ================================================================ the discard into the sieve

type DiscardEv = Extract<GameEvent, { type: 'discard' }>;
type DCtx = CinematicContext<DiscardEv>;

/** Where a discarded card starts: the viewer's hand card (taken out of the fan), or the mini hand. */
function takeFromHand(ctx: DCtx, ev: DiscardEv, gone: Set<Uid>): XY {
  const hand = ctx.views.hand;
  gone.add(ev.uid);
  if (hand.owner === ev.player) {
    const s = hand.takeCard(ev.uid);
    if (s) {
      const p = { x: R(s.x), y: R(s.y) };
      s.destroy();
      return p;
    }
  }
  const at = hand.miniXY(ev.player, 0);
  if (hand.owner !== ev.player) {
    const remaining = ctx.state.players[ev.player].hand.filter((u) => !gone.has(u)).map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
    hand.setCards(remaining, ev.player);
  }
  return { x: R(at.x), y: R(at.y) };
}

/** The straw tones a card's face dries into (by its own value: dark → earth, light → gold). */
function strawOf(c: number, x: number, step: number): number | null {
  const r = (c >> 16) & 255;
  const gg = (c >> 8) & 255;
  const b = c & 255;
  const v = (r * 3 + gg * 4 + b) / 8;
  const ramp = [PAL.earth1, PAL.earth2, PAL.gold2, PAL.gold3, PAL.gold4];
  const tone = ramp[Math.min(4, Math.floor((v / 256) * 5))];
  if (step < 1) return tone;
  // split into stalks: every third column drops out, the rest are lit on their left edge
  if (x % 3 === 2) return null;
  return x % 3 === 0 ? (tone === PAL.earth1 ? PAL.earth3 : PAL.gold4) : tone;
}

/** The resting card's canvas (16 × 23 + its outline). */
const REST_W = 16;
const REST_H = 23;
const REST_SINK = 8;

registerEvent(
  'discard',
  async (ctx: DCtx) => {
    const first = ctx.ev;
    const w = LOOK_V3 ? WAITING.get(first.player) : undefined;
    if (!w || w.taken || !w.rig.alive()) return ctx.base();
    w.taken = true;
    WAITING.delete(first.player);
    w.stopIdle();
    const sc = ctx.scene;
    const T = SIEVE_T;
    const rig = w.rig;
    const S = rig.s;
    const sfx = sfxAt(w.pan);
    rig.motes = false;
    // this discard and the same player's following ones, with their toGraveyard events
    const group: DiscardEv[] = [first];
    const own = (uid: Uid) => ctx.findType('toGraveyard', (e) => e.uid === uid && e.from === 'hand');
    const g0 = own(first.uid);
    if (g0 >= 0) ctx.consumeAt(g0);
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (ctx.isConsumed(i)) continue;
      if (e.type === 'discard' && e.player === first.player) {
        group.push(e);
        ctx.consumeAt(i);
        const gi = own(e.uid);
        if (gi >= 0) ctx.consumeAt(gi);
        continue;
      }
      if (e.type === 'toGraveyard' && e.from === 'hand') continue;
      break;
    }
    const owner = ctx.owner(first.uid);
    const grave = ctx.views.field.pile(owner, 'graveyard');
    const gTop = grave.topXY();
    const windDir = gTop.x >= rig.floor.x ? 1 : -1;
    w.pool.setIntensity(0.7, 200);

    // ---- DROP: the cards fall from the hand into the sieve (it rises to meet them), shrinking through native sizes
    //      from the hand card's own size down to the resting size, then they sit half sunk IN the grain
    const h0 = S.hgt;
    bg(run(sc, T.dropMs, (t) => (S.hgt = R(h0 + (H_CATCH - h0) * Math.sin((t * Math.PI) / 2)))));
    const gone = new Set<Uid>();
    const BOX = 56;
    const n = group.length;
    const restDx = (k: number) => (n > 1 ? (k === 0 ? -9 : 10) : 0);
    const cards = group.map((ev, k) => {
      const from = takeFromHand(ctx, ev, gone);
      const ras = new Raster(sc, from.x - BOX / 2, from.y - BOX / 2, BOX, 76, DEPTH.FX_TOP + 12);
      return { ev, from, ras, face: cardFaceCanvas(ev.cardId), pc: new PixelCanvas(BOX, 76), k, rest: null as Resting | null };
    });
    const restCanvas = (face: PixelCanvas, step: number): PixelCanvas => {
      const pc = new PixelCanvas(REST_W + 2, REST_H + 2);
      paintCardAt(pc, face, REST_W, REST_H, 1, null, step < 0 ? undefined : (col, px) => strawOf(col, px, step));
      return pc;
    };
    const drops = cards.map((c) =>
      wait(sc, c.k * T.dropGap).then(() => {
        sfx('e_sieveDrop', { pitch: 1 + c.k * 0.05 });
        return run(sc, T.dropMs - 40, (t) => {
          const m = rig.mesh();
          const to = { x: m.x + restDx(c.k), y: m.y - 8 };
          const k = 1 - (1 - t) * (1 - t);
          const x = c.from.x + (to.x - c.from.x) * t;
          const y = c.from.y + (to.y - c.from.y) * k - Math.sin(t * Math.PI) * 30;
          // from the hand's size (48 × 68) down to the resting size (16 × 23), whole native steps
          const size = Math.max(2, SIZES.length - 1 - Math.floor(t * (SIZES.length - 2)));
          const [sw, sh] = SIZES[size];
          c.pc.clear();
          paintCardAt(c.pc, c.face, sw, sh, 1, null);
          c.ras.moveTo(R(x) - BOX / 2, R(y) - 38);
          c.ras.begin();
          c.ras.pc.blit(c.pc, 0, 0);
          c.ras.end();
        }).then(() => {
          // the card sinks into the grain: it now belongs to the sieve's own drawing (behind the front band)
          c.ras.destroy();
          c.rest = { pc: restCanvas(c.face, -1), dx: restDx(c.k), foot: MY + 6, sink: REST_SINK };
          S.rest.push(c.rest);
          const m = rig.mesh();
          const sp = new PxSparks(sc, D_SIEVE + 0.8);
          const rnd = fxRng(c.ev.uid * 7);
          for (let i = 0; i < 12; i++) sp.add({ x: m.x + restDx(c.k) + R((rnd() - 0.5) * 16), y: m.y + 2, vx: (rnd() - 0.5) * 50, vy: -(40 + rnd() * 50), ay: 480, life: 200 + rnd() * 100, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: rnd() < 0.3 ? 'sq' : 'px', size: 2, fadeAt: 1 });
          sp.release();
        });
      }),
    );
    await Promise.all(drops);

    // ---- JOLT: one hard shake cycle, the cards sink a step deeper
    sfx('e_sieveShake', { volume: 1, pitch: 0.94 });
    let lastI = -1;
    await run(sc, T.cycleMs, (t) => {
      const i = Math.min(SHAKE.length - 1, Math.floor(t * SHAKE.length));
      S.sx = SHAKE[i];
      S.slosh = -R(SHAKE[(i + SHAKE.length - 3) % SHAKE.length] * 0.9);
      if (i !== lastI) {
        lastI = i;
        S.squash = Math.abs(SHAKE[i]) === 6 ? 2 : 0;
        if (Math.abs(SHAKE[i]) === 6) rig.spill(Math.sign(SHAKE[i]), 3);
      }
      for (const c of cards) if (c.rest) c.rest.sink = REST_SINK + (t > 0.5 ? 2 : 1);
    });
    S.sx = 0;
    S.slosh = 0;
    S.squash = 0;

    // ---- STRAW: the faces dry to straw, split into stalks, break apart
    await wait(sc, T.strawWait);
    sfx('e_sieveStraw', { volume: 1 });
    for (const c of cards) {
      const m = rig.mesh();
      void lightFlash(sc, m.x + restDx(c.k), m.y - 10, PAL.gold4, 24, 220, { floorY: rig.floor.y, intensity: 0.7 });
    }
    for (const c of cards) if (c.rest) c.rest.pc = restCanvas(c.face, 0);
    await wait(sc, T.strawStepMs);
    for (const c of cards) if (c.rest) c.rest.pc = restCanvas(c.face, 1);
    await wait(sc, T.strawStepMs);
    // break into stalks: from the card's own spot, the gust takes them
    const stalks: Stalk[] = [];
    const owners: number[] = [];
    const rnd = fxRng(first.uid * 13 + 3);
    const m0 = rig.mesh();
    for (const c of cards) {
      if (c.rest) S.rest.splice(S.rest.indexOf(c.rest), 1);
      const x0 = m0.x + restDx(c.k);
      for (let j = 0; j < 6; j++) {
        stalks.push({
          x: x0 - 6 + R(j * 2.4),
          y: m0.y - 12 + R((rnd() - 0.5) * 10),
          len: 7 + Math.floor(rnd() * 3),
          dir: windDir > 0 ? [7, 0, 1, 6][j % 4] : [3, 4, 5, 2][j % 4],
          spin: windDir * (4 + Math.floor(rnd() * 6)),
          bend: rnd() < 0.5 ? 1 : -1,
          delay: c.k * 0.08 + j * 0.03 + rnd() * 0.04,
          wob: rnd() * TAU,
        });
        owners.push(c.k);
      }
    }

    // ---- GUST: the winnowing breath sweeps the straw into the graveyard (its sound pans along with it)
    const gp = panAt(gTop.x);
    sfxAt((w.pan + gp) / 2)(windDir > 0 ? 'e_sieveGustR' : 'e_sieveGustL', { volume: 1 });
    S.heap = 0.85;
    const left = cards.map(() => 6);
    let landedCards = 0;
    const gustP = gustStraw(
      sc,
      stalks,
      { x: gTop.x, y: gTop.y - 4 },
      T.gustMs,
      (i) => {
        const k = owners[i];
        left[k]--;
        if (left[k] !== 0) return;
        const c = cards[k];
        landedCards++;
        grave.set(landingCount(grave.count, ctx.after.players[owner].graveyard.length), c.ev.cardId);
        grave.bump();
        sfxAt(gp)('e_sieveGrave', { pitch: 1 + landedCards * 0.05 });
        void lightFlash(sc, gTop.x, gTop.y - 4, PAL.gold3, 24, 260, { intensity: 0.6 });
      },
      first.uid * 5,
    );
    // the gust also lifts loose chaff off the heap
    const sp = new PxSparks(sc, D_SIEVE + 1);
    for (let i = 0; i < 22; i++) sp.add({ x: m0.x + R((rnd() - 0.5) * 50), y: m0.y - 6, vx: windDir * (40 + rnd() * 80), vy: -(20 + rnd() * 40), ay: 30, drag: 1, delay: rnd() * 140, life: 340 + rnd() * 260, colors: [PAL.gold4, PAL.gold3, PAL.earth3], shape: 'px', fadeAt: 1 });
    sp.release();
    await wait(sc, T.unravelAfter);
    // ---- UNRAVEL
    const end = unravel(sc, rig, w.pool, w.pan, T.unravelMs, windDir);
    await gustP;
    await end;
  },
  { name: 'e:winnow_sieve:discard', priority: 2 },
);

// ================================================================ dismissal: the choice never came

registerObserver((ev, ctx) => {
  if (!WAITING.size) return;
  if (ev.type === 'discard' || ev.type === 'toGraveyard' || ev.type === 'decision' || ev.type === 'draw') return;
  for (const [p, w] of [...WAITING]) {
    WAITING.delete(p);
    w.taken = true;
    w.stopIdle();
    if (!w.rig.alive()) continue;
    bg(unravel(ctx.scene, w.rig, w.pool, w.pan, SIEVE_T.unravelMs, p === 0 ? -1 : 1));
  }
});
