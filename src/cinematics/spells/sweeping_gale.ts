// Süpürge Rüzgarı (sweeping_gale) — v3 presentation (docs/v3/YENI_KARTLAR.md §7 S4; lane E). The v1 look keeps the
// generic activation and the batch-2 placeholder massDestroy (src/cinematics/b2/placeholders.ts): every hook below
// steps aside without ?look=v3.
//
// "Yeşil-beyaz dev bir süpürge darbesi rüzgarı rakibin arka sırasını uçtan uca süpürür → kartlar havalanır, döner →
//  platform kenarından boşluğa düşer → alan büyüsü ortamı mum gibi söner."
//
// BEAT LIST (scene ms; ×1.35 in game time with the v3 tempo). The activation hook:
//   0      common v3 spell opening (spells/_kit): the card leaves the hand for its owner's side (or a set card stands
//          up on its tile), "SÜPÜRGE RÜZGARI" plate, a short hover. THE AIR STIRS round it: seven 3×3 leaves circle
//          the hovering card on visible wind arcs, faster and closer (anticipation) — e_galeStir
//   ~320   release (hold 170 ms): a spinning leaf-green CURL (~15 px: two 2-px spiral arms round a white core, a
//          four-step leaf trail) leaves the card's top edge and lobs (230 ms) onto the END TILE of the OPPONENT's back
//          row — e_galeLob ("fwip"); the spent card drops to its graveyard behind it
// The massDestroy (registerLaneE, this file) — ONE gale for every per-card event of the wipe:
//   +0     THE WHIRL: a little tornado stands up on that tile ring by ring (seven stepped wind rings stacked into a
//          ~30-px funnel, 2-px front arcs with white leading tips, speed streaks, a white eye column, six leaves
//          orbiting, a dust ring turning on the tile, a green light pool) — e_galeWhirl. THE FIELD SPELL's
//          ENVIRONMENT shows itself as a candle-like flame of its own colour (~13 × 30 px) standing on its card
//          (tidal: water, cavern: void, festival: gold, volcano: fire) on a 4-frame loop, and pours its light over
//          the opponent's whole half (a tinted pool)
//   +100   the doomed cards RATTLE in their slots (1-px hops, faster as the wind nears) — e_galeRattle
//   +300   THE BROOM STROKE (the head runs the path in 700 ms): the whirl leans downwind and unwinds into a giant
//          crescent of wind — 13 bristles (a white leading edge, leaf4 / teal4 / leaf3 bodies, broken leaf2 tails
//          converging like a broom's bristles) sweeps the whole back row end to end (L → R when player 1 casts;
//          mirrored for player 2) and leaves over the side rim — e_galeSweep (rhythmic push-drag straw strokes).
//          The victim's monsters lean 1 px downwind for a few frames as the front passes them
//   each card, as the front reaches it: it tears off its slot (one white frame, a paper SNAP — e_galeSnap), lifts
//          and TUMBLES (a real 3-D roll about the wind's axis + a yaw); a face-down card shows its FACE as it turns
//          over (one white frame — e_galeGlimpse); its shadow shrinks on the floor. EVERY card leaves over a VISIBLE
//          rim: on player 2's (far) side the wind carries it LOW along its row to the right-hand rim; on player 1's
//          side it is thrown over its own front-left rim; at the edge it drops past the wall into the VOID: it
//          recedes — its mip shrinks in steps (1 → ¾ → ½), its tones step down (stone, then night), a thin falling
//          streak above it — and it is cut off at the platform's lower lip (never reaching the hall floor) — the
//          receding whistle, e_galeFall, each card's a step lower (a descending pentatonic run), its bend synced to
//          the shrink. A far-row card flies one band IN FRONT of its row's monsters while it is in the air (and the
//          blade's leading edge too: the bristles stay behind them)
//   THE FIELD (its own clock, see fieldTimes): the flame leans as the front nears, is stretched and buffeted while
//          the bristles pass, then gutters in three steps (150 ms) while the light over the half dims in three
//          steps (one re-flare) — a real volcano arena's LAVA gutters with it in its own overlay (the board's crack
//          pixels: fire3 → crim1, a re-flare, patches going out) — and is SNUFFED like a candle: the light is CUT,
//          the room's light layer drops for a breath (the theme changes inside it, then it comes back), a puff,
//          a wick ember, a smoke thread —
//          e_galeSnuff ("vump"). 100 ms later the LAST GUST (three bristle curls with leaves racing through the
//          field zone) tears the field card off and blows it over the rim
//   +~760  the stroke leaves over the far rim, its bristles thin out. THE TAIL (e_galeTail) answers the LAST falling
//          card: its whistle echoes back from the void (that card's pitch and pan), the last leaves tick down
//   each fallen card is delivered to its owner's graveyard AS SOON AS it is gone: a little gust of four leaves
//          streaks from where it vanished to the pile (e_galeCarry), drops a mini card silhouette on it, the pile
//          counts up and bumps (and the HUD's graveyard counter with it) — e_galePile. The carrier leaves while the
//          card is still receding. The snuffed wick's smoke finishes on its own after the scene.
// The spent hand card comes apart into the wind (a white frame, it dissolves, its leaves carried to its pile): it
// never slides over the duelist's dais. Each card's tear-off also fires a bristle "ksh" (e_galeBristle).
// THE RESPONSE WINDOW (a ready Büyü Mührü): the activation batch has no massDestroy. The card does NOT dissolve: a
// hand card keeps hovering beside its owner, a set card lies back down face-up on its own tile, while a few leaves
// keep circling it (a kept handle, 'gale:wait'). Declined → the next batch's gale releases its curl FROM THAT CARD
// and sends the card to its graveyard; sealed → after the trap's own presentation the gale dies on the card (the
// leaves wither and drop, the card sags — e_galeDie), FALLS off its hover in four stepped frames (upright, 20°, 60°,
// flat), lands with a 1-px bounce (e_galeSlump) and fades out where it lies; its graveyard counts it then.
// Measured (game time, tempo 1.35; tools/measure.mjs, camera 0f/0px; round 4): eGale 4.60 s, eGaleP2 4.75, eGaleSet
// 3.93, eGaleSetP2 4.08, eGaleOne 2.97, eGaleVolcano 4.87 / eGaleWindow 5.38 (both batches of the window), eGaleAxe 5.53
// (with spite_axe's own toDeck presentation after the gale), eGaleSealed 5.13 (the seal's cut-in included). The
// side effects (spite_axe back to its deck, soul_leash's monster going home, a field spell's stat changes) are NOT
// presented here: their events stay unconsumed and play in order after the gale (their own presentations). A card
// whose destination is not the graveyard (spite_axe → deck) RESISTS the gale: it rattles, jumps 3 px and slams back
// down; its own toDeck presentation takes it from there.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { FLAT_H, FLAT_W, ISO_CX, ISO_CY, ISO_TEX_H, ISO_TEX_W, cardIsoKey, cardMip, poseAxes, qAxis, qMul, renderCard, restQuat, type Quat } from '../../art/cards';
import { G1, GR1, SLAB_T } from '../../still/arena-geom';
import { SLAB_RECT, buildCrackField } from '../../art/arena';
import { BOARD_MID_COL, CARD_H, DEPTH, LOOK_V3, type XY, isoToScreen, screenToIso, unitDepth, zoneCell, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import { CardSprite } from '../../view/CardSprite';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { wait } from '../../vfx/core';
import { lightDimFor } from '../../view/light';
import { fxRng } from '../_v3/spellfx';
import { panAt, play as playV3 } from '../_v3/sound';
import { cardLeaves, landingCount } from '../_v3/card';
import { fx, registerCardHook } from '../api';
import type { CinematicContext } from '../_core/types';
import { registerLaneE, type LaneECtx } from '../b2e/dispatch';
import { bg, castFloor, castSpot, lightPool, relax, setTileOf, spellOpening, type ActCtx, type LightHandle, type Opening } from './_kit';

const R = Math.round;
const ID: CardId = 'sweeping_gale';
type MassCtx = LaneECtx<'massDestroy'>;
type AnyCtx = CinematicContext<GameEvent>;
type G = readonly [number, number];
/** The kept handle of a gale waiting for the opponent's answer (a spell_seal window). */
const KEEP = 'gale:wait';
/** The curl's colours (birth → death). */
const LEAF_FX = [PAL.white, PAL.leaf4, PAL.leaf3, PAL.leaf2, PAL.leaf1] as const;

// ================================================================ timings (scene ms from the massDestroy)

const T = {
  whirlMs: 280,
  rattle: 100,
  stroke: 300,
  /** the head's run over the whole path (incl. the run-out past the exit) */
  strokeMs: 700,
  /** a card's whole flight (lift → gone in the void) */
  fly: 760,
  /** the field flame: the lean starts this long before the head reaches the field */
  leanLead: 220,
  /** after the stroke's tail clears the field zone: three gutter steps, then OUT */
  gutter: 150,
  smokeMs: 760,
  /** the curl's lob from the card to the whirl */
  lobMs: 230,
  /** a fallen card's leaves carried to its pile; the mini card's drop on it */
  carryMs: 300,
  dropMs: 110,
  /** the field card tears off this long after its flame is snuffed */
  fieldAfter: 100,
  /** a fallen card's carrier leaves this long after the previous one (overlapped, not queued) */
  carryGap: 50,
  /** after the last delivery */
  settle: 60,
} as const;

/** The fall into the void, ms after a card crosses the rim. */
const FALL = {
  /** the mip shrinks to ¾, then to ½ */
  shrink1: 70,
  shrink2: 140,
  /** the tones step down: stone, then night */
  tone1: 90,
  tone2: 170,
  /** the falling streak above it */
  streak: 50,
  /** its leaves set off for the pile */
  carry: 110,
  /** gone for good (if the lip has not swallowed it yet) */
  gone: 260,
} as const;
/** px under the slab's top rim where a falling card vanishes (the slab face + the first hull tier's lip). */
const LIP = SLAB_T + 8;

// ================================================================ easing + small helpers

const c01 = (t: number) => Math.min(1, Math.max(0, t));
const ease = {
  out: (t: number) => 1 - Math.pow(1 - c01(t), 3),
  in: (t: number) => Math.pow(c01(t), 2),
  inOut: (t: number) => 0.5 - Math.cos(Math.PI * c01(t)) / 2,
  smooth: (t: number) => c01(t) * c01(t) * (3 - 2 * c01(t)),
};
const seg = (el: number, a: number, ms: number) => c01((el - a) / ms);
/** Quantise t to n steps (stepped, pixel-art motion). */
const q = (t: number, n: number) => Math.floor(c01(t) * n) / n;
const qbez = (a: XY, c: XY, b: XY, t: number): XY => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y,
});
/** Run fn every rendered frame until it returns false. */
function loop(sc: Phaser.Scene, fn: (el: number, dt: number) => boolean): Promise<void> {
  return new Promise((resolve) => {
    onFrame(sc, (dt, el) => {
      const go = fn(el, dt);
      if (!go) resolve();
      return go;
    });
  });
}

// ================================================================ geometry (victim-local frame)
//
// Everything is authored for player 2 as the victim (their back row is grid row 0, their field zone (6, 1)); player
// 1's board is the same rotated 180° (zoneCell): (c, r) → (6 − c, 4 − r). The slab (the calm arena after the
// readability pass, measured on screen) reaches 0.8 tile past the outer zones on every side; the duelists' daises
// stand behind it.

const COLS = 7;
const ROWS = 5;
const SLAB = { c0: -0.8, c1: COLS - 0.2, r0: -0.8, r1: ROWS - 0.2 };
/** The stroke's path (victim-local grid, P2 victim): from the whirl just off the slab's far corner (below the
 * duelist billboards), along the back row, round the field zone and out over the side rim (plus a short run-out
 * that stays low: never up into the HUD billboards). */
const PATH_LOCAL: readonly G[] = [
  [0.0, 0.02],
  [0.6, 0.0],
  [1.0, -0.04],
  [3.0, 0.0],
  [4.8, 0.05],
  [5.7, 0.35],
  [6.3, 0.8],
  [7.1, 0.75],
  [7.9, 0.45],
];

function toWorld(v: PlayerId, g: G): G {
  return v === 1 ? g : [COLS - 1 - g[0], ROWS - 1 - g[1]];
}
function dirWorld(v: PlayerId, d: G): G {
  return v === 1 ? d : [-d[0], -d[1]];
}
function toLocal(v: PlayerId, g: G): G {
  return v === 1 ? g : [COLS - 1 - g[0], ROWS - 1 - g[1]];
}
function scr(g: G, z = 0): XY {
  const p = isoToScreen(g[0], g[1]);
  return { x: p.x, y: p.y - z };
}
/** The platform's lower lip under the rim a victim's cards go over (screen x → y): player 2's cards ride to the
 * right-hand column rim, player 1's are thrown over their own front row rim. */
function lipLine(v: PlayerId): (x: number) => number {
  const a = v === 1 ? isoToScreen(G1, 0) : isoToScreen(0, GR1);
  const b = v === 1 ? isoToScreen(G1, 1) : isoToScreen(1, GR1);
  const k = (b.y - a.y) / (b.x - a.x);
  return (x: number) => a.y + (x - a.x) * k + LIP;
}
function insideSlab(g: { col: number; row: number }): boolean {
  return g.col > SLAB.c0 && g.col < SLAB.c1 && g.row > SLAB.r0 && g.row < SLAB.r1;
}

/** A sampled, arc-length (screen px) parameterised polyline through Catmull-Rom control points. */
class Path {
  readonly pts: G[] = [];
  readonly len: number[] = [];
  readonly total: number;
  constructor(ctrl: readonly G[]) {
    const n = ctrl.length;
    const at = (i: number) => ctrl[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      for (let k = 0; k < 24; k++) {
        const t = k / 24;
        const t2 = t * t;
        const t3 = t2 * t;
        const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        this.pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    this.pts.push(ctrl[n - 1]);
    let acc = 0;
    this.len.push(0);
    for (let i = 1; i < this.pts.length; i++) {
      const a = scr(this.pts[i - 1]);
      const b = scr(this.pts[i]);
      acc += Math.hypot(b.x - a.x, b.y - a.y);
      this.len.push(acc);
    }
    this.total = acc;
  }
  /** Grid point at arc length s (clamped; linear beyond the ends). */
  at(s: number): G {
    const L = this.len;
    if (s <= 0) return this.pts[0];
    if (s >= this.total) return this.pts[this.pts.length - 1];
    let lo = 0;
    let hi = L.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (L[m] <= s) lo = m;
      else hi = m;
    }
    const k = (s - L[lo]) / Math.max(1e-6, L[hi] - L[lo]);
    const a = this.pts[lo];
    const b = this.pts[hi];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  }
  /** Unit tangent (grid) at s. */
  tan(s: number): G {
    const a = this.at(s - 3);
    const b = this.at(s + 3);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  }
  /** Arc length of the sample nearest to grid point g. */
  nearest(g: G): number {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < this.pts.length; i++) {
      const d = Math.hypot(this.pts[i][0] - g[0], this.pts[i][1] - g[1]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return this.len[best];
  }
}

/** Head position (arc length) at scene time el. Starts fast out of the whirl (release), eases a little at the end. */
function headAt(path: Path, el: number): number {
  const u = (el - T.stroke) / T.strokeMs;
  if (u <= 0) return 0;
  return path.total * (1 - Math.pow(1 - c01(u), 1.45));
}
/** Scene time the head reaches arc length s. */
function timeAt(path: Path, s: number): number {
  const k = c01(s / path.total);
  const u = 1 - Math.pow(1 - k, 1 / 1.45);
  return T.stroke + u * T.strokeMs;
}


// ================================================================ leaves (3×3, turning) for the stir, the idle and the carriers

// '#' lit, 'a' shade
const LEAF3: readonly (readonly string[])[] = [
  ['.##', '##a', 'a..'],
  ['##.', '#a#', '..a'],
  ['a..', '#a#', '.##'],
  ['.#.', '#a#', '.a.'],
];
function leaf3(r: Raster, x: number, y: number, frame: number, lit: number = PAL.leaf4): void {
  const shade = lit === PAL.leaf4 ? PAL.leaf3 : lit === PAL.leaf3 ? PAL.leaf2 : PAL.leaf1;
  const f = LEAF3[((frame % 4) + 4) % 4];
  f.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && r.px(x + rx - 1, y + ry - 1, ch === '#' ? lit : shade)));
}

// ================================================================ the field environment

/** The light ramp of a field spell's environment (its flame). */
function envRamp(id: CardId | null): readonly number[] {
  switch (id) {
    case 'tidal_bay':
      return RAMPS.water;
    case 'shadow_cavern':
      return RAMPS.void;
    case 'festival_square':
      return RAMPS.gold;
    case 'volcano_arena':
      return RAMPS.fire;
    default:
      return RAMPS.teal;
  }
}


interface Flame {
  at: XY;
  ramp: readonly number[];
  /** 0..1 how tall it stands (appear / gutter) */
  h: number;
  /** horizontal lean at the tip (px, + = right) */
  lean: number;
  /** width factor */
  w: number;
  /** 1 = a calm candle (its own flicker loop), 0 = in the wind */
  calm: number;
  /** px of the wind's buffet at the tip (alternating frames) */
  flap: number;
  out: boolean;
  /** ms since out (puff, ember, smoke) */
  since: number;
  /** wind sign on screen (smoke drift) */
  wind: number;
}

/** A candle-like flame (no outline: it is light), stepped widths, a white core near its base. */
function drawFlame(r: Raster, f: Flame, el: number): void {
  const { at, ramp } = f;
  if (!f.out && f.h > 0.05) {
    // the candle's own 4-frame loop: the tip sways, the body pulses in width and height
    const fr = Math.floor(el / 80) % 4;
    const sway = [0, 1, 0, -1][fr] * f.calm;
    const wp = 1 + [0, -0.14, 0.1, -0.06][fr] * f.calm;
    const hp = 1 + [0, 0.07, -0.07, 0.03][fr] * f.calm;
    const buffet = (Math.floor(el / 45) % 2 ? 1 : -1) * f.flap;
    const H = Math.max(3, R(32 * f.h * hp));
    for (let k = 0; k <= H; k++) {
      const u = k / H;
      // teardrop: widest a third up, a pointed tip
      const shape = Math.sin(Math.PI * Math.min(1, 0.18 + u * 0.95)) * Math.pow(1 - u, 0.35);
      const hw = Math.max(0, Math.floor(6.5 * f.w * wp * shape));
      const xo = R(f.lean * u * u + sway * Math.max(0, u - 0.4) * 3.4 + buffet * u * u);
      const y = at.y - 3 - k;
      for (let dx = -hw - 1; dx <= hw + 1; dx++) {
        const a = Math.abs(dx);
        let c: number;
        if (a > hw) c = ramp[1];
        else if (a === hw) c = ramp[2];
        else if (a >= hw * 0.5 || u > 0.7) c = ramp[3];
        else c = u < 0.32 ? PAL.white : ramp[4];
        if (a > hw && (u > 0.85 || hw === 0)) continue;
        r.px(at.x + xo + dx, y, c);
      }
    }
    // the base glow on the card (a stepped ellipse of light)
    const gw = R(9 * Math.max(0.5, f.h));
    for (let dx = -gw; dx <= gw; dx++) r.px(at.x + dx, at.y - 2, Math.abs(dx) < 4 ? ramp[3] : ramp[2]);
    for (let dx = -gw + 3; dx <= gw - 3; dx++) r.px(at.x + dx, at.y - 1, ramp[2]);
  }
  if (f.out) {
    const s = f.since;
    // the puff: the flame's last breath, a little grey ring opening round the wick (3 frames)
    if (s < 100) {
      const rr = 2 + Math.floor(s / 34) * 2;
      for (let a = 0; a < 12; a++) {
        if ((a + Math.floor(s / 34)) % 3 === 0) continue;
        const an = (a / 12) * Math.PI * 2;
        r.px(R(at.x + Math.cos(an) * rr), R(at.y - 6 + Math.sin(an) * rr * 0.6), s < 50 ? PAL.stone4 : PAL.stone3);
      }
    }
    // the wick ember: blinks twice, then dies
    if (s < 280 && Math.floor(s / 70) % 2 === 0) {
      r.px(at.x, at.y - 3, s < 140 ? ramp[4] : ramp[3]);
      r.px(at.x, at.y - 2, ramp[2]);
    }
    // the smoke thread: 2 px at its base, curls up and drifts downwind; it detaches from the wick and thins
    if (s < T.smokeMs) {
      const L = Math.min(54, R(s / 6.5));
      const lift = s > 340 ? R((s - 340) / 16) : 0;
      const cut = s > 420 ? R((s - 420) / 13) : 0;
      let prev: XY | null = null;
      for (let k = cut; k <= L; k++) {
        const y = at.y - 4 - k - lift;
        const x = at.x + R(Math.sin(k * 0.3 - s / 130) * Math.min(3, k * 0.16) + f.wind * k * k * 0.01);
        const c = k - cut < 10 ? PAL.stone4 : k > L - 8 ? PAL.stone2 : PAL.stone3;
        if (prev) r.line(prev.x, prev.y, x, y, c);
        else r.px(x, y, c);
        if (k - cut < 14 && s < 560) r.px(x + 1, y, k - cut < 7 ? PAL.mist : PAL.stone3);
        prev = { x, y };
      }
    }
  }
}

/**
 * The field's clock (scene ms): the head reaches the zone at `tField`; the stroke's last bristles clear it at
 * `tClear` (sampled from the same broom the stroke draws); OUT lands T.gutter after that.
 */
function fieldTimes(path: Path, sField: number): { tField: number; tClear: number; tOut: number } {
  const tField = timeAt(path, sField);
  let tClear = T.stroke + T.strokeMs * 1.12;
  for (let el = tField; el < T.stroke + T.strokeMs * 1.12; el += 10) {
    const fade = seg(el, T.stroke + T.strokeMs * 0.8, T.strokeMs * 0.32);
    if (fade >= 0.95) {
      tClear = el;
      break;
    }
    const born = seg(el, T.stroke - 20, 110);
    const sHead = headAt(path, el);
    let rear = Infinity;
    for (const [o, , len0] of BRISTLES) {
      const len = len0 * (0.3 + 0.7 * born) * (1 - fade) * (fade > 0.6 ? 0.35 : 1);
      rear = Math.min(rear, sHead - (LEAD * o * o + 10) - len);
    }
    if (rear > sField + 14) {
      tClear = el;
      break;
    }
  }
  return { tField, tClear, tOut: Math.round(tClear + T.gutter) };
}

// ================================================================ leaves, paper, motes

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  age: number;
  life: number;
  ph: number;
  kind: 'leaf' | 'paper' | 'mote';
  c: number;
  /** spiral down onto a point (pile delivery) */
  to: XY | null;
  x0: number;
  y0: number;
}

// leaf frames (a turning leaf): '#' lit, 'a' shade
const LEAF: readonly (readonly string[])[] = [['.#', '#a'], ['#a#'], ['#.', 'a#'], ['#', 'a']];

class Bits {
  private bs: Bit[] = [];
  add(b: Partial<Bit> & { x: number; y: number; life: number; kind: Bit['kind'] }): void {
    this.bs.push({ vx: 0, vy: 0, g: 0, age: 0, ph: 0, c: PAL.leaf3, to: null, x0: b.x, y0: b.y, ...b });
  }
  step(dt: number): void {
    const s = dt / 1000;
    for (const b of this.bs) {
      b.age += dt;
      if (b.to) {
        // a falling spiral onto the pile
        const t = ease.inOut(b.age / b.life);
        const a = b.ph + t * Math.PI * 3;
        const rad = (1 - t) * 10;
        b.x = b.x0 + (b.to.x - b.x0) * t + Math.cos(a) * rad;
        b.y = b.y0 + (b.to.y - b.y0) * t + Math.sin(a) * rad * 0.5;
      } else {
        b.vy += b.g * s;
        b.vx *= 1 - Math.min(0.9, 1.2 * s);
        b.x += b.vx * s;
        b.y += b.vy * s;
      }
    }
    this.bs = this.bs.filter((b) => b.age < b.life);
  }
  draw(r: Raster): void {
    for (const b of this.bs) {
      const x = R(b.x);
      const y = R(b.y);
      if (b.kind === 'leaf') {
        const f = LEAF[(Math.floor(b.age / 70 + b.ph * 3) % 4 + 4) % 4];
        const lit = b.c;
        const shade = b.c === PAL.leaf4 ? PAL.leaf3 : b.c === PAL.leaf3 ? PAL.leaf2 : PAL.leaf1;
        f.forEach((row, ry) => [...row].forEach((ch, rx) => ch !== '.' && r.px(x + rx, y + ry, ch === '#' ? lit : shade)));
      } else if (b.kind === 'paper') {
        const flip = Math.floor(b.age / 50 + b.ph * 4) % 3;
        r.px(x, y, flip === 0 ? PAL.white : PAL.mist);
        if (flip !== 2) r.px(x + 1, y, flip === 0 ? PAL.mist : PAL.stone4);
      } else {
        r.px(x, y, b.age / b.life > 0.6 ? PAL.leaf2 : b.c);
      }
    }
  }
}


// ================================================================ a flying card (the iso card renderer, tumbling)

const FC = 72;
let flySeq = 0;
/** The receding card's two tone steps (by luminance: ink, shade, body, light): stone first, then the night. */
const RECEDE1 = [PAL.ink, PAL.night2, PAL.stone2, PAL.stone4] as const;
const RECEDE2 = [PAL.ink, PAL.night0, PAL.night1, PAL.night3] as const;

class FlyCard {
  readonly img: Phaser.GameObjects.Image;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly pc = new PixelCanvas(FC, FC);
  private readonly key: string;
  constructor(
    private readonly sc: Phaser.Scene,
    private readonly cardId: CardId,
    private readonly player: PlayerId,
  ) {
    this.key = `gale:fly:${++flySeq}`;
    this.tex = sc.textures.createCanvas(this.key, FC, FC)!;
    this.img = sc.add.image(0, 0, this.key).setOrigin(0, 0);
  }
  /**
   * Draw the card at screen centre c with pose q. Returns whether its FRONT faces the camera.
   * mask: hide the pixels that fall on the platform's top (the card is below the rim, behind a back edge).
   */
  /** Opaque pixels left after the last draw's masks (0: the card has vanished under the lip). */
  shown = 0;
  draw(
    c: XY,
    qq: Quat,
    o: { light?: number; tint?: number; tintAmt?: number; mask?: boolean; depth: number; scale?: number; recede?: 0 | 1 | 2; lip?: ((x: number) => number) | null },
  ): boolean {
    const pc = this.pc;
    pc.clear();
    const sc = o.scale ?? 1;
    const { ex, ey, n } = poseAxes(qq, FLAT_W * sc, FLAT_H * sc);
    renderCard(pc, FC / 2, FC / 2, ex, ey, n, cardMip(this.cardId, this.player), cardMip('back', this.player), {
      light: o.light ?? 0,
      tint: o.tint,
      tintAmt: o.tintAmt,
    });
    const ox = R(c.x) - FC / 2;
    const oy = R(c.y) - FC / 2;
    if (o.mask) {
      for (let y = 0; y < FC; y++)
        for (let x = 0; x < FC; x++) {
          if (!pc.isOpaque(x, y)) continue;
          if (insideSlab(screenToIso(ox + x + 0.5, oy + y + 0.5))) pc.erase(x, y);
        }
    }
    // the fall into the void: below the platform's lower lip the card is gone (it drops out of sight under the
    // slab's first hull tier), and it recedes into the dark in two flat tone steps (palette remap by luminance)
    const lip = o.lip ?? null;
    const ramp = o.recede === 1 ? RECEDE1 : o.recede === 2 ? RECEDE2 : null;
    let shown = 0;
    if (lip || ramp) {
      const d = pc.data;
      for (let x = 0; x < FC; x++) {
        const ly = lip ? lip(ox + x) - oy : Infinity;
        for (let y = 0; y < FC; y++) {
          if (!pc.isOpaque(x, y)) continue;
          if (y >= ly) {
            pc.erase(x, y);
            continue;
          }
          shown++;
          if (!ramp) continue;
          const i = (y * FC + x) * 4;
          const L = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          const col = ramp[L < 40 ? 0 : L < 95 ? 1 : L < 160 ? 2 : 3];
          d[i] = (col >> 16) & 255;
          d[i + 1] = (col >> 8) & 255;
          d[i + 2] = col & 255;
        }
      }
    } else shown = 1;
    this.shown = shown;
    this.tex.context.putImageData(new ImageData(pc.data as Uint8ClampedArray<ArrayBuffer>, FC, FC), 0, 0);
    this.tex.refresh();
    this.img.setPosition(ox, oy).setDepth(o.depth).setVisible(true);
    return ex[0] * ey[1] - ey[0] * ex[1] >= 0;
  }
  hide(): void {
    this.img.setVisible(false);
  }
  destroy(): void {
    this.img.destroy();
    if (this.sc.textures.exists(this.key)) this.sc.textures.remove(this.key);
  }
}


// ================================================================ the swept cards

interface Swept {
  uid: Uid;
  cardId: CardId;
  owner: PlayerId;
  victim: PlayerId;
  kind: 'spellTrap' | 'field';
  zone: number;
  tile: TileCard | null;
  faceDown: boolean;
  /** false: its destination is not the graveyard (spite_axe → deck): it resists and stays on its tile */
  flies: boolean;
  home: G;
  /** arc length on the stroke path where the front reaches it, and the time it lifts */
  s: number;
  t0: number;
  along: G;
  out: G;
  /** how far (grid) to the edge along `out`, and whether that edge is a back edge (the slab hides the fall) */
  edge: number;
  back: boolean;
  /** it rides the wind along its row to the side rim (the victim's back row when that row is the far one) */
  ride: boolean;
  spin: number;
  yaw: number;
  fc: FlyCard | null;
  lifted: boolean;
  sawFace: boolean;
  fell: boolean;
  /** its leaves have set off for the pile */
  sent: boolean;
  /** screen y of the platform's lower lip under the rim it goes over (at screen x) */
  lip: (x: number) => number;
  gone: boolean;
  tileY: number;
}

interface Collected {
  cards: Swept[];
  /** the field spell's 'inactive' event (played on the snuff frame) */
  fieldIdx: number;
  fieldId: CardId | null;
}

/** Gather the wipe's destroy / toGraveyard events of the gale (side effects stay for the Director). */
function collect(ctx: MassCtx, path: Path, victim: PlayerId): Collected {
  const src = ctx.ev.sourceUid;
  const evs = ctx.events;
  const field = ctx.views.field;
  const cards: Swept[] = [];
  let fieldIdx = -1;
  let fieldId: CardId | null = null;
  for (let i = ctx.index + 1; i < evs.length; i++) {
    const e = evs[i] as GameEvent;
    if (ctx.isConsumed(i)) continue;
    if (e.type === 'toGraveyard' && e.uid === src) break;
    if (e.type === 'destroy' && e.sourceUid === src && (e.location === 'spellTrap' || e.location === 'field')) {
      // its destination: the graveyard (we deliver it) or anything else (it resists: its own presentation)
      let owner: PlayerId = ctx.owner(e.uid);
      let flies = false;
      for (let j = i + 1; j < evs.length && j < i + 4; j++) {
        const f = evs[j];
        if (f.type === 'toGraveyard' && f.uid === e.uid) {
          ctx.consumeAt(j);
          owner = f.owner;
          flies = true;
          break;
        }
        if (f.type === 'toDeck' && f.uid === e.uid) break;
      }
      ctx.consumeAt(i);
      const kind = e.location === 'field' ? 'field' : 'spellTrap';
      const cell = zoneCell(e.player, kind, e.zone);
      const home: G = [cell.col, cell.row];
      const loc = toLocal(victim, home);
      const s = Math.max(0, path.nearest(home) - 6);
      const along = path.tan(s);
      // every card leaves over a VISIBLE rim (a front wall face), never behind the slab: when the victim is
      // player 2 (the far side) the wind carries it along its row to the right-hand rim (cols > 6); when the
      // victim is player 1 it is thrown out over its own front-left rim (rows > 4)
      const ride = victim === 1;
      const out: G = victim === 1 ? [1, 0] : [0, 1];
      const edge = victim === 1 ? SLAB.c1 - home[0] : SLAB.r1 - home[1];
      void loc;
      const back = false;
      const tile = field.tileOf(e.uid);
      cards.push({
        uid: e.uid,
        cardId: e.cardId,
        owner,
        victim: e.player,
        kind,
        zone: e.zone,
        tile,
        faceDown: !!tile && !tile.faceUp,
        flies,
        home,
        s,
        t0: timeAt(path, s),
        along,
        out,
        edge,
        back,
        ride,
        spin: 0,
        yaw: 0,
        fc: null,
        lifted: false,
        sawFace: false,
        fell: false,
        sent: false,
        lip: lipLine(victim),
        gone: false,
        tileY: tile ? tile.y : 0,
      });
      continue;
    }
    if (e.type === 'fieldSpell' && !e.active && cards.some((c) => c.uid === e.uid)) {
      fieldIdx = i;
      fieldId = e.cardId;
      continue;
    }
    // stat changes (an equip / a field spell gone), a spite axe's way home, a leash's release: their own beats
    if (e.type === 'statChange' || e.type === 'toDeck' || e.type === 'toGraveyard' || e.type === 'damage' || e.type === 'controlChange') continue;
    break;
  }
  if (fieldId === null) {
    const f = cards.find((c) => c.kind === 'field');
    if (f) fieldId = f.cardId;
  }
  return { cards, fieldIdx, fieldId };
}

/** How far (grid) along `out` a card has travelled τ ms after its lift. */
function outAt(c: Swept, tau: number): number {
  const oTot = c.edge + 0.6;
  if (c.ride) {
    // it rides the wind: slow off the slot, gathering speed (the further it has to go, the longer it rides)
    const k = c01((tau - 30) / (230 + 80 * c.edge));
    return oTot * (0.3 * k + 0.7 * k * k);
  }
  return oTot * ease.smooth(c01((tau - 30) / 520));
}

/** The flight's edge crossing (τ ms after the lift). */
function edgeTau(c: Swept): number {
  for (let k = 30; k <= 1400; k += 10) if (outAt(c, k) >= c.edge) return k;
  return 9999;
}

/** A card's flight at τ ms after its lift: ground point (grid), height (px), whether it is past the edge. */
function flight(c: Swept, tau: number, tauEdge: number): { g: G; z: number; past: boolean } {
  const A = c.ride ? 0 : 0.95 * ease.out(tau / 600);
  const O = outAt(c, tau);
  // a rider drifts a touch toward its own back edge (it stays clear of the monsters in front of it) and its arc
  // stays LOW (it never climbs over the duelist behind the row)
  const drift = c.ride && c.kind !== 'field' ? -0.18 * ease.out(tau / 320) : 0;
  const g: G = [c.home[0] + c.along[0] * A + c.out[0] * O, c.home[1] + c.along[1] * A + c.out[1] * O + drift];
  const peak = c.kind === 'field' ? 18 : c.ride ? 22 : 26;
  const zAt = (t: number) => (t < 160 ? peak * ease.out(t / 160) : peak + R(Math.sin((t - 160) / 110) * (c.ride ? 2 : 4)));
  const past = tau >= tauEdge;
  let z = zAt(tau);
  if (past) {
    // the drop starts AT the edge: no glide over the rim, straight down past the wall into the void
    const d = (tau - tauEdge) / 1000;
    z = zAt(tauEdge) - 40 * d - 0.5 * 2600 * d * d;
  }
  return { g, z, past };
}

// ================================================================ the activation (opening → curl to the whirl)

registerCardHook(ID, 'activate', async (ctx: ActCtx) => {
  if (!LOOK_V3) return ctx.base();
  const ev = ctx.ev;
  const sc = ctx.scene;
  const mi = ctx.findType('massDestroy', (e) => e.sourceUid === ev.uid);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid && e.from === 'resolved');
  const waits = ctx.findType('decision') >= 0;
  const stir: { p: Promise<void> | null } = { p: null };
  const setTile = setTileOf(ctx);
  const stirAt: XY = setTile ? { x: R(setTile.home.x), y: R(setTile.home.y) - 26 } : castSpot(ev.player);
  const op = await spellOpening(ctx, {
    uid: ev.uid,
    cardId: ev.cardId,
    player: ev.player,
    from: setTile ? 'set' : 'hand',
    zone: ev.zone,
    hold: 170,
    keepCard: true,
    releaseFrom: 'top',
    onHold: (h) => {
      playV3('e_galeStir', { volume: 0.8, pan: panAt(stirAt.x) });
      stir.p = stirLeaves(sc, stirAt, h + 120 + T.lobMs + 120);
    },
  });
  if (mi < 0) {
    if (waits) {
      // the opponent may answer (a ready Büyü Mührü): the card stays, the air keeps stirring round it
      await holdForAnswer(ctx, op, !!setTile);
      if (stir.p) await stir.p;
      return;
    }
    // nothing swept and nothing to wait for (the activation was negated in this batch)
    await op.close();
    relax(ctx);
    await fx.playRun(ctx, fx.resolutionRun(ctx));
    return;
  }
  const mev = ctx.events[mi] as Extract<GameEvent, { type: 'massDestroy' }>;
  const victim: PlayerId = mev.refs[0]?.player ?? (ev.player === 0 ? 1 : 0);
  const start = scr(toWorld(victim, PATH_LOCAL[0]), 14);
  // the common release (its white silhouette and accent) at the card's top edge; the gale's own curl carries on
  const top = { x: op.center.x, y: R(op.center.y - (setTile ? 22 : 34) - 2) };
  await op.release(top, { ms: 1, size: 1, light: false, ramp: LEAF_FX });
  playV3('e_galeLob', { volume: 0.85, pan: panAt(top.x) });
  await lobCurl(sc, top, { x: R(start.x), y: R(start.y) });
  // the spent hand card comes apart into the wind (its own leaves carried to the pile); a set card leaves its tile
  const hand = !setTile && op.card instanceof CardSprite && op.card.active ? op.card : null;
  const spent = wait(sc, 140).then(() => {
    if (hand && gi >= 0 && !ctx.isConsumed(gi)) {
      const g = ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>;
      ctx.consumeAt(gi);
      return spentToLeaves(ctx as unknown as AnyCtx, hand, g.owner);
    }
    return op.leave ? op.leave(gi) : undefined;
  });
  await ctx.play(mi, { galeOpened: true });
  await spent;
  if (stir.p) await stir.p;
  relax(ctx, 300);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

/** Seven leaves circling the hovering card on wind arcs, closer and faster (the air stirs before the gale). */
function stirLeaves(sc: Phaser.Scene, c: XY, ms: number): Promise<void> {
  const ras = Raster.around(sc, c.x, c.y, 130, 110, DEPTH.FX_TOP + 11);
  const N = 7;
  return run(sc, ms, (t, el) => {
    ras.draw((r) => {
      for (let k = 0; k < N; k++) {
        const a0 = (k * Math.PI * 2) / N;
        const spin = (el / 1000) * (4.5 + 6 * t);
        const rad = (46 - 12 * ease.in(t)) * (k % 2 ? 0.88 : 1);
        const at = (da: number) => ({ x: R(c.x + Math.cos(a0 + spin - da) * rad), y: R(c.y + 10 + Math.sin(a0 + spin - da) * rad * 0.5) });
        // the wind arc trailing each leaf (it lengthens as the stir speeds up)
        const arcN = 3 + Math.floor(t * 4);
        for (let j = 1; j <= arcN; j++) {
          const p = at(j * 0.11);
          r.px(p.x, p.y, j <= 1 ? PAL.leaf3 : j <= 3 ? PAL.leaf2 : PAL.leaf1);
        }
        const p = at(0);
        leaf3(r, p.x, p.y, Math.floor(el / 70) + k, k % 3 === 2 ? PAL.leaf3 : PAL.leaf4);
        // a bright tip on the lit leaves (it catches the light as it turns)
        if (k % 3 !== 2 && (Math.floor(el / 70) + k) % 2 === 0) r.px(p.x, p.y - 1, PAL.white);
      }
    });
  }).then(() => ras.destroy());
}

/**
 * The gale's seed: a spinning leaf-green curl (a white core, leaf4 / leaf3 arms, a leaf2 tail) lobs from `from` to
 * `to` on an arc, a leaf trail behind it, a soft green light under it. Resolves on arrival.
 */
function lobCurl(sc: Phaser.Scene, from: XY, to: XY, ms: number = T.lobMs): Promise<void> {
  const ras = new Raster(sc, 0, 0, 640, 360, DEPTH.FX_TOP + 12);
  const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 26 };
  const light = lightPool(sc, from.x, from.y, { color: PAL.leaf4, radius: 16, floorY: from.y + 30, intensity: 0.6, tint: 0, fadeIn: 0 });
  const trail: { x: number; y: number; age: number }[] = [];
  const steps: { x: number; y: number; at: number }[] = [];
  let last = 0;
  return run(sc, ms, (t, el) => {
    const dt = el - last;
    last = el;
    const k = ease.inOut(t);
    const p = qbez(from, ctrl, to, k);
    const x = R(p.x);
    const y = R(p.y);
    light.setPosition(x, y, R(y + 30 - 16 * k));
    for (const tr of trail) tr.age += dt;
    trail.push({ x, y, age: 0 });
    while (trail.length && trail[0].age > 120) trail.shift();
    // a leaf left behind every ~45 ms: a four-step trail of leaves, fading
    if (!steps.length || el - steps[steps.length - 1].at >= 45) steps.push({ x, y, at: el });
    while (steps.length > 5) steps.shift();
    ras.draw((r) => {
      for (const tr of trail) r.px(tr.x, tr.y + 1, tr.age < 40 ? PAL.leaf3 : tr.age < 80 ? PAL.leaf2 : PAL.leaf1);
      const trailCols = [PAL.leaf2, PAL.leaf3, PAL.leaf3, PAL.leaf4];
      steps.slice(0, -1).forEach((st, i, arr) => {
        const age = arr.length - 1 - i;
        leaf3(r, st.x, st.y + 2 + age, Math.floor(el / 60) + i, trailCols[Math.max(0, 3 - age)]);
      });
      // the curl: two spiral arms round a white core (a whirlwind in the making, ~15 px across), 1-px thick,
      // spinning in eighths of a turn
      const a = Math.floor(el / 26) * (Math.PI / 4);
      for (const arm of [0, Math.PI]) {
        let prev: XY | null = null;
        for (let j = 0; j < 10; j++) {
          const an = a + arm + j * 0.6;
          const rr = 2 + j * 0.74;
          const pt = { x: R(x + Math.cos(an) * rr), y: R(y + Math.sin(an) * rr * 0.8) };
          const col = j < 2 ? PAL.white : j < 5 ? PAL.leaf4 : j < 8 ? PAL.leaf3 : PAL.leaf2;
          if (prev) {
            // 2-px arms: a bold little whirlwind, not a speck
            r.line(prev.x, prev.y + 1, pt.x, pt.y + 1, j < 5 ? PAL.leaf3 : PAL.leaf2);
            r.line(prev.x, prev.y, pt.x, pt.y, col);
          }
          prev = pt;
        }
      }
      r.rect(x - 1, y - 1, 3, 3, PAL.white);
      r.px(x + 2, y, PAL.leaf4);
    });
  }).then(() => {
    ras.destroy();
    void light.fadeOut(100);
  });
}

// ================================================================ the response window (spell_seal)

/** The gale waiting for the opponent's answer: its card (hovering, or lying on its tile) and the leaves circling it. */
class GaleWait {
  private stopped = false;
  constructor(
    readonly card: CardSprite | null,
    readonly tile: TileCard | null,
    readonly uid: Uid,
    readonly owner: PlayerId,
    private readonly idle: IdleLeaves,
  ) {}
  /** Where the leaves are now (they fall from there when the gale dies). */
  leaves(): XY[] {
    return this.idle.where();
  }
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.idle.stop();
  }
  /** (Director: a restart / an unanswered end of batch) */
  destroy(): void {
    this.stop();
    if (this.card && this.card.active) this.card.destroy();
  }
}

interface IdleLeaves {
  where(): XY[];
  stop(): void;
}

/**
 * A calm idle while the window is open: four leaves circle the card slowly (a breath of wind that has not died),
 * and a hovering card breathes by one pixel. Stops by itself when its card / tile leaves.
 */
function idleLeaves(sc: Phaser.Scene, c: XY, o: { card?: CardSprite | null; tile?: TileCard | null; rx: number; ry: number }): IdleLeaves {
  const ras = Raster.around(sc, c.x, c.y, o.rx * 2 + 16, o.ry * 2 + 30, o.tile ? DEPTH.FX + 3 : DEPTH.FX_TOP + 11);
  const pts: XY[] = [];
  const y0 = o.card ? R(o.card.y) : 0;
  let dead = false;
  const stop = onFrame(sc, (_dt, el) => {
    const alive = dead ? false : o.card ? o.card.active : o.tile ? o.tile.active : false;
    if (!alive) {
      ras.destroy();
      return false;
    }
    if (o.card) o.card.setY(y0 - (Math.floor(el / 300) % 2));
    pts.length = 0;
    ras.draw((r) => {
      for (let k = 0; k < 4; k++) {
        const a = (el / 1000) * 2.6 + (k * Math.PI) / 2;
        const bob = Math.floor(el / 160 + k) % 2;
        const p = { x: R(c.x + Math.cos(a) * o.rx), y: R(c.y + Math.sin(a) * o.ry) - bob };
        pts.push(p);
        for (let j = 1; j <= 3; j++) {
          const tl = { x: R(c.x + Math.cos(a - 0.13 * j) * o.rx), y: R(c.y + Math.sin(a - 0.13 * j) * o.ry) };
          r.px(tl.x, tl.y + 1, j === 1 ? PAL.leaf3 : PAL.leaf2);
        }
        leaf3(r, p.x, p.y, Math.floor(el / 110) + k, PAL.leaf4);
        if ((Math.floor(el / 110) + k) % 2 === 0) r.px(p.x, p.y - 1, PAL.white);
      }
    });
    return true;
  });
  return {
    where: () => pts.map((p) => ({ ...p })),
    stop: () => {
      if (dead) return;
      dead = true;
      stop();
      ras.destroy();
    },
  };
}

/** The opening ends without a release: the card stays (hovering / lying on its own tile) and is kept for the answer. */
async function holdForAnswer(ctx: ActCtx, op: Opening, set: boolean): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  if (set && op.landV3 && ev.zone !== null) {
    // a set card lies back down face-up on its own tile (that is where the engine keeps it while it waits)
    const tile = await op.landV3({ spot: 'spellTrap', index: ev.zone, lieMs: 160 });
    const c = { x: R(tile.home.x), y: R(tile.home.y) - 6 };
    ctx.keep(KEEP, new GaleWait(null, tile, ev.uid, ev.player, idleLeaves(sc, c, { tile, rx: 30, ry: 13 })));
  } else {
    // a hand card keeps hovering beside its owner: the opening's dressing goes (plate, ring, rim), the card stays
    const card = op.card as CardSprite;
    card.setActive(false);
    await op.close();
    card.setActive(true);
    const c = { x: R(card.x), y: R(card.y) + 4 };
    ctx.keep(KEEP, new GaleWait(card, null, ev.uid, ev.player, idleLeaves(sc, c, { card, rx: 38, ry: 16 })));
  }
  relax(ctx);
}

/** Tint every image of a container (a hovering card) with `color` (multiply: a dimmer tone). */
function tintDeep(o: Phaser.GameObjects.GameObject, color: number): void {
  const t = o as unknown as { setTint?: (c: number) => void; list?: Phaser.GameObjects.GameObject[] };
  if (Array.isArray(t.list)) t.list.forEach((c) => tintDeep(c, color));
  else if (typeof t.setTint === 'function') t.setTint(color);
}

/** The spent waiting card goes to its graveyard (a set card from its tile; a hovering card is spent into leaves). */
async function waitingCardLeaves(ctx: AnyCtx, w: GaleWait, gi: number): Promise<void> {
  const g = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
  const owner = g ? g.owner : w.owner;
  if (w.tile && w.tile.active) {
    ctx.views.field.release(w.uid);
    return cardLeaves(ctx, { owner, cardId: ID, from: { x: R(w.tile.home.x), y: R(w.tile.home.y) }, tile: w.tile });
  }
  const c = w.card;
  if (c && c.active) return spentToLeaves(ctx, c, owner);
}

/**
 * The spent hovering card (its gale has left it) comes apart into the wind: one white frame, it dissolves while its
 * leaves burst off it downwind, and a little gust carries them to its graveyard (the pile counts up there). It never
 * crosses the duelist's dais on the floor.
 */
async function spentToLeaves(ctx: AnyCtx, card: CardSprite, owner: PlayerId): Promise<void> {
  const sc = ctx.scene;
  const at = { x: R(card.x), y: R(card.y) };
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const to0 = pile.topXY();
  const to = { x: R(to0.x), y: R(to0.y) };
  const side = to.x >= at.x ? 1 : -1;
  const ras = new Raster(sc, 0, 0, 640, 360, DEPTH.FX_TOP + 11);
  const bits = new Bits();
  const rng = fxRng(at.x * 3 + at.y);
  for (let k = 0; k < 9; k++)
    bits.add({ kind: k % 4 === 3 ? 'paper' : 'leaf', x: at.x + R((rng() - 0.5) * 30), y: at.y + R((rng() - 0.5) * 44), vx: side * (40 + rng() * 70), vy: -30 - rng() * 40, g: 60, life: 320 + rng() * 160, ph: rng(), c: k % 2 ? PAL.leaf4 : PAL.leaf3 });
  const cr = { from: { x: at.x + side * 6, y: at.y - 4 }, to, t0: 120, ph: rng() * 6 };
  void card.pulse(PAL.white, 90);
  playV3('e_galeCarry', { volume: 0.7, pan: panAt(at.x) });
  const fading = card.dissolve(240).then(() => card.active && card.destroy());
  let last = 0;
  let landed = false;
  await run(sc, cr.t0 + T.carryMs + T.dropMs + 40, (_t, el) => {
    bits.step(el - last);
    last = el;
    if (!landed && el >= cr.t0 + T.carryMs + T.dropMs) {
      landed = true;
      const count = landingCount(pile.count, ctx.after?.players?.[owner]?.graveyard?.length);
      pile.set(count, ID);
      pile.bump();
      ctx.views.hud.setCounts(owner, { grave: count });
      playV3('e_galePile', { volume: 0.7, pan: panAt(to.x) });
    }
    ras.draw((r) => {
      bits.draw(r);
      if (!landed) drawCarrier(r, cr, el);
    });
  });
  ras.destroy();
  await fading;
}

/**
 * Büyü Mührü killed the gale: the dead card FALLS off its hover in four stepped frames (it tips back: upright, 20°,
 * 60°, flat), lands on the floor with a 1-px bounce (the slump), lies there a moment and fades out in two tone steps
 * where it fell — its graveyard counts it then. It never slides over the duelist's dais.
 */
async function dieOnFloor(ctx: AnyCtx, card: CardSprite, owner: PlayerId): Promise<void> {
  const sc = ctx.scene;
  const x = R(card.x);
  const bottom0 = R(card.y) + CARD_H / 2;
  const floorY = castFloor({ x, y: R(card.y) }) - 2;
  // (tilt, how far down the fall): cos of the tilt is the card's foreshortened height
  const frames: readonly (readonly [number, number])[] = [
    [1, 0.25],
    [Math.cos((20 * Math.PI) / 180), 0.55],
    [Math.cos((60 * Math.PI) / 180), 0.85],
  ];
  for (const [sy, p] of frames) {
    if (!card.active) break;
    const bottom = R(bottom0 + (floorY - bottom0) * p);
    card.setScale(1, sy);
    card.setY(R(bottom - (CARD_H * sy) / 2));
    await wait(sc, 34);
  }
  if (card.active) card.destroy();
  // flat on the floor: the card's lying (iso) face, dimmed like the card was
  const img = sc.add
    .image(x, floorY, cardIsoKey(ID, 'up', owner))
    .setOrigin(ISO_CX / ISO_TEX_W, ISO_CY / ISO_TEX_H)
    .setDepth(DEPTH.CARD_ON_TILE + 8)
    .setTint(PAL.stone3);
  playV3('e_galeSlump', { volume: 0.85, pan: panAt(x) });
  const ras = Raster.around(sc, x, floorY, 80, 30, DEPTH.CARD_ON_TILE + 9);
  await run(sc, 380, (_t, el) => {
    if (!img.active) return;
    // the bounce: up a pixel for two frames, then it lies still; a puff of dust either side
    img.setY(floorY - (el >= 30 && el < 64 ? 1 : 0));
    if (el >= 200) img.setTint(el < 290 ? PAL.stone2 : PAL.night3);
    ras.draw((r) => {
      if (el > 150) return;
      const k = Math.floor(el / 50);
      for (const sx of [-1, 1]) {
        r.px(x + sx * (16 + k * 4), floorY + 1 - k, k === 0 ? PAL.stone4 : PAL.stone3);
        r.px(x + sx * (13 + k * 3), floorY + 3 - k, PAL.stone3);
      }
    });
  });
  ras.destroy();
  img.destroy();
  const pile = ctx.views.field.pile(owner, 'graveyard');
  const count = landingCount(pile.count, ctx.after?.players?.[owner]?.graveyard?.length);
  pile.set(count, ID);
  pile.bump();
  ctx.views.hud.setCounts(owner, { grave: count });
}

/** Büyü Mührü answered: the gale dies on its card — the leaves wither and drop, the card sags and goes. */
registerCardHook(ID, 'toGraveyard', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const h = ctx.take(KEEP);
  if (!(h instanceof GaleWait)) {
    if (h) ctx.keep(KEEP, h);
    return ctx.base();
  }
  const sc = ctx.scene;
  if (h.tile) {
    h.stop();
    return ctx.base(); // a set card: its own destroy presentation already took it
  }
  // the seal's cut-in band clears first (it runs on past its own handler): the death reads on a clean board
  await wait(sc, 240);
  h.stop();
  const card = h.card;
  const at = card ? { x: R(card.x), y: R(card.y) } : castSpot(h.owner);
  playV3('e_galeDie', { volume: 0.85, pan: panAt(at.x) });
  const floorY = castFloor(at);
  const ras = Raster.around(sc, at.x, at.y + 20, 140, 130, DEPTH.FX_TOP + 11);
  // the circling leaves STOP where they are, droop (two 1-px sags), then drop to the floor in a sideways flutter
  // and lie there, browning in steps
  const leaves = h.leaves().map((p, i) => ({ x0: p.x, y0: p.y, side: i % 2 ? 1 : -1, delay: 90 + i * 35, lie: floorY - 1 + (i % 3) }));
  const card0 = card && card.active ? { y: R(card.y) } : null;
  let tinted = 0;
  await run(sc, 480, (_t, el) => {
    if (card && card.active && card0) {
      // the card shivers for three frames as the air leaves it, then SAGS 3 px in steps and dims in two tone steps
      card.setX(at.x + (el < 90 ? (Math.floor(el / 30) % 2 ? 1 : -1) : 0));
      card.setY(card0.y + (el < 120 ? 0 : el < 200 ? 1 : el < 280 ? 2 : 3));
      const step = el < 200 ? 0 : el < 340 ? 1 : 2;
      if (step !== tinted) {
        tinted = step;
        tintDeep(card, step === 1 ? PAL.stone4 : PAL.stone3);
      }
    }
    ras.draw((r) => {
      for (const [i, l] of leaves.entries()) {
        const e = el - l.delay;
        let x = l.x0;
        let y = l.y0;
        let fr = i;
        let col: number = PAL.leaf4;
        if (el < 60) {
          // stopped mid-orbit
        } else if (e < 0) {
          y += el < 100 ? 1 : 2; // drooping
          col = PAL.leaf3;
        } else {
          const d = e / 1000;
          const fall = Math.min(l.lie - l.y0, 2 + 0.5 * 900 * d * d + 20 * d);
          y = l.y0 + fall;
          const landed = y >= l.lie;
          x = l.x0 + (landed ? 0 : R(Math.sin(e / 55) * 3 * l.side));
          if (landed) {
            y = l.lie;
            fr = 1;
          } else fr = Math.floor(e / 70) + i;
          col = e < 160 ? PAL.leaf3 : e < 320 ? PAL.leaf2 : PAL.leaf1;
        }
        leaf3(r, R(x), R(y), fr, col);
      }
    });
  });
  ras.destroy();
  const g = ctx.events[ctx.index] as Extract<GameEvent, { type: 'toGraveyard' }>;
  if (card && card.active) await dieOnFloor(ctx as unknown as AnyCtx, card, g?.owner ?? h.owner);
  else await waitingCardLeaves(ctx as unknown as AnyCtx, h, ctx.index);
});

// ================================================================ the wipe

registerLaneE(
  'massDestroy',
  (ctx) => LOOK_V3 && ctx.ev.sourceUid !== null && ctx.cardId(ctx.ev.sourceUid) === ID,
  (ctx) => galeWipe(ctx),
);

/** Bristles of the broom: lateral offset (−1..1 of the band), hover height (px), tail length (px), lag phase. */
const BRISTLES: readonly (readonly [number, number, number, number])[] = [
  [-1.0, 6, 70, 0],
  [-0.82, 13, 96, 2],
  [-0.64, 4, 120, 1],
  [-0.48, 18, 104, 3],
  [-0.32, 9, 150, 0],
  [-0.16, 22, 128, 2],
  [0.0, 12, 170, 1],
  [0.16, 3, 140, 3],
  [0.32, 17, 150, 0],
  [0.48, 8, 112, 2],
  [0.64, 20, 100, 1],
  [0.82, 5, 84, 3],
  [1.0, 14, 66, 0],
];
/** Half width of the band (grid units) at the head. */
const BAND = 0.62;


/** A fallen card's leaves on their way to its pile (delivered as soon as the card is gone). */
interface Carrier {
  c: Swept;
  from: XY;
  to: XY;
  t0: number;
  ph: number;
  landed: boolean;
}

async function galeWipe(ctx: MassCtx): Promise<void> {
  const sc = ctx.scene;
  const field = ctx.views.field;
  const caster = ctx.ev.player;
  const victim: PlayerId = ctx.ev.refs[0]?.player ?? (caster === 0 ? 1 : 0);
  const path = new Path(PATH_LOCAL.map((g) => toWorld(victim, g)));
  const { cards, fieldIdx, fieldId } = collect(ctx, path, victim);
  const rng = fxRng(path.total * 7 + cards.length * 31 + 3);
  cards.forEach((c, i) => {
    c.spin = (11 + rng() * 4) * (i % 2 ? -1 : 1);
    c.yaw = (3 + rng() * 3) * (i % 2 ? 1 : -1);
  });
  const opened = ctx.hints.galeOpened === true;
  const wind = scr(path.at(path.total)).x > scr(path.at(0)).x ? 1 : -1;
  const start = scr(path.at(0), 14);
  const whirlFloor = { x: R(scr(path.at(0)).x), y: R(scr(path.at(0)).y) };

  // ---- a later batch (the spell_seal window was declined): the gale's curl leaves the WAITING card
  if (!opened) {
    const h = ctx.take(KEEP);
    const w = h instanceof GaleWait ? h : null;
    if (h && !w) ctx.keep(KEEP, h);
    w?.stop();
    const src = ctx.ev.sourceUid;
    const gi = ctx.findType('toGraveyard', (e) => e.uid === src);
    let from: XY = castSpot(caster);
    if (w?.card && w.card.active) {
      from = { x: R(w.card.x), y: R(w.card.y) - 36 };
      void w.card.pulse(PAL.white, 140);
    } else if (w?.tile && w.tile.active) {
      from = { x: R(w.tile.home.x), y: R(w.tile.home.y) - 10 };
      w.tile.tileFlash(PAL.leaf3, 220);
    }
    playV3('e_galeLob', { volume: 0.85, pan: panAt(from.x) });
    await lobCurl(sc, from, { x: R(start.x), y: R(start.y) });
    if (w && gi >= 0 && !ctx.isConsumed(gi)) {
      ctx.consumeAt(gi);
      bg(wait(sc, 140).then(() => waitingCardLeaves(ctx as unknown as AnyCtx, w, gi)));
    }
  }

  // ---- depths: the band hovers over the victim's back row (behind their monsters when that row is the far one)
  const monY = zoneXY(victim, 'monster', 0).y;
  const monY2 = zoneXY(victim, 'monster', 4).y;
  const bandDepth = victim === 1 ? unitDepth(Math.min(monY, monY2)) - 0.5 : DEPTH.FX + 2;
  // a lifted far-row card and the blade's leading edge: one band in front of the victim's monsters
  const riderFront = unitDepth(Math.max(monY, monY2)) + 0.5;
  const blade = victim === 1 ? new Raster(sc, 0, 0, 640, 360, riderFront) : null;
  const air = new Raster(sc, 0, 0, 640, 360, bandDepth);
  const top = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.TILE_FX + 2);
  const bits = new Bits();
  const topBits = new Bits();

  // ---- the field environment's flame (drawn above the band: the stroke never hides it)
  const fieldCard = cards.find((c) => c.kind === 'field') ?? null;
  const fieldAt = fieldCard ? zoneXY(victim, 'field', 0) : null;
  const flame: Flame | null = fieldCard && fieldAt ? { at: { x: R(fieldAt.x), y: R(fieldAt.y) }, ramp: envRamp(fieldId), h: 0, lean: 0, w: 1, calm: 1, flap: 0, out: false, since: 0, wind } : null;
  const flameRas = flame ? Raster.around(sc, flame.at.x, flame.at.y - 40, 120, 130, DEPTH.FX + 7) : null;
  const ft = fieldCard ? fieldTimes(path, fieldCard.s) : { tField: 0, tClear: 0, tOut: 0 };
  // the field card is the last to go: it holds (rattling) until its flame is out — the snuff reads first (puff,
  // ember, the smoke rising) — then the last gust takes it
  if (fieldCard) fieldCard.t0 = ft.tOut + T.fieldAfter;
  // a real volcano arena: its lava gutters in our own overlay (the same crack field the board paints)
  const volcano = fieldId === 'volcano_arena' && ctx.views.board.theme === 'volcano';
  const cracks = volcano && flame ? buildCrackField({ col: BOARD_MID_COL, row: 2 }) : null;
  let lavaRas: Raster | null = cracks ? new Raster(sc, SLAB_RECT.x, SLAB_RECT.y, SLAB_RECT.w, SLAB_RECT.h, DEPTH.TILE + 3.5) : null;
  let lavaStep = -1;
  let lavaGone = !cracks;
  let swapped = false;
  let dark: Phaser.GameObjects.Rectangle | null = null;
  let darkT0 = -1;
  let envPool: LightHandle | null = null;
  let envSpill: LightHandle | null = null;
  let fieldJob: Promise<void> | null = null;

  // ---- lights (they brighten the floor: no multiply tint)
  let whirlLight: LightHandle | null = lightPool(sc, start.x, start.y, { color: PAL.leaf3, radius: 36, floorY: whirlFloor.y, air: 0.9, airRadius: 22, intensity: 0, anim: 'breathe', fadeIn: 0, tint: 0.2 });
  whirlLight.setIntensity(1.3, 220);
  let headLight: LightHandle | null = null;

  // ---- one-shot marks
  const fired = new Set<string>();
  const once = (k: string, el: number, at: number, fn: () => void) => {
    if (el >= at && !fired.has(k)) {
      fired.add(k);
      fn();
    }
  };
  const carriers: Carrier[] = [];
  let lastCarry = -Infinity;
  let fallN = 0;
  const tauEdges = new Map<Swept, number>();
  const minEnd = T.stroke + T.strokeMs + 200;
  const flyN = cards.filter((c) => c.flies).length;

  playV3('e_galeWhirl', { volume: 0.9, pan: panAt(start.x) });

  // ---- the victim's monsters sway as the front passes them (a 1-px lean downwind for a few frames)
  const sways = field
    .units()
    .filter((u) => u.player === victim && u.sprite.active && u.sprite.visible && !u.retired)
    .map((u) => {
      const x0 = u.sprite.x;
      let sPass = path.total;
      for (let sv = 0; sv <= path.total; sv += 2)
        if (scr(path.at(sv)).x * wind >= x0 * wind) {
          sPass = sv;
          break;
        }
      return { u, x0, t: timeAt(path, sPass) + 20, done: false };
    });
  let gustT0 = -1;
  const fieldScr = fieldCard ? scr(fieldCard.home) : null;
  const outScr = fieldCard ? (() => {
    const a = scr(fieldCard.home);
    const b = scr([fieldCard.home[0] + fieldCard.out[0], fieldCard.home[1] + fieldCard.out[1]]);
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  })() : null;

  await loop(sc, (el, dt) => {
    bits.step(dt);
    topBits.step(dt);
    const sHead = headAt(path, el);
    const headG = path.at(sHead);
    const headScr = scr(headG, 12);

    // ================================ marks
    once('rattle', el, T.rattle, () => {
      const mid = cards.length ? scr(cards[cards.length >> 1].home).x : 320;
      playV3('e_galeRattle', { volume: 0.8, pan: panAt(mid) });
    });
    once('stroke', el, T.stroke - 10, () => {
      playV3(wind > 0 ? 'e_galeSweep' : 'e_galeSweepRL', { volume: 1 });
      // (no light pool runs with the front: the stepped light layer steps the dark pads toward leaf1 / leaf2,
      // which reads as a stain, not as light — the white leading edge is the stroke's light)
      void whirlLight?.fadeOut(160);
      whirlLight = null;
    });
    // the tail answers the LAST falling card: its whistle echoes back from the void (its pitch, its pan)
    if (!fired.has('tail') && flyN > 0 && fallN >= flyN) {
      fired.add('tail');
      const step = lastFallStep;
      const pan = lastFallPan;
      bg(wait(sc, 140).then(() => playV3('e_galeTail', { volume: 0.85, pan, pitch: Math.pow(2, -step / 12) })));
    }
    once('headOut', el, T.stroke + T.strokeMs, () => {
      void (headLight as LightHandle | null)?.fadeOut(200);
      headLight = null;
    });
    if (flame) {
      once('env', el, 40, () => {
        envPool = lightPool(sc, flame.at.x, flame.at.y - 16, { color: flame.ramp[3], radius: 32, floorY: flame.at.y, air: 1, airRadius: 20, intensity: 0, anim: 'flicker', fadeIn: 0, tint: 0.2 });
        envPool.setIntensity(1.35, 160);
        // the environment's light over the victim's whole half (it tints their tiles in the flame's colour)
        const half = scr(toWorld(victim, [3, 0.8]));
        envSpill = lightPool(sc, R(half.x), R(half.y) - 10, { color: flame.ramp[3], radius: 150, floorY: R(half.y), intensity: 0, tint: 0.35, fadeIn: 0, anim: 'flicker' });
        envSpill.setIntensity(1.6, 220);
      });
      // while it gutters, the environment's light over the half dims in three steps with it
      // (stepped, with one re-flare on the third step: a candle fighting for its last breath)
      for (let k = 0; k < 4; k++) once(`dim${k}`, el, ft.tClear + (k * T.gutter) / 4, () => (envSpill as LightHandle | null)?.setIntensity([0.8, 0.4, 0.72, 0.2][k], 20));
      once('snuff', el, ft.tOut, () => {
        flame.out = true;
        playV3('e_galeSnuff', { volume: 1, pan: panAt(flame.at.x) });
        // the candle goes out: its light is CUT, not faded — and the arena's light drops with it for a breath
        // (the field theme changes under that dark, then the room comes back)
        (envPool as LightHandle | null)?.setIntensity(0, 20);
        (envSpill as LightHandle | null)?.setIntensity(0, 20);
        bg(lightDimFor(sc, volcano ? 1 : 0.85, 170, 20, 380));
        // the breath of darkness over the whole room: carried by the light layer's dim alone (a translucent
        // full-screen veil would blend every pixel off the palette — palcheck G4). The rectangle stays as the
        // invisible clock of that breath (the theme changes inside it, the lava overlay is cut by it)
        dark = sc.add.rectangle(0, 0, 640, 360, PAL.night0, 1).setOrigin(0, 0).setDepth(DEPTH.FX + 5).setVisible(false);
        darkT0 = el;
        bg(wait(sc, 100).then(() => {
          (envPool as LightHandle | null)?.destroy();
          (envSpill as LightHandle | null)?.destroy();
        }));
        // the field card jolts as its flame dies (1 px, two frames) and the field spell's own 'inactive' event
        // plays NOW, on the snuff frame (it waits for that jolt: spellfx untilCardCracks)
        const ft0 = fieldCard?.tile;
        if (ft0 && ft0.active) {
          ft0.x = R(ft0.home.x) + wind;
          bg(wait(sc, 40).then(() => ft0.active && (ft0.x = R(ft0.home.x))));
        }
        if (fieldIdx >= 0 && !ctx.isConsumed(fieldIdx)) {
          fieldJob = ctx.play(fieldIdx);
        }
        // the last gust: leaves burst off the snuffed wick in the wind's direction
        for (let k = 0; k < 6; k++) topBits.add({ kind: 'leaf', x: flame.at.x - wind * 8, y: flame.at.y - 10 - k * 2, vx: wind * (120 + rng() * 120), vy: -30 - rng() * 50, g: 80, life: 420 + rng() * 200, ph: rng(), c: k % 2 ? PAL.leaf4 : PAL.leaf3 });
      });
    }

    // ================================ the monsters' sway
    for (const sw of sways) {
      if (sw.done) continue;
      const sp = sw.u.sprite;
      if (!sp.active || sw.u.retired) {
        sw.done = true;
        continue;
      }
      if (el >= sw.t + 110) {
        sp.x = sw.x0;
        sw.done = true;
      } else if (el >= sw.t) sp.x = sw.x0 + wind * (el < sw.t + 70 ? 1 : 0);
    }

    // ================================ the head light
    if (headLight) (headLight as LightHandle).setPosition(R(headScr.x), R(headScr.y), R(scr(headG).y));

    // the last gust arrives just before the field card tears off (k ≈ 0.27 is the tear-off)
    if (fieldCard && gustT0 < 0 && el >= fieldCard.t0 - 90) gustT0 = el;
    // ================================ the flame
    if (flame) {
      if (!flame.out) {
        const appear = ease.out(seg(el, 40, 160));
        const lean = seg(el, ft.tField - T.leanLead, T.leanLead);
        flame.h = appear * (1 - 0.15 * lean);
        flame.calm = 1 - c01(lean * 2);
        flame.lean = wind * (q(lean, 5) * 6);
        flame.w = 1 - 0.2 * lean;
        flame.flap = lean > 0.5 ? 1 : 0;
        if (el >= ft.tField) {
          // stretched thin along the wind and buffeted while the bristles pass
          const k = seg(el, ft.tField, Math.max(60, ft.tClear - ft.tField));
          flame.lean = wind * (8 + R(q(k, 4) * 4));
          flame.w = 0.86 - 0.1 * k;
          flame.h = 0.94 - 0.08 * k;
          flame.flap = 1.5;
          flame.calm = 0;
        }
        if (el >= ft.tClear) {
          // the tail has gone by: it tries to stand up again, guttering in three steps — then OUT
          const step = Math.min(2, Math.floor(seg(el, ft.tClear, T.gutter) * 3));
          flame.h = [0.72, 0.5, 0.3][step];
          flame.w = [0.85, 0.68, 0.5][step];
          flame.lean = wind * [5, 3, 1][step];
          flame.flap = 0;
          flame.calm = 0;
        }
      } else flame.since += dt;
      (envPool as LightHandle | null)?.setPosition(flame.at.x + R(flame.lean / 2), flame.at.y - 12, flame.at.y);
      flameRas!.draw((r) => drawFlame(r, flame, el));
    }

    // ================================ the environment gutters out (a volcano's lava: its own overlay) + the dark
    if (cracks && lavaRas && flame) {
      const g = el - ft.tClear;
      const third = T.gutter / 3;
      let step = -1;
      if (flame.out) step = 3;
      else if (g >= 2 * third) step = 2;
      else if (g >= third + 14 && g < third + 34) step = 4; // the re-flare
      else if (g >= third) step = 1;
      else if (g >= 0) step = 0;
      if (step !== lavaStep && !lavaGone) {
        lavaStep = step;
        drawLavaGutter(lavaRas, cracks, step);
      }
    }
    if (dark && darkT0 >= 0) {
      const dT = el - darkT0;
      const board = ctx.views.board;
      // a volcano arena goes out WITH its flame: once its own cooling has begun (under the dark), the lava is cut
      // at once instead of cooling over a second
      if (volcano && !swapped && dT >= 40 && board.theme !== 'volcano') {
        swapped = true;
        void board.setTheme('normal', false);
      }
      const hold = DARK.hold(volcano);
      if (dT >= hold && lavaRas && !lavaGone && (swapped || dT >= hold + 3 * DARK.step)) {
        lavaGone = true;
        lavaRas.destroy();
        lavaRas = null;
      }
      const k = dT < hold ? 0 : Math.floor((dT - hold) / DARK.step) + 1;
      if (k >= 3) {
        dark.destroy();
        dark = null;
      }
    }

    // ================================ the cards
    for (const [i, c] of cards.entries()) {
      // the rattle: 1-px hops, faster as the head nears (the field card rattles hard while its flame fights)
      if (!c.lifted && c.tile && c.tile.active && el >= T.rattle) {
        const near = c.t0 - el;
        const every = near < 140 ? 30 : near < 300 ? 55 : 95;
        const hop = Math.floor((el + i * 23) / every) % 2;
        c.tile.y = c.tileY - hop;
      }
      if (!c.lifted && el >= c.t0) {
        c.lifted = true;
        const fx0 = scr(c.home);
        if (!c.flies) {
          // it RESISTS (its destination is not the graveyard): a 3-px jump, slammed back down
          const t = c.tile;
          if (t && t.active) {
            t.y = c.tileY - 3;
            bg(wait(sc, 90).then(() => {
              if (t.active) t.y = c.tileY;
              void t.pulse(PAL.crim3, 260);
              t.dust(8, 0.7);
            }));
          }
          playV3('e_galeSnap', { volume: 0.6, pan: panAt(fx0.x), pitch: 0.7 });
          continue;
        }
        const { tile } = field.release(c.uid);
        tile?.destroy();
        c.tile = null;
        c.fc = new FlyCard(sc, c.cardId, c.victim);
        tauEdges.set(c, edgeTau(c));
        playV3('e_galeSnap', { volume: 0.9, pan: panAt(fx0.x), pitch: 1 + ((i * 7) % 5) * 0.05 });
        // the broom's bristles scrape over the slot as they tear it off
        playV3('e_galeBristle', { volume: 0.7, pan: panAt(fx0.x), pitch: 1 - ((i * 3) % 4) * 0.04 });
        // floor dust and a paper scrap or two torn off with it
        for (let k = 0; k < 6; k++) bits.add({ kind: 'mote', x: fx0.x + R((rng() - 0.5) * 20), y: fx0.y + R((rng() - 0.5) * 6), vx: wind * (20 + rng() * 30), vy: -20 - rng() * 25, g: 60, life: 360, c: k % 2 ? PAL.stone4 : PAL.leaf4 });
        for (let k = 0; k < 2; k++) topBits.add({ kind: 'paper', x: fx0.x, y: fx0.y - 6, vx: wind * (60 + rng() * 60), vy: -40 - rng() * 40, g: 90, life: 600, ph: rng() });
      }
      const fc = c.fc;
      if (!fc || c.gone) continue;
      // the field card goes on the last, hardest gust: its flight runs 1.5× faster
      const tau = (el - c.t0) * (c.kind === 'field' ? 1.5 : 1);
      const f = flight(c, tau, tauEdges.get(c) ?? 9999);
      const ground = scr(f.g);
      const at = { x: ground.x, y: ground.y - f.z };
      // the roll about the wind's axis (+ a yaw); stepped to 1/48 turn for crisp frames
      const STEP = (Math.PI * 2) / 48;
      const roll = Math.round(((c.spin * tau) / 1000 - 3 * Math.pow(tau / 1000, 2) * Math.sign(c.spin)) / STEP) * STEP;
      const yaw = Math.round(((c.yaw * tau) / 1000) * 16) / 16;
      const ax: [number, number, number] = [c.along[0], c.along[1], 0];
      const qq = qMul(qAxis(ax, roll), qMul(qAxis([0, 0, 1], yaw), restQuat(c.victim, 'up', !c.faceDown)));
      const below = f.z < 0;
      const tE = tauEdges.get(c) ?? 9999;
      // past the edge it RECEDES into the void: the mip shrinks in steps (1 → ¾ → ½), the tones step down (stone,
      // then night) and it is cut off at the platform's lower lip, never reaching the hall floor
      const drop = f.past ? tau - tE : -1;
      const scale = drop < FALL.shrink1 ? 1 : drop < FALL.shrink2 ? 0.75 : 0.5;
      const recede: 0 | 1 | 2 = drop < FALL.tone1 ? 0 : drop < FALL.tone2 ? 1 : 2;
      const light = below && recede === 0 ? -Math.min(0.45, Math.floor(-f.z / 12) * 0.15) : 0;
      const outside = !insideSlab({ col: f.g[0], row: f.g[1] });
      const mask = c.back && outside && below;
      // a white frame when it tears off; a face-down card flashes white on the frame its face first turns up
      let tintAmt = tau < 17 ? 0.7 : 0;
      // a far-row rider flies one band IN FRONT of its own row's monsters while it is up in the air (it never
      // tumbles hidden behind a golem); past a back edge it is BEHIND the slab
      const airFront = c.ride && !below && f.z > 6 ? riderFront : 0;
      const depth = outside && c.back ? DEPTH.PLATFORM - 0.5 : Math.max(unitDepth(ground.y) + 0.5, airFront, below && !c.back ? DEPTH.FX + 1 : 0);
      const lip = f.past ? c.lip : null;
      const front = fc.draw(at, qq, { light, tint: PAL.white, tintAmt, mask, depth, scale, recede, lip });
      if (c.faceDown && front && !c.sawFace && tau > 40) {
        c.sawFace = true;
        tintAmt = 1;
        fc.draw(at, qq, { light, tint: PAL.white, tintAmt, mask, depth, scale, recede, lip });
        playV3('e_galeGlimpse', { volume: 0.8, pan: panAt(at.x) });
      }
      if (f.past && !c.fell) {
        c.fell = true;
        // each card's whistle starts a step lower (a descending pentatonic run: the cascade is a little tune), the
        // later ones a touch quieter so the overlaps stay distinct; the whistle's bend runs with the shrink
        const n = fallN++;
        lastFallPan = panAt(at.x);
        lastFallStep = FALL_STEPS[Math.min(FALL_STEPS.length - 1, n)];
        playV3('e_galeFall', { volume: 0.78 * Math.pow(0.9, Math.min(4, n)), pan: lastFallPan, pitch: Math.pow(2, -lastFallStep / 12) });
      }
      // a thin falling streak above it for the first frames of the drop (the speed of the fall)
      if (drop >= 0 && drop < FALL.streak) streaks.push({ x: R(at.x), y: R(at.y - 14 * scale), n: drop < FALL.streak / 2 ? 12 : 7 });
      // the floor shadow while it is over the platform (dithered, shrinking with the height)
      if (!outside && f.z > 0) floorShadows.push({ x: R(ground.x), y: R(ground.y), k: Math.max(0.3, 1 - f.z / 50) });
      // trailing air ticks behind a tumbling card
      if (tau > 60 && !below && Math.floor(el / 40) % 2 === 0) topBits.add({ kind: 'mote', x: at.x - wind * 8, y: at.y + (i % 3) - 1, vx: -wind * 10, life: 140, c: PAL.leaf4 });
      const hidden = c.back ? f.z < -46 : (f.past && drop > 30 && fc.shown === 0) || at.y > 372;
      const goneNow = hidden || drop >= FALL.gone;
      // its leaves set off for the pile while it is still receding (the delivery overlaps the fall)
      if ((drop >= FALL.carry || goneNow) && !c.sent) {
        c.sent = true;
        const t0 = Math.max(el, lastCarry + T.carryGap);
        lastCarry = t0;
        const edgeG: G = [c.home[0] + c.along[0] * 0.9 + c.out[0] * (c.edge + 0.1), c.home[1] + c.along[1] * 0.9 + c.out[1] * (c.edge + 0.1)];
        const e = scr(edgeG);
        const from = { x: Math.max(8, Math.min(632, R(e.x))), y: Math.max(8, Math.min(352, R(e.y + 6))) };
        const to = field.pile(c.owner, 'graveyard').topXY();
        carriers.push({ c, from, to: { x: R(to.x), y: R(to.y) }, t0, ph: rng() * 6, landed: false });
      }
      if (goneNow) {
        c.gone = true;
        fc.hide();
      }
    }

    // ================================ the carriers (a leaf gust from the void edge to the pile)
    for (const cr of carriers) {
      if (cr.landed) continue;
      const k = (el - cr.t0) / T.carryMs;
      if (k < 0) continue;
      if (!fired.has(`carry${cr.c.uid}`)) {
        fired.add(`carry${cr.c.uid}`);
        playV3('e_galeCarry', { volume: 0.7, pan: panAt(cr.from.x) });
      }
      if (k >= 1 + T.dropMs / T.carryMs) {
        cr.landed = true;
        const pile = field.pile(cr.c.owner, 'graveyard');
        const count = landingCount(pile.count, ctx.after?.players?.[cr.c.owner]?.graveyard?.length);
        pile.set(count, cr.c.cardId);
        pile.bump();
        // the HUD's graveyard counter counts up with each delivery (the state sync after the batch then agrees)
        ctx.views.hud.setCounts(cr.c.owner, { grave: count });
        playV3('e_galePile', { volume: 0.75, pan: panAt(cr.to.x) });
        for (let j = 0; j < 4; j++) bits.add({ kind: 'mote', x: cr.to.x + (j - 1.5) * 3, y: cr.to.y - 2, vx: (j - 1.5) * 18, vy: -24, g: 90, life: 240, c: j % 2 ? PAL.leaf4 : PAL.leaf3 });
      }
    }

    // ================================ draw: the floor, the band, the top
    floor.draw((r) => {
      for (const s of floorShadows) {
        const rx = Math.max(3, R(10 * s.k));
        const ry = Math.max(1, R(5 * s.k));
        for (let y = -ry; y <= ry; y++)
          for (let x = -rx; x <= rx; x++) {
            const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
            if (d > 1 || (d > 0.4 && (x + y) % 2 !== 0)) continue;
            r.px(s.x + x, s.y + y, PAL.ink, 140);
          }
      }
      // the wind's track on the floor: a few broken green streaks under the band while it passes
      if (el >= T.stroke && el < T.stroke + T.strokeMs + 120) {
        for (let k = 0; k < 4; k++) {
          const s0 = sHead - 30 - k * 26 - ((el / 4) % 26);
          if (s0 < 0) continue;
          const g0 = path.at(s0);
          const nrm: G = [-path.tan(s0)[1], path.tan(s0)[0]];
          const off = ((k * 37) % 5) / 5 - 0.4;
          const a = scr([g0[0] + nrm[0] * off * BAND, g0[1] + nrm[1] * off * BAND]);
          const b = scr(path.at(s0 - 12));
          const bb = { x: b.x + (a.x - scr(g0).x), y: b.y + (a.y - scr(g0).y) };
          if (insideSlab(screenToIso(a.x, a.y))) r.line(a.x, a.y, bb.x, bb.y, k === 0 ? PAL.leaf3 : PAL.leaf2, 1);
        }
      }
      bits.draw(r);
    });
    floorShadows.length = 0;
    air.draw((r) => {
      if (el < T.stroke + 150) drawWhirl(r, whirlFloor, el, wind);
      if (el >= T.stroke - 20 && el < T.stroke + T.strokeMs * 1.15) drawBroom(r, path, sHead, el, blade ? 'bristles' : 'all');
    });
    blade?.draw((r) => {
      if (el >= T.stroke - 20 && el < T.stroke + T.strokeMs * 1.15) drawBroom(r, path, sHead, el, 'blade');
    });
    top.draw((r) => {
      for (const st of streaks)
        for (let k = 0; k < st.n; k++) {
          const c = k < 3 ? PAL.mist : k < 7 ? PAL.leaf3 : PAL.leaf2;
          if (k % 4 !== 3) r.px(st.x - 2, st.y - k, c);
          if (k < st.n - 3 && k % 3 !== 1) r.px(st.x + 3, st.y - 2 - k, c);
        }
      if (gustT0 >= 0 && fieldScr && outScr && el - gustT0 < 330) drawLastGust(r, fieldScr, outScr, (el - gustT0) / 330, el);
      topBits.draw(r);
      for (const cr of carriers) if (!cr.landed) drawCarrier(r, cr, el);
    });
    streaks.length = 0;

    // ================================ spawn leaves / paper at the head
    if (el >= T.stroke && el < T.stroke + T.strokeMs * 0.95 && rng() < dt / 22) {
      const tg = path.tan(sHead);
      const nrm: G = [-tg[1], tg[0]];
      const o = (rng() - 0.5) * 2 * BAND;
      const p = scr([headG[0] + nrm[0] * o, headG[1] + nrm[1] * o], 6 + rng() * 18);
      const vs = scr([headG[0] + tg[0], headG[1] + tg[1]]);
      const v0 = scr(headG);
      const sp = 300 + rng() * 120;
      const vx = ((vs.x - v0.x) / 36) * sp;
      const vy = ((vs.y - v0.y) / 36) * sp - 30;
      const leaf = rng() < 0.7;
      topBits.add({ kind: leaf ? 'leaf' : 'paper', x: p.x, y: p.y, vx, vy, g: 70, life: 520 + rng() * 360, ph: rng(), c: rng() < 0.4 ? PAL.leaf4 : PAL.leaf3 });
    }
    // the whirl draws leaves in
    if (el < T.stroke && rng() < dt / 40) {
      const a = rng() * Math.PI * 2;
      topBits.add({ kind: 'leaf', x: start.x + Math.cos(a) * 34, y: start.y + Math.sin(a) * 16, to: start, life: 280, ph: rng(), c: rng() < 0.5 ? PAL.leaf4 : PAL.leaf3 });
    }

    // ================================ done?
    const flying = cards.some((c) => c.flies && !c.gone);
    const carrying = carriers.some((cr) => !cr.landed);
    // (the smoke thread finishes on its own after the scene: see below)
    const smoking = !!flame && (!flame.out || flame.since < 260);
    return el < minEnd || flying || carrying || smoking || !!dark;
  });

  // ================================ the rest: a tail of falling leaves, the field's own event
  for (const sw of sways) if (!sw.done && sw.u.sprite.active) sw.u.sprite.x = sw.x0;
  for (const c of cards) {
    c.fc?.destroy();
    if (!c.flies && c.tile && c.tile.active) c.tile.y = c.tileY;
  }
  let last2 = 0;
  await run(sc, T.settle, (_t, el) => {
    const dt = el - last2;
    last2 = el;
    bits.step(dt);
    topBits.step(dt);
    top.draw((r) => topBits.draw(r));
    floor.draw((r) => bits.draw(r));
    air.draw(() => undefined);
  });
  (dark as Phaser.GameObjects.Rectangle | null)?.destroy();
  (lavaRas as Raster | null)?.destroy();
  if (volcano && !swapped && ctx.views.board.theme !== 'volcano') void ctx.views.board.setTheme('normal', false);
  air.destroy();
  blade?.destroy();
  top.destroy();
  floor.destroy();
  if (flame && flameRas) {
    // the snuffed wick's smoke thread keeps curling up on its own while the next beats play
    const f0 = flame;
    const fr = flameRas;
    let lastS = 0;
    bg(
      run(sc, Math.max(0, T.smokeMs - f0.since), (_t, el) => {
        f0.since += el - lastS;
        lastS = el;
        fr.draw((r) => drawFlame(r, f0, el));
      }).then(() => fr.destroy()),
    );
  }
  void (headLight as LightHandle | null)?.fadeOut(120);
  void (whirlLight as LightHandle | null)?.fadeOut(120);
  (envPool as LightHandle | null)?.destroy();
  (envSpill as LightHandle | null)?.destroy();
  // the field spell's own event (a volcano's monsters cooling) runs on past the gale
  if (fieldJob) await fieldJob;
}

/**
 * The last gust that takes the field card: three bristle curls (white heads hooking up, leaf4 → leaf2 tails) race
 * through the field zone along `dir` at three heights, a step apart. k: 0..1 over the gust (k ≈ 0.27 = the tear-off).
 */
function drawLastGust(r: Raster, at: XY, dir: XY, k: number, el: number): void {
  const nx = -dir.y;
  const ny = dir.x;
  for (let j = 0; j < 3; j++) {
    const kk = c01(k * 1.3 - j * 0.14);
    if (kk <= 0 || kk >= 1) continue;
    const lift = 5 + j * 8;
    const travel = -44 + 110 * kk;
    const hx = at.x + dir.x * travel;
    const hy = at.y - lift + dir.y * travel;
    const len = R((26 - j * 5) * (kk > 0.7 ? 1 - (kk - 0.7) / 0.3 : 1));
    for (let d = 0; d <= len; d++) {
      const wv = Math.sin(d / 4 + el / 35 + j) * Math.min(1.5, d * 0.12);
      const x = R(hx - dir.x * d + nx * wv);
      const y = R(hy - dir.y * d + ny * wv);
      if (d > 14 && Math.floor((d + j * 3) / 4) % 2 === 1) continue;
      r.px(x, y, d < 2 ? PAL.white : d < 7 ? PAL.leaf4 : d < 14 ? PAL.leaf3 : PAL.leaf2);
    }
    // the head hooks up into a little curl
    const sx = dir.x >= 0 ? 1 : -1;
    r.px(R(hx + sx), R(hy - 1), PAL.white);
    r.px(R(hx + sx), R(hy - 2), PAL.leaf4);
    r.px(R(hx), R(hy - 3), PAL.leaf4);
    r.px(R(hx - sx), R(hy - 3), PAL.leaf3);
    // a leaf riding each curl
    leaf3(r, R(hx - dir.x * 9), R(hy - dir.y * 9 - 3 - (Math.floor(el / 60) % 2)), Math.floor(el / 70) + j, j % 2 ? PAL.leaf3 : PAL.leaf4);
  }
}

/** The breath of darkness after the snuff (its clock; the light layer's dim draws it), held, then three steps. */
const DARK = {
  hold: (volcano: boolean) => (volcano ? 70 : 50),
  step: 40,
} as const;

/** Crack tones per gutter step (by the crack's own variation: [dim, bright]); 3 = dead (under the dark). */
const LAVA_GUTTER: Record<number, readonly [number, number]> = {
  0: [PAL.fire2, PAL.fire3],
  1: [PAL.crim1, PAL.fire2],
  4: [PAL.fire2, PAL.fire3],
  2: [PAL.crim1, PAL.crim2],
  3: [PAL.stone1, PAL.stone1],
};

/** The volcano's lava guttering out: the board's own crack pixels, repainted in stepped dying tones. */
function drawLavaGutter(r: Raster, f: ReturnType<typeof buildCrackField>, step: number): void {
  r.draw((rr) => {
    if (step < 0) return;
    const tones = LAVA_GUTTER[step];
    const W = SLAB_RECT.w;
    for (let k = 0; k < f.core.length; k++) {
      const i = f.core[k];
      const x = (i % W) + SLAB_RECT.x;
      const y = Math.floor(i / W) + SLAB_RECT.y;
      const v = f.coreTone[k] >> 1;
      let c: number = tones[v];
      // the re-flare catches only some of the seams; the last step goes out in patches
      if (step === 4 && (x + y) % 3 === 0) c = PAL.crim1;
      if (step === 2 && Math.floor((x + 2 * y) / 9) % 3 === 0) c = PAL.stone1;
      rr.px(x, y, c);
    }
  });
}

/** Semitones below the first whistle for each falling card in turn (a descending minor-pentatonic run). */
const FALL_STEPS = [0, 3, 5, 7, 10, 12, 15] as const;

/** Falling streaks of this frame (filled by the card loop, drawn by the top raster). */
const streaks: { x: number; y: number; n: number }[] = [];
/** The last falling card's whistle (its pan / step): the tail's echo answers it. */
let lastFallPan = 0;
let lastFallStep = 0;

/** Floor shadow stamps of this frame (filled by the card loop, drawn by the floor raster). */
const floorShadows: { x: number; y: number; k: number }[] = [];

/**
 * A carrier: four leaves on a gust streak from the void edge to the pile (an arc), then a mini card silhouette (the
 * fallen card, 5×7: ink outline, mist face) drops onto the pile in steps.
 */
function drawCarrier(r: Raster, cr: Pick<Carrier, 'from' | 'to' | 't0' | 'ph'>, el: number): void {
  const k = (el - cr.t0) / T.carryMs;
  if (k < 0) return;
  const ctrl = { x: (cr.from.x + cr.to.x) / 2, y: Math.min(cr.from.y, cr.to.y) - 34 };
  if (k < 1) {
    const e = ease.inOut(k);
    // the gust streak: a dashed line back along the arc (leaf3 → leaf2 → leaf1)
    let prev: XY | null = null;
    for (let m = 0; m <= 8; m++) {
      const u = Math.max(0, e - m * 0.03);
      const p = qbez(cr.from, ctrl, cr.to, u);
      const pp = { x: R(p.x), y: R(p.y) };
      if (prev && m % 3 !== 2) r.line(prev.x, prev.y, pp.x, pp.y, m < 3 ? PAL.leaf3 : m < 6 ? PAL.leaf2 : PAL.leaf1);
      prev = pp;
    }
    // the leaves riding it
    for (let j = 0; j < 4; j++) {
      const u = Math.max(0, e - j * 0.05);
      const p = qbez(cr.from, ctrl, cr.to, u);
      const wob = Math.sin(el / 60 + cr.ph + j * 1.7) * 3;
      leaf3(r, R(p.x), R(p.y + wob), Math.floor(el / 70) + j, j % 2 ? PAL.leaf3 : PAL.leaf4);
    }
    return;
  }
  // the mini card drops onto the pile (three steps) and settles
  const d = (el - cr.t0 - T.carryMs) / T.dropMs;
  const dy = d < 0.34 ? -9 : d < 0.67 ? -5 : -2;
  const x0 = cr.to.x - 2;
  const y0 = cr.to.y - 5 + dy;
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 5; x++) {
      const edge = x === 0 || y === 0 || x === 4 || y === 6;
      r.px(x0 + x, y0 + y, edge ? PAL.ink : x === 2 && y === 3 ? PAL.leaf4 : PAL.mist);
    }
}

/**
 * The whirl: a little TORNADO standing on the end tile of the row — six stepped wind rings stacked into a funnel
 * (~30 px tall, widening upward), spinning, white leading tips on the front arcs; four leaves orbit it at different
 * heights; a dust ring turns on the tile. It grows ring by ring from the floor; as the stroke leaves it leans
 * downwind and unwinds (`wind`: +1 the stroke runs right).
 */
function drawWhirl(r: Raster, floor: XY, el: number, wind: number): void {
  const grow = 0.25 + 0.75 * ease.out(el / T.whirlMs);
  const unwind = seg(el, T.stroke, 150);
  const N = 7;
  const shownRings = Math.min(N, Math.max(2, Math.ceil(grow * N + 0.01)));
  // the dust ring on the tile (dashed, turning)
  if (unwind < 0.8) {
    const rot = el / 90;
    const rx = R(8 + 8 * grow);
    for (let a = 0; a < 20; a++) {
      if ((a + Math.floor(el / 50)) % 4 === 0) continue;
      const an = rot + (a / 20) * Math.PI * 2;
      const front = Math.sin(an) > 0;
      r.px(R(floor.x + Math.cos(an) * rx), R(floor.y + Math.sin(an) * rx * 0.42), front ? PAL.stone4 : PAL.stone3);
    }
  }
  for (let i = 0; i < shownRings; i++) {
    const z = 2 + i * 5 + unwind * i * 2;
    const rx = (4 + i * 2.6) * (0.55 + 0.45 * grow) * (1 + unwind * 0.6);
    const ry = rx * 0.38;
    const cx = floor.x + wind * unwind * i * 4 + (i % 2 ? 1 : 0);
    const cy = floor.y - z;
    const rot = (el / 1000) * (13 + i * 1.6) + i * 0.9;
    const span = Math.PI * (1.4 - unwind * 1.0);
    const n = Math.max(8, R(rx * 3.2));
    let prev: XY | null = null;
    for (let k = 0; k <= n; k++) {
      const an = rot + (k / n) * span;
      const p = { x: R(cx + Math.cos(an) * rx), y: R(cy + Math.sin(an) * ry) };
      const front = Math.sin(an) > -0.1;
      const lead = k >= n - 1;
      const col = lead ? PAL.white : !front ? PAL.leaf2 : k > n * 0.6 ? PAL.leaf4 : PAL.leaf3;
      if (prev) {
        r.line(prev.x, prev.y, p.x, p.y, col);
        // the front arcs are 2 px thick (a solid band of wind, not a wire)
        if (front && unwind < 0.6) r.line(prev.x, prev.y + 1, p.x, p.y + 1, lead ? PAL.leaf4 : PAL.leaf2);
      }
      prev = p;
    }
    // speed streaks inside the funnel's body (short slanted dashes racing round)
    if (i > 0 && unwind < 0.7) {
      for (let k = 0; k < 2; k++) {
        const an = -rot * 1.3 + k * Math.PI + i;
        if (Math.sin(an) < 0.1) continue;
        const x0 = R(cx + Math.cos(an) * rx * 0.6);
        const y0 = R(cy + Math.sin(an) * ry * 0.6 + 2);
        const sx = Math.sin(an) > 0 ? -1 : 1;
        r.px(x0, y0, PAL.leaf4);
        r.px(x0 + sx, y0, PAL.leaf3);
        r.px(x0 + sx * 2, y0 + 1, PAL.leaf2);
      }
    }
  }
  // the eye: a white core column flickering up the middle
  if (unwind < 0.5 && grow > 0.4) {
    const hgt = R(26 * grow);
    for (let z = 3; z < hgt; z += 2) if ((z + Math.floor(el / 40)) % 6 < 3) r.px(floor.x + (z % 4 < 2 ? 0 : 1), floor.y - z, z % 3 ? PAL.leaf4 : PAL.white);
  }
  // the leaves orbiting it (they are flung off downwind as it unwinds)
  if (grow > 0.3) {
    for (let k = 0; k < 6; k++) {
      const z = 4 + k * 6;
      const an = (el / 1000) * (9 + k) + k * 1.6;
      const rx = 8 + k * 3 + unwind * 30;
      const p = { x: R(floor.x + Math.cos(an) * rx + wind * unwind * 26), y: R(floor.y - z + Math.sin(an) * rx * 0.4 - unwind * 6) };
      leaf3(r, p.x, p.y, Math.floor(el / 60) + k, k % 2 ? PAL.leaf3 : PAL.leaf4);
    }
  }
}

/** Hover height of the band at lateral offset o (−1..1): an arched crest, the middle highest (a rolling gust). */
const crestZ = (o: number) => 5 + 13 * (1 - o * o);
/** How far the middle of the crescent leads its tips (px of path). */
const LEAD = 26;

/**
 * The broom stroke: a filled crescent BLADE of wind at the head (white leading edge, leaf4 / teal4 bands, a leaf3
 * body) and 13 bristle streaks trailing behind it, tails broken and converging like a broom's bristles.
 */
function drawBroom(r: Raster, path: Path, sHead: number, el: number, part: 'all' | 'bristles' | 'blade'): void {
  const fade = seg(el, T.stroke + T.strokeMs * 0.8, T.strokeMs * 0.32);
  const born = seg(el, T.stroke - 20, 110);
  // ---- the bristles (drawn first: the blade covers their roots)
  for (const [o, , len0, lag0] of part === 'blade' ? [] : BRISTLES) {
    const lag = LEAD * o * o + 10;
    const len = len0 * (0.3 + 0.7 * born) * (1 - fade);
    if (len < 3) continue;
    const s0 = sHead - lag;
    if (s0 <= 0) continue;
    let prev: XY | null = null;
    for (let d = 0; d <= len; d += 3) {
      const s = s0 - d;
      if (s < 0) break;
      const g = path.at(s);
      const tg = path.tan(s);
      const nrm: G = [-tg[1], tg[0]];
      const u = d / Math.max(1, len);
      // converge toward the "handle" and wave a little down the tail
      const w = BAND * o * (1 - 0.5 * u) + Math.sin(s / 17 + lag0 * 1.7 + el / 90) * 0.035 * u;
      const z = crestZ(o) * (1 - 0.3 * u) + Math.sin(s / 21 + lag0) * 1.2 * u;
      const p0 = scr([g[0] + nrm[0] * w, g[1] + nrm[1] * w], z);
      const p = { x: R(p0.x), y: R(p0.y) };
      let col: number;
      if (u < 0.22) col = lag0 % 2 ? PAL.teal4 : PAL.leaf4;
      else if (u < 0.5) col = PAL.leaf3;
      else if (u < 0.78) col = PAL.leaf2;
      else col = PAL.leaf1;
      const dash = u < 0.4 || Math.floor((d + lag0 * 5) / (u < 0.78 ? 9 : 6)) % 2 === 0;
      if (prev && dash && !(fade > 0.6 && u > 0.35)) r.line(prev.x, prev.y, p.x, p.y, col);
      prev = p;
    }
  }
  // ---- the blade: a crescent moon of wind (front edge s = head − LEAD·o², thickness tapering to the tips)
  if (fade >= 0.95 || part === 'bristles') return;
  const thick = (o: number) => (20 - 12 * o * o) * (0.5 + 0.5 * born) * (1 - fade);
  const half = 1 - 0.5 * fade;
  for (let oi = -48; oi <= 48; oi++) {
    const o = (oi / 48) * half;
    const front = sHead - LEAD * o * o;
    const th = thick(o);
    for (let e = 0; e <= th; e += 1) {
      const s = front - e;
      if (s < 0) break;
      const g = path.at(s);
      const tg = path.tan(s);
      const nrm: G = [-tg[1], tg[0]];
      const w = BAND * o;
      const z = crestZ(o) + (e / Math.max(1, th)) * 2;
      const p = scr([g[0] + nrm[0] * w, g[1] + nrm[1] * w], z);
      let col: number;
      if (e < 2.5) col = PAL.white;
      else if (e < 6) col = Math.abs(oi) < 10 ? PAL.teal4 : PAL.leaf4;
      else if (e < th * 0.55) col = PAL.leaf3;
      else col = PAL.leaf2;
      // the outermost tips thin to a single rim
      if (Math.abs(oi) >= 46 * half) col = e < 3 ? PAL.leaf4 : PAL.leaf2;
      r.px(R(p.x), R(p.y), col);
    }
  }
  // speed ticks in the blade (short white dashes riding it): living detail
  for (let k = 0; k < 4; k++) {
    const o = ((k * 0.53 + el / 260) % 1.6) - 0.8;
    const s = sHead - LEAD * o * o - 7 - ((k * 5 + el / 30) % 9);
    if (s < 0) continue;
    const g = path.at(s);
    const tg = path.tan(s);
    const nrm: G = [-tg[1], tg[0]];
    const a = scr([g[0] + nrm[0] * BAND * o * half, g[1] + nrm[1] * BAND * o * half], crestZ(o) + 1);
    const b = scr(path.at(s - 6), 0);
    const ga = scr(g, 0);
    r.line(R(a.x), R(a.y), R(a.x + (b.x - ga.x)), R(a.y + (b.y - ga.y)), PAL.white);
  }
}

