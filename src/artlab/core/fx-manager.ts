// Art Lab effect manager.
//
// An effect is declared as a time window + a factory. Every frame the manager makes sure that
// EXACTLY the effects whose window contains the lab time exist: it creates them lazily and
// destroys them as soon as the time leaves their window (or when effects are switched off).
// Rendering is a pure function of the effect's local time, so pause / speed / seek / restart can
// never leave stale particles or half-finished effects behind.

import Phaser from 'phaser';
import { LAB_DEPTH } from '../types';

/** Game objects owned by one live effect instance; destroyed together. */
export class Bag {
  readonly objs: Phaser.GameObjects.GameObject[] = [];
  lights = 0;
  /** Particles drawn by this instance in its last render (stats only). */
  particles = 0;

  constructor(readonly scene: Phaser.Scene) {}

  add<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.objs.push(o);
    return o;
  }

  /** Pixel sprite (origin 0, integer placement via place()). Hidden until placed. */
  image(key: string, frame: string | number = 0, depth: number = LAB_DEPTH.FX): Phaser.GameObjects.Image {
    return this.add(this.scene.add.image(0, 0, key, String(frame)).setOrigin(0, 0).setDepth(depth).setVisible(false));
  }

  graphics(depth: number = LAB_DEPTH.FX): Phaser.GameObjects.Graphics {
    return this.add(this.scene.add.graphics().setDepth(depth));
  }

  /** Soft additive light (white baked glow texture tinted with `color`). Hidden until placed. */
  light(key: string, color: number, depth: number = LAB_DEPTH.LIGHT): Phaser.GameObjects.Image {
    this.lights++;
    return this.add(
      this.scene.add.image(0, 0, key, '0').setOrigin(0, 0).setDepth(depth).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
    );
  }

  destroy(): void {
    for (const o of this.objs) o.destroy();
    this.objs.length = 0;
    this.lights = 0;
    this.particles = 0;
  }
}

/** Centre a sprite's frame on world pixel (x, y), integer-snapped. */
export function place(img: Phaser.GameObjects.Image, x: number, y: number, frame?: string | number, alpha = 1): Phaser.GameObjects.Image {
  if (frame !== undefined && img.frame.name !== String(frame)) img.setFrame(String(frame));
  const fw = img.frame.width;
  const fh = img.frame.height;
  img.setPosition(Math.round(x) - (fw >> 1), Math.round(y) - (fh >> 1));
  img.setAlpha(alpha);
  img.setVisible(alpha > 0.001);
  return img;
}

export interface Effect {
  /** Draw the effect at local time `local` (ms since its origin on its clock). Pure. */
  render(local: number): void;
}

export interface EffectSpec {
  name: string;
  /** Lab-time window [start, end). */
  start: number;
  end: number;
  /** Which clock the local time is measured on: action time holds during hit-stops. */
  clock: 'action' | 'lab';
  /** Zero of the local time on that clock. */
  origin: number;
  make(bag: Bag): Effect;
}

interface Live {
  bag: Bag;
  fx: Effect;
}

export class EffectManager {
  private specs: EffectSpec[] = [];
  private readonly live = new Map<number, Live>();
  enabled = true;

  constructor(private readonly scene: Phaser.Scene) {}

  setSpecs(specs: EffectSpec[]): void {
    this.clear();
    this.specs = specs;
  }

  /** Bring the live set in line with lab time `t` (action time `a`) and render it. */
  update(t: number, a: number): void {
    for (let i = 0; i < this.specs.length; i++) {
      const s = this.specs[i];
      const on = this.enabled && t >= s.start && t < s.end;
      let inst = this.live.get(i);
      if (on && !inst) {
        const bag = new Bag(this.scene);
        inst = { bag, fx: s.make(bag) };
        this.live.set(i, inst);
      } else if (!on && inst) {
        inst.bag.destroy();
        this.live.delete(i);
        inst = undefined;
      }
      if (inst) inst.fx.render(s.clock === 'action' ? a - s.origin : t - s.origin);
    }
  }

  clear(): void {
    for (const l of this.live.values()) l.bag.destroy();
    this.live.clear();
  }

  destroy(): void {
    this.clear();
    this.specs = [];
  }

  stats(): { activeEffects: number; fxObjects: number; lights: number; particles: number; names: string[] } {
    let fxObjects = 0;
    let lights = 0;
    let particles = 0;
    const names: string[] = [];
    for (const [i, l] of this.live) {
      fxObjects += l.bag.objs.length;
      lights += l.bag.lights;
      particles += l.bag.particles;
      names.push(this.specs[i]?.name ?? '?');
    }
    return { activeEffects: this.live.size, fxObjects, lights, particles, names };
  }

  /** All declared windows (debug / README). */
  list(): { name: string; start: number; end: number }[] {
    return this.specs.map((s) => ({ name: s.name, start: s.start, end: s.end }));
  }
}
