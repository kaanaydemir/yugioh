// NEON DÜELLO logotype — chunky neon-tube letters drawn with PixelCanvas.
//
// Every letter is a set of centre-line paths rendered as a lit glass tube (white-hot core,
// ramp bands, lit from the top-left, 1px ink outline). Per letter we build four textures:
//   on   — the lit tube              off  — the unlit glass (dim night tones)
//   glow — stepped white halo (ADD + tint)   sil — white silhouette (chromatic fringes, flashes)
// plus one composite strip of light-sweep frames for the whole word.
//
// TitleLogo assembles them into a container (scrollFactor 0) and animates: flicker-on reveal,
// ignition flash, breathing glow, random flickers, chromatic glitches and sheen sweeps.

import Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { PixelCanvas, mix, mulberry32 } from '../../art/pixel';
import { sfx } from '../../audio/sfx';
import { TEX, tween, wait } from '../../vfx/core';

type Pt = readonly [number, number];

interface GlyphDef {
  /** Centre-line box width (the tube adds R on each side). */
  w: number;
  paths: { pts: Pt[]; closed?: boolean }[];
  dots?: Pt[];
}

/** Centre-line cap height. */
const H = 42;
/** Tube radius. */
const R = 5.6;
/** Padding around a glyph's centre-line box inside its textures (room for the glow). */
const PAD = 13;
/** Gap between neighbouring tube edges. */
const GAP = 5;
const WORD_GAP = 16;

function glyph(ch: string): GlyphDef {
  switch (ch) {
    case 'N': {
      const w = 28;
      return { w, paths: [{ pts: [[0, H], [0, 0], [w, H], [w, 0]] }] };
    }
    case 'E': {
      const w = 23;
      const c = 8;
      return {
        w,
        paths: [
          { pts: [[w, 0], [c, 0], [0, c], [0, H - c], [c, H], [w, H]] },
          { pts: [[0, H / 2], [w - 6, H / 2]] },
        ],
      };
    }
    case 'O': {
      const w = 30;
      const c = 10;
      return { w, paths: [{ pts: [[c, 0], [w - c, 0], [w, c], [w, H - c], [w - c, H], [c, H], [0, H - c], [0, c]], closed: true }] };
    }
    case 'D': {
      const w = 28;
      const c = 12;
      return { w, paths: [{ pts: [[0, 0], [w - c, 0], [w, c], [w, H - c], [w - c, H], [0, H]], closed: true }] };
    }
    case 'Ü': {
      const w = 28;
      const c = 10;
      const top = 15;
      return {
        w,
        paths: [{ pts: [[0, top], [0, H - c], [c, H], [w - c, H], [w, H - c], [w, top]] }],
        dots: [
          [3, 1.5],
          [w - 3, 1.5],
        ],
      };
    }
    case 'L': {
      const w = 21;
      const c = 8;
      return { w, paths: [{ pts: [[0, 0], [0, H - c], [c, H], [w, H]] }] };
    }
    default:
      return { w: 10, paths: [] };
  }
}

interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

function segments(g: GlyphDef): Seg[] {
  const out: Seg[] = [];
  for (const p of g.paths) {
    const n = p.pts.length;
    for (let i = 0; i < n - 1 + (p.closed ? 1 : 0); i++) {
      const a = p.pts[i];
      const b = p.pts[(i + 1) % n];
      out.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1] });
    }
  }
  for (const d of g.dots ?? []) out.push({ ax: d[0], ay: d[1], bx: d[0], by: d[1] });
  return out;
}

/** Distance from (x, y) to the nearest centre line, plus the unit vector from that point. */
function field(segs: Seg[], x: number, y: number): { d: number; nx: number; ny: number } {
  let best = Infinity;
  let vx = 0;
  let vy = 0;
  for (const s of segs) {
    const dx = s.bx - s.ax;
    const dy = s.by - s.ay;
    const l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * dx + (y - s.ay) * dy) / l2)) : 0;
    const px = s.ax + dx * t;
    const py = s.ay + dy * t;
    const ex = x - px;
    const ey = y - py;
    const d = Math.hypot(ex, ey);
    if (d < best) {
      best = d;
      vx = ex;
      vy = ey;
    }
  }
  const l = Math.hypot(vx, vy) || 1;
  return { d: best, nx: vx / l, ny: vy / l };
}

interface GlyphPixels {
  on: PixelCanvas;
  off: PixelCanvas;
  glow: PixelCanvas;
  sil: PixelCanvas;
  /** Brightest tube pixels (twinkle spots). */
  bright: Pt[];
  w: number;
  h: number;
}

const LX = -Math.SQRT1_2;
const LY = -Math.SQRT1_2;

function renderGlyph(ch: string, ramp: Ramp): GlyphPixels {
  const g = glyph(ch);
  const segs = segments(g);
  const w = Math.ceil(g.w + PAD * 2);
  const h = Math.ceil(H + PAD * 2);
  const on = new PixelCanvas(w, h);
  const off = new PixelCanvas(w, h);
  const glow = new PixelCanvas(w, h);
  const sil = new PixelCanvas(w, h);
  const bright: Pt[] = [];
  const offRamp = [PAL.night1, mix(PAL.night2, ramp[0], 0.35), mix(PAL.night3, ramp[1], 0.3), mix(PAL.night4, ramp[1], 0.35), mix(PAL.steel, ramp[2], 0.25)];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const f = field(segs, x + 0.5 - PAD, y + 0.5 - PAD);
      const d = f.d;
      if (d <= R) {
        const nl = f.nx * LX + f.ny * LY; // +1 = facing the light
        const k = d / R;
        const b = 1 - k + 0.42 * nl * k;
        const band = b > 0.8 ? 4 : b > 0.6 ? 3 : b > 0.36 ? 2 : b > 0.12 ? 1 : 0;
        const lit = [ramp[1], ramp[2], ramp[3], ramp[4], PAL.white][band];
        on.set(x, y, lit);
        if (band === 4 && (x + y * 3) % 5 === 0) bright.push([x, y]);
        off.set(x, y, offRamp[band]);
        sil.set(x, y, 0xffffff);
        // faint holo scan rows on the outer bands of the lit tube
        if ((y & 1) === 1 && band <= 2) on.set(x, y, mix(lit, ramp[0], 0.18));
        glow.set(x, y, 0xffffff, 150);
        continue;
      }
      const e = d - R;
      const a = e <= 2 ? 128 : e <= 4 ? 84 : e <= 6.5 ? 50 : e <= 9.5 ? 24 : e <= 12.5 ? 9 : 0;
      if (a > 0) glow.set(x, y, 0xffffff, a);
    }
  on.outline(PAL.ink);
  off.outline(PAL.ink);
  // the outline belongs to the silhouette too (fringes hug the inked edge)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on.isOpaque(x, y)) sil.set(x, y, 0xffffff);
  return { on, off, glow, sil, bright, w, h };
}

// ---------------------------------------------------------------- textures

export interface LogoLetter {
  ch: string;
  /** Top-left of the letter's padded textures, relative to the logo origin. */
  x: number;
  y: number;
  w: number;
  h: number;
  word: 0 | 1;
  keys: { on: string; off: string; glow: string; sil: string };
  bright: Pt[];
}

export interface LogoLayout {
  letters: LogoLetter[];
  /** Visible (inked) extent, relative to the logo origin. */
  w: number;
  h: number;
  /** Padded extent (glow included) — the sheen strip covers this. */
  padW: number;
  padH: number;
  sheenKey: string;
  sheenFrames: number;
}

const TEXT = ['NEON', 'DÜELLO'];
export const LOGO_RAMPS: [Ramp, Ramp] = [RAMPS.cyan, RAMPS.crim];
const SHEEN_FRAMES = 18;

let cachedLayout: LogoLayout | null = null;

/** Build (once per game) every logo texture and return the layout. */
export function buildLogo(scene: Phaser.Scene): LogoLayout {
  if (cachedLayout && scene.textures.exists(cachedLayout.sheenKey)) return cachedLayout;
  const letters: LogoLetter[] = [];
  const pixels: GlyphPixels[] = [];
  // Centre-line cursor. The inked logo starts at x = 0, so the first centre line sits at `edge`.
  const edge = Math.ceil(R + 1);
  let cx = edge;
  TEXT.forEach((word, wi) => {
    const ramp = LOGO_RAMPS[wi];
    if (wi > 0) cx += WORD_GAP + R * 2;
    [...word].forEach((ch, i) => {
      if (i > 0) cx += GAP + R * 2;
      const g = glyph(ch);
      const base = `title:logo:${ch}:${wi}`;
      const px = renderGlyph(ch, ramp);
      const keys = { on: `${base}:on`, off: `${base}:off`, glow: `${base}:glow`, sil: `${base}:sil` };
      const put = (k: string, p: PixelCanvas) => {
        if (!scene.textures.exists(k)) scene.textures.addCanvas(k, p.toCanvas());
      };
      put(keys.on, px.on);
      put(keys.off, px.off);
      put(keys.glow, px.glow);
      put(keys.sil, px.sil);
      letters.push({ ch, x: Math.round(cx - PAD), y: edge - PAD, w: px.w, h: px.h, word: wi as 0 | 1, keys, bright: px.bright });
      pixels.push(px);
      cx += g.w;
    });
  });
  const inkW = Math.ceil(cx + edge);
  const inkH = Math.ceil(H + edge * 2);

  // composite silhouette → diagonal light-sweep frames
  const padW = inkW + PAD * 2;
  const padH = inkH + PAD * 2;
  const comp = new PixelCanvas(padW, padH);
  letters.forEach((l, i) => comp.blit(pixels[i].sil, l.x + PAD, l.y + PAD));
  const sheenKey = 'title:logo:sheen';
  if (!scene.textures.exists(sheenKey)) {
    const strip = new PixelCanvas(padW, padH * SHEEN_FRAMES);
    const band = 26;
    for (let f = 0; f < SHEEN_FRAMES; f++) {
      const bx = -band + ((padW + band * 2 + padH * 0.6) * f) / (SHEEN_FRAMES - 1);
      for (let y = 0; y < padH; y++)
        for (let x = 0; x < padW; x++) {
          if (!comp.isOpaque(x, y)) continue;
          const u = Math.abs(x + (y - padH / 2) * 0.6 - bx);
          const a = u < 3 ? 235 : u < 7 ? 150 : u < 12 ? 70 : u < band / 2 + 4 ? 22 : 0;
          if (a > 0) strip.set(x, y + f * padH, 0xffffff, a);
        }
    }
    const tex = scene.textures.addCanvas(sheenKey, strip.toCanvas())!;
    for (let f = 0; f < SHEEN_FRAMES; f++) tex.add(`s:${f}`, 0, 0, f * padH, padW, padH);
  }
  cachedLayout = { letters, w: inkW, h: inkH, padW, padH, sheenKey, sheenFrames: SHEEN_FRAMES };
  return cachedLayout;
}

// ---------------------------------------------------------------- the animated logo

interface LetterView {
  def: LogoLetter;
  root: Phaser.GameObjects.Container;
  glow: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  chromaA: Phaser.GameObjects.Image;
  chromaB: Phaser.GameObjects.Image;
  off: Phaser.GameObjects.Image;
  on: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  /** 0 = unlit, 1 = lit. */
  lit: number;
  /** Extra glow multiplier for flashes. */
  boost: number;
  /** Horizontal glitch offset. */
  jx: number;
}

export interface LogoOpts {
  depth?: number;
  seed?: number;
  /** Play sounds (default true). */
  sound?: boolean;
}

/**
 * The animated logo. (x, y) is the top-left of the inked logo, in screen pixels (scrollFactor 0).
 *   const logo = new TitleLogo(scene, 320 - layout.w / 2, 30);
 *   await logo.reveal();      // flicker-on + ignition
 *   logo.startIdle();         // breathing, random flickers, glitches, sheen
 */
export class TitleLogo {
  readonly scene: Phaser.Scene;
  readonly layout: LogoLayout;
  readonly root: Phaser.GameObjects.Container;
  private readonly letters: LetterView[] = [];
  private readonly sheen: Phaser.GameObjects.Image;
  private readonly rnd: () => number;
  private readonly sound: boolean;
  private chroma = 1;
  private glowLevel = 0;
  private breath = 0;
  private idle = false;
  private idleTimers: Phaser.Time.TimerEvent[] = [];
  private readonly onUpdate: (t: number, dt: number) => void;
  private sparkleTimer: Phaser.Time.TimerEvent | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, opts: LogoOpts = {}) {
    this.scene = scene;
    this.layout = buildLogo(scene);
    this.rnd = mulberry32(opts.seed ?? 1977);
    this.sound = opts.sound ?? true;
    this.root = scene.add.container(Math.round(x), Math.round(y)).setScrollFactor(0).setDepth(opts.depth ?? 2000);
    const glows: Phaser.GameObjects.Image[] = [];
    const shadows: Phaser.GameObjects.Image[] = [];
    const chromas: Phaser.GameObjects.Image[] = [];
    const bodies: Phaser.GameObjects.Container[] = [];
    for (const def of this.layout.letters) {
      const ramp = LOGO_RAMPS[def.word];
      const img = (key: string) => scene.add.image(0, 0, key).setOrigin(0);
      const glow = img(def.keys.glow).setPosition(def.x, def.y).setBlendMode(Phaser.BlendModes.ADD).setTint(ramp[3]).setAlpha(0);
      const shadow = img(def.keys.sil).setPosition(def.x + 2, def.y + 3).setTint(PAL.ink).setAlpha(0);
      const chromaA = img(def.keys.sil).setPosition(def.x - 1, def.y).setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.cyan3).setAlpha(0);
      const chromaB = img(def.keys.sil).setPosition(def.x + 1, def.y).setBlendMode(Phaser.BlendModes.ADD).setTint(PAL.mag3).setAlpha(0);
      const root = scene.add.container(def.x, def.y);
      const off = img(def.keys.off).setAlpha(0);
      const on = img(def.keys.on).setAlpha(0);
      const flash = img(def.keys.sil).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      root.add([off, on, flash]);
      glows.push(glow);
      shadows.push(shadow);
      chromas.push(chromaA, chromaB);
      bodies.push(root);
      this.letters.push({ def, root, glow, shadow, chromaA, chromaB, off, on, flash, lit: 0, boost: 0, jx: 0 });
    }
    this.sheen = scene.add
      .image(-PAD, -PAD, this.layout.sheenKey, 's:0')
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
    // draw order: glows, shadows, chroma fringes, letter bodies, sheen
    this.root.add([...glows, ...shadows, ...chromas, ...bodies, this.sheen]);
    this.onUpdate = (t) => this.update(t);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  get x(): number {
    return this.root.x;
  }
  get y(): number {
    return this.root.y;
  }
  get width(): number {
    return this.layout.w;
  }
  get height(): number {
    return this.layout.h;
  }

  /** Screen-space centre of letter i (for sparks). */
  letterCenter(i: number): { x: number; y: number } {
    const l = this.letters[i].def;
    return { x: this.root.x + l.x + l.w / 2, y: this.root.y + l.y + l.h / 2 };
  }

  get count(): number {
    return this.letters.length;
  }

  // ------------------------------------------------------------ per-frame composition

  private update(time: number): void {
    if (!this.root.active) return;
    const breathe = this.idle ? 0.82 + 0.18 * Math.sin(time / 520) : 1;
    this.breath = breathe;
    for (const L of this.letters) {
      const lit = L.lit;
      const g = Math.min(1, lit * this.glowLevel * breathe + L.boost * 0.6);
      L.glow.setAlpha(Math.round(g * 12) / 12);
      L.on.setAlpha(lit >= 0.5 ? 1 : lit > 0.05 ? 0.5 : 0);
      const ca = lit >= 0.5 ? Math.min(0.85, 0.42 * this.chroma) : 0;
      const off = Math.round(this.chroma);
      L.chromaA.setAlpha(ca).setX(L.def.x - Math.max(1, off) + L.jx);
      L.chromaB.setAlpha(ca).setX(L.def.x + Math.max(1, off) + L.jx);
      L.root.x = L.def.x + L.jx;
      L.glow.x = L.def.x + L.jx;
      L.shadow.x = L.def.x + 2 + L.jx;
      L.flash.setAlpha(Math.min(0.85, L.boost));
    }
  }

  // ------------------------------------------------------------ reveal

  /** The unlit tubes fade in (power hum), then letters flicker on, then the ignition flash. */
  async reveal(): Promise<void> {
    const s = this.scene;
    // power-on: the glass appears in two stepped pulses
    for (const L of this.letters) {
      L.off.setAlpha(0);
      L.shadow.setAlpha(0);
    }
    const o = { a: 0 };
    await tween(s, {
      targets: o,
      a: 1,
      duration: 360,
      ease: 'Stepped',
      easeParams: [4],
      onUpdate: () => {
        for (const L of this.letters) {
          L.off.setAlpha(o.a);
          L.shadow.setAlpha(o.a * 0.55);
        }
      },
    });
    this.glowLevel = 1;
    // ignition order: NEON left → right, a breath, then DÜELLO, one stubborn letter last
    const order = this.letters.map((_, i) => i);
    const stubborn = 8; // the second L
    const seq = order.filter((i) => i !== stubborn);
    const jobs: Promise<void>[] = [];
    let t = 0;
    for (const i of seq) {
      const word = this.letters[i].def.word;
      jobs.push(this.igniteAt(i, t, 2 + Math.floor(this.rnd() * 2)));
      t += word === 0 ? 85 : 95;
      if (i === 3) t += 170;
    }
    jobs.push(this.igniteAt(stubborn, t + 260, 5));
    await Promise.all(jobs);
    await this.ignite();
  }

  /** Flicker letter i on after `delay` ms with `flickers` false starts. */
  private async igniteAt(i: number, delay: number, flickers: number): Promise<void> {
    const s = this.scene;
    const L = this.letters[i];
    await wait(s, delay);
    for (let k = 0; k < flickers; k++) {
      L.lit = k === flickers - 1 ? 0.4 : 1;
      this.tick(i, 0.18 + 0.1 * this.rnd());
      await wait(s, 30 + Math.floor(this.rnd() * 45));
      L.lit = 0;
      await wait(s, 40 + Math.floor(this.rnd() * 90));
    }
    L.lit = 1;
    L.boost = 1;
    this.tick(i, 0.32);
    this.sparkAt(i, 5);
    await tween(s, { targets: L, boost: 0, duration: 260, ease: 'Quad.Out' });
  }

  private tick(i: number, volume: number): void {
    if (!this.sound) return;
    const pan = (this.letterCenter(i).x - 320) / 320;
    sfx.play('uiClick', { volume, pitch: 1.5 + this.rnd() * 0.7, pan: pan * 0.6 });
  }

  /** All letters lit → white flash, chromatic split snapping back, sparks, a little jolt. */
  async ignite(): Promise<void> {
    const s = this.scene;
    if (this.sound) {
      sfx.play('lightning', { volume: 0.22, pitch: 1.4 });
      sfx.play('summonBurst', { volume: 0.45 });
    }
    for (const L of this.letters) {
      L.lit = 1;
      L.boost = 1.6;
    }
    this.chroma = 6;
    for (let i = 0; i < this.letters.length; i++) this.sparkAt(i, 7);
    const y0 = this.root.y;
    this.root.y = y0 + 3;
    void tween(s, { targets: this.root, y: y0, duration: 260, ease: 'Back.Out' });
    void tween(s, { targets: this, chroma: 1, duration: 520, ease: 'Expo.Out' });
    await tween(s, { targets: this.letters, boost: 0, duration: 420, ease: 'Quad.Out' });
    this.sweep();
  }

  /** Instantly show the logo fully lit (skip the reveal). */
  showLit(): void {
    this.glowLevel = 1;
    this.chroma = 1;
    for (const L of this.letters) {
      L.lit = 1;
      L.boost = 0;
      L.off.setAlpha(1);
      L.shadow.setAlpha(0.55);
    }
  }

  // ------------------------------------------------------------ idle life

  startIdle(): void {
    if (this.idle) return;
    this.idle = true;
    const s = this.scene;
    const loop = (min: number, span: number, fn: () => void) => {
      const go = () => {
        const ev = s.time.delayedCall(min + this.rnd() * span, () => {
          if (!this.idle) return;
          fn();
          go();
        });
        this.idleTimers.push(ev);
      };
      go();
    };
    loop(3200, 2600, () => this.sweep());
    loop(2600, 4200, () => void this.flickerRandom());
    loop(5200, 5200, () => void this.glitch());
    this.sparkleTimer = s.time.addEvent({ delay: 240, loop: true, callback: () => this.twinkle() });
  }

  stopIdle(): void {
    this.idle = false;
    for (const t of this.idleTimers) t.remove(false);
    this.idleTimers = [];
    this.sparkleTimer?.remove(false);
    this.sparkleTimer = null;
  }

  /** The diagonal light sweep across the word. */
  sweep(ms = 620): void {
    const s = this.scene;
    const o = { f: 0 };
    this.sheen.setVisible(true).setFrame('s:0');
    void tween(s, {
      targets: o,
      f: this.layout.sheenFrames - 1,
      duration: ms,
      ease: 'Sine.InOut',
      onUpdate: () => this.sheen.setFrame(`s:${Math.round(o.f)}`),
    }).then(() => this.sheen.setVisible(false));
  }

  /** A neon hiccup: one letter stutters off and on. */
  async flickerRandom(): Promise<void> {
    const s = this.scene;
    const i = Math.floor(this.rnd() * this.letters.length);
    const L = this.letters[i];
    const n = 1 + Math.floor(this.rnd() * 3);
    for (let k = 0; k < n; k++) {
      L.lit = this.rnd() < 0.5 ? 0 : 0.4;
      await wait(s, 35 + this.rnd() * 50);
      L.lit = 1;
      await wait(s, 50 + this.rnd() * 90);
    }
    L.lit = 1;
  }

  /** Horizontal tear: letters jump sideways, the chromatic split widens, for a few frames. */
  async glitch(power = 1): Promise<void> {
    const s = this.scene;
    const steps = 3 + Math.floor(this.rnd() * 2);
    for (let k = 0; k < steps; k++) {
      this.chroma = 2 + Math.round(this.rnd() * 3 * power);
      for (const L of this.letters) L.jx = this.rnd() < 0.35 ? Math.round((this.rnd() * 2 - 1) * 4 * power) : 0;
      await wait(s, 40 + this.rnd() * 30);
    }
    for (const L of this.letters) L.jx = 0;
    this.chroma = 1;
  }

  /** Flash every letter white (selection confirm, transitions). */
  async flashAll(ms = 260, amount = 1.4): Promise<void> {
    for (const L of this.letters) L.boost = amount;
    await tween(this.scene, { targets: this.letters, boost: 0, duration: ms, ease: 'Quad.Out' });
  }

  /** Quick power-down (letters go out one by one). */
  async powerDown(ms = 420): Promise<void> {
    const s = this.scene;
    this.stopIdle();
    const n = this.letters.length;
    await Promise.all(
      this.letters.map(async (L, i) => {
        await wait(s, (ms * ((i * 7) % n)) / n);
        L.lit = 0.4;
        await wait(s, 40);
        L.lit = 0;
      }),
    );
  }

  setVisible(b: boolean): void {
    this.root.setVisible(b);
  }

  // ------------------------------------------------------------ sparkles

  /** Pixel sparks bursting off letter i. */
  sparkAt(i: number, n: number): void {
    const s = this.scene;
    const L = this.letters[i];
    const ramp = LOGO_RAMPS[L.def.word];
    const c = this.letterCenter(i);
    for (let k = 0; k < n; k++) {
      const a = this.rnd() * Math.PI * 2;
      const r0 = 6 + this.rnd() * 10;
      const x = c.x + Math.cos(a) * r0;
      const y = c.y + Math.sin(a) * r0 * 1.2;
      const p = s.add
        .image(Math.round(x), Math.round(y), k % 3 === 0 ? TEX.plus : TEX.px1)
        .setTint(k % 2 ? PAL.white : ramp[3])
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScrollFactor(0)
        .setDepth(this.root.depth + 1);
      const d = 10 + this.rnd() * 22;
      void tween(s, {
        targets: p,
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d + 6,
        alpha: 0,
        duration: 260 + this.rnd() * 300,
        ease: 'Cubic.Out',
      }).then(() => p.destroy());
    }
  }

  /** Tiny star glints that pop on the tubes while idling. */
  private twinkle(): void {
    if (!this.root.visible || this.rnd() < 0.35) return;
    const s = this.scene;
    const L = this.letters[Math.floor(this.rnd() * this.letters.length)];
    if (L.lit < 1 || L.def.bright.length === 0) return;
    const [fx, fy] = L.def.bright[Math.floor(this.rnd() * L.def.bright.length)];
    const st = s.add
      .image(this.root.x + L.def.x + fx, this.root.y + L.def.y + fy, TEX.spark)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScrollFactor(0)
      .setDepth(this.root.depth + 1)
      .setScale(0.2)
      .setAlpha(0.95);
    void tween(s, { targets: st, scale: 1, duration: 120, ease: 'Quad.Out', yoyo: true, hold: 60 }).then(() => st.destroy());
  }

  destroy(): void {
    this.stopIdle();
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate);
    if (this.root.active) this.root.destroy();
  }
}
