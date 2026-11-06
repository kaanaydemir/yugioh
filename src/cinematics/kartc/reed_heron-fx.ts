// Sazlık Balıkçılı (reed_heron) — the card's own effect painters for its v3 cinematics (./reed_heron.ts).
// Registers nothing. Everything here is flat palette pixels (no alpha, no ADD tint: palcheck), on the scene clock.
//
//   Ground       the still-water patch + the reeds (+ the low ankle mist, + the death's ripple ring) as an image
//                standing on the heron's tile, drawn by the art's own rig (drawHeron with the heron hidden): the
//                pond stays HOME while he glides out to strike, and only the ground remains when the mist has
//                taken him. P2: the relit sheet ('right' light) flipped, like the sprite.
//   (the mist itself is one shape for every moment: the WISP of src/art/monsters-v3/reed_heron-mist.ts)
//   Pinpoint     the contact mark: three nicks → the triangle outline + a 4-ray star on the third point.
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
      if (s.age > 420) {
        this.streaks.splice(i, 1);
        continue;
      }
      // a two-row stepped band: steel over night4 while fresh, then night4 over night2, then a last night2 row; the
      // front end frays back in 3-px steps as it ages (it lasts 2–3 game frames at full strength)
      const top = s.age < 150 ? PAL.steel : s.age < 300 ? PAL.night4 : PAL.night2;
      const bot = s.age < 150 ? PAL.night4 : PAL.night2;
      const fray = 3 * Math.floor(((s.age / 420) * (s.x1 - s.x0) * 0.6) / 3);
      const x0 = this.dir > 0 ? s.x0 : s.x0 + fray;
      const x1 = this.dir > 0 ? s.x1 - fray : s.x1;
      if (x1 >= x0) {
        this.air.run(s.y, x0, x1, top);
        if (s.age < 300 && x1 - x0 > 4) this.air.run(s.y + 1, this.dir > 0 ? x0 : x0 + 3, this.dir > 0 ? x1 - 3 : x1, bot);
      }
      if (s.age < 90 && x1 > x0 + 2) this.air.dot(this.dir > 0 ? x1 : x0, s.y, PAL.mist);
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

// ================================================================ the needle light (exactly one frame)

/**
 * The thrust's needle light: a 1-px white line along the beak blade, reaching 5 px past the tip, shown for exactly
 * ONE rendered frame (counted in updates: the micro hit-stop freezes the scene clock, not the renderer). The art
 * frame itself carries no needle, so the out-hold shows the bare blade.
 */
export function needleFlash(scene: Phaser.Scene, depth: number, tip: XY, dir: 1 | -1): void {
  const px = new Px(scene.add.graphics().setDepth(depth));
  const x = rnd(tip.x);
  const y = rnd(tip.y);
  // the back two thirds ride the blade's top edge, the last third and the reach past the tip run on the tip row
  px.run(y - 1, Math.min(x - dir * 13, x - dir * 4), Math.max(x - dir * 13, x - dir * 4), PAL.white);
  px.run(y, Math.min(x - dir * 3, x + dir * 5), Math.max(x - dir * 3, x + dir * 5), PAL.white);
  let calls = 0;
  // (made after an await, i.e. after this step's render: it survives the next update, is rendered once, and goes
  // on the one after)
  onFrame(scene, () => calls++ < 2, () => px.g.destroy());
}

// ================================================================ the pinpoint: three nicks, one triangle, a star

/**
 * The heron's own contact mark (no shared round flash): every thrust leaves a NICK where its tip met the target —
 * a white point with a 1-px tail back toward the beak. When the third lands, the three nicks are joined into the
 * 6-px TRIANGLE (its 1-px outline, white) and four 1-px white rays, 4 px long, burst diagonally out of the third
 * point (the star of the pinpoint). The figure holds white for 3 rendered frames, then steps down mist → steel →
 * gone over ~200 ms. Nothing is drawn on the floor: the light layer lights the target (the caller's lightFlash).
 */
export class Pinpoint {
  private readonly air: Px;
  private readonly nicks: XY[] = [];
  /** Rendered frames since the third landed (-1: not yet) and the ms since. */
  private tri = -1;
  private triAge = 0;
  private dead = false;
  private readonly stop: () => void;

  constructor(
    readonly scene: Phaser.Scene,
    airDepth: number,
    private readonly dir: 1 | -1,
  ) {
    this.air = new Px(scene.add.graphics().setDepth(airDepth));
    this.stop = onFrame(scene, (dt) => this.tick(dt), () => this.kill());
  }

  /** A thrust's nick at the tip point (world). */
  nick(p: XY): void {
    this.nicks.push({ x: rnd(p.x), y: rnd(p.y) });
  }

  /** The third landed: the triangle and the star. */
  land(): void {
    this.tri = 0;
    this.triAge = 0;
  }

  /** No triangle will come (blocked, or the strike ended early): the marks go out at once. */
  close(): void {
    if (this.tri < 0) this.destroy();
  }

  /** A 1-px line between two points (whole pixels, the longer axis stepped). */
  private line(a: XY, b: XY, c: number): void {
    const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    for (let i = 0; i <= n; i++) {
      const t = n ? i / n : 0;
      this.air.dot(rnd(a.x + (b.x - a.x) * t), rnd(a.y + (b.y - a.y) * t), c);
    }
  }

  private tick(dt: number): boolean {
    if (this.dead) return false;
    this.air.clear();
    const d = this.dir;
    if (this.tri >= 0) {
      this.tri++;
      this.triAge += dt;
    }
    // lit while the triple runs; after the third: 3 frames white, then mist (~80 ms), steel (~80 ms), gone
    let tone: number | null = PAL.white;
    if (this.tri > 3) tone = this.triAge < 130 ? PAL.mist : this.triAge < 210 ? PAL.steel : null;
    if (tone !== null) {
      const landed = this.tri >= 1;
      if (landed && this.nicks.length >= 3) {
        const [a, b, c] = this.nicks;
        this.line(a, b, tone);
        this.line(b, c, tone);
        this.line(c, a, tone);
        // the star: four diagonal rays out of the third point (the inner pixel left dark so the point reads as a
        // point); the two pointing back at the beak are 1 px shorter. Lit (the 3 white frames) the rays are 5 / 4 px
        // — the TAK reads at 1× without the number — then they draw in by a pixel as the tones step down
        for (const [sx, sy] of [[1, -1], [1, 1], [-1, -1], [-1, 1]] as const) {
          const len = (sx === d ? 4 : 3) + (tone === PAL.white ? 1 : 0);
          for (let i = 2; i <= len + 1; i++) this.air.dot(c.x + sx * i, c.y + sy * i, i === len + 1 && tone === PAL.white ? PAL.mist : tone);
        }
      }
      this.nicks.forEach((n, i) => {
        this.air.dot(n.x, n.y, tone!);
        if (!landed) {
          // the tail: back toward the beak, the cut's direction
          this.air.dot(n.x - d, n.y, tone === PAL.white ? PAL.mist : tone!);
          this.air.dot(n.x - 2 * d, n.y, PAL.steel);
        } else if (i === 2) this.air.dot(n.x + d, n.y, tone!).dot(n.x - d, n.y, tone!).dot(n.x, n.y - 1, tone!).dot(n.x, n.y + 1, tone!);
      });
    }
    return this.tri < 0 || tone !== null;
  }

  private kill(): void {
    if (this.dead) return;
    this.dead = true;
    this.air.g.destroy();
  }

  destroy(): void {
    this.stop();
    this.kill();
  }
}
