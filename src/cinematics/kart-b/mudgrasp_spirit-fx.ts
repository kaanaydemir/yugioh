// Çamur Pençe Ruhu (mudgrasp_spirit) — pixel helpers of its v3 cinematics (./mudgrasp_spirit.ts). No side
// effects: this module only exports painters and small effect objects (the cinematics glob imports it, KK-9).
//
// Every effect draws whole pixels in palette tones into a Raster (1-px ink outline, flat tone bands lit from
// the top-left, hard edges, stepped growth / fades — never alpha fades, never fractional scale; REHBER EF-7):
//   MudMask        a little silhouette buffer: shapes (discs, ellipses, capsules, lines) are filled into it,
//                  then painted as wet mud — earth bands decided per pixel from the top-left light (so a
//                  mirrored shape is still lit from the top-left), a 1-px ink outline around it
//   mudHand        a long mud arm with a hand at its end (palm + 4 fingers, open → clutching)
//   mudVortex      the summon's / death's mud whirlpool on the tile (spiral arms turning, a violet pit)
//   cracks         the death's tile cracks: mud runs out along them and drains down into them, they close
//   mudBall        the "Çamur Atışı" lump (wobbling, a violet ember inside)
//   splat          the contact "şlap": a splat star, a goo decal sliding down the body, droplets, a stain
//   mudPinAura     the pin's persistent status: a 6-px ring of mud on the attacker's tile, hands stirring in
//                  it, bubbles; a front lip of mud swallowing the feet

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { Raster } from '../../vfx/setpieces';
import { Sparks, onFrame } from '../../vfx/combat';
import { lightPool, type LightHandle } from '../../view/light';

export const TAU = Math.PI * 2;

/** Mud tones, dark → wet highlight. */
export const MUD = [PAL.earth0, PAL.earth1, PAL.earth2, PAL.earth3] as const;
/** The spirit's violet (eyes, pit, ember). */
export const VIOLET = [PAL.void1, PAL.void2, PAL.void3, PAL.void4] as const;

// ================================================================ random (deterministic per effect)

export function rng(seed: number): () => number {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x3c6d) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ================================================================ the mud painter

/** Tone set used by MudMask.paint: [shadow, body, lit, highlight]. */
export type MudTones = readonly [number, number, number, number];

/**
 * A silhouette buffer in world space (x0, y0, w, h). Fill shapes, then paint(): every filled pixel gets a
 * tone from its neighbourhood (top-left open → lit, bottom-right open → shadow, else body; the top-left
 * corner pixels of big lumps take the wet highlight), and every empty pixel touching it the ink outline.
 */
export class MudMask {
  readonly m: Uint8Array;
  constructor(
    public x0: number,
    public y0: number,
    readonly w: number,
    readonly h: number,
  ) {
    this.m = new Uint8Array(w * h);
  }
  clear(): void {
    this.m.fill(0);
  }
  f(x: number, y: number): boolean {
    const lx = x - this.x0;
    const ly = y - this.y0;
    return lx >= 0 && ly >= 0 && lx < this.w && ly < this.h && this.m[ly * this.w + lx] !== 0;
  }
  set(x: number, y: number, v = 1): void {
    const lx = Math.round(x) - this.x0;
    const ly = Math.round(y) - this.y0;
    if (lx >= 0 && ly >= 0 && lx < this.w && ly < this.h) this.m[ly * this.w + lx] = v;
  }
  ell(cx: number, cy: number, rx: number, ry: number, v = 1): void {
    if (rx <= 0 || ry <= 0) return;
    const x0 = Math.floor(cx - rx);
    const x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry);
    const y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx - 0.5) / rx;
        const dy = (y + 0.5 - cy - 0.5) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, v);
      }
  }
  disc(cx: number, cy: number, r: number, v = 1): void {
    this.ell(cx, cy, r, r, v);
  }
  /** Erase an ellipse (a hole). */
  hole(cx: number, cy: number, rx: number, ry: number): void {
    this.ell(cx, cy, rx, ry, 0);
  }
  /** A round-capped stroke of radius r (r < 0.75 → a 1-px line). */
  capsule(ax: number, ay: number, bx: number, by: number, r: number, v = 1): void {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      if (r < 0.75) this.set(x, y, v);
      else this.disc(x, y, r, v);
    }
  }
  /** Paint the silhouette into `g` (world coords): tones + ink outline. */
  paint(g: Raster, o: { tones?: MudTones; outline?: number | null; hi?: boolean } = {}): void {
    const [d, b, l, h] = o.tones ?? MUD;
    const ink = o.outline === undefined ? PAL.ink : o.outline;
    for (let ly = 0; ly < this.h; ly++)
      for (let lx = 0; lx < this.w; lx++) {
        const x = lx + this.x0;
        const y = ly + this.y0;
        if (this.m[ly * this.w + lx] === 0) {
          if (ink !== null && (this.f(x - 1, y) || this.f(x + 1, y) || this.f(x, y - 1) || this.f(x, y + 1))) g.px(x, y, ink);
          continue;
        }
        const ul = !this.f(x - 1, y) || !this.f(x, y - 1);
        const ul2 = !this.f(x - 1, y - 1) || !this.f(x - 2, y) || !this.f(x, y - 2);
        const dr = !this.f(x + 1, y) || !this.f(x, y + 1);
        let c = b;
        if (ul && !dr) c = l;
        else if (dr && !ul) c = d;
        else if (!dr && ul2 && !ul) c = l;
        if (o.hi !== false && ul && !dr && !this.f(x - 1, y) && !this.f(x, y - 1) && this.f(x + 1, y + 1) && this.f(x + 2, y + 1)) c = h;
        g.px(x, y, c);
      }
  }
}

/**
 * A mud arm from `base` (where it leaves the mud) to the hand at `tip`, bent by `bend` (px, sideways at the
 * middle). `open` 1 = fingers splayed, 0 = clutched (curled toward the palm). `w` arm radius.
 */
export function mudHand(mk: MudMask, base: XY, tip: XY, o: { bend?: number; open?: number; w?: number; fingers?: number; palm?: number } = {}): void {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const bend = o.bend ?? 0;
  const mid = { x: base.x + dx * 0.5 + nx * bend, y: base.y + dy * 0.5 + ny * bend };
  const w = o.w ?? 1.5;
  // the arm thins toward the wrist (two segments)
  mk.capsule(base.x, base.y, mid.x, mid.y, w + 0.5);
  mk.capsule(mid.x, mid.y, tip.x, tip.y, w);
  // the palm
  const pr = o.palm ?? 2;
  const palm = { x: tip.x + ux * 1.5, y: tip.y + uy * 1.5 };
  mk.disc(palm.x, palm.y, pr);
  // fingers: a fan around the arm's direction; open splays and straightens, closed curls inward
  const open = Math.max(0, Math.min(1, o.open ?? 1));
  const n = o.fingers ?? 4;
  const a0 = Math.atan2(uy, ux);
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0 : i / (n - 1) - 0.5;
    const spread = (0.35 + 0.75 * open) * k * 2;
    const a = a0 + spread;
    const len1 = 2 + open * 1.5;
    const p1 = { x: palm.x + Math.cos(a) * (pr + len1), y: palm.y + Math.sin(a) * (pr + len1) };
    mk.capsule(palm.x + Math.cos(a) * pr, palm.y + Math.sin(a) * pr, p1.x, p1.y, 0.5);
    // the tip segment: hooks inward (toward the arm's axis) as the hand closes — a clutching claw
    const a2 = a - Math.sign(k || 1) * (1 - open) * 1.9;
    const len2 = 1.5 + open;
    mk.capsule(p1.x, p1.y, p1.x + Math.cos(a2) * len2, p1.y + Math.sin(a2) * len2, 0.5);
  }
}

// ================================================================ the vortex (summon / death)

export interface MudVortex {
  /** Radius 0..1 of full (stepped to whole px). */
  open: number;
  /** Spin speed (rad / s; sign = direction). */
  speed: number;
  /** The violet pit's glow 0..1. */
  pit: number;
  /** Floor ripple rings (0..1 each: born at the rim, stepping out). */
  ripple(): void;
  destroy(): void;
}

/** A mud whirlpool lying on the tile at `at` (floor depth), full radius rx (ry = rx / 2). */
export function mudVortex(sc: Phaser.Scene, at: XY, rx: number, depth: number, seed: number): MudVortex {
  const W = rx * 2 + 24;
  const H = rx + 18;
  const r = Raster.around(sc, at.x, at.y, W, H, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const R = rng(seed);
  let ang = R() * TAU;
  const rings: number[] = [];
  const bubbles: { x: number; y: number; age: number; life: number }[] = [];
  let alive = true;
  const V: MudVortex = {
    open: 0,
    speed: 4,
    pit: 0,
    ripple() {
      rings.push(0);
    },
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
    },
  };
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    ang += (V.speed * dt) / 1000;
    const rr = Math.round(rx * Math.max(0, Math.min(1, V.open)));
    for (let i = rings.length - 1; i >= 0; i--) {
      rings[i] += dt / 360;
      if (rings[i] >= 1) rings.splice(i, 1);
    }
    if (rr >= 6 && dt > 0 && R() < dt / 90) {
      const a = R() * TAU;
      const d = R() * 0.75;
      bubbles.push({ x: Math.round(at.x + Math.cos(a) * rr * d), y: Math.round(at.y + Math.sin(a) * rr * 0.5 * d), age: 0, life: 260 + R() * 200 });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      bubbles[i].age += dt;
      if (bubbles[i].age >= bubbles[i].life + 60) bubbles.splice(i, 1);
    }
    r.draw((g) => {
      // ripple rings on the floor beyond the rim (stepped out, two tones)
      for (const k of rings) {
        const q = Math.round(rx * 0.7 + rx * 0.7 * k);
        g.ring(at.x, at.y, q, Math.max(1, Math.round(q / 2)), k < 0.5 ? MUD[2] : MUD[1]);
      }
      if (rr < 2) return;
      const ry = Math.max(1, Math.round(rr / 2));
      // the slurry: an ellipse, shaded as a dish (lit lower-right inner wall = far side from the light)
      mk.clear();
      mk.ell(at.x, at.y, rr, ry);
      mk.paint(g, { tones: [MUD[0], MUD[1], MUD[1], MUD[2]], hi: false });
      // the dish: the near (lower) inner wall catches the light, the far (upper) wall is in shadow
      g.ring(at.x, at.y, rr - 1, ry - 1, MUD[0], 1, Math.PI * 1.05, Math.PI * 1.95);
      if (rr > 4) g.ring(at.x, at.y, rr - 1, ry - 1, MUD[2], 1, Math.PI * 0.15, Math.PI * 0.85);
      // three spiral arms turning (log spiral, inward)
      for (let arm = 0; arm < 3; arm++) {
        const a0 = ang + (arm * TAU) / 3;
        let prev: XY | null = null;
        for (let s = 0; s <= 12; s++) {
          const k = s / 12;
          const rad = rr * (0.92 - 0.8 * k);
          const a = a0 + Math.sign(V.speed || 1) * k * 3.2;
          const p = { x: Math.round(at.x + Math.cos(a) * rad), y: Math.round(at.y + Math.sin(a) * rad * 0.5) };
          if (prev) g.line(prev.x, prev.y, p.x, p.y, k < 0.35 ? MUD[2] : MUD[0]);
          if (s === 2 && rr > 8) g.px(p.x, p.y - 1, MUD[3]);
          prev = p;
        }
      }
      // bubbles: a 1-px ring that swells and pops (the pop leaves a violet pixel for a frame)
      for (const bb of bubbles) {
        if (bb.age < bb.life) {
          const big = bb.age > bb.life * 0.5;
          g.px(bb.x, bb.y - 1, MUD[3]);
          if (big) {
            g.px(bb.x - 1, bb.y, MUD[2]);
            g.px(bb.x + 1, bb.y, MUD[0]);
          }
        } else {
          g.px(bb.x, bb.y, PAL.void3);
          g.px(bb.x - 2, bb.y - 1, MUD[2]);
          g.px(bb.x + 2, bb.y - 1, MUD[2]);
        }
      }
      // the pit: a dark eye in the middle with the spirit's violet in it
      if (rr >= 5) {
        g.ell(at.x, at.y, 3, 1.5, PAL.ink);
        if (V.pit > 0.05) {
          g.px(at.x, at.y, V.pit > 0.6 ? PAL.void4 : PAL.void3);
          if (V.pit > 0.4) {
            g.px(at.x - 1, at.y, PAL.void2);
            g.px(at.x + 1, at.y, PAL.void2);
          }
        }
      }
    });
    return true;
  });
  return V;
}

// ================================================================ the death's cracks

export interface Cracks {
  /** 0..1: the cracks run out from the centre. */
  grow: number;
  /** 0..1: the mud runs out along them (the stream's head). */
  flow: number;
  /** 0..1: the mud drains down into them (the stream's tail catches up). */
  drain: number;
  /** 0..3: the cracks close in steps (3 = gone). */
  close: number;
  /** Puddle radius left on the tile (px, 0 = none) — drawn shrinking into the centre. */
  puddle: number;
  destroy(): void;
}

/** Six cracks across the tile around `at` (reach rx; iso). */
export function cracks(sc: Phaser.Scene, at: XY, rx: number, depth: number, seed: number): Cracks {
  const R = rng(seed);
  const lines: XY[][] = [];
  const n = 6;
  for (let i = 0; i < n; i++) {
    let a = (i / n) * TAU + (R() - 0.5) * 0.6;
    let p = { x: at.x, y: at.y };
    const pts: XY[] = [{ x: Math.round(p.x), y: Math.round(p.y) }];
    const seg = 6;
    const reach = rx * (0.75 + R() * 0.25);
    for (let k = 0; k < seg; k++) {
      a += (R() - 0.5) * 0.9;
      const step = reach / seg;
      p = { x: p.x + Math.cos(a) * step, y: p.y + Math.sin(a) * step * 0.5 };
      pts.push({ x: Math.round(p.x), y: Math.round(p.y) });
    }
    lines.push(pts);
  }
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 12, rx + 12, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  let alive = true;
  const C: Cracks = {
    grow: 0,
    flow: 0,
    drain: 0,
    close: 0,
    puddle: 0,
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      r.destroy();
    },
  };
  /** Points along a polyline up to fraction t (whole px). */
  const along = (pts: XY[], t0: number, t1: number, fn: (p: XY, k: number) => void) => {
    const total = pts.length - 1;
    for (let s = 0; s < total; s++) {
      const a = pts[s];
      const b = pts[s + 1];
      const L = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      for (let j = 0; j < L; j++) {
        const k = (s + j / L) / total;
        if (k < t0 || k > t1) continue;
        fn({ x: Math.round(a.x + ((b.x - a.x) * j) / L), y: Math.round(a.y + ((b.y - a.y) * j) / L) }, k);
      }
    }
  };
  const stop = onFrame(sc, () => {
    if (!alive) return false;
    r.draw((g) => {
      // the puddle that is left, shrinking into the centre
      if (C.puddle >= 1) {
        mk.clear();
        mk.ell(at.x, at.y + 1, Math.round(C.puddle), Math.max(1, Math.round(C.puddle / 4)));
        mk.paint(g, { tones: [MUD[0], MUD[1], MUD[2], MUD[2]], hi: false });
      }
      if (C.close >= 3) return;
      const crackC = C.close < 1 ? PAL.ink : C.close < 2 ? PAL.earth0 : PAL.earth1;
      for (const pts of lines) {
        // the crack itself (ink), with a lit lip on its upper side
        along(pts, 0, C.grow, (p, k) => {
          g.px(p.x, p.y, crackC);
          if (C.close < 1 && k > 0.15) g.px(p.x, p.y - 1, MUD[1]);
        });
        // the mud running out along it, then draining down into it
        if (C.flow > 0 && C.close < 1) {
          const head = Math.min(C.grow, C.flow);
          const tail = Math.min(head, C.drain);
          along(pts, tail, head, (p, k) => {
            const nearHead = head - k < 0.12;
            g.px(p.x, p.y, nearHead ? MUD[2] : MUD[1]);
            if (k > 0.1 && head - k < 0.5) g.px(p.x, p.y - 1, nearHead ? MUD[3] : MUD[2]);
          });
          // the head's droplet
          if (head > tail + 0.02) along(pts, head - 0.02, head, (p) => g.px(p.x, p.y + 1, MUD[0]));
        }
      }
    });
    return true;
  });
  return C;
}

// ================================================================ the mud lump (strike)

/** Draw the thrown lump at p (radius ~3, squash phase `ph` 0..3, violet ember blinking). */
export function drawBall(g: Raster, mk: MudMask, p: XY, ph: number, big: boolean): void {
  mk.clear();
  const r = big ? 3.5 : 3;
  const sq = ph % 4;
  const rx = sq === 1 ? r + 1 : sq === 3 ? r - 0.5 : r;
  const ry = sq === 1 ? r - 1 : sq === 3 ? r + 0.5 : r;
  mk.ell(p.x, p.y, rx, ry);
  // a little blob tail lagging
  mk.disc(p.x - (sq < 2 ? 2 : 3), p.y + (sq % 2 ? 1 : 2), 1.2);
  mk.paint(g);
  // the ember inside (the spirit's violet)
  g.px(p.x + 1, p.y, sq % 2 ? PAL.void3 : PAL.void2);
}

// ================================================================ the splat (strike contact)

/** The splat star at `at`: a white core frame, then tendrils of mud thrown out (≈220 ms), droplets. */
export function splatStar(sc: Phaser.Scene, at: XY, floorY: number, depth: number, small: boolean, seed: number): Promise<void> {
  const R = rng(seed);
  const n = small ? 6 : 9;
  const arms = Array.from({ length: n }, (_, i) => ({ a: (i / n) * TAU + (R() - 0.5) * 0.5, len: (small ? 6 : 9) + R() * (small ? 3 : 6), w: R() < 0.4 ? 1.5 : 1 }));
  const r = Raster.around(sc, at.x, at.y, 60, 44, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  // droplets: whole-pixel clods arcing out and landing on the floor (they stay a beat, then go)
  const sp = new Sparks(sc, depth - 0.1);
  for (let i = 0; i < (small ? 10 : 18); i++) {
    const a = -Math.PI * R();
    const v = 40 + R() * 90;
    sp.add({ x: at.x, y: at.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.8 - 20, ay: 380, floor: floorY + Math.round((R() - 0.3) * 8), bounce: 0.08, life: 420 + R() * 260, colors: [MUD[2], MUD[1], MUD[1], MUD[0]], shape: R() < 0.35 ? 'sq' : 'px', size: 2, fadeAt: 1 });
  }
  sp.release();
  return new Promise((res) => {
    let el = 0;
    onFrame(sc, (dt) => {
      el += dt;
      const step = Math.min(4, Math.floor(el / 45));
      r.draw((g) => {
        if (step === 0) {
          // the contact frame: white core, a violet rim (the ember bursting)
          g.disc(at.x, at.y, small ? 3 : 4, PAL.void3);
          g.disc(at.x, at.y, small ? 2 : 3, PAL.white);
          return;
        }
        mk.clear();
        const k = [0, 0.55, 0.85, 1, 1][step];
        mk.ell(at.x, at.y, small ? 3 : 4, small ? 2 : 3);
        for (const arm of arms) {
          const L = arm.len * k;
          const ex = at.x + Math.cos(arm.a) * L;
          const ey = at.y + Math.sin(arm.a) * L * 0.75;
          mk.capsule(at.x, at.y, ex, ey, arm.w * (step > 2 ? 0.6 : 1));
          if (step >= 2) mk.disc(ex, ey, step > 3 ? 0.5 : 1);
        }
        if (step >= 4) mk.hole(at.x, at.y, small ? 1 : 2, 1);
        mk.paint(g);
      });
      if (el >= 230) {
        r.destroy();
        res();
        return false;
      }
      return true;
    });
  });
}

/**
 * The goo stuck on a struck body: a lump of mud on its surface at `at` (offset kept relative to the body)
 * that slides down ~7 px with drips and goes in three steps (≈620 ms). Removed at once if the body goes.
 */
export function gooDecal(sc: Phaser.Scene, body: MonsterUnit | null, at: XY, depth: number, seed: number): void {
  const R = rng(seed);
  const s = body?.sprite ?? null;
  const ox = s ? at.x - s.x : 0;
  const oy = s ? at.y - s.y : 0;
  const r = new Raster(sc, 0, 0, 30, 34, depth);
  const mk = new MudMask(0, 0, 30, 34);
  const drips = Array.from({ length: 3 }, () => ({ dx: Math.round((R() - 0.5) * 7), len: 2 + Math.round(R() * 4) }));
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    const gone = (s && (!s.active || !s.visible)) || el >= 620;
    if (gone) {
      r.destroy();
      return false;
    }
    const bx = Math.round((s ? s.x : 0) + ox);
    const by = Math.round((s ? s.y : 0) + oy + Math.min(7, Math.floor(el / 70)));
    r.moveTo(bx - 15, by - 10);
    mk.x0 = bx - 15;
    mk.y0 = by - 10;
    if (s) r.img.setDepth(s.depth + 0.3);
    const fade = el < 420 ? 0 : el < 520 ? 1 : 2;
    r.draw((g) => {
      mk.clear();
      mk.ell(bx, by, fade === 2 ? 2 : 4, fade === 2 ? 1 : 2);
      if (fade < 2) mk.ell(bx - 2, by + 1, 2, 1.5);
      for (const d of drips) {
        const L = Math.min(d.len + Math.floor(el / 90), d.len + 5) - fade * 2;
        if (L > 0) mk.capsule(bx + d.dx, by, bx + d.dx, by + L, 0.5);
      }
      mk.paint(g, fade === 0 ? {} : { tones: [MUD[0], MUD[0], MUD[1], MUD[1]], hi: false });
    });
    return true;
  });
}

/** A mud stain on the floor (ellipse, stepping out over ~700 ms). */
export function floorStain(sc: Phaser.Scene, at: XY, rx: number, depth: number, ms = 700): void {
  const r = Raster.around(sc, at.x, at.y, rx * 2 + 6, rx + 6, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  let el = 0;
  onFrame(sc, (dt) => {
    el += dt;
    if (el >= ms) {
      r.destroy();
      return false;
    }
    const k = el / ms;
    const q = k < 0.6 ? rx : k < 0.8 ? Math.round(rx * 0.6) : Math.round(rx * 0.3);
    r.draw((g) => {
      mk.clear();
      mk.ell(at.x, at.y, q, Math.max(1, Math.round(q / 3)));
      mk.paint(g, { tones: [MUD[0], MUD[1], MUD[1], MUD[2]], outline: null, hi: false });
    });
    return true;
  });
}

// ================================================================ the pin: hands under the attacker, the ring

/** One hand of the pin: its angle on the ring, phase and whether it stands in front of the body. */
interface PinHand {
  a: number;
  front: boolean;
  ph: number;
}

export interface PinGrab {
  /** 0..1 the mud seeps up under the feet (the pool grows). */
  seep: number;
  /** 0..1 the hands burst up (extension). */
  burst: number;
  /** 0..1 the hands clamp onto the feet (bend in, fingers close). */
  grab: number;
  /** 0..1 the pool contracts to the 6-px ring (the aura's shape). */
  ring: number;
  /** 0..1 the hands sink back into the ring. */
  sink: number;
  destroy(): void;
}

/** Ring geometry of a unit's tile (the aura and the grab share it). */
export function ringOf(u: MonsterUnit): { rx: number; ry: number; lip: number } {
  const rx = Math.max(15, Math.min(22, Math.round(u.art.w * 0.28)));
  return { rx, ry: Math.round(rx / 2), lip: Math.max(8, Math.min(16, Math.round(u.art.w * 0.24))) };
}

/** The ring band (outer rx × ry, 6 px wide at the sides / 3 px at front and back) into a mask. */
function ringBand(mk: MudMask, at: XY, rx: number, ry: number, k: number): void {
  mk.ell(at.x, at.y, rx, ry);
  // the hole opens as the pool contracts into the ring (k 0 = full pool, 1 = the 6-px band)
  const ix = Math.round((rx - 6) * k);
  const iy = Math.round((ry - 3) * k);
  if (ix >= 2 && iy >= 1) mk.hole(at.x, at.y, ix, iy);
}

/** Draw the inside of the ring (the wet, dark floor inside it: churning). */
function ringInside(g: Raster, at: XY, rx: number, ry: number, t: number, k: number): void {
  const ix = Math.round((rx - 6) * k);
  const iy = Math.round((ry - 3) * k);
  if (ix < 2 || iy < 1) return;
  g.ell(at.x, at.y, ix, iy, PAL.earth0);
  // a slow churn: two short arcs turning
  const a = t * 1.6;
  g.ring(at.x, at.y, Math.max(1, ix - 2), Math.max(1, iy - 1), MUD[1], 1, a, a + 1.1);
  g.ring(at.x, at.y, Math.max(1, ix - 2), Math.max(1, iy - 1), MUD[1], 1, a + Math.PI, a + Math.PI + 1.1);
}

/**
 * The pin's grab on the attacker's tile: the pool seeps up, the hands burst, clamp onto the feet, the pool
 * contracts into the ring, the hands sink. Two rasters: behind the body (floor + back hands) and in front
 * (front hands + the lip of mud over the feet).
 */
export function pinGrab(sc: Phaser.Scene, u: MonsterUnit, seed: number): PinGrab {
  const at = { x: Math.round(u.home.x), y: Math.round(u.home.y) };
  const { rx, ry, lip } = ringOf(u);
  const R = rng(seed);
  const s = u.sprite;
  const W = rx * 2 + 30;
  const H = 64;
  const back = new Raster(sc, at.x - W / 2, at.y - 46, W, H, s.depth - 0.5);
  const front = new Raster(sc, at.x - W / 2, at.y - 46, W, H, s.depth + 0.5);
  const mkB = new MudMask(back.x, back.y, back.w, back.h);
  const mkF = new MudMask(front.x, front.y, front.w, front.h);
  const hands: PinHand[] = [
    { a: Math.PI * 1.12, front: false, ph: R() },
    { a: Math.PI * 1.85, front: false, ph: R() },
    { a: Math.PI * 0.2, front: true, ph: R() },
    { a: Math.PI * 0.82, front: true, ph: R() },
  ];
  const G: PinGrab = {
    seep: 0,
    burst: 0,
    grab: 0,
    ring: 0,
    sink: 0,
    destroy() {
      if (!alive) return;
      alive = false;
      stop();
      back.destroy();
      front.destroy();
    },
  };
  let alive = true;
  let el = 0;
  const stop = onFrame(sc, (dt) => {
    if (!alive) return false;
    el += dt;
    back.img.setDepth(s.depth - 0.5);
    front.img.setDepth(s.depth + 0.5);
    const t = el / 1000;
    // the pool: grows with seep (stepped whole px), contracts into the ring band with `ring`
    const prx = Math.round(rx * Math.min(1, G.seep));
    const pry = Math.max(1, Math.round(ry * Math.min(1, G.seep)));
    back.begin();
    front.begin();
    if (prx >= 2) {
      mkB.clear();
      ringBand(mkB, at, prx, pry, G.ring);
      mkB.paint(back, { tones: [MUD[0], MUD[1], MUD[2], MUD[3]] });
      ringInside(back, at, prx, pry, t, G.ring);
      // bubbles boil while it seeps (violet pops)
      if (G.seep > 0.3 && G.grab < 1) {
        for (let i = 0; i < 3; i++) {
          const ph = (t * 3.1 + i * 0.37) % 1;
          const a = i * 2.1 + Math.floor(t * 3.1 + i * 0.37) * 1.7;
          const bx = Math.round(at.x + Math.cos(a) * prx * 0.55);
          const by = Math.round(at.y + Math.sin(a) * pry * 0.55);
          if (ph < 0.75) back.px(bx, by - 1, MUD[3]);
          else back.px(bx, by, PAL.void3);
        }
      }
    }
    // the hands: burst up out of the pool's rim, clamp in on the feet, sink
    const up = Math.min(1, G.burst) * (1 - Math.min(1, G.sink));
    if (up > 0.02) {
      mkB.clear();
      mkF.clear();
      for (const h of hands) {
        const rimR = 0.75 - 0.25 * G.grab;
        const base = { x: at.x + Math.cos(h.a) * rx * rimR, y: at.y + Math.sin(h.a) * ry * rimR };
        const towards = { x: at.x - base.x, y: at.y - base.y };
        const height = Math.round(14 * up * (1 - 0.45 * G.grab));
        // reach up, then bend in over the feet
        const lean = 0.25 + 0.65 * G.grab;
        const wob = Math.sin(t * 9 + h.ph * TAU) * (G.grab > 0.5 ? 0.6 : 1.2);
        const tip = { x: Math.round(base.x + towards.x * lean + wob), y: Math.round(base.y + towards.y * lean - height) };
        mudHand(h.front ? mkF : mkB, { x: Math.round(base.x), y: Math.round(base.y) }, tip, { open: 1 - G.grab, bend: (h.front ? 1 : -1) * 1.5, w: 1.2, fingers: 4, palm: 1.5 });
      }
      mkB.paint(back);
      mkF.paint(front);
    }
    // the lip of mud over the feet (front): rises with the grab, stays in the ring
    if (G.grab > 0.3) {
      mkF.clear();
      const lk = Math.min(1, (G.grab - 0.3) / 0.5);
      mkF.ell(at.x, at.y + 1, Math.round(lip * lk), Math.max(1, Math.round(2 * lk)));
      mkF.paint(front, { tones: [MUD[0], MUD[1], MUD[2], MUD[2]], hi: false });
    }
    back.end();
    front.end();
    return true;
  });
  return G;
}

/**
 * The persistent pin status on the attacker's tile (an aura: destroy() sinks it in ≈220 ms): the 6-px mud
 * ring, the dark churning floor inside it, three hands that rise out of the ring in turn, flex their fingers
 * and sink, bubbles with violet pops, the lip of mud over the feet, a faint violet light breathing.
 */
export function mudPinAura(sc: Phaser.Scene, u: MonsterUnit, seed: number): { destroy(): void } {
  const s = u.sprite;
  const R = rng(seed);
  const { rx, ry, lip } = ringOf(u);
  const W = rx * 2 + 30;
  const H = 52;
  const back = new Raster(sc, 0, 0, W, H, s.depth - 0.5);
  const front = new Raster(sc, 0, 0, W, H, s.depth + 0.5);
  const mkB = new MudMask(0, 0, W, H);
  const mkF = new MudMask(0, 0, W, H);
  const hands = [
    { a: Math.PI * 1.15, front: false, off: 0 },
    { a: Math.PI * 0.25, front: true, off: 0.36 },
    { a: Math.PI * 1.8, front: false, off: 0.62 },
    { a: Math.PI * 0.78, front: true, off: 0.83 },
  ];
  const CYCLE = 2.6;
  let light: LightHandle | null = lightPool(sc, u.home.x, u.home.y, { color: PAL.void3, spill: null, radius: rx, floorY: u.home.y, intensity: 0.35, anim: 'breathe', fadeIn: 200 });
  let dying = -1;
  let el = 0;
  let killed = false;
  const kill = () => {
    if (killed) return;
    killed = true;
    stop();
    back.destroy();
    front.destroy();
    const l = light;
    light = null;
    if (l && l.alive) void l.fadeOut(160);
  };
  const bubbleAt = Array.from({ length: 4 }, () => ({ a: R() * TAU, ph: R() }));
  const stop = onFrame(sc, (dt) => {
    if (!s.active || u.retired) {
      kill();
      return false;
    }
    el += dt;
    const t = el / 1000;
    const at = { x: Math.round(u.home.x), y: Math.round(u.home.y) };
    const x0 = at.x - Math.floor(W / 2);
    const y0 = at.y - 36;
    back.moveTo(x0, y0);
    front.moveTo(x0, y0);
    mkB.x0 = x0;
    mkB.y0 = y0;
    mkF.x0 = x0;
    mkF.y0 = y0;
    back.img.setDepth(s.depth - 0.5);
    front.img.setDepth(s.depth + 0.5);
    // dying: the hands go first, then the ring drains in two steps
    let k = 1;
    if (dying >= 0) {
      const d = el - dying;
      if (d > 220) {
        kill();
        return false;
      }
      k = d < 80 ? 1 : d < 150 ? 0.66 : 0.33;
    }
    const show = s.visible;
    back.begin();
    front.begin();
    if (show) {
      const orx = Math.round(rx * (k < 1 ? 0.8 + 0.2 * k : 1));
      const ory = Math.max(2, Math.round(ry * (k < 1 ? 0.8 + 0.2 * k : 1)));
      mkB.clear();
      ringBand(mkB, at, orx, ory, k < 0.5 ? 0.4 : 1);
      mkB.paint(back);
      ringInside(back, at, orx, ory, t, 1);
      // the ring's surface: a slow ripple of light running round the band (one wet glint)
      const ga = t * 1.3;
      back.px(Math.round(at.x + Math.cos(ga) * (orx - 2)), Math.round(at.y + Math.sin(ga) * (ory - 1)), MUD[3]);
      // bubbles on the band, popping violet
      for (const b of bubbleAt) {
        const ph = (t * 0.9 + b.ph) % 1;
        const bx = Math.round(at.x + Math.cos(b.a + Math.floor(t * 0.9 + b.ph) * 2.3) * (orx - 3));
        const by = Math.round(at.y + Math.sin(b.a + Math.floor(t * 0.9 + b.ph) * 2.3) * (ory - 1));
        if (ph > 0.55 && ph < 0.85) back.px(bx, by - 1, MUD[3]);
        else if (ph >= 0.85 && ph < 0.93) {
          back.px(bx, by, PAL.void3);
          back.px(bx - 1, by - 1, MUD[2]);
          back.px(bx + 1, by - 1, MUD[2]);
        }
      }
      // the hands: rise (0–0.15), flex (to 0.55), sink (to 0.7), gone; each on its own offset
      if (k === 1) {
        mkB.clear();
        mkF.clear();
        for (const h of hands) {
          const ph = (t / CYCLE + h.off) % 1;
          if (ph > 0.7) continue;
          const up = ph < 0.15 ? ph / 0.15 : ph < 0.55 ? 1 : 1 - (ph - 0.55) / 0.15;
          const base = { x: Math.round(at.x + Math.cos(h.a) * (orx - 3)), y: Math.round(at.y + Math.sin(h.a) * (ory - 1)) };
          const height = Math.round(8 * up);
          if (height < 2) continue;
          const sway = Math.round(Math.sin(t * 2.2 + h.off * TAU) * 1.5);
          const tip = { x: base.x + sway + Math.round(Math.cos(h.a) * 2), y: base.y - height };
          const flex = 0.5 + 0.5 * Math.sin((ph - 0.15) * 22);
          mudHand(h.front ? mkF : mkB, base, tip, { open: ph < 0.15 ? 1 : flex, w: 1, fingers: 3, palm: 1.2 });
        }
        mkB.paint(back);
        mkF.paint(front);
      }
      // the lip of mud over the feet
      mkF.clear();
      mkF.ell(at.x, at.y + 1, Math.round(lip * k), Math.max(1, Math.round(2 * k)));
      mkF.paint(front, { tones: [MUD[0], MUD[1], MUD[2], MUD[2]], hi: false });
    }
    back.end();
    front.end();
    return true;
  });
  return {
    destroy() {
      if (dying < 0 && !killed) dying = el;
    },
  };
}

/** A line of mud crawling over the floor from `from` to `to` (the dead spirit's mud still reaching). */
export function mudCrawl(sc: Phaser.Scene, from: XY, to: XY, ms: number, depth: number, seed: number): Promise<void> {
  const R = rng(seed);
  const minX = Math.min(from.x, to.x) - 8;
  const minY = Math.min(from.y, to.y) - 8;
  const r = new Raster(sc, minX, minY, Math.abs(to.x - from.x) + 16, Math.abs(to.y - from.y) + 16, depth);
  const mk = new MudMask(r.x, r.y, r.w, r.h);
  const wig = Array.from({ length: 8 }, () => (R() - 0.5) * 3);
  return new Promise((res) => {
    let el = 0;
    onFrame(sc, (dt) => {
      el += dt;
      const k = Math.min(1, el / ms);
      const tail = Math.max(0, (el - ms * 0.55) / (ms * 0.6));
      r.draw((g) => {
        mk.clear();
        const n = 24;
        for (let i = 0; i <= n; i++) {
          const q = i / n;
          if (q > k || q < tail) continue;
          const x = from.x + (to.x - from.x) * q;
          const y = from.y + (to.y - from.y) * q + wig[Math.floor(q * 7.99)];
          mk.ell(x, y, q > k - 0.08 ? 2.5 : 1.5, 1);
        }
        mk.paint(g, { hi: false });
      });
      if (tail >= 1) {
        r.destroy();
        res();
        return false;
      }
      return true;
    });
  });
}
