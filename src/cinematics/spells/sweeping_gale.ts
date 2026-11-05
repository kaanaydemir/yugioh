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
//   ~320   release (hold 170 ms): a spinning leaf-green CURL (a white core, leaf4 / leaf3 arms, a leaf trail) leaves
//          the card's top edge and lobs (230 ms) to the far end of the OPPONENT's back row, just off the slab's
//          corner — e_galeLob ("fwip"); the spent card drops to its graveyard behind it
// The massDestroy (registerLaneE, this file) — ONE gale for every per-card event of the wipe:
//   +0     THE WHIRL winds up where the curl landed: three stepped wind curls (white / leaf4 / leaf3) spin and grow,
//          leaves are drawn round them, a green light breathes under it — e_galeWhirl. THE FIELD SPELL's
//          ENVIRONMENT shows itself as a candle-like flame of its own colour standing on its card (tidal: water,
//          cavern: void, festival: gold, volcano: fire) flickering on a 4-frame loop (tip sway + width pulse), and
//          pours its light over the opponent's side
//   +90    the doomed cards RATTLE in their slots (1-px hops, faster as the wind nears) — e_galeRattle
//   +210   THE BROOM STROKE (the head runs the path in 700 ms): the whirl unwinds into a giant crescent of wind — 13
//          bristles (a white leading edge, a crescent front where the middle bristles lead, leaf4 / teal4 / leaf3
//          bodies, broken leaf2 tails converging like a broom's bristles toward its "handle") sweeps the whole back
//          row end to end (L → R when player 1 casts; mirrored for player 2), hovering just over the tiles, and leaves
//          over the side rim past the field zone; a soft green light runs with its front, leaves and paper scraps
//          ride it — e_galeSweep (the broom "shhhk" travelling L → R)
//   each card, as the front reaches it: it tears off its slot (one white frame, a paper SNAP — e_galeSnap), lifts
//          and TUMBLES (a real 3-D roll about the wind's axis + a yaw: the iso card renderer), is carried along and
//          outward; a face-down card shows its FACE as it turns over (one white frame, then the face —
//          e_galeGlimpse); its shadow shrinks on the floor; it crosses the PLATFORM EDGE and drops at once into the
//          void (gravity, darkening in light steps; past a back edge it goes BEHIND the slab and its trim, in front
//          of the backdrop; over a front edge it drops past the wall) — the receding whistle, e_galeFall
//   THE FIELD (its own clock, see fieldTimes): the flame leans as the front nears (−220 ms), is stretched thin and
//          buffeted while the bristles pass (drawn ABOVE the band: always visible), and once the stroke's tail has
//          cleared the zone it gutters in three steps (150 ms) and is SNUFFED like a candle: its light pools go out
//          at once, a puff, a wick ember blinks twice, a 2-px smoke thread curls up and drifts downwind —
//          e_galeSnuff ("vump") on that frame. On the same frame the field card, the last to go, tears off and
//          blows over the side edge, and the field spell's own 'inactive' event plays: a volcano arena's lava is
//          cut on the snuff frame (the board's theme set at once), its monsters' own cooling follows
//   +~670  THE TAIL: the stroke leaves over the far rim, its bristles thin out, the last leaves spiral down —
//          e_galeTail (an airy sigh; the falling cards own the only whistle)
//   each fallen card is delivered to its owner's graveyard AS SOON AS it is gone: a little gust of four leaves
//          streaks from where it vanished to the pile (e_galeCarry), drops a mini card silhouette on it, the pile
//          counts up and bumps — e_galePile
// THE RESPONSE WINDOW (a ready Büyü Mührü): the activation batch has no massDestroy. The card does NOT dissolve: a
// hand card keeps hovering beside its owner, a set card lies back down face-up on its own tile, while a few leaves
// keep circling it (a kept handle, 'gale:wait'). Declined → the next batch's gale releases its curl FROM THAT CARD
// and sends the card to its graveyard; sealed → after the trap's own presentation the gale dies on the card (the
// leaves wither and drop, the card sags — e_galeDie) and it goes to its graveyard (the 'toGraveyard' hook).
// Measured (game time, tempo 1.35): see docs/v3/oturum-e.md / the fix-round notes; the side effects (spite_axe back
// to its deck, soul_leash's monster going home, a field spell's stat changes) are NOT presented here: their events
// stay unconsumed and play in order after the gale (their own presentations). A card whose destination is not the
// graveyard (spite_axe → deck) RESISTS the gale: it rattles, jumps 3 px and slams back down; its own toDeck
// presentation takes it from there.

import Phaser from 'phaser';
import type { CardId } from '../../data/cards';
import type { GameEvent, PlayerId, Uid } from '../../engine/types';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { FLAT_H, FLAT_W, cardMip, poseAxes, qAxis, qMul, renderCard, restQuat, type Quat } from '../../art/cards';
import { DEPTH, LOOK_V3, type XY, isoToScreen, screenToIso, unitDepth, zoneCell, zoneXY } from '../../view/layout';
import type { TileCard } from '../../view/TileCard';
import type { CardSprite } from '../../view/CardSprite';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { wait } from '../../vfx/core';
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
  whirlMs: 210,
  rattle: 90,
  stroke: 210,
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
  /** a fallen card's carrier leaves this long after the previous one (overlapped, not queued) */
  carryGap: 50,
  /** after the last delivery */
  settle: 60,
} as const;

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
  [-0.9, 0.1],
  [0.0, 0.0],
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
    const H = Math.max(3, R(24 * f.h * hp));
    for (let k = 0; k <= H; k++) {
      const u = k / H;
      // teardrop: widest a third up, a pointed tip
      const shape = Math.sin(Math.PI * Math.min(1, 0.18 + u * 0.95)) * Math.pow(1 - u, 0.35);
      const hw = Math.max(0, Math.floor(4.5 * f.w * wp * shape));
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
    for (let dx = -6; dx <= 6; dx++) r.px(at.x + dx, at.y - 2, Math.abs(dx) < 3 ? ramp[3] : ramp[2]);
    for (let dx = -4; dx <= 4; dx++) r.px(at.x + dx, at.y - 1, ramp[2]);
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
        const c = k - cut < 8 ? PAL.stone3 : k > L - 8 ? PAL.stone1 : PAL.stone2;
        if (prev) r.line(prev.x, prev.y, x, y, c);
        else r.px(x, y, c);
        if (k - cut < 12 && s < 520) r.px(x + 1, y, k - cut < 6 ? PAL.stone4 : PAL.stone2);
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
  draw(c: XY, qq: Quat, o: { light?: number; tint?: number; tintAmt?: number; mask?: boolean; depth: number }): boolean {
    const pc = this.pc;
    pc.clear();
    const { ex, ey, n } = poseAxes(qq, FLAT_W, FLAT_H);
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
  spin: number;
  yaw: number;
  fc: FlyCard | null;
  lifted: boolean;
  sawFace: boolean;
  fell: boolean;
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
      const out: G = dirWorld(victim, kind === 'field' ? [1, 0] : [0, -1]);
      const edge = kind === 'field' ? SLAB.c1 - loc[0] : loc[1] - SLAB.r0;
      // the back edges (the platform's top hides a falling card): the victim's rows < 0 / cols < 0 side
      const back = victim === 1 ? kind !== 'field' : kind === 'field';
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
        spin: 0,
        yaw: 0,
        fc: null,
        lifted: false,
        sawFace: false,
        fell: false,
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

/** The flight's edge crossing (τ ms after the lift) along the smooth outward curve. */
function edgeTau(c: Swept): number {
  const oTot = c.edge + 0.5;
  for (let k = 30; k <= 560; k += 10) if (oTot * ease.smooth(c01((k - 30) / 520)) >= c.edge) return k;
  return 9999;
}

/** A card's flight at τ ms after its lift: ground point (grid), height (px), whether it is past the edge. */
function flight(c: Swept, tau: number, tauEdge: number): { g: G; z: number; past: boolean } {
  const A = 0.95 * ease.out(tau / 600);
  const oTot = c.edge + 0.5;
  const O = oTot * ease.smooth(c01((tau - 30) / 520));
  const g: G = [c.home[0] + c.along[0] * A + c.out[0] * O, c.home[1] + c.along[1] * A + c.out[1] * O];
  const peak = c.kind === 'field' ? 20 : 26;
  const zAt = (t: number) => (t < 180 ? peak * ease.out(t / 180) : peak + R(Math.sin((t - 180) / 120) * 4));
  const past = tau >= tauEdge;
  let z = zAt(tau);
  if (past) {
    // the drop starts AT the edge: no glide over the rim, straight down into the void
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
      stir.p = stirLeaves(sc, stirAt, h + 120);
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
  const spent = wait(sc, 140).then(() => (op.leave ? op.leave(gi) : undefined));
  await ctx.play(mi, { galeOpened: true });
  await spent;
  if (stir.p) await stir.p;
  relax(ctx, 300);
  await fx.playRun(ctx, fx.resolutionRun(ctx));
});

/** Seven leaves circling the hovering card on wind arcs, closer and faster (the air stirs before the gale). */
function stirLeaves(sc: Phaser.Scene, c: XY, ms: number): Promise<void> {
  const ras = Raster.around(sc, c.x, c.y, 110, 96, DEPTH.FX_TOP + 11);
  const N = 7;
  return run(sc, ms, (t, el) => {
    ras.draw((r) => {
      for (let k = 0; k < N; k++) {
        const a0 = (k * Math.PI * 2) / N;
        const spin = (el / 1000) * (4.5 + 6 * t);
        const rad = (36 - 14 * ease.in(t)) * (k % 2 ? 0.86 : 1);
        const at = (da: number) => ({ x: R(c.x + Math.cos(a0 + spin - da) * rad), y: R(c.y + 6 + Math.sin(a0 + spin - da) * rad * 0.45) });
        // the wind arc trailing each leaf (it lengthens as the stir speeds up)
        const arcN = 3 + Math.floor(t * 4);
        for (let j = 1; j <= arcN; j++) {
          const p = at(j * 0.11);
          r.px(p.x, p.y, j <= 1 ? PAL.leaf3 : j <= 3 ? PAL.leaf2 : PAL.leaf1);
        }
        const p = at(0);
        leaf3(r, p.x, p.y, Math.floor(el / 70) + k, k % 3 === 0 ? PAL.leaf4 : PAL.leaf3);
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
  const bits = new Bits();
  let last = 0;
  let shed = false;
  return run(sc, ms, (t, el) => {
    const dt = el - last;
    last = el;
    bits.step(dt);
    const k = ease.inOut(t);
    const p = qbez(from, ctrl, to, k);
    const x = R(p.x);
    const y = R(p.y);
    light.setPosition(x, y, R(y + 30 - 16 * k));
    for (const tr of trail) tr.age += dt;
    trail.push({ x, y, age: 0 });
    while (trail.length && trail[0].age > 120) trail.shift();
    if (!shed && t > 0.45) {
      shed = true;
      bits.add({ kind: 'leaf', x, y, vx: (to.x - from.x) * 0.2, vy: -30, g: 120, life: 420, ph: 0.3, c: PAL.leaf3 });
    }
    ras.draw((r) => {
      for (const tr of trail) r.px(tr.x, tr.y + 1, tr.age < 40 ? PAL.leaf3 : tr.age < 80 ? PAL.leaf2 : PAL.leaf1);
      // the curl: three arm pixels round a white core, spinning (stepped to eighths)
      const a = Math.floor(el / 30) * (Math.PI / 4);
      for (let j = 0; j < 4; j++) {
        const an = a + j * 0.75;
        const rr = 1.6 + j * 0.45;
        r.px(R(x + Math.cos(an) * rr), R(y + Math.sin(an) * rr), j < 2 ? PAL.leaf4 : j < 3 ? PAL.leaf3 : PAL.leaf2);
      }
      r.px(x, y, PAL.white);
      r.px(x + 1, y, PAL.white);
      bits.draw(r);
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
        const tail = { x: R(c.x + Math.cos(a - 0.16) * o.rx), y: R(c.y + Math.sin(a - 0.16) * o.ry) };
        r.px(tail.x, tail.y + 1, PAL.leaf2);
        leaf3(r, p.x, p.y, Math.floor(el / 110) + k, k % 2 ? PAL.leaf3 : PAL.leaf4);
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
    ctx.keep(KEEP, new GaleWait(null, tile, ev.uid, ev.player, idleLeaves(sc, c, { tile, rx: 26, ry: 11 })));
  } else {
    // a hand card keeps hovering beside its owner: the opening's dressing goes (plate, ring, rim), the card stays
    const card = op.card as CardSprite;
    card.setActive(false);
    await op.close();
    card.setActive(true);
    const c = { x: R(card.x), y: R(card.y) + 4 };
    ctx.keep(KEEP, new GaleWait(card, null, ev.uid, ev.player, idleLeaves(sc, c, { card, rx: 34, ry: 14 })));
  }
  relax(ctx);
}

/** The spent waiting card goes to its graveyard (a hovering card drops to the floor first). */
async function waitingCardLeaves(ctx: AnyCtx, w: GaleWait, gi: number): Promise<void> {
  const g = gi >= 0 ? (ctx.events[gi] as Extract<GameEvent, { type: 'toGraveyard' }>) : null;
  const owner = g ? g.owner : w.owner;
  const sc = ctx.scene;
  if (w.tile && w.tile.active) {
    ctx.views.field.release(w.uid);
    return cardLeaves(ctx, { owner, cardId: ID, from: { x: R(w.tile.home.x), y: R(w.tile.home.y) }, tile: w.tile });
  }
  const c = w.card;
  if (c && c.active) {
    const y0 = R(c.y);
    await run(sc, 80, (k) => c.active && c.setY(y0 + R(6 * k * k)));
    const at = { x: R(c.x), y: castFloor({ x: c.x, y: y0 }) - 2 };
    c.destroy();
    return cardLeaves(ctx, { owner, cardId: ID, from: at });
  }
}

/** Büyü Mührü answered: the gale dies on its card — the leaves wither and drop, the card sags and goes. */
registerCardHook(ID, 'toGraveyard', async (ctx) => {
  if (!LOOK_V3) return ctx.base();
  const h = ctx.take(KEEP);
  if (!(h instanceof GaleWait)) {
    if (h) ctx.keep(KEEP, h);
    return ctx.base();
  }
  h.stop();
  if (h.tile) return ctx.base(); // a set card: its own destroy presentation already took it
  const sc = ctx.scene;
  const card = h.card;
  const at = card ? { x: R(card.x), y: R(card.y) } : castSpot(h.owner);
  playV3('e_galeDie', { volume: 0.85, pan: panAt(at.x) });
  const ras = Raster.around(sc, at.x, at.y + 20, 120, 120, DEPTH.FX_TOP + 11);
  const bits = new Bits();
  h.leaves().forEach((p, i) => bits.add({ kind: 'leaf', x: p.x, y: p.y, vx: (i % 2 ? 1 : -1) * 14, vy: -10, g: 260, life: 380 + i * 30, ph: i * 0.4, c: i % 2 ? PAL.leaf2 : PAL.leaf3 }));
  if (card && card.active) void card.pulse(PAL.crim3, 220);
  let last = 0;
  await run(sc, 300, (t, el) => {
    bits.step(el - last);
    last = el;
    // the card shivers for three frames as the air leaves it
    if (card && card.active) card.setX(at.x + (el < 90 ? (Math.floor(el / 30) % 2 ? 1 : -1) : 0));
    ras.draw((r) => bits.draw(r));
    void t;
  });
  ras.destroy();
  await waitingCardLeaves(ctx as unknown as AnyCtx, h, ctx.index);
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
  const air = new Raster(sc, 0, 0, 640, 360, bandDepth);
  const top = new Raster(sc, 0, 0, 640, 360, DEPTH.FX + 6);
  const floor = new Raster(sc, 0, 0, 640, 360, DEPTH.TILE_FX + 2);
  const bits = new Bits();
  const topBits = new Bits();

  // ---- the field environment's flame (drawn above the band: the stroke never hides it)
  const fieldCard = cards.find((c) => c.kind === 'field') ?? null;
  const fieldAt = fieldCard ? zoneXY(victim, 'field', 0) : null;
  const flame: Flame | null = fieldCard && fieldAt ? { at: { x: R(fieldAt.x), y: R(fieldAt.y) }, ramp: envRamp(fieldId), h: 0, lean: 0, w: 1, calm: 1, flap: 0, out: false, since: 0, wind } : null;
  const flameRas = flame ? Raster.around(sc, flame.at.x, flame.at.y - 36, 100, 110, DEPTH.FX + 7) : null;
  const ft = fieldCard ? fieldTimes(path, fieldCard.s) : { tField: 0, tClear: 0, tOut: 0 };
  // the field card is the last to go: it holds (rattling) until its flame is out, then the last gust takes it
  if (fieldCard) fieldCard.t0 = ft.tOut;
  console.log('GALEDBG', JSON.stringify(ft));
  let envPool: LightHandle | null = null;
  let envSpill: LightHandle | null = null;
  let fieldJob: Promise<void> | null = null;

  // ---- lights (they brighten the floor: no multiply tint)
  let whirlLight: LightHandle | null = lightPool(sc, start.x, start.y, { color: PAL.leaf3, radius: 26, floorY: R(scr(path.at(0)).y), air: 0.8, airRadius: 18, intensity: 0, anim: 'breathe', fadeIn: 0, tint: 0 });
  whirlLight.setIntensity(1, 180);
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
  const tauEdges = new Map<Swept, number>();
  const minEnd = T.stroke + T.strokeMs + 200;

  playV3('e_galeWhirl', { volume: 0.9, pan: panAt(start.x) });

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
      headLight = lightPool(sc, headScr.x, headScr.y, { color: PAL.leaf4, radius: 30, floorY: R(scr(headG).y), air: 0.5, airRadius: 20, intensity: 0.75, tint: 0, fadeIn: 60 });
      void whirlLight?.fadeOut(160);
      whirlLight = null;
    });
    once('tail', el, T.stroke + T.strokeMs * 0.66, () => playV3('e_galeTail', { volume: 0.8, pan: wind * 0.8 }));
    once('headOut', el, T.stroke + T.strokeMs, () => {
      void (headLight as LightHandle | null)?.fadeOut(200);
      headLight = null;
    });
    if (flame) {
      once('env', el, 40, () => {
        envPool = lightPool(sc, flame.at.x, flame.at.y - 12, { color: flame.ramp[3], radius: 22, floorY: flame.at.y, air: 0.9, airRadius: 14, intensity: 0, anim: 'flicker', fadeIn: 0, tint: 0 });
        envPool.setIntensity(1.1, 160);
        envSpill = lightPool(sc, flame.at.x - wind * 40, flame.at.y - 20, { color: flame.ramp[2], radius: 90, floorY: flame.at.y - 20, intensity: 0, tint: 0, fadeIn: 0 });
        envSpill.setIntensity(0.7, 220);
      });
      once('snuff', el, ft.tOut, () => {
        flame.out = true;
        console.log('GALEDBG snuff', el);
        playV3('e_galeSnuff', { volume: 1, pan: panAt(flame.at.x) });
        // the candle goes out: its light is cut, not faded
        (envPool as LightHandle | null)?.setIntensity(0, 40);
        (envSpill as LightHandle | null)?.setIntensity(0, 60);
        bg(wait(sc, 100).then(() => {
          (envPool as LightHandle | null)?.destroy();
          (envSpill as LightHandle | null)?.destroy();
        }));
        // the last gust: leaves burst off the snuffed wick in the wind's direction
        for (let k = 0; k < 6; k++) topBits.add({ kind: 'leaf', x: flame.at.x - wind * 8, y: flame.at.y - 10 - k * 2, vx: wind * (120 + rng() * 120), vy: -30 - rng() * 50, g: 80, life: 420 + rng() * 200, ph: rng(), c: k % 2 ? PAL.leaf4 : PAL.leaf3 });
      });
    }

    // ================================ the head light
    if (headLight) (headLight as LightHandle).setPosition(R(headScr.x), R(headScr.y), R(scr(headG).y));

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
          flame.w = 0.72 - 0.12 * k;
          flame.h = 0.88 - 0.1 * k;
          flame.flap = 1.5;
          flame.calm = 0;
        }
        if (el >= ft.tClear) {
          // the tail has gone by: it tries to stand up again, guttering in three steps — then OUT
          const step = Math.min(2, Math.floor(seg(el, ft.tClear, T.gutter) * 3));
          flame.h = [0.55, 0.36, 0.18][step];
          flame.w = [0.66, 0.56, 0.46][step];
          flame.lean = wind * [5, 3, 1][step];
          flame.flap = 0;
          flame.calm = 0;
        }
      } else flame.since += dt;
      (envPool as LightHandle | null)?.setPosition(flame.at.x + R(flame.lean / 2), flame.at.y - 12, flame.at.y);
      if (el > 850 && el < 1100) console.log('GALEDBG f', R(el), flame.h.toFixed(2), flame.w.toFixed(2), flame.lean, flame.out);
      flameRas!.draw((r) => drawFlame(r, flame, el));
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
        // floor dust and a paper scrap or two torn off with it
        for (let k = 0; k < 6; k++) bits.add({ kind: 'mote', x: fx0.x + R((rng() - 0.5) * 20), y: fx0.y + R((rng() - 0.5) * 6), vx: wind * (20 + rng() * 30), vy: -20 - rng() * 25, g: 60, life: 360, c: k % 2 ? PAL.stone4 : PAL.leaf4 });
        for (let k = 0; k < 2; k++) topBits.add({ kind: 'paper', x: fx0.x, y: fx0.y - 6, vx: wind * (60 + rng() * 60), vy: -40 - rng() * 40, g: 90, life: 600, ph: rng() });
        if (c.kind === 'field' && fieldIdx >= 0 && !ctx.isConsumed(fieldIdx)) {
          // the field spell's own 'inactive' event on the snuff frame (its card is already off the tile)
          fieldJob = ctx.play(fieldIdx);
          if (fieldId === 'volcano_arena') {
            // a volcano arena goes out WITH its flame: the lava is cut now, not cooled over a second
            const board = ctx.views.board;
            bg(wait(sc, 1).then(() => (board.theme === 'volcano' ? undefined : board.setTheme('normal', false))));
          }
        }
      }
      const fc = c.fc;
      if (!fc || c.gone) continue;
      const tau = el - c.t0;
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
      const light = below ? -Math.min(0.9, Math.floor(-f.z / 18) * 0.15) : 0;
      const outside = !insideSlab({ col: f.g[0], row: f.g[1] });
      const mask = c.back && outside && below;
      // a white frame when it tears off; a face-down card flashes white on the frame its face first turns up
      let tintAmt = tau < 17 ? 0.7 : 0;
      // past a back edge it is BEHIND the slab, its trim and the units on it (in front of the backdrop only)
      const depth = outside && c.back ? DEPTH.PLATFORM - 0.5 : Math.max(unitDepth(ground.y) + 0.5, below && !c.back ? DEPTH.FX + 1 : 0);
      const front = fc.draw(at, qq, { light, tint: PAL.white, tintAmt, mask, depth });
      if (c.faceDown && front && !c.sawFace && tau > 40) {
        c.sawFace = true;
        tintAmt = 1;
        fc.draw(at, qq, { light, tint: PAL.white, tintAmt, mask, depth });
        playV3('e_galeGlimpse', { volume: 0.8, pan: panAt(at.x) });
      }
      if (f.past && !c.fell) {
        c.fell = true;
        playV3('e_galeFall', { volume: 0.75, pan: panAt(at.x), pitch: 1 + ((i * 5) % 4) * 0.04 });
      }
      // the floor shadow while it is over the platform (dithered, shrinking with the height)
      if (!outside && f.z > 0) floorShadows.push({ x: R(ground.x), y: R(ground.y), k: Math.max(0.3, 1 - f.z / 50) });
      // trailing air ticks behind a tumbling card
      if (tau > 60 && !below && Math.floor(el / 40) % 2 === 0) topBits.add({ kind: 'mote', x: at.x - wind * 8, y: at.y + (i % 3) - 1, vx: -wind * 10, life: 140, c: PAL.leaf4 });
      const hidden = c.back ? f.z < -46 : at.y > 372 || f.z < -125;
      if (hidden || tau >= (c.back ? T.fly : T.fly + 160)) {
        c.gone = true;
        fc.hide();
        // its leaves set off for the pile at once (overlapped with the others, a little apart)
        const t0 = Math.max(el, lastCarry + T.carryGap);
        lastCarry = t0;
        const edgeG: G = [c.home[0] + c.along[0] * 0.9 + c.out[0] * (c.edge + 0.1), c.home[1] + c.along[1] * 0.9 + c.out[1] * (c.edge + 0.1)];
        const e = scr(edgeG);
        const from = { x: Math.max(8, Math.min(632, R(e.x))), y: Math.max(8, Math.min(352, R(c.back ? e.y - 4 : Math.min(at.y, 350)))) };
        const to = field.pile(c.owner, 'graveyard').topXY();
        carriers.push({ c, from, to: { x: R(to.x), y: R(to.y) }, t0, ph: rng() * 6, landed: false });
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
        pile.set(landingCount(pile.count, ctx.after?.players?.[cr.c.owner]?.graveyard?.length), cr.c.cardId);
        pile.bump();
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
      if (el < T.stroke + 140) drawWhirl(r, start, el);
      if (el >= T.stroke - 20 && el < T.stroke + T.strokeMs * 1.15) drawBroom(r, path, sHead, el);
    });
    top.draw((r) => {
      topBits.draw(r);
      for (const cr of carriers) if (!cr.landed) drawCarrier(r, cr, el);
    });

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
      topBits.add({ kind: 'leaf', x: start.x + Math.cos(a) * 30, y: start.y + Math.sin(a) * 14, to: start, life: 260, ph: rng(), c: PAL.leaf3 });
    }

    // ================================ done?
    const flying = cards.some((c) => c.flies && !c.gone);
    const carrying = carriers.some((cr) => !cr.landed);
    const smoking = !!flame && (!flame.out || flame.since < T.smokeMs);
    return el < minEnd || flying || carrying || smoking;
  });

  // ================================ the rest: a tail of falling leaves, the field's own event
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
  air.destroy();
  top.destroy();
  floor.destroy();
  flameRas?.destroy();
  void (headLight as LightHandle | null)?.fadeOut(120);
  void (whirlLight as LightHandle | null)?.fadeOut(120);
  (envPool as LightHandle | null)?.destroy();
  (envSpill as LightHandle | null)?.destroy();
  // the field spell's own event (a volcano's monsters cooling) runs on past the gale
  if (fieldJob) await fieldJob;
}

/** Floor shadow stamps of this frame (filled by the card loop, drawn by the floor raster). */
const floorShadows: { x: number; y: number; k: number }[] = [];

/**
 * A carrier: four leaves on a gust streak from the void edge to the pile (an arc), then a mini card silhouette (the
 * fallen card, 5×7: ink outline, mist face) drops onto the pile in steps.
 */
function drawCarrier(r: Raster, cr: Carrier, el: number): void {
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

/** The whirl: three stepped wind curls spinning and growing at the start point; unwinds as the stroke leaves. */
function drawWhirl(r: Raster, c: XY, el: number): void {
  const grow = ease.out(el / T.whirlMs);
  const unwind = seg(el, T.stroke, 140);
  const rot = (el / 1000) * 15;
  const curls: readonly (readonly [number, number, number])[] = [
    [5, PAL.white, 0],
    [9, PAL.leaf4, 2.1],
    [13, PAL.leaf3, 4.2],
  ];
  for (const [rad0, col, ph] of curls) {
    const rad = rad0 * (0.4 + 0.6 * grow) * (1 + unwind * 0.8);
    const span = Math.PI * (1.25 - unwind * 0.9);
    const n = Math.max(6, R(rad * 3));
    let prev: XY | null = null;
    for (let k = 0; k <= n; k++) {
      const a = rot + ph + (k / n) * span;
      // a curl: the radius tightens toward the head of each arc
      const rr = rad * (0.75 + 0.25 * (k / n));
      const p = { x: R(c.x + Math.cos(a) * rr), y: R(c.y + Math.sin(a) * rr * 0.55) };
      const cc = k > n * 0.75 ? (col === PAL.white ? PAL.leaf4 : col === PAL.leaf4 ? PAL.leaf3 : PAL.leaf2) : col;
      if (prev) r.line(prev.x, prev.y, p.x, p.y, k < 2 ? PAL.leaf2 : cc);
      prev = p;
    }
  }
  // the eye of the whirl
  if (unwind < 1) {
    r.px(c.x, c.y, PAL.white);
    r.px(c.x + 1, c.y, PAL.leaf4);
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
function drawBroom(r: Raster, path: Path, sHead: number, el: number): void {
  const fade = seg(el, T.stroke + T.strokeMs * 0.8, T.strokeMs * 0.32);
  const born = seg(el, T.stroke - 20, 110);
  // ---- the bristles (drawn first: the blade covers their roots)
  for (const [o, , len0, lag0] of BRISTLES) {
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
  if (fade >= 0.95) return;
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

