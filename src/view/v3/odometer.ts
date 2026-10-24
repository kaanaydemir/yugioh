// Odometer — a number whose digits roll like a mechanical counter (docs/v3/A6_PLAN.md F1 tail: the
// turn badge's digit; F3 / B2 builds the LP odometer on the same digit cells). Lane A6-B, V3_A6_B only.
//
//   const odo = new Odometer(scene, container, 33, 1, 4, { size: 'md', align: 'center', clip: [1, 13] });
//   await odo.roll(5);                 // the changed digit rolls up out of its window, the new one in
//
// Every digit sits in a fixed cell (the widest digit of the font, so a rolling number never jiggles);
// glyphs are palette pixels with their ink outline (hudSkin glyph textures). A rolling digit moves on
// whole pixels (settle curve, ≤ 2 px per frame at the end) and is cut by its window with Image.setCrop
// — no mask, no alpha, no scale (KO-1 / KO-2). Unchanged digits stay put. REDUCED_MOTION (KO-9): no
// roll, the digits change in place. The clock is the scene's tween clock (speed / hit-stop aware).

import type Phaser from 'phaser';
import { PAL } from '../../art/palette';
import type { TextSize } from '../../ui/text';
import { REDUCED_MOTION, settle } from './motion';
import { glyphTexture, layoutLine } from './hudSkin';

export interface OdometerOpts {
  size?: TextSize;
  color?: number;
  /** How `x` anchors the number: its left edge, centre (default) or right edge. */
  align?: 'left' | 'center' | 'right';
  /** The visible window: rows [top, bottom) relative to the glyph box's top (default the whole box). */
  clip?: readonly [number, number];
  /** How far a digit travels out / in (px; default the cap height + 3). */
  travel?: number;
}

/** The cell geometry of a size: the widest digit's glyph box and the pen advance between cells. */
export function digitCell(size: TextSize): { w: number; h: number; advance: number } {
  let w = 0;
  let h = 0;
  for (let d = 0; d <= 9; d++) {
    const L = layoutLine(String(d), size);
    w = Math.max(w, L.w);
    h = Math.max(h, L.h);
  }
  // neighbouring glyphs share their outline column, as the font lays text out (letterSpacing −1)
  return { w, h, advance: w - 1 };
}

/** Left x (relative to the number's left edge) of each glyph of `text` in fixed digit cells. */
export function digitLayout(text: string, size: TextSize): { x: number; code: number; w: number }[] {
  const cell = digitCell(size);
  const out: { x: number; code: number; w: number }[] = [];
  [...text].forEach((ch, i) => {
    const L = layoutLine(ch, size);
    const g = L.glyphs[0];
    if (!g) return;
    out.push({ x: i * cell.advance + Math.floor((cell.w - L.w) / 2), code: g.code, w: L.w });
  });
  return out;
}

/** Width of `text` in fixed digit cells. */
export function digitWidth(text: string, size: TextSize): number {
  const n = [...text].length;
  const cell = digitCell(size);
  return n === 0 ? 0 : n * cell.advance + 1;
}

interface Cell {
  ch: string;
  img: Phaser.GameObjects.Image;
  /** Rest position (relative to the number's container). */
  x: number;
}

export class Odometer {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private readonly size: TextSize;
  private color: number;
  private readonly align: 'left' | 'center' | 'right';
  private readonly anchorX: number;
  private readonly clip: readonly [number, number];
  private readonly travel: number;
  private readonly boxH: number;
  private text = '';
  private cells: Cell[] = [];
  private rolling: { tween: Phaser.Tweens.Tween; finish(): void } | null = null;

  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, value: number | string, opts: OdometerOpts = {}) {
    this.scene = scene;
    this.size = opts.size ?? 'md';
    this.color = opts.color ?? PAL.white;
    this.align = opts.align ?? 'center';
    this.anchorX = Math.round(x);
    const cell = digitCell(this.size);
    this.boxH = cell.h;
    this.clip = opts.clip ?? [0, cell.h];
    this.travel = Math.max(1, Math.round(opts.travel ?? cell.h - 5));
    this.root = scene.add.container(0, Math.round(y));
    if (parent) parent.add(this.root);
    this.set(String(value));
  }

  get value(): string {
    return this.text;
  }

  get width(): number {
    return digitWidth(this.text, this.size);
  }

  setColor(color: number): this {
    if (color === this.color) return this;
    this.color = color;
    for (const c of this.cells) c.img.setTexture(this.key(c.ch));
    return this;
  }

  setVisible(b: boolean): this {
    this.root.setVisible(b);
    return this;
  }

  /** Show `value` at once (no roll). */
  set(value: number | string): this {
    this.rolling?.finish();
    const text = String(value);
    this.text = text;
    for (const c of this.cells) c.img.destroy();
    this.cells = this.build(text);
    for (const c of this.cells) this.place(c.img, c.x, 0);
    return this;
  }

  /**
   * Roll to `value`: each changed digit leaves its window and the new one comes in (dir +1: the new
   * digit rises from below, as a counter counting up; −1: it drops in from above). Digit counts may
   * differ (9 → 10: the number re-centres, every digit rolls). Resolves when settled.
   */
  roll(value: number | string, o: { ms?: number; dir?: 1 | -1; animate?: boolean } = {}): Promise<void> {
    this.rolling?.finish();
    const to = String(value);
    if (to === this.text || !this.root.active) return Promise.resolve();
    if (o.animate === false || REDUCED_MOTION) {
      this.set(to);
      return Promise.resolve();
    }
    const from = this.text;
    const sameLen = [...from].length === [...to].length;
    const oldCells = this.cells;
    const newCells = this.build(to);
    this.text = to;
    this.cells = newCells;
    // a digit rolls when it changed (or when the layout changed); unchanged ones stay where they are
    const moving = newCells.map((c, i) => !sameLen || oldCells[i]?.ch !== c.ch);
    const leaving = oldCells.filter((_c, i) => !sameLen || moving[i]);
    for (let i = 0; i < oldCells.length; i++) if (sameLen && !moving[i]) oldCells[i].img.destroy();
    const dir = o.dir ?? 1;
    const T = this.travel;
    const frame = (k: number) => {
      const off = settle(0, T, k);
      for (const c of leaving) this.place(c.img, c.x, -dir * off);
      newCells.forEach((c, i) => this.place(c.img, c.x, moving[i] ? dir * (T - off) : 0));
    };
    frame(0);
    const ms = Math.max(1, o.ms ?? 140);
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.rolling = null;
        for (const c of leaving) c.img.destroy();
        newCells.forEach((c) => this.place(c.img, c.x, 0));
        resolve();
      };
      const tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => !done && frame(tw.getValue() ?? 0),
        onComplete: finish,
        onStop: finish,
      });
      this.rolling = {
        tween,
        finish: () => {
          tween.stop();
          finish();
        },
      };
    });
  }

  destroy(): void {
    this.rolling?.finish();
    if (this.root.active) this.root.destroy();
    this.cells = [];
  }

  // ---------------------------------------------------------------- internals

  private key(ch: string): string {
    return glyphTexture(this.scene, ch.charCodeAt(0), this.size, this.color);
  }

  private build(text: string): Cell[] {
    const left = this.align === 'left' ? 0 : this.align === 'right' ? -digitWidth(text, this.size) : -Math.round(digitWidth(text, this.size) / 2);
    const cells: Cell[] = [];
    const L = digitLayout(text, this.size);
    [...text].forEach((ch, i) => {
      const g = L[i];
      if (!g) return;
      const img = this.scene.add.image(0, 0, this.key(ch)).setOrigin(0, 0);
      this.root.add(img);
      cells.push({ ch, img, x: this.anchorX + left + g.x });
    });
    return cells;
  }

  /** Put a glyph at (x, dy) and cut it to the window (whole pixels). */
  private place(img: Phaser.GameObjects.Image, x: number, dy: number): void {
    if (!img.active) return;
    const d = Math.round(dy);
    img.setPosition(x, d);
    const h = img.height;
    const top = Math.max(0, this.clip[0] - d);
    const bottom = Math.min(h, this.clip[1] - d);
    if (bottom <= top) {
      img.setVisible(false);
      return;
    }
    img.setVisible(true);
    if (top === 0 && bottom === h) img.setCrop();
    else img.setCrop(0, top, img.width, bottom - top);
  }

  /** (tests) the glyph box height of this size. */
  get glyphHeight(): number {
    return this.boxH;
  }
}
