// Kabuk Zıpkıncı — world-space bridges for the card's own effect painters (src/art/monsters-v3/tide_harpooner-fx.ts).
// The painters draw on a PixelCanvas; here a `Surface` gives them the same set / get / isOpaque surface over a Px
// (one Graphics, whole pixels, palette colours only, no alpha), so the rope, the exit spray, the wave wall and the
// splinters are drawn in the world (or on the HUD for the LP-panel stake) by the very code the sheet uses.
// Also: the flying harpoon as an image (one cached texture per angle), the KORUNUYOR plate texture, wet beads that
// land as floor dots, the tide sheet over a tile, and the reverse pull (the game's only one).
// Nothing runs at import (lazy caches only); every user is LOOK_V3-gated.

import Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { PixelCanvas } from '../../art/pixel';
import { harpoonFrame, korunuyorPlate, type HarpoonFrame } from '../../art/monsters-v3/tide_harpooner-fx';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import { TILE_H, TILE_W, type XY } from '../../view/layout';
import { canvasTexture } from '../../view/v3/hudSkin';
import { Px, onFrame } from '../../vfx/combat';

export const rnd = Math.round;
export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const TAU = Math.PI * 2;
export type Pt = readonly [number, number];
export const pt = (p: XY): Pt => [p.x, p.y];
export const xy = (p: Pt): XY => ({ x: p[0], y: p[1] });
export function norm(a: XY): XY {
  const l = Math.hypot(a.x, a.y) || 1;
  return { x: a.x / l, y: a.y / l };
}
export const sub = (a: XY, b: XY): XY => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a: XY, b: XY, k = 1): XY => ({ x: a.x + b.x * k, y: a.y + b.y * k });
export const lerpXY = (a: XY, b: XY, t: number): XY => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const snapXY = (p: XY): XY => ({ x: rnd(p.x), y: rnd(p.y) });

/** Deterministic 0…1 hash (films and measure re-run identically). */
export function hash(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ================================================================ a PixelCanvas-like surface over a Px

/**
 * The painters' surface in world (or screen) pixels: set() paints one whole pixel through the Px and remembers its
 * colour (rope2 reads it back), clear() wipes both. `ox / oy` offset every pixel.
 */
export class Surface {
  readonly px: Px;
  private readonly m = new Map<number, number>();
  ox = 0;
  oy = 0;
  constructor(scene: Phaser.Scene, depth: number, o: { screen?: boolean } = {}) {
    const g = scene.add.graphics().setDepth(depth);
    if (o.screen) g.setScrollFactor(0);
    this.px = new Px(g);
  }
  private k(x: number, y: number): number {
    return (rnd(y) + 4096) * 16384 + (rnd(x) + 4096);
  }
  set(x: number, y: number, c: number): this {
    this.m.set(this.k(x, y), c);
    this.px.dot(rnd(x) + this.ox, rnd(y) + this.oy, c);
    return this;
  }
  get(x: number, y: number): number | null {
    return this.m.get(this.k(x, y)) ?? null;
  }
  isOpaque(x: number, y: number): boolean {
    return this.m.has(this.k(x, y));
  }
  erase(_x: number, _y: number): this {
    return this;
  }
  clear(): this {
    this.m.clear();
    this.px.clear();
    return this;
  }
  setDepth(d: number): this {
    this.px.g.setDepth(d);
    return this;
  }
  /** As the painters' PixelCanvas (they only call set / get / isOpaque on it). */
  get canvas(): PixelCanvas {
    return this as unknown as PixelCanvas;
  }
  destroy(): void {
    this.m.clear();
    if (this.px.g.active) this.px.g.destroy();
  }
}

// ================================================================ the flying harpoon

/** Harpoon angles are drawn every 2° (each a cached texture). */
const STEP = 2;

/**
 * The thrown harpoon as one image: set(tip, angle) shows the rig's own harpoon (driftwood shaft, lashing, stone head,
 * barbs, the white glint) pointing along `angle` (deg, screen: 0 right, 90 down) with its tip on `tip`. Always lit
 * from the screen's top-left (world-space art: never flipped). `bury` cuts the head into the LP panel.
 */
export class HarpoonImg {
  readonly img: Phaser.GameObjects.Image;
  private f: HarpoonFrame | null = null;
  private tipAt: XY = { x: 0, y: 0 };
  constructor(private readonly scene: Phaser.Scene, depth: number, o: { screen?: boolean } = {}) {
    this.img = scene.add.image(0, 0, '__DEFAULT').setOrigin(0, 0).setDepth(depth).setVisible(false);
    if (o.screen) this.img.setScrollFactor(0);
  }
  set(tip: XY, angle: number, o: { bury?: number; smear?: number } = {}): this {
    const a = (((Math.round(angle / STEP) * STEP) % 360) + 360) % 360;
    const bury = o.bury ?? 0;
    const smear = o.smear ?? 0;
    const f = harpoonFrame(a, 'left', { bury, smear });
    const key = canvasTexture(this.scene, `thp:harp:${a}:${bury}:${smear}`, () => f.px);
    if (this.img.texture.key !== key) this.img.setTexture(key);
    this.f = f;
    this.tipAt = snapXY(tip);
    this.img.setPosition(this.tipAt.x - f.tip[0], this.tipAt.y - f.tip[1]).setVisible(true);
    return this;
  }
  /** World point of the line ring (where the rope is tied), for the current frame. */
  ring(): XY {
    if (!this.f) return this.tipAt;
    return { x: this.tipAt.x + this.f.ring[0] - this.f.tip[0], y: this.tipAt.y + this.f.ring[1] - this.f.tip[1] };
  }
  butt(): XY {
    if (!this.f) return this.tipAt;
    return { x: this.tipAt.x + this.f.butt[0] - this.f.tip[0], y: this.tipAt.y + this.f.butt[1] - this.f.tip[1] };
  }
  tip(): XY {
    return this.tipAt;
  }
  get visible(): boolean {
    return this.img.visible;
  }
  hide(): void {
    this.img.setVisible(false);
  }
  setDepth(d: number): this {
    this.img.setDepth(d);
    return this;
  }
  destroy(): void {
    if (this.img.active) this.img.destroy();
  }
}

/** Screen angle (deg) of a direction. */
export function angleOf(d: XY): number {
  return (Math.atan2(d.y, d.x) * 180) / Math.PI;
}

// ================================================================ KORUNUYOR

/** The plate's texture key (cached): `big` the one-size-bigger pop, `fade` 0 / 1 / 2 tone steps out. */
export function plateKey(scene: Phaser.Scene, big: boolean, fade: number): { key: string; w: number; h: number } {
  const pc = korunuyorPlate(big, fade);
  const key = canvasTexture(scene, `thp:plate:${big ? 1 : 0}:${fade}`, () => pc);
  return { key, w: pc.w, h: pc.h };
}

// ================================================================ foam beads → wet dots on the floor

interface Bead {
  x: number;
  y: number;
  vx: number;
  vy: number;
  floor: number;
  age: number;
  landed: number;
}

/**
 * Foam beads (2-px white) flung off the twirl's front pass: they fly, fall and land as 1-px wet dots (water4 → water3,
 * then gone). One Surface; resolves itself.
 */
export function flingBeads(scene: Phaser.Scene, from: XY, dir: 1 | -1, floorY: number, depth: number, seed: number, n = 4): void {
  const s = new Surface(scene, depth);
  const beads: Bead[] = [];
  for (let i = 0; i < n; i++) {
    const h = hash(seed, i, 7);
    beads.push({ x: from.x, y: from.y, vx: dir * (40 + h * 70) * (i % 2 ? 1 : 0.6), vy: -40 - hash(seed, i, 9) * 50, floor: floorY + rnd(hash(seed, i, 11) * 8) - 4, age: 0, landed: -1 });
  }
  onFrame(scene, (dt, el) => {
    s.clear();
    const k = dt / 1000;
    let alive = 0;
    for (const b of beads) {
      b.age += dt;
      if (b.landed < 0) {
        b.vy += 520 * k;
        b.x += b.vx * k;
        b.y += b.vy * k;
        if (b.y >= b.floor && b.vy > 0) {
          b.y = b.floor;
          b.landed = b.age;
        }
      }
      if (b.landed < 0) {
        alive++;
        s.set(b.x, b.y, PAL.white).set(b.x + 1, b.y, PAL.white).set(b.x, b.y + 1, PAL.water4).set(b.x + 1, b.y + 1, PAL.water4);
      } else {
        const since = b.age - b.landed;
        if (since < 420) {
          alive++;
          s.set(b.x, b.y, since < 200 ? PAL.water4 : PAL.water3);
        }
      }
    }
    return alive > 0 && el < 2000;
  }, () => s.destroy());
}

// ================================================================ the tide sheet over the tile

export interface TideState {
  /** 0…1: how far the sheet has slid in from the back-left (0 none, 1 the whole tile) */
  inK: number;
  /** 0…1: how far it has drawn back out (uncovering wet sand behind it) */
  outK: number;
  /** 0…1: the wet sand fading back to the dry tile (2 palette steps) */
  dry: number;
  /** ms: drifts the ripple dashes on the sheet (optional) */
  t?: number;
}

/**
 * The tide sheet across a tile at `c` (the tile centre on the floor): a flat water2 / water3 sheet with a white leading
 * edge slides in from the back-left corner; drawing back, it leaves wet sand (earth1 / earth2, Bayer 2×2 on the floor
 * only) and a foam line on its edge. `k` scales the tile (TILE_W / 64). Whole pixels, palette only.
 */
export function paintTide(s: Surface, c: XY, st: TideState, seed = 1): void {
  const hw = Math.floor(TILE_W / 2) - 2;
  const hh = Math.floor(TILE_H / 2) - 1;
  // the iso axis from the back-left edge to the front-right edge: u = 0 … 1
  for (let y = -hh; y <= hh; y++) {
    const span = Math.floor(hw * (1 - Math.abs(y) / (hh + 0.5)));
    for (let x = -span; x <= span; x++) {
      // diamond-local coordinates along the two iso axes (each −1 … 1)
      const a = x / (2 * hw) + y / (2 * hh); // back-left (−) → front-right (+)
      const u = (a + 1) / 2;
      const px = c.x + x;
      const py = c.y + y;
      const edgeIn = st.inK * 1.1;
      const edgeOut = st.outK * 1.1;
      const wobble = (hash(y + 40, seed, 3) - 0.5) * 0.05;
      if (u <= edgeOut + wobble) {
        // uncovered: wet sand (fades back in two steps)
        if (st.dry >= 1) continue;
        const bayer = (px + py) & 1;
        const dark = st.dry < 0.5 ? (bayer ? PAL.earth1 : PAL.earth2) : bayer ? PAL.night2 : PAL.earth1;
        if (st.dry >= 0.5 && bayer) continue;
        s.set(px, py, dark);
        continue;
      }
      if (u <= edgeIn + wobble) {
        const d = edgeIn + wobble - u;
        const fromOut = u - (edgeOut + wobble);
        // the leading edge white, a water3 band behind it, the water2 body; a foam line on the receding edge
        // ripple dashes drift along the sheet (water3 on every 4th row, broken into 3-px dashes)
        const drift = Math.floor((st.t ?? 0) / 110);
        const ripple = ((y + 64) % 4 === 0) && ((x + drift + (y >> 2) * 3 + 64) % 7 < 3);
        const c0 = d < 0.035 ? PAL.white : d < 0.09 ? PAL.water3 : st.outK > 0 && fromOut < 0.03 ? (hash(px, py, seed) < 0.6 ? PAL.white : PAL.water4) : ripple ? PAL.water3 : PAL.water2;
        s.set(px, py, c0);
      }
    }
  }
}

// ================================================================ the pull (toward the crab)

const pulls = new WeakMap<Phaser.GameObjects.Sprite, Phaser.Tweens.Tween>();

/**
 * Haul the struck unit `px` whole pixels toward `toward` (the crab; y × 0.6 on the floor): the knock-back API turned
 * round. It takes over the sprite from the kit's knock (its tweens are stopped), steps one pixel at once, the rest over
 * 70 ms, then (unless `hold`: a death follows from here) eases back to its rest point.
 */
export function haul(u: MonsterUnit, toward: XY, px: number, o: { hold?: boolean; backMs?: number } = {}): void {
  const s = u.sprite;
  if (!s.active || u.retired || px <= 0) return;
  const sc = u.scene;
  sc.tweens.killTweensOf(s);
  pulls.get(s)?.stop();
  const base = u.rest0;
  const d = norm(sub(toward, base));
  const to = { x: rnd(base.x + d.x * px), y: rnd(base.y + d.y * px * 0.6) };
  const first = { x: s.x + Math.sign(to.x - s.x), y: s.y + (to.x === s.x ? Math.sign(to.y - s.y) : 0) };
  s.setPosition(first.x, first.y);
  const tw = sc.tweens.add({
    targets: s,
    x: to.x,
    y: to.y,
    duration: 70,
    ease: 'Quad.Out',
    onUpdate: () => s.setPosition(rnd(s.x), rnd(s.y)),
    onComplete: () => {
      if (o.hold || !s.active) return;
      const back = sc.tweens.add({
        targets: s,
        x: base.x,
        y: base.y,
        delay: 140,
        duration: o.backMs ?? 220,
        ease: 'Quad.InOut',
        onUpdate: () => s.setPosition(rnd(s.x), rnd(s.y)),
      });
      pulls.set(s, back);
    },
  });
  pulls.set(s, tw);
}
