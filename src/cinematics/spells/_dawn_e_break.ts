// Şafak Kılıçları (dawn_swords), lane E — the gilded cage's BREAK debris (used only by ./_dawn_e.ts).
//
// When the cage is destroyed early it does not blink out: it comes apart into its real pieces — every bar, rail
// segment, vault hoop and corner post becomes a STICK that is redrawn each frame as a crisp pixel line (Bresenham,
// so a tumbling bar stays a clean 1–3 px line at any angle, never a blurred rotated sprite). The sticks fall with
// gravity, tumble, bounce on the floor (each on its own floor line), lie still for a few frames and then dissolve
// in steps down their gold ramp. The snapped sword halves are sticks too (white / gold4 with their crossguard).
// Everything on scene time, whole pixels, palette tones.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';
import { Raster, onFrame } from '../../vfx/setpieces';

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
  /** Lit and shade tones (the shade line runs beside the lit one: 2-px stock); `w` 1 = a single lit line. */
  lit: number;
  shade: number;
  w: 1 | 2 | 3;
  /** A sword half: a crossguard across it at `guardAt` (0 … 1 from its first end). */
  guardAt?: number;
  /** Start delay (ms) — a piece hangs a moment before it lets go. */
  delay?: number;
}

interface Live extends Stick {
  bounces: number;
  restAt: number;
}

/** Tone steps for the dissolve (each lit tone walks down this ramp, one step per 50 ms). */
const RAMP: number[] = [PAL.white, PAL.gold4, PAL.gold3, PAL.gold2, PAL.gold1, PAL.gold0];
const down = (c: number, k: number): number | null => {
  const i = RAMP.indexOf(c);
  if (i < 0) return k > 0 ? null : c;
  const j = i + k;
  return j >= RAMP.length ? null : RAMP[j];
};

/** A stick from two points (at rest), with an initial kick. */
export function stickOf(a: XY, b: XY, o: Omit<Stick, 'x' | 'y' | 'a' | 'len'>): Stick {
  return { ...o, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, a: Math.atan2(b.y - a.y, b.x - a.x), len: Math.hypot(b.x - a.x, b.y - a.y) };
}

/**
 * Run a debris field: the sticks fall, tumble, bounce and settle; `holdMs` after the last one settles (or at
 * `maxMs`) they dissolve in 4 tone steps. Resolves when every piece is gone. `onBounce(x, y, first)` fires on
 * every floor contact (the clatter sparks / sounds).
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
  let dissolveAt = -1;
  return new Promise<void>((resolve) => {
    let last = 0;
    onFrame(scene, (_dt, el) => {
      if (!ras.alive) {
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
          // the bounce knocks it toward lying flat
          const flat = Math.round(s.a / Math.PI) * Math.PI;
          s.va = (flat - s.a) * 6 + s.va * 0.2;
          if (s.bounces >= 3 || Math.abs(s.vy) < 25) {
            s.restAt = el;
            s.a = s.a + (flat - s.a) * 0.6;
            s.y = s.floor - Math.abs(Math.sin(s.a)) * s.len * 0.5;
          }
        }
      }
      if (dissolveAt < 0 && (moving === 0 || el >= maxMs)) dissolveAt = el + (moving === 0 ? hold : 0);
      const k = dissolveAt >= 0 && el >= dissolveAt ? 1 + Math.floor((el - dissolveAt) / 45) : 0;
      if (k > 3) {
        ras.destroy();
        resolve();
        return false;
      }
      ras.draw((r) => {
        for (const s of live) {
          if (el < (s.delay ?? 0) && s.delay) {
            // still hanging: drawn where it is
          }
          const lit = down(s.lit, k);
          if (lit === null) continue;
          const shade = down(s.shade, k) ?? lit;
          const cx = Math.cos(s.a) * s.len * 0.5;
          const cy = Math.sin(s.a) * s.len * 0.5;
          const x0 = Math.round(s.x - cx);
          const y0 = Math.round(s.y - cy);
          const x1 = Math.round(s.x + cx);
          const y1 = Math.round(s.y + cy);
          const steep = Math.abs(y1 - y0) > Math.abs(x1 - x0);
          // ink first (a 1-px outline around the stock), then the stock
          const span = s.w === 1 ? 1 : s.w === 2 ? 2 : 3;
          for (let i = -1; i <= span; i++) {
            const dx = steep ? i : 0;
            const dy = steep ? 0 : i;
            r.line(x0 + dx, y0 + dy, x1 + dx, y1 + dy, PAL.ink);
          }
          r.line(x0, y0, x1, y1, lit);
          if (span >= 2) r.line(x0 + (steep ? 1 : 0), y0 + (steep ? 0 : 1), x1 + (steep ? 1 : 0), y1 + (steep ? 0 : 1), shade);
          if (span >= 3) r.line(x0 + (steep ? 2 : 0), y0 + (steep ? 0 : 2), x1 + (steep ? 2 : 0), y1 + (steep ? 0 : 2), down(shade, 1) ?? shade);
          if (s.guardAt !== undefined) {
            // the crossguard: a 7-px bar across the blade
            const gx = Math.round(x0 + (x1 - x0) * s.guardAt);
            const gy = Math.round(y0 + (y1 - y0) * s.guardAt);
            const nx = -Math.sin(s.a);
            const ny = Math.cos(s.a);
            const ax = Math.round(gx - nx * 3);
            const ay = Math.round(gy - ny * 3);
            const bx = Math.round(gx + nx * 3);
            const by = Math.round(gy + ny * 3);
            r.line(ax, ay - 1, bx, by - 1, PAL.ink);
            r.line(ax, ay + 1, bx, by + 1, PAL.ink);
            r.line(ax, ay, bx, by, down(PAL.gold4, k) ?? lit);
          }
        }
      });
      return true;
    });
  });
}
