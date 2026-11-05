// Kaya Baltacı — the YARIK set piece (docs/v3/oturum-c-tasarim.md §2.3 "Signature Yarık"): the clean line.
// Every blow of the axe leaves ONE straight light seam in the floor: a 1-px white core with earth4 lips (2 px wide),
// a gold4 pixel only at its running head, never fire, never rune gold, never branching (except the blocked "Y").
//   - it RUNS from the bite toward its end (the target's feet, the guard's front edge, the duelist), whole pixels;
//   - it CLIMBS a body as a vertical light seam drawn only on that body's own opaque pixels (target depth + 1);
//   - it PERSISTS ~1.5 s on the floor: breathing (white ↔ earth4 swap every 200 ms), one gold4 spark running along it
//     from the attacker toward the target, faint crackle ticks, then it fades in three palette steps;
//   - its light is a white-stepped floor strip along the line (EF-6: warm light on the night floor turns to mud).
// Palette steps only (no alpha, no ADD), whole pixels; everything on the scene clock (films stay deterministic).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { monsterFrame } from '../../art/textures';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { DEPTH, type XY } from '../../view/layout';
import { lightBeam, lightFlash, lightPool, type BeamHandle, type LightHandle } from '../../view/light';
import { Px, onFrame } from '../../vfx/combat';
import { play } from '../_v3/sound';

/** Floor-decal depth: over the tile cards, under every unit. */
export const SEAM_DEPTH = DEPTH.CARD_ON_TILE + 3;

/** The seam's tone pairs [core, lip] from full light down to gone (the breathing swaps 0 ↔ 1; the fade 1 → 2 → 3). */
const TONES: readonly (readonly [number, number])[] = [
  [PAL.white, PAL.earth4],
  [PAL.earth4, PAL.earth3],
  [PAL.earth3, PAL.earth2],
  [PAL.earth2, PAL.earth1],
];

/** Whole-pixel points of a straight line a → b (Bresenham), a included. */
export function linePts(a: XY, b: XY): XY[] {
  let x0 = Math.round(a.x);
  let y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  const out: XY[] = [];
  for (let guard = 0; guard < 2000; guard++) {
    out.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
  return out;
}

export interface SeamOpts {
  /** Where the bite starts the seam (floor point). */
  from: XY;
  /** Where it runs to (floor point). */
  to: XY;
  /** Run time from → to (scene ms; the spec: 60). */
  runMs: number;
  /** How long it stays after arriving (scene ms; the spec: 1500 from the blow). */
  persistMs?: number;
  /** The blocked case: it stops at `to` and forks into a tiny "Y", then dies early. */
  fork?: boolean;
  /** Floor light along the line (default true). */
  light?: boolean;
  /** Faint crackle ticks while it breathes (default true). */
  ticks?: boolean;
  /** The gold4 spark running from → to while it persists (default true). */
  spark?: boolean;
  /** A short seam (the summon split, the death) breathes less: the fade starts sooner. */
  quiet?: boolean;
}

/** A running, persisting floor seam. `arrived` resolves when its head reaches `to`. */
export class Seam {
  readonly arrived: Promise<void>;
  private readonly px: Px;
  private readonly pts: XY[];
  private readonly dir: XY;
  private head = 0;
  private gone = false;
  private beam: BeamHandle | null = null;
  private pools: LightHandle[] = [];
  private stopFn: () => void = () => undefined;

  constructor(private readonly scene: Phaser.Scene, private readonly o: SeamOpts) {
    this.px = new Px(scene.add.graphics().setDepth(SEAM_DEPTH));
    this.pts = linePts(o.from, o.to);
    const L = Math.max(1, Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y));
    this.dir = { x: (o.to.x - o.from.x) / L, y: (o.to.y - o.from.y) / L };
    let arrive!: () => void;
    this.arrived = new Promise<void>((r) => (arrive = r));
    const n = this.pts.length;
    const persist = o.persistMs ?? 1500;
    const fadeStep = o.quiet ? 120 : 160;
    // the fade: 3 palette steps at the end of the persist
    const fadeAt = Math.max(o.runMs + 120, persist - fadeStep * 3);
    let arrivedAt = -1;
    let lastTick = -1;
    if (o.light !== false) {
      this.beam = lightBeam(scene, o.from, o.from, PAL.white, 0, { air: false, floor: { from: o.from, to: o.from }, floorWidth: 13, intensity: 0, shimmer: 0 });
      this.beam.setIntensity(2.4, Math.max(40, o.runMs));
    }
    this.stopFn = onFrame(
      scene,
      (_dt, el) => {
        if (this.gone) return false;
        // ---- the run
        if (this.head < n) {
          const k = o.runMs <= 0 ? 1 : Math.min(1, el / o.runMs);
          this.head = Math.max(1, Math.round(k * n));
          const hp = this.pts[Math.min(n - 1, this.head - 1)];
          this.beam?.setEnds(o.from, hp, { from: o.from, to: hp });
          if (this.head >= n) {
            arrivedAt = el;
            arrive();
            // the floor pool along the line: white stepped pools strung on it (the light layer's own steps), so the
            // floor beside the crack reads lit at 1× (EF-6: white, never warm)
            if (o.light !== false) {
              const L = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
              const k = Math.max(1, Math.round(L / 14));
              for (let i = 0; i < k; i++) {
                const t = (i + 0.5) / k;
                const x = Math.round(o.from.x + (o.to.x - o.from.x) * t);
                const y = Math.round(o.from.y + (o.to.y - o.from.y) * t);
                const lp = lightPool(scene, x, y, { color: PAL.white, radius: 11, floorY: y, air: 0, intensity: 0, anim: 'steady', fadeIn: 0 });
                lp.setIntensity(1.1, 60);
                this.pools.push(lp);
              }
            }
          }
        }
        // ---- the tone: full while running, then breathing every 200 ms, then 3 fade steps
        let tone = 0;
        if (arrivedAt >= 0) {
          const since = el - arrivedAt;
          if (el >= fadeAt) {
            const st = 1 + Math.floor((el - fadeAt) / fadeStep);
            if (st > 3) return false;
            tone = st;
            if (st === 1 && this.beam) {
              void this.beam.fadeOut(fadeStep * 2);
              this.beam = null;
            }
            if (st === 1 && this.pools.length) {
              for (const lp of this.pools) void lp.fadeOut(fadeStep * 2);
              this.pools = [];
            }
          } else tone = Math.floor(since / 200) % 2 === 1 ? 1 : 0;
          // faint crackle ticks, one on each breathing swap (every 200 ms, at most four), then a dry "tik" as it fades
          if (o.ticks !== false) {
            const tk = el >= fadeAt ? 99 : Math.floor(since / 200);
            if (tk !== lastTick && tk >= 1 && (tk <= 4 || tk === 99)) {
              lastTick = tk;
              if (tk === 99) play('caxSeamTik', { volume: 0.6 });
              else play('caxSeamTick', { volume: 0.5, pitch: 1 + (tk % 2) * 0.06 });
            }
          }
        }
        this.draw(tone, el, arrivedAt, fadeAt);
        return true;
      },
      () => this.dispose(),
    );
    if (o.fork) void this.arrived.then(() => undefined);
  }

  /** The crack's 1-px jog (perpendicular, every 7 px, alternating): one straight line overall, never branching. */
  private jog(i: number): number {
    return Math.floor(i / 7) % 2 === 1 ? 1 : 0;
  }

  private draw(tone: number, el: number, arrivedAt: number, fadeAt: number): void {
    const px = this.px.clear();
    const [core, lip] = TONES[tone];
    const n = Math.min(this.head, this.pts.length);
    // a CRACK, not a stick: night0 ink lips either side (they also cover whatever floor marking lies under it), the
    // earth4 lips lit from inside, the white core; a 1-px jog every 7 px (the joints of the rock), filled at each step
    const edge = tone >= 3 ? PAL.night1 : PAL.night0;
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const y = p.y + this.jog(i);
      px.dot(p.x, y - 2, edge).dot(p.x, y + 2, edge);
      if (i > 0 && this.jog(i) !== this.jog(i - 1)) px.dot(p.x, y - 3 + (this.jog(i) ? 0 : 1) * 2, edge);
    }
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const y = p.y + this.jog(i);
      px.dot(p.x, y - 1, lip).dot(p.x, y + 1, lip);
    }
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const y = p.y + this.jog(i);
      px.dot(p.x, y, core);
      // the jog's riser: the core steps one row, its corner stays lit
      if (i > 0 && this.jog(i) !== this.jog(i - 1)) px.dot(p.x, p.y + this.jog(i - 1), core);
    }
    // the running head: gold4, a 1-px white flare just ahead
    if (n < this.pts.length) {
      const h = this.pts[n - 1];
      px.dot(h.x, h.y + this.jog(n - 1), PAL.gold4);
      const a = this.pts[Math.min(this.pts.length - 1, n)];
      px.dot(a.x, a.y + this.jog(n), PAL.white);
    } else if (this.o.fork && arrivedAt >= 0) {
      // blocked: a "Y" at the guard's front edge — a white flash at the split (one frame), then two 3–4 px prongs
      // splayed across the line that die in two palette steps, faster than the seam
      const e = this.pts[this.pts.length - 1];
      const ey = e.y + this.jog(this.pts.length - 1);
      const since = el - arrivedAt;
      const st = since < 140 ? 0 : since < 260 ? 1 : since < 360 ? 2 : 3;
      if (since < 40) px.dot(e.x - 1, ey, PAL.white).dot(e.x + 1, ey, PAL.white).dot(e.x, ey - 1, PAL.white).dot(e.x, ey + 1, PAL.white);
      if (st < 3) {
        const [pc, pl] = TONES[Math.min(3, st + (st > 0 ? 1 : 0))];
        const nx = -this.dir.y;
        const ny = this.dir.x;
        for (const sd of [1, -1])
          for (let k = 1; k <= 4; k++) {
            const x = Math.round(e.x + this.dir.x * k * 0.7 + nx * sd * k * 0.9);
            const y = Math.round(ey + this.dir.y * k * 0.7 + ny * sd * k * 0.9);
            px.dot(x, y + 1, edge);
            px.dot(x, y, k <= 2 ? pc : pl);
          }
      }
    }
    // the spark: one gold4 pixel running from the attacker toward the target along the breathing seam
    if (this.o.spark !== false && arrivedAt >= 0 && el < fadeAt) {
      const T0 = arrivedAt + 260;
      const T1 = Math.min(fadeAt - 40, T0 + 620);
      if (el >= T0 && el <= T1) {
        const i = Math.round(((el - T0) / Math.max(1, T1 - T0)) * (this.pts.length - 1));
        const p = this.pts[i];
        px.dot(p.x, p.y + this.jog(i), PAL.gold4);
        if (i + 1 < this.pts.length) px.dot(this.pts[i + 1].x, this.pts[i + 1].y + this.jog(i + 1), PAL.white);
      }
    }
  }

  /** Cut it now (the screen leaves the duel). */
  close(): void {
    this.gone = true;
    this.stopFn();
  }

  private dispose(): void {
    this.gone = true;
    if (this.beam) void this.beam.fadeOut(120);
    this.beam = null;
    for (const lp of this.pools) void lp.fadeOut(120);
    this.pools = [];
    if (this.px.g.active) this.px.g.destroy();
  }
}

/**
 * The seam CLIMBS a body: a vertical 1-px light line drawn only on the body's own opaque pixels at column `x` (world),
 * white core with earth4 lips one px either side, from the feet up to `k` (0…1) of its height. Re-reads the frame the
 * unit shows every frame (it recoils under it). `frames` scene ms per climb step; resolves when it reached the crown;
 * the line then holds `holdMs` and steps out (white → earth4 → gone).
 */
export function climbBody(scene: Phaser.Scene, u: MonsterUnit, o: { stepMs: number; holdMs: number; steps?: number }): { top: Promise<void>; done: Promise<void> } {
  const g = new Px(scene.add.graphics().setDepth(u.sprite.depth + 1));
  const steps = o.steps ?? 2;
  const ax = u.art.anchorX;
  let reached!: () => void;
  const top = new Promise<void>((r) => (reached = r));
  let finished!: () => void;
  const done = new Promise<void>((r) => (finished = r));
  let topAt = -1;
  onFrame(
    scene,
    (_dt, el) => {
      g.clear();
      if (!u.sprite.active || !u.sprite.visible) {
        reached();
        return false;
      }
      g.g.setDepth(u.sprite.depth + 1);
      const k = Math.min(1, (Math.floor(el / Math.max(1, o.stepMs)) + 1) / steps);
      if (k >= 1 && topAt < 0) {
        topAt = el;
        reached();
      }
      let core: number = PAL.white;
      let lip: number = PAL.earth4;
      if (topAt >= 0) {
        const since = el - topAt;
        if (since > o.holdMs + 70) return false;
        if (since > o.holdMs) {
          core = PAL.earth4;
          lip = PAL.earth3;
        }
      }
      const fi = u.frameInfo();
      let pc;
      try {
        pc = monsterFrame(u.cardId, fi.anim ?? 'idle', fi.frame);
      } catch {
        return false;
      }
      const b = pc.bounds();
      if (!b) return true;
      const kk = k >= 1 ? 1 : 0.55;
      const wide = k >= 1;
      const yTop = Math.round(b.y + b.h - b.h * kk);
      for (let fy = b.y + b.h - 1; fy >= yTop; fy--) {
        if (!pc.isOpaque(ax, fy)) continue;
        const p = u.framePoint(ax + 0.5, fy + 0.5);
        const x = Math.floor(p.x);
        const y = Math.floor(p.y);
        // frame A: a 1-px white line; frame B on: light pouring out — the white core with earth4 lips on every row
        if (wide) {
          if (pc.isOpaque(ax - 1, fy)) g.dot(x - 1, y, lip);
          if (pc.isOpaque(ax + 1, fy)) g.dot(x + 1, y, lip);
        }
        g.dot(x, y, core);
      }
      return true;
    },
    () => {
      if (g.g.active) g.g.destroy();
      reached();
      finished();
    },
  );
  return { top, done };
}

/** The vertical light seam over a point that is not a unit (the duelist): a line `h` px up from `foot`, 2 steps. */
export function climbLine(scene: Phaser.Scene, foot: XY, h: number, o: { stepMs: number; holdMs: number; depth: number }): Promise<void> {
  const g = new Px(scene.add.graphics().setDepth(o.depth));
  const x = Math.round(foot.x);
  const y0 = Math.round(foot.y);
  void lightFlash(scene, x, y0 - Math.round(h / 2), PAL.white, 18, 260, { floorY: y0, intensity: 0.7 });
  return new Promise<void>((resolve) => {
    onFrame(
      scene,
      (_dt, el) => {
        g.clear();
        const k = Math.min(1, (Math.floor(el / Math.max(1, o.stepMs)) + 1) / 2);
        const reachedAt = o.stepMs * 2;
        const hold = el - reachedAt;
        if (hold > o.holdMs + 70) return false;
        const out = hold > o.holdMs;
        const len = Math.round(h * k);
        g.rect(x - 1, y0 - len, 1, len, out ? PAL.earth3 : PAL.earth4).rect(x + 1, y0 - len, 1, len, out ? PAL.earth3 : PAL.earth4).rect(x, y0 - len, 1, len, out ? PAL.earth4 : PAL.white);
        return true;
      },
      () => {
        if (g.g.active) g.g.destroy();
        resolve();
      },
    );
  });
}
