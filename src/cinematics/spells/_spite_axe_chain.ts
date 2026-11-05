// Hınç Baltası (spite_axe) — the CHAIN, drawn as real links (lane E). Pure pixel drawing into a Raster: every link is
// a little iron shape (a flat "O" ring 4×3 with a hole, or an edge-on "–" bar 3×1), lit from the top-left (stone4
// highlight, stone3 body, stone2 shade), and the whole chain gets ONE ink outline (computed after all links are laid,
// so the links read on the dark floor). `hot` heats the links (fire ramp) — the lash, a chain fresh off the axe.
// FlungLinks: single links torn off at a snap, tumbling (4 spin drawings), bouncing once on the floor.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { XY } from '../../view/layout';
import { Raster, onFrame } from '../../vfx/setpieces';

const R = Math.round;

/** A pixel bag (last write wins) with an ink outline pass. */
export class PixBag {
  private readonly m = new Map<number, number>();
  set(x: number, y: number, c: number): void {
    this.m.set(((R(y) + 2048) << 12) | (R(x) + 2048), c);
  }
  has(x: number, y: number): boolean {
    return this.m.has(((y + 2048) << 12) | (x + 2048));
  }
  /** Flush into a raster (ink outline first, 4-neighbour, unless `outline` is false). */
  flush(r: Raster, outline = true): void {
    if (outline) {
      const ink = new Set<number>();
      for (const k of this.m.keys()) {
        const x = (k & 4095) - 2048;
        const y = (k >> 12) - 2048;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const)
          if (!this.has(x + dx, y + dy)) ink.add(((y + dy + 2048) << 12) | (x + dx + 2048));
      }
      for (const k of ink) r.px((k & 4095) - 2048, (k >> 12) - 2048, PAL.ink);
    }
    for (const [k, c] of this.m) r.px((k & 4095) - 2048, (k >> 12) - 2048, c);
  }
  clear(): void {
    this.m.clear();
  }
}

type Tones = readonly [number, number, number];
const IRON: Tones = [PAL.stone4, PAL.stone3, PAL.stone2];
const HOT: Tones = [PAL.fire4, PAL.fire3, PAL.fire2];
const WARM: Tones = [PAL.fire3, PAL.stone3, PAL.crim2];

/** One link at (x, y): kind 0 = flat ring, 1 = edge-on bar; `hor` = lying along x. */
export function linkShape(b: PixBag, x: number, y: number, kind: number, hor: boolean, t: Tones = IRON): void {
  const [hi, mid, lo] = t;
  const P = (u: number, v: number, c: number): void => (hor ? b.set(x + u, y + v, c) : b.set(x + v, y + u, c));
  if (kind === 0) {
    // the ring: a lit top / left, a shaded bottom / right, an ink hole
    P(-1, -1, hi);
    P(0, -1, hi);
    P(-2, 0, hi);
    P(1, 0, mid);
    P(-1, 1, mid);
    P(0, 1, lo);
    P(-1, 0, PAL.ink);
    P(0, 0, PAL.ink);
  } else {
    P(-1, 0, hi);
    P(0, 0, mid);
    P(1, 0, lo);
  }
}

/**
 * A chain of links along a polyline (world points), pitch 3 px, alternating ring / bar. `wob(i)` shifts link i
 * sideways (a taut chain's ±1 px vibration); `heat(i)` 0 iron, 1 warm, 2 hot.
 */
export function chainLinks(b: PixBag, pts: readonly XY[], o: { pitch?: number; wob?: (i: number) => number; heat?: (i: number) => number; start?: number } = {}): XY[] {
  const pitch = o.pitch ?? 3;
  const out: XY[] = [];
  let acc = 0;
  let n = o.start ?? 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const c = pts[i + 1];
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    if (len <= 0) continue;
    const dx = (c.x - a.x) / len;
    const dy = (c.y - a.y) / len;
    const hor = Math.abs(dx) >= Math.abs(dy);
    while (acc <= len) {
      const w = o.wob ? o.wob(n) : 0;
      const x = R(a.x + dx * acc + (hor ? 0 : w));
      const y = R(a.y + dy * acc + (hor ? w : 0));
      const h = o.heat ? o.heat(n) : 0;
      linkShape(b, x, y, n % 2, hor, h >= 2 ? HOT : h >= 1 ? WARM : IRON);
      out.push({ x, y });
      n++;
      acc += pitch + (n % 2 === 0 ? 1 : 0);
    }
    acc -= len;
  }
  return out;
}

// ================================================================ flung links (the snap)

interface Flung {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  life: number;
  age: number;
  floor: number;
  bounced: boolean;
}

/** Links torn off at a snap: they tumble (ring flat → bar → ring upright → bar), bounce once and vanish. */
export class FlungLinks {
  private readonly ras: Raster;
  private readonly list: Flung[] = [];
  private readonly bag = new PixBag();
  private stop: () => void;
  private dead = false;

  constructor(scene: Phaser.Scene, depth: number) {
    this.ras = new Raster(scene, 0, 0, 640, 360, depth);
    this.stop = onFrame(scene, (dt) => this.tick(dt));
  }

  add(f: { x: number; y: number; vx: number; vy: number; floor: number; life?: number; spin?: number }): void {
    this.list.push({ ...f, spin: f.spin ?? 1, life: f.life ?? 700, age: 0, bounced: false });
  }

  get count(): number {
    return this.list.length;
  }

  private tick(dt: number): boolean {
    if (this.dead) return false;
    const s = dt / 1000;
    this.bag.clear();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.list.splice(i, 1);
        continue;
      }
      p.vy += 520 * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      if (p.y >= p.floor && p.vy > 0) {
        p.y = p.floor;
        if (!p.bounced) {
          p.bounced = true;
          p.vy *= -0.32;
          p.vx *= 0.5;
        } else {
          p.vy = 0;
          p.vx *= 0.8;
        }
      }
      // the spin: a drawing per 45 ms while flying, lying flat once it rests
      const resting = p.bounced && Math.abs(p.vy) < 1;
      const f = resting ? 0 : Math.floor((p.age * p.spin) / 45) % 4;
      const old = p.age > p.life * 0.7;
      const t: Tones = old ? [PAL.stone2, PAL.stone1, PAL.stone0] : p.age < 90 ? [PAL.white, PAL.fire4, PAL.stone3] : IRON;
      linkShape(this.bag, R(p.x), R(p.y), f % 2, f < 2, t);
    }
    this.ras.begin();
    this.bag.flush(this.ras);
    this.ras.end();
    return true;
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    this.stop();
    this.ras.destroy();
  }
}


