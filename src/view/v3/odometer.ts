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
//
// LpCounter (F3, B2) — the LP number as a mechanical counter: every digit turns on its own wheel
// behind its own window (a 1-px frame with cut corners round an ink inside; the counter keeps at
// least four windows, a leading zero sits dim). A change COUNTS: the finest changing wheel clicks
// from digit to digit (each click a whole-pixel turn in the middle of its step, the wheel resting on
// the digits in between), every wheel above it turns only while the one below passes 9 → 0 (the
// carry), so the ones turn fastest and the upper wheels only when they change. While a wheel turns,
// the rows at its window's top and bottom edge show one tone down (the drum's curve).
//
//   const lp = new LpCounter(scene, panel, 20, 11, 4000);
//   await lp.count(3500, { ms: 360, onClick: (i, n) => tick() });   // 0 → 9 → 8 → 7 → 6 → 5, 4 → 3

import type Phaser from 'phaser';
import { PAL, RAMPS } from '../../art/palette';
import { PixelCanvas } from '../../art/pixel';
import type { TextSize } from '../../ui/text';
import { REDUCED_MOTION, settle } from './motion';
import { canvasTexture, glyphTexture, layoutLine } from './hudSkin';

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

// ================================================================ LP counter (F3, lane A6-B step B2)

/**
 * The LP counter's geometry, in the glyph box of the 'lg' digits (fill rows 8–21, cols 2–13, the
 * 2-px ink outline round them): each wheel turns behind a window — a 1-px frame with cut corners
 * round a 14 × 16 ink inside (box cols 1–14, rows 7–22) — the windows `pitch` px apart. The digits
 * on a wheel's strip are `strip` px apart, so one digit fills the window at rest.
 */
export const LP_WHEELS = Object.freeze({
  size: 'lg' as TextSize,
  /** Windows shown at least: the counter keeps its width (a leading zero sits dim). */
  min: 4,
  pitch: 17,
  /** The inside of a window in glyph-box coordinates: rows [top, bottom), cols [left, right). */
  top: 7,
  bottom: 23,
  left: 1,
  right: 15,
  /** px between two digits on a wheel's strip (the inside's height). */
  strip: 16,
  /** Rows at the inside's top and bottom drawn one tone down while a wheel turns. */
  edge: 2,
  /** The window frame, the inside, a leading zero and its turning edge. */
  frame: PAL.night3,
  inside: PAL.ink,
  lead: PAL.night3,
  leadEdge: PAL.night2,
  /** The roll: one click takes rollMinMs, every further click 50 ms more, at most rollMs (F3: 0–360). */
  rollMs: 360,
  rollMinMs: 210,
  /** More unit clicks than this and the counter counts in the next power of ten. */
  maxClicks: 60,
});

/** Neutral tones dark → light (a digit's turning edge is one step down). */
const NEUTRAL_STEPS: readonly number[] = [PAL.ink, PAL.night0, PAL.night1, PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white];

/** One palette step darker on the tone's own ramp (white → mist, crim3 → crim2, leaf3 → leaf2 …). */
export function toneDown(c: number): number {
  const n = NEUTRAL_STEPS.indexOf(c);
  if (n > 0) return NEUTRAL_STEPS[n - 1];
  for (const r of Object.values(RAMPS) as readonly (readonly number[])[]) {
    const i = r.indexOf(c);
    if (i > 0) return r[i - 1];
  }
  return c;
}

/** Number of decimal digits of a non-negative integer (0 → 1). */
export function digitCount(v: number): number {
  return Math.max(1, String(Math.max(0, Math.round(v))).length);
}

/**
 * The power of ten the counter counts in from `from` to `to`: the finer of the two values' trailing
 * zeros (at most 2: LP moves in hundreds), coarser while that would take more than maxClicks clicks.
 */
export function countUnit(from: number, to: number): number {
  const tz = (v: number): number => {
    if (v === 0) return 9;
    let k = 0;
    while (k < 9 && v % 10 ** (k + 1) === 0) k++;
    return k;
  };
  let k = Math.min(tz(Math.round(from)), tz(Math.round(to)), 2);
  while (Math.abs(to - from) / 10 ** k > LP_WHEELS.maxClicks) k++;
  return k;
}

/** The roll's length for `clicks` unit clicks (1 click 210 ms … 360 ms from 4 clicks on), at most `cap`. */
export function lpRollMs(clicks: number, cap: number = LP_WHEELS.rollMs): number {
  const ms = Math.min(LP_WHEELS.rollMs, Math.max(LP_WHEELS.rollMinMs, 160 + 50 * Math.ceil(clicks)));
  return Math.max(1, Math.min(cap, ms));
}

/** The count's ease (quad out): fast clicks first, the last ones slower. */
export function lpEase(t: number): number {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return 1 - (1 - k) * (1 - k);
}

/** The detent: a wheel rests on a digit and turns to the next within the middle half of each unit step. */
export function detent(u: number): number {
  const b = Math.floor(u);
  return b + Math.min(1, Math.max(0, (u - b - 0.25) / 0.5));
}

/**
 * The wheels' positions (index 0 = the ones wheel, a real number: digit = floor mod 10, the fraction
 * how far it has turned to the next) for the counter value `v` counting in 10^k: wheel k turns with
 * the count (detented clicks); each wheel above turns only while the one below passes 9 → 0 (the
 * carry); the wheels below k show `low` (their digits).
 */
export function wheelPositions(v: number, n: number, k: number, low: readonly number[] = []): number[] {
  const out: number[] = [];
  for (let j = 0; j < Math.min(k, n); j++) out.push(low[j] ?? 0);
  if (k >= n) return out;
  let w = detent(v / 10 ** k);
  out.push(w);
  for (let j = k + 1; j < n; j++) {
    const m = ((w % 10) + 10) % 10;
    w = Math.floor(w / 10) + Math.max(0, m - 9);
    out.push(w);
  }
  return out;
}

/** The digits of `v` below 10^k (index 0 = ones). */
function lowDigits(v: number, k: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < k; j++) out.push(Math.floor(v / 10 ** j) % 10);
  return out;
}

const mod10 = (x: number): number => ((Math.floor(x) % 10) + 10) % 10;

interface LpWheel {
  /** Glyph-box left x (relative to the counter). */
  x: number;
  /** [A mid, A top edge, A bottom edge, B mid, B top edge, B bottom edge]: A the digit floor(pos), B the next. */
  imgs: Phaser.GameObjects.Image[];
}

export class LpCounter {
  readonly root: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;
  private bg: Phaser.GameObjects.Image | null = null;
  private wheels: LpWheel[] = [];
  private value = 0;
  private tone: number = PAL.white;
  /** The tone of the wheel that counted last (the landing flash), or null. */
  private unitTone: number | null = null;
  /** Index (0 = ones) of the wheel that counts fastest in the current / last count. */
  private unitJ = 0;
  /** The running count: its tween, the value it last drew and its unit power. */
  private spin: { tween: Phaser.Tweens.Tween; v: number; k: number; finish(): void } | null = null;
  /** The last drawn state (so a tone change can redraw it). */
  private drawn: { pos: number[]; moving: boolean } | null = null;

  /** (x, y): the glyph box top-left of the leftmost wheel (whole pixels). */
  constructor(scene: Phaser.Scene, parent: Phaser.GameObjects.Container | null, x: number, y: number, value: number) {
    this.scene = scene;
    this.root = scene.add.container(Math.round(x), Math.round(y));
    if (parent) parent.add(this.root);
    this.set(value);
  }

  /** The value shown now (the running count's current value, to the unit). */
  get shown(): number {
    if (!this.spin) return this.value;
    const u = 10 ** this.spin.k;
    return Math.max(0, Math.round(this.spin.v / u) * u);
  }

  /** The value the counter rests on (the target of a running count). */
  get target(): number {
    return this.value;
  }

  /** Width in px of the window row. */
  get width(): number {
    return this.wheels.length * LP_WHEELS.pitch - 1;
  }

  /** A count is running. */
  get counting(): boolean {
    return this.spin !== null;
  }

  /** The glyph-box left x of the wheel that counts fastest (relative to the counter). */
  get unitX(): number {
    const w = this.wheels[this.wheels.length - 1 - this.unitJ];
    return w ? w.x : 0;
  }

  /** Show `value` at once (a running count stops). */
  set(value: number): this {
    this.halt();
    this.value = Math.max(0, Math.round(value));
    this.fit(Math.max(LP_WHEELS.min, digitCount(this.value)));
    this.draw(wheelPositions(this.value, this.wheels.length, 0), false);
    return this;
  }

  /** The digits' tone (a leading zero keeps its dim tone). */
  setTone(c: number): this {
    if (c === this.tone) return this;
    this.tone = c;
    this.redraw();
    return this;
  }

  get currentTone(): number {
    return this.tone;
  }

  /** A tone for the wheel that counted fastest only (the landing flash), null = back to the digits' tone. */
  setUnitTone(c: number | null): this {
    if (c === this.unitTone) return this;
    this.unitTone = c;
    this.redraw();
    return this;
  }

  /**
   * Count to `value` (see the header): resolves when every wheel rests. `onClick(i, n)` fires each
   * time the fastest wheel shows its next digit (i of n clicks); `onLand` when the count completes,
   * inside the frame's update (so a one-frame flash set there is rendered). Reduced motion: no
   * turning — the number changes in three steps (F3 AH).
   */
  count(value: number, o: { ms?: number; maxMs?: number; onClick?: (i: number, n: number) => void; onLand?: () => void } = {}): Promise<void> {
    const from = this.halt();
    const to = Math.max(0, Math.round(value));
    if (to === from || !this.root.active) {
      this.set(to);
      return Promise.resolve();
    }
    this.fit(Math.max(LP_WHEELS.min, digitCount(from), digitCount(to)));
    const n = this.wheels.length;
    const k = Math.min(countUnit(from, to), n - 1);
    const unit = 10 ** k;
    const clicks = Math.max(1, Math.round(Math.abs(to - from) / unit));
    const ms = Math.max(1, o.ms ?? lpRollMs(clicks, o.maxMs));
    this.value = to;
    this.unitJ = k;
    if (REDUCED_MOTION) return this.steps(from, to, unit, ms, o.onClick, o.onLand);
    const lowFrom = lowDigits(from, k);
    const lowTo = lowDigits(to, k);
    // the fastest wheel's position counts whole units (not mod 10): its rounded value is the click
    const startUnit = Math.round(wheelPositions(from, n, k, lowFrom)[k]);
    let shownUnit = startUnit;
    const frame = (t: number): void => {
      if (!this.spin) return;
      const e = lpEase(t);
      const v = from + (to - from) * e;
      this.spin.v = v;
      const pos = wheelPositions(v, n, k, e < 0.5 ? lowFrom : lowTo);
      this.draw(pos, t < 1);
      const u = Math.round(pos[k]);
      if (u !== shownUnit) {
        shownUnit = u;
        o.onClick?.(Math.min(clicks, Math.abs(u - startUnit)), clicks);
      }
    };
    return new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.spin = null;
        if (this.root.active) {
          this.fit(Math.max(LP_WHEELS.min, digitCount(to)));
          this.draw(wheelPositions(to, this.wheels.length, 0), false);
        }
        resolve();
      };
      const tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: ms,
        onUpdate: (tw) => !done && frame(tw.getValue() ?? 0),
        onComplete: () => {
          const landing = !done;
          finish();
          if (landing) o.onLand?.();
        },
        onStop: finish,
      });
      this.spin = {
        tween,
        v: from,
        k,
        finish: () => {
          tween.stop();
          finish();
        },
      };
      frame(0);
    });
  }

  /** Stop a running count where it is, on the nearest whole unit; returns the value then shown. */
  halt(): number {
    const s = this.spin;
    if (!s) return this.value;
    const shown = this.shown;
    this.spin = null;
    s.tween.stop();
    this.value = shown;
    if (this.root.active) this.draw(wheelPositions(shown, this.wheels.length, 0), false);
    return shown;
  }

  destroy(): void {
    this.halt();
    if (this.root.active) this.root.destroy();
    this.wheels = [];
    this.bg = null;
  }

  // ---------------------------------------------------------------- internals

  /** Reduced motion (F3 AH): the number changes in three steps, no wheel turns. */
  private steps(from: number, to: number, unit: number, ms: number, onClick?: (i: number, n: number) => void, onLand?: () => void): Promise<void> {
    const vals = [1, 2, 3].map((i) => (i === 3 ? to : Math.round((from + ((to - from) * i) / 3) / unit) * unit));
    const n = this.wheels.length;
    let i = 0;
    const show = (): void => {
      const v = vals[i++];
      if (this.root.active) this.draw(wheelPositions(v, n, 0), false);
      onClick?.(i, vals.length);
    };
    return new Promise((resolve) => {
      let done = false;
      const finish = (): void => {
        if (done) return;
        done = true;
        this.spin = null;
        if (this.root.active) this.draw(wheelPositions(to, this.wheels.length, 0), false);
        resolve();
      };
      const third = ms / 3;
      const tween = this.scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration: Math.max(1, 2 * third),
        onUpdate: (tw) => {
          if (done || !this.spin) return;
          const t = (tw.getValue() ?? 0) * 2 * third;
          while (i < vals.length - 1 && t >= i * third) show();
          this.spin.v = vals[Math.max(0, i - 1)];
        },
        onComplete: () => {
          const landing = !done;
          while (i < vals.length) show();
          finish();
          if (landing) onLand?.();
        },
        onStop: finish,
      });
      this.spin = {
        tween,
        v: from,
        k: 0,
        finish: () => {
          tween.stop();
          finish();
        },
      };
      show();
    });
  }

  /** Make room for n windows (the window row is one cached texture per count). */
  private fit(n: number): void {
    if (n === this.wheels.length && this.bg) return;
    for (const w of this.wheels) for (const img of w.imgs) img.destroy();
    this.bg?.destroy();
    const W = LP_WHEELS;
    const key = canvasTexture(this.scene, `ui3:lp:windows:${n}`, () => lpWindowsCanvas(n));
    this.bg = this.scene.add.image(0, W.top - 1, key).setOrigin(0);
    this.root.add(this.bg);
    this.wheels = [];
    for (let i = 0; i < n; i++) {
      const imgs: Phaser.GameObjects.Image[] = [];
      for (let s = 0; s < 6; s++) {
        const img = this.scene.add.image(0, 0, this.key(0, PAL.white)).setOrigin(0).setVisible(false);
        this.root.add(img);
        imgs.push(img);
      }
      this.wheels.push({ x: i * W.pitch, imgs });
    }
    this.drawn = null;
  }

  private key(digit: number, color: number): string {
    return glyphTexture(this.scene, 48 + digit, LP_WHEELS.size, color);
  }

  private redraw(): void {
    if (this.drawn) this.draw(this.drawn.pos, this.drawn.moving);
  }

  /**
   * Draw every wheel at its position (index 0 = the ones wheel). A turning wheel (`moving` and a
   * fractional position) shows its two digits cut by the window, the edge rows one tone down; a
   * resting one its digit alone. Leading zeros take the dim tone.
   */
  private draw(pos: readonly number[], moving: boolean): void {
    if (!this.root.active) return;
    this.drawn = { pos: [...pos], moving };
    const n = this.wheels.length;
    const W = LP_WHEELS;
    let lead = true;
    for (let j = n - 1; j >= 0; j--) {
      const w = this.wheels[n - 1 - j];
      const p = pos[j] ?? 0;
      const base = Math.floor(p);
      const f = p - base;
      lead = lead && j > 0 && mod10(Math.round(p)) === 0;
      const tone = lead ? W.lead : j === this.unitJ && this.unitTone !== null ? this.unitTone : this.tone;
      const edge = lead ? W.leadEdge : toneDown(tone);
      const turning = moving && f > 1e-6;
      const dy = -Math.round(f * W.strip);
      this.glyph(w, 0, mod10(base), w.x, dy, tone, edge, turning);
      if (turning && dy !== 0) this.glyph(w, 1, mod10(base + 1), w.x, dy + W.strip, tone, edge, true);
      else for (let s = 3; s < 6; s++) w.imgs[s].setVisible(false);
    }
  }

  /** One digit of a wheel (slot 0 or 1) at vertical offset dy, as up to three bands cut by the window. */
  private glyph(w: LpWheel, slot: 0 | 1, digit: number, x: number, dy: number, tone: number, edge: number, turning: boolean): void {
    const W = LP_WHEELS;
    const [mid, top, bot] = w.imgs.slice(slot * 3, slot * 3 + 3);
    if (!turning) {
      this.band(mid, this.key(digit, tone), x, dy, W.top, W.bottom);
      top.setVisible(false);
      bot.setVisible(false);
      return;
    }
    this.band(mid, this.key(digit, tone), x, dy, W.top + W.edge, W.bottom - W.edge);
    this.band(top, this.key(digit, edge), x, dy, W.top, W.top + W.edge);
    this.band(bot, this.key(digit, edge), x, dy, W.bottom - W.edge, W.bottom);
  }

  /** Show the glyph rows that fall in [from, to) of the box at offset dy, cut to the window's inside columns. */
  private band(img: Phaser.GameObjects.Image, key: string, x: number, dy: number, from: number, to: number): void {
    const W = LP_WHEELS;
    if (img.texture.key !== key) img.setTexture(key);
    const top = Math.max(0, from - dy);
    const bottom = Math.min(img.height, to - dy);
    if (bottom <= top) {
      img.setVisible(false);
      return;
    }
    img.setPosition(x, dy).setVisible(true);
    img.setCrop(W.left, top, W.right - W.left, bottom - top);
  }
}

/** The window row of n wheels: per window a 1-px frame with cut corners round an ink inside. */
export function lpWindowsCanvas(n: number): PixelCanvas {
  const W = LP_WHEELS;
  const ww = W.right - W.left + 2;
  const wh = W.bottom - W.top + 2;
  const p = new PixelCanvas(n * W.pitch - 1, wh);
  for (let i = 0; i < n; i++) {
    const x0 = i * W.pitch + W.left - 1;
    p.rect(x0 + 1, 1, ww - 2, wh - 2, W.inside);
    p.hline(x0 + 1, x0 + ww - 2, 0, W.frame).hline(x0 + 1, x0 + ww - 2, wh - 1, W.frame);
    p.vline(x0, 1, wh - 2, W.frame).vline(x0 + ww - 1, 1, wh - 2, W.frame);
  }
  return p;
}
