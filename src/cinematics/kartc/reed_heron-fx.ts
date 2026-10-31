// Sazlık Balıkçılı (reed_heron) — the card's own effect painters for its v3 cinematics (./reed_heron.ts).
// Registers nothing. Everything here is flat palette pixels (no alpha, no ADD tint: palcheck), on the scene clock.
//
//   Ground       the still-water patch + the reeds (+ the low ankle mist, + the death's ripple ring) as an image
//                standing on the heron's tile, drawn by the art's own rig (drawHeron with the heron hidden): the
//                pond stays HOME while he glides out to strike, and only the ground remains when the mist has
//                taken him. P2: the relit sheet ('right' light) flipped, like the sprite.
//   MistBands    horizontal fog bands in world space (two rows of flat stepped runs: steel over night4, a few
//                mist crests): the summon's wall that rolls in from both sides and parts, the death's bank.
//   GlideTrail   the mist streaks the bob-less glide leaves behind (three heights, steel → night4 → gone) and the
//                1-px ripple dots its feet leave on the floor.

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import { AX, GY, H, W, drawHeron, pose, type Pose } from '../../art/monsters-v3/reed_heron-rig';
import type { MonsterUnit } from '../../duel/MonsterUnit';
import type { XY } from '../../view/layout';
import { Px, onFrame } from '../../vfx/combat';

const rnd = Math.round;

/** Deterministic 0…1 hash of integers. */
export function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// ================================================================ the ground (pond + reeds) as an image

let groundSeq = 0;

/** The ground layer fields a Ground keeps (the heron itself is never drawn). */
export type GroundPose = Partial<Pick<Pose, 'reed' | 'reedA' | 'reedFlat' | 'reedGrow' | 'rip' | 'ring' | 'mist' | 'mistK' | 't' | 'cover' | 'motes'>>;

/** Palette steps toward the dark board (one call = one step), null = gone. */
const DARKER: Record<number, number | null> = {
  [PAL.white]: PAL.mist,
  [PAL.mist]: PAL.steel,
  [PAL.steel]: PAL.night4,
  [PAL.night4]: PAL.night2,
  [PAL.water4]: PAL.water3,
  [PAL.water3]: PAL.water1,
  [PAL.water1]: PAL.night1,
  [PAL.water0]: PAL.night1,
  [PAL.night2]: PAL.night1,
  [PAL.night1]: PAL.night0,
  [PAL.night0]: null,
  [PAL.leaf2]: PAL.leaf1,
  [PAL.leaf1]: PAL.leaf0,
  [PAL.leaf0]: null,
  [PAL.earth2]: PAL.earth1,
  [PAL.earth1]: PAL.earth0,
  [PAL.earth0]: null,
  [PAL.ink]: PAL.night0,
};

export class Ground {
  readonly img: Phaser.GameObjects.Image;
  private readonly key: string;
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly light: 'left' | 'right';
  private cur = '';
  private dead = false;
  private o: Pose;
  /** Palette steps toward the board applied on top (the fade in steps), and the shrinking mask (1 = whole). */
  private dark = 0;
  private keep = 1;

  constructor(
    readonly scene: Phaser.Scene,
    u: MonsterUnit,
    at: XY,
    depth: number,
    o: GroundPose = {},
  ) {
    this.key = `rhr:ground:${++groundSeq}`;
    this.tex = scene.textures.createCanvas(this.key, W, H)!;
    this.light = u.flipX ? 'right' : 'left';
    const s = u.sprite;
    this.o = pose({ show: 0, pond: 1, eye: 0, drop: -1, ...o });
    this.img = scene.add.image(rnd(at.x), rnd(at.y), this.key).setOrigin(s.originX, s.originY).setFlipX(s.flipX).setDepth(depth);
    this.render();
    scene.events.once('shutdown', () => this.destroy());
  }

  /** Change the ground's phases (re-rendered only when something visible changed). */
  set(o: GroundPose): void {
    if (this.dead) return;
    this.o = { ...this.o, ...o };
    this.render();
  }

  /** One fade step: every tone one palette step darker toward the board, the patch shrinks toward its middle. */
  step(dark: number, keep: number): void {
    if (this.dead) return;
    this.dark = dark;
    this.keep = keep;
    this.render();
  }

  private render(): void {
    const o = this.o;
    const sig = `${rnd(o.reed * 48)}|${rnd(o.rip * 32)}|${rnd(o.mist * 48)}|${o.ring.toFixed(2)}|${o.mistK}|${o.reedFlat}|${o.reedGrow}|${o.cover.toFixed(2)}|${o.motes.toFixed(2)}|${this.dark}|${this.keep}`;
    if (sig === this.cur) return;
    this.cur = sig;
    const p = new PixelCanvas(W, H);
    drawHeron(p, o, this.light);
    for (let k = 0; k < this.dark; k++) p.map((c) => (c in DARKER ? DARKER[c] : c));
    if (this.keep < 1) {
      // the patch closes toward its middle in whole-pixel steps (an ellipse mask round the pond)
      const cx = AX + 5;
      const rx = 30 * this.keep;
      const ry = 26 * this.keep;
      p.map((c, x, y) => {
        const dx = (x + 0.5 - cx) / Math.max(0.5, rx);
        const dy = (y + 0.5 - (GY - 8)) / Math.max(0.5, ry);
        return dx * dx + dy * dy <= 1 ? c : null;
      });
    }
    this.tex.context.putImageData(new ImageData(new Uint8ClampedArray(p.data), W, H), 0, 0);
    this.tex.refresh();
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    if (this.img.active) this.img.destroy();
    if (this.scene.textures.exists(this.key)) this.scene.textures.remove(this.key);
  }
}

// ================================================================ world mist bands

export interface Band {
  /** Window [x0, x1] and row y (world px). */
  x0: number;
  x1: number;
  y: number;
  /** Scroll offset of the stepped runs (px) and a seed. */
  off: number;
  seed: number;
  /** 0 normal, 1 thin (wisps), 2 the darker far tone only. */
  tone?: 0 | 1 | 2;
}

/**
 * Paint one band (two rows of flat runs in a 24-px period, gaps where the hash says so, frayed ends): the
 * rig's mist language, in world space.
 */
export function paintBand(px: Px, b: Band): void {
  const x0 = rnd(b.x0);
  const x1 = rnd(b.x1);
  const y = rnd(b.y);
  if (x1 - x0 < 3) return;
  const off = rnd(b.off);
  for (let row = 0; row < 2; row++) {
    let runC = -1;
    let runX = 0;
    const flush = (x: number) => {
      if (runC >= 0 && x > runX) px.run(y + row, runX, x - 1, runC);
      runC = -1;
    };
    for (let x = x0; x <= x1; x++) {
      const u = (((x - off * (row ? 1 : -1) + b.seed * 5 + row * 2) % 24) + 24) % 24;
      const cell = Math.floor(u / 4);
      const h = hash(cell, b.seed, row);
      const edge = Math.min(x - x0, x1 - x);
      let c = -1;
      const gap = b.tone === 1 ? 0.62 : row === 0 ? 0.42 : 0.3;
      if (!(h < gap || (edge < 3 && h < 0.66) || edge < 1)) {
        if (b.tone === 2) c = row === 0 ? PAL.night4 : PAL.night2;
        else c = row === 0 ? (h > 0.86 ? PAL.mist : PAL.steel) : h > 0.82 ? PAL.steel : PAL.night4;
      }
      if (c !== runC) {
        flush(x);
        if (c >= 0) {
          runC = c;
          runX = x;
        }
      }
    }
    flush(x1 + 1);
  }
}

// ================================================================ the glide trail + ripple dots

interface Streak {
  x0: number;
  x1: number;
  y: number;
  age: number;
}
interface Dot {
  x: number;
  y: number;
  age: number;
}

/**
 * The mist streaks a glide leaves behind (three heights over the feet, horizontal, stepped out by age) and the
 * ripple dots of its strides. Feed it the feet point every frame with `at()`, drop a dot with `dot()`.
 */
export class GlideTrail {
  private readonly streaks: Streak[] = [];
  private readonly dots: Dot[] = [];
  private last: XY | null = null;
  private closed = false;
  private readonly stop: () => void;

  constructor(
    readonly scene: Phaser.Scene,
    private readonly air: Px,
    private readonly floor: Px,
    private readonly dir: 1 | -1,
  ) {
    this.stop = onFrame(scene, (dt) => this.tick(dt), () => this.kill());
  }

  /** The glider's feet now (world). */
  at(p: XY): void {
    if (this.closed) return;
    const q = { x: rnd(p.x), y: rnd(p.y) };
    if (this.last && Math.abs(q.x - this.last.x) + Math.abs(q.y - this.last.y) > 0) {
      // three heights over the feet (low skirt, mid body, the cloak hem), each a horizontal dash behind the body
      const rows: [number, number][] = [[-30, 10], [-22, 14], [-9, 18]];
      for (const [dy, back] of rows) {
        const xa = this.last.x - this.dir * back;
        const xb = q.x - this.dir * back;
        this.streaks.push({ x0: Math.min(xa, xb), x1: Math.max(xa, xb), y: rnd((this.last.y + q.y) / 2) + dy, age: 0 });
      }
    }
    this.last = q;
  }

  /** A stride's 1-px ripple dot on the floor under a foot. */
  dot(p: XY): void {
    this.dots.push({ x: rnd(p.x), y: rnd(p.y), age: 0 });
  }

  /** No more input: the marks finish on their own. */
  close(): void {
    this.closed = true;
  }

  private tick(dt: number): boolean {
    this.air.clear();
    this.floor.clear();
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const s = this.streaks[i];
      s.age += dt;
      if (s.age > 330) {
        this.streaks.splice(i, 1);
        continue;
      }
      // fresh: steel with a mist crest; then night4; the front end frays back as it ages
      const c = s.age < 110 ? PAL.steel : s.age < 220 ? PAL.night4 : PAL.night2;
      const fray = rnd((s.age / 330) * (s.x1 - s.x0) * 0.5);
      const x0 = this.dir > 0 ? s.x0 : s.x0 + fray;
      const x1 = this.dir > 0 ? s.x1 - fray : s.x1;
      if (x1 >= x0) this.air.run(s.y, x0, x1, c);
      if (s.age < 70 && x1 > x0 + 2) this.air.dot(this.dir > 0 ? x1 : x0, s.y, PAL.mist);
    }
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const d = this.dots[i];
      d.age += dt;
      if (d.age > 460) {
        this.dots.splice(i, 1);
        continue;
      }
      // a 1-px ellipse that widens once: water3 → water1 → night2
      const k = d.age < 150 ? 0 : d.age < 300 ? 1 : 2;
      const c = k === 0 ? PAL.water3 : k === 1 ? PAL.water1 : PAL.night2;
      const r = 2 + k;
      this.floor.dot(d.x - r, d.y, c).dot(d.x + r, d.y, c).dot(d.x - r + 1, d.y - 1, c).dot(d.x + r - 1, d.y - 1, c).dot(d.x - r + 1, d.y + 1, c).dot(d.x + r - 1, d.y + 1, c);
      for (let x = d.x - r + 2; x <= d.x + r - 2; x++) {
        this.floor.dot(x, d.y - 1 - (k > 0 ? 0 : 0), c);
        this.floor.dot(x, d.y + 1, c);
      }
    }
    return !(this.closed && !this.streaks.length && !this.dots.length);
  }

  private kill(): void {
    this.air.g.destroy();
    this.floor.g.destroy();
  }

  destroy(): void {
    this.stop();
  }
}
