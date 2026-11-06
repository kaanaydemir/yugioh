// Harman Eleği (winnow_sieve) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S5; lane E). The v1 look keeps the
// generic spell activation, the plain draws and the end-phase style discard: everything here steps aside without
// ?look=v3 (the activate hook calls ctx.base(), the discard handler never claims).
//
// "Oyuncunun tarafında hasırdan dev, yuvarlak bir harman eleği belirir, yatay ritimle sallanır (tane hışırtısı) →
//  elekten üç kart altın buğday taneleri arasında yukarı zıplar ve ele düşer → seçim sırasında elek alçakta bekler,
//  taneler hafifçe kayar → seçilen 2 kart elekte samana dönüşür ve bir rüzgar onları sap saman hâlinde mezarlığa
//  savurur."
//
// BEAT LIST (scene ms at 1×; × 1.35 in game time with the v3 tempo). Activation signature ≈ 1.8 s after the opening,
// the discard ≈ 1.3 s after the choice (§7: 3.0 s + the choice; the owner allows the card its own lengths).
//   0      common v3 spell opening (spells/_kit): the hand card flies beside its owner (a set card stands up on its
//          own tile), "HARMAN ELEĞİ" plate, short hover (hold 220)
//   ~380   RELEASE: the card pours into a golden orb that drops to the sieve's floor point — the middle spell/trap
//          tile of the caster's BACK row (both players), a set card's orb flows there from its own tile
//   S+0    LAND: a wide gold ring runs out on the floor, the warm pool comes on (one whole stepped-light step: flat,
//          no dither) — e_sieveWeave
//   S+0    THE HOOP (a GIANT sieve, ~100 px across) bends itself round from the front in 8 stepped arcs
//   S+90   THE MESH weaves itself in from the back rim to the front, row by row (a basket weave of straw strands)
//   S+150  THE POUR: a golden column of wheat falls into the bowl, the heap swells in 4 steps — e_sievePour; the sieve
//          rises to its working height (24 px over its opaque shadow) with a 1-px overshoot
//   S+320  THE SHAKE: 4 cycles at 6 Hz (12 stepped offsets each, ±6 px) with a 1-frame squash at each stroke's end;
//          the heap (gold4 crest band with a highlight that trails the slosh, gold3 body, earth3 at the rim shadow)
//          lags and piles up against the rim it is thrown to, grains fly over that side, chaff sifts through the mesh,
//          three card backs (lit rim + player emblem) WORK THEIR WAY UP out of the grain — e_sieveShake every cycle
//   S+821  TOSS 1 (under the 4th shake cycle) / S+1000 TOSS 2: the sieve dips 3 px and flicks up 4 px, the rim flashes
//          gold, a golden burst leaves the grain; the card hops ~30 px straight UP out of the bowl, then falls along
//          one curve toward the hand, tumbling (face-flat from 62 %), growing one native size per fifth of the
//          flight (8×11 → 24×34); handed to the hand's own sprite ~40 px over its slot — e_sieveToss; as it lands in
//          the fan, e_sieveCatch; the deck pile gives a card up each time
//   S+1190 TOSS 3, the climax (round 4): THE WINNOWING THROW — the sieve tips back (2 px) in a deeper 5-px dip, then
//          flicks 6 px tipped forward (−3 px) and flings a crescent SHEET of grain up (two layers of 2×1 grains joined
//          into a band while they are close, white crest on the held frame); the heavy grain rains straight back, the
//          chaff peels off downwind on the air; a gold ring runs out on the floor AROUND the shadow (board-clipped),
//          a 90 ms hit-stop, a 3-px recoil, the card leaping 50 px face-flat with a gold trail — e_sieveTossBig
//          (pitched 0.92: a sub, a rising sandy throw sweep + a high chaff whisk, a grain-shower tail that thins out)
//   (every toss: the card leaves at 12×17, face-flat through its 40–50 px hop, 16×23 by its apex, tumbling after)
//   ~S+1250 the grains rain back — e_sieveFall; the spent spell card is born on the floor just outside the sieve and
//          leaves for the graveyard (cardLeaves)
//   S+1420 SETTLE (while the last card is still flying): the sieve sinks to its waiting height (7 px) — e_sieveSettle
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
//   D+900  UNRAVEL (mid-gust): the last grain drains through the mesh, the hoop opens from the back in 6 arcs, each
//          arc PEELING OFF as a bent 1-px strand that tumbles downwind after the straw (an e_sieveEnd pluck each),
//          the mesh rows fall from the front as short loose fibres that settle on the floor; the light fades
// EDGES — the first draw completes the five seals (or a draw is missing): no choice follows, the remaining tosses
// are skipped and the sieve unravels at once. A choice that never comes (surrender, a new duel): any other event
// dismisses the waiting sieve.
// PLACEMENT + DEPTH (round 4): one rule for both players (sieveSpot) — the sieve stands where NO unit is nearer the
// camera than it, and is drawn over every unit and plate (SIEVE_DEPTH); plates of the units behind it under its
// footprint are set aside while it stands. P1: its middle back tile (the board's front edge). P2: slid along / forward
// off its back row until the bowl is clear (in the staged boards: in front of its own monster). The shake's sound is
// one e_sieveStroke per visual extreme, panned to the rim it hits. Cards fly to whichever hand shows the draws.
// No camera move, no full-screen wash; every crisp thing on whole pixels, palette only (no alpha on the shadow or
// the grains); the flying things (cards, grains, pour, straw, strands) draw at FX / FX_TOP.

import type Phaser from "phaser";
import type { CardId } from "../../data/cards";
import type { GameEvent, PlayerId, Uid } from "../../engine/types";
import { PAL, PLAYER_RAMP } from "../../art/palette";
import { cardBackCanvas, cardFaceCanvas } from "../../art/cards";
import { PixelCanvas } from "../../art/pixel";
import {
  BOARD_COLS,
  BOARD_ROWS,
  DEPTH,
  LOOK_V3,
  isoToScreen,
  screenToIso,
  type XY,
  zoneCell,
} from "../../view/layout";
import { Raster, onFrame, run } from "../../vfx/setpieces";
import { Sparks as PxSparks } from "../../vfx/combat";
import { hitStop, wait } from "../../vfx/core";
import { fxRng } from "../_v3/spellfx";
import { panAt, play as playV3 } from "../_v3/sound";
import { cardLeaves, landingCount } from "../_v3/card";
import {
  registerCardHook,
  registerEvent,
  registerObserver,
  type CinematicContext,
} from "../api";
import {
  bg,
  evAt,
  lightFlash,
  lightPool,
  relax,
  setTileOf,
  spellOpening,
  type ActCtx,
  type LightHandle,
} from "./_kit";
import type { SfxName } from "../../audio/sfx";

const ID: CardId = "winnow_sieve";
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
/** (+7: room under the front band for the winnowing tilt's shear) */
const H = CY + RY + HOOP + 7;
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

const ellY = (x: number, rx: number, ry: number): number =>
  ry * Math.sqrt(Math.max(0, 1 - (x / rx) * (x / rx)));
function inEll(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): boolean {
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
  /** the winnowing tilt: px the right rim drops (+) / lifts (−) (a whole-px column shear) */
  tilt: number;
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
function grainTone(
  x: number,
  y: number,
  top: boolean,
  foot: boolean,
  phase: number,
): number {
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
        const lash =
          Math.abs(Math.round(ang / (TAU / 18)) * (TAU / 18) - ang) < 0.05;
        if (flash)
          p.set(
            x,
            y,
            s.rimFlash > 2
              ? edge || lash
                ? PAL.white
                : PAL.gold4
              : edge
                ? rimHi
                : PAL.gold3,
          );
        else
          p.set(
            x,
            y,
            lash ? PAL.gold3 : edge && dx < 10 ? PAL.earth4 : PAL.earth3,
          );
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
      return R(
        hh * Math.max(0, 1 - dx * dx) * (1 + tilt * dx * 0.7) +
          Math.max(0, tilt * dx) * hh * 0.5,
      );
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
        if (
          !inEll(x, y, cx, MY, RXI - 1, RYI - 1) &&
          !inEll(x, y + lift, cx, MY, RXI - 1, RYI - 1)
        )
          continue;
        if (first < 0) first = y;
        const d = y - first;
        const rel = (x + 0.5 - hx) / grx;
        const rimShade = !inEll(x, y, cx, MY, RXI - 4, RYI - 3);
        let c: number;
        if (d === 0)
          c =
            Math.abs(x - hl) < 4 && y < MY
              ? (x + ph) % 3 === 0
                ? PAL.gold4
                : PAL.white
              : PAL.gold4;
        else if (d === 1 && y < MY)
          c =
            Math.abs(x - hl) < 7
              ? PAL.gold4
              : (x + ph) % 4 === 0
                ? PAL.gold4
                : PAL.gold3;
        else if (rimShade) c = (x + y) % 3 === 0 ? PAL.earth2 : PAL.earth3;
        else if (y > MY + gry - 2)
          c = (x + y) % 3 === 0 ? PAL.gold1 : PAL.gold2;
        else {
          const dash = (x + (y % 2) * 2 + ph) % 4 === 0;
          c =
            rel > 0.45
              ? dash
                ? PAL.gold1
                : PAL.gold2
              : dash
                ? rel < -0.3
                  ? PAL.gold4
                  : PAL.gold2
                : PAL.gold3;
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
      for (let c = -1; c < 11; c++)
        p.set(
          hx + dx - 5 + c,
          base,
          grainTone(hx + dx + c, base, (c & 1) === 0, false, ph),
        );
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
    for (let y = Math.abs(dx) < RXI ? lipIn + 1 : Math.floor(CY); y <= top; y++)
      p.set(
        x,
        y,
        flash
          ? y === top || s.rimFlash > 2
            ? rimHi
            : PAL.gold3
          : y === top
            ? PAL.earth4
            : PAL.earth3,
      );
    // the bent-wood band: lit left, mid, shaded right; straw lashings every 11 px
    const side = dx < -RX * 0.4 ? 0 : dx > RX * 0.45 ? 2 : 1;
    const band = [PAL.earth3, PAL.earth2, PAL.earth1][side];
    const lash = (x - cx + 66) % 11 < 2;
    for (let y = top + 1; y <= top + HOOP; y++) {
      const r = y - top;
      let c: number = band;
      if (lash) c = r === 1 ? PAL.gold4 : PAL.gold3;
      else if (r === HOOP) c = side === 2 ? PAL.earth0 : PAL.earth1;
      else if (r === 1)
        c = flash ? PAL.gold4 : side === 0 ? PAL.earth4 : PAL.earth3;
      else if (r === 4 && (x + 1) % 4 === 0)
        c = side === 2 ? PAL.earth0 : PAL.earth1;
      p.set(x, y, c);
    }
  }
}

// ================================================================ the sieve runtime

/** A unit's stat plate the sieve hides (StatBadge: setVisible + its image). */
interface HiddenPlate {
  setVisible(b: boolean): void;
  readonly image: { readonly active: boolean };
}

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
  /** Stat plates set aside while the sieve stands over them (shown again when it is gone). */
  plates: HiddenPlate[];
  alive(): boolean;
  stop(): void;
}

/**
 * Sieve depth (round 4): over every unit AND every stat plate (BADGE_DEPTH = FX − 20), under the flying things. The
 * placement rule (sieveSpot) puts it where no unit stands nearer the camera, so drawing it over the units is the true
 * depth: P1's sieve stands on the front (back-row) edge of the board, in front of its monsters and their plates. Only
 * the shadow lies on the floor (TILE_FX). The tossed cards, grains, pour, straw and strands live at FX / FX_TOP.
 */
const SIEVE_DEPTH = DEPTH.FX - 12;
/** Grains thrown into the air (over everything on the board, under the hand / HUD). */
const D_AIR = DEPTH.FX_TOP + 2;

function makeSieve(
  sc: Phaser.Scene,
  floor: XY,
  player: PlayerId,
  seed: number,
): Sieve {
  const fx = R(floor.x);
  const fy = R(floor.y);
  const ras = new Raster(sc, fx - CX, fy - H_BORN - MY, W, H, SIEVE_DEPTH);
  // the shadow: a flat, opaque palette ellipse on the floor (no alpha blending over the tiles)
  const shadow = new Raster(
    sc,
    fx - RX - 4,
    fy - RY - 2,
    2 * RX + 9,
    2 * RY + 5,
    DEPTH.TILE_FX + 3,
  );
  const layer = new PixelCanvas(W, H);
  const chaff = new PxSparks(sc, SIEVE_DEPTH - 0.2);
  const air = new PxSparks(sc, DEPTH.FX);
  const spillSp = new PxSparks(sc, D_AIR + 0.5);
  const rnd = fxRng(seed);
  const ramp = PLAYER_RAMP[player];
  const s: SieveState = {
    hoop: 0,
    mesh: 0,
    heap: 0,
    slosh: 0,
    cards: [0, 0, 0],
    sx: 0,
    dy: 0,
    squash: 0,
    tilt: 0,
    rimFlash: 0,
    hgt: H_BORN,
    undo: 0,
    el: 0,
    backTone: PAL.night3,
    rimTone: ramp[2],
    emblem: ramp[4] ?? ramp[3],
    rest: [],
  };
  const rig: Sieve = {
    s,
    floor: { x: fx, y: fy },
    sift: 0,
    motes: false,
    plates: [],
    crest: () => ({
      x: fx + R(s.sx + s.slosh),
      y: fy - R(s.hgt + s.dy) - R(8 * s.heap) - 2,
    }),
    mesh: () => ({ x: fx + R(s.sx), y: fy - R(s.hgt + s.dy) }),
    spill(dir, n) {
      const y = fy - R(s.hgt + s.dy) - HOOP + 2;
      for (let i = 0; i < n; i++) {
        const x = fx + R(s.sx) + dir * (RX - 6 - R(rnd() * 8));
        spillSp.add({
          x,
          y: y - R(rnd() * 3),
          vx: dir * (30 + rnd() * 50),
          vy: -(40 + rnd() * 50),
          ay: 520,
          life: 260 + rnd() * 160,
          colors: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2],
          shape: rnd() < 0.35 ? "sq" : "px",
          size: 2,
          fadeAt: 1,
        });
      }
    },
    alive: () => ras.alive,
    stop() {
      stopFrame();
      for (const b of rig.plates) if (b.image.active) b.setVisible(true);
      rig.plates.length = 0;
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
    const tl = s.tilt;
    if (k > 0 || tl !== 0) {
      // a stroke's squash: bottom anchored, k rows shorter and k px wider each side (nearest neighbour, whole px);
      // the winnowing tilt (round 4): a whole-px column shear — the far side of the throw dips, the near side lifts
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const shear = tl === 0 ? 0 : R(((x - CX) / RX) * tl);
          const yy = y + shear;
          if (yy < k || yy >= H) continue;
          const sy = Math.min(H - 1, Math.floor(((yy - k) * H) / (H - k)));
          const sxp = CX + R(((x - CX) * RX) / (RX + k));
          if (sxp < 0 || sxp >= W) continue;
          const c = layer.get(sxp, sy);
          if (c !== null) ras.pc.set(x, y, c);
        }
      }
    } else ras.pc.blit(layer, 0, 0);
    ras.end();
    if (dt > 0 && s.rimFlash > 0) s.rimFlash--;
    // its shadow on the floor (round 4): ONE flat dark-earth band (not ink), ~64 % of the rim's width, with a smaller
    // night core; it narrows the higher the sieve hangs. It fades in whole tone steps as the sieve unravels (full →
    // earth band only → gone): no checker, no alpha
    shadow.begin();
    if (s.hoop > 0 && s.undo < 0.84) {
      const kk = 1 - s.hgt / 160;
      const g = Math.min(1, s.hoop * 1.5) * (s.undo > 0.5 ? 0.82 : 1);
      const rx = R(RX * 0.75 * kk * g);
      const ry = Math.max(1, R(rx * 0.42));
      const sx = RX + 4 + R(s.sx * 0.5);
      if (rx > 0) {
        shadow.pc.ellipse(sx, RY + 2, rx, ry, PAL.earth0);
        if (rx > 8 && s.undo <= 0.5)
          shadow.pc.ellipse(
            sx,
            RY + 2,
            rx - 7,
            Math.max(1, ry - 3),
            PAL.night0,
          );
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
        chaff.add({
          x,
          y: y0,
          vx: (rnd() - 0.5) * 6,
          vy: 14 + rnd() * 10,
          ay: 160,
          life: Math.min(420, 120 + fall * 9),
          colors: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.earth2],
          shape: "px",
          fadeAt: 1,
        });
      }
    }
    // motes rising slowly in the warm pool while it waits
    if (dt > 0 && rig.motes && el - lastMote > 120) {
      lastMote = el;
      air.add({
        x: fx + R((rnd() - 0.5) * 2 * RX),
        y: fy - R(rnd() * 6),
        vx: (rnd() - 0.5) * 4,
        vy: -(7 + rnd() * 8),
        life: 700 + rnd() * 500,
        colors: [PAL.gold3, PAL.gold2, PAL.gold1],
        shape: "px",
        fadeAt: 1,
      });
    }
    return true;
  });
  return rig;
}

// ================================================================ the floor (landing ring), the pour column

/** True when the world pixel (x, y) lies on the board's tile grid (the floor rings never climb the walls / HUD). */
function onBoard(x: number, y: number): boolean {
  const g = screenToIso(x + 0.5, y + 0.5);
  return (
    g.col >= -0.5 &&
    g.row >= -0.5 &&
    g.col <= BOARD_COLS - 0.5 &&
    g.row <= BOARD_ROWS - 0.5
  );
}

/**
 * A ring running out on the floor (round 4): clipped to the board polygon (never over the back wall / a portrait),
 * and never inside the sieve's shadow (`hole`: the shadow's rx; the ring is drawn AROUND it, the inside is not filled).
 */
function floorRing(
  sc: Phaser.Scene,
  at: XY,
  ms = 320,
  r0 = 8,
  r1 = 58,
  hole = 0,
): Promise<void> {
  const fx0 = R(at.x);
  const fy0 = R(at.y);
  const ras = new Raster(sc, fx0 - 62, fy0 - 32, 125, 65, DEPTH.TILE_FX + 4);
  const ramp = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1];
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    if (dt > 0) f++;
    ras.draw((g) => {
      const r = r0 + (r1 - r0) * (1 - (1 - t) * (1 - t));
      g.ring(
        fx0 + 0.5,
        fy0 + 0.5,
        r,
        r / 2,
        ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))],
      );
      // a wheat-ear rune: four short ticks round the ring, for the first frames
      if (f < 4 && hole === 0) {
        g.ring(fx0 + 0.5, fy0 + 0.5, 30, 15, f < 2 ? PAL.gold4 : PAL.gold2);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * TAU;
          g.px(fx0 + R(Math.cos(a) * 34), fy0 + R(Math.sin(a) * 17), PAL.white);
          g.px(
            fx0 + R(Math.cos(a) * 37),
            fy0 + R(Math.sin(a) * 18.5),
            PAL.gold3,
          );
        }
      }
      g.pc.map((c, x, y) => {
        const wx = x + g.x;
        const wy = y + g.y;
        if (!onBoard(wx, wy)) return null;
        if (hole > 0) {
          const dx = (wx + 0.5 - fx0) / (hole + 2);
          const dy = (wy + 0.5 - fy0) / ((hole + 2) / 2);
          if (dx * dx + dy * dy < 1) return null;
        }
        return c;
      });
    });
  }).then(() => ras.destroy());
}

/**
 * THE WINNOWING THROW (round 4, the climax): the tipped sieve flings a crescent SHEET of grain up out of the bowl —
 * 2×1 wheat grains (gold4 / gold3, the crest row white for its first two frames) launched together in a fan, so they
 * rise as one curved sheet; their sideways motion dies (heavy grain) so they rain STRAIGHT back into the bowl. Every
 * fourth grain is light chaff (earth4 / earth3 / gold1, 1 px): it rides the sheet up, then peels off on the air and
 * drifts downwind (`wind`) while the gold falls. `lean` tips the fan a little to one side. The sheet's speed is capped
 * so its crest stays under `top` (screen y). Resolves when the last grain is back / the chaff is gone.
 */
function winnowSheet(
  sc: Phaser.Scene,
  o: XY,
  landY: number,
  lean: number,
  wind: number,
  top: number,
  seed: number,
): Promise<void> {
  const rnd = fxRng(seed);
  const MS = 820;
  const G = 560;
  const rise = Math.max(26, Math.min(64, o.y - top));
  const v0 = Math.sqrt(2 * G * rise);
  type Gr = {
    a: number;
    sp: number;
    chaff: boolean;
    d: number;
    c: number;
    wob: number;
    layer: number;
  };
  const grains: Gr[] = [];
  const N = 144;
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const layer = i % 3;
    grains.push({
      a: (u - 0.5) * 2.1 + lean + (rnd() - 0.5) * 0.07,
      sp: v0 * (1 - layer * 0.1 - rnd() * 0.04),
      chaff: i % 4 === 1,
      d: layer * 0.012 + rnd() * 0.01,
      c: layer === 0 ? PAL.gold4 : rnd() < 0.5 ? PAL.gold3 : PAL.gold4,
      wob: rnd() * TAU,
      layer,
    });
  }
  const bx = R(o.x) - 120;
  const by = R(o.y) - R(rise) - 12;
  const ras = new Raster(sc, bx, by, 240, R(landY - by) + 16, D_AIR + 0.4);
  let f = 0;
  return run(sc, MS, (t, _el, dt) => {
    if (dt > 0) f++;
    // (+35 ms: the sheet is already leaving the rim on the hit-stop's held frame)
    const tau = (t * MS) / 1000 + 0.035;
    ras.begin();
    // the SHEET itself: while the front layer's grains are still close together they are one continuous crescent band
    // (a lit gold4 top row over a gold3 row; white for its first two frames) — it tears into single grains as it spreads
    for (const L of [1, 0]) {
      let prev: XY | null = null;
      for (const g of grains) {
        if (g.chaff || g.layer !== L) continue;
        const tg = tau - g.d;
        const vx = Math.sin(g.a) * g.sp;
        const vy = -Math.cos(g.a) * g.sp;
        const p: XY | null =
          tg <= 0
            ? null
            : {
                x: R(o.x + (vx * (1 - Math.exp(-2.6 * tg))) / 2.6),
                y: R(o.y + vy * tg + 0.5 * G * tg * tg),
              };
        if (p && vy + G * tg > 0 && p.y > landY) {
          prev = null;
          continue;
        }
        if (p && prev && Math.abs(p.x - prev.x) + Math.abs(p.y - prev.y) <= 7) {
          // the front layer: a lit top row over a gold3 row; the layer under it: a gold3 / gold2 band (the sheet's body)
          const top = L === 0 ? (f <= 2 ? PAL.white : PAL.gold4) : PAL.gold3;
          const low = L === 0 ? (f <= 2 ? PAL.gold4 : PAL.gold3) : PAL.gold2;
          ras.pc.line(
            prev.x - ras.x,
            prev.y - ras.y,
            p.x - ras.x,
            p.y - ras.y,
            top,
          );
          ras.pc.line(
            prev.x - ras.x,
            prev.y - ras.y + 1,
            p.x - ras.x,
            p.y - ras.y + 1,
            low,
          );
        }
        prev = p;
      }
    }
    for (const g of grains) {
      const tg = tau - g.d;
      if (tg <= 0) continue;
      const vx = Math.sin(g.a) * g.sp;
      const vy = -Math.cos(g.a) * g.sp;
      if (!g.chaff) {
        // heavy grain: its sideways speed dies away (it falls straight back), gravity pulls it home
        const x = o.x + (vx * (1 - Math.exp(-2.6 * tg))) / 2.6;
        const y = o.y + vy * tg + 0.5 * G * tg * tg;
        if (vy + G * tg > 0 && y > landY) continue;
        const crest = Math.abs(g.a - lean) < 0.75 && g.sp > v0 * 0.95;
        const c = f <= 2 && crest ? PAL.white : g.c;
        ras.px(R(x), R(y), c);
        ras.px(
          R(x) + 1,
          R(y),
          c === PAL.gold4 ? PAL.gold3 : c === PAL.white ? PAL.gold4 : PAL.gold2,
        );
      } else {
        // chaff: up with the sheet for 0.14 s, then peeled off on the air — slow fall, drifting downwind, fluttering
        const t1 = Math.min(tg, 0.14);
        let x = o.x + vx * t1 * 0.8;
        let y = o.y + vy * t1 + 0.5 * G * t1 * t1;
        const t2 = tg - t1;
        if (t2 > 0) {
          x += wind * (90 * t2 + 40 * t2 * t2) + Math.sin(t2 * 14 + g.wob) * 2;
          y += (vy + G * t1) * 0.25 * t2 + 22 * t2 * t2;
        }
        if (tg > 0.72) continue;
        ras.px(
          R(x),
          R(y),
          tg > 0.5 ? PAL.gold1 : tg > 0.3 ? PAL.earth3 : PAL.earth4,
        );
      }
    }
    ras.end();
  }).then(() => ras.destroy());
}

/** A column of wheat falling into the bowl from above (2–3 px wide, stepped, grains streaming). */
function pourColumn(
  sc: Phaser.Scene,
  sv: Sieve,
  ms: number,
  seed: number,
): Promise<void> {
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
      grains.add({
        x: m.x + side,
        y: m.y,
        vx: side * (10 + rnd() * 30),
        vy: -(20 + rnd() * 40),
        ay: 480,
        life: 140 + rnd() * 90,
        colors: [PAL.gold4, PAL.gold3, PAL.gold2],
        shape: "px",
        fadeAt: 1,
      });
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
function paintCardAt(
  p: PixelCanvas,
  src: PixelCanvas,
  w: number,
  h: number,
  fh: number,
  rim: number | null,
  recolor?: (c: number, x: number, y: number) => number | null,
): void {
  const hh = Math.max(2, R(h * fh));
  const x0 = Math.floor((p.w - w) / 2);
  const y0 = Math.floor((p.h - hh) / 2);
  for (let y = 0; y < hh; y++)
    for (let x = 0; x < w; x++) {
      const sx = Math.min(src.w - 1, Math.floor(((x + 0.5) / w) * src.w));
      const sy = Math.min(src.h - 1, Math.floor(((y + 0.5) / hh) * src.h));
      let c = src.get(sx, sy) ?? PAL.night1;
      if (
        rim !== null &&
        w < 16 &&
        (x === 0 || y === 0 || x === w - 1 || y === hh - 1)
      )
        c = rim;
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
function tossCard(
  sc: Phaser.Scene,
  from: XY,
  handoff: XY,
  player: PlayerId,
  up: number,
  ms: number,
  seed: number,
  big = false,
): Promise<XY> {
  const BOX = 40;
  const ras = new Raster(
    sc,
    from.x - BOX / 2,
    from.y - BOX / 2,
    BOX,
    BOX,
    DEPTH.FX_TOP + 12,
  );
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
      return {
        x: from.x + (apex.x - from.x) * u,
        y: from.y + (apex.y - from.y) * e,
      };
    }
    const e = (t - HOP) / (1 - HOP);
    return {
      x:
        (1 - e) * (1 - e) * apex.x +
        2 * (1 - e) * e * ctrl.x +
        e * e * handoff.x,
      y:
        (1 - e) * (1 - e) * apex.y +
        2 * (1 - e) * e * ctrl.y +
        e * e * handoff.y,
    };
  };
  let last = from;
  let f = 0;
  return run(sc, ms, (t, _el, dt) => {
    const pos = at(t);
    // round 4: it leaves at 12×17 and is 16×23 by its apex (readable as a card), then grows on toward the hand
    const size = Math.min(HANDOFF_SIZE, 1 + Math.floor(t * 4.2));
    // two full end-over-end turns, landing face-flat at 62 % — the last two sizes are seen flat (no sliver → card pop)
    // (round 4: face-flat through the hop so it reads as a card leaping out of the sieve; it tumbles on the way down)
    const fh =
      t < HOP || t >= 0.62
        ? 1
        : TUMBLE[Math.floor(((t - HOP) / (0.62 - HOP)) * 12) % TUMBLE.length];
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
      trail.add({
        x: R(pos.x + bx * rr),
        y: R(pos.y + by * rr),
        life: big ? 140 : 50,
        colors: big ? [PAL.white, PAL.gold4, PAL.gold3] : [PAL.gold4],
        shape: "px",
        fadeAt: 1,
      });
      trail.add({
        x: R(pos.x + bx * (rr + 3) + by * 2),
        y: R(pos.y + by * (rr + 3) - bx * 2),
        life: big ? 120 : 50,
        colors: [PAL.gold3, PAL.gold2],
        shape: "px",
        fadeAt: 1,
      });
      if (big)
        trail.add({
          x: R(pos.x + bx * (rr + 3) - by * 2),
          y: R(pos.y + by * (rr + 3) + bx * 2),
          life: 110,
          colors: [PAL.gold4, PAL.gold3, PAL.gold2],
          shape: "px",
          fadeAt: 1,
        });
      if (f % (big ? 2 : 3) === 0)
        trail.add({
          x: R(pos.x + bx * rr),
          y: R(pos.y + by * rr),
          vx: (rnd() - 0.5) * 20,
          vy: 10 + rnd() * 20,
          ay: 300,
          life: 220 + rnd() * 120,
          colors: [PAL.gold4, PAL.gold3, PAL.gold2],
          shape: big && f % 4 === 0 ? "sq" : "px",
          size: 2,
          fadeAt: 1,
        });
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
  const thick = (d: readonly [number, number]): readonly [number, number] =>
    d[0] === 0 ? [1, 0] : [0, 1];
  const total = len + 4;
  let x =
    Math.floor(STALK_BOX / 2) -
    Math.round((d0[0] * len * 2) / 3 + (d1[0] * total) / 6);
  let y =
    Math.floor(STALK_BOX / 2) -
    Math.round((d0[1] * len * 2) / 3 + (d1[1] * total) / 6);
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
/** A stalk's flight, as a fraction of the gust (it leaves at its delay and lands FLIGHT later). */
const FLIGHT = 0.64;

function gustStraw(
  sc: Phaser.Scene,
  stalks: Stalk[],
  to: XY,
  ms: number,
  onLand: (k: number) => void,
  seed: number,
): Promise<void> {
  const rnd = fxRng(seed);
  const xs = [...stalks.map((s) => s.x), to.x];
  const ys = [...stalks.map((s) => s.y), to.y];
  const bx0 = Math.floor(Math.min(...xs)) - 50;
  const by0 = Math.floor(Math.min(...ys)) - 70;
  const bx1 = Math.ceil(Math.max(...xs)) + 50;
  const by1 = Math.ceil(Math.max(...ys)) + 24;
  const ras = new Raster(sc, bx0, by0, bx1 - bx0, by1 - by0, DEPTH.FX_TOP + 6);
  const cloud = new PxSparks(sc, DEPTH.FX_TOP + 5);
  const from: XY = {
    x: stalks.reduce((a, s) => a + s.x, 0) / stalks.length,
    y: stalks.reduce((a, s) => a + s.y, 0) / stalks.length,
  };
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
        const w =
          k < rb.len * 0.3
            ? rb.w
            : k < rb.len * 0.7
              ? Math.max(1, rb.w - 1)
              : 1;
        for (let r = 0; r < w; r++) {
          const c =
            r === 0
              ? k < rb.len * 0.5
                ? PAL.white
                : PAL.mist
              : r === w - 1 && w > 2
                ? PAL.steel
                : PAL.mist;
          ras.px(x, y + r, c);
        }
      }
    }
    // ---- the stalks: hand-drawn straw sprites at 45° steps, riding the curve with a wobble
    stalks.forEach((s, i) => {
      const u = Math.max(0, Math.min(1, (t - s.delay) / FLIGHT));
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
      ras.pc.blit(
        stalkSprite(dir, s.bend, s.len),
        x - ras.x - STALK_BOX / 2,
        y - ras.y - STALK_BOX / 2,
      );
      // chaff shed from it, thinning along the path
      if (dt > 0 && u > 0 && f % 2 === i % 2 && rnd() < 0.55 * (1 - u))
        cloud.add({
          x,
          y,
          vx: (rnd() - 0.5) * 16,
          vy: (rnd() - 0.5) * 10 + 4,
          drag: 2,
          life: 240 + rnd() * 200,
          colors: [PAL.gold4, PAL.gold3, PAL.gold2, PAL.earth3],
          shape: rnd() < 0.25 ? "sq" : "px",
          size: 2,
          fadeAt: 1,
        });
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
 * The sieve's floor point (round 4): ONE placement rule — the sieve is drawn over every unit and plate (SIEVE_DEPTH),
 * so it must stand where no unit is IN FRONT of it (a nearer unit would otherwise be painted over, or, sorted with the
 * units, cover the bowl). Candidates run along the caster's back row and, for P2 (whose back row lies behind its own
 * monster row), forward over its monster row and onto the bridge; each is scored on the live board:
 *   - a unit standing nearer the camera (home y ≥ floor y) whose body crosses the bowl: heavy cost,
 *   - its stat plate crossing the bowl: cost (a plate in front would be painted over),
 *   - a unit behind the sieve under the bowl: a small cost (covering it is correct depth, but less is better),
 *   - the bowl's top over the screen's top band (y < 22): cost,
 *   - distance from the middle of the caster's back row (and rows away from the owner's side).
 * P1's back row is the front of the board, so P1 almost always gets its middle back tile (units and plates behind it
 * are covered by it, as they should be); P2 slides along / forward until its bowl is clear.
 */
function sieveSpot(ctx: Pick<ActCtx, "views">, player: PlayerId): XY {
  const home = zoneCell(player, "spellTrap", 2);
  const fwd = player === 0 ? -1 : 1;
  const pref = isoToScreen(home.col, home.row);
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const units: { y: number; body: Box; plate: Box | null }[] = [];
  for (const u of ctx.views.field.units()) {
    if (!u.visible || !u.sprite.visible) continue;
    const b = u.sprite.getBounds();
    const body = { x0: b.x + 4, y0: b.y + 4, x1: b.right - 4, y1: b.bottom };
    const pi = u.badge.image;
    const pb = pi.visible ? pi.getBounds() : null;
    units.push({
      y: u.home.y,
      body,
      plate: pb ? { x0: pb.x, y0: pb.y, x1: pb.right, y1: pb.bottom } : null,
    });
  }
  const area = (a: Box, b: Box): number =>
    Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
    Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const offs = [0, -0.5, 0.5, -1, 1, -1.5, 1.5];
  const rows = player === 0 ? [0] : [0, 0.5, 1.5, 2];
  let best: XY = { x: R(pref.x), y: R(pref.y) };
  let bestScore = Infinity;
  for (const dr of rows)
    for (const dc of offs) {
      const p = isoToScreen(home.col + dc, home.row + dr * fwd);
      const F = { x: R(p.x), y: R(p.y) };
      // the bowl at its working height, with room for the flick (+6) and the shake (±6)
      const bowl: Box = {
        x0: F.x - RX - 8,
        y0: F.y - H_WORK - MY - 2,
        x1: F.x + RX + 8,
        y1: F.y - H_WORK + RY + 4,
      };
      let sc = Math.hypot(F.x - pref.x, F.y - pref.y) * 0.6 + dr * 18;
      for (const u of units) {
        const front = u.y >= F.y - 2;
        const a = area(u.body, bowl);
        if (front) {
          if (a > 0) sc += 400 + a;
          if (u.plate && area(u.plate, bowl) > 0) sc += 200;
        } else sc += a * 0.02;
      }
      if (bowl.y0 < 22) sc += (22 - bowl.y0) * 8;
      if (sc < bestScore) {
        bestScore = sc;
        best = F;
      }
    }
  return best;
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

/** The shadow's rx at the working height (the climax floor ring runs out around it). */
const SHADOW_RX = Math.round(RX * 0.75 * (1 - H_WORK / 160));

/** One shake stroke's sound, on the frame the sieve reaches side `dir`, panned to that rim's x (mirrors with P2). */
function strokeAt(
  rig: Sieve,
  dir: number,
  volume: number,
  pitch: number,
): void {
  playV3("e_sieveStroke", {
    volume,
    pitch: pitch * (dir > 0 ? 1.03 : 0.97),
    pan: panAt(rig.floor.x + dir * RX),
  });
}

function sfxAt(pan: number) {
  return (
    name: SfxName,
    o: { volume?: number; pitch?: number; pan?: number } = {},
  ) =>
    playV3(name, {
      volume: o.volume ?? 0.9,
      pitch: o.pitch,
      pan: o.pan ?? pan,
    });
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
      sfx("e_sieveIdle", { volume: 0.32, pan: w.pan + side * 0.15 });
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
  /** a fibre comes to rest on the floor at this y */
  floor: number;
}

/**
 * Unravel the sieve and clear the light (end of the discard, or a dismissal). Round 2: the woven object comes APART —
 * first the last grain drains through the mesh as a short golden curtain, then the hoop opens from the back, both
 * sides, one arc per step: each arc PEELS OFF as a bent strand that tumbles away downwind after the straw; the mesh
 * rows go from the front back, each falling as a row of short loose fibres. No mask wipe. The loose pieces finish
 * their flight on their own after the sieve is gone.
 */
async function unravel(
  sc: Phaser.Scene,
  rig: Sieve,
  pool: LightHandle,
  pan: number,
  ms: number,
  windDir: number,
): Promise<void> {
  const S = rig.s;
  const sfx = sfxAt(pan);
  sfx("e_sieveEnd", { volume: 0.85 });
  rig.motes = false;
  // round 4: the warm pool steps down in whole quarter steps (no dithered fade), then goes
  bg(
    (async () => {
      for (const k of [0.75, 0.5, 0.25]) {
        await wait(sc, ms / 4);
        pool.setIntensity(k, 0);
      }
      await wait(sc, ms / 4);
      pool.destroy();
    })(),
  );
  const rnd = fxRng(rig.floor.x * 3 + rig.floor.y);
  const m0 = rig.mesh();
  const FLY = 300;
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
    const tdir =
      Math.round(
        (Math.atan2(RY * Math.sin(a), side * RX * Math.cos(a)) / TAU) * 8 + 8,
      ) % 8;
    loose.push({
      x,
      y,
      vx: windDir * (110 + rnd() * 80) + side * 10,
      vy: -(34 + rnd() * 34),
      ay: 90,
      strand: true,
      dir: tdir,
      spin: windDir * (3 + Math.floor(rnd() * 4)),
      bend: rnd() < 0.5 ? 1 : -1,
      len: 9 + Math.floor(rnd() * 5),
      t0: clock,
      life: FLY + rnd() * 60,
      floor: Infinity,
    });
  };
  let sieveGone: () => void = () => undefined;
  const gonePromise = new Promise<void>((res) => (sieveGone = res));
  const all = run(sc, ms + FLY + 70, (t, el, dt) => {
    clock = el;
    const u = (t * (ms + FLY + 70)) / ms;
    if (u <= 1) {
      // the heap drains through the mesh first (0–35 %)
      S.heap = Math.max(0, h0 * (1 - Math.ceil(Math.min(1, u / 0.35) * 4) / 4));
      rig.sift = u < 0.4 ? 3 : 0;
      // the hoop opens from the back in STEPS arcs (20–100 %): each opened arc leaves as a strand from both sides
      const k = Math.max(
        0,
        Math.min(
          STEPS,
          Math.floor(((u - 0.2) / 0.8) * STEPS) + (u >= 0.2 ? 1 : 0),
        ),
      );
      while (step < k) {
        step++;
        const a = Math.PI * (1 - (step - 0.5) / STEPS);
        strandAt(a, -1);
        strandAt(a, 1);
        sfx("e_sievePluck", { volume: 0.7, pitch: 1.12 - step * 0.035 });
      }
      S.undo = step / STEPS;
      // the mesh rows: S.undo * 1.4 of the rows are gone from the front — each gone row falls as fibres
      const gone = Math.min(RYI * 2, Math.floor(S.undo * 1.4 * RYI * 2));
      const m = rig.mesh();
      while (meshGone < gone) {
        const ry = RYI - meshGone;
        const half = RXI * Math.sqrt(Math.max(0, 1 - (ry / RYI) * (ry / RYI)));
        for (let i = 0; i < Math.max(1, Math.floor(half / 14)); i++) {
          const x = m.x + (rnd() - 0.5) * 2 * half;
          const y = m.y + ry;
          loose.push({
            x,
            y,
            vx: windDir * (10 + rnd() * 30),
            vy: -(rnd() * 20),
            ay: 280,
            strand: false,
            dir: 0,
            spin: 0,
            bend: 1,
            len: 3 + Math.floor(rnd() * 3),
            t0: clock,
            life: 200 + rnd() * 100,
            floor: rig.floor.y + ry * 0.6 + R((rnd() - 0.5) * 6),
          });
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
      // a fibre that reached the floor lies still there (it stops drifting) until it is gone
      const fall = L.vy * a + 0.5 * L.ay * a * a;
      // the time it lands: y + vy·a + ay·a²/2 = floor
      const dy = L.floor - L.y;
      const land =
        L.floor === Infinity
          ? Infinity
          : (-L.vy + Math.sqrt(Math.max(0, L.vy * L.vy + 2 * L.ay * dy))) /
            L.ay;
      const x = R(L.x + L.vx * Math.min(a, land));
      const y = Math.min(R(L.floor), R(L.y + fall));
      if (L.strand) {
        const dir =
          (((L.dir + Math.floor(((a * 1000) / L.life) * L.spin)) % 8) + 8) % 8;
        ras.pc.blit(
          strandSprite(dir, L.bend, L.len),
          x - ras.x - STALK_BOX / 2,
          y - ras.y - STALK_BOX / 2,
        );
      } else {
        const late = a * 1000 > L.life * 0.7;
        for (let i = 0; i < L.len - (late ? 1 : 0); i++)
          ras.px(
            x + i * windDir,
            y,
            i === 0 ? PAL.earth4 : late ? PAL.earth2 : PAL.earth3,
          );
      }
    }
    ras.end();
    void dt;
  });
  // round 4: the hook waits for the loose strands and fibres too — nothing is left falling once control returns
  await all;
  if (rig.alive()) rig.stop();
  ras.destroy();
  sieveGone();
  await gonePromise;
}

// ================================================================ the activation

registerCardHook(ID, "activate", async (ctx: ActCtx) => {
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
    if (
      e.type === "draw" &&
      e.player === player &&
      !e.initial &&
      !ctx.isConsumed(i) &&
      draws.length < 3
    )
      draws.push(i);
    else if (
      e.type === "toGraveyard" &&
      e.uid === ev.uid &&
      e.from === "resolved"
    )
      gi = i;
    else if (
      e.type === "decision" &&
      e.pending.kind === "discard" &&
      e.pending.player === player
    ) {
      choice = true;
      break;
    } else if (
      e.type === "activate" ||
      e.type === "turnStart" ||
      e.type === "phaseChange" ||
      e.type === "gameOver"
    )
      break;
  }
  const set = setTileOf(ctx);
  const spot = sieveSpot(ctx, player);
  const pan = panAt(spot.x);
  const sfx = sfxAt(pan);
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player,
    from: set ? "set" : "hand",
    zone: ev.zone,
    hold: 220,
    releaseFrom: "bottom",
    setRelease: "flow",
  });
  relax(ctx, 300);
  if (draws.length === 0) {
    await op.close();
    return;
  }
  await op.release(
    { x: spot.x, y: spot.y - H_BORN },
    { path: "arc", lift: 14, ms: 160, size: 2 },
  );

  // ---- LAND + WEAVE
  const rig = makeSieve(sc, spot, player, spot.x * 7 + spot.y * 13 + player);
  const S = rig.s;
  // round 4: the plates of units standing BEHIND the sieve under its footprint (bowl to shadow) are set aside while it
  // stands — the sieve covers them anyway, and a plate peeking out under the floating bowl read as a label on it
  for (const u of ctx.views.field.units()) {
    if (u.home.y >= spot.y - 2 || !u.badge.image.visible) continue;
    const b = u.badge.image.getBounds();
    if (
      b.right > spot.x - RX - 8 &&
      b.x < spot.x + RX + 8 &&
      b.bottom > spot.y - H_WORK - MY - 2 &&
      b.y < spot.y + RY
    ) {
      u.badge.setVisible(false);
      rig.plates.push(u.badge);
    }
  }
  bg(floorRing(sc, spot));
  void lightFlash(sc, spot.x, spot.y - 10, PAL.gold4, 44, 300, {
    floorY: spot.y,
    intensity: 0.9,
  });
  // the warm pool: ONE whole step of light (intensity 1, steady → a flat, quarter-step-exact stamp: no ordered-dither
  // checker on the pads), a ring just wider than the sieve's shadow; it only dithers for the 2–3 frames of its fades
  const pool = lightPool(sc, spot.x, spot.y - 8, {
    color: PAL.gold3,
    spill: null,
    radius: 46,
    floorY: spot.y,
    intensity: 1,
    anim: "steady",
    fadeIn: 90,
  });
  sfx("e_sieveWeave");
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
  sfx("e_sievePour");
  bg(pourColumn(sc, rig, T.pourMs, spot.x + 11));
  bg(
    run(sc, T.pourMs, (t) => {
      S.heap = Math.min(1, Math.ceil(t * 4) / 4);
      // rise to the working height with a 1-px overshoot
      const u = Math.min(1, t / 0.8);
      S.hgt =
        R(H_BORN + (H_WORK + 1 - H_BORN) * (1 - (1 - u) * (1 - u))) -
        (t > 0.9 ? 1 : 0);
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
            // round 4: ONE stroke sound per visual extreme, on the squash frame, panned to the rim it hits
            strokeAt(
              rig,
              Math.sign(SHAKE[i]),
              c === T.cycles - 1 ? 0.85 : 1,
              1 + c * 0.015,
            );
          } else S.squash = 0;
        }
        const g = Math.min(1, (c + t) / (T.cycles - 1));
        // only as many cards work their way up as will be drawn (the middle one first, then left, right); a card
        // already tossed stays gone
        const up = (j: number) => Math.min(1, Math.max(0, g * 1.25 - j * 0.12));
        const want = [
          draws.length > 1 ? up(1) : 0,
          up(0),
          draws.length > 2 ? up(2) : 0,
        ];
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
  const scroll = (p: XY): XY => ({
    x: R(p.x - (cam.zoom === 1 ? cam.scrollX : 0)),
    y: R(p.y - (cam.zoom === 1 ? cam.scrollY : 0)),
  });
  const worldOf = (p: XY): XY => ({
    x: R(p.x + (cam.zoom === 1 ? cam.scrollX : 0)),
    y: R(p.y + (cam.zoom === 1 ? cam.scrollY : 0)),
  });
  const pile = ctx.views.field.pile(player, "deck");
  const spray = new PxSparks(sc, D_AIR + 0.8);
  const rnd = fxRng(spot.y * 17 + 5);
  const flights: Promise<void>[] = [];
  const handOffs: Promise<void>[] = [];
  const order = [1, 0, 2]; // the middle card first, then the left, then the right
  /** The throw's side: the winnower tips the sieve toward its own hand side (P1 right, P2 left). */
  const lean = player === 0 ? 1 : -1;
  for (let k = 0; k < draws.length; k++) {
    await at(T.toss[k]);
    const d = evAt(ctx, draws[k], "draw");
    if (!d) continue;
    ctx.consumeAt(draws[k]);
    const big = k === 2;
    // anticipation: the sieve dips …
    const dip = big ? 5 : 3;
    const dms = big ? T.bigDipMs : T.dipMs;
    await run(sc, dms, (t) => {
      S.dy = -R(dip * Math.sin((t * Math.PI) / 2));
      if (big) {
        S.squash = t > 0.5 ? 2 : 1;
        // the winnower tips the sieve back before the throw
        S.tilt = R(2 * Math.sin((t * Math.PI) / 2)) * lean;
      }
    });
    el += dms;
    // … and flicks up: the card leaves
    S.dy = big ? 6 : 4;
    S.squash = 0;
    // (round 4: the climax rim flashes gold, not white — the white belongs to the sheet's crest)
    S.rimFlash = 2;
    const slot = order[k];
    tossed[slot] = true;
    S.cards[slot] = 0;
    sfx(big ? "e_sieveTossBig" : "e_sieveToss", {
      pitch: big ? 0.92 : 1 + k * 0.04,
      volume: 1,
    });
    pile.set(Math.max(0, pile.count - 1), null);
    pile.bump();
    const c = rig.crest();
    const from = { x: c.x + CARD_SPOTS[slot][0], y: c.y - 4 };
    void lightFlash(
      sc,
      from.x,
      from.y,
      PAL.gold4,
      big ? 56 : 30,
      big ? 380 : 220,
      { floorY: spot.y, intensity: big ? 1 : 0.75 },
    );
    if (big) {
      // round 4: the climax is a real WINNOWING THROW — the tipped sieve flings a crescent sheet of grain up, the chaff
      // peels off downwind while the heavy grain rains straight back (no white rings); one gold ring runs out on the
      // floor AROUND the shadow (clipped to the board)
      const m = rig.mesh();
      bg(
        winnowSheet(
          sc,
          { x: m.x, y: m.y - 4 },
          m.y - 2,
          -lean * 0.18,
          player === 0 ? 1 : -1,
          18,
          spot.x * 5 + 9,
        ),
      );
      bg(floorRing(sc, spot, 420, SHADOW_RX + 4, 64, SHADOW_RX));
    }
    // the golden burst out of the grain (falls back into the bowl): 2-px crest grains among 1-px ones (the climax keeps a
    // small one under its sheet). Its rise is capped so it stays under the top band (P2's sieve is near the wall).
    const n = big ? 26 : 40 + k * 8;
    const maxV = Math.sqrt(2 * 520 * Math.max(30, from.y - 22));
    for (let i = 0; i < n; i++) {
      const vy = Math.max(
        -maxV,
        big ? -(110 + rnd() * 90) : -(90 + rnd() * (100 + k * 50)),
      );
      const life = Math.min(big ? 900 : 760, (-2 * vy * 1000) / 520 + 30);
      const two = rnd() < (big ? 0.42 : 0.3);
      spray.add({
        x: from.x + R((rnd() - 0.5) * (big ? 22 : 14)),
        y: from.y + 2,
        vx: (rnd() - 0.5) * (big ? 120 : 60 + k * 30),
        vy,
        ay: 520,
        life,
        colors: two
          ? [PAL.white, PAL.gold4, PAL.gold3]
          : [PAL.gold4, PAL.gold3, PAL.gold3, PAL.gold2],
        shape: two ? "sq" : "px",
        size: 2,
        fadeAt: 1,
      });
    }
    rig.spill(-1, big ? 7 : 2);
    rig.spill(1, big ? 7 : 2);
    if (big) await hitStop(sc, T.bigStop);
    const slotXY = worldOf(
      hand.owner === player ? hand.nextSlotXY() : hand.miniXY(player),
    );
    // the hand-over point: just over the slot (a short, last glide into the fan is the hand's own)
    const handoff: XY =
      hand.owner === player
        ? { x: slotXY.x + (player === 0 ? -14 : 14), y: slotXY.y - 40 }
        : { x: slotXY.x, y: slotXY.y + (slotXY.y < 180 ? 30 : -30) };
    const up = big ? 50 : 40 + k * 4;
    const dist = Math.hypot(handoff.x - from.x, handoff.y - from.y);
    const fms = R(T.flightBase + dist * T.flightPerPx) + (big ? 40 : 0);
    // the flick, then (the climax) a 3-px recoil below rest before it comes back
    if (big)
      bg(
        run(sc, 200, (t) => {
          S.dy =
            t < 0.35
              ? R(6 * (1 - t / 0.35))
              : R(-3 * Math.sin(((t - 0.35) / 0.65) * Math.PI));
          // tipped forward on the throw (−3 px), then rocking back level
          S.tilt = (t < 0.3 ? -3 : t < 0.6 ? -2 : t < 0.85 ? -1 : 0) * lean;
        }).then(() => {
          S.dy = 0;
          S.tilt = 0;
        }),
      );
    else
      bg(
        run(sc, T.flickMs, (t) => (S.dy = R(4 * (1 - t)))).then(
          () => (S.dy = 0),
        ),
      );
    handOffs.push(
      tossCard(sc, from, handoff, player, up, fms, d.uid * 3 + k, big).then(
        (p) => {
          flights.push(
            hand
              .addCard(d.uid as Uid, d.cardId, scroll(p), player)
              .catch(() => undefined),
          );
          // the hand's own glide into the fan takes 360 ms (HandView.addCard): the catch ticks as it lands
          bg(
            wait(sc, 330).then(() =>
              playV3("e_sieveCatch", {
                volume: 0.8,
                pitch: 1 + k * 0.06,
                pan: panAt(p.x),
              }),
            ),
          );
        },
      ),
    );
  }
  await shaking;
  sfx("e_sieveFall", { volume: 0.9 });
  spray.release();
  rig.sift = 0;
  // the spent spell card: born on the floor just outside the sieve on its graveyard side (never over the bowl, which
  // is depth-sorted with the units now) as the last card leaves, off to the graveyard
  const g = evAt(ctx, gi, "toGraveyard");
  let send: Promise<void> = Promise.resolve();
  if (g && !ctx.isConsumed(gi)) {
    ctx.consumeAt(gi);
    send = cardLeaves(ctx, {
      owner: g.owner,
      cardId: g.cardId,
      from: { x: spot.x + (player === 0 ? RX + 12 : -RX - 12), y: spot.y + 6 },
      delay: 60,
    });
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
  sfx("e_sieveSettle", { volume: 0.8 });
  const h0 = S.hgt;
  await run(sc, T.settleMs, (t) => {
    const e = t * t * (3 - 2 * t);
    S.hgt = R(h0 + (H_WAIT - 1 - h0) * e) + (t > 0.85 ? 1 : 0);
    S.heap = 1 - Math.floor(e * 2) * 0.1;
  });
  S.hgt = H_WAIT;
  rig.motes = true;
  const w: Waiting = {
    player,
    rig,
    pool,
    pan,
    stopIdle: () => undefined,
    taken: false,
  };
  w.stopIdle = idle(sc, w);
  WAITING.set(player, w);
  await Promise.all(handOffs);
  await Promise.race([Promise.all(flights), wait(sc, 200)]);
  await send;
});

// ================================================================ the discard into the sieve

type DiscardEv = Extract<GameEvent, { type: "discard" }>;
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
    const remaining = ctx.state.players[ev.player].hand
      .filter((u) => !gone.has(u))
      .map((u) => ({ uid: u, cardId: ctx.state.cards[u].cardId }));
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

/** The resting card's canvas (round 4: 20 × 28 + its outline, so the card → straw change reads at 1×). */
const REST_W = 20;
const REST_H = 28;
const REST_SINK = 9;

registerEvent(
  "discard",
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
    const own = (uid: Uid) =>
      ctx.findType("toGraveyard", (e) => e.uid === uid && e.from === "hand");
    const g0 = own(first.uid);
    if (g0 >= 0) ctx.consumeAt(g0);
    for (let i = ctx.index + 1; i < ctx.events.length; i++) {
      const e = ctx.events[i];
      if (ctx.isConsumed(i)) continue;
      if (e.type === "discard" && e.player === first.player) {
        group.push(e);
        ctx.consumeAt(i);
        const gi = own(e.uid);
        if (gi >= 0) ctx.consumeAt(gi);
        continue;
      }
      if (e.type === "toGraveyard" && e.from === "hand") continue;
      break;
    }
    const owner = ctx.owner(first.uid);
    const grave = ctx.views.field.pile(owner, "graveyard");
    const gTop = grave.topXY();
    const windDir = gTop.x >= rig.floor.x ? 1 : -1;

    // ---- DROP: the cards fall from the hand into the sieve (it rises to meet them), shrinking through native sizes
    //      from the hand card's own size down to the resting size, then they sit half sunk IN the grain
    const h0 = S.hgt;
    bg(
      run(
        sc,
        T.dropMs,
        (t) => (S.hgt = R(h0 + (H_CATCH - h0) * Math.sin((t * Math.PI) / 2))),
      ),
    );
    const gone = new Set<Uid>();
    const BOX = 56;
    const n = group.length;
    const restDx = (k: number) => (n > 1 ? (k === 0 ? -12 : 13) : 0);
    const cards = group.map((ev, k) => {
      const from = takeFromHand(ctx, ev, gone);
      const ras = new Raster(
        sc,
        from.x - BOX / 2,
        from.y - BOX / 2,
        BOX,
        76,
        DEPTH.FX_TOP + 12,
      );
      return {
        ev,
        from,
        ras,
        face: cardFaceCanvas(ev.cardId),
        pc: new PixelCanvas(BOX, 76),
        k,
        rest: null as Resting | null,
      };
    });
    const restCanvas = (face: PixelCanvas, step: number): PixelCanvas => {
      const pc = new PixelCanvas(REST_W + 2, REST_H + 2);
      paintCardAt(
        pc,
        face,
        REST_W,
        REST_H,
        1,
        null,
        step < 0 ? undefined : (col, px) => strawOf(col, px, step),
      );
      return pc;
    };
    const drops = cards.map((c) =>
      wait(sc, c.k * T.dropGap).then(() => {
        sfx("e_sieveDrop", { pitch: 1 + c.k * 0.05 });
        return run(sc, T.dropMs - 40, (t) => {
          const m = rig.mesh();
          const to = { x: m.x + restDx(c.k), y: m.y - 8 };
          const k = 1 - (1 - t) * (1 - t);
          const x = c.from.x + (to.x - c.from.x) * t;
          const y =
            c.from.y + (to.y - c.from.y) * k - Math.sin(t * Math.PI) * 30;
          // from the hand's size (48 × 68) down to the resting size (20 × 28), whole native steps
          const size = Math.max(
            3,
            SIZES.length - 1 - Math.floor(t * (SIZES.length - 3)),
          );
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
          c.rest = {
            pc: restCanvas(c.face, -1),
            dx: restDx(c.k),
            foot: MY + 6,
            sink: REST_SINK,
          };
          S.rest.push(c.rest);
          const m = rig.mesh();
          const sp = new PxSparks(sc, D_AIR + 0.8);
          const rnd = fxRng(c.ev.uid * 7);
          for (let i = 0; i < 12; i++)
            sp.add({
              x: m.x + restDx(c.k) + R((rnd() - 0.5) * 16),
              y: m.y + 2,
              vx: (rnd() - 0.5) * 50,
              vy: -(40 + rnd() * 50),
              ay: 480,
              life: 200 + rnd() * 100,
              colors: [PAL.gold4, PAL.gold3, PAL.gold2],
              shape: rnd() < 0.3 ? "sq" : "px",
              size: 2,
              fadeAt: 1,
            });
          sp.release();
        });
      }),
    );
    await Promise.all(drops);

    // ---- JOLT: one hard shake cycle, the cards sink a step deeper
    let lastI = -1;
    await run(sc, T.cycleMs, (t) => {
      const i = Math.min(SHAKE.length - 1, Math.floor(t * SHAKE.length));
      S.sx = SHAKE[i];
      S.slosh = -R(SHAKE[(i + SHAKE.length - 3) % SHAKE.length] * 0.9);
      if (i !== lastI) {
        lastI = i;
        S.squash = Math.abs(SHAKE[i]) === 6 ? 2 : 0;
        if (Math.abs(SHAKE[i]) === 6) {
          rig.spill(Math.sign(SHAKE[i]), 3);
          strokeAt(rig, Math.sign(SHAKE[i]), 1, 0.94);
        }
      }
      for (const c of cards)
        if (c.rest) c.rest.sink = REST_SINK + (t > 0.5 ? 2 : 1);
    });
    S.sx = 0;
    S.slosh = 0;
    S.squash = 0;

    // ---- STRAW: the faces dry to straw, split into stalks, break apart
    await wait(sc, T.strawWait);
    sfx("e_sieveStraw", { volume: 1 });
    for (const c of cards) {
      const m = rig.mesh();
      void lightFlash(sc, m.x + restDx(c.k), m.y - 10, PAL.gold4, 24, 220, {
        floorY: rig.floor.y,
        intensity: 0.7,
      });
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
          x: x0 - 8 + R(j * 3.2),
          y: m0.y - 14 + R((rnd() - 0.5) * 12),
          len: 7 + Math.floor(rnd() * 3),
          dir: windDir > 0 ? [7, 0, 1, 6][j % 4] : [3, 4, 5, 2][j % 4],
          spin: windDir * (4 + Math.floor(rnd() * 6)),
          bend: rnd() < 0.5 ? 1 : -1,
          // round 4: the second card's straw leaves ≥ 0.16 of the gust later, so each pile landing is its own beat
          delay: c.k * 0.18 + j * 0.025 + rnd() * 0.02,
          wob: rnd() * TAU,
        });
        owners.push(c.k);
      }
    }

    // ---- GUST: the winnowing breath sweeps the straw into the graveyard (its sound pans along with it)
    const gp = panAt(gTop.x);
    sfxAt((w.pan + gp) / 2)(windDir > 0 ? "e_sieveGustR" : "e_sieveGustL", {
      volume: 1,
    });
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
        grave.set(
          landingCount(grave.count, ctx.after.players[owner].graveyard.length),
          c.ev.cardId,
        );
        grave.bump();
        sfxAt(gp)("e_sieveGrave", { pitch: 1 + landedCards * 0.05 });
        void lightFlash(sc, gTop.x, gTop.y - 4, PAL.gold3, 24, 260, {
          intensity: 0.6,
        });
      },
      first.uid * 5,
    );
    // the gust also lifts loose chaff off the heap
    const sp = new PxSparks(sc, D_AIR + 1);
    for (let i = 0; i < 22; i++)
      sp.add({
        x: m0.x + R((rnd() - 0.5) * 50),
        y: m0.y - 6,
        vx: windDir * (40 + rnd() * 80),
        vy: -(20 + rnd() * 40),
        ay: 30,
        drag: 1,
        delay: rnd() * 140,
        life: 340 + rnd() * 260,
        colors: [PAL.gold4, PAL.gold3, PAL.earth3],
        shape: "px",
        fadeAt: 1,
      });
    sp.release();
    await wait(sc, T.unravelAfter);
    // ---- UNRAVEL
    const end = unravel(sc, rig, w.pool, w.pan, T.unravelMs, windDir);
    await gustP;
    await end;
  },
  { name: "e:winnow_sieve:discard", priority: 2 },
);

// ================================================================ dismissal: the choice never came

registerObserver((ev, ctx) => {
  if (!WAITING.size) return;
  if (
    ev.type === "discard" ||
    ev.type === "toGraveyard" ||
    ev.type === "decision" ||
    ev.type === "draw"
  )
    return;
  for (const [p, w] of [...WAITING]) {
    WAITING.delete(p);
    w.taken = true;
    w.stopIdle();
    if (!w.rig.alive()) continue;
    bg(
      unravel(
        ctx.scene,
        w.rig,
        w.pool,
        w.pan,
        SIEVE_T.unravelMs,
        p === 0 ? -1 : 1,
      ),
    );
  }
});
