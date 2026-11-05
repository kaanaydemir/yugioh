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

/**
 * The seam's tones [core, far (lit) lip, near (shaded) lip] from full light down to gone (the breathing swaps 0 ↔ 1;
 * the fade 1 → 2 → 3).
 */
const TONES: readonly (readonly [number, number, number])[] = [
  [PAL.white, PAL.earth4, PAL.earth2],
  [PAL.earth4, PAL.earth3, PAL.earth2],
  [PAL.earth3, PAL.earth2, PAL.earth1],
  [PAL.earth2, PAL.earth1, PAL.earth0],
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
  /** The target's toes on the line (floor point): `reached` resolves when the head gets there (default: `to`). */
  feet?: XY;
  /** Run time from → feet (scene ms), shown in `chunks` visible steps (default 3: three frames of a head on the floor). */
  runMs: number;
  /** Run time feet → to (scene ms, under the body; default 40). */
  tailMs?: number;
  chunks?: number;
  /** Points of the line already open at the start (hidden under the buried blade): the chunks share out the rest. */
  lead?: number;
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
  /** No drawn floor pool beside the crack (the summon's short split seam). */
  noPool?: boolean;
}

/** The floor light's levels (stepped light: 2 = two tones up at the core, night1 → night3; 1 = one tone). */
const BEAM_FULL = 2;
const BEAM_BREATH = 1.25;

/** A running, persisting floor seam. `reached` resolves when its head reaches the toes, `arrived` at `to`. */
export class Seam {
  readonly arrived: Promise<void>;
  readonly reached: Promise<void>;
  private readonly px: Px;
  private readonly pts: XY[];
  private readonly offs: number[];
  private readonly dir: XY;
  private head = 0;
  /** the head index of the previous drawn frame (the pixels past it are this frame's fresh run: they flare white) */
  private prevHead = 0;
  private gone = false;
  private beam: BeamHandle | null = null;
  private pools: LightHandle[] = [];
  private stopFn: () => void = () => undefined;

  constructor(private readonly scene: Phaser.Scene, private readonly o: SeamOpts) {
    this.px = new Px(scene.add.graphics().setDepth(SEAM_DEPTH));
    this.pts = linePts(o.from, o.to);
    this.offs = jogs(this.pts.length, Math.round(o.from.x * 7 + o.from.y * 3));
    const L = Math.max(1, Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y));
    this.dir = { x: (o.to.x - o.from.x) / L, y: (o.to.y - o.from.y) / L };
    let arrive!: () => void;
    this.arrived = new Promise<void>((r) => (arrive = r));
    let reach!: () => void;
    this.reached = new Promise<void>((r) => (reach = r));
    const n = this.pts.length;
    // the toes' index on the line (the visible floor run ends there)
    let nf = n;
    if (o.feet) {
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(this.pts[i].x - o.feet.x, this.pts[i].y - o.feet.y);
        if (d < best) {
          best = d;
          nf = i + 1;
        }
      }
    }
    const chunks = Math.max(1, o.chunks ?? 3);
    const tailMs = o.tailMs ?? 40;
    const persist = o.persistMs ?? 1500;
    const fadeStep = o.quiet ? 120 : 160;
    // the fade: 3 palette steps at the end of the persist
    const fadeAt = Math.max(o.runMs + tailMs + 120, persist - fadeStep * 3);
    let arrivedAt = -1;
    let reachedYet = false;
    let lastTick = -1;
    let lastBreath = -1;
    if (o.light !== false) {
      this.beam = lightBeam(scene, o.from, o.from, PAL.white, 0, { air: false, floor: { from: o.from, to: o.from }, floorWidth: 30, intensity: 0, shimmer: 0 });
      this.beam.setIntensity(BEAM_FULL, 30);
    }
    this.stopFn = onFrame(
      scene,
      (_dt, el) => {
        if (this.gone) return false;
        // ---- the run: `chunks` whole steps from the bite to the toes (each held ~25 ms: the head is SEEN moving on
        // the floor), then on under the body to its end
        if (this.head < n) {
          let h: number;
          const lead = Math.min(nf - 1, Math.max(0, o.lead ?? 0));
          if (el < o.runMs) h = lead + Math.round((Math.min(chunks, Math.floor((el / Math.max(1, o.runMs)) * chunks) + 1) / chunks) * (nf - lead));
          else h = nf + Math.round(Math.min(1, (el - o.runMs) / Math.max(1, tailMs)) * (n - nf));
          this.head = Math.max(1, Math.min(n, h));
          if (!reachedYet && this.head >= nf) {
            reachedYet = true;
            reach();
          }
          const hp = this.pts[Math.min(n - 1, this.head - 1)];
          this.beam?.setEnds(o.from, hp, { from: o.from, to: hp });
          if (this.head >= n) {
            arrivedAt = el;
            arrive();
            // the floor pool along the line: white stepped pools strung on it (the light layer's own steps), so the
            // floor beside the crack reads lit at 1× (EF-6: white, never warm)
            if (o.light !== false) {
              const Ln = Math.hypot(o.to.x - o.from.x, o.to.y - o.from.y);
              const k = Math.max(1, Math.round(Ln / 16));
              for (let i = 0; i < k; i++) {
                const t = (i + 0.5) / k;
                const x = Math.round(o.from.x + (o.to.x - o.from.x) * t);
                const y = Math.round(o.from.y + (o.to.y - o.from.y) * t);
                const lp = lightPool(scene, x, y, { color: PAL.white, radius: 15, floorY: y, air: 0, intensity: 0, anim: 'steady', fadeIn: 0 });
                lp.setIntensity(1.6, 40);
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
          } else {
            const br = Math.floor(since / 200) % 2;
            tone = br === 1 ? 1 : 0;
            // the floor light breathes with the crack (two tones ↔ one and a quarter)
            if (br !== lastBreath) {
              lastBreath = br;
              this.beam?.setIntensity(br ? BEAM_BREATH : BEAM_FULL, 40);
              for (const lp of this.pools) lp.setIntensity(br ? 1 : 1.6, 40);
            }
          }
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
        this.prevHead = this.head;
        return true;
      },
      () => this.dispose(),
    );
  }

  private draw(tone: number, el: number, arrivedAt: number, fadeAt: number): void {
    const px = this.px.clear();
    const [core, lipHi, lipLo] = TONES[tone];
    const N = this.pts.length;
    const n = Math.min(this.head, N);
    // a CRACK SUNK INTO THE FLOOR, not a rod lying on it: from the top, the far wall lit (lipHi), a night0 gap, the white
    // core deep inside, a night0 gap, the near lip in shade (lipLo); a 1-px jog every 8–12 px (the joints of the rock),
    // the far end tapering to the bare core. The pixels the head ran over THIS frame flare white across the crack.
    const gap = tone >= 3 ? PAL.night1 : PAL.night0;
    const rim = PAL.night1;
    const running = n < N;
    const y = (i: number) => this.pts[i].y + this.offs[i];
    // the light it pours on the floor beside it: a stepped, dithered stone2 / stone3 pool hugging the crack (the floor's
    // own light layer cannot light every arena's floor; white light on the night floor steps through the cool greys),
    // breathing with the core and gone once it fades
    if (tone <= 1 && !this.o.noPool) {
      for (let i = 0; i < n; i++) {
        const p = this.pts[i];
        const yy = y(i);
        const tail = N - 1 - i;
        if (tail < 4 || i < 2) continue;
        // the core band: one row each side, a 2×2 ordered dither (stone3 at full light, stone2 as it breathes); a
        // sparser stone2 row beyond it at full light only
        const near = (p.x + yy) % 2 === 0;
        const far = tone === 0 && (p.x + 2 * yy) % 4 === 0;
        const c = tone === 0 ? PAL.stone3 : PAL.stone2;
        if (near) px.dot(p.x, yy - 3, c).dot(p.x, yy + 3, c);
        else if (tone === 0) px.dot(p.x, yy - 3, PAL.stone2).dot(p.x, yy + 3, PAL.stone2);
        if (far) px.dot(p.x, yy - 4, PAL.stone2).dot(p.x, yy + 4, PAL.stone2);
      }
    }
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const yy = y(i);
      const tail = N - 1 - i; // px to the far end
      const fresh = running && i >= this.prevHead;
      const wide = tail >= 6;
      // top → bottom: the far edge (a night1 rim where the floor breaks), the far wall lit from inside (lipHi), the
      // white core deep in the crack, the near wall's shadow (night0), the near lip (lipLo) — iso: you see INTO it
      if (wide) px.dot(p.x, yy - 2, fresh ? PAL.white : rim).dot(p.x, yy + 2, fresh ? PAL.white : lipLo);
      if (tail >= 2) px.dot(p.x, yy - 1, fresh ? PAL.white : lipHi).dot(p.x, yy + 1, fresh ? PAL.white : gap);
      px.dot(p.x, yy, tail >= 2 ? core : TONES[Math.min(3, tone + 1)][0]);
      // the jog's riser: the step between two runs stays one crack (its corner lit, its walls dark)
      if (i > 0 && this.offs[i] !== this.offs[i - 1]) {
        const y0 = this.pts[i].y + this.offs[i - 1];
        px.dot(p.x, y0, core);
        if (tail >= 2) px.dot(p.x, Math.min(y0, yy) - 1, gap).dot(p.x, Math.max(y0, yy) + 1, gap);
      }
    }
    // the running head: gold4, a white flare one px ahead of it
    if (running) {
      const h = this.pts[n - 1];
      px.dot(h.x, y(n - 1), PAL.gold4);
      const a = this.pts[Math.min(N - 1, n)];
      px.dot(a.x, y(Math.min(N - 1, n)), PAL.white);
    } else if (this.o.fork && arrivedAt >= 0) {
      // blocked: a "Y" at the guard's front edge — a white flash at the split (two frames), then two 4-px prongs splayed
      // across the line that die in two palette steps, faster than the seam
      const e = this.pts[N - 1];
      const ey = y(N - 1);
      const since = el - arrivedAt;
      const st = since < 160 ? 0 : since < 280 ? 1 : since < 380 ? 2 : 3;
      if (since < 70) for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [2, 0], [-2, 0], [0, -2], [1, -1], [-1, -1]] as const) px.dot(e.x + dx, ey + dy, PAL.white);
      if (st < 3) {
        const [pc, pl] = TONES[Math.min(3, st + (st > 0 ? 1 : 0))];
        const nx = -this.dir.y;
        const ny = this.dir.x;
        for (const sd of [1, -1])
          for (let k = 1; k <= 5; k++) {
            const x = Math.round(e.x + this.dir.x * k * 0.8 + nx * sd * k * 0.9);
            const yy = Math.round(ey + this.dir.y * k * 0.8 + ny * sd * k * 0.9);
            px.dot(x, yy + 1, gap);
            px.dot(x, yy - 1, gap);
            px.dot(x, yy, k <= 3 ? pc : pl);
          }
        if (st === 0) px.dot(e.x, ey, PAL.gold4);
      }
    }
    // the spark: one gold4 pixel running from the attacker toward the target along the breathing seam
    if (this.o.spark !== false && arrivedAt >= 0 && el < fadeAt) {
      const T0 = arrivedAt + 260;
      const T1 = Math.min(fadeAt - 40, T0 + 620);
      if (el >= T0 && el <= T1) {
        const i = Math.round(((el - T0) / Math.max(1, T1 - T0)) * (N - 1));
        const p = this.pts[i];
        px.dot(p.x, y(i), PAL.gold4);
        if (i + 1 < N) px.dot(this.pts[i + 1].x, y(i + 1), PAL.white);
        if (i > 0) px.dot(this.pts[i - 1].x, y(i - 1), PAL.gold4);
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

/** The crack's joints: a 1-px jog (0 / +1 / 0 / −1 …) every 8–12 px, deterministic per seam; one line overall. */
export function jogs(n: number, salt: number): number[] {
  const out: number[] = [];
  let off = 0;
  let run = 0;
  let len = 8 + (Math.abs(salt) % 5);
  let k = 0;
  for (let i = 0; i < n; i++) {
    if (run >= len) {
      k++;
      off = [0, 1, 0, -1][k % 4];
      run = 0;
      len = 8 + (Math.abs(salt * 31 + k * 17) % 5);
    }
    out.push(off);
    run++;
  }
  return out;
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
