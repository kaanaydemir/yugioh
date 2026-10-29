// TurnPlate — the small v3 plate that announces a flow moment on its owner's side (docs/v3/A6_PLAN.md
// F1 / F2, lane A6-B step B1; KO-4: never a full-width band). One component for every plate of the
// lane: the turn plate ("OYUNCU 2 · TUR 4"), the battle plate ("SAVAŞ AŞAMASI"), the deck-out plate
// ("DESTE BİTTİ", B5); the "DÜELLO!" plate (large) below; the curtain and result plates are their own
// files (CurtainV3.ts, ResultPlate.ts) on the same frame language. V3_A6_B only (the callers gate).
//
//   const plate = TurnPlate.show(scene, { player: 1, kind: 'turn', segments: turnPlateText(…) });
//   await plate.settled;                         // 450 ms: slid in, stamped, settled back 1 px
//   await plate.shrinkTo(hud.turnBadgeRect());   // the tail: three hops into the turn badge (120 ms)
//
// Look (S-1 frame language, palette only, whole pixels, no alpha / ADD / scale / rotation — KO-1/2/3):
//   body     frameRectV3 bands (night1 over night0), 1-px ink outline, corners cut
//   trim     the owner's tone (P1 cyan, P2 crimson; the battle and deck-out plates crimson), one tone up at rest;
//            it appears in two palette steps (trim two tones down + night0 body → one down → rest)
//   text     md glyphs with an ink outline, stamped one letter per frame: a letter's first frame is
//            white and 1 px high, then it drops into place in its own tone (the "damga")
//   node     after the slide one light node runs the trim once (the plate is never quite still)
// Motion (scene clock: speed / hit-stop aware):
//   0–120    slides 12 px in from the screen edge on its side, 1 px past its rest (ease-out)
//   67…      letters stamp (one per frame; `lettersPerFrame` 2 for the short battle beat)
//   360–450  settles the 1 px back; `settled` resolves at 450 (the battle plate: 240–300)
//   shrink   three hops (40 ms each) toward a target rect, each a smaller plate on a straight
//            whole-pixel line, the last one exactly the target's frame in white; then it is gone
// Placement: P1 bottom-left, left-aligned with its LP panel, just above the mini-hand row (so the
// face-down mini cards never sit on it); P2 top-right, right-aligned with its panel, below its
// mini-hand row. REDUCED_MOTION (KO-9): no slide, no node, letters at once, the shrink is a
// two-step fade in place.

import type Phaser from 'phaser';
import { PAL, RAMPS, type Ramp } from '../../art/palette';
import { frameRectV3, type Trim } from '../../art/frame-v3';
import { PixelCanvas } from '../../art/pixel';
import type { PlayerId } from '../../engine/types';
import { BOARD_CENTER, DEPTH, UI, panelRect, type Rect, type XY } from '../layout';
import { ICON } from '../ui-textures';
import { REDUCED_MOTION, settle } from './motion';
import { bodyV3, canvasTexture, capYV3, flatTrim, glyphTexture, iconTexture, iconTones, layoutLine, trimPixels, TrimGfx, type TrimNode } from './hudSkin';

/** What the plate says: coloured runs of text (laid out as one line). */
export interface PlateSegment {
  text: string;
  color: number;
}

export type PlateKind = 'turn' | 'battle' | 'deckOut';

export interface PlateSpec {
  /** Whose side the plate sits on (its trim tone for 'turn'). */
  player: PlayerId;
  kind: PlateKind;
  segments: readonly PlateSegment[];
  /** Letters stamped per frame (default 1; the battle beat uses 2 to be read inside 300 ms). */
  lettersPerFrame?: number;
}

/** When the plate settles its 1 px back and when it is settled (ms): the turn beat 360–450, battle 240–300. */
export function plateTiming(kind: PlateKind): { settleAt: number; settledMs: number } {
  return kind === 'battle' ? { settleAt: 240, settledMs: 300 } : { settleAt: PLATE.settleAt, settledMs: PLATE.settledMs };
}

/** Plate geometry (game px). */
export const PLATE = Object.freeze({
  h: 20,
  /** Minimum width (the plan's ≈ 112: "OYUNCU 1 · TUR 4" + padding). */
  minW: 112,
  padX: 7,
  /** Caps top row inside the plate (accents above, cedillas below stay inside the trim). */
  capTop: 6,
  /** The slide-in distance from the screen edge (F1: 12 px) and the overshoot past rest (1 px). */
  slide: 12,
  over: 1,
  /** Gap kept clear for the mini-hand row between the panel and the plate. */
  miniRow: 14,
  /** Battle plate icon (swords) and its gap to the text. */
  iconGap: 3,
  /** Timeline (ms, 1×). */
  slideMs: 120,
  /** The first letter comes with the plate's first frame (A6B-8: a plate never shows without its words). */
  stampFrom: 0,
  /** The plate reaches its rest tones (two palette steps in): the turn motif's beat (F1, A6B-7). */
  restAt: 67,
  settleAt: 360,
  settledMs: 450,
  hopMs: 40,
  nodeLapMs: 900,
  /** The fold out (A6B-5): heights round the middle row, two frames each, then gone. */
  fold: Object.freeze([12, 6, 2]),
  foldFrames: 2,
});

const FRAME = 1000 / 60;

/** The plate's rest rect for `player` and width `w` (P1 above its panel's mini row, P2 below). */
export function plateRect(player: PlayerId, w: number): Rect {
  const r = panelRect(player);
  if (player === 0) return { x: r.x, y: r.y - PLATE.miniRow - PLATE.h, w, h: PLATE.h };
  return { x: r.x + r.w - w, y: r.y + r.h + PLATE.miniRow, w, h: PLATE.h };
}

/** The plate's width for its text (and the battle plate's icon, `iconW` px wide). */
export function plateWidth(segments: readonly PlateSegment[], kind: PlateKind, iconW = ICON_W): number {
  const textW = layoutLine(segments.map((s) => s.text).join(''), 'md').w;
  const icon = kind === 'battle' || kind === 'deckOut' ? iconW + PLATE.iconGap : 0;
  return Math.max(PLATE.minW, textW + icon + 2 * PLATE.padX);
}

/** The ramp a plate's trim steps on. */
export function plateRamp(spec: Pick<PlateSpec, 'player' | 'kind'>): Ramp {
  if (spec.kind === 'battle' || spec.kind === 'deckOut') return RAMPS.crim;
  return spec.player === 0 ? RAMPS.cyan : RAMPS.crim;
}

/** The trim at an appear step: 0 = rest (one tone up from the frame's base), −1 / −2 the steps in. */
export function plateTrim(ramp: Ramp, step: number): Trim {
  const s = Math.max(-2, Math.min(0, Math.round(step)));
  const d = 3 + s; // rest: dark ramp[3], light ramp[4]; −1: 2 / 3; −2: 1 / 2
  return Object.freeze({ dark: ramp[d], light: ramp[d + 1] });
}

/** The plate body at an appear step (two flat bands at rest; night0 only while appearing). */
export function plateBody(w: number, h: number, step: number): PixelCanvas {
  return bodyV3(w, h, { bands: step >= 0 ? [PAL.night1, PAL.night0] : [PAL.night0, PAL.night0] });
}

/**
 * The texts of the turn plate (F1): hot-seat "OYUNCU 2 · TUR 4"; vsBot "SIRA SENDE · TUR 4" (the human)
 * or "BİLGİSAYAR · TUR 4" (the CPU); demo (CPU vs CPU) as hot-seat. The name in the owner's light tone,
 * the dot steel, "TUR n" white.
 */
export function turnPlateText(o: { mode: 'hotseat' | 'vsBot' | 'demo'; human: boolean; player: PlayerId; turn: number }): PlateSegment[] {
  const tone = (o.player === 0 ? RAMPS.cyan : RAMPS.crim)[3];
  const name = o.mode === 'vsBot' ? (o.human ? 'SIRA SENDE' : 'BİLGİSAYAR') : `OYUNCU ${o.player + 1}`;
  return [
    { text: name, color: tone },
    { text: ' · ', color: PAL.steel },
    { text: `TUR ${o.turn}`, color: PAL.white },
  ];
}

/** The deck-out plate's text (F8, B5). */
export function deckOutPlateText(): PlateSegment[] {
  return [{ text: 'DESTE BİTTİ', color: PAL.white }];
}

/** The battle plate's text (F2). */
export function battlePlateText(): PlateSegment[] {
  return [{ text: 'SAVAŞ AŞAMASI', color: PAL.white }];
}

// ================================================================ the component

interface Glyph {
  img: Phaser.GameObjects.Image;
  code: number;
  color: number;
  x: number;
  y: number;
  /** ms (from show) when it is stamped. */
  at: number;
}

/** The swords icon's drawn width (ICON.swords: 11 px + its 1-px ink outline each side). */
const ICON_W = 13;
const live = new Set<TurnPlate>();

export class TurnPlate {
  /** Resolves when the plate has slid in, stamped its text and settled (450 ms at 1×). */
  readonly settled: Promise<void>;
  readonly spec: PlateSpec;
  readonly w: number;
  readonly h = PLATE.h;
  /** The rest rect (screen px). */
  readonly rect: Rect;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly trim: TrimGfx;
  private readonly glyphs: Glyph[] = [];
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly ramp: Ramp;
  private readonly side: -1 | 1;
  private tween: Phaser.Tweens.Tween | null = null;
  private step = -3;
  private shrinking: Promise<void> | null = null;
  /** The plate is leaving (shrinkTo called): the appear timeline must not touch its pieces any more. */
  private leaving = false;
  private alive = true;
  private readonly onShutdown = () => this.destroy();
  private readonly onUpdate = (_t: number, dt: number) => this.trim.tick(dt * this.scene.tweens.timeScale);

  /** Show a plate (replacing any plate still on screen: one plate at a time). */
  static show(scene: Phaser.Scene, spec: PlateSpec): TurnPlate {
    for (const p of [...live]) p.destroy();
    return new TurnPlate(scene, spec);
  }

  /** The plate currently on screen (or null). */
  static current(): TurnPlate | null {
    for (const p of live) if (p.alive && !p.shrinking) return p;
    return null;
  }

  /** Remove every plate at once (a new turn, a restart, the end of the game). */
  static dismissAll(): void {
    for (const p of [...live]) p.destroy();
  }

  private constructor(scene: Phaser.Scene, spec: PlateSpec) {
    this.scene = scene;
    this.spec = spec;
    this.ramp = plateRamp(spec);
    // the battle plate's crossed swords, the deck-out plate's deck (both re-toned to the crimson trim)
    const iconKey = spec.kind === 'battle' ? iconTexture(scene, ICON.swords, iconTones('fire', 1)) : spec.kind === 'deckOut' ? iconTexture(scene, ICON.deck, iconTones('fire', 1)) : null;
    const iconW = iconKey ? scene.textures.getFrame(iconKey).width : 0;
    this.w = plateWidth(spec.segments, spec.kind, iconW);
    this.rect = plateRect(spec.player, this.w);
    this.side = spec.player === 0 ? -1 : 1; // the screen edge it slides in from (−1 left, +1 right)
    const x0 = REDUCED_MOTION ? this.rect.x : this.rect.x + this.side * PLATE.slide;
    this.root = scene.add.container(x0, this.rect.y).setDepth(DEPTH.HUD + 8).setScrollFactor(0);
    this.body = scene.add.image(0, 0, this.bodyKey(this.w, this.h, -2)).setOrigin(0, 0);
    this.root.add(this.body);
    this.trim = new TrimGfx(scene, this.root, 0, 0, this.w, this.h);
    // the icon before the text
    let tx = PLATE.padX;
    if (iconKey) {
      const img = scene.add.image(PLATE.padX, 0, iconKey).setOrigin(0, 0).setVisible(false);
      img.y = Math.round((this.h - img.height) / 2);
      this.root.add(img);
      this.icon = img;
      tx += iconW + PLATE.iconGap;
    }
    this.layoutText(tx);
    this.applyStep(-2);
    live.add(this);
    scene.events.once('shutdown', this.onShutdown);
    scene.events.on('update', this.onUpdate);
    this.settled = this.play();
  }

  /** The plate is on screen (not destroyed). */
  get active(): boolean {
    return this.alive;
  }

  /**
   * The tail (A6B-5): the plate folds out in place (20 → 12 → 6 → 2 px round its middle row, two frames
   * each, the trim stepping down) while a light spark carries its news to `target` along a whole-pixel
   * arc (flySpark; `frames` caps the flight); `onLand` runs on the spark's landing frame, the target's
   * frame lights white. Resolves when both are done. `label` is kept for the callers' API (the spark
   * carries no letters). With REDUCED_MOTION: two palette steps out in place, `onLand` at once.
   */
  shrinkTo(target: Rect, label: readonly string[] = [], onLand?: () => void, o: { frames?: number } = {}): Promise<void> {
    void label;
    return this.startLeave({ target, onLand, frames: o.frames });
  }

  /**
   * Fold out in place with no spark (A6B-5: the turn plate's number has already flown to the badge
   * when it was stamped). Resolves when it is gone.
   */
  leave(): Promise<void> {
    return this.startLeave({});
  }

  /**
   * The last stamped glyph (the turn plate's turn number): when it is stamped (ms from show) and its
   * centre on screen at the plate's rest. Null when the plate has no glyph.
   */
  lastGlyph(): { at: number; x: number; y: number } | null {
    const g = this.glyphs[this.glyphs.length - 1];
    if (!g) return null;
    const fr = g.img.frame;
    return { at: Math.max(0, g.at), x: Math.round(this.rect.x + g.x + fr.width / 2), y: Math.round(this.rect.y + g.y + fr.height / 2) };
  }

  private startLeave(o: { target?: Rect; onLand?: () => void; frames?: number }): Promise<void> {
    if (this.shrinking) return this.shrinking;
    if (!this.alive) {
      o.onLand?.();
      return Promise.resolve();
    }
    // the appear timeline stops first (its frame / end callbacks see `leaving` and keep off the plate)
    this.leaving = true;
    const appear = this.tween;
    this.tween = null;
    appear?.stop();
    this.shrinking = this.runShrink(o.target ?? null, o.onLand, o.frames);
    return this.shrinking;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    live.delete(this);
    this.tween?.stop();
    this.tween = null;
    this.scene.events.off('shutdown', this.onShutdown);
    this.scene.events.off('update', this.onUpdate);
    this.trim.destroy();
    if (this.root.active) this.root.destroy();
  }

  // ---------------------------------------------------------------- internals

  private bodyKey(w: number, h: number, step: number): string {
    const s = step >= 0 ? 0 : -1;
    return canvasTexture(this.scene, `ui3:plate:body:${w}x${h}:${s}`, () => plateBody(w, h, s));
  }

  private layoutText(x0: number): void {
    const full = this.spec.segments.map((s) => s.text).join('');
    const L = layoutLine(full, 'md');
    // the colour of every drawn glyph (spaces draw nothing), in order
    const colors: number[] = [];
    for (const seg of this.spec.segments) for (const ch of seg.text) if (ch !== ' ') colors.push(seg.color);
    const y = capYV3('md', PLATE.capTop);
    const per = FRAME / Math.max(1, Math.round(this.spec.lettersPerFrame ?? 1));
    L.glyphs.forEach((g, i) => {
      const color = colors.length === L.glyphs.length ? colors[i] : PAL.white;
      const gx = x0 + g.x;
      const img = this.scene.add.image(gx, y, glyphTexture(this.scene, g.code, 'md', color)).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      // (+0.5 ms: the QA clock's frame is a hair under 1000 / 60 — still one letter per frame)
      this.glyphs.push({ img, code: g.code, color, x: gx, y, at: PLATE.stampFrom + Math.floor(i * per) - 0.5 });
    });
  }

  private applyStep(step: number): void {
    if (step === this.step) return;
    this.step = step;
    this.body.setTexture(this.bodyKey(this.w, this.h, step));
    this.trim.set(plateTrim(this.ramp, step));
    this.icon?.setVisible(step >= 0);
  }

  /** The appear → stamp → settle timeline (450 ms), on the scene's tween clock. */
  private play(): Promise<void> {
    const rest = this.rect.x;
    const from = rest + this.side * PLATE.slide;
    const over = rest - this.side * PLATE.over;
    const reduced = REDUCED_MOTION;
    // one lap of a white head with a light tail (visible on both trim tones), then the plate rests
    const node: TrimNode = { head: PAL.white, tail: [this.ramp[4], this.ramp[4]], lapMs: PLATE.nodeLapMs, restMs: 60000 };
    let nodeOn = false;
    const { settleAt, settledMs } = plateTiming(this.spec.kind);
    const frame = (ms: number) => {
      if (!this.alive || this.leaving) return;
      // two palette steps in: −2 (0–33 ms), −1 (33–67), rest
      this.applyStep(ms < 2 * FRAME - 0.5 ? -2 : ms < 4 * FRAME - 0.5 ? -1 : 0);
      if (!reduced) {
        const x = ms < PLATE.slideMs ? settle(from, over, ms / PLATE.slideMs) : ms < settleAt ? over : settle(over, rest, (ms - settleAt) / (settledMs - settleAt));
        this.root.x = x;
        if (!nodeOn && ms >= PLATE.slideMs) {
          nodeOn = true;
          this.trim.setNode(node);
        }
      }
      for (const g of this.glyphs) {
        const shown = reduced || ms >= g.at;
        g.img.setVisible(shown);
        if (!shown) continue;
        // the stamp: one white frame 1 px high, then the letter's own tone in place
        const fresh = !reduced && ms < g.at + FRAME - 0.5;
        g.img.setTexture(glyphTexture(this.scene, g.code, 'md', fresh ? PAL.white : g.color));
        g.img.y = fresh ? g.y - 1 : g.y;
      }
    };
    return this.timeline(settledMs, frame).then(() => {
      if (!this.alive || this.leaving) return;
      this.root.x = rest;
      this.applyStep(0);
      for (const g of this.glyphs) {
        g.img.setVisible(true).setTexture(glyphTexture(this.scene, g.code, 'md', g.color));
        g.img.y = g.y;
      }
    });
  }

  private async runShrink(target: Rect | null, onLand?: () => void, frames?: number): Promise<void> {
    const sc = this.scene;
    let landed = false;
    const land = () => {
      if (landed) return;
      landed = true;
      onLand?.();
    };
    if (REDUCED_MOTION) {
      // two palette steps out, in place
      land();
      await this.timeline(2 * PLATE.hopMs, (ms) => this.alive && this.applyStep(ms < PLATE.hopMs ? -1 : -2));
      this.destroy();
      return;
    }
    // the news flies on (a spark from the plate's middle), the plate folds where it is
    const spark = target
      ? flySpark(sc, { x: Math.round(this.rect.x + this.w / 2), y: Math.round(this.rect.y + this.h / 2) }, target, this.ramp, { frames, onLand: land })
      : Promise.resolve(land());
    this.trim.setNode(null);
    this.root.x = this.rect.x;
    const pieces: { img: Phaser.GameObjects.Image | null; trim: TrimGfx | null } = { img: null, trim: null };
    const clear = () => {
      pieces.img?.destroy();
      pieces.img = null;
      pieces.trim?.destroy();
      pieces.trim = null;
    };
    let shown = -1;
    const fold = PLATE.fold;
    const fold$ = this.timeline(fold.length * PLATE.foldFrames * FRAME, (ms) => {
      if (!this.alive) return;
      const i = Math.min(fold.length, Math.floor((ms + 0.5) / (PLATE.foldFrames * FRAME)));
      if (i === shown) return;
      shown = i;
      clear();
      if (i >= fold.length) {
        this.root.setVisible(false);
        return;
      }
      const h = fold[i];
      const y = Math.round((this.h - h) / 2);
      // the plate's own body and text go; a folded body stands in (the text one tone down on the first fold)
      this.body.setVisible(false);
      this.icon?.setVisible(false);
      this.trim.setVisible(false);
      for (const g of this.glyphs) {
        const keep = i === 0 && g.y >= y && g.y + 7 <= y + h + 2;
        g.img.setVisible(keep);
        if (keep) g.img.setTexture(glyphTexture(sc, g.code, 'md', dimTone(g.color)));
      }
      if (h >= 4) {
        pieces.img = sc.add.image(0, y, this.bodyKey(this.w, h, 0)).setOrigin(0, 0);
        this.root.addAt(pieces.img, 0);
        pieces.trim = new TrimGfx(sc, this.root, 0, y, this.w, h).set(plateTrim(this.ramp, -1 - i));
      } else {
        const key = canvasTexture(sc, `ui3:plate:fold:${this.w}:${hexOf(this.ramp[2])}`, () => {
          const p = new PixelCanvas(this.w, 2);
          p.rect(0, 0, this.w, 2, this.ramp[2]);
          return p;
        });
        pieces.img = sc.add.image(0, y, key).setOrigin(0, 0);
        this.root.add(pieces.img);
      }
    });
    await Promise.all([fold$, spark]);
    clear();
    this.destroy();
    land();
  }

  /** fn(ms) on the scene's tween clock from 0 to `ms` (speed / hit-stop aware); resolves at the end. */
  private timeline(ms: number, fn: (ms: number) => void): Promise<void> {
    return new Promise((resolve) => {
      fn(0);
      const t = this.scene.tweens.addCounter({
        from: 0,
        to: ms,
        duration: ms,
        onUpdate: (tw) => fn(tw.getValue() ?? 0),
        onComplete: () => {
          fn(ms);
          resolve();
        },
        onStop: () => resolve(),
      });
      this.tween = t;
    });
  }
}

/** One palette step down a ramp (a folding letter). */
function dimTone(c: number): number {
  for (const ramp of [RAMPS.cyan, RAMPS.crim, RAMPS.gold, [PAL.night2, PAL.night3, PAL.night4, PAL.steel, PAL.mist, PAL.white] as const]) {
    const i = (ramp as readonly number[]).indexOf(c);
    if (i > 0) return ramp[i - 1];
  }
  return c;
}

function hexOf(c: number): string {
  return c.toString(16).padStart(6, '0');
}

// ================================================================ the spark (a plate's news flies on, A6B-5)

/** The spark's flight: px a frame it aims at, its frame bounds, the arc's bulge (× the distance), the landing frames. */
export const SPARK = Object.freeze({ pxPerFrame: 24, minFrames: 7, maxFrames: 14, bulge: 0.16, landFrames: 2 });

/** Frames of a spark's flight over a → b (SPARK bounds; `max` caps it). Pure. */
export function sparkFrames(a: XY, b: XY, max: number = SPARK.maxFrames): number {
  const n = Math.round(Math.hypot(b.x - a.x, b.y - a.y) / SPARK.pxPerFrame);
  return Math.max(Math.min(SPARK.minFrames, max), Math.min(max, n));
}

/**
 * The spark's head at frame i of n (pure, whole pixels): a quadratic arc from a to b bulging `bulge` ×
 * the distance AWAY from the board's centre (it goes round the field, over the dark arena, not across the
 * units; the arc's control point stays on screen), eased in and out (smoothstep) — it leaves gently,
 * crosses fast, and settles into its target.
 */
export function sparkPoint(a: XY, b: XY, i: number, n: number, bulge: number = SPARK.bulge): XY {
  const t0 = Math.max(0, Math.min(1, n > 0 ? i / n : 1));
  const t = t0 * t0 * (3 - 2 * t0);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  let px = -dy / len;
  let py = dx / len;
  const bc = BOARD_CENTER;
  if (Math.hypot(mx + px - bc.x, my + py - bc.y) < Math.hypot(mx - px - bc.x, my - py - bc.y)) {
    px = -px;
    py = -py;
  }
  const cx = Math.max(4, Math.min(636, mx + px * bulge * len));
  const cy = Math.max(4, Math.min(356, my + py * bulge * len));
  const u = 1 - t;
  return { x: Math.round(u * u * a.x + 2 * u * t * cx + t * t * b.x), y: Math.round(u * u * a.y + 2 * u * t * cy + t * t * b.y) };
}

/** Every pixel of the whole-pixel line a → b (Bresenham), both ends included. Pure. */
export function linePixels(a: XY, b: XY): XY[] {
  const out: XY[] = [];
  let x = Math.round(a.x);
  let y = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  const dx = Math.abs(x1 - x);
  const dy = -Math.abs(y1 - y);
  const sx = x < x1 ? 1 : -1;
  const sy = y < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push({ x, y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return out;
}

/**
 * A light spark flies from `from` to the middle of `to` (or to `aim`; screen px) on whole pixels along a gentle arc
 * (A6B-5: the plate's news reaches its place — the turn number its badge, the battle plate its SAVAŞ
 * cell): a 2 × 2 white head and a trail along the path of its last three frames (ramp[4] → ramp[3] →
 * ramp[2], every pixel of the path drawn, so it never skips however fast it crosses); on the landing
 * frame `onLand` runs and the target's 1-px frame shows white for two frames. Scene clock (speed aware).
 * `bulge` 0 flies straight (a path along the HUD's top band). Reduced motion: no flight — it lands at once.
 */
export function flySpark(scene: Phaser.Scene, from: XY, to: Rect, ramp: Ramp, o: { frames?: number; onLand?: () => void; depth?: number; aim?: XY; bulge?: number } = {}): Promise<void> {
  let landed = false;
  const land = () => {
    if (landed) return;
    landed = true;
    o.onLand?.();
  };
  if (REDUCED_MOTION) {
    land();
    return Promise.resolve();
  }
  const a = { x: Math.round(from.x), y: Math.round(from.y) };
  const b = o.aim ? { x: Math.round(o.aim.x), y: Math.round(o.aim.y) } : { x: Math.round(to.x + to.w / 2), y: Math.round(to.y + to.h / 2) };
  const n = Math.max(1, sparkFrames(a, b, o.frames ?? SPARK.maxFrames));
  const pts = Array.from({ length: n + 1 }, (_, i) => sparkPoint(a, b, i, n, o.bulge ?? SPARK.bulge));
  const g = scene.add.graphics().setDepth(o.depth ?? DEPTH.HUD + 8).setScrollFactor(0);
  const px = (q: XY, c: number, w = 1) => {
    g.fillStyle(c, 1);
    g.fillRect(q.x, q.y, w, w);
  };
  let last = -1;
  const draw = (f: number) => {
    if (f === last || !g.active) return;
    last = f;
    g.clear();
    if (f < n) {
      // the trail: the path of the last three frames, oldest darkest
      for (let k = 3; k >= 1; k--) {
        const i0 = f - k;
        if (i0 < 0) continue;
        const tone = k === 3 ? ramp[2] : k === 2 ? ramp[3] : ramp[4];
        for (const q of linePixels(pts[i0], pts[i0 + 1])) px(q, tone);
      }
      px({ x: pts[f].x - 1, y: pts[f].y - 1 }, PAL.white, 2);
      return;
    }
    // landed: the target's frame white for two frames
    land();
    g.fillStyle(PAL.white, 1);
    g.fillRect(to.x, to.y, to.w, 1);
    g.fillRect(to.x, to.y + to.h - 1, to.w, 1);
    g.fillRect(to.x, to.y, 1, to.h);
    g.fillRect(to.x + to.w - 1, to.y, 1, to.h);
  };
  const total = (n + SPARK.landFrames) * FRAME;
  return new Promise((resolve) => {
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      if (g.active) g.destroy();
      land();
      resolve();
    };
    draw(0);
    scene.tweens.addCounter({
      from: 0,
      to: total,
      duration: total,
      onUpdate: (tw) => draw(Math.min(n + SPARK.landFrames - 1, Math.floor(((tw.getValue() ?? 0) + 0.5) / FRAME))),
      onComplete: end,
      onStop: end,
    });
    scene.events.once('shutdown', end);
  });
}

/** Pixels of one plate at rest (tests / the dev page): body + trim, palette only (no text). */
export function plateCanvas(spec: Pick<PlateSpec, 'player' | 'kind' | 'segments'>, iconW = ICON_W): PixelCanvas {
  const w = plateWidth(spec.segments, spec.kind, iconW);
  const p = plateBody(w, PLATE.h, 0);
  const t = plateTrim(plateRamp(spec), 0);
  const tp = trimPixels(w, PLATE.h);
  for (const [x, y] of tp.light) p.set(x, y, t.light);
  for (const [x, y] of tp.dark) p.set(x, y, t.dark);
  return p;
}

// ================================================================ the "DÜELLO!" plate (F0, the large size)
//
// The opening's "DÜELLO!" beat (docs/v3/A6_PLAN.md F0, lane A6-B step B-open) — the large size of the
// plate component, instead of today's full-width gold band, white first frame and focus lines (§1.2,
// KO-4). V3_A6_B only (src/cinematics/v3small/opening-flow.ts shows it; v3small/turn.ts makes it leave).
//
// Look (S-1 frame language, palette only, whole pixels; no alpha, ADD, scale or rotation):
//   body     160 × 26, the frameRectV3 bands, 1-px ink outline with a 2-px corner cut, gold ace corners
//   trim     gold, one tone up at rest (gold3 / gold4), appearing in two palette steps
//   word     "DÜELLO!" in its own display face drawn at 1× (13-px caps, 2-px stems, chamfered D / O /
//            U like the title logo's tubes, 1-px ink outline) in three clean gold bands (gold4 / gold3 /
//            gold2), flanked by the two duelists' marks (a P1 cyan diamond left, a P2 crimson right)
// Motion (frames at 60 fps, scene clock: speed / skip aware):
//   f0–4     drops onto its rest −3 → −2 → 0 → +1 → 0 px while the body and trim come in two palette
//            steps (night0 + gold1 / gold2 → night0 + gold2 / gold3 → rest)
//   f4–10    the letters stamp one per frame: a white frame 1 px high, a gold4 frame in place, then
//            the bands; under each letter two 1-px sparks skid out (gold4 → gold3 → gold2)
//   f10      the duelists' marks appear (one white frame); f11–12 the thump: the plate 1 px down and
//            one white frame of trim (the small object shakes, never the screen)
//   f13…     a light node runs the trim for as long as the plate stays (white head, gold tail)
//   f14–30   one glint sweeps the word left to right (a slanted 4-px white band, 6 px a frame)
//   hold     the marks' centre pixels blink in turn; the plate stays until the first turn starts
//   leave    two palette steps out (letters one tone down, then only the dark frame), then gone
// Placement: centred on the board's middle column, 3 px under the phase bar — above the board's top
// corner and clear of every deal path (P2's cards fly down the middle column when P2 starts the
// hot-seat duel; P2's mini cards arc up-right to its mini row when P1 does, passing ≥ 1.5 px under the
// plate's bottom-right corner at their largest — the reason for its 26-px height). REDUCED_MOTION (KO-9): the
// plate is there at once (no drop, stamp, sparks, glint, node or blink); it leaves in the same two steps.

/** The large plate's geometry and timeline (frames at 60 fps). */
export const DUEL_PLATE = Object.freeze({
  w: 160,
  h: 26,
  /** Outline corner cut (a 1-px ink diagonal: the big plate's corners). */
  cut: 2,
  /** Rows between the phase bar's bottom and the plate's top. */
  gapBelowBar: 3,
  /** y offset per frame of the drop onto the rest (the last entry holds): never into the phase bar. */
  drop: Object.freeze([-3, -2, 0, 1, 0]),
  /** Frame of the first letter's stamp (then one letter per frame): with the plate's first frame (A6B-8). */
  stampFrame: 0,
  /** The thump after the last letter: frames with the plate 1 px down (the first one with a white trim). */
  thumpFrames: 2,
  nodeFrame: 9,
  glintFrame: 10,
  /** Glint band travel per frame (px) and its width (white core; the last column gold4). */
  glintStep: 6,
  glintW: 4,
  /** One lap of the trim's light node. */
  nodeLapMs: 1400,
  /** The marks' centre pixels blink every this many frames (one, then the other). */
  blinkFrames: 24,
  /** Frames per exit step (two steps). */
  exitFrames: 2,
  /** Safety: the plate leaves by itself this long after it came if no turn starts (scene ms). */
  maxHoldMs: 6000,
});

/** The plate's rest rect: centred on the board's middle column, `gapBelowBar` under the phase bar. */
export function duelPlateRect(): Rect {
  const w = DUEL_PLATE.w;
  return { x: Math.round(BOARD_CENTER.x - w / 2), y: UI.phaseBar.y + UI.phaseBar.h + DUEL_PLATE.gapBelowBar, w, h: DUEL_PLATE.h };
}

/** Cap height of the display face (px). */
export const DUEL_CAP = 13;
/** Rows of the Ü's dots above the caps (2 dot rows + 1 gap row). */
const DOT_ROWS = 3;

/** The display face: one bitmap per letter, DUEL_CAP rows ('#' = ink-outlined fill). */
const DUEL_GLYPHS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  D: ['#########..', '##########.', '##......###', ...Array<string>(7).fill('##.......##'), '##......###', '##########.', '#########..'],
  U: [...Array<string>(10).fill('##.......##'), '###.....###', '.#########.', '..#######..'],
  E: ['##########', '##########', ...Array<string>(3).fill('##........'), '########..', '########..', ...Array<string>(4).fill('##........'), '##########', '##########'],
  L: [...Array<string>(11).fill('##........'), '##########', '##########'],
  O: ['..#######..', '.#########.', '###.....###', ...Array<string>(7).fill('##.......##'), '###.....###', '.#########.', '..#######..'],
  '!': [...Array<string>(9).fill('##'), '..', '..', '##', '##'],
});

/** The word, its letters (Ü = U + two dots) and the gap between neighbouring fills (px). */
export const DUEL_WORD = 'DÜELLO!';
const LETTER_GAP = 2;

export interface DuelLetter {
  /** The display letter ('Ü' keeps its dots). */
  ch: string;
  /** Left x of the fill inside the word box (the outline sits 1 px outside). */
  x: number;
  w: number;
  dots: boolean;
}

/** The word laid out: letter fills `LETTER_GAP` px apart (their 1-px outlines meet in the gap). */
export function duelWordLayout(): { letters: DuelLetter[]; w: number } {
  const letters: DuelLetter[] = [];
  let x = 0;
  for (const ch of DUEL_WORD) {
    const base = ch === 'Ü' ? 'U' : ch;
    const rows = DUEL_GLYPHS[base];
    const w = rows[0].length;
    letters.push({ ch, x, w, dots: ch === 'Ü' });
    x += w + LETTER_GAP;
  }
  return { letters, w: x - LETTER_GAP };
}

/** Fill pixels of one letter, (column, cap row) — the Ü's dots at rows −3 … −2. */
export function duelLetterPixels(ch: string): [number, number][] {
  const base = ch === 'Ü' ? 'U' : ch;
  const rows = DUEL_GLYPHS[base];
  if (!rows) return [];
  const px: [number, number][] = [];
  rows.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) if (row[c] === '#') px.push([c, r]);
  });
  if (ch === 'Ü') for (const dx of [2, 3, 7, 8]) for (const r of [-3, -2]) px.push([dx, r]);
  return px;
}

/** A letter's state: the stamp's white frame, the hot gold4 frame, rest (three bands), dim (leaving). */
export type DuelLetterState = 'white' | 'hot' | 'rest' | 'dim';

/** The rest tone of a fill pixel on cap row r (light from the top: gold4 / gold3 / gold2 in 4 / 5 / 4 rows; dots gold4). */
export function duelBandTone(r: number): number {
  if (r <= 3) return PAL.gold4;
  if (r <= 8) return PAL.gold3;
  return PAL.gold2;
}

function letterTone(state: DuelLetterState, r: number): number {
  if (state === 'white') return PAL.white;
  if (state === 'hot') return PAL.gold4;
  const t = duelBandTone(r);
  if (state === 'rest') return t;
  return t === PAL.gold4 ? PAL.gold3 : t === PAL.gold3 ? PAL.gold2 : PAL.gold1;
}

/**
 * One letter as palette pixels: its fill in `state`'s tones + a 1-px PAL.ink outline (8-neighbour).
 * Canvas (w + 2) × (DUEL_CAP + 2 [+ DOT_ROWS for Ü]); the fill's cap row 0 sits at y = 1 [+ DOT_ROWS].
 */
export function duelLetterCanvas(ch: string, state: DuelLetterState): PixelCanvas {
  const base = ch === 'Ü' ? 'U' : ch;
  const w = (DUEL_GLYPHS[base]?.[0].length ?? 1) + 2;
  const top = ch === 'Ü' ? DOT_ROWS : 0;
  const p = new PixelCanvas(w, DUEL_CAP + 2 + top);
  for (const [c, r] of duelLetterPixels(ch)) p.set(1 + c, 1 + top + r, r < 0 ? letterTone(state, 0) : letterTone(state, r));
  p.outline(PAL.ink, { corners: true });
  return p;
}

/** A duelist's mark: a 7 × 7 diamond in the player's tones (lit top-left, white centre) + ink outline (9 × 9). */
export function duelMarkCanvas(player: PlayerId, state: 'white' | 'rest' | 'blink' | 'dim'): PixelCanvas {
  const R = player === 0 ? RAMPS.cyan : RAMPS.crim;
  const p = new PixelCanvas(9, 9);
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++) {
      const d = Math.abs(x) + Math.abs(y);
      if (d > 3) continue;
      let c: number;
      if (state === 'white') c = PAL.white;
      else if (state === 'dim') c = d === 3 && x + y < 0 ? R[3] : R[2];
      else if (d === 0) c = state === 'blink' ? R[3] : PAL.white;
      else c = d === 3 && x + y < 0 ? R[4] : R[3];
      p.set(4 + x, 4 + y, c);
    }
  p.outline(PAL.ink);
  return p;
}

/** The plate body at an appear / exit step (−2 / −1 / 0): the bands, the ink outline, the ace corners. */
export function duelPlateBody(step: number): PixelCanvas {
  const { w, h, cut } = DUEL_PLATE;
  const p = new PixelCanvas(w, h);
  frameRectV3(p, 0, 0, w, h, null, {
    cut,
    bands: step >= 0 ? [PAL.night1, PAL.night0] : [PAL.night0, PAL.night0],
    ace: step >= -1,
  });
  return p;
}

/** Where the word and the marks sit inside the plate (whole pixels). */
export function duelPlateLayout(): { wordX: number; capY: number; marks: [number, number]; markY: number; wordW: number } {
  const { w, h } = DUEL_PLATE;
  const word = duelWordLayout();
  const wordX = Math.round((w - word.w) / 2);
  // the caps half a pixel under the plate's middle: the Ü's dots balance them above
  const capY = Math.floor((h - DUEL_CAP) / 2) + 1;
  const markY = capY + Math.floor(DUEL_CAP / 2) - 4;
  return { wordX, capY, marks: [wordX - 13 - 9, wordX + word.w + 13], markY, wordW: word.w };
}

const liveDuel = new Set<DuelPlate>();

export class DuelPlate {
  /** Resolves when the plate has dropped in, stamped its word and run its glint (33 frames, 0.55 s at 1×). */
  readonly entered: Promise<void>;
  readonly rect: Rect;
  private readonly scene: Phaser.Scene;
  private readonly root: Phaser.GameObjects.Container;
  private readonly body: Phaser.GameObjects.Image;
  private readonly trim: TrimGfx;
  private readonly letters: { img: Phaser.GameObjects.Image; L: DuelLetter; x: number; y: number }[] = [];
  private readonly marks: Phaser.GameObjects.Image[] = [];
  private readonly fx: Phaser.GameObjects.Graphics;
  private readonly lay = duelPlateLayout();
  private step = -3;
  private tween: Phaser.Tweens.Tween | null = null;
  private holdMs = 0;
  private blink = -1;
  private leaving: Promise<void> | null = null;
  private alive = true;
  private readonly onShutdown = () => this.destroy();
  private readonly onUpdate = (_t: number, dt: number) => this.tick(dt * this.scene.tweens.timeScale);

  /** Show the plate (any earlier one goes at once). */
  static show(scene: Phaser.Scene): DuelPlate {
    for (const p of [...liveDuel]) p.destroy();
    return new DuelPlate(scene);
  }

  /** The plate on screen (not leaving), or null. */
  static current(): DuelPlate | null {
    for (const p of liveDuel) if (p.alive && !p.leaving) return p;
    return null;
  }

  /** Every plate on screen leaves in its two palette steps (the first turn starts). */
  static leaveAll(): void {
    for (const p of [...liveDuel]) void p.leave();
  }

  private constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.rect = duelPlateRect();
    const r = this.rect;
    const y0 = REDUCED_MOTION ? r.y : r.y + DUEL_PLATE.drop[0];
    this.root = scene.add.container(r.x, y0).setDepth(DEPTH.HUD + 8).setScrollFactor(0);
    this.body = scene.add.image(0, 0, this.bodyKey(-2)).setOrigin(0, 0);
    this.root.add(this.body);
    this.trim = new TrimGfx(scene, this.root, 0, 0, r.w, r.h, DUEL_PLATE.cut);
    const { wordX, capY, marks, markY } = this.lay;
    for (const L of duelWordLayout().letters) {
      const x = wordX + L.x - 1;
      const y = capY - 1 - (L.dots ? DOT_ROWS : 0);
      const img = scene.add.image(x, y, this.letterKey(L.ch, 'rest')).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.letters.push({ img, L, x, y });
    }
    ([0, 1] as PlayerId[]).forEach((pl) => {
      const img = scene.add.image(marks[pl], markY, this.markKey(pl, 'rest')).setOrigin(0, 0).setVisible(false);
      this.root.add(img);
      this.marks.push(img);
    });
    this.fx = scene.add.graphics();
    this.root.add(this.fx);
    this.applyStep(REDUCED_MOTION ? 0 : -2);
    liveDuel.add(this);
    scene.events.once('shutdown', this.onShutdown);
    scene.events.on('update', this.onUpdate);
    this.entered = this.play();
  }

  get active(): boolean {
    return this.alive;
  }

  /** Two palette steps out (letters one tone down, then only the dark frame), then gone. */
  leave(): Promise<void> {
    if (this.leaving) return this.leaving;
    if (!this.alive) return Promise.resolve();
    this.tween?.stop();
    this.tween = null;
    this.leaving = this.runLeave();
    return this.leaving;
  }

  destroy(): void {
    if (!this.alive) return;
    this.alive = false;
    liveDuel.delete(this);
    this.tween?.stop();
    this.tween = null;
    this.scene.events.off('shutdown', this.onShutdown);
    this.scene.events.off('update', this.onUpdate);
    this.trim.destroy();
    if (this.root.active) this.root.destroy();
  }

  // ---------------------------------------------------------------- internals

  private bodyKey(step: number): string {
    const s = Math.max(-2, Math.min(0, step));
    return canvasTexture(this.scene, `ui3:duel:body:${s}`, () => duelPlateBody(s));
  }

  private letterKey(ch: string, state: DuelLetterState): string {
    return canvasTexture(this.scene, `ui3:duel:l:${ch.charCodeAt(0)}:${state}`, () => duelLetterCanvas(ch, state));
  }

  private markKey(player: PlayerId, state: 'white' | 'rest' | 'blink' | 'dim'): string {
    return canvasTexture(this.scene, `ui3:duel:m:${player}:${state}`, () => duelMarkCanvas(player, state));
  }

  private applyStep(step: number): void {
    if (step === this.step) return;
    this.step = step;
    this.body.setTexture(this.bodyKey(step));
    this.trim.set(plateTrim(RAMPS.gold, step));
  }

  /** The entry timeline: drop + palette steps, stamps + sparks, marks, thump, glint (scene clock). */
  private play(): Promise<void> {
    const P = DUEL_PLATE;
    const r = this.rect;
    const n = this.letters.length;
    const last = P.stampFrame + n - 1;
    const glintFrames = Math.ceil((this.lay.wordW + 2 * DUEL_CAP) / P.glintStep) + 1;
    const endFrame = Math.max(P.glintFrame + glintFrames, last + P.thumpFrames + 1);
    if (REDUCED_MOTION) {
      // there at once: rest tones, every letter and mark in place, no node
      this.root.y = r.y;
      for (const g of this.letters) g.img.setVisible(true).setTexture(this.letterKey(g.L.ch, 'rest'));
      this.marks.forEach((m, i) => m.setVisible(true).setTexture(this.markKey(i as PlayerId, 'rest')));
      return Promise.resolve();
    }
    let nodeOn = false;
    const frame = (ms: number) => {
      if (!this.alive || this.leaving) return;
      const f = Math.floor((ms + 0.5) / FRAME);
      // drop + two palette steps in
      this.applyStep(f <= 0 ? -2 : f === 1 ? -1 : 0);
      let y = r.y + P.drop[Math.min(f, P.drop.length - 1)];
      const thump = f > last && f <= last + P.thumpFrames;
      if (thump) y = r.y + 1;
      this.root.y = y;
      this.trim.set(f === last + 1 ? flatTrim(PAL.white) : plateTrim(RAMPS.gold, this.step));
      if (!nodeOn && f >= P.nodeFrame) {
        nodeOn = true;
        this.trim.setNode({ head: PAL.white, tail: [PAL.gold4, PAL.gold4, PAL.gold3], lapMs: P.nodeLapMs, restMs: 0 });
      }
      // letters: white 1 px high, gold4 in place, the bands
      this.letters.forEach((g, i) => {
        const s = P.stampFrame + i;
        const shown = f >= s;
        g.img.setVisible(shown);
        if (!shown) return;
        const state: DuelLetterState = f === s ? 'white' : f === s + 1 ? 'hot' : 'rest';
        g.img.setTexture(this.letterKey(g.L.ch, state));
        g.img.y = f === s ? g.y - 1 : g.y;
      });
      // the duelists' marks with the last letter
      this.marks.forEach((m, i) => {
        m.setVisible(f >= last);
        if (f >= last) m.setTexture(this.markKey(i as PlayerId, f === last ? 'white' : 'rest'));
      });
      // sparks + glint (1-px palette pixels)
      this.fx.clear();
      this.drawSparks(f);
      this.drawGlint(f - P.glintFrame);
    };
    return this.timeline(endFrame * FRAME, frame).then(() => {
      if (!this.alive || this.leaving) return;
      this.fx.clear();
      this.root.y = r.y;
      this.applyStep(0);
      this.trim.set(plateTrim(RAMPS.gold, 0));
      for (const g of this.letters) {
        g.img.setVisible(true).setTexture(this.letterKey(g.L.ch, 'rest'));
        g.img.y = g.y;
      }
      this.marks.forEach((m, i) => m.setVisible(true).setTexture(this.markKey(i as PlayerId, 'rest')));
    });
  }

  /** Two 1-px sparks skid out under each letter for the three frames after its stamp. */
  private drawSparks(f: number): void {
    const P = DUEL_PLATE;
    const { wordX, capY } = this.lay;
    const tones = [PAL.gold4, PAL.gold3, PAL.gold2];
    const y = capY + DUEL_CAP + 1;
    this.letters.forEach((g, i) => {
      const k = f - (P.stampFrame + i);
      if (k < 0 || k > 2) return;
      this.fx.fillStyle(tones[k], 1);
      const x0 = wordX + g.L.x;
      const x1 = x0 + g.L.w - 1;
      const dy = k === 2 ? 1 : 0;
      this.fx.fillRect(x0 - 1 - k, y + dy, 1, 1);
      this.fx.fillRect(x1 + 1 + k, y + dy, 1, 1);
    });
  }

  /** The glint: a slanted white band (its last column gold4) over the letters' fills only. */
  private drawGlint(k: number): void {
    if (k < 0) return;
    const P = DUEL_PLATE;
    const { wordX, capY, wordW } = this.lay;
    const pos = k * P.glintStep - DUEL_CAP;
    if (pos > wordW + 2) return;
    for (const g of this.letters) {
      for (const [c, r] of duelLetterPixels(g.L.ch)) {
        const x = g.L.x + c;
        const d = x - pos - Math.floor((DUEL_CAP - Math.max(0, r)) / 2);
        if (d < 0 || d >= P.glintW) continue;
        const rest = r < 0 ? PAL.gold4 : duelBandTone(r);
        const tone = d < P.glintW - 1 ? PAL.white : rest === PAL.gold4 ? PAL.white : PAL.gold4;
        this.fx.fillStyle(tone, 1);
        this.fx.fillRect(wordX + x, capY + r, 1, 1);
      }
    }
  }

  /** While the plate holds: the light node runs, the marks' centres blink in turn; the safety exit. */
  private tick(dt: number): void {
    if (!this.alive) return;
    this.trim.tick(dt);
    if (this.leaving || this.tween) return;
    this.holdMs += dt;
    if (!REDUCED_MOTION) {
      const b = Math.floor(this.holdMs / (DUEL_PLATE.blinkFrames * FRAME)) % 4;
      if (b !== this.blink) {
        this.blink = b;
        this.marks.forEach((m, i) => m.setTexture(this.markKey(i as PlayerId, b === 1 + 2 * i ? 'blink' : 'rest')));
      }
    }
    if (this.holdMs >= DUEL_PLATE.maxHoldMs) void this.leave();
  }

  private async runLeave(): Promise<void> {
    const P = DUEL_PLATE;
    this.trim.setNode(null);
    this.fx.clear();
    this.root.y = this.rect.y;
    const steps = (ms: number) => {
      if (!this.alive) return;
      const s = ms < P.exitFrames * FRAME - 0.5 ? -1 : -2;
      this.applyStep(s);
      for (const g of this.letters) {
        g.img.y = g.y;
        g.img.setVisible(s === -1 && g.img.visible).setTexture(this.letterKey(g.L.ch, 'dim'));
      }
      this.marks.forEach((m, i) => m.setVisible(s === -1 && m.visible).setTexture(this.markKey(i as PlayerId, 'dim')));
    };
    await this.timeline(2 * P.exitFrames * FRAME, steps);
    this.destroy();
  }

  /** fn(ms) on the scene's tween clock from 0 to `ms` (speed / skip aware); resolves at the end. */
  private timeline(ms: number, fn: (ms: number) => void): Promise<void> {
    return new Promise((resolve) => {
      fn(0);
      const t = this.scene.tweens.addCounter({
        from: 0,
        to: ms,
        duration: ms,
        onUpdate: (tw) => fn(tw.getValue() ?? 0),
        onComplete: () => {
          fn(ms);
          if (this.tween === t) this.tween = null;
          resolve();
        },
        onStop: () => resolve(),
      });
      this.tween = t;
    });
  }
}
