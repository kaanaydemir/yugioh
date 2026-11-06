// Şafak Kılıçları (dawn_swords), lane E — the gilded cage's BREAK debris (used only by ./_dawn_e.ts).
//
// When the cage is destroyed early it does not blink out: it comes apart into its real pieces — every bar, rail
// segment, vault hoop and corner post becomes a STICK that is redrawn each frame as a crisp pixel line (Bresenham,
// so a tumbling bar stays a clean 1–3 px line at any angle, never a blurred rotated sprite). The sticks fall with
// gravity, tumble, bounce on the floor (each on its own floor line), lie still for a few frames and then dissolve
// in steps (gold → stone, never brown straw). The snapped sword halves are drawn as SWORDS (steel blade, guard, pommel).
// Everything on scene time, whole pixels, palette tones.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';
import { Raster, Sparks, onFrame } from '../../vfx/setpieces';

export interface Stick {
  /** Centre, angle (rad, 0 = horizontal), length. */
  x: number;
  y: number;
  a: number;
  len: number;
  vx: number;
  vy: number;
  va: number;
  /** The floor line this piece lands on (screen y). */
  floor: number;
  /** Lit and shade tones (the shade line runs beside the lit one); `w` 1 = a single lit line, 3 = lit|shade|dark. */
  lit: number;
  shade: number;
  w: 1 | 2 | 3;
  /** A sword half: its crossguard at `guardAt` (0 … 1 from its first end). */
  guardAt?: number;
  /** A sword piece drawn as a SWORD (round 3): 'top' = the upper half (jagged snap end first, the steel blade, the
   *  gilded guard at guardAt, the grip, the pommel at the far end); 'tip' = the planted stub (its point first). */
  sword?: 'top' | 'tip';
  /** Start delay (ms) — a piece hangs a moment before it lets go. */
  delay?: number;
}

interface Live extends Stick {
  bounces: number;
  restAt: number;
}

/**
 * The dissolve (round 3): gilded iron cools through gold3 → gold1 → stone, never to brown straw; steel through
 * mist → steel → night. Step k (1 … 3) of a tone; null = gone.
 */
const STEEL = new Set<number>([PAL.white, PAL.mist, PAL.steel, PAL.night4]);
function cool(c: number, k: number, lit: boolean): number | null {
  if (k <= 0) return c;
  if (k > 3) return null;
  if (STEEL.has(c)) return lit ? [PAL.mist, PAL.steel, PAL.night3][k - 1] : [PAL.steel, PAL.night3, PAL.night2][k - 1];
  return lit ? [PAL.gold3, PAL.gold1, PAL.stone2][k - 1] : [PAL.gold2, PAL.stone1, PAL.stone1][k - 1];
}

/** The floor's iso lines (rad): a piece at rest lies flat along one of them (never standing up on a monster). */
const ISO = Math.atan2(1, 2);
function restAngle(a: number): number {
  const m = ((a % Math.PI) + Math.PI) % Math.PI;
  let best = 0;
  // flat, or along the rail (the column axis) — never across the row, which would reach into the lanes behind
  for (const c of [0, ISO, ISO, Math.PI]) if (Math.abs(m - c) < Math.abs(m - best)) best = c;
  return a - m + best;
}

/** A stick from two points (at rest), with an initial kick. */
export function stickOf(a: XY, b: XY, o: Omit<Stick, 'x' | 'y' | 'a' | 'len'>): Stick {
  return { ...o, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a: Math.atan2(b.y - a.y, b.x - a.x), len: Math.hypot(b.x - a.x, b.y - a.y) };
}

type Px = { px(x: number, y: number, c: number): void; line(x0: number, y0: number, x1: number, y1: number, c: number): void };

/** A thick line: `tones` side by side (offset across the line's minor axis), ink on both sides. */
function band(r: Px, x0: number, y0: number, x1: number, y1: number, tones: readonly number[]): void {
  const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
  const o0 = -Math.floor((tones.length - 1) / 2);
  for (const i of [o0 - 1, o0 + tones.length]) r.line(x0 + (steep ? i : 0), y0 + (steep ? 0 : i), x1 + (steep ? i : 0), y1 + (steep ? 0 : i), PAL.ink);
  tones.forEach((c, j) => {
    const i = o0 + j;
    r.line(x0 + (steep ? i : 0), y0 + (steep ? 0 : i), x1 + (steep ? i : 0), y1 + (steep ? 0 : i), c);
  });
}

/** A sword piece: the steel blade (3 px, tapering to a point on a 'tip'), the gilded guard, grip and pommel on a 'top'. */
function drawSword(r: Px, s: Live, k: number): void {
  const ux = Math.cos(s.a);
  const uy = Math.sin(s.a);
  const x0 = s.x - ux * s.len * 0.5;
  const y0 = s.y - uy * s.len * 0.5;
  const at = (d: number) => ({ x: Math.round(x0 + ux * d), y: Math.round(y0 + uy * d) });
  const edge = cool(PAL.white, k, true) ?? PAL.night2;
  const core = cool(PAL.mist, k, true) ?? PAL.night2;
  const back = cool(PAL.steel, k, false) ?? PAL.night2;
  const gold = cool(PAL.gold4, k, true) ?? PAL.stone1;
  const goldD = cool(PAL.gold2, k, false) ?? PAL.stone1;
  const L = s.len;
  if (s.sword === 'tip') {
    // the point (first 4 px: 1 px), then the full 3-px blade up to the jagged snap
    const p0 = at(0);
    const p1 = at(4);
    const p2 = at(L);
    band(r, p1.x, p1.y, p2.x, p2.y, [edge, core, back]);
    band(r, p0.x, p0.y, p1.x, p1.y, [edge]);
    r.px(p2.x, p2.y, PAL.white);
    return;
  }
  const gd = L * (s.guardAt ?? 0.62);
  const a = at(0);
  const gp = at(gd);
  const e = at(L);
  band(r, a.x, a.y, gp.x, gp.y, [edge, core, back]);
  r.px(a.x, a.y, PAL.white);
  // the grip, then the pommel
  band(r, gp.x, gp.y, e.x, e.y, [goldD]);
  r.px(e.x, e.y, gold);
  r.px(e.x + 1, e.y, goldD);
  r.px(e.x, e.y + 1, goldD);
  // the crossguard across the blade (9 px)
  const nx = -uy;
  const ny = ux;
  const ga = { x: Math.round(gp.x - nx * 4), y: Math.round(gp.y - ny * 4) };
  const gb = { x: Math.round(gp.x + nx * 4), y: Math.round(gp.y + ny * 4) };
  band(r, ga.x, ga.y, gb.x, gb.y, [gold, goldD]);
}

/**
 * Run a debris field: the sticks fall, tumble, bounce and settle FLAT on the floor's iso lines; `holdMs` after the
 * last one settles (or at `maxMs`) they cool in 3 tone steps (gold → stone, steel → night) while a light mote rises
 * off each piece, then go. Resolves when every piece is gone. `onBounce(x, y, first)` fires on every floor contact.
 */
export function debris(
  scene: Phaser.Scene,
  sticks: readonly Stick[],
  o: { depth: number; box: { x: number; y: number; w: number; h: number }; gravity?: number; holdMs?: number; maxMs?: number; onBounce?: (x: number, y: number, first: boolean) => void },
): Promise<void> {
  const G = o.gravity ?? 900;
  const hold = o.holdMs ?? 100;
  const maxMs = o.maxMs ?? 620;
  const live: Live[] = sticks.map((s) => ({ ...s, bounces: 0, restAt: -1 }));
  const ras = new Raster(scene, o.box.x, o.box.y, o.box.w, o.box.h, o.depth);
  const motes = new Sparks(scene, o.depth + 0.01);
  let motesOut = false;
  let dissolveAt = -1;
  return new Promise<void>((resolve) => {
    let last = 0;
    onFrame(scene, (_dt, el) => {
      if (!ras.alive) {
        motes.close();
        resolve();
        return false;
      }
      const dt = Math.min(0.05, Math.max(0, (el - last) / 1000));
      last = el;
      let moving = 0;
      for (const s of live) {
        if (el < (s.delay ?? 0)) {
          moving++;
          continue;
        }
        if (s.restAt >= 0) continue;
        moving++;
        s.vy += G * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.a += s.va * dt;
        // the lowest end against the floor
        const hy = Math.abs(Math.sin(s.a)) * s.len * 0.5;
        if (s.y + hy >= s.floor && s.vy > 0) {
          s.y = s.floor - hy;
          o.onBounce?.(Math.round(s.x), Math.round(s.floor), s.bounces === 0);
          s.bounces++;
          s.vy = -s.vy * (s.bounces === 1 ? 0.32 : 0.18);
          s.vx *= 0.55;
          // the bounce knocks it toward lying flat on the floor's iso line
          const flat = restAngle(s.a);
          s.va = (flat - s.a) * 7 + s.va * 0.2;
          if (s.bounces >= 3 || Math.abs(s.vy) < 25) {
            s.restAt = el;
            s.a = flat;
            s.y = s.floor - Math.abs(Math.sin(s.a)) * s.len * 0.5;
          }
        }
      }
      if (dissolveAt < 0 && (moving === 0 || el >= maxMs)) dissolveAt = el + (moving === 0 ? hold : 0);
      const k = dissolveAt >= 0 && el >= dissolveAt ? 1 + Math.floor((el - dissolveAt) / 50) : 0;
      if (k >= 1 && !motesOut) {
        // the pieces sink into the floor in light: a mote rises off each
        motesOut = true;
        for (const s of live) motes.add({ x: Math.round(s.x + 0), y: Math.round(s.y) - 1, vy: -14 - (s.len % 7) * 2, life: 360 + (s.len % 5) * 40, ramp: [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2], fade: 0.45 });
      }
      if (k > 3) {
        ras.destroy();
        motes.close();
        resolve();
        return false;
      }
      ras.draw((r) => {
        for (const s of live) {
          if (s.sword) {
            drawSword(r, s, k);
            continue;
          }
          const lit = cool(s.lit, k, true);
          if (lit === null) continue;
          const shade = cool(s.shade, k, false) ?? lit;
          const cx = Math.cos(s.a) * s.len * 0.5;
          const cy = Math.sin(s.a) * s.len * 0.5;
          const x0 = Math.round(s.x - cx);
          const y0 = Math.round(s.y - cy);
          const x1 = Math.round(s.x + cx);
          const y1 = Math.round(s.y + cy);
          const tones = s.w === 1 ? [lit] : s.w === 2 ? [lit, shade] : [lit, shade, cool(PAL.gold1, k, false) ?? shade];
          band(r, x0, y0, x1, y1, tones);
        }
      });
      return true;
    });
  });
}
