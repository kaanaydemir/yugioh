// Yer Yarığı — the v3 look (lane A5-A step A-5; docs/v3/A5_PLAN.md §3.4 "çağrılanı yer yutar", right
// after the summon). Behind V3_A5_A only: chasm_trap.ts hands over on the first line of its activate and
// destroys hooks; v1 and the plain v3 look keep the glowing fissure and setpieces.chasm unchanged. No
// registrations here.
//
// Instead of the soft glowing abyss: a sharp crack runs from the trap to the summoned monster's pad, the
// pad breaks into three flat slabs round an ink hole, the body drops into it on whole pixels behind the
// hole's front lip (no fade), the slabs slam back and the card comes out of the scar.
// t = activate, in GAME ms at 1× (the show clock below runs ≈ 67 ms behind: the opening's burst stop
// and the destroy's dispatch frame):
//   0        the trap opening (trapOpeningV3: the card springs up, burst, "TUZAK!"), its lean as today
//            (same target as chasm_trap.ts:118). Its Yer Yarığı accent (hairline floor cracks round the
//            tile) is not drawn under V3_A5_A: the crack's own root is that accent (A5 §3.4: "floorCracks
//            aksanı yarığın başlangıcı olur; ayrı bir vuruş değildir").
//   150      CRACK — `crack`: the destroy plays (the victim's own death hooks step aside, sourceOwnsDeath:
//            its death is the fall). From the trap tile's edge a sharp crack runs to the victim's pad in
//            200 ms: a 1-px ink core, 1-px mag3 lips, the newest pixels mag4, a broken whole-pixel path,
//            three short root spurs at the start, stone pixels kicked up at its head, a stepped magenta
//            floor strip following it. The victim waits in its idle. chasmCrack
//   350      the crack reaches the pad (at the slab cut that faces the trap); the pad's own cracks split it
//            into three slabs (2 frames)
//   ≈ 400    OPEN — `open`: the slabs tilt in (2 steps, 1 frame apart: back slab lighter, front darker,
//            ink sides) round an ink hole with a 1-tone magenta light on its far rim and a lit front lip;
//            the body takes it — v3 art: its hitHeavy struck frame, held 2 frames; old art: its v1 hit —
//            and its card under it goes with the floor. Today's victim lean (chasm_trap.ts:153, :148 before
//            A-5) is called here, same target and options (user decision: the camera does not change).
//            chasmOpen (duck 0.6) + the body's material thud
//   ≈ 450    FALL: the body drops on whole pixels (2, 4, 7, 11, 16, 22, 29, 37 px per frame, one step per
//            rendered frame) behind the hole's front lip — a geometry mask: no fade, no tint; v3 art goes
//            on to hitHeavy f1 / f2 (the footing lost, the wings left behind). Rock bits from the rim
//            tumble in after it, stepped dust puffs rise off the lip. chasmFall
//   750      SHUT — `shut`: the slabs slam back in 2 steps, the seams flash white for one frame, a 2-step
//            dust ring, a 1-px tremble of the pad (local, never the camera). The card is born on the scar
//            (cardLeaves: a 2-frame 1-px white rim) and flies to the graveyard (lands ≈ 1.15 s; measured); the
//            scar steps out (ink → night0 → gone). chasmShut (duck 0.5)
//   then     EXIT — `exit`: the trap card lies down on its tile and leaves for the graveyard from there,
//            landing ≥ 150 ms after the victim's card (≈ 1.35 s); the camera relaxes (ctx.unfocus(320)).
// The slabs are drawn only on the calm pad's matte pixels (view/light/stepped padColorAt): the zone's
// neon inlay and the gap ring stay as they are. Nothing here adds a full-screen flash, a dim, a
// whole-sprite tint or a camera move (A5 §0 K1–K2). Under REDUCED_MOTION particles are halved (fxCount)
// and the pad does not tremble (jitter).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { chasmGeometry, crackPath, paintCrack, type ChasmGeom } from '../../art/spellmotifs-v3';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY, unitDepth, zoneXY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type BeamHandle, type LightHandle } from '../../view/light';
import { padColorAt } from '../../view/light/stepped';
import { wait } from '../../vfx/core';
import { Sparks as PxSparks } from '../../vfx/combat';
import { Raster, onFrame, run } from '../../vfx/setpieces';
import { fx, type CinematicContext } from '../api';
import { type EvOf, all, lerpXY, live } from '../battle/_kit';
import { cardLeaves, flightMs } from '../_v3/card';
import { frontEdgeMask, fxCount, fxRng, jitter, runCrack, type EdgeMask } from '../_v3/spellfx';
import { hitSoundFor, panAt, play as playV3, playHit } from '../_v3/sound';
import { trapOpening, type Opening } from './_opening';

type ActCtx = CinematicContext<EvOf<'activate'>>;
type DestroyCtx = CinematicContext<EvOf<'destroy'>>;

// ================================================================ timing (show-clock ms)

/**
 * The crack leaves the trap tile: activate + 84 show-ms ≈ 150 game-ms at 1× (the opening's 40 ms burst
 * stop — 3 frames — and the destroy's dispatch frame come on top; measured). Keeps "summon handler
 * end → crack" ≤ 300 ms with lane A6-B's fast decision (S-15, ≤ 120 ms).
 */
export const CRACK_AT = 84;
/** The crack's run, trap tile → the victim's pad (A5 §3.4: ≤ 250 ms). */
export const CRACK_MS = 200;
/** The pad's own cracks split it into three slabs (2 frames). */
export const PAD_CRACK_MS = 34;
/** The fall: whole-pixel steps, one per rendered frame (A5 §3.4 DÜŞÜŞ). */
export const FALL_STEPS: readonly number[] = Object.freeze([2, 4, 7, 11, 16, 22, 29, 37]);
/** The slabs slam back this long after the crack left (A5 §3.4: KAPANMA at 750, the crack at 150). */
export const SHUT_AFTER = 600;
/**
 * The running crack's depth: over the trap opening's floor ring (DEPTH.SHADOW − 1), which would hide its
 * first ≈ 20 px for 2–3 frames after the crack sound, and under the shadows and the units.
 */
export const CRACK_DEPTH = DEPTH.SHADOW - 0.5;
/** Two graveyard landings at least this far apart (A5 §3.0 EF-12). */
export const LAND_GAP = 150;

/** The slabs' half sizes: just inside the calm pad's neon inlay (its interior is ≈ 26 × 13). */
export const PAD_HW = 25;
export const PAD_HH = 12;

// ================================================================ pure helpers (tested)

/** Cumulative fall offsets (px), one per rendered frame. */
export function fallOffsets(steps: readonly number[] = FALL_STEPS): number[] {
  let y = 0;
  return steps.map((s) => (y += s));
}

/**
 * Where the crack from `from` enters the pad: the slab cut (A, B or D of chasmGeometry) whose direction
 * from the pad's centre best matches the direction to `from` — the running crack ends on a slab seam,
 * so the pad splits along the line it arrived on.
 */
export function entryCut(g: ChasmGeom, from: XY): XY {
  const C = g.slabs[0][0];
  const dx = from.x - C.x;
  const dy = from.y - C.y;
  const l = Math.hypot(dx, dy) || 1;
  let best = g.cuts[0];
  let bestDot = -Infinity;
  for (const q of g.cuts) {
    const qx = q.x - C.x;
    const qy = q.y - C.y;
    const ql = Math.hypot(qx, qy) || 1;
    const dot = (qx * dx + qy * dy) / (ql * l);
    if (dot > bestDot) {
      bestDot = dot;
      best = q;
    }
  }
  return { x: best.x, y: best.y };
}

/**
 * The front lip a falling body disappears behind: the hole's lower rim (left → right), extended
 * sideways along the floor line far past any body (the kit's lip stops 8 px past the pad, which would
 * clip a wide body's wings while still above the floor).
 */
export function fallLip(g: ChasmGeom, reach = 160): XY[] {
  const pts = g.lip.slice(1, -1);
  const y = g.hole.y;
  return [{ x: g.hole.x - reach, y }, ...pts, { x: g.hole.x + reach, y }];
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

interface PadLook {
  step: 0 | 1 | 2;
  /** The slab cuts growing in from the centre (0…1; step 0 only). */
  crack: number;
  /** The seam frame of the shut: the cuts drawn white. */
  seam?: boolean;
  /** The scar fading after the shut: 0 ink, 1 night0, 2 gone. */
  scar?: 0 | 1 | 2;
  /** The far rim's light this frame (one magenta tone; it breathes while the hole stands open). */
  rim?: number;
  /**
   * The seams' lips (the running crack's look carried into the pad: ink core, 1-px light on its lips),
   * or null for bare cuts (the seam frame, the scar).
   */
  lip?: number | null;
}

/** The hole's half width per opening step, as a share of the slab half width (smaller than the kit's 0.4 / 0.7: the slabs stay readable round it). */
export const HOLE_OPEN: readonly [number, number, number] = [0, 0.36, 0.62];

/** The slabs of chasmGeometry round this scene's hole (see HOLE_OPEN), and its front lip. */
export function padGeom(cx: number, cy: number, step: 0 | 1 | 2, hw = PAD_HW, hh = PAD_HH): ChasmGeom {
  const g = chasmGeometry(cx, cy, hw, hh, step);
  const C = g.slabs[0][0];
  const rx = Math.round(hw * HOLE_OPEN[step]);
  const ry = Math.round(rx / 2);
  const lip: XY[] = [{ x: Math.round(cx) - hw - 8, y: C.y }];
  if (rx > 0)
    for (let i = 0; i <= 12; i++) {
      const an = Math.PI - (i / 12) * Math.PI;
      lip.push({ x: Math.round(C.x + Math.cos(an) * rx), y: Math.round(C.y + Math.sin(an) * ry) });
    }
  lip.push({ x: Math.round(cx) + hw + 8, y: C.y });
  return { ...g, hole: { x: C.x, y: C.y, rx, ry }, lip };
}

/**
 * The pad, open (A5 §3.4 AÇILMA): three flat slabs (back lighter — it tilts toward the light — left
 * mid, front-right darker), ink cuts between them (2 px once pulled apart: the slab's side), the ink
 * hole, its far rim lit by one magenta tone, the back slab's inner lip lit 1 px (night4) and the front
 * lip 1 px (night2) — the edge a body sinks behind. Closed (step 0): only the cuts (the slab faces are
 * the pad's own night1). Local canvas coordinates.
 */
export function paintPadV3(p: PixelCanvas, cx: number, cy: number, look: PadLook): void {
  const g = padGeom(cx, cy, look.step);
  const C = g.slabs[0][0];
  if (look.step > 0) g.slabs.forEach((poly, i) => p.poly(poly.map((q) => [q.x, q.y] as [number, number]), g.faces[i]));
  const k = look.step === 0 ? Math.max(0, Math.min(1, look.crack)) : 1;
  const cut = look.seam ? PAL.white : look.scar === 1 ? PAL.night0 : PAL.ink;
  const lip = look.seam || look.scar ? null : (look.lip ?? null);
  if (k > 0)
    for (const end of g.cuts) {
      const ex = Math.round(C.x + (end.x - C.x) * k);
      const ey = Math.round(C.y + (end.y - C.y) * k);
      if (lip !== null) {
        // the running crack goes on into the pad: an ink core with light pixels on its lips (the newest
        // pixels brightest while the cut still grows)
        const path = crackPath(C, end, 1, 0);
        paintCrack(p, path, Math.round(path.length * k), { light: lip, head: k < 1 ? PAL.mag4 : lip });
      } else p.line(C.x, C.y, ex, ey, cut);
      if (look.step === 2) p.line(C.x, C.y + 1, ex, ey + 1, PAL.ink);
    }
  const { x, y, rx, ry } = g.hole;
  if (rx <= 0) return;
  const er = Math.max(1, ry);
  p.ellipse(x + 0.5, y + 0.5, rx, er, PAL.ink);
  const rim = look.rim ?? (look.step === 2 ? PAL.mag2 : PAL.mag1);
  for (let px = x - rx + 1; px <= x + rx - 1; px++) {
    const dx = (px + 0.5 - (x + 0.5)) / rx;
    if (Math.abs(dx) >= 1) continue;
    const h = er * Math.sqrt(1 - dx * dx);
    const top = Math.ceil(y + 0.5 - h - 0.5);
    const bottom = Math.floor(y + 0.5 + h - 0.5);
    // the far wall catches the trap's light (one tone): a crescent, 2 px deep in the middle once fully
    // open; the back slab's lip above it is lit
    if (p.get(px, top + 1) === PAL.ink) p.set(px, top + 1, rim);
    if (look.step === 2 && Math.abs(dx) < 0.62 && p.get(px, top + 2) === PAL.ink) p.set(px, top + 2, rim);
    const above = p.get(px, top - 1);
    if (above !== null && above !== PAL.ink && Math.abs(dx) < 0.92) p.set(px, top - 1, look.step === 2 ? PAL.night4 : PAL.night3);
    // the front lip
    const below = p.get(px, bottom + 1);
    if (below !== null && below !== PAL.ink && Math.abs(dx) < 0.95) p.set(px, bottom + 1, PAL.night2);
  }
}

/**
 * The victim's pad (A5 §3.4): flat slabs round an ink hole, painted with the kit's chasm motif and
 * finished for the board — the far rim's light one tone up at the full opening (mag2), the front lip
 * lit 1 px (night2) so the edge the body sinks behind reads, the seam / scar tones, and everything kept
 * to the calm pad's matte pixels (the neon inlay and the gap ring are never painted over).
 */
class PadRaster {
  readonly r: Raster;
  private readonly cx: number;
  private readonly cy: number;
  private readonly matte: Uint8Array;
  private look: PadLook = { step: 0, crack: 0 };

  constructor(scene: Phaser.Scene, at: XY, depth: number) {
    this.cx = Math.round(at.x);
    this.cy = Math.round(at.y);
    this.r = new Raster(scene, this.cx - PAD_HW - 2, this.cy - PAD_HH - 2, PAD_HW * 2 + 5, PAD_HH * 2 + 5, depth);
    // the calm pad's matte pixels (fallback: everything, if the board is not the calm arena)
    const { w, h, x, y } = this.r;
    this.matte = new Uint8Array(w * h);
    let n = 0;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ok = padColorAt(x + i, y + j) !== null;
        this.matte[j * w + i] = ok ? 1 : 0;
        if (ok) n++;
      }
    if (n < (w * h) / 4) this.matte.fill(1);
    this.draw();
  }

  get geom(): ChasmGeom {
    return padGeom(this.cx, this.cy, this.look.step);
  }

  set(look: Partial<PadLook>): void {
    this.look = { ...this.look, ...look };
    this.draw();
  }

  private draw(): void {
    const r = this.r;
    if (!r.alive) return;
    const L = this.look;
    r.begin();
    if (L.scar !== 2) paintPadV3(r.pc, this.cx - r.x, this.cy - r.y, L);
    // keep to the matte pad
    const { w, h } = r;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!this.matte[j * w + i]) r.pc.erase(i, j);
    r.end();
  }

  /** The 1-px local tremble of the shut (the pad raster only; off under reduced motion). */
  tremble(scene: Phaser.Scene, ms: number): Promise<void> {
    const r = this.r;
    return jitter(scene, { x: r.x, y: r.y, setPosition: (x: number, y: number) => r.moveTo(x, y) }, ms);
  }

  destroy(): void {
    this.r.destroy();
  }
}

/** Three short root spurs where the crack leaves the trap tile (the accent the opening no longer draws). */
function rootSpurs(scene: Phaser.Scene, at: XY, dir: XY, seed: number): ReturnType<typeof runCrack>[] {
  const rnd = fxRng(seed);
  const base = Math.atan2(dir.y * 2, dir.x); // in floor space (iso y ×2)
  return [-2.2, 2.0, 3.14].map((da, i) => {
    const a = base + da + (rnd() - 0.5) * 0.4;
    const len = 6 + Math.floor(rnd() * 4);
    const to = { x: Math.round(at.x + Math.cos(a) * len), y: Math.round(at.y + (Math.sin(a) * len) / 2) };
    return runCrack(scene, at, to, { ms: 60 + i * 20, seed: seed + i * 7 + 1, light: PAL.mag2, depth: CRACK_DEPTH });
  });
}

/**
 * Rock bits from the hole's far rim that tumble in after the body (whole pixels, masked by the lip).
 * kill() removes what is still falling (the slabs shut over them).
 */
function rockBits(scene: Phaser.Scene, g: ChasmGeom, mask: EdgeMask, depth: number, seed: number): { done: Promise<void>; kill(): void } {
  const rnd = fxRng(seed);
  const n = fxCount(5);
  const { x, y, rx, ry } = g.hole;
  const bits = Array.from({ length: n }, (_, i) => {
    // spread over the far (upper) rim and the sides: the bits break off and drop in
    const an = Math.PI + (i + 0.5) * (Math.PI / n) + (rnd() - 0.5) * 0.3;
    return {
      x0: Math.round(x + Math.cos(an) * (rx - 1)),
      y0: Math.round(y + Math.sin(an) * Math.max(1, ry - 1)),
      delay: 2 + i * 2 + Math.floor(rnd() * 2), // frames after the body starts to fall
      vx: Math.round((x - (x + Math.cos(an) * rx)) / 6),
      c: [PAL.stone2, PAL.stone1, PAL.night3, PAL.stone2, PAL.night2][i % 5],
      big: rnd() < 0.5,
    };
  });
  const ras = new Raster(scene, x - rx - 6, y - ry - 6, rx * 2 + 12, ry * 2 + 90, depth);
  mask.apply(ras.img);
  let f = 0;
  let dead = false;
  const kill = () => {
    if (dead) return;
    dead = true;
    mask.clear(ras.img);
    ras.destroy();
  };
  const done = new Promise<void>((resolve) => {
    onFrame(scene, (dt) => {
      if (dead) {
        resolve();
        return false;
      }
      if (dt > 0) f++;
      ras.begin();
      let live = false;
      for (const b of bits) {
        const k = f - b.delay;
        if (k < 0) {
          live = true;
          ras.px(b.x0, b.y0, b.c);
          continue;
        }
        // whole-pixel gravity steps: 1, 2, 3, 5, 7 … and a sideways drift toward the centre
        const dy = Math.round(0.9 * k * k);
        const px = b.x0 + Math.round(b.vx * Math.min(k, 4) * 0.5);
        const py = b.y0 + dy;
        if (py > y + ry + 40) continue;
        live = true;
        ras.px(px, py, b.c);
        if (b.big) ras.px(px + 1, py, b.c === PAL.stone2 ? PAL.stone1 : PAL.night1);
      }
      ras.end();
      if (!live) {
        kill();
        resolve();
        return false;
      }
      return true;
    });
  });
  return { done, kill };
}

/** Stepped dust puffs rising off the hole's lip (palette steps, no alpha). */
function lipDust(scene: Phaser.Scene, g: ChasmGeom, depth: number, seed: number, n = 6): void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, depth);
  const { x, y, rx, ry } = g.hole;
  const k = fxCount(n);
  for (let i = 0; i < k; i++) {
    const an = (i / k) * Math.PI * 2 + rnd() * 0.5;
    sp.add({
      x: Math.round(x + Math.cos(an) * (rx + 1)),
      y: Math.round(y + Math.sin(an) * (ry + 1)),
      vx: Math.cos(an) * (6 + rnd() * 8),
      vy: -(10 + rnd() * 14),
      drag: 2,
      life: 300 + Math.floor(rnd() * 160),
      delay: Math.floor(rnd() * 60),
      size: 1 + Math.floor(rnd() * 2),
      shape: 'puff',
      colors: [PAL.stone2, PAL.night3, PAL.night2, PAL.night1],
      fadeAt: 1,
    });
  }
  sp.release();
}

/** The floor breaking: stone chips thrown up off the hole's rim at the open, falling back (whole pixels). */
function rimChips(scene: Phaser.Scene, g: ChasmGeom, depth: number, seed: number): void {
  const rnd = fxRng(seed);
  const sp = new PxSparks(scene, depth);
  const { x, y, rx, ry } = g.hole;
  const n = fxCount(8);
  for (let i = 0; i < n; i++) {
    const an = (i / n) * Math.PI * 2 + rnd() * 0.6;
    const ox = Math.cos(an);
    sp.add({
      x: Math.round(x + ox * (rx + 1)),
      y: Math.round(y + Math.sin(an) * (ry + 1)),
      vx: ox * (14 + rnd() * 22),
      vy: -(70 + rnd() * 50),
      ay: 420,
      life: 300 + Math.floor(rnd() * 120),
      size: rnd() < 0.4 ? 2 : 1,
      shape: 'px',
      colors: [PAL.stone3, PAL.stone2, PAL.stone2, PAL.stone1],
      fadeAt: 1,
    });
  }
  sp.release();
}

/** The shut's 2-step dust ring round the pad (an iso ring of dust pixels: stone2 near, night3 out, gone). */
function dustRing(scene: Phaser.Scene, at: XY, depth: number, seed: number): Promise<void> {
  const rnd = fxRng(seed);
  const ras = Raster.around(scene, at.x, at.y, PAD_HW * 2 + 24, PAD_HH * 2 + 14, depth);
  // the two rings' pixels, chosen once (a broken ring of dust grains, stable over its two frames)
  const ring = (rx: number, ry: number, keep: number): XY[] => {
    const out: XY[] = [];
    const n = Math.round(2 * Math.PI * Math.max(rx, ry));
    for (let i = 0; i < n; i++) {
      if (rnd() > keep) continue;
      const an = (i / n) * Math.PI * 2;
      out.push({ x: Math.round(at.x + Math.cos(an) * rx), y: Math.round(at.y + Math.sin(an) * ry) });
    }
    return out;
  };
  const near = ring(PAD_HW + 2, PAD_HH + 1, 0.7);
  const far = ring(PAD_HW + 6, PAD_HH + 3, 0.45);
  let f = 0;
  return new Promise((resolve) => {
    onFrame(scene, (dt) => {
      if (dt > 0) f++;
      ras.begin();
      // two steps of two frames each: near and light, then further out and darker, then gone
      if (f <= 2) for (const q of near) ras.px(q.x, q.y, PAL.stone2);
      else if (f <= 4) for (const q of far) ras.px(q.x, q.y, PAL.night3);
      ras.end();
      if (f > 4) {
        ras.destroy();
        resolve();
        return false;
      }
      return true;
    });
  });
}

// ================================================================ the swallow (the destroy)

/** What the activate hands its destroy (ctx.play hints). */
export interface ChasmHints {
  /** Where the crack leaves the trap tile (its floor point). */
  from?: XY;
  /** Called with the show time (activate clock) the victim's card will land, or null (no card). */
  onLand?: (t: number | null) => void;
  /** The activate's show clock (the victim's landing is reported on it). */
  clock?: { now(): number };
}

/**
 * Yer Yarığı's destroys hook, the v3 look (see the header): crack → open → fall → shut → the card from
 * the scar. Resolves when the victim's card has landed on the graveyard.
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
  const lean = tile ? { x: tile.home.x, y: tile.home.y - 18 } : (() => {
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
  const pad = new PadRaster(sc, home, DEPTH.TILE_FX + 2);
  const g0 = pad.geom;
  const C = g0.slabs[0][0];
  const lights: { strip: BeamHandle | null; hole: LightHandle | null } = { strip: null, hole: null };
  const cracks: ReturnType<typeof runCrack>[] = [];

  // ---- CRACK — `crack`: trap tile → the slab cut that faces it
  const entry = from ? entryCut(g0, from) : null;
  if (from && entry) {
    const dir = { x: entry.x - from.x, y: entry.y - from.y };
    const dl = Math.hypot(dir.x, dir.y) || 1;
    // the crack leaves the trap tile at its edge: the opening's burst still covers the tile itself for
    // the first frames, and the crack must show on the frame after its sound
    const out = footOffset({ x: dir.x / dl, y: dir.y / dl });
    const foot = { x: Math.round(from.x + (dir.x / dl) * out), y: Math.round(from.y + (dir.y / dl) * out) };
    playV3('chasmCrack', { volume: 0.9, pan: panAt((foot.x + home.x) / 2) }); // mark `crack`
    cracks.push(...rootSpurs(sc, foot, { x: dir.x / dl, y: dir.y / dl }, seed));
    const main = runCrack(sc, foot, entry, { ms: CRACK_MS, seed: seed + 3, depth: CRACK_DEPTH });
    cracks.push(main);
    // the stepped magenta floor strip follows the crack's head (light on the matte pads it crosses)
    lights.strip = lightBeam(sc, foot, foot, PAL.mag3, 0, { air: false, floor: { from: foot, to: foot }, floorWidth: 6, intensity: 0.8, shimmer: 0 });
    const strip = lights.strip;
    void run(sc, CRACK_MS, (t) => {
      const h = lerpXY(foot, entry, Math.min(1, t));
      strip.setEnds(foot, h, { from: foot, to: h });
    });
    await main.done;
  } else {
    playV3('chasmCrack', { volume: 0.9, pan: panAt(home.x) }); // mark `crack` (no trap tile on screen)
    await wait(sc, CRACK_MS);
  }
  // the pad's own cracks split it into three slabs
  await run(sc, PAD_CRACK_MS, (t) => pad.set({ crack: Math.min(1, t), lip: PAL.mag3 }));
  pad.set({ crack: 1, lip: PAL.mag3 });

  // ---- OPEN — `open`
  void ctx.focus(lean, { zoom: 1.07, ms: 320, pan: 0.36 }); // today's victim lean (chasm_trap.ts:153, :148 before A-5), kept
  playV3('chasmOpen', { volume: 1, pan: panAt(home.x) }); // mark `open`
  const thud = hitSoundFor(u, { kind: 'physical', heavy: true });
  if (thud) playHit(sc, thud, { heavy: true, volume: 0.7, pan: panAt(home.x) });
  else if (u) playV3('impactLight', { volume: 0.45, pan: panAt(home.x) });
  pad.set({ step: 1 });
  for (const c of cracks) void c.fade(160);
  void lights.strip?.fadeOut(200);
  // the hole's magenta spills one tone onto the pad's rim and the floor round it (stepped light, under
  // the slabs: only the matte pixels outside them show it)
  lights.hole = lightPool(sc, C.x, C.y, { color: PAL.mag3, spill: null, radius: 32, floorY: C.y, intensity: 0.6, air: 0, fadeIn: 0 });
  void lightFlash(sc, C.x, C.y, PAL.mag3, 46, 260, { floorY: C.y, ring: true, intensity: 0.9, air: 0 });
  // the body takes it: v3 art its hitHeavy struck frame, the old art its v1 hit
  const v3 = !!u && u.has('hitHeavy') && u.has('death');
  if (u) {
    if (v3) u.pose('hitHeavy', 0);
    else void u.play('hit', { hold: true });
  }
  // its card under it goes down with the floor: the tile's pixels on a raster, same place and depth
  let cardRas: Raster | null = null;
  if (tile && tile.active) {
    const cp = tile.currentPixels();
    cardRas = new Raster(sc, cp.x, cp.y, cp.px.w, cp.px.h, DEPTH.CARD_ON_TILE);
    cardRas.pc.blit(cp.px, 0, 0);
    cardRas.end();
    tile.destroy();
  }
  await nextFrame(sc);
  pad.set({ step: 2 });
  const g2 = pad.geom;
  lights.hole.setIntensity(1, 40);
  rimChips(sc, g2, unitDepth(g2.hole.y + g2.hole.ry) + 0.6, seed + 19);
  const mask = frontEdgeMask(sc, fallLip(g2));
  const s = u ? u.sprite : null;
  if (u && s) {
    mask.apply(s);
    mask.apply(u.shadow);
  }
  if (cardRas) mask.apply(cardRas.img);
  // the struck pose holds 2 frames on the opening hole (the open frame and this one), then it drops
  await nextFrame(sc);

  // ---- FALL
  playV3('chasmFall', { volume: 0.85, pan: panAt(home.x) });
  const offs = fallOffsets();
  const y0 = s ? s.y : 0;
  const cy0 = cardRas ? cardRas.y : 0;
  const rocks = rockBits(sc, g2, mask, DEPTH.SHADOW + 1, seed + 11);
  lipDust(sc, g2, unitDepth(g2.hole.y + g2.hole.ry) + 0.5, seed + 13);
  if (u && v3) u.pose('hitHeavy', 1);
  await new Promise<void>((resolve) => {
    let k = 0;
    onFrame(sc, (dt) => {
      if (dt <= 0) return true;
      const dy = offs[Math.min(k, offs.length - 1)];
      if (s && s.active) s.setY(Math.round(y0 + dy));
      if (cardRas && cardRas.alive) cardRas.moveTo(cardRas.x, cy0 + Math.min(dy, 40));
      if (u && v3 && k === 3) u.pose('hitHeavy', 2);
      k++;
      if (k >= offs.length) {
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

  // the hole stands open: its far rim breathes one magenta tone (mag2 ↔ mag1, 100 ms) until the shut
  let breathing = true;
  void (async () => {
    let lit = true;
    while (breathing) {
      await wait(sc, 100);
      if (!breathing) break;
      lit = !lit;
      pad.set({ rim: lit ? PAL.mag2 : PAL.mag1, lip: lit ? PAL.mag3 : PAL.mag2 });
    }
  })();

  // ---- SHUT — `shut`
  const lag = SHUT_AFTER - clock.now();
  if (lag > 0) await wait(sc, lag);
  breathing = false;
  rocks.kill();
  mask.destroy();
  void lights.hole?.fadeOut(80);
  pad.set({ step: 1, rim: undefined, lip: PAL.mag2 });
  await nextFrame(sc);
  playV3('chasmShut', { volume: 1, pan: panAt(home.x) }); // mark `shut`
  pad.set({ step: 0, crack: 1, seam: true, lip: null });
  void dustRing(sc, home, DEPTH.SHADOW + 1, seed + 17);
  void pad.tremble(sc, 120);
  await nextFrame(sc);
  pad.set({ seam: false });
  field.forget(ev.uid);
  if (unit) sc.events.emit('v3:dead', unit);
  // the card is born on the scar and flies to its graveyard; the scar steps out behind it
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
    await wait(sc, 260);
    pad.set({ scar: 1 });
    await wait(sc, 120);
    pad.destroy();
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
  // ---- the swallow starts with the crack, while the opening is still on
  const swallow = (async () => {
    await wait(sc, CRACK_AT);
    if (di === undefined || ctx.isConsumed(di)) {
      landed(null);
      return;
    }
    const hints: ChasmHints = { from: trapAt, clock, onLand: (t) => landed(t) };
    await ctx.play(di, { ...hints, owned: true });
    landed(null); // (no-op when the swallow reported its landing)
  })();

  // today's opening lean, the same target (chasm_trap.ts:118)
  const op = await trapOpening(ctx, { focus: lerpXY({ x: trapAt.x, y: trapAt.y - 30 }, { x: vAt.x, y: vAt.y - 20 }, 0.35) });

  // ---- EXIT — `exit`: the card lies down once the slabs have shut, and lands ≥ LAND_GAP after the victim's
  const exit = (async () => {
    const lag = CRACK_AT + SHUT_AFTER - clock.now();
    if (lag > 0) await wait(sc, lag);
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
