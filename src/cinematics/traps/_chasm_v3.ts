// Yer Yarığı — the v3 look (lane A5-A step A-5; reworked by the user's decision of 24 Oct: "Yer Yarığı
// seemed huge too" — docs/v3/A5_PLAN.md top note, REHBER EF-2). Behind V3_A5_A only: chasm_trap.ts hands
// over on the first line of its activate and destroys hooks; v1 and the plain v3 look keep the glowing
// fissure and setpieces.chasm byte-identical. No registrations here.
//
// The old scene's centrepiece comes back — the magenta crack from the trap to the summoned monster, the
// cracks racing out from under it, the WIDE glowing abyss (as wide as the old one: the same half width,
// max(30, 0.55 × the body's width) plus a little, with the same jagged rim), the body sinking into it,
// the rocks tumbling after it, the slam and the ring — drawn in the v3 pixel language: flat palette
// tones and hard 1-px lines (no dithered haze, no whole-sprite tint, no camera shake), the fall on whole
// pixels behind the hole's front lip (no fade). What v3 made better stays: the v3 trap opening (in
// parallel), the victim's own struck frame, its card going down with the floor and the new one born on
// the scar (card continuity), the v3 sounds and today's camera calls.
// t = activate, show-clock ms (game ms ≈ + 67 at 1×: the opening's burst stop and the destroy's dispatch frame):
//   0        the trap opening (trapOpeningV3: the card springs up, burst, "TUZAK!"), its lean as today
//            (same target as chasm_trap.ts:118).
//   84       CRACK — `crack`: the destroy plays (the victim's own death hooks step aside, sourceOwnsDeath:
//            its death is the fall). From the trap tile's edge a glowing crack runs to the victim's tile in
//            220 ms (5 px across like the old fissure: mag1 glow, mag3 lip, 1-px ink split, mag4 inner lip;
//            the newest pixels white / mag4, a hard head, stone bits kicked up), four short branches crackle
//            off it, a stepped magenta floor strip follows it. chasmCrack
//   ≈ 264    the ground under the victim cracks: 7 glowing cracks race out from under it (as the old ones,
//            up to 1.5 half widths long); the body flinches — v3 art: its hitHeavy struck frame; the old
//            art: its v1 hit — stone dust rises off the cracks
//   ≈ 424    OPEN — `open`: the abyss opens in whole steps with a small overshoot (150 ms): a jagged ink
//            hole, its back wall in strata (a 1-px steel lip, night bands, the glow climbing the lowest
//            band as a 2×2 checker), the magenta deep in two flat bands, a lit front lip (mag3 over mag1);
//            the body trembles 1 px and sinks 3 px, stone chips fly off the rim; its card under it goes with
//            the floor. Today's victim lean (chasm_trap.ts:153, :148 before A-5) is called here, same
//            target and options (user decision: the camera does not change). chasmOpen + the body's thud
//   ≈ 574    FALL: the body drops on whole pixels (an accelerating ≈ 400 ms fall, as the old one) behind
//            the hole's front lip — a geometry mask: no fade, no tint; v3 art goes on to hitHeavy f1 / f2;
//            seven rocks break off the back rim and tumble in after it (masked too); the deep glow breathes
//            one tone. chasmFall
//   ≈ 1067   SHUT — `shut`: the abyss slams shut in whole steps (180 ms); the scar's cracks flash white for
//            a frame; a two-ring shock ring runs out over the floor (mag4 → mag3 → mag2 → earth, whole
//            pixels), dust puffs and magenta sparks; the scar trembles 1 px (local, never the camera); the
//            card is born on the scar (cardLeaves) and flies to the graveyard; the cracks cool down by
//            palette steps. chasmShut
//   then     EXIT — `exit`: once the abyss has shut (at any speed), the trap card lies down on its tile and
//            leaves for the graveyard from there, landing ≥ 150 ms after the victim's card; the camera
//            relaxes (ctx.unfocus(320)).
// Nothing here adds a full-screen flash, a dim, a whole-sprite tint or a camera move (A5 §0 K1–K2). Under
// REDUCED_MOTION particles are halved (fxCount) and nothing trembles (jitter).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { crackPath } from '../../art/spellmotifs-v3';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type BeamHandle, type LightHandle } from '../../view/light';
import { wait } from '../../vfx/core';
import { Sparks as PxSparks } from '../../vfx/combat';
import { E, Raster, onFrame, run, spriteBox } from '../../vfx/setpieces';
import { fx, type CinematicContext } from '../api';
import { type EvOf, all, lerpXY, live } from '../battle/_kit';
import { cardLeaves, flightMs } from '../_v3/card';
import { frontEdgeMask, fxCount, fxRng, jitter } from '../_v3/spellfx';
import { hitSoundFor, panAt, play as playV3, playHit } from '../_v3/sound';
import { trapOpening, type Opening } from './_opening';

type ActCtx = CinematicContext<EvOf<'activate'>>;
type DestroyCtx = CinematicContext<EvOf<'destroy'>>;

const TAU = Math.PI * 2;

// ================================================================ timing (show-clock ms)

/**
 * The crack leaves the trap tile: activate + 84 show-ms ≈ 150 game-ms at 1× (the opening's 40 ms burst
 * stop — 3 frames — and the destroy's dispatch frame come on top; measured). Keeps "summon handler
 * end → crack" ≤ 300 ms with lane A6-B's fast decision (S-15, ≤ 120 ms).
 */
export const CRACK_AT = 84;
/** The crack's run, trap tile → the victim's tile (A5 §3.4: ≤ 250 ms; the old fissure took 280). */
export const CRACK_MS = 220;
/** The cracks under the victim start this long before the crack arrives … */
export const RADIAL_LEAD = 40;
/** … and race out in this long (the old ones: 300 ms, before the hole). */
export const RADIAL_MS = 160;
/** The abyss opens (whole steps, a small overshoot; the old one: 180 ms). */
export const OPEN_MS = 150;
/** The fall: at most this many rendered frames (≈ 400 ms at 1×, as the old one's 480 ms inQuad fall) … */
export const FALL_FRAMES = 24;
/** … it ends 2 frames after the body has passed under the lip; then the open abyss stands this long (its deep glow breathing). */
export const HOLD_MS = 100;
/** The abyss slams shut (whole steps; the old one: 200 ms). */
export const SHUT_MS = 180;
/**
 * When the shut lands at 1× at the latest (show ms after the crack left): crack + under-cracks + open + the
 * longest fall + hold + shut (a short body is under the lip sooner; the exit also waits for the real shut).
 */
export const SHUT_AFTER = CRACK_MS - RADIAL_LEAD + RADIAL_MS + OPEN_MS + Math.round((FALL_FRAMES * 1000) / 60) + HOLD_MS + SHUT_MS;
/**
 * The running crack's depth: over the trap opening's floor ring (DEPTH.SHADOW − 1), which would hide its
 * first ≈ 20 px for 2–3 frames after the crack sound, and under the shadows and the units.
 */
export const CRACK_DEPTH = DEPTH.SHADOW - 0.5;
/** The abyss lies on the floor under everything that stands (the old one's depth). */
export const ABYSS_DEPTH = DEPTH.SHADOW - 1;
/** Two graveyard landings at least this far apart (A5 §3.0 EF-12). */
export const LAND_GAP = 150;
/** A zone tile's iso half sizes (the calm pad's interior is ≈ 26 × 13): where the crack leaves the trap tile. */
export const PAD_HW = 25;
export const PAD_HH = 12;

// ================================================================ pure helpers (tested)

/**
 * The fall's offsets (px below the start), one per rendered frame: an accelerating whole-pixel drop
 * (the old one's inQuad) deep enough for the tallest body to pass under the lip.
 */
export function fallOffsets(depth = 120, frames = FALL_FRAMES): number[] {
  const out: number[] = [];
  for (let k = 1; k <= frames; k++) out.push(Math.round(depth * (k / frames) * (k / frames)));
  return out;
}

/**
 * How far from the trap tile's centre the crack starts along the unit direction `u`: just past the
 * tile's iso diamond (half sizes PAD_HW + 1, PAD_HH + 1), + 2 px.
 */
export function footOffset(u: XY): number {
  const k = Math.abs(u.x) / (PAD_HW + 1) + Math.abs(u.y) / (PAD_HH + 1);
  return Math.ceil(1 / Math.max(k, 1e-6)) + 2;
}

/**
 * When the trap card's flight must start for it to land at `target` (ms on the same clock as `now`):
 * its flash + lift + arc take `fly`. Never in the past.
 */
export function exitDelay(now: number, fly: number, target: number | null): number {
  return target === null ? 0 : Math.max(0, Math.ceil(target - (now + fly)));
}

/** The abyss: its centre, half sizes, jagged rim and the cracks that run out from under the victim. */
export interface AbyssShape {
  x: number;
  y: number;
  /** Half width / half height of the open hole (the old one: RX = max(30, 0.55 × body width), RY = RX / 2). */
  rx: number;
  ry: number;
  /** The rim's jag factor per angle step (NJ steps round the hole). */
  jag: number[];
  /** The 7 cracks from the centre outward (whole-pixel paths). */
  cracks: XY[][];
}

/** Angle steps round the rim (the old one's 40). */
const NJ = 40;

/** The old abyss's half width for a body of this opaque width (setpieces.chasm), + 2 px: never narrower. */
export function abyssHalfWidth(bodyW: number): number {
  return Math.max(30, Math.round(bodyW * 0.55)) + 2;
}

export function abyssShape(at: XY, bodyW: number, seed: number): AbyssShape {
  const rnd = fxRng(seed);
  const x = Math.round(at.x);
  const y = Math.round(at.y);
  const rx = abyssHalfWidth(bodyW);
  const ry = Math.round(rx / 2);
  const jag = Array.from({ length: NJ }, (_, i) => 0.86 + rnd() * 0.22 + (i % 3 === 0 ? 0.08 : 0));
  const cracks = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * TAU + (rnd() - 0.5) * 0.5;
    const len = rx * (0.9 + rnd() * 0.6);
    return crackPath({ x, y }, { x: Math.round(x + Math.cos(a) * len), y: Math.round(y + Math.sin(a) * len * 0.5) }, Math.floor(rnd() * 1e6) + 1, 3);
  });
  return { x, y, rx, ry, jag, cracks };
}

/** A point of the rim at angle `an` (0 = screen right, π/2 = front) for opening `open` (0…~1.1). */
export function abyssRimAt(s: AbyssShape, an: number, open: number): XY {
  const i = ((Math.round((an / TAU) * NJ) % NJ) + NJ) % NJ;
  const j = s.jag[i];
  return { x: s.x + Math.cos(an) * s.rx * open * j, y: s.y + Math.sin(an) * s.ry * open * j };
}

/** The hole's rim polygon (whole pixels). */
export function abyssRim(s: AbyssShape, open: number): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < NJ; i++) {
    const p = abyssRimAt(s, (i / NJ) * TAU, open);
    out.push({ x: Math.round(p.x), y: Math.round(p.y) });
  }
  return out;
}

/**
 * The front lip a falling body disappears behind: the hole's lower rim (left → right), extended sideways
 * along the floor line far past any body — below it, the body is under the floor (the old mask).
 */
export function abyssLip(s: AbyssShape, open: number, reach = 160): XY[] {
  const pts: XY[] = [{ x: s.x - reach, y: s.y }];
  for (let i = 0; i <= 20; i++) {
    const an = Math.PI - (i / 20) * Math.PI; // π → 0 along the front lip (left → right)
    const p = abyssRimAt(s, an, open);
    // (the jagged rim can step back a pixel near its ends: keep the lip a left → right line)
    pts.push({ x: Math.max(pts[pts.length - 1].x, Math.round(p.x)), y: Math.round(Math.max(s.y, p.y)) });
  }
  pts.push({ x: s.x + reach, y: s.y });
  return pts;
}

export interface AbyssLook {
  /** The cracks under the victim grown so far (0…1). */
  crack: number;
  /** The hole's opening (0 closed … 1 open; up to ≈ 1.1 in the overshoot). */
  open: number;
  /** The cracks' light: 3 full (mag4 inner, mag3), 2 (mag3 / mag2), 1 (mag2 / mag1), 0 bare ink, −1 gone. */
  glow: number;
  /** The deep glow's breath (0 / 1: one tone up). */
  breath: number;
  /** The slam frame: the scar's cracks drawn white. */
  seam: boolean;
}

/** One crack of the abyss: a 1-px core with 1-px lips across the local direction (the old 3-px glow). */
function paintRadial(p: PixelCanvas, path: readonly XY[], n: number, core: number, lip: number | null, inner: number | null): void {
  const m = Math.max(0, Math.min(path.length, Math.round(n)));
  for (let i = 0; i < m; i++) {
    const q = path[i];
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(m - 1, i + 1)];
    const flat = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    if (lip !== null) {
      if (flat) {
        p.set(q.x, q.y - 1, lip);
        p.set(q.x, q.y + 1, lip);
      } else {
        p.set(q.x - 1, q.y, lip);
        p.set(q.x + 1, q.y, lip);
      }
    }
  }
  for (let i = 0; i < m; i++) p.set(path[i].x, path[i].y, inner !== null && i < m * 0.6 ? inner : core);
}

/**
 * Paint the abyss in canvas coordinates (`ox`, `oy` = the canvas's world top left): the cracks under
 * the victim, then the open hole (ink, the back wall's strata and glow, the deep glow in two flat bands,
 * the lit front lip, the night4 back rim). Palette tones only, no alpha.
 */
export function paintAbyss(p: PixelCanvas, s: AbyssShape, L: AbyssLook, ox: number, oy: number): void {
  const local = (q: XY): XY => ({ x: q.x - ox, y: q.y - oy });
  // the cracks: 3-px glowing lines (mag1 lips, mag3 core, mag4 on their inner 60 %), cooling by steps
  if (L.crack > 0 && L.glow >= 0) {
    const tones: Record<number, [number, number | null, number | null]> = {
      3: [PAL.mag3, PAL.mag1, PAL.mag4],
      2: [PAL.mag3, PAL.mag1, null],
      1: [PAL.mag2, null, null],
      0: [PAL.ink, null, null],
    };
    const [core, lip, inner] = L.seam ? [PAL.white, PAL.mag3, PAL.white] : tones[Math.max(0, Math.min(3, L.glow))];
    for (const c of s.cracks) paintRadial(p, c.map(local), Math.max(2, Math.round(c.length * Math.min(1, L.crack))), core, lip as number | null, inner as number | null);
  }
  if (L.open <= 0.02) return;
  const rim = abyssRim(s, L.open).map(local);
  p.poly(rim.map((q) => [q.x, q.y] as [number, number]), PAL.ink);
  const cx = s.x - ox;
  const cy = s.y - oy;
  // the back wall under the far rim: a 1-px steel lip, then night bands, the deep glow climbing the
  // lowest band as a 2×2 checker (one magenta step)
  for (let i = 0; i < NJ; i++) {
    const an = (i / NJ) * TAU;
    if (Math.sin(an) > -0.05) continue; // the back half only
    const wallH = Math.round(13 * Math.min(1, L.open) * Math.pow(-Math.sin(an), 0.8));
    const a = local(abyssRimAt(s, an, L.open));
    const b = local(abyssRimAt(s, ((i + 1) / NJ) * TAU, L.open));
    const steps = Math.max(1, Math.ceil(Math.abs(b.x - a.x)));
    for (let k = 0; k <= steps; k++) {
      const xx = Math.round(a.x + ((b.x - a.x) * k) / steps);
      const yy = Math.round(a.y + ((b.y - a.y) * k) / steps);
      for (let d = 0; d < wallH; d++) {
        const f = d / Math.max(1, wallH);
        let c: number = d < 1 ? PAL.steel : f < 0.3 ? PAL.night2 : f < 0.55 ? PAL.night1 : PAL.night0;
        if ((d + Math.floor(xx * 0.3)) % 4 === 0 && d > 1 && f < 0.55) c = PAL.night0;
        if (f >= 0.7 && ((xx + yy + d) & 1) === 0) c = L.breath ? PAL.mag2 : PAL.mag1;
        if (p.get(xx, yy + d) === PAL.ink) p.set(xx, yy + d, c);
      }
    }
  }
  // the deep glow: two flat iso bands, the inner one breathing one tone
  const o = Math.min(1, L.open);
  p.ellipse(cx + 0.5, cy + 0.5 + Math.round(s.ry * 0.25 * o), Math.max(1, s.rx * 0.55 * o), Math.max(1, s.ry * 0.4 * o), PAL.mag1);
  p.ellipse(cx + 0.5, cy + 0.5 + Math.round(s.ry * 0.3 * o), Math.max(1, s.rx * 0.3 * o), Math.max(0.5, s.ry * 0.22 * o), L.breath ? PAL.mag3 : PAL.mag2);
  // the rim: the lit front lip (mag3 over mag1), the back rim night4
  for (let i = 0; i < NJ; i++) {
    const a = rim[i];
    const b = rim[(i + 1) % NJ];
    const front = Math.sin((i / NJ) * TAU) > 0;
    p.line(a.x, a.y, b.x, b.y, front ? PAL.mag3 : PAL.night4);
    if (front) p.line(a.x, a.y + 1, b.x, b.y + 1, PAL.mag1);
  }
}

// ================================================================ small pieces

/** Elapsed show time (speed / hit-stop aware, the clock the cards fly on) since the call. */
function showTimer(scene: Phaser.Scene): { now(): number; stop(): void } {
  let t = 0;
  const stop = onFrame(scene, (dt) => {
    t += dt;
    return true;
  });
  return { now: () => t, stop };
}

/** One rendered frame (scene clock; a hit-stop holds it). */
function nextFrame(scene: Phaser.Scene): Promise<void> {
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt <= 0) return true;
      resolve();
      return false;
    });
  });
}

/** Run `fn(k)` once per rendered frame for `n` frames (k = 0 … n − 1); resolves after the last. */
function eachFrame(scene: Phaser.Scene, n: number, fn: (k: number) => void): Promise<void> {
  return new Promise((resolve) => {
    let k = 0;
    onFrame(scene, (dt) => {
      if (dt <= 0) return true;
      fn(k++);
      if (k >= n) {
        resolve();
        return false;
      }
      return true;
    });
  });
}

/** The abyss on the floor: one raster, repainted when its look changes. */
class AbyssRaster {
  readonly r: Raster;
  private look: AbyssLook = { crack: 0, open: 0, glow: 3, breath: 0, seam: false };
  constructor(
    scene: Phaser.Scene,
    readonly shape: AbyssShape,
    depth: number,
  ) {
    const span = Math.ceil(shape.rx * 1.6) + 6;
    this.r = new Raster(scene, shape.x - span, shape.y - Math.ceil(span / 2) - 4, span * 2 + 1, span + 24, depth);
  }
  get state(): AbyssLook {
    return this.look;
  }
  set(look: Partial<AbyssLook>): void {
    this.look = { ...this.look, ...look };
    const r = this.r;
    if (!r.alive) return;
    r.begin();
    paintAbyss(r.pc, this.shape, this.look, r.x, r.y);
    r.end();
  }
  /** The 1-px local tremble of the slam (this raster only; off under reduced motion). */
  tremble(scene: Phaser.Scene, ms: number): Promise<void> {
    const r = this.r;
    return jitter(scene, { x: r.x, y: r.y, setPosition: (x: number, y: number) => r.moveTo(x, y) }, ms);
  }
  destroy(): void {
    this.r.destroy();
  }
}

/**
 * The glowing crack from the trap to the victim (the old fissure in v3 pixels): 5 px across — mag1 glow,
 * mag3 upper lip, a 1-px ink split, mag4 lower lip (lit from inside), mag1 glow — the newest pixels white
 * / mag4 with a hard head; four short branches crackle off it; stone bits are kicked up at its head.
 * `done` resolves on arrival; `cool()` steps it down to bare ink and out.
 */
function fissureV3(scene: Phaser.Scene, from: XY, to: XY, o: { ms: number; seed: number; depth: number }): { done: Promise<void>; cool(ms?: number): Promise<void> } {
  const rnd = fxRng(o.seed);
  const path = crackPath(from, to, o.seed, 4);
  const branches = Array.from({ length: 4 }, (_, i) => {
    const k = 0.2 + i * 0.18 + (rnd() - 0.5) * 0.1;
    const at = path[Math.min(path.length - 1, Math.floor(k * (path.length - 1)))];
    const a = rnd() * TAU;
    const l = 6 + rnd() * 7;
    return { k, pts: crackPath(at, { x: Math.round(at.x + Math.cos(a) * l), y: Math.round(at.y + Math.sin(a) * l * 0.5) }, o.seed + i * 17 + 3, 2) };
  });
  const xs = [...path, ...branches.flatMap((b) => b.pts)].map((q) => q.x);
  const ys = [...path, ...branches.flatMap((b) => b.pts)].map((q) => q.y);
  const ras = new Raster(scene, Math.min(...xs) - 4, Math.min(...ys) - 4, Math.max(...xs) - Math.min(...xs) + 9, Math.max(...ys) - Math.min(...ys) + 9, o.depth);
  const debris = new PxSparks(scene, o.depth + 0.1);
  let shown = 0;
  let level = 3; // 3 lit, 2 dimmer, 1 dim, 0 ink, −1 gone
  const draw = () => {
    ras.begin();
    if (level >= 0) {
      const n = Math.min(path.length, shown);
      const lit = level >= 3;
      const halo = level >= 2 ? PAL.mag1 : null;
      const upper = level >= 3 ? PAL.mag3 : level >= 2 ? PAL.mag2 : level >= 1 ? PAL.mag1 : null;
      const lower = level >= 3 ? PAL.mag4 : level >= 2 ? PAL.mag3 : level >= 1 ? PAL.mag2 : null;
      for (let i = 0; i < n; i++) {
        const q = path[i];
        const a = path[Math.max(0, i - 2)];
        const b = path[Math.min(n - 1, i + 2)];
        const flat = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
        const [dx, dy] = flat ? [0, 1] : [1, 0];
        const fresh = lit && i >= n - 5 && shown < path.length;
        if (halo !== null && (i % 2 === 0 || i >= n - 12)) {
          ras.px(q.x - dx * 2, q.y - dy * 2, halo);
          ras.px(q.x + dx * 2, q.y + dy * 2, halo);
        }
        if (upper !== null) ras.px(q.x - dx, q.y - dy, fresh ? PAL.white : upper);
        if (lower !== null) ras.px(q.x + dx, q.y + dy, fresh ? PAL.mag4 : lower);
      }
      for (let i = 0; i < n; i++) ras.px(path[i].x, path[i].y, PAL.ink);
      // the branches crackle off once the head has passed them
      for (const br of branches) {
        if (n < br.k * path.length) continue;
        for (const q of br.pts) ras.px(q.x, q.y, level >= 2 ? PAL.mag2 : level >= 1 ? PAL.mag1 : PAL.ink);
      }
      // the head: a hard white star while it runs
      if (lit && shown < path.length && n > 0) {
        const h = path[n - 1];
        for (let k = -2; k <= 2; k++) {
          ras.px(h.x + k, h.y, Math.abs(k) === 2 ? PAL.mag4 : PAL.white);
          ras.px(h.x, h.y + k, Math.abs(k) === 2 ? PAL.mag4 : PAL.white);
        }
      }
    }
    ras.end();
  };
  const done = new Promise<void>((resolve) => {
    onFrame(scene, (dt, el) => {
      if (!ras.alive) {
        resolve();
        return false;
      }
      const before = shown;
      // at most one … several whole pixels per frame, never skipping the head's last frame
      shown = Math.min(path.length, Math.max(shown + (dt > 0 ? 1 : 0), Math.floor((el / o.ms) * path.length)));
      if (shown > before && dt > 0 && rnd() < 0.6) {
        const h = path[Math.max(0, shown - 1)];
        debris.add({ x: h.x, y: h.y, vx: (rnd() * 2 - 1) * 30, vy: -40 - rnd() * 50, ay: 280, life: 240 + Math.floor(rnd() * 120), colors: rnd() < 0.5 ? [PAL.mag4, PAL.mag3, PAL.mag2] : [PAL.stone3, PAL.stone2, PAL.stone1], shape: 'px', fadeAt: 1 });
      }
      draw();
      if (shown >= path.length) {
        resolve();
        return false;
      }
      return true;
    });
  });
  return {
    done,
    async cool(ms = 600) {
      // lit → dimmer → dim → bare ink → gone, in palette steps
      await run(scene, ms, (t) => {
        const lv = 3 - Math.min(4, Math.floor(t * 4.999));
        if (lv !== level) {
          level = lv;
          draw();
        }
      });
      ras.destroy();
      debris.release();
    },
  };
}

/**
 * Rocks breaking off the back rim and tumbling into the hole after the body (the old seven, whole-pixel
 * 2–3 px chunks: a lit stone3 top-left, stone2, a stone1 bottom-right), masked by the lip.
 */
function tumblingRocks(scene: Phaser.Scene, s: AbyssShape, mask: ReturnType<typeof frontEdgeMask>, depth: number, seed: number): { done: Promise<void>; kill(): void } {
  const rnd = fxRng(seed);
  const n = fxCount(7);
  const rocks = Array.from({ length: n }, (_, i) => {
    const an = Math.PI * (1.05 + rnd() * 0.9);
    const p = abyssRimAt(s, an, 1);
    return { x: p.x, y: p.y - 2, vx: (s.x - p.x) * (0.8 + rnd() * 0.8), vy: -(10 + rnd() * 40), delay: 60 + i * 55, big: rnd() < 0.5 };
  });
  const ras = new Raster(scene, s.x - s.rx * 2, s.y - s.ry * 2 - 10, s.rx * 4, s.ry * 4 + 140, depth);
  mask.apply(ras.img);
  let dead = false;
  const kill = () => {
    if (dead) return;
    dead = true;
    mask.clear(ras.img);
    ras.destroy();
  };
  const done = new Promise<void>((resolve) => {
    onFrame(scene, (dt, el) => {
      if (dead) {
        resolve();
        return false;
      }
      const sdt = dt / 1000;
      ras.begin();
      let alive = false;
      for (const r of rocks) {
        if (el < r.delay) {
          alive = true;
          continue;
        }
        if (el > r.delay + 520) continue;
        alive = true;
        r.vy += 520 * sdt;
        r.x += r.vx * sdt;
        r.y += r.vy * sdt;
        const x = Math.round(r.x);
        const y = Math.round(r.y);
        ras.px(x, y, PAL.stone3);
        ras.px(x + 1, y, PAL.stone2);
        ras.px(x, y + 1, PAL.stone2);
        ras.px(x + 1, y + 1, PAL.stone1);
        if (r.big) {
          ras.px(x + 2, y, PAL.stone2);
          ras.px(x + 2, y + 1, PAL.stone1);
        }
      }
      ras.end();
      if (!alive) {
        kill();
        resolve();
        return false;
      }
      return true;
    });
  });
  return { done, kill };
}

/** Stone dust rising off the cracks under the victim (stepped puffs, no alpha). */
function crackDust(scene: Phaser.Scene, s: AbyssShape, depth: number, seed: number): void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, depth);
  const n = fxCount(10);
  for (let i = 0; i < n; i++) {
    const c = s.cracks[i % s.cracks.length];
    const q = c[Math.floor(rnd() * c.length)];
    sp.add({ x: q.x, y: q.y, vx: (rnd() - 0.5) * 16, vy: -(14 + rnd() * 22), ay: 30, drag: 1.5, life: 260 + Math.floor(rnd() * 160), delay: Math.floor(rnd() * RADIAL_MS), size: 1 + Math.floor(rnd() * 2), shape: 'puff', colors: [PAL.stone2, PAL.night3, PAL.night2, PAL.night1], fadeAt: 1 });
  }
  sp.release();
}

/** The floor breaking at the open: stone chips and magenta sparks thrown up off the rim (whole pixels). */
function rimBurst(scene: Phaser.Scene, s: AbyssShape, depth: number, seed: number): void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, depth);
  const n = fxCount(18);
  for (let i = 0; i < n; i++) {
    const p = abyssRimAt(s, rnd() * TAU, 1);
    const mag = i % 2 === 0;
    sp.add({ x: Math.round(p.x), y: Math.round(p.y), vx: (rnd() - 0.5) * 60, vy: -(40 + rnd() * 50), ay: 300, life: 300 + Math.floor(rnd() * 200), size: !mag && rnd() < 0.4 ? 2 : 1, shape: 'px', colors: mag ? [PAL.mag4, PAL.mag3, PAL.mag2] : [PAL.stone3, PAL.stone2, PAL.stone1], fadeAt: 1 });
  }
  sp.release();
}

/**
 * The slam's shock ring over the floor (the old floorRing, whole pixels): two iso rings running out to
 * rx + 30, their tone stepping down mag4 → mag3 → mag2 → earth3 → gone. Resolves when gone.
 */
function slamRing(scene: Phaser.Scene, s: AbyssShape, depth: number, ms = 420): Promise<void> {
  const r1 = s.rx + 30;
  const ras = Raster.around(scene, s.x, s.y, r1 * 2 + 8, r1 + 8, depth);
  const ramp = [PAL.mag4, PAL.mag3, PAL.mag2, PAL.earth3];
  const ring = (rx: number, c: number) => {
    const n = Math.max(24, Math.round(TAU * rx));
    for (let i = 0; i < n; i++) {
      const an = (i / n) * TAU;
      ras.px(Math.round(s.x + Math.cos(an) * rx), Math.round(s.y + (Math.sin(an) * rx) / 2), c);
    }
  };
  return run(scene, ms, (t) => {
    const k = E.outCubic(t);
    ras.begin();
    const tone = ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
    ring(Math.round(6 + (r1 - 6) * k), tone);
    if (t > 0.12) ring(Math.round(6 + (r1 - 6) * E.outCubic(t - 0.12) * 0.82), ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length) + 1)]);
    ras.end();
  }).then(() => ras.destroy());
}

/** Dust puffs and sparks at the slam (stepped tones). */
function slamDust(scene: Phaser.Scene, s: AbyssShape, depth: number, seed: number): void {
  const rnd = fxRng(seed);
  const dust = new PxSparks(scene, depth);
  const n = fxCount(18);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    dust.add({ x: Math.round(s.x + Math.cos(a) * s.rx * 0.5), y: Math.round(s.y + Math.sin(a) * s.ry * 0.5 - 2), vx: Math.cos(a) * (30 + rnd() * 40), vy: Math.sin(a) * 18 - (10 + rnd() * 20), drag: 2.5, life: 400 + Math.floor(rnd() * 300), size: 1 + Math.floor(rnd() * 2), shape: 'puff', colors: [PAL.earth3, PAL.stone2, PAL.night3, PAL.night2], fadeAt: 1 });
  }
  dust.release();
  const sp = new PxSparks(scene, DEPTH.FX + 3);
  const m = fxCount(14);
  for (let i = 0; i < m; i++) sp.add({ x: Math.round(s.x + (rnd() - 0.5) * s.rx * 1.2), y: Math.round(s.y + (rnd() - 0.5) * 6), vx: (rnd() - 0.5) * 60, vy: -(50 + rnd() * 70), ay: 200, life: 240 + Math.floor(rnd() * 180), shape: 'px', colors: [PAL.white, PAL.mag4, PAL.mag3, PAL.mag2], fadeAt: 1 });
  sp.release();
}

// ================================================================ the swallow (the destroy)

/** What the activate hands its destroy (ctx.play hints). */
export interface ChasmHints {
  /** Where the crack leaves the trap tile (its floor point). */
  from?: XY;
  /** Called with the show time (activate clock) the victim's card will land, or null (no card). */
  onLand?: (t: number | null) => void;
  /** Called on the shut frame (the abyss slams shut): the trap card only lies down after it, at any speed. */
  onShut?: () => void;
  /** The activate's show clock (the victim's landing is reported on it). */
  clock?: { now(): number };
}

/**
 * Yer Yarığı's destroys hook, the v3 look (see the header): crack → the ground cracks → the abyss opens →
 * the fall → the slam → the card from the scar. Resolves when the victim's card has landed on the graveyard.
 */
export async function swallowV3(ctx: DestroyCtx): Promise<void> {
  const ev = ctx.ev;
  if (ev.location !== 'monster') return ctx.base();
  const sc = ctx.scene;
  const field = ctx.views.field;
  const hints = ctx.hints as ChasmHints;
  const clock = showTimer(sc);
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  const gEv = gi >= 0 ? (ctx.events[gi] as EvOf<'toGraveyard'>) : null;
  if (gi >= 0) ctx.consumeAt(gi);
  // where the crack comes from: the trap tile (hint), else the source card's zone
  let from = hints.from;
  if (!from && ev.sourceUid !== null) {
    const loc = ctx.locate(ev.sourceUid);
    if (loc && loc.zone === 'spellTrap') from = zoneXY(loc.player, 'spellTrap', loc.index);
  }
  const { tile, unit } = field.release(ev.uid);
  // (today's victim lean targets the tile's home exactly: chasm_trap.ts:153, :148 before A-5)
  const lean = tile
    ? { x: tile.home.x, y: tile.home.y - 18 }
    : (() => {
        const z = zoneXY(ev.player, 'monster', ev.zone);
        return { x: z.x, y: z.y - 18 };
      })();
  const home = { x: Math.round(lean.x), y: Math.round(lean.y + 18) };
  const u: MonsterUnit | null = live(unit);
  if (unit) unit.badge.setVisible(false);
  if (u) {
    u.posed = true;
    sc.events.emit('v3:dying', u); // (measure keeps logging a unit released from the field)
  }
  const seed = ev.uid * 31 + 7;
  // the abyss as wide as the old one: its half width from the body's own width (setpieces.chasm)
  const bodyW = u && u.sprite.active ? spriteBox(sc, u.sprite).w : 48;
  const shape = abyssShape(home, bodyW, seed);
  const abyss = new AbyssRaster(sc, shape, ABYSS_DEPTH);
  const lights: { strip: BeamHandle | null; hole: LightHandle | null } = { strip: null, hole: null };
  const v3 = !!u && u.has('hitHeavy') && u.has('death');

  // ---- CRACK — `crack`: trap tile → the victim's tile
  let fissure: ReturnType<typeof fissureV3> | null = null;
  if (from) {
    const dir = { x: home.x - from.x, y: home.y - from.y };
    const dl = Math.hypot(dir.x, dir.y) || 1;
    // the crack leaves the trap tile at its edge: the opening's burst still covers the tile itself for
    // the first frames, and the crack must show on the frame after its sound
    const out = footOffset({ x: dir.x / dl, y: dir.y / dl });
    const foot = { x: Math.round(from.x + (dir.x / dl) * out), y: Math.round(from.y + (dir.y / dl) * out) };
    playV3('chasmCrack', { volume: 0.9, pan: panAt((foot.x + home.x) / 2) }); // mark `crack`
    fissure = fissureV3(sc, foot, home, { ms: CRACK_MS, seed: seed + 3, depth: CRACK_DEPTH });
    // the stepped magenta floor strip follows the crack's head (light on the matte pads it crosses)
    lights.strip = lightBeam(sc, foot, foot, PAL.mag3, 0, { air: false, floor: { from: foot, to: foot }, floorWidth: 8, intensity: 0.85, shimmer: 0 });
    const strip = lights.strip;
    void run(sc, CRACK_MS, (t) => {
      const h = lerpXY(foot, home, Math.min(1, t));
      strip.setEnds(foot, h, { from: foot, to: h });
    });
    await wait(sc, CRACK_MS - RADIAL_LEAD);
  } else {
    playV3('chasmCrack', { volume: 0.9, pan: panAt(home.x) }); // mark `crack` (no trap tile on screen)
    await wait(sc, CRACK_MS - RADIAL_LEAD);
  }

  // ---- the ground under the victim cracks; the body flinches
  if (u) {
    if (v3) u.pose('hitHeavy', 0);
    else void u.play('hit', { hold: true });
  }
  lights.hole = lightPool(sc, home.x, home.y, { color: PAL.mag3, spill: PAL.mag2, radius: Math.round(shape.rx * 1.1), floorY: home.y, intensity: 0.2, anim: 'breathe', fadeIn: 0 });
  lights.hole.setIntensity(0.6, RADIAL_MS);
  crackDust(sc, shape, unitDepth(home.y) + 1, seed + 5);
  await run(sc, RADIAL_MS, (t) => abyss.set({ crack: E.outCubic(t) }));
  abyss.set({ crack: 1 });
  void fissure?.cool(600);
  void lights.strip?.fadeOut(300);

  // ---- OPEN — `open`
  void ctx.focus(lean, { zoom: 1.07, ms: 320, pan: 0.36 }); // today's victim lean (chasm_trap.ts:153, :148 before A-5), kept
  playV3('chasmOpen', { volume: 1, pan: panAt(home.x) }); // mark `open`
  const thud = hitSoundFor(u, { kind: 'physical', heavy: true });
  if (thud) playHit(sc, thud, { heavy: true, volume: 0.7, pan: panAt(home.x) });
  else if (u) playV3('impactLight', { volume: 0.45, pan: panAt(home.x) });
  lights.hole.setIntensity(1.45, OPEN_MS);
  void lightFlash(sc, home.x, home.y, PAL.mag3, Math.round(shape.rx * 1.3), 300, { floorY: home.y, ring: true, intensity: 0.9, air: 0 });
  rimBurst(sc, shape, DEPTH.FX + 2, seed + 19);
  // its card under it goes down with the floor: the tile's pixels on a raster over the hole
  let cardRas: Raster | null = null;
  if (tile && tile.active) {
    const cp = tile.currentPixels();
    cardRas = new Raster(sc, cp.x, cp.y, cp.px.w, cp.px.h, ABYSS_DEPTH + 0.5);
    cardRas.pc.blit(cp.px, 0, 0);
    cardRas.end();
    tile.destroy();
  }
  const mask = frontEdgeMask(sc, abyssLip(shape, 0.05));
  const s = u ? u.sprite : null;
  if (u && s) {
    mask.apply(s);
    mask.apply(u.shadow);
  }
  if (cardRas) mask.apply(cardRas.img);
  const sx0 = s ? s.x : 0;
  const sy0 = s ? s.y : 0;
  const openFrames = Math.max(2, Math.round(OPEN_MS / (1000 / 60)));
  await eachFrame(sc, openFrames, (k) => {
    const t = (k + 1) / openFrames;
    const open = E.outBack(t);
    abyss.set({ open });
    mask.update(abyssLip(shape, Math.max(0.05, Math.min(1, open))));
    // the body trembles 1 px and sinks 3 px as the ground gives way (whole pixels)
    if (s && s.active) s.setPosition(sx0 + (k % 4 === 0 ? 1 : k % 4 === 2 ? -1 : 0), sy0 + Math.round(t * 3));
    if (cardRas && cardRas.alive) cardRas.moveTo(cardRas.x, cardRas.y + (k % 3 === 0 ? 1 : 0));
  });
  abyss.set({ open: 1 });
  mask.update(abyssLip(shape, 1));

  // ---- FALL
  playV3('chasmFall', { volume: 0.85, pan: panAt(home.x) });
  const rocks = tumblingRocks(sc, shape, mask, ABYSS_DEPTH + 0.6, seed + 11);
  const bodyH = s && s.active ? spriteBox(sc, s).h : 60;
  const offs = fallOffsets(Math.max(110, Math.round(bodyH) + 40), FALL_FRAMES);
  const y0 = s ? s.y : 0;
  const cy0 = cardRas ? cardRas.y : 0;
  if (u && v3) u.pose('hitHeavy', 1);
  let breath = 0;
  // the lip's lowest line: a body whose top is below it has gone under the floor
  const lipY = shape.y + shape.ry + 2;
  await new Promise<void>((resolve) => {
    let k = 0;
    let goneAt = -1;
    onFrame(sc, (dt) => {
      if (dt <= 0) return true;
      const dy = offs[Math.min(k, offs.length - 1)];
      if (s && s.active) s.setPosition(sx0, Math.round(y0 + dy));
      if (cardRas && cardRas.alive) cardRas.moveTo(cardRas.x, cy0 + Math.min(dy, 40));
      if (u && v3 && k === 6) u.pose('hitHeavy', 2);
      // the deep glow breathes one tone while the body goes down
      if (k % 6 === 0) abyss.set({ breath: (breath = 1 - breath) });
      if (goneAt < 0 && (!s || !s.active || spriteBox(sc, s).top > lipY)) goneAt = k;
      k++;
      if (k >= offs.length || (goneAt >= 0 && k >= goneAt + 2)) {
        resolve();
        return false;
      }
      return true;
    });
  });
  // gone: the body is retired below the lip (never faded), its card raster too
  if (u && s) {
    mask.clear(s);
    mask.clear(u.shadow);
    u.posed = false;
    u.retire();
  }
  if (cardRas) {
    mask.clear(cardRas.img);
    cardRas.destroy();
  }
  await wait(sc, HOLD_MS);

  // ---- SHUT — `shut`
  rocks.kill();
  mask.destroy();
  void lights.hole.fadeOut(SHUT_MS + 60);
  const shutFrames = Math.max(2, Math.round(SHUT_MS / (1000 / 60)));
  await eachFrame(sc, shutFrames, (k) => {
    const t = (k + 1) / shutFrames;
    abyss.set({ open: Math.max(0, 1 - E.inCubic(t)), breath: 0, glow: 3 });
  });
  playV3('chasmShut', { volume: 1, pan: panAt(home.x) }); // mark `shut`
  hints.onShut?.();
  abyss.set({ open: 0, seam: true });
  void slamRing(sc, shape, ABYSS_DEPTH + 0.2);
  slamDust(sc, shape, unitDepth(home.y) + 1, seed + 17);
  void lightFlash(sc, home.x, home.y, PAL.mag4, Math.round(shape.rx * 1.7), 460, { floorY: home.y, ring: true, intensity: 0.9, air: 0 });
  void abyss.tremble(sc, 120);
  await nextFrame(sc);
  abyss.set({ seam: false });
  field.forget(ev.uid);
  if (unit) sc.events.emit('v3:dead', unit);
  // the card is born on the scar and flies to its graveyard; the scar's cracks cool down by steps
  const land = (async () => {
    if (!gEv) {
      hints.onLand?.(null);
      return;
    }
    const top = field.pile(gEv.owner, 'graveyard').topXY();
    const t = hints.clock ? hints.clock.now() : 0;
    // cardLeaves: a 47 ms birth flash, a 50 ms lift, then the arc
    hints.onLand?.(t + 97 + flightMs(Math.hypot(top.x - home.x, top.y - home.y)) + 20);
    await cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from: home });
  })();
  void (async () => {
    for (const g of [2, 1, 0, -1]) {
      await wait(sc, 150);
      abyss.set({ glow: g });
    }
    abyss.destroy();
  })();
  await land;
  clock.stop();
}

// ================================================================ the exit

/**
 * The spent trap leaves (trapExitV3's beats with a landing time): it lies down on its tile, then is born
 * from there into its graveyard flight, landing no earlier than `landAt()` (show ms of `clock`).
 */
async function exitAfter(ctx: ActCtx, op: Opening, clock: { now(): number }, landAt: () => Promise<number | null>): Promise<void> {
  const ev = ctx.ev;
  op.stopAura();
  const gi = ctx.findType('toGraveyard', (e) => e.uid === ev.uid);
  if (gi < 0) return;
  const gEv = ctx.events[gi] as EvOf<'toGraveyard'>;
  ctx.consumeAt(gi);
  const { tile } = ctx.views.field.release(ev.uid);
  const from = tile ? { x: Math.round(tile.home.x), y: Math.round(tile.home.y) } : { x: Math.round(op.at.x), y: Math.round(op.at.y) };
  if (tile && tile.active && tile.standing) await tile.layDown(180);
  const target = await landAt();
  const top = ctx.views.field.pile(gEv.owner, 'graveyard').topXY();
  const fly = 97 + flightMs(Math.hypot(top.x - from.x, top.y - from.y));
  return cardLeaves(ctx, { owner: gEv.owner, cardId: ev.cardId, from, tile: tile && tile.active ? tile : null, delay: exitDelay(clock.now(), fly, target) });
}

// ================================================================ the scene

/** Yer Yarığı's activate hook, the v3 look (see the header). */
export async function chasmV3(ctx: ActCtx): Promise<void> {
  const ev = ctx.ev;
  const sc = ctx.scene;
  const clock = showTimer(sc);
  const runIdx = fx.resolutionRun(ctx);
  const di = runIdx.find((i) => {
    const e = ctx.events[i];
    return e.type === 'destroy' && e.location === 'monster' && e.sourceUid === ev.uid;
  });
  const dEv = di !== undefined ? (ctx.events[di] as EvOf<'destroy'>) : null;
  const trapTile = ev.zone !== null ? ctx.views.field.tileAt(ev.player, 'spellTrap', ev.zone) : null;
  const trapAt = trapTile && trapTile.active ? { x: Math.round(trapTile.home.x), y: Math.round(trapTile.home.y) } : ev.zone !== null ? zoneXY(ev.player, 'spellTrap', ev.zone) : zoneXY(ev.player, 'spellTrap', 1);
  const vAt = dEv ? zoneXY(dEv.player, 'monster', dEv.zone) : trapAt;

  // the victim's card landing (reported by the swallow on this clock), for the trap card's own landing
  let landed!: (t: number | null) => void;
  const victimLand = new Promise<number | null>((r) => (landed = r));
  // the abyss's shut (reported by the swallow): the trap card lies down only after it — at 1× the shut
  // comes at CRACK_AT + SHUT_AFTER, at a higher game speed the frame-stepped beats can push it later
  let shut!: () => void;
  const shutDone = new Promise<void>((r) => (shut = r));
  // ---- the swallow starts with the crack, while the opening is still on
  const swallow = (async () => {
    try {
      await wait(sc, CRACK_AT);
      if (di === undefined || ctx.isConsumed(di)) return;
      const hints: ChasmHints = { from: trapAt, clock, onLand: (t) => landed(t), onShut: () => shut() };
      await ctx.play(di, { ...hints, owned: true });
    } finally {
      // (no-ops when the swallow reported them)
      landed(null);
      shut();
    }
  })();

  // today's opening lean, the same target (chasm_trap.ts:118)
  const op = await trapOpening(ctx, { focus: lerpXY({ x: trapAt.x, y: trapAt.y - 30 }, { x: vAt.x, y: vAt.y - 20 }, 0.35) });

  // ---- EXIT — `exit`: the card lies down once the abyss has shut, and lands ≥ LAND_GAP after the victim's
  const exit = (async () => {
    const lag = CRACK_AT + SHUT_AFTER - clock.now();
    if (lag > 0) await wait(sc, lag);
    await shutDone;
    void ctx.unfocus(320);
    await exitAfter(ctx, op, clock, async () => {
      const t = await victimLand;
      return t === null ? null : t + LAND_GAP;
    });
  })();
  await swallow;
  // anything else of the run (should be nothing) plays in order
  for (const i of runIdx) {
    if (ctx.isConsumed(i)) continue;
    const e = ctx.events[i];
    if (e.type === 'toGraveyard' && e.uid === ev.uid) continue; // the exit
    await ctx.play(i);
  }
  await all([exit, op.banner]);
  clock.stop();
  await fx.playRun(ctx, fx.resolutionRun(ctx));
}
