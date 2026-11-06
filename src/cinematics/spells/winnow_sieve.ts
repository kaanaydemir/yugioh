// Harman Eleği (winnow_sieve) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S5; lane E). The v1 look keeps the
// generic spell activation, the plain draws and the end-phase style discard: everything here steps aside without
// ?look=v3 (the activate hook calls ctx.base(), the discard handler never claims).
//
// "Oyuncunun tarafında hasırdan dev, yuvarlak bir harman eleği belirir, yatay ritimle sallanır (tane hışırtısı) →
//  elekten üç kart altın buğday taneleri arasında yukarı zıplar ve ele düşer → seçim sırasında elek alçakta bekler,
//  taneler hafifçe kayar → seçilen 2 kart elekte samana dönüşür ve bir rüzgar onları sap saman hâlinde mezarlığa
//  savurur."
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Activation signature ≈ 2.0 s after the opening,
// the discard ≈ 1.3 s after the choice (§7: 3.0 s + the choice; the owner allows the card its own lengths).
//   0      common v3 spell opening (spells/_kit): the hand card flies beside its owner (a set card stands up on its
//          own tile), "HARMAN ELEĞİ" plate, short hover (hold 220)
//   ~380   RELEASE: the card pours into a golden orb that drops to the sieve's floor point — near the middle of the
//          caster's side (P1: its middle spell/trap tile; P2: between its middle spell/trap and monster tiles), a set
//          card's orb flows there from its own tile; the hand is never covered
//   S+0    LAND: a wide gold ring runs out on the floor, the warm light pool comes on — e_sieveWeave
//   S+0    THE HOOP (a GIANT sieve, ~100 px across) bends itself round from the front in 8 stepped arcs, lashings pop on
//   S+90   THE MESH weaves itself in from the back rim to the front, row by row (a basket weave of straw strands)
//   S+150  THE POUR: a golden column of wheat falls into the bowl, the heap swells in 4 steps — e_sievePour; the sieve
//          rises to its working height (24 px over its opaque shadow) with a 1-px overshoot
//   S+320  THE SHAKE: 4 cycles at 6 Hz (12 stepped offsets each, ±6 px) with a 1-frame squash at each stroke's end;
//          the heap lags and piles up against the rim it is thrown to, grains fly over that side, chaff sifts through
//          the mesh as a golden curtain lit by the pool, three card backs WORK THEIR WAY UP out of the grain —
//          e_sieveShake on EVERY cycle (hard-panned left / right strokes)
//   S+1040 TOSS 1 / S+1220 TOSS 2: the sieve dips 3 px and flicks up 4 px, the rim flashes gold, a golden burst
//          (40–48 grains, 2-px crest grains among 1-px ones) leaves the grain; the card tumbles end over end, hops
//          ~20 px and falls along ONE parabola toward the hand, growing through native sizes 8×11 → 24×34 with grains
//          riding behind it; it is handed to the hand's own sprite only ~40 px over its slot (the hand sprite starts
//          at that very size) — e_sieveToss; the deck pile gives a card up each time
//   S+1440 TOSS 3, the climax: a deeper 5-px dip with a squash, a 6-px flick, a hit-stop, the rim flashes WHITE, a
//          70-grain burst, grains over both sides — e_sieveTossBig
//   ~S+1600 the grains rain back — e_sieveFall; the spent spell card is born on the floor beside the sieve and
//          leaves for the graveyard (cardLeaves)
//   S+1700 SETTLE: the sieve sinks to its waiting height (7 px), the heap flattens — e_sieveSettle
//   WAIT   (the choice, unbounded): the sieve hangs low; its grains slide slowly side to side, a glint wanders over
//          them, motes float up in the pool; e_sieveIdle at each turn of the slide (very quiet)
// THE DISCARD (registerEvent 'discard', only while this sieve waits for that player):
//   D+0    the chosen cards leave the hand (their faces: discards are public) and fall into the sieve on arcs,
//          shrinking through native sizes from 48×68 to 16×23; the sieve rises to meet them — e_sieveDrop each. On
//          landing a card becomes part of the sieve's own drawing: half sunk in the grain, behind the front band
//   D+380  one hard shake cycle (e_sieveShake), the cards sink a step deeper
//   D+580  STRAW: each card dries (its face recoloured to straw tones), splits into stalks (every third column
//          drops out) — e_sieveStraw
//   D+700  THE GUST: three flat ribbon swooshes (tapered 3 → 1 px, white / mist / steel) run from the sieve to the
//          graveyard; the cards break into hand-drawn 2-px bent straws with wheat ears that tumble in 45° steps and
//          ride it into the pile, shedding a chaff cloud that thins along the way; the pile takes each card when its
//          last stalk lands — e_sieveGustR / L (panned from the sieve to the graveyard), e_sieveGrave
//   D+1060 UNRAVEL: the mesh rows pull out from the front back, the hoop opens into loose strands blown after the
//          gust; the light fades — e_sieveEnd
// EDGES — the first draw completes the five seals (or a draw is missing): no choice follows, the remaining tosses
// are skipped and the sieve unravels at once. A choice that never comes (surrender, a new duel): any other event
// dismisses the waiting sieve.
// P2: the sieve stands on P2's side (upper right); cards fly to whichever hand shows the draws.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only (no alpha on the shadow or
// the grains). The sieve draws above the units' stat plates (FX_TOP), under the hand and the HUD.

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
import { bg, evAt, lightFlash, lightPool, relax, setTileOf, spellOpening, type ActCtx, type LightHandle } from './_kit';
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
  toss: [821, 1000, 1190] as readonly number[],
  dipMs: 45,
  bigDipMs: 80,
  flickMs: 40,
  /** A tossed card's flight: base + per px of path (it carries the card almost all the way to the hand). */
  flightBase: 200,
  flightPerPx: 0.75,
  /** Hit-stop on the third toss (scene ms). */
  bigStop: 90,
  settle: 1420,
  settleMs: 160,
  // the discard (from the first discard event)
  dropMs: 300,
  dropGap: 80,
  /** after the jolt: the pause before the cards dry, each drying step */
  strawWait: 30,
  strawStepMs: 60,
  gustMs: 560,
  /** the unravel starts this long after the gust */
  unravelAfter: 200,
  unravelMs: 360,
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
  /** the emblem's lit pixel (the player's colour, light) */
  emblem: number;
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
        if (flash) p.set(x, y, s.rimFlash > 2 ? (edge || lash ? PAL.white : PAL.gold4) : edge ? rimHi : PAL.gold3);
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
    // round 2: three tone bands so it reads as a MOUND of wheat, not a flat disc — a gold4 crest band (2 rows, with a
    // white highlight that rides the slosh: it trails the heap's lean), a gold3 body of staggered grain dashes (gold2
    // on the shade side, right), and earth3 where the grain meets the rim's shadow (the inner wall's foot)
    const hl = hx - 7 - R(s.slosh * 0.8);
    for (let x = hx - grx; x <= hx + grx; x++) {
      let first = -1;
      for (let y = MY - gry - hh - 4; y <= MY + gry; y++) {
        const lift = liftAt(x);
        if (!inEll(x, y + lift, hx, MY, grx, gry)) continue;
        if (!inEll(x, y, cx, MY, RXI - 1, RYI - 1) && !inEll(x, y + lift, cx, MY, RXI - 1, RYI - 1)) continue;
        if (first < 0) first = y;
        const d = y - first;
        const rel = (x + 0.5 - hx) / grx;
        const rimShade = !inEll(x, y, cx, MY, RXI - 4, RYI - 3);
        let c: number;
        if (d === 0) c = Math.abs(x - hl) < 4 && y < MY ? ((x + ph) % 3 === 0 ? PAL.gold4 : PAL.white) : PAL.gold4;
        else if (d === 1 && y < MY) c = Math.abs(x - hl) < 7 ? PAL.gold4 : (x + ph) % 4 === 0 ? PAL.gold4 : PAL.gold3;
        else if (rimShade) c = (x + y) % 3 === 0 ? PAL.earth2 : PAL.earth3;
        else if (y > MY + gry - 2) c = (x + y) % 3 === 0 ? PAL.gold1 : PAL.gold2;
        else {
          const dash = (x + (y % 2) * 2 + ph) % 4 === 0;
          c = rel > 0.45 ? (dash ? PAL.gold1 : PAL.gold2) : dash ? (rel < -0.3 ? PAL.gold4 : PAL.gold2) : PAL.gold3;
        }
        p.set(x, y, c);
      }
    }
    // the three cards: backs standing out of the grain, staggered (left leaning, middle straight, right leaning)
    s.cards.forEach((up, i) => {
      if (up <= 0) return;
      const [dx, dy, lean] = CARD_SPOTS[i];
      const base = MY + dy;
      const tall = R(up * 14);
      // round 2: they read as CARDS — a 1-px lit rim (mist on the lit top / left, the player's colour on the shade
      // side), the back's body, and the player-colour emblem (a small diamond) once enough of the card is up
      for (let k = 0; k < tall; k++) {
        const y = base - k;
        const shift = lean === 0 ? 0 : Math.floor(k / 5) * lean;
        const fromTop = tall - 1 - k;
        for (let c = 0; c < 10; c++) {
          const x = hx + dx - 5 + c + shift;
          let col: number = s.backTone;
          if (fromTop === 0 || c === 0) col = PAL.mist;
          else if (c === 9) col = s.rimTone;
          else if (fromTop === 1 || c === 1 || c === 8) col = PAL.night2;
          else if (tall >= 9) {
            const ex = Math.abs(c - 4.5) - 0.5;
            const ey = Math.abs(fromTop - 5);
            if (ex + ey <= 1) col = ex + ey === 0 ? s.emblem : s.rimTone;
          }
          p.set(x, y, col);
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
    for (let y = Math.abs(dx) < RXI ? lipIn + 1 : Math.floor(CY); y <= top; y++) p.set(x, y, flash ? (y === top || s.rimFlash > 2 ? rimHi : PAL.gold3) : y === top ? PAL.earth4 : PAL.earth3);
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

/**
 * Sieve depth (round 2): sorted WITH the units by its floor point (UNIT + floor y), so a monster standing in front of
 * it covers it and one behind it is covered — and every stat plate (StatBadge, DEPTH.FX − 20) stays readable over it
 * for the whole choice. Only the things that fly (tossed cards, grains, the pour, straw) live at FX / FX_TOP.
 */
const sieveDepth = (fy: number): number => DEPTH.UNIT + fy + 0.5;
/** Grains thrown into the air (over everything on the board, under the hand / HUD). */
const D_AIR = DEPTH.FX_TOP + 2;

function makeSieve(sc: Phaser.Scene, floor: XY, player: PlayerId, seed: number): Sieve {
  const fx = R(floor.x);
  const fy = R(floor.y);
  const ras = new Raster(sc, fx - CX, fy - H_BORN - MY, W, H, sieveDepth(fy));
  // the shadow: a flat, opaque palette ellipse on the floor (no alpha blending over the tiles)
  const shadow = new Raster(sc, fx - RX - 4, fy - RY - 2, 2 * RX + 9, 2 * RY + 5, DEPTH.TILE_FX + 3);
  const layer = new PixelCanvas(W, H);
  const chaff = new PxSparks(sc, sieveDepth(fy) - 0.2);
  const air = new PxSparks(sc, DEPTH.FX);
  const spillSp = new PxSparks(sc, D_AIR + 0.5);
  const rnd = fxRng(seed);
  const ramp = PLAYER_RAMP[player];
  const s: SieveState = { hoop: 0, mesh: 0, heap: 0, slosh: 0, cards: [0, 0, 0], sx: 0, dy: 0, squash: 0, rimFlash: 0, hgt: H_BORN, undo: 0, el: 0, backTone: PAL.night3, rimTone: ramp[2], emblem: ramp[4] ?? ramp[3], rest: [] };
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

/**
 * The climax's ring (round 2): from the sieve's rim a ring breaks outward in the air — 2 frames white and 2 px thick,
 * then gold4 / gold3 / gold2 and 1 px as it widens and thins out (opaque palette, whole px, over the board).
 */
function rimRing(sc: Phaser.Scene, mesh: XY, floorY: number, ms: number): Promise<void> {
  const cx = R(mesh.x);
  const cy = R(mesh.y) - HOOP;
  // sorted with the units like the sieve (a unit standing in front of the sieve stands in front of its ring too)
  const ras = new Raster(sc, cx - RX - 34, cy - RY - 20, 2 * RX + 69, 2 * RY + 41, sieveDepth(floorY) + 0.1);
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.draw((g) => {
      const e = 1 - (1 - t) * (1 - t);
      const rx = RX + 2 + e * 30;
      const ry = RY + 1 + e * 16;
      const tone = f <= 2 ? PAL.white : t < 0.4 ? PAL.gold4 : t < 0.7 ? PAL.gold3 : PAL.gold2;
      g.ring(cx + 0.5, cy + 0.5, rx, ry, tone);
      if (f <= 3) g.ring(cx + 0.5, cy + 0.5, rx + 1, ry + 1, f <= 2 ? PAL.gold4 : PAL.gold3);
      // a broken trailing ring inside it, every other frame (the air shivering after the snap)
      if (t > 0.2 && t < 0.8 && f % 2 === 0) g.ring(cx + 0.5, cy + 0.5, rx - 6, ry - 3, PAL.gold3);
    });
  }).then(() => ras.destroy());
}

/** A column of wheat falling into the bowl from above (2–3 px wide, stepped, grains streaming). */
function pourColumn(sc: Phaser.Scene, sv: Sieve, ms: number, seed: number): Promise<void> {
  const rnd = fxRng(seed);
  const TOP = 56;
  const ras = new Raster(sc, 0, 0, 9, TOP + 8, D_AIR + 0.5);
  const grains = new PxSparks(sc, D_AIR + 0.6);
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
 * A card flicked out of the grain (round 2): it first hops clearly UP out of the bowl (`up` px, nearly straight, an
 * ease-out to its apex) and only then curves down toward the hand along one bezier, tumbling end over end through
 * stepped quarter turns that land face-flat by 62 % of the flight. It grows one native size per fifth of the flight
 * (8×11 → 12×17 → 16×23 → 20×28 → 24×34: ≥ 4 frames each, no pop) with grains riding behind it; the big (third) toss
 * leaves a longer gold trail. It is handed to the hand's own sprite only at `handoff`, at the hand sprite's starting
 * size. Resolves there.
 */
function tossCard(sc: Phaser.Scene, from: XY, handoff: XY, player: PlayerId, up: number, ms: number, seed: number, big = false): Promise<XY> {
  const BOX = 40;
  const ras = new Raster(sc, from.x - BOX / 2, from.y - BOX / 2, BOX, BOX, DEPTH.FX_TOP + 12);
  const pc = new PixelCanvas(BOX, BOX);
  const back = cardBackCanvas(player);
  const rim = PLAYER_RAMP[player][3];
  const trail = new PxSparks(sc, DEPTH.FX_TOP + 11);
  const rnd = fxRng(seed);
  const HOP = 0.3;
  const apex: XY = { x: from.x + (handoff.x - from.x) * 0.06, y: from.y - up };
  // the second leg leaves the apex still rising a little, then falls toward the hand-over point
  // (the apex is the top of the hop: the bezier leaves it level and falls ever faster toward the hand, a parabola)
  const ctrl: XY = { x: apex.x + (handoff.x - apex.x) * 0.45, y: apex.y - 2 };
  const at = (t: number): XY => {
    if (t < HOP) {
      const u = t / HOP;
      const e = 1 - (1 - u) * (1 - u);
      return { x: from.x + (apex.x - from.x) * u, y: from.y + (apex.y - from.y) * e };
    }
    const e = (t - HOP) / (1 - HOP);
    return {
      x: (1 - e) * (1 - e) * apex.x + 2 * (1 - e) * e * ctrl.x + e * e * handoff.x,
      y: (1 - e) * (1 - e) * apex.y + 2 * (1 - e) * e * ctrl.y + e * e * handoff.y,
    };
  };
  let last = from;
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    const pos = at(t);
    const size = Math.min(HANDOFF_SIZE, Math.floor(t * 5));
    // two full end-over-end turns, landing face-flat at 62 % — the last two sizes are seen flat (no sliver → card pop)
    const fh = t >= 0.62 ? 1 : TUMBLE[Math.floor((t / 0.62) * 12) % TUMBLE.length];
    pc.clear();
    const [w, hh] = SIZES[size];
    paintCardAt(pc, back, w, hh, fh, rim);
    ras.moveTo(R(pos.x) - BOX / 2, R(pos.y) - BOX / 2);
    ras.begin();
    ras.pc.blit(pc, 0, 0);
    ras.end();
    // grains ride behind it, one shaken off every few frames; the climax card drags a longer gold trail
    if (dt > 0) {
      f++;
      const vx = pos.x - last.x;
      const vy = pos.y - last.y;
      const vl = Math.max(0.5, Math.hypot(vx, vy));
      const bx = -vx / vl;
      const by = -vy / vl;
      const rr = Math.round(hh * fh * 0.5) + 2;
      trail.add({ x: R(pos.x + bx * rr), y: R(pos.y + by * rr), life: big ? 140 : 50, colors: big ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.gold4], shape: 'px', fadeAt: 1 });
      trail.add({ x: R(pos.x + bx * (rr + 3) + by * 2), y: R(pos.y + by * (rr + 3) - bx * 2), life: big ? 120 : 50, colors: [PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
      if (big) trail.add({ x: R(pos.x + bx * (rr + 3) - by * 2), y: R(pos.y + by * (rr + 3) + bx * 2), life: 110, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: 'px', fadeAt: 1 });
      if (f % (big ? 2 : 3) === 0) trail.add({ x: R(pos.x + bx * rr), y: R(pos.y + by * rr), vx: (rnd() - 0.5) * 20, vy: 10 + rnd() * 20, ay: 300, life: 220 + rnd() * 120, colors: [PAL.gold4, PAL.gold3, PAL.gold2], shape: big && f % 4 === 0 ? 'sq' : 'px', size: 2, fadeAt: 1 });
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
  // round 2: both players on the middle spell/trap tile of their BACK row — the sieve never stands behind a front-row
  // unit (it is depth-sorted with the units, so whatever stands in front of it covers it, as it should)
  const st = zoneXY(player, 'spellTrap', 2);
  return { x: R(st.x), y: R(st.y) };
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

/**
 * One loose hoop strand as a hand-placed pixel drawing: a 1-px bent strip of the hoop's bent wood / straw (earth4 lit
 * pixels along earth3, a gold3 lashing knot), kinked one 45° step at its knee, ink outlined. Cached.
 */
const STRANDS = new Map<string, PixelCanvas>();
function strandSprite(dir: number, bend: 1 | -1, len: number): PixelCanvas {
  const key = `${dir}:${bend}:${len}`;
  const hit = STRANDS.get(key);
  if (hit) return hit;
  const p = new PixelCanvas(STALK_BOX, STALK_BOX);
  const d0 = DIRS[dir];
  const d1 = DIRS[(dir + 8 + bend) % 8];
  let x = Math.floor(STALK_BOX / 2) - Math.round((d0[0] * len) / 2);
  let y = Math.floor(STALK_BOX / 2) - Math.round((d0[1] * len) / 2);
  const knee = Math.round(len * 0.6);
  for (let i = 0; i < len; i++) {
    const d = i < knee ? d0 : d1;
    p.set(x, y, i === 2 ? PAL.gold3 : i % 3 === 0 ? PAL.earth4 : PAL.earth3);
    x += d[0];
    y += d[1];
  }
  p.outline(PAL.ink);
  STRANDS.set(key, p);
  return p;
}

interface Loose {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  /** a strand (dir / spin / bend / len) or a mesh fibre (a short 1-px dash: len only) */
  strand: boolean;
  dir: number;
  spin: number;
  bend: 1 | -1;
  len: number;
  t0: number;
  life: number;
}

/**
 * Unravel the sieve and clear the light (end of the discard, or a dismissal). Round 2: the woven object comes APART —
 * first the last grain drains through the mesh as a short golden curtain, then the hoop opens from the back, both
 * sides, one arc per step: each arc PEELS OFF as a bent strand that tumbles away downwind after the straw; the mesh
 * rows go from the front back, each falling as a row of short loose fibres. No mask wipe. The loose pieces finish
 * their flight on their own after the sieve is gone.
 */
async function unravel(sc: Phaser.Scene, rig: Sieve, pool: LightHandle, pan: number, ms: number, windDir: number): Promise<void> {
  const S = rig.s;
  const sfx = sfxAt(pan);
  sfx('e_sieveEnd', { volume: 0.85 });
  rig.motes = false;
  void pool.fadeOut(ms + 120);
  const rnd = fxRng(rig.floor.x * 3 + rig.floor.y);
  const m0 = rig.mesh();
  const FLY = 520;
  const bx = R(m0.x) - RX - 40 + (windDir > 0 ? 0 : -150);
  const by = R(m0.y) - 90;
  const ras = new Raster(sc, bx, by, 2 * RX + 230, 170, D_AIR + 1);
  const loose: Loose[] = [];
  const h0 = S.heap;
  const STEPS = 6;
  let step = 0;
  let meshGone = 0;
  let clock = 0;
  const strandAt = (a: number, side: number) => {
    // a point on the rim at angle a from the front (0 front, π back), its tangent's 45° direction
    const m = rig.mesh();
    const x = m.x + side * RX * Math.sin(a);
    const y = m.y - HOOP - RY * Math.cos(a) + 3;
    const tdir = Math.round((Math.atan2(RY * Math.sin(a), side * RX * Math.cos(a)) / TAU) * 8 + 8) % 8;
    loose.push({ x, y, vx: windDir * (55 + rnd() * 60) + side * 14, vy: -(30 + rnd() * 34), ay: 70, strand: true, dir: tdir, spin: windDir * (3 + Math.floor(rnd() * 4)), bend: rnd() < 0.5 ? 1 : -1, len: 9 + Math.floor(rnd() * 5), t0: clock, life: FLY + rnd() * 120 });
  };
  let sieveGone: () => void = () => undefined;
  const gonePromise = new Promise<void>((res) => (sieveGone = res));
  const all = run(sc, ms + FLY + 140, (t, el, dt) => {
    clock = el;
    const u = (t * (ms + FLY + 140)) / ms;
    if (u <= 1) {
      // the heap drains through the mesh first (0–35 %)
      S.heap = Math.max(0, h0 * (1 - Math.ceil(Math.min(1, u / 0.35) * 4) / 4));
      rig.sift = u < 0.4 ? 3 : 0;
      // the hoop opens from the back in STEPS arcs (20–100 %): each opened arc leaves as a strand from both sides
      const k = Math.max(0, Math.min(STEPS, Math.floor(((u - 0.2) / 0.8) * STEPS) + (u >= 0.2 ? 1 : 0)));
      while (step < k) {
        step++;
        const a = Math.PI * (1 - (step - 0.5) / STEPS);
        strandAt(a, -1);
        strandAt(a, 1);
        sfx('e_sieveEnd', { volume: 0.18, pitch: 1.5 + step * 0.06 });
      }
      S.undo = step / STEPS;
      // the mesh rows: S.undo * 1.4 of the rows are gone from the front — each gone row falls as fibres
      const gone = Math.min(RYI * 2, Math.floor(S.undo * 1.4 * RYI * 2));
      const m = rig.mesh();
      while (meshGone < gone) {
        const ry = RYI - meshGone;
        const half = RXI * Math.sqrt(Math.max(0, 1 - (ry / RYI) * (ry / RYI)));
        for (let i = 0; i < Math.max(1, Math.floor(half / 9)); i++) {
          const x = m.x + (rnd() - 0.5) * 2 * half;
          loose.push({ x, y: m.y + ry, vx: windDir * (10 + rnd() * 30), vy: -(rnd() * 20), ay: 280, strand: false, dir: 0, spin: 0, bend: 1, len: 3 + Math.floor(rnd() * 3), t0: clock, life: 260 + rnd() * 160 });
        }
        meshGone += 2;
      }
    } else if (rig.alive()) {
      rig.stop();
      sieveGone();
    }
    // the loose pieces: drawn whole-px, strands tumbling in 45° steps, fibres as 1-px dashes
    ras.begin();
    for (const L of loose) {
      const a = (el - L.t0) / 1000;
      if (a < 0 || a * 1000 > L.life) continue;
      const x = R(L.x + L.vx * a);
      const y = R(L.y + L.vy * a + 0.5 * L.ay * a * a);
      if (L.strand) {
        const dir = (((L.dir + Math.floor(((a * 1000) / L.life) * L.spin)) % 8) + 8) % 8;
        ras.pc.blit(strandSprite(dir, L.bend, L.len), x - ras.x - STALK_BOX / 2, y - ras.y - STALK_BOX / 2);
      } else {
        for (let i = 0; i < L.len; i++) ras.px(x + i * windDir, y, i === 0 ? PAL.earth4 : PAL.earth3);
        ras.px(x, y + 1, PAL.ink);
      }
    }
    ras.end();
    void dt;
  });
  // the scene goes on once the sieve itself is gone; its loose strands finish their flight on their own
  bg(
    all.then(() => {
      if (rig.alive()) rig.stop();
      ras.destroy();
      sieveGone();
    }),
  );
  await gonePromise;
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
  // the warm pool: ONE whole step of light (intensity 1, steady → a flat, quarter-step-exact stamp: no ordered-dither
  // checker on the pads), a ring just wider than the sieve's shadow; it only dithers for the 2–3 frames of its fades
  const pool = lightPool(sc, spot.x, spot.y - 8, { color: PAL.gold3, spill: null, radius: 46, floorY: spot.y, intensity: 1, anim: 'steady', fadeIn: 90 });
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

  // ---- SHAKE: 6 Hz, ±6 px, a squash on each stroke; the grain lags and piles against the rim (some of it flies
  //      over), chaff sifts, the three cards work their way up. Round 2: the shake runs on its own and the first
  //      toss lands on its LAST cycle (three cycles before it, the fourth under it).
  await at(T.shake);
  rig.sift = 1.4;
  const tossed = [false, false, false];
  const shaking = (async () => {
    for (let c = 0; c < T.cycles; c++) {
      sfx('e_sieveShake', { volume: c === T.cycles - 1 ? 0.8 : 1, pitch: 1 + c * 0.015 });
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
        const g = Math.min(1, (c + t) / (T.cycles - 1));
        // only as many cards work their way up as will be drawn (the middle one first, then left, right); a card
        // already tossed stays gone
        const up = (j: number) => Math.min(1, Math.max(0, g * 1.25 - j * 0.12));
        const want = [draws.length > 1 ? up(1) : 0, up(0), draws.length > 2 ? up(2) : 0];
        for (let j = 0; j < 3; j++) if (!tossed[j]) S.cards[j] = want[j];
      });
    }
    S.sx = 0;
    S.slosh = 0;
    S.squash = 0;
    rig.sift = 0.3;
  })();

  // ---- TOSSES: dip, flick, a golden burst; the card hops UP out of the bowl and curves down toward the hand,
  //      handed over to the hand only near its slot. The third is the climax: a deeper dip with a squash, a white
  //      rim ring and a gold floor ring, a fountain twice as tall, a hit-stop, a recoil, a gold-trailed card.
  const hand = ctx.views.hand;
  const cam = sc.cameras.main;
  const scroll = (p: XY): XY => ({ x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)) });
  const worldOf = (p: XY): XY => ({ x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)), y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)) });
  const pile = ctx.views.field.pile(player, 'deck');
  const spray = new PxSparks(sc, D_AIR + 0.8);
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
      if (big) S.squash = t > 0.5 ? 2 : 1;
    });
    el += dms;
    // … and flicks up: the card leaves
    S.dy = big ? 6 : 4;
    S.squash = 0;
    S.rimFlash = big ? 5 : 2;
    const slot = order[k];
    tossed[slot] = true;
    S.cards[slot] = 0;
    sfx(big ? 'e_sieveTossBig' : 'e_sieveToss', { pitch: big ? 0.92 : 1 + k * 0.04, volume: 1 });
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const c = rig.crest();
    const from = { x: c.x + CARD_SPOTS[slot][0], y: c.y - 4 };
    void lightFlash(sc, from.x, from.y, PAL.gold4, big ? 56 : 30, big ? 380 : 220, { floorY: spot.y, intensity: big ? 1 : 0.75 });
    if (big) {
      bg(rimRing(sc, rig.mesh(), spot.y, 260));
      bg(floorRing(sc, spot, 420, 22, 62));
    }
    // the golden burst out of the grain (falls back into the bowl): 2-px crest grains among 1-px ones; the climax is
    // a fountain twice as tall (its crest grains climb past the monster row)
    const n = big ? 96 : 40 + k * 8;
    for (let i = 0; i < n; i++) {
      const vy = big ? -(170 + rnd() * 190) : -(90 + rnd() * (100 + k * 50));
      const life = Math.min(big ? 1250 : 760, (-2 * vy * 1000) / 520 + 30);
      const two = rnd() < (big ? 0.42 : 0.3);
      spray.add({ x: from.x + R((rnd() - 0.5) * (big ? 22 : 14)), y: from.y + 2, vx: (rnd() - 0.5) * (big ? 120 : 60 + k * 30), vy, ay: 520, life, colors: two ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2], shape: two ? 'sq' : 'px', size: 2, fadeAt: 1 });
    }
    rig.spill(-1, big ? 7 : 2);
    rig.spill(1, big ? 7 : 2);
    if (big) await hitStop(sc, T.bigStop);
    const slotXY = worldOf(hand.owner === player ? hand.nextSlotXY() : hand.miniXY(player));
    // the hand-over point: just over the slot (a short, last glide into the fan is the hand's own)
    const handoff: XY = hand.owner === player ? { x: slotXY.x + (player === 0 ? -14 : 14), y: slotXY.y - 40 } : { x: slotXY.x, y: slotXY.y + (slotXY.y < 180 ? 30 : -30) };
    const up = big ? 40 : 30 + k * 4;
    const dist = Math.hypot(handoff.x - from.x, handoff.y - from.y);
    const fms = R(T.flightBase + dist * T.flightPerPx) + (big ? 40 : 0);
    // the flick, then (the climax) a 3-px recoil below rest before it comes back
    if (big) bg(run(sc, 170, (t) => (S.dy = t < 0.35 ? R(6 * (1 - t / 0.35)) : R(-3 * Math.sin(((t - 0.35) / 0.65) * Math.PI)))).then(() => (S.dy = 0)));
    else bg(run(sc, T.flickMs, (t) => (S.dy = R(4 * (1 - t)))).then(() => (S.dy = 0)));
    handOffs.push(
      tossCard(sc, from, handoff, player, up, fms, d.uid * 3 + k, big).then((p) => {
        flights.push(hand.addCard(d.uid as Uid, d.cardId, scroll(p), player).catch(() => undefined));
        // the hand's own glide into the fan takes 360 ms (HandView.addCard): the catch ticks as it lands
        bg(wait(sc, 330).then(() => playV3('e_sieveCatch', { volume: 0.8, pitch: 1 + k * 0.06, pan: panAt(p.x) })));
      }),
    );
  }
  await shaking;
  sfx('e_sieveFall', { volume: 0.9 });
  spray.release();
  rig.sift = 0;
  // the spent spell card: born on the floor just outside the sieve on its graveyard side (never over the bowl, which
  // is depth-sorted with the units now) as the last card leaves, off to the graveyard
  const g = evAt(ctx, gi, 'toGraveyard');
  let send: Promise<void> = Promise.resolve();
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, { owner: g.owner, cardId: g.cardId, from: { x: spot.x + (player === 0 ? RX + 12 : -RX - 12), y: spot.y + 6 }, delay: 60 });
  }

  // ---- SETTLE LOW (or, with no choice to wait for, unravel at once). Round 2: the sieve sinks while the last card
  //      is still in the air (the settle overlaps the flight).
  await at(T.settle);
  if (!choice) {
    await Promise.all(handOffs);
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
  rig.motes = true;
  const w: Waiting = { player, rig, pool, pan, stopIdle: () => undefined, taken: false };
  w.stopIdle = idle(sc, w);
  WAITING.set(player, w);
  await Promise.all(handOffs);
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
          const sp = new PxSparks(sc, D_AIR + 0.8);
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
    const sp = new PxSparks(sc, D_AIR + 1);
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
